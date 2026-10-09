begin;
do $test$
declare actor uuid:=gen_random_uuid();provider uuid:=gen_random_uuid();truck uuid;cap uuid;route jsonb;result jsonb;rows integer;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(actor,'public-policy-synthetic@example.test',now(),'{"full_name":"Synthetic policy driver"}');
 update profiles set role='DRIVER',active=true where id=actor;
 insert into provider_profiles(id,user_id,business_name,handle) values(provider,actor,'Synthetic policy provider','policy-'||actor);
 insert into company_pages(provider_profile_id,published,about) values(provider,true,'Synthetic policy test page');
 perform accept_content_policy(actor,'2026-10-09');
 truck:=(create_provider_vehicle(actor,'{"make":"Policy audit","model":"Synthetic","plate":"POLICY-AUDIT","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform refresh_provider_capacity_location(actor,jsonb_build_object('vehicle_id',truck,'approximate_lat',41.8,'approximate_lng',-87.6,'location_precision_km',20));
 select current_route_points_json into strict route from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 cap:=publish_provider_capacity(actor,jsonb_build_object('vehicle_id',truck,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE','location_source','PRESERVE_DRIVER','current_route_places',route,'sharing_mode','PUBLIC'));
 select count(*) into rows from public_capacity_page(jsonb_build_object('vehicle_ids',jsonb_build_array(truck)),null,null,100);
 if rows<>1 or not capacity_public_policy_allows(truck) then raise exception 'NORMAL_PUBLIC_CAPACITY_LOST';end if;
 update provider_profiles set content_hidden=true where id=provider;
 select count(*) into rows from public_capacity_page(jsonb_build_object('vehicle_ids',jsonb_build_array(truck)),null,null,100);
 if rows<>0 or capacity_public_policy_allows(truck) then raise exception 'MODERATED_MAP_CAPACITY_EXPOSED';end if;
 select count(*) into rows from capacity_search_public_rows(jsonb_build_object('vehicle_ids',jsonb_build_array(truck)),null,null,100);
 if rows<>0 then raise exception 'MODERATED_SEARCH_CAPACITY_EXPOSED';end if;
 update provider_profiles set content_hidden=false,review_workspace=true where id=provider;
 select count(*) into rows from public_capacity_page(jsonb_build_object('vehicle_ids',jsonb_build_array(truck)),null,null,100);
 if rows<>0 then raise exception 'REVIEW_MAP_CAPACITY_EXPOSED';end if;
 update provider_profiles set review_workspace=false where id=provider;
 select count(*) into rows from public_capacity_page(jsonb_build_object('vehicle_ids',jsonb_build_array(truck)),null,null,100);
 if rows<>1 then raise exception 'RESTORED_CAPACITY_LOST';end if;
 if has_function_privilege('anon','public.capacity_public_policy_allows(uuid)','EXECUTE') then raise exception 'BROWSER_POLICY_READ';end if;
 if position('capacity_public_policy_allows(candidate.vehicle_id)' in pg_get_functiondef('public.public_capacity_page(jsonb,timestamp with time zone,uuid,integer)'::regprocedure))>0
 or position('capacity_public_policy_allows(candidate.vehicle_id)' in pg_get_functiondef('public.capacity_search_public_rows(jsonb,timestamp with time zone,uuid,integer)'::regprocedure))>0 then raise exception 'PER_CANDIDATE_POLICY_LOOKUPS';end if;
 raise notice 'Actual public map/search rows deny hidden/demo workspaces and preserve restored ordinary signals';
end $test$;
rollback;
