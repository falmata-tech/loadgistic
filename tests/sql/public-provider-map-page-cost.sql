-- FEAT-MKT-001 / FEAT-LST-001 / NR-13. Exact map projection parity with two
-- synthetic providers. All accounts, vehicles and signals roll back.
begin;
do $fixture$
declare n integer;actor uuid;provider uuid;vehicle uuid;
begin
 for n in 1..2 loop
  actor:=gen_random_uuid();provider:=gen_random_uuid();vehicle:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
   values(actor,'map-cost-178-'||actor||'@example.invalid',clock_timestamp(),'{}','{}');
  insert into public.profiles(id,email,full_name,role,active,drives_truck)
   values(actor,'map-cost-178-'||actor||'@example.invalid','Synthetic map owner '||n,'DRIVER',true,true)
   on conflict(id) do update set role='DRIVER',active=true,drives_truck=true;
  insert into public.provider_profiles(id,user_id,business_name,handle,public_visibility)
   values(provider,actor,'Synthetic map provider '||n,'map-cost-178-'||left(provider::text,12),'PUBLIC');
  insert into public.company_pages(provider_profile_id,published,account_name)
   values(provider,true,'Map provider '||n);
  perform public.accept_content_policy(actor,'2026-10-09');
  insert into public.vehicles(id,provider_profile_id,platform_number,label,category,make,model,
   cargo_configuration,plate,use_basis,active)
   values(vehicle,provider,'LG-MAP-178-'||n,'Synthetic map vehicle','Cargo van','Synthetic',
    'Map','Cargo van','MAP-178-'||n,'OWNED',true);
  perform public.update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,
   'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
  perform public.set_provider_vehicle_publication(actor,vehicle,'LIVE');
  insert into public.vehicle_capacity_sharing(vehicle_id,mode) values(vehicle,'PUBLIC');
  insert into public.capacities(provider_profile_id,vehicle_id,status,available_percent,visibility,
   location_area,location_updated_at,location_lat,location_lng,location_precision_km,
   location_source,accepts_full_load,accepts_partial_load,updated_by,updated_at,expires_at,
   market_status,availability_geometry,work_radius_km,current_route_origin,
   current_route_destination,current_origin_lat,current_origin_lng,current_destination_lat,
   current_destination_lng,current_route_points_json)
   values(provider,vehicle,'EMPTY',100,'OPEN','Around Addis Ababa',clock_timestamp(),9.03,38.74,5,
    'DEVICE_OBSCURED',true,false,actor,clock_timestamp()+make_interval(secs=>n),
    now()+interval '1 day','EMPTY','ROUTE',30,'Addis Ababa','Bishoftu',9.03,38.74,8.75,38.99,
    '[{"label":"Addis Ababa","lat":9.03,"lng":38.74},{"label":"Bishoftu","lat":8.75,"lng":38.99}]');
 end loop;
end $fixture$;

do $test$
declare all_ids jsonb;selected_handle text;first_row jsonb;query jsonb;old_rows jsonb;new_rows jsonb;
 cursor_time timestamptz;cursor_id uuid;
begin
 select jsonb_agg(id) into strict all_ids from public.vehicles
  where platform_number like 'LG-MAP-178-%';
 if jsonb_array_length(all_ids)<>2 then raise exception 'MAP_COST_FIXTURE_MISSING';end if;
 if (select count(*) from public.public_capacity_page_pre_perf178(
  jsonb_build_object('vehicle_ids',all_ids),null,null,14))<>2
  then raise exception 'MAP_COST_PUBLIC_PAIR_MISSING';end if;
 select profile.handle into strict selected_handle from public.provider_profiles profile
  where profile.handle like 'map-cost-178-%' order by profile.handle limit 1;
 select payload into strict first_row from public.public_capacity_page(
  jsonb_build_object('vehicle_ids',all_ids),null,null,14) limit 1;
 cursor_time:=(first_row->>'updated_at')::timestamptz;
 cursor_id:=(first_row->>'id')::uuid;

 foreach query in array array[
  jsonb_build_object('vehicle_ids',all_ids),
  jsonb_build_object('vehicle_ids',all_ids,'provider',selected_handle),
  jsonb_build_object('vehicle_ids',all_ids,'status','EMPTY','vehicle_category','Cargo van'),
  jsonb_build_object('vehicle_ids',all_ids,'origin_lat',9.03,'origin_lng',38.74,
   'destination_lat',8.75,'destination_lng',38.99,'origin_radius_km',10,'destination_radius_km',10),
  jsonb_build_object('vehicle_ids',all_ids,'location_source','MOBILE'),
  jsonb_build_object('vehicle_ids',all_ids,'blocked_handles',jsonb_build_array(selected_handle)),
  jsonb_build_object('vehicle_ids',all_ids,'viewport',jsonb_build_array(38,8,40,10)),
  jsonb_build_object('vehicle_ids',all_ids,'capacity_id',first_row->>'id')
 ] loop
  select jsonb_agg(payload order by (payload->>'updated_at')::timestamptz desc,(payload->>'id')::uuid desc)
   into old_rows from public.public_capacity_page_pre_perf178(query,null,null,14);
  select jsonb_agg(payload order by (payload->>'updated_at')::timestamptz desc,(payload->>'id')::uuid desc)
   into new_rows from public.public_capacity_page(query,null,null,14);
  if old_rows is distinct from new_rows then raise exception 'PUBLIC_MAP_RESULT_DRIFT: %',query;end if;
 end loop;
 query:=jsonb_build_object('vehicle_ids',all_ids);
 select jsonb_agg(payload order by (payload->>'updated_at')::timestamptz desc,(payload->>'id')::uuid desc)
  into old_rows from public.public_capacity_page_pre_perf178(query,cursor_time,cursor_id,14);
 select jsonb_agg(payload order by (payload->>'updated_at')::timestamptz desc,(payload->>'id')::uuid desc)
  into new_rows from public.public_capacity_page(query,cursor_time,cursor_id,14);
 if old_rows is distinct from new_rows then raise exception 'PUBLIC_MAP_CURSOR_DRIFT';end if;
 if has_function_privilege('anon','public.public_capacity_page(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.public_capacity_page(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('service_role','public.public_capacity_page_pre_perf178(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or not has_function_privilege('service_role','public.public_capacity_page(jsonb,timestamptz,uuid,integer)','EXECUTE')
  then raise exception 'PUBLIC_MAP_RPC_ACL_DRIFT';end if;
end $test$;
rollback;
select case when count(*)=0 then 'MAP_COST_FIXTURE_ROLLED_BACK'
 else 'MAP_COST_FIXTURE_REMAINS' end from public.vehicles
where platform_number like 'LG-MAP-178-%';
