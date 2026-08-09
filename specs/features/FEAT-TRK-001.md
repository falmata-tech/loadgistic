---
id: FEAT-TRK-001
title: Customer-owner tracking, completion email and retention
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-REV-001]
problem: The customer who owns an agreed shipment needs one simple tracking handoff and a durable emailed record without creating a Loadgistic account.
behavior: A provider starts one Tracking session after agreeing work offline, issues one stable customer-owner code and Track link, emails both to that owner, exposes a customer-safe timeline after code entry, emails one idempotent completion summary, expires guest access 30 days after completion, and retains the provider-owned history.
contracts: [CustomerTrackingCode, TrackingCodeDigest, BrowserTrackingGrant, CustomerSafeTrackingView, TrackingIdleTimeout, TrackingAccessEmailPort, CompletionEmailPort, EmailDelivery, GuestRetentionPolicy, ProofFilePort]
observability: [tracking_access_queued, tracking_unlock_success, tracking_unlock_denial, tracking_idle_expiry, completion_email_queued, completion_email_sent, completion_email_failed, completion_email_retry, guest_access_expired]
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

### Scenario: provider updates one governed timeline

Given the owning provider or assigned Driver operates a Tracking session\
When the one ordered Loading, En route, Unloading, Complete, and Problem panel is displayed\
Then the domain permits only the next valid transition\
And invalid actions remain visible but disabled so the workflow order stays understandable\
And Loading, Unloading, and Problem may include optional private proof\
And En route and Complete do not request proof\
And customer-safe events appear to every holder of the owner code.

### Scenario: completion queues idempotent email

Given a Tracking session reaches Complete\
When the transition commits\
Then one completion delivery is queued to the customer owner using a stable idempotency key\
And the message contains the provider identity, shipment summary, ordered customer-safe timeline, and a separate shipment-bound review code\
And the shared Tracking code cannot authorize review submission\
And a retry cannot create duplicate successful deliveries\
And email failure does not roll back the completed shipment.

### Scenario: completed guest access lasts 30 days

Given a shipment is Complete\
When fewer than 30 days have passed\
Then the owner code remains available for corrections, delivery retries, and disputes\
And when 30 days have passed the code and browser grants expire and guest-facing access is denied\
And the provider-owned authenticated history remains\
And retention cleanup records counts and identifiers without logging party emails or codes.

### Scenario: proof remains private

Given an optional operational proof exists\
When a provider, guest, or unrelated actor requests it\
Then the server reauthorizes that specific actor and shipment\
And public capacity or provider-profile visibility never grants file access.

## Contract ownership

- Public pages: `/track` and unlocked tracking view
- Provider controls: owned Tracking detail and Driver action panel
- Outbound adapter: idempotent completion-email delivery
- Cleanup: scheduled 30-day guest-access expiry
- Tests: domain, repository, authorization, E2E
