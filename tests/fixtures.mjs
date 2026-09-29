import {randomUUID} from 'node:crypto';
import {FORM_ID,SCHEMA_VERSION,CONSENT_VERSION} from '../shared/lead-schema.mjs';
export function fixture(){return {schema_version:SCHEMA_VERSION,submission_id:randomUUID(),form_id:FORM_ID,language:'en',contact:{first_name:'Alex',last_name:'Example',email:'alex@example.com',phone:'+49 170 1234567'},answers:{income_band:'3.000–5.000 €',investment_goals:['Vermögensaufbau','Altersvorsorge'],experience_raw:'Einsteiger',preferred_region:'Berlin'},contact_permission:{granted:true,text_version:CONSENT_VERSION},newsletter_preference:false,attribution:{utm_source:'google',utm_medium:'cpc',utm_campaign:'strategy'},bot_token:'test-token'};}
export function contact(overrides={}){return {id:123,email:'alex@example.com',emails:['alex@example.com'],first_name:'Advisor reviewed',broker_id:443427,archived:false,locked:false,deleted_at:null,accept_contact:true,gdpr_status:2,client_source_id:999,client_status_id:888,custom_fields:{utm_quelle:{value:'original',pretty_value:'original'}},...overrides};}
export function fakeCrm(options={}){
  const state={contacts:structuredClone(options.contacts||[]),tasks:[],calls:[],options};
  async function fetchImpl(url,init={}){
    const parsed=new URL(url),method=init.method||'GET',body=init.body?JSON.parse(init.body):null;
    state.calls.push({url,method,body,headers:init.headers});
    await new Promise(r=>setTimeout(r,5));
    if(parsed.hostname==='challenges.cloudflare.com')return Response.json({success:!options.botFail,hostname:options.botHostname||'investo.example',action:'investo-inquiry',cdata:body.idempotency_key});
    if(parsed.hostname!=='api.propstack.de')throw Error('Unexpected outbound destination');
    if(options.outage)throw Error('API secret and vendor details must not be exposed');
    const route=parsed.pathname.replace('/v1','');
    if(route==='/contacts'&&method==='GET')return Response.json(state.contacts);
    if(route==='/contacts'&&method==='POST'){
      const record=contact({...body.client,id:1000+state.contacts.length});state.contacts.push(record);
      if(options.contactTimeout){options.contactTimeout=false;throw Error('timeout after contact accepted');}
      return Response.json({ok:true,id:record.id});
    }
    if(route.startsWith('/contacts/'))return Response.json(state.contacts.find(c=>c.id===Number(route.split('/').at(-1))));
    if(route==='/tasks'&&method==='POST'){
      const record={...body.task,id:2000+state.tasks.length};state.tasks.push(record);
      if(options.taskTimeout){options.taskTimeout=false;throw Error('timeout after inquiry accepted');}
      if(options.taskAbsent){state.tasks.pop();throw Error('write uncertain');}
      return Response.json({id:record.id,activity_id:record.id+10000},{status:201});
    }
    if(route.startsWith('/tasks/')){
      const {client_ids,...task}=state.tasks.find(c=>c.id===Number(route.split('/').at(-1)));
      return Response.json({...task,clients:client_ids.map(id=>({id}))});
    }
    if(route==='/activities')return Response.json({data:state.tasks.filter(t=>t.client_ids.includes(Number(parsed.searchParams.get('client_id')))).map(t=>({id:t.id+10000})),meta:{total_count:state.tasks.length}});
    if(route.startsWith('/activities/')){
      const task=state.tasks.find(c=>c.id+10000===Number(route.split('/').at(-1)));
      const {client_ids,...expanded}=task;
      return Response.json({id:task.id+10000,activatable_type:'Task',activatable:{...expanded,clients:client_ids.map(id=>({id}))},category_id:task.note_type_id,source_id:task.client_source_id,broker_id:task.broker_id});
    }
    throw Error('Unexpected vendor route '+route);
  }
  return {...state,fetchImpl};
}
