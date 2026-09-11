-- Extend the shared managed permission helper to every documented platform
-- team responsibility. Administrators retain all platform permissions.

create or replace function public.managed_actor_has_permission(actor_user_id uuid,permission_name text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.profiles profile
    left join public.support_agent_profiles support on support.user_id=profile.id
    where profile.id=actor_user_id and profile.active and (
      profile.role='ADMIN'
      or profile.role='SUPPORT' and support.active and case upper(permission_name)
        when 'CUSTOMERS' then support.can_manage_customers
        when 'OPERATIONS' then support.can_manage_operations
        when 'TRUST' then support.can_manage_trust
        when 'BILLING' then support.can_manage_billing
        when 'SUPPORT' then support.can_manage_support
        else false
      end
    )
  )
$$;

revoke all on function public.managed_actor_has_permission(uuid,text) from public,anon,authenticated;
grant execute on function public.managed_actor_has_permission(uuid,text) to service_role;
