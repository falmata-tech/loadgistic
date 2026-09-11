---
id: FEAT-BIL-001
title: Time-bounded workspace subscription access
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-APP-001, FEAT-TRK-001]
problem: Self-managed Driver and fleet transporter workspaces need a useful trial, manually confirmed monthly access, and predictable limits after access expires.
behavior: Successful provider signup starts a seven-day workspace trial; a manually approved payment grants 30 days; expired or unpaid providers retain login, Home, Account, and billing access while provider operating commands are denied. Public capacity discovery and guest tracking never depend on a seeker subscription.
contracts: [WorkspaceSubscription, SubscriptionAccessPolicy, TrialPeriod, PaidPeriod, PaymentProofAggregate, EtbAmount, BillingReviewPolicy, BillingFilePort]
observability: [billing_audit, subscription_access_denial, trial_provisioned, paid_period_started, submission_outcome, review_outcome]
rollout: Keep review manual and plan prices undisclosed until a separately specified payment integration and commercial price schedule are approved; use private Supabase Storage plus actor-scoped PostgreSQL commands in every runtime, monitor expiry denials and renewal-review time, and never fall back to SQLite.
---

# Billing proof

### Scenario: workspace submits payment proof

Given an authenticated workspace has a subscription\
When a positive ETB amount and optional validated file are submitted\
Then a pending proof is linked to that workspace\
And an already active trial or paid period is not shortened\
And bank passwords, PINs, or OTPs are never requested\
And the submitting workspace and an authorized billing administrator may open an attached private proof through a reauthorized route.

### Scenario: plan page reflects workspace type

Given an authenticated user opens More and billing information\
When their workspace has an assigned subscription\
Then Self-managed Driver / Owner-Operator and Fleet Transporter plans use distinct labels and descriptions appropriate to that workspace\
And no standard plan price is displayed.

### Scenario: payment history remains bounded

Given a workspace or administrator has many payment proofs\
When payment history or the review queue changes page\
Then one bounded server page is rendered\
And the current plan access state remains visible\
And every proof remains reachable without exposing another workspace's proof.

### Scenario: new workspace receives a trial

Given a Fleet Transporter or Self-managed Driver completes signup\
When the workspace and subscription are provisioned\
Then access begins immediately as a seven-day trial\
And company Drivers use their Fleet Transporter's workspace access rather than receiving separate subscriptions.

### Scenario: administrator confirms a monthly payment

Given a pending payment proof and an authenticated administrator\
When the administrator marks it approved\
Then the result is persisted once\
And the workspace receives access for 30 days from approval\
And the paid-period start and end are audited.

### Scenario: trial or paid access expires

Given a non-sponsored workspace has no unexpired trial or paid period\
When one of its members signs in or requests an operating page\
Then sign-in succeeds and Home shows the expired or unpaid plan state\
And Account and payment-proof submission remain available\
And fleet, provider shipment, capacity, profile, verification, and tracking-operation workspace pages are denied\
And protected commands are denied even if called without using the interface.

### Scenario: public users do not inherit provider billing gates

Given a visitor browses public capacity, a provider microsite, or valid guest tracking\
When the related provider subscription is evaluated\
Then public access is governed by publication, assignment, and guest-retention policy rather than a visitor account\
And no visitor plan or payment screen is required.

### Scenario: payment waits for review after expiry

Given a workspace submits payment after its access period expired\
When the proof remains Pending or More Information\
Then the workspace is labeled Payment under review\
And operating access remains limited until approval.

### Scenario: cross-tenant billing access

Given a non-admin user from another workspace\
When they request or mutate a payment proof\
Then access is denied without disclosing proof-file details.

### Scenario: terminal payment review is immutable

Given a payment proof has been approved or rejected\
When an administrator attempts another review\
Then the command is rejected\
And the proof and subscription retain their terminal result.

### Scenario: managed billing is actor scoped and durable

Given local development, Preview, or Production uses the managed runtime\
When a workspace reads payment history, submits a proof, opens its private file, or an authorized Billing actor reviews it\
Then the active application route uses the dedicated Billing port, Supabase PostgreSQL, and private Supabase Storage\
And PostgreSQL repeats current actor, workspace or Billing permission, subscription ownership, status, amount, and terminal-review checks\
And a failed metadata command removes a newly released upload instead of leaving an unowned proof object\
And every private-file read repeats workspace or Billing authorization without returning its storage reference to the browser\
And browser roles cannot execute the service-only commands or read the private bucket directly\
And managed failure never falls back to SQLite or a serverless local file.

## Contract ownership

- Pages and adapters: `/app/more`, `/admin/billing`, billing route handlers
- Application services: dedicated managed Billing and workspace application ports; pure expiry policy in `src/lib/subscription-access.js`
- Persistence and files: actor-scoped Supabase PostgreSQL commands plus private Storage quarantine/release/read/remove adapters
- Tests: managed Billing contract and live Supabase verifier, `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/authorization.test.mjs`, `tests/e2e/smoke.spec.ts`
