---
id: FEAT-BIL-001
title: Subscription payment-proof review
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-TRK-001]
problem: Business, self-managed driver, and fleet transporter workspaces need simple ETB subscription payment confirmation without collecting bank credentials.
behavior: Authorized users see the plan assigned to their workspace type, submit amount, reference, and optional private proof; administrators approve or reject pending proofs.
contracts: [PaymentProofAggregate, EtbAmount, BillingReviewPolicy, BillingFilePort]
observability: [billing_audit, submission_outcome, review_outcome]
rollout: Keep review manual until a separately specified payment integration is approved; monitor duplicate references and access denials.
---

# Billing proof

### Scenario: workspace submits payment proof

Given an authenticated workspace has a subscription\
When a positive ETB amount and optional validated file are submitted\
Then a pending proof is linked to that workspace\
And bank passwords, PINs, or OTPs are never requested.

### Scenario: plan page reflects workspace type

Given an authenticated user opens More and billing information\
When their workspace has an assigned subscription\
Then Business, Self-managed Driver / Owner-Operator, and Fleet Transporter plans use distinct labels and descriptions appropriate to that workspace.

### Scenario: administrator reviews proof

Given a pending payment proof and an authenticated administrator\
When the administrator approves or rejects it\
Then the result is persisted once and audited.

### Scenario: cross-tenant billing access

Given a non-admin user from another workspace\
When they request or mutate a payment proof\
Then access is denied without disclosing proof-file details.

### Scenario: terminal payment review is immutable

Given a payment proof has been approved or rejected\
When an administrator attempts another review\
Then the command is rejected\
And the proof and subscription retain their terminal result.

## Contract ownership

- Pages and adapters: `/app/more`, `/admin/billing`, billing route handlers
- Application services: billing functions in `src/lib/repository.js`
- Tests: `tests/repository.test.mjs`
