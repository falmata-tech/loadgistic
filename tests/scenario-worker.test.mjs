import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,lstat,writeFile,chmod,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {scenarioWorkerConfiguration,runScenarioWorkerTick,runScenarioWorker,
 writeScenarioHeartbeat,scenarioWorkerHealth,SCENARIO_HEARTBEAT_DIRECTORY} from '../infra/telematics/scenario-worker.mjs';
import {createDemoWorldSignature,DEMO_CAPACITY_ADVANCE_PATH,
 DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER} from '../src/lib/demo-world-worker-auth.js';

const origin='https://loadgistic.example',secret='a'.repeat(64),stamp=1790000000000;
const environment={NODE_ENV:'production',LOADGISTIC_SCENARIO_WORKER_ENABLED:'true',
 LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH:'false',LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:origin,
 LOADGISTIC_DEMO_WORLD_SITE_ID:randomUUID(),DEMO_CAPACITY_WORKER_SECRET:secret};
const result={ok:true,accepted:1,completed:1,skipped:0,failed:0,paused:0,paused_target_count:0,database_enabled:true,catalog_version:2};
const config=()=>scenarioWorkerConfiguration(environment);

test('scenario worker is inert by default/kill and preflight opens no runtime',()=>{
 assert.deepEqual(scenarioWorkerConfiguration({}),{enabled:false});
 assert.deepEqual(scenarioWorkerConfiguration({...environment,LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH:'true'}),{enabled:false});
 assert.deepEqual(scenarioWorkerConfiguration({...environment,LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH:undefined}),{enabled:false});
 const check=spawnSync(process.execPath,['infra/telematics/scenario-worker.mjs','--preflight'],{
  cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,NODE_ENV:'production'},encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 assert.deepEqual(JSON.parse(check.stdout),{event:'demo_scenario_preflight',enabled:false,deploymentAuthorized:false});
});

test('enabled config accepts only its separate Capacity key and exact HTTPS origin',()=>{
 assert.equal(config().secret,secret);
 for(const patch of [{NODE_ENV:'development'},{LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:'https://other.invalid/path'},
  {LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:'https://user:pass@loadgistic.example'},
  {LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:'http://loadgistic.example'},{LOADGISTIC_DEMO_WORLD_SITE_ID:'bad'},
  {DEMO_CAPACITY_WORKER_SECRET:undefined,DEMO_WORLD_WORKER_SECRET:secret}]){
  assert.throws(()=>scenarioWorkerConfiguration({...environment,...patch}),/DEMO_SCENARIO_CONFIG_DENIED/);
 }
 for(const key of ['DEMO_WORLD_WORKER_SECRET','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SEED_SERVICE_ROLE_KEY',
  'GATEWAY_SECRET','SYNTHETIC_GATEWAY_SECRET','HOSTED_DEMO_MOTION_SECRET','TELEMATICS_GATEWAYS_JSON']){
  assert.throws(()=>scenarioWorkerConfiguration({...environment,[key]:'different-broad-authority'}),/DEMO_SCENARIO_CONFIG_DENIED/,key);
 }
});

test('one tick signs only the fast purpose/body/path and strips private response fields',async()=>{
 const calls=[];
 const tick=await runScenarioWorkerTick(config(),{now:()=>stamp,fetchImpl:async(url,options)=>{
  calls.push({url,options});return Response.json({...result,email:'private@example.invalid',latitude:9,deviceId:'PRIVATE'});
 }});
 const [{url,options}]=calls;
 assert.equal(url,origin+DEMO_CAPACITY_ADVANCE_PATH);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
 assert.deepEqual(JSON.parse(options.body),{limit:1});assert.equal(options.headers.Authorization,undefined);
 assert.equal(options.headers[DEMO_WORLD_TIMESTAMP_HEADER],String(stamp));
 assert.equal(options.headers[DEMO_WORLD_SIGNATURE_HEADER],createDemoWorldSignature({timestamp:String(stamp),url,purpose:'capacity-advance',body:options.body},environment));
 assert.throws(()=>createDemoWorldSignature({timestamp:String(stamp),url,purpose:'advance',body:options.body},environment),/DEMO_WORLD_TARGET_INVALID/);
 assert.deepEqual(tick,{enabled:true,accepted:1,completed:1,skipped:0,failed:0,paused:0,paused_target_count:0,database_enabled:true,catalog_version:2});
 assert.doesNotMatch(JSON.stringify(tick),/private@|latitude|deviceId|PRIVATE/);
});

test('transport uses a 20-second timeout with no ambiguous-write retry',async()=>{
 const original=AbortSignal.timeout,calls=[],controller=new AbortController();
 AbortSignal.timeout=ms=>{calls.push(ms);return controller.signal;};
 let attempts=0;
 try{
  await assert.rejects(runScenarioWorkerTick(config(),{now:()=>stamp,fetchImpl:async()=>{
   attempts++;throw Error('private endpoint or secret');
  }}),/DEMO_SCENARIO_TRANSPORT_UNAVAILABLE/);
 }finally{AbortSignal.timeout=original;}
 assert.deepEqual(calls,[20000]);assert.equal(attempts,1);
});

test('body/count bounds reject malformed, oversized and incoherent results',async()=>{
 for(const reply of [{...result,accepted:2},{...result,accepted:6},{...result,paused:2},{...result,catalog_version:1},
  {...result,database_enabled:false},{...result,completed:'1'},{...result,paused_target_count:6},null]){
  await assert.rejects(runScenarioWorkerTick(config(),{now:()=>stamp,fetchImpl:async()=>Response.json(reply)}),/DEMO_SCENARIO_RESPONSE_DENIED/);
 }
 for(const reply of [new Response('not json'),new Response('x'.repeat(8193)),
  new Response('{}',{headers:{'content-length':'9000'}})]){
  await assert.rejects(runScenarioWorkerTick(config(),{now:()=>stamp,fetchImpl:async()=>reply}),/DEMO_SCENARIO_RESPONSE_DENIED/);
 }
});

test('30-second loop never overlaps ticks or retries a pending request',async()=>{
 const controller=new AbortController(),calls=[],delays=[];let clock=stamp,active=0,maxActive=0,release,entered;
 const gate=new Promise(resolve=>{release=resolve;}),firstEntered=new Promise(resolve=>{entered=resolve;});
 const running=runScenarioWorker(config(),{signal:controller.signal,now:()=>clock,
  fetchImpl:async()=>{
   calls.push(clock);active++;maxActive=Math.max(maxActive,active);
   if(calls.length===1){entered();await gate;clock+=12000;}else clock+=2000;
   active--;return Response.json(result);
  },sleep:async ms=>{delays.push(ms);clock+=ms;if(calls.length===2)controller.abort();}});
 await firstEntered;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);assert.equal(delays.length,0);release();
 assert.deepEqual(await running,{enabled:true,state:'STOPPED'});
 assert.deepEqual(calls,[stamp,stamp+30000]);assert.deepEqual(delays,[18000,28000]);assert.equal(maxActive,1);
});

test('disabled database and auth denial stay inert without another request',async()=>{
 for(const [reply,code] of [[new Response('',{status:401}),'DEMO_SCENARIO_AUTH_DENIED'],
  [new Response('',{status:403}),'DEMO_SCENARIO_AUTH_DENIED'],
  [Response.json({...result,accepted:0,completed:0,failed:0,paused:0,database_enabled:false}),'DATABASE_DISABLED']]){
  let calls=0,sleeps=0;const logs=[];
  const outcome=await runScenarioWorker(config(),{now:()=>stamp,fetchImpl:async()=>{calls++;return reply;},sleep:async()=>{sleeps++;},report:value=>logs.push(value)});
  assert.deepEqual(outcome,{enabled:true,state:'INERT',code});assert.equal(calls,1);assert.equal(sleeps,0);
  assert.doesNotMatch(JSON.stringify(logs),/secret|latitude|private@/);
 }
 let opened=0;
 assert.deepEqual(await runScenarioWorker({enabled:false},{fetchImpl:async()=>{opened++;}}),{enabled:false});assert.equal(opened,0);
});

test('paused target counts remain visible while periodic polling continues',async()=>{
 const controller=new AbortController(),logs=[],heartbeats=[];let calls=0,clock=stamp;
 const outcome=await runScenarioWorker(config(),{signal:controller.signal,now:()=>clock,
  fetchImpl:async()=>{calls++;return Response.json({...result,accepted:0,completed:0,failed:0,paused:0,paused_target_count:5});},
  heartbeat:async value=>heartbeats.push(value),report:value=>logs.push(value),
  sleep:async ms=>{clock+=ms;if(calls===2)controller.abort();}});
 assert.equal(outcome.state,'STOPPED');assert.equal(calls,2);
 assert.equal(logs.every(value=>value.paused_target_count===5),true);
 assert.equal(heartbeats.filter(value=>value.pausedTargetCount===5).length>=2,true);
 assert.doesNotMatch(JSON.stringify({logs,heartbeats}),/vehicle|actor|email|secret|coordinates/);
});

test('private atomic heartbeat reports only bounded liveness and refuses stale/stopped/foreign data',async()=>{
 assert.equal(SCENARIO_HEARTBEAT_DIRECTORY,'/run/loadgistic-scenario');
 const directory=await mkdtemp(path.join(os.tmpdir(),'loadgistic-scenario-health-'));
 try{
  await writeScenarioHeartbeat({state:'RUNNING',enabled:true},{directory,now:stamp});
  const file=path.join(directory,'heartbeat.json'),metadata=await lstat(file);
  assert.equal(metadata.mode&0o777,0o600);
  const saved=JSON.parse(await readFile(file,'utf8'));
  assert.deepEqual(Object.keys(saved).sort(),['enabled','pid','state','updatedAtMs','version']);
  assert.deepEqual(await scenarioWorkerHealth({directory,now:stamp}),{healthy:true,state:'RUNNING',enabled:true});
  assert.equal((await scenarioWorkerHealth({directory,now:stamp+90001})).healthy,false);
  assert.equal((await scenarioWorkerHealth({directory,now:stamp,probePid:()=>{throw Error('absent');}})).healthy,false);
  await writeScenarioHeartbeat({state:'INERT',enabled:false,code:'WORKER_DISABLED'},{directory,now:stamp});
  assert.equal((await scenarioWorkerHealth({directory,now:stamp})).healthy,true);
  await writeScenarioHeartbeat({state:'RUNNING',enabled:true,pausedTargetCount:5},{directory,now:stamp});
  assert.equal((await scenarioWorkerHealth({directory,now:stamp})).paused_target_count,5);
  await writeScenarioHeartbeat({state:'STOPPED',enabled:true},{directory,now:stamp});
  assert.equal((await scenarioWorkerHealth({directory,now:stamp})).healthy,false);
  await writeFile(file,JSON.stringify({...saved,privateEmail:'private@example.invalid'}));
  assert.equal((await scenarioWorkerHealth({directory,now:stamp})).healthy,false);
  await writeFile(file,JSON.stringify({...saved,updatedAtMs:stamp+5001}));
  assert.equal((await scenarioWorkerHealth({directory,now:stamp})).healthy,false);
  await writeFile(file,'x'.repeat(1025));
  assert.equal((await scenarioWorkerHealth({directory,now:stamp})).healthy,false);
  await writeFile(file,JSON.stringify(saved));await chmod(file,0o644);
  assert.equal((await scenarioWorkerHealth({directory,now:stamp})).healthy,false);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('heartbeat writer does not follow a substituted temporary symlink',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'loadgistic-scenario-health-'));
 try{
  const outside=path.join(directory,'untouched');await writeFile(outside,'preserved',{mode:0o600});
  await symlink(outside,path.join(directory,'heartbeat.json.tmp'));
  await assert.rejects(writeScenarioHeartbeat({state:'RUNNING',enabled:true},{directory,now:stamp}));
  assert.equal(await readFile(outside,'utf8'),'preserved');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('health CLI needs no signing configuration and emits only bounded health fields',()=>{
 const check=spawnSync(process.execPath,['infra/telematics/scenario-worker.mjs','--health'],{
  cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,NODE_ENV:'production',
   LOADGISTIC_SCENARIO_WORKER_ENABLED:'true',LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH:'false',
   DEMO_CAPACITY_WORKER_SECRET:'private-never-printed'},encoding:'utf8'});
 const value=JSON.parse(check.stdout);
 assert.equal(value.event,'demo_scenario_health');assert.equal(typeof value.healthy,'boolean');
 assert.equal(check.status,value.healthy?0:1);
 assert.equal(Object.keys(value).every(key=>['event','healthy','state','enabled','code','paused_target_count'].includes(key)),true);
 assert.doesNotMatch(check.stdout+check.stderr,/private-never-printed|SUPABASE|DEMO_CAPACITY_WORKER_SECRET/);
});
