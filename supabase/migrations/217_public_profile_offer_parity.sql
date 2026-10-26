-- FEAT-CAP-001 / FEAT-GEO-001: apply211/213 offer eligibility to public profiles.
-- Keep216 input projection, complete-offer endpoints and all other filters exact.
begin;
select pg_advisory_xact_lock(8030217);
set local lock_timeout='5s';set local statement_timeout='30s';
create temporary table capacity217_function_metadata on commit drop as
 select oid,md5(prosrc) as source,proowner,prosecdef,provolatile,proconfig,proacl
 from pg_proc where oid=any(array[
 'public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.capacity_search_results_public_fast(jsonb,integer)'::regprocedure,
 'public.capacity_search_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_published_source_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_search_metadata(jsonb)'::regprocedure,
 'public.capacity_search_metadata_pre_social167(jsonb)'::regprocedure,
 'public.capacity_viewport_matches(jsonb,jsonb)'::regprocedure]);
do $offer217$
declare signature text;expected text;name text;arguments text;definition text;backup text;
 entry_oid oid;backup_oid oid;producer_oid oid;old_text text;new_text text;
begin
 -- These exact helper bodies consume only the five supplied fields. The
 -- search helper sets its own document flag before delegating to metadata.
 for signature,expected in select * from (values
  ('public.capacity_search_matches(jsonb,jsonb)','7a4ca944e31f1989d522e11d4f1d8f52'),
  ('public.capacity_published_source_matches(jsonb,jsonb)','d381d55a10814355517b351bbd01b9a7'),
  ('public.capacity_search_metadata(jsonb)','a5f3c9a8a0ebe7c996a4fc829bd9d902'),
  ('public.capacity_search_metadata_pre_social167(jsonb)','d3f3b5e8b88c2133a14c5beef5771164'),
  ('public.capacity_viewport_matches(jsonb,jsonb)','973a54d0b2acad2367931f8d7bf033ba')
 ) dependency(signature,expected) loop
  if (select md5(prosrc) from pg_proc where oid=signature::regprocedure) is distinct from expected
   then raise exception 'CAPACITY217_INPUT_CONTRACT_DRIFT: %',signature;end if;
 end loop;
 for name,arguments,expected in select * from (values
  ('capacity_search_public_profile_rows','jsonb,timestamptz,uuid,integer','c187cad2614e3eb7f953eadfe7c8546e'),
  ('capacity_search_results_public_fast','jsonb,integer','ae6155282f29ad40f599798657b4477a')
 ) target(name,arguments,expected) loop
  entry_oid:=('public.'||name||'('||arguments||')')::regprocedure;
  if (select md5(prosrc) from pg_proc where oid=entry_oid) is distinct from expected
   then raise exception 'CAPACITY217_ENTRY_SOURCE_DRIFT: %',name;end if;
  if to_regprocedure('public.'||name||'_pre_offer217('||arguments||')') is not null
   then raise exception 'CAPACITY217_REFERENCE_EXISTS: %',name;end if;
  definition:=pg_get_functiondef(entry_oid);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(')<>1
   then raise exception 'CAPACITY217_DECLARATION_DRIFT: %',name;end if;
  backup:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(',
   'CREATE OR REPLACE FUNCTION public.'||name||'_pre_offer217(');
  if name='capacity_search_results_public_fast' then
   if (length(backup)-length(replace(backup,'public.capacity_search_public_profile_rows(','')))
    /length('public.capacity_search_public_profile_rows(')<>1
    then raise exception 'CAPACITY217_REFERENCE_PRODUCER_DRIFT';end if;
   backup:=replace(backup,'public.capacity_search_public_profile_rows(',
    'public.capacity_search_public_profile_rows_pre_offer217(');
  end if;
  execute backup;
  backup_oid:=('public.'||name||'_pre_offer217('||arguments||')')::regprocedure;
  if exists(select 1 from pg_proc original join pg_proc saved on saved.oid=backup_oid
   where original.oid=entry_oid and (saved.proowner is distinct from original.proowner
    or saved.prosecdef is distinct from original.prosecdef or saved.provolatile is distinct from original.provolatile
    or saved.proconfig is distinct from original.proconfig))
   then raise exception 'CAPACITY217_REFERENCE_AUTHORITY_DRIFT';end if;
  execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_oid::regprocedure);
 end loop;
 producer_oid:='public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure;
 definition:=pg_get_functiondef(producer_oid);
 --211 permits Partial Area offers for either current or Preferred coverage.
 old_text:=$old$    and (coalesce(candidate.market_status,candidate.status::text) is distinct from 'PARTIAL' or input.geometry is distinct from 'RADIUS')
$old$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'CAPACITY217_PARTIAL_GEOMETRY_ANCHOR_DRIFT';end if;
 definition:=replace(definition,old_text,'');
 old_text:=$old$coalesce(candidate.market_status,candidate.status::text)='EMPTY'$old$;new_text:=$new$coalesce(candidate.market_status,candidate.status::text) in ('EMPTY','PARTIAL')$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>7
  then raise exception 'CAPACITY217_AREA_STATUS_ANCHOR_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 --213 compares complete advertised routes and areas for Area queries.
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
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'CAPACITY217_AREA_ROUTE_ANCHOR_DRIFT';end if;
 execute replace(definition,old_text,new_text);
 if (select md5(prosrc) from pg_proc where oid=producer_oid)<>'ecbffcec23895388f73ad3955c3408fc'
  or (select count(*) from capacity217_function_metadata)<>7
  or exists(select 1 from capacity217_function_metadata saved join pg_proc current on current.oid=saved.oid
   where current.proowner is distinct from saved.proowner or current.prosecdef is distinct from saved.prosecdef
    or current.provolatile is distinct from saved.provolatile or current.proconfig is distinct from saved.proconfig
    or current.proacl is distinct from saved.proacl
    or current.oid<>producer_oid and md5(current.prosrc) is distinct from saved.source)
  then raise exception 'CAPACITY217_SOURCE_OR_AUTHORITY_READBACK_FAILED';end if;
end $offer217$;
notify pgrst,'reload schema';
commit;
