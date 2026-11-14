import {
  createDemoWorldSignature,demoWorldOrigin,demoWorldWorkerEnabled,
  DEMO_CAPACITY_ADVANCE_PATH,DEMO_WORLD_BATCH_LIMIT,
  DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER
} from '../../src/lib/demo-world-worker-auth.js';

const FUNCTION_PATH='/.netlify/functions/demo-capacity';
const RESPONSE_LIMIT_BYTES=8192;
const CAPACITY_LIMIT=2;

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
export async function runDemoCapacity({invocationUrl,environment=process.env,fetchImpl=fetch,now=Date.now()}={}){
  if(!enabled(environment))return {enabled:false};
  let incoming;
  try{incoming=new URL(String(invocationUrl||''));}catch{throw Error('DEMO_CAPACITY_ORIGIN_INVALID');}
  if(incoming.origin!==demoWorldOrigin(environment)||incoming.pathname!==FUNCTION_PATH
    ||incoming.username||incoming.password||incoming.search||incoming.hash)
    throw Error('DEMO_CAPACITY_ORIGIN_INVALID');
  if(!/^[a-f0-9]{64}$/.test(environment.DEMO_CAPACITY_WORKER_SECRET||''))
    throw Error('DEMO_CAPACITY_SECRET_UNAVAILABLE');
  const target=new URL(DEMO_CAPACITY_ADVANCE_PATH,incoming.origin),timestamp=String(now);
  const body=JSON.stringify({limit:CAPACITY_LIMIT});
  const response=await fetchImpl(target,{
    method:'POST',body,redirect:'error',credentials:'omit',
    headers:{
      'content-type':'application/json',
      [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
      [DEMO_WORLD_SIGNATURE_HEADER]:createDemoWorldSignature({
        timestamp,url:target.href,purpose:'capacity-advance',body
      },environment)
    },
    signal:AbortSignal.timeout(20_000)
  });
  if(!response.ok)throw Error('DEMO_CAPACITY_ADVANCE_FAILED');
  return {enabled:true,...boundedSummary(await boundedJson(response))};
}

export async function executeDemoCapacity(request,options={}){
  try{
    const result=await runDemoCapacity({invocationUrl:request?.url,...options});
    if(result.enabled)console.info(JSON.stringify({event:'demo-capacity-scheduled',ok:result.failed===0,...result}));
    return new Response(null,{status:204});
  }catch{
    console.error(JSON.stringify({event:'demo-capacity-scheduled',ok:false,error:'ADVANCE_FAILED'}));
    return new Response(null,{status:500});
  }
}

export default async function(request){return executeDemoCapacity(request);}

// Native cron has minute resolution. No long-lived loop, backdating or catch-up.
export const config={schedule:'* * * * *'};
