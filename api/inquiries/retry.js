import express from 'express';
import {handleVercelRequest} from '../../server/vercel-runtime.mjs';

const app=express();app.disable('x-powered-by');
app.use((req,res,next)=>handleVercelRequest(req,res,'/api/inquiries/retry').catch(next));
export default app;
