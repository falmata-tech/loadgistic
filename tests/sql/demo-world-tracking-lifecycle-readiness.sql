-- FEAT-SIM-001. Disposable, fixture-loaded clone only. The imported Tracking
-- example is intentionally mid-journey and must not become a fabricated
-- completed delivery while a separate lifecycle scenario is unimplemented.
begin;
set local statement_timeout = '30s';

do $test$
declare
  demo_id constant uuid := 'a641aca2-f550-4960-94a9-7c1de9e4cd56';
  driver_id uuid;
  event_count bigint;
  sink_count bigint;
  email_count bigint;
  push_count bigint;
  denied boolean := false;
begin
  if current_database() not in (
    'loadgistic_demo_world_185_ci',
    'loadgistic_demo_world_186_atomic_ci',
    'loadgistic_demo_lifecycle_191_ci',
    'loadgistic_telematics_ci',
    'loadgistic_sim_share_combo_20261022_agent'
  ) then
    raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';
  end if;

  if not public.demo_world_tracking_fixture_isolated(demo_id) then
    raise exception 'IMPORTED_TRACKING_FIXTURE_DRIFT';
  end if;
  select assigned_driver_user_id into strict driver_id
  from public.provider_shipments
  where id = demo_id and code = 'LGX-DEMO-0001'
    and operational_status = 'IN_TRANSIT'
    and handover_approved_at is null;
  if driver_id is null or exists (
    select 1 from public.provider_shipment_events
    where shipment_id = demo_id and (
      status = 'LOADING' and proof_storage_path is not null
      or status in ('UNLOADING', 'COMPLETED')
    )
  ) then
    raise exception 'IMPORTED_TRACKING_HISTORY_NOT_STABLE';
  end if;

  select count(*) into event_count from public.provider_shipment_events
  where shipment_id = demo_id;
  select count(*) into sink_count
  from public.demo_world_tracking_notification_sink
  where shipment_id = demo_id;
  select count(*) into email_count from public.email_deliveries
  where shipment_id = demo_id;
  select count(*) into push_count from public.native_push_outbox
  where source_id = demo_id;
  begin
    perform public.update_provider_tracking_status(
      driver_id, demo_id,
      jsonb_build_object(
        'next_status', 'UNLOADING',
        'proof', jsonb_build_object(
          'path', 'supabase://shipment-proof/demo-world-readiness.png',
          'original_name', 'demo-world-readiness.png',
          'mime_type', 'image/png'
        )
      )
    );
  exception when raise_exception then
    denied := sqlerrm = 'TRACKING_LOADING_PROOF_REQUIRED';
  end;
  if not denied then
    raise exception 'IMPORTED_TRACKING_ADVANCED_WITHOUT_LOADING_PROOF';
  end if;
  if (select operational_status from public.provider_shipments where id = demo_id)
       <> 'IN_TRANSIT'
    or (select count(*) from public.provider_shipment_events
        where shipment_id = demo_id) <> event_count
    or (select count(*) from public.demo_world_tracking_notification_sink
        where shipment_id = demo_id) <> sink_count
    or (select count(*) from public.email_deliveries
        where shipment_id = demo_id) <> email_count
    or (select count(*) from public.native_push_outbox
        where source_id = demo_id) <> push_count then
    raise exception 'DENIED_TRACKING_TRANSITION_LEFT_EFFECTS';
  end if;

  raise notice 'PASS: imported demo remains in transit; missing loading proof blocks unloading without side effects';
end
$test$;

rollback;
