-- Local database only; matching, paging and audience tests roll back completely.
begin;
do $test$
declare item jsonb; route jsonb:='[{"lat":9,"lng":38,"label":"A"},{"lat":10,"lng":39,"label":"B"}]';
 area jsonb:='[{"lat":8,"lng":37,"label":"A"},{"lat":8,"lng":40,"label":"B"},{"lat":11,"lng":40,"label":"C"},{"lat":11,"lng":37,"label":"D"}]';
 actor uuid; provider uuid; source public.capacities%rowtype;
 synthetic_actor uuid;synthetic_provider uuid;synthetic_truck uuid;actors uuid[]:='{}';providers uuid[]:='{}';trucks uuid[]:='{}';
 broker_actor uuid:=gen_random_uuid();broker_workspace uuid;chosen uuid; count_rows integer; result jsonb; n integer; before_count bigint; after_count bigint; capacity_columns text;
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
 select p.id,owner.id into strict actor,provider from profiles p join provider_profiles owner on owner.user_id=p.id
 join company_pages page on page.provider_profile_id=owner.id and page.published
 where p.role='DRIVER' and p.active and exists(select 1 from capacities c where c.provider_profile_id=owner.id) limit 1;
 -- The managed verifier can leave the source truck Partial or Off Duty. Its
 -- current status is irrelevant: every synthetic copy below is explicitly Empty.
 select * into strict source from capacities where provider_profile_id=provider order by updated_at desc limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(broker_actor,'viewport-broker-'||broker_actor||'@example.invalid',now(),'{}');
 update public.profiles set role='SHIPPER',active=true where id=broker_actor;
 broker_workspace:=(public.business_workspace_create(broker_actor,jsonb_build_object('name','Viewport broker','handle','viewport-broker-'||left(broker_actor::text,12),'kind','BROKER'))->>'id')::uuid;
 select string_agg(quote_ident(attname),',' order by attnum) into capacity_columns from pg_attribute where attrelid='public.capacities'::regclass and attnum>0 and not attisdropped and attgenerated='';
 for n in 1..1002 loop
  -- Each synthetic provider uses its one document-free Live slot and explicitly
  -- drives its own truck. Complete every assignment before inserting test data.
  synthetic_actor:=gen_random_uuid();synthetic_provider:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
   values(synthetic_actor,synthetic_actor||'@example.invalid',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}');
  update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic viewport driver' where id=synthetic_actor;
  insert into provider_profiles(id,user_id,business_name,handle)
   values(synthetic_provider,synthetic_actor,'Spatial SQL fixture','spatial-'||synthetic_provider);
  insert into company_pages(provider_profile_id,published,about) values(synthetic_provider,true,'Synthetic spatial fixture');
  perform accept_content_policy(synthetic_actor,'2026-10-09');
  synthetic_truck:=(create_provider_vehicle(synthetic_actor,jsonb_build_object('make','Isuzu','model','Viewport fixture','plate','SQL-SPATIAL-'||n,'cargo_configuration','Mini Box Truck','use_basis','OWNED'))->>'id')::uuid;
  perform update_fleet_driver_access(synthetic_actor,jsonb_build_object('driver_user_id',synthetic_actor,'vehicle_id',synthetic_truck,'can_manage_capacity',true,'can_manage_tracking',true));
  perform set_provider_vehicle_publication(synthetic_actor,synthetic_truck,'LIVE');
  perform refresh_provider_capacity_location(synthetic_actor,jsonb_build_object('vehicle_id',synthetic_truck,'approximate_lat',case when n=1002 then 14 else 9 end,'approximate_lng',case when n=1002 then 47 else 38 end,'location_precision_km',20));
  insert into public.business_capacity_grants(vehicle_id,workspace_id,created_by)
  values(synthetic_truck,broker_workspace,synthetic_actor);
  perform set_provider_capacity_sharing(synthetic_actor,synthetic_truck,'PRIVATE');
  actors[n]:=synthetic_actor;providers[n]:=synthetic_provider;trucks[n]:=synthetic_truck;
 end loop;
 -- Insert the uniquely matching row first, then 1,001 newer authorized rows.
 -- Actual write times follow all assignment resets; no future/backdated clock
 -- adjustment can hide a real ordering defect.
 for n in reverse 1002..1 loop
  source.id:=gen_random_uuid();source.vehicle_id:=trucks[n];source.updated_at:=clock_timestamp();
  source.provider_organization_id:=null;source.provider_profile_id:=providers[n];source.updated_by:=actors[n];
  source.expires_at:=clock_timestamp()+interval '1 day';source.visibility:='PRIVATE';source.market_status:='EMPTY';source.status:='EMPTY';source.available_percent:=100;
  source.availability_geometry:='RADIUS';source.work_radius_km:=10;
  source.current_route_points_json:='[]'::jsonb;source.capacity_area_boundary_json:='[]'::jsonb;
  source.location_lat:=case when n=1002 then 14 else 9 end;source.location_lng:=case when n=1002 then 47 else 38 end;
  source.location_updated_at:=source.updated_at;source.location_precision_km:=20;source.location_source:='DEVICE_OBSCURED';
  if source.updated_at<=provider_capacity_pair_started_at(source.vehicle_id) then raise exception 'FIXTURE_CAPACITY_PRECEDES_ASSIGNMENT';end if;
  execute format('insert into capacities(%s) select %s from jsonb_populate_record(null::public.capacities,$1)',capacity_columns,capacity_columns) using to_jsonb(source);
  if n=1002 then chosen:=source.id;end if;
 end loop;
 select count(*),min(payload->>'id')::uuid into count_rows,chosen from business_capacity_filtered_page(broker_actor,broker_workspace,null,null,14,'{"near_lat":14,"near_lng":47,"near_radius_km":5}'::jsonb);
 if count_rows<>1 or chosen is distinct from(select c.id from capacities c where c.vehicle_id=trucks[1002] order by c.updated_at desc,c.id desc limit 1) then raise exception 'MATCH_AFTER_1000_NOT_REACHABLE';end if;
 begin
  perform 1 from business_capacity_filtered_page(actor,broker_workspace,null,null,14,'{}');
  raise exception 'WRONG_RECIPIENT_VISIBLE';
 exception when others then
  if sqlerrm<>'BUSINESS_FORBIDDEN' then raise;end if;
 end;
 -- Platform Brokerage has no private Capacity audience after its retirement.
 -- Require the exact denial; an empty result could hide a restored access path.
 begin
  perform private_capacity_filtered_page('LOADGISTIC',recipient,actor,null,null,14,'{}');
  raise exception 'RETIRED_PLATFORM_AUDIENCE_ACCEPTED';
 exception when raise_exception then
  if sqlerrm<>'PLATFORM_CAPACITY_RETIRED' then raise;end if;
 end;
 select coalesce(sum((payload->>'count')::bigint),0) into before_count from public_capacity_clusters('{"viewport":[45,13,49,15]}'::jsonb);
 update capacities set visibility='OPEN' where id=chosen;
 update vehicle_capacity_sharing set mode='PUBLIC' where vehicle_id=trucks[1002];
 select coalesce(sum((payload->>'count')::bigint),0),count(*) into after_count,count_rows from public_capacity_clusters('{"viewport":[45,13,49,15]}'::jsonb);
 if after_count<>before_count+1 or count_rows>200 then raise exception 'PUBLIC_AGGREGATE_COUNT_OR_BOUND';end if;
 select payload into result from public_capacity_clusters(jsonb_build_object('viewport',jsonb_build_array(45,13,49,15),'capacity_id',chosen));
 if result->>'id' is distinct from (select payload->>'id' from public_capacity_clusters(jsonb_build_object('viewport',jsonb_build_array(45.25,13,49.25,15),'capacity_id',chosen))) then raise exception 'UNSTABLE_OVERVIEW_CELL';end if;
 if exists(select 1 from public_capacity_clusters('{"viewport":[45,13,49,15]}'::jsonb) where payload ?| array['vehicle_id','contact_phone','assigned_driver_phone','email','messages','recurring_corridors']) then raise exception 'OVERVIEW_DETAIL_LEAK';end if;
 if has_function_privilege('authenticated','public.private_capacity_filtered_page(text,text,uuid,timestamptz,uuid,integer,jsonb)','execute') then raise exception 'BROWSER_SPATIAL_RPC';end if;
 raise notice 'Conjunctive spatial filters, bounded page after 1000 candidates and audience denial passed';
end $test$;
rollback;
