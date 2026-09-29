// Private operator reconciliation. Never mark a receipt accepted without a CRM read.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPostgresStore} from './postgres-inquiry-store.mjs';
import {createInquiryService} from './inquiry-service.mjs';
import {isUuid} from '../shared/inquiry-schema.mjs';

class OperatorError extends Error {}
const validId=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
const openLocalStore=async filename=>{
  const {createStore}=await import('./inquiry-store.mjs');
  return createStore(filename);
};

/** Private CLI entry point; injectable store factories also exercise both backends. */
export async function runReconciliation(id,{
  env=process.env,openPostgres=createPostgresStore,openSqlite=openLocalStore,fetchImpl,budgetMs=60000,
}={}) {
  if(!isUuid(id)||!env.PROPSTACK_API_KEY)throw new OperatorError('Usage: node server/reconcile.mjs <submission-id>; configure the private Propstack key first.');
  const connectionString=env.DATABASE_URL||env.POSTGRES_URL;
  const store=connectionString
    ?await openPostgres({connectionString})
    :await openSqlite(path.resolve(env.LEAD_DB_PATH||'.data/submissions.sqlite'));
  try {
    const row=await store.get(id);
    if(!row)throw new OperatorError('Unknown submission.');
    if(row.phase!=='inquiry_create_started'||row.status==='accepted')throw new OperatorError('This CLI only reconciles an uncertain inquiry write. Contact-resolution incidents require operator review.');
    // Missing resolved IDs must not send this recovery workflow back through
    // contact creation or clear the already-persisted inquiry write intent.
    if(!validId(row.contact_id)||!validId(row.owner_id))throw new OperatorError('The uncertain inquiry is missing resolved contact data and requires operator review.');
    if(!await store.reopenForReconciliation(id))throw new OperatorError('The submission is currently claimed or no longer eligible for reconciliation.');
    const service=createInquiryService({store,apiKey:env.PROPSTACK_API_KEY,newContactOwnerId:null,fetchImpl});
    const result=await service.process(id,{budgetMs});
    return {submission_id:id,status:result.status};
  }finally{await store.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try {
    await import('dotenv/config');
    console.log(JSON.stringify(await runReconciliation(process.argv[2])));
  }catch(error){
    // Database/provider error objects can include connection strings or secrets.
    console.error(error instanceof OperatorError?error.message:'Inquiry reconciliation failed. Check private server configuration and storage access.');
    process.exitCode=1;
  }
}
