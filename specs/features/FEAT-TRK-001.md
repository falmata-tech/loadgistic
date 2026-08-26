---
id: FEAT-TRK-001
title: Customer-owner tracking, completion email and retention
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-REV-001, FEAT-GEO-001]
problem: The customer who owns an agreed shipment needs one simple tracking handoff and a durable emailed record without creating a Loadgistic account.
behavior: A provider starts one Tracking session after agreeing work offline, issues one stable customer-owner code and Track link, emails both to that owner, exposes a customer-safe timeline after code entry, emails one idempotent completion summary, expires guest access 30 days after completion, and retains the provider-owned history.
contracts: [CustomerTrackingCode, TrackingCodeDigest, BrowserTrackingGrant, CustomerSafeTrackingView, TrackingLocationConsent, TrackingLocationSnapshot, TrackingIdleTimeout, TrackingAccessEmailPort, CompletionEmailPort, EmailDelivery, GuestRetentionPolicy, ProofFilePort, ManagedTrackingRepository]
observability: [tracking_access_queued, tracking_unlock_success, tracking_unlock_denial, tracking_idle_expiry, tracking_location_saved, tracking_location_denied, completion_email_queued, completion_email_sent, completion_email_failed, completion_email_retry, guest_access_expired]
rollout: Reuse the stable keyed-code contract, keep only its digest in persistence, preserve legacy provider-tracking rows during compatibility, send one owner delivery with bounded retries, and keep guest access disabled in production until sender configuration, private storage, scanning, retention cleanup and monitoring are verified.
---

# Guest tracking

### Scenario: one stable owner code and link are issued

Given a provider owner, self-managed Driver, or company Driver assigned to the selected truck starts Tracking with one customer-owner email\
When tracking access is generated\
Then one stable high-entropy code and the public Track link are shown to the provider\
And the same code remains retrievable by the owning provider while guest access remains active\
And only its keyed digest is stored\
And one idempotent access email containing the link and code is queued to the customer owner\
And the owner may share that link and code with a shipper, receiver, or other person it trusts.

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

### Scenario: guest unlock is private and temporary

Given any person trusted by the customer owner enters the owner code on the public Track page\
When the digest matches an unexpired party grant\
Then a short-lived browser grant returns only the customer-safe tracking summary and public timeline events\
And the code is not placed in the URL, logs, analytics, or clear-text storage\
And inactivity clears the browser grant\
And an invalid, expired, or rate-limited code reveals no Tracking session.

### Scenario: customer-safe reads remain narrow in managed persistence

Given a valid short-lived browser grant was created from an owner-code digest\
When the server requests the customer Tracking projection\
Then a service-role-only PostgreSQL projection rechecks the unrevoked, unexpired shipment grant\
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
And location updates are accepted no more frequently than every 10 minutes unless the Driver explicitly retries after a failure\
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
And when 30 days have passed the code and browser grants expire and guest-facing access is denied\
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

## Contract ownership

- Public pages: `/track` and unlocked tracking view
- Provider controls: owned Tracking list, Tracking detail, and Driver action panel
- Outbound adapter: idempotent completion-email delivery
- Cleanup: scheduled 30-day guest-access expiry through the service-role-only managed command
- Persistence: `044_provider_tracking_runtime.sql`, `046_managed_email_operations.sql`, and the server-only provider Tracking adapter
- Tests: domain, repository, managed Tracking authorization, E2E
