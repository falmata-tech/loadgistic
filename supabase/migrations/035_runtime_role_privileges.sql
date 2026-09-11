-- BASE-BE-001 / FEAT-IAM-001: PostgreSQL privileges are required in addition
-- to RLS policies. The service repository performs explicit authorization;
-- authenticated requests remain independently constrained by RLS.

grant usage on schema public to anon,authenticated,service_role;

revoke all privileges on all tables in schema public from anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

grant usage,select on all sequences in schema public to authenticated,service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from authenticated;
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage,select on sequences to authenticated,service_role;

-- Supabase owns the PostGIS metadata relations and their platform grants.
-- They contain no Loadgistic application records and are excluded from the
-- application-table privilege/RLS audit.

comment on schema public is
  'Loadgistic application schema. SQL privileges permit access paths; RLS and server authorization determine row access.';
