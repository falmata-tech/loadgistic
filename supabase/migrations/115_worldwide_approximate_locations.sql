-- FEAT-CAP-001 / FEAT-MOB-001 / FEAT-TRK-001: worldwide driver fixes.
-- Preserve existing authorization, null/radius checks, history, RLS and ACLs.
-- Catalog place references stay real; an overseas fix may have no nearby town.
alter table public.vehicle_driver_locations
  drop constraint vehicle_driver_locations_latitude_check,
  drop constraint vehicle_driver_locations_longitude_check,
  add constraint vehicle_driver_locations_latitude_check check(latitude between -90 and 90),
  add constraint vehicle_driver_locations_longitude_check check(longitude between -180 and 180),
  alter column place_ref drop not null;

alter table public.capacities drop constraint capacity_device_location_check;
alter table public.capacities add constraint capacity_device_location_check check (
  coalesce(market_status,status::text)='OFF_DUTY' or (
    location_source='DEVICE_OBSCURED' and location_updated_at is not null
    and location_lat is not null and location_lng is not null
    and location_lat between -90 and 90 and location_lng between -180 and 180
    and location_precision_km in (1,3,5,10,20,40)
  )
);

-- Each named function contains exactly one latitude and one longitude guard.
-- Fail on drift instead of copying an obsolete command or rewriting all functions.
do $migration$
declare signature text; definition text; before_lat text:='not between 3 and 15';
  before_lng text:='not between 32 and 49';
begin
  foreach signature in array array[
    'public.publish_provider_capacity(uuid,jsonb)',
    'public.refresh_provider_capacity_location(uuid,jsonb)',
    'public.set_provider_assigned_vehicle_duty(uuid,jsonb)',
    'public.update_provider_tracking_status(uuid,uuid,jsonb)',
    'public.update_provider_tracking_location(uuid,uuid,jsonb)'
  ] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if length(definition)-length(replace(definition,before_lat,''))<>length(before_lat)
      or length(definition)-length(replace(definition,before_lng,''))<>length(before_lng)
    then raise exception 'WORLD_LOCATION_CONTRACT_DRIFT'; end if;
    execute replace(replace(definition,before_lat,'not between -90 and 90'),before_lng,'not between -180 and 180');
  end loop;
end $migration$;

create or replace function public.provider_capacity_nearest_place(point_lat double precision,point_lng double precision)
returns jsonb language sql stable security definer
set search_path=public,extensions,pg_temp
as $$
  select case when point_lat between -90 and 90 and point_lng between -180 and 180
    then coalesce((
      select jsonb_build_object('place_ref',place.id,
        'place_label',concat_ws(', ',place.name,
          case when place.parent_name is not null and lower(place.parent_name)<>lower(place.name) then place.parent_name end,
          place.country_name), 'lat',place.latitude,'lng',place.longitude)
      from public.place_catalog place
      where place.latitude between -90 and 90 and place.longitude between -180 and 180
        and st_dwithin(
          st_setsrid(st_makepoint(place.longitude,place.latitude),4326)::geography,
          st_setsrid(st_makepoint(point_lng,point_lat),4326)::geography,100000)
      order by st_distance(
        st_setsrid(st_makepoint(place.longitude,place.latitude),4326)::geography,
        st_setsrid(st_makepoint(point_lng,point_lat),4326)::geography),place.id
      limit 1
    ),jsonb_build_object('place_ref',null,'place_label','current device area'))
    else null end
$$;
revoke all on function public.provider_capacity_nearest_place(double precision,double precision) from public,anon,authenticated;
grant execute on function public.provider_capacity_nearest_place(double precision,double precision) to service_role;
