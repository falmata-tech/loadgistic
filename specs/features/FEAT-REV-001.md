---
id: FEAT-REV-001
title: Verified guest reviews for transport providers
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-SHP-001, FEAT-TRK-001, FEAT-PRV-001]
problem: A capacity seeker without an account still needs a trustworthy way to review the provider after a real completed shipment, without letting low ratings be hidden during moderation.
behavior: The emailed customer owner may submit one verified review of the transport provider after completion. The provider never rates the guest or other people sharing Tracking access. Every rating publishes and counts immediately. A provider may dispute a one-, two-, or three-star rating, but the rating stays public and counted while that dispute is pending.
contracts: [VerifiedProviderReview, ReviewAuthorizationGrant, ProviderReviewSummary, LowRatingReviewRequest, ManagedProviderReviewRepository]
observability: [provider_review_submitted, low_rating_review_requested, low_rating_review_resolved, provider_review_denial]
rollout: Add provider-review ownership and guest authorization additively, purge fake local Business-to-Business reviews, and switch public reputation only after the new projection and authorization tests pass.
---

# Verified provider reviews

### Scenario: emailed shipment owner submits one review

Given provider-owned Tracking is Complete and the customer owner received its completion email\
When that party follows an unexpired, shipment-bound review authorization and submits a rating\
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
And only a terminal Remove decision excludes the review from the public summary.

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

Given the server has verified the shipment-bound review browser grant or an authenticated provider actor\
When it submits a review or opens a dispute through the managed repository\
Then a service-role-only PostgreSQL command rechecks completion, guest expiry, one-review uniqueness, provider ownership, rating range, and dispute state\
And unrelated providers, assigned company Drivers, expired grants, duplicate reviews, and four- or five-star disputes are denied\
And every accepted rating is Published immediately while an accepted low-rating dispute remains Pending without hiding the rating.

## Contract ownership

- Public flow: completion-email review action and guest review form
- Public projection: provider microsite review summary and verified-shipment label
- Administration: bounded one- to three-star dispute queue and audited terminal decision
- Persistence: `044_provider_tracking_runtime.sql` and the server-only provider Tracking/review adapter
- Tests: repository, managed authorization, E2E
