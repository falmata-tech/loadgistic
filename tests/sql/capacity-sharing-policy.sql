-- Public/private sharing matrix for registered broker accounts. Synthetic and rolled back.
begin;
do $test$
declare provider_id uuid:=gen_random_uuid();broker_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();
 profile_id uuid:=gen_random_uuid();vehicle_id uuid;broker_workspace uuid;foreign_workspace uuid;
 connection_id uuid;grant_id uuid;capacity_id uuid;origin_ref text;destination_ref text;
 digest text:=encode(gen_random_bytes(32),'hex');mode_value text;expected_public boolean;expected_private boolean;
 command jsonb;result jsonb;payload jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (provider_id,'provider-'||provider_id||'@example.invalid',now(),'{}'),
  (broker_id,'broker-'||broker_id||'@example.invalid',now(),'{}'),
  (foreign_id,'foreign-'||foreign_id||'@example.invalid',now(),'{}');
 update profiles set role='DRIVER',active=true,drives_truck=true where id=provider_id;
 update profiles set role='SHIPPER',active=true where id in(broker_id,foreign_id);
 insert into provider_profiles(id,user_id,business_name,handle)
  values(profile_id,provider_id,'Sharing policy fixture','sharing-'||substr(provider_id::text,1,12));
 insert into company_pages(provider_profile_id,published) values(profile_id,true);
 perform accept_content_policy(provider_id,'2026-10-09');
 vehicle_id:=(create_provider_vehicle(provider_id,'{"make":"Isuzu","model":"Sharing fixture","plate":"SHARING-MATRIX","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(provider_id,jsonb_build_object('driver_user_id',provider_id,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(provider_id,vehicle_id,'LIVE');
 select id into strict origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from place_catalog where normalized_name='adama' limit 1;
 command:=jsonb_build_object('vehicle_id',vehicle_id,'status','EMPTY','accepted_loads','BOTH',
  'availability_geometry','ROUTE','location_source','DEVICE_OBSCURED',
  'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20,
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)));
 capacity_id:=publish_provider_capacity(provider_id,command||'{"sharing_mode":"PUBLIC"}');
 broker_workspace:=(business_workspace_create(broker_id,jsonb_build_object('name','Sharing broker','handle','sharing-broker-'||substr(broker_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 foreign_workspace:=(business_workspace_create(foreign_id,jsonb_build_object('name','Foreign shipper','handle','sharing-foreign-'||substr(foreign_id::text,1,8),'kind','SHIPPER'))->>'id')::uuid;
 result:=request_account_connection(provider_id,'BUSINESS',broker_workspace);
 connection_id:=(result->>'id')::uuid;
 perform decide_account_connection(broker_id,connection_id,'ACCEPT');
 if exists(select 1 from account_capacity_filtered_page(broker_id,digest))
 then raise exception 'CONNECTION_CREATED_CAPACITY_GRANT';end if;
 result:=grant_account_capacity_access(provider_id,connection_id,vehicle_id);grant_id:=(result->>'id')::uuid;
 if capacity_sharing_mode(vehicle_id)<>'BOTH' then raise exception 'GRANT_DID_NOT_ENABLE_PRIVATE';end if;
 foreach mode_value in array array['PUBLIC','PRIVATE','BOTH'] loop
  capacity_id:=publish_provider_capacity(provider_id,command||jsonb_build_object('sharing_mode',mode_value));
  update capacities set updated_at=clock_timestamp() where id=capacity_id;
  expected_public:=mode_value in('PUBLIC','BOTH');expected_private:=mode_value in('PRIVATE','BOTH');
  if exists(select 1 from public_capacity_page(jsonb_build_object('vehicle_ids',jsonb_build_array(vehicle_id)),null,null,14))<>expected_public
   then raise exception 'PUBLIC_PAGE_MODE_MATRIX: %',mode_value;end if;
  if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',capacity_id),null,null,14))<>expected_public
   then raise exception 'PUBLIC_SEARCH_MODE_MATRIX: %',mode_value;end if;
  select row.payload into payload from account_capacity_filtered_page(broker_id,digest,null,null,100,'{}') row
   where row.payload->>'vehicle_id'=vehicle_id::text;
  if (payload is not null)<>expected_private then raise exception 'PRIVATE_ACCOUNT_MODE_MATRIX: %',mode_value;end if;
  if expected_private and (payload ? 'recipient_email' or payload ? 'exclusive_email' or payload ? 'grants')
   then raise exception 'PRIVATE_ACCOUNT_CONTACT_LEAK';end if;
  if exists(select 1 from business_capacity_filtered_page(broker_id,broker_workspace) row where row.payload->>'vehicle_id'=vehicle_id::text)<>expected_private
   then raise exception 'PRIVATE_BUSINESS_MODE_MATRIX: %',mode_value;end if;
  if exists(select 1 from account_capacity_filtered_page(foreign_id,digest))
   or exists(select 1 from business_capacity_filtered_page(foreign_id,foreign_workspace))
   then raise exception 'FOREIGN_ACCOUNT_INHERITED_GRANT';end if;
 end loop;
 begin perform grant_private_capacity_access(provider_id,vehicle_id,'retired@example.invalid',digest);
  raise exception 'RETIRED_EMAIL_GRANT_ALLOWED';
 exception when others then if sqlerrm<>'EMAIL_CAPACITY_RETIRED' then raise;end if;end;
 begin perform set_provider_capacity_sharing(provider_id,vehicle_id,'EXCLUSIVE','retired@example.invalid',digest);
  raise exception 'RETIRED_EXCLUSIVE_MODE_ALLOWED';
 exception when others then if sqlerrm<>'EMAIL_CAPACITY_RETIRED' then raise;end if;end;
 begin perform set_provider_capacity_sharing(foreign_id,vehicle_id,'PUBLIC');
  raise exception 'FOREIGN_POLICY_MUTATION';
 exception when others then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 perform revoke_account_capacity_access(provider_id,grant_id,1);
 if exists(select 1 from account_capacity_filtered_page(broker_id,digest))
  or exists(select 1 from business_capacity_filtered_page(broker_id,broker_workspace))
  then raise exception 'REVOKED_ACCOUNT_GRANT_VISIBLE';end if;
 if has_table_privilege('anon','vehicle_capacity_sharing','SELECT')
  or has_table_privilege('authenticated','vehicle_capacity_sharing','SELECT')
  or has_function_privilege('anon','set_provider_capacity_sharing(uuid,uuid,text,text,text)','EXECUTE')
  or not(select relrowsecurity from pg_class where oid='vehicle_capacity_sharing'::regclass)
  then raise exception 'SHARING_BROWSER_ACCESS';end if;
 raise notice 'PASS: public/private/both, registered broker, foreign denial, retired email, revocation and RLS';
end $test$;
rollback;
