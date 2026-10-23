-- FEAT-SEC-001 / FEAT-IAM-001: business data uses server-authorized adapters.
-- Retained membership must not confer a second, direct browser command path.
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$
declare relation record; columns text;
begin
  for relation in
    select c.oid,c.relname,c.relkind from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')
      and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass
        and d.objid=c.oid and d.deptype='e')
    order by c.relname
  loop
    if relation.relkind='S' then
      execute format('revoke all privileges on sequence public.%I from public,anon,authenticated',relation.relname);
    else
      execute format('revoke all privileges on table public.%I from public,anon,authenticated',relation.relname);
      -- Table-level REVOKE does not remove independently granted column ACLs.
      select string_agg(format('%I',attname),',' order by attnum) into columns
      from pg_attribute where attrelid=relation.oid and attnum>0 and not attisdropped;
      if columns is not null then
        execute format('revoke all privileges (%s) on table public.%I from public,anon,authenticated',columns,relation.relname);
      end if;
    end if;
  end loop;
end $$;

-- Only defaults for the application migration owner in the application schema.
-- Provider-owned defaults/extension relations are outside this migration.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public,anon,authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public,anon,authenticated;

revoke all privileges on function public.is_org_member(uuid),public.is_org_owner(uuid),public.has_workspace_access()
  from public,anon,authenticated;
grant execute on function public.is_org_member(uuid),public.is_org_owner(uuid),public.has_workspace_access()
  to service_role;

-- current_user_projection() remains authenticated, caller-bound and read-only.
-- Service adapters, RLS, retained rows and provider extension ACLs are unchanged.
