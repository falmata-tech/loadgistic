import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {DEMO_MOTION_COHORT} from '../../src/lib/demo-motion-cohort.js';
import {HOSTED_DEMO_MOTION_PATH,hostedDemoMotionSignature} from '../../src/lib/demo-motion-hosted-signature.mjs';
import {crc16X25,gpsPacket,loginPacket} from '../../scripts/telematics/simulator.mjs';
import {hostedRouteFix} from './hosted-motion-route.mjs';

export const HOSTED_MOTION_TARGETS=Object.freeze(Object.keys(DEMO_MOTION_COHORT));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
const CYCLE_SECONDS=300,TICK_MS=60000;

function exactOrigin(raw){
 const url=new URL(String(raw||''));
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)
  throw Error('HOSTED_MOTION_CONFIG_DENIED');
 return url.origin;
}

/** Offline preflight. Disabled config never opens a socket or sends a request. */
export function assertHostedMotionWorkerEnvironment(env){
 if(env.LOADGISTIC_HOSTED_MOTION_WORKER_ENABLED!=='true'||env.LOADGISTIC_HOSTED_MOTION_WORKER_KILL_SWITCH!=='false')
  return {enabled:false};
 try{
  if(env.NODE_ENV!=='production'||env.SYNTHETIC_GT06_HOST!=='synthetic-traccar'
   ||String(env.SYNTHETIC_GT06_PORT)!=='5023'||!uuid.test(env.LOADGISTIC_HOSTED_MOTION_SITE_ID||''))
   throw Error('HOSTED_MOTION_CONFIG_DENIED');
  const origin=exactOrigin(env.LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN);
  const project=exactOrigin(env.LOADGISTIC_HOSTED_MOTION_SUPABASE_URL);
  if(!new URL(project).hostname.endsWith('.supabase.co'))throw Error('HOSTED_MOTION_CONFIG_DENIED');
  const secret=env.HOSTED_DEMO_MOTION_SECRET;
  if(!hex.test(secret||'')||[env.DEMO_WORLD_WORKER_SECRET,env.GATEWAY_SECRET,
   env.SYNTHETIC_GATEWAY_SECRET,env.SUPABASE_SERVICE_ROLE_KEY].includes(secret))
   throw Error('HOSTED_MOTION_CONFIG_DENIED');
  return {enabled:true,origin,project,secret,siteId:env.LOADGISTIC_HOSTED_MOTION_SITE_ID,
   gpsHost:'synthetic-traccar',gpsPort:5023};
 }catch{throw Error('HOSTED_MOTION_CONFIG_DENIED');}
}

async function boundedBody(response){
 if(Number(response.headers?.get?.('content-length')||0)>8192)throw Error('HOSTED_MOTION_RESPONSE_DENIED');
 if(!response.body){const text=await response.text();if(Buffer.byteLength(text)>8192)throw Error('HOSTED_MOTION_RESPONSE_DENIED');return text;}
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>8192){await reader.cancel();throw Error('HOSTED_MOTION_RESPONSE_DENIED');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}

function assertWorkerCommand(command){
 if(!command||typeof command!=='object'||Array.isArray(command)||!HOSTED_MOTION_TARGETS.includes(command.target))
  throw Error('HOSTED_MOTION_TARGET_DENIED');
 const fields={STATUS:['action','target'],CONFIGURE:['action','target'],START:['action','target','seconds'],
  STOP:['action','target','leaseId','epoch'],GPS:['action','target','leaseId','epoch','latitude','longitude'],
  PHONE:['action','target','leaseId','epoch','latitude','longitude']}[command.action];
 if(!fields||Object.keys(command).sort().join(',')!==fields.sort().join(','))throw Error('HOSTED_MOTION_COMMAND_DENIED');
 if(command.action==='START'&&(!Number.isInteger(command.seconds)||command.seconds<60||command.seconds>900))
  throw Error('HOSTED_MOTION_COMMAND_DENIED');
 if(['STOP','GPS','PHONE'].includes(command.action)&&(!uuid.test(command.leaseId||'')
  ||!Number.isSafeInteger(command.epoch)||command.epoch<1))throw Error('HOSTED_MOTION_COMMAND_DENIED');
 if(['GPS','PHONE'].includes(command.action)&&(!Number.isFinite(command.latitude)||!Number.isFinite(command.longitude)
  ||DEMO_MOTION_COHORT[command.target].source!==(command.action==='GPS'?'GPS':'MOBILE')))
  throw Error('HOSTED_MOTION_COMMAND_DENIED');
}

/** A fresh nonce for each command; ambiguous writes are never retried. */
export function hostedMotionClient(config,{fetchImpl=fetch,now=Date.now,timeoutMs=10000}={}){
 if(!config?.enabled||!hex.test(config.secret||'')||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>20000)
  throw Error('HOSTED_MOTION_CONFIG_DENIED');
 const endpoint=config.origin+HOSTED_DEMO_MOTION_PATH;
 return async(command,{signal}={})=>{
  assertWorkerCommand(command);
  const body=JSON.stringify(command),issuedAt=new Date(now()).toISOString(),nonce=randomUUID();
  const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
  let response;
  try{response=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:combined,
   headers:{'Content-Type':'application/json','x-demo-issued-at':issuedAt,'x-demo-nonce':nonce,
    'x-demo-signature':hostedDemoMotionSignature(config.secret,config.origin,body,issuedAt,nonce)},body});}
  catch{throw Error('HOSTED_MOTION_TRANSPORT_UNAVAILABLE');}
  let value;try{value=JSON.parse(await boundedBody(response));}catch{throw Error('HOSTED_MOTION_RESPONSE_DENIED');}
  if(!response.ok||value?.ok!==true){
   const code=/^DEMO_[A-Z_]{1,60}$/.test(value?.code||'')?value.code:'HOSTED_MOTION_APP_DENIED';
   throw Error(code);
  }
  return value.data;
 };
}

/** This socket can address only the private synthetic GT06 service. */
export function openPrivateGt06(imei,{connectFactory=net.createConnection,signal,timeoutMs=8000}={}){
 if(!HOSTED_MOTION_TARGETS.some(name=>DEMO_MOTION_COHORT[name].source==='GPS'&&DEMO_MOTION_COHORT[name].imei===imei)
  ||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>15000)
  throw Error('HOSTED_MOTION_TARGET_DENIED');
 if(signal?.aborted)throw Error('HOSTED_MOTION_STOPPED');
 const socket=connectFactory({host:'synthetic-traccar',port:5023});
 let pending=Buffer.alloc(0),ready=false,closed=false,serial=2,settled=false;
 const close=()=>{closed=true;socket.destroy();};
 const connected=new Promise((resolve,reject)=>{
  let timer;
  const finish=()=>{clearTimeout(timer);};
  const fail=code=>{if(!settled){settled=true;finish();reject(Error(code));}close();};
  const abort=()=>fail('HOSTED_MOTION_STOPPED');
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>fail('HOSTED_MOTION_GPS_TIMEOUT'),timeoutMs);
  socket.once('connect',()=>{if(!closed)socket.write(loginPacket(imei));});
  socket.on('data',chunk=>{
   if(closed)return;
   pending=Buffer.concat([pending,chunk]);if(pending.length>4096){fail('HOSTED_MOTION_GPS_PROTOCOL_DENIED');return;}
   while(pending.length>=5){
    if(pending[0]!==0x78||pending[1]!==0x78){fail('HOSTED_MOTION_GPS_PROTOCOL_DENIED');return;}
    const size=pending[2]+5;if(size<10||size>512){fail('HOSTED_MOTION_GPS_PROTOCOL_DENIED');return;}
    if(pending.length<size)break;
    const frame=pending.subarray(0,size);pending=pending.subarray(size);
    if(frame.readUInt16BE(size-4)!==crc16X25(frame.subarray(2,size-4))){fail('HOSTED_MOTION_GPS_PROTOCOL_DENIED');return;}
    if(frame[3]===1&&!ready){ready=true;settled=true;finish();resolve({
     sendFix:fix=>new Promise((sent,denied)=>{
      if(closed||socket.destroyed||signal?.aborted){denied(Error('HOSTED_MOTION_STOPPED'));return;}
      if(!Number.isFinite(fix?.latitude)||!Number.isFinite(fix?.longitude)||!Number.isFinite(Date.parse(fix?.observedAt||'')))
       {denied(Error('HOSTED_MOTION_RESPONSE_DENIED'));return;}
      let done=false;
      const finishWrite=error=>{if(done)return;done=true;clearTimeout(writeTimer);signal?.removeEventListener('abort',abortWrite);
       error?denied(Error('HOSTED_MOTION_GPS_UNAVAILABLE')):sent();};
      const abortWrite=()=>{close();finishWrite(true);};
      const writeTimer=setTimeout(()=>{close();finishWrite(true);},5000);
      signal?.addEventListener('abort',abortWrite,{once:true});
      try{socket.write(gpsPacket({...fix,speedKph:20,ignition:true},serial++,new Date(fix.observedAt)),finishWrite);}
      catch{finishWrite(true);}
     }),close});
    }else {fail('HOSTED_MOTION_GPS_PROTOCOL_DENIED');return;}
   }
  });
  socket.on('error',()=>fail('HOSTED_MOTION_GPS_UNAVAILABLE'));
  socket.on('close',()=>{closed=true;signal?.removeEventListener('abort',abort);
   if(!settled)fail('HOSTED_MOTION_GPS_UNAVAILABLE');});
 });
 return connected;
}

function resultCode(error){
 const code=error?.message;
 return /^(?:DEMO|HOSTED_MOTION)_[A-Z_]{1,60}$/.test(code||'')?code:'HOSTED_MOTION_FAILED';
}
function validStatus(status){
 if(!status||typeof status!=='object'||Array.isArray(status))throw Error('HOSTED_MOTION_RESPONSE_DENIED');
 if(status.state===undefined||status.state==='UNCONFIGURED')return 'UNCONFIGURED';
 if(!['OFF','EXPIRED','RUNNING','REAL'].includes(status.state))throw Error('HOSTED_MOTION_RESPONSE_DENIED');
 return status.state;
}
function validLease(lease,target,nowMs,seconds){
 if(!lease||lease.state!=='RUNNING'||lease.source!==DEMO_MOTION_COHORT[target].source
  ||!uuid.test(lease.leaseId||'')||!Number.isSafeInteger(lease.epoch)||lease.epoch<1
  ||!Number.isFinite(Date.parse(lease.expiresAt||''))||Date.parse(lease.expiresAt)<nowMs+1000
  ||Date.parse(lease.expiresAt)>nowMs+(seconds+20)*1000)throw Error('HOSTED_MOTION_RESPONSE_DENIED');
 return lease;
}

/** One target failure is contained; only the current returned lease may be stopped. */
export async function runHostedMotionTarget(target,{client,openGps=openPrivateGt06,now=Date.now,
 sleep=(ms,signal)=>delay(ms,undefined,{signal}),signal,seconds=CYCLE_SECONDS,onFailure=()=>{}}={}){
 if(!HOSTED_MOTION_TARGETS.includes(target)||typeof client!=='function'||!Number.isInteger(seconds)||seconds<60||seconds>900)
  throw Error('HOSTED_MOTION_TARGET_DENIED');
 let lease,gps,started=0,ticks=0,status='STOPPED',code;
 try{
  const current=await client({action:'STATUS',target},{signal});
  const state=validStatus(current);
  if(state==='REAL')return {target,status:'REAL',ticks};
  if(state==='RUNNING'){
   const expiry=Date.parse(current.expiresAt||'');
   if(!Number.isFinite(expiry))throw Error('HOSTED_MOTION_RESPONSE_DENIED');
   if(expiry>now())return {target,status:'BUSY',ticks};
  }
  if(signal?.aborted)return {target,status:'STOPPED',ticks};
  if(DEMO_MOTION_COHORT[target].source==='GPS')gps=await openGps(DEMO_MOTION_COHORT[target].imei,{signal});
  if(state==='UNCONFIGURED')await client({action:'CONFIGURE',target},{signal});
  started=now();
  const startedLease=await client({action:'START',target,seconds},{signal});
  // Preserve a returned generation for safe STOP even if the source or expiry
  // is malformed. A response without a valid generation can only time out.
  if(uuid.test(startedLease?.leaseId||'')&&Number.isSafeInteger(startedLease?.epoch)&&startedLease.epoch>0)
   lease=startedLease;
  validLease(startedLease,target,now(),seconds);
  status='RUNNING';
  const deadline=Math.min(started+seconds*1000,Date.parse(lease.expiresAt)-1000);
  for(let index=0;index<Math.ceil(seconds*1000/TICK_MS);index++){
   const due=started+1100+index*TICK_MS;
   if(due>=deadline||signal?.aborted)break;
   const wait=Math.max(0,due-now());if(wait)await sleep(wait,signal);
   if(signal?.aborted||now()>=deadline)break;
   const fix=hostedRouteFix(target,now());
   const authority={target,leaseId:lease.leaseId,epoch:lease.epoch,latitude:fix.latitude,longitude:fix.longitude};
   if(gps){
    const saved=await client({action:'GPS',...authority},{signal});
    if(!saved||!Number.isFinite(Date.parse(saved.observedAt||''))||!Number.isFinite(saved.latitude)
     ||!Number.isFinite(saved.longitude))throw Error('HOSTED_MOTION_RESPONSE_DENIED');
    if(signal?.aborted)break;
    await gps.sendFix(saved);
   }else{
    const saved=await client({action:'PHONE',...authority},{signal});
    if(!saved||saved.recorded!==true||saved.source!=='MOBILE')throw Error('HOSTED_MOTION_RESPONSE_DENIED');
   }
   ticks++;
  }
  // Keep this generation valid while the final GT06 packet crosses Traccar
  // and the bridge. Releasing immediately after socket.write would race it.
  if(!signal?.aborted&&now()<deadline)await sleep(deadline-now(),signal);
  status='STOPPED';
 }catch(error){
  code=resultCode(error);status=signal?.aborted?'STOPPED':'PAUSED';
  if(status==='PAUSED')onFailure(code);
 }finally{
  gps?.close();
  if(lease){
   try{await client({action:'STOP',target,leaseId:lease.leaseId,epoch:lease.epoch});}
   catch(error){if(status!=='PAUSED'){status='STOP_UNCONFIRMED';code=resultCode(error);onFailure(code);}}
  }
 }
 return {target,status,ticks,...(code?{code}:{})};
}

export async function runHostedMotionCycle({client,openGps=openPrivateGt06,signal,targets=HOSTED_MOTION_TARGETS,
 now=Date.now,sleep=(ms,abort)=>delay(ms,undefined,{signal:abort}),seconds=CYCLE_SECONDS}={}){
 if(!Array.isArray(targets)||targets.length<1||targets.length>HOSTED_MOTION_TARGETS.length
  ||new Set(targets).size!==targets.length||targets.some(target=>!HOSTED_MOTION_TARGETS.includes(target)))
  throw Error('HOSTED_MOTION_TARGET_DENIED');
 const controller=new AbortController();
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();
 try{
  const results=await Promise.all(targets.map(async(target,index)=>{
   try{
    if(index)await sleep(index*1500,controller.signal);
    if(controller.signal.aborted)return {target,status:'STOPPED',ticks:0};
    return await runHostedMotionTarget(target,{client,openGps,now,sleep,signal:controller.signal,seconds,
     onFailure:code=>{if(code==='DEMO_HOSTED_DISABLED'||code==='DEMO_HOSTED_AUTH_DENIED')controller.abort();}});
   }catch(error){return {target,status:'PAUSED',ticks:0,code:resultCode(error)};}
  }));
  return {results,killed:controller.signal.aborted};
 }finally{signal?.removeEventListener('abort',abort);}
}

async function main(){
 const mode=process.argv[2];if(!['--preflight','--run'].includes(mode))throw Error('HOSTED_MOTION_MODE_DENIED');
 const config=assertHostedMotionWorkerEnvironment(process.env);
 if(mode==='--preflight'){
  console.log(JSON.stringify({event:'hosted_motion_preflight',enabled:config.enabled,deploymentAuthorized:false}));return;
 }
 const controller=new AbortController();
 process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
 if(!config.enabled){
  console.log(JSON.stringify({event:'hosted_motion_inert'}));
  await new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true}));return;
 }
 const client=hostedMotionClient(config);
 while(!controller.signal.aborted){
  const cycle=await runHostedMotionCycle({client,signal:controller.signal});
  const counts=Object.fromEntries(['STOPPED','PAUSED','BUSY','REAL','STOP_UNCONFIRMED'].map(state=>
   [state,cycle.results.filter(row=>row.status===state).length]));
  console.log(JSON.stringify({event:'hosted_motion_cycle',counts,killed:cycle.killed}));
  if(cycle.killed){
   // Stay inert until an operator recreates the container. Docker's restart
   // policy must not hammer an app whose kill/auth control just refused us.
   await new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true}));break;
  }
  try{await delay(30000,undefined,{signal:controller.signal});}catch{break;}
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await main();}catch(error){
  console.error(JSON.stringify({event:'hosted_motion_exit',code:resultCode(error)}));process.exitCode=1;
 }
}
