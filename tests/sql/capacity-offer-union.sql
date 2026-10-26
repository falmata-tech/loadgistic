-- FEAT-CAP-001 / FEAT-GEO-001: one vehicle, complete current/Preferred offers,
-- Partial service areas, older private visibility and unchanged tenant scope.
begin;
set local statement_timeout='30s';
do $offers$
declare
  current_route jsonb:='[{"lat":9.006,"lng":38.732},{"lat":8.517,"lng":39.261}]';
  addis_area jsonb:='[{"lat":9.060,"lng":38.500},{"lat":8.919,"lng":38.600},{"lat":8.750,"lng":38.990},{"lat":9.180,"lng":38.750}]';
  eastern_area jsonb:='[{"lat":9.10,"lng":41.80},{"lat":9.10,"lng":42.90},{"lat":9.60,"lng":42.90},{"lat":9.60,"lng":41.80}]';
  item jsonb;query jsonb;
begin
  item:=jsonb_build_object('status','PARTIAL','availability_geometry','RADIUS',
    'capacity_area_boundary',addis_area,'current_route_points','[]'::jsonb,
    'recurring_corridors',jsonb_build_array(jsonb_build_object('geometry','ROUTE','route_points',current_route)),
    'updated_at',now(),'accepts_full_load',false,'accepts_partial_load',true);
  query:='{"origin_lat":9.006,"origin_lng":38.732,"destination_lat":8.919,"destination_lng":38.600,"origin_radius_km":5,"destination_radius_km":5}';
  if not public.capacity_payload_matches(item,query) then raise exception 'PARTIAL_CURRENT_AREA_REJECTED';end if;
  if not public.capacity_payload_matches(item,query||'{"geometry":"RADIUS"}') then raise exception 'PARTIAL_AREA_GEOMETRY_REJECTED';end if;
  if public.capacity_payload_matches(item,query||'{"load_type":"FTL"}') then raise exception 'FULL_LOAD_FILTER_BYPASSED';end if;
  item:=item||jsonb_build_object('availability_geometry','ROUTE','current_route_points',current_route,
    'capacity_area_boundary','[]'::jsonb,'recurring_corridors',jsonb_build_array(jsonb_build_object('geometry','RADIUS','area_boundary',eastern_area)));
  query:='{"origin_lat":9.35,"origin_lng":42.10,"destination_lat":9.35,"destination_lng":42.80,"origin_radius_km":5,"destination_radius_km":5}';
  if not public.capacity_payload_matches(item,query) then raise exception 'PARTIAL_PREFERRED_AREA_REJECTED';end if;
  if public.capacity_payload_matches(item,'{"origin_lat":9.006,"origin_lng":38.732,"destination_lat":9.35,"destination_lng":42.8,"origin_radius_km":5,"destination_radius_km":5}') then
    raise exception 'SPLIT_CURRENT_PREFERRED_ENDPOINTS_MATCHED';end if;
  if not public.capacity_payload_matches(item,'{"area_lat":9.006,"area_lng":38.732,"area_radius_km":5}')
    then raise exception 'CURRENT_ROUTE_ENDPOINT_AREA_QUERY_MISSING';end if;
  if public.capacity_payload_matches(item,'{"area_lat":9.006,"area_lng":38.732,"area_radius_km":5,"geometry":"RADIUS"}')
    then raise exception 'EXPLICIT_AREA_GEOMETRY_BYPASSED';end if;
  item:=item||jsonb_build_object('availability_geometry','RADIUS','capacity_area_boundary',addis_area,
    'current_route_points','[]'::jsonb,'recurring_corridors',jsonb_build_array(jsonb_build_object('geometry','ROUTE','route_points',current_route)));
  if not public.capacity_payload_matches(item,'{"area_lat":8.517,"area_lng":39.261,"area_radius_km":5}')
    then raise exception 'PREFERRED_ROUTE_ENDPOINT_AREA_QUERY_MISSING';end if;
  if public.capacity_payload_matches(item,'{"area_lat":8.517,"area_lng":39.261,"area_radius_km":5,"geometry":"RADIUS"}')
    then raise exception 'PREFERRED_ROUTE_IGNORED_EXPLICIT_GEOMETRY';end if;
  if not public.capacity_payload_matches(item,'{"area_lat":8.517,"area_lng":39.261,"area_radius_km":5,"geometry":"ROUTE"}')
    then raise exception 'EXPLICIT_ROUTE_GEOMETRY_LOST';end if;
  item:=item||jsonb_build_object('status','EMPTY');
  if not public.capacity_payload_matches(item,'{"area_lat":8.517,"area_lng":39.261,"area_radius_km":5}')
    then raise exception 'EMPTY_PREFERRED_ROUTE_AREA_QUERY_MISSING';end if;
  item:=item||jsonb_build_object('availability_geometry','ROUTE','current_route_points',current_route,
    'capacity_area_boundary','[]'::jsonb,'recurring_corridors','[]'::jsonb);
  if not public.capacity_payload_matches(item,'{"area_lat":9.006,"area_lng":38.732,"area_radius_km":5}')
    then raise exception 'EMPTY_CURRENT_ROUTE_AREA_QUERY_MISSING';end if;
  if public.capacity_payload_matches(item,'{"area_lat":14,"area_lng":47,"area_radius_km":5}')
    then raise exception 'DISTANT_ROUTE_AREA_QUERY_BROADENED';end if;
end $offers$;

do $published$
<<fixture>>
declare
 owner_id uuid:=gen_random_uuid();driver_id uuid:=gen_random_uuid();broker_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();
 organization_id uuid:=gen_random_uuid();vehicle_id uuid;workspace_id uuid;connection_id uuid;grant_id uuid;capacity_id uuid;route_id uuid;
 digest text:=encode(gen_random_bytes(32),'hex');query jsonb;area_places jsonb;route_places jsonb;route_first jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,'offer-owner-'||owner_id||'@example.invalid',now(),'{"fixture_source":"loadgistic"}','{}'),
 (driver_id,'offer-driver-'||driver_id||'@example.invalid',now(),'{"fixture_source":"loadgistic"}','{}'),
 (broker_id,'offer-broker-'||broker_id||'@example.invalid',now(),'{"fixture_source":"loadgistic"}','{}'),
 (foreign_id,'offer-foreign-'||foreign_id||'@example.invalid',now(),'{"fixture_source":"loadgistic"}','{}');
 update profiles set role='TRANSPORTER',active=true,drives_truck=false where id=owner_id;
 update profiles set role='SHIPPER',active=true where id in(broker_id,foreign_id);
 insert into organizations(id,name,handle,type) values(organization_id,'Synthetic offer fleet','offer-'||organization_id,'TRANSPORT_COMPANY');
 insert into organization_members(user_id,organization_id,membership_role) values(owner_id,organization_id,'OWNER');
 insert into company_pages(organization_id,published) values(organization_id,true);
 perform accept_content_policy(owner_id,'2026-10-09');
 perform fleet_register_driver(owner_id,driver_id,jsonb_build_object('name','Synthetic offer driver','email','offer-driver-'||driver_id||'@example.invalid','phone','+251900000001'));
 perform accept_content_policy(driver_id,'2026-10-09');
 vehicle_id:=(create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Synthetic offers","plate":"OFFER-211","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',vehicle_id,'can_manage_capacity',true,'can_manage_tracking',true));
 update driver_vehicle_assignments assignment set assigned_at=now()-interval '3 days'
  where assignment.vehicle_id=fixture.vehicle_id and assignment.driver_user_id=fixture.driver_id and assignment.active;
 perform set_provider_vehicle_publication(owner_id,vehicle_id,'LIVE');
 perform refresh_provider_capacity_location(driver_id,jsonb_build_object('vehicle_id',vehicle_id,'approximate_lat',9.006,'approximate_lng',38.732,'location_precision_km',20));
 workspace_id:=(business_workspace_create(broker_id,jsonb_build_object('name','Synthetic offer broker','handle','offer-broker-'||left(broker_id::text,12),'kind','BROKER'))->>'id')::uuid;
 connection_id:=(request_account_connection(owner_id,'BUSINESS',workspace_id)->>'id')::uuid;
 perform decide_account_connection(broker_id,connection_id,'ACCEPT');
 grant_id:=(grant_account_capacity_access(owner_id,connection_id,vehicle_id)->>'id')::uuid;
 area_places:='[{"place_ref":"builtin:holeta"},{"place_ref":"builtin:sebeta"},{"place_ref":"builtin:bishoftu"},{"place_ref":"builtin:sululta"}]';
 route_places:='[{"place_ref":"builtin:harar"},{"place_ref":"builtin:jigjiga"}]';
 begin
  perform publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'status','PARTIAL','accepted_loads','PTL',
   'availability_geometry','RADIUS','capacity_area_center_place_ref','builtin:addis ababa',
   'location_source','PRESERVE_DRIVER','sharing_mode','BOTH'));
  raise exception 'MALFORMED_PARTIAL_AREA_ACCEPTED';
 exception when others then if sqlerrm<>'CAPACITY_AREA_BOUNDARY_REQUIRED' then raise;end if;end;
 capacity_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'status','PARTIAL','accepted_loads','PTL',
   'availability_geometry','RADIUS','capacity_area_center_place_ref','builtin:addis ababa','capacity_area_boundary_places',area_places,
   'location_source','PRESERVE_DRIVER','sharing_mode','BOTH'));
 if (select availability_geometry from capacities where id=capacity_id) is distinct from 'RADIUS' then raise exception 'PARTIAL_AREA_PUBLICATION_NOT_SAVED';end if;
 route_id:=add_provider_regular_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'expected_driver_id',driver_id,
   'geometry','ROUTE','route_places',route_places));
 query:=jsonb_build_object('capacity_id',capacity_id,'status','PARTIAL','geometry','RADIUS',
   'origin_lat',9.006,'origin_lng',38.732,'destination_lat',8.919,'destination_lng',38.600,
   'origin_radius_km',5,'destination_radius_km',5);
 if (select count(*) from public_capacity_page(query,null,null,14))<>1 then raise exception 'PARTIAL_AREA_PUBLIC_PAGE';end if;
 if (select count(*) from capacity_search_public_rows(query,null,null,14))<>1 then raise exception 'PARTIAL_AREA_PUBLIC_SEARCH';end if;
 if (select count(*) from public_capacity_clusters(query||'{"viewport":[38.4,8.7,39.1,9.3]}'::jsonb))<>1
   then raise exception 'PARTIAL_AREA_CLUSTER';end if;
 if (select count(*) from account_capacity_filtered_page(broker_id,digest,null,null,100,query))<>1 then raise exception 'PARTIAL_AREA_ACCOUNT_PAGE';end if;
 if (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1 then raise exception 'PARTIAL_AREA_BUSINESS_PAGE';end if;
 select route_points_json->0 into route_first from profile_routes where id=route_id;
 if route_first is null then raise exception 'PREFERRED_ROUTE_FIXTURE_NOT_PUBLISHED';end if;
 query:=jsonb_build_object('capacity_id',capacity_id,'status','PARTIAL',
   'area_lat',(route_first->>'lat')::double precision,'area_lng',(route_first->>'lng')::double precision,'area_radius_km',5);
 if (select count(*) from public_capacity_page(query,null,null,14))<>1
   or (select count(*) from capacity_search_public_rows(query,null,null,14))<>1
   or (select coalesce(sum((payload->>'count')::integer),0) from public_capacity_clusters(query||'{"viewport":[38,8,44,11]}'::jsonb))<>1
   or (select count(*) from account_capacity_filtered_page(broker_id,digest,null,null,100,query))<>1
   or (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
 then raise exception 'PREFERRED_ROUTE_AREA_QUERY_AUDIENCE_PARITY';end if;
 query:=jsonb_build_object('capacity_id',capacity_id,'status','PARTIAL','direction_mode','DIRECT',
   'origin_lat',9.350,'origin_lng',42.800,'destination_lat',9.296,'destination_lng',42.115,
   'origin_radius_km',5,'destination_radius_km',5);
 if (select count(*) from public_capacity_page(query,null,null,14))<>1
   or (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
 then raise exception 'PREFERRED_REVERSE_ROUTE_NOT_DISCOVERABLE';end if;
 query:=jsonb_build_object('capacity_id',capacity_id,'origin_lat',9.006,'origin_lng',38.732,
   'destination_lat',9.296,'destination_lng',42.115,'origin_radius_km',5,'destination_radius_km',5);
 if exists(select 1 from public_capacity_page(query,null,null,14))
   or exists(select 1 from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))
 then raise exception 'CURRENT_PREFERRED_ENDPOINTS_SPLIT';end if;
 -- Current and Preferred offers remain one vehicle even when both cover the same place.
 perform replace_provider_regular_capacity(owner_id,route_id,jsonb_build_object('vehicle_id',vehicle_id,'expected_driver_id',driver_id,
   'geometry','RADIUS','area_center_place_ref','builtin:addis ababa','area_boundary_places',area_places));
 query:=jsonb_build_object('capacity_id',capacity_id,'status','PARTIAL','geometry','RADIUS',
   'origin_lat',9.006,'origin_lng',38.732,'destination_lat',8.919,'destination_lng',38.600,
   'origin_radius_km',5,'destination_radius_km',5);
 if (select count(*) from public_capacity_page(query,null,null,14))<>1
   or (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
 then raise exception 'DUPLICATED_MATCHING_VEHICLE';end if;
 capacity_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'status','PARTIAL','accepted_loads','PTL',
   'availability_geometry','ROUTE','current_route_places',route_places,'location_source','PRESERVE_DRIVER','sharing_mode','BOTH'));
 select current_route_points_json->0 into route_first from capacities where id=capacity_id;
 if route_first is null then raise exception 'CURRENT_ROUTE_FIXTURE_NOT_PUBLISHED';end if;
 query:=jsonb_build_object('capacity_id',capacity_id,'status','PARTIAL',
   'area_lat',(route_first->>'lat')::double precision,'area_lng',(route_first->>'lng')::double precision,'area_radius_km',5);
 if (select count(*) from public_capacity_page(query,null,null,14))<>1
   or (select count(*) from capacity_search_public_rows(query,null,null,14))<>1
   or (select coalesce(sum((payload->>'count')::integer),0) from public_capacity_clusters(query||'{"viewport":[38,8,44,11]}'::jsonb))<>1
   or (select count(*) from account_capacity_filtered_page(broker_id,digest,null,null,100,query))<>1
   or (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
 then raise exception 'CURRENT_ROUTE_AREA_QUERY_AUDIENCE_PARITY';end if;
 if exists(select 1 from public_capacity_page(query||'{"geometry":"RADIUS"}'::jsonb,null,null,14))
   or exists(select 1 from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query||'{"geometry":"RADIUS"}'::jsonb))
 then raise exception 'AREA_QUERY_BYPASSED_LEGACY_GEOMETRY';end if;
 update capacities set visibility='PRIVATE' where id=capacity_id;
 if exists(select 1 from public_capacity_page(query,null,null,14))
   or exists(select 1 from capacity_search_public_rows(query,null,null,14))
   or exists(select 1 from public_capacity_clusters(query||'{"viewport":[38,8,44,11]}'::jsonb))
   or (select count(*) from account_capacity_filtered_page(broker_id,digest,null,null,100,query))<>1
   or (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
 then raise exception 'HIDDEN_CURRENT_ROUTE_LEAKED_OR_PRIVATE_ROUTE_LOST';end if;
 update capacities set visibility='OPEN' where id=capacity_id;
 capacity_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'status','EMPTY','accepted_loads','BOTH',
   'availability_geometry','ROUTE','current_route_places',route_places,'location_source','PRESERVE_DRIVER','sharing_mode','BOTH'));
 query:=jsonb_build_object('capacity_id',capacity_id,'status','EMPTY',
   'area_lat',(route_first->>'lat')::double precision,'area_lng',(route_first->>'lng')::double precision,'area_radius_km',5);
 if (select count(*) from public_capacity_page(query,null,null,14))<>1
   or (select count(*) from capacity_search_public_rows(query,null,null,14))<>1
   or (select count(*) from account_capacity_filtered_page(broker_id,digest,null,null,100,query))<>1
   or (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
 then raise exception 'EMPTY_CURRENT_ROUTE_AREA_QUERY_AUDIENCE_PARITY';end if;
 capacity_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'status','PARTIAL','accepted_loads','PTL',
   'availability_geometry','ROUTE','current_route_places',route_places,'location_source','PRESERVE_DRIVER','sharing_mode','BOTH'));
 query:=jsonb_build_object('capacity_id',capacity_id,'status','PARTIAL','geometry','RADIUS',
   'origin_lat',9.006,'origin_lng',38.732,'destination_lat',8.919,'destination_lng',38.600,
   'origin_radius_km',5,'destination_radius_km',5);
 if (select count(*) from public_capacity_page(query,null,null,14))<>1
   or (select count(*) from capacity_search_public_rows(query,null,null,14))<>1
   or (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
 then raise exception 'PARTIAL_PREFERRED_AREA_NOT_DISCOVERABLE';end if;
 if exists(select 1 from public_capacity_page(jsonb_build_object('capacity_id',capacity_id,'geometry','ROUTE',
   'origin_lat',9.350,'origin_lng',42.800,'destination_lat',9.296,'destination_lng',42.115,
   'origin_radius_km',5,'destination_radius_km',5,'direction_mode','DIRECT'),null,null,14))
 then raise exception 'CURRENT_ROUTE_DIRECTION_LOST';end if;
 update capacities set updated_at=now()-interval '4 days',expires_at=now()-interval '3 days'
  where capacities.vehicle_id=fixture.vehicle_id and id<>capacity_id;
 update capacities set updated_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=capacity_id;
 if (select count(*) from public_capacity_page(query,null,null,14))<>1 then raise exception 'OLDER_PUBLIC_SIGNAL_DISAPPEARED';end if;
 if (select count(*) from account_capacity_filtered_page(broker_id,digest,null,null,100,query))<>1
   then raise exception 'OLDER_ACCOUNT_SIGNAL_DISAPPEARED';end if;
 if (select count(*) from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))<>1
   then raise exception 'OLDER_BUSINESS_SIGNAL_DISAPPEARED';end if;
 begin
  perform business_capacity_filtered_page(foreign_id,workspace_id,null,null,100,query);
  raise exception 'FOREIGN_WORKSPACE_CAPACITY_LEAK';
 exception when others then if sqlerrm<>'BUSINESS_FORBIDDEN' then raise;end if;end;
 perform revoke_account_capacity_access(owner_id,grant_id,1);
 if exists(select 1 from account_capacity_filtered_page(broker_id,digest,null,null,100,query))
   or exists(select 1 from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,query))
   or (select count(*) from public_capacity_page(query,null,null,14))<>1
 then raise exception 'REVOKED_PRIVATE_GRANT_CHANGED_PUBLIC_OR_RETAINED_PRIVATE';end if;
 capacity_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',vehicle_id,'status','OFF_DUTY','sharing_mode','BOTH'));
 if exists(select 1 from public_capacity_page('{}',null,null,14) where payload->>'vehicle_id'=vehicle_id::text)
   or exists(select 1 from business_capacity_filtered_page(broker_id,workspace_id,null,null,100,'{}') where payload->>'vehicle_id'=vehicle_id::text)
 then raise exception 'OFF_DUTY_OFFER_RETAINED';end if;
end $published$;
rollback;
