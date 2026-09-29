-- FEAT-SEC-001. Exact owner-run containment for Loadgistic's public PostGIS table.
-- Hosted target MUST be independently verified as tpwyyzoqijjmbvsmmvcm.
-- Supabase/support executes as the existing table owner. No role escalation,
-- ownership transfer, extension relocation, data rewrite or migration-ledger edit.
-- Run only after approved backup; use ON_ERROR_STOP. Safe to re-run.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_depend d on d.objid=c.oid and d.classid='pg_class'::regclass
    join pg_extension e on e.oid=d.refobjid
    where c.oid=to_regclass('public.spatial_ref_sys') and d.deptype='e' and e.extname='postgis'
  ) then raise exception 'EXPECTED_POSTGIS_REFERENCE_TABLE_REQUIRED'; end if;
  if not pg_has_role(current_user,(select relowner from pg_class where oid='public.spatial_ref_sys'::regclass),'USAGE') then
    raise exception 'EXISTING_TABLE_OWNER_REQUIRED';
  end if;
end $$;
alter table public.spatial_ref_sys enable row level security;
revoke all privileges on table public.spatial_ref_sys from public,anon,authenticated;
do $$
begin
  if not (select relrowsecurity from pg_class where oid='public.spatial_ref_sys'::regclass)
    or exists(select 1 from unnest(array['anon','authenticated']) as roles(name)
      where has_table_privilege(name,'public.spatial_ref_sys','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(name,'public.spatial_ref_sys','SELECT,INSERT,UPDATE,REFERENCES')) then
    raise exception 'SPATIAL_REFERENCE_REPAIR_POSTCONDITION_FAILED';
  end if;
  if not has_table_privilege('service_role','public.spatial_ref_sys','SELECT') then
    raise exception 'SERVICE_GEOGRAPHY_ACCESS_MUST_BE_PRESERVED';
  end if;
end $$;
commit;
