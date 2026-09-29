import {newContact,inquiryTask,CRM} from '../automation/website-mapping.mjs';
import {createPropstack,eligibleContact,recordId,taskMatches,ReviewRequired,ProcessingDeferred} from './propstack.mjs';

const budget=(value,fallback)=>Number.isFinite(value)&&value>=0?value:fallback;

export function createInquiryService({store,apiKey,newContactOwnerId,fetchImpl,timeoutMs}) {
  const vendor=createPropstack({apiKey,fetchImpl,timeoutMs});

  // Local callers retain a generous default. Serverless routes pass their shorter
  // budget explicitly, leaving time for persisting state and returning a receipt.
  async function process(id,{budgetMs=60000}={}) {
    const deadline=Date.now()+budget(budgetMs,60000);
    if(Date.now()>=deadline)return await store.get(id);
    const token=await store.claim(id);if(!token)return await store.get(id);
    const remaining=()=>{
      const ms=deadline-Date.now();
      if(ms<=0)throw new ProcessingDeferred('budget_exhausted');
      return ms;
    };
    const owned=async()=>{
      const row=await store.get(id);
      if(!row||row.lease_token!==token||row.lease_until<=Date.now())throw new ProcessingDeferred('lease_lost');
      return row;
    };
    const before=async()=>{
      remaining();
      await owned();
      try {await store.touch(id,token);}catch(error){
        // A changed token/expired lease stops the worker, including if it happens
        // while the asynchronous renewal is in flight. Other storage errors bubble.
        await owned();throw error;
      }
      await owned();
      return remaining();
    };
    const set=async values=>{
      await owned();
      await store.update(id,token,values);
    };
    const unlock=async()=>{await owned();await store.unlockEmail(id);};
    try {
      let row=await owned();const payload=JSON.parse(row.payload_json);
      if(!row.contact_id){
        remaining();
        if(!await store.emailLock(row)){await set({next_attempt:Date.now()+15000});return await store.get(id);}
        let contact=await vendor.findContact(payload.contact.email,before);
        if(!contact){
          if(row.phase==='contact_create_started') {
            await set({next_attempt:Date.now()+30000});
            if(row.attempts>=3)throw new ReviewRequired('contact_creation_uncertain');
            return await store.get(id);
          }
          if(!CRM.allowedOwnerIds.includes(newContactOwnerId))throw new ReviewRequired('new_owner_not_configured');
          // A crash/timeout after this durable checkpoint can only reconcile;
          // another worker must never repeat the possibly successful POST.
          remaining();await set({phase:'contact_create_started'});
          const created=await vendor.request('/contacts',{method:'POST',body:newContact(payload,newContactOwnerId),before});
          const contactId=recordId(created);if(!contactId)throw Error('Contact create response uncertain.');
          await set({contact_id:contactId,phase:'contact_resolved'});
          contact=await vendor.request(`/contacts/${contactId}`,{before});
        }
        const owner=eligibleContact(contact,payload.contact.email);
        await set({contact_id:recordId(contact),owner_id:owner,phase:'contact_resolved'});
        await unlock();
      }
      row=await owned();
      // Re-read restrictions/owner before every inquiry write or reconciliation.
      const fresh=await vendor.request(`/contacts/${row.contact_id}`,{before});
      const owner=eligibleContact(fresh,payload.contact.email);
      if(row.owner_id && row.owner_id!==owner && row.phase==='inquiry_create_started')throw new ReviewRequired('owner_changed_during_write');
      await set({owner_id:owner});await unlock();row=await owned();
      if(row.inquiry_id){
        const task=await vendor.request(`/tasks/${row.inquiry_id}`,{before});
        if(!taskMatches(task,null,row))throw new ReviewRequired('inquiry_readback_mismatch');
        await set({status:'accepted',phase:'inquiry_stored',review_reason:null});return await store.get(id);
      }
      if(row.phase==='inquiry_create_started'){
        const found=await vendor.findInquiry(row,before);
        if(found){await set({inquiry_id:found,status:'accepted',phase:'inquiry_stored',review_reason:null});return await store.get(id);}
        if(row.attempts>=3)throw new ReviewRequired('inquiry_creation_uncertain');
        await set({next_attempt:Date.now()+30000});return await store.get(id);
      }
      const evidence=JSON.parse(row.evidence_json);
      const body=inquiryTask(payload,{contactId:row.contact_id,ownerId:owner,receivedAt:row.received_at,...evidence});
      remaining();await set({phase:'inquiry_create_started'});
      const created=await vendor.request('/tasks',{method:'POST',body,before});
      const inquiryId=recordId(created);if(!inquiryId)throw Error('Inquiry create response uncertain.');
      await set({inquiry_id:inquiryId});
      const task=await vendor.request(`/tasks/${inquiryId}`,{before});
      if(!taskMatches(task,null,await owned()))throw new ReviewRequired('inquiry_readback_mismatch');
      await set({status:'accepted',phase:'inquiry_stored',review_reason:null});
    }catch(error){
      try {
        const row=await owned();
        if(error instanceof ProcessingDeferred&&error.message==='lease_lost')return await store.get(id);
        const exhausted=Date.now()>=deadline||(error instanceof ProcessingDeferred&&error.message==='budget_exhausted');
        if(error instanceof ReviewRequired){
          await set({status:'review',review_reason:error.message});
          // Keep the email lock only if an uncertain contact creation could appear.
          if(row.contact_id||row.phase!=='contact_create_started')await unlock();
        }else if(exhausted&&row.phase==='inquiry_create_started'&&row.attempts>=3){
          // A large activity history may exceed every worker budget before its
          // exact marker is reached. Stop automatic restarts after the same
          // bounded attempt limit as other uncertain writes; never re-POST.
          await set({status:'review',review_reason:'inquiry_reconciliation_timeout'});
        }else {
          await set({next_attempt:Date.now()+30000,review_reason:exhausted?'processing_deferred':'vendor_unavailable'});
        }
      }catch(stateError){
        if(!(stateError instanceof ProcessingDeferred&&stateError.message==='lease_lost'))throw stateError;
      }
    }finally{await store.release(id,token);}
    return await store.get(id);
  }

  let working=false;
  async function resumePending({budgetMs=18000,maxItems=10}={}){
    if(working||!apiKey)return;
    const deadline=Date.now()+budget(budgetMs,18000);
    const limit=Number.isSafeInteger(maxItems)&&maxItems>=0?maxItems:10;
    if(!limit||Date.now()>=deadline)return;
    working=true;
    try {
      const rows=await store.pending();
      for(const row of rows.slice(0,limit)){
        const ms=deadline-Date.now();if(ms<=0)break;
        await process(row.id,{budgetMs:ms});
      }
    }finally{working=false;}
  }
  return {process,resumePending};
}
