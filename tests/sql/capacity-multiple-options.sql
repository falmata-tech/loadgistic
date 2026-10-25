-- FEAT-MKT-001: actual public/private/search group OR, cross-group AND and privacy.
begin;
create function pg_temp.assert_multi(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
do $predicate$
declare item jsonb:=jsonb_build_object('id',gen_random_uuid(),'status','EMPTY','cargo_configuration','Cargo van',
 'availability_geometry','ROUTE','current_route_points','[]'::jsonb,'recurring_corridors','[]'::jsonb,'updated_at',now(),
 'accepts_full_load',true,'accepts_partial_load',false,'accepts_multi_pick',true,'accepts_multi_drop',false);
 query jsonb;
begin
 perform pg_temp.assert_multi(public.capacity_payload_matches(item,'{"status":"EMPTY,PARTIAL"}'),'MULTI_STATUS_MATCH_FAILED');
 perform pg_temp.assert_multi(public.capacity_payload_matches(item,'{"vehicle_category":"Pickup truck,Cargo van","load_type":"FTL,PTL","stop_option":"MULTI_PICK,MULTI_DROP","freshness":"UPDATE_NEEDED,FRESH"}'),'GROUP_OR_MATCH_FAILED');
 perform pg_temp.assert_multi(not public.capacity_payload_matches(item||'{"accepts_full_load":false,"accepts_partial_load":false}','{"load_type":"FTL,PTL"}'),'ALL_LOAD_CHOICES_BECAME_UNRESTRICTED');
 perform pg_temp.assert_multi(not public.capacity_payload_matches(item||'{"accepts_multi_pick":false,"accepts_multi_drop":false}','{"stop_option":"MULTI_PICK,MULTI_DROP"}'),'ALL_STOP_CHOICES_BECAME_UNRESTRICTED');
 perform pg_temp.assert_multi(not public.capacity_payload_matches(item,'{"vehicle_category":"Pickup truck","status":"EMPTY,PARTIAL"}'),'GROUPS_NOT_ANDED');
 perform pg_temp.assert_multi(not public.capacity_payload_matches(item||'{"status":"PARTIAL"}','{"status":"EMPTY,PARTIAL","geometry":"RADIUS"}'),'PARTIAL_AREA_MATCHED');
 perform pg_temp.assert_multi(public.capacity_payload_matches(item||jsonb_build_object('updated_at',now()-interval '12 hours'),'{"freshness":"FRESH"}'),'FRESHNESS_BOUNDARY_LOST');
 perform pg_temp.assert_multi(not public.capacity_payload_matches(item||jsonb_build_object('updated_at',now()-interval '12 hours'),'{"freshness":"UPDATE_NEEDED"}'),'FRESHNESS_BOUNDARY_OVERLAPS');
 perform pg_temp.assert_multi(public.capacity_payload_matches(item||jsonb_build_object('updated_at',now()-interval '12 hours 1 second'),'{"freshness":"UPDATE_NEEDED"}'),'OLDER_FRESHNESS_LOST');
 begin perform public.capacity_filter_values(repeat(' ',2049),'status');raise exception 'EXCESSIVE_BLANK_FILTER_ALLOWED';
 exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 for query in select value from jsonb_array_elements('[{"status":"EMPTY,FULL"},{"vehicle_category":"Cargo van,Unknown"},{"stop_option":"MULTI_PICK,"},{"load_type":[]},{"freshness":"FRESH,INVALID"}]') loop
  begin perform public.capacity_payload_matches(item,query);raise exception 'INVALID_SELECTION_ALLOWED';
  exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 end loop;
end $predicate$;

create temporary table multi_fixture(ordinal integer,actor uuid,truck uuid,capacity uuid,status text,configuration text);
do $projection$
declare owner_id uuid:=gen_random_uuid();org uuid:=gen_random_uuid();actor uuid;truck uuid;cap uuid;route jsonb;city_ref text;region text;
 handle text:='multi-'||org;query jsonb;first_page jsonb[];second_page jsonb[];total integer;item jsonb;digest text:=repeat('9',64);grant_id uuid;connection_id uuid;
 broker_actor uuid:=gen_random_uuid();broker_workspace uuid;
 admin_id uuid;authority_source uuid;context_revision text;setup_capacity uuid;
begin
 select id into strict admin_id from profiles where active and role='ADMIN' order by id limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(owner_id,'multi-owner-'||owner_id||'@example.test',now(),'{"full_name":"Synthetic multi owner"}');
 update profiles set role='TRANSPORTER',active=true where id=owner_id;
 perform accept_content_policy(owner_id,'2026-10-09');
 select current_route_points_json into strict route from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 city_ref:=coalesce(route->0->>'placeRef',route->0->>'place_ref');
 select base_region_code into strict region from company_pages where base_region_code is not null limit 1;
 insert into organizations(id,name,handle,type,city,city_place_ref) values(org,'Synthetic multi fleet',handle,'TRANSPORT_COMPANY','Synthetic city',city_ref);
 insert into organization_members(organization_id,user_id,membership_role) values(org,owner_id,'OWNER');
 insert into company_pages(organization_id,published,base_region_code,contact_phone,show_contact_phone) values(org,true,region,'+251900000139',true);
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(broker_actor,'multi-broker-'||broker_actor||'@example.invalid',now(),'{}');
 update profiles set role='SHIPPER',active=true where id=broker_actor;
 broker_workspace:=(business_workspace_create(broker_actor,jsonb_build_object('name','Multi-filter broker','handle','multi-broker-'||left(broker_actor::text,12),'kind','BROKER'))->>'id')::uuid;
 for ordinal_value in 1..18 loop
  actor:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(actor,'multi-driver-'||actor||'@example.test',now(),'{"full_name":"Synthetic multi driver"}');
  update profiles set role='DRIVER',active=true where id=actor;perform accept_content_policy(actor,'2026-10-09');
  insert into drivers(organization_id,user_id,name,active) values(org,actor,'Synthetic multi driver',true);
  insert into organization_members(organization_id,user_id,membership_role) values(org,actor,'DRIVER');
  truck:=(create_provider_vehicle(owner_id,jsonb_build_object('make','Synthetic','model','Multi fixture','plate','MF-'||left(actor::text,8),
    'cargo_configuration',case when ordinal_value%2=0 then 'Cargo van' else 'Mini Box Truck' end,'use_basis','OWNED'))->>'id')::uuid;
  perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',actor,'vehicle_id',truck,'can_manage_capacity',true,'can_manage_tracking',true));
  -- These freshness fixtures represent the same driver/truck working together
  -- for three days, with signals aged one hour or two days below. They are not
  -- a newly assigned pair inheriting someone else's historical signal.
  update driver_vehicle_assignments set assigned_at=now()-interval '3 days'
    where driver_user_id=actor and vehicle_id=truck and active;
  select id into strict setup_capacity from capacities where vehicle_id=truck and market_status='OFF_DUTY'
    order by updated_at desc,id desc limit 1;
  if ordinal_value=1 then
   authority_source:=submit_managed_verification(owner_id,jsonb_build_object('subject_type','VEHICLE','subject_id',truck,
     'verification_type','VEHICLE_OWNERSHIP','document_name','Synthetic multi-filter title',
     'storage_path','supabase://verification/verification/multi-filter-title.pdf','original_name','title.pdf','mime_type','application/pdf'));
   perform review_managed_verification(admin_id,authority_source,'APPROVED','Reviewed synthetic multi-filter title.');
   context_revision:=managed_provider_authority_review_context(admin_id,array[authority_source])->0->>'contextRevision';
   perform confirm_provider_vehicle_authority(admin_id,authority_source,jsonb_build_object('fact_kind','OWNERSHIP',
     'review_note','Matched exact synthetic multi-filter fleet.','context_revision',context_revision));
  end if;
  perform set_provider_vehicle_publication(owner_id,truck,'LIVE');
  perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',truck,'approximate_lat',9,'approximate_lng',38,'location_precision_km',20));
  cap:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck,'status',case when ordinal_value%3=0 then 'PARTIAL' else 'EMPTY' end,
    'accepted_loads',case when ordinal_value%3=0 then 'PTL' else 'FTL' end,'availability_geometry','ROUTE','location_source','PRESERVE_DRIVER',
    'current_route_places',route,'accepts_multi_pick',ordinal_value%2=0,'accepts_multi_drop',ordinal_value%2<>0,'sharing_mode','PUBLIC'));
  -- Remove only this new synthetic fixture's setup reset before deliberately
  -- aging its signal. Seeded history and production timestamp rules are intact.
  delete from capacities where id=setup_capacity and vehicle_id=truck and market_status='OFF_DUTY' and id<>cap;
  update capacities set updated_at=now()-case when ordinal_value%2=0 then interval '1 hour' else interval '2 days' end-ordinal_value*interval '1 second' where id=cap;
  perform pg_temp.assert_multi((select updated_at>=provider_capacity_pair_started_at(truck) from capacities where id=cap),
    'FRESHNESS_SIGNAL_PREDATES_CURRENT_PAIR');
  insert into multi_fixture values(ordinal_value,actor,truck,cap,case when ordinal_value%3=0 then 'PARTIAL' else 'EMPTY' end,case when ordinal_value%2=0 then 'Cargo van' else 'Mini Box Truck' end);
 end loop;
 query:=jsonb_build_object('provider',handle,'vehicle_category','Cargo van,Mini Box Truck','status','EMPTY,PARTIAL','load_type','FTL,PTL','stop_option','MULTI_PICK,MULTI_DROP','freshness','FRESH,UPDATE_NEEDED');
 select count(*) into total from capacity_search_public_rows(query,null,null,14);perform pg_temp.assert_multi(total=18,'PUBLIC_SEARCH_OR_UNION_INCOMPLETE');
 select array_agg(payload order by (payload->>'updated_at')::timestamptz desc,(payload->>'id')::uuid desc) into first_page from public_capacity_page(query,null,null,14);
 perform pg_temp.assert_multi(cardinality(first_page)=15,'PUBLIC_CURSOR_FIRST_PAGE_BOUND');
 select array_agg(payload) into second_page from public_capacity_page(query,(first_page[14]->>'updated_at')::timestamptz,(first_page[14]->>'id')::uuid,14);
 perform pg_temp.assert_multi(cardinality(second_page)=4,'PUBLIC_CURSOR_SECOND_PAGE_INCOMPLETE');
 perform pg_temp.assert_multi(not exists(select 1 from unnest(first_page[1:14]) a join unnest(second_page) b on a->>'id'=b->>'id'),'MULTI_CURSOR_DUPLICATED');
 perform pg_temp.assert_multi(not exists(select f.capacity::text from multi_fixture f except select payload->>'id' from unnest(first_page[1:14]||second_page) payload),'MULTI_CURSOR_LOST_IDS');
 perform pg_temp.assert_multi((select count(distinct payload->>'id') from unnest(first_page[1:14]||second_page) payload)=18,'MULTI_CURSOR_EXTRA_OR_DUPLICATE_IDS');
 perform pg_temp.assert_multi((select count(*) from capacity_search_public_rows(query||jsonb_build_object('origin_lat',route->0->'lat','origin_lng',route->0->'lng',
  'destination_lat',route->(jsonb_array_length(route)-1)->'lat','destination_lng',route->(jsonb_array_length(route)-1)->'lng','origin_radius_km',5,'destination_radius_km',5),null,null,14))=18,'GROUPS_AND_ROUTE_ENDPOINTS_LOST');
 perform pg_temp.assert_multi(not exists(select 1 from capacity_search_public_rows(query||jsonb_build_object('origin_lat',route->0->'lat','origin_lng',route->0->'lng',
  'destination_lat',-80,'destination_lng',-160,'origin_radius_km',5,'destination_radius_km',5),null,null,14)),'BAD_ENDPOINT_BROADENED_GROUP_MATCH');
 select count(*) into total from capacity_search_public_rows(query||'{"vehicle_category":"Cargo van","load_type":"PTL","freshness":"FRESH"}',null,null,14);
 perform pg_temp.assert_multi(total=3,'GROUP_AND_INTERSECTION_WRONG');
 select count(*) into total from capacity_search_public_rows(jsonb_build_object('provider',handle,'vehicle_category','Cargo van'),null,null,14);
 perform pg_temp.assert_multi(total=9,'LEGACY_SCALAR_CONFIGURATION_CHANGED');
 perform pg_temp.assert_multi((select count(*) from public_capacity_page(jsonb_build_object('provider',handle,'status','EMPTY','load_type','FTL'),null,null,100))=12,'LEGACY_SCALAR_PUBLIC_LOAD_CHANGED');
 perform pg_temp.assert_multi((capacity_search_results(query)->>'total')::integer=19,'PROFILE_MATCHING_TRUCK_COUNTS_INCOMPLETE');
 insert into verification_requests(subject_type,subject_id,verification_type,document_name,storage_path,original_name,mime_type,status,submitted_by)
  values('ORGANIZATION',org,'IDENTITY','Synthetic reviewed identity','synthetic/multi-139-owner.png','synthetic.png','image/png','APPROVED',owner_id);
 perform pg_temp.assert_multi((select count(*) from capacity_search_public_rows(query||'{"owner_docs":"IDENTITY"}',null,null,14))=18,'REVIEWED_DOCUMENT_POSITIVE_LOST');
 perform pg_temp.assert_multi(not exists(select 1 from capacity_search_public_rows(query||'{"owner_docs":"IDENTITY,BUSINESS_LICENSE"}',null,null,14)),'ALL_DOCUMENT_REQUIREMENTS_WEAKENED');
 select f.truck,f.capacity,f.actor into truck,cap,actor from multi_fixture f where f.ordinal=1;
 connection_id:=(request_account_connection(owner_id,'BUSINESS',broker_workspace)->>'id')::uuid;
 perform decide_account_connection(broker_actor,connection_id,'ACCEPT');
 grant_id:=(grant_account_capacity_access(owner_id,connection_id,truck)->>'id')::uuid;
 perform set_provider_capacity_sharing(owner_id,truck,'PRIVATE');
 perform pg_temp.assert_multi(not exists(select 1 from public_capacity_page(query,null,null,100) r where r.payload->>'vehicle_id'=truck::text),'PRIVATE_MULTI_MAP_LEAK');
 perform pg_temp.assert_multi(exists(select 1 from account_capacity_filtered_page(broker_actor,digest,null,null,100,query) r where r.payload->>'vehicle_id'=truck::text),'PRIVATE_OR_MATCH_LOST');
 perform pg_temp.assert_multi((account_capacity_search_results(broker_actor,digest,query,1)->>'total')::integer>0,'PRIVATE_SEARCH_OR_MATCH_LOST');
 perform pg_temp.assert_multi(exists(select 1 from account_capacity_filtered_page(broker_actor,digest,null,null,100,jsonb_build_object('capacity_id',cap,'status','EMPTY','vehicle_category','Mini Box Truck','load_type','FTL'))),'PRIVATE_SCALAR_MATCH_LOST');
 perform pg_temp.assert_multi(not exists(select 1 from account_capacity_filtered_page(broker_actor,digest,null,null,100,query||'{"vehicle_category":"Cargo van"}')),'PRIVATE_GROUP_AND_WEAKENED');
 perform pg_temp.assert_multi((account_capacity_search_results(broker_actor,digest,query||'{"owner_docs":"IDENTITY,BUSINESS_LICENSE"}',1)->>'total')::integer=0,'PRIVATE_ALL_DOCUMENT_REQUIREMENTS_WEAKENED');
 perform pg_temp.assert_multi(not exists(select 1 from account_capacity_filtered_page(broker_actor,digest,null,null,100,query||'{"destination_lat":-80,"destination_lng":-160,"destination_radius_km":5}')),'PRIVATE_ENDPOINT_AND_WEAKENED');
 perform pg_temp.assert_multi(not exists(select 1 from account_capacity_filtered_page(owner_id,digest,null,null,100,query)),'MISSING_GRANT_EXPOSED');
 perform revoke_account_capacity_access(owner_id,grant_id,1);
 perform pg_temp.assert_multi(not exists(select 1 from account_capacity_filtered_page(broker_actor,digest,null,null,100,query)),'REVOKED_GRANT_EXPOSED');
 update profiles set active=false where id=actor;
 perform set_provider_capacity_sharing(owner_id,truck,'PUBLIC');
 perform pg_temp.assert_multi(not exists(select 1 from capacity_search_public_rows(query,null,null,14) r where r.payload->>'vehicle_id'=truck::text),'INACTIVE_DRIVER_MATCHED');
 update organizations set content_hidden=true where id=org;
 perform pg_temp.assert_multi(not exists(select 1 from public_capacity_page(query,null,null,100)),'MODERATED_GROUP_MATCH_EXPOSED');
 update organizations set content_hidden=false,review_workspace=true where id=org;
 perform pg_temp.assert_multi(not exists(select 1 from capacity_search_public_rows(query,null,null,14)),'REVIEW_GROUP_MATCH_EXPOSED');
 perform pg_temp.assert_multi(not has_function_privilege('anon','public.capacity_filter_values(text,text)','EXECUTE') and not has_function_privilege('authenticated','public.capacity_filter_values(text,text)','EXECUTE'),'BROWSER_FILTER_HELPER_ALLOWED');
 raise notice 'PASS: actual grouped public/private/search matching, scalar compatibility, cursor pages, documents, assignment/grant/moderation denial';
end $projection$;
set local role service_role;
do $direct_rpc$
declare query jsonb;name text;
begin
 for query in select value from jsonb_array_elements('[{"status":"EMPTY,FULL"},{"vehicle_category":"Cargo van,Unknown"},{"load_type":"FTL,"},{"stop_option":[]},{"freshness":"FRESH,INVALID"}]') loop
  foreach name in array array['public_capacity_page','capacity_search_public_rows'] loop
   begin execute format('select count(*) from public.%I($1,null,null,14)',name) using query;raise exception 'DIRECT_RPC_INVALID_SELECTION_ALLOWED';
   exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
  end loop;
 end loop;
 begin perform 1 from public.public_capacity_page(jsonb_build_object('status',repeat('EMPTY,',40)),null,null,14);raise exception 'DIRECT_RPC_EXCESSIVE_SELECTION_ALLOWED';
 exception when raise_exception then if sqlerrm<>'INVALID_CAPACITY_FILTER' then raise;end if;end;
 raise notice 'PASS: actual service RPCs reject unsupported, mixed, empty and excessive groups without HTTP validation';
end $direct_rpc$;
reset role;
rollback;
