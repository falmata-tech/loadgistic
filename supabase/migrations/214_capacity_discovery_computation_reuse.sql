-- FEAT-CAP-001 / FEAT-MKT-001: reuse existing discovery computations without
-- changing eligibility, filtering, identity, geometry, counts or RPC grants.
begin;
select pg_advisory_xact_lock(8030214);
set local lock_timeout='5s';
set local statement_timeout='30s';

create temporary table capacity214_function_metadata on commit drop as
select oid,proowner,prosecdef,provolatile,proconfig,proacl
from pg_proc where oid=any(array[
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.capacity_search_results_public_fast(jsonb,integer)'::regprocedure
]);

do $reuse$
declare name text;arguments text;source_hash text;definition text;backup text;
 old_text text;new_text text;entry_oid oid;backup_oid oid;
begin
 for name,arguments,source_hash in select * from (values
  ('public_capacity_clusters','jsonb,timestamptz,uuid,integer','5e18257dafa48584b16cb9628d258cc3'),
  ('capacity_search_public_profile_rows','jsonb,timestamptz,uuid,integer','8192fdbb3b0b3ae1b5ba09333674d344'),
  ('capacity_search_results_public_fast','jsonb,integer','e47f5d95bed8ddc0eb2b48f5d8631da9')
 ) target(name,arguments,source_hash) loop
  entry_oid:=('public.'||name||'('||arguments||')')::regprocedure;
  if (select md5(prosrc) from pg_proc where oid=entry_oid) is distinct from source_hash
   then raise exception 'CAPACITY214_SOURCE_DRIFT: %',name;end if;
  if to_regprocedure('public.'||name||'_pre_perf214('||arguments||')') is not null
   then raise exception 'CAPACITY214_BACKUP_EXISTS: %',name;end if;
  definition:=pg_get_functiondef(entry_oid);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(')<>1
   then raise exception 'CAPACITY214_DECLARATION_DRIFT: %',name;end if;
  backup:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(',
   'CREATE OR REPLACE FUNCTION public.'||name||'_pre_perf214(');
  if name='capacity_search_results_public_fast' then
   -- The reference RPC must retain its reference producer when both change.
   if (length(backup)-length(replace(backup,'public.capacity_search_public_profile_rows(','')))
     /length('public.capacity_search_public_profile_rows(')<>1
    then raise exception 'CAPACITY214_REFERENCE_PRODUCER_DRIFT';end if;
   backup:=replace(backup,'public.capacity_search_public_profile_rows(',
    'public.capacity_search_public_profile_rows_pre_perf214(');
  end if;
  execute backup;
  backup_oid:=('public.'||name||'_pre_perf214('||arguments||')')::regprocedure;
  if exists(select 1 from pg_proc original join pg_proc saved on saved.oid=backup_oid
    where original.oid=entry_oid and (saved.proowner is distinct from original.proowner
     or saved.prosecdef is distinct from original.prosecdef
     or saved.provolatile is distinct from original.provolatile
     or saved.proconfig is distinct from original.proconfig))
   then raise exception 'CAPACITY214_REFERENCE_AUTHORITY_DRIFT';end if;
  execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_oid::regprocedure);

  if name='public_capacity_clusters' then
   -- Cache only after the existing eligibility/filter predicates have run.
   -- The same anchor serves the grid keys, averages and null check.
   old_text:='), locations as (';
   new_text:='), locations as materialized (';
  elsif name='capacity_search_public_profile_rows' then
   --209 removed Driver-name discovery. Keep the authoritative Driver lookup,
   -- but append the same null name without materializing a second wide copy.
   old_text:=$old$), driver_scoped as materialized (
   select latest.*,public.capacity_active_driver_id(latest.vehicle_id) as active_driver_id
   from latest where latest.latest_position=1
  ), driver_named as materialized (
   select scoped.*,null::text as active_driver_name from driver_scoped scoped
  ), provider_refs as materialized ($old$;
   new_text:=$new$), driver_named as materialized (
   select latest.*,public.capacity_active_driver_id(latest.vehicle_id) as active_driver_id,
    null::text as active_driver_name
   from latest where latest.latest_position=1
  ), provider_refs as materialized ($new$;
  else
   -- The sole account-entry projection reads no Driver fields from this meta.
   -- Reuse the provider metadata instead of rebuilding employee JSON per truck.
   old_text:=$old$select c.payload,
   pm.shared_meta||jsonb_build_object('driver_name',c.payload->>'active_driver_name',
    'driver_key',case when c.payload->>'active_driver_id' is not null then md5(c.payload->>'active_driver_id') end) as meta$old$;
   new_text:='select c.payload,pm.shared_meta as meta';
  end if;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
   then raise exception 'CAPACITY214_COMPUTATION_ANCHOR_DRIFT: %',name;end if;
  execute replace(definition,old_text,new_text);
 end loop;
 if (select count(*) from capacity214_function_metadata)<>3
  or exists(select 1 from capacity214_function_metadata saved join pg_proc current on current.oid=saved.oid
   where current.proowner is distinct from saved.proowner
    or current.prosecdef is distinct from saved.prosecdef
    or current.provolatile is distinct from saved.provolatile
    or current.proconfig is distinct from saved.proconfig
    or current.proacl is distinct from saved.proacl)
 then raise exception 'CAPACITY214_ENTRY_AUTHORITY_DRIFT';end if;
end $reuse$;

notify pgrst,'reload schema';
commit;
