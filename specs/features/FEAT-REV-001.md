---
id: FEAT-REV-001
title: Business rating publication and moderation
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-PRV-001, FEAT-ADM-001]
problem: Completed-load Business ratings need useful public reputation without allowing an uninvestigated low rating or fraud allegation to damage a member profile.
behavior: Four- and five-star participant reviews publish immediately; one- through three-star reviews require an explanatory note, enter a private administrator queue, and affect public reputation only after an administrator publishes them.
contracts: [BusinessReviewSubmission, BusinessReviewPublicationPolicy, RatingModerationQueue, RatingModerationDecision, ProfileRatingSummary, AdminAudit]
observability: [business_review_submitted, low_rating_notification, rating_moderation_decision]
rollout: Existing reviews migrate as Published; low-rating moderation is additive and terminal decisions preserve the original review and investigation record.
---

# Business rating moderation

### Scenario: positive completed-load review publishes immediately

Given a shipper or receiver Business may review the other Business after a Completed load\
When it submits four or five stars\
Then the review is Published immediately\
And it contributes to the subject Business rating count and average.

### Scenario: low rating enters private review

Given an eligible Business submits one, two, or three stars\
When it includes the required explanatory note\
Then the review is stored as Pending\
And it does not contribute to the subject Business public count or average\
And active administrators receive a notification that identifies the load and review queue without exposing the allegation publicly\
And the reviewed Business cannot read the Pending rating or note.

### Scenario: unexplained low rating is rejected

Given an eligible Business selects one, two, or three stars\
When it submits no explanatory note\
Then the command is rejected\
And no review, notification, or success audit is created.

### Scenario: administrator investigates a pending rating

Given an authenticated administrator opens Rating Reviews\
When Pending low ratings are listed\
Then each item shows the load, reviewer Business, subject Business, rating, submitted note, and timestamps\
And the administrator may open the load context or the Operations search for the subject\
And credentials, tracking codes, receiver contact, proof paths, and exact coordinates are absent.

### Scenario: administrator publishes or dismisses a low rating

Given a low rating remains Pending\
When an administrator records an investigation note and chooses Publish or Dismiss\
Then the terminal decision, administrator, note, and time are recorded and audited\
And Publish adds the review to the public rating summary\
And Dismiss preserves it for accountability but never publishes it\
And a later decision attempt changes nothing.

### Scenario: non-administrator cannot moderate ratings

Given an authenticated non-administrator\
When it reads the moderation queue or submits a moderation decision\
Then access is denied\
And no review state, notification, or audit is changed.

## Contract ownership

- Application services: `submitBusinessReview`, `listRatingModerationQueue`, `reviewBusinessRating`
- Pages: completed shipment review and `/admin/ratings`
- Inbound adapters: `/api/shipments/[id]/business-review`, `/api/admin/ratings/[id]`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
