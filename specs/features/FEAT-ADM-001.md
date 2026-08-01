---
id: FEAT-ADM-001
title: Focused platform operations and review center
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-VER-001, FEAT-BIL-001, FEAT-REV-001, FEAT-SUP-001]
problem: Platform administrators need to manage connected client records and several evidence queues without loading or navigating multiple unrelated inventories at once.
behavior: Administrators receive one bounded, searchable Operations view focused on a selected record type and one Review Center that links document, rating, and payment queues through consistent tabs and compact review rows; signup needs no application decision. Every user-authored operational entity is visible through a connected admin inventory and exposes the bounded correction, moderation, status, or ownership command appropriate to that entity. Administrators may delegate Customer, Operations, Trust, Billing, and Support responsibilities independently to platform team members without granting team-management or unrestricted administrator authority.
contracts: [AdminOperationsProjection, AdminOperationsView, AdminRecordSearch, AdminReviewQueue, PlatformTeamPermissionPolicy, SupportAgentManagement, UserActivationCommand, VehicleActivationCommand, SponsoredAccessCommand, AdminAudit]
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

### Scenario: admin inventory stays connected to user-side entities

Given users can create or change accounts, workspaces, Public Profiles, trucks, drivers, routes, service areas, network relationships, shipments, capacity, verification requests, reviews, payments, subscriptions, or support conversations\
When an administrator opens the relevant management area\
Then every current entity can be found from a bounded authoritative list and traced to its owning user or workspace\
And the administrator receives an appropriate inspect, correct, moderate, activate, suspend, expire, disconnect, or review command\
And immutable shipment events, audit records, message history, and accepted evidence are preserved as history rather than silently rewritten\
And every mutation is validated, attributed, timestamped, and audited.

### Scenario: dense administrative queues remain operable

Given verification requests, rating reports, or payment proofs contain many records\
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

Given an administrator needs to review trust, rating, or payment evidence\
When Review Center is opened\
Then Documents, Ratings, and Payments are reachable as consistent tabs\
And one selected queue is rendered at a time\
And the legacy application URL redirects to Operations because signup no longer needs approval\
And the browser Back action and tab links preserve understandable navigation.

### Scenario: administrator grants sponsored Business access

Given an existing Business workspace is selected in Operations\
When an administrator grants sponsored free access\
Then its subscription becomes Sponsored without an expiry\
And the action is audited\
And the command rejects transporter or self-managed driver workspaces.

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
And availability, active state, maximum open conversations, and Customer, Operations, Trust, Billing, and Support permissions are validated and audited\
And credentials are never redisplayed after creation\
And disabling an agent or removing Support permission returns their open conversations to the waiting queue for safe reassignment.

### Scenario: platform team permissions are least privilege

Given an administrator configures a platform team member\
When one or more management responsibilities are enabled\
Then navigation shows only the matching management areas\
And every page, query, mutation, file read, and review command independently enforces the same permission server side\
And Customer permission governs accounts and client profiles, Operations governs trucks, routes, network, shipments, and capacity, Trust governs documents and ratings, Billing governs plans and payment state, and Support governs customer conversations\
And only an administrator can create team members, change their permissions, or grant administrator authority\
And permission changes take effect on the next authorized request and are audited.

## Contract ownership

- Page: `/admin/operations`
- Application services: admin inventory and activation functions in `src/lib/repository.js`
- Inbound adapter: `/api/admin/records/[type]/[id]`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
