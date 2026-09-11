# Build Verification

Evidence is recorded through 2026-09-12 with Node.js v22.16.0. Each dated
checkpoint is scoped to the code and environment verified at that time.

## GitHub Production promotion and infrastructure hardening — 2026-09-11/12

- Release commit `b3a17c2` upgraded Next.js to `15.5.25`, Nodemailer to `9.1.1`,
  and Sharp to `0.35.4`; `npm audit --audit-level=high` reported zero known
  vulnerabilities. `npm run quality` passed 28 specifications, 25 feature
  records, 281 source checks, 218 Node tests, and TypeScript. The optimized
  77-page build and focused desktop/mobile Tracking-navigation regression also
  passed locally.
- GitHub PR `#11` passed CI run `34643293438` for the exact release commit:
  clean Supabase replay and managed verification, the rolled-back 5,000-truck
  PostgreSQL fixture, optimized build, full desktop/mobile Playwright suite, and
  standalone container build. It merged to `main` as `787b5526`; post-merge CI
  run `34647400977` passed the same validation, browser, and container jobs.
- The existing Netlify site now uses GitHub continuous deployment through a
  read-only deploy key and push/PR webhook. `main` is the Production branch.
  Production deploy `6aa46d24c2d4c6876a354c13` published merge commit
  `787b5526` at `https://loadgistic-473.netlify.app`. Live health returned `200`
  on `supabase-postgres`; Open capacity returned data; Featured returned `200`;
  and independent Adama/Hawassa place searches returned the requested city
  first.
- A fresh encrypted logical backup and independent encrypted Storage-object
  export preceded the hosted changes. The Storage export restored into the
  isolated stack and matched its source object checksum. The database backup
  authenticated successfully but an actual isolated database restore remains a
  release gate.
- Hosted migrations `074`–`076` applied cleanly and local/remote histories match
  through `076`. All seven buckets remain private and enforce 4 MiB. Database
  SSL enforcement is enabled. Nineteen hot-path indexes reduced observed
  unindexed foreign keys from 93 to 74. Remote error-level SQL lint reports zero
  Loadgistic application-function findings; six remaining diagnostics are from
  installed PostGIS extension functions.
- Production health truthfully retains `upload-malware-scanner` as its only
  readiness blocker and keeps bounded-pilot warnings for SMTP delivery and the
  community OpenStreetMap tile service. Application uploads remain fail-closed
  until a hosted scanner is configured and proved.

## Production cache, roster, and infrastructure audit — 2026-09-08/09

- Commit `e880764` passed 215 Node tests, specification/source validation,
  TypeScript, the optimized 77-route build, and a zero-high-vulnerability npm
  audit. Netlify Production deploy `6aa06084e223ccf14c9bb72a` published that
  exact commit at `https://loadgistic-473.netlify.app`.
- Live place searches for Addis Ababa, Adama, Hawassa, Mekelle, and Bahir Dar
  returned independent matching suggestions. Open-capacity base and selected
  filter queries returned independent bounded results; query-sensitive place
  and capacity responses were private and non-storable rather than shared CDN
  hits. Anonymous admin/member access redirected to Login, private-file probes
  returned `404`, retired Directory search returned `410`, and the public
  response included CSP, HSTS, clickjacking, MIME, referrer, and permissions
  headers.
- A fresh AES-256-GCM logical backup was authenticated before the current-day
  Featured repair. Its encrypted artifact is 1,252,753 bytes with SHA-256
  `be2772cbc7ab0e43723d8a7b87716d1daf8d513e3daaf1dcbc620e85d7e290b8`;
  neither artifact nor key is tracked. The exact-project-guarded transaction
  published eight eligible truck/Driver slots for the current Ethiopia day.
  Live desktop and phone Chromium then rendered all eight cards, portrait
  slots, and public map signals without broken images, browser errors, or
  horizontal overflow.
- The linked Supabase project matches the isolated stack through migration
  `073`. A read-only Production audit confirmed PostgreSQL 17, seven private
  Storage buckets, custom Auth SMTP, six-digit ten-minute OTPs, refresh-token
  rotation, Google enabled, and no anonymous Auth. It also found SSL enforcement
  disabled, direct-database allow-all IPv4/IPv6 network ranges, CAPTCHA disabled,
  one Security Advisor error plus warnings, and 252 Performance Advisor items
  dominated by unindexed foreign keys and RLS-policy planning/duplication.
- Both Netlify scheduled dispatchers and both background workers are deployed
  and invoked. A real pending application-email delivery is still unproved.
  The Netlify site remains manually deployed rather than Git-linked. Production
  health truthfully stays `readyForPublicProduction:false` because no managed
  malware scanner is configured; every upload fails closed. The application's
  10 MB file promise also exceeds Netlify's effective buffered binary request
  limit and must be lowered or redesigned before uploads are enabled.
- The database backup protects PostgreSQL/Auth/Storage metadata but not Storage
  object bytes. A separate encrypted object export and an isolated restore
  rehearsal remain required. Daily Featured also needs a deliberate next-day
  publishing operation; Production does not silently substitute an automatic
  roster. Assisted matching currently reports zero available team members.

## Production pilot import — 2026-09-05

- The operator explicitly approved an additive hosted import of 152 synthetic
  Transporter/Driver identities, 143 trucks with current Capacity signals, and
  eight current Daily Featured slots. The importer initially failed closed
  because Production had no active administrator. After separate operator
  confirmation, one existing confirmed, association-free operator identity was
  promoted to the sole active administrator; no synthetic administrator or
  Support identity was created.
- The exact-project-confirmed importer wrote 3,691 places, 152 profiles, nine
  fleet organizations, 21 independent provider profiles, 30 public provider
  pages, 143 trucks, 143 active Driver assignments and current Capacity
  records, 335 verification records, one published Featured day with eight
  truck/Driver slots, and four current Sponsor placements. Pilot identities use
  the deterministic `loadgistic-production-pilot-v1` namespace, reserved
  non-deliverable addresses, and random unrecoverable credentials.
- An independent service-role verifier found exactly 152 namespaced Auth
  identities: nine Transporters and 143 Drivers, with zero pilot Admin, Support,
  or unknown roles. It also confirmed 152 active pilot profiles, 143 trucks, 143
  Capacity records, one published Featured day, eight slots, and the private
  pilot Storage object. The live bounded Capacity endpoint returned 14 items and
  `/featured` rendered all eight cards, both with HTTP `200`.
- Headless Chromium verified the live Netlify desktop and 390-by-844 phone
  states. Both rendered map signals and all eight Featured cards with zero
  broken truck, marker, or portrait images. The pre-change encrypted backup and
  deterministic exact rollback remain available. Production health still
  truthfully reports the managed upload-malware-scanner as the remaining launch
  blocker.

## Hosted signup plan-catalogue correction — 2026-09-05

- A real hosted signup reached verified provider details but the atomic
  provisioning command rejected it. A sanitized read-only diagnostic proved the
  confirmed identity remained inactive, association-free, and retry-eligible;
  it also found zero active Business, Transporter, or Driver plans. No partial
  workspace, application, or provider profile was created.
- `072_required_plan_catalog.sql` installs the three minimum plans independently
  of optional demo fixtures and uses `ON CONFLICT DO NOTHING`, so replay neither
  duplicates a plan nor reactivates one deliberately disabled by an operator.
- Five focused signup contracts and TypeScript passed. A clean isolated local
  reset replayed migrations through `072`, rebuilt 154 profiles and 143 trucks,
  and passed every managed Auth/signup, capacity, Tracking, Storage,
  Verification/Billing, Support, Fleet, and administrator verifier. The complete
  spec/source, unit, TypeScript, and optimized 77-route build gate also passed.
- Before the hosted change, an encrypted AES-256-GCM logical backup of the
  linked public/Auth/Storage data was created, decrypted in memory for integrity,
  and checksummed without printing its contents or key. Hosted migrations
  `070`–`072` then applied in order. A second sanitized diagnostic found exactly
  one active Business, Transporter, and Driver plan and confirmed the failed
  identity is still clean and eligible to retry.
- Commits `28d51a3` and `d2f185c` were pushed to the production-readiness
  branch. Netlify manual Production deploy `6a9c4531a3128740b2261c13` completed
  with the maintained Next.js runtime. Live requests returned `200` for health,
  Login, and the new tractor asset; an unauthenticated `/apply` correctly
  returned `307` to Login. Health confirms Supabase PostgreSQL and Storage but
  still reports the managed Production upload-malware-scanner as a launch
  blocker. The separately guarded synthetic Production-pilot import remained
  gated at this checkpoint and was completed in the rollout recorded above.

### Deployment lesson

- A production schema can be structurally complete while a required domain
  catalogue is empty. Provider signup and release smoke checks must verify the
  active Transporter and Driver plan preconditions independently of demo-market
  import; optional fixture data must never be the only source of an operational
  signup dependency.

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
`001`–`076` migration chain, seven private 4 MiB Storage buckets, and the explicitly
approved synthetic Production pilot. The encrypted Storage export passed an
isolated restore; an actual database restore remains outstanding. Unrestricted
Production remains blocked on a remotely proven managed upload scanner, live application-email delivery,
remaining public-discovery abuse coverage, monitoring, Preview
smoke/concurrency evidence, and database-restore evidence. The reviewed
GitHub-to-Netlify Production promotion is complete. Supabase Auth
OTP delivery is verified, but it does not satisfy the separate application-email
gate. See `docs/LAUNCH_READINESS.md` and `docs/SUPABASE_MIGRATION.md`.

## Release-candidate checkpoint — 2026-09-07

- `npm run quality` passed 28 specifications, 25 feature records, 280 checked
  source files, 213 Node tests, and TypeScript.
- `npm run build` completed the optimized 77-page Next.js production build;
  `npm audit --audit-level=high` remained at zero known vulnerabilities.
- The complete desktop/phone Playwright run executed 86 workflows successfully
  and skipped eight opt-in capture workflows. It exposed two deterministic
  contract drifts in both viewports: the truck-registration assertion retained
  the superseded Cargo configuration label, and single-truck Driver Home hid
  the required selected-truck identity zone. The product defect and stale
  assertion were corrected; the four focused desktop/phone workflows then
  passed. No failing application workflow remains from that run.
- `npm run test:ui-stress` captured 82 dense desktop/phone screens with zero
  failures. `npm run test:ui-audit` captured 88 screens with zero automated
  layout/accessibility flags and zero browser-flow errors.
- `npm run test:scale` inserted 5,000 extra trucks and current signals inside
  one isolated PostgreSQL transaction. The general and multi-point route
  projections returned bounded 15-row pages in 394.764 ms and 872.611 ms,
  then the transaction rolled back with zero scale rows left.
- A fresh Production logical backup was encrypted with an independent key and
  verified by authenticated decryption before promotion. The encrypted artifact
  is 1,251,625 bytes with SHA-256
  `7322e32f60ac15420c94f7114dc7b11078e16b59d088170ee3b4685dfcd27084`;
  neither the artifact nor its key is tracked.
- The exact Netlify site `loadgistic-473` and all required Production runtime
  variable names/scopes were rechecked without printing values. Migration `073`
  and the application artifact are approved for the existing controlled pilot;
  the managed scanner, application-email delivery, monitoring, and Preview
  concurrency limits documented in `docs/LAUNCH_READINESS.md` still prevent an
  unrestricted-production claim.

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
- Production deploy `6a9b4353c786527571b25051` published application commit
  `935772c` to `https://loadgistic-473.netlify.app`. Open capacity, Daily
  Featured, Login, Private capacity, Tracking, and `/api/health` returned `200`.
  The health response identified `supabase-postgres` and `supabase`, with the
  managed scanner as its only blocker. Both Google controls reached the intended
  hosted Supabase authorize endpoint and then Google Accounts without consent.
  One account-code request returned the generic six-digit-code state; receipt was
  not asserted. A Private-capacity request with no eligible grant returned
  `verificationRequired:false`, proving it did not create an unnecessary OTP.
- Desktop and phone Chromium checks found no page errors or horizontal overflow.
  The initially collapsed no-roster Featured layout was corrected in `935772c`,
  then measured at 915 px of copy width on desktop and 322 px on phone. Netlify's
  Free-plan badge was disabled at project scope after it visibly overlapped the
  phone navigation; a fresh browser context confirmed the frame was absent.
- Follow-up `174380e` made the local fixture's Owner-operator and Self-managed
  driver assignments date-independent. The exact CI reset command imported 143
  active truck assignments and generated seven heavy-rigid Featured slots on
  2026-09-05; every managed live verifier, 201 Node tests, TypeScript, and the
  77-route optimized build passed locally. GitHub CI run `33926528912` then
  passed its validation, 5,000-truck rollback scale check, full desktop/mobile
  browser workflow, and standalone container jobs. This correction changes only
  non-Production fixtures and documentation; no demo identity or vehicle was
  added to the hosted database.
