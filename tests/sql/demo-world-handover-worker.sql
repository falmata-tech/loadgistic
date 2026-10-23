-- FEAT-SIM-001. Run only after migrations 187–188 on the disposable clone.
-- All scenario writes are enclosed by this transaction and rolled back.
begin;
do $test$
declare job_id bigint;token uuid;outcome jsonb;replay jsonb;denied boolean;
  capacity_count bigint;receipt_count bigint;
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
  -- this worker's success path independent of that separate safety gate; the
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
  -- Simulate a valid durable claim on this UTC day. The real claim function
  -- alone inserts scheduled jobs, only on its fixed fortnightly slot.
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
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_SHARING_REFUSED';end;
  if not denied then raise exception 'HANDOVER_DRIFT_ACCEPTED';end if;
  if (select count(*) from public.capacities
      where vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7',
        '49d736cb-cd47-47dd-9f8d-2f7c1e8199e7'))<>capacity_count
    or (select state from public.demo_world_handover_jobs where id=job_id)<>'LEASED'
    or exists(select 1 from public.demo_world_handover_receipts)
    then raise exception 'HANDOVER_RETRY_LEFT_PARTIAL_WRITE';end if;
  outcome:=public.demo_world_execute_handover_job(job_id,token);
  if outcome->>'completed'<>'true' or outcome->>'replayed'<>'false'
    or (select state from public.demo_world_handover_jobs where id=job_id)<>'DONE'
    or (select count(*) from public.demo_world_handover_receipts)<>1
    then raise exception 'HANDOVER_JOB_NOT_COMPLETED';end if;
  select count(*) into receipt_count from public.demo_world_handover_receipts;
  replay:=public.demo_world_execute_handover_job(job_id,token);
  if replay->>'replayed'<>'true'
    or (select count(*) from public.demo_world_handover_receipts)<>receipt_count
    or (select count(*) from public.capacities
      where vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7',
        '49d736cb-cd47-47dd-9f8d-2f7c1e8199e7'))<>capacity_count+7
    then raise exception 'HANDOVER_JOB_REPLAY_WROTE_AGAIN';end if;
  if public.demo_world_handover_status()->>'last_completed_day'
    is distinct from (clock_timestamp() at time zone 'UTC')::date::text
    then raise exception 'HANDOVER_STATUS_MISSING_COMPLETION';end if;
end $test$;
rollback;
