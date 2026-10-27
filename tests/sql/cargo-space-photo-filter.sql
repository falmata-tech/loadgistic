-- FEAT-CSP-001. All identities and photo rows are disposable transaction data.
begin;
create function pg_temp.assert_photo_filter(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
create function pg_temp.photo_filter_denied(statement text,code text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then
  if position(code in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_PHOTO_FILTER_DENIAL:%',code;
end $$;
do $test$
declare provider_id uuid:=gen_random_uuid();broker_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();
 provider_profile_id uuid:=gen_random_uuid();vehicle_id uuid;photo_capacity_id uuid;workspace_id uuid;other_workspace uuid;
 connection_id uuid;grant_id uuid;photo_id uuid;assignment_id uuid;origin_ref text;destination_ref text;
 other_provider uuid;other_profile uuid;other_vehicle uuid;first_page jsonb[];
 source_definition text;ordinal_value integer;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (provider_id,'photo-filter-provider-'||provider_id||'@example.invalid',now(),'{}'),
  (broker_id,'photo-filter-broker-'||broker_id||'@example.invalid',now(),'{}'),
  (other_id,'photo-filter-other-'||other_id||'@example.invalid',now(),'{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true where id=provider_id;
 update public.profiles set role='SHIPPER',active=true where id in(broker_id,other_id);
 insert into public.provider_profiles(id,user_id,business_name,handle)
  values(provider_profile_id,provider_id,'Private photo filter fixture','photo-filter-'||substr(provider_id::text,1,12));
 insert into public.company_pages(provider_profile_id,published) values(provider_profile_id,true);
 perform public.accept_content_policy(provider_id,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(provider_id,
  '{"make":"Isuzu","model":"Photo filter fixture","plate":"CARGO-220","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(provider_id,jsonb_build_object('driver_user_id',provider_id,
  'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 assignment_id:=public.cargo_photo_driver_assignment(provider_id,vehicle_id);
 update public.driver_vehicle_assignments set assigned_at=now()-interval '1 day' where id=assignment_id;
 perform public.set_provider_vehicle_publication(provider_id,vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 photo_capacity_id:=public.publish_provider_capacity(provider_id,jsonb_build_object('vehicle_id',vehicle_id,
  'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE',
  'accepted_loads','FTL','current_route_places',jsonb_build_array(
   jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 workspace_id:=(public.business_workspace_create(broker_id,jsonb_build_object('name','Photo filter broker',
  'handle','photo-filter-broker-'||substr(broker_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 other_workspace:=(public.business_workspace_create(other_id,jsonb_build_object('name','Unconnected photo broker',
  'handle','photo-filter-other-'||substr(other_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 connection_id:=(public.request_account_connection(provider_id,'BUSINESS',workspace_id)->>'id')::uuid;
 perform public.decide_account_connection(broker_id,connection_id,'ACCEPT');
 grant_id:=(public.grant_account_capacity_access(provider_id,connection_id,vehicle_id)->>'id')::uuid;

 perform pg_temp.assert_photo_filter((select count(*)=1 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{}'::jsonb)),'UNFILTERED_PRIVATE_FEED');
 perform pg_temp.assert_photo_filter((select count(*)=0 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":true}'::jsonb)),'MISSING_PHOTO_MATCHED');
 photo_id:=public.cargo_photo_reserve(provider_id,vehicle_id,
  'supabase://capacity-photo/capacity/2026-10-26/'||gen_random_uuid()||'.jpg',
  'CAMERA',now()-interval '1 year',1024);
 perform pg_temp.assert_photo_filter((select count(*)=0 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":true}'::jsonb)),'PENDING_PHOTO_MATCHED');
 perform public.cargo_photo_activate(provider_id,photo_id);
 perform pg_temp.assert_photo_filter((select count(*)=1 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":true,"photo_max_age_hours":12}'::jsonb)),
  'FRESH_SERVER_RECEIPT_NOT_MATCHED');

 -- More than one page of later non-photo offers must not hide the photo match.
 for ordinal_value in 1..12 loop
  other_provider:=gen_random_uuid();other_profile:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
   values(other_provider,'photo-filter-later-'||other_provider||'@example.invalid',now(),'{}');
  update public.profiles set role='DRIVER',active=true,drives_truck=true where id=other_provider;
  insert into public.provider_profiles(id,user_id,business_name,handle)
   values(other_profile,other_provider,'Later capacity example',
    'photo-filter-later-'||substr(other_provider::text,1,12));
  insert into public.company_pages(provider_profile_id,published) values(other_profile,true);
  perform public.accept_content_policy(other_provider,'2026-10-09');
  other_vehicle:=(public.create_provider_vehicle(other_provider,jsonb_build_object(
   'make','Isuzu','model','Later fixture','plate','PHOTO-220-'||substr(other_provider::text,1,8),
   'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
  perform public.update_fleet_driver_access(other_provider,jsonb_build_object('driver_user_id',other_provider,
   'vehicle_id',other_vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
  perform public.set_provider_vehicle_publication(other_provider,other_vehicle,'LIVE');
  perform public.publish_provider_capacity(other_provider,jsonb_build_object('vehicle_id',other_vehicle,
   'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE',
   'accepted_loads','FTL','current_route_places',jsonb_build_array(
    jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
   'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
  perform public.grant_business_capacity_access(other_provider,other_vehicle,workspace_id);
 end loop;
 -- The synthetic vehicle starts with an OFF_DUTY reset. Remove only that
 -- disposable reset before aging its live offer for the page-boundary check.
 delete from public.capacities reset where reset.vehicle_id=(
  select live.vehicle_id from public.capacities live where live.id=photo_capacity_id)
  and reset.id<>photo_capacity_id and reset.market_status='OFF_DUTY';
 update public.capacities set updated_at=now()-interval '1 hour' where id=photo_capacity_id;
 select array_agg(payload order by (payload->>'updated_at')::timestamptz desc,
  (payload->>'id')::uuid desc) into first_page
  from public.business_capacity_filtered_page(broker_id,workspace_id,null,null,12,'{}'::jsonb);
 perform pg_temp.assert_photo_filter(cardinality(first_page)=13 and not exists(
  select 1 from unnest(first_page[1:12]) row where row->>'vehicle_id'=vehicle_id::text),
  format('PAGINATION_FIXTURE_DID_NOT_HIDE_PHOTO count=%s photoInFirst12=%s',
   cardinality(first_page),(select count(*) from unnest(first_page[1:12]) row
    where row->>'vehicle_id'=vehicle_id::text)));
 perform pg_temp.assert_photo_filter((select count(*)=1 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":true}'::jsonb)),
  'PHOTO_FILTER_APPLIED_AFTER_PAGINATION');

 update public.cargo_space_photos set received_at=now()-interval '25 hours',camera_captured_at=now()
  where id=photo_id;
 perform pg_temp.assert_photo_filter((select count(*)=0 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_max_age_hours":24}'::jsonb)),
  'DEVICE_TIME_OVERRULED_SERVER_AGE');
 perform pg_temp.assert_photo_filter((select count(*)=1 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_max_age_hours":72}'::jsonb)),
  'OLDER_SERVER_RECEIPT_NOT_MATCHED');
 perform pg_temp.assert_photo_filter((select count(*)=13 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":false}'::jsonb)),
  'FALSE_SHOULD_NOT_FILTER');
 perform pg_temp.photo_filter_denied(format('select * from public.business_capacity_filtered_page(%L,%L,null,null,12,%L::jsonb)',
  broker_id,workspace_id,'{"photo_max_age_hours":999999}'),'INVALID_PRIVATE_PHOTO_FILTER');
 perform pg_temp.photo_filter_denied(format('select * from public.business_capacity_filtered_page(%L,%L,null,null,12,%L::jsonb)',
  broker_id,workspace_id,'{"photo_present":"true"}'),'INVALID_PRIVATE_PHOTO_FILTER');
 perform pg_temp.photo_filter_denied(format('select * from public.business_capacity_filtered_page(%L,%L,null,null,12,%L::jsonb)',
  other_id,workspace_id,'{"photo_present":true}'),'BUSINESS_FORBIDDEN');
 perform pg_temp.assert_photo_filter((select count(*)=0 from public.business_capacity_filtered_page(
  other_id,other_workspace,null,null,12,'{"photo_present":true}'::jsonb)),'FOREIGN_WORKSPACE_MATCHED');

 assignment_id:=public.cargo_photo_driver_assignment(provider_id,vehicle_id);
 update public.driver_vehicle_assignments set active=false where id=assignment_id;
 perform pg_temp.assert_photo_filter((select count(*)=0 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":true}'::jsonb)),'INACTIVE_ASSIGNMENT_MATCHED');
 update public.driver_vehicle_assignments set active=true,assigned_at=clock_timestamp() where id=assignment_id;
 perform pg_temp.assert_photo_filter((select count(*)=0 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":true}'::jsonb)),'REASSIGNED_PHOTO_MATCHED');
 perform public.revoke_account_capacity_access(provider_id,grant_id,1);
 perform pg_temp.assert_photo_filter((select count(*)=0 from public.business_capacity_filtered_page(
  broker_id,workspace_id,null,null,12,'{"photo_present":true}'::jsonb)),'REVOKED_GRANT_MATCHED');

 source_definition:=pg_get_functiondef('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 perform pg_temp.assert_photo_filter(position('cargo_photo_private_filter_matches' in source_definition)>0
  and position('cargo_photo_private_filter_matches' in source_definition)<position('order by (payload' in source_definition),
  'PHOTO_FILTER_NOT_BEFORE_PAGE_ORDER');
 perform pg_temp.assert_photo_filter(not has_function_privilege('anon',
  'public.cargo_photo_private_filter_matches(uuid,uuid,uuid,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated',
  'public.cargo_photo_private_filter_matches(uuid,uuid,uuid,jsonb)','EXECUTE'),
  'PHOTO_FILTER_DIRECT_CLIENT_ACCESS');
 raise notice 'PASS: business-only private photo filters, server age, live grants/assignment, ACL';
end $test$;
rollback;
