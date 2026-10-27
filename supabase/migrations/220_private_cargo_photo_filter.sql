-- FEAT-CSP-001. Photo criteria belong only to the authenticated business feed.
-- Keep photo metadata and even its presence out of public Capacity projections.
begin;
select pg_advisory_xact_lock(8030220);
set local lock_timeout='5s';
set local statement_timeout='30s';

create function public.cargo_photo_filter_validate(query jsonb)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if jsonb_typeof(query)<>'object'
  or query ? 'photo_present' and jsonb_typeof(query->'photo_present')<>'boolean'
  or query ? 'photo_max_age_hours' and (
    jsonb_typeof(query->'photo_max_age_hours')<>'number'
    or query->>'photo_max_age_hours' not in ('12','24','72','168'))
 then raise exception 'INVALID_PRIVATE_PHOTO_FILTER';end if;
 return true;
end $$;

create function public.cargo_photo_private_filter_matches(
 actor_user_id uuid,target_workspace_id uuid,target_vehicle_id uuid,query jsonb)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare max_age integer;
begin
 perform public.cargo_photo_filter_validate(query);
 if coalesce((query->>'photo_present')::boolean,false) is false
  and not query ? 'photo_max_age_hours' then return true;end if;
 max_age:=(query->>'photo_max_age_hours')::integer;
 if not public.cargo_photo_workspace_can_view(actor_user_id,target_workspace_id,target_vehicle_id)
 then return false;end if;
 return exists(
  select 1 from public.cargo_space_photos p
  join public.driver_vehicle_assignments a on a.id=p.assignment_id
   and a.active and a.vehicle_id=p.vehicle_id and a.driver_user_id=p.uploaded_by
   and a.assigned_at=p.assignment_assigned_at
  join public.profiles d on d.id=p.uploaded_by and d.active and d.role::text='DRIVER'
  left join public.drivers driver on driver.user_id=d.id
  where p.vehicle_id=target_vehicle_id and p.state='ACTIVE'
   and coalesce(driver.active,true)
   and (max_age is null or p.received_at>=now()-make_interval(hours=>max_age))
 );
end $$;

revoke all on function public.cargo_photo_filter_validate(jsonb),
 public.cargo_photo_private_filter_matches(uuid,uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.cargo_photo_filter_validate(jsonb),
 public.cargo_photo_private_filter_matches(uuid,uuid,uuid,jsonb) to service_role;

create temporary table cargo_photo220_function_metadata on commit drop as
select oid,md5(prosrc) as source,proowner,prosecdef,provolatile,proconfig,proacl
from pg_proc where oid=any(array[
 'public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure,
 'public.business_capacity_filtered_page(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure
]);

do $patch$
declare signature text;name text;backup_signature text;definition text;old_text text;new_text text;
 function_oid oid;count_found integer;
begin
 if (select count(*) from cargo_photo220_function_metadata)<>2 then
  raise exception 'CARGO_PHOTO220_FUNCTION_MISSING';end if;
 for signature in select value from (values
  ('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'),
  ('public.business_capacity_filtered_page(uuid,uuid,timestamptz,uuid,integer,jsonb)')
 ) selected(value) loop
  function_oid:=signature::regprocedure;
  name:=split_part(split_part(signature,'(',1),'.',2);
  backup_signature:='public.'||name||'_pre_photo220'||substring(signature from position('(' in signature));
  if to_regprocedure(backup_signature) is not null then
   raise exception 'CARGO_PHOTO220_BACKUP_EXISTS: %',name;end if;
  definition:=pg_get_functiondef(function_oid);
  old_text:='CREATE OR REPLACE FUNCTION public.'||name||'(';
  if strpos(definition,old_text)<>1 then
   raise exception 'CARGO_PHOTO220_DECLARATION_DRIFT: %',name;end if;
  execute replace(definition,old_text,
   'CREATE OR REPLACE FUNCTION public.'||name||'_pre_photo220(');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',
   backup_signature::regprocedure);
  if name='business_capacity_rows' then
   old_text:=$old$) select payload from authorized_projection where public.capacity_payload_matches(payload,query - 'q') and public.capacity_search_matches(payload,query) order by $old$;
   new_text:=$new$) select payload from authorized_projection where
 public.capacity_payload_matches(payload,query - 'q' - 'photo_present' - 'photo_max_age_hours')
 and public.capacity_search_matches(payload,query - 'photo_present' - 'photo_max_age_hours')
 and case when query ? 'photo_present' or query ? 'photo_max_age_hours'
  then public.cargo_photo_private_filter_matches(actor_user_id,target_workspace_id,(payload->>'vehicle_id')::uuid,query)
  else true end
 order by $new$;
  else
   old_text:=$old$ if jsonb_typeof(query)<>'object' then raise exception 'INVALID_BUSINESS_INPUT';end if;
$old$;
   new_text:=$new$ if jsonb_typeof(query)<>'object' then raise exception 'INVALID_BUSINESS_INPUT';end if;
 perform public.cargo_photo_filter_validate(query);
$new$;
  end if;
  count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
  if count_found<>1 then raise exception 'CARGO_PHOTO220_SOURCE_DRIFT: %',name;end if;
  execute replace(definition,old_text,new_text);
  if (select md5(prosrc) from pg_proc where oid=function_oid)=
   (select source from cargo_photo220_function_metadata where oid=function_oid)
  then raise exception 'CARGO_PHOTO220_SOURCE_UNCHANGED: %',name;end if;
 end loop;
 if exists(select 1 from cargo_photo220_function_metadata saved
  join pg_proc current on current.oid=saved.oid
  where current.proowner is distinct from saved.proowner
   or current.prosecdef is distinct from saved.prosecdef
   or current.provolatile is distinct from saved.provolatile
   or current.proconfig is distinct from saved.proconfig
   or current.proacl is distinct from saved.proacl)
 then raise exception 'CARGO_PHOTO220_AUTHORITY_DRIFT';end if;
end $patch$;

notify pgrst,'reload schema';
commit;
