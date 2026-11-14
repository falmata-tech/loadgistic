-- FEAT-SIM-001. Run after migrations221/223 on the disposable clone.
-- All scenario writes are enclosed by this transaction and rolled back.
begin;
create function pg_temp.handover_worker_state() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'jobs',(select jsonb_agg(to_jsonb(j) order by j.id) from public.demo_world_handover_jobs j),
  'control',(select to_jsonb(c) from public.demo_world_control c where c.id=1),
  'receipts',(select jsonb_agg(to_jsonb(r) order by r.simulation_day) from public.demo_world_handover_receipts r),
  'capacities',(select jsonb_agg(to_jsonb(c) order by c.id) from public.capacities c
    where c.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'assignments',(select jsonb_agg(to_jsonb(a) order by a.id) from public.driver_vehicle_assignments a
    where a.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'sources',(select jsonb_agg(to_jsonb(s) order by s.vehicle_id) from public.telematics_location_sources s
    where s.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'locations',(select jsonb_agg(to_jsonb(l) order by l.vehicle_id) from public.vehicle_driver_locations l
    where l.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'featured',(select jsonb_agg(to_jsonb(s) order by s.id) from public.featured_provider_slots s)
 )
$$;
do $test$
declare job_id bigint;token uuid;outcome jsonb;replay jsonb;denied boolean;
  capacity_count bigint;before_state jsonb;attempt integer;owner_id uuid;
  vehicle_a constant uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b constant uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  original_a uuid;original_b uuid;capacity_a uuid;capacity_b uuid;
begin
  if current_database() not in('loadgistic_demo_handover_187_ci','loadgistic_telematics_ci')
    then raise exception 'ISOLATED_HANDOVER_TEST_DATABASE_REQUIRED';end if;
  if (select enabled from public.demo_world_control where id=1)
    then raise exception 'HANDOVER_WORKER_DEFAULT_ENABLED';end if;
  if has_function_privilege('service_role','public.demo_world_execute_atomic_handover()','EXECUTE')
    or has_function_privilege('anon','public.demo_world_claim_handover(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.demo_world_execute_handover_job(bigint,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.demo_world_claim_handover(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.demo_world_execute_handover_job(bigint,uuid)','EXECUTE')
    or has_table_privilege('service_role','public.demo_world_handover_jobs','INSERT')
    then raise exception 'HANDOVER_WORKER_PERMISSION_DRIFT';end if;
  if not public.demo_world_handover_slot('2026-10-26 11:00:00+00')
    or not public.demo_world_handover_slot('2026-11-09 12:00:00+00')
    or public.demo_world_handover_slot('2026-10-26 10:59:59+00')
    or public.demo_world_handover_slot('2026-10-27 11:00:00+00')
    or public.demo_world_handover_slot('2026-11-02 11:00:00+00')
    then raise exception 'HANDOVER_FORTNIGHT_SLOT_DRIFT';end if;
  if exists(select 1 from public.demo_world_claim_handover(gen_random_uuid()))
    then raise exception 'HANDOVER_WORKER_DISABLED_CLAIMED';end if;
  -- A fresh managed fixture may feature either handover driver today. Keep
  -- this worker's retirement-denial path independent of that safety gate; the
  -- atomic handover test verifies current/future Featured denial explicitly.
  with affected as (
    select day.id,row_number() over(order by day.id)::integer as ordinal
    from public.featured_provider_days day
    where day.feature_date>=current_date and exists(
      select 1 from public.featured_provider_slots slot
      where slot.day_id=day.id and (
        slot.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7',
                           '49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')
        or slot.driver_user_id in(
          select driver_user_id from public.driver_vehicle_assignments
          where active and vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7',
                                         '49d736cb-cd47-47dd-9f8d-2f7c1e8199e7'))))
  )
  update public.featured_provider_days day
    set feature_date=current_date-1000-affected.ordinal
  from affected where day.id=affected.id;
  denied:=false;
  begin perform public.demo_world_claim_handover(null);
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_WORKER_REFUSED';end;
  if not denied then raise exception 'HANDOVER_NULL_WORKER_ACCEPTED';end if;
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
  before_state:=pg_temp.handover_worker_state();
  if exists(select 1 from public.demo_world_claim_handover(gen_random_uuid()))
    or pg_temp.handover_worker_state() is distinct from before_state
    then raise exception 'HANDOVER_HELD_CLAIM_CHANGED_STATE';end if;
  -- Seed a historical lease-shaped fixture on this UTC day. Current claims are
  -- held; the historical schedule and lease guards remain independently tested.
  insert into public.demo_world_handover_jobs(simulation_day,scheduled_at,state,
    lease_token,leased_by,lease_expires_at,attempts)
  values((clock_timestamp() at time zone 'UTC')::date,
    (((clock_timestamp() at time zone 'UTC')::date::timestamp+interval '11 hours') at time zone 'UTC'),
    'LEASED',gen_random_uuid(),gen_random_uuid(),clock_timestamp()+interval '2 minutes',1)
  returning id,lease_token into job_id,token;
  denied:=false;
  begin perform public.demo_world_execute_handover_job(job_id,gen_random_uuid());
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_LEASE_REFUSED';end;
  if not denied then raise exception 'HANDOVER_WRONG_LEASE_ACCEPTED';end if;
  denied:=false;
  begin
    update public.demo_world_handover_jobs set lease_expires_at=clock_timestamp()-interval '1 second'
      where id=job_id;
    perform public.demo_world_execute_handover_job(job_id,token);
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_LEASE_REFUSED';end;
  if not denied then raise exception 'HANDOVER_EXPIRED_LEASE_ACCEPTED';end if;
  select count(*) into capacity_count from public.capacities
    where vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7',
      '49d736cb-cd47-47dd-9f8d-2f7c1e8199e7');
  denied:=false;
  begin
    update public.vehicle_capacity_sharing set mode='BOTH'
      where vehicle_id='54eb0674-4aa2-4975-bc1b-18999463a5b7';
    perform public.demo_world_execute_handover_job(job_id,token);
  exception when others then denied:=sqlerrm='DEMO_MANUAL_LANE_HELD';end;
  if not denied then raise exception 'HANDOVER_DRIFT_ACCEPTED';end if;
  if (select count(*) from public.capacities
      where vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7',
        '49d736cb-cd47-47dd-9f8d-2f7c1e8199e7'))<>capacity_count
    or (select state from public.demo_world_handover_jobs where id=job_id)<>'LEASED'
    or exists(select 1 from public.demo_world_handover_receipts)
    then raise exception 'HANDOVER_RETRY_LEFT_PARTIAL_WRITE';end if;
  before_state:=pg_temp.handover_worker_state();
  for attempt in 1..2 loop
    denied:=false;
    begin perform public.demo_world_execute_handover_job(job_id,token);
    exception when others then denied:=sqlerrm='DEMO_MANUAL_LANE_HELD';end;
    if not denied then raise exception 'HANDOVER_WORKER_MANUAL_LANE_NOT_HELD';end if;
    if pg_temp.handover_worker_state() is distinct from before_state
      or (select state from public.demo_world_handover_jobs where id=job_id)<>'LEASED'
      then raise exception 'HANDOVER_MANUAL_FAILURE_CHANGED_PENDING_JOB_OR_STATE';end if;
  end loop;
  if public.demo_world_handover_status()->>'last_completed_day' is not null
    then raise exception 'HANDOVER_FAILED_JOB_REPORTED_COMPLETED';end if;

  -- A completed historical receipt may still replay read-only while held.
  -- Seed that exact disposable fixture directly, preserving dated locations.
  select driver_user_id into original_a from public.driver_vehicle_assignments where vehicle_id=vehicle_a and active;
  select driver_user_id into original_b from public.driver_vehicle_assignments where vehicle_id=vehicle_b and active;
  select u.id into owner_id from auth.users u where u.raw_app_meta_data->>'fixture_source'='loadgistic'
    and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01';
  select id into capacity_a from public.capacities where vehicle_id=vehicle_a order by updated_at desc,id desc limit 1;
  select id into capacity_b from public.capacities where vehicle_id=vehicle_b order by updated_at desc,id desc limit 1;
  update public.capacities set location_source='MANUAL_ADMIN' where id in(capacity_a,capacity_b);
  insert into public.demo_world_handover_receipts(simulation_day,owner_user_id,vehicle_a_id,vehicle_b_id,
    previous_driver_a_id,previous_driver_b_id,previous_capacity_a_id,previous_capacity_b_id,
    published_capacity_a_id,published_capacity_b_id)
  values((clock_timestamp() at time zone 'UTC')::date,owner_id,vehicle_a,vehicle_b,
    original_b,original_a,capacity_a,capacity_b,capacity_a,capacity_b);
  update public.demo_world_handover_jobs set state='DONE',leased_by=null,lease_expires_at=null,
    completed_at=clock_timestamp() where id=job_id;
  update public.demo_world_control set enabled=false where id=1;
  before_state:=pg_temp.handover_worker_state();
  outcome:=public.demo_world_execute_handover_job(job_id,token);
  replay:=public.demo_world_execute_handover_job(job_id,token);
  if outcome->>'completed'<>'true' or outcome->>'replayed'<>'true' or replay->>'replayed'<>'true'
    or pg_temp.handover_worker_state() is distinct from before_state
    then raise exception 'HANDOVER_HISTORICAL_JOB_REPLAY_CHANGED_STATE';end if;
  if public.demo_world_handover_status()->>'last_completed_day'
    is distinct from (clock_timestamp() at time zone 'UTC')::date::text
    then raise exception 'HANDOVER_STATUS_MISSING_COMPLETION';end if;
end $test$;
rollback;
