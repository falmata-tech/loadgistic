-- FEAT-IAM-001 / FEAT-APP-001
-- Unified account access may provision only a pristine inactive Auth bootstrap.
-- Suspended users and identities reserved for platform roles must never be
-- repurposed as provider accounts.

create or replace function public.managed_provider_signup_eligible(actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth,pg_temp
as $$
  select exists(
    select 1
    from public.profiles profile
    join auth.users identity on identity.id=profile.id
    where profile.id=actor_user_id
      and profile.active=false
      and profile.role::text='DRIVER'
      and identity.email_confirmed_at is not null
      and nullif(trim(coalesce(identity.email,'')),'') is not null
      and nullif(trim(coalesce(identity.raw_app_meta_data->>'role','')),'') is null
      and nullif(trim(coalesce(identity.raw_app_meta_data->>'provisioned_by','')),'') is null
      and not exists(select 1 from public.applications record where record.user_id=profile.id)
      and not exists(select 1 from public.provider_profiles record where record.user_id=profile.id)
      and not exists(select 1 from public.organization_members record where record.user_id=profile.id)
      and not exists(select 1 from public.drivers record where record.user_id=profile.id)
      and not exists(select 1 from public.driver_permissions record where record.user_id=profile.id)
      and not exists(select 1 from public.driver_vehicle_assignments record where record.driver_user_id=profile.id)
      and not exists(select 1 from public.support_agent_profiles record where record.user_id=profile.id)
  )
$$;

create or replace function public.complete_eligible_provider_signup(
  actor_user_id uuid,
  requested_token_digest text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
begin
  -- Serialize role/profile changes before evaluating the complete account state.
  perform 1 from public.profiles profile where profile.id=actor_user_id for update;
  perform 1 from auth.users identity where identity.id=actor_user_id for update;
  if not public.managed_provider_signup_eligible(actor_user_id) then
    raise exception 'SIGNUP_NOT_AVAILABLE';
  end if;
  return public.complete_provider_signup(actor_user_id,requested_token_digest);
end;
$$;

revoke all on function public.managed_provider_signup_eligible(uuid) from public,anon,authenticated;
revoke all on function public.complete_eligible_provider_signup(uuid,text) from public,anon,authenticated;
revoke all on function public.complete_provider_signup(uuid,text) from service_role;
grant execute on function public.managed_provider_signup_eligible(uuid) to service_role;
grant execute on function public.complete_eligible_provider_signup(uuid,text) to service_role;

comment on function public.managed_provider_signup_eligible(uuid) is
  'Returns true only for a confirmed, pristine inactive Auth bootstrap with no existing Loadgistic role or workspace associations.';
comment on function public.complete_eligible_provider_signup(uuid,text) is
  'Locks the Auth identity and profile, enforces pristine-bootstrap eligibility, then performs atomic provider provisioning.';
