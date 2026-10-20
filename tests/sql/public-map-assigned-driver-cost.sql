-- FEAT-MKT-001 / FEAT-CAP-001: complete JSON/cursor parity, not compilation
-- alone. Every synthetic account, assignment, review and signal rolls back.
begin;
create temporary table map179_fixture(
 ordinal integer,actor uuid,provider uuid,vehicle uuid,capacity uuid,handle text
) on commit drop;
create function pg_temp.assert_map179(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;

do $fixture$
declare n integer;actor uuid;provider uuid;vehicle uuid;capacity uuid;request uuid;origin_ref text;destination_ref text;
begin
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='bishoftu' limit 1;
 for n in 1..23 loop
  actor:=gen_random_uuid();provider:=gen_random_uuid();vehicle:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
   values(actor,'map-driver-179-'||actor||'@example.invalid',now(),'{}','{}');
  update public.profiles set role='DRIVER',active=true,drives_truck=true,
   first_name='Synthetic',full_name='Synthetic PrivateSurname' where id=actor;
  insert into public.provider_profiles(id,user_id,business_name,handle,public_visibility)
   values(provider,actor,'Synthetic map provider','map-driver-179-'||left(provider::text,12),'PUBLIC');
  insert into public.company_pages(provider_profile_id,published,account_name)
   values(provider,true,'Synthetic map provider '||n);
  perform public.accept_content_policy(actor,'2026-10-09');
  insert into public.vehicles(id,provider_profile_id,platform_number,label,category,make,model,
   cargo_configuration,plate,use_basis,active)
   values(vehicle,provider,'LG-MAP179-'||n,'Synthetic vehicle',
    case when n%2=0 then 'Cargo van' else 'Pickup truck' end,'Synthetic','Driver cost',
    case when n%2=0 then 'Cargo van' else 'Pickup truck' end,'MAP179-'||n,'OWNED',true);
  perform public.update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,
   'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
  perform public.set_provider_vehicle_publication(actor,vehicle,'LIVE');
  insert into public.vehicle_capacity_sharing(vehicle_id,mode) values(vehicle,'PUBLIC');
  insert into public.capacities(provider_profile_id,vehicle_id,status,available_percent,visibility,
   location_area,location_updated_at,location_lat,location_lng,location_precision_km,
   location_source,accepts_full_load,accepts_partial_load,updated_by,updated_at,expires_at,
   market_status,availability_geometry,work_radius_km,current_origin_place_ref,current_destination_place_ref,current_route_origin,
   current_route_destination,current_origin_lat,current_origin_lng,current_destination_lat,
   current_destination_lng,current_route_points_json)
   values(provider,vehicle,case when n%3=0 then 'PARTIAL'::public.capacity_status else 'EMPTY'::public.capacity_status end,
    case when n%3=0 then 40 else 100 end,'OPEN','Around Addis Ababa',clock_timestamp(),9.03,38.74,5,
    case when n%3=0 then 'TELEMATICS' when n%3=1 then 'DEVICE_OBSCURED' else 'MANUAL_ADMIN' end,
    n%3<>0,true,actor,clock_timestamp()+make_interval(secs=>n),now()+interval '1 day',
    case when n%3=0 then 'PARTIAL' else 'EMPTY' end,'ROUTE',30,origin_ref,destination_ref,
    'Addis Ababa','Bishoftu',9.03,38.74,8.75,38.99,
    '[{"label":"Addis Ababa","lat":9.03,"lng":38.74},{"label":"Bishoftu","lat":8.75,"lng":38.99}]')
   returning id into capacity;
  insert into map179_fixture values(n,actor,provider,vehicle,capacity,'map-driver-179-'||left(provider::text,12));
  if n=1 then
   insert into public.verification_requests(subject_type,subject_id,verification_type,document_name,
    storage_path,original_name,mime_type,status,submitted_by,reviewed_at)
   values('PROVIDER_PROFILE',provider,'IDENTITY','Rollback-only owner identity',
     'synthetic/map179-owner','synthetic.jpg','image/jpeg','APPROVED',actor,now()),
    ('DRIVER',actor,'DRIVER_IDENTITY','Rollback-only Driver identity',
     'synthetic/map179-driver','synthetic.jpg','image/jpeg','APPROVED',actor,now());
   insert into public.verification_requests(subject_type,subject_id,verification_type,document_name,
    storage_path,original_name,mime_type,status,submitted_by,reviewed_at)
   values('VEHICLE',vehicle,'VEHICLE_OWNERSHIP','Rollback-only ownership',
    'synthetic/map179-vehicle','synthetic.jpg','image/jpeg','APPROVED',actor,now()) returning id into request;
   insert into public.provider_vehicle_authority_reviews(source_request_id,vehicle_id,vehicle_identity_digest,
    organization_id,provider_profile_id,fact_kind,reviewed_by,review_note)
   select request,vehicle,public.provider_vehicle_authority_identity(v),null,provider,'OWNERSHIP',actor,
    'Rollback-only map parity evidence' from public.vehicles v where v.id=vehicle;
  end if;
  if n in(19,20) then
   perform public.grant_private_capacity_access(actor,vehicle,'map179-viewer@example.invalid',repeat('9',64));
   perform public.set_provider_capacity_sharing(actor,vehicle,case when n=19 then 'PRIVATE' else 'EXCLUSIVE' end,
    case when n=20 then 'map179-viewer@example.invalid' end,case when n=20 then repeat('9',64) end);
  elsif n=21 then
   -- Existing history survives returning a Live vehicle to Draft; a new
   -- available signal cannot be inserted while it is already Draft.
   perform public.set_provider_vehicle_publication(actor,vehicle,'DRAFT');
  elsif n=22 then update public.profiles set active=false where id=actor;
  elsif n=23 then update public.driver_vehicle_assignments set active=false
   where vehicle_id=vehicle and driver_user_id=actor and active;
  end if;
 end loop;
end $fixture$;

do $parity$
declare fixture_ids jsonb;query jsonb;old_rows jsonb;new_rows jsonb;first_rows jsonb[];later_rows jsonb[];
 selected_handle text;selected_vehicle uuid;selected_capacity uuid;selected_payload jsonb;meta jsonb;
 cursor_time timestamptz;cursor_id uuid;doc_kind text;doc_value text;entry_definition text;
begin
 select jsonb_agg(vehicle) into fixture_ids from map179_fixture;
 select handle,vehicle,capacity into strict selected_handle,selected_vehicle,selected_capacity
  from map179_fixture where ordinal=1;
 select payload into strict selected_payload from public.public_capacity_page(
  jsonb_build_object('capacity_id',selected_capacity),null,null,14);
 meta:=public.capacity_search_metadata(selected_payload);
 foreach query in array array[
  '{}'::jsonb,
  jsonb_build_object('vehicle_ids',fixture_ids),
  jsonb_build_object('provider',selected_handle),
  '{"status":"PARTIAL","vehicle_category":"Cargo van"}'::jsonb,
  jsonb_build_object('vehicle_ids',fixture_ids,'status','EMPTY,PARTIAL','vehicle_category','Cargo van,Pickup truck'),
  jsonb_build_object('vehicle_ids',fixture_ids,'location_source','GPS,MOBILE,MANUAL'),
  jsonb_build_object('vehicle_ids',fixture_ids,'location_source','GPS','status','PARTIAL','vehicle_category','Cargo van'),
  jsonb_build_object('vehicle_ids',fixture_ids,'origin_lat',9.03,'origin_lng',38.74,
   'destination_lat',8.75,'destination_lng',38.99,'origin_radius_km',10,'destination_radius_km',10),
  jsonb_build_object('vehicle_ids',fixture_ids,'viewport',jsonb_build_array(38,8,40,10)),
  jsonb_build_object('vehicle_ids',fixture_ids,'blocked_handles',jsonb_build_array(selected_handle)),
  jsonb_build_object('capacity_id',selected_capacity)
 ] loop
  select jsonb_agg(payload order by ordinal)
   into old_rows from public.public_capacity_page_pre_perf179(query,null,null,14) with ordinality as page(payload,ordinal);
  select jsonb_agg(payload order by ordinal)
   into new_rows from public.public_capacity_page(query,null,null,14) with ordinality as page(payload,ordinal);
  perform pg_temp.assert_map179(old_rows is not distinct from new_rows,'MAP179_EXACT_JSON_OR_ORDER_DRIFT');
  perform pg_temp.assert_map179(not exists(select 1 from jsonb_array_elements(coalesce(new_rows,'[]')) item
   where item ? '_map_driver_id179' or item ? 'driver_scoped179'),'MAP179_INTERNAL_CACHE_EXPOSED');
 end loop;
 foreach doc_kind in array array['owner','driver','truck'] loop
  doc_value:=meta->(doc_kind||'_documents')->>0;
  perform pg_temp.assert_map179(doc_value is not null,'MAP179_DOCUMENT_FIXTURE_MISSING');
  query:=jsonb_build_object('vehicle_ids',fixture_ids,doc_kind||'_docs',doc_value);
  select jsonb_agg(payload order by ordinal)
   into old_rows from public.public_capacity_page_pre_perf179(query,null,null,14) with ordinality as page(payload,ordinal);
  select jsonb_agg(payload order by ordinal)
   into new_rows from public.public_capacity_page(query,null,null,14) with ordinality as page(payload,ordinal);
  perform pg_temp.assert_map179(old_rows is not distinct from new_rows and jsonb_array_length(new_rows)>0,
   'MAP179_REVIEWED_DOCUMENT_PARITY_LOST');
 end loop;
 query:=jsonb_build_object('vehicle_ids',fixture_ids);
 select array_agg(payload order by ordinal)
  into first_rows from public.public_capacity_page(query,null,null,14) with ordinality as page(payload,ordinal);
 perform pg_temp.assert_map179(cardinality(first_rows)=15,'MAP179_FIRST_PAGE_BOUND');
 cursor_time:=(first_rows[14]->>'updated_at')::timestamptz;cursor_id:=(first_rows[14]->>'id')::uuid;
 select jsonb_agg(payload order by ordinal)
  into old_rows from public.public_capacity_page_pre_perf179(query,cursor_time,cursor_id,14) with ordinality as page(payload,ordinal);
 select array_agg(payload order by ordinal)
  into later_rows from public.public_capacity_page(query,cursor_time,cursor_id,14) with ordinality as page(payload,ordinal);
 perform pg_temp.assert_map179(old_rows is not distinct from to_jsonb(later_rows),'MAP179_LATER_CURSOR_JSON_DRIFT');
 perform pg_temp.assert_map179(cardinality(later_rows)=4,'MAP179_LATER_PAGE_INCOMPLETE');
 perform pg_temp.assert_map179(not exists(select 1 from unnest(first_rows[1:14]) a
  join unnest(later_rows) b on a->>'id'=b->>'id'),'MAP179_CURSOR_DUPLICATES');
 perform pg_temp.assert_map179((select count(distinct item->>'vehicle_id') from unnest(first_rows[1:14]||later_rows) item)=18,
  'MAP179_PUBLIC_SET_NOT_EXACT');
 perform pg_temp.assert_map179(not exists(select 1 from unnest(first_rows[1:14]||later_rows) item
  join map179_fixture fixture on fixture.vehicle::text=item->>'vehicle_id' where fixture.ordinal>=19),
  'MAP179_PRIVATE_DRAFT_INACTIVE_OR_UNASSIGNED_EXPOSED');
 perform pg_temp.assert_map179(not exists(select 1 from public.public_capacity_page(
  jsonb_build_object('vehicle_ids',fixture_ids,'blocked_handles',jsonb_build_array(selected_handle)),null,null,14)
  where payload->>'vehicle_id'=selected_vehicle::text),'MAP179_BLOCKED_PROFILE_EXPOSED');
 entry_definition:=pg_get_functiondef('public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure);
 perform pg_temp.assert_map179(strpos(entry_definition,'driver_scoped179 as materialized')>0
  and (length(entry_definition)-length(replace(entry_definition,'public.capacity_active_driver_id(','')))
   /length('public.capacity_active_driver_id(')=1,'MAP179_DIRECT_DRIVER_LOOKUP_NOT_CACHED');
 perform pg_temp.assert_map179(not has_function_privilege('anon','public.public_capacity_page(jsonb,timestamptz,uuid,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.public_capacity_page(jsonb,timestamptz,uuid,integer)','EXECUTE')
  and has_function_privilege('service_role','public.public_capacity_page(jsonb,timestamptz,uuid,integer)','EXECUTE')
  and not has_function_privilege('service_role','public.public_capacity_page_pre_perf179(jsonb,timestamptz,uuid,integer)','EXECUTE')
  and not has_function_privilege('anon','public.public_capacity_page_pre_perf179(jsonb,timestamptz,uuid,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.public_capacity_page_pre_perf179(jsonb,timestamptz,uuid,integer)','EXECUTE'),
  'MAP179_ENTRY_OR_BACKUP_ACL_DRIFT');
end $parity$;
rollback;
select case when count(*)=0 then 'MAP179_FIXTURES_ROLLED_BACK'
 else 'MAP179_FIXTURES_REMAIN' end from public.vehicles where platform_number like 'LG-MAP179-%';
