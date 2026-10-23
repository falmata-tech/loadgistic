-- FEAT-SIM-001. An interrupted browser/storage rehearsal may resume only the
-- same exact, incomplete synthetic shipment. Never reset a completed record or
-- relax the actor, recipient, vehicle, notification, or global-control checks.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.demo_world_tracking_lifecycle_control_guard()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  target public.provider_shipments%rowtype;
  target_exists boolean;
begin
  if new.shipment_id is distinct from old.shipment_id
    or new.manifest_version is distinct from old.manifest_version then
    raise exception 'DEMO_TRACKING_RESERVATION_IMMUTABLE';
  end if;
  if not old.armed and new.armed then
    perform pg_catalog.pg_advisory_xact_lock(8030191);
    select * into target from public.provider_shipments
    where id = new.shipment_id for update;
    target_exists := found;
    if not exists (
      select 1 from public.demo_world_control
      where id = 1 and enabled and manifest_version = 1
    ) or not public.demo_world_tracking_lifecycle_actor_ready()
      or exists (
        select 1 from public.provider_shipments
        where id <> new.shipment_id
          and assigned_vehicle_id =
            '76bea7fa-03b2-42f0-af51-fff05c62cbc7'::uuid
          and operational_status not in ('COMPLETED', 'CANCELLED')
      ) or exists (
        select 1 from public.email_deliveries
        where shipment_id = new.shipment_id
      ) or exists (
        select 1 from public.native_push_outbox
        where source_id = new.shipment_id
      ) then
      raise exception 'DEMO_TRACKING_RESERVATION_NOT_READY';
    end if;

    if target_exists then
      if target.operational_status not in
        ('CREATED', 'TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING')
        or not public.demo_world_tracking_lifecycle_scope()
        or (select count(*) from public.demo_world_tracking_notification_sink sink
          where sink.shipment_id = new.shipment_id
            and sink.source_kind = 'EMAIL'
            and sink.event_kind = 'TRACKING_ACCESS'
            and sink.recipient_role = 'OWNER') <> 1
        or exists (
          select 1 from public.demo_world_tracking_notification_sink sink
          where sink.shipment_id = new.shipment_id
            and sink.event_kind not in ('TRACKING_ACCESS', 'TRACKING_OTP')
        ) then
        raise exception 'DEMO_TRACKING_RESERVATION_NOT_READY';
      end if;
    elsif exists (
      select 1 from public.demo_world_tracking_notification_sink sink
      where sink.shipment_id = new.shipment_id
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
revoke all on function public.demo_world_tracking_lifecycle_control_guard()
  from public, anon, authenticated, service_role;

commit;
