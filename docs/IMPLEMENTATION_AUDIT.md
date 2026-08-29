# Implementation audit

Current as of 2026-08-29. Historical evidence remains in Git and the dated
application audit; this document describes the active runtime.

## Real and wired

- Next.js App Router UI, route handlers, responsive PWA shells, and role-aware
  public/provider/Driver/Support/administrator navigation.
- Supabase Auth with SSR refresh, Google PKCE, numeric email codes, inactive
  signup bootstrap, and an explicitly local fixture-password option.
- Supabase PostgreSQL/PostGIS for every application read, command, request
  counter, audit record, fixture, and scale test.
- Supply-only Truck Market, transporter microsites, Daily Featured and Sponsors,
  Shared capacity, provider Capacity, provider-owned Tracking, reviews, Fleet,
  Verification/Billing, Support, Assisted matching, and Operations.
- Supabase private Storage with signature validation, quarantine, explicit-clean
  scanning, purpose-bucket release, and authorization on every read.
- Bounded idempotent email queues and the scheduled Netlify operations worker.
- Production build, desktop/mobile Playwright, accessibility, UI/stress audit,
  source/spec checks, managed live verifiers, GitHub CI, and a non-root
  standalone Docker definition.

## Deterministic non-Production data

`resources/fixtures/managed-market.json` is a credential-free supply fixture,
not a customer claim. It contains no password or access-code material, demand,
private conversation, or machine-local path. The guarded importer refuses
Production and non-loopback Supabase targets.

The normal fixture creates 30 published transporters, 143 current-capacity
signals, 122 Drivers/assignments, 335 verification records, the Ethiopia place
catalog, and a current-date regional Featured/Sponsor programme. The scale gate
adds 5,000 trucks in one isolated PostgreSQL transaction and rolls it back.

## External controls still required for hosted Production

- Apply migrations `001`–`057` to the exact reviewed hosted project and record
  backup/restore, lint, RLS, fixture-free smoke, and rollback evidence.
- Configure exact Supabase Site/Redirect URLs, Google OAuth credentials, numeric
  email templates, and a verified SMTP provider.
- Configure a reviewed managed malware scanner. The local EICAR-aware scanner is
  intentionally test-only.
- Configure the verified application email sender and monitor leased delivery,
  retry, retention, and scheduled-worker failures.
- Configure Netlify environment values, deploy Preview, execute critical and
  security smoke tests, then explicitly approve Production promotion.
- Monitor Supabase/Netlify free-plan quotas and maintain encrypted off-platform
  logical backups.
- Keep the direct OpenStreetMap community tile endpoint as a monitored beta
  fallback only; select an appropriate provider before sustained traffic.

## Security boundary

No service-role key reaches browser code. Anonymous and ordinary authenticated
roles cannot execute server-only projection or command RPCs. PostgreSQL commands
repeat actor, ownership, assignment, permission, subscription, state, and file
authorization rather than trusting a browser projection. Missing PostgreSQL,
Storage, shared rate-limit, or scanner configuration fails closed without an
alternate persistence engine or local serverless files.

`npm run launch:check` may report hosted-configuration blockers until the
external controls above are proven. A passing build or local Docker health check
alone is not Production approval.
