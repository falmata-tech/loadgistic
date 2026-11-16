-- FEAT-SIM-004. Run on a disposable fixture clone after migrations221/223.
-- All mutations, including Auth/Featured denial fixtures, roll back below.
begin;
set local statement_timeout='45s';
create function pg_temp.duty_state() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'capacities',(select jsonb_agg(to_jsonb(c) order by c.id) from public.capacities c where c.vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'),
  'source',(select to_jsonb(s) from public.telematics_location_sources s where s.vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'),
  'locations',(select jsonb_agg(to_jsonb(l) order by l.vehicle_id) from public.vehicle_driver_locations l where l.vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'),
  'assignments',(select jsonb_agg(to_jsonb(a) order by a.id) from public.driver_vehicle_assignments a where a.vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'),
  'sharing',(select to_jsonb(s) from public.vehicle_capacity_sharing s where s.vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'),
  'grants',(select jsonb_agg(to_jsonb(g) order by g.id) from public.business_capacity_grants g where g.vehicle_id='626ff53a-3c93-44c7-8afb-b175a84403c1'),
  'featured',(select jsonb_agg(to_jsonb(s) order by s.id) from public.featured_provider_slots s),
  'control',(select to_jsonb(c) from public.demo_world_duty_control c where c.id=1),
  'world_control',(select to_jsonb(c) from public.demo_world_control c where c.id=1),
  'jobs',(select jsonb_agg(to_jsonb(j) order by j.id) from public.demo_world_duty_jobs j),
  'receipts',(select jsonb_agg(to_jsonb(r) order by r.job_id) from public.demo_world_duty_receipts r)
 )
$$;
do $test$
declare target_vehicle uuid:='626ff53a-3c93-44c7-8afb-b175a84403c1';
 owner_id uuid;driver_id uuid;first_job bigint;first_token uuid;second_job bigint;second_token uuid;
 before_count bigint;before_featured bigint;before_assignment bigint;before_source timestamptz;
 before_capacity uuid;off_capacity uuid;before_state jsonb;attempt integer;
 result jsonb;denied boolean;baseline_failure text;test_workspace uuid:=gen_random_uuid();
 old_capacity public.capacities%rowtype;old_source public.telematics_location_sources%rowtype;
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
 before_state:=pg_temp.duty_state();
 denied:=false;
 begin perform public.select_telematics_location_source(owner_id,jsonb_build_object(
  'vehicleId',target_vehicle,'source','MANUAL','precisionKm',10,
  'expectedRevision',coalesce(old_source.revision,'1970-01-01'::timestamptz),
  'manualLatitude',old_capacity.location_lat,'manualLongitude',old_capacity.location_lng));
 exception when others then denied:=sqlerrm='INVALID_TELEMATICS_INPUT';end;
 if not denied or pg_temp.duty_state() is distinct from before_state
  then raise exception 'DUTY_RETIRED_MANUAL_PREPARATION_ACCEPTED';end if;
 -- A dated legacy fixture keeps every independent actor/source/safety guard
 -- reachable. It preserves the old point/radius/time and uses no Manual RPC.
 if old_capacity.location_lat is null or old_capacity.location_lng is null
  or old_capacity.location_updated_at is null or old_capacity.location_precision_km not in(1,3,5,10,20)
  then raise exception 'DUTY_LEGACY_FIXTURE_LOCATION_MISSING';end if;
 insert into public.telematics_location_sources(vehicle_id,source,precision_km,selected_by,
  selected_at,revision,manual_latitude,manual_longitude)
 values(target_vehicle,'MANUAL',old_capacity.location_precision_km,owner_id,
  old_capacity.location_updated_at,old_capacity.location_updated_at,old_capacity.location_lat,old_capacity.location_lng)
 on conflict(vehicle_id) do update set source=excluded.source,precision_km=excluded.precision_km,
  selected_by=excluded.selected_by,selected_at=excluded.selected_at,revision=excluded.revision,
  manual_latitude=excluded.manual_latitude,manual_longitude=excluded.manual_longitude;
 update public.capacities set location_source='MANUAL_ADMIN' where id=old_capacity.id;
 select id into before_capacity
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
 before_state:=pg_temp.duty_state();
 if exists(select 1 from public.demo_world_claim_duty(gen_random_uuid()))
  or pg_temp.duty_state() is distinct from before_state
  then raise exception 'DUTY_HELD_CLAIM_CHANGED_STATE';end if;
 -- Lease-shaped rollback fixtures exercise executor guards while production
 -- claims stay held. No worker can create or claim these jobs through the hold.
 insert into public.demo_world_duty_jobs(simulation_day,phase,scheduled_at,state,
  lease_token,leased_by,lease_expires_at,attempts)
 values((clock_timestamp() at time zone 'UTC')::date-1,'OFF_DUTY',
  (((clock_timestamp() at time zone 'UTC')::date-1)::timestamp+interval '10 hours 30 minutes') at time zone 'UTC',
  'LEASED',gen_random_uuid(),gen_random_uuid(),clock_timestamp()+interval '2 minutes',1)
 returning id,lease_token into first_job,first_token;
 insert into public.demo_world_duty_jobs(simulation_day,phase,scheduled_at,state,
  lease_token,leased_by,lease_expires_at,attempts)
 values((clock_timestamp() at time zone 'UTC')::date-1,'RESTORE',
  (((clock_timestamp() at time zone 'UTC')::date-1)::timestamp+interval '10 hours 50 minutes') at time zone 'UTC',
  'LEASED',gen_random_uuid(),gen_random_uuid(),clock_timestamp()+interval '2 minutes',1)
 returning id,lease_token into second_job,second_token;
 if first_job is null or (select phase from public.demo_world_duty_jobs where id=first_job)<>'OFF_DUTY'
  then raise exception 'DUTY_FIRST_PHASE_NOT_CLAIMED';end if;
 if exists(select 1 from public.demo_world_claim_duty(gen_random_uuid()))
  then raise exception 'DUTY_OVERLAPPING_CLAIM';end if;
 denied:=false;
 begin perform public.demo_world_execute_duty(second_job,second_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_ORDER_REFUSED';end;
 if not denied then raise exception 'DUTY_RESTORE_PASSED_UNFINISHED_FIRST_PHASE';end if;
 denied:=false;
 begin perform public.demo_world_execute_duty(first_job,gen_random_uuid());
 exception when others then denied:=sqlerrm='DEMO_DUTY_LEASE_REFUSED';end;
 if not denied then raise exception 'DUTY_WRONG_LEASE_ACCEPTED';end if;
 denied:=false;
 begin
  update public.demo_world_duty_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=first_job;
  perform public.demo_world_execute_duty(first_job,first_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_LEASE_REFUSED';end;
 if not denied then raise exception 'DUTY_EXPIRED_LEASE_ACCEPTED';end if;
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
  insert into public.business_workspaces(id,name,handle,kind)
  values(test_workspace,'Synthetic duty recipient','duty-'||substr(test_workspace::text,1,12),'BROKER');
  insert into public.business_capacity_grants(vehicle_id,workspace_id,created_by)
  values(target_vehicle,test_workspace,owner_id);
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
 before_state:=pg_temp.duty_state();
 for attempt in 1..2 loop
  denied:=false;
  begin perform public.demo_world_execute_duty(first_job,first_token);
  exception when others then denied:=sqlerrm='DEMO_MANUAL_LANE_HELD';end;
  if not denied or pg_temp.duty_state() is distinct from before_state
   then raise exception 'DUTY_OFF_HOLD_CHANGED_STATE';end if;
 end loop;
 if public.demo_world_duty_status()->>'last_completed_phase' is not null
  then raise exception 'DUTY_HELD_JOB_REPORTED_COMPLETED';end if;

 -- Seed a completed old phase for replay and Restore guards. Off Duty uses no
 -- location input; this ordinary Capacity command never selects/refreshes Manual.
 off_capacity:=public.publish_provider_capacity(owner_id,jsonb_build_object(
  'vehicle_id',target_vehicle,'status','OFF_DUTY','visibility','OPEN','sharing_mode','PUBLIC'));
 insert into public.demo_world_duty_receipts(job_id,simulation_day,phase,actor_id,driver_id,
  vehicle_id,baseline_capacity_id,before_capacity_id,after_capacity_id,source_revision)
 select first_job,job.simulation_day,'OFF_DUTY',owner_id,driver_id,target_vehicle,
  before_capacity,before_capacity,off_capacity,before_source
 from public.demo_world_duty_jobs job where job.id=first_job;
 update public.demo_world_duty_jobs set state='DONE',leased_by=null,lease_expires_at=null,
  completed_at=clock_timestamp() where id=first_job;
 before_state:=pg_temp.duty_state();
 result:=public.demo_world_execute_duty(first_job,first_token);
 if result->>'result'<>'REPLAYED' or result->>'phase'<>'OFF_DUTY'
  or pg_temp.duty_state() is distinct from before_state
  then raise exception 'DUTY_HISTORICAL_OFF_REPLAY_CHANGED_STATE';end if;
 denied:=false;
 begin
  update public.capacities set updated_by=driver_id where id=off_capacity;
  perform public.demo_world_execute_duty(second_job,second_token);
 exception when others then denied:=sqlerrm='DEMO_DUTY_RESTORE_DRIFT';end;
 if not denied then raise exception 'DUTY_FOREIGN_OFF_SIGNAL_ACCEPTED';end if;
 before_state:=pg_temp.duty_state();
 for attempt in 1..2 loop
  denied:=false;
  begin perform public.demo_world_execute_duty(second_job,second_token);
  exception when others then denied:=sqlerrm='DEMO_MANUAL_LANE_HELD';end;
  if not denied or pg_temp.duty_state() is distinct from before_state
   or exists(select 1 from public.demo_world_duty_receipts where job_id=second_job)
   or (select state from public.demo_world_duty_jobs where id=second_job)<>'LEASED'
   or (select id from public.capacities where vehicle_id=target_vehicle
       order by updated_at desc,id desc limit 1)<>off_capacity
   then raise exception 'DUTY_RESTORE_HOLD_CHANGED_PENDING_JOB_OR_STATE';end if;
 end loop;
 before_state:=pg_temp.duty_state();
 if exists(select 1 from public.demo_world_claim_duty(gen_random_uuid()))
  or pg_temp.duty_state() is distinct from before_state
  then raise exception 'DUTY_HELD_BACKLOG_CLAIM_CHANGED_STATE';end if;
 if (select count(*) from public.capacities where vehicle_id=target_vehicle)<>before_count+1
  or (select count(*) from public.featured_provider_slots)<>before_featured
  or (select count(*) from public.driver_vehicle_assignments where vehicle_id=target_vehicle and active)<>before_assignment
  or (select revision from public.telematics_location_sources where vehicle_id=target_vehicle)<>before_source
  or exists(select 1 from public.capacity_access_grants g
    where g.vehicle_id=target_vehicle and g.revoked_at is null)
  or exists(select 1 from public.business_capacity_grants g
    where g.vehicle_id=target_vehicle and g.revoked_at is null)
  then raise exception 'DUTY_HOLD_OR_HISTORICAL_REPLAY_DRIFT';end if;
 denied:=false;
 begin update public.demo_world_duty_receipts set applied_at=clock_timestamp() where job_id=first_job;
 exception when others then denied:=sqlerrm='DEMO_WORLD_RECEIPT_IMMUTABLE';end;
 if not denied then raise exception 'DUTY_RECEIPT_MUTABLE';end if;
end $test$;
rollback;
