# Supabase runtime cutover

The runnable application uses Supabase for managed identity, managed provider signup, health, place search, Open capacity, transporter microsites, Daily Featured Trucks, Private capacity, provider Capacity, provider-owned Tracking, transporter-profile editing, the authenticated workspace/Fleet runtime, Verification/Billing, member Support, Assisted matching, platform-team management, Operations, Featured/Sponsor administration, shared abuse counters, and private upload quarantine. Active ports have no data/storage backend selector: PostgreSQL counters and private Supabase Storage fail closed when unavailable. Ordered SQL migrations `001` through `072` and the credential-free managed fixture are the only database sources. The guarded local importer creates the complete fake market directly in isolated Supabase Auth, PostgreSQL, and private Storage without opening or transforming another database engine.

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
- `045`: adds a server-only 15-minute managed-provider signup intent, inactive Auth-profile bootstrap, and one transactional workspace/page/application/seven-day-trial provisioning command. It grants application authority last and denies both commands to browser roles.
- `046`: replaces the leased Tracking-email projection with a customer-safe completion timeline containing only status, note, and time. The service-role-only queue remains bounded, uses `FOR UPDATE SKIP LOCKED`, and never projects proof paths, actor identities, or coordinates.
- `047`: adds one service-role-only atomic request-window counter using HMAC-digested keys, bounded limits/windows, fixed retry intervals, RLS default denial, and bounded expired-row cleanup for the managed operations worker.
- `048`: adds a private, server-only upload-quarantine bucket with no browser policy. The storage adapter releases an object to its purpose bucket only after signature validation and an explicit clean scanner verdict, then removes quarantine on success or failure.
- `049`: adds service-role-only transporter-profile workspace, bounded transactional page update, and profile-image metadata commands. Each function repeats active actor, workspace, owner, structured place, and Company-driver denial rules and writes contact-safe audit details.
- `050`: moves the authenticated workspace dashboard and Fleet management to service-role-only bounded RPCs. Fleet-owner reads exclude account email and proof paths; Driver assignment plus Capacity/Tracking permissions update atomically under repeated organization/subscription/asset checks and write contact-safe audit metadata.
- `051`: adds actor-scoped Verification and Billing centers, submissions, private-file authorization, bounded Trust/Billing review queues, terminal decisions, subscription renewal, and contact-safe audit events. Only service-role adapters can execute the functions; public projections receive file-presence booleans rather than Storage references.
- `052`–`053`: explicitly compile the two Verification mutation functions with unambiguous PL/pgSQL variable scope after live execution exposed identifier collisions; no data migration is performed.
- `054`: adds service-role-only member Support, Assisted matching, private-attachment authorization, bounded queues/history, atomic least-loaded assignment, terminal lifecycle, and platform-team management commands. Projections exclude contact digests, recovery codes, Storage paths, and delivery internals.
- `055`: safely promotes only an exact inactive, unowned managed-Auth placeholder into a passwordless SUPPORT identity; active or already-owned identities remain rejected.
- `056`: extends the shared platform-team permission helper to Customer, Operations, Trust, Billing, and Support responsibilities while retaining administrator authority.
- `057`: adds service-role-only bounded Operations counts/pages, reversible audited platform commands, administrator Featured roster reads/saves, and Sponsor save/disable commands. PostgreSQL repeats responsibility, eligibility, date, overlap, and state checks and commits each mutation with its audit row atomically.
- `058`: prevents leasing an expired, used, superseded, or attempt-locked Shared capacity OTP email, rechecks deliverability immediately before provider submission, and adds service-role-only bounded 24-hour cleanup for terminal Shared capacity challenges and delivery rows without affecting Assisted matching recovery mail.
- `059`: adds exact-target claims, one-row just-in-time global leasing, a live-lease fence for both Shared capacity and Assisted matching, a 30-second final Shared-code validity margin, short challenge-aware retry timing, Shared-first queue priority, and bounded terminal Assisted matching email-metadata cleanup. The two-minute recovery schedule dispatches authenticated background work instead of performing provider I/O inside the scheduled-function limit.
- `060`–`061`: prevents provider signup from repurposing active, suspended, platform-reserved, or already-owned identities and removes browser authority to mutate identity-role records.
- `062`: adds provider-managed Tracking recipients and application-owned email OTP access with service-role-only commands and default-deny browser access.
- `063`–`064`: keeps Empty and Partial capacity current until an explicit Off Duty update and aligns persisted programme language with Open capacity.
- `065`: safely reconciles eligible confirmed Auth identities created before the managed profile bootstrap without touching platform or already-associated identities.
- `066`–`068`: adds owner-scoped vehicle registration, secret-free administrator record details and overview counts, and the current vehicle catalogue after retiring courier cars and motorcycles.
- `069`: changes Daily Featured to an exact truck-and-Driver morning roster, while preserving provider ownership and sponsor-break attribution.
- `070`–`071`: adds bounded Driver portrait presets and interchangeable tractor-trailer configuration while retaining one truck identity and history.
- `072`: installs the minimum Business, Fleet transporter, and Independent Driver plan catalogue independently of optional demo data; an existing or deliberately disabled plan is never overwritten.

On 2026-09-04, a newly empty isolated local database replayed the complete
`001`–`069` chain, rebuilt the managed fixture, and passed every guarded live
verifier. The final verifiers proved invalid Shared challenges are not leased,
exact-target/global claim exclusion, one-row and Shared-first claims, both-kind
lease fencing, the near-expiry denial margin, lease-owned attempt recording,
short retry timing, concurrent OTP supersession, bounded Shared and terminal
Assisted matching cleanup, provider vehicle registration, Tracking recipients,
Daily Featured truck selection, administrator detail access, and browser-role
RPC denial.

On 2026-09-04, a credential-free logical snapshot verified that the linked
hosted Loadgistic project had no application tables. The reviewed `001`–`069`
chain was then applied in numeric order. On 2026-09-05, an encrypted logical
backup was created and verified before additive migrations `070`–`072` were
applied; local and remote migration histories then matched through `072`. The
three required active plan rows are present, the seven required private Storage
buckets remain present, and anonymous bucket discovery returns no records. No
local fixture identities or demo market records have been imported into
Production.

The local configurator reads the isolated CLI stack without printing keys,
writes only the ignored mode-`0600` `.env.local`, imports the fake market, and
runs managed verification. It fails closed for any non-loopback API URL:

```bash
SUPABASE_CLI_PATH=/absolute/path/to/supabase npm run supabase:local:configure
```

Keys come from the isolated local Supabase CLI stack and must remain outside shell history, logs, and source control. The lower-level `db:supabase:fixtures` and `db:supabase:verify` commands remain available for CI orchestration with injected local-only variables. The importer reads `resources/fixtures/managed-market.json`, refuses non-loopback and Production targets, and contains no remote import path.

The managed fixture contains no demand rows. Any hosted legacy-demand purge remains intentionally separate and destructive: execute it only after a verified backup, exact row-count review, and explicit rollout approval.

## Managed runtime contracts

Managed identity has no runtime selector or SQLite fallback: login and logout use the SSR route-cookie adapter, every request validates `auth.getUser()`, and the identity RPC maps only the matching active account. The explicitly local fixture-password form authenticates the same isolated Supabase Auth fixture identities. Google PKCE and numeric email-code sign-in are implemented. Public provider signup first proves Google or six-digit email-code identity through a signed 15-minute HttpOnly handoff, then collects the short provider profile and uses the server-only provisioning intent to complete one fleet or independent-provider workspace, draft public page, approved signup record, and seven-day trial atomically. An incomplete or abandoned identity remains inactive and has no Loadgistic authority. Local Supabase defines separate numeric templates for existing-user magic-link login and new-user confirmation. A port-`3001` runtime probe verified generic login/signup requests each create one Mailpit message without exposing its body or code; the temporary signup identity was deleted. Local Google login/signup also reached the configured Web client through PKCE with minimum scopes and corrected host-preserving application callbacks. Hosted Production has the exact callback, Google provider, equivalent numeric templates, Gmail SMTP, and one successfully verified real account OTP. Preview must mirror that configuration, and hosted Google plus complete signup still require end-to-end proof after the hosted schema and application are deployed.

Health and place search use PostgreSQL unconditionally. `/api/health` counts the managed profile projection and fails closed with a non-secret `database-unavailable` blocker if PostgreSQL cannot be reached. `/api/places` uses a bounded server-only Supabase query and returns the public place contract.

The public Truck Market uses a dedicated managed application port. Its service-role RPC returns only 12–16 rows plus one cursor look-ahead, evaluates every multi-city route segment and complete Service-area polygon in PostgreSQL, keeps text search literal, enriches only the bounded result set, and excludes every Private-network truck before returning a row. The server then produces the established safe badge, approximate-distance, regular-service, and geographic-match labels only for Public Market records. Clean reset plus live fixture verification covers cursor uniqueness, status and route filters, complete Private-network exclusion, badge shape, and anonymous RPC denial.

Published transporter microsites use a second application port with explicit Supabase selections for the public page, active fleet, assigned Driver first name and callback, separate Driver/truck evidence badges, current safe Capacity projection, independently visible contacts, fixture portrait, and the latest 20 published review notes. PostgreSQL calculates the all-review count and average through a service-role-only aggregate. Hidden contacts, exact coordinates, private proof paths, surnames, and unknown or unpublished handles remain excluded.

Daily Featured Transporters uses its own application port and the pure two-session scheduler. PostgreSQL returns only candidates from the date-derived regional group and rechecks every eligibility input at read time. The server joins the administrator-ordered published roster and at most five active Sponsor placements, strips owner IDs and eligibility internals, maps manual schedule keys to public handles, and safely projects either eligible transporters or bounded outside advertisements. Anonymous and ordinary authenticated clients cannot execute the candidate RPC.

Shared capacity, provider Capacity, and provider-owned Tracking use dedicated Supabase-only application ports. Service-role-only commands repeat ownership, assignment, subscription, permission, guest-grant, transition, and review rules in PostgreSQL. Delivery workers lease rows with `FOR UPDATE SKIP LOCKED`, and successful delivery is terminal. The source-verified Netlify design uses a 15-minute managed dispatcher and a two-minute access-email recovery dispatcher, both invoking HMAC-authenticated bounded background work that rejects unsigned or stale calls and exposes no private operation result. The managed application-email port prefers direct Resend delivery with stable idempotency keys, accepts a bounded authenticated-SMTP pilot with stable Message-IDs and an at-least-once warning, and retains an HTTPS webhook adapter for private integrations. Supabase Auth email remains a separate adapter. Clean local verification exercises all three slices with SQLite unavailable and proves browser-role denial. The Production application-SMTP variables are configured and an authentication-only handshake passes, but the workers are not deployed and no remote application-email delivery is proved.

Transporter-profile editing now selects a dedicated application port. Its PostgreSQL workspace and mutation functions deny Company drivers and browser roles, repeat current subscription/ownership rules, resolve the general base from the managed place catalog, bound public content and contacts, and audit only visibility flags and non-sensitive place/region identifiers. Profile images use the central quarantine/scanner/storage port before an atomic metadata command; failed metadata removes the new object and successful replacement removes the superseded object after commit.

Keep these active contracts stable during hosted rollout:

- Public capacity cursor/detail and public provider projections.
- Platform Operations and Sponsor/Featured administration commands.
- Retired-demand route behavior and managed-contract tests.

Use RLS-protected queries or transactional RPCs. Never place a service-role key in browser code, never return raw private-table rows to anonymous clients, and keep access-code verification on the server.

## Rollout sequence

1. Back up the target database and prove restore into an isolated environment.
2. Apply `001` through `069` to an empty/staging project and run Supabase SQL lint plus schema/RLS review.
   Migration `030` enforces callback phone on new Assisted matching rows with a
   `NOT VALID` compatibility constraint; remediate any retained pre-`030` null
   phone rows before validating that constraint in a later reviewed migration.
3. Import the bundled place catalog with `npm run places:import:supabase`.
4. Use the guarded deterministic local-Supabase Auth/PostgreSQL/Storage fixture, then run domain, authorization, RLS, cursor, guest-tracking, retention, scale, and E2E suites against the isolated stack.
5. Configure the server-only managed scanner, verify clean/dirty/timeout/quota behavior against Preview, complete the privacy/vendor review, separately configure and prove the application-email sender, deploy and monitor the signed scheduled/background worker, configure authorized Supabase Realtime with polling fallback, and complete Preview concurrency verification for shared rate limiting. Hosted Supabase Auth SMTP and one account OTP are already verified; that does not prove Shared capacity or Tracking application mail. The local EICAR-aware scanner is test-only and cannot satisfy Production readiness.
6. Inventory any legacy cloud demand rows. After explicit approval, purge only the reviewed target rows and record counts/audit evidence.
7. Deploy the managed backend to Preview, run `npm run launch:check`, and rehearse application and data rollback before Production promotion.

## Rollback

Roll back the application artifact first. Schema/data rollback requires the reviewed backup because the approved demand purge is destructive. Never reverse the product by deleting newly created provider shipments, party grants, email attempts, reviews, or audit evidence.
