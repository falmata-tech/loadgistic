---
id: FEAT-TRK-001
title: Tracking and proof
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001]
problem: Shipment parties need enforceable, understandable tracking and controlled operational evidence without exposing precise movement or private files.
behavior: A newly posted Shipment starts with the low-friction Status timeline. After agreement and before truck assignment, its Business owner may retain that mode or require Automatic location + status; the assigned Driver's device publishes obscured location while the shipment screen is open, status actions remain one ordered workflow, and only a Business party may reduce the mode to status-only. Shipper and receiver parties, including an external party, may unlock customer-safe tracking with the secret code and inactivity expiry; assigned providers use their shipment timeline instead of a separate internal-notes channel.
contracts: [TrackingMode, TrackingObligation, TrackingAccessCode, BrowserTrackingGrant, TrackingIdleTimeout, CustomerSafeTrackingView, LoadTypeTrackingPrecision, ObscuredTrackingLocation, ProofFilePort, ProofAuthorizationPolicy, TemporaryLoadProofGrant]
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

### Scenario: posting defaults to the simple tracking obligation

Given a Business creates a freight Shipment\
When it posts the Shipment\
Then Status timeline is stored without asking for a tracking decision in the posting form\
And tracking proof is not implied.

### Scenario: Business chooses stronger tracking after agreement

Given a freight Shipment is Agreed and has not been assigned to a truck\
When its owning Business retains Status timeline or chooses Automatic location + status\
Then that mode is stored and shown to the assigned provider\
And the provider cannot assign the truck in the same request as an unreviewed mode change\
And tracking proof remains separate from either mode.

### Scenario: assigned Driver supplies automatic location tracking

Given an assigned load requires Automatic location + status\
When its assigned Driver keeps the shipment screen open and grants device-location permission\
Then the browser publishes a throttled location event without a separate save button\
And an FTL device coordinate is obscured to a 20 km privacy zone before submission\
And a PTL device coordinate is obscured to a 40 km privacy zone before submission\
And the precise coordinate is never submitted, stored, logged, or displayed\
And a fleet owner, administrator, or unassigned Driver cannot publish a manual substitute location.

### Scenario: assigned Driver can retry automatic location

Given automatic location is required and the assigned Driver denied, missed, or did not receive the first browser location result\
When the Driver opens the shipment action panel\
Then a visible Retry location action requests geolocation again\
And status actions remain independent from location success\
And the screen never offers a manual current-area substitute.

### Scenario: status-only tracking has no location workflow

Given a freight load uses Status timeline\
When an assigned provider opens its shipment\
Then no location field, manual-location action, permission prompt, or location-save button is displayed\
And the timeline contains only governed shipment actions and any historical events.

### Scenario: tracking uses one ordered action panel

Given an assigned provider may advance or report a shipment\
When the tracking control is displayed\
Then Loading, En route, Unloading, Complete, and Problem remain visible together in that order\
And only actions allowed by the current shipment state are selectable\
And while a shipment is En route both Unloading and Problem are selectable\
And after Unloading only Complete is selectable and Problem is disabled\
And the service still records the corresponding governed shipment status\
And Loading, En route, Unloading, and Problem offer one optional proof file in the same form\
And Complete does not ask for proof\
And omitting proof never blocks an otherwise valid update\
And an attached proof is privately authorized against the same shipment and action\
And no second More shipment actions or location-update control is shown.

### Scenario: only a Business may reduce tracking after assignment

Given an assigned load requires Automatic location + status\
When the shipper or receiver Business changes it to Status timeline\
Then the assigned Driver's screen stops publishing location events\
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

- Inbound adapters: tracking page and shipment proof/file handlers
- Application services: `setTrackingMode`, `addTrackingUpdate`, `transitionShipment`, `unlockBusinessTracking`, `getBusinessTracking`, `addProof`, `getProofFile`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
