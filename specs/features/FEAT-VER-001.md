---
id: FEAT-VER-001
title: Entity and truck verification
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-CAP-001, FEAT-ENT-001]
problem: Public capacity seekers need visible, evidence-based trust signals for providers, Drivers, and truck authority without treating account access or a badge as a guarantee.
behavior: Authorized providers submit private verification documents for their organization, personal provider, Driver, truck, or existing Driver-truck pairing. Administrators and assigned Trust staff review requests and expiry. Exact provider ownership, operating-licence holder and drive/manage permission require separate deliberate confirmation against an approved applicable source. Public truck and provider badges expose only current reviewed facts, with concise guidance to confirm details directly. One unreviewed Live truck remains allowed under FEAT-FLT-001; more than one requires its exact qualifying review.
contracts: [VerificationSubject, VerificationTypePolicy, VerificationSubmission, VerificationReview, VerificationExpiry, DriverTruckAuthorization, VerificationBadgeSummary, VerificationBadgeMeaning, VerificationRiskNotice, VerificationFileAuthorization]
observability: [verification_submitted_audit, verification_reviewed_audit, verification_denied_outcome]
rollout: Document names remain extensible; use private Supabase Storage plus actor-scoped PostgreSQL commands in every runtime, seed only explicit demo approvals, and roll back by hiding badges and disabling submissions without deleting review history; never fall back to SQLite.
---

# Verification

## Native public vehicle document summaries

Given the existing authorized Capacity projection contains public review badges\
When native Vehicle details renders\
Then Owner or Transport Provider, Driver and Vehicle documents remain separate\
And only current verified, non-expired badges count as reviewed\
And expired and unreviewed categories remain explicit, with available public
review/expiry dates and the existing reminder to confirm documents directly\
And empty evidence is labelled Not verified rather than claiming approval\
And expanding a summary reveals only public metadata, never the private source,
document number, reviewer identity, note, file reference or download action\
And generic document review remains distinct from exact vehicle authority and
does not grant publication, contact or private-Capacity access.

## Optional shipper/broker document review

FEAT-ENT-001 adds the BUSINESS_WORKSPACE subject, separately from providers,
people and vehicles. Shipper/broker workspace owners may optionally submit
IDENTITY (manager National ID), BUSINESS_LICENSE and BUSINESS_ADDRESS. Existing
private upload validation, quarantine/scan behavior,
PENDING/MORE_INFO/REJECTED/APPROVED states, audit and current Trust permission
are reused; no vehicle authority or publishing gate is introduced. Documents
are optional for signup, workspace access, team management, provider-directory
visibility, recipient search and Capacity sharing. Each current approved
document may add its own safe badge. Missing, incomplete, pending, rejected,
stale or expired documents never prevent discovery or sharing. Fees are arranged
offline; Loadgistic stores no payment details or payment status, and review
approval remains an explicit staff action.

Each submission records a private context fingerprint of the relevant current
workspace/manager identity. Only matching, current, approved, unexpired facts
contribute to the matching trust badge in the provider-only directory summary.
A field edit, transfer, account suspension, expiry or archival removes the
affected badge without making an active workspace disappear from provider
search or recipient selection. Histories remain immutable and replacement
submissions do not overwrite previous files.
Only the current owner can submit/read their business proofs; a manager National
ID remains readable only to that manager while they are the current owner, or to
currently authorized Trust staff. Teammates/providers receive metadata only.

Given the exact owner submits a valid business document\
When Trust requests more information and the owner submits replacement proof\
Then the replacement is Pending and independently reviewable in the existing queue\
And the original private source/history is retained\
And approval affects only that exact current business fact, never a vehicle.

Given an active shipper/broker workspace has no documents or incomplete, pending, rejected, stale or expired documents\
When an authorized Transport Provider searches the directory or business recipients, or submits a Capacity share to its ID\
Then the workspace remains discoverable and can be added as a recipient\
And only the allowed team Capacity projection is returned.

Given the current workspace owner, manager identity and address match their approved, unexpired documents\
When an authorized Transport Provider searches or selects that business for a new Capacity share\
Then it appears with safe identity and matching review badges and can be added\
And no private document, manager surname, email, review note or payment data is exposed.

Given a previously approved shipper/broker document becomes stale, expires or is replaced\
When a Transport Provider views or searches that workspace\
Then the affected badge is removed while the active workspace remains discoverable and shareable.

Given a provider, foreign owner or ordinary business teammate requests the proofWhen they know a verification identifierThen the private file is denied even if the reviewed badge is visibleAnd neither direct table/RPC nor an old client bypasses current scope checks.

Given an approved manager ID or business factWhen its relevant identity changes, expires or is no longer activeThen its badge is absent and normal replacement is availableAnd a new owner cannot read the previous manager's ID or inherit its badge.

Verification uses the existing private upload, review, expiry, replacement and
erasure workflow; this optional business review introduces no schema rollout.
Local SQL/API tests and actual owner/provider/Trust browser/file outcomes prove
the workflow before completion is claimed. Hosted rollout remains separate.

## October 14 provider truck authority — implemented locally

Property ownership, financed purchase, operating-licence holder and permission
to drive/manage are separate facts. Renting does not establish provider ownership
or a licence in their name. This contract describes our review outcome, not a
claim about every country's licensing law. FEAT-FLT-001 permits one Live truck
without document approval; more than one Live truck requires the exact qualifying
review. Missing review stays clearly labelled, without implying a service guarantee.

### Scenario: reviewed relationship is exact and private

Given Trust staff can review an approved document on an exact truck\
When they confirm ownership, operating-licence holder with OWNED/FINANCED basis,
or permission to drive/manage for its provider\
Then an additive private review records exact source, vehicle, beneficiary
organization XOR provider profile, factual category, reviewer/time and expiry\
And the source must be an approved, applicable, unexpired document for that truck\
And identity matching is deliberate, not inferred from filename, uploaded text,
use declaration, account category or generic document approval\
And old terminal document decisions remain unchanged\
And stale/foreign/mismatched sources and unauthorized reviews are denied\
And a hidden opaque revision binds the reviewed source, vehicle, beneficiary and
review/revocation state, so a stale form cannot certify changed facts or undo a
newer revocation.

### Scenario: revocation preserves the original document history

Given a reviewed relationship was confirmed\
When authorized Trust staff revoke it with a reason\
Then the revocation actor/time/reason and original review remain audited\
And public badges and publication eligibility immediately exclude it\
And no document/file/history is deleted and replay does not create a second review.

### Scenario: saved staff forms recheck current authority and exact evidence

Given a reviewer loaded a relationship form while Trust access was active\
When Trust is removed, the staff profile is suspended or the account is suspended\
Then context reads, confirmation and revocation are denied without changing any
source document, relationship fact or audit record\
And Rejected/More Info sources cannot become confirmed relationships\
And one source's saved revision cannot confirm another source or beneficiary\
And permission/licence expiry is required, valid, current and no later than the
source expiry; an invalid date cannot partially create a review.

Focused regression: `tests/sql/provider-authority-command-denials.sql` passes
21 direct denials with exact unchanged-state comparisons and valid positive
controls in the isolated local clone. Every fixture remains Draft and rolls back.

### Scenario: qualification loss permits replacement evidence

Given a truck document remains Approved in its private history but its exact
ownership, permission or operating-licence authority is no longer current\
When its authorized provider opens Documents and submits replacement evidence\
Then that category is available unless another current submission is Pending\
And the new submission starts Pending and cannot restore authority by itself\
And current exact authority and duplicate Pending submissions still prevent
duplicate uploads, including simultaneous requests\
And the old approved source, private file and review history remain unchanged\
And foreign providers and employed drivers gain no additional subject authority.
Focused acceptance: `tests/provider-authority-recovery.test.mjs` and
`tests/sql/provider-authority-recovery.sql` (NR-48).

### Scenario: truthful badges and full-fleet counts

Given an eligible live truck or provider public profile is rendered\
Then ownership, operating licence/financing and drive/manage permission have
separate named reviewed badges with icon/text/color\
And financed purchase is not described as outright ownership without ownership
proof\
And public metadata never exposes holder's private name, document number/file,
reviewer contact, beneficiary internal ID or a private draft\
And provider totals are computed over the full authorized live disclosable fleet,
not the displayed page or truck filter results\
And mutually exclusive truck summary counts use ownership, then operating licence (owned or financed),
then permission, then Not yet verified, while preserving orthogonal document facts\
And a driver's own permission belongs to that exact driver/truck and never
certifies the provider's ownership or publication qualification.

Contracts: ProviderTruckAuthorityReview, ProviderTruckAuthorityRevocation,
ProviderTruckAuthoritySummary, ProviderFleetAuthoritySummary. New private tables
have RLS and browser-role denial before exposure; commands are service-only and
recheck active Trust permission. Public/map/Featured/Tracking/native projections
share an allowlisted factual summary. Existing approvals need explicit relationship
confirmation, never an automatic ownership backfill. New licence evidence reuses
private upload/quarantine/type checks with an applicable exact-vehicle category.
Implementation is installed in the backed-up local preview. Exact source,
private-file boundaries, authority transitions and recovery pass focused SQL and
adapter checks; the v3 rehearsal also verifies the fail-closed rollback artifact.
Actual desktop/phone submission and staff-review browser acceptance now passes.
Owner visual approval, full release gates and hosted rollout remain pending;
see `specs/TRACEABILITY.md`.

### Scenario: local fixture recovery preserves existing document history

Given an existing local demo predates exact authority facts and its named fixture
owner/truck identity still matches the explicit manifest\
When its guarded additive test-data correction is backed up and rehearsed\
Then new clearly fictional private files use normal submission, document review
and deliberate exact-authority confirmation\
And previously Approved sources, original files, declarations, assignments,
Tracking and saved Featured days remain unchanged\
And changed/foreign/nonfixture identities, pending conflicts, wrong API/project
targets and byte/revision drift stop the operation\
And no local fictional review may be used as production ownership evidence.
This local one-time operation is distinct from the reset-only fresh fixture import.

Keep the reviewed-authority tables, source history and current publication/read
gates during recovery. Restoring earlier discovery functions can re-expose newer
Draft or unqualified fleets; an old application is not automatically compatible.
The146 rollback artifact fails closed with
`PROVIDER_AUTHORITY_FORWARD_REPAIR_REQUIRED`, before any restore or privilege
change. FEAT-FLT-001 / NR-47 require an exact, separately reviewed compatible
application rollback or forward repair that retains ongoing authorized Tracking
and account-erasure protections. Exact-artifact denial and unchanged-catalog
proof are recorded separately from a successful metadata-restore rehearsal.

Independent driver unifies former owner-operator/self-managed accounts under
FEAT-APP/FLT-001. Its truck declares OWNED or PERMISSION separately from document
review. Unknown legacy declarations are not inferred. Replacing a truck creates
a new subject with no transferred approval/file/Driver-truck authorization;
historic evidence retains its original subject and private access boundary.

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

### Scenario: badge derives from current category evidence

For vehicle Ownership, Operating licence and Permission to drive/manage, the
public badge and matching document filter use the same current provider/vehicle/
assignment-bound authority fact. An old generic approved request without that
fact does not establish current vehicle authority or a blue Verified state.
Provider and driver identity/document categories retain their own current,
approved, unexpired evidence. Public summaries do not expose private pending
requests or uploaded files. Neutral public states must not reveal those details.

Given a generic vehicle ownership request is approved but current authority is absent\
When a visitor views that vehicle or applies its ownership verification filter\
Then the vehicle is not presented as currently ownership-verified in either view\
And no missing authority is fabricated to make a demo filter return a result.

Given an entity has a required verification category\
When no approved request exists\
Then the category badge is neutral gray and states Not verified.

Given an administrator approves the category\
When a visitor opens the public Capacity Board, provider microsite, or public truck detail\
Then its current verified state uses a flat high-contrast blue treatment, visible check icon and concise category/state label\
And identity, licence, address, driver and vehicle categories remain distinct through their labels and icons rather than different hues or gradients\
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

## Contextual document submission — October 6 (in progress)

Given an authorized provider manages a business, truck or driver
When they open that entity's document section
Then review badges, submission and recent history appear with that entity, narrowed
by both subject type and ID. Submission returns to that workspace. Every form has
unique control IDs even when multiple drivers appear. Existing centralized history
remains available for older records; private-file and mutation checks are unchanged.

Invalid return paths fall back to Verification; no foreign origin or arbitrary
application path is accepted. Test cross-kind/unknown entity isolation, local
submission/readback/return context, multiple-form labels and existing denial tests.

### October 7 browser evidence alignment

The selected-truck document scenario opens the owner-approved truck info modal
before inspecting the distinct Driver and truck badge groups. The Driver name
is read from that modal's current identity row; private file links remain absent.
`tests/e2e/driver-document-clarity.spec.ts` preserves the original assertions.
