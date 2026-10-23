begin;
do $test$
declare owner_id uuid; driver_id uuid:=gen_random_uuid(); other_driver uuid; org_id uuid; truck_id uuid; other_truck_id uuid; baseline_capacity_count bigint; row jsonb; saved_id uuid; route_points jsonb; command jsonb; before_time timestamptz; role_name text; missing_field text;
begin
 select member.user_id,member.organization_id into strict owner_id,org_id
 from organization_members member join profiles p on p.id=member.user_id and p.active and p.role='TRANSPORTER'
 join auth.users identity on identity.id=p.id and identity.deleted_at is null and identity.email_confirmed_at is not null
 join organizations organization on organization.id=member.organization_id and organization.type='TRANSPORT_COMPANY'
 join lateral provider_capacity_actor_scope(member.user_id) a on a.workspace_access
 where member.membership_role='OWNER' limit 1;
 perform accept_content_policy(owner_id,'2026-10-09');
 -- Exercise the real employee workflow without moving a seeded Tracking driver.
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values(driver_id,'bootstrap-driver-'||driver_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}');
 perform fleet_accept_invitation(driver_id,fleet_invite_driver(owner_id,jsonb_build_object('email','bootstrap-driver-'||driver_id||'@loadgistic.local','name','Synthetic location driver','phone','+251900000001')));
 perform accept_content_policy(driver_id,'2026-10-09');
 select id into strict other_driver from profiles where role='DRIVER' and active and id<>driver_id limit 1;
 row:=create_provider_vehicle(owner_id,'{"make":"Location audit","model":"New truck","plate":"AUDIT-LOCATION","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}');truck_id:=(row->>'id')::uuid;
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',false,'can_manage_tracking',false));
 -- Assignment creates an OFF_DUTY snapshot; GPS must not publish another signal.
 select count(*) into baseline_capacity_count from capacities where vehicle_id=truck_id;
 command:=jsonb_build_object('vehicle_id',truck_id,'approximate_lat',9.03,'approximate_lng',38.76,'location_precision_km',20,'location_source','DEVICE_OBSCURED');
 begin perform refresh_provider_capacity_location(owner_id,command);raise exception 'OWNER_DEVICE_ACCEPTED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform refresh_provider_capacity_location(other_driver,command);raise exception 'FOREIGN_DRIVER_ACCEPTED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform refresh_provider_capacity_location(driver_id,command-'approximate_lat');raise exception 'MISSING_COORDINATE_ACCEPTED';exception when raise_exception then if sqlerrm<>'INVALID_APPROXIMATE_LOCATION' then raise;end if;end;
 row:=refresh_provider_capacity_location(driver_id,command);
 if (select count(*) from capacities where vehicle_id=truck_id)<>baseline_capacity_count
  or exists(select 1 from capacities where vehicle_id=truck_id and market_status in ('EMPTY','PARTIAL')) then raise exception 'LOCATION_PUBLISHED_CAPACITY';end if;
 if not exists(select 1 from vehicle_driver_locations where vehicle_id=truck_id and driver_user_id=driver_id) then raise exception 'BOOTSTRAP_NOT_SAVED';end if;
 if not exists(select 1 from jsonb_array_elements(provider_capacity_workspace(owner_id)->'vehicles') v where v->>'id'=truck_id::text and v->'driver_location'->>'radius'='20') then raise exception 'OWNER_CANNOT_SEE_FIRST_LOCATION';end if;
 begin perform publish_provider_capacity(driver_id,jsonb_build_object('vehicle_id',truck_id,'status','OFF_DUTY'));raise exception 'CAPACITY_PERMISSION_ESCALATED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 select current_route_points_json into strict route_points from capacities where availability_geometry='ROUTE' and jsonb_array_length(current_route_points_json)>=2 limit 1;
 -- Bootstrap above is allowed on Draft. Availability needs explicit Go Live.
 if (managed_provider_publication_eligibility(owner_id)->>'qualifyingTruckCount')::integer=0 then
  for other_truck_id in select id from vehicles
   where organization_id=org_id and active and publication_status='LIVE' and id<>truck_id loop
   perform set_provider_vehicle_publication(owner_id,other_truck_id,'DRAFT');
  end loop;
 end if;
 perform set_provider_vehicle_publication(owner_id,truck_id,'LIVE');
 saved_id:=publish_provider_capacity(owner_id,jsonb_build_object('vehicle_id',truck_id,'status','EMPTY','availability_geometry','ROUTE','visibility','PRIVATE','accepted_loads','FTL','current_route_places',route_points,'location_source','PRESERVE_DRIVER'));
 select updated_at into before_time from capacities where id=saved_id;
 perform refresh_provider_capacity_location(driver_id,command||'{"approximate_lat":9.5,"approximate_lng":39.0}');
 if not exists(select 1 from capacities where id=saved_id and updated_at=before_time and visibility='PRIVATE' and market_status='EMPTY' and location_lat=9.5) then raise exception 'LOCATION_CHANGED_CAPACITY_OR_NOT_UPDATED';end if;
 perform set_provider_assigned_vehicle_duty(driver_id,jsonb_build_object('vehicle_id',truck_id,'on_duty',false));
 if not exists(select 1 from jsonb_array_elements(provider_capacity_workspace(driver_id)->'vehicles') v where v->>'id'=truck_id::text and (v->>'duty_configuration_available')::boolean) then raise exception 'OFF_DUTY_LOST_OWNER_SETUP';end if;
 foreach missing_field in array array['approximate_lat','approximate_lng','location_precision_km','location_source'] loop
  begin perform set_provider_assigned_vehicle_duty(driver_id,(command||'{"on_duty":true}')-missing_field);raise exception 'INCOMPLETE_DUTY_GPS_ACCEPTED';exception when raise_exception then if sqlerrm<>(case when missing_field='location_precision_km' then 'INVALID_LOCATION_PRIVACY' else 'INVALID_APPROXIMATE_LOCATION' end) then raise;end if;end;
 end loop;
 update driver_permissions set can_manage_capacity=true where user_id=driver_id;
 foreach missing_field in array array['approximate_lat','approximate_lng','location_precision_km','location_source'] loop
  begin perform publish_provider_capacity(driver_id,(command||jsonb_build_object('status','EMPTY','availability_geometry','ROUTE','visibility','PRIVATE','accepted_loads','FTL','current_route_places',route_points))-missing_field);raise exception 'INCOMPLETE_PUBLISH_GPS_ACCEPTED';exception when raise_exception then if sqlerrm<>(case when missing_field='location_precision_km' then 'INVALID_LOCATION_PRIVACY' else 'INVALID_APPROXIMATE_LOCATION' end) then raise;end if;end;
 end loop;
 update driver_permissions set can_manage_capacity=false where user_id=driver_id;
 update vehicles set active=false where id=truck_id;
 begin perform refresh_provider_capacity_location(driver_id,command);raise exception 'RETIRED_TRUCK_ACCEPTED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 update vehicles set active=true where id=truck_id;
 perform set_provider_assigned_vehicle_duty(driver_id,command||'{"on_duty":true}');
 perform update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id','','can_manage_capacity',false,'can_manage_tracking',false));
 begin perform refresh_provider_capacity_location(driver_id,command);raise exception 'UNASSIGNED_DRIVER_ACCEPTED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 if exists(select 1 from jsonb_array_elements(provider_capacity_workspace(owner_id)->'vehicles') v where v->>'id'=truck_id::text and v->'driver_location'<>'null'::jsonb) then raise exception 'FORMER_DRIVER_LOCATION_EXPOSED';end if;
 foreach role_name in array array['anon','authenticated'] loop
  if has_table_privilege(role_name,'public.vehicle_driver_locations','SELECT') or has_function_privilege(role_name,'public.refresh_provider_capacity_location(uuid,jsonb)','EXECUTE') then raise exception 'BROWSER_LOCATION_ACCESS';end if;
 end loop;
 if not (select relrowsecurity from pg_class where oid='public.vehicle_driver_locations'::regclass) then raise exception 'LOCATION_RLS_MISSING';end if;
end $test$;
rollback;
