-- FEAT-TRK-001: synthetic fixture commands, all mutations rolled back.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid();driver_id uuid;truck_id uuid;s_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();other_provider uuid:=gen_random_uuid();
 session_id uuid:=gen_random_uuid();installation_id uuid:=gen_random_uuid();installation_secret text:=encode(gen_random_bytes(32),'hex');lease_digest text:=encode(gen_random_bytes(32),'hex');
 cities text[];command jsonb;result jsonb;binding jsonb;recipient_digest text:=repeat('8',64);revision text;invalid_city text:='route-invalid-'||gen_random_uuid();private_name text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
  (owner_id,owner_id||'@example.invalid',now(),'{}','{}'),(other_id,other_id||'@example.invalid',now(),'{}','{}');
 update public.profiles set active=true,role='DRIVER',full_name='Synthetic Public PrivateSurname' where id in(owner_id,other_id);
 update public.profiles set drives_truck=true where id=owner_id;
 insert into public.provider_profiles(id,user_id,business_name,handle) values
  (provider_id,owner_id,'Synthetic route provider','route-'||owner_id),(other_provider,other_id,'Unrelated route provider','route-'||other_id);
 perform accept_content_policy(owner_id,'2026-10-09');
 driver_id:=owner_id;
 insert into public.company_pages(provider_profile_id,published,contact_phone,show_contact_phone) values(provider_id,true,'+251900000000',false);
 result:=create_provider_vehicle(owner_id,'{"make":"Tracking route audit","model":"Test","plate":"ROUTE-MAP-AUDIT","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}');truck_id:=(result->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 select array_agg(id order by id) into cities from (select id from place_catalog where latitude between -90 and 90 and longitude between -180 and 180 order by id limit 3) p;
 insert into place_catalog(id,name,normalized_name,place_type,latitude,longitude,source) values(invalid_city,'Synthetic invalid city',invalid_city,'CITY',91,0,'TEST');
 command:=jsonb_build_object('id',s_id,'code','LGX-'||upper(substr(replace(s_id::text,'-',''),1,8)),
  'vehicle_id',truck_id,'origin_place_ref',cities[1],'passing_place_ref',cities[2],'destination_place_ref',cities[3],
  'cargo_summary','Synthetic route map regression','customer_email','route-owner@example.invalid','customer_email_digest',recipient_digest,
  'expected_delivery_date',(current_date+2)::text,'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex'));
 begin perform create_provider_tracking_with_recipients(owner_id,command-'passing_place_ref');raise exception 'MISSING_PASSING_CITY_ALLOWED';exception when raise_exception then if sqlerrm<>'LOCALITY_REQUIRED' then raise;end if;end;
 begin perform create_provider_tracking_with_recipients(owner_id,command||jsonb_build_object('passing_place_ref',cities[1]));raise exception 'REPEATED_PASSING_CITY_ALLOWED';exception when raise_exception then if sqlerrm<>'ROUTE_LOCATIONS_MUST_DIFFER' then raise;end if;end;
 begin perform create_provider_tracking_with_recipients(owner_id,command||jsonb_build_object('origin_place_ref',' '||cities[2]||' '));raise exception 'PADDED_REPEATED_CITY_ALLOWED';exception when raise_exception then if sqlerrm<>'ROUTE_LOCATIONS_MUST_DIFFER' then raise;end if;end;
 begin perform create_provider_tracking_with_recipients(owner_id,command||jsonb_build_object('origin_place_ref',invalid_city));raise exception 'INVALID_ENDPOINT_CREATE_ALLOWED';exception when raise_exception then if sqlerrm<>'LOCALITY_REQUIRED' then raise;end if;end;
 begin perform create_provider_tracking_with_recipients(other_id,command);raise exception 'FOREIGN_PROVIDER_CREATE_ALLOWED';exception when raise_exception then if sqlerrm not in ('FORBIDDEN','INVALID_VEHICLE') then raise;end if;end;
 perform create_provider_tracking_with_recipients(owner_id,command);
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if jsonb_array_length(result->'route')<>3 or result->'route'->1->>'placeRef' is distinct from cities[2] then raise exception 'ORDERED_ROUTE_PROJECTION_MISSING';end if;
 if result::text like '%ROUTE-MAP-AUDIT%' or result::text like '%route-owner@example.invalid%' or result::text like '%proof_storage_path%' then raise exception 'PRIVATE_MAP_PROJECTION_LEAK';end if;
 if result->'public_truck_summary'->>'make' is distinct from 'Tracking route audit' then raise exception 'PUBLIC_TRUCK_IDENTITY_MISSING';end if;
 if result->'public_truck_summary'->>'driverName' is distinct from 'Synthetic' or result->'public_truck_summary'->>'driverPhone' is not null or result->'public_truck_summary'->>'contactPhone' is not null then raise exception 'HIDDEN_CONTACT_OR_FULL_NAME_LEAK';end if;
 foreach private_name in array array[E'Synthetic\tPrivateSurname',E'  Synthetic\nPrivateSurname  '] loop
  update profiles set full_name=private_name where id=driver_id;
  result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
  if result->'public_truck_summary'->>'driverName' is distinct from 'Synthetic' then raise exception 'WHITESPACE_SURNAME_LEAK';end if;
 end loop;
 update company_pages set show_contact_phone=true where provider_profile_id=provider_id;
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if result->'public_truck_summary'->>'contactPhone' is distinct from '+251900000000' then raise exception 'PUBLISHED_CONTACT_MISSING';end if;
 update provider_profiles set content_hidden=true where id=provider_id;
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if result->'public_truck_summary' is distinct from 'null'::jsonb then raise exception 'MODERATED_PUBLIC_IDENTITY_LEAK';end if;
 update provider_profiles set content_hidden=false,review_workspace=true where id=provider_id;
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if result->'public_truck_summary' is distinct from 'null'::jsonb then raise exception 'REVIEW_PUBLIC_IDENTITY_LEAK';end if;
 update provider_profiles set review_workspace=false where id=provider_id;
 -- Exercise current normal phone reporting through an assigned registered installation.
 insert into auth.sessions(id,user_id,created_at,updated_at) values(session_id,driver_id,clock_timestamp(),clock_timestamp());
 binding:=register_phone_location_installation(driver_id,installation_id,installation_secret,truck_id,false,session_id);
 perform issue_registered_tracking_device_lease(driver_id,s_id,installation_id,installation_secret,lease_digest,10);
 perform report_tracking_device_location(lease_digest,jsonb_build_object('area','Synthetic approximate area','lat',41,'lng',-87,'precision_km',10,'source','DEVICE_OBSCURED','observed_at',clock_timestamp(),'report_id',gen_random_uuid()));
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if result->'current_location'->>'location_precision_km' is distinct from '10' then raise exception 'APPROXIMATE_FIX_MISSING';end if;
 if provider_tracking_detail(other_id,s_id::text) is not null or provider_guest_tracking_for_recipient(s_id,repeat('9',64)) is not null then raise exception 'UNAUTHORIZED_ROUTE_READ';end if;
 revision:=(select updated_at::text from provider_shipments where id=s_id);
 begin perform recover_provider_tracking(owner_id,s_id,jsonb_build_object('action','CORRECT','reason','Synthetic invalid endpoint correction','revision',revision,'cargo_summary','Synthetic route cargo','origin_place_ref',invalid_city,'passing_place_ref',cities[2],'destination_place_ref',cities[3],'expected_pickup_date','','expected_delivery_date',(current_date+2)::text));raise exception 'INVALID_ENDPOINT_CORRECTION_ALLOWED';exception when raise_exception then if sqlerrm<>'LOCALITY_REQUIRED' then raise;end if;end;
 begin perform recover_provider_tracking(owner_id,s_id,jsonb_build_object('action','CORRECT','reason','Synthetic route audit correction','revision',revision,'cargo_summary','Synthetic route cargo','origin_place_ref',cities[1],'passing_place_ref',cities[1],'destination_place_ref',cities[3],'expected_pickup_date','','expected_delivery_date',(current_date+2)::text));raise exception 'REPEATED_CORRECTION_ALLOWED';exception when raise_exception then if sqlerrm<>'ROUTE_LOCATIONS_MUST_DIFFER' then raise;end if;end;
 perform recover_provider_tracking(owner_id,s_id,jsonb_build_object('action','CORRECT','reason','Synthetic ordered route correction','revision',revision,'cargo_summary','Synthetic route cargo','origin_place_ref',cities[2],'passing_place_ref',cities[1],'destination_place_ref',cities[3],'expected_pickup_date','','expected_delivery_date',(current_date+2)::text));
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if result->'route'->0->>'placeRef' is distinct from cities[2] or result->'route'->1->>'placeRef' is distinct from cities[1] then raise exception 'ROUTE_CORRECTION_NOT_ATOMIC';end if;
 if not exists(select 1 from provider_tracking_recoveries r where r.shipment_id=s_id and r.before_state->>'passing_place_ref'=cities[2] and r.after_state->>'passing_place_ref'=cities[1]) then raise exception 'PASSING_CORRECTION_AUDIT_MISSING';end if;
 begin perform recover_provider_tracking(owner_id,s_id,jsonb_build_object('action','CORRECT','reason','Synthetic stale route correction','revision',revision,'cargo_summary','Synthetic route cargo','origin_place_ref',cities[2],'passing_place_ref',cities[1],'destination_place_ref',cities[3],'expected_pickup_date','','expected_delivery_date',(current_date+2)::text));raise exception 'STALE_ROUTE_CORRECTION_ALLOWED';exception when raise_exception then if sqlerrm<>'TRACKING_CHANGED' then raise;end if;end;
 -- Historical rows can remain two-city records; do not synthesize a middle stop.
 update provider_shipments set passing_place_ref=null,passing=null,passing_lat=null,passing_lng=null where id=s_id;
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if jsonb_array_length(result->'route')<>2 then raise exception 'LEGACY_ROUTE_INVENTED';end if;
 perform update_provider_tracking_status(driver_id,s_id,'{"next_status":"LOADING","proof":{"path":"supabase://shipment-proof/synthetic-route-loading.jpg","original_name":"loading.jpg","mime_type":"image/jpeg"}}');
 revision:=(select updated_at::text from provider_shipments where id=s_id);
 begin perform recover_provider_tracking(owner_id,s_id,jsonb_build_object('action','CORRECT','reason','Synthetic locked route correction','revision',revision,'cargo_summary','Synthetic route cargo','origin_place_ref',cities[2],'passing_place_ref',cities[1],'destination_place_ref',cities[3],'expected_pickup_date','','expected_delivery_date',(current_date+2)::text));raise exception 'LOADED_ROUTE_CORRECTION_ALLOWED';exception when raise_exception then if sqlerrm<>'TRACKING_ROUTE_LOCKED' then raise;end if;end;
 perform update_provider_tracking_status(driver_id,s_id,jsonb_build_object('next_status','IN_TRANSIT','location',jsonb_build_object(
  'area','Synthetic approximate area','lat',41,'lng',-87,'precision_km',10,'source','DEVICE_OBSCURED',
  'phone_installation',jsonb_build_object('installation_id',installation_id,'secret_digest',installation_secret,
   'binding_id',binding->>'bindingId','revision',binding->>'revision','report_id',gen_random_uuid(),'observed_at',clock_timestamp()))));
 perform update_provider_tracking_status(driver_id,s_id,'{"next_status":"UNLOADING","proof":{"path":"supabase://shipment-proof/synthetic-route-unloading.jpg","original_name":"unloading.jpg","mime_type":"image/jpeg"}}');
 perform approve_provider_handover(s_id,recipient_digest,clock_timestamp());
 result:=provider_guest_tracking_for_recipient(s_id,recipient_digest);
 if result->'current_location' is distinct from 'null'::jsonb or jsonb_array_length(result->'route')<>2 then raise exception 'TERMINAL_MAP_LOCATION_OR_ROUTE';end if;
 update provider_tracking_recipients set revoked_at=clock_timestamp() where shipment_id=s_id;
 if provider_guest_tracking_for_recipient(s_id,recipient_digest) is not null then raise exception 'REVOKED_ROUTE_READ';end if;
 if has_function_privilege('anon','public.tracking_route_projection(uuid)','execute') or has_function_privilege('authenticated','public.tracking_public_truck_summary(uuid)','execute') then raise exception 'DIRECT_MAP_RPC_EXPOSURE';end if;
 raise notice 'PASS: required/distinct catalog route, ordered snapshots, legacy route, narrow identity and authorization';
end $test$;
rollback;
