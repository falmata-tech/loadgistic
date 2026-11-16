-- FEAT-SIM-001. Catalog224: run on a disposable fixture database.
-- No result survives this transaction. Never point this test at a hosted project.
begin;
set local statement_timeout='90s';
do $test$
declare
 first_step bigint;first_token uuid;second_step bigint;second_token uuid;
 replacement_token uuid;v_actor_id uuid;v_vehicle_id uuid;before_count bigint;after_count bigint;
 outcome jsonb;refused boolean;claimed record;constraint_name text;
 saved public.capacities%rowtype;receipt public.demo_world_receipts%rowtype;projection jsonb;
 expected_id uuid;expected_driver uuid;expected_actor uuid;target_row public.demo_world_targets%rowtype;
begin
 if current_database() not in('loadgistic_demo_world_185_ci','loadgistic_telematics_ci')
   then raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';end if;
 if (select enabled from public.demo_world_control where id=1) then raise exception 'DEMO_WORLD_DEFAULT_ENABLED';end if;
 if (select count(*) from public.demo_world_targets)<>5 or
  (select count(*) from public.demo_world_schedule)<>20
  or exists(select 1 from public.demo_world_schedule where phase_index not between 0 and 3
    or step_seconds<>120 or cycle_seconds<>480 or command<>'capacity.publish_phase'
    or expected_status not in('EMPTY','PARTIAL') or next_status not in('EMPTY','PARTIAL'))
  or (select array_agg(catalog_offset_seconds order by catalog_offset_seconds) from public.demo_world_targets)
     is distinct from array[0,30,60,90,120]
  then raise exception 'DEMO_WORLD_ALLOWLIST_DRIFT';end if;
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
  has_function_privilege('authenticated','public.demo_world_pause_step(bigint,uuid,text)','EXECUTE') or
  has_function_privilege('service_role','public.demo_world_catalog_phase(text,bigint,integer)','EXECUTE') or
  not has_function_privilege('service_role','public.demo_world_claim_batch(uuid,integer)','EXECUTE')
  then raise exception 'DEMO_WORLD_PERMISSION_DRIFT';end if;
 if exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1))
  then raise exception 'DEMO_WORLD_KILL_SWITCH_BYPASSED';end if;
 if public.demo_world_status()->>'enabled'<>'false' then raise exception 'DEMO_WORLD_STATUS_DEFAULT_DRIFT';end if;
 -- All five staggered initial phases are due; there is no UTC-day catch-up.
 update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '121 seconds',
  catalog_starts_at=null,last_dispatch_at=null where id=1;
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
 if exists(select 1 from public.demo_world_steps step join public.demo_world_targets target using(target_key)
  cross join public.demo_world_control control where control.id=1 and
   (step.phase_index<>0 or step.cycle_index<>0 or step.catalog_epoch<>control.catalog_epoch
    or step.scheduled_at is distinct from control.activated_at+target.catalog_offset_seconds*interval '1 second'
    or step.nominal_scheduled_at is distinct from step.scheduled_at))
  then raise exception 'DEMO_WORLD_INITIAL_STAGGER_DRIFT';end if;
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
 -- The unique unfinished-target boundary prevents a second phase being queued
 -- while this exact target still has pending/leased work.
 refused:=false;
 begin
  insert into public.demo_world_steps(target_key,phase_index,scheduled_at,nominal_scheduled_at,
   transition_id,idempotency_key,catalog_epoch,cycle_index,expected_capacity_id)
  select target_key,1,scheduled_at+interval '1 second',nominal_scheduled_at+interval '120 seconds',
   transition_id||'-competing',repeat('a',64),catalog_epoch,cycle_index,expected_capacity_id from public.demo_world_steps where id=first_step;
 exception when unique_violation then
  get stacked diagnostics constraint_name=CONSTRAINT_NAME;
  refused:=constraint_name='demo_world_one_unfinished_target224';
 end;
 if not refused then raise exception 'DEMO_WORLD_SECOND_UNFINISHED_TARGET_ACCEPTED';end if;
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
 refused:=false;
 begin
  update public.vehicle_capacity_sharing set mode='PUBLIC' where vehicle_id=v_vehicle_id;
  perform public.demo_world_execute_capacity_step(first_step,first_token);
 exception when others then refused:=sqlerrm='DEMO_WORLD_SHARING_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_SHARING_DRIFT_ACCEPTED';end if;
 refused:=false;
 begin
  update public.capacities capacity set current_route_points_json=(select jsonb_agg(point.value order by point.ordinality desc)
   from jsonb_array_elements(capacity.current_route_points_json) with ordinality as point(value,ordinality)) where id=(
   select id from public.capacities where vehicle_id=v_vehicle_id order by updated_at desc,id desc limit 1);
  perform public.demo_world_execute_capacity_step(first_step,first_token);
 exception when others then refused:=sqlerrm='DEMO_WORLD_ROUTE_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_ROUTE_DRIFT_ACCEPTED';end if;
 refused:=false;
 begin
  update public.demo_world_schedule set scenario_key='caller-selected-scenario'
   where target_key=(select target_key from public.demo_world_steps where id=first_step) and phase_index=0;
  perform public.demo_world_execute_capacity_step(first_step,first_token);
 exception when others then refused:=sqlerrm='DEMO_WORLD_CATALOG_REFUSED';end;
 if not refused then raise exception 'DEMO_WORLD_CATALOG_DRIFT_ACCEPTED';end if;
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
 select * into receipt from public.demo_world_receipts where step_id=first_step;
 select * into saved from public.capacities where id=receipt.capacity_id;
 if saved.status<>'PARTIAL' or saved.available_percent<>80 or saved.available_percent_reported_at is null
  or saved.available_percent_reported_by<>v_actor_id
  or receipt.completed_at is distinct from(select completed_at from public.demo_world_steps where id=first_step)
  or receipt.applied_at is distinct from saved.updated_at or receipt.completed_at<receipt.applied_at
  or receipt.completed_at<saved.updated_at or receipt.phase_index<>0 or receipt.cycle_index<>0
  or receipt.due_at is distinct from(select scheduled_at from public.demo_world_steps where id=first_step)
  or receipt.nominal_scheduled_at is distinct from(select nominal_scheduled_at from public.demo_world_steps where id=first_step)
  then raise exception 'DEMO_WORLD_REPORTED_BOOTSTRAP_OR_AUDIT_DRIFT';end if;
 outcome:=public.demo_world_execute_capacity_step(first_step,replacement_token);
 if outcome->>'result'<>'REPLAYED' then raise exception 'DEMO_WORLD_REPLAY_WRITES';end if;
 select count(*) into after_count from public.capacities where vehicle_id=v_vehicle_id;
 if after_count<>before_count+1 then raise exception 'DEMO_WORLD_NOT_EXACTLY_ONE_CAPACITY';end if;
 -- Finish only the five currently leased first phases. Later nominal episodes
 -- may already be old, but actual completion still imposes a two-minute dwell.
 for claimed in select id as step_id,lease_token from public.demo_world_steps where state='LEASED' order by id loop
  outcome:=public.demo_world_execute_capacity_step(claimed.step_id,claimed.lease_token);
  if outcome->>'result'<>'APPLIED' then raise exception 'DEMO_WORLD_BOOTSTRAP_COMMAND_REFUSED';end if;
 end loop;
 for claimed in select * from public.demo_world_claim_batch(gen_random_uuid(),5) loop
  outcome:=public.demo_world_execute_capacity_step(claimed.step_id,claimed.lease_token);
  if outcome->>'result'<>'APPLIED' then raise exception 'DEMO_WORLD_BOOTSTRAP_PENDING_COMMAND_REFUSED';end if;
 end loop;
 if (select count(*) from public.demo_world_receipts)<>5
  or exists(select 1 from public.demo_world_steps where phase_index<>0 or state<>'DONE')
  then raise exception 'DEMO_WORLD_BOOTSTRAP_CHAIN_INCOMPLETE';end if;
 for target_row in select * from public.demo_world_targets loop
  select capacity_id,actor_id into expected_id,expected_actor from public.demo_world_receipts where vehicle_id=target_row.vehicle_id;
  select * into saved from public.capacities where id=expected_id;
  select driver_user_id into expected_driver from public.driver_vehicle_assignments where vehicle_id=target_row.vehicle_id and active;
  if saved.status<>'PARTIAL' or saved.available_percent<>80 or saved.available_percent_reported_at is null
   or saved.available_percent_reported_by<>expected_actor or saved.available_percent_reported_driver_id<>expected_driver
   then raise exception 'DEMO_WORLD_BOOTSTRAP_PERCENT_OR_ATTRIBUTION_MISSING';end if;
  if target_row.expected_sharing_mode<>'PRIVATE' then
   select payload into projection from public.public_capacity_page(jsonb_build_object('capacity_id',saved.id)) limit 1;
  else
   select value into projection from jsonb_array_elements(public.provider_capacity_workspace(expected_actor)->'capacities')
    where value->>'id'=saved.id::text;
  end if;
  if projection->>'available_percent'<>'80' or projection->>'available_percent_reported_at' is null
   then raise exception 'DEMO_WORLD_REPORTED_PERCENT_PROJECTION_MISSING';end if;
 end loop;
 if exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),5))
  or (select count(*) from public.demo_world_steps)<>5
  then raise exception 'DEMO_WORLD_COMPLETION_DWELL_OR_CATCHUP_BYPASSED';end if;
 refused:=false;
 begin update public.demo_world_receipts set next_status='EMPTY' where step_id=first_step;
 exception when others then refused:=sqlerrm='DEMO_WORLD_RECEIPT_IMMUTABLE';end;
 if not refused then raise exception 'DEMO_WORLD_RECEIPT_MUTABLE';end if;
 update public.demo_world_control set enabled=false where id=1;
 if exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1))
  then raise exception 'DEMO_WORLD_KILL_SWITCH_AFTER_EXECUTION_BYPASSED';end if;
 outcome:=public.demo_world_execute_capacity_step(first_step,replacement_token);
 if outcome->>'result'<>'REPLAYED'
  or (select count(*) from public.capacities where vehicle_id=v_vehicle_id)<>after_count
  or to_jsonb(receipt) is distinct from(select to_jsonb(saved_receipt) from public.demo_world_receipts saved_receipt where step_id=first_step)
  then raise exception 'DEMO_WORLD_DISABLED_HISTORICAL_REPLAY_CHANGED_STATE';end if;
end $test$;
rollback;
