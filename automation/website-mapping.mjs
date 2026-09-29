// Account-specific values supplied in integration/CONTRACT-v1.md.
// This adapter is server-only. It never updates an existing contact.
export const CRM = Object.freeze({source:364441,status:348539,inquiryCategory:734823,phase:355771,ceoIds:Object.freeze([443333,443427]),sharedOwnerId:443334,allowedOwnerIds:Object.freeze([443333,443427,443334])});
export const incomeIds=Object.freeze({'Unter 3.000 €':320198,'3.000–5.000 €':320199,'5.001–8.000 €':320200,'8.001–12.000 €':320201,'Über 12.000 €':320202});
export const goalIds=Object.freeze({'Altersvorsorge':320180,'Cashflow':320181,'Diversifikation':320184,'Kapitalerhalt':320183,'Steueroptimierung':320182,'Vermögensaufbau':320179});
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fieldValue=value=>value&&typeof value==='object'&&'value' in value?value.value:value;
export function newContact(payload,ownerId) {
  if(!CRM.allowedOwnerIds.includes(ownerId))throw Error('New-contact owner must be configured server-side.');
  const income=incomeIds[payload.answers.income_band],goals=payload.answers.investment_goals.map(x=>goalIds[x]);
  if(!income||!goals.length||goals.some(x=>!x))throw Error('Unmapped answer.');
  const custom={lead_phase_aktuell:CRM.phase,nettohaushaltseinkommen:income,investmentziel:goals.join(',')};
  for(const [source,target] of [['utm_source','utm_quelle'],['utm_medium','utm_medium'],['utm_campaign','utm_kampagne']])if(payload.attribution[source])custom[target]=payload.attribution[source];
  return {client:{first_name:payload.contact.first_name,last_name:payload.contact.last_name,email:payload.contact.email,home_cell:payload.contact.phone,broker_id:ownerId,client_source_id:CRM.source,client_status_id:CRM.status,accept_contact:true,partial_custom_fields:custom}};
}
export function inquiryTask(payload,{contactId,ownerId,receivedAt,permissionText,newsletterText,landingUrl}) {
  if(!CRM.allowedOwnerIds.includes(ownerId)||!Number.isSafeInteger(contactId)||contactId<1)throw Error('Unresolved inquiry owner/contact.');
  const line=(label,value)=>`<p>${escapeHtml(label)}: ${escapeHtml(value)}</p>`;
  const body=`<p>INV-SUBMISSION:${payload.submission_id}</p>`+line('Form',payload.form_id)+line('Received',receivedAt)+line('Language',payload.language)+line('Purpose','Immobilienberatung / Bearbeitung der Website-Anfrage')+line('Consultation permission',true)+line('Permission version',payload.contact_permission.text_version)+line('Permission text',permissionText)+line('Newsletter preference (separate, no CRM subscription change)',payload.newsletter_preference)+line('Newsletter text',newsletterText)+line('Landing page',landingUrl)+line('Contact time zone','Europe/Berlin')+Object.entries(payload.contact).map(([key,v])=>line(key,v)).join('')+Object.entries(payload.answers).map(([key,v])=>line(key,Array.isArray(v)?v.join(', '):v)).join('')+Object.entries(payload.attribution).map(([key,v])=>line(key,v)).join('');
  return {task:{note_type_id:CRM.inquiryCategory,title:'INV Website-Anfrage | Strategie-Check',broker_id:ownerId,client_ids:[contactId],client_source_id:CRM.source,body}};
}
