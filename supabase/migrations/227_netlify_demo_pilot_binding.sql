-- FEAT-SIM-001 / ADR-087. Exact existing production-pilot compatibility.
-- This single DO statement is atomic and can also run inside rollback-only tests.
-- Empty/fresh local databases keep the installed local contracts. Hosted execution
-- still requires exact owner review, backup/restore/rehearsal and source gates.
do $pilot227$
declare plan jsonb:='[{"target":"company-truck","eligible":true,"vehicleKey":"veh-trans-1","ownerKey":"user-transporter","driverKeys":["user-company-driver","user-transporter"],"imei":"990000000000001","source":"GPS","latitude":9.031,"longitude":38.748,"slot":1,"local":{"vehicleId":"caf1d0db-4d8e-4ce9-a879-6c7b6017de3a","organizationId":"6727b198-d771-436a-9f1f-7bf27b8cea2f","providerProfileId":null},"pilot":{"vehicleId":"8aef1b45-2d81-4296-ae3e-cf10ed4af81c","organizationId":"71f2b553-aa61-4137-bb05-0d5ff2011d34","providerProfileId":null}},{"target":"personal-truck","eligible":true,"vehicleKey":"veh-driver-1","ownerKey":"user-driver","driverKeys":["user-driver"],"imei":"990000000000002","source":"MOBILE","latitude":9.03,"longitude":38.76,"slot":2,"local":{"vehicleId":"2f22cc5a-d654-4405-98b7-9a1a9cf42fe3","organizationId":null,"providerProfileId":"c640c548-ada2-4b9e-ac3c-235585525a6f"},"pilot":{"vehicleId":"8e21d4b2-e392-4e30-90da-84a6b03f8f9d","organizationId":null,"providerProfileId":"8c8e2564-15d5-4ebf-89a2-53c916d71c6d"}},{"target":"fleet-01","eligible":true,"vehicleKey":"veh-public-fleet-01-14","ownerKey":"user-public-fleet-01","driverKeys":["user-public-fleet-driver-014"],"imei":"990000000000005","source":"GPS","latitude":9.015,"longitude":38.704,"slot":3,"local":{"vehicleId":"2020967a-92d3-4b1d-8f40-3c670dc97a50","organizationId":"c36022ff-bf3e-432d-ae96-93d1537cf79e","providerProfileId":null},"pilot":{"vehicleId":"3f5b6847-e7fc-4057-85af-b520e80cd944","organizationId":"a1448edf-6fb6-47ff-b7c6-d8d3cd9dbfcd","providerProfileId":null}},{"target":"fleet-02","eligible":true,"vehicleKey":"veh-public-fleet-02-3","ownerKey":"user-public-fleet-02","driverKeys":["user-public-fleet-driver-018"],"imei":"990000000000006","source":"GPS","latitude":8.5,"longitude":39.212,"slot":4,"local":{"vehicleId":"19838ed9-c898-43dd-a6d5-5d4c26d0e92d","organizationId":"43db4203-8bec-4494-9ed2-0d9952c9e300","providerProfileId":null},"pilot":{"vehicleId":"3b10d829-19c5-497a-a1d9-5640b87f21f8","organizationId":"47e536ac-bc2a-4a4f-a3ef-65f1acca1f79","providerProfileId":null}},{"target":"fleet-03","eligible":false,"vehicleKey":"veh-public-fleet-03-7","ownerKey":"user-public-fleet-03","driverKeys":["user-public-fleet-driver-037"],"imei":"990000000000007","source":"GPS","latitude":11.459,"longitude":37.303,"slot":5,"local":{"vehicleId":"2c449a7d-d26d-4eeb-aa64-7f4ba9f33c9d","organizationId":"b2bca706-2f47-4d28-bad0-a028d017413d","providerProfileId":null},"pilot":{"vehicleId":"559d49fb-a410-4dd9-bd91-93d542308f48","organizationId":"3c57cf8b-fa30-41d9-a62e-4d1a10ae423b","providerProfileId":null}},{"target":"fleet-04","eligible":true,"vehicleKey":"veh-public-fleet-04-14","ownerKey":"user-public-fleet-04","driverKeys":["user-public-fleet-driver-059"],"imei":"990000000000008","source":"GPS","latitude":13.468,"longitude":39.491,"slot":6,"local":{"vehicleId":"0088dba7-04c7-425e-b5a9-64b721a753f0","organizationId":"8efdd114-47be-4e3d-bf11-b6bc24d2c511","providerProfileId":null},"pilot":{"vehicleId":"173f14af-1ef4-4ca8-9bf7-38978ec4a680","organizationId":"89d8060b-9949-4186-b8c7-22b0936bd036","providerProfileId":null}},{"target":"fleet-05","eligible":true,"vehicleKey":"veh-public-fleet-05-13","ownerKey":"user-public-fleet-05","driverKeys":["user-public-fleet-driver-073"],"imei":"990000000000009","source":"GPS","latitude":11.783,"longitude":41.014,"slot":7,"local":{"vehicleId":"5bf57d7a-2159-45f9-9f90-3cdef5ed43d8","organizationId":"750641af-6014-4f80-9116-3e6f79e8104e","providerProfileId":null},"pilot":{"vehicleId":"2e3244d4-570a-4287-bfb6-2eba9d4590a4","organizationId":"06572edc-b92d-433d-ae6b-cefe36d31877","providerProfileId":null}},{"target":"fleet-06","eligible":false,"vehicleKey":"veh-public-fleet-06-5","ownerKey":"user-public-fleet-06","driverKeys":["user-public-fleet-driver-080"],"imei":"990000000000010","source":"GPS","latitude":9.35,"longitude":42.793,"slot":8,"local":{"vehicleId":"0dc90cf6-7735-4ccc-b030-98a81c40ffd6","organizationId":"22dd3b30-0bc5-4fdf-810b-3aee3081ac19","providerProfileId":null},"pilot":{"vehicleId":"bea4baf1-4fea-4a97-a5b4-34607d4e9b39","organizationId":"393bf3e0-0637-44f4-8044-696ed5949414","providerProfileId":null}},{"target":"fleet-07","eligible":true,"vehicleKey":"veh-public-fleet-07-14","ownerKey":"user-public-fleet-07","driverKeys":["user-public-fleet-driver-104"],"imei":"990000000000011","source":"GPS","latitude":9.299,"longitude":41.867,"slot":9,"local":{"vehicleId":"02c0a10d-3b4b-4b83-9f85-6272f8b6ce95","organizationId":"94cc36ee-eb4b-4bd5-b8af-2485fe9a64f5","providerProfileId":null},"pilot":{"vehicleId":"becd7873-1e09-4979-a4bc-338f2b4104d2","organizationId":"b455600c-bbac-4426-ad88-ca233235272d","providerProfileId":null}},{"target":"fleet-08","eligible":false,"vehicleKey":"veh-public-fleet-08-2","ownerKey":"user-public-fleet-08","driverKeys":["user-public-fleet-driver-107"],"imei":"990000000000012","source":"GPS","latitude":9.701,"longitude":41.827,"slot":10,"local":{"vehicleId":"28b05503-eb24-4b78-8646-6a1813207813","organizationId":"97eafa4d-0c1f-462f-9f3b-acead2853909","providerProfileId":null},"pilot":{"vehicleId":"79ad2b14-15a0-4054-b799-994cd955afa8","organizationId":"7dc66a37-d62f-4831-9591-e2fb00f28cfd","providerProfileId":null}}]'::jsonb;
 remap jsonb:='{"caf1d0db-4d8e-4ce9-a879-6c7b6017de3a":"8aef1b45-2d81-4296-ae3e-cf10ed4af81c","6727b198-d771-436a-9f1f-7bf27b8cea2f":"71f2b553-aa61-4137-bb05-0d5ff2011d34","2f22cc5a-d654-4405-98b7-9a1a9cf42fe3":"8e21d4b2-e392-4e30-90da-84a6b03f8f9d","c640c548-ada2-4b9e-ac3c-235585525a6f":"8c8e2564-15d5-4ebf-89a2-53c916d71c6d","2020967a-92d3-4b1d-8f40-3c670dc97a50":"3f5b6847-e7fc-4057-85af-b520e80cd944","c36022ff-bf3e-432d-ae96-93d1537cf79e":"a1448edf-6fb6-47ff-b7c6-d8d3cd9dbfcd","19838ed9-c898-43dd-a6d5-5d4c26d0e92d":"3b10d829-19c5-497a-a1d9-5640b87f21f8","43db4203-8bec-4494-9ed2-0d9952c9e300":"47e536ac-bc2a-4a4f-a3ef-65f1acca1f79","2c449a7d-d26d-4eeb-aa64-7f4ba9f33c9d":"559d49fb-a410-4dd9-bd91-93d542308f48","b2bca706-2f47-4d28-bad0-a028d017413d":"3c57cf8b-fa30-41d9-a62e-4d1a10ae423b","0088dba7-04c7-425e-b5a9-64b721a753f0":"173f14af-1ef4-4ca8-9bf7-38978ec4a680","8efdd114-47be-4e3d-bf11-b6bc24d2c511":"89d8060b-9949-4186-b8c7-22b0936bd036","5bf57d7a-2159-45f9-9f90-3cdef5ed43d8":"2e3244d4-570a-4287-bfb6-2eba9d4590a4","750641af-6014-4f80-9116-3e6f79e8104e":"06572edc-b92d-433d-ae6b-cefe36d31877","0dc90cf6-7735-4ccc-b030-98a81c40ffd6":"bea4baf1-4fea-4a97-a5b4-34607d4e9b39","22dd3b30-0bc5-4fdf-810b-3aee3081ac19":"393bf3e0-0637-44f4-8044-696ed5949414","02c0a10d-3b4b-4b83-9f85-6272f8b6ce95":"becd7873-1e09-4979-a4bc-338f2b4104d2","94cc36ee-eb4b-4bd5-b8af-2485fe9a64f5":"b455600c-bbac-4426-ad88-ca233235272d","28b05503-eb24-4b78-8646-6a1813207813":"79ad2b14-15a0-4054-b799-994cd955afa8","97eafa4d-0c1f-462f-9f3b-acead2853909":"7dc66a37-d62f-4831-9591-e2fb00f28cfd"}'::jsonb;
 binding record;item record;original record;changed record;definition text;patched text;
 owner_id uuid;driver_id uuid;expected_org uuid;expected_provider uuid;namespace_seen boolean;
 namespace_anchor text:=$ns227$->>'fixture_source'='loadgistic'$ns227$;
 old_values text:=$old227$  ('company-truck','caf1d0db-4d8e-4ce9-a879-6c7b6017de3a'::uuid),
  ('personal-truck','2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'::uuid),
  ('fleet-01','2020967a-92d3-4b1d-8f40-3c670dc97a50'::uuid),
  ('fleet-02','19838ed9-c898-43dd-a6d5-5d4c26d0e92d'::uuid),
  ('fleet-03','2c449a7d-d26d-4eeb-aa64-7f4ba9f33c9d'::uuid),
  ('fleet-04','0088dba7-04c7-425e-b5a9-64b721a753f0'::uuid),
  ('fleet-05','5bf57d7a-2159-45f9-9f90-3cdef5ed43d8'::uuid),
  ('fleet-06','0dc90cf6-7735-4ccc-b030-98a81c40ffd6'::uuid),
  ('fleet-07','02c0a10d-3b4b-4b83-9f85-6272f8b6ce95'::uuid),
  ('fleet-08','28b05503-eb24-4b78-8646-6a1813207813'::uuid)$old227$;
 new_values text:=$new227$  ('company-truck','8aef1b45-2d81-4296-ae3e-cf10ed4af81c'::uuid),
  ('personal-truck','8e21d4b2-e392-4e30-90da-84a6b03f8f9d'::uuid),
  ('fleet-01','3f5b6847-e7fc-4057-85af-b520e80cd944'::uuid),
  ('fleet-02','3b10d829-19c5-497a-a1d9-5640b87f21f8'::uuid),
  ('fleet-04','173f14af-1ef4-4ca8-9bf7-38978ec4a680'::uuid),
  ('fleet-05','2e3244d4-570a-4287-bfb6-2eba9d4590a4'::uuid),
  ('fleet-07','becd7873-1e09-4979-a4bc-338f2b4104d2'::uuid)$new227$;
 control_active boolean;engine_guard_md5 text;tracking_boundaries jsonb;
begin
 perform pg_advisory_xact_lock(8030227);
 perform set_config('lock_timeout','5s',true);
 perform set_config('statement_timeout','60s',true);
 select exists(select 1 from auth.users where raw_app_meta_data->>'fixture_source'='loadgistic-production-pilot-v1') into namespace_seen;
 if not namespace_seen then return;end if;
 if exists(select 1 from public.vehicles where id in(select key::uuid from jsonb_each_text(remap)))
  then raise exception 'DEMO_PILOT_MIXED_NAMESPACE';end if;
 -- Global control precedes the other controls, matching normal Capacity commands.
 perform 1 from public.demo_world_control where id=1 for update;
 if not exists(select 1 from public.demo_world_control where id=1 and not enabled
   and activated_at is null and last_dispatch_at is null and catalog_version=2)
  then raise exception 'DEMO_PILOT_REQUIRES_UNUSED_CONTROLS';end if;
 for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'demo_%_control'
   and c.relname<>'demo_world_control' and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='enabled' and not a.attisdropped)
  order by c.relname loop
  execute format('select enabled from public.%I where id=1 for update',item.relname) into control_active;
  if control_active is distinct from false then raise exception 'DEMO_PILOT_REQUIRES_UNUSED_CONTROLS';end if;
 end loop;
 if not exists(select 1 from public.demo_hosted_motion_control where id=1 and not enabled and kill_switch and not netlify_enabled and activated_at is null)
  or exists(select 1 from public.demo_world_steps) or exists(select 1 from public.demo_world_receipts)
  or exists(select 1 from public.demo_motion_targets) or exists(select 1 from public.telematics_gateways)
  or exists(select 1 from public.telematics_devices) or exists(select 1 from public.telematics_positions)
  or exists(select 1 from public.demo_motion_netlify_window where run_id is not null)
  or (select count(*) from public.demo_world_targets)<>5
  or (select count(*) from public.demo_motion_fleet_allowlist)<>8
  then raise exception 'DEMO_PILOT_REQUIRES_UNUSED_CONTROLS';end if;
 if exists(select 1 from public.demo_world_targets t where not(remap ? t.vehicle_id::text))
  or exists(select 1 from public.demo_motion_fleet_allowlist t where not(remap ? t.vehicle_id::text) or not(remap ? t.organization_id::text))
  then raise exception 'DEMO_PILOT_CATALOG_DRIFT';end if;
 -- This hosted lane is Capacity plus movement. The old local Tracking example
 -- must be absent, and both separately reviewed Tracking reservations disarmed.
 perform 1 from public.demo_world_tracking_lifecycle_control where id=1 and not armed for update;
 if not found then raise exception 'DEMO_PILOT_TRACKING_NOT_EMPTY';end if;
 perform 1 from public.demo_world_tracking_live_control where id=1 and not armed for update;
 if not found or exists(select 1 from public.provider_shipments where id='a641aca2-f550-4960-94a9-7c1de9e4cd56')
  then raise exception 'DEMO_PILOT_TRACKING_NOT_EMPTY';end if;
 -- Only the seven reviewed scopes qualify. Excluded records are never repaired.
 for binding in select value from jsonb_array_elements(plan) where (value->>'eligible')::boolean loop
  expected_org:=(binding.value->'pilot'->>'organizationId')::uuid;
  expected_provider:=(binding.value->'pilot'->>'providerProfileId')::uuid;
  if not public.telematics_lock_owner_scope(expected_org,expected_provider) then raise exception 'DEMO_PILOT_OWNER_DRIFT';end if;
  if expected_org is not null then
   if(select count(*) from public.organization_members where organization_id=expected_org and membership_role='OWNER')<>1
    then raise exception 'DEMO_PILOT_OWNER_DRIFT';end if;
   select user_id into owner_id from public.organization_members where organization_id=expected_org and membership_role='OWNER';
  else select user_id into owner_id from public.provider_profiles where id=expected_provider;end if;
  perform u.id from auth.users u join public.profiles p on p.id=u.id and p.active
   where u.id=owner_id and u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic-production-pilot-v1'
    and u.raw_user_meta_data->>'fixture_key'=binding.value->>'ownerKey'
    and lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$' for share of u,p;
  if not found then raise exception 'DEMO_PILOT_OWNER_DRIFT';end if;
  perform 1 from public.vehicles v where v.id=(binding.value->'pilot'->>'vehicleId')::uuid
   and v.active and v.publication_status='LIVE' and v.organization_id is not distinct from expected_org
   and v.provider_profile_id is not distinct from expected_provider for update;
  if not found then raise exception 'DEMO_PILOT_VEHICLE_DRIFT';end if;
  perform 1 from public.driver_vehicle_assignments where vehicle_id=(binding.value->'pilot'->>'vehicleId')::uuid and active for share;
  if(select count(*) from public.driver_vehicle_assignments where vehicle_id=(binding.value->'pilot'->>'vehicleId')::uuid and active)<>1
   then raise exception 'DEMO_PILOT_DRIVER_DRIFT';end if;
  select driver_user_id into driver_id from public.driver_vehicle_assignments where vehicle_id=(binding.value->'pilot'->>'vehicleId')::uuid and active;
  perform u.id from auth.users u join public.profiles p on p.id=u.id and p.active where u.id=driver_id and u.deleted_at is null
   and u.raw_app_meta_data->>'fixture_source'='loadgistic-production-pilot-v1'
   and (binding.value->'driverKeys') ? (u.raw_user_meta_data->>'fixture_key')
   and lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$' for share of u,p;
  if not found then raise exception 'DEMO_PILOT_DRIVER_DRIFT';end if;
 end loop;
 -- Pin every definition before any DDL; CREATE OR REPLACE must preserve metadata.
 for item in select * from(values
  ('public.demo_motion_binding(uuid)','c5add8c618d73751b9ebc8a4735d7241'),
  ('public.demo_motion_binding_fleet(uuid)','0ab2366e989664052d79f01d45478425'),
  ('public.hosted_demo_motion_command(uuid,uuid,jsonb)','e13e180e696b103f183aad89dbd10141'),
  ('public.netlify_demo_motion_command(uuid,uuid,text,jsonb)','a0a25836eacf614e3349432bc5acffbd'),
  ('public.prepare_netlify_demo_gateway(uuid,uuid)','39b789f806a488fe20e48a318802c565'),
  ('public.provision_telematics_device_pre_privacy154(uuid,jsonb)','3bcb7dc5e02bf258706981f5345e2474'),
  ('public.demo_world_execute_capacity_step(bigint,uuid)','4195ca9ad49df3a00737e014d9700107'),
  ('public.capacity_owner_documents(uuid[],uuid[])','334de08c716bbb6b335c4e8c9f4e6b94'),
  ('public.demo_world_tracking_activation_guard()','4f5ff1725fbacf5cb004f4be424c3c9f')
 ) expected(signature,body_md5) loop
  select p.* into original from pg_proc p where p.oid=to_regprocedure(item.signature);
  if not found or md5(original.prosrc)<>item.body_md5 or not original.prosecdef
   then raise exception 'DEMO_PILOT_DEFINITION_DRIFT:%',item.signature;end if;
 end loop;
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.demo_motion_targets'::regclass
   and conname='demo_motion_targets_vehicle_id_check') is distinct from 'd2e62504729100be8f3ae4f108992614'
  then raise exception 'DEMO_PILOT_CONSTRAINT_DRIFT';end if;
 select md5(pg_get_functiondef('public.telematics_is_demo_owner(uuid)'::regprocedure)) into engine_guard_md5;
 select jsonb_object_agg(p.oid::text,md5(to_jsonb(p)::text)) into tracking_boundaries from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'demo_world%tracking%' and p.proname<>'demo_world_tracking_activation_guard';
 execute $helper227$
 create function public.demo_pilot_provision_allowed227(target_owner uuid,owner_org uuid,owner_profile uuid,requested_imei text)
 returns boolean language sql stable security definer set search_path=public,pg_temp as $body227$
 select exists(select 1 from(values
  ('990000000000001','71f2b553-aa61-4137-bb05-0d5ff2011d34'::uuid,null::uuid,'user-transporter'),
  ('990000000000002',null::uuid,'8c8e2564-15d5-4ebf-89a2-53c916d71c6d'::uuid,'user-driver'),
  ('990000000000005','a1448edf-6fb6-47ff-b7c6-d8d3cd9dbfcd'::uuid,null::uuid,'user-public-fleet-01'),
  ('990000000000006','47e536ac-bc2a-4a4f-a3ef-65f1acca1f79'::uuid,null::uuid,'user-public-fleet-02'),
  ('990000000000008','89d8060b-9949-4186-b8c7-22b0936bd036'::uuid,null::uuid,'user-public-fleet-04'),
  ('990000000000009','06572edc-b92d-433d-ae6b-cefe36d31877'::uuid,null::uuid,'user-public-fleet-05'),
  ('990000000000011','b455600c-bbac-4426-ad88-ca233235272d'::uuid,null::uuid,'user-public-fleet-07')
 ) allowed(imei,organization_id,provider_profile_id,owner_key)
 join auth.users u on u.id=target_owner and u.deleted_at is null
 join public.profiles p on p.id=u.id and p.active
 where allowed.imei=requested_imei and allowed.organization_id is not distinct from owner_org
  and allowed.provider_profile_id is not distinct from owner_profile
  and u.raw_app_meta_data->>'fixture_source'='loadgistic-production-pilot-v1' and u.raw_user_meta_data->>'fixture_key'=allowed.owner_key
  and lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$'
  and (owner_org is not null and p.role='TRANSPORTER'
   and(select count(*) from public.organization_members m where m.organization_id=owner_org and m.membership_role='OWNER')=1
   and exists(select 1 from public.organization_members m where m.organization_id=owner_org and m.user_id=target_owner and m.membership_role='OWNER')
   or owner_profile is not null and p.role='DRIVER' and exists(select 1 from public.provider_profiles pp where pp.id=owner_profile and pp.user_id=target_owner)))
 $body227$;
 $helper227$;
 execute 'revoke all on function public.demo_pilot_provision_allowed227(uuid,uuid,uuid,text) from public,anon,authenticated,service_role';
 for item in select unnest(array['public.demo_motion_binding(uuid)','public.demo_motion_binding_fleet(uuid)','public.hosted_demo_motion_command(uuid,uuid,jsonb)','public.netlify_demo_motion_command(uuid,uuid,text,jsonb)','public.prepare_netlify_demo_gateway(uuid,uuid)','public.provision_telematics_device_pre_privacy154(uuid,jsonb)','public.demo_world_execute_capacity_step(bigint,uuid)','public.capacity_owner_documents(uuid[],uuid[])','public.demo_world_tracking_activation_guard()']) as signature loop
  select p.oid,p.proowner,p.proacl,p.proconfig,p.provolatile,p.prolang,p.prosecdef into original from pg_proc p where p.oid=item.signature::regprocedure;
  definition:=pg_get_functiondef(original.oid);patched:=definition;
  if item.signature in('public.hosted_demo_motion_command(uuid,uuid,jsonb)','public.netlify_demo_motion_command(uuid,uuid,text,jsonb)') then
   if(length(patched)-length(replace(patched,old_values,'')))/length(old_values)<>1 then raise exception 'DEMO_PILOT_ANCHOR_DRIFT';end if;
   patched:=replace(patched,old_values,new_values);
  end if;
  for binding in select key,value from jsonb_each_text(remap) loop patched:=replace(patched,binding.key,binding.value);end loop;
  if item.signature='public.capacity_owner_documents(uuid[],uuid[])' then
   patched:=replace(patched,namespace_anchor,$both227$->>'fixture_source' in('loadgistic','loadgistic-production-pilot-v1')$both227$);
  else patched:=replace(patched,namespace_anchor,$pilotns227$->>'fixture_source'='loadgistic-production-pilot-v1'$pilotns227$);end if;
  if item.signature='public.prepare_netlify_demo_gateway(uuid,uuid)' then
   if position('jsonb_array_length(bindings)<>10' in patched)=0 then raise exception 'DEMO_PILOT_ANCHOR_DRIFT';end if;
   patched:=replace(patched,'jsonb_array_length(bindings)<>10','jsonb_array_length(bindings)<>7');
   patched:=replace(patched,'''deviceCount'',10','''deviceCount'',7');
  elsif item.signature='public.provision_telematics_device_pre_privacy154(uuid,jsonb)' then
   if position('not (public.telematics_is_demo_owner(owner_id) or' in patched)=0 then raise exception 'DEMO_PILOT_ANCHOR_DRIFT';end if;
   patched:=replace(patched,'not (public.telematics_is_demo_owner(owner_id) or',
    'not (public.demo_pilot_provision_allowed227(owner_id,owner_org,owner_profile,command->>''imei'') or public.telematics_is_demo_owner(owner_id) or');
  elsif item.signature='public.netlify_demo_motion_command(uuid,uuid,text,jsonb)' then
   if position($claim227$return jsonb_build_object('claimed',true,'expiresAt',window_row.expires_at);$claim227$ in patched)=0
    then raise exception 'DEMO_PILOT_ANCHOR_DRIFT';end if;
   patched:=replace(patched,$claim227$return jsonb_build_object('claimed',true,'expiresAt',window_row.expires_at);$claim227$,
    $claimnew227$return jsonb_build_object('claimed',true,'expiresAt',window_row.expires_at,'targets',jsonb_build_array('company-truck','personal-truck','fleet-01','fleet-02','fleet-04','fleet-05','fleet-07'));$claimnew227$);
  elsif item.signature='public.demo_world_tracking_activation_guard()' then
   -- Preserve isolation/advisory locking and every pending-outbox check. This
   -- mode refuses any local Tracking example instead of enrolling it or changing
   -- its notification interceptors. Reserved Tracking arming guards are intact.
   if position($oldguard227$if new.manifest_version<>1 or not public.demo_world_tracking_fixture_isolated(
      'a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid) then$oldguard227$ in patched)=0 then raise exception 'DEMO_PILOT_ANCHOR_DRIFT';end if;
   patched:=replace(patched,$oldguard227$if new.manifest_version<>1 or not public.demo_world_tracking_fixture_isolated(
      'a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid) then$oldguard227$,
    $newguard227$if new.manifest_version<>1
    or exists(select 1 from public.provider_shipments where id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid)
    or not exists(select 1 from public.demo_world_tracking_lifecycle_control where id=1 and not armed)
    or not exists(select 1 from public.demo_world_tracking_live_control where id=1 and not armed) then$newguard227$);
  end if;
  if patched=definition then raise exception 'DEMO_PILOT_ANCHOR_DRIFT';end if;
  execute patched;
  select p.oid,p.proowner,p.proacl,p.proconfig,p.provolatile,p.prolang,p.prosecdef into changed from pg_proc p where p.oid=item.signature::regprocedure;
  if changed.oid<>original.oid or changed.proowner<>original.proowner or changed.proacl is distinct from original.proacl
   or changed.proconfig is distinct from original.proconfig or changed.provolatile<>original.provolatile
   or changed.prolang<>original.prolang or changed.prosecdef is distinct from original.prosecdef
   then raise exception 'DEMO_PILOT_METADATA_DRIFT';end if;
 end loop;
 -- These are private, unused simulator catalog rows; public ownership is untouched.
 delete from public.demo_motion_fleet_allowlist where vehicle_id in('2c449a7d-d26d-4eeb-aa64-7f4ba9f33c9d'::uuid,'0dc90cf6-7735-4ccc-b030-98a81c40ffd6'::uuid,'28b05503-eb24-4b78-8646-6a1813207813'::uuid);
 update public.demo_motion_fleet_allowlist set vehicle_id=(remap->>vehicle_id::text)::uuid,organization_id=(remap->>organization_id::text)::uuid;
 update public.demo_world_targets set vehicle_id=(remap->>vehicle_id::text)::uuid,
  organization_id=case when organization_id is null then null else(remap->>organization_id::text)::uuid end,
  provider_profile_id=case when provider_profile_id is null then null else(remap->>provider_profile_id::text)::uuid end;
 update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='AUTHORITY_CHANGED' where target_key='fleet-06-partial';
 update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
  where target_key<>'fleet-06-partial' and public.capacity_sharing_mode(vehicle_id) is distinct from expected_sharing_mode;
 alter table public.demo_motion_targets drop constraint demo_motion_targets_vehicle_id_check;
 alter table public.demo_motion_targets add constraint demo_motion_targets_vehicle_id_check check(vehicle_id in('8aef1b45-2d81-4296-ae3e-cf10ed4af81c'::uuid,'8e21d4b2-e392-4e30-90da-84a6b03f8f9d'::uuid,'3f5b6847-e7fc-4057-85af-b520e80cd944'::uuid,'3b10d829-19c5-497a-a1d9-5640b87f21f8'::uuid,'173f14af-1ef4-4ca8-9bf7-38978ec4a680'::uuid,'2e3244d4-570a-4287-bfb6-2eba9d4590a4'::uuid,'becd7873-1e09-4979-a4bc-338f2b4104d2'::uuid));
 if md5(pg_get_functiondef('public.telematics_is_demo_owner(uuid)'::regprocedure))<>engine_guard_md5
  or(select jsonb_object_agg(p.oid::text,md5(to_jsonb(p)::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'demo_world%tracking%' and p.proname<>'demo_world_tracking_activation_guard') is distinct from tracking_boundaries
  or has_function_privilege('anon','public.demo_pilot_provision_allowed227(uuid,uuid,uuid,text)','EXECUTE')
  or has_function_privilege('authenticated','public.demo_pilot_provision_allowed227(uuid,uuid,uuid,text)','EXECUTE')
  or has_function_privilege('service_role','public.demo_pilot_provision_allowed227(uuid,uuid,uuid,text)','EXECUTE')
  then raise exception 'DEMO_PILOT_COMMAND_BOUNDARY_DRIFT';end if;
end $pilot227$;
