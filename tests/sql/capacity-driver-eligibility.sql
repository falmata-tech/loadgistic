-- Isolated synthetic providers and drivers only. Every write rolls back;
-- this does not change seeded evidence, touch Storage objects or send email.
begin;
do $test$
declare
  driver_id uuid:=gen_random_uuid();
  owner_id uuid:=gen_random_uuid();
  truck_id uuid;
  org_id uuid:=gen_random_uuid();
  published_id uuid;
  independent_id uuid:=gen_random_uuid();
  independent_provider uuid:=gen_random_uuid();
  independent_truck uuid;
  command jsonb;
  recipient_digest text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
  broker_id uuid:=gen_random_uuid();broker_workspace uuid;connection_id uuid;
begin
  -- A fresh workspace proves no-document eligibility without removing the
  -- fictional source documents or reviews that belong to the shared CI seed.
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
    (owner_id,'eligibility-owner-'||owner_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}'),
    (driver_id,'eligibility-driver-'||driver_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}');
  update public.profiles set role='TRANSPORTER',active=true,drives_truck=false where id=owner_id;
  insert into public.organizations(id,name,handle,type,city,city_place_ref,public_visibility)
    values(org_id,'Synthetic eligibility provider','eligibility-provider-'||org_id,'TRANSPORT_COMPANY','Addis Ababa',
      (select id from public.place_catalog where normalized_name='addis ababa' limit 1),'PUBLIC');
  insert into public.organization_members(user_id,organization_id,membership_role) values(owner_id,org_id,'OWNER');
  insert into public.company_pages(organization_id,published,base_region_code,contact_phone,show_contact_phone)
    values(org_id,true,'ADDIS_ABABA','+251900000146',true);
  perform public.accept_content_policy(owner_id,'2026-10-09');
  perform public.fleet_accept_invitation(driver_id,public.fleet_invite_driver(owner_id,jsonb_build_object(
    'email','eligibility-driver-'||driver_id||'@loadgistic.local','name','Synthetic eligibility driver','phone','+251900000147')));
  perform public.accept_content_policy(driver_id,'2026-10-09');
  truck_id:=(public.create_provider_vehicle(owner_id,'{"make":"Isuzu","model":"Document-free fixture","plate":"ELIGIBILITY-NO-DOC","cargo_configuration":"Mini Box Truck","use_basis":"OWNED"}')->>'id')::uuid;
  perform public.update_fleet_driver_access(owner_id,jsonb_build_object('driver_user_id',driver_id,'vehicle_id',truck_id,'can_manage_capacity',true));
  if public.capacity_active_driver_id(truck_id) is distinct from driver_id then raise exception 'ACTIVE_DRIVER_NOT_RESOLVED'; end if;
  perform public.set_provider_vehicle_publication(owner_id,truck_id,'LIVE');
  if (public.managed_provider_publication_eligibility(owner_id)->>'liveTruckCount')::integer<>1
    or (public.managed_provider_publication_eligibility(owner_id)->>'qualifyingTruckCount')::integer<>0
    or exists(select 1 from public.verification_requests where subject_id in(driver_id,truck_id,org_id)) then
    raise exception 'DOCUMENT_FREE_FIRST_LIVE_SETUP_INVALID';
  end if;
  command:=jsonb_build_object('vehicle_id',truck_id,'status','EMPTY','accepted_loads','BOTH',
    'availability_geometry','ROUTE','visibility','OPEN','location_source','DEVICE_OBSCURED',
    'approximate_lat',9.03,'approximate_lng',38.76,'location_precision_km',20,
    'current_route_places',jsonb_build_array(
      jsonb_build_object('place_ref',(select id from public.place_catalog where name='Sebeta' limit 1)),
      jsonb_build_object('place_ref',(select id from public.place_catalog where name='Alem Gena' limit 1))));
  published_id:=public.publish_provider_capacity(driver_id,command);
  if not exists(select 1 from public.public_capacity_page(jsonb_build_object('capacity_id',published_id))) then
    raise exception 'NO_DOCUMENT_TRUCK_NOT_PUBLIC';
  end if;
  -- A registered broker sees this vehicle only after a specific account grant.
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
    values(broker_id,'eligibility-broker-'||broker_id||'@example.invalid',now(),'{}');
  update public.profiles set role='SHIPPER',active=true where id=broker_id;
  broker_workspace:=(public.business_workspace_create(broker_id,jsonb_build_object('name','Eligibility broker','handle','eligibility-'||substr(broker_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
  connection_id:=(public.request_account_connection(owner_id,'BUSINESS',broker_workspace)->>'id')::uuid;
  perform public.decide_account_connection(broker_id,connection_id,'ACCEPT');
  perform public.grant_account_capacity_access(owner_id,connection_id,truck_id);
  if not exists(select 1 from public.account_capacity_filtered_page(broker_id,recipient_digest)) then
    raise exception 'NO_DOCUMENT_TRUCK_NOT_PRIVATE';
  end if;

  -- An inactive Driver cannot be published merely because an assignment remains.
  update public.profiles set active=false where id=driver_id;
  begin
    perform public.publish_provider_capacity(owner_id,command||'{"location_source":"PRESERVE_DRIVER"}'::jsonb);
    raise exception 'INACTIVE_DRIVER_PUBLICATION_ALLOWED';
  exception when raise_exception then
    if sqlerrm<>'DRIVER_REQUIRED_FOR_CAPACITY' then raise; end if;
  end;
  if exists(select 1 from public.public_capacity_page(jsonb_build_object('capacity_id',published_id)))
    or exists(select 1 from public.account_capacity_filtered_page(broker_id,recipient_digest)) then
    raise exception 'INACTIVE_DRIVER_DISCOVERABLE';
  end if;
  update public.profiles set active=true where id=driver_id;
  -- An active identity alone is not a valid same-company Driver relationship.
  delete from public.organization_members where user_id=driver_id and organization_id=org_id;
  if public.capacity_active_driver_id(truck_id) is not null then raise exception 'NONMEMBER_DRIVER_RESOLVED'; end if;
  if exists(select 1 from public.public_capacity_page(jsonb_build_object('capacity_id',published_id)))
    or exists(select 1 from public.account_capacity_filtered_page(broker_id,recipient_digest)) then
    raise exception 'NONMEMBER_DRIVER_DISCOVERABLE';
  end if;
  insert into public.organization_members(user_id,organization_id,membership_role) values(driver_id,org_id,'DRIVER');
  update public.drivers set active=false where user_id=driver_id;
  if public.capacity_active_driver_id(truck_id) is not null then raise exception 'INACTIVE_FLEET_DRIVER_RESOLVED'; end if;
  update public.drivers set active=true where user_id=driver_id;
  update public.driver_vehicle_assignments set active=false where vehicle_id=truck_id;
  if public.capacity_active_driver_id(truck_id) is not null then raise exception 'UNASSIGNED_DRIVER_RESOLVED'; end if;
  begin
    perform public.publish_provider_capacity(owner_id,command);
    raise exception 'UNASSIGNED_PUBLICATION_ALLOWED';
  exception when raise_exception then
    if sqlerrm<>'DRIVER_REQUIRED_FOR_CAPACITY' then raise; end if;
  end;
  if exists(select 1 from public.public_capacity_page(jsonb_build_object('capacity_id',published_id)))
    or exists(select 1 from public.account_capacity_filtered_page(broker_id,recipient_digest)) then
    raise exception 'UNASSIGNED_TRUCK_DISCOVERABLE';
  end if;

  -- Personal providers also need an explicit current self-assignment.
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(independent_id,'eligibility-personal-'||independent_id||'@loadgistic.local',clock_timestamp(),'{"fixture_source":"loadgistic"}','{}');
  update public.profiles set role='DRIVER',active=true,drives_truck=true where id=independent_id;
  insert into public.provider_profiles(id,user_id,business_name,handle)
    values(independent_provider,independent_id,'Synthetic personal provider','eligibility-personal-'||independent_id);
  perform public.accept_content_policy(independent_id,'2026-10-09');
  independent_truck:=(public.create_provider_vehicle(independent_id,'{"make":"Isuzu","model":"Personal fixture","plate":"ELIGIBILITY-PERSONAL","cargo_configuration":"Mini Box Truck","use_basis":"PERMISSION"}')->>'id')::uuid;
  perform public.update_fleet_driver_access(independent_id,jsonb_build_object('driver_user_id',independent_id,'vehicle_id',independent_truck,'can_manage_capacity',true,'can_manage_tracking',true));
  if independent_id is null or public.capacity_active_driver_id(independent_truck) is distinct from independent_id then
    raise exception 'INDEPENDENT_DRIVER_LINK_MISSING';
  end if;
  if has_function_privilege('anon','public.capacity_active_driver_id(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.capacity_active_driver_id(uuid)','EXECUTE') then
    raise exception 'PRIVATE_DRIVER_LOOKUP_EXPOSED';
  end if;
  raise notice 'PASS: document-free publication; active-driver linkage; Open/Private exclusion; independent Driver; browser denial';
end
$test$;
rollback;
