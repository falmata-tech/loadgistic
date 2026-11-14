-- FEAT-SIM-001 / NR-83. Run after 225 on an isolated fixture clone. This exercises
-- only ordinary creation and notification interception, never proof or approval.
begin;
set local statement_timeout = '45s';

-- Private test-only projection: compare complete rows without printing Auth,
-- location or recipient data. Scope is the approved organization and its actors.
create function pg_temp.tracking_owner_state(normal_actor uuid, approved_actor uuid)
returns jsonb language sql volatile as $state$
  with vehicles as (
    select id from public.vehicles
    where organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
  ), actors as (
    select normal_actor as id union select approved_actor
    union select user_id from public.organization_members
      where organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
    union select driver_user_id from public.driver_vehicle_assignments
      where vehicle_id in (select id from vehicles)
  ), shipments as (
    select id from public.provider_shipments
    where provider_organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
    union select '2cb3ecbd-e627-485d-99cc-7c9ae5d641bc'::uuid
    union select 'ab8e45be-d878-4aad-a9d9-32e0e64c991a'::uuid
  ), capacity_targets as (
    select target_key from public.demo_world_targets
    where organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
  ), rows as (
    select 'auth' as kind, to_jsonb(r) as value from auth.users r
      where id in (select id from actors)
    union all select 'profiles', to_jsonb(r) from public.profiles r
      where id in (select id from actors)
    union all select 'members', to_jsonb(r) from public.organization_members r
      where organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
    union all select 'organization', to_jsonb(r) from public.organizations r
      where id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
    union all select 'pages', to_jsonb(r) from public.company_pages r
      where organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
        or provider_profile_id in (select id from public.provider_profiles
          where user_id in (select id from actors))
    union all select 'provider_profiles', to_jsonb(r) from public.provider_profiles r
      where user_id in (select id from actors)
    union all select 'vehicles', to_jsonb(r) from public.vehicles r
      where id in (select id from vehicles)
    union all select 'assignments', to_jsonb(r) from public.driver_vehicle_assignments r
      where vehicle_id in (select id from vehicles)
    union all select 'sharing', to_jsonb(r) from public.vehicle_capacity_sharing r
      where vehicle_id in (select id from vehicles)
    union all select 'business_grants', to_jsonb(r) from public.business_capacity_grants r
      where vehicle_id in (select id from vehicles)
    union all select 'phone_bindings', to_jsonb(r) from public.phone_location_bindings r
      where vehicle_id in (select id from vehicles)
    union all select 'gps_assignments', to_jsonb(r) from public.telematics_device_assignments r
      where vehicle_id in (select id from vehicles)
    union all select 'sources', to_jsonb(r) from public.telematics_location_sources r
      where vehicle_id in (select id from vehicles)
    union all select 'driver_locations', to_jsonb(r) from public.vehicle_driver_locations r
      where vehicle_id in (select id from vehicles)
    union all select 'gps_positions', to_jsonb(r) from public.telematics_positions r
      where vehicle_id in (select id from vehicles)
    union all select 'capacities', to_jsonb(r) from public.capacities r
      where vehicle_id in (select id from vehicles)
    union all select 'capacity_targets', to_jsonb(r) from public.demo_world_targets r
      where target_key in (select target_key from capacity_targets)
    union all select 'capacity_jobs', to_jsonb(r) from public.demo_world_steps r
      where target_key in (select target_key from capacity_targets)
    union all select 'capacity_receipts', to_jsonb(r) from public.demo_world_receipts r
      where vehicle_id in (select id from vehicles)
    union all select 'world_control', to_jsonb(r) from public.demo_world_control r
    union all select 'lifecycle_control', to_jsonb(r)
      from public.demo_world_tracking_lifecycle_control r
    union all select 'live_control', to_jsonb(r)
      from public.demo_world_tracking_live_control r
    union all select 'shipments', to_jsonb(r) from public.provider_shipments r
      where id in (select id from shipments)
    union all select 'recipients', to_jsonb(r) from public.provider_tracking_recipients r
      where shipment_id in (select id from shipments)
    union all select 'otps', to_jsonb(r) from public.provider_tracking_email_otps r
      where shipment_id in (select id from shipments)
    union all select 'email', to_jsonb(r) from public.email_deliveries r
      where shipment_id in (select id from shipments)
    union all select 'access_email', to_jsonb(r) from public.access_email_deliveries r
      where entity_id in (select id from shipments)
        or entity_id in (select id from public.provider_tracking_email_otps
          where shipment_id in (select id from shipments))
    union all select 'push', to_jsonb(r) from public.native_push_outbox r
      where source_id in (select id from shipments)
    union all select 'sink', to_jsonb(r)
      from public.demo_world_tracking_notification_sink r
      where shipment_id in (select id from shipments)
    union all select 'audit', to_jsonb(r) from public.audit_logs r
      where organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'::uuid
        or actor_user_id in (select id from actors)
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'row', value)
    order by kind, value::text), '[]'::jsonb) from rows;
$state$;

do $test$
declare
  target_id constant uuid := '2cb3ecbd-e627-485d-99cc-7c9ae5d641bc';
  owner_email constant text := 'demo.lifecycle.owner@example.test';
  owner_id uuid;
  driver_id uuid;
  owner_recipient uuid;
  installation_id uuid := gen_random_uuid();
  binding_id uuid := gen_random_uuid();
  command jsonb;
  created jsonb;
  unrelated_id uuid := gen_random_uuid();
  otp_id uuid := gen_random_uuid();
  denied boolean := false;
  coowner_id uuid := gen_random_uuid();
  forged boolean;
  before_owner_state jsonb;
  before_coowner_state jsonb;
begin
  if current_database() not in (
    'loadgistic_demo_lifecycle_191_ci', 'loadgistic_telematics_ci'
  ) then
    raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';
  end if;
  if not public.demo_world_tracking_lifecycle_actor_ready()
    or exists (select 1 from public.provider_shipments where id = target_id)
    or exists (select 1 from public.demo_world_tracking_lifecycle_control
      where id = 1 and armed) then
    raise exception 'DEMO_TRACKING_BASELINE_DRIFT';
  end if;
  if has_table_privilege('service_role',
      'public.demo_world_tracking_lifecycle_control', 'UPDATE')
    or has_function_privilege('service_role',
      'public.demo_world_tracking_lifecycle_armed()', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.demo_world_tracking_lifecycle_scope()', 'EXECUTE') then
    raise exception 'DEMO_TRACKING_RESERVATION_EXPOSED';
  end if;
  select actor.id into strict owner_id
  from auth.users actor join public.profiles profile on profile.id = actor.id
  where actor.raw_app_meta_data->>'fixture_source' = 'loadgistic'
    and actor.raw_user_meta_data->>'fixture_key' = 'user-transporter'
    and profile.active;
  command := jsonb_build_object(
    'id', target_id,
    'code', 'LGX-2CB3ECBD',
    'vehicle_id', '76bea7fa-03b2-42f0-af51-fff05c62cbc7',
    'origin_place_ref', 'builtin:addis ababa',
    'passing_place_ref', 'builtin:adama',
    'destination_place_ref', 'builtin:dire dawa',
    'cargo_summary', 'Demonstration cargo only',
    'customer_email', owner_email,
    'customer_email_digest', repeat('b', 64),
    'additional_recipients', '[]'::jsonb,
    'expected_pickup_date', current_date::text,
    'expected_delivery_date', (current_date + 2)::text,
    'tracking_mode', 'LOCATION_AND_STATUS',
    'tracking_code_hash', repeat('a', 64),
    'review_code_hash', repeat('c', 64)
  );

  -- NR-83: an ordinary account joining as co-owner makes this organization
  -- ineligible even while its original operator-marked owner remains. The
  -- nested fixture is rolled back before the existing positive reservation flow.
  before_owner_state := pg_temp.tracking_owner_state(coowner_id, owner_id);
  begin
    insert into auth.users
      (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
    values (coowner_id, coowner_id::text || '@example.invalid',
      clock_timestamp(), '{}'::jsonb, '{}'::jsonb);
    update public.profiles set role = 'TRANSPORTER', active = true
    where id = coowner_id;
    insert into public.organization_members
      (user_id, organization_id, membership_role)
    values (coowner_id, '6727b198-d771-436a-9f1f-7bf27b8cea2f', 'OWNER');
    -- Global enablement is intentional fixture setup, so the tested arming
    -- refusal must come from changed ownership rather than the global switch.
    update public.demo_world_control set enabled = true,
      activated_at = clock_timestamp() where id = 1;

    foreach forged in array array[false, true] loop
      if forged then
        update auth.users set raw_user_meta_data = jsonb_build_object(
          'fixture_source', 'loadgistic', 'is_demo', true,
          'fixture_key', 'user-transporter') where id = coowner_id;
      end if;
      if not exists (
        select 1 from auth.users actor
        join public.profiles profile on profile.id = actor.id
        join public.organization_members member on member.user_id = actor.id
        where actor.id = coowner_id and actor.raw_app_meta_data = '{}'::jsonb
          and profile.active and profile.role::text = 'TRANSPORTER'
          and member.organization_id = '6727b198-d771-436a-9f1f-7bf27b8cea2f'
          and member.membership_role = 'OWNER'
      ) then
        raise exception 'ORDINARY_COOWNER_FIXTURE_INVALID';
      end if;
      before_coowner_state := pg_temp.tracking_owner_state(coowner_id, owner_id);
      if public.demo_world_tracking_lifecycle_actor_ready() is distinct from false
        or public.demo_world_tracking_live_actor_ready() is distinct from false then
        raise exception 'COOWNER_REMAINED_TRACKING_ELIGIBLE';
      end if;
      denied := false;
      begin
        update public.demo_world_tracking_lifecycle_control set armed = true where id = 1;
      exception when raise_exception then
        denied := sqlerrm = 'DEMO_TRACKING_RESERVATION_NOT_READY';
      end;
      if not denied or exists (
        select 1 from public.demo_world_tracking_lifecycle_control where id = 1 and armed
      ) or pg_temp.tracking_owner_state(coowner_id, owner_id)
        is distinct from before_coowner_state then
        raise exception 'COOWNER_ARM_DENIAL_CHANGED_STATE';
      end if;
      denied := false;
      begin
        perform public.create_provider_tracking_with_recipients(owner_id, command);
      exception when raise_exception then
        denied := sqlerrm = 'DEMO_TRACKING_SCOPE_CHANGED';
      end;
      if not denied or pg_temp.tracking_owner_state(coowner_id, owner_id)
        is distinct from before_coowner_state then
        raise exception 'COOWNER_CREATE_DENIAL_CHANGED_STATE';
      end if;
    end loop;
    raise exception using errcode = 'P2251',
      message = 'rollback ordinary Tracking co-owner fixture';
  exception when sqlstate 'P2251' then null;
  end;
  if public.demo_world_tracking_lifecycle_actor_ready() is distinct from true
    or public.demo_world_tracking_live_actor_ready() is distinct from true
    or pg_temp.tracking_owner_state(coowner_id, owner_id)
      is distinct from before_owner_state then
    raise exception 'COOWNER_FIXTURE_ROLLBACK_FAILED';
  end if;
  denied := false;

  begin
    perform public.create_provider_tracking_with_recipients(owner_id, command);
  exception when raise_exception then
    denied := sqlerrm = 'DEMO_TRACKING_SCOPE_CHANGED';
  end;
  if not denied or exists (
    select 1 from public.provider_shipments where id = target_id
  ) or exists (
    select 1 from public.email_deliveries where shipment_id = target_id
  ) or exists (
    select 1 from public.demo_world_tracking_notification_sink
    where shipment_id = target_id
  ) then
    raise exception 'DISARMED_CREATION_NOT_ATOMICALLY_DENIED';
  end if;

  denied := false;
  begin
    update public.demo_world_tracking_lifecycle_control
    set armed = true where id = 1;
  exception when raise_exception then
    denied := sqlerrm = 'DEMO_TRACKING_RESERVATION_NOT_READY';
  end;
  if not denied or exists (
    select 1 from public.demo_world_tracking_lifecycle_control
    where id = 1 and armed
  ) then
    raise exception 'GLOBAL_DEMO_DISABLED_BUT_TRACKING_ARMED';
  end if;

  update public.demo_world_control set enabled = true,
    activated_at = clock_timestamp() where id = 1;
  update public.demo_world_tracking_lifecycle_control
  set armed = true where id = 1;
  denied := false;
  begin
    perform public.create_provider_tracking_with_recipients(
      owner_id, command || jsonb_build_object(
        'customer_email', 'outside@example.test'
      )
    );
  exception when raise_exception then
    denied := sqlerrm = 'DEMO_TRACKING_SCOPE_CHANGED';
  end;
  if not denied or exists (
    select 1 from public.provider_shipments where id = target_id
  ) then
    raise exception 'FORGED_OWNER_CREATED_DEMO_SHIPMENT';
  end if;
  created := public.create_provider_tracking_with_recipients(owner_id, command);
  if created->>'id' <> target_id::text
    or not public.demo_world_tracking_lifecycle_scope()
    or not exists (
      select 1 from public.provider_shipments
      where id = target_id and operational_status = 'CREATED'
        and handover_approved_at is null
    ) or not exists (
      select 1 from public.demo_world_tracking_notification_sink
      where shipment_id = target_id and source_kind = 'EMAIL'
        and source_key = 'tracking-access:' || target_id::text
        and event_kind = 'TRACKING_ACCESS' and recipient_role = 'OWNER'
    ) or exists (
      select 1 from public.email_deliveries where shipment_id = target_id
    ) then
    raise exception 'ORDINARY_CREATION_OR_ACCESS_SINK_FAILED';
  end if;
  select id into strict owner_recipient
  from public.provider_tracking_recipients
  where shipment_id = target_id and recipient_role = 'OWNER'
    and recipient_email = owner_email;
  select assigned_driver_user_id into strict driver_id
  from public.provider_shipments where id = target_id;

  if not public.request_tracking_email_session(
      otp_id, owner_email, repeat('b', 64), repeat('a', 64),
      clock_timestamp() + interval '5 minutes') then
    raise exception 'NORMAL_OWNER_OTP_COMMAND_REFUSED';
  end if;
  if not exists (
      select 1 from public.provider_tracking_email_otps
      where id = otp_id and shipment_id = target_id
        and recipient_id = owner_recipient
    ) or not exists (
      select 1 from public.demo_world_tracking_notification_sink
      where shipment_id = target_id and source_kind = 'EMAIL'
        and source_key = 'tracking-otp:' || otp_id::text
        and event_kind = 'TRACKING_OTP'
    ) or exists (
      select 1 from public.access_email_deliveries
      where entity_id = otp_id
    ) then
    raise exception 'OWNER_OTP_ESCAPED_PRIVATE_SINK';
  end if;

  denied := false;
  begin
    insert into public.email_deliveries
      (id, shipment_id, party_role, delivery_kind, recipient_email,
       idempotency_key, status)
    values (gen_random_uuid(), target_id, 'SHIPPER', 'COMPLETION',
      'outside@example.com', 'demo-lifecycle-191:foreign', 'PENDING');
  exception when raise_exception then
    denied := sqlerrm = 'DEMO_TRACKING_SCOPE_CHANGED';
  end;
  if not denied or exists (
    select 1 from public.email_deliveries
    where idempotency_key = 'demo-lifecycle-191:foreign'
  ) then
    raise exception 'FOREIGN_EMAIL_ESCAPED_SINK';
  end if;

  insert into public.native_push_installations
    (id, secret_digest, expo_token, locale)
  values (installation_id, repeat('d', 64),
    'ExpoPushToken[DemoWorldLifecycle191]', 'en');
  insert into public.native_push_bindings
    (id, installation_id, audience, actor_user_id,
     auth_session_id, expires_at)
  values (binding_id, installation_id, 'MEMBER', driver_id,
    gen_random_uuid(), clock_timestamp() + interval '1 day');
  insert into public.native_push_outbox
    (binding_id, kind, source_id, event, event_key)
  values (binding_id, 'HANDOVER', target_id, 'APPROVED',
    'demo-lifecycle-191:push');
  if exists (
    select 1 from public.native_push_outbox
    where event_key = 'demo-lifecycle-191:push'
  ) or not exists (
    select 1 from public.demo_world_tracking_notification_sink
    where shipment_id = target_id and source_kind = 'PUSH'
      and source_key = 'demo-lifecycle-191:push'
      and event_kind = 'HANDOVER' and recipient_role = 'DRIVER'
  ) then
    raise exception 'DRIVER_HANDOVER_PUSH_ESCAPED_SINK';
  end if;
  denied := false;
  begin
    insert into public.native_push_outbox
      (binding_id, kind, source_id, event, event_key)
    values (binding_id, 'SUPPORT', target_id, 'APPROVED',
      'demo-lifecycle-191:foreign-push');
  exception when raise_exception then
    denied := sqlerrm = 'DEMO_TRACKING_SCOPE_CHANGED';
  end;
  if not denied or exists (
    select 1 from public.native_push_outbox
    where event_key = 'demo-lifecycle-191:foreign-push'
  ) then
    raise exception 'FOREIGN_PUSH_ESCAPED_SINK';
  end if;

  -- The new reservation must not intercept a different synthetic shipment.
  insert into public.provider_shipments
  select (jsonb_populate_record(null::public.provider_shipments,
    to_jsonb(shipment) || jsonb_build_object(
      'id', unrelated_id,
      'code', 'LGX-CI-' || substr(replace(unrelated_id::text, '-', ''), 1, 12),
      'operational_status', 'COMPLETED',
      'completed_at', clock_timestamp(),
      'review_code_hash', null
    ))).*
  from public.provider_shipments shipment where shipment.id = target_id;
  insert into public.email_deliveries
    (id, shipment_id, party_role, delivery_kind, recipient_email,
     idempotency_key, status)
  values (gen_random_uuid(), unrelated_id, 'SHIPPER', 'COMPLETION',
    'ordinary-owner@example.test', 'ordinary-lifecycle-191:email', 'PENDING');
  if not exists (
    select 1 from public.email_deliveries
    where shipment_id = unrelated_id
      and idempotency_key = 'ordinary-lifecycle-191:email'
      and status = 'PENDING'
  ) or exists (
    select 1 from public.demo_world_tracking_notification_sink
    where source_key = 'ordinary-lifecycle-191:email'
  ) then
    raise exception 'ORDINARY_SHIPMENT_NOTIFICATION_CHANGED';
  end if;

  update public.demo_world_tracking_lifecycle_control
  set armed = false where id = 1;
  denied := false;
  begin
    insert into public.email_deliveries
      (id, shipment_id, party_role, delivery_kind, recipient_email,
       idempotency_key, status)
    values (gen_random_uuid(), target_id, 'SHIPPER', 'COMPLETION',
      owner_email, 'demo-lifecycle-191:disarmed', 'PENDING');
  exception when raise_exception then
    denied := sqlerrm = 'DEMO_TRACKING_SCOPE_CHANGED';
  end;
  if not denied or exists (
    select 1 from public.email_deliveries
    where idempotency_key = 'demo-lifecycle-191:disarmed'
  ) then
    raise exception 'DISARMED_NOTIFICATION_ESCAPED_SINK';
  end if;

  raise notice 'PASS: fixed new shipment creates only while armed; access/OTP/driver push sinked; foreign/disarmed intents denied';
end
$test$;

rollback;
