-- FEAT-ADM-001: expose only the geometry discriminator for honest area labels.
create or replace function public.managed_admin_operations_page(
  actor_user_id uuid,
  requested_view text,
  search_text text default '',
  requested_offset integer default 0,
  requested_limit integer default 20
)
returns table(payload jsonb,total_count bigint)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  selected_view text:=upper(trim(coalesce(requested_view,'')));
  term text:=left(trim(coalesce(search_text,'')),80);
  bounded_offset integer:=greatest(0,coalesce(requested_offset,0));
  bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,20)));
begin
  if selected_view not in ('USERS','WORKSPACES','TRUCKS','DRIVERS','TRACKING','CAPACITY','ROUTES','SUBSCRIPTIONS') then
    raise exception 'INVALID_ADMIN_OPERATIONS_VIEW';
  end if;
  if not public.managed_actor_has_permission(actor_user_id,
    case when selected_view in ('USERS','WORKSPACES') then 'CUSTOMERS'
      when selected_view='SUBSCRIPTIONS' then 'BILLING' else 'OPERATIONS' end
  ) then raise exception 'FORBIDDEN'; end if;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,details,created_at)
  values(gen_random_uuid(),actor_user_id,'ADMIN_OPERATIONS_VIEWED','platform',
    jsonb_build_object('queryUsed',term<>'' ,'view',selected_view),now());

  if selected_view='USERS' then
    return query with scoped as (
      select profile.id,profile.full_name as name,profile.email,profile.phone,profile.role::text as role,
        profile.active,profile.created_at,coalesce(organization.name,provider.business_name,'Loadgistic') as workspace_name
      from public.profiles profile
      left join lateral (
        select member.organization_id from public.organization_members member
        where member.user_id=profile.id order by (member.membership_role='OWNER') desc,member.id limit 1
      ) membership on true
      left join public.organizations organization on organization.id=membership.organization_id
      left join public.provider_profiles provider on provider.user_id=profile.id
      where term='' or concat_ws(' ',profile.full_name,profile.email,profile.role::text,organization.name,provider.business_name) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.active desc,row.created_at desc,row.id offset bounded_offset limit bounded_limit;
  elsif selected_view='WORKSPACES' then
    return query with scoped as (
      select organization.id,'ORGANIZATION'::text as record_kind,organization.name,organization.type::text as type,
        organization.city,organization.public_visibility,
        (select count(*) from public.organization_members member where member.organization_id=organization.id) as user_count,
        (select count(*) from public.vehicles vehicle where vehicle.organization_id=organization.id and vehicle.active) as truck_count,
        (select count(*) from public.provider_shipments shipment where shipment.provider_organization_id=organization.id) as tracking_count,
        (select subscription.status from public.subscriptions subscription where subscription.organization_id=organization.id
          order by subscription.updated_at desc,subscription.id limit 1) as subscription_status
      from public.organizations organization
      where term='' or concat_ws(' ',organization.name,organization.type::text,organization.city) ilike '%'||term||'%'
      union all
      select provider.id,'PROVIDER_PROFILE',provider.business_name,'SELF_MANAGED_DRIVER',provider.city,provider.public_visibility,
        1::bigint,
        (select count(*) from public.vehicles vehicle where vehicle.provider_profile_id=provider.id and vehicle.active),
        (select count(*) from public.provider_shipments shipment where shipment.provider_profile_id=provider.id),
        (select subscription.status from public.subscriptions subscription where subscription.provider_profile_id=provider.id
          order by subscription.updated_at desc,subscription.id limit 1)
      from public.provider_profiles provider
      where term='' or concat_ws(' ',provider.business_name,provider.city) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.name,row.id offset bounded_offset limit bounded_limit;
  elsif selected_view='TRUCKS' then
    return query with scoped as (
      select vehicle.id,vehicle.platform_number,vehicle.make,vehicle.model,vehicle.cargo_configuration,vehicle.plate,vehicle.active,
        coalesce(organization.name,provider.business_name) as owner_name,
        latest.id as capacity_id,coalesce(latest.market_status,latest.status::text) as capacity_status,
        latest.location_area,latest.updated_at as capacity_updated_at
      from public.vehicles vehicle
      left join public.organizations organization on organization.id=vehicle.organization_id
      left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
      left join lateral (
        select capacity.id,capacity.market_status,capacity.status,capacity.location_area,capacity.updated_at
        from public.capacities capacity where capacity.vehicle_id=vehicle.id
        order by capacity.updated_at desc,capacity.id desc limit 1
      ) latest on true
      where term='' or concat_ws(' ',vehicle.platform_number,vehicle.make,vehicle.model,vehicle.cargo_configuration,
        vehicle.plate,organization.name,provider.business_name) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.active desc,row.platform_number nulls last,row.id offset bounded_offset limit bounded_limit;
  elsif selected_view='DRIVERS' then
    return query with scoped as (
      select profile.id,profile.full_name as name,profile.email,profile.active,organization.name as owner_name,
        vehicle.platform_number,coalesce(permission.can_manage_capacity,true) as can_manage_capacity,
        coalesce(permission.can_manage_tracking,true) as can_manage_tracking
      from public.drivers driver
      join public.profiles profile on profile.id=driver.user_id and profile.role::text='DRIVER'
      join public.organizations organization on organization.id=driver.organization_id
      left join public.driver_permissions permission on permission.user_id=profile.id
      left join lateral (
        select assignment.vehicle_id from public.driver_vehicle_assignments assignment
        where assignment.driver_user_id=profile.id and assignment.active
        order by assignment.assigned_at desc,assignment.id limit 1
      ) assignment on true
      left join public.vehicles vehicle on vehicle.id=assignment.vehicle_id
      where term='' or concat_ws(' ',profile.full_name,profile.email,organization.name,vehicle.platform_number) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.active desc,row.name,row.id offset bounded_offset limit bounded_limit;
  elsif selected_view='TRACKING' then
    return query with scoped as (
      select shipment.id,shipment.code,shipment.cargo_summary,shipment.origin,shipment.destination,
        shipment.operational_status,shipment.updated_at,coalesce(organization.name,provider.business_name) as provider_name,
        coalesce(organization.handle,provider.handle) as provider_handle,vehicle.platform_number,driver.full_name as driver_name
      from public.provider_shipments shipment
      left join public.organizations organization on organization.id=shipment.provider_organization_id
      left join public.provider_profiles provider on provider.id=shipment.provider_profile_id
      join public.vehicles vehicle on vehicle.id=shipment.assigned_vehicle_id
      join public.profiles driver on driver.id=shipment.assigned_driver_user_id
      where term='' or concat_ws(' ',shipment.code,shipment.cargo_summary,shipment.origin,shipment.destination,
        organization.name,provider.business_name,vehicle.platform_number,driver.full_name) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.updated_at desc,row.id offset bounded_offset limit bounded_limit;
  elsif selected_view='CAPACITY' then
    return query with scoped as (
      select latest.id,coalesce(latest.market_status,latest.status::text) as status,latest.available_percent,
        latest.visibility::text as visibility,latest.location_area,latest.updated_at,vehicle.platform_number,
        vehicle.make,vehicle.model,coalesce(organization.name,provider.business_name) as owner_name
      from public.vehicles vehicle
      join lateral (
        select capacity.* from public.capacities capacity where capacity.vehicle_id=vehicle.id
        order by capacity.updated_at desc,capacity.id desc limit 1
      ) latest on true
      left join public.organizations organization on organization.id=vehicle.organization_id
      left join public.provider_profiles provider on provider.id=vehicle.provider_profile_id
      where term='' or concat_ws(' ',vehicle.platform_number,vehicle.make,vehicle.model,organization.name,provider.business_name) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.updated_at desc,row.id offset bounded_offset limit bounded_limit;
  elsif selected_view='ROUTES' then
    return query with scoped as (
      select route.id,'PROFILE_ROUTE'::text as record_kind,coalesce(organization.name,provider.business_name) as owner_name,
        route.origin,route.destination,null::integer as radius_km,route.created_at,route.geometry
      from public.profile_routes route
      left join public.organizations organization on organization.id=route.organization_id
      left join public.provider_profiles provider on provider.id=route.provider_profile_id
      where term='' or concat_ws(' ',organization.name,provider.business_name,route.origin,route.destination) ilike '%'||term||'%'
      union all
      select area.id,'SERVICE_AREA',coalesce(organization.name,provider.business_name),area.place_label,null,area.radius_km,area.created_at,'RADIUS'::text
      from public.service_areas area
      left join public.organizations organization on organization.id=area.organization_id
      left join public.provider_profiles provider on provider.id=area.provider_profile_id
      where term='' or concat_ws(' ',organization.name,provider.business_name,area.place_label) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.created_at desc,row.id offset bounded_offset limit bounded_limit;
  else
    return query with scoped as (
      select subscription.id,subscription.status,subscription.billing_model,subscription.starts_at,subscription.ends_at,
        subscription.updated_at,plan.name as plan_name,coalesce(organization.name,provider.business_name) as owner_name,
        organization.type::text as organization_type
      from public.subscriptions subscription
      join public.plans plan on plan.id=subscription.plan_id
      left join public.organizations organization on organization.id=subscription.organization_id
      left join public.provider_profiles provider on provider.id=subscription.provider_profile_id
      where term='' or concat_ws(' ',organization.name,provider.business_name,plan.name,subscription.status) ilike '%'||term||'%'
    ), counted as (select scoped.*,count(*) over() as row_total from scoped)
    select to_jsonb(row)-'row_total',row.row_total from counted row
    order by row.updated_at desc,row.id offset bounded_offset limit bounded_limit;
  end if;
end;
$$;

revoke all on function public.managed_admin_operations_page(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.managed_admin_operations_page(uuid,text,text,integer,integer) to service_role;
