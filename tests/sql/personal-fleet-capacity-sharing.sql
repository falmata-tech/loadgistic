-- Self-contained synthetic actors; every write is rolled back.
begin;
create function pg_temp.sharing180_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'SHARING180_ASSERT:%',label;end if;end$$;
create function pg_temp.sharing180_denied(statement text) returns void language plpgsql as $$
begin
 begin execute statement;exception when raise_exception then
  if sqlerrm in('NOT_FOUND','FORBIDDEN') then return;end if;raise;
 end;
 raise exception 'SHARING180_EXPECTED_DENIAL';
end$$;
do $test$
declare owner_id uuid:=gen_random_uuid();employee uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();
 provider uuid:=gen_random_uuid();foreign_provider uuid:=gen_random_uuid();vehicle uuid;foreign_vehicle uuid;
 access jsonb;command jsonb;route jsonb;mode_value text;before_policy jsonb;before_count integer;result uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (owner_id,owner_id||'@example.test',now(),'{}'),(employee,employee||'@example.test',null,'{}'),
 (outsider,outsider||'@example.test',now(),'{}');
 update profiles set role='DRIVER',active=true where id in(owner_id,outsider);
 insert into provider_profiles(id,user_id,business_name,handle) values
 (provider,owner_id,'Sharing180 provider','sharing180-'||owner_id),
 (foreign_provider,outsider,'Sharing180 other','sharing180-'||outsider);
 perform accept_content_policy(owner_id,'2026-10-09');perform accept_content_policy(outsider,'2026-10-09');
 vehicle:=(create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Sharing180","plate":"SHARING180","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 foreign_vehicle:=(create_provider_vehicle(outsider,'{"make":"Isuzu","model":"Foreign180","plate":"FOREIGN180","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
 perform fleet_register_driver(owner_id,employee,jsonb_build_object('name','Sharing180 employee','email',employee||'@example.test','phone','+251900000001'));
 update auth.users set email_confirmed_at=now() where id=employee;
 perform accept_content_policy(employee,'2026-10-09');
 access:=jsonb_build_object('driver_user_id',employee,'vehicle_id',vehicle,'can_manage_capacity',true,'can_manage_tracking',false);
 perform update_fleet_driver_access(owner_id,access);perform set_provider_vehicle_publication(owner_id,vehicle,'LIVE');
 select jsonb_agg(jsonb_build_object('place_ref',id) order by normalized_name) into route
 from (select distinct on(normalized_name) id,normalized_name from place_catalog
  where normalized_name in('addis ababa','adama') order by normalized_name,id) places;
 perform pg_temp.sharing180_assert(jsonb_array_length(route)=2,'route_fixture');
 command:=jsonb_build_object('vehicle_id',vehicle,'status','EMPTY','accepted_loads','BOTH','availability_geometry','ROUTE',
  'current_route_places',route,'visibility','PRIVATE','location_source','DEVICE_OBSCURED',
  'approximate_lat',9.03,'approximate_lng',38.74,'location_precision_km',10,'sharing_mode','PRIVATE');
 perform pg_temp.sharing180_assert(private_capacity_actor_controls_vehicle(employee,vehicle),'assigned_personal_employee_authorized');
 foreach mode_value in array array['PRIVATE','PUBLIC','BOTH'] loop
  result:=publish_provider_capacity(employee,command||jsonb_build_object('sharing_mode',mode_value));
  perform pg_temp.sharing180_assert(capacity_sharing_mode(vehicle)=mode_value,'saved_sharing_mode');
  perform pg_temp.sharing180_assert(exists(select 1 from capacities where id=result and updated_by=employee
   and visibility::text=case when mode_value in('PUBLIC','BOTH') then 'OPEN' else 'PRIVATE' end),'saved_capacity_and_publisher');
 end loop;
 begin
  perform publish_provider_capacity(employee,command||jsonb_build_object('sharing_mode','EXCLUSIVE',
   'exclusive_email','sharing180-recipient@example.test','exclusive_digest',repeat('a',64),'exclusive_name','Sharing180 customer'));
  raise exception 'RETIRED_EXCLUSIVE_MODE_ALLOWED';
 exception when others then if sqlerrm<>'EMAIL_CAPACITY_RETIRED' then raise;end if;end;
 perform pg_temp.sharing180_assert(private_capacity_actor_controls_vehicle(owner_id,vehicle),'owner_retained');
 perform pg_temp.sharing180_assert(not private_capacity_actor_controls_vehicle(outsider,vehicle),'foreign_owner_denied');
 perform pg_temp.sharing180_assert(not private_capacity_actor_controls_vehicle(employee,foreign_vehicle),'foreign_vehicle_denied');
 before_policy:=(select to_jsonb(s) from vehicle_capacity_sharing s where vehicle_id=vehicle);
 select count(*) into before_count from capacities where vehicle_id=vehicle;
 perform update_fleet_driver_access(owner_id,access||'{"can_manage_capacity":false}');
 perform pg_temp.sharing180_assert(not private_capacity_actor_controls_vehicle(employee,vehicle),'revoked_capacity_permission');
 perform pg_temp.sharing180_denied(format('select set_provider_capacity_sharing(%L,%L,%L)',employee,vehicle,'PUBLIC'));
 perform pg_temp.sharing180_denied(format('select publish_provider_capacity(%L,%L)',employee,command));
 perform update_fleet_driver_access(owner_id,access);
 update profiles set active=false where id=employee;
 perform pg_temp.sharing180_assert(not private_capacity_actor_controls_vehicle(employee,vehicle),'inactive_employee');
 perform pg_temp.sharing180_denied(format('select set_provider_capacity_sharing(%L,%L,%L)',employee,vehicle,'PUBLIC'));
 update profiles set active=true where id=employee;
 update drivers set active=false where user_id=employee and provider_profile_id=provider;
 perform pg_temp.sharing180_assert(not private_capacity_actor_controls_vehicle(employee,vehicle),'ended_membership');
 perform pg_temp.sharing180_denied(format('select set_provider_capacity_sharing(%L,%L,%L)',employee,vehicle,'PUBLIC'));
 update drivers set active=true where user_id=employee and provider_profile_id=provider;
 update driver_vehicle_assignments set active=false where vehicle_id=vehicle and driver_user_id=employee and active;
 perform pg_temp.sharing180_assert(not private_capacity_actor_controls_vehicle(employee,vehicle),'ended_assignment');
 perform pg_temp.sharing180_denied(format('select set_provider_capacity_sharing(%L,%L,%L)',employee,vehicle,'PUBLIC'));
 perform pg_temp.sharing180_assert((select to_jsonb(s)=before_policy from vehicle_capacity_sharing s where vehicle_id=vehicle),'denials_preserve_policy');
 perform pg_temp.sharing180_assert((select count(*)=before_count from capacities where vehicle_id=vehicle),'denials_preserve_capacity');
 perform pg_temp.sharing180_assert(not has_function_privilege('anon','private_capacity_actor_controls_vehicle(uuid,uuid)','execute')
  and not has_function_privilege('authenticated','private_capacity_actor_controls_vehicle(uuid,uuid)','execute')
  and has_function_privilege('service_role','private_capacity_actor_controls_vehicle(uuid,uuid)','execute'),'unchanged_service_boundary');
 raise notice 'PASS: personal employer membership, current assignment, three sharing modes, retired Exclusive denial, permission/activity/assignment revocation, foreign denial and unchanged state/ACL.';
end $test$;
rollback;
