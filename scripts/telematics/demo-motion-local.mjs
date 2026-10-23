// Separate opt-in local operator tool. This process never receives/discovers an
// application/database credential. Its HMAC capability reaches only exact demos.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {demoMotionClient,runDemoMotion,demoProcessAlive,motionTargetNames,assertDemoRunnerTargetsAvailable,demoFailureCode} from './demo-motion-runtime.mjs';
import {simulate} from './simulator.mjs';
const directory=path.resolve(import.meta.dirname,'../../.local/telematics/demo-motion'),statePath=path.join(directory,'state.json'),lockPath=path.join(directory,'runner.lock');
const action=process.argv[2]||'status',seconds=Number(process.argv[3]||60),runId=process.argv[4];
const request=()=>demoMotionClient({secret:process.env.LOADGISTIC_DEMO_MOTION_SECRET,url:process.env.LOADGISTIC_DEMO_MOTION_URL});
const readState=async()=>{try{return JSON.parse(await readFile(statePath,'utf8'));}catch{return null;}};
async function writeState(value){const temporary=statePath+'.'+process.pid+'.tmp';await writeFile(temporary,JSON.stringify(value),{mode:0o600});await rename(temporary,statePath);}
await mkdir(directory,{recursive:true,mode:0o700});
if(action==='status'){
 const saved=await readState(),call=request();
 const backendTargets=await Promise.all(motionTargetNames.map(async target=>{
  const value=await call({action:'STATUS',target}),expiry=Date.parse(value?.expiresAt);
  return {target,state:value?.state||'UNCONFIGURED',source:['GPS','MOBILE'].includes(value?.source)?value.source:null,
   remainingSeconds:Number.isFinite(expiry)?Math.max(0,Math.ceil((expiry-Date.now())/1000)):null,
   active:value?.state==='RUNNING'&&(!Number.isFinite(expiry)||expiry>Date.now())};
 }));
 const running=!!saved&&demoProcessAlive(saved.pid)&&saved.state==='RUNNING';
 console.log(JSON.stringify({event:'demo_runner_state',state:saved?.state||'OFF',running,
  failureCode:saved?.failureCode||null,backendActive:backendTargets.some(item=>item.active),
  targets:(saved?.targets||[]).map(({target,status,ticks,failureCode})=>({target,status,ticks,...(failureCode?{failureCode}:{})})),backendTargets}));
}else if(action==='stop'){
 const saved=await readState();
 if(saved?.runId){await writeFile(path.join(directory,'stop-'+saved.runId),saved.runId,{mode:0o600});
  const call=request();for(const item of saved.targets||[])if(item.lease)await call({action:'STOP',target:item.target,leaseId:item.lease.leaseId,epoch:item.lease.epoch});}
 console.log(JSON.stringify({event:'demo_runner_stop_requested',resetRecords:false}));
}else if(action==='start'||action==='resume'){
 const call=request();if(!Number.isInteger(seconds)||seconds<10||seconds>3600)throw Error('DEMO_DURATION_INVALID');
 const previous=await readState();if(previous&&demoProcessAlive(previous.pid)&&previous.state==='RUNNING')throw Error('DEMO_RUNNER_ALREADY_ACTIVE');
 // This read-only preflight must happen before replacing the last recovery state.
 await assertDemoRunnerTargetsAvailable(call);
 try{await mkdir(lockPath);}catch{throw Error('DEMO_RUNNER_LOCKED');}
 const id=randomUUID();await writeState({state:'STARTING',runId:id,pid:null,targets:[]});
 // Pass only harmless runtime variables plus the scoped demo credential.
 const environment=Object.fromEntries(['PATH','TMPDIR','LANG','LC_ALL','NODE_ENV','LOADGISTIC_DEMO_MOTION_SECRET','LOADGISTIC_DEMO_MOTION_URL','LOADGISTIC_DEMO_GPS_COHORT'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),action==='resume'?'run-resume':'run',String(seconds),id],{cwd:path.resolve(import.meta.dirname,'../..'),env:environment,detached:true,stdio:'ignore'});child.unref();
 console.log(JSON.stringify({event:'demo_runner_requested',seconds,production:false,automaticSourceChanges:false}));
}else if(action==='run'||action==='run-resume'){
 if(!/^[a-f0-9-]{36}$/i.test(runId||''))throw Error('DEMO_RUNNER_INPUT_INVALID');
 const saved=await readState();if(saved?.runId!==runId||saved.state!=='STARTING')throw Error('DEMO_RUNNER_LOCKED');
 const controller=new AbortController(),stopPath=path.join(directory,'stop-'+runId);let targets=[],write=Promise.resolve();
 const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 const timer=setInterval(()=>{void readFile(stopPath,'utf8').then(value=>{if(value===runId)stop();}).catch(()=>{});},250);
 try{
  await writeState({state:'RUNNING',runId,pid:process.pid,targets:[],startedAt:new Date().toISOString()});
  const result=await runDemoMotion({request:request(),simulate,seconds,resume:action==='run-resume',signal:controller.signal,onState:value=>{
   targets=value;write=write.then(()=>writeState({state:'RUNNING',runId,pid:process.pid,targets,updatedAt:new Date().toISOString()}));
  }});
  await write;await writeState({state:result.failed?'PAUSED':'STOPPED',failureCode:result.failureCode||null,runId,pid:process.pid,targets,updatedAt:new Date().toISOString()});
 }catch(error){await write.catch(()=>{});await writeState({state:controller.signal.aborted?'STOPPED':'PAUSED',failureCode:demoFailureCode(error),runId,pid:process.pid,targets,updatedAt:new Date().toISOString()});}
 finally{clearInterval(timer);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await rm(stopPath,{force:true});await rm(lockPath,{recursive:true,force:true});}
}else throw Error('DEMO_RUNNER_ACTION_INVALID');
