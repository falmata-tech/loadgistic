-- FEAT-CAP-001 / FEAT-MKT-001. Complete-result parity and actual anchor-call
-- counts on owned rollback fixtures. The separate 5,000-record/five-second gate stays.
begin;
set local search_path=public,extensions,pg_temp;

create temporary table discovery214_fixture(
 ordinal integer,actor uuid,provider uuid,vehicle uuid,capacity uuid,handle text
) on commit drop;

do $fixture$
declare n integer;actor uuid;provider uuid;vehicle uuid;capacity uuid;handle text;
 route jsonb:=public.provider_capacity_place_points('[{"place_ref":"builtin:addis ababa"},{"place_ref":"builtin:bishoftu"}]',2,5,'CAPACITY_ROUTE_POINTS_REQUIRED');
 east_route jsonb:=public.provider_capacity_place_points('[{"place_ref":"builtin:harar"},{"place_ref":"builtin:jigjiga"}]',2,5,'CAPACITY_ROUTE_POINTS_REQUIRED');
 current_route jsonb;
 area_places jsonb:='[{"place_ref":"builtin:holeta"},{"place_ref":"builtin:sebeta"},{"place_ref":"builtin:bishoftu"},{"place_ref":"builtin:sululta"}]';
begin
 for n in 1..8 loop
  current_route:=case when n=4 then east_route else route end;
  actor:=gen_random_uuid();provider:=gen_random_uuid();vehicle:=gen_random_uuid();
  handle:='reuse214-'||left(provider::text,12);
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
   values(actor,'reuse214-'||actor||'@example.invalid',clock_timestamp(),'{}','{}');
  insert into public.profiles(id,email,full_name,first_name,last_name,role,active,drives_truck)
   values(actor,'reuse214-'||actor||'@example.invalid','Reuse Private family','Reuse','Private family','DRIVER',true,true)
   on conflict(id) do update set full_name=excluded.full_name,first_name=excluded.first_name,
    last_name=excluded.last_name,role='DRIVER',active=true,drives_truck=true;
  insert into public.provider_profiles(id,user_id,business_name,handle,public_visibility)
   values(provider,actor,'Reuse214 provider '||n,handle,'PUBLIC');
  insert into public.company_pages(provider_profile_id,published,account_name)
   values(provider,true,'Reuse214 account '||n);
  perform public.accept_content_policy(actor,'2026-10-09');
  insert into public.vehicles(id,provider_profile_id,platform_number,label,category,make,model,
    cargo_configuration,plate,use_basis,active)
   values(vehicle,provider,'LG-REUSE214-'||n,'Reuse214 truck '||n,'Cargo van','Synthetic',
    'Reuse214','Cargo van','REUSE214-'||left(vehicle::text,8),'OWNED',true);
  perform public.update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,
   'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
  perform public.set_provider_vehicle_publication(actor,vehicle,'LIVE');
  insert into public.vehicle_capacity_sharing(vehicle_id,mode) values(vehicle,'PUBLIC');
  insert into public.capacities(provider_profile_id,vehicle_id,status,available_percent,visibility,
    location_area,location_updated_at,location_lat,location_lng,location_precision_km,
    location_source,accepts_full_load,accepts_partial_load,updated_by,updated_at,expires_at,
    market_status,availability_geometry,work_radius_km,current_route_origin,
    current_route_destination,current_origin_lat,current_origin_lng,current_destination_lat,
    current_destination_lng,current_route_points_json,current_origin_place_ref,current_destination_place_ref)
   values(provider,vehicle,case when n=2 then 'PARTIAL'::public.capacity_status
     when n=7 then 'OFF_DUTY'::public.capacity_status else 'EMPTY'::public.capacity_status end,
    case when n=2 then 40 when n=7 then 0 else 100 end,
    'OPEN',
    'Synthetic discovery214 location',clock_timestamp(),
    case when n in(2,4) then 9.35 else 9.03 end,
    case when n in(2,4) then 42.1 else 38.74 end,5,
    'MANUAL_ADMIN',n not in(2,7),n=2,actor,clock_timestamp(),now()+interval '1 day',
    case when n=2 then 'PARTIAL' when n=7 then 'OFF_DUTY' else 'EMPTY' end,
    'ROUTE',30,current_route->0->>'label',current_route->1->>'label',
    (current_route->0->>'lat')::double precision,(current_route->0->>'lng')::double precision,
    (current_route->1->>'lat')::double precision,(current_route->1->>'lng')::double precision,
    current_route,current_route->0->>'place_ref',current_route->1->>'place_ref')
   returning id into capacity;
  if n=3 then
   capacity:=public.publish_provider_capacity(actor,jsonb_build_object('vehicle_id',vehicle,
    'status','EMPTY','accepted_loads','FTL','availability_geometry','RADIUS',
    'capacity_area_center_place_ref','builtin:addis ababa','capacity_area_boundary_places',area_places,
    'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,
    'location_precision_km',5,'sharing_mode','PUBLIC'));
   -- A valid saved point outside the viewport leaves the matching Area to
   -- supply the anchor, while respecting the installed public-live contract.
   update public.capacities set location_lat=9.35,location_lng=42.1 where id=capacity;
  elsif n=4 then
   perform public.add_provider_regular_capacity(actor,jsonb_build_object('vehicle_id',vehicle,
    'expected_driver_id',actor,'geometry','ROUTE','route_places',
    '[{"place_ref":"builtin:addis ababa"},{"place_ref":"builtin:bishoftu"}]'::jsonb));
  elsif n=5 then update public.capacities set visibility='PRIVATE' where id=capacity;
  elsif n=6 then perform public.set_provider_capacity_sharing(actor,vehicle,'PRIVATE');
  elsif n=8 then update public.profiles set active=false where id=actor;
  end if;
  insert into discovery214_fixture values(n,actor,provider,vehicle,capacity,handle);
  if n=1 then
   insert into public.verification_requests(subject_type,subject_id,verification_type,document_name,
    storage_path,original_name,mime_type,status,submitted_by,reviewed_at)
   values('PROVIDER_PROFILE',provider,'IDENTITY','Rollback-only discovery214 identity',
    'synthetic/discovery214-owner','synthetic.jpg','image/jpeg','APPROVED',actor,now());
  end if;
 end loop;
end $fixture$;

do $parity$
declare ids jsonb;query jsonb;overview_query jsonb;old_rows jsonb;new_rows jsonb;
 old_search jsonb;new_search jsonb;expected_search jsonb;selected_handle text;selected_capacity uuid;
 cursor_stamp timestamptz;cursor_id uuid;page integer;expected_profiles integer;
 source_sql text;param_name text;placeholder text;inner_plan jsonb;anchor_plan jsonb;
 anchor_expressions integer;anchor_evaluations bigint;
begin
 select jsonb_agg(vehicle) into ids from discovery214_fixture;
 select handle,capacity into strict selected_handle,selected_capacity from discovery214_fixture where ordinal=1;
 select updated_at,id into strict cursor_stamp,cursor_id from public.capacities where id=selected_capacity;
 foreach query in array array[
  '{}'::jsonb,'{"status":"EMPTY"}'::jsonb,'{"status":"PARTIAL"}'::jsonb,
  '{"geometry":"RADIUS"}'::jsonb,'{"geometry":"ROUTE"}'::jsonb,
  '{"load_type":"FTL"}'::jsonb,'{"load_type":"PTL"}'::jsonb,
  '{"vehicle_category":"Cargo van"}'::jsonb,'{"vehicle_category":"Pickup truck"}'::jsonb,
  '{"location_source":"MANUAL"}'::jsonb,'{"location_source":"MOBILE"}'::jsonb,
  '{"location_source":"GPS"}'::jsonb,'{"owner_docs":"IDENTITY"}'::jsonb,
  '{"driver_docs":"DRIVER_IDENTITY"}'::jsonb,'{"truck_docs":"VEHICLE_OWNERSHIP"}'::jsonb,
  '{"area_lat":9.03,"area_lng":38.74,"area_radius_km":5}'::jsonb,
  '{"origin_lat":9.03,"origin_lng":38.74,"destination_lat":8.75,"destination_lng":38.99,"origin_radius_km":5,"destination_radius_km":5}'::jsonb,
  jsonb_build_object('provider',selected_handle),jsonb_build_object('capacity_id',selected_capacity)
 ] loop
  overview_query:=query||jsonb_build_object('vehicle_ids',ids,'viewport',jsonb_build_array(38,8,40,10));
  select coalesce(jsonb_agg(payload order by ordinal),'[]') into old_rows
   from public.public_capacity_clusters_pre_perf214(overview_query,null,null,14) with ordinality as result(payload,ordinal);
  select coalesce(jsonb_agg(payload order by ordinal),'[]') into new_rows
   from public.public_capacity_clusters(overview_query,null,null,14) with ordinality as result(payload,ordinal);
  if old_rows is distinct from new_rows then raise exception 'DISCOVERY214_OVERVIEW_JSON_COUNT_OR_ORDER_DRIFT';end if;
  select coalesce(jsonb_agg(payload order by ordinal),'[]') into old_rows
   from public.public_capacity_clusters_pre_perf214(overview_query,cursor_stamp,cursor_id,14) with ordinality as result(payload,ordinal);
  select coalesce(jsonb_agg(payload order by ordinal),'[]') into new_rows
   from public.public_capacity_clusters(overview_query,cursor_stamp,cursor_id,14) with ordinality as result(payload,ordinal);
  if old_rows is distinct from new_rows then raise exception 'DISCOVERY214_OVERVIEW_CURSOR_DRIFT';end if;
  expected_profiles:=case
   when query->>'vehicle_category'='Pickup truck' or query->>'location_source'='GPS'
    or query ? 'driver_docs' or query ? 'truck_docs' then 0
   when query->>'status'='PARTIAL' or query->>'geometry'='RADIUS' or query->>'load_type'='PTL'
    or query->>'location_source'='MOBILE'
    or query ? 'owner_docs' or query ? 'provider' or query ? 'capacity_id' then 1
   when query->>'status'='EMPTY' or query->>'geometry'='ROUTE' or query->>'load_type'='FTL'
    or query->>'location_source'='MANUAL' then 3
   else 4 end;
  for page in 1..2 loop
   old_search:=public.capacity_search_results_public_fast_pre_perf214(query||jsonb_build_object('vehicle_ids',ids,'q','reuse214'),page);
   new_search:=public.capacity_search_results_public_fast(query||jsonb_build_object('vehicle_ids',ids,'q','reuse214'),page);
   if query ? 'area_lat' then
    --217 corrects the old profile producer: all four proven current/Preferred
    -- offers meet this Area. Their complete account JSON equals the already-
    -- eligible unfiltered reference, including documents, order and counts.
    expected_search:=public.capacity_search_results_public_fast_pre_perf214(
     (query-array['area_lat','area_lng','area_radius_km'])||jsonb_build_object('vehicle_ids',ids,'q','reuse214'),page);
    if (old_search->>'total')::integer is distinct from 1 or new_search is distinct from expected_search
     then raise exception 'DISCOVERY214_PROFILE_AREA_OFFER_PARITY_MISSING';end if;
   elsif old_search is distinct from new_search then raise exception 'DISCOVERY214_PROFILE_JSON_DOCUMENT_OR_COUNT_DRIFT';end if;
   if (new_search->>'total')::integer is distinct from expected_profiles
    or jsonb_array_length(new_search->'items') is distinct from (case when page=1 then expected_profiles else 0 end)
    then raise exception 'DISCOVERY214_FILTER_NOT_EXERCISED: % / %',query,expected_profiles;end if;
  end loop;
 end loop;
 new_search:=public.capacity_search_results_public_fast(jsonb_build_object('vehicle_ids',ids,'q','no-matching-account214'),1);
 if (new_search->>'total')::integer is distinct from 0 or new_search->'items' is distinct from '[]'::jsonb
  then raise exception 'DISCOVERY214_NONMATCHING_ACCOUNT_SEARCH';end if;
 overview_query:=jsonb_build_object('vehicle_ids',ids,'viewport',jsonb_build_array(38,8,40,10));
 select coalesce(jsonb_agg(payload order by ordinal),'[]') into new_rows
  from public.public_capacity_clusters(overview_query,null,null,14) with ordinality as result(payload,ordinal);
 if (select coalesce(sum((item->>'count')::integer),0) from jsonb_array_elements(new_rows) item)<>4
  then raise exception 'DISCOVERY214_VISIBLE_FIXTURE_COUNT_DRIFT';end if;
 -- Expand the actual SQL body under its unchanged owner/search_path. This
 -- exposes executor rows without track_functions privileges or helper changes.
 select prosrc into strict source_sql from pg_proc
  where oid='public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure;
 if current_user<>(select pg_get_userbyid(proowner) from pg_proc
    where oid='public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure)
  then raise exception 'DISCOVERY214_PLAN_OWNER_MISMATCH';end if;
 for param_name,placeholder in values ('query','($1)'),('cursor_updated_at','($2)'),
  ('cursor_id','($3)'),('requested_page_size','($4)') loop
  -- These exact parameter names are not string literals or column names in
  -- this guarded function body. Refuse a future literal collision.
  if strpos(source_sql,quote_literal(param_name))>0
   then raise exception 'DISCOVERY214_PLAN_PARAMETER_LITERAL_COLLISION';end if;
  source_sql:=regexp_replace(source_sql,E'\\m'||param_name||E'\\M',placeholder,'g');
 end loop;
 execute 'prepare discovery214_anchor_plan(jsonb,timestamptz,uuid,integer) as '||source_sql;
 execute format('explain(analyze,verbose,format json) execute discovery214_anchor_plan(%L::jsonb,null::timestamptz,null::uuid,14)',overview_query::text)
  into inner_plan;
 deallocate discovery214_anchor_plan;
 with recursive nodes(node) as (
  select inner_plan->0->'Plan'
  union all select child from nodes cross join lateral jsonb_array_elements(coalesce(node->'Plans','[]')) child
 ) select node into strict anchor_plan from nodes where node->>'Subplan Name'='CTE locations';
 select coalesce(sum((length(value)-length(replace(value,'capacity_viewport_anchor(','')))
   /length('capacity_viewport_anchor(')),0) into anchor_expressions
  from jsonb_array_elements_text(anchor_plan->'Output');
 anchor_evaluations:=(anchor_plan->>'Actual Rows')::bigint*(anchor_plan->>'Actual Loops')::bigint;
 if anchor_expressions<>1 or anchor_evaluations is distinct from 4
  then raise exception 'DISCOVERY214_ANCHOR_NOT_ONCE_PER_ELIGIBLE_VEHICLE: % / %',anchor_expressions,anchor_evaluations;end if;
 new_search:=public.capacity_search_results_public_fast(jsonb_build_object('vehicle_ids',ids,'q','reuse214'),1);
 if (new_search->>'total')::integer is distinct from 4 or jsonb_array_length(new_search->'items') is distinct from 4
  or exists(select 1 from jsonb_array_elements(new_search->'items') item
    where item->>'capacity_id' is not null or item->>'kind' is null or item->>'kind' not in('OWNER_OPERATOR','SELF_MANAGED_DRIVER')
     or (item->>'matching_trucks')::integer is distinct from 1 or item->>'manager_name' is distinct from 'Reuse')
 then raise exception 'DISCOVERY214_ACCOUNT_IDENTITY_OR_ELIGIBILITY_DRIFT';end if;
end $parity$;

do $authority$
declare signature text;
begin
 foreach signature in array array[
  'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)',
  'public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)',
  'public.capacity_search_results_public_fast(jsonb,integer)'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE')
   or has_function_privilege('authenticated',signature,'EXECUTE')
   or has_function_privilege('service_role',signature,'EXECUTE') is distinct from
    (signature='public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)')
  then raise exception 'DISCOVERY214_ENTRY_AUTHORITY_DRIFT';end if;
 end loop;
 foreach signature in array array[
  'public.public_capacity_clusters_pre_perf214(jsonb,timestamptz,uuid,integer)',
  'public.capacity_search_public_profile_rows_pre_perf214(jsonb,timestamptz,uuid,integer)',
  'public.capacity_search_results_public_fast_pre_perf214(jsonb,integer)'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE')
   or has_function_privilege('authenticated',signature,'EXECUTE')
   or has_function_privilege('service_role',signature,'EXECUTE')
  then raise exception 'DISCOVERY214_REFERENCE_EXECUTION_EXPOSED';end if;
 end loop;
end $authority$;
rollback;
select case when count(*)=0 then 'DISCOVERY214_FIXTURE_ROLLED_BACK'
 else 'DISCOVERY214_FIXTURE_REMAINS' end from public.vehicles where platform_number like 'LG-REUSE214-%';
