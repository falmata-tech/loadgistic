-- FEAT-FTR-001: admin-curated, general-base-city daily provider spotlight.

create table if not exists public.featured_provider_days (
  id uuid primary key default gen_random_uuid(),
  feature_date date not null unique,
  base_place_ref text not null references public.place_catalog(id),
  base_place_label text not null,
  tiktok_url text,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED')),
  created_by uuid not null references public.profiles(id),
  published_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.featured_provider_slots (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.featured_provider_days(id) on delete cascade,
  slot_position integer not null check (slot_position between 1 and 15),
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(day_id,slot_position),
  check ((provider_organization_id is not null and provider_profile_id is null) or
         (provider_organization_id is null and provider_profile_id is not null))
);

create unique index if not exists idx_featured_slot_day_org
  on public.featured_provider_slots(day_id,provider_organization_id)
  where provider_organization_id is not null;
create unique index if not exists idx_featured_slot_day_profile
  on public.featured_provider_slots(day_id,provider_profile_id)
  where provider_profile_id is not null;
create index if not exists idx_featured_days_public
  on public.featured_provider_days(feature_date,status);

alter table public.featured_provider_days enable row level security;
alter table public.featured_provider_slots enable row level security;

create policy "admins manage featured days"
  on public.featured_provider_days for all
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'));

comment on table public.featured_provider_days is
  'Admin-only schedule source. Anonymous reads must use the application safe projection, which rechecks current provider eligibility.';
comment on table public.featured_provider_slots is
  'Admin-only ordered roster. Raw slots are not public because a provider can become ineligible after publication.';
create policy "admins manage featured slots"
  on public.featured_provider_slots for all
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'));
