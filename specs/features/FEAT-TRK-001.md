---
id: FEAT-TRK-001
title: Tracking, proof, and shipment notes
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001]
problem: Shipment parties need controlled operational evidence and optional safe tracking without exposing private files.
behavior: Authorized shipment actors add notes and proof; public tracking uses opaque tokens and exposes only public events; proof download reauthorizes every request.
contracts: [TrackingToken, PublicTrackingView, ProofFilePort, ProofAuthorizationPolicy, ShipmentNote]
observability: [proof_audit, tracking_request, file_access_denial]
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

### Scenario: public tracking

Given tracking is enabled with an opaque token\
When the token page is opened\
Then only shipment summary and explicitly public events are returned.

## Contract ownership

- Inbound adapters: tracking page and shipment proof/note/file handlers
- Application services: `addProof`, `getProofFile`, `getTrackingByToken`
- Tests: `tests/repository.test.mjs`
