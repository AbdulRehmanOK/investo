import {isIP} from 'node:net';
import {CRM} from '../automation/website-mapping.mjs';
import {CONSENT_VERSION} from '../shared/lead-schema.mjs';
import {createApp} from './app.mjs';
import {createPostgresStore} from './postgres-inquiry-store.mjs';

// Only Vercel's own ingress may supply the trusted client address.
export function vercelClientIp(req) {
  if(process.env.VERCEL==='1') {
    const raw=req.headers['x-vercel-forwarded-for'];
    if(typeof raw==='string'&&isIP(raw.trim()))return raw.trim();
  }
  return req.socket?.remoteAddress||'unknown';
}
export function runtimeSettings(env=process.env) {
  const siteUrl=env.PUBLIC_SITE_URL||'https://investo-blush.vercel.app';
  const parsed=new URL(siteUrl);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw Error('Set a valid public HTTPS origin.');
  const owner=Number(env.PROPSTACK_NEW_CONTACT_OWNER_ID);
  const allowedOrigins=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  for(const origin of allowedOrigins){const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)throw Error('Set exact HTTPS allowed origins.');}
  const workerSecret=env.CRON_SECRET||'';
  return {siteUrl:parsed.origin,allowedOrigins,apiKey:env.PROPSTACK_API_KEY||'',
    newContactOwnerId:CRM.allowedOwnerIds.includes(owner)?owner:null,
    consentApproved:env.CONTACT_CONSENT_APPROVED==='true',
    turnstileSiteKey:env.TURNSTILE_SITE_KEY||'',turnstileSecret:env.TURNSTILE_SECRET_KEY||'',workerSecret,
    // This setting is enabled only once an authenticated frequent retry schedule is verified.
    integrationReady:CRM.allowedOwnerIds.includes(owner)&&workerSecret.length>=32&&env.INQUIRY_RETRY_SCHEDULE_CONFIRMED==='true',
    processBudgetMs:12000,timeoutMs:6000,serveStatic:false,clientIp:vercelClientIp};
}
const unavailableStore={health:async()=>false,close:async()=>{},limit:async()=>{throw Error('Storage unavailable.');}};
export function createVercelHandler({env=process.env,storeFactory=createPostgresStore,appFactory=createApp}={}) {
  let ready;
  async function instance(){
    if(!ready)ready=(async()=>{
      const settings=runtimeSettings(env);
      const connectionString=env.DATABASE_URL||env.POSTGRES_URL;
      if(!connectionString)return appFactory({...settings,store:unavailableStore,integrationReady:false});
      const store=await storeFactory({connectionString});
      return appFactory({...settings,store});
    })().catch(error=>{ready=undefined;throw error;});
    return ready;
  }
  return async(req,res,route)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const pathname=typeof route==='string'?route:new URL(req.url,'https://localhost').pathname;
    req.url=pathname;
    try {
      const {app}=await instance();
      // Keep the invocation alive until Express has finished its awaited work.
      await new Promise((resolve,reject)=>{
        res.once('finish',resolve);res.once('close',resolve);
        app(req,res,error=>error?reject(error):resolve());
      });
    }catch{
      if(res.headersSent)return;
      res.statusCode=pathname==='/api/inquiries/config'&&req.method==='GET'?200:503;
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(res.statusCode===200?{available:false,turnstile_site_key:null,consent_version:CONSENT_VERSION}:{error:'service_unavailable'}));
    }
  };
}
export const handleVercelRequest=createVercelHandler();
