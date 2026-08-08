---
id: FEAT-TRK-001
title: Guest-code tracking, completion email and retention
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-REV-001]
problem: External shipper and receiver parties need private tracking and a durable emailed completion record without creating Loadgistic accounts.
behavior: A provider-owned shipment issues separate high-entropy shipper and receiver codes, exposes customer-safe tracking after code entry, emails each party an idempotent completion summary, expires guest access 30 days after completion, and retains the provider-owned history.
contracts: [PartyTrackingCode, TrackingCodeDigest, BrowserTrackingGrant, CustomerSafeTrackingView, TrackingIdleTimeout, CompletionEmailPort, CompletionEmailDelivery, GuestRetentionPolicy, ProofFilePort]
observability: [tracking_unlock_success, tracking_unlock_denial, tracking_idle_expiry, completion_email_queued, completion_email_sent, completion_email_failed, completion_email_retry, guest_access_expired]
rollout: Store only code digests, add delivery idempotency and retry state, require an email adapter with bounded failure behavior, and keep guest access disabled in production until sender configuration, private storage, scanning, retention cleanup and monitoring are verified.
---

# Guest tracking

### Scenario: separate party codes are issued

Given an authorized provider creates a shipment with shipper and receiver emails\
When tracking access is generated\
Then one independent high-entropy code is created for each party\
And only digests are stored\
And a code is shown or delivered only to its intended party\
And rotating one code does not rotate the other.

### Scenario: guest unlock is private and temporary

Given a shipper or receiver enters its code on the public Track page\
When the digest matches an unexpired party grant\
Then a short-lived browser grant returns only customer-safe shipment summary and public timeline events\
And the code is not placed in the URL, logs, analytics, or clear-text storage\
And inactivity clears the browser grant\
And an invalid, expired, rate-limited, or other-party code reveals no shipment.

### Scenario: provider updates one governed timeline

Given the owning provider or assigned Driver operates a shipment\
When Loading, En route, Unloading, Complete, or Problem is selected\
Then the domain permits only the next valid transition\
And Loading, Unloading, and Problem may include optional private proof\
And En route and Complete do not request proof\
And customer-safe events appear to both guest parties.

### Scenario: completion queues idempotent email

Given a shipment reaches Complete\
When the transition commits\
Then one completion delivery is queued for the shipper and one for the receiver using stable idempotency keys\
And each message contains the provider identity, shipment summary, assignments appropriate for the party, and ordered customer-safe timeline\
And the shipper message includes a shipment-bound review action while the receiver message does not grant review authority\
And a retry cannot create duplicate successful deliveries\
And email failure does not roll back the completed shipment.

### Scenario: completed guest access lasts 30 days

Given a shipment is Complete\
When fewer than 30 days have passed\
Then valid party codes remain available for corrections, delivery retries, and disputes\
And when 30 days have passed the codes and browser grants expire and guest-facing access is denied\
And the provider-owned authenticated history remains\
And retention cleanup records counts and identifiers without logging party emails or codes.

### Scenario: proof remains private

Given an optional operational proof exists\
When a provider, guest, or unrelated actor requests it\
Then the server reauthorizes that specific actor and shipment\
And public capacity or provider-profile visibility never grants file access.

## Contract ownership

- Public pages: `/track` and unlocked tracking view
- Provider controls: owned shipment detail and Driver action panel
- Outbound adapter: idempotent completion-email delivery
- Cleanup: scheduled 30-day guest-access expiry
- Tests: domain, repository, authorization, E2E
