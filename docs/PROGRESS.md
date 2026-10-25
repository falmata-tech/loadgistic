# Current work and release status

Updated 2026-10-24. Work in Loadgistic even when the IDE displays Suqpage. Start
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
  removes obsolete demo email grants and prevents their return. Migrations
  199–207 are installed locally, **not hosted**.
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
  The local Android 1.2.0/code 10 APK builds and verifies at
  `.local/loadgistic-1.2.0-code10-account-network-local-test.apk` (SHA-256
  `ddc3f26706cfd9993a388f214ffcd76aee9cc17def89bc3b24c14b32efb5607c`);
  it contains the live API host and no local API host. This is debug-signed
  for local testing, not a Play artifact. This candidate has no GitHub PR,
  current-source CI result, hosted SQL rollout, web deployment or Play delivery
  yet. Play remains paused by owner instruction.
- The 396 source/spec/test paths from the reviewed local manifest were committed
  as `6f24250`, excluding the generated `next-env.d.ts` and the separate mobile
  `.claude` setting. Current `main` was integrated in merge commit `cf4b25d`.
  That integration exposed a stale rollback-only Featured test which assumed
  vehicle-type days. The corrected test now checks that a scheduled provider
  account loses and regains eligibility when all its vehicles are deactivated
  and restored; it passes locally with `ROLLBACK`. A fresh PR and exact-head CI
  remain to be completed before any hosted release.
- PR22 first run `40156679092` stopped in fixture validation before browser and
  container jobs: an old verifier required every public vehicle to have zero
  corridor routes, contrary to the current attached demo routes. The verifier
  now checks each visible route against its authoritative vehicle and geometry.
  The focused local projection check passes (14 vehicles, three routes, zero
  mismatches) and ten corridor/market unit tests pass. A new exact-head CI run
  is required; the failed run is not release evidence.

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

1. For subsequent work, start from protected `main` and qualify the exact new
   source through its own CI. Keep the pre-existing dirty `next-env.d.ts` and
   `apps/mobile/.claude/` files outside unrelated tasks.
2. Diagnose and harden the two intermittently slow browser workflows before
   the next product release: preserve the first assertion when cleanup also
   fails, and retain the existing signup and archive/security outcomes. Local
   attempts exposed slow dev-server navigation; no production defect was proven.
3. Treat any web publication, hosted simulator activation, Android signing, and
   Play delivery as separate operations with their own exact-source checks and
   current owner instructions. Play remains paused.
