-- Short-lived, single-use email challenges for restricted Shared capacity visitor sessions.
-- Browser clients receive no direct policy; server adapters perform every read and mutation.

create table if not exists public.shared_capacity_email_otps (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_email_digest text not null,
  code_digest text not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  expires_at timestamptz not null,
  used_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shared_capacity_email_otps_email_idx
  on public.shared_capacity_email_otps(recipient_email_digest,created_at desc);

alter table public.shared_capacity_email_otps enable row level security;

comment on table public.shared_capacity_email_otps is
  'Single-use Shared capacity email challenges. OTP plaintext is never persisted and no browser policy is granted.';

-- Earlier pre-release chat records may predate the required callback phone.
-- Enforce the invariant for every new or changed row without taking a table-wide
-- validation lock or failing this additive migration on those retained records.
-- Operations can remediate the historical rows and validate this constraint in
-- a later, separately reviewed migration.
alter table public.guest_support_conversations
  add constraint guest_support_callback_phone_required
  check (phone is not null) not valid;
