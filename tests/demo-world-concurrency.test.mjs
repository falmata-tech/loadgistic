import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {checkDemoRaceTarget,createDemoRaceSession,requireDemoRaceResult,
 DEMO_RACE_DEFINITIONS,verifyDemoWorldConcurrency} from '../scripts/verify-demo-world-concurrency-local.mjs';

const config=readFileSync('supabase/config.toml','utf8');
const environment={CI:'true',GITHUB_ACTIONS:'true',LOADGISTIC_RUNNER_ENVIRONMENT:'github-hosted',
 LOADGISTIC_TEST_DATABASE:'loadgistic_telematics_ci'};
const runtime={platform:'linux',nodeMajor:22};
const success={code:0,signal:null,out:'t\n',error:'',timedOut:false,overflow:false,spawnError:false};

test('simulator races refuse hosted, ordinary local and non-native targets before any child starts',async()=>{
 assert.doesNotThrow(()=>checkDemoRaceTarget(environment,config,runtime));
 for(const field of Object.keys(environment)){
  for(const value of [undefined,'',false,'PRIVATE'])
   assert.throws(()=>checkDemoRaceTarget({...environment,[field]:value},config,runtime),undefined,field);
 }
 for(const database of ['postgres','loadgistic_telematics_ci;select 1','loadgistic_telematics_other','loadgistic_gps_ci'])
  assert.throws(()=>checkDemoRaceTarget({...environment,LOADGISTIC_TEST_DATABASE:database},config,runtime));
 assert.throws(()=>checkDemoRaceTarget({...environment,LOADGISTIC_RUNNER_ENVIRONMENT:'self-hosted'},config,runtime));
 assert.throws(()=>checkDemoRaceTarget(environment,config,{platform:'darwin',nodeMajor:22}));
 assert.throws(()=>checkDemoRaceTarget(environment,config,{platform:'linux',nodeMajor:24}));
 assert.throws(()=>checkDemoRaceTarget(environment,config.replace('loadgistic-local','production'),runtime));
 assert.throws(()=>checkDemoRaceTarget(environment,config.replace('55322','5432'),runtime));
 let spawned=false;
 await assert.rejects(verifyDemoWorldConcurrency({environment:{},spawnProcess(){spawned=true;throw Error('PRIVATE');}}));
 assert.equal(spawned,false);
});

test('race outcomes require the exact denial and reject timeout, truncation, deadlock or a missing executable',()=>{
 assert.equal(requireDemoRaceResult(success),'t');
 for(const code of ['DEMO_WORLD_LEASE_REFUSED','DEMO_WORLD_ACTOR_REFUSED',
  'DEMO_PROFILE_LEASE_REFUSED','DEMO_PROFILE_ACTOR_REFUSED','DEMO_PROFILE_STATE_CHANGED']){
  assert.equal(requireDemoRaceResult({...success,code:3,out:'',error:`ERROR:  ${code}\nCONTEXT: PRIVATE\n`},code),'');
  for(const error of [`ERROR: PRIVATE ${code}\n`,`ERROR: ${code} PRIVATE\n`,`ERROR: ${code}\nERROR: PRIVATE\n`,
   `CONTEXT: ${code}\n`,`ERROR: deadlock detected\n`,`ERROR: 40P01\n`])
   assert.throws(()=>requireDemoRaceResult({...success,code:3,error},code));
  assert.throws(()=>requireDemoRaceResult({...success,error:`ERROR: ${code}\n`},code));
 }
 for(const result of [{...success,code:1},{...success,error:'NOTICE: PRIVATE'},
  ...['timedOut','overflow','spawnError'].map(field=>({...success,[field]:true})),{...success,signal:'SIGTERM'}])
  assert.throws(()=>requireDemoRaceResult(result));
 assert.throws(()=>requireDemoRaceResult({...success,code:3,error:'ERROR: PRIVATE\n'},'PRIVATE'));
});

function fakeSpawn(run){
 const calls=[];
 const spawnProcess=(command,args,options)=>{
  const child=new EventEmitter();Object.assign(child,{stdout:new PassThrough(),stderr:new PassThrough(),stdin:new PassThrough()});
  let ended=false;
  child.kill=signal=>{if(!ended){ended=true;queueMicrotask(()=>child.emit('close',null,signal));}return true;};
  calls.push({command,args,options,child});
  queueMicrotask(()=>run(child,(code=0,signal=null)=>{if(!ended){ended=true;child.emit('close',code,signal);}}));
  return child;
 };
 return {spawnProcess,calls};
}

test('session transport pins the local socket/container/database and retains private output in memory',async()=>{
 const fake=fakeSpawn((child,close)=>{child.stdout.write('PRIVATE\nRACE_STATE_{"table":"digest"}\nREADY\n');close();});
 const s=createDemoRaceSession({spawnProcess:fake.spawnProcess});s.end();await s.until('READY');
 const result=await s.done;assert.equal(result.out,'PRIVATE\nRACE_STATE_{"table":"digest"}\nREADY\n');assert.equal(result.error,'');
 assert.equal(s.state(),'{"table":"digest"}');
 assert.deepEqual(fake.calls[0].args,['--host=unix:///var/run/docker.sock','exec','-i','supabase_db_loadgistic-local',
  'psql','-X','--no-password','-U','postgres','-d','loadgistic_telematics_ci','-v','ON_ERROR_STOP=1','-Atq']);
 assert.deepEqual(fake.calls[0].options,{stdio:['pipe','pipe','pipe']});
});

test('session transport bounds stalled, oversized and failed children without printing their data',async()=>{
 for(const stream of ['stdout','stderr']){
  const fake=fakeSpawn(child=>child[stream].write('PRIVATE'.repeat(10_000)));
  const s=createDemoRaceSession({spawnProcess:fake.spawnProcess});s.end();const result=await s.done;
  assert.equal(result.overflow,true);assert.ok(result.out.length+result.error.length<=64*1024);
  assert.throws(()=>requireDemoRaceResult(result));
 }
 const stalled=createDemoRaceSession({spawnProcess:fakeSpawn(()=>{}).spawnProcess,timeoutMs:5});stalled.end();
 assert.equal((await stalled.done).timedOut,true);
 const failed=createDemoRaceSession({spawnProcess:fakeSpawn(child=>child.emit('error',Error('PRIVATE'))).spawnProcess});failed.end();
 assert.equal((await failed.done).spawnError,true);
 const partial=createDemoRaceSession({spawnProcess:fakeSpawn((child,close)=>{child.stdout.write('PRIVATE_READY_PRIVATE\n');close();}).spawnProcess});partial.end();
 await assert.rejects(partial.until('READY'),/SESSION_MARKER_REQUIRED/);
 assert.throws(()=>partial.state(),/SESSION_STATE_REQUIRED/);
 const duplicate=createDemoRaceSession({spawnProcess:fakeSpawn((child,close)=>{child.stdout.write('RACE_STATE_PRIVATE\nRACE_STATE_PRIVATE\n');close();}).spawnProcess});duplicate.end();
 await duplicate.done;assert.throws(()=>duplicate.state(),/SESSION_STATE_REQUIRED/);
});

test('failed runtime evidence emits only a fixed stage and aggregate counters',async()=>{
 const fake=fakeSpawn((child,close)=>{child.stderr.write('ERROR: PRIVATE_CONTACT_SECRET_LOCATION\n');close(3);});
 const output=[];
 assert.equal(await verifyDemoWorldConcurrency({environment,spawnProcess:fake.spawnProcess,emit:value=>output.push(value)}),false);
 assert.equal(output.length,1);assert.deepEqual(JSON.parse(output[0]),{event:'demo-world-concurrency',ok:false,
  stage:'target',failure:'COMMAND_FAILED',races:0,waits:0,denials:0,accepted:0,replays:0,cloneMustBeRecreated:true});
 assert.doesNotMatch(output.join(''),/PRIVATE|CONTACT|SECRET|LOCATION/);
});

test('installed body pins match final224 and the four final197 to225 replacements',()=>{
 const migration=prefix=>readFileSync('supabase/migrations/'+readdirSync('supabase/migrations').find(file=>file.startsWith(prefix+'_')),'utf8');
 const body=(source,name)=>{
  const match=source.match(new RegExp('create(?: or replace)? function public\\.'+name+'\\([^;]*?\\bas \\$\\$(.*?)\\$\\$;','s'));
  assert.ok(match,name);return match[1];
 };
 const definitions={
  'public.demo_world_claim_batch(uuid,integer)':body(migration('224'),'demo_world_claim_batch'),
  'public.demo_world_execute_capacity_step(bigint,uuid)':body(migration('224'),'demo_world_execute_capacity_step'),
  'public.demo_world_claim_profile(uuid)':body(migration('195'),'demo_world_claim_profile'),
  'public.demo_world_execute_profile(bigint,uuid)':body(migration('197'),'demo_world_execute_profile')
 };
 const patches=[...migration('225').matchAll(/anchor:=\$old\$(.*?)\$old\$;\s*replacement:=\$new\$(.*?)\$new\$;/gs)];
 assert.equal(patches.length,5);
 for(const [,before,after] of patches.slice(0,4)){
  const key='public.demo_world_execute_profile(bigint,uuid)';
  assert.equal(definitions[key].split(before).length,2);definitions[key]=definitions[key].replace(before,after);
 }
 for(const [signature,value] of Object.entries(definitions))
  assert.equal(createHash('sha256').update(value).digest('hex'),DEMO_RACE_DEFINITIONS[signature],signature);
});

test('both native workflow hooks discard committed race history before existing clone regressions',()=>{
 for(const file of ['.github/workflows/operations-proof.yml','.github/workflows/ci.yml']){
  const source=readFileSync(file,'utf8'),race=source.indexOf('node scripts/verify-demo-world-concurrency-local.mjs');
  assert.ok(race>0,file);
  const remainder=source.slice(race),refresh=remainder.indexOf('Recreate disposable clone after committed simulator race evidence');
  assert.ok(refresh>0&&refresh<remainder.indexOf('demo-ci-isolated-setup.sql'),file);
  const block=remainder.slice(refresh,remainder.indexOf('demo-ci-isolated-setup.sql'));
  assert.match(block,/LOADGISTIC_TEST_DATABASE: loadgistic_telematics_ci/);
  assert.match(block,/3m node scripts\/ci-disposable-gps-database\.mjs remove\n\s+timeout --signal=TERM --kill-after=10s 10m node scripts\/ci-disposable-gps-database\.mjs create/);
  assert.match(source.slice(race-300,race),/LOADGISTIC_RUNNER_ENVIRONMENT: \$\{\{ runner.environment \}\}/);
  assert.match(source.slice(race-300,race),/timeout --signal=TERM --kill-after=10s 5m /);
 }
 const source=readFileSync('scripts/verify-demo-world-concurrency-local.mjs','utf8');
 assert.match(source,/pg_blocking_pids\(waiter.pid\)/);
 assert.match(source,/holder.application_name=\$\{quote\(blocker\)\}/);
 assert.match(source,/idle_in_transaction_session_timeout='20s'/);
 assert.doesNotMatch(source,/disable trigger|session_replication_role|delete from public\.demo_world_(?:profile_)?receipts|update public\.demo_world_(?:profile_)?receipts/i);
});
