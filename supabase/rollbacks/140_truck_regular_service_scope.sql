-- Roll back compatible application clients first. Exact definitions/ACLs are
-- retained from the installed pre-140 functions. Never delete/rebind new rows.
-- Once bound rows change, retain140 and use a compatible client/hide editing;
-- recovery requires forward repair. Restoring provider-wide joins would leak data.
begin;
select pg_advisory_xact_lock(8030140);
set local timezone='UTC';
lock table public.profile_routes in share row exclusive mode;
do $guard$
declare signature text;backup_signature text;name text;definition text;receipt jsonb;bound_rows_sha256 text;
begin
 receipt:=obj_description('public.add_provider_regular_capacity_pre_regular_scope(uuid,jsonb)'::regprocedure,'pg_proc')::jsonb;
 select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(route) order by route.id),'[]'::jsonb)::text,'sha256'),'hex') into bound_rows_sha256
 from public.profile_routes route where route.assigned_vehicle_id is not null or route.assigned_driver_user_id is not null;
 if receipt is null or bound_rows_sha256 is distinct from receipt->>'baseline_bound_rows_sha256'
 then raise exception 'REGULAR_SCOPE_ROLLBACK_BOUND_ROWS_CHANGED_FORWARD_REPAIR_REQUIRED';end if;
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
  if receipt is null or receipt->>'migration' is distinct from '140' or receipt->>'original_signature' is distinct from signature
    or md5(pg_get_functiondef(signature::regprocedure)) is distinct from receipt->>'after_md5'
    or (select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'acl'
    or (select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'owner'
    then raise exception 'REGULAR_SCOPE_ROLLBACK_INSTALLED_DRIFT: %',signature;end if;
  definition:=pg_get_functiondef(backup_signature::regprocedure);
  if strpos(definition,'CREATE OR REPLACE FUNCTION public.'||name||'_pre_regular_scope(')<>1 then raise exception 'REGULAR_SCOPE_ROLLBACK_HEADER_DRIFT';end if;
  definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'_pre_regular_scope(','CREATE OR REPLACE FUNCTION public.'||name||'(');
  if md5(definition) is distinct from receipt->>'before_md5' then raise exception 'REGULAR_SCOPE_ROLLBACK_BACKUP_DRIFT: %',signature;end if;
 end loop;
 foreach signature in array array['public.regular_capacity_vehicle_scope(uuid,uuid,uuid)','public.remove_provider_regular_capacity(uuid,uuid,uuid,uuid)',
 'public.featured_truck_regular_signals(uuid[])'] loop
  receipt:=obj_description(signature::regprocedure,'pg_proc')::jsonb;
  if receipt is null or receipt->>'migration' is distinct from '140'
    or md5(pg_get_functiondef(signature::regprocedure)) is distinct from receipt->>'after_md5'
    or (select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'acl'
    or (select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'owner'
    then raise exception 'REGULAR_SCOPE_ROLLBACK_NEW_FUNCTION_DRIFT';end if;
 end loop;
 receipt:=obj_description('public.profile_routes_one_truck_driver'::regclass,'pg_class')::jsonb;
 if receipt is null or receipt->>'migration' is distinct from '140'
 or md5(pg_get_indexdef('public.profile_routes_one_truck_driver'::regclass)) is distinct from receipt->>'after_md5'
 then raise exception 'REGULAR_SCOPE_ROLLBACK_INDEX_DRIFT';end if;
end $guard$;
do $restore$
declare signature text;name text;backup_signature text;definition text;
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
  definition:=pg_get_functiondef(backup_signature::regprocedure);
  execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'_pre_regular_scope(','CREATE OR REPLACE FUNCTION public.'||name||'(');
 end loop;
end $restore$;
drop function public.featured_truck_regular_signals(uuid[]);
drop function public.remove_provider_regular_capacity(uuid,uuid,uuid,uuid);
drop function public.regular_capacity_vehicle_scope(uuid,uuid,uuid);
drop index public.profile_routes_one_truck_driver;
-- Keep owner-only backups and all bound/unbound rows for reviewed recovery.
-- Restored older clients have the old provider-level contract; no reverse sync.
notify pgrst,'reload schema';
commit;
