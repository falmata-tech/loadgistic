## October20 release-test failure and correction

Current step: build the final web source, commit/push the reviewed task files,
then require every exact-source CI job before any rollout.

- [x] Local179 backup, application, parity and security verification.
- [x] Affected Expo profile/filter workflow and remaining edited desktop/phone
  smoke checks. The first smoke group passed9/12; the three mismatches were old
  country-specific contact/desktop-tab assertions. Exact published-contact and
  real phone Overview→Tracking checks pass with both map refresh/retry cases
  in the final6/6 follow-up. No skips, flaky retries or new UI changes.
- [x] Fresh production web build, final source/spec/type checks and strict
  disposable fixture/API preflight(1/1, zero skips).
- [ ] Scoped commit/push and all16 same-source CI jobs, including expanded scale.
- [ ] Fresh Android APK/AAB, artifact verification and exact signing review.
- [ ] Additional hosted176–179 review, matching rollout and installed-phone test.

No hosted update, web release, signing or Play update has occurred in this run.

The public map repair179 is installed locally after a protected fresh backup.
The actual filtered API returns200/6items in1.3s (including dev adapter work).
The previously failing Expo independent-profile/filter workflow passes1/1:
eight initial pages complete for101 signal items; filters return200/6 and the
selected provider returns200/1, with no repeated cursors or page errors. The
other typing/clear cases passed earlier2/2. Full browser CI remains pending.

Diagnosis found8,484 repeated assigned-driver lookups consuming3.767/3.931s;
JIT comparisons did not materially help.179 reuses the same authoritative Driver
once per latest vehicle. Its ordinary-postgres rollback candidate preserved
full JSON/order and reduced initial4198→259ms and filtered4679→299ms, with209
cached evaluations. Protected candidate receipt:
`0a68bfd819c9f9756c35137a05b36c47d2a27b910a5a92cbb2cf4343602c88af`.
The23-provider parity/denial SQL and all five requested SQL/security gates pass;
existing owners, ACLs, records and legacy ledger are preserved. Two invalid
synthetic setups were corrected against existing constraints (Partial endpoint
references and Live→signal→Draft), with failed receipts retained and no179 replay.
Verification receipt:
`cf4633cdfc83cff610bfaf5fa78ce343a00cb95a08953e3c6f7523c5c42b9338`.

The separate public route failure boundary passes5/5 after reproducing its old
uncaught rejection:503/no-store, no internal cause or fake empty success,
unchanged400 validation and healthy result shape. Its message is already
translated in Amharic/Oromo. Expanded unscoped initial/filter/cursor scale checks
retain the five-second limit; actual5,000-vehicle execution still needs CI.
Hosted176–179 remain unapproved and untouched.

The owner approved the two small phone CSS fixes: the refresh-error notice
leaves the zoom controls clear, and the ordinary vehicle detail card fits without
its extra scroll. The focused map group passes8/8, including retry, preserved
selection/camera, overlapping geometry, documents and long-content handling.
Captures: `.local/ci-ui-20261020/`. No further visual change is included here.

The current local quality gate passes1007 unit tests, specification/source checks
and TypeScript. The previous web production build passed; a fresh build including
the new public route boundary remains required. The final TypeScript
check also passes after the licence-badge test correction. Focused follow-ups:

- Retained payment denial/history, public profile/photo upload, private document
  submission/category scope, public document privacy and provider counts/activity
  pass(5/5 desktop). Photo assertions now wait for the real image response.
- Independent moderation holds and retired Support pre-/post-hydration checks
  pass(2/2 desktop). The earlier late moderation failure was not reproduced;
  bounded stage/status evidence remains available rather than declaring a fix.
- Financed operating-licence review and private evidence pass on desktop and
  phone(2/2), including the Expo upload. The badge belongs on Vehicle details;
  the old test looked on the default Capacity tab.
- Tracking route/map and proof cases pass on desktop after waiting for the actual
  hydrated map before checking the terminal vehicle-marker state. The phone
  route/proof cases passed in the earlier focused run.
- Assignment persistence, document review, ratings, Expo signup, Account/photo,
  session recovery, review navigation, map/proof, confirmation and workspace
  structure have focused passing evidence. These do not replace full CI.

The guarded fictional GPS case initially used a stale employee-denial request:
current assigned drivers may choose Manual/Phone, so its Manual request succeeded.
Read-only comparison identified the exact synthetic change; a guarded one-time
normal-API correction passed, letting that driver release Manual before its owner
restored the retained GPS/1km setting. No customer or physical device was involved.
The corrected negative request uses owner-only GPS selection and checks exact
403/FORBIDDEN plus unchanged state on web/mobile. Cleanup now rereads final state
even after earlier restoration. Its full web/Expo case passes. The saved-Manual
editor now also passes(1/1): web/Expo save, reopen, accuracy-only change without
replacing the point, reload, Cancel/no-write and final GPS restoration; zero
page errors. Protected final receipt: `saved-manual-editor-evidence-final.json`. No physical-device or engine-control proof
is claimed. Request wireless Android access only when hardware acceptance is
ready; another project is using the phone.

Local schema diagnosis found176–178 on disposable rehearsal clones but absent
from the active preview. Its legacy ledger129 is intentionally incomplete: never
replay130 onward, reset the preview or rewrite that ledger. Protected backup and
V2 restore are retained under `.local/browser-repair-20261020/`. The clone now
contains176–178. Extension restoration needed the exact original PostGIS
namespace and source table-security metadata; those local clone corrections are
recorded separately, without ownership/catalog changes or primary writes.
An interrupted gate stopped with ETIMEDOUT; after normal Docker recovery, exact
clone metadata and zero remaining sessions were verified without replaying
restore/migrations. All six SQL suites and both security gates then passed;
rehearsal receipt15ab63815976da304fb9ce24aacd59394978d0f732cdfc5916bfdc00a152945a.
The normal local apply stopped42501 at176 because the existing provider-directory
function belongs to the original local administrator. The complete transaction
rolled back; catalog/counts match its fresh backup. The owner explicitly approved
the exact local-only remedy in `local-admin-apply-owner-review.md`: existing admin
for whole176, then normal postgres for whole177/178; fresh backup2, unchanged SQL,
owner preservation and all gates remain required. That exact operation completed:
all176–178 applied locally, all eight gates passed, legacy ledger and old function
owners remain unchanged. Applied receipt:
`c9a2ed34b5e21ef3e3c12bb07216ee5cf886894b3a75831f4d5038b14e383441`.
Hosted176–178 remain unapproved and untouched.
Web health, Expo HTML/actual bundle and strict one-pass/zero-skip fixture preflight
passed after recovery. Phone sponsor and all Operations inventories passed; the
More test exposed a stale strict single-grid selector against the three current
menu groups. Its corrected shared-page/heading checks pass desktop and phone(2/2).
The two public/private shell tests pass across their explicit screen widths;
the two duplicate phone-project executions remain intentionally skipped.
Invalid multi-option correction passes desktop and phone(2/2), retaining denial
before explicit correction and duplicate-query denial. Next Form navigation now
waits for its actual commit; the local desktop navigation measured9.275s, exceeding
an ordinary five-second locator wait. The existing60s test budget and separate
five-second SQL performance gate are unchanged. This does not establish Production
navigation timing.
The first post-update preflight failed its old response.ok assertion; its HTTP
status was not captured, and no root cause is claimed. Direct public-map/search
requests subsequently returned200. The one controlled strict preflight rerun,
now asserting exact HTTP200, passed one test/zero skips. Read-only inspection found
zero owner execution denials in43 reachable functions/87 static definer edges;
no additional privilege or permission change was made.

The scoped browser API wrapper replaces transport exceptions with fixed method/
reason tokens rather than printing Playwright request cookies. Its7 focused
regressions pass; the CI result/annotation unit tests pass12/12. This protects
that harness boundary, not every possible browser exception.

Remote CI39417891018 on18fbece passed validation(including the unchanged5,000-
vehicle search gates), mobile, container and all three isolated Featured Prepare
jobs. All eight ordinary browser shards failed:347 passed,55 inventoried skips,
110 failed and zero flaky retries. This is a failed release gate. The current
repairs are uncommitted and need exact-source CI after the remaining focused
workflows pass. No hosted database change, web deployment, Android signing or
Play update is claimed by this checkpoint.

Android artifact check: the existing protected code9 manifest has538/540 current
files identical. Mobile Capacity changed its duplicate progressbar accessibility
wrapper; the other difference is the web-only Admin return-path helper. The old
APK is therefore not exact current mobile source. Prepare a fresh isolated local
APK/AAB while preserving the old artifacts and unused signing approval. No key
retrieval/signing or Play upload is authorized by source equivalence; a concrete
replacement signing review follows the verified new artifact and CI.

CI run `39412965593` on commit `8da376b` passed validation, mobile and
container, but failed the isolated Featured operations browser case and browser
shards 1, 2, 4, 5, 7 and 8; shard 3 stopped during its isolated database startup.
The run was cancelled after those failures to avoid spending more CI time on a
candidate that could not pass. It is **not** release evidence. Local reproduction
found the Featured case asserted the retired “truck type” copy and expected its
editor to stay open after Publish. Both desktop and phone pass after checking
the current “vehicle type” copy and deliberately reopening Edit (2/2). Local
Account-to-Network now passes after changing its old “Add contact” assertion to
the actual “Add access” flow (1/1); account security passes with retirement
redirect and saved inactive-vehicle readback (1/1). Admin Featured/GPS view-mode
passed alone (1/1), so its shard failure remains unclassified rather than
being papered over. The CI runner now reports only bounded failing test
filenames, with a unit test, to make the next run diagnosable without raw logs.
The complete same-commit CI gate and deployment remain blocked.

This release is **not ready to deploy**. The 988 passing unit tests, source and
type checks, successful build, and 5,000-vehicle search timing check were real
but did not exercise the complete desktop/phone browser suite. The first CI
matrix used four large browser shards; all four exceeded the 60-minute job
limit, so their coverage was unknown. The eight-shard run on `6199c3c` got
farther and exposed stale synthetic browser setup: newly created vehicles were
assumed to have an active driver and to be Live, old staff/admin actors and a
retired admin route remained in cases, new Tracking events still used the old
20 km radius, some capacity cases assumed only one row per vehicle, and several
visible UI assertions no longer matched current screens. One shard also could
not start isolated Supabase because of a local port/image-fetch failure. The
`validate` job, including the search scale gate, passed; the required browser
gate did not.
No hosted database, web deploy, Android signing, or Play update follows from
this partial result.

The engineering owner is correcting fixtures and actual UI defects separately,
then will run focused desktop/phone workflows, the fixture preflight, all
required same-commit CI jobs, and only then resume the approved rollout checks.
The new preflight is `tests/e2e/fixture-contract-preflight.spec.ts`; it must be
run as an early isolated browser gate before being credited as prevention.
`docs/GUARDRAILS.md` now requires an affected-fixture inventory and saved-state
readback whenever the role/driver/publication contract changes. Neither the
full CI nor the release is marked passed here. The local Playwright fixture/API
preflight passed with synthetic cleanup on October20; it does not exercise UI
clicks. The strict local runner also passed with exactly one test and zero
skips; its new early CI step still needs a same-commit run. This repeats the
established NR-21 fixture-drift lesson, now updated with the current provider
and Tracking rules. It is a
test/release-process regression, not a newly confirmed security exposure.
The owner approved the small sponsor, private Capacity, mobile search and public
map layout fixes for continued release checks. A focused public-reporting
workflow then found that the desktop public navigation overlaps the Report
button. The placement was corrected and the complete local report, moderation,
block and unblock browser flow passed on desktop and phone (2/2). Its changed
placement has targeted screenshots and the owner approved the final desktop/phone
placement on October20. A later admin record-navigation correction also needs
focused visual review before the full release gate; the owner approved the
desktop/phone account and vehicle Back-link placement on October20. Its synthetic
save, denial and return-to-search browser workflow passed on both sizes (2/2).
The public map/Tracking entry and selected public vehicle/driver document checks
passed on desktop and phone (8/10 in the combined focused run, then the remaining
driver-management cases passed 2/2 after a bounded navigation wait). Tracking
radius/foreground-report behavior passed (2/2).
The regular-route and location editor passed its real save and database readback
on desktop and phone after replacing the retired radius label in the old test;
the fleet-owner location permission check also passed (4/4 focused). These
focused successes do not replace the full release gate or same-source CI.
Retained support history now passes its three focused browser cases on desktop
and phone (4/6 in the first full run, then the two corrected member/staff cases
passed 2/2). The old fixture selected the first Support or Transporter profile,
which could lack Support permission or refer to a real account. The corrected
test selects a Support-permitted assigned agent and a synthetic unrelated
transporter, waits for completed pagination, and still checks archive denial,
assignment revocation and private-file access. The provider-fleet
cross-workflow journey passed desktop Chrome (1/1, 5.3m) after updating its
consent/workspace signup, required account identity fields, explicit Fleet
editors and bounded navigation waits. It verified one unreviewed Live vehicle,
an assigned employee, rejected/replaced documents, generic approval not granting
ownership, an exact Trust relationship, additional publication, revocation and
replacement, with synthetic cleanup. The same phone Chrome and Expo-web journey
then passed (1/1, 5.8m) with isolated synthetic cleanup. The Expo Fleet test now
opens each vehicle's Details tab, where publication actions and reviewed
authority live; it verifies both Live rows, distinct reviewed/unreviewed states,
a new Draft vehicle, and the driver map Home after switching areas. The local
quality gate passed 999 tests, source/spec checks and typecheck; the web
production build passed. The complete same-commit CI gate remains pending.
Ordinary CI skips screenshot-only captures and guarded local-demo cases unless
their opt-in flags and prerequisites are supplied. Their inventory and evidence
rule are in `docs/GUARDRAILS.md`; a green default CI run must not be described
as running them. Three ordinary Featured Prepare tests also write lasting rotation
history; the new CI configuration excludes them from shared browser shards and
requires a separate fresh-database job for each, with desktop and phone passes.
Those jobs have not yet run remotely. Ordinary browser shards now require an
exact selected/result identity match, at least one pass, no retries or flaky
result, and only 55 explicitly inventoried intentional skips; the strict runner
has12 passing focused unit tests. Safe failure summaries now also produce
GitHub Actions error annotations; hosted annotation delivery is not yet
verified. Full release checks remain pending.

## Active release completion — October19

The owner requested shipping the accumulated Loadgistic web/mobile work, an
ordered GitHub push, and only English, Amharic and Afaan Oromo. Further feature
expansion is deferred. This task stays in Loadgistic; Suqpage is excluded.
Existing remote history is preserved; coherent new commits will record the
reviewed release rather than rewriting previously published commits.

- [x] Record initial Git state (branch `feat/mobile-app`, HEAD `f63a5f5`, 516
  modified and 390 untracked paths, no staged paths). Exclude generated builds,
  credentials, runtime records and the user's mobile `.claude` settings.
- [x] Rehearse migration174 on a protected isolated local restore; reproduce the
  old phone/demo deadlock and prove ordered locks complete both writers. Apply
  only to the backed-up local preview and verify matching function fingerprints.
- [x] Exercise actual Chrome web and Expo driver Manual → Phone source changes,
  saved API/database outcomes, owner restrictions and public source filtering.
- [x] Narrow selectable/runtime languages to English, Amharic and Afaan Oromo;
  saved removed locales fall back to English. Review meaning in whole messages.
- [x] Complete mobile hook/lint repairs: zero errors/warnings, typecheck and
  focused fleet/directory tests pass.
- [x] Finish dynamic web-copy review: fixed-key and unmarked-JSX audits have
  zero missing entries; bounded feedback translates and unexpected errors use
  localized fallback. This is not native-speaker certification.
- [x] Owner explicitly approved the three-language web/mobile screenshots and
  continuation of release checks on October19. Prior Manual/Phone layout
  approval remains recorded.
- [ ] Run full source/spec/unit/type/security/workflow/build gates once focused
  failures are resolved. The owner approved the changed screens on October20.
- [ ] Create explicit-path reviewed commits, push the authorized branch and wait
  for required CI. No force-push or destructive history cleanup is planned.
- [ ] Prepare exact hosted migration/artifact/backup/rollback review and signed
  Android replacement. The new one-use 1.1.0 signing approval is unused.
- [ ] Deploy and independently verify web and mobile testing release; document
  links, exact versions and any external Play-review dependency.

October19 release-gate checkpoint: GitHub run `39278321323` on `51838ccb`
passed its Android job. Validation stopped in `capacity-viewport.sql` because
the test still expected the retired platform Brokerage audience to return an
empty private Capacity page. Migration159 correctly rejects it with
`PLATFORM_CAPACITY_RETIRED`; the local test now requires that exact denial and
still checks unrelated recipient isolation. The corrected SQL passes on the
isolated restored database as `supabase_admin`, and the local preview suite now
passes its `capacity-viewport` case. Desktop/phone Chrome passed the current-load
filter, Tracking owner-sharing, public entry and account-details/security
workflows (2/2 each). Focused Tracking smoke then exposed two real defects:
status-only Loading sent an empty location claim to the device validator, and
touch selection of a route city could lose its catalog reference. The source
fixes and regression assertions passed focused tests; the full Tracking browser
rerun passed on desktop and phone (2/2), including the three-city route,
status-only Loading with proof, owner invitation and restricted viewer map.
The new same-source CI remains a release gate. The completed
Android 1.1.0/code8 candidate remains test-signed; owner approval for one use
of the existing upload key is recorded and unused. The approved deployment
remains gated; this checkpoint does not claim release gates passed.

The local web preview is running again for the final browser checks. Source/spec
checks, 979 unit tests, TypeScript and the 156-page production build passed
after those Tracking fixes. The focused provider first-location desktop Chrome
test passed (1/1): a restricted Off Duty Driver saved a 10 km obscured phone
fix, no capacity was published before the owner's action, then the owner
published Empty capacity from that exact saved fix. Synthetic actors were
removed afterward. The older full fleet-onboarding browser script still has
stale selectors and has not passed as a whole; the new focused test covers this
changed first-location contract.
The earlier
automatic approval reviewer usage limit was resolved; the bounded local SQL
rerun completed without a hosted write. Commit/push, final same-commit CI, a fresh
backup and security check, hosted migration, web publication, native sign-in
verification, signing and Play testing update remain pending.

Play reviewer access uses three separate synthetic accounts saved privately in
Google Play Console. Google's reusable-password requirement is met through the
existing small Review access entry because ordinary sign-in uses one-time email
codes; no new reviewer interface is part of this release. The code9 Console
instructions must name the current Transporter login → Review access path when
the replacement build is submitted, while code7 remains on its older path.

October19 follow-up: the owner approved the updated reviewer screen. A local
post-175 migration176 now partitions synthetic reviewer business workspaces
from real business discovery, private Capacity and Tracking, with rollback-only
SQL regression and independent RLS/ACL checks passing on disposable clones.
Root quality passes 978 tests, the web production build passes, mobile tests
pass 312/312, native typecheck/lint/Android export pass and Expo Doctor passes
21/21. The next Android candidate is 1.1.1/code9 because code8 does not contain
the reviewer business change. The isolated Chrome owner/staff flow passed: both
signed in through Expo, the owner created and invited staff to a synthetic
business, Capacity and Tracking loaded for both, staff Team access was denied,
local records matched those permissions, and all test actors were removed.
Exact-source CI, hosted176 review/backup/rehearsal, signing and Play submission
remain pending.
No hosted data, web production or Play test track has been changed by this
follow-up.

Local evidence: migration174 SHA256
`a4a67d3ae5d18cd19067559b62db0391b04d278a5fedfb5166e264c59b7610f9`.
The preview and isolated-clone function fingerprints match. SQL tests for manual
Capacity, registered phone installations, GPS privacy, GPS commands and Tracking
device location pass with rolled-back test writes. Current-source actual Chrome
web and Expo driver workflows pass; real Android background operation remains a
separate native release check. Migration175 additionally repairs a reproduced
regression: fleet contact edits no longer overwrite a driver's structured first/
last names. A fresh local backup, isolated restored-Production rehearsal, exact
function/ACL comparison and rollback-only identity regression pass. The full
138–175 sequence (37 files,147 absent) applies to the isolated production backup;
all final release gates remain pending. Live advisors have no critical findings
and the two previously documented warnings. The owner approved the exact
138–175 rollout and the same two-warning exception on October19, conditional on
final CI and refreshed backup/security checks. No production write has occurred.

Release-check checkpoint: root quality passes all 976 tests and type checks;
production Next.js build generates all 156 pages. Native tests pass 312/312,
types/lint pass, and Expo Doctor passes all 21 checks after SDK57 patch alignment.
The actual Android Hermes export and strict reviewed-dependency runtime check
pass; the raw 27 tooling audit findings remain recorded and none of their
reviewed affected packages appear in the compiled runtime. All 81 current SQL
suites pass (66 on the initial run, 15 after isolated fixture/retired-contract
repairs); the separately prepared demo-device clone and ordered-lock check pass.
The 175 regression is the product repair; legacy fixture addresses, retired
Brokerage positives and old radius/recipient expectations were test drift.
The initially slow local Featured transaction finished and released its locks;
no production or customer session was cancelled. Focused staff browser checks
and the isolated default-test-signed native binary remain in progress. The exact
138–175 SQL is now explicitly approved; new signing use and final remote
CI/publication remain pending. The 5,000-vehicle performance gate failed at an
8.88-second legacy overview query; the current page query is being profiled on a
separate disposable local clone. Its five-second thresholds remain unchanged.
No performance repair has been applied to production or added to the approved
SQL manifest. The host was subsequently measured at load averages
110/166/144 with about15GB swap used on a16GB Mac while native C++ compilation
was active. Local timing is therefore inconclusive as product-regression evidence;
the unchanged scale gate must pass on the isolated CI runner before release.
The candidate may be committed/pushed for that check, but is not deployable yet.

Google Play inspection October19 confirms code7/version1.0.6 is completed in
Alpha and Internal; Production is empty. Code8 is available for the candidate
1.1.0. This readback does not prove tester enrollment or the 14-day requirement.

## Active Capacity filter refinement (October18)

Owner requested a location-source filter for GPS device, phone, and manual updates
on public/private Capacity. The owner confirmed removing only the separate
Space needed filter while retaining each driver's accepted-load preference in
the saved data and vehicle details. Empty/Partial status and accepted-load
preference remain different facts; do not rewrite matching semantics.

- [x] Define the authorized public/private/business location-source query
  contract in FEAT-CAP/MKT-001. Never expose device IDs/IMEIs.
- [x] Connect web and Expo filters to the same published-source predicate,
  including combined filters, Clear all and unknown-source exclusion. Old web
  links carrying the removed Space needed choice do not apply a hidden filter.
- [x] Run focused SQL/API/UI checks and actual Chrome phone/desktop interactions.
- [ ] Obtain owner visual approval before full release gates or deployment.

Local-only evidence: migration171 is installed in the backed-up Loadgistic
preview after an isolated rehearsal. Rollback-only SQL acceptance passes on the
clone and active preview for public, email-private and business Capacity, OR
within location source, AND with other groups, unknown sources and restricted
function grants. The actual local public API returns only TELEMATICS for GPS,
DEVICE_OBSCURED for phone and MANUAL_ADMIN for manual selection. Web desktop and
phone Chrome interactions pass selection, apply, Clear and old-link behavior;
Expo phone Chrome preview passes draft/clear/cancel. Web and native typechecks,
24 native discovery/capacity tests,14 web/business/filter tests and strict native
translation audit (680/680) pass. Stable review images are under
`.local/capacity-source-171-20261018/`; web3100 and Expo8084 remain local.
No hosted migration, Play binary or production deployment is claimed.

Copy review also removed a retired platform transport-arrangement promise from
Terms in English and all four translations. Focused retirement tests pass16/16;
actual Chrome Terms at1440/390px shows each direct-agreement/fair-use paragraph
at a readable width after fixing a grid placement defect; all four translated
Terms render on a phone without overflow. Terms screenshots are
in the same local review folder and require owner visual review with the filter.

## Active addition — courier vehicles and provider account identity (October18)

Classification: feature, public identity/search, demo preparation (local first).
October18 terminology follow-up: use **vehicle** in general navigation, forms,
marketplace, Tracking and staff copy because Courier cars and motorcycles are
supported alongside trucks. Keep actual configuration/model names, established
API/database identifiers and freight terms such as full truckload unchanged.
Check web, phone web, Expo and all four translated languages before visual review.
Owner restores Courier car and Courier motorcycle, wants fewer heavy/container
examples without eliminating them, and chooses a social-style provider identity:
chosen **Account name**, unique **@handle**, and **Account manager** shown publicly
by first name only. Private first/Last-father names remain private. No provider
ownership, staff permissions, fleet qualification or customer workspace conversion
is implied by a personal-looking or business-looking chosen name.

- [x] Record the dirty worktree, inspect catalogue/profile/search/import contracts,
  read FEAT-PRV/IAM/CAP/FLT/FTR/MKT-001, privacy NR-40 and fixture-history rules.
- [x] Confirm public manager privacy: owner chose first name only. Preserve prior
  public city/About secondary matching; prioritize the three identity fields.
- [ ] Update controlling specs and coordinate disjoint work:167 identity/search,
  168 restored vehicle choices/Featured compatibility;169 enum and170 customer
  business directory/documents; root integration and coordinated demo rebalance,
  integration, authoritative rehearsal, actual browsers and account guide.
- [ ] Implement separate chosen public Account name, owner-first-name manager,
  stable globally unique provider handle and compatible old links. Connect signup,
  deliberate profile edits, public profiles/search on web and Expo with four
  native-language labels; never auto-publish a legacy private full name.
- [ ] Restore both courier types/images in web/native choices, storage validation,
  filters, maps and Featured eligibility without changing saved manual rosters.
- [ ] Add broker/shipper/receiver company identity to the provider-workspace-only
  business directory: chosen company name, globally unique handle and the current
  owner's explicitly configured first name. No public website directory, personal
  email, private surname or direct proof access for providers.
- [ ] Add optional business document submission/history/review for business licence,
  manager National ID and business address. Reuse private upload/Review Center;
  owner submission only, Trust review only, current identity/expiry-bound badges,
  replacement after More info/Rejected, no truck ownership/type for businesses.
- [ ] Prepare a named synthetic-only demo rebalance with simple individual names,
  couriers and preserved heavy examples. Preserve original vehicle/proof/history,
  GPS001/002 relationships and every real account; use additive normal replacement
  where an existing reviewed physical truck cannot be repurposed safely.
- [ ] Rehearse immutable SQL on a fresh protected local restore; install only after
  local permission/privacy/catalogue/search tests pass. Never reset the preview.
- [ ] Exercise actual Chrome signup/edit/search/filter/profile/Featured tasks on
  web/phone/Expo, verify saved API/database outcomes and practical demo logins.
- [ ] Show the working changes for visual review before full release gates.
  Earlier connected-workspace review remains pending for unchanged screens;
  this addition does not authorize hosted SQL, production or new binaries.

Local progress:167–170 are installed only in the protected preview after an
isolated rehearsal. Six additional synthetic couriers (three cars, three
motorcycles) were added through normal local onboarding/fleet/capacity commands;
existing vehicle rows and saved Featured rosters were preserved. Both types are
returned by public Capacity filters and appear as map markers on desktop/phone.
Owner Account → business document submission, Trust More info, replacement and
rejection roundtrip passed in Chrome; unreviewed requests produced no public
badge. Expo business directory as-typed search/clear and owner document form
passed in Chrome phone preview. A dev-only login `Connection closed` error did
not block the completed workflow. Updated generic vehicle labels pass web and
native typechecks,26 focused tests and strict native translation coverage681/681;
the web translation audit still records296 unrelated older gaps. Courier OTP
login and physical-device behavior remain untested. Exact local receipts/screens
are under `.local/courier-20261018/` and `.local/business-directory-20261018/`.

## Active implementation — approved workspace layout, demo devices and SEO (October18)

The owner explicitly approved the Marketplace/My workspace merge and seamless
switch on October18. This approves the interface direction, not a hosted rollout
or enabling payments. Preserve the prior planning/audit evidence below. New
requests belong to this ordered implementation, not a replacement task.

- [x] Record owner layout approval and the explicit Email / searched Business
  capacity-share decision. Business permitted staff inherit that capacity grant;
  Tracking location remains a separate named-staff permission.
- [x] Audit existing simulator and phone identity before enabling movement. Found
  forced source/radius changes, no takeover guard and moving manual reports.
- [x] Specify FEAT-SIM-001: exact synthetic scope, sticky real-device takeover,
  private phone installation identity, honest capabilities and actual-source icons.
- [x] Implement/test server arbitration and bounded demo runner; keep every real
  account and erased fictional003 excluded. Rehearsed156–166 on isolated local
  restores; fresh protected backups precede local installation. Actual saved GPS
  movement and phone projection pass; runner is stopped after the bounded check.
- [x] Connect authenticated phone installation/lifecycle and source attribution;
  focused adapter/controller and SQL tests cover driving owners, account changes,
  stale fixes and queued demo races. Physical Android background/takeover remains
  a separate required installed-device acceptance check.
- [x] Implement approved actual navigation and business membership/sharing/
  Tracking contracts in FEAT-ENT order, without dummy enterprise success screens.
  Actual web creation/invitation/staff acceptance, member permission revocation,
  provider→business Capacity grant and independent Transporter search pass.
  Actual web/Expo free Tracking invite/read/revoke and delivered local email pass.
- [x] Research official search-engine guidance and implement useful server-readable
  public copy, titles/canonicals, explicit public sitemap and private/filtered-page
  indexing exclusions without shrinking maps. No fabricated structured data.
  Actual Chrome1440/390px map/navigation/metadata checks pass; production indexing
  and Search Console verification are not claimed.
- [x] Finish actual Chrome/Expo business Team and Tracking back-and-forth: normal
  OTP/terms/create/invite/delivered email/join, read-only staff Account, explicit
  Capacity permission revoke, and Tracking position grant/revoke pass. Exact
  accounts/relationships are in the local owner guide; no mocked success.
- [x] Rehearse/install native customer push-registration compatibility166 with
  own-chat notification scope, live Auth/session/binding checks and immediate
  membership-revocation denial. Physical delivery remains a separate device test.
- [ ] Review newly changed actual screens, then required release gates; prices,
  checkout and exact hosted infrastructure/database rollout remain separate gates.

Owner review of the connected screens was requested October18 with web3100,
Expo8084 and the3137 exact-account guide. It is pending; concept approval is
retained separately. No full release gate or hosted operation follows without
the required review/authority. A one-hour opt-in demo runner was started for
local review only; its safe state is `review-runner-state.json`. It cannot change
source/radius/assignment, target customer accounts, or resume a real takeover.

Current verified evidence: `specs/TRACEABILITY.md` records exact local SQL,
focused tests and actual Chrome workflows. Web `http://127.0.0.1:3100`, Expo
`http://localhost:8084`, and the updated owner-only account guide at
`http://127.0.0.1:3137/` remain local review surfaces. Repeated create/invite runs
respect existing OTP cooldowns; no limit or permission check was weakened. One
earlier generic browser Error was retained and did not reproduce in two later
checks, including exact permission revoke/redirect/restore. Full release gates,
hosted migrations, production, payments, native binaries and physical hardware
remain unverified by this local pass.

## Approved plan — business workspace and Tracking sharing (October18)

Historical planning record: product/architecture/access/UI. Only Loadgistic is in
scope. The owner asked for the web/mobile interface plan **first**, approved its
concept, then authorized the local implementation summarized above.
FEAT-ENT-001 and proposed ADR-081 govern this transition; existing application
behavior remains unchanged until implementation and release. The October15
dashboard/GPS candidate below remains preserved, with its review/rollout pending.

Confirmed direction: retire platform transport-arrangement chat and its special
LOADGISTIC network audience; provide paid Transport Provider and broker/shipper/
receiver workspaces with their own teams; retain free public discovery and
individual email Capacity/Tracking. Provider Tracking creation has one owner
email; that owner may invite route/status viewers. Updated owner answers permit
live location for the owner **and explicitly authorized staff**, from the selected
GPS/phone/manual source, with smaller circles on both Capacity and Tracking.
The latest sharing clarification uses Email address for a person-only grant or
search/select of an existing Business account for its permitted team. Saving
the business grants team access directly; no extra recipient acceptance gate.

- [x] Record current worktree and controlling contracts; audit existing web/Expo
  navigation, identity, sharing, Tracking location, retired billing and Brokerage.
- [x] Confirm radius direction/scope and whether authorized customer staff may
  see live truck location. Do not preserve the superseded owner-email-only limit.
- [x] Draft the common public/workspace navigation, personal/team share boundary,
  recipient/location permissions and ordered implementation in FEAT-ENT-001.
- [x] Incorporate explicit email-versus-business search/selection, including
  permitted present/future staff access and immediate removed-staff denial.
- [x] Prepare desktop/phone interactive layout concepts and run focused Chrome
  interaction/layout checks. They are explicitly not a connected application or
  backend acceptance evidence; owner review is the next unchecked item.
- [x] Owner approved the interface concept and seamless switch100% on October18.
  Email versus selected-business authority is confirmed; no repeat authorization
  of those decisions. Connected actual screens and exact hosted artifacts retain
  their separate review/rollout gates.
- [x] Implement/rehearse additive identity, invitations, lifecycle, sharing,
  selected-source Tracking and compatible Brokerage retirement156–166, with
  negative SQL/API/privacy tests. Preserve software Support/free recipient access.
  All installed only in the protected local preview; no hosted SQL was applied.
- [x] Connect scoped web/Expo screens and run actual role-to-role local browser
  invitation, delivery, acceptance, permission/position revoke and viewer workflows.
  SQL covers source/assignment transitions and old-client denials; physical-device
  lifecycle and full release acceptance remain separately pending.
- [ ] Confirm prices, included staff, billing method, grace/lapse behavior and
  Play-compliant payment flow before enabling commercial restrictions or charges.
- [ ] Owner visual approval → full release gates → exact separately reviewed
  migrations/backup/rollout → verified web and Android publication.

Audit findings: current customer account access is provider/driver-only despite
old SHIPPER/RECEIVER enum values; identity chooses one membership; private grants
are email-only; all guest Tracking roles currently receive location; a free
recipient cannot use profile-FK invite auditing; and GPS/manual source selection
feeds Capacity but not shipment Tracking. Old Brokerage remains accessible through
HTTP/RPC/push/deep links if only its UI is removed. These are implementation
dependencies, not resolved by a new label or this planning document.

No application code, database, accounts, payments, hosted settings or deployments
are changed by this planning stage. Existing review artifacts remain distinct.

Concept review: `http://127.0.0.1:3138/`, isolated under
`.local/enterprise-plan-20261018/preview/`. The top review selector compares six
scenes: Marketplace, provider Fleet, driver map Home, business Capacity, business
Tracking and a restricted viewer. Actual Google Chrome checks pass at1440/390/320
with no horizontal overflow,45 focused assertions,28 captures, zero page errors
and zero requests outside the concept. Permission toggles only illustrate the
planned interface; they do not prove database/API authorization. Receipt:
`preview/evidence/receipt.json`. Root inspected phone sharing/Capacity/Tracking
and desktop Tracking captures; no owner approval or application release follows.
The prototype server is loopback-only3138; actual3100/8084 previews were untouched.

## Earlier task — dashboard structure correction (October15, owner review rejected)

The latest owner screenshots reject the earlier dashboard presentation. The
first pass hid controls inside disclosures instead of establishing task hierarchy;
records still opened in edit mode, and duplicate actions/headings and oversized
empty sections remained. Previous completion evidence is retained below, but is
not visual approval of that layout. Only Loadgistic is in scope.

Classification: UI/workflow defects, navigation/loading and testing handoff.
Contracts: FEAT-UIX/APP/MOB/FLT/GPS/TRK/ADM/SUP/TRQ-001, BASE-FE-001. No business
feature removal, permission changes, new billing or hosted operations are needed.

- [x] Inspect owner screenshots and actual affected source; identify why the
  previous disclosure-only cleanup failed and record replacement acceptance.
- [x] Research primary design-system guidance and assign disjoint parallel work:
  web provider Fleet/GPS; Expo provider Fleet/GPS; admin/staff and web Tracking;
  root navigation/loading, common contracts, integration and owner test guide.
- [x] Latest owner addition: replace database-shaped admin inventories with an
  account-first directory and organized account detail containing its related
  business, fleet, people and work. Separate truck/device lists remain for genuine
  cross-account operational tasks. Reuse bounded authorized adapters and prove
  independent staff permissions; do not merge database identities or invent access.
- [x] Implement named task views, compact saved summaries, one contextual primary
  action and explicit focused Edit/Save/Cancel; preserve existing command logic.
- [x] Repair selected-driver links beyond the first list page through an exact
  owner-scoped reader; preserve page bounds and prove foreign/stale denials.
- [x] Diagnose repeated loading and navigation remounts; fix measured causes
  without weakening identity checks or exposing stale cross-user data.
- [x] Verify actual local demo identities and relationships read-only; produce an
  owner-only practical login/workflow guide without credentials or OTPs.
- [x] Run focused regressions and actual web/phone/Expo interactions; capture the
  changed read and edit states, preserve current server availability.
- [ ] Give owner the working preview, concise change report and account guide;
  obtain explicit visual approval of this corrected layout.
- [ ] Only after approval run full quality/build/CI gates. Hosted schema, gateway,
  new Android binaries and production promotion need their existing exact gates.

Local verified evidence: the final focused selection passes124 tests; root/mobile
TypeScript, source624, specs37 and fixed-copy618/618 checks pass. Actual web
provider Fleet/GPS, thirteen-driver exact selection, admin owner/employee account
relationships and permission denials, Featured/GPS edit/cancel, Tracking correction
persistence and Expo owner/employee walkthroughs pass. Source/evidence mapping is
at the top of `specs/TRACEABILITY.md`. Owner review is not implied by those tests.

The owner-only guide and eight focused views are running at
`http://127.0.0.1:3137/`; guide source/catalog are protected under
`.local/dashboard-restructure-20261015/`. The guide names155 verified local demo
logins and the practical core owner/driver/admin/Support/Brokerage relationships.
Old `LGX-DEMO-0001` has no active recipient grants and is explicitly inspection-only;
full recipient tests require a fresh normal invitation, not invented access.
Web Account/Profile/security pass read/Edit/Cancel at1440/390 with zero writes
or page errors. The original full walk failed its shell identity assertion after
cold development navigation; it is preserved, not counted as a successful run.
Separate instrumented warm Account→Network returns RSC200 and preserves window,
document and exact shell, with no hidden replacement. Network Add contact→draft→
Cancel→reopen restores both fields with zero writes. A direct warmed Network
load200 and dialog interaction has zero hydration warnings. The earlier generic
hydration console event and intermittent dev document timeouts did not reproduce
on the frozen/warmed runtime; their exact cause remains unconfirmed, and a cold
compiled-app console/navigation check remains a release acceptance item.

The client-ready SSR→hydrated dialog proof and human Accounts directory capture
pass. Four additional role-control regressions pass: Customers-only staff cannot
see activation commands for protected admin/staff targets; actual admins retain
staff actions and a Platform team link. No SQL permission was changed.
Owner visual review was requested with the actual review URL; it remains pending.
The final public-login probe exposed another long-lived dev-server stall. Only
its verified Loadgistic process group was restarted; cache, database, Expo and
other apps were preserved. Login then fully rendered200 in3.65s. Restart receipts
are retained separately; this is preview recovery, not a production fix claim.

Remaining limits: native onboarding/assignment acceptance selectors are updated
but their mutation cases must rerun after visual approval; actual driving-company-
owner portrait storage upload and physical Android are not proved by route mocks
or Expo browser. Real GPS hardware and engine interlocks are unqualified. No new
hosted SQL/configuration/server, APK/Play build, release, commit or push occurred.

## Active task — dashboard cleanup and GPS fleet integration (October15)

Owner accepted implementation of the audit below and requested provider fleet
devices, GPS/mobile/manual source selection and compact map-source icons across
web/Expo. Owner also requested engine cut/restore with safeguards defined first;
real relay dispatch is disabled until model/firmware/hardware stationary-interlock
qualification, fresh identity and short-lived command confirmation are verified.
Newest owner clarification removes any need to expose/preserve old Guest support
conversations in the dashboard. Only Provider support and transport arrangement
remain active services. Unrelated chat history must not be erased.

Controlling contracts: FEAT-GPS-001, FEAT-UIX/SUP/GST/ADM/TRQ/FLT/CAP/GEO/SHR/MOB-001,
ADR-080. All pre-existing fleet/release work and pending approvals below remain.

- [x] Record accepted scope, safety boundaries, architecture and ordered work.
- [x] Implement admin/staff queue, Team, navigation/sign-out/context cleanup;
  actual admin desktop/390/320 and staff phone logout pass, focused54 checks pass.
- [x] Retire inaccessible old Guest conversations' actual assigned workload with
  narrowly scoped migration152 and a rollback regression; preserve both current
  services. Local152 is backed up/rehearsed/installed; double-apply rollback
  verifier passes. Hosted retirement remains pending.
- [x] Implement compact provider Fleet, correct document placement, direct Support
  and consistent map Home/controls for employed and owner drivers.
- [x] Implement private device ownership/assignment/source/telemetry/commands with
  RLS, narrow authenticated ingestion and negative concurrency/privacy checks.
  Six actual closure/credential races and exact fixture cleanup pass.
- [x] Prepare isolated pinned protocol gateway, durable bridge, operations and
  explicit device compatibility; provision separate synthetic demos and exercise
  real local protocol/command roundtrips without touching real/hosted records.
- [x] Complete GPS account erasure across application and gateway stores, with
  owner/device serialization and verified exact upstream cleanup before Completed
  (154; actual disposable protocol/disable/erase flow and cached-session denials
  pass; employee closure preserves employer devices).
- [x] Connect web/Expo Fleet/device/source controls and public/private marker
  attribution, retaining exact-vs-obscured coordinates and current-pair rules.
- [x] Rehearse151/152/153 and then154/155 on fresh protected isolated restores,
  including strict catalog/negative/concurrency checks; install only the backed-up
  local preview. Earlier failed fixtures remain recorded. All hosted schema,
  settings and infrastructure remain unchanged.
- [x] Run focused user workflows and capture desktop/phone/Expo layouts: saved
  Manual point/accuracy-only/reload/Cancel and one visible Locate acknowledgement
  pass; separate three-source movement simulation passes.
- [ ] Obtain explicit owner visual approval before full quality/build/CI/release
  gates; no earlier layout approval covers these new dashboards/GPS controls.
- [ ] Complete separately reviewed hosted/infrastructure rollout; real hardware,
  engine-interlock, network capacity and physical Android checks cannot be replaced
  by simulator/browser evidence. No deployment or billing change authorized here.

Local evidence: `.local/telematics/` contains the app151–155 install receipts,
actual protocol/restart/movement/privacy receipts, six app races, the gateway
501-row bound/race/collection-denial rehearsal and strict catalog checks. Actual
browser flows are under `browser/`; focused owner-review captures are collected
in `.local/dashboard-gps-review-20261015/`. Both Account forms load with normal
sessions; the final web console check has no warning/error (an earlier dev issue
badge did not recur and its cause remains unknown). Dirty web/native drafts keep
original revisions and Cancel adopts saved values. Device commands do not erase
source/assignment drafts during an explicit reread. Raw manual inputs are locked
while saving. Public and SQL-authorized private GPS projections pass source/privacy
denials; private-recipient browser coverage has no eligible existing demo grant
and is not claimed. Real hardware and physical Android remain unverified.

Gateway deletion originally returned204 while leaving raw history. Traccar6.3
removed the foreign keys. ADR-080 now permits only narrowly scoped bounded erasure
through a separate private operator; exact pre-delete proof, independent device
scope, zero-data verification and numeric-only collection tombstones prevent false
completion and recollection. Earlier failed fixtures/probes remain recorded.
Production requires separately reviewed infrastructure/identity/scopes, routine
raw-history retention, quotas/alerts, backup expiry and exact SQL/app rollout.
The owner review is the first remaining dependency; new code is not deployed.
Final focused checks:58 GPS/client cases, root/mobile types,585 fixed messages
across four translations,37 specs and the source/whitespace checks pass. Current
source hashes and remaining limits are bound in
`.local/dashboard-gps-review-20261015/completion-evidence.json`.

Parallel ownership: admin/staff cleanup; provider/driver cleanup; GPS server and
private persistence; root integration, source markers, specs, evidence and rollout.
Only `/Users/falmata/Desktop/Dev/loadgistic` is in scope. No Suqpage changes.

## October 15 dashboard usability audit — findings recorded, cleanup now authorized

Owner request: inspect busy/confusing admin, staff, Transport Provider and driver
dashboards; distinguish transport arrangement from Transport Provider support.
This audit is additional work, not visual approval of the pending fleet release.
Only Loadgistic was inspected. Two parallel source reviews and local Chromium
captures covered admin/staff desktop and phone web, provider Fleet/Account,
employed-driver Home/Account and Expo browser previews. Existing local fixture
sign-ins were used and closed; no business records, permissions or hosted systems
were changed. An initial Expo capture was too early and used a second employee
where a driving owner was intended; it is incomplete evidence, not a UI failure.
The corrected capture waits for the actual authorized data response and uses the
fixture's personal-provider identity. A subsequent driver capture selector used
the visible Available space text, but the accessibility name is Update capacity
or Location and availability; source diagnosis corrected that harness mismatch.
Final captures include five employee/driving-owner screens and three loaded
fleet-owner screens, with sessions closed. The24 web captures include a second
employee previously mislabelled driving owner; the manifest now corrects that
classification. Browser preview is not installed Android.

At the audit baseline there were two current services: live transport arrangement handled by Brokerage
(FEAT-TRQ-001), and signed-in Transport Provider help handled by Support
(FEAT-SUP-001). The visible Guest support links lead to retained pre-retirement
transcripts (FEAT-GST-001), not authorized new public-help intake. Its prominent
placement and assigned-agent Live wording incorrectly suggest a third current
service. Preserve original transcript recovery, private files and staff completion
controls; relabel and place retained work in history when implementing cleanup.
FEAT-GST's obsolete asynchronous-intake wording is reconciled with current
FEAT-TRQ; no endpoint or service contract changes in this audit.

| Priority | Observed issue and source | Proposed bounded repair |
| --- | --- | --- |
| P1 | Admin Support combines provider chats, transport-request summary, retired guest history and all platform staff permission forms (`src/app/admin/support/page.tsx`). | Give provider-chat work one clear queue; put Team management in a separate section/tab and retained public chats under history. Keep Brokerage separate. |
| P1 | Staff sign-out is only in the sidebar, which is hidden on phones; staff receive no Account/More control (`src/components/app-shell.tsx`, `src/app/globals.css`). Actual staff phone capture confirms this. | Add reachable staff account/sign-out access at all supported widths. Preserve web-only staff and independent permissions. |
| P1 | Admin phone navigation prioritizes Records/Network/Reviews and hides Support/Brokerage in More (`src/components/app-shell.tsx`). | Make live daily work easy to reach; group occasional management without introducing duplicate menus. |
| P1 | Expo Fleet exposes every truck's publication/edit/retirement tools and every employee assignment/access form in one list (`apps/mobile/src/screens/fleet.tsx`). Actual two-truck preview confirms this. | Use compact truck/driver rows, opening the selected item's existing controls. Preserve explicit Draft/Live and authority rules. |
| P1 | Web's restricted capacity branch replaces the driver's map with a text/duty form (`src/components/driver-capacity-home.tsx`). Source-confirmed; current captured employees have capacity permission. | Keep map Home for restricted employees and expose only permitted location/duty actions; prove both permission states. |
| P1 | Personal Account's Driver documents selects every authorized DRIVER subject; Expo additionally includes provider/company subjects and repeats them in Provider documents (`src/app/app/more/page.tsx`, `apps/mobile/src/screens/account-settings.tsx`, `apps/mobile/src/navigation/document-scope.ts`). | Narrow Account to the signed-in person's driver subject. Keep employee documents with that employee and provider/company documents in their profile. Existing authorization is not a public leak. |
| P1 | Expo's normal member menu has no Support entry; starting help is behind Chat updates then Support home (`apps/mobile/src/components/navigation-shell.tsx`, `apps/mobile/src/session/chat-alert-provider.tsx`). | Give Support a plain discoverable entry; retain the notification bell for updates. |
| P2 | Admin Support lacks the bounded queue refresh used by staff; alerts do not refresh its queue (`src/app/admin/support/page.tsx`, `src/components/chat-alerts.tsx`). | Refresh chat summaries without replacing unsaved team edits; verify actual new-chat arrival before claiming repair. |
| P2 | Back from Support loses queue/page; Brokerage uses an admin Support alias and loses filters; admin Support no longer highlights on its thread route (`src/app/support/[id]/page.tsx`, `src/app/brokerage/[id]/page.tsx`, AppShell). | Preserve validated return context and a consistent active section; do not accept arbitrary return URLs. |
| P2 | Brokerage lists expose assignment, status, notes and conversation actions together (`src/components/brokerage-queue.tsx`). | Prioritize request summary and Claim/Open; disclose the existing management controls when needed. |
| P2 | Driver Home Available space opens multiple capacity/sharing/location settings; employee My truck duplicates Home tools (`apps/mobile/src/screens/driver-home.tsx`, `manage-capacity.tsx`, `navigation/destinations.ts`). | Align labels with the actual task and distinguish Home from truck details; keep right-side map actions and current functionality. |
| P2 | Live dominates Expo truck cards while actual availability is nested; web's empty Retired trucks section is visually oversized. | Show publication and Empty/Partial/Off Duty as separate compact facts; subordinate empty/history sections. Never imply Live means available. |
| P2 | Sharing choices and contact management are on separate screens without a direct native connection (`manage-capacity.tsx`, Network). | Add a contextual link to existing shared-contact management and use consistent terms. |
| P2 | An employee-assigned truck still says Assign an active driver before publishing capacity (`src/app/app/fleet/[id]/page.tsx`). | Show that instruction only when unassigned; otherwise show the actual assignment/next missing prerequisite. |

Standards applied to the analysis: important task-based navigation rather than a
site map ([GOV.UK navigation](https://design-system.service.gov.uk/patterns/navigate-a-service/));
one clear main action rather than competing buttons
([GOV.UK buttons](https://design-system.service.gov.uk/components/button/));
frequent actions visible and occasional controls disclosed on request
([NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)).
These are design principles, not evidence of a usability study with real users.

Audit repair checklist (implemented locally above; owner review remains pending):

- [x] Inspect actual role-specific navigation, queues, fleet/Home and Account;
  distinguish source findings, local rendered evidence and untested branches.
- [x] Record service naming, concrete defects, sources and cleanup priorities.
- [x] Repair the clear access/context/document-placement defects with focused
  regressions before restructuring broader presentation.
- [x] Simplify queues and compact fleet controls while preserving every action,
  independent permission and authority fact. Old Guest workload is retired per
  the newest owner instruction. Actual desktop/phone/Expo review is pending.
- [ ] Obtain the pending owner visual approval and separate exact hosted rollout
  review; the existing provider-fleet checklist below remains active.

Protected audit evidence is under `.local/dashboard-ux-20261015/`:
`rendered-audit.json` (24 web captures),
`native-complete/native-rendered-audit.json` (three loaded fleet-owner captures),
`native-driver-final/native-rendered-audit.json` and `completion.json` (five driver/
driving-owner captures, zero final capture failures, sessions closed). The initial
native manifest is explicitly incomplete and is not acceptance evidence. Recorded
control summaries redact contact details. `audit-completion.json` records scope
and limitations. Spec validation passes36 specs/33 features; changed documentation
passes whitespace checks. Production, Android binaries, hosted SQL, signing and
full release gates remain unchanged. No product-code changes or commit occurred.

## Active task — Transport Provider fleets and reviewed truck authority (October 14)

Owner decisions: all provider owners are Transport Providers and may add multiple
trucks. A driving owner keeps map Home; a fleet-only owner keeps Trucks/Drivers
Home. Employees remain assigned-truck-only. Owned, financed, and rented/permission
are distinct. Permission means drive/manage, never title or licence holder.
One active truck may go Live without document approval. More than one Live truck
requires one current reviewed ownership, or an operating licence reviewed in the
provider's name for their owned/financed truck. Renting/drive permission alone
does not unlock a fleet. Adding, restoring to Draft and publishing are separate.
Owner clarification additionally requires actual user submission/waiting/rejection/
replacement and staff/admin review workflows, not upload-only evidence.

- [x] Record the clarified owner decisions and acceptance contracts before code
  (FEAT-FLT/IAM/APP/VER/CAP/PRV-001, ADR-079; NR-18 supersession).
- [x] Implement provider-owner scope and explicit driver assignments, retaining
  both existing organization and personal-profile identities/history.
- [x] Implement private evidence-backed authority reviews and revocation;
  separate ownership, finance/licence and drive/manage permission facts.
- [x] Add Draft/Live state and publication gate; preserve private sharing,
  unfinished Tracking, proof/history and exact current-pair authority.
- [x] Connect web/Expo signup, fleet, Home, Trust review and public badges/counts;
  preserve personal first-name privacy and employed-driver restrictions.
- [x] Run focused permission/concurrency/SQL/adapter checks against an isolated
  backed-up Loadgistic local environment; install the exact checked source locally.
- [x] Complete actual desktop/phone submission, waiting, rejection, resubmission
  and staff review workflows against the running local web and Expo previews.
- [x] Prepare the authority SQL fixture independently of CI's explicitly reviewed
  seeded providers: create its own synthetic owner/organization/employee and
  simulate two legacy Live trucks inside its rollback transaction, preserving
  every denial, review, paging and privacy assertion. Only fixture setup changed:
  reversing that setup reproduces the exact v3 test hash. Prepared source hash:
  `0948a0ca4fe45af3675d5902f4d8888714bd725d77c3d687e55c5e77d8d17d4d`.
- [x] Run that prepared authority suite on the isolated v3 clone and record the
  new test hash separately; original v3 evidence does not cover this fixture edit.
- [x] Verify a completely new Expo account through real email-code login, Terms,
  signup, first unreviewed Live truck, explicit self-assignment and map Home.
- [x] Capture the completed native signup form for owner review. The earlier
  passing signup receipt predates this added capture, not a product change.
- [x] Reconcile the fourteen changed historical fleet, location and Tracking SQL fixtures with
  explicit ownership basis, Draft/Live and safe assignment rules. Preserve their
  original denials/history assertions; execute only these changed rollback cases
  in the isolated v3 clone. Do not alter seeded Tracking to force reassignment.
- [x] Correct legacy driver labels inferred from provider category and preserve
  authoritatively eligible organization owners in Featured candidates. Prove
  both with focused regressions; retain current document and eligibility gates.
- [x] Repair the five Expo-browser confirmation controls whose native Alert
  adapter is a no-op; prove cancellation leaves records intact and confirmation
  reaches the existing authorized command, without changing the underlying rules.
- [x] Repair stale mobile Home/editor state after a current driver moves from
  truck A to B; use fresh server assignment data, retain employee scope and prove
  the actual reassignment workflow without requiring sign-out or token rotation.
- [x] Reconcile the remaining affected browser fixtures with unified provider
  signup, multiple Drafts, explicit assignment/publication and exact authority;
  preserve original denial, privacy, history and pagination assertions.
- [x] Add direct authority-command negatives for removed Trust permission,
  suspended staff, nonapproved sources, stale revisions and invalid expiry.
- [ ] Keep previews running, capture changed screens and obtain owner visual
  approval before full quality/build/CI/release gates.
- [ ] Review exact legacy-publication impact, hosted SQL, backup/rehearsal and
  rollback with the owner before any production write; no hosted approval yet.

Status: implemented and installed in the backed-up Loadgistic local preview,
production unchanged. Final source145/146/148/149/150 passes a fresh v3 restore,
ten focused transactional SQL suites, exact unsafe-rollback denial, security
catalog checks and real publication/assignment concurrency with exact cleanup.
Read-only reconciliation proves the two extension-view ACL differences are only
pg_restore omissions; main-local installation preserves original permissions and
matches the exact expected candidate catalog. Both previews respond200.

Actual desktop browser workflows now pass: verified owner signup, two Drafts,
unverified employee assignment followed by real email-code login, first free
Live/additional-truck denial, private upload/Pending, rejection/note/resubmission,
generic approval without authority, exact Trust confirmation, additional Go Live,
revocation and replacement evidence with retained source history. A separate
licence case passes actual expiry selection, private-file access and financed
licence confirmation without an ownership claim. Both exact fixture cleanups pass.
Receipts: `.local/internal-workflows-20261014/provider-owner-fleet-desktop-diagnosed-runner.json`
and `provider-authority-expiry-desktop-fixed-runner.json`.

Earlier failed attempts remain failed: hidden-switch interaction, accepting test
consent before employee email verification, misplaced staff-fixture permission
fields and cleanup ordering were harness defects, not production repairs. Their
exact leftovers are separately cleaned. The initial phone run stops before Expo
login because Metro returns500 for an existing newly added component. Only the
verified Loadgistic8084 server is restarted with its project cache cleared.
Actual anonymous readiness then proves bundle200, enabled login controls and no
browser errors. The phone licence and Expo permission-document case now passes
real OTP, expiry selection, private upload/Pending, authorized decoded image and
closing the viewer, with exact cleanup. A fresh phone rerun additionally passes
the compact staff confirmation checkbox's18px geometry,44px label target, actual
label click and persisted review:
`.local/internal-workflows-20261014/provider-compact-review-phone-runner.json`.

The final owner phone case also passes its complete web workflows, Expo OTP/map
Home, two-Live fleet and adding a third permission-basis Draft without assignment.
Returning Home and switching Marketplace/workspace preserve the same sole owner
assignment and a visible390×589 map. Actual telemetry proves the earlier assertion
counted one hidden retained map alongside the visible screen; no app navigation
change was needed. There are zero page errors, unhandled rejections, raster
aborts or fatal overlays in this run, and exact cleanup passes. Receipt:
`.local/internal-workflows-20261014/provider-owner-phone-navigation-runner.json`.
The owner's current Fleet/staff-review visual question is pending. Full release
gates and deployment have not run. SQL/local evidence:
`.local/provider-fleets-20261014/{final-v3-rehearsal,restored-v3-catalog-reconciliation,local-install-v3-receipt,concurrency-v3-receipt,stalled-signup-cleanup}.json`.
Existing uncommitted audit/UI work below is preserved.

The independently scoped authority regression now passes with source
`0948a0ca4fe45af3675d5902f4d8888714bd725d77c3d687e55c5e77d8d17d4d`.
Its exact isolated transaction rolls back; the original v3 ten-suite receipt is
retained separately. Receipt:
`.local/provider-fleets-20261014/provider-vehicle-authority-compatibility-receipt.json`.
New Expo-only account signup also passes with exact synthetic cleanup:
`.local/internal-workflows-20261014/provider-native-new-account-phone-runner.json`.
This proves the actual verified-but-inactive identity accepts Terms before
creating its provider account, and one document-free Live truck can be explicitly
self-assigned without an implicit assignment during registration.
The final capture run also passes the same workflow and exact cleanup:
`.local/internal-workflows-20261014/provider-native-signup-review-phone-runner.json`.
Actual signup/map/Fleet image digests and their originating runs are recorded in
`.local/provider-fleets-20261014/native-signup-review-captures.json`.

The fifteen isolated compatibility cases now pass and roll back, including the
independent authority suite and fourteen historical fleet/location/Tracking
cases. Final test hashes are verified against their receipts in
`.local/provider-fleets-20261014/fixture-compatibility-summary.json`.
Earlier failures exposed stale seed aliases, missing actual policy consent and
unsafe borrowed-driver reassignment in fixtures. They are retained as failures;
the repaired cases use actual invitation/acceptance and owned synthetic drivers,
without changing seed Tracking or inventing document approval. Suspended-inviter
acceptance is still denied by the earlier active-owner lock; its test additionally
proves the invitation stays unaccepted and the recipient inactive before the
owner is restored and normal acceptance succeeds.

WEB-MOB-041 records the two additional local source repairs: neutral Driver copy
instead of inferred legacy categories, and Featured retaining an organization
owner who drives when the authoritative current link accepts them. Driver facts
retain actual-assignment document scope. The final root batch passes42 targeted
adapter/presentation/authority/publication checks, root/mobile typechecks and
36spec/582source checks; counts overlap earlier batches. Receipt:
`.local/provider-fleets-20261014/final-focused-source-checks.json`.

The seven additional historical fixtures are now reconciled and pass against
the isolated v3 clone: capacity-launch-matching, public-provider-paging,
capacity-multiple-options, capacity-viewport, public-capacity-policy-scope,
featured-continuous-rounds and featured-random-rounds. Their original matching,
privacy, paging, fairness and saved/manual-day assertions remain. Obsolete profile
category/evidence expectations now check exact per-truck facts and whole-fleet
counts with equivalent expiry/privacy negatives. The invalid Pickup Truck
spelling remains explicitly rejected; the valid no-match test uses Pickup truck.
No check is skipped or weakened, and these focused cases are not a full release gate.

Next focused compatibility steps (resumed before full release gates):
- [x] Update and isolate the five affected public/matching/viewport fixtures,
  preserving original matching, privacy, expiry and pagination assertions.
- [x] Update the two affected Featured rotation fixtures, preserving advancing
  weeks, fairness, no-repeat and protected saved/manual-day checks.
- [x] Run only these seven changed rollback cases against the isolated v3 clone
  and bind each outcome to its exact source hash. Preserve failed attempts.
- [x] Recheck the synthetic authority-fixture importer and local demo options;
  do not reset the running preview, alter copied records or grant their trucks
  ownership by inference. Production and saved rosters remain unchanged.
- [x] Rehearse an additive local-only demo correction for the nine exact named
  fixture fleet owners: fresh unmistakably fictional private proof files, new
  Pending submissions, ordinary review and exact authority confirmation. Keep
  all original sources, documents, declarations, assignments and saved days.
- [x] Back up the current local database, recheck exact fixture provenance and
  physical identity, install only that rehearsed additive correction and verify
  the existing Featured programme/profile cards in both previews. No hosted write.

Before the additive local correction, the anonymous Featured/card case fails because the
main-local copied demo roster has eight saved slots but no currently eligible
provider/theme candidates and zero exact authority facts. Its multi-Live fleets
are correctly withheld under the accepted rule; generic old approvals are not
backfilled into ownership. Read-only aggregate diagnosis:
`.local/provider-fleets-20261014/public-featured-empty-diagnosis.json`.
Failed browser receipt remains
`.local/internal-workflows-20261014/provider-public-driver-presentation-phone-runner.json`.
This is not a production read or permission bypass. A separate focused case
proves actual Featured candidate/profile behavior using one
owned synthetic public provider/truck, with no document approvals, saved-day
changes or changes to existing demo fleets.
- [x] Verify that fresh single-truck driving owner through actual eligible-link,
  Featured adapter and native public-profile rendering, then exact cleanup.

That actual one-truck/no-document case now passes: the organization owner has no
employee-directory row, the real eligible-link/provider commands and Featured
adapter return their pair, and the anonymous native profile displays first name,
Driver and Not yet verified, with private name/phone absent. Exact cleanup passes;
saved roster days and existing demo fleets are unchanged. Receipt:
`.local/internal-workflows-20261014/provider-featured-owner-current-server-phone-runner.json`.
The first attempts correctly caught a stale running Next module returning the
old Company driver label despite current source. Only the independently verified
Loadgistic3100 dev process is restarted; no cache is deleted and no other server
changes. The fresh API and rendered profile then prove the current label.
Process/capture receipts:
`.local/provider-fleets-20261014/{web-preview-restart,public-owner-driver-review-capture}.json`.

The next focused checkpoint passes22 isolated rollback cases with each current
source hash verified, plus9 guarded authority-fixture checks. Evidence:
`.local/provider-fleets-20261014/fixture-compatibility-summary-22.json`.
Featured's four-week advancing calendar, unequal-pool rollover, nearby fallback,
saved manual days, random draws and partial-save rollback all remain tested.
The 1,002-provider viewport case uses actual write times after assignments and
still reaches its unique match behind1,001 newer authorized records. The new
public paging cases retain all original denial markers and add exact authority,
whole-fleet totals, revoked/expired-source and driver-permission isolation checks.

The local preview demo is now usable again without resetting it. Exact named
fixture metadata and current physical fingerprints bind nine organization-owner
subjects from provider-authority.json. A fresh protected local backup and exact
isolated rehearsal precede nine new unmistakably fictional PDF uploads, byte-
verified downloads, new Pending submissions, ordinary approval and exact review.
Original verification sources, vehicles, assignments, profiles, saved days/slots
and Tracking rows retain identical hashes. No original document is repointed or
deleted; declarations stay unchanged. The initial rehearsal catches the normal
verification/ storage-prefix requirement; its failed receipt remains recorded
and the validator is retained. Plan/rehearsal/backup/apply receipts are under
`.local/provider-fleets-20261014/local-demo-correction-*.json`.
These fictional facts exist only in the local preview and must never be used as
production ownership or operating-authority evidence.

Actual web/Expo phone Featured/profile/card flows and desktop web cards/actions
now pass. The existing current roster again returns eight trucks with neutral
Driver labels. The ordinary local automatic worker creates only two missing
future days; existing saved days and slots stay byte-identical. All seven dates
October15–21 have eight eligible pairs, with no empty day. Receipts:
`.local/internal-workflows-20261014/provider-repaired-demo-cards-{phone,desktop}-runner.json`
and `.local/provider-fleets-20261014/{local-demo-featured-api-readback,local-demo-week-receipt}.json`.
The previous anonymous empty-roster failure remains recorded. Full release gates,
owner visual approval, hosted migration review and deployment remain pending.

October15 continuation finds and repairs two additional client gaps before full
gates. WEB-MOB-043: Home no longer lets the truck ID cached at sign-in override
the sole current server pair, and Fleet editors remount from persisted fields
after an awaited reload. Four real-render regressions plus thirteen existing
owner-presentation checks pass. Actual Expo A-to-B reassignment holds the read
in flight, preserves the selected truck, then shows B on map Home with one saved
assignment and zero Auth refreshes. WEB-MOB-042: a shared confirmation replaces
the no-op React Native Web Alert on five controls. Actual cancel/confirm flows
persist invitation cancellation, driver removal, private-capacity revocation,
Tracking-recipient removal and permitted status-only Tracking cancellation with
history retained. Both cases pass with exact synthetic cleanup and no page errors:
`.local/internal-workflows-20261014/provider-mobile-deep-actions-phone-corrected-runner.json`.
Browser Escape/backdrop and actually painted-overlay checks now also pass, with
zero mutation on dismissal, all five confirmed commands persisted and exact
cleanup. Receipt:
`.local/internal-workflows-20261014/provider-native-confirmation-painted-phone-runner.json`.

The new exact-source rollback suite proves21 authority-command denials for
removed Trust, suspended accounts/staff, rejected/More Info sources, swapped
revisions and missing/past/overlong/malformed expiry. Denied operations preserve
all own source/fact/audit snapshots; valid controls succeed. The aggregate now
contains23 passing rollback cases with current source hashes verified:
`.local/provider-fleets-20261014/fixture-compatibility-summary-23.json`.
The prior22-case evidence remains unchanged. The local no-raw-log browser wrapper
records the initial wrong preview route as failed; its exact synthetic leftovers
are verified removed in `confirmation-first-attempt-cleanup.json`. No production
repair was made for that harness error.

All555 audited explicit native messages, including the new confirmation props,
have all four translations. Dynamic/record copy and linguistic fluency still
need ordinary review; the count does not prove every string in the app. Root and
mobile types and focused lint pass. The remaining changed registration/document/
paging cases now pass: two provider/employee registration controls; all three
public fleet sizes including105 trucks; private document submission and terminal
review; five Expo personal-identity/recovery/photo cases; and all three employed/
OWNED/PERMISSION onboarding flows. The long employed case proves real email
verification, first capacity/GPS, all permission combinations, reassignment reset,
owner-managed capacity/location, contact editing and offboarding. Final receipts:
`provider-document-profile-desktop-scoped-runner.json` (two passing registration
cases; its later paging failure remains recorded),
`provider-document-profile-all-card-scope-runner.json` (five pass),
`provider-native-personal-current-phone-runner.json` (five pass), and
`provider-fleet-onboarding-explicit-empty-desktop-runner.json` (three pass), all
under `.local/internal-workflows-20261014/`.

Failures were classified before changing assertions: registration selected two
valid Add driver links; old onboarding assertions looked for duty in a moved
header and treated a valid Off Duty reset as an incomplete Empty signal; paging
used a single-element assertion for many cards and an oversized cleanup URL.
Current assertions preserve all-card exclusions and explicitly select Empty
before GPS/coverage denial. Cleanup is bounded, retains original failures and
records exact UUID ownership/absence. The prior105-driver paging leftovers are
separately proven absent in `paging-first-attempt-cleanup.json`; source deletion
cascades its synthetic review through existing permissions, never a new grant.
No product guard was weakened for a fixture failure.

Final root typecheck also passes after adding explicit types to the two browser
fixtures. The new annotations change neither emitted JavaScript syntax tree;
the source-to-runtime parity receipt binds the new hashes to their passing
browser runs without repeating unchanged behavior:
`.local/provider-fleets-20261014/final-test-type-annotation-parity.json`.

Owner visual review of signup/Fleet/Trust review/Home/confirmations is pending
at the running3100/8084 previews. Full quality/build/CI and hosted rollout have
not run; there is no new commit, production release or Android artifact.

## October 14 deeper internal-team workflow audit — local verification complete

Owner extension: check the less-used, nested admin, Support and transport-team
actions against what their labels promise. Keep existing features and layout;
repair concrete defects without adding a new product surface. Loadgistic local
services and exact synthetic fixtures only. Contracts: FEAT-ADM-001,
FEAT-SUP-001, FEAT-GST-001, FEAT-FTR-001, FEAT-VER-001 and FEAT-TRK-001.

- [x] Finish the existing bounded staff access cases. Authenticated API, Brokerage and Owner cases pass independently; the final isolated Support maintenance case now also passes create/edit, all seven saved responsibility flags, suspend/restore, explicit revoke, current delegated reads and ordinary mobile OTP WEB_ONLY denial. Exact synthetic cleanup passes. Earlier timeouts/unclassified retries are retained as failed attempts, not product-failure or credential evidence. Final Support receipt: `.local/internal-workflows-20261014/staff-support-final-runner.json`.
- [x] Inventory nested controls, their API/command and durable state, existing acceptance coverage and missing negative checks; source inspection is parallel, the shared browser queue stays serialized. WEB-MOB-031 through036 record the concrete findings.
- [x] Exercise Support/Brokerage assignment, replies, retained history, closure/new-chat, attachments and read/alert boundaries with real local writes and scoped authorization. Passing focused cases cover each step; earlier combined-chain failures remain recorded rather than being relabeled as full passes. Member-Support manual transfer remains a separately recorded absent feature (WEB-MOB-037).
- [x] Exercise Featured manual controls and admin Records/Reviews/privacy maintenance; verify saved state and permitted/denied staff access rather than page-load success. Document, rating, overlapping-moderation, deletion and Featured manual/sponsor workflows each pass desktop/phone. Featured saves draft/published state, exact manual times, sponsor save/disable and revoked-role denial without changing automatic controls. Its new harness initially used an exact label for the nested truck-count select; the existing accessible combobox role resolves that test-only mismatch. Document review's direct-child summary correction likewise changes no product behavior. Actual receipts below; release and visual gates remain separate.
- [x] Extend actual Operations acceptance to Tracking appeal Approve/Release/Dismiss and the existing Driver-permission, Capacity Off Duty and truck-route removal controls. Both cases pass desktop/phone using actual forms, scoped synthetic records, retained proofs/history, current-authority denials and exact cleanup.
- [x] Finish confirmed repairs and their focused workflow checks. Web Tracking honors each server-permitted recovery action (five component and two real role cases pass). Retained-guest assignment waits for hydration (two component and two browser cases pass). Driver-owner links and out-of-range Content/Privacy queues pass16 component checks and four desktop/phone cases. Function-only143/144 are installed locally after isolated SQL/rollback checks and a fresh combined restore/catalog gate (NR-43/44): all1,088 candidate function metadata records match and78 business tables remain unchanged; the original one-row runtime throttle-counter drift is retained. FIFO Claim and overlapping-moderation controls pass both viewports. The additional chat Seen, admin filter and Operations map repairs now pass their focused component/actual workflow checks below. No hosted apply.
- [x] Update traceability, prevention lessons and the actual owner review captures. Local web/mobile previews remain running.
- [ ] Obtain the owner's explicit approval of the current layouts before full quality/build/release gates. The consolidated review question links actual Account and Waiting captures plus both previews. Hosted SQL/fixture changes, exact signing and production rollout retain their separate requirements; this local audit does not authorize them.

Additional bounded finding: admin Private capacity forwards initial repeated
query values and transporter text into truck matching differently from its API
and subsequent map requests (WEB-MOB-038). The local fix reuses the established
validation/error state and preserves the search drawer and permission boundary;
three regressions fail before the fix and all14 focused checks pass afterward.
Two actual desktop/phone cases also pass reload denial, API400, modal correction,
retained search text and canonical API200. Receipt:
`.local/internal-workflows-20261014/admin-capacity-ssr-actual-runner.json`.
No new UI layout or feature.

The deeper Tracking recovery diagnostic passes genuine local email delivery
and code verification, then exposes an actual Operations map contract mismatch
(WEB-MOB-039 / NR-45). The old staff RPC result was passed directly into the new
typed map renderer. The scoped adapter now preserves both database authority
checks and allowlists actual saved route/current obscured-location fields before
conversion; it invents no public truck summary. Six regressions fail before and
all seven pass after the fix. Two actual desktop/phone lifecycle cases then pass
saved three-city route / 20 km circle, correction, reassignment/reset, workspace
correction, retire/restore, forged provider cancellation denial, investigated
cancellation, history and guest revocation with exact cleanup. Current map and
progress-panel selectors replace stale historical test selectors. Receipt:
`.local/internal-workflows-20261014/lifecycle-internal-repaired-runner.json`.
No original email failure cause is inferred and no production change occurred.

Additional Operations Records acceptance now passes both desktop/phone cases:
actual Driver-permission off/on saves, Capacity Off Duty, truck-bound route
removal, provider denial, three revoked stale forms, exact audits and unrelated
record isolation. Exact cleanup/residual checks pass. Receipt:
`.local/operations-connected-actions-20261014/records-controls-desktop-phone-runner.json`.
The first attempt stops before fixture creation because its new preflight
evaluates an unset test-runner NODE_ENV; the corrected explicit test-only argument
changes no process/server setting.

Appeal verification exposes a separate harness boundary: the first observed
development proof fetch has HTTP200 but an aborted zero-byte Playwright body.
The single-object diagnostic proves the acknowledged Storage object, authorized
adapter, served API and actual painted image Blob are all exactly the expected
15,848 bytes. Native URL behavior and CSP remain unchanged; the test observes
only the actual Blob argument, delegates native calls and retains no image bytes.
Receipt: `.local/operations-connected-actions-20261014/proof-boundary-observed-desktop-runner.json`.
The focused staff decision cases now also pass desktop/phone: actual Driver
appeal intake, provider-denied decisions, Approve→Completed with staff approval,
Release→Cancelled without delivery approval, Dismiss→Unloading, retained proofs/
history, exact audit counts, revoked stale forms, terminal replay denial and
unrelated-shipment isolation. Six acknowledged proof objects, three shipments
and six synthetic identities are cleaned per viewport, with exact residual
checks. Receipt:
`.local/operations-connected-actions-20261014/tracking-appeals-final-desktop-phone-runner.json`.
The earlier failed observations remain recorded and are not product fixes. The
wrapped Decision select also required the established accessible combobox role
in the test, not a product-label change.

Final focused source verification passes48 checks, root/mobile types,36-spec/
568-source validation and whitespace. These are limited verification evidence,
not the full quality/build/remote release gate. Both preview HEAD checks return
200. No commit, hosted write, deployment, new APK or physical-device/background
notification result is claimed.

Actual browser receipts: `.local/internal-workflows-20261014/tracking-permissions-final-runner.json`,
`.local/internal-workflows-20261014/admin-connected-complete-runner.json` and
`.local/internal-chat-audit-20261014/readiness/sanitized-receipt.json`.
Installed144 additionally passes four component and two actual desktop/phone
FIFO Claim cases: paused/full workload, tied ordering, page2, forged later claim,
one saved first claim/event/audit, next eligibility and permission revocation.
Receipt: `.local/internal-workflows-20261014/support-fifo-actual-runner.json`.
Basic rating decisions pass two desktop/phone cases, including real owner email
approval, Uphold/Remove notes/context, provider denial and terminal replay.
Receipt: `.local/internal-workflows-20261014/rating-decisions-actual-runner.json`.
The basic-rating harness previously omitted proof-object cleanup; future runs
now retain exact acknowledged paths for cleanup. Unidentified historical objects
are left untouched and are not claimed clean. A fresh focused desktop rerun now
passes the actual decisions and this cleanup:
`.local/internal-workflows-20261014/rating-proof-cleanup-final-runner.json`.
Overlapping moderation passes saved Trust Hide/Restore and rating Uphold/Remove,
canonical public HTML/API text/count/average, stale revoked-authority denial and
exact cleanup. Deletion passes inbox verification, persisted receipt, phone-size
admin processing, private image erasure/Auth anonymization, other-account isolation
and exact residual cleanup. Featured manual controls also pass both viewports.
Receipts: `.local/internal-workflows-20261014/moderation-conflict-actual-runner.json`,
`.local/internal-workflows-20261014/play-deletion-actual-runner.json` and
`.local/internal-workflows-20261014/featured-connected-final-runner.json`.
Waiting's plain identity wrapper/initials retain the linked-row grid alignment;
the fresh phone workflow/capture passes after the two scoped CSS selectors:
`.local/internal-workflows-20261014/support-fifo-alignment-phone-runner.json`.
Support roundtrip confirms replies, private upload/download and scoped handoff
revocation before an unclassified older-history UI failure; an isolated
history/sequence probe passes. Handoff in that probe is an explicit fixture
change, not evidence of an existing member-transfer control (WEB-MOB-037).
Brokerage's focused foreground reply case passes, and receipt-only503 recovery
preserves Sent before real retry saves Seen on Expo/web. Its independent
history-only run passes Refresh/Older/Latest, the original exact cursor assertion,
new-reply isolation and visible Seen. The earlier combined history assertion
failure remains unclassified; it is not used as proof of a product fix.
Focused receipt negatives also pass mobile403, forged400 and stale-assignment409
without changing stored cursors. Public Marketplace alerts preserve unread state
outside the chat. The actual consent-dialog visibility gap is repaired using
the existing authorized poll and guarded reporter: four component and nine
policy checks plus the actual public→own web chat regression pass.

Support Keep/End, Past chat and distinct new request pass before a stale staff
landing-text assertion. The separate staff-Close run then passes real303 to the
correct destination, saved CLOSED and Expo read-only retained history/reload.
Native Brokerage Keep/End, saved access end, ended-send409, retained phone/history,
actual staff Resolved, private-note exclusion and distinct Start-new request all
pass. One inbox alias used as a table column was corrected only in that harness
before its controlled retry. Exact synthetic cleanup is verified for each case;
interrupted fixtures use a protected UUID-only ownership manifest. Receipts:
`.local/internal-chat-audit-20261014/public-receipts-only/sanitized-receipt.json`,
`.local/internal-chat-audit-20261014/brokerage-history-only/sanitized-receipt.json`,
`.local/internal-chat-audit-20261014/support-staff-close-only/sanitized-receipt.json`
and `.local/internal-chat-audit-20261014/brokerage-closure-only/sanitized-receipt.json`.
Neither original full chat chain is relabeled passed. WEB-MOB-036 admin queue
refresh and WEB-MOB-024 driver-handover signal policy remain recorded separately.
Production remains unchanged.

## October 13 account registration and maintenance audit — active

Scope: Loadgistic only, local services and disposable test accounts. The newest
owner request adds less-tested signup, registration, account editing and staff
maintenance without replacing the personal-identity work below. Production is
unchanged. Contracts: FEAT-APP-001, FEAT-IAM-001, FEAT-FLT-001, FEAT-ADM-001,
FEAT-SUP-001 and FEAT-GST-001; prevention rules NR-40 through NR-42.

- [x] Map and independently inspect the user/admin/staff UI, APIs, database commands and existing coverage.
- [x] Repair staff suspension/restoration: preserve all seven responsibilities, lock the staff row before copying flags, and retain chat requeue/audit/denials. Exact owner-approved142 is installed locally after backup and clone rehearsal.
- [x] Block mobile Account Save until the current account's private details load; prove Retry, draft preservation and identity isolation.
- [x] Preserve a committed signup or fleet join after refresh failure and retry only reads; hide an obsolete saved-photo preview after its read fails. Company-only signup fields retain drafts without entering Independent commands.
- [x] Repair the actual new-account sign-out: global member chat/push/location activity waits for server-confirmed ACTIVE. Pending signup/join and independent guest chat remain usable; server authorization and revocation are unchanged.
- [x] Complete20 genuine web desktop/phone cases and8 Expo cases with real Auth, uploads, persistence, privacy and scoped denial checks.
- [x] Finish the remaining independent Support maintenance case. The final scoped case passes all maintenance/current-permission/mobile-denial assertions with exact cleanup. Authenticated-bearer, Brokerage and Owner cases remain their separate passing evidence; a denied request alone is never credential proof.
- [ ] Obtain owner visual approval of the actual account/profile captures before full release gates. A review question is pending; previews remain3100/8084.
- [ ] Prepare separately reviewed hosted SQL/fixture/build operations only after the required gates. Local approval is not hosted approval.

Staff142 evidence: actual old-failing/new-passing SQL, a two-session race,
drift refusal and exact rollback pass on a restored clone. The main installation
preserves all 1,084 prior function/aggregate metadata records except the reviewed
target, adds one owner-only backup, and changes no recorded rows or ledger.
Rollback-only staff and141 integration pass with all 1,085 installed metadata
records preserved. Unchanged retired-billing SQL passes with plans disabled,
preserving historical billing rows. Receipts:
`.local/staff-active-permission-142-retry-20261013/evidence.json` and
`.local/staff-active-permission-142-20261013/main-install-receipt.json`.

Actual web evidence: 14 identity/photo/grouped-workspace/normal-signup cases plus
six email-change/closure/fleet-access cases pass across desktop and phone. Normal
Company and OWNED-Independent signup creates zero subscriptions. Company signup
also exercises unverified-driver assignment, that driver's email-code access,
valid Tracking permission denial with no shipment, location, publication and
reassignment. Email change confirms both inboxes, target binding, saved Auth and
profile identity; closure preserves history and denies later access. Fleet-form
navigation is not an actual replacement write. Receipts:
`.local/personal-identities-web-141-20261013/web-evidence.json` and
`.local/account-maintenance-web-20261013/evidence.json`.

Actual Expo evidence: 8 distinct cases pass signup/Join, initial-read Retry,
committed-save recovery, account/public-phone editing, separate real Driver and
provider photo upload/replacement/Keep/Remove, private-file painting, public
privacy, session recovery and390/320 Featured/profile/map details. Faults affect
only read/refresh transport; writes are real. The exact new-account failure was
verification 200/ONBOARDING and policy 200 followed by chat/handover
403/ACCOUNT_UNAVAILABLE, then a cleared client session. Three client guard lines
fix the lifecycle error;6 provider-component cases fail before/pass after,
26 activity/controller/chat/background checks and37 identity/editor checks pass.
Root/mobile types, scoped lint, 36-spec validation,23 targeted localization/API/
image/editor checks and whitespace pass. Receipts:
`.local/workspace-activity-scope-20261013/evidence.json` and
`.local/personal-identity-20261013/native-acceptance-receipt.json`.

The expanded staff run supplied both responsibilities' create, maintenance,
suspend/restore, explicit revoke and ordinary mobile OTP denial evidence, with
all14 recorded queue/Featured statuses matching without following redirects.
Its extra401 bearer result was not accepted as authenticated403. A separate
positive Auth/projection probe now passes12 direct/wrapped/refresh WEB_ONLY
denials. Independent Brokerage and Owner browser cases also pass. Support's
split case had a navigation timeout and an unclassified permission-edit failure.
The final granular isolated Support case now passes, preserving all seven flags,
explicit revoke and ordinary mobile OTP denial. Exact synthetic profile/Auth/
permission cleanup passes; no product permission was weakened. Receipts:
`.local/account-maintenance-staff-split-final-20261014/evidence.json` and
`.local/internal-workflows-20261014/staff-support-final-runner.json`.

Coverage limits remain explicit in WEB-MOB-024 through030. The shared seeded
provider helper still inserts historical sponsored subscriptions; normal signup
is the separate plan-free proof. Driver-change signal inheritance needs its own
policy/runtime fix; installed Android, physical dialer/GPS/push, native actual
truck replacement and the later5,000-truck scale gate are not inferred from web
or Expo. External OSM tiles are mocked only in the existing Company Driver
permission context, not claimed as physical location or tile-delivery evidence.

## October 13 personal identity and portrait separation — active

Owner clarification: restrict personal public details to first name, an existing
handle, explicit public contact number and optional photo; retain company business
information. First name and Last / father name are separate entry fields. Existing
private full names/history and authorized fleet management remain intact.

- [x] Inspect current signup/account commands, public projection paths and separate image storage; record FEAT-IAM-001 / FEAT-PRV-001 acceptance before code.
- [x] Backend source and isolated rehearsal: add compatible structured personal-name/callback contracts and one safe public projection; prove permission, Unicode-whitespace and private-data denial across profile/search/Featured/capacity/guest Tracking.
- [x] Frontend source and focused checks: reuse own-driver/transporter upload controls, separate first/last-father entry and explicit public callback editing; add role-specific blank icons and distinct driver/provider display images on web/mobile. Genuine browser workflows remain a separate step below.
- [x] Prepare disjoint credential-free demo picture assignments with some blanks; apply only the exact local preset corrections, preserving existing uploads and all other fields.
- [x] Rehearse additive SQL locally and apply the exact owner-approved141 to the local preview; verify all four rollback-only SQL checks and preserved historical data/permissions.
- [x] Finish genuine edit/reload/upload workflows and capture desktop/phone/Expo states;20 web and8 Expo cases pass as detailed above.
- [ ] Obtain owner visual approval of the account/profile captures; the review question remains pending.
- [ ] After approval run full gates and prepare exact hosted SQL/fixture/build/signing reviews; this checklist grants no hosted write.

Audit findings: public reads split names inconsistently and can publish an
independent provider's personal legacy business-name copy. Existing uploads are
subject-separated, but21 Driver preset assets reuse transporter photographs and
no demo transporter is blank. Own-driver callback editing is missing from Account;
its private account phone must never be reused. No employee personal handle exists
today, so none is fabricated. Backend and frontend work have nonoverlapping owners;
all browser jobs are serialized against the existing Loadgistic previews.

Initial focused evidence:33 backend checks,16 web editor/presentation checks and30 native
identity/card checks pass. Root/native types, scoped native lint,36-spec/568-source
validation and five localization checks pass. Final141 passes actual isolated
identity, account-erasure, synthetic public-privacy and unchanged140 SQL checks.
All21 original function owners/permissions/settings and historical rows remain;
six new helpers are service-only and backups are owner-only. Post-use rollback
refuses before changing saved identity; pre-use rollback restores exact originals.
Two draft SQL source errors were caught and atomically rolled back in the clone:
parenthesize a CASE expression and replace a complete coupled expression rather
than executing an invalid intermediate definition. Backup names use a short
suffix within PostgreSQL's identifier bound. No main/hosted incident occurred.

The local preset operation changes45 Driver picture values and five transporter
preset values, leaves an existing user-uploaded transporter image untouched,
and preserves all other profile/page data.24 Driver photographs and transporter
photographs now use disjoint fixture pools; some subjects remain honestly blank.
Source mappings and the local correction are distinct from any hosted demo update.

Bounded143-fixture clone timing, three samples per read, shows added median cost:
public page134→162ms; public searches254→374ms and331→463ms; private
searches125→268ms and172→330ms. The130 document-scan guard remains intact;
unpaged search candidate construction needs the later scale gate. This is not a
5,000-truck performance pass, and no discovery reduction or extra user click is
introduced to hide that cost.

Protected rehearsal receipts:
`.local/personal-public-identity-141-20261013/evidence.json` and
`.local/personal-identities-141-20261013/preset-operation-receipt.json`.
The owner explicitly approved the exact local preview141 update after automatic
review rejected the first attempt before execution. The exact141 local install
now passes27/21/6 function/permission integrity and all four SQL regressions;
historical identity/routes/Services and ledger gap remain unchanged. Public read
readiness is200. Genuine identity browser verification passes as detailed above;
hosted141, visual approval, full release gates and matching Android remain pending.

## October 13 transporter-profile and route ownership cleanup — active

Newest owner instructions: About is enough descriptive provider text; remove
Transport services, provider Regular service and the bottom booking-checklist
block. Put a transporter-scoped See trucks on the map action above its fleet.
Keep contacts, documents, reviews, fleet disclosure and truck-specific details.

- [x] Inspect actual stored ownership, commands and every route projection; record FEAT-PRV-001, FEAT-CAP-001 and FEAT-FLT-001 acceptance before code.
- [x] Implement provider presentation/editor removal and retained Services save/projection contracts; focused application checks pass.
- [x] Implement pair-scoped regular reads/writes, retained unbound history and stale/unauthorized denial; final frozen140 passes isolated rehearsals and is installed only in the shared local preview.
- [x] Verify public/private pages, clusters, search and Featured never inherit another truck's route; exercise actual scoped save/remove and preserved profile/fleet behavior.
- [ ] Translate the map action, capture web/phone/native previews and obtain owner visual approval before full release gates.
- [ ] Prepare exact new migration/compatibility/backup/rollback review; no hosted write or new Android signing is authorized by this local checklist.

Focused application evidence:48 backend/API/projection checks,11 frontend
component checks and4 additional native profile-card checks pass. Root/native
types and36-spec/564-source validation pass. Two web single-truck profile cases
and one Expo profile/map-link case at390/320 passed before140 installation.
Final140 focused browser evidence now passes15 actual cases: seven scoped
CRUD/regular-location/shared-leg cases and eight profile/localization/summary
cases. Actual scoped save/update/remove preserves the other pair, legacy rows
and current capacity; the original shared-leg separation/taps/camera assertions
remain. Profile headings render all five languages and the native map link is
usable at390/320. No full release or installed Android verification is inferred.

The first isolated140 rehearsal passes all scoped commands, public/private
projections, actual cluster totals and Features privacy negatives. A test initially
used older cached city coordinates; it now uses the command's authoritative
catalog-resolved coordinates and explicitly proves A's route inside and B/current
geometry outside. An actual rollback attempt after a synthetic bound save is
refused without changing the row, functions or index. Pre-use rollback restores
all17 original function definitions/ACLs/owners/settings exactly. Final140 also
adds existing public sharing/moderation guards to a retained server-only cluster
function; no current HTTP/page/native caller enables its overview mode. That
last guard change passes its fresh isolated rehearsal and shared-local rollback-
only regression. The exact before dump is protected; original function owners/
ACLs, route/Services fingerprints and the existing migration-ledger gap remain
unchanged. No ledger replay, role normalization or hosted write was performed. Evidence:
`.local/truck-regular-service-140-20261013/` and
`.local/truck-regular-service-140-fresh-20261013/`,
`.local/truck-regular-service-140-preview-20261013/evidence.json`,
`.local/truck-regular-140-20261013/application-evidence.json`,
`.local/truck-regular-editors-20261013/final-workflows/` and
`.local/truck-regular-140-profile-final-20261013/`.

Harness-only corrections remain recorded: a nested form locator failed despite
both correct scope fields; it now inspects each SAVE/REMOVE form explicitly. A
replacement overlap fixture added a transverse long-distance segment; restoring
the original regional four-city geometry preserves the intended shared-leg test.
The root browser failed before page launch under the sandbox, then all eight cases
passed in the permitted local browser environment. No product assertion, timeout
or map algorithm was weakened to obtain these passes. Current identity/avatar
work supersedes these profile captures; recapture before owner visual review.

Inspection confirmed existing profile_routes already have nullable truck/driver
columns, but current commands and projections ignore them. Reuse those columns;
do not delete, clone or guess the truck for old unbound routes. Existing Services
omission currently becomes an empty string, so simply hiding its editor would
erase data. Change that save contract along with its retired public/search use.

Separately recorded for a later focused handover-policy/safety review: final fleet assignment
commands leave the previous driver's vehicle capacity snapshot in place; new
eligible assignments can expose it under the new driver's identity. Independent
truck replacement already isolates records correctly. This predates the profile
cleanup; distinguish intentionally retained vehicle facts from driver-specific
ones and record exact behavior rather than silently
claiming all current-capacity handover behavior is fixed here.

## October 13 Transporter search refinement — active

Newest owner clarification: truck filters do not constrain transporter search.
Only the explicit Show trucks action connects a result to the map. Preserve
eligible available-truck and public/private authorization requirements; retain
the current map filters when explicitly selecting a transporter for the map.

- [x] Record the independent profile-search contract in FEAT-MKT-001 before code.
- [x] Remove truck/map fields from profile-search requests on web and mobile, and prevent map-filter changes from restarting an unchanged profile search.
- [x] Verify independence with restrictive filters, existing blocked profiles, explicit Show trucks and actual local APIs on both previews.

Inspection found an additional required web boundary: applied map-query changes
key and remount the existing map/feed state, which also currently owns search.
Retain that map reset behavior, but move the typed search draft/drawer/debounce
and request-worker lifecycle above the keyed map child. The existing search
section is rendered back into the same drawer through a typed render callback;
it must render the map even while search is inactive. Explicit Show trucks closes
the drawer and uses current map filters. No global/persisted result cache, new
dependency, provider, API or authentication change is needed. Focused tests must
prove worker/query/page/results survive map-filter navigation while changed
public/private authority still discards old scope.
The original filter form also performs a full-page GET; keeping a stable outer
worker alone cannot survive that reload. Intercept only its valid JavaScript
submit using the existing Next router with the same FormData/action and server
validation, retaining the normal GET fallback. Preserve all hidden identity,
private-view, multi-selection and location fields plus map reset behavior.
Implemented with the installed Next Form router, unchanged action/fields,
prefetch disabled and scroll preservation. Latest source checks:11 web worker/
controller regressions and11 native search regressions pass; shared3 and retained
native5 checks remain. A genuine320px web case and390px Expo case each pass:
identical profile results/count/page survive restrictive map filters without
another automatic profile request, and explicit Show trucks retains those map
filters and adds the chosen identity. The earlier six browser cases preceded
this final independence boundary and were not rerun. Root/native types, focused
lint, translations and whitespace pass. Updated unedited captures:
`.local/transporter-search-20261013/{web,mobile}-independent.png`. Independent
search and map empty-state guidance now say which control actually changes each
surface. Visual approval, full gates and publication remain pending.

- [x] Record the owner's input-clear, Transporter search naming and results-as-you-type request in FEAT-MKT-001 before implementation.
- [x] Add visible input clearing and bounded, cancellable live search on web and mobile; keep map filtering independent.
- [x] Inspect existing public/private search cost and authorization; verify page reset, stale-response denial and request coalescing with focused checks.
- [ ] Translate changed labels, capture desktop/phone previews and obtain explicit owner visual approval before full release gates.

Recommend that employed drivers appear with their truck's approved first name
and public contact, linked to their transport company's profile; independent
drivers retain their own transporter profile. This recommendation has not changed
driver identity, data exposure or existing profile/search eligibility.

Local search read checks retain only statuses, counts and timings in
`.local/transporter-search-20261013/`. Six public API queries return200 with at
most15 items; both unverified private routes return401. Four SELECT-only local
database timings are1.35–2.04seconds, which justified one actual in-flight
request with latest-query coalescing instead of abort/restart on each keystroke.
These are bounded local observations, not production throughput certification.
No server, schema, authorization, rate limit or hosted setting has changed.

Focused checks pass:8 web worker/form regressions,9 native search regressions,
5 retained native map/layout/access checks and3 shared query/translation checks.
Native regressions reproduced and corrected close-animation, marker-close,
private pause/resume and retained-screen focus races before release. Two genuine
Expo phone browser cases pass, including English390/320, Amharic320,44px clear
targets, stable map requests/canvas and no page errors. Web actual-API desktop/
phone cases pass; all4 distinct web browser cases pass, including desktop/phone
queue, composition, clear, pagination and camera/filter preservation.
Current catalogs cover510/510 explicit native messages; dynamic/raw content and
fluent-speaker review remain separate. Root/native types, focused native lint,
36-spec checks,564-source checks and whitespace pass. Ranked-search browser
scenarios now enter meaningful text rather than submitting an empty input;
their full-suite run remains after visual approval. No full gates or publication.

Presentation follow-up noted during capture: web retains a location-retry
control inside the transporter drawer. Its map-location purpose belongs with
location controls rather than profile results; consolidate it in the continuing
interface cleanup while preserving the action and the two requested map-entry
buttons. It is pre-existing, unchanged by the live-search refinement.

## October 13 interface cleanup — active

Owner rejected the multi-filter/map visual review and requested deliberate cleanup
of public web, phone web, mobile and admin presentation. Preserve features,
workflows, permissions and existing navigation. Controlling spec: FEAT-UIX-001.

- [x] Inspect About, Featured, selected-truck/profile cards and admin queues;
  identify repeated explanations, cramped facts, oversized mobile cards and
  prominent internal identifiers. Assign nonoverlapping files to collaborating agents.
- [x] Root: compact audience-led About, remove its duplicate language selector,
  audit ordinary-user copy/errors and current Play screenshot sources.
- [x] Cards: improve native Featured/truck/profile hierarchy and focused web
  presentation without changing data, map behavior or available actions.
- [x] Admin: group facts/actions, shorten repeated guidance and improve record
  labels while preserving all form fields, permissions and confirmation safeguards.
- [x] Integrate all five languages; run focused workflow/responsive checks;
  recapture genuine screens and keep both previews running for owner review.
- [ ] Obtain explicit visual approval, then run full release gates and prepare
  exact remaining SQL/build/signing reviews. No new hosted write is authorized
  by this presentation cleanup; migration137 is already live independently.

Local card testing also reproduced a shared public-profile503: an active truck
has a null optional platform number, but the fleet adapter rejects the entire
profile. FEAT-PRV-001 now records honest optional-number rendering and distinct
map-row state; implement and prove it without weakening required-field/identity
validation, inventing numbers or changing records. Reproduced503 now returns200;
the valid null remains null/blank rather than a manufactured public identifier.
Eight adapter/web-component checks pass, including two renderer regressions red
before the fix; existing numbered/null profiles pass the actual desktop/phone
check. Public document/contact scopes and twelve-row paging remain intact.

Cleanup evidence:17 staff/copy/localization tests,8 fleet adapter/render tests and
9 native card/selection/layout checks pass. Actual browser workflows:6 About
(all five languages and reviewer sign-in reachability),3 admin,9 public/native
card/recovery/language cases and1 legacy fleet case pass across targeted runs.
The original failures remain classified: missing native-only menu labels in a
web-catalog test, hidden-button measurement, real320px Brokerage overflow,
unused deep-link filter assumptions, retained hidden canvases, a bounded pending
Back refresh, and the real nullable-number profile defect. No check was suppressed
or product timeout extended. Root/native typecheck, native focused lint,36-spec/
561-source checks and511/511 explicit native translation boundaries pass.
Dynamic/user content and fluent-speaker acceptance are separate from that count.

Curated genuine browser review images: `.local/interface-cleanup-20261013/`;
admin receipt: `.local/ui-admin-cleanup-20261013/evidence.json`; card captures:
`.local/ui-card-cleanup-20261013/`. Owner visual review is requested; full gates,
replacement standalone Play captures, exact SQL/signing approval and publication
are not completed. No hosted writes, account/role changes, new business records,
pixel-edited screenshots or commits were made by this cleanup. Both previews run.

## October 13 recurring Featured gap — active

Ordered task ownership and dependencies:

1. Featured: restore automatic nonempty themed days, verify advancing weeks,
   preserve manual work/history, then prepare exact protected hosted repair.
2. Tracking: persist pickup → via city → delivery for new shipments; add private
   route/location maps, readable progress, proof modals and public-safe contact
   details. Legacy two-city shipments and current privacy/access rules remain.
3. Capacity: move people/company search inside its drawer, leave map filtering
   to truck filters, apply a profile to the map only by its explicit action,
   maximize map space and repair the selected-truck exit hit target.
4. Integrate shared map/contracts without overlapping edits; complete all five
   languages, focused browser/native/API/SQL checks and local owner visual review.
5. Extensive release gates and exact database/build/deployment reviews only
   after their prerequisites pass. Never hide the earlier Featured fix behind
   a later UI feature or equate local implementation with live publication.
6. October13 follow-up: support multiple choices in meaningful truck-filter lists
   on web and mobile, matching any choice within a group while retaining every
   other filter requirement. Inspect API/SQL compatibility, record changed contracts,
   test combined public/private matches, then capture and review the changed UI.
   Keep shipment endpoints/distances coherent and every selected document required.

- [x] Record the multi-selection request in FEAT-MKT-001 before implementation.
- [x] Inspect and agree the smallest shared query/matching contract and exact file
  ownership; implement multi-option lists and bounded compatible backend matching.
- [x] Verify combined filters, private access, invalid inputs, pagination and reset
  on web/mobile; provide focused local previews for owner visual approval.

Multi-option local evidence: migration139 patches the installed public-map,
profile-search and private-match functions; OR within configuration/status/load/
stop/freshness groups, AND across groups and all required documents. Bounded
canonical CSV preserves scalar clients and cursor order. Shared preview was
backed up before139; production is137 after the separate Featured repair. Twenty backend cases, three web
control cases, fourteen native contract cases and two real-component state cases
pass; native types/lint and505/505 fixed-message translations pass. Independent
review caught missing profile-search validation and excessive blank inputs;
their negative tests fail before and pass after repair. SQL proves real public/
private/profile matches, routes, document requirements, paging and denial of
revoked, hidden or inactive records. All14 distinct visible web/Expo cases pass
across the initial run and focused reruns. Expo checked-state accessibility is
repaired; actual images load, native/phone controls remain usable at390/320 widths.
The owner visual review request links current curated screenshots and live URLs.
No hosted139, visual approval or new Android publication is claimed.

- [x] Reproduce web/native public responses: today's Featured is HTTP 200,
  unpublished, with zero trucks. Requests are dynamic and not cached.
- [x] Read-only pinned-project diagnosis confirms AUTO/READY, target eight,
  131 eligible pairs and five remaining mini-truck pairs in the global round.
  All fifteen eligible vans have appeared, so Tuesday and four following themed
  days are intentionally left unscheduled by the current global rule.
- [x] Owner delegates the best rule that keeps days populated and chooses those
  still waiting in later weeks. Use independent truck-type rounds, filling up
  to eight with genuine distinct Drivers; retain saved manual days/history.
  Sunday selections count toward the same truck-type rounds. No remote
  data/settings write is made by diagnosis.
- [x] Add advancing-calendar/unequal-theme regression, implement the approved
  selection correction, verify local SQL/security/workflows, then prepare exact
  hosted SQL/backup/rollback review before any hosted correction.
- [x] Repair the separately reproduced native empty-error response so failure
  cannot hide retry; preserve programme and navigation on failed refresh.
- [x] Obtain exact137 hosted-repair approval: owner answered “Approve the Featured
  repair” October13 for the reviewed SQL/backup/rollback and one generation call.
- [x] Correct the requested map coverage before another local visual review:
  Capacity extends behind the floating transport-chat launcher; unverified Track
  has an empty map background behind its email form. Web and Expo mobile.
- [ ] Obtain visual approval of those corrected layouts, then complete their full
  gates. Prepare the independent137 candidate and required security/CI gates now;
  the Featured repair does not wait on unrelated layout changes.

Local evidence at October13:

- Implemented137; reproduced `CONTINUOUS_TODAY_NOT_FILLED` before it, then
  eleven SQL suites and both exact rollback rehearsals pass on the fresh isolated
  restore of hosted ledger136. Backup and grants verified; no hosted writes.
- Implemented138 three-city routes and safe maps; an independent review fixed
  whitespace surname exposure, moderated/demo contacts, invalid correction
  coordinates and native modal blur. Six real local browser/Expo workflows pass
  (two intentional desktop skips for phone-only cases); OTP and private Storage
  were exercised. Corrected browser header scoping now permits real basemaps;
  both desktop/phone Tracking recaptures wait for visible map tiles to load.
  The final queue caught missing Retry after a malformed native Tracking refresh.
  The fix passes three component cases and both actual desktop/phone email-access,
  failed-refresh, retry and close workflows, with private content cleared on error.
  Independent review also found first-location/route-correction camera fitting
  was initial-only. The stable-map repair passes six component cases and preserves
  camera on ordinary refresh. Actual Expo browser checks fit a first saved area
  outside the original route while keeping the same canvas; later updates keep
  the existing city screen positions. Native command failure is bounded to one
  later-frame retry; nine camera cases pass, including throws, rejected commands
  and an older failure arriving after a newer route request.
- Native API empty-error repair passes six desktop/phone recovery checks.
- Capacity people-search/truck-filter separation implemented; three focused
  browser failures exposed missing translations and a phone zoom-button overlap.
  Both are repaired; all12 focused desktop/phone web/Expo cases pass, including
  explicit profile map actions, preserved searches/filters, dismissals and
  privacy-preserving US visitor-location filters. Clean basemap captures exist.
- Native selected-truck exit is independent of the MapLibre hit registry. Real
  component regression fails before and passes after; camera restoration tested.
  Installed Android center/edge touch acceptance is still pending.
- The integrated focused browser queue passes28 cases with two intentional
  phone-only desktop skips after the two Tracking recovery reruns. Separate
  painted web-map recaptures pass2 cases and first-location camera behavior passes
  one additional Expo case. These are preview checks, not full CI
  or installed Android acceptance.
- Shared local preview DB was protected and updated only with137/138. Its older
  ledger drift was not used as clean-rehearsal evidence; hosted snapshot136 was
  restored to `loadgistic_release_20261013` for that separate proof.
- New138 creation must be coordinated with the updated Android binary: installed
  1.0.6 does not send a passing city. Do not deploy138 ahead of compatible clients.
  Featured137 can restore existing clients independently.
- Visual approval, full release gates, exact hosted SQL approval, signing approval
  for a new binary and publication of this continuation are not yet completed.

Previews: http://127.0.0.1:3100 and http://localhost:8084.
Protected aggregate evidence: `.local/featured-20261013/read-status.json`.
Additional blocked-manual-roster projection and generation-eligibility findings
are recorded for focused follow-up; they are not asserted as today's live cause.

October13 owner follow-up: exact137 approved; visual review requests more map
coverage. Web/Expo now extend Capacity behind floating chat and show an empty
Tracking basemap before email verification. Focused component checks pass;
all four desktop/phone web cases and both Expo phone cases pass with actual tiles.
The narrow-phone drawer scrolls its actions into view above chat; the chat touch
region leaves attribution clear. Screenshots are retained for owner review.

Independent Featured-only candidate `d3b7f1d` is committed/pushed on
`fix/featured-continuous-20261013`, with no138 or new map layout. Full local
quality passes496; a fresh isolated hosted136 restore passes seven Featured/
catalogue suites, the security guard and exact rollback (nine checks total).
CI `38448023976` failed because its fixtures were imported after137, while an
assertion incorrectly expected those newer rows in the earlier migration seed.
The actual approved SQL remains unchanged. Follow-up candidate `1a158f8` executes
the exact seed against rolled-back pre-installation fixtures, with deliberate
missing-source failures; all499 local quality tests pass. Its complete CI rerun
is running as38454443547. Native boundaries, validate (including all SQL and
exact bootstrap probes), build and container pass; browser shards remain pending.
Live security is connected: ledger136/catalogue pass, zero ERROR, two existing
WARN and44 INFO. The owner approved the Featured-only known-warning exception;
the unchanged strict monitor remains failed/visible. Only137 plus one generation
may proceed after remaining CI/drift gates. No138/139/settings write is covered.
No hosted write occurred while preparing that candidate.

Featured137 is now live: exact source1a158f8 / CI38454443547 all eight jobs pass;
the approved transaction committed19:55:47UTC. One generation created five missing
days and kept two saved days; all existing days/rosters/history/controls passed
preservation checks. Aggregate readback shows all seven upcoming dates published,
each with eight distinct eligible Drivers and no invalid pairs. The live Android
endpoint returns200/published/eight trucks. Ledger137 and catalogue pass; the two
approved WARN findings remain visible and the one-use exception is consumed.
New Tracking138, filters139, map layouts and a new Android binary remain local.

## October 12 Android test release

Android **1.0.6/code 7** is available to Internal testers at
https://play.google.com/apps/internaltest/4700942405023499701. The exact Alpha
closed release is submitted; independent Google readback confirms **Changes in
review**, with quick checks completed and no unsent changes. All 12 real tester
addresses are saved/selected. Google approval and actual 14-day enrollment are
external; public Production stays empty. The actual future closed opt-in link is
https://play.google.com/apps/testing/com.loadgistic.app.

Final runtime `04e27fe` passes CI `38297279274` (all eight jobs), 165 mobile tests,
native types/lint and installed ordinary login/consent/grants/two-area switching/
map Home/foreground-service cold restoration/sign-out checks. The existing-key
signing approval is consumed once, private material removed and remote
associations unchanged. Exact APK/AAB payload, permission and structural 16KB
checks pass. Both native sessions are closed. Physical moving-GPS, closed-phone
push and physical 16KB acceptance remain separate.

Approved icon, regional graphic, four actual native screenshots and both
location declarations are saved/verified with real anonymous video. The
installer at port 3136 serves the final signed APK; Loadgistic's four local
admin/log containers are restored. Web remains live at https://loadgistic.com,
`3c13f4b` / Netlify `6acc19b721f9d03af4a8246c`, ledger 136. Previews remain
3100/8084/3135. Exact artifacts and evidence are in
[MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md) and
[GOOGLE_PLAY_SETUP.md](operations/GOOGLE_PLAY_SETUP.md); protected receipts use
`.local/mobile-completion-20261012-*`. Other projects and pre-existing
`.next-upload-audit/` / `apps/mobile/.claude/` are untouched.

## October 11 release outcome — historical

Verified runtime `3c13f4b` is live at https://loadgistic.com / Netlify
`6acc19b721f9d03af4a8246c`; exact CI `38180627163` passes all eight jobs.
The failed map-spacing predecessor was not promoted. Root quality 496/mobile 149,
actual prebuilt/compiled checks, live desktop/phone workflows, eight Featured
cards and 75 private role/isolation checks pass. Hosted ledger stays 136 and final
security has zero critical findings. No SQL, settings, billing or existing-key change.

Owner chose local Android building after Expo quota rejection. Standalone 1.0.5 /
code 6 passes compiled permission/alignment/source checks, installation/COLD launch,
public navigation, normal synthetic driver login, map Home and shipment details.
The owner then approved one bounded use of the existing Expo upload signer.
Application entries remain identical after signing, compiled checks pass, and
temporary private files are removed; existing remote associations are unchanged.
The signed APK-only phone download runs at port 3136. It can update an Expo-signed
install; a Google Play install must use Play's separate app signature.
Google now confirms **1.0.5/code 6 is available to internal testers**, track
4700942405023499701/release 2. No new Expo cloud job exists. Alpha is an inactive
code-6 Draft and public Production is empty. The upload timeout was inspected and
its exact hash confirmed before any further write; it was not uploaded twice.

Approved regional listing copy/graphic are saved and independently reloaded as a
Play listing; Publishing overview confirms it is not yet submitted for review.
Existing screenshots/icon are preserved. Full Play publication, final standalone
store captures, a qualifying policy-video URL, physical GPS/push/16KB acceptance,
actual tester enrollment and social accounts remain separate. An additional real
emulator permission recording reached disclosure and Android grants but a refresh
timeout returned to sign-in; a single cold restart did not prove the background
service. Host normal login/refresh/logout pass. MOB-QA-001 in MOBILE_IMPLEMENTATION
records the observed transient-refresh behavior without inventing a web defect.
No 14-day clock or social post is claimed. Exact artifacts and evidence are in
MOBILE_IMPLEMENTATION, CLOUD_HANDOFF and GOOGLE_PLAY_SETUP; private receipts stay
ignored under `.local/runtime-release-20261011b-*`.

## October 10 store presentation — active preparation

Expanded owner request: finish a professional Play listing and all source-backed
production/policy prerequisites, plus a TikTok/Instagram coming-soon kit. Prepare
portrait/square artwork, short native-language captions and a practical posting
schedule. Keep Android's actual testing/review status visible; no invented launch
date, Google endorsement, tester enrollment or public store availability.
Social drafts are not publication or an authorization to send tester emails.

Owner request: finish the graphics, screenshots and other store materials for a
professional Google Play listing. FEAT-PLY-001 AC5 controls this work.

Latest owner direction: make the graphics striking and enticing with minimal
text. Replace the text-heavy local feature-graphic draft with freight artwork
using the existing Loadgistic identity; keep screenshots genuine and preserve
creation provenance. Following the combined review, the owner's next instruction
was "improve what needs to be imrpobed and lets call thsi done". This authorizes
finalizing the reviewed package and proceeding with release checks; it does not
claim that device acceptance, Google review or enrollment has already passed.

- [x] Check Google's current preview-asset rules and distinguish closed-test
  startup from the twelve-participant production-access requirement.
- [x] Prepare reviewable source-backed copy, accessible asset descriptions and a
  feature graphic using the existing identity; retain exact creation provenance.
- [ ] Capture at least four real phone screens at 1080 × 1920, emphasizing public
  Capacity, truck signals, driver workspace and agreed Tracking. Use only public
  or synthetic records, exclude private contacts and developer overlays, and
  distinguish development-preview drafts from final standalone captures.
- [x] Obtain owner finalization of the reviewed native layout and actual store
  assets (October 10 instruction above; no further redesign is planned).
- [ ] Run release gates, build/verify an unused-code standalone replacement, then
  capture the real permission video and final screenshots from that version.
- [ ] Save the reviewed listing/declarations, submit the closed test to Google,
  verify availability and share its actual opt-in link. Twelve continuous 14-day
  participants are required for production access, not to begin closed testing.

The current step is final standalone captures and a qualifying permission video.
Internal code 6 is available; Google policy approval and closed enrollment are
separate gates.
The local review is at http://127.0.0.1:3135. Sources are
resources/marketing/google-play/feature-graphic.svg and listing-en-US.json.
The revised feature graphic uses generated freight artwork and the existing
unchanged icon, with only the Loadgistic name as text. The built-in imagegen
prompt and creation provenance are retained in artwork-provenance.json; an
AI-assisted label is proposed. It does not depend on resolving the original
graphic's unknown provenance. Its 1024 × 500 opaque PNG and the existing identity's
512 × 512 RGBA icon pass dimensional/channel/size checks. Name/short/full copy
lengths are 10/76/1640; all accessible descriptions fit 140 characters. The review
page passes desktop/phone layout checks without horizontal overflow.

Actual public Capacity, selected truck signals and private-entry drafts are
captured at 1080 × 1920 with developer tools hidden through the normal menu. PNG
exports preserve every native RGB pixel; opaque RGBA captures are losslessly
encoded to Google's 24-bit format, with raw/export hashes retained. These are
development-preview drafts, not final standalone images. The next source-bound
standalone capture remains required. A fresh scoped EAS inventory verifies
falmatad, the exact project and the latest eight Android builds, all codes ≤4;
an unused code must also be verified against Play before its next upload.

The revised minimal-text export passes 1024 × 500 opaque RGB checks and is
984,512 bytes. Its exact hash is retained in the review package; only the
existing logo and Loadgistic name overlay the generated freight illustration.
Three real Android drafts are included in the review page. The fourth capture
stopped when the owned emulator shell became unresponsive. One controlled
reconnection confirms the scoped device and host process, but display restoration
times out. Cleanup remains explicitly pending: normal synthetic-account sign-out,
no-active-location-service verification, and removal of the temporary display
override when that emulator responds. No shared adb restart, device wipe or other
project intervention was attempted. This does not invalidate the earlier completed
permission/service checks or establish a new app defect.

## October 10 replacement release — local gates pass; packaging active

The complete web quality gate and mobile unit tests, typecheck and lint pass.
The code-5 configuration also passes all five final-manifest regression cases.
Fresh exact Expo and Play inventories show only previously used codes through 4.
The replacement is 1.0.4/code 5 with the existing package, project, signer and FCM
configuration. Its 381-file local EAS archive matches source, excludes private
paths/key bytes, and validates the one public Loadgistic Firebase configuration.
Commit/push, exact-source CI, standalone build/manifest/signature inspection,
actual final screenshots and qualifying permission footage remain required.
The two additional tester addresses are not a packaging or closed-start blocker.

## October 10 native permission notice — phone-tested local repair, replacement not released

The owner's ten-address closed-test roster is saved and independently verified.
Further actual-device testing found NR-26: the installed code-4 global shipment
location banner is wholly under Android's status bar (action y=21–116; inset 136).
The original synthetic company-driver test reached Home through normal review
login and the real Terms checkbox; neither center nor lower-edge taps reached
disclosure. The subsequent development preview verifies the repair below.

The local notice now uses native safe-area protection. A negative layout check
fails on the previous source and passes on the repair. The additional actor guard
hides stale notices after logout or account changes, bringing focused consent/
layout/scope/native-text/privacy-copy checks plus final-manifest checks to 20/20. Mobile
typecheck and lint pass. Development build
73df3680-6ac5-4e66-ab42-caa6f66c0508 finished, is signature/package verified and
installed in place on only Loadgistic_Pixel_API_35/emulator-5580 with data retained.
Its native archive is e57050e; Metro at 8087 serves the current local repair.
An initial emulator tile-DNS failure resolves without changing shared networking.
The actual driver signs in normally; the notice action is now y=157–252 below
the 136-pixel status inset and opens the native disclosure. Not now returns to
the usable driver workspace with no OS prompt visible. A second actual-preview
finding—duplicate header inset—was repaired through an in-flow header context;
full-window modal safe areas remain unchanged. Header actions move up 136 pixels
while the notice remains protected. A second normal synthetic login accepts the
actual disclosure, Android's While using the app prompt and Allow all the time
settings. Its location service is foreground-active both in the app and after
normal Android Home; the shipment UI reads back a current-day location timestamp.
That timestamp does not identify a background-origin update. Normal sign-out
then returns to guest login with the old notice absent and no active foreground
location service. Expo retains an inactive bound-service record; requiring every
framework record to disappear was an incorrect harness assertion, corrected
after one controlled diagnostic and inspection of Expo's unregister behavior.
NR-27 also replaces obsolete screen/lock-pause instructions with the existing
five-language shipment-sharing explanation. Actual phone captures are available;
owner visual approval, qualifying video and physical moving-location acceptance
remain pending. Native device consent was entered through the real UI only for
the synthetic reviewer, with no adb permission grants or customer consent changes.
Both web previews return 200. Full release gates and a replacement standalone
artifact are still required.
Existing Play code 4 and the deployed web/backend remain unchanged.

NR-25 is also implemented locally: the next-build configuration blocks the unused
overlay permission. The artifact checker reads final APK/AAB manifests and rejects
debug/unrelated artifacts, inherited unused permissions and missing shipment/alert
permissions. Five regression tests pass; the existing code-4 APK and AAB both
correctly fail for their inherited overlay grant. No replacement is claimed fixed
until the exact built file passes the same check.

## October 10 Google Play — internal live; Alpha draft

Android **1.0.3 / code 4** is Active and available to internal testers, with Google
status **Not reviewed**. Exact EAS submission `066f028f-0cb0-4286-9830-40815264e11e`
FINISHED for AAB `edd8cf91-446d-477e-8bb4-e00946fa7a57`. Internal track
`4700942405023499701` / release 1 is verified. Actual opt-in link:
https://play.google.com/apps/internaltest/4700942405023499701.
Only the two owner-controlled Google accounts are eligible. This is not a public
launch, policy approval or a closed-test clock.

The publisher is Active with Admin on Loadgistic only and zero account-wide grants.
Existing Google signing was already In use; no key was changed/exported. The upload
certificate matches the existing Expo signer. Play's app signer differs from the
sideload APK; do not force an update by uninstalling or clearing user data.

Privacy/private reviewer access, ads/ad-ID, government, financial, health, adult
audience, IARC and 16-type Data safety metadata are saved. Google assigned Everyone /
PEGI 3 with Users Interact and Shares Location. User-directed and service-provider
transfer exemptions are documented; no independent security certification is claimed.
Actual local Expo-web block/reload/unblock and visible reporting pass again.
Business category is saved; approved contact email/site metadata is published.
English copy/brand/two unmodified Android captures are a listing Draft. Its proposed
feature-graphic AI label was rejected automatically for incomplete recorded
provenance; the specific owner question remains pending, with no alternate bypass.

Alpha `4699446366767369053` / release 1, **1.0.3 (4) — closed test**, is a saved
Draft reusing code 4, a separate ten-address **Loadgistic closed testers** list
and Ethiopia/US eligibility. The owner's supplied set was checked exactly before
saving; a reload confirms its count and Alpha-only selection. The internal owner
list remains two accounts and unchanged. Dashboard confirms 10/11 basic setup
tasks complete, required 12 testers/14 days and 0 opted in. Android permission
video, completed listing and Google review/enrollment remain. The owner is finding
two additional testers; Google permits starting closed testing after app setup,
before reaching 12. Twelve continuous 14-day participants are required when
applying for production access. No invitation email was sent. The earlier code-4
System UI ANR is historical; the current repaired development preview's actual
native checks are recorded above. All emulator data is preserved.
Physical background GPS, closed-phone delivery and 16 KB-device acceptance remain
unverified. NR-25 records inherited unused overlay permission for the next binary.

Runtime/native/SQL inputs remain unchanged since passing CI `38012117505`.
Web https://loadgistic.com remains on verified deploy `6ac99d110f1f577818c9f7c9`,
ledger 136 and 80 live checks. Local previews were restored at 3100/8084.
Sanitized protected receipts are `.local/play-20261010-*`; owner instructions are
in [GOOGLE_PLAY_SETUP.md](operations/GOOGLE_PLAY_SETUP.md).

## October 10 publishing connection — historical checkpoint before upload

The owner supplied the dedicated `loadgistic-play-publisher` key from the existing
`loadgistic-f082a` project. It is validated and stored only in protected ignored
`.local/google-play-publisher.json`. Exact Expo account/project/package checks
precede the Submit-only assignment; postchecks preserve the original FCM
association and signing fingerprints. The supplied key authenticates successfully.
The owner then explicitly delegated the two Chrome setup steps. The exact Cloud
API is already enabled; the agent sends one invitation and confirms the publisher
is Active with Admin on Loadgistic only. Saved access contains one app and zero
account-wide permissions, with no unsaved changes. The bounded API lookup now
returns 404 for version 4 instead of its previous permission denial. Signing
enrollment/initialization remain unverified; no Play upload, test-track rollout
or closed-test clock is claimed. Receipt is protected under `.local`.

## October 9 Play policy release — web and Android testing available

The approved policy web release is live at https://loadgistic.com, Netlify deploy
`6ac99d110f1f577818c9f7c9`, runtime source `9feab2d`. Verification commit
`068ac35` changes only tests/specs/docs; CI `38012117505` passes all eight jobs.
Its single failed runner startup hit registry rate limits and a port collision;
the controlled shard-4 retry passed. Application, native and SQL inputs remain
identical to the inspected artifacts.

Owner-approved migrations 131–136 committed atomically after encrypted backup,
network-disabled restore/rehearsal, immutable-artifact and exact-source CI gates.
Live ledger is 136. Final catalog, Data API guard and PostGIS checks pass with no
critical advisors or unprotected public tables. No provider settings, signing or
customer erasure were changed. Existing warnings remain recorded.

All 80 live release checks pass: public desktop/phone controls and mobile APIs,
anonymous private-access denial, three normal-auth private reviewers, own
Tracking/capacity access, foreign-workspace exclusion, wrong-actor consent denial
and browser denial of the review registry. Company drivers correctly receive 403
for the transporter-profile editor while retaining personal Account access.
Test sessions were closed; initial human consent was not fabricated. Three new
synthetic accounts and two private workspaces are verified; passwords remain only
in protected `.local/play-policy-reviewer-credentials.json`.

Android **1.0.3 / code 4**, `com.loadgistic.app`, is ready for direct testing.
APK build `9169da7e-dd2f-40b1-87b0-53fee20e3b56` and Play bundle
`edd8cf91-446d-477e-8bb4-e00946fa7a57` pass signature, manifest, 16 KB structural,
secret and production-origin checks. Existing signing is preserved. The owned
emulator displays the installed new Privacy and live public Capacity screens after
one fresh-hierarchy System UI recovery. Actual 1080 × 2160 screenshots are
captured and the normal display is restored; this does not establish full native acceptance.
Physical moving/background location, closed-phone alerts, 16 KB-device testing
and the actual Android permission video remain separate.

Local quality 488/488, native 127/127, Doctor 21/21, all 52 SQL suites, types,
source and specs pass. All 496 native messages have four translations. Corrected
document and multi-party Tracking workflows pass in desktop/phone using real
local email and Storage. They isolate client rate buckets, assert OTP responses
and select the known prior-consented fixture; fresh signup tests accept the actual
terms screen. The unchanged 5,000-truck gate passes (search 4.75 s, route 2.74 s).
Onboarding synthetic tiles verify rendering rather than external tile delivery.

Previews remain at http://127.0.0.1:3100 and http://localhost:8084. The October 10
section above supersedes this checkpoint’s pending Play upload/connection status.
Actual device acceptance, complete listing/video review and closed enrollment remain. Current manual
steps are in docs/operations/GOOGLE_PLAY_SETUP.md. Production customer erasure
requires a separate exact request/subject review.

## October 9 web and Android tester release — published

Web application `d443093657cc4ff40f03a50b20033e0416abcb59` is published at
https://loadgistic.com as Netlify deploy `6ac876e7cffbaa5a92772381`.
Exact-source CI `37883805604` passes all eight jobs, including four browser
shards, database/scale/security, container and actual Android boundaries. Root
473/473 and native 118/118 tests pass; all 457 fixed-copy translations pass.

The owner-approved exact migrations 115–130 committed atomically after the fresh
encrypted backup and isolated restore/rehearsal. Live ledger is 130. Post-release
catalog, RLS/ACL, Data API guard and PostGIS checks pass with zero unprotected
public tables. Prepublication advisors had no errors; two existing warnings remain.
Only `LOADGISTIC_NATIVE_PUSH_ENABLED=true` was added for production on the exact
Loadgistic site. Netlify Free rejected explicit scopes without changing state;
the supported default-scope request succeeded and all unrelated fields match.

Live desktop/phone public map, profile results, filters/Clear all, private entry,
Tracking entry, email-only login and Brokerage intake pass. Public mobile reads
and anonymous private denials pass. Compiled private/provider/file workflows pass
against the exact artifact and production configuration. The final live private run now passes all 32 boundary/browser checks: provider
workspace and mobile APIs, five languages, actual protected document bytes and
guest denial. The bounded synthetic pilot session is closed. Fresh hosted advisors
report zero errors; ledger/RLS/ACL/guard/PostGIS checks pass. The invalid
supplemental GET harness failure remains preserved separately, now corrected.

Standalone internal Android build `d1f893c2-556f-4f8f-9920-800f674d2f7c` is
available as 1.0.2/code 3, package `com.loadgistic.app`. Its existing signer and
all 353 native inputs match the verified candidate. Installed with data preserved
on Loadgistic_Pixel_API_35/emulator-5580; cold-start, live map and filter dialog
pass without Metro. Android System UI initially froze; one Wait retry cleared it,
and fresh app evidence has no native fatal crash. Physical closed-phone alerts,
tap and moving location remain unverified. Featured is empty for today because its nine eligible pairs already appeared
in the round; 21 other pairs remain and the AUTO worker is healthy (WEB-MOB-013). Neither Play publication nor unrestricted launch is claimed.

Tester link and exact remaining steps are in MOBILE_IMPLEMENTATION.md. Protected
receipts are under `.local/release-20261008-*` and `.local/release-20261009-*`;
no credentials, codes or private records are included in committed handover.

## October 9 phone workflow follow-up — preparation evidence

CI 37878824597 confirmed the database/domain/scale, container and native boundaries
but rejected obsolete browser selectors and a 32px phone truck-modal overflow.
The corrected switch, assigned-truck form, named contacts, calendar and private
documents pass through actual desktop/phone workflows. Phone modal spacing now
fits the approved composition while retaining text, evidence and 44px actions.

The complete phone fleet workflow found the non-map, owner-managed duty panel
inheriting the fixed map container, hiding Off Duty under navigation. It now uses
normal page scrolling. The regression verifies the action is above navigation,
then saves duty/location, reassigns and removes the Driver. Workspace accessibility
also passes after awaiting the actual Account redirect and using real managed
sessions instead of relying on the optional local fixture widget.

Standalone Expo build d1f893c2-556f-4f8f-9920-800f674d2f7c is finished: 1.0.2/code 3,
com.loadgistic.app, signature verified against the existing installation. Subsequent
follow-up changes touch only web/spec/browser files; prove all 353 native upload
inputs match the final candidate before distributing this APK. Final exact-source
CI, new web packaging, matched approved SQL/flag, live postchecks and installed
startup were the remaining gates at this preparation stage. See the published
release record above for their actual results and remaining readback limits.

## October 8 final browser gate follow-up — preparation history

Candidate `8028574` passed validation, container and native boundaries, but full
browser CI exposed older fixtures and assertions that had not followed the
accepted single-truck, named-contact, required delivery/proof/owner approval,
five-minute Tracking and billing-retirement contracts. Production stays unchanged.

Ordered completion work (FEAT-FLT-001, FEAT-TRK-001, FEAT-DAT-001,
FEAT-SUP-001 and FEAT-MKT-001):

- [x] Repair valid local-only fixtures and exercise current contracts rather than
  restoring retired controls or weakening account, evidence or privacy rules.
- [x] Owner approved the restored web/native retirement control and compact truck
  details; scoped Expo preview retirement saves and retains the truck's history.
- [x] Finish affected desktop/phone workflows and diagnose actual defects separately.
  Current evidence: 473/473 root tests, 118/118 native tests, types/lint, six focused
  account/Tracking/modal workflows, both independent signup paths, three fleet
  paging cases and admin/staff web-only sign-in pass. Remaining corrected-fixture
  checks now pass: all 18 affected desktop workflows, including fleet recovery,
  authorized team cancellation, Featured permissions, interrupted saves and
  provider Support. Phone coverage and exact-candidate CI remain next; no
  production rollout is claimed. Final native export and runtime audit pass.
  Next tester build is 1.0.2/code 3 to distinguish it from the earlier candidate.
- [x] Bind final source, full CI, packaging and existing owner-approved SQL to the
  verified result and publish web/Android tester artifacts.
- [x] Complete final private browser/advisor readback with actual session cleanup.
- [ ] Complete physical-phone notification/location acceptance; see current release record.

## October 8 search boundary and scale follow-up — local

The public endpoint's obsolete `overview=1` switch still selected an older
aggregation search path. It now returns the same normal authorized cursor results;
two real desktop/phone API cases pass. The existing interface is unchanged.
The legacy service-only aggregate remains an internal performance probe, with its
old identifier predicate distinguished from the current Driver-name search.

The 5,000-truck text query took 6.6 seconds on a controlled local retry because
eligibility loaded all document categories even with no document filter. Additive
migration 130 skips those scans only for eligibility checks that do not need them;
default profile metadata and all requested document filters stay complete. The
same test passes at 4.8 seconds with all 5,000 aggregate records and 15 bounded
results, unchanged size/count/five-second limits and zero retained synthetic rows.
Metadata parity and document denial regressions pass. Reassignment/account closure
races also pass after the old fixture supplied the now-required delivery date.
Migration 130 still needs its full rehearsal and exact owner review before hosting.

## October 8 complete fresh-workflow verification and retention repair — local

The owner approved migration 129 (“Approve the additional retention repair”).
Fresh encrypted backup a2590e61… restores in network isolation and the exact
115–129 transaction passes catalog, API guard and PostGIS checks. The complete
43-suite CI SQL regression sweep passes on the disposable stack after replacing
obsolete multi-truck independent stress fixtures with a 105-truck company fleet
and distinct single-truck providers for the 1,002-record viewport case. Paging,
matching beyond 1,000 records, private audiences and document precedence checks
remain intact. No hosted writes have occurred; exact-candidate CI remains required.

All twelve managed verification scripts now pass on a separate disposable
Loadgistic stack (ports 56120–56124), with the developer preview preserved.
The Tracking verifier supplies the required delivery date, uploads and reads real
private proof bytes, rejects driver completion/expired owner approval, then
completes through the verified shipment owner. Fleet verification denies a second
independent truck. These correct obsolete expectations without relaxing the app.

The real approval → expiry → cleanup check found a recipient FK blocking deletion.
Additive migration 129 preserves a private approval marker and clears only the
temporary recipient reference. Its rollback-only regression proves contact
cleanup, guest denial and retained completion/proofs/history; it passes locally.
Fresh exact CI and artifact verification remain required. No production schema,
setting, web deploy or final APK changed.

## October 8 release gate repair — fixture sharing

Candidate 7f11b25 passed remote Android boundaries, but CI 37863621900 rejected
fresh public capacity cursors during fixture setup. Migration 116 backfills only
existing trucks; the later local seed did not create authoritative sharing rows.
The importer now initializes fixture PUBLIC/BOTH/PRIVATE policies after grants,
and removes its old policy rows before a local reset. Missing application policies
still default PRIVATE. No hosted customer policy or SQL changed.

The focused fixture checks and Node 22 full quality gate pass (473 tests). A new
exact candidate and fresh isolated CI run are required; web/backend/APK publication
remain pending. The approved UI and 14 migration hashes are unchanged.

## October 8 Android push — local implementation and scoped FCM upload

Private installation/session/guest registration, committed notification outbox,
bounded Expo ticket/receipt dispatch and Android opt-in/tap handling are implemented
locally. Migration 128 is backed up/rehearsed/applied locally only. The sender
defaults off. Staff remains web-only; generic notifications contain no private
message/contact/route/proof data. Four native-language catalogs cover the fixed
phone labels and privacy notice. Type/lint, 14 focused policy/readiness cases,
push retry/scope SQL and real proof-backed handover enqueue/ack suppression pass.

Owner explicitly delegated the supplied Firebase service-account file upload.
FCM V1 now matches `loadgistic-f082a` on `@falmatad/loadgistic`, Android package
`com.loadgistic.app`. It had no prior FCM association; signing/Play credentials
were unchanged. Private bytes remain outside the repository/app/logs. Local
implementation/credential setup are separate from hosted enablement and delivery:
no new APK, hosted migration/flag or web release occurred. See MOBILE_IMPLEMENTATION
for focused round-trip evidence, previews and outstanding native/phone gates.

## October 8 named sharing contacts and simpler map markers — local, not published

Load-preference text beneath web/native discovery truck icons is removed; the
Empty/Partial cluster colors, selected truck facts and full/shared filters stay.
Private Network now requires a person/company name when adding an email and has
inline name editing for existing contacts. Exclusive recipient names are saved
atomically with the sharing policy/capacity. Existing unnamed contacts and grants
remain intact; names never enter visitor projections or audit details.

Additive migration 127 is backed up, rehearsed and applied locally. Contact
permission/privacy/legacy/Exclusive SQL, unchanged sharing/load-matching SQL,
six unit/readiness cases, actual web/Expo add/edit/readback, types/lint/source/spec
checks pass. Actual driver-Home stepped zoom/area-return cancellation and real
tile-failure feedback pass. See MOBILE_IMPLEMENTATION for receipts and limitations.

The owner-selected Android push extension now has local implementation and exact
FCM setup as recorded above. A new native artifact, hosted rollout and actual
closed-phone evidence remain pending. No hosted database, web deployment, EAS
build artifact or another app changed; only the separately delegated FCM key
association changed remotely.
Both previews remain on 3100/8084; owner review precedes extensive release gates.

## October 8 approval and browser alerts — local, not published

Driver unloading-approval updates now use the actual committed OWNER/STAFF
handover, the existing web/mobile bell and an authorized Tracking detail link.
Opening the update acknowledges its exact version; fetching/dismissing never
changes approval or chat Seen. Browser alerts are opt-in and support running
background tabs, with generic private copy, deduplication and safe click routes.
The notification worker has a separate scope and preserves the existing PWA.

Local schema 126 is backed up/rehearsed/applied. Owner email verification and
approval → web/system and Expo driver update → saved acknowledgement passes.
Support and Brokerage round trips, delayed Claim, hidden-delivery/read neutrality,
SQL proof/approval/device-release denials and focused policy/types/lint checks
pass. Precise evidence and investigation corrections are in MOBILE_IMPLEMENTATION.
No hosted write, release/full CI or new APK/AAB. Review screens are available
there; owner visual approval and configured/physical-device closed-phone push
remain pending. Both local previews stay running (web 3100, Expo 8084).

## October 7 chat alerts and read receipts — local, not published

Existing provider Support and visitor transport chats have scoped unread badges,
assignment/join/message/ended/resolved alerts and saved visible-message Seen on
web and native screens. Staff remain web-only. Fetching or sending is not Seen;
a handoff retains team history but resets the new assignee’s unread position.
Delayed old assignment frames fail. Sound is deliberate web opt-in; native alerts
are in-app foreground delivery, with no closed-phone push claim.

Local schema is 125; no hosted write, new build or deployment occurred. Private
cursor tables/RPCs pass RLS/ACL/definer checks. Protected dumps and transactional
rehearsals exist; full restored-backup/release evidence remains pending. The new
45-chat regression caught waiting work hiding assigned alerts; corrected priority
and message event time pass. A menu-close stall was found and fixed. Current
contracts are FEAT-NOT-001 / ADR-077 / NR-19.

18 focused cases, concurrent commands, seven SQL workflow suites, actual web-staff/
Expo-web two-way Support/Brokerage flows and detailed receipt/failure/history checks
pass. Five-language 320px presentation and real web audio opt-in pass. Types/lint/
source/spec checks pass. Precise evidence and screenshots are in
MOBILE_IMPLEMENTATION. Owner visual review is still pending (“I’ll check” was not
approval); both local servers remain running at 3100 and 8084. Full release gates,
exact hosted plan and matched APK/AAB/web rollout are next after that review.
Direct provider inquiry and background delivery scope remain WEB-MOB-016.

## October 7 account and transport-chat correction — local, not published

Independent driver replaces the two visible solo account categories, retaining
legacy identities and history. One current truck is enforced in SQL and service
commands, with explicit ownership/permission and confirmed atomic Change truck.
No extra truck/driver management, restoration or selector is available. Fleet
management stays separate. Web/native real email-code signup, registration,
replacement/history, command denials and browser-simulated obscured US GPS pass.
19 final unit cases, 14 language/navigation cases, three relevant rollback SQL
suites, real two-session races, two existing web navigation cases and catalog/
source/spec/types/lint checks pass. Exact disposable test cleanup returns zero.

Transport entry and chat now share “Need help with transport?” with smaller
“Let us handle it · Live chat” and one plain service explanation. All five languages
are adapted; guest waiting states name the transport team. Three narrow web cases,
two actual request/recovery cases and the five-language Expo entry/intake/action-fit
check pass. A missing ARIA checked state in the Expo web language menu was fixed.
Current screenshots/receipts and earlier failures are in MOBILE_IMPLEMENTATION.

Owner visual review is requested; full release gates, restored exact-backup
rehearsal, hosted preflight/migrations, CI, new APK/AAB and deployment remain
pending. That checkpoint used local ledger 121; hosted ledger was last verified at 114. The driver-map capture shows a tile failure
while saved approximate geometry works; WEB-MOB-015 preserves that unresolved
recovery check. Browser sensor testing is not physical-device acceptance.
Both local previews remain running. Owner reports Google Play Console developer
registration ready; account/app/internal-testing configuration is not yet verified.
The published web/Android versions below remain unchanged.

## October 7 launch continuation — local, not published

Owner's commercial correction is implemented locally: there are no provider
plans, subscriptions, trials or platform-payment requirements. Revenue comes
from arranging transport. Web/native Account, Home, menus and admin client/review
surfaces remove billing controls/status. Old billing links return to Account or
the admin overview. HTTP, service and SQL writes reject payment proofs, paid-mode
activation and plan/subscription commands before upload or mutation. Migration
120 removes subscription-dependent operating access and signup trial creation;
active identity, workspace ownership, company-driver permissions and private
history remain. Health rejects a missing database compatibility marker.

Focused evidence: 32 unit checks, six native navigation tests, real local OTP
signup/rejection cases, three fresh provider-model web/Expo Home and fully loaded
Account workflows, admin client list/detail/menu and stale-write denials, two
rollback SQL suites, resulting catalog security and retained-history/admin setup
verifiers pass. Types, mobile lint and source/spec checks pass. The revised local
database is at 120; hosted remains 114. Current-source owner visual review,
compatible restored-backup rehearsal and full exact-artifact release gates remain
pending. No commit, push, hosted migration, deployment or new APK was made here.
Preview: http://127.0.0.1:3100/app/more and http://localhost:8084/account-settings;
focused Account captures are `.local/no-plans-*.png`. See FEAT-BIL-001 / ADR-075,
NR-17 and MOBILE_IMPLEMENTATION.md for precise evidence and failed-run limits.

Support/Brokerage live audit passes on real local web/Expo screens: isolated staff
queues, actual claim/assignment, both-direction automatic replies, retained drafts,
reload/history/pagination, attachments/private byte reads, end/continue/new chat,
callback/follow-up/resolution and revoked/stale/unrelated actor denials. Actual
owner OTP creates independently scoped Support and Transport staff; all three
staff/admin identity types are denied mobile OTP/refresh/workspace access without
closing the valid web session. Live read-only inspection found the requested
falmata.dawano@gmail.com already confirmed, active and ADMIN with no conflicting
provider/fleet/staff association. No live identity deletion/change was needed;
the separate falmatad97@gmail.com transporter account remains intact. Direct ADMIN
post-login now goes to /admin locally. WEB-MOB-014 records the missing active-member
Support handoff control; fixture-based permission checks are not a UI for that
feature. This is not production chat or native-device certification.

Recurring browser map error now has a controlled before/after regression. The
owner's tab wraps fetch; a recorder's unhandled side-promise reproduces the same
abortTile stack even after the original source catch fix. A scoped browser-only
MapLibre raster/XHR port avoids that hook, preserves caching/expiry and handles
cancellation once. Desktop HiDPI driver Home click zoom and area return pass with
63 actual body cancellations and no overlay; HTTP and PNG errors remain visible.
All temporary browser probes are removed; no extension or browser setting changed.
Eleven focused unit tests, four recorder/error browser cases, four real owner/driver
Home cases, typecheck/lint and spec checks pass. The image Accept header matches
the original request so the browser's cached tile variants remain reusable.
The final local URL is ready for owner retest. This does not publish an APK/web
release or certify the remaining launch contracts below.

Local preview cancellation repair: restarted the stopped Loadgistic backend and
Expo preview, then reproduced/fixed MapLibre6.13.0 treating an aborted raster
request as a failed tile. The project-local postinstall adapter checks exact
package/version/source hashes and refuses external linked dependencies. Six
focused tests and three real-renderer browser scenarios pass; HTTP/image failures
still show error feedback. Types/lint pass. Raster fixtures are explicit; this is
not native device or production release evidence. Previews remain at the URLs below.
Owner subsequently reported recurrence in Chrome during paused click zooms.
Fresh Chrome passes that sequence with 49 real OSM request cancellations; a new
bounded streaming-PNG browser regression passes 31 actual body cancellations.
The earlier synthetic counter now requires the intended new cancellation, and
unhandled rejections are checked separately. Sent a full reload only to the
verified Loadgistic8084 client. The retained old-instance explanation is not
proven; owner confirmation remains pending. No additional library or UI patch,
new release, global error filtering or shared cache change was made.

Provider navigation now shows Marketplace / My workspace directly on web/native,
without a choice modal or “Exit dashboard.” Native keeps separate area stacks and
unsaved drafts. Its supplementary menu no longer repeats primary destinations or
five language options. Account has four main groups: personal details/evidence,
security and transporter profile/usual service/company evidence. Company drivers
receive only their permitted personal/security controls. Truck and
fleet-driver records keep their contextual controls and documents; staff remains
web-only. Safe web return URLs retain applied queries and the public camera.
Arbitrary web forms still follow ordinary page-navigation lifecycle; do not claim
all web drafts survive leaving a page.

Evidence: focused local-session navigation/camera/Clear all check and four Account
E2Es and phone Account security workflow pass; root/native types, mobile lint,
16 navigation/document/language tests, 15 web fleet tests and 3 safe-return checks pass. Captures under `.local/navigation-*.png`; previews stay running at
http://127.0.0.1:3100 and http://localhost:8084. Owner requested adjustment and clarified that driver workspace Home must be a map.
The reviewed Account images were settings. The named localhost account is a
transport-company owner; its existing driver alias shows the map. Actual owner/
driver Home checks now pass on web/native browser, including area-switch map return.
Owner Home reuses the fleet workspace; redundant Fleet primary navigation is removed
while its deep links remain valid. Native headers identify the operating role. No new visual approval, commit, CI,
APK or production publication yet. Existing released web/APK
below remain the production baseline.

Earlier launch contracts are still in progress: local ledger is now 120 (hosted
114); six rollback-only DB regressions pass, including 292 combined matching
checks and document AND/expiry cases. Current native Home saves and approximate
movement readback pass after the privacy correction. Native background OS testing,
complete browser handover/appeal and owner calendar review, final gates and the pending
ETA+2-day restriction decision remain outstanding. See MOBILE_IMPLEMENTATION.md.

## October 7 web production and Android internal release — verified

Web application `415cb7ddbde4d643108bec2175fe9b256065861d` is live at
https://loadgistic.com, published as Netlify deployment `6ac64a35243e4f0c807487b0`
at 13:37:52 UTC. Exact-candidate CI `37626365763` passed validation, container,
mobile boundaries and all four browser shards. Fresh encrypted backup, isolated
restore at ledger 114, catalog/guard/spatial checks, immutable Linux packaging,
compiled runtime and deployed desktop/phone checks passed. No hosted migration,
Auth, SMTP, billing or other settings were changed. Rollback application deployment
is `6ac37aebd908dd516d4b6152`; preserve the database and file history.

Live checks cover public discovery, filters/Clear all, private-access entry,
email-only login/Tracking, chat intake, all five languages and unchanged user text.
The approved synthetic pilot login verifies workspace/account security, private
document bytes, guest denial and caller-bound Data API guards. Twelve authenticated
mobile reads passed and the test session was closed. Anonymous public mobile reads
passed; protected workspace/private-capacity/Tracking reads returned 401.
Evidence: `.local/release-web-20261007-gesture-publication-receipt.json`,
`*-production-public-evidence.json`, `*-deployed-browser-evidence.json` and
`.local/release-mobile-production-api-evidence.json`.

Expo internal build `544cc916-c058-4bca-85a0-72a4d4b4e981` is FINISHED. The signed
1.0.0/code 1 APK downloads successfully, installs and cold-starts with native
MapLibre/public signals without Metro. The EAS source commit is `74df968`; all
290 uploaded files also match final web commit `415cb7d`, whose subsequent changes
are web-only or test/documentation corrections. Installation, sharing, checksum,
device limits and the deferred Google Play work are in
[MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md). This is internal Android
testing/demo distribution, not store publication or physical-phone certification.

Today's public Featured endpoint returns 200 but `published: false` and zero
showcases. This verifies an honest empty state, not a populated automatic programme.
The cause is not established; record WEB-MOB-013 for roster/scheduler investigation.
Do not fabricate slots or change production settings to make the demo look full.
Existing upload-scanning, SMTP at-least-once, community tile-service and two known
security WARN limits remain visible. The immediate uncertain-upload deletion repair
is deployed; reference-aware orphan reconciliation remains open.

## October 7 signal gesture repair before rollout

Revised CI 37580938507 passed validation, container, mobile and three browser
shards; the phone shared-leg zoom regression failed. A three-run measured local
probe confirmed that rapid adjacent signal taps also reached Leaflet's double-tap
zoom handler underneath the info modal. This is an interaction defect, not merely
a stale SVG check. Stop signal click/dblclick propagation; preserve background
zoom gestures and the accepted appearance. Add camera-stability assertions to
the existing touch/separation regression, run focused checks and fresh exact-
candidate CI before promotion. Native APK input files are unaffected.

Focused camera/separation checks passed on desktop and phone (4). Additional
shared-leg checks confirm that background double-tap still zooms normally (2).
Full local quality passes: specs/source, 415 tests and types. The fix stops
Leaflet event propagation, not merely DOM propagation; no appearance changed.

## October 7 release browser regression corrections

Focused evidence: portrait/modal checks passed (6); corrected workflow run passed
20 cases, with its two timing failures subsequently covered by a sequential
desktop/phone rerun (4 passed); all changed fixture consumers passed (3). Type,
specification and source checks pass. Required revised-candidate CI remains next.

CI 37575463681 stopped promotion. Driver document/portrait scenarios still
addressed the former automatic truck panel and expanded Account photo editor.
Update the tests to tap the approved truck info control, verify the current
Driver identity row, and open Driver photo before working with it. Preserve
badge/private-file denial, consent, actual Storage/Featured bytes, replacement,
revocation and removal assertions. Wait for a unique hydrated public control
before brokerage/language interactions; retain uniqueness assertions. The
language scenario allows the existing 12-second conversation-restore request
window before requiring the actual form, rather than assuming a five-second
local compile/load. Run the
focused desktop/phone scenarios and exact revised-candidate CI before release.
The Account failure was an incomplete synthetic provider: real managed signup
creates an unpublished company page, while `auditProvider` omitted it. Bring the
fixture into parity; do not weaken Account security or add production writes.
Provider Support now follows the Account header shortcut rather than the retired
provider More menu. No production mutation has occurred. The signed internal APK is built; its
application upload remains unchanged by these test/documentation corrections.

## Web and Expo release in progress — October 7

The owner explicitly requested publishing the accepted web/native layout and
Expo Android distribution for testing/demo. Web quality passes 415 tests; mobile
92 tests and Doctor 21/21 pass. The release audit found newly published sharp and
source-map-js advisories; narrow patches (sharp 0.35.5, source-map-js 1.2.2) reduce
the web audit to zero findings. Mobile's reviewed build-tool findings remain
visible and are absent from the Android runtime.

A fresh encrypted read-only backup restores in a network-disabled disposable
PostgreSQL container at ledger 114. One Featured regression assumed adjacent
weekday categories differ; Sunday's mixed theme includes Monday's category.
The fixture now selects a genuinely incompatible replacement, preserving the
invalid-roster assertion. No production data/schema/configuration write is part
of that correction. Restore/security checks and exact-candidate CI are refreshed
before promotion. Netlify rollback target is 6ac37aebd908dd516d4b6152.

Expo account falmatad and exact project a2d7e0a9-2fe4-4188-804e-40d8c3486ac7 are
verified. The reviewed archive excludes env/credentials/local data/generated
native folders and other projects. Internal APK uses https://loadgistic.com;
Google Play publication remains deferred. No release is claimed complete yet.

## Map-first driver Home and simpler controls — October 6

Implemented a full-height driver Home map with compact truck/status identity and
three right-side floating tasks: Available space, Usual routes, Truck location.
Capacity combines current space/coverage/sharing, with optional load preferences;
regular service stays provider-level. Existing location offset, foreground cadence,
permissions, first setup, duty controls and navigation remain connected. Local UI
save/readback and map-state checks pass, including a fresh actual OTP onboarding,
company-driver permission and tracking/photo workflow. Thirteen focused
permission/privacy/location/coverage tests pass. Native manual location now saves and moves to the new synthetic area with
only an obscured fix; repeated permission prompts and stale browser fixes are
repaired. Native captures show the map/rail and focused modals. Lint/types pass,
399/399 marked translations cover four non-English languages,
and source checks pass for 458 files. Evidence is in MOBILE_IMPLEMENTATION.md.

The owner found the initial six categories confusing, then accepted the simpler
three-task presentation by explicitly requesting web and Expo publication.
Release gates and the scoped rollout are now authorized. Local previews remain running. Native
emulator adb/accessibility checks are intermittent; native photo-picker
verification and standalone APK are unfinished. No production deployment or
configuration/database write in this change; Suqpage remains untouched.

## Driver completion and physical phone review — October 6

Repaired missing native driver Home capacity controls and automatic foreground
capacity location. The saved approximate map/route, localized location wording,
server offset readback, ten-minute cadence, manual first location, preserved
capacity/sharing and Off Duty pause pass focused checks. Actual browser tracking
status/photo-picker upload, private proof reopening and consented driver portrait
save pass. New company-driver first location, owner grant, Partial save, revocation
and Off Duty also pass, including session cleanup in the final rerun
(`.local/mobile-driver-home-browser-final.log`).
Seven focused native policy/privacy/copy tests, four capacity projection/command
cases, lint/typecheck and 394/394 marked translations pass. Full release evidence
must be refreshed after Home visual approval; these are focused checks.

The scoped ARM64 development client built and installed on the authorized Pixel
8a. Native Marketplace map, real email-code login and driver Home passed. Two
physical-only layout defects (logo overlap and invisible search hint) are corrected
in source, awaiting recheck. The USB cable disconnected; ADB still reports no
device after the owner reconnect/retry. Native permissions, actual GPS and file
picker upload remain unverified. This APK requires Metro; it is not the final
standalone production APK. No new web/mobile production deployment. Keep local
API 3100, browser preview 8084 and native Metro 8083 running.

Fresh read-only Supabase checks on tpwyyzoqijjmbvsmmvcm pass catalog, grants,
guards and PostGIS service behavior; ledger 114, PostGIS in extensions and zero
public tables without RLS. Advisors have no ERROR findings. The two WARN findings
remain visible (authenticated SECURITY DEFINER execution and leaked-password
protection); no hosted setting or database write was made.

## Final web/mobile candidate — October 6

Web quality passes 414 tests and typecheck; the production build passes. All 58
changed web browser cases have passing evidence across the original run and
focused retries. Updated stale fixture/login, navigation and readiness assertions
retain the tested behavior rather than changing product behavior.

Mobile APIs pass the extended local permission/file/tracking/fleet walkthrough.
The final SDK-matched app passes Expo Doctor 21/21, lint/typecheck and 84 tests.
Four selected languages render translated phone sign-in controls without overflow
or browser errors; the fixed-copy audit passes 382/382. Android runtime export
includes the patched URI decoder and current copy. Remaining tooling findings
stay in the raw audit (27 entries, 19 high/8 moderate) and a tested gate limits
that assessed graph to internal builds, rejecting unknown findings/runtime exposure.

Created and independently verified only @falmatad/loadgistic, project ID
a2d7e0a9-2fe4-4188-804e-40d8c3486ac7, Android package com.loadgistic.app. The requested
permission set is unchanged. The candidate is being prepared for exact-source CI,
protected backup/security checks, web publication and a signed test APK. Those
remote release stages and owner phone verification are not yet complete. Google
Play remains deferred. Preview remains http://localhost:8084 with local backend
http://127.0.0.1:3100. No changes were made to other applications/Expo projects.

## Expo localhost preview and release verification — 2026-10-06

Owner approved the truck-detail composition and requested web/mobile release,
then chose browser testing after Android's launcher/system services froze.
The actual Expo mobile screens now run at http://localhost:8084 against the local
backend on port 3100. Browser-only MapLibre GL and tab storage adapters preserve
the native MapLibre/SecureStore paths. The proxy only reaches the fixed local
backend and strips cookies; hosted configuration is unchanged.

Verified phone-size truck selection, centered details, close/return-to-map and
menu, with zero browser errors. Visible email OTP login, onboarding, session
restoration and sign-out pass using local Mailpit. Mobile lint/typecheck and all
78 tests pass. The expanded browser flow also passes provider onboarding, both
area switches and server-confirmed sign-out. It caught and fixed collapsed area
switcher sizing and logo spacing in React Native Web. Web quality passes 414 tests;
the broad browser run returned 43 passes / 15 failures, with all 15 failures subsequently passing focused retries after test
readiness/fixture/navigation corrections. All 58 cases now have passing evidence. Screenshots are `.local/mobile-web-preview-{phone,truck-modal,menu,onboarding}.png`.
This is browser evidence, not native installation/distribution evidence.

Release work found the recorded ambiguous-upload failure could delete a file
whose database reference had committed. Verification/payment/profile and shipment
proof adapters now retain files after uncertain commit outcomes and clean only
explicit database rejections. Eight focused runtime/fault-injection checks pass;
orphan reconciliation remains separately recorded in WEB-MOB-001. Broader web
checks are still in progress with cold-compilation failures being investigated.
No production deployment, EAS project linking, signing or APK distribution yet.

## Truck detail composition — 2026-10-06

Replaced the flat truck-detail stack with a configuration illustration/identity
header, parallel transporter and driver sections with their respective actions,
paired freshness information, and a compact row of entity document disclosures.
Ordinary local fixture content fits without scrolling on desktop and phone; long
records and expanded evidence remain bounded and scrollable. A fallback company
phone now appears with the transporter rather than looking like the driver's number.
Hidden current-location notes and document category scope are retained.

Native has corresponding identity/people/update groups using only existing mobile
projection fields. Web/native typecheck and native lint pass. Six focused browser
cases pass in `.local/truck-profile-verified.log`; spec links and whitespace checks
pass. Captures: `.local/truck-profile-{desktop,mobile}.png`, with Amharic and document
expansion variants alongside them. Local preview remains http://127.0.0.1:3100.
New visual review requested; no full release gate/deployment. Native device review
remains open due to the previously recorded emulator instability.

## Centered map information and attached exit — 2026-10-06

Owner accepted side information controls and requested the truck-attached X,
centered/lightly dimmed modal and readable route structure. Implemented locally
on web and native. Desktop/phone browser checks pass 2/2 for modal readability,
focus/dismissal and camera restoration; six focused map regressions and two
modal-scroll/map-zoom cases also pass (10 browser cases total).
Web/native typecheck, native lint, three native projection/focus tests and 33-spec
validation pass. Modal close preserves selection;
truck exit restores pre-selection camera and retains search/filter state. Route
places/directions, area boundaries and update age are separated; ordinary content
fits naturally, long content has bounded scrolling. Existing private projection
and API scope are unchanged. Four non-English catalogs include the new copy.

The unresponsive task-owned Next preview was restarted with the same local
Supabase config, port 3100 and ignored webpack output. No other project process
was changed. Native emulator verification remains unavailable following the
previous recorded app/System UI ANRs; type/lint success is not a device pass.
No release/deployment or APK distribution performed. Older side-card captures
below are historical, superseded by this owner-requested modal.

## On-demand map details and side controls — 2026-10-06

Owner rejected automatic truck sheets because they hide the selected signal
geometry. Public/private web and native now keep detail cards closed on selection,
show permitted geometry, and open one compact shared card on explicit inspection.
Closing the card retains selection; Results restores discovery and its drafts.
Truck details retain profile/contact/document controls. Selected truck is teal;
location, capacity and regular-service colors retain their existing meanings.

The first white “…” speech-bubble preview was rejected as too close to the shapes
and too conversational. The current comparison uses small labeled controls on the
map's right side, with matching accents and ellipses. Popup and controls occupy
separate space. This is a review candidate, not owner-approved. Preview remains
http://127.0.0.1:3100; .local/map-side-controls-mobile.png and
.local/map-side-controls-desktop.png show the current design. Details captures:
.local/map-side-info-mobile.png and .local/map-side-info-desktop.png.

Final side-control/shared-route browser cases pass 4/4 across desktop/phone
(.local/map-side-final.log). Final feedback/error/retry and closed-area selection
cases also pass 4/4 (.local/map-side-feedback.log), including six responsive widths. The shared-leg test now waits for map inertia to
settle before measuring touch coordinates, and uses real mouse input on desktop.
Native typecheck/lint and 11 focused projection/privacy/focus/pagination tests pass;
web typecheck and 33-spec validation pass. Updated broader smoke expectations have
not been run: owner visual review precedes extensive gates. WEB-MOB-010 records the
corrected web fit that previously omitted regular-service geometry.

Native device verification remains incomplete: the isolated emulator repeated app
ANRs, DNS failures and a broken shared-storage mount after a data-preserving cold
restart. Temporary UI dumps now use /data/local/tmp and still require a fresh
successful dump; a failed dump never authorizes stale taps. Stopped only verified
Loadgistic_Pixel_API_35 after the controlled recovery failed; its data is preserved.
Web/Metro remain running, and no other app/emulator/global SDK setting was changed.
No production deployment, remote configuration, signing or APK distribution.

## Marketplace/workspace switch and truck details — 2026-10-06

Owner selected two mobile areas: Marketplace and My workspace. Implemented a
consistent header switch with separate nested navigation histories and unchanged
public/provider deep links. Workspace state resets by account identity. Refocusing
Account no longer replaces an unsaved name/phone draft with a server response.
All five navigation languages include the new labels.

Web selected-truck details now occupy the results drawer. X restores the mounted
results, search draft and scroll position; selecting the same marker reopens a
hidden drawer. Loading/retry feedback remains reachable. Fixed a discovered hover
preview that intercepted the next route-selection click (WEB-MOB-009).

Focused evidence: 17 native navigation/language/link/text tests; native and web
typechecks; native lint; 33-spec validation and whitespace checks pass. Desktop
and phone drawer/Clear all checks pass 4/4. Feedback/retry, overlap selection,
map key and gesture checks also passed as recorded in docs/MOBILE_IMPLEMENTATION.md.
Preview: http://127.0.0.1:3100. Review captures: .local/mobile-area-switch.png,
.local/web-truck-details-desktop.png and .local/web-truck-details-mobile.png.
Owner visual review of these changes is requested, not yet received.

Final Android area/draft/Back verification is incomplete. Loadgistic's emulator
experienced app input and Android System UI ANRs; after a reboot its emulated Wi-Fi
was disconnected. Reconnected only Loadgistic_Pixel_API_35 to AndroidWifi, verified
connection/IP, but fresh UIAutomator hierarchy capture still failed. Network
recovery does not establish the ANR cause or a passing app test. No unrelated
emulator, Expo project, shared SDK setting, remote configuration or production
record was changed. Full release gates and standalone APK remain outstanding.

## Map focus and refresh corrections — 2026-10-06

Owner approved the common-page layout and resumed mobile work. Native selection
now hides background truck/cluster render layers and touch targets immediately,
including stale rendered-feature responses. Completing initial loading cannot
refit over a selected truck. Android selected/close/reselect checks passed with
the local populated feed; overview restoration does not request new discovery data.

Web viewport refresh previously replaced all loaded trucks with each partial page,
causing marker disappearance/reappearance and cluster churn. It now keeps the last
window while replacement pages accumulate, then prunes at successful completion.
Query/private-identity changes still reset the feed; cancellation/error handling
and automatic pagination remain intact. No new modes or manual loading steps.

23 focused native/loading tests pass; native/root typechecks and native lint pass.
Repeated desktop/phone refresh tests pass (4/4), verifying marker retention, final
pruning, persistent map instance, stable camera and no request loop after settling.
Existing cluster/pagination and failure/retry cases pass on both sizes (one cold
compile timeout passed its controlled retry). Earlier intermittent test failures
were an initial-load race; the test now waits for the real initial window to finish
before intercepting the separate refresh. No product loop is inferred from that race.

Local screenshots: `.local/mobile-map-focused-truck.png`,
`.local/mobile-map-overview-restored.png`, `.local/playwright-map-final/`.
The emulator still intermittently reports OSM tile DNS failures; offline map recovery
is a remaining mobile item, not a claimed pass. The full native application/APK
remains in progress. No production release or remote configuration changes.

## Provider workspace consolidation — 2026-10-06

Implemented locally on web and native after the owner clarified that related
controls belong on common pages, rather than another directory of links. Account
contains personal/security, portrait, business/profile/document and plan controls
as permitted by role. Fleet keeps capacity and truck/driver documents with their
entity. Provider More navigation is removed; old routes remain compatible and
Support stays directly accessible. Admin/staff management is unchanged.

Focused desktop/phone tests passed Account draft retention and same-page saves,
company-driver isolation, and contextual truck document upload/review. Android
Account retained a collapsed draft and saved/read back the restored synthetic name;
truck capacity/documents opened inline. Native navigation/document-scope tests,
typechecks and lint passed. These are local focused checks, not full release gates.
The phone visual check also caught header wrapping; the compact Support correction
and its 320px/standard-phone bounds test pass.

Initial native navigation was owner-approved. The subsequently consolidated common
pages were also owner-approved before resuming mobile map corrections. Local web preview:
http://127.0.0.1:3100/app/more. No production deployment or standalone phone APK.
The full mobile checklist and remaining localization/device/release work remain in
[MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md). Earlier counts below describe
earlier slices rather than current whole-app coverage.

Mobile continuation (October 6): native Support send/end/history/new-intake and
Somali closure verified against local persisted data; truck test value restored.
Support/file controls translated into all four requested languages; 62 native tests,
mobile typecheck/lint and specs pass. Translation coverage is 163/358 marked messages,
not full localization. The development preview recovered after restart; a controlled
cold launch reached the visible map and 104 results, though startup was slow and
standalone startup performance remains unverified. No standalone APK or hosted changes. See
[MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md).

Native brokerage messaging, assigned staff reply, ending, restart/history and new
intake passed the local Android walkthrough. Fixed a stale-refresh race and added
regression coverage. Native About and a persisted language preference are connected;
Android Amharic rendering passed after replacing dynamic catalog loading with bundled
imports. Full localization remains in progress. Incoming native links now have a
validated boundary; dependency advisories remain visible in
[MOBILE_DEPENDENCY_REVIEW.md](MOBILE_DEPENDENCY_REVIEW.md).

61 native tests pass. Android map clipping and invalid-path recovery are also fixed;
the new translation audit keeps the remaining 215 marked phrases visible. The app still needs the remaining role/device matrix, owner
visual approval and release work before a standalone phone APK. See the active
[mobile checklist](MOBILE_IMPLEMENTATION.md). No production/Expo remote writes.

## Mobile public discovery and chat continuation — 2026-10-05

Native Featured/profiles, driver portraits, account security and guest brokerage
are connected to existing services with local privacy/permission/workflow evidence.
Public/private profile search, detailed truck filters, native geometry, cluster
counts and truck images now run on the dedicated Android emulator. Configuration
filtering and Clear all passed the device walkthrough; it also caught a raw-text
rendering defect that is fixed with regression coverage. Native brokerage device
checks continue. The rebuilt x86_64 development client is installed and requires
Metro; no standalone phone APK, EAS upload or production change.

See [MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md) for evidence, running
processes and the unchecked full-app checklist; documentation does not claim the
remaining localization, role/device checks or release gates are complete.

## Web gaps recorded during mobile work — 2026-10-05

[WEB_GAPS_FOUND_DURING_MOBILE.md](WEB_GAPS_FOUND_DURING_MOBILE.md) records six
source-backed findings for later investigation: uncertain-commit file cleanup,
web multipart parsing limits, payment retry deduplication, legacy capacity-photo
flow, inconsistent payment amount rules, and conflicting Terms/brokerage narrative. Evidence strength, shared mobile impact,
responsible roles and closure tests are explicit. No production incident is inferred;
no web repair or hosted change was made. Keep extending this register as native
workflows are connected. The full mobile app remains in progress.

## Mobile continuation — native files and fleet controls (in progress)

Loadgistic-only local work continues under FEAT-MOB-001. Expanded fleet lifecycle,
trailer and driver-control integration passed. Native documents, Tracking photo
proofs, private file viewing, profile images and plan/payment screens are connected;
foreground travel cadence and the guest uncertainty-area map are implemented.
Focused file/billing/Tracking contract tests and area/cadence tests pass. The updated Android
development binary built and is installed; device verification continues. The
complete extended local integration rerun passed after a backend restart.
See docs/MOBILE_IMPLEMENTATION.md for precise evidence and remaining scope. No
production/EAS changes, external APK or complete-mobile claim.

## Native device retry and visitor login fix — 2026-10-05

The dedicated Loadgistic emulator is responsive again. Android verification now
covers profile publishing, truck sharing, private-email map access/selection/logout,
and guest Tracking detail plus session restoration after a cold app restart.
The device test caught and fixed clock-skew rejection of valid visitor credentials;
server expiry and grant checks remain unchanged. All 23 native tests, native lint
and both typechecks pass. See [MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md)
for evidence and remaining full-app/APK work. The local preview remains running;
there was no deployment or other-project change.

## Native visitor access and discovery setup — 2026-10-05

Implemented email-authorized Tracking/private capacity, separate secure visitor
sessions, truck-specific sharing controls and transporter profile editing/publishing.
The complete local account/fleet/capacity/Tracking integration passes, including
profile draft visibility, scoped email OTPs, grant revocation and contact privacy.
Native type/lint and server type checks pass; device review of the new screens is
in progress. No production changes or standalone phone APK. Full remaining scope
and evidence are recorded in [MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md).

## Native Tracking and recovery — 2026-10-05

Added connected mobile shipment creation, journey/status updates, recipients and
owner-only correction/reassignment/cancellation. Focused local integration checks
pass for authorization, current permissions, driver location, recipients/mail,
state transitions, revision conflict and retained history. Android creation is
verified; remaining interactions are still under device review. See
[MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md) for precise evidence and gaps.
Private proofs, automatic foreground updates, visitor device verification and the broader
mobile checklist remain incomplete. No release APK or native API production
deployment; no other project or hosted settings were changed.

## Mobile isolation and native preview — 2026-10-05

Expo Android-first work continues under FEAT-MOB-001. The ordered scope and
current evidence are in [MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md).
[Mobile guardrails](../apps/mobile/AGENTS.md) explicitly separate project-local
repairs from shared tools, prohibit other-project cleanup, and require precise
process/device/account targeting. Native OTP → onboarding → add truck → approximate
location → first private capacity save, account edit and logout now have emulator
evidence. Multi-role local API tests cover owner/driver permissions, cross-provider
denial and revocation. Navigation refresh and compact dashboard totals are fixed.
The full app, native API production release and standalone phone APK remain
unfinished; dependency advisories and the remaining workflow matrix are recorded.

## October 5 release completed — verified live

Application commit `fe47a09e100917216f084d99e45bc029fe763ca4` is live at
https://loadgistic.com as Netlify deployment `6ac37aebd908dd516d4b6152`.
CI `37291784154` passed validation, container, all four browser shards and the
aggregate browser gate. The exact source and five packaged server functions
passed integrity/privacy checks. The fresh encrypted backup restored and
rehearsed all 13 migrations before the bounded atomic production upgrade from
101 to 114. Catalog, Data API guard and spatial checks passed afterward;
PostGIS remains in extensions and no public tables lack RLS.

Independent live checks passed: health 200, www redirect, desktop/phone map
filters and Clear all, private map access, Tracking entry, brokerage intake,
email-only login, five-language switching, the authorized synthetic workspace,
private-document byte verification and guest denial. The synthetic verification
session was closed. This release did not retest external email delivery or change
hosted Auth, SMTP, credentials or unrelated settings. Existing pilot limitations
(upload scanning, SMTP delivery semantics and community map tiles) remain.

The runtime verification harness needed missing Docker mountpoints and a longer
bounded cold-start wait; neither change altered the deployed application. The
rollout then retained one credential read in memory for its remaining checks.
Protected evidence uses `.local/release-web-20261005-final-*`. Application rollback
remains deployment `6ab3aaa9668f9644dcba97d8`; retain database history and migration
114 rather than applying a destructive downgrade. The local preview remains
http://127.0.0.1:3100. No release work remains pending.

## October 5 restored-data rehearsal

The fresh encrypted backup restores successfully. Migrations 102–114 and all
13 focused SQL suites pass in the network-disabled rehearsal, with catalog,
Data API guard and spatial checks passing before and after migration.
The first rehearsal exposed a test assumption: closing a support chat may assign
an existing queued chat to the synthetic agent. The FIFO test now reserves one
remaining slot relative to the current shared workload, retaining oldest-first,
full-agent denial and automatic next-assignment assertions. No application or
production data change was needed. Evidence:
`.local/release-web-20261005-rehearsal-recheck.log` and
`.local/release-web-20261005-restore-evidence.json`.

## October 5 release verification — deployment pending

The owner reconnected the Supabase CLI and restricted operations to Loadgistic.
The refreshed login independently verifies project `tpwyyzoqijjmbvsmmvcm` as
`loadgistic`, ACTIVE_HEALTHY. Read-only catalog, guard and spatial checks pass:
ledger 101, PostGIS 3.3.7 in extensions, no unprotected public tables. Advisors
have no ERROR findings; the existing identity-function and password-protection
warnings remain visible. No hosted settings or database records were changed.

CI 37261732055 blocked the previous candidate on new Nodemailer advisories.
The exact 10.0.14 upgrade passes a zero-vulnerability audit, 372 quality tests,
source/spec/type checks, 24 focused email checks and two desktop/phone Tracking
email-session workflows. Local SMTP delivery to the isolated Mailpit inbox also
passes. The parser regression times out against 9.1.1 and completes in under one
second against the patched version. The interrupted prior browser run is not
counted as passing evidence; its controlled rerun passes without test changes.

Evidence: `.local/release-20261005-quality.log`,
`.local/release-20261005-email-session-recheck.log`,
`.local/release-20261005-dependency-audit.json`, and
`.local/release-web-20261005-preflight.json`. Exact-candidate CI, immutable build,
fresh backup/restore rehearsal and bounded production rollout remain required.
The local preview remains at http://127.0.0.1:3100.

## October 4 release follow-up — pending verification

CI 37255530257 correctly rejected the new raw capacity identifier in the public
Featured projection. The follow-up keeps that field internal and exposes only a
relative map link for Open Empty/Partial signals. The unchanged private-key gate
and direct local signal checks pass; both browser handoffs pass again. Quality
now passes 371 tests plus source/spec/type checks. No privacy check was relaxed.

CI 36526691594 passed validation, container and browser shards 1/3; shards 2/4
identified the remaining blockers. Featured's Find this truck action incorrectly
used a vehicle number after search became profile-only. The correction searches
the provider handle and selects the public capacity ID. Phone heading spacing
retains the existing first-row budget. Private logout now checks the canonical
unified route. Measured private-map edge discrepancies were fractional scroll
rounding (0.03125px tablet bottom, 0.84375px phone top); only those comparisons
allow one CSS pixel, preserving minimum map height and overflow checks.

- [x] Inspect failures and reproduce against the retained local fixtures.
- [x] Verify focused desktop/phone workflows and quality checks.
- [ ] Pass exact-candidate CI and immutable draft checks.
- [ ] Refresh backup/rehearsal/security evidence, apply bounded migrations and deploy.

No production database write or publication has occurred. Prior September 29
backup evidence is stale for rollout and must be refreshed.
Eight focused browser workflows and all 370 unit/contract tests, source/spec
checks and typecheck pass (`.local/release-20261004-focused.log` and
`.local/release-20261004-quality.log`). Netlify confirms the previous deployment
6ab3aaa9668f9644dcba97d8 remains ready. The saved Supabase management credential
now returns HTTP 401; owner reconnection is pending before fresh advisor checks
and any production operation.

## September 29 release verification follow-up — not deployed

CI `36394072342` at `1690d10` passed validation (including scale/build) and
container checks, but failed the required browser gate. Release remains pending.
The follow-up corrects pre-hydration input races in private email access and
brokerage assignment/follow-up, isolates a chat test from shared rate-limit
buckets, keeps portrait test data within the eight-showcase maximum, and updates
browser assertions for the previously approved navigation/copy/disclosures.
A cold local PostgREST schema timeout gets one bounded read-only retry before
any fixture writes. No hosted settings, database writes or deployment occurred.
Map-search diagnostic evidence shows real zoom changes with no extra request;
geometry and real touch-target checks remain intact. A real short-viewport defect
also passed gestures through the signal description to document controls beneath
it; the description now receives gestures inside Leaflet and bubbles them to the
map. Desktop/phone wheel, drag and swipe checks pass without a layout change.

The final focused rerun passed 10/10 desktop/phone checks for private OTP/filter
reset, portraits, closed-area/route overlap and summary wheel zoom. The refreshed
preview also verified admin navigation, Featured controls and disabled-before-
hydration fields with the first assignment persisted. Evidence is in ignored
`.local/release-20260929-*.log` and `artifacts/release-*-20260929/` files. A new
exact-candidate CI result is still pending. Read-only production checks at
2026-09-29 05:26 UTC passed with PostGIS in `extensions` and no unprotected public
tables. The earlier backup/rehearsal is being refreshed before any mutation.

# Progress

## Active October 10 narrative correction

October 11 steering: publication is held for the owner's Featured/Tracking crash
and world-zoom map reports. Both local preview servers had stopped and are now
restored on verified free Loadgistic ports, using local Supabase at 55321.
Read-only live Featured currently returns eight trucks, seven weekly themes and
twelve programme entries. That response is not runtime or rotation acceptance.
Fixed-pixel mobile route offsets demonstrably grow to hundreds of kilometres at
world zoom; camera/query race verification is also required. Continue from:
- [x] Reproduce Featured and Tracking navigation, including restored private access in both browser adapters.
- [x] Regress and bound native/web route offsets; discard stale camera query results.
- [x] Verify round completion/restart and manual precedence against saved records in rollback-only local tests.
- [ ] Verify actual browser and Android flows, then resume the reviewed release.

Confirmed local Featured cause: the Sunday capacity lookup passes 236 UUIDs in
one URL and receives HTTP 414 (`URI too long`). Local containers have been
restarted without resetting their data. Their ledger ends at 129 with historical
gaps, but current policy tables/functions already exist. A backed-up attempt to
apply exact 130–136 stops on the 130 drift assertion and rolls back completely;
do not replay migrations, reset fixtures or repair the ledger from assumptions.
Seven focused current-policy/Featured/Tracking SQL suites pass against the actual
catalog with all mutations rolled back. No hosted write occurred.
Implement bounded candidate reads, regress small-zoom geometry and asynchronous
camera revisions, then verify real navigation and saved Tracking access. Preserve
the existing no-repeat selection rounds and manually scheduled days; the owner
clarified that exhaustion means a new selection round, not a new carousel UI.

Local repairs: candidate UUID batches are capped at 100 and row reads paginate
500 at a time, including the public provider RPC. A 1,105-truck regression with
1,100 historical signals verifies complete reads and newest private-signal
precedence; batch errors do not return a partial roster. Web Featured offers
localized refresh/navigation on a known data failure rather than crashing.
Both map adapters use bounded lane projection (less than 1km maximum join
displacement), keeping closer-zoom separation and real matching coordinates.
Native rendered queries reject old camera/data revisions and unmounted results.

Tracking's actual browser reproduction found a raw empty string inside a native
Card, raising an error overlay that blocked the navigation. Boolean guards repair
that condition and the same unsafe conditions in capacity, profile, transporter,
chat history and alert controls. The typed JSX regression scans every mobile
screen; it distinguishes raw string/zero from safe Boolean conditions. Featured
and visitor Tracking additionally validate response shape before rendering.

Focused evidence: 27 native logic/text regressions and 17 root candidate/lane/
public-projection regressions pass; seven rollback SQL suites pass. The real
phone-sized web email workflow verifies access, reload, revocation and expiry.
Two Expo-web workflows verify actual navigation, real local OTP, persisted
Tracking access, detail, malformed-response recovery and closure. The web outage
probe verifies navigation and refresh recovery. Twenty-four wheel operations per
map, native selected-truck exit and actual world-view captures have no runtime
errors. Screens and protected receipts are under `.local/`; these browser checks
do not certify a newly installed Android binary or closed-phone GPS/push.

Root/native typechecks, native lint and source/spec checks pass. No new CI run,
EAS build, deployment, Play submission, hosted SQL/configuration mutation or social
post is claimed. The code-5 artifacts predate these repairs and revised narrative.
The owner approved the actual previews on October 11. Full local quality passes
495 root tests, 149 mobile tests and native lint; exact release build, current CI
and replacement 1.0.5/code-6 binaries remain required before publication. Play permission video and physical acceptance
remain distinct from JavaScript compilation and browser evidence.

October 11 approved release gates: production Next build and mobile typecheck
pass, Expo Doctor passes 21/21, and strict translations cover 491/491 messages.
The actual Android Hermes export is 5,101,524 bytes and excludes private/service
credentials; EAS archive verification compares all 384 inputs with current source.
An initial Chromium launch was sandbox-denied. The permitted run passes eight
browser cases; two email cases time out during concurrent emulator/compilation
load. The unchanged focused recheck passes all four desktop/phone email cases after
parking only the owned emulator. Failure evidence and request limits are retained. Current
replacement version is 1.0.5/code 6; remote CI and installation remain required.


Owner direction: make the app, Play presentation and prelaunch campaign about
brokers and shipping teams keeping transporters' reported capacity, routes and
availability together in one map. Private Tracking supports already agreed work.
Use credible East African freight operations in promotional art; retain generated
art provenance and avoid paid-subscription, platform-owned-fleet, automatic-alert
or guaranteed-capacity claims.

Ordered work (FEAT-MKT-001 / FEAT-PLY-001):
- [x] Record the controlling meaning and acceptance criteria before editing copy.
- [x] Reuse the existing public/private map layout with shared web/native copy and
  contextual Amharic, Afaan Oromo, Somali and Tigrinya wording.
- [x] Align About, metadata, Play copy, artwork and screenshot order in local sources.
- [x] Run focused language/rendering checks and provide actual local previews.
- [x] Owner approved the revised Featured/Tracking/map presentation and promo previews on October 11: “Approve and continue release.”
- [ ] Publish only verified artifacts to the authorized testing tracks; keep
  Google review, twelve opted-in testers and physical-device acceptance distinct.

The prior native repair is separately built as 1.0.4/code 5 at commit
`9aa8aae826f0f903b15cf063d3f23c475f835803`; all eight CI jobs pass. Both artifacts
are downloaded, the APK is installed in the isolated Loadgistic emulator, and the
final merged APK/AAB permission checks pass. This does not approve the new copy.

## Simpler Tracking access — local review ready, 2026-09-28

FEAT-TRK-001 / FEAT-REV-001, ADR-073. Owner requested fewer codes and a
30-minute session like private capacity. Ordered plan:

- [x] Inspect current access, email, recipient/review authorization and session controls; consult OWASP session guidance.
- [x] Add email-only OTP and a paginated authorized-shipment list; keep all reads and reviews recipient-scoped.
- [x] Replace repeated shipment/review codes with the verified email session; add activity-only 30-minute renewal, logout and an eight-hour absolute limit.
- [x] Update provider handoff, emails and four language dictionaries.
- [x] Verify SQL denial, OTP replay/expiry/revocation, cookie/session behavior, visible email delivery and desktop/phone flows.
- [ ] Owner visual approval, then full release gates and reviewed rollout. No hosted writes in this task.


Evidence: [Tracking access review](TRACKING_ACCESS_REVIEW_2026-09-28.md).
47 focused unit tests, rollback SQL, catalog security, TypeScript and source/spec
checks pass. Eight distinct desktop/phone workflows pass across recorded runs,
including visible Mailpit verification, owner-only reviews, private proof access
and 30-minute inactivity expiry. Early navigation/server/harness failures remain
recorded with their corrections. Screenshots:
`artifacts/tracking-session-expiry-20260928/`. Preview:
http://127.0.0.1:3100/track. Owner visual approval is pending; no deployment,
production email, hosted configuration/database change or Git publication.

## Fleet and location audit — local review ready, 2026-09-28

See [the audit and evidence](FLEET_WORKFLOW_AUDIT_2026-09-27.md). Migration 113
removes the driver-location/owner-publication dead end, preserves restricted-driver
Off Duty recovery and rejects incomplete GPS. Assignment links retain the truck;
saves have bounded failure handling; location guidance is translated. The owner
map preserves its center on layout changes, and successful Tracking saves are no
longer aborted during cleanup.

Thirty-five focused unit tests, seven rollback SQL suites, catalog security,
TypeScript and source/spec checks pass. Twenty-six distinct desktop/phone cases
pass across recorded runs, including real local email-code onboarding for all
three provider types, driver assignment/permissions, publication, recovery and
retirement. Separate failed/interrupted runs and external tile availability are
recorded rather than counted as passes. Final map screenshots:
`artifacts/fleet-first-map-review-20260928/`.

No hosted changes, commit or deployment. Owner visual approval remains pending
at http://127.0.0.1:3100 before extensive release gates and fresh migration
102–113 rehearsal. GPS is simulated in automation; real-device GPS and native
language review are separate limits. The same preview is running; see the Tracking follow-up for its latest server log.

## Shipment-focused load filters — local review ready, 2026-09-27

Remove the visitor Capacity signal selector, expose load-space needs prominently,
and let existing current/regular route and area matching run automatically.
Owner confirmed space needed (full truck/shared space), not goods categories. Verify full/shared load
matching, geographic inclusion, reset and phone UI before owner review.

Implemented Space needed (Any load size / Full truck / Shared truck space),
removed visitor geometry/area selection, retained provider-side signal editing,
and prevented conflicting Partial availability when Full truck is chosen. Two
desktop/phone browser cases pass, including all four translated catalogs, actual
map/profile results and reset. Rollback SQL verifies automatic route and area
inclusion through public and private matching functions, plus accepted full/shared
load restrictions. TypeScript/source/spec checks pass. Evidence:
`artifacts/capacity-load-needs-final-20260927/`; logs `.local/discovery-search/load-needs-*`.
Local preview remains running; owner visual approval and rollout are pending.

## Illustrated configuration picker — local review ready, 2026-09-27

Owner requested truck pictures in the map configuration selector. Reuse the
existing catalogue art and preserve single-selection filter values. Desktop/phone
checks pass for all catalogue images, selected preview, keyboard arrow selection,
apply, actual map filtering and Any configuration reset. TypeScript/source/spec
checks pass. Screenshots: `artifacts/capacity-configuration-pictures-review-20260927/`.
Fixed keyboard-triggered premature collapse and desktop fieldset width during
verification. Preview remains at http://127.0.0.1:3100, Filters → Truck configuration.
Owner visual review and deployment remain pending.

## Profile search and matching truck map — local review ready, 2026-09-27

- [x] Record FEAT-MKT-001 / FEAT-LST-001 acceptance and owner choice: only entities with matching available trucks.
- [x] Add safe ranked PostgreSQL search, office city and reviewed-document filters across open/private maps.
- [x] Replace sidebar filter inputs with distinct paginated search cards; move all filters into the lightly shaded modal.
- [x] Translate UI and verify relevance, privacy, document scope, pagination and desktop/phone workflows.
- [ ] Present the running local preview for owner visual approval, then resume accumulated release gates.


Owner simplification: remove Office city and its Search filters group from the
dialog. Main search continues matching published profile office cities; reported
truck-location filters remain separate. Four focused desktop/phone cases pass,
including city search and all translated filter layouts, in
`artifacts/capacity-city-search-20260927/`. Rollback SQL confirms office-city text
matches profiles and associated map trucks; TypeScript and source/spec checks pass.

Owner clarified: the list contains user/company profiles only; the map contains
matching available truck/driver pairs. Search matches public profile details,
while truck filters control matching capacity. Remove the result-type selector
and truck result cards. Companies remain result cards only. Eight focused drawer/map/reset cases passed before the final profile-only
revision. All six revised desktop/phone cases now pass across
`artifacts/capacity-profile-search-20260927/` and
`artifacts/capacity-profile-search-final-20260927/`, covering public/private
profiles, company map scoping, filters, pagination, access revocation, retry and
all four non-English layouts. Rollback SQL confirms driver-specific map scope,
complete company pairs, no truck-only text matching and no private-contact search.
Nine focused unit checks, TypeScript and source/spec checks pass. One initial
desktop attempt exceeded the UI timeout during local recompilation; its unchanged
case passed on the controlled retry. Migration 112 remains local only. Preview:
http://127.0.0.1:3100; owner visual approval precedes extensive release gates.

## End chat and keep telephone follow-up — local review ready, 2026-09-27

Owner chose to retain the request for staff calls after a visitor ends messaging.

- [x] Record separate chat-ending and request-resolution acceptance in FEAT-TRQ-001.
- [x] Add scoped, idempotent visitor ending; preserve request ownership, contact and history.
- [x] Add Active chats / Follow-up / Resolved views and usable contact/history/resolution controls.
- [x] Translate the ending/confirmation/history flow in all supported languages.
- [x] Verify database permissions, real customer/staff flows, retries and phone layouts.
- [ ] Keep the local preview available for review, then resume the authorized web release with migration 111 included in fresh rehearsal and exact-candidate gates.

Focused evidence: all four waiting/assigned end-chat browser scenarios pass on
desktop and phone in `artifacts/chat-follow-up-final-20260927/`, covering cancel,
failed-end retry, preserved drafts/history, new chats before old request resolution,
staff phone follow-up and Resolved. Locale confirmation screenshots cover all four
non-English catalogs. Eight focused unit checks, three rollback SQL suites,
database security, source/spec and TypeScript checks pass. Evidence logs:
`.local/chat-follow-up/`. Migration 111 is local only; the prior isolated release
rehearsal covers 102–110 and must be refreshed to include 111. Local preview stays
at http://127.0.0.1:3100; new flow approval is requested before extensive gates.

## Live chat presentation — active, 2026-09-27

Owner paused the requested web deployment to make the transport conversation clear
and welcoming. Preserve the existing protected Brokerage workflow and four fields.

- [x] Record FEAT-TRQ-001 acceptance: visible Live chat entry, one panel title, clear Start chat action and useful conversation prompt; no invented presence.
- [x] Update responsive UI and all four non-English catalogs.
- [x] Verify entry, draft recovery, submission and actual two-party replies on desktop/phone; keep local preview running.
- [x] Owner approved the revised chat and explicitly instructed deployment to resume.
- [ ] Finish focused verification, pass exact-candidate release gates, rehearse pending migrations against a fresh backup, then publish and verify live.

Focused evidence: 14 distinct browser cases pass across
`artifacts/brokerage-chat-entry-20260927/` and
`artifacts/brokerage-chat-entry-final-20260927/`, including real replies,
reconnect, draft recovery, map-control separation and all five languages at 320px.
The first run loaded two outdated test assertions; the corrected cases passed in
the final focused run. Source/spec, localization and TypeScript checks pass.
Full quality also passes all 363 cases after correcting four stale source-contract
checks for already-approved Help retirement, map routing, theme and OTP copy.

The owner then requested a way for visitors to end a waiting/assigned chat and
start again, and confirmed that staff should retain telephone follow-up. That
addition is implemented locally in migration 111 and awaits visual approval.
Production is unchanged; read-only
security checks pass (ledger 101, PostGIS in extensions, no ERROR advisor findings).

Release preparation: fresh encrypted database backup passed authenticated recovery
and a complete isolated restore; all nine pending migrations 102–110 and their
focused rollback regressions passed in a network-disabled disposable container.
Catalog, API guard and spatial checks pass before/after. Evidence:
`.local/release-web-20260927-{backup,restore-evidence,preflight}.json`.
The container was removed. Live site remains deployment
`6ab3aaa9668f9644dcba97d8` at https://loadgistic.com, database ledger 101.

The broad legacy local SQL suite stopped because the manually reviewed local
preview uses owner Gmail aliases while that suite expects original `.local` fixture
emails. No database reset or assertion weakening was performed; run this suite in
CI's clean fixture environment. Full CI/immutable build, visitor-ending visual approval,
production migrations and publication remain incomplete. No commit or push yet.


## Live Brokerage and mobile readiness — active, 2026-09-27

- [x] Confirm live brokerage conversation, separate from provider Support; specify FEAT-TRQ-001.
- [x] Add durable private messages, browser recovery, staff replies and queue attention indicators.
- [x] Verify authorization, duplicate prevention, reconnect, handoff/closure and desktop/phone interactions locally.
- [x] Record Expo monorepo readiness, reusable code and native-specific gaps without moving the web app yet. See `docs/MOBILE_MONOREPO_READINESS.md`.
- [x] Keep http://127.0.0.1:3100 running: Arrange transport → send the four-field form → conversation. Brokerage → Unassigned → claim → Mine → Open conversation.
- [ ] Owner visual approval, then full release gates and separately authorized hosted migration/deployment.

Evidence: ten focused unit/localization/provider-support cases, rollback-only
Brokerage conversation and assignment SQL checks, catalog security, source/spec
and TypeScript checks. Eight distinct browser cases pass across
`artifacts/brokerage-live-reviewed-20260927/` (two-party messaging, restored history,
reconnect, translations, error/double-submit) and `artifacts/brokerage-followup-20260927/`
(retained admin follow-up, stale saves and closure), covering desktop and phone.
Logs and protected pre-change local schema snapshot: `.local/brokerage-live/`.

Migration 110 is local only. Active chats poll every three seconds with conditional
responses, visibility/panel pauses and backoff. No Supabase Realtime publication,
production settings, native dependencies or mobile app was added. Recovery is
same-browser for seven days; there are no push/SMS/email alerts or fabricated agent
presence. Staffing the queue remains an operational requirement. Fixed during review:
restoration was unmounting unsent forms on reopen, and the modal could clip its
composer; draft retention and translated full-button checks now cover both.


## Unified capacity map — local review ready, 2026-09-27

- [x] Record FEAT-SHR-001 / FEAT-LUX-001: Open to the public by default; Privately shared with you starts with an empty map until email-code verification.
- [x] Combine routes, navigation and introduction; preserve legacy links and recipient scope through filters, Clear all, switching views and logout.
- [x] Translate the choices, access copy, screen-reader labels and related About narrative in Amharic, Afaan Oromo, Somali and Tigrinya; English remains the source language.
- [x] Verify the real local email-code flow, recipient isolation, no-share behavior, navigation history and responsive layouts. Keep the email action clear of the floating transport-request button on phones.
- [x] Keep http://127.0.0.1:3100 running for owner review. Choose both views and use the language selector; `/shared-capacity` remains a compatible private-view entry.
- [ ] Owner visual approval, then full release gates and separately authorized deployment. No hosted changes.

Evidence: ten distinct desktop/phone browser cases in `map-introduction.spec.ts`
and `unified-capacity.spec.ts` pass across the final run and the focused copy rerun.
Artifacts: `artifacts/unified-capacity-final-20260927/` (map dimensions, HTML,
OTP/recipient/filter/logout) and `artifacts/unified-capacity-copy-20260927/`
(final labels, translations, About, 320px phone action clickability).
Ten focused localization/private-access unit tests, source/spec checks and TypeScript
pass. Logs: `.local/unified-capacity/`. The unchanged 30-minute expiry logic has
unit coverage; this task does not claim a new browser idle-expiry run.

Verification repairs: an interrupted old dev process was restarted on the same
local port; streaming/loading duplicates and an inline-text selector were corrected
in tests. Temporary local grants from interrupted checks were revoked. A phone
screenshot exposed the floating action crowding the form; spacing and an actionable
button assertion now cover it. Translation checks establish coverage and layout,
not native-speaker approval. The earlier no-JavaScript streaming limitation remains.

## Map introduction — local review ready, 2026-09-25

- [x] Confirm Loadgistic-only scope and record FEAT-LUX-001 acceptance.
- [x] Replace header slogan with a compact introduction above Open capacity; update descriptive metadata and all supported languages.
- [x] Check initial HTML, responsive layouts, translated copy and map/filter controls locally.
- [x] Keep http://127.0.0.1:3100 running for owner review.
- [ ] Owner visual approval; no deployment or full release gates yet.

Evidence: four introduction/HTML browser cases and two existing map-shell cases
pass across desktop and phone, including 320–2560px breakpoints and all five
languages. Source/spec, localization and TypeScript checks pass. Screenshots:
`artifacts/map-introduction-final-20260925/`; logs: `.local/map-introduction/`.

Existing limitation discovered: root route loading uses Next streamed HTML. The
introduction is present in the response, but a browser with JavaScript disabled
leaves the streamed route hidden. The focused SEO check verifies real HTML text
and metadata; the normal browser test separately verifies visible copy. Full
no-JavaScript route rendering would require a loading-boundary change beyond this
presentation task; record for a later SEO/accessibility review, not as fixed.


## Freight vehicle catalogue — local review ready, 2026-09-25

- [x] Remove courier choices; database guard rejects new/changed courier configurations.
- [x] Use Mixed trucks for Sunday's preview; preserve Mon–Sat and global no-repeat selection.
- [x] Convert 16 verified local demo vehicles, preserving driver identities, assignments, 12 existing signals and the entire selection ledger. Add four demo signals for the recently added pairs; retain eight Sunday slots.
- [x] Replace the container illustration with a half-length container on a visibly exposed flatbed; change public entry to Transporter login in all five languages.
- [x] Focused unit/SQL and desktop/phone review; preview remains http://127.0.0.1:3100.
- [ ] Owner visual approval, then extensive release gates. No hosted changes or deployment.

Evidence: 41 focused unit/catalog/localization tests; SQL registration/edit rejection
and browser-role denial; catalog security; six desktop/phone browser cases across
`artifacts/freight-catalogue-20260925/` and
`artifacts/freight-catalogue-featured-20260925/`. Protected plan, pre-change backup,
rollback rehearsal, apply receipt and projection checks: `.local/freight-catalogue/`.
All 16 pairs remain Featured-eligible; map projection retains eight public and eight
private signals; Sunday projection has eight cards. Global-round SQL regression, source/spec checks and TypeScript also pass. First review harness incorrectly
expected the closed Week disclosure to expose a long label and exceeded the map's
12-ID scope limit; corrected tests use the actual disclosure and bounded batches.

The following older courier inventory plan is superseded by this retirement.
The broader per-category versus global repeat-policy decision remains unresolved;
this task preserves the global rule and does not promise eight pairs every future day.

## Featured demo inventory — active, 2026-09-24

Owner requests enough correctly typed demo truck/driver pairs to fill eight daily
showcases with different pairs the following week. This is local demo setup only;
no production/customer inventory is created. Preserve current assignments/history.

- [x] Inspect theme eligibility and rotation: 61 mini, 15 van, 15 pickup, 15 light,
  9 medium, 16 heavy, 12 courier pairs; current global round creates sparse days.
- [ ] Owner decision: independent category rounds versus balanced global rounds.
- [x] Add 14 eligible local demo pairs using owner Gmail aliases and verified existing demo
  fleets; protected plan/receipt/backup retained in `.local/featured-demo-inventory/`.
  Existing accounts, assignments, history and all production data are unchanged.
- [ ] Verify eligibility, category matching, two-week coverage and no repeats.
- [x] Fill saved local automatic Friday (+7) and Sunday (+4) to eight with unselected
  new demo pairs; rollback rehearsal preserved old slots/history and past/manual days.
- [ ] Keep local preview running for visual review; no hosted writes/deployment.


## Provider-only live support — local review ready, 2026-09-24

- [x] Record owner clarification: all transport-provider users, including company drivers, retain dashboard live support.
- [x] Replace public chat with the single asynchronous transport request.
- [x] Deny new guest chats/replies and restrict member writes to providers, retaining authorized history.
- [x] Verify guest denial, provider/staff conversations and mobile/desktop request flows.
- [ ] Local visual approval before extensive gates or deployment.

Current policy supersedes the former public Help/dual-button evidence below.
Local migration 108 is applied; protected function backup and rollback rehearsal
preserved every record in all six support tables. No remote changes.
Eighteen focused unit/catalog tests, four SQL regressions, catalog security and
managed Support verifier pass. Desktop/phone public request, archived history and
Brokerage staff workflows pass. Three provider identity types pass on both viewports. The final navigation checks
also pass for limited-plan dashboards and More menus. Twenty-six distinct focused
browser cases pass across the final relevant runs (18 public/archive/request,
six team/Brokerage, two provider workflows). Source/spec checks and TypeScript pass.
A cold-render test tried typing before client hydration; the corrected check waits
for visible messages and the enabled language control and verifies the actual POST.
Logs: `.local/provider-support/`. Screenshots: `artifacts/provider-support-20260924/`,
`artifacts/provider-support-teams-20260924/`, provider identity/navigation captures.
Preview: http://127.0.0.1:3100 (Arrange transport); dashboard /app/support.
Owner visual approval remains required before extensive gates or deployment.
No commit, push or hosted writes this pass. Existing unrelated edits are preserved.

The owner's one-truck Featured question was investigated read-only: local Ethiopia
Friday September 25 has one remaining medium-duty pair out of nine, with eight
selected September 18; Thursday has seven. Live still shows eight under the older
schedule. Sparse-day pacing is recorded in FEATURED_READINESS_2026-09-24.md;
no unapproved repeats, mixed categories or roster edits were made.

## Transport form simplification — 2026-09-24

Owner refinement: keep only “Let us arrange your transport”; remove the repeated
Managed transport heading and label submission “Send request”, including all four
translations. Existing private Brokerage submission and follow-up are unchanged.
Focused desktop/phone form verification passed; no deployment.

## Managed transport request wording — local review ready, 2026-09-24

- [x] Record approved wording and preserve the four-field Brokerage callback contract (FEAT-TRQ-001).
- [x] Update launcher, request window, fee note, receipt and all four translations.
- [x] Check desktop/phone submission, separate Help and private follow-up; capture review evidence.
- [ ] Owner visual review before extensive release gates or deployment.

“Arrange transport” opens “Let us arrange your transport”, with Managed transport,
document review/coordination/shared tracking description, agreed-service/fee note,
“Request a callback” and transport-team phone receipt. The same four fields feed
the private Brokerage queue. Help remains separate; no automatic verification,
shipment creation, tracking access, fee collection or email was added.

Seven focused unit/catalog tests, TypeScript and source/spec checks pass. Eight
existing desktop/phone browser cases pass, including actual request → private admin
follow-up, no email, duplicate protection, error recovery, separate Help and draft
preservation. Four language phone previews fit; translations have contextual entries
in all supported catalogs, without a native-speaker approval claim.
Screenshots: `artifacts/managed-transport-20260924/` and
`artifacts/managed-transport-languages-20260924/`; logs: `.local/managed-transport/`.
Local review: http://127.0.0.1:3100 — choose Arrange transport. No production writes,
full release gates, commit, push or deployment in this wording pass.

## Official Featured broadcast window — local review ready, 2026-09-24

- [x] Inspect automatic timing, sponsor insertion, manual editing and saved-day compatibility.
- [x] Set 08:30–12:00 EAT, eight-showcase ceiling and four two-minute mentions.
- [x] Preserve historical/manual days and retime future automatic days without redrawing pairs.
- [x] Verify timing, persistence, permissions and desktop/phone editing; keep preview running.
- [ ] Owner visual review before extensive release checks or deployment.

Owner confirmed eight showcases and four two-minute sponsor mentions. Existing no-repeat selection is retained.

Migration 107 is local only. Four future automatic days retimed; all 17 saved days,
106 slots and 100 selection-history rows retained. Historical/manual content was
compared in a rollback rehearsal. Eighteen focused unit tests, three SQL suites,
catalog security, source/spec and TypeScript checks pass. Four desktop/phone
browser cases verify real save/publish/reopen/resave, four sponsor mentions and
public historical-hour rendering. The test caught and fixed an existing native
JSONB manual-time parsing bug; reordering now preserves slot times. Synthetic
future days and sponsors were removed (both counts zero).

Review: http://127.0.0.1:3100/admin/featured?date=2026-09-26#featured-day-editor
(eight-truck local saved day). Screenshots: `artifacts/featured-broadcast-complete-20260924/`
and `artifacts/featured-broadcast-public-20260924/`. Logs: `.local/featured-broadcast/`.
Automatic timing prepares a running order; staff still conduct TikTok and arrange
sponsors. No full quality/build/remote gates, commit, push or deployment this pass.



## UI wording and Featured readiness — local review ready, 2026-09-24

FEAT-LUX-001 / FEAT-FTR-001 / FEAT-LNG-001. Only Loadgistic.

- [x] Inspect public/member/admin copy and automatic Featured/manual controls.
- [x] Owner clarification: transport is a callback request; remove shared chat-presence wording and verify separate receipt/Brokerage workflow.
- [x] Remove redundant map/UI captions and correct misleading/internal wording.
- [x] Make automatic Featured status, upcoming days and manual intervention understandable.
- [x] Verify random-round preservation, telemetry, permissions and manual override.
- [x] Add the owner-approved separate Featured team permission (migration 106), including grant/revoke and narrow settings access.
- [x] Capture desktop/phone and provide the running preview for owner review.
- [ ] After visual approval, run release gates; deployment remains a later step.

The scheduled worker is configured every 15 minutes in Netlify source. That alone
does not prove a healthy hosted worker. Preserve random weekly subsets, no-repeat
rounds, the 07:30–09:00 Ethiopia window and existing manual days. Owner approved
separate default-off Featured authority. It combines with other independently
assigned responsibilities; revoking it does not revoke Support, Brokerage, Billing
or customer access. A multi-responsibility account is labeled Platform team.

Focused evidence: 33 unit tests, source/spec checks and TypeScript pass. Local
migrations 105–106 and the catalog gate pass, including run failure rollback,
active authority, grant/revoke/suspension, combined permissions, settings isolation,
changed truck type, saved days and no-repeat rounds. All four SQL suites pass:
featured-operation-status, featured-team-permission, featured-random-rounds and
brokerage-assignment. No hosted migration or provider configuration changed.

Six desktop/phone UI-copy/Featured cases pass. Two new staff workflow cases pass
real email-code login through local Mailpit, admin grant, Featured settings/Prepare,
manual draft/publish, sponsors, combined navigation and independent revocation.
Four callback submission/recovery cases and four public-panel cases pass: transport
is a phone callback into Brokerage, never a live-help conversation. Four Open/Private
map-drawer cases pass, including the unchanged mobile city-filter recheck.

Initial runs exposed a mobile hidden explanation (fixed), five-second assertions
against still-loading dev pages (bounded readiness waits), and synthetic cleanup
blocked by its last-editor FK (restore the prior test metadata before deletion).
An interrupted local run is retained as failed evidence; later final cases pass.
A fresh read-only Featured console inspection reports no hydration/nesting/key or
page-error categories and no issue button. Local test accounts/days/sponsors are
cleaned; newly prepared current-week days and existing fixtures are preserved.

Final captures: artifacts/featured-readiness-final-20260924/,
artifacts/ui-copy-polish-20260924/, artifacts/featured-public-polish-20260924/,
artifacts/featured-permissions-verified-20260924/,
artifacts/featured-callback-final-20260924/, artifacts/callback-dock-verified-20260924/
and artifacts/map-drawer-verified-20260924/. Earlier failing captures remain for
honest comparison; see .local/featured-review/ for logs.

Preview: http://127.0.0.1:3100 — inspect Open capacity, Request transport versus
Ask for help, and /admin/featured. At /admin/support → Platform team, Featured is a
separate responsibility. Staff guide: docs/operations/FEATURED_PROGRAMME.md.
Findings/limits: docs/FEATURED_READINESS_2026-09-24.md. Themed no-repeat rounds can
leave days empty; saved manual drafts block automatic publication. Do not silently
change those policies. Hosted job execution still needs post-rollout observation.

Owner visual approval, then extensive release checks and explicit deployment
remain open. No deployment, external mail or production write in this pass.


## Separate brokerage and support teams — local review ready, 2026-09-24

FEAT-TRQ-001 / FEAT-GST-001 / FEAT-SUP-001. User requires both enquiries to
reach working team queues, with assignment and admin oversight. Brokerage is
a separate staff permission (off by default), independent of Support.

- [x] Inspect existing guest assignment, admin-only transport queue and staff capabilities.
- [x] Add reviewed assignment/scope contracts and additive local migration 104.
- [x] Implement brokerage queue, claims, admin reassignment, activity and staff setup/navigation.
- [x] Verify negative SQL permissions, concurrent/stale actions and permission revocation.
- [x] Exercise both public enquiries through their real local team workflows and capture phone/desktop.
- [x] Present running preview and focused screenshots.
- [ ] Owner visual approval, then extensive release gates and a separately authorized rollout.

Evidence: local migration 104 and its refinement rehearsed in rollback before
applying to `supabase_db_loadgistic-local`; resulting catalog security gate passes.
`tests/sql/transport-requests.sql` and `brokerage-assignment.sql` pass, including
cross-team denial, scoped contacts, stale writes, requeue/reopen after access loss,
private history, unavailable Support staff and chat-capacity rejection.

Six brokerage browser cases pass across desktop and phone (submission-to-teams,
competing claims/revocation, responsive navigation/header). The final complete
workflows additionally verify real email-code staff login through local Mailpit,
admin account creation/handoff, a reply reaching the public guest, closure,
conditional 304 polling, and an assignment draft rejected after a background update.
Four public assistance dock cases also pass. Thirty focused unit tests pass.
TypeScript and source/spec checks pass; full release checks await owner review.

Captures: `artifacts/brokerage-final-20260924/` (complete workflows),
`artifacts/team-queue-final-20260924/` (final header/navigation/FIFO claim),
`artifacts/team-workflows-final-20260924/` (dock and claim race).
The phone check caught a staff-create form behind fixed navigation; it now stays
above it. The initial cold dev login exceeded a five-second assertion but reached
the correct page; the test now allows a bounded 30-second redirect wait.
Screenshots also caught a long guest email crowding its status; wrapping now keeps
both in the viewport. Synthetic test records were cleaned, including one receipt-
assertion leftover. Existing fixtures and accounts were preserved.

Preview: http://127.0.0.1:3100 — admin Support → Platform team for responsibilities,
Brokerage for transport requests, Support → Guest support for general enquiries.
A final existing-queue defect is corrected: Support Waiting previously offered
Claim on every row although the command accepts only the oldest. The projection
now exposes eligibility from current availability, shared chat capacity and FIFO
order; other rows stay visible without an invalid Claim button. SQL verifies that
closing work preserves automatic assignment of the next waiting chat. The focused
phone/desktop queue test verifies normal Claim and persisted ownership. Staff-
selector scaling limits remain documented in the guide.

Staff guide: `docs/operations/TEAM_INQUIRY_WORKFLOWS.md`. No production writes,
real team invitations or deployment. Local migration 104 is not a hosted repair
or release claim.

## General help wording correction — 2026-09-24

Owner clarification: Ask for help is for general questions, issues and disputes;
Request transport remains a separate enquiry. Update the chat introduction and
example, related recovery/staff labels and all four translations, preserving
existing permissions, contact requirements and conversation history.

- [x] Apply contextual support copy and verify desktop/phone preview.
- [ ] Owner review before release gates; no deployment requested.

## Launch clarity and contextual language — revised entry ready for local review, 2026-09-24

FEAT-LUX-001 / FEAT-LNG-001. Preserve pending callback/map work and production.

Latest correction: select the task only with the outside floating buttons; remove
the internal Help options tabs and preserve the selected task when reopening.

- [x] Implement one-task panels and focused desktop/phone verification.

One-task panel evidence: eight focused desktop/phone checks pass for initial
hydration, chat start/reply/attachment/end/restart, outside-button selection,
draft retention, no internal selector, restored request mode and unread support
messages remaining unread while only the request panel is open. TypeScript,
source/spec and whitespace checks pass. Captures:
`artifacts/single-assistance-panel-20260924/` (help-panel and request-panel for
desktop and phone). Local preview remains on port 3100; revised visual approval
and release gates remain pending. No deployment or production changes.

Owner correction: remove the added map-top action strip. Label guest login
Share your trucks. Join Ask for help and Request transport as two distinct
floating buttons, each opening its own panel immediately.

- [x] Record the corrected placement and direct-open contract.
- [x] Implement joined floating actions and localized guest entry.
- [x] Check desktop/phone interactions, draft retention and control clearance.
- [x] Present the revised local preview for owner approval.

Revision evidence: 14 focused browser cases passed across desktop and phone:
joined buttons, direct destinations, retained drafts, existing chat, hydration,
explicit GPS, localized request flows, selected-truck recovery and header/dock
clearance at 320/390/760px in all five languages. Five catalog tests, TypeScript,
source/spec and whitespace checks pass. Captures are in
`artifacts/assistance-dock-20260924/` and
`artifacts/assistance-dock-flows-20260924/`. Existing-chat presentation checks use
a local browser response fixture; draft checks do not submit new requests.
No hosted changes or deployment. Owner approval of this revised layout remains
pending before extensive release checks. Dev server remains on port 3100.

- [x] Record owner-authorized entry, location, recovery and language contracts.
- [x] Implement clear entry actions, accurate role/code guidance and callback summary.
- [x] Bound access waits and protect against blind retries after uncertain creation.
- [x] Rewrite priority language by UI meaning and mark missing dynamic boundaries.
- [x] Run focused workflow, permission and desktop/phone language checks.
- [x] Present the running local preview for owner visual/language review.
- [ ] Owner visual approval of the new entry, guidance, summary and wording.
- [ ] After approval, complete the existing release process; no publication yet.


Previously implemented entry strip is superseded by the owner correction above;
explicit GPS; accurate fleet-driver and shipment/email code guidance; New callback
count and oldest request on admin Overview/Support; 15-second access waits;
preserved Tracking draft and blocked repeat after uncertain creation. Saved
Tracking returns success independently of subsequent outbox mail delivery.
119 priority message groups were edited contextually in all four catalogs.

Evidence: nine focused unit tests, TypeScript, source/spec and whitespace checks
pass. Twenty-four distinct desktop/phone cases passed across focused runs:
entry/GPS, all four language flows, access timeouts, uncertain save, map gestures
and recovery, actual email-code provider login and two-recipient shipment access,
callback persistence/admin follow-up/retry, and fresh owner/driver onboarding.
Local email was exercised through Mailpit; no production email or settings changed.
Both empty-fleet journeys reached Add truck, assigned an unverified driver,
verified their email and published first capacity with preserved permissions.

Review captures: `artifacts/launch-reviewed-20260924/` (entry/languages),
`artifacts/launch-workflows-20260924/` (map and Tracking checks),
`artifacts/launch-admin-fleet-20260924/` (phone first-truck/driver/admin), and
`artifacts/launch-admin-review-20260924/` (final desktop admin).
The first desktop first-truck capture caught the loading placeholder and is not
visual evidence; the subsequent visible phone capture and both interaction tests
are valid. Current map recovery captures also live in the existing
`artifacts/map-feedback-2026-09-14/` test output directory.

Initial runs exposed a real narrow-map overlap and lingering transient preview;
fixed with bounded summary layout, early recovery feedback and pointer/focus exit
cleanup, retaining pinned details and map gestures. Test corrections distinguish
Next's announcement from form errors, close persisted dialogs between journeys,
await actual route/readiness states and use normal email login instead of the
optional disabled fixture-password panel. A final desktop callback recheck passed
after an intermittent development hydration delay; required assertions remain.

Preview stays at `http://127.0.0.1:3100/`. Review Request transport, the language
picker, `/login`, `/track`, empty-fleet Home and admin Support → Transport requests.
Full quality/build/CI and production rollout remain behind owner visual approval.
Strict language inventory remains incomplete: 427 missing fixed messages and 137
dynamic boundaries across 1,372 marked messages; 1,064 catalog entries per locale.
See `docs/LOCALIZATION_REVIEW.md` and `resources/i18n/CONTEXTUAL_COPY.md`.
Native-speaker review, actual launch inventory, callback staffing and pricing
confirmation remain outstanding. Production and existing demo identities preserved.


## Transport callback requests — local review ready, 2026-09-23

FEAT-TRQ-001. Owner requests a simple no-email form and a separate admin Support
list for offline calls/referrals. Preserve the pending map correction and release.

- [x] Inspect existing chat, Support permissions and record the private request contract.
- [x] Add service-only persistence, input/idempotency and admin follow-up boundaries.
- [x] Add four-field public form and separate paginated admin inbox.
- [x] Verify SQL denial and real desktop/phone submission-to-admin workflows.
- [x] Keep local preview running and capture desktop/phone review evidence.
- [ ] Owner visual approval of request/inbox UI and pending map correction.
- [ ] After approval, resume full gates and reviewed migrations 102/103 rollout.


Local evidence: migration 103 applied only to local Loadgistic. Rollback-only
`tests/sql/transport-requests.sql` and resulting catalog security checks pass.
Six focused domain/catalog tests, typecheck, spec and source checks pass. Final
browser run: eight desktop/phone cases pass for real public submission, no email,
private admin read/follow-up, saved statuses, stale-edit rejection, retry deduplication,
input retention, bounded API input, cross-origin denial, throttling and existing
chat history recovery. The eight existing assisted-chat cases also pass.
Initial browser failures were test-harness SSR import and label-selector issues;
resolved with a normal local verified session and accessible combobox selector.
Only exact failed-test synthetic rows were cleaned up; existing demo data remains.

Preview: `http://127.0.0.1:3100/about` → Ask Loadgistic → Request transport.
Admin: `http://127.0.0.1:3100/admin/support/transport-requests`.
Desktop/phone form and inbox captures:
`artifacts/transport-requests-final-20260923/`. New fixed copy uses the four draft
language catalogs; requester names/routes/notes remain unchanged. Native-speaker
wording review remains part of the existing localization limitation.

Production is unchanged (application `200c783`, database ledger 101). The previous
release candidate failed CI; its prepared artifact must not be published. After
owner visual approval, create a fresh candidate, pass full gates, and rehearse
both pending migrations 102/103 against a fresh protected backup before rollout.


## Accumulated release — requested, 2026-09-23

Owner requests deployment after reviewing the local work and disclosure of
translation gaps. Include Tracking fixes, document migration 102, owner-first
profiles and the current draft catalogs with English fallback.

- [x] Confirm live security baseline: ledger 101, correct PostGIS schema, no ERROR.
- [x] Full local quality (345 tests), current-candidate SQL checks and production build.
- [ ] Commit explicit task scope, push PR 15 and pass exact-commit CI.
- [x] Fresh encrypted backup, isolated restore and migration 102 rehearsal.
- [x] Explicit owner approval for bounded in-memory runtime/private-demo verification.
- [ ] Apply reviewed migration, publish immutable artifact and verify live.

First candidate `9cdc0a1` / CI `35925609765` stopped at a legacy fixture
assertion requiring exactly one truck badge. Local read-only reproduction confirms
an existing truck legitimately has both approved ownership and use-permission
evidence. The fixture verifier now checks distinct allowed categories, neutral
unverified-state semantics, reviewed timestamps and separate owner categories.
The new migration regression remains mandatory; no security gate is relaxed.
The fresh encrypted backup restores successfully in a network-disabled container;
migration 102, document regressions, catalog/API-guard/spatial checks all pass.
Production remains at migration 101 and the previous application.

Candidate `1a7b350` / CI `35926387780`: validation and container checks pass;
browser suite has 223 passed, 8 skipped and 5 failures. Two login localization
cases use an ambiguous selector in CI's two-form login page; three mobile map
cases reproduce locally with the larger three-subject document card. Production
is unchanged. Fix the selector and map crowding, retain all interaction assertions,
and obtain fresh local visual review before rerunning the full release gates.

Local correction ready for review: the existing document controls now use two
columns below 600px, retaining all three subjects and their detail actions. All
three mobile map tests pass; desktop feedback/shared-leg tests pass, and the
closed-area desktop test passes on one controlled rerun after a hydration timeout
while two local servers compiled. No assertions, click force or timeouts changed.
The login selector is scoped to the real email-code form; desktop and phone tests
pass with CI's additional fixture form present. Source/spec and TypeScript checks
pass. Captures: `artifacts/release-map-review-20260923/{phone,desktop,phone-error}.png`.
Fresh owner visual approval is required before full gates, a new immutable build
and deployment. The previous 1a7b350 release scripts/artifacts are blocked by its
failed CI and must not be published. No production test login has been used yet;
the separately approved compiled-app health check passed.

Logo files were supplied to the owner before continuing this release. Local app
remains available. Existing `.next-upload-audit/` remains excluded.


## Language coverage follow-up — local review, 2026-09-23

FEAT-LNG-001. Audit found 465 missing marked messages plus untracked dynamic
labels. Zero raw JSX text did not establish complete localization.

- [x] Inventory catalog gaps without translating user content.
- [x] Fix prominent profile, filter, account and tracking copy; use whole messages.
- [x] Inventory dynamic presentation boundaries and keep unknown coverage visible.
- [x] Focused catalog and desktop/phone language checks, with local preview running.
- [x] Record remaining translation and natural-language review work honestly.


Added 85 messages per translated language (987 entries each), corrected Oromo
spelling/Featured wording and the provider's “New to Loadgistic” statement.
Whole messages now cover profile counts/service descriptions, filter distances,
pagination and tracking status/save feedback. Public and workspace role labels
use explicit translation boundaries; company text, user notes and enum values
remain unchanged. Audit now includes object labels/hints and dynamic boundaries.

Seven focused catalog/progression tests, source/spec validation, TypeScript and
whitespace checks pass. Final login/About, profile/filter and full tracking
progression browser rerun passes all six desktop/phone cases, including all five
languages and unchanged notes/status values. Two narrow map-header cases also
pass. The first run caught a test checking streamed loading markup too early;
waiting for the single hydrated picker resolves it. Phone tracking was interrupted
by my temporary JSX edit during the running check; that edit was corrected and
the complete phone workflow passed on the frozen-source rerun. No failing gate
was suppressed. Captures: `artifacts/localization-followup-20260923-retry/`.
Final badge-wording checks pass on desktop and phone in
`artifacts/localization-followup-20260923-profile-final/` and
`artifacts/localization-followup-20260923-profile-phone-final/`. The phone profile
needed the same explicit streamed-page readiness wait as login; the completed
page then passed every language/content check.

Remaining: **439 fixed messages lack translations; 126 dynamic boundaries need
classification**. This is broader than the prior inventory, not full localization.
The strict audit remains nonzero. See [LOCALIZATION_REVIEW.md](LOCALIZATION_REVIEW.md)
for remaining public/tracking/account/admin/help/policy, metadata/email and
natural-language review work. Local only; owner review precedes full release
gates. Preview: http://127.0.0.1:3100/@rift-valley-haulage-02 .

## Transporter details before fleet — local review, 2026-09-23

FEAT-PRV-001 / NR-13. Owner explicitly changes the profile order: About,
services, credentials, regular service and reviews precede trucks; multiple
trucks open via one disclosure with existing pagination; a single truck displays
directly without a button. Preserve the separate document and localization work.

- [x] Inspect current profile rendering, pagination and related acceptance tests.
- [x] Update the hierarchy and single/multiple-truck contracts before code.
- [x] Reorder sections, add accessible fleet disclosure and retain page navigation.
- [x] Keep provider regular service independent of the selected truck page.
- [x] Focused desktop/phone, single/final-page cases and screenshots.
- [ ] Owner visual review before extensive gates or deployment.

Implemented: profile identity and contacts → About/services/documents → media,
regular service and reviews → truck list. Multiple trucks use a native keyboard
accessible disclosure, initially closed. A single active truck renders directly.
Pagination retains the open state and links to `#provider-trucks`; the last page
with one truck remains a fleet. Ordinals continue across pages. Provider regular
service now reads one owner-scoped row and projects place labels only, independent
of the capacity records on the selected truck page. No schema change is needed
for this layout task. The prior document migration remains separate.

Evidence: seven focused paging/localization unit tests, source/spec checks and
TypeScript pass. Both single-truck browser cases pass; all four independent/company
paging cases pass on desktop/phone (105 and 13 trucks, last-page behavior,
keyboard expand/collapse, invalid input, hidden contacts/files and unpublished
profile denial). The first fleet run stopped on an overly broad test selector
that also matched document summaries; the corrected direct-child selector passes.
Actual Rift Valley desktop/phone captures and bookmarked reload checks pass at
`artifacts/provider-layout-owner-20260923/`. Synthetic captures are in
`artifacts/provider-layout-20260923/` and `artifacts/provider-layout-20260923-retry/`.
Local preview: http://127.0.0.1:3100/@rift-valley-haulage-02 .
No deployment or remote mutation. Full gates wait for owner visual review.

## Five-language interface — active, 2026-09-23

FEAT-LNG-001 / NR-13. Owner requests English, Amharic, Afaan Oromo, Somali
and Tigrinya across public and dashboard interfaces, concise natural wording,
and no translation of user-generated content. Prior Tracking release gates
remain recorded below and are not replaced by this work.

- [x] Inventory current localization support and static interface copy.
- [x] Record language, content-boundary, persistence and review contracts.
- [x] Add locale preference, draft catalogs and accessible language selection.
- [ ] Mark application-owned copy across public and role workspaces.
- [ ] Translate messages and record any coverage/review gaps explicitly.
- [ ] Focused tests, desktop/phone captures and running local preview.
- [ ] Owner visual/language review before extensive release gates or deployment.

## Tracking progression — active, 2026-09-23

FEAT-TRK-001 / NR-13. Owner requests clear completed/current/next/remaining
status controls, phone usability, research, and release after readiness.

- [x] Inspect saved state, existing transitions and primary design guidance.
- [x] Implement truthful history labels, explicit selection/save and phone layout.
- [x] Focused workflow checks and desktop/phone captures; local dev remains running.
- [x] Owner confirms Gmail receipt of demo sign-in test emails.
- [x] Owner approved Tracking layout: “tracking is good” (2026-09-23).
- [x] Fix recipient-save wait: JSON inline result after commit, bounded client wait,
  post-response invitation delivery; desktop/phone invitation → OTP → guest
  access → revocation pass. Duplicate errors preserve input and release busy state.
- [x] Full quality and exact-candidate CI (validate, container, desktop/phone E2E).
- [ ] Compiled production-runtime verification, promotion and private live checks.

The earlier demo aliases are already applied. This UI is not yet deployed;
no database mutation is included. The separately authorized domain cutover
changes only domain/HTTPS and application/Auth URLs.

Focused evidence: three progress unit tests, source/spec validation and TypeScript
pass; the combined Tracking/auth/pilot subset passes all 18 tests. A fresh read-only
check verifies all 152 live demo aliases, roles and account state. Desktop workflow passed; phone initially tried to focus before hydration,
then passed after explicitly waiting for the enabled control. Both exercise
persisted saves, selection without a write, initial Loading shortcut, Problem
recovery and terminal completion. Captures: `artifacts/tracking-progress-20260923/`
and `artifacts/tracking-progress-phone-20260923/`. Temporary test accounts and
shipments were removed; existing demo accounts were preserved.

Owner also requests GoDaddy domain setup for loadgistic.com and permits replacing
its Webflow records; no email service is desired there. Current DNS and exact
website records/application checks are in `docs/operations/LOADGISTIC_DOMAIN_SETUP.md`.
The owner has updated DNS and authorized publication. Domain attachment and
application/Auth URL changes are verified. HTTPS, www/HTTP redirects, production
health and desktop/phone public map/filter/Clear all/login checks pass at
https://loadgistic.com. It serves the previous verified deployment while the new
Tracking release finishes its separate gates.

Recipient-save evidence: `artifacts/tracking-parties-20260923/` (phone) and
`artifacts/tracking-parties-desktop-20260923/` (desktop). The first desktop run
caught a form named-property collision in the new fetch code; explicit endpoint
fix passed rerun. Local quality passes all 335 tests. No production claim yet.

## Owner demo email aliases — applied, 2026-09-23

Owner requests unique plus-addresses at their Gmail inbox for all demo identities,
normal email-code login, and removal of the manual local password shortcut.
FEAT-IAM-001 / NR-06/09/10. This is a new bounded email-address correction,
not reuse of the completed deployment authority or a hosted settings change.

- [x] Inventory tagged accounts and collision-check aliases: 152 live demos
  (9 transporters, 143 Drivers), 154 local demos (plus local admin/support).
  Two untagged live identities and all unrelated identities are excluded.
- [x] Protect the exact mapping/current identity state; rehearse email update,
  profile synchronization and rollback with a local demo identity.
- [x] Apply only reviewed aliases, retain IDs/roles/history and verify every row.
- [x] Default manual local password login off, retain explicit automated-test
  isolation, and verify normal alias email-code login on desktop/phone.
- [x] Save the private roster and local end-to-end/live-request evidence.
- [x] Owner confirms actual Gmail receipt on 2026-09-23 (no codes shared).

All 154 local and 152 live demo email updates are verified. Local normal dev
is running with the password shortcut off. Mailpit forwards only the owner demo
aliases, preserves its prior inbox and retains recovery snapshots. Desktop/phone
normal local OTP login passes; live OTP request reaches code entry. Full local
quality passes 332 tests. Future additive pilot imports now preserve the current
Auth email, preventing profile/address drift. Protected roster:
`.local/demo-email-20260923/DEMO_ACCOUNTS.md`; operational evidence and reset/recovery
limits: `docs/operations/DEMO_ACCOUNT_EMAILS.md`. No new application deployment,
hosted settings change or real-account reassignment occurred. The owner confirmed the test emails arrived in Gmail on 2026-09-23. Existing `.next-upload-audit/` is untouched.

## Published and verified — 2026-09-23

Application commit `200c7833974bea2db5c28d057df636ef7baa7967` is live at
https://loadgistic-473.netlify.app, Netlify deployment
`6ab3aaa9668f9644dcba97d8`, published at 10:39:29 UTC. CI run `35843724742`
passed validate, container and E2E: 331 unit tests, 211 browser passes, one
retry-pass and eight opt-in skips. The prior failed candidate was not deployed.

The refreshed encrypted backup restored successfully in a network-disabled
container. Exact reviewed migrations 098–101 passed rehearsal, were committed
atomically, and passed independent catalog/Data API/spatial checks afterward.
PostGIS remains in extensions; no public table lacks RLS and no critical advisor
finding remains. The two previously reviewed warnings remain. No hosted Auth,
provider, credential or other configuration setting was changed.

The isolated native draft and production artifacts match all 846 committed files,
pass flat-root/adapter/private-file checks, and the compiled runtime reports ready.
The live desktop/phone checks pass: public map, filters and Clear all, email-only
login, chat, account/session screens, exact private-document bytes and guest denial.
The verification-page probe initially inspected a streamed loading shell; waiting
for Request history resolved that harness issue without weakening file assertions.

Live shared-route checks pass both viewports and both zoom levels using accessible
SVG labels, retaining geometric clearance and normal clicks/taps. Production
omits custom SVG class hooks that development supplies: UIA-23 records the missing
custom hover/focus shadow for follow-up. The class-based probes and CI retry are
retained as failures/retry evidence, not silently counted as clean passes.

Evidence: `.local/release-20260923-publication-receipt.json`, production artifact,
deployed browser and final security evidence, plus
`.local/release-20260923-live-map-accessible.log` (2 passes, no retries).
PR #15 records the release result. The local preview remains at
http://127.0.0.1:3100. Safari, physical-phone GPS prompts and real-recipient inbox
delivery remain unverified; no real-recipient email was sent. This scoped release
is complete; routine production changes revert to owner-only authority.
Earlier entries below are historical checkpoints, superseded by this result.

## Release CI corrections — 2026-09-23

Candidate f171c7a passed validation and container CI, but browser CI reported
208 passes, two failures, two retry passes and eight opt-in skips. Do not deploy
that failed run. Correct the mobile chat launcher covering map refresh recovery,
make the zoom regression wait for an actual changed viewport, and synchronize
drawer gestures and admin login with their settled UI/navigation state. Preserve
all assertions, permissions and the existing interface. Recheck focused desktop/
phone cases, then run normal exact-candidate CI and release gates again.

- [x] Verify unobstructed mobile retry, chat, zoom and summary controls.
- [x] Verify viewport reset, settled drawer gestures and admin login.
- [x] Commit/push corrected candidate, pass full CI, then continue release.

Twelve distinct focused desktop/phone cases now pass: ten map/drawer/reset/admin
cases in `artifacts/ci-map-final-20260923/`, plus both final private-map cases in
`artifacts/ci-private-verified-20260923/` (1.1 minutes). The phone error capture
was inspected: the entire Try again target is clear, with chat beside account
navigation. Both login/logout JSON action statuses and the visible screens are
verified; private logout still produces 401. Interim private checks timed out
because the test read the keepalive logout body after document navigation, as
confirmed by `artifacts/ci-private-trace-20260923/`. The corrected test retains
all user-visible and denial assertions. The local server was restarted after
navigation slowdowns and remains at http://127.0.0.1:3100. Normal CI must pass
for the new commit; no production changes have been applied.


## Finish demo fixes and deploy — authorized, 2026-09-23

Owner: “ok go ahead and fix deploy.” This accepts the presented local login,
Clear all and first-Driver fixes and authorizes completing the identified demo
corrections and releasing them with the existing safety gates.

- [x] Preserve fractional ETB amounts in payment/review displays (FEAT-BIL-001).
- [x] Exclude actor-scoped pending document choices with in-review guidance;
  preserve authoritative duplicate denial (FEAT-VER-001).
- [x] Make completion email self-contained with both labelled access codes and
  clear ordered instructions, preserving OTP/review authority (FEAT-REV-001).
- [x] Exercise company Driver permission combinations on desktop/phone; WebKit
  runtime is incompatible on this macOS host, so Safari remains unverified.
- [x] Run focused checks, quality and exact-commit CI; prepare fresh backup/restore.
- [x] Apply only reviewed migrations 098–101, build and verify immutable artifact,
  publish, and independently verify hosted behavior. No hosted settings changes.

Focused fixes are verified: six document/payment/rating cases; both desktop/phone
Driver permission and first-publication journeys; both map drawers and Clear all;
and both completion-email → fresh guest OTP → single published review cases.
The final completion run is `artifacts/demo-completion-final-20260923/` (2 passes,
1.4 minutes); permission/private-map evidence is `artifacts/demo-serial-20260923/`.
The latter retained one earlier completion-test failure before its streamed-page
synchronization was corrected. Initial concurrent dev-server runs also timed out
on loading states; no assertions or product permissions were relaxed.
`npm run quality` passes 331 tests plus source/spec/TypeScript; final TypeScript
and source/spec checks pass. UI captures were inspected. The fresh encrypted
backup restored in a network-disabled disposable database and migrations 098–101
passed rehearsal with full catalog, Data API guard and spatial checks. Exact CI
and production release are next; no hosted mutation or publication yet.

Physical-device GPS and external recipient inbox testing require a real device
and designated recipient; automated emulation will not be reported as either.

## Demo risk assessment — 2026-09-23

The owner asked which important workflows could fail during a demo. Ten fresh
focused desktop/phone cases pass: eight existing chat/private-sharing/Tracking
creation/proof cases and two new completion-email/customer-review cases.
TypeScript passes; no new functional failure was observed in this bounded run.
Known UIA-13/14/17 remain; real hosted email, actual phone/Safari, and delegated
Driver permission combinations need separate evidence. See
[DEMO_READINESS_2026-09-23.md](DEMO_READINESS_2026-09-23.md) for results, fixture
limits and prioritized remaining checks. No production write or publication.
The owner's “sorry continue” resumes the assessment, not visual approval of the
pending login, Clear all and first-Driver changes below.

## Pre-deployment follow-up — active, 2026-09-23

Additional owner screenshot: a newly assigned company Driver has no published
capacity and the floating truck banner covers the empty-state content. Add this
before release: reproduce the first-publication screen, separate empty-state
layout from saved-map overlays, expose a clear first-capacity action, and verify
actual publication through the new Driver's existing permissions. Do not widen
Driver authority or modify the owner's real account as a test fixture.

- [x] Reproduce first-publication banner obstruction with an isolated new Driver.
- [x] Correct empty-state layout/action and first-click readiness.
- [x] Verify desktop/phone first publication, stored state and preserved permissions.

FEAT-CAP-001 / UIA-21: floating saved-map overlays were incorrectly used over
the no-map setup placeholder. The no-map state now uses normal layout, an
explicit Set capacity action and truthful Not published visibility. Location
setup stays in the first-publication editor; no unusable separate Location
action is offered before a capacity exists. Controls wait for attached client
handlers. Existing assignment, fleet permissions and Private default remain.
The before-fix geometry assertion failed; both real new-fleet/new-Driver
desktop/phone inbox-login and publication checks now pass, including stored
vehicle/actor/visibility and post-removal access denial. Evidence:
`artifacts/new-driver-before-20260923/` and
`artifacts/new-driver-review-20260923/`. Six capacity adapter checks, TypeScript
and source/spec checks pass. Final desktop/320px-phone first-publication checks
also pass, including Cancel creating no record, normal click/touch after
hydration, and rendered saved-map tiles (`artifacts/new-driver-final-20260923/`).
All ten existing dialog regressions pass in
`artifacts/new-driver-dialog-regression-20260923/`: actual saves, map identity,
status changes, error recovery, cancellation and owner/anonymous restrictions.
The server remains healthy at http://127.0.0.1:3100; visual approval and
deployment are pending. No production account or settings were changed.

The owner requested a cleaner login page, email-only login for now, and repair
of capacity-map Clear all before deployment. Release of 14aeb7b is paused; its
CI is superseded. The fresh encrypted backup completed authenticated recovery
(2,130,510 bytes); no production migration or application publication occurred.

Plan (FEAT-IAM-001 / FEAT-UIX-001 / FEAT-LST-001 / FEAT-SHR-001):
- [x] Reproduce Clear all on both maps and cover draft-only reset.
- [x] Simplify login and block application Google start/callback routes while
  preserving existing identities, email OTP and local-only test access.
- [x] Reset map/filter/selection state after Clear all with private scope intact.
- [x] Verify actual local email-code login, direct OAuth denial and desktop/phone
  filter reset; capture the updated login and map.
- [x] Obtain owner visual approval (latest fix/deploy instruction); exact-candidate release gates are now active.

Hosted Auth/provider credentials are not changed as part of the application
login switch. Existing sessions are not revoked.

Local evidence: ten auth-flow unit checks, typecheck and source/spec checks pass.
The initial focused browser run had nine passes and one desktop navigation timeout
at `/apply`; an unchanged controlled retry passed. Both viewport sizes exercised
real inbox-code login, wrong-code denial, paused Google routes including a signed
handoff, Open/Private filtering and same-URL Clear all. Before-fix tests reproduced
both retained-state failures. Captures: `artifacts/login-clear-review-20260923/`;
responsive retry: `artifacts/login-reflow-retry-20260923/`. The new login preview
is at http://127.0.0.1:3100/login and fresh visual approval was requested.
No production migration, provider-setting change or publication occurred.

Final four desktop/phone checks pass in `artifacts/login-clear-final-20260923/`:
account navigation/session state, applied-filter and selected-truck Clear all,
and clearing modal edits on an already-unfiltered URL. Fourteen distinct focused
browser scenarios now pass across the recorded runs, with the one controlled
responsive retry disclosed above. Owner visual review remains pending.

## Release resumed — 2026-09-23

After the corrected map preview and its review request, the owner directed:
“ok now lets deploy our changes.” This authorizes release of the current
corrected candidate, including the shared-leg and closed-outline fixes. Local
quality passes all 329 tests, source/spec checks and TypeScript. The existing
dev server remains available at http://127.0.0.1:3100.

- [x] Record current-candidate release approval and completed local checks.
- [x] Commit the reviewed follow-up and verify all required exact-commit CI jobs.
- [x] Refresh the protected production backup and rehearse migrations 098–101.
- [x] Verify and apply the exact bounded migration plan.
- [x] Build/inspect the immutable draft, verify runtime and prepare rollback.
- [x] Publish and independently verify live health, desktop/phone and private files.

The earlier pending review entries below describe the state before this
instruction. No further visible redesign is part of this release. The provider
repair is verified complete and normal security/release gates apply.

## Supabase provider repair — confirmed complete, 2026-09-23 (UTC)

Support's completion notice matches today's independent live read-only checks:
`extensions.spatial_ref_sys`, owner `supabase_admin`, PostGIS 3.3.7, no public
copy, no public tables without RLS and no ERROR advisors. Full catalog, API-guard
catalog and service-spatial gates pass; all three anonymous HTTP guard probes
pass and production health returns 200. Evidence:
`.local/postgis-completion-20260923.json` and
`.local/postgis-completion-http-20260923.json`. The original finding is resolved;
the two existing advisor warnings remain separately recorded. A short support
acknowledgement is drafted at `.local/postgis-completion-reply-review.md`, unsent.
This verification made no remote writes and does not approve the changed map or
complete the application release below.


## Map outline follow-up — active, 2026-09-22

Final focused confirmation passes all six desktop/phone browser cases: the actual
JAC shared leg, synthetic coincident areas/closed routes, and detail-card
wheel/drag/touch behavior. Evidence: `artifacts/map-overlap-final-retry-20260922/`
and `.local/map-overlap-final-retry-20260922.log` (six passes, 1.5 minutes).
The prior final-run attempt failed before reaching the app because the local
server was stopped (`ECONNREFUSED`); it is retained as infrastructure evidence.
The server was restarted, its health endpoint returned 200, and the controlled
retry passed. Ten pure geometry cases, typecheck and source/spec checks pass.
The preview remains at http://127.0.0.1:3100; a fresh owner visual-review request
is pending. No full release gates, remote writes or deployment were performed
for this correction.

Owner screenshot follow-up: earlier preview is not approved. Local JAC X200
`0bd5d4eb-f21b-4751-b0e2-99be9c1315f3` confirms a shared first leg with different
whole-route endpoint ordering. Current Dire Dawa–Shinile and regular service via
Melka Jebdu to Dengego receive the same display side. Prior whole-outline checks
missed partial overlaps. FEAT-GEO-001 now requires segment-aware clearance and
bounded joins, plus exact-fixture desktop/phone selection along that shared leg.
The segment-aware correction is now implemented locally. Ten geometry tests pass,
including 96 orientation/reversal combinations, partial collinear overlap,
intermediate cities, near-parallel strokes, mixed route/polygon edges, sharp
turns and tiny boundaries. The exact local JAC fixture passes native desktop
clicks and phone taps along the shared leg at two zoom levels. Brown is checked
along the yellow leg, not merely on an unrelated part of its journey.
Evidence: `artifacts/shared-segment-pixel-20260922/` and protected geometry logs.

The final phone-test miss came from a fractional point at a dash endpoint rounding
into its transparent gap, not a map movement. Tests use exposed integer-pixel
stroke centers. The speculative hover restriction was removed; hover/keyboard
behavior is unchanged. Production coordinates, filtering and permissions are
unchanged. Full CI and deployment remain after local visual approval.


The owner asked whether overlapping circles/polygons receive the same separation
as open routes. Inspection found open routes offset by 6px, but closed areas drawn
on top of each other. FEAT-GEO-001 now covers bounded closed-outline lanes,
unchanged blue location radius and stored geography, and direct touch/keyboard
selection. Only the selected truck's outlines are rendered; there is one location
circle. This additional visible change needs local review before resuming the
already-authorized release. Preview remains at http://127.0.0.1:3100.

- [x] Identify existing route-only handling and update the geography contract.
- [x] Implement bounded closed joins independent of boundary winding/start vertex.
- [x] Pass four pure geometry regressions, including a tiny-area inward limit.
- [x] Verify actual desktop/phone taps, keyboard access, zoom and screenshots.
- [x] Confirm unchanged drag/wheel behavior and repeat the first-tap regression.
- [ ] Obtain owner visual review, then resume exact-commit CI/release below.

Early checks sampled during zoom transitions and also exposed first-tap misses
on newly fitted layers. Tests now wait for the post-zoom viewport response and
stable SVG geometry; the renderer reconciles its pixel offsets after mounting,
since Bounds can fit before the layer subscribes to zoomend. Both desktop and
phone then pass direct click/touch and keyboard selection of current area/closed
route, regular service and the original location circle at two zoom levels.
Four geometry regressions pass, including winding/start-order invariance,
reversed open routes, bounded corners and tiny areas. Typecheck and source/spec
checks pass. Captures: `artifacts/signal-overlap-fitted-20260922/`. A separate four-case
desktop/phone confirmation passes both overlap and existing wheel/drag/touch
behavior in `artifacts/signal-overlap-confirmed-20260922/`.

The overlap browser scenarios use synthetic coincident geometry through the local
viewport response and real basemap tiles; they do not alter database coordinates
or claim backend acceptance of that stress geometry. Map intersections can still
cross at a point, and a truck card can cover an outline; normal panning/zooming
remains necessary to expose it. No chooser or manual loading step was added.

## Approved release — active, 2026-09-21

Owner reviewed the local changes and explicitly said “all looks good, deploy it
all.” This approves the current accumulated Loadgistic changes and release work.
The local preview remains running; no new interface redesign is included.

- [x] Record owner visual approval and deployment instruction.
- [x] Recheck production target: migration 097, PostGIS 3.3.7 now in extensions, no unprotected public tables or ERROR advisors.
- [x] Pass initial local quality: 319 tests, source/spec validation and typecheck.
- [ ] Resolve release-test fixture failures and complete required database/browser/build gates.
- [x] Commit and push reviewed source as ddca448 to draft PR #15.
- [ ] Verify corrected candidate through required CI; initial run 35609759724 failed E2E.
- [ ] Back up production, rehearse migrations 098–101 and verify exact migration plan/rollback.
- [ ] Build and inspect an isolated immutable Netlify draft, promote, and independently verify production.

CI run 35609759724 passed validation/security/build and container checks; E2E
reported 188 passes, eight failures, four flaky cases and eight skips. Corrections
address drawer animation assumptions, expected feedback placement, debounced
viewport readiness and real selected-card/zoom/Filters overlaps. Eight focused
Open/Private/selected-card cases then passed. A final narrow-phone collision fix
passes desktop and phone checks, including actual failed-refresh recovery; the
first phone attempt remained loading, with one controlled retry passing. Captures:
`artifacts/map-feedback-2026-09-14/selected-320.png`. Initial 319-test quality passes
are not evidence for the subsequent outline change. No production writes occurred.

The previous release exception remains consumed. This release uses normal gates.
Full hosted catalog/ACL, API-guard and service-spatial checks now pass without
an exception. Dependency audit reports zero vulnerabilities. Six distinct
public-entry/sponsor/redirect desktop/phone cases pass after explicit local
sponsor fixtures and corrected drawer/readiness assumptions.

Two remaining advisor warnings concern the intentionally bounded own-identity RPC
and leaked-password protection; retain their review rather than suppressing them.
UIA-13/14 remain recorded follow-ups. UIA-16 was rechecked: at the actual end of
About’s phone scroll, both action centers receive clicks; the earlier check only
used scrollIntoViewIfNeeded, which does not account for overlays. No CSS change
is justified by that check alone. Capture: narrative-review-2026-09-21/phone-about-scroll-end.png.


## Platform positioning copy — locally reviewed, 2026-09-21

- [x] Review public/About/onboarding and Network/Tracking/verification introductions.
- [x] Record the owner’s transporter/broker/enterprise positioning in FEAT-MKT-001.
- [x] Update concise interface copy and durable product guidance; retain factual access and verification limits.
- [x] Check desktop/phone rendering and navigation locally; keep preview available.

About now carries the fuller transporter/broker/shipper/receiver story; metadata,
sign-in/setup, Private capacity, Network, Tracking and Verification use concise
related copy. AGENTS and the product master preserve this direction. Typecheck
and source/spec checks pass. Eighteen local desktop/phone route checks returned
200 with no horizontal overflow or page errors; captures/report are in
`artifacts/narrative-review-2026-09-21/`. The first capture attempt incorrectly
expected the desktop context panel to be visible on phone; the corrected check
uses the actual shared login instructions. Unauthenticated `/apply` correctly
redirects to login; the identity-confirmed setup copy was source-reviewed, not
exercised through a new signup. The existing optional-verification assertion was
updated to match its new copy. No full-suite pass is claimed.

About's phone actions revealed an overlay obstruction, recorded as UIA-16 for
follow-up; this is not a clean overall usability result. Owner visual approval
remains pending. Preview stays at `http://127.0.0.1:3100/about`.

Editorial work only. Prior drawer review and UIA-13/14 / QA-01 follow-ups remain
recorded; this request does not authorize deployment or introduce account roles.

## Capacity filter drawer — locally verified, 2026-09-21

- [x] Inspect shared Open/Private map component and preserve earlier dirty work.
- [x] Record owner-requested drawer/modal contract in FEAT-LST-001 / FEAT-SHR-001.
- [x] Move primary filters into a sliding left drawer and detail filters into one modal; preserve drafts and endpoint scope.
- [x] Verify desktop/phone close, reopen, swipe, focus, map gestures and combined filter application with real local Private access.
- [x] Capture both surfaces and leave preview running for owner visual review before extensive gates.

Earlier UIA-13/14 audit follow-ups remain recorded; this requested interface change
is the current task. No deployment or hosted configuration changes requested.

Implemented: one shared draft/form for the drawer and native More filters dialog;
phone starts collapsed, desktop expanded, Escape and close return focus, hidden
controls are inert, and touch/mouse swipes use the heading/open handle. The map
stays mounted and its bounds do not change when the drawer toggles. Search edits
clear a prior transporter-search scope while retaining other criteria. The phone
chat launcher becomes compact only while the drawer is open, clearing its actions.

Fourteen distinct focused desktop/phone cases pass across drawer/Private OTP,
keyboard accessibility, city filtering, route endpoints, lookup feedback and
transporter search. Typecheck and source/spec checks pass. Screenshots inspected:
`artifacts/capacity-drawer-final-2026-09-21/`; final search/lookup evidence:
`artifacts/capacity-drawer-search-2026-09-21/`. Earlier failures were a wrapped-label
selector mismatch, incomplete synthetic provider fixture (missing published page),
a gesture started before drawer animation settled, and a lookup wait that preceded
the actual server response. Tests now exercise actual touch on phones and verify
that the chat launcher cannot intercept the filter submit control.

The broader public-entry smoke passes its map controls, then fails its existing
Featured sponsor-rail assertion on both viewports. A read-only local projection
confirms zero current sponsors; the component intentionally renders no rail in
that state. No sponsor fixture was fabricated or assertion removed. This separate
fixture/setup follow-up is recorded in the UI audit and remains required before
claiming a complete release gate. The original wider run was 11 passed / 3 failed;
the corrected lookup pair and new transporter-search pair then passed (4/4).

Local health is 200, no drawer test providers remain, and no migration, production
write, commit, push or deployment occurred. Review http://127.0.0.1:3100/ and
`/shared-capacity`: open/close Filters, swipe the heading, edit primary criteria,
open More filters, then apply together. Phone and desktop captures are available
without retaining the disposable private access grant. Owner visual approval
precedes extensive quality/build/release gates under AGENTS.md / NR-13.

## Review workflow audit continuation — locally verified, 2026-09-21

- [x] Inspect Review Center form targets, queue adapters, review-state commands and verification subject projection.
- [x] Preserve queue/search/status/page on real document/payment/rating decisions; canonicalize untrusted return paths.
- [x] Recover stale/invalid review pages without unbounded fetching or suppressing errors.
- [x] Offer only trucks without current authorization approval in the authorization upload selector; keep all badges/history and optional-document wording.
- [x] Verify real decisions, persisted notes/status, terminal replay denial, non-reviewer denial and phone/desktop rendering using exact local synthetic records.
- [x] Correct the reproduced early category-selection reset and verify deliberately delayed scripts on desktop/phone.
- [x] Update audit and handoff evidence; leave preview running for owner review before extensive release gates.

UIA-09–12 and UIA-15 are corrected locally. Eight focused unit/runtime checks,
six desktop/phone review-workflow cases and two Fleet Add-driver clarity cases
pass; typecheck and source/spec checks pass. Payment/rating evidence is in
`artifacts/review-workflow-audit-2026-09-21/`; final document/readiness evidence
is in `artifacts/review-workflow-readiness-2026-09-21/`; Fleet clarity captures
are in `artifacts/review-workflow-corrected-2026-09-21/`. Captures were inspected.

The initial document assertion expected 404 for an anonymous file request;
the established route correctly returned 401. The corrected run exposed an
early category-selection reset, now guarded by client readiness. The first
delayed-script harness unregistered routes while releasing them; correcting
that race produced the final passing desktop/phone run. No permission checks
were relaxed. Failed test teardown left three exact synthetic accounts and their
test trucks across the timeout and delayed-script harness failures. Their identity
and absence of documents were verified before local cleanup; teardown now tolerates
closed browser contexts before cleaning its records. No existing customer/demo
records were reset. Final inspection finds zero remaining review audit providers;
the local health endpoint returns 200.

Review http://127.0.0.1:3100/admin/reviews (search/filter and decide a disposable
record) and `/app/verification` (Truck authorization with mixed approvals).
Owner visual approval still precedes extensive gates; no migration, hosted
write, commit, push or deployment in this continuation. Next recorded work:
UIA-13 exact payment display and UIA-14 pending-document guidance, followed by
Support/delegated-permission coverage. See the audit for evidence and limits.

## UI and backend contract audit — active, 2026-09-21

Scope: public home/navigation, provider home/Fleet/Tracking/Account, administrative
records/reviews/settings/Featured/support, and role-specific navigation. Inspect
claims against authoritative queries and actual controls; do not redesign workflows.

- [x] Record baseline dirty worktree and trace primary page/action/backend contracts.
- [x] Complete local read-only route/form audit; investigate failures without changing demo records.
- [x] Prove and repair incorrect dashboard activity counts/order, admin capacity descriptions, lost record-list context, and administrator plan messaging.
- [x] Run focused SQL/security and desktop/phone interaction checks; retain screenshots.
- [x] Record scope, residual issues, evidence and owner preview; visual approval precedes full gates.


Result: eight confirmed contract mismatches corrected locally (UIA-01–08);
see [UI_BACKEND_AUDIT_2026-09-21.md](UI_BACKEND_AUDIT_2026-09-21.md).
The additional findings were false empty Records pages for stale/invalid page
numbers and regular-service areas shown as city-to-itself routes. Both corrected.
44 page/role visits and 151 distinct POST-target traces are recorded; page loading
and route presence are explicitly not treated as exhaustive mutation evidence.

Migrations 100/101 passed rollback rehearsal and catalog security, then applied
locally with prior-function backups. Both negative SQL regressions pass. Eight
distinct desktop/phone cases pass; the admin-save pair also passed again after
pagination changes. TypeScript and source/spec checks pass. Initial focused test
failures included an incorrect test alert selector and a transient local browser
navigation failure; the corrected controlled run passed. No arbitrary retries
or product checks were weakened. Screenshots were inspected for desktop/phone.

Review http://127.0.0.1:3100/admin, `/admin/operations`, `/app/home`, and `/app/more`.
Owner visual approval and extensive quality/build/release gates remain pending
in that order. No production mutation, commit, push or deployment for this audit.

## Add and assign before email verification — active, 2026-09-21

The owner clarified: email remains required; verification must not block assignment.
This replaces the previous interpretation about adding without an email.

- [x] Record clarified FEAT-FLT-001 / FEAT-IAM-001 contract and inspect existing assignment/Auth boundaries.
- [x] Add service-only registration with owner/identity conflict checks; create only an unconfirmed actual-email identity via supported Auth API.
- [x] Deny unverified current-user projection; reuse normal OTP login without additional fleet acceptance for newly added drivers.
- [x] Update Add driver UI; retain legacy pending invitations and assignment/contact/offboarding behavior.
- [x] Run local SQL/catalog security and real inbox OTP/assignment browser checks.
- [ ] Provide local visual review before extensive gates; no hosted rollout requested.


Local migration 099 was rehearsed transactionally with both new and legacy
onboarding SQL checks, then applied with the prior identity projection backed up.
The final cross-fleet/suspended/reserved-identity and browser-privilege regression
and catalog check pass. Five focused unit checks, TypeScript, source/spec checks,
and both desktop/phone real-Mailpit browser workflows pass. The browser proves
assignment while Auth email remains unconfirmed, no invitation mail/acceptance,
wrong-code denial, actual OTP confirmation into the same assigned identity,
capacity publication, Tracking access, contact changes and offboarding. The
additional cross-fleet SQL fixture initially assumed a self-managed Driver had an
organization; it was corrected to create an isolated rollback-only fleet.

Review http://127.0.0.1:3100/app/fleet/drivers/new (local server remains running).
Desktop/phone captures: `artifacts/driver-preverification-review-2026-09-21/`.
Visual approval and full quality/build/release gates remain pending in the required
order. No hosted writes, push, commit or deployment for this change.

## Map clarity and city location — active, 2026-09-21

- [x] Inspect current palette, key, location status, overlays and proximity query.
- [x] Record FEAT-LST-001 acceptance: city matches reported truck location with uncertainty, separate from routes/service areas; preserve authorization and GPS privacy.
- [x] Implement blue location (public/provider/tracking), muted-orange regular service, compact collapsed key and small location status in the command area.
- [x] Preserve wheel/drag through informational overlays and truck-summary copy; explicit buttons/links remain interactive. Phone touch panning passes. Add independent city/range filtering to public/shared/admin feed pages and APIs using existing uncertainty-aware SQL.
- [x] Seven focused unit tests and ten desktop/phone browser cases pass: city matching/pagination/invalid-place and shared-access denial, compact key/palette/status, wheel/drag/touch through signal and truck details, existing GPS refresh and permission-denied retry. Type/source/spec checks pass; fully loaded desktop/phone captures reviewed locally.
- [ ] Owner visual review at http://127.0.0.1:3100 before extensive gates; no deployment requested.

Unknown city references return an actionable filter error, not unfiltered results. The city criterion overrides device proximity and does not trigger GPS permission on reload. The filter badge counts criteria rather than their supporting URL fields. Existing service-area and shipment-route filters remain independent. No schema, hosted data/settings, commit, push or deployment changes. Screenshots: `artifacts/map-clarity-review-2026-09-21/`.

## Loading presentation and Featured rotation — active, 2026-09-21

The owner visually approved the restored map interaction, then requested a
horizontal loading indicator, map-shaped placeholders and an app-wide loading
review. This approval applies to the preceding map correction, not these new
visual changes. Keep the dev server open and obtain another visual review before
extensive gates. No deployment was requested.

- [x] Inspect loading components and saved Featured generation/scheduling.
- [x] Replace map refresh text/spinner with an accessible teal horizontal bar.
- [x] Replace the cross-shaped map skeleton with neutral streets, blocks and marker placeholders; retain existing controls and interaction.
- [x] Reuse the bar for public truck search, place lookup and member lookup. Records, forms, chat and Featured already have content-shaped placeholders; compact form-submit feedback remains appropriate.
- [x] Confirm weekly subsets: random exact pairs carry over across weeks until the eligible round is exhausted, then a fresh round starts. Existing truck-type days and daily ceiling remain; actual roster count sets airtime.
- [x] Rehearse migration 098 and its rollback-only round/permission regression, then apply only to local Supabase. Existing saved roster fingerprints are unchanged; prior generator retained privately for rollback. ADR-067.
- [x] Four desktop/phone map loading checks pass, including reduced motion and controls during refresh. Screenshots: `artifacts/loading-review-2026-09-21/`.
- [x] Desktop/phone search and place loading checks and Featured admin-to-public workflow pass. Fourteen focused unit checks, TypeScript, source/spec checks pass. Two-session local generation-lock denial passes; no history writes occur while another generation owns the lock.
- [ ] Owner visual review of these new loading changes at http://127.0.0.1:3100.
- [ ] Extensive quality/build/workflow gates after visual approval; release only if explicitly requested.

The rollback-only Featured regression proves varied random draws, no pair repeats before exhaustion, retry stability, manual-history retention, changed pair eligibility, inactive-pair handling and denied browser privileges. The existing platform-controls SQL regression also passes. The resulting catalog security check passed locally. One initial admin browser check exceeded its five-second redirect wait during cold development compilation; the controlled warmed rerun passed both viewports. Phone screenshot review also caught activity-bar overlap with the map key/chat; the bounding-box regression passed after the placement correction. No hosted database, provider configuration, push or deployment occurred for this task.

## Map interaction regression — 2026-09-21

Owner reaffirmed the workflow: keep the dev server open for their visual testing,
then run extensive tests after visual approval, and deploy only when requested.
Visual approval alone does not grant deployment authority. The owner approved the
restored map with “its good”; the new loading presentation above needs separate review.
No corrective release is claimed.

The owner rejected the unapproved map workflow introduced by audit commit
`b22bc3a`: square summary markers, an extra Show trucks click and manual loading /
summary controls. The performance request did not authorize those product changes.
Recorded the cause, evidence and prevention in
[MAP_PERFORMANCE_REGRESSION_2026-09-21.md](MAP_PERFORMANCE_REGRESSION_2026-09-21.md)
and NR-13. AGENTS.md and GUARDRAILS.md now require preserving the original UX,
prior approval of any specific tradeoff, and explicit local visual approval
before UI deployment. Self-authored specs/tests cannot grant product authority.

Local preview is running at http://127.0.0.1:3100 against local services. Removed
the separate summary renderer, popup and manual loading/mode controls. Restored
round clusters/truck markers and automatic sequential paging for the filtered
viewport, with cancellation, deduplication, selected-truck retention and retry.
Results beyond 140 are no longer silently omitted. Large-scale aggregation and a
cumulative client-memory cap are deferred rather than imposed through extra UX.
Server page limits, viewport filtering and authorization are unchanged; ADR-066.

Fixed crossing display offsets that made opposite-status labels overlap while
preserving membership, anchors, design and the 32-pixel offset limit. The geometry
regression fails before and passes after. Thirteen focused unit tests and six
desktop/phone browser cases pass, including the existing dense-map selection and
signal workflow. TypeScript/source checks pass. Screenshots are in
`artifacts/map-cluster-review-2026-09-21/`. The owner has visually approved this correction. No full release gate, push or
deployment ran for it. Next: review the newly requested loading presentation above,
then extensive gates, then deployment only if asked.

## Published runtime and approved pilot repair — 2026-09-21

Release `6b3d6cd` is published at https://loadgistic-473.netlify.app, deployment
`6ab0ac42563b51a851213fa5` (04:08:34Z). Health returned HTTP 200 with
`readyForPublicProduction: true`. Exact CI 35526988445 passed validate, E2E and
container (160 browser passes, zero retries, eight opt-in skips). Runtime/CI
success does not imply owner acceptance of the map experience above.

The owner explicitly approved the 335 synthetic verification storage-reference
corrections. The protected, rehearsed, drift-checked repair was applied and verified
at 04:24:14Z: 335 corrected, zero malformed references remaining. No customer
records, file bytes or permissions changed. Strict deployed desktop/phone checks
then passed, including authorized document bytes, guest denial, public chat,
account security and no browser exceptions. Evidence:
`.local/pilot-reference-repair-receipt.json` and
`.local/release-final-deployed-browser-evidence.json`. The importer regression is
fixed locally; its prior quality gate passed 306 tests, source/specs and TypeScript.
Do not replay the bulk importer, completed migrations or configuration writes.

Application catalog, API guard and spatial checks passed; ledger 097. The full
security check still reports the known PostGIS reference-table finding, and Paul's
repair remains open. The one-release promotion authorization is consumed; it does
not authorize another UI release. Production warnings remain validation-only
uploads, at-least-once SMTP and community map tiles. Monitoring installation and
provider credential separation remain separate outstanding work.

## Release execution — 2026-09-20

Production migrations 077–097 committed atomically at 19:03:46Z after a fresh
encrypted database backup, full isolated restore and successful 21-migration
rehearsal. Four negative cases proved the one-time exception still rejects new
missing RLS, browser column grants, a removed API hook and browser SQL login.
Independent application catalog, guard and service geography checks passed before
and after execution. The full catalog check still reports the known PostGIS
finding; it is not marked green. Live advisors now show one ERROR, nine WARN and
23 INFO (six application-helper warnings removed). The ordinary ledger is 097.

The isolated exact-commit Netlify production build passed (86 routes); source
comparison and artifact private-file exclusion checks passed. Fresh private-file
backup restored and compared successfully. The Auth callback append is applied
and verified; all unrelated Auth settings matched. Actual authenticated pilot
HTTP denials and own-identity access passed again after migration. Desktop/phone
checks confirmed the currently published market/map/filters remain functional.
The test session used an existing synthetic pilot and was signed out locally;
it did not send email, create users or change passwords. It is not evidence of
a real inbox or Google OAuth login. Existing full CI remains 160 browser passes,
zero retries and eight opt-in skips.

The owner approved the required Netlify Free scopes for the single non-secret
production-context scanner value. It is applied and independently verified; all
unrelated environment settings are unchanged. The first publication of 6b3d6cd
failed runtime verification (HTTP 502: missing resolved run-config.json). The
previous working application was restored at 19:57:20Z, and its health endpoint
returned HTTP 200. Database migrations, Auth callback and API containment remain
applied. The release is not complete and the exception is not consumed.

Packaging diagnosis found that the nested source export inherited the parent
checkout's workspace root. A fresh code-only export is being built at /app in an
isolated Linux container, then tested on a draft URL before another publication.
Do not replay migrations, configuration writes or the failed publication script.
Protected receipts retain both the failed attempt and the verified rollback.

The first fresh database export was truncated when its ten-minute timeout fired
without a failing Docker exit code. The mandatory restore rejected it before any
migration. The exporter now explicitly rejects timed-out exports; the replacement
archive completed and fully restored before use. The invalid archive and earlier
valid backup are preserved separately; no truncated backup is accepted as recovery
evidence. Full deployment receipts and remaining steps are protected in
`.local/assisted-release-handoff.json` and `.local/release-final-*`.

## Owner release exception — 2026-09-20

The owner authorized this one reviewed release before Paul's reply/repair, once
all other work and checks are complete. Recorded the exact limited exception in
PRODUCTION_AUTHORITY.md and FEAT-SEC-001. The known PostGIS finding remains open;
checks are unchanged and must not be reported as passing. The migrations reviewed
here do not relocate PostGIS or require its ownership. Remaining work: verify the
current-layout release/backup, independently evaluate all other catalog checks,
recheck live containment and access paths, then apply only the reviewed migrations,
configuration and application rollout with postchecks. Paul alone performs the
already-authorized provider move. No deployment or production write accompanied
this authorization update.

## Release follow-up — 2026-09-20

Update: e52a2a3 passed all jobs in CI 35519622994: 160 browser passes with no
retries, eight opt-in skips. The owner subsequently supplied Supabase's reply:
Support offers provider-assisted relocation into extensions after backup
confirmation. Fresh encrypted backup and full isolated restore passed; an
isolated target-layout copy preserved 87 table counts/digests, spatial queries,
all 21 pending migrations and the unchanged security gate. No provider catalog
edits or hosted writes were performed. The monitor now probes application tables
so it does not require public exposure of the relocated extension. Follow-up
6b3d6cd passed every job in exact-commit CI 35526988445: 160 browser passes,
zero retries and eight opt-in skips (23.7 minutes). Its negative test,
305-unit-test quality gate, actual local SQL/REST/GraphQL/fixture-Auth verification
and three live anonymous probes passed. See operations/POSTGIS_RELOCATION_READINESS.md.
The owner approved the shortened follow-up and continued release work. SMTP
accepted the exact email to support@supabase.com at 2026-09-20T18:25:28.436Z,
confirming the tested backup and requesting Paul's proposed in-place relocation.
No attachment or additional provider work was requested. Protected receipt:
`.local/postgis-relocation-confirmation-submission.json`. Acceptance confirms
submission, not provider completion. Application deployment remains pending
provider repair and independent postchecks. No further send approval is needed;
do not resend the accepted message. All 21 migration digests still match the
reviewed manifest, now bound to the successful current commit.
The post-send read-only check at 18:27:23Z still finds PostGIS 3.3.7 in public,
one critical advisor, 15 warnings and ledger 076. The installed request hook is
unchanged and its three live denial probes passed. Provider repair has not yet
occurred. The draft PR now records the successful latest CI. No production
schema/configuration write, merge or application deployment occurred this turn.

The owner requested the remaining fixes and deployment. Read-only hosted checks
at 15:19:24Z still show one critical advisor: spatial_ref_sys lacks RLS and retains
anonymous table privileges, owned by supabase_admin. The current postgres role
lacks owner membership. Ledger remains 076. The deployed API containment passed
all three live anonymous denial probes. Netlify still publishes 451edd1 from
September 11; no new production deployment occurred. The independent security
gate therefore still blocks full migration/application promotion.

CI-OBS-002: reproduced the public chat launcher's enabled-before-hydration defect
by withholding client scripts. The fix disables it until handlers attach; the
regression failed before the fix. All 14 affected desktop/phone cases passed with
zero retries, including the five previously flaky flows per viewport. CI-OBS-001:
added a ten-second bounded local-only schema read before fixture mutation, with
sanitized status/code diagnostics and no automatic retries. Four negative/positive
tests and an actual local schema read passed. The original HTTP 500 cause remains
unconfirmed; diagnostics are not represented as a proven fix for that historical
failure. Quality passed with 304 tests; build/remote CI evidence follows in
AUDIT_READINESS_2026-09-20.md and the protected handoff. No security gate was weakened.


## Do-not-repeat security lessons — 2026-09-18

Owner requested recurrence prevention, including similar risks to future users.
Commit `4c1c8a6` adds SECURITY_REGRESSION_REGISTER.md (NR-01–NR-10), required
agent/guardrail/PR review links, specification traceability and three additional
negative catalog fixtures. All eleven unsafe catalog states were rejected; all
changes rolled back. Quality passed with 300 unit tests. Responsibility and
remaining provider/monitoring setup are explicit; no guarantee of infallibility
or claim of installed credential separation is made.

Pushed to draft PR #15. CI `35380281319` for exact commit `4c1c8a6` completed successfully: validation,
container and full desktop/mobile suite. Browser result: 148 first-attempt passes,
ten passes after retry, eight opt-in skips (33.0 minutes). Retry cases and the
initial setup observation are recorded with owners and closure criteria in
[AUDIT_FOLLOWUP_2026-09-18.md](AUDIT_FOLLOWUP_2026-09-18.md). Prior guard-only CI `35379271678`
passed validation/container but failed before browser tests: the first local
fixture OpenAPI request returned HTTP500. A direct local repeat returned200; the
new clean validation job passed. Root cause is not established; preserve this
startup failure evidence. The new browser job passed fixture initialization and
its live guard checks without a runtime code change. CI-OBS-001 remains a deferred
infrastructure observation: owner = CI maintainer; next action = capture a bounded,
sanitized provider error code if initial OpenAPI loading fails again and evaluate
an idempotent readiness probe. Do not replay destructive fixture imports blindly.
The full browser suite later passed with the retry limits documented above.

## Data API guard deployed — 2026-09-18

Implemented FEAT-SEC-001 / ADR-065 in commit `fc9f1e6`, pushed to draft PR #15.
Migration 097's exact SQL was applied as the reviewed incident containment at
2026-09-18T18:16:41Z. Production application and migration ledger remain at their
previous release/076; the full ordered schema/application release is separate.
No table data, extension ownership, identity function or existing spatial ACLs
were changed. The ordinary migration replay supports the already-installed guard.

Verified: anonymous reference/application REST, GraphQL and identity RPC calls
are denied with the guard's exact error; server application/geography reads work;
authenticated own-identity SQL remains callable; homepage, login and health return
200. All hosted postchecks passed. A separate live desktop/phone browser check
also passed public search, rendered map and visible filters without page exceptions
or failed application API responses; all non-GET/HEAD requests were blocked by the
probe. Evidence: `.local/data-api-guard-public-browser-evidence.json`.
Production user-login HTTP was not exercised;
local real authenticated HTTP and eight desktop/mobile account/fleet workflows
passed. Quality: 300 unit tests, specs/source and TypeScript; production build,
independent RLS/ACL gates and permanent SQL/REST/GraphQL regressions all passed.

Fresh encrypted database backup and full isolated restore passed against the
same archive hash; the network-disabled restore container was removed. Protected
plan/evidence: `.local/data-api-guard-production-plan.json`,
`.local/data-api-guard-production-evidence.json`, `.local/security-restore-evidence.json`.
SQL SHA-256: `adaec16113aac0e2a9156d85b4fa40f47e7ea01170b4a299eea26a3e27febb64`.

The anonymous HTTP monitor passed three live probes. Its public-key repository
variable is configured; it has no administrator/write credential. Scheduled
execution remains pending the workflow reaching main. Exact-commit remote CI:
`35380281319` for follow-up commit `4c1c8a6`, completed successfully. All three
required jobs passed; the retry/skip breakdown above remains part of the evidence.

Remaining: the underlying provider-owned table still lacks RLS and retains its
old ACLs, so the Supabase advisor remains open. The hook protects Data API traffic,
not direct SQL/Storage/Realtime; hosted metadata confirmed no browser login roles
and no spatial-reference replication publication. No security gate is suppressed.
Full app promotion remains blocked by the independent underlying repair/advisor
requirements and the remaining reviewed release steps. Owner-only authority
remains the standing rule outside this explicitly authorized incident task.

## Easier security options — researched and locally tested, 2026-09-17

The owner's request to research alternatives found a smaller documented route:
a PostgREST pre-request guard allowing service_role and authenticated own-identity
lookup only. No extension ownership, deletion, data movement or application
rewrite is needed for this API containment. Local warmed REST requests, GraphQL,
spoofed headers, role denials, service writes, PostGIS reference reads and managed
signup/Auth passed. Eight desktop/mobile account and fleet browser cases passed
with the guard active (2.9 minutes). Exact experimental objects/configuration were
removed; a delayed reload required independent HTTP confirmation before cleanup,
and the original database security gate passed afterward.

The guard is locally tested research, not deployed. It does not enable RLS or
clear the advisor: that alert remains a distinct underlying database issue.
No release gate was weakened, and no hosted configuration or data was changed.
Other evaluated options: schema USAGE restriction (works but breaks current
identity lookup), a dedicated API schema (larger adapter/wrapper change), disabling
the Data API (breaks current server persistence), and a full PostGIS rebuild.
See operations/SUPABASE_SECURITY_OPTIONS.md for sources, evidence and rollout limits.

Exact commit `1b42e1c` CI run `35177715919` is now fully successful: validate,
container and E2E. Browser summary: 153 passed, five passed on retry, eight opt-in
skips, 31.1 minutes. This is the unmodified release candidate's CI; the API guard
was a separate local experiment and is not part of that commit.

## PostGIS rebuild alternative — feasibility checked, 2026-09-17

The owner asked about recreating the insecure setup while retaining data.
Supabase documents a full extension/dependency rebuild and restore into another
schema. Earlier claims that support was the only possible strategy were too
broad; support is the existing narrow repair route. Live metadata confirms both
table and extension ownership by supabase_admin, non-relocatable PostGIS 3.3.7,
and 11 generated geography columns in application tables. An isolated rehearsal
must prove privileges, complete dependency/data restoration and non-exposure
before any production proposal. No deletion or hosted mutation occurred. See
operations/POSTGIS_REBUILD_ASSESSMENT.md. The simple copy/delete-table proposal
would not preserve extension dependencies or guarantee safer privileges.

## Deployment recheck — 2026-09-17

The owner additionally authorized acting on their behalf. Metadata rechecked at
2026-09-17T03:40:14.564Z confirms organization Owner status, but the existing
database connection is postgres, not superuser, and has no table-owner authority
or SELECT grant option on supabase_admin-owned spatial_ref_sys. Supabase documents
that Dashboard SQL also runs as postgres. No role change or hosted write was
attempted; the exact provider repair request is already submitted.

Owner reiterated authorization to check results and deploy. No new permission
request is needed for the reviewed release. Exact commit `1b42e1c`, CI run
`35177715919`: validate and container passed; full desktop/mobile E2E is running.
Clean CI passed migration 096, the new catalog/negative-grant checks, fresh managed
fixtures, SQL/concurrency, 297 units, scale, TypeScript and build. The earlier
local 144-versus-143 fixture count did not reproduce with fresh CI fixtures.

Live security recheck at 2026-09-17T03:35:15.150Z: one ERROR, 15 WARN,
18 INFO. `spatial_ref_sys` still has RLS disabled and anon SELECT/INSERT/UPDATE/
DELETE; owner is supabase_admin, ordinary postgres has no owner membership.
The hosted ledger remains 076. Supabase's exact approved repair request was
submitted; SMTP acceptance is not proof of repair. Stop promotion until the
provider repair, remaining security review and required CI pass. No ownership
bypass, hosted schema/settings write, merge or production deployment occurred.

## Browser database boundary — pushed, clean CI running, 2026-09-17

FEAT-SEC-001 / FEAT-IAM-001: a rollback-only local test proved retained membership
could let an inactive session update a vehicle through legacy table grants.

- [x] Trace all session-client consumers; business data uses service adapters,
  while current_user_projection is the required caller-bound identity RPC.
- [x] Specify removal of browser application-relation privileges and helper RPCs.
- [x] Add migration 096 and actual-role/default-grant regression coverage.
- [x] Prove failure before repair, denial afterward, service/identity compatibility,
  eight recurrence checks, quality/build and eight desktop/mobile browser cases.
- [x] After explicit approval, push exact commit `1b42e1c` to draft PR #15;
  remote head independently verified. CI run `35177715919` started.
- [ ] Obtain clean CI for migration 096 and the complete browser suite.
- [ ] Review release artifact and record rollout evidence; no hosted apply yet.

Local evidence: all 16 rollback SQL suites, eight deliberate catalog failures,
297 unit tests, spec/source, TypeScript, production build and eight desktop/mobile
browser cases pass. Targeted managed signup, Support and Fleet verification also
passes. The full local fixture verifier still expects 143 active trucks and found
144 in this existing developer database; preserve its assertion and require clean
CI fixtures before release. Next-generated metadata was restored by the wrapper.
Local progress/support-submission notes and pre-existing `.next-upload-audit/`
remain outside the pushed commit. The owner explicitly approved the exact email;
SMTP accepted it for support@supabase.com with the reviewed SQL digest verified.

## Assisted repair/release — 2026-09-17

The owner authorized a one-time assisted execution of the reviewed Loadgistic
repair/release, preserving the safe workflow. Owner-only remains the standing
default. See PRODUCTION_AUTHORITY for the exact scope and stopping conditions.

- [x] Recheck exact hosted project/advisors and provider ownership.
- [x] Publish the tested security changes to draft PR #15.
- [ ] Obtain clean CI for `1b42e1c`, run `35177715919`. Earlier candidate checks
  do not substitute for the new exact-commit result.
- [ ] Resolve the critical hosted finding through its actual owner; no bypass.
- [ ] Apply only reviewed release changes after every prerequisite passes.
- [ ] Record hosted evidence or the precise provider/access blocker.

The PostgreSQL 15 local-owner authentication failure is corrected. Managed
verification now passes in clean CI; older SQL fixture assumptions were corrected
against migrations 086/092 and the spatial test now builds its own Empty/radius
state. The latest clean CI has passed all SQL suites, concurrency, 297 unit tests,
5,000-truck scale limits, TypeScript, production build and container; the complete
browser suite is still running for that earlier commit. The scale script also now creates its artifact directory on
fresh runners.

The exact reviewed support email and SQL attachment were explicitly approved and
accepted by SMTP at 2026-09-17T03:20:40.889Z; registered-owner identity and attachment digest
were reverified. One recipient accepted, zero rejected. The protected receipt is
`.local/support-repair-submission.json`; a support reply/case number and the actual
owner repair remain outstanding. No hosted database/settings change or deployment
has been performed by the agent. The prior automatic-approval blockers for this
exact push and email are resolved by the owner's explicit authorization.

## Security alert and agent authority — active, 2026-09-16

Scope: FEAT-SEC-001 / BASE-DEP-001 / FEAT-IAM-001; security and operations.
The owner approved encrypted hosted database/private-file backup and isolated
restore. Previous backup approval is resolved; deployment authorization is now
superseded by the 2026-09-17 selection of **owner-only production changes for now**.
No automation account is selected. The agent prepares/tests; the owner applies
hosted writes, credentials/configuration, protections, merges and deployment.

- [x] Independently verify Loadgistic project and live advisory/catalog metadata.
- [x] Identify critical table: public.spatial_ref_sys, owned by supabase_admin;
  anonymous CRUD grants exist. Other public tables have RLS enabled.
- [x] Verify ordinary postgres cannot alter that table; do not bypass ownership.
- [x] Complete approved encrypted backup and isolated restore verification.
- [x] Specify and locally test exact owner repair, role denial and catalog recurrence gate.
- [ ] Have Supabase execute the hosted owner repair and verify the live finding clears.
- [x] Implement scoped read-only advisor monitoring and owner change-review rules.
- [ ] Provision the scoped monitor token and install provider-side restrictions.
- [x] Prepare provider-side least-privilege/protected-release settings; distinguish
  actual enforcement from repository rules and pending owner work.
- [x] Fix and verify stale signup verifier setup found by clean CI.
- [x] Record tested evidence, hosted repair status and remaining deployment gates.

Read-only findings: Supabase credential is classic-or-unknown, GitHub credential
has repository admin permission, and main has no branch protection. These are
not yet limited by provider enforcement. Prior CI run 34861635105 failed during
signup fixture verification; subsequent SQL/container/E2E jobs did not run.
Production still has migration 076; draft PR #15 is not deployable yet.

Local evidence: quality passed 297 tests, TypeScript, 29 specs/26 features and
349 source checks. The real catalog gate failed before owner repair and passed
after; anon/authenticated CRUD denial and service PostGIS transformation passed.
A new unprotected-table canary was rejected and fully rolled back. The corrected
signup verifier passed. The broader local fixture verifier stopped at 144 active
vehicles versus its clean-fixture contract of 143; existing local data was preserved,
and clean remote CI remains required. Both ignored legacy bulk production-write
helpers now fail before loading credentials or running tools.

The private Storage archive contains seven bucket definitions and one object;
authenticated decryption and byte/hash recovery passed. The ordinary full database
dump timed out twice; the bounded streaming export then succeeded (1,858,785
archive bytes), with authenticated decryption and SHA-256 recovery verified.
The full database restored successfully (2,268 archive entries, 52 public tables,
ledger 076) in a disposable container with network disabled, no host mounts and
scheduled jobs disabled; the container was removed. The private object was restored
to a unique local Storage path, downloaded and hash-verified, then removed with
cleanup verified. Recovery keys still require separate owner custody before
routine agent credentials are isolated.
No plaintext archive, hosted repair, credentials/protection change or deployment
is claimed. Read [PRODUCTION_AUTHORITY.md](PRODUCTION_AUTHORITY.md) for the concrete
owner action list and prepared Supabase repair request.

## Deployment preparation — active, 2026-09-14

The owner authorized deployment. Audit candidate `b22bc3a` is committed and pushed
in draft [PR #15](https://github.com/falmata-tech/loadgistic/pull/15); required CI
failed on the stale signup fixture described above; no production promotion
has occurred. The preserved untracked
`.next-upload-audit/` directory is outside this release.

Hosted Loadgistic is verified at migration 076
and Netlify commit `451edd1f`; migrations 077–096 and the new account-security
callback still need rollout. The dependency audit is clean. The full 166-case
browser release suite finished with 139 passes, 19 failures and eight opt-in
visual skips (52.8 minutes). It exposed test-readiness/selector drift (F25),
expired local sponsor placements (F27), and late phone navigation/timeouts.
The fresh-server retry passed 14 cases; all six final desktop/phone checks
passed after correcting handle and Tracking navigation readiness. All 158 enabled
cases now have passing evidence across runs; this is not one clean full-suite run. Release review also found and fixed
missing Docker context exclusions for local credentials and deployment state
(F26). A scratch build proved context exclusion; the normal production container
build hit Docker Hub DNS timeouts on both attempts. CI now includes the audit SQL,
concurrency and context-canary gates.

The initial backup approval block was resolved by the owner; encrypted database
and private-file exports now have verified decryption and isolated restore
evidence. No production mutation or deployment has occurred. The candidate is in draft review
for required CI; do not promote it while the release gates remain unresolved.

## Recorded audit — verified locally, 2026-09-14

The recorded F04/F05/F06/F09/F10 work and additional F16–F21 repairs have local
verification. Migrations 090–095 implement recovery, bounded admin correction,
confirmed-email/retained account deactivation, spatial capacity windows,
incremental Support polling and public metadata privacy. Closure resolves active
work, deactivates access and retains shipment, audit and file history.

All 34 affected desktop/phone browser cases passed across focused runs, including
real local Auth/Mailpit and private Storage workflows. Seven rollback SQL suites,
six observed-lock concurrency cases, the 5,000-truck scale audit, 290 tests,
TypeScript, 28 specs, 349 source checks and the final 86-page production build
passed. BUILD_VERIFICATION records the evidence. Temporary audit identities and
scale trucks were cleaned.

[AUDIT_COMPLETION_2026-09-14.md](AUDIT_COMPLETION_2026-09-14.md) records the exact
checks and remaining limits. F22/F24 are now repaired: selected truck feedback
occupies its own summary row, and narrow summaries leave zoom controls clear.
All 10 related desktop/phone cases passed across focused runs, including 320px
refresh failure/retry; corrected screenshots were inspected. F23 removes stale
runtime-pending headings from the already verified spatial/polling specs.
Owner visual approval is not claimed. Local Auth auto-confirm does not prove hosted
two-link enforcement; phone-background GPS remains unsupported. Hosted rollout
and its upload verification remain separate. No commit, push or deployment.

Earlier sections below are dated checkpoints; they do not override this status.

## Member Support attachments — 2026-09-14 (verified locally)

Scope: F05 attachment parity, FEAT-SUP-001 / BASE-BE-001 / BASE-DEP-001.

- [x] Specify actor scope, private-file lifecycle and retained history.
- [x] Add reservation/attachment/read/cleanup contracts and Storage adapter.
- [x] Wire member/staff reply upload and authorized download links.
- [x] Verify SQL denial, real Storage, historical files and failed uploads.
- [x] Run quality/build and record local evidence and rollout limits.

Evidence: 277 tests, TypeScript, 28 specs/334 source files and the 85-page build.
Final desktop/phone attachment workflows passed both cases; all six existing
Support history cases passed. Rollback SQL covers authority, atomic messages,
history, lost responses and grace-period cleanup. Six final screenshots are in
`artifacts/support-attachments-2026-09-14/`; visual approval is not claimed.
Synthetic attachment rows, test profiles and member-support Storage objects are
all zero after cleanup. Migration 089 is applied locally only; it must precede
UI/worker rollout. No commit, push or deployment. F05 push delivery and the
remaining F04/F06/F09/F10 audit work stay open.


## Tracking location controls — 2026-09-14 (verified locally)

Scope: F11 Driver radius selection and honest foreground-location status,
FEAT-TRK-001 / BASE-FE-001 / BASE-BE-001. Background GPS remains unsupported.

- [x] Specify radius, cooldown feedback and cancellation boundaries.
- [x] Add Driver radius controls, accurate state feedback and single-flight updates.
- [x] Prove hidden/unmounted callback cancellation and real location persistence.
- [x] Run desktop/phone workflows, quality/build and update evidence.

Evidence: 272 tests, TypeScript, 28 specs/332 source files and the 85-page build.
The combined location/proof browser run passed four cases; both final delayed-
GPS radius cases passed after the initial-selection timing fix. Four screenshots
are in `artifacts/tracking-location-controls-2026-09-14/`; visual approval is
not claimed. Synthetic Tracking and outbox cleanup counts are zero. No schema,
commit, hosted change or deployment. F04/F05/F06/F09/F10 remain separate audit
work; F11 background GPS remains an explicit operational limit.


## Public fleet paging — 2026-09-14 (verified locally)

Scope: the public-profile fleet portion of F06, FEAT-PRV-001 / FEAT-LST-001,
BASE-BE-001. Spatial map loading remains separate.

- [x] Specify bounded fleet pages, complete capacity lookup and stable summaries.
- [x] Add owner-scoped fleet paging and narrow capacity before latest-state selection.
- [x] Wire canonical public page navigation and accurate count labels.
- [x] Verify fleets beyond 96 trucks, privacy/visibility and desktop/phone navigation.
- [x] Run quality/build and record local evidence and rollout limits.

Evidence: 265 tests, TypeScript, 28 specs/331 source files, 85-page build,
rollback SQL including final migration replay, unchanged ordinary-query results
and four desktop/phone browser cases. Six screenshots are retained in
`artifacts/public-fleet-paging-2026-09-14/`; visual approval is not claimed.
Synthetic fixture cleanup returned zero remaining records. Migration 088 is
local only; no commit, hosted apply or deployment occurred. National viewport
queries and private spatial scaling remain the next separate F06 work. Other
open audit items are retained in CURRENT_FEATURE_AUDIT_2026-09-13.


## Driver portrait audit repair — 2026-09-14 (verified locally)

Scope: F08, FEAT-FTR-001 / FEAT-IAM-001 / BASE-DEP-001, ADR-054.

- [x] Specify Driver ownership, public consent, normalization and cleanup states.
- [x] Add portrait schema, reserved private uploads and bounded deletion retries.
- [x] Add Account controls and Featured image projection with revocable reads.
- [x] Verify permission/cleanup SQL and real desktop/phone Storage workflows.
- [x] Run quality/build and update audit, traceability and evidence.

Evidence: 262 tests, TypeScript, 28-spec/330-source checks, 85-page build,
rollback SQL and four final portrait desktop/phone workflows passed. The combined
account/portrait run also passed all six cases. Eight screenshots are in
`artifacts/driver-portraits-2026-09-14/`; visual approval is not claimed.
Migration 087 is recorded locally only. No remote deployment or commit occurred.
F04 recovery administration, F06 spatial scaling, F09 email-change/closure,
F10 lifecycle actions, F05 member attachments/push and F11 foreground GPS limits
remain separate audit work. Hosted migration/native-artifact/worker validation
remains required before portrait rollout; see BUILD_VERIFICATION.

## Remaining account audit repair — 2026-09-14 (verified locally)

Scope: F09 name/account-phone editing and fleet phone isolation (FEAT-IAM-001,
FEAT-FLT-001). Name remains a shared display identity. Email change and closure
remain deferred; F08 portraits remain a separate subsequent item.

- [x] Inspect actor/data boundaries and specify privacy, denial and rollback.
- [x] Implement strict self-edit command and account form; isolate fleet callbacks.
- [x] Verify SQL permissions and real desktop/phone save, clear and denial flows.
- [x] Run quality/build and record evidence, scope and outstanding work.

No commit, remote publication or deployment is authorized by this checklist.
Evidence: 256 tests, TypeScript, 28-spec/source checks, 84-page build, rollback
SQL and four passing account/fleet desktop/phone workflow cases. Migration 086
is recorded locally only. Four screenshots are in
`artifacts/account-details-2026-09-14/`; visual approval is not claimed.
F08 real Driver portraits are now verified in the checkpoint above. F09 email-change and
closure, F04 recovery administration, F06 spatial scaling, F10 lifecycle actions,
and F05 member attachments/push remain open. See BUILD_VERIFICATION for the
native-form test scope and existing JavaScript-disabled shell limitation.

## Chat-history audit repair — 2026-09-14 (local)

Scope: F05 retained-message access and its discovered unassigned-agent denial
edge case (`FEAT-SUP-001`, `FEAT-GST-001`). Loadgistic only.

- [x] Inspect existing contracts and record the bounded-window design in specs.
- [x] Add NULL-safe guest assignment checks and rollback-only denial tests.
- [x] Add service-only, conversation-scoped history cursors and ordering tests.
- [x] Wire member, staff, recovery and launcher history navigation; preserve drafts.
- [x] Run real local database/browser workflows and capture desktop/phone states.
- [x] Run quality/build and update master prompt, audit and traceability evidence.

No remote publication is authorized by this checklist. The remaining F04/F06/
F08/F09/F10 capabilities and F05 member attachments/push transport remain open.
Evidence: `BUILD_VERIFICATION.md`, `tests/sql/support-history.sql` (rollback),
252 quality tests and 12 focused desktop/phone chat cases. Migrations 084–085
are local only. The focused screenshot pass is not user visual approval.

## 2026-09-14 — resumed map/navigation overlap fix (local)

The interrupted `FEAT-UIX-001` fix now has focused evidence: shared desktop
rail measurements keep the map/search panel beside navigation, and remaining
flex height accounts for the header and tablet navigation. Four Open/Private
desktop/phone browser cases pass at ten widths from 320 through 2560, including
320-by-640 reflow, Filters open/close, About navigation, real local private email
OTP entry, and logout. Synthetic grants are revoked after each private case.
All 248 tests, 28-spec validation, source checks, TypeScript and the production
build (83 generated pages) pass.
Sixteen map/filter captures are in `artifacts/map-shell-2026-09-14/`.
User visual approval and deployment are not claimed. Earlier audit gaps and
the existing uncommitted audit work remain; see `BUILD_VERIFICATION.md` for the
exact gate status and scope.

## 2026-09-13 — first audit repair batch

Fixed F01 private geographic eligibility, F03 chat success/reset errors, F07
unknown-location broadening, F12 pre-Auth team authorization, and F02 Tracking
proof retrieval on provider/guest/admin timelines. Reduced F05 polling overhead
and corrected known documentation drift. Migration 083 is local only.
Evidence: 248 tests, TypeScript/build, rollback SQL authorization and 10 focused
desktop/phone browser cases. Proof tests used real local Storage and Mailpit;
chat tests mocked transport. Remaining admin/account/lifecycle/portrait and
large-map/history work remains explicitly open in the current audit. No deploy.

## 2026-09-13 — current-feature audit and explicit upload policy

The current feature inventory and concrete gaps are recorded in
`CURRENT_FEATURE_AUDIT_2026-09-13.md`. The read-only audit verified eight admin
record types on desktop/phone, seven public phone entry pages, and reproduced
private-filter false positives and the anonymous chat post-success reset error.
Those functional defects are documented, not silently claimed fixed.

The owner's subsequent instruction approved antivirus-optional uploads. The
explicit validation-only mode retains private storage/file checks and reports
that files are not virus-scanned; see ADR-052 and BASE-DEP-001. No production
configuration or deployment has been changed in this task.

## 2026-09-13 — fleet onboarding gaps repaired (local)

- My Fleet now exposes Invite driver beside Add truck. Owners can send/retry or
  cancel an email invitation; a recipient verifies email using normal account
  access, explicitly accepts, then appears in Driver access for assignment.
- Assignment retains the selected truck and permission saves retain list
  context. Driver name/phone editing and confirmed removal are separate actions.
  Removal immediately ends operating access and assignments without deleting
  shipment/document history. Truck details can be corrected independently.
- Tracking and Network empty states now lead owners to Add truck/Manage drivers;
  Company drivers receive employer-assignment guidance instead of owner links.
- Local migrations 081–082 enforce email proof, membership, expiry, cancellation,
  conservative permissions, same-fleet rejoin, contact-safe audit, and no silent
  account transfers. Both migrations are applied and recorded locally only.
- New-fleet desktop and phone tests created owner and driver through real local
  Auth OTP, verified invitation delivery in Mailpit, assigned and published a
  truck, edited details and revoked access. SQL and existing Fleet/trailer checks
  passed. Final gate details are recorded in BUILD_VERIFICATION.md.
- No Production database, deployment, external email recipient, or other project
  was changed. Hosted release must apply pending migrations 077–082 first and
  verify actual hosted invitation email, OTP/Google acceptance and revocation.

## 2026-09-13 — launch controls and automatic Featured (local)

- Platform Settings now offers Free access (default) or confirmed Trial, then
  payment. Free hides expiry/payment prompts and rejects new payment proofs;
  activation gives unpaid existing providers seven days without changing paid
  history. Company Drivers inherit the same fleet policy.
- Featured supports Automatic selection (default eight, adjustable one through
  twelve) and Manual only. The existing scheduled worker prepares missing dates
  for the next seven days using distinct eligible Drivers and the daily truck
  theme. Manual days and already published days are preserved. Admin can prepare
  immediately or continue selecting/publishing a specific day.
- Shared neutral skeletons cover route transitions, records, forms, map modules,
  and initial chat; Featured retains a board-shaped neutral placeholder. Native
  POST actions show pending feedback without losing submitted button commands.
- Local Supabase has `079` and `080` applied and recorded. SQL regressions and
  verification/billing checks passed; Free and Auto remain selected locally.
  No remote migration, deployment, payment activation, or other-project change
  occurred. Deployment must include pending `077`–`080` before client/worker
  publication. See the dated build-verification checkpoint for final gates.

## Current verified product

- Local 2026-09-13 Driver linkage is explicit in Fleet rows, owned truck details,
  and the selected-truck map header. Migration `078` requires a current active
  independent Driver or same-company assignment for publication and both capacity
  maps; missing documents are not a gate. Review summaries distinguish Driver
  and truck evidence, with neutral missing/expired categories and emphasized
  current approvals. Local rollback SQL, desktop/phone workflows, 223 Node tests,
  TypeScript, optimized build, and a 5,000-truck/Driver scale transaction passed.
  No production deployment or remote migration was performed for this change.

- Local 2026-09-13 capacity editing uses focused native dialogs over the retained
  map, with no Edit all. Capacity, Coverage, Sharing, Loads, Regular service, and Location save
  through authorized Supabase commands without document navigation. Migration
  `077` preserves the last actual Driver fix on non-location edits and makes
  regular-service replacement atomic. Desktop/phone workflows, the local managed
  verifier, quality gate, and optimized build are recorded in
  `docs/BUILD_VERIFICATION.md`. This change is not yet deployed to Production.

- Follow-up capacity-action verification separates status from visibility and
  load preferences, adds readable phone action labels, and reserves map/header
  space for the six-button rail. A reproduced rapid-edit race is fixed by waiting
  for refreshed server facts before opening another editor. Known validation
  errors now explain the correction; unknown database failures retain safe codes
  only. First publication defaults to Private until Sharing is explicitly opened.
  The user's exact generic save failure has not reproduced on the verified local
  fixture; confirming local versus hosted origin remains necessary before
  attributing it to a specific backend failure.

- Loadgistic presents Capacity Sharing and Shipment Tracking as its two primary jobs. The canonical Open capacity workspace at `/` uses bounded cursor loading, one unranked Map result surface, live Transporter/Truck suggestions, and conjunctive advanced filters. The public navigation order is Open capacity, Private capacity, Track, Featured, and About. Desktop uses a floating workspace rail and phones use the fixed five-destination public navigation. The Map progressively appends bounded batches; there is no public List view, manual Load more action, or ranking surface. Browser geolocation centers the Map without mutating results; proximity is a separate opt-in filter. Current and regular Capacity routes contain two through five ordered cities, while current and regular Service areas use a center plus three through five boundary cities rendered as polygons. Each transporter has at most one regular-service signal. Search covers every stored route and area city. Visible shipment origin and destination inputs can be applied independently or together: Capacity routes evaluate every ordered segment and eligible Empty Service areas evaluate their complete polygons. Approximate truck location remains an independent violet circle. Panning is bounded to practical East Africa context while phones without location start at a useful Ethiopia camera. Status-specific bounded clusters use linear screen buckets at least as wide as their markers, never combine Empty with Partial, never exceed eight trucks, and separate nearby labels in screen space. A crowded maximum-zoom cluster opens a bounded truck chooser rather than an overlapping marker ring. Private-network trucks are absent from anonymous markers, search, filters, and regular-service projection. `/capacity` is compatibility-only.
- Busy deterministic supply market: 30 published providers, comprising nine fleet companies and 21 independent provider profiles, with 143 active trucks distributed through weighted Ethiopian freight markets and 64 real named cities, towns, or localities rather than equal regional quotas, repeated centers, identical fleet patterns, or diagonal offsets. No exact locality holds more than five source trucks; the 33-truck public subset spans 24 exact named locations with at most three at one locality. One hundred local-delivery motorcycles, cars, vans, pickups, and mini trucks use routes or Service areas within 30 kilometres; light trucks cover wider local networks and only occasional medium/heavy trucks use regional corridors. Every public truck projects one Driver first name, callback phone, operating model, and separate Driver/truck document-category status without exposing proof files or private account data.
- Uniform white-space Loadgistic `/@handle` microsites are reached only from Truck Market details. They show provider identity and facts, independently visible contacts, colorful verification badges, verified reviews, and one detailed card for every active truck. A truck's latest published Empty/Partial signal lazily opens a selected-truck map that compares its reported public geometry with a browser-only visitor point and labels capacity age separately from approximate-location age; Off Duty trucks expose no old map location. There is no Provider Market, provider list/map, or Area Market; provider-name search returns only that provider's published trucks.
- Fleet-owner and self-managed provider workspaces for trucks, current Service-area/Capacity-route publication, one regular Service area or Capacity route, profile editing, verification, billing, and support. Authenticated workspaces do not duplicate the public Market or Featured workspaces; role-aware More navigation links to their canonical public routes while retaining a direct Exit dashboard action.
- Truck-scoped Private capacity networks let an assigned Driver share the Driver-selected approximate location and current Empty/Partial signal with approved emails; the fleet owner can inspect and revoke all owned-truck grants. One ten-minute single-use email OTP opens a restricted browser session and one Shared capacity map containing every active truck shared with that address, without a member profile or dashboard. The session ends after 30 minutes without deliberate visitor activity, background map traffic does not renew it, and a visible Log out clears access immediately. A distinct Share with Loadgistic audience supplies the Operations-authorized private matching map without a pretend platform email.
- Account-free Assisted matching starts from a persistent floating launcher with required email, required callback phone, and a short message instead of a shipment form. Available team members are assigned immediately, availability is visible, and active guest threads refresh every two seconds while visible. The chat survives public-route changes, exposes a clear attachment control, and gives guest and team explicit End chat; a closed transcript is retained and the guest can start a distinct new session. `/help` is recovery-only rather than public navigation. The workflow creates no demand, ranking, transaction, or account and makes no service guarantee.
- Unified capacity console with Empty or Partial status, Service area or Capacity route, Off Duty, a collapsed map-centered summary, focused editors for stored facts, an automatic and manual Driver location refresh, and direct approximate-location controls. Service areas and all routes use the same ordered place geometry as the public Market.
- Provider-owned Tracking created after offline agreement by an owner, self-managed Driver, or assigned company Driver, with one customer-owner email/code/link, one ordered status action panel from Going to pickup through completion, optional images only at Loading/Unloading/Issue, optional assigned-Driver approximate location projected only during travel, 30-day guest access after completion, provider history retention, and idempotent access/completion email delivery.
- All-score provider reviews from the emailed customer owner; one- to three-star provider disputes remain visible and counted pending review.
- Evidence-specific National ID, Business License, Business Address, Driver License, and pairing-specific expiring truck-authorization review with vivid category colors. Due-diligence warnings remain attached to public truck and transporter review surfaces rather than authenticated workspace pages.
- Provider-only signup separately offers Fleet transporter, Owner-operator, and Self-managed driver accounts; Company drivers remain attached to their named fleet. Capacity-seeker signup, public Business profiles, Shipment Board, demand posting, interests, Direct requests, pooled/along-route demand, and demand-side member networks are retired and blocked or redirected. The current provider Network is only truck-scoped private-capacity access.
- Local deterministic migration purges fake legacy demand records, Business workspaces, relationships, favorites, and Business reviews while retaining provider supply and provider-owned operational history.
- The About workspace carries the detailed story centered on manufacturers, workshops, growers, producers, owner-operators, self-managed Drivers, and small fleets without delaying the Truck Market.
- Dedicated `/featured` Daily Featured Transporters workspace with one fixed seven-day Ethiopia programme, a compact region/date introduction, variable administrator-ordered transporter roster, a dynamically growing public-feature billboard with numbered provider portraits, evidence-based Fleet transporter/Owner-operator/Self-managed driver labels, and an automatic/manual two-session Ethiopia-time timeline. Automatic mode shares provider time equally, keeps a four-hour midday intermission, inserts separate changeovers and Sponsor breaks, and shortens low-participation days toward late morning and late evening. Admin can configure bounded defaults, regenerate the schedule, or edit validated provider intervals; the public live state distinguishes providers from every break. The compact transporter detail and separately disclosed Sponsored transporters panel remain independent. Its single-perimeter photorealistic display asset supplies physical realism only to the featured board while provider cards, numbers, schedule, live state, and interactions remain dynamic HTML. The responsive grid adds real rows and section height without a fixed stage, nested frame, pan, or zoom. The Sponsored panel is a solid right rail on wide screens and a compact above-board horizontal collection on narrow screens. Featured and sponsored transporter actions open the provider microsite or filter the Truck Market to current trucks.
- One public-first installable PWA launches into account-free Open capacity and provides Open capacity, Private capacity, Track, Featured, and workspace shortcuts without caching navigation responses or framework chunks. Public navigation shows Log in while signed out and Dashboard while signed in; transporter signup is reached from the login page. Drivers and fleet transporters retain their role-specific five-destination bars and branded workspace top bars.
- Managed transporter login presents Google OAuth and a six-digit email code through Supabase SSR PKCE. The fixed deployment callback rechecks the active Loadgistic role projection, never accepts a dynamic destination, and keeps all upstream failures generic. Password login is available only when an explicit non-Production fixture flag is enabled. Public signup offers the same Google or six-digit email-code choices through a signed 15-minute handoff, asks for provider facts only after identity proof, and atomically creates the selected provider workspace, draft public page, approved signup record, and seven-day trial without treating signup as verification.

## Verification evidence — August 2026

- The managed sign-in slice passes specification/source validation, seven
  focused auth/readiness tests, TypeScript, and four desktop/mobile local-fixture
  browser workflows. Tests prove the fixed HTTPS Production callback, minimum
  Google identity scopes, non-creating email OTP request, numeric-code bounds,
  role destinations, and Production denial of the fixture-password flag. Google
  console, exact hosted Redirect URLs, verified SMTP, and hosted numeric email
  template configuration remain owner actions before remote login testing.

- Private capacity and Assisted matching currently pass 28-spec validation, TypeScript, the optimized production build, and focused repository/domain tests. Focused desktop/mobile Shared capacity coverage proves the email gate, 30-minute cookie boundary, non-renewing map reads, visible logout, cookie clearing, and required re-verification. Tests also prove public/private projection separation, Driver/owner grant authority, immediate revocation, Operations-only Loadgistic sharing, guest/team chat isolation, absence of demand records, and managed recovery-email templates. Focused screenshots are under `artifacts/private-capacity-assisted-chat-v1/`; visual approval remains pending.

- The current map-only Market, route/area filtering, East Africa panning, status-specific clustering, and phone-camera correction pass specification validation, TypeScript, all 21 capacity-market tests, and six focused desktop/mobile browser workflows. Origin and destination work alone or together, Empty Service areas participate without ranking, loaded results remain bounded, clusters contain only Empty or only Partial trucks with no more than eight members, and visible status labels do not overlap. Focused screenshots are under `artifacts/focused-2026-08-15-market-final/`; the expensive full-site visual audit remains approval-gated.
- The unified mobile application shell passed its public desktop/mobile workflow test, PWA manifest/cache-boundary test, TypeScript, and two complete 82-screen desktop/mobile multi-role visual sweeps. The correction sweep finished with zero layout/accessibility flags, zero horizontal overflow, and zero browser-flow errors across logged-out, fleet transporter, self-managed Driver, company Driver, administrator, and support views. Evidence is under `artifacts/ui-audit/`.
- The final release-wide Playwright regression passed 34 desktop/mobile workflows with two opt-in capture-only scenarios skipped. It covers public Market entry and mobile app navigation, search/filter/multi-city matching, map clusters and contained hover summaries, visitor location, transporter microsites, featured scheduling, provider profile editing, provider-owned Tracking, Driver Home, capacity editing, retired-route redirects, and credential-safe login.
- The maximum-one regular-service change passes specification/source checks, 66 automated tests, TypeScript, the optimized production build, and the affected public List and Driver summary/editor browser workflows on desktop and mobile. Tests prove both regular Service-area and Capacity-route persistence/projection, second-signal rejection in application and database layers, current-location-related demo geometry, and route/area search matching. Focused screenshots are under `artifacts/regular-service-v1/`; the expensive full-site visual audit remains unrun.
- `npm run check`: specification and source validation passed.
- `npm run quality`: specification/source checks, 39 automated tests, and TypeScript passed.
- `npm run build`: optimized Next.js production build passed.
- A prior `npm run test:e2e` release gate passed 22 desktop/mobile workflows covering Map-first entry, visitor location, selected-truck focus, responsive List cards, stable owner Tracking access, capacity editing, and platform-managed microsite presentation. Later simplification replaced its maximum-two regular-corridor behavior with one regular Service area or Capacity route and moved Market access to the canonical public route; the current batch requires fresh focused browser evidence before release-wide claims are updated.
- `npm run test:ui-audit`: 82 current desktop/mobile screens passed with zero automated layout/accessibility flags and zero browser-flow errors across public, fleet-owner, self-managed Driver, company Driver, administrator, and support-agent views.
- Automated browser verification and visual capture covered the map key, vehicle-image markers, selected approximate-location/current/two-way-regular-corridor layers, overlapping-truck separation, responsive detail and List cards, cluster restoration, the capacity summary, Tracking, and provider presentation.
- Production and development dependency audit previously reported zero vulnerabilities; dependency state was not changed by this feature.
- Current focused verification passed specification/source checks, TypeScript, 67 domain/repository/layout tests, explicit Truck List pagination, and the capacity-only Driver Home on desktop and mobile. List pages retain 14 bounded records without horizontal overflow; Driver Home exposes one Capacity management page title, no embedded Tracking section, and direct Tracking navigation.
- The latest focused verification passed TypeScript, specification/source checks, the optimized production build, 16 capacity/featured-board tests, and four desktop/mobile browser checks covering current Transporter/Truck suggestions, exact truck selection, selected-signal focus summaries, and preservation of the selected truck card. The preceding focused public-entry check also passed on both layouts. A full visual audit has not been run.
- The corrected billboard review passed seven featured schedule/repository tests and the focused public-entry browser workflow on desktop and mobile. That browser check temporarily expands the real responsive grid to eleven portrait tiles, proves full available width, multiple natural rows, no overlaps, no fixed-stage scrolling, and complete billboard containment, then removes the test-only clones. Focused screenshots are under `artifacts/featured-billboard-v2/`; the full visual audit remains unrun.
- The two-session featured schedule review passes specification/source checks, 65 domain and repository tests, TypeScript, the optimized production build, and four focused public/admin browser workflows across desktop and mobile. Two focused capture workflows record the public timeline and administrator scheduler under `artifacts/featured-schedule-v1/`. The expensive full-site visual audit remains unrun.
- The selected-truck layout and sponsorship correction passed TypeScript, specification/source checks, and focused desktop/mobile browser workflows. The checks prove the desktop detail rail does not overlap the resized Leaflet canvas, the mobile card follows below a full-width map, close restores the original map width, capacity signals use one contained high-contrast hover/focus summary without a second click card, and Sponsored transporters remain a separate right panel or compact above-board mobile collection. Focused screenshots are under `artifacts/selected-truck-rail-v1/`; the full visual audit remains unrun.
- The location-aligned demonstration geography and map-centering correction passed the complete 60-test quality gate plus six focused desktop/mobile browser workflows. Automated checks prove current routes touch each truck's approximate city, Service-area polygons contain their nearby center and truck point, regular routes remain relevant to the provider base, permission refresh does not apply proximity, and the nearby-truck filter remains explicit. Focused inspection confirmed a representative Addis Ababa–Bishoftu–Mojo–Adama signal and the compact unchecked proximity control; the expensive full visual audit remains unrun.
- Focused review captures under `artifacts/focused-list-driver-review/` cover Truck List pages 1 and 2 plus the one-title, capacity-only Driver Home at desktop and phone sizes. They report no horizontal overflow and await visual approval before the current batch is committed.

## Verification evidence — September 2026

- A newly empty isolated Loadgistic Supabase stack replayed migrations `001`
  through `059` in order, rebuilt the managed fixture, and passed every guarded
  live verifier. Migration `058` hardens expiry and retention for Shared
  capacity credentials; migration `059` adds exact-target claims, lease fencing,
  challenge-aware retry timing, Shared-first recovery, and bounded terminal
  Assisted matching email-metadata cleanup. The current consolidated release
  gate is being rerun, so no replacement aggregate test count is recorded here.
- A live local application check on port `3001` returned healthy
  Supabase/PostgreSQL status. Existing-account login and temporary-account
  signup each returned the same bounded, non-cacheable code-sent response and
  created exactly one message in the isolated Mailpit sink; no message body or
  code was read, and the temporary Auth identity was removed. Google login and
  signup both traversed the local Supabase PKCE route with the configured Web
  client, minimum identity scopes, the local Supabase callback, and the
  corrected same-origin application callback for either supported local host.
- Hosted Supabase Auth has the exact Production callback, Google provider,
  numeric login/signup templates, and Gmail SMTP configured; one real hosted
  Auth OTP was received and verified. This proves account authentication mail
  only. The separate application-email credentials for Shared capacity,
  Tracking, and Assisted matching are configured in Netlify, but their deployed
  delivery path has not been exercised with a real pending message. The hosted
  Loadgistic database now has migrations `001`–`076`, seven private 4 MiB
  Storage buckets, and the explicitly approved synthetic Production pilot.
  GitHub `main` merge `787b5526` passed CI run `34647400977`; Netlify Production
  deploy `6aa46d24c2d4c6876a354c13` serves that exact commit. Post-deploy health,
  Open capacity, Featured, Adama search, and Hawassa search smoke passed.
- The complete reviewed Production variable set is now present in Netlify's
  Production context. Session, Tracking, service-role, and SMTP credentials are
  marked secret; Netlify Free necessarily exposes those secret variables to the
  Builds, Functions, and Runtime scopes, while non-sensitive deployment values
  use all available scopes. An authenticated application-SMTP handshake passed
  without sending a message. This proves credential acceptance only, not a
  deployed worker or remote application-email delivery.

## Production work still required

- The Netlify Free site `loadgistic-473`
  (`dbb0fcec-9ec9-4511-9737-db0e32849af5`) is provisioned under the
  `Falmata Dawano` team (`falmatad97`) and linked locally at
  `https://loadgistic-473.netlify.app`. The site is connected to
  `falmata-tech/loadgistic` through a read-only deploy key and GitHub webhook;
  `main` is the sole Production branch. The reviewed Production application,
  Supabase, session/Tracking, fixture-disable, and application-SMTP variables
  are configured without recording their values in source. Production deploy
  `6aa46d24c2d4c6876a354c13` is live. The Supabase-backed health endpoint returns
  `200`; its truthful readiness projection remains blocked only by the missing
  managed malware scanner and retains pilot warnings for SMTP and community OSM.

- Active application routes use Supabase-only managed ports and fail closed after a managed error. Operations and Daily Featured/Sponsor administration join public discovery, Shared capacity, provider Capacity, provider-owned Tracking, transporter-profile editing, managed provider signup, the authenticated workspace shell, Fleet management, Verification, Billing, member Support, Assisted matching, and platform-team management on that boundary. The retired local database modules and their duplicate tests/scripts have been removed; the managed JSON fixture now imports directly into isolated Supabase.
- Provider owners now register trucks from My Fleet/My trucks through one owner-scoped PostgreSQL command. Fleet transporters, Owner-operators, and Self-managed Drivers receive the action; Company drivers do not. Registration creates only the immutable Loadgistic truck number and supplied truck facts, leaving Capacity, location, assignment, and verification unset until their deliberate workflows.
- Administration now opens on a compact Overview rather than the client Home. Users, clients, trucks, Drivers, Tracking, Capacity, routes, and plans link into bounded Records inventories; every row opens a real server-rendered record page, Tracking exposes its bounded status timeline, and related owner/truck/public-profile links keep investigations connected. Review Center, private Capacity, Featured/Sponsors, and Support/team remain distinct named work queues. User-facing navigation no longer presents competing Home and Operations labels.
- The Supabase identity slice now has a parameter-free `auth.uid()` role projection plus SSR Google PKCE, numeric email-code verification, refresh, current-user, logout, and managed signup adapters. Managed completion and workspace-access evaluation no longer import the SQLite repository; both sign-in methods deny a missing or inactive Loadgistic role projection. Google Login and Signup now carry separate signed, HTTP-only flow intents that select the exact PKCE verifier slot, clear after callback, and prevent an abandoned Signup handoff from misclassifying a later Login. Signup uses a signed handoff, separate numeric confirmation template, and the same inactive bootstrap before atomic Owner-operator or fleet workspace/page/application/trial provisioning. Hosted Production Google credentials, exact callback allowlists, numeric login/signup templates, and Gmail SMTP are configured, and one real account OTP was verified. Migration `072` now installs the minimum signup plan catalogue independently of demo data; it repaired the hosted zero-plan provisioning failure without activating or associating the failed identity, which remains eligible to retry. Google login and the complete hosted provider-signup workflow still require human end-to-end confirmation; Preview requires its own exact Auth configuration.
- Managed health and place search now use bounded server-only Supabase projections. A live local check returned `200`, `supabase-postgres`, 154 profiles, and Addis Ababa suggestions without loading SQLite. Database failure returns `503` with non-secret blocker names.
- Active application facades, health, request limiting, private uploads, the scheduled worker, browser-server setup, and the standalone container use Supabase unconditionally. Backend selectors, local private-file storage, process-local abuse counters, and local-database fallback are removed; missing managed services fail closed. Local development, CI, fixtures, browser workflows, and the rolled-back 5,000-truck scale audit use isolated Supabase PostgreSQL.
- The canonical public Truck Market now has its own Supabase application port and server-only PostgreSQL RPC. It retains 12–16-row stable cursors, literal truck/transporter/location search, exact provider and status filters, every-segment Capacity-route matching, complete Service-area matching, opt-in proximity, safe contacts, and Driver/truck badges while excluding an entire Private-network truck from anonymous discovery. Anonymous/authenticated browser roles cannot execute the RPC. A managed Next.js smoke returned the homepage and two duplicate-free Partial cursor pages without loading SQLite.
- Published transporter microsites now use the Supabase application port without importing SQLite. The projection preserves active trucks with and without current capacity, provider-selected public contacts, fixture or protected profile images, operating-model labels, assigned Driver first name/callback, separate Driver/truck document badges, current safe geometry, regular service, the latest 20 review notes, and an all-review count/average computed by a service-role-only PostgreSQL aggregate. Managed Next.js checks returned fleet and Owner-operator pages, kept unknown handles at `404`, and rendered no private proof path or hidden account contact.
- Daily Featured Transporters and Sponsors now use a Supabase application port without importing SQLite. The service-only regional candidate projection rechecks published profile, structured base, public contact, active fleet, current evidence, operating model, review summary, and available-now count. The application preserves administrator order, deterministic automatic/manual schedules, Sponsor-break attribution, eligible transporter Sponsors, and bounded outside ads while removing owner IDs and eligibility internals. The live Production `/featured` request now renders the explicitly approved eight-truck current-day programme and its current Sponsor placements.
- The isolated Loadgistic Supabase CLI stack uses ports `55320`–`55324` so it can coexist with other projects. A newly empty local database replayed the complete migration chain, rebuilt the managed fixture, and passed the live identity, Storage, public-projection, signup, Shared capacity, provider Capacity, provider Tracking, transporter-profile, workspace/Fleet, Verification/Billing, Support/Assisted-matching, platform-administration, shared-limit, private-upload, and browser-denial verifiers with SQLite unavailable. The linked hosted Loadgistic project matches through migration `076` and retains seven private buckets with one 4 MiB limit.
- Local fixture follow-up `174380e` assigns each independent truck to its owning
  Driver identity at import time without changing an existing fleet assignment.
  The 2026-09-05 reset imported 143 assignments and generated seven current
  heavy-rigid Featured slots. GitHub CI run `33926528912` passed validation,
  dependency audit, managed verifiers, 201 contract tests, the 5,000-truck
  rollback scale check, TypeScript, the optimized build, all desktop/mobile
  browser workflows, and the standalone container build.
- The explicitly approved Production pilot import is live under the isolated
  `loadgistic-production-pilot-v1` namespace: 152 non-privileged synthetic
  Transporter/Driver identities, 143 trucks and Capacity signals, 30 public
  provider pages, and eight current Daily Featured truck/Driver slots. An
  independent database/API check/browser verifier confirmed exact counts, zero
  synthetic Admin or Support roles, working private Storage, visible public map
  signals, all eight Featured cards, and zero broken pilot images on desktop and
  phone. The pre-import encrypted backup and deterministic rollback are retained.
- Apply and validate the cloud migrations only after a backup and explicit rollout approval. The legacy-demand purge is destructive by design.
- The managed application-email port sends escaped plain-text/HTML templates through preferred Resend delivery, a bounded authenticated-SMTP pilot, or the optional HTTPS webhook adapter. Supabase Auth email is a separate service and template set. The deployed Netlify runtime includes a 15-minute managed dispatcher plus a two-minute access-email recovery dispatcher, each invoking bounded HMAC-authenticated background work without returning private operation data. Production SMTP variables are configured and their authentication handshake passed. Netlify logs confirm both schedules and background workers are invoked; a real pending Shared capacity, Tracking, or Assisted matching delivery has not yet been monitored end to end.
- Every Leaflet surface now uses one centralized HTTPS tile configuration with visible linked attribution and an exact-origin CSP. The bounded beta falls back to the direct OpenStreetMap community endpoint with a non-blocking launch warning; no proxy, prefetch, bulk copy, or Netlify-hosted tile set is used. Monitor traffic and select a reviewed provider before sustained use.
- Tracking unlock, review unlock, and review submission now use the shared PostgreSQL limiter. Add the remaining public-discovery coverage and reviewed bot protection; configure and remotely prove the managed upload scanner; then complete the actual database-restore rehearsal, monitoring, and a tested rollback. The encrypted Storage-object export has already passed an isolated restore and checksum proof; the local EICAR-aware scanner is test-only.
- The reviewed GitHub-to-Netlify Production promotion and live route smoke are complete. Hosted schema publication through `076`, database SSL enforcement, and the Storage restore rehearsal are complete; managed upload scanning, remote application-email delivery, the actual database restore, Preview concurrency, and production monitoring remain rollout gates.

Final UIA-08 screenshot review also caught the detail badge exposing the internal
Profile Route kind for an area. List/detail badges now say Service Area; the
focused browser checks assert this alongside the area description. Final area
captures: `artifacts/ui-contract-area-final-review-2026-09-21/`.

## September 23 follow-up release handoff

Candidate `727c48e5a529412b979ad0c1fc1bfa8ecbf11245`, PR #15, CI
`35860658374`: validate, container and the full desktop/phone browser job all
pass: 335 unit tests and 215 browser checks passed, with 8 browser checks
skipped (not claimed as tested). Compiled production-runtime and private browser verification remain pending
the requested bounded credential-use approval.
Fresh encrypted backup and isolated restore pass at migration 101; no migration
was applied. Security catalog/guard/spatial checks pass with no ERROR advisor.
Immutable Linux draft `6ab3c9fdcd810fa0a9f56d7a` is ready; source matches all
853 committed files and native adapter packaging passes. Preview health reaches
the application and reports its deliberately absent preview configuration.
Production remains `6ab3aaa9668f9644dcba97d8` / `200c783`.

Automatic approval review rejected a proposed privileged production demo-test
inventory because service-key access for that specific scope was not authorized.
No such inventory or demo mutation ran. A question is pending for bounded service
key use in the compiled-runtime and read-only tagged-demo browser release checks;
do not substitute another credential route. The narrower custom-domain operation
was separately authorized and completed. Release scripts/evidence are under
`.local/release-20260923-tracking-*`, domain evidence under
`.local/domain-20260923/`. Keep the local app on port 3100 running.

## Document ownership and entity display — local review, 2026-09-23

Owner additionally requests company documents visible with the company and its
owner; driver/truck documents on the respective entity; a truck submission may
use either ownership proof or permission from its owner; review labels identify
the specific reviewed document rather than assert blanket verification. Interpret
this as shared display of authorized company evidence, not reassignment of
company documents to a Driver or publication of private file bytes.

- [x] Inspect FEAT-VER-001, subject/related-vehicle authorization and public projections.
- [x] Specify ownership/permission alternatives, company-owner linkage and expiry.
- [x] Fix affected submission, review and entity views with permission regressions.
- [x] Include the new document labels in all five catalogs; desktop/phone focused checks pass.
- [ ] Owner visual approval, full validation and separately reviewed production migration/release.

Implemented: company/owner evidence appears in the company editor and public
map summary; Driver and truck evidence stay separate. Truck details link to that
truck's ownership/permission choice. A reviewed alternative names only that
category. New company-Driver permission retains its grantee and disappears from
the truck's current evidence after reassignment. Private documents remain private.

Evidence: rollback-only SQL regression passed; local migration 102 applied;
16 focused pure/catalog tests passed; two upload/approval-display and two public
entity-summary browser cases passed across desktop/phone. Captures are in
`artifacts/truck-documents-final-20260923-retry/` and
`artifacts/public-document-entities-20260923/`. Normal email-code login and real
private upload were exercised against local services with disposable accounts.
Approval used the authorized database command; the broader admin UI test remains
in the post-owner-review gate. Local preview: http://127.0.0.1:3100/app/verification.
No new production write or release occurred.

Local migration CLI found pre-existing missing history for 083/096/097. No broad
replay or reset ran. The rehearsed 102 definitions and ledger row were applied
atomically to the explicitly named local Docker database only. Record those
older local history gaps for a separate environment reconciliation.

Localization remains incomplete: draft catalogs currently have 899 entries per
language. `scripts/audit-localization.mjs` tracks static copy and reports gaps;
English fallback is not counted as translated. Dynamic copy, metadata, outbound
email and natural-language review remain outstanding. All five locale switches
preserve email input, truck names, document titles and machine values. The new
picker initially collided with map support on phones; explicit reserved header
space now passes all five languages at 320/390/760px. Evidence:
`artifacts/localization-header-20260923-final/`. Existing application typechecks
pass, but the main tsconfig includes offline React/Playwright shims; removing
those in an isolated diagnostic config exposed pre-existing type gaps. Record
that separately; no broad typing rewrite is included here.

Final focused owner-section check: desktop and phone pass, including the company
editor showing only owner categories while the truck keeps its reviewed permission.
The initial extension of this test hit NOT_FOUND because its disposable provider
fixture lacked the company-page row normally created during onboarding; adding
that row to the fixture resolved it. No production behavior was weakened.
Static localization inventory: 1,278 marked messages, 465 missing translations
after the explicit technical-name/example allowlist, and zero remaining raw JSX
text nodes in the scanned app/components. This excludes dynamic-copy coverage
and therefore is not an overall completion percentage. Final source/spec and
repository TypeScript checks pass. Changes remain uncommitted and undeployed;
the pre-existing `.next-upload-audit/` directory is untouched.

Focused chat regression completion (2026-09-27): all 12 distinct desktop/phone
cases pass across `artifacts/chat-follow-up-final-20260927/` (11 passed) and
`artifacts/chat-follow-up-claim-20260927/` (remaining desktop conversation passed).
The first run's claim/navigation test raced the save; it now waits for the successful
claim response and refreshed queue before choosing Mine. No permission or product
assertion was weakened. Logs: `.local/chat-follow-up/browser-{final,claim}.log`.

## October 11 release follow-up — route spacing and local build

Candidate `25e9ca3` / CI `38168316955` is not eligible for promotion: its
shared-leg browser regression found closer-zoom lanes compressed by the global
worst-case join floor. The corrected projection retains ordinary 6px lanes and
bounds each actual generated vertex under 1km, with immutable source geometry.
Both unchanged spacing/tap/gesture assertions pass on desktop and phone once the
test establishes measured street scale rather than assuming two zoom clicks
fit every canvas. New pure checks preserve 12px paired lanes when physically
feasible and retain world-distance, ring and high-latitude coverage. Root quality
passes 496 tests; mobile quality passes 149. A new exact-candidate CI is required.

Expo rejects the new cloud APK because the falmatad account's free Android quota
is exhausted; readback confirms no code-6 cloud job was created. The owner chose
the local fallback. Expo Prebuild generates only an ignored isolated source copy;
Gradle uses a task-specific cache and local test signer. The first compile fails
on Maven/Google DNS, not source compilation. After connectivity returns, one
controlled retry includes the lane correction. An installed or distributed APK,
matching Play signer, Play submission and twelve-person testing clock remain
unverified. No Expo private signing credential was downloaded.
