-- FEAT-SPN-001: one administrator-managed sponsor catalogue for transporters
-- and bounded outside advertisements, with dated regional placements.

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  sponsor_kind text not null check (sponsor_kind in ('TRANSPORTER','ADVERTISER')),
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  business_name text,
  description text,
  website_url text,
  phone text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (sponsor_kind='TRANSPORTER' and
      ((provider_organization_id is not null and provider_profile_id is null) or
       (provider_organization_id is null and provider_profile_id is not null)) and
      business_name is null and description is null)
    or
    (sponsor_kind='ADVERTISER' and provider_organization_id is null and
      provider_profile_id is null and char_length(trim(business_name)) between 2 and 100 and
      char_length(trim(description)) between 10 and 240 and
      (website_url is not null or phone is not null))
  )
);

create unique index if not exists sponsors_provider_organization_unique
  on public.sponsors(provider_organization_id) where provider_organization_id is not null;
create unique index if not exists sponsors_provider_profile_unique
  on public.sponsors(provider_profile_id) where provider_profile_id is not null;

create table if not exists public.sponsor_placements (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  expo_group_key text not null,
  starts_on date not null,
  ends_on date not null,
  position integer not null check (position between 1 and 5),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on<=ends_on)
);

create index if not exists sponsor_placements_public_idx
  on public.sponsor_placements(expo_group_key,active,starts_on,ends_on,position);

insert into public.sponsors
  (sponsor_kind,provider_organization_id,provider_profile_id,active,created_by,updated_by,created_at,updated_at)
select distinct on (provider_organization_id,provider_profile_id)
  'TRANSPORTER',provider_organization_id,provider_profile_id,true,created_by,updated_by,created_at,updated_at
from public.provider_sponsorships
order by provider_organization_id,provider_profile_id,created_at,id
on conflict do nothing;

insert into public.sponsor_placements
  (id,sponsor_id,expo_group_key,starts_on,ends_on,position,active,created_by,updated_by,created_at,updated_at)
select legacy.id,sponsor.id,legacy.expo_group_key,legacy.starts_on,legacy.ends_on,legacy.position,
  legacy.active,legacy.created_by,legacy.updated_by,legacy.created_at,legacy.updated_at
from public.provider_sponsorships legacy
join public.sponsors sponsor on sponsor.sponsor_kind='TRANSPORTER' and
  ((sponsor.provider_organization_id=legacy.provider_organization_id and legacy.provider_organization_id is not null) or
   (sponsor.provider_profile_id=legacy.provider_profile_id and legacy.provider_profile_id is not null))
on conflict (id) do nothing;

alter table public.sponsors enable row level security;
alter table public.sponsor_placements enable row level security;

create policy "admins manage sponsors"
  on public.sponsors for all
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'));

create policy "admins manage sponsor placements"
  on public.sponsor_placements for all
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN'));

comment on table public.sponsors is
  'Admin-only sponsor catalogue. Anonymous clients receive only the bounded public sponsor projection.';
comment on table public.sponsor_placements is
  'Admin-only dated regional sponsor placements used by the public Sponsors panel and featured schedule.';
