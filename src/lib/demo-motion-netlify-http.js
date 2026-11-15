import {z} from 'zod';
import {NETLIFY_MOTION_PATH,NETLIFY_MOTION_TARGETS,netlifyMotionConfiguration,authenticateNetlifyMotion,readNetlifyMotionBody} from './demo-motion-netlify.mjs';
import {demoMotionScenarioFix} from './demo-motion-scenario.mjs';
import {demoOperatingHoursOpen} from './demo-operating-hours.mjs';

const inputSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('CLAIM'),runId:z.string().uuid()}).strict(),
 z.object({action:z.enum(['PREPARE','REPORT']),runId:z.string().uuid(),target:z.enum(NETLIFY_MOTION_TARGETS)}).strict()
]);
const known=new Set(['DEMO_HOSTED_DISABLED','DEMO_TARGET_DENIED','DEMO_NETLIFY_AUTH_DENIED','DEMO_NETLIFY_WINDOW_DENIED',
 'DEMO_HOSTED_INPUT_DENIED','DEMO_REAL_DEVICE_TAKEOVER','DEMO_REPORT_DENIED','DEMO_MANUAL_SOURCE_STATIC',
 'DEMO_RUNNER_ALREADY_ACTIVE','DEMO_MOTION_SCENARIO_UNAVAILABLE','DEMO_MOTION_REPORT_DENIED']);

/** @param {Request} request
 * @param {{environment?: NodeJS.ProcessEnv, clientFactory: () => ReturnType<import('./supabase-adapter.js').createSupabaseAdminClient>, now?: number}} options
 */
export async function handleNetlifyDemoMotion(request,{environment=process.env,clientFactory,now=Date.now()}){
 try{
  if(request.method!=='POST')throw Error('DEMO_NETLIFY_AUTH_DENIED');
  const config=netlifyMotionConfiguration(environment,request.url,NETLIFY_MOTION_PATH);
  if(!config||!demoOperatingHoursOpen(now))throw Error('DEMO_HOSTED_DISABLED');
  const body=await readNetlifyMotionBody(request);
  const {nonce}=authenticateNetlifyMotion(request.headers,body,config,NETLIFY_MOTION_PATH,now);
  const input=inputSchema.parse(JSON.parse(body));
  const fix=input.target?demoMotionScenarioFix(input.target,now):null;
  const command=input.action==='REPORT'?{action:'REPORT',latitude:fix.latitude,longitude:fix.longitude,speedKph:fix.speedKph,course:fix.course,capturedAt:new Date(now).toISOString()}:{action:input.action};
  const {data,error}=await clientFactory().rpc('netlify_demo_motion_command',{
   request_nonce:nonce,run_id:input.runId,target_name:input.target||null,command
  });
  if(error)throw Error(known.has(error.message)?error.message:'DEMO_NETLIFY_UNAVAILABLE');
  return Response.json({ok:true,data},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  const code=error instanceof z.ZodError||error instanceof SyntaxError?'DEMO_HOSTED_INPUT_DENIED'
   :known.has(error?.message)?error.message:'DEMO_NETLIFY_UNAVAILABLE';
  return Response.json({ok:false,code},{status:code==='DEMO_NETLIFY_UNAVAILABLE'||code==='DEMO_HOSTED_DISABLED'?503:
   ['DEMO_NETLIFY_AUTH_DENIED','DEMO_HOSTED_INPUT_DENIED'].includes(code)?403:409,headers:{'Cache-Control':'private, no-store'}});
 }
}
