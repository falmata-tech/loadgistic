-- FEAT-FLT-001 / FEAT-CAP-001 / FEAT-VER-001
-- Driver linkage is a publication prerequisite. Documents are not.
create or replace function public.capacity_active_driver_id(target_vehicle_id uuid)
returns uuid
language sql stable security definer
set search_path=public,pg_temp
as $$
  select driver.id
  from public.vehicles vehicle
  left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
  left join public.driver_vehicle_assignments assignment
    on assignment.vehicle_id=vehicle.id and assignment.active
  join public.profiles driver
    on driver.id=case when vehicle.provider_profile_id is not null
      then provider.user_id else assignment.driver_user_id end
    and driver.active and driver.role='DRIVER'
  where vehicle.id=target_vehicle_id and vehicle.active
    and (vehicle.provider_profile_id is not null or exists(
      select 1 from public.drivers fleet_driver
      join public.organization_members member on member.user_id=fleet_driver.user_id
        and member.organization_id=fleet_driver.organization_id
      where fleet_driver.user_id=driver.id and fleet_driver.active
        and fleet_driver.organization_id=vehicle.organization_id
    ))
  limit 1
$$;
revoke all on function public.capacity_active_driver_id(uuid) from public,anon,authenticated;
grant execute on function public.capacity_active_driver_id(uuid) to service_role;

do $migration$
declare
  definition text;
  signature text;
  old_fragment text;
  new_fragment text;
begin
  for signature,old_fragment,new_fragment in values
    ('public.publish_provider_capacity(uuid,jsonb)',
      'if status_value<>''OFF_DUTY'' and assigned_driver is null',
      'assigned_driver:=public.capacity_active_driver_id(vehicle.id);' || E'\n  ' ||
      'if status_value<>''OFF_DUTY'' and assigned_driver is null'),
    ('public.public_capacity_page(jsonb,timestamptz,uuid,integer)',
      'where capacity.latest_position=1 and vehicle.active',
      'where capacity.latest_position=1 and vehicle.active and public.capacity_active_driver_id(vehicle.id) is not null'),
    ('public.private_capacity_projection(text,text,uuid,timestamptz,uuid,integer)',
      'where capacity.latest_position=1',
      'where capacity.latest_position=1 and public.capacity_active_driver_id(vehicle.id) is not null'),
    ('public.provider_capacity_workspace(uuid)',
      '''platform_number'',vehicle.platform_number,''active'',vehicle.active',
      '''platform_number'',vehicle.platform_number,''active'',vehicle.active,' || E'\n    ' ||
      '''assigned_driver'',(select jsonb_build_object(''id'',driver.id,''name'',driver.full_name)' ||
      ' from public.profiles driver where driver.id=public.capacity_active_driver_id(vehicle.id))'),
    ('public.refresh_provider_capacity_location(uuid,jsonb)',
      'if not found then raise exception ''INVALID_VEHICLE''; end if;',
      'if not found then raise exception ''INVALID_VEHICLE''; end if;' || E'\n  ' ||
      'if public.capacity_active_driver_id(vehicle.id) is distinct from actor_user_id then raise exception ''DRIVER_REQUIRED_FOR_CAPACITY''; end if;'),
    ('public.set_provider_assigned_vehicle_duty(uuid,jsonb)',
      'if not found then raise exception ''INVALID_VEHICLE''; end if;',
      'if not found then raise exception ''INVALID_VEHICLE''; end if;' || E'\n  ' ||
      'if on_duty and public.capacity_active_driver_id(vehicle.id) is distinct from actor_user_id then raise exception ''DRIVER_REQUIRED_FOR_CAPACITY''; end if;')
  loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if position(old_fragment in definition)=0 then
      raise exception 'CAPACITY_DRIVER_CONTRACT_NOT_FOUND: %',signature;
    end if;
    execute replace(definition,old_fragment,new_fragment);
  end loop;
end
$migration$;

comment on function public.capacity_active_driver_id(uuid) is
  'Current active independent Driver or same-fleet assigned Driver; document submission and approval do not gate eligibility.';
