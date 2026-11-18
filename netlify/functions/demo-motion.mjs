import {randomUUID} from 'node:crypto';
import {demoOperatingHoursOpen} from '../../src/lib/demo-operating-hours.mjs';
import {NETLIFY_MOTION_SCHEDULE,NETLIFY_MOTION_BACKGROUND,netlifyMotionConfiguration,signedNetlifyMotion} from '../../src/lib/demo-motion-netlify.mjs';
const knownFailures=new Set(['DEMO_HOSTED_DISABLED','DEMO_NETLIFY_AUTH_DENIED','DEMO_NETLIFY_DISPATCH_FAILED']);

export async function dispatchNetlifyMotion(request,{environment=process.env,fetchImpl=fetch,now=Date.now,onPhase=()=>{}}={}){
 onPhase('CONFIGURATION');
 const config=netlifyMotionConfiguration(environment,request.url,NETLIFY_MOTION_SCHEDULE);
 if(!config||!demoOperatingHoursOpen(now()))return {enabled:false};
 const body=JSON.stringify({runId:randomUUID()});
 onPhase('SIGNATURE');
 const headers=signedNetlifyMotion(config,NETLIFY_MOTION_BACKGROUND,body,now());
 onPhase('REQUEST');
 const response=await fetchImpl(config.origin+NETLIFY_MOTION_BACKGROUND,{method:'POST',body,
  headers,redirect:'error',credentials:'omit',
  signal:AbortSignal.timeout(10_000)});
 if(response.status!==202)throw Object.assign(Error('DEMO_NETLIFY_DISPATCH_FAILED'),{httpStatus:response.status});
 return {enabled:true};
}
export async function executeScheduledNetlifyMotion(_request,{environment=process.env,fetchImpl=fetch,now=Date.now}={}){
 let phase='CONFIGURATION';
 try{
  if(environment.LOADGISTIC_DEMO_MOTION_NETLIFY_ENABLED!=='true'
   ||environment.LOADGISTIC_DEMO_MOTION_NETLIFY_KILL_SWITCH!=='false'
   ||environment.LOADGISTIC_HOSTED_MOTION_WORKER_ENABLED==='true')return new Response(null,{status:204});
  // Scheduled Functions have no public invocation URL. Dispatch is pinned to
  // the configured origin; strict HTTP/background receiver checks stay intact.
  let invocationUrl;
  try{invocationUrl=new URL(NETLIFY_MOTION_SCHEDULE,environment.LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN).href;}
  catch{throw Error('DEMO_HOSTED_DISABLED');}
  await dispatchNetlifyMotion({url:invocationUrl},{environment,fetchImpl,now,onPhase:value=>{phase=value;}});
  return new Response(null,{status:204});
 }catch(error){
  const failure=knownFailures.has(error?.message)?error.message:phase==='REQUEST'&&error?.name==='TimeoutError'?'REQUEST_TIMEOUT'
   :phase==='REQUEST'&&error?.name==='AbortError'?'REQUEST_ABORTED':'UNCLASSIFIED';
  const httpStatus=failure==='DEMO_NETLIFY_DISPATCH_FAILED'&&Number.isSafeInteger(error.httpStatus)
   &&error.httpStatus>=100&&error.httpStatus<=599?error.httpStatus:null;
  console.error(JSON.stringify({event:'demo-motion-dispatch',ok:false,code:'DISPATCH_FAILED',phase,failure,httpStatus}));
  return new Response(null,{status:500});
 }
}
export default async function(request){return executeScheduledNetlifyMotion(request);}
// UTC 06:00–07:59 = daily 09:00–10:59 Addis Ababa; runtime also checks hours.
export const config={schedule:'* 6-7 * * *'};
