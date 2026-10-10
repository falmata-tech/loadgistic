---
id: FEAT-PLY-001
title: Play policy workflows and review readiness
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-MOB-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-SUP-001, FEAT-MKT-001, FEAT-TRK-001, FEAT-LNG-001, FEAT-SEC-001]
problem: A verified binary alone does not meet account deletion, location consent, public-content moderation or reviewer-access requirements.
behavior: Provide verifiable deletion requests and fulfillment, explicit location consent, report and block controls, and restricted normal-authentication reviewer access without weakening customer permissions.
contracts: [AccountDeletionRequest, ContentSafetyCommand, BackgroundLocationConsent, ReviewAccountAccess]
observability: [account_deletion_requested, account_deletion_completed, content_report_created, content_moderated, location_consent_changed, review_login_denied]
rollout: Implement and verify locally first. Owner visual approval precedes extensive release gates. New production SQL, review identity and configuration need exact reviewed target/backup/rollback evidence; no public Play rollout is authorized by implementation alone.
---

# Play requirements — deployed workflows; device and Console acceptance pending

The owner requested all missing Play workflows on October 9. Console developer
5256539403314542898 / app 4974969611761012361 is independently authenticated under
marketvision.tech@gmail.com on October 10. The publisher is Active with Admin on
Loadgistic only and zero account-wide grants. This identity
does not replace the application's administrator or Expo identity. Package stays
com.loadgistic.app. Never treat an app entry or draft upload as publication.

October 9 rollout: approved SQL 131–136 committed; web runtime 9feab2d is live
as deploy 6ac99d110f1f577818c9f7c9. Verification commit 068ac35 preserves all
runtime/native/SQL inputs, and CI 38012117505 passes all eight latest jobs.
Eighty live checks pass, including three new private normal-auth reviewers and
company-driver denial of the transporter-profile editor. Protected credential
files remain outside source/builds; no initial human consent or customer erasure
was invented. Signed 1.0.3/code-4 APK/AAB are verified and available for testing.
October 10: existing Google signing and unchanged Expo upload signer are verified.
Exact EAS 066f028f-0cb0-4286-9830-40815264e11e FINISHED; internal
4700942405023499701/release 1 is Active/available/Not reviewed. Alpha
4699446366767369053/release 1 is Draft with the same bundle, owner list and
Ethiopia/US eligibility. Privacy/private reviewers/IARC/Data safety and other
source-backed metadata are saved; listing assets/copy stay Draft pending the
specific AI-label reply after automatic review rejected incomplete provenance.
Location/foreground-service video, physical GPS/alerts/16 KB acceptance, real
closed enrollment and Google review remain pending. The owned emulator's System
UI ANR and one bounded recovery failure are recorded; no complete permission video
or full native/policy acceptance is inferred from an internal test release.

## AC1 — Location consent before permission or collection

Given a driver has agreed active shipment tracking
When background location has not been explicitly accepted on this device
Then a readable disclosure explains location collection while closed, approximate
sharing with authorized shipment parties, use only for active shipments and OS
permission controls before any location permission request or background task
And declining leaves other app functions available without starting collection
And previously granted OS permission alone does not count as disclosure consent
And account changes, sign-out, revoked authority and completed tracking stop or
revalidate collection without transferring consent or leases to another account.

## AC2 — Real account/data deletion

Given a person requests deletion from Account or the public deletion web page
When their existing email is verified without creating an account
Then a durable, idempotent deletion request is visible to authorized administrators
And it remains requestable when active work prevents immediate fulfillment
And the requester sees its status and any specifically explained retained data
And fulfillment removes non-required account/public/contact/device data and files,
revokes sessions and location leases, and preserves only justified scoped records
And a failed file/Auth cleanup remains retryable rather than reported complete
And an unrelated account, staff role or client-supplied ownership is never authority
And deactivation is not presented as deletion.

## AC3 — Public-content reporting, blocking and moderation

Given a visitor sees a public provider profile, picture or shipment review
When they report content or block the provider
Then a bounded report can be reviewed and resolved by permitted web staff
And blocked content disappears from that viewer's discovery without changing
other viewers or disclosing private records
And visitors can reverse their own block
And terms prohibit objectionable content and are accepted before uploading
And report spam, cross-tenant mutations and arbitrary target identifiers are denied
And moderation is a persisted audited action, not merely an alert or placeholder.
And excluding hidden/reviewer workspaces preserves the existing 5,000-truck
query/payload limits without removing eligible signals or adding user steps.
Existing workflow fixtures explicitly model already-consented synthetic identities
on isolated local services. Fresh-consent tests create unaccepted identities and
exercise the visible checkbox; no human or hosted consent is backfilled.

## AC4 — Reviewer access without general authentication bypass

Given the owner approves a dedicated synthetic demo identity
When a reviewer signs in with reusable credentials
Then normal provider authentication and all existing role/tenant checks apply
And the account has only synthetic demo records, no staff powers/customer data
And ordinary production accounts retain email-code sign-in
And absent configuration, bad credentials, inactive users and staff roles fail
closed with no session or token in logs, source or app payload
And refresh, sign-out and credential revocation retain existing security behavior.

## AC5 — Privacy, declarations and release evidence

Given the preceding workflows are tested
Then app and public policy explain actual data, optional permissions, responsible
contact, deletion/retention, providers and authorized location sharing consistently
And fixed UI text is covered in all five supported languages
And app-content/Data Safety answers derive from inspected runtime/provider behavior
And store artwork uses the existing approved identity and real app screenshots
And an Android demonstration shows disclosure, permission and active tracking
And a new exact signed APK/AAB includes the verified changes with an unused Play
version code and preserved signing before Console upload
And owner account/type, signing, reviewer credentials and Console declarations
remain explicitly pending until their actual evidence exists.

## Verification and operational boundary

Tests: `tests/account-erasure.test.mjs`, `tests/content-blocks.test.mjs`,
`tests/play-review-visitor.test.mjs`, `apps/mobile/tests/background-consent.test.mjs`,
`tests/sql/account-deletion.sql`, `tests/sql/public-content-safety.sql`,
`tests/sql/content-policy-acceptance.sql`, `tests/sql/app-review-accounts.sql`,
`tests/sql/play-scope-safeguards.sql`, `tests/e2e/play-policy-workflows.spec.ts`.
Additional projection/copy/manifest checks: `tests/sql/public-capacity-policy-scope.sql`,
`tests/play-policy-copy.test.mjs`, `tests/content-policy-intent.test.mjs`,
`apps/mobile/tests/play-notification-consent.test.mjs`.
CI runs all six policy SQL suites alongside existing authorization regressions;
local fixture import establishes only newly imported synthetic-user preconditions.
Existing Account/onboarding/recovery regression gates also run in desktop and
phone viewports: `tests/e2e/account-details.spec.ts`,
`tests/e2e/fleet-onboarding.spec.ts`, `tests/e2e/launch-recovery.spec.ts`.
Fresh onboarding accepts the actual visible terms checkbox. Existing Account
fixtures declare prior consent locally and still verify persisted saves, native
POST fallback, invalid input, inactive sessions and actor-forgery denial.
The onboarding tile fixture proves renderer readiness, not public tile delivery.
Document and multi-party Tracking regressions use separate local client buckets
so unrelated sign-in tests cannot exhaust their request allowance. They assert
the real successful OTP response and visible code-entry state before reading the
isolated inbox; production limits and email delivery remain unchanged.
The existing-content Tracking regression selects the known synthetic transporter
and declares its prior consent; it must not choose an arbitrary newly created
account whose pending terms dialog intercepts workflow actions.

Focused domain, native, database and browser tests must cover each implemented AC.
Record test paths/results in TRACEABILITY before marking verified. No new SDK,
privileged authentication bypass, provider settings replacement, secret export or
production erasure is required to make the local implementation reviewable.
Roll back exposure first; completed deletion is irreversible and requires exact
request/subject review. Report and retain ambiguous cleanup state, never restore
unrelated records automatically.
