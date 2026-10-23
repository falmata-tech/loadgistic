---
id: FEAT-BIL-001
title: Provider access without plans or platform payments
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-APP-001, FEAT-TRK-001, FEAT-TRQ-001, FEAT-MOB-001]
problem: Retired trial, subscription and payment controls confuse transporters and can block an otherwise valid workspace without a plan.
behavior: Loadgistic's current revenue service is arranging transport. Provider workspace access has no plan, subscription, trial countdown or platform payment requirement. Active account identity, workspace ownership and driver permissions still govern every operation. Old billing writes and paid-mode activation are retired; historical billing records and private proof files remain protected and retained.
contracts: [WorkspaceAccessPolicy, RetiredBillingCommands, HistoricalBillingAccess]
observability: [retired_billing_command_denied, workspace_authorization_denied, identifiers_only_audit]
rollout: Additive local-first retirement of charge/activation commands and plan-dependent access; retain all historical rows, files, RLS and service-only boundaries. Hosted application and database rollout require reviewed backup, rollback and exact release authority.
---

# Current commercial model

Owner clarification, October 7: there are no provider payment plans. The platform
earns revenue from arranging transport under FEAT-TRQ-001. This supersedes earlier
trial/payment activation contracts, retained in Git history. No online checkout,
automatic fee or payment processor is introduced by this correction.

### Scenario: active provider has no subscription

Given an active transporter or driver has an authorized provider/fleet workspace
and no subscription record
When they sign in on web or mobile and use an existing permitted operation
Then Home, Account, fleet, capacity, documents, private network and Tracking work
according to ownership and driver permissions
And no plan assignment, trial deadline, payment prompt or expiry gate is shown
And no fabricated subscription is needed to grant access.

### Scenario: expired historical plan does not restrict the workspace

Given an authorized active provider has a missing, expired, rejected or pending
historical billing record
When an operating service or PostgreSQL command evaluates access
Then billing status does not deny that operation
And inactive, unlinked, unauthorized and cross-workspace actors remain denied
And ADMIN and SUPPORT accounts remain web-only, including Transport agents.

### Scenario: new signup does not create a trial

Given a verified email completes eligible transporter signup
When the application creates the owner/provider workspace atomically
Then it creates the normal identity, profile, unpublished page and required
ownership records without looking up a plan or inserting a subscription
And it reports operating access without a trial end date
And identity eligibility, duplicate prevention and tenant isolation are unchanged.

### Scenario: billing entry points are retired

Given web/mobile navigation, Account, Home and platform administration
When they render
Then no Plans, Billing, Payment proofs or trial-activation controls are offered
And old billing screen links return to Account or the appropriate admin overview
And a stale client cannot submit a payment proof, approve a subscription payment,
create/change a plan/subscription or enable paid access
And rejection occurs before any file upload, record mutation or access-period change.

### Scenario: retained history stays private

Given historical billing rows, audit events or private files exist
When this retirement is applied
Then those records and references are preserved
And retained historical file reads continue to require their original owner or
authorized administrator
And no public/browser-direct relation or RPC grant is added
And app rollback never silently deletes history or reactivates charging.

### Scenario: a new app cannot claim readiness against the old billing schema

Given this application runs before its database retirement migration is installed
When health/release readiness is checked
Then it fails with a provider-access-contract blocker
And a missing marker or database error never reports a compatible runtime
And the marker is compatibility evidence, not a substitute for permission,
behavior, catalog, exact-artifact and backup checks.

Evidence required: focused access/domain tests; rollback SQL proving new signup,
no-subscription/expired-record access, retired writes, ownership/inactive/driver
denials and retained records; actual web/Expo Account and Home controls at desktop
and phone widths; owner visual review before full release gates.

Tests: `tests/provider-access-without-plans.test.mjs`,
`tests/sql/provider-billing-retired.sql`, `tests/managed-identity.test.mjs`,
`apps/mobile/tests/navigation.test.mjs`, `tests/mobile-billing.test.mjs` and
`tests/provider-access-health.test.mjs`, `scripts/verify-no-plans-local.mjs`
(running browser/API acceptance), `scripts/verify-supabase-verification-billing.mjs`
and `scripts/verify-supabase-platform-admin.mjs` (retained private history and
retired mutation checks). See ADR-075 and traceability for local evidence/limits.
