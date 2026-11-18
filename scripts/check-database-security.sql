-- FEAT-SEC-001. Metadata only; works with read-only catalog access.
do $$
declare unsafe text;
begin
  select string_agg(format('%I.%I',n.nspname,c.relname),', ' order by c.relname)
  into unsafe
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;
  if unsafe is not null then raise exception 'PUBLIC_RLS_REQUIRED: %',unsafe; end if;
  if to_regclass('public.spatial_ref_sys') is not null then
    if exists(select 1 from unnest(array['anon','authenticated']) as roles(name)
      where has_table_privilege(name,'public.spatial_ref_sys','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(name,'public.spatial_ref_sys','SELECT,INSERT,UPDATE,REFERENCES')) then
      raise exception 'SPATIAL_REFERENCE_BROWSER_PRIVILEGES_FORBIDDEN';
    end if;
  end if;
end $$;

-- Application ACLs must not reopen direct browser data or definer RPC access.
-- Extension relations have their separate provider-owner boundary above.
do $$
declare unsafe text;
begin
  select string_agg(distinct format('%I.%I',n.nspname,c.relname),', ')
  into unsafe
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  cross join unnest(array['anon','authenticated']) roles(name)
  where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
    and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
    and case when c.relkind='S' then has_sequence_privilege(roles.name,c.oid,'SELECT,UPDATE,USAGE')
      else has_table_privilege(roles.name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(roles.name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') end;
  if unsafe is not null then raise exception 'APPLICATION_BROWSER_PRIVILEGES_FORBIDDEN: %',unsafe; end if;

  select string_agg(p.oid::regprocedure::text,', ' order by p.oid::regprocedure::text)
  into unsafe
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
    and (has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE'));
  if unsafe is not null then raise exception 'APPLICATION_BROWSER_DEFINER_FORBIDDEN: %',unsafe; end if;
  if has_function_privilege('anon','public.current_user_projection()','EXECUTE')
    or has_schema_privilege('anon','loadgistic_identity','USAGE')
    or has_schema_privilege('authenticated','loadgistic_identity','CREATE')
    or has_function_privilege('anon','loadgistic_identity.read_own_account()','EXECUTE') then
    raise exception 'IDENTITY_ACCESS_TOO_BROAD';
  end if;
  if exists (
    select 1 from (
      select current_setting('pgrst.db_schemas',true) as schemas
      union all
      select substr(cfg,length('pgrst.db_schemas=')+1) from pg_db_role_setting
      cross join lateral unnest(setconfig) cfg
      where setrole in (0,'authenticator'::regrole::oid) and cfg like 'pgrst.db_schemas=%'
    ) settings, lateral unnest(string_to_array(settings.schemas,',')) exposed
    where trim(both '"' from trim(exposed))='loadgistic_identity'
  ) then raise exception 'PRIVATE_IDENTITY_SCHEMA_EXPOSED'; end if;
  if not has_function_privilege('authenticated','public.current_user_projection()','EXECUTE') then
    raise exception 'AUTHENTICATED_OWN_IDENTITY_REQUIRED';
  end if;
end $$;

-- Mirror the function-configuration advisor before a hosted migration. Invoker
-- and private helpers still need a fixed lookup scope; extension owners retain
-- their separate boundary and are not altered by this application gate.
do $$
declare unsafe text;
begin
  select string_agg(p.oid::regprocedure::text,', ' order by p.oid::regprocedure::text)
  into unsafe
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
    and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass
      and d.objid=p.oid and d.deptype='e')
    and not exists(select 1 from unnest(p.proconfig) as config(setting)
      where config.setting like 'search_path=%');
  if unsafe is not null then
    raise exception 'APPLICATION_FUNCTION_SEARCH_PATH_REQUIRED: %',unsafe;
  end if;
end $$;
