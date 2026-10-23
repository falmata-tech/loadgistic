-- FEAT-LST-001 / FEAT-MAT-001: filter authorized data before cursor pagination.
-- Existing audience authorization and public field minimization are retained.
create function public.capacity_viewport_matches(item jsonb, query jsonb)
returns boolean language plpgsql immutable set search_path=public,extensions,pg_temp as $$
declare viewport geometry; signal jsonb;
begin
 if not query ? 'viewport' then return true;end if;
 if jsonb_typeof(query->'viewport')<>'array' or jsonb_array_length(query->'viewport')<>4 then return false;end if;
 viewport:=st_makeenvelope((query->'viewport'->>0)::double precision,(query->'viewport'->>1)::double precision,
  (query->'viewport'->>2)::double precision,(query->'viewport'->>3)::double precision,4326);
 if coalesce(st_dwithin(viewport::geography,st_setsrid(st_makepoint((item->>'location_lng')::double precision,(item->>'location_lat')::double precision),4326)::geography,
  coalesce((item->>'location_precision_km')::double precision,20)*1000),false) then return true;end if;
 if coalesce(st_intersects(viewport,public.capacity_route_line(item->'current_route_points')),false)
   or coalesce(st_intersects(viewport,public.capacity_area_polygon(item->'capacity_area_boundary')),false) then return true;end if;
 for signal in select value from jsonb_array_elements(coalesce(item->'recurring_corridors','[]'::jsonb)) loop
  if coalesce(st_intersects(viewport,public.capacity_route_line(signal->'route_points')),false)
    or coalesce(st_intersects(viewport,public.capacity_area_polygon(signal->'area_boundary')),false) then return true;end if;
 end loop;
 return false;
end $$;

create function public.capacity_payload_matches(item jsonb, query jsonb)
returns boolean language plpgsql stable set search_path=public,extensions,pg_temp as $$
declare
 signal jsonb; signals jsonb:=coalesce(item->'recurring_corridors','[]'::jsonb);
 geometry_filter text:=nullif(upper(query->>'geometry'),'');
 origin_lat double precision:=(query->>'origin_lat')::double precision;
 origin_lng double precision:=(query->>'origin_lng')::double precision;
 destination_lat double precision:=(query->>'destination_lat')::double precision;
 destination_lng double precision:=(query->>'destination_lng')::double precision;
 area_lat double precision:=(query->>'area_lat')::double precision;
 area_lng double precision:=(query->>'area_lng')::double precision;
 origin_radius double precision:=coalesce((query->>'origin_radius_km')::double precision,50);
 destination_radius double precision:=coalesce((query->>'destination_radius_km')::double precision,50);
 area_radius double precision:=coalesce((query->>'area_radius_km')::double precision,50);
 endpoints_match boolean:=origin_lat is null and destination_lat is null;
 area_match boolean:=area_lat is null;
 geometry_match boolean:=geometry_filter is null;
 search_text text:=nullif(lower(trim(query->>'q')),'');
 search_document text;
begin
 if nullif(query->>'capacity_id','') is not null and item->>'id'<>query->>'capacity_id' then return false;end if;
 if nullif(query->>'provider','') is not null and lower(item->>'provider_handle')<>lower(query->>'provider') then return false;end if;
 if nullif(query->>'status','') is not null and item->>'status'<>upper(query->>'status') then return false;end if;
 if item->>'status'='PARTIAL' and geometry_filter='RADIUS' then return false;end if;
 if nullif(query->>'vehicle_category','') is not null and item->>'cargo_configuration'<>query->>'vehicle_category' then return false;end if;
 if query->>'load_type'='FTL' and not coalesce((item->>'accepts_full_load')::boolean,false) then return false;end if;
 if query->>'load_type'='PTL' and not coalesce((item->>'accepts_partial_load')::boolean,false) then return false;end if;
 if query->>'stop_option'='MULTI_PICK' and not coalesce((item->>'accepts_multi_pick')::boolean,false) then return false;end if;
 if query->>'stop_option'='MULTI_DROP' and not coalesce((item->>'accepts_multi_drop')::boolean,false) then return false;end if;
 if query->>'freshness'='FRESH' and (item->>'updated_at')::timestamptz<now()-interval '12 hours' then return false;end if;
 if query->>'freshness'='UPDATE_NEEDED' and (item->>'updated_at')::timestamptz>=now()-interval '12 hours' then return false;end if;
 -- Search only the same display fields and geometry labels as the private map.
 search_document:=concat_ws(' ',item->>'provider_name',item->>'provider_handle',item->>'platform_number',
  item->>'vehicle_make',item->>'vehicle_model',item->>'cargo_configuration',item->>'location_area',item->>'capacity_area_center_label');
 select concat_ws(' ',search_document,string_agg(point->>'label',' ')) into search_document
 from jsonb_array_elements(coalesce(item->'current_route_points','[]'::jsonb)||coalesce(item->'capacity_area_boundary','[]'::jsonb)) point;
 for signal in select value from jsonb_array_elements(signals) loop
  select concat_ws(' ',search_document,signal->>'area_center_label',string_agg(point->>'label',' ')) into search_document
  from jsonb_array_elements(coalesce(signal->'route_points','[]'::jsonb)||coalesce(signal->'area_boundary','[]'::jsonb)) point;
 end loop;
 if search_text is not null and position(search_text in lower(search_document))=0 then return false;end if;
 signals:=signals||jsonb_build_array(jsonb_build_object('geometry',item->>'availability_geometry',
  'route_points',item->'current_route_points','area_boundary',item->'capacity_area_boundary','current',true));
 for signal in select value from jsonb_array_elements(signals) loop
  if geometry_filter is not null and signal->>'geometry' is distinct from geometry_filter then continue;end if;
  geometry_match:=true;
  if signal->>'geometry'='ROUTE' then
   if origin_lat is not null and destination_lat is not null then
    endpoints_match:=endpoints_match or public.capacity_route_matches(signal->'route_points',origin_lat,origin_lng,destination_lat,destination_lng,
      origin_radius,destination_radius,case when signal->>'current'='true' then coalesce(query->>'direction_mode','DIRECT') else 'EITHER' end);
   elsif origin_lat is not null or destination_lat is not null then
    endpoints_match:=endpoints_match or public.capacity_route_point_matches(signal->'route_points',coalesce(origin_lat,destination_lat),coalesce(origin_lng,destination_lng),
      case when origin_lat is not null then origin_radius else destination_radius end);
   end if;
  elsif signal->>'geometry'='RADIUS' and item->>'status'='EMPTY' then
   endpoints_match:=endpoints_match or (
    (origin_lat is null or public.capacity_area_matches(signal->'area_boundary',origin_lat,origin_lng,origin_radius)) and
    (destination_lat is null or public.capacity_area_matches(signal->'area_boundary',destination_lat,destination_lng,destination_radius)));
   area_match:=area_match or public.capacity_area_matches(signal->'area_boundary',area_lat,area_lng,area_radius);
  end if;
 end loop;
 if not coalesce(geometry_match and endpoints_match and area_match,false) then return false;end if;
 if query->>'near_lat' is not null and not coalesce(st_dwithin(
  st_setsrid(st_makepoint((query->>'near_lng')::double precision,(query->>'near_lat')::double precision),4326)::geography,
  st_setsrid(st_makepoint((item->>'location_lng')::double precision,(item->>'location_lat')::double precision),4326)::geography,
  (coalesce((query->>'near_radius_km')::double precision,20)+coalesce((item->>'location_precision_km')::double precision,20)+1)*1000),false) then return false;end if;
 return public.capacity_viewport_matches(item,query);
end $$;

-- Derive the new projection from the installed authorized private projection.
-- No copy of the grant or staff-permission rules can silently become stale.
do $migration$
declare definition text; body text; start_at integer; end_at integer;
begin
 select prosrc into body from pg_proc where oid='public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer)'::regprocedure;
 end_at:=position(E'  order by capacity.updated_at desc,capacity.id desc\n' in body);
 if end_at=0 or position('public.capacity_active_driver_id(vehicle.id)' in body)=0 then raise exception 'PRIVATE_CAPACITY_FILTER_CONTRACT_NOT_FOUND';end if;
 body:=left(body,end_at-1);
 definition:='create function public.private_capacity_filtered_page(requested_audience text,requested_digest text,actor_user_id uuid,cursor_updated_at timestamptz,cursor_id uuid,requested_page_size integer,query jsonb) returns table(payload jsonb) language sql stable security definer set search_path=public,extensions,pg_temp as '
 ||quote_literal('with authorized_projection as ('||body||') select payload from authorized_projection where public.capacity_payload_matches(payload,query) order by (payload->>''updated_at'')::timestamptz desc,(payload->>''id'')::uuid desc limit greatest(2,least(coalesce(requested_page_size,100),100)+1)');
 execute definition;
 definition:=pg_get_functiondef('public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure);
 if position('  where candidate.visibility=''OPEN''' in definition)=0 then raise exception 'PUBLIC_CAPACITY_VIEWPORT_CONTRACT_NOT_FOUND';end if;
 execute replace(definition,'  where candidate.visibility=''OPEN''',
  '  where candidate.visibility=''OPEN'' and public.capacity_viewport_matches(jsonb_build_object(''location_lat'',candidate.location_lat,''location_lng'',candidate.location_lng,''location_precision_km'',candidate.location_precision_km,''current_route_points'',candidate.current_route_points_json,''capacity_area_boundary'',candidate.capacity_area_boundary_json,''recurring_corridors'',candidate.recurring_corridors),query)');
end $migration$;
revoke all on function public.capacity_payload_matches(jsonb,jsonb),public.capacity_viewport_matches(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb) to service_role;
revoke all on function public.public_capacity_page(jsonb,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.public_capacity_page(jsonb,timestamptz,uuid,integer) to service_role;

-- Choose a representative point on actual visible evidence, not an unrelated
-- clamped current position when only a distant route crosses the viewport.
create function public.capacity_viewport_anchor(item jsonb,query jsonb)
returns geometry language plpgsql immutable set search_path=public,extensions,pg_temp as $$
declare bounds geometry:=st_makeenvelope((query->'viewport'->>0)::float8,(query->'viewport'->>1)::float8,(query->'viewport'->>2)::float8,(query->'viewport'->>3)::float8,4326);
 point geometry:=st_setsrid(st_makepoint((item->>'location_lng')::float8,(item->>'location_lat')::float8),4326);
 signal jsonb; shape geometry;
begin
 if coalesce(st_dwithin(bounds::geography,point::geography,coalesce((item->>'location_precision_km')::float8,20)*1000),false) then return st_closestpoint(bounds,point);end if;
 for signal in select value from jsonb_array_elements(coalesce(item->'recurring_corridors','[]'::jsonb)||jsonb_build_array(jsonb_build_object('route_points',item->'current_route_points','area_boundary',item->'capacity_area_boundary'))) loop
  foreach shape in array array[public.capacity_route_line(signal->'route_points'),public.capacity_area_polygon(signal->'area_boundary')] loop
   if coalesce(st_intersects(bounds,shape),false) then return st_pointonsurface(st_intersection(bounds,shape));end if;
  end loop;
 end loop;
 return null;
end $$;
revoke all on function public.capacity_viewport_anchor(jsonb,jsonb) from public,anon,authenticated;

-- Overview cells aggregate the same fully filtered public candidates. The grid
-- uses world coordinates and a power-of-two cell size, so panning does not
-- renumber cells. At most 9 x 9 x 2 status cells intersect the requested bounds.
do $migration$
declare body text; end_at integer; definition text;
begin
 select prosrc into body from pg_proc where oid='public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure;
 end_at:=position('), bounded_base as (' in body);
 if end_at=0 or position('public.capacity_viewport_matches' in body)=0 then raise exception 'PUBLIC_CLUSTER_CONTRACT_NOT_FOUND';end if;
 body:=left(body,end_at-1)||$query$
), grid as (
 select st_makeenvelope((query->'viewport'->>0)::float8,(query->'viewport'->>1)::float8,(query->'viewport'->>2)::float8,(query->'viewport'->>3)::float8,4326) as bounds,
 power(2::float8,ceil(log(2::numeric,greatest(((query->'viewport'->>2)::numeric-(query->'viewport'->>0)::numeric),((query->'viewport'->>3)::numeric-(query->'viewport'->>1)::numeric))/8))) as size
 where query ? 'viewport'
), locations as (
 select candidate.id,coalesce(candidate.market_status,candidate.status::text) as status,grid.size,
 public.capacity_viewport_anchor(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,
  'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,
  'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query) as anchor
 from filtered candidate cross join grid
), cells as (
 select status,size,floor(st_x(anchor)/size) as x,floor(st_y(anchor)/size) as y,count(*) as count,
 avg(st_x(anchor)) as lng,avg(st_y(anchor)) as lat
 from locations where anchor is not null group by status,size,floor(st_x(anchor)/size),floor(st_y(anchor)/size)
)
select jsonb_build_object('id',status||':'||size||':'||x||':'||y,'status',status,'count',count,'lat',lat,'lng',lng,
 'bounds',jsonb_build_array(x*size,y*size,(x+1)*size,(y+1)*size)) as payload
from cells order by y,x,status limit 200
$query$;
 definition:='create function public.public_capacity_clusters(query jsonb,cursor_updated_at timestamptz default null,cursor_id uuid default null,requested_page_size integer default 14) returns table(payload jsonb) language sql stable security definer set search_path=public,extensions,pg_temp as '||quote_literal(body);
 execute definition;
end $migration$;
revoke all on function public.public_capacity_clusters(jsonb,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.public_capacity_clusters(jsonb,timestamptz,uuid,integer) to service_role;

-- Precompute coarse spatial bounds once per capacity/regular-signal write.
-- Exact predicates still decide matches; conservative envelopes never authorize
-- a row or substitute for latest-state selection.
create function public.capacity_map_envelope(lat float8,lng float8,precision_km float8,route_points jsonb,area_points jsonb)
returns geometry language sql immutable set search_path=public,extensions,pg_temp as $$
 select st_envelope(st_collect(array[
  st_buffer(st_setsrid(st_makepoint(lng,lat),4326)::geography,(coalesce(precision_km,20)+1)*1000)::geometry,
  public.capacity_route_line(route_points),public.capacity_area_polygon(area_points)]))
$$;
create function public.capacity_viewport_envelope(query jsonb)
returns geometry language sql immutable set search_path=public,extensions,pg_temp as $$
 select case when query ? 'viewport' then st_makeenvelope((query->'viewport'->>0)::float8,(query->'viewport'->>1)::float8,
 (query->'viewport'->>2)::float8,(query->'viewport'->>3)::float8,4326) end
$$;
alter table public.capacities add column map_envelope geometry generated always as
 (public.capacity_map_envelope(location_lat,location_lng,location_precision_km,current_route_points_json,capacity_area_boundary_json)) stored;
alter table public.profile_routes add column map_envelope geometry generated always as
 (public.capacity_map_envelope(null,null,null,route_points_json,area_boundary_json)) stored;
create index capacity_map_envelope_idx on public.capacities using gist(map_envelope);
create index regular_map_envelope_idx on public.profile_routes using gist(map_envelope);
revoke all on function public.capacity_map_envelope(float8,float8,float8,jsonb,jsonb),public.capacity_viewport_envelope(jsonb) from public,anon,authenticated;
-- Server-side imports also evaluate the stored-column expression.
grant execute on function public.capacity_map_envelope(float8,float8,float8,jsonb,jsonb) to service_role;

do $migration$
declare definition text; signature text;
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamptz,uuid,integer)','public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('capacity.*,vehicle.platform_number' in definition)=0 or position('  where candidate.visibility=''OPEN''' in definition)=0 then raise exception 'PUBLIC_SPATIAL_ENVELOPE_CONTRACT_NOT_FOUND';end if;
  definition:=replace(definition,'capacity.*,vehicle.platform_number','capacity.*,regular.map_envelope as regular_map_envelope,vehicle.platform_number');
  definition:=replace(definition,'  where candidate.visibility=''OPEN''',
   '  where candidate.visibility=''OPEN'' and (not (query ? ''viewport'') or candidate.map_envelope && public.capacity_viewport_envelope(query) or candidate.regular_map_envelope && public.capacity_viewport_envelope(query))');
  execute definition;
 end loop;
 definition:=pg_get_functiondef('public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 if position('  where capacity.latest_position=1' in definition)=0 then raise exception 'PRIVATE_SPATIAL_ENVELOPE_CONTRACT_NOT_FOUND';end if;
 execute replace(definition,'  where capacity.latest_position=1',
  '  where capacity.latest_position=1 and (not (query ? ''viewport'') or capacity.map_envelope && public.capacity_viewport_envelope(query) or regular.map_envelope && public.capacity_viewport_envelope(query))');
end $migration$;
