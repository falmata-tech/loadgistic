-- FEAT-SIM-001. Catalog2: authored frequent Capacity episodes.
-- No activation, customer write, hidden clock override or historical job reset.
begin;
select pg_advisory_xact_lock(8030224);
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
 perform 1 from public.demo_world_control where id=1 for update;
 if not exists(select 1 from public.demo_world_control where id=1 and not enabled
    and activated_at is null and last_dispatch_at is null and manifest_version=1)
  or exists(select 1 from public.demo_world_steps)
  or exists(select 1 from public.demo_world_receipts)
  or (select count(*) from public.demo_world_targets)<>5
  or (select count(*) from public.demo_world_schedule)<>14
  then raise exception 'DEMO_CATALOG_UPGRADE_REVIEW_REQUIRED';end if;
 if md5(pg_get_functiondef('public.demo_world_claim_batch(uuid,integer)'::regprocedure))
    <>'dd5726c7a77a7273363fc20e9a39275e'
  or md5(pg_get_functiondef('public.demo_world_execute_capacity_step(bigint,uuid)'::regprocedure))
    <>'3f80d2961f08cf8dae2786e30e654e49'
  then raise exception 'DEMO_CATALOG_DEFINITION_DRIFT';end if;
end $preflight$;

alter table public.demo_world_control
 add column catalog_version integer not null default 2 check(catalog_version=2),
 add column catalog_epoch integer not null default 1 check(catalog_epoch>0),
 add column catalog_starts_at timestamptz;
alter table public.demo_world_targets
 add column catalog_offset_seconds integer,
 add column scenario_paused_at timestamptz,
 add column scenario_pause_code text check(scenario_pause_code in(
  'AUTHORITY_CHANGED','STATE_DRIFT','HUMAN_TAKEOVER','RETRY_EXHAUSTED')),
 add constraint demo_world_pause_pair224 check((scenario_paused_at is null)=(scenario_pause_code is null));
update public.demo_world_targets set catalog_offset_seconds=case target_key
 when 'independent-partial' then 0 when 'fleet-01-partial' then 30 when 'fleet-02-partial' then 60
 when 'fleet-04-partial' then 90 when 'fleet-06-partial' then 120 end;
alter table public.demo_world_targets alter column catalog_offset_seconds set not null;
alter table public.demo_world_targets add constraint demo_world_offset224 check(catalog_offset_seconds in(0,30,60,90,120));

-- This one-time metadata replacement is protected by the unactivated/no-work
-- preflight. An occupied old catalog needs explicit review; it is never deleted.
delete from public.demo_world_schedule;
alter table public.demo_world_schedule drop constraint demo_world_schedule_command_check,
 drop constraint demo_world_schedule_check;
alter table public.demo_world_schedule rename column minute_utc to phase_index;
alter table public.demo_world_steps rename column minute_utc to phase_index;
alter table public.demo_world_schedule
 add column catalog_version integer not null default 2 check(catalog_version=2),
 add column step_seconds integer not null default 120 check(step_seconds=120),
 add column cycle_seconds integer not null default 480 check(cycle_seconds=480),
 add column expected_available_percent integer not null check(expected_available_percent in(30,60,80,100)),
 add column next_available_percent integer not null check(next_available_percent in(30,60,80,100)),
 add constraint demo_world_phase224 check(phase_index between 0 and 3),
 add constraint demo_world_phase_command224 check(command='capacity.publish_phase'),
 add constraint demo_world_phase_shape224 check(
  expected_loads is null and next_loads is null and expected_route_refs is null and next_route_refs is null
  and ((phase_index=0 and expected_status='EMPTY' and next_status='PARTIAL' and expected_available_percent=100 and next_available_percent=80)
   or(phase_index=1 and expected_status='PARTIAL' and next_status='PARTIAL' and expected_available_percent=80 and next_available_percent=60)
   or(phase_index=2 and expected_status='PARTIAL' and next_status='PARTIAL' and expected_available_percent=60 and next_available_percent=30)
   or(phase_index=3 and expected_status='PARTIAL' and next_status='EMPTY' and expected_available_percent=30 and next_available_percent=100)));
insert into public.demo_world_schedule(target_key,scenario_key,phase_index,command,expected_status,next_status,
 expected_available_percent,next_available_percent)
select target.target_key,target.target_key||'-capacity-episode',phase.value,'capacity.publish_phase',
 case when phase.value=0 then 'EMPTY' else 'PARTIAL' end,
 case when phase.value=3 then 'EMPTY' else 'PARTIAL' end,
 (array[100,80,60,30])[phase.value+1],(array[80,60,30,100])[phase.value+1]
from public.demo_world_targets target cross join generate_series(0,3) phase(value);
alter table public.demo_world_steps
 add column catalog_epoch integer not null default 1 check(catalog_epoch>0),
 add column cycle_index bigint not null default 0 check(cycle_index>=0),
 add column expected_capacity_id uuid not null,
 add column nominal_scheduled_at timestamptz not null,
 add constraint demo_world_episode_step224 unique(target_key,catalog_epoch,cycle_index,phase_index);
create unique index demo_world_one_unfinished_target224 on public.demo_world_steps(target_key) where state<>'DONE';
alter table public.demo_world_receipts
 add column catalog_epoch integer not null default 1 check(catalog_epoch>0),
 add column cycle_index bigint not null default 0 check(cycle_index>=0),
 add column phase_index integer not null check(phase_index between 0 and 3),
 add column nominal_scheduled_at timestamptz not null,
 add column due_at timestamptz not null,
 add column completed_at timestamptz not null;

-- Private exact lookup. A region plan is not this simulator's local GPS course.
create function public.demo_world_catalog_phase(requested_target_key text,requested_cycle bigint,requested_phase integer)
returns jsonb language sql immutable set search_path=pg_catalog as $$
 with target as(select * from(values
  ('independent-partial','["builtin:sebeta","osm:node/6206220262"]'::jsonb,null::jsonb),
  ('fleet-01-partial','["osm:node/837433823","builtin:addis ababa"]'::jsonb,null::jsonb),
  ('fleet-02-partial','["osm:node/8486668765","builtin:adama"]'::jsonb,null::jsonb),
  ('fleet-04-partial','["osm:node/1150948679","builtin:mekelle"]'::jsonb,'["builtin:mekelle","builtin:wukro","builtin:adigrat"]'::jsonb),
  ('fleet-06-partial','["builtin:jigjiga","osm:node/6575426386"]'::jsonb,null::jsonb)
 ) fixed(target_key,baseline_route_refs,alternate_route_refs)), choice as(
 select target.*,
  case when requested_phase=3 then requested_cycle else requested_cycle-1 end as after_cycle
 from target where target_key=requested_target_key and requested_cycle>=0 and requested_phase between 0 and 3)
 select jsonb_build_object('catalogVersion',2,'scenarioKey',target_key||'-capacity-episode',
  'cycleIndex',requested_cycle,'stepIndex',requested_phase,'command','capacity.publish_phase',
  'expectedStatus',case when requested_cycle=0 and requested_phase=0 then 'PARTIAL'
   when requested_phase=0 then 'EMPTY' else 'PARTIAL' end,
  'nextStatus',case when requested_phase=3 then 'EMPTY' else 'PARTIAL' end,
  'expectedAvailablePercent',case when requested_cycle=0 and requested_phase=0 then null
   else (array[100,80,60,30])[requested_phase+1] end,
  'nextAvailablePercent',(array[80,60,30,100])[requested_phase+1],
  'allowUnreportedBootstrap',requested_cycle=0 and requested_phase=0,
  'expectedRouteRefs',case when alternate_route_refs is not null and requested_cycle>0
    and ((requested_cycle/2)%2)=1 then alternate_route_refs else baseline_route_refs end,
  'nextRouteRefs',case when alternate_route_refs is not null and after_cycle>=1
    and (((after_cycle+1)/2)%2)=1 then alternate_route_refs else baseline_route_refs end)
 from choice
$$;
revoke all on function public.demo_world_catalog_phase(text,bigint,integer) from public,anon,authenticated,service_role;

create or replace function public.demo_world_claim_batch(worker_id uuid,batch_size integer)
returns table(step_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare now_value timestamptz:=clock_timestamp();control public.demo_world_control%rowtype;
 target public.demo_world_targets%rowtype;unfinished public.demo_world_steps%rowtype;
 previous public.demo_world_steps%rowtype;next_phase integer;next_cycle bigint;
 due_time timestamptz;nominal_time timestamptz;transition_value text;expected_capacity uuid;
begin
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
  or batch_size is null or batch_size not between 1 and 10 then raise exception 'DEMO_WORLD_INPUT_REFUSED';end if;
 select * into control from public.demo_world_control where id=1 and enabled and manifest_version=1 and catalog_version=2 for update;
 if not found or control.activated_at is null then return;end if;
 now_value:=clock_timestamp();
 if control.catalog_starts_at is null then
  update public.demo_world_control set catalog_starts_at=control.activated_at where id=1;
  control.catalog_starts_at:=control.activated_at;
 elsif control.catalog_starts_at is distinct from control.activated_at then
  raise exception 'DEMO_CATALOG_ACTIVATION_REVIEW_REQUIRED';end if;
 if coalesce(control.last_dispatch_at,control.activated_at)<now_value-interval '2 days'
  then raise exception 'DEMO_WORLD_GAP_REVIEW_REQUIRED';end if;
 if exists(select 1 from public.demo_world_steps where state<>'DONE' and scheduled_at<now_value-interval '2 days')
  then raise exception 'DEMO_WORLD_BACKLOG_REVIEW_REQUIRED';end if;
 update public.demo_world_control set last_dispatch_at=now_value where id=1;
 for target in select * from public.demo_world_targets where scenario_paused_at is null
  order by catalog_offset_seconds,target_key for update skip locked loop
  select * into unfinished from public.demo_world_steps where target_key=target.target_key and state<>'DONE';
  if found then
   if unfinished.attempts>=12 and(unfinished.state<>'LEASED' or unfinished.lease_expires_at<=now_value) then
    -- Never pause an in-flight final attempt. Recheck under a nonblocking lock;
    -- an executor or token-bound pause may currently own this exact job row.
    perform 1 from public.demo_world_steps exhausted where exhausted.id=unfinished.id
     and exhausted.state<>'DONE' and exhausted.attempts>=12
     and(exhausted.state<>'LEASED' or exhausted.lease_expires_at<=now_value)
     for update skip locked;
    if found then
     update public.demo_world_targets set scenario_paused_at=now_value,scenario_pause_code='RETRY_EXHAUSTED' where target_key=target.target_key;
    end if;
   end if;
   continue;
  end if;
  select * into previous from public.demo_world_steps
   where target_key=target.target_key and state='DONE' and catalog_epoch=control.catalog_epoch
   order by cycle_index desc,phase_index desc limit 1;
  if found then
   if previous.completed_at is null or not exists(select 1 from public.demo_world_receipts receipt
      where receipt.step_id=previous.id and receipt.completed_at=previous.completed_at)
    then raise exception 'DEMO_WORLD_RECEIPT_DRIFT';end if;
   next_phase:=(previous.phase_index+1)%4;
   next_cycle:=previous.cycle_index+case when next_phase=0 then 1 else 0 end;
   due_time:=previous.completed_at+interval '120 seconds';
  else
   next_phase:=0;next_cycle:=0;
   due_time:=control.catalog_starts_at+target.catalog_offset_seconds*interval '1 second';
  end if;
  nominal_time:=control.catalog_starts_at+(target.catalog_offset_seconds+next_cycle*480+next_phase*120)*interval '1 second';
  if due_time>now_value then continue;end if;
  select id into expected_capacity from public.capacities where vehicle_id=target.vehicle_id
   order by updated_at desc,id desc limit 1;
  if expected_capacity is null then
   update public.demo_world_targets set scenario_paused_at=now_value,scenario_pause_code='STATE_DRIFT'
    where target_key=target.target_key;
   continue;end if;
  transition_value:='v1:c2:'||target.target_key||'-capacity-episode:'||target.target_key||
   ':e'||control.catalog_epoch||':c'||next_cycle||':p'||next_phase;
  insert into public.demo_world_steps(target_key,phase_index,scheduled_at,nominal_scheduled_at,
   transition_id,idempotency_key,catalog_epoch,cycle_index,expected_capacity_id)
  values(target.target_key,next_phase,due_time,nominal_time,transition_value,
   encode(sha256(convert_to('loadgistic-demo-world|'||transition_value,'UTF8')),'hex'),control.catalog_epoch,next_cycle,expected_capacity)
  on conflict(target_key,catalog_epoch,cycle_index,phase_index) do nothing;
 end loop;
 return query
 with due as(
  select candidate.id from public.demo_world_steps candidate
  join public.demo_world_targets cohort on cohort.target_key=candidate.target_key and cohort.scenario_paused_at is null
  where candidate.scheduled_at<=now_value and candidate.attempts<12 and candidate.catalog_epoch=control.catalog_epoch
   and(candidate.state='PENDING' or candidate.state='LEASED' and candidate.lease_expires_at<now_value)
  order by candidate.scheduled_at,candidate.id limit batch_size for update of candidate skip locked)
 update public.demo_world_steps selected set state='LEASED',lease_token=gen_random_uuid(),leased_by=worker_id,
  lease_expires_at=now_value+interval '2 minutes',attempts=selected.attempts+1
 from due where selected.id=due.id returning selected.id,selected.lease_token;
end $$;

create or replace function public.demo_world_execute_capacity_step(step_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare job public.demo_world_steps%rowtype;target public.demo_world_targets%rowtype;
 slot public.demo_world_schedule%rowtype;vehicle public.vehicles%rowtype;
 actor_id uuid;actor_count integer;driver_id uuid;driver_count integer;
 current_capacity public.capacities%rowtype;new_capacity public.capacities%rowtype;
 load_preference text;next_preference text;sharing_mode_value text;command jsonb;result_id uuid;
 current_route_refs jsonb;next_route_points jsonb;next_route_refs jsonb;
 phase_data jsonb;expected_status_value text;next_status_value text;
 previous_receipt public.demo_world_receipts%rowtype;previous_job public.demo_world_steps%rowtype;
 control public.demo_world_control%rowtype;completed_time timestamptz;
 now_value timestamptz:=clock_timestamp();
begin
 if step_id is null or lease_token is null then raise exception 'DEMO_WORLD_INPUT_REFUSED';end if;
 -- Claim and execution take the same control -> job lock order. Disabling the
 -- control waits for in-flight writes; a valid DONE replay remains read-only
 -- even when the pinned control row is disabled.
 select * into control from public.demo_world_control where id=1 for share;
 select * into job from public.demo_world_steps where id=step_id for update;
 if not found or job.lease_token is distinct from lease_token then raise exception 'DEMO_WORLD_LEASE_REFUSED';end if;
 if job.state='DONE' then
  if not exists(select 1 from public.demo_world_receipts receipt
   where receipt.step_id=job.id and receipt.idempotency_key=job.idempotency_key)
   then raise exception 'DEMO_WORLD_RECEIPT_DRIFT';end if;
  return jsonb_build_object('result','REPLAYED');
 end if;
 now_value:=clock_timestamp();
 if job.state<>'LEASED' or job.lease_expires_at<=now_value or job.scheduled_at>now_value
  or control.id is null or control.enabled is not true or control.manifest_version is distinct from 1
  then raise exception 'DEMO_WORLD_LEASE_REFUSED';end if;
 if exists(select 1 from public.demo_world_steps prior where prior.target_key=job.target_key
  and prior.scheduled_at<job.scheduled_at and prior.state<>'DONE') then raise exception 'DEMO_WORLD_ORDER_REFUSED';end if;
 select * into target from public.demo_world_targets where target_key=job.target_key;
 select * into slot from public.demo_world_schedule where target_key=job.target_key and phase_index=job.phase_index;
 if not found then raise exception 'DEMO_WORLD_TARGET_REFUSED';end if;
 phase_data:=public.demo_world_catalog_phase(job.target_key,job.cycle_index,job.phase_index);
 if phase_data is null or control.catalog_version<>2 or job.catalog_epoch<>control.catalog_epoch
  or target.scenario_paused_at is not null or slot.command<>'capacity.publish_phase'
  or slot.scenario_key is distinct from job.target_key||'-capacity-episode'
  or slot.catalog_version<>2 or slot.step_seconds<>120 or slot.cycle_seconds<>480
  or slot.expected_status is distinct from(case when job.phase_index=0 then 'EMPTY' else 'PARTIAL' end)
  or slot.next_status is distinct from(case when job.phase_index=3 then 'EMPTY' else 'PARTIAL' end)
  or slot.expected_available_percent is distinct from(array[100,80,60,30])[job.phase_index+1]
  or slot.next_available_percent is distinct from(array[80,60,30,100])[job.phase_index+1]
  or slot.expected_loads is not null or slot.next_loads is not null
  or slot.expected_route_refs is not null or slot.next_route_refs is not null
  or job.transition_id is distinct from('v1:c2:'||slot.scenario_key||':'||job.target_key||
   ':e'||job.catalog_epoch||':c'||job.cycle_index||':p'||job.phase_index)
  or job.idempotency_key is distinct from encode(sha256(convert_to('loadgistic-demo-world|'||job.transition_id,'UTF8')),'hex')
  then raise exception 'DEMO_WORLD_CATALOG_REFUSED';end if;
 expected_status_value:=phase_data->>'expectedStatus';next_status_value:=phase_data->>'nextStatus';
 -- Match telematics_lock_owner_scope's owner-before-vehicle order. The org
 -- lock blocks a new co-owner FK insert; membership locks block promotion or
 -- removal of an existing owner until this exact write completes.
 if target.organization_id is not null then
  perform 1 from public.organizations where id=target.organization_id and type='TRANSPORT_COMPANY' for update;
  if not found then raise exception 'DEMO_WORLD_TARGET_REFUSED';end if;
  perform 1 from public.organization_members where organization_id=target.organization_id order by id for share;
 end if;
 select * into vehicle from public.vehicles where id=target.vehicle_id for update;
 if not found or not vehicle.active or vehicle.publication_status<>'LIVE'
  or vehicle.organization_id is distinct from target.organization_id
  or vehicle.provider_profile_id is distinct from target.provider_profile_id
  then raise exception 'DEMO_WORLD_TARGET_REFUSED';end if;
 select count(*),(array_agg(u.id))[1] into actor_count,actor_id from auth.users u
 join public.profiles p on p.id=u.id and p.active and p.role::text=target.actor_role
 where u.deleted_at is null and u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key'=target.actor_fixture_key
  and(lower(u.email)=target.actor_email or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
 if actor_count<>1 then raise exception 'DEMO_WORLD_ACTOR_REFUSED';end if;
 if target.organization_id is not null and (
  (select count(*) from public.organization_members
   where organization_id=target.organization_id and membership_role='OWNER')<>1
  or not exists(select 1 from public.organization_members
   where organization_id=target.organization_id and user_id=actor_id and membership_role='OWNER'))
  or target.provider_profile_id is not null and not exists(select 1 from public.provider_profiles
   where id=target.provider_profile_id and user_id=actor_id)
  then raise exception 'DEMO_WORLD_ACTOR_REFUSED';end if;
 select count(*),(array_agg(a.driver_user_id))[1] into driver_count,driver_id from public.driver_vehicle_assignments a
 join auth.users u on u.id=a.driver_user_id and u.deleted_at is null
 join public.profiles p on p.id=u.id and p.active
 where a.vehicle_id=vehicle.id and a.active and u.raw_app_meta_data->>'fixture_source'='loadgistic'
  and u.raw_user_meta_data->>'fixture_key'=target.driver_fixture_key
  and(lower(u.email)=target.driver_email or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
 if driver_count<>1 or exists(select 1 from public.driver_vehicle_assignments
  where vehicle_id=vehicle.id and active and driver_user_id<>driver_id)
  then raise exception 'DEMO_WORLD_DRIVER_REFUSED';end if;
 select * into current_capacity from public.capacities where vehicle_id=vehicle.id
  order by updated_at desc,id desc limit 1 for update;
 if not found or current_capacity.status::text<>expected_status_value or
  current_capacity.visibility::text not in('OPEN','PRIVATE') or
  current_capacity.availability_geometry not in('ROUTE','RADIUS') or
  current_capacity.location_source not in('DEVICE_OBSCURED','TELEMATICS','MANUAL_ADMIN') or
  current_capacity.photo_storage_path is not null
  then raise exception 'DEMO_WORLD_STATE_CHANGED';end if;
 if current_capacity.id is distinct from job.expected_capacity_id
  then raise exception 'DEMO_WORLD_PREDECESSOR_CHANGED';end if;
 select * into previous_job from public.demo_world_steps previous
 where previous.target_key=job.target_key and previous.catalog_epoch=job.catalog_epoch
  and previous.state='DONE' and (previous.cycle_index*4+previous.phase_index)<(job.cycle_index*4+job.phase_index)
 order by previous.cycle_index desc,previous.phase_index desc limit 1;
 if found then
  select receipt.* into previous_receipt from public.demo_world_receipts receipt where receipt.step_id=previous_job.id;
  if not found or (previous_job.cycle_index*4+previous_job.phase_index)<>(job.cycle_index*4+job.phase_index)-1
   or previous_receipt.capacity_id is distinct from current_capacity.id
   or previous_receipt.completed_at is distinct from previous_job.completed_at
   then raise exception 'DEMO_WORLD_PREDECESSOR_CHANGED';end if;
 elsif job.cycle_index<>0 or job.phase_index<>0 or current_capacity.available_percent_reported_at is not null
  then raise exception 'DEMO_WORLD_BOOTSTRAP_REFUSED';end if;
 if not(job.cycle_index=0 and job.phase_index=0) then
  if expected_status_value='PARTIAL' and(current_capacity.available_percent_reported_at is null
    or current_capacity.available_percent is distinct from (phase_data->>'expectedAvailablePercent')::integer)
   or expected_status_value='EMPTY' and current_capacity.status<>'EMPTY'
   then raise exception 'DEMO_WORLD_PERCENT_STATE_CHANGED';end if;
 end if;
 if exists(select 1 from public.demo_motion_targets motion where motion.vehicle_id=vehicle.id and motion.state='REAL')
  or public.real_location_device_in_use(vehicle.id)
  then raise exception 'DEMO_WORLD_REAL_DEVICE_TAKEOVER';end if;
 if current_capacity.availability_geometry<>'ROUTE'
  or public.demo_world_route_refs(current_capacity.current_route_points_json) is distinct from phase_data->'expectedRouteRefs'
  then raise exception 'DEMO_WORLD_ROUTE_REFUSED';end if;
 sharing_mode_value:=public.capacity_sharing_mode(vehicle.id);
 if sharing_mode_value is distinct from target.expected_sharing_mode or
  current_capacity.visibility::text is distinct from
   (case when sharing_mode_value='PRIVATE' then 'PRIVATE' else 'OPEN' end)
  then raise exception 'DEMO_WORLD_SHARING_REFUSED';end if;
 if current_capacity.availability_geometry='ROUTE' and
  (jsonb_typeof(current_capacity.current_route_points_json)<>'array' or
   jsonb_array_length(current_capacity.current_route_points_json)<2)
  or current_capacity.availability_geometry='RADIUS' and
  (current_capacity.capacity_area_center_place_ref is null or
   jsonb_typeof(current_capacity.capacity_area_boundary_json)<>'array' or
   jsonb_array_length(current_capacity.capacity_area_boundary_json)<3)
  then raise exception 'DEMO_WORLD_GEOMETRY_REFUSED';end if;
 load_preference:=case when current_capacity.accepts_full_load and current_capacity.accepts_partial_load then 'BOTH'
  when current_capacity.accepts_full_load then 'FTL'
  when current_capacity.accepts_partial_load then 'PTL' end;
 if load_preference is null then raise exception 'DEMO_WORLD_LOAD_REFUSED';end if;
 next_preference:=load_preference;
 command:=jsonb_build_object('vehicle_id',vehicle.id,'status',next_status_value,
  'visibility',current_capacity.visibility::text,'sharing_mode',sharing_mode_value,
  'accepted_loads',next_preference,'availability_geometry',current_capacity.availability_geometry,
  'location_source','PRESERVE_DRIVER','accepts_multi_pick',coalesce(current_capacity.accepts_multi_pick,false),
  'accepts_multi_drop',coalesce(current_capacity.accepts_multi_drop,false));
 if next_status_value='PARTIAL' then
  command:=command||jsonb_build_object('available_percent',(phase_data->>'nextAvailablePercent')::integer);end if;
 select jsonb_agg(jsonb_build_object('place_ref',place.value) order by place.ordinality)
  into next_route_points from jsonb_array_elements_text(phase_data->'nextRouteRefs') with ordinality as place(value,ordinality);
 command:=command||jsonb_build_object('current_route_places',next_route_points);
 -- Owner/vehicle/source locks can wait; a lease that expired during that wait
 -- cannot authorize the normal publication command.
 if job.lease_expires_at<=clock_timestamp() then raise exception 'DEMO_WORLD_LEASE_REFUSED';end if;
 result_id:=public.publish_provider_capacity(actor_id,command);
 select * into new_capacity from public.capacities where id=result_id;
 next_route_refs:=public.demo_world_route_refs(new_capacity.current_route_points_json);
 if not found or new_capacity.status::text<>next_status_value
  or(next_status_value='PARTIAL' and(new_capacity.available_percent is distinct from (phase_data->>'nextAvailablePercent')::integer
   or new_capacity.available_percent_reported_at is null
   or new_capacity.available_percent_reported_by is distinct from actor_id
   or new_capacity.available_percent_reported_driver_id is distinct from driver_id
   or new_capacity.available_percent_reported_at<=coalesce(current_capacity.available_percent_reported_at,'-infinity'::timestamptz)))
  or(next_status_value='EMPTY' and new_capacity.available_percent_reported_at is not null)
  or new_capacity.updated_by<>actor_id or new_capacity.vehicle_id<>vehicle.id
  or new_capacity.visibility is distinct from current_capacity.visibility
  or new_capacity.location_source is distinct from current_capacity.location_source
  or new_capacity.accepts_multi_pick is distinct from current_capacity.accepts_multi_pick
  or new_capacity.accepts_multi_drop is distinct from current_capacity.accepts_multi_drop
  or public.capacity_sharing_mode(vehicle.id) is distinct from sharing_mode_value
  or (case when new_capacity.accepts_full_load and new_capacity.accepts_partial_load then 'BOTH'
       when new_capacity.accepts_full_load then 'FTL' when new_capacity.accepts_partial_load then 'PTL' end)
      is distinct from (case when next_status_value='PARTIAL' then 'PTL' else next_preference end)
  or next_route_refs is distinct from phase_data->'nextRouteRefs'
  then raise exception 'DEMO_WORLD_READBACK_DRIFT';end if;
 completed_time:=clock_timestamp();
 if new_capacity.updated_at>completed_time then raise exception 'DEMO_WORLD_READBACK_DRIFT';end if;
 insert into public.demo_world_receipts(step_id,transition_id,idempotency_key,actor_id,vehicle_id,
  previous_capacity_id,capacity_id,previous_status,next_status,catalog_epoch,cycle_index,phase_index,
  nominal_scheduled_at,due_at,applied_at,completed_at)
 values(job.id,job.transition_id,job.idempotency_key,actor_id,vehicle.id,
  current_capacity.id,result_id,expected_status_value,next_status_value,job.catalog_epoch,job.cycle_index,job.phase_index,
  job.nominal_scheduled_at,job.scheduled_at,new_capacity.updated_at,completed_time);
 update public.demo_world_steps set state='DONE',leased_by=null,lease_expires_at=null,
  completed_at=completed_time where id=job.id;
 return jsonb_build_object('result','APPLIED');
end $$;

create function public.demo_world_pause_step(step_id bigint,lease_token uuid,reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare job public.demo_world_steps%rowtype;
begin
 if step_id is null or lease_token is null or reason not in('AUTHORITY_CHANGED','STATE_DRIFT','HUMAN_TAKEOVER')
  or reason is null then raise exception 'DEMO_WORLD_INPUT_REFUSED';end if;
 select * into job from public.demo_world_steps where id=step_id for update;
 if not found or job.state<>'LEASED' or job.lease_token is distinct from lease_token
  or job.lease_expires_at<=clock_timestamp() then
  return jsonb_build_object('paused',false);end if;
 update public.demo_world_targets set scenario_paused_at=clock_timestamp(),scenario_pause_code=reason
  where target_key=job.target_key and scenario_paused_at is null;
 return jsonb_build_object('paused',true);
end $$;
revoke all on function public.demo_world_pause_step(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.demo_world_pause_step(bigint,uuid,text) to service_role;

create or replace function public.demo_world_status() returns jsonb
language sql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object('enabled',coalesce(control.enabled,false),'catalog_version',control.catalog_version,
  'paused_count',(select count(*) from public.demo_world_targets where scenario_paused_at is not null),
  'pending_count',(select count(*) from public.demo_world_steps where state<>'DONE' and scheduled_at<=clock_timestamp()),
  'oldest_due_age_seconds',(select coalesce(least(604800,greatest(0,extract(epoch from clock_timestamp()-min(scheduled_at))))::integer,0)
   from public.demo_world_steps where state<>'DONE' and scheduled_at<=clock_timestamp()),
  'exhausted_count',(select count(*) from public.demo_world_steps where state<>'DONE' and attempts>=12),
  'last_dispatch_at',control.last_dispatch_at)
 from public.demo_world_control control where id=1
$$;
-- Existing worker-only RPC grants remain; no role gains direct table access.
commit;
