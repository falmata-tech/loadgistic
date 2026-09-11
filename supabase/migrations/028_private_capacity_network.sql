-- Truck-scoped private capacity grants. Email verification remains in the server adapter.

create table if not exists public.capacity_access_grants (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  audience_type text not null check (audience_type in ('EMAIL','LOADGISTIC')),
  recipient_email text,
  recipient_email_digest text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  check ((audience_type='EMAIL' and recipient_email is not null) or (audience_type='LOADGISTIC' and recipient_email is null))
);

create unique index if not exists capacity_access_active_idx
  on public.capacity_access_grants(vehicle_id,audience_type,recipient_email_digest) where revoked_at is null;
create index if not exists capacity_access_email_idx
  on public.capacity_access_grants(recipient_email_digest,revoked_at,expires_at,vehicle_id);
create index if not exists capacity_access_vehicle_idx
  on public.capacity_access_grants(vehicle_id,revoked_at,created_at desc);

create table if not exists public.access_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_kind text not null check (delivery_kind in ('SHARED_CAPACITY','GUEST_SUPPORT')),
  entity_id uuid not null,
  recipient_email text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','FAILED','SENT')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(delivery_kind,entity_id,recipient_email)
);

alter table public.capacity_access_grants enable row level security;
alter table public.access_email_deliveries enable row level security;

comment on table public.capacity_access_grants is
  'Private truck capacity audiences. Browser clients have no direct policy; the server reauthorizes every read and mutation.';
