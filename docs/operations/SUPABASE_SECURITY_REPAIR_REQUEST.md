# Prepared support request — owner sends; not sent by the agent

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
