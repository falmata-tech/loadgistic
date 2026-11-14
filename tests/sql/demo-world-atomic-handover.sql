-- FEAT-SIM-001. Run after migrations221/223 on the disposable fixture clone.
-- Every mutation in this test rolls back; never point this file at preview/hosted.
begin;
do $test$
declare
  vehicle_a uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  capacity_count bigint;assignment_count bigint;featured_count bigint;
  original_a uuid;original_b uuid;outcome jsonb;denied boolean;future_day uuid;featured_failure text;
begin
  if current_database() not in('loadgistic_demo_handover_187_ci','loadgistic_telematics_ci')
    then raise exception 'ISOLATED_HANDOVER_TEST_DATABASE_REQUIRED';end if;
  if has_function_privilege('anon','public.demo_world_execute_atomic_handover()','EXECUTE')
    or has_function_privilege('authenticated','public.demo_world_execute_atomic_handover()','EXECUTE')
    or has_function_privilege('service_role','public.demo_world_execute_atomic_handover()','EXECUTE')
    or has_table_privilege('service_role','public.demo_world_handover_receipts','INSERT')
    then raise exception 'HANDOVER_PERMISSION_DRIFT';end if;
  if (select enabled from public.demo_world_control where id=1)
    then raise exception 'HANDOVER_DEFAULT_ENABLED';end if;
  select count(*) into capacity_count from public.capacities where vehicle_id in(vehicle_a,vehicle_b);
  select count(*) into assignment_count from public.driver_vehicle_assignments
    where vehicle_id in(vehicle_a,vehicle_b);
  select count(*) into featured_count from public.featured_provider_slots
    where vehicle_id in(vehicle_a,vehicle_b);
  select driver_user_id into original_a from public.driver_vehicle_assignments
    where vehicle_id=vehicle_a and active;
  select driver_user_id into original_b from public.driver_vehicle_assignments
    where vehicle_id=vehicle_b and active;
  if original_a is null or original_b is null or original_a=original_b
    then raise exception 'HANDOVER_FIXTURE_ASSIGNMENT_MISSING';end if;
  if (select count(*) from public.vehicle_capacity_sharing s
      where s.vehicle_id in(vehicle_a,vehicle_b) and s.mode='PUBLIC'
        and s.exclusive_email is null and s.exclusive_digest is null)<>2
    then raise exception 'HANDOVER_FIXTURE_PUBLIC_SHARING_MISSING: %/%',
      coalesce((select mode::text from public.vehicle_capacity_sharing where vehicle_id=vehicle_a),'MISSING'),
      coalesce((select mode::text from public.vehicle_capacity_sharing where vehicle_id=vehicle_b),'MISSING');end if;
  -- Fresh managed fixtures may feature either driver today. Put only their
  -- current/future days in the past within this rollback-only test, so the
  -- device and sharing denials below are reached in the intended order. The
  -- explicit Featured denial later restores a future day for this scenario.
  with affected as (
    select day.id,row_number() over(order by day.id)::integer as ordinal
    from public.featured_provider_days day
    where day.feature_date>=current_date and exists(
      select 1 from public.featured_provider_slots slot
      where slot.day_id=day.id and
        (slot.vehicle_id in(vehicle_a,vehicle_b)
         or slot.driver_user_id in(original_a,original_b)))
  )
  update public.featured_provider_days day
    set feature_date=current_date-1000-affected.ordinal
  from affected where day.id=affected.id;
  denied:=false;
  begin perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_DISABLED';end;
  if not denied then raise exception 'HANDOVER_KILL_SWITCH_BYPASSED';end if;
  update public.demo_world_control set enabled=true,activated_at=clock_timestamp() where id=1;
  denied:=false;
  begin
    update auth.users set raw_app_meta_data=raw_app_meta_data-'fixture_source' where id=original_a;
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_DRIVER_REFUSED';end;
  if not denied then raise exception 'HANDOVER_UNMARKED_DRIVER_ACCEPTED';end if;
  denied:=false;
  begin
    insert into public.provider_shipments(code,provider_organization_id,assigned_vehicle_id,
      assigned_driver_user_id,origin,origin_place_ref,origin_lat,origin_lng,destination,
      destination_place_ref,destination_lat,destination_lng,cargo_summary,shipper_email,
      receiver_email,operational_status,created_by,tracking_location_source,tracking_source_started_at)
    select 'LGX-HANDOVER-TEST','c36022ff-bf3e-432d-ae96-93d1537cf79e',vehicle_a,original_a,
      'Addis Ababa','builtin:addis ababa',9.00646,38.73172,
      'Adama','builtin:adama',8.51674,39.26118,'Synthetic test cargo',
      'sender@example.test','receiver@example.test','CREATED',u.id,'MOBILE',clock_timestamp()
    from auth.users u where u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01';
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_ACTIVE_TRACKING';end;
  if not denied then raise exception 'HANDOVER_ACTIVE_SHIPMENT_ACCEPTED';end if;
  denied:=false;
  begin
    insert into public.phone_location_installations(id,secret_digest)
      values('00000000-0000-4000-8000-000000018700',repeat('a',64));
    insert into public.phone_location_bindings(installation_id,actor_user_id,vehicle_id,
      auth_session_id,expires_at)
      values('00000000-0000-4000-8000-000000018700',original_a,vehicle_a,
        '00000000-0000-4000-8000-000000018701',clock_timestamp()+interval '1 day');
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_DEVICE_REFUSED';end;
  if not denied then raise exception 'HANDOVER_PHONE_BINDING_ACCEPTED';end if;
  denied:=false;
  begin
    update public.vehicle_capacity_sharing set mode='BOTH' where vehicle_id=vehicle_b;
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_SHARING_REFUSED';end;
  if not denied then raise exception 'HANDOVER_AUDIENCE_DRIFT_ACCEPTED';end if;
  denied:=false;
  begin
    insert into public.telematics_location_sources(vehicle_id,source,precision_km,selected_by,
      selected_at,revision) values(vehicle_a,'MOBILE',10,original_a,clock_timestamp(),clock_timestamp());
    perform public.demo_world_execute_atomic_handover();
  exception when others then denied:=sqlerrm='DEMO_HANDOVER_SOURCE_REFUSED';end;
  if not denied then raise exception 'HANDOVER_REAL_SOURCE_ACCEPTED';end if;
  denied:=false;
  featured_failure:=null;
  begin
    -- Today's category may contain neither handover vehicle. Create the
    -- exact future conflict here instead of borrowing the rotating roster.
    insert into public.featured_provider_days(feature_date,base_place_ref,base_place_label,status)
      select greatest(current_date+100,coalesce(max(feature_date)+1,current_date+100)),
        'builtin:addis ababa','Synthetic handover guard','PUBLISHED'
      from public.featured_provider_days
      returning id into future_day;
    insert into public.featured_provider_slots(day_id,slot_position,provider_organization_id,
      vehicle_id,driver_user_id) values(future_day,1,
      'c36022ff-bf3e-432d-ae96-93d1537cf79e',vehicle_a,original_a);
    perform public.demo_world_execute_atomic_handover();
  exception when others then
    featured_failure:=case when sqlerrm~'^DEMO_[A-Z0-9_]+$' then sqlerrm else 'OTHER_SQL_ERROR' end;
    denied:=featured_failure='DEMO_HANDOVER_SAVED_FEATURED';
  end;
  if not denied then raise exception 'HANDOVER_FUTURE_FEATURED_ACCEPTED: %',coalesce(featured_failure,'NO_ERROR');end if;
  if (select count(*) from public.capacities where vehicle_id in(vehicle_a,vehicle_b))<>capacity_count
    then raise exception 'HANDOVER_DENIAL_WROTE_CAPACITY';end if;
end $test$;

-- The exact historical scenario is held before its first mutation. Neither a
-- direct internal call nor a retry may advance it or create Manual locations.
create function pg_temp.handover_state() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'capacities',(select jsonb_agg(to_jsonb(c) order by c.id) from public.capacities c
    where c.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'assignments',(select jsonb_agg(to_jsonb(a) order by a.id) from public.driver_vehicle_assignments a
    where a.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'sources',(select jsonb_agg(to_jsonb(s) order by s.vehicle_id) from public.telematics_location_sources s
    where s.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'locations',(select jsonb_agg(to_jsonb(l) order by l.vehicle_id) from public.vehicle_driver_locations l
    where l.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'sharing',(select jsonb_agg(to_jsonb(s) order by s.vehicle_id) from public.vehicle_capacity_sharing s
    where s.vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7')),
  'permissions',(select jsonb_agg(to_jsonb(p) order by p.user_id) from public.driver_permissions p
    where p.user_id in(select driver_user_id from public.driver_vehicle_assignments
      where vehicle_id in('54eb0674-4aa2-4975-bc1b-18999463a5b7','49d736cb-cd47-47dd-9f8d-2f7c1e8199e7'))),
  'featured',(select jsonb_agg(to_jsonb(s) order by s.id) from public.featured_provider_slots s),
  'control',(select to_jsonb(c) from public.demo_world_control c where c.id=1),
  'receipts',(select jsonb_agg(to_jsonb(r) order by r.simulation_day) from public.demo_world_handover_receipts r)
 )
$$;

do $test$
declare
  vehicle_a uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  before_state jsonb;denied boolean;attempt integer;failure_code text;owner_id uuid;source_revision timestamptz;
begin
  before_state:=pg_temp.handover_state();
  for attempt in 1..2 loop
    denied:=false;
    begin perform public.demo_world_execute_atomic_handover();
    exception when others then
      failure_code:=sqlerrm;denied:=failure_code='DEMO_MANUAL_LANE_HELD';
    end;
    if not denied then raise exception 'HANDOVER_MANUAL_LANE_NOT_HELD: %',coalesce(failure_code,'NO_ERROR');end if;
    if pg_temp.handover_state() is distinct from before_state
      then raise exception 'HANDOVER_MANUAL_DENIAL_LEFT_PARTIAL_STATE';end if;
  end loop;
  select u.id into owner_id from auth.users u where u.raw_app_meta_data->>'fixture_source'='loadgistic'
    and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01';
  select revision into source_revision from public.telematics_location_sources where vehicle_id=vehicle_a;
  denied:=false;
  begin perform public.select_telematics_location_source(owner_id,jsonb_build_object(
    'vehicleId',vehicle_a,'source','MANUAL','precisionKm',10,
    'expectedRevision',coalesce(source_revision,'1970-01-01'::timestamptz),
    'manualLatitude',9.03,'manualLongitude',38.75));
  exception when others then denied:=sqlerrm='INVALID_TELEMATICS_INPUT';end;
  if not denied or pg_temp.handover_state() is distinct from before_state
    then raise exception 'HANDOVER_DIRECT_MANUAL_MUTATION_NOT_DENIED';end if;
end $test$;

do $test$
declare
  vehicle_a uuid:='54eb0674-4aa2-4975-bc1b-18999463a5b7';
  vehicle_b uuid:='49d736cb-cd47-47dd-9f8d-2f7c1e8199e7';
  original_a uuid;original_b uuid;owner_id uuid;outcome jsonb;replay jsonb;denied boolean:=false;
  prior_a public.capacities%rowtype;prior_b public.capacities%rowtype;
  before_state jsonb;
begin
  select driver_user_id into original_a from public.driver_vehicle_assignments
    where vehicle_id=vehicle_a and active;
  select driver_user_id into original_b from public.driver_vehicle_assignments
    where vehicle_id=vehicle_b and active;
  select u.id into owner_id from auth.users u where u.raw_app_meta_data->>'fixture_source'='loadgistic'
    and u.raw_user_meta_data->>'fixture_key'='user-public-fleet-01';
  select * into prior_a from public.capacities where vehicle_id=vehicle_a order by updated_at desc,id desc limit 1;
  select * into prior_b from public.capacities where vehicle_id=vehicle_b order by updated_at desc,id desc limit 1;
  -- Seed only dated historical rows to retain replay/immutability coverage.
  -- These are disposable test fixtures, not new Manual command permissions.
  update public.capacities set location_source='MANUAL_ADMIN' where id in(prior_a.id,prior_b.id);
  insert into public.demo_world_handover_receipts(simulation_day,owner_user_id,vehicle_a_id,vehicle_b_id,
    previous_driver_a_id,previous_driver_b_id,previous_capacity_a_id,previous_capacity_b_id,
    published_capacity_a_id,published_capacity_b_id)
  values((clock_timestamp() at time zone 'UTC')::date,owner_id,vehicle_a,vehicle_b,
    original_b,original_a,prior_a.id,prior_b.id,prior_a.id,prior_b.id);
  update public.demo_world_control set enabled=false where id=1;
  before_state:=pg_temp.handover_state();
  outcome:=public.demo_world_execute_atomic_handover();
  replay:=public.demo_world_execute_atomic_handover();
  if outcome->>'replayed'<>'true' or outcome->>'vehicleCount'<>'2' or replay->>'replayed'<>'true'
    or pg_temp.handover_state() is distinct from before_state
    then raise exception 'HANDOVER_HISTORICAL_REPLAY_CHANGED_STATE';end if;
  begin update public.demo_world_handover_receipts set applied_at=clock_timestamp();
  exception when others then denied:=sqlerrm='DEMO_WORLD_RECEIPT_IMMUTABLE';end;
  if not denied then raise exception 'HANDOVER_RECEIPT_MUTABLE';end if;
end $test$;
rollback;
