---
id: FEAT-APP-001
title: Immediate account signup
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001]
problem: Businesses looking for logistics capacity and transporters looking for shipment demand need low-friction accounts without confusing account access with document verification.
behavior: A public user signs up for either a Business account or a Transporter category; the active account, correct workspace, and seven-day trial are provisioned atomically; authenticity remains unverified until evidence is approved.
contracts: [SignupCommand, SignupRecord, WorkspaceProvisioner, TrialProvisioner]
observability: [signup_audit, workspace_provisioned, trial_provisioned, rate_limit_outcome]
rollout: Monitor failed signups and transactional provisioning errors; retain immutable signup records without an administrator application queue.
---

# Account signup

### Scenario: signup submitted

Given a unique email, supported account type, and password of at least ten characters\
When the public signup form is submitted\
Then an active user, the correct workspace, a draft Public Profile Info record, and seven-day trial are created atomically\
And an approved signup record is retained for audit history\
And the user can log in immediately.

### Scenario: application choices use demand and transporter language

Given an applicant opens the application form\
When they choose an account type\
Then demand-side companies are presented as Businesses looking for capacity\
And supply-side applicants are presented as Fleet Transporter or Self-managed Driver / Owner-Operator\
And no additional provider category is available.

### Scenario: signup provisions the right workspace

Given a supported account type\
When signup succeeds\
Then a Business receives an organization workspace\
And a Fleet Transporter receives a transporter organization workspace\
And a Self-managed Driver receives an independent provider profile\
And no identity, license, driver, or truck verification is inferred from signup.

### Scenario: signup is atomic

Given any user, workspace, profile, membership, company-page, signup-record, or trial write fails\
When signup is attempted\
Then the transaction is rolled back\
And no partially usable account or orphan signup record remains.

## Contract ownership

- Inbound adapter: `/apply` and its signup route handler
- Application service: `createBusinessApplication`
- Tests: `tests/repository.test.mjs`
