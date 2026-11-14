# Current work and release status

Updated 2026-11-14 UTC. Start with the [product brief](PRODUCT_MASTER_PROMPT.md),
[feature/test index](../specs/TRACEABILITY.md) and [local setup](LOCAL_SETUP.md).
The [preserved November 11 checklist](PROGRESS_HISTORY_20261112.md) retains the
original source-bound results, failures, artifact hashes and private receipt
references byte for byte. Its local-only and pending statements are historical;
the source, hosted schema, web publication and installed Android are separate.

## Current Cloud runtime checkpoint — blocked

The complete feature source is saved on
[`feat/scenario-driven-demo-signals`](https://github.com/falmata-tech/loadgistic/tree/feat/scenario-driven-demo-signals)
at `f1380c8316c4817b4127504c55e5fc1f1ba8830c`, tree
`4dea35ca497ab5a08f4ff747c8fb63c7e8abec37`. That tree exactly matches the
preserved local e226693 checkpoint; only five documentation files differ from
the executable 4b7af44 snapshot used for the Android qualification. The original
three local commits remain on `checkpoint/scenario-local-e226`. No feature PR,
full CI run, merge, deployment or simulator activation has occurred.

The current Cloud workspace has no normal Docker client or managed socket at
the three checked standard paths. A direct Unix-socket creation probe returns
`EPERM`; unprivileged user namespaces alone do not supply the missing Docker
capability. The QEMU software-emulation workaround proved Engine/hello-world
and later a separate empty Docker/containerd store, but did not produce a ready
application stack. The offline import stopped with `unexpected EOF` after three
image references loaded; its VM/controller subsequently no longer held the
disk, and the queued diagnostic did not run. The termination cause is unconfirmed.
All fourteen exported Storage layer sizes and SHA256 digests match the pinned
source. Original and partial cache stores are preserved.

Resume in a Docker-enabled managed environment using the normal local setup.
Do not continue the nested-VM workaround or count its daemon/image checks as
application acceptance. Candidate migrations 221–225, fixture import, database
and concurrency tests, desktop/phone/Expo review and production activation remain
pending. The source cadence is 30-second synthetic reports, one due Capacity
publication per 30-second worker tick, at least 120 seconds per demo vehicle,
and 15-second foreground feed reads. These are implemented contracts, not live
operation evidence. The last published baseline below passed all sixteen CI jobs.

## Active priority — GPS gateway and signal simulators

The owner's next priority is the GPS gateway and separate dedicated capacity and
location signal simulator services, with periodic phone/GPS verification across
the backend, database, Realtime and UI, followed by a tested production rollout.
This work is in progress. Source now removes new Manual location controls on web
and native while retaining honest, dated legacy reads. Backend retirement,
trusted Demo account projection, normal-signup isolation and explicit holds for
Manual-dependent simulator lanes are being qualified together. Real and synthetic
GPS projects have separate deployment manifests and private readiness checks;
the bounded hosted enrollment connection is implemented but not runtime-qualified. These source
changes are unmerged and not deployed. The verified PR37 baseline below does not
qualify this feature or its service runtime.

The local candidate is on `feat/scenario-driven-demo-signals`, based on the
unchanged published520328b. Its131 focused simulator/provenance/auth/worker tests
pass with zero skips; source/spec/whitespace checks pass. Pending migrations221–225
retire new Manual writes, project trusted Demo account provenance, hold historical
Manual-dependent lanes, install the fast catalog and close demo organization
ownership gaps. Ordinary co-owners, human edits and REAL source takeover refuse
further simulation. Fast/profile control locks preserve in-flight save ordering;
these source checks do not prove actual concurrent database behavior. No new SQL,
service, secret or activation has been applied to production. Actual local SQL,
normal signup, concurrent ownership/stop tests, images and UI remain next.

The dedicated movement worker and workflow simulator are currently disabled in
production; read-only inspection found no registered gateways, devices or saved
GPS positions. Existing historical phone/manual reports do not prove a running
GPS service or recurring simulator. Public Capacity currently uses 60-second
visible-page polling, not push Realtime. Hosted operation and physical tracker
acceptance remain separate, outstanding evidence.

The owner's subsequent instruction makes visible early-user activity the
priority: the candidate targets 30-second synthetic source reports, authored
Capacity phases about every two to three minutes per demo vehicle with staggered actors,
and 15-second foreground feed reads. Actual phone capture/background intervals
are unchanged. A dedicated capacity-only worker replaces dependence on the
15-minute dispatcher for this fast lane. Its30-second tick advances at most one
due vehicle, so delayed activation/recovery cannot synchronize all five into a
recurring burst. Slow profile/team/sharing lanes keep their separate cadence
and activation prerequisites. Jobs must resume one valid next step after interruption,
without bursts, skipped prerequisites or backdated observation times.

The [scenario design contract](operations/SCENARIO_SIMULATOR_DESIGN.md) and ADR-084
define versioned approved routes/states, rather than arbitrary city combinations
or random field values. Offline source verification produced seven local mapped
road courses, two explicit stationary Radius cases and one unavailable course
which stays blocked. These are synthetic protocol courses, not full regional
market journeys. [Road catalog provenance](../resources/fixtures/demo-road-catalog.README.md)
records the source hashes, geometry and privacy limits. Runtime/SQL/UI and hosted
acceptance remain pending; these data checks do not establish active movement.

## Native Android testing — APK complete, device session pending

The owner requested an agent-controlled Android VM/managed device for actual
mobile workflow and parity review. The [Android device runbook](operations/ANDROID_DEVICE_TESTING.md)
prepares one Genymotion Android15 ARM64 device in connected Chrome, with a
60-minute provider stop limit. Current advertised usage is $0.06/device-minute
($3.60 before tax for 60 minutes); the proposed $5 usage ceiling/account setup
has not been approved or purchased. No cloud device, API credential or
managed-device upload was created. The completed test APK has been saved for
handoff; it has not been installed or launched on a device.

Offline CNG and a fresh Android Hermes export passed for `com.loadgistic.app`
1.2.0/code10. The final native input freeze includes the 15-second feed lifecycle
and stable-vehicle selection changes. Current mobile gates pass 426 tests with
zero failures/skips, clean types/lint, 796 translations and the 3,751-module export.
The isolated full JDK 21/SDK 36/NDK/CMake/Gradle 9.3.1 toolchain is installed and
verified. The bounded, single-worker ARM64 standalone build used a
new disposable local test signer; no existing owner key was used. The completed
non-debuggable release-variant APK is 59,110,117 bytes, SHA256
`a7f4e3609e3be8ea9eaa1f4ff0aed8581aea99ecd3d7c2a734279600a1c7b441`.
Packaged-bundle/source-map and native config/asset/lock checks establish executable
input equivalence with `4b7af44b772d92b7c56024613fba7b1a766340aa`; its creation
base 520328b/dirty-input freeze remains a separate receipt. Static qualification
verifies the signature, ARM64-only ABI, minSDK 24/targetSDK 36, all 8 required/zero
forbidden permission checks and 16KB ELF/ZIP alignment. This test signer does not
make the APK Play-ready. MapLibre Native 11.5.0 and attributed OpenStreetMap tiles
are configured; rendered maps and GMS/FCM operation still need device evidence.

The first build failed after 654 seconds while resolving AndroidX AAR dependencies:
official Google Maven HEAD requests returned403, before an application compilation failure was
established. Fresh same-URL HEAD/GET and Java TLS/proxy diagnostics returned200.
A second attempt exposed a task-local Ninja wrapper defect, corrected and tested
against actual ARM64 CMake/restat commands. The third attempt compiled native
libraries, app Java/Kotlin, Hermes, resources and dex, then reached its1200-second
limit during required release lint analysis. Its cache and distinct failure
receipts are retained; the original403 origin remains unconfirmed. The approved
600-second incremental continuation completed in 238.851 seconds with all required
release lint, signing, packaging and assembly checks retained. Build-process
shutdown and cache-lock receipts released the native resource window; current
database runtime status belongs to its ignored resume/active receipts. Native
startup, permission/background-location and notification acceptance remain outstanding.

Current phone Capacity checks each60seconds but captures only when Home is
focused/foreground and 10 minutes are due. Agreed Tracking has a separate native
background service requesting 10-minute fixes. Native tests must verify those
actual boundaries, database observation/receipt times, privacy and web/native
updates rather than claiming continuous reporting from the interval constant.

Connected Chrome inspected the existing published PR37 provider market at
390×844: mobile navigation, the filter sheet, applying Empty vehicle and clearing
it worked; viewport override was reset afterward. This was a read-only inspection
in the owner's existing account, with no account/location/capacity mutation. It
qualifies that older phone-web surface only, not the changed local UI or native
Android. Current local visual/workflow review still depends on the new stack.

## Verified delivery baseline — PR37 published

[PR37's final qualification and production receipts](https://github.com/falmata-tech/loadgistic/pull/37)
supersede the preparation checkpoints below. PR37 merged as
`520328bd61c70a7d278fd183c6a25ffde248ab7a`; its PR CI43358107986 and separate
[main CI43374713806](https://github.com/falmata-tech/loadgistic/actions/runs/43374713806)
each passed all 16 required jobs. [Source workflow43378172030](https://github.com/falmata-tech/loadgistic/actions/runs/43378172030)
advanced production and confirmed the ref at that exact SHA. The automatic
[Production deployment6af6ac945eb1cff1d55e577c](https://app.netlify.com/projects/loadgistic-473/deploys/6af6ac945eb1cff1d55e577c)
is Published: source verification, mailbox_fields=2, all 8 final function ZIPs and
secret scanning passed. Canonical/immutable health, images and public Chrome
tasks passed; `6af4f16a16aab2cef815c573` remains the rollback target.

PR37 also records later unchanged-source local quality: 1,377 root and 424 mobile
tests passed, alongside types, lint, translations and the web production build.
Those results do not relabel older timings or establish fresh authenticated,
private-file or physical-phone acceptance.

Local Docker has since progressed beyond the rootless-host limitation:
task-owned QEMU 10.0.13 / Alpine 3.24.4 runs Engine 29.9.3 through mTLS; a no-certificate
request is denied and the official hello-world container exits 0. Full local
Supabase/Auth/Storage/mail, fixtures and browser qualification remain pending.
Current process status is recorded in the ignored runtime resume/active receipts,
not in a permanent session number. Captured container events correct the earlier
startup inference: Realtime's schema/seed/health job exited0; the next
Storage1.67.20 setup container exited255. PostgreSQL's137 came from subsequent
CLI cleanup, with no observed OOM event. A network-disabled, built-in-only Node
probe in the cached Storage image also exits255 with
`exec /usr/local/bin/node: input/output error`, before application/database code.
All 14 raw image layers pass compressed SHA/CRC and uncompressed DiffID checks.
Their resolved musl loader is 666,216 bytes, while the original and never-started
container materializations contain a regular zero-byte loader. This establishes
a local image/cache materialization discrepancy; physical I/O damage and an
application defect are not established. Supported public-image export and an
isolated fresh Docker/dedicated-containerd recovery are being prepared; recovery
has not completed. Migrations 221–225, local SQL/UI acceptance and production
activation remain pending. No candidate migrations or fixtures have run. Fresh
read-only hosted
inspection confirms ledger219/max220 and all eight installed-function pins used
by the candidate. The existing advisor categories remain unchanged.
Use the [restricted local Docker setup](operations/RESTRICTED_LOCAL_DOCKER.md)
for that separate dependency; container startup is not full application readiness.

The owner paused Google verification for the proposed
`loadgistic.support@gmail.com` sender migration. Existing production SMTP/Auth
settings, credentials and mailbox scan policy remain unchanged. The separate
strict advisor monitor still lacks its scoped credential; its two known WARNs
remain visible. Google-key hardening and native/device acceptance remain separate
open work. Reuse the completed source-bound receipts above when resuming.

## Historical mailbox checkpoint — before PR37 qualification

[PR36](https://github.com/falmata-tech/loadgistic/pull/36) merged normally as
ab899497befdcf5e699cb436de41c4bdb449fb63/tree5f86efd9a3a6104d73956def8ab03f33ef41668c.
[PR CI43348321656](https://github.com/falmata-tech/loadgistic/actions/runs/43348321656)
and separate [main CI43352081887](https://github.com/falmata-tech/loadgistic/actions/runs/43352081887)
each passed all16 exact required jobs on attempt1. Main's12 isolated Supabase
starts passed with the reservation guard. The independent Operations proof and
earlier admin focus each passed three desktop/three phone repetitions, no retries
or skips. PR36 preview6af66dd67c93c0214a4ce0fa verified all8 final function ZIPs
on adapter5.16.6, zero private entries, and passed scanning2257 files.

[Source workflow43355866914](https://github.com/falmata-tech/loadgistic/actions/runs/43355866914)
created/read back production atab899497 using its short-lived Actions token.
The actual Git webhook triggered production6af67d14b459c7cc43f7212c. It failed
before application build with NETLIFY_MAILBOX_REVIEW_REQUIRED; no new production
publication occurred. Old6af4f16a16aab2cef815c573 remains live/rollback, with fresh
health200/ready and no blockers. Automatic transport is observed; successful
automatic publication/runtime is not yet established.

NR-80 identifies the source bug: the SMTP-user digest included Markdown's opening
backtick, and its test repeated that parser/digest selection. Removing that one
formatting byte yields the already-reviewed bare Reply-To digest. The repair
binds both named fields to that exact bare identity, uses independent Markdown
and JavaScript literals/real CLI tests, and requires both fields in production.
Configured formatting/whitespace/case changes still fail; values are not trimmed
or normalized. Focused local tests pass15/15. Pinned Node22.16.0 full quality
passes1,377 tests, zero failures/skips, types/spec/source and actionlint/ShellCheck
for113 scripts; unit38.46s. An isolated actual-CLI comparison proves ab899497's
guard rejects the same bare inputs that the repair accepts with mailbox_fields=2,
without printing either value. Exact PR/main/provider qualification remains next;
final provider/runtime receipts belong in the repair PR.

Provider secret values are not readable in the UI/API/CLI. The inspected edit
forms were cancelled without saving. No diagnostic branch, publishing pause,
mailbox/SMTP value/scope change or scanner waiver was applied. Netlify remains
production branch production, main alone tracked for previews, auto-publish ON,
untrusted previews require approval, private production scopes retained. The
seven-day/project-only/two-read-capability advisor proposal is prepared in tab29,
with the empty named GitHub secret form in tab30; no token was created/stored.
Fresh hosted readback02:52UTC remains ACTIVE_HEALTHY,0 ERROR/2 WARN/1 INFO.
The strict monitor is unchanged. Local Docker is still unavailable; application,
native, schema and runtime source are unchanged. Earlier browser/private-byte
receipt limits below remain explicit.

## Historical port-reservation checkpoint — before PR36 qualification

[PR35](https://github.com/falmata-tech/loadgistic/pull/35) merged normally as
63cbb868b6521e2c02a94e893013eaaa847ef3b5 after all16 exact-head jobs in
[CI43340452362](https://github.com/falmata-tech/loadgistic/actions/runs/43340452362)
passed. Its actual Netlify preview6af65f2dee0414fbc504e277/adapter5.16.6 verified
all8 final function ZIPs before deployment. Main/tree readback matches the
qualified tree683324acaf01b19864794b3f47e002f69ddb3ae5.

Netlify production branch is now production, saved and independently read back;
main alone is additionally tracked for non-production branch builds and PR
previews. Without that tracked base, Netlify stopped creating previews for PRs
targeting main. This narrow correction is saved/read back; untrusted-preview
approval, private production environment scopes and automatic publishing remain.
Arming before first ref creation lets the real qualified push
exercise the Git webhook. Every source/CI gate remains enforced. Old published
6af4f16a16aab2cef815c573 remains live and rollback; no new publication occurred.
Main CI43344733398 then failed Featured team setup/job131624126011 before any
migration. Retained diagnostics show a normal exit1,76.176s,19,128 stderr bytes,
containerStart/portConflict true, and no migration/process/capture error. The
exact port and binding owner remain unisolated; no flaky claim or blind retry.

NR-79 adds early fixed-port reservation only on disposable GitHub-hosted Linux
runners, preserving all previous reservations and verifying the exact union.
It excludes55320–55329 from automatic allocation before dependency/container
network setup. Unknown listeners are never killed and retry rules stay unchanged.
Safe startup diagnosis names only reviewed local service enums. The ephemeral-
allocation actor is a prevention target, not an established historical cause.
Local pinned Node22.16.0 quality passes1,374 tests, zero failures/skips, types/
spec/source checks and actionlint/ShellCheck for113 scripts (unit36.49s). The
fake-kernel entry integration changed only a disposable test file, not this host.
Actual hosted [focused run43346969178](https://github.com/falmata-tech/loadgistic/actions/runs/43346969178)
on4b17173f passed reservation/readback, startup, catalog/API checks and all three
independent desktop/phone repetitions, zero skips/retries. The following doc-only
reconciliation changes no tested executable input. Exact-source PR/main and real
production handoff/runtime qualification remain pending; their final receipts
belong in the PR release record rather than another status-only CI commit.

Supabase dashboard sign-in succeeded through the owner's secure GitHub choice.
The project-only seven-day token with Project Settings Read + Advisors Read is
at final provider review; it is not created/stored and still requires action-time
confirmation. The strict monitor stays unchanged; fresh metadata gives zero
ERROR/two WARN/one INFO. Public Data API denial passed all3 probes. Production
health after branch arming remains ready/no blockers with the existing warnings.

Application/public/function source, root dependency/lock, Next/Node and build
inputs match886691b across891 Git entries. Prior November11 authenticated/private-
byte and desktop/phone review is retained in the history, not relabeled as a fresh
login. Current cloud Chrome exercised old-live public filters/details/Featured/
private sign-in denial; images384/640 and guest private photo/proxy denials pass.
The qualified preview still has a server exception/health503 with private
production-only configuration absent; packaging success is not runtime readiness.
No private credentials were copied into previews. Docker remains unavailable here.
The existing high-zoom/short-height map issue and lack of fresh portrait/native
review remain recorded in PR35. No product/schema/native/Google/Auth change.

## Historical gate preparation — before provider activation

PR32 is merged as `c957a60e6fe491c52a34f99c92037e7f06df3347`.
Its [PR CI43292221647](https://github.com/falmata-tech/loadgistic/actions/runs/43292221647)
and [main CI43298031258](https://github.com/falmata-tech/loadgistic/actions/runs/43298031258)
each passed all16 jobs. The separate
[focused proof run43292221500](https://github.com/falmata-tech/loadgistic/actions/runs/43292221500)
passed three desktop and three phone tasks with zero skips/retries. The original
failure did not recur; its cause remains unisolated. The diagnostic gap is repaired
and qualified, without weakening image-byte/privacy assertions or classifying
the historical failure as flaky.

Current Netlify production remains the manual scheduler deployment below.
Automatic [main build6af61dc3ec2aa1b4a433776c](https://app.netlify.com/projects/loadgistic-473/deploys/6af61dc3ec2aa1b4a433776c)
for c957a60 failed scanning. Its current log names `LOADGISTIC_SMTP_USER` in
recorded mailbox identities and the Android client file; earlier attempts also
named `LOADGISTIC_EMAIL_REPLY_TO`. Values are omitted.

Later signed-in Chrome inspection matched the Android key to source by SHA-256.
It has a25-API allowlist, including Firebase-related APIs, and **no application
restriction**. No Generative Language API is selected. The app-restriction gap
and unused APIs need their own certificate/compatibility review; no key setting
was changed. Firebase plugin installation remains declined.

The merged PR33 source adds byte/value-locked scan exceptions and a
delivery workflow that advances `production` only from a complete successful
current main run. Netlify independently checks that same source through public
read-only GitHub metadata before a production build. Missing metadata, wrong
branch/source, failed CI, changed client bytes or mailbox values fail closed.
The read-only dry run verified actual c957a60/all16 jobs and reported that it
would create production; **no reference was written by that dry run**.

Activation and exact provider fields are in the
[release runbook](operations/NETLIFY_RELEASE_VERIFICATION.md#reviewed-delivery-correction-and-activation).
Source preparation, PR/main CI, provider activation and real publication remain
separate evidence. The scoped Supabase token is prepared at its final review:
project tpwyyzoqijjmbvsmmvcm only, Project Settings Read + Advisors Read, seven-day
expiry. It has not been created or stored. Creating a credential requires the
owner's action-time confirmation. The strict monitor's existing WARN findings
are not waived by provisioning access. Docker remains unavailable here.

## Completed Operations proof diagnostic follow-up

Housekeeping PR31 merged as `c33221845fa68ada66927b4409ecc24464bc5478`
after all16 PR checks passed. Obsolete release-record PR27 is closed as
superseded, with its original history preserved. The merged Git tree is the same
reviewed tree; no application artifact was republished.

Post-merge [main CI43275978371](https://github.com/falmata-tech/loadgistic/actions/runs/43275978371)
failed one desktop Operations single-proof case in shard4 (76 passes,27 reviewed
skips,1 failure). The other13 substantive jobs passed; E2E/release-ready correctly
failed. The runner kept only the wrapping helper at line100 and discarded the
original source/checkpoint evidence. No diagnostic artifact was uploaded. The
underlying cause is unisolated; no flaky classification or blind retry is claimed.

PR32 retains only validated typed proof checkpoints and the
original failure site, with negative tests against private/malformed output. A
separate focused CI workflow runs the same synthetic proof task three independent
times on desktop and phone with zero retries, local-only Supabase and ordinary
catalog/API checks. It cannot substitute for the unchanged full release matrix.
No application, authorization, image-content assertion or timeout is relaxed.
Local browser replay remains blocked by unavailable Docker; the successful
focused and full runs above supply isolated runtime evidence. The original
cause remains open if it recurs. BASE-DEP-001 / NR-76 own this boundary.

The merged Netlify automatic build
[6af5ff9d5f8c5d65281778b4](https://app.netlify.com/projects/loadgistic-473/deploys/6af5ff9d5f8c5d65281778b4)
failed the same reply-to and Firebase client-configuration scan; Deploying was
skipped. Manual6af4f16a16aab2cef815c573 remains published. Post-merge live health
and public Capacity return200; private workspace/photo endpoints return401.
At that checkpoint Firebase installation was declined; the later Chrome review
above supplies its restriction readback. No hosted key setting was changed.
Scoped advisor credentials and
a Docker-capable development environment remain open prerequisites.

## Completed documentation housekeeping

The owner requested local setup, actual browser use, pipeline inspection and
reconciliation of recorded versus implemented/released work. Merged PR31 changed
documentation only. It changed no application behavior, dependency lock, migration,
production setting, secret, signing key or published application artifact.

### Verified source and checks

- Repository `falmata-tech/loadgistic`, default branch `main`, baseline
  `c9260926cbd5ccb3f69b27ab2aac057f2a877b94`. Housekeeping uses a short task branch.
- Baseline GitHub [CI43119585046](https://github.com/falmata-tech/loadgistic/actions/runs/43119585046)
  succeeds on all 16 jobs: validation, mobile boundaries, container, all eight
  ordinary browser shards, three isolated Featured jobs, E2E and release-ready.
- Fresh local `npm run quality` on pinned Node 22.16.0 passes 1,334 tests,
  zero failures/skips, specs 45/features 42, source 766 and TypeScript. The unit
  portion took 43.778s. The separately installed, checksum-verified actionlint 1.7.12
  and ShellCheck 0.11.0 pass workflow analysis of 108 operational scripts.
- Fresh mobile Node 24 gates pass typecheck, lint, 424 tests with zero failures/skips,
  and strict translations 802/802. These are source gates, not installed-phone proof.
- The optimized web build passes (164 static pages). Existing CSS alignment
  warnings remain; compilation does not qualify an authenticated workflow.
- `886691b..c926092` changes only two documentation files and
  `tests/e2e/unified-capacity.spec.ts`; application/native/runtime inputs are
  unchanged. This Git comparison does not independently compare hosted ZIP bytes.

### Production and deployment pipeline — independently inspected November 12

| Boundary | Actual state | Limit / next action |
| --- | --- | --- |
| Supabase | `tpwyyzoqijjmbvsmmvcm`, `loadgistic`, ACTIVE_HEALTHY, eu-west-1; 219 migration entries through 220 | Do not replay 209–220 because an older checklist says 208. Ledger presence is not every function's execution proof. |
| Database catalog | Zero public tables missing RLS; zero browser-accessible application relations; zero unexpected browser-callable definers; zero first-party functions missing search_path | Metadata-only read in a read-only transaction; live role/write regression was not rerun. Caller-bound `current_user_projection()` remains the explicit authenticated exception. |
| PostGIS |3.3.7 in `extensions`; no `public.spatial_ref_sys` | Earlier provider-repair proposals are history, not unfinished current repair. |
| Security advisors | November 12 read: 0 ERROR, 2 WARN; informational service-only RLS/no-policy notices remain | Identity-function execution and leaked-password warnings require explicit disposition; no blanket security clearance. |
| Health/performance advisors | Health has no notices. Performance reports 58 Auth/RLS init-plan and 48 multiple-policy warnings, plus informational indexes/connections | A warning inventory is not a demonstrated app slowdown; inspect the applicable query before proposing a change. |
| Daily security monitor | [Run43155032336](https://github.com/falmata-tech/loadgistic/actions/runs/43155032336) advisor job fails before reading findings: scoped token missing; independent Data API guard succeeds | Owner provisions only the approved project-scoped Settings Read + Advisors Read credential. ChatGPT's Supabase connection does not populate a GitHub secret. |
| Protected main | Browser readback: PR required; strict `release-ready`; conversation resolution; administrator bypass forbidden; force-push/delete disabled; approving review requirement off | No independent second-human approval is claimed. No protection was changed. |
| Netlify continuous deployment | Repository reference present, build Active, production branch main, only production-branch deploys; **automatic publishing is ON** | Recent Git-triggered production and preview builds are blocked by secret scanning. A repository label saying manual does not describe the entire pipeline. |
| Latest automatic main attempt | [Deploy6af4f92d516c70141eddfe3a](https://app.netlify.com/projects/loadgistic-473/deploys/6af4f92d516c70141eddfe3a), source c926092, fails secret scanning | See NR-75 below and the [deployment runbook](operations/NETLIFY_RELEASE_VERIFICATION.md). A green GitHub check does not make this Netlify build pass. |
| Published web | [Deploy6af4f16a16aab2cef815c573](https://app.netlify.com/projects/loadgistic-473/deploys/6af4f16a16aab2cef815c573) independently shows Published / Production, titled scheduler consolidation 886691b | Automatic main failure did not replace it. The title identifies the recorded source; this inspection does not compare the hosted ZIP bytes. |

Netlify's current developer settings show `npm run build`, base `/`, publish `.next`,
functions `netlify/functions`, public build logs, all deployment methods allowed,
and untrusted fork previews requiring approval. UI dependency selection shows
Node 24.x while checked-in `.nvmrc`, package engines and `netlify.toml` select 22.
The failed automatic build's initialization log resolves Node 22.16.0 / npm 10.9.2,
so that UI selection is not evidence of build-version drift. The published
artifact's runtime remains a separate release check. No setting was changed.

The source CI has no Netlify promotion job, and Netlify auto publishing has no
observed wait for main's same-commit `release-ready`. PR protection and production
promotion are distinct. Before repairing automatic publication, review both its
scan findings and the owner/exact-source release boundary; do not silently change
production authority or turn scanning off. See NR-75.

### Secret-scan blocker — diagnosis, not a waiver

The failed build reports `LOADGISTIC_EMAIL_REPLY_TO` matches in three dated
operational documents and the telematics manifest/tests. A second likely-secret
finding points to `apps/mobile/google-services.json:18`. Source inspection confirms
that JSON is the intended Android Firebase client configuration for
`loadgistic-f082a` / `com.loadgistic.app`, with one client API key and no service
account/private-key fields. Values are not copied into evidence or this document.

The email is a mail-header configuration value, and a Firebase client API key is
not a private FCM credential. These classifications alone do not prove correct
Google API/application restrictions. Review the exact client key restrictions
before authorizing a narrow exception. Do not alter synthetic identity allowlists,
remove security assertions or omit entire docs/scripts/build trees to pass a scan.
No exception, credential rotation or production environment edit was applied.

### Local environment and actual browser review

- Installed locked root/mobile dependencies, checksum-verified Node 22.16.0,
  Supabase CLI 2.111.0, actionlint 1.7.12 and ShellCheck 0.11.0 in this checkout's
  ignored cache. The mobile runtime is the provided Node 24.22.1. No global tool,
  owner setting or other project was modified.
- Node 22's initial workflow-tool download did not use this workspace's proxy.
  A command-scoped Node 24 proxy-aware bootstrap installed the exact pinned archive;
  the normal Node 22 workflow check then passes. No TLS/checksum check was disabled.
- **Full local backend is blocked:** this execution environment has no Docker or
  Podman executable/daemon. The pinned CLI reports
  `LegacyDockerLifecycleInspectError` / `docker: command not found`.
  Rootless prerequisites `newuidmap`/`newgidmap` are absent too. No hosted key was
  copied locally and no alternate/mock database was substituted.
- Therefore local fixture import, authenticated web/Expo saves, SQL, scale and
  browser E2E are not qualified here. Bring up the documented isolated Docker
  stack before calling the local development environment ready for product work.
- The Next development server starts on 3100, but a same-process HTTP probe
  returns 500 / `SUPABASE_PUBLIC_CONFIG_MISSING` in session middleware because the
  blocked local configurator has not generated its public settings. This is not
  a ready API or authenticated application. No placeholder key was invented.
- The cloud browser's loopback is separate from this execution workspace and
  returns connection refused for that URL; no local Chrome acceptance is claimed.
  Expo's first startup hit unavailable network-interface enumeration. A
  command-scoped `EXPO_UNSTABLE_BONJOUR=0` permits startup and HTTP 200 HTML by
  disabling only local discovery advertising. This is not actual bundle/screen or
  saved-task acceptance. It changes no app permission or production setting.
  The bounded startup probes stop their own processes afterward.
- Actual Chrome on the live public site passes Capacity load, Empty filter apply,
  selected-vehicle focus, Vehicle details open/close, Back to map, and the private
  Capacity redirect to account sign-in. No account, OTP or business write was used.
- Featured renders eight provider accounts with 10:30PM–11:59PM EAT timing and a
  schedule control. English, Oromo and Amharic headings render. The Scheduled badge
  remains English in the two translated views; this is a bounded copy follow-up,
  not proof of complete localization or fluent-speaker review.
- These are desktop public tasks. No phone viewport, authenticated role journey,
  native camera/background/notification, Play track or real tracker was exercised.

## Released work versus remaining qualification

The October 27 release record is in
[historical PR27](https://github.com/falmata-tech/loadgistic/pull/27), closed as superseded by housekeeping PR31. Its ledger 220 statement is independently confirmed above.
It records the approved 209–220 rollout and web deploy 6ae129c4d2c21b0956250e05,
now the November 11 release's documented rollback target. Its private restore,
permission-parity and synthetic photo receipts are not in this fresh clone and
were not recreated. The preserved historical checklist keeps the earlier failures.

| Area | Current conclusion |
| --- | --- |
| Account Network/private Capacity | Account-bound sharing is current source/schema. Email-only Capacity OTP is retired. Public-link Tracking keeps separate email authorization. |
| Provider discovery and offer matching |209–217 are recorded on the hosted ledger; the historical local-only rollout labels are obsolete. New private-workflow and full filter-matrix acceptance still need their own runtime evidence. |
| Featured | Account rotation and 210 evening window are installed. Today's live public page independently displays eight accounts and the evening timetable. A scheduled programme is not a confirmed running TikTok broadcast. |
| Reported free space / cargo photos |218–220 installed. PR27 records a synthetic hosted API upload/read/remove test. Physical Android camera, current role journeys and scheduled physical-object cleanup are separate. |
| Busy native buttons | Current Button retains its action label and busy/disabled state. All three locale regressions pass in the 424-test run. WEB-MOB-047's deferred-source status was stale; physical assistive-technology acceptance is not claimed. |
| Android | Source corrections and current gates are real. 1.2.0/code 10 artifacts, prior emulator/phone receipts and store builds are different candidates. Requalify exact installed owner/admin/staff, invitation, Back, camera, permissions and recovery before signing/testing-track delivery. |
| GPS/demo workers | Source/schema are present; registration, controls, hosting, observed movement and hardware qualification are separate. No always-on hosted simulation or engine capability follows from migration presence. |
| Commercial plans/payments | Planned; no enforced subscription/payment workflow. Do not restore retired billing gates. |

## Next ordered work

1. Diagnose and qualify the Operations proof boundary using safe evidence and
   isolated CI. Housekeeping PR31 is merged; publication and remaining provider
   changes retain their own exact-source/security prerequisites.
2. Review exact Netlify scan findings, Google client-key restrictions and the
   same-source promotion gate; prepare a narrow owner-reviewed correction and
   qualified preview before any production publication. Keep scanners enabled.
3. Restore unattended advisor monitoring with the approved scoped credential,
   then record its actual run and current warning disposition.
4. Provide a Docker-capable local environment, start the isolated stack and
   complete normal synthetic-account browser/Expo transactions and SQL/scale gates.
5. Resume exact installed Android qualification and remaining broker filter
   combinations, then separately review Play delivery and hosted GPS/demo rollout.

Eight open dependency PRs need compatible, individually verified review; none
was merged or upgraded by housekeeping. The seven-day post-November 11 Netlify
usage comparison is not due yet; invocation estimates are not paid savings.

Owner-only production authority and exact artifact/backup/rollback controls in
[AGENTS](../AGENTS.md) and [PRODUCTION_AUTHORITY](PRODUCTION_AUTHORITY.md) remain.
The current Netlify automatic path is an installed-state discrepancy to resolve,
not permission for the agent to promote an unreviewed change.
