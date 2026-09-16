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
