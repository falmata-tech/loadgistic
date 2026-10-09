-- Exact local managed database only. All fixture changes are rolled back.
begin;
do $test$
declare owner_id uuid; driver_id uuid; other_driver uuid; org_id uuid; truck_id uuid;
  saved_id uuid; tracking_id uuid:=gen_random_uuid(); row jsonb; route_points jsonb; command jsonb; preference text;
  full_expected boolean; shared_expected boolean; malformed jsonb;
  recipient_digest text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
begin
 select member.user_id,member.organization_id,driver.user_id into strict owner_id,org_id,driver_id
 from organization_members member join drivers driver on driver.organization_id=member.organization_id and driver.active
 join profiles p on p.id=driver.user_id and p.active
 join lateral provider_capacity_actor_scope(member.user_id) actor on actor.workspace_access
 where member.membership_role='OWNER' limit 1;
 select id into strict other_driver from profiles where role='DRIVER' and active and id<>driver_id limit 1;
 row:=create_provider_vehicle(owner_id,'{"make":"World audit","model":"Test truck","plate":"AUDIT-WORLD-LOADS","cargo_configuration":"Mini Box Truck"}');
 truck_id:=(row->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',false,'can_manage_tracking',true));
 command:=jsonb_build_object('vehicle_id',truck_id,'approximate_lat',41.8781,'approximate_lng',-87.6298,'location_precision_km',20,'location_source','DEVICE_OBSCURED');
 row:=refresh_provider_capacity_location(driver_id,command);
 if row->>'locationArea'<>'Around current device area' then raise exception 'FALSE_OVERSEAS_PLACE_LABEL'; end if;
 if not exists(select 1 from vehicle_driver_locations where vehicle_id=truck_id and latitude=41.8781 and longitude=-87.6298 and precision_km=20 and place_ref is null) then raise exception 'WORLD_FIRST_FIX_NOT_SAVED'; end if;
 if exists(select 1 from capacities where vehicle_id=truck_id) then raise exception 'FIRST_FIX_PUBLISHED_CAPACITY'; end if;
 begin perform refresh_provider_capacity_location(owner_id,command);raise exception 'OWNER_DEVICE_ALLOWED';exception when raise_exception then if sqlerrm<>'DEVICE_LOCATION_DRIVER_ONLY' then raise;end if;end;
 begin perform refresh_provider_capacity_location(other_driver,command);raise exception 'FOREIGN_DRIVER_ALLOWED';exception when raise_exception then if sqlerrm not in ('INVALID_VEHICLE','DRIVER_REQUIRED_FOR_CAPACITY') then raise;end if;end;
 for malformed in select value from jsonb_array_elements('[{"approximate_lat":91},{"approximate_lng":181},{"approximate_lat":null},{"approximate_lng":null},{"location_precision_km":2},{"approximate_lat":"NaN"},{"approximate_lng":"Infinity"}]') loop
  begin perform refresh_provider_capacity_location(driver_id,command||malformed);raise exception 'INVALID_WORLD_FIX_ACCEPTED';exception when raise_exception then if sqlerrm<>'INVALID_APPROXIMATE_LOCATION' then raise;end if;end;
 end loop;
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 update company_pages set published=true where organization_id=org_id;
 insert into capacity_access_grants(vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by)
 values(truck_id,'EMAIL','world-load-audit@example.invalid',recipient_digest,owner_id);
 foreach preference in array array['FTL','PTL','BOTH'] loop
  full_expected:=preference in ('FTL','BOTH');shared_expected:=preference in ('PTL','BOTH');
  saved_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_id,'status','EMPTY','availability_geometry','ROUTE','visibility','OPEN','accepted_loads',preference,'current_route_places',route_points,'location_source','PRESERVE_DRIVER','accepts_multi_pick',true,'accepts_multi_drop',false));
  -- HTTP commands have separate transaction timestamps; this rollback-only DO block does not.
  update capacities set updated_at=clock_timestamp() where id=saved_id;
  if not exists(select 1 from capacities where id=saved_id and accepts_full_load=full_expected and accepts_partial_load=shared_expected and location_lat=41.8781 and location_lng=-87.6298 and accepts_multi_pick and not accepts_multi_drop) then raise exception 'LOAD_PREFERENCE_NOT_PERSISTED';end if;
  if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','FTL'),null,null,14))<>full_expected then raise exception 'PUBLIC_FULL_MATRIX_FAILED';end if;
  if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','PTL'),null,null,14))<>shared_expected then raise exception 'PUBLIC_SHARED_MATRIX_FAILED';end if;
  if not exists(select 1 from private_capacity_projection('EMAIL',recipient_digest) p where p.payload->>'id'=saved_id::text) then raise exception 'AUTHORIZED_PRIVATE_PAIR_MISSING';end if;
  if exists(select 1 from private_capacity_projection('EMAIL',repeat('e',64)) p where p.payload->>'id'=saved_id::text) then raise exception 'UNKNOWN_RECIPIENT_EXPOSED';end if;
 end loop;
 -- The database itself overrides a forged Partial/BOTH full-load claim.
 saved_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_id,'status','PARTIAL','availability_geometry','ROUTE','visibility','OPEN','accepted_loads','BOTH','current_route_places',route_points,'location_source','PRESERVE_DRIVER'));
 update capacities set updated_at=clock_timestamp() where id=saved_id;
 if not exists(select 1 from capacities where id=saved_id and not accepts_full_load and accepts_partial_load) then raise exception 'PARTIAL_FULL_LOAD_SAVED';end if;
 if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','FTL'),null,null,14)) then raise exception 'PARTIAL_IN_FULL_SEARCH';end if;
 if not exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','PTL'),null,null,14)) then raise exception 'PARTIAL_MISSING_SHARED_SEARCH';end if;
 perform refresh_provider_capacity_location(driver_id,command||'{"approximate_lat":0,"approximate_lng":0}');
 if not exists(select 1 from capacities where id=saved_id and location_lat=0 and location_lng=0) then raise exception 'ZERO_LOCATION_LOST';end if;
 perform set_provider_assigned_vehicle_duty(driver_id,jsonb_build_object('vehicle_id',truck_id,'on_duty',false));
 perform set_provider_assigned_vehicle_duty(driver_id,command||'{"on_duty":true}');
 if not exists(select 1 from capacities where vehicle_id=truck_id and location_lat=41.8781 and location_lng=-87.6298 and market_status='PARTIAL' and not accepts_full_load) then raise exception 'WORLD_DUTY_RESTORE_FAILED';end if;
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',tracking_id,'code','LGX-'||upper(substr(replace(tracking_id::text,'-',''),1,8)),
  'vehicle_id',truck_id,'origin_place_ref',route_points->0->>'place_ref','destination_place_ref',route_points->1->>'place_ref','cargo_summary','Synthetic worldwide GPS regression',
  'customer_email','world-tracking-audit@example.invalid','customer_email_digest',recipient_digest,'additional_recipients','[]'::jsonb,
  'expected_delivery_date',(current_date+2)::text,'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 perform update_provider_tracking_status(driver_id,tracking_id,jsonb_build_object('next_status','TO_PICKUP','note','',
  'location',jsonb_build_object('area','Around current device area','lat',41.8781,'lng',-87.6298,'precision_km',20,'source','DEVICE_OBSCURED')));
 if not exists(select 1 from provider_shipment_events where shipment_id=tracking_id and location_lat=41.8781 and location_lng=-87.6298) then raise exception 'WORLD_TRACKING_STATUS_LOCATION_LOST';end if;
 -- Make this fixture's first update old enough for the existing ten-minute cadence.
 update provider_shipment_events set created_at=now()-interval '11 minutes' where provider_shipment_events.shipment_id=tracking_id;
 perform update_provider_tracking_location(driver_id,tracking_id,'{"area":"Around current device area","lat":0,"lng":0,"precision_km":20,"source":"DEVICE_OBSCURED"}');
 if not exists(select 1 from provider_shipment_events event where event.shipment_id=tracking_id and event.location_lat=0 and event.location_lng=0) then raise exception 'ZERO_TRACKING_LOCATION_LOST';end if;
 begin perform update_provider_tracking_location(other_driver,tracking_id,'{"area":"Around current device area","lat":41,"lng":-87,"precision_km":20,"source":"DEVICE_OBSCURED"}');raise exception 'FOREIGN_TRACKING_FIX_ALLOWED';exception when raise_exception then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id','','can_manage_capacity',false,'can_manage_tracking',false));
 begin perform refresh_provider_capacity_location(driver_id,command);raise exception 'REVOKED_WORLD_FIX_ACCEPTED';exception when raise_exception then if sqlerrm not in ('INVALID_VEHICLE','DRIVER_REQUIRED_FOR_CAPACITY') then raise;end if;end;
 if has_table_privilege('anon','public.vehicle_driver_locations','SELECT') or has_table_privilege('authenticated','public.vehicle_driver_locations','SELECT')
   or has_function_privilege('anon','public.provider_capacity_nearest_place(double precision,double precision)','EXECUTE')
   or has_function_privilege('authenticated','public.provider_capacity_nearest_place(double precision,double precision)','EXECUTE') then raise exception 'WORLD_LOCATION_BROWSER_ACCESS';end if;
 if not (select relrowsecurity from pg_class where oid='public.vehicle_driver_locations'::regclass) then raise exception 'WORLD_LOCATION_RLS_DISABLED';end if;
 raise notice 'PASS: worldwide first fix, truthful place fallback, stored load matrix, Partial exclusion, zero/duty, owner/foreign/revocation denial and browser isolation';
end $test$;
rollback;
