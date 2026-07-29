-- Local-radius freight geography, private local pins, and bounded-board indexes.
-- Exact pickup/drop-off coordinates live in a separate table because row-level
-- shipment marketplace access cannot safely hide individual columns.

create table if not exists public.place_catalog (
  id text primary key,
  name text not null,
  normalized_name text not null,
  alternate_names text,
  place_type text not null,
  latitude double precision not null,
  longitude double precision not null,
  population bigint,
  wikidata_id text,
  osm_type text,
  osm_id text,
  source text not null,
  parent_place_id text,
  parent_name text,
  country_name text not null default 'Ethiopia',
  country_code text not null default 'ET',
  updated_at timestamptz not null default now()
);

create index if not exists place_catalog_name_idx
  on public.place_catalog(normalized_name);
create index if not exists place_catalog_type_name_idx
  on public.place_catalog(place_type,normalized_name);

create table if not exists public.service_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  place_ref text not null references public.place_catalog(id),
  place_label text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km integer not null check(radius_km between 5 and 100),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint service_area_owner_check check (
    (organization_id is not null and provider_profile_id is null)
    or (organization_id is null and provider_profile_id is not null)
  )
);

alter table public.capacity_updates
  add column if not exists movement_scope text not null default 'INTERCITY',
  add column if not exists local_place_ref text references public.place_catalog(id),
  add column if not exists local_place_label text,
  add column if not exists local_center_lat double precision,
  add column if not exists local_center_lng double precision,
  add column if not exists local_radius_km integer,
  add column if not exists current_route_origin text,
  add column if not exists current_route_destination text,
  add column if not exists current_route_date date,
  add column if not exists planned_space_status text,
  add column if not exists accepts_multi_pick boolean not null default false,
  add column if not exists accepts_multi_drop boolean not null default false;

alter table public.shipments
  add column if not exists load_owner_organization_id uuid references public.organizations(id),
  add column if not exists load_owner_party_role text,
  add column if not exists movement_scope text not null default 'INTERCITY',
  add column if not exists local_place_ref text references public.place_catalog(id),
  add column if not exists local_place_label text,
  add column if not exists local_center_lat double precision,
  add column if not exists local_center_lng double precision,
  add column if not exists pickup_area_label text,
  add column if not exists dropoff_area_label text;

update public.shipments
set load_owner_organization_id=coalesce(load_owner_organization_id,shipper_organization_id),
    load_owner_party_role=coalesce(load_owner_party_role,'SHIPPER'),
    movement_scope=coalesce(movement_scope,'INTERCITY');

do $$
begin
  if not exists (select 1 from pg_constraint where conname='capacity_movement_scope_check') then
    alter table public.capacity_updates add constraint capacity_movement_scope_check
      check(movement_scope in ('LOCAL','INTERCITY','BOTH'));
  end if;
  if not exists (select 1 from pg_constraint where conname='capacity_local_radius_check') then
    alter table public.capacity_updates add constraint capacity_local_radius_check
      check(local_radius_km is null or local_radius_km between 5 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='shipment_movement_scope_check') then
    alter table public.shipments add constraint shipment_movement_scope_check
      check(movement_scope in ('LOCAL','INTERCITY'));
  end if;
  if not exists (select 1 from pg_constraint where conname='shipment_owner_party_role_check') then
    alter table public.shipments add constraint shipment_owner_party_role_check
      check(load_owner_party_role in ('SHIPPER','RECEIVER'));
  end if;
end $$;

create table if not exists public.shipment_private_points (
  shipment_id uuid primary key references public.shipments(id) on delete cascade,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  updated_at timestamptz not null default now(),
  constraint pickup_point_pair check((pickup_lat is null)=(pickup_lng is null)),
  constraint dropoff_point_pair check((dropoff_lat is null)=(dropoff_lng is null))
);

create index if not exists service_areas_organization_idx on public.service_areas(organization_id);
create index if not exists service_areas_provider_idx on public.service_areas(provider_profile_id);
create index if not exists service_areas_place_idx on public.service_areas(place_ref);
create index if not exists capacity_market_idx
  on public.capacity_updates(visibility,status,expires_at,movement_scope);
create index if not exists capacity_local_place_idx
  on public.capacity_updates(local_place_ref,movement_scope,expires_at);
create index if not exists capacity_owner_org_idx
  on public.capacity_updates(provider_organization_id,updated_at desc);
create index if not exists capacity_owner_profile_idx
  on public.capacity_updates(provider_profile_id,updated_at desc);
create index if not exists shipment_board_idx
  on public.shipments(operational_status,movement_scope,created_at desc);
create index if not exists shipment_local_place_idx
  on public.shipments(local_place_ref,movement_scope,operational_status);
create index if not exists shipment_owner_idx
  on public.shipments(load_owner_organization_id,updated_at desc);
create index if not exists shipment_interest_provider_idx
  on public.shipment_interests(shipment_id,provider_organization_id,provider_profile_id);

alter table public.place_catalog enable row level security;
alter table public.service_areas enable row level security;
alter table public.shipment_private_points enable row level security;

create policy "authenticated place catalog read"
on public.place_catalog for select using(auth.uid() is not null);

create policy "authenticated service areas read"
on public.service_areas for select using(auth.uid() is not null);
create policy "service area owners manage"
on public.service_areas for all using(
  (organization_id is not null and public.is_org_owner(organization_id))
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
) with check(
  created_by=auth.uid() and (
    (organization_id is not null and public.is_org_owner(organization_id))
    or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
  )
);

create policy "shipment owner inserts private points"
on public.shipment_private_points for insert with check(
  exists(
    select 1 from public.shipments s
    where s.id=shipment_id
      and public.is_org_member(coalesce(s.load_owner_organization_id,s.shipper_organization_id))
  )
);
create policy "shipment parties read private points after agreement"
on public.shipment_private_points for select using(
  exists(
    select 1 from public.shipments s
    where s.id=shipment_id and (
      public.is_org_member(coalesce(s.load_owner_organization_id,s.shipper_organization_id))
      or (
        s.operational_status in ('AGREED','ASSIGNED','IN_TRANSIT','ON_HOLD','ISSUE','DELIVERED','COMPLETED')
        and (
          public.is_org_member(s.shipper_organization_id)
          or public.is_org_member(s.receiver_organization_id)
          or public.is_org_member(s.provider_organization_id)
          or s.provider_profile_id in (
            select id from public.provider_profiles where user_id=auth.uid()
          )
        )
      )
    )
  )
);
