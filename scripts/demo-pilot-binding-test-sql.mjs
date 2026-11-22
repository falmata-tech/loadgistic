// Emit rollback-only test SQL for a named disposable database. No connections.
import {readFileSync} from 'node:fs';
import {demoPilotBindingPlan,DEMO_PILOT_SOURCE} from './demo-pilot-binding-policy.mjs';

const database=process.env.LOADGISTIC_TEST_DATABASE;
if(!['loadgistic_telematics_ci','loadgistic_pilot_ci'].includes(database))throw Error('ISOLATED_PILOT_DATABASE_REQUIRED');
const args=process.argv.slice(2),raceSetup=args.length===1&&args[0]==='--owner-race-setup';
if(args.length&&!raceSetup)throw Error('PILOT_TEST_ARGUMENT_DENIED');
if(raceSetup&&process.env.LOADGISTIC_PILOT_RACE_SETUP!=='ALLOW_COMMITTED_DISPOSABLE_PILOT_OWNER_TEST')throw Error('PILOT_RACE_SETUP_OPT_IN_REQUIRED');
const plan=demoPilotBindingPlan(),q=s=>"'"+s.replaceAll("'","''")+"'";
const map=Object.fromEntries(plan.flatMap(p=>Object.keys(p.local).filter(k=>p.local[k]).map(k=>[p.local[k],p.pilot[k]])));
const vehicles=plan.map(p=>q(p.local.vehicleId)+'::uuid').join(',');
const markerKeys=[...new Set(plan.filter(p=>p.eligible).flatMap(p=>[p.ownerKey,...p.driverKeys]))];
const migration=readFileSync(new URL('../supabase/migrations/227_netlify_demo_pilot_binding.sql',import.meta.url),'utf8');
if((migration.match(/^do \$pilot227\$/gm)||[]).length!==1)throw Error('PILOT_MIGRATION_TEST_BOUNDARY_DRIFT');
const callable=migration.replace(/^do \$pilot227\$/m,'create function pg_temp.apply_pilot227() returns void language plpgsql as $pilot227$');
const originalExecutor=readFileSync(new URL('../supabase/migrations/224_curated_demo_capacity_catalog.sql',import.meta.url),'utf8')
 .match(/^create or replace function public\.demo_world_execute_capacity_step\(step_id bigint,lease_token uuid\)\n[\s\S]*?^end \$\$;/m)?.[0];
if(!originalExecutor)throw Error('PILOT_ORIGINAL_CAPACITY_EXECUTOR_REQUIRED');
const seedMigration=readFileSync(new URL('../supabase/migrations/243_demo_seeded_space_bootstrap.sql',import.meta.url),'utf8');
const seededBootstrap=seedMigration.replace(/^begin;\n/m,'').replace(/\ncommit;\s*$/,'');
if(seededBootstrap===seedMigration||/^begin;|^commit;/m.test(seededBootstrap))throw Error('PILOT_SEED_TEST_BOUNDARY_DRIFT');

const verificationSql=`begin;
set local statement_timeout='120s';
set local lock_timeout='5s';
do $guard$ begin
 if current_database()<>${q(database)} or current_setting('loadgistic.demo_isolated_test',true) is distinct from 'true'
  then raise exception 'ISOLATED_PILOT_DATABASE_REQUIRED';end if;
 if not exists(select 1 from public.vehicles where id='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a')
  then raise exception 'LOCAL_FIXTURE_COPY_REQUIRED';end if;
end $guard$;
${originalExecutor}
${migration}
${callable}
create function pg_temp.expect_pilot_denial(expected text) returns void language plpgsql as $fn$
begin
 begin perform pg_temp.apply_pilot227();raise exception 'EXPECTED_PILOT_DENIAL_MISSING';
 exception when others then if sqlerrm<>expected then raise exception 'UNEXPECTED_PILOT_DENIAL:%',sqlerrm;end if;end;
end $fn$;
create function pg_temp.pilot_command_denied(statement text,expected text) returns void language plpgsql as $fn$
begin
 begin execute statement;raise exception 'EXPECTED_PILOT_COMMAND_DENIAL_MISSING';
 exception when others then if sqlerrm<>expected then raise exception 'UNEXPECTED_PILOT_COMMAND_DENIAL:%',sqlerrm;end if;end;
end $fn$;
-- Namespace conversion is test-fixture construction only. Exact original FK and
-- user-trigger settings are restored and validated before migration assertions.
create temp table pilot_fk_before as select c.conrelid::regclass as relation,c.conname,c.condeferrable,c.condeferred
 from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f';
create temp table pilot_trigger_before as select t.tgrelid::regclass as relation,t.tgname,t.tgenabled
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal;
do $fixture$
declare item record;mapping jsonb:=${q(JSON.stringify(map))}::jsonb;identity_id uuid;
begin
 for item in select * from pilot_fk_before loop
  execute format('alter table %s alter constraint %I deferrable initially deferred',item.relation,item.conname);
 end loop;
 set constraints all deferred;
 for item in select distinct relation from pilot_trigger_before loop execute format('alter table %s disable trigger user',item.relation);end loop;
 update public.demo_hosted_motion_control set enabled=false,kill_switch=true,netlify_enabled=false,activated_at=null where id=1;
 delete from public.demo_motion_targets where vehicle_id in(${vehicles});
 delete from public.telematics_devices where synthetic and imei in(${plan.map(p=>q(p.imei)).join(',')});
 delete from public.telematics_gateway_requests where gateway_id in(select g.id from public.telematics_gateways g where g.synthetic_only and not exists(select 1 from public.telematics_devices d where d.gateway_id=g.id));
 delete from public.telematics_privacy_jobs where gateway_id in(select g.id from public.telematics_gateways g where g.synthetic_only and not exists(select 1 from public.telematics_devices d where d.gateway_id=g.id));
 delete from public.telematics_gateways g where g.synthetic_only and not exists(select 1 from public.telematics_devices d where d.gateway_id=g.id);
 delete from public.telematics_location_sources where vehicle_id in(${vehicles});
 delete from public.demo_world_receipts where step_id in(select id from public.demo_world_steps where target_key in(select target_key from public.demo_world_targets));
 delete from public.demo_world_steps where target_key in(select target_key from public.demo_world_targets);
 update public.demo_world_control set enabled=false,activated_at=null,last_dispatch_at=null,catalog_starts_at=null where id=1;
 for item in select c.relname,a.attname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attnum>0
   and not a.attisdropped and a.atttypid='uuid'::regtype and a.attgenerated=''
   and c.relname not like 'demo_%' and c.relname not like 'telematics_%' order by c.relname,a.attnum loop
  execute format('update public.%I set %I=($1->>%I::text)::uuid where $1 ? %I::text',item.relname,item.attname,item.attname,item.attname) using mapping;
 end loop;
 update auth.users set raw_app_meta_data=raw_app_meta_data||jsonb_build_object('fixture_source',${q(DEMO_PILOT_SOURCE)}),
  email='falmatad97+pilot-test-'||(raw_user_meta_data->>'fixture_key')||'@gmail.com'
  where raw_app_meta_data->>'fixture_source'='loadgistic' and raw_user_meta_data->>'fixture_key' in(${markerKeys.map(q).join(',')});
 update public.profiles p set email=u.email from auth.users u where u.id=p.id and u.raw_app_meta_data->>'fixture_source'=${q(DEMO_PILOT_SOURCE)};
 -- The copied development rehearsal may have an authored prior percent report;
 -- this fixture models the inspected hosted unreported-bootstrap condition.
 update public.capacities set available_percent_reported_at=null,available_percent_reported_by=null,available_percent_reported_driver_id=null
  where vehicle_id in(${plan.filter(p=>p.eligible).map(p=>q(p.pilot.vehicleId)+'::uuid').join(',')});
 -- Read-only hosted inspection confirms that the old local-only Tracking
 -- example is absent. Model that prerequisite only in this disposable copy.
 create temp table pilot_legacy_tracking_before as select to_jsonb(s) as payload from public.provider_shipments s where id='a641aca2-f550-4960-94a9-7c1de9e4cd56';
 delete from public.provider_shipments where id='a641aca2-f550-4960-94a9-7c1de9e4cd56';
 set constraints all immediate;
 for item in select * from pilot_trigger_before loop
  execute format('alter table %s %s trigger %I',item.relation,case item.tgenabled when 'D' then 'disable' when 'A' then 'enable always' when 'R' then 'enable replica' else 'enable' end,item.tgname);
 end loop;
 for item in select * from pilot_fk_before loop
  execute format('alter table %s alter constraint %I %s %s',item.relation,item.conname,
   case when item.condeferrable then 'deferrable' else 'not deferrable' end,
   case when item.condeferrable and item.condeferred then 'initially deferred' else 'initially immediate' end);
 end loop;
 if exists(select 1 from pilot_fk_before b join pg_constraint c on c.conrelid=b.relation and c.conname=b.conname
   where c.condeferrable<>b.condeferrable or c.condeferred<>b.condeferred)
  or exists(select 1 from pilot_trigger_before b join pg_trigger t on t.tgrelid=b.relation and t.tgname=b.tgname where t.tgenabled<>b.tgenabled)
  then raise exception 'PILOT_FIXTURE_GUARDS_NOT_RESTORED';end if;
end $fixture$;
create function pg_temp.pilot_public_facts() returns jsonb language plpgsql as $facts$
declare item text;digest text;result jsonb:='{}';begin
 foreach item in array array['profiles','organizations','organization_members','provider_profiles','vehicles','driver_vehicle_assignments','capacities','telematics_location_sources','user_policy_acceptances','provider_shipments','email_deliveries','access_email_deliveries','native_push_outbox','demo_world_tracking_notification_sink','audit_logs'] loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from public.%I t',item) into digest;
  result:=result||jsonb_build_object(item,digest);
 end loop;
 select md5(jsonb_agg(to_jsonb(u) order by u.id)::text) into digest from auth.users u;
 return result||jsonb_build_object('auth_users',digest);
end $facts$;
create function pg_temp.pilot_provision_state() returns jsonb language sql stable as $facts$
 select jsonb_build_object('devices',(select md5(coalesce(jsonb_agg(to_jsonb(d) order by d.id)::text,'[]')) from public.telematics_devices d),
  'audit',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id)::text,'[]')) from public.audit_logs a))
$facts$;
do $negative$
declare owner_id uuid;coowner_id uuid;before_state jsonb;old_meta jsonb;original_definition text;columns_sql text;begin
 before_state:=pg_temp.pilot_public_facts();
 update public.demo_world_control set activated_at=clock_timestamp() where id=1;
 perform pg_temp.expect_pilot_denial('DEMO_PILOT_REQUIRES_UNUSED_CONTROLS');
 update public.demo_world_control set enabled=false,activated_at=null where id=1;
 select string_agg(quote_ident(attname),',' order by attnum) into columns_sql from pg_attribute where attrelid='public.provider_shipments'::regclass and attnum>0 and not attisdropped and attgenerated='';
 execute format('insert into public.provider_shipments(%s) select %s from jsonb_populate_record(null::public.provider_shipments,(select payload from pilot_legacy_tracking_before))',columns_sql,columns_sql);
 perform pg_temp.expect_pilot_denial('DEMO_PILOT_TRACKING_NOT_EMPTY');
 delete from public.provider_shipments where id='a641aca2-f550-4960-94a9-7c1de9e4cd56';
 select m.user_id into owner_id from public.organization_members m where m.organization_id='71f2b553-aa61-4137-bb05-0d5ff2011d34' and m.membership_role='OWNER';
 select raw_app_meta_data into old_meta from auth.users where id=owner_id;
 update auth.users set raw_app_meta_data=raw_app_meta_data-'fixture_source' where id=owner_id;
 perform pg_temp.expect_pilot_denial('DEMO_PILOT_OWNER_DRIFT');
 update auth.users set raw_app_meta_data=old_meta where id=owner_id;
 select id into coowner_id from public.profiles where role='TRANSPORTER' and active and id<>owner_id order by id limit 1;
 insert into public.organization_members(organization_id,user_id,membership_role) values('71f2b553-aa61-4137-bb05-0d5ff2011d34',coowner_id,'OWNER');
 perform pg_temp.expect_pilot_denial('DEMO_PILOT_OWNER_DRIFT');
 delete from public.organization_members where organization_id='71f2b553-aa61-4137-bb05-0d5ff2011d34' and user_id=coowner_id;
 update public.driver_vehicle_assignments set active=false where vehicle_id='8aef1b45-2d81-4296-ae3e-cf10ed4af81c' and active;
 perform pg_temp.expect_pilot_denial('DEMO_PILOT_DRIVER_DRIFT');
 update public.driver_vehicle_assignments set active=true where vehicle_id='8aef1b45-2d81-4296-ae3e-cf10ed4af81c';
 original_definition:=pg_get_functiondef('public.demo_motion_binding(uuid)'::regprocedure);
 execute replace(original_definition,'AS $function$','AS $function$ -- deliberate test drift');
 perform pg_temp.expect_pilot_denial('DEMO_PILOT_DEFINITION_DRIFT:public.demo_motion_binding(uuid)');
 execute original_definition;
 if pg_temp.pilot_public_facts() is distinct from before_state then raise exception 'PILOT_REFUSAL_CHANGED_PUBLIC_FACTS';end if;
end $negative$;
create temp table pilot_public_before as select pg_temp.pilot_public_facts() as facts;
select pg_temp.apply_pilot227();
${seededBootstrap}
do $positive$
declare administrator uuid;gateway uuid:=gen_random_uuid();wrong_gateway uuid:=gen_random_uuid();normal_owner uuid:=gen_random_uuid();
 result jsonb;run_id uuid:=gen_random_uuid();item record;nonce uuid;report jsonb;provision_command jsonb;before_provision jsonb;
 before_sources jsonb;before_notifications jsonb;after_notifications jsonb;counts integer:=0;before_positions bigint;capacity_count integer:=0;job record;columns_sql text;begin
 if pg_temp.pilot_public_facts() is distinct from(select facts from pilot_public_before) then raise exception 'PILOT_MIGRATION_CHANGED_PUBLIC_FACTS';end if;
 if(select count(*) from public.demo_motion_fleet_allowlist)<>5 then raise exception 'PILOT_EXCLUSIONS_FAILED';end if;
 if not exists(select 1 from public.demo_world_targets where target_key='fleet-06-partial' and scenario_pause_code='AUTHORITY_CHANGED')
  then raise exception 'PILOT_OWNER_DRIFT_NOT_PAUSED';end if;
 if not exists(select 1 from public.demo_world_targets where target_key='fleet-02-partial' and scenario_pause_code='STATE_DRIFT')
  then raise exception 'PILOT_SHARING_DRIFT_NOT_PAUSED';end if;
 select id into administrator from public.profiles where active and role='ADMIN' order by id limit 1;
 select jsonb_build_object('email',facts->'email_deliveries','access',facts->'access_email_deliveries','push',facts->'native_push_outbox','sink',facts->'demo_world_tracking_notification_sink') into before_notifications from pilot_public_before;
 -- Exercise the public entry directly before any approved device exists. The
 -- preparer's earlier owner check must not hide a retained-leaf OR bypass.
 perform public.register_telematics_gateway(administrator,gateway,'Pilot direct provision fixture',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),true);
 update public.telematics_gateways set synthetic_transport='NETLIFY_DEMO' where id=gateway;
 perform public.register_telematics_gateway(administrator,wrong_gateway,'Pilot protocol denial fixture',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),true);
 provision_command:=jsonb_build_object('gatewayId',gateway,'gatewayDeviceId',3,'imei','990000000000005','protocol','gt06',
  'protocolDeviceId','990000000000005','label','Pilot direct provisioning test','modelProfile','SYNTHETIC_GT06','synthetic',true,
  'ownerOrganizationId','a1448edf-6fb6-47ff-b7c6-d8d3cd9dbfcd');
 before_provision:=pg_temp.pilot_provision_state();
 perform pg_temp.pilot_command_denied(format('select public.provision_telematics_device(%L,%L::jsonb)',administrator,provision_command||jsonb_build_object('gatewayId',wrong_gateway)),'DEVICE_OWNER_INVALID');
 if pg_temp.pilot_provision_state() is distinct from before_provision then raise exception 'PILOT_PROTOCOL_DENIAL_CHANGED_STATE';end if;
 perform pg_temp.pilot_command_denied(format('select public.provision_telematics_device(%L,%L::jsonb)',administrator,provision_command-'protocol'),'INVALID_TELEMATICS_INPUT');
 if pg_temp.pilot_provision_state() is distinct from before_provision then raise exception 'PILOT_MISSING_PROTOCOL_CHANGED_STATE';end if;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
  values(normal_owner,normal_owner::text||'@example.invalid',clock_timestamp(),'{"provider":"email","providers":["email"]}','{}');
 update public.profiles set role='TRANSPORTER',active=true,full_name='Normal owner provisioning denial' where id=normal_owner;
 insert into public.organization_members(organization_id,user_id,membership_role) values('a1448edf-6fb6-47ff-b7c6-d8d3cd9dbfcd',normal_owner,'OWNER');
 before_provision:=pg_temp.pilot_provision_state();
 perform pg_temp.pilot_command_denied(format('select public.provision_telematics_device(%L,%L::jsonb)',administrator,provision_command),'DEVICE_OWNER_INVALID');
 if pg_temp.pilot_provision_state() is distinct from before_provision then raise exception 'PILOT_COOWNER_PROVISION_CHANGED_STATE';end if;
 delete from public.organization_members where organization_id='a1448edf-6fb6-47ff-b7c6-d8d3cd9dbfcd' and user_id=normal_owner;
 -- Ordinary physical-device enrollment remains the existing admin operation.
 update public.telematics_gateways set synthetic_only=false where id=wrong_gateway;
 result:=public.provision_telematics_device(administrator,provision_command||jsonb_build_object('gatewayId',wrong_gateway,
  'imei','123456789012345','protocolDeviceId','123456789012345','synthetic',false,'modelProfile','UNVERIFIED'));
 if not exists(select 1 from public.telematics_devices where id=(result->>'id')::uuid and not synthetic) then raise exception 'PILOT_REAL_PROVISION_CHANGED';end if;
 before_sources:=pg_temp.pilot_public_facts()->'telematics_location_sources';
 result:=public.prepare_netlify_demo_gateway(administrator,gateway);
 if result->>'deviceCount'<>'7' or result->>'sourceChoicesRequired'<>'7' or result->>'enabled'<>'false'
  then raise exception 'PILOT_PREPARATION_FAILED';end if;
 if pg_temp.pilot_public_facts()->'telematics_location_sources' is distinct from before_sources then raise exception 'PILOT_PREPARATION_CHANGED_SOURCE';end if;
 perform public.prepare_netlify_demo_gateway(administrator,gateway);
 if(select count(*) from public.telematics_devices where gateway_id=gateway)<>7 then raise exception 'PILOT_PREPARATION_NOT_IDEMPOTENT';end if;
 if has_function_privilege('authenticated','public.demo_pilot_provision_allowed227(uuid,uuid,uuid,text)','EXECUTE')
  or has_function_privilege('service_role','public.demo_pilot_provision_allowed227(uuid,uuid,uuid,text)','EXECUTE')
  or has_function_privilege('anon','public.demo_pilot_lock_scope227(uuid,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.demo_pilot_lock_scope227(uuid,uuid)','EXECUTE')
  or has_function_privilege('service_role','public.demo_pilot_lock_scope227(uuid,uuid)','EXECUTE')
  then raise exception 'PILOT_HELPER_PERMISSION_LEAK';end if;
 -- Explicit fixture source choices are separate from setup and create no consent.
 for item in select value from jsonb_array_elements(${q(JSON.stringify(plan.filter(p=>p.eligible)))}::jsonb) loop
  insert into public.telematics_location_sources(vehicle_id,source,precision_km,selected_by)
   select (item.value->'pilot'->>'vehicleId')::uuid,item.value->>'source',5,
    case when item.value->'pilot'->>'organizationId' is null then
     (select user_id from public.provider_profiles where id=(item.value->'pilot'->>'providerProfileId')::uuid)
    else(select user_id from public.organization_members where organization_id=(item.value->'pilot'->>'organizationId')::uuid and membership_role='OWNER')end;
 end loop;
 update public.demo_hosted_motion_control set enabled=true,kill_switch=false,netlify_enabled=true,activated_at=clock_timestamp() where id=1;
 result:=public.netlify_demo_motion_command(gen_random_uuid(),run_id,null,'{"action":"CLAIM"}');
 if result->'targets'<>${q(JSON.stringify(plan.filter(p=>p.eligible).map(p=>p.target)))}::jsonb then raise exception 'PILOT_WINDOW_COHORT_FAILED';end if;
 foreach report in array array['"fleet-03"'::jsonb,'"fleet-06"'::jsonb,'"fleet-08"'::jsonb,'"customer"'::jsonb] loop
  perform pg_temp.pilot_command_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',gen_random_uuid(),run_id,report#>>'{}','{"action":"PREPARE"}'),'DEMO_TARGET_DENIED');
 end loop;
 for item in select value from jsonb_array_elements(${q(JSON.stringify(plan.filter(p=>p.eligible)))}::jsonb) loop
  perform public.netlify_demo_motion_command(gen_random_uuid(),run_id,item.value->>'target','{"action":"PREPARE"}');
 end loop;
 perform pg_sleep(1.2);
 for item in select value from jsonb_array_elements(${q(JSON.stringify(plan.filter(p=>p.eligible)))}::jsonb) loop
  nonce:=gen_random_uuid();report:=jsonb_build_object('action','REPORT',
   'latitude',item.value->'latitude','longitude',item.value->'longitude','speedKph',0,'course',0,'capturedAt',clock_timestamp());
  result:=public.netlify_demo_motion_command(nonce,run_id,item.value->>'target',report);
  if result->>'recorded'<>'true' then raise exception 'PILOT_REPORT_FAILED';end if;counts:=counts+1;
  select count(*) into before_positions from public.telematics_positions;
  perform pg_temp.pilot_command_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',nonce,run_id,item.value->>'target',report),'DEMO_REQUEST_DENIED');
  if(select count(*) from public.telematics_positions)<>before_positions then raise exception 'PILOT_REPLAY_CHANGED_POSITION';end if;
 end loop;
 if counts<>7 or(select count(*) from public.demo_motion_targets where state='RUNNING')<>7 then raise exception 'PILOT_REPORT_COUNT_FAILED';end if;
 if public.telematics_is_demo_owner((select user_id from public.provider_profiles where id='8c8e2564-15d5-4ebf-89a2-53c916d71c6d'))
  then raise exception 'PILOT_ENGINE_COMMAND_AUTHORITY_EXPANDED';end if;
 update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '121 seconds',catalog_starts_at=null,last_dispatch_at=null where id=1;
 for job in select * from public.demo_world_claim_batch(gen_random_uuid(),3) loop
  result:=public.demo_world_execute_capacity_step(job.step_id,job.lease_token);
  if result->>'result'<>'APPLIED' then raise exception 'PILOT_CAPACITY_NOT_APPLIED';end if;capacity_count:=capacity_count+1;
 end loop;
 if capacity_count<>3 or(select count(*) from public.demo_world_receipts)<>3 then raise exception 'PILOT_CAPACITY_COUNT_FAILED';end if;
 -- Even if the old reserved ID reappears, its changed pilot provenance cannot
 -- use the local-only notification sink or produce an outbound intent.
 select string_agg(quote_ident(attname),',' order by attnum) into columns_sql from pg_attribute where attrelid='public.provider_shipments'::regclass and attnum>0 and not attisdropped and attgenerated='';
 execute format('insert into public.provider_shipments(%s) select %s from jsonb_populate_record(null::public.provider_shipments,(select payload from pilot_legacy_tracking_before))',columns_sql,columns_sql);
 perform pg_temp.pilot_command_denied('update public.demo_world_control set enabled=true where id=1','DEMO_WORLD_TRACKING_SCOPE_CHANGED');
 perform pg_temp.pilot_command_denied($outbound$insert into public.email_deliveries(id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
  values(gen_random_uuid(),'a641aca2-f550-4960-94a9-7c1de9e4cd56','SHIPPER','TRACKING_ACCESS','demo.shipper@example.test','pilot227-denied-outbound','PENDING')$outbound$,'DEMO_WORLD_TRACKING_SCOPE_CHANGED');
 delete from public.provider_shipments where id='a641aca2-f550-4960-94a9-7c1de9e4cd56';
 perform pg_temp.pilot_command_denied('update public.demo_world_tracking_lifecycle_control set armed=true where id=1','DEMO_TRACKING_RESERVATION_NOT_READY');
 perform pg_temp.pilot_command_denied('update public.demo_world_tracking_live_control set armed=true where id=1','DEMO_TRACKING_RESERVATION_NOT_READY');
 select count(*) into before_positions from public.telematics_positions;
 update public.demo_world_control set enabled=false where id=1;
 update public.demo_hosted_motion_control set enabled=false,kill_switch=true,netlify_enabled=false where id=1;
 if exists(select 1 from public.demo_motion_targets where state='RUNNING')
  or exists(select 1 from public.demo_motion_netlify_window w where w.run_id is not null)
  or(select count(*) from public.telematics_positions)<>before_positions then raise exception 'PILOT_STOP_FAILED';end if;
 select jsonb_build_object('email',facts->'email_deliveries','access',facts->'access_email_deliveries','push',facts->'native_push_outbox','sink',facts->'demo_world_tracking_notification_sink') into after_notifications from(select pg_temp.pilot_public_facts() as facts) current_facts;
 if after_notifications is distinct from before_notifications then raise exception 'PILOT_CHANGED_NOTIFICATION_QUEUES';end if;
end $positive$;
select jsonb_build_object('event','pilot_binding_sql','ok',true,'targets',7,'excluded',3,'capacityPhases',3,'publicFactsPreserved',true,'rolledBack',true);
rollback;
`;
if(!raceSetup)process.stdout.write(verificationSql);
else{
 const boundary='\ndo $positive$\n';
 if(verificationSql.split(boundary).length!==2)throw Error('PILOT_RACE_SETUP_BOUNDARY_DRIFT');
 process.stdout.write(verificationSql.split(boundary)[0]+`
-- Explicitly opted-in disposable committed fixture for real multi-session races.
do $race_setup$
declare administrator uuid;gateway uuid:=gen_random_uuid();normal_owner uuid:=gen_random_uuid();item record;begin
 select id into administrator from public.profiles where active and role='ADMIN' order by id limit 1;
 perform public.prepare_netlify_demo_gateway(administrator,gateway);
 for item in select value from jsonb_array_elements(${q(JSON.stringify(plan.filter(p=>p.eligible)))}::jsonb) loop
  insert into public.telematics_location_sources(vehicle_id,source,precision_km,selected_by)
   select (item.value->'pilot'->>'vehicleId')::uuid,item.value->>'source',5,
    case when item.value->'pilot'->>'organizationId' is null then
     (select user_id from public.provider_profiles where id=(item.value->'pilot'->>'providerProfileId')::uuid)
    else(select user_id from public.organization_members where organization_id=(item.value->'pilot'->>'organizationId')::uuid and membership_role='OWNER')end;
 end loop;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
  values(normal_owner,normal_owner::text||'@example.invalid',clock_timestamp(),'{"provider":"email","providers":["email"]}',
   '{"fixture_key":"pilot227-owner-race-normal"}');
 update public.profiles set role='TRANSPORTER',active=true,full_name='Pilot owner race normal co-owner' where id=normal_owner;
 -- Empty exact device slots exercise public provisioning, then the ordinary
 -- preparer restores/assigns them before motion races. No report exists yet.
 delete from public.telematics_devices where gateway_id=gateway and imei in('990000000000005','990000000000006');
end $race_setup$;
select jsonb_build_object('event','pilot_owner_race_setup','committedFixture',true,'isolated',true);
commit;
`);
}
