# Loadgistic agent handoff — November 14, 2026

## Owner's latest instruction

Stop environment setup. Commit/push the existing work and document it for another
agent to take over. This handoff does not resume provisioning, billing, browser
setup, merge, deployment or simulator activation. No paid development branch was
created. Preserve the already completed evidence instead of restarting setup.

## Start here

1. Read [AGENTS](../AGENTS.md), the current section of [PROGRESS](PROGRESS.md),
   [GUARDRAILS](GUARDRAILS.md) and the applicable
   [security regression entries NR-81–85](SECURITY_REGRESSION_REGISTER.md).
2. Use [the product brief](PRODUCT_MASTER_PROMPT.md) and
   [spec traceability](../specs/TRACEABILITY.md) to locate contracts. Current
   decisions are ADR-083–085 in [DECISIONS](DECISIONS.md).
3. Read [local setup](LOCAL_SETUP.md) only when resuming development. For a later
   release, read [production authority](PRODUCTION_AUTHORITY.md),
   [GitHub workflow](operations/GITHUB_WORKFLOW.md) and
   [Netlify verification](operations/NETLIFY_RELEASE_VERIFICATION.md).

The earlier 832-line handoff is preserved verbatim in
[CLOUD_HANDOFF_HISTORY_20261114.md](CLOUD_HANDOFF_HISTORY_20261114.md). Its old
running processes, dirty checkouts, manual-location rules and pending owner
visual approvals are dated history. They are not current instructions or proof.

## Repository and exact checkpoints

Repository: <https://github.com/falmata-tech/loadgistic>.

| Reference | Verified checkpoint |
| --- | --- |
| Active feature branch | `feat/scenario-driven-demo-signals` |
| Latest implementation / executable checkpoint | `28afe43f33a6fafcc55e99509eb0490af8f02ca3` |
| Documentation checkpoint before this handoff | `bb5355da10af9880a9b74c73ae91e63507ed3080` |
| Focused diagnostic branch | `diagnose/simulator-db/netlify-capacity-20261114`, at `28afe43f` |
| Published main and production baseline | `520328bd61c70a7d278fd183c6a25ffde248ab7a` (PR37) |

This handoff commit changes documentation only. Inspect the actual branch head
with `git rev-parse HEAD`; do not mistake a docs descendant for a new tested
implementation. At handoff, changes after `28afe43f` are documentation only.
The feature is **not merged, deployed or activated**. No feature PR or complete
candidate PR/main release matrix has run.

Fresh checkout:

```bash
git clone --branch feat/scenario-driven-demo-signals https://github.com/falmata-tech/loadgistic.git
cd loadgistic
git status --short
git log -6 --oneline
git diff --name-only 28afe43f33a6fafcc55e99509eb0490af8f02ca3 HEAD
```

All implementation is committed remotely; the checkout was clean before this
documentation pass. Original local commits `ab51fc8`, `4b7af44` and `e226693`
are preserved locally on `checkpoint/scenario-local-e226`; do not assume that
local branch exists in a fresh clone. Remote commit
`f1380c8316c4817b4127504c55e5fc1f1ba8830c` preserved the equivalent complete
feature tree before later fixes. Current source and public CI links below are
the durable continuation point; ignored local receipts are supplementary.

In this workspace public Git fetch worked but CLI push failed before
authentication. GitHub's connector successfully published exact trees/commits
and fast-forward refs with expected-head checks. If normal push is unavailable,
use that supported route, compare the resulting tree with `git write-tree`,
fetch/read back the actual ref and preserve history. Do not discover owner PATs,
force-push, reset the source, or create duplicate work because authentication fails.

## Implemented, still unmerged

The candidate includes the following coherent changes, with relevant tests and
specifications already checked in:

- Phone/GPS-only new vehicle location updates across web, Expo, application and
  SQL. Legacy Manual reports retain honest source/time; no editor, source
  selection, consent or fresh report is manufactured. Duty authorization runs
  before source-specific handling at public and retained entries (NR-85).
- Trusted operator-marked Demo account provenance. Labels do not grant write
  authority. Normal signup and editable metadata cannot enroll accounts; an
  ordinary co-owner, human changes or real-device takeover stops eligibility.
- Versioned scenario, corridor and road catalogs. Capacity follows authored
  80% → 60% → 30% → Empty 100% phases; routes/percentages/coordinates are not
  arbitrarily randomized. Five fixed Capacity targets are
  `independent-partial`, `fleet-01-partial`, `fleet-02-partial`,
  `fleet-04-partial` and `fleet-06-partial`.
- Default-off minute Netlify Capacity function using a separate signed purpose,
  bounded controller request and transactional demo/owner/lease/state checks.
- Foreground web/native Capacity refresh every15seconds, background/hidden
  pause, non-overlap, privacy-denial clearing and stable vehicle selection when
  a new Capacity ID replaces the old report. This is polling, not push Realtime.
- Independently deployable real GPS, synthetic movement and optional Capacity
  container templates, with separate credentials/lifecycles. Raw GT06/Traccar
  still needs suitable TCP hosting; no real GPS host has been selected.
- Guarded managed-development environment bootstrap and separate review-fixture
  preparer, plus native-only database/concurrency diagnostics and CI cleanup fixes.
- Repaired stale feed test mocks, retired Manual wording assertions and language
  audits that previously omitted runtime GPS/Tracking/business catalog overlays.

### Source map

| Boundary | Main files / contracts |
| --- | --- |
| Phone/GPS and truthful legacy data | `specs/features/FEAT-GPS-001.md`, `FEAT-CAP-001.md`, `FEAT-MOB-001.md`; migrations221/222; web/native location controls |
| Scenario/controller | `specs/features/FEAT-SIM-001.md` through `FEAT-SIM-004.md`; `src/lib/demo-*`; `resources/fixtures/demo-*-catalog*` |
| Minute Capacity adapter | `netlify/functions/demo-capacity.mjs`; `src/lib/demo-world-worker-auth.js`; `/api/internal/demo-world/capacity/advance` |
| Independent hosts | `infra/telematics/compose.hosted.yml`, `compose.synthetic.yml`, `compose.scenario.yml`; [hosting plan](operations/DEMO-GPS-HOSTING.md) |
| Development preparation | `scripts/configure-managed-dev-supabase.mjs`; `scripts/prepare-managed-dev-review-fixtures.mjs`; [LOCAL_SETUP](LOCAL_SETUP.md) |
| Database diagnostics | `.github/workflows/operations-proof.yml`; `scripts/verify-demo-world-concurrency-local.mjs`; `tests/sql/` |
| Release contracts | `specs/base/BASE-DEP-001.md`; [GitHub workflow](operations/GITHUB_WORKFLOW.md); [Netlify runbook](operations/NETLIFY_RELEASE_VERIFICATION.md) |

### Candidate migrations — none installed in production

| Version / file | Purpose |
| --- | --- |
| `221_retire_manual_capacity_location.sql` | Retire new Manual input/materialization, preserve dated history, establish uniform assigned-vehicle duty denial before source work |
| `222_demo_account_provenance.sql` | Trusted Demo classification on the existing bounded owner projection |
| `223_demo_manual_lane_hold.sql` | Hold historical duty/handover lanes dependent on retired Manual writes |
| `224_curated_demo_capacity_catalog.sql` | Fast catalog2, twenty phases/five targets, completion-based due times, sole-owner proof and transactional stop locks |
| `225_demo_organization_owner_isolation.sql` | Profile and reserved Tracking owner isolation; profile control/lease ordering |

## Verification already completed

| Evidence | Result / scope |
| --- | --- |
| Local `npm run quality`, Node22 | **1518/1518**, zero failures/skips; spec, source, workflow/actionlint/ShellCheck and type checks pass |
| [Native run43561193938](https://github.com/falmata-tech/loadgistic/actions/runs/43561193938), `2b575113`, attempt1 | Fresh migrations221–225; inert controls; database security/negative gate; fixtures/Data API denial; strict browser fixture preflight; six Phone/GPS SQL suites; eleven simulator SQL suites; normal-signup isolation and cleanup pass |
| [Native run43614507599](https://github.com/falmata-tech/loadgistic/actions/runs/43614507599), `28afe43f`, attempt1 | Repeats selected database qualification and adds actual two-session races; clone recreation, subsequent isolation and shutdown pass |
| Actual concurrency receipt | `races=10`, `waits=12`, `denials=10`, `accepted=2`, `replays=2`, `cloneMustBeRecreated=true` |
| Mobile source gates | Previously passed426 tests, types/lint,796 translations and Android export; see [Android runbook](operations/ANDROID_DEVICE_TESTING.md) for source binding |

The races cover Capacity/profile stop-first and executor-first order, ordinary
co-owner contention, lease expiry after real lock waits, a competing ordinary
profile save and disabled read-only DONE replay. Private full-state comparisons
preserve denied outcomes. Accepted writes remain in immutable history; the CI
clone is discarded/recreated, never repaired by editing receipts.

Original diagnostic [43560119545](https://github.com/falmata-tech/loadgistic/actions/runs/43560119545)
failed on source-dependent duty denial and premature clone cleanup. Both causes
were fixed and later qualified; preserve the failed run rather than relabelling
it as flaky. The broad unit gate's eleven initial failures were repaired without
weakening semantic/localization assertions.

These are selected native database and automated fixture checks. They do not
qualify all sixteen candidate release jobs, actual changed desktop/phone/Expo
screens, installed Android, hosted scheduling or physical GPS devices.

## Production and deployment baseline

Production Supabase is `tpwyyzoqijjmbvsmmvcm`. Last read-only inspection on
November14:219 migration entries, maximum220;221–225 absent. Global world,
profile, business-sharing, team and duty controls were off; hosted motion off
with kill on; both reserved Tracking controls unarmed. Gateways/devices/positions
were all zero. Presence of source/SQL does not establish a GPS feed.

Security advisors remained0ERROR,2 knownWARN and1INFO category covering110 private
service tables. The warnings concern `current_user_projection()` authenticated
SECURITY DEFINER execution and leaked-password protection. Keep their existing
register entries and strict monitoring intact; no new exception was accepted.
The daily strict advisor monitor still lacks its scoped Actions credential.

Published source is PR37 / `520328b`. Its PR/main CI each passed all16 jobs.
Netlify deployment `6af6ac945eb1cff1d55e577c` was independently Published;
rollback is `6af4f16a16aab2cef815c573`. These baseline results do not qualify this
candidate. Reinspect live refs/provider state before a future release.

Netlify's production branch is `production`; `main` is additionally tracked for
non-production builds/previews, with automatic publishing ON. The delivery
workflow advances production only after a complete successful exact-main run;
Netlify independently verifies that source. Do not bypass promotion, private
preview credential scopes, byte/value-locked scanner exceptions or required CI.

### Simulator activation constraints

- Run **one** fast Capacity scheduler: preferred Netlify minute function, at
  most two due actors; optional container one actor per30seconds. Actually stop
  the external container before switching; a site flag cannot prove it stopped.
- Retain at least120seconds after each actor's actual completion. Healthy
  Netlify spacing is expected120–180seconds, not guaranteed. No catch-up bursts,
  skipped phases, artificial observation times or manual location updates.
- `DEMO_CAPACITY_WORKER_SECRET` is separate from world/motion/gateway authority.
  Both Netlify enable/kill flags and existing global/site/origin gates remain
  required. Same-site Netlify Functions environment is not physical secret isolation.
- Keep slow profile/team/sharing/reserved Tracking off/held for initial Capacity
  activation. Global world control is not an all-services stop switch.
- Verify the actual published function and `* * * * *` schedule, secret scopes,
  controller receipts and changing UI. Stop the scheduler and transactional DB
  control before rollback; HTTP timeout alone does not prove SQL cancellation.
- Seven road courses are mapped, two are explicit stationary-radius cases, and
  one is blocked. They are local synthetic courses, not full regional journeys.

## Environment work is stopped

Do not resume the nested QEMU/Docker workaround, cached imports or queued
recovery jobs. Docker29.9.3 client is installed locally, but daemon access and
Unix-socket creation were denied. Native GitHub runners already supplied the
working full Supabase stack and database evidence.

The latest Supabase development-branch cost prompt expired. No branch, keys,
fixture users, worker activation or approved charge was created. The last quote
was **$0.01344/hour**, before usage charges; recheck when relevant and obtain
explicit cost approval before provisioning. Do not repeatedly renew prompts.

Both connected user Chrome and the Cloud desktop browser could not reach a
ready task-owned localhost probe; a separate executor command also could not.
The environment's approval policy rejected a host-level check because sandbox
escalation is disabled. Probe processes were stopped. No supported preview/
port-forward/request-changes tool was exposed. Do not bypass this through a UI
shell or arbitrary tunnel, or spend on a development branch assuming it fixes
preview connectivity.

On a suitable future environment, [LOCAL_SETUP](LOCAL_SETUP.md) describes Node22
web3100, Node24 Expo8084 and the managed branch option without local Docker.
Existing loopback-only fixture scripts stay local-only. The new bootstrap still
refuses `--seed`; the separate preparer requires exact development metadata,
protected keys, an empty Auth/core-business/Storage baseline, exact apply target
and a new private receipt. Inspect private independent controls separately via
the authorized read-only provider connection; never grant the service key access
just to make setup pass. Partial setup stops with STOPPED_REVIEW_REQUIRED.

Web can use its existing development-only fixture password form. Expo can
restore a genuine synthetic Supabase refresh session through its normal server
endpoint for downstream review. Its loopback-only scripts must not be loosened
for hosted targets. Session-restoration evidence is not email/OTP delivery.

Ignored caches, credentials, logs, native toolchains and private receipts are not
in a fresh clone. Do not commit them or assume their old process IDs are live.
The public source and CI references above are sufficient to resume source work.

## Durable Android test artifact

The test APK is saved in the owner's ChatGPT Library under the exact filename
below. Its filename and59,110,117-byte size were reverified during handoff.
An agent with the owner's authorized Library access can resolve that filename;
otherwise request the artifact from the owner. This is not a GitHub/Play release.
Private download links, Library file identifiers and account metadata must stay
out of the public repository. Source and non-secret fingerprints are recorded here.

- Filename: `loadgistic-1.2.0-code10-arm64-native-test-a7f4e3609e3b.apk`.
- SHA256: `a7f4e3609e3be8ea9eaa1f4ff0aed8581aea99ecd3d7c2a734279600a1c7b441`.
- Package/version: `com.loadgistic.app`,1.2.0/code10, ARM64, min24/target36.
- Non-debuggable release variant / standalone Hermes, signed with a disposable
  test certificate. No owner upload key or Play-ready signing was used.
- Packaged API is **https://loadgistic.com**. Installing it would use the existing
  production backend; it does not automatically target an isolated candidate DB.
- The original qualification binds native inputs to local `4b7af44`. Remote
  `f1380c8` through `28afe43f` have no diff in `apps/mobile`, `src`, root locks/
  package, `resources` or `public`, as checked at handoff. That comparison supports
  source continuity, not installed-device or candidate-backend acceptance.

No installed-device startup, permission/background/FCM or physical tracker
acceptance occurred for this APK. Genymotion's proposed one-device60-minute/$5
session remains unapproved; no device/account purchase or upload was made.
Details, certificate and static16KB/permission checks are in the
[Android runbook](operations/ANDROID_DEVICE_TESTING.md). Obtain device scope and
budget before any future managed-device use; ask before using the owner's phone.

## Remaining work when the owner resumes development

1. Establish a working supported development/browser connection; then provision
   an isolated backend only with approved cost and verified branch metadata.
2. Inspect its private controls/schema, prepare only owned synthetic fixtures,
   and exercise actual changed desktop, phone web and Expo tasks, saved outcomes,
   privacy denials, feed changes and no-Manual controls. Do not reuse old-live
   Chrome inspection as candidate review.
3. Resolve concrete failures; run affected checks, then full exact-head PR CI
   and separate main CI under existing protections. No forced merge or skipped gate.
4. Finish exact-target hosted migration/backup/restore/rehearsal/rollback and
   app packaging gates before any authorized production operation. Refresh
   time-sensitive prerequisites when ready to use them, not repeatedly in advance.
5. Qualify actual hosted minute scheduling/receipts/UI. Select and separately
   qualify raw GPS/synthetic movement hosting and genuine device behavior.

The proposed sender change to `loadgistic.support@gmail.com` remains paused by
the owner because Google verification was unavailable. Do not change existing
SMTP/Auth settings or collect an app password during handoff. Existing Google
client-key restrictions, strict-monitor credentials and store/device work remain
separate follow-ups; Firebase plugin installation was declined.

The owner has now requested a handoff, not another environment recovery cycle.
Verify the branch and current instruction, preserve this work, and resume the
first relevant incomplete dependency only when the next task calls for it.
