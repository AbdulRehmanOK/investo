import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/inquiry-store.mjs';
import {createInquiryService} from '../server/inquiry-service.mjs';
import {runReconciliation} from '../server/reconcile.mjs';
import {fixture,fakeCrm} from './fixtures.mjs';
import {validateInquiry} from '../shared/inquiry-schema.mjs';

const wait=()=>new Promise(resolve=>setTimeout(resolve,1));
const evidence={permissionText:'Test permission',newsletterText:'Test optional newsletter',landingUrl:'https://investo.example/'};
async function setup(t,options={taskTimeout:true}){
  const folder=mkdtempSync(path.join(tmpdir(),'investo-reconcile-test-'));
  const filename=path.join(folder,'db.sqlite'),store=createStore(filename);
  t.after(()=>{store.close();if(path.dirname(folder)===path.resolve(tmpdir())&&path.basename(folder).startsWith('investo-reconcile-test-'))rmSync(folder,{recursive:true});});
  const payload=validateInquiry(fixture()).payload,crm=fakeCrm(options);
  store.reserve(payload,randomUUID(),evidence);
  const service=createInquiryService({store,apiKey:'private-key',newContactOwnerId:443333,fetchImpl:crm.fetchImpl});
  await service.process(payload.submission_id);
  return {store,filename,payload,crm};
}
const writeCount=crm=>crm.calls.filter(call=>call.method==='POST').length;
function delayedStore(store,state){
  return Object.fromEntries(Object.entries(store).map(([name,method])=>[name,async(...args)=>{
    await wait();
    if(name==='close'){state.closed=true;return;}
    if(name==='reopenForReconciliation')state.reopened++;
    return method(...args);
  }]));
}

test('private reconciliation uses async DATABASE_URL storage and only reads CRM to accept an uncertain write',async t=>{
  const h=await setup(t),state={closed:false,reopened:0};
  const before=writeCount(h.crm),databaseUrl='postgresql://user:private-db@example.test/db';
  const result=await runReconciliation(h.payload.submission_id,{
    env:{PROPSTACK_API_KEY:'private-key',DATABASE_URL:databaseUrl,POSTGRES_URL:'postgresql://other:unused@example.test/other'},
    openPostgres:async options=>{assert.deepEqual(options,{connectionString:databaseUrl});await wait();return delayedStore(h.store,state);},
    openSqlite:()=>assert.fail('DATABASE_URL must select PostgreSQL'),fetchImpl:h.crm.fetchImpl,
  });
  assert.deepEqual(result,{submission_id:h.payload.submission_id,status:'accepted'});
  assert.equal(state.closed,true);assert.equal(state.reopened,1);assert.equal(writeCount(h.crm),before);
  assert.equal(h.store.get(h.payload.submission_id).phase,'inquiry_stored');
});

test('POSTGRES_URL alias selects durable storage and an absent task never triggers another POST',async t=>{
  const h=await setup(t,{taskAbsent:true}),state={closed:false,reopened:0};
  const before=writeCount(h.crm),databaseUrl='postgresql://user:private-db@example.test/db';
  const result=await runReconciliation(h.payload.submission_id,{
    env:{PROPSTACK_API_KEY:'private-key',POSTGRES_URL:databaseUrl},
    openPostgres:async options=>{assert.equal(options.connectionString,databaseUrl);return delayedStore(h.store,state);},
    openSqlite:()=>assert.fail('POSTGRES_URL must select PostgreSQL'),fetchImpl:h.crm.fetchImpl,
  });
  assert.equal(result.status,'pending');assert.equal(writeCount(h.crm),before);
  assert.equal(state.closed,true);assert.equal(h.store.get(h.payload.submission_id).phase,'inquiry_create_started');
});

test('local SQLite reconciliation opens the configured file and preserves readback-only behavior',async t=>{
  const h=await setup(t),before=writeCount(h.crm);
  const result=await runReconciliation(h.payload.submission_id,{
    env:{PROPSTACK_API_KEY:'private-key',LEAD_DB_PATH:h.filename},fetchImpl:h.crm.fetchImpl,
    openPostgres:()=>assert.fail('No database URL must retain local SQLite'),
  });
  assert.equal(result.status,'accepted');assert.equal(writeCount(h.crm),before);
  assert.equal(h.store.get(h.payload.submission_id).status,'accepted');
});

test('invalid CLI input fails before storage is opened',async()=>{
  let opens=0;
  const open=async()=>{opens++;throw Error('Must not open');};
  await assert.rejects(runReconciliation('bad-id',{env:{PROPSTACK_API_KEY:'private-key'},openSqlite:open,openPostgres:open}),/Usage:/);
  await assert.rejects(runReconciliation(randomUUID(),{env:{},openSqlite:open,openPostgres:open}),/Usage:/);
  assert.equal(opens,0);
});

test('operator restrictions reject accepted, contact-resolution, missing-ID and claimed incidents without vendor calls',async t=>{
  const cases=[
    {name:'unknown',row:null,error:/Unknown submission/},
    {name:'accepted',row:{phase:'inquiry_create_started',status:'accepted',contact_id:123,owner_id:443333},error:/only reconciles/},
    {name:'contact incident',row:{phase:'contact_create_started',status:'review'},error:/only reconciles/},
    {name:'missing contact',row:{phase:'inquiry_create_started',status:'review',owner_id:443333},error:/missing resolved contact/},
    {name:'currently claimed',row:{phase:'inquiry_create_started',status:'review',contact_id:123,owner_id:443333},error:/currently claimed/},
  ];
  for(const item of cases)await t.test(item.name,async()=>{
    let closed=false,reopens=0;
    const store={
      get:async()=>{await wait();return item.row;},
      reopenForReconciliation:async()=>{await wait();reopens++;return false;},
      close:async()=>{await wait();closed=true;},
    };
    await assert.rejects(runReconciliation(randomUUID(),{
      env:{PROPSTACK_API_KEY:'private-key',DATABASE_URL:'postgresql://not-displayed'},
      openPostgres:async()=>store,fetchImpl:()=>assert.fail('Guarded operator incident must not contact CRM'),
    }),item.error);
    assert.equal(closed,true);assert.equal(reopens,item.name==='currently claimed'?1:0);
  });
});

test('storage closes even if asynchronous lookup fails',async()=>{
  let closed=false;
  await assert.rejects(runReconciliation(randomUUID(),{
    env:{PROPSTACK_API_KEY:'private-key',POSTGRES_URL:'postgresql://not-displayed'},
    openPostgres:async()=>({get:async()=>{await wait();throw Error('storage unavailable');},close:async()=>{await wait();closed=true;}}),
  }),/storage unavailable/);
  assert.equal(closed,true);
});
