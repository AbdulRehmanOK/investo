import express from 'express';
import {handleVercelRequest} from '../server/vercel-runtime.mjs';

// Export the real Express app so Vercel skips its body-parsing helpers. The
// shared API owns JSON parsing, its 16 KiB limit, and the awaited response.
const app=express();app.disable('x-powered-by');
app.use((req,res,next)=>handleVercelRequest(req,res,'/api/inquiries').catch(next));
export default app;
