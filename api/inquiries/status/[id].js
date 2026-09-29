import express from 'express';
import {handleVercelRequest} from '../../../server/vercel-runtime.mjs';
import {isUuid} from '../../../shared/inquiry-schema.mjs';

const app=express();app.disable('x-powered-by');
app.use((req,res,next)=>{
  const id=req.query?.id??new URL(req.url,'https://localhost').pathname.split('/').pop();
  return handleVercelRequest(req,res,'/api/inquiries/status/'+(isUuid(id)?id:'invalid')).catch(next);
});
export default app;
