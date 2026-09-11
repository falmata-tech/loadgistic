-- BASE-BE-001 / FEAT-FLT-001
-- Bounded Fleet projection and one atomic owner command for Driver assignment
-- plus the two current operating permissions. Browser roles cannot call these
-- actor-id functions.

create or replace function public.fleet_driver_page(
  actor_user_id uuid,
  requested_offset integer default 0,
  requested_limit integer default 10
)
returns table(payload jsonb,total_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  bounded_offset integer:=greatest(0,coalesce(requested_offset,0));
  bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,10)));
begin
  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found or actor.actor_role<>'TRANSPORTER' or actor.organization_id is null then
    raise exception 'FORBIDDEN';
  end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  return query
  with scoped as (
    select
      profile.id,
      driver.name,
      driver.phone,
      driver.license_verified,
      coalesce(permission.can_manage_capacity,true) as can_manage_capacity,
      coalesce(permission.can_manage_tracking,true) as can_manage_tracking,
      assignment.vehicle_id as assigned_vehicle_id,
      case when vehicle.id is null then null else concat_ws(' · ',
        nullif(trim(concat_ws(' ',vehicle.make,vehicle.model)),''),
        vehicle.platform_number,
        nullif(vehicle.plate,'')) end as assigned_vehicles,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'verification_type',request.verification_type,
          'reviewed_at',request.reviewed_at,
          'expires_on',request.expires_on
        ) order by request.reviewed_at desc nulls last,request.submitted_at desc,request.id)
        from public.verification_requests request
        where request.subject_type='DRIVER' and request.subject_id=profile.id
          and request.status='APPROVED'
      ),'[]'::jsonb) as driver_documents,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'verification_type',request.verification_type,
          'reviewed_at',request.reviewed_at,
          'expires_on',request.expires_on,
          'related_vehicle_id',request.related_vehicle_id
        ) order by request.reviewed_at desc nulls last,request.submitted_at desc,request.id)
        from public.verification_requests request
        where request.subject_type='DRIVER' and request.subject_id=profile.id
          and request.verification_type='VEHICLE_AUTHORIZATION'
          and request.status='APPROVED'
          and request.related_vehicle_id=assignment.vehicle_id
      ),'[]'::jsonb) as authorization_documents
    from public.drivers driver
    join public.profiles profile on profile.id=driver.user_id
    left join public.driver_permissions permission on permission.user_id=profile.id
    left join lateral (
      select current_assignment.vehicle_id
      from public.driver_vehicle_assignments current_assignment
      where current_assignment.driver_user_id=profile.id and current_assignment.active
      order by current_assignment.assigned_at desc,current_assignment.id
      limit 1
    ) assignment on true
    left join public.vehicles vehicle on vehicle.id=assignment.vehicle_id and vehicle.active
    where driver.organization_id=actor.organization_id and driver.active
      and profile.active and profile.role='DRIVER'
  ), counted as (
    select scoped.*,count(*) over() as row_total
    from scoped
  )
  select jsonb_build_object(
    'id',row.id,
    'name',row.name,
    'phone',row.phone,
    'license_verified',row.license_verified,
    'can_manage_capacity',row.can_manage_capacity,
    'can_manage_tracking',row.can_manage_tracking,
    'assigned_vehicle_id',row.assigned_vehicle_id,
    'assigned_vehicles',row.assigned_vehicles,
    'driver_documents',row.driver_documents,
    'authorization_documents',row.authorization_documents
  ),row.row_total
  from counted row
  order by row.name,row.id
  offset bounded_offset limit bounded_limit;
end;
$$;

create or replace function public.update_fleet_driver_access(actor_user_id uuid,command jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor record;
  target_driver_id uuid;
  target_vehicle_id uuid;
  capacity_permission boolean;
  tracking_permission boolean;
  displaced_count integer:=0;
begin
  if command is null or jsonb_typeof(command)<>'object' then raise exception 'INVALID_DRIVER_ACCESS'; end if;
  begin target_driver_id:=(command->>'driver_user_id')::uuid;
  exception when others then raise exception 'NOT_FOUND'; end;
  begin target_vehicle_id:=nullif(trim(coalesce(command->>'vehicle_id','')),'')::uuid;
  exception when others then raise exception 'NOT_FOUND'; end;
  capacity_permission:=coalesce((command->>'can_manage_capacity')::boolean,false);
  tracking_permission:=coalesce((command->>'can_manage_tracking')::boolean,false);

  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found or actor.actor_role<>'TRANSPORTER' or actor.organization_id is null then
    raise exception 'FORBIDDEN';
  end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;
  if not exists(
    select 1 from public.drivers driver
    join public.profiles profile on profile.id=driver.user_id
    where driver.user_id=target_driver_id and driver.organization_id=actor.organization_id
      and driver.active and profile.active and profile.role='DRIVER'
  ) then raise exception 'NOT_FOUND'; end if;
  if target_vehicle_id is not null and not exists(
    select 1 from public.vehicles vehicle
    where vehicle.id=target_vehicle_id and vehicle.organization_id=actor.organization_id and vehicle.active
  ) then raise exception 'NOT_FOUND'; end if;

  with ended as (
    update public.driver_vehicle_assignments assignment
    set active=false
    where assignment.active and (
      assignment.driver_user_id=target_driver_id
      or target_vehicle_id is not null and assignment.vehicle_id=target_vehicle_id
    ) and not (
      target_vehicle_id is not null
      and assignment.driver_user_id=target_driver_id
      and assignment.vehicle_id=target_vehicle_id
    )
    returning 1
  ) select count(*) into displaced_count from ended;

  if target_vehicle_id is null then
    update public.driver_vehicle_assignments assignment set active=false
    where assignment.driver_user_id=target_driver_id and assignment.active;
  else
    insert into public.driver_vehicle_assignments(
      id,driver_user_id,vehicle_id,assigned_by,assigned_at,active
    ) values (
      gen_random_uuid(),target_driver_id,target_vehicle_id,actor_user_id,now(),true
    ) on conflict(driver_user_id,vehicle_id) do update set
      assigned_by=excluded.assigned_by,
      assigned_at=excluded.assigned_at,
      active=true;
  end if;

  insert into public.driver_permissions(
    user_id,can_browse_load_board,can_contact_businesses,can_negotiate_loads,
    can_manage_capacity,can_manage_tracking,updated_by,updated_at
  ) values (
    target_driver_id,false,false,false,capacity_permission,tracking_permission,actor_user_id,now()
  ) on conflict(user_id) do update set
    can_browse_load_board=false,
    can_contact_businesses=false,
    can_negotiate_loads=false,
    can_manage_capacity=excluded.can_manage_capacity,
    can_manage_tracking=excluded.can_manage_tracking,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  insert into public.audit_logs(
    actor_user_id,organization_id,action,entity_type,entity_id,details
  ) values (
    actor_user_id,actor.organization_id,'DRIVER_ACCESS_UPDATED','profile',target_driver_id,
    jsonb_build_object(
      'driver_user_id',target_driver_id,
      'vehicle_id',target_vehicle_id,
      'can_manage_capacity',capacity_permission,
      'can_manage_tracking',tracking_permission,
      'displaced_assignment_count',displaced_count
    )
  );

  return jsonb_build_object(
    'driver_user_id',target_driver_id,
    'vehicle_id',target_vehicle_id,
    'can_manage_capacity',capacity_permission,
    'can_manage_tracking',tracking_permission
  );
end;
$$;

revoke all on function public.fleet_driver_page(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.update_fleet_driver_access(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fleet_driver_page(uuid,integer,integer) to service_role;
grant execute on function public.update_fleet_driver_access(uuid,jsonb) to service_role;

comment on function public.fleet_driver_page(uuid,integer,integer) is
  'Bounded owner-only Driver access projection without account email or proof-file references.';
comment on function public.update_fleet_driver_access(uuid,jsonb) is
  'Atomic Fleet-owner assignment and current Capacity/Tracking permission command.';

create or replace function public.workspace_dashboard(actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  actor_profile public.profiles%rowtype;
  actor record;
  result jsonb;
begin
  select * into actor_profile from public.profiles profile
  where profile.id=actor_user_id and profile.active;
  if not found then raise exception 'FORBIDDEN'; end if;

  if actor_profile.role='ADMIN' then
    select jsonb_build_object(
      'counts',jsonb_build_object(
        'Review Disputes',(select count(*) from public.provider_reviews review where review.dispute_status='PENDING'),
        'Providers',(select count(*) from public.organizations organization where organization.type='TRANSPORT_COMPANY')
          +(select count(*) from public.provider_profiles),
        'Tracked Shipments',(select count(*) from public.provider_shipments),
        'Board Capacity',(select count(*) from public.capacities capacity
          where capacity.id=(select latest.id from public.capacities latest
            where latest.vehicle_id=capacity.vehicle_id order by latest.updated_at desc,latest.id desc limit 1)
            and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL'))
      ),
      'recent',coalesce((select jsonb_agg(to_jsonb(recent) order by recent.created_at desc,recent.id)
        from (select shipment.id,shipment.code,shipment.cargo_summary as title,
          shipment.operational_status,shipment.origin,shipment.destination,shipment.created_at
          from public.provider_shipments shipment
          order by shipment.created_at desc,shipment.id limit 6) recent),'[]'::jsonb),
      'notifications','[]'::jsonb
    ) into result;
    return result;
  end if;

  select * into actor from public.provider_capacity_actor_scope(actor_user_id);
  if not found or actor.actor_role not in ('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN'; end if;
  if not actor.workspace_access then raise exception 'SUBSCRIPTION_ACCESS_REQUIRED'; end if;

  select jsonb_build_object(
    'counts',jsonb_build_object(
      'Active Tracking',(select count(*) from public.provider_shipments shipment
        where (shipment.provider_organization_id=actor.organization_id
          or shipment.provider_profile_id=actor.provider_profile_id)
          and shipment.operational_status<>'COMPLETED'),
      'Completed Tracking',(select count(*) from public.provider_shipments shipment
        where (shipment.provider_organization_id=actor.organization_id
          or shipment.provider_profile_id=actor.provider_profile_id)
          and shipment.operational_status='COMPLETED'),
      'On-duty Trucks',(select count(*) from public.capacities capacity
        where (capacity.provider_organization_id=actor.organization_id
          or capacity.provider_profile_id=actor.provider_profile_id)
          and capacity.id=(select latest.id from public.capacities latest
            where latest.vehicle_id=capacity.vehicle_id order by latest.updated_at desc,latest.id desc limit 1)
          and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')),
      'Published Reviews',(select count(*) from public.provider_reviews review
        where (review.provider_organization_id=actor.organization_id
          or review.provider_profile_id=actor.provider_profile_id)
          and review.status='PUBLISHED')
    ),
    'recent',coalesce((select jsonb_agg(to_jsonb(recent) order by recent.created_at desc,recent.id)
      from (select shipment.id,shipment.code,shipment.cargo_summary as title,
        shipment.operational_status,shipment.origin,shipment.destination,shipment.created_at
        from public.provider_shipments shipment
        where shipment.provider_organization_id=actor.organization_id
          or shipment.provider_profile_id=actor.provider_profile_id
        order by shipment.created_at desc,shipment.id limit 6) recent),'[]'::jsonb),
    'notifications','[]'::jsonb
  ) into result;
  return result;
end;
$$;

revoke all on function public.workspace_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.workspace_dashboard(uuid) to service_role;
comment on function public.workspace_dashboard(uuid) is
  'Bounded role-scoped workspace counts and recent provider Tracking without private contacts or secrets.';
