# Supabase runtime cutover

The runnable application uses Supabase for managed identity, health, place search, the Truck Market, transporter microsites, Daily Featured Transporters, Shared capacity, provider Capacity, and provider-owned Tracking. Repository paths not yet migrated still have a Node SQLite compatibility adapter while ADR-041 is being completed; that is not an accepted Production fallback. Ordered SQL migrations `001` through `044` replay successfully against the isolated local Supabase PostgreSQL stack. A guarded deterministic importer creates the complete fake market in local Supabase Auth, PostgreSQL, and private Storage, and managed identity/storage/RLS/workflow checks pass with `DATABASE_PATH=/dev/null`. Profile, fleet, verification, billing, Support, administration, sponsorship management, and managed onboarding remain before Production readiness.

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
- `038`: adds the server-only bounded public-capacity projection, literal search, PostGIS route/Service-area matching, stable cursor indexes, post-limit Driver/review/document enrichment, and projection-time removal of private current geometry. Anonymous and ordinary authenticated clients cannot execute the RPC directly.
- `039`: adds a server-only published-review count and average aggregate for transporter microsites. Anonymous and ordinary authenticated clients cannot execute the aggregate RPC, and review-party data is never returned by it.
- `040`: adds the server-only regional candidate projection for Daily Featured Transporters and Sponsors. It rechecks published profile, structured base, public-contact, active-fleet, evidence, operating-model, review, and current-capacity facts while excluding private contact, document, coordinate, and account fields.
- `041`: keeps only the latest Empty or Partial signal discoverable through service-role public and Featured projections until an explicit Off Duty update. Historical expiry values and their authenticated RLS boundary remain unchanged, while public projections present capacity and approximate-location update age independently.
- `042`: adds service-role-only Shared-capacity grant, OTP, leased delivery, email-audience projection, Operations projection, immediate-revocation, and audit commands. Browser roles receive no direct function access.
- `043`: adds actor-scoped provider Capacity workspace and transactional current-signal, approximate-location, duty, and one-regular-service commands with canonical place resolution and repeated ownership/assignment/permission checks.
- `044`: adds provider-owned Tracking, customer-safe guest projection, status/location commands, verified review/dispute commands, leased email delivery, and bounded 30-day guest-data cleanup while preserving provider history.

The local configurator reads the isolated CLI stack without printing keys,
writes only the ignored mode-`0600` `.env.local`, imports the fake market, and
runs managed verification. It fails closed for any non-loopback API URL:

```bash
SUPABASE_CLI_PATH=/absolute/path/to/supabase npm run supabase:local:configure
```

Keys come from the isolated local Supabase CLI stack and must remain outside shell history, logs, and source control. The lower-level `db:supabase:fixtures` and `db:supabase:verify` commands remain available for CI orchestration with injected local-only variables. The importer uses `data/supabase-fixture-source.db` only as a disposable transformation source during cutover; it is not an application runtime or a remote import path.

The local fake-demand purge is implemented in `src/lib/db.js`. An equivalent cloud purge is intentionally not automatic: it is destructive and must be executed only after a verified backup, exact row-count review, and explicit rollout approval.

## Required adapter work

The managed identity slice is implemented behind `AUTH_BACKEND=supabase`: login and logout use the SSR route-cookie adapter, every request validates `auth.getUser()`, and the identity RPC maps only the matching active account. Managed workspace and Driver access projection is isolated from the local repository, so Supabase login requests do not load SQLite. Google PKCE and numeric email-code sign-in are implemented; managed provider onboarding remains pending.

The first PostgreSQL read/readiness slice is implemented behind `DATA_BACKEND=supabase`. `/api/health` counts the managed profile projection and fails closed with a non-secret `database-unavailable` blocker if PostgreSQL cannot be reached. `/api/places` uses a bounded server-only Supabase query and returns the existing public place contract without loading the SQLite repository.

The public Truck Market uses a separate application port that dynamically selects the Supabase adapter without importing the SQLite repository. Its service-role RPC returns only 12–16 rows plus one cursor look-ahead, evaluates every multi-city route segment and complete Service-area polygon in PostgreSQL, keeps text search literal, enriches only the bounded result set, and strips all private current geometry before returning a row. The server then produces the established safe badge, approximate-distance, regular-service, and geographic-match labels. Clean reset plus live fixture verification covers cursor uniqueness, status and route filters, private fallback, badge shape, and anonymous RPC denial.

Published transporter microsites use a second application port with explicit Supabase selections for the public page, active fleet, assigned Driver first name and callback, separate Driver/truck evidence badges, current safe Capacity projection, independently visible contacts, fixture portrait, and the latest 20 published review notes. PostgreSQL calculates the all-review count and average through a service-role-only aggregate. Hidden contacts, exact coordinates, private proof paths, surnames, and unknown or unpublished handles remain excluded.

Daily Featured Transporters uses its own application port and the pure two-session scheduler. PostgreSQL returns only candidates from the date-derived regional group and rechecks every eligibility input at read time. The server joins the administrator-ordered published roster and at most five active Sponsor placements, strips owner IDs and eligibility internals, maps manual schedule keys to public handles, and safely projects either eligible transporters or bounded outside advertisements. Anonymous and ordinary authenticated clients cannot execute the candidate RPC.

Shared capacity, provider Capacity, and provider-owned Tracking now select dedicated application ports. Service-role-only commands repeat ownership, assignment, subscription, permission, guest-grant, transition, and review rules in PostgreSQL. Delivery workers lease rows with `FOR UPDATE SKIP LOCKED`, and successful delivery is terminal. Clean local verification exercises all three slices with SQLite unavailable and proves browser-role denial.

Keep these active contracts stable while replacing SQLite operations:

- Public capacity cursor/detail and public provider projections.
- Provider profile, fleet, and verification commands.
- Provider billing, Support, and platform Operations commands.
- Account-free Assisted matching, private attachments, sponsor/featured administration, and remaining platform administration commands.

Use RLS-protected queries or transactional RPCs. Never place a service-role key in browser code, never return raw private-table rows to anonymous clients, and keep access-code verification on the server.

## Rollout sequence

1. Back up the target database and prove restore into an isolated environment.
2. Apply `001` through `044` to an empty/staging project and run Supabase SQL lint plus schema/RLS review.
   Migration `030` enforces callback phone on new Assisted matching rows with a
   `NOT VALID` compatibility constraint; remediate any retained pre-`030` null
   phone rows before validating that constraint in a later reviewed migration.
3. Import the bundled place catalog with `npm run places:import:supabase`.
4. Finish the remaining Supabase PostgreSQL repository, managed onboarding, and hardened private Storage adapters as the only application runtime; do not add a dual-write or runtime SQLite fallback.
5. Use the guarded deterministic local-Supabase Auth/PostgreSQL/Storage fixture, then run domain, authorization, RLS, cursor, guest-tracking, retention, and E2E suites against the isolated stack. Identity, public projections, Shared capacity, provider Capacity, and Tracking managed workflow verification are complete; remaining adapters and browser-suite cutover are pending.
6. Configure private proof/support storage, malware scanning/quarantine, email delivery, authorized Supabase Realtime with polling fallback, shared rate limiting, monitoring, and cleanup jobs.
7. Inventory any legacy cloud demand rows. After explicit approval, purge only the reviewed target rows and record counts/audit evidence.
8. Deploy the managed backend to a non-production environment, run `npm run launch:check`, and rehearse application and data rollback.
9. Remove SQLite from local development, browser tests, health checks, and deployment configuration after the Supabase workflow gates pass.

## Rollback

Roll back the application artifact first. Schema/data rollback requires the reviewed backup because the approved demand purge is destructive. Never reverse the product by deleting newly created provider shipments, party grants, email attempts, reviews, or audit evidence.
