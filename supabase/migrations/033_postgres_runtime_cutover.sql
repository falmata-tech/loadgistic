-- BASE-BE-001 / BASE-DEP-001: repair the Driver duty RPC after the
-- capacity_updates -> capacities relation normalization in migration 021.

create or replace function public.set_assigned_vehicle_duty(target_vehicle uuid,on_duty boolean)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  source public.capacities%rowtype;
  vehicle_owner uuid;
  created_id uuid:=gen_random_uuid();
begin
  select v.organization_id into vehicle_owner
  from public.vehicles v
  join public.driver_vehicle_assignments a on a.vehicle_id=v.id and a.active
  where v.id=target_vehicle and v.active and a.driver_user_id=auth.uid();

  if vehicle_owner is null then
    raise exception 'INVALID_VEHICLE';
  end if;

  if on_duty then
    select c.* into source
    from public.capacities c
    join public.profiles actor on actor.id=c.updated_by and actor.role='TRANSPORTER'
    where c.vehicle_id=target_vehicle and c.status in ('EMPTY','PARTIAL')
    order by c.updated_at desc limit 1;
  else
    select c.* into source
    from public.capacities c
    where c.vehicle_id=target_vehicle
    order by c.updated_at desc limit 1;
  end if;

  if source.id is null then
    raise exception 'CAPACITY_CONFIGURATION_REQUIRED';
  end if;

  update public.capacities set expires_at=now()
  where vehicle_id=target_vehicle and expires_at>now();

  insert into public.capacities (
    id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,
    origin,destination,corridor,travel_date,next_available,visibility,photo_storage_path,
    location_area,location_updated_at,location_lat,location_lng,location_precision_km,
    location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,
    accepts_multi_stop,proof_recorded_at,updated_by,updated_at,expires_at
  ) values (
    created_id,vehicle_owner,null,target_vehicle,
    case when on_duty then source.status else 'OFF_DUTY'::public.capacity_status end,
    case when on_duty then source.available_percent else 0 end,
    source.origin,source.destination,source.corridor,source.travel_date,source.next_available,
    source.visibility,null,
    case when on_duty then source.location_area else null end,
    case when on_duty then now() else null end,
    case when on_duty then source.location_lat else null end,
    case when on_duty then source.location_lng else null end,
    case when on_duty then source.location_precision_km else null end,
    case when on_duty then source.location_source else null end,
    case when on_duty then source.accepts_full_load else false end,
    case when on_duty then source.accepts_partial_load else false end,
    case when on_duty then source.open_to_contract_lanes else false end,
    case when on_duty then source.accepts_multi_stop else false end,
    null,auth.uid(),now(),now()+interval '24 hours'
  );
  return created_id;
end;
$$;

revoke all on function public.set_assigned_vehicle_duty(uuid,boolean) from public,anon;
grant execute on function public.set_assigned_vehicle_duty(uuid,boolean) to authenticated,service_role;
