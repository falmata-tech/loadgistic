-- FEAT-SIM-001. Inert, exact-fixture handover; no scheduler invokes this function.
-- The two ordinary Fleet/Capacity commands compose inside one database transaction.
begin;
select pg_advisory_xact_lock(8030187);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.demo_world_handover_receipts (
  simulation_day date primary key,
  owner_user_id uuid not null references public.profiles(id),
  vehicle_a_id uuid not null references public.vehicles(id),
  vehicle_b_id uuid not null references public.vehicles(id),
  previous_driver_a_id uuid not null references public.profiles(id),
  previous_driver_b_id uuid not null references public.profiles(id),
  previous_capacity_a_id uuid not null references public.capacities(id),
  previous_capacity_b_id uuid not null references public.capacities(id),
  published_capacity_a_id uuid not null references public.capacities(id),
  published_capacity_b_id uuid not null references public.capacities(id),
  applied_at timestamptz not null default clock_timestamp(),
  check(vehicle_a_id<>vehicle_b_id and previous_driver_a_id<>previous_driver_b_id)
);
create trigger demo_world_handover_receipt_immutable
before update or delete on public.demo_world_handover_receipts
for each row execute function public.demo_world_refuse_receipt_change();
alter table public.demo_world_handover_receipts enable row level security;
revoke all on public.demo_world_handover_receipts from public,anon,authenticated,service_role;

create or replace function public.demo_world_execute_atomic_handover()
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare
  today_utc date:=(clock_timestamp() at time zone 'UTC')::date;
  owner_id uuid;driver_1 uuid;driver_4 uuid;actor_count integer;
  vehicle_a uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  fleet_id uuid:='c36022ff-bf3e-432d-ae96-93d1537cf79e';
  prior_a public.capacities%rowtype;
  prior_b public.capacities%rowtype;
  driver_a uuid;driver_b uuid;
  permission_a public.driver_permissions%rowtype;
  permission_b public.driver_permissions%rowtype;
  selected public.telematics_location_sources%rowtype;
  place_a text;place_b text;coordinate record;
  saved_a uuid;saved_b uuid;published public.capacities%rowtype;
  receipt public.demo_world_handover_receipts%rowtype;
  target_vehicle uuid;old_capacity public.capacities%rowtype;source_result jsonb;
  command jsonb;published_id uuid;target_index integer;
begin
  -- Transaction-level locking also serializes Capacity dispatcher and another handover.
  perform pg_advisory_xact_lock(8030187);
  select count(*),min(u.id::text)::uuid into actor_count,owner_id from auth.users u
    join public.profiles p on p.id=u.id
    where u.deleted_at is null and p.active and p.role='TRANSPORTER'
      and u.raw_app_meta_data->>'fixture_source'='loadgistic'
      and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01'
      and (lower(u.email)='owner-01@providers.loadgistic.test'
        or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
  if actor_count<>1 then raise exception 'DEMO_HANDOVER_OWNER_REFUSED';end if;
  select count(*),min(u.id::text)::uuid into actor_count,driver_1 from auth.users u
    join public.profiles p on p.id=u.id
    join public.drivers d on d.user_id=u.id and d.active and d.organization_id=fleet_id
      and d.provider_profile_id is null
    where u.deleted_at is null and p.active and p.role='DRIVER'
      and u.raw_app_meta_data->>'fixture_source'='loadgistic'
      and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-driver-001'
      and (lower(u.email)='driver-001@providers.loadgistic.test'
        or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
  if actor_count<>1 then raise exception 'DEMO_HANDOVER_DRIVER_REFUSED';end if;
  select count(*),min(u.id::text)::uuid into actor_count,driver_4 from auth.users u
    join public.profiles p on p.id=u.id
    join public.drivers d on d.user_id=u.id and d.active and d.organization_id=fleet_id
      and d.provider_profile_id is null
    where u.deleted_at is null and p.active and p.role='DRIVER'
      and u.raw_app_meta_data->>'fixture_source'='loadgistic'
      and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-driver-004'
      and (lower(u.email)='driver-004@providers.loadgistic.test'
        or lower(u.email)~'^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$');
  if actor_count<>1 then raise exception 'DEMO_HANDOVER_DRIVER_REFUSED';end if;
  select * into receipt from public.demo_world_handover_receipts where simulation_day=today_utc;
  if found then
    if receipt.owner_user_id<>owner_id or receipt.vehicle_a_id<>vehicle_a or receipt.vehicle_b_id<>vehicle_b
      or not exists(select 1 from public.capacities where id=receipt.published_capacity_a_id
        and vehicle_id=vehicle_a and status='EMPTY' and location_source='MANUAL_ADMIN')
      or not exists(select 1 from public.capacities where id=receipt.published_capacity_b_id
        and vehicle_id=vehicle_b and status='EMPTY' and location_source='MANUAL_ADMIN')
      or not exists(select 1 from public.driver_vehicle_assignments where active
        and vehicle_id=vehicle_a and driver_user_id=receipt.previous_driver_b_id)
      or not exists(select 1 from public.driver_vehicle_assignments where active
        and vehicle_id=vehicle_b and driver_user_id=receipt.previous_driver_a_id)
      then raise exception 'DEMO_HANDOVER_RECEIPT_DRIFT';end if;
    return jsonb_build_object('simulationDay',today_utc,'replayed',true,'vehicleCount',2);
  end if;
  if not exists(select 1 from public.demo_world_control where id=1 and enabled and manifest_version=1)
    then raise exception 'DEMO_HANDOVER_DISABLED';end if;
  if exists(select 1 from public.demo_world_handover_receipts where simulation_day>today_utc-14)
    then raise exception 'DEMO_HANDOVER_TOO_SOON';end if;
  perform 1 from public.fleet_lock_provider_owner(owner_id);
  perform 1 from public.vehicles where id in(vehicle_a,vehicle_b) order by id for update;
  if (select count(*) from public.vehicles where id in(vehicle_a,vehicle_b) and active
      and publication_status='LIVE' and organization_id=fleet_id and provider_profile_id is null)<>2
    then raise exception 'DEMO_HANDOVER_VEHICLE_REFUSED';end if;
  select a.driver_user_id into driver_a from public.driver_vehicle_assignments a
    where a.vehicle_id=vehicle_a and a.active;
  select a.driver_user_id into driver_b from public.driver_vehicle_assignments a
    where a.vehicle_id=vehicle_b and a.active;
  if driver_a is null or driver_b is null or driver_a=driver_b
    or not(driver_a in(driver_1,driver_4) and driver_b in(driver_1,driver_4))
    or (select count(*) from public.driver_vehicle_assignments
        where active and (driver_user_id in(driver_1,driver_4) or vehicle_id in(vehicle_a,vehicle_b)))<>2
    then raise exception 'DEMO_HANDOVER_ASSIGNMENT_REFUSED';end if;
  select * into permission_a from public.driver_permissions where user_id=driver_a;
  select * into permission_b from public.driver_permissions where user_id=driver_b;
  if permission_a.user_id is null or permission_b.user_id is null
    or not permission_a.can_manage_capacity or not permission_b.can_manage_capacity
    then raise exception 'DEMO_HANDOVER_PERMISSION_REFUSED';end if;
  if exists(select 1 from public.provider_shipments s
    where s.operational_status not in('COMPLETED','CANCELLED')
      and (s.assigned_vehicle_id in(vehicle_a,vehicle_b) or s.assigned_driver_user_id in(driver_1,driver_4)))
    then raise exception 'DEMO_HANDOVER_ACTIVE_TRACKING';end if;
  if exists(select 1 from public.featured_provider_slots slot
      join public.featured_provider_days day on day.id=slot.day_id
      where day.feature_date>=today_utc
        and (slot.vehicle_id in(vehicle_a,vehicle_b) or slot.driver_user_id in(driver_1,driver_4)))
    then raise exception 'DEMO_HANDOVER_SAVED_FEATURED';end if;
  if exists(select 1 from public.telematics_device_assignments where vehicle_id in(vehicle_a,vehicle_b) and ended_at is null)
    or exists(select 1 from public.phone_location_bindings where vehicle_id in(vehicle_a,vehicle_b) and revoked_at is null)
    or exists(select 1 from public.demo_motion_targets where vehicle_id in(vehicle_a,vehicle_b))
    or public.real_location_device_in_use(vehicle_a) or public.real_location_device_in_use(vehicle_b)
    then raise exception 'DEMO_HANDOVER_DEVICE_REFUSED';end if;
  if exists(select 1 from public.telematics_location_sources s where s.vehicle_id in(vehicle_a,vehicle_b)
      and (s.source<>'MANUAL' or s.selected_by<>owner_id))
    then raise exception 'DEMO_HANDOVER_SOURCE_REFUSED';end if;
  if (select count(*) from public.vehicle_capacity_sharing s where s.vehicle_id in(vehicle_a,vehicle_b)
      and s.mode='PUBLIC' and s.exclusive_email is null and s.exclusive_digest is null)<>2
    then raise exception 'DEMO_HANDOVER_SHARING_REFUSED';end if;
  select * into prior_a from public.capacities where vehicle_id=vehicle_a order by updated_at desc,id desc limit 1;
  select * into prior_b from public.capacities where vehicle_id=vehicle_b order by updated_at desc,id desc limit 1;
  if prior_a.id is null or prior_b.id is null
    or prior_a.status<>'EMPTY' or prior_a.availability_geometry<>'RADIUS'
    or prior_b.status<>'EMPTY' or prior_b.availability_geometry<>'ROUTE'
    or prior_a.visibility<>'OPEN' or prior_b.visibility<>'OPEN'
    or prior_a.photo_storage_path is not null or prior_b.photo_storage_path is not null
    or prior_a.capacity_area_center_place_ref is null
    or (case when jsonb_typeof(prior_a.capacity_area_boundary_json)='array'
      then jsonb_array_length(prior_a.capacity_area_boundary_json) else 0 end)<3
    or (case when jsonb_typeof(prior_b.current_route_points_json)='array'
      then jsonb_array_length(prior_b.current_route_points_json) else 0 end)<2
    or prior_a.location_source is null or prior_a.location_source not in('DEVICE_OBSCURED','MANUAL_ADMIN')
    or prior_b.location_source is null or prior_b.location_source not in('DEVICE_OBSCURED','MANUAL_ADMIN')
    then raise exception 'DEMO_HANDOVER_CAPACITY_REFUSED';end if;
  place_a:=prior_a.capacity_area_center_place_ref;
  place_b:=prior_b.current_route_points_json->0->>'place_ref';
  if place_b is null then raise exception 'DEMO_HANDOVER_PLACE_REFUSED';end if;

  -- Every command below participates in this function's single transaction.
  perform public.publish_provider_capacity(owner_id,jsonb_build_object(
    'vehicle_id',vehicle_a,'status','OFF_DUTY','visibility','OPEN','sharing_mode','PUBLIC'));
  perform public.publish_provider_capacity(owner_id,jsonb_build_object(
    'vehicle_id',vehicle_b,'status','OFF_DUTY','visibility','OPEN','sharing_mode','PUBLIC'));
  perform public.update_fleet_driver_access(owner_id,jsonb_build_object(
    'driver_user_id',driver_b,'vehicle_id',vehicle_a,
    'can_manage_capacity',permission_b.can_manage_capacity,'can_manage_tracking',permission_b.can_manage_tracking));
  perform public.update_fleet_driver_access(owner_id,jsonb_build_object(
    'driver_user_id',driver_a,'vehicle_id',vehicle_b,
    'can_manage_capacity',permission_a.can_manage_capacity,'can_manage_tracking',permission_a.can_manage_tracking));

  for target_index in 1..2 loop
    target_vehicle:=case when target_index=1 then vehicle_a else vehicle_b end;
    old_capacity:=case when target_index=1 then prior_a else prior_b end;
    select * into selected from public.telematics_location_sources where vehicle_id=target_vehicle;
    select latitude,longitude into coordinate from public.place_catalog
      where id=case when target_vehicle=vehicle_a then place_a else place_b end;
    if coordinate.latitude is null or coordinate.longitude is null
      then raise exception 'DEMO_HANDOVER_PLACE_REFUSED';end if;
    source_result:=public.select_telematics_location_source(owner_id,jsonb_build_object(
      'vehicleId',target_vehicle,'source','MANUAL','precisionKm',10,
      'expectedRevision',coalesce(selected.revision,'1970-01-01'::timestamptz),
      'manualLatitude',coordinate.latitude,'manualLongitude',coordinate.longitude));
    if source_result->>'source'<>'MANUAL' then raise exception 'DEMO_HANDOVER_SOURCE_DRIFT';end if;
    command:=jsonb_build_object('vehicle_id',target_vehicle,'status',old_capacity.status,
      'visibility',old_capacity.visibility,'sharing_mode','PUBLIC','accepted_loads',
      case when old_capacity.accepts_full_load and old_capacity.accepts_partial_load then 'BOTH'
           when old_capacity.accepts_full_load then 'FTL' else 'PTL' end,
      'availability_geometry',old_capacity.availability_geometry,'location_source','PRESERVE_DRIVER',
      'accepts_multi_pick',old_capacity.accepts_multi_pick,
      'accepts_multi_drop',old_capacity.accepts_multi_drop);
    if old_capacity.availability_geometry='ROUTE' then
      command:=command||jsonb_build_object('current_route_places',old_capacity.current_route_points_json);
    else
      command:=command||jsonb_build_object('capacity_area_center_place_ref',old_capacity.capacity_area_center_place_ref,
        'capacity_area_boundary_places',old_capacity.capacity_area_boundary_json);
    end if;
    published_id:=public.publish_provider_capacity(owner_id,command);
    select * into published from public.capacities where id=published_id;
    if published.vehicle_id<>target_vehicle or published.status<>old_capacity.status
      or published.visibility<>old_capacity.visibility or published.location_source<>'MANUAL_ADMIN'
      or published.availability_geometry<>old_capacity.availability_geometry
      or published.accepts_full_load is distinct from old_capacity.accepts_full_load
      or published.accepts_partial_load is distinct from old_capacity.accepts_partial_load
      or published.accepts_multi_pick is distinct from old_capacity.accepts_multi_pick
      or published.accepts_multi_drop is distinct from old_capacity.accepts_multi_drop
      or public.demo_world_route_refs(published.current_route_points_json)
         is distinct from public.demo_world_route_refs(old_capacity.current_route_points_json)
      or (select mode from public.vehicle_capacity_sharing where vehicle_id=target_vehicle)<>'PUBLIC'
      then raise exception 'DEMO_HANDOVER_PUBLISH_DRIFT';end if;
    if target_vehicle=vehicle_a then saved_a:=published_id;else saved_b:=published_id;end if;
  end loop;
  if (select count(*) from public.driver_vehicle_assignments a where a.active and
      ((a.vehicle_id=vehicle_a and a.driver_user_id=driver_b)
        or (a.vehicle_id=vehicle_b and a.driver_user_id=driver_a)))<>2
    then raise exception 'DEMO_HANDOVER_FINAL_ASSIGNMENT_DRIFT';end if;
  insert into public.demo_world_handover_receipts(simulation_day,owner_user_id,vehicle_a_id,vehicle_b_id,
    previous_driver_a_id,previous_driver_b_id,previous_capacity_a_id,previous_capacity_b_id,
    published_capacity_a_id,published_capacity_b_id)
  values(today_utc,owner_id,vehicle_a,vehicle_b,driver_a,driver_b,prior_a.id,prior_b.id,saved_a,saved_b);
  return jsonb_build_object('simulationDay',today_utc,'replayed',false,'vehicleCount',2);
end $$;
revoke all on function public.demo_world_execute_atomic_handover() from public,anon,authenticated,service_role;
comment on function public.demo_world_execute_atomic_handover() is
  'Worker-internal exact synthetic two-vehicle handover. All normal commands commit or roll back together; no direct API grant.';
commit;
