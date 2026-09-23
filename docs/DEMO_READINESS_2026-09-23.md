# Demo workflow readiness — 2026-09-23

Scope: Loadgistic only, local assessment of the current pre-release worktree.
The owner subsequently authorized fixing and deploying this candidate. This local
evidence is not production certification; release results are recorded separately.
No hosted mutations or messages to real recipients are part of this check.

## Focused checks

- [x] Recheck desktop/phone Tracking creation, customer OTP and proof access,
  private capacity sharing, and live guest/staff chat with the existing tests.
- [x] Close the browser coverage gap for completion → completion email →
  customer review, using an isolated synthetic shipment and local Mailpit.
- [x] Record actual defects separately from missing or older evidence.

Controlling contracts: FEAT-SHP-001, FEAT-TRK-001, FEAT-REV-001,
FEAT-SHR-001 and FEAT-SUP-001. Existing new-Driver, email-login and Clear all
evidence remains in PROGRESS and TRACEABILITY; no redesign is planned here.

## Current evidence

Eight desktop/phone cases pass in `artifacts/demo-workflow-check-20260923/`
(4.1 minutes): guest/staff chat and restart; Network grant and private email OTP;
provider-created Tracking with two recipient logins; actual proof upload,
matching downloaded bytes and revoked/unrelated-recipient denial.

Two new desktop/phone cases pass in
`artifacts/demo-completion-review-20260923/` (1.7 minutes). The isolated fixture
is created through application services; browser controls then save Going to
pickup, Loading, En route, Unloading and Complete, with database verification
at every step. The test reads the synthetic customer's actual local completion
email, completes guest email OTP, unlocks with its review code and publishes a
review. One published row and the visible review persist after reload. Captures
show the completed customer timeline and review. TypeScript passes.

No new functional failure was found in these ten cases. This is a bounded
rehearsal, not every role/state combination or an exact deployed-build test.
The initial completion-test launch was blocked by approval-system usage limits;
after the owner's continue instruction, the same reviewed launch succeeded.

## Corrections authorized after the assessment

- UIA-13: fractional ETB amounts now retain their minor units; 125050 displays
  as ETB 1,250.50. Storage is unchanged.
- UIA-14: pending document categories and truck pairings are excluded using
  the actor's existing request list. The form explains review status without
  granting approval or weakening duplicate protection.
- UIA-17: the desktop map context label sits below the collapsed Filters handle.
- Completion email now includes separately labelled Tracking and Review codes,
  with ordered instructions for email OTP and review verification. The browser
  regression starts a fresh guest session using only that completion email.
- A restricted Driver with no saved capacity is told to ask the fleet owner to
  set it up. Available stays disabled until that prerequisite exists; the
  server's permission boundary remains unchanged.

All six document/payment/rating desktop/phone checks pass in
`artifacts/demo-fixes-20260923/`; desktop completion also passes. The payment
and pending-document captures were inspected. Three initial browser runs were
incorrectly launched concurrently against the same development server and hit
five-second navigation/loading-state limits. Sequential checks with failure traces passed both private-map cases and the
desktop Driver permissions journey. They also exposed a test synchronization
error: status POSTs succeeded, but their streamed destination pages had not
finished when the five-second flash assertion ran. The completion test now waits
for that specific successful destination response before asserting the visible
message and stored status. Both phone and desktop permission journeys now pass, as does the revised
phone completion test; the final two-viewport completion run passes both cases (1.4 minutes) in
`artifacts/demo-completion-final-20260923/`.
Earlier failures are retained, not called passes.

`npm run quality` passes all 331 tests, source/spec validation and TypeScript.
The owner-approved login, Clear all and first-capacity review evidence remains
in PROGRESS and TRACEABILITY. The local server stays available at
http://127.0.0.1:3100.

## Limits to resolve before a live demonstration

- Current fixes are local and authorized for release; exact-candidate CI and
  hosted verification remain required. A local test is not a deployed-build test.
- Mailpit verifies local email generation/delivery, not real-inbox delivery,
  spam filtering, hosted sender configuration or latency.
- Both configured browser projects use Chromium. The pinned Playwright WebKit
  launch on this macOS version fails before opening the app because the frozen
  browser lacks PushAPIEnabled. Safari is unverified. Phone emulation and
  synthetic geolocation do not prove real device permission UX.
- Restricted, tracking-only, capacity-only and full company-Driver permissions
  now have desktop/phone browser evidence, including immediate denial after
  permission changes and removal. This does not certify every fleet history.
- Local completion-email and review submission now have fresh browser evidence;
  the customer-facing flow on the deployed host and actual recipient inbox are
  still unverified for this candidate.

## Remaining priorities

1. Finish exact-commit CI and normal release gates, then independently check
   the published artifact. Focused permission/completion checks now pass.
2. Rehearse the demo's actual phone/browser and location permission prompt.
   Foreground-only updates must not be presented as locked-phone GPS.
3. Use a designated demo recipient to confirm actual hosted inbox delivery.
   No real-recipient email is authorized or sent by these local checks.

## Full release CI follow-up

Run 35835686120 on f171c7a passed validation/container jobs but reported 208
browser passes, two failures, two retry passes and eight opt-in skips. Deployment
was held. UIA-22 records a real narrow-phone obstruction: floating support
covered map Try again. The repair reserves a compact support action in the phone
map header and verifies full touch-target and header-link separation.

The second failure was a zoom-test synchronization race with pagination requests
for the old window; the test now waits for an actually changed viewport. Drawer
gestures wait for their CSS transition, and auth tests await their actual server
response/navigation. Private access uses a server-component refresh, which the
corrected test handles explicitly. No workflow assertion or authorization check
is removed. Focused verification and a new exact-candidate CI run are required.

Final correction evidence: ten focused map/reset/admin cases pass in
`artifacts/ci-map-final-20260923/`; the two private-map cases pass in
`artifacts/ci-private-verified-20260923/`. The latter verifies action status,
visible login/logout and 401 denial without reading the logout keepalive body
after navigation. The trace identified that body wait as the intermediate test
stall. Phone recovery/header captures were inspected; the new candidate still
requires normal exact-commit CI and deployment checks.


## Published candidate verification

Commit 200c783 is live as Netlify deployment 6ab3aaa9668f9644dcba97d8.
CI 35843724742 passes all required jobs (211 browser passes, one retry-pass,
eight opt-in skips). Migrations 098–101, backup/restore and security gates pass.
Live desktop/phone login presentation, filters/reset, chat, account access and
private-document bytes/guest denial pass. Both viewports also pass real native
shared-route clicks/taps and clearance at two zoom levels; accessible SVG labels
are used because production omits the development CSS hooks. UIA-23 records the
missing custom hover/focus highlight for follow-up. Initial class-selector checks
failed and are retained; this is not a claim of clean first-attempt verification.
The streamed verification-page test now waits for its actual content before
checking documents. Safari, actual phone GPS and real-inbox delivery remain the
specific demo limitations listed above. The production release gate is complete.
