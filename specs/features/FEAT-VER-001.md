---
id: FEAT-VER-001
title: Entity and truck verification
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-CAP-001]
problem: Marketplace participants need visible, evidence-based trust signals for people, Businesses, transporters, drivers, and trucks without treating a workspace approval as document verification.
behavior: Authorized users submit private verification documents for an owned entity, administrators review each request, and profile or truck badges are derived only from approved requests.
contracts: [VerificationSubject, VerificationTypePolicy, VerificationSubmission, VerificationReview, VerificationBadgeSummary, VerificationFileAuthorization]
observability: [verification_submitted_audit, verification_reviewed_audit, verification_denied_outcome]
rollout: Document names remain extensible; keep files private, seed only explicit demo approvals, and roll back by hiding badges and disabling submissions without deleting review history.
---

# Verification

### Scenario: owner submits supported evidence

Given an authenticated Business, fleet transporter, or self-managed driver\
When they choose an owned profile or truck, a supported verification type, and a valid private document\
Then one Pending verification request is created\
And only the owner and an administrator may read its metadata.

### Scenario: subject and type must match

Given a user selects a verification type that does not apply to the selected subject or selects an entity they do not own\
When the request is submitted\
Then it is rejected\
And no file-backed verification request is created.

### Scenario: administrator reviews a request

Given a Pending or More information verification request\
When an administrator approves, rejects, or requests more information with an optional note\
Then the decision, reviewer, and timestamp are recorded\
And the audit log identifies the request and outcome.

### Scenario: non-admin review is denied

Given a non-administrator\
When they attempt to review any verification request\
Then the command is denied\
And the request and badge state remain unchanged.

### Scenario: badge derives from approval

Given an entity has a required verification category\
When no approved request exists\
Then the category badge is gray and states Not verified.

Given an administrator approves the category\
When an authenticated user opens the directory profile or truck roster\
Then that category badge is blue and states Verified.

### Scenario: verification document remains private

Given a verification request has a stored document\
When an unrelated authenticated user or anonymous visitor requests the file\
Then access is denied\
And only the submitting owner or an administrator can read it.

## Supported initial categories

- Business organization: Identity and Business license
- Fleet transporter organization: Identity and Business license
- Self-managed driver: Identity and Driver identity
- Fleet driver: Driver identity
- Truck: Vehicle ownership or Owner authorization

The catalog may add country- or actor-specific document names in a later accepted update without changing approved historical records.

## Contract ownership

- Pages: `/app/verification`, `/admin/verifications`, Public Profiles, truck rosters
- Application services: verification functions in `src/lib/repository.js`
- Private file adapter: `/api/files/verification/[id]`
- Tests: `tests/repository.test.mjs`, `tests/authorization.test.mjs`, `tests/e2e/smoke.spec.ts`
