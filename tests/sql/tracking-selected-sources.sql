-- FEAT-TRK/ENT/SIM-001. Own isolated actors, ordinary commands, rollback only.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();
 truck uuid;shipment uuid:=gen_random_uuid();gps_shipment uuid:=gen_random_uuid();gateway uuid:=gen_random_uuid();device uuid;assignment uuid;
 gateway_digest text:=encode(gen_random_bytes(32),'hex');owner_digest text:=encode(gen_random_bytes(32),'hex');
 viewer_digest text:=encode(gen_random_bytes(32),'hex');cities text[];result jsonb;owner_view jsonb;viewer_view jsonb;
 revision text:='1970-01-01T00:00:00Z';stamp timestamptz;event_id uuid;imei text:='158'||lpad((floor(random()*999999999999)::bigint)::text,12,'0');
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
  (owner_id,owner_id||'@example.invalid',clock_timestamp(),'{}','{}'),
  (admin_id,admin_id||'@example.invalid',clock_timestamp(),'{}','{}');
 update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic source owner' where id=owner_id;
 update profiles set role='ADMIN',active=true where id=admin_id;
 insert into provider_profiles(id,user_id,business_name,handle) values(provider_id,owner_id,'Source fixture','source-'||owner_id);
 perform accept_content_policy(owner_id,'2026-10-09');
 truck:=(create_provider_vehicle(owner_id,'{"make":"Source fixture","model":"Truck","plate":"SOURCE-158-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',owner_id,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 select array_agg(id order by id) into cities from(select id from place_catalog where latitude between -90 and 90 and longitude between -180 and 180 order by id limit 3) p;
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',shipment,'code','LGX-'||upper(substr(replace(shipment::text,'-',''),1,8)),
  'vehicle_id',truck,'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],
  'cargo_summary','Synthetic selected-source regression','customer_email','source-owner@example.invalid','customer_email_digest',owner_digest,
  'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',(current_date+2)::text,
  'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 if to_regprocedure('public.tracking_owner_sharing_command(uuid,text,timestamptz,jsonb,uuid)') is not null then
  -- After the sharing transition, only the freshly verified shipment owner
  -- invites viewers. Keep this resolver regression valid on either side of it.
  perform tracking_owner_sharing_command(shipment,owner_digest,clock_timestamp(),jsonb_build_object('action','ADD_VIEWER','expectedRevision',0,'name','Synthetic viewer','email','source-viewer@example.invalid','digest',viewer_digest));
 else
  perform add_provider_tracking_recipient(owner_id,shipment,'source-viewer@example.invalid',viewer_digest);
 end if;
 -- The first agreement has its own phone source. A current obscured fix must
 -- survive later Capacity source changes without mutating the agreement epoch.
 stamp:=clock_timestamp();
 insert into provider_shipment_events(shipment_id,status,event_type,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at)
  values(shipment,'CREATED','LOCATION','Synthetic phone area',41,-87,10,'DEVICE_OBSCURED',owner_id,stamp);
 owner_view:=provider_guest_tracking_for_recipient(shipment,owner_digest);
 if owner_view->'current_location'->>'location_source' is distinct from 'DEVICE_OBSCURED'
  or owner_view->'current_location'->>'location_precision_km' is distinct from '10' then raise exception 'PHONE_RADIUS_OR_SOURCE_RELABELLED';end if;
 viewer_view:=provider_guest_tracking_for_recipient(shipment,viewer_digest);
 if viewer_view->'current_location' is distinct from 'null'::jsonb or viewer_view->>'can_view_location' is distinct from 'false'
  or jsonb_array_length(viewer_view->'route')<>3 then raise exception 'VIEWER_LOCATION_OR_ROUTE_BOUNDARY';end if;
 if provider_guest_tracking_for_recipient(shipment,repeat('f',64)) is not null then raise exception 'UNVERIFIED_SOURCE_READ';end if;
 if provider_guest_tracking(shipment,'SHIPPER')->'current_location' is distinct from 'null'::jsonb then raise exception 'PARTY_ROLE_BYPASSES_RECIPIENT_AUTHORITY';end if;
 perform update_provider_tracking_status(owner_id,shipment,'{"next_status":"LOADING","proof":{"path":"supabase://shipment-proof/source-158-loading.jpg","original_name":"loading.jpg","mime_type":"image/jpeg"}}');
 select id into event_id from provider_shipment_events where shipment_id=shipment and status='LOADING' and proof_storage_path is not null;
 if provider_tracking_proof_file(null,shipment,event_id,owner_digest) is null then raise exception 'OWNER_PROOF_BLOCKED';end if;
 if provider_tracking_proof_file(null,shipment,event_id,viewer_digest) is not null then raise exception 'VIEWER_PROOF_LEAK';end if;
 viewer_view:=provider_guest_tracking_for_recipient(shipment,viewer_digest);
 if exists(select 1 from jsonb_array_elements(viewer_view->'events') e where(e->>'has_proof')::boolean) then raise exception 'VIEWER_PROOF_METADATA_LEAK';end if;

 result:=select_telematics_location_source(owner_id,jsonb_build_object('vehicleId',truck,'source','MANUAL','precisionKm',20,'expectedRevision',revision,'manualLatitude',9.03,'manualLongitude',38.74));
 revision:=result->>'revision';owner_view:=provider_guest_tracking_for_recipient(shipment,owner_digest);
 if owner_view->'current_location'->>'location_source' is distinct from 'DEVICE_OBSCURED'
  or owner_view->'current_location'->>'location_precision_km' is distinct from '10' then raise exception 'MANUAL_CAPACITY_REPLACED_AGREED_PHONE_TRACKING';end if;
 if owner_view->'current_location'->>'location_lat'='9.03' or owner_view->'current_location'->>'location_lng'='38.74' then raise exception 'RAW_MANUAL_POINT_LEAK';end if;

 perform register_telematics_gateway(admin_id,gateway,'Source test gateway',gateway_digest,false);
 result:=provision_telematics_device(admin_id,jsonb_build_object('gatewayId',gateway,'gatewayDeviceId',158,'imei',imei,'protocol','gt06','protocolDeviceId',imei,
  'ownerProviderProfileId',provider_id,'label','Source test device','synthetic',false,'modelProfile','UNVERIFIED'));
 device:=(result->>'id')::uuid;
 perform assign_telematics_device(owner_id,jsonb_build_object('deviceId',device,'vehicleId',truck,'expectedRevision',result->>'revision'));
 result:=select_telematics_location_source(owner_id,jsonb_build_object('vehicleId',truck,'source','GPS','precisionKm',20,'expectedRevision',revision));
 revision:=result->>'revision';
 if provider_guest_tracking_for_recipient(shipment,owner_digest)->'current_location'->>'location_source' is distinct from 'DEVICE_OBSCURED' then raise exception 'GPS_CAPACITY_REPLACED_AGREED_PHONE_TRACKING';end if;
 -- Adding a truck creates its operational Capacity stub. Keep that truck Off
 -- duty through the normal command: Tracking must not depend on a discoverable
 -- capacity signal, but the fixture must preserve its retained stub/history.
 perform set_provider_assigned_vehicle_duty(owner_id,jsonb_build_object('vehicle_id',truck,'on_duty',false));
 stamp:=clock_timestamp();
 perform ingest_telematics_position(gateway_digest,jsonb_build_object('eventKey','source:158:first','gatewayDeviceId',158,'protocol','gt06','protocolDeviceId',imei,
  'observedAt',stamp,'receivedAt',stamp,'valid',true,'latitude',9.031,'longitude',38.748,'speedKph',25,'course',90,'attributes',jsonb_build_object('ignition',true,'battery',80)));
 owner_view:=provider_guest_tracking_for_recipient(shipment,owner_digest);
 if owner_view->'current_location'->>'location_source' is distinct from 'DEVICE_OBSCURED'
  then raise exception 'GPS_CAPACITY_FIX_REPLACED_AGREED_PHONE_TRACKING';end if;
 if exists(select 1 from capacities where vehicle_id=truck and coalesce(market_status,status::text) in ('EMPTY','PARTIAL')) then raise exception 'TRACKING_TEST_ACCIDENTALLY_DEPENDS_ON_AVAILABLE_CAPACITY';end if;
 -- A new agreement may explicitly start with this selected GPS device; it
 -- pins the exact assignment. The preceding agreement stays on its phone.
 update provider_shipments set operational_status='CANCELLED' where id=shipment;
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',gps_shipment,'code','LGX-'||upper(substr(replace(gps_shipment::text,'-',''),1,8)),
  'vehicle_id',truck,'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],
  'cargo_summary','Synthetic GPS agreement','customer_email','gps-owner@example.invalid','customer_email_digest',owner_digest,
  'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',(current_date+2)::text,
  'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 if provider_guest_tracking_for_recipient(gps_shipment,owner_digest)->'current_location' is distinct from 'null'::jsonb then raise exception 'OLD_GPS_FIX_REUSED_AT_AGREEMENT';end if;
 stamp:=clock_timestamp();
 perform ingest_telematics_position(gateway_digest,jsonb_build_object('eventKey','source:158:agreement','gatewayDeviceId',158,'protocol','gt06','protocolDeviceId',imei,
  'observedAt',stamp,'receivedAt',stamp,'valid',true,'latitude',9.04,'longitude',38.75,'speedKph',20,'course',90,'attributes',jsonb_build_object('ignition',true,'battery',80)));
 owner_view:=provider_guest_tracking_for_recipient(gps_shipment,owner_digest);
 if owner_view->'current_location'->>'location_source' is distinct from 'TELEMATICS'
  or owner_view->'current_location'->>'location_precision_km' is distinct from '10' then raise exception 'GPS_TRACKING_NOT_CONNECTED';end if;
 if owner_view::text like '%'||imei||'%' or owner_view::text like '%speedKph%' or owner_view::text like '%phone_binding_id%'
  or owner_view::text like '%gateway_device_id%' then raise exception 'PRIVATE_TELEMETRY_LEAK';end if;
 result:=provider_tracking_detail(owner_id,gps_shipment::text);
 if result->'latest_location'->>'location_source' is distinct from 'TELEMATICS' then raise exception 'PROVIDER_TRACKING_SOURCE_MISSING';end if;
 viewer_view:=provider_guest_tracking_for_recipient(shipment,viewer_digest);
 if viewer_view->'current_location' is distinct from 'null'::jsonb or viewer_view::text like '%location_source%' then raise exception 'GPS_VIEWER_LOCATION_LEAK';end if;
 -- Re-selecting the Capacity source cannot reset an active GPS agreement.
 result:=select_telematics_location_source(owner_id,jsonb_build_object('vehicleId',truck,'source','GPS','precisionKm',10,'expectedRevision',revision));
 if provider_guest_tracking_for_recipient(gps_shipment,owner_digest)->'current_location'->>'location_source' is distinct from 'TELEMATICS' then raise exception 'CAPACITY_SOURCE_RESET_ACTIVE_GPS_AGREEMENT';end if;
 revision:=result->>'revision';
 perform select_telematics_location_source(owner_id,jsonb_build_object('vehicleId',truck,'source','MANUAL','precisionKm',10,
  'manualLatitude',9.07,'manualLongitude',38.79,'expectedRevision',revision));
 if provider_guest_tracking_for_recipient(gps_shipment,owner_digest)->'current_location'->>'location_source' is distinct from 'TELEMATICS'
  then raise exception 'MANUAL_CAPACITY_REPLACED_ACTIVE_GPS_AGREEMENT';end if;
 update provider_shipments set operational_status='CANCELLED' where id=gps_shipment;
 if provider_tracking_detail(owner_id,gps_shipment::text)->'latest_location' is distinct from 'null'::jsonb then raise exception 'TERMINAL_GPS_LOCATION_LEAK';end if;
 update provider_tracking_recipients set revoked_at=clock_timestamp() where shipment_id=gps_shipment;
 if provider_guest_tracking_for_recipient(gps_shipment,owner_digest) is not null then raise exception 'REVOKED_OWNER_SOURCE_READ';end if;
 if has_function_privilege('anon','tracking_selected_location(uuid)','EXECUTE')
  or has_function_privilege('authenticated','tracking_selected_location(uuid)','EXECUTE')
  or has_function_privilege('service_role','tracking_selected_location(uuid)','EXECUTE') then raise exception 'DIRECT_SOURCE_RESOLVER_EXPOSURE';end if;
 raise notice 'PASS: independent agreement source, GPS assignment epoch, capacity changes, owner-only location/proofs, minimized viewers, revocation and terminal shutdown';
end $test$;
rollback;
