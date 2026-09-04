# Build Verification

Evidence is recorded through 2026-09-03 with Node.js v22.16.0. Each dated
checkpoint is scoped to the code and environment verified at that time.

## Demo market geography correction — 2026-09-04

- The credential-free 143-truck fixture now distributes approximate locations
  through weighted Ethiopian freight markets and 64 real named cities, towns,
  or localities. No exact locality contains more than five source trucks, each
  large demo fleet spans at least ten operating locations, and the former
  repeated latitude-plus/longitude-minus diagonal offset is absent.
- After the managed visibility policy, 33 trucks are Public Market supply
  across 24 exact named locations with no more than three public trucks at one
  locality; the remaining 110 exercise Private capacity. Current routes and
  Service areas remain close to the declared approximate truck location.
- Twenty-seven clustering, capacity-market, and fixture tests passed together.
  Specification validation and TypeScript passed, and the focused map workflow
  passed in desktop and mobile Chromium. A follow-up city-level correction made
  clustering cells at least as wide as full markers, replaced the maximum-zoom
  overlapping marker ring with a bounded truck chooser, and distributed private
  fallback markers along their public regular-service geometry. A port-3001
  phone probe reached an individual truck with zero remaining marker overlaps.
- The isolated local Supabase fixture was rebuilt with 3,692 place rows and the
  expected 143 Capacity signals. Fixture, Shared capacity, provider Capacity,
  provider Tracking, and provider-signup live verifiers passed; the aggregate
  verifier later stopped on pre-existing rate-limit cleanup residue unrelated
  to fixture geography.
- Focused screenshots are under `artifacts/demo-geography-v1/`. Expensive
  full-suite, build, release, and remote gates remain pending visual approval.

## Administration and truck-registration checkpoint — 2026-09-03

- Additive local migrations `066_provider_vehicle_registration_and_admin_details.sql`
  and `067_admin_overview_counts.sql` applied to the isolated Supabase stack.
- The Fleet verifier created one fleet-owned and one independent-provider truck,
  proved immutable owner scope and no inferred Capacity/location/assignment
  state, denied a Company driver and anonymous browser roles, and removed its
  test records. The platform verifier opened all eight bounded record-detail
  projections, including a Tracking event timeline, and denied anonymous access.
- Eighteen focused contract tests, TypeScript, specification validation, and
  source validation passed. Desktop and phone browser workflows passed for
  provider-owner truck registration, the compact Administration Overview, and
  every Users/clients/trucks/Drivers/Tracking/Capacity/routes/plans detail route.
- Focused screenshots are under `artifacts/admin-management-v1/`. Expensive
  full-suite, optimized build, release, and remote migration gates remain
  pending explicit visual approval.

## Private capacity eligibility correction — 2026-09-03

- `node --test tests/private-capacity-network.test.mjs`: five tests passed,
  including the response contract that advances to code verification only for
  a queued eligible challenge.
- `npm run typecheck` and `npm run check:specs`: passed.
- The focused Private capacity workflow passed on desktop Chromium and mobile
  Chromium. An unshared email remained on the email step, showed the bounded
  no-share result, rendered no one-time-code field, and then an actively shared
  email completed the Mailpit OTP flow and opened the private map.
- Focused no-share and active-session screenshots are under
  `artifacts/private-capacity-assisted-chat-v1/`. Full release gates remain
  visual-approval gated.

## Account-access reconciliation — 2026-09-03

- Recent local Supabase Auth evidence showed that Google PKCE and email OTP
  succeeded upstream while exactly two confirmed pre-trigger test identities
  were rejected by Loadgistic because they lacked a profile projection.
- Guarded migration `065_reconcile_prebootstrap_auth_profiles.sql` applied to
  isolated local Supabase and repaired exactly those two role-free,
  association-free identities as inactive DRIVER bootstraps. Both now pass the
  provider-signup eligibility boundary.
- A sanitized browser probe completed the email-code flow for one repaired
  account through local Mailpit and reached `/apply?step=details`; neither the
  address nor code was printed.
- Google initiation reached Google's standard identifier page, and the recent
  provider log showed successful Google authorization and PKCE exchange. A
  human account-selection pass remains required to prove the repaired browser
  callback end to end.
- The focused 23-test identity, signup, rate-limit, and Private capacity set,
  TypeScript, and specification validation passed. Automated browser requests
  now use a distinct local client bucket so test runs do not exhaust a
  developer's manual OTP allowance.

## Verification lessons that must not regress

- A successful server-side OAuth redirect chain does not prove the browser
  button works. The visible control must be clicked in a real browser because
  CSP, cookie, navigation, and popup policies are browser-enforced.
- Supabase Auth email and application-owned Shared-capacity/Tracking email are
  separate delivery paths. Each path must prove delivery at its intended inbox;
  configuration or SMTP authentication alone is not delivery evidence.
- Shared-capacity OTP verification requires an active provider grant for the
  tested email. Browser evidence must create or identify that precondition and
  verify the code, not merely assert that the request endpoint responded.
- Mailbox APIs contain contact data and live access codes. Diagnostics may emit
  only sanitized counts, status, and pass/fail results—never raw messages,
  recipients, links, codes, cookies, or provider credentials.

## Release evidence

- Supabase cutover checkpoint (2026-08-24): a clean isolated local reset replayed migrations `001`–`036`; the guarded local fixture import created 154 Auth users, 143 trucks/Capacity signals, 335 verification records, and 3,703 place rows; `npm run db:supabase:verify` proved password login, private Storage, expected counts, and anonymous-write denial; and `tests/supabase-fixtures.test.mjs` proved remote-import refusal, explicit reset confirmation, area-route integrity, and least-privilege migration text. Supabase SQL lint completed; its reported findings are extension-owned PostGIS diagnostics rather than Loadgistic application functions. The application runtime cutover is still pending.
- Managed identity checkpoint (2026-08-24): migration `037` applied locally; fixture verification proved the `auth.uid()`-bound company-Driver role/subscription projection; TypeScript passed; and a real Next.js request check proved `303` login, an HTTP-only Supabase session cookie, authenticated `/login` redirection, and `303` logout. Normal application traffic remains on the cutover adapter until PostgreSQL repository parity passes.
- Managed read/readiness checkpoint (2026-08-24): managed login and role-access evaluation no longer load the SQLite repository; `/api/health` returned `200` with `supabase-postgres` and 154 profiles; `/api/places?q=Addis%20Ababa` returned the bounded public place projection; and the deterministic fixture verifier exercised the same Supabase place adapter. Focused tests prove production service-role configuration is fail-closed and exact place matches cannot be displaced by population. Truck Market and mutation parity remain pending.
- Managed Truck Market checkpoint (2026-08-24): a clean local reset replayed migrations `001`–`038`, the deterministic fixture importer rebuilt all Auth/PostgreSQL/Storage records, and the live verifier passed bounded cursor, duplicate prevention, status/route matching, safe Driver/truck badge shape, private-current geometry removal, and anonymous RPC denial. A real Next.js Supabase runtime returned `200` for `/`, returned two distinct 14-row Partial pages, and emitted no SQLite runtime warning. A rolled-back 5,000-truck PostgreSQL transaction returned a 15-row look-ahead page in 375.574 ms and a Service-area-filtered page in 653.943 ms; all synthetic scale rows were absent after rollback. These are local single-query measurements, not Preview concurrency evidence.
- Managed transporter-microsite checkpoint (2026-08-24): migration `039` applied locally; the fixture verifier passed fleet and independent-provider public projections, current Driver/document completeness, unknown-handle denial, and anonymous review-aggregate RPC denial. A real managed Next.js runtime returned `200` for `/providers/blueline-transport` and `/providers/abebe-owner-operator`, `404` for an unknown handle, and the expected optional-image `404` for a fixture using its public preset portrait. The rendered pages contained current fleet, Driver kind, Driver/truck document, and capacity-map controls without a SQLite runtime warning. TypeScript passed.
- Managed Daily Featured checkpoint (2026-08-24): a clean local reset replayed migrations `001`–`040`; fixture verification proved a published regional roster, one walkthrough per projected provider, safe public keys, and anonymous candidate-RPC denial. The managed adapter returned the three-provider Addis Ababa roster, four ordered Sponsors including one outside advertiser, and five schedule entries. A real Next.js runtime returned `200` for `/featured` and rendered the roster, Sponsors label, Sponsored disclosure, and advertiser without a SQLite runtime warning.
- Managed provider-runtime checkpoint (2026-08-24): a fresh local database replayed migrations `001`–`044`; the guarded configurator rebuilt 154 Auth identities, 143 trucks/Capacity signals, 335 verification records, and 3,703 places. With SQLite disabled, dedicated verifiers passed Shared-capacity grant/OTP/leased-delivery/private-map/Operations/revocation, provider Capacity workspace/publication/location/duty/regular-service authorization, and provider Tracking create/cross-provider denial/location/review/leased-email/30-day cleanup. The clean run exposed and fixed a generated-column fixture-restore error and an ambiguous cleanup identifier before remote migration.
- Managed provider-signup checkpoint (2026-08-24): a second clean database replayed migrations `001`–`045`; the complete local configurator rebuilt the same fixture and passed all prior verifiers plus inactive Auth-profile bootstrap, 15-minute server-only intent, atomic Owner-operator workspace/draft-page/approved-application/seven-day-trial creation, duplicate denial, and anonymous RPC denial. The public route collects no password and hands only an opaque HttpOnly token to the fixed Google callback. Four focused desktop/mobile browser checks passed for the signed-out signup handoff and signed-in provider navigation.
- Managed email/operations checkpoint (2026-08-26): a clean isolated database replayed migrations `001`–`046`; the date-safe importer rebuilt 154 Auth identities, 143 current truck signals, 335 verification records, and 3,703 places; all five managed verifiers passed. Migration `046` leased only customer-safe completion timeline fields. Focused tests passed direct Resend and HTTPS-webhook adapters, stable idempotency, escaped templates, secret exclusion, bounded scheduled counts, safe error redaction, service-role-only queue access, and the 15-minute UTC schedule. No remote sender or live delivery is claimed.
- Managed signup identity checkpoint (2026-08-27): transporter signup now uses the same Google or six-digit email-code choices as managed login, but proves identity before collecting provider details and binds an email handoff to the same authenticated email. A new Supabase identity remains inactive until atomic provider provisioning succeeds. TypeScript, specification validation, the focused auth/signup/fixture tests, the optimized build, and the focused desktop/mobile signup browser workflow passed. The isolated local Supabase runtime delivered a numeric signup message to its local-only Mailpit sink and passed OTP verification, inactive bootstrap, atomic workspace/draft-page/approved-application/seven-day-trial creation, duplicate denial, and browser-role RPC denial. No hosted or Gmail delivery is claimed. Production password login remains disabled; fixture passwords require an explicit non-Production flag.
- Local workspace isolation checkpoint (2026-08-27): Loadgistic now reserves `http://127.0.0.1:3100` across its development command, ignored environment configurator, local Supabase Auth allowlist, Playwright, UI audit, stress audit, and capture defaults, while leaving the separate MirtPage service on port `3000` untouched. The local Supabase stack restarted with the corrected configuration, the deterministic fixture refreshed today’s six-provider Tigray/Afar roster, the Featured page returned six portrait tiles with no empty placeholder, desktop/mobile focused captures passed, and the local numeric signup verifier passed again after restart.
- Shared rate-limit checkpoint (2026-08-27): additive migration `047` applied to the isolated Loadgistic stack. Twelve concurrent adapter calls against one three-request window allowed exactly three, returned bounded retry times for the remainder, stored only one HMAC digest, denied anonymous table/RPC access, and removed the expired row through bounded scheduled cleanup. Focused Node tests and TypeScript passed. Preview concurrency and public-discovery/review coverage remain rollout work.
- Private-upload security checkpoint (2026-08-27): additive migration `048` applied to the isolated Loadgistic stack and created a server-only private quarantine bucket. The live verifier released a signature-valid clean PNG to its purpose bucket, read it through the storage adapter, rejected an EICAR-marked PDF before release, emptied quarantine after both paths, and proved anonymous list/download denial with a service-role sentinel. Focused tests prove neutral upstream filenames, strict Cloudmersive advanced-scan flags, explicit-clean-only acceptance, fail-closed timeout/quota/malformed responses, local-test/Production separation, and secret exclusion. No hosted scanner call or remote upload is claimed.
- Managed transporter-profile checkpoint (2026-08-27): additive migration `049` applied to the isolated Loadgistic stack. The live verifier read an owner-scoped editor projection, saved the existing structured base and public-contact choices transactionally, uploaded a quarantined/scanned profile image, projected only its application URL, removed the image and released object, denied a Company driver, denied the anonymous RPC, and confirmed audit details contained no contact values. Focused tests prove the active routes import the managed application port rather than SQLite and the functions are bounded, audited, and service-role-only.
- Managed workspace/Fleet checkpoint (2026-08-27): additive migration `050` applied to the isolated Loadgistic stack. The live verifier read bounded owner-scoped Driver/assignment/permission summaries, atomically reapplied a Driver's current truck assignment and Capacity/Tracking permissions, read the bounded workspace dashboard, denied a Company driver and the anonymous role, and confirmed the audit event contained no Driver contact. Focused tests and TypeScript passed with SQLite disabled. Hosted migration and concurrency evidence are not yet claimed.
- Managed Verification/Billing checkpoint (2026-08-28): additive migrations `051`–`053` applied to the isolated Loadgistic stack. The live verifier submitted and reviewed actor-scoped Verification and payment-proof records, authorized private files only through server-side commands, hid Storage paths from review projections, enforced terminal audited decisions, denied anonymous RPC access, and confirmed a successful payment renews the provider for 30 days. Focused regression tests, the complete quality gate, and the optimized 74-route build passed. Hosted migration and remote private-Storage evidence are not yet claimed.
- Managed Support/Assisted-matching checkpoint (2026-08-28): additive migrations `054`–`056` applied to the isolated Loadgistic stack. The live verifier proved member and account-free conversation creation, atomic least-loaded assignment across both queues, assigned-agent and administrator scope, bounded history/inbox projections, private attachment reauthorization, terminal closure, passwordless Support-agent provisioning, complete platform-team permission scope, and anonymous RPC denial. Five focused runtime tests and the desktop/mobile Assisted-matching browser workflow passed. The complete quality gate and optimized 74-route build also passed; hosted Realtime and remote private-Storage evidence are not yet claimed.
- Managed-only identity and retired-Directory checkpoint (2026-08-29): Supabase Auth is now the sole identity runtime for local development, browser tests, Preview, and Production. The explicitly local fixture-password form authenticated an isolated Supabase Auth Driver in a focused browser workflow; no signed-cookie or SQLite identity fallback remains. Live local requests proved `/app/providers` and `/companies` collection links preserve name searches into the Truck Market, their detail links preserve the exact public microsite handle, and the retired member-directory search API returns `410 Gone`. Three focused boundary tests, the complete quality gate, and the optimized 74-route build passed.
- Managed platform-administration checkpoint (2026-08-29): additive migration `057` applied to the isolated Loadgistic stack. The live verifier exercised bounded counts and paginated projections across all eight Operations inventories, denied an ordinary member and the anonymous browser role, proved delegated Customer-only scope, and reversibly exercised account/truck activation, Driver permissions, route removal, subscription paid/expiry/sponsorship, Featured roster publication, Sponsor overlap denial, and Sponsor disable. Every command committed its audit atomically, and active Operations/Featured/Sponsor routes no longer import the SQLite repository.
- Unconditional managed-runtime checkpoint (2026-08-29): active application facades, health, request limiting, private uploads, the scheduled worker, the browser-test server, and the standalone container now use Supabase without data or Storage backend selectors. Missing PostgreSQL, private Storage, or shared-counter configuration fails closed; local files, process-local counters, and SQLite health fallback cannot be selected. A clean guarded fixture refresh rebuilt 154 Auth identities, 143 current truck signals, 335 verification records, and 3,703 places, then every managed verifier passed. The complete quality gate passed 164 Node tests, the optimized 74-route build completed without a SQLite runtime warning, and 16 critical desktop/mobile browser checks passed across the public Market, location, provider profile, Tracking, and Driver Capacity workflows. The dormant monolithic repository/database and SQLite-derived fixture transformation remain the next isolated removal.
- PostgreSQL-only development checkpoint (2026-08-29): the retired local database/repository, transformation, reset, place-import, stress, Tracking-fixture, and duplicate integration-test paths were removed. `resources/fixtures/managed-market.json` now supplies credential-free, demand-free, machine-path-free records directly to isolated Supabase Auth/PostgreSQL/Storage. A newly empty local Docker volume replayed migrations `001`–`057`; the guarded importer rebuilt 154 Auth identities, 143 current truck signals, 122 Drivers/assignments, 335 verification records, 3,703 places, and the current Ethiopia Featured/Sponsor programme. Every managed live verifier passed. The current quality gate passed 126 focused domain/managed-contract tests, the optimized standalone build passed, and all 16 critical desktop/mobile browser workflows passed on isolated port `3110` while the developer server remained untouched.
- Guest-access and Tracking-security checkpoint (2026-09-01): a newly empty
  isolated Supabase database replayed migrations `001`–`058` in order, rebuilt
  the managed fixture, and passed every guarded live verifier. Migration `058`
  excluded expired, used, superseded, and attempt-locked Shared capacity
  challenges from delivery, rechecked them immediately before submission,
  removed terminal challenge/delivery rows after the bounded retention window,
  preserved Assisted matching recovery mail, and denied browser roles. Focused
  checks also proved the six-digit, ten-minute, single-use Shared capacity
  application OTP and the stable 80-bit Tracking owner/review codes derived from
  a distinct `TRACKING_CODE_SECRET`; changing `SESSION_SECRET` does not change
  those Tracking codes.
- Application-email and managed-worker checkpoint (2026-09-01): tests proved
  escaped Shared capacity and Tracking templates, preferred Resend delivery,
  bounded authenticated SMTP with stable non-secret Message-IDs, the optional
  HTTPS webhook, and fail-closed incomplete configuration. The 15-minute
  Netlify dispatcher signs a timestamp-bounded HMAC request to a background
  worker; unsigned and stale calls are rejected with a timing-safe comparison,
  authorized work returns no private result body, and the worker runs the
  bounded email and retention operations once. This is local source/test
  evidence, not a deployed-worker or remote application-email claim.
- Hosted-auth control-plane checkpoint (2026-09-01): the hosted Supabase Auth
  Site URL/callback, separate Google client, numeric login/signup templates, and
  Gmail SMTP are configured, and one real account Auth OTP was received and
  verified. The Netlify application still returns `404`, the hosted application
  database remains empty, and Netlify has no configured application-email SMTP;
  therefore no deployed application, Google/signup workflow, Shared capacity
  OTP, Tracking email, or Assisted matching email is claimed.
- Targeted access-email hardening checkpoint (2026-09-01): additive migration
  `059` was applied to the isolated local stack and the Shared capacity live
  verifier passed. Focused tests prove one-row just-in-time claims, Shared-first
  priority, live-lease fencing for Shared capacity and Assisted matching, a
  30-second final OTP validity margin, truthful handling when provider success
  cannot be acknowledged, and authenticated background dispatch for the
  two-minute retry. A subsequent newly empty local reset replayed migrations
  `001`–`059` in order, rebuilt the managed fixture, and passed every guarded
  live verifier. This is not a remote application-email delivery claim.
- Local Auth runtime checkpoint (2026-09-02): a live application on port `3001`
  returned `200` for health, login, and signup entry points. One existing-login
  and one temporary-signup numeric-code request each returned a generic `303`,
  `Cache-Control: no-store`, and increased the isolated Mailpit count by exactly
  one without reading or exposing a recipient, message, or code. The temporary
  Auth identity was deleted. Login and signup Google routes used PKCE, loaded
  the configured local Web client, requested only `openid email profile`, and
  generated the expected local Supabase and same-origin application callbacks
  after the host-preservation correction. A focused follow-up bound Login or
  Signup to a signed, HTTP-only PKCE-flow intent, removed the flow selector from
  the callback URL so the exact hosted allowlist remains valid, proved stale
  Signup state is cleared when Login starts, and rejected a mismatched callback
  with generic output while clearing both handoffs. The sanitized authorization
  chain reached Google with no redirect, client, access-block, or deleted-client
  error signal; completing consent with a real account remains a manual check.
- Netlify configuration checkpoint (2026-09-02): the reviewed application,
  Supabase, session/Tracking, fixture-disable, and application-SMTP variables
  are present in the Production context. Sensitive values are marked secret;
  the Netlify Free scope boundary necessarily includes Builds, Functions, and
  Runtime for those secrets, while harmless values use all scopes. A bounded
  authenticated-SMTP handshake passed without sending a message. The site still
  returns `404`, the hosted database remains empty, and neither application
  execution nor remote application-email delivery is claimed.
- Visible external-flow correction (2026-09-02): clicking Continue with Google
  in Chromium exposed a CSP failure that a server-only redirect check had
  missed. The corrected policy permits only the validated Supabase origin and
  fixed Google account origin, fails closed for insecure configuration, and a
  fresh visible click reached Google's account screen with no failed browser
  navigation. The standard local configurator now supplies a development-only
  loopback Mailpit adapter for application-owned email. A real Shared-capacity
  UI request created no Auth account, arrived in Mailpit, and its six-digit code
  opened the private map. A separate account-code UI request also arrived in
  Mailpit. The focused 38-test auth/header/email/private-capacity set,
  TypeScript, specification validation, and diff checks passed. Selecting a
  personal Google account and completing consent remains an owner interaction.

- The consolidated post-configuration specification/source, unit, type, and
  production-build gates are being rerun. Their new aggregate counts belong in
  this record only after that run completes; dated evidence above remains
  historical evidence rather than a current-count claim.
- `docker build --tag loadgistic:local-supabase-only .`: passed. The pinned
  Node 22.16.0 multi-stage image rebuilt all 74 routes and copied only the
  standalone runtime, public assets, and static chunks into the non-root runner.
- `npm run test:e2e`: 50 workflows passed and two explicitly opt-in screenshot captures were skipped across desktop Chromium and mobile Chromium. Coverage includes Map-first public discovery, automatic visitor location, regional centering, denial/retry behavior, live accessible suggestions, route and Service-area matching, stable close-zoom cluster separation, responsive non-scrolling selected cards, bounded List pages, provider pages, dynamic featured schedules, current Driver permissions, provider-owned Tracking, the unified capacity summary, retired demand routes, and credential-safe login.
- `npm run test:a11y`: 12 desktop/mobile accessibility workflows passed. Serious and critical WCAG 2 A/AA, 2.1 AA, and 2.2 AA findings are scanned across public, transporter, Driver, administrator, and support routes; keyboard dialog operation, Escape dismissal, opener-focus restoration, and 320-pixel reflow are asserted. Leaflet's spatial marker pane is excluded only from the target-size rule because markers are already large, can straddle the active viewport, and have an equivalent Truck List; every other rule continues to inspect the map.
- `npm run test:ui-stress`: 84 dense-data desktop/mobile screens passed with zero failures, including bounded Truck List pagination and current Admin Tracking inventory.
- `npm run test:ui-audit`: 86 desktop/mobile screens were captured across logged-out, fleet-owner, self-managed Driver, company Driver, administrator, and support-agent views with zero automated layout/accessibility flags and zero browser-flow errors. Every visible Leaflet map rendered real tiles before capture.
- `npm audit --audit-level=high`: zero known vulnerabilities.
- Automated map workflows and visual capture verified the visible map key, vehicle-image markers, close-zoom separation of overlapping trucks, selected-only approximate-location/current/two-way-regular-corridor layers, responsive detail card, responsive List cards, and restoration of the clustered market after close.

## Focused Market evidence — 2026-08-15

- `npm run check:specs`: passed with 26 specifications and 23 features.
- `npm run typecheck`: passed.
- `node --test tests/capacity-market.test.mjs`: 21 tests passed.
- Focused Playwright Market workflows: six desktop/mobile checks passed for independent route endpoints, map-only bounded loading, status-specific clustering, bounded cluster membership, and non-overlapping status labels.
- Focused desktop and phone captures are under `artifacts/focused-2026-08-15-market-final/`. The full release, accessibility, stress, and visual-audit gates have not been rerun for this uncommitted batch.

## PostgreSQL scale evidence — 2026-08-29

- `npm run test:scale` inserted 5,000 additional supply-only vehicles and
  current signals inside one isolated PostgreSQL transaction.
- The server-only public projection returned its bounded 15-row look-ahead page
  in 320.124 ms with a 41,295-byte payload. The PostGIS origin/destination route
  filter returned 15 rows in 590.971 ms.
- The transaction rolled back and the harness proved zero `LG-SCALE-*` vehicles
  remained. It refuses any local project ID except `loadgistic-local` and any
  scale below 5,000 or above 10,000.
- These are local single-transaction measurements, not Preview concurrency or
  sustained hosted-load evidence. The existing CPU-throttled mobile workflow
  continues to bound background cursor loading and rendered map records.

## Private capacity and Assisted matching evidence — 2026-08-15

- `npm run check:specs`: passed with 28 specifications and 25 features.
- `npm run check:source` and `npm run typecheck`: passed.
- `node --test tests/capacity-market.test.mjs tests/private-capacity-network.test.mjs`: 25 tests passed.
- `npm run build`: optimized production build passed with the Shared capacity,
  Network, private Operations map, guest Help/chat, team Assisted matching, and
  attachment routes.
- Four focused desktop/mobile browser workflows passed. They exercise a guest
  creating a conversation, immediate assignment to the bounded Support team,
  a team reply appearing in the guest thread through the two-second refresh,
  the account-free Shared capacity gate, and the provider Network page.
- Two capture workflows passed on desktop and mobile. Screenshots of Assisted
  matching entry, the compact live thread, and Network are under
  `artifacts/private-capacity-assisted-chat-v1/`. The expensive full-site audit
  remains approval-gated.

## Deterministic local market

- 30 published transport providers: nine fleets and 21 self-managed providers.
- 143 active current-capacity signals, with at least nine in every seeded regional market and a 70-percent local-delivery vehicle cohort using road-connected routes or compact Service areas within 30 kilometres.
- 30 regular-service signals: exactly one Service area or Capacity route for each published provider, with application and database rejection of a second.
- Future-trip and regular-area persistence tables: absent after migration.
- Distinct Driver-selected approximate-location radius levels represented: five.
- Legacy demand shipments remaining after the local migration: zero.

## Release boundary

The historical evidence above is retained for chronology; the current
application, local development, CI, fixtures, browser workflows, and scale gate
all use Supabase/PostgreSQL. The linked hosted project has the reviewed
`001`–`069` migration chain and seven private Storage buckets, with no local
fixture import. Unrestricted Production remains blocked on backup/restore
rehearsal, a successful Netlify deploy and live smoke, a remotely proven managed upload scanner, live application-email delivery,
remaining public-discovery abuse coverage, monitoring, Preview
smoke/concurrency evidence, and an approved Production promotion. Supabase Auth
OTP delivery is verified, but it does not satisfy the separate application-email
gate. See `docs/LAUNCH_READINESS.md` and `docs/SUPABASE_MIGRATION.md`.

## Release-candidate checkpoint — 2026-09-04

- A newly empty local Supabase stack replayed migrations `001`–`069`, rebuilt
  the managed fixture, and passed every guarded live verifier with SQLite absent.
- `npm run quality` passed 28 specifications, 25 features, 277 checked source
  files, 199 Node tests, and TypeScript.
- `npm run build` completed the optimized 77-page production build.
- `npm audit --audit-level=high` reported zero known vulnerabilities.
- The full Playwright run passed 86 workflows with eight intentional capture
  skips. Four initial navigation timeouts were isolated; the corrected
  DOM-content readiness assertion and the three unaffected workflows all passed
  on controlled rerun, while the equivalent phone workflows had already passed.
- `npm run test:ui-stress` checked 82 dense desktop/phone screens with zero
  failures. `npm run test:ui-audit` checked 88 screens with zero layout,
  accessibility, or browser-flow flags.
- A credential-free logical snapshot confirmed the linked hosted Loadgistic
  database had no application tables before migration. Migrations `001`–`069`
  were applied in order and the local/remote histories match. All seven expected
  Storage buckets are private and anonymous bucket discovery returned no rows.
  Production demo fixtures were deliberately not imported.
- No managed malware-scanner credential is configured. Production upload paths
  therefore remain fail-closed; local EICAR-aware evidence is not represented as
  hosted malware-scanning proof.
