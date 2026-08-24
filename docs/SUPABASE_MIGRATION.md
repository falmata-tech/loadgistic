# Supabase runtime cutover

The runnable Loadgistic application still uses `src/lib/repository.js` with Node SQLite while ADR-041 is being implemented. That is now a migration state, not an accepted local runtime. Ordered SQL migrations `001` through `037` replay successfully against the isolated local Supabase PostgreSQL stack. A guarded deterministic importer now creates the complete fake market in local Supabase Auth, PostgreSQL, and private Storage, and its login/storage/RLS checks pass. The managed Auth role projection is implemented; the application repository and test-runtime cutover remain incomplete. Production readiness therefore remains blocked.

## Current migration coverage

- `001`–`005`: base identity, provider/workspace, legacy shipment, fleet, verification, billing, and initial RLS contracts.
- `006`–`008`: Ethiopia place data, structured geography, fleet routes, and native Support isolation.
- `009`–`011`: launch storage/indexes, Driver-authoritative location, privacy choices, and evidence-specific verification.
- `012`: converts Busy to Off Duty, removes dates from immediate capacity, adds radius-or-route geometry/work radius, maps compatible provider route fields, clears contract/available-again state, and narrows current market status.
- `013`: adds provider microsite presentation fields and provider-owned Tracking/events, compatible grant rows, private email retry records, and provider reviews. It historically introduced future-trip and regular-area tables that migration `014` removes. The active application writes one customer-owner grant per Tracking session. New execution tables have RLS enabled with no browser policy; the future server adapter must authorize commands and return explicit safe projections.
- `014`: historical simplification that deleted retired future-trip and regular-area records and introduced the earlier maximum-two route guard.
- `015`–`023`: featured-provider presentation, provider portraits, regional scheduling, sponsorship, structured demo geography, and the two-session broadcast schedule.
- `024`: adds regular Service-area geometry, prunes fake provider data to one regular-service signal, rebuilds that signal from provider current geography, and installs the database-level maximum-one guard.
- `025`–`027`: provider Tracking-location, retired-demand cleanup language, and provider signup operating-model contracts.
- `028`: truck-scoped email/Loadgistic Capacity access grants and idempotent recovery-email queue with RLS default denial.
- `029`: account-free Assisted matching conversations, messages, attachment metadata, events, and a private `support-attachment` bucket. Browser policies remain absent; the server adapter must reauthorize every conversation and file read.
- `030`: restricted Shared capacity email OTP challenges, keyed digests, attempts, expiry, supersession, and delivery-queue integration.
- `031`: unified transporter and outside-advertiser sponsor catalogue plus bounded regional/date placements and schedule attribution.
- `032`: creates and locks down the private `provider-profile` Storage bucket used by the transporter-image adapter.
- `033`: repairs and narrows the Driver duty RPC after the canonical capacity table rename used by the PostgreSQL runtime.
- `034`: closes current SQLite/PostgreSQL column parity for Driver Tracking authority, assigned regular-service signals, Support permissions, shipment assignment, and external shipment-party details.
- `035`: supplies current-table SQL privileges beneath RLS, reserves service-role repository access, denies anonymous Loadgistic application-table access, leaves Supabase-owned PostGIS metadata grants outside the application audit, and requires explicit privileges for every future table.
- `036`: permits a regular Service area to use one center for both endpoint labels while preserving distinct endpoints for regular Capacity routes.
- `037`: exposes one parameter-free, `auth.uid()`-bound account/workspace role projection for the SSR identity adapter and grants it only to authenticated/service roles.

The local-only fixture reset is explicit and refuses non-loopback Supabase URLs:

```bash
SUPABASE_SEED_URL=http://127.0.0.1:55321 \
SUPABASE_SEED_SERVICE_ROLE_KEY='local service-role key' \
npm run db:supabase:fixtures

SUPABASE_SEED_URL=http://127.0.0.1:55321 \
SUPABASE_SEED_SERVICE_ROLE_KEY='local service-role key' \
SUPABASE_SEED_ANON_KEY='local anonymous key' \
npm run db:supabase:verify
```

Keys come from the isolated local Supabase CLI stack and must remain outside shell history, logs, and source control. The importer uses `data/supabase-fixture-source.db` only as a disposable transformation source during cutover; it is not an application runtime or a remote import path.

The local fake-demand purge is implemented in `src/lib/db.js`. An equivalent cloud purge is intentionally not automatic: it is destructive and must be executed only after a verified backup, exact row-count review, and explicit rollout approval.

## Required adapter work

The managed identity slice is implemented behind `AUTH_BACKEND=supabase`: login and logout use the SSR route-cookie adapter, every request validates `auth.getUser()`, and the identity RPC maps only the matching active account. A real local login/session/logout check passes. The flag stays disabled for the normal application until repository pages no longer reach SQLite.

Keep these active contracts stable while replacing SQLite operations:

- Public capacity cursor/detail and public provider projections.
- Provider current-capacity, maximum-one regular-service, profile, fleet, and verification commands.
- Provider shipment creation, assignment, transitions, proof authorization, and bounded history.
- Customer-owner code verification and short-lived guest sessions.
- Completion-email queue/retry and 30-day retention cleanup.
- Provider review submission, low-rating dispute, and audited review decision.
- Provider billing, Support, and platform Operations commands.
- Private capacity grants, Shared capacity projections, Operations-only Loadgistic shares, account-free Assisted matching, private attachments, and recovery-email delivery attempts.

Use RLS-protected queries or transactional RPCs. Never place a service-role key in browser code, never return raw private-table rows to anonymous clients, and keep access-code verification on the server.

## Rollout sequence

1. Back up the target database and prove restore into an isolated environment.
2. Apply `001` through `037` to an empty/staging project and run Supabase SQL lint plus schema/RLS review.
   Migration `030` enforces callback phone on new Assisted matching rows with a
   `NOT VALID` compatibility constraint; remediate any retained pre-`030` null
   phone rows before validating that constraint in a later reviewed migration.
3. Import the bundled place catalog with `npm run places:import:supabase`.
4. Implement the Supabase PostgreSQL repository, managed identity, and private Storage adapters as the only application runtime; do not add a dual-write or runtime SQLite fallback.
5. Use the guarded deterministic local-Supabase Auth/PostgreSQL/Storage fixture, then run domain, authorization, RLS, cursor, guest-tracking, retention, and E2E suites against the isolated stack. The importer and basic runtime verification are complete; switching those suites from SQLite remains pending.
6. Configure private proof/support storage, malware scanning/quarantine, email delivery, authorized Supabase Realtime with polling fallback, shared rate limiting, monitoring, and cleanup jobs.
7. Inventory any legacy cloud demand rows. After explicit approval, purge only the reviewed target rows and record counts/audit evidence.
8. Deploy the managed backend to a non-production environment, run `npm run launch:check`, and rehearse application and data rollback.
9. Remove SQLite from local development, browser tests, health checks, and deployment configuration after the Supabase workflow gates pass.

## Rollback

Roll back the application artifact first. Schema/data rollback requires the reviewed backup because the approved demand purge is destructive. Never reverse the product by deleting newly created provider shipments, party grants, email attempts, reviews, or audit evidence.
