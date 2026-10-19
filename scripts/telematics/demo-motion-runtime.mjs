import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {demoMotionSignature,DEMO_MOTION_PATH} from '../../src/lib/demo-motion-auth.js';

export const motionTargetNames=Object.freeze(['company-truck','personal-truck']);
const routes={
 'company-truck':[[9.031,38.748],[9.031,38.757],[9.026,38.757],[9.026,38.748]],
 'personal-truck':[[9.03,38.76],[9.03,38.768],[9.025,38.768],[9.025,38.76]]
};
const meters=(a,b)=>Math.hypot((b[0]-a[0])*111195,(b[1]-a[1])*111195*Math.cos((a[0]+b[0])*Math.PI/360));
/** A bounded fictional urban circuit at20kph, not a surveyed real truck route. */
export function demoRouteFix(target,elapsedSeconds){
 const route=routes[target];if(!route||!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw Error('DEMO_ROUTE_INVALID');
 const segments=route.map((point,index)=>({a:point,b:route[(index+1)%route.length],length:meters(point,route[(index+1)%route.length])}));
 let distance=elapsedSeconds*(20000/3600)%segments.reduce((sum,segment)=>sum+segment.length,0);
 for(const segment of segments){if(distance<=segment.length)return {latitude:segment.a[0]+(segment.b[0]-segment.a[0])*distance/segment.length,
  longitude:segment.a[1]+(segment.b[1]-segment.a[1])*distance/segment.length,speedKph:20,ignition:true};distance-=segment.length;}
 throw Error('DEMO_ROUTE_INVALID');
}
export function demoMotionClient({url='http://127.0.0.1:3100'+DEMO_MOTION_PATH,secret,nodeEnv=process.env.NODE_ENV,fetch:request=fetch,now=Date.now}={}){
 const endpoint=new URL(url);
 if(nodeEnv==='production'||endpoint.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)||endpoint.port!=='3100'
  ||endpoint.pathname!==DEMO_MOTION_PATH||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!/^[a-f0-9]{64}$/.test(secret||''))throw Error('REMOTE_DEMO_RUNNER_REFUSED');
 return async command=>{
  const body=JSON.stringify(command),issuedAt=new Date(now()).toISOString(),nonce=randomUUID();
  const response=await request(endpoint,{method:'POST',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(10000),
   headers:{'Content-Type':'application/json','x-demo-issued-at':issuedAt,'x-demo-nonce':nonce,'x-demo-signature':demoMotionSignature(secret,body,issuedAt,nonce)},body});
  const value=await response.json();if(!response.ok||value?.ok!==true){const code=/^DEMO_[A-Z_]{1,60}$/.test(value?.code||'')?value.code:'DEMO_UNAVAILABLE';throw Error(code);}
  return value.data;
 };
}
/** The runner receives only a narrow signed demo port, never a Supabase key. */
export async function runDemoMotion({request,simulate,seconds=60,resume=false,signal,onState=()=>{},now=Date.now,
 sleep=(ms,abort)=>delay(ms,undefined,{signal:abort}),targets=motionTargetNames}={}){
 if(!Number.isInteger(seconds)||seconds<10||seconds>3600||!Array.isArray(targets)||!targets.length||targets.length>2
  ||new Set(targets).size!==targets.length||targets.some(target=>!motionTargetNames.includes(target)))throw Error('DEMO_RUNNER_INPUT_INVALID');
 const records=[],started=now(),deadline=started+seconds*1000;
 const state=()=>onState(records.map(({target,lease,status,ticks})=>({target,lease,status,ticks})));
 try{
  for(const target of targets){
   if(signal?.aborted)break;
   await request({action:'CONFIGURE',target});
   const lease=await request({action:resume?'RESUME':'START',target,seconds});
   if(!lease||lease.state!=='RUNNING'||!['GPS','MOBILE'].includes(lease.source)||!Number.isSafeInteger(lease.epoch)
    ||!/^[a-f0-9-]{36}$/i.test(lease.leaseId)||!Number.isFinite(Date.parse(lease.expiresAt)))throw Error('DEMO_RESPONSE_INVALID');
   records.push({target,lease,status:'RUNNING',ticks:0});state();
  }
  // GT06 fix time has one-second precision; no capture can precede the new epoch.
  if(records.length&&!signal?.aborted)await sleep(1100,signal);
  const outcomes=await Promise.allSettled(records.map(async record=>{
   const {target,lease}=record,controller=new AbortController();
   const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
   const authority={target,leaseId:lease.leaseId,epoch:lease.epoch};
   try{
    if(lease.source==='GPS'){
     await simulate({imei:target==='company-truck'?'990000000000001':'990000000000002',durationMs:Math.max(1,deadline-now()),signal:controller.signal,
      beforeReport:async()=>{
       if(controller.signal.aborted||deadline-now()<1000)return null;
       const fix=demoRouteFix(target,(now()-started)/1000);
       try{const saved=await request({action:'GPS',...authority,latitude:fix.latitude,longitude:fix.longitude});
        if(controller.signal.aborted)return null;record.ticks++;state();return {...fix,...saved};}
       catch(error){
        // A bounded run may reach its deadline while the final reservation is
        // in flight. End normally; an earlier denial remains a real pause.
        if(now()>=deadline){record.status='STOPPED';state();controller.abort();return null;}
        record.status='PAUSED';state();controller.abort();throw error;
       }
      }});
    }else{
     while(!controller.signal.aborted&&now()<deadline){
      const fix=demoRouteFix(target,(now()-started)/1000);
      await request({action:'PHONE',...authority,latitude:fix.latitude,longitude:fix.longitude});
      if(controller.signal.aborted)break;record.ticks++;state();
      const remaining=deadline-now();if(remaining<=0)break;
      await sleep(Math.min(5000,remaining),controller.signal);
     }
    }
    if(record.status==='RUNNING')record.status='STOPPED';state();
   }catch(error){record.status=controller.signal.aborted||signal?.aborted?'STOPPED':'PAUSED';state();if(!controller.signal.aborted&&!signal?.aborted)throw error;}
   finally{controller.abort();signal?.removeEventListener('abort',abort);}
  }));
  return {targets:records.map(({target,status,ticks})=>({target,status,ticks})),failed:outcomes.some(result=>result.status==='rejected')||records.some(record=>record.status==='PAUSED')};
 }finally{
  for(const record of records){
   // A stale STOP cannot clear REAL or stop a later generation.
   try{await request({action:'STOP',target:record.target,leaseId:record.lease.leaseId,epoch:record.lease.epoch});}
   catch{record.status='STOP_UNCONFIRMED';}
   if(record.status==='RUNNING')record.status='STOPPED';
  }
  state();
 }
}
