-- FEAT-MKT-001 / FEAT-CAP-001 / NR-13. Resolve the same authoritative Driver
-- once per latest vehicle, before provider-scope joins can multiply lookups.
-- Keep the complete installed projection, filters, ordering, cursor and ACL.
begin;
select pg_advisory_xact_lock(8030179);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $map_driver_cache$
declare definition text;old_text text;new_text text;expected_count integer;
begin
 if to_regprocedure('public.public_capacity_page_pre_perf179(jsonb,timestamptz,uuid,integer)') is not null
  then raise exception 'PUBLIC_MAP_DRIVER_BACKUP_EXISTS';end if;
 if to_regprocedure('public.public_capacity_page_pre_perf178(jsonb,timestamptz,uuid,integer)') is null
  then raise exception 'PUBLIC_MAP_PROVIDER_COST_PREREQUISITE_REQUIRED';end if;
 definition:=pg_get_functiondef('public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure);
 if strpos(definition,'CREATE OR REPLACE FUNCTION public.public_capacity_page(')<>1
  or strpos(definition,'publishable_provider_scopes as materialized')=0
  or strpos(definition,'provider_names as materialized')=0
  or strpos(definition,'capacity_search_matches(to_jsonb(candidate),query)')=0
  or strpos(definition,'capacity_sharing_mode(candidate.vehicle_id)')=0
  or strpos(definition,'from bounded order by updated_at desc,id desc')=0
  or strpos(definition,'_map_driver_id179')>0
  then raise exception 'PUBLIC_MAP_DRIVER_SOURCE_DRIFT';end if;

 -- A new private rollback copy; the original function keeps its identity,
 -- owner, SECURITY DEFINER/search_path and existing service-only grants.
 execute replace(definition,
  'CREATE OR REPLACE FUNCTION public.public_capacity_page(',
  'CREATE OR REPLACE FUNCTION public.public_capacity_page_pre_perf179(');

 old_text:='), vehicle_provider_refs as materialized (';
 new_text:=$cache$), driver_scoped179 as materialized (
  select latest.*,public.capacity_active_driver_id(latest.vehicle_id) as _map_driver_id179
  from latest where latest.latest_position=1
 ), vehicle_provider_refs as materialized ($cache$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'PUBLIC_MAP_DRIVER_CTE_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);

 -- Each replacement is an exact installed expression. No eligibility,
 -- assignment, publication, sharing, route, document or cursor predicate is
 -- removed; the materialized value is reused through existing capacity.*.
 for old_text,new_text,expected_count in values
  ('from latest capacity','from driver_scoped179 capacity',3),
  ('public.capacity_active_driver_id(vehicle.id)','capacity._map_driver_id179',1),
  ('public.capacity_active_driver_id(capacity.vehicle_id)','capacity._map_driver_id179',1),
  ('public.capacity_active_driver_id(candidate.vehicle_id)','candidate._map_driver_id179',1),
  ('public.capacity_active_driver_id(vehicle_id)','_map_driver_id179',2)
 loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>expected_count
   then raise exception 'PUBLIC_MAP_DRIVER_EXPRESSION_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 if (length(definition)-length(replace(definition,'public.capacity_active_driver_id(','')))
    /length('public.capacity_active_driver_id(')<>1
  or strpos(definition,'public.capacity_active_driver_id(latest.vehicle_id)')=0
  then raise exception 'PUBLIC_MAP_DRIVER_NOT_MATERIALIZED_ONCE';end if;
 execute definition;
end $map_driver_cache$;

revoke all on function public.public_capacity_page_pre_perf179(jsonb,timestamptz,uuid,integer)
 from public,anon,authenticated,service_role;
-- CREATE OR REPLACE preserves the public entrypoint's existing ACL; no new
-- execution grant or role membership is needed for the optimization.
notify pgrst,'reload schema';
commit;
