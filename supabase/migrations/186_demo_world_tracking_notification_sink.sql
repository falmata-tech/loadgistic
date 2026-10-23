-- FEAT-SIM-001: keep the one imported Tracking demonstration out of all
-- external email and push dispatchers. Other shipments keep their normal path.
-- Atomic even under a direct psql run: the final existing-outbox check can
-- refuse installation, and no partial sink/trigger may survive that refusal.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.demo_world_tracking_notification_sink (
  source_kind text not null check (source_kind in ('EMAIL','PUSH')),
  source_key text not null,
  shipment_id uuid not null references public.provider_shipments(id) on delete cascade,
  event_kind text not null,
  recipient_role text,
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (source_kind,source_key)
);
alter table public.demo_world_tracking_notification_sink enable row level security;
revoke all on public.demo_world_tracking_notification_sink from public,anon,authenticated,service_role;
grant select on public.demo_world_tracking_notification_sink to service_role;
comment on table public.demo_world_tracking_notification_sink is
  'Private, recipient-free receipts for the exact imported synthetic Tracking example; never an outbound delivery queue.';

create function public.demo_world_tracking_fixture_isolated(target_shipment_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select target_shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
    and exists (
      select 1 from public.provider_shipments s
      join public.vehicles v on v.id=s.assigned_vehicle_id
      join auth.users provider_actor on provider_actor.id=s.created_by
      join auth.users driver_actor on driver_actor.id=s.assigned_driver_user_id
      where s.id=target_shipment_id
        and s.code='LGX-DEMO-0001'
        and s.provider_organization_id='6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
        and s.provider_profile_id is null
        and s.assigned_vehicle_id='caf1d0db-4d8e-4ce9-a879-6c7b6017de3a'::uuid
        and v.organization_id=s.provider_organization_id
        and s.shipper_email='demo.shipper@example.test'
        and s.receiver_email='demo.receiver@example.test'
        and provider_actor.raw_app_meta_data->>'fixture_source'='loadgistic'
        and provider_actor.raw_user_meta_data->>'fixture_key'='user-transporter'
        and driver_actor.raw_app_meta_data->>'fixture_source'='loadgistic'
        and driver_actor.raw_user_meta_data->>'fixture_key'='user-company-driver'
        and not exists (
          select 1 from public.provider_tracking_recipients r
          where r.shipment_id=s.id and lower(r.recipient_email) not in
            ('demo.shipper@example.test','demo.receiver@example.test')
        )
    );
$$;
revoke all on function public.demo_world_tracking_fixture_isolated(uuid) from public,anon,authenticated,service_role;

-- The Capacity simulator's one reviewed activation switch also controls this
-- fixed Tracking example. The advisory lock serializes each exact-demo queue
-- insertion against the enablement preflight at READ COMMITTED isolation.
create function public.demo_world_tracking_active()
returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare active boolean;
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'DEMO_WORLD_TRACKING_ISOLATION_REFUSED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(8030186);
  select enabled and manifest_version=1 into active
  from public.demo_world_control where id=1;
  return coalesce(active,false);
end $$;
revoke all on function public.demo_world_tracking_active() from public,anon,authenticated,service_role;

create function public.demo_world_tracking_activation_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'DEMO_WORLD_TRACKING_ISOLATION_REFUSED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(8030186);
  if not new.enabled then return new; end if;
  if new.manifest_version<>1 or not public.demo_world_tracking_fixture_isolated(
      'a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid) then
    raise exception 'DEMO_WORLD_TRACKING_SCOPE_CHANGED';
  end if;
  if exists (
    select 1 from public.email_deliveries e
    where e.shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      and e.status in ('PENDING','FAILED')
  ) or exists (
    select 1 from public.access_email_deliveries a
    join public.provider_tracking_email_otps otp on otp.id=a.entity_id
    where a.delivery_kind='TRACKING_OTP'
      and otp.shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      and a.status in ('QUEUED','FAILED')
  ) or exists (
    select 1 from public.native_push_outbox p
    where p.kind='HANDOVER'
      and p.source_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      and p.state in ('PENDING','SENDING','SUBMITTED','CHECKING')
  ) then
    raise exception 'DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
  end if;
  return new;
end $$;
revoke all on function public.demo_world_tracking_activation_guard() from public,anon,authenticated,service_role;
create trigger demo_world_tracking_activation_guard
before update of enabled,manifest_version on public.demo_world_control
for each row execute function public.demo_world_tracking_activation_guard();

create function public.demo_world_route_tracking_email()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if old.shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      or new.shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid then
      if public.demo_world_tracking_active() then
        raise exception 'DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
      end if;
    end if;
    return new;
  end if;
  if new.shipment_id<>'a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid then
    return new;
  end if;
  if not public.demo_world_tracking_active() then return new; end if;
  if not public.demo_world_tracking_fixture_isolated(new.shipment_id)
    or lower(new.recipient_email) not in ('demo.shipper@example.test','demo.receiver@example.test')
    or new.delivery_kind not in ('TRACKING_ACCESS','COMPLETION') then
    raise exception 'DEMO_WORLD_TRACKING_SCOPE_CHANGED';
  end if;
  insert into public.demo_world_tracking_notification_sink
    (source_kind,source_key,shipment_id,event_kind,recipient_role)
  values ('EMAIL',new.idempotency_key,new.shipment_id,new.delivery_kind,new.party_role)
  on conflict (source_kind,source_key) do nothing;
  return null;
end $$;
revoke all on function public.demo_world_route_tracking_email() from public,anon,authenticated,service_role;
create trigger demo_world_tracking_email_sink before insert or update on public.email_deliveries
for each row execute function public.demo_world_route_tracking_email();

-- The owner sign-in challenge uses the separate access-email queue. It is
-- shipment-linked through its OTP row, so it needs the same isolation.
create function public.demo_world_route_tracking_otp()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_id uuid;
begin
  if tg_op='UPDATE' then
    if exists (
      select 1 from public.provider_tracking_email_otps otp
      where otp.shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
        and otp.id in (old.entity_id,new.entity_id)
    ) then
      if public.demo_world_tracking_active() then
        raise exception 'DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
      end if;
    end if;
    return new;
  end if;
  if new.delivery_kind<>'TRACKING_OTP' then return new; end if;
  select otp.shipment_id into target_id
  from public.provider_tracking_email_otps otp where otp.id=new.entity_id;
  if target_id is distinct from 'a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid then
    return new;
  end if;
  if not public.demo_world_tracking_active() then return new; end if;
  if not public.demo_world_tracking_fixture_isolated(target_id)
    or lower(new.recipient_email) not in ('demo.shipper@example.test','demo.receiver@example.test')
    or not exists (
      select 1 from public.provider_tracking_email_otps otp
      join public.provider_tracking_recipients r on r.id=otp.recipient_id
      where otp.id=new.entity_id and r.shipment_id=target_id
        and r.recipient_email=lower(new.recipient_email)
    ) then
    raise exception 'DEMO_WORLD_TRACKING_SCOPE_CHANGED';
  end if;
  insert into public.demo_world_tracking_notification_sink
    (source_kind,source_key,shipment_id,event_kind,recipient_role)
  values ('EMAIL','tracking-otp:'||new.entity_id::text,target_id,'TRACKING_OTP','OWNER')
  on conflict (source_kind,source_key) do nothing;
  return null;
end $$;
revoke all on function public.demo_world_route_tracking_otp() from public,anon,authenticated,service_role;
create trigger demo_world_tracking_otp_sink before insert or update on public.access_email_deliveries
for each row execute function public.demo_world_route_tracking_otp();

create function public.demo_world_route_tracking_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if old.kind='HANDOVER' and old.source_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      or new.kind='HANDOVER' and new.source_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid then
      if public.demo_world_tracking_active() then
        raise exception 'DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
      end if;
    end if;
    return new;
  end if;
  if new.kind<>'HANDOVER'
    or new.source_id<>'a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid then
    return new;
  end if;
  if not public.demo_world_tracking_active() then return new; end if;
  if not public.demo_world_tracking_fixture_isolated(new.source_id)
    or new.event<>'APPROVED' then
    raise exception 'DEMO_WORLD_TRACKING_SCOPE_CHANGED';
  end if;
  insert into public.demo_world_tracking_notification_sink
    (source_kind,source_key,shipment_id,event_kind,recipient_role)
  values ('PUSH',new.event_key,new.source_id,new.event,'DRIVER')
  on conflict (source_kind,source_key) do nothing;
  return null;
end $$;
revoke all on function public.demo_world_route_tracking_push() from public,anon,authenticated,service_role;
create trigger demo_world_tracking_push_sink before insert or update on public.native_push_outbox
for each row execute function public.demo_world_route_tracking_push();

-- An older pending row could already be in a dispatcher. Do not claim safe
-- isolation or silently rewrite its delivery history in that state.
do $safety$
begin
  if exists (
    select 1 from public.email_deliveries e
    where e.shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      and e.status in ('PENDING','FAILED')
  ) or exists (
    select 1 from public.access_email_deliveries a
    join public.provider_tracking_email_otps otp on otp.id=a.entity_id
    where a.delivery_kind='TRACKING_OTP'
      and otp.shipment_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      and a.status in ('QUEUED','FAILED')
  ) or exists (
    select 1 from public.native_push_outbox p
    where p.kind='HANDOVER'
      and p.source_id='a641aca2-f550-4960-94a9-7c1de9e4cd56'::uuid
      and p.state in ('PENDING','SENDING','SUBMITTED','CHECKING')
  ) then
    raise exception 'DEMO_WORLD_EXISTING_OUTBOX_REVIEW_REQUIRED';
  end if;
end $safety$;
commit;
