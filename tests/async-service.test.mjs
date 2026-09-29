import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/inquiry-store.mjs';
import {createInquiryService} from '../server/inquiry-service.mjs';
import {createPropstack,ProcessingDeferred} from '../server/propstack.mjs';
import {validateInquiry} from '../shared/inquiry-schema.mjs';
import {fixture,contact,fakeCrm} from './fixtures.mjs';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const writes=(crm,route)=>crm.calls.filter(call=>call.method==='POST'&&new URL(call.url).pathname==='/v1'+route);
const evidence={permissionText:'Test contact permission',newsletterText:'Test optional preference',landingUrl:'https://investo.example/'};
function asyncStore(store,overrides={},delayMs=1){
  return Object.fromEntries(Object.entries(store).map(([name,method])=>[name,overrides[name]||async function(...args){if(delayMs)await wait(delayMs);return method(...args);}]));
}
async function setup(t,options={}){
  const folder=mkdtempSync(path.join(tmpdir(),'investo-async-test-'));
  const store=createStore(path.join(folder,'db.sqlite'));
  t.after(()=>{store.close();if(path.dirname(folder)===path.resolve(tmpdir())&&path.basename(folder).startsWith('investo-async-test-'))rmSync(folder,{recursive:true});});
  const payload=validateInquiry(fixture()).payload;
  store.reserve(payload,randomUUID(),evidence);
  const crm=fakeCrm(options);
  return {store,payload,crm,service:(wrapped=asyncStore(store),fetchImpl=crm.fetchImpl)=>createInquiryService({store:wrapped,apiKey:'server-secret',newContactOwnerId:443333,fetchImpl,timeoutMs:1000})};
}

test('async store persists each write intent and renews the lease before vendor fetches',async t=>{
  const h=await setup(t);let updating=false,renewing=false,renewals=0,fetches=0;
  const wrapped=asyncStore(h.store,{
    update:async(...args)=>{updating=true;await wait(4);h.store.update(...args);updating=false;},
    touch:async(...args)=>{renewing=true;await wait(4);h.store.touch(...args);renewing=false;renewals++;},
  });
  const fetchImpl=async(url,init)=>{
    assert.equal(updating,false,'write checkpoint must be durable before any request');
    assert.equal(renewing,false,'lease renewal must finish before any request');
    assert.equal(renewals,++fetches,'every vendor request requires its own completed renewal');
    if(init.method==='POST'){
      const expected=new URL(url).pathname==='/v1/contacts'?'contact_create_started':'inquiry_create_started';
      assert.equal(h.store.get(h.payload.submission_id).phase,expected);
    }
    return h.crm.fetchImpl(url,init);
  };
  const row=await h.service(wrapped,fetchImpl).process(h.payload.submission_id);
  assert.equal(row.status,'accepted');assert.equal(row.lease_token,null);
  assert.equal(writes(h.crm,'/contacts').length,1);assert.equal(writes(h.crm,'/tasks').length,1);
});

test('async uncertainty recovery reconciles persisted contact and inquiry writes without repeating POSTs',async t=>{
  for(const options of [{contactTimeout:true},{taskTimeout:true}])await t.test(Object.keys(options)[0],async st=>{
    const h=await setup(st,options),id=h.payload.submission_id;
    const first=await h.service().process(id);
    assert.equal(first.status,'pending');assert.match(first.phase,/_create_started$/);
    const recovered=await h.service().process(id);
    assert.equal(recovered.status,'accepted');assert.equal(h.store.get(id).lease_token,null);
    assert.equal(writes(h.crm,'/contacts').length,1);assert.equal(writes(h.crm,'/tasks').length,1);
  });
});

test('a lease replaced during asynchronous renewal stops before the contact POST',async t=>{
  const h=await setup(t);let renewals=0,replacement;
  const wrapped=asyncStore(h.store,{
    touch:async(id,token)=>{
      await wait(2);
      if(++renewals===2){h.store.release(id,token);replacement=h.store.claim(id);throw Error('Lease lost.');}
      h.store.touch(id,token);
    },
  });
  const row=await h.service(wrapped).process(h.payload.submission_id);
  assert.equal(row.status,'pending');assert.equal(row.phase,'contact_create_started');
  assert.equal(row.lease_token,replacement,'old worker must not release or update the replacement lease');
  assert.equal(row.review_reason,null);assert.equal(writes(h.crm,'/contacts').length,0);
  assert.equal(writes(h.crm,'/tasks').length,0);
});

test('an expired lease observed before renewal cannot authorize any vendor request',async t=>{
  const h=await setup(t);let expired=false;
  const wrapped=asyncStore(h.store,{
    claim:async id=>{const token=h.store.claim(id);expired=true;return token;},
    get:async id=>{await wait(1);const row=h.store.get(id);return expired&&row?.lease_token?{...row,lease_until:Date.now()-1}:row;},
  });
  const row=await h.service(wrapped).process(h.payload.submission_id);
  assert.equal(row.status,'pending');assert.equal(row.phase,'reserved');assert.equal(h.crm.calls.length,0);
});

test('budget expiry while awaiting durable intent prevents POST and leaves recoverable pending work',async t=>{
  const h=await setup(t);
  const wrapped=asyncStore(h.store,{
    update:async(id,token,values)=>{
      if(values.phase==='contact_create_started')await wait(350);
      h.store.update(id,token,values);
    },
  },0);
  const row=await h.service(wrapped).process(h.payload.submission_id,{budgetMs:250});
  assert.equal(row.status,'pending');assert.equal(row.phase,'contact_create_started');
  assert.equal(row.review_reason,'processing_deferred');assert.equal(row.lease_token,null);
  assert.ok(row.next_attempt>Date.now());assert.equal(writes(h.crm,'/contacts').length,0);
  const recovered=await h.service().process(h.payload.submission_id);
  assert.equal(recovered.status,'pending');assert.equal(writes(h.crm,'/contacts').length,0,'uncertain intent is never blindly retried');
});

test('vendor request awaits before(), honors its remaining timeout and does not wrap a stop as vendor failure',async()=>{
  let renewed=false,fetched=false;
  const vendor=createPropstack({apiKey:'server-secret',timeoutMs:5000,fetchImpl:async(_url,{signal})=>{
    fetched=true;assert.equal(renewed,true);
    return new Promise((_resolve,reject)=>{
      const keepAlive=setTimeout(()=>reject(Error('Expected budget timeout')),500);
      signal.addEventListener('abort',()=>{clearTimeout(keepAlive);reject(signal.reason);},{once:true});
    });
  }});
  const start=Date.now();
  await assert.rejects(vendor.request('/contacts',{before:async()=>{await wait(5);renewed=true;return 20;}}),error=>error instanceof ProcessingDeferred&&error.message==='budget_exhausted');
  assert.equal(fetched,true);assert.ok(Date.now()-start<400,'remaining budget must cap the 5-second vendor timeout');
  const stopped=createPropstack({apiKey:'server-secret',fetchImpl:async()=>assert.fail('No fetch after failed before()')});
  await assert.rejects(stopped.request('/tasks',{method:'POST',before:async()=>{await wait(1);throw new ProcessingDeferred('lease_lost');}}),error=>error instanceof ProcessingDeferred&&error.message==='lease_lost');
  await assert.rejects(stopped.request('/tasks',{method:'POST',before:async()=>0}),error=>error instanceof ProcessingDeferred&&error.message==='budget_exhausted');
});

test('resumePending awaits asynchronous queue access and bounds number of processed inquiries',async t=>{
  const h=await setup(t,{contacts:[contact()]});
  const second=validateInquiry(fixture()).payload;
  h.store.reserve(second,randomUUID(),evidence);
  await h.service().resumePending({budgetMs:2000,maxItems:1});
  assert.equal(h.store.get(h.payload.submission_id).status,'accepted');
  assert.equal(h.store.get(second.submission_id).attempts,0);assert.equal(writes(h.crm,'/tasks').length,1);
});

test('resumePending shares one time budget across the batch and starts no later work after expiry',async t=>{
  const h=await setup(t),second=validateInquiry(fixture()).payload;
  h.store.reserve(second,randomUUID(),evidence);
  let calls=0;
  const fetchImpl=async()=>{calls++;await wait(350);return Response.json([]);};
  await h.service(asyncStore(h.store,{},0),fetchImpl).resumePending({budgetMs:250,maxItems:10});
  assert.equal(calls,1);assert.equal(h.store.get(h.payload.submission_id).status,'pending');
  assert.equal(h.store.get(second.submission_id).attempts,0);
});

test('repeated budget exhaustion in paginated inquiry history becomes review without restarting writes',async t=>{
  const h=await setup(t,{contacts:[contact()]}),id=h.payload.submission_id;
  // Model the persisted checkpoint left by an earlier uncertain inquiry POST.
  const token=h.store.claim(id);
  h.store.update(id,token,{contact_id:123,owner_id:443427,phase:'inquiry_create_started'});
  h.store.release(id,token);
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,method:init.method});
    const parsed=new URL(url);
    if(parsed.pathname==='/v1/activities'){
      const page=Number(parsed.searchParams.get('page'));
      await new Promise((resolve,reject)=>{
        const finish=()=>{init.signal.removeEventListener('abort',abort);resolve();};
        const timer=setTimeout(finish,100);
        const abort=()=>{clearTimeout(timer);reject(init.signal.reason);};
        if(init.signal.aborted)abort();
        else init.signal.addEventListener('abort',abort,{once:true});
      });
      return Response.json({data:Array.from({length:100},(_,i)=>({id:(page-1)*100+i+1})),meta:{total_count:400}});
    }
    return h.crm.fetchImpl(url,init);
  };
  const service=h.service(asyncStore(h.store,{},0),fetchImpl);
  const first=await service.process(id,{budgetMs:250});
  assert.equal(first.status,'pending');assert.equal(first.review_reason,'processing_deferred');
  const second=await service.process(id,{budgetMs:250});
  assert.equal(second.status,'review');assert.equal(second.review_reason,'inquiry_reconciliation_timeout');
  assert.equal(second.attempts,3);assert.equal(second.phase,'inquiry_create_started');assert.equal(second.inquiry_id,null);
  const pages=calls.filter(call=>new URL(call.url).pathname==='/v1/activities').map(call=>Number(new URL(call.url).searchParams.get('page')));
  assert.equal(pages.filter(page=>page===1).length,2);assert.ok(pages.includes(2),'test must exhaust budget while traversing multiple history pages');
  assert.ok(calls.every(call=>call.method==='GET'),'reconciliation cannot issue another POST');
  const total=calls.length;
  assert.equal((await service.process(id,{budgetMs:250})).status,'review');
  assert.equal(calls.length,total,'automatic processing stops once operator review is required');
});
