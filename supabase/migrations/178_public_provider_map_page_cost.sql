-- FEAT-MKT-001 / FEAT-LST-001 / NR-13. A map page can show fifteen vehicles
-- from one provider, but publication and public account-name checks otherwise
-- repeat for every candidate. Cache each check by its exact provider scope;
-- keep the installed latest-signal, driver, sharing, filter and page rules.
begin;
select pg_advisory_xact_lock(8030178);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $map_page$
declare definition text; anchor text; replacement text;
begin
 if to_regprocedure('public.public_capacity_page_pre_perf178(jsonb,timestamptz,uuid,integer)') is not null
  then raise exception 'PUBLIC_MAP_PERF_BACKUP_EXISTS';end if;
 definition:=pg_get_functiondef('public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure);
 if strpos(definition,'CREATE OR REPLACE FUNCTION public.public_capacity_page(')<>1
  or strpos(definition,'provider_scope_can_publish(vehicle.organization_id,vehicle.provider_profile_id)')=0
  or strpos(definition,'provider_public_account_name(organization.id,provider.id) as provider_name')=0
  or strpos(definition,'capacity_active_driver_id(vehicle.id) is not null')=0
  or strpos(definition,'capacity_sharing_mode(candidate.vehicle_id)')=0
  or strpos(definition,'from bounded order by updated_at desc,id desc')=0
  then raise exception 'PUBLIC_MAP_PERF_SOURCE_DRIFT';end if;
 execute replace(definition,
  'CREATE OR REPLACE FUNCTION public.public_capacity_page(',
  'CREATE OR REPLACE FUNCTION public.public_capacity_page_pre_perf178(');

 anchor:= '), candidates as (';
 replacement:= $cte$), vehicle_provider_refs as materialized (
  select distinct vehicle.organization_id,vehicle.provider_profile_id
  from latest capacity join public.vehicles vehicle on vehicle.id=capacity.vehicle_id
  where capacity.latest_position=1
 ), publishable_provider_scopes as materialized (
  select refs.organization_id,refs.provider_profile_id,
   public.provider_scope_can_publish(refs.organization_id,refs.provider_profile_id) as can_publish
  from vehicle_provider_refs refs
 ), page_provider_refs as materialized (
  select distinct organization.id as organization_id,provider.id as provider_profile_id
  from latest capacity
  left join public.organizations organization on organization.id=capacity.provider_organization_id
  left join public.provider_profiles provider on provider.id=capacity.provider_profile_id
  where capacity.latest_position=1
 ), provider_names as materialized (
  select refs.organization_id,refs.provider_profile_id,
   public.provider_public_account_name(refs.organization_id,refs.provider_profile_id) as provider_name
  from page_provider_refs refs
 ), candidates as ($cte$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'PUBLIC_MAP_PROVIDER_CTE_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);

 anchor:='public.provider_public_account_name(organization.id,provider.id) as provider_name';
 replacement:='provider_names.provider_name as provider_name';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'PUBLIC_MAP_PROVIDER_NAME_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);

 anchor:='join public.vehicles vehicle on vehicle.id=capacity.vehicle_id';
 replacement:=$join$join public.vehicles vehicle on vehicle.id=capacity.vehicle_id
  join publishable_provider_scopes publishable
   on publishable.organization_id is not distinct from vehicle.organization_id
   and publishable.provider_profile_id is not distinct from vehicle.provider_profile_id$join$;
 -- The anchor also exists in vehicle_provider_refs. Replace only in candidates.
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2
  then raise exception 'PUBLIC_MAP_PROVIDER_SCOPE_JOIN_DRIFT';end if;
 definition:=replace(definition,
  '  from latest capacity'||chr(10)||'  join public.vehicles vehicle on vehicle.id=capacity.vehicle_id'||chr(10)||'  left join public.organizations organization',
  '  from latest capacity'||chr(10)||'  '||replacement||chr(10)||'  left join public.organizations organization');
 if (length(definition)-length(replace(definition,'join publishable_provider_scopes publishable','')))/length('join publishable_provider_scopes publishable')<>1
  then raise exception 'PUBLIC_MAP_PROVIDER_SCOPE_JOIN_FAILED';end if;

 anchor:='  left join public.provider_profiles provider on provider.id=capacity.provider_profile_id';
 replacement:=$join$  left join public.provider_profiles provider on provider.id=capacity.provider_profile_id
  left join provider_names
   on provider_names.organization_id is not distinct from organization.id
   and provider_names.provider_profile_id is not distinct from provider.id$join$;
 -- This join appears in both page_provider_refs and candidates.
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2
  then raise exception 'PUBLIC_MAP_PROVIDER_NAME_JOIN_DRIFT';end if;
 definition:=replace(definition,
  anchor||chr(10)||'  left join public.profiles provider_user',
  replacement||chr(10)||'  left join public.profiles provider_user');
 if (length(definition)-length(replace(definition,'  left join provider_names','')))/length('  left join provider_names')<>1
  then raise exception 'PUBLIC_MAP_PROVIDER_NAME_JOIN_FAILED';end if;

 anchor:='public.provider_scope_can_publish(vehicle.organization_id,vehicle.provider_profile_id) and vehicle.active';
 replacement:='publishable.can_publish and vehicle.active';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'PUBLIC_MAP_PROVIDER_SCOPE_DRIFT';end if;
 definition:=replace(definition,anchor,replacement);
 execute definition;
end $map_page$;

revoke all on function public.public_capacity_page_pre_perf178(jsonb,timestamptz,uuid,integer)
 from public,anon,authenticated,service_role;
revoke all on function public.public_capacity_page(jsonb,timestamptz,uuid,integer)
 from public,anon,authenticated;
grant execute on function public.public_capacity_page(jsonb,timestamptz,uuid,integer)
 to service_role;
commit;
