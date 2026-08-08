---
id: FEAT-APP-001
title: Immediate transport-provider signup
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001]
problem: Transport providers need low-friction operating accounts while capacity seekers should browse and track without being forced to register.
behavior: A public user signs up as a Fleet Transporter or Self-managed Driver / Owner-Operator; the active provider workspace and seven-day trial are provisioned atomically. Capacity-seeker signup is absent, and signup never implies document verification.
contracts: [SignupCommand, SignupRecord, WorkspaceProvisioner, TrialProvisioner]
observability: [signup_audit, workspace_provisioned, trial_provisioned, rate_limit_outcome]
rollout: Monitor failed signups and transactional provisioning errors; retain immutable signup records without an administrator application queue.
---

# Account signup

### Scenario: signup submitted

Given a unique email, supported account type, and password of at least ten characters\
When the public signup form is submitted\
Then an active user, the correct provider workspace, a draft provider microsite record, and seven-day trial are created atomically\
And an approved signup record is retained for audit history\
And the user can log in immediately.

### Scenario: signup offers only provider accounts

Given an applicant opens the application form\
When they choose an account type\
Then Fleet Transporter and Self-managed Driver / Owner-Operator are the only account choices\
And a capacity seeker is directed to browse capacity or track a shipment without an account\
And no Business or additional provider category is available.

### Scenario: signup provisions the right workspace

Given a supported provider account type\
When signup succeeds\
Then a Fleet Transporter receives a transporter organization workspace\
And a Self-managed Driver receives an independent provider profile\
And no identity, license, driver, or truck verification is inferred from signup.

### Scenario: signup is atomic

Given any user, workspace, profile, membership, company-page, signup-record, or trial write fails\
When signup is attempted\
Then the transaction is rolled back\
And no partially usable account or orphan signup record remains.

## Contract ownership

- Inbound adapter: `/apply` and its signup route handler
- Application service: provider signup command
- Tests: `tests/repository.test.mjs`
