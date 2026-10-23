-- FEAT-SIM-001. Reserve a SECOND exact active synthetic Tracking example and intercept
-- its notification intents before its ordinary creation command can run.
-- Installation does not create a shipment, upload a proof, or arm the scenario.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.demo_world_tracking_live_control (
  id integer primary key check (id = 1),
  shipment_id uuid not null unique check (
    shipment_id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
  ),
  manifest_version integer not null check (manifest_version = 1),
  armed boolean not null default false,
  armed_at timestamptz,
  check (not armed or armed_at is not null)
);
insert into public.demo_world_tracking_live_control
  (id, shipment_id, manifest_version)
values (1, 'ab8e45be-d878-4aad-a9d9-32e0e64c991a', 1);
alter table public.demo_world_tracking_live_control enable row level security;
revoke all on public.demo_world_tracking_live_control
  from public, anon, authenticated, service_role;
comment on table public.demo_world_tracking_live_control is
  'Default-off reservation for a second fictional active shipment. Arming requires separate review of proof storage, owner session, Demo UI and deployment; service_role cannot arm it.';

create function public.demo_world_tracking_live_actor_ready()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.vehicles vehicle
    join public.driver_vehicle_assignments assignment
      on assignment.vehicle_id = vehicle.id and assignment.active
    join public.organization_members member
      on member.organization_id = vehicle.organization_id
      and member.membership_role = 'OWNER'
    join public.profiles provider
      on provider.id = member.user_id and provider.active
      and provider.role::text = 'TRANSPORTER'
    join public.profiles driver
      on driver.id = assignment.driver_user_id and driver.active
      and driver.role::text = 'DRIVER'
    join auth.users provider_auth on provider_auth.id = provider.id
    join auth.users driver_auth on driver_auth.id = driver.id
    where vehicle.id = '76bea7fa-03b2-42f0-af51-fff05c62cbc7'::uuid
      and vehicle.organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
      and vehicle.provider_profile_id is null and vehicle.active
      and provider_auth.raw_app_meta_data->>'fixture_source' = 'loadgistic'
      and provider_auth.raw_user_meta_data->>'fixture_key' = 'user-transporter'
      and driver_auth.raw_app_meta_data->>'fixture_source' = 'loadgistic'
      and driver_auth.raw_user_meta_data->>'fixture_key' = 'user-company-driver-2'
      and not exists (
        select 1 from public.driver_vehicle_assignments other_assignment
        where other_assignment.vehicle_id = vehicle.id
          and other_assignment.active and other_assignment.id <> assignment.id
      )
  );
$$;
revoke all on function public.demo_world_tracking_live_actor_ready()
  from public, anon, authenticated, service_role;

create function public.demo_world_tracking_live_armed()
returns boolean language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare is_armed boolean;
begin
  select armed into is_armed
  from public.demo_world_tracking_live_control
  where id = 1 and manifest_version = 1 for share;
  return coalesce(is_armed, false);
end;
$$;
revoke all on function public.demo_world_tracking_live_armed()
  from public, anon, authenticated, service_role;

create function public.demo_world_tracking_live_scope()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.demo_world_tracking_live_actor_ready() and exists (
    select 1
    from public.provider_shipments shipment
    join auth.users provider_auth on provider_auth.id = shipment.created_by
    join auth.users driver_auth
      on driver_auth.id = shipment.assigned_driver_user_id
    where shipment.id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
      and shipment.code = 'LGX-AB8E45BE'
      and shipment.provider_organization_id =
        '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
      and shipment.provider_profile_id is null
      and shipment.assigned_vehicle_id =
        '76bea7fa-03b2-42f0-af51-fff05c62cbc7'::uuid
      and shipment.shipper_email = 'demo.live.owner@example.test'
      and shipment.receiver_email = 'demo.live.owner@example.test'
      and shipment.tracking_mode::text = 'LOCATION_AND_STATUS'
      and shipment.cargo_summary = 'Demonstration cargo only'
      and provider_auth.raw_app_meta_data->>'fixture_source' = 'loadgistic'
      and provider_auth.raw_user_meta_data->>'fixture_key' = 'user-transporter'
      and driver_auth.raw_app_meta_data->>'fixture_source' = 'loadgistic'
      and driver_auth.raw_user_meta_data->>'fixture_key' = 'user-company-driver-2'
      and not exists (
        select 1 from public.provider_tracking_recipients recipient
        where recipient.shipment_id = shipment.id
          and not (
            recipient.recipient_email = 'demo.live.owner@example.test'
              and recipient.recipient_role = 'OWNER'
            or recipient.recipient_email = 'demo.live.viewer@example.test'
              and recipient.recipient_role = 'TRACKING_PARTY'
          )
      )
  );
$$;
revoke all on function public.demo_world_tracking_live_scope()
  from public, anon, authenticated, service_role;

create function public.demo_world_tracking_live_control_guard()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.shipment_id is distinct from old.shipment_id
    or new.manifest_version is distinct from old.manifest_version then
    raise exception 'DEMO_TRACKING_RESERVATION_IMMUTABLE';
  end if;
  if not old.armed and new.armed then
    perform pg_catalog.pg_advisory_xact_lock(8030194);
    if not exists (
      select 1 from public.demo_world_control
      where id = 1 and enabled and manifest_version = 1
    ) or not public.demo_world_tracking_live_actor_ready()
      or exists (
        select 1 from public.provider_shipments
        where id = new.shipment_id
          or (assigned_vehicle_id =
              '76bea7fa-03b2-42f0-af51-fff05c62cbc7'::uuid
              and operational_status not in ('COMPLETED', 'CANCELLED'))
      ) or exists (
        select 1 from public.email_deliveries
        where shipment_id = new.shipment_id
      ) or exists (
        select 1 from public.native_push_outbox
        where source_id = new.shipment_id
      ) or exists (
        select 1 from public.demo_world_tracking_notification_sink
        where shipment_id = new.shipment_id
      ) then
      raise exception 'DEMO_TRACKING_RESERVATION_NOT_READY';
    end if;
    new.armed_at := clock_timestamp();
  elsif old.armed and not new.armed then
    new.armed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.demo_world_tracking_live_control_guard()
  from public, anon, authenticated, service_role;
create trigger demo_world_tracking_live_control_guard
before update on public.demo_world_tracking_live_control
for each row execute function public.demo_world_tracking_live_control_guard();

create function public.demo_world_tracking_live_shipment_guard()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.id <> 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(8030194);
  if not public.demo_world_tracking_live_armed()
    or not public.demo_world_tracking_live_actor_ready()
    or new.code <> 'LGX-AB8E45BE'
    or new.provider_organization_id is distinct from
      '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
    or new.provider_profile_id is not null
    or new.assigned_vehicle_id is distinct from
      '76bea7fa-03b2-42f0-af51-fff05c62cbc7'::uuid
    or new.shipper_email <> 'demo.live.owner@example.test'
    or new.receiver_email <> 'demo.live.owner@example.test'
    or new.tracking_mode::text <> 'LOCATION_AND_STATUS'
    or new.operational_status <> 'CREATED'
    or new.cargo_summary <> 'Demonstration cargo only'
    or not exists (
      select 1 from auth.users actor
      where actor.id = new.created_by
        and actor.raw_app_meta_data->>'fixture_source' = 'loadgistic'
        and actor.raw_user_meta_data->>'fixture_key' = 'user-transporter'
    ) or not exists (
      select 1 from auth.users actor
      where actor.id = new.assigned_driver_user_id
        and actor.raw_app_meta_data->>'fixture_source' = 'loadgistic'
        and actor.raw_user_meta_data->>'fixture_key' = 'user-company-driver-2'
    ) then
    raise exception 'DEMO_TRACKING_SCOPE_CHANGED';
  end if;
  return new;
end;
$$;
revoke all on function public.demo_world_tracking_live_shipment_guard()
  from public, anon, authenticated, service_role;
create trigger demo_world_tracking_live_shipment_guard
before insert on public.provider_shipments
for each row execute function public.demo_world_tracking_live_shipment_guard();

create function public.demo_world_tracking_live_email_sink()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if old.shipment_id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
      or new.shipment_id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid then
      raise exception 'DEMO_TRACKING_QUEUE_MUTATION_DENIED';
    end if;
    return new;
  end if;
  if new.shipment_id <> 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid then
    return new;
  end if;
  if not public.demo_world_tracking_live_armed()
    or not public.demo_world_tracking_live_scope()
    or new.delivery_kind not in ('TRACKING_ACCESS', 'COMPLETION')
    or not (
      new.party_role = 'SHIPPER'
        and lower(new.recipient_email) = 'demo.live.owner@example.test'
      or new.party_role = 'RECEIVER'
        and lower(new.recipient_email) = 'demo.live.viewer@example.test'
    ) then
    raise exception 'DEMO_TRACKING_SCOPE_CHANGED';
  end if;
  insert into public.demo_world_tracking_notification_sink
    (source_kind, source_key, shipment_id, event_kind, recipient_role)
  values ('EMAIL', new.idempotency_key, new.shipment_id,
    new.delivery_kind,
    case when new.party_role = 'SHIPPER' then 'OWNER'
      else 'TRACKING_PARTY' end)
  on conflict (source_kind, source_key) do nothing;
  return null;
end;
$$;
revoke all on function public.demo_world_tracking_live_email_sink()
  from public, anon, authenticated, service_role;
create trigger demo_world_tracking_live_email_sink
before insert or update on public.email_deliveries
for each row execute function public.demo_world_tracking_live_email_sink();

create function public.demo_world_tracking_live_otp_sink()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare target_id uuid;
begin
  if tg_op = 'UPDATE' then
    if exists (
      select 1 from public.provider_tracking_email_otps otp
      where otp.shipment_id =
        'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
        and otp.id in (old.entity_id, new.entity_id)
    ) then
      raise exception 'DEMO_TRACKING_QUEUE_MUTATION_DENIED';
    end if;
    return new;
  end if;
  select otp.shipment_id into target_id
  from public.provider_tracking_email_otps otp
  where otp.id = new.entity_id;
  if target_id is distinct from
    'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid then
    return new;
  end if;
  if not public.demo_world_tracking_live_armed()
    or not public.demo_world_tracking_live_scope()
    or new.delivery_kind <> 'TRACKING_OTP'
    or lower(new.recipient_email) not in
      ('demo.live.owner@example.test', 'demo.live.viewer@example.test')
    or not exists (
      select 1
      from public.provider_tracking_email_otps otp
      join public.provider_tracking_recipients recipient
        on recipient.id = otp.recipient_id
      where otp.id = new.entity_id and otp.shipment_id = target_id
        and recipient.shipment_id = target_id
        and (recipient.recipient_role = 'OWNER'
          and recipient.recipient_email = 'demo.live.owner@example.test'
          or recipient.recipient_role = 'TRACKING_PARTY'
          and recipient.recipient_email = 'demo.live.viewer@example.test')
        and recipient.recipient_email = lower(new.recipient_email)
        and recipient.recipient_email_digest = otp.recipient_email_digest
        and recipient.revoked_at is null
    ) then
    raise exception 'DEMO_TRACKING_SCOPE_CHANGED';
  end if;
  insert into public.demo_world_tracking_notification_sink
    (source_kind, source_key, shipment_id, event_kind, recipient_role)
  values ('EMAIL', 'tracking-otp:' || new.entity_id::text,
    target_id, 'TRACKING_OTP',
    case when lower(new.recipient_email) = 'demo.live.owner@example.test'
      then 'OWNER' else 'TRACKING_PARTY' end)
  on conflict (source_kind, source_key) do nothing;
  return null;
end;
$$;
revoke all on function public.demo_world_tracking_live_otp_sink()
  from public, anon, authenticated, service_role;
create trigger demo_world_tracking_live_otp_sink
before insert or update on public.access_email_deliveries
for each row execute function public.demo_world_tracking_live_otp_sink();

create function public.demo_world_tracking_live_push_sink()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if old.source_id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
      or new.source_id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid then
      raise exception 'DEMO_TRACKING_QUEUE_MUTATION_DENIED';
    end if;
    return new;
  end if;
  if new.source_id <> 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid then
    return new;
  end if;
  if not public.demo_world_tracking_live_armed()
    or not public.demo_world_tracking_live_scope()
    or new.kind <> 'HANDOVER' or new.event <> 'APPROVED'
    or not exists (
      select 1 from public.native_push_bindings binding
      join public.provider_shipments shipment
        on shipment.id = new.source_id
      where binding.id = new.binding_id
        and binding.actor_user_id = shipment.assigned_driver_user_id
        and binding.audience = 'MEMBER'
    ) then
    raise exception 'DEMO_TRACKING_SCOPE_CHANGED';
  end if;
  insert into public.demo_world_tracking_notification_sink
    (source_kind, source_key, shipment_id, event_kind, recipient_role)
  values ('PUSH', new.event_key, new.source_id, 'HANDOVER', 'DRIVER')
  on conflict (source_kind, source_key) do nothing;
  return null;
end;
$$;
revoke all on function public.demo_world_tracking_live_push_sink()
  from public, anon, authenticated, service_role;
create trigger demo_world_tracking_live_push_sink
before insert or update on public.native_push_outbox
for each row execute function public.demo_world_tracking_live_push_sink();

-- The reservation must predate the first ordinary creation command.
do $safety$
begin
  if exists (
    select 1 from public.provider_shipments
    where id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
  ) or exists (
    select 1 from public.email_deliveries
    where shipment_id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
  ) or exists (
    select 1 from public.native_push_outbox
    where source_id = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
  ) then
    raise exception 'DEMO_TRACKING_EXISTING_ROW_REVIEW_REQUIRED';
  end if;
end;
$safety$;

commit;
