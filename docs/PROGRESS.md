# Current work and release status

Updated 2026-10-25. Work in Loadgistic even when the IDE displays Suqpage. Start
with the controlling spec in [traceability](../specs/TRACEABILITY.md), then the
[product brief](PRODUCT_MASTER_PROMPT.md). Historical run-by-run evidence was
moved to [October 23 history](PROGRESS_HISTORY_20261023.md); earlier history is
in [October 20 history](PROGRESS_HISTORY_20261020.md). Neither history file is a
current task list.

## October 24 account-network candidate — local only

- The single public shell now leads signed-in Transport Providers from Home to
  their driving Capacity, Manage vehicles and public market views. Broker and
  shipper Capacity keeps its shared-with-you view; Network handles discovery,
  connection requests and vehicle sharing. Signed-out visitors retain public
  Capacity, Track, Featured and About. Signup chooses account type before email
  verification. Account badges and Featured use provider accounts rather than a
  fixed vehicle/day category. Private Capacity is account-only; migration 207
  removes obsolete demo email grants and prevents their return. Migration 208
  prevents a saved Featured day from becoming an extra later-round turn on
  retry. Migrations 199–208 are installed locally, **not hosted**.
- Agent-led desktop, phone web and Expo previews exercised provider, driver and
  broker navigation, sharing, Account and Capacity tasks. Focused browser checks
  for Account details/profile/documents, driver Account, public-market return,
  Featured recovery and Expo sign-in/account save pass. One desktop real-email
  Tracking check timed out at the local API request; the earlier phone journey
  passed. CI must settle that remaining case before publication.
- Root `npm run quality` passes 1,188 tests and one existing skip, plus
  source/spec/workflow checks and typecheck. All 331 native unit tests, native
  lint/typecheck and the 769-message translation audit pass. The web production
  build passes with 164 static pages. Android export bundles 3,737 modules.
  The local Android 1.2.0/code 10 APK is present and verified (SHA-256
  `ddc3f26706cfd9993a388f214ffcd76aee9cc17def89bc3b24c14b32efb5607c`);
  it was debug-signed for local testing, not Play. PR22 is open; its first three
  CI runs failed as detailed below. No hosted SQL rollout, web deployment or Play
  delivery has occurred. Play remains paused by owner instruction.
- The 396 source/spec/test paths from the reviewed local manifest were committed
  as `6f24250`, excluding the generated `next-env.d.ts` and the separate mobile
  `.claude` setting. Current `main` was integrated in merge commit `cf4b25d`.
  That integration exposed a stale rollback-only Featured test which assumed
  vehicle-type days. The corrected test now checks that a scheduled provider
  account loses and regains eligibility when all its vehicles are deactivated
  and restored; it passes locally with `ROLLBACK`. PR22 is open; passing
  exact-head CI is still required before any hosted release.
- PR22 first run `40156679092` stopped in fixture validation before browser and
  container jobs: an old verifier required every public vehicle to have zero
  corridor routes, contrary to the current attached demo routes. The verifier
  now checks each visible route against its authoritative vehicle and geometry.
  The focused local projection check passes (14 vehicles, three routes, zero
  mismatches) and ten corridor/market unit tests pass. A new exact-head CI run
  is required; the failed run is not release evidence.
- PR22 second run `40157370979` passed fixture import, then stopped in the
  disposable simulator test. Fresh account-only fixtures start two demo vehicles
  in PUBLIC mode without private recipients, while their older scenario tests
  require BOTH. The rollback-only test now explicitly opts those two synthetic
  policies into BOTH before exercising the simulator; its safety checks remain
  unchanged. The focused test passed after modeling the fresh PUBLIC state and
  rolled back all writes. A new exact-head CI run is required.
- PR22 third run `40158398644` reached the SQL privacy loop, then failed in
  `capacity-viewport.sql`: a stale test used an undeclared recipient variable.
  The corrected rollback-only test passes locally. A local continuation of the
  remaining SQL loop exposed two truck-theme Featured suites that no longer
  describe account rotation, and a Tracking fixture that selected an isolated
  Play-review provider. The latter passes after choosing a normal provider.
  The current account-round test now covers random order, saved-week retry,
  historical ledgers, failure atomicity and access denial. It found that a
  published historical day could be counted again after a round advanced;
  additive migration 208 records each imported day once, and the focused test
  passes locally. The 44 other remaining SQL suites passed locally. A new
  exact-head CI run is still required; no hosted write occurred.
- The owner clarified that the original checkout had been moved temporarily.
  It is back with its protected `.local` release files and exact local APK intact.
  The original branch was fast-forwarded to `912e881` without touching the
  pre-existing `next-env.d.ts` or mobile `.claude` files. The attempted rebuild
  of a temporary recovered copy is not release evidence. No hosted write or web
  publication occurred.
- The restored original checkout is now at `4c116d6` on
  `feat/account-network-launch`. Exact-head CI run `40160565628` passed its
  source, mobile-boundary and container checks but failed all eight browser
  shards and the Featured staff-permission browser job. The browser failures
  include stale expectations for the old workspace navigation, Fleet heading,
  and route names; they must be repaired and exercised locally before another
  full CI run. A focused real Chrome check also found that an older `?q=`
  Capacity link lost its transporter-search text. The local correction and its
  desktop browser check pass, as do updated visitor and Admin navigation checks
  on phone and desktop where run. This is **not** release evidence yet. Hosted
  migration ledger remains at 198; migrations 199–208 remain local only, and
  the web and Play builds have not been published.
- The October 25 local browser repair aligns stale assertions and disposable
  fixtures with the unified navigation, account signup, Featured account
  eligibility and current Fleet device order. It also fixes the actual
  transporter-search URL handoff, prevents an unhydrated mobile More tap from
  closing immediately, and restricts post-verification account choice to the
  matching eligible signed-in identity. Focused desktop/phone checks pass for
  provider signup and Fleet, Expo Fleet return, Admin navigation, account
  security, Featured staff permission, Capacity/map layouts and the guarded
  local GPS task. Root quality passes 1,188 tests with one existing skip and
  typecheck; the production web build passes. At that checkpoint the local
  Android 1.2.0/code 10 test APK still matched its recorded checksum; the later
  native change below supersedes that artifact. These local results do not replace
  terminal CI or authorize hosted SQL. PR22 remains draft at the prior commit;
  no new source push, hosted migration, web deploy or Play delivery has occurred.
  Actual Google Chrome at 1440px and 390px shows the signup and retained
  transporter-search views without horizontal overflow; the settled phone
  search shows its proper empty result for a vehicle-make query. Protected
  captures are under `.local/release-20261024/chrome-review/`.
- The original checkout is now at `fefa922` on the same branch. PR22 run
  `40173149817` passed validation, native boundaries and container checks, but
  failed the Featured permission job and all eight browser shards. The local
  repair resolves the observed stale fixture aliases, routes, signup sequence
  and mobile tab assertions; it also fixes actual saved-signup recovery, tab
  reactivation after vehicle reassignment and a 320px Capacity map overlap.
  Focused real-browser checks now pass for Featured permissions on desktop and
  phone, 42 phone shell/accessibility cases (41 together plus the corrected
  Network case), nine phone fleet/Capacity/Tracking/Support flows, and five
  phone personal-account flows. Root quality passes 1,189 tests with one
  existing skip, the web production build passes all 164 static pages, and
  Android export bundles 3,737 modules. A fresh standalone arm64 1.2.0/code-10
  local APK passes the compiled permission check (57 MB; SHA-256
  `1195fbbc9d72c300d5b7df522ede9664d5ee9dbbcfc1d82dadde5c19d1cdde66`).
  It uses the generated local test signing key; it has not been installed on a
  phone and is not a Play artifact. The earlier web package and APK are stale
  because executable inputs changed. These are local results; the repair needs
  terminal exact-head CI before a hosted migration or web deployment. Neither
  the hosted migrations nor the web or Play release has occurred.
  Play remains paused by owner instruction.

## Current delivery

- GitHub PR [#16](https://github.com/falmata-tech/loadgistic/pull/16) merged
  `feat/mobile-app` into `main` as `6b74ec8f63d4436e70a75954006e983ac6dddd59`
  at 2026-10-23 22:16 UTC. It preserved the branch's 126 existing commits.
  Its exact-head run `40028282878` passed all 16 jobs, including `release-ready`.
  The main-push run `40032518930` also passed all 16 jobs on attempt 2,
  including `release-ready`. Attempt 1 failed provider-onboarding and guest
  history browser cases; only those failed jobs were rerun. Their retry passed
  without a source change. Preserve this as an intermittent test issue, not a
  claim that the first attempt was green.
- `main` protection was installed and read back after the merge: a PR and strict
  current `release-ready` check are required; unresolved conversations, force
  pushes and branch deletion are blocked, and administrators are covered. The
  approval count is zero because no independent human reviewer is available in
  the current solo-owner setup; do not claim independent review.
- The live web is https://loadgistic.com. Netlify reports manual publishing,
  production branch `main`, allowed branches `[main]`, and published deploy
  `6adbbd7d8c732adb554ba01b` in `ready` state. Readback after the merge showed
  the same deploy. GitHub integration alone is not a new web deployment.
- Google Play work is paused by the owner. Android 1.2.0/code 10 was built
  locally; the current merged source has not been signed, uploaded, or published
  to Play under this instruction. Do not resume it without a new go-ahead.

## Verified evidence and limits

- The PR source passed 1,170 web tests, 329 mobile tests, web/mobile typechecks,
  source/spec/workflow checks, native translation audit, Android export, production
  web build, and focused rollback-only database handover checks. The exact-head
  PR CI passed validation, eight browser shards, three Featured jobs, container,
  mobile boundary, aggregate browser, and `release-ready`.
- A direct Zod security advisory was patched in web/mobile dependencies. Expo's
  nested build-tool Zod advisory remains visible; the exact Android source-map
  review found the patched direct runtime and no nested Expo Zod source in the
  bundle. This is a bounded review, not a claim that the raw mobile audit is clean.
- Local demo-world simulator slices have verified GPS intake, provider-profile,
  broker-staff, Capacity, Tracking, and one Off Duty/Restore cycle. Controls are
  left off after those bounded tests. Do not claim an always-on hosted simulator
  or real-device GT06 ingress; see [local supervisor](operations/DEMO-WORLD-LOCAL-SUPERVISOR.md)
  and the controlling simulator specs. The prior detailed evidence is in history.
- Tests and sampled desktop/phone workflows do not prove every nested role flow
  or a fresh installed Android acceptance on the merged source. Keep these limits
  visible in any web/mobile launch decision.
- Documentation PR21's first CI run, `40038949581`, stopped in a stale
  rollback-only Featured permission fixture: it chose a tractor and changed its
  cargo type to an incompatible courier configuration. The test now chooses a
  non-trailer saved vehicle, changes its category and configuration together,
  requires a usable fixture, and restores both fields. The exact local SQL test
  passed with `ROLLBACK`. Read PR21's terminal CI and merge status on GitHub;
  this local result alone did not qualify that later commit. The account-based
  Featured change superseded this vehicle-theme assertion; the October 24
  candidate replaces it with the account-eligibility regression above.

## Next steps

1. Qualify PR22's repaired head with terminal green CI. Preserve the separate
   dirty `next-env.d.ts` and `apps/mobile/.claude/` files outside that PR.
2. After green CI, refresh the protected hosted backup, restore and SQL
   rehearsal and present the exact migrations 199–208 for owner review before
   any hosted write. Rebuild the immutable web package from the final source,
   then follow the guarded Netlify release and independent live checks.
3. Treat hosted simulator activation, Android signing and Play delivery as
   separate operations. Only the local Android build is requested now; Play
   remains paused.
