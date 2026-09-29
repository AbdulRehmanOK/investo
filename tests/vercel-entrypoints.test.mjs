import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';

test('every Vercel entry exports a real Express app so the runtime does not consume request bodies first',async()=>{
  for(const entry of ['../api/inquiries.js','../api/inquiries/config.js','../api/inquiries/retry.js','../api/inquiries/status/[id].js']){
    const {default:app}=await import(entry);
    // Vercel's Node runtime gates addHelpers on typeof listener.listen. Exporting
    // an ordinary wrapping function would change this and break express.json.
    assert.equal(typeof app,'function',entry);
    assert.equal(typeof app.listen,'function',entry);
    assert.equal(typeof app.handle,'function',entry);
    assert.equal(app.enabled('x-powered-by'),false,entry);
  }
});

test('the deployed config entry responds with safe JSON while launch credentials are absent',async t=>{
  const keys=['DATABASE_URL','POSTGRES_URL','PROPSTACK_API_KEY','PUBLIC_SITE_URL','ALLOWED_ORIGINS','CONTACT_CONSENT_APPROVED','CRON_SECRET','INQUIRY_RETRY_SCHEDULE_CONFIRMED'];
  const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  for(const key of keys)delete process.env[key];
  t.after(()=>{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}});
  const {default:app}=await import('../api/inquiries/config.js');
  const server=createServer(app).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/inquiries/config`);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/^application\/json/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-powered-by'),null);
  const body=await response.json();
  assert.equal(body.available,false);
  assert.equal(body.turnstile_site_key,null);
  assert.deepEqual(Object.keys(body).sort(),['available','consent_version','turnstile_site_key']);
});
