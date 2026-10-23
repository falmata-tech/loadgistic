-- FEAT-SIM-001. Run only after migration 187 on the disposable fixture clone.
-- Every mutation in this test rolls back; never point this file at preview/hosted.
begin;
do $test$
declare
  vehicle_a uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  capacity_count bigint;assignment_count bigint;featured_count bigint;
  original_a uuid;original_b uuid;outcome jsonb;denied boolean;
begin
  if current_database() not in('loadgistic_demo_handover_187_ci','loadgistic_telematics_ci')
    then raise exception 'ISOLATED_HANDOVER_TEST_DATABASE_REQUIRED';end if;
  if has_function_privilege('anon','public.demo_world_execute_atomic_handover()','EXECUTE')
    or has_function_privilege('authenticated','public.demo_world_execute_atomic_handover()','EXECUTE')
    or has_function_privilege('service_role','public.demo_world_execute_atomic_handover()','EXECUTE')
    or has_table_privilege('service_role','public.demo_world_handover_receipts','INSERT')
    then raise exception 'HANDOVER_PERMISSION_DRIFT';end if;
  if (select enabled from public.demo_world_control where id=1)
    then raise exception 'HANDOVER_DEFAULT_ENABLED';end if;
  select count(*) into capacity_count from public.capacities where vehicle_id in(vehicle_a,vehicle_b);
  select count(*) into assignment_count from public.driver_vehicle_assignments
    where vehicle_id in(vehicle_a,vehicle_b);
  select count(*) into featured_count from public.featured_provider_slots
    where vehicle_id in(vehicle_a,vehicle_b);
  select driver_user_id into original_a from public.driver_vehicle_assignments
    where vehicle_id=vehicle_a and active;
  select driver_user_id into original_b from public.driver_vehicle_assignments
    where vehicle_id=vehicle_b and active;
  if original_a is null or original_b is null or original_a=original_b
    then raise exception 'HANDOVER_FIXTURE_ASSIGNMENT_MISSING';end if;
  -- Fresh managed fixtures may feature either driver today. Put only their
  -- current/future days in the past within this rollback-only test, so the
  -- device and sharing denials below are reached in the intended order. The
  -- explicit Featured denial later restores a future day for this scenario.
  with affected as (
    select day.id,row_number() over(order by day.id)::integer as ordinal
    from public.featured_provider_days day
    where day.feature_date>=current_date and exists(
      select 1 from public.featured_provider_slots slot
      where slot.day_id=day.id and
        (slot.vehicle_id in(vehicle_a,vehicle_b)
         or slot.driver_user_id in(original_a,original_b)))
  )
  update public.featured_provider_days day
    set feature_date=current_date-1000-affected.ordinal
  from affected where day.id=affected.id;
  denied:=false;
  begin perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_DISABLED';end;
  if not denied then raise exception 'HANDOVER_KILL_SWITCH_BYPASSED';end if;
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
  denied:=false;
  begin
    update auth.users set raw_app_meta_data=raw_app_meta_data-'fixture_source' where id=original_a;
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_DRIVER_REFUSED';end;
  if not denied then raise exception 'HANDOVER_UNMARKED_DRIVER_ACCEPTED';end if;
  denied:=false;
  begin
    insert into public.provider_shipments(code,provider_organization_id,assigned_vehicle_id,
      assigned_driver_user_id,origin,origin_place_ref,origin_lat,origin_lng,destination,
      destination_place_ref,destination_lat,destination_lng,cargo_summary,shipper_email,
      receiver_email,operational_status,created_by,tracking_location_source,tracking_source_started_at)
    select 'LGX-HANDOVER-TEST','c36022ff-bf3e-432d-ae96-93d1537cf79e',vehicle_a,original_a,
      'Addis Ababa','builtin:addis ababa',9.00646,38.73172,
      'Adama','builtin:adama',8.51674,39.26118,'Synthetic test cargo',
      'sender@example.test','receiver@example.test','CREATED',u.id,'MOBILE',clock_timestamp()
    from auth.users u where u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01';
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_ACTIVE_TRACKING';end;
  if not denied then raise exception 'HANDOVER_ACTIVE_SHIPMENT_ACCEPTED';end if;
  denied:=false;
  begin
    insert into public.phone_location_installations(id,secret_digest)
      values('00000000-0000-4000-8000-000000018700',repeat('a',64));
    insert into public.phone_location_bindings(installation_id,actor_user_id,vehicle_id,
      auth_session_id,expires_at)
      values('00000000-0000-4000-8000-000000018700',original_a,vehicle_a,
        '00000000-0000-4000-8000-000000018701',clock_timestamp()+interval '1 day');
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_DEVICE_REFUSED';end;
  if not denied then raise exception 'HANDOVER_PHONE_BINDING_ACCEPTED';end if;
  denied:=false;
  begin
    update public.vehicle_capacity_sharing set mode='BOTH' where vehicle_id=vehicle_b;
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_SHARING_REFUSED';end;
  if not denied then raise exception 'HANDOVER_AUDIENCE_DRIFT_ACCEPTED';end if;
  denied:=false;
  begin
    insert into public.telematics_location_sources(vehicle_id,source,precision_km,selected_by,
      selected_at,revision) values(vehicle_a,'MOBILE',10,original_a,clock_timestamp(),clock_timestamp());
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_SOURCE_REFUSED';end;
  if not denied then raise exception 'HANDOVER_REAL_SOURCE_ACCEPTED';end if;
  denied:=false;
  begin
    update public.featured_provider_days day set feature_date=current_date+100
      where day.id=(select slot.day_id from public.featured_provider_slots slot
        where slot.vehicle_id=vehicle_a limit 1);
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_SAVED_FEATURED';end;
  if not denied then raise exception 'HANDOVER_FUTURE_FEATURED_ACCEPTED';end if;
  if (select count(*) from public.capacities where vehicle_id in(vehicle_a,vehicle_b))<>capacity_count
    then raise exception 'HANDOVER_DENIAL_WROTE_CAPACITY';end if;
end $test$;

-- Force failure after both duty changes, both reassignments and the first
-- republish. The second republish must roll back the entire function call.
create function pg_temp.demo_handover_fail_last() returns trigger
language plpgsql as $$begin raise exception 'DEMO_HANDOVER_TEST_FORCED_FAILURE';end$$;
create trigger demo_handover_test_fail_last before insert on public.capacities
for each row when(new.vehicle_id='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7'::uuid
  and new.status='EMPTY' and new.location_source='MANUAL_ADMIN')
execute function pg_temp.demo_handover_fail_last();

do $test$
declare
  vehicle_a uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  before_count bigint;before_assignment_count bigint;denied boolean:=false;
begin
  select count(*) into before_count from public.capacities where vehicle_id in(vehicle_a,vehicle_b);
  select count(*) into before_assignment_count from public.driver_vehicle_assignments
    where vehicle_id in(vehicle_a,vehicle_b);
  begin perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_TEST_FORCED_FAILURE';end;
  if not denied then raise exception 'HANDOVER_PARTIAL_COMMIT_NOT_BLOCKED';end if;
  if (select count(*) from public.capacities where vehicle_id in(vehicle_a,vehicle_b))<>before_count
    or (select count(*) from public.driver_vehicle_assignments
      where vehicle_id in(vehicle_a,vehicle_b))<>before_assignment_count
    or (select count(*) from public.demo_world_handover_receipts)<>0
    then raise exception 'HANDOVER_FAILURE_LEFT_PARTIAL_WRITES';end if;
end $test$;
drop trigger demo_handover_test_fail_last on public.capacities;

do $test$
declare
  vehicle_a uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  original_a uuid;original_b uuid;outcome jsonb;replay jsonb;denied boolean:=false;
  old_capacity_count bigint;old_featured_count bigint;
begin
  select driver_user_id into original_a from public.driver_vehicle_assignments
    where vehicle_id=vehicle_a and active;
  select driver_user_id into original_b from public.driver_vehicle_assignments
    where vehicle_id=vehicle_b and active;
  select count(*) into old_capacity_count from public.capacities
    where vehicle_id in(vehicle_a,vehicle_b);
  select count(*) into old_featured_count from public.featured_provider_slots
    where vehicle_id in(vehicle_a,vehicle_b);
  outcome:=public.demo_world_execute_atomic_handover();
  if outcome->>'replayed'<>'false' or outcome->>'vehicleCount'<>'2'
    then raise exception 'HANDOVER_RESULT_DRIFT';end if;
  if (select count(*) from public.driver_vehicle_assignments a where a.active
    and ((a.vehicle_id=vehicle_a and a.driver_user_id=original_b)
      or (a.vehicle_id=vehicle_b and a.driver_user_id=original_a)))<>2
    then raise exception 'HANDOVER_ASSIGNMENT_NOT_SWAPPED';end if;
  if (select count(*) from public.capacities c
    where c.id in(select published_capacity_a_id from public.demo_world_handover_receipts
      union all select published_capacity_b_id from public.demo_world_handover_receipts)
      and c.status='EMPTY' and c.visibility='OPEN' and c.location_source='MANUAL_ADMIN')<>2
    then raise exception 'HANDOVER_FRESH_CAPACITY_MISSING';end if;
  if (select count(*) from public.telematics_location_sources s
      where s.vehicle_id in(vehicle_a,vehicle_b) and s.source='MANUAL'
        and s.selected_by=(select owner_user_id from public.demo_world_handover_receipts limit 1))<>2
    then raise exception 'HANDOVER_NEW_SOURCE_MISSING';end if;
  if (select count(*) from public.featured_provider_slots where vehicle_id in(vehicle_a,vehicle_b))<>old_featured_count
    or (select count(*) from public.vehicle_capacity_sharing s
      where s.vehicle_id in(vehicle_a,vehicle_b) and s.mode='PUBLIC')<>2
    then raise exception 'HANDOVER_FEATURED_OR_AUDIENCE_CHANGED';end if;
  replay:=public.demo_world_execute_atomic_handover();
  if replay->>'replayed'<>'true'
    or (select count(*) from public.demo_world_handover_receipts)<>1
    or (select count(*) from public.capacities where vehicle_id in(vehicle_a,vehicle_b))<>old_capacity_count+7
    then raise exception 'HANDOVER_REPLAY_WROTE_AGAIN';end if;
  begin update public.demo_world_handover_receipts set applied_at=clock_timestamp();
  exception when others then denied:=sqlerrm='DEMO_WORLD_RECEIPT_IMMUTABLE';end;
  if not denied then raise exception 'HANDOVER_RECEIPT_MUTABLE';end if;
end $test$;
rollback;
