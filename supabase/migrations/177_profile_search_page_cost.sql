-- FEAT-MKT-001 / FEAT-LST-001 / NR-13. Keep complete, authorized profile
-- search while avoiding map-only evidence work for every matching vehicle.
-- A result page still receives its exact reviewed-document badges.
begin;
select pg_advisory_xact_lock(8030177);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $backup$
declare source_definition text; result_definition text;
begin
 if to_regprocedure('public.capacity_search_public_rows_pre_perf177(jsonb,timestamptz,uuid,integer)') is not null
  or to_regprocedure('public.capacity_search_results_pre_perf177(jsonb,text,text,uuid,integer)') is not null
  or to_regprocedure('public.capacity_search_matches_pre_perf177(jsonb,jsonb)') is not null
  then raise exception 'PROFILE_SEARCH_PERF_BACKUP_EXISTS';end if;
 source_definition:=pg_get_functiondef('public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure);
 result_definition:=pg_get_functiondef('public.capacity_search_results_pre_retirement159(jsonb,text,text,uuid,integer)'::regprocedure);
 if strpos(source_definition,'CREATE OR REPLACE FUNCTION public.capacity_search_public_rows(')<>1
  or strpos(result_definition,'CREATE OR REPLACE FUNCTION public.capacity_search_results_pre_retirement159(')<>1
  or strpos(source_definition,'from bounded order by updated_at desc,id desc')=0
  or strpos(result_definition,'capacity_search_metadata(payload) as meta')=0
  then raise exception 'PROFILE_SEARCH_PERF_SOURCE_DRIFT';end if;
 execute replace(source_definition,
  'CREATE OR REPLACE FUNCTION public.capacity_search_public_rows(',
  'CREATE OR REPLACE FUNCTION public.capacity_search_public_rows_pre_perf177(');
 execute replace(result_definition,
  'CREATE OR REPLACE FUNCTION public.capacity_search_results_pre_retirement159(',
  'CREATE OR REPLACE FUNCTION public.capacity_search_results_pre_perf177(');
 source_definition:=pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure);
 if strpos(source_definition,'CREATE OR REPLACE FUNCTION public.capacity_search_matches(')<>1
  or strpos(source_definition,'public.capacity_published_source_matches(item,query)')=0
  or strpos(source_definition,'meta:=public.capacity_search_metadata(item||jsonb_build_object(')=0
  then raise exception 'PROFILE_SEARCH_MATCHER_DRIFT';end if;
 execute replace(source_definition,
  'CREATE OR REPLACE FUNCTION public.capacity_search_matches(',
  'CREATE OR REPLACE FUNCTION public.capacity_search_matches_pre_perf177(');
end $backup$;
revoke all on function public.capacity_search_public_rows_pre_perf177(jsonb,timestamptz,uuid,integer),
 public.capacity_search_results_pre_perf177(jsonb,text,text,uuid,integer),
 public.capacity_search_matches_pre_perf177(jsonb,jsonb) from public,anon,authenticated,service_role;

-- A name-only match is a strict positive subset of the existing matcher:
-- capacity_text_score scores every query token in the concatenated title/body.
-- Other names, About, city, fuzzy terms, and all document/city filters still
-- use the original matcher. This branch runs only for the internal result call.
do $fast_name_match$
declare definition text;anchor text;replacement text;
begin
 definition:=pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure);
 anchor:=$old$ meta:=public.capacity_search_metadata(item||jsonb_build_object($old$;
 replacement:=$new$ if query->>'_profile_search_internal'='177'
  and nullif(query->>'q','') is not null
  and nullif(query->>'office_city','') is null
  and nullif(query->>'owner_docs','') is null
  and nullif(query->>'driver_docs','') is null
  and nullif(query->>'truck_docs','') is null
  and length(trim(query->>'q'))<=120
  and trim(query->>'q') ~ '^[[:alnum:]]+$'
  and position(lower(trim(query->>'q')) in lower(concat_ws(' ',item->>'provider_handle',
   item->>'active_driver_name')))>0
  then return true;end if;
 meta:=public.capacity_search_metadata(item||jsonb_build_object($new$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'PROFILE_SEARCH_FAST_MATCH_DRIFT';end if;
 execute replace(definition,anchor,replacement);
end $fast_name_match$;

-- The public map producer remains unchanged. Copy only its input/latest/
-- candidates/filtered CTEs into a private profile-result producer, then stop
-- before map-card contacts, review aggregates, badges and documents. All
-- publication, sharing, role, location, text and document predicates remain
-- byte-for-byte the installed filter definitions.
do $profile_rows$
declare definition text; anchor text:=') , bounded_base as ('; replacement text; start_at integer;
begin
 if to_regprocedure('public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)') is not null
  then raise exception 'PROFILE_SEARCH_PRIVATE_ROWS_EXISTS';end if;
 definition:=pg_get_functiondef('public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure);
 anchor:= '), bounded_base as (';
 start_at:=strpos(definition,anchor);
 if start_at=0 or strpos(substring(definition from start_at+1),anchor)>0
  or strpos(definition,'capacity_search_matches(to_jsonb(candidate),query)')=0
  or strpos(definition,'capacity_sharing_mode(candidate.vehicle_id)')=0
  or strpos(definition,'provider_scope_can_publish(vehicle.organization_id,vehicle.provider_profile_id)')=0
  or strpos(definition,'capacity_active_driver_id(vehicle.id) is not null')=0
  or strpos(definition,'from bounded order by updated_at desc,id desc')=0
  then raise exception 'PROFILE_SEARCH_PRIVATE_ROWS_SOURCE_DRIFT';end if;
 definition:=replace(left(definition,start_at-1),
  'CREATE OR REPLACE FUNCTION public.capacity_search_public_rows(',
  'CREATE OR REPLACE FUNCTION public.capacity_search_public_profile_rows(');
 for anchor,replacement in values
  ('from latest capacity','from driver_named capacity'),
  ('regular.assigned_driver_user_id=public.capacity_active_driver_id(capacity.vehicle_id)',
   'regular.assigned_driver_user_id=capacity.active_driver_id'),
  ('public.capacity_active_driver_id(vehicle.id) is not null',
   'capacity.active_driver_id is not null'),
  ('public.provider_public_account_name(organization.id,provider.id) as provider_name',
   'provider_names.provider_name as provider_name'),
  ('join public.vehicles vehicle on vehicle.id=capacity.vehicle_id',
   $join$join public.vehicles vehicle on vehicle.id=capacity.vehicle_id
   left join provider_names on provider_names.organization_id is not distinct from capacity.provider_organization_id
    and provider_names.profile_id is not distinct from capacity.provider_profile_id$join$) loop
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
   then raise exception 'PROFILE_SEARCH_DRIVER_SCOPE_DRIFT: %',anchor;end if;
  definition:=replace(definition,anchor,replacement);
 end loop;
 anchor:= '), candidates as (';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'PROFILE_SEARCH_DRIVER_CTE_DRIFT';end if;
 definition:=replace(definition,anchor,
  $cte$), driver_scoped as materialized (
   select latest.*,public.capacity_active_driver_id(latest.vehicle_id) as active_driver_id
   from latest where latest.latest_position=1
  ), driver_named as materialized (
   select scoped.*,coalesce(nullif(public.normalize_personal_name(driver_profile.first_name),''),
    nullif(split_part(public.normalize_personal_name(driver_profile.full_name),' ',1),'')) as active_driver_name
   from driver_scoped scoped left join public.profiles driver_profile
    on driver_profile.id=scoped.active_driver_id and driver_profile.active
  ), provider_refs as materialized (
   select distinct provider_organization_id as organization_id,provider_profile_id as profile_id
   from driver_named
  ), provider_names as materialized (
   select refs.organization_id,refs.profile_id,
    public.provider_public_account_name(refs.organization_id,refs.profile_id) as provider_name
   from provider_refs refs
  ), candidates as ($cte$);
 definition:=definition
  ||') select jsonb_build_object(''id'',id,''vehicle_id'',vehicle_id,
   ''provider_organization_id'',provider_organization_id,''provider_profile_id'',provider_profile_id,
   ''provider_name'',provider_name,''provider_handle'',provider_handle,
   ''active_driver_id'',active_driver_id,''active_driver_name'',active_driver_name) as payload
  from filtered order by updated_at desc,id desc'
  ||chr(10)||'$function$';
 execute definition;
end $profile_rows$;
revoke all on function public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)
 from public,anon,authenticated,service_role;

-- Search still feeds all matching capacities into the existing grouping and
-- ranking. Profile text and reviewed-document filters are evaluated by the
-- original, unchanged producer; the only skipped work is map-card decoration.
create function public.capacity_search_results_public_fast(query jsonb,requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare answer jsonb;page_number integer:=greatest(1,least(coalesce(requested_page,1),10000));
begin
 if length(coalesce(query->>'q',''))>120 then raise exception 'INVALID_SEARCH';end if;
 with capacity as materialized (
  select payload from public.capacity_search_public_profile_rows(
   (query - 'viewport')||jsonb_build_object('_profile_search_internal','177'),null,null,14)
 ), provider_samples as materialized (
  select distinct on (payload->>'provider_organization_id',payload->>'provider_profile_id') payload
  from capacity
 ), provider_meta as materialized (
  select payload->>'provider_organization_id' as organization_id,
   payload->>'provider_profile_id' as profile_id,
   public.capacity_search_metadata(payload||'{"_search_documents_required":false}'::jsonb)
    -'driver_name'-'driver_key' as shared_meta
  from provider_samples
 ), facts as materialized (
  select c.payload,
   pm.shared_meta||jsonb_build_object('driver_name',c.payload->>'active_driver_name',
    'driver_key',case when c.payload->>'active_driver_id' is not null then md5(c.payload->>'active_driver_id') end) as meta
  from capacity c join provider_meta pm
   on c.payload->>'provider_organization_id' is not distinct from pm.organization_id
    and c.payload->>'provider_profile_id' is not distinct from pm.profile_id
 ), entries as (
  select 'PROVIDER:'||(payload->>'provider_handle') as key,meta->>'kind' as kind,
   payload->>'provider_name' as title,meta->>'headline' as subtitle,meta->>'about' as description,
   payload->>'provider_handle' as identifier,payload->>'provider_handle' as handle,
   null::text as capacity_id,payload->>'id' as sample_id,meta->>'city' as city,
   null::text as status,payload->>'provider_name' as owner,null::text as driver,
   meta->>'account_name' as account_name,meta->>'manager_name' as manager_name from facts
  union all
  select 'DRIVER:'||(meta->>'driver_key'),'COMPANY_DRIVER',meta->>'driver_name',
   payload->>'provider_name',null,null,payload->>'provider_handle',payload->>'id',
   payload->>'id',meta->>'city',null,payload->>'provider_name',meta->>'driver_name',
   meta->>'account_name',meta->>'manager_name' from facts
   where meta->>'kind'='COMPANY' and nullif(meta->>'driver_name','') is not null
 ), grouped as (
  select key,kind,title,subtitle,left(description,220) as description,identifier,handle,
   min(capacity_id) as capacity_id,min(sample_id) as sample_id,city,status,owner,driver,
   account_name,manager_name,count(*) as matching_trucks,
   public.capacity_text_score(query->>'q',concat_ws(' ',title,identifier,account_name,manager_name),
    concat_ws(' ',subtitle,description,city,owner,driver)) as score
  from entries
  group by key,kind,title,subtitle,description,identifier,handle,city,status,owner,driver,account_name,manager_name
 ), ordered as (
  select *,row_number() over(order by score desc,
   case kind when 'COMPANY' then 0 when 'OWNER_OPERATOR' then 1 when 'SELF_MANAGED_DRIVER' then 2 else 4 end,
   lower(title),key) as position from grouped
 ) select jsonb_build_object(
  'items',coalesce((select jsonb_agg(
   (to_jsonb(o)-'score'-'position'-'sample_id')||jsonb_build_object('documents',
    coalesce(public.capacity_search_metadata(jsonb_build_object(
     'vehicle_id',sample.vehicle_id,'provider_organization_id',sample.provider_organization_id,
     'provider_profile_id',sample.provider_profile_id)) ->
     (case when o.kind='COMPANY_DRIVER' then 'driver_documents' else 'owner_documents' end),'[]'::jsonb))
   order by o.position)
   from ordered o join public.capacities sample on sample.id=o.sample_id::uuid
   where o.position>(page_number-1)*15 and o.position<=page_number*15),'[]'::jsonb),
  'total',(select count(*) from grouped),'page',page_number,'pageSize',15,
  'hasMore',(select count(*) from grouped)>page_number*15) into answer;
 return answer;
end $$;
revoke all on function public.capacity_search_results_public_fast(jsonb,integer) from public,anon,authenticated,service_role;
alter function public.capacity_search_results_public_fast(jsonb,integer) set jit=off;

create or replace function public.capacity_search_results_pre_retirement159(query jsonb,
 requested_audience text default 'PUBLIC',requested_digest text default null,
 actor_user_id uuid default null,requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
begin
 if requested_audience='PUBLIC' then
  return public.capacity_search_results_public_fast(query,requested_page);
 end if;
 return public.capacity_search_results_pre_perf177(query,requested_audience,requested_digest,actor_user_id,requested_page);
end $$;
revoke all on function public.capacity_search_results_pre_retirement159(jsonb,text,text,uuid,integer)
 from public,anon,authenticated,service_role;
alter function public.capacity_search_results_pre_retirement159(jsonb,text,text,uuid,integer) set jit=off;
notify pgrst,'reload schema';
commit;
