# Supabase PostGIS repair — verified complete

## Current status — September 23, 2026 (UTC)

The owner supplied Support's completion notice. Independent read-only verification
at 06:09 UTC confirms `extensions.spatial_ref_sys`, owned by `supabase_admin`,
PostGIS 3.3.7 in `extensions`, and no `public.spatial_ref_sys`. No public table
lacks RLS. The unchanged full catalog security, API-guard catalog and service-role
spatial query checks pass; Security Advisor reports no ERROR. Three live anonymous
API probes return the required guard denial, and application health returns 200.
Protected evidence: `.local/postgis-completion-20260923.json` and
`.local/postgis-completion-http-20260923.json`.

The original exposed-reference-table finding is resolved. The existing warnings
for own-identity SECURITY DEFINER access and leaked-password protection remain
recorded separately. No remote database/configuration write was made for this
verification. Application release and the pending map visual review are separate.
A concise acknowledgement is prepared locally; it has not been sent.

## Historical request and preparation — superseded by the completed move

September 20 update: the owner supplied Support's reply offering an in-place
PostGIS move to extensions after backup confirmation. The fresh backup, full
restore and target-layout compatibility checks passed; see
[POSTGIS_RELOCATION_READINESS.md](POSTGIS_RELOCATION_READINESS.md). A narrowly
scoped follow-up was explicitly approved and SMTP accepted at
2026-09-20T18:25:28.436Z. It confirms the verified backup and requests Paul's
proposed in-place move; no attachment was resent. Provider completion remains
unconfirmed. The historical original request below is preserved unchanged;
the approved relocation now supersedes its RLS-only repair proposal.

Historical status, 2026-09-18: the owner-selected Data API guard is active. Live
anonymous REST and GraphQL requests are denied; service access and public site
health passed. This closes the verified API access path without changing table
ownership or deleting data. The table-level RLS/ACL repair requested below is
still outstanding, and its advisor warning remains. See ../PROGRESS.md for exact
activation and verification evidence. The sent email/attachment are unchanged;
no additional message was sent.

On 2026-09-17T03:20:40.889Z, after explicit owner approval, the agent sent the exact reviewed
request and SQL attachment to support@supabase.com from the verified registered
owner account. SMTP accepted the one recipient with zero rejections. This confirms
submission, not inbox delivery, a support case number or completion of the repair.
Protected receipt: `.local/support-repair-submission.json`. Do not resend while
awaiting a response. The hosted finding remains open pending provider execution
and independent catalog/advisor checks.

Historical read-only verification (2026-09-20T19:04:54.392Z): the critical advisor,
disabled RLS and table-level anonymous CRUD grants remain present. The separate
API guard denies those browser requests; the owner-side repair is not confirmed.

Project: Loadgistic, `tpwyyzoqijjmbvsmmvcm`.
Subject: Owner-side containment required for public PostGIS reference table.

Security Advisor reports `rls_disabled_in_public` on `public.spatial_ref_sys`.
Read-only catalog inspection on 2026-09-16 confirms `supabase_admin` owns the
PostGIS member table; anon/authenticated have broad grants and PUBLIC has SELECT.
Our postgres role has neither owner membership nor SELECT grant option. The
same ownership prevents the normal ALTER TABLE repair in an isolated local test.

Please apply the attached reviewed `spatial-reference-owner-repair.sql` as the
existing table owner after confirming the project and our backup readiness.
It enables RLS, removes PUBLIC/anon/authenticated direct privileges, preserves
service-role access and checks its postconditions atomically. It changes no rows,
credentials, roles, ownership, extension placement or application settings.
Please confirm the resulting RLS/ACL metadata and run the security advisor again.

Local proof: anon/authenticated CRUD denied; service reference lookup and PostGIS
transformation still pass. Please also advise how future managed extension
updates preserve this containment. Do not relocate/drop/recreate PostGIS or
broaden our role as a workaround without a separate reviewed plan.

Backup readiness, verified 2026-09-17: the encrypted custom database archive
passed authenticated recovery and full restore in a network-disabled disposable
container (52 public tables, migration ledger 076), then cleanup. Private Storage
backup passed local object restore/download hash comparison and cleanup. No
credentials, customer rows or backup contents are attached to this request.
The finding is not marked resolved.

Reviewed SQL SHA-256: `7b10729417b0171a0a2fc1ce3a89a442b2b68c29b0730a955aa1817867db9429`.
The owner must verify this digest and the exact project before execution.
