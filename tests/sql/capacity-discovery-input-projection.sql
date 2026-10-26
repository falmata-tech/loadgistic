-- FEAT-CAP-001 / FEAT-MKT-001: preserve profile discovery with a narrow helper input.
-- Reuse the proven eight-row fixture verbatim; psql receives each file on stdin.
begin;
set local search_path=public,extensions,pg_temp;
create temporary table discovery216_metadata on commit drop as
 select oid,md5(prosrc) as source,proowner,prosecdef,provolatile,proconfig,proacl
 from pg_proc where oid=any(array[
  'public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
  'public.capacity_search_matches(jsonb,jsonb)'::regprocedure,
  'public.capacity_viewport_matches(jsonb,jsonb)'::regprocedure,
  'public.capacity_published_source_matches(jsonb,jsonb)'::regprocedure,
  'public.capacity_search_metadata(jsonb)'::regprocedure,
  'public.capacity_search_metadata_pre_social167(jsonb)'::regprocedure,
  'public.capacity_search_results_public_fast(jsonb,integer)'::regprocedure]);
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


do $parity216$
declare ids jsonb;selected_handle text;cursor_stamp timestamptz;cursor_id uuid;
 field text;value jsonb;query jsonb;entry record;mode integer;page_size integer;
 old_rows jsonb;new_rows jsonb;old_state text;new_state text;old_error text;new_error text;
begin
 select jsonb_agg(vehicle) into ids from discovery214_fixture;
 select handle into strict selected_handle from discovery214_fixture where ordinal=1;
 select capacity.updated_at,capacity.id into strict cursor_stamp,cursor_id
  from public.capacities capacity join discovery214_fixture fixture on fixture.capacity=capacity.id where fixture.ordinal=4;
 create temporary table discovery216_cases(name text,query jsonb,expected_count integer,expected_error boolean default false) on commit drop;
 insert into discovery216_cases(name,query,expected_count) values
  ('absent','{}',4),('null query',null,0),
  ('source manual','{"location_source":"MANUAL"}',3),('source mobile','{"location_source":"MOBILE"}',1),
  ('source gps','{"location_source":"GPS"}',0),
  ('blocked empty array','{"blocked_handles":[]}',4),
  ('blocked present',jsonb_build_object('blocked_handles',jsonb_build_array(selected_handle)),3),
  ('q matching',jsonb_build_object('q',selected_handle),1),
  ('q canonical internal',jsonb_build_object('q',selected_handle,'_profile_search_internal','177'),1),
  ('q phrase','{"q":"Reuse214 account"}',4),
  ('unknown owner document','{"owner_docs":"UNKNOWN216"}',0),
  ('combined owner documents','{"owner_docs":"IDENTITY,BUSINESS_LICENSE"}',0),('q nonmatching','{"q":"no-such-account216"}',0),
  ('city nonmatching','{"office_city":"No such city216"}',0),
  ('owner document','{"owner_docs":"IDENTITY"}',1),('driver document','{"driver_docs":"DRIVER_IDENTITY"}',0),
  ('truck document','{"truck_docs":"VEHICLE_OWNERSHIP"}',0),
  ('viewport empty array','{"viewport":[]}',null),('viewport malformed','{"viewport":[38,8,40]}',null),
  ('viewport valid','{"viewport":[38,8,40,10]}',4),('viewport outside','{"viewport":[0,0,1,1]}',0),
  ('filtered only','{"status":"EMPTY","vehicle_category":"Cargo van"}',3);
 foreach field in array array['location_source','blocked_handles','q','office_city','owner_docs','driver_docs','truck_docs','viewport'] loop
  foreach value in array array['null'::jsonb,'""'::jsonb] loop
   insert into discovery216_cases(name,query,expected_count)
    values(field||':'||value::text,jsonb_build_object(field,value),case when field='viewport' then null else 4 end);
  end loop;
 end loop;
 insert into discovery216_cases(name,query,expected_error) values('invalid source','{"location_source":"INVALID216"}',true);
 insert into discovery216_cases(name,query,expected_count)
  select 'vehicle scope '||ordinal,jsonb_build_object('vehicle_ids',jsonb_build_array(vehicle)),
   case when ordinal<=4 then 1 else 0 end from discovery214_fixture;
 insert into discovery216_cases(name,query)
  select 'private invalid source '||ordinal,jsonb_build_object('vehicle_ids',jsonb_build_array(vehicle),
   'location_source','INVALID216') from discovery214_fixture where ordinal>=5;
 for entry in select * from discovery216_cases loop
  query:=jsonb_build_object('vehicle_ids',ids)||entry.query;
  for mode in 0..1 loop
   old_rows:=null;new_rows:=null;old_state:=null;new_state:=null;old_error:=null;new_error:=null;
   begin
    select coalesce(jsonb_agg(payload order by ordinal),'[]') into old_rows
     from public.capacity_search_public_profile_rows_pre_input216(query,case when mode=1 then cursor_stamp end,
      case when mode=1 then cursor_id end,14) with ordinality result(payload,ordinal);
   exception when others then get stacked diagnostics old_state=returned_sqlstate,old_error=message_text;end;
   begin
    select coalesce(jsonb_agg(payload order by ordinal),'[]') into new_rows
     from public.capacity_search_public_profile_rows(query,case when mode=1 then cursor_stamp end,
      case when mode=1 then cursor_id end,14) with ordinality result(payload,ordinal);
   exception when others then get stacked diagnostics new_state=returned_sqlstate,new_error=message_text;end;
   if old_rows is distinct from new_rows or old_state is distinct from new_state or old_error is distinct from new_error
    then raise exception 'DISCOVERY216_COMPLETE_PAYLOAD_ORDER_OR_FAILURE_DRIFT: % / %',entry.name,mode;end if;
   if entry.expected_error and old_state is null or not entry.expected_error and entry.expected_count is not null
    and (old_state is not null or mode=0 and jsonb_array_length(new_rows) is distinct from entry.expected_count)
    then raise exception 'DISCOVERY216_CASE_NOT_EXERCISED: % / %',entry.name,mode;end if;
  end loop;
 end loop;
 query:=jsonb_build_object('vehicle_ids',ids);
 foreach page_size in array array[12,16] loop
  for mode in 0..1 loop
   select coalesce(jsonb_agg(payload order by ordinal),'[]') into old_rows
    from public.capacity_search_public_profile_rows_pre_input216(query,case when mode=1 then cursor_stamp end,
     case when mode=1 then cursor_id end,page_size) with ordinality result(payload,ordinal);
   select coalesce(jsonb_agg(payload order by ordinal),'[]') into new_rows
    from public.capacity_search_public_profile_rows(query,case when mode=1 then cursor_stamp end,
     case when mode=1 then cursor_id end,page_size) with ordinality result(payload,ordinal);
   if old_rows is distinct from new_rows or jsonb_array_length(new_rows) is distinct from (case when mode=0 then 4 else 3 end)
    then raise exception 'DISCOVERY216_CURSOR_OR_PAGE_BOUND_DRIFT';end if;
  end loop;
 end loop;
end $parity216$;

do $account216$
declare ids jsonb;entry record;query jsonb;page integer;expected integer;
 old_result jsonb;new_result jsonb;old_state text;new_state text;old_error text;new_error text;
begin
 select jsonb_agg(vehicle) into ids from discovery214_fixture;
 for entry in select * from discovery216_cases loop
  query:=jsonb_build_object('vehicle_ids',ids)||entry.query;
  for page in 1..2 loop
   old_result:=null;new_result:=null;old_state:=null;new_state:=null;old_error:=null;new_error:=null;
   begin old_result:=public.capacity_search_results_public_fast_pre_input216(query,page);
   exception when others then get stacked diagnostics old_state=returned_sqlstate,old_error=message_text;end;
   begin new_result:=public.capacity_search_results_public_fast(query,page);
   exception when others then get stacked diagnostics new_state=returned_sqlstate,new_error=message_text;end;
   if old_result is distinct from new_result or old_state is distinct from new_state or old_error is distinct from new_error
    then raise exception 'DISCOVERY216_ACCOUNT_JSON_COUNT_RANK_DOCUMENT_OR_FAILURE_DRIFT: % / %',entry.name,page;end if;
   expected:=case when entry.name like 'viewport%' then 4 else entry.expected_count end;
   if entry.expected_error and old_state is null or not entry.expected_error and expected is not null
    and (old_state is not null or (new_result->>'total')::integer is distinct from expected
     or jsonb_array_length(new_result->'items') is distinct from (case when page=1 then expected else 0 end))
    then raise exception 'DISCOVERY216_ACCOUNT_CASE_NOT_EXERCISED: % / %',entry.name,page;end if;
  end loop;
 end loop;
end $account216$;

do $plan216$
declare ids jsonb;query jsonb;source_sql text;param_name text;replacement text;
 inner_plan jsonb;viewport_present boolean;
begin
 select jsonb_agg(vehicle) into ids from discovery214_fixture;
 -- Explain the actual body with constant inputs: keep the search helper while
 -- removing the unused wide ROW serialization and absent-viewport call only.
 for query,viewport_present in select * from (values
  (jsonb_build_object('vehicle_ids',ids),false),
  (jsonb_build_object('vehicle_ids',ids,'q',null),false),
  (jsonb_build_object('vehicle_ids',ids,'viewport',jsonb_build_array(38,8,40,10)),true)
 ) cases(query,viewport_present) loop
  select prosrc into strict source_sql from pg_proc
   where oid='public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure;
  if current_user<>(select pg_get_userbyid(proowner) from pg_proc
    where oid='public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure)
   then raise exception 'DISCOVERY216_PLAN_OWNER_MISMATCH';end if;
  for param_name,replacement in values('query',quote_literal(query::text)||'::jsonb'),
   ('cursor_updated_at','null::timestamptz'),('cursor_id','null::uuid'),('requested_page_size','14::integer') loop
   if strpos(source_sql,quote_literal(param_name))>0 then raise exception 'DISCOVERY216_PARAMETER_LITERAL_COLLISION';end if;
   source_sql:=regexp_replace(source_sql,E'\\m'||param_name||E'\\M','('||replacement||')','g');
  end loop;
  execute 'explain(verbose,format json) '||source_sql into inner_plan;
  if strpos(inner_plan::text,'capacity_search_matches(')=0
   or strpos(inner_plan::text,'to_jsonb(ROW(')>0
   or (strpos(inner_plan::text,'capacity_viewport_matches(')>0) is distinct from viewport_present
   then raise exception 'DISCOVERY216_WIDE_INPUT_OR_UNUSED_VIEWPORT_STILL_PLANNED';end if;
 end loop;
end $plan216$;

do $authority216$
begin
 if (select count(*) from discovery216_metadata)<>7
  or exists(select 1 from discovery216_metadata saved join pg_proc current on current.oid=saved.oid
    where md5(current.prosrc) is distinct from saved.source or current.proowner is distinct from saved.proowner
     or current.prosecdef is distinct from saved.prosecdef or current.provolatile is distinct from saved.provolatile
     or current.proconfig is distinct from saved.proconfig or current.proacl is distinct from saved.proacl)
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_matches(jsonb,jsonb)'::regprocedure)<>'7a4ca944e31f1989d522e11d4f1d8f52'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_viewport_matches(jsonb,jsonb)'::regprocedure)<>'973a54d0b2acad2367931f8d7bf033ba'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_published_source_matches(jsonb,jsonb)'::regprocedure)<>'d381d55a10814355517b351bbd01b9a7'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_metadata(jsonb)'::regprocedure)<>'a5f3c9a8a0ebe7c996a4fc829bd9d902'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_metadata_pre_social167(jsonb)'::regprocedure)<>'d3f3b5e8b88c2133a14c5beef5771164'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_results_public_fast(jsonb,integer)'::regprocedure)<>'ae6155282f29ad40f599798657b4477a'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_public_profile_rows_pre_input216(jsonb,timestamptz,uuid,integer)'::regprocedure)<>'89b1cb4430aec176be909877244846c8'
  or has_function_privilege('anon','public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('service_role','public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('anon','public.capacity_search_public_profile_rows_pre_input216(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.capacity_search_public_profile_rows_pre_input216(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('service_role','public.capacity_search_public_profile_rows_pre_input216(jsonb,timestamptz,uuid,integer)','EXECUTE')
  then raise exception 'DISCOVERY216_HELPER_SOURCE_OR_AUTHORITY_DRIFT';end if;
 if (select md5(prosrc) from pg_proc where oid='public.capacity_search_results_public_fast_pre_input216(jsonb,integer)'::regprocedure) is distinct from '376053796ca4648afd2118b65d1be9e5'
  or has_function_privilege('anon','public.capacity_search_results_public_fast(jsonb,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.capacity_search_results_public_fast(jsonb,integer)','EXECUTE')
  or has_function_privilege('service_role','public.capacity_search_results_public_fast(jsonb,integer)','EXECUTE')
  or has_function_privilege('anon','public.capacity_search_results_public_fast_pre_input216(jsonb,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.capacity_search_results_public_fast_pre_input216(jsonb,integer)','EXECUTE')
  or has_function_privilege('service_role','public.capacity_search_results_public_fast_pre_input216(jsonb,integer)','EXECUTE')
  then raise exception 'DISCOVERY216_ACCOUNT_REFERENCE_AUTHORITY_DRIFT';end if;
end $authority216$;
rollback;
select case when count(*)=0 then 'DISCOVERY216_FIXTURE_ROLLED_BACK'
 else 'DISCOVERY216_FIXTURE_REMAINS' end from public.vehicles where platform_number like 'LG-REUSE214-%';
