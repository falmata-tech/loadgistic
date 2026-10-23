-- FEAT-SEC-001 / ADR-065: additive, no application-row or extension changes.
-- Execute transactionally. Compatible with the pre-release identity RPC.
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$
begin
  if exists (
    select 1 from pg_db_role_setting s cross join unnest(s.setconfig) cfg
    where s.setrole in (0,'authenticator'::regrole::oid)
      and cfg like 'pgrst.db_pre_request=%'
      and (s.setrole=0 or s.setdatabase<>0
        or cfg<>'pgrst.db_pre_request=loadgistic_api_guard.check_request')
  ) then raise exception 'EXISTING_DATA_API_HOOK_REQUIRES_REVIEW'; end if;
  if to_regnamespace('loadgistic_api_guard') is not null and
    (select nspowner<>current_user::regrole from pg_namespace where nspname='loadgistic_api_guard') then
    raise exception 'UNEXPECTED_DATA_API_GUARD_OWNER';
  end if;
  if to_regprocedure('public.current_user_projection()') is null then
    raise exception 'OWN_IDENTITY_RPC_REQUIRED';
  end if;
end $$;

create schema if not exists loadgistic_api_guard;
revoke all on schema loadgistic_api_guard from public,anon,authenticated,service_role;
grant usage on schema loadgistic_api_guard to anon,authenticated,service_role;

create or replace function loadgistic_api_guard.check_request() returns void
language plpgsql security invoker set search_path=pg_catalog as $guard$
begin
  if current_user='service_role' then return; end if;
  if current_user='authenticated'
    and current_setting('request.path',true)='/rpc/current_user_projection'
    and current_setting('request.method',true) in ('GET','HEAD','POST')
    and coalesce(nullif(current_setting('request.headers',true),'')::jsonb ->>
      case when current_setting('request.method',true)='POST'
        then 'content-profile' else 'accept-profile' end,'public')='public'
  then return; end if;
  raise insufficient_privilege using message='BROWSER_DATA_API_ACCESS_DENIED';
end
$guard$;
revoke all on function loadgistic_api_guard.check_request() from public,anon,authenticated,service_role;
grant execute on function loadgistic_api_guard.check_request() to anon,authenticated,service_role;

alter role authenticator set pgrst.db_pre_request='loadgistic_api_guard.check_request';
notify pgrst,'reload schema';
notify pgrst,'reload config';
