---
id: FEAT-VER-001
title: Entity and truck verification
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-CAP-001]
problem: Public capacity seekers need visible, evidence-based trust signals for providers, Drivers, and truck authority without treating account access or a badge as a guarantee.
behavior: Authorized providers submit private verification documents for an owned organization, Driver, or Driver-truck pairing. Administrators review each request and expiry. Public Capacity Board cards and provider microsites derive vivid category-specific badges only from current approvals and always tell visitors to perform their own checks.
contracts: [VerificationSubject, VerificationTypePolicy, VerificationSubmission, VerificationReview, VerificationExpiry, DriverTruckAuthorization, VerificationBadgeSummary, VerificationBadgeMeaning, VerificationRiskNotice, VerificationFileAuthorization]
observability: [verification_submitted_audit, verification_reviewed_audit, verification_denied_outcome]
rollout: Document names remain extensible; keep files private, seed only explicit demo approvals, and roll back by hiding badges and disabling submissions without deleting review history.
---

# Verification

### Scenario: verification history remains bounded

Given a workspace or administrator has many verification requests\
When request history or the review queue changes page\
Then only one bounded server page is rendered\
And every matching request remains reachable without exposing private documents to another workspace.

### Scenario: owner submits supported evidence

Given an authenticated fleet transporter or self-managed Driver\
When they choose an owned profile or Driver-truck pairing, a supported verification type, and a valid private document\
Then one Pending verification request is created\
And only the owner and an administrator may read its metadata.

### Scenario: independent truck evidence follows operating model

Given an independent provider signed up as an Owner-operator\
When the provider opens Verification after adding a truck\
Then that truck offers Truck ownership evidence\
And Truck authorization is not presented as the Owner-operator&apos;s required truck document.

Given an independent provider signed up as a Self-managed driver\
When the provider opens Verification after adding a truck\
Then the Driver-truck pairing offers expiring Truck authorization evidence\
And Truck ownership is not presented as the Self-managed driver&apos;s required truck document.

Given a Driver belongs to a fleet transporter\
When account or verification identity is shown\
Then the role is Company driver and the employing fleet name remains visible.

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
Then the category badge is neutral gray and states Not verified.

Given an administrator approves the category\
When a visitor opens the public Capacity Board, provider microsite, or public truck detail\
Then that category badge uses a vivid, high-contrast category treatment designed to draw attention and states Verified\
And identity, license, address, Driver, truck, and reputation categories use distinct bright colors such as blue, orange, green, violet, cyan, and gold\
And color is paired with an icon and visible text rather than carrying meaning alone\
And its details explain the reviewed category, subject, status, review date, and expiry when applicable\
And no member-facing badge opens the submitted private document.

### Scenario: expired evidence is not current verification

Given an approved verification request has an expiry date\
When that date has passed in Ethiopia\
Then its marketplace badge states Expired and is not counted as Verified\
And the owner may submit replacement evidence without deleting review history.

### Scenario: truck authorization belongs to one Driver and truck

Given a company Driver or self-managed Driver submits proof of authority for a truck\
When the request is created\
Then it identifies that Driver, that owned or assigned truck, and a required expiry date\
And approval produces Truck authorization only for that pairing\
And reassignment or expiry cannot verify a different Driver-truck pairing.

### Scenario: public capacity cards explain provider trust

Given a visitor opens the public Capacity Board\
When a truck belongs to a fleet or self-managed driver\
Then the card separately shows owner or company evidence, truck authority evidence, and the assigned driver's approved driver-license evidence where an assignment exists\
And the truck detail identifies only the Driver's first name, operating-model label, and public callback phone\
And every required Driver and truck category remains visible as Verified, Not verified, or Expired\
And a self-managed owner-operator receives the relevant combined owner and driver evidence without duplicate claims.

### Scenario: verification does not gate account access

Given a newly signed-up provider workspace has no approved verification requests\
When its trial or paid access is current\
Then its authorized user can use the provider workspace and publish capacity\
And gray Not verified badges encourage evidence submission without blocking access.

### Scenario: public marketplace trust warning remains visible

Given an anonymous visitor opens a public transporter microsite, Truck Market card, or selected-truck detail\
When trust evidence is displayed\
Then a concise notice tells the visitor to confirm current identity, authority, truck, Driver, and documents before agreeing\
And explains that badges describe reviewed evidence rather than guaranteeing payment, performance, cargo safety, or continuing legal authority\
And authenticated Home, capacity management, Tracking, Support, Account, verification-management, and administration pages do not repeat that marketplace warning.

### Scenario: verification document remains private

Given a verification request has a stored document\
When an unrelated authenticated user or anonymous visitor requests the file\
Then access is denied\
And only the submitting owner or an administrator can read it.

## Supported categories

- Fleet transporter organization: National ID, Business license, and Business address
- Owner-operator: National ID, Driver license, and Truck ownership for each owned truck
- Self-managed driver: National ID, Driver license, and pairing-specific Truck authorization
- Company driver: National ID, Driver license, and pairing-specific Truck authorization under the named fleet transporter
- Truck: Truck ownership for an Owner-operator; historical Vehicle ownership or Owner authorization names remain inert record values only

The catalog may add country- or actor-specific document names in a later accepted update without changing approved historical records.

## Contract ownership

- Pages: `/app/verification`, `/admin/verifications`, public Capacity Board, provider microsites, and truck rosters
- Application services: verification functions in `src/lib/repository.js`
- Private file adapter: `/api/files/verification/[id]`
- Tests: `tests/repository.test.mjs`, `tests/authorization.test.mjs`, `tests/e2e/smoke.spec.ts`
