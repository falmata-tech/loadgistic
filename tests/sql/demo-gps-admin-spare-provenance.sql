-- FEAT-GPS-001. Run only after migration 192 on a disposable local clone.
-- Fixture, assignment, source and report changes all roll back.
begin;
do $test$
declare
 admin_id uuid;provider_id uuid;spare_gateway_id uuid;gateway_digest text;
 owner_org constant uuid:='6727b198-d771-436a-9f1f-7bf27b8cea2f';
 truck constant uuid:='76bea7fa-03b2-42f0-af51-fff05c62cbc7';
 spare_device_id uuid;device_revision text;source_revision text;report_stamp timestamptz;gateway_device_number bigint;
 saved jsonb;capacity_id uuid;recipient_digest text;private_row jsonb;
 test_event_key text:='admin-spare-provenance-test-'||substr(gen_random_uuid()::text,1,8);
begin
 if current_database()<>'loadgistic_demo_gps_192_ci' and current_database()<>'loadgistic_telematics_ci'
 then raise exception 'DISPOSABLE_CLONE_REQUIRED';end if;
 if to_regprocedure('public.mark_demo_admin_spare_gps_fix()') is null
 then raise exception 'SPARE_PROVENANCE_PRECONDITION_FAILED';end if;
 select u.id into admin_id from auth.users u join profiles p on p.id=u.id and p.active and p.role='ADMIN'
  where u.raw_app_meta_data->>'fixture_source'='loadgistic' and u.raw_user_meta_data->>'fixture_key'='user-admin';
 select m.user_id into provider_id from organization_members m join auth.users u on u.id=m.user_id
  where m.organization_id=owner_org and m.membership_role='OWNER'
   and u.raw_app_meta_data->>'fixture_source'='loadgistic'
   and u.raw_user_meta_data->>'fixture_key'='user-transporter';
 select id,token_digest into spare_gateway_id,gateway_digest from telematics_gateways where active and synthetic_only limit 1;
 select id into capacity_id from capacities where vehicle_id=truck order by updated_at desc limit 1;
 select recipient_email_digest into recipient_digest from capacity_access_grants
  where vehicle_id=truck and audience_type='EMAIL' and revoked_at is null order by id limit 1;
 if admin_id is null or provider_id is null or spare_gateway_id is null or capacity_id is null or recipient_digest is null
 then raise exception 'SPARE_PROVENANCE_FIXTURE_MISSING';end if;
 select d.id,d.gateway_device_id into spare_device_id,gateway_device_number from telematics_devices d
  where d.imei='990000000000013' and d.gateway_id=spare_gateway_id and d.active and d.synthetic
   and d.protocol='gt06' and d.protocol_device_id='990000000000013'
   and d.model_profile='SYNTHETIC_GT06' and d.organization_id=owner_org and d.provider_profile_id is null;
 if spare_device_id is null then
  if exists(select 1 from telematics_devices where imei='990000000000013')
   or exists(select 1 from telematics_device_assignments where vehicle_id=truck and ended_at is null)
  then raise exception 'SPARE_PROVENANCE_BINDING_CONFLICT';end if;
  gateway_device_number:=9013;
  saved:=provision_telematics_device(admin_id,jsonb_build_object('gatewayId',spare_gateway_id,
   'gatewayDeviceId',gateway_device_number,'imei','990000000000013','protocol','gt06',
   'protocolDeviceId','990000000000013','ownerOrganizationId',owner_org,
   'label','Demo GPS for Truck 02','synthetic',true,'modelProfile','SYNTHETIC_GT06'));
  spare_device_id:=(saved->>'id')::uuid;device_revision:=saved->>'revision';
  perform assign_telematics_device(provider_id,jsonb_build_object('deviceId',spare_device_id,'vehicleId',truck,'expectedRevision',device_revision));
 elsif not exists(select 1 from telematics_device_assignments where device_id=spare_device_id
  and vehicle_id=truck and ended_at is null) then raise exception 'SPARE_PROVENANCE_ASSIGNMENT_CHANGED';end if;
 select coalesce(revision,'1970-01-01'::timestamptz)::text into source_revision
  from telematics_location_sources where vehicle_id=truck;
 source_revision:=coalesce(source_revision,'1970-01-01 00:00:00+00');
 perform select_telematics_location_source(provider_id,jsonb_build_object('vehicleId',truck,
  'source','GPS','precisionKm',1,'expectedRevision',source_revision));
 report_stamp:=clock_timestamp();
 perform ingest_telematics_position(gateway_digest,jsonb_build_object(
  'eventKey',test_event_key,'gatewayDeviceId',gateway_device_number,'protocol','gt06',
  'protocolDeviceId','990000000000013','observedAt',report_stamp,'receivedAt',report_stamp,
  'valid',true,'latitude',9.0401,'longitude',38.75533,'speedKph',0,'course',0,
  'attributes',jsonb_build_object('ignition',false)));
 if not exists(select 1 from telematics_positions where device_id=spare_device_id
  and event_key=test_event_key and demo_epoch=1)
 then raise exception 'SPARE_POSITION_PROVENANCE_NOT_SAVED';end if;
 if not exists(select 1 from capacities where id=capacity_id and location_source='TELEMATICS'
   and demo_epoch=1 and location_updated_at=report_stamp)
 then raise exception 'SPARE_CAPACITY_PROVENANCE_NOT_SAVED';end if;
 select p.payload into private_row from public.private_capacity_filtered_page(
  'EMAIL',recipient_digest,null,null,null,100,'{}'::jsonb) p
  where p.payload->>'id'=capacity_id::text limit 1;
 if private_row is null or private_row->>'location_source'<>'TELEMATICS'
  or private_row->>'location_is_demo'<>'true' or private_row ? 'imei'
 then raise exception 'PRIVATE_SPARE_DEMO_PROJECTION_FAILED';end if;
 if exists(select 1 from public.public_capacity_page(jsonb_build_object('capacity_id',capacity_id),null,null,20) p
  where p.payload->>'id'=capacity_id::text)
 then raise exception 'PRIVATE_SPARE_PUBLICLY_VISIBLE';end if;
end $test$;
rollback;
