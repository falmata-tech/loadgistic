-- FEAT-SIM-004. Run only on a disposable, fixture-loaded local clone with 198.
-- All mutations, including Auth/Featured denial fixtures, roll back below.
begin;
set local statement_timeout='45s';
do $test$
declare target_vehicle uuid:='626ff53a-3c93-44c7-8afb-b175a84403c1';
 owner_id uuid;driver_id uuid;first_job bigint;first_token uuid;second_job bigint;second_token uuid;
 before_count bigint;before_featured bigint;before_assignment bigint;before_source timestamptz;
 before_capacity uuid;off_capacity uuid;restored_capacity uuid;baseline_route jsonb;
 result jsonb;denied boolean;baseline_failure text;source_result jsonb;
 old_capacity public.capacities%rowtype;old_source public.telematics_location_sources%rowtype;
 manual_lat double precision;manual_lng double precision;
begin
 if current_database() not in ('loadgistic_demo_duty_198_ci','loadgistic_telematics_ci')
  then raise exception 'ISOLATED_DUTY_TEST_DATABASE_REQUIRED';end if;
 if (select enabled from public.demo_world_duty_control where id=1)
  then raise exception 'DUTY_DEFAULT_ENABLED';end if;
 if has_function_privilege('anon','public.demo_world_claim_duty(uuid)','EXECUTE')
  or has_function_privilege('authenticated','public.demo_world_execute_duty(bigint,uuid)','EXECUTE')
  or has_function_privilege('service_role','public.demo_world_duty_actor()','EXECUTE')
  or has_table_privilege('service_role','public.demo_world_duty_receipts','INSERT')
  or not has_function_privilege('service_role','public.demo_world_claim_duty(uuid)','EXECUTE')
  then raise exception 'DUTY_PERMISSION_DRIFT';end if;
 if exists(select 1 from public.demo_world_claim_duty(gen_random_uuid()))
  then raise exception 'DUTY_KILL_SWITCH_BYPASSED';end if;
 select actor.owner_id,actor.driver_id into owner_id,driver_id from public.demo_world_duty_actor() actor;
 select * into old_capacity from public.capacities where vehicle_id=target_vehicle
  order by updated_at desc,id desc limit 1;
 select * into old_source from public.telematics_location_sources where vehicle_id=target_vehicle;
 if old_capacity.id is null or old_capacity.status<>'EMPTY'
  or old_capacity.visibility<>'OPEN' or old_capacity.availability_geometry<>'ROUTE'
  or old_capacity.accepts_full_load is not true or old_capacity.accepts_partial_load is not false
  or public.capacity_sharing_mode(target_vehicle)<>'PUBLIC'
  or exists(select 1 from public.capacity_access_grants g where g.vehicle_id=target_vehicle and g.revoked_at is null)
  or exists(select 1 from public.business_capacity_grants g where g.vehicle_id=target_vehicle and g.revoked_at is null)
  then raise exception 'DUTY_UNPREPARED_FIXTURE_DRIFT';end if;
 select latitude,longitude into manual_lat,manual_lng from public.place_catalog
  where id=old_capacity.current_route_points_json->0->>'place_ref';
 if manual_lat is null or manual_lng is null then raise exception 'DUTY_PLACE_NOT_FOUND';end if;
 source_result:=public.select_telematics_location_source(owner_id,jsonb_build_object(
  'vehicleId',target_vehicle,'source','MANUAL','precisionKm',10,
  'expectedRevision',coalesce(old_source.revision,'1970-01-01'::timestamptz),
  'manualLatitude',manual_lat,'manualLongitude',manual_lng));
 if source_result->>'source'<>'MANUAL' then raise exception 'DUTY_MANUAL_PREPARATION_FAILED';end if;
 perform public.publish_provider_capacity(owner_id,jsonb_build_object(
  'vehicle_id',target_vehicle,'status','EMPTY','visibility','OPEN','sharing_mode','PUBLIC',
  'accepted_loads','FTL','availability_geometry','ROUTE','location_source','PRESERVE_DRIVER',
  'current_route_places',old_capacity.current_route_points_json,
  'accepts_multi_pick',coalesce(old_capacity.accepts_multi_pick,false),
  'accepts_multi_drop',coalesce(old_capacity.accepts_multi_drop,false)));
 select id,current_route_points_json into before_capacity,baseline_route
 from public.capacities where vehicle_id=target_vehicle order by updated_at desc,id desc limit 1;
 if before_capacity is null or
   (select location_source from public.capacities where id=before_capacity)<>'MANUAL_ADMIN'
   then raise exception 'DUTY_BASELINE_MISSING';end if;
 select count(*) into before_count from public.capacities where vehicle_id=target_vehicle;
 select count(*) into before_featured from public.featured_provider_slots;
 select count(*) into before_assignment from public.driver_vehicle_assignments where vehicle_id=target_vehicle and active;
 select revision into before_source from public.telematics_location_sources where vehicle_id=target_vehicle;
 update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
 update public.demo_world_duty_control set enabled=true,
  activated_at=((clock_timestamp() at time zone 'UTC')::date-1)::timestamp at time zone 'UTC'
   +interval '10 hours' where id=1;
 select job_id,lease_token into first_job,first_token from public.demo_world_claim_duty(gen_random_uuid());
 if first_job is null or (select phase from public.demo_world_duty_jobs where id=first_job)<>'OFF_DUTY'
  then raise exception 'DUTY_FIRST_PHASE_NOT_CLAIMED';end if;
 if exists(select 1 from public.demo_world_claim_duty(gen_random_uuid()))
  then raise exception 'DUTY_OVERLAPPING_CLAIM';end if;
 denied:=false;
 begin perform public.demo_world_execute_duty(first_job,gen_random_uuid());
 exception when others then denied:=sqlerrm='DEMO_DUTY_LEASE_REFUSED';end;
 if not denied then raise exception 'DUTY_WRONG_LEASE_ACCEPTED';end if;
 denied:=false;
 begin
  update auth.users set raw_app_meta_data=raw_app_meta_data-'fixture_source' where id=owner_id;
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_ACTOR_REFUSED';end;
 if not denied then raise exception 'DUTY_UNMARKED_ACTOR_ACCEPTED';end if;
 denied:=false;
 begin
  update public.driver_vehicle_assignments set active=false where vehicle_id=target_vehicle and active;
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_ASSIGNMENT_REFUSED';end;
 if not denied then raise exception 'DUTY_CHANGED_DRIVER_ACCEPTED';end if;
 denied:=false;
 begin
  insert into public.provider_shipments(code,provider_organization_id,assigned_vehicle_id,
   assigned_driver_user_id,origin,origin_place_ref,origin_lat,origin_lng,destination,
   destination_place_ref,destination_lat,destination_lng,cargo_summary,shipper_email,
   receiver_email,operational_status,created_by,tracking_location_source,tracking_source_started_at)
  values('LGX-DUTY-ROLLBACK','c36022ff-bf3e-432d-ae96-93d1537cf79e',target_vehicle,driver_id,
   'Jigjiga','builtin:jigjiga',9.35,42.8,'Xoodhleey','osm:node/6575426386',9.3079659,42.9101754,
   'Synthetic rollback-only cargo','sender@example.test','receiver@example.test',
   'CREATED',owner_id,'MANUAL',clock_timestamp());
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_ACTIVE_TRACKING';end;
 if not denied then raise exception 'DUTY_ACTIVE_SHIPMENT_ACCEPTED';end if;
 denied:=false;
 begin
  update public.featured_provider_days set feature_date=(clock_timestamp() at time zone 'UTC')::date+100
   where id=(select day_id from public.featured_provider_slots limit 1);
  update public.featured_provider_slots set vehicle_id=target_vehicle,driver_user_id=driver_id
   where id=(select id from public.featured_provider_slots limit 1);
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_SAVED_FEATURED';end;
 if not denied then raise exception 'DUTY_FEATURED_SLOT_ACCEPTED';end if;
 denied:=false;
 begin
  delete from public.telematics_location_sources where vehicle_id=target_vehicle;
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_SOURCE_REFUSED';end;
 if not denied then raise exception 'DUTY_SOURCE_DRIFT_ACCEPTED';end if;
 denied:=false;
 begin
  insert into public.capacity_access_grants(vehicle_id,audience_type,recipient_email,
   recipient_email_digest,created_by)
  values(target_vehicle,'EMAIL','fixture@loadgistic.test',repeat('a',64),owner_id);
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_SHARING_REFUSED';end;
 if not denied then raise exception 'DUTY_PRIVATE_GRANT_DRIFT_ACCEPTED';end if;
 denied:=false;
 begin
  update public.capacities set visibility='PRIVATE'
   where id in(select latest.id from public.vehicles alternative
    join lateral(select * from public.capacities c where c.vehicle_id=alternative.id
     order by c.updated_at desc,c.id desc limit 1) latest on true
    where alternative.id<>target_vehicle and alternative.active and alternative.publication_status='LIVE'
     and alternative.cargo_configuration='Cargo van' and latest.market_status='EMPTY');
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then baseline_failure:=sqlerrm;denied:=baseline_failure='DEMO_DUTY_BASELINE_REFUSED';end;
 if not denied then raise exception 'DUTY_LAST_FILTER_CHOICE_REMOVED: %',baseline_failure;end if;
 if (select count(*) from public.capacities where vehicle_id=target_vehicle)<>before_count
  or (select count(*) from public.demo_world_duty_receipts)<>0
  then raise exception 'DUTY_DENIAL_LEFT_WRITES';end if;
 result:=public.demo_world_execute_duty(first_job,first_token);
 if result->>'result'<>'APPLIED' or result->>'phase'<>'OFF_DUTY'
  then raise exception 'DUTY_OFF_RESULT_DRIFT';end if;
 select after_capacity_id into off_capacity from public.demo_world_duty_receipts where job_id=first_job;
 if (select status from public.capacities where id=off_capacity)<>'OFF_DUTY'
  or (select count(*) from public.capacities where vehicle_id=target_vehicle)<>before_count+1
  then raise exception 'DUTY_OFF_NOT_SAVED';end if;
 if public.demo_world_execute_duty(first_job,first_token)->>'result'<>'REPLAYED'
  or (select count(*) from public.capacities where vehicle_id=target_vehicle)<>before_count+1
  then raise exception 'DUTY_OFF_REPLAY_WROTE';end if;
 select job_id,lease_token into second_job,second_token from public.demo_world_claim_duty(gen_random_uuid());
 if second_job is null or (select phase from public.demo_world_duty_jobs where id=second_job)<>'RESTORE'
  then raise exception 'DUTY_RESTORE_NOT_CLAIMED';end if;
 denied:=false;
 begin
  update public.capacities set updated_by=driver_id where id=off_capacity;
  perform public.demo_world_execute_duty(second_job,second_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_RESTORE_DRIFT';end;
 if not denied then raise exception 'DUTY_FOREIGN_OFF_SIGNAL_ACCEPTED';end if;
 -- A normal Capacity insert failure must roll back the job transition and receipt.
 execute format('alter table public.capacities add constraint duty_restore_block '
  ||'check (vehicle_id <> %L::uuid or status <> ''EMPTY'') not valid',target_vehicle);
 denied:=false;
 begin perform public.demo_world_execute_duty(second_job,second_token);
 exception when check_violation then denied:=true;end;
 if not denied or exists(select 1 from public.demo_world_duty_receipts where job_id=second_job)
  or (select state from public.demo_world_duty_jobs where id=second_job)<>'LEASED'
  or (select count(*) from public.capacities where vehicle_id=target_vehicle)<>before_count+1
  or (select id from public.capacities where vehicle_id=target_vehicle
      order by updated_at desc,id desc limit 1)<>off_capacity
  then raise exception 'DUTY_FAILED_SAVE_LEFT_PARTIAL_STATE';end if;
 alter table public.capacities drop constraint duty_restore_block;
 result:=public.demo_world_execute_duty(second_job,second_token);
 if result->>'result'<>'APPLIED' or result->>'phase'<>'RESTORE'
  then raise exception 'DUTY_RESTORE_RESULT_DRIFT';end if;
 select after_capacity_id into restored_capacity from public.demo_world_duty_receipts where job_id=second_job;
 if (select status from public.capacities where id=restored_capacity)<>'EMPTY'
  or (select location_source from public.capacities where id=restored_capacity)<>'MANUAL_ADMIN'
  or public.demo_world_route_refs((select current_route_points_json from public.capacities where id=restored_capacity))
   is distinct from public.demo_world_route_refs(baseline_route)
  or public.demo_world_execute_duty(second_job,second_token)->>'result'<>'REPLAYED'
  or (select count(*) from public.capacities where vehicle_id=target_vehicle)<>before_count+2
  or (select count(*) from public.featured_provider_slots)<>before_featured
  or (select count(*) from public.driver_vehicle_assignments where vehicle_id=target_vehicle and active)<>before_assignment
  or (select revision from public.telematics_location_sources where vehicle_id=target_vehicle)<>before_source
  or exists(select 1 from public.capacity_access_grants g
    where g.vehicle_id=target_vehicle and g.revoked_at is null)
  or exists(select 1 from public.business_capacity_grants g
    where g.vehicle_id=target_vehicle and g.revoked_at is null)
  then raise exception 'DUTY_RESTORE_OR_REPLAY_DRIFT';end if;
 denied:=false;
 begin update public.demo_world_duty_receipts set applied_at=clock_timestamp() where job_id=first_job;
 exception when others then denied:=sqlerrm='DEMO_WORLD_RECEIPT_IMMUTABLE';end;
 if not denied then raise exception 'DUTY_RECEIPT_MUTABLE';end if;
end $test$;
rollback;
