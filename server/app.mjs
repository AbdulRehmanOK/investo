import express from 'express';
import compression from 'compression';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {FORM_ID,consentText,CONSENT_VERSION} from '../shared/lead-schema.mjs';
import {validateInquiry,isUuid} from '../shared/inquiry-schema.mjs';
import {createStore,hash} from './inquiry-store.mjs';
import {createInquiryService} from './inquiry-service.mjs';

export function createApp({databasePath,store:providedStore,serveStatic=true,integrationReady=true,workerSecret='',processBudgetMs=60000,clientIp=req=>req.ip,apiKey='',newContactOwnerId=null,consentApproved=false,turnstileSecret='',turnstileSiteKey='',siteUrl='http://127.0.0.1:3001',allowedOrigins=[],trustProxy=false,fetchImpl=fetch,timeoutMs=10000,distPath=path.resolve('dist')}) {
  const store=providedStore??createStore(databasePath);
  const service=createInquiryService({store,apiKey,newContactOwnerId,fetchImpl,timeoutMs});
  const origins=new Set([new URL(siteUrl).origin,...allowedOrigins]);
  const hostnames=new Set([...origins].map(origin=>new URL(origin).hostname));
  const configured=!!(integrationReady&&apiKey&&consentApproved&&turnstileSecret&&turnstileSiteKey);
  const app=express();app.disable('x-powered-by');app.set('trust proxy',trustProxy);
  app.use('/api',(req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});next();});
  const asyncRoute=handler=>(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next);
  const throttle=(scope,max)=>asyncRoute(async(req,res,next)=>{const limit=await store.limit(scope+':'+clientIp(req),max);if(!limit.allowed)return res.status(429).set('Retry-After',String(limit.retryAfter)).json({error:'rate_limited'});next();});
  // The public config remains readable when storage or launch settings are unavailable.
  app.get('/api/inquiries/config',asyncRoute(async(_req,res)=>{
    let healthy=false;try{healthy=store.health?await store.health():true;}catch{}
    const available=configured&&healthy;
    res.json({available,turnstile_site_key:available?turnstileSiteKey:null,consent_version:CONSENT_VERSION});
  }));
  // Scheduled requests complete their work before returning; no serverless timer.
  app.get('/api/inquiries/retry',asyncRoute(async(req,res)=>{
    const expected=Buffer.from('Bearer '+workerSecret),actual=Buffer.from(req.get('authorization')||'');
    if(workerSecret.length<32||actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(401).json({error:'unauthorized'});
    if(!configured)return res.status(503).json({error:'integration_unavailable'});
    await service.resumePending({budgetMs:30000,maxItems:10});
    return res.json({ok:true});
  }));
  app.use('/api',throttle('api',120));
  app.use('/api',express.json({limit:'16kb'}));
  const receipt=(res,row,created=false)=>res.status(row.status==='accepted'?(created?201:200):202).json({accepted:row.status==='accepted',status:row.status,submission_id:row.id,received_at:row.received_at,form_id:FORM_ID});
  app.get('/api/inquiries/status/:id',asyncRoute(async(req,res)=>{
    const token=req.get('authorization')?.replace(/^Bearer /,'');
    const row=isUuid(req.params.id)&&isUuid(token)?await store.get(req.params.id):null;
    if(!row||row.token_hash!==hash(token))return res.status(404).json({error:'not_found'});
    return receipt(res,row);
  }));
  app.post('/api/inquiries',throttle('submission',10),asyncRoute(async(req,res)=>{
    if(!origins.has(req.get('origin')))return res.status(403).json({error:'origin_denied'});
    const token=req.get('x-submission-token'),id=req.get('idempotency-key');
    if(!isUuid(token)||!isUuid(id)||req.body?.submission_id!==id)return res.status(400).json({error:'invalid_submission'});
    const {payload,errors}=validateInquiry(req.body);
    if(errors.length)return res.status(422).json({error:'validation_failed',fields:errors});
    const prior=await store.get(id),payloadHash=hash(JSON.stringify(payload));
    if(prior){
      if(prior.token_hash!==hash(token)||prior.payload_hash!==payloadHash)return res.status(409).json({error:'submission_conflict'});
      return receipt(res,prior);
    }
    if(!configured)return res.status(503).set('Retry-After','60').json({error:'integration_unavailable'});
    const botToken=req.body.bot_token;
    if(typeof botToken!=='string'||botToken.length<1||botToken.length>2048)return res.status(422).json({error:'bot_verification_required',fields:['bot_token']});
    try {
      const bot=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:turnstileSecret,response:botToken,remoteip:clientIp(req),idempotency_key:id}),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
      const result=await bot.json();
      if(!bot.ok||result.success!==true||!hostnames.has(result.hostname)||result.action!=='investo-inquiry'||result.cdata!==id)return res.status(422).json({error:'bot_verification_failed',fields:['bot_token']});
    }catch{return res.status(503).set('Retry-After','30').json({error:'verification_unavailable'});}
    let landingUrl=new URL(siteUrl).origin+'/';
    try{const ref=new URL(req.get('referer'));if(origins.has(ref.origin))landingUrl=ref.origin+ref.pathname;}catch{/* Referrer can be disabled. */}
    const evidence={permissionText:consentText.contact[payload.language],newsletterText:consentText.newsletter[payload.language],landingUrl};
    const reservation=await store.reserve(payload,token,evidence);
    if(reservation.row.token_hash!==hash(token)||reservation.row.payload_hash!==payloadHash)return res.status(409).json({error:'submission_conflict'});
    const row=await service.process(id,{budgetMs:processBudgetMs});
    return receipt(res,row,reservation.created);
  }));
  app.all('/api/leads',(_req,res)=>res.status(410).json({error:'form_version_retired'}));
  app.use('/api',(_req,res)=>res.status(404).json({error:'not_found'}));
  app.use((error,_req,res,next)=>{if(res.headersSent)return next(error);res.status(error.type==='entity.too.large'?413:error.type==='entity.parse.failed'?400:503).json({error:'service_unavailable'});});
  if(!serveStatic)return {app,service,store,close:()=>store.close()};
  // Only static text responses reach this middleware; API receipts keep no-store.
  app.use(compression({filter:(req,res)=>/^(?:text\/(?:html|css|javascript)|application\/(?:javascript|x-javascript))(?:;|$)/i.test(String(res.getHeader('Content-Type')||''))&&compression.filter(req,res)}));
  // Legal and receipt pages render their own client tree, never the prerendered homepage.
  app.get(['/danke','/impressum','/datenschutz'],(_req,res)=>{
    const clientShell=path.join(distPath,'client.html');
    res.sendFile(existsSync(clientShell)?clientShell:path.join(distPath,'index.html'));
  });
  // Vite fingerprints these files. Unhashed media and HTML retain revalidation.
  app.use('/assets',express.static(path.join(distPath,'assets'),{maxAge:'1y',immutable:true}));
  app.use('/images/optimized',express.static(path.join(distPath,'images','optimized'),{maxAge:'1y',immutable:true}));
  app.use(express.static(distPath));
  return {app,service,store,close:()=>store.close()};
}
