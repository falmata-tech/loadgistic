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
declare owner_id uuid:=gen_random_uuid();driver_id uuid:=gen_random_uuid();broker_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();org_id uuid:=gen_random_uuid();truck_id uuid;broker_workspace uuid;foreign_workspace uuid;connection_id uuid;saved_id uuid;data jsonb;route_points jsonb;command jsonb;
 digest text:=encode(gen_random_bytes(32),'hex');marker text:='launch'||replace(gen_random_uuid()::text,'-','');query jsonb;base_query jsonb;negative jsonb;
 status_value text;load_choice text;expected boolean;property text;checked integer:=0;field jsonb;reviewer uuid;doc_query jsonb;doc_kind text;source_subject uuid;submitter uuid;source_id uuid;before_capacity jsonb;
begin
 -- Own the whole workspace: never move a seeded employee's active shipment or
 -- manufacture document decisions for an existing provider.
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 (owner_id,'launch-owner-'||owner_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}'),
 (driver_id,'launch-driver-'||driver_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}'),
 (broker_id,'launch-broker-'||broker_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}'),
 (foreign_id,'launch-foreign-'||foreign_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}');
 update profiles set role='TRANSPORTER',active=true,drives_truck=false,full_name='Synthetic launch owner' where id=owner_id;
 update profiles set role='SHIPPER',active=true where id in(broker_id,foreign_id);
 insert into organizations(id,name,handle,type) values(org_id,'Synthetic launch provider','launch-'||org_id,'TRANSPORT_COMPANY');
 insert into organization_members(user_id,organization_id,membership_role) values(owner_id,org_id,'OWNER');
 insert into company_pages(organization_id,published,about) values(org_id,true,marker);
 perform accept_content_policy(owner_id,'2026-10-09');
 perform fleet_register_driver(owner_id,driver_id,jsonb_build_object('name','Synthetic launch driver','email','launch-driver-'||driver_id||'@loadgistic.local','phone','+251900000001'));
 perform accept_content_policy(driver_id,'2026-10-09');
 data:=create_provider_vehicle(owner_id,'{"make":"Launch matching audit","model":"Test","plate":"AUDIT-LAUNCH-MATCHING","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}');truck_id:=(data->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(owner_id,truck_id,'LIVE');
 perform refresh_provider_capacity_location(driver_id,jsonb_build_object('vehicle_id',truck_id,'approximate_lat',41.8781,'approximate_lng',-87.6298,'location_precision_km',20));
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 broker_workspace:=(business_workspace_create(broker_id,jsonb_build_object('name','Launch broker','handle','launch-broker-'||substr(broker_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 foreign_workspace:=(business_workspace_create(foreign_id,jsonb_build_object('name','Foreign broker','handle','launch-foreign-'||substr(foreign_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 connection_id:=(request_account_connection(owner_id,'BUSINESS',broker_workspace)->>'id')::uuid;
 perform decide_account_connection(broker_id,connection_id,'ACCEPT');
 perform grant_account_capacity_access(owner_id,connection_id,truck_id);
 command:=jsonb_build_object('vehicle_id',truck_id,'availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','sharing_mode','BOTH','current_route_places',route_points,'accepts_multi_pick',true,'accepts_multi_drop',false);
 foreach status_value in array array['EMPTY','PARTIAL'] loop
 foreach load_choice in array array['FTL','PTL','BOTH'] loop
  saved_id:=publish_provider_capacity(owner_id,command||jsonb_build_object('status',status_value,'accepted_loads',load_choice));
  if(select id from capacities where vehicle_id=truck_id order by updated_at desc,id desc limit 1) is distinct from saved_id then raise exception 'LATEST_MATCHING_REPORT_LOST';end if;
  base_query:=jsonb_build_object('capacity_id',saved_id,'q',marker,'status',status_value,'vehicle_category','Mini Box Truck','stop_option','MULTI_PICK','freshness','FRESH',
   'origin_lat',route_points->0->'lat','origin_lng',route_points->0->'lng','destination_lat',route_points->(jsonb_array_length(route_points)-1)->'lat','destination_lng',route_points->(jsonb_array_length(route_points)-1)->'lng',
   'origin_radius_km',5,'destination_radius_km',5,'direction_mode','DIRECT','geometry','ROUTE','near_lat',41.8781,'near_lng',-87.6298,'near_radius_km',5);
  foreach property in array array['FTL','PTL'] loop
   query:=base_query||jsonb_build_object('load_type',property);
   expected:=case when status_value='PARTIAL' then property='PTL' else load_choice='BOTH' or load_choice=property end;
   if exists(select 1 from public_capacity_page(query,null,null,14))<>expected then raise exception 'PUBLIC_COMBINED_MATRIX % % %',status_value,load_choice,property;end if;
   if exists(select 1 from account_capacity_filtered_page(broker_id,digest,null,null,100,query) r where r.payload->>'id'=saved_id::text)<>expected then raise exception 'PRIVATE_COMBINED_MATRIX % % %',status_value,load_choice,property;end if;
   if exists(select 1 from capacity_search_public_rows(query,null,null,14))<>expected then raise exception 'PUBLIC_SEARCH_COMBINED_MATRIX';end if;
   if ((account_capacity_search_results(broker_id,digest,query)->>'total')::int>0)<>expected then raise exception 'PRIVATE_SEARCH_COMBINED_MATRIX';end if;
   if ((capacity_search_results(query)->>'total')::int>0)<>expected then raise exception 'PROFILE_MAP_DISAGREEMENT';end if;
   checked:=checked+5;
  end loop;
  -- Each otherwise matching hard criterion must independently reject the same row.
  for negative in select value from jsonb_array_elements(jsonb_build_array(
   jsonb_build_object('status',case when status_value='EMPTY' then 'PARTIAL' else 'EMPTY' end),'{"vehicle_category":"Pickup truck"}'::jsonb,
   '{"stop_option":"MULTI_DROP"}'::jsonb,'{"freshness":"UPDATE_NEEDED"}'::jsonb,'{"geometry":"RADIUS"}'::jsonb,
   '{"q":"zzzznotapublishedprofile"}'::jsonb,'{"near_lat":0,"near_lng":0}'::jsonb,
   '{"origin_lat":0,"origin_lng":0}'::jsonb,'{"destination_lat":0,"destination_lng":0}'::jsonb,
   '{"owner_docs":"VEHICLE_OWNERSHIP"}'::jsonb,'{"driver_docs":"BUSINESS_LICENSE"}'::jsonb,'{"truck_docs":"DRIVER_IDENTITY"}'::jsonb)) loop
   query:=base_query||negative;
   if exists(select 1 from public_capacity_page(query,null,null,14)) or exists(select 1 from account_capacity_filtered_page(broker_id,digest,null,null,100,query) r where r.payload->>'id'=saved_id::text)
   or (capacity_search_results(query)->>'total')::int<>0 then raise exception 'FAILED_HARD_FILTER_RESCUED: %',negative;end if;
   checked:=checked+3;
  end loop;
 end loop;end loop;
 -- An unsupported spelling is an invalid request, not a valid empty result.
 -- The valid, different configuration above still proves hard-filter rejection.
 select to_jsonb(c) into strict before_capacity from capacities c where c.id=saved_id;
 query:=base_query||'{"vehicle_category":"Pickup Truck"}'::jsonb;
 begin perform public_capacity_page(query,null,null,14);raise exception 'INVALID_PUBLIC_FILTER_RETURNED_ROWS';
  exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 begin perform account_capacity_filtered_page(broker_id,digest,null,null,100,query);raise exception 'INVALID_PRIVATE_FILTER_RETURNED_ROWS';
  exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 begin perform capacity_search_public_rows(query,null,null,14);raise exception 'INVALID_SEARCH_FILTER_RETURNED_ROWS';
  exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 begin perform capacity_search_results(query);raise exception 'INVALID_PROFILE_FILTER_RETURNED_ROWS';
  exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 if(select to_jsonb(c) from capacities c where c.id=saved_id) is distinct from before_capacity
  or(select id from capacities where vehicle_id=truck_id order by updated_at desc,id desc limit 1) is distinct from saved_id
 then raise exception 'INVALID_FILTER_MUTATED_CAPACITY';end if;
 checked:=checked+5;
 -- Real UI document choices are ANDed within/across their rightful entities.
 select id into strict reviewer from profiles where role='ADMIN' and active limit 1;
 for doc_kind,source_subject,property,submitter in select * from(values
 ('ORGANIZATION',org_id,'IDENTITY',owner_id),('ORGANIZATION',org_id,'BUSINESS_LICENSE',owner_id),
 ('DRIVER',driver_id,'IDENTITY',driver_id),('DRIVER',driver_id,'DRIVER_IDENTITY',driver_id),
 ('VEHICLE',truck_id,'VEHICLE_OWNERSHIP',owner_id),('VEHICLE',truck_id,'VEHICLE_AUTHORIZATION',owner_id)) documents(subject_type,subject_id,verification_type,actor_id) loop
  source_id:=submit_managed_verification(submitter,jsonb_build_object('subject_type',doc_kind,'subject_id',source_subject,'verification_type',property,
   'document_name','Synthetic matching '||property,'storage_path','supabase://verification/verification/launch-'||source_subject||'-'||property||'.pdf',
   'original_name','synthetic.pdf','mime_type','application/pdf','expires_on',(now() at time zone 'Africa/Addis_Ababa')::date+1));
  perform review_managed_verification(reviewer,source_id,'APPROVED','Synthetic matching document checked.');
  if doc_kind='VEHICLE' then
   perform confirm_provider_vehicle_authority(reviewer,source_id,jsonb_build_object('fact_kind',case property when 'VEHICLE_OWNERSHIP' then 'OWNERSHIP' else 'PERMISSION' end,
    'review_note','Synthetic exact provider and truck checked.','expires_on',(now() at time zone 'Africa/Addis_Ababa')::date+1,
    'context_revision',managed_provider_authority_review_context(reviewer,array[source_id])->0->>'contextRevision'));
  end if;
 end loop;
 doc_query:=base_query||jsonb_build_object('owner_docs','IDENTITY,BUSINESS_LICENSE','driver_docs','IDENTITY,DRIVER_IDENTITY','truck_docs','VEHICLE_OWNERSHIP,VEHICLE_AUTHORIZATION');
 for doc_kind in select value from jsonb_array_elements_text('["ALL","ORGANIZATION","DRIVER","VEHICLE"]') loop
  expected:=doc_kind='ALL';
  if not expected then
   update verification_requests set expires_on=(now() at time zone 'Africa/Addis_Ababa')::date-1
    where (subject_type::text=doc_kind) and subject_id in (org_id,driver_id,truck_id)
    and verification_type in ('BUSINESS_LICENSE','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION');
  end if;
  if exists(select 1 from public_capacity_page(doc_query,null,null,14))<>expected
   or exists(select 1 from account_capacity_filtered_page(broker_id,digest,null,null,100,doc_query) r where r.payload->>'id'=saved_id::text)<>expected
   or exists(select 1 from capacity_search_public_rows(doc_query,null,null,14))<>expected
   or ((capacity_search_results(doc_query)->>'total')::int>0)<>expected then raise exception 'DOCUMENT_COMBINED_ENTITY_EXPIRY: %',doc_kind;end if;
  checked:=checked+4;
  update verification_requests set expires_on=(now() at time zone 'Africa/Addis_Ababa')::date+1 where subject_id in (org_id,driver_id,truck_id);
 end loop;
 if exists(select 1 from account_capacity_filtered_page(foreign_id,digest,null,null,100,base_query)) then raise exception 'FILTERS_BYPASSED_PRIVATE_SCOPE';end if;
 raise notice 'PASS: % persisted public/private/map/profile combined-filter checks plus unknown-recipient denial',checked;
end $matrix$;
rollback;
