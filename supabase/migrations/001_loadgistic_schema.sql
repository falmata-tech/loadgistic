-- Loadgistic Supabase migration target.
-- The runnable local demo uses Node.js built-in SQLite through a repository adapter.
-- This schema is the PostgreSQL/RLS target for Supabase Cloud or Supabase Local.

create extension if not exists pgcrypto;

create type public.user_role as enum ('ADMIN','SHIPPER','RECEIVER','TRANSPORTER','DRIVER');
create type public.organization_type as enum ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER','TRANSPORT_COMPANY');
create type public.service_mode as enum ('FREIGHT');
create type public.distribution_mode as enum ('DIRECT_TO_PROVIDER','SAVED_PARTNERS','OPEN_MARKET');
create type public.price_mode as enum ('FIXED_PRICE','QUOTE_REQUESTED','TARGET_PRICE');
create type public.tracking_mode as enum ('STATUS_ONLY','LOCATION_AND_STATUS');
create type public.capacity_status as enum ('EMPTY','PARTIAL','OFF_DUTY');
create type public.capacity_visibility as enum ('PRIVATE','SAVED_PARTNERS','DIRECT_TO_SELECTED_BUSINESS','OPEN');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null unique,
  type public.organization_type not null,
  verified boolean not null default false,
  industry text,
  description text,
  phone text,
  email text,
  city text,
  public_visibility text not null default 'PUBLIC',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_role text not null default 'OWNER',
  unique(user_id, organization_id)
);

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null,
  handle text not null unique,
  verified_identity boolean not null default false,
  verified_license boolean not null default false,
  vehicle_documents_verified boolean not null default false,
  vehicle_type text,
  corridors text,
  phone text,
  city text,
  about text,
  public_visibility text not null default 'PUBLIC',
  created_at timestamptz not null default now()
);

create table public.company_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid unique references public.organizations(id) on delete cascade,
  provider_profile_id uuid unique references public.provider_profiles(id) on delete cascade,
  headline text,
  about text,
  services text,
  corridors text,
  contact_phone text,
  contact_email text,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint company_page_owner_check check (
    (organization_id is not null and provider_profile_id is null)
    or (organization_id is null and provider_profile_id is not null)
  )
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  label text not null,
  category text not null,
  make text,
  model text,
  cargo_configuration text,
  plate text,
  active boolean not null default true,
  constraint vehicle_owner_check check (
    (organization_id is not null and provider_profile_id is null)
    or (organization_id is null and provider_profile_id is not null)
  )
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  service_mode public.service_mode not null,
  distribution_mode public.distribution_mode not null,
  price_mode public.price_mode not null,
  price_minor bigint,
  target_price_minor bigint,
  shipper_organization_id uuid not null references public.organizations(id),
  receiver_organization_id uuid references public.organizations(id),
  provider_organization_id uuid references public.organizations(id),
  provider_profile_id uuid references public.provider_profiles(id),
  origin text not null,
  destination text not null,
  cargo_description text not null,
  package_count integer not null default 1 check(package_count > 0),
  estimated_weight numeric,
  vehicle_category text,
  load_type text,
  receiver_first_name text,
  receiver_phone text,
  pickup_date date not null,
  delivery_date date,
  commercial_status text not null,
  operational_status text not null,
  tracking_mode public.tracking_mode not null default 'STATUS_ONLY',
  tracking_token text unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  event_type text not null,
  note text,
  location_area text,
  location_lat numeric,
  location_lng numeric,
  location_precision_km integer,
  location_source text,
  created_by uuid not null references public.profiles(id),
  public boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shipment_interests (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  status text not null default 'INTERESTED',
  note text,
  created_at timestamptz not null default now(),
  constraint interest_provider_check check (
    (provider_organization_id is not null and provider_profile_id is null)
    or (provider_organization_id is null and provider_profile_id is not null)
  )
);

create table public.capacity_updates (
  id uuid primary key default gen_random_uuid(),
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  status public.capacity_status not null,
  available_percent integer not null check(available_percent between 0 and 100),
  origin text,
  destination text,
  corridor text,
  travel_date date,
  next_available text,
  visibility public.capacity_visibility not null,
  photo_storage_path text,
  location_area text,
  location_updated_at timestamptz,
  location_lat numeric,
  location_lng numeric,
  location_precision_km integer,
  location_source text,
  accepts_full_load boolean not null default true,
  accepts_partial_load boolean not null default false,
  open_to_contract_lanes boolean not null default false,
  accepts_multi_stop boolean not null default false,
  proof_recorded_at timestamptz,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint capacity_owner_check check (
    (provider_organization_id is not null and provider_profile_id is null)
    or (provider_organization_id is null and provider_profile_id is not null)
  ),
  constraint capacity_percentage_check check (
    (status = 'EMPTY' and available_percent = 100)
    or (status = 'OFF_DUTY' and available_percent = 0)
    or (status = 'PARTIAL' and available_percent between 1 and 99)
  )
);

create table public.proof_files (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  proof_type text not null check(proof_type in ('LOADING','DELIVERY','ISSUE')),
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  note text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.organization_members m where m.user_id = auth.uid() and m.organization_id = target_org)
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.company_pages enable row level security;
alter table public.vehicles enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.shipment_interests enable row level security;
alter table public.capacity_updates enable row level security;
alter table public.proof_files enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles own read" on public.profiles for select using (id = auth.uid());
create policy "profiles own update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "organizations public verified read" on public.organizations for select using (verified = true and public_visibility = 'PUBLIC' or public.is_org_member(id));
create policy "organization members read membership" on public.organization_members for select using (user_id = auth.uid() or public.is_org_member(organization_id));

create policy "public company pages read" on public.company_pages for select using (published = true or (organization_id is not null and public.is_org_member(organization_id)) or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid()));
create policy "members update company page" on public.company_pages for update using ((organization_id is not null and public.is_org_member(organization_id)) or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid()));

create policy "vehicle owner read" on public.vehicles for select using ((organization_id is not null and public.is_org_member(organization_id)) or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid()));
create policy "vehicle owner manage" on public.vehicles for all using ((organization_id is not null and public.is_org_member(organization_id)) or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid()));

create policy "shipment parties read" on public.shipments for select using (
  public.is_org_member(shipper_organization_id)
  or public.is_org_member(receiver_organization_id)
  or public.is_org_member(provider_organization_id)
  or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid())
  or (service_mode = 'FREIGHT' and operational_status = 'POSTED' and distribution_mode in ('OPEN_MARKET','SAVED_PARTNERS'))
);
create policy "shipper inserts shipment" on public.shipments for insert with check (public.is_org_member(shipper_organization_id) and created_by = auth.uid());
create policy "shipment parties update" on public.shipments for update using (
  public.is_org_member(shipper_organization_id)
  or public.is_org_member(provider_organization_id)
  or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid())
);

create policy "shipment events party read" on public.shipment_events for select using (
  exists(select 1 from public.shipments s where s.id = shipment_id and (
    public.is_org_member(s.shipper_organization_id)
    or public.is_org_member(s.receiver_organization_id)
    or public.is_org_member(s.provider_organization_id)
    or s.provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid())
    or public = true
  ))
);
create policy "shipment party event insert" on public.shipment_events for insert with check (created_by = auth.uid());

create policy "capacity public or owner read" on public.capacity_updates for select using (
  (visibility = 'OPEN' and expires_at > now())
  or (provider_organization_id is not null and public.is_org_member(provider_organization_id))
  or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid())
);
create policy "capacity owner insert" on public.capacity_updates for insert with check (
  updated_by = auth.uid() and (
    (provider_organization_id is not null and public.is_org_member(provider_organization_id))
    or provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid())
  )
);

create policy "proof shipment parties read" on public.proof_files for select using (
  exists(select 1 from public.shipments s where s.id = shipment_id and (
    public.is_org_member(s.shipper_organization_id)
    or public.is_org_member(s.receiver_organization_id)
    or public.is_org_member(s.provider_organization_id)
    or s.provider_profile_id in (select id from public.provider_profiles where user_id = auth.uid())
  ))
);
create policy "proof authorized insert" on public.proof_files for insert with check (uploaded_by = auth.uid());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('shipment-proof','shipment-proof',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
  ('verification','verification',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
  ('capacity-photo','capacity-photo',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
