-- Retain the independent provider's selected operating model without treating it as verification.

alter table public.applications
  drop constraint if exists applications_application_type_check;

alter table public.applications
  add constraint applications_application_type_check
  check (application_type in (
    'ENTERPRISE_SHIPPER',
    'ENTERPRISE_RECEIVER',
    'TRANSPORT_COMPANY',
    'INDEPENDENT_PROVIDER',
    'OWNER_OPERATOR',
    'SELF_MANAGED_DRIVER'
  ));

comment on column public.applications.application_type is
  'Immutable signup choice. OWNER_OPERATOR and SELF_MANAGED_DRIVER select the private verification workflow but never imply document approval.';
