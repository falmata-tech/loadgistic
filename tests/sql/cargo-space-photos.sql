-- FEAT-CSP-001. Disposable identities, no Storage object writes; all rows roll back.
begin;
create function pg_temp.assert_cargo_photo(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
create function pg_temp.cargo_photo_denied(statement text,code text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then
  if position(code in sqlerrm)>0 then return;end if;
  raise;
 end;
 raise exception 'EXPECTED_CARGO_PHOTO_DENIAL:%',code;
end $$;
do $test$
declare provider_id uuid:=gen_random_uuid();broker_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();
 foreign_id uuid:=gen_random_uuid();provider_profile_id uuid:=gen_random_uuid();vehicle_id uuid;original_vehicle_id uuid;other_vehicle_id uuid;
 broker_workspace uuid;foreign_workspace uuid;connection_id uuid;grant_id uuid;photo_id uuid;
 assignment_id uuid;original_assigned_at timestamptz;first_request uuid;invitation_id uuid;version_value bigint;request_key uuid:=gen_random_uuid();
 saved jsonb;reference text;origin_ref text;destination_ref text;signature text;role_name text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (provider_id,'cargo-provider-'||provider_id||'@example.invalid',now(),'{}'),
  (broker_id,'cargo-broker-'||broker_id||'@example.invalid',now(),'{}'),
  (staff_id,'cargo-staff-'||staff_id||'@example.invalid',now(),'{}'),
  (foreign_id,'cargo-foreign-'||foreign_id||'@example.invalid',now(),'{}');
 update public.profiles set role='DRIVER',active=true,drives_truck=true where id=provider_id;
 update public.profiles set role='SHIPPER',active=true where id in(broker_id,staff_id,foreign_id);
 insert into public.provider_profiles(id,user_id,business_name,handle)
  values(provider_profile_id,provider_id,'Cargo photo fixture','cargo-'||substr(provider_id::text,1,12));
 insert into public.company_pages(provider_profile_id,published) values(provider_profile_id,true);
 perform public.accept_content_policy(provider_id,'2026-10-09');
 vehicle_id:=(public.create_provider_vehicle(provider_id,
  '{"make":"Isuzu","model":"Cargo photo fixture","plate":"CARGO-219","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform public.update_fleet_driver_access(provider_id,jsonb_build_object('driver_user_id',provider_id,
  'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(provider_id,vehicle_id,'LIVE');
 select id into strict origin_ref from public.place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from public.place_catalog where normalized_name='adama' limit 1;
 perform public.publish_provider_capacity(provider_id,jsonb_build_object('vehicle_id',vehicle_id,
  'status','EMPTY','visibility','PRIVATE','sharing_mode','PRIVATE','availability_geometry','ROUTE',
  'accepted_loads','FTL','current_route_places',jsonb_build_array(
   jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 broker_workspace:=(public.business_workspace_create(broker_id,jsonb_build_object('name','Cargo Broker',
  'handle','cargo-broker-'||substr(broker_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 foreign_workspace:=(public.business_workspace_create(foreign_id,jsonb_build_object('name','Other Cargo Broker',
  'handle','cargo-other-'||substr(foreign_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_business_summary(%L,%L,%L)',
  broker_id,broker_workspace,vehicle_id),'CARGO_PHOTO_FORBIDDEN');

 saved:=public.request_account_connection(provider_id,'BUSINESS',broker_workspace);
 connection_id:=(saved->>'id')::uuid;
 perform public.decide_account_connection(broker_id,connection_id,'ACCEPT');
 saved:=public.grant_account_capacity_access(provider_id,connection_id,vehicle_id);
 grant_id:=(saved->>'id')::uuid;
 perform pg_temp.assert_cargo_photo(public.cargo_photo_business_summary(broker_id,broker_workspace,vehicle_id)->'photo'='null'::jsonb,
  'PRIVATE_SUMMARY_WITHOUT_PHOTO');
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_business_summary(%L,%L,%L)',
  foreign_id,foreign_workspace,vehicle_id),'CARGO_PHOTO_FORBIDDEN');

 reference:='supabase://capacity-photo/capacity/2026-10-26/'||gen_random_uuid()||'.jpg';
 photo_id:=public.cargo_photo_reserve(provider_id,vehicle_id,reference,'CAMERA',now()-interval '1 hour',1024);
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_activate(%L,%L)',broker_id,photo_id),'CARGO_PHOTO_FORBIDDEN');
 perform pg_temp.assert_cargo_photo(public.cargo_photo_business_summary(broker_id,broker_workspace,vehicle_id)->'photo'='null'::jsonb,
  'PENDING_PHOTO_VISIBLE');
 saved:=public.cargo_photo_request(broker_id,broker_workspace,vehicle_id,request_key);
 first_request:=(saved->>'id')::uuid;
 perform pg_temp.assert_cargo_photo((saved->>'created')::boolean,'REQUEST_NOT_CREATED');
 saved:=public.cargo_photo_request(broker_id,broker_workspace,vehicle_id,request_key);
 perform pg_temp.assert_cargo_photo((saved->>'id')::uuid=first_request and not(saved->>'created')::boolean,
  'REQUEST_NOT_IDEMPOTENT');
 saved:=public.cargo_photo_provider_state(provider_id,vehicle_id);
 perform pg_temp.assert_cargo_photo(jsonb_array_length(saved->'requests')=1,'REQUEST_NOT_SHOWN_TO_DRIVER');
 perform public.cargo_photo_activate(provider_id,photo_id);
 saved:=public.cargo_photo_business_summary(broker_id,broker_workspace,vehicle_id);
 perform pg_temp.assert_cargo_photo((saved->'photo'->>'id')::uuid=photo_id
  and saved::text not like '%supabase://%' and saved->'request'->>'status'='FULFILLED','PRIVATE_PHOTO_METADATA');
 perform pg_temp.assert_cargo_photo(public.cargo_photo_business_file(broker_id,broker_workspace,photo_id)->>'storagePath'=reference,
  'AUTHORIZED_FILE_MISSING');
 perform pg_temp.assert_cargo_photo(public.cargo_photo_discard_pending(provider_id,photo_id) is null,
  'AMBIGUOUS_RETRY_DELETED_ACTIVE');
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_request(%L,%L,%L,%L)',
  broker_id,broker_workspace,vehicle_id,gen_random_uuid()),'CARGO_PHOTO_RATE_LIMITED');

 saved:=public.business_workspace_command(broker_id,broker_workspace,jsonb_build_object('action','INVITE',
  'expectedVersion',1,'email','cargo-staff-'||staff_id||'@example.invalid','role','STAFF','capacity',true,'tracking',false));
 invitation_id:=(saved->>'invitationId')::uuid;
 perform public.business_workspace_accept_invitation(staff_id,invitation_id);
 perform pg_temp.assert_cargo_photo(public.cargo_photo_business_file(staff_id,broker_workspace,photo_id)->>'storagePath'=reference,
  'CAPACITY_STAFF_FILE_MISSING');
 version_value:=(select version from public.business_workspaces where id=broker_workspace);
 perform public.business_workspace_command(broker_id,broker_workspace,jsonb_build_object('action','UPDATE_MEMBER',
  'expectedVersion',version_value,'userId',staff_id,'role','STAFF','capacity',false,'tracking',true,'active',true));
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_business_file(%L,%L,%L)',
  staff_id,broker_workspace,photo_id),'CARGO_PHOTO_NOT_FOUND');

 original_vehicle_id:=vehicle_id;
 select a.id,a.assigned_at into assignment_id,original_assigned_at
  from public.driver_vehicle_assignments a
  where a.id=public.cargo_photo_driver_assignment(provider_id,original_vehicle_id);
 perform pg_temp.assert_cargo_photo(assignment_id is not null,'ACTIVE_DRIVER_ASSIGNMENT_MISSING');
 other_vehicle_id:=(public.create_provider_vehicle(provider_id,
  '{"make":"Isuzu","model":"Reassigned cargo fixture","plate":"CARGO-219-B","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 -- An in-place assignment transfer with the old assigned_at must not preserve photo access.
 update public.driver_vehicle_assignments set vehicle_id=other_vehicle_id where id=assignment_id;
 perform pg_temp.assert_cargo_photo((select state='DELETING' from public.cargo_space_photos where id=photo_id),
  'REASSIGNMENT_DID_NOT_PERMANENTLY_RETIRE_PHOTO');
 perform pg_temp.assert_cargo_photo(public.cargo_photo_business_summary(broker_id,broker_workspace,vehicle_id)->'photo'='null'::jsonb,
  'REASSIGNED_VEHICLE_PHOTO_IN_SUMMARY');
 perform pg_temp.assert_cargo_photo(public.cargo_photo_provider_state(provider_id,vehicle_id)->'photo'='null'::jsonb,
  'REASSIGNED_VEHICLE_PHOTO_IN_PROVIDER_STATE');
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_business_file(%L,%L,%L)',
  broker_id,broker_workspace,photo_id),'CARGO_PHOTO_NOT_FOUND');
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_provider_file(%L,%L)',
  provider_id,photo_id),'CARGO_PHOTO_NOT_FOUND');
 update public.driver_vehicle_assignments set vehicle_id=original_vehicle_id,assigned_at=original_assigned_at
  where id=assignment_id;
 perform pg_temp.assert_cargo_photo(public.cargo_photo_business_summary(broker_id,broker_workspace,original_vehicle_id)->'photo'='null'::jsonb,
  'RETURNED_ASSIGNMENT_RESURRECTED_PHOTO');
 update public.driver_vehicle_assignments set active=false where id=assignment_id;
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_business_file(%L,%L,%L)',
  broker_id,broker_workspace,photo_id),'CARGO_PHOTO_NOT_FOUND');
 update public.driver_vehicle_assignments set active=true,assigned_at=clock_timestamp() where id=assignment_id;
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_business_file(%L,%L,%L)',
  broker_id,broker_workspace,photo_id),'CARGO_PHOTO_NOT_FOUND');
 perform public.cargo_photo_mark_delete(provider_id,photo_id);
 perform pg_temp.assert_cargo_photo((select state='DELETING' from public.cargo_space_photos where id=photo_id),
  'OWNER_REMOVE_DID_NOT_REVOKE');
 update public.cargo_space_photos set cleanup_after='1900-01-01 UTC' where id=photo_id;
 perform pg_temp.assert_cargo_photo(exists(select 1 from public.cargo_photo_cleanup_candidates(1)
  where id=photo_id),'PHOTO_CLEANUP_NOT_CLAIMED');
 perform pg_temp.assert_cargo_photo(not exists(select 1 from public.cargo_photo_cleanup_candidates(1)
  where id=photo_id),'PHOTO_CLEANUP_NOT_LEASED');
 update public.cargo_space_photos set state='DELETED' where id=photo_id;
 perform pg_temp.assert_cargo_photo(exists(select 1 from public.cargo_space_photo_requests
  where id=first_request and status='FULFILLED' and fulfilled_photo_id=photo_id),
  'FULFILLED_REQUEST_HISTORY_LOST');
 perform public.cargo_photo_mark_delete(provider_id,photo_id);
 perform pg_temp.assert_cargo_photo((select state='DELETED' from public.cargo_space_photos where id=photo_id),
  'REMOVAL_REQUEUED_TERMINAL_PHOTO');
 perform public.revoke_account_capacity_access(provider_id,grant_id,1);
 perform pg_temp.cargo_photo_denied(format('select public.cargo_photo_business_summary(%L,%L,%L)',
  broker_id,broker_workspace,vehicle_id),'CARGO_PHOTO_FORBIDDEN');

 foreach role_name in array array['anon','authenticated'] loop
  perform pg_temp.assert_cargo_photo(not has_table_privilege(role_name,'public.cargo_space_photos','SELECT')
   and not has_table_privilege(role_name,'public.cargo_space_photo_requests','SELECT'),'CLIENT_TABLE_READ');
  foreach signature in array array[
   'public.cargo_photo_assignment_invalidate()',
   'public.cargo_photo_reserve(uuid,uuid,text,text,timestamptz,integer)',
   'public.cargo_photo_activate(uuid,uuid)','public.cargo_photo_provider_file(uuid,uuid)',
   'public.cargo_photo_business_file(uuid,uuid,uuid)',
   'public.cargo_photo_business_summary(uuid,uuid,uuid)','public.cargo_photo_request(uuid,uuid,uuid,uuid)'] loop
   perform pg_temp.assert_cargo_photo(not has_function_privilege(role_name,signature,'EXECUTE'),'CLIENT_RPC_ACCESS');
  end loop;
 end loop;
 perform pg_temp.assert_cargo_photo(exists(select 1 from storage.buckets where id='capacity-photo' and public=false)
  and exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity)
  and not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
   and permissive='PERMISSIVE'),
  'DIRECT_STORAGE_READ_GUARD');
 raise notice 'PASS: private cargo photo assignment, business/team grant, request, reauth, reassignment and storage guards';
end $test$;
rollback;
