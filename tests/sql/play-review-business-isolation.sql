-- FEAT-PLY-001 / FEAT-ENT-001: synthetic Play business access cannot cross
-- into real business accounts, even through guessed IDs or pending invitations.
begin;
create function pg_temp.assert_review_business(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
create function pg_temp.expect_review_business_denied(statement text,code text) returns void language plpgsql as $$
begin
 begin execute statement;exception when others then if position(code in sqlerrm)>0 then return;end if;raise;end;
 raise exception 'EXPECTED_REVIEW_BUSINESS_DENIAL:%',code;
end $$;
do $test$
declare review_owner uuid:=gen_random_uuid();review_staff uuid:=gen_random_uuid();real_owner uuid:=gen_random_uuid();
 review_profile uuid:=gen_random_uuid();staff_profile uuid:=gen_random_uuid();real_profile uuid:=gen_random_uuid();
 review_vehicle uuid;real_vehicle uuid;review_business uuid;real_business uuid;real_shipment uuid:=gen_random_uuid();
 review_shipment uuid:=gen_random_uuid();invite uuid;token text:='play-business-'||substr(gen_random_uuid()::text,1,8);
 version_value bigint;uid uuid;result jsonb;cmd jsonb;owner_digest text:=encode(gen_random_bytes(32),'hex');
 place_refs text[];capacity uuid;review_capacity_digest text:=encode(gen_random_bytes(32),'hex');
 review_tracking_digest text:=encode(gen_random_bytes(32),'hex');
begin
 foreach uid in array array[review_owner,review_staff,real_owner] loop
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  values(uid,'play-business-'||uid||'@example.test',now(),'{}');
 end loop;
 update public.profiles set role='DRIVER',active=true,drives_truck=true,first_name='Sample' where id in(review_owner,review_staff,real_owner);
 insert into public.provider_profiles(id,user_id,business_name,handle,review_workspace,public_visibility)
 values(review_profile,review_owner,'Private Play provider','play-review-'||substr(review_owner::text,1,12),true,'PRIVATE'),
  (staff_profile,review_staff,'Private Play staff','play-staff-'||substr(review_staff::text,1,12),true,'PRIVATE'),
  (real_profile,real_owner,'Ordinary provider','ordinary-'||substr(real_owner::text,1,12),false,'PUBLIC');
 insert into public.app_review_accounts(user_id,provider_profile_id,expected_role)
 values(review_owner,review_profile,'DRIVER'),(review_staff,staff_profile,'DRIVER');
 perform public.accept_content_policy(review_owner,'2026-10-09');
 perform public.accept_content_policy(real_owner,'2026-10-09');
 perform pg_temp.assert_review_business(public.native_review_account_allowed(review_owner)
  and public.native_review_account_allowed(review_staff),'REVIEW_LOGIN_FIXTURE_INVALID');

 review_business:=(public.business_workspace_create(review_owner,jsonb_build_object('name',token||' sample',
  'handle','playbiz-'||substr(review_owner::text,1,12),'kind','BROKER'))->>'id')::uuid;
 real_business:=(public.business_workspace_create(real_owner,jsonb_build_object('name',token||' ordinary',
  'handle','realbiz-'||substr(real_owner::text,1,12),'kind','SHIPPER'))->>'id')::uuid;
 update public.app_review_accounts set capacity_digest=review_capacity_digest,
  tracking_digest=review_tracking_digest where user_id=review_owner;
 perform pg_temp.assert_review_business((select review_workspace from public.business_workspaces where id=review_business)
  and not(select review_workspace from public.business_workspaces where id=real_business),'REVIEW_FLAG_WRONG');
 perform pg_temp.expect_review_business_denied(format('select public.business_workspace_create(%L,%L)',real_owner,
  jsonb_build_object('name','Ordinary collision','handle','playbiz-'||substr(review_owner::text,1,12),'kind','BROKER')::text),
  'ACCOUNT_HANDLE_UNAVAILABLE');
 perform pg_temp.assert_review_business(public.business_workspace_permission(review_owner,review_business,'OWNER')
  and public.business_workspace_permission(real_owner,real_business,'OWNER')
  and not public.business_workspace_permission(review_owner,real_business,'ACCESS')
  and not public.business_workspace_permission(real_owner,review_business,'ACCESS'),'MEMBERSHIP_BOUNDARY_BROKEN');

 version_value:=(select version from public.business_workspaces where id=review_business);
 invite:=(public.business_workspace_command(review_owner,review_business,jsonb_build_object('action','INVITE',
  'expectedVersion',version_value,'email','play-business-'||review_staff||'@example.test',
  'role','STAFF','capacity',true,'tracking',true))->>'invitationId')::uuid;
 result:=public.business_workspace_accept_invitation(review_staff,invite);
 perform pg_temp.assert_review_business(result->>'membershipRole'='STAFF'
  and public.business_workspace_permission(review_staff,review_business,'CAPACITY')
  and public.business_workspace_permission(review_staff,review_business,'TRACKING')
  and not public.business_workspace_permission(review_staff,review_business,'TEAM'),'STAFF_PERMISSIONS_WRONG');
 perform pg_temp.expect_review_business_denied(format('select public.business_workspace_select(%L,%L)',real_owner,review_business),'BUSINESS_FORBIDDEN');
 perform pg_temp.expect_review_business_denied(format('select public.business_workspace_select(%L,%L)',review_owner,real_business),'BUSINESS_FORBIDDEN');
 perform pg_temp.expect_review_business_denied(format('insert into public.business_workspace_members(workspace_id,user_id,role) values(%L,%L,''STAFF'')',review_business,real_owner),'REVIEW_WORKSPACE_ONLY');
 perform pg_temp.expect_review_business_denied(format('insert into public.business_workspace_members(workspace_id,user_id,role) values(%L,%L,''STAFF'')',real_business,review_staff),'REVIEW_WORKSPACE_ONLY');
 version_value:=(select version from public.business_workspaces where id=review_business);
 perform pg_temp.expect_review_business_denied(format('select public.business_workspace_command(%L,%L,%L::jsonb)',review_owner,review_business,
  jsonb_build_object('action','INVITE','expectedVersion',version_value,'email','play-business-'||real_owner||'@example.test','role','STAFF','capacity',true,'tracking',true)::text),'REVIEW_WORKSPACE_ONLY');
 version_value:=(select version from public.business_workspaces where id=real_business);
 perform pg_temp.expect_review_business_denied(format('select public.business_workspace_command(%L,%L,%L::jsonb)',real_owner,real_business,
  jsonb_build_object('action','INVITE','expectedVersion',version_value,'email','play-business-'||review_staff||'@example.test','role','STAFF','capacity',true,'tracking',true)::text),'REVIEW_WORKSPACE_ONLY');
 perform pg_temp.assert_review_business((select count(*)=0 from public.business_workspace_invitations i
  where i.workspace_id=review_business and i.email='play-business-'||real_owner||'@example.test'),'FOREIGN_INVITATION_PERSISTED');

 perform pg_temp.assert_review_business(jsonb_array_length(public.business_workspace_search(review_owner,token,20))=1
  and public.business_workspace_search(review_owner,token,20)->0->>'id'=review_business::text
  and jsonb_array_length(public.business_workspace_search(real_owner,token,20))=1
  and public.business_workspace_search(real_owner,token,20)->0->>'id'=real_business::text,'RECIPIENT_SEARCH_LEAK');
 perform pg_temp.assert_review_business((select count(*)=1 and min(payload->>'id')=review_business::text
  from public.provider_business_directory(review_owner,token,0,12))
  and (select count(*)=1 and min(payload->>'id')=real_business::text
   from public.provider_business_directory(real_owner,token,0,12)),'PROVIDER_DIRECTORY_LEAK');

 review_vehicle:=(public.create_provider_vehicle(review_owner,jsonb_build_object('make','Sample','model','Review','plate','PLY-'||substr(review_owner::text,1,9),
  'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
 real_vehicle:=(public.create_provider_vehicle(real_owner,jsonb_build_object('make','Sample','model','Ordinary','plate','REG-'||substr(real_owner::text,1,9),
  'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
 perform public.update_fleet_driver_access(review_owner,jsonb_build_object('driver_user_id',review_owner,'vehicle_id',review_vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.update_fleet_driver_access(real_owner,jsonb_build_object('driver_user_id',real_owner,'vehicle_id',real_vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 perform public.set_provider_vehicle_publication(review_owner,review_vehicle,'LIVE');
 perform public.set_provider_vehicle_publication(real_owner,real_vehicle,'LIVE');
 select array_agg(id order by id) into place_refs from(select id from public.place_catalog order by id limit 3) p;
 capacity:=public.publish_provider_capacity(real_owner,jsonb_build_object('vehicle_id',real_vehicle,'status','EMPTY','visibility','PRIVATE',
  'sharing_mode','PRIVATE','availability_geometry','ROUTE','accepted_loads','FTL',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',place_refs[1]),jsonb_build_object('place_ref',place_refs[3])),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 insert into public.business_capacity_grants(vehicle_id,workspace_id,created_by)
 values(review_vehicle,review_business,review_owner),(real_vehicle,real_business,real_owner);
 perform pg_temp.expect_review_business_denied(format('insert into public.business_capacity_grants(vehicle_id,workspace_id,created_by) values(%L,%L,%L)',review_vehicle,real_business,review_owner),'REVIEW_WORKSPACE_ONLY');
 perform pg_temp.expect_review_business_denied(format('insert into public.business_capacity_grants(vehicle_id,workspace_id,created_by) values(%L,%L,%L)',real_vehicle,review_business,real_owner),'REVIEW_WORKSPACE_ONLY');
 perform pg_temp.expect_review_business_denied(format('insert into public.capacity_access_grants(vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by) values(%L,''EMAIL'',%L,%L,%L)',
  review_vehicle,'play-business-'||review_staff||'@example.test',encode(gen_random_bytes(32),'hex'),review_owner),'EMAIL_CAPACITY_RETIRED');
 -- A historical cross-scope team grant must not enter the synthetic feed.
 alter table public.business_capacity_grants disable trigger guard_business_review_capacity_grant;
 insert into public.business_capacity_grants(vehicle_id,workspace_id,created_by)
 values(real_vehicle,review_business,real_owner);
 alter table public.business_capacity_grants enable trigger guard_business_review_capacity_grant;
 perform pg_temp.assert_review_business((select count(*)=0 from public.business_capacity_filtered_page(review_owner,review_business))
  and (public.business_capacity_search(review_owner,review_business,'Sample',1)->>'total')::integer=0,'CROSS_SCOPE_CAPACITY_LEAK');
 cmd:=jsonb_build_object('id',real_shipment,'code','LGX-'||upper(substr(replace(real_shipment::text,'-',''),1,8)),
  'vehicle_id',real_vehicle,'origin_place_ref',place_refs[1],'passing_place_ref',place_refs[2],
  'destination_place_ref',place_refs[3],'cargo_summary','Ordinary shipment',
  'customer_email','play-business-'||review_owner||'@example.test','customer_email_digest',owner_digest,
  'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',(current_date+2)::text,
  'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'));
 perform pg_temp.expect_review_business_denied(format('select public.create_provider_tracking_with_recipients(%L,%L)',real_owner,cmd::text),'REVIEW_WORKSPACE_ONLY');
 cmd:=cmd||jsonb_build_object('customer_email','play-business-'||real_owner||'@example.test');
 result:=public.create_provider_tracking_with_recipients(real_owner,cmd);
 perform pg_temp.assert_review_business(result->>'id'=real_shipment::text,'REAL_SHIPMENT_FIXTURE_MISSING');
 -- Simulate a historical misaddressed owner to prove guessed-ID attachment and
 -- read paths fail closed without relying only on a new-recipient trigger.
 alter table public.provider_tracking_recipients disable trigger guard_review_tracking_recipient;
 update public.provider_tracking_recipients set recipient_email='play-business-'||review_owner||'@example.test'
  where shipment_id=real_shipment and recipient_role='OWNER';
 alter table public.provider_tracking_recipients enable trigger guard_review_tracking_recipient;
 perform pg_temp.expect_review_business_denied(format('select public.tracking_owner_sharing_command(%L,%L,%L,%L,%L)',
  real_shipment,owner_digest,clock_timestamp(),jsonb_build_object('action','ATTACH_BUSINESS','expectedRevision',0,
   'workspaceId',review_business)::text,review_owner),'REVIEW_WORKSPACE_ONLY');
 insert into public.tracking_sharing_controls(shipment_id,owner_recipient_id)
 select real_shipment,id from public.provider_tracking_recipients where shipment_id=real_shipment and recipient_role='OWNER';
 alter table public.tracking_sharing_controls disable trigger guard_review_tracking_business;
 update public.tracking_sharing_controls set business_workspace_id=review_business,owner_actor_id=review_owner
  where shipment_id=real_shipment;
 alter table public.tracking_sharing_controls enable trigger guard_review_tracking_business;
 perform pg_temp.assert_review_business(not public.tracking_business_share_active(real_shipment,review_business)
  and (public.business_tracking_workspace(review_owner,review_business)->>'total')::integer=0,'LEGACY_TRACKING_TEAM_LEAK');
 perform pg_temp.expect_review_business_denied(format('select public.business_tracking_detail(%L,%L,%L)',
  review_owner,review_business,real_shipment),'BUSINESS_FORBIDDEN');
 update public.provider_shipments set assigned_vehicle_id=review_vehicle where id=real_shipment;
 perform pg_temp.assert_review_business(public.business_shipment_review_scope(real_shipment) is null
  and not public.tracking_business_share_active(real_shipment,review_business),'MIXED_SHIPMENT_SCOPE_NOT_CLOSED');
 update public.provider_shipments set assigned_vehicle_id=real_vehicle where id=real_shipment;
 cmd:=jsonb_build_object('id',review_shipment,'code','LGX-'||upper(substr(replace(review_shipment::text,'-',''),1,8)),
  'vehicle_id',review_vehicle,'origin_place_ref',place_refs[1],'passing_place_ref',place_refs[2],
  'destination_place_ref',place_refs[3],'cargo_summary','Synthetic review shipment',
  'customer_email','play-business-'||real_owner||'@example.test','customer_email_digest',owner_digest,
  'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',(current_date+2)::text,
  'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'));
 perform pg_temp.expect_review_business_denied(format('select public.create_provider_tracking_with_recipients(%L,%L)',review_owner,cmd::text),'REVIEW_WORKSPACE_ONLY');
 cmd:=cmd||jsonb_build_object('customer_email','play-business-'||review_staff||'@example.test');
 result:=public.create_provider_tracking_with_recipients(review_owner,cmd);
 perform pg_temp.assert_review_business(result->>'id'=review_shipment::text,'REVIEW_SHIPMENT_FIXTURE_MISSING');
 result:=public.tracking_owner_sharing_command(review_shipment,owner_digest,clock_timestamp(),
  jsonb_build_object('action','ATTACH_BUSINESS','expectedRevision',0,'workspaceId',review_business),review_staff);
 perform pg_temp.expect_review_business_denied(format('select public.tracking_owner_sharing_command(%L,%L,%L,%L)',
  review_shipment,owner_digest,clock_timestamp(),jsonb_build_object('action','ADD_VIEWER','expectedRevision',1,
   'name','Ordinary recipient','email','play-business-'||real_owner||'@example.test',
   'digest',review_tracking_digest)::text),'REVIEW_WORKSPACE_ONLY');
 perform pg_temp.assert_review_business(public.tracking_business_share_active(review_shipment,review_business)
  and (public.business_tracking_workspace(review_owner,review_business)->>'total')::integer=1
  and (public.business_tracking_detail(review_owner,review_business,review_shipment)->'shipment'->>'can_view_location')='false'
  and (public.business_tracking_detail(review_staff,review_business,review_shipment)->'shipment'->>'can_view_location')='true',
  'SYNTHETIC_TRACKING_TEAM_FLOW_BROKEN');
 perform pg_temp.assert_review_business((select count(*)=0 from public.email_deliveries
  where shipment_id=review_shipment and recipient_email='play-business-'||real_owner||'@example.test'),
  'REAL_EMAIL_QUEUED_FROM_REVIEW_SHIPMENT');
 perform pg_temp.expect_review_business_denied(format('update public.business_workspaces set review_workspace=false where id=%L',review_business),'REVIEW_SCOPE_IMMUTABLE');

 update public.app_review_accounts set enabled=false where user_id=review_staff;
 perform pg_temp.assert_review_business(not public.native_review_account_allowed(review_staff)
  and public.business_review_identity(review_staff)
  and not public.business_workspace_permission(review_staff,real_business,'ACCESS')
  and jsonb_array_length(public.business_workspace_search(review_staff,token,20))=1,
  'DISABLED_REVIEWER_BECAME_REAL_CUSTOMER');
 perform pg_temp.assert_review_business(not has_function_privilege('authenticated','public.business_review_identity(uuid)','EXECUTE')
  and not has_table_privilege('authenticated','public.business_workspaces','SELECT'),
  'REVIEW_FLAG_BROWSER_EXPOSURE');
 raise notice 'PASS: private reviewer business owner/staff, search, membership, invites, retired email Capacity, Tracking attachment/detail, disabled marker and ACL';
end $test$;
rollback;
