-- FEAT-MKT-001 / FEAT-CAP-001: shared eligibility and complete geometry.
-- Reuse installed PostGIS and pg_trgm; no remote AI, new extension or recipient exposure.
create function public.capacity_geometry_vertices_valid(points jsonb,minimum_points integer) returns boolean
language plpgsql immutable strict set search_path=public,extensions,pg_temp as $$
declare vertex jsonb;latitude float8;longitude float8;
begin
 if jsonb_typeof(points) is distinct from 'array' or minimum_points not in (2,3)
 or jsonb_array_length(points)<minimum_points or jsonb_array_length(points)>1000 then return false;end if;
 for vertex in select value from jsonb_array_elements(points) loop
  if jsonb_typeof(vertex) is distinct from 'object' or jsonb_typeof(vertex->'lat') is distinct from 'number'
   or jsonb_typeof(vertex->'lng') is distinct from 'number' then return false;end if;
  latitude:=(vertex->>'lat')::float8;longitude:=(vertex->>'lng')::float8;
  if latitude not between -90 and 90 or longitude not between -180 and 180 then return false;end if;
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;
revoke all on function public.capacity_geometry_vertices_valid(jsonb,integer) from public,anon,authenticated;
grant execute on function public.capacity_geometry_vertices_valid(jsonb,integer) to service_role;

do $migration$
declare signature text;definition text;before_text text;after_text text;
begin
signature:='capacity_route_line(jsonb)';before_text:=$before$
declare
  line geometry;
begin
  if jsonb_typeof(points)<>'array' or jsonb_array_length(points)<2 then return null; end if;
  select st_makeline(array_agg(st_setsrid(st_makepoint(
    (point.value->>'lng')::double precision,
    (point.value->>'lat')::double precision
  ),4326) order by point.position))
  into line
  from jsonb_array_elements(points) with ordinality point(value,position)
  where point.value ? 'lat' and point.value ? 'lng';
  if line is null or st_npoints(line)<2 then return null; end if;
  return line;
exception when others then
  return null;
end;
$before$;after_text:=$after$
declare line geometry;
begin
 if not public.capacity_geometry_vertices_valid(points,2) then return null;end if;
 select st_makeline(array_agg(st_setsrid(st_makepoint((p.value->>'lng')::float8,(p.value->>'lat')::float8),4326) order by p.position))
 into line from jsonb_array_elements(points) with ordinality p(value,position);
 if line is null or st_npoints(line)<>jsonb_array_length(points) or st_length(line)=0 then return null;end if;
 return line;
exception when others then return null;
end;
$after$;
definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'LAUNCH_MATCHING_FUNCTION_DRIFT: %',signature;end if;
execute replace(definition,before_text,after_text);
signature:='capacity_area_polygon(jsonb)';before_text:=$before$
declare
  polygon geometry;
begin
  if jsonb_typeof(points)<>'array' or jsonb_array_length(points)<3 then return null; end if;
  with parsed as (
    select array_agg(st_setsrid(st_makepoint(
      (point.value->>'lng')::double precision,
      (point.value->>'lat')::double precision
    ),4326) order by point.position) as vertices
    from jsonb_array_elements(points) with ordinality point(value,position)
    where point.value ? 'lat' and point.value ? 'lng'
  )
  select st_makepolygon(st_makeline(array_append(vertices,vertices[1]))) into polygon
  from parsed where array_length(vertices,1)>=3;
  if polygon is null or st_isempty(polygon) then return null; end if;
  return polygon;
exception when others then
  return null;
end;
$before$;after_text:=$after$
declare polygon geometry;
begin
 if not public.capacity_geometry_vertices_valid(points,3) then return null;end if;
 with parsed as(select array_agg(st_setsrid(st_makepoint((p.value->>'lng')::float8,(p.value->>'lat')::float8),4326) order by p.position) vertices
 from jsonb_array_elements(points) with ordinality p(value,position))
 select st_makepolygon(st_makeline(array_append(vertices,vertices[1]))) into polygon from parsed;
 -- Flag overload suppresses invalidity NOTICEs, which can disclose submitted coordinates.
 if polygon is null or st_isempty(polygon) or not st_isvalid(polygon,0) or st_area(polygon)=0 then return null;end if;
 return polygon;
exception when others then return null;
end;
$after$;
definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'LAUNCH_MATCHING_FUNCTION_DRIFT: %',signature;end if;
execute replace(definition,before_text,after_text);
signature:='capacity_route_matches(jsonb,double precision,double precision,double precision,double precision,double precision,double precision,text)';before_text:=$before$
declare
  line geometry:=public.capacity_route_line(points);
  origin_point geometry:=st_setsrid(st_makepoint(origin_lng,origin_lat),4326);
  destination_point geometry:=st_setsrid(st_makepoint(destination_lng,destination_lat),4326);
begin
  if line is null then return false; end if;
  if not st_dwithin(line::geography,origin_point::geography,greatest(1,least(coalesce(origin_radius_km,50),500))*1000)
    or not st_dwithin(line::geography,destination_point::geography,greatest(1,least(coalesce(destination_radius_km,50),500))*1000)
  then return false; end if;
  return upper(coalesce(direction_mode,'DIRECT'))='EITHER'
    or st_linelocatepoint(line,origin_point)<=st_linelocatepoint(line,destination_point);
end;
$before$;after_text:=$after$
declare line geometry:=public.capacity_route_line(points);origin_point geometry;destination_point geometry;
 pickup_segment geometry;delivery_segment geometry;i integer;j integer;
 pickup_radius float8:=greatest(1,least(coalesce(origin_radius_km,50),500))*1000;
 delivery_radius float8:=greatest(1,least(coalesce(destination_radius_km,50),500))*1000;
begin
 if line is null or origin_lat is null or origin_lng is null or destination_lat is null or destination_lng is null
 or origin_lat not between -90 and 90 or destination_lat not between -90 and 90
 or origin_lng not between -180 and 180 or destination_lng not between -180 and 180 then return false;end if;
 origin_point:=st_setsrid(st_makepoint(origin_lng,origin_lat),4326);destination_point:=st_setsrid(st_makepoint(destination_lng,destination_lat),4326);
 if not st_dwithin(line::geography,origin_point::geography,pickup_radius) or not st_dwithin(line::geography,destination_point::geography,delivery_radius) then return false;end if;
 if upper(coalesce(direction_mode,'DIRECT'))='EITHER' then return true;end if;
 -- Whole-line nearest-point lookup loses later visits at crossings/returning legs.
 -- Compare every qualifying occurrence while retaining one connected ordered route.
 for i in 1..st_npoints(line)-1 loop
  pickup_segment:=st_makeline(st_pointn(line,i),st_pointn(line,i+1));
  if st_length(pickup_segment)=0 or not st_dwithin(pickup_segment::geography,origin_point::geography,pickup_radius) then continue;end if;
  for j in i..st_npoints(line)-1 loop
   delivery_segment:=st_makeline(st_pointn(line,j),st_pointn(line,j+1));
   if st_length(delivery_segment)=0 or not st_dwithin(delivery_segment::geography,destination_point::geography,delivery_radius) then continue;end if;
   if j>i or st_linelocatepoint(pickup_segment,origin_point)<=st_linelocatepoint(delivery_segment,destination_point)+0.000001 then return true;end if;
  end loop;
 end loop;return false;
end;
$after$;
definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'LAUNCH_MATCHING_FUNCTION_DRIFT: %',signature;end if;
execute replace(definition,before_text,after_text);
signature:='capacity_route_point_matches(jsonb,double precision,double precision,double precision)';before_text:=$before$
  select coalesce(st_dwithin(
    public.capacity_route_line(points)::geography,
    st_setsrid(st_makepoint(point_lng,point_lat),4326)::geography,
    greatest(1,least(coalesce(radius_km,50),500))*1000
  ),false)
$before$;after_text:=$after$
select case when point_lat is null or point_lng is null or point_lat not between -90 and 90 or point_lng not between -180 and 180 then false else coalesce(st_dwithin(
 public.capacity_route_line(points)::geography,st_setsrid(st_makepoint(point_lng,point_lat),4326)::geography,
 greatest(1,least(coalesce(radius_km,50),500))*1000),false) end
$after$;
definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'LAUNCH_MATCHING_FUNCTION_DRIFT: %',signature;end if;
execute replace(definition,before_text,after_text);
signature:='capacity_area_matches(jsonb,double precision,double precision,double precision)';before_text:=$before$  if polygon is null then return false; end if;$before$;after_text:=$after$  if polygon is null or point_lat is null or point_lng is null or point_lat not between -90 and 90 or point_lng not between -180 and 180 then return false; end if;$after$;
definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'LAUNCH_MATCHING_FUNCTION_DRIFT: %',signature;end if;
execute replace(definition,before_text,after_text);
signature:='publish_provider_capacity(uuid,jsonb)';before_text:=$before$area_boundary:=public.provider_capacity_place_points(command->'capacity_area_boundary_places',3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED');$before$;after_text:=$after$area_boundary:=public.provider_capacity_place_points(command->'capacity_area_boundary_places',3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED');
    if public.capacity_area_polygon(area_boundary) is null then raise exception 'CAPACITY_AREA_BOUNDARY_INVALID';end if;$after$;
definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'LAUNCH_MATCHING_FUNCTION_DRIFT: %',signature;end if;
execute replace(definition,before_text,after_text);
signature:='add_provider_regular_capacity(uuid,jsonb)';before_text:=$before$area_boundary:=public.provider_capacity_place_points(command->'area_boundary_places',3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED');$before$;after_text:=$after$area_boundary:=public.provider_capacity_place_points(command->'area_boundary_places',3,5,'CAPACITY_AREA_BOUNDARY_REQUIRED');
    if public.capacity_area_polygon(area_boundary) is null then raise exception 'CAPACITY_AREA_BOUNDARY_INVALID';end if;$after$;
definition:=pg_get_functiondef(('public.'||signature)::regprocedure);
if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'LAUNCH_MATCHING_FUNCTION_DRIFT: %',signature;end if;
execute replace(definition,before_text,after_text);
end;
$migration$;
