-- FEAT-CAP-001 / FEAT-MKT-001: narrow only the profile search-helper input.
-- Full candidates remain available to every eligibility/geometry predicate.
begin;
select pg_advisory_xact_lock(8030216);
set local lock_timeout='5s';set local statement_timeout='30s';
create temporary table capacity216_function_metadata on commit drop as
 select oid,md5(prosrc) as source,proowner,prosecdef,provolatile,proconfig,proacl
 from pg_proc where oid=any(array[
 'public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.capacity_search_results_public_fast(jsonb,integer)'::regprocedure,
 'public.capacity_search_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_published_source_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_search_metadata(jsonb)'::regprocedure,
 'public.capacity_search_metadata_pre_social167(jsonb)'::regprocedure,
 'public.capacity_viewport_matches(jsonb,jsonb)'::regprocedure]);
do $input216$
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
   then raise exception 'CAPACITY216_INPUT_CONTRACT_DRIFT: %',signature;end if;
 end loop;
 for name,arguments,expected in select * from (values
  ('capacity_search_public_profile_rows','jsonb,timestamptz,uuid,integer','89b1cb4430aec176be909877244846c8'),
  ('capacity_search_results_public_fast','jsonb,integer','ae6155282f29ad40f599798657b4477a')
 ) target(name,arguments,expected) loop
  entry_oid:=('public.'||name||'('||arguments||')')::regprocedure;
  if (select md5(prosrc) from pg_proc where oid=entry_oid) is distinct from expected
   then raise exception 'CAPACITY216_ENTRY_SOURCE_DRIFT: %',name;end if;
  if to_regprocedure('public.'||name||'_pre_input216('||arguments||')') is not null
   then raise exception 'CAPACITY216_REFERENCE_EXISTS: %',name;end if;
  definition:=pg_get_functiondef(entry_oid);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(')<>1
   then raise exception 'CAPACITY216_DECLARATION_DRIFT: %',name;end if;
  backup:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(',
   'CREATE OR REPLACE FUNCTION public.'||name||'_pre_input216(');
  if name='capacity_search_results_public_fast' then
   if (length(backup)-length(replace(backup,'public.capacity_search_public_profile_rows(','')))
    /length('public.capacity_search_public_profile_rows(')<>1
    then raise exception 'CAPACITY216_REFERENCE_PRODUCER_DRIFT';end if;
   backup:=replace(backup,'public.capacity_search_public_profile_rows(',
    'public.capacity_search_public_profile_rows_pre_input216(');
  end if;
  execute backup;
  backup_oid:=('public.'||name||'_pre_input216('||arguments||')')::regprocedure;
  if exists(select 1 from pg_proc original join pg_proc saved on saved.oid=backup_oid
   where original.oid=entry_oid and (saved.proowner is distinct from original.proowner
    or saved.prosecdef is distinct from original.prosecdef or saved.provolatile is distinct from original.provolatile
    or saved.proconfig is distinct from original.proconfig))
   then raise exception 'CAPACITY216_REFERENCE_AUTHORITY_DRIFT';end if;
  execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_oid::regprocedure);
 end loop;
 producer_oid:='public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure;
 definition:=pg_get_functiondef(producer_oid);
 old_text:=$old$public.capacity_search_matches(to_jsonb(candidate),query)$old$;
 new_text:=$new$public.capacity_search_matches(jsonb_build_object('location_source',candidate.location_source,'provider_handle',candidate.provider_handle,'provider_organization_id',candidate.provider_organization_id,'provider_profile_id',candidate.provider_profile_id,'vehicle_id',candidate.vehicle_id),query)$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'CAPACITY216_SEARCH_ANCHOR_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 -- The unchanged viewport helper accepts immediately when its key is absent.
 old_text:=$old$public.capacity_viewport_matches(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query)$old$;
 new_text:=$new$case when not (query ? 'viewport') then true else public.capacity_viewport_matches(jsonb_build_object('location_lat',candidate.location_lat,'location_lng',candidate.location_lng,'location_precision_km',candidate.location_precision_km,'current_route_points',candidate.current_route_points_json,'capacity_area_boundary',candidate.capacity_area_boundary_json,'recurring_corridors',candidate.recurring_corridors),query) end$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'CAPACITY216_VIEWPORT_ANCHOR_DRIFT';end if;
 execute replace(definition,old_text,new_text);
 if (select md5(prosrc) from pg_proc where oid=producer_oid)<>'c187cad2614e3eb7f953eadfe7c8546e'
  or (select count(*) from capacity216_function_metadata)<>7
  or exists(select 1 from capacity216_function_metadata saved join pg_proc current on current.oid=saved.oid
   where current.proowner is distinct from saved.proowner or current.prosecdef is distinct from saved.prosecdef
    or current.provolatile is distinct from saved.provolatile or current.proconfig is distinct from saved.proconfig
    or current.proacl is distinct from saved.proacl
    or current.oid<>producer_oid and md5(current.prosrc) is distinct from saved.source)
  then raise exception 'CAPACITY216_SOURCE_OR_AUTHORITY_READBACK_FAILED';end if;
end $input216$;
notify pgrst,'reload schema';
commit;
