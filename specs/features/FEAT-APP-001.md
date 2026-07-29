---
id: FEAT-APP-001
title: Account signup and approval
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001]
problem: Businesses looking for logistics capacity and transporters looking for shipment demand require reviewed accounts before accessing operating features.
behavior: A public user signs up for either a Business account or a Transporter category; an administrator approves or rejects once; only approval activates the user and workspace.
contracts: [ApplicationCommand, ApplicationStatus, AdminReviewPolicy, WorkspaceProvisioner]
observability: [application_audit, review_outcome, rate_limit_outcome]
rollout: Monitor failed submissions and approval errors; keep activation transactional.
---

# Business applications

### Scenario: signup submitted

Given a unique email, supported account type, and password of at least ten characters\
When the public signup form is submitted\
Then an inactive user and pending application are created atomically\
And the user is told approval is required before login.

### Scenario: application choices use demand and transporter language

Given an applicant opens the application form\
When they choose an account type\
Then demand-side companies are presented as Businesses looking for capacity\
And supply-side applicants are presented as Fleet Transporter or Self-managed Driver / Owner-Operator\
And no additional provider category is available.

### Scenario: administrator approves

Given a pending application and an authenticated administrator\
When the administrator approves it\
Then the correct organization or independent provider profile is provisioned\
And the user becomes active\
And the workspace receives either its seven-day trial or an eligible reviewed Business sponsorship.

### Scenario: non-admin review is denied

Given a non-administrator\
When they attempt to review an application\
Then the command is rejected and no application state changes.

### Scenario: terminal application review is immutable

Given an application has been approved or rejected\
When an administrator attempts another review\
Then the command is rejected\
And no second workspace, subscription, or review audit is created.

### Scenario: pending seed application respects the approval boundary

Given the deterministic local fixture database is initialized\
When the seeded pending application is inspected\
Then its applicant is inactive and has no organization or provider profile\
And no active workspace user is also represented as that pending applicant.

## Contract ownership

- Inbound adapters: `/apply`, `/admin/applications`, related route handlers
- Application service: `createBusinessApplication`, `reviewApplication`
- Tests: `tests/repository.test.mjs`
