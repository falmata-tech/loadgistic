---
id: FEAT-TRK-001
title: Tracking, proof, and shipment notes
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001]
problem: Shipment parties need enforceable, understandable tracking and controlled operational evidence without exposing precise movement or private files.
behavior: A Business chooses Status timeline or Approximate location + status for a load; after assignment the provider must satisfy that mode on operational updates, while only a Business party may reduce it to status-only. Shipper and receiver parties, including an external party, may unlock customer-safe tracking with the secret code and inactivity expiry; assigned providers use their internal shipment timeline instead.
contracts: [TrackingMode, TrackingObligation, TrackingAccessCode, BrowserTrackingGrant, TrackingIdleTimeout, CustomerSafeTrackingView, LoadTypeTrackingPrecision, ObscuredTrackingLocation, ProofFilePort, ProofAuthorizationPolicy, TemporaryLoadProofGrant, ShipmentNote]
observability: [tracking_mode_audit, tracking_update, tracking_location_source, tracking_unlock_success, tracking_unlock_denial, tracking_idle_expiry, proof_audit, load_proof_request, load_proof_share, load_proof_expiry, file_access_denial]
rollout: Require private storage, MIME and size validation, malware scanning, and access-denial monitoring before production.
---

# Tracking and proof

### Scenario: authorized proof access

Given an authenticated user is authorized for a shipment\
When they request a proof file linked to it\
Then the server rechecks shipment authorization and streams the private file.

### Scenario: unauthorized proof access

Given a user lacks access to the proof shipment\
When the proof URL is requested\
Then no file metadata or bytes are disclosed.

### Scenario: browse visibility does not grant proof permission

Given a provider can browse an Open or Partners load but is not assigned to it\
When the provider attempts to upload or download shipment proof\
Then the service returns no protected record\
And no proof row, bytes, or success audit is created.

### Scenario: an interested provider requests load proof

Given a provider has expressed interest in a visible freight load\
When that same provider requests proof of load size or quantity\
Then the request is attached to that provider's interest\
And other interested providers cannot see or fulfill the request.

### Scenario: a Business shares temporary load proof with one interest

Given a Business owns a freight load with interested providers\
When the Business selects one interest and uploads load-size proof\
Then only that selected provider and the owning Business can open the file\
And the grant expires after the configured temporary access window\
And assignment to a different provider or a terminal load state revokes recipient access.

### Scenario: temporary proof access is reauthorized

Given a temporary load-proof link exists\
When an unrelated provider, an expired recipient, or an anonymous visitor opens it\
Then no file metadata or bytes are disclosed.

### Scenario: Business chooses the tracking obligation

Given a Business creates a freight load\
When it chooses Status timeline or Approximate location + status\
Then that mode is stored on the load and shown to the assigned provider\
And tracking proof is not implied by either mode.

### Scenario: assigned provider must follow location tracking

Given an assigned load requires Approximate location + status\
When the provider records assignment, movement, hold, issue, or delivery\
Then a fresh general-area location is required with the event\
And an FTL device coordinate is obscured to a 20 km privacy zone before submission\
And a PTL device coordinate is obscured to a 40 km privacy zone before submission\
And the precise coordinate is never submitted, stored, logged, or displayed.

### Scenario: assigned provider sends an in-between tracking update

Given a freight load is assigned and not terminal\
When its assigned provider sends a tracking update\
Then a real timestamped event is added without inventing a status transition\
And location is required for Approximate location + status\
And a note is required for Status timeline.

### Scenario: manual tracking uses four clear field actions

Given an assigned provider may advance or report a shipment\
When the manual tracking control is displayed\
Then operational choices use the plain labels Loading, En route, Unloading, and Problem where each action is valid\
And the service still records the corresponding governed shipment status\
And each action offers one optional proof file beside its note\
And omitting proof never blocks an otherwise valid update\
And an attached proof is privately authorized against the same shipment and action.

### Scenario: only a Business may reduce tracking

Given an assigned load requires Approximate location + status\
When the shipper or receiver Business changes it to Status timeline\
Then future provider events no longer require location\
And the mode change is recorded as a public tracking event\
And the provider cannot make that change.

### Scenario: shipment party unlocks customer tracking

Given a shipper or receiver is involved in a load, whether or not it has a Loadgistic account\
When that party submits the load's secret tracking code\
Then a short-lived tracking grant is bound to that browser and load\
And the tracking page returns only shipment summary and explicitly customer-safe timestamped events\
And location events show only the declared general area and privacy radius\
And the secret code is never placed in a URL or stored in clear text.

### Scenario: provider does not use customer tracking

Given a signed-in assigned transporter or driver\
When it follows a load\
Then the app directs it to the Tracking category inside My Shipments\
And customer tracking does not grant provider-only notes, proof, or actions.

### Scenario: tracking view expires after inactivity

Given a Business party has unlocked a customer tracking view\
When the page receives no user activity for five minutes\
Then the browser clears the tracking grant and returns to the code entry screen\
And grant renewal is accepted only while the existing browser-and-load grant remains valid\
And a later tracking read requires the secret code again.

## Contract ownership

- Inbound adapters: tracking page and shipment proof/note/file handlers
- Application services: `setTrackingMode`, `addTrackingUpdate`, `transitionShipment`, `unlockBusinessTracking`, `getBusinessTracking`, `addProof`, `getProofFile`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
