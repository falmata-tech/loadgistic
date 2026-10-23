-- FEAT-SIM-001. Disposable clone only; no tracker remains after rollback.
begin;
do $test$
declare
 administrator uuid; gateway uuid; organization uuid;
 created jsonb; denied boolean := false;
begin
 if current_database()<>'loadgistic_telematics_ci' then raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';end if;
 select id into administrator from auth.users where raw_app_meta_data->>'fixture_source'='loadgistic'
  and raw_user_meta_data->>'fixture_key'='user-admin';
 select id into gateway from telematics_gateways where active and synthetic_only limit 1;
 select organization_id into organization from demo_motion_fleet_allowlist where imei='990000000000005';
 if administrator is null or gateway is null or organization is null then raise exception 'ISOLATED_DEMO_SETUP_MISSING';end if;
 created:=public.provision_telematics_device(administrator,jsonb_build_object(
  'gatewayId',gateway,'gatewayDeviceId',9005,'imei','990000000000005',
  'protocol','gt06','protocolDeviceId','990000000000005',
  'ownerOrganizationId',organization,'label','Fictional cohort tracker',
  'synthetic',true,'modelProfile','SYNTHETIC_GT06'));
 if (created->>'id')::uuid is null then raise exception 'DEMO_COHORT_PROVISION_FAILED';end if;
 if public.telematics_is_demo_owner((select user_id from organization_members
  where organization_id=organization and membership_role='OWNER'))
  then raise exception 'DEMO_COHORT_ENGINE_SCOPE_EXPANDED';end if;
 begin
  perform public.provision_telematics_device(administrator,jsonb_build_object(
   'gatewayId',gateway,'gatewayDeviceId',9013,'imei','990000000000013',
   'protocol','gt06','protocolDeviceId','990000000000013',
   'ownerOrganizationId',organization,'label','Unlisted fictional tracker',
   'synthetic',true,'modelProfile','SYNTHETIC_GT06'));
 exception when others then denied:=sqlerrm='DEVICE_OWNER_INVALID';end;
 if not denied then raise exception 'DEMO_COHORT_UNLISTED_DEVICE_ACCEPTED';end if;
end $test$;
rollback;
