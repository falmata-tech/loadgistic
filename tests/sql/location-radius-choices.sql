-- FEAT-ENT/CAP/TRK-001. New synthetic actors; explicit dated legacy fixtures.
begin;
create function pg_temp.radius_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception '%',label;end if;end$$;
create function pg_temp.radius_denied(statement text,code text) returns void language plpgsql as $$
begin begin execute statement;exception when others then if position(code in sqlerrm)>0 then return;end if;raise;end;raise exception 'EXPECTED_RADIUS_DENIAL:%',code;end$$;
do $test$
declare actor uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();vehicle uuid;shipment uuid:=gen_random_uuid();cities text[];
 cutover timestamptz:=public.location_radius_cutover();legacy_time timestamptz;result jsonb;before_fix jsonb;after_fix jsonb;revision text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(actor,actor||'@example.invalid',clock_timestamp(),'{}');
 update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic radius driver' where id=actor;
 insert into provider_profiles(id,user_id,business_name,handle) values(provider,actor,'Radius fixture','radius-'||actor);
 perform accept_content_policy(actor,'2026-10-09');
 vehicle:=(create_provider_vehicle(actor,'{"make":"Radius fixture","model":"Truck","plate":"RADIUS-163-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 update driver_vehicle_assignments set assigned_at=cutover-interval '40 minutes' where vehicle_id=vehicle and active;
 select array_agg(id order by id) into cities from(select id from place_catalog order by id limit 3)p;
 perform create_provider_tracking_with_recipients(actor,jsonb_build_object('id',shipment,'code','LGX-'||upper(substr(replace(shipment::text,'-',''),1,8)),
  'vehicle_id',vehicle,'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],
  'cargo_summary','Synthetic radius regression','customer_email','radius-owner@example.invalid','customer_email_digest',encode(gen_random_bytes(32),'hex'),
  'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',(current_date+2)::text,'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 update provider_shipments set created_at=cutover-interval '30 minutes',location_reset_at=null,tracking_precision_km=20 where id=shipment;
 result:=select_telematics_location_source(actor,jsonb_build_object('vehicleId',vehicle,'source','MANUAL','precisionKm',20,'expectedRevision','1970-01-01T00:00:00Z','manualLatitude',9.03,'manualLongitude',38.74));
 revision:=result->>'revision';
 -- Own explicit historical row, never a customer backfill or inferred capture.
 update telematics_location_sources set precision_km=40,selected_at=cutover-interval '20 minutes' where vehicle_id=vehicle;
 before_fix:=telematics_effective_location(vehicle);
 perform pg_temp.radius_assert(before_fix->>'precisionKm'='40','OLD_MANUAL_CAPACITY_RADIUS_RELABELLED');
 perform pg_temp.radius_assert(tracking_selected_location(shipment) is null,'MANUAL_CAPACITY_POINT_MISLABELLED_LIVE_TRACKING');
 perform pg_temp.radius_denied(format('select select_telematics_location_source(%L,%L)',actor,jsonb_build_object('vehicleId',vehicle,'source','MANUAL','precisionKm',40,'expectedRevision',revision,'manualLatitude',9.03,'manualLongitude',38.74)::text),'INVALID_TELEMATICS_INPUT');
 perform pg_temp.radius_assert(telematics_effective_location(vehicle)=before_fix,'DENIED_CHOICE_CHANGED_OLD_POINT');
 result:=select_telematics_location_source(actor,jsonb_build_object('vehicleId',vehicle,'source','MANUAL','precisionKm',20,'expectedRevision',revision,'manualLatitude',9.03,'manualLongitude',38.74));revision:=result->>'revision';
 perform pg_temp.radius_assert(telematics_effective_location(vehicle)->>'precisionKm'='20' and tracking_selected_location(shipment) is null,'EXPLICIT_FRESH_MANUAL_SAVE_MISLABELLED_TRACKING');

 perform select_telematics_location_source(actor,jsonb_build_object('vehicleId',vehicle,'source','MOBILE','precisionKm',20,'expectedRevision',revision));
 update telematics_location_sources set selected_at=cutover-interval '25 minutes' where vehicle_id=vehicle;
 legacy_time:=cutover-interval '15 minutes';
 insert into provider_shipment_events(shipment_id,status,event_type,location_area,location_lat,location_lng,location_precision_km,location_source,created_by,created_at)
  values(shipment,'CREATED','LOCATION','Historical approximate area',9.1,38.1,20,'DEVICE_OBSCURED',actor,legacy_time);
 before_fix:=tracking_selected_location(shipment);
 perform pg_temp.radius_assert(before_fix is null,'OLD_PHONE_REPORT_CROSSED_AGREEMENT_EPOCH');
 perform pg_temp.radius_denied(format('select refresh_provider_capacity_location(%L,%L)',actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',9.2,'approximate_lng',38.2,'location_precision_km',40)::text),'INVALID_LOCATION_PRIVACY');
 perform pg_temp.radius_denied(format('select update_provider_tracking_location(%L,%L,%L)',actor,shipment,jsonb_build_object('area','New phone area','lat',9.2,'lng',38.2,'precision_km',20,'source','DEVICE_OBSCURED')::text),'TRACKING_DEVICE_LOCATION_REQUIRED');
 perform pg_temp.radius_denied(format('select issue_registered_tracking_device_lease(%L,%L,%L,%L,%L,20)',actor,shipment,gen_random_uuid(),repeat('a',64),repeat('b',64)),'INVALID_TRACKING_DEVICE');
 perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',9.2,'approximate_lng',38.2,'location_precision_km',20));
 after_fix:=tracking_selected_location(shipment);
 perform pg_temp.radius_assert(after_fix is null,'NEW_BROAD_CAPACITY_POINT_RELABELLED_AS_TRACKING');
 perform update_provider_tracking_location(actor,shipment,jsonb_build_object('area','New phone area','lat',9.3,'lng',38.3,'precision_km',10,'source','DEVICE_OBSCURED'));
 after_fix:=tracking_selected_location(shipment);
 perform pg_temp.radius_assert(after_fix->>'location_precision_km'='10' and after_fix->>'location_lat'='9.3' and(after_fix->>'updated_at')::timestamptz>=cutover,'FRESH_TRACKING_FIX_NOT_CAPPED');
 perform pg_temp.radius_assert((select bool_and((payload->>'radius')::integer<=10) from assigned_location_tracking(actor)),'NEXT_LEASE_RETAINS_RETIRED_RADIUS');
 perform pg_temp.radius_assert(not has_function_privilege('service_role','location_radius_cutover()','EXECUTE')
  and not has_function_privilege('anon','refresh_provider_capacity_location(uuid,jsonb)','EXECUTE'),'RADIUS_PRIVATE_HELPER_EXPOSED');
 raise notice 'PASS: new Capacity20/Tracking10 guards, deliberate fresh manual capture, isolated shipment source epoch, no re-obscured capacity point, next-lease choice and private helper';
end $test$;
rollback;
