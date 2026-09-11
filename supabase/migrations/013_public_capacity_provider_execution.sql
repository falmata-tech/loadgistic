-- Cloud target for public capacity signals, provider microsites, and provider-owned guest execution.
-- Private execution tables intentionally have RLS enabled without browser policies;
-- the future server repository must authorize every command and return safe projections.

alter table public.company_pages
  add column if not exists theme_primary text,
  add column if not exists theme_accent text,
  add column if not exists contact_whatsapp text,
  add column if not exists contact_website text,
  add column if not exists show_contact_phone boolean not null default false,
  add column if not exists show_contact_whatsapp boolean not null default false,
  add column if not exists show_contact_email boolean not null default false,
  add column if not exists show_contact_website boolean not null default false,
  add column if not exists youtube_video_id text;

alter table public.vehicles
  add column if not exists platform_number text;

create unique index if not exists vehicles_platform_number_unique
  on public.vehicles(platform_number) where platform_number is not null;

create table if not exists public.next_trips (
  id uuid primary key default gen_random_uuid(),
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  vehicle_id uuid not null unique references public.vehicles(id) on delete cascade,
  origin text not null,
  origin_place_ref text not null references public.place_catalog(id),
  origin_lat double precision not null check(origin_lat between 3 and 15),
  origin_lng double precision not null check(origin_lng between 32 and 49),
  destination text not null,
  destination_place_ref text not null references public.place_catalog(id),
  destination_lat double precision not null check(destination_lat between 3 and 15),
  destination_lng double precision not null check(destination_lng between 32 and 49),
  travel_date date,
  space_status text not null check(space_status in ('EMPTY','PARTIAL')),
  available_percent integer not null check(available_percent between 5 and 100),
  published boolean not null default true,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint next_trip_owner_check check(
    (provider_organization_id is not null and provider_profile_id is null)
    or (provider_organization_id is null and provider_profile_id is not null)
  )
);

create index if not exists next_trips_public_idx
  on public.next_trips(published,travel_date,updated_at desc);

create table if not exists public.recurring_service_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  place_ref text not null references public.place_catalog(id),
  place_label text not null,
  center_lat double precision not null check(center_lat between 3 and 15),
  center_lng double precision not null check(center_lng between 32 and 49),
  radius_km integer not null check(radius_km between 5 and 500),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint recurring_service_area_owner_check check(
    (organization_id is not null and provider_profile_id is null)
    or (organization_id is null and provider_profile_id is not null)
  )
);

create index if not exists recurring_service_areas_organization_idx
  on public.recurring_service_areas(organization_id,created_at desc);
create index if not exists recurring_service_areas_profile_idx
  on public.recurring_service_areas(provider_profile_id,created_at desc);

create table if not exists public.provider_shipments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  assigned_vehicle_id uuid not null references public.vehicles(id),
  assigned_driver_user_id uuid not null references public.profiles(id),
  origin text not null,
  origin_place_ref text not null references public.place_catalog(id),
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination text not null,
  destination_place_ref text not null references public.place_catalog(id),
  destination_lat double precision not null,
  destination_lng double precision not null,
  cargo_summary text not null check(length(cargo_summary) between 1 and 500),
  shipper_email text not null,
  receiver_email text not null,
  expected_pickup_date date,
  expected_delivery_date date,
  tracking_mode public.tracking_mode not null default 'STATUS_ONLY',
  operational_status text not null check(operational_status in ('CREATED','LOADING','IN_TRANSIT','UNLOADING','COMPLETED','ISSUE')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  guest_expires_at timestamptz,
  constraint provider_shipment_owner_check check(
    (provider_organization_id is not null and provider_profile_id is null)
    or (provider_organization_id is null and provider_profile_id is not null)
  )
);

create index if not exists provider_shipments_owner_idx
  on public.provider_shipments(provider_organization_id,provider_profile_id,updated_at desc);
create index if not exists provider_shipments_guest_expiry_idx
  on public.provider_shipments(guest_expires_at,operational_status);

create table if not exists public.provider_shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
  status text not null,
  note text,
  proof_storage_path text,
  proof_original_name text,
  proof_mime_type text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists provider_shipment_events_order_idx
  on public.provider_shipment_events(shipment_id,created_at,id);

create table if not exists public.shipment_party_grants (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
  party_role text not null check(party_role in ('SHIPPER','RECEIVER')),
  code_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(shipment_id,party_role)
);

create index if not exists shipment_party_grants_expiry_idx
  on public.shipment_party_grants(expires_at,revoked_at);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
  party_role text not null check(party_role in ('SHIPPER','RECEIVER')),
  delivery_kind text not null check(delivery_kind in ('TRACKING_ACCESS','COMPLETION')),
  recipient_email text not null,
  idempotency_key text not null unique,
  status text not null check(status in ('PENDING','SENT','FAILED')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_deliveries_retry_idx
  on public.email_deliveries(status,next_attempt_at,created_at);

create table if not exists public.provider_reviews (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null unique references public.provider_shipments(id) on delete cascade,
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  note text,
  status text not null default 'PUBLISHED' check(status in ('PUBLISHED','REMOVED')),
  dispute_status text not null default 'NONE' check(dispute_status in ('NONE','PENDING','UPHELD','REMOVED')),
  dispute_reason text,
  disputed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_review_owner_check check(
    (provider_organization_id is not null and provider_profile_id is null)
    or (provider_organization_id is null and provider_profile_id is not null)
  )
);

create index if not exists provider_reviews_public_idx
  on public.provider_reviews(provider_organization_id,provider_profile_id,status,created_at desc);
create index if not exists provider_reviews_dispute_idx
  on public.provider_reviews(dispute_status,created_at);

alter table public.next_trips enable row level security;
alter table public.recurring_service_areas enable row level security;
alter table public.provider_shipments enable row level security;
alter table public.provider_shipment_events enable row level security;
alter table public.shipment_party_grants enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.provider_reviews enable row level security;

comment on table public.shipment_party_grants is
  'Only code digests are stored. Raw shipper and receiver codes are shown once by the server adapter.';
comment on table public.email_deliveries is
  'Private server-owned retry queue; never expose recipient email through a public projection.';
