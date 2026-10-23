-- FEAT-SIM-001. Run only after CI's isolated demo setup and migration 183.
-- The transaction deliberately leaves no tracker, source or report behind.
begin;
do $test$
declare
 target constant uuid:='2020967a-92d3-4b1d-8f40-3c670dc97a50';
 organization constant uuid:='c36022ff-bf3e-432d-ae96-93d1537cf79e';
 owner_id uuid;gateway_id uuid;device_id uuid;binding jsonb;lease jsonb;denied boolean;
begin
 if current_database()<>'loadgistic_telematics_ci' then raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';end if;
 if (select count(*) from demo_motion_fleet_allowlist)<>8 then raise exception 'DEMO_COHORT_INCOMPLETE';end if;
 if has_table_privilege('anon','public.demo_motion_fleet_allowlist','SELECT')
  or has_table_privilege('authenticated','public.demo_motion_fleet_allowlist','SELECT')
  or has_table_privilege('service_role','public.demo_motion_fleet_allowlist','INSERT')
  or has_function_privilege('service_role','public.demo_motion_binding_fleet(uuid)','EXECUTE')
  then raise exception 'DEMO_COHORT_AUTHORITY_EXPOSED';end if;
 select user_id into owner_id from organization_members where organization_id=organization and membership_role='OWNER';
 select id into gateway_id from telematics_gateways where synthetic_only and active limit 1;
 if owner_id is null or gateway_id is null or exists(select 1 from telematics_devices where imei='990000000000005')
  then raise exception 'ISOLATED_DEMO_COHORT_SETUP_CHANGED';end if;
 insert into telematics_devices(gateway_id,gateway_device_id,imei,protocol,protocol_device_id,organization_id,label,model_profile,synthetic)
 values(gateway_id,9005,'990000000000005','gt06','990000000000005',organization,'Fictional CI fleet tracker','SYNTHETIC_GT06',true)
 returning id into device_id;
 insert into telematics_device_assignments(device_id,vehicle_id,assigned_by) values(device_id,target,owner_id);
 insert into telematics_location_sources(vehicle_id,source,precision_km,selected_by)
 values(target,'GPS',10,owner_id)
 on conflict(vehicle_id) do update set source='GPS',precision_km=10,selected_by=owner_id,revision=clock_timestamp();
 binding:=public.demo_motion_binding(target);
 if binding->>'source'<>'GPS' or (binding->>'ownerId')::uuid<>owner_id or (binding->>'deviceId')::uuid<>device_id
  then raise exception 'DEMO_COHORT_BINDING_INVALID';end if;
 perform public.configure_demo_motion_target(target);
 lease:=public.start_demo_motion(target,60,false);
 if lease->>'source'<>'GPS' then raise exception 'DEMO_COHORT_LEASE_INVALID';end if;
 denied:=false;
 begin
  perform public.reserve_demo_gps_tick(target,(lease->>'leaseId')::uuid,(lease->>'epoch')::bigint,10.015,38.704);
 exception when others then denied:=sqlerrm='DEMO_REPORT_DENIED';end;
 if not denied then raise exception 'DEMO_COHORT_ROUTE_BOUNDARY_MISSING';end if;
 update demo_motion_targets set generation_started_at=clock_timestamp()-interval '2 seconds' where vehicle_id=target;
 perform public.reserve_demo_gps_tick(target,(lease->>'leaseId')::uuid,(lease->>'epoch')::bigint,9.015,38.704);
 if (select count(*) from demo_motion_gps_reports where vehicle_id=target and epoch=(lease->>'epoch')::bigint)<>1
  then raise exception 'DEMO_COHORT_FIX_NOT_RESERVED';end if;
 update telematics_location_sources set source='MOBILE',revision=clock_timestamp() where vehicle_id=target;
 if (select state from demo_motion_targets where vehicle_id=target)<>'REAL' then raise exception 'DEMO_COHORT_TAKEOVER_NOT_PAUSED';end if;
 denied:=false;
 begin perform public.start_demo_motion(target,60,false);exception when others then denied:=sqlerrm in('DEMO_REAL_DEVICE_TAKEOVER','DEMO_TARGET_DENIED');end;
 if not denied then raise exception 'DEMO_COHORT_TAKEOVER_RESTARTED';end if;
 denied:=false;
 begin perform public.demo_motion_binding('00000000-0000-4000-8000-000000000000');exception when others then denied:=sqlerrm='DEMO_TARGET_DENIED';end;
 if not denied then raise exception 'DEMO_COHORT_UNKNOWN_TARGET_ACCEPTED';end if;
end $test$;
rollback;
