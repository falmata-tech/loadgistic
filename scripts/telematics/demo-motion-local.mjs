// Separate opt-in local operator tool. This process never receives/discovers an
// application/database credential. Its HMAC capability reaches only exact demos.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {demoMotionClient,runDemoMotion} from './demo-motion-runtime.mjs';
import {simulate} from './simulator.mjs';
const directory=path.resolve(import.meta.dirname,'../../.local/telematics/demo-motion'),statePath=path.join(directory,'state.json'),lockPath=path.join(directory,'runner.lock');
const action=process.argv[2]||'status',seconds=Number(process.argv[3]||60),runId=process.argv[4];
const request=()=>demoMotionClient({secret:process.env.LOADGISTIC_DEMO_MOTION_SECRET,url:process.env.LOADGISTIC_DEMO_MOTION_URL});
const readState=async()=>{try{return JSON.parse(await readFile(statePath,'utf8'));}catch{return null;}};
async function writeState(value){const temporary=statePath+'.'+process.pid+'.tmp';await writeFile(temporary,JSON.stringify(value),{mode:0o600});await rename(temporary,statePath);}
function isAlive(pid){if(!Number.isSafeInteger(pid)||pid<2)return false;try{process.kill(pid,0);return true;}catch{return false;}}
await mkdir(directory,{recursive:true,mode:0o700});
if(action==='status'){
 const saved=await readState();console.log(JSON.stringify({event:'demo_runner_state',state:saved?.state||'OFF',running:!!saved&&isAlive(saved.pid)&&saved.state==='RUNNING',targets:(saved?.targets||[]).map(({target,status,ticks})=>({target,status,ticks}))}));
}else if(action==='stop'){
 const saved=await readState();
 if(saved?.runId){await writeFile(path.join(directory,'stop-'+saved.runId),saved.runId,{mode:0o600});
  const call=request();for(const item of saved.targets||[])if(item.lease)await call({action:'STOP',target:item.target,leaseId:item.lease.leaseId,epoch:item.lease.epoch});}
 console.log(JSON.stringify({event:'demo_runner_stop_requested',resetRecords:false}));
}else if(action==='start'||action==='resume'){
 request();if(!Number.isInteger(seconds)||seconds<10||seconds>3600)throw Error('DEMO_DURATION_INVALID');
 const previous=await readState();if(previous&&isAlive(previous.pid)&&previous.state==='RUNNING')throw Error('DEMO_RUNNER_ALREADY_ACTIVE');
 try{await mkdir(lockPath);}catch{throw Error('DEMO_RUNNER_LOCKED');}
 const id=randomUUID();await writeState({state:'STARTING',runId:id,pid:null,targets:[]});
 // Pass only harmless runtime variables plus the scoped demo credential.
 const environment=Object.fromEntries(['PATH','TMPDIR','LANG','LC_ALL','NODE_ENV','LOADGISTIC_DEMO_MOTION_SECRET','LOADGISTIC_DEMO_MOTION_URL'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),action==='resume'?'run-resume':'run',String(seconds),id],{cwd:path.resolve(import.meta.dirname,'../..'),env:environment,detached:true,stdio:'ignore'});child.unref();
 console.log(JSON.stringify({event:'demo_runner_started',seconds,production:false,automaticSourceChanges:false}));
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
  await write;await writeState({state:result.failed?'PAUSED':'STOPPED',runId,pid:process.pid,targets,updatedAt:new Date().toISOString()});
 }catch{await write.catch(()=>{});await writeState({state:controller.signal.aborted?'STOPPED':'PAUSED',runId,pid:process.pid,targets,updatedAt:new Date().toISOString()});}
 finally{clearInterval(timer);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await rm(stopPath,{force:true});await rm(lockPath,{recursive:true,force:true});}
}else throw Error('DEMO_RUNNER_ACTION_INVALID');
