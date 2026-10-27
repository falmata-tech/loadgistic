-- FEAT-CAP-001 / FEAT-GEO-001: an Area search may meet a visible current or
-- Preferred route within its chosen radius, as well as a service area. The
-- existing route-line distance rule, audience, and explicit geometry gates stay.
begin;
select pg_advisory_xact_lock(8030213);
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=public,extensions,pg_temp;

create temporary table capacity213_function_metadata on commit drop as
select oid,proowner,prosecdef,provolatile,proconfig,proacl
from pg_proc where oid=any(array[
 'public.capacity_payload_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure
]);

do $patch$
declare signature text;source_hash text;definition text;old_text text;new_text text;actual_count integer;
begin
 for signature,source_hash in select * from (values
  ('public.capacity_payload_matches(jsonb,jsonb)','06c8bea1b9c475bc971762a8ca9fc9da'),
  ('public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)','4483bada2edf0cd2101e6a32d16ef969'),
  ('public.public_capacity_page(jsonb,timestamptz,uuid,integer)','ad76dd163ced84e597546638089844eb'),
  ('public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)','aab94400cf9e2a16b621977e76c2bff6')
 ) source(signature,source_hash) loop
  if (select md5(prosrc) from pg_proc where oid=signature::regprocedure) is distinct from source_hash
   then raise exception 'CAPACITY213_FUNCTION_SOURCE_DRIFT: %',signature;end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  if signature='public.capacity_payload_matches(jsonb,jsonb)' then
   old_text:=$old$   end if;
  elsif signal->>'geometry'='RADIUS' and item->>'status' in ('EMPTY','PARTIAL') then
$old$;
   new_text:=$new$   end if;
   if item->>'status' in ('EMPTY','PARTIAL') then
    area_match:=area_match or public.capacity_route_point_matches(signal->'route_points',area_lat,area_lng,area_radius);
   end if;
  elsif signal->>'geometry'='RADIUS' and item->>'status' in ('EMPTY','PARTIAL') then
$new$;
  else
   old_text:=$old$    and (input.area_lat is null or coalesce(candidate.market_status,candidate.status::text) in ('EMPTY','PARTIAL') and (
      candidate.visibility='OPEN' and candidate.availability_geometry='RADIUS'
        and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.area_lat,input.area_lng,input.area_radius_km)
      or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where signal->>'geometry'='RADIUS'
        and public.capacity_area_matches(signal->'area_boundary',input.area_lat,input.area_lng,input.area_radius_km))))
$old$;
   new_text:=$new$    and (input.area_lat is null or coalesce(candidate.market_status,candidate.status::text) in ('EMPTY','PARTIAL') and (
      candidate.visibility='OPEN' and (
        (input.geometry is null or input.geometry='RADIUS') and candidate.availability_geometry='RADIUS'
          and public.capacity_area_matches(candidate.capacity_area_boundary_json,input.area_lat,input.area_lng,input.area_radius_km)
        or (input.geometry is null or input.geometry='ROUTE') and candidate.availability_geometry='ROUTE'
          and public.capacity_route_point_matches(candidate.current_route_points_json,input.area_lat,input.area_lng,input.area_radius_km))
      or exists(select 1 from jsonb_array_elements(candidate.recurring_corridors) signal where
        (input.geometry is null or input.geometry='RADIUS') and signal->>'geometry'='RADIUS'
          and public.capacity_area_matches(signal->'area_boundary',input.area_lat,input.area_lng,input.area_radius_km)
        or (input.geometry is null or input.geometry='ROUTE') and signal->>'geometry'='ROUTE'
          and public.capacity_route_point_matches(signal->'route_points',input.area_lat,input.area_lng,input.area_radius_km))))
$new$;
  end if;
  actual_count:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
  if actual_count<>1 then raise exception 'CAPACITY213_AREA_ANCHOR_DRIFT: % / %',signature,actual_count;end if;
  execute replace(definition,old_text,new_text);
 end loop;
 if (select count(*) from capacity213_function_metadata)<>4
  or exists(select 1 from capacity213_function_metadata saved
    join pg_proc current on current.oid=saved.oid
    where current.proowner is distinct from saved.proowner
      or current.prosecdef is distinct from saved.prosecdef
      or current.provolatile is distinct from saved.provolatile
      or current.proconfig is distinct from saved.proconfig
      or current.proacl is distinct from saved.proacl)
 then raise exception 'CAPACITY213_FUNCTION_AUTHORITY_DRIFT';end if;
end $patch$;

notify pgrst,'reload schema';
commit;
