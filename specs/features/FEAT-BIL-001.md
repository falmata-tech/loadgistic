---
id: FEAT-BIL-001
title: Subscription payment-proof review
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-TRK-001]
problem: Workspaces need a simple ETB subscription payment confirmation process without collecting bank credentials.
behavior: Authorized users submit amount, reference, and optional private proof; administrators approve or reject pending proofs.
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

### Scenario: administrator reviews proof

Given a pending payment proof and an authenticated administrator\
When the administrator approves or rejects it\
Then the result is persisted once and audited.

### Scenario: cross-tenant billing access

Given a non-admin user from another workspace\
When they request or mutate a payment proof\
Then access is denied without disclosing proof-file details.

## Contract ownership

- Pages and adapters: `/app/more`, `/admin/billing`, billing route handlers
- Application services: billing functions in `src/lib/repository.js`
- Tests: `tests/repository.test.mjs`
