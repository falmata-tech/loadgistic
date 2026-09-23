---
id: FEAT-VER-001
title: Entity and truck verification
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-CAP-001]
problem: Public capacity seekers need visible, evidence-based trust signals for providers, Drivers, and truck authority without treating account access or a badge as a guarantee.
behavior: Authorized providers submit private verification documents for an owned organization, Driver, truck, or existing Driver-truck pairing. Administrators review each request and expiry. Public Capacity Board cards and provider microsites derive vivid category-specific badges only from current approvals and always tell visitors to perform their own checks.
contracts: [VerificationSubject, VerificationTypePolicy, VerificationSubmission, VerificationReview, VerificationExpiry, DriverTruckAuthorization, VerificationBadgeSummary, VerificationBadgeMeaning, VerificationRiskNotice, VerificationFileAuthorization]
observability: [verification_submitted_audit, verification_reviewed_audit, verification_denied_outcome]
rollout: Document names remain extensible; use private Supabase Storage plus actor-scoped PostgreSQL commands in every runtime, seed only explicit demo approvals, and roll back by hiding badges and disabling submissions without deleting review history; never fall back to SQLite.
---

# Verification

### Scenario: verification history remains bounded

Given a workspace or administrator has many verification requests\
When request history or the review queue changes page\
Then only one bounded server page is rendered\
And every matching request remains reachable without exposing private documents to another workspace.

### Scenario: owner submits supported evidence

Given an authenticated fleet transporter or self-managed Driver\
When they choose an owned profile, truck, or eligible Driver-truck pairing, a supported verification type, and a valid private document\
Then one Pending verification request is created\
And only the owner and an administrator may read its metadata.

### Scenario: truck evidence is chosen for the truck

Given a fleet owner or independent provider manages an active truck, or a company Driver is currently assigned to it\
When they submit a truck document\
Then they can choose ownership proof or permission from the owner to use that truck\
And the choice is not restricted by the provider's signup operating model\
And the subject is that exact truck in the current authorized workspace\
And permission evidence requires an expiry date\
And an unrelated provider, a retired truck or a stale assignment cannot authorize submission\
And an upload alone never produces a reviewed badge.

Given a company Driver has existing Driver-truck permission evidence\
When that legacy evidence is displayed\
Then it remains scoped to that Driver and truck and retains its expiry\
And it does not become another Driver's permission through reassignment.

### Scenario: each document appears with its subject

Given a transporter has company, Driver and truck evidence\
When the owner, company profile or truck detail is displayed\
Then company evidence appears in the company/owner section\
And Driver identity and license appear with that Driver\
And truck ownership or permission appears with that truck\
And the reviewed badge names the specific document category\
And ownership proof does not imply that an unsubmitted permission document was reviewed\
And approved company evidence never marks a Driver or truck as reviewed\
And public display includes only review metadata, never a private file link or its bytes.

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
And document uploads are optional during signup, truck registration, publication, and other authorized software use\
And gray Not verified badges encourage evidence submission without blocking access\
And colored reviewed badges require an unexpired approval, not merely an upload\
And a missing approval states that Loadgistic has not reviewed current evidence rather than claiming the Driver or provider possesses no document\
And an empty badge array can never be summarized as fully reviewed.

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

### Scenario: managed verification is actor scoped and durable

Given local development, Preview, or Production uses the managed runtime\
When a workspace reads its verification center, submits evidence, opens its private file, or an authorized Trust actor reviews it\
Then the active application route uses the dedicated Verification port, Supabase PostgreSQL, and private Supabase Storage\
And PostgreSQL repeats current actor, workspace or Trust permission, subject ownership, evidence type, Driver-truck pairing, expiry, duplicate, and terminal-review checks\
And a failed metadata command removes a newly released upload instead of leaving an unowned evidence object\
And every private-file read repeats submitter or Trust authorization without returning its storage reference to the browser\
And browser roles cannot execute the service-only commands or read the private bucket directly\
And managed failure never falls back to SQLite or a serverless local file.

## Supported categories

- Fleet transporter organization: National ID, Business license, and Business address
- Independent provider and company Driver: National ID and Driver license
- Truck: ownership proof or permission to use that specific truck, independently of signup model; permission requires an expiry date
- Company Driver permission remains tied to that Driver and the currently assigned truck, including when submitted from the truck selector. Reassignment never transfers that permission to the next Driver.
- Historical approval records remain intact and are displayed only against their original eligible entity or pairing.

The catalog may add country- or actor-specific document names in a later accepted update without changing approved historical records.

## Contract ownership

- Pages: `/app/verification`, `/admin/verifications`, public Capacity Board, provider microsites, and truck rosters
- Application services: dedicated managed Verification application port
- Private file adapter: `/api/files/verification/[id]` backed by actor-scoped PostgreSQL authorization and private Storage
- Tests: managed Verification contract and live Supabase verifier, `tests/repository.test.mjs`, `tests/authorization.test.mjs`, `tests/e2e/smoke.spec.ts`

### Authorization submission choices reflect current approval — 2026-09-21

Given a Driver has multiple eligible trucks and some pairings already have current approval
When a truck is selected in the verification form
Then permission remains available only if that truck has no current applicable approval or pending request from this submitter
And expired approval permits renewal; all approved/expired badge details remain visible.
And the backend still rechecks identity, assignment, expiry and duplicate submissions.
And an empty submission form never claims mandatory documents or verification of
unavailable subjects: documents remain optional.

Implementation: filter the form's truck projection using the same current-approval
badges already displayed, without removing records or weakening submission checks.
Pending submissions still receive the existing backend duplicate denial; do not
claim they are approvals. Cover mixed approval/expiry and actual provider browser
choices, keeping fixtures isolated.

Given the verification form's server-rendered HTML arrives before its client logic
When a visitor tries to change subject or document category
Then those dependent selectors wait for client readiness before accepting input
And an accepted choice displays its corresponding fields without being reset by mount.
The local browser audit reproduced a lost early category selection; use the same
readiness protection as the existing assisted-chat control, without new user steps.

### Scenario: pending submissions are explained before another upload

Given an actor has a Pending request for a subject category or Driver-truck pairing
When they open Verification
Then that pending choice is excluded from their submission options and in-review guidance is visible
And another eligible pairing remains selectable
And Pending never produces an approved badge
And More information or rejected requests remain eligible for corrected evidence
And the server continues rejecting duplicate Pending requests despite stale clients.


## Truck evidence alternatives — local verification, 2026-09-23

Migration `102_truck_document_alternatives.sql` offers both categories to current
truck controllers. New company-Driver permission retains a durable Driver
subject and related truck; public and private projections accept it only while
that assignment remains current. Independent/fleet evidence has the truck as its
subject. Company identity/license/address never become truck approvals. Owner
metadata is read in bounded batches of at most 100 already-authorized providers;
only category, review date and expiry leave that query. Private files retain the
existing submitter/Trust authorization. Existing approvals and audit rows stay intact.

Tests: `tests/truck-document-summary.test.mjs`,
`tests/sql/truck-document-alternatives.sql`, and
`tests/e2e/truck-documents.spec.ts`. SQL tests roll back all fixtures. Focused
browser evidence uses normal local email-code login and real private upload;
review is exercised through the authorized database command, not claimed as a
new admin-browser review. Existing `tests/e2e/review-workflows.spec.ts` follows
the new per-truck selector and remains part of the post-approval full gate.

Local evidence: 2026-09-23 SQL rehearsal passed and migration 102 applied locally;
four document browser cases passed across desktop/phone. Capture directories:
`artifacts/truck-documents-final-20260923-retry/` and
`artifacts/public-document-entities-20260923/`. Owner visual approval, full
release validation, protected production migration and deployment remain pending.
Rollback the application to its prior artifact if necessary; retain added
functions, existing evidence and private files until a reviewed database rollback.
No destructive document rewrite is part of this change.
