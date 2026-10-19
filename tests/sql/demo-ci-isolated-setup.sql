-- FEAT-SIM-001 / FEAT-GPS-001. Prepare only the two allowlisted fictional
-- targets in CI's disposable Loadgistic clone. Never run on the local preview
-- or a hosted database. The clone is dropped after the regression suites.
begin;
do $setup$
declare
  company constant uuid := 'caf1d0db-4d8e-4ce9-a879-6c7b6017de3a';
  personal constant uuid := '2f22cc5a-d654-4405-98b7-9a1a9cf42fe3';
  company_org constant uuid := '6727b198-d771-436a-9f1f-7bf27b8cea2f';
  personal_profile constant uuid := 'c640c548-ada2-4b9e-ac3c-235585525a6f';
  gateway uuid;
  company_device uuid;
  personal_device uuid;
  company_owner uuid;
  personal_owner uuid;
  target record;
  existing_count integer;
begin
  if current_database() <> 'loadgistic_telematics_ci' then
    raise exception 'ISOLATED_DEMO_TEST_DATABASE_REQUIRED';
  end if;
  if (select count(*) from vehicles where active and
      (id = company and organization_id = company_org and provider_profile_id is null or
       id = personal and provider_profile_id = personal_profile and organization_id is null)) <> 2 then
    raise exception 'ISOLATED_DEMO_VEHICLES_REQUIRED';
  end if;
  select m.user_id into company_owner from organization_members m
    where m.organization_id = company_org and m.membership_role = 'OWNER';
  select p.user_id into personal_owner from provider_profiles p where p.id = personal_profile;
  if company_owner is null or personal_owner is null or not exists (
    select 1 from auth.users u join profiles p on p.id = u.id and p.active
    where u.id = company_owner and u.raw_app_meta_data->>'fixture_source' = 'loadgistic'
      and u.raw_user_meta_data->>'fixture_key' = 'user-transporter'
      and (lower(u.email) = 'transporter@loadgistic.local' or
        lower(u.email) ~ '^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')
  ) or not exists (
    select 1 from auth.users u join profiles p on p.id = u.id and p.active
    where u.id = personal_owner and u.raw_app_meta_data->>'fixture_source' = 'loadgistic'
      and u.raw_user_meta_data->>'fixture_key' = 'user-driver'
      and (lower(u.email) = 'driver@loadgistic.local' or
        lower(u.email) ~ '^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$')
  ) then raise exception 'ISOLATED_DEMO_OWNERS_REQUIRED'; end if;
  if not exists (select 1 from driver_vehicle_assignments where vehicle_id = company and active)
    or not exists (select 1 from driver_vehicle_assignments where vehicle_id = personal and active)
    then raise exception 'ISOLATED_DEMO_DRIVERS_REQUIRED'; end if;

  select count(*) into existing_count from telematics_devices
    where imei in ('990000000000001', '990000000000002');
  if existing_count not in (0, 2) then raise exception 'ISOLATED_DEMO_PARTIAL_DEVICE_FIXTURE'; end if;
  if existing_count = 0 then
    gateway := gen_random_uuid();
    insert into telematics_gateways (id, label, token_digest, synthetic_only)
      values (gateway, 'Isolated fictional CI gateway', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), true);
    insert into telematics_devices (gateway_id, gateway_device_id, imei, protocol,
      protocol_device_id, organization_id, label, model_profile, synthetic)
      values (gateway, 9001, '990000000000001', 'gt06', '990000000000001',
        company_org, 'Fictional CI tracker one', 'SYNTHETIC_GT06', true)
      returning id into company_device;
    insert into telematics_devices (gateway_id, gateway_device_id, imei, protocol,
      protocol_device_id, provider_profile_id, label, model_profile, synthetic)
      values (gateway, 9002, '990000000000002', 'gt06', '990000000000002',
        personal_profile, 'Fictional CI tracker two', 'SYNTHETIC_GT06', true)
      returning id into personal_device;
    insert into telematics_device_assignments (device_id, vehicle_id, assigned_by)
      values (company_device, company, company_owner), (personal_device, personal, personal_owner);
  else
    for target in select d.*, g.active as gateway_active, g.synthetic_only as gateway_synthetic,
      a.vehicle_id as assigned_vehicle from telematics_devices d
      join telematics_gateways g on g.id = d.gateway_id
      left join telematics_device_assignments a on a.device_id = d.id and a.ended_at is null
      where d.imei in ('990000000000001', '990000000000002') loop
      if not target.active or not target.gateway_active or not target.gateway_synthetic
        or not target.synthetic or target.model_profile <> 'SYNTHETIC_GT06'
        or target.protocol <> 'gt06' or target.protocol_device_id <> target.imei
        or (target.imei = '990000000000001' and
          (target.organization_id is distinct from company_org or target.provider_profile_id is not null or target.assigned_vehicle is distinct from company))
        or (target.imei = '990000000000002' and
          (target.provider_profile_id is distinct from personal_profile or target.organization_id is not null or target.assigned_vehicle is distinct from personal))
        then raise exception 'ISOLATED_DEMO_DEVICE_CHANGED'; end if;
    end loop;
  end if;
  insert into telematics_location_sources (vehicle_id, source, precision_km, selected_by)
    values (company, 'GPS', coalesce((select location_precision_km from capacities
      where vehicle_id = company order by updated_at desc, id desc limit 1), 10), company_owner),
      (personal, 'MOBILE', coalesce((select location_precision_km from capacities
      where vehicle_id = personal order by updated_at desc, id desc limit 1), 10), personal_owner)
    on conflict (vehicle_id) do update set source = excluded.source,
      precision_km = excluded.precision_km, selected_by = excluded.selected_by,
      manual_latitude = null, manual_longitude = null, revision = clock_timestamp();
  -- The production validator is deliberately stricter than the setup above.
  perform public.demo_motion_binding(company);
  perform public.demo_motion_binding(personal);
end $setup$;
commit;
