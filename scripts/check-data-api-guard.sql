-- FEAT-SEC-001: independent catalog gate; does not replace the RLS/ACL gate.
do $$
declare fn pg_proc; browser text;
begin
  select * into fn from pg_proc where oid=to_regprocedure('loadgistic_api_guard.check_request()');
  if fn.oid is null or fn.prosecdef or fn.prorettype<>'void'::regtype
    or fn.proconfig is distinct from array['search_path=pg_catalog'] then
    raise exception 'DATA_API_GUARD_FUNCTION_REQUIRED';
  end if;
  if not exists(select 1 from pg_db_role_setting s cross join unnest(s.setconfig) cfg
    where s.setrole='authenticator'::regrole and s.setdatabase=0
      and cfg='pgrst.db_pre_request=loadgistic_api_guard.check_request')
    or exists(select 1 from pg_db_role_setting s cross join unnest(s.setconfig) cfg
      where s.setrole in (0,'authenticator'::regrole::oid) and cfg like 'pgrst.db_pre_request=%'
        and (s.setrole=0 or s.setdatabase<>0 or cfg<>'pgrst.db_pre_request=loadgistic_api_guard.check_request')) then
    raise exception 'DATA_API_GUARD_SETTING_REQUIRED';
  end if;
  foreach browser in array array['anon','authenticated','service_role'] loop
    if has_schema_privilege(browser,'loadgistic_api_guard','CREATE')
      or not has_schema_privilege(browser,'loadgistic_api_guard','USAGE')
      or not has_function_privilege(browser,fn.oid,'EXECUTE') then
      raise exception 'DATA_API_GUARD_PRIVILEGES_INVALID';
    end if;
  end loop;
  if exists(select 1 from aclexplode(fn.proacl) where grantee=0 and privilege_type='EXECUTE') then
    raise exception 'DATA_API_GUARD_PUBLIC_EXECUTE_FORBIDDEN';
  end if;
end $$;
