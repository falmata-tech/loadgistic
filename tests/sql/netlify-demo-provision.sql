-- A fresh virtual gateway needs no Traccar process. Every fixture write rolls back.
begin;
set local statement_timeout='30s';
create function pg_temp.netlify_provision_denied(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;raise exception 'EXPECTED_DENIAL_MISSING';
 exception when others then if sqlerrm<>expected then raise exception 'UNEXPECTED_DENIAL %',sqlerrm;end if;end;
end $$;
do $test$
declare administrator uuid;driver_id uuid;fixture_gateway uuid:=gen_random_uuid();result jsonb;before_count bigint;
 before_sources text;before_devices text;after_devices text;other_owner uuid;
begin
 select id into administrator from auth.users where raw_app_meta_data->>'fixture_source'='loadgistic'
  and raw_user_meta_data->>'fixture_key'='user-admin';
 select id into driver_id from auth.users where raw_app_meta_data->>'fixture_source'='loadgistic'
  and raw_user_meta_data->>'fixture_key'='user-driver';
 if administrator is null or driver_id is null then raise exception 'DISPOSABLE_FIXTURES_REQUIRED';end if;
 if has_function_privilege('anon','public.prepare_netlify_demo_gateway(uuid,uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.prepare_netlify_demo_gateway(uuid,uuid)','EXECUTE')
  then raise exception 'NETLIFY_PREPARE_PERMISSION_LEAK';end if;
 select count(*) into before_count from public.telematics_gateways;
 perform pg_temp.netlify_provision_denied(format('select public.prepare_netlify_demo_gateway(%L,%L)',driver_id,fixture_gateway),'FORBIDDEN');
 perform pg_temp.netlify_provision_denied(format('select public.prepare_netlify_demo_gateway(%L,%L)',administrator,fixture_gateway),'DEMO_GATEWAY_BINDING_EXISTS');
 if(select count(*) from public.telematics_gateways)<>before_count then raise exception 'REFUSAL_CREATED_GATEWAY';end if;

 -- Simulate an empty gateway catalog inside this rollback-only disposable test.
 -- All cascades are limited to these ten immutable fictional device identifiers.
 delete from public.telematics_devices where synthetic and imei in(
  '990000000000001','990000000000002','990000000000005','990000000000006','990000000000007',
  '990000000000008','990000000000009','990000000000010','990000000000011','990000000000012');
 insert into public.telematics_location_sources(vehicle_id,source,manual_latitude,manual_longitude,selected_by,precision_km)
  values('2f22cc5a-d654-4405-98b7-9a1a9cf42fe3','MANUAL',40.015,-105.27,driver_id,5)
  on conflict(vehicle_id) do update set source='MANUAL',manual_latitude=40.015,manual_longitude=-105.27,selected_by=driver_id,precision_km=5;
 select md5(jsonb_agg(to_jsonb(s) order by s.vehicle_id)::text) into before_sources from public.telematics_location_sources s;
 result:=public.prepare_netlify_demo_gateway(administrator,fixture_gateway);
 if result->>'deviceCount'<>'10' or (result->>'sourceChoicesRequired')::integer<1
  or result->>'enabled'<>'false' then raise exception 'NETLIFY_FRESH_SETUP_FAILED';end if;
 if not exists(select 1 from public.telematics_gateways g where g.id=fixture_gateway and g.synthetic_only and g.synthetic_transport='NETLIFY_DEMO')
  or (select count(*) from public.telematics_devices d where d.gateway_id=fixture_gateway)<>10
  then raise exception 'NETLIFY_FRESH_SETUP_FAILED';end if;
 if (select md5(jsonb_agg(to_jsonb(s) order by s.vehicle_id)::text) from public.telematics_location_sources s) is distinct from before_sources
  then raise exception 'NETLIFY_PREPARATION_CHANGED_CONSENT';end if;
 select md5(jsonb_agg(to_jsonb(d) order by d.id)::text) into before_devices from public.telematics_devices d;
 perform public.prepare_netlify_demo_gateway(administrator,fixture_gateway);
 select md5(jsonb_agg(to_jsonb(d) order by d.id)::text) into after_devices from public.telematics_devices d;
 if before_devices is distinct from after_devices then raise exception 'NETLIFY_PREPARATION_NOT_IDEMPOTENT';end if;
 if (select enabled or not kill_switch or netlify_enabled from public.demo_hosted_motion_control where id=1)
  or exists(select 1 from public.demo_motion_targets where state='RUNNING')
  or exists(select 1 from public.telematics_positions p where p.gateway_id=fixture_gateway)
  then raise exception 'NETLIFY_PREPARATION_ACTIVATED_WORK';end if;
 select id into other_owner from auth.users where raw_user_meta_data->>'fixture_key'='user-public-fleet-01';
 insert into public.organization_members(organization_id,user_id,membership_role)
  values('6727b198-d771-436a-9f1f-7bf27b8cea2f',other_owner,'OWNER');
 perform pg_temp.netlify_provision_denied(format('select public.prepare_netlify_demo_gateway(%L,%L)',administrator,fixture_gateway),'DEMO_TARGET_DENIED');
end $test$;
rollback;
