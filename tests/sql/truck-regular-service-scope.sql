-- FEAT-CAP/PRV/FLT-001: rollback-only, synthetic local fixtures; no email/files.
begin;
create function pg_temp.assert_regular(ok boolean,message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
create function pg_temp.denied_regular(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement;raise exception 'REGULAR_COMMAND_UNEXPECTEDLY_ALLOWED';
 exception when raise_exception then if sqlerrm<>expected then raise;end if;end;
end $$;

do $scope$
declare owner_id uuid:=gen_random_uuid();org uuid:=gen_random_uuid();driver_a uuid:=gen_random_uuid();driver_b uuid:=gen_random_uuid();
 outsider uuid:=gen_random_uuid();other_org uuid:=gen_random_uuid();independent uuid:=gen_random_uuid();independent_provider uuid:=gen_random_uuid();independent_truck uuid;independent_new uuid;independent_route uuid;truck_a uuid;truck_b uuid;cap_a uuid;cap_b uuid;route_a uuid;route_b uuid;legacy uuid:=gen_random_uuid();
 places jsonb;other_places jsonb;first_lat double precision;first_lng double precision;far_lat double precision;far_lng double precision;viewport jsonb;city_ref text;region text;handle text:='regular-'||org;command_a jsonb;command_b jsonb;
 original jsonb;legacy_before jsonb;workspace jsonb;payload jsonb;statement text;signature text;observed_a integer;observed_b integer;featured record;digest text:=repeat('4',64);before_audit bigint;page_id uuid;admin_id uuid;authority_source uuid;
 marker text:='Legacyservicessentinel140';about_marker text:='Aboutsearchsentinel140';
begin
 select current_route_points_json into strict places from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 -- Commands resolve place references through the catalog; cached Capacity
 -- point coordinates may differ and cannot define this narrow test viewport.
 select p.latitude,p.longitude into strict first_lat,first_lng from place_catalog p
 where p.id=coalesce(places->0->>'placeRef',places->0->>'place_ref');
 select latitude into strict far_lat from place_catalog where latitude is not null and longitude is not null order by abs(latitude-first_lat) desc,id limit 1;
 select jsonb_agg(jsonb_build_object('place_ref',p.id,'label',p.name,'lat',p.latitude,'lng',p.longitude) order by p.id) into other_places
 from (select id,name,latitude,longitude from place_catalog where latitude is not null and longitude is not null
 and case when far_lat>first_lat then latitude>first_lat+2 else latitude<first_lat-2 end order by id limit 2) p;
 perform pg_temp.assert_regular(jsonb_array_length(other_places)=2,'DISTINCT_FAR_CATALOG_ROUTE_REQUIRED');
 far_lat:=(other_places->0->>'lat')::double precision;far_lng:=(other_places->0->>'lng')::double precision;
 viewport:=jsonb_build_array(first_lng-0.01,first_lat-0.01,first_lng+0.01,first_lat+0.01);
 city_ref:=coalesce(places->0->>'placeRef',places->0->>'place_ref');
 select base_region_code into strict region from company_pages where base_region_code is not null limit 1;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (owner_id,'regular-owner-'||owner_id||'@example.test',now(),'{"full_name":"Synthetic Regular owner"}'),
 (driver_a,'regular-a-'||driver_a||'@example.test',now(),'{"full_name":"Synthetic Regular Driver A"}'),
 (driver_b,'regular-b-'||driver_b||'@example.test',now(),'{"full_name":"Synthetic Regular Driver B"}'),
 (outsider,'regular-other-'||outsider||'@example.test',now(),'{"full_name":"Synthetic unrelated owner"}'),
 (independent,'regular-independent-'||independent||'@example.test',now(),'{"full_name":"Synthetic independent Driver"}');
 update profiles set role='TRANSPORTER',active=true where id in(owner_id,outsider);
 update profiles set role='DRIVER',active=true where id in(driver_a,driver_b,independent);
 update profiles set drives_truck=true where id=independent;
 perform accept_content_policy(owner_id,'2026-10-09');
 insert into organizations(id,name,handle,type,city,city_place_ref) values(org,'Synthetic Regular fleet',handle,'TRANSPORT_COMPANY','Synthetic city',city_ref),
 (other_org,'Synthetic unrelated fleet','other-'||other_org,'TRANSPORT_COMPANY','Synthetic city',city_ref);
 insert into organization_members(organization_id,user_id,membership_role) values(org,owner_id,'OWNER'),(org,driver_a,'DRIVER'),(org,driver_b,'DRIVER'),(other_org,outsider,'OWNER');
 insert into company_pages(organization_id,published,base_region_code,contact_phone,show_contact_phone,about,services)
 values(org,true,region,'+251900000140',true,about_marker,marker) returning id into page_id;
 insert into drivers(organization_id,user_id,name,active) values(org,driver_a,'Synthetic Regular Driver A',true),(org,driver_b,'Synthetic Regular Driver B',true);
 truck_a:=(create_provider_vehicle(owner_id,jsonb_build_object('make','Synthetic','model','Regular A','plate','RA-'||left(org::text,8),'cargo_configuration','Cargo van','use_basis','OWNED'))->>'id')::uuid;
 truck_b:=(create_provider_vehicle(owner_id,jsonb_build_object('make','Synthetic','model','Regular B','plate','RB-'||left(org::text,8),'cargo_configuration','Pickup truck','use_basis','PERMISSION'))->>'id')::uuid;
 perform set_provider_vehicle_publication(owner_id,truck_a,'LIVE');
 perform pg_temp.denied_regular(format('select set_provider_vehicle_publication(%L,%L,%L)',owner_id,truck_b,'LIVE'),'PROVIDER_VERIFICATION_REQUIRED');
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 authority_source:=submit_managed_verification(owner_id,jsonb_build_object('subject_type','VEHICLE','subject_id',truck_a,
  'verification_type','VEHICLE_OWNERSHIP','document_name','Synthetic regular title','storage_path','supabase://verification/verification/regular-scope.pdf',
  'original_name','fixture.pdf','mime_type','application/pdf'));
 perform review_managed_verification(admin_id,authority_source,'APPROVED','Synthetic regular-scope review.');
 perform confirm_provider_vehicle_authority(admin_id,authority_source,jsonb_strip_nulls(jsonb_build_object(
  'fact_kind','OWNERSHIP','review_note','Synthetic exact provider title holder.',
  'context_revision',managed_provider_authority_review_context(admin_id,array[authority_source])->0->>'contextRevision')));
 perform set_provider_vehicle_publication(owner_id,truck_b,'LIVE');
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_a,'vehicle_id',truck_a,'can_manage_capacity',true,'can_manage_tracking',true));
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_b,'vehicle_id',truck_b,'can_manage_capacity',true,'can_manage_tracking',true));
 perform refresh_provider_capacity_location(driver_a,jsonb_build_object('vehicle_id',truck_a,'approximate_lat',far_lat,'approximate_lng',far_lng,'location_precision_km',20));
 perform refresh_provider_capacity_location(driver_b,jsonb_build_object('vehicle_id',truck_b,'approximate_lat',far_lat,'approximate_lng',far_lng,'location_precision_km',20));
 cap_a:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_a,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','current_route_places',other_places,'sharing_mode','BOTH'));
 cap_b:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_b,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','current_route_places',other_places,'sharing_mode','BOTH'));
 insert into profile_routes(id,organization_id,geometry,origin,destination,route_points_json,created_by)
 values(legacy,org,'ROUTE','Legacy unbound origin','Legacy unbound destination',places,owner_id);
 legacy_before:=(select to_jsonb(r) from profile_routes r where id=legacy);
 command_a:=jsonb_build_object('vehicle_id',truck_a,'expected_driver_id',driver_a,'geometry','ROUTE','route_places',places);
 command_b:=jsonb_build_object('vehicle_id',truck_b,'expected_driver_id',driver_b,'geometry','ROUTE','route_places',other_places);
 -- These assertions fail on the pre-140 contract; they do not merely inspect source.
 perform pg_temp.denied_regular(format('select add_provider_regular_capacity(%L,%L)',owner_id,command_a-'vehicle_id'),'REGULAR_TRUCK_DRIVER_REQUIRED');
 perform pg_temp.denied_regular(format('select add_provider_regular_capacity(%L,%L)',owner_id,command_a-'expected_driver_id'),'REGULAR_TRUCK_DRIVER_REQUIRED');
 route_a:=add_provider_regular_capacity(owner_id,command_a);
 route_b:=add_provider_regular_capacity(owner_id,command_b);
 perform pg_temp.assert_regular((select count(*)=2 from profile_routes where assigned_vehicle_id in(truck_a,truck_b)),'TWO_TRUCK_REGULAR_SIGNALS_NOT_SAVED');
 perform pg_temp.denied_regular(format('select add_provider_regular_capacity(%L,%L)',owner_id,command_a),'REGULAR_CAPACITY_LIMIT');
 perform pg_temp.denied_regular(format('select add_provider_regular_capacity(%L,%L)',driver_b,command_b),'FORBIDDEN');
 perform pg_temp.denied_regular(format('select add_provider_regular_capacity(%L,%L)',outsider,command_a),'NOT_FOUND');
 perform pg_temp.denied_regular(format('select add_provider_regular_capacity(%L,%L)',driver_b,command_a),'FORBIDDEN');
 workspace:=provider_capacity_workspace(owner_id);
 perform pg_temp.assert_regular((select count(*)=2 from jsonb_array_elements(workspace->'corridors')),'OWNER_PAIR_ROUTES_INCOMPLETE');
 perform pg_temp.assert_regular(not exists(select 1 from jsonb_array_elements(workspace->'corridors') r where r->>'id'=legacy::text),'LEGACY_ROUTE_PROJECTED');
 workspace:=provider_capacity_workspace(driver_a);
 perform pg_temp.assert_regular(jsonb_array_length(workspace->'corridors')=1 and workspace->'corridors'->0->>'vehicle_id'=truck_a::text and workspace->'corridors'->0->>'driver_user_id'=driver_a::text,'DRIVER_SCOPE_OR_SCOPE_IDS_WRONG');
 insert into capacity_access_grants(vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by)
 values(truck_a,'EMAIL','regular-recipient@example.test',digest,owner_id),(truck_b,'EMAIL','regular-recipient@example.test',digest,owner_id);
 for statement in select unnest(array[
  format('select payload from public_capacity_page(%L)',jsonb_build_object('provider',handle)),
  format('select payload from capacity_search_public_rows(%L,null,null,14)',jsonb_build_object('provider',handle)),
  format('select payload from private_capacity_projection(''EMAIL'',%L)',digest),
  format('select payload from private_capacity_filtered_page(''EMAIL'',%L,null,null,null,100,%L)',digest,jsonb_build_object('provider',handle)),
  format('select payload from capacity_search_private_rows(''EMAIL'',%L,null,null,null,100,%L)',digest,jsonb_build_object('provider',handle))
 ]) loop
  observed_a:=0;observed_b:=0;
  for payload in execute statement loop
   if payload->>'vehicle_id' not in(truck_a::text,truck_b::text) then continue;end if;
   if payload->>'vehicle_id'=truck_a::text then observed_a:=observed_a+1;else observed_b:=observed_b+1;end if;
   perform pg_temp.assert_regular(jsonb_array_length(payload->'recurring_corridors')=1,'PAIR_ROUTE_MISSING_OR_DUPLICATED');
   perform pg_temp.assert_regular(payload->'recurring_corridors'->0->>'id'=case when payload->>'vehicle_id'=truck_a::text then route_a::text else route_b::text end,'CROSS_TRUCK_REGULAR_LEAK');
  end loop;
  perform pg_temp.assert_regular(observed_a=1 and observed_b=1,'PROJECTION_TRUCKS_MISSING_OR_DUPLICATED');
 end loop;
 -- Both current routes/GPS fixes and B's distinct Regular route are outside
 -- this viewport. Only A's own Regular route can witness a visible truck.
 select projected.payload into strict payload from public_capacity_page(jsonb_build_object('capacity_id',cap_a)) projected;
 perform pg_temp.assert_regular(not capacity_viewport_matches(payload||jsonb_build_object('recurring_corridors','[]'::jsonb),jsonb_build_object('viewport',viewport)),'CLUSTER_FIXTURE_CURRENT_EVIDENCE_NOT_OUTSIDE');
 perform pg_temp.assert_regular(capacity_viewport_matches(payload,jsonb_build_object('viewport',viewport)),'CLUSTER_FIXTURE_TRUCK_A_REGULAR_NOT_INSIDE');
 select projected.payload into strict payload from public_capacity_page(jsonb_build_object('capacity_id',cap_b)) projected;
 perform pg_temp.assert_regular(not capacity_viewport_matches(payload,jsonb_build_object('viewport',viewport)),'CLUSTER_FIXTURE_TRUCK_B_NOT_OUTSIDE');
 perform pg_temp.assert_regular((select coalesce(sum((cluster.payload->>'count')::integer),0)=1
 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',viewport)) cluster),'CLUSTER_CROSS_TRUCK_REGULAR_VIEWPORT_LEAK');
 -- Actual cluster totals must not multiply trucks by provider-wide routes.
 perform pg_temp.assert_regular((select coalesce(sum((cluster.payload->>'count')::integer),0)=2
 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85))) cluster),'CLUSTER_ROUTE_JOIN_MULTIPLIED_TRUCKS');
 -- Public cluster policy follows current sharing even when a retained legacy
 -- snapshot still says OPEN. These fixture-only inconsistencies are rolled back.
 perform set_provider_capacity_sharing(owner_id,truck_a,'PRIVATE');
 update capacities set visibility='OPEN' where id=cap_a;
 perform pg_temp.assert_regular((select coalesce(sum((c.payload->>'count')::integer),0)=1 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85))) c),'PRIVATE_CLUSTER_POLICY_NOT_AUTHORITATIVE');
 perform set_provider_capacity_sharing(owner_id,truck_a,'EXCLUSIVE','cluster-exclusive@example.test',repeat('6',64));
 update capacities set visibility='OPEN' where id=cap_a;
 perform pg_temp.assert_regular((select coalesce(sum((c.payload->>'count')::integer),0)=1 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85))) c),'EXCLUSIVE_CLUSTER_POLICY_NOT_AUTHORITATIVE');
 perform set_provider_capacity_sharing(owner_id,truck_a,'BOTH');
 update organizations set content_hidden=true where id=org;
 perform pg_temp.assert_regular(not exists(select 1 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85)))),'HIDDEN_FLEET_CLUSTER_EXPOSED');
 update organizations set content_hidden=false,review_workspace=true where id=org;
 perform pg_temp.assert_regular(not exists(select 1 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85)))),'REVIEW_FLEET_CLUSTER_EXPOSED');
 -- Moderation intentionally keeps identity PRIVATE until explicitly restored.
 update organizations set review_workspace=false,public_visibility='PUBLIC' where id=org;
 update profiles set active=false where id=driver_a;
 perform pg_temp.assert_regular((select coalesce(sum((c.payload->>'count')::integer),0)=1 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85))) c),'INACTIVE_DRIVER_CLUSTER_EXPOSED');
 update profiles set active=true where id=driver_a;
 update capacities set updated_at=now()-interval '1 second' where vehicle_id=truck_a;
 perform set_provider_assigned_vehicle_duty(driver_a,jsonb_build_object('vehicle_id',truck_a,'on_duty',false));
 perform pg_temp.assert_regular((select coalesce(sum((c.payload->>'count')::integer),0)=1 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85))) c),'OFF_DUTY_CLUSTER_REGULAR_RESURRECTED');
 update capacities set updated_at=now()-interval '1 second' where vehicle_id=truck_a;
 cap_a:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_a,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','current_route_places',other_places,'sharing_mode','BOTH'));
 perform pg_temp.assert_regular((select coalesce(sum((c.payload->>'count')::integer),0)=2 from public_capacity_clusters(jsonb_build_object('provider',handle,'viewport',jsonb_build_array(-180,-85,180,85))) c),'PUBLIC_CLUSTER_RECOVERY_INCOMPLETE');
 original:=(select to_jsonb(r) from profile_routes r where id=route_a);select count(*) into before_audit from audit_logs;
 perform pg_temp.denied_regular(format('select replace_provider_regular_capacity(%L,%L,%L)',owner_id,route_a,command_a||'{"route_places":[]}'),'CAPACITY_ROUTE_POINTS_REQUIRED');
 perform pg_temp.assert_regular((select to_jsonb(r)=original from profile_routes r where id=route_a),'INVALID_REPLACE_CHANGED_ORIGINAL');
 perform pg_temp.assert_regular((select count(*)=before_audit from audit_logs),'INVALID_REPLACE_CREATED_AUDIT');
 update driver_permissions set can_manage_capacity=false where user_id=driver_a;
 perform pg_temp.assert_regular(jsonb_array_length(provider_capacity_workspace(driver_a)->'corridors')=1,'RESTRICTED_DRIVER_CANNOT_READ_CURRENT_ROUTE');
 perform pg_temp.denied_regular(format('select replace_provider_regular_capacity(%L,%L,%L)',driver_a,route_a,command_a),'FORBIDDEN');
 update driver_permissions set can_manage_capacity=true where user_id=driver_a;
 perform pg_temp.denied_regular(format('select replace_provider_regular_capacity(%L,%L,%L)',driver_a,route_a,command_a),'FORBIDDEN');
 perform pg_temp.denied_regular(format('select remove_provider_regular_capacity(%L,%L)',owner_id,route_a),'REGULAR_TRUCK_DRIVER_REQUIRED');
 perform pg_temp.denied_regular(format('select remove_provider_regular_capacity(%L,%L,%L,%L)',owner_id,route_b,truck_a,driver_a),'NOT_FOUND');
 -- Featured uses one bounded authorized public statement with matching Driver.
 observed_a:=0;observed_b:=0;
 for featured in select * from featured_truck_regular_signals(array[truck_a,truck_b]) loop
  if featured.vehicle_id=truck_a then
   observed_a:=observed_a+1;perform pg_temp.assert_regular(featured.driver_user_id=driver_a and featured.regular_signal->>'id'=route_a::text,'FEATURED_TRUCK_A_PAIR_WRONG');
  else observed_b:=observed_b+1;perform pg_temp.assert_regular(featured.driver_user_id=driver_b and featured.regular_signal->>'id'=route_b::text,'FEATURED_TRUCK_B_PAIR_WRONG');end if;
 end loop;
 perform pg_temp.assert_regular(observed_a=1 and observed_b=1,'FEATURED_PAIR_ROWS_MISSING');
 perform pg_temp.assert_regular(not exists(select 1 from featured_truck_regular_signals(array[]::uuid[])),'EMPTY_FEATURED_SCOPE_NOT_EMPTY');
 perform pg_temp.denied_regular('select * from featured_truck_regular_signals(null)','INVALID_FEATURED_TRUCK_SCOPE');
 perform pg_temp.denied_regular('select * from featured_truck_regular_signals(array[null]::uuid[])','INVALID_FEATURED_TRUCK_SCOPE');
 perform pg_temp.denied_regular(format('select * from featured_truck_regular_signals(array[%L,%L]::uuid[])',truck_a,truck_a),'INVALID_FEATURED_TRUCK_SCOPE');
 perform pg_temp.denied_regular(format('select * from featured_truck_regular_signals(array_fill(%L::uuid,array[101]))',truck_a),'INVALID_FEATURED_TRUCK_SCOPE');
 -- A changed assignment excludes old-pair geometry and rejects its stale commands.
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_b,'vehicle_id',truck_a,'can_manage_capacity',true));
 perform pg_temp.denied_regular(format('select replace_provider_regular_capacity(%L,%L,%L)',owner_id,route_a,command_a),'TRUCK_DRIVER_CHANGED');
 perform pg_temp.denied_regular(format('select remove_provider_regular_capacity(%L,%L,%L,%L)',owner_id,route_a,truck_a,driver_a),'TRUCK_DRIVER_CHANGED');
 perform pg_temp.assert_regular(jsonb_array_length(provider_capacity_workspace(owner_id)->'corridors')=0,'STALE_PAIR_WORKSPACE_ROUTE_VISIBLE');
 perform pg_temp.assert_regular(not exists(select 1 from public_capacity_page(jsonb_build_object('capacity_id',cap_a)) projected
  where coalesce(jsonb_array_length(projected.payload->'recurring_corridors'),0)>0),'STALE_PAIR_PUBLIC_ROUTE_VISIBLE');
 perform pg_temp.assert_regular((select count(*)=2 from profile_routes where id in(route_a,route_b)),'STALE_PAIR_HISTORY_REMOVED');
 select * into featured from featured_truck_regular_signals(array[truck_a]);
 perform pg_temp.assert_regular(not found or (featured.driver_user_id=driver_b and featured.regular_signal is null),'FEATURED_STALE_PAIR_ROUTE_VISIBLE');
 perform set_provider_capacity_sharing(owner_id,truck_a,'PRIVATE');
 perform pg_temp.assert_regular(not exists(select 1 from featured_truck_regular_signals(array[truck_a])),'PRIVATE_TRUCK_FEATURED_REGULAR_EXPOSED');
 perform set_provider_capacity_sharing(owner_id,truck_a,'EXCLUSIVE','regular-exclusive@example.test',repeat('5',64));
 perform pg_temp.assert_regular(not exists(select 1 from featured_truck_regular_signals(array[truck_a])),'EXCLUSIVE_TRUCK_FEATURED_REGULAR_EXPOSED');
 perform set_provider_capacity_sharing(owner_id,truck_a,'BOTH');
 update capacities set updated_at=now()-interval '1 second' where vehicle_id=truck_a;
 perform set_provider_assigned_vehicle_duty(driver_b,jsonb_build_object('vehicle_id',truck_a,'on_duty',false));
 perform pg_temp.assert_regular(not exists(select 1 from featured_truck_regular_signals(array[truck_a])),'OFF_DUTY_TRUCK_FEATURED_REGULAR_EXPOSED');
 perform refresh_provider_capacity_location(driver_b,jsonb_build_object('vehicle_id',truck_a,'approximate_lat',9,'approximate_lng',38,'location_precision_km',20));
 perform publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_a,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','current_route_places',places,'sharing_mode','BOTH'));
 -- A personal provider may retire a truck and add another; the new pair must
 -- not inherit the retired pair's route or remove its history.
 insert into provider_profiles(id,user_id,business_name,handle) values(independent_provider,independent,'Synthetic independent','ri-'||left(independent::text,20));
 independent_truck:=(create_provider_vehicle(independent,jsonb_build_object('make','Synthetic','model','Regular independent','plate','RI-'||left(independent::text,8),'cargo_configuration','Cargo van','use_basis','OWNED'))->>'id')::uuid;
 perform accept_content_policy(independent,'2026-10-09');
 perform update_fleet_driver_access(independent,jsonb_build_object('driver_user_id',independent,'vehicle_id',independent_truck,'can_manage_capacity',true,'can_manage_tracking',true));
 perform set_provider_vehicle_publication(independent,independent_truck,'LIVE');
 independent_route:=add_provider_regular_capacity(independent,jsonb_build_object('vehicle_id',independent_truck,'expected_driver_id',independent,'geometry','ROUTE','route_places',places));
 insert into company_pages(provider_profile_id,published,base_region_code,contact_phone,show_contact_phone)
 values(independent_provider,true,region,'+251900000141',true);
 perform publish_provider_capacity(independent,jsonb_build_object('vehicle_id',independent_truck,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','DEVICE_OBSCURED','approximate_lat',far_lat,'approximate_lng',far_lng,'location_precision_km',20,'current_route_places',places,'sharing_mode','PUBLIC'));
 perform pg_temp.assert_regular((select coalesce(sum((c.payload->>'count')::integer),0)=1 from public_capacity_clusters(jsonb_build_object('provider','ri-'||left(independent::text,20),'viewport',jsonb_build_array(-180,-85,180,85))) c),'INDEPENDENT_CLUSTER_FIXTURE_NOT_PUBLIC');
 update provider_profiles set content_hidden=true where id=independent_provider;
 perform pg_temp.assert_regular(not exists(select 1 from public_capacity_clusters(jsonb_build_object('provider','ri-'||left(independent::text,20),'viewport',jsonb_build_array(-180,-85,180,85)))),'HIDDEN_INDEPENDENT_CLUSTER_EXPOSED');
 update provider_profiles set content_hidden=false,review_workspace=true where id=independent_provider;
 perform pg_temp.assert_regular(not exists(select 1 from public_capacity_clusters(jsonb_build_object('provider','ri-'||left(independent::text,20),'viewport',jsonb_build_array(-180,-85,180,85)))),'REVIEW_INDEPENDENT_CLUSTER_EXPOSED');
 update provider_profiles set review_workspace=false,public_visibility='PUBLIC' where id=independent_provider;
 original:=(select to_jsonb(r) from profile_routes r where id=independent_route);
 perform pg_temp.assert_regular(jsonb_array_length(provider_capacity_workspace(independent)->'corridors')=1,'INDEPENDENT_CURRENT_ROUTE_UNAVAILABLE');
 perform pg_temp.denied_regular(format('select create_provider_vehicle(%L,%L)',independent,
  jsonb_build_object('make','Synthetic','model','Regular replacement','plate','RN-'||left(independent::text,8),
   'cargo_configuration','Pickup truck','use_basis','PERMISSION','replace_vehicle_id',independent_truck,'replacement_confirmed',true)),
  'TRUCK_CHANGE_REQUIRED');
 perform set_vehicle_lifecycle(independent,independent_truck,false,'Synthetic truck replacement');
 independent_new:=(create_provider_vehicle(independent,jsonb_build_object('make','Synthetic','model','Regular replacement','plate','RN-'||left(independent::text,8),'cargo_configuration','Pickup truck','use_basis','PERMISSION'))->>'id')::uuid;
 perform pg_temp.assert_regular(jsonb_array_length(provider_capacity_workspace(independent)->'corridors')=0,'REPLACEMENT_INHERITED_REGULAR_ROUTE');
 perform pg_temp.assert_regular((select to_jsonb(r)=original from profile_routes r where id=independent_route),'REPLACEMENT_REMOVED_REGULAR_HISTORY');
 perform update_fleet_driver_access(independent,jsonb_build_object('driver_user_id',independent,'vehicle_id',independent_new,'can_manage_capacity',true,'can_manage_tracking',true));
 perform pg_temp.denied_regular(format('select remove_provider_regular_capacity(%L,%L,%L,%L)',independent,independent_route,independent_new,independent),'NOT_FOUND');
 -- Retired descriptive Services are preserved even when old clients submit replacement text.
 perform update_provider_profile_page(owner_id,jsonb_build_object('about',about_marker,'services','Replacement must be ignored','published',true,'show_contact_phone',true,'contact_phone','+251900000140'));
 perform pg_temp.assert_regular((select services=marker from company_pages where id=page_id),'LEGACY_SERVICES_OVERWRITTEN');
 perform update_provider_profile_page(owner_id,jsonb_build_object('about',about_marker,'published',true,'show_contact_phone',true,'contact_phone','+251900000140'));
 perform pg_temp.assert_regular((select services=marker from company_pages where id=page_id),'OMITTED_SERVICES_ERASED');
 perform pg_temp.assert_regular(not (public_provider_page_details(org,null) ? 'services'),'PUBLIC_PROFILE_SERVICES_EXPOSED');
 payload:=capacity_search_metadata(jsonb_build_object('vehicle_id',truck_a,'provider_organization_id',org));
 perform pg_temp.assert_regular(not(payload ? 'services') and payload->>'about'=about_marker,'SERVICES_METADATA_OR_ABOUT_WRONG');
 perform pg_temp.assert_regular(not capacity_search_matches(jsonb_build_object('vehicle_id',truck_a,'provider_organization_id',org,'provider_name','Synthetic Regular fleet','provider_handle',handle),jsonb_build_object('q',marker)),'LEGACY_SERVICES_SEARCHABLE');
 perform pg_temp.assert_regular(capacity_search_matches(jsonb_build_object('vehicle_id',truck_a,'provider_organization_id',org,'provider_name','Synthetic Regular fleet','provider_handle',handle),jsonb_build_object('q',about_marker)),'ABOUT_SEARCH_REMOVED');
 for payload in select public_featured_provider_candidates(array[region]) loop
  if payload->>'provider_organization_id'=org::text then
   perform pg_temp.assert_regular(coalesce(payload->>'services','')='' and payload->'regular_signal'='null'::jsonb,'FEATURED_ACCOUNT_SERVICES_OR_ROUTE_EXPOSED');
  end if;
 end loop;
 perform pg_temp.assert_regular((select to_jsonb(r)=legacy_before from profile_routes r where id=legacy),'LEGACY_ROUTE_REBOUND_OR_REMOVED');
 for signature in select unnest(array['public.add_provider_regular_capacity(uuid,jsonb)','public.replace_provider_regular_capacity(uuid,uuid,jsonb)',
 'public.remove_provider_regular_capacity(uuid,uuid,uuid,uuid)','public.regular_capacity_vehicle_scope(uuid,uuid,uuid)','public.featured_truck_regular_signals(uuid[])']) loop
  perform pg_temp.assert_regular(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'REGULAR_BROWSER_RPC_GRANTED');
 end loop;
 perform pg_temp.assert_regular(strpos(pg_get_functiondef('public.capacity_search_metadata(jsonb)'::regprocedure),'capacity_search_metadata_pre_social167')>0
  and strpos(pg_get_functiondef('public.capacity_search_metadata_pre_social167(jsonb)'::regprocedure),'_search_documents_required')>0,'SEARCH130_DOCUMENT_COST_FIX_LOST');
 perform pg_temp.assert_regular(strpos(pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure),'blocked_handles')>0,'SEARCH132_BLOCKLIST_LOST');
 perform pg_temp.assert_regular(strpos(pg_get_functiondef('public.capacity_search_results(jsonb,text,text,uuid,integer)'::regprocedure),'capacity_search_results_pre_retirement159')>0
  and (select 'jit=off'=any(proconfig) from pg_proc where oid='public.capacity_search_results_pre_retirement159(jsonb,text,text,uuid,integer)'::regprocedure),'SEARCH_JIT_CONFIG_LOST');
 raise notice 'PASS: scoped commands, permission/stale-pair denial, projections, legacy Services/routes, document cost and browser ACLs';
end $scope$;
rollback;
