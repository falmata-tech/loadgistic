-- Coordinate-authoritative intercity matching and indexed proximity discovery.

create extension if not exists postgis;

alter table public.organizations
  add column if not exists city_place_ref text references public.place_catalog(id),
  add column if not exists city_lat double precision,
  add column if not exists city_lng double precision,
  add column if not exists city_geog geography(Point,4326)
    generated always as (
      case when city_lat is null or city_lng is null then null
      else st_setsrid(st_makepoint(city_lng,city_lat),4326)::geography end
    ) stored;

alter table public.provider_profiles
  add column if not exists city_place_ref text references public.place_catalog(id),
  add column if not exists city_lat double precision,
  add column if not exists city_lng double precision,
  add column if not exists city_geog geography(Point,4326)
    generated always as (
      case when city_lat is null or city_lng is null then null
      else st_setsrid(st_makepoint(city_lng,city_lat),4326)::geography end
    ) stored;

alter table public.profile_routes
  add column if not exists origin_place_ref text references public.place_catalog(id),
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_place_ref text references public.place_catalog(id),
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision,
  add column if not exists origin_geog geography(Point,4326)
    generated always as (
      case when origin_lat is null or origin_lng is null then null
      else st_setsrid(st_makepoint(origin_lng,origin_lat),4326)::geography end
    ) stored,
  add column if not exists destination_geog geography(Point,4326)
    generated always as (
      case when destination_lat is null or destination_lng is null then null
      else st_setsrid(st_makepoint(destination_lng,destination_lat),4326)::geography end
    ) stored;

alter table public.shipments
  add column if not exists origin_place_ref text references public.place_catalog(id),
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_place_ref text references public.place_catalog(id),
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision,
  add column if not exists origin_geog geography(Point,4326)
    generated always as (
      case when origin_lat is null or origin_lng is null then null
      else st_setsrid(st_makepoint(origin_lng,origin_lat),4326)::geography end
    ) stored,
  add column if not exists destination_geog geography(Point,4326)
    generated always as (
      case when destination_lat is null or destination_lng is null then null
      else st_setsrid(st_makepoint(destination_lng,destination_lat),4326)::geography end
    ) stored;

alter table public.capacity_updates
  add column if not exists origin_place_ref text references public.place_catalog(id),
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_place_ref text references public.place_catalog(id),
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision,
  add column if not exists current_origin_place_ref text references public.place_catalog(id),
  add column if not exists current_origin_lat double precision,
  add column if not exists current_origin_lng double precision,
  add column if not exists current_destination_place_ref text references public.place_catalog(id),
  add column if not exists current_destination_lat double precision,
  add column if not exists current_destination_lng double precision,
  add column if not exists location_place_ref text references public.place_catalog(id),
  add column if not exists origin_geog geography(Point,4326)
    generated always as (
      case when origin_lat is null or origin_lng is null then null
      else st_setsrid(st_makepoint(origin_lng,origin_lat),4326)::geography end
    ) stored,
  add column if not exists destination_geog geography(Point,4326)
    generated always as (
      case when destination_lat is null or destination_lng is null then null
      else st_setsrid(st_makepoint(destination_lng,destination_lat),4326)::geography end
    ) stored,
  add column if not exists current_origin_geog geography(Point,4326)
    generated always as (
      case when current_origin_lat is null or current_origin_lng is null then null
      else st_setsrid(st_makepoint(current_origin_lng,current_origin_lat),4326)::geography end
    ) stored,
  add column if not exists current_destination_geog geography(Point,4326)
    generated always as (
      case when current_destination_lat is null or current_destination_lng is null then null
      else st_setsrid(st_makepoint(current_destination_lng,current_destination_lat),4326)::geography end
    ) stored,
  add column if not exists location_geog geography(Point,4326)
    generated always as (
      case when location_lat is null or location_lng is null then null
      else st_setsrid(st_makepoint(location_lng,location_lat),4326)::geography end
    ) stored;

update public.capacity_updates
set status = case when status = 'PARTIAL' then 'EMPTY' else status end,
    available_percent = case when status = 'PARTIAL' then 100 else available_percent end,
    origin = null,
    destination = null,
    corridor = null,
    travel_date = null,
    planned_space_status = null,
    current_route_origin = null,
    current_route_destination = null,
    current_route_date = null,
    origin_place_ref = null,
    origin_lat = null,
    origin_lng = null,
    destination_place_ref = null,
    destination_lat = null,
    destination_lng = null,
    current_origin_place_ref = null,
    current_origin_lat = null,
    current_origin_lng = null,
    current_destination_place_ref = null,
    current_destination_lat = null,
    current_destination_lng = null,
    location_place_ref = null,
    location_lat = null,
    location_lng = null,
    location_precision_km = null,
    location_source = case when status = 'OFF_DUTY' then null else 'MANUAL_GENERAL_AREA' end
where movement_scope = 'LOCAL';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='capacity_local_status_check') then
    alter table public.capacity_updates add constraint capacity_local_status_check
      check(movement_scope <> 'LOCAL' or status in ('EMPTY','OFF_DUTY'));
  end if;
end
$$;

create index if not exists organizations_city_geog_idx on public.organizations using gist(city_geog);
create index if not exists provider_profiles_city_geog_idx on public.provider_profiles using gist(city_geog);
create index if not exists profile_routes_origin_geog_idx on public.profile_routes using gist(origin_geog);
create index if not exists profile_routes_destination_geog_idx on public.profile_routes using gist(destination_geog);
create index if not exists shipments_origin_geog_idx on public.shipments using gist(origin_geog);
create index if not exists shipments_destination_geog_idx on public.shipments using gist(destination_geog);
create index if not exists capacity_origin_geog_idx on public.capacity_updates using gist(origin_geog);
create index if not exists capacity_destination_geog_idx on public.capacity_updates using gist(destination_geog);
create index if not exists capacity_current_origin_geog_idx on public.capacity_updates using gist(current_origin_geog);
create index if not exists capacity_current_destination_geog_idx on public.capacity_updates using gist(current_destination_geog);
create index if not exists capacity_location_geog_idx on public.capacity_updates using gist(location_geog);
