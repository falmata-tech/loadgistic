-- FEAT-CAP-001 / FEAT-GEO-001: Partial may use a validated service area;
-- current and Preferred offers stay independent, while older private signals
-- have the same until-Off-Duty eligibility as the public map. No data rewrite.
begin;
select pg_advisory_xact_lock(8030211);
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=public,extensions,pg_temp;

create temporary table capacity211_function_metadata on commit drop as
select oid,proowner,prosecdef,provolatile,proconfig,proacl
from pg_proc where oid=any(array[
 'public.publish_provider_capacity_pre_radius163(uuid,jsonb)'::regprocedure,
 'public.capacity_payload_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)'::regprocedure,
 'public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure
]);

do $constraints$
begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint
     where conrelid='public.capacities'::regclass and conname='capacity_partial_policy_check')
      is distinct from '7654c924f2deeab56d64c639e5116c87'
   or (select md5(pg_get_constraintdef(oid)) from pg_constraint
     where conrelid='public.capacities'::regclass and conname='capacity_partial_route_only_check')
      is distinct from '98ed97110f2bc55ba686091cf7240e9a'
 then raise exception 'CAPACITY211_CONSTRAINT_SOURCE_DRIFT';end if;
end $constraints$;

alter table public.capacities
 drop constraint capacity_partial_policy_check,
 drop constraint capacity_partial_route_only_check,
 add constraint capacity_partial_policy_check check(
  coalesce(market_status,status::text)<>'PARTIAL' or (
   accepts_full_load=false and accepts_partial_load=true and (
    availability_geometry='ROUTE' and current_origin_place_ref is not null
      and current_destination_place_ref is not null
    or availability_geometry='RADIUS' and capacity_area_center_place_ref is not null
      and jsonb_typeof(capacity_area_boundary_json)='array'
      and jsonb_array_length(capacity_area_boundary_json) between 3 and 5
   )
  )
 );

do $patch$
declare signature text;definition text;source_hash text;before_text text;after_text text;expected_count integer;actual_count integer;
begin
 for signature,source_hash in select * from (values
  ('public.publish_provider_capacity_pre_radius163(uuid,jsonb)','d031d47efdfb224c620b4b1b7820beda'),
  ('public.capacity_payload_matches(jsonb,jsonb)','3f15e1ab17eea19e288a2dafb89d97c8'),
  ('public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)','f620718444a81e5415972159b80bfb42'),
  ('public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)','f39ea32acc93a886d7483f39054057bf'),
  ('public.public_capacity_page(jsonb,timestamptz,uuid,integer)','741169e03b2daee31fe364e6ddb1364e'),
  ('public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)','da0ed1901d80872b851612dce01183fe'),
  ('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)','368c604f744690cf07940d2e5c49489a')
 ) source(signature,source_hash) loop
  if (select md5(prosrc) from pg_proc where oid=signature::regprocedure) is distinct from source_hash
   then raise exception 'CAPACITY211_FUNCTION_SOURCE_DRIFT: %',signature;end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  if signature like 'public.publish_provider_capacity_pre_radius163%' then
   before_text:=$old$    if status_value='PARTIAL' and geometry_value<>'ROUTE' then raise exception 'PARTIAL_CAPACITY_ROUTE_REQUIRED'; end if;
$old$;
   after_text:='';expected_count:=1;
   actual_count:=(length(definition)-length(replace(definition,before_text,'')))/length(before_text);
   if actual_count<>expected_count then raise exception 'CAPACITY211_PUBLISH_ANCHOR_DRIFT';end if;
   definition:=replace(definition,before_text,after_text);
  elsif signature='public.capacity_payload_matches(jsonb,jsonb)' then
   before_text:=$old$ if item->>'status'='PARTIAL' and geometry_filter='RADIUS' then return false;end if;
$old$;
   after_text:='';expected_count:=1;
   actual_count:=(length(definition)-length(replace(definition,before_text,'')))/length(before_text);
   if actual_count<>expected_count then raise exception 'CAPACITY211_PRIVATE_GEOMETRY_DRIFT';end if;
   definition:=replace(definition,before_text,after_text);
   before_text:=$old$signal->>'geometry'='RADIUS' and item->>'status'='EMPTY'$old$;
   after_text:=$new$signal->>'geometry'='RADIUS' and item->>'status' in ('EMPTY','PARTIAL')$new$;
   actual_count:=(length(definition)-length(replace(definition,before_text,'')))/length(before_text);
   if actual_count<>1 then raise exception 'CAPACITY211_PRIVATE_AREA_DRIFT';end if;
   definition:=replace(definition,before_text,after_text);
  elsif signature like 'public.account_capacity_rows%' or signature like 'public.business_capacity_rows%' then
   before_text:=$old$    and capacity.expires_at>now()
$old$;
   actual_count:=(length(definition)-length(replace(definition,before_text,'')))/length(before_text);
   if actual_count<>1 then raise exception 'CAPACITY211_PRIVATE_AGE_DRIFT: %',signature;end if;
   definition:=replace(definition,before_text,'');
  else
   before_text:=case when signature like 'public.public_capacity_clusters%'
    then $old$    and (input.capacity_status is distinct from 'PARTIAL' or input.geometry is distinct from 'RADIUS')
$old$
    else $old$    and (coalesce(candidate.market_status,candidate.status::text) is distinct from 'PARTIAL' or input.geometry is distinct from 'RADIUS')
$old$ end;
   actual_count:=(length(definition)-length(replace(definition,before_text,'')))/length(before_text);
   if actual_count<>1 then raise exception 'CAPACITY211_PUBLIC_GEOMETRY_DRIFT: %',signature;end if;
   definition:=replace(definition,before_text,'');
   before_text:=$old$coalesce(candidate.market_status,candidate.status::text)='EMPTY'$old$;
   after_text:=$new$coalesce(candidate.market_status,candidate.status::text) in ('EMPTY','PARTIAL')$new$;
   actual_count:=(length(definition)-length(replace(definition,before_text,'')))/length(before_text);
   if actual_count<>7 then raise exception 'CAPACITY211_PUBLIC_AREA_DRIFT: % / %',signature,actual_count;end if;
   definition:=replace(definition,before_text,after_text);
  end if;
  execute definition;
 end loop;
 if exists(select 1 from capacity211_function_metadata saved
    join pg_proc current on current.oid=saved.oid
    where current.proowner is distinct from saved.proowner
      or current.prosecdef is distinct from saved.prosecdef
      or current.provolatile is distinct from saved.provolatile
      or current.proconfig is distinct from saved.proconfig
      or current.proacl is distinct from saved.proacl)
  then raise exception 'CAPACITY211_FUNCTION_AUTHORITY_DRIFT';end if;
end $patch$;

notify pgrst,'reload schema';
commit;
