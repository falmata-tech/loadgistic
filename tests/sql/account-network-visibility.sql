-- FEAT-CON-001. All fixture rows roll back; only an opted-in aggregate is visible.
begin;
create function pg_temp.assert_visible(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
do $test$
declare target_owner uuid:=gen_random_uuid();viewer uuid:=gen_random_uuid();provider_owner uuid:=gen_random_uuid();
 target_workspace uuid:=gen_random_uuid();viewer_workspace uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();
 vehicle_id uuid;grant_id uuid;origin_ref text;destination_ref text;visible_count bigint;result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (target_owner,'network-target-'||target_owner||'@example.invalid',now(),'{}'),
  (viewer,'network-viewer-'||viewer||'@example.invalid',now(),'{}'),
  (provider_owner,'network-provider-'||provider_owner||'@example.invalid',now(),'{}');
 update public.profiles set role='SHIPPER',active=true,first_name='Target' where id=target_owner;
 update public.profiles set role='SHIPPER',active=true,first_name='Viewer' where id=viewer;
 update public.profiles set role='DRIVER',active=true,first_name='Provider',drives_truck=true where id=provider_owner;
 insert into public.business_workspaces(id,name,handle,kind) values
  (target_workspace,'Network target','network-target-'||substr(target_owner::text,1,10),'BROKER'),
  (viewer_workspace,'Network viewer','network-viewer-'||substr(viewer::text,1,10),'SHIPPER');
 insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity) values
  (target_workspace,target_owner,'OWNER',true),(viewer_workspace,viewer,'OWNER',true);
 perform pg_temp.assert_visible((public.business_network_preference(target_owner,target_workspace)->>'visible')::boolean=false,'DEFAULT_NOT_HIDDEN');
 select network_size into visible_count from public.account_directory_network_sizes(viewer,array['BUSINESS'],array[target_workspace]);
 perform pg_temp.assert_visible(visible_count is null,'HIDDEN_COUNT_EXPOSED');
 begin
  perform public.set_business_network_visibility(viewer,target_workspace,1,true);
  raise exception 'NON_OWNER_ALLOWED';
 exception when raise_exception then
  if sqlerrm='NON_OWNER_ALLOWED' then raise;end if;
  perform pg_temp.assert_visible(sqlerrm='NETWORK_FORBIDDEN','WRONG_NON_OWNER_ERROR');
 end;
 result:=public.set_business_network_visibility(target_owner,target_workspace,1,true);
 perform pg_temp.assert_visible((result->>'visible')::boolean=true and (result->>'version')::bigint=2,'OWNER_ENABLE_FAILED');
 select network_size into visible_count from public.account_directory_network_sizes(viewer,array['BUSINESS'],array[target_workspace]);
 perform pg_temp.assert_visible(visible_count=0,'VISIBLE_ZERO_NOT_RETURNED');
 insert into public.provider_profiles(id,user_id,business_name,handle)
 values(provider_id,provider_owner,'Network provider','network-provider-'||substr(provider_owner::text,1,10));
 insert into public.company_pages(provider_profile_id,published,account_name)
 values(provider_id,true,'Network provider');
 perform public.accept_content_policy(provider_owner,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(provider_owner,'{"make":"Isuzu","model":"Network fixture","plate":"NETWORK-204","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(provider_owner,jsonb_build_object('driver_user_id',provider_owner,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(provider_owner,vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 perform public.publish_provider_capacity(provider_owner,jsonb_build_object('vehicle_id',vehicle_id,'status','EMPTY',
  'visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 insert into public.business_capacity_grants(vehicle_id,workspace_id,created_by)
 values(vehicle_id,target_workspace,provider_owner) returning id into grant_id;
 select network_size into visible_count from public.account_directory_network_sizes(viewer,array['BUSINESS'],array[target_workspace]);
 perform pg_temp.assert_visible(visible_count=1,'CURRENT_GRANT_NOT_COUNTED');
 update public.business_capacity_grants set revoked_at=clock_timestamp() where id=grant_id;
 select network_size into visible_count from public.account_directory_network_sizes(viewer,array['BUSINESS'],array[target_workspace]);
 perform pg_temp.assert_visible(visible_count=0,'REVOKED_GRANT_STILL_COUNTED');
 perform public.set_business_network_visibility(target_owner,target_workspace,2,false);
 select network_size into visible_count from public.account_directory_network_sizes(viewer,array['BUSINESS'],array[target_workspace]);
 perform pg_temp.assert_visible(visible_count is null,'COUNT_NOT_REMOVED_IMMEDIATELY');
 perform pg_temp.assert_visible(not has_function_privilege('anon','public.account_directory_network_sizes(uuid,text[],uuid[])','EXECUTE')
  and not has_function_privilege('authenticated','public.set_business_network_visibility(uuid,uuid,bigint,boolean)','EXECUTE'),'DIRECT_EXECUTE_ALLOWED');
 raise notice 'PASS: network count is private by default, owner-controlled, distinct and current';
end $test$;
rollback;
