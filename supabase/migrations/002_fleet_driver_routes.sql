-- Fleet-driver delegation and evidence-aware profile routes.
-- Local SQLite remains the active adapter; this keeps the Supabase/RLS target aligned.

create or replace function public.is_org_owner(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.organization_members m
    where m.user_id=auth.uid() and m.organization_id=target_org and m.membership_role='OWNER'
  )
$$;

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  license_verified boolean not null default false,
  active boolean not null default true
);

create table public.driver_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  can_browse_load_board boolean not null default true,
  can_contact_businesses boolean not null default true,
  can_negotiate_loads boolean not null default true,
  can_manage_capacity boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.driver_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  driver_user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  active boolean not null default true,
  unique(driver_user_id,vehicle_id)
);

create table public.profile_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider_profile_id uuid references public.provider_profiles(id) on delete cascade,
  origin text not null,
  destination text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint profile_route_owner_check check (
    (organization_id is not null and provider_profile_id is null)
    or (organization_id is null and provider_profile_id is not null)
  ),
  constraint profile_route_distinct_places check (lower(trim(origin))<>lower(trim(destination)))
);

alter table public.shipment_interests add column if not exists created_by uuid references public.profiles(id);

create index profile_routes_organization_idx on public.profile_routes(organization_id);
create index profile_routes_provider_idx on public.profile_routes(provider_profile_id);

alter table public.drivers enable row level security;
alter table public.driver_permissions enable row level security;
alter table public.driver_vehicle_assignments enable row level security;
alter table public.profile_routes enable row level security;

create policy "fleet drivers own or owner read" on public.drivers for select using (
  user_id=auth.uid() or public.is_org_owner(organization_id)
);
create policy "fleet owners manage drivers" on public.drivers for all using (
  public.is_org_owner(organization_id)
) with check (public.is_org_owner(organization_id));

create policy "driver or fleet owner reads permissions" on public.driver_permissions for select using (
  user_id=auth.uid()
  or exists(
    select 1 from public.drivers d
    where d.user_id=driver_permissions.user_id and public.is_org_owner(d.organization_id)
  )
);
create policy "fleet owner manages permissions" on public.driver_permissions for all using (
  exists(
    select 1 from public.drivers d
    where d.user_id=driver_permissions.user_id and public.is_org_owner(d.organization_id)
  )
) with check (
  exists(
    select 1 from public.drivers d
    where d.user_id=driver_permissions.user_id and public.is_org_owner(d.organization_id)
  )
);

create policy "driver or fleet owner reads assignments" on public.driver_vehicle_assignments for select using (
  driver_user_id=auth.uid()
  or exists(
    select 1 from public.vehicles v
    where v.id=driver_vehicle_assignments.vehicle_id and public.is_org_owner(v.organization_id)
  )
);
create policy "fleet owner manages assignments" on public.driver_vehicle_assignments for all using (
  exists(
    select 1 from public.vehicles v
    where v.id=driver_vehicle_assignments.vehicle_id and public.is_org_owner(v.organization_id)
  )
) with check (
  exists(
    select 1 from public.vehicles v
    where v.id=driver_vehicle_assignments.vehicle_id and public.is_org_owner(v.organization_id)
  )
);

create policy "authenticated members read profile routes" on public.profile_routes for select using (auth.uid() is not null);
create policy "profile owners manage routes" on public.profile_routes for all using (
  (organization_id is not null and public.is_org_owner(organization_id))
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
) with check (
  (organization_id is not null and public.is_org_owner(organization_id))
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
);

drop policy if exists "organizations public verified read" on public.organizations;
create policy "authenticated organizations read" on public.organizations for select using (
  auth.uid() is not null and (public_visibility='PUBLIC' or public.is_org_member(id))
);

drop policy if exists "public company pages read" on public.company_pages;
create policy "authenticated company pages read" on public.company_pages for select using (
  auth.uid() is not null and (
    published=true
    or (organization_id is not null and public.is_org_member(organization_id))
    or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
  )
);

drop policy if exists "members update company page" on public.company_pages;
create policy "profile owners update company page" on public.company_pages for update using (
  (organization_id is not null and public.is_org_owner(organization_id))
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
) with check (
  (organization_id is not null and public.is_org_owner(organization_id))
  or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
);

create policy "authenticated published profile vehicles read" on public.vehicles for select using (
  auth.uid() is not null and (
    exists(
      select 1 from public.company_pages page
      where page.published and (
        page.organization_id=vehicles.organization_id
        or page.provider_profile_id=vehicles.provider_profile_id
      )
    )
  )
);

drop policy if exists "shipment parties read" on public.shipments;
create policy "authenticated shipment parties or open market read" on public.shipments for select using (
  auth.uid() is not null and (
    public.is_org_member(shipper_organization_id)
    or public.is_org_member(receiver_organization_id)
    or public.is_org_member(provider_organization_id)
    or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
    or (service_mode='FREIGHT' and operational_status='POSTED' and distribution_mode='OPEN_MARKET')
  )
);

create policy "shipment parties or provider read interests" on public.shipment_interests for select using (
  auth.uid() is not null and (
    public.is_org_member(provider_organization_id)
    or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
    or exists(
      select 1 from public.shipments shipment
      where shipment.id=shipment_interests.shipment_id and (
        public.is_org_member(shipment.shipper_organization_id)
        or public.is_org_member(shipment.receiver_organization_id)
        or public.is_org_member(shipment.provider_organization_id)
        or shipment.provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
      )
    )
  )
);

create policy "authorized provider creates interest" on public.shipment_interests for insert with check (
  created_by=auth.uid() and (
    (provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid()))
    or (
    provider_organization_id is not null
    and public.is_org_member(provider_organization_id)
    and (
      public.is_org_owner(provider_organization_id)
      or exists(
        select 1 from public.driver_permissions p
        where p.user_id=auth.uid()
          and p.can_browse_load_board
          and p.can_contact_businesses
          and p.can_negotiate_loads
      )
    )
    )
  )
);

drop policy if exists "capacity public or owner read" on public.capacity_updates;
create policy "authenticated public or owner capacity read" on public.capacity_updates for select using (
  auth.uid() is not null and (
    (visibility='OPEN' and expires_at>now())
    or (provider_organization_id is not null and public.is_org_member(provider_organization_id))
    or provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
  )
);

drop policy if exists "capacity owner insert" on public.capacity_updates;
create policy "authorized capacity insert" on public.capacity_updates for insert with check (
  updated_by=auth.uid() and (
    provider_profile_id in (select id from public.provider_profiles where user_id=auth.uid())
    or (
      provider_organization_id is not null
      and (
        public.is_org_owner(provider_organization_id)
        or (
          exists(select 1 from public.driver_permissions p where p.user_id=auth.uid() and p.can_manage_capacity)
          and exists(
            select 1 from public.driver_vehicle_assignments a
            where a.driver_user_id=auth.uid() and a.vehicle_id=capacity_updates.vehicle_id and a.active
          )
        )
      )
    )
  )
);

create or replace function public.set_assigned_vehicle_duty(target_vehicle uuid,on_duty boolean)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  source public.capacity_updates%rowtype;
  vehicle_owner uuid;
  created_id uuid:=gen_random_uuid();
begin
  select v.organization_id into vehicle_owner
  from public.vehicles v
  join public.driver_vehicle_assignments a on a.vehicle_id=v.id and a.active
  where v.id=target_vehicle and v.active and a.driver_user_id=auth.uid();

  if vehicle_owner is null then
    raise exception 'INVALID_VEHICLE';
  end if;

  if on_duty then
    select c.* into source
    from public.capacity_updates c
    join public.profiles actor on actor.id=c.updated_by and actor.role='TRANSPORTER'
    where c.vehicle_id=target_vehicle and c.status in ('EMPTY','PARTIAL')
    order by c.updated_at desc limit 1;
  else
    select c.* into source
    from public.capacity_updates c
    where c.vehicle_id=target_vehicle
    order by c.updated_at desc limit 1;
  end if;

  if source.id is null then
    raise exception 'CAPACITY_CONFIGURATION_REQUIRED';
  end if;

  update public.capacity_updates set expires_at=now()
  where vehicle_id=target_vehicle and expires_at>now();

  insert into public.capacity_updates (
    id,provider_organization_id,provider_profile_id,vehicle_id,status,available_percent,
    origin,destination,corridor,travel_date,next_available,visibility,photo_storage_path,
    location_area,location_updated_at,location_lat,location_lng,location_precision_km,
    location_source,accepts_full_load,accepts_partial_load,open_to_contract_lanes,
    accepts_multi_stop,proof_recorded_at,updated_by,updated_at,expires_at
  ) values (
    created_id,vehicle_owner,null,target_vehicle,
    case when on_duty then source.status else 'OFF_DUTY'::public.capacity_status end,
    case when on_duty then source.available_percent else 0 end,
    source.origin,source.destination,source.corridor,source.travel_date,source.next_available,
    source.visibility,null,
    case when on_duty then source.location_area else null end,
    case when on_duty then now() else null end,
    case when on_duty then source.location_lat else null end,
    case when on_duty then source.location_lng else null end,
    case when on_duty then source.location_precision_km else null end,
    case when on_duty then source.location_source else null end,
    case when on_duty then source.accepts_full_load else false end,
    case when on_duty then source.accepts_partial_load else false end,
    case when on_duty then source.open_to_contract_lanes else false end,
    case when on_duty then source.accepts_multi_stop else false end,
    null,auth.uid(),now(),now()+interval '24 hours'
  );
  return created_id;
end;
$$;

revoke all on function public.set_assigned_vehicle_duty(uuid,boolean) from public;
grant execute on function public.set_assigned_vehicle_duty(uuid,boolean) to authenticated;
