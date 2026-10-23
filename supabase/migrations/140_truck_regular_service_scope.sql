-- FEAT-CAP/PRV/FLT-001: Regular belongs to the exact current Truck + Driver.
-- Current-capacity handover invalidation is a separate, deferred correction.
-- Preserve legacy rows/text and installed 130/116/132/136/139 function fixes.
begin;
select pg_advisory_xact_lock(8030140);
set local timezone='UTC';
lock table public.profile_routes in share row exclusive mode;
do $backup$
declare signature text;name text;backup_name text;definition text;bound_rows_sha256 text;
begin
 select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(route) order by route.id),'[]'::jsonb)::text,'sha256'),'hex') into bound_rows_sha256
 from public.profile_routes route where route.assigned_vehicle_id is not null or route.assigned_driver_user_id is not null;
 if exists(select 1 from profile_routes where assigned_vehicle_id is not null and assigned_driver_user_id is not null
   group by assigned_vehicle_id,assigned_driver_user_id having count(*)>1) then raise exception 'REGULAR_PAIR_DUPLICATES_EXIST';end if;
 if to_regprocedure('public.regular_capacity_vehicle_scope(uuid,uuid,uuid)') is not null
 or to_regprocedure('public.remove_provider_regular_capacity(uuid,uuid,uuid,uuid)') is not null
 or to_regprocedure('public.featured_truck_regular_signals(uuid[])') is not null then raise exception 'REGULAR_SCOPE_FUNCTION_EXISTS';end if;
 foreach signature in array array[
 'public.add_provider_regular_capacity(uuid,jsonb)','public.remove_provider_regular_capacity(uuid,uuid)',
 'public.replace_provider_regular_capacity(uuid,uuid,jsonb)','public.provider_capacity_workspace(uuid)',
 'public.enforce_regular_corridor_limit()','public.public_capacity_page(jsonb,timestamptz,uuid,integer)',
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)',
 'public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer)',
 'public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)',
 'public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)',
 'public.update_provider_profile_page(uuid,jsonb)','public.public_provider_page_details(uuid,uuid)',
 'public.public_featured_provider_candidates(text[])','public.capacity_search_metadata(jsonb)',
 'public.capacity_search_matches(jsonb,jsonb)','public.capacity_search_results(jsonb,text,text,uuid,integer)'
 ] loop
  name:=split_part(split_part(signature,'(',1),'.',2);backup_name:=name||'_pre_regular_scope';
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=backup_name) then raise exception 'REGULAR_SCOPE_BACKUP_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(')<>1 then raise exception 'REGULAR_SCOPE_HEADER_DRIFT';end if;
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||backup_name||'(');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',replace(signature,'public.'||name||'(','public.'||backup_name||'('));
  execute format('comment on function %s is %L',replace(signature,'public.'||name||'(','public.'||backup_name||'('),
   jsonb_build_object('migration',140,'original_signature',signature,'before_md5',md5(definition),'baseline_bound_rows_sha256',bound_rows_sha256)::text);
 end loop;
end $backup$;

-- Organization/provider locks synchronize these new commands with the existing
-- Fleet assignment/offboarding and independent truck-replacement commands.
create function public.regular_capacity_vehicle_scope(actor_user_id uuid,target_vehicle_id uuid,expected_driver_user_id uuid)
returns public.vehicles language plpgsql security definer set search_path=public,pg_temp as $$
declare actor record;vehicle public.vehicles%rowtype;current_driver uuid;
begin
 if target_vehicle_id is null or expected_driver_user_id is null then raise exception 'REGULAR_TRUCK_DRIVER_REQUIRED';end if;
 select * into actor from public.provider_capacity_actor_scope(actor_user_id);
 if not found or actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN';end if;
 if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED';end if;
 if actor.organization_id is not null then
  perform 1 from public.organizations where id=actor.organization_id for update;
 elsif actor.provider_profile_id is not null then
  perform 1 from public.provider_profiles where id=actor.provider_profile_id and user_id=actor_user_id for update;
 else raise exception 'FORBIDDEN';end if;
 -- Re-read persisted authority after waiting on assignment/removal/replacement.
 select * into actor from public.provider_capacity_actor_scope(actor_user_id);
 if not found or actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN';end if;
 if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED';end if;
 select candidate.* into vehicle from public.vehicles candidate where candidate.id=target_vehicle_id and candidate.active
 and (actor.organization_id is not null and candidate.organization_id=actor.organization_id
   or actor.provider_profile_id is not null and candidate.provider_profile_id=actor.provider_profile_id) for update of candidate;
 if not found then raise exception 'NOT_FOUND';end if;
 current_driver:=public.capacity_active_driver_id(vehicle.id);
 if current_driver is null or current_driver is distinct from expected_driver_user_id then raise exception 'TRUCK_DRIVER_CHANGED';end if;
 if actor.actor_role='TRANSPORTER' then perform public.fleet_owner_organization(actor_user_id);
 elsif vehicle.provider_profile_id is null or current_driver is distinct from actor_user_id then raise exception 'FORBIDDEN';end if;
 return vehicle;
end $$;
revoke all on function public.regular_capacity_vehicle_scope(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.regular_capacity_vehicle_scope(uuid,uuid,uuid) to service_role;

-- The existing trigger remains attached. A unique index also protects updates
-- and concurrent direct service writes. Unbound history is retained, never bound.
create or replace function public.enforce_regular_corridor_limit() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.assigned_vehicle_id is null or new.assigned_driver_user_id is null then return new;end if;
 if exists(select 1 from public.profile_routes route where route.assigned_vehicle_id=new.assigned_vehicle_id
   and route.assigned_driver_user_id=new.assigned_driver_user_id and route.id<>new.id) then raise exception 'REGULAR_CAPACITY_LIMIT';end if;
 return new;
end $$;
create unique index profile_routes_one_truck_driver on public.profile_routes(assigned_vehicle_id,assigned_driver_user_id)
 where assigned_vehicle_id is not null and assigned_driver_user_id is not null;

-- Patch the actual installed geometry validators, including migration119.
do $add$
declare definition text:=pg_get_functiondef('public.add_provider_regular_capacity(uuid,jsonb)'::regprocedure);old_text text;new_text text;
begin
 if strpos(definition,'CAPACITY_AREA_BOUNDARY_INVALID')=0 then raise exception 'REGULAR_AREA_VALIDATION_MISSING';end if;
 for old_text,new_text in values
 ($old$  actor record;$old$,$new$  actor record;
  vehicle public.vehicles%rowtype;target_vehicle_id uuid;expected_driver_user_id uuid;$new$),
 ($old$  select * into actor from public.provider_capacity_actor_scope(actor_user_id);$old$,$new$  if command is null or jsonb_typeof(command)<>'object' then raise exception 'REGULAR_TRUCK_DRIVER_REQUIRED';end if;
  begin
   target_vehicle_id:=nullif(trim(command->>'vehicle_id'),'')::uuid;
   expected_driver_user_id:=nullif(trim(command->>'expected_driver_id'),'')::uuid;
  exception when invalid_text_representation then raise exception 'REGULAR_TRUCK_DRIVER_REQUIRED';end;
  select * into vehicle from public.regular_capacity_vehicle_scope(actor_user_id,target_vehicle_id,expected_driver_user_id);
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);$new$),
 ($old$  if actor.is_company_driver or actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN'; end if;$old$,
  $new$  if actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN'; end if;$new$),
 ($old$    where route.organization_id=actor.organization_id or route.provider_profile_id=actor.provider_profile_id) then$old$,
  $new$    where route.assigned_vehicle_id=vehicle.id and route.assigned_driver_user_id=expected_driver_user_id) then$new$),
 ($old$    route_points_json,area_center_place_ref,area_center_label,area_center_lat,area_center_lng,area_boundary_json
  ) values ($old$,$new$    route_points_json,area_center_place_ref,area_center_label,area_center_lat,area_center_lng,area_boundary_json,
    assigned_vehicle_id,assigned_driver_user_id
  ) values ($new$),
 ($old$    case when geometry_value='RADIUS' then area_center_lng end,area_boundary
  );$old$,$new$    case when geometry_value='RADIUS' then area_center_lng end,area_boundary,vehicle.id,expected_driver_user_id
  );$new$),
 ($old$'profile_route',created_id,jsonb_build_object('geometry',geometry_value),now());$old$,
  $new$'profile_route',created_id,jsonb_build_object('geometry',geometry_value,'vehicleId',vehicle.id,'driverUserId',expected_driver_user_id),now());$new$)
 loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'REGULAR_ADD_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $add$;

create function public.remove_provider_regular_capacity(actor_user_id uuid,target_route_id uuid,target_vehicle_id uuid,expected_driver_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare vehicle public.vehicles%rowtype;removed_id uuid;
begin
 select * into vehicle from public.regular_capacity_vehicle_scope(actor_user_id,target_vehicle_id,expected_driver_user_id);
 delete from public.profile_routes route where route.id=target_route_id
 and route.assigned_vehicle_id=vehicle.id and route.assigned_driver_user_id=expected_driver_user_id
 and (route.organization_id=vehicle.organization_id or route.provider_profile_id=vehicle.provider_profile_id)
 returning route.id into removed_id;
 if removed_id is null then raise exception 'NOT_FOUND';end if;
 insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
 values(gen_random_uuid(),actor_user_id,vehicle.organization_id,'REGULAR_CAPACITY_SIGNAL_REMOVED','profile_route',removed_id,
 jsonb_build_object('vehicleId',vehicle.id,'driverUserId',expected_driver_user_id),now());
end $$;
revoke all on function public.remove_provider_regular_capacity(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_provider_regular_capacity(uuid,uuid,uuid,uuid) to service_role;
create or replace function public.remove_provider_regular_capacity(actor_user_id uuid,target_route_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'REGULAR_TRUCK_DRIVER_REQUIRED';end $$;
create or replace function public.replace_provider_regular_capacity(actor_user_id uuid,target_route_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target_vehicle_id uuid;expected_driver_user_id uuid;
begin
 if command is null or jsonb_typeof(command)<>'object' then raise exception 'REGULAR_TRUCK_DRIVER_REQUIRED';end if;
 begin target_vehicle_id:=nullif(trim(command->>'vehicle_id'),'')::uuid;expected_driver_user_id:=nullif(trim(command->>'expected_driver_id'),'')::uuid;
 exception when invalid_text_representation then raise exception 'REGULAR_TRUCK_DRIVER_REQUIRED';end;
 perform public.remove_provider_regular_capacity(actor_user_id,target_route_id,target_vehicle_id,expected_driver_user_id);
 return public.add_provider_regular_capacity(actor_user_id,command);
end $$;

-- Scope every existing public/private map/search/cluster projection before
-- geometry filtering, counting and cursor pagination. Keep their remaining SQL.
do $projections$
declare signature text;definition text;old_text text;new_text text;
begin
 foreach signature in array array['public.public_capacity_page(jsonb,timestamptz,uuid,integer)',
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  old_text:=$old$  left join public.profile_routes regular on regular.organization_id=capacity.provider_organization_id
    or regular.provider_profile_id=capacity.provider_profile_id$old$;
  new_text:=$new$  left join public.profile_routes regular on regular.assigned_vehicle_id=capacity.vehicle_id
    and regular.assigned_driver_user_id=public.capacity_active_driver_id(capacity.vehicle_id)
    and (regular.organization_id=capacity.provider_organization_id or regular.provider_profile_id=capacity.provider_profile_id)$new$;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'REGULAR_PUBLIC_JOIN_DRIFT: %',signature;end if;
  if signature not like '%public_capacity_clusters%' and (strpos(definition,'public.capacity_filter_values')=0
    or strpos(definition,'blocked.content_hidden or blocked.review_workspace')=0
    or strpos(definition,'public.capacity_sharing_mode(candidate.vehicle_id)')=0) then raise exception 'REGULAR_PUBLIC_CURRENT_GUARDS_MISSING';end if;
  definition:=replace(definition,old_text,new_text);
  if signature like '%public_capacity_clusters%' then
   -- This retired service projection was copied before116/136. Apply their
   -- existing public policy only; retain its filters and aggregation/anchor.
   for old_text,new_text in values
    ($old$where capacity.latest_position=1 and vehicle.active$old$,
     $new$where capacity.latest_position=1 and vehicle.active
    and not exists(select 1 from public.organizations blocked where blocked.id=vehicle.organization_id and (blocked.content_hidden or blocked.review_workspace))
    and not exists(select 1 from public.provider_profiles blocked where blocked.id=vehicle.provider_profile_id and (blocked.content_hidden or blocked.review_workspace))$new$),
    ($old$where candidate.visibility='OPEN' and (not (query ? 'viewport')$old$,
     $new$where candidate.visibility='OPEN' and public.capacity_sharing_mode(candidate.vehicle_id) in ('PUBLIC','BOTH') and (not (query ? 'viewport')$new$)
   loop
    if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'REGULAR_CLUSTER_PUBLIC_POLICY_ANCHOR_DRIFT';end if;
    definition:=replace(definition,old_text,new_text);
   end loop;
  end if;
  execute definition;
 end loop;
 foreach signature in array array['public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer)',
 'public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)',
 'public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  old_text:=$old$    where route.organization_id=capacity.provider_organization_id or route.provider_profile_id=capacity.provider_profile_id$old$;
  new_text:=$new$    where route.assigned_vehicle_id=capacity.vehicle_id
      and route.assigned_driver_user_id=public.capacity_active_driver_id(capacity.vehicle_id)
      and (route.organization_id=capacity.provider_organization_id or route.provider_profile_id=capacity.provider_profile_id)$new$;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'REGULAR_PRIVATE_JOIN_DRIFT: %',signature;end if;
  if strpos(definition,'public.capacity_sharing_allows')=0 then raise exception 'REGULAR_PRIVATE_SHARING_GUARD_MISSING';end if;
  execute replace(definition,old_text,new_text);
 end loop;
 definition:=pg_get_functiondef('public.provider_capacity_workspace(uuid)'::regprocedure);
 for old_text,new_text in values
 ($old$'id',route.id,'geometry',route.geometry$old$,$new$'id',route.id,'vehicle_id',route.assigned_vehicle_id,'driver_user_id',route.assigned_driver_user_id,'geometry',route.geometry$new$),
 ($old$  where route.organization_id=actor.organization_id
     or route.provider_profile_id=actor.provider_profile_id;$old$,
  $new$  where (route.organization_id=actor.organization_id or route.provider_profile_id=actor.provider_profile_id)
    and route.assigned_vehicle_id is not null
    and route.assigned_driver_user_id=public.capacity_active_driver_id(route.assigned_vehicle_id)
    and exists(select 1 from public.vehicles v where v.id=route.assigned_vehicle_id and v.active
      and (actor.actor_role='TRANSPORTER' and v.organization_id=actor.organization_id
        or actor.provider_profile_id is not null and v.provider_profile_id=actor.provider_profile_id
        or actor.is_company_driver and route.assigned_driver_user_id=actor_user_id));$new$) loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'REGULAR_WORKSPACE_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $projections$;

-- A bounded server-only read keeps route and Driver identity in one SQL
-- snapshot. The public projection itself still exposes no Driver UUID.
create function public.featured_truck_regular_signals(requested_vehicle_ids uuid[])
returns table(vehicle_id uuid,driver_user_id uuid,regular_signal jsonb)
language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
begin
 if requested_vehicle_ids is null or cardinality(requested_vehicle_ids)>100
 or coalesce(array_ndims(requested_vehicle_ids),1)>1 or array_position(requested_vehicle_ids,null) is not null
 or (select count(distinct id) from unnest(requested_vehicle_ids) id)<>cardinality(requested_vehicle_ids)
 then raise exception 'INVALID_FEATURED_TRUCK_SCOPE';end if;
 if cardinality(requested_vehicle_ids)=0 then return;end if;
 return query select (projected.payload->>'vehicle_id')::uuid,
 public.capacity_active_driver_id((projected.payload->>'vehicle_id')::uuid),projected.payload->'recurring_corridors'->0
 from public.capacity_search_public_rows(jsonb_build_object('vehicle_ids',to_jsonb(requested_vehicle_ids)),null,null,14) projected;
end $$;
revoke all on function public.featured_truck_regular_signals(uuid[]) from public,anon,authenticated;
grant execute on function public.featured_truck_regular_signals(uuid[]) to service_role;

-- Retire Services without altering any existing stored text, including commands
-- from older clients. About/contact updates keep their authorization and audit.
do $services$
declare signature text;definition text;old_text text;new_text text;
begin
 signature:='public.update_provider_profile_page(uuid,jsonb)';definition:=pg_get_functiondef(signature::regprocedure);
 for old_text,new_text in values
 ($old$  services_value text:=trim(coalesce(command->>'services',''));$old$,$new$  services_value text:='';$new$),
 ($old$headline=headline_value,about=about_value,services=services_value,base_region_code=region_code$old$,
  $new$headline=headline_value,about=about_value,services=page.services,base_region_code=region_code$new$) loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'SERVICES_PROFILE_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
 signature:='public.public_provider_page_details(uuid,uuid)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$'about',p.about,'services',p.services,$old$;new_text:=$new$'about',p.about,$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'SERVICES_PUBLIC_PROFILE_DRIFT';end if;
 execute replace(definition,old_text,new_text);
 signature:='public.capacity_search_metadata(jsonb)';definition:=pg_get_functiondef(signature::regprocedure);
 if strpos(definition,'_search_documents_required')=0 then raise exception 'SEARCH_DOCUMENT_COST_GUARD_MISSING';end if;
 for old_text,new_text in values
 ($old$heading text; about text; services text; kind text;$old$,$new$heading text; about text; kind text;$new$),
 ($old$c.headline,c.about,c.services into city,heading,about,services$old$,$new$c.headline,c.about into city,heading,about$new$),
 ($old$'about',about,'services',services,$old$,$new$'about',about,$new$) loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'SERVICES_SEARCH_METADATA_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
 signature:='public.capacity_search_matches(jsonb,jsonb)';definition:=pg_get_functiondef(signature::regprocedure);
 if strpos(definition,'blocked_handles')=0 or strpos(definition,'_search_documents_required')=0 then raise exception 'SEARCH_MATCH_CURRENT_GUARDS_MISSING';end if;
 old_text:=$old$meta->>'headline',meta->>'about',meta->>'services'$old$;new_text:=$new$meta->>'headline',meta->>'about'$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'SERVICES_SEARCH_MATCH_DRIFT';end if;
 execute replace(definition,old_text,new_text);
 signature:='public.capacity_search_results(jsonb,text,text,uuid,integer)';definition:=pg_get_functiondef(signature::regprocedure);
 old_text:=$old$concat_ws(' ',meta->>'about',meta->>'services') as description$old$;new_text:=$new$meta->>'about' as description$new$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'SERVICES_SEARCH_RESULTS_DRIFT';end if;
 execute replace(definition,old_text,new_text);
end $services$;

-- Provider Featured candidates cannot choose an account-wide route. The bounded
-- application adapter loads each exact truck/current-driver signal separately.
do $featured$
declare definition text:=pg_get_functiondef('public.public_featured_provider_candidates(text[])'::regprocedure);old_text text;new_text text;
begin
 if strpos(definition,'x.content_hidden or x.review_workspace')=0 then raise exception 'FEATURED_CURRENT_POLICY_GUARD_MISSING';end if;
 for old_text,new_text in values
 ($old$page.headline,page.about,page.services,page.operating_regions$old$,$new$page.headline,page.about,page.operating_regions$new$),
 ($old$regular.signal as regular_signal,$old$,$new$null::jsonb as regular_signal,$new$),
 ($old$'about',about,'services',services,$old$,$new$'about',about,'services','',$new$),
 ($old$  left join lateral (
    select jsonb_build_object('geometry',route.geometry,'route_points',route.route_points_json,
      'area_center_label',route.area_center_label,'area_boundary',route.area_boundary_json) as signal
    from public.profile_routes route
    where route.organization_id=candidate.provider_organization_id
      or route.provider_profile_id=candidate.provider_profile_id
    order by route.created_at desc,route.id desc limit 1
  ) regular on true
$old$,$new$$new$) loop
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1 then raise exception 'REGULAR_FEATURED_ANCHOR_DRIFT';end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $featured$;

-- Owner-only exact-definition backups carry before/after hashes. Rollback checks
-- every installed definition before restoring any; no row or text is rewritten.
do $receipts$
declare signature text;backup_signature text;name text;receipt jsonb;index_definition text;
begin
 foreach signature in array array[
 'public.add_provider_regular_capacity(uuid,jsonb)','public.remove_provider_regular_capacity(uuid,uuid)',
 'public.replace_provider_regular_capacity(uuid,uuid,jsonb)','public.provider_capacity_workspace(uuid)',
 'public.enforce_regular_corridor_limit()','public.public_capacity_page(jsonb,timestamptz,uuid,integer)',
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)',
 'public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer)',
 'public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)',
 'public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)',
 'public.update_provider_profile_page(uuid,jsonb)','public.public_provider_page_details(uuid,uuid)',
 'public.public_featured_provider_candidates(text[])','public.capacity_search_metadata(jsonb)',
 'public.capacity_search_matches(jsonb,jsonb)','public.capacity_search_results(jsonb,text,text,uuid,integer)'
 ] loop
  name:=split_part(split_part(signature,'(',1),'.',2);
  backup_signature:=replace(signature,'public.'||name||'(','public.'||name||'_pre_regular_scope(');
  receipt:=obj_description(backup_signature::regprocedure,'pg_proc')::jsonb;
  if receipt is null or receipt->>'migration' is distinct from '140' then raise exception 'REGULAR_BACKUP_RECEIPT_DRIFT';end if;
  receipt:=receipt||jsonb_build_object('after_md5',md5(pg_get_functiondef(signature::regprocedure)),
   'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure),
   'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure));
  execute format('comment on function %s is %L',backup_signature,receipt::text);
 end loop;
 foreach signature in array array['public.regular_capacity_vehicle_scope(uuid,uuid,uuid)','public.remove_provider_regular_capacity(uuid,uuid,uuid,uuid)',
 'public.featured_truck_regular_signals(uuid[])'] loop
  execute format('comment on function %s is %L',signature,jsonb_build_object('migration',140,'after_md5',md5(pg_get_functiondef(signature::regprocedure)),
   'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure),
   'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure))::text);
 end loop;
 index_definition:=pg_get_indexdef('public.profile_routes_one_truck_driver'::regclass);
 execute format('comment on index public.profile_routes_one_truck_driver is %L',jsonb_build_object('migration',140,'after_md5',md5(index_definition))::text);
end $receipts$;
notify pgrst,'reload schema';
commit;
