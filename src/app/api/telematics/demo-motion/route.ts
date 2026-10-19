import {z} from 'zod';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {localDemoMotionConfiguration,authenticateDemoMotion,executeDemoMotion,DEMO_MOTION_BODY_LIMIT} from '@/lib/demo-motion-auth.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const known=new Set(['DEMO_TARGET_DENIED','DEMO_MANUAL_SOURCE_STATIC','DEMO_TARGET_NOT_CONFIGURED','DEMO_DURATION_INVALID',
 'DEMO_RUNNER_ALREADY_ACTIVE','DEMO_REAL_DEVICE_TAKEOVER','DEMO_REAL_DEVICE_IN_USE','DEMO_REPORT_DENIED','DEMO_REQUEST_DENIED']);
async function bodyText(request:Request){
 if(!request.body||Number(request.headers.get('content-length')||0)>DEMO_MOTION_BODY_LIMIT)throw Error('DEMO_REQUEST_DENIED');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;
  if(length>DEMO_MOTION_BODY_LIMIT){await reader.cancel();throw Error('DEMO_REQUEST_DENIED');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
export async function POST(request:Request){
 try{
  const config=localDemoMotionConfiguration(process.env,request.url),body=await bodyText(request);
  const authority=authenticateDemoMotion(request.headers,body,config),input:unknown=JSON.parse(body),client=createSupabaseAdminClient();
  const rpc=async(name:string,args:Record<string,unknown>)=>{const {data,error}=await client.rpc(name,args);if(error)throw Error(known.has(error.message)?error.message:'DEMO_UNAVAILABLE');return data;};
  await rpc('authorize_demo_motion_request',{request_nonce:authority.nonce});
  return Response.json({ok:true,data:await executeDemoMotion(input,rpc)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  const code=error instanceof Error&&known.has(error.message)?error.message:error instanceof z.ZodError||error instanceof SyntaxError?'DEMO_REQUEST_DENIED':'DEMO_UNAVAILABLE';
  return Response.json({ok:false,code},{status:code==='DEMO_UNAVAILABLE'?503:code==='DEMO_REQUEST_DENIED'?403:409,headers:{'Cache-Control':'private, no-store'}});
 }
}
