---
id: FEAT-REV-001
title: Verified guest reviews for transport providers
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-SHP-001, FEAT-TRK-001, FEAT-PRV-001, FEAT-PLY-001]
problem: A capacity seeker without an account still needs a trustworthy way to review the provider after a real completed shipment, without letting low ratings be hidden during moderation.
behavior: The emailed customer owner may submit one verified review of the transport provider after completion. The provider never rates the guest or other people sharing Tracking access. Every rating publishes and counts immediately. A provider may dispute a one-, two-, or three-star rating; that dispute alone does not hide or exclude the rating. Independent current content-moderation restrictions and terminal rating removal remain effective across both review queues.
contracts: [VerifiedProviderReview, ReviewAuthorizationGrant, ProviderReviewSummary, LowRatingReviewRequest, ManagedProviderReviewRepository]
observability: [provider_review_submitted, low_rating_review_requested, low_rating_review_resolved, provider_review_denial]
rollout: Add provider-review ownership and guest authorization additively, purge fake local Business-to-Business reviews, and switch public reputation only after the new projection and authorization tests pass.
---

# Verified provider reviews

### Scenario: emailed shipment owner submits one review

Given provider-owned Tracking is Complete and the customer owner received its completion email\
When that party verifies their authorized email and opens the completed shipment within an active Tracking session and submits a rating\
Then exactly one review of the owning provider is accepted for that shipment and party\
And the shared Tracking code alone cannot authorize a review\
And the review is marked as arising from a completed shipment\
And no capacity-seeker account or public Business profile is created.

### Scenario: every valid rating publishes and counts

Given the verified shipment owner submits any rating from one through five stars\
When the review command commits\
Then the review publishes immediately\
And it appears in the provider's public review count and average\
And Loadgistic does not delay, suppress, or exclude it because of its score.

### Scenario: provider may dispute a one- to three-star rating without hiding it

Given a published provider review has a rating of one, two, or three stars\
When the reviewed provider submits one bounded dispute with a reason\
Then the dispute enters Pending review\
And the original rating and note remain public and continue to count\
And opening a dispute does not suspend the guest or provider\
And an administrator may record a terminal Uphold or Remove decision with an audit note\
And only a terminal Remove decision in the rating-dispute workflow excludes the review from the public summary; an independent content-moderation restriction remains governed by FEAT-PLY-001.

### Scenario: independent review restrictions survive decisions in either queue

Given a review has one or more HIDDEN content reports or a terminal REMOVED rating-dispute decision\
When authorized Trust staff uphold its pending dispute or restore one reported-content decision\
Then the review remains excluded from public text, count and average while any other current restriction remains\
And restoring a content report cannot change its terminal rating-dispute decision\
And upholding a dispute cannot restore or dismiss any content report\
And the review publishes only when the explicit permitted decision leaves no HIDDEN report and no terminal rating removal\
And decisions on the same review serialize with one another and retain each report, decision note and audit attribution.

Given a review decision has become terminal or the actor loses Trust authority\
When that actor replays a rating or content decision\
Then existing denial rules remain effective and no unrelated review, report or reputation changes.

October14 WEB-MOB-035 repair (migration143, installed locally): replace only the
two existing decision function bodies through exact asserted patches, retain
their service-only permissions/metadata and protected previous definitions, and
verify old-failing/new-passing isolated SQL for both command orders, multiple
reports, terminal replay, revoked Trust and unrelated records. Verify exact
rollback and refusal on function/metadata drift before hosted owner review. The
current audit request covers the reversible local repair; hosted installation
remains separately restricted. Browser moderation and
public projection evidence remain separate from the isolated rehearsal.

Isolated143 evidence: `tests/sql/review-moderation-restrictions.sql` fails on exact
original functions and passes on the candidate, including public text predicate
and actual count/average. Two real sessions, eight rollback-drift refusals,
candidate replay refusal and exact metadata/row/ledger restoration pass. The
initial restored-clone `public.spatial_ref_sys` failure was classified as the
NR-44 restore omission, with the original local database protected. The combined
fresh restore and local143/144 installation now pass both regressions and strict
catalog checks, preserve all other function permissions and78 business tables,
and retain the original stop on one independently changing rate-limit counter.
Receipts: `.local/review-moderation-143-20261014/review-manifest.json` and
`.local/internal-workflows-20261014/main-143-144-install-receipt.json`.
Both actual desktop/phone conflict-form cases now pass: saved Trust Hide/Restore,
rating Uphold/Remove, canonical public HTML/API text/count/average after every
restriction, stale revoked-Trust denial and exact cleanup. Receipt:
`.local/internal-workflows-20261014/moderation-conflict-actual-runner.json`.
No hosted install; owner visual and full release gates remain separate.

### Scenario: provider cannot rate a guest or dispute higher ratings

Given a provider owns a completed shipment or has a published four- or five-star review\
When the provider attempts to rate either guest party or dispute the higher rating\
Then the command is denied\
And no review, dispute, or public summary changes.

### Scenario: review authorization is narrow

Given only the shared Tracking code, an unrelated review code, expired guest grant, incomplete shipment, duplicate reviewer, provider member, or anonymous visitor attempts to review\
When authorization is evaluated\
Then no review is created or changed\
And the response reveals no private shipment or party data.

### Scenario: managed review commands preserve authorization and publication rules

Given the server has verified the recipient-bound Tracking session or an authenticated provider actor\
When it submits a review or opens a dispute through the managed repository\
Then a service-role-only PostgreSQL command rechecks current recipient OWNER role, completion, guest expiry, one-review uniqueness, provider ownership, rating range, and dispute state\
And unrelated providers, assigned company Drivers, expired grants, duplicate reviews, and four- or five-star disputes are denied\
And every accepted rating is Published immediately while an accepted low-rating dispute remains Pending without hiding the rating.

## Contract ownership

- Public flow: completion-email review action and guest review form
- Public projection: provider microsite review summary and verified-shipment label
- Administration: bounded one- to three-star dispute queue and audited terminal decision
- Persistence: `044_provider_tracking_runtime.sql` and the server-only provider Tracking/review adapter
- Tests: repository, managed authorization, E2E

Local browser evidence (2026-09-23):
`tests/e2e/tracking-completion-review.spec.ts` covers actual status controls to
Complete, local completion-email delivery, customer OTP plus the separate
review code, visible submission and one persisted Published review after reload
on desktop/phone. The provider/truck/shipment setup is synthetic and isolated;
the revised test extracts both access codes from the actual local completion
email. It does not certify hosted inbox delivery. Existing
backend negative tests remain responsible for duplicate and grant denial.

### Scenario: completion email explains all customer access steps

Given a completed shipment queues its customer owner completion email
When the email is delivered
Then it includes a Tracking link and concise guidance to verify the customer-owner email once
And the customer does not need to retrieve the earlier start email
And current owner role, completion, expiry and one-review limits remain enforced without a second code.

### Scenario: no second code after owner email verification (ADR-073)

Given the customer owner already has an active email-verified Tracking session
When they open their completed shipment
Then the review form is available without entering another code
And another recipient, a revoked owner, an expired session or an incomplete shipment cannot submit
And the database command locks and rechecks the owner recipient before accepting one review.

The 2026-09-23 browser evidence above describes the superseded separate-code UI.
Migration 114 and Tracking email-session regression tests replace that access flow.
