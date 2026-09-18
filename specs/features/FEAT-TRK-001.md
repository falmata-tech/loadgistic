---
id: FEAT-TRK-001
title: Authorized-party tracking, email verification and retention
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-REV-001, FEAT-GEO-001]
problem: Every party explicitly authorized for an agreed shipment needs a simple, private tracking handoff without creating a Loadgistic account or relying on a reusable code alone.
behavior: A provider starts one Tracking session after agreeing work offline, assigns one stable shipment Tracking code, authorizes one owner plus any number of additional recipient emails, and exposes the customer-safe timeline only after an exact authorized email and Tracking-code match is confirmed with a short-lived email OTP. The provider can add or revoke recipients, one idempotent completion summary reaches the owner, guest access expires 30 days after completion, and the provider retains its operational history.
contracts: [CustomerTrackingCode, TrackingCodeSecret, TrackingCodeDigest, TrackingRecipient, TrackingEmailOtp, BrowserTrackingGrant, CustomerSafeTrackingView, TrackingLocationConsent, TrackingLocationSnapshot, TrackingIdleTimeout, TrackingAccessEmailPort, CompletionEmailPort, EmailDelivery, GuestRetentionPolicy, ProofFilePort, ManagedTrackingRepository]
observability: [tracking_recipient_added, tracking_recipient_revoked, tracking_otp_requested, tracking_otp_verified, tracking_unlock_success, tracking_unlock_denial, tracking_idle_expiry, tracking_location_saved, tracking_location_denied, completion_email_queued, completion_email_sent, completion_email_failed, completion_email_retry, guest_access_expired]
rollout: Require one server-only Tracking code secret before Production creates its first Tracking row, keep only keyed digests in persistence, and send one owner delivery with bounded retries. The empty hosted project may cut over without a data migration; a later Tracking-secret rotation requires an explicit code-reissue migration or a compatibility key window. Keep guest access disabled in production until sender configuration, private storage, scanning, retention cleanup and monitoring are verified.
---

# Guest tracking

### Scenario: one stable shipment code and authorized recipient list are issued

Given a provider owner, self-managed Driver, or company Driver assigned to the selected truck starts Tracking with one customer-owner email and zero or more additional recipient emails\
When tracking access is generated\
Then one stable high-entropy code and the public Track link are shown to the provider\
And the same shipment code remains retrievable by the owning provider while guest access remains active\
And the owner code contains 80 deterministic bits formatted as four readable four-character groups after `LG-`\
And the separate review code uses the same entropy in an `LG-RV-` format and a distinct derivation context\
And code generation and code digests use only the dedicated server-side Tracking code secret, so rotating the login-session secret does not change either code or its persisted digest\
And a browser grant invalidated by session-secret rotation can be reopened with the unchanged owner code\
And only its keyed digest is stored\
And one recipient record belongs to the customer owner while every distinct normalized additional email receives its own revocable recipient record\
And the provider can inspect, add, or revoke recipients without changing the shipment code or another recipient\
And one idempotent application email containing the link and shipment code is queued to each initial recipient through the managed application-email port rather than a Supabase Auth template\
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
And success replaces the form with the durable Tracking reference, owner code, Track link, and Open Tracking action\
And a validation, authorization, or delivery-preparation failure leaves the entered form available and displays a visible error beside the action\
And the public Track form redirects a valid code to its authorized Tracking view while an invalid code returns a visible error instead of appearing inactive.

### Scenario: an unassigned actor cannot start Tracking

Given a company Driver selects a truck not currently assigned to that Driver, or an unrelated provider selects another provider's truck\
When it attempts to start Tracking\
Then the command is denied\
And no Tracking session, customer grant, email delivery, or audit success is created.

### Scenario: authorized email and Tracking code request a one-time code

Given an account-free visitor enters an exact authorized email and the shipment Tracking code on the public Track page\
When both digests match the same active Tracking session and recipient\
Then a cryptographically generated six-digit application OTP is queued only to that normalized email\
And the visitor submits the OTP on the same compact form before receiving a five-minute browser grant bound to that shipment and recipient digest\
And the authorized customer-safe Tracking view opens without creating a Loadgistic Auth identity, profile, or dashboard\
And the Tracking code, email, OTP, and digests are absent from the URL, logs, analytics, and clear-text credential storage\
And an unknown or revoked email, wrong Tracking code, invalid or expired OTP, or rate limit returns the same bounded outward response and reveals no Tracking session\
And an ineligible request creates no OTP or delivery row and sends no email\
And a valid OTP expires after ten minutes, is single-use, is superseded by the next eligible request, and allows no more than five failed attempts.

### Scenario: provider controls multiple tracking parties

Given the owning provider or assigned Driver has an active Tracking session\
When an authorized provider actor adds or revokes a normalized recipient email\
Then PostgreSQL rechecks ownership, assignment, and Tracking permission before the mutation\
And duplicate active recipients are not created\
And the customer-owner recipient remains visibly distinct from additional tracking parties\
And revocation prevents the next OTP request and invalidates that recipient's next customer-safe read without affecting other recipients\
And no unrelated provider, Driver, administrator without the required operational authority, or public visitor can list or mutate the recipient list.

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
And customer-safe events appear to every holder of the owner code.

### Scenario: location sharing requires explicit agreement and an assigned Driver

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
And the message contains the provider identity, shipment summary, ordered customer-safe timeline, and a separate shipment-bound review code\
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
Then the owner code remains available for corrections, delivery retries, and disputes\
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
