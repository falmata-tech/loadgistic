-- FEAT-FLT-001 / FEAT-CAP-001: location can precede owner-managed publication.
-- Only approximate driver-submitted fixes, never an owner's device position.
create table public.vehicle_driver_locations (
 vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
 driver_user_id uuid not null references public.profiles(id) on delete cascade,
 latitude double precision not null check(latitude between 3 and 15),
 longitude double precision not null check(longitude between 32 and 49),
 precision_km integer not null check(precision_km in (1,3,5,10,20,40)),
 area text not null, place_ref text not null, updated_at timestamptz not null default now()
);
alter table public.vehicle_driver_locations enable row level security;
revoke all on public.vehicle_driver_locations from public,anon,authenticated;
grant select,insert,update,delete on public.vehicle_driver_locations to service_role;

CREATE OR REPLACE FUNCTION public.refresh_provider_capacity_location(actor_user_id uuid, command jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor record;
  vehicle public.vehicles%rowtype;
  capacity public.capacities%rowtype;
  nearest_place jsonb;
  latitude_value double precision;
  longitude_value double precision;
  precision_value integer;
  timestamp_value timestamptz:=now();
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found or actor.actor_role<>'DRIVER' then raise exception 'DEVICE_LOCATION_DRIVER_ONLY'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  select candidate.* into vehicle
  from public.vehicles candidate
  where candidate.id=nullif(trim(command->>'vehicle_id'),'')::uuid and candidate.active and (
    actor.provider_profile_id is not null and candidate.provider_profile_id=actor.provider_profile_id
    or actor.is_company_driver and candidate.organization_id=actor.organization_id and exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.driver_user_id=actor_user_id and assignment.vehicle_id=candidate.id and assignment.active
    )
  ) for update of candidate;
  if not found then raise exception 'INVALID_VEHICLE'; end if;
  if public.capacity_active_driver_id(vehicle.id) is distinct from actor_user_id then raise exception 'DRIVER_REQUIRED_FOR_CAPACITY'; end if;

  select candidate.* into capacity from public.capacities candidate
  where candidate.vehicle_id=vehicle.id
  order by candidate.updated_at desc,candidate.id desc limit 1;

  latitude_value:=(command->>'approximate_lat')::double precision;
  longitude_value:=(command->>'approximate_lng')::double precision;
  precision_value:=(command->>'location_precision_km')::integer;
  if latitude_value is null or longitude_value is null or precision_value is null or latitude_value not between 3 and 15 or longitude_value not between 32 and 49
    or precision_value not in (1,3,5,10,20,40) then raise exception 'INVALID_APPROXIMATE_LOCATION'; end if;
  nearest_place:=public.provider_capacity_nearest_place(latitude_value,longitude_value);
  if nearest_place is null then raise exception 'INVALID_APPROXIMATE_LOCATION'; end if;

  insert into public.vehicle_driver_locations(vehicle_id,driver_user_id,latitude,longitude,precision_km,area,place_ref,updated_at)
  values(vehicle.id,actor_user_id,latitude_value,longitude_value,precision_value,'Around '||(nearest_place->>'place_label'),nearest_place->>'place_ref',timestamp_value)
  on conflict(vehicle_id) do update set driver_user_id=excluded.driver_user_id,latitude=excluded.latitude,longitude=excluded.longitude,
    precision_km=excluded.precision_km,area=excluded.area,place_ref=excluded.place_ref,updated_at=excluded.updated_at;

  update public.capacities set
    location_area='Around '||(nearest_place->>'place_label'),location_place_ref=nearest_place->>'place_ref',
    location_updated_at=timestamp_value,location_lat=latitude_value,location_lng=longitude_value,
    location_precision_km=precision_value,location_source='DEVICE_OBSCURED'
  where id=capacity.id;

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,vehicle.organization_id,'CAPACITY_LOCATION_REFRESHED',case when capacity.id is null then 'vehicle' else 'capacity' end,coalesce(capacity.id,vehicle.id),
    jsonb_build_object('vehicleId',vehicle.id,'locationSource','DEVICE_OBSCURED','locationPrecisionKm',precision_value),
    timestamp_value);

  return jsonb_build_object('capacityId',capacity.id,'vehicleId',vehicle.id,
    'locationArea','Around '||(nearest_place->>'place_label'),'approximateLat',latitude_value,
    'approximateLng',longitude_value,'locationPrecisionKm',precision_value,
    'locationUpdatedAt',timestamp_value);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_APPROXIMATE_LOCATION';
end;
 $function$;

do $migration$
declare definition text;before_fragment text;after_fragment text;
begin
  definition:=pg_get_functiondef('public.publish_provider_capacity(uuid,jsonb)'::regprocedure);
  before_fragment:=$before$      select capacity.location_lat,capacity.location_lng,capacity.location_precision_km,capacity.location_updated_at
        into location_latitude,location_longitude,location_precision,location_time
      from public.capacities capacity
      where capacity.vehicle_id=vehicle.id and capacity.updated_by=assigned_driver
        and capacity.location_source='DEVICE_OBSCURED'
        and capacity.location_lat is not null and capacity.location_lng is not null
      order by coalesce(capacity.location_updated_at,capacity.updated_at) desc,capacity.id desc limit 1;
$before$;
  after_fragment:=$after$      select fix.latitude,fix.longitude,fix.precision_km,fix.updated_at
        into location_latitude,location_longitude,location_precision,location_time
      from (
        select report.latitude,report.longitude,report.precision_km,report.updated_at
        from public.vehicle_driver_locations report where report.vehicle_id=vehicle.id and report.driver_user_id=assigned_driver
        union all
        select capacity.location_lat,capacity.location_lng,capacity.location_precision_km,capacity.location_updated_at
        from public.capacities capacity where capacity.vehicle_id=vehicle.id and capacity.updated_by=assigned_driver
          and capacity.location_source='DEVICE_OBSCURED' and capacity.location_lat is not null and capacity.location_lng is not null
      ) fix order by fix.updated_at desc nulls last limit 1;
$after$;
  if length(definition)-length(replace(definition,before_fragment,''))<>length(before_fragment) then raise exception 'LOCATION_CONTRACT_DRIFT';end if;
  execute replace(definition,before_fragment,after_fragment);
  definition:=pg_get_functiondef('public.provider_capacity_workspace(uuid)'::regprocedure);
  before_fragment:=$before$'assigned_driver',(select jsonb_build_object('id',driver.id,'name',driver.full_name) from public.profiles driver where driver.id=public.capacity_active_driver_id(vehicle.id))$before$;
  after_fragment:=$after$'assigned_driver',(select jsonb_build_object('id',driver.id,'name',driver.full_name) from public.profiles driver where driver.id=public.capacity_active_driver_id(vehicle.id)),
    'driver_location',(select jsonb_build_object('lat',report.latitude,'lng',report.longitude,'radius',report.precision_km,'area',report.area,'updatedAt',report.updated_at)
      from public.vehicle_driver_locations report where report.vehicle_id=vehicle.id and report.driver_user_id=public.capacity_active_driver_id(vehicle.id)),
    'duty_configuration_available',exists(select 1 from public.capacities saved join public.profiles publisher on publisher.id=saved.updated_by and publisher.role='TRANSPORTER' where saved.vehicle_id=vehicle.id and coalesce(saved.market_status,saved.status::text) in ('EMPTY','PARTIAL'))$after$;
  if length(definition)-length(replace(definition,before_fragment,''))<>length(before_fragment) then raise exception 'LOCATION_CONTRACT_DRIFT';end if;
  execute replace(definition,before_fragment,after_fragment);
end $migration$;

-- SQL comparisons with NULL do not reject missing GPS fields by themselves.
do $validation$
declare definition text; signature text; before_fragment text; after_fragment text;
begin
 for signature,before_fragment,after_fragment in values
  ('public.publish_provider_capacity(uuid,jsonb)',
   'if location_latitude not between 3 and 15 or location_longitude not between 32 and 49',
   'if location_latitude is null or location_longitude is null or location_precision is null or location_latitude not between 3 and 15 or location_longitude not between 32 and 49'),
  ('public.publish_provider_capacity(uuid,jsonb)',
   'if command->>''location_source''<>''DEVICE_OBSCURED''',
   'if command->>''location_source'' is distinct from ''DEVICE_OBSCURED'''),
  ('public.set_provider_assigned_vehicle_duty(uuid,jsonb)',
   'if command->>''location_source''<>''DEVICE_OBSCURED''',
   'if latitude_value is null or longitude_value is null or precision_value is null or command->>''location_source'' is distinct from ''DEVICE_OBSCURED''')
 loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if length(definition)-length(replace(definition,before_fragment,''))<>length(before_fragment) then raise exception 'LOCATION_VALIDATION_CONTRACT_DRIFT';end if;
  execute replace(definition,before_fragment,after_fragment);
 end loop;
end $validation$;
