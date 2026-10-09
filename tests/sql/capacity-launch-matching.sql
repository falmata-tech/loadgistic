begin;
do $geometry$
declare a jsonb:='{"lat":9,"lng":38}';b jsonb:='{"lat":10,"lng":39}';c jsonb:='{"lat":10,"lng":38}';points jsonb;bad jsonb;
begin
 points:=jsonb_build_array(a,b,c,a);
 if not capacity_route_matches(points,10,38,9,38,5,5,'DIRECT') then raise exception 'RETURNING_ROUTE_OCCURRENCE_MISSED';end if;
 if capacity_route_matches(jsonb_build_array(a,b),10,39,9,38,5,5,'DIRECT') then raise exception 'SIMPLE_REVERSE_MATCHED';end if;
 if not capacity_route_matches(jsonb_build_array(a,b),10,39,9,38,5,5,'EITHER') then raise exception 'EITHER_DIRECTION_MISSED';end if;
 foreach bad in array array['{"lat":null,"lng":38.5}'::jsonb,'{"lng":38.5}'::jsonb,'{"lat":91,"lng":38.5}'::jsonb] loop
  if capacity_route_line(jsonb_build_array(a,bad,b)) is not null then raise exception 'MALFORMED_ROUTE_CONNECTED';end if;
 end loop;
 if capacity_route_line(jsonb_build_array(a,a)) is not null then raise exception 'DEGENERATE_ROUTE_ACCEPTED';end if;
 if not capacity_route_matches('[{"lat":0,"lng":0},{"lat":0,"lng":1}]',0,0,0,1,5,5,'DIRECT') then raise exception 'LEGITIMATE_ZERO_ROUTE_REJECTED';end if;
 if capacity_area_polygon('[{"lat":9,"lng":38},{"lat":9.2,"lng":38.2},{"lat":9.2,"lng":38},{"lat":9,"lng":38.2}]') is not null then raise exception 'SELF_INTERSECTING_AREA_ACCEPTED';end if;
 if capacity_area_polygon('[{"lat":9,"lng":38},{"lat":9,"lng":38.1},{"lat":9,"lng":38.2}]') is not null then raise exception 'ZERO_AREA_ACCEPTED';end if;
 if not capacity_area_matches('[{"lat":9,"lng":38},{"lat":9.2,"lng":38},{"lat":9.2,"lng":38.2},{"lat":9,"lng":38.2}]',9.1,38.1,5) then raise exception 'VALID_AREA_INTERIOR_MISSED';end if;
 raise notice 'PASS: connected returning route, strict complete geometry, simple polygons and zero coordinates';
end $geometry$;
do $matrix$
<<fixture>>
declare owner_id uuid;driver_id uuid;org_id uuid;truck_id uuid;saved_id uuid;data jsonb;route_points jsonb;command jsonb;
 digest text:=encode(gen_random_bytes(32),'hex');marker text:='launch'||replace(gen_random_uuid()::text,'-','');query jsonb;base_query jsonb;negative jsonb;
 status_value text;load_choice text;expected boolean;property text;checked integer:=0;field jsonb;reviewer uuid;doc_query jsonb;doc_kind text;
begin
 select m.user_id,m.organization_id,d.user_id into strict owner_id,org_id,driver_id
 from organization_members m join drivers d on d.organization_id=m.organization_id and d.active
 join profiles p on p.id=d.user_id and p.active join lateral provider_capacity_actor_scope(m.user_id) a on a.workspace_access
 where m.membership_role='OWNER' limit 1;
 data:=create_provider_vehicle(owner_id,'{"make":"Launch matching audit","model":"Test","plate":"AUDIT-LAUNCH-MATCHING","cargo_configuration":"Mini Box Truck"}');truck_id:=(data->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform refresh_provider_capacity_location(driver_id,jsonb_build_object('vehicle_id',truck_id,'approximate_lat',41.8781,'approximate_lng',-87.6298,'location_precision_km',20));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 update company_pages set published=true,about=marker where organization_id=org_id;
 delete from profile_routes where organization_id=org_id;
 perform grant_private_capacity_access(owner_id,truck_id,'launch-matching@example.invalid',digest);
 command:=jsonb_build_object('vehicle_id',truck_id,'availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','sharing_mode','BOTH','current_route_places',route_points,'accepts_multi_pick',true,'accepts_multi_drop',false);
 foreach status_value in array array['EMPTY','PARTIAL'] loop
 foreach load_choice in array array['FTL','PTL','BOTH'] loop
  saved_id:=publish_provider_capacity(owner_id,command||jsonb_build_object('status',status_value,'accepted_loads',load_choice));
  update capacities set updated_at=clock_timestamp() where id=saved_id;
  base_query:=jsonb_build_object('capacity_id',saved_id,'q',marker,'status',status_value,'vehicle_category','Mini Box Truck','stop_option','MULTI_PICK','freshness','FRESH',
   'origin_lat',route_points->0->'lat','origin_lng',route_points->0->'lng','destination_lat',route_points->(jsonb_array_length(route_points)-1)->'lat','destination_lng',route_points->(jsonb_array_length(route_points)-1)->'lng',
   'origin_radius_km',5,'destination_radius_km',5,'direction_mode','DIRECT','geometry','ROUTE','near_lat',41.8781,'near_lng',-87.6298,'near_radius_km',5);
  foreach property in array array['FTL','PTL'] loop
   query:=base_query||jsonb_build_object('load_type',property);
   expected:=case when status_value='PARTIAL' then property='PTL' else load_choice='BOTH' or load_choice=property end;
   if exists(select 1 from public_capacity_page(query,null,null,14))<>expected then raise exception 'PUBLIC_COMBINED_MATRIX % % %',status_value,load_choice,property;end if;
   if exists(select 1 from private_capacity_filtered_page('EMAIL',digest,null,null,null,100,query) r where r.payload->>'id'=saved_id::text)<>expected then raise exception 'PRIVATE_COMBINED_MATRIX % % %',status_value,load_choice,property;end if;
   if exists(select 1 from capacity_search_public_rows(query,null,null,14))<>expected then raise exception 'PUBLIC_SEARCH_COMBINED_MATRIX';end if;
   if exists(select 1 from capacity_search_private_rows('EMAIL',digest,null,null,null,100,query) r where r.payload->>'id'=saved_id::text)<>expected then raise exception 'PRIVATE_SEARCH_COMBINED_MATRIX';end if;
   if ((capacity_search_results(query)->>'total')::int>0)<>expected then raise exception 'PROFILE_MAP_DISAGREEMENT';end if;
   checked:=checked+5;
  end loop;
  -- Each otherwise matching hard criterion must independently reject the same row.
  for negative in select value from jsonb_array_elements(jsonb_build_array(
   jsonb_build_object('status',case when status_value='EMPTY' then 'PARTIAL' else 'EMPTY' end),'{"vehicle_category":"Pickup Truck"}'::jsonb,
   '{"stop_option":"MULTI_DROP"}'::jsonb,'{"freshness":"UPDATE_NEEDED"}'::jsonb,'{"geometry":"RADIUS"}'::jsonb,
   '{"q":"zzzznotapublishedprofile"}'::jsonb,'{"near_lat":0,"near_lng":0}'::jsonb,
   '{"origin_lat":0,"origin_lng":0}'::jsonb,'{"destination_lat":0,"destination_lng":0}'::jsonb,
   '{"owner_docs":"VEHICLE_OWNERSHIP"}'::jsonb,'{"driver_docs":"BUSINESS_LICENSE"}'::jsonb,'{"truck_docs":"DRIVER_IDENTITY"}'::jsonb)) loop
   query:=base_query||negative;
   if exists(select 1 from public_capacity_page(query,null,null,14)) or exists(select 1 from private_capacity_filtered_page('EMAIL',digest,null,null,null,100,query) r where r.payload->>'id'=saved_id::text)
   or (capacity_search_results(query)->>'total')::int<>0 then raise exception 'FAILED_HARD_FILTER_RESCUED: %',negative;end if;
   checked:=checked+3;
  end loop;
 end loop;end loop;
 -- Real UI document choices are ANDed within/across their rightful entities.
 select id into strict reviewer from profiles where role='ADMIN' and active limit 1;
 delete from verification_requests where (subject_type='ORGANIZATION' and subject_id=org_id) or (subject_type='DRIVER' and subject_id=driver_id) or (subject_type='VEHICLE' and subject_id=truck_id);
 insert into verification_requests(subject_type,subject_id,verification_type,document_name,storage_path,original_name,mime_type,status,submitted_by,reviewed_by,reviewed_at,expires_on)
 values ('ORGANIZATION',org_id,'IDENTITY','Local reviewed fixture','local/audit-only','audit.png','image/png','APPROVED',owner_id,reviewer,now(),current_date+1),
 ('ORGANIZATION',org_id,'BUSINESS_LICENSE','Local reviewed fixture','local/audit-only','audit.png','image/png','APPROVED',owner_id,reviewer,now(),current_date+1),
 ('DRIVER',driver_id,'IDENTITY','Local reviewed fixture','local/audit-only','audit.png','image/png','APPROVED',driver_id,reviewer,now(),current_date+1),
 ('DRIVER',driver_id,'DRIVER_IDENTITY','Local reviewed fixture','local/audit-only','audit.png','image/png','APPROVED',driver_id,reviewer,now(),current_date+1),
 ('VEHICLE',truck_id,'VEHICLE_OWNERSHIP','Local reviewed fixture','local/audit-only','audit.png','image/png','APPROVED',owner_id,reviewer,now(),current_date+1),
 ('VEHICLE',truck_id,'VEHICLE_AUTHORIZATION','Local reviewed fixture','local/audit-only','audit.png','image/png','APPROVED',owner_id,reviewer,now(),current_date+1);
 doc_query:=base_query||jsonb_build_object('owner_docs','IDENTITY,BUSINESS_LICENSE','driver_docs','IDENTITY,DRIVER_IDENTITY','truck_docs','VEHICLE_OWNERSHIP,VEHICLE_AUTHORIZATION');
 for doc_kind in select value from jsonb_array_elements_text('["ALL","ORGANIZATION","DRIVER","VEHICLE"]') loop
  expected:=doc_kind='ALL';
  if not expected then
   update verification_requests set expires_on=(now() at time zone 'Africa/Addis_Ababa')::date-1
    where (subject_type::text=doc_kind) and subject_id in (org_id,driver_id,truck_id)
    and verification_type in ('BUSINESS_LICENSE','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION');
  end if;
  if exists(select 1 from public_capacity_page(doc_query,null,null,14))<>expected
   or exists(select 1 from private_capacity_filtered_page('EMAIL',digest,null,null,null,100,doc_query) r where r.payload->>'id'=saved_id::text)<>expected
   or exists(select 1 from capacity_search_public_rows(doc_query,null,null,14))<>expected
   or ((capacity_search_results(doc_query)->>'total')::int>0)<>expected then raise exception 'DOCUMENT_COMBINED_ENTITY_EXPIRY: %',doc_kind;end if;
  checked:=checked+4;
  update verification_requests set expires_on=(now() at time zone 'Africa/Addis_Ababa')::date+1 where subject_id in (org_id,driver_id,truck_id);
 end loop;
 if exists(select 1 from private_capacity_filtered_page('EMAIL',repeat('f',64),null,null,null,100,base_query)) then raise exception 'FILTERS_BYPASSED_PRIVATE_SCOPE';end if;
 raise notice 'PASS: % persisted public/private/map/profile combined-filter checks plus unknown-recipient denial',checked;
end $matrix$;
rollback;
