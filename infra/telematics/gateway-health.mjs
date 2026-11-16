import {mkdir,readFile,rename,stat,unlink,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const healthFile='/tmp/loadgistic-bridge/health.json',maxAgeMs=90000;
const failures=new Set(['STARTING','INGEST_UNAVAILABLE','TRACCAR_UNAVAILABLE','DATABASE_UNAVAILABLE','CYCLE_UNAVAILABLE']);
const fields=['event','ready','writtenAt','checkedAt','cycleAt','pending','lagSeconds','failureCode'];
const count=value=>Number.isSafeInteger(value)&&value>=0;
const timestamp=value=>Number.isSafeInteger(value)&&value>0;

/** Explicit URI options could override pg's configured server/client deadlines. */
export function bridgeDatabaseConfiguration(value){
 let url;try{url=new URL(value);}catch{throw Error('GATEWAY_DATABASE_CONFIG_INVALID');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.password
  ||url.pathname.length<2||url.search||url.hash)throw Error('GATEWAY_DATABASE_CONFIG_INVALID');
 return {connectionString:value,max:3,connectionTimeoutMillis:5000,
  statement_timeout:5000,query_timeout:6000,lock_timeout:2000,idle_in_transaction_session_timeout:10000};
}

function validSnapshot(value){
 return value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key))
  &&value.event==='gateway_health'&&typeof value.ready==='boolean'&&timestamp(value.writtenAt)
  &&[value.checkedAt,value.cycleAt].every(time=>time===null||timestamp(time))
  &&[value.pending,value.lagSeconds].every(value=>value===null||count(value))
  &&(value.failureCode===null||failures.has(value.failureCode))
  &&(!value.ready||(timestamp(value.checkedAt)&&value.pending!==null&&value.lagSeconds!==null&&value.failureCode===null));
}

/** Health is aggregate connectivity evidence, not hardware or accepted-fix proof. */
export function createGatewayHealth({now=Date.now}={}){
 const state={ready:false,checkedAt:null,cycleAt:null,pending:null,lagSeconds:null,failureCode:'STARTING'};
 let failureVersion=0;
 return {
  beginCheck(){return failureVersion;},
  checked(queue,version=failureVersion){
   if(!count(queue?.pending)||!count(queue?.lag_seconds))throw Error('GATEWAY_HEALTH_INVALID');
   // A concurrent lane may have failed after this full check started.
   if(version!==failureVersion)return false;
   Object.assign(state,{ready:true,checkedAt:now(),pending:queue.pending,lagSeconds:queue.lag_seconds,failureCode:null});
   return true;
  },
  cycled(){state.cycleAt=now();},
  unavailable(code){failureVersion++;state.ready=false;state.failureCode=failures.has(code)?code:'CYCLE_UNAVAILABLE';},
  snapshot(){return {event:'gateway_health',...state,writtenAt:now()};}
 };
}

/** Batch delivery deliberately catches transport errors to retain durable retries. */
export async function observeGatewayApplication(operation,health){
 try{return await operation();}
 catch{health.unavailable('INGEST_UNAVAILABLE');throw Error('INGEST_UNAVAILABLE');}
}

export async function writeGatewayHealth(value,{file=healthFile}={}){
 if(!validSnapshot(value))throw Error('GATEWAY_HEALTH_INVALID');
 await mkdir(path.dirname(file),{recursive:true,mode:0o700});
 const temporary=`${file}.${randomUUID()}.tmp`;
 try{
  await writeFile(temporary,JSON.stringify(value),{flag:'wx',mode:0o600});
  await rename(temporary,file);
 }finally{await unlink(temporary).catch(()=>{});}
}

export async function checkGatewayHealthFile({file=healthFile,now=Date.now}={}){
 try{
  if((await stat(file)).size>4096)return false;
  const value=JSON.parse(await readFile(file,'utf8')),time=now();
  return Boolean(validSnapshot(value)&&value.ready&&[value.writtenAt,value.checkedAt,value.cycleAt]
   .every(at=>timestamp(at)&&at<=time+5000&&time-at<=maxAgeMs));
 }catch{return false;}
}

/** Unauthenticated private server metadata only; never fetch a device or payload. */
export async function probeTraccarReadiness(value,{fetchImpl=fetch,timeoutMs=5000}={}){
 let url;try{url=new URL(value);}catch{throw Error('TRACCAR_READINESS_INVALID');}
 if(url.protocol!=='http:'||!['127.0.0.1','localhost','traccar','synthetic-traccar'].includes(url.hostname)
  ||url.port!=='8082'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/server'
  ||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw Error('TRACCAR_READINESS_INVALID');
 try{
  const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',
   redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  await response.body?.cancel();
  if(response.status!==200)throw Error('TRACCAR_UNAVAILABLE');
 }catch{throw Error('TRACCAR_UNAVAILABLE');}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ready=process.argv.length===3&&process.argv[2]==='--check'&&await checkGatewayHealthFile();
 console.log(JSON.stringify({event:ready?'gateway_readiness_ready':'gateway_readiness_unavailable'}));
 if(!ready)process.exitCode=1;
}
