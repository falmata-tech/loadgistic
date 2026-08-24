-- BASE-BE-001: align the managed PostgreSQL schema with the active application
-- contracts before importing deterministic local fixtures.

alter table public.driver_permissions
  add column if not exists can_manage_tracking boolean not null default true;

alter table public.profile_routes
  add column if not exists assigned_vehicle_id uuid references public.vehicles(id) on delete cascade,
  add column if not exists assigned_driver_user_id uuid references public.profiles(id) on delete set null;

create index if not exists profile_routes_assigned_vehicle_idx
  on public.profile_routes(assigned_vehicle_id,created_at desc);

alter table public.support_agent_profiles
  add column if not exists can_manage_customers boolean not null default false,
  add column if not exists can_manage_operations boolean not null default false,
  add column if not exists can_manage_trust boolean not null default false,
  add column if not exists can_manage_billing boolean not null default false,
  add column if not exists can_manage_support boolean not null default true;

-- These columns are retained only for historical shipment records that still
-- exist before the retired demand workflow is purged. Current provider-owned
-- Tracking uses provider_shipments and its explicit assignment columns.
alter table public.shipments
  add column if not exists assigned_vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists assigned_driver_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists external_shipper_name text,
  add column if not exists external_shipper_phone text,
  add column if not exists external_receiver_name text,
  add column if not exists external_receiver_phone text;

comment on column public.driver_permissions.can_manage_tracking is
  'Fleet-owner control over Driver access to provider-owned Tracking sessions.';
comment on column public.profile_routes.assigned_vehicle_id is
  'Optional truck that publishes this regular Capacity route or Service area.';
