-- Exact local managed database only. All fixture changes are rolled back.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid();driver_id uuid:=gen_random_uuid();other_driver uuid:=gen_random_uuid();
  broker_id uuid:=gen_random_uuid();broker_workspace uuid;connection_id uuid;
  org_id uuid:=gen_random_uuid();other_provider uuid:=gen_random_uuid();truck_id uuid;admin_id uuid;source_id uuid;capacity_count integer;
  saved_id uuid; tracking_id uuid:=gen_random_uuid(); row jsonb; route_points jsonb; command jsonb; preference text;
  full_expected boolean; shared_expected boolean; malformed jsonb;
  recipient_digest text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
begin
 -- New synthetic workspaces avoid moving any existing fixture driver's active job.
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,owner_id||'@example.test',now(),'{}','{}'),(driver_id,driver_id||'@example.test',now(),'{}','{}'),
 (other_driver,other_driver||'@example.test',now(),'{}','{}'),
 (broker_id,broker_id||'@example.test',now(),'{}','{}');
 update profiles set active=true,role='TRANSPORTER',full_name='Synthetic world owner' where id=owner_id;
 update profiles set active=true,role='DRIVER',drives_truck=true,full_name='Synthetic foreign driver' where id=other_driver;
 update profiles set active=true,role='SHIPPER' where id=broker_id;
 insert into organizations(id,name,handle,type) values(org_id,'Synthetic world provider','world-'||owner_id,'TRANSPORT_COMPANY');
 insert into organization_members(user_id,organization_id,membership_role) values(owner_id,org_id,'OWNER');
 insert into provider_profiles(id,user_id,business_name,handle) values(other_provider,other_driver,'Synthetic foreign provider','world-'||other_driver);
 insert into company_pages(organization_id,published) values(org_id,true);
 perform accept_content_policy(owner_id,'2026-10-09');perform accept_content_policy(other_driver,'2026-10-09');
 perform fleet_register_driver(owner_id,driver_id,jsonb_build_object('name','Synthetic world driver','email',driver_id||'@example.test','phone','+251900000115'));
 perform accept_content_policy(driver_id,'2026-10-09');
 row:=create_provider_vehicle(owner_id,'{"make":"World audit","model":"Test truck","plate":"AUDIT-WORLD-LOADS","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}');
 truck_id:=(row->>'id')::uuid;
 source_id:=submit_managed_verification(owner_id,jsonb_build_object('subject_type','VEHICLE','subject_id',truck_id,'verification_type','VEHICLE_OWNERSHIP',
  'document_name','Synthetic worldwide title','storage_path','supabase://verification/verification/worldwide-title.pdf','original_name','title.pdf','mime_type','application/pdf'));
 perform review_managed_verification(admin_id,source_id,'APPROVED','Synthetic worldwide document review.');
 perform confirm_provider_vehicle_authority(admin_id,source_id,jsonb_build_object('fact_kind','OWNERSHIP','review_note','Synthetic exact business title holder.',
  'context_revision',managed_provider_authority_review_context(admin_id,array[source_id])->0->>'contextRevision'));
 perform set_provider_vehicle_publication(owner_id,truck_id,'LIVE');
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',false,'can_manage_tracking',true));
 select count(*) into capacity_count from capacities where vehicle_id=truck_id;
 command:=jsonb_build_object('vehicle_id',truck_id,'approximate_lat',41.8781,'approximate_lng',-87.6298,'location_precision_km',20,'location_source','DEVICE_OBSCURED');
 row:=refresh_provider_capacity_location(driver_id,command);
 if row->>'locationArea'<>'Around current device area' then raise exception 'FALSE_OVERSEAS_PLACE_LABEL'; end if;
 if not exists(select 1 from vehicle_driver_locations where vehicle_id=truck_id and latitude=41.8781 and longitude=-87.6298 and precision_km=20 and place_ref is null) then raise exception 'WORLD_FIRST_FIX_NOT_SAVED'; end if;
 if (select count(*) from capacities where vehicle_id=truck_id)<>capacity_count
  or exists(select 1 from capacities where vehicle_id=truck_id and coalesce(market_status,status::text)<>'OFF_DUTY')
 then raise exception 'FIRST_FIX_PUBLISHED_CAPACITY';end if;
 begin perform refresh_provider_capacity_location(owner_id,command);raise exception 'OWNER_DEVICE_ALLOWED';exception when raise_exception then if sqlerrm not in ('DRIVER_REQUIRED_FOR_CAPACITY','FORBIDDEN') then raise;end if;end;
 begin perform refresh_provider_capacity_location(other_driver,command);raise exception 'FOREIGN_DRIVER_ALLOWED';exception when raise_exception then if sqlerrm not in ('INVALID_VEHICLE','DRIVER_REQUIRED_FOR_CAPACITY','FORBIDDEN') then raise;end if;end;
 for malformed in select value from jsonb_array_elements('[{"approximate_lat":91},{"approximate_lng":181},{"approximate_lat":null},{"approximate_lng":null},{"location_precision_km":2},{"approximate_lat":"NaN"},{"approximate_lng":"Infinity"}]') loop
  begin perform refresh_provider_capacity_location(driver_id,command||malformed);raise exception 'INVALID_WORLD_FIX_ACCEPTED';exception when raise_exception then if sqlerrm<>(case when malformed ? 'location_precision_km' then 'INVALID_LOCATION_PRIVACY' else 'INVALID_APPROXIMATE_LOCATION' end) then raise;end if;end;
 end loop;
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 broker_workspace:=(business_workspace_create(broker_id,jsonb_build_object('name','World load broker','handle','world-broker-'||substr(broker_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 connection_id:=(request_account_connection(owner_id,'BUSINESS',broker_workspace)->>'id')::uuid;
 perform decide_account_connection(broker_id,connection_id,'ACCEPT');
 perform grant_account_capacity_access(owner_id,connection_id,truck_id);
 perform set_provider_capacity_sharing(owner_id,truck_id,'BOTH');
 foreach preference in array array['FTL','PTL','BOTH'] loop
  full_expected:=preference in ('FTL','BOTH');shared_expected:=preference in ('PTL','BOTH');
  saved_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_id,'status','EMPTY','availability_geometry','ROUTE','sharing_mode','BOTH','accepted_loads',preference,'current_route_places',route_points,'location_source','PRESERVE_DRIVER','accepts_multi_pick',true,'accepts_multi_drop',false));
  if (select id from capacities where vehicle_id=truck_id order by updated_at desc,id desc limit 1) is distinct from saved_id
  then raise exception 'LATEST_WORLD_LOAD_REPORT_LOST';end if;
  if not exists(select 1 from capacities where id=saved_id and accepts_full_load=full_expected and accepts_partial_load=shared_expected and location_lat=41.8781 and location_lng=-87.6298 and accepts_multi_pick and not accepts_multi_drop) then raise exception 'LOAD_PREFERENCE_NOT_PERSISTED';end if;
  if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','FTL'),null,null,14))<>full_expected then raise exception 'PUBLIC_FULL_MATRIX_FAILED';end if;
  if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','PTL'),null,null,14))<>shared_expected then raise exception 'PUBLIC_SHARED_MATRIX_FAILED';end if;
  if not exists(select 1 from account_capacity_filtered_page(broker_id,recipient_digest) p where p.payload->>'id'=saved_id::text) then raise exception 'AUTHORIZED_PRIVATE_PAIR_MISSING';end if;
  if exists(select 1 from account_capacity_filtered_page(other_driver,recipient_digest) p where p.payload->>'id'=saved_id::text) then raise exception 'FOREIGN_ACCOUNT_EXPOSED';end if;
 end loop;
 -- The database itself overrides a forged Partial/BOTH full-load claim.
 saved_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_id,'status','PARTIAL','availability_geometry','ROUTE','sharing_mode','BOTH','accepted_loads','BOTH','current_route_places',route_points,'location_source','PRESERVE_DRIVER'));
 if (select id from capacities where vehicle_id=truck_id order by updated_at desc,id desc limit 1) is distinct from saved_id
 then raise exception 'LATEST_PARTIAL_REPORT_LOST';end if;
 if not exists(select 1 from capacities where id=saved_id and not accepts_full_load and accepts_partial_load) then raise exception 'PARTIAL_FULL_LOAD_SAVED';end if;
 if exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','FTL'),null,null,14)) then raise exception 'PARTIAL_IN_FULL_SEARCH';end if;
 if not exists(select 1 from capacity_search_public_rows(jsonb_build_object('capacity_id',saved_id,'load_type','PTL'),null,null,14)) then raise exception 'PARTIAL_MISSING_SHARED_SEARCH';end if;
 perform refresh_provider_capacity_location(driver_id,command||'{"approximate_lat":0,"approximate_lng":0}');
 if not exists(select 1 from capacities where id=saved_id and location_lat=0 and location_lng=0) then raise exception 'ZERO_LOCATION_LOST';end if;
 perform set_provider_assigned_vehicle_duty(driver_id,jsonb_build_object('vehicle_id',truck_id,'on_duty',false));
 perform set_provider_assigned_vehicle_duty(driver_id,command||'{"on_duty":true}');
 if not exists(select 1 from capacities where vehicle_id=truck_id and location_lat=41.8781 and location_lng=-87.6298 and market_status='PARTIAL' and not accepts_full_load) then raise exception 'WORLD_DUTY_RESTORE_FAILED';end if;
 perform create_provider_tracking_with_recipients(owner_id,jsonb_build_object('id',tracking_id,'code','LGX-'||upper(substr(replace(tracking_id::text,'-',''),1,8)),
  'vehicle_id',truck_id,'origin_place_ref',route_points->0->>'place_ref','destination_place_ref',route_points->1->>'place_ref','passing_place_ref',(select id from place_catalog where id not in(route_points->0->>'place_ref',route_points->1->>'place_ref') order by id limit 1),'cargo_summary','Synthetic worldwide GPS regression',
  'customer_email','world-tracking-audit@example.invalid','customer_email_digest',recipient_digest,'additional_recipients','[]'::jsonb,
  'expected_delivery_date',(current_date+2)::text,'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',encode(gen_random_bytes(32),'hex'),'review_code_hash',encode(gen_random_bytes(32),'hex')));
 perform update_provider_tracking_status(driver_id,tracking_id,jsonb_build_object('next_status','TO_PICKUP','note','',
  'location',jsonb_build_object('area','Around current device area','lat',41.8781,'lng',-87.6298,'precision_km',10,'source','DEVICE_OBSCURED')));
 if not exists(select 1 from provider_shipment_events where shipment_id=tracking_id and location_lat=41.8781 and location_lng=-87.6298) then raise exception 'WORLD_TRACKING_STATUS_LOCATION_LOST';end if;
 -- Make this fixture's first update old enough for the existing ten-minute cadence.
 update provider_shipment_events set created_at=now()-interval '11 minutes' where provider_shipment_events.shipment_id=tracking_id;
 perform update_provider_tracking_location(driver_id,tracking_id,'{"area":"Around current device area","lat":0,"lng":0,"precision_km":10,"source":"DEVICE_OBSCURED"}');
 if not exists(select 1 from provider_shipment_events event where event.shipment_id=tracking_id and event.location_lat=0 and event.location_lng=0) then raise exception 'ZERO_TRACKING_LOCATION_LOST';end if;
 begin perform update_provider_tracking_location(other_driver,tracking_id,'{"area":"Around current device area","lat":41,"lng":-87,"precision_km":10,"source":"DEVICE_OBSCURED"}');raise exception 'FOREIGN_TRACKING_FIX_ALLOWED';exception when raise_exception then if sqlerrm not in ('NOT_FOUND','FORBIDDEN') then raise;end if;end;
 begin
  perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id','','can_manage_capacity',false,'can_manage_tracking',false));
  raise exception 'UNFINISHED_TRACKING_DRIVER_UNASSIGNED';
 exception when raise_exception then if sqlerrm<>'TRUCK_HAS_ACTIVE_TRACKING' then raise;end if;end;
 begin
  perform recover_provider_tracking(owner_id,tracking_id,jsonb_build_object('action','CANCEL','confirm','CANCEL','reason','Synthetic provider cancellation denied',
   'revision',(select updated_at from provider_shipments where id=tracking_id)));
  raise exception 'LOCATION_TRACKING_PROVIDER_CANCELLED';
 exception when raise_exception then if sqlerrm<>'TRACKING_STAFF_RELEASE_REQUIRED' then raise;end if;end;
 perform recover_provider_tracking(admin_id,tracking_id,jsonb_build_object('action','CANCEL','confirm','CANCEL','reason','Synthetic authorized worldwide test release',
  'revision',(select updated_at from provider_shipments where id=tracking_id)));
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id','','can_manage_capacity',false,'can_manage_tracking',false));
 begin perform refresh_provider_capacity_location(driver_id,command);raise exception 'REVOKED_WORLD_FIX_ACCEPTED';exception when raise_exception then if sqlerrm not in ('INVALID_VEHICLE','DRIVER_REQUIRED_FOR_CAPACITY','FORBIDDEN') then raise;end if;end;
 if has_table_privilege('anon','public.vehicle_driver_locations','SELECT') or has_table_privilege('authenticated','public.vehicle_driver_locations','SELECT')
   or has_function_privilege('anon','public.provider_capacity_nearest_place(double precision,double precision)','EXECUTE')
   or has_function_privilege('authenticated','public.provider_capacity_nearest_place(double precision,double precision)','EXECUTE') then raise exception 'WORLD_LOCATION_BROWSER_ACCESS';end if;
 if not (select relrowsecurity from pg_class where oid='public.vehicle_driver_locations'::regclass) then raise exception 'WORLD_LOCATION_RLS_DISABLED';end if;
 raise notice 'PASS: worldwide first fix, truthful place fallback, stored load matrix, Partial exclusion, zero/duty, owner/foreign/revocation denial and browser isolation';
end $test$;
rollback;
