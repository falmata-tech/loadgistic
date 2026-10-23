-- FEAT-SIM-001. Durable, exact-fixture Capacity simulation. Installation is inert.
-- A separately reviewed owner operation must enable the single control row.
begin;
select pg_advisory_xact_lock(8030185);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_world_control (
 id integer primary key check(id=1),
 enabled boolean not null default false,
 activated_at timestamptz,
 last_dispatch_at timestamptz,
 manifest_version integer not null check(manifest_version=1),
 changed_at timestamptz not null default clock_timestamp(),
 check(not enabled or activated_at is not null)
);
insert into public.demo_world_control(id,manifest_version) values(1,1);

create table public.demo_world_targets (
 target_key text primary key,
 vehicle_id uuid not null unique,
 vehicle_fixture_key text not null unique,
 actor_fixture_key text not null,
 actor_email text not null,
 actor_role text not null check(actor_role in('DRIVER','TRANSPORTER')),
 driver_fixture_key text not null,
 driver_email text not null,
 organization_id uuid,
 provider_profile_id uuid,
 baseline_status text not null check(baseline_status in('EMPTY','PARTIAL')),
 expected_sharing_mode text not null check(expected_sharing_mode in('PUBLIC','PRIVATE','BOTH')),
 check((organization_id is null)<>(provider_profile_id is null))
);
insert into public.demo_world_targets values
 ('independent-partial','2f22cc5a-d654-4405-98b7-9a1a9cf42fe3','veh-driver-1','user-driver','driver@loadgistic.local','DRIVER','user-driver','driver@loadgistic.local',null,'c640c548-ada2-4b9e-ac3c-235585525a6f','PARTIAL','PRIVATE'),
 ('fleet-01-partial','2020967a-92d3-4b1d-8f40-3c670dc97a50','veh-public-fleet-01-14','user-public-fleet-01','owner-01@providers.loadgistic.test','TRANSPORTER','user-public-fleet-driver-014','driver-014@providers.loadgistic.test','c36022ff-bf3e-432d-ae96-93d1537cf79e',null,'PARTIAL','PUBLIC'),
 ('fleet-02-partial','19838ed9-c898-43dd-a6d5-5d4c26d0e92d','veh-public-fleet-02-3','user-public-fleet-02','owner-02@providers.loadgistic.test','TRANSPORTER','user-public-fleet-driver-018','driver-018@providers.loadgistic.test','43db4203-8bec-4494-9ed2-0d9952c9e300',null,'PARTIAL','BOTH'),
 ('fleet-04-partial','0088dba7-04c7-425e-b5a9-64b721a753f0','veh-public-fleet-04-14','user-public-fleet-04','owner-04@providers.loadgistic.test','TRANSPORTER','user-public-fleet-driver-059','driver-059@providers.loadgistic.test','8efdd114-47be-4e3d-bf11-b6bc24d2c511',null,'PARTIAL','PUBLIC'),
 ('fleet-06-partial','0dc90cf6-7735-4ccc-b030-98a81c40ffd6','veh-public-fleet-06-5','user-public-fleet-06','owner-06@providers.loadgistic.test','TRANSPORTER','user-public-fleet-driver-080','driver-080@providers.loadgistic.test','22dd3b30-0bc5-4fdf-810b-3aee3081ac19',null,'PARTIAL','BOTH');

create table public.demo_world_schedule (
 target_key text not null references public.demo_world_targets(target_key),
 scenario_key text not null,
 minute_utc integer not null check(minute_utc between 0 and 1439),
 command text not null check(command in('capacity.set_status','capacity.set_load_preference','capacity.set_route')),
 expected_status text not null check(expected_status in('EMPTY','PARTIAL')),
 next_status text not null check(next_status in('EMPTY','PARTIAL')),
 expected_loads text check(expected_loads in('FTL','PTL','BOTH')),
 next_loads text check(next_loads in('FTL','PTL','BOTH')),
 expected_route_refs jsonb,
 next_route_refs jsonb,
 primary key(target_key,minute_utc),
 check((command='capacity.set_status' and expected_status<>next_status and expected_loads is null and
  next_loads is null and expected_route_refs is null and next_route_refs is null)
  or(command='capacity.set_load_preference' and expected_status='EMPTY' and next_status='EMPTY' and
   expected_loads is not null and next_loads is not null and expected_loads<>next_loads and
   expected_route_refs is null and next_route_refs is null)
  or(command='capacity.set_route' and expected_status='EMPTY' and next_status='EMPTY' and
   expected_loads is null and next_loads is null and
   jsonb_typeof(expected_route_refs)='array' and jsonb_typeof(next_route_refs)='array' and
   jsonb_array_length(expected_route_refs) between 2 and 5 and
   jsonb_array_length(next_route_refs) between 2 and 5 and
   expected_route_refs<>next_route_refs))
);
insert into public.demo_world_schedule values
 ('independent-partial','capacity-signal-cycle',480,'capacity.set_status','PARTIAL','EMPTY',null,null,null,null),
 ('independent-partial','capacity-signal-cycle',840,'capacity.set_status','EMPTY','PARTIAL',null,null,null,null),
 ('fleet-01-partial','fleet-01-signal-cycle',495,'capacity.set_status','PARTIAL','EMPTY',null,null,null,null),
 ('fleet-01-partial','fleet-01-load-preference',555,'capacity.set_load_preference','EMPTY','EMPTY','PTL','BOTH',null,null),
 ('fleet-01-partial','fleet-01-load-preference',840,'capacity.set_load_preference','EMPTY','EMPTY','BOTH','PTL',null,null),
 ('fleet-01-partial','fleet-01-signal-cycle',855,'capacity.set_status','EMPTY','PARTIAL',null,null,null,null),
 ('fleet-02-partial','fleet-02-signal-cycle',510,'capacity.set_status','PARTIAL','EMPTY',null,null,null,null),
 ('fleet-02-partial','fleet-02-signal-cycle',870,'capacity.set_status','EMPTY','PARTIAL',null,null,null,null),
 ('fleet-04-partial','fleet-04-signal-cycle',525,'capacity.set_status','PARTIAL','EMPTY',null,null,null,null),
 ('fleet-04-partial','fleet-04-route',600,'capacity.set_route','EMPTY','EMPTY',null,null,'["osm:node/1150948679","builtin:mekelle"]','["builtin:mekelle","builtin:wukro","builtin:adigrat"]'),
 ('fleet-04-partial','fleet-04-route',870,'capacity.set_route','EMPTY','EMPTY',null,null,'["builtin:mekelle","builtin:wukro","builtin:adigrat"]','["osm:node/1150948679","builtin:mekelle"]'),
 ('fleet-04-partial','fleet-04-signal-cycle',885,'capacity.set_status','EMPTY','PARTIAL',null,null,null,null),
 ('fleet-06-partial','fleet-06-signal-cycle',540,'capacity.set_status','PARTIAL','EMPTY',null,null,null,null),
 ('fleet-06-partial','fleet-06-signal-cycle',900,'capacity.set_status','EMPTY','PARTIAL',null,null,null,null);

create table public.demo_world_steps (
 id bigint generated always as identity primary key,
 target_key text not null references public.demo_world_targets(target_key),
 minute_utc integer not null,
 scheduled_at timestamptz not null,
 transition_id text not null unique,
 idempotency_key text not null unique check(idempotency_key ~ '^[a-f0-9]{64}$'),
 state text not null default 'PENDING' check(state in('PENDING','LEASED','DONE')),
 lease_token uuid,
 leased_by uuid,
 lease_expires_at timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 12),
 completed_at timestamptz,
 unique(target_key,scheduled_at),
 foreign key(target_key,minute_utc) references public.demo_world_schedule(target_key,minute_utc),
 check((state='LEASED' and lease_token is not null and leased_by is not null and lease_expires_at is not null)
    or(state<>'LEASED' and leased_by is null and lease_expires_at is null))
);
create index demo_world_steps_due_idx on public.demo_world_steps(state,scheduled_at,id);

create table public.demo_world_receipts (
 step_id bigint primary key references public.demo_world_steps(id),
 transition_id text not null unique,
 idempotency_key text not null unique,
 actor_id uuid not null references public.profiles(id),
 vehicle_id uuid not null references public.vehicles(id),
 previous_capacity_id uuid not null references public.capacities(id),
 capacity_id uuid not null references public.capacities(id),
 previous_status text not null,
 next_status text not null,
 applied_at timestamptz not null default clock_timestamp()
);
create function public.demo_world_refuse_receipt_change() returns trigger
language plpgsql set search_path=pg_catalog as $$begin raise exception 'DEMO_WORLD_RECEIPT_IMMUTABLE';end$$;
create trigger demo_world_receipt_immutable before update or delete on public.demo_world_receipts
 for each row execute function public.demo_world_refuse_receipt_change();

alter table public.demo_world_control enable row level security;
alter table public.demo_world_targets enable row level security;
alter table public.demo_world_schedule enable row level security;
alter table public.demo_world_steps enable row level security;
alter table public.demo_world_receipts enable row level security;
revoke all on public.demo_world_control,public.demo_world_targets,public.demo_world_schedule,
 public.demo_world_steps,public.demo_world_receipts from public,anon,authenticated,service_role;
revoke all on sequence public.demo_world_steps_id_seq from public,anon,authenticated,service_role;

-- Only server-side service_role can request bounded work. The database chooses
-- the targets, schedule, actor and command; the worker supplies no row selector.
create function public.demo_world_claim_batch(worker_id uuid,batch_size integer)
returns table(step_id bigint,lease_token uuid)
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare now_value timestamptz:=clock_timestamp();today date:=(clock_timestamp() at time zone 'UTC')::date;
 activation_time timestamptz;previous_dispatch timestamptz;
begin
 -- EXECUTE is granted only to service_role. PostgREST connects as
 -- authenticator and SET ROLEs service_role, so session_user is not a safe
 -- authorization signal inside this SECURITY DEFINER function.
 if worker_id is null or worker_id='00000000-0000-0000-0000-000000000000'::uuid
  or batch_size is null or batch_size not between 1 and 10 then raise exception 'DEMO_WORLD_INPUT_REFUSED';end if;
 select activated_at,last_dispatch_at into activation_time,previous_dispatch from public.demo_world_control
  where id=1 and enabled and manifest_version=1;
 if activation_time is null then return;end if;
 if coalesce(previous_dispatch,activation_time)<now_value-interval '2 days'
  then raise exception 'DEMO_WORLD_GAP_REVIEW_REQUIRED';end if;
 -- Two UTC dates cover a single delayed dispatch without an unbounded backlog.
 -- An older incomplete run is a stop condition, not permission to skip history.
 if exists(select 1 from public.demo_world_steps where state<>'DONE' and scheduled_at<now_value-interval '2 days')
  then raise exception 'DEMO_WORLD_BACKLOG_REVIEW_REQUIRED';end if;
 update public.demo_world_control set last_dispatch_at=now_value where id=1;
 insert into public.demo_world_steps(target_key,minute_utc,scheduled_at,transition_id,idempotency_key)
 select t.target_key,s.minute_utc,at_value,
  'v1:'||s.scenario_key||':'||t.target_key||':'||to_char(day_value,'YYYY-MM-DD')||':'||
   lpad((s.minute_utc/60)::text,2,'0')||lpad((s.minute_utc%60)::text,2,'0')||'Z',
  encode(sha256(convert_to('loadgistic-demo-world|v1:'||s.scenario_key||':'||t.target_key||':'||
   to_char(day_value,'YYYY-MM-DD')||':'||lpad((s.minute_utc/60)::text,2,'0')||
   lpad((s.minute_utc%60)::text,2,'0')||'Z','UTF8')),'hex')
 from generate_series((today-1)::timestamp,today::timestamp,interval '1 day') day_value
 cross join public.demo_world_schedule s join public.demo_world_targets t on t.target_key=s.target_key
 cross join lateral (select (day_value::timestamp at time zone 'UTC')+s.minute_utc*interval '1 minute' as at_value) due
 where at_value between activation_time and now_value
 on conflict do nothing;
 return query
 with due as (
  select candidate.id from public.demo_world_steps candidate
  where candidate.scheduled_at between activation_time and now_value and candidate.attempts<12
   and(candidate.state='PENDING' or candidate.state='LEASED' and candidate.lease_expires_at<now_value)
   and not exists(select 1 from public.demo_world_steps prior
    where prior.target_key=candidate.target_key and prior.scheduled_at<candidate.scheduled_at and prior.state<>'DONE')
  order by candidate.scheduled_at,candidate.id limit batch_size for update of candidate skip locked
 )
 update public.demo_world_steps selected set state='LEASED',lease_token=gen_random_uuid(),
  leased_by=worker_id,lease_expires_at=now_value+interval '2 minutes',attempts=selected.attempts+1
 from due where selected.id=due.id returning selected.id,selected.lease_token;
end $$;

create function public.demo_world_route_refs(points jsonb) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(point.value->>'place_ref' order by point.ordinality),'[]'::jsonb)
 from jsonb_array_elements(coalesce(points,'[]'::jsonb)) with ordinality as point(value,ordinality)
$$;

-- PostgreSQL commits the ordinary validated Capacity command and the receipt
-- together. A crash or exception leaves no half-written Capacity signal.
create function public.demo_world_execute_capacity_step(step_id bigint,lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare job public.demo_world_steps%rowtype;target public.demo_world_targets%rowtype;
 slot public.demo_world_schedule%rowtype;vehicle public.vehicles%rowtype;
 actor_id uuid;actor_count integer;driver_id uuid;driver_count integer;
 current_capacity public.capacities%rowtype;new_capacity public.capacities%rowtype;
 load_preference text;next_preference text;sharing_mode_value text;command jsonb;result_id uuid;
 current_route_refs jsonb;next_route_points jsonb;next_route_refs jsonb;
 now_value timestamptz:=clock_timestamp();
begin
 if step_id is null or lease_token is null then raise exception 'DEMO_WORLD_INPUT_REFUSED';end if;
 select * into job from public.demo_world_steps where id=step_id for update;
 if not found or job.lease_token is distinct from lease_token then raise exception 'DEMO_WORLD_LEASE_REFUSED';end if;
 if job.state='DONE' then
  if not exists(select 1 from public.demo_world_receipts receipt
   where receipt.step_id=job.id and receipt.idempotency_key=job.idempotency_key)
   then raise exception 'DEMO_WORLD_RECEIPT_DRIFT';end if;
  return jsonb_build_object('result','REPLAYED');
 end if;
 if job.state<>'LEASED' or job.lease_expires_at<=now_value or job.scheduled_at>now_value
  or not exists(select 1 from public.demo_world_control where id=1 and enabled and manifest_version=1)
  then raise exception 'DEMO_WORLD_LEASE_REFUSED';end if;
 if exists(select 1 from public.demo_world_steps prior where prior.target_key=job.target_key
  and prior.scheduled_at<job.scheduled_at and prior.state<>'DONE') then raise exception 'DEMO_WORLD_ORDER_REFUSED';end if;
 select * into target from public.demo_world_targets where target_key=job.target_key;
 select * into slot from public.demo_world_schedule where target_key=job.target_key and minute_utc=job.minute_utc;
 if not found then raise exception 'DEMO_WORLD_TARGET_REFUSED';end if;
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
 if target.organization_id is not null and not exists(select 1 from public.organization_members
  where organization_id=target.organization_id and user_id=actor_id and membership_role='OWNER')
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
 if not found or current_capacity.status::text<>slot.expected_status or
  current_capacity.visibility::text not in('OPEN','PRIVATE') or
  current_capacity.availability_geometry not in('ROUTE','RADIUS') or
  current_capacity.location_source not in('DEVICE_OBSCURED','TELEMATICS','MANUAL_ADMIN') or
  current_capacity.photo_storage_path is not null
  then raise exception 'DEMO_WORLD_STATE_CHANGED';end if;
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
 current_route_refs:=public.demo_world_route_refs(current_capacity.current_route_points_json);
 if slot.command='capacity.set_load_preference' and
  (load_preference is distinct from slot.expected_loads or current_capacity.status::text<>'EMPTY')
  then raise exception 'DEMO_WORLD_LOAD_REFUSED';end if;
 if slot.command='capacity.set_route' and
  (current_capacity.availability_geometry<>'ROUTE' or current_route_refs is distinct from slot.expected_route_refs)
  then raise exception 'DEMO_WORLD_ROUTE_REFUSED';end if;
 next_preference:=case when slot.command='capacity.set_load_preference' then slot.next_loads else load_preference end;
 command:=jsonb_build_object('vehicle_id',vehicle.id,'status',slot.next_status,
  'visibility',current_capacity.visibility::text,'sharing_mode',sharing_mode_value,
  'accepted_loads',next_preference,'availability_geometry',current_capacity.availability_geometry,
  'location_source','PRESERVE_DRIVER','accepts_multi_pick',coalesce(current_capacity.accepts_multi_pick,false),
  'accepts_multi_drop',coalesce(current_capacity.accepts_multi_drop,false));
 if current_capacity.availability_geometry='ROUTE' then
  if slot.command='capacity.set_route' then
   select jsonb_agg(jsonb_build_object('place_ref',place.value) order by place.ordinality)
    into next_route_points from jsonb_array_elements_text(slot.next_route_refs)
     with ordinality as place(value,ordinality);
  else next_route_points:=current_capacity.current_route_points_json;end if;
  command:=command||jsonb_build_object('current_route_places',next_route_points);
 else
  command:=command||jsonb_build_object('capacity_area_center_place_ref',current_capacity.capacity_area_center_place_ref,
   'capacity_area_boundary_places',current_capacity.capacity_area_boundary_json);
 end if;
 result_id:=public.publish_provider_capacity(actor_id,command);
 select * into new_capacity from public.capacities where id=result_id;
 next_route_refs:=public.demo_world_route_refs(new_capacity.current_route_points_json);
 if not found or new_capacity.status::text<>slot.next_status
  or new_capacity.updated_by<>actor_id or new_capacity.vehicle_id<>vehicle.id
  or new_capacity.visibility is distinct from current_capacity.visibility
  or new_capacity.location_source is distinct from current_capacity.location_source
  or new_capacity.accepts_multi_pick is distinct from current_capacity.accepts_multi_pick
  or new_capacity.accepts_multi_drop is distinct from current_capacity.accepts_multi_drop
  or public.capacity_sharing_mode(vehicle.id) is distinct from sharing_mode_value
  or (case when new_capacity.accepts_full_load and new_capacity.accepts_partial_load then 'BOTH'
       when new_capacity.accepts_full_load then 'FTL' when new_capacity.accepts_partial_load then 'PTL' end)
      is distinct from (case when slot.next_status='PARTIAL' then 'PTL' else next_preference end)
  or (current_capacity.availability_geometry='ROUTE' and next_route_refs is distinct from
      (case when slot.command='capacity.set_route' then slot.next_route_refs else current_route_refs end))
  then raise exception 'DEMO_WORLD_READBACK_DRIFT';end if;
 insert into public.demo_world_receipts(step_id,transition_id,idempotency_key,actor_id,vehicle_id,
  previous_capacity_id,capacity_id,previous_status,next_status)
 values(job.id,job.transition_id,job.idempotency_key,actor_id,vehicle.id,
  current_capacity.id,result_id,slot.expected_status,slot.next_status);
 update public.demo_world_steps set state='DONE',leased_by=null,lease_expires_at=null,
  completed_at=clock_timestamp() where id=job.id;
 return jsonb_build_object('result','APPLIED');
end $$;

-- Only aggregate health leaves the database. No actor, vehicle, contact or
-- lease token appears in worker metrics.
create function public.demo_world_status() returns jsonb
language sql volatile security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object(
  'enabled',coalesce(control.enabled,false),
  'pending_count',(select count(*) from public.demo_world_steps step
   where step.state<>'DONE' and step.scheduled_at<=clock_timestamp()),
  'oldest_due_age_seconds',(select coalesce(least(604800,greatest(0,
   extract(epoch from clock_timestamp()-min(step.scheduled_at))))::integer,0)
   from public.demo_world_steps step where step.state<>'DONE' and step.scheduled_at<=clock_timestamp()),
  'exhausted_count',(select count(*) from public.demo_world_steps step
   where step.state<>'DONE' and step.attempts>=12),
  'last_dispatch_at',control.last_dispatch_at)
 from public.demo_world_control control where control.id=1
$$;

revoke all on function public.demo_world_claim_batch(uuid,integer),
 public.demo_world_execute_capacity_step(bigint,uuid),public.demo_world_refuse_receipt_change(),
 public.demo_world_route_refs(jsonb),public.demo_world_status()
 from public,anon,authenticated,service_role;
grant execute on function public.demo_world_claim_batch(uuid,integer),
 public.demo_world_execute_capacity_step(bigint,uuid),public.demo_world_status() to service_role;
notify pgrst,'reload schema';
commit;
