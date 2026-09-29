import {CRM} from '../automation/website-mapping.mjs';
export class ReviewRequired extends Error {}
export class VendorUnavailable extends Error {}
// A stopped worker must not turn a failed lease/budget check into a vendor retry.
export class ProcessingDeferred extends Error {}
const integer=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
export const recordId=record=>integer(record?.id)?Number(record.id):null;
export const emailsOf=contact=>[contact?.email,...(Array.isArray(contact?.emails)?contact.emails:[])].filter(x=>typeof x==='string').map(x=>x.trim().toLowerCase());
export function eligibleContact(contact,email) {
  if(!recordId(contact)||!emailsOf(contact).includes(email))throw new ReviewRequired('contact_mismatch');
  // Unknown permission is not permission; never reactivate or overwrite a withdrawal.
  if(contact.archived!==false||contact.locked!==false||contact.deleted_at||contact.cp_delete_request_date||Number(contact.gdpr_status)===3||contact.accept_contact!==true)throw new ReviewRequired('contact_restricted');
  const owner=Number(contact.broker_id);
  if(!CRM.ceoIds.includes(owner))throw new ReviewRequired('owner_review');
  return owner;
}
export function taskMatches(task,activity,{id,contact_id,owner_id}) {
  const clients=task?.client_ids??activity?.client_ids;
  const marker=typeof task?.body==='string'?task.body.match(/^\s*<p>INV-SUBMISSION:([0-9a-f-]{36})<\/p>(?:\s|<|$)/i)?.[1]:null;
  return marker===id&&Number(task.note_type_id??activity?.category_id)===CRM.inquiryCategory&&Number(task.client_source_id??activity?.source_id)===CRM.source&&Number(task.broker_id??activity?.broker_id)===owner_id&&Array.isArray(clients)&&clients.length===1&&Number(clients[0])===contact_id;
}
export function createPropstack({apiKey,fetchImpl=fetch,timeoutMs=10000}) {
  async function request(route,{method='GET',body,before=()=>{}}={}) {
    // The persisted lease renewal and write intent must finish before any fetch.
    // Keep this outside the vendor catch so stale claims stop processing directly.
    const remainingMs=await before();
    if(typeof remainingMs==='number'&&remainingMs<=0)throw new ProcessingDeferred('budget_exhausted');
    const requestTimeout=Math.max(1,Math.floor(typeof remainingMs==='number'?Math.min(timeoutMs,remainingMs):timeoutMs));
    const budgetLimited=typeof remainingMs==='number'&&remainingMs<=timeoutMs;
    const signal=AbortSignal.timeout(requestTimeout);
    try {
      const response=await fetchImpl(`https://api.propstack.de/v1${route}`,{method,headers:{'X-API-KEY':apiKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal});
      if(!response.ok)throw new VendorUnavailable('vendor_unavailable');
      return await response.json();
    }catch{
      if(budgetLimited&&signal.aborted)throw new ProcessingDeferred('budget_exhausted');
      throw new VendorUnavailable('vendor_unavailable');
    }
  }
  async function list(route,params,before) {
    const items=[];
    for(let page=1;page<=10;page++){
      const data=await request(`${route}?${new URLSearchParams({...params,page:String(page),per:'100'})}`,{before});
      const batch=Array.isArray(data)?data:data?.data;
      if(!Array.isArray(batch))throw new VendorUnavailable('invalid_list');
      items.push(...batch);
      const total=data?.meta?.total_count;
      if((Number.isSafeInteger(total)&&items.length>=total)||(total===undefined&&batch.length<100))return items;
      if(!batch.length)throw new ReviewRequired('incomplete_search');
    }
    throw new ReviewRequired('search_limit');
  }
  async function findContact(email,before) {
    const results=await list('/contacts',{email,archived:'-1',include_children:'true',with_meta:'true',expand:'true'},before);
    const exact=results.filter(c=>emailsOf(c).includes(email));
    const unique=new Map(exact.map(c=>[recordId(c),c]));
    if(unique.size>1||unique.has(null))throw new ReviewRequired('ambiguous_contact');
    // A returned record whose email is unavailable cannot justify creating a contact.
    if(results.some(c=>emailsOf(c).length===0))throw new ReviewRequired('incomplete_contact_search');
    if(!unique.size)return null;
    return request(`/contacts/${recordId(exact[0])}`,{before});
  }
  async function findInquiry(row,before) {
    const activities=await list('/activities',{client_id:String(row.contact_id),category_id:String(CRM.inquiryCategory),source_id:String(CRM.source),expand:'true',order:'desc'},before);
    const matches=new Map();
    for(const item of activities){
      if(!recordId(item))throw new ReviewRequired('invalid_activity');
      const detail=await request(`/activities/${recordId(item)}`,{before});
      if(detail?.activatable_type!=='Task')continue;
      const task=detail?.activatable;
      if(taskMatches(task,detail,row)){
        if(!recordId(task))throw new ReviewRequired('inquiry_id_missing');
        matches.set(recordId(task),task);
      }
    }
    if(matches.size>1)throw new ReviewRequired('duplicate_marker');
    return matches.size?[...matches.keys()][0]:null;
  }
  return {request,findContact,findInquiry};
}
