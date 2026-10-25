-- FEAT-SIM-001. Run after migration 185 on a disposable fixture database.
-- No result survives this transaction. Never point this test at a hosted project.
begin;
do $test$
declare
 first_step bigint;first_token uuid;second_step bigint;second_token uuid;
 replacement_token uuid;v_actor_id uuid;v_vehicle_id uuid;before_count bigint;after_count bigint;
 outcome jsonb;refused boolean;claimed record;attempt_number integer;utc_start timestamptz;
begin
 if current_database() not in('loadgistic_demo_world_185_ci','loadgistic_telematics_ci')
   then raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';end if;
 if (select enabled from public.demo_world_control where id=1) then raise exception 'DEMO_WORLD_DEFAULT_ENABLED';end if;
 if (select count(*) from public.demo_world_targets)<>5 or
  (select count(*) from public.demo_world_schedule)<>14 then raise exception 'DEMO_WORLD_ALLOWLIST_DRIFT';end if;
 -- Fresh account-only fixtures have no private recipient yet, so these two
 -- exact demo vehicles start PUBLIC. Exercise their existing BOTH scenarios
 -- by opting the policies in within this disposable, rolled-back test.
 update public.vehicle_capacity_sharing sharing set mode='BOTH'
 from public.demo_world_targets target
 where target.vehicle_id=sharing.vehicle_id
   and target.target_key in('fleet-02-partial','fleet-06-partial')
   and sharing.mode='PUBLIC' and sharing.exclusive_email is null
   and sharing.exclusive_digest is null;
 if exists(select 1 from public.demo_world_targets target
   left join public.vehicle_capacity_sharing sharing on sharing.vehicle_id=target.vehicle_id
   where sharing.mode is distinct from target.expected_sharing_mode)
   then raise exception 'DEMO_WORLD_SHARING_FIXTURE_MISMATCH';end if;
 if has_table_privilege('anon','public.demo_world_steps','SELECT') or
  has_table_privilege('authenticated','public.demo_world_receipts','SELECT') or
  has_table_privilege('service_role','public.demo_world_targets','UPDATE') or
  has_function_privilege('anon','public.demo_world_claim_batch(uuid,integer)','EXECUTE') or
  has_function_privilege('anon','public.demo_world_status()','EXECUTE') or
  has_function_privilege('authenticated','public.demo_world_execute_capacity_step(bigint,uuid)','EXECUTE') or
  not has_function_privilege('service_role','public.demo_world_claim_batch(uuid,integer)','EXECUTE')
  then raise exception 'DEMO_WORLD_PERMISSION_DRIFT';end if;
 if exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1))
  then raise exception 'DEMO_WORLD_KILL_SWITCH_BYPASSED';end if;
 if public.demo_world_status()->>'enabled'<>'false' then raise exception 'DEMO_WORLD_STATUS_DEFAULT_DRIFT';end if;
 update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
 if exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1))
  then raise exception 'DEMO_WORLD_STARTUP_BACKFILLED';end if;
 update public.demo_world_control set activated_at=(date_trunc('day',clock_timestamp() at time zone 'UTC')
  at time zone 'UTC')-interval '1 day',last_dispatch_at=null where id=1;
 -- The frozen imported fleet fixture predates its driver assignments. Give only
 -- these four disposable synthetic pairs a post-assignment copy of their
 -- already obscured point/radius, so the real provider command can be tested.
 -- This is test setup, rolled back below; the production worker has no such
 -- write and refuses if GPS/phone capture has not supplied a current fix.
 insert into public.vehicle_driver_locations(vehicle_id,driver_user_id,latitude,longitude,
  precision_km,area,place_ref,updated_at,observed_at)
 select target.vehicle_id,assignment.driver_user_id,capacity.location_lat,capacity.location_lng,
  capacity.location_precision_km,coalesce(capacity.location_area,'Demo location'),
  capacity.local_place_ref,clock_timestamp(),clock_timestamp()
 from public.demo_world_targets target
 join public.driver_vehicle_assignments assignment on assignment.vehicle_id=target.vehicle_id and assignment.active
 join lateral(select * from public.capacities row where row.vehicle_id=target.vehicle_id
  order by row.updated_at desc,row.id desc limit 1) capacity on true
 where target.organization_id is not null
 on conflict(vehicle_id) do nothing;
 refused:=false;
 begin perform public.demo_world_claim_batch(null,1);exception when others then refused:=sqlerrm='DEMO_WORLD_INPUT_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_NULL_WORKER_ACCEPTED';end if;
 refused:=false;
 begin perform public.demo_world_claim_batch(gen_random_uuid(),100);exception when others then refused:=sqlerrm='DEMO_WORLD_INPUT_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_UNBOUNDED_BATCH_ACCEPTED';end if;
 select step_id,lease_token into first_step,first_token
 from public.demo_world_claim_batch(gen_random_uuid(),1);
 if first_step is null or first_token is null then raise exception 'DEMO_WORLD_NO_DUE_STEP';end if;
 if (public.demo_world_status()->>'pending_count')::integer<1 or
  public.demo_world_status() ? 'vehicle_id' or public.demo_world_status() ? 'lease_token'
  then raise exception 'DEMO_WORLD_STATUS_UNSAFE';end if;
 select step_id,lease_token into second_step,second_token
 from public.demo_world_claim_batch(gen_random_uuid(),1);
 if second_step=first_step or second_token=first_token then raise exception 'DEMO_WORLD_DOUBLE_CLAIM';end if;
 select t.vehicle_id,(array_agg(u.id))[1] into v_vehicle_id,v_actor_id
 from public.demo_world_steps step join public.demo_world_targets t on t.target_key=step.target_key
 join auth.users u on u.raw_user_meta_data->>'fixture_key'=t.actor_fixture_key
 where step.id=first_step group by t.vehicle_id;
 if v_actor_id is null or v_vehicle_id is null then raise exception 'DEMO_WORLD_FIXTURE_MISSING';end if;
 select count(*) into before_count from public.capacities where vehicle_id=v_vehicle_id;
 refused:=false;
 begin perform public.demo_world_execute_capacity_step(first_step,gen_random_uuid());
 exception when others then refused:=sqlerrm='DEMO_WORLD_LEASE_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_WRONG_TOKEN_ACCEPTED';end if;
 -- A real or unmarked account cannot impersonate a scenario actor.
 refused:=false;
 begin
  update auth.users set raw_app_meta_data=raw_app_meta_data-'fixture_source' where id=v_actor_id;
  perform public.demo_world_execute_capacity_step(first_step,first_token);
 exception when others then refused:=sqlerrm='DEMO_WORLD_ACTOR_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_UNMARKED_ACTOR_ACCEPTED';end if;
 -- Reassignment or missing exact demo driver also blocks the step.
 refused:=false;
 begin
  update public.driver_vehicle_assignments set active=false where vehicle_id=v_vehicle_id and active;
  perform public.demo_world_execute_capacity_step(first_step,first_token);
 exception when others then refused:=sqlerrm='DEMO_WORLD_DRIVER_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_DRIVER_DRIFT_ACCEPTED';end if;
 update public.demo_world_steps set lease_expires_at=clock_timestamp()-interval '1 second' where id=first_step;
 refused:=false;
 begin perform public.demo_world_execute_capacity_step(first_step,first_token);
 exception when others then refused:=sqlerrm='DEMO_WORLD_LEASE_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_EXPIRED_LEASE_ACCEPTED';end if;
 select lease_token into replacement_token from public.demo_world_claim_batch(gen_random_uuid(),1)
  where step_id=first_step;
 if replacement_token is null or replacement_token=first_token then raise exception 'DEMO_WORLD_EXPIRED_LEASE_NOT_RECLAIMED';end if;
 refused:=false;
 begin perform public.demo_world_execute_capacity_step(first_step,first_token);
 exception when others then refused:=sqlerrm='DEMO_WORLD_LEASE_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_STALE_LEASE_ACCEPTED';end if;
 outcome:=public.demo_world_execute_capacity_step(first_step,replacement_token);
 if outcome->>'result'<>'APPLIED' then raise exception 'DEMO_WORLD_VALID_STEP_NOT_APPLIED';end if;
 if (select count(*) from public.demo_world_receipts where step_id=first_step)<>1
  or (select state from public.demo_world_steps where id=first_step)<>'DONE'
  then raise exception 'DEMO_WORLD_ATOMIC_RECEIPT_MISSING';end if;
 outcome:=public.demo_world_execute_capacity_step(first_step,replacement_token);
 if outcome->>'result'<>'REPLAYED' then raise exception 'DEMO_WORLD_REPLAY_WRITES';end if;
 select count(*) into after_count from public.capacities where vehicle_id=v_vehicle_id;
 if after_count<>before_count+1 then raise exception 'DEMO_WORLD_NOT_EXACTLY_ONE_CAPACITY';end if;
 -- Complete the full previous UTC day to exercise both added commands and
 -- prove the five target chains return to their baseline states.
 utc_start:=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 if (select scheduled_at from public.demo_world_steps where id=second_step)<utc_start then
  outcome:=public.demo_world_execute_capacity_step(second_step,second_token);
  if outcome->>'result'<>'APPLIED' then raise exception 'DEMO_WORLD_SECOND_STEP_REFUSED';end if;
 end if;
 for attempt_number in 1..10 loop
  for claimed in select * from public.demo_world_claim_batch(gen_random_uuid(),10) loop
   if (select scheduled_at from public.demo_world_steps where id=claimed.step_id)<utc_start then
    outcome:=public.demo_world_execute_capacity_step(claimed.step_id,claimed.lease_token);
    if outcome->>'result'<>'APPLIED' then raise exception 'DEMO_WORLD_DAILY_COMMAND_REFUSED';end if;
   end if;
  end loop;
  exit when not exists(select 1 from public.demo_world_steps
   where scheduled_at<utc_start and state<>'DONE');
 end loop;
 if (select count(*) from public.demo_world_receipts receipt
  join public.demo_world_steps step on step.id=receipt.step_id
  where step.scheduled_at<utc_start)<>14
  then raise exception 'DEMO_WORLD_DAILY_CHAIN_INCOMPLETE';end if;
 if exists(select 1 from public.demo_world_targets target
  join lateral(select capacity.status::text as status from public.capacities capacity
   where capacity.vehicle_id=target.vehicle_id order by capacity.updated_at desc,capacity.id desc limit 1) latest on true
  where latest.status<>target.baseline_status)
  then raise exception 'DEMO_WORLD_DAILY_BASELINE_DRIFT';end if;
 refused:=false;
 begin update public.demo_world_receipts set next_status='EMPTY' where step_id=first_step;
 exception when others then refused:=sqlerrm='DEMO_WORLD_RECEIPT_IMMUTABLE';end;
 if not refused then raise exception 'DEMO_WORLD_RECEIPT_MUTABLE';end if;
 update public.demo_world_control set enabled=false where id=1;
 if exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1))
  then raise exception 'DEMO_WORLD_KILL_SWITCH_AFTER_EXECUTION_BYPASSED';end if;
end $test$;
rollback;
