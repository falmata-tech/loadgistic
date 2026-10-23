---
id: FEAT-TRK-001
title: Authorized-party tracking, email verification and retention
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-REV-001, FEAT-GEO-001]
problem: Every party explicitly authorized for an agreed shipment needs a simple, private tracking handoff without creating a Loadgistic account or relying on a reusable code alone.
behavior: The current local FEAT-ENT-001 implementation starts Tracking after an offline agreement with one shipment-owner email and a stable Tracking reference. The verified owner may invite route/status viewers and explicitly authorize business staff to see location; ordinary viewers never receive vehicle position. Email access uses one OTP and a five-minute session. One idempotent completion summary reaches the owner, guest access expires 30 days after completion, and provider history remains. Hosted rollout remains pending; earlier multi-recipient provider workflows below are historical.
contracts: [CustomerTrackingCode, TrackingCodeSecret, TrackingCodeDigest, TrackingRecipient, TrackingEmailOtp, BrowserTrackingGrant, CustomerSafeTrackingView, TrackingLocationConsent, TrackingLocationSnapshot, TrackingIdleTimeout, TrackingAccessEmailPort, CompletionEmailPort, EmailDelivery, GuestRetentionPolicy, ProofFilePort, ManagedTrackingRepository]
observability: [tracking_recipient_added, tracking_recipient_revoked, tracking_otp_requested, tracking_otp_verified, tracking_unlock_success, tracking_unlock_denial, tracking_idle_expiry, tracking_location_saved, tracking_location_denied, completion_email_queued, completion_email_sent, completion_email_failed, completion_email_retry, guest_access_expired]
rollout: Require one server-only Tracking code secret before Production creates its first Tracking row, keep only keyed digests in persistence, and send one owner delivery with bounded retries. The empty hosted project may cut over without a data migration; a later Tracking-secret rotation requires an explicit code-reissue migration or a compatibility key window. Keep guest access disabled in production until sender configuration, private storage, scanning, retention cleanup and monitoring are verified.
---

# Guest tracking

### October18 approved source and recipient transition — implementation in progress

FEAT-ENT-001 / FEAT-SIM-001 supersede the older phone-only/all-recipient location
contract below. Tracking must resolve the assigned truck's explicitly selected
GPS, phone or dated manual source without depending on public Capacity visibility.
The primary verified shipment owner and explicitly granted current business staff
may see its obscured position. Ordinary recipients receive route/status only,
without coordinates, source/time, proof references or hidden location fields.
Provider-owned operational access, five-minute owner approval protection,
mandatory proofs and terminal location shutdown remain unchanged.

Given a current nonterminal shipment and selected GPS/phone/manual source\
When the owner opens Tracking\
Then the actual saved current source determines the obscured point and icon\
And wrong assignment, old source epoch, pending fix or terminal state yields no
current point rather than relabelling older data.

Given a secondary recipient verifies their own email\
When any supported web/native API or proof path is read\
Then only the route and shipment status are available\
And a CSS-hidden marker or a shared URL cannot grant location/proof authority.

### October 13 accepted map workflow — locally implemented; review pending

Given an unverified visitor opens Track on desktop, phone web or the mobile app\
Then an empty basemap fills the available page workspace behind the email-verification form\
And the form remains readable, operable and visible with the keyboard open\
And no shipment route, truck, contact, location or proof is loaded before authorization\
And OTP request, validation errors, verified entry, expiry and logout retain their existing behavior.

Given an authorized provider creates a new shipment\
When they choose pickup, one city they will pass through, and delivery\
Then three distinct catalog cities are required and saved in that order\
And choosing a suggestion by touch, mouse or keyboard retains its catalog reference before the form submits\
And PostgreSQL validates and snapshots each reference/coordinate\
And existing shipments retain their genuine two-city route without an invented intermediate city\
And existing route correction authorization, revision checks and post-pickup route lock remain enforced.

Given an assigned provider saves Loading or another permitted status without a new location report\
When the status form contains no location coordinates or device claim\
Then the event saves with its required proof and current route intact\
And a supplied but invalid location remains rejected by the existing device-location validation.

Given an assigned Driver/provider or currently verified recipient opens a shipment\
When its detail screen renders on web, phone web or native Android\
Then the map fills most of the available workspace and shows the reported ordered city route\
And available reported location uses only the saved obscured center and its authorized radius (at most 20 km)\
And the route remains useful without a location report, including status-only or completed shipments\
And the planned line is not represented as turn-by-turn road navigation\
And a compact floating progress control opens current, next and all possible steps with the existing lifecycle authority\
And completed/cancelled Tracking hides current location while preserving route and permitted history\
And clicking a proof opens a bounded authorized modal, with close/Escape/focus restoration and recoverable errors\
And clicking the truck opens its published truck/Driver/provider contact summary without private plates, recipient emails, actor IDs, exact GPS or proof paths\
And expiry, revocation, reassignment and terminal status retain their existing denial and location-reset rules.

Given an Operations-authorized member opens the shipment's existing management map\
When the narrow administrative location projection is adapted to the shared map\
Then the actual actor and exact shipment pass the existing Operations command
before any saved route read and again before returning the map\
And the final current status and obscured location come from that command\
And only explicit saved city-route fields and tracking mode supplement it\
And denied, revoked, missing or reset scope yields no administrative map\
And genuine legacy two-city and current three-city routes retain their saved order\
And no recipient data, proof reference, raw device location, private contact or
invented truck summary enters the map contract.

Given the Tracking map is already open\
When the saved city route is corrected or its first valid reported location arrives\
Then the camera fits the saved route and reported approximate area together\
And status-only refreshes, equivalent route objects and subsequent location updates preserve the user's camera\
And an update arriving before the camera is ready is applied when it becomes ready\
And this uses only authorized saved coordinates, with no exact-location request.

Given a ready camera rejects or throws while fitting an updated Tracking view\
Then at most one retry occurs on a later rendered frame\
And an older command failure cannot replace a newer pending view\
And final failure displays a bounded error while shipment progress remains usable\
And no unhandled rejection, remount or continuous recentering occurs.

This adds route persistence/projection and presentation, not new location
permission, longer access, arbitrary file support or staff administration on
mobile. Loading/unloading photo requirements and shipment-owner completion
approval remain authoritative. Reuse existing maps and progress controls.
Owner visual review of concrete web/native layouts precedes extensive gates;
new hosted SQL requires exact backup/rollback review before deployment.

Local evidence: `tracking-route-map.sql`, `tracking-map.test.mjs`, actual web
`tracking-route-map.spec.ts` and Expo `mobile-tracking-map.spec.ts` verify saved
routes, authorized OTP/proofs, revocation, public contacts and legacy readback.
The first-area browser case preserves the map canvas and camera on later updates.
`tracking-camera.test.mjs` passes9 readiness/update/failure cases;
`visitor-shipment-recovery.test.mjs` and both real email-access browser recovery
cases verify retry after private data is cleared. NR-36 applies. Exact138 and
rollback pass the isolated hosted136 snapshot rehearsal. Installed Android paint,
owner visual review, full gates, matching new-client rollout and publication
remain pending; distributed1.0.6 does not include these route inputs.

### Scenario: provider understands saved progress before choosing an update

Given an authorized provider opens Tracking on desktop or phone\
When saved status and event history are displayed\
Then the five journey steps distinguish Completed, Current, Next and Remaining in text\
And a step omitted from recorded history is never described as completed\
And the initial permitted Loading shortcut remains available with an explanation\
And Problem is separate from the ordered journey; recovery offers the existing permitted resume states without claiming one mandatory next step\
And selecting an available step changes only the pending selection until Save is submitted\
And the save label names the selected step, completed/cancelled sessions have no mutation controls, and assigned-Driver-only travel remains enforced\
And keyboard focus is visible and phone controls fit without horizontal scrolling.

Presentation-only contract: saved events/status and existing permitted transitions
remain authoritative. No migration, permission, email, or lifecycle changes.
Rollout follows NR-13 local owner review, then exact-candidate release gates;
rollback restores the application without rewriting shipment history.
Design references: [USWDS step indicator](https://designsystem.digital.gov/components/step-indicator/)
(explicit states and separate navigation) and [GOV.UK task list](https://design-system.service.gov.uk/components/task-list/)
(unordered task lists are not appropriate for an ordered journey).
Verification: `tests/tracking-progress.test.mjs` and
`tests/e2e/tracking-progress.spec.ts`; owner approved the progression layout on
2026-09-23. The recipient-save follow-up is a defect correction to its existing form.

### Scenario: one stable shipment code and authorized recipient list are issued

Given a provider owner, self-managed Driver, or company Driver assigned to the selected truck starts Tracking with one customer-owner email and zero or more additional recipient emails\
When tracking access is generated\
Then the public Track link is shown to the provider; existing high-entropy code generation remains internal for compatibility\
And the existing code remains internal to compatibility adapters while the provider shares the public Track link\
And the owner code contains 80 deterministic bits formatted as four readable four-character groups after `LG-`\
And legacy review-code derivation uses the same entropy in an `LG-RV-` format and a distinct derivation context\
And code generation and code digests use only the dedicated server-side Tracking code secret, so rotating the login-session secret does not change either code or its persisted digest\
And session-secret rotation requires a new email OTP without changing shipment history\
And only its keyed digest is stored\
And one recipient record belongs to the customer owner while every distinct normalized additional email receives its own revocable recipient record\
And the provider can inspect, add, or revoke recipients without changing the shipment code or another recipient\
And one idempotent application email containing the link and email-verification guidance is queued to each initial recipient through the managed application-email port rather than a Supabase Auth template\
And the standard isolated local environment delivers application email to loopback Mailpit while Production requires a managed provider.

### Scenario: an unsafe Tracking code secret blocks Production

Given a Production runtime is missing the dedicated Tracking code secret, supplies fewer than 32 characters, uses the documented local fallback, or reuses the login-session secret\
When readiness is evaluated or a Tracking code is derived\
Then Production is rejected with a bounded non-secret configuration error\
And local development alone may use the deterministic local fallback\
And no code, digest, or secret value is returned by readiness output or written to logs.

### Scenario: Tracking submission gives an observable result

Given an authorized provider or assigned Driver completes every required Start Tracking field\
When Start Tracking is activated\
Then the action enters a visible submitting state and cannot be submitted twice\
And success replaces the form with the durable Tracking reference, Track link, and Open Tracking action\
And a validation, authorization, or delivery-preparation failure leaves the entered form available and displays a visible error beside the action\
And the public Track form opens currently authorized shipments after email verification while an invalid OTP returns a visible error instead of appearing inactive.

### Scenario: an unassigned actor cannot start Tracking

Given a company Driver selects a truck not currently assigned to that Driver, or an unrelated provider selects another provider's truck\
When it attempts to start Tracking\
Then the command is denied\
And no Tracking session, customer grant, email delivery, or audit success is created.

### Scenario: one email code opens currently shared shipments

Given an account-free visitor enters their email on Track
When that exact normalized email has active shipment access
Then a six-digit OTP is queued to that email without requiring a shipment code
And an unknown, revoked or expired email receives the same outward response with no delivery or private information
And verifying a single-use ten-minute OTP opens the only shipment directly or a paginated list when multiple shipments are shared
And no profile or account is created; contacts, OTPs and digests stay out of URLs and logs
And resend supersedes prior pending challenges for the email, and five failed attempts lock the challenge.

### Scenario: access persists only while authorized and active

Given a verified Tracking visitor
When they refresh, reopen Track or move between currently shared shipments
Then they do not need another code before session expiry
And every list, detail, proof and review request checks current recipient access
And five minutes after verification ends access server-side
And reads, polling and background tabs cannot renew it
And deliberate foreground activity may refresh the signed expiry at most once per minute but cannot move the five-minute verification deadline
And Log out clears access and private UI; history restores revalidate
And legacy shipment-only cookies never acquire email-wide access.

### Scenario: an open active Tracking view refreshes without extending access

Given a verified owner, authorized staff member or status-only viewer is viewing
an active shipment on web or Expo\
When its saved status, route, events or permitted approximate location changes\
Then the foreground view checks for an update no more often than once per 60
seconds, preserves a manual refresh, and renders the recipient's current server
projection without resetting the map camera for an ordinary location update\
And a status-only viewer never receives the private vehicle marker or location.

Given the view is hidden, unfocused, backgrounded, completed, signed out or
past the absolute five-minute verified-email deadline\
When an automatic check would be due\
Then no check is sent and no session is renewed by the timer.

Given a refresh loses recipient authorization or returns 401\
When that denial is received\
Then the private marker and shipment content are cleared immediately and
verification is required again; an error never leaves a stale private marker.

Given an automatic check fails transiently or remains in progress\
When another tick occurs\
Then requests do not overlap, failed checks back off, and manual refresh
remains available. A 60-second interval would produce approximately 100
read requests per minute for 100 concurrently viewing people, before any
change-triggered page refresh; this is a sizing estimate, not a measured
production capacity claim.

### Scenario: provider controls multiple tracking parties

Given the owning provider or assigned Driver has an active Tracking session\
When an authorized provider actor adds or revokes a normalized recipient email\
Then PostgreSQL rechecks ownership, assignment, and Tracking permission before the mutation\
And duplicate active recipients are not created\
And the customer-owner recipient remains visibly distinct from additional tracking parties\
And revocation prevents the next OTP request and invalidates that recipient's next customer-safe read without affecting other recipients\
And no unrelated provider, Driver, administrator without the required operational authority, or public visitor can list or mutate the recipient list.

### Scenario: adding a Tracking party confirms the saved access before email delivery

Given an authorized provider adds an additional recipient on desktop or phone\
When the recipient and invitation outbox record commit\
Then the form confirms that access is saved and email is queued without waiting for SMTP or a page navigation\
And it prevents duplicate in-flight submissions, retains entered email on failure and clears busy feedback after a bounded wait\
And duplicate or denied additions show an inline error rather than an indefinite spinner\
And the invitation remains eligible for the existing recovery worker if the post-response delivery fails\
And the added email can request its own OTP using their email, receive the code, and open the authorized customer view without an account\
And an unrelated email cannot obtain that view, and revocation invalidates the recipient's existing guest access.

Verification: `tests/e2e/tracking-parties.spec.ts`, existing email-delivery and
managed Tracking permission tests. No SMTP configuration, role, schema or guest
authentication contract changes; the native POST fallback remains available.

### Scenario: customer-safe reads remain narrow in managed persistence

Given a valid short-lived browser grant was created from an authorized recipient's email OTP\
When the server requests the customer Tracking projection\
Then a service-role-only PostgreSQL projection rechecks the unrevoked, unexpired recipient on that exact shipment\
And returns only the public provider/truck summary, customer-safe Status events, and an eligible obscured travel location\
And never returns customer email, code digest, private proof path, delivery error, actor identity, or unrelated shipment data\
And a mismatched role, revoked grant, expired grant, or unknown shipment returns no row.

### Scenario: provider updates one governed timeline

Given the owning provider or assigned Driver operates a Tracking session\
When the one ordered Going to pickup, Loading, En route, Unloading, Complete, and Problem panel is displayed\
Then the domain permits only the next valid transition\
And invalid actions remain visible but disabled so the workflow order stays understandable\
And Loading, Unloading, and Problem may include optional private proof\
And En route and Complete do not request proof\
And customer-safe events appear only to currently authorized email-verified recipients.

### Scenario: location sharing requires explicit agreement and an assigned Driver

October 7 worldwide-location correction: consented, assigned-driver approximate
fixes accept finite latitude [-90,90] and longitude [-180,180], including zero.
On-device offsets wrap at the dateline; a distant catalog town is not used as the
overseas location label. Both status-attached and standalone location commands
retain their exact assignment, consent, travel-state, radius and ten-minute
cadence checks. Migration 115 updates only the two named location guards alongside
capacity constraints; retained history and private customer access remain intact.
Regression: tests/sql/worldwide-capacity-loads.sql exercises real US and zero fixes,
and foreign-driver denial; browser/native capture and readback remain required.

Given the provider and customer choose Status and approximate location when Tracking is started\
When the assigned Driver marks Going to pickup or En route and keeps the Tracking workspace open\
Then only that assigned Driver may send a browser-obscured coordinate\
And the Driver-selected approximate radius, general area, and update time are saved without storing the exact device coordinate\
And location refreshes are accepted no more frequently than every 10 minutes; a retry after failure still obeys the server cooldown\
And a fleet owner, unrelated Driver, status-only Tracking session, or invalid workflow state cannot publish a customer-visible location.

### Scenario: the customer sees location only during travel

Given a customer unlocks a Tracking session that explicitly permits Status and approximate location\
When the current status is Going to pickup or En route and the assigned Driver has supplied an approximate location\
Then a customer-safe map shows the approximate Driver area, its uncertainty radius, the pickup and destination, and the last update time\
And the map does not claim a precise road route or exact truck position\
And Loading, Unloading, Complete, Problem, status-only Tracking, or a missing Driver update returns no truck coordinate\
And leaving an eligible travel state immediately removes the location from the customer projection without deleting the provider-owned audit history.

### Scenario: a Driver opens Tracking from its dedicated workspace

Given a signed-in Driver has one or more incomplete Tracking sessions for its own provider or assigned truck\
When the Driver activates Tracking in workspace navigation\
Then the dedicated Tracking workspace shows only sessions that actor is authorized to operate\
And each session exposes the same ordered Going to pickup, Loading, En route, Unloading, Complete, and Problem controls used by Tracking detail\
And every transition, optional-proof rule, authorization check, and customer-safe event uses the governed Tracking command\
And Driver Home does not duplicate Tracking controls inside capacity management.

### Scenario: completion queues idempotent email

Given a Tracking session reaches Complete\
When the transition commits\
Then one completion delivery is queued to the customer owner using a stable idempotency key\
And the message contains the provider identity, shipment summary, ordered customer-safe timeline, and a link to review after email verification\
And the shared Tracking code cannot authorize review submission\
And a retry cannot create duplicate successful deliveries\
And email failure does not roll back the completed shipment.

Given immediate delivery fails or the request ends before a queued email is sent\
When the managed scheduled worker later leases the delivery\
Then it retries through the same idempotent provider request\
And a completion email includes the ordered customer-safe Status timeline without private proof paths, actor identities, or location coordinates.

### Scenario: completed guest access lasts 30 days

Given a shipment is Complete\
When fewer than 30 days have passed\
Then authorized recipient email access remains available for corrections, delivery retries, and disputes\
And when 30 days have passed recipient access, OTP challenges, and browser grants expire and guest-facing access is denied\
And the provider-owned authenticated history remains\
And retention cleanup records counts and identifiers without logging party emails or codes.

### Scenario: retention cleanup redacts guest data without deleting provider history

Given one or more completed Tracking sessions passed their 30-day guest expiry\
When the bounded managed cleanup command runs\
Then it deletes the expired customer grant and delivery-queue rows, clears the review-code digest, and replaces both compatibility email fields with non-routable redacted values\
And it preserves the provider shipment, assignment, ordered Status/location events, review, and authenticated provider history\
And its result contains only a bounded count and shipment identifiers, never customer emails or codes.

### Scenario: proof remains private

Given an optional operational proof exists\
When a provider, guest, or unrelated actor requests it\
Then the server reauthorizes that specific actor and shipment\
And public capacity or provider-profile visibility never grants file access.

Given a Loading, Unloading, or Problem status event has a saved proof image\
When an authorized provider, currently assigned permitted Driver, Operations-authorized team member, or verified unrevoked tracking recipient opens the timeline\
Then that event offers an Open proof action\
And the file endpoint repeats current shipment authorization and exact event-to-shipment membership before reading Storage\
And missing, expired, revoked, cross-shipment, or unrelated access returns no file\
And the response is private, non-cacheable, MIME constrained, and cannot execute active content\
And no Storage path is included in the timeline projection or link.

## Contract ownership

### Approval history survives guest retention

Given a shipment owner approved proof-backed unloading in a fresh verified session\
When the shipment's guest-access retention expires\
Then cleanup removes recipient contact/OTP/access data and denies old guest access\
And the completion event keeps a private OWNER approval marker even after its temporary recipient reference is cleared\
And shipment status, approval timestamp, loading/unloading proof references and provider history remain intact\
And an actorless event without an OWNER completion marker is still rejected.

Migration 129 changes only the event snapshot, temporary-recipient FK deletion
behavior and the existing completion command's snapshot insert. It does not alter
approval authority, proof obligations, the five-minute limit or public grants.
Verification: `tests/sql/tracking-owner-retention.sql` and the real local
`scripts/verify-supabase-provider-tracking.mjs` proof/approval/cleanup round trip.

- Public pages: `/track` and unlocked tracking view
- Provider controls: owned Tracking list, Tracking detail, and Driver action panel
- Outbound adapter: idempotent completion-email delivery
- Cleanup: scheduled 30-day guest-access expiry through the service-role-only managed command
- Persistence: `044_provider_tracking_runtime.sql`, `046_managed_email_operations.sql`, `062_tracking_recipient_email_otp.sql`, and the server-only provider Tracking adapter
- Tests: domain, repository, managed Tracking authorization, E2E

Audit repair evidence: `tests/tracking-proof-access.test.mjs`,
`tests/sql/tracking-proof-access.sql`, and
`tests/e2e/tracking-proof-audit.spec.ts` (desktop and phone).
Migration 083 adds functions only; deploy it before the proof-link application
artifact. Reverting that artifact hides the links without deleting proof events
or objects. Local proof access is verified; hosted rollout remains unverified.

## Foreground location controls (verified locally; rollout pending)

Given an assigned Driver uses Status and approximate location Tracking\
When they prepare a travel update or keep a travel screen open\
Then they can choose 1, 3, 5, 10, 20 or 40 km for the next obscured location\
And the selected radius is applied in the browser before coordinates leave it\
And the last saved radius and the pending selection are distinguished\
And a server-throttled or locally skipped refresh is described as waiting, never
as a newly saved coordinate\
And location denial, unavailable device and failed save show actionable errors.

Given a location acquisition or request is in progress\
When the screen becomes hidden, unmounts, changes Tracking session or leaves a
travel phase\
Then pending acquisition callbacks cannot start a new save\
And the browser aborts any in-flight fetch where possible\
And one screen never runs overlapping location/status acquisitions\
And a travel submission snapshots its selected status before acquiring location
and prevents editing its status/radius while it is in progress\
And an already received server update is not claimed to be reversible.

Given either the Driver or recipient reads location-sharing guidance\
When approximate Tracking is enabled\
Then the UI explains that updates need the Driver's visible open screen and pause
when the phone locks or the screen closes\
And no background GPS or uninterrupted live-tracking guarantee is made.

Contracts: browser-only single-flight foreground runner, existing allowed radius
set, unchanged actor-scoped location/status APIs and SQL cooldown. No new schema,
provider or permission. Rollback restores the previous UI without changing stored
events. Tests: `tests/tracking-location-controls.test.mjs` and
`tests/e2e/tracking-location-controls.spec.ts`; real local persistence and
desktop/phone controls passed. Final test/build counts, screenshot paths and
physical-device limitations are recorded in `docs/BUILD_VERIFICATION.md`.

## Governed recovery (F10/F04, implementation)

### Scenario: recovery controls offer only currently permitted actions

Given the server returns a Tracking recovery context with its allowed actions\
When a provider or Operations member opens the recovery controls\
Then only those correction, reassignment and cancellation forms are displayed\
And an Independent driver's one-truck account never receives a reassignment form\
And a provider whose agreed tracking requires staff release sees no cancellation form\
And an empty action list exposes no recovery controls\
And direct unauthorized commands remain denied by the existing service and database checks.

October14 local repair: the web component now honors each permitted action
separately, preserving the existing backend authority, shipment history and form
inputs. All five `tests/tracking-recovery-controls.test.mjs` component checks pass
(four failed before the repair), and both actual desktop/phone role cases pass in
`tests/e2e/tracking-recovery-permissions.spec.ts`.

The separate narrow administrative map repair passes all seven
`tests/admin-tracking-map-contract.test.mjs` checks. Both desktop/phone full
`tests/e2e/lifecycle-recovery.spec.ts` cases now pass fresh inbox OTP verification,
three saved cities and obscured radius, correction, reassignment/location reset,
retirement/restoration, denied provider cancellation, investigated cancellation,
retained history, guest revocation and exact fixture cleanup. Receipt:
`.local/internal-workflows-20261014/lifecycle-internal-repaired-runner.json`.
Earlier attempts remain recorded: subsequent diagnosis found stale old map
selectors and the old administrative projection shape passed into the new map;
it does not establish a cause for the original unclassified OTP-stage failure.
These are focused local results, not hosted rollout or full-release evidence.

Given an active owning provider or Operations-authorized team member opens a
nonterminal Tracking record\
When they submit a correction, reassignment or cancellation with a reason\
Then PostgreSQL locks and reauthorizes that exact record, requires its observed
revision, and appends private before/after recovery history and a safe timeline
entry without rewriting earlier events\
And Company drivers, unrelated providers and staff without Operations permission
cannot perform recovery even if they can send ordinary status updates.

Given correction is requested\
When cargo or expected dates are changed\
Then bounded fields and date order are validated\
And route corrections are permitted only before Loading (Created/Going to pickup)\
And provider ownership, recipients, code, tracking mode and completed events are
not editable through this command.

Given reassignment is requested\
When the replacement truck belongs to the same provider, is active and has an
active eligible Driver with Tracking permission\
Then current truck/Driver assignment changes atomically, old events remain,
and old Driver access ends on the next request\
And historical locations are retained but cannot appear as the replacement
Driver's location or impose that Driver's location cooldown\
And the authorized recipient list and stable Tracking code remain unchanged.

Given cancellation is confirmed\
When the nonterminal record is cancelled\
Then its terminal status is CANCELLED, pending guest access/OTP delivery becomes
ineligible, grants and recipients are revoked, and customer-facing file access ends\
And cancellation creates neither completion email nor review eligibility\
And provider/team history and proofs remain available to currently authorized
actors; completed and cancelled records cannot be corrected or reassigned.

Contracts: migration 090, service-only recovery command and history, required
optimistic revision/reason, location reset boundary, guarded vehicle retirement.
Cancellation is explicit and irreversible in this flow; UI requires confirmation.
No guest identity change, arbitrary status rewind or mode-consent bypass.
Deploy SQL before clients. Rollback hides recovery UI while retaining terminal
status, revocations and history; never undo cancellation or reissue access as an
automatic rollback. Required evidence: SQL state/permission/revision tests,
desktop/phone owner and Operations workflows, guest and replaced-Driver denial.

### Scenario: retained terminal Tracking is readable on narrow screens

Given a cancelled Tracking record with retained timeline and long recipient email\
When its owner opens the detail page on desktop or phone\
Then the page labels it cancelled without claiming delivery completion\
And no status or location input remains available\
And recipient text wraps within its card without horizontal document overflow.

Evidence: `tests/e2e/lifecycle-recovery.spec.ts` covers terminal copy, absent location
inputs, guest revocation, retained events and document width on both viewports.

2026-09-27 location audit: GIVEN a foreground GPS or network operation stalls, WHEN 45 seconds elapse, THEN stop the waiting state, abort the operation, tell the driver to refresh and check before retrying, and ignore late callbacks. Do not automatically retry a potentially committed status update. Evidence: focused runner tests and Tracking location browser workflow; physical-device background behavior is outside this evidence.

## Email-only access rollout (ADR-073)

Migration 114 precedes the application, preserves existing OTP/outbox cleanup and
legacy functions, and grants new helpers only to service_role. Roll back the app
before removing helpers; do not delete shipments, recipients or history. Pending
owner visual review and focused tests: `tests/sql/tracking-email-session.sql`,
`tests/tracking-session.test.mjs`, `tests/e2e/tracking-email-session.spec.ts`.

## Owner-approved handover and driver appeal — October 7

Given a provider starts a new shipment
When its main recipient and tracking mode are saved and access email is queued
Then the main recipient is the Shipment owner and the tracking mode cannot subsequently be changed
And Loading and Unloading require private photo proof; the provider cannot self-complete
And En route and Unloading require recorded loading proof so Issue recovery cannot skip that obligation.

Given the assigned driver records Unloading with photo proof
When the Shipment owner opens Tracking using their normal email code
Then they can approve unloading in that same session without another code
And only a currently authorized OWNER recipient with an email session no older than five minutes can approve
And additional viewers, revoked recipients, expired sessions and other shipments are denied
And approval locks the shipment, requires both proofs, records one audited completion and one idempotent completion email
And replay does not duplicate history or delivery and location updates stop after completion.

Given verified guest Tracking access on either client
When five minutes have elapsed since verification
Then all reads, proofs, reviews and approval require verification again
And activity/polling cannot extend the absolute deadline; private capacity retains its thirty-minute policy
And existing older Tracking cookies/tokens expire under this new limit.

Given an agreed location-tracked shipment is still active
When the assigned driver sends a new approximate fix from any valid world coordinate
Then the accepted privacy radii are 1, 3, 5, 10 or 20 km
And null, invalid and over-20-km fixes are rejected; existing wider history is retained
And the current location remains visible in all active stages, including waiting for unloading approval
And the web reports while open; installed background reporting requires OS permission and explicit device lifecycle checks
And loss of updates is visible; force-stop, permission removal, missing GPS and network failure cannot be overridden.

Given a driver is waiting for unloading approval
When they explain the problem and submit an appeal
Then one open appeal belongs to that shipment and existing proof/history remains available
And Operations-authorized staff can inspect it in the existing Tracking management resource
And a recorded investigation reason is mandatory before staff approve handover or release the disputed shipment
And staff dismissal retains active Tracking; a release closes it without falsely claiming customer approval
And unrelated staff, providers and guests cannot perform staff decisions.

Given a Driver has submitted an appeal through the existing shipment form\
When Operations-only staff save Approve handover, Release driver, or Keep tracking
active with an investigation note on desktop or phone\
Then that exact appeal records its decision, note, actor and resolution time\
And approval completes Tracking with staff approval and both retained proofs\
And release cancels Tracking and revokes guest rights without claiming owner approval\
And dismissal retains Unloading and its recipient rights\
And the existing proof events and unrelated shipments remain unchanged\
And a closed-decision replay, provider submission, or form submitted after
Operations permission is revoked saves no decision or success audit.

Focused acceptance: `tests/e2e/operations-connected-actions.spec.ts`. Synthetic
shipments use the real local commands and private Storage only to establish the
preconditions; Driver appeal intake and staff decisions use the actual visible
forms. Record actual browser results separately from SQL/source evidence.

October14 actual local evidence: both desktop/phone appeal cases pass all three
Driver intake forms and staff Approve/Release/Dismiss decisions, stored notes and
attribution, required retained proofs/history, completion versus release semantics,
recipient rights, replay/provider/revoked-form denial and unrelated-shipment
isolation. Each viewport removes exactly its six acknowledged proof objects,
three shipments and six synthetic identities with residual checks. Receipt:
`.local/operations-connected-actions-20261014/tracking-appeals-final-desktop-phone-runner.json`.

The single-proof diagnostic independently verifies equal source, acknowledged
Storage, authorized adapter, authenticated API and actual painted Blob bytes:
`.local/operations-connected-actions-20261014/proof-boundary-observed-desktop-runner.json`.
A cancelled development request can expose a zero-byte intermediate response to
the browser test; it is not the displayed image. The test now observes the actual
painted Blob and served bytes without changing native object-URL behavior or CSP.
Earlier failed receipts remain retained, including the diagnostic's unsupported
`fetch(blob:)` under the existing CSP and a wrapped-select exact-label locator.
No application, permission, schema or hosted change was made for these harness
corrections. Owner visual review and full release gates remain separate.

Overdue new-work restriction: ETA + two days is proposed; scope is awaiting the owner's
answer. Do not disable existing login, Tracking or appeals or invent ETAs for legacy
shipments. Native background device authority needs a separate bounded capability
contract and ADR before implementation; no full account token in a background worker.

Rollout: additive migration 117; local role/transition/proof/replay tests and actual
web/native interaction checks first. Explicit local visual review before release gates.
Retain event history and recipient rights; no production apply or broad settings sync.

Driver handover updates follow FEAT-NOT-001: an actual saved owner/team approval
can alert the currently authorized assigned driver on web and mobile and reopen
the completed Tracking record. Approval already completes Tracking; there is no
second driver completion action. Viewing or dismissing the alert changes only its
private acknowledgement and never approval, proof, location or chat read state.

### October13 rollout compatibility: installed two-city clients

Given an authenticated installed client that cannot send a passing-city field
When it attempts a new shipment after the three-city contract is released
Then deny that incomplete creation before a database write and explain that it
needs the updated app or the web shipment form
And preserve existing shipment reads, status updates, authorized proofs, email
access and saved legacy two-city histories
And do not invent a passing city, silently broaden authorization or claim a
successful creation. Deploy the new web/API and Android compatibility together;
Featured137 does not depend on this client change.

### October13 error recovery after the map-first layout

Given an authorized visitor loading or refreshing a shipment
When the response is unavailable or malformed and cannot produce authorized
shipment data
Then show the bounded error and an accessible Refresh updates action outside
any conditional data/map panel so the visitor can try again
And a successful retry restores the route and progress through the normal API
And expired or revoked access still clears private data and returns to the normal
verification boundary; recovery never extends or bypasses the five-minute grant.

Regression: `tests/e2e/mobile-runtime-recovery.spec.ts` reproduced the missing
retry control after the new map-first layout; owner review/release must wait for
both phone and desktop recovery cases to pass.
