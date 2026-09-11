-- Replace the pre-customer maximum-two route fixture with one provider-level
-- regular-service signal. A signal may be a structured Service area or a
-- multi-city two-way Capacity route.

alter table public.profile_routes add column if not exists geometry text not null default 'ROUTE';
alter table public.profile_routes add column if not exists area_center_place_ref text;
alter table public.profile_routes add column if not exists area_center_label text;
alter table public.profile_routes add column if not exists area_center_lat double precision;
alter table public.profile_routes add column if not exists area_center_lng double precision;
alter table public.profile_routes add column if not exists area_boundary_json jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profile_routes'::regclass and conname='profile_routes_geometry_check'
  ) then
    alter table public.profile_routes add constraint profile_routes_geometry_check check (geometry in ('ROUTE','RADIUS'));
  end if;
end;
$$;

delete from public.profile_routes
where id in (
  select id from (
    select id,row_number() over (
      partition by coalesce('org:' || organization_id::text,'profile:' || provider_profile_id::text)
      order by created_at desc,id desc
    ) as position
    from public.profile_routes
  ) ranked where position>1
);

-- All current rows are synthetic. Rebuild the retained signal from one of the
-- provider's own current truck geometries so its route begins near the truck or
-- its Service area contains that truck's published approximate location.
with representative_capacity as (
  select distinct on (coalesce('org:' || capacity.provider_organization_id::text,'profile:' || capacity.provider_profile_id::text))
    coalesce('org:' || capacity.provider_organization_id::text,'profile:' || capacity.provider_profile_id::text) as owner_key,
    capacity.*
  from public.capacities capacity
  where capacity.availability_geometry in ('ROUTE','RADIUS')
    and (capacity.provider_organization_id is not null or capacity.provider_profile_id is not null)
  order by owner_key,capacity.updated_at desc,capacity.id desc
), replacement as (
  select route.id as route_id,capacity.availability_geometry,capacity.current_route_points_json,
    capacity.current_route_origin,capacity.current_route_destination,capacity.current_origin_place_ref,
    capacity.current_origin_lat,capacity.current_origin_lng,capacity.current_destination_place_ref,
    capacity.current_destination_lat,capacity.current_destination_lng,capacity.capacity_area_center_place_ref,
    capacity.capacity_area_center_label,capacity.capacity_area_center_lat,capacity.capacity_area_center_lng,
    capacity.capacity_area_boundary_json
  from public.profile_routes route
  join representative_capacity capacity
    on capacity.owner_key=coalesce('org:' || route.organization_id::text,'profile:' || route.provider_profile_id::text)
)
update public.profile_routes route set
  geometry=replacement.availability_geometry,
  route_points_json=case when replacement.availability_geometry='ROUTE' then replacement.current_route_points_json else '[]'::jsonb end,
  origin=case when replacement.availability_geometry='ROUTE' then replacement.current_route_origin else replacement.capacity_area_center_label end,
  destination=case when replacement.availability_geometry='ROUTE' then replacement.current_route_destination else replacement.capacity_area_center_label end,
  origin_place_ref=case when replacement.availability_geometry='ROUTE' then replacement.current_origin_place_ref else replacement.capacity_area_center_place_ref end,
  origin_lat=case when replacement.availability_geometry='ROUTE' then replacement.current_origin_lat else replacement.capacity_area_center_lat end,
  origin_lng=case when replacement.availability_geometry='ROUTE' then replacement.current_origin_lng else replacement.capacity_area_center_lng end,
  destination_place_ref=case when replacement.availability_geometry='ROUTE' then replacement.current_destination_place_ref else replacement.capacity_area_center_place_ref end,
  destination_lat=case when replacement.availability_geometry='ROUTE' then replacement.current_destination_lat else replacement.capacity_area_center_lat end,
  destination_lng=case when replacement.availability_geometry='ROUTE' then replacement.current_destination_lng else replacement.capacity_area_center_lng end,
  area_center_place_ref=case when replacement.availability_geometry='RADIUS' then replacement.capacity_area_center_place_ref end,
  area_center_label=case when replacement.availability_geometry='RADIUS' then replacement.capacity_area_center_label end,
  area_center_lat=case when replacement.availability_geometry='RADIUS' then replacement.capacity_area_center_lat end,
  area_center_lng=case when replacement.availability_geometry='RADIUS' then replacement.capacity_area_center_lng end,
  area_boundary_json=case when replacement.availability_geometry='RADIUS' then replacement.capacity_area_boundary_json else '[]'::jsonb end
from replacement where route.id=replacement.route_id;

create index if not exists profile_routes_area_boundary_gin on public.profile_routes using gin(area_boundary_json);

create or replace function public.enforce_regular_corridor_limit()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if (
    select count(*) from public.profile_routes route
    where (new.organization_id is not null and route.organization_id=new.organization_id)
       or (new.provider_profile_id is not null and route.provider_profile_id=new.provider_profile_id)
  )>=1 then
    raise exception 'REGULAR_CAPACITY_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_routes_max_two on public.profile_routes;
drop trigger if exists profile_routes_max_one on public.profile_routes;
create trigger profile_routes_max_one
before insert on public.profile_routes
for each row execute function public.enforce_regular_corridor_limit();
