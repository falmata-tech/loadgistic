# Specification traceability

## Authorized demo corrections — 2026-09-23

FEAT-BIL-001 / FEAT-VER-001: all six desktop/phone Review Center cases pass
with exact fractional ETB, excluded pending pairings, preserved approvals and
server-persisted decisions (`artifacts/demo-fixes-20260923/`). FEAT-CAP-001:
the unchanged fleet onboarding test passes both viewports sequentially, including
restricted, tracking-only, capacity-only and full permissions, first publication,
320px touch action and removal denial (`artifacts/demo-serial-20260923/`).
FEAT-LST-001 / FEAT-SHR-001: map label separation passes on both maps; the
private drawer and Clear all pass on both viewports in the same serialized run.
`npm run quality` passes 331 tests, source/spec validation and TypeScript.
FEAT-REV-001: both completion-email → fresh customer OTP → published review
cases pass in `artifacts/demo-completion-final-20260923/` (1.4 minutes), using
only codes from the received completion email. The test waits for each specific
streamed destination response before asserting its flash and stored status.
Initial concurrent dev-server timeouts are retained in demo-readiness evidence.
The owner accepted the earlier preview and authorized the corrections/release;
normal CI, backup/restore, immutable artifact and production checks remain required.


## Demo workflow assessment — 2026-09-23

FEAT-SHP-001 / FEAT-TRK-001 / FEAT-SHR-001 / FEAT-SUP-001: eight fresh
desktop/phone cases pass for Tracking creation, two recipient OTP logins,
uploaded proof bytes and denial, private capacity sharing and live chat.
FEAT-REV-001: two new browser cases pass for all five completion status actions,
actual local completion email, guest OTP/review code, visible review publication,
one persisted Published row and reload. TypeScript passes. Evidence and limits:
[demo readiness assessment](../docs/DEMO_READINESS_2026-09-23.md). No new product
behavior, real email, hosted changes or deployment; previous visual approval
requests remain pending. Actual-inbox, Safari/device and delegated-permission
combination coverage is not implied by these ten local Chromium cases.

## New Driver first capacity — 2026-09-23 (local owner review pending)

FEAT-CAP-001 / UIA-21: an actual new fleet, emailed-but-unverified Driver,
assignment and inbox-code login reproduce the original truck-header obstruction
in `artifacts/new-driver-before-20260923/`. The corrected no-map layout separates
identity and setup, adds Set capacity, and keeps controls disabled until client
handlers attach. Both desktop/phone `fleet-onboarding.spec.ts` scenarios pass
with the held-script first-click test and stored truck/actor/Private visibility
assertions, followed by removed-Driver access denial. Evidence:
`artifacts/new-driver-review-20260923/`.

All ten existing `capacity-signal-dialogs.spec.ts` desktop/phone cases also pass:
actual saves, preserved map identity, cancellation/error recovery, fleet-owner
location restrictions, anonymous denial and first-publication/status changes.
Evidence: `artifacts/new-driver-dialog-regression-20260923/`. Six capacity adapter
checks, typecheck and source/spec validation pass. No permission/schema change
or hosted write; fresh owner visual review precedes full release gates.

Final `fleet-onboarding.spec.ts` run also passes both projects after adding a
320×640 phone action/hit-target check, Cancel-with-zero-records assertion and
real loaded-tile verification after Save. Desktop/phone setup and saved-map
captures were inspected: `artifacts/new-driver-final-20260923/` (two passes,
2.9 minutes). These strengthen the same two scenarios, not additional distinct
cases. Twelve distinct focused browser cases pass for this capacity correction.

## Email-only login and Clear all — 2026-09-23 (local owner review pending)

FEAT-IAM-001 / FEAT-UIX-001: a compact email-only card replaces the login's dual
panel/Google choice. Google start routes and callback reject even an existing
signed handoff before OAuth/session exchange. `email-only-login.spec.ts` passes
on desktop/phone with real local inbox delivery, wrong-code rejection and valid
email-code login; captures include request, code and invalid-code states. Ten
`auth-flow.test.mjs` checks, typecheck and source/spec checks pass. Responsive
320/640/1440px checks pass on phone; the first desktop run timed out navigating
`/apply`, and one unchanged controlled retry passed. No hosted provider settings
or credentials were changed, existing sessions remain, and real Google consent
or production email delivery is not claimed.

FEAT-LST-001 / FEAT-SHR-001 / UIA-20: two reproductions failed before the shared
query-state reset (Private applied filters, Open same-URL drafts). Focused
Open/Private desktop/phone checks now pass, including query/default inputs,
unchanged drawer behavior, restored unfiltered viewport, real private-email
OTP, scoped results and logout denial. Evidence:
`artifacts/login-clear-review-20260923/` and
`artifacts/login-reflow-retry-20260923/`. Full release checks await the owner’s
review of the new login. Earlier release candidate 14aeb7b and its CI were
superseded before any production migration/publication.

Final four desktop/phone checks pass in `artifacts/login-clear-final-20260923/`:
account navigation/session state, applied-filter and selected-truck Clear all,
and clearing modal edits on an already-unfiltered URL. Fourteen distinct focused
browser scenarios now pass across the recorded runs, with the one controlled
responsive retry disclosed above. Owner visual review remains pending.


## Corrected candidate release approval — 2026-09-23

Following the corrected local preview and review request, the owner directed
“ok now lets deploy our changes.” The partial shared-leg and closed-outline
corrections below are accepted for this release. Local quality passes 329 tests,
source/spec checks and TypeScript; the six focused desktop/phone cases remain
the current interaction evidence. Exact-commit CI and hosted rollout are pending.

## Partial shared-leg correction — 2026-09-22 (local review pending)

Final combined focused run: six desktop/phone cases pass in
`artifacts/map-overlap-final-retry-20260922/`, including native shared-leg
selection, coincident closed outlines and detail-card gestures. Typecheck,
source/spec validation and all ten geometry cases pass. A prior run could not
connect to the stopped dev server; after restarting it and confirming HTTP 200,
the controlled retry passed. Owner visual approval remains pending.

FEAT-GEO-001: `tests/map-signal-offset.test.mjs` has ten passing cases, including
96 orientation/reversal combinations. The screenshot regression failed before
segment-aware avoidance and passes after it. Cases also cover partial collinear
segments, inserted vertices, near-parallel strokes, route/polygon edges, winding,
closed joins, bounded sharp turns and tiny areas. `map-shared-segment.spec.ts`
passes actual local JAC X200 shared-leg click/touch checks at two zoom levels,
with no API geometry mocks. Clearances are measured along the shared leg and
native taps use exposed integer-pixel dash centers. Phone checks pan normally
below the existing truck card. Captures:
`artifacts/shared-segment-pixel-20260922/desktop-shared-route.png` and
`artifacts/shared-segment-pixel-20260922/mobile-shared-route.png`.
The synthetic closed-outline checks also pass on the segment-aware renderer.
Earlier preview approval request is superseded; this visible correction is not
approved, committed, or deployed yet. The release objective remains active.

## Closed map outlines — 2026-09-22 (local review pending)

FEAT-GEO-001: four pure regressions in `tests/map-signal-offset.test.mjs` pass.
`tests/e2e/map-signal-overlap.spec.ts` passes desktop and phone native click/touch,
keyboard and zoom checks for coincident areas and reversed closed routes, plus
the unchanged blue location circle. Tests sample stable, exposed strokes and use
normal actionability checks; no forced clicks. Synthetic viewport geometry is
explicitly limited to renderer stress coverage; actual basemap tiles remain.
Screenshots: `artifacts/signal-overlap-fitted-20260922/`. Initial failing checks
and their timing/first-fit corrections remain in protected local logs. Typecheck
and source/spec checks pass. Four additional desktop/phone cases confirm the overlap fix and retained
wheel/drag/touch behavior in `artifacts/signal-overlap-confirmed-20260922/`.
Full CI and deployment remain after owner review.

FEAT-LST-001 / FEAT-SHR-001 release corrections separately cover drawer state,
feedback location, debounced viewport startup, selected card/zoom/Filters access
and the narrow-phone card collision. Eight focused Open/Private/feedback cases
passed, followed by desktop and phone final card checks (phone passed one
controlled retry after a request remained loading). CI run 35609759724 remains
failed; no successful replacement CI or new production deployment is claimed.

## Platform positioning — 2026-09-21 (local owner review pending)

FEAT-MKT-001 editorial clarification: About, public metadata, sign-in/setup,
Private capacity entry, Network, Tracking and Verification now describe capacity
sharing and shipment collaboration led by transporters, with optional document
review supporting customer assessment. Typecheck and source/spec checks pass.
Eighteen desktop/phone route captures report HTTP 200, no horizontal overflow and
no page errors in `artifacts/narrative-review-2026-09-21/`. About CTA destinations
and signup entry redirect remain correct. Authenticated initial setup copy was
source-reviewed only. A separate phone action hit-test found the UIA-16 overlay
obstruction; no claim of full usability or release completion. No hosted changes.

## Capacity drawer — 2026-09-21 (local visual review pending)

FEAT-LST-001 / FEAT-SHR-001: shared Open/Private drawer and More filters modal,
one draft form, unchanged scoped endpoints and no map remount. Fourteen distinct
focused desktop/phone cases pass: `capacity-filter-drawer.spec.ts` (six), focused
accessibility (two), map-clarity city filtering (two), loading-feedback lookup
(two), and smoke route endpoints (two). Real Mailpit OTP and an isolated published
provider/truck/grant prove Private filtering and logout. Actual phone touch and
mouse drag, inert/focus behavior, reduced motion and CTA hit testing are included.
Typecheck and source/spec checks pass. Captures: `artifacts/capacity-drawer-final-2026-09-21/`;
search/lookup evidence: `artifacts/capacity-drawer-search-2026-09-21/`.
Two broader public-entry cases still fail after their map steps because the local
Featured projection has zero sponsors while the test assumes a sponsor rail;
see QA-01 in the UI audit. No full-suite/release pass is claimed. Owner visual
review remains required before extensive gates and separately authorized rollout.

## Review workflow continuation — 2026-09-21 (local visual review pending)

FEAT-ADM-001 / FEAT-VER-001 / FEAT-BIL-001 / FEAT-REV-001 → UIA-09–12 and
UIA-15 in `docs/UI_BACKEND_AUDIT_2026-09-21.md`. Five new pure regressions plus
three Verification/Billing runtime checks pass. `tests/e2e/review-workflows.spec.ts`
passes all six desktop/phone cases: actual document uploads/private downloads,
review notes and status, paid-plan transition, uphold/remove publication rules,
provider denial, terminal replay denial, filtered return context, stale/fractional
pages, and approved-truck exclusion. Delayed-script checks verify dependent
selectors wait for readiness. Two focused Fleet Add-driver clarity cases also
pass. Typecheck and source/spec checks pass; screenshots inspected in
`artifacts/review-workflow-audit-2026-09-21/`,
`artifacts/review-workflow-readiness-2026-09-21/`, and
`artifacts/review-workflow-corrected-2026-09-21/`.
All records/files were synthetic and local; no remote payment or customer email
delivery was performed. NR-10 private-file denial and NR-13 local owner review
remain enforced. Full release gates await owner visual review; no hosted release.
UIA-13/14 remain recorded follow-ups, not completed work.

## UI/backend contract audit — 2026-09-21 (local visual review pending)

FEAT-ADM-001 / FEAT-UIX-001 / FEAT-BIL-001 → UIA-01–08 in `docs/UI_BACKEND_AUDIT_2026-09-21.md`. Migrations 100/101 and `tests/sql/dashboard-activity.sql` / `tests/sql/admin-service-geometry.sql` pass rollback regressions and catalog checks. The migrations are applied only locally. `tests/e2e/ui-contract-audit.spec.ts` covers eight distinct desktop/phone cases: actual admin-save persistence/context and missing-record denial, truthful capacity/admin-plan presentation, authoritative Home projection, stale/invalid pagination and area/list-detail agreement. All pass, along with typecheck and source/spec checks. The read-only audit covered 44 page/role visits and traced 151 distinct POST targets; this is not exhaustive action coverage. Screenshots are in `artifacts/ui-contract-review-2026-09-21/` and `artifacts/ui-contract-additional-review-2026-09-21/`. Owner visual approval precedes full release gates; no hosted release.

## Driver assignment before email verification — 2026-09-21 (local review pending)

FEAT-FLT-001 / FEAT-IAM-001 / ADR-068 / NR-02/03/09 → migration `099_driver_assignment_before_email_verification.sql`, `addFleetDriver`, `/api/fleet/drivers`, and Add driver UI. `tests/sql/driver-preverification.sql` proves unconfirmed assignment, denied unverified projection, same identity after confirmation, private-phone preservation, conservative permissions, safe duplicate addition, mismatched identity/other-fleet/provider/reserved/suspended account denial, revocation/history and browser privilege denial. Legacy invitation SQL and catalog security checks pass. `tests/e2e/fleet-onboarding.spec.ts` passes on desktop and phone with real local Mailpit OTP: assign while unconfirmed, reject a wrong code, verify login without Join fleet, publish, access Tracking, edit contact and revoke. Five focused unit tests, typecheck and source/spec checks pass. Migration applied only locally; no hosted rollout. Captures: `artifacts/driver-preverification-review-2026-09-21/`. Owner visual approval precedes full gates.

## City proximity and map clarity — 2026-09-21 (local review pending)

FEAT-LST-001 / FEAT-GEO-001 / NR-13 → `capacity-filter-places.js` resolves the independent city criterion, `capacity-viewport.js` maps it to the existing uncertainty-aware reported-location query, and public/shared/admin pages and APIs preserve it through pagination. `capacity-filter-places.test.mjs` and `capacity-viewport.test.mjs` cover invalid-city denial, independent geography and city precedence over device coordinates. `tests/e2e/map-clarity.spec.ts` covers real catalog selection, matching returned coordinates across pages, guest denial of the shared API, blue location/orange regular service, compact key bounds and wheel/drag/touch behavior with detail cards. Seven unit checks, ten focused desktop/phone browser cases, TypeScript and source/spec validation pass. Captures: `artifacts/map-clarity-review-2026-09-21/`. Owner visual approval and full gates remain pending. No database migration or remote changes.

## Loading feedback and random Featured rounds — 2026-09-21

FEAT-UIX-001 / FEAT-LST-001 → shared `LoadingIndicator`, map `SurfaceSkeleton`, route fallback and search/place/member consumers. `tests/e2e/loading-feedback.spec.ts` checks actual deferred scripts/network responses, desktop/phone geometry, unobstructed controls, accessible status, editable inputs and reduced motion. Captures are in `artifacts/loading-review-2026-09-21/`. Existing records/forms/chat/Featured skeletons remain content-shaped. Owner review and full release gates are separate.

FEAT-FTR-001 / ADR-067 / NR-01/03 → migration `098_featured_random_rounds.sql` and `tests/sql/featured-random-rounds.sql` (random draws, global exhaustion, exact-pair changes, inactive eligibility, retry, retained history and browser denial). Rehearsal and resulting catalog checks passed; applied only locally without changing saved rosters. Existing `tests/sql/platform-controls.sql` passes. `tests/featured-providers.test.mjs` checks 1–12 actual roster sizes, equal minute allocation and time boundaries; UI/type tests preserve themes/projection. Fourteen focused unit tests and the desktop/phone Featured administration workflow pass. A separate two-session local check confirmed lock contention returns without generation. CI includes the new SQL regression but has not run remotely for this change.

## Restore map interaction — 2026-09-21 (owner visually approved)

FEAT-LST-001 / FEAT-GEO-001 / BASE-DEP-001 / ADR-066 / NR-13 → automatic
viewport loading in `capacity-map-loading.js`, the shared feed and Leaflet map.
The separate summary renderer, extra confirmation and manual loading controls are
removed. `tests/capacity-map-loading.test.mjs` proves all 154 records remain across
11 automatic pages, deduplication, selected retention, abort/stale denial and
cursor/failure stopping. Nine clustering unit tests include the crossing-offset
label regression that fails before the correction. Six focused desktop/phone
browser cases pass in `map-cluster-transition.spec.ts` and the dense-map smoke
case; TypeScript/source pass. Owner approved the restored map with “its good”.
Full gates and rollout remain pending, and the new loading changes need a separate review. Earlier aggregate/140-retention claims below are historical for the old
client; that integration is withdrawn, and national-scale client optimization is
deferred rather than imposing extra user interaction. See the map incident record.

## Chat initialization and fixture diagnostics — 2026-09-20

FEAT-GST-001 → disabled-until-hydrated public launcher and the delayed-script
regression in `tests/e2e/assisted-chat-audit.spec.ts`. It failed before the fix;
14 focused desktop/phone cases then passed with zero retries, including all five
previously retrying chat/history cases per viewport. BASE-DEP-001 → local-only,
bounded pre-import schema read and four diagnostic/redaction tests in
`tests/fixture-schema.test.mjs`. See `docs/AUDIT_READINESS_2026-09-20.md` for the
still-unconfirmed historical HTTP 500 cause and remaining release evidence.

## Security recurrence prevention — FEAT-SEC-001 / ADR-065

Extension relocation compatibility: the anonymous monitor uses existing
application relations and keeps exact guard-denial assertions; a missing public
extension route is no longer a dependency. Its regression failed before the
change. All 305 unit tests, specs/source and types passed, along with real local
SQL/REST/GraphQL/fixture-Auth checks and three live anonymous probes. The local
verifier exercises service reference access through SQL and a geographic
application RPC instead of requiring the extension table in the REST schema.
Provider execution and independent hosted catalog/advisor checks remain separate.

`docs/SECURITY_REGRESSION_REGISTER.md` maps NR-01–NR-10 to prevention, negative
checks, operational responsibility and enforcement limits. AGENTS, guardrails and
the PR template require the relevant lessons before sensitive changes. The
catalog verifier now rejects eleven deliberately unsafe states, including future
table/sequence defaults and a newly default-executable definer function. Its
fixtures roll back and preserve normal service access. Request-boundary evidence
covers SQL roles, real local REST/GraphQL, 300 unit tests and eight desktop/mobile
account/fleet cases. Hosted verification and active scheduled/provider controls
require separate operational evidence; they are not inferred from this matrix.


FEAT-SEC-001 / FEAT-IAM-001 / BASE-BE-001 / ADR-064 → migration 096,
application ACL/definer catalog gate, tests/sql/browser-boundaries.sql and
scripts/verify-database-security-gate.mjs. Actual active-session access failed
before repair and was denied afterward; inactive-session CRUD, own identity,
service/history, future grants and eight injected gate failures passed locally.
All 16 SQL suites, 297 unit tests, spec/source, TypeScript and build passed.
Focused desktop/mobile and clean-CI evidence are recorded in BUILD_VERIFICATION;
hosted rollout is separate.

FEAT-SEC-001 / ADR-063 → exact owner PostGIS containment, public-table catalog gate,
role denial SQL and scoped read-only advisor monitor. Local regression evidence
and pending provider-side enforcement are recorded in PRODUCTION_AUTHORITY.md;
no hosted resolution is implied.

## Release packaging and browser readiness — 2026-09-14

BASE-DEP-001 F26 → `.dockerignore`, Dockerfile builder guard and CI non-secret
canaries. A scratch context build proved application presence and private-state
exclusion; the normal container gate remains pending after Docker Hub DNS failure.
F25/F27 browser/fixture corrections → 158 enabled cases have passing evidence
across the full diagnostic run and focused retries; eight opt-in captures skipped.
CI includes all 14 rollback SQL suites and six concurrent authorization cases.
See BUILD_VERIFICATION and AUDIT_RELEASE_CANDIDATE for exact results and gates;
these do not imply a clean full-suite run or hosted rollout.

## Recorded-audit contracts — verified locally

| Contract | Implementation | Evidence and remaining gate |
|---|---|---|
| FEAT-FLT-001 / FEAT-TRK-001 / FEAT-ADM-001, ADR-058 | lifecycle port/controls/routes; migrations 090–091 | Four lifecycle unit tests, rollback SQL and two queued former-Driver cases passed; desktop/phone lifecycle browser passed |
| FEAT-IAM-001, ADR-059 | account-security handoff, own-session Auth routes/controls; migration 092 | Four validation/handoff tests, `tests/sql/account-security.sql` and four concurrent closure cases passed; desktop/phone inbox/browser passed under local Auth settings |
| FEAT-LST-001 / FEAT-MAT-001, ADR-060 | bounded map windows, public aggregate cells, private SQL filtering; migration 093 | Unit tests, viewport SQL, 5,000-truck scale/EXPLAIN and throttled desktop/phone browser passed; dense-map regressions passed on both viewports; eight clustering tests include the F21 failing-before-fix reproduction |
| FEAT-PRV-001, ADR-062 | Public metadata/name SQL projections; migration 095 | Hidden-contact/path/surname SQL assertions and independent/company desktop/phone HTML privacy checks passed |
| FEAT-SUP-001 / FEAT-GST-001, ADR-061 | authorized revisions, conditional HTTP, no-overlap/backoff polling; migration 094 | Conditional tag test, `tests/sql/support-polling.sql` and desktop/phone `tests/e2e/support-polling.spec.ts` passed |

Final quality: 290 tests, TypeScript, 28 specs and 349 source checks. All 34
affected browser cases passed across focused runs; BUILD_VERIFICATION records
final build evidence and exact scope. These entries do not imply hosted rollout
or visual approval.

FEAT-LST-001 F22/F24 → PublicCapacityFeed feedback in the selected summary and
phone summary width reserves zoom controls. `tests/e2e/map-feedback.spec.ts`
proved the old overlap/intercepted click, then passed desktop/phone at six widths
including 320px with loading, failed refresh, real retry and closing. Shared
public/private shell and dense-map regressions passed; screenshots were inspected.
F23 corrects stale spatial/polling headings to match previously passing evidence.

## 2026-09-14 member Support attachments (local)

FEAT-SUP-001 / BASE-BE-001 / BASE-DEP-001, ADR-057 → migration 089,
`support-attachments.js`, SupportThread multipart replies, private attachment
route, and managed cleanup worker. Five tests cover input bounds, safe names,
delete ordering and retryable failures; the worker test verifies bounded safe
counts. `tests/sql/support-attachments.sql` proves atomic attachment, idempotent
retry, current ownership/assignment/permission/activation, closed-history reads,
stale/failed cleanup and service-only permissions.
`tests/e2e/support-attachments.spec.ts` proves real member PNG/staff PDF browser
uploads/downloads, invalid-content cleanup, retained older/closed history and
cross-conversation/member/anonymous/reassigned-staff denials on desktop/phone.
Final gate evidence and rollout limits are in BUILD_VERIFICATION.

## 2026-09-14 Tracking foreground location controls (local)

FEAT-TRK-001 / BASE-FE-001 / BASE-BE-001, ADR-056 →
`tracking-location-controls.js`, ProviderTrackingControls and the recipient
Tracking guidance. Seven pure tests cover radius/result validation, hidden
callbacks, cancellation, fetch abortion, single-flight ownership and retry.
`tests/e2e/tracking-location-controls.spec.ts` exercises real local travel and
location persistence, privacy radii, server/client cooldown, delayed-GPS selection retention, hidden callbacks,
permission retry and local Mailpit recipient access on desktop/phone. Sensor
coordinates and visibility transitions are simulated; server persistence is
real. Final evidence and limits are in BUILD_VERIFICATION.


## 2026-09-14 public provider fleet paging (local)

FEAT-PRV-001 / FEAT-LST-001 / BASE-BE-001, ADR-055 → migration 088,
`public-provider-paging.js`, public provider repository projection, canonical
provider page and ProviderFleetShowcase count labels. Input/adapter tests are in
`tests/public-provider-paging.test.mjs`; rollback SQL proves complete fleets over
96 signals, owner scope, page limits, stable evidence and public visibility.
`tests/e2e/public-provider-paging.spec.ts` traverses independent and Company fleets
on desktop/phone, opens a late truck map, checks hidden fields, browser Back and
invalid/out-of-range pages. Final evidence is in BUILD_VERIFICATION.


## 2026-09-14 Driver portraits (local)

FEAT-FTR-001 / FEAT-IAM-001 / BASE-DEP-001, ADR-054 → migration 087,
`driver-portrait-image.js`, `driver-portrait-storage.js`, Account photo editor,
`/api/account/portrait`, `/api/public/driver-portraits/[id]`, Featured candidates
and signed managed cleanup. Pure image/Storage tests cover metadata removal,
format/animation/size denial, reserved references and failed-deletion retention.
`tests/sql/driver-portraits.sql` rolls back ownership, consent, replacement,
revocation, activation/cancellation/cleanup ordering, stale/retry boundaries and
browser-grant checks. `tests/e2e/driver-portraits.spec.ts` uses real local Storage
and exact synthetic Driver/provider/truck/Featured rows on desktop and phone.
It covers consent, rendered uploads, private bucket denial, Featured images,
replacement, malformed input, invalid actor, deactivation and removal fallback.
Final counts, screenshots and limitations are in BUILD_VERIFICATION.

## 2026-09-14 account maintenance and callback isolation (local)

`FEAT-IAM-001` / `FEAT-FLT-001` → `src/lib/account-details.js`,
`src/lib/identity/account-details.ts`, `/api/account/details`,
`src/components/account-details-form.tsx` and Account & plan. Migration 086
repeats active session-actor authorization and validation and preserves private
phone ownership during fleet edits. Shared names retain their current display
semantics; there is no general user-edit or Auth email-change command.

Evidence maps to `tests/account-details.test.mjs` (input and role policy plus
exact function replacement), `tests/sql/account-details.sql` (rollback-only
actor/input/grant denial, audit privacy, field isolation and state persistence),
and `tests/e2e/account-details.spec.ts` (real local visible saves, reloads,
clearing, invalid-input retention, authority/origin/inactive denial and public
callback snapshots plus native POST). Both account browser cases and both
existing fleet onboarding/contact cases pass on desktop/phone. Quality (256
tests, 28 specs, source checks and TypeScript) and the 84-page build pass.
Migration 086 is local only; final scope and limits are in BUILD_VERIFICATION.

## 2026-09-14 retained chat history and assignment denial (local)

- `FEAT-SUP-001`, `FEAT-GST-001`, `FEAT-LST-001`: migration 085 and
  `src/lib/support-history.js` / Support adapter provide bounded, stable,
  conversation-scoped message windows. Member, team, recovery and launcher
  history controls keep earlier messages reachable without unbounded DOM or
  response growth. History does not mark current replies read.
- Migration 084 replaces exactly four guest assignment predicates with
  NULL-safe denial. Existing service-role-only grants and file authorization
  remain; retain this repair if rolling back the history UI.
- `tests/support-history.test.mjs` checks cursor validation, window metadata,
  links and migration function inventory. `tests/sql/support-history.sql`
  checks 121-message traversal, tied timestamps, arrival stability, unread
  preservation, terminal pages, wrong cursors, inactive/unrelated actors,
  removed permissions, unassigned read/reply/closure/attachment denial,
  no denied side effects and browser-role RPC denial. All SQL changes roll back.
- `tests/e2e/support-history.spec.ts` passes on desktop/phone: four real local
  cases cover member/team and guest launcher/recovery/team paths and private
  Storage reads; two mocked-failure cases cover retry/draft retention. Six
  existing assisted-chat cases also pass. Eight focused screenshots are under
  `artifacts/support-history-2026-09-14/`. Complete gate status is recorded in
  `docs/BUILD_VERIFICATION.md`; no hosted rollout is implied.

## 2026-09-14 map/navigation overlap repair (local)

`FEAT-UIX-001` / `BASE-FE-001`: the shared desktop rail variables and bounded
public-market flex layout in `src/app/globals.css` are verified by
`tests/e2e/public-map-shell-layout.spec.ts`. Four desktop/phone cases exercise
Open and real email-unlocked Private capacity at ten widths (320–2560), short
phone reflow, header/navigation/session separation, viewport bounds, usable
map size, Filters dismissal and navigation away. Synthetic private grants are
revoked in cleanup. Sixteen screenshots: `artifacts/map-shell-2026-09-14/`.
Quality passes with 248 tests and TypeScript; complete gate status is recorded
in `docs/BUILD_VERIFICATION.md`. No database, authorization or hosted change.

## 2026-09-13 current-audit repairs (local)

- `FEAT-MAT-001`: `capacity-geographic-match.js` and
  `capacity-filter-places.js`, used by public/private/team projections;
  `tests/audit-geographic-matching.test.mjs`, `capacity-filter-places.test.mjs`,
  and desktop/phone `capacity-filter-validation.spec.ts` prove complete criteria
  and actionable invalid-place handling.
- `FEAT-GST-001`: `public-assisted-chat.tsx`, `guest-chat-refresh.js`, and current
  conversation API; `guest-chat-refresh.test.mjs` plus six desktop/phone
  `assisted-chat-audit.spec.ts` cases prove submission and bounded polling
  behavior. Chat transport is mocked only in these browser tests.
- `FEAT-SUP-001`: `support/team-authorization.js` and the team-creation adapter
  and route deny before external Auth writes. `team-authorization.test.mjs`
  covers role/persisted-active checks and command ordering.
- `FEAT-TRK-001`: migration `083`, `readProviderTrackingProof`, the event-specific
  proof GET endpoint and `TrackingProofLink` on three detail surfaces;
  `tracking-proof-access.test.mjs`, rollback SQL
  `tests/sql/tracking-proof-access.sql`, and real desktop/phone
  `tracking-proof-audit.spec.ts` cover Storage bytes, email OTP, revoked and
  unrelated access, and admin/provider/guest links.
- Gates: 248 tests, TypeScript, 28 specs, 319 source files, optimized build and
  10 focused desktop/phone E2E cases passed. No remote rollout or commit.
  See `docs/BUILD_VERIFICATION.md` and current audit for remaining gaps.

## 2026-09-13 empty-fleet lifecycle

`FEAT-FLT-001` / `FEAT-IAM-001`: migrations `081`–`082`,
`fleet-driver-management.ts`, the verified OTP/OAuth completion branches,
`/join-fleet`, `/app/fleet/drivers/new`, invitation/contact/vehicle-detail APIs,
Fleet controls and role-specific empty states implement invitation → verified
acceptance → assignment → publication → revocation. The shared membership check
matches migration `078` discovery eligibility. Contact changes and truck details
preserve identity and history.

Mapped evidence: `tests/fleet-onboarding.test.mjs`, rollback-only
`tests/sql/fleet-driver-onboarding.sql`, `tests/e2e/fleet-onboarding.spec.ts`,
`tests/e2e/driver-document-clarity.spec.ts`, existing truck-registration browser
checks, and `scripts/verify-supabase-workspace-fleet.mjs`. Both new-fleet browser
runs use real local Auth OTP and Mailpit invitation notification, never a seeded
Driver shortcut. Production rollout and real hosted Google acceptance remain
separate from this local checkpoint; see `docs/BUILD_VERIFICATION.md`.

## 2026-09-13 launch controls, automatic selection, and loading

`FEAT-BIL-001`: migration `079`, `platform-controls.js`, the `/admin/settings`
page/command, `subscription-access.js`, and the managed identity projection keep
Free / Trial-then-payment behavior consistent across UI and PostgreSQL. Mapped
tests: `tests/platform-controls.test.mjs`, rollback-only
`tests/sql/platform-controls.sql`, and `tests/e2e/platform-controls.spec.ts`.
The local verification/billing verifier checks Free-mode denial, then temporarily
enables paid mode for the existing positive payment-review assertions and restores
Free in cleanup; it still refuses remote targets.

`FEAT-FTR-001`: migration `080`, `featured-automation.js`, managed operations,
shared eligibility lookup, and Featured settings implement persistent automatic
selection and preserved manual days. The same SQL test checks current Drivers,
count, no duplicates, manual mode/drafts, retry invariance, and browser denial.
The unit contract checks all seven themes and rotation safeguards; worker tests
retain only sanitized counts. Focused browser tests exercise mode changes,
immediate preparation, and manual publication on desktop and phone.

`FEAT-UIX-001`: shared `SurfaceSkeleton`, route loading boundaries, component
fallbacks, and `NativeFormFeedback` map to unit accessibility/motion/submitter
contracts and the same browser suite's throttled map-module and native-save
checks. Evidence and production limitations are in `docs/BUILD_VERIFICATION.md`.

## 2026-09-13 Driver linkage and optional evidence

`FEAT-FLT-001` / `FEAT-CAP-001` / `FEAT-VER-001`: migration `078` resolves
the active independent or same-company assigned Driver, guards publication,
location/duty updates, and both capacity projections, and supplies the named
Driver to the authorized workspace. Fleet rows, truck details, and the map's
selected truck expose the relationship; separate expandable Driver/truck
document summaries never infer approval from an empty array.

Evidence: `tests/sql/capacity-driver-eligibility.sql` tests no-document
publication, inactive/unassigned/nonmember exclusion, independent identity,
and browser denial inside a rolled-back local transaction. CI runs this check.
`tests/driver-document-eligibility.test.mjs` tests missing/expired/wrong-truck
approvals. `tests/e2e/driver-document-clarity.spec.ts` covers desktop and phone
Driver navigation and safe expandable evidence. The 5,000-truck scale fixture
now supplies unique active assigned Drivers, retains its original bounded-page
and time assertions, and confirms rollback of both trucks and Auth identities.
Local gates and pending deployment are recorded in `docs/BUILD_VERIFICATION.md`.

## 2026-09-13 focused capacity editing evidence

`FEAT-CAP-001` / `FEAT-UIX-001`: `capacity-form.tsx` keeps the map mounted;
`capacity-edit-dialog.tsx` supplies the native modal/focus boundary;
`capacity-signal-editor.tsx` and `capacity-market-planning.tsx` isolate drafts.
The existing authenticated capacity routes negotiate JSON or native redirects.
Migration `077` preserves confirmed Driver fixes and atomically replaces regular
service. Mapped verification: `tests/e2e/capacity-signal-dialogs.spec.ts`, the
capacity-summary scenario in `tests/e2e/smoke.spec.ts`,
`tests/provider-capacity-supabase.test.mjs`, and
`scripts/verify-supabase-provider-capacity.mjs`. Responsive screenshots, quality,
build results, and the pending Production rollout are recorded in
`docs/BUILD_VERIFICATION.md`.

The follow-up split into Capacity, Coverage, Sharing, Loads, Regular, and Location
is covered by the same desktop/phone suite with real consecutive status/sharing/
preference saves, first-publication Private visibility, and Off Duty persistence.
The suite exposed a stale-snapshot race and a phone header/rail overlap before
their corrections. `tests/provider-capacity-supabase.test.mjs` additionally maps
known validation messages and redacted unexpected-database diagnostics.

| Feature | Frontend | Backend/domain | Deployment concern | Primary tests |
|---|---|---|---|---|
| `FEAT-IAM-001` | Google and numeric email-code transporter login and signup, safe reconciliation of confirmed pre-bootstrap identities, private account contacts, and public-first installable PWA shell with distinct Open capacity, Private capacity, Track, Featured, and workspace shortcuts | Supabase-only SSR PKCE session, fixed callback, signed flow-bound OAuth intent, signed 15-minute signup handoff, guarded inactive DRIVER bootstrap, active provider-role projection, Production-disabled Supabase-fixture password boundary, no signed-cookie/SQLite identity fallback, and explicit anonymous projection boundaries | `065_reconcile_prebootstrap_auth_profiles.sql`, exact Site URL/Redirect URL allowlists, browser-enforced CSP OAuth destinations, Google identity scopes, numeric email template, verified SMTP, session secret, proxy-safe redirects, service-worker cache boundary | `tests/auth-flow.test.mjs`, `tests/provider-signup-supabase.test.mjs`, `tests/security-headers.test.mjs`, visible-browser OAuth check, managed runtime boundary, managed identity, launch readiness, authorization, PWA manifest test, E2E |
| `FEAT-APP-001` | Immediate Fleet transporter, Owner-operator, or Self-managed driver signup after Google or email-code identity proof; seeker guidance to public browse | Signed 15-minute identity handoff, server-only provisioning intent, inactive Auth bootstrap, migration-installed minimum plan catalogue, and atomic operating-model/workspace/microsite/application/seven-day-trial provisioning with authority activated last | `045_managed_provider_signup.sql`, `072_required_plan_catalog.sql`, RLS/browser denial, rate limiting, audit, transactional rollback | managed signup contract, clean local Supabase signup verifier, hosted plan/eligibility diagnostic, E2E handoff |
| `FEAT-SHP-001` | Provider-created Tracking session and durable provider history; no demand posting or Shipment Board | Service-role-only managed Tracking commands, provider ownership, assigned truck/Driver scope, one customer-owner email, atomic grants/delivery/events, and governed transitions | `044_provider_tracking_runtime.sql`, private customer data, default-deny RLS, audit | domain, provider-tracking, managed Tracking authorization, E2E |
| `FEAT-CAP-001` | East-Africa-pannable map-only Truck Market with a stable command area, status-specific bounded clusters, maximum-zoom truck chooser, pointed truck pins, road-coherent multi-city current Capacity routes, nearby polygon Service areas, one provider-level regular Service area or Capacity route, independent capacity/location age labels, and unified provider summary/focused editors | Empty/Partial Service-area-or-route choice, old-signal visibility until Off Duty, five non-overlapping age stages, unmixed maximum-eight screen cells at least as wide as markers, complete Private-network truck exclusion from anonymous projections, 2–5 ordered road-sequenced route cities, location-aligned center plus 3–5 boundary cities, maximum-one regular signal, Driver-only obscured location mutation, explicit public projection | Browser geolocation privacy, shared-map provider, location-keyed fixture-replacement migration, `041_capacity_signal_age_visibility.sql`, anonymous-projection review | domain, clustering contract, capacity-market, focused E2E, typecheck, source check |
| `FEAT-PRV-001` | Uniform Loadgistic `/@handle` microsites reached from truck details, with detailed active-truck cards, lazy relative maps, evidence-based Fleet transporter, Owner-operator, and Self-managed driver labels, reviews, media, and independently visible contacts | Handle ownership, safe nested truck/capacity projection, provider operating-model derivation, actor-scoped managed business/contact/image commands, shared presentation, service-role-only published-review summary, hidden-contact exclusion | `049_managed_provider_profile.sql`, quarantine/scanner/private media, browser-only visitor location, map/video provider terms, legacy redirects | provider-profile runtime and live Supabase verifier, capacity-market, featured-provider-venue, featured-providers, provider-tracking, focused desktop/mobile E2E and visual review |
| `FEAT-FTR-001` | Dedicated `/featured` Daily Featured Trucks workspace, full remaining-viewport billboard, Driver-portrait-led exact truck cards, separate Sponsors panel, automatic/manual 07:30–09:00 schedule, live truck or programme-interlude state, compact phone controls, component-shaped loading, and a non-dead exact-truck Market action only when that truck currently has Open capacity | One truck-type theme per weekday, exact active truck and current Driver selection, latest-capacity recheck, allowlisted public portrait projection with neutral icon fallback, target of 1–12, service-role-only candidate projection, up to four interludes of at most two minutes, equal whole-minute truck allocation, validated manual intervals, safe public projection, and atomic administrator roster recheck/save | `069_daily_featured_trucks.sql`, additive Driver portrait preset migration, exact day/vehicle uniqueness, active assignment and public-contact checks, service-role-only command, schedule/audit rollback | Supabase fixture verification, managed platform-admin contract, driver-portrait-policy, featured-truck-types, featured-truck-ui, featured-providers, expo-venue, route-separation E2E, keyboard dialog checks, focused desktop/mobile visual review |
| `FEAT-SPN-001` | Clearly labeled Sponsors panel beside the daily billboard on wide screens; on phones it shows two automatically rotating transporter or outside-advertiser cards | Unified sponsor catalogue, validated external contacts, bounded regional/date placement, transporter eligibility recheck, deterministic Sponsor-break attribution, and atomic administrator save/disable commands | `057_managed_platform_admin.sql`, advertising disclosure, service-role-only command, overlap denial, reduced-motion/focus-safe rotation | managed platform-admin contract and live verifier, featured-providers, two-card phone projection, focused desktop/mobile E2E and visual review |
| `FEAT-NET-001` | No current network, Favorites, requests, or Partners discovery surface | Relationship reads/mutations retired; fake local relationship rows purged | Retired-route monitoring; restore only from an approved backup | source checks, E2E redirects |
| `FEAT-FLT-001` | Ordered Driver identity, exclusive truck assignment, owner-scoped Add truck flow, capacity/tracking permissions, and restricted/full Driver Home states | Service-role-only bounded Fleet projection plus atomic truck registration and Driver assignment/Capacity/Tracking permission commands under repeated owner, subscription, organization, Driver, and truck checks | `050_managed_workspace_fleet.sql`, `066_provider_vehicle_registration_and_admin_details.sql`, contact-safe audit, browser RPC denial, no inferred Capacity/location/assignment/verification state, no runtime SQLite fallback | workspace/Fleet runtime contract, live local Supabase Fleet verifier, truck-registration contract, authorization, desktop/mobile E2E |
| `FEAT-MKT-001` | Route-level public app shell centered on capacity sharing and shipment tracking, canonical map-only `/` Truck Market, Open capacity → Private capacity → Track → Featured navigation, live Transporter/Truck suggestions, visually scannable illustrated filters, automatic map centering with manual retry, independently optional criteria, compact fixed in-map truck/signal details, responsive navigation, and safe retired-route redirects | Explicit anonymous capacity projection, exact handle/truck selection, conjunctive unranked privacy-safe filtering in which every supplied criterion matters and omissions stay neutral, query-isolated non-shared filter responses, browser-only visitor exact location, separate Market/Featured projections, and a `410 Gone` member-directory API boundary | Route-split bundle/projection review; bounded marker loading and clustering; safe-area review; no private IDs, exact positions, hidden contacts, party data, files, compatibility-repository reads, or invented claims | capacity-market, query-cache-isolation, domain, managed runtime boundary, featured-provider-venue, PWA manifest, route/filter E2E, filter accessibility and viewport fit, focused desktop/mobile visual review, full E2E, UI audit |
| `FEAT-VER-001` | Vivid category-colored expandable evidence badges, persistent due-diligence warning, verification center, admin review queue, profile badges, and Shipment/Truck Board trust strips | Actor-scoped managed center/submission/file/review commands with subject ownership, type policy, pairing expiry, duplicate and terminal-review checks | `051_managed_verification_billing.sql` plus `052`–`053` variable-scope corrections, private quarantine/release, browser denial, audit | Verification/Billing runtime contract, live local Supabase verifier, authorization, E2E |
| `FEAT-TRK-001` | One 80-bit customer-owner code/link, separate 80-bit review code, complete entry-format guidance, observable public code submission and denial, temporary guest Tracking, ordered provider/Driver action panel, optional customer-safe approximate travel map, owner emails, and 30-day guest expiry | Dedicated Tracking-secret code derivation and digest independent of session rotation, assigned-Driver scope, explicit location consent, browser-obscured travel-only location, ten-minute refresh limit, valid transitions, image-proof authorization, shared unlock/review limits, idempotent managed delivery queue, safe guest projection, retention redaction | `TRACKING_CODE_SECRET`, `044_provider_tracking_runtime.sql`, `046_managed_email_operations.sql`, preferred Resend/bounded SMTP/optional webhook port, private storage, scanning, retries, cleanup monitoring | `tests/tracking-code-security.test.mjs`, provider-tracking, managed Tracking negative authorization, `tests/email-delivery.test.mjs`, `tests/rate-limit.test.mjs`, valid/invalid Tracking E2E, focused location projection E2E, UI audit |
| `FEAT-PLC-001` | Async Ethiopia-first place comboboxes with country-qualified labels and a bounded client cache | Bundled 3,575-place OSM-derived catalog, repeatable import, country metadata, legacy-label normalization, query-isolated non-shared server responses, bounded client-local search cache, coordinates, and built-in fallback | OSM attribution, optional PBF input, Supabase batch import, and import metrics | domain, repository, query-cache-isolation, E2E |
| `FEAT-GEO-001` | Green Empty and yellow Partial Service-area-or-Capacity-route availability, isolated selected-truck map, persistent multi-signal inspector, persisted Driver refresh, visible browser-only visitor point/ranges, and one muted-orange regular Service area or Capacity route | Driver/browser displacement, Driver-only refresh authorization, separate approximate-location circle, current/regular geometry invariants, polygon and route matching | Central HTTPS tile configuration, visible linked attribution, exact-origin CSP, non-blocking community fallback warning, responsive resize reliability, indexed place catalog, exact-location exclusion | map-tile config/readiness/CSP, domain, capacity-market, critical E2E, full E2E, UI audit |
| `FEAT-MAT-001` | Public structured route, status, signal-geometry, illustrated truck-configuration, load-type, stop-pattern, freshness, Service-area, Capacity-route, and visitor-proximity filters with explainable evidence | Deterministic AND eligibility across every supplied criterion; complete-polygon proximity; one- or two-endpoint matching across every segment of a multi-city route; direction; visitor/truck uncertainty overlap; and geometry-consistent evidence | Pure deterministic domain functions plus indexed Supabase JSONB place collections and server-only PostGIS RPC filtering; `073_public_capacity_filter_alignment.sql` | domain, capacity-market, Supabase-fixture filter-alignment regression, focused desktop/mobile route/filter E2E, accessibility, UI audit |
| `FEAT-PST-001` | No current pooled or along-route demand surface | Shared-demand projections retired and fake local source rows purged | Retired-route monitoring; restore only from an approved backup | source checks, E2E redirects |
| `FEAT-BIL-001` | Provider signup trial, billing-focused limited Home, Account/private payment proof, paid status, and admin review | Actor-scoped managed summary/submission/file/review commands, workspace ownership, seven-day trial, terminal review, and 30-day paid period | `051_managed_verification_billing.sql`, private quarantine/release, browser denial, audit | Verification/Billing runtime contract, live local Supabase verifier, domain, authorization, E2E |
| `FEAT-ADM-001` | Compact Administration Overview, direct Records inventories, bounded per-record detail routes, Tracking timeline, connected Review/Capacity/Featured/Support work queues, permissioned platform-team management, and explicit record actions | Supabase-only bounded inventory/count/detail projections, least-privilege responsibility checks, support routing oversight, reversible status commands, atomic featured roster/Sponsor commands, application-free signup, review terminality, and admin audit | `057_managed_platform_admin.sql`, `066_provider_vehicle_registration_and_admin_details.sql`, `067_admin_overview_counts.sql`, secret/location/proof exclusion, service-role-only RPCs, server-side permission enforcement, requeue safety, and mutation audit | managed platform-admin contract and live verifier, all-eight-record desktop/mobile E2E, authorization, featured-providers, focused visual review |
| `FEAT-SUP-001` | Native member Support with persistent New chat, Continue chat, and Past chats states; member End chat; bounded agent inbox; conversation detail; filtered admin triage; and passwordless admin Support Team | Actor-scoped managed conversation/message commands, owner/assigned-agent/admin closure, support-only role, atomic cross-queue capacity-aware assignment, pagination-independent active lookup, and audit | `054_managed_support_runtime.sql` plus `055`–`056` identity/permission corrections, browser RPC denial, bounded polling with later authorized Realtime | Support runtime contract, live local Supabase verifier, authorization, focused desktop/mobile E2E, UI audit |
| `FEAT-SHR-001` | Provider Network controls, eligibility-aware six-digit Private capacity email-OTP entry, a clear no-share result that remains on the email step, one multi-truck authorized capacity map, non-overlapping visible logout, 30-minute deliberate-activity idle timeout, and Loadgistic assisted-matching opt-in | Truck-scoped email/platform grants, Driver create/revoke, owner oversight, no challenge or delivery for an unshared email, single-use OTP/session digests, origin/email verification limits, just-in-time both-kind lease fencing, truthful provider-success acknowledgement, bounded credential cleanup, bounded rolling renewal, complete anonymous exclusion of Private-network trucks, exact-coordinate exclusion, immediate revocation, and no Auth account/runtime fallback | `058_guest_access_retention.sql`, `059_targeted_access_email_delivery.sql`, authenticated two-minute Netlify background recovery, managed PostgreSQL plus loopback-only local Mailpit and preferred Production Resend/bounded SMTP/optional webhook email, private Storage, shared rate limit, privacy monitoring | managed runtime boundary, private-capacity runtime and live verifier, `tests/email-delivery.test.mjs`, `tests/private-capacity-runtime.test.mjs`, rate-limit tests, focused desktop/mobile E2E and no-share/active-session captures |
| `FEAT-GST-001` | Account-free Assisted matching conversation, persistent public launcher, and recovery flow integrated with the support inbox | Server-held guest digest, immediate atomic queue assignment, two-second visible polling, route-persistent authorized conversation, strict conversation/file reads, and no demand entity | `054_managed_support_runtime.sql`, quarantined/scanned private support bucket, managed email, browser RPC denial, authorized Realtime rollout, shared rate limit | Support runtime contract, live local Supabase verifier, `tests/private-capacity-network.test.mjs`, focused desktop/mobile E2E and captures |
| `FEAT-REV-001` | Verified customer-owner review form, public provider reputation, and provider low-rating dispute status | Shipment-bound review grant, one review per completed Tracking session, all-score publication, service-role-only provider dispute command, audited terminal decision | `044_provider_tracking_runtime.sql`, email authorization, expiry, moderation audit | repository, managed Tracking authorization, E2E |
| `FEAT-DAT-001` | Busy city-and-town public capacity/map/microsite fixtures across fleets and owner-operators, with an explicitly authorized additive hosted-pilot path | Credential-free PostgreSQL-native 30-provider/143-truck supply fixture across weighted Ethiopian markets and at least 60 real named localities, with no dominant locality, repeated diagonal offset, or identical fleet pattern; 91 cargo vans, pickups, or mini trucks, 12 courier cars, no motorcycles, and smaller light/medium/rigid-heavy/interchangeable-tractor cohorts; active owning-Driver assignment and an exact 21 existing/24 generated/98 icon portrait mix; current attached trailer as the public configuration; seven-day Featured eligibility; mostly 30 km compact-delivery geography with three plausible regional courier corridors; wider light-truck geography; occasional logical regional routes; current-date Featured/Sponsor generation; full cursor traversal; no demand records | Destructive reset remains local-only; hosted pilot requires exact project confirmation, collision preflight, random unrecoverable Auth credentials, backup checksum, deterministic row namespace, exact rollback, and no synthetic privileged identity | managed fixture contract and live verifier, production-pilot policy/import dry-run and approved hosted execution, independent hosted database/API/browser verification, driver-portrait-policy, vehicle-catalog policy, clustering contract, focused desktop/mobile E2E, UI audit |
| `FEAT-LST-001` | Progressive bounded Truck Map loading, maximum-eight linear-time screen-cell clusters, and bounded provider/admin histories | Opaque cursor contract, deterministic ordering, deduplication, filter and map-state restoration, bounded operational pages | Query latency and dense-render monitoring | repository, E2E, focused desktop/mobile review |
| `FEAT-UIX-001` | Professional capacity-sharing and shipment-tracking copy, shared route-aware desktop/mobile public app shell, bounded icon-led capacity filter with image-based truck selection, provider mobile app shell, compact Administration hierarchy, Map-first discovery, keyboard-operable controls, non-overlapping responsive overlays, short actions, touch targets, reversible details, and a current-product release audit | Existing authorization plus explicit provider, fleet, guest, review, and administrator commands remain server enforced | Multi-role route, interaction, visual, copy, fixture, safe-area, current-page accessible-name, contrast, target-size, viewport-fit, and overflow evidence that excludes retired product paths | focused route/filter and administration E2E, filter accessibility, E2E, UI audit, stress audit, `docs/APP_AUDIT_2026-08-11.md` including the 2026-08-13 responsive-shell follow-up |

All features depend on `BASE-BE-001`; user-facing features depend on `BASE-FE-001`; runtime and release constraints derive from `BASE-DEP-001`.

Cross-feature authorization contracts are mapped in `docs/AUTHORIZATION_MATRIX.md` and verified by the focused capacity-market, provider-tracking, domain, and E2E suites.

Production deployment readiness is mapped in `docs/LAUNCH_READINESS.md` and checked by `npm run launch:check`. `BASE-DEP-001` maps shared abuse control to migration `047_shared_rate_limits.sql`, `src/lib/rate-limit.js`, the managed operations worker, and the local concurrency/privacy/RLS verifier. It maps private-upload protection to migrations `048_private_upload_quarantine.sql` and `074_netlify_safe_upload_limit.sql`, `src/lib/private-storage.js`, `src/lib/upload-scanner.js`, and the local size/signature/clean/dirty/cleanup/browser-denial verifiers. The additive `075_hot_path_foreign_key_indexes.sql` migration and its source contract test map observed common relational lookups without dropping low-traffic indexes. The command remains intentionally red until the remaining hosted scanner/email/deployment evidence is complete.

Playwright runs through `scripts/run-e2e.mjs` and `scripts/e2e-server.mjs` on isolated port `3100` by default, with `PLAYWRIGHT_PORT`/`PLAYWRIGHT_BASE_URL` available for a clean alternate port. It uses the configured local Supabase services and synthetic managed fixtures; it does not use a SQLite test database. Audit helpers reject hosted targets, and CI starts and imports an isolated local Supabase instance.

The local visual audit (`npm run test:ui-audit`) covers logged-out and role-scoped current-product screens at desktop and mobile sizes: homepage, About, Capacity list/map, provider microsites, Track, provider dashboards, Fleet/capacity controls, provider shipments, profile editing, verification, Support, and bounded administration. It checks response status, horizontal overflow, touch targets, unlabeled controls, icon coverage, empty commands, map rendering, and browser errors. Screenshots and `report.json` are written to the ignored `artifacts/ui-audit/` directory. Focused visual approval is required before running this expensive full audit.

`tests/capacity-market.test.mjs` verifies the deterministic supply-only reset, zero legacy demand rows, 30 published provider pages, nine fleet companies, 21 independent profiles, 143 current signals, at least 60 real named operating localities, bounded locality concentration, non-diagonal offsets, distinct large-fleet branch patterns, a 100-truck local-delivery cohort, complete cursor traversal without duplicates, public Driver first name/callback/operating-model/document-category projection, location-aligned and road-coherent Empty/Partial multi-city Service-area and Capacity-route geometry, the primary Driver demo's compact same-market location/current/regular geometry, provider/truck/geometry text search, full-polygon current and regular Service-area proximity, every-segment freight alignment with current or regular Capacity routes, exactly one regular Service area or Capacity route per provider, application/database rejection of a second signal, public contact controls, safe projection, and optional anonymous proximity. Clustering tests and focused desktop/mobile E2E verify stable geographic anchoring, bounded same-status groups, unlike-status label separation, map-only geolocation centering, and explicit proximity filtering.

`tests/featured-truck-types.test.mjs`, `tests/featured-truck-ui.test.mjs`, `tests/expo-venue.test.mjs`, `tests/featured-providers.test.mjs`, and `tests/e2e/smoke.spec.ts` verify the seven-day truck-type rotation, exact active truck and assigned Driver selection, deterministic equal whole-minute automatic scheduling inside 07:30–09:00 EAT, no more than four two-minute programme interludes, break-safe live state, validated and safely projected manual intervals, administrator publication, current-day fixture repair without administrator overwrite, responsive remaining-viewport layout, separate Sponsors treatment, keyboard-accessible exact-truck details, and featured/sponsored profile and exact-truck map actions. Focused schedule review captures are written to `artifacts/featured-schedule-v1/`; the expensive full-site visual audit remains approval-gated.

Final UIA-08 screenshot review also caught the detail badge exposing the internal
Profile Route kind for an area. List/detail badges now say Service Area; the
focused browser checks assert this alongside the area description. Final area
captures: `artifacts/ui-contract-area-final-review-2026-09-21/`.
