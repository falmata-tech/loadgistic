-- FEAT-APP-001 / FEAT-BIL-001
-- Provider signup must not depend on demo-fixture data. Install the minimum
-- commercial catalogue on a fresh managed database, while preserving any
-- existing plan identity and an operator's deliberate inactive state.

insert into public.plans(id,code,name,audience,active)
values
  ('ac140741-0b15-4a2b-9346-da0499f62001','BUSINESS_CAPACITY','Business access','BUSINESS',true),
  ('ac140741-0b15-4a2b-9346-da0499f62002','FLEET_DEMAND','Fleet transporter','TRANSPORTER',true),
  ('ac140741-0b15-4a2b-9346-da0499f62003','SELF_MANAGED_DRIVER','Independent Driver','DRIVER',true)
on conflict(code) do nothing;

comment on table public.plans is
  'Managed commercial plan catalogue; minimum signup plans are installed independently of demo data and operator-disabled plans remain disabled.';
