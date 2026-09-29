-- Isolated managed fixtures only. Every write, including evidence removal,
-- is rolled back; this does not touch Storage objects or send email.
begin;
do $test$
declare
  driver_id uuid;
  owner_id uuid;
  truck_id uuid;
  org_id uuid;
  published_id uuid;
  independent_id uuid;
  independent_truck uuid;
  command jsonb;
  recipient_digest text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
begin
  select id into strict driver_id from public.profiles where email='company-driver@loadgistic.local';
  select id into strict owner_id from public.profiles where email='transporter@loadgistic.local';
  select vehicle.id,vehicle.organization_id into strict truck_id,org_id
    from public.driver_vehicle_assignments assignment
    join public.vehicles vehicle on vehicle.id=assignment.vehicle_id
    where assignment.driver_user_id=driver_id and assignment.active;
  if public.capacity_active_driver_id(truck_id) is distinct from driver_id then raise exception 'ACTIVE_DRIVER_NOT_RESOLVED'; end if;
  update public.driver_permissions set can_manage_capacity=true where user_id=driver_id;
  delete from public.verification_requests where subject_id in (driver_id,truck_id,org_id);
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
  insert into public.capacity_access_grants(vehicle_id,audience_type,recipient_email,recipient_email_digest,created_by)
    values(truck_id,'EMAIL','driver-check@example.invalid',recipient_digest,owner_id);
  if not exists(select 1 from public.private_capacity_projection('EMAIL',recipient_digest)) then
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
    or exists(select 1 from public.private_capacity_projection('EMAIL',recipient_digest)) then
    raise exception 'INACTIVE_DRIVER_DISCOVERABLE';
  end if;
  update public.profiles set active=true where id=driver_id;
  -- An active identity alone is not a valid same-company Driver relationship.
  delete from public.organization_members where user_id=driver_id and organization_id=org_id;
  if public.capacity_active_driver_id(truck_id) is not null then raise exception 'NONMEMBER_DRIVER_RESOLVED'; end if;
  if exists(select 1 from public.public_capacity_page(jsonb_build_object('capacity_id',published_id)))
    or exists(select 1 from public.private_capacity_projection('EMAIL',recipient_digest)) then
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
    or exists(select 1 from public.private_capacity_projection('EMAIL',recipient_digest)) then
    raise exception 'UNASSIGNED_TRUCK_DISCOVERABLE';
  end if;

  select profile.id,vehicle.id into independent_id,independent_truck
    from public.profiles profile join public.provider_profiles provider on provider.user_id=profile.id
    join public.vehicles vehicle on vehicle.provider_profile_id=provider.id
    where profile.email='driver@loadgistic.local' and vehicle.active limit 1;
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
