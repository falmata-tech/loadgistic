-- FEAT-CAP-001 / FEAT-GEO-001. Dates are publication facts, independent of location.
begin;
select pg_advisory_xact_lock(8030244);
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.capacities
  add column journey_start_at timestamptz,
  add column journey_end_at timestamptz,
  add constraint capacity_journey_window_check check (
    (journey_start_at is null or isfinite(journey_start_at))
    and (journey_end_at is null or isfinite(journey_end_at))
    and (journey_start_at is null or journey_end_at is null or journey_start_at<=journey_end_at)
    and (journey_start_at is null and journey_end_at is null or coalesce(availability_geometry='ROUTE',false))
  );

create function public.capacity_journey_timestamp(value text)
returns timestamptz language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
  if value is null then return null; end if;
  if value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$'
    then raise exception 'INVALID_CAPACITY_JOURNEY_TIME'; end if;
  return value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow then
  raise exception 'INVALID_CAPACITY_JOURNEY_TIME';
end $$;

-- Date predicates apply to the same current route as all requested endpoints.
create function public.capacity_journey_matches(
  geometry_kind text, route_points jsonb, journey_start timestamptz, journey_end timestamptz, query jsonb
) returns boolean language plpgsql immutable set search_path=public,extensions,pg_temp as $$
declare departure timestamptz;
  arrival timestamptz;
  origin_lat float8:=(query->>'origin_lat')::float8;
  origin_lng float8:=(query->>'origin_lng')::float8;
  destination_lat float8:=(query->>'destination_lat')::float8;
  destination_lng float8:=(query->>'destination_lng')::float8;
  origin_radius float8:=greatest(1,least(coalesce((query->>'origin_radius_km')::float8,50),500));
  destination_radius float8:=greatest(1,least(coalesce((query->>'destination_radius_km')::float8,50),500));
begin
  if not (query ?| array['depart_after','arrive_by']) then return true; end if;
  departure:=public.capacity_journey_timestamp(query->>'depart_after');
  arrival:=public.capacity_journey_timestamp(query->>'arrive_by');
  if departure is not null and arrival is not null and departure>arrival
    then raise exception 'INVALID_CAPACITY_JOURNEY_RANGE'; end if;
  if geometry_kind is distinct from 'ROUTE' or upper(query->>'geometry')='RADIUS'
    or coalesce(jsonb_array_length(route_points),0)<2 then return false; end if;
  if departure is not null and (journey_start is null or journey_start<departure) then return false; end if;
  if arrival is not null and (journey_end is null or journey_end>arrival) then return false; end if;
  if origin_lat is not null and destination_lat is not null then
    return coalesce(public.capacity_route_matches(route_points,origin_lat,origin_lng,destination_lat,destination_lng,
      origin_radius,destination_radius,case when query->>'direction_mode'='EITHER' then 'EITHER' else 'DIRECT' end),false);
  end if;
  if origin_lat is not null then
    return coalesce(public.capacity_route_point_matches(route_points,origin_lat,origin_lng,origin_radius),false);
  end if;
  if destination_lat is not null then
    return coalesce(public.capacity_route_point_matches(route_points,destination_lat,destination_lng,destination_radius),false);
  end if;
  return true;
end $$;

revoke all on function public.capacity_journey_timestamp(text),
  public.capacity_journey_matches(text,jsonb,timestamptz,timestamptz,jsonb) from public,anon,authenticated;

create function pg_temp.capacity_journey_replace(definition text, previous text, next text)
returns text language plpgsql as $$
begin
  if (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1
    then raise exception 'CAPACITY244_DEFINITION_DRIFT: %',left(previous,96);end if;
  return replace(definition,previous,next);
end $$;

do $writes$
declare definition text;
  start_at integer;
  end_at integer;
begin
  definition:=pg_get_functiondef('public.publish_provider_capacity_pre_radius163(uuid,jsonb)'::regprocedure);
  start_at:=strpos(definition,$old$    geometry_value:=upper(coalesce(nullif(trim(command->>'availability_geometry'),''),'RADIUS'));$old$);
  -- The planned-geometry block is bounded by its declarations and the next location section.
  if start_at=0 then raise exception 'CAPACITY244_PUBLISH_GEOMETRY_DRIFT';end if;
  end_at:=strpos(substr(definition,start_at),$old$      from jsonb_array_elements(area_boundary) point;
    end if;$old$);
  if end_at=0 then raise exception 'CAPACITY244_PUBLISH_GEOMETRY_END_DRIFT';end if;
  definition:=overlay(definition placing $new$    if command->>'availability_geometry' is distinct from 'ROUTE' then
      raise exception 'PLANNED_ROUTE_REQUIRED';
    end if;
    geometry_value:='ROUTE';
    route_points:=public.provider_capacity_place_points(command->'current_route_places',2,5,'CAPACITY_ROUTE_POINTS_REQUIRED');
    first_point:=route_points->0;
    last_point:=route_points->(jsonb_array_length(route_points)-1);$new$
    from start_at for end_at-1+length($old$      from jsonb_array_elements(area_boundary) point;
    end if;$old$));
  definition:=pg_temp.capacity_journey_replace(definition,'  prior_space public.capacities%rowtype;',$new$  prior_space public.capacities%rowtype;
  prior_journey public.capacities%rowtype;
  departure timestamptz;
  arrival timestamptz;$new$);
  definition:=pg_temp.capacity_journey_replace(definition,$old$  update public.capacities set expires_at=timestamp_value$old$,$new$  if geometry_value='ROUTE' then
    select * into prior_journey from public.capacities
      where vehicle_id=vehicle.id
      order by updated_at desc,id desc limit 1;
    if prior_journey.availability_geometry='ROUTE'
      and public.capacity_active_driver_id(vehicle.id)=assigned_driver
      and prior_journey.updated_at>=public.provider_capacity_pair_started_at(vehicle.id)
      and prior_journey.current_route_points_json=route_points then
      departure:=prior_journey.journey_start_at;
      arrival:=prior_journey.journey_end_at;
    end if;
    if command ? 'journey_start_at' then departure:=public.capacity_journey_timestamp(command->>'journey_start_at');end if;
    if command ? 'journey_end_at' then arrival:=public.capacity_journey_timestamp(command->>'journey_end_at');end if;
    if departure is not null and arrival is not null and departure>arrival
      then raise exception 'INVALID_CAPACITY_JOURNEY_RANGE';end if;
  end if;

  update public.capacities set expires_at=timestamp_value$new$);
  definition:=pg_temp.capacity_journey_replace(definition,'capacity_area_center_lng,capacity_area_boundary_json','capacity_area_center_lng,capacity_area_boundary_json,journey_start_at,journey_end_at');
  definition:=pg_temp.capacity_journey_replace(definition,$old$    area_boundary
  );$old$,$new$    area_boundary,departure,arrival
  );$new$);
  execute definition;

  definition:=pg_get_functiondef('public.set_provider_assigned_vehicle_duty_pre_phone157(uuid,jsonb)'::regprocedure);
  definition:=pg_temp.capacity_journey_replace(definition,$old$    if coalesce(source.market_status,source.status::text)='PARTIAL' and ($old$,$new$    if source.availability_geometry is distinct from 'ROUTE' then raise exception 'PLANNED_ROUTE_REQUIRED';end if;
    if coalesce(source.market_status,source.status::text)='PARTIAL' and ($new$);
  definition:=pg_temp.capacity_journey_replace(definition,'capacity_area_center_lng,capacity_area_boundary_json','capacity_area_center_lng,capacity_area_boundary_json,journey_start_at,journey_end_at');
  definition:=pg_temp.capacity_journey_replace(definition,$old$    case when on_duty then source.capacity_area_boundary_json else '[]'::jsonb end$old$,$new$    case when on_duty then source.capacity_area_boundary_json else '[]'::jsonb end,
    case when on_duty then source.journey_start_at end,
    case when on_duty then source.journey_end_at end$new$);
  execute definition;
end $writes$;

do $reads$
declare target regprocedure;
  definition text;
  has_public_projection boolean;
  retired_branches constant text:=$pattern$\n +or \(input.geometry is null or input.geometry='RADIUS'\) and coalesce\(candidate.market_status,candidate.status::text\) in \('EMPTY','PARTIAL'\) and candidate.visibility='OPEN'\n +and candidate.availability_geometry='RADIUS'(\n +and public.capacity_area_matches\(candidate.capacity_area_boundary_json,[^\n]+){1,2}$pattern$;
  retired_area_query constant text:=$pattern$\(input.geometry is null or input.geometry='RADIUS'\) and candidate.availability_geometry='RADIUS'\n +and public.capacity_area_matches\(candidate.capacity_area_boundary_json,[^\n]+\)\n +or $pattern$;
begin
  foreach target in array array[
    'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure,
    'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure,
    'public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
    'public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure
  ] loop
    definition:=pg_get_functiondef(target);
    if regexp_count(definition,retired_branches)<>3 or regexp_count(definition,retired_area_query)<>1
      then raise exception 'CAPACITY244_PUBLIC_GEOMETRY_DRIFT: %',target;end if;
    definition:=regexp_replace(definition,retired_branches,'','g');
    definition:=regexp_replace(definition,retired_area_query,'');
    definition:=pg_temp.capacity_journey_replace(definition,$old$and (input.origin_lat is null and input.destination_lat is null or ($old$,$new$and public.capacity_journey_matches(case when candidate.visibility='OPEN' and (
    not (query ?| array['depart_after','arrive_by'])
    or candidate.updated_at>=public.provider_capacity_pair_started_at(candidate.vehicle_id)
  ) then candidate.availability_geometry end,
    candidate.current_route_points_json,
    candidate.journey_start_at,candidate.journey_end_at,query)
  and (input.origin_lat is null and input.destination_lat is null or ($new$);
    definition:=regexp_replace(definition,$pattern$\n +or position\(input.search_text in lower\(coalesce\(candidate.capacity_area_boundary_json::text,''\)\)\)>0\)$pattern$,')','g');
    definition:=replace(definition,'candidate.capacity_area_boundary_json,','null::jsonb,');
    definition:=replace(definition,$old$candidate.visibility='OPEN' and candidate.availability_geometry=input.geometry$old$,$new$candidate.visibility='OPEN' and candidate.availability_geometry='ROUTE' and input.geometry='ROUTE'$new$);
    definition:=regexp_replace(definition,$pattern$\n +or position\(input.search_text in lower\(coalesce\(candidate.capacity_area_center_label,''\)\)\)>0$pattern$,'','g');
    has_public_projection:=strpos(definition,$old$'availability_geometry',case when visibility='OPEN' then availability_geometry end,$old$)>0;
    if has_public_projection then
      definition:=pg_temp.capacity_journey_replace(definition,$old$'availability_geometry',case when visibility='OPEN' then availability_geometry end,$old$,$new$'availability_geometry',case when visibility='OPEN' and availability_geometry='ROUTE' then availability_geometry end,
  'journey_start_at',case when journey_start_at is not null and visibility='OPEN' and availability_geometry='ROUTE' and updated_at>=public.provider_capacity_pair_started_at(vehicle_id) then journey_start_at end,
  'journey_end_at',case when journey_end_at is not null and visibility='OPEN' and availability_geometry='ROUTE' and updated_at>=public.provider_capacity_pair_started_at(vehicle_id) then journey_end_at end,$new$);
      definition:=regexp_replace(definition,$pattern$case when visibility='OPEN' then capacity_area_center_[a-z_]+ end$pattern$,'null::text','g');
      definition:=replace(definition,$old$case when visibility='OPEN' then capacity_area_boundary_json else '[]'::jsonb end$old$,$new$'[]'::jsonb$new$);
    end if;
    execute definition;
  end loop;

  foreach target in array array[
    'public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)'::regprocedure,
    'public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure,
    'public.provider_capacity_workspace(uuid)'::regprocedure
  ] loop
    definition:=pg_get_functiondef(target);
    definition:=pg_temp.capacity_journey_replace(definition,$old$'availability_geometry',capacity.availability_geometry,$old$,$new$'availability_geometry',case when capacity.availability_geometry='ROUTE' then capacity.availability_geometry end,
    'journey_start_at',case when capacity.journey_start_at is not null and capacity.availability_geometry='ROUTE' and capacity.updated_at>=public.provider_capacity_pair_started_at(capacity.vehicle_id) then capacity.journey_start_at end,
    'journey_end_at',case when capacity.journey_end_at is not null and capacity.availability_geometry='ROUTE' and capacity.updated_at>=public.provider_capacity_pair_started_at(capacity.vehicle_id) then capacity.journey_end_at end,$new$);
    definition:=regexp_replace(definition,$pattern$('capacity_area_center_[a-z_]+'),capacity\.capacity_area_center_[a-z_]+$pattern$,'\1,null::text','g');
    definition:=pg_temp.capacity_journey_replace(definition,$old$'capacity_area_boundary',capacity.capacity_area_boundary_json,$old$,$new$'capacity_area_boundary','[]'::jsonb,$new$);
    execute definition;
  end loop;

  definition:=pg_get_functiondef('public.capacity_payload_matches(jsonb,jsonb)'::regprocedure);
  definition:=pg_temp.capacity_journey_replace(definition,E'\nbegin\n',$new$
begin
 if item->>'availability_geometry'='RADIUS' then
   item:=item-'availability_geometry'-'capacity_area_boundary'
     -'capacity_area_center_place_ref'-'capacity_area_center_label'-'capacity_area_center_lat'-'capacity_area_center_lng';
 end if;
 if not public.capacity_journey_matches(
   case when coalesce((item->>'current_signal_geometry_visible')::boolean,true) then item->>'availability_geometry' end,
   item->'current_route_points',(item->>'journey_start_at')::timestamptz,(item->>'journey_end_at')::timestamptz,query
 ) then return false;end if;
$new$);
  execute definition;
end $reads$;

commit;
