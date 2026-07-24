---
id: FEAT-APP-001
title: Business application and approval
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001]
problem: Enterprise shippers, receivers, and providers require reviewed accounts before accessing operating features.
behavior: A public applicant submits required facts; an administrator approves or rejects once; only approval activates the user and workspace.
contracts: [ApplicationCommand, ApplicationStatus, AdminReviewPolicy, WorkspaceProvisioner]
observability: [application_audit, review_outcome, rate_limit_outcome]
rollout: Monitor failed submissions and approval errors; keep activation transactional.
---

# Business applications

### Scenario: application submitted

Given a unique email, supported account type, and password of at least ten characters\
When the public application is submitted\
Then an inactive user and pending application are created atomically\
And the applicant is told approval is required before login.

### Scenario: administrator approves

Given a pending application and an authenticated administrator\
When the administrator approves it\
Then the correct organization or independent provider profile is provisioned\
And the user becomes active.

### Scenario: non-admin review is denied

Given a non-administrator\
When they attempt to review an application\
Then the command is rejected and no application state changes.

## Contract ownership

- Inbound adapters: `/apply`, `/admin/applications`, related route handlers
- Application service: `createBusinessApplication`, `reviewApplication`
- Tests: `tests/repository.test.mjs`
