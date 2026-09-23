# Progress

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
- [ ] Full quality, exact-candidate CI, immutable release and live verification.

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
`35860658374`: validate/container pass; full browser job still running at 13:06 UTC.
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
