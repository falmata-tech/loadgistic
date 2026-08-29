-- BASE-BE-001 / FEAT-ADM-001 / FEAT-FTR-001 / FEAT-SPN-001
-- Final service-role-only platform administration boundary. These projections
-- intentionally omit secrets, proof references, exact coordinates, private
-- contacts, and unselected inventory rows.

create or replace function public.managed_admin_operation_counts(actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not (
    public.managed_actor_has_permission(actor_user_id,'CUSTOMERS')
    or public.managed_actor_has_permission(actor_user_id,'OPERATIONS')
    or public.managed_actor_has_permission(actor_user_id,'BILLING')
  ) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'users',(select count(*) from public.profiles),
    'workspaces',(select count(*) from public.organizations)+(select count(*) from public.provider_profiles),
    'trucks',(select count(*) from public.vehicles),
    'tracking',(select count(*) from public.provider_shipments),
    'board_capacity',(select count(*) from public.vehicles vehicle
      join lateral (
        select capacity.market_status,capacity.status
        from public.capacities capacity where capacity.vehicle_id=vehicle.id
        order by capacity.updated_at desc,capacity.id desc limit 1
      ) latest on true
      where vehicle.active and coalesce(latest.market_status,latest.status::text) in ('EMPTY','PARTIAL')),
    'routes',(select count(*) from public.profile_routes),
    'subscriptions',(select count(*) from public.subscriptions)
  );
end;
$$;

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
        route.origin,route.destination,null::integer as radius_km,route.created_at
      from public.profile_routes route
      left join public.organizations organization on organization.id=route.organization_id
      left join public.provider_profiles provider on provider.id=route.provider_profile_id
      where term='' or concat_ws(' ',organization.name,provider.business_name,route.origin,route.destination) ilike '%'||term||'%'
      union all
      select area.id,'SERVICE_AREA',coalesce(organization.name,provider.business_name),area.place_label,null,area.radius_km,area.created_at
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

create or replace function public.managed_admin_record_command(
  actor_user_id uuid,
  record_type text,
  record_id uuid,
  command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  selected_type text:=upper(trim(coalesce(record_type,'')));
  action_name text:=upper(trim(coalesce(command->>'action','')));
  active_value boolean:=coalesce((command->>'active')::boolean,false);
  actor_role text;
  target_role text;
  organization_record public.organizations%rowtype;
  subscription_record public.subscriptions%rowtype;
  support_record public.support_agent_profiles%rowtype;
  affected integer:=0;
begin
  select profile.role::text into actor_role from public.profiles profile where profile.id=actor_user_id and profile.active;
  if actor_role is null then raise exception 'FORBIDDEN'; end if;

  if selected_type='DRIVER_PERMISSIONS' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    if not exists(select 1 from public.profiles profile join public.drivers driver on driver.user_id=profile.id
      where profile.id=record_id and profile.role::text='DRIVER' and profile.active and driver.active) then raise exception 'NOT_FOUND'; end if;
    insert into public.driver_permissions(user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,
      can_manage_capacity,can_manage_tracking,updated_by,updated_at)
    values(record_id,false,false,false,coalesce((command->>'can_manage_capacity')::boolean,false),
      coalesce((command->>'can_manage_tracking')::boolean,false),actor_user_id,now())
    on conflict(user_id) do update set can_browse_load_board=false,can_contact_businesses=false,can_negotiate_loads=false,
      can_manage_capacity=excluded.can_manage_capacity,can_manage_tracking=excluded.can_manage_tracking,
      updated_by=excluded.updated_by,updated_at=excluded.updated_at;
    insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
    values(gen_random_uuid(),actor_user_id,'DRIVER_PERMISSIONS_UPDATED','profile',record_id,
      jsonb_build_object('capacity',coalesce((command->>'can_manage_capacity')::boolean,false),
        'tracking',coalesce((command->>'can_manage_tracking')::boolean,false)),now());
    return jsonb_build_object('updated',true);
  end if;

  if selected_type in ('USER','DRIVER') and action_name='SET_ACTIVE' then
    if not public.managed_actor_has_permission(actor_user_id,case when selected_type='USER' then 'CUSTOMERS' else 'OPERATIONS' end) then raise exception 'FORBIDDEN'; end if;
    select profile.role::text into target_role from public.profiles profile where profile.id=record_id;
    if target_role is null then raise exception 'NOT_FOUND'; end if;
    if selected_type='DRIVER' and target_role<>'DRIVER' then raise exception 'INVALID_ADMIN_RECORD_TYPE'; end if;
    if actor_role<>'ADMIN' and target_role in ('ADMIN','SUPPORT') then raise exception 'FORBIDDEN'; end if;
    if record_id=actor_user_id and not active_value then raise exception 'ADMIN_SELF_SUSPENSION_DENIED'; end if;
    if target_role='SUPPORT' then
      if actor_role<>'ADMIN' then raise exception 'FORBIDDEN'; end if;
      select * into support_record from public.support_agent_profiles profile where profile.user_id=record_id;
      if not found then raise exception 'NOT_FOUND'; end if;
      perform public.update_managed_support_agent(actor_user_id,record_id,jsonb_build_object(
        'active',active_value,'available',active_value and support_record.available,
        'max_open_conversations',support_record.max_open_conversations,
        'can_manage_customers',support_record.can_manage_customers,
        'can_manage_operations',support_record.can_manage_operations,
        'can_manage_trust',support_record.can_manage_trust,
        'can_manage_billing',support_record.can_manage_billing,
        'can_manage_support',support_record.can_manage_support));
      return jsonb_build_object('updated',true);
    end if;
    update public.profiles set active=active_value where id=record_id;
    insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
    values(gen_random_uuid(),actor_user_id,'ADMIN_USER_ACCESS_CHANGED','profile',record_id,jsonb_build_object('active',active_value),now());
    return jsonb_build_object('updated',true);
  end if;

  if selected_type='VEHICLE' and action_name='SET_ACTIVE' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    update public.vehicles set active=active_value where id=record_id;
    get diagnostics affected=row_count;if affected=0 then raise exception 'NOT_FOUND'; end if;
  elsif selected_type='CAPACITY' and action_name='OFF_DUTY' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    update public.capacities set status='OFF_DUTY',market_status='OFF_DUTY',available_percent=0,
      visibility='PRIVATE',updated_at=now(),expires_at=now() where id=record_id;
    get diagnostics affected=row_count;if affected=0 then raise exception 'NOT_FOUND'; end if;
  elsif selected_type='PROFILE_ROUTE' and action_name='REMOVE' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    delete from public.profile_routes where id=record_id;get diagnostics affected=row_count;
    if affected=0 then raise exception 'NOT_FOUND'; end if;
  elsif selected_type='SERVICE_AREA' and action_name='REMOVE' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    delete from public.service_areas where id=record_id;get diagnostics affected=row_count;
    if affected=0 then raise exception 'NOT_FOUND'; end if;
  elsif selected_type='RELATIONSHIP' and action_name='DISCONNECT' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    update public.partner_relationships set status='FAVORITE',business_favorite=false,provider_favorite=false,
      responded_at=now(),updated_at=now() where id=record_id;get diagnostics affected=row_count;
    if affected=0 then raise exception 'NOT_FOUND'; end if;
  elsif selected_type='BUSINESS_FAVORITE' and action_name='REMOVE' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    delete from public.member_favorites where id=record_id;get diagnostics affected=row_count;
    if affected=0 then raise exception 'NOT_FOUND'; end if;
  elsif selected_type='SUBSCRIPTION' and action_name in ('PAID','EXPIRE','SPONSOR') then
    if not public.managed_actor_has_permission(actor_user_id,'BILLING') then raise exception 'FORBIDDEN'; end if;
    select * into subscription_record from public.subscriptions subscription where subscription.id=record_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if action_name='SPONSOR' then
      select * into organization_record from public.organizations organization where organization.id=subscription_record.organization_id;
      if not found or organization_record.type::text not in ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER') then raise exception 'SPONSORED_ACCESS_BUSINESS_ONLY'; end if;
      update public.subscriptions set status='SPONSORED',billing_model='SPONSORED_FREE',ends_at=null,updated_at=now() where id=record_id;
    elsif action_name='PAID' then
      update public.subscriptions set status='ACTIVE',billing_model='FLAT_MONTHLY',starts_at=now(),ends_at=now()+interval '30 days',updated_at=now() where id=record_id;
    else
      update public.subscriptions set status='PAYMENT_REQUIRED',billing_model='FLAT_MONTHLY',ends_at=now(),updated_at=now() where id=record_id;
    end if;
  elsif selected_type='WORKSPACE_SPONSOR' and action_name='GRANT' then
    if not public.managed_actor_has_permission(actor_user_id,'BILLING') then raise exception 'FORBIDDEN'; end if;
    select * into organization_record from public.organizations organization where organization.id=record_id;
    if not found then raise exception 'NOT_FOUND'; end if;
    if organization_record.type::text not in ('ENTERPRISE_SHIPPER','ENTERPRISE_RECEIVER') then raise exception 'SPONSORED_ACCESS_BUSINESS_ONLY'; end if;
    select * into subscription_record from public.subscriptions subscription where subscription.organization_id=record_id
      order by subscription.updated_at desc,subscription.id limit 1 for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if subscription_record.status='SPONSORED' then return jsonb_build_object('updated',false); end if;
    update public.subscriptions set status='SPONSORED',billing_model='SPONSORED_FREE',ends_at=null,updated_at=now() where id=subscription_record.id;
  else
    raise exception 'INVALID_ADMIN_RECORD_COMMAND';
  end if;

  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,
    case when selected_type='VEHICLE' then 'ADMIN_VEHICLE_STATUS_CHANGED'
      when selected_type='WORKSPACE_SPONSOR' then 'SPONSORED_ACCESS_GRANTED' else 'ADMIN_RECORD_MODERATED' end,
    lower(selected_type),record_id,command,now());
  return jsonb_build_object('updated',true);
end;
$$;

create or replace function public.managed_admin_featured_day(
  actor_user_id uuid,
  requested_date date,
  requested_group_key text,
  requested_region_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare day_record jsonb;slot_rows jsonb;sponsor_rows jsonb;candidate_rows jsonb;
begin
  if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN') then
    raise exception 'FORBIDDEN';
  end if;
  select to_jsonb(day) into day_record from public.featured_provider_days day where day.feature_date=requested_date;
  select coalesce(jsonb_agg(to_jsonb(slot) order by slot.slot_position),'[]'::jsonb) into slot_rows
    from public.featured_provider_slots slot where slot.day_id=(day_record->>'id')::uuid;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.starts_on,row.position,row.id),'[]'::jsonb) into sponsor_rows
  from (
    select placement.*,sponsor.sponsor_kind,sponsor.provider_organization_id,sponsor.provider_profile_id,
      sponsor.business_name,sponsor.description,sponsor.website_url,sponsor.phone,sponsor.active as sponsor_active
    from public.sponsor_placements placement join public.sponsors sponsor on sponsor.id=placement.sponsor_id
    where placement.expo_group_key=requested_group_key and placement.active and sponsor.active and placement.ends_on>=requested_date
  ) row;
  select coalesce(jsonb_agg(projected.candidate),'[]'::jsonb) into candidate_rows
    from public.public_featured_provider_candidates(requested_region_codes) as projected(candidate);
  insert into public.audit_logs(id,actor_user_id,action,entity_type,details,created_at)
  values(gen_random_uuid(),actor_user_id,'ADMIN_FEATURED_VIEWED','featured_provider_day',
    jsonb_build_object('featureDate',requested_date,'groupKey',requested_group_key),now());
  return jsonb_build_object('day',day_record,'slots',slot_rows,'sponsorships',sponsor_rows,'candidates',candidate_rows);
end;
$$;

create or replace function public.managed_featured_group_for_date(feature_date date)
returns text
language sql
immutable
set search_path=public,pg_temp
as $$
  select case extract(isodow from feature_date)::integer
    when 1 then 'addis-ababa' when 2 then 'oromia' when 3 then 'amhara'
    when 4 then 'north-northeast' when 5 then 'eastern-ethiopia'
    when 6 then 'southern-ethiopia' else 'western-ethiopia' end
$$;

create or replace function public.save_managed_featured_day(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  feature_date date;group_key text;group_label text;region_codes text[];status_value text;
  headline text;introduction text;tiktok_url text;schedule_mode text;provider_keys jsonb;
  provider_key text;candidate jsonb;saved_day_id uuid;position_value integer:=0;
begin
  if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN') then raise exception 'FORBIDDEN'; end if;
  begin feature_date:=(command->>'feature_date')::date; exception when others then raise exception 'FEATURED_DATE_INVALID'; end;
  group_key:=trim(coalesce(command->>'group_key',''));group_label:=left(trim(coalesce(command->>'group_label','')),160);
  if group_key<>public.managed_featured_group_for_date(feature_date) then raise exception 'FEATURED_DATE_INVALID'; end if;
  select coalesce(array_agg(value),array[]::text[]) into region_codes from jsonb_array_elements_text(coalesce(command->'region_codes','[]'::jsonb)) value;
  status_value:=case when coalesce((command->>'publish')::boolean,false) then 'PUBLISHED' else 'DRAFT' end;
  headline:=nullif(trim(coalesce(command->>'public_headline','')),'');
  introduction:=nullif(trim(coalesce(command->>'public_introduction','')),'');
  tiktok_url:=nullif(trim(coalesce(command->>'tiktok_url','')),'');
  schedule_mode:=upper(trim(coalesce(command->>'schedule_mode','AUTO')));
  provider_keys:=coalesce(command->'provider_keys','[]'::jsonb);
  if jsonb_typeof(provider_keys)<>'array' then raise exception 'FEATURED_PROVIDER_INVALID'; end if;
  if status_value='PUBLISHED' and jsonb_array_length(provider_keys)=0 then raise exception 'FEATURED_PROVIDER_REQUIRED'; end if;
  if schedule_mode not in ('AUTO','MANUAL') then raise exception 'FEATURED_SCHEDULE_MODE_INVALID'; end if;
  if tiktok_url is not null and tiktok_url !~* '^https://([a-z0-9-]+\.)*tiktok\.com(/|$)' then raise exception 'FEATURED_TIKTOK_URL_INVALID'; end if;
  if (select count(*)<>count(distinct value) from jsonb_array_elements_text(provider_keys) value) then raise exception 'FEATURED_PROVIDER_DUPLICATE'; end if;

  for provider_key in select value from jsonb_array_elements_text(provider_keys) value loop
    select projected.candidate into candidate
      from public.public_featured_provider_candidates(region_codes) as projected(candidate)
      where (projected.candidate->>'provider_organization_id' is not null and provider_key='organization:'||(projected.candidate->>'provider_organization_id'))
        or (projected.candidate->>'provider_profile_id' is not null and provider_key='profile:'||(projected.candidate->>'provider_profile_id'));
    if candidate is null then raise exception 'FEATURED_PROVIDER_INVALID'; end if;
    if not coalesce((candidate->>'eligible')::boolean,false) then raise exception 'FEATURED_PROVIDER_INELIGIBLE'; end if;
  end loop;

  insert into public.featured_provider_days(id,feature_date,base_place_ref,base_place_label,expo_group_key,expo_group_label,
    expo_region_codes,public_headline,public_introduction,tiktok_url,broadcast_start_time,broadcast_end_time,
    schedule_mode,schedule_config_json,manual_schedule_json,status,created_by,published_by,created_at,updated_at,published_at)
  values(gen_random_uuid(),feature_date,'featured:'||group_key,group_label,group_key,group_label,to_jsonb(region_codes),
    headline,introduction,tiktok_url,(command->'schedule_config'->>'dayStart')::time,
    (command->'schedule_config'->>'dayEnd')::time,schedule_mode,command->'schedule_config',
    coalesce(command->'manual_schedule','[]'::jsonb),status_value,actor_user_id,
    case when status_value='PUBLISHED' then actor_user_id end,now(),now(),case when status_value='PUBLISHED' then now() end)
  on conflict on constraint featured_provider_days_feature_date_key do update set base_place_ref=excluded.base_place_ref,base_place_label=excluded.base_place_label,
    expo_group_key=excluded.expo_group_key,expo_group_label=excluded.expo_group_label,expo_region_codes=excluded.expo_region_codes,
    public_headline=excluded.public_headline,public_introduction=excluded.public_introduction,tiktok_url=excluded.tiktok_url,
    broadcast_start_time=excluded.broadcast_start_time,broadcast_end_time=excluded.broadcast_end_time,
    schedule_mode=excluded.schedule_mode,schedule_config_json=excluded.schedule_config_json,
    manual_schedule_json=excluded.manual_schedule_json,status=excluded.status,published_by=excluded.published_by,
    updated_at=excluded.updated_at,published_at=excluded.published_at
  returning id into saved_day_id;
  delete from public.featured_provider_slots slot where slot.day_id=saved_day_id;
  for provider_key in select value from jsonb_array_elements_text(provider_keys) value loop
    position_value:=position_value+1;
    insert into public.featured_provider_slots(id,day_id,slot_position,provider_organization_id,provider_profile_id,created_by,created_at)
    values(gen_random_uuid(),saved_day_id,position_value,
      case when provider_key like 'organization:%' then substring(provider_key from 14)::uuid end,
      case when provider_key like 'profile:%' then substring(provider_key from 9)::uuid end,actor_user_id,now());
  end loop;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,case when status_value='PUBLISHED' then 'FEATURED_DAY_PUBLISHED' else 'FEATURED_DAY_SAVED' end,
    'featured_provider_day',saved_day_id,jsonb_build_object('featureDate',feature_date,'groupKey',group_key,
      'providerCount',jsonb_array_length(provider_keys),'scheduleMode',schedule_mode),now());
  return saved_day_id;
end;
$$;

create or replace function public.save_managed_sponsorship(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  feature_date_value date;start_date_value date;end_date_value date;group_key text;region_codes text[];kind text;
  placement_record_id uuid;sponsor_record_id uuid;provider_key text;candidate jsonb;position_value integer;
  existing public.sponsor_placements%rowtype;advertiser_name text;advertiser_description text;advertiser_website text;advertiser_phone text;
begin
  if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN') then raise exception 'FORBIDDEN'; end if;
  begin
    feature_date_value:=(command->>'feature_date')::date;start_date_value:=(command->>'starts_on')::date;end_date_value:=(command->>'ends_on')::date;
    position_value:=(command->>'position')::integer;
  exception when others then raise exception 'SPONSORSHIP_DATE_RANGE_INVALID'; end;
  group_key:=trim(coalesce(command->>'group_key',''));
  if group_key<>public.managed_featured_group_for_date(feature_date_value) then raise exception 'FEATURED_DATE_INVALID'; end if;
  if start_date_value>end_date_value or end_date_value-start_date_value>365 then raise exception 'SPONSORSHIP_DATE_RANGE_INVALID'; end if;
  if position_value not between 1 and 5 then raise exception 'SPONSORSHIP_POSITION_INVALID'; end if;
  kind:=upper(trim(coalesce(command->>'sponsor_kind','')));if kind not in ('TRANSPORTER','ADVERTISER') then raise exception 'SPONSORSHIP_KIND_INVALID'; end if;
  begin placement_record_id:=nullif(command->>'sponsorship_id','')::uuid;exception when others then raise exception 'SPONSORSHIP_NOT_FOUND';end;
  if placement_record_id is not null then
    select * into existing from public.sponsor_placements placement where placement.id=placement_record_id for update;
    if not found then raise exception 'SPONSORSHIP_NOT_FOUND'; end if;
  else placement_record_id:=gen_random_uuid();end if;
  select coalesce(array_agg(value),array[]::text[]) into region_codes from jsonb_array_elements_text(coalesce(command->'region_codes','[]'::jsonb)) value;

  if kind='TRANSPORTER' then
    provider_key:=trim(coalesce(command->>'provider_key',''));
    select projected.candidate into candidate
      from public.public_featured_provider_candidates(region_codes) as projected(candidate)
      where (projected.candidate->>'provider_organization_id' is not null and provider_key='organization:'||(projected.candidate->>'provider_organization_id'))
        or (projected.candidate->>'provider_profile_id' is not null and provider_key='profile:'||(projected.candidate->>'provider_profile_id'));
    if candidate is null then raise exception 'SPONSORSHIP_PROVIDER_INVALID'; end if;
    if not coalesce((candidate->>'eligible')::boolean,false) then raise exception 'SPONSORSHIP_PROVIDER_INELIGIBLE'; end if;
    select sponsor.id into sponsor_record_id from public.sponsors sponsor where
      sponsor.provider_organization_id=(candidate->>'provider_organization_id')::uuid
      or sponsor.provider_profile_id=(candidate->>'provider_profile_id')::uuid limit 1;
    if sponsor_record_id is null then
      insert into public.sponsors(id,sponsor_kind,provider_organization_id,provider_profile_id,active,created_by,updated_by,created_at,updated_at)
      values(gen_random_uuid(),'TRANSPORTER',(candidate->>'provider_organization_id')::uuid,
        (candidate->>'provider_profile_id')::uuid,true,actor_user_id,actor_user_id,now(),now()) returning id into sponsor_record_id;
    else
      update public.sponsors set active=true,updated_by=actor_user_id,updated_at=now() where id=sponsor_record_id;
    end if;
  else
    advertiser_name:=trim(coalesce(command->>'business_name',''));advertiser_description:=trim(coalesce(command->>'description',''));
    advertiser_website:=nullif(trim(coalesce(command->>'website_url','')),'');advertiser_phone:=nullif(trim(coalesce(command->>'phone','')),'');
    if char_length(advertiser_name) not between 2 and 100 then raise exception 'SPONSOR_NAME_INVALID'; end if;
    if char_length(advertiser_description) not between 10 and 240 then raise exception 'SPONSOR_DESCRIPTION_INVALID'; end if;
    if advertiser_website is null and advertiser_phone is null then raise exception 'SPONSOR_CONTACT_REQUIRED'; end if;
    if advertiser_website is not null and advertiser_website!~*'^https://' then raise exception 'SPONSOR_WEBSITE_INVALID'; end if;
    if existing.id is not null then
      select sponsor.id into sponsor_record_id from public.sponsors sponsor where sponsor.id=existing.sponsor_id and sponsor.sponsor_kind='ADVERTISER';
    end if;
    if sponsor_record_id is null then
      insert into public.sponsors(id,sponsor_kind,business_name,description,website_url,phone,active,created_by,updated_by,created_at,updated_at)
      values(gen_random_uuid(),'ADVERTISER',advertiser_name,advertiser_description,advertiser_website,advertiser_phone,true,actor_user_id,actor_user_id,now(),now()) returning id into sponsor_record_id;
    else
      update public.sponsors set business_name=advertiser_name,description=advertiser_description,website_url=advertiser_website,phone=advertiser_phone,
        active=true,updated_by=actor_user_id,updated_at=now() where id=sponsor_record_id;
    end if;
  end if;
  if exists(select 1 from public.sponsor_placements placement where placement.active and placement.expo_group_key=group_key
    and placement.starts_on<=end_date_value and placement.ends_on>=start_date_value and placement.id<>placement_record_id
    and (placement.position=position_value or placement.sponsor_id=sponsor_record_id)) then raise exception 'SPONSORSHIP_OVERLAP'; end if;
  insert into public.sponsor_placements(id,sponsor_id,expo_group_key,starts_on,ends_on,position,active,created_by,updated_by,created_at,updated_at)
  values(placement_record_id,sponsor_record_id,group_key,start_date_value,end_date_value,position_value,true,actor_user_id,actor_user_id,now(),now())
  on conflict(id) do update set sponsor_id=excluded.sponsor_id,expo_group_key=excluded.expo_group_key,
    starts_on=excluded.starts_on,ends_on=excluded.ends_on,position=excluded.position,active=true,
    updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,'SPONSORSHIP_SAVED','sponsorship',placement_record_id,
    jsonb_build_object('groupKey',group_key,'startsOn',start_date_value,'endsOn',end_date_value,'position',position_value,'sponsorKind',kind),now());
  return placement_record_id;
end;
$$;

create or replace function public.disable_managed_sponsorship(actor_user_id uuid,sponsorship_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare placement public.sponsor_placements%rowtype;
begin
  if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN') then raise exception 'FORBIDDEN'; end if;
  select * into placement from public.sponsor_placements item where item.id=sponsorship_id for update;
  if not found then raise exception 'SPONSORSHIP_NOT_FOUND'; end if;
  update public.sponsor_placements set active=false,updated_by=actor_user_id,updated_at=now() where id=sponsorship_id;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor_user_id,'SPONSORSHIP_DISABLED','sponsorship',sponsorship_id,
    jsonb_build_object('groupKey',placement.expo_group_key),now());
  return to_jsonb(placement);
end;
$$;

revoke all on function public.managed_admin_operation_counts(uuid) from public,anon,authenticated;
revoke all on function public.managed_admin_operations_page(uuid,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.managed_admin_record_command(uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.managed_admin_featured_day(uuid,date,text,text[]) from public,anon,authenticated;
revoke all on function public.managed_featured_group_for_date(date) from public,anon,authenticated;
revoke all on function public.save_managed_featured_day(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.save_managed_sponsorship(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.disable_managed_sponsorship(uuid,uuid) from public,anon,authenticated;
grant execute on function public.managed_admin_operation_counts(uuid) to service_role;
grant execute on function public.managed_admin_operations_page(uuid,text,text,integer,integer) to service_role;
grant execute on function public.managed_admin_record_command(uuid,text,uuid,jsonb) to service_role;
grant execute on function public.managed_admin_featured_day(uuid,date,text,text[]) to service_role;
grant execute on function public.save_managed_featured_day(uuid,jsonb) to service_role;
grant execute on function public.save_managed_sponsorship(uuid,jsonb) to service_role;
grant execute on function public.disable_managed_sponsorship(uuid,uuid) to service_role;

comment on function public.managed_admin_operations_page(uuid,text,text,integer,integer) is
  'Permissioned bounded platform inventory projection without secrets, private files, or exact coordinates.';
comment on function public.managed_admin_record_command(uuid,text,uuid,jsonb) is
  'Atomic reversible platform command with current actor permission enforcement and audit.';
