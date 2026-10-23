-- FEAT-GPS-001 / FEAT-TRK-001. Own synthetic identities; every write rolls back.
begin;
create function pg_temp.expect_location_denial(statement text,expected text) returns void language plpgsql as $$
declare denied boolean:=false;
begin
 begin execute statement;exception when others then
  if sqlerrm<>expected then raise exception 'EXPECTED_%_GOT_%',expected,sqlerrm;end if;
  denied:=true;
 end;
 if not denied then raise exception 'LOCATION_DENIAL_MISSING_%',expected;end if;
end $$;
do $test$
#variable_conflict use_variable
declare owner_id uuid:=gen_random_uuid();driver_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();replacement_id uuid:=gen_random_uuid();
 org_id uuid:=gen_random_uuid();vehicle_id uuid;shipment_id uuid:=gen_random_uuid();session_id uuid:=gen_random_uuid();
 installation_id uuid:=gen_random_uuid();secret text:=encode(gen_random_bytes(32),'hex');
 capability text:=encode(gen_random_bytes(32),'hex');binding jsonb;editor jsonb;result jsonb;proof jsonb;
 cities text[];recipient_digest text:=encode(gen_random_bytes(32),'hex');capacity_before jsonb;phone_before jsonb;stamp timestamptz;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
  (owner_id,owner_id||'@example.invalid',clock_timestamp(),'{}','{}'),
  (driver_id,driver_id||'@example.invalid',clock_timestamp(),'{}','{}'),
  (other_id,other_id||'@example.invalid',clock_timestamp(),'{}','{}'),
  (replacement_id,replacement_id||'@example.invalid',clock_timestamp(),'{}','{}');
 update profiles set role='TRANSPORTER',active=true,drives_truck=false where id=owner_id;
 update profiles set role='TRANSPORTER',active=true,drives_truck=false where id=other_id;
 insert into organizations(id,name,handle,type,city,city_place_ref,public_visibility)
 values(org_id,'Manual source fixture','manual-'||org_id,'TRANSPORT_COMPANY','Addis Ababa',
  (select id from place_catalog where normalized_name='addis ababa' limit 1),'PUBLIC');
 insert into organization_members(user_id,organization_id,membership_role) values(owner_id,org_id,'OWNER');
 perform accept_content_policy(owner_id,'2026-10-09');
 perform fleet_accept_invitation(driver_id,fleet_invite_driver(owner_id,jsonb_build_object(
  'email',driver_id||'@example.invalid','name','Synthetic assigned driver','phone','+251900000172')));
 perform accept_content_policy(driver_id,'2026-10-09');
 vehicle_id:=(create_provider_vehicle(owner_id,'{"make":"Manual fixture","model":"Vehicle","plate":"MAN-172-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',vehicle_id,
  'can_manage_capacity',false,'can_manage_tracking',true));
 editor:=capacity_location_editor(driver_id,vehicle_id);
 if editor->>'source'<>'MOBILE' or editor->>'revision' is null or editor->'manualPoint'<>'null'::jsonb then raise exception 'DRIVER_EDITOR_INITIAL_STATE';end if;
 perform pg_temp.expect_location_denial(format('select capacity_location_editor(%L,%L)',other_id,vehicle_id),'NOT_FOUND');
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','GPS','precisionKm',10,'expectedRevision',editor->>'revision')),'FORBIDDEN');
 result:=select_telematics_location_source(driver_id,jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL',
  'precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9.03,'manualLongitude',38.74));
 if result->>'source'<>'MANUAL' then raise exception 'ASSIGNED_DRIVER_MANUAL_SAVE';end if;
 editor:=capacity_location_editor(driver_id,vehicle_id);
 if editor->'manualPoint' is distinct from '{"latitude":9.03,"longitude":38.74}'::jsonb
  or editor->>'revision'<>result->>'revision' then raise exception 'DRIVER_MANUAL_EDITOR_RELOAD';end if;
 if not exists(select 1 from jsonb_array_elements(telematics_workspace(owner_id,1)->'vehicles') v
  where v->>'id'=vehicle_id::text and v->'selection'->>'driverSelectedManual'='true')
  then raise exception 'OWNER_DRIVER_MANUAL_LOCK_NOT_SHOWN';end if;
 if not exists(select 1 from capacities c where c.vehicle_id=vehicle_id and c.location_source='MANUAL_ADMIN'
  and c.location_lat is not null and c.location_lng is not null)
  then raise exception 'ASSIGNED_DRIVER_MANUAL_CAPACITY_POINT_MISSING';end if;
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',owner_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','MOBILE','precisionKm',10,'expectedRevision',editor->>'revision')),'DRIVER_LOCATION_CHOICE_LOCKED');
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',other_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL','precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9,'manualLongitude',39)),'NOT_FOUND');
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL','precisionKm',10,'expectedRevision','1970-01-01T00:00:00Z','manualLatitude',9,'manualLongitude',39)),'TELEMATICS_CHANGED');
 select to_jsonb(c) into capacity_before from capacities c where c.vehicle_id=vehicle_id order by c.updated_at desc,c.id desc limit 1;
 select to_jsonb(p) into phone_before from vehicle_driver_locations p where p.vehicle_id=vehicle_id and p.driver_user_id=driver_id;
 perform pg_temp.expect_location_denial(format('select refresh_provider_capacity_location(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicle_id',vehicle_id,'approximate_lat',11,'approximate_lng',40,'location_precision_km',10)),'PHONE_LOCATION_UNAVAILABLE');
 if (select to_jsonb(c) from capacities c where c.vehicle_id=vehicle_id order by c.updated_at desc,c.id desc limit 1) is distinct from capacity_before
  or (select to_jsonb(p) from vehicle_driver_locations p where p.vehicle_id=vehicle_id and p.driver_user_id=driver_id) is distinct from phone_before
  then raise exception 'QUEUED_CAPACITY_PHONE_FIX_WROTE_MANUAL';end if;
 stamp:=(editor->>'revision')::timestamptz;
 result:=select_telematics_location_source(driver_id,jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL',
  'precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9.03,'manualLongitude',38.74));
 if (result->>'revision')::timestamptz<=stamp then raise exception 'SAME_POINT_FRESHNESS_NOT_ADVANCED';end if;
 if capacity_location_editor(owner_id,vehicle_id)->'manualPoint' is distinct from editor->'manualPoint' then raise exception 'OWNER_PRIVATE_EDITOR_MISSING';end if;
 select array_agg(id order by id) into cities from(select id from place_catalog order by id limit 3) p;
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',shipment_id,'code','LGX-'||upper(substr(replace(shipment_id::text,'-',''),1,8)),
  'vehicle_id',vehicle_id,'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],
  'cargo_summary','Manual source tracking regression','customer_email','source-owner@example.invalid','customer_email_digest',recipient_digest,
  'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',(current_date+2)::text,
  'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 if (select tracking_location_source from provider_shipments where id=shipment_id)<>'MOBILE'
  or tracking_selected_location(shipment_id) is not null then raise exception 'MANUAL_LOCATION_MISLABELLED_LIVE_TRACKING';end if;
 if not exists(select 1 from assigned_location_tracking(driver_id) t where t.payload->>'shipmentId'=shipment_id::text)
  then raise exception 'MANUAL_CAPACITY_DISABLED_PHONE_TRACKING_TASK';end if;
 perform pg_temp.expect_location_denial(format('update provider_shipments set tracking_location_source=''GPS'' where id=%L',shipment_id),'TRACKING_SOURCE_LOCKED');
 perform pg_temp.expect_location_denial(format('update provider_shipments set tracking_source_started_at=clock_timestamp()+interval ''1 minute'' where id=%L',shipment_id),'TRACKING_SOURCE_LOCKED');
 insert into auth.sessions(id,user_id,created_at,updated_at) values(session_id,driver_id,clock_timestamp(),clock_timestamp());
 binding:=register_phone_location_installation(driver_id,installation_id,secret,vehicle_id,false,session_id);
 result:=issue_registered_tracking_device_lease(driver_id,shipment_id,installation_id,secret,capability,10);
 if result->>'shipmentId'<>shipment_id::text then raise exception 'TRACKING_PHONE_LEASE_BLOCKED_BY_MANUAL_CAPACITY';end if;
 stamp:=clock_timestamp();
 proof:=jsonb_build_object('installation_id',installation_id,'secret_digest',secret,'binding_id',binding->>'bindingId',
  'revision',binding->>'revision','report_id',gen_random_uuid(),'observed_at',stamp);
 result:=update_provider_tracking_location(driver_id,shipment_id,jsonb_build_object('area','Approximate location',
  'lat',9.03,'lng',38.74,'precision_km',10,'source','DEVICE_OBSCURED','phone_installation',proof));
 if result->>'recorded'<>'true' or tracking_selected_location(shipment_id)->>'location_source'<>'DEVICE_OBSCURED'
  then raise exception 'AGREED_PHONE_TRACKING_DID_NOT_CONTINUE';end if;
 if (select to_jsonb(c) from capacities c where c.vehicle_id=vehicle_id order by c.updated_at desc,c.id desc limit 1)->>'location_source' is distinct from 'MANUAL_ADMIN'
  or (select s.source from telematics_location_sources s where s.vehicle_id=vehicle_id)<>'MANUAL'
  then raise exception 'TRACKING_PHONE_OVERWROTE_MANUAL_CAPACITY';end if;
 if provider_guest_tracking_for_recipient(shipment_id,recipient_digest)->'current_location'->>'location_source'<>'DEVICE_OBSCURED'
  then raise exception 'TRACKING_OWNER_MISSING_PHONE_LOCATION';end if;
 editor:=capacity_location_editor(driver_id,vehicle_id);
 result:=select_telematics_location_source(driver_id,jsonb_build_object('vehicleId',vehicle_id,'source','MOBILE',
  'precisionKm',10,'expectedRevision',editor->>'revision'));
 if result->>'source'<>'MOBILE' then raise exception 'DRIVER_CANNOT_RESUME_PHONE_CAPACITY';end if;
 if exists(select 1 from jsonb_array_elements(telematics_workspace(owner_id,1)->'vehicles') v
  where v->>'id'=vehicle_id::text and v->'selection'->>'driverSelectedManual'='true')
  then raise exception 'OWNER_DRIVER_MANUAL_LOCK_STALE';end if;
 editor:=capacity_location_editor(driver_id,vehicle_id);
 result:=select_telematics_location_source(driver_id,jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL',
  'precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9.04,'manualLongitude',38.75));
 update provider_shipments set operational_status='CANCELLED' where id=shipment_id;
 perform fleet_accept_invitation(replacement_id,fleet_invite_driver(owner_id,jsonb_build_object(
  'email',replacement_id||'@example.invalid','name','Synthetic replacement driver','phone','+251900000173')));
 perform accept_content_policy(replacement_id,'2026-10-09');
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',replacement_id,'vehicle_id',vehicle_id,
  'can_manage_capacity',false,'can_manage_tracking',true));
 if exists(select 1 from capacities c where c.vehicle_id=vehicle_id and c.status<>'OFF_DUTY' and c.expires_at>now())
  or telematics_effective_location(vehicle_id) is not null
  then raise exception 'FORMER_DRIVER_MANUAL_POINT_REUSED';end if;
 editor:=capacity_location_editor(replacement_id,vehicle_id);
 if editor->'manualPoint' is distinct from 'null'::jsonb then raise exception 'FORMER_DRIVER_EXACT_POINT_EXPOSED';end if;
 if exists(select 1 from jsonb_array_elements(telematics_workspace(owner_id,1)->'vehicles') v
  where v->>'id'=vehicle_id::text and v->'selection'->>'driverSelectedManual'='true')
  then raise exception 'FORMER_DRIVER_LOCK_PERSISTED';end if;
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL','precisionKm',10,'expectedRevision',result->>'revision','manualLatitude',9,'manualLongitude',39)),'NOT_FOUND');
 result:=select_telematics_location_source(replacement_id,jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL',
  'precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9.05,'manualLongitude',38.76));
 if telematics_effective_location(vehicle_id) is null then raise exception 'REPLACEMENT_DRIVER_MANUAL_POINT_MISSING';end if;
 raise notice 'PASS: assigned driver manual/phone choice, owner lock, reassignment privacy, stale/foreign/permission denial, dated manual Capacity, and independent live phone Tracking';
end $test$;
rollback;
