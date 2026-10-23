// Finite, opt-in local scheduler for the database-allowlisted demo-world worker.
// Usage: node --env-file=.env.local scripts/demo-world-local-supervisor.mjs start [seconds] [intervalSeconds]
//        node scripts/demo-world-local-supervisor.mjs status|stop
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {validateDemoWorldManifest} from '../src/lib/demo-world-planner.mjs';
import {advanceDemoWorld} from '../src/lib/demo-world-advance.js';
import {localDemoSupervisorConfig,localDemoSupervisorDuration,localDemoSupervisorProcessAlive,
  localDemoSupervisorCanRecover,localDemoSupervisorPreflight,runLocalDemoSupervisor} from '../src/lib/demo-world-local-supervisor.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directory=path.join(root,'.local/demo-world-supervisor');
const statePath=path.join(directory,'state.json'),spawnPath=path.join(directory,'spawn.json'),
  lockPath=path.join(directory,'runner.lock');
const [action='status',secondsArg='120',intervalArg='30',runId]=process.argv.slice(2);
const readState=async()=>{try{return JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw Error('DEMO_WORLD_LOCAL_STATE_INVALID');}};
const readSpawn=async()=>{try{return JSON.parse(await readFile(spawnPath,'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw Error('DEMO_WORLD_LOCAL_SPAWN_STATE_INVALID');}};
async function writeState(state){
  const temp=statePath+`.${process.pid}.tmp`;
  await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,statePath);
}
function client(){
  const {url,key}=localDemoSupervisorConfig(process.env);
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
async function validateFixture(){
  const fixture=JSON.parse(await readFile(path.join(root,'resources/fixtures/managed-market.json'),'utf8'));
  const manifest=JSON.parse(await readFile(path.join(root,'resources/fixtures/demo-world-scenarios.json'),'utf8'));
  validateDemoWorldManifest(manifest,fixture);
}

await mkdir(directory,{recursive:true,mode:0o700});
if(action==='status'){
  if(process.argv.length!==3)throw Error('DEMO_WORLD_LOCAL_USAGE_INVALID');
  const state=await readState(),spawn=await readSpawn();
  const running=state?.state==='RUNNING'?localDemoSupervisorProcessAlive(state.pid)
    :state?.state==='STARTING'&&spawn?.runId===state.runId&&localDemoSupervisorProcessAlive(spawn.pid);
  const stale=state&&['STARTING','RUNNING'].includes(state.state)&&!running
    &&localDemoSupervisorCanRecover(state,spawn);
  console.log(JSON.stringify({event:'demo_world_local_status',state:state?.state||'OFF',running:!!running,
    ticks:state?.ticks||0,completed:state?.completed||0,sharingCompleted:state?.sharingCompleted||0,
    stale:!!stale,failureCode:state?.failureCode||null,localOnly:true}));
}else if(action==='stop'){
  if(process.argv.length!==3)throw Error('DEMO_WORLD_LOCAL_USAGE_INVALID');
  const state=await readState();
  if(state?.runId&&['STARTING','RUNNING'].includes(state.state)){
    await writeFile(path.join(directory,`stop-${state.runId}`),state.runId,{mode:0o600});
  }
  console.log(JSON.stringify({event:'demo_world_local_stop_requested',asynchronous:true,
    databaseControlUnchanged:true,localOnly:true}));
}else if(action==='start'){
  if(process.argv.length>5)throw Error('DEMO_WORLD_LOCAL_USAGE_INVALID');
  const seconds=Number(secondsArg),intervalSeconds=Number(intervalArg);
  localDemoSupervisorDuration(seconds,intervalSeconds);
  await validateFixture();
  const db=client();await localDemoSupervisorPreflight(db);
  const id=randomUUID();
  try{await mkdir(lockPath,{mode:0o700});}catch(error){
    if(error?.code!=='EEXIST')throw Error('DEMO_WORLD_LOCAL_RUNNER_LOCKED');
    const previous=await readState(),spawn=await readSpawn();
    const owner=await readFile(path.join(lockPath,'owner'),'utf8').catch(()=>null);
    if(owner!==previous?.runId||!localDemoSupervisorCanRecover(previous,spawn)){
      throw Error('DEMO_WORLD_LOCAL_RUNNER_LOCKED');
    }
    const stalePath=path.join(directory,`stale-${previous.runId}-${id}`);
    await rename(lockPath,stalePath);await rm(stalePath,{recursive:true,force:true});
    try{await mkdir(lockPath,{mode:0o700});}catch{throw Error('DEMO_WORLD_LOCAL_RUNNER_LOCKED');}
  }
  let child=null;
  try{
    await writeFile(path.join(lockPath,'owner'),id,{flag:'wx',mode:0o600});
    await writeState({state:'STARTING',runId:id,pid:null,ticks:0,completed:0,sharingCompleted:0,
      startedAt:new Date().toISOString()});
    const environment=Object.fromEntries(['PATH','TMPDIR','LANG','LC_ALL','NODE_ENV','SUPABASE_SEED_URL',
      'NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SEED_SERVICE_ROLE_KEY','SUPABASE_SERVICE_ROLE_KEY']
      .filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
    child=spawn(process.execPath,[fileURLToPath(import.meta.url),'run',String(seconds),String(intervalSeconds),id],
      {cwd:root,env:environment,detached:true,stdio:'ignore'});
    const spawnOutcome=new Promise(resolve=>{
      child.once('spawn',()=>resolve(true));child.once('error',()=>resolve(false));
    });
    if(!Number.isSafeInteger(child.pid)||child.pid<1)throw Error('DEMO_WORLD_LOCAL_SPAWN_FAILED');
    await writeFile(spawnPath,JSON.stringify({runId:id,pid:child.pid}),{mode:0o600});
    if(!await spawnOutcome)throw Error('DEMO_WORLD_LOCAL_SPAWN_FAILED');
    child.unref();
  }catch(error){
    if(child?.pid&&localDemoSupervisorProcessAlive(child.pid))child.kill('SIGTERM');
    await writeState({state:'PAUSED',runId:id,pid:null,ticks:0,completed:0,sharingCompleted:0,
      failureCode:'DEMO_WORLD_LOCAL_SPAWN_FAILED',updatedAt:new Date().toISOString()});
    await rm(lockPath,{recursive:true,force:true});throw Error('DEMO_WORLD_LOCAL_SPAWN_FAILED');
  }
  console.log(JSON.stringify({event:'demo_world_local_started',seconds,intervalSeconds,localOnly:true,
    databaseControlUnchanged:true}));
}else if(action==='run'){
  if(process.argv.length!==6||!/^[-a-f0-9]{36}$/.test(runId||''))throw Error('DEMO_WORLD_LOCAL_USAGE_INVALID');
  const seconds=Number(secondsArg),intervalSeconds=Number(intervalArg);
  localDemoSupervisorDuration(seconds,intervalSeconds);
  const saved=await readState();if(saved?.state!=='STARTING'||saved.runId!==runId)throw Error('DEMO_WORLD_LOCAL_RUNNER_LOCKED');
  const controller=new AbortController(),stopPath=path.join(directory,`stop-${runId}`);
  const abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
  const poll=setInterval(()=>{void readFile(stopPath,'utf8').then(value=>{if(value===runId)abort();}).catch(()=>{});},200);
  let latest={ticks:0,completed:0,sharingCompleted:0};
  try{
    if(await readFile(stopPath,'utf8').catch(()=>null)===runId)abort();
    const db=client();await validateFixture();await localDemoSupervisorPreflight(db);
    await writeState({state:'RUNNING',runId,pid:process.pid,...latest,startedAt:new Date().toISOString()});
    const result=await runLocalDemoSupervisor({seconds,intervalSeconds,signal:controller.signal,
      advance:()=>advanceDemoWorld(db),onTick:async state=>{
        latest=state;
        await writeState({state:'RUNNING',runId,pid:process.pid,...state,updatedAt:new Date().toISOString()});
      }});
    await writeState({state:'STOPPED',runId,pid:process.pid,...result,updatedAt:new Date().toISOString()});
  }catch(error){
    await writeState({state:'PAUSED',runId,pid:process.pid,...latest,
      failureCode:/^DEMO_[A-Z_]+$/.test(error?.message||'')?error.message:'DEMO_WORLD_LOCAL_ADVANCE_FAILED',
      updatedAt:new Date().toISOString()});
  }finally{
    clearInterval(poll);process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);
    await rm(stopPath,{force:true});await rm(lockPath,{recursive:true,force:true});
    const spawned=await readSpawn();if(spawned?.runId===runId)await rm(spawnPath,{force:true});
  }
}else throw Error('DEMO_WORLD_LOCAL_USAGE_INVALID');
