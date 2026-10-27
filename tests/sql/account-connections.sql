-- FEAT-CON-001. Synthetic account network fixtures are rolled back.
begin;
create function pg_temp.assert_connection(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
create function pg_temp.connection_denied(statement text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then
  if position('DIRECTORY_FORBIDDEN' in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_DIRECTORY_DENIAL';
end $$;
do $test$
declare provider_owner uuid:=gen_random_uuid();business_owner uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();driver_id uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();
 provider_id uuid:=gen_random_uuid();workspace_fixture_id uuid:=gen_random_uuid();org_id uuid:=gen_random_uuid();vehicle_fixture_id uuid:=gen_random_uuid();
 connection_id uuid;request_result jsonb;business_page jsonb;driver_page jsonb;driver_connection uuid;vehicle_grant jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (provider_owner,'provider-'||provider_owner||'@example.invalid',now(),'{}'),
  (business_owner,'business-'||business_owner||'@example.invalid',now(),'{}'),
  (staff_id,'staff-'||staff_id||'@example.invalid',now(),'{}'),
  (driver_id,'driver-'||driver_id||'@example.invalid',now(),'{}'),
  (outsider,'outsider-'||outsider||'@example.invalid',now(),'{}');
 update profiles set role='DRIVER',active=true,first_name='Amina' where id=provider_owner;
 update profiles set role='SHIPPER',active=true,first_name='Hana' where id in(business_owner,staff_id,outsider);
 update profiles set role='DRIVER',active=true,first_name='Tarek' where id=driver_id;
 insert into provider_profiles(id,user_id,business_name,handle)
 values(provider_id,provider_owner,'Synthetic hauler','directory-provider-'||substr(provider_owner::text,1,8));
 insert into company_pages(provider_profile_id,published,account_name) values(provider_id,true,'Synthetic hauler');
 insert into business_workspaces(id,name,handle,kind,city) values
  (workspace_fixture_id,'Synthetic cargo desk','directory-cargo-'||substr(business_owner::text,1,8),'BROKER','Adama');
 insert into business_workspace_members(workspace_id,user_id,role,can_view_capacity) values
  (workspace_fixture_id,business_owner,'OWNER',true),(workspace_fixture_id,staff_id,'STAFF',true);
 insert into organizations(id,name,handle,type) values(org_id,'Synthetic fleet','directory-fleet-'||substr(org_id::text,1,8),'TRANSPORT_COMPANY');
 insert into company_pages(organization_id,published) values(org_id,true);
 insert into organization_members(user_id,organization_id,membership_role) values
  (provider_owner,org_id,'OWNER'),(driver_id,org_id,'DRIVER');
 insert into vehicles(id,organization_id,label,category,active) values(vehicle_fixture_id,org_id,'Synthetic vehicle','TRUCK',true);
 insert into drivers(organization_id,user_id,name,active) values(org_id,driver_id,'Synthetic driver',true);
 insert into driver_vehicle_assignments(driver_user_id,vehicle_id,assigned_by,active)
 values(driver_id,vehicle_fixture_id,provider_owner,true);

 select payload into business_page from account_directory_page(provider_owner,'Synthetic cargo',0,12) limit 1;
 perform pg_temp.assert_connection(business_page->>'id'=workspace_fixture_id::text and business_page->>'kind'='BUSINESS'
  and business_page->>'managerName'='Hana' and business_page::text not like '%@example.invalid%','BUSINESS_DIRECTORY_IDENTITY');
 perform pg_temp.assert_connection((select count(*)=0 from account_directory_page(business_owner,'Tarek',0,12)),'EMPLOYED_DRIVER_NOT_STANDALONE_FIND');
 perform pg_temp.assert_connection((select count(*)=0 from account_directory_page(provider_owner,'directory-provider-',0,12)),'SELF_DIRECTORY_VISIBLE');
 perform pg_temp.connection_denied(format('select * from public.account_directory_page(%L)',outsider));
 perform pg_temp.connection_denied(format('select public.request_account_connection(%L,%L,%L)',staff_id,'PROVIDER_PROFILE',provider_id));

 request_result:=request_account_connection(provider_owner,'BUSINESS',workspace_fixture_id);
 connection_id:=(request_result->>'id')::uuid;
 perform pg_temp.assert_connection(request_result->>'status'='PENDING' and request_result->>'created'='true','REQUEST_NOT_PENDING');
 select payload into business_page from account_directory_page(provider_owner,'Synthetic cargo',0,12) limit 1;
 perform pg_temp.assert_connection(business_page->>'connectionStatus'='PENDING' and business_page->>'connectionDirection'='OUTGOING','PENDING_CARD_STATE');
 request_result:=request_account_connection(provider_owner,'BUSINESS',workspace_fixture_id);
 perform pg_temp.assert_connection(request_result->>'id'=connection_id::text and request_result->>'created'='false','DUPLICATE_REQUEST');
 request_result:=request_account_connection(business_owner,'PROVIDER_PROFILE',provider_id);
 perform pg_temp.assert_connection(request_result->>'id'=connection_id::text,'RECIPROCAL_REQUEST_DUPLICATE');
 perform pg_temp.assert_connection((select count(*)=0 from business_capacity_grants where workspace_id=workspace_fixture_id)
  and (select count(*)=0 from capacity_access_grants where vehicle_id=vehicle_fixture_id),'REQUEST_CREATED_CAPACITY_GRANT');
 perform pg_temp.connection_denied(format('select public.decide_account_connection(%L,%L,%L)',provider_owner,connection_id,'ACCEPT'));
 perform pg_temp.connection_denied(format('select public.decide_account_connection(%L,%L,%L)',staff_id,connection_id,'ACCEPT'));
 request_result:=decide_account_connection(business_owner,connection_id,'ACCEPT');
 perform pg_temp.assert_connection(request_result->>'status'='ACCEPTED','RECIPIENT_ACCEPTANCE');
 select payload into business_page from account_directory_page(provider_owner,'Synthetic cargo',0,12) limit 1;
 perform pg_temp.assert_connection(business_page->>'connectionStatus'='ACCEPTED','ACCEPTED_CARD_STATE');
 perform pg_temp.assert_connection((select count(*)=0 from business_capacity_grants where workspace_id=workspace_fixture_id)
  and (select count(*)=0 from capacity_access_grants where vehicle_id=vehicle_fixture_id),'ACCEPTANCE_CREATED_CAPACITY_GRANT');
 perform pg_temp.assert_connection((select count(*)=1 from account_connection_list(staff_id)
  where payload->>'status'='ACCEPTED' and payload->>'direction'='INCOMING' and payload->>'canManage'='false'),'STAFF_RELATIONSHIP_READ');

 request_result:=request_account_connection(business_owner,'DRIVER',driver_id);
 perform pg_temp.assert_connection(request_result->>'status'='PENDING','DRIVER_REQUEST');
 driver_connection:=(request_result->>'id')::uuid;
 insert into driver_permissions(user_id,can_manage_capacity) values(driver_id,true);
 request_result:=decide_account_connection(driver_id,driver_connection,'ACCEPT');
 perform pg_temp.assert_connection(request_result->>'status'='ACCEPTED','DRIVER_ACCEPTANCE');
 vehicle_grant:=grant_account_capacity_access(driver_id,driver_connection,vehicle_fixture_id);
 perform pg_temp.assert_connection(vehicle_grant->>'created'='true' and
  public.account_capacity_grant_valid((vehicle_grant->>'id')::uuid),'DRIVER_EXACT_VEHICLE_GRANT');
 perform pg_temp.assert_connection((select count(*)=0 from public.account_capacity_filtered_page(
  business_owner,repeat('0',64),null,null,100,'{}'::jsonb)),'ACCOUNT_MAP_QUERY_SAFE');
 perform pg_temp.assert_connection((select count(*)=0 from public.business_capacity_filtered_page(
  business_owner,workspace_fixture_id,null,null,100,'{}'::jsonb)),'BUSINESS_MAP_QUERY_SAFE');
 perform pg_temp.assert_connection((grant_account_capacity_access(driver_id,driver_connection,vehicle_fixture_id)->>'created')='false','DUPLICATE_VEHICLE_GRANT');
 perform pg_temp.connection_denied(format('select public.grant_account_capacity_access(%L,%L,%L)',staff_id,driver_connection,vehicle_fixture_id));
 update profiles set role='TRANSPORTER' where id=provider_owner;
 perform pg_temp.assert_connection((revoke_account_capacity_access(provider_owner,(vehicle_grant->>'id')::uuid,1)->>'revoked')='true',
  'PROVIDER_OWNER_REVOKES_DRIVER_GRANT');
 perform pg_temp.assert_connection(not public.account_capacity_grant_valid((vehicle_grant->>'id')::uuid),'REVOKED_GRANT_HIDDEN');
 vehicle_grant:=grant_account_capacity_access(driver_id,driver_connection,vehicle_fixture_id);
 request_result:=decide_account_connection(business_owner,driver_connection,'REVOKE');
 perform pg_temp.assert_connection(request_result->>'status'='REVOKED' and
  not public.account_capacity_grant_valid((vehicle_grant->>'id')::uuid),'DISCONNECT_STOPS_VEHICLE_ACCESS');
 request_result:=request_account_connection(business_owner,'DRIVER',driver_id);
 driver_connection:=(request_result->>'id')::uuid;
 perform pg_temp.assert_connection((decide_account_connection(driver_id,driver_connection,'ACCEPT')->>'status')='ACCEPTED','RECONNECT_ACCEPTED');
 vehicle_grant:=grant_account_capacity_access(driver_id,driver_connection,vehicle_fixture_id);
 update driver_vehicle_assignments set active=false where driver_user_id=driver_id and vehicle_id=vehicle_fixture_id;
 perform pg_temp.assert_connection(not public.account_capacity_grant_valid((vehicle_grant->>'id')::uuid),'REASSIGNED_DRIVER_GRANT_HIDDEN');
 perform pg_temp.assert_connection(not directory_account_visible('DRIVER',driver_id),'UNASSIGNED_DRIVER_VISIBLE');
 perform pg_temp.connection_denied(format('select public.decide_account_connection(%L,%L,%L)',driver_id,(request_result->>'id')::uuid,'ACCEPT'));
 update auth.users set email_confirmed_at=null where id=business_owner;
 perform pg_temp.connection_denied(format('select * from public.account_directory_page(%L)',business_owner));
 perform pg_temp.assert_connection(not has_function_privilege('anon','public.account_directory_page(uuid,text,integer,integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.request_account_connection(uuid,text,uuid)','EXECUTE')
  and not has_table_privilege('authenticated','public.account_connections','SELECT')
  and not has_table_privilege('authenticated','public.account_capacity_grants','SELECT'),'DIRECT_BROWSER_PRIVILEGE');
 raise notice 'PASS: signed-in directory, private first names, pending/accepted requests, exact vehicle grants, owner revocation and assignment invalidation';
end $test$;
rollback;
