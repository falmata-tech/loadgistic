-- FEAT-FLT-001 / FEAT-IAM-001 / ADR-079. Synthetic, rollback-only contracts.
begin;
create function pg_temp.fleet_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'PROVIDER_FLEET_ASSERT: %',label;end if;end $$;
create function pg_temp.fleet_denied(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'PROVIDER_FLEET_DENIAL_MISSING: %',expected;
end $$;
do $test$
<<provider_owner_fleet_test>>
declare owner_id uuid:=gen_random_uuid();other_owner uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();
 company_owner uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();other_provider uuid:=gen_random_uuid();org uuid:=gen_random_uuid();
 first_truck uuid;second_truck uuid;third_truck uuid;company_truck uuid;invitee uuid:=gen_random_uuid();invite_id uuid;
 command jsonb;capacity_command jsonb;access jsonb;projection jsonb;shipment_id uuid:=gen_random_uuid();origin_ref text;destination_ref text;passing_ref text;
 before_capacities integer;before_history integer;history_id uuid;latest jsonb;admin_id uuid;source_id uuid;recipient_count integer;
 employee_permission uuid;center jsonb;business_shipment uuid:=gen_random_uuid();device_digest text:=encode(gen_random_bytes(32),'hex');location jsonb;proof jsonb;approved_stamp timestamptz;
 session_id uuid:=gen_random_uuid();installation_id uuid:=gen_random_uuid();installation_secret text:=encode(gen_random_bytes(32),'hex');binding jsonb;
 prior_first_name text;prior_last_name text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,owner_id||'@example.test',now(),'{}','{}'),(other_owner,other_owner||'@example.test',now(),'{}','{}'),
 (company_owner,company_owner||'@example.test',now(),'{}','{}'),(employee,employee||'@example.test',null,'{}','{}'),
 (invitee,invitee||'@example.test',now(),'{}','{}');
 update profiles set active=true,role='DRIVER',drives_truck=true where id in(owner_id,other_owner);
 update profiles set active=true,role='TRANSPORTER',drives_truck=true where id=company_owner;
 insert into provider_profiles(id,user_id,business_name,handle) values
 (provider_id,owner_id,'Synthetic provider','fleet-'||owner_id),(other_provider,other_owner,'Other synthetic provider','fleet-'||other_owner);
 insert into organizations(id,name,handle,type) values(org,'Synthetic business','fleet-'||company_owner,'TRANSPORT_COMPANY');
 insert into organization_members(user_id,organization_id,membership_role) values(company_owner,org,'OWNER');
 perform accept_content_policy(owner_id,'2026-10-09');perform accept_content_policy(company_owner,'2026-10-09');
 command:='{"make":"Isuzu","model":"Fleet test","plate":"FLEET-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}';
 first_truck:=(create_provider_vehicle(owner_id,command)->>'id')::uuid;
 second_truck:=(create_provider_vehicle(owner_id,command||'{"plate":"FLEET-TWO","use_basis":"FINANCED"}')->>'id')::uuid;
 third_truck:=(create_provider_vehicle(owner_id,command||'{"plate":"FLEET-THREE","use_basis":"PERMISSION"}')->>'id')::uuid;
 company_truck:=(create_provider_vehicle(company_owner,command)->>'id')::uuid;
 perform pg_temp.fleet_assert((select count(*)=3 from vehicles where provider_profile_id=provider_id and active),'multiple_personal_trucks');
 perform pg_temp.fleet_assert((select bool_and(publication_status='DRAFT') from vehicles where id in(first_truck,second_truck,third_truck,company_truck)),'new_trucks_draft');
 perform pg_temp.fleet_assert(capacity_active_driver_id(first_truck) is null and capacity_active_driver_id(second_truck) is null,'no_implicit_owner_assignment');
 perform pg_temp.fleet_denied(format('select create_provider_vehicle(%L,%L)',owner_id,command-'use_basis'),'INVALID_VEHICLE_USE_BASIS');
 access:=jsonb_build_object('driver_user_id',owner_id,'vehicle_id',first_truck,'can_manage_capacity',true,'can_manage_tracking',true);
 perform update_fleet_driver_access(owner_id,access);
 perform pg_temp.fleet_assert(capacity_active_driver_id(first_truck)=owner_id,'personal_self_assignment');
 perform update_fleet_driver_access(company_owner,access||jsonb_build_object('driver_user_id',company_owner,'vehicle_id',company_truck));
 perform pg_temp.fleet_assert(capacity_active_driver_id(company_truck)=company_owner,'business_owner_drives_without_role_conversion');
 perform pg_temp.fleet_assert((select role='TRANSPORTER' from profiles where id=company_owner),'business_role_preserved');
 perform pg_temp.fleet_assert((select count(*)=1 from fleet_driver_page(company_owner) where payload->>'is_owner'='true'),'virtual_owner_driver_row');
 command:=jsonb_build_object('name','Synthetic employee','email',employee||'@example.test','phone','+251900000001');
 perform fleet_register_driver(owner_id,employee,command);
 perform pg_temp.fleet_assert((select organization_id is null and provider_profile_id=provider_id from drivers where user_id=employee),'personal_employer_anchor');
 perform pg_temp.fleet_assert((select email_confirmed_at is null from auth.users where id=employee),'registration_does_not_verify_email');
 perform pg_temp.fleet_assert(not exists(select 1 from provider_profiles where user_id=employee),'employee_does_not_own_employer_profile');
 perform set_config('request.jwt.claim.sub',employee::text,true);
 perform pg_temp.fleet_assert(current_user_projection() is null,'unverified_employee_identity_denied');
 perform update_fleet_driver_access(owner_id,access||jsonb_build_object('driver_user_id',employee,'vehicle_id',second_truck));
 perform pg_temp.fleet_assert(capacity_active_driver_id(second_truck)=employee,'assign_before_employee_login');
 update auth.users set email_confirmed_at=now() where id=employee;
 projection:=current_user_projection();
 perform pg_temp.fleet_assert(projection->>'employer_provider_profile_id'=provider_id::text and projection->>'provider_profile_id' is null,'employer_distinct_from_owner_identity');
 perform pg_temp.fleet_assert((projection->>'can_manage_fleet')::boolean=false and(projection->>'owns_provider_account')::boolean=false,'employee_no_owner_capabilities');
 perform pg_temp.fleet_assert((projection->>'drives_truck')::boolean=true,'employee_keeps_map_based_driving_home');
 perform pg_temp.fleet_assert(projection->>'current_driven_vehicle_id'=second_truck::text and projection->>'current_driver_id'=employee::text,'employee_current_pair_projection');
 perform pg_temp.fleet_assert((provider_capacity_workspace(employee)->'vehicles'->0->>'id')=second_truck::text
  and jsonb_array_length(provider_capacity_workspace(employee)->'vehicles')=1,'employee_assigned_only_workspace');
 perform pg_temp.fleet_denied(format('select create_provider_vehicle(%L,%L)',employee,'{"make":"Isuzu","model":"Denied","plate":"DENIED","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}'),'FORBIDDEN');
 perform pg_temp.fleet_denied(format('select fleet_pending_invitations(%L)',employee),'FORBIDDEN');
 perform pg_temp.fleet_denied(format('select update_fleet_driver_access(%L,%L)',other_owner,access),'NOT_FOUND');
 perform pg_temp.fleet_denied(format('select update_fleet_driver_access(%L,%L)',owner_id,access||jsonb_build_object('vehicle_id',company_truck)),'NOT_FOUND');
 perform refresh_provider_capacity_location(owner_id,jsonb_build_object('vehicle_id',first_truck,'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 -- A phone fix for an unassigned truck is rejected before Capacity's older
 -- driver check can run; it must never record a location for that truck.
 perform pg_temp.fleet_denied(format('select refresh_provider_capacity_location(%L,%L)',owner_id,jsonb_build_object('vehicle_id',second_truck,'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20)),'FORBIDDEN');
 perform pg_temp.fleet_assert(not exists(select 1 from vehicle_driver_locations where vehicle_id=second_truck),'unassigned_phone_fix_not_recorded');
 perform grant_private_capacity_access(owner_id,first_truck,'synthetic-recipient@example.test',repeat('9',64));
 -- The same foundation regression also runs after the reviewed-publication
 -- migration. Establish a real approved synthetic title rather than bypass it.
 if to_regprocedure('public.confirm_provider_vehicle_authority(uuid,uuid,jsonb)') is not null then
  select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
  source_id:=submit_managed_verification(owner_id,jsonb_build_object('subject_type','VEHICLE','subject_id',first_truck,
   'verification_type','VEHICLE_OWNERSHIP','document_name','Synthetic title','storage_path','supabase://verification/verification/fleet-test.pdf',
   'original_name','fixture.pdf','mime_type','application/pdf'));
  perform review_managed_verification(admin_id,source_id,'APPROVED','Synthetic document review.');
  perform confirm_provider_vehicle_authority(admin_id,source_id,jsonb_strip_nulls(jsonb_build_object(
   'fact_kind','OWNERSHIP','review_note','Synthetic exact provider title holder.',
   'context_revision',managed_provider_authority_review_context(admin_id,array[source_id])->0->>'contextRevision')));
  perform set_provider_vehicle_publication(owner_id,first_truck,'LIVE');
  center:=managed_verification_center(owner_id);
  perform pg_temp.fleet_assert(exists(select 1 from jsonb_array_elements(center->'subjects') subject
   where subject->>'subject_type'='DRIVER' and subject->>'subject_id'=employee::text),'personal_owner_employee_document_subject');
  center:=managed_verification_center(company_owner);
  perform pg_temp.fleet_assert(exists(select 1 from jsonb_array_elements(center->'subjects') subject
   where subject->>'subject_type'='DRIVER' and subject->>'subject_id'=company_owner::text),'business_owner_self_driver_document_subject');
  employee_permission:=submit_managed_verification(employee,jsonb_build_object('subject_type','VEHICLE','subject_id',second_truck,
   'verification_type','VEHICLE_AUTHORIZATION','document_name','Synthetic driver permission','storage_path','supabase://verification/verification/fleet-driver.pdf',
   'original_name','fixture.pdf','mime_type','application/pdf','expires_on',(current_date+30)::text));
  perform review_managed_verification(admin_id,employee_permission,'APPROVED','Synthetic driver permission review.');
  perform pg_temp.fleet_assert((select subject_type='DRIVER' and subject_id=employee and related_vehicle_id=second_truck
   from verification_requests where id=employee_permission),'driver_permission_is_pair_specific');
  perform pg_temp.fleet_denied(format('select confirm_provider_vehicle_authority(%L,%L,%L)',admin_id,employee_permission,
   '{"fact_kind":"PERMISSION","review_note":"Synthetic denied provider authority conversion."}'),'AUTHORITY_SOURCE_MISMATCH');
  perform pg_temp.fleet_assert((managed_provider_publication_eligibility(owner_id)->>'qualifyingTruckCount')::integer=1,'driver_permission_never_unlocks_provider_publication');
 end if;
 select id into origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into destination_ref from place_catalog where normalized_name='adama' limit 1;
 capacity_command:=jsonb_build_object('vehicle_id',first_truck,'status','EMPTY','visibility','PRIVATE',
  'availability_geometry','ROUTE','accepted_loads','FTL','current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20);
 history_id:=publish_provider_capacity(owner_id,capacity_command);
 perform pg_temp.fleet_assert((select id=history_id and coalesce(market_status,status::text)='EMPTY'
  from capacities where vehicle_id=first_truck order by updated_at desc,id desc limit 1),'actual_assignment_then_publish_is_latest');
 select count(*) into before_history from capacities where vehicle_id=first_truck;
 perform update_fleet_driver_access(owner_id,access); -- no pair change: preserve current signal
 perform pg_temp.fleet_assert((select count(*)=before_history from capacities where vehicle_id=first_truck),'same_assignment_keeps_signal');
 perform update_fleet_driver_access(owner_id,access||jsonb_build_object('driver_user_id',employee));
 perform pg_temp.fleet_assert(capacity_active_driver_id(first_truck)=employee and capacity_active_driver_id(second_truck) is null,'one_current_pair_after_reassignment');
 perform pg_temp.fleet_assert((select coalesce(market_status,status::text)='OFF_DUTY' from capacities where vehicle_id=first_truck order by updated_at desc,id desc limit 1),'changed_pair_off_duty');
 perform pg_temp.fleet_assert(exists(select 1 from capacities where id=history_id) and exists(select 1 from capacity_access_grants where vehicle_id=first_truck),'history_and_named_sharing_preserved');
 perform pg_temp.fleet_assert(not exists(select 1 from jsonb_array_elements(provider_capacity_workspace(owner_id)->'vehicles') v
  where v->>'id'=first_truck::text and v->'driver_location' is not null and v->'driver_location'<>'null'::jsonb),'old_phone_location_not_relabelled');
 perform pg_temp.fleet_denied(format('select set_provider_assigned_vehicle_duty(%L,%L)',employee,
  jsonb_build_object('vehicle_id',first_truck,'on_duty',true,'location_source','DEVICE_OBSCURED','approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20)),
  'CAPACITY_CONFIGURATION_REQUIRED');
 perform refresh_provider_capacity_location(employee,jsonb_build_object('vehicle_id',first_truck,'approximate_lat',9.1,'approximate_lng',38.8,'location_precision_km',20));
 perform update_fleet_driver_access(owner_id,access||jsonb_build_object('driver_user_id',employee,'vehicle_id',second_truck));
 perform update_fleet_driver_access(owner_id,access||jsonb_build_object('driver_user_id',employee));
 perform pg_temp.fleet_assert(not exists(select 1 from jsonb_array_elements(provider_capacity_workspace(owner_id)->'vehicles') v
  where v->>'id'=first_truck::text and v->'driver_location' is not null and v->'driver_location'<>'null'::jsonb),'returning_driver_needs_fresh_phone_location');
 perform pg_temp.fleet_denied(format('select publish_provider_capacity(%L,%L)',owner_id,
  capacity_command||'{"location_source":"PRESERVE_DRIVER"}'),'CAPACITY_DRIVER_LOCATION_REQUIRED');
 perform refresh_provider_capacity_location(employee,jsonb_build_object('vehicle_id',first_truck,'approximate_lat',9.2,'approximate_lng',38.9,'location_precision_km',20));
 history_id:=publish_provider_capacity(owner_id,capacity_command||'{"location_source":"PRESERVE_DRIVER"}');
 perform pg_temp.fleet_assert((select id=history_id from capacities where vehicle_id=first_truck order by updated_at desc,id desc limit 1),
  'owner_publication_after_fresh_employee_fix_is_latest');
 select id into origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into destination_ref from place_catalog where normalized_name='adama' limit 1;
 select id into passing_ref from place_catalog where id not in(origin_ref,destination_ref) order by id limit 1;
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',shipment_id,'code','LGX-'||upper(substr(replace(shipment_id::text,'-',''),1,8)),
  'vehicle_id',first_truck,'origin_place_ref',origin_ref,'destination_place_ref',destination_ref,'passing_place_ref',passing_ref,
  'cargo_summary','Synthetic fleet cargo','customer_email','synthetic-owner@example.test','customer_email_digest',repeat('3',64),
  'additional_recipients','[]'::jsonb,'expected_delivery_date',(current_date+2)::text,'tracking_mode','STATUS_ONLY',
  'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 perform pg_temp.fleet_assert((select assigned_driver_user_id=employee and provider_profile_id=provider_id from provider_shipments where id=shipment_id),'owner_created_tracking_uses_actual_driver');
 perform pg_temp.fleet_assert(provider_tracking_actor_owns_shipment(owner_id,shipment_id) and provider_tracking_actor_owns_shipment(employee,shipment_id),'owner_and_assigned_employee_tracking_scope');
 -- A business owner who drives uses the same real device/status/approval path
 -- without changing their TRANSPORTER role or becoming an employed driver.
 perform refresh_provider_capacity_location(company_owner,jsonb_build_object('vehicle_id',company_truck,'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 perform create_provider_tracking_with_recipients(company_owner,jsonb_build_object('id',business_shipment,'code','LGX-'||upper(substr(replace(business_shipment::text,'-',''),1,8)),
  'vehicle_id',company_truck,'origin_place_ref',origin_ref,'destination_place_ref',destination_ref,'passing_place_ref',passing_ref,
  'cargo_summary','Synthetic business owner cargo','customer_email','synthetic-business@example.test','customer_email_digest',repeat('4',64),
  'additional_recipients','[]'::jsonb,'expected_delivery_date',(current_date+2)::text,'tracking_mode','LOCATION_AND_STATUS',
  'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 location:=jsonb_build_object('area','Around synthetic test location','lat',9.03,'lng',38.74,'precision_km',10,'source','DEVICE_OBSCURED');
 insert into auth.sessions(id,user_id,created_at,updated_at) values(session_id,company_owner,clock_timestamp(),clock_timestamp());
 binding:=register_phone_location_installation(company_owner,installation_id,installation_secret,company_truck,false,session_id);
 perform update_provider_tracking_status(company_owner,business_shipment,jsonb_build_object('next_status','TO_PICKUP','location',location||jsonb_build_object(
  'phone_installation',jsonb_build_object('installation_id',installation_id,'secret_digest',installation_secret,
   'binding_id',binding->>'bindingId','revision',binding->>'revision','report_id',gen_random_uuid(),'observed_at',clock_timestamp()))));
 perform issue_registered_tracking_device_lease(company_owner,business_shipment,installation_id,installation_secret,device_digest,10);
 perform report_tracking_device_location(device_digest,location||jsonb_build_object('observed_at',clock_timestamp(),'report_id',gen_random_uuid()));
 perform pg_temp.fleet_assert(exists(select 1 from assigned_location_tracking(company_owner) item
  where item.payload->>'shipmentId'=business_shipment::text),'business_owner_background_tracking_scope');
 proof:='{"path":"supabase://shipment-proof/synthetic-business-owner.jpg","original_name":"fixture.jpg","mime_type":"image/jpeg"}';
 perform update_provider_tracking_status(company_owner,business_shipment,jsonb_build_object('next_status','LOADING','proof',proof));
 perform update_provider_tracking_status(company_owner,business_shipment,jsonb_build_object('next_status','IN_TRANSIT','location',location||jsonb_build_object(
  'phone_installation',jsonb_build_object('installation_id',installation_id,'secret_digest',installation_secret,
   'binding_id',binding->>'bindingId','revision',binding->>'revision','report_id',gen_random_uuid(),'observed_at',clock_timestamp()))));
 perform update_provider_tracking_status(company_owner,business_shipment,jsonb_build_object('next_status','UNLOADING','proof',proof));
 perform approve_provider_handover(business_shipment,repeat('4',64),clock_timestamp());
 select handover_approved_at into approved_stamp from provider_shipments where id=business_shipment;
 perform pg_temp.fleet_assert(exists(select 1 from jsonb_array_elements(driver_handover_alert_snapshot(company_owner)->'items') item
  where item->>'id'=business_shipment::text and(item->>'unread')::boolean),'business_owner_gets_own_driver_handover_alert');
 perform acknowledge_driver_handover_alert(company_owner,business_shipment,approved_stamp);
 perform pg_temp.fleet_assert(not exists(select 1 from jsonb_array_elements(driver_handover_alert_snapshot(company_owner)->'items') item
  where item->>'id'=business_shipment::text and(item->>'unread')::boolean),'business_owner_acknowledges_actual_handover');
 perform pg_temp.fleet_denied(format('select update_fleet_driver_access(%L,%L)',owner_id,access||jsonb_build_object('driver_user_id',employee,'vehicle_id',third_truck)),'TRUCK_HAS_ACTIVE_TRACKING');
 perform pg_temp.fleet_denied(format('select set_vehicle_lifecycle(%L,%L,false,%L)',owner_id,first_truck,'Synthetic retirement attempt'),'TRUCK_HAS_ACTIVE_TRACKING');
 perform pg_temp.fleet_denied(format('select fleet_remove_driver(%L,%L)',owner_id,employee),'TRUCK_HAS_ACTIVE_TRACKING');
 perform update_fleet_driver_access(owner_id,access||jsonb_build_object('vehicle_id',second_truck));
 select count(*) into recipient_count from provider_tracking_recipients r where r.shipment_id=provider_owner_fleet_test.shipment_id;
 perform recover_provider_tracking(owner_id,shipment_id,jsonb_build_object('action','REASSIGN','reason','Synthetic governed fleet recovery',
  'revision',(select updated_at from provider_shipments where id=shipment_id),'vehicle_id',second_truck));
 perform pg_temp.fleet_assert((select assigned_vehicle_id=second_truck and assigned_driver_user_id=owner_id
  from provider_shipments where id=shipment_id),'personal_provider_governed_tracking_reassignment');
 perform pg_temp.fleet_assert((select count(*)=recipient_count from provider_tracking_recipients r where r.shipment_id=provider_owner_fleet_test.shipment_id),'tracking_reassignment_preserves_recipients');
 update provider_shipments set operational_status='CANCELLED' where id=shipment_id; -- fixture terminal only
 select first_name,last_name into prior_first_name,prior_last_name from profiles where id=employee;
 perform fleet_update_driver_contact(owner_id,jsonb_build_object('driver_user_id',employee,'name','Updated employee','phone','+251900000002'));
 perform pg_temp.fleet_assert((select full_name='Updated employee' and public_callback_phone='+251900000002'
  and first_name is not distinct from prior_first_name and last_name is not distinct from prior_last_name
  from profiles where id=employee),'fleet_contact_keeps_structured_identity');
 perform pg_temp.fleet_denied(format('select fleet_update_driver_contact(%L,%L)',owner_id,jsonb_build_object('driver_user_id',owner_id,'name','Denied','phone','+251900000001')),'FORBIDDEN');
 invite_id:=fleet_invite_driver(owner_id,jsonb_build_object('email',invitee||'@example.test','name','Invited employee','phone','+251900000003'));
 perform pg_temp.fleet_assert(fleet_accept_invitation(invitee,invite_id)=provider_id,'personal_fleet_invitation_acceptance');
 perform pg_temp.fleet_assert((select provider_profile_id=provider_id and organization_id is null from drivers where user_id=invitee),'invited_employer_anchor');
 perform fleet_remove_driver(owner_id,employee);
 perform pg_temp.fleet_assert((select not active from profiles where id=employee) and capacity_active_driver_id(first_truck) is null,'offboarding_revokes_current_authority');
 perform pg_temp.fleet_assert(exists(select 1 from provider_shipments where id=shipment_id)
  and exists(select 1 from provider_tracking_recoveries r where r.shipment_id=provider_owner_fleet_test.shipment_id
   and r.before_state->>'driver_id'=employee::text),'offboarding_preserves_tracking_history');
 perform set_vehicle_lifecycle(owner_id,second_truck,false,'Synthetic retirement');
 perform set_vehicle_lifecycle(owner_id,second_truck,true,'Synthetic restoration');
 perform pg_temp.fleet_assert((select active from vehicles where id=second_truck),'owner_can_restore_multiple_trucks');
 perform pg_temp.fleet_assert(not has_function_privilege('authenticated','public.fleet_provider_owner_scope(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.provider_account_capabilities(uuid)','EXECUTE'),'helpers_not_browser_endpoints');
 raise notice 'PASS: provider-owner fleets, draft registration, actual assignments, employee isolation, private identity, location, Tracking, invitations and retained history';
end $test$;
rollback;
