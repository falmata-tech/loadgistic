// FEAT-SIM-001 / NR-83/84. Real transaction races on the native CI clone only.
// Successful commands commit immutable history. The workflow must discard and
// recreate this clone afterwards; this script never rewrites that history.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const DATABASE='loadgistic_telematics_ci';
const CONTAINER='supabase_db_loadgistic-local';
const DOCKER_HOST='--host=unix:///var/run/docker.sock';
const ORGANIZATION='c36022ff-bf3e-432d-ae96-93d1537cf79e';
const PAGE='06b2d2f0-9914-4543-853b-72381b4999da';
const TARGET='fleet-01-partial';
const LIMIT_BYTES=64*1024;
const SETTINGS="set statement_timeout='15s';set lock_timeout='10s';set idle_in_transaction_session_timeout='20s';";
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const requireValue=(condition,code)=>{if(!condition)throw Error(code);};
const FAILURE_CODES=new Set([
 'SESSION_FAILED','DATABASE_DEADLOCK','COMMAND_FAILED','DENIAL_ENUM_REQUIRED','EXPECTED_DENIAL_REQUIRED',
 'SESSION_CLOSED','SESSION_MARKER_REQUIRED','SESSION_STATE_REQUIRED','DENIAL_CHANGED_STATE',
 'ACTUAL_BLOCKER_REQUIRED','CONTAINER_PROJECT_REQUIRED','DATABASE_IDENTITY_REQUIRED',
 'FINAL_FUNCTION_DEFINITIONS_REQUIRED','INERT_CLONE_REQUIRED','EXACT_DEMO_OWNER_REQUIRED',
 'CAPACITY_CLAIM_REQUIRED','TEST_LEASE_EXPIRY_REQUIRED','ACCEPTED_COMMAND_REQUIRED',
 'ACCEPTED_COMMAND_SCOPE_CHANGED','STOP_OWNER_COMMIT_REQUIRED','DONE_REPLAY_REQUIRED',
 'CAPACITY_READBACK_REQUIRED','CAPACITY_SHARING_POLICY_CHANGED','PROFILE_CLAIM_REQUIRED','HUMAN_SAVE_LOST','PROFILE_READBACK_REQUIRED',
 'COMPLETE_RACE_MATRIX_REQUIRED'
]);

// prosrc SHA256, from final224 and final197 after all four migration225 edits.
// Check the installed definitions, not an earlier CREATE statement.
export const DEMO_RACE_DEFINITIONS={
 'public.demo_world_claim_batch(uuid,integer)':'8846bc643a572e2324acc831041dfc69c721268a9f8e604969308c40d9a37fc5',
 'public.demo_world_execute_capacity_step(bigint,uuid)':'95ebce07f01e003747efe0f1db5eefc7414d4fb9019f46c04b470740afc834c0',
 'public.demo_world_claim_profile(uuid)':'f12097160c2802a17cbafdf0a3d6584541b3ad3811cb1bc40a23c1367541a48f',
 'public.demo_world_execute_profile(bigint,uuid)':'8d5080ec228c6c7d2a1327a4fa0b168d98734d35148aa9b93c681f20a4c786ca'
};

export function checkDemoRaceTarget(environment,config,{platform=process.platform,nodeMajor=Number(process.versions.node.split('.')[0])}={}){
 requireValue(platform==='linux'&&nodeMajor===22,'NATIVE_NODE22_REQUIRED');
 requireValue(environment.CI==='true'&&environment.GITHUB_ACTIONS==='true'
  &&environment.LOADGISTIC_RUNNER_ENVIRONMENT==='github-hosted','NATIVE_GITHUB_RUNNER_REQUIRED');
 requireValue(environment.LOADGISTIC_TEST_DATABASE===DATABASE,'ISOLATED_SIMULATOR_DATABASE_REQUIRED');
 requireValue(/^project_id\s*=\s*"loadgistic-local"\s*$/m.test(config)
  &&/^\[db\]\s*\nport\s*=\s*55322\s*$/m.test(config),'LOCAL_PROJECT_CONFIG_REQUIRED');
}

export function requireDemoRaceResult(result,expected='success'){
 requireValue(!result.timedOut&&!result.overflow&&!result.spawnError&&!result.signal,'SESSION_FAILED');
 requireValue(!/deadlock detected|40P01/i.test(result.error),'DATABASE_DEADLOCK');
 if(expected==='success')requireValue(result.code===0&&!result.error,'COMMAND_FAILED');
 else{
  requireValue(['DEMO_WORLD_LEASE_REFUSED','DEMO_WORLD_ACTOR_REFUSED',
   'DEMO_PROFILE_LEASE_REFUSED','DEMO_PROFILE_ACTOR_REFUSED','DEMO_PROFILE_STATE_CHANGED'].includes(expected),
  'DENIAL_ENUM_REQUIRED');
  // Exact server message, never an arbitrary error containing the enum.
  const messages=[...result.error.matchAll(/^ERROR:\s+([^\r\n]+)\r?$/gm)].map(item=>item[1]);
  requireValue(result.code!==0&&messages.length===1&&messages[0]===expected,'EXPECTED_DENIAL_REQUIRED');
 }
 return result.out.trim();
}

// Child output remains private and bounded, including errors/connection data.
// Server-side timeouts also end an abandoned docker-exec transaction.
export function createDemoRaceSession({spawnProcess=spawn,command='docker',args,timeoutMs=25_000}={}){
 const child=spawnProcess(command,args||[DOCKER_HOST,'exec','-i',CONTAINER,'psql','-X','--no-password',
  '-U','postgres','-d',DATABASE,'-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});
 let out='',error='',bytes=0,closed=false,timedOut=false,overflow=false,spawnError=false;
 let settle;
 const done=new Promise(resolve=>settle=resolve);
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
 const capture=field=>chunk=>{
  bytes+=Buffer.byteLength(chunk);
  if(bytes>LIMIT_BYTES){overflow=true;child.kill('SIGKILL');return;}
  if(field==='out')out+=chunk;else error+=chunk;
 };
 child.stdout.on('data',capture('out'));child.stderr.on('data',capture('error'));
 child.stdin.on('error',()=>{});
 const finish=(code,signal)=>{
  if(closed)return;closed=true;clearTimeout(timer);
  settle({code,signal,out,error,timedOut,overflow,spawnError});
 };
 child.once('error',()=>{spawnError=true;finish(null,null);});
 child.once('close',finish);
 return {child,done,
  write(sql){requireValue(!closed,'SESSION_CLOSED');child.stdin.write(sql+'\n');},
  end(){child.stdin.end();},stop(){if(!closed)child.kill('SIGKILL');},
  state(){
   const lines=out.split(/\r?\n/).filter(line=>line.startsWith('RACE_STATE_'));
   requireValue(lines.length===1,'SESSION_STATE_REQUIRED');return lines[0].slice('RACE_STATE_'.length);
  },
  async until(marker){
   const deadline=Date.now()+10_000;
   while(!out.split(/\r?\n/).includes(marker)){
    requireValue(!closed&&Date.now()<deadline,'SESSION_MARKER_REQUIRED');await delay(40);
   }
  }
 };
}

// No row/contact/location data leaves psql: compare complete-table fingerprints
// privately, including unrelated tenant data and all side-effect boundaries.
const TABLES=[
 'auth.users','auth.sessions','public.profiles','public.provider_profiles',
 'public.organizations','public.organization_members','public.company_pages',
 'public.vehicles','public.driver_vehicle_assignments','public.driver_permissions',
 'public.capacities','public.telematics_location_sources','public.vehicle_driver_locations',
 'public.phone_location_installations','public.phone_location_bindings','public.phone_location_report_receipts',
 'public.telematics_gateways','public.telematics_devices','public.telematics_device_assignments',
 'public.telematics_positions','public.telematics_commands','public.demo_motion_targets',
 'public.vehicle_capacity_sharing','public.capacity_access_grants','public.business_capacity_grants',
 'public.provider_shipments','public.provider_shipment_events','public.provider_tracking_recipients',
 'public.tracking_device_leases','public.tracking_sharing_controls','public.tracking_staff_location_grants','public.tracking_sharing_audit',
 'public.demo_world_control','public.demo_world_targets','public.demo_world_steps','public.demo_world_receipts',
 'public.demo_world_profile_control','public.demo_world_profile_target','public.demo_world_profile_jobs',
 'public.demo_world_profile_receipts','public.email_deliveries','public.access_email_deliveries',
 'public.native_push_outbox','public.audit_logs'
];
function snapshotSql(){
 return `select jsonb_object_agg(name,digest) from(${TABLES.map(table=>
  `select ${quote(table)} name,md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]'::jsonb)::text) digest from ${table} r`).join(' union all ')})fingerprints;`;
}

export async function verifyDemoWorldConcurrency({environment=process.env,spawnProcess=spawn,emit=console.log}={}){
 const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
 checkDemoRaceTarget(environment,config);
 const sessions=new Set(),ordinary=randomUUID(),worker=randomUUID();
 let stage='target',races=0,waits=0,denials=0,replays=0,accepted=0;
 const open=options=>{const s=createDemoRaceSession({spawnProcess,...options});sessions.add(s);s.done.finally(()=>sessions.delete(s));return s;};
 const query=async sql=>{const s=open();s.write(SETTINGS+sql);s.end();return requireDemoRaceResult(await s.done);};
 const snapshot=()=>query(snapshotSql());
 const unchanged=async before=>requireValue(await snapshot()===before,'DENIAL_CHANGED_STATE');
 const transaction=async(sql,tag,captureState=false)=>{
  const s=open(),marker='READY_'+randomUUID();
  // A holder sees its own intended write before commit. Its complete private
  // fingerprint becomes the expected state after the competing command refuses.
  // This avoids excluding an entire membership/control/page/audit table.
  const stateSql=captureState?`select 'RACE_STATE_'||(${snapshotSql().slice(0,-1)})::text;`:'';
  s.write(SETTINGS+`set application_name=${quote(tag||'demo-race-'+randomUUID())};begin;${sql};${stateSql}select ${quote(marker)};`);
  await s.until(marker);return s;
 };
 const finish=async(s,action='commit')=>{s.write(action+';');s.end();return requireDemoRaceResult(await s.done);};
 const execute=sql=>{const s=open(),tag='demo-execute-'+randomUUID();
  s.write(SETTINGS+`set application_name=${quote(tag)};begin;${sql};commit;`);s.end();return {s,tag};};
 const waiting=async(tag,blocker)=>{
  const deadline=Date.now()+7000;
  while(Date.now()<deadline){
   const blocked=await query(`select exists(select 1 from pg_stat_activity waiter
    join pg_stat_activity holder on holder.pid=any(pg_blocking_pids(waiter.pid))
    where waiter.datname=current_database() and waiter.application_name=${quote(tag)}
    and waiter.wait_event_type='Lock' and holder.datname=current_database()
    and holder.application_name=${quote(blocker)});`);
   if(blocked==='t'){waits++;return;}
   await delay(40);
  }
  throw Error('ACTUAL_BLOCKER_REQUIRED');
 };
 const deny=async(connection,code)=>{requireDemoRaceResult(await connection.done,code);denials++;};
 const ownerInsert=`insert into public.organization_members(user_id,organization_id,membership_role)
  values(${quote(ordinary)},${quote(ORGANIZATION)},'OWNER')`;
 const removeOwner=()=>query(`delete from public.organization_members where user_id=${quote(ordinary)}
  and organization_id=${quote(ORGANIZATION)} and membership_role='OWNER';`);
 try{
  const inspect=open({args:[DOCKER_HOST,'inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',CONTAINER]});
  inspect.end();requireValue(requireDemoRaceResult(await inspect.done)==='loadgistic-local','CONTAINER_PROJECT_REQUIRED');
  requireValue(await query('select current_database()')===DATABASE,'DATABASE_IDENTITY_REQUIRED');
  const installed=JSON.parse(await query(`select jsonb_object_agg(signature,hash) from(
   select signature,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') hash from
   unnest(array[${Object.keys(DEMO_RACE_DEFINITIONS).map(quote).join(',')}])signature
   join pg_proc p on p.oid=to_regprocedure(signature)
   join pg_language l on l.oid=p.prolang
   where p.prosecdef and p.provolatile='v' and l.lanname='plpgsql'
    and p.prorettype=case when signature like '%execute_%' then 'jsonb'::regtype else 'record'::regtype end
    and p.proretset=(signature like '%claim_%')
    and p.proconfig=case when signature='public.demo_world_execute_profile(bigint,uuid)'
     then array['search_path=pg_catalog, public, auth, pg_temp']::text[]
     else array['search_path=pg_catalog, public, pg_temp']::text[] end
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and has_function_privilege('service_role',p.oid,'EXECUTE'))definitions;`));
  requireValue(JSON.stringify(installed&&Object.entries(installed).sort())===JSON.stringify(Object.entries(DEMO_RACE_DEFINITIONS).sort()),
   'FINAL_FUNCTION_DEFINITIONS_REQUIRED');
  requireValue(await query(`select
   (select array_agg(version::text order by version) from supabase_migrations.schema_migrations
    where version in('221','222','223','224','225'))=array['221','222','223','224','225']::text[]
   and exists(select 1 from public.demo_world_control where id=1 and not enabled and activated_at is null
    and catalog_version=2 and manifest_version=1 and last_dispatch_at is null)
   and exists(select 1 from public.demo_world_profile_control where id=1 and not enabled and manifest_version=2)
   and (select count(*) from public.demo_world_targets)=5 and (select count(*) from public.demo_world_schedule)=20
   and not exists(select 1 from public.demo_world_steps) and not exists(select 1 from public.demo_world_receipts)
   and not exists(select 1 from public.demo_world_profile_target) and not exists(select 1 from public.demo_world_profile_jobs)
   and not exists(select 1 from public.demo_world_profile_receipts);`)==='t','INERT_CLONE_REQUIRED');
  stage='fixtures';
  // Same exact fixture preparation as fast-catalog.sql, limited to fleet01.
  await query(`begin;
   insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(${quote(ordinary)},${quote(ordinary+'@example.invalid')},clock_timestamp(),
    '{"provider":"email","providers":["email"]}','{}');
   update public.profiles set role='TRANSPORTER',active=true,drives_truck=false where id=${quote(ordinary)};
   update public.vehicle_capacity_sharing sharing set mode='BOTH' from public.demo_world_targets target
    where target.target_key=${quote(TARGET)} and sharing.vehicle_id=target.vehicle_id
     and target.expected_sharing_mode='BOTH' and sharing.mode='PUBLIC';
   insert into public.vehicle_driver_locations(vehicle_id,driver_user_id,latitude,longitude,precision_km,area,place_ref,updated_at,observed_at)
    select target.vehicle_id,assignment.driver_user_id,capacity.location_lat,capacity.location_lng,
     capacity.location_precision_km,coalesce(capacity.location_area,'Demo location'),capacity.local_place_ref,clock_timestamp(),clock_timestamp()
    from public.demo_world_targets target
    join public.driver_vehicle_assignments assignment on assignment.vehicle_id=target.vehicle_id and assignment.active
    join lateral(select * from public.capacities row where row.vehicle_id=target.vehicle_id order by updated_at desc,id desc limit 1)capacity on true
    where target.target_key=${quote(TARGET)} on conflict(vehicle_id) do nothing;
   update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
    where target_key<>${quote(TARGET)};
   update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '31 seconds',
    catalog_starts_at=null,last_dispatch_at=null where id=1;commit;`);
  const target=JSON.parse(await query(`select jsonb_build_object('vehicle',target.vehicle_id,'actor',member.user_id)
   from public.demo_world_targets target join public.organization_members member
    on member.organization_id=target.organization_id and member.membership_role='OWNER'
   join auth.users account on account.id=member.user_id
   where target.target_key=${quote(TARGET)} and target.organization_id=${quote(ORGANIZATION)}
    and account.raw_app_meta_data->>'fixture_source'='loadgistic'
    and account.raw_user_meta_data->>'fixture_key'='user-public-fleet-01'
    and (select count(*) from public.organization_members where organization_id=target.organization_id and membership_role='OWNER')=1;`));
  requireValue(/^[a-f0-9-]{36}$/.test(target?.vehicle)&&/^[a-f0-9-]{36}$/.test(target?.actor),'EXACT_DEMO_OWNER_REQUIRED');
  const capacity=JSON.parse(await query(`select row_to_json(claimed) from public.demo_world_claim_batch(${quote(worker)},1)claimed;`));
  requireValue(Number.isSafeInteger(capacity?.step_id)&&/^[a-f0-9-]{36}$/.test(capacity?.lease_token),'CAPACITY_CLAIM_REQUIRED');
  const capacitySql=`select public.demo_world_execute_capacity_step(${capacity.step_id},${quote(capacity.lease_token)})`;

  async function stopFirst(control,command,denial){
   const tag='demo-stop-'+randomUUID();
   const holder=await transaction(`update ${control} set enabled=false where id=1`,tag,true),before=holder.state();
   const next=execute(command);await waiting(next.tag,tag);await finish(holder);
   await deny(next.s,denial);await unchanged(before);
   await query(`update ${control} set enabled=true where id=1;`);races++;
  }
  async function ownerFirst(command,denial,nowait=false){
   const tag='demo-owner-'+randomUUID();
   const holder=await transaction(ownerInsert,tag,true),before=holder.state(),next=execute(command);
   if(nowait){await deny(next.s,denial);await finish(holder);}
   else{await waiting(next.tag,tag);await finish(holder);await deny(next.s,denial);}
   await unchanged(before);
   // A committed normal co-owner also refuses, independent of lock contention.
   const joined=await snapshot();await deny(execute(command).s,denial);await unchanged(joined);
   await removeOwner();races++;
  }
  async function expiredWhileWaiting(table,id,lock,command,denial){
   await query(`update ${table} set lease_expires_at=clock_timestamp()+interval '2 seconds' where id=${id};`);
   const before=await snapshot(),tag='demo-expiry-'+randomUUID();
   const holder=await transaction(lock,tag),next=execute(command);await waiting(next.tag,tag);
   const deadline=Date.now()+5000;let expired=false;
   while(Date.now()<deadline){
    expired=await query(`select clock_timestamp()>=lease_expires_at from ${table} where id=${id};`)==='t';
    if(expired)break;await delay(40);
   }
   requireValue(expired,'TEST_LEASE_EXPIRY_REQUIRED');await finish(holder);await deny(next.s,denial);
   await unchanged(before);
   await query(`update ${table} set lease_expires_at=clock_timestamp()+interval '2 minutes' where id=${id};`);races++;
  }
  async function executorFirst(command,controls,expectedChanged){
   const before=JSON.parse(await snapshot()),tag='demo-accepted-'+randomUUID();
   const holder=await transaction(command,tag);
   const contenders=controls.map(control=>({sql:`update ${control} set enabled=false where id=1`,control}));
   contenders.push({sql:ownerInsert,control:'public.organization_members'});
   for(const item of contenders){Object.assign(item,execute(item.sql));await waiting(item.tag,tag);}
   const result=await finish(holder);requireValue(result.includes('"APPLIED"'),'ACCEPTED_COMMAND_REQUIRED');accepted++;
   for(const item of contenders)requireDemoRaceResult(await item.s.done);
   const after=JSON.parse(await snapshot()),allowed=new Set([...controls,'public.organization_members',...expectedChanged]);
   requireValue(Object.keys(before).every(table=>allowed.has(table)||before[table]===after[table]),'ACCEPTED_COMMAND_SCOPE_CHANGED');
   requireValue(controls.every(control=>before[control]!==after[control])
    &&before['public.organization_members']!==after['public.organization_members'],'STOP_OWNER_COMMIT_REQUIRED');
   const saved=await snapshot();
   requireValue(JSON.parse(await query(command)).result==='REPLAYED','DONE_REPLAY_REQUIRED');
   await unchanged(saved);replays++;races++;
  }

  stage='capacity-stop';await stopFirst('public.demo_world_control',capacitySql,'DEMO_WORLD_LEASE_REFUSED');
  stage='capacity-owner';await ownerFirst(capacitySql,'DEMO_WORLD_ACTOR_REFUSED');
  stage='capacity-expiry';await expiredWhileWaiting('public.demo_world_steps',capacity.step_id,
   `select 1 from public.organizations where id=${quote(ORGANIZATION)} for update`,capacitySql,'DEMO_WORLD_LEASE_REFUSED');
  stage='capacity-accepted';
  const sharingSql=`select md5(coalesce(jsonb_agg(case when policy.vehicle_id=${quote(target.vehicle)}::uuid
    then to_jsonb(policy)-'updated_at'-'updated_by' else to_jsonb(policy) end order by policy.vehicle_id),'[]'::jsonb)::text)
   from public.vehicle_capacity_sharing policy;`;
  const sharingPolicy=await query(sharingSql);
  await executorFirst(capacitySql,['public.demo_world_control'],[
   'public.capacities','public.demo_world_steps','public.demo_world_receipts','public.audit_logs','public.vehicle_capacity_sharing']);
  // The ordinary Capacity command UPSERTs sharing audit metadata even when its
  // policy is unchanged. No recipient/policy/grant delta is authorized here.
  requireValue(sharingPolicy&&await query(sharingSql)===sharingPolicy
   &&await query(`select updated_by=${quote(target.actor)}::uuid from public.vehicle_capacity_sharing
    where vehicle_id=${quote(target.vehicle)};`)==='t','CAPACITY_SHARING_POLICY_CHANGED');
  requireValue(await query(`select (select count(*) from public.demo_world_receipts)=1
   and exists(select 1 from public.demo_world_steps where id=${capacity.step_id} and state='DONE')
   and (select available_percent=80 and status='PARTIAL' from public.capacities
    where vehicle_id=${quote(target.vehicle)} order by updated_at desc,id desc limit 1);`)==='t','CAPACITY_READBACK_REQUIRED');
  await removeOwner();

  stage='profile-fixtures';
  await query(`begin;update public.demo_world_control set enabled=true where id=1;
   insert into public.demo_world_profile_target values(1,${quote(target.actor)},${quote(ORGANIZATION)},${quote(PAGE)});
   select public.accept_content_policy(${quote(target.actor)},'2026-10-09');
   update public.demo_world_profile_control set enabled=true,
    activated_at=(date_trunc('day',clock_timestamp() at time zone 'UTC')-interval '1 day'+interval '8 hours 59 minutes')at time zone 'UTC'
    where id=1;commit;`);
  const profile=JSON.parse(await query(`select row_to_json(claimed) from public.demo_world_claim_profile(${quote(worker)})claimed;`));
  requireValue(Number.isSafeInteger(profile?.job_id)&&/^[a-f0-9-]{36}$/.test(profile?.lease_token),'PROFILE_CLAIM_REQUIRED');
  const profileSql=`select public.demo_world_execute_profile(${profile.job_id},${quote(profile.lease_token)})`;
  const humanCommand=(headline,about)=>`select public.update_provider_profile_page(${quote(target.actor)},
   (select jsonb_build_object('headline',${headline},'about',${about},'services',page.services,
    'base_region_code',page.base_region_code,'published',page.published,
    'contact_phone',page.contact_phone,'contact_whatsapp',page.contact_whatsapp,'contact_email',page.contact_email,
    'contact_website',page.contact_website,'show_contact_phone',page.show_contact_phone,
    'show_contact_whatsapp',page.show_contact_whatsapp,'show_contact_email',page.show_contact_email,
    'show_contact_website',page.show_contact_website) from public.company_pages page where id=${quote(PAGE)}))`;
  stage='profile-global-stop';await stopFirst('public.demo_world_control',profileSql,'DEMO_PROFILE_LEASE_REFUSED');
  stage='profile-lane-stop';await stopFirst('public.demo_world_profile_control',profileSql,'DEMO_PROFILE_LEASE_REFUSED');
  stage='profile-owner';await ownerFirst(profileSql,'DEMO_PROFILE_ACTOR_REFUSED',true);
  stage='profile-human-save';
  {
   const tag='demo-human-'+randomUUID();
   const holder=await transaction(humanCommand(quote('Concurrent human profile save'),quote('Preserved ordinary profile change.')),tag,true);
   const before=holder.state();
   const next=execute(profileSql);await waiting(next.tag,tag);await finish(holder);
   await deny(next.s,'DEMO_PROFILE_STATE_CHANGED');await unchanged(before);
   requireValue(await query(`select headline='Concurrent human profile save' and about='Preserved ordinary profile change.'
    from public.company_pages where id=${quote(PAGE)};`)==='t','HUMAN_SAVE_LOST');
   await query(humanCommand("public.demo_world_profile_copy(2,false)->>'headline'","public.demo_world_profile_copy(2,false)->>'about'")+';');races++;
  }
  stage='profile-expiry';await expiredWhileWaiting('public.demo_world_profile_jobs',profile.job_id,
   `select 1 from public.company_pages where id=${quote(PAGE)} for update`,profileSql,'DEMO_PROFILE_LEASE_REFUSED');
  stage='profile-accepted';await executorFirst(profileSql,['public.demo_world_control','public.demo_world_profile_control'],[
   'public.company_pages','public.demo_world_profile_jobs','public.demo_world_profile_receipts','public.audit_logs']);
  requireValue(await query(`select (select count(*) from public.demo_world_profile_receipts)=1
   and exists(select 1 from public.demo_world_profile_jobs where id=${profile.job_id} and state='DONE')
   and exists(select 1 from public.company_pages where id=${quote(PAGE)}
    and headline=public.demo_world_profile_copy(2,true)->>'headline'
    and about=public.demo_world_profile_copy(2,true)->>'about');`)==='t','PROFILE_READBACK_REQUIRED');
  requireValue(races===10&&waits===12&&denials===10&&accepted===2&&replays===2,'COMPLETE_RACE_MATRIX_REQUIRED');
  emit(JSON.stringify({event:'demo-world-concurrency',ok:true,races,waits,denials,accepted,replays,cloneMustBeRecreated:true}));
  return true;
 }catch(error){
  // No raw SQL/assertion/child output or dynamic fixture identifiers in logs.
  const failure=FAILURE_CODES.has(error?.message)?error.message:'UNCLASSIFIED';
  emit(JSON.stringify({event:'demo-world-concurrency',ok:false,stage,failure,races,waits,denials,accepted,replays,cloneMustBeRecreated:true}));
  return false;
 }finally{for(const session of sessions)session.stop();await Promise.allSettled([...sessions].map(session=>session.done));}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(!await verifyDemoWorldConcurrency())process.exitCode=1;}
 catch{console.error(JSON.stringify({event:'demo-world-concurrency',ok:false,stage:'guard'}));process.exitCode=1;}
}
