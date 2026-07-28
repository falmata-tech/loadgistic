-- Mutual member network, Business-only tracking unlock data, and stricter event reads.
-- Application services still own state transitions and tracking-code verification.

alter table public.shipments add column if not exists tracking_code_hash text unique;
update public.shipments set tracking_token=null where tracking_token is not null;

create table if not exists public.partner_relationships (
  id uuid primary key default gen_random_uuid(),
  business_organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  status text not null check(status in ('FAVORITE','PENDING','CONNECTED','DECLINED')),
  requested_by_side text check(requested_by_side in ('BUSINESS','PROVIDER')),
  business_favorite boolean not null default false,
  provider_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint partner_provider_check check (
    (provider_organization_id is not null and provider_profile_id is null)
    or (provider_organization_id is null and provider_profile_id is not null)
  ),
  unique nulls not distinct (business_organization_id,provider_organization_id,provider_profile_id)
);

alter table public.partner_relationships enable row level security;

create policy "relationship parties read" on public.partner_relationships for select using (
  public.is_org_owner(business_organization_id)
  or public.is_org_owner(provider_organization_id)
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
);

create policy "relationship owners insert" on public.partner_relationships for insert with check (
  public.is_org_owner(business_organization_id)
  or public.is_org_owner(provider_organization_id)
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
);

create policy "relationship parties update" on public.partner_relationships for update using (
  public.is_org_owner(business_organization_id)
  or public.is_org_owner(provider_organization_id)
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
) with check (
  public.is_org_owner(business_organization_id)
  or public.is_org_owner(provider_organization_id)
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
);

drop policy if exists "shipment events party read" on public.shipment_events;
create policy "shipment events party read" on public.shipment_events for select using (
  exists(
    select 1 from public.shipments shipment
    where shipment.id=shipment_id and (
      public.is_org_member(shipment.shipper_organization_id)
      or public.is_org_member(shipment.receiver_organization_id)
      or public.is_org_member(shipment.provider_organization_id)
      or shipment.provider_profile_id in (
        select id from public.provider_profiles where user_id=auth.uid()
      )
    )
  )
);
