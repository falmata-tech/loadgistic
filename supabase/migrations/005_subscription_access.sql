-- Time-bounded workspace access, manual payment review, and Business sponsorship.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  audience text not null check (audience in ('BUSINESS','TRANSPORTER','DRIVER')),
  active boolean not null default true
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null check (status in ('TRIAL','ACTIVE','SPONSORED','PAYMENT_REQUIRED','PAYMENT_UNDER_REVIEW')),
  billing_model text not null check (billing_model in ('FLAT_MONTHLY','SPONSORED_FREE')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint subscription_owner_check check (
    (organization_id is not null and provider_profile_id is null)
    or (organization_id is null and provider_profile_id is not null)
  ),
  constraint subscription_sponsorship_check check (
    (status = 'SPONSORED' and billing_model = 'SPONSORED_FREE' and ends_at is null)
    or status <> 'SPONSORED'
  )
);

create unique index if not exists subscriptions_organization_owner
  on public.subscriptions(organization_id) where organization_id is not null;
create unique index if not exists subscriptions_provider_owner
  on public.subscriptions(provider_profile_id) where provider_profile_id is not null;

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  reference text,
  file_path text,
  status text not null check (status in ('PENDING','APPROVED','MORE_INFO','REJECTED')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null,
  application_type text not null check (application_type in ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER','TRANSPORT_COMPANY','INDEPENDENT_PROVIDER')),
  status text not null check (status in ('PENDING','APPROVED','MORE_INFO','REJECTED')),
  sponsored_free boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_sponsorship_only check (
    sponsored_free = false or application_type in ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER')
  )
);

create or replace function public.has_workspace_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN' and p.active)
    or exists(
      select 1
      from public.subscriptions s
      join public.organization_members m on m.organization_id=s.organization_id
      where m.user_id=auth.uid()
        and (s.status='SPONSORED' or (s.status in ('TRIAL','ACTIVE') and s.ends_at>now()))
    )
    or exists(
      select 1
      from public.subscriptions s
      join public.provider_profiles p on p.id=s.provider_profile_id
      where p.user_id=auth.uid()
        and (s.status='SPONSORED' or (s.status in ('TRIAL','ACTIVE') and s.ends_at>now()))
    );
$$;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.applications enable row level security;

create policy "authenticated plans read" on public.plans
  for select using (auth.uid() is not null);

create policy "workspace subscription read" on public.subscriptions
  for select using (
    organization_id in (select organization_id from public.organization_members where user_id=auth.uid())
    or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
    or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  );
create policy "admin subscription manage" on public.subscriptions
  for all using (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  ) with check (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  );

create policy "workspace payment proof read" on public.payment_proofs
  for select using (
    subscription_id in (
      select id from public.subscriptions
      where organization_id in (select organization_id from public.organization_members where user_id=auth.uid())
        or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
    )
    or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  );
create policy "workspace payment proof submit" on public.payment_proofs
  for insert with check (
    status='PENDING'
    and subscription_id in (
      select id from public.subscriptions
      where organization_id in (select organization_id from public.organization_members where user_id=auth.uid())
        or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
    )
  );
create policy "admin payment proof review" on public.payment_proofs
  for update using (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  ) with check (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  );

create policy "applicant reads application" on public.applications
  for select using (
    user_id=auth.uid()
    or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  );
create policy "applicant submits application" on public.applications
  for insert with check (user_id=auth.uid() and status='PENDING' and sponsored_free=false);
create policy "admin reviews application" on public.applications
  for update using (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  ) with check (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
  );

-- Existing permissive ownership policies still apply, but these restrictive
-- policies also require active workspace access for operating data.
create policy "active access organizations" on public.organizations as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access company pages" on public.company_pages as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access vehicles" on public.vehicles as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access shipments" on public.shipments as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access shipment events" on public.shipment_events as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access shipment interests" on public.shipment_interests as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access capacity" on public.capacity_updates as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access proof files" on public.proof_files as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access verification" on public.verification_requests as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access reviews" on public.business_reviews as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access drivers" on public.drivers as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access driver permissions" on public.driver_permissions as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access assignments" on public.driver_vehicle_assignments as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access profile routes" on public.profile_routes as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
create policy "active access relationships" on public.partner_relationships as restrictive
  for all to authenticated using (public.has_workspace_access()) with check (public.has_workspace_access());
