-- FEAT-IAM-001
-- Reconcile only confirmed provider-access identities created before migration
-- 045 installed the Auth-user profile bootstrap trigger. Platform-reserved or
-- already-associated identities remain untouched.

insert into public.profiles(
  id,email,phone,full_name,role,active,created_at
)
select
  identity.id,
  lower(trim(identity.email)),
  null,
  left(trim(coalesce(
    nullif(identity.raw_user_meta_data->>'full_name',''),
    nullif(identity.raw_user_meta_data->>'name',''),
    nullif(split_part(identity.email,'@',1),''),
    'Transport provider'
  )),120),
  'DRIVER'::public.user_role,
  false,
  coalesce(identity.created_at,clock_timestamp())
from auth.users identity
where identity.email_confirmed_at is not null
  and nullif(trim(coalesce(identity.email,'')),'') is not null
  and nullif(trim(coalesce(identity.raw_app_meta_data->>'role','')),'') is null
  and nullif(trim(coalesce(identity.raw_app_meta_data->>'provisioned_by','')),'') is null
  and not exists(select 1 from public.profiles record where record.id=identity.id)
  and not exists(select 1 from public.applications record where record.user_id=identity.id)
  and not exists(select 1 from public.provider_profiles record where record.user_id=identity.id)
  and not exists(select 1 from public.organization_members record where record.user_id=identity.id)
  and not exists(select 1 from public.drivers record where record.user_id=identity.id)
  and not exists(select 1 from public.driver_permissions record where record.user_id=identity.id)
  and not exists(select 1 from public.driver_vehicle_assignments record where record.driver_user_id=identity.id)
  and not exists(select 1 from public.support_agent_profiles record where record.user_id=identity.id)
on conflict(id) do nothing;

comment on table public.profiles is
  'Private managed identity projection; confirmed pre-bootstrap identities are reconciled only when role-free and association-free.';
