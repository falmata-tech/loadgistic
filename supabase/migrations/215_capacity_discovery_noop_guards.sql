-- FEAT-CAP-001 / FEAT-MKT-001: avoid arguments for proven helper no-op branches.
-- Eligibility, cursor placement, geometry, output and helper authority stay exact.
begin;
select pg_advisory_xact_lock(8030215);
set local lock_timeout='5s';
set local statement_timeout='30s';

create temporary table capacity215_function_metadata on commit drop as
select oid,md5(prosrc) as source,proowner,prosecdef,provolatile,proconfig,proacl
from pg_proc where oid=any(array[
 'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.capacity_search_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_viewport_matches(jsonb,jsonb)'::regprocedure]);

do $guards$
declare definition text;old_text text;new_text text;entry_oid oid;backup_oid oid;
begin
 entry_oid:='public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure;
 if (select md5(prosrc) from pg_proc where oid=entry_oid)<>'f49e69113dc381ae07f4a7a6d21d92e9'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_matches(jsonb,jsonb)'::regprocedure)<>'7a4ca944e31f1989d522e11d4f1d8f52'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_viewport_matches(jsonb,jsonb)'::regprocedure)<>'973a54d0b2acad2367931f8d7bf033ba'
  then raise exception 'CAPACITY215_PAGE_OR_HELPER_SOURCE_DRIFT';end if;
 if to_regprocedure('public.public_capacity_page_pre_fast215(jsonb,timestamptz,uuid,integer)') is not null
  then raise exception 'CAPACITY215_REFERENCE_EXISTS';end if;
 definition:=pg_get_functiondef(entry_oid);
 if strpos(definition,'CREATE OR REPLACE FUNCTION public.public_capacity_page(')<>1
  then raise exception 'CAPACITY215_DECLARATION_DRIFT';end if;
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.public_capacity_page(',
  'CREATE OR REPLACE FUNCTION public.public_capacity_page_pre_fast215(');
 backup_oid:='public.public_capacity_page_pre_fast215(jsonb,timestamptz,uuid,integer)'::regprocedure;
 if exists(select 1 from pg_proc original join pg_proc saved on saved.oid=backup_oid
  where original.oid=entry_oid and (saved.proowner is distinct from original.proowner
   or saved.prosecdef is distinct from original.prosecdef or saved.provolatile is distinct from original.provolatile
   or saved.proconfig is distinct from original.proconfig))
  then raise exception 'CAPACITY215_REFERENCE_AUTHORITY_DRIFT';end if;
 revoke all on function public.public_capacity_page_pre_fast215(jsonb,timestamptz,uuid,integer)
  from public,anon,authenticated,service_role;

 -- Missing relevant keys is exactly the existing search helper's true branch.
 -- Present null/empty/malformed values still run that unchanged helper.
 old_text:=$old$public.capacity_search_matches(to_jsonb(candidate),query)$old$;
 new_text:=$new$case when not (query ?| array['location_source','blocked_handles','q','office_city','owner_docs','driver_docs','truck_docs']) then true else public.capacity_search_matches(to_jsonb(candidate),query) end$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'CAPACITY215_SEARCH_ANCHOR_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);

 -- The existing viewport helper returns true before reading item if absent.
 -- CASE keeps null queries and every present viewport on the original path.
 old_text:=$old$public.capacity_viewport_matches(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query)$old$;
 new_text:=$new$case when not (query ? 'viewport') then true else public.capacity_viewport_matches(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query) end$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'CAPACITY215_VIEWPORT_ANCHOR_DRIFT';end if;
 execute replace(definition,old_text,new_text);
 if (select md5(prosrc) from pg_proc where oid=entry_oid)<>'a0776d3970059a6c5ff25207a2e63f82'
  or (select count(*) from capacity215_function_metadata)<>3
  or exists(select 1 from capacity215_function_metadata saved join pg_proc current on current.oid=saved.oid
   where current.proowner is distinct from saved.proowner or current.prosecdef is distinct from saved.prosecdef
    or current.provolatile is distinct from saved.provolatile or current.proconfig is distinct from saved.proconfig
    or current.proacl is distinct from saved.proacl
    or current.oid<>entry_oid and md5(current.prosrc) is distinct from saved.source)
  then raise exception 'CAPACITY215_SOURCE_OR_AUTHORITY_READBACK_FAILED';end if;
end $guards$;
notify pgrst,'reload schema';
commit;
