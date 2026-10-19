-- Isolated transaction: never operate against a hosted project.
begin;
do $test$
declare actor uuid;other_actor uuid;vehicle uuid;first uuid:=gen_random_uuid();second uuid:=gen_random_uuid();session_id uuid:=gen_random_uuid();
 secret text:=encode(gen_random_bytes(32),'hex');second_secret text:=encode(gen_random_bytes(32),'hex');binding jsonb;other_binding jsonb;proof jsonb;result jsonb;stamp timestamptz;
begin
 select a.driver_user_id,a.vehicle_id into strict actor,vehicle from driver_vehicle_assignments a join vehicles v on v.id=a.vehicle_id and v.active
  join profiles p on p.id=a.driver_user_id and p.active join auth.users u on u.id=p.id
  left join telematics_location_sources s on s.vehicle_id=v.id
  where a.active and u.raw_app_meta_data->>'fixture_source'='loadgistic' and coalesce(s.source,'MOBILE')='MOBILE'
   and (p.role='DRIVER' or p.role='TRANSPORTER' and p.drives_truck) and public.fleet_actor_can_use_vehicle(p.id,v.id)
  order by v.id limit 1;
 select p.id into strict other_actor from profiles p where p.active and p.id<>actor and not public.fleet_actor_can_use_vehicle(p.id,vehicle,true) order by p.id limit 1;
 -- Existing real-device bindings must not be silently cleared by a test.
 if real_location_device_in_use(vehicle) then raise exception 'ISOLATED_PHONE_FIXTURE_REQUIRED';end if;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(session_id,actor,clock_timestamp(),clock_timestamp());
 binding:=register_phone_location_installation(actor,first,secret,vehicle,false,session_id);
 if binding->>'actorId'<>actor::text or binding->>'installationId'<>first::text or not real_location_device_in_use(vehicle) then raise exception 'PHONE_REGISTRATION_RESULT';end if;
 result:=register_phone_location_installation(actor,first,secret,vehicle,false,session_id);
 if result->>'bindingId'<>binding->>'bindingId' then raise exception 'PHONE_IDEMPOTENT_REGISTRATION';end if;
 begin perform register_phone_location_installation(actor,first,second_secret,vehicle,false,session_id);raise exception 'PHONE_SECRET_BYPASS';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_UNAVAILABLE' then raise;end if;end;
 begin perform register_phone_location_installation(other_actor,first,secret,vehicle,false,session_id);raise exception 'FOREIGN_PHONE_REGISTRATION';exception when raise_exception then if sqlerrm not in('NOT_FOUND','FORBIDDEN') then raise;end if;end;
 begin perform register_phone_location_installation(actor,second,second_secret,vehicle,false,session_id);raise exception 'UNCONFIRMED_PHONE_TAKEOVER';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_IN_USE' then raise;end if;end;
 other_binding:=register_phone_location_installation(actor,second,second_secret,vehicle,true,session_id);
 begin perform register_phone_location_installation(actor,first,secret,vehicle,false,session_id);raise exception 'SUPERSEDED_PHONE_RECLAIM';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_SUPERSEDED' then raise;end if;end;
 stamp:=clock_timestamp();
 proof:=jsonb_build_object('installation_id',second,'secret_digest',second_secret,'binding_id',other_binding->>'bindingId','revision',other_binding->>'revision','report_id',gen_random_uuid(),'observed_at',stamp);
 begin perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',41,'approximate_lng',-87,'location_precision_km',10));raise exception 'LEGACY_PHONE_BYPASS';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_UNAVAILABLE' then raise;end if;end;
 result:=refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',41,'approximate_lng',-87,'location_precision_km',10,'phone_installation',proof));
 if not exists(select 1 from vehicle_driver_locations l where l.vehicle_id=vehicle and l.phone_binding_id=(other_binding->>'bindingId')::uuid and l.observed_at=stamp and l.updated_at=stamp) then raise exception 'PHONE_OBSERVATION_ATTRIBUTION';end if;
 result:=refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',42,'approximate_lng',-88,'location_precision_km',10,'phone_installation',proof));
 if result->>'reason'<>'THROTTLED' or exists(select 1 from vehicle_driver_locations l where l.vehicle_id=vehicle and l.latitude=42) then raise exception 'PHONE_REPLAY_WROTE';end if;
 begin perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',42,'approximate_lng',-88,'location_precision_km',10,'phone_installation',proof||jsonb_build_object('observed_at',stamp-interval '1 second','report_id',gen_random_uuid())));raise exception 'OUT_OF_ORDER_PHONE_FIX';exception when raise_exception then if sqlerrm<>'INVALID_PHONE_LOCATION' then raise;end if;end;
 begin perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',42,'approximate_lng',-88,'location_precision_km',10,'phone_installation',proof||jsonb_build_object('installation_id',first,'binding_id',binding->>'bindingId','revision',binding->>'revision','secret_digest',secret,'report_id',gen_random_uuid())));raise exception 'SUPERSEDED_PHONE_REPORT';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_UNAVAILABLE' then raise;end if;end;
 update phone_location_bindings set expires_at=clock_timestamp()-interval '1 second' where id=(other_binding->>'bindingId')::uuid;
 if phone_location_binding_is_current((other_binding->>'bindingId')::uuid) or not real_location_device_in_use(vehicle) then raise exception 'EXPIRED_REPORT_LEASE_RESUMED_DEMO_WHILE_PHONE_SIGNED_IN';end if;
 begin perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',42,'approximate_lng',-88,'location_precision_km',10,'phone_installation',proof||jsonb_build_object('report_id',gen_random_uuid())));raise exception 'EXPIRED_PHONE_REPORT';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_UNAVAILABLE' then raise;end if;end;
 perform revoke_phone_location_auth_session(actor,gen_random_uuid());if not real_location_device_in_use(vehicle) then raise exception 'OTHER_SESSION_REVOKED_PHONE';end if;
 perform revoke_phone_location_auth_session(actor,session_id);if real_location_device_in_use(vehicle) then raise exception 'AUTH_LOGOUT_RETAINED_PHONE';end if;
 begin perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',vehicle,'approximate_lat',42,'approximate_lng',-88,'location_precision_km',10,'phone_installation',proof||jsonb_build_object('report_id',gen_random_uuid())));raise exception 'LOGGED_OUT_PHONE_REPORT';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_UNAVAILABLE' then raise;end if;end;
 perform release_phone_location_installation(second,second_secret,(other_binding->>'bindingId')::uuid,(other_binding->>'revision')::uuid);
 other_binding:=register_phone_location_installation(actor,second,second_secret,vehicle,false,session_id);
 if not phone_location_binding_is_current((other_binding->>'bindingId')::uuid) then raise exception 'LIVE_AUTH_BINDING_NOT_CURRENT';end if;
 delete from auth.sessions where id=session_id;
 if phone_location_binding_is_current((other_binding->>'bindingId')::uuid) or real_location_device_in_use(vehicle) then raise exception 'EXTERNALLY_REVOKED_AUTH_RETAINED_PHONE';end if;
 begin perform phone_location_workspace(other_actor,vehicle);raise exception 'FOREIGN_PRIVATE_PHONE_DETAILS';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 raise notice 'PASS: private installation enrollment, exact-secret/assignment checks, explicit takeover, stale/replay rejection, actual-session logout and private read denial';
end $test$;

-- New owned fixtures isolate actual status transitions from the managed roster.
do $status$
declare actor uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();vehicle uuid;shipment uuid:=gen_random_uuid();session_id uuid:=gen_random_uuid();installation uuid:=gen_random_uuid();
 secret text:=encode(gen_random_bytes(32),'hex');binding jsonb;proof jsonb;cities text[];result jsonb;stamp timestamptz;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(actor,actor||'@example.invalid',clock_timestamp(),'{}','{}');
 update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic phone status owner' where id=actor;
 insert into provider_profiles(id,user_id,business_name,handle) values(provider,actor,'Phone status fixture','phone-status-'||actor);
 perform accept_content_policy(actor,'2026-10-09');
 vehicle:=(create_provider_vehicle(actor,'{"make":"Phone fixture","model":"Truck","plate":"PHONE-157-TEST","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(actor,jsonb_build_object('driver_user_id',actor,'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',true));
 insert into auth.sessions(id,user_id,created_at,updated_at) values(session_id,actor,clock_timestamp(),clock_timestamp());
 binding:=register_phone_location_installation(actor,installation,secret,vehicle,false,session_id);
 select array_agg(id order by id) into cities from(select id from place_catalog order by id limit 3) p;
 perform create_provider_tracking_with_recipients(actor,jsonb_build_object('id',shipment,'code','LGX-'||upper(substr(replace(shipment::text,'-',''),1,8)),
  'vehicle_id',vehicle,'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],
  'cargo_summary','Synthetic phone status regression','customer_email','phone-status@example.invalid','customer_email_digest',encode(gen_random_bytes(32),'hex'),
  'tracking_mode','LOCATION_AND_STATUS','expected_delivery_date',(current_date+2)::text,'tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 begin perform update_provider_tracking_status(actor,shipment,'{"next_status":"LOADING"}');raise exception 'PHONE_STATUS_SKIPPED_LOADING_PROOF';exception when raise_exception then if sqlerrm<>'TRACKING_HANDOVER_PROOF_REQUIRED' then raise;end if;end;
 result:=update_provider_tracking_status(actor,shipment,'{"next_status":"LOADING","proof":{"path":"supabase://shipment-proof/phone-157-loading.jpg","original_name":"loading.jpg","mime_type":"image/jpeg"}}');
 if result->>'status'<>'LOADING' then raise exception 'PHONE_STATUS_WITHOUT_LOCATION_FAILED';end if;
 begin perform update_provider_tracking_status(actor,shipment,'{"next_status":"IN_TRANSIT"}');raise exception 'PHONE_STATUS_SKIPPED_REQUIRED_LOCATION';exception when raise_exception then if sqlerrm<>'TRACKING_DEVICE_LOCATION_REQUIRED' then raise;end if;end;
 stamp:=clock_timestamp();proof:=jsonb_build_object('installation_id',installation,'secret_digest',secret,'binding_id',binding->>'bindingId','revision',binding->>'revision','report_id',gen_random_uuid(),'observed_at',stamp);
 begin perform update_provider_tracking_status(actor,shipment,jsonb_build_object('next_status','IN_TRANSIT','location',jsonb_build_object('area','Synthetic area','lat',9.1,'lng',38.1,'precision_km',10,'source','DEVICE_OBSCURED','phone_installation',proof||jsonb_build_object('revision',gen_random_uuid()))));raise exception 'PHONE_STATUS_FORGED_BINDING';exception when raise_exception then if sqlerrm<>'PHONE_LOCATION_UNAVAILABLE' then raise;end if;end;
 begin perform update_provider_tracking_status(actor,shipment,jsonb_build_object('next_status','IN_TRANSIT','location',jsonb_build_object('area','Synthetic area','lat',9.1,'lng',38.1,'precision_km',10,'source','DEVICE_OBSCURED','phone_installation',proof||jsonb_build_object('observed_at',stamp-interval '3 minutes'))));raise exception 'PHONE_STATUS_STALE_FIX';exception when raise_exception then if sqlerrm<>'INVALID_PHONE_LOCATION' then raise;end if;end;
 if (select operational_status from provider_shipments where id=shipment)<>'LOADING' then raise exception 'DENIED_PHONE_STATUS_CHANGED_SHIPMENT';end if;
 result:=update_provider_tracking_status(actor,shipment,jsonb_build_object('next_status','IN_TRANSIT','location',jsonb_build_object('area','Synthetic area','lat',9.1,'lng',38.1,'precision_km',10,'source','DEVICE_OBSCURED','phone_installation',proof)));
 if result->>'status'<>'IN_TRANSIT' or not exists(select 1 from provider_shipment_events e where e.shipment_id=shipment and e.status='IN_TRANSIT' and e.phone_binding_id=(binding->>'bindingId')::uuid and e.location_observed_at=stamp) then raise exception 'PHONE_STATUS_WITH_PROOF_ATTRIBUTION_FAILED';end if;
 raise notice 'PASS: actual status transitions without location, required loading proof/location, forged/stale installation denial and attributed phone fix';
end $status$;
rollback;
