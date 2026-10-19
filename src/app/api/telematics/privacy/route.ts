import {z} from 'zod';
import {authenticatePrivacyGateway,loadPrivacyConfigurations,PRIVACY_BODY_LIMIT} from '@/lib/telematics-privacy-auth.js';
import {authorizePrivacyGatewayRequest,claimGatewayPrivacyJobs,completeGatewayPrivacyJob} from '@/lib/telematics-privacy.js';
export const runtime='nodejs';
const envelope=z.discriminatedUnion('action',[
 z.object({action:z.literal('CLAIM')}).strict(),
 z.object({action:z.literal('COMPLETE'),command:z.object({jobId:z.string().uuid(),leaseId:z.string().uuid(),
  bindingDigest:z.string().regex(/^[a-f0-9]{64}$/),verified:z.literal(true)}).strict()}).strict()
]);
async function boundedBody(request:Request){
 if(Number(request.headers.get('content-length')||0)>PRIVACY_BODY_LIMIT||!request.body)throw new Error('INVALID_TELEMATICS_PRIVACY_INPUT');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>PRIVACY_BODY_LIMIT){await reader.cancel();throw new Error('INVALID_TELEMATICS_PRIVACY_INPUT');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 let body:string;try{body=await boundedBody(request);}catch{return respond({error:'INVALID_TELEMATICS_PRIVACY_INPUT'},400);}
 let auth;try{auth=authenticatePrivacyGateway(request.headers,body,loadPrivacyConfigurations());await authorizePrivacyGatewayRequest(auth);}
 catch{return respond({error:'PRIVACY_GATEWAY_UNAVAILABLE'},401);}
 let command;try{command=envelope.parse(JSON.parse(body));}catch{return respond({error:'INVALID_TELEMATICS_PRIVACY_INPUT'},400);}
 try{return respond(command.action==='CLAIM'?{jobs:await claimGatewayPrivacyJobs(auth.digest)}
  :await completeGatewayPrivacyJob(auth.digest,command.command));}
 catch{return respond({error:'PRIVACY_JOB_CHANGED'},409);}
}
