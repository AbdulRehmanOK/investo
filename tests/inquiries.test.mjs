import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {validateInquiry,normalizePhone} from '../shared/inquiry-schema.mjs';
import {fieldValue,incomeIds,goalIds,newContact} from '../automation/website-mapping.mjs';
import {fixture,contact,fakeCrm} from './fixtures.mjs';
async function harness(t,options={},overrides={}){
  const folder=mkdtempSync(path.join(tmpdir(),'investo-inquiry-test-')),crm=fakeCrm(options),token=randomUUID();
  const config={databasePath:path.join(folder,'db.sqlite'),siteUrl:'https://investo.example',apiKey:'server-secret',newContactOwnerId:443333,consentApproved:true,turnstileSecret:'bot-secret',turnstileSiteKey:'public-sitekey',fetchImpl:crm.fetchImpl,...overrides};
  let instance,server;
  async function start(){instance=createApp(config);server=instance.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));}
  async function stop(){await new Promise(r=>server.close(r));instance.close();}
  await start();t.after(async()=>{await stop();if(path.dirname(folder)===path.resolve(tmpdir())&&path.basename(folder).startsWith('investo-inquiry-test-'))rmSync(folder,{recursive:true});});
  const base=()=>`http://127.0.0.1:${server.address().port}`;
  return {crm,config,token,base,send:(payload,headers={})=>fetch(base()+'/api/inquiries',{method:'POST',headers:{origin:'https://investo.example','content-type':'application/json','idempotency-key':payload.submission_id,'x-submission-token':token,...headers},body:JSON.stringify(payload)}),status:(id,receiptToken=token)=>fetch(base()+'/api/inquiries/status/'+id,{headers:{authorization:'Bearer '+receiptToken}}),process:id=>instance.service.process(id),row:id=>instance.store.get(id),restart:async()=>{await stop();await start();}};
}
const writes=(h,route)=>h.crm.calls.filter(c=>c.method==='POST'&&new URL(c.url).pathname==='/v1'+route);
test('shared intake owner is supported and existing advisor ownership is preserved',async t=>{
 const h=await harness(t,{}, {newContactOwnerId:443334});const p=fixture();
 assert.equal((await h.send(p)).status,201);
 assert.equal(writes(h,'/contacts')[0].body.client.broker_id,443334);
 assert.equal(writes(h,'/tasks')[0].body.task.broker_id,443334);
 const shared=await harness(t,{contacts:[contact({broker_id:443334})]},{newContactOwnerId:443334});
 assert.equal((await shared.send(fixture())).status,201);assert.equal(writes(shared,'/contacts').length,0);
 assert.equal(writes(shared,'/tasks')[0].body.task.broker_id,443334);
 const advisor=await harness(t,{contacts:[contact()]},{newContactOwnerId:443334});
 assert.equal((await advisor.send(fixture())).status,201);assert.equal(writes(advisor,'/tasks')[0].body.task.broker_id,443427);
});
test('new inquiry uses exact account IDs, numeric dropdowns, comma-separated goals and readback before success',async t=>{
 const h=await harness(t),payload=fixture();const response=await h.send(payload);assert.equal(response.status,201);const receipt=await response.json();assert.equal(receipt.accepted,true);assert.ok(!Number.isNaN(Date.parse(receipt.received_at)));
 const c=writes(h,'/contacts')[0].body.client;assert.equal(c.broker_id,443333);assert.equal(c.client_source_id,364441);assert.equal(c.client_status_id,348539);assert.equal(c.home_cell,'+491701234567');assert.deepEqual(c.partial_custom_fields,{lead_phase_aktuell:355771,nettohaushaltseinkommen:320199,investmentziel:'320179,320180',utm_quelle:'google',utm_medium:'cpc',utm_kampagne:'strategy'});for(const key of ['newsletter','gdpr_status','approved'])assert.ok(!(key in c));
 const task=writes(h,'/tasks')[0].body.task;assert.equal(task.note_type_id,734823);assert.deepEqual(task.client_ids,[1000]);assert.equal(task.client_source_id,364441);assert.match(task.body,new RegExp('^<p>INV-SUBMISSION:'+payload.submission_id+'</p>'));assert.ok(task.body.includes(receipt.received_at));for(const key of ['is_reminder','is_event','starts_at','property_ids','due_date'])assert.ok(!(key in task));assert.ok(h.crm.calls.some(c=>c.url.endsWith('/tasks/2000')&&c.method==='GET'));
 assert.equal(h.row(payload.submission_id).inquiry_id,2000);assert.equal(h.row(payload.submission_id).contact_id,1000);
});
test('existing contact and a later inquiry preserve reviewed data, source, phase and owner',async t=>{
 const existing=contact(),h=await harness(t,{contacts:[existing]});const first=fixture();assert.equal((await h.send(first)).status,201);const later=fixture();later.answers.income_band='Über 12.000 €';assert.equal((await h.send(later)).status,201);assert.equal(writes(h,'/contacts').length,0);assert.equal(writes(h,'/tasks').length,2);assert.deepEqual(h.crm.contacts,[existing]);assert.ok(h.crm.tasks.every(x=>x.broker_id===443427));
});
test('double-click/concurrent identical requests and restart return one durable receipt',async t=>{
 const h=await harness(t),p=fixture();await Promise.all([h.send(p),h.send(p),h.send(p)]);assert.equal(writes(h,'/contacts').length,1);assert.equal(writes(h,'/tasks').length,1);await h.restart();assert.equal((await h.send(p)).status,200);assert.equal((await h.status(p.submission_id)).status,200);assert.equal((await h.status(p.submission_id,randomUUID())).status,404);p.answers.income_band='Über 12.000 €';assert.equal((await h.send(p)).status,409);assert.equal(writes(h,'/tasks').length,1);
});
test('distinct concurrent inquiries for normalized email serialize contact resolution',async t=>{
 const h=await harness(t),a=fixture(),b=fixture();b.contact.email='ALEX@EXAMPLE.COM';await Promise.all([h.send(a),h.send(b)]);await h.process(a.submission_id);await h.process(b.submission_id);assert.equal(writes(h,'/contacts').length,1);assert.equal(writes(h,'/tasks').length,2);assert.equal(h.crm.contacts.length,1);
});
test('timeout after inquiry accepted reconciles exact marker after restart without another POST',async t=>{
 const h=await harness(t,{taskTimeout:true}),p=fixture();assert.equal((await h.send(p)).status,202);assert.equal(h.row(p.submission_id).phase,'inquiry_create_started');await h.restart();await h.process(p.submission_id);assert.equal((await h.status(p.submission_id)).status,200);assert.equal(writes(h,'/tasks').length,1);assert.ok(h.crm.calls.some(c=>c.url.includes('/activities?')));
});
test('unresolved inquiry creation stays pending/review without blind retries or false success',async t=>{
 const h=await harness(t,{taskAbsent:true}),p=fixture();await h.send(p);await h.process(p.submission_id);await h.process(p.submission_id);assert.equal(h.row(p.submission_id).status,'review');assert.equal(writes(h,'/tasks').length,1);assert.equal((await (await h.status(p.submission_id)).json()).accepted,false);
});
test('contact-creation timeout reconciles by exact email, never re-POSTs contact',async t=>{
 const h=await harness(t,{contactTimeout:true}),p=fixture();assert.equal((await h.send(p)).status,202);await h.restart();await h.process(p.submission_id);assert.equal((await h.status(p.submission_id)).status,200);assert.equal(writes(h,'/contacts').length,1);assert.equal(writes(h,'/tasks').length,1);
});
test('withdrawn, unknown permission, archived, locked, deleted and non-CEO contacts require review',async t=>{
 for(const change of [{accept_contact:false},{accept_contact:null},{archived:true},{locked:true},{deleted_at:'2026-01-01'},{gdpr_status:3},{cp_delete_request_date:'2026-01-01'},{broker_id:1}])await t.test(JSON.stringify(change),async st=>{const h=await harness(st,{contacts:[contact(change)]}),p=fixture();assert.equal((await h.send(p)).status,202);assert.equal(h.row(p.submission_id).status,'review');assert.equal(writes(h,'/contacts').length+writes(h,'/tasks').length,0);});
});
test('ambiguous exact contacts and missing new owner never guess or write',async t=>{
 const h=await harness(t,{contacts:[contact(),contact({id:456})]}),p=fixture();await h.send(p);assert.equal(h.row(p.submission_id).status,'review');assert.equal(writes(h,'/tasks').length,0);
 const h2=await harness(t,{}, {newContactOwnerId:null}),q=fixture();await h2.send(q);assert.equal(h2.row(q.submission_id).status,'review');assert.equal(writes(h2,'/contacts').length,0);
});
test('strict versions, enums, arrays, lengths and phone normalization; financial missing is unknown',()=>{
 for(const change of [p=>p.schema_version='old',p=>p.form_id='other',p=>p.answers.income_band='3000-6000',p=>p.answers.investment_goals=['unknown'],p=>p.answers.investment_goals=Array(7).fill('Cashflow'),p=>p.answers.experience_raw='unknown',p=>p.contact.first_name='x'.repeat(81),p=>p.contact.email='wrong',p=>p.contact.phone='01701234567',p=>p.contact_permission.granted=false,p=>p.contact_permission.text_version='client-approved-v1',p=>delete p.contact.last_name]){const p=fixture();change(p);assert.ok(validateInquiry(p).errors.length);}
 const p=fixture(),v=validateInquiry(p);assert.deepEqual(v.errors,[]);assert.ok(!('existing_property_count' in v.payload.answers));assert.ok(!('available_equity_eur' in v.payload.answers));assert.equal(normalizePhone('0049 170-1234567'),'+491701234567');assert.equal(normalizePhone('++49123'),null);assert.equal(fieldValue({value:'original',pretty_value:'Original'}),'original');
 for(const income of Object.keys(incomeIds)){p.answers.income_band=income;assert.equal(newContact(validateInquiry(p).payload,443333).client.partial_custom_fields.nettohaushaltseinkommen,incomeIds[income]);}assert.equal(Object.keys(goalIds).length,6);
});
test('ignores browser privilege claims and escapes all user HTML in inquiry',async t=>{
 const h=await harness(t),p=fixture();Object.assign(p,{broker_id:1,dry_run:true,approved:true,already_deduplicated:true,submitted_at:'fake'});p.contact.broker_id=1;p.answers.preferred_region='<img src=x onerror=alert(1)>';p.answers.score=999;p.attribution.utm_campaign='<script>bad</script>';await h.send(p);const task=writes(h,'/tasks')[0].body.task;assert.equal(task.broker_id,443333);assert.ok(!task.body.includes('<img'));assert.ok(task.body.includes('&lt;img'));assert.ok(!task.body.includes('<script>'));assert.ok(!task.body.includes('score'));assert.ok(!task.body.includes('fake'));
});
test('bot verification fails closed, hostname checked, throttle enforced before vendor calls',async t=>{
 const h=await harness(t,{botFail:true});for(let i=0;i<10;i++)assert.equal((await h.send(fixture())).status,422);const response=await h.send(fixture());assert.equal(response.status,429);assert.ok(response.headers.get('retry-after'));assert.equal(writes(h,'/contacts').length,0);
 const h2=await harness(t,{botHostname:'evil.example'});assert.equal((await h2.send(fixture())).status,422);
});
test('unknown version, oversized input, wrong origin and missing configuration rejected without writes',async t=>{
 const h=await harness(t);const p=fixture();p.answers.income_band='wrong';assert.equal((await h.send(p)).status,422);assert.equal((await h.send(fixture(),{origin:'https://evil.example'})).status,403);const huge=fixture();huge.extra='x'.repeat(20000);assert.equal((await h.send(huge)).status,413);
 const h2=await harness(t,{}, {apiKey:''});assert.equal((await h2.send(fixture())).status,503);assert.equal(h2.crm.calls.length,0);
 const h3=await harness(t,{}, {consentApproved:false});assert.equal((await h3.send(fixture())).status,503);
});
test('vendor outage retains durable pending receipt and hides vendor responses/secrets',async t=>{
 const h=await harness(t,{outage:true}),p=fixture();const response=await h.send(p);assert.equal(response.status,202);const text=await response.text();assert.ok(!text.includes('secret'));assert.ok(!text.includes(p.contact.email));assert.equal(h.row(p.submission_id).status,'pending');h.crm.options.outage=false;await h.process(p.submission_id);assert.equal((await h.status(p.submission_id)).status,200);
});
