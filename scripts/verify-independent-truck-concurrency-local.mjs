import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

// FEAT-FLT/VER-001 / ADR-079: adding Draft trucks is not publication. The first
// unreviewed Live slot and explicit driver assignments must serialize correctly.
assert.match(readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8'),/^project_id\s*=\s*"loadgistic-local"/m);
const container='supabase_db_loadgistic-local';
const database=process.env.LOADGISTIC_TEST_DATABASE||(process.env.CI==='true'?'postgres':'');
assert.ok(/^loadgistic_provider_[a-z0-9_]+$/.test(database)||database==='postgres'&&process.env.CI==='true',
 'Use LOADGISTIC_TEST_DATABASE for an isolated provider clone; postgres is allowed only in ephemeral CI');
const actor=randomUUID(),provider=randomUUID(),driverA=randomUUID(),driverB=randomUUID();
const actors=[actor,driverA,driverB],literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const ids=actors.map(literal).join(','),json=value=>literal(JSON.stringify(value))+'::jsonb';
const fixture={make:'Toyota',model:'Concurrent fleet fixture',cargo_configuration:'Pickup truck',use_basis:'OWNED'};
const activeSessions=new Set();
let stage='verify target',targetVerified=false,fixtureStarted=false;
function processResult(command,args,input){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:['pipe','pipe','pipe']});let out='',error='';
  child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>error+=chunk);
  child.on('error',reject);child.on('close',code=>resolve({code,out:out.trim(),error}));child.stdin.end(input);
 });
}
function session(){
 const child=spawn('docker',['exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});
 let out='',error='';activeSessions.add(child);
 child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>error+=chunk);
 const done=new Promise((resolve,reject)=>{
  child.on('error',reject);child.on('close',code=>{activeSessions.delete(child);resolve({code,out:out.trim(),error});});
 });
 return {child,done,write:source=>child.stdin.write(source+'\n'),end:()=>child.stdin.end(),
  async until(marker){
   const deadline=Date.now()+15000;
   while(!out.includes(marker)){
    if(Date.now()>deadline||child.exitCode!==null)throw new Error('SESSION_MARKER_MISSING');
    await new Promise(resolve=>setTimeout(resolve,50));
   }
  }};
}
async function sql(source){const connection=session();connection.write("set statement_timeout='20s';"+source);connection.end();return connection.done;}
async function checked(source){const result=await sql(source);assert.equal(result.code,0,'Local fixture/check operation failed');return result.out;}
async function race(firstCommand,secondCommand){
 const first=session(),second=session(),marker='FLEET_LOCKED_'+randomUUID(),tag='fleet-race-'+randomUUID();
 try{
  first.write(`set statement_timeout='20s';begin;${firstCommand};select ${literal(marker)};`);await first.until(marker);
  second.write(`set application_name=${literal(tag)};set statement_timeout='20s';begin;${secondCommand};commit;`);second.end();
  const deadline=Date.now()+10000;let waiting=false;
  while(Date.now()<deadline){
   waiting=await checked(`select exists(select 1 from pg_stat_activity where datname=current_database() and application_name=${literal(tag)} and wait_event_type='Lock');`)==='t';
   if(waiting)break;await new Promise(resolve=>setTimeout(resolve,75));
  }
  assert.equal(waiting,true,'The second command must actually wait on the first transaction');
  first.write('commit;');first.end();
  const results=await Promise.all([first.done,second.done]);assert.equal(results[0].code,0,'First concurrent command failed');return results;
 }finally{first.child.kill();second.child.kill();}
}
const access=(driver,truck)=>`select public.update_fleet_driver_access(${literal(actor)},${json({driver_user_id:driver,vehicle_id:truck,can_manage_capacity:true,can_manage_tracking:true})})`;
async function cleanup(){
 for(const child of activeSessions)child.kill();
 await checked(`begin;
 create temporary table fleet_race_trucks(id uuid primary key)on commit drop;
 insert into fleet_race_trucks select id from public.vehicles where provider_profile_id=${literal(provider)};
 create temporary table fleet_race_sources(id uuid primary key)on commit drop;
 insert into fleet_race_sources select id from public.verification_requests where subject_id in(${ids},${literal(provider)})
  or subject_id in(select id from fleet_race_trucks)or related_vehicle_id in(select id from fleet_race_trucks);
 delete from public.audit_logs where actor_user_id in(${ids})or entity_id in(select id from fleet_race_trucks)or entity_id in(select id from fleet_race_sources);
 delete from public.provider_vehicle_authority_reviews where vehicle_id in(select id from fleet_race_trucks)or source_request_id in(select id from fleet_race_sources);
 delete from public.verification_requests where id in(select id from fleet_race_sources);
 delete from public.driver_vehicle_assignments where driver_user_id in(${ids})or vehicle_id in(select id from fleet_race_trucks);
 delete from public.vehicle_driver_locations where vehicle_id in(select id from fleet_race_trucks);
 delete from public.capacity_access_grants where vehicle_id in(select id from fleet_race_trucks);
 delete from public.capacities where vehicle_id in(select id from fleet_race_trucks);
 delete from public.vehicles where id in(select id from fleet_race_trucks);
 delete from public.driver_permissions where user_id in(${ids});
 delete from public.drivers where user_id in(${ids});
 delete from public.fleet_driver_invitations where provider_profile_id=${literal(provider)};
 delete from public.provider_profiles where id=${literal(provider)}and user_id=${literal(actor)};
 delete from auth.users where id in(${ids});commit;`);
 assert.equal(await checked(`select(select count(*)from auth.users where id in(${ids}))+(select count(*)from public.provider_profiles where id=${literal(provider)})
  +(select count(*)from public.vehicles where provider_profile_id=${literal(provider)})+(select count(*)from public.driver_vehicle_assignments where driver_user_id in(${ids}))
  +(select count(*)from public.audit_logs where actor_user_id in(${ids}));`),'0','Synthetic fixture cleanup must be complete');
}
try{
 const label=await processResult('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',container],'');
 assert.equal(label.code,0);assert.equal(label.out,'loadgistic-local');
 assert.equal(await checked(`select current_database()||':'||provider_owner_fleets::text||':'||independent_single_truck::text from public.platform_controls where singleton;`),database+':true:false');
 targetVerified=true;stage='setup';fixtureStarted=true;
 await checked(`begin;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)values
 ${actors.map(id=>`(${literal(id)},${literal('fleet-race-'+id+'@example.test')},now(),'{}','{}')`).join(',')};
 update public.profiles set role='DRIVER',active=true,drives_truck=false where id=${literal(actor)};
 insert into public.provider_profiles(id,user_id,business_name,handle)values(${literal(provider)},${literal(actor)},'Disposable fleet concurrency fixture',${literal('fleet-race-'+actor)});
 select public.accept_content_policy(${literal(actor)},'2026-10-09');
 select public.fleet_register_driver(${literal(actor)},${literal(driverA)},${json({name:'Synthetic Driver A',phone:'+251900000146',email:'fleet-race-'+driverA+'@example.test'})});
 select public.fleet_register_driver(${literal(actor)},${literal(driverB)},${json({name:'Synthetic Driver B',phone:'+251900000147',email:'fleet-race-'+driverB+'@example.test'})});commit;`);
 stage='concurrent Draft additions';
 const additions=await race(`select public.create_provider_vehicle(${literal(actor)},${json({...fixture,plate:'RACE-A-'+actor.slice(0,8)})})`,
  `select public.create_provider_vehicle(${literal(actor)},${json({...fixture,plate:'RACE-B-'+actor.slice(0,8)})})`);
 assert.equal(additions.filter(result=>result.code===0).length,2,'Both Draft additions must succeed');
 assert.equal(await checked(`select count(*)||':'||count(*)filter(where publication_status='DRAFT')from public.vehicles where provider_profile_id=${literal(provider)}and active;`),'2:2');
 assert.equal(await checked(`select count(*)from public.driver_vehicle_assignments a join public.vehicles v on v.id=a.vehicle_id where v.provider_profile_id=${literal(provider)}and a.active;`),'0');
 const trucks=JSON.parse(await checked(`select jsonb_agg(id order by id)from public.vehicles where provider_profile_id=${literal(provider)}and active;`));
 assert.equal(trucks.length,2);for(const id of trucks)assert.match(id,/^[0-9a-f-]{36}$/);
 console.log('PASS: two waiting concurrent additions both create Draft trucks without assigning a driver');
 stage='concurrent first unreviewed Live slot';
 const publications=await race(`select public.set_provider_vehicle_publication(${literal(actor)},${literal(trucks[0])},'LIVE')`,
  `select public.set_provider_vehicle_publication(${literal(actor)},${literal(trucks[1])},'LIVE')`);
 assert.equal(publications.filter(result=>result.code===0).length,1);
 assert.equal(publications.filter(result=>result.code!==0&&/ERROR:\s+PROVIDER_VERIFICATION_REQUIRED/.test(result.error)).length,1);
 assert.equal(await checked(`select count(*)filter(where publication_status='LIVE')||':'||count(*)filter(where publication_status='DRAFT')from public.vehicles where provider_profile_id=${literal(provider)}and active;`),'1:1');
 console.log('PASS: two waiting first-Live commands yield exactly one Live truck and one current-verification denial');
 stage='one driver assigned concurrently to two trucks';
 assert.equal((await race(access(driverA,trucks[0]),access(driverA,trucks[1]))).filter(result=>result.code===0).length,2);
 assert.equal(await checked(`select count(*)||':'||count(*)filter(where active)from public.driver_vehicle_assignments where driver_user_id=${literal(driverA)};`),'2:1');
 assert.equal(await checked(`select public.capacity_active_driver_id(${literal(trucks[0])})is null and public.capacity_active_driver_id(${literal(trucks[1])})=${literal(driverA)}::uuid;`),'t');
 console.log('PASS: concurrent moves retain assignment history and leave one current truck for the driver');
 stage='two drivers assigned concurrently to one truck';
 assert.equal((await race(access(driverA,trucks[0]),access(driverB,trucks[0]))).filter(result=>result.code===0).length,2);
 assert.equal(await checked(`select count(*)from public.driver_vehicle_assignments where active and vehicle_id=${literal(trucks[0])};`),'1');
 assert.equal(await checked(`select public.capacity_active_driver_id(${literal(trucks[0])})=${literal(driverB)}::uuid and public.capacity_active_driver_id(${literal(trucks[1])})is null;`),'t');
 assert.equal(await checked(`select not exists(select 1 from public.driver_vehicle_assignments where active and driver_user_id in(${ids})group by driver_user_id having count(*)>1)
  and not exists(select 1 from public.driver_vehicle_assignments where active and vehicle_id in(${trucks.map(literal).join(',')})group by vehicle_id having count(*)>1);`),'t');
 console.log('PASS: concurrent driver changes leave one current driver per truck and preserve prior pair history');
}catch(error){console.error(`FAIL: ${stage} (${error instanceof Error?error.name:'unknown'})`);process.exitCode=1;}
finally{
 if(targetVerified&&fixtureStarted){
  try{await cleanup();console.log('CLEANUP: exact synthetic actors, provider, trucks, assignments, verification references and audit rows removed');}
  catch{console.error('FAIL: exact synthetic cleanup');process.exitCode=1;}
 }
}
