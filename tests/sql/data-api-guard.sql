-- FEAT-SEC-001: exercise the actual invoker role, not a forged JWT/header claim.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local role anon;
do $$ begin
  perform set_config('request.path','/rpc/current_user_projection',true);
  perform set_config('request.method','POST',true);
  begin perform loadgistic_api_guard.check_request(); raise exception 'ANON_ALLOWED';
  exception when insufficient_privilege then
    if sqlerrm<>'BROWSER_DATA_API_ACCESS_DENIED' then raise; end if;
  end;
end $$;
reset role;
set local role authenticated;
do $$ declare method text; path text; begin
  perform set_config('request.headers','{}',true);
  perform set_config('request.path','/rpc/current_user_projection',true);
  foreach method in array array['GET','HEAD','POST'] loop
    perform set_config('request.method',method,true);
    perform loadgistic_api_guard.check_request();
  end loop;
  foreach method in array array['PATCH','DELETE','PUT','OPTIONS',''] loop
    perform set_config('request.method',method,true);
    begin perform loadgistic_api_guard.check_request(); raise exception 'BAD_METHOD_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm<>'BROWSER_DATA_API_ACCESS_DENIED' then raise; end if;
    end;
  end loop;
  perform set_config('request.method','POST',true);
  perform set_config('request.headers','{"role":"service_role","x-role":"service_role"}',true);
  foreach path in array array['/profiles','/spatial_ref_sys','/rpc/is_org_owner','/rpc/graphql','/rpc/current_user_projection/',''] loop
    perform set_config('request.path',path,true);
    begin perform loadgistic_api_guard.check_request(); raise exception 'BAD_PATH_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm<>'BROWSER_DATA_API_ACCESS_DENIED' then raise; end if;
    end;
  end loop;
  perform set_config('request.path','/rpc/current_user_projection',true);
  foreach method in array array['GET','HEAD','POST'] loop
    perform set_config('request.method',method,true);
    perform set_config('request.headers','{"accept-profile":"graphql_public","content-profile":"graphql_public"}',true);
    begin perform loadgistic_api_guard.check_request(); raise exception 'BAD_SCHEMA_ALLOWED';
    exception when insufficient_privilege then
      if sqlerrm<>'BROWSER_DATA_API_ACCESS_DENIED' then raise; end if;
    end;
  end loop;
end $$;
reset role;
set local role service_role;
select loadgistic_api_guard.check_request();
reset role;
do $$ begin
  begin perform loadgistic_api_guard.check_request(); raise exception 'UNLISTED_ROLE_ALLOWED';
  exception when insufficient_privilege then
    if sqlerrm<>'BROWSER_DATA_API_ACCESS_DENIED' then raise; end if;
  end;
end $$;
rollback;
