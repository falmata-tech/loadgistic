import {
  createDemoWorldSignature,demoWorldOrigin,demoWorldWorkerEnabled,
  DEMO_CAPACITY_ADVANCE_PATH,DEMO_WORLD_BATCH_LIMIT,
  DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER
} from '../../src/lib/demo-world-worker-auth.js';
import {demoOperatingHoursOpen} from '../../src/lib/demo-operating-hours.mjs';

const FUNCTION_PATH='/.netlify/functions/demo-capacity';
const RESPONSE_LIMIT_BYTES=8192;
const CAPACITY_LIMIT=2;
const knownFailures=new Set(['DEMO_CAPACITY_ORIGIN_INVALID','DEMO_CAPACITY_SECRET_UNAVAILABLE',
  'DEMO_WORLD_ORIGIN_UNAVAILABLE','DEMO_WORLD_SIGNING_SECRET_UNAVAILABLE','DEMO_WORLD_TARGET_INVALID',
  'DEMO_WORLD_SIGNATURE_INPUT_INVALID','DEMO_CAPACITY_ADVANCE_FAILED','DEMO_CAPACITY_RESPONSE_INVALID']);

function enabled(environment){
  return environment.LOADGISTIC_DEMO_CAPACITY_NETLIFY_ENABLED==='true'
    &&environment.LOADGISTIC_DEMO_CAPACITY_NETLIFY_KILL_SWITCH==='false'
    &&environment.LOADGISTIC_SCENARIO_WORKER_ENABLED!=='true'
    &&demoWorldWorkerEnabled(environment);
}

async function boundedJson(response){
  if(Number(response.headers.get('content-length')||0)>RESPONSE_LIMIT_BYTES)
    throw Error('DEMO_CAPACITY_RESPONSE_INVALID');
  if(!response.body)throw Error('DEMO_CAPACITY_RESPONSE_INVALID');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    for(;;){
      const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;
      if(size>RESPONSE_LIMIT_BYTES){await reader.cancel();throw Error('DEMO_CAPACITY_RESPONSE_INVALID');}
      chunks.push(part.value);
    }
  }finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Error('DEMO_CAPACITY_RESPONSE_INVALID');}
}

function boundedSummary(value){
  const result={};
  for(const key of ['accepted','completed','skipped','failed','paused']){
    if(!Number.isSafeInteger(value?.[key])||value[key]<0||value[key]>CAPACITY_LIMIT)
      throw Error('DEMO_CAPACITY_RESPONSE_INVALID');
    result[key]=value[key];
  }
  if(value.ok!==true||result.accepted!==result.completed+result.skipped+result.failed
    ||result.paused>result.failed||typeof value.database_enabled!=='boolean'
    ||(!value.database_enabled&&result.accepted!==0)||value.catalog_version!==2
    ||!Number.isSafeInteger(value.paused_target_count)||value.paused_target_count<0
    ||value.paused_target_count>DEMO_WORLD_BATCH_LIMIT)throw Error('DEMO_CAPACITY_RESPONSE_INVALID');
  for(const key of ['pending_count','oldest_due_age_seconds','exhausted_count']){
    if(!Number.isSafeInteger(value[key])||value[key]<0)throw Error('DEMO_CAPACITY_RESPONSE_INVALID');
    result[key]=value[key];
  }
  if(result.oldest_due_age_seconds>604800)throw Error('DEMO_CAPACITY_RESPONSE_INVALID');
  return {...result,database_enabled:value.database_enabled,catalog_version:2,
    paused_target_count:value.paused_target_count};
}

/** Wake the durable controller once for at most two due actors; it owns writes. */
export async function runDemoCapacity({invocationUrl,environment=process.env,fetchImpl=fetch,now=Date.now(),onPhase=()=>{}}={}){
  onPhase('CONFIGURATION');
  if(!enabled(environment)||!demoOperatingHoursOpen(now))return {enabled:false};
  onPhase('INVOCATION');
  let incoming;
  try{incoming=new URL(String(invocationUrl||''));}catch{throw Error('DEMO_CAPACITY_ORIGIN_INVALID');}
  if(incoming.origin!==demoWorldOrigin(environment)||incoming.pathname!==FUNCTION_PATH
    ||incoming.username||incoming.password||incoming.search||incoming.hash)
    throw Error('DEMO_CAPACITY_ORIGIN_INVALID');
  onPhase('SIGNATURE');
  if(!/^[a-f0-9]{64}$/.test(environment.DEMO_CAPACITY_WORKER_SECRET||''))
    throw Error('DEMO_CAPACITY_SECRET_UNAVAILABLE');
  const target=new URL(DEMO_CAPACITY_ADVANCE_PATH,incoming.origin),timestamp=String(now);
  const body=JSON.stringify({limit:CAPACITY_LIMIT});
  const signature=createDemoWorldSignature({timestamp,url:target.href,purpose:'capacity-advance',body},environment);
  onPhase('REQUEST');
  const response=await fetchImpl(target,{
    method:'POST',body,redirect:'error',credentials:'omit',
    headers:{
      'content-type':'application/json',
      [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
      [DEMO_WORLD_SIGNATURE_HEADER]:signature
    },
    signal:AbortSignal.timeout(20_000)
  });
  if(!response.ok)throw Object.assign(Error('DEMO_CAPACITY_ADVANCE_FAILED'),{httpStatus:response.status});
  onPhase('RESPONSE');
  return {enabled:true,...boundedSummary(await boundedJson(response))};
}

async function executeCapacity(request,{environment=process.env,fetchImpl=fetch,now=Date.now()}={},scheduled=false){
  let phase='CONFIGURATION';
  try{
    // A native schedule is not a web invocation. Its synthetic Request URL is
    // not an authority or a dispatch destination; the exact runtime site is.
    if(scheduled&&(!enabled(environment)||!demoOperatingHoursOpen(now)))return new Response(null,{status:204});
    if(scheduled){phase='INVOCATION';request={url:new URL(FUNCTION_PATH,demoWorldOrigin(environment)).href};}
    const result=await runDemoCapacity({invocationUrl:request?.url,environment,fetchImpl,now,onPhase:value=>{phase=value;}});
    if(result.enabled)console.info(JSON.stringify({event:'demo-capacity-scheduled',ok:result.failed===0,...result}));
    return new Response(null,{status:204});
  }catch(error){
    const code=knownFailures.has(error?.message)?error.message:phase==='REQUEST'&&error?.name==='TimeoutError'?'REQUEST_TIMEOUT'
      :phase==='REQUEST'&&error?.name==='AbortError'?'REQUEST_ABORTED':'UNCLASSIFIED';
    const httpStatus=code==='DEMO_CAPACITY_ADVANCE_FAILED'&&Number.isSafeInteger(error.httpStatus)
      &&error.httpStatus>=100&&error.httpStatus<=599?error.httpStatus:null;
    console.error(JSON.stringify({event:'demo-capacity-scheduled',ok:false,error:'ADVANCE_FAILED',phase,code,httpStatus}));
    return new Response(null,{status:500});
  }
}

// Retain the strict HTTP-shaped helper for its existing contract/tests.
export async function executeDemoCapacity(request,options={}){return executeCapacity(request,options);}
export async function executeScheduledDemoCapacity(request,options={}){return executeCapacity(request,options,true);}
export default async function(request){return executeScheduledDemoCapacity(request);}

// Native cron has minute resolution. No long-lived loop, backdating or catch-up.
// UTC 06:00–07:59 = daily 09:00–10:59 Addis Ababa; runtime also checks hours.
export const config={schedule:'* 6-7 * * *'};
