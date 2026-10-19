-- FEAT-ENT/TRK/SIM-001. Own synthetic transaction; no hosted/customer records.
begin;
create function pg_temp.tracking_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.tracking_denied(statement text,code text) returns void language plpgsql as $$
begin begin execute statement;exception when others then if position(code in sqlerrm)>0 then return;end if;raise;end;raise exception 'EXPECTED_TRACKING_DENIAL:%',code;end$$;
do $test$
declare provider_actor uuid:=gen_random_uuid();customer uuid:=gen_random_uuid();staff uuid:=gen_random_uuid();administrator uuid:=gen_random_uuid();foreign_actor uuid:=gen_random_uuid();uid uuid;
 provider uuid:=gen_random_uuid();vehicle uuid;shipment uuid:=gen_random_uuid();business uuid;other_business uuid;viewer uuid;owner_recipient uuid;invitation uuid;cities text[];
 owner_digest text:=encode(gen_random_bytes(32),'hex');viewer_digest text:=encode(gen_random_bytes(32),'hex');staff_digest text:=encode(gen_random_bytes(32),'hex');
 result jsonb;viewed jsonb;command jsonb;revision integer:=0;business_version bigint;verified timestamptz:=clock_timestamp();source_revision text;
 installation uuid:=gen_random_uuid();session_id uuid:=gen_random_uuid();secret text:=encode(gen_random_bytes(32),'hex');binding jsonb;stamp timestamptz;
begin
 foreach uid in array array[provider_actor,customer,staff,administrator,foreign_actor] loop
  insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data) values(uid,'synthetic-tracking-'||uid||'@example.test',clock_timestamp(),clock_timestamp(),'{}');
 end loop;
 update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic driver' where id=provider_actor;
 update profiles set role='SHIPPER',active=true,full_name='Synthetic customer' where id in(customer,staff,administrator,foreign_actor);
 insert into provider_profiles(id,user_id,business_name,handle) values(provider,provider_actor,'Tracking sharing fixture','tracking-provider-'||provider_actor);
 perform accept_content_policy(provider_actor,'2026-10-09');
 vehicle:=(create_provider_vehicle(provider_actor,'{"make":"Sharing fixture","model":"Truck","plate":"SHARING-162-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(provider_actor,jsonb_build_object('driver_user_id',provider_actor,'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 select array_agg(id order by id) into cities from(select id from place_catalog order by id limit 3)p;
 command:=jsonb_build_object('id',shipment,'code','LGX-'||upper(substr(replace(shipment::text,'-',''),1,8)),'vehicle_id',vehicle,
  'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],'cargo_summary','Synthetic sharing regression',
  'customer_email','synthetic-tracking-'||customer||'@example.test','customer_email_digest',owner_digest,'tracking_mode','LOCATION_AND_STATUS',
  'expected_delivery_date',(current_date+2)::text,'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'));
 perform pg_temp.tracking_denied(format('select create_provider_tracking_with_recipients(%L,%L)',provider_actor,(command||jsonb_build_object('additional_recipients',jsonb_build_array(jsonb_build_object('email','viewer@example.test','digest',viewer_digest))))::text),'TRACKING_OWNER_SHARES_ACCESS');
 perform create_provider_tracking_with_recipients(provider_actor,command);
 select id into owner_recipient from provider_tracking_recipients where shipment_id=shipment and recipient_role='OWNER';
 perform pg_temp.tracking_assert((select count(*)=1 from provider_tracking_recipients where shipment_id=shipment),'PROVIDER_CREATED_MULTIPLE_RECIPIENTS');
 perform pg_temp.tracking_denied(format('select add_provider_tracking_recipient(%L,%L,%L,%L)',provider_actor,shipment,'viewer@example.test',viewer_digest),'TRACKING_OWNER_SHARES_ACCESS');
 perform pg_temp.tracking_denied(format('select tracking_owner_sharing(%L,%L,%L)',shipment,owner_digest,verified-interval '5 minutes'),'TRACKING_SESSION_EXPIRED');
 perform pg_temp.tracking_denied(format('select tracking_owner_sharing(%L,%L,%L)',shipment,staff_digest,verified),'TRACKING_APPROVAL_FORBIDDEN');
 result:=tracking_owner_sharing_command(shipment,owner_digest,verified,jsonb_build_object('action','ADD_VIEWER','expectedRevision',revision,'name','Receiver desk','email','viewer@example.test','digest',viewer_digest));
 revision:=(result->>'revision')::integer;viewer:=(result->'viewers'->0->>'id')::uuid;
 perform pg_temp.tracking_assert((select created_by is null and shared_by_recipient_id=owner_recipient from provider_tracking_recipients where id=viewer),'OWNER_VIEWER_ATTRIBUTED_TO_FAKE_PROFILE');
 perform pg_temp.tracking_assert((select count(*)=1 from email_deliveries where shipment_id=shipment and recipient_email='viewer@example.test' and delivery_kind='TRACKING_ACCESS'),'VIEWER_EMAIL_NOT_QUEUED');
 perform pg_temp.tracking_denied(format('select tracking_owner_sharing_command(%L,%L,%L,%L)',shipment,owner_digest,verified,jsonb_build_object('action','DETACH_BUSINESS','expectedRevision',0)::text),'TRACKING_SHARING_CHANGED');
 -- Tracking has its own dated phone position. Later Capacity source changes
 -- must not turn a manual Capacity point into a live shipment location.
 insert into provider_shipment_events(shipment_id,status,event_type,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at)
 values(shipment,'CREATED','LOCATION','Synthetic owner phone area',9.11,38.81,10,'DEVICE_OBSCURED',provider_actor,clock_timestamp());
 result:=select_telematics_location_source(provider_actor,jsonb_build_object('vehicleId',vehicle,'source','MANUAL','precisionKm',10,'expectedRevision','1970-01-01T00:00:00Z','manualLatitude',9.03,'manualLongitude',38.74));
 source_revision:=result->>'revision';
 viewed:=provider_guest_tracking_for_recipient(shipment,viewer_digest);
 perform pg_temp.tracking_assert(viewed->'current_location'='null'::jsonb and viewed->>'can_view_location'='false' and viewed->>'can_share'='false'
  and jsonb_array_length(viewed->'route')=3 and not(viewed::text like '%location_source%'),'VIEWER_POSITION_OR_SHARING_LEAK');
 perform pg_temp.tracking_assert(provider_guest_tracking_for_recipient(shipment,owner_digest)->'current_location'->>'location_source'='DEVICE_OBSCURED','OWNER_PHONE_TRACKING_CHANGED_TO_MANUAL');

 business:=(business_workspace_create(customer,jsonb_build_object('name','Synthetic cargo team','handle','share-team-'||substr(customer::text,1,12),'kind','BROKER'))->>'id')::uuid;
 other_business:=(business_workspace_create(foreign_actor,jsonb_build_object('name','Synthetic other team','handle','other-team-'||substr(foreign_actor::text,1,12),'kind','SHIPPER'))->>'id')::uuid;
 foreach uid in array array[staff,administrator] loop
  select version into business_version from business_workspaces where id=business;
  result:=business_workspace_command(customer,business,jsonb_build_object('action','INVITE','expectedVersion',business_version,
   'email','synthetic-tracking-'||uid||'@example.test','role',case when uid=administrator then 'ADMIN' else 'STAFF' end,'capacity',true,'tracking',true));
  invitation:=(result->>'invitationId')::uuid;perform business_workspace_accept_invitation(uid,invitation);
 end loop;
 perform pg_temp.tracking_denied(format('select tracking_owner_sharing_command(%L,%L,%L,%L,%L)',shipment,owner_digest,verified,jsonb_build_object('action','ATTACH_BUSINESS','expectedRevision',revision,'workspaceId',business)::text,administrator),'BUSINESS_FORBIDDEN');
 result:=tracking_owner_sharing_command(shipment,owner_digest,verified,jsonb_build_object('action','ATTACH_BUSINESS','expectedRevision',revision,'workspaceId',business),customer);revision:=(result->>'revision')::integer;
 perform pg_temp.tracking_assert((business_tracking_workspace(staff,business)->>'total')::integer=1,'ASSIGNED_BUSINESS_TRACKING_MISSING');
 foreach uid in array array[staff,administrator] loop
  viewed:=business_tracking_detail(uid,business,shipment)->'shipment';
  perform pg_temp.tracking_assert(viewed->'current_location'='null'::jsonb and viewed->>'can_view_location'='false' and viewed->>'can_approve'='false' and viewed->>'can_share'='false','MEMBERSHIP_OR_ADMIN_GRANTED_POSITION');
 end loop;
 viewed:=business_tracking_detail(customer,business,shipment)->'shipment';
 perform pg_temp.tracking_assert(viewed->'current_location'<>'null'::jsonb and viewed->>'can_approve'='false','BUSINESS_OWNER_POSITION_OR_FRESH_APPROVAL_BOUNDARY');
 perform pg_temp.tracking_denied(format('select business_tracking_detail(%L,%L,%L)',foreign_actor,other_business,shipment),'BUSINESS_FORBIDDEN');
 result:=tracking_owner_sharing_command(shipment,owner_digest,verified,jsonb_build_object('action','ALLOW_LOCATION','expectedRevision',revision,'userId',staff));revision:=(result->>'revision')::integer;
 viewed:=business_tracking_detail(staff,business,shipment)->'shipment';
 perform pg_temp.tracking_assert(viewed->'current_location'<>'null'::jsonb and viewed->>'can_approve'='false' and viewed->>'can_share'='false','EXPLICIT_STAFF_POSITION_MISSING');
 perform pg_temp.tracking_assert(not exists(select 1 from jsonb_array_elements(viewed->'events')e where(e->>'has_proof')::boolean),'STAFF_PROOF_METADATA_LEAK');
 select version into business_version from business_workspaces where id=business;
 perform business_workspace_command(customer,business,jsonb_build_object('action','UPDATE_MEMBER','expectedVersion',business_version,'userId',staff,'role','STAFF','capacity',true,'tracking',true,'active',false));
 perform pg_temp.tracking_denied(format('select business_tracking_detail(%L,%L,%L)',staff,business,shipment),'BUSINESS_FORBIDDEN');
 select version into business_version from business_workspaces where id=business;
 perform business_workspace_command(customer,business,jsonb_build_object('action','UPDATE_MEMBER','expectedVersion',business_version,'userId',staff,'role','STAFF','capacity',true,'tracking',true,'active',true));
 perform pg_temp.tracking_assert(business_tracking_detail(staff,business,shipment)->'shipment'->'current_location'='null'::jsonb,'RESTORED_MEMBERSHIP_RESURRECTED_LOCATION_GRANT');
 result:=tracking_owner_sharing_command(shipment,owner_digest,verified,jsonb_build_object('action','DETACH_BUSINESS','expectedRevision',revision));revision:=(result->>'revision')::integer;
 perform pg_temp.tracking_assert((business_tracking_workspace(staff,business)->>'total')::integer=0,'DETACHED_SHIPMENT_STILL_IN_TEAM');
 perform pg_temp.tracking_denied(format('select business_tracking_detail(%L,%L,%L)',staff,business,shipment),'BUSINESS_FORBIDDEN');
 result:=tracking_owner_sharing_command(shipment,owner_digest,verified,jsonb_build_object('action','REVOKE_VIEWER','expectedRevision',revision,'recipientId',viewer));
 perform pg_temp.tracking_assert(provider_guest_tracking_for_recipient(shipment,viewer_digest) is null,'REVOKED_VIEWER_RETAINED_ACCESS');
 perform pg_temp.tracking_assert((select revoked_by is null and revoked_by_recipient_id=owner_recipient from provider_tracking_recipients where id=viewer),'REVOKE_ATTRIBUTED_TO_FAKE_PROFILE');

 -- A real registered Tracking report refreshes the same private phone point
 -- for Capacity without rewriting the selected source or its honest radius.
 -- Age only this fixture's first event to pass the normal ten-minute report
 -- throttle; it no longer contributes to the agreement's current location.
 update provider_shipment_events set created_at=clock_timestamp()-interval '11 minutes'
  where shipment_id=shipment and event_type='LOCATION' and location_source='DEVICE_OBSCURED';
 perform select_telematics_location_source(provider_actor,jsonb_build_object('vehicleId',vehicle,'source','MOBILE','precisionKm',10,'expectedRevision',source_revision));
 insert into auth.sessions(id,user_id,created_at,updated_at) values(session_id,provider_actor,clock_timestamp(),clock_timestamp());
 binding:=register_phone_location_installation(provider_actor,installation,secret,vehicle,false,session_id);stamp:=clock_timestamp();
 result:=update_provider_tracking_location(provider_actor,shipment,jsonb_build_object('area','Synthetic phone area','lat',9.13,'lng',38.84,'precision_km',10,'source','DEVICE_OBSCURED',
  'phone_installation',jsonb_build_object('installation_id',installation,'secret_digest',secret,'binding_id',binding->>'bindingId','revision',binding->>'revision','report_id',gen_random_uuid(),'observed_at',stamp)));
 perform pg_temp.tracking_assert(exists(select 1 from vehicle_driver_locations l where l.vehicle_id=vehicle and l.latitude=9.13 and l.longitude=38.84 and l.precision_km=10
  and l.phone_binding_id=(binding->>'bindingId')::uuid and l.observed_at=stamp and l.demo_epoch is null),'TRACKING_PHONE_CAPACITY_POINT_INCOHERENT');
 perform pg_temp.tracking_assert(not has_function_privilege('anon','tracking_owner_sharing_command(uuid,text,timestamptz,jsonb,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','business_tracking_detail(uuid,uuid,uuid)','EXECUTE')
  and not has_function_privilege('service_role','apply_registered_tracking_phone_point(uuid,uuid,uuid,timestamptz,jsonb)','EXECUTE'),'TRACKING_INTERNAL_RPC_EXPOSED');
 raise notice 'PASS: single owner, email audit/outbox, five-minute freshness, viewer minimization/revocation, explicit team sharing/location, admin denial, membership revision and real phone coherence';
end $test$;
rollback;
