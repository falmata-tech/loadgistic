import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {hostedDemoMotionConfiguration,HOSTED_DEMO_MOTION_PATH} from './demo-motion-hosted-auth.js';
import {DEMO_MOTION_COHORT} from './demo-motion-cohort.js';
import {demoOperatingWindowEnd} from './demo-operating-hours.mjs';

export const NETLIFY_MOTION_PATH='/api/internal/demo-motion/netlify';
export const NETLIFY_MOTION_BACKGROUND='/.netlify/functions/demo-motion-background';
export const NETLIFY_MOTION_SCHEDULE='/.netlify/functions/demo-motion';
export const NETLIFY_MOTION_TARGETS=Object.freeze(Object.keys(DEMO_MOTION_COHORT));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paths=new Set([NETLIFY_MOTION_PATH,NETLIFY_MOTION_BACKGROUND]);

export async function readNetlifyMotionBody(request){
 if(!request.body||Number(request.headers.get('content-length')||0)>512)throw Error('DEMO_HOSTED_INPUT_DENIED');
 const reader=request.body.getReader(),parts=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>512){await reader.cancel();throw Error('DEMO_HOSTED_INPUT_DENIED');}parts.push(part.value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(parts).toString('utf8');
}

export function netlifyMotionConfiguration(environment,requestUrl,path){
 if(!paths.has(path)&&path!==NETLIFY_MOTION_SCHEDULE)throw Error('DEMO_NETLIFY_AUTH_DENIED');
 if(environment.LOADGISTIC_DEMO_MOTION_NETLIFY_ENABLED!=='true'
  ||environment.LOADGISTIC_DEMO_MOTION_NETLIFY_KILL_SWITCH!=='false'
  ||environment.LOADGISTIC_HOSTED_MOTION_WORKER_ENABLED==='true')return null;
 const incoming=new URL(requestUrl);
 if(incoming.pathname!==path||incoming.search||incoming.hash||incoming.username||incoming.password)
  throw Error('DEMO_NETLIFY_AUTH_DENIED');
 // Native Functions may omit build-time NODE_ENV. Keep explicit development/
 // preview denial, exact runtime site/origin/project and production-only keys.
 // The Next application receiver retains the original strict NODE_ENV gate.
 return hostedDemoMotionConfiguration(environment,incoming.origin+HOSTED_DEMO_MOTION_PATH,
  {allowMissingNodeEnv:path!==NETLIFY_MOTION_PATH});
}

export function netlifyMotionSignature(config,path,body,issuedAt,nonce){
 if(!paths.has(path))throw Error('DEMO_NETLIFY_AUTH_DENIED');
 return createHmac('sha256',config.secret).update(['POST',config.origin,path,issuedAt,nonce,
  createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
}

export function authenticateNetlifyMotion(headers,body,config,path,now=Date.now()){
 const issuedAt=headers.get('x-demo-issued-at'),nonce=headers.get('x-demo-nonce'),signature=headers.get('x-demo-signature');
 if(typeof body!=='string'||Buffer.byteLength(body)>512||!issuedAt||!Number.isFinite(Date.parse(issuedAt))
  ||Math.abs(now-Date.parse(issuedAt))>30_000||!uuid.test(nonce||'')||!/^[a-f0-9]{64}$/.test(signature||''))
  throw Error('DEMO_NETLIFY_AUTH_DENIED');
 const expected=netlifyMotionSignature(config,path,body,issuedAt,nonce);
 if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex')))throw Error('DEMO_NETLIFY_AUTH_DENIED');
 return {nonce};
}

export function signedNetlifyMotion(config,path,body,now=Date.now(),nonce=randomUUID()){
 const issuedAt=new Date(now).toISOString();
 return {'content-type':'application/json','x-demo-issued-at':issuedAt,'x-demo-nonce':nonce,
  'x-demo-signature':netlifyMotionSignature(config,path,body,issuedAt,nonce)};
}

async function responseJson(response){
 if(!response.body||Number(response.headers.get('content-length')||0)>8192)throw Error('DEMO_NETLIFY_RESPONSE_DENIED');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>8192){await reader.cancel();throw Error('DEMO_NETLIFY_RESPONSE_DENIED');}parts.push(part.value);}}
 finally{reader.releaseLock();}
 let result;try{result=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('DEMO_NETLIFY_RESPONSE_DENIED');}
 if(!response.ok||result?.ok!==true){
  if(result?.code==='DEMO_MOTION_SCENARIO_UNAVAILABLE')throw Error(result.code);
  throw Error('DEMO_NETLIFY_COMMAND_DENIED');
 }
 return result.data;
}

/** The worker has only its motion HMAC; no gateway, database or device API port. */
export function netlifyMotionClient(config,{fetchImpl=fetch,now=Date.now,signal}={}){
 return async payload=>{
  const body=JSON.stringify(payload),timeout=AbortSignal.timeout(8000);
  const response=await fetchImpl(config.origin+NETLIFY_MOTION_PATH,{method:'POST',body,
   headers:signedNetlifyMotion(config,NETLIFY_MOTION_PATH,body,now()),redirect:'error',credentials:'omit',cache:'no-store',
   signal:signal?AbortSignal.any([signal,timeout]):timeout});
  return responseJson(response);
 };
}

function dueTime(value,now){
 const due=Date.parse(value);
 if(!Number.isFinite(due)||due<now-60_000||due>now+31_000)throw Error('DEMO_NETLIFY_RESPONSE_DENIED');
 return due;
}

/** Two actual due reports per bounded window, with durable per-target timing. */
export async function runNetlifyMotionWindow({client,runId,now=Date.now,
 sleep=(ms,signal)=>delay(ms,undefined,{signal}),signal}={}){
 if(typeof client!=='function'||!uuid.test(runId||''))throw Error('DEMO_NETLIFY_INPUT_DENIED');
 const started=now(),operatingEnd=demoOperatingWindowEnd(started);
 if(operatingEnd===null)return {claimed:false,recorded:0,notDue:0,unavailable:0,failed:0};
 const claim=await client({action:'CLAIM',runId});
 if(typeof claim?.claimed!=='boolean')throw Error('DEMO_NETLIFY_RESPONSE_DENIED');
 if(!claim.claimed)return {claimed:false,recorded:0,notDue:0,unavailable:0,failed:0};
 const expiry=Date.parse(claim.expiresAt);
 if(!Number.isFinite(expiry)||expiry<=now()||expiry>now()+60_000)throw Error('DEMO_NETLIFY_RESPONSE_DENIED');
 const deadline=Math.min(expiry,started+55_000,operatingEnd),counts={claimed:true,recorded:0,notDue:0,unavailable:0,failed:0};
 await Promise.all(NETLIFY_MOTION_TARGETS.map(async target=>{
  try{
   const prepared=await client({action:'PREPARE',runId,target});
   if(prepared?.ready!==true)throw Error('DEMO_NETLIFY_RESPONSE_DENIED');
   let due=dueTime(prepared.dueAt,now());
   for(let tick=0;tick<2;tick++){
    if(signal?.aborted||due>=deadline||now()>=deadline){counts.notDue++;break;}
    if(due>now())await sleep(due-now(),signal);
    if(signal?.aborted||now()>=deadline){counts.notDue++;break;}
    const report=await client({action:'REPORT',runId,target});
    if(typeof report?.recorded!=='boolean')throw Error('DEMO_NETLIFY_RESPONSE_DENIED');
    if(report.recorded)counts.recorded++;else counts.notDue++;
    due=dueTime(report.dueAt,now());
    if(due<=now())throw Error('DEMO_NETLIFY_RESPONSE_DENIED');
   }
  }catch(error){
   if(error?.message==='DEMO_MOTION_SCENARIO_UNAVAILABLE')counts.unavailable++;
   else counts.failed++;
  }
 }));
 return counts;
}
