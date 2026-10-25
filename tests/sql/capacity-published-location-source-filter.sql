-- FEAT-MKT-001 / FEAT-CAP-001: synthetic provider and authorized viewers only;
-- all fixture writes roll back. Existing GPS/phone/manual publication commands
-- are exercised separately by telematics.sql.
begin;
create function pg_temp.assert_source(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception '%',label;end if;end $$;
do $test$
declare provider_id uuid:=gen_random_uuid();viewer_id uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();
 profile_id uuid:=gen_random_uuid();truck uuid;capacity_id uuid;workspace uuid;foreign_workspace uuid;connection_id uuid;
 origin_ref text;destination_ref text;digest text:=encode(gen_random_bytes(32),'hex');
 query jsonb;payload jsonb;source_name text;selected text;other_source text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  (provider_id,provider_id||'@example.invalid',now(),'{}'),
  (viewer_id,viewer_id||'@example.invalid',now(),'{}'),
  (foreign_id,foreign_id||'@example.invalid',now(),'{}');
 update profiles set role='DRIVER',active=true,drives_truck=true,full_name='Synthetic source provider' where id=provider_id;
 update profiles set role='SHIPPER',active=true where id in(viewer_id,foreign_id);
 insert into provider_profiles(id,user_id,business_name,handle)
  values(profile_id,provider_id,'Synthetic source provider','source171-'||substr(provider_id::text,1,12));
 insert into company_pages(provider_profile_id,published) values(profile_id,true);
 perform accept_content_policy(provider_id,'2026-10-09');
 truck:=(create_provider_vehicle(provider_id,'{"make":"Synthetic","model":"Source filter","plate":"SOURCE-171","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform update_fleet_driver_access(provider_id,jsonb_build_object('driver_user_id',provider_id,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(provider_id,truck,'LIVE');
 select id into strict origin_ref from place_catalog where normalized_name='addis ababa' limit 1;
 select id into strict destination_ref from place_catalog where normalized_name='adama' limit 1;
 capacity_id:=publish_provider_capacity(provider_id,jsonb_build_object('vehicle_id',truck,'status','EMPTY','sharing_mode','BOTH',
  'availability_geometry','ROUTE','accepted_loads','FTL','location_source','DEVICE_OBSCURED',
  'current_route_places',jsonb_build_array(jsonb_build_object('place_ref',origin_ref),jsonb_build_object('place_ref',destination_ref)),
  'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',20));
 workspace:=(business_workspace_create(viewer_id,jsonb_build_object('name','Synthetic source viewer','handle','source171-'||substr(viewer_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 foreign_workspace:=(business_workspace_create(foreign_id,jsonb_build_object('name','Foreign source viewer','handle','source171-foreign-'||substr(foreign_id::text,1,8),'kind','BROKER'))->>'id')::uuid;
 connection_id:=(request_account_connection(provider_id,'BUSINESS',workspace)->>'id')::uuid;
 perform decide_account_connection(viewer_id,connection_id,'ACCEPT');
 perform grant_account_capacity_access(provider_id,connection_id,truck);
 perform grant_business_capacity_access(provider_id,truck,workspace);

 -- The published source, rather than the selected device or driver intent, is
 -- the searchable fact. This local-only update isolates each source predicate.
 foreach source_name in array array['DEVICE_OBSCURED','TELEMATICS','MANUAL_ADMIN'] loop
  selected:=case source_name when 'DEVICE_OBSCURED' then 'MOBILE' when 'TELEMATICS' then 'GPS' else 'MANUAL' end;
  other_source:=case selected when 'GPS' then 'MOBILE' else 'GPS' end;
  update capacities set location_source=source_name where id=capacity_id;
  query:=jsonb_build_object('capacity_id',capacity_id,'location_source',selected,'status','EMPTY','vehicle_category','Mini Box Truck');
  select p.payload into payload from public_capacity_page(query,null,null,14) p;
  perform pg_temp.assert_source(payload->>'id'=capacity_id::text and payload->>'location_source'=source_name,'PUBLIC_SOURCE_MATCH_'||selected);
  perform pg_temp.assert_source((select count(*)=1 from capacity_search_public_rows(query,null,null,14)),'PUBLIC_SEARCH_SOURCE_MATCH_'||selected);
  perform pg_temp.assert_source((select count(*)=0 from public_capacity_page(query||jsonb_build_object('location_source',other_source),null,null,14)),'PUBLIC_SOURCE_MISMATCH_'||selected);
  perform pg_temp.assert_source((select count(*)=1 from public_capacity_page(query||jsonb_build_object('location_source','GPS,MOBILE,MANUAL'),null,null,14)),'PUBLIC_SOURCE_OR_'||selected);
  perform pg_temp.assert_source((select count(*)=0 from public_capacity_page(query||jsonb_build_object('status','PARTIAL'),null,null,14)),'PUBLIC_GROUP_AND_'||selected);
  perform pg_temp.assert_source((select count(*)=1 from public_capacity_page(jsonb_build_object('capacity_id',capacity_id),null,null,14)),'PUBLIC_EMPTY_SOURCE_CHANGED_'||selected);
  perform pg_temp.assert_source(payload::text not like '%installation_id%' and payload::text not like '%imei%' and payload::text not like '%speedKph%','PUBLIC_SOURCE_LEAK_'||selected);
 end loop;

 perform set_provider_capacity_sharing(provider_id,truck,'PRIVATE');
 foreach source_name in array array['DEVICE_OBSCURED','TELEMATICS','MANUAL_ADMIN'] loop
  selected:=case source_name when 'DEVICE_OBSCURED' then 'MOBILE' when 'TELEMATICS' then 'GPS' else 'MANUAL' end;
  other_source:=case selected when 'GPS' then 'MOBILE' else 'GPS' end;
  update capacities set location_source=source_name where id=capacity_id;
  query:=jsonb_build_object('capacity_id',capacity_id,'location_source',selected,'status','EMPTY');
  perform pg_temp.assert_source((select count(*)=0 from public_capacity_page(query,null,null,14)),'PRIVATE_PUBLIC_LEAK_'||selected);
  select p.payload into payload from account_capacity_filtered_page(viewer_id,digest,null,null,14,query) p;
  perform pg_temp.assert_source(payload->>'id'=capacity_id::text and payload->>'location_source'=source_name,'PRIVATE_SOURCE_MATCH_'||selected);
  perform pg_temp.assert_source((account_capacity_search_results(viewer_id,digest,query)->>'total')::integer=1,'PRIVATE_SEARCH_SOURCE_MATCH_'||selected);
  perform pg_temp.assert_source((select count(*)=0 from account_capacity_filtered_page(viewer_id,digest,null,null,14,query||jsonb_build_object('location_source',other_source))),'PRIVATE_SOURCE_MISMATCH_'||selected);
  perform pg_temp.assert_source((select count(*)=0 from account_capacity_filtered_page(foreign_id,digest,null,null,14,query)),'PRIVATE_GRANT_BYPASS_'||selected);
  perform pg_temp.assert_source((select count(*)=1 from business_capacity_filtered_page(viewer_id,workspace,null,null,14,query)),'BUSINESS_SOURCE_MATCH_'||selected);
  perform pg_temp.assert_source((select count(*)=0 from business_capacity_filtered_page(viewer_id,workspace,null,null,14,query||jsonb_build_object('location_source',other_source))),'BUSINESS_SOURCE_MISMATCH_'||selected);
  perform pg_temp.assert_source(payload::text not like '%installation_id%' and payload::text not like '%imei%' and payload::text not like '%speedKph%','PRIVATE_SOURCE_LEAK_'||selected);
 end loop;
 perform pg_temp.assert_source(not capacity_published_source_matches('{}'::jsonb,'{"location_source":"GPS"}')
  and capacity_published_source_matches('{}'::jsonb,'{}'::jsonb),'UNKNOWN_SOURCE_NOT_GUESSED');
 begin perform public_capacity_page('{"location_source":"GPS,UNKNOWN"}'::jsonb,null,null,14);raise exception 'INVALID_SOURCE_ALLOWED';
 exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 perform pg_temp.assert_source(not has_function_privilege('anon','public.capacity_published_source_matches(jsonb,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.capacity_published_source_matches(jsonb,jsonb)','EXECUTE'),'SOURCE_HELPER_PUBLIC');
 raise notice 'PASS: published GPS/phone/manual filters in public and registered-account maps; source OR/group AND, grants, paging, privacy and invalid values';
end $test$;
rollback;
