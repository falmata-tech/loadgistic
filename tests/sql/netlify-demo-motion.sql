-- FEAT-SIM-001 / NR-82/83/84. Owned disposable GPS fixtures; all writes roll back.
begin;
set local statement_timeout='30s';
create function pg_temp.netlify_expect_denied(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;raise exception 'EXPECTED_DENIAL_MISSING';
 exception when others then if sqlerrm<>expected then raise exception 'UNEXPECTED_DENIAL %',sqlerrm;end if;end;
end $$;

do $test$
<<motion_test>>
declare run uuid:=gen_random_uuid();nonce uuid;answer jsonb;gateway_id uuid;digest text;
 target uuid:='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a';phone uuid:='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3';
 selected public.telematics_location_sources%rowtype;driver_id uuid;before_reports bigint;before_epoch bigint;before_generation timestamptz;
 normal_owner uuid;target_org uuid;gps_command jsonb;protocol_gateway uuid:=gen_random_uuid();maintenance_nonce uuid:=gen_random_uuid();
begin
 if (select netlify_enabled from public.demo_hosted_motion_control where id=1)
  then raise exception 'NETLIFY_DEFAULT_NOT_OFF';end if;
 if has_function_privilege('anon','public.netlify_demo_motion_command(uuid,uuid,text,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.netlify_demo_motion_command(uuid,uuid,text,jsonb)','EXECUTE')
  or has_function_privilege('service_role','public.ingest_telematics_position_pre_netlify226(text,jsonb)','EXECUTE')
  or has_table_privilege('service_role','public.demo_motion_netlify_window','UPDATE')
  or not(select relrowsecurity from pg_class where oid='public.demo_motion_netlify_window'::regclass)
  then raise exception 'NETLIFY_PERMISSION_LEAK';end if;
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,null,%L::jsonb)',
  gen_random_uuid(),run,'{"action":"CLAIM"}'),'DEMO_HOSTED_DISABLED');

 select d.gateway_id into gateway_id from public.telematics_devices d
  join public.telematics_device_assignments a on a.device_id=d.id and a.ended_at is null
  where a.vehicle_id=target and d.synthetic and d.imei='990000000000001';
 if gateway_id is null then raise exception 'EXACT_DISPOSABLE_GPS_FIXTURE_REQUIRED';end if;
 update public.demo_hosted_motion_control set enabled=true,kill_switch=false,netlify_enabled=true,activated_at=clock_timestamp() where id=1;
 answer:=public.netlify_demo_motion_command(gen_random_uuid(),run,null,'{"action":"CLAIM"}');
 if answer->>'claimed'<>'true' then raise exception 'NETLIFY_CLAIM_FAILED';end if;
 if (public.netlify_demo_motion_command(gen_random_uuid(),gen_random_uuid(),null,'{"action":"CLAIM"}')->>'claimed')<>'false'
  then raise exception 'NETLIFY_DUPLICATE_WINDOW';end if;
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',
  gen_random_uuid(),run,'company-truck','{"action":"PREPARE"}'),'DEMO_TARGET_DENIED');
 update public.telematics_gateways g set synthetic_transport='NETLIFY_DEMO' where g.id=gateway_id and g.synthetic_only;
 select g.token_digest into digest from public.telematics_gateways g where g.id=gateway_id;

 -- CLAIM replaces bridge maintenance only for the direct lane. Expired protocol
 -- history must remain untouched; recent direct requests must also survive.
 insert into public.telematics_gateways(id,label,token_digest,synthetic_only)
  values(protocol_gateway,'Rollback-only protocol retention',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),true);
 insert into public.telematics_gateway_requests(gateway_id,nonce,body_digest,issued_at,created_at)
  values(gateway_id,maintenance_nonce,repeat('a',64),clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days'),
   (protocol_gateway,maintenance_nonce,repeat('b',64),clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days'),
   (gateway_id,gen_random_uuid(),repeat('c',64),clock_timestamp(),clock_timestamp());
 update public.demo_motion_netlify_window set run_id=null,expires_at=null where id=1;
 run:=gen_random_uuid();perform public.netlify_demo_motion_command(gen_random_uuid(),run,null,'{"action":"CLAIM"}');
 if exists(select 1 from public.telematics_gateway_requests r where r.gateway_id=motion_test.gateway_id and r.nonce=maintenance_nonce)
  then raise exception 'NETLIFY_EXPIRED_REQUEST_NOT_PRUNED';end if;
 if not exists(select 1 from public.telematics_gateway_requests r where r.gateway_id=protocol_gateway and r.nonce=maintenance_nonce)
  or not exists(select 1 from public.telematics_gateway_requests r where r.gateway_id=motion_test.gateway_id and r.created_at>clock_timestamp()-interval '1 minute')
  then raise exception 'NETLIFY_RETENTION_SCOPE_CHANGED';end if;

 -- Select the fictional personal driver's Phone through the existing command.
 select * into selected from public.telematics_location_sources where vehicle_id=phone;
 select driver_user_id into driver_id from public.driver_vehicle_assignments where vehicle_id=phone and active;
 if selected.source is distinct from 'MOBILE' then
  perform public.select_telematics_location_source(driver_id,jsonb_build_object('vehicleId',phone,'source','MOBILE',
   'precisionKm',20,'expectedRevision',coalesce(selected.revision,'1970-01-01'::timestamptz)));
 end if;
 answer:=public.netlify_demo_motion_command(gen_random_uuid(),run,'company-truck','{"action":"PREPARE"}');
 if answer->>'ready'<>'true' then raise exception 'NETLIFY_PREPARE_FAILED';end if;
 perform public.netlify_demo_motion_command(gen_random_uuid(),run,'personal-truck','{"action":"PREPARE"}');
 select epoch,generation_started_at into before_epoch,before_generation from public.demo_motion_targets where vehicle_id=target;
 perform pg_sleep(1.2);
 nonce:=gen_random_uuid();
 gps_command:=jsonb_build_object('action','REPORT','latitude',9.031,'longitude',38.748,'speedKph',0,'course',0,'capturedAt',clock_timestamp());
 answer:=public.netlify_demo_motion_command(nonce,run,'company-truck',gps_command);
 if answer->>'recorded'<>'true' or answer->>'transport'<>'NETLIFY_DEMO'
  or not exists(select 1 from public.telematics_positions where vehicle_id=target
   and event_key='netlify:'||nonce::text and demo_epoch=before_epoch and synthetic_transport='NETLIFY_DEMO')
  then raise exception 'NETLIFY_GPS_NOT_DURABLE';end if;
 if not exists(select 1 from public.capacities where vehicle_id=target and location_source='TELEMATICS'
  and demo_epoch=before_epoch and location_updated_at>clock_timestamp()-interval '10 seconds')
  then raise exception 'NETLIFY_GPS_NOT_PUBLISHED';end if;
 select count(*) into before_reports from public.telematics_positions where vehicle_id=target;
 if (public.netlify_demo_motion_command(gen_random_uuid(),run,'company-truck',gps_command)->>'recorded')<>'false'
  or (select count(*) from public.telematics_positions where vehicle_id=target)<>before_reports
  then raise exception 'NETLIFY_REPORT_BURST';end if;
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',
  nonce,run,'company-truck',gps_command),'DEMO_REQUEST_DENIED');
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',
  gen_random_uuid(),run,'company-truck',gps_command||jsonb_build_object('capturedAt',clock_timestamp()-interval '6 seconds')),'DEMO_MOTION_REPORT_DENIED');
 perform pg_temp.netlify_expect_denied(format('select public.ingest_telematics_position(%L,%L::jsonb)',digest,'{}'),'TELEMETRY_BINDING_DENIED');
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',
  gen_random_uuid(),run,'customer','{"action":"PREPARE"}'),'DEMO_TARGET_DENIED');

 answer:=public.netlify_demo_motion_command(gen_random_uuid(),run,'personal-truck',
  jsonb_build_object('action','REPORT','latitude',9.03,'longitude',38.76,'speedKph',0,'course',0,'capturedAt',clock_timestamp()));
 if answer->>'recorded'<>'true' or not exists(select 1 from public.vehicle_driver_locations
   where vehicle_id=phone and demo_epoch is not null and latitude<>9.03 and longitude<>38.76)
  then raise exception 'NETLIFY_PHONE_PRIVACY_FAILED';end if;

 update public.demo_motion_netlify_window set expires_at=clock_timestamp()-interval '1 second' where id=1;
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',
  gen_random_uuid(),run,'company-truck','{"action":"PREPARE"}'),'DEMO_NETLIFY_WINDOW_DENIED');
 run:=gen_random_uuid();
 perform public.netlify_demo_motion_command(gen_random_uuid(),run,null,'{"action":"CLAIM"}');
 perform public.netlify_demo_motion_command(gen_random_uuid(),run,'company-truck','{"action":"PREPARE"}');
 if not exists(select 1 from public.demo_motion_targets where vehicle_id=target and epoch=before_epoch
   and generation_started_at=before_generation) then raise exception 'NETLIFY_RESTART_RESET_LEASE';end if;

 select v.organization_id into target_org from public.vehicles v where v.id=target;
 select p.id into normal_owner from public.profiles p join auth.users u on u.id=p.id
  where u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01' and p.role='TRANSPORTER' and p.active;
 if normal_owner is null then raise exception 'EXACT_COOWNER_FIXTURE_REQUIRED';end if;
 insert into public.organization_members(organization_id,user_id,membership_role) values(target_org,normal_owner,'OWNER');
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',
  gen_random_uuid(),run,'company-truck','{"action":"PREPARE"}'),'DEMO_TARGET_DENIED');
 delete from public.organization_members where organization_id=target_org and user_id=normal_owner;
 if (select count(*) from public.telematics_positions where vehicle_id=target)<>before_reports
  then raise exception 'NETLIFY_DENIAL_CHANGED_POSITION';end if;
 perform public.pause_demo_motion(target,'REAL_INSTALLATION');
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,%L,%L::jsonb)',
  gen_random_uuid(),run,'company-truck','{"action":"PREPARE"}'),'DEMO_REAL_DEVICE_TAKEOVER');
 update public.demo_hosted_motion_control set netlify_enabled=false where id=1;
 if exists(select 1 from public.demo_motion_targets where netlify_owned and state='RUNNING')
  or exists(select 1 from public.demo_motion_netlify_window where run_id is not null)
  or not exists(select 1 from public.demo_motion_targets where vehicle_id=target and state='REAL')
  then raise exception 'NETLIFY_STOP_NOT_CONTAINED';end if;
 perform pg_temp.netlify_expect_denied(format('select public.netlify_demo_motion_command(%L,%L,null,%L::jsonb)',
  gen_random_uuid(),gen_random_uuid(),'{"action":"CLAIM"}'),'DEMO_HOSTED_DISABLED');
end $test$;
rollback;
