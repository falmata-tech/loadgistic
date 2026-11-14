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
-- Direct inserts model a retained pre-policy report in this disposable test
-- transaction. They are not an application command or a supported update path.
create function pg_temp.seed_legacy_manual(actor uuid,vehicle uuid,latitude double precision,longitude double precision)
returns jsonb language plpgsql as $$
declare stamp timestamptz:=clock_timestamp();point jsonb;
begin
 insert into telematics_location_sources(vehicle_id,source,precision_km,selected_by,selected_at,revision,manual_latitude,manual_longitude)
 values(vehicle,'MANUAL',10,actor,stamp,stamp,latitude,longitude)
 on conflict(vehicle_id) do update set source=excluded.source,precision_km=excluded.precision_km,
  selected_by=excluded.selected_by,selected_at=excluded.selected_at,revision=excluded.revision,
  manual_latitude=excluded.manual_latitude,manual_longitude=excluded.manual_longitude;
 point:=telematics_obscure(latitude,longitude,10);
 update capacities set location_lat=(point->>'latitude')::double precision,location_lng=(point->>'longitude')::double precision,
  location_precision_km=10,location_source='MANUAL_ADMIN',location_updated_at=stamp,
  location_area='Historical approximate area',location_place_ref=null
 where id=(select id from capacities where vehicle_id=vehicle order by updated_at desc,id desc limit 1);
 return jsonb_build_object('vehicleId',vehicle,'source','MANUAL','revision',stamp);
end $$;
create function pg_temp.location_snapshot(vehicle uuid) returns jsonb language sql as $$
 select jsonb_build_object('source',(select to_jsonb(s) from telematics_location_sources s where s.vehicle_id=$1),
  'capacity',(select jsonb_agg(to_jsonb(c) order by c.id) from capacities c where c.vehicle_id=$1),
  'phone',(select jsonb_agg(to_jsonb(p) order by p.driver_user_id) from vehicle_driver_locations p where p.vehicle_id=$1),
  'assignments',(select jsonb_agg(to_jsonb(a) order by a.id) from driver_vehicle_assignments a where a.vehicle_id=$1),
  'tracking',(select jsonb_agg(to_jsonb(t) order by t.id) from provider_shipments t where t.assigned_vehicle_id=$1));
$$;
do $test$
#variable_conflict use_variable
declare owner_id uuid:=gen_random_uuid();driver_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();replacement_id uuid:=gen_random_uuid();
 org_id uuid:=gen_random_uuid();other_org_id uuid:=gen_random_uuid();vehicle_id uuid;unused_vehicle_id uuid;shipment_id uuid:=gen_random_uuid();session_id uuid:=gen_random_uuid();
 installation_id uuid:=gen_random_uuid();secret text:=encode(gen_random_bytes(32),'hex');
 capability text:=encode(gen_random_bytes(32),'hex');binding jsonb;editor jsonb;result jsonb;proof jsonb;
 cities text[];recipient_digest text:=encode(gen_random_bytes(32),'hex');capacity_before jsonb;phone_before jsonb;before_state jsonb;stamp timestamptz;function_name text;actor uuid;
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
 insert into organizations(id,name,handle,type) values(other_org_id,'Foreign source fixture','foreign-'||other_org_id,'TRANSPORT_COMPANY');
 insert into organization_members(user_id,organization_id,membership_role) values(other_id,other_org_id,'OWNER');
 perform accept_content_policy(other_id,'2026-10-09');
 perform accept_content_policy(owner_id,'2026-10-09');
 perform fleet_accept_invitation(driver_id,fleet_invite_driver(owner_id,jsonb_build_object(
  'email',driver_id||'@example.invalid','name','Synthetic assigned driver','phone','+251900000172')));
 perform accept_content_policy(driver_id,'2026-10-09');
 vehicle_id:=(create_provider_vehicle(owner_id,'{"make":"Manual fixture","model":"Vehicle","plate":"MAN-172-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 unused_vehicle_id:=(create_provider_vehicle(owner_id,'{"make":"Phone default fixture","model":"Vehicle","plate":"PHONE-221-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',vehicle_id,
  'can_manage_capacity',false,'can_manage_tracking',true));
 editor:=capacity_location_editor(driver_id,vehicle_id);
 if editor->>'source'<>'MOBILE' or editor->>'canSetManualLocation'<>'false' or editor->>'canSetPhoneLocation'<>'true' or editor->>'revision' is null or editor->'manualPoint'<>'null'::jsonb then raise exception 'DRIVER_EDITOR_INITIAL_STATE';end if;
 perform pg_temp.expect_location_denial(format('select capacity_location_editor(%L,%L)',other_id,vehicle_id),'NOT_FOUND');
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','GPS','precisionKm',10,'expectedRevision',editor->>'revision')),'FORBIDDEN');
 before_state:=pg_temp.location_snapshot(vehicle_id);
 foreach actor in array array[owner_id,driver_id,other_id] loop
  foreach function_name in array array['select_telematics_location_source','select_telematics_location_source_pre_driver172',
   'select_telematics_location_source_pre_radius163','select_driver_capacity_location_source'] loop
   perform pg_temp.expect_location_denial(format('select %I(%L,%L::jsonb)',function_name,actor,
    jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL','precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9.03,'manualLongitude',38.74)),'INVALID_TELEMATICS_INPUT');
  end loop;
 end loop;
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','MOBILE','precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9.03)),'INVALID_TELEMATICS_INPUT');
 if pg_temp.location_snapshot(vehicle_id) is distinct from before_state then raise exception 'RETIRED_MANUAL_COMMAND_CHANGED_SAVED_STATE';end if;
 result:=pg_temp.seed_legacy_manual(driver_id,vehicle_id,9.03,38.74);
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
  jsonb_build_object('vehicleId',vehicle_id,'source','MOBILE','precisionKm',10,'expectedRevision',editor->>'revision')),'NOT_FOUND');
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','MOBILE','precisionKm',10,'expectedRevision','1970-01-01T00:00:00Z')),'TELEMATICS_CHANGED');
 select to_jsonb(c) into capacity_before from capacities c where c.vehicle_id=vehicle_id order by c.updated_at desc,c.id desc limit 1;
 select to_jsonb(p) into phone_before from vehicle_driver_locations p where p.vehicle_id=vehicle_id and p.driver_user_id=driver_id;
 perform pg_temp.expect_location_denial(format('select refresh_provider_capacity_location(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicle_id',vehicle_id,'approximate_lat',11,'approximate_lng',40,'location_precision_km',10)),'PHONE_LOCATION_UNAVAILABLE');
 if (select to_jsonb(c) from capacities c where c.vehicle_id=vehicle_id order by c.updated_at desc,c.id desc limit 1) is distinct from capacity_before
  or (select to_jsonb(p) from vehicle_driver_locations p where p.vehicle_id=vehicle_id and p.driver_user_id=driver_id) is distinct from phone_before
  then raise exception 'QUEUED_CAPACITY_PHONE_FIX_WROTE_MANUAL';end if;
 before_state:=pg_temp.location_snapshot(vehicle_id);
 perform pg_temp.expect_location_denial(format('select select_telematics_location_source(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicleId',vehicle_id,'source','MANUAL','precisionKm',10,'expectedRevision',editor->>'revision','manualLatitude',9.03,'manualLongitude',38.74)),'INVALID_TELEMATICS_INPUT');
 perform pg_temp.expect_location_denial(format('select publish_provider_capacity(%L,%L::jsonb)',owner_id,
  jsonb_build_object('vehicle_id',vehicle_id,'status','OFF_DUTY','location_source','MANUAL_ADMIN')),'INVALID_TELEMATICS_INPUT');
 perform pg_temp.expect_location_denial(format('select set_provider_assigned_vehicle_duty(%L,%L::jsonb)',driver_id,
  jsonb_build_object('vehicle_id',vehicle_id,'on_duty',true)),'LOCATION_SOURCE_PENDING');
 perform pg_temp.expect_location_denial(format('select set_provider_assigned_vehicle_duty(%L,%L::jsonb)',owner_id,
  jsonb_build_object('vehicle_id',vehicle_id,'on_duty',true)),'INVALID_VEHICLE');
 -- A different tenant gets the same denial for Manual, default Phone and an
 -- absent vehicle. Source readiness must not become an ID/status oracle.
 foreach actor in array array[vehicle_id,unused_vehicle_id,gen_random_uuid()] loop
  perform pg_temp.expect_location_denial(format('select set_provider_assigned_vehicle_duty(%L,%L::jsonb)',other_id,
   jsonb_build_object('vehicle_id',actor,'on_duty',true,'location_precision_km',10)),'INVALID_VEHICLE');
 end loop;
 if apply_telematics_capacity_location(vehicle_id) then raise exception 'LEGACY_MANUAL_REPORT_MATERIALIZED_AGAIN';end if;
 if pg_temp.location_snapshot(vehicle_id) is distinct from before_state then raise exception 'LEGACY_MANUAL_REFRESH_CHANGED_SAVED_STATE';end if;
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
 result:=pg_temp.seed_legacy_manual(driver_id,vehicle_id,9.04,38.75);
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
  jsonb_build_object('vehicleId',vehicle_id,'source','MOBILE','precisionKm',10,'expectedRevision',result->>'revision')),'NOT_FOUND');
 result:=select_telematics_location_source(replacement_id,jsonb_build_object('vehicleId',vehicle_id,'source','MOBILE',
  'precisionKm',10,'expectedRevision',editor->>'revision'));
 if result->>'source'<>'MOBILE' or telematics_effective_location(vehicle_id) is not null
  then raise exception 'REPLACEMENT_PHONE_CHOICE_REUSED_MANUAL_POINT';end if;
 if has_function_privilege('anon','select_telematics_location_source(uuid,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','select_driver_capacity_location_source(uuid,jsonb)','EXECUTE')
  or has_function_privilege('service_role','select_telematics_location_source_pre_radius163(uuid,jsonb)','EXECUTE')
  then raise exception 'MANUAL_RETIREMENT_WIDENED_COMMAND_GRANTS';end if;
 raise notice 'PASS: Manual writes refused unchanged, legacy history and driver lock retained, explicit Phone recovery, reassignment privacy and independent live phone Tracking';
end $test$;
rollback;
