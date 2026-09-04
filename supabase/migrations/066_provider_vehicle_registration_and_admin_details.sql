-- FEAT-FLT-001 / FEAT-ADM-001
-- Owner-scoped truck registration and permissioned, secret-free Operations
-- record details. Browser roles cannot call either actor-id function.

create or replace function public.create_provider_vehicle(actor_user_id uuid,command jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  vehicle_id uuid:=gen_random_uuid();
  make_value text:=trim(coalesce(command->>'make',''));
  model_value text:=trim(coalesce(command->>'model',''));
  configuration_value text:=trim(coalesce(command->>'cargo_configuration',''));
  plate_value text:=trim(coalesce(command->>'plate',''));
  platform_number_value text;
begin
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_VEHICLE_INPUT'; end if;
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if actor.is_company_driver then raise exception 'FORBIDDEN'; end if;
  if actor.actor_role='TRANSPORTER' and not exists(
    select 1 from public.organization_members member
    where member.user_id=actor_user_id and member.organization_id=actor.organization_id
      and member.membership_role='OWNER'
  ) then raise exception 'FORBIDDEN'; end if;
  if actor.actor_role='DRIVER' and actor.provider_profile_id is null then raise exception 'FORBIDDEN'; end if;
  if char_length(make_value) not between 2 and 60 then raise exception 'INVALID_VEHICLE_MAKE'; end if;
  if char_length(model_value) not between 1 and 60 then raise exception 'INVALID_VEHICLE_MODEL'; end if;
  if char_length(plate_value) not between 2 and 32 then raise exception 'INVALID_VEHICLE_PLATE'; end if;
  if configuration_value<>all(array[
    'Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body',
    'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck',
    'Light Stake Body Truck','Light Box Truck','Medium Stake Body Truck','Medium Box Truck',
    'Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer'
  ]::text[]) then raise exception 'INVALID_VEHICLE_CONFIGURATION'; end if;

  platform_number_value:='LG-TRK-'||upper(substr(replace(vehicle_id::text,'-',''),1,10));
  insert into public.vehicles(
    id,organization_id,provider_profile_id,label,category,make,model,cargo_configuration,plate,platform_number,active
  ) values (
    vehicle_id,actor.organization_id,actor.provider_profile_id,
    concat_ws(' ',make_value,model_value),configuration_value,make_value,model_value,
    configuration_value,plate_value,platform_number_value,true
  );
  insert into public.audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,actor.organization_id,'PROVIDER_VEHICLE_CREATED','vehicle',vehicle_id,
    jsonb_build_object('platformNumber',platform_number_value,'cargoConfiguration',configuration_value),now());
  return jsonb_build_object(
    'id',vehicle_id,'platform_number',platform_number_value,'make',make_value,'model',model_value,
    'cargo_configuration',configuration_value,'active',true
  );
end;
$$;

create or replace function public.managed_admin_operation_record(
  actor_user_id uuid,
  requested_view text,
  record_id uuid,
  requested_kind text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  selected_view text:=upper(trim(coalesce(requested_view,'')));
  selected_kind text:=upper(trim(coalesce(requested_kind,'')));
  required_permission text;
  result jsonb;
begin
  if selected_view not in ('USERS','WORKSPACES','TRUCKS','DRIVERS','TRACKING','CAPACITY','ROUTES','SUBSCRIPTIONS') then
    raise exception 'INVALID_ADMIN_OPERATIONS_VIEW';
  end if;
  required_permission:=case when selected_view in ('USERS','WORKSPACES') then 'CUSTOMERS'
    when selected_view='SUBSCRIPTIONS' then 'BILLING' else 'OPERATIONS' end;
  if not public.managed_actor_has_permission(actor_user_id,required_permission) then raise exception 'FORBIDDEN'; end if;

  if selected_view='USERS' then
    select jsonb_build_object(
      'view','USERS','id',profile.id,'name',profile.full_name,'email',profile.email,'phone',profile.phone,
      'role',profile.role::text,'active',profile.active,'created_at',profile.created_at,
      'workspace_name',coalesce(organization.name,provider.business_name,'Loadgistic'),
      'workspace_kind',case when organization.id is not null then 'ORGANIZATION' when provider.id is not null then 'PROVIDER_PROFILE' else null end,
      'workspace_id',coalesce(organization.id,provider.id)
    ) into result
    from public.profiles profile
    left join lateral (
      select member.organization_id from public.organization_members member
      where member.user_id=profile.id order by (member.membership_role='OWNER') desc,member.id limit 1
    ) membership on true
    left join public.organizations organization on organization.id=membership.organization_id
    left join public.provider_profiles provider on provider.user_id=profile.id
    where profile.id=record_id;
  elsif selected_view='WORKSPACES' and selected_kind='ORGANIZATION' then
    select jsonb_build_object(
      'view','WORKSPACES','record_kind','ORGANIZATION','id',organization.id,'name',organization.name,
      'type',organization.type::text,'city',organization.city,'handle',organization.handle,
      'public_visibility',organization.public_visibility,
      'user_count',(select count(*) from public.organization_members member where member.organization_id=organization.id),
      'truck_count',(select count(*) from public.vehicles vehicle where vehicle.organization_id=organization.id),
      'active_truck_count',(select count(*) from public.vehicles vehicle where vehicle.organization_id=organization.id and vehicle.active),
      'tracking_count',(select count(*) from public.provider_shipments shipment where shipment.provider_organization_id=organization.id),
      'subscription_status',(select subscription.status from public.subscriptions subscription where subscription.organization_id=organization.id order by subscription.updated_at desc,subscription.id limit 1)
    ) into result from public.organizations organization where organization.id=record_id;
  elsif selected_view='WORKSPACES' and selected_kind='PROVIDER_PROFILE' then
    select jsonb_build_object(
      'view','WORKSPACES','record_kind','PROVIDER_PROFILE','id',provider.id,'name',provider.business_name,
      'type',case when application.application_type='OWNER_OPERATOR' then 'OWNER_OPERATOR' else 'SELF_MANAGED_DRIVER' end,
      'city',provider.city,'handle',provider.handle,'public_visibility',provider.public_visibility,
      'user_count',1,'truck_count',(select count(*) from public.vehicles vehicle where vehicle.provider_profile_id=provider.id),
      'active_truck_count',(select count(*) from public.vehicles vehicle where vehicle.provider_profile_id=provider.id and vehicle.active),
      'tracking_count',(select count(*) from public.provider_shipments shipment where shipment.provider_profile_id=provider.id),
      'subscription_status',(select subscription.status from public.subscriptions subscription where subscription.provider_profile_id=provider.id order by subscription.updated_at desc,subscription.id limit 1)
    ) into result
    from public.provider_profiles provider
    left join lateral (
      select item.application_type from public.applications item where item.user_id=provider.user_id order by item.created_at desc,item.id limit 1
    ) application on true
    where provider.id=record_id;
  elsif selected_view='TRUCKS' then
    select jsonb_build_object(
      'view','TRUCKS','id',vehicle.id,'platform_number',vehicle.platform_number,'make',vehicle.make,'model',vehicle.model,
      'cargo_configuration',vehicle.cargo_configuration,'plate',vehicle.plate,'active',vehicle.active,
      'owner_name',coalesce(organization.name,provider.business_name),'owner_kind',case when organization.id is not null then 'ORGANIZATION' else 'PROVIDER_PROFILE' end,
      'owner_id',coalesce(organization.id,provider.id),'provider_handle',coalesce(organization.handle,provider.handle),
      'driver_name',driver.full_name,'capacity_id',latest.id,
      'capacity_status',coalesce(latest.market_status,latest.status::text),'capacity_visibility',latest.visibility::text,
      'location_area',latest.location_area,'capacity_updated_at',latest.updated_at,'location_updated_at',latest.location_updated_at
    ) into result
    from public.vehicles vehicle
    left join public.organizations organization on organization.id=vehicle.organization_id
    left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
    left join lateral (
      select assignment.driver_user_id from public.driver_vehicle_assignments assignment
      where assignment.vehicle_id=vehicle.id and assignment.active order by assignment.assigned_at desc,assignment.id limit 1
    ) assignment on true
    left join public.profiles driver on driver.id=assignment.driver_user_id
    left join lateral (
      select capacity.* from public.capacities capacity where capacity.vehicle_id=vehicle.id
      order by capacity.updated_at desc,capacity.id desc limit 1
    ) latest on true
    where vehicle.id=record_id;
  elsif selected_view='DRIVERS' then
    select jsonb_build_object(
      'view','DRIVERS','id',profile.id,'name',profile.full_name,'email',profile.email,'phone',profile.phone,
      'active',profile.active,'owner_name',organization.name,'owner_id',organization.id,
      'platform_number',vehicle.platform_number,'vehicle_id',vehicle.id,
      'can_manage_capacity',coalesce(permission.can_manage_capacity,true),
      'can_manage_tracking',coalesce(permission.can_manage_tracking,true)
    ) into result
    from public.drivers driver_record
    join public.profiles profile on profile.id=driver_record.user_id and profile.role::text='DRIVER'
    join public.organizations organization on organization.id=driver_record.organization_id
    left join public.driver_permissions permission on permission.user_id=profile.id
    left join lateral (
      select assignment.vehicle_id from public.driver_vehicle_assignments assignment
      where assignment.driver_user_id=profile.id and assignment.active order by assignment.assigned_at desc,assignment.id limit 1
    ) assignment on true
    left join public.vehicles vehicle on vehicle.id=assignment.vehicle_id
    where profile.id=record_id;
  elsif selected_view='TRACKING' then
    select jsonb_build_object(
      'view','TRACKING','id',shipment.id,'code',shipment.code,'cargo_summary',shipment.cargo_summary,
      'origin',shipment.origin,'destination',shipment.destination,'operational_status',shipment.operational_status,
      'tracking_mode',shipment.tracking_mode::text,'expected_pickup_date',shipment.expected_pickup_date,
      'expected_delivery_date',shipment.expected_delivery_date,'created_at',shipment.created_at,
      'updated_at',shipment.updated_at,'completed_at',shipment.completed_at,
      'provider_name',coalesce(organization.name,provider.business_name),'provider_handle',coalesce(organization.handle,provider.handle),
      'platform_number',vehicle.platform_number,'vehicle_id',vehicle.id,'driver_name',driver.full_name,
      'events',coalesce((select jsonb_agg(jsonb_build_object(
        'id',event.id,'status',event.status,'note',event.note,'has_proof',event.proof_storage_path is not null,
        'created_at',event.created_at
      ) order by event.created_at,event.id) from (
        select item.* from public.provider_shipment_events item where item.shipment_id=shipment.id
        order by item.created_at desc,item.id desc limit 50
      ) event),'[]'::jsonb)
    ) into result
    from public.provider_shipments shipment
    left join public.organizations organization on organization.id=shipment.provider_organization_id
    left join public.provider_profiles provider on provider.id=shipment.provider_profile_id
    join public.vehicles vehicle on vehicle.id=shipment.assigned_vehicle_id
    join public.profiles driver on driver.id=shipment.assigned_driver_user_id
    where shipment.id=record_id;
  elsif selected_view='CAPACITY' then
    select jsonb_build_object(
      'view','CAPACITY','id',capacity.id,'status',coalesce(capacity.market_status,capacity.status::text),
      'visibility',capacity.visibility::text,'availability_geometry',capacity.availability_geometry,
      'location_area',capacity.location_area,'updated_at',capacity.updated_at,'location_updated_at',capacity.location_updated_at,
      'platform_number',vehicle.platform_number,'vehicle_id',vehicle.id,'make',vehicle.make,'model',vehicle.model,
      'owner_name',coalesce(organization.name,provider.business_name),'provider_handle',coalesce(organization.handle,provider.handle)
    ) into result
    from public.capacities capacity
    join public.vehicles vehicle on vehicle.id=capacity.vehicle_id
    left join public.organizations organization on organization.id=vehicle.organization_id
    left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
    where capacity.id=record_id;
  elsif selected_view='ROUTES' and selected_kind='PROFILE_ROUTE' then
    select jsonb_build_object(
      'view','ROUTES','record_kind','PROFILE_ROUTE','id',route.id,'geometry',route.geometry,
      'origin',route.origin,'destination',route.destination,'created_at',route.created_at,
      'owner_name',coalesce(organization.name,provider.business_name),'provider_handle',coalesce(organization.handle,provider.handle)
    ) into result
    from public.profile_routes route
    left join public.organizations organization on organization.id=route.organization_id
    left join public.provider_profiles provider on provider.id=route.provider_profile_id
    where route.id=record_id;
  elsif selected_view='ROUTES' and selected_kind='SERVICE_AREA' then
    select jsonb_build_object(
      'view','ROUTES','record_kind','SERVICE_AREA','id',area.id,'geometry','RADIUS',
      'origin',area.place_label,'radius_km',area.radius_km,'created_at',area.created_at,
      'owner_name',coalesce(organization.name,provider.business_name),'provider_handle',coalesce(organization.handle,provider.handle)
    ) into result
    from public.service_areas area
    left join public.organizations organization on organization.id=area.organization_id
    left join public.provider_profiles provider on provider.id=area.provider_profile_id
    where area.id=record_id;
  elsif selected_view='SUBSCRIPTIONS' then
    select jsonb_build_object(
      'view','SUBSCRIPTIONS','id',subscription.id,'status',subscription.status,'billing_model',subscription.billing_model,
      'starts_at',subscription.starts_at,'ends_at',subscription.ends_at,'updated_at',subscription.updated_at,
      'plan_name',plan.name,'owner_name',coalesce(organization.name,provider.business_name),
      'owner_kind',case when organization.id is not null then 'ORGANIZATION' else 'PROVIDER_PROFILE' end,
      'owner_id',coalesce(organization.id,provider.id)
    ) into result
    from public.subscriptions subscription
    join public.plans plan on plan.id=subscription.plan_id
    left join public.organizations organization on organization.id=subscription.organization_id
    left join public.provider_profiles provider on provider.id=subscription.provider_profile_id
    where subscription.id=record_id;
  end if;

  if result is null then return null; end if;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,'ADMIN_OPERATION_RECORD_VIEWED','platform_record',record_id,
    jsonb_build_object('view',selected_view,'kind',selected_kind),now());
  return result;
end;
$$;

revoke all on function public.create_provider_vehicle(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.managed_admin_operation_record(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.create_provider_vehicle(uuid,jsonb) to service_role;
grant execute on function public.managed_admin_operation_record(uuid,text,uuid,text) to service_role;

comment on function public.create_provider_vehicle(uuid,jsonb) is
  'Atomically registers one provider-owned truck after current owner and subscription checks.';
comment on function public.managed_admin_operation_record(uuid,text,uuid,text) is
  'Permissioned single-record Operations projection without secrets, recipient emails, private files, or exact coordinates.';
