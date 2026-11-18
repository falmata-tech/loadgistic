-- FEAT-SEC-001 / FEAT-IAM-001. Keep the existing PostgREST RPC and JSON contract.
begin;
create schema loadgistic_identity;
revoke all on schema loadgistic_identity from public, anon, authenticated, service_role;
grant usage on schema loadgistic_identity to authenticated, service_role;

create function loadgistic_identity.read_own_account() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $$
declare
  account jsonb;
begin
  account := public.current_user_projection_pre_social167();
  if account is null then return null; end if;
  return account || jsonb_build_object('provider_account_name',
    public.provider_public_account_name(
      nullif(account->>'organization_id', '')::uuid,
      coalesce(nullif(account->>'provider_profile_id', '')::uuid,
               nullif(account->>'employer_provider_profile_id', '')::uuid)));
end;
$$;
revoke all on function loadgistic_identity.read_own_account() from public, anon, authenticated, service_role;
grant execute on function loadgistic_identity.read_own_account() to authenticated, service_role;

create or replace function public.current_user_projection() returns jsonb
language sql stable security invoker set search_path = pg_catalog, pg_temp as $$
  select loadgistic_identity.read_own_account();
$$;
revoke all on function public.current_user_projection() from public, anon;
grant execute on function public.current_user_projection() to authenticated, service_role;
commit;
