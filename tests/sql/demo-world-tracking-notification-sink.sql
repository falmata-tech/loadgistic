-- FEAT-SIM-001. Run only against an isolated, fixture-loaded restore with 186.
-- Every inserted row rolls back; no dispatcher or external provider is invoked.
begin;
do $test$
declare
 demo_id constant uuid:='a641aca2-f550-4960-94a9-7c1de9e4cd56';
 other_id uuid:=gen_random_uuid();
 installation_id uuid:=gen_random_uuid();
 binding_id uuid:=gen_random_uuid();
 recipient_id uuid;
 owner_digest text;
 disabled_otp_id uuid:=gen_random_uuid();
 otp_id uuid:=gen_random_uuid();
 command_otp_id uuid:=gen_random_uuid();
 session_otp_id uuid:=gen_random_uuid();
 tracking_code_digest text;
 other_recipient_id uuid:=gen_random_uuid();
 other_otp_id uuid:=gen_random_uuid();
 viewer_id uuid:=gen_random_uuid();
 owner_tracking jsonb;
 viewer_tracking jsonb;
 driver_id uuid;
 denied boolean;
 command_result boolean;
 fix_rows integer;
begin
 if current_database() not in ('loadgistic_demo_world_185_ci','loadgistic_demo_world_186_atomic_ci','loadgistic_telematics_ci') then
  raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';
 end if;
 if not public.demo_world_tracking_fixture_isolated(demo_id) then
  raise exception 'DEMO_TRACKING_FIXTURE_CHANGED';
 end if;
 if has_table_privilege('anon','public.demo_world_tracking_notification_sink','SELECT')
  or has_table_privilege('authenticated','public.demo_world_tracking_notification_sink','SELECT')
  or has_table_privilege('service_role','public.demo_world_tracking_notification_sink','INSERT')
  or has_function_privilege('service_role','public.demo_world_tracking_fixture_isolated(uuid)','EXECUTE') then
  raise exception 'DEMO_NOTIFICATION_SINK_EXPOSED';
 end if;
 if not exists(select 1 from public.demo_world_control
    where id=1 and not enabled and manifest_version=1) then
  raise exception 'DEMO_WORLD_DISABLED_START_REQUIRED';
 end if;

 select id,recipient_email_digest into recipient_id,owner_digest from public.provider_tracking_recipients
 where shipment_id=demo_id and recipient_role='OWNER' and revoked_at is null;
 if recipient_id is null then
  recipient_id:=gen_random_uuid();
  owner_digest:=repeat('b',64);
  insert into public.provider_tracking_recipients
   (id,shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by)
  select recipient_id,s.id,'OWNER','demo.shipper@example.test',owner_digest,s.created_by
  from public.provider_shipments s where s.id=demo_id;
 end if;
 select assigned_driver_user_id into strict driver_id from public.provider_shipments where id=demo_id;
 insert into public.native_push_installations(id,secret_digest,expo_token,locale)
 values(installation_id,repeat('a',64),'ExpoPushToken[DemoWorldIsolatedTest001]','en');
 insert into public.native_push_bindings
  (id,installation_id,audience,actor_user_id,auth_session_id,expires_at)
 values(binding_id,installation_id,'MEMBER',driver_id,gen_random_uuid(),clock_timestamp()+interval '1 day');

 -- Installation alone is inert. Each real dispatcher queue keeps the ordinary
 -- exact-fixture intent while disabled. Activation must refuse them one by one.
 insert into public.email_deliveries
  (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
 values(gen_random_uuid(),demo_id,'SHIPPER','TRACKING_ACCESS','demo.shipper@example.test',
  'demo-world-ci:disabled-email','PENDING');
 insert into public.provider_tracking_email_otps
  (id,shipment_id,recipient_id,recipient_email_digest,code_digest,expires_at)
 values(disabled_otp_id,demo_id,recipient_id,owner_digest,repeat('c',64),clock_timestamp()+interval '5 minutes');
 insert into public.access_email_deliveries
  (id,delivery_kind,entity_id,recipient_email,status)
 values(gen_random_uuid(),'TRACKING_OTP',disabled_otp_id,'demo.shipper@example.test','QUEUED');
 insert into public.native_push_outbox
  (binding_id,kind,source_id,event,event_key)
 values(binding_id,'HANDOVER',demo_id,'APPROVED','demo-world-ci:disabled-push');
 if not exists(select 1 from public.email_deliveries where idempotency_key='demo-world-ci:disabled-email')
  or not exists(select 1 from public.access_email_deliveries where entity_id=disabled_otp_id)
  or not exists(select 1 from public.native_push_outbox where event_key='demo-world-ci:disabled-push')
  or exists(select 1 from public.demo_world_tracking_notification_sink) then
  raise exception 'DISABLED_TRACKING_DELIVERY_BEHAVIOR_CHANGED';
 end if;
 update public.email_deliveries set next_attempt_at=clock_timestamp()
 where idempotency_key='demo-world-ci:disabled-email';
 update public.access_email_deliveries set next_attempt_at=clock_timestamp()
 where entity_id=disabled_otp_id;
 update public.native_push_outbox set next_attempt_at=clock_timestamp()
 where event_key='demo-world-ci:disabled-push';
 denied:=false;
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
 exception when raise_exception then denied:=sqlerrm='DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
 end;
 if not denied then raise exception 'DEMO_WORLD_EMAIL_ENABLE_GUARD_MISSING';end if;
 delete from public.email_deliveries where idempotency_key='demo-world-ci:disabled-email';
 denied:=false;
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
 exception when raise_exception then denied:=sqlerrm='DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
 end;
 if not denied then raise exception 'DEMO_WORLD_OTP_ENABLE_GUARD_MISSING';end if;
 delete from public.access_email_deliveries where entity_id=disabled_otp_id;
 denied:=false;
 begin
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
 exception when raise_exception then denied:=sqlerrm='DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
 end;
 if not denied then raise exception 'DEMO_WORLD_PUSH_ENABLE_GUARD_MISSING';end if;
 delete from public.native_push_outbox where event_key='demo-world-ci:disabled-push';
 update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
 if not exists(select 1 from public.demo_world_control where id=1 and enabled) then
  raise exception 'DEMO_WORLD_ENABLE_FAILED';
 end if;

 insert into public.email_deliveries
  (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
 values
  (gen_random_uuid(),demo_id,'SHIPPER','COMPLETION','demo.shipper@example.test','demo-world-ci:email','PENDING');
 if exists(select 1 from public.email_deliveries where idempotency_key='demo-world-ci:email')
  or (select count(*) from public.demo_world_tracking_notification_sink
      where source_kind='EMAIL' and source_key='demo-world-ci:email'
        and shipment_id=demo_id and event_kind='COMPLETION')<>1 then
  raise exception 'DEMO_EMAIL_ESCAPED_SINK';
 end if;
 insert into public.email_deliveries
  (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
 values
  (gen_random_uuid(),demo_id,'SHIPPER','COMPLETION','demo.shipper@example.test','demo-world-ci:email','PENDING');
 if (select count(*) from public.demo_world_tracking_notification_sink
      where source_kind='EMAIL' and source_key='demo-world-ci:email')<>1 then
  raise exception 'DEMO_EMAIL_REPLAY_DUPLICATED';
 end if;

 denied:=false;
 begin
  insert into public.email_deliveries
   (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
  values
   (gen_random_uuid(),demo_id,'SHIPPER','TRACKING_ACCESS','real-person@example.com','demo-world-ci:unsafe','PENDING');
 exception when raise_exception then denied:=sqlerrm='DEMO_WORLD_TRACKING_SCOPE_CHANGED';
 end;
 if not denied or exists(select 1 from public.demo_world_tracking_notification_sink
     where source_key='demo-world-ci:unsafe') then
  raise exception 'DEMO_RECIPIENT_DRIFT_ALLOWED';
 end if;

 insert into public.provider_tracking_email_otps
  (id,shipment_id,recipient_id,recipient_email_digest,code_digest,expires_at)
 values(otp_id,demo_id,recipient_id,owner_digest,repeat('c',64),clock_timestamp()+interval '5 minutes');
 insert into public.access_email_deliveries
  (id,delivery_kind,entity_id,recipient_email,status)
 values(gen_random_uuid(),'TRACKING_OTP',otp_id,'demo.shipper@example.test','QUEUED');
 if exists(select 1 from public.access_email_deliveries where entity_id=otp_id)
  or (select count(*) from public.demo_world_tracking_notification_sink
      where source_kind='EMAIL' and source_key='tracking-otp:'||otp_id::text)<>1 then
  raise exception 'DEMO_TRACKING_OTP_ESCAPED_SINK';
 end if;
 insert into public.shipment_party_grants(id,shipment_id,party_role,code_hash)
 values(gen_random_uuid(),demo_id,'SHIPPER',repeat('f',64))
 on conflict (shipment_id,party_role) do nothing;
 select code_hash into strict tracking_code_digest from public.shipment_party_grants
 where shipment_id=demo_id and party_role='SHIPPER';
 -- Create the exact synthetic GPS fix in this transaction. A fresh CI fixture
 -- has no position history; a long-lived local clone may have old demo fixes.
 delete from public.telematics_positions where assignment_id=(
  select tracking_gps_assignment_id from public.provider_shipments where id=demo_id);
 insert into public.telematics_positions
  (gateway_id,event_key,payload_digest,device_id,assignment_id,vehicle_id,
   observed_at,received_at,valid,latitude,longitude,speed_kph,demo_epoch)
 select device.gateway_id,'demo-world-ci:tracking-fix:'||demo_id::text,repeat('a',64),
  device.id,assignment.id,shipment.assigned_vehicle_id,
  clock_timestamp(),clock_timestamp(),true,9.0,38.7,0,1
 from public.provider_shipments shipment
 join public.telematics_device_assignments assignment
  on assignment.id=shipment.tracking_gps_assignment_id
  and assignment.vehicle_id=shipment.assigned_vehicle_id and assignment.ended_at is null
 join public.telematics_devices device on device.id=assignment.device_id and device.active
 where shipment.id=demo_id and shipment.tracking_location_source='GPS';
 get diagnostics fix_rows=row_count;
 if fix_rows<>1 then raise exception 'DEMO_GPS_TEST_FIXTURE_MISSING';end if;
 -- GPS motion feeds the ordinary owner projection. A delegated viewer must
 -- still see route/status without receiving the selected moving location.
 owner_tracking:=public.provider_guest_tracking_for_recipient(demo_id,owner_digest);
 if owner_tracking is null or owner_tracking->>'can_view_location'<>'true'
  or owner_tracking->'current_location' is null
  or owner_tracking->'current_location'='null'::jsonb
  or owner_tracking->'current_location' is distinct from public.tracking_selected_location(demo_id) then
  raise exception 'DEMO_OWNER_TRACKING_LOCATION_MISSING';
 end if;
 insert into public.provider_tracking_recipients
   (id,shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by)
 select viewer_id,s.id,'TRACKING_PARTY','demo.receiver@example.test',repeat('e',64),s.created_by
 from public.provider_shipments s where s.id=demo_id;
 viewer_tracking:=public.provider_guest_tracking_for_recipient(demo_id,repeat('e',64));
 if viewer_tracking is null or viewer_tracking->>'can_view_location'<>'false'
  or viewer_tracking->'current_location' is distinct from 'null'::jsonb then
  raise exception 'DEMO_VIEWER_LOCATION_EXPOSED';
 end if;
 command_result:=public.request_provider_tracking_otp(command_otp_id,'demo.shipper@example.test',
    owner_digest,tracking_code_digest,repeat('a',64),clock_timestamp()+interval '5 minutes');
 if not command_result then raise exception 'DEMO_TRACKING_OTP_COMMAND_REFUSED';end if;
 if exists(select 1 from public.access_email_deliveries where entity_id=command_otp_id) then
  raise exception 'DEMO_TRACKING_OTP_COMMAND_ESCAPED_SINK';
 end if;
 if not exists(select 1 from public.demo_world_tracking_notification_sink
     where source_kind='EMAIL' and source_key='tracking-otp:'||command_otp_id::text) then
  raise exception 'DEMO_TRACKING_OTP_COMMAND_MISSING_RECEIPT';
 end if;
 -- The HTTP entry calls this outer command; prove it follows the same sink.
 command_result:=public.request_tracking_email_session(session_otp_id,
   'demo.shipper@example.test',owner_digest,repeat('a',64),clock_timestamp()+interval '5 minutes');
 if not command_result then raise exception 'DEMO_TRACKING_EMAIL_SESSION_REFUSED';end if;
 if exists(select 1 from public.access_email_deliveries where entity_id=session_otp_id)
   or not exists(select 1 from public.demo_world_tracking_notification_sink
     where source_kind='EMAIL' and source_key='tracking-otp:'||session_otp_id::text) then
  raise exception 'DEMO_TRACKING_EMAIL_SESSION_ESCAPED_SINK';
 end if;

 -- Copy the fixture into a distinct, terminal shipment. This ordinary record
 -- uses the existing external outbox; the demo sink must not capture it.
 insert into public.provider_shipments
 select (jsonb_populate_record(null::public.provider_shipments,
   to_jsonb(s)||jsonb_build_object('id',other_id,'code','LGX-CI-'||substr(replace(other_id::text,'-',''),1,12),
    'operational_status','COMPLETED','completed_at',clock_timestamp(),'review_code_hash',null))).*
 from public.provider_shipments s where s.id=demo_id;
 insert into public.email_deliveries
  (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
 values
  (gen_random_uuid(),other_id,'SHIPPER','COMPLETION','real-person@example.com','ordinary-world-ci:email','PENDING');
 if not exists(select 1 from public.email_deliveries
     where shipment_id=other_id and idempotency_key='ordinary-world-ci:email' and status='PENDING')
  or exists(select 1 from public.demo_world_tracking_notification_sink
     where source_key='ordinary-world-ci:email') then
  raise exception 'ORDINARY_EMAIL_PATH_CHANGED';
 end if;
 update public.email_deliveries set next_attempt_at=clock_timestamp()
 where idempotency_key='ordinary-world-ci:email';
 insert into public.provider_tracking_recipients
  (id,shipment_id,recipient_role,recipient_email,recipient_email_digest,created_by)
 select other_recipient_id,other_id,'OWNER','ordinary-owner@example.test',repeat('d',64),s.created_by
 from public.provider_shipments s where s.id=other_id;
 insert into public.provider_tracking_email_otps
  (id,shipment_id,recipient_id,recipient_email_digest,code_digest,expires_at)
 values(other_otp_id,other_id,other_recipient_id,repeat('d',64),repeat('e',64),clock_timestamp()+interval '5 minutes');
 insert into public.access_email_deliveries
  (id,delivery_kind,entity_id,recipient_email,status)
 values(gen_random_uuid(),'TRACKING_OTP',other_otp_id,'ordinary-owner@example.test','QUEUED');
 if not exists(select 1 from public.access_email_deliveries
    where entity_id=other_otp_id and status='QUEUED') then
  raise exception 'ORDINARY_TRACKING_OTP_PATH_CHANGED';
 end if;
 update public.access_email_deliveries set next_attempt_at=clock_timestamp()
 where entity_id=other_otp_id;

 insert into public.native_push_outbox
  (binding_id,kind,source_id,event,event_key)
 values(binding_id,'HANDOVER',demo_id,'APPROVED','demo-world-ci:push');
 if exists(select 1 from public.native_push_outbox where event_key='demo-world-ci:push')
  or (select count(*) from public.demo_world_tracking_notification_sink
      where source_kind='PUSH' and source_key='demo-world-ci:push')<>1 then
  raise exception 'DEMO_PUSH_ESCAPED_SINK';
 end if;
 insert into public.native_push_outbox
  (binding_id,kind,source_id,event,event_key)
 values(binding_id,'HANDOVER',other_id,'APPROVED','ordinary-world-ci:push');
 if not exists(select 1 from public.native_push_outbox
     where source_id=other_id and event_key='ordinary-world-ci:push')
  or exists(select 1 from public.demo_world_tracking_notification_sink
     where source_key='ordinary-world-ci:push') then
  raise exception 'ORDINARY_PUSH_PATH_CHANGED';
 end if;
 update public.native_push_outbox set next_attempt_at=clock_timestamp()
 where event_key='ordinary-world-ci:push';

 -- The imported example has no loading proof. Its real status command must
 -- refuse unloading instead of allowing a fictional completed delivery.
 denied:=false;
 begin
  perform public.update_provider_tracking_status(driver_id,demo_id,
    '{"next_status":"UNLOADING"}'::jsonb);
 exception when raise_exception then denied:=sqlerrm='TRACKING_LOADING_PROOF_REQUIRED';
 end;
 if not denied or not exists(select 1 from public.provider_shipments
     where id=demo_id and operational_status='IN_TRANSIT') then
  raise exception 'DEMO_TRACKING_PROOF_BOUNDARY_CHANGED';
 end if;

 update public.provider_shipments set shipper_email='outside@example.com' where id=demo_id;
 denied:=false;
 begin
  insert into public.email_deliveries
   (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
  values
   (gen_random_uuid(),demo_id,'SHIPPER','COMPLETION','demo.shipper@example.test','demo-world-ci:drift','PENDING');
 exception when raise_exception then denied:=sqlerrm='DEMO_WORLD_TRACKING_SCOPE_CHANGED';
 end;
 if not denied then raise exception 'DEMO_IDENTITY_DRIFT_ALLOWED';end if;
 denied:=false;
 begin
  insert into public.native_push_outbox
   (binding_id,kind,source_id,event,event_key)
  values(binding_id,'HANDOVER',demo_id,'APPROVED','demo-world-ci:push-drift');
 exception when raise_exception then denied:=sqlerrm='DEMO_WORLD_TRACKING_SCOPE_CHANGED';
 end;
 if not denied or exists(select 1 from public.demo_world_tracking_notification_sink
     where source_key='demo-world-ci:push-drift') then
  raise exception 'DEMO_PUSH_IDENTITY_DRIFT_ALLOWED';
 end if;
 update public.demo_world_control set enabled=false where id=1;
 insert into public.email_deliveries
  (id,shipment_id,party_role,delivery_kind,recipient_email,idempotency_key,status)
 values(gen_random_uuid(),demo_id,'SHIPPER','COMPLETION','demo.shipper@example.test',
  'demo-world-ci:after-disable','PENDING');
 update public.email_deliveries set next_attempt_at=clock_timestamp()
 where idempotency_key='demo-world-ci:after-disable';
 if not exists(select 1 from public.email_deliveries where idempotency_key='demo-world-ci:after-disable')
  or exists(select 1 from public.demo_world_tracking_notification_sink
      where source_key='demo-world-ci:after-disable') then
  raise exception 'DEMO_WORLD_DISABLE_BEHAVIOR_CHANGED';
 end if;
 raise notice 'PASS: disabled queues, activation guards, exact email/OTP/push sink, owner GPS privacy, ordinary outboxes';
end $test$;
rollback;
