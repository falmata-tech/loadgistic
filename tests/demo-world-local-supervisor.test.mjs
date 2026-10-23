import assert from 'node:assert/strict';
import test from 'node:test';
import {
  localDemoSupervisorCanRecover,localDemoSupervisorConfig,localDemoSupervisorDuration,
  localDemoSupervisorProcessAlive,localDemoSupervisorPreflight,
  runLocalDemoSupervisor
} from '../src/lib/demo-world-local-supervisor.js';

const local={SUPABASE_SEED_URL:'http://127.0.0.1:55321',SUPABASE_SEED_SERVICE_ROLE_KEY:'x'.repeat(32)};

test('the supervisor accepts only the fixed local API and a bounded finite schedule',()=>{
  assert.deepEqual(localDemoSupervisorConfig(local),{url:'http://127.0.0.1:55321',key:'x'.repeat(32)});
  assert.throws(()=>localDemoSupervisorConfig({...local,SUPABASE_SEED_URL:'https://loadgistic.example'}),
    /REMOTE_FIXTURE_IMPORT_REFUSED/);
  assert.throws(()=>localDemoSupervisorConfig({...local,NODE_ENV:'production'}),/PRODUCTION_FIXTURE_IMPORT_REFUSED/);
  assert.throws(()=>localDemoSupervisorConfig({...local,SUPABASE_SEED_SERVICE_ROLE_KEY:''}),/CREDENTIAL_MISSING/);
  assert.deepEqual(localDemoSupervisorDuration(8,3),{durationMs:8000,intervalMs:3000});
  for(const [seconds,interval] of [[0,3],[3601,3],[8,1],[3600,2],[8,301]]){
    assert.throws(()=>localDemoSupervisorDuration(seconds,interval),/DURATION_INVALID/);
  }
});

test('status treats a sandbox permission denial as an existing process, not a dead one',()=>{
  assert.equal(localDemoSupervisorProcessAlive(42,()=>{throw Object.assign(Error('denied'),{code:'EPERM'});}),true);
  assert.equal(localDemoSupervisorProcessAlive(42,()=>{throw Object.assign(Error('missing'),{code:'ESRCH'});}),false);
  assert.equal(localDemoSupervisorProcessAlive(null),false);
});

test('stale recovery cannot displace a live or newly starting run',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const state={state:'STARTING',runId:id,pid:null,startedAt:'2026-10-22T00:00:00.000Z'};
  const spawn={runId:id,pid:42},dead=()=>{throw Object.assign(Error('missing'),{code:'ESRCH'});};
  assert.equal(localDemoSupervisorCanRecover(state,spawn,Date.parse(state.startedAt)+14_999,dead),false);
  assert.equal(localDemoSupervisorCanRecover(state,spawn,Date.parse(state.startedAt)+15_000,dead),true);
  assert.equal(localDemoSupervisorCanRecover(state,spawn,Date.parse(state.startedAt)+60_000,()=>{}),false);
  assert.equal(localDemoSupervisorCanRecover(state,{...spawn,runId:'other'},Date.parse(state.startedAt)+60_000,dead),false);
  assert.equal(localDemoSupervisorCanRecover({...state,state:'PAUSED'},spawn,Date.parse(state.startedAt),dead),true);
});

test('the database must explicitly enable an exact bound scenario',async()=>{
  const client=(capacityEnabled,sharingEnabled,bound=true)=>({rpc:async name=>({data:name==='demo_world_status'
    ?{enabled:capacityEnabled}:{enabled:sharingEnabled,target_bound:bound},error:null})});
  await assert.rejects(()=>localDemoSupervisorPreflight(client(false,false)),/CONTROLS_OFF/);
  await assert.rejects(()=>localDemoSupervisorPreflight(client(false,true,false)),/SHARE_UNBOUND/);
  assert.deepEqual(await localDemoSupervisorPreflight(client(true,false)),
    {capacityEnabled:true,sharingEnabled:false});
  await assert.rejects(()=>localDemoSupervisorPreflight({rpc:async()=>({data:null,error:{message:'secret'}})}),
    /STATUS_UNAVAILABLE/);
});

test('two timed ticks keep aggregate results and stop on the finite deadline',async()=>{
  let time=0,callCount=0;
  const states=[];
  const result=await runLocalDemoSupervisor({seconds:5,intervalSeconds:3,
    signal:new AbortController().signal,now:()=>time,
    sleep:async ms=>{time+=ms;},
    advance:async()=>{callCount++;return {completed:callCount===1?2:0,business_share_completed:callCount===2?1:0};},
    onTick:async state=>states.push(state)});
  assert.deepEqual(result,{ticks:2,completed:2,sharingCompleted:1,stopped:false});
  assert.deepEqual(states.map(state=>state.ticks),[1,2]);
  assert.equal(time,5000);
});

test('stop suppresses the next tick and a failed tick cannot report success',async()=>{
  const controller=new AbortController();let calls=0;
  const stopped=await runLocalDemoSupervisor({seconds:20,intervalSeconds:3,signal:controller.signal,
    advance:async()=>{calls++;return {completed:1,business_share_completed:0};},
    onTick:async()=>controller.abort()});
  assert.deepEqual(stopped,{ticks:1,completed:1,sharingCompleted:0,stopped:true});
  assert.equal(calls,1);
  await assert.rejects(()=>runLocalDemoSupervisor({seconds:5,intervalSeconds:2,
    signal:new AbortController().signal,advance:async()=>({completed:1,business_share_completed:NaN}),
    onTick:async()=>{}}),/RESULT_INVALID/);
});
