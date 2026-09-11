-- FEAT-IAM-001: one authenticated, bounded role projection for the SSR
-- identity adapter. The caller cannot supply a user id; auth.uid() is the only
-- subject and the result contains account/workspace facts, never credentials.

create or replace function public.current_user_projection()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'id',profile.id,
    'email',profile.email,
    'phone',profile.phone,
    'name',profile.full_name,
    'role',profile.role,
    'active',profile.active,
    'created_at',profile.created_at,
    'organization_id',organization.id,
    'organization_name',organization.name,
    'organization_handle',organization.handle,
    'organization_type',organization.type,
    'provider_profile_id',provider.id,
    'provider_business_name',provider.business_name,
    'provider_handle',provider.handle,
    'application_type',application.application_type,
    'driver_kind',case
      when profile.role='DRIVER' and provider.id is not null then 'SELF_MANAGED'
      when profile.role='DRIVER' and organization.id is not null then 'COMPANY'
      else null
    end,
    'provider_operating_model',case
      when profile.role='TRANSPORTER' then 'FLEET_TRANSPORTER'
      when profile.role='DRIVER' and organization.id is not null then 'COMPANY_DRIVER'
      when profile.role='DRIVER' and provider.id is not null and (
        application.application_type='OWNER_OPERATOR'
        or exists(
          select 1
          from public.vehicles vehicle
          join public.verification_requests verification
            on verification.subject_type='VEHICLE'
           and verification.subject_id=vehicle.id
           and verification.verification_type='VEHICLE_OWNERSHIP'
           and verification.status='APPROVED'
          where vehicle.provider_profile_id=provider.id
            and vehicle.active
            and (verification.expires_on is null or verification.expires_on>=current_date)
        )
      ) then 'OWNER_OPERATOR'
      when profile.role='DRIVER' and provider.id is not null then 'SELF_MANAGED_DRIVER'
      else null
    end,
    'can_browse_load_board',coalesce(driver_permission.can_browse_load_board,true),
    'can_contact_businesses',coalesce(driver_permission.can_contact_businesses,true),
    'can_negotiate_loads',coalesce(driver_permission.can_negotiate_loads,true),
    'can_manage_capacity',coalesce(driver_permission.can_manage_capacity,true),
    'can_manage_tracking',coalesce(driver_permission.can_manage_tracking,true),
    'can_manage_customers',coalesce(support_agent.can_manage_customers,false),
    'can_manage_operations',coalesce(support_agent.can_manage_operations,false),
    'can_manage_trust',coalesce(support_agent.can_manage_trust,false),
    'can_manage_billing',coalesce(support_agent.can_manage_billing,false),
    'can_manage_support',coalesce(support_agent.can_manage_support,false),
    'workspace_subscription',case when subscription.id is null then null else jsonb_build_object(
      'id',subscription.id,
      'organization_id',subscription.organization_id,
      'provider_profile_id',subscription.provider_profile_id,
      'plan_id',subscription.plan_id,
      'plan_name',plan.name,
      'plan_code',plan.code,
      'status',subscription.status,
      'billing_model',subscription.billing_model,
      'starts_at',subscription.starts_at,
      'ends_at',subscription.ends_at,
      'updated_at',subscription.updated_at
    ) end
  )
  from public.profiles profile
  left join lateral (
    select member.organization_id
    from public.organization_members member
    where member.user_id=profile.id
    order by case when member.membership_role='OWNER' then 0 else 1 end,member.id
    limit 1
  ) membership on true
  left join public.organizations organization on organization.id=membership.organization_id
  left join public.provider_profiles provider on provider.user_id=profile.id
  left join public.driver_permissions driver_permission on driver_permission.user_id=profile.id
  left join public.support_agent_profiles support_agent on support_agent.user_id=profile.id
  left join lateral (
    select candidate.application_type
    from public.applications candidate
    where candidate.user_id=profile.id
    order by candidate.created_at desc,candidate.id
    limit 1
  ) application on true
  left join lateral (
    select candidate.*
    from public.subscriptions candidate
    where candidate.organization_id=organization.id
       or candidate.provider_profile_id=provider.id
    order by candidate.starts_at desc,candidate.id
    limit 1
  ) subscription on true
  left join public.plans plan on plan.id=subscription.plan_id
  where profile.id=auth.uid()
$$;

revoke all on function public.current_user_projection() from public,anon;
grant execute on function public.current_user_projection() to authenticated,service_role;

comment on function public.current_user_projection() is
  'Returns only the active caller identity/workspace projection used by the Loadgistic SSR authorization adapter.';
