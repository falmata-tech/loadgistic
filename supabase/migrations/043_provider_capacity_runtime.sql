-- BASE-BE-001 / FEAT-CAP-001 / FEAT-FLT-001
-- Managed provider Capacity management. Browser roles cannot call these
-- actor-id RPCs; authenticated HTTP adapters establish the actor and the
-- service repository repeats scope and permission checks inside PostgreSQL.

create or replace function public.provider_capacity_actor_scope(actor_user_id uuid)
returns table(
  actor_role text,
  organization_id uuid,
  provider_profile_id uuid,
  is_company_driver boolean,
  can_manage_capacity boolean,
  workspace_access boolean
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    profile.role::text,
    membership.organization_id,
    provider.id,
    profile.role='DRIVER' and membership.organization_id is not null,
    case
      when profile.role='TRANSPORTER' then true
      when profile.role='DRIVER' and provider.id is not null then true
      when profile.role='DRIVER' and membership.organization_id is not null
        then coalesce(permission.can_manage_capacity,true)
      else false
    end,
    exists(
      select 1
      from public.subscriptions subscription
      where (subscription.organization_id=membership.organization_id
          or subscription.provider_profile_id=provider.id)
        and (
          subscription.status='SPONSORED'
          or subscription.status in ('TRIAL','ACTIVE') and subscription.ends_at>now()
        )
    )
  from public.profiles profile
  left join lateral (
    select member.organization_id
    from public.organization_members member
    where member.user_id=profile.id
    order by case when member.membership_role='OWNER' then 0 else 1 end,member.id
    limit 1
  ) membership on true
  left join public.provider_profiles provider on provider.user_id=profile.id
  left join public.driver_permissions permission on permission.user_id=profile.id
  where profile.id=actor_user_id
    and profile.active
    and profile.role in ('TRANSPORTER','DRIVER')
$$;

create or replace function public.provider_capacity_place_points(
  requested_points jsonb,
  minimum_count integer,
  maximum_count integer,
  invalid_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  requested_count integer;
  resolved_count integer;
  distinct_count integer;
  result jsonb;
begin
  if requested_points is null or jsonb_typeof(requested_points)<>'array' then
    raise exception '%',invalid_code;
  end if;
  requested_count:=jsonb_array_length(requested_points);
  if requested_count<minimum_count or requested_count>maximum_count then
    raise exception '%',invalid_code;
  end if;

  select count(*),count(distinct nullif(trim(coalesce(point.value->>'place_ref',point.value->>'placeRef')),''))
    into resolved_count,distinct_count
  from jsonb_array_elements(requested_points) point(value)
  join public.place_catalog place
    on place.id=nullif(trim(coalesce(point.value->>'place_ref',point.value->>'placeRef')),'');

  if resolved_count<>requested_count then raise exception 'LOCALITY_REQUIRED'; end if;
  if distinct_count<>requested_count then raise exception 'CAPACITY_PLACE_DUPLICATE'; end if;

  select jsonb_agg(jsonb_build_object(
    'place_ref',place.id,
    'label',concat_ws(', ',place.name,
      case when place.parent_name is not null and lower(place.parent_name)<>lower(place.name) then place.parent_name end,
      coalesce(place.country_name,'Ethiopia')),
    'lat',place.latitude,
    'lng',place.longitude
  ) order by point.position),count(*)
    into result,resolved_count
  from jsonb_array_elements(requested_points) with ordinality point(value,position)
  join public.place_catalog place
    on place.id=nullif(trim(coalesce(point.value->>'place_ref',point.value->>'placeRef')),'');

  if resolved_count<>requested_count then raise exception 'LOCALITY_REQUIRED'; end if;
  return result;
end;
$$;

create or replace function public.provider_capacity_nearest_place(
  point_lat double precision,
  point_lng double precision
)
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'place_ref',place.id,
    'place_label',concat_ws(', ',place.name,
      case when place.parent_name is not null and lower(place.parent_name)<>lower(place.name) then place.parent_name end,
      coalesce(place.country_name,'Ethiopia')),
    'lat',place.latitude,
    'lng',place.longitude
  )
  from public.place_catalog place
  where place.latitude is not null and place.longitude is not null
  order by power(place.latitude-point_lat,2)+power(place.longitude-point_lng,2),place.id
  limit 1
$$;

create or replace function public.provider_capacity_workspace(actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  vehicles jsonb;
  capacities jsonb;
  regular_signals jsonb;
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  with owned_vehicle as (
    select vehicle.*
    from public.vehicles vehicle
    where vehicle.active and (
      actor.actor_role='TRANSPORTER' and vehicle.organization_id=actor.organization_id
      or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
        and vehicle.provider_profile_id=actor.provider_profile_id
      or actor.is_company_driver and vehicle.organization_id=actor.organization_id and exists(
        select 1 from public.driver_vehicle_assignments assignment
        where assignment.driver_user_id=actor_user_id
          and assignment.vehicle_id=vehicle.id and assignment.active
      )
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',vehicle.id,'label',vehicle.label,'category',vehicle.category,
    'make',vehicle.make,'model',vehicle.model,
    'cargo_configuration',vehicle.cargo_configuration,'plate',vehicle.plate,
    'platform_number',vehicle.platform_number,'active',vehicle.active
  ) order by vehicle.label,vehicle.id),'[]'::jsonb)
  into vehicles from owned_vehicle vehicle;

  with owned_vehicle as (
    select vehicle.*
    from public.vehicles vehicle
    where vehicle.active and (
      actor.actor_role='TRANSPORTER' and vehicle.organization_id=actor.organization_id
      or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
        and vehicle.provider_profile_id=actor.provider_profile_id
      or actor.is_company_driver and vehicle.organization_id=actor.organization_id and exists(
        select 1 from public.driver_vehicle_assignments assignment
        where assignment.driver_user_id=actor_user_id
          and assignment.vehicle_id=vehicle.id and assignment.active
      )
    )
  ), latest as (
    select distinct on (capacity.vehicle_id) capacity.*
    from public.capacities capacity
    join owned_vehicle vehicle on vehicle.id=capacity.vehicle_id
    order by capacity.vehicle_id,capacity.updated_at desc,capacity.id desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',capacity.id,'vehicle_id',capacity.vehicle_id,
    'provider_organization_id',capacity.provider_organization_id,
    'provider_profile_id',capacity.provider_profile_id,
    'status',coalesce(capacity.market_status,capacity.status::text),
    'visibility',capacity.visibility,'updated_at',capacity.updated_at,
    'expires_at',capacity.expires_at,'location_area',capacity.location_area,
    'location_updated_at',capacity.location_updated_at,'location_lat',capacity.location_lat,
    'location_lng',capacity.location_lng,'location_precision_km',capacity.location_precision_km,
    'location_source',capacity.location_source,'location_place_ref',capacity.location_place_ref,
    'accepts_full_load',capacity.accepts_full_load,
    'accepts_partial_load',capacity.accepts_partial_load,
    'accepts_multi_pick',capacity.accepts_multi_pick,
    'accepts_multi_drop',capacity.accepts_multi_drop,
    'availability_geometry',capacity.availability_geometry,
    'work_radius_km',capacity.work_radius_km,
    'current_route_origin',capacity.current_route_origin,
    'current_route_destination',capacity.current_route_destination,
    'current_route_points',capacity.current_route_points_json,
    'capacity_area_center_place_ref',capacity.capacity_area_center_place_ref,
    'capacity_area_center_label',capacity.capacity_area_center_label,
    'capacity_area_center_lat',capacity.capacity_area_center_lat,
    'capacity_area_center_lng',capacity.capacity_area_center_lng,
    'capacity_area_boundary',capacity.capacity_area_boundary_json,
    'photo_storage_path',capacity.photo_storage_path,
    'proof_available',capacity.photo_storage_path is not null,
    'vehicle_label',vehicle.label,'vehicle_category',vehicle.category,
    'platform_number',vehicle.platform_number,'vehicle_make',vehicle.make,
    'vehicle_model',vehicle.model,'cargo_configuration',coalesce(vehicle.cargo_configuration,vehicle.category),
    'updated_by_name',updated_by.full_name
  ) order by capacity.updated_at desc,capacity.id desc),'[]'::jsonb)
  into capacities
  from latest capacity
  join owned_vehicle vehicle on vehicle.id=capacity.vehicle_id
  join public.profiles updated_by on updated_by.id=capacity.updated_by;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',route.id,'geometry',route.geometry,'origin',route.origin,'destination',route.destination,
    'route_points',route.route_points_json,'origin_place_ref',route.origin_place_ref,
    'origin_lat',route.origin_lat,'origin_lng',route.origin_lng,
    'destination_place_ref',route.destination_place_ref,'destination_lat',route.destination_lat,
    'destination_lng',route.destination_lng,'area_center_place_ref',route.area_center_place_ref,
    'area_center_label',route.area_center_label,'area_center_lat',route.area_center_lat,
    'area_center_lng',route.area_center_lng,'area_boundary',route.area_boundary_json,
    'created_at',route.created_at
  ) order by route.created_at desc,route.id desc),'[]'::jsonb)
  into regular_signals
  from public.profile_routes route
  where route.organization_id=actor.organization_id
     or route.provider_profile_id=actor.provider_profile_id;

  return jsonb_build_object(
    'vehicles',vehicles,'capacities',capacities,'corridors',regular_signals,
    'access',jsonb_build_object(
      'kind',case when actor.is_company_driver then 'COMPANY' else 'SELF_MANAGED' end,
      'can_manage_capacity',actor.can_manage_capacity
    )
  );
end;
$$;

create or replace function public.publish_provider_capacity(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  actor record;
  vehicle public.vehicles%rowtype;
  assigned_driver uuid;
  status_value text:=upper(coalesce(nullif(trim(command->>'status'),''),'OFF_DUTY'));
  geometry_value text;
  visibility_value text:=case when upper(coalesce(command->>'visibility','OPEN'))='PRIVATE' then 'PRIVATE' else 'OPEN' end;
  accepted_loads text:=upper(coalesce(command->>'accepted_loads',''));
  accepts_full boolean:=false;
  accepts_partial boolean:=false;
  route_points jsonb:='[]'::jsonb;
  area_boundary jsonb:='[]'::jsonb;
  area_center_ref text;
  area_center_label text;
  area_center_lat double precision;
  area_center_lng double precision;
  first_point jsonb;
  last_point jsonb;
  nearest_place jsonb;
  location_latitude double precision;
  location_longitude double precision;
  location_precision integer;
  location_time timestamptz;
  work_radius integer;
  created_id uuid:=gen_random_uuid();
  timestamp_value timestamptz:=now();
  photo_reference text:=nullif(trim(command->>'photo_storage_path'),'');
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver and not actor.can_manage_capacity then raise exception 'FORBIDDEN'; end if;
  if status_value not in ('EMPTY','PARTIAL','OFF_DUTY') then raise exception 'INVALID_CAPACITY_STATUS'; end if;

  select candidate.* into vehicle
  from public.vehicles candidate
  where candidate.id=nullif(trim(command->>'vehicle_id'),'')::uuid and candidate.active and (
    actor.actor_role='TRANSPORTER' and candidate.organization_id=actor.organization_id
    or actor.actor_role='DRIVER' and actor.provider_profile_id is not null
      and candidate.provider_profile_id=actor.provider_profile_id
    or actor.is_company_driver and candidate.organization_id=actor.organization_id and exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.driver_user_id=actor_user_id and assignment.vehicle_id=candidate.id and assignment.active
    )
  );
  if not found then raise exception 'INVALID_VEHICLE'; end if;

  if vehicle.provider_profile_id is not null then
    assigned_driver:=actor_user_id;
  else
    select assignment.driver_user_id into assigned_driver
    from public.driver_vehicle_assignments assignment
    where assignment.vehicle_id=vehicle.id and assignment.active
    order by assignment.assigned_at desc,assignment.id desc limit 1;
  end if;
  if status_value<>'OFF_DUTY' and assigned_driver is null then raise exception 'DRIVER_REQUIRED_FOR_CAPACITY'; end if;
  if actor.is_company_driver and assigned_driver is distinct from actor_user_id then raise exception 'FORBIDDEN'; end if;

  if status_value='EMPTY' then
    if accepted_loads='FTL' then accepts_full:=true;
    elsif accepted_loads='PTL' then accepts_partial:=true;
    elsif accepted_loads='BOTH' then accepts_full:=true;accepts_partial:=true;
    else raise exception 'ACCEPTED_LOADS_REQUIRED'; end if;
  elsif status_value='PARTIAL' then
    accepts_partial:=true;
  end if;

  if status_value<>'OFF_DUTY' then
    geometry_value:=upper(coalesce(nullif(trim(command->>'availability_geometry'),''),'RADIUS'));
    if geometry_value not in ('ROUTE','RADIUS') then raise exception 'INVALID_AVAILABILITY_GEOMETRY'; end if;
    if status_value='PARTIAL' and geometry_value<>'ROUTE' then raise exception 'PARTIAL_CAPACITY_ROUTE_REQUIRED'; end if;
    if geometry_value='ROUTE' then
      route_points:=public.provider_capacity_place_points(command->'current_route_places',2,5,'CAPACITY_ROUTE_POINTS_REQUIRED');
      first_point:=route_points->0;
      last_point:=route_points->(jsonb_array_length(route_points)-1);
    else
      select place.id,
        concat_ws(', ',place.name,
          case when place.parent_name is not null and lower(place.parent_name)<>lower(place.name) then place.parent_name end,
          coalesce(place.country_name,'Ethiopia')) as label,
        place.latitude,place.longitude
      into area_center_ref,area_center_label,area_center_lat,area_center_lng
      from public.place_catalog place
      where place.id=nullif(trim(command->>'capacity_area_center_place_ref'),'');
      if not found then raise exception 'LOCALITY_REQUIRED'; end if;
      area_boundary:=public.provider_capacity_place_points(command->'capacity_area_boundary_places',3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED');
      if exists(select 1 from jsonb_array_elements(area_boundary) point where point->>'place_ref'=area_center_ref) then
        raise exception 'CAPACITY_PLACE_DUPLICATE';
      end if;
      select greatest(5,least(500,ceil(max(st_distance(
        st_setsrid(st_makepoint(area_center_lng,area_center_lat),4326)::geography,
        st_setsrid(st_makepoint((point->>'lng')::double precision,(point->>'lat')::double precision),4326)::geography
      )/1000.0))::integer)) into work_radius
      from jsonb_array_elements(area_boundary) point;
    end if;

    if actor.actor_role='DRIVER' then
      if command->>'location_source'<>'DEVICE_OBSCURED' then raise exception 'INVALID_APPROXIMATE_LOCATION'; end if;
      location_latitude:=(command->>'approximate_lat')::double precision;
      location_longitude:=(command->>'approximate_lng')::double precision;
      location_precision:=(command->>'location_precision_km')::integer;
      location_time:=timestamp_value;
      if location_latitude not between 3 and 15 or location_longitude not between 32 and 49
        or location_precision not in (1,3,5,10,20,40) then
        raise exception 'INVALID_APPROXIMATE_LOCATION';
      end if;
    else
      select capacity.location_lat,capacity.location_lng,capacity.location_precision_km,capacity.location_updated_at
        into location_latitude,location_longitude,location_precision,location_time
      from public.capacities capacity
      where capacity.vehicle_id=vehicle.id and capacity.updated_by=assigned_driver
        and capacity.location_source='DEVICE_OBSCURED'
        and capacity.location_lat is not null and capacity.location_lng is not null
      order by coalesce(capacity.location_updated_at,capacity.updated_at) desc,capacity.id desc limit 1;
      if location_latitude is null then raise exception 'CAPACITY_DRIVER_LOCATION_REQUIRED'; end if;
    end if;
    nearest_place:=public.provider_capacity_nearest_place(location_latitude,location_longitude);
    if nearest_place is null then raise exception 'INVALID_APPROXIMATE_LOCATION'; end if;
  end if;

  update public.capacities set expires_at=timestamp_value
  where vehicle_id=vehicle.id and expires_at>timestamp_value;

  insert into public.capacities(
    id,provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,
    origin,destination,corridor,travel_date,next_available,visibility,photo_storage_path,
    location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,
    accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,
    proof_recorded_at,updated_by,updated_at,expires_at,movement_scope,
    local_place_ref,local_place_label,local_center_lat,local_center_lng,local_radius_km,
    current_route_origin,current_route_destination,current_route_date,planned_space_status,
    accepts_multi_pick,accepts_multi_drop,current_origin_place_ref,current_origin_lat,current_origin_lng,
    current_destination_place_ref,current_destination_lat,current_destination_lng,location_place_ref,
    availability_geometry,work_radius_km,current_route_points_json,
    capacity_area_center_place_ref,capacity_area_center_label,capacity_area_center_lat,
    capacity_area_center_lng,capacity_area_boundary_json
  ) values (
    created_id,vehicle.organization_id,vehicle.provider_profile_id,vehicle.id,status_value::public.capacity_status,
    status_value,case status_value when 'EMPTY' then 100 when 'PARTIAL' then 50 else 0 end,
    null,null,null,null,null,visibility_value::public.capacity_visibility,photo_reference,
    case when status_value='OFF_DUTY' then null else 'Around '||(nearest_place->>'place_label') end,
    location_time,location_latitude,location_longitude,location_precision,
    case when status_value='OFF_DUTY' then null else 'DEVICE_OBSCURED' end,
    accepts_full,accepts_partial,false,
    case when status_value='OFF_DUTY' then false else coalesce((command->>'accepts_multi_pick')::boolean,false)
      or coalesce((command->>'accepts_multi_drop')::boolean,false) end,
    case when photo_reference is not null then timestamp_value end,
    actor_user_id,timestamp_value,timestamp_value+interval '24 hours','BOTH',
    case when status_value='OFF_DUTY' then null else nearest_place->>'place_ref' end,
    case when status_value='OFF_DUTY' then null else nearest_place->>'place_label' end,
    location_latitude,location_longitude,
    case when status_value='OFF_DUTY' then null else least(50,greatest(10,coalesce(work_radius,50))) end,
    case when geometry_value='ROUTE' then first_point->>'label' end,
    case when geometry_value='ROUTE' then last_point->>'label' end,
    null,null,
    case when status_value='OFF_DUTY' then false else coalesce((command->>'accepts_multi_pick')::boolean,false) end,
    case when status_value='OFF_DUTY' then false else coalesce((command->>'accepts_multi_drop')::boolean,false) end,
    case when geometry_value='ROUTE' then first_point->>'place_ref' end,
    case when geometry_value='ROUTE' then (first_point->>'lat')::double precision end,
    case when geometry_value='ROUTE' then (first_point->>'lng')::double precision end,
    case when geometry_value='ROUTE' then last_point->>'place_ref' end,
    case when geometry_value='ROUTE' then (last_point->>'lat')::double precision end,
    case when geometry_value='ROUTE' then (last_point->>'lng')::double precision end,
    case when status_value='OFF_DUTY' then null else nearest_place->>'place_ref' end,
    geometry_value,work_radius,route_points,
    case when geometry_value='RADIUS' then area_center_ref end,
    case when geometry_value='RADIUS' then area_center_label end,
    case when geometry_value='RADIUS' then area_center_lat end,
    case when geometry_value='RADIUS' then area_center_lng end,
    area_boundary
  );

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,vehicle.organization_id,'CAPACITY_PUBLISHED','capacity',created_id,
    jsonb_build_object('vehicleId',vehicle.id,'status',status_value,'visibility',visibility_value,
      'availabilityGeometry',geometry_value,'locationSource',case when status_value='OFF_DUTY' then null else 'DEVICE_OBSCURED' end),
    timestamp_value);
  return created_id;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_CAPACITY_INPUT';
end;
$$;

create or replace function public.refresh_provider_capacity_location(actor_user_id uuid,command jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
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
  if actor.is_company_driver and not actor.can_manage_capacity then raise exception 'FORBIDDEN'; end if;

  select candidate.* into vehicle
  from public.vehicles candidate
  where candidate.id=nullif(trim(command->>'vehicle_id'),'')::uuid and candidate.active and (
    actor.provider_profile_id is not null and candidate.provider_profile_id=actor.provider_profile_id
    or actor.is_company_driver and candidate.organization_id=actor.organization_id and exists(
      select 1 from public.driver_vehicle_assignments assignment
      where assignment.driver_user_id=actor_user_id and assignment.vehicle_id=candidate.id and assignment.active
    )
  );
  if not found then raise exception 'INVALID_VEHICLE'; end if;

  select candidate.* into capacity from public.capacities candidate
  where candidate.vehicle_id=vehicle.id
  order by candidate.updated_at desc,candidate.id desc limit 1;
  if not found or coalesce(capacity.market_status,capacity.status::text) not in ('EMPTY','PARTIAL') then
    raise exception 'CAPACITY_LOCATION_ACTIVE_REQUIRED';
  end if;

  latitude_value:=(command->>'approximate_lat')::double precision;
  longitude_value:=(command->>'approximate_lng')::double precision;
  precision_value:=(command->>'location_precision_km')::integer;
  if latitude_value not between 3 and 15 or longitude_value not between 32 and 49
    or precision_value not in (1,3,5,10,20,40) then raise exception 'INVALID_APPROXIMATE_LOCATION'; end if;
  nearest_place:=public.provider_capacity_nearest_place(latitude_value,longitude_value);
  if nearest_place is null then raise exception 'INVALID_APPROXIMATE_LOCATION'; end if;

  update public.capacities set
    location_area='Around '||(nearest_place->>'place_label'),location_place_ref=nearest_place->>'place_ref',
    location_updated_at=timestamp_value,location_lat=latitude_value,location_lng=longitude_value,
    location_precision_km=precision_value,location_source='DEVICE_OBSCURED'
  where id=capacity.id;

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,vehicle.organization_id,'CAPACITY_LOCATION_REFRESHED','capacity',capacity.id,
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
$$;

create or replace function public.set_provider_assigned_vehicle_duty(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  vehicle public.vehicles%rowtype;
  source public.capacities%rowtype;
  on_duty boolean:=coalesce((command->>'on_duty')::boolean,false);
  latitude_value double precision;
  longitude_value double precision;
  precision_value integer;
  nearest_place jsonb;
  created_id uuid:=gen_random_uuid();
  timestamp_value timestamptz:=now();
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found or not actor.is_company_driver then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  select candidate.* into vehicle
  from public.vehicles candidate
  join public.driver_vehicle_assignments assignment
    on assignment.vehicle_id=candidate.id and assignment.active
  where candidate.id=nullif(trim(command->>'vehicle_id'),'')::uuid
    and candidate.organization_id=actor.organization_id and candidate.active
    and assignment.driver_user_id=actor_user_id;
  if not found then raise exception 'INVALID_VEHICLE'; end if;

  if on_duty then
    select candidate.* into source
    from public.capacities candidate
    join public.profiles publisher on publisher.id=candidate.updated_by and publisher.role='TRANSPORTER'
    where candidate.vehicle_id=vehicle.id
      and coalesce(candidate.market_status,candidate.status::text) in ('EMPTY','PARTIAL')
    order by candidate.updated_at desc,candidate.id desc limit 1;
    if not found then raise exception 'CAPACITY_CONFIGURATION_REQUIRED'; end if;
    latitude_value:=(command->>'approximate_lat')::double precision;
    longitude_value:=(command->>'approximate_lng')::double precision;
    precision_value:=(command->>'location_precision_km')::integer;
    if command->>'location_source'<>'DEVICE_OBSCURED'
      or latitude_value not between 3 and 15 or longitude_value not between 32 and 49
      or precision_value not in (1,3,5,10,20,40) then raise exception 'INVALID_APPROXIMATE_LOCATION'; end if;
    nearest_place:=public.provider_capacity_nearest_place(latitude_value,longitude_value);
  else
    select candidate.* into source from public.capacities candidate
    where candidate.vehicle_id=vehicle.id
    order by candidate.updated_at desc,candidate.id desc limit 1;
    if not found then raise exception 'CAPACITY_CONFIGURATION_REQUIRED'; end if;
  end if;

  update public.capacities set expires_at=timestamp_value
  where vehicle_id=vehicle.id and expires_at>timestamp_value;

  insert into public.capacities(
    id,provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,
    origin,destination,corridor,travel_date,next_available,visibility,photo_storage_path,
    location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,
    accepts_full_load,accepts_partial_load,open_to_contract_lanes,accepts_multi_stop,
    proof_recorded_at,updated_by,updated_at,expires_at,movement_scope,
    local_place_ref,local_place_label,local_center_lat,local_center_lng,local_radius_km,
    current_route_origin,current_route_destination,current_route_date,planned_space_status,
    accepts_multi_pick,accepts_multi_drop,current_origin_place_ref,current_origin_lat,current_origin_lng,
    current_destination_place_ref,current_destination_lat,current_destination_lng,location_place_ref,
    availability_geometry,work_radius_km,current_route_points_json,
    capacity_area_center_place_ref,capacity_area_center_label,capacity_area_center_lat,
    capacity_area_center_lng,capacity_area_boundary_json
  ) values (
    created_id,vehicle.organization_id,null,vehicle.id,
    case when on_duty then source.status else 'OFF_DUTY'::public.capacity_status end,
    case when on_duty then coalesce(source.market_status,source.status::text) else 'OFF_DUTY' end,
    case when on_duty then source.available_percent else 0 end,
    null,null,null,null,null,source.visibility,null,
    case when on_duty then 'Around '||(nearest_place->>'place_label') end,
    case when on_duty then timestamp_value end,
    case when on_duty then latitude_value end,case when on_duty then longitude_value end,
    case when on_duty then precision_value end,case when on_duty then 'DEVICE_OBSCURED' end,
    on_duty and source.accepts_full_load,on_duty and source.accepts_partial_load,false,
    on_duty and source.accepts_multi_stop,null,actor_user_id,timestamp_value,timestamp_value+interval '24 hours',
    case when on_duty then source.movement_scope else 'BOTH' end,
    case when on_duty then nearest_place->>'place_ref' end,
    case when on_duty then nearest_place->>'place_label' end,
    case when on_duty then latitude_value end,case when on_duty then longitude_value end,
    case when on_duty then source.local_radius_km end,
    case when on_duty then source.current_route_origin end,
    case when on_duty then source.current_route_destination end,null,
    case when on_duty then source.planned_space_status end,
    on_duty and source.accepts_multi_pick,on_duty and source.accepts_multi_drop,
    case when on_duty then source.current_origin_place_ref end,
    case when on_duty then source.current_origin_lat end,case when on_duty then source.current_origin_lng end,
    case when on_duty then source.current_destination_place_ref end,
    case when on_duty then source.current_destination_lat end,case when on_duty then source.current_destination_lng end,
    case when on_duty then nearest_place->>'place_ref' end,
    case when on_duty then source.availability_geometry end,
    case when on_duty then source.work_radius_km end,
    case when on_duty then source.current_route_points_json else '[]'::jsonb end,
    case when on_duty then source.capacity_area_center_place_ref end,
    case when on_duty then source.capacity_area_center_label end,
    case when on_duty then source.capacity_area_center_lat end,
    case when on_duty then source.capacity_area_center_lng end,
    case when on_duty then source.capacity_area_boundary_json else '[]'::jsonb end
  );

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,vehicle.organization_id,
    case when on_duty then 'VEHICLE_SET_ON_DUTY' else 'VEHICLE_SET_OFF_DUTY' end,
    'vehicle',vehicle.id,jsonb_build_object('capacityId',created_id,
      'restoredCapacityId',case when on_duty then source.id end),timestamp_value);
  return created_id;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_APPROXIMATE_LOCATION';
end;
$$;

create or replace function public.add_provider_regular_capacity(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  geometry_value text:=upper(coalesce(nullif(trim(command->>'geometry'),''),'ROUTE'));
  route_points jsonb:='[]'::jsonb;
  area_boundary jsonb:='[]'::jsonb;
  area_center_ref text;
  area_center_label text;
  area_center_lat double precision;
  area_center_lng double precision;
  first_point jsonb;
  last_point jsonb;
  created_id uuid:=gen_random_uuid();
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN'; end if;
  if geometry_value not in ('ROUTE','RADIUS') then raise exception 'INVALID_AVAILABILITY_GEOMETRY'; end if;
  if exists(select 1 from public.profile_routes route
    where route.organization_id=actor.organization_id or route.provider_profile_id=actor.provider_profile_id) then
    raise exception 'REGULAR_CAPACITY_LIMIT';
  end if;

  if geometry_value='ROUTE' then
    route_points:=public.provider_capacity_place_points(command->'route_places',2,5,'CAPACITY_ROUTE_POINTS_REQUIRED');
    first_point:=route_points->0;
    last_point:=route_points->(jsonb_array_length(route_points)-1);
  else
    select place.id,
      concat_ws(', ',place.name,
        case when place.parent_name is not null and lower(place.parent_name)<>lower(place.name) then place.parent_name end,
        coalesce(place.country_name,'Ethiopia')) as label,
      place.latitude,place.longitude
    into area_center_ref,area_center_label,area_center_lat,area_center_lng from public.place_catalog place
    where place.id=nullif(trim(command->>'area_center_place_ref'),'');
    if not found then raise exception 'LOCALITY_REQUIRED'; end if;
    area_boundary:=public.provider_capacity_place_points(command->'area_boundary_places',3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED');
    if exists(select 1 from jsonb_array_elements(area_boundary) point where point->>'place_ref'=area_center_ref) then
      raise exception 'CAPACITY_PLACE_DUPLICATE';
    end if;
    first_point:=jsonb_build_object('place_ref',area_center_ref,'label',area_center_label,
      'lat',area_center_lat,'lng',area_center_lng);
    last_point:=first_point;
  end if;

  insert into public.profile_routes(
    id,organization_id,provider_profile_id,geometry,origin,destination,created_by,created_at,
    origin_place_ref,origin_lat,origin_lng,destination_place_ref,destination_lat,destination_lng,
    route_points_json,area_center_place_ref,area_center_label,area_center_lat,area_center_lng,area_boundary_json
  ) values (
    created_id,actor.organization_id,actor.provider_profile_id,geometry_value,
    first_point->>'label',last_point->>'label',actor_user_id,now(),
    first_point->>'place_ref',(first_point->>'lat')::double precision,(first_point->>'lng')::double precision,
    last_point->>'place_ref',(last_point->>'lat')::double precision,(last_point->>'lng')::double precision,
    route_points,case when geometry_value='RADIUS' then area_center_ref end,
    case when geometry_value='RADIUS' then area_center_label end,
    case when geometry_value='RADIUS' then area_center_lat end,
    case when geometry_value='RADIUS' then area_center_lng end,area_boundary
  );

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'REGULAR_CAPACITY_SIGNAL_ADDED',
    'profile_route',created_id,jsonb_build_object('geometry',geometry_value),now());
  return created_id;
end;
$$;

create or replace function public.remove_provider_regular_capacity(actor_user_id uuid,target_route_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  removed_id uuid;
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN'; end if;

  delete from public.profile_routes route
  where route.id=target_route_id and (
    route.organization_id=actor.organization_id or route.provider_profile_id=actor.provider_profile_id
  ) returning route.id into removed_id;
  if removed_id is null then raise exception 'NOT_FOUND'; end if;

  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'REGULAR_CAPACITY_SIGNAL_REMOVED',
    'profile_route',removed_id,'{}'::jsonb,now());
end;
$$;

-- The earlier authenticated duty RPC accepted the caller identity from
-- auth.uid(). The managed HTTP boundary now uses the richer atomic command and
-- keeps all actor-id functions service-role-only.
revoke all on function public.set_assigned_vehicle_duty(uuid,boolean) from public,anon,authenticated;

revoke all on function public.provider_capacity_actor_scope(uuid) from public,anon,authenticated;
revoke all on function public.provider_capacity_place_points(jsonb,integer,integer,text) from public,anon,authenticated;
revoke all on function public.provider_capacity_nearest_place(double precision,double precision) from public,anon,authenticated;
revoke all on function public.provider_capacity_workspace(uuid) from public,anon,authenticated;
revoke all on function public.publish_provider_capacity(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.refresh_provider_capacity_location(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.set_provider_assigned_vehicle_duty(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.add_provider_regular_capacity(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.remove_provider_regular_capacity(uuid,uuid) from public,anon,authenticated;

grant execute on function public.provider_capacity_actor_scope(uuid) to service_role;
grant execute on function public.provider_capacity_place_points(jsonb,integer,integer,text) to service_role;
grant execute on function public.provider_capacity_nearest_place(double precision,double precision) to service_role;
grant execute on function public.provider_capacity_workspace(uuid) to service_role;
grant execute on function public.publish_provider_capacity(uuid,jsonb) to service_role;
grant execute on function public.refresh_provider_capacity_location(uuid,jsonb) to service_role;
grant execute on function public.set_provider_assigned_vehicle_duty(uuid,jsonb) to service_role;
grant execute on function public.add_provider_regular_capacity(uuid,jsonb) to service_role;
grant execute on function public.remove_provider_regular_capacity(uuid,uuid) to service_role;

comment on function public.provider_capacity_workspace(uuid) is
  'Server-only provider Capacity management read model with repeated provider, assignment, permission, and subscription scope.';
comment on function public.publish_provider_capacity(uuid,jsonb) is
  'Atomically validates, canonicalizes, publishes, and audits one provider capacity signal.';
