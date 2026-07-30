---
id: FEAT-ADM-001
title: Focused platform operations and review center
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-VER-001, FEAT-BIL-001, FEAT-REV-001, FEAT-SUP-001]
problem: Platform administrators need to manage connected client records and several evidence queues without loading or navigating multiple unrelated inventories at once.
behavior: Administrators receive one bounded, searchable Operations view focused on a selected record type and one Review Center that links application, document, rating, and payment queues through consistent tabs and compact review rows.
contracts: [AdminOperationsProjection, AdminOperationsView, AdminRecordSearch, AdminReviewQueue, SupportAgentManagement, UserActivationCommand, VehicleActivationCommand, AdminAudit]
observability: [admin_operations_read, admin_record_status_audit, denied_admin_command]
rollout: Add the inventory without changing tenant-facing visibility; status commands are reversible, audited, and deny non-admin callers.
---

# Platform operations

### Scenario: administrator inspects connected platform data

Given an authenticated platform administrator\
When Operations is opened or searched\
Then one selected bounded result set shows users, workspaces, trucks, loads, or latest capacity from authoritative records\
And relationships are identified with workspace, provider, truck platform number, shipment code, and current status\
And private proof paths, passwords, session values, tracking secrets, and exact coordinates are absent.

### Scenario: dense administrative queues remain operable

Given applications, verification requests, or payment proofs contain many records\
When an administrator searches, filters by status, or changes result pages\
Then the server returns one bounded page of matching records\
And terminal records do not render active review commands\
And the administrator can reach every matching record without rendering the entire queue at once\
And review controls remain collapsed until the administrator opens one record.

### Scenario: Operations queries only the selected record type

Given the platform contains many operational records\
When an administrator opens Operations or changes its record-type tab\
Then only the selected inventory query returns a bounded page\
And platform-wide counts remain visible\
And entering a search narrows the selected record type and resets its page\
And switching record type preserves a useful search term but does not render hidden inventory rows.

### Scenario: Review Center keeps related queues together

Given an administrator needs to review onboarding or trust evidence\
When Review Center is opened\
Then Applications, Documents, Ratings, and Payments are reachable as consistent tabs\
And one selected queue is rendered at a time\
And legacy queue URLs redirect to their corresponding Review Center tab\
And the browser Back action and tab links preserve understandable navigation.

### Scenario: administrator suspends or restores an account

Given an authenticated administrator selects an account other than their own\
When they suspend or restore access\
Then the user's active state changes\
And the actor, target, resulting state, and time are audited\
And a non-administrator or self-suspension attempt changes nothing.

### Scenario: administrator suspends or restores a truck

Given an authenticated administrator selects a truck\
When they deactivate or reactivate it\
Then the truck remains recorded with its permanent platform number\
And inactive trucks disappear from Fleet and marketplace discovery\
And the actor, target, resulting state, and time are audited.

### Scenario: administrator manages support agents

Given an authenticated administrator opens Support Team\
When the administrator creates or updates a support agent\
Then the agent receives only the SUPPORT role\
And availability, active state, and maximum open conversations are validated and audited\
And credentials are never redisplayed after creation\
And disabling an agent returns their open conversations to the waiting queue for safe reassignment.

## Contract ownership

- Page: `/admin/operations`
- Application services: admin inventory and activation functions in `src/lib/repository.js`
- Inbound adapter: `/api/admin/records/[type]/[id]`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
