-- FEAT-MKT-001: one account result includes every authorized vehicle, even
-- beyond the ordinary 100-vehicle map page. Synthetic rows roll back.
begin;
create function pg_temp.assert_account_first(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
create function pg_temp.review_fixture(owner_id uuid,vehicle_id uuid,reviewer_id uuid)
returns void language plpgsql as $$
declare source_id uuid;context_revision text;
begin
 source_id:=public.submit_managed_verification(owner_id,jsonb_build_object('subject_type','VEHICLE','subject_id',vehicle_id,
  'verification_type','VEHICLE_OWNERSHIP','document_name','Private synthetic search proof',
  'storage_path','supabase://verification/verification/account-search-'||gen_random_uuid()||'.pdf',
  'original_name','search.pdf','mime_type','application/pdf'));
 perform public.review_managed_verification(reviewer_id,source_id,'APPROVED','Reviewed synthetic search evidence.');
 context_revision:=public.managed_provider_authority_review_context(reviewer_id,array[source_id])->0->>'contextRevision';
 perform public.confirm_provider_vehicle_authority(reviewer_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP',
  'review_note','Matched exact synthetic provider.','context_revision',context_revision));
end $$;
do $test$
declare
 owner_id uuid:=gen_random_uuid();buyer_id uuid:=gen_random_uuid();outsider_id uuid:=gen_random_uuid();
 provider_id uuid:=gen_random_uuid();second_owner_id uuid:=gen_random_uuid();second_provider_id uuid:=gen_random_uuid();
 workspace_id uuid;connection_id uuid;second_connection_id uuid;
 first_vehicle uuid;second_vehicle uuid;first_grant uuid;result jsonb;handle text;second_handle text;digest text:=repeat('0',64);
 origin_ref text;destination_ref text;extra_count integer;admin_id uuid;
begin
 select id into strict admin_id from profiles where active and role='ADMIN' order by id limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (owner_id,'provider-'||owner_id||'@example.invalid',now(),'{}'),
  (buyer_id,'broker-'||buyer_id||'@example.invalid',now(),'{}'),
  (outsider_id,'outsider-'||outsider_id||'@example.invalid',now(),'{}');
 update profiles set role='DRIVER',active=true,drives_truck=true,first_name='Provider' where id=owner_id;
 update profiles set role='SHIPPER',active=true where id in(buyer_id,outsider_id);
 handle:='account-first-'||substr(owner_id::text,1,8);
 insert into provider_profiles(id,user_id,business_name,handle) values(provider_id,owner_id,'Account first transport',handle);
 insert into company_pages(provider_profile_id,published,account_name) values(provider_id,true,'Account first transport');
 perform public.accept_content_policy(owner_id,'2026-10-09');
 first_vehicle:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Search fixture","plate":"ACCOUNT-FIRST","cargo_configuration":"Cargo van","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',owner_id,'vehicle_id',first_vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(owner_id,first_vehicle,'LIVE');
 perform pg_temp.review_fixture(owner_id,first_vehicle,admin_id);
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 perform public.publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',first_vehicle,'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 workspace_id:=(public.business_workspace_create(buyer_id,jsonb_build_object('name','Account first buyer','handle','account-first-buyer-'||substr(buyer_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 connection_id:=(public.request_account_connection(owner_id,'BUSINESS',workspace_id)->>'id')::uuid;
 perform public.decide_account_connection(buyer_id,connection_id,'ACCEPT');
 first_grant:=(public.grant_account_capacity_access(owner_id,connection_id,first_vehicle)->>'id')::uuid;

 insert into auth.users(id,email,raw_user_meta_data)
 select md5(owner_id::text||':driver:'||series)::uuid,'account-first-driver-'||series||'-'||owner_id||'@example.invalid','{}'::jsonb
 from generate_series(1,110) series;
 update profiles p set role='DRIVER',active=true,first_name='Employee'
 where p.id in(select md5(owner_id::text||':driver:'||series)::uuid from generate_series(1,110) series);
 insert into drivers(user_id,provider_profile_id,name,active)
 select md5(owner_id::text||':driver:'||series)::uuid,provider_id,'Employee '||series,true
 from generate_series(1,110) series;
 insert into vehicles(id,provider_profile_id,label,category,make,model,cargo_configuration,plate,active,publication_status,use_basis)
 select md5(owner_id::text||':vehicle:'||series)::uuid,provider_id,'Fixture '||series,'Cargo van','Isuzu','Search','Cargo van',
  'ACCOUNT-FIRST-'||series,true,'LIVE','OWNED'
 from generate_series(1,110) series;
 insert into driver_vehicle_assignments(driver_user_id,vehicle_id,assigned_by)
 select md5(owner_id::text||':driver:'||series)::uuid,md5(owner_id::text||':vehicle:'||series)::uuid,owner_id
 from generate_series(1,110) series;
 insert into vehicle_capacity_sharing(vehicle_id,mode)
 select md5(owner_id::text||':vehicle:'||series)::uuid,'PRIVATE'
 from generate_series(1,110) series;
 insert into capacities(id,provider_profile_id,vehicle_id,status,available_percent,visibility,
  location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,
  accepts_full_load,accepts_partial_load,updated_by,updated_at,expires_at,market_status,
  availability_geometry,work_radius_km,current_route_origin,current_route_destination,
  current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,
  current_destination_lat,current_destination_lng,current_route_points_json)
 select md5(owner_id::text||':capacity:'||series)::uuid,provider_id,
  md5(owner_id::text||':vehicle:'||series)::uuid,'EMPTY',100,'PRIVATE',
  'Around Addis Ababa, Ethiopia',now(),9.03,38.74,20,'DEVICE_OBSCURED',
  true,false,owner_id,now()-make_interval(secs=>series),now()+interval '1 day','EMPTY',
  'ROUTE',30,'Addis Ababa, Ethiopia','Adama, Ethiopia',origin_ref,9.03,38.74,destination_ref,8.54,39.27,
  jsonb_build_array(jsonb_build_object('place_ref',origin_ref,'label','Addis Ababa, Ethiopia','lat',9.03,'lng',38.74),
   jsonb_build_object('place_ref',destination_ref,'label','Adama, Ethiopia','lat',8.54,'lng',39.27))
 from generate_series(1,110) series;
 insert into account_capacity_grants(connection_id,vehicle_id,recipient_kind,recipient_id,granted_by)
 select connection_id,md5(owner_id::text||':vehicle:'||series)::uuid,'BUSINESS',workspace_id,owner_id
 from generate_series(1,110) series;
 insert into business_capacity_grants(vehicle_id,workspace_id,created_by)
 select vehicle_id,workspace_id,owner_id from (
  select first_vehicle as vehicle_id
  union all
  select md5(owner_id::text||':vehicle:'||series)::uuid from generate_series(1,110) series
 ) eligible;

 select count(*) into extra_count from public.account_capacity_filtered_page(buyer_id,digest,null,null,100,'{}'::jsonb);
 perform pg_temp.assert_account_first(extra_count=111,'PRIVATE_MAP_FULL_AUTHORIZED_SET');
 result:=public.account_capacity_search_results(buyer_id,digest,jsonb_build_object('q',handle),1);
 perform pg_temp.assert_account_first((result->>'total')::int=1 and jsonb_array_length(result->'items')=1
  and (result->'items'->0->>'matching_trucks')::int=111 and result->'items'->0->>'kind'='OWNER_OPERATOR',
  'PRIVATE_PROVIDER_OVER_100_COMPLETE');
 perform pg_temp.assert_account_first((public.account_capacity_search_results(outsider_id,digest,jsonb_build_object('q',handle),1)->>'total')::int=0,'FOREIGN_ACCOUNT_DENIED');
 perform pg_temp.assert_account_first((public.account_capacity_search_results(buyer_id,digest,'{"q":"Employee"}'::jsonb,1)->>'total')::int=0,'EMPLOYEE_NAME_NOT_PROFILE_MATCH');
 result:=public.business_capacity_search(buyer_id,workspace_id,handle,1);
 perform pg_temp.assert_account_first((result->>'total')::int=1 and (result->'items'->0->>'matching_trucks')::int=111,'BUSINESS_PROVIDER_OVER_100_COMPLETE');
 perform pg_temp.assert_account_first((public.business_capacity_search(buyer_id,workspace_id,'Employee',1)->>'total')::int=0,'BUSINESS_EMPLOYEE_NAME_NOT_MATCH');

 -- Its later, older signal must still appear even though the first provider
 -- already supplies more than 100 authorized rows to the same query.
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(second_owner_id,'provider-'||second_owner_id||'@example.invalid',now(),'{}');
 update profiles set role='DRIVER',active=true,drives_truck=true,first_name='Second' where id=second_owner_id;
 second_handle:='account-first-'||substr(second_owner_id::text,1,8);
 insert into provider_profiles(id,user_id,business_name,handle)
 values(second_provider_id,second_owner_id,'Account first additional',second_handle);
 insert into company_pages(provider_profile_id,published,account_name)
 values(second_provider_id,true,'Account first additional');
 perform public.accept_content_policy(second_owner_id,'2026-10-09');
 second_vehicle:=(public.create_provider_vehicle(second_owner_id,'{"make":"Isuzu","model":"Later fixture","plate":"ACCOUNT-LATER","cargo_configuration":"Cargo van","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(second_owner_id,jsonb_build_object('driver_user_id',second_owner_id,'vehicle_id',second_vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(second_owner_id,second_vehicle,'LIVE');
 perform public.publish_provider_capacity(second_owner_id,jsonb_build_object('vehicle_id',second_vehicle,'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 update public.capacities set updated_at=case when market_status='EMPTY' then now()-interval '1 hour'
  else now()-interval '2 hours' end where vehicle_id=second_vehicle;
 second_connection_id:=(public.request_account_connection(second_owner_id,'BUSINESS',workspace_id)->>'id')::uuid;
 perform public.decide_account_connection(buyer_id,second_connection_id,'ACCEPT');
 perform public.grant_account_capacity_access(second_owner_id,second_connection_id,second_vehicle);
 insert into business_capacity_grants(vehicle_id,workspace_id,created_by) values(second_vehicle,workspace_id,second_owner_id);
 result:=public.account_capacity_search_results(buyer_id,digest,'{"q":"Account first"}'::jsonb,1);
 perform pg_temp.assert_account_first((select count(*) from public.account_capacity_filtered_page(buyer_id,digest,null,null,100,'{}'::jsonb))=112,
  'LATER_PROVIDER_MAP_AUTHORIZED');
 perform pg_temp.assert_account_first((result->>'total')::int=2
  and exists(select 1 from jsonb_array_elements(result->'items') r where r->>'handle'=handle and (r->>'matching_trucks')::int=111)
  and exists(select 1 from jsonb_array_elements(result->'items') r where r->>'handle'=second_handle and (r->>'matching_trucks')::int=1),
  'LATER_PROVIDER_NOT_IN_FULL_ACCOUNT_RESULTS');
 result:=public.business_capacity_search(buyer_id,workspace_id,'Account first',1);
 perform pg_temp.assert_account_first((result->>'total')::int=2
  and exists(select 1 from jsonb_array_elements(result->'items') r where r->>'handle'=second_handle and (r->>'matching_trucks')::int=1),
  'LATER_PROVIDER_NOT_IN_BUSINESS_RESULTS');
 perform pg_temp.assert_account_first((select count(*) from public.account_directory_page(buyer_id,'Employee',0,30))=0,'EMPLOYEE_NOT_FIND_RESULT');
 perform pg_temp.assert_account_first(public.account_capacity_grant_valid(first_grant),'ORIGINAL_GRANT_REMAINS_VALID');
 raise notice 'PASS: 111 vehicles on one provider plus a later second provider; account/business coverage and foreign/employee denial';
end $test$;
rollback;
