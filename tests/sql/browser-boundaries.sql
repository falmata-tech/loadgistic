-- FEAT-SEC-001 / FEAT-IAM-001: local synthetic fixtures, no retained changes.
\set ON_ERROR_STOP on
begin;
select id as actor from public.profiles where email='transporter@loadgistic.local' \gset
set local request.jwt.claim.sub=:'actor';

-- The application identity RPC must work without table privileges.
set local role authenticated;
do $$ declare identity jsonb; begin
  identity:=public.current_user_projection();
  if identity->>'id' is distinct from auth.uid()::text or identity->>'active' is distinct from 'true' then
    raise exception 'ACTIVE_OWN_IDENTITY_REQUIRED';
  end if;
  begin perform id from public.profiles limit 1; raise exception 'ACTIVE_PROFILE_READ_ALLOWED'; exception when insufficient_privilege then null; end;
  begin perform id from public.organizations limit 1; raise exception 'ACTIVE_ORGANIZATION_READ_ALLOWED'; exception when insufficient_privilege then null; end;
  begin update public.vehicles set label=label where false; raise exception 'ACTIVE_DIRECT_VEHICLE_WRITE_ALLOWED'; exception when insufficient_privilege then null; end;
  begin perform public.is_org_member(null); raise exception 'BROWSER_MEMBER_HELPER_ALLOWED'; exception when insufficient_privilege then null; end;
  begin perform public.is_org_owner(null); raise exception 'BROWSER_OWNER_HELPER_ALLOWED'; exception when insufficient_privilege then null; end;
  begin perform public.has_workspace_access(); raise exception 'BROWSER_ACCESS_HELPER_ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Keep membership/history and a valid identity claim, as after account closure.
update public.profiles set active=false where id=:'actor';
set local role authenticated;
do $$ declare identity jsonb; begin
  identity:=public.current_user_projection();
  if identity->>'id' is distinct from auth.uid()::text or identity->>'active' is distinct from 'false' then
    raise exception 'INACTIVE_OWN_IDENTITY_REQUIRED';
  end if;
  begin perform id from public.vehicles limit 1; raise exception 'INACTIVE_VEHICLE_READ_ALLOWED'; exception when insufficient_privilege then null; end;
  begin insert into public.vehicles(id) values(gen_random_uuid()); raise exception 'INACTIVE_VEHICLE_INSERT_ALLOWED'; exception when insufficient_privilege then null; end;
  begin update public.vehicles set label=label; raise exception 'INACTIVE_VEHICLE_UPDATE_ALLOWED'; exception when insufficient_privilege then null; end;
  begin delete from public.vehicles where false; raise exception 'INACTIVE_VEHICLE_DELETE_ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.current_user_projection(); raise exception 'ANON_IDENTITY_ALLOWED'; exception when insufficient_privilege then null; end;
  begin perform id from public.profiles limit 1; raise exception 'ANON_PROFILE_READ_ALLOWED'; exception when insufficient_privilege then null; end;
  begin update public.vehicles set label=label where false; raise exception 'ANON_VEHICLE_WRITE_ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  if not exists(select 1 from public.profiles where id=auth.uid() and not active)
    or not exists(select 1 from public.organization_members where user_id=auth.uid())
    or not exists(select 1 from public.vehicles v join public.organization_members m on m.organization_id=v.organization_id where m.user_id=auth.uid()) then
    raise exception 'SERVICE_RETAINED_HISTORY_REQUIRED';
  end if;
  update public.profiles set active=true where id=auth.uid();
end $$;
reset role;

-- New application objects must not inherit browser table or sequence authority.
create table public.security_boundary_fixture(id bigint generated always as identity);
alter table public.security_boundary_fixture enable row level security;
do $$ declare browser text; privilege text; begin
  foreach browser in array array['anon','authenticated'] loop
    if has_table_privilege(browser,'public.security_boundary_fixture','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_sequence_privilege(browser,'public.security_boundary_fixture_id_seq','SELECT,UPDATE,USAGE') then
      raise exception 'FUTURE_BROWSER_PRIVILEGES_FORBIDDEN';
    end if;
  end loop;
  foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
    if not has_table_privilege('service_role','public.security_boundary_fixture',privilege) then
      raise exception 'FUTURE_SERVICE_TABLE_PRIVILEGE_REQUIRED';
    end if;
  end loop;
  if not has_sequence_privilege('service_role','public.security_boundary_fixture_id_seq','USAGE') then
    raise exception 'FUTURE_SERVICE_PRIVILEGES_REQUIRED';
  end if;
end $$;
rollback;
