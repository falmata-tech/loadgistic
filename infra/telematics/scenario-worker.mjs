import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {mkdir,lstat,writeFile,rename,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createDemoWorldSignature,DEMO_CAPACITY_ADVANCE_PATH,DEMO_WORLD_BATCH_LIMIT,
 DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER} from '../../src/lib/demo-world-worker-auth.js';

const INTERVAL_MS=30000;
export const SCENARIO_CAPACITY_LIMIT=1;
export const SCENARIO_HEARTBEAT_DIRECTORY='/run/loadgistic-scenario';
const HEARTBEAT_FILE='heartbeat.json';
const HEARTBEAT_MAX_AGE_MS=90000;
const heartbeatCodes=new Set(['WORKER_DISABLED','DATABASE_DISABLED','DEMO_SCENARIO_AUTH_DENIED']);
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
export function scenarioWorkerConfiguration(environment=process.env){
 if(environment.LOADGISTIC_SCENARIO_WORKER_ENABLED!=='true'
  ||environment.LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH!=='false')return {enabled:false};
 try{
  const origin=new URL(environment.LOADGISTIC_DEMO_WORLD_SITE_ORIGIN);
  if(environment.NODE_ENV!=='production'||origin.protocol!=='https:'||origin.username||origin.password
   ||origin.port||origin.pathname!=='/'||origin.search||origin.hash
   ||!uuid.test(environment.LOADGISTIC_DEMO_WORLD_SITE_ID||''))throw Error('invalid');
  const secret=environment.DEMO_CAPACITY_WORKER_SECRET;
  // This process must never receive another lane's authority, even with a
  // different value. Separation is also enforced on the receiving app server.
  const forbidden=['DEMO_WORLD_WORKER_SECRET','SESSION_SECRET','HOSTED_DEMO_MOTION_SECRET',
   'LOADGISTIC_DEMO_MOTION_SECRET','GATEWAY_SECRET','SYNTHETIC_GATEWAY_SECRET',
   'SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SEED_SERVICE_ROLE_KEY','TELEMATICS_GATEWAYS_JSON',
   'TELEMATICS_PRIVACY_GATEWAYS_JSON'];
  if(!hex.test(secret||'')||forbidden.some(key=>environment[key]!==undefined&&environment[key]!==''))throw Error('invalid');
  return {enabled:true,origin:origin.origin,siteId:environment.LOADGISTIC_DEMO_WORLD_SITE_ID,secret};
 }catch{throw Error('DEMO_SCENARIO_CONFIG_DENIED');}
}

function validHeartbeat(value,now){
 return value&&Object.keys(value).every(key=>['version','pid','updatedAtMs','state','enabled','code','pausedTargetCount'].includes(key))
  &&value.version===1&&Number.isSafeInteger(value.pid)&&value.pid>=1
  &&Number.isSafeInteger(value.updatedAtMs)&&value.updatedAtMs<=now+5000
  &&now-value.updatedAtMs<=HEARTBEAT_MAX_AGE_MS&&['RUNNING','INERT','STOPPED'].includes(value.state)
  &&typeof value.enabled==='boolean'&&(value.code===undefined||heartbeatCodes.has(value.code))
  &&(value.pausedTargetCount===undefined||Number.isSafeInteger(value.pausedTargetCount)&&value.pausedTargetCount>=0&&value.pausedTargetCount<=DEMO_WORLD_BATCH_LIMIT);
}

/** Fixed private tmpfs in production; test directory is not a CLI/env option. */
export async function writeScenarioHeartbeat(state,{directory=SCENARIO_HEARTBEAT_DIRECTORY,now=Date.now(),pid=process.pid}={}){
 const value={version:1,pid,updatedAtMs:now,...state};
 if(!validHeartbeat(value,now))throw Error('DEMO_SCENARIO_HEALTH_UNAVAILABLE');
 await mkdir(directory,{recursive:true,mode:0o700});
 const parent=await lstat(directory);
 if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0
  ||typeof process.getuid==='function'&&parent.uid!==process.getuid())throw Error('DEMO_SCENARIO_HEALTH_UNAVAILABLE');
 const temporary=path.join(directory,HEARTBEAT_FILE+'.tmp');
 await writeFile(temporary,JSON.stringify(value),{mode:0o600,flag:'wx'});
 await rename(temporary,path.join(directory,HEARTBEAT_FILE));
}

export async function scenarioWorkerHealth({directory=SCENARIO_HEARTBEAT_DIRECTORY,now=Date.now(),probePid=pid=>process.kill(pid,0)}={}){
 try{
  const parent=await lstat(directory),file=path.join(directory,HEARTBEAT_FILE),metadata=await lstat(file);
  if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o077)!==0
   ||!metadata.isFile()||metadata.isSymbolicLink()||(metadata.mode&0o077)!==0||metadata.size>1024
   ||typeof process.getuid==='function'&&(parent.uid!==process.getuid()||metadata.uid!==process.getuid()))throw Error('invalid');
  const value=JSON.parse(await readFile(file,'utf8'));
  if(!validHeartbeat(value,now)||value.state==='STOPPED')throw Error('invalid');
  probePid(value.pid);
  return {healthy:true,state:value.state,enabled:value.enabled,
   ...(value.pausedTargetCount===undefined?{}:{paused_target_count:value.pausedTargetCount})};
 }catch{return {healthy:false,code:'DEMO_SCENARIO_HEALTH_UNAVAILABLE'};}
}

function safeCode(error){
 return ['DEMO_SCENARIO_AUTH_DENIED','DEMO_SCENARIO_APP_UNAVAILABLE','DEMO_SCENARIO_RESPONSE_DENIED',
  'DEMO_SCENARIO_TRANSPORT_UNAVAILABLE','DEMO_SCENARIO_CONFIG_DENIED',
  'DEMO_SCENARIO_HEALTH_UNAVAILABLE'].includes(error?.message)?error.message:'DEMO_SCENARIO_RUN_FAILED';
}
async function boundedJson(response){
 if(Number(response.headers?.get?.('content-length')||0)>8192)throw Error('DEMO_SCENARIO_RESPONSE_DENIED');
 if(!response.body){
  const value=await response.text();if(Buffer.byteLength(value)>8192)throw Error('DEMO_SCENARIO_RESPONSE_DENIED');
  try{return JSON.parse(value);}catch{throw Error('DEMO_SCENARIO_RESPONSE_DENIED');}
 }
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{
  for(;;){const part=await reader.read();if(part.done)break;
   size+=part.value.byteLength;if(size>8192){await reader.cancel();throw Error('DEMO_SCENARIO_RESPONSE_DENIED');}
   chunks.push(part.value);}
 }finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('DEMO_SCENARIO_RESPONSE_DENIED');}
}
function summary(value){
 const counts={};
 for(const field of ['accepted','completed','skipped','failed','paused']){
  if(!Number.isSafeInteger(value?.[field])||value[field]<0||value[field]>SCENARIO_CAPACITY_LIMIT)
   throw Error('DEMO_SCENARIO_RESPONSE_DENIED');
  counts[field]=value[field];
 }
 if(value.ok!==true||counts.accepted!==counts.completed+counts.skipped+counts.failed
  ||counts.paused>counts.failed||typeof value.database_enabled!=='boolean'
  ||!Number.isSafeInteger(value.paused_target_count)||value.paused_target_count<0||value.paused_target_count>DEMO_WORLD_BATCH_LIMIT
  ||value.catalog_version!==2||!value.database_enabled&&counts.accepted!==0)throw Error('DEMO_SCENARIO_RESPONSE_DENIED');
 return {...counts,paused_target_count:value.paused_target_count,database_enabled:value.database_enabled,catalog_version:2};
}

/** A separate credential and fast-only path; no database or GPS capability. */
export async function runScenarioWorkerTick(config,{fetchImpl=fetch,now=Date.now,signal}={}){
 if(!config?.enabled)return {enabled:false};
 const url=config.origin+DEMO_CAPACITY_ADVANCE_PATH,timestamp=String(now());
 const body=JSON.stringify({limit:SCENARIO_CAPACITY_LIMIT});
 const environment={LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:config.origin,DEMO_CAPACITY_WORKER_SECRET:config.secret};
 let response;
 try{response=await fetchImpl(url,{method:'POST',body,redirect:'error',credentials:'omit',
  headers:{'content-type':'application/json',[DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
   [DEMO_WORLD_SIGNATURE_HEADER]:createDemoWorldSignature({timestamp,url,purpose:'capacity-advance',body},environment)},
  signal:AbortSignal.any([AbortSignal.timeout(20000),...(signal?[signal]:[])])});}
 catch{throw Error('DEMO_SCENARIO_TRANSPORT_UNAVAILABLE');}
 if([401,403].includes(response.status))throw Error('DEMO_SCENARIO_AUTH_DENIED');
 if(!response.ok)throw Error('DEMO_SCENARIO_APP_UNAVAILABLE');
 return {enabled:true,...summary(await boundedJson(response))};
}

export async function runScenarioWorker(config,{signal,fetchImpl=fetch,now=Date.now,
 sleep=(ms,abort)=>delay(ms,undefined,{signal:abort}),report=()=>{},heartbeat=async()=>{}}={}){
 if(!config.enabled){await heartbeat({state:'INERT',enabled:false,code:'WORKER_DISABLED'});return {enabled:false};}
 let pausedTargetCount;
 while(!signal?.aborted){
  const started=now();
  await heartbeat({state:'RUNNING',enabled:true,...(pausedTargetCount===undefined?{}:{pausedTargetCount})});
  try{
   const result=await runScenarioWorkerTick(config,{fetchImpl,now,signal});
   pausedTargetCount=result.paused_target_count;
   await heartbeat({state:'RUNNING',enabled:true,pausedTargetCount});
   report({event:'demo_scenario_tick',...result});
   if(!result.database_enabled)return {enabled:true,state:'INERT',code:'DATABASE_DISABLED'};
  }catch(error){
   if(signal?.aborted)break;
   const code=safeCode(error);report({event:'demo_scenario_tick',ok:false,code});
   if(code==='DEMO_SCENARIO_AUTH_DENIED')return {enabled:true,state:'INERT',code};
  }
  try{await sleep(Math.max(1,INTERVAL_MS-(now()-started)),signal);}catch{break;}
 }
 return {enabled:true,state:'STOPPED'};
}

async function main(){
 if(process.argv[2]==='--health'){
  const result=await scenarioWorkerHealth();console.log(JSON.stringify({event:'demo_scenario_health',...result}));
  if(!result.healthy)process.exitCode=1;return;
 }
 if(!['--preflight','--run'].includes(process.argv[2]))throw Error('DEMO_SCENARIO_CONFIG_DENIED');
 const config=scenarioWorkerConfiguration();
 if(process.argv[2]==='--preflight'){
  console.log(JSON.stringify({event:'demo_scenario_preflight',enabled:config.enabled,deploymentAuthorized:false}));return;
 }
 const controller=new AbortController();
 process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
 const heartbeat=state=>writeScenarioHeartbeat(state);
 const outcome=await runScenarioWorker(config,{signal:controller.signal,heartbeat,report:value=>console.log(JSON.stringify(value))});
 if(outcome.state!=='STOPPED'){
  console.log(JSON.stringify({event:'demo_scenario_inert',enabled:config.enabled,code:outcome.code||'WORKER_DISABLED'}));
  // Stay inert after a kill/auth refusal; a restart policy cannot hammer the app.
  while(!controller.signal.aborted){
   await heartbeat({state:'INERT',enabled:config.enabled,code:outcome.code||'WORKER_DISABLED'});
   try{await delay(INTERVAL_MS,undefined,{signal:controller.signal});}catch{break;}
  }
 }
 await heartbeat({state:'STOPPED',enabled:config.enabled});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await main();}catch(error){console.error(JSON.stringify({event:'demo_scenario_exit',code:safeCode(error)}));process.exitCode=1;}
}
