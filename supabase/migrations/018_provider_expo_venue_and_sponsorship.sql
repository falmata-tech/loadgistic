-- FEAT-FTR-001 / FEAT-SPN-001: admin-managed featured presentation and sponsorship.

alter table public.featured_provider_days
  add column if not exists public_headline text,
  add column if not exists public_introduction text;

alter table public.featured_provider_days
  add constraint featured_provider_days_public_headline_length
    check (public_headline is null or char_length(public_headline) between 3 and 90),
  add constraint featured_provider_days_public_introduction_length
    check (public_introduction is null or char_length(public_introduction) between 10 and 240);

create table if not exists public.provider_sponsorships (
  id uuid primary key default gen_random_uuid(),
  expo_group_key text not null,
  starts_on date not null,
  ends_on date not null,
  position integer not null check (position between 1 and 5),
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on<=ends_on),
  check ((provider_organization_id is not null and provider_profile_id is null) or
         (provider_organization_id is null and provider_profile_id is not null))
);

create index if not exists idx_provider_sponsorships_public
  on public.provider_sponsorships(expo_group_key,active,starts_on,ends_on,position);

alter table public.provider_sponsorships enable row level security;

create policy "admins manage provider sponsorships"
  on public.provider_sponsorships for all
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'));

comment on table public.provider_sponsorships is
  'Admin-only sponsorship schedules. Anonymous reads must use the bounded safe projection and recheck provider eligibility.';
