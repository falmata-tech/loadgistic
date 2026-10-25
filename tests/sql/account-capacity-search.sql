-- FEAT-CON-001: account search and map read the same exact grant. All rows roll back.
begin;
create function pg_temp.assert_search(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
do $test$
declare source_owner uuid:=gen_random_uuid();recipient_owner uuid:=gen_random_uuid();foreign_owner uuid:=gen_random_uuid();
 source_profile uuid:=gen_random_uuid();recipient_workspace uuid;foreign_workspace uuid;vehicle_id uuid;connection_id uuid;grant_id uuid;
 origin_ref text;destination_ref text;result jsonb;digest text:=repeat('0',64);
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (source_owner,'source-'||source_owner||'@example.invalid',now(),'{}'),
  (recipient_owner,'recipient-'||recipient_owner||'@example.invalid',now(),'{}'),
  (foreign_owner,'foreign-'||foreign_owner||'@example.invalid',now(),'{}');
 update profiles set role='DRIVER',active=true,drives_truck=true where id=source_owner;
 update profiles set role='SHIPPER',active=true where id in(recipient_owner,foreign_owner);
 insert into provider_profiles(id,user_id,business_name,handle) values
  (source_profile,source_owner,'Synthetic search source','search-source-'||substr(source_owner::text,1,8));
 insert into company_pages(provider_profile_id,published) values(source_profile,true);
 perform public.accept_content_policy(source_owner,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(source_owner,'{"make":"Isuzu","model":"Search fixture","plate":"ACCOUNT-202","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(source_owner,jsonb_build_object('driver_user_id',source_owner,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(source_owner,vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 perform public.publish_provider_capacity(source_owner,jsonb_build_object('vehicle_id',vehicle_id,'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 recipient_workspace:=(public.business_workspace_create(recipient_owner,jsonb_build_object('name','Synthetic search recipient','handle','search-recipient-'||substr(recipient_owner::text,1,8),'kind','BROKER'))->>'id')::uuid;
 foreign_workspace:=(public.business_workspace_create(foreign_owner,jsonb_build_object('name','Synthetic foreign recipient','handle','search-foreign-'||substr(foreign_owner::text,1,8),'kind','SHIPPER'))->>'id')::uuid;
 result:=public.request_account_connection(source_owner,'BUSINESS',recipient_workspace);
 connection_id:=(result->>'id')::uuid;
 perform public.decide_account_connection(recipient_owner,connection_id,'ACCEPT');
 result:=public.account_capacity_search_results(recipient_owner,digest,'{"q":"search-source"}'::jsonb,1);
 perform pg_temp.assert_search((result->>'total')::integer=0,'UNSHARED_SEARCH_VISIBLE');
 result:=public.grant_account_capacity_access(source_owner,connection_id,vehicle_id);
 grant_id:=(result->>'id')::uuid;
 result:=public.account_capacity_search_results(recipient_owner,digest,'{"q":"search-source"}'::jsonb,1);
 perform pg_temp.assert_search((result->>'total')::integer=1 and result->'items'->0->>'matching_trucks'='1','GRANTED_SEARCH_MISSING');
 perform pg_temp.assert_search((select count(*)=1 from public.account_capacity_filtered_page(recipient_owner,digest,null,null,100,'{}'::jsonb)),'MAP_SEARCH_DRIFT');
 result:=public.account_capacity_search_results(foreign_owner,digest,'{"q":"search-source"}'::jsonb,1);
 perform pg_temp.assert_search((result->>'total')::integer=0,'FOREIGN_ACCOUNT_SEARCH_VISIBLE');
 perform public.revoke_account_capacity_access(source_owner,grant_id,1);
 result:=public.account_capacity_search_results(recipient_owner,digest,'{"q":"search-source"}'::jsonb,1);
 perform pg_temp.assert_search((result->>'total')::integer=0,'REVOKED_SEARCH_VISIBLE');
 perform pg_temp.assert_search(not has_function_privilege('anon','public.account_capacity_search_results(uuid,text,jsonb,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.account_capacity_search_results(uuid,text,jsonb,integer)','EXECUTE'),'BROWSER_EXECUTE');
 raise notice 'PASS: account search/map parity, exact grant, foreign denial and revocation';
end $test$;
rollback;
