-- FEAT-CON-001. Derived account style is local-only test data and rolls back.
begin;
create function pg_temp.assert_status(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
do $test$
declare owner_id uuid:=gen_random_uuid();viewer_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();workspace_id uuid:=gen_random_uuid();fixture_vehicle_id uuid;origin_ref text;destination_ref text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (owner_id,'badge-owner-'||owner_id||'@example.invalid',now(),'{}'),
  (viewer_id,'badge-viewer-'||viewer_id||'@example.invalid',now(),'{}');
 update public.profiles set role='DRIVER',active=true,first_name='Mina',drives_truck=true where id=owner_id;
 update public.profiles set role='SHIPPER',active=true,first_name='Hana' where id=viewer_id;
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider_id,owner_id,'Badge fixture','badge-'||substr(owner_id::text,1,12));
 insert into public.company_pages(provider_profile_id,published,account_name)
 values(provider_id,true,'Badge fixture');
 insert into public.business_workspaces(id,name,handle,kind)
 values(workspace_id,'Badge cargo desk','badge-cargo-'||substr(viewer_id::text,1,10),'BROKER');
 insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity)
 values(workspace_id,viewer_id,'OWNER',true);
 perform pg_temp.assert_status(public.directory_account_status('PROVIDER_PROFILE',provider_id)='TRANSPORT_PROVIDER','EMPTY_FLEET_STYLE');
 perform pg_temp.assert_status((select status='TRANSPORT_PROVIDER' from public.account_directory_statuses(viewer_id,array['PROVIDER_PROFILE'],array[provider_id])),'DIRECTORY_STATUS_PAGE');
 perform public.accept_content_policy(owner_id,'2026-10-09');
 fixture_vehicle_id:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Badge fixture","plate":"BADGE-203","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',owner_id,'vehicle_id',fixture_vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(owner_id,fixture_vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 perform public.publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',fixture_vehicle_id,'status','EMPTY','visibility','PUBLIC','sharing_mode','PUBLIC','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 perform pg_temp.assert_status(public.directory_account_status('PROVIDER_PROFILE',provider_id)='SELF_MANAGED','SELF_MANAGED_STYLE');
 update public.driver_vehicle_assignments set active=false where driver_user_id=owner_id and vehicle_id=fixture_vehicle_id;
 perform pg_temp.assert_status(public.directory_account_status('PROVIDER_PROFILE',provider_id)='ACCOUNT_MANAGED','ASSIGNMENT_STATUS_NOT_REVALIDATED');
 perform pg_temp.assert_status(not has_function_privilege('anon','public.account_directory_statuses(uuid,text[],uuid[])','EXECUTE')
  and not has_function_privilege('authenticated','public.directory_account_status(text,uuid)','EXECUTE'),'DIRECT_EXECUTE_ALLOWED');
 raise notice 'PASS: directory account style follows current public fleet and driver assignment; browser roles cannot execute status functions';
end $test$;
rollback;
