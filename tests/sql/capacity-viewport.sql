-- Local database only; matching, paging and audience tests roll back completely.
begin;
do $test$
declare item jsonb; route jsonb:='[{"lat":9,"lng":38,"label":"A"},{"lat":10,"lng":39,"label":"B"}]';
 area jsonb:='[{"lat":8,"lng":37,"label":"A"},{"lat":8,"lng":40,"label":"B"},{"lat":11,"lng":40,"label":"C"},{"lat":11,"lng":37,"label":"D"}]';
 actor uuid; provider uuid; source public.capacities%rowtype; truck public.vehicles%rowtype;
 recipient text:=repeat('c',64); chosen uuid; count_rows integer; result jsonb; n integer; before_count bigint; after_count bigint; vehicle_columns text; capacity_columns text;
begin
 item:=jsonb_build_object('id',gen_random_uuid(),'status','EMPTY','provider_handle','audit','cargo_configuration','Pickup truck',
 'availability_geometry','ROUTE','current_route_points',route,'capacity_area_boundary','[]'::jsonb,'recurring_corridors',jsonb_build_array(jsonb_build_object('geometry','RADIUS','area_boundary',area)),
 'updated_at',now(),'location_lat',9,'location_lng',38,'location_precision_km',20);
 if not capacity_payload_matches(item,'{"origin_lat":9,"origin_lng":38,"destination_lat":10,"destination_lng":39,"area_lat":9,"area_lng":39,"viewport":[37,8,40,11]}'::jsonb) then raise exception 'COMBINED_MATCH_LOST';end if;
 if capacity_payload_matches(item,'{"origin_lat":9,"origin_lng":38,"destination_lat":14,"destination_lng":47,"origin_radius_km":5,"destination_radius_km":5}'::jsonb) then raise exception 'FAILED_ENDPOINT_BROADENED';end if;
 if capacity_payload_matches(item,'{"origin_lat":9,"origin_lng":38,"area_lat":14,"area_lng":47}'::jsonb) then raise exception 'FAILED_AREA_BROADENED';end if;
 if capacity_payload_matches(item,'{"geometry":"ROUTE","area_lat":9,"area_lng":39}'::jsonb) then raise exception 'GEOMETRY_FILTER_BYPASSED';end if;
 if capacity_payload_matches(item,'{"viewport":[45,13,47,15]}'::jsonb) then raise exception 'DISTANT_VIEWPORT_MATCHED';end if;
 if not capacity_payload_matches(item,'{"destination_lat":9.5,"destination_lng":38.5,"destination_radius_km":5,"geometry":"ROUTE"}'::jsonb) then raise exception 'ROUTE_SEGMENT_LOST';end if;
 if capacity_payload_matches(item,'{"q":"missing-place"}'::jsonb) then raise exception 'TEXT_FILTER_BYPASSED';end if;
 -- Insert 1,001 authorized newer records and a uniquely matching older record.
 select id into strict actor from profiles where email='driver@loadgistic.local';
 select id into strict provider from provider_profiles where user_id=actor;
 -- The managed verifier can leave the source truck Partial or Off Duty. Its
 -- current status is irrelevant: every synthetic copy below is explicitly Empty.
 select * into strict source from capacities where provider_profile_id=provider order by updated_at desc limit 1;
 select * into strict truck from vehicles where id=source.vehicle_id;
 select string_agg(quote_ident(attname),',' order by attnum) into vehicle_columns from pg_attribute where attrelid='public.vehicles'::regclass and attnum>0 and not attisdropped and attgenerated='';
 select string_agg(quote_ident(attname),',' order by attnum) into capacity_columns from pg_attribute where attrelid='public.capacities'::regclass and attnum>0 and not attisdropped and attgenerated='';
 for n in 1..1002 loop
  truck.id:=gen_random_uuid();truck.platform_number:='SQL-SPATIAL-'||n;truck.plate:='SQL-SPATIAL-'||n;truck.active:=true;
  execute format('insert into vehicles(%s) select %s from jsonb_populate_record(null::public.vehicles,$1)',vehicle_columns,vehicle_columns) using to_jsonb(truck);
  source.id:=gen_random_uuid();source.vehicle_id:=truck.id;source.updated_at:=now()-make_interval(secs=>n);
  source.expires_at:=now()+interval '1 day';source.visibility:='PRIVATE';source.market_status:='EMPTY';source.status:='EMPTY';source.available_percent:=100;
  source.availability_geometry:='RADIUS';source.work_radius_km:=10;
  source.current_route_points_json:='[]'::jsonb;source.capacity_area_boundary_json:='[]'::jsonb;
  source.location_lat:=case when n=1002 then 14 else 9 end;source.location_lng:=case when n=1002 then 47 else 38 end;
  execute format('insert into capacities(%s) select %s from jsonb_populate_record(null::public.capacities,$1)',capacity_columns,capacity_columns) using to_jsonb(source);
  insert into capacity_access_grants(vehicle_id,audience_type,recipient_email_digest,recipient_email,created_by)
   values(truck.id,'EMAIL',recipient,'spatial@example.test',actor);
  if n=1002 then chosen:=source.id;end if;
 end loop;
 select count(*),min(payload->>'id')::uuid into count_rows,chosen from private_capacity_filtered_page('EMAIL',recipient,null,null,null,14,'{"near_lat":14,"near_lng":47,"near_radius_km":5}'::jsonb);
 if count_rows<>1 or chosen is distinct from source.id then raise exception 'MATCH_AFTER_1000_NOT_REACHABLE';end if;
 select count(*) into count_rows from private_capacity_filtered_page('EMAIL',repeat('d',64),null,null,null,14,'{}');
 if count_rows<>0 then raise exception 'WRONG_RECIPIENT_VISIBLE';end if;
 select count(*) into count_rows from private_capacity_filtered_page('LOADGISTIC',recipient,actor,null,null,14,'{}');
 if count_rows<>0 then raise exception 'NON_OPERATIONS_VISIBLE';end if;
 select coalesce(sum((payload->>'count')::bigint),0) into before_count from public_capacity_clusters('{"viewport":[45,13,49,15]}'::jsonb);
 update capacities set visibility='OPEN' where id=source.id;
 select coalesce(sum((payload->>'count')::bigint),0),count(*) into after_count,count_rows from public_capacity_clusters('{"viewport":[45,13,49,15]}'::jsonb);
 if after_count<>before_count+1 or count_rows>200 then raise exception 'PUBLIC_AGGREGATE_COUNT_OR_BOUND';end if;
 select payload into result from public_capacity_clusters(jsonb_build_object('viewport',jsonb_build_array(45,13,49,15),'capacity_id',source.id));
 if result->>'id' is distinct from (select payload->>'id' from public_capacity_clusters(jsonb_build_object('viewport',jsonb_build_array(45.25,13,49.25,15),'capacity_id',source.id))) then raise exception 'UNSTABLE_OVERVIEW_CELL';end if;
 if exists(select 1 from public_capacity_clusters('{"viewport":[45,13,49,15]}'::jsonb) where payload ?| array['vehicle_id','contact_phone','assigned_driver_phone','email','messages','recurring_corridors']) then raise exception 'OVERVIEW_DETAIL_LEAK';end if;
 if has_function_privilege('authenticated','public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)','execute') then raise exception 'BROWSER_SPATIAL_RPC';end if;
 raise notice 'Conjunctive spatial filters, bounded page after 1000 candidates and audience denial passed';
end $test$;
rollback;
