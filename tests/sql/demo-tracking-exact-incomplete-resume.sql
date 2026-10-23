-- FEAT-SIM-001. Rollback-only test after migrations 191 and 193 on an isolated
-- fixture clone. A paused exact unfinished shipment can resume; a forged or
-- completed one cannot. No proof, OTP, email or approval leaves this test.
begin;
set local statement_timeout = '45s';

do $test$
declare
  target_id constant uuid := '2cb3ecbd-e627-485d-99cc-7c9ae5d641bc';
  actor_id uuid;
  foreign_id uuid;
  command jsonb;
  denied boolean;
begin
  if current_database() not in
    ('loadgistic_demo_lifecycle_191_ci', 'loadgistic_telematics_ci') then
    raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';
  end if;
  if not public.demo_world_tracking_lifecycle_actor_ready()
    or exists(select 1 from public.provider_shipments where id=target_id)
    or exists(select 1 from public.demo_world_tracking_lifecycle_control
      where id=1 and armed) then
    raise exception 'DEMO_TRACKING_BASELINE_DRIFT';
  end if;
  select id into strict actor_id from auth.users
  where raw_app_meta_data->>'fixture_source'='loadgistic'
    and raw_user_meta_data->>'fixture_key'='user-transporter';
  select id into strict foreign_id from auth.users
  where id <> actor_id order by id limit 1;
  command := jsonb_build_object(
    'id',target_id,'code','LGX-2CB3ECBD',
    'vehicle_id','76bea7fa-03b2-42f0-af51-fff05c62cbc7',
    'origin_place_ref','builtin:addis ababa',
    'passing_place_ref','builtin:adama',
    'destination_place_ref','builtin:dire dawa',
    'cargo_summary','Demonstration cargo only',
    'customer_email','demo.lifecycle.owner@example.test',
    'customer_email_digest',repeat('b',64),
    'additional_recipients','[]'::jsonb,
    'expected_pickup_date',current_date::text,
    'expected_delivery_date',(current_date+2)::text,
    'tracking_mode','LOCATION_AND_STATUS',
    'tracking_code_hash',repeat('a',64),
    'review_code_hash',repeat('c',64)
  );
  update public.demo_world_control set enabled=true,
    activated_at=clock_timestamp() where id=1;
  update public.demo_world_tracking_lifecycle_control
    set armed=true where id=1;
  perform public.create_provider_tracking_with_recipients(actor_id,command);
  update public.demo_world_tracking_lifecycle_control
    set armed=false where id=1;

  update public.demo_world_tracking_lifecycle_control
    set armed=true where id=1;
  if not public.demo_world_tracking_lifecycle_armed()
    or (select count(*) from public.provider_shipments where id=target_id)<>1
    or (select count(*) from public.demo_world_tracking_notification_sink
      where shipment_id=target_id and event_kind='TRACKING_ACCESS')<>1 then
    raise exception 'EXACT_INCOMPLETE_RESUME_FAILED';
  end if;
  update public.demo_world_tracking_lifecycle_control
    set armed=false where id=1;

  denied:=false;
  begin
    update public.demo_world_tracking_lifecycle_control
      set shipment_id='22222222-2222-4222-8222-222222222222'::uuid
      where id=1;
  exception when raise_exception then
    denied:=sqlerrm='DEMO_TRACKING_RESERVATION_IMMUTABLE';
  end;
  if not denied or (select shipment_id from
      public.demo_world_tracking_lifecycle_control where id=1)<>target_id then
    raise exception 'OTHER_SHIPMENT_ID_ACCEPTED';
  end if;

  denied:=false;
  begin
    update public.provider_shipments set created_by=foreign_id
      where id=target_id;
    update public.demo_world_tracking_lifecycle_control
      set armed=true where id=1;
  exception when raise_exception then
    denied:=sqlerrm='DEMO_TRACKING_RESERVATION_NOT_READY';
  end;
  if not denied or (select created_by from public.provider_shipments
      where id=target_id)<>actor_id then
    raise exception 'FOREIGN_ACTOR_RESUMED';
  end if;

  denied:=false;
  begin
    insert into public.demo_world_tracking_notification_sink
      (source_kind,source_key,shipment_id,event_kind,recipient_role)
    values ('EMAIL','tracking-access:duplicate',target_id,
      'TRACKING_ACCESS','OWNER');
    update public.demo_world_tracking_lifecycle_control
      set armed=true where id=1;
  exception when raise_exception then
    denied:=sqlerrm='DEMO_TRACKING_RESERVATION_NOT_READY';
  end;
  if not denied or exists(select 1 from public.demo_world_tracking_lifecycle_control
      where id=1 and armed)
    or (select count(*) from public.demo_world_tracking_notification_sink
      where shipment_id=target_id and event_kind='TRACKING_ACCESS')<>1 then
    raise exception 'DUPLICATE_ACCESS_INTENT_RESUMED';
  end if;

  denied:=false;
  begin
    update public.provider_shipments set operational_status='COMPLETED'
      where id=target_id;
    update public.demo_world_tracking_lifecycle_control
      set armed=true where id=1;
  exception when raise_exception then
    denied:=sqlerrm='DEMO_TRACKING_RESERVATION_NOT_READY';
  end;
  if not denied or (select operational_status from public.provider_shipments
      where id=target_id)<>'CREATED' then
    raise exception 'COMPLETED_SHIPMENT_RESUMED';
  end if;

  update public.demo_world_control set enabled=false where id=1;
  denied:=false;
  begin
    update public.demo_world_tracking_lifecycle_control
      set armed=true where id=1;
  exception when raise_exception then
    denied:=sqlerrm='DEMO_TRACKING_RESERVATION_NOT_READY';
  end;
  if not denied or exists(select 1 from public.demo_world_tracking_lifecycle_control
      where id=1 and armed) then
    raise exception 'GLOBAL_CONTROL_BYPASSED_ON_RESUME';
  end if;
end;
$test$;

rollback;
