import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createVercelHandler,runtimeSettings} from '../server/vercel-runtime.mjs';
import {createApp} from '../server/app.mjs';
import {createPostgresStore} from '../server/postgres-inquiry-store.mjs';
import {fixture,fakeCrm} from './fixtures.mjs';

const env={PUBLIC_SITE_URL:'https://investo.example',DATABASE_URL:'postgresql://test.invalid/investo',PROPSTACK_API_KEY:'test-server-key',PROPSTACK_NEW_CONTACT_OWNER_ID:'443333',CONTACT_CONSENT_APPROVED:'true',TURNSTILE_SITE_KEY:'test-public-sitekey',TURNSTILE_SECRET_KEY:'test-private-bot-key',CRON_SECRET:'test-only-worker-secret-32-characters',INQUIRY_RETRY_SCHEDULE_CONFIRMED:'true'};
async function listen(t,handler){
  const server=createServer((req,res)=>{Promise.resolve(handler(req,res)).catch(()=>{res.statusCode=500;res.end();});});
  server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return `http://127.0.0.1:${server.address().port}`;
}
async function database(t){
  const db=new PGlite();
  const pool={query:(sql,values)=>values===undefined&&sql.trimStart().startsWith('BEGIN;')?db.exec(sql):db.query(sql,values)};
  const store=await createPostgresStore({pool});
  t.after(()=>db.close());return {store,db};
}
test('missing storage has readable safe config and does not accept form submissions',async t=>{
  let opened=false;
  const base=await listen(t,createVercelHandler({env:{PUBLIC_SITE_URL:env.PUBLIC_SITE_URL},storeFactory:async()=>{opened=true;throw Error('unexpected');}}));
  const response=await fetch(base+'/api/inquiries/config');
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{available:false,turnstile_site_key:null,consent_version:'2026-09-24-v1'});
  assert.equal(opened,false);
  assert.equal((await fetch(base+'/api/inquiries',{method:'POST'})).status,503);
  assert.equal((await fetch(base+'/api/inquiries/retry')).status,401);
});
test('database initialization errors are sanitized and retried on a later invocation',async t=>{
  let attempts=0;
  const base=await listen(t,createVercelHandler({env,storeFactory:async()=>{attempts++;throw Error('database-password-in-provider-error');}}));
  const a=await fetch(base+'/api/inquiries/config');assert.equal(a.status,200);assert.equal((await a.json()).available,false);
  const b=await fetch(base+'/api/inquiries/status/'+randomUUID());assert.equal(b.status,503);assert.deepEqual(await b.json(),{error:'service_unavailable'});assert.equal(attempts,2);
});
test('runtime requires explicit launch settings and exact HTTPS origins',()=>{
  assert.equal(runtimeSettings(env).integrationReady,true);
  for(const change of [{INQUIRY_RETRY_SCHEDULE_CONFIRMED:'false'},{CRON_SECRET:''},{PROPSTACK_NEW_CONTACT_OWNER_ID:'99'}])assert.equal(runtimeSettings({...env,...change}).integrationReady,false);
  for(const origin of ['http://investo.example','https://user:password@investo.example','https://investo.example/path'])assert.throws(()=>runtimeSettings({...env,PUBLIC_SITE_URL:origin}));
  assert.throws(()=>runtimeSettings({...env,ALLOWED_ORIGINS:'https://investo.example/path'}));
});
test('functions sharing PostgreSQL preserve one receipt and one CRM write across retries',async t=>{
  const {store,db}=await database(t),crm=fakeCrm();
  const options={env,storeFactory:async()=>store,appFactory:settings=>createApp({...settings,fetchImpl:crm.fetchImpl})};
  const base=await listen(t,createVercelHandler(options));
  const second=await listen(t,createVercelHandler(options));
  assert.equal((await (await fetch(base+'/api/inquiries/config')).json()).available,true);
  const payload=fixture(),token=randomUUID();
  const send=(url=base,p=payload)=>fetch(url+'/api/inquiries',{method:'POST',headers:{origin:env.PUBLIC_SITE_URL,'content-type':'application/json','idempotency-key':p.submission_id,'x-submission-token':token},body:JSON.stringify(p)});
  const results=await Promise.all([send(),send(second)]);
  assert.ok(results.every(response=>[201,202,200].includes(response.status)));
  assert.equal((await send(second)).status,200);
  const statusUrl=second+'/api/inquiries/status/'+payload.submission_id;
  assert.equal((await fetch(statusUrl)).status,404);
  const receipt=await fetch(statusUrl,{headers:{authorization:'Bearer '+token}});
  assert.equal(receipt.status,200);const body=await receipt.json();assert.equal(body.accepted,true);assert.ok(!JSON.stringify(body).includes(payload.contact.email));
  assert.equal(crm.calls.filter(call=>call.method==='POST'&&new URL(call.url).pathname==='/v1/contacts').length,1);
  assert.equal(crm.calls.filter(call=>call.method==='POST'&&new URL(call.url).pathname==='/v1/tasks').length,1);
  assert.equal((await send(base,{...payload,answers:{...payload.answers,preferred_region:'Munich'}})).status,409);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM investo_intake.inquiries')).rows[0].count,1);

  // Pending work is awaited by the protected worker and persists before its 200.
  crm.options.outage=true;const pending=fixture();
  assert.equal((await send(base,pending)).status,202);
  assert.equal((await fetch(base+'/api/inquiries/retry')).status,401);
  crm.options.outage=false;
  await db.query('UPDATE investo_intake.inquiries SET next_attempt=0 WHERE id=$1',[pending.submission_id]);
  const worker=await fetch(second+'/api/inquiries/retry',{headers:{authorization:'Bearer '+env.CRON_SECRET}});
  assert.equal(worker.status,200);assert.deepEqual(await worker.json(),{ok:true});
  assert.equal((await store.get(pending.submission_id)).status,'accepted');
});
