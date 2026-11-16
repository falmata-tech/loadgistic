-- FEAT-SIM-001 / 224. Disposable, rollback-only clock fixtures, never a hosted
-- clock override or evidence of actual two-minute wall-clock operation.
begin;
set local statement_timeout='90s';
do $$begin
 if current_database() not in('loadgistic_demo_world_185_ci','loadgistic_telematics_ci')
  then raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';end if;
 if (select enabled from public.demo_world_control where id=1)
  or exists(select 1 from public.demo_world_steps) or exists(select 1 from public.demo_world_receipts)
  then raise exception 'FAST_CATALOG_INERT_FIXTURE_REQUIRED';end if;
end $$;

create function pg_temp.fast_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAST224_ASSERT_%',label;end if;end $$;
create function pg_temp.fast_denied(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
  if sqlerrm=expected then return;end if;
  raise exception 'FAST224_WRONG_DENIAL_EXPECTED_%_GOT_%',expected,sqlerrm;
 end;
 raise exception 'FAST224_DENIAL_MISSING_%',expected;
end $$;
create function pg_temp.fast_state() returns jsonb language sql stable as $$
 with actor_ids as(
  select member.user_id as id from public.organization_members member
   where member.membership_role='OWNER' and member.organization_id in(select organization_id from public.demo_world_targets)
  union select provider.user_id from public.provider_profiles provider
   where provider.id in(select provider_profile_id from public.demo_world_targets)
  union select assignment.driver_user_id from public.driver_vehicle_assignments assignment
   where assignment.vehicle_id in(select vehicle_id from public.demo_world_targets)
 )
 select jsonb_build_object(
  'control',(select to_jsonb(c) from public.demo_world_control c where id=1),
  'targets',(select jsonb_agg(to_jsonb(t) order by target_key) from public.demo_world_targets t),
  'steps',(select jsonb_agg(to_jsonb(s) order by id) from public.demo_world_steps s),
  'receipts',(select jsonb_agg(to_jsonb(r) order by step_id) from public.demo_world_receipts r),
  'accounts',(select jsonb_agg(to_jsonb(u) order by u.id) from auth.users u where u.id in(select id from actor_ids)),
  'profiles',(select jsonb_agg(to_jsonb(p) order by p.id) from public.profiles p where p.id in(select id from actor_ids)),
  'sessions',(select jsonb_agg(to_jsonb(s) order by s.id) from auth.sessions s where s.user_id in(select id from actor_ids)),
  'members',(select jsonb_agg(to_jsonb(m) order by m.id) from public.organization_members m
    where m.organization_id in(select organization_id from public.demo_world_targets)),
  'organizations',(select jsonb_agg(to_jsonb(o) order by o.id) from public.organizations o
    where o.id in(select organization_id from public.demo_world_targets)),
  'providers',(select jsonb_agg(to_jsonb(p) order by p.id) from public.provider_profiles p
    where p.id in(select provider_profile_id from public.demo_world_targets)),
  'vehicles',(select jsonb_agg(to_jsonb(v) order by v.id) from public.vehicles v
    where v.id in(select vehicle_id from public.demo_world_targets)),
  'capacities',(select jsonb_agg(to_jsonb(c) order by c.id) from public.capacities c
    where vehicle_id in(select vehicle_id from public.demo_world_targets)),
  'assignments',(select jsonb_agg(to_jsonb(a) order by a.id) from public.driver_vehicle_assignments a
    where vehicle_id in(select vehicle_id from public.demo_world_targets)),
  'sources',(select jsonb_agg(to_jsonb(s) order by vehicle_id) from public.telematics_location_sources s
    where vehicle_id in(select vehicle_id from public.demo_world_targets)),
  'locations',(select jsonb_agg(to_jsonb(l) order by vehicle_id) from public.vehicle_driver_locations l
    where vehicle_id in(select vehicle_id from public.demo_world_targets)),
  'gps_locations',(select jsonb_agg(to_jsonb(p) order by p.id) from public.telematics_positions p
    where p.vehicle_id in(select vehicle_id from public.demo_world_targets)),
  'motion_targets',(select jsonb_agg(to_jsonb(m) order by m.vehicle_id) from public.demo_motion_targets m
    where m.vehicle_id in(select vehicle_id from public.demo_world_targets)),
  'phone_bindings',(select jsonb_agg(to_jsonb(b) order by b.id) from public.phone_location_bindings b
    where b.vehicle_id in(select vehicle_id from public.demo_world_targets)),
  'phone_installations',(select jsonb_agg(to_jsonb(i) order by i.id) from public.phone_location_installations i
    where i.id in(select installation_id from public.phone_location_bindings
      where vehicle_id in(select vehicle_id from public.demo_world_targets))),
  'sharing',(select jsonb_agg(to_jsonb(s) order by vehicle_id) from public.vehicle_capacity_sharing s
    where vehicle_id in(select vehicle_id from public.demo_world_targets))
 )
$$;

-- Counterfactual historical predecessor fixtures are inserted with matching
-- job/receipt completion times. Real applied immutable receipts are never edited
-- or their trigger disabled. Generated geometry columns are computed normally.
create function pg_temp.fast_predecessor(target_key text,next_cycle bigint,next_phase integer,age_seconds integer default 121)
returns uuid language plpgsql as $$
declare target public.demo_world_targets%rowtype;control public.demo_world_control%rowtype;
 current_capacity public.capacities%rowtype;phase jsonb;previous_phase integer;previous_cycle bigint;
 owner_id uuid;driver_id uuid;stamp timestamptz:=clock_timestamp()-age_seconds*interval '1 second';
 fixture_id uuid:=gen_random_uuid();job_id bigint;transition_value text;nominal_time timestamptz;
 columns_sql text;payload jsonb;route_points jsonb;
begin
 select * into strict target from public.demo_world_targets t where t.target_key=fast_predecessor.target_key;
 select * into strict control from public.demo_world_control where id=1;
 select * into strict current_capacity from public.capacities where vehicle_id=target.vehicle_id
  order by updated_at desc,id desc limit 1;
 select u.id into strict owner_id from auth.users u where u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key'=target.actor_fixture_key;
 select driver_user_id into strict driver_id from public.driver_vehicle_assignments
  where vehicle_id=target.vehicle_id and active;
 phase:=public.demo_world_catalog_phase(target.target_key,next_cycle,next_phase);
 if phase is null or next_cycle=0 and next_phase=0 then raise exception 'FAST224_BAD_PREDECESSOR_FIXTURE';end if;
 previous_phase:=case when next_phase=0 then 3 else next_phase-1 end;
 previous_cycle:=next_cycle-case when next_phase=0 then 1 else 0 end;
 select jsonb_agg(jsonb_build_object('key',place.id,'place_ref',place.id,'label',place.name,
   'lat',place.latitude,'lng',place.longitude) order by ref.ordinality) into route_points
 from jsonb_array_elements_text(phase->'expectedRouteRefs') with ordinality ref(value,ordinality)
 join public.place_catalog place on place.id=ref.value;
 if jsonb_array_length(route_points) is distinct from jsonb_array_length(phase->'expectedRouteRefs')
  then raise exception 'FAST224_ROUTE_FIXTURE_PLACE_MISSING';end if;
 -- Place the old fixture history before the staged predecessor. This is local
 -- test setup only; no production code accepts dates or a simulator test clock.
 update public.capacities set updated_at=stamp-interval '1 second',expires_at=stamp-interval '1 second'
  where vehicle_id=target.vehicle_id;
 payload:=to_jsonb(current_capacity)||jsonb_build_object('id',fixture_id,
  'status',phase->>'expectedStatus','market_status',phase->>'expectedStatus',
  'available_percent',(phase->>'expectedAvailablePercent')::integer,
  'available_percent_reported_at',case when phase->>'expectedStatus'='PARTIAL' then stamp else null end,
  'available_percent_reported_by',case when phase->>'expectedStatus'='PARTIAL' then owner_id else null end,
  'available_percent_reported_driver_id',case when phase->>'expectedStatus'='PARTIAL' then driver_id else null end,
  'accepts_full_load',false,'accepts_partial_load',true,'updated_at',stamp,'updated_by',owner_id,
  'expires_at',clock_timestamp()+interval '1 day','availability_geometry','ROUTE',
  'current_route_points_json',route_points);
 select string_agg(format('%I',attname),',' order by attnum) into columns_sql from pg_attribute
  where attrelid='public.capacities'::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='';
 execute format('insert into public.capacities (%1$s) select %1$s from jsonb_populate_record(null::public.capacities,$1)',columns_sql)
  using payload;
 transition_value:='v1:c2:'||target.target_key||'-capacity-episode:'||target.target_key||
  ':e'||control.catalog_epoch||':c'||previous_cycle||':p'||previous_phase;
 nominal_time:=control.activated_at+(target.catalog_offset_seconds+previous_cycle*480+previous_phase*120)*interval '1 second';
 insert into public.demo_world_steps(target_key,phase_index,scheduled_at,nominal_scheduled_at,
  transition_id,idempotency_key,catalog_epoch,cycle_index,expected_capacity_id,state,attempts,completed_at)
 values(target.target_key,previous_phase,stamp-interval '1 second',nominal_time,transition_value,
  encode(sha256(convert_to('loadgistic-demo-world|'||transition_value,'UTF8')),'hex'),
  control.catalog_epoch,previous_cycle,current_capacity.id,'DONE',1,stamp) returning id into job_id;
 insert into public.demo_world_receipts(step_id,transition_id,idempotency_key,actor_id,vehicle_id,
  previous_capacity_id,capacity_id,previous_status,next_status,applied_at,catalog_epoch,cycle_index,
  phase_index,nominal_scheduled_at,due_at,completed_at)
 values(job_id,transition_value,encode(sha256(convert_to('loadgistic-demo-world|'||transition_value,'UTF8')),'hex'),
  owner_id,target.vehicle_id,current_capacity.id,fixture_id,
  public.demo_world_catalog_phase(target.target_key,previous_cycle,previous_phase)->>'expectedStatus',
  phase->>'expectedStatus',stamp,control.catalog_epoch,previous_cycle,previous_phase,
  nominal_time,stamp-interval '1 second',stamp);
 return fixture_id;
end $$;

create function pg_temp.fast_human_report(target_key text,percent integer) returns uuid language plpgsql as $$
declare target public.demo_world_targets%rowtype;current_capacity public.capacities%rowtype;owner_id uuid;
begin
 select * into strict target from public.demo_world_targets t where t.target_key=fast_human_report.target_key;
 select * into strict current_capacity from public.capacities where vehicle_id=target.vehicle_id
  order by updated_at desc,id desc limit 1;
 select u.id into strict owner_id from auth.users u where u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key'=target.actor_fixture_key;
 return public.publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',target.vehicle_id,
  'status','PARTIAL','visibility',current_capacity.visibility,'sharing_mode',target.expected_sharing_mode,
  'availability_geometry','ROUTE','current_route_places',current_capacity.current_route_points_json,
  'accepted_loads','PTL','location_source','PRESERVE_DRIVER','available_percent',percent,
  'accepts_multi_pick',current_capacity.accepts_multi_pick,'accepts_multi_drop',current_capacity.accepts_multi_drop));
end $$;

-- Match only the checked-in synthetic fixture policy and existing obscured
-- points. These setup writes are discarded by the outer transaction.
update public.vehicle_capacity_sharing sharing set mode='BOTH' from public.demo_world_targets target
where sharing.vehicle_id=target.vehicle_id and target.expected_sharing_mode='BOTH' and sharing.mode='PUBLIC';
insert into public.vehicle_driver_locations(vehicle_id,driver_user_id,latitude,longitude,precision_km,area,place_ref,updated_at,observed_at)
select target.vehicle_id,assignment.driver_user_id,capacity.location_lat,capacity.location_lng,
 capacity.location_precision_km,coalesce(capacity.location_area,'Demo location'),capacity.local_place_ref,clock_timestamp(),clock_timestamp()
from public.demo_world_targets target
join public.driver_vehicle_assignments assignment on assignment.vehicle_id=target.vehicle_id and assignment.active
join lateral(select * from public.capacities row where row.vehicle_id=target.vehicle_id order by updated_at desc,id desc limit 1) capacity on true
where target.organization_id is not null on conflict(vehicle_id) do nothing;

do $gates$
declare before_state jsonb;job record;control_start timestamptz;capacity_id uuid;transition_value text;
begin
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp(),catalog_starts_at=null,last_dispatch_at=null where id=1;
  select activated_at into control_start from public.demo_world_control where id=1;
  select * into job from public.demo_world_claim_batch(gen_random_uuid(),5);
  perform pg_temp.fast_assert(job.step_id is not null and (select target_key='independent-partial'
   and phase_index=0 and cycle_index=0 and scheduled_at=control_start and nominal_scheduled_at=control_start
   from public.demo_world_steps where id=job.step_id),'first_unreported_partial_due_immediately');
  perform pg_temp.fast_assert((select count(*)=1 from public.demo_world_steps),'future_staggers_not_backfilled');
  raise exception using errcode='P2240',message='rollback immediate phase fixture';
 exception when sqlstate 'P2240' then null;end;
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '3 days',
   catalog_starts_at=null,last_dispatch_at=null where id=1;
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied('select public.demo_world_claim_batch(gen_random_uuid(),5)','DEMO_WORLD_GAP_REVIEW_REQUIRED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'two_day_gap_no_catchup_or_control_write');
  raise exception using errcode='P2240',message='rollback gap fixture';
 exception when sqlstate 'P2240' then null;end;
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
   catalog_starts_at=clock_timestamp()-interval '2 hours',last_dispatch_at=clock_timestamp() where id=1;
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied('select public.demo_world_claim_batch(gen_random_uuid(),5)','DEMO_CATALOG_ACTIVATION_REVIEW_REQUIRED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'activation_epoch_cannot_silently_rebase');
  raise exception using errcode='P2240',message='rollback activation fixture';
 exception when sqlstate 'P2240' then null;end;
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
   catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
  select id into capacity_id from public.capacities where vehicle_id=(select vehicle_id from public.demo_world_targets
   where target_key='independent-partial') order by updated_at desc,id desc limit 1;
  transition_value:='v1:c2:independent-partial-capacity-episode:independent-partial:e1:c0:p0';
  insert into public.demo_world_steps(target_key,phase_index,scheduled_at,nominal_scheduled_at,
   transition_id,idempotency_key,catalog_epoch,cycle_index,expected_capacity_id)
  values('independent-partial',0,clock_timestamp()-interval '3 days',clock_timestamp()-interval '3 days',
   transition_value,encode(sha256(convert_to('loadgistic-demo-world|'||transition_value,'UTF8')),'hex'),1,0,capacity_id);
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied('select public.demo_world_claim_batch(gen_random_uuid(),5)','DEMO_WORLD_BACKLOG_REVIEW_REQUIRED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'old_backlog_not_dropped_or_burst_replayed');
  raise exception using errcode='P2240',message='rollback backlog fixture';
 exception when sqlstate 'P2240' then null;end;
end $gates$;

do $single_target_ticks$
declare expected public.demo_world_targets%rowtype;batch jsonb;outcome jsonb;before_state jsonb;
 claimed_id bigint;claimed_token uuid;first_id bigint;first_token uuid;first_job jsonb;
 claimed_keys text[];control_start timestamptz;
begin
 -- A delayed activation makes all five targets due. Each call represents one
 -- worker tick, without pretending these rollback fixtures measure wall time.
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
   catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
  select activated_at into control_start from public.demo_world_control where id=1;
  claimed_keys:='{}';
  for expected in select * from public.demo_world_targets order by catalog_offset_seconds,target_key loop
   select jsonb_agg(to_jsonb(claimed)) into batch from public.demo_world_claim_batch(gen_random_uuid(),1) claimed;
   perform pg_temp.fast_assert(jsonb_array_length(batch)=1,'delayed_activation_one_claim_per_tick');
   claimed_id:=(batch->0->>'step_id')::bigint;claimed_token:=(batch->0->>'lease_token')::uuid;
   perform pg_temp.fast_assert((select target_key=expected.target_key
     and scheduled_at=control_start+expected.catalog_offset_seconds*interval '1 second'
     and state='LEASED' and attempts=1 from public.demo_world_steps where id=claimed_id),
    'delayed_activation_oldest_due_actor_first');
   perform pg_temp.fast_assert(not(expected.target_key=any(claimed_keys)),'delayed_activation_no_actor_repeated');
   claimed_keys:=array_append(claimed_keys,expected.target_key);
   outcome:=public.demo_world_execute_capacity_step(claimed_id,claimed_token);
   perform pg_temp.fast_assert(outcome->>'result'='APPLIED' and exists(select 1 from public.demo_world_receipts
     where step_id=claimed_id),'single_tick_completes_with_normal_receipt');
  end loop;
  perform pg_temp.fast_assert(cardinality(claimed_keys)=5
   and (select count(*)=5 and bool_and(state='DONE') from public.demo_world_steps)
   and (select count(*)=5 from public.demo_world_receipts),'all_five_overdue_actors_served_once');
  perform pg_temp.fast_assert(not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1)),
   'completion_wait_prevents_immediate_second_cycle');
  raise exception using errcode='P2240',message='rollback single-target delayed activation fixture';
 exception when sqlstate 'P2240' then null;end;

 -- A reported human baseline is a terminal denial, not permission to overwrite
 -- it. Pausing that exact leased target must leave the other due actors usable.
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
   catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
  perform pg_temp.fast_human_report('independent-partial',30);
  select jsonb_agg(to_jsonb(claimed)) into batch from public.demo_world_claim_batch(gen_random_uuid(),1) claimed;
  perform pg_temp.fast_assert(jsonb_array_length(batch)=1,'terminal_actor_single_claim');
  first_id:=(batch->0->>'step_id')::bigint;first_token:=(batch->0->>'lease_token')::uuid;
  perform pg_temp.fast_assert((select target_key='independent-partial' from public.demo_world_steps where id=first_id),
   'terminal_actor_is_oldest_due');
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',first_id,first_token),
   'DEMO_WORLD_BOOTSTRAP_REFUSED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'terminal_actor_execution_denial_unchanged');
  select to_jsonb(saved) into first_job from public.demo_world_steps saved where id=first_id;
  outcome:=public.demo_world_pause_step(first_id,first_token,'STATE_DRIFT');
  perform pg_temp.fast_assert(outcome->>'paused'='true'
   and pg_temp.fast_state()-'targets'=before_state-'targets'
   and (select scenario_paused_at is not null and scenario_pause_code='STATE_DRIFT'
     from public.demo_world_targets where target_key='independent-partial'),'terminal_actor_token_pause_only');
  claimed_keys:='{}';
  for expected in select * from public.demo_world_targets where target_key<>'independent-partial'
    order by catalog_offset_seconds,target_key loop
   select jsonb_agg(to_jsonb(claimed)) into batch from public.demo_world_claim_batch(gen_random_uuid(),1) claimed;
   perform pg_temp.fast_assert(jsonb_array_length(batch)=1,'paused_actor_other_tick_single_claim');
   claimed_id:=(batch->0->>'step_id')::bigint;claimed_token:=(batch->0->>'lease_token')::uuid;
   perform pg_temp.fast_assert((select target_key=expected.target_key from public.demo_world_steps where id=claimed_id),
    'paused_actor_does_not_starve_oldest_other_actor');
   claimed_keys:=array_append(claimed_keys,expected.target_key);
   outcome:=public.demo_world_execute_capacity_step(claimed_id,claimed_token);
   perform pg_temp.fast_assert(outcome->>'result'='APPLIED'
    and (select to_jsonb(saved)=first_job from public.demo_world_steps saved where id=first_id),
    'paused_actor_keeps_failed_job_while_other_actor_completes');
  end loop;
  perform pg_temp.fast_assert(cardinality(claimed_keys)=4
   and (select count(*)=4 from public.demo_world_receipts)
   and not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1)),
   'terminal_actor_does_not_starve_four_healthy_actors_or_reclaim');
  raise exception using errcode='P2240',message='rollback terminal single-target fairness fixture';
 exception when sqlstate 'P2240' then null;end;

 -- Model a lost transport response by leaving the first valid job leased. Its
 -- live two-minute lease cannot be stolen, but cannot block other due targets.
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
   catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
  select jsonb_agg(to_jsonb(claimed)) into batch from public.demo_world_claim_batch(gen_random_uuid(),1) claimed;
  perform pg_temp.fast_assert(jsonb_array_length(batch)=1,'transient_actor_single_claim');
  first_id:=(batch->0->>'step_id')::bigint;first_token:=(batch->0->>'lease_token')::uuid;
  select to_jsonb(saved) into first_job from public.demo_world_steps saved where id=first_id;
  perform pg_temp.fast_assert((select target_key='independent-partial' and state='LEASED' and attempts=1
    and lease_expires_at>clock_timestamp()
    and lease_expires_at=(select last_dispatch_at+interval '2 minutes' from public.demo_world_control where id=1)
    from public.demo_world_steps where id=first_id),'transient_actor_has_live_two_minute_lease');
  claimed_keys:='{}';
  for expected in select * from public.demo_world_targets where target_key<>'independent-partial'
    order by catalog_offset_seconds,target_key loop
   select jsonb_agg(to_jsonb(claimed)) into batch from public.demo_world_claim_batch(gen_random_uuid(),1) claimed;
   perform pg_temp.fast_assert(jsonb_array_length(batch)=1,'transient_actor_other_tick_single_claim');
   claimed_id:=(batch->0->>'step_id')::bigint;claimed_token:=(batch->0->>'lease_token')::uuid;
   perform pg_temp.fast_assert((select target_key=expected.target_key from public.demo_world_steps where id=claimed_id),
    'live_transient_lease_does_not_starve_oldest_other_actor');
   claimed_keys:=array_append(claimed_keys,expected.target_key);
   outcome:=public.demo_world_execute_capacity_step(claimed_id,claimed_token);
   perform pg_temp.fast_assert(outcome->>'result'='APPLIED'
    and (select to_jsonb(saved)=first_job from public.demo_world_steps saved where id=first_id)
    and (select scenario_paused_at is null from public.demo_world_targets where target_key='independent-partial'),
    'transient_lease_preserved_while_other_actor_completes');
  end loop;
  perform pg_temp.fast_assert(cardinality(claimed_keys)=4
   and not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1))
   and (select to_jsonb(saved)=first_job from public.demo_world_steps saved where id=first_id),
   'transient_actor_not_reclaimed_before_expiry');
  -- Counterfactual local expiry is rollback-only, not a production test clock.
  update public.demo_world_steps set lease_expires_at=clock_timestamp()-interval '1 second' where id=first_id;
  select jsonb_agg(to_jsonb(claimed)) into batch from public.demo_world_claim_batch(gen_random_uuid(),1) claimed;
  perform pg_temp.fast_assert(jsonb_array_length(batch)=1,'expired_transient_actor_single_reclaim');
  claimed_id:=(batch->0->>'step_id')::bigint;claimed_token:=(batch->0->>'lease_token')::uuid;
  perform pg_temp.fast_assert(claimed_id=first_id and claimed_token<>first_token
   and (select attempts=2 from public.demo_world_steps where id=first_id),'expired_transient_actor_rotates_token_on_same_job');
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',first_id,first_token),
   'DEMO_WORLD_LEASE_REFUSED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'old_transient_token_denial_unchanged');
  outcome:=public.demo_world_execute_capacity_step(claimed_id,claimed_token);
  perform pg_temp.fast_assert(outcome->>'result'='APPLIED'
   and (select count(*)=5 from public.demo_world_receipts)
   and (select count(*)=5 and bool_and(state='DONE') from public.demo_world_steps),
   'transient_actor_recovered_once_after_other_four');
  raise exception using errcode='P2240',message='rollback transient single-target fairness fixture';
 exception when sqlstate 'P2240' then null;end;
end $single_target_ticks$;

do $cases$
declare target public.demo_world_targets%rowtype;phase integer;cycle bigint;entry jsonb;job record;
 predecessor uuid;before_state jsonb;outcome jsonb;receipt public.demo_world_receipts%rowtype;saved public.capacities%rowtype;
 previous_complete timestamptz;expected_due timestamptz;expected_nominal timestamptz;before_count bigint;
 driver_id uuid;projection jsonb;actual_count integer:=0;
begin
 -- Each case is a separate rollback scope. Twenty normal simulator publishes
 -- exercise every target/phase shape; fixture clocks are not cadence evidence.
 for target in select * from public.demo_world_targets order by catalog_offset_seconds loop
  for phase in 0..3 loop
   begin
    cycle:=case when phase=0 then 1 else 0 end;
    update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
     where target_key<>target.target_key;
    update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
     catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
    predecessor:=pg_temp.fast_predecessor(target.target_key,cycle,phase);
    select completed_at into previous_complete from public.demo_world_steps where target_key=target.target_key and state='DONE';
    expected_due:=previous_complete+interval '120 seconds';
    select activated_at+(target.catalog_offset_seconds+cycle*480+phase*120)*interval '1 second'
     into expected_nominal from public.demo_world_control where id=1;
    select * into job from public.demo_world_claim_batch(gen_random_uuid(),5);
    perform pg_temp.fast_assert(job.step_id is not null,'next_phase_due');
    perform pg_temp.fast_assert((select phase_index=phase and cycle_index=cycle and expected_capacity_id=predecessor
      and scheduled_at=expected_due and nominal_scheduled_at=expected_nominal
      and scheduled_at>nominal_scheduled_at from public.demo_world_steps where id=job.step_id),'completion_based_due_preserves_nominal');
    before_state:=pg_temp.fast_state();
    perform pg_temp.fast_assert(not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),5)),
     'one_unfinished_and_no_active_lease_steal');
    -- Claiming updates aggregate dispatch health but cannot create a second job.
    perform pg_temp.fast_assert((select count(*)=1 from public.demo_world_steps where state<>'DONE'),'one_unfinished_target');
    select count(*) into before_count from public.capacities where vehicle_id=target.vehicle_id;
    before_state:=pg_temp.fast_state();
    outcome:=public.demo_world_execute_capacity_step(job.step_id,job.lease_token);
    perform pg_temp.fast_assert(outcome->>'result'='APPLIED','phase_applied');
    select * into receipt from public.demo_world_receipts where step_id=job.step_id;
    select * into saved from public.capacities where id=receipt.capacity_id;
    select driver_user_id into driver_id from public.driver_vehicle_assignments where vehicle_id=target.vehicle_id and active;
    entry:=public.demo_world_catalog_phase(target.target_key,cycle,phase);
    perform pg_temp.fast_assert(saved.status::text=entry->>'nextStatus'
     and saved.available_percent=(entry->>'nextAvailablePercent')::integer
     and public.demo_world_route_refs(saved.current_route_points_json)=entry->'nextRouteRefs'
     and public.capacity_sharing_mode(target.vehicle_id)=target.expected_sharing_mode,'saved_phase_shape');
    perform pg_temp.fast_assert(receipt.applied_at=saved.updated_at and receipt.completed_at>=receipt.applied_at
     and receipt.completed_at=(select completed_at from public.demo_world_steps where id=job.step_id)
     and receipt.due_at=expected_due and receipt.nominal_scheduled_at=expected_nominal
     and receipt.catalog_epoch=1 and receipt.cycle_index=cycle and receipt.phase_index=phase,'receipt_clock_and_identity');
    if saved.status='PARTIAL' then
     perform pg_temp.fast_assert(saved.available_percent_reported_at is not null
      and saved.available_percent_reported_by=receipt.actor_id
      and saved.available_percent_reported_driver_id=driver_id,'reported_percent_server_provenance');
    else
     perform pg_temp.fast_assert(saved.status='EMPTY' and saved.available_percent=100
      and saved.available_percent_reported_at is null,'empty_derived_100_no_fabricated_report');
    end if;
    if target.expected_sharing_mode='PRIVATE' then
     select value into projection from jsonb_array_elements(public.provider_capacity_workspace(receipt.actor_id)->'capacities')
      where value->>'id'=saved.id::text;
    else
     select payload into projection from public.public_capacity_page(jsonb_build_object('capacity_id',saved.id)) limit 1;
    end if;
    perform pg_temp.fast_assert((projection->>'available_percent')::integer=saved.available_percent
     and (saved.status='EMPTY' or projection->>'available_percent_reported_at' is not null),'ui_projection_matches_saved_percent');
    perform pg_temp.fast_assert((select count(*)=before_count+1 from public.capacities where vehicle_id=target.vehicle_id),
     'one_normal_capacity_write');
    perform pg_temp.fast_assert(pg_temp.fast_state()->'sources'=before_state->'sources'
     and pg_temp.fast_state()->'locations'=before_state->'locations'
     and pg_temp.fast_state()->'assignments'=before_state->'assignments','phase_never_manufactures_location_or_assignment');
    before_state:=pg_temp.fast_state();
    outcome:=public.demo_world_execute_capacity_step(job.step_id,job.lease_token);
    perform pg_temp.fast_assert(outcome->>'result'='REPLAYED' and pg_temp.fast_state()=before_state,'read_only_replay');
    perform pg_temp.fast_assert(not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),5)),
     'late_work_does_not_catch_up_burst');
    actual_count:=actual_count+1;
    raise exception using errcode='P2240',message='rollback completed phase fixture';
   exception when sqlstate 'P2240' then null;
   end;
  end loop;
 end loop;
 perform pg_temp.fast_assert(actual_count=20,'all_twenty_target_phase_cases');
 -- Route changes occur only on odd-cycle Empty phase3, every other cycle.
 for cycle in 0..5 loop
  for phase in 0..3 loop
   entry:=public.demo_world_catalog_phase('fleet-04-partial',cycle,phase);
   perform pg_temp.fast_assert((entry->'expectedRouteRefs' is distinct from entry->'nextRouteRefs')=
    (phase=3 and cycle%2=1),'route_changes_only_on_odd_empty_phase');
  end loop;
 end loop;
end $cases$;

do $routes$
declare cycle bigint;phase integer;job record;entry jsonb;saved public.capacities%rowtype;
begin
 -- Exercise both actual route transitions and the following Partial phase.
 -- The baseline/alternate place references must still use the normal command.
 for cycle in select unnest(array[1,2,3,4]::bigint[]) loop
  begin
   phase:=case when cycle%2=1 then 3 else 0 end;
   update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
    where target_key<>'fleet-04-partial';
   update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
    catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
   perform pg_temp.fast_predecessor('fleet-04-partial',cycle,phase);
   select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
   perform public.demo_world_execute_capacity_step(job.step_id,job.lease_token);
   select capacity.* into saved from public.demo_world_receipts receipt join public.capacities capacity on capacity.id=receipt.capacity_id
    where receipt.step_id=job.step_id;
   entry:=public.demo_world_catalog_phase('fleet-04-partial',cycle,phase);
   perform pg_temp.fast_assert(public.demo_world_route_refs(saved.current_route_points_json)=entry->'nextRouteRefs'
    and saved.status::text=entry->>'nextStatus','actual_odd_empty_route_change_or_following_preservation');
   perform pg_temp.fast_assert((phase=3 and saved.status='EMPTY' and saved.available_percent=100)
    or(phase=0 and saved.status='PARTIAL' and saved.available_percent=80 and saved.available_percent_reported_at is not null),
    'route_variant_keeps_capacity_episode');
   raise exception using errcode='P2240',message='rollback authored route fixture';
  exception when sqlstate 'P2240' then null;end;
 end loop;
end $routes$;

do $takeover$
declare percent integer;job record;new_job record;before_state jsonb;outcome jsonb;old_target jsonb;new_target jsonb;
begin
 for percent in select unnest(array[30,60,80]) loop
  begin
   update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
    where target_key<>'independent-partial';
   update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 second',
    catalog_starts_at=null,last_dispatch_at=null where id=1;
   -- The human report precedes the claim, so the captured current ID matches.
   -- Even 30 (a later authored preset) cannot be adopted as bootstrap consent.
   perform pg_temp.fast_human_report('independent-partial',percent);
   select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
   before_state:=pg_temp.fast_state();
   perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',job.step_id,job.lease_token),
    'DEMO_WORLD_BOOTSTRAP_REFUSED');
   perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'human_baseline_report_unchanged');
   outcome:=public.demo_world_pause_step(job.step_id,gen_random_uuid(),'HUMAN_TAKEOVER');
   perform pg_temp.fast_assert(outcome->>'paused'='false' and pg_temp.fast_state()=before_state,'wrong_pause_token_no_effect');
   update public.demo_world_steps set lease_expires_at=clock_timestamp()-interval '1 second' where id=job.step_id;
   before_state:=pg_temp.fast_state();
   outcome:=public.demo_world_pause_step(job.step_id,job.lease_token,'HUMAN_TAKEOVER');
   perform pg_temp.fast_assert(outcome->>'paused'='false' and pg_temp.fast_state()=before_state,'expired_pause_token_no_effect');
   select * into new_job from public.demo_world_claim_batch(gen_random_uuid(),1);
   perform pg_temp.fast_assert(new_job.step_id=job.step_id and new_job.lease_token<>job.lease_token,'pause_fixture_reclaims_new_token');
   before_state:=pg_temp.fast_state();
   outcome:=public.demo_world_pause_step(job.step_id,job.lease_token,'HUMAN_TAKEOVER');
   perform pg_temp.fast_assert(outcome->>'paused'='false' and pg_temp.fast_state()=before_state,'stale_pause_token_no_effect');
   perform pg_temp.fast_denied(format('select public.demo_world_pause_step(%s,%L,%L)',new_job.step_id,new_job.lease_token,'CALLER_REASON'),
    'DEMO_WORLD_INPUT_REFUSED');
   select to_jsonb(target) into old_target from public.demo_world_targets target where target_key='independent-partial';
   before_state:=pg_temp.fast_state();
   outcome:=public.demo_world_pause_step(new_job.step_id,new_job.lease_token,'HUMAN_TAKEOVER');
   select to_jsonb(target) into new_target from public.demo_world_targets target where target_key='independent-partial';
   perform pg_temp.fast_assert(outcome->>'paused'='true'
    and new_target->>'scenario_paused_at' is not null and new_target->>'scenario_pause_code'='HUMAN_TAKEOVER'
    and new_target-'scenario_paused_at'-'scenario_pause_code'=old_target-'scenario_paused_at'-'scenario_pause_code'
    and pg_temp.fast_state()-'targets'=before_state-'targets','terminal_pause_only_marks_exact_target');
   perform pg_temp.fast_assert((select state='LEASED' and lease_token=new_job.lease_token from public.demo_world_steps where id=new_job.step_id),
    'pause_retains_pending_lease_and_audit');
   perform pg_temp.fast_assert(not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),5)),
    'paused_target_not_reclaimed');
   raise exception using errcode='P2240',message='rollback human baseline fixture';
  exception when sqlstate 'P2240' then null;end;
 end loop;
 begin
  update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
   where target_key<>'independent-partial';
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 second',
   catalog_starts_at=null,last_dispatch_at=null where id=1;
  select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
  perform pg_temp.fast_human_report('independent-partial',null);
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',job.step_id,job.lease_token),
   'DEMO_WORLD_PREDECESSOR_CHANGED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'human_unreported_republish_after_first_claim_unchanged');
  raise exception using errcode='P2240',message='rollback first predecessor fixture';
 exception when sqlstate 'P2240' then null;end;
 begin
  update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
   where target_key<>'independent-partial';
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
   catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
  perform pg_temp.fast_predecessor('independent-partial',0,1);
  select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
  perform pg_temp.fast_human_report('independent-partial',80);
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',job.step_id,job.lease_token),
   'DEMO_WORLD_PREDECESSOR_CHANGED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'human_same_percent_new_current_id_unchanged');
  raise exception using errcode='P2240',message='rollback later predecessor fixture';
 exception when sqlstate 'P2240' then null;end;
 begin
  update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
   where target_key<>'independent-partial';
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 hour',
   catalog_starts_at=null,last_dispatch_at=clock_timestamp() where id=1;
  perform pg_temp.fast_predecessor('independent-partial',0,1);
  select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
  -- Malformed stored percent/provenance drift with the same Capacity ID is a
  -- different failure from an ordinary human save creating a new current ID.
  update public.capacities set available_percent=60 where id=(select expected_capacity_id from public.demo_world_steps where id=job.step_id);
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',job.step_id,job.lease_token),
   'DEMO_WORLD_PERCENT_STATE_CHANGED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'wrong_preset_with_same_capacity_id_unchanged');
  raise exception using errcode='P2240',message='rollback malformed percent fixture';
 exception when sqlstate 'P2240' then null;end;
end $takeover$;

do $authority$
declare cohort public.demo_world_targets%rowtype;job record;before_state jsonb;
 ordinary_owner uuid:=gen_random_uuid();owner_id uuid;driver_id uuid;gateway_id uuid;device_id uuid;
 session_id uuid:=gen_random_uuid();installation_id uuid:=gen_random_uuid();binding jsonb;
begin
 begin
  select * into strict cohort from public.demo_world_targets where target_key='fleet-01-partial';
  update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
   where target_key<>cohort.target_key;
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '31 seconds',
   catalog_starts_at=null,last_dispatch_at=null where id=1;
  select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
  perform pg_temp.fast_assert(job.step_id is not null,'co_owner_fixture_claim');
  -- An ordinary account becomes another current owner after the lease. No demo
  -- flags are forged: the existing approved owner remains, but is no longer sole.
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
  values(ordinary_owner,ordinary_owner||'@example.invalid',clock_timestamp(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);
  update public.profiles set role='TRANSPORTER',active=true where id=ordinary_owner;
  insert into public.organization_members(user_id,organization_id,membership_role)
   values(ordinary_owner,cohort.organization_id,'OWNER');
  perform pg_temp.fast_assert(not exists(select 1 from auth.users where id=ordinary_owner
    and raw_app_meta_data->>'fixture_source'='loadgistic'),'co_owner_has_no_operator_marker');
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',job.step_id,job.lease_token),
   'DEMO_WORLD_ACTOR_REFUSED');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'ordinary_co_owner_denial_preserves_raw_account_vehicle_and_signal_state');
  raise exception using errcode='P2240',message='rollback ordinary co-owner fixture';
 exception when sqlstate 'P2240' then null;end;
 begin
  select * into strict cohort from public.demo_world_targets where target_key='independent-partial';
  select provider.user_id into strict owner_id from public.provider_profiles provider where provider.id=cohort.provider_profile_id;
  select assignment.driver_user_id into strict driver_id from public.driver_vehicle_assignments assignment
   where assignment.vehicle_id=cohort.vehicle_id and assignment.active;
  update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
   where target_key<>cohort.target_key;
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 second',
   catalog_starts_at=null,last_dispatch_at=null where id=1;
  select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
  -- Reuse only the exact fictional002 device, or create that private rollback
  -- fixture if this fresh clone has not provisioned GPS yet. No gateway runs.
  select device.id into device_id from public.telematics_devices device join public.telematics_gateways gateway on gateway.id=device.gateway_id
   where device.imei='990000000000002' and device.synthetic and device.active and gateway.synthetic_only and gateway.active
    and device.provider_profile_id=cohort.provider_profile_id and device.organization_id is null
    and device.protocol='gt06' and device.protocol_device_id=device.imei and device.model_profile='SYNTHETIC_GT06';
  if device_id is null then
   if exists(select 1 from public.telematics_devices where imei='990000000000002')
    then raise exception 'FAST224_FICTIONAL_DEVICE_FIXTURE_DRIFT';end if;
   gateway_id:=gen_random_uuid();
   insert into public.telematics_gateways(id,label,token_digest,synthetic_only)
   values(gateway_id,'Rollback sticky REAL fixture',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),true);
   insert into public.telematics_devices(gateway_id,gateway_device_id,imei,protocol,protocol_device_id,
    provider_profile_id,label,model_profile,synthetic)
   values(gateway_id,9002,'990000000000002','gt06','990000000000002',cohort.provider_profile_id,
    'Rollback fictional phone target','SYNTHETIC_GT06',true) returning id into device_id;
  end if;
  insert into public.demo_motion_targets(vehicle_id,owner_user_id,driver_user_id,device_id,binding_digest,source)
  values(cohort.vehicle_id,owner_id,driver_id,device_id,repeat('a',64),'MOBILE') on conflict(vehicle_id) do nothing;
  perform public.pause_demo_motion(cohort.vehicle_id,'REAL_INSTALLATION');
  perform pg_temp.fast_assert(exists(select 1 from public.demo_motion_targets where vehicle_id=cohort.vehicle_id and state='REAL')
   and not public.real_location_device_in_use(cohort.vehicle_id),'sticky_real_without_live_installation');
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',job.step_id,job.lease_token),
   'DEMO_WORLD_REAL_DEVICE_TAKEOVER');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'sticky_real_denial_preserves_raw_account_vehicle_and_signal_state');
  raise exception using errcode='P2240',message='rollback sticky REAL fixture';
 exception when sqlstate 'P2240' then null;end;
 begin
  select * into strict cohort from public.demo_world_targets where target_key='independent-partial';
  select assignment.driver_user_id into strict driver_id from public.driver_vehicle_assignments assignment
   where assignment.vehicle_id=cohort.vehicle_id and assignment.active;
  -- This separate branch has no configured motion target. A real authenticated
  -- installation must still block Capacity simulation before its first fix.
  perform pg_temp.fast_assert(not exists(select 1 from public.demo_motion_targets where vehicle_id=cohort.vehicle_id),
   'live_phone_fixture_has_no_motion_record');
  update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
   where target_key<>cohort.target_key;
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 second',
   catalog_starts_at=null,last_dispatch_at=null where id=1;
  select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
  insert into auth.sessions(id,user_id,created_at,updated_at) values(session_id,driver_id,clock_timestamp(),clock_timestamp());
  binding:=public.register_phone_location_installation(driver_id,installation_id,
   encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),cohort.vehicle_id,false,session_id);
  perform pg_temp.fast_assert(public.phone_location_binding_is_current((binding->>'bindingId')::uuid)
   and public.real_location_device_in_use(cohort.vehicle_id)
   and not exists(select 1 from public.demo_motion_targets where vehicle_id=cohort.vehicle_id and state='REAL'),
   'live_phone_authority_independent_of_motion_record');
  before_state:=pg_temp.fast_state();
  perform pg_temp.fast_denied(format('select public.demo_world_execute_capacity_step(%s,%L)',job.step_id,job.lease_token),
   'DEMO_WORLD_REAL_DEVICE_TAKEOVER');
  perform pg_temp.fast_assert(pg_temp.fast_state()=before_state,'live_phone_denial_preserves_account_session_binding_source_and_signal_state');
  raise exception using errcode='P2240',message='rollback live phone authority fixture';
 exception when sqlstate 'P2240' then null;end;
end $authority$;

do $retry$
declare job record;before_state jsonb;after_state jsonb;
begin
 update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code='STATE_DRIFT'
  where target_key<>'independent-partial';
 update public.demo_world_control set enabled=true,activated_at=clock_timestamp()-interval '1 second',
  catalog_starts_at=null,last_dispatch_at=null where id=1;
 select * into job from public.demo_world_claim_batch(gen_random_uuid(),1);
 perform pg_temp.fast_assert(job.step_id is not null,'retry_fixture_first_claim');
 update public.demo_world_steps set attempts=12 where id=job.step_id;
 before_state:=pg_temp.fast_state();
 perform pg_temp.fast_assert(not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1)),
  'active_final_attempt_not_reclaimed');
 after_state:=pg_temp.fast_state();
 perform pg_temp.fast_assert(after_state-'control'=before_state-'control'
  and (select scenario_paused_at is null from public.demo_world_targets where target_key='independent-partial')
  and (select attempts=12 and state='LEASED' and lease_token=job.lease_token
    from public.demo_world_steps where id=job.step_id),'active_final_attempt_not_paused_or_rewritten');
 update public.demo_world_steps set lease_expires_at=clock_timestamp()-interval '1 second' where id=job.step_id;
 before_state:=pg_temp.fast_state();
 perform pg_temp.fast_assert(not exists(select 1 from public.demo_world_claim_batch(gen_random_uuid(),1)),
  'expired_exhausted_attempt_not_reclaimed');
 after_state:=pg_temp.fast_state();
 perform pg_temp.fast_assert((select scenario_paused_at is not null and scenario_pause_code='RETRY_EXHAUSTED'
    from public.demo_world_targets where target_key='independent-partial')
  and after_state-'control'-'targets'=before_state-'control'-'targets'
  and (select attempts=12 and state='LEASED' and lease_token=job.lease_token
    from public.demo_world_steps where id=job.step_id)
  and public.demo_world_status()->>'exhausted_count'='1','expired_final_attempt_pauses_without_erasing_job_or_data');
end $retry$;

rollback;
