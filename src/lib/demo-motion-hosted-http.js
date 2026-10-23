import {z} from 'zod';
import {DEMO_MOTION_BODY_LIMIT,DEMO_MOTION_TARGETS,demoMotionCommand} from './demo-motion-auth.js';
import {authenticateHostedDemoMotion,hostedDemoMotionConfiguration} from './demo-motion-hosted-auth.js';

const allowedCodes=new Set(['DEMO_HOSTED_DISABLED','DEMO_HOSTED_AUTH_DENIED','DEMO_HOSTED_INPUT_DENIED',
 'DEMO_REQUEST_DENIED',
 'DEMO_TARGET_DENIED','DEMO_TARGET_NOT_CONFIGURED','DEMO_REAL_DEVICE_TAKEOVER',
 'DEMO_REAL_DEVICE_IN_USE','DEMO_RUNNER_ALREADY_ACTIVE','DEMO_REPORT_DENIED']);

async function readBody(request){
 if(!request.body||Number(request.headers.get('content-length')||0)>DEMO_MOTION_BODY_LIMIT)
  throw Error('DEMO_HOSTED_INPUT_DENIED');
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>DEMO_MOTION_BODY_LIMIT){await reader.cancel();throw Error('DEMO_HOSTED_INPUT_DENIED');}
  chunks.push(part.value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}

/** All commands execute inside one database RPC with nonce and kill checks. */
/** @param {Request} request
 * @param {{environment?: NodeJS.ProcessEnv, clientFactory: () => ReturnType<import('./supabase-adapter.js').createSupabaseAdminClient>, now?: number}} options
 */
export async function handleHostedDemoMotion(request,{environment=process.env,clientFactory,now=Date.now()}){
 try{
  if(request.method!=='POST')throw Error('DEMO_HOSTED_AUTH_DENIED');
  const config=hostedDemoMotionConfiguration(environment,request.url);
  const body=await readBody(request);
  const {nonce}=authenticateHostedDemoMotion(request.headers,body,config,now);
  const input=demoMotionCommand.parse(JSON.parse(body));
  if(input.action==='RESUME')throw Error('DEMO_HOSTED_INPUT_DENIED');
  const client=clientFactory();
  const {data,error}=await client.rpc('hosted_demo_motion_command',{
   request_nonce:nonce,target_vehicle_id:DEMO_MOTION_TARGETS[input.target],payload:input
  });
  if(error)throw Error(allowedCodes.has(error.message)?error.message:'DEMO_HOSTED_UNAVAILABLE');
  return Response.json({ok:true,data},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  const code=error instanceof Error&&allowedCodes.has(error.message)?error.message
   :error instanceof z.ZodError||error instanceof SyntaxError?'DEMO_HOSTED_INPUT_DENIED':'DEMO_HOSTED_UNAVAILABLE';
  return Response.json({ok:false,code},{status:code==='DEMO_HOSTED_UNAVAILABLE'?503:
   code==='DEMO_HOSTED_DISABLED'?503:code==='DEMO_HOSTED_AUTH_DENIED'||code==='DEMO_HOSTED_INPUT_DENIED'?403:409,
   headers:{'Cache-Control':'private, no-store'}});
 }
}
