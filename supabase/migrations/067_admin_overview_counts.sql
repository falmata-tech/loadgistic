-- FEAT-ADM-001
-- Add the company-Driver total required by the compact administration overview.

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
    'drivers',(select count(*) from public.drivers driver
      join public.profiles profile on profile.id=driver.user_id
      where profile.role::text='DRIVER'),
    'tracking',(select count(*) from public.provider_shipments),
    'board_capacity',(select count(*) from public.vehicles vehicle
      join lateral (
        select capacity.market_status,capacity.status
        from public.capacities capacity where capacity.vehicle_id=vehicle.id
        order by capacity.updated_at desc,capacity.id desc limit 1
      ) latest on true
      where vehicle.active and coalesce(latest.market_status,latest.status::text) in ('EMPTY','PARTIAL')),
    'routes',(select count(*) from public.profile_routes)+(select count(*) from public.service_areas),
    'subscriptions',(select count(*) from public.subscriptions)
  );
end;
$$;

revoke all on function public.managed_admin_operation_counts(uuid) from public,anon,authenticated;
grant execute on function public.managed_admin_operation_counts(uuid) to service_role;

comment on function public.managed_admin_operation_counts(uuid) is
  'Permissioned aggregate counts for the administration overview and Records inventory.';
