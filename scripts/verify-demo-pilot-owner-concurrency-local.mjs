// Destructive only to the exact opted-in disposable clone. Its complete private
// baseline is dumped first and restored after committed multi-session evidence.
import {spawn} from 'node:child_process';
import {createReadStream,createWriteStream,mkdirSync,mkdtempSync,writeFileSync,chmodSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {checkedMatchingPgMajor,checkedLocalRestoreRole,captureGpsCloneGraphql,checkedGpsCloneArchive,restoreGpsCloneArchive,GPS_CLONE_ARCHIVE_RESTORE_TIMEOUT_MS,postgresErrorCategory} from './ci-disposable-gps-clone.mjs';
import {pinnedLocalPilotDocker,publicPilotOwnerFailure} from './lib/pilot-owner-race-target.mjs';

const database=process.env.LOADGISTIC_TEST_DATABASE;
const targets={loadgistic_pilot_ci:{container:'supabase_db_loadgistic-review-20261114',project:'loadgistic-review-20261114'},
 loadgistic_telematics_ci:{container:'supabase_db_loadgistic-local',project:'loadgistic-local'}};
if(!Object.hasOwn(targets,database||'')||process.env.LOADGISTIC_PILOT_OWNER_RACE_CONFIRM!==database)throw Error('EXACT_DISPOSABLE_PILOT_RACE_CONFIRMATION_REQUIRED');
if(process.argv.length!==2)throw Error('PILOT_OWNER_RACE_ARGUMENT_DENIED');
const {container,project}=targets[database],q=s=>"'"+String(s).replaceAll("'","''")+"'";
mkdirSync('.local',{recursive:true});const evidence=mkdtempSync(path.resolve('.local/pilot-owner-races-'));chmodSync(evidence,0o700);
let stage='PREFLIGHT',baseline=null,backupReady=false,setupAttempted=false,restored=false,runFailure=null,restoreFailure=null;
let dockerTarget=null,containerId=null,serverMajor=null,graphqlSnapshot=null,archiveToc=null;const live=new Set();
const counters={races:0,observedBlockerWaits:0,acceptedProvision:0,acceptedReports:0,deniedProvision:0,deniedReports:0};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fail(code){throw Error(code);}
function processRun(command,args,{input,source,destination,env=process.env,timeout=30000,maxOutput=512000}={}){
 return new Promise((resolve,reject)=>{
  const started=Date.now(),child=spawn(command,args,{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',timer;
  let flushed=Promise.resolve();
  if(destination){const stream=createWriteStream(destination,{mode:0o600,flags:'wx'});flushed=new Promise((done,failed)=>{stream.on('finish',done);stream.on('error',()=>{child.kill('SIGTERM');failed(Error('PILOT_RACE_BACKUP_WRITE_FAILED'));});});child.stdout.pipe(stream);}
  else child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>maxOutput){child.kill('SIGTERM');reject(Error('PILOT_RACE_OUTPUT_BOUND'));}});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-16384);});
  if(source)createReadStream(source).pipe(child.stdin);else child.stdin.end(input||'');
  child.stdin.on('error',()=>{});child.on('error',()=>reject(Error('PILOT_RACE_SPAWN_FAILED')));
  timer=setTimeout(()=>{try{writeFileSync(path.join(evidence,'process-timeout.private.json'),JSON.stringify({event:'pilot_process_timeout',stage,timeoutMs:timeout,elapsedMs:Date.now()-started,program:command==='docker'?'DOCKER':'NODE'}),{mode:0o600,flag:'wx'});}catch{}
   child.kill('SIGTERM');reject(Error('PILOT_RACE_PROCESS_TIMEOUT'));},timeout);
  child.on('close',async code=>{clearTimeout(timer);if(code!==0){writeFileSync(path.join(evidence,'last-process-error.private.log'),stderr,{mode:0o600});
    const error=Error('PILOT_RACE_PROCESS_FAILED');error.category=postgresErrorCategory(stderr);reject(error);
   }else{try{await flushed;resolve(stdout.trim());}catch(error){reject(error);}}});
 });
}
const docker=(args,options={})=>{if(!dockerTarget)fail('PILOT_RACE_UNPINNED_DOCKER');return processRun('docker',[...dockerTarget.args,...args],{...options,env:dockerTarget.environment});};
const selectedContainer=()=>containerId||container;
const queryAs=(role,sql)=>docker(['exec','-i',selectedContainer(),'psql','-X','-qAt','-U',role,'-d',database,'-v','ON_ERROR_STOP=1'],{input:sql});
const query=sql=>queryAs('postgres',sql),adminQuery=sql=>queryAs('supabase_admin',sql);
const json=async sql=>JSON.parse(await query(sql));
async function verifyTarget({restoring=false}={}){
 const phase=restoring?'RESTORE_TARGET':'PREFLIGHT';
 if(!dockerTarget){stage=phase+'_DOCKER_CONTEXT';dockerTarget=await pinnedLocalPilotDocker({environment:process.env,
  inspectContext:async name=>JSON.parse(await processRun('docker',['context','inspect',...(name?[name]:[]),'--format','{{json .Endpoints.docker.Host}}']))});}
 stage=phase+'_CONTAINER_IDENTITY';
 const identity=(await docker(['inspect','--format','{{.Id}}|{{index .Config.Labels "com.supabase.cli.project"}}',selectedContainer()])).split('|');
 if(!/^[a-f0-9]{64}$/.test(identity[0])||identity[1]!==project||containerId&&identity[0]!==containerId)fail('PILOT_RACE_CONTAINER_DRIFT');containerId=identity[0];
 stage=phase+'_DATABASE_IDENTITY';
 const check=await json("select jsonb_build_object('database',current_database(),'major',current_setting('server_version_num')::integer/10000);");
 stage=phase+'_DUMP_CLIENT_VERSION';
 const client=await docker(['exec',selectedContainer(),'pg_dump','--version']),clientMajor=Number(client.match(/PostgreSQL\)\s+(\d+)/)?.[1]);
 stage=phase+'_PG_MAJOR_CHECK';
 checkedMatchingPgMajor(clientMajor,check.major);
 if(check.database!==database||serverMajor!==null&&check.major!==serverMajor)fail('PILOT_RACE_DATABASE_DRIFT');serverMajor=check.major;
 stage=phase+'_RESTORE_ROLE';
 checkedLocalRestoreRole(await adminQuery('select current_user;'));
}
const baselineSql=`select jsonb_build_object(
 'users',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by id)::text,'[]')) from auth.users u),
 'capacities',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'[]')) from public.capacities c),
 'vehicles',(select md5(coalesce(jsonb_agg(to_jsonb(v) order by id)::text,'[]')) from public.vehicles v),
 'members',(select md5(coalesce(jsonb_agg(to_jsonb(m) order by id)::text,'[]')) from public.organization_members m),
 'audit',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) from public.audit_logs a),
 'positions',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'[]')) from public.telematics_positions p),
 'devices',(select md5(coalesce(jsonb_agg(to_jsonb(d) order by id)::text,'[]')) from public.telematics_devices d),
 'device_assignments',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) from public.telematics_device_assignments a),
 'sources',(select md5(coalesce(jsonb_agg(to_jsonb(s) order by vehicle_id)::text,'[]')) from public.telematics_location_sources s),
 'controls',jsonb_build_object('world',(select to_jsonb(c) from public.demo_world_control c where id=1),'motion',(select to_jsonb(c) from public.demo_hosted_motion_control c where id=1)),
 'definitions',(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('demo_motion_binding','demo_motion_binding_fleet','provision_telematics_device','provision_telematics_device_pre_privacy154','demo_world_tracking_activation_guard','demo_pilot_lock_scope227')));`;
const stateSql=`select jsonb_build_object(
 'capacities',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'[]')) from public.capacities c),
 'positions',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'[]')) from public.telematics_positions p),
 'devices',(select md5(coalesce(jsonb_agg(to_jsonb(d) order by id)::text,'[]')) from public.telematics_devices d),
 'device_assignments',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) from public.telematics_device_assignments a),
 'audit',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) from public.audit_logs a),
 'sources',(select md5(coalesce(jsonb_agg(to_jsonb(s) order by vehicle_id)::text,'[]')) from public.telematics_location_sources s));`;
async function sameState(before){if(JSON.stringify(await json(stateSql))!==JSON.stringify(before))fail('PILOT_RACE_DENIAL_CHANGED_STATE');}

function session(sql){
 const tag='pilot-owner-'+randomUUID(),ready='READY_'+randomUUID();
 const child=spawn('docker',[...dockerTarget.args,'exec','-i','-e','PGAPPNAME='+tag,selectedContainer(),'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{env:dockerTarget.environment,stdio:['pipe','pipe','pipe']});
 const state={tag,child,stdout:'',stderr:'',closed:false,code:null};live.add(state);
 child.stdout.on('data',chunk=>{state.stdout+=chunk;if(state.stdout.length>65536)child.kill('SIGTERM');});
 child.stderr.on('data',chunk=>{state.stderr=(state.stderr+chunk).slice(-8192);});child.stdin.on('error',()=>{});
 state.done=new Promise((resolve,reject)=>{child.on('error',()=>reject(Error('PILOT_RACE_SESSION_SPAWN')));child.on('close',code=>{state.closed=true;state.code=code;live.delete(state);resolve();});});
 state.waitReady=async()=>{for(let i=0;i<200;i++){if(state.stdout.split(/\r?\n/).includes(ready))return;if(state.closed)fail('PILOT_RACE_SESSION_FAILED');await pause(50);}fail('PILOT_RACE_SESSION_TIMEOUT');};
 state.finish=async(commit)=>{if(!state.closed)child.stdin.end(commit?'commit;\n':'rollback;\n');await state.done;};
 child.stdin.write(`begin;set local statement_timeout='15s';set local lock_timeout='10s';${sql};select ${q(ready)};\n`);
 return state;
}
async function blocked(waiter,holder){
 for(let i=0;i<40;i++){
  const yes=await query(`select exists(select 1 from pg_stat_activity w where w.application_name=${q(waiter.tag)} and w.wait_event_type='Lock' and exists(select 1 from pg_stat_activity h where h.application_name=${q(holder.tag)} and h.pid=any(pg_blocking_pids(w.pid))));`);
  if(yes==='t'){counters.observedBlockerWaits++;return;}
  if(waiter.closed)fail('PILOT_RACE_EXPECTED_WAIT_MISSING');await pause(50);
 }
 fail('PILOT_RACE_EXPECTED_BLOCKER_TIMEOUT');
}
const answer=state=>{const line=state.stdout.split(/\r?\n/).find(line=>line.startsWith('{'));if(!line)fail('PILOT_RACE_RESULT_MISSING');return JSON.parse(line);};
async function expectDenied(state,expected){await state.done;if(state.code===0||!new RegExp('ERROR:\\s+'+expected+'(?:\\r?\\n|$)').test(state.stderr)){writeFileSync(path.join(evidence,'last-session-error.private.log'),state.stderr,{mode:0o600});fail('PILOT_RACE_WRONG_DENIAL');}}

async function runRaces(){
 const ids=await json(`select jsonb_build_object('admin',(select id from public.profiles where active and role='ADMIN' order by id limit 1),
 'normal',(select id from auth.users where raw_user_meta_data->>'fixture_key'='pilot227-owner-race-normal'),
 'gateway',(select id from public.telematics_gateways where synthetic_transport='NETLIFY_DEMO'));`);
 if(!ids.admin||!ids.normal||!ids.gateway)fail('PILOT_OWNER_RACE_FIXTURE_MISSING');
 const org1='a1448edf-6fb6-47ff-b7c6-d8d3cd9dbfcd',org2='47e536ac-bc2a-4a4f-a3ef-65f1acca1f79';
 const insertOwner=org=>`insert into public.organization_members(organization_id,user_id,membership_role) values(${q(org)},${q(ids.normal)},'OWNER')`;
 const deleteOwner=org=>query(`delete from public.organization_members where organization_id=${q(org)} and user_id=${q(ids.normal)};`);
 const provision=(org,imei,slot)=>`select public.provision_telematics_device(${q(ids.admin)},jsonb_build_object('gatewayId',${q(ids.gateway)},'gatewayDeviceId',${slot},'imei',${q(imei)},'protocol','gt06','protocolDeviceId',${q(imei)},'label','Pilot owner concurrency fixture','modelProfile','SYNTHETIC_GT06','synthetic',true,'ownerOrganizationId',${q(org)}))`;
 stage='PROVISION_FIRST';
 let holder=session(provision(org1,'990000000000005',3));await holder.waitReady();let contender=session(insertOwner(org1));await blocked(contender,holder);
 await holder.finish(true);if(holder.code!==0||!answer(holder).id)fail('PILOT_PROVISION_FIRST_FAILED');await contender.waitReady();await contender.finish(true);counters.acceptedProvision++;counters.races++;
 let before=await json(stateSql),denied=session(provision(org1,'990000000000005',3));await expectDenied(denied,'DEVICE_OWNER_INVALID');await sameState(before);counters.deniedProvision++;await deleteOwner(org1);
 stage='OWNER_FIRST_PROVISION';
 holder=session(insertOwner(org2));await holder.waitReady();before=await json(stateSql);contender=session(provision(org2,'990000000000006',4));await blocked(contender,holder);await holder.finish(true);await expectDenied(contender,'DEVICE_OWNER_INVALID');await sameState(before);counters.deniedProvision++;counters.races++;await deleteOwner(org2);
 await query(`select public.prepare_netlify_demo_gateway(${q(ids.admin)},${q(ids.gateway)});update public.demo_hosted_motion_control set enabled=true,kill_switch=false,netlify_enabled=true,activated_at=clock_timestamp() where id=1;`);
 const run=randomUUID();await query(`select public.netlify_demo_motion_command(gen_random_uuid(),${q(run)},null,'{"action":"CLAIM"}');select public.netlify_demo_motion_command(gen_random_uuid(),${q(run)},'fleet-01','{"action":"PREPARE"}');`);await pause(1250);
 const report=`select public.netlify_demo_motion_command(gen_random_uuid(),${q(run)},'fleet-01',jsonb_build_object('action','REPORT','latitude',9.015,'longitude',38.704,'speedKph',0,'course',0,'capturedAt',clock_timestamp()))`;
 stage='REPORT_FIRST';
 holder=session(report);await holder.waitReady();contender=session(insertOwner(org1));await blocked(contender,holder);await holder.finish(true);if(holder.code!==0||answer(holder).recorded!==true)fail('PILOT_REPORT_FIRST_FAILED');await contender.waitReady();await contender.finish(true);counters.acceptedReports++;counters.races++;
 const saved=await json(`select jsonb_build_object('positions',(select count(*) from public.telematics_positions where vehicle_id='3f5b6847-e7fc-4057-85af-b520e80cd944' and synthetic_transport='NETLIFY_DEMO'),
 'source',(select location_source from public.capacities where vehicle_id='3f5b6847-e7fc-4057-85af-b520e80cd944' order by updated_at desc,id desc limit 1),'owners',(select count(*) from public.organization_members where organization_id=${q(org1)} and membership_role='OWNER'));`);
 if(saved.positions!==1||saved.source!=='TELEMATICS'||saved.owners!==2)fail('PILOT_REPORT_SAVED_FACTS_WRONG');
 before=await json(stateSql);denied=session(report);await expectDenied(denied,'DEMO_TARGET_DENIED');await sameState(before);counters.deniedReports++;await deleteOwner(org1);
 stage='OWNER_FIRST_REPORT';
 holder=session(insertOwner(org1));await holder.waitReady();before=await json(stateSql);contender=session(report);await blocked(contender,holder);await holder.finish(true);await expectDenied(contender,'DEMO_TARGET_DENIED');await sameState(before);counters.deniedReports++;counters.races++;await deleteOwner(org1);
 await query('update public.demo_hosted_motion_control set enabled=false,kill_switch=true,netlify_enabled=false where id=1;');
 const stopped=await query('select not exists(select 1 from public.demo_motion_targets where state=\'RUNNING\') and not exists(select 1 from public.demo_motion_netlify_window where run_id is not null);');if(stopped!=='t')fail('PILOT_RACE_STOP_FAILED');
}

try{
 await verifyTarget();stage='PREFLIGHT_LOCAL_BASELINE';const guard=await query("select exists(select 1 from public.vehicles where id='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a') and not exists(select 1 from auth.users where raw_app_meta_data->>'fixture_source'='loadgistic-production-pilot-v1');");if(guard!=='t')fail('PILOT_RACE_LOCAL_BASELINE_REQUIRED');
 stage='PREFLIGHT_BASELINE_FINGERPRINT';
 baseline=await json(baselineSql);writeFileSync(path.join(evidence,'baseline-fingerprint.private.json'),JSON.stringify(baseline),{mode:0o600});
 stage='BACKUP_GRAPHQL_SNAPSHOT';graphqlSnapshot=await captureGpsCloneGraphql({major:serverMajor,query:adminQuery});
 if(graphqlSnapshot)writeFileSync(path.join(evidence,'graphql-wrapper.private.json'),JSON.stringify(graphqlSnapshot),{mode:0o600});
 stage='BACKUP_ARCHIVE';
 await docker(['exec',selectedContainer(),'pg_dump','-U','supabase_admin','-Fc','-d',database],{destination:path.join(evidence,'baseline.private.dump')});
 if(serverMajor===15){stage='BACKUP_ARCHIVE_TOC';archiveToc=await docker(['exec','-i',selectedContainer(),'pg_restore','-l'],{source:path.join(evidence,'baseline.private.dump'),maxOutput:2000000});}
 stage='BACKUP_ARCHIVE_VALIDATE';
 checkedGpsCloneArchive({major:serverMajor,graphqlSnapshot,toc:archiveToc});backupReady=true;
 stage='COMMITTED_FIXTURE_GENERATE';const setup=await processRun(process.execPath,['scripts/demo-pilot-binding-test-sql.mjs','--owner-race-setup'],{env:{...process.env,LOADGISTIC_PILOT_RACE_SETUP:'ALLOW_COMMITTED_DISPOSABLE_PILOT_OWNER_TEST'}});
 stage='COMMITTED_FIXTURE_INSTALL';
 setupAttempted=true;await docker(['exec','-i','-e','PGOPTIONS=-c loadgistic.demo_isolated_test=true',selectedContainer(),'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{input:setup});
 await runRaces();
}catch(error){runFailure=publicPilotOwnerFailure(stage,error);writeFileSync(path.join(evidence,'failure.private.json'),JSON.stringify(runFailure,null,2),{mode:0o600});process.exitCode=1;
}finally{
 for(const state of [...live]){if(!state.closed)await state.finish(false).catch(()=>{});}
 if(backupReady&&setupAttempted){
  const listDirectory='/tmp/loadgistic-pilot-race-'+randomUUID();let listCreated=false,listIndex=0;
  try{stage='RESTORE_TARGET_CHECK';await verifyTarget({restoring:true});
   stage='RESTORE_DROP';await docker(['exec',selectedContainer(),'dropdb','-U','postgres',database]);
   stage='RESTORE_CREATE';await docker(['exec',selectedContainer(),'createdb','-U','postgres','--owner=postgres',database]);
   stage='RESTORE_ARCHIVE';
   await restoreGpsCloneArchive({major:serverMajor,graphqlSnapshot,readToc:()=>archiveToc,targetQuery:adminQuery,
    restoreArchive:async list=>{const args=['exec','-i',selectedContainer(),'pg_restore','-U','supabase_admin','-d',database,'--exit-on-error'];
     if(list!==null){if(!listCreated){await docker(['exec',selectedContainer(),'mkdir','-m','700',listDirectory]);listCreated=true;}
      const name='restore-'+(++listIndex)+'.list',local=path.join(evidence,name);writeFileSync(local,list,{mode:0o600});
      await docker(['cp',local,selectedContainer()+':'+listDirectory+'/'+name]);args.push('-L',listDirectory+'/'+name);}
     await docker(args,{source:path.join(evidence,'baseline.private.dump'),timeout:GPS_CLONE_ARCHIVE_RESTORE_TIMEOUT_MS});}});
   stage='RESTORE_VERIFY';const restoredFingerprint=await json(baselineSql);
   writeFileSync(path.join(evidence,'restored-fingerprint.private.json'),JSON.stringify(restoredFingerprint),{mode:0o600});
   if(JSON.stringify(restoredFingerprint)!==JSON.stringify(baseline))fail('PILOT_RACE_BASELINE_MISMATCH');restored=true;
  }catch(error){restoreFailure=publicPilotOwnerFailure(stage,error);
   writeFileSync(path.join(evidence,'restore-failure.private.json'),JSON.stringify(restoreFailure),{mode:0o600});process.exitCode=1;
  }finally{if(listCreated)await docker(['exec',selectedContainer(),'rm','-rf','--',listDirectory]).catch(()=>{process.exitCode=1;});}
 }
 const result={event:'pilot_owner_concurrency',ok:process.exitCode!==1,...counters,baselineRestored:restored,primaryUnchanged:true,...(runFailure?{failure:runFailure}:{}),...(restoreFailure?{restoreFailure}:{})};
 writeFileSync(path.join(evidence,'receipt.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
}
