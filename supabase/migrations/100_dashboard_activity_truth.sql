-- FEAT-UIX-001: preserve caller authority and scope; correct dashboard facts only.
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
            and exists(select 1 from public.vehicles vehicle where vehicle.id=capacity.vehicle_id and vehicle.active)
          and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL'))
      ),
      'recent',coalesce((select jsonb_agg(to_jsonb(recent) order by recent.updated_at desc,recent.id)
        from (select shipment.id,shipment.code,shipment.cargo_summary as title,
          shipment.operational_status,shipment.origin,shipment.destination,shipment.created_at,shipment.updated_at
          from public.provider_shipments shipment
          order by shipment.updated_at desc,shipment.id limit 6) recent),'[]'::jsonb),
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
          and shipment.operational_status not in ('COMPLETED','CANCELLED')),
      'Completed Tracking',(select count(*) from public.provider_shipments shipment
        where (shipment.provider_organization_id=actor.organization_id
          or shipment.provider_profile_id=actor.provider_profile_id)
          and shipment.operational_status='COMPLETED'),
      'On-duty Trucks',(select count(*) from public.capacities capacity
        where (capacity.provider_organization_id=actor.organization_id
          or capacity.provider_profile_id=actor.provider_profile_id)
          and capacity.id=(select latest.id from public.capacities latest
            where latest.vehicle_id=capacity.vehicle_id order by latest.updated_at desc,latest.id desc limit 1)
          and exists(select 1 from public.vehicles vehicle where vehicle.id=capacity.vehicle_id and vehicle.active)
          and coalesce(capacity.market_status,capacity.status::text) in ('EMPTY','PARTIAL')),
      'Published Reviews',(select count(*) from public.provider_reviews review
        where (review.provider_organization_id=actor.organization_id
          or review.provider_profile_id=actor.provider_profile_id)
          and review.status='PUBLISHED')
    ),
    'recent',coalesce((select jsonb_agg(to_jsonb(recent) order by recent.updated_at desc,recent.id)
      from (select shipment.id,shipment.code,shipment.cargo_summary as title,
        shipment.operational_status,shipment.origin,shipment.destination,shipment.created_at,shipment.updated_at
        from public.provider_shipments shipment
        where shipment.provider_organization_id=actor.organization_id
          or shipment.provider_profile_id=actor.provider_profile_id
        order by shipment.updated_at desc,shipment.id limit 6) recent),'[]'::jsonb),
    'notifications','[]'::jsonb
  ) into result;
  return result;
end;
$$;

revoke all on function public.workspace_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.workspace_dashboard(uuid) to service_role;
