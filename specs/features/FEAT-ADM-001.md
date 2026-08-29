---
id: FEAT-ADM-001
title: Focused platform operations and review center
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-FTR-001, FEAT-SPN-001, FEAT-VER-001, FEAT-BIL-001, FEAT-REV-001, FEAT-SUP-001, FEAT-SHR-001, FEAT-GST-001]
problem: Platform administrators need to manage connected client records and several evidence queues without loading or navigating multiple unrelated inventories at once.
behavior: Administrators receive one bounded, searchable Operations view focused on a selected record type and one Review Center that links document, rating, and payment queues through consistent tabs and compact review rows; signup needs no application decision. Every user-authored operational entity is visible through a connected admin inventory and exposes the bounded correction, moderation, status, or ownership command appropriate to that entity. Administrators may delegate Customer, Operations, Trust, Billing, and Support responsibilities independently to platform team members without granting team-management or unrestricted administrator authority.
contracts: [AdminOperationsProjection, AdminOperationsView, AdminRecordSearch, ManagedPlatformAdminPort, AdminReviewQueue, PlatformTeamPermissionPolicy, SupportAgentManagement, UserActivationCommand, VehicleActivationCommand, SponsoredAccessCommand, AdminAudit]
observability: [admin_operations_read, admin_record_status_audit, denied_admin_command]
rollout: Add the inventory without changing tenant-facing visibility; status commands are reversible, audited, and deny non-admin callers.
---

# Platform operations

### Scenario: administrator inspects connected platform data

Given an authenticated platform administrator\
When Operations is opened or searched\
Then one selected bounded result set shows users, workspaces, trucks, Drivers, provider-owned Tracking, regular service, plans, or latest capacity from authoritative records\
And records are identified with transporter, truck platform number, Tracking code, and current status\
And private proof paths, passwords, session values, tracking secrets, and exact coordinates are absent.

### Scenario: admin inventory stays connected to user-side entities

Given users can create or change accounts, workspaces, Public Profiles, trucks, Drivers, regular service routes or areas, provider-owned Tracking, capacity, verification requests, reviews, payments, subscriptions, or support conversations\
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
And switching record type preserves a useful search term but does not render hidden inventory rows\
And the server reads the selected projection through a service-role-only Supabase function that independently verifies the actor's current platform permission\
And no local SQLite repository or fallback is consulted.

### Scenario: Review Center keeps related queues together

Given an administrator needs to review trust, rating, or payment evidence\
When Review Center is opened\
Then Documents, Ratings, and Payments are reachable as consistent tabs\
And one selected queue is rendered at a time\
And the legacy application URL redirects to Operations because signup no longer needs approval\
And the browser Back action and tab links preserve understandable navigation.

### Scenario: administrator manages Daily Featured Transporters and sponsorship

Given an administrator opens Daily Featured Transporters management\
When a date is selected\
Then its fixed regional group, public presentation fields, variable-length ordered regular roster, automatic or manual two-session livestream schedule, and eligible sponsored roster are managed together\
And ordinary featured positions and sponsored positions remain distinct\
And the administrator can add, remove, and reorder featured transporters without managing a fixed grid of empty positions\
And the administrator sees the complete Ethiopia-time timeline, including every provider interval, transition, Sponsor break, and four-hour midday intermission, before publishing\
And the automatic schedule shares presentation time equally, shortens low-participation sessions toward late morning and late evening, and may be regenerated after roster or break-setting changes\
And the administrator may switch to a validated manual schedule without changing featured-roster order\
And every published field and placement is bounded, validated, and audited\
And transporters cannot manage Daily Featured Transporters or sponsorship placement from their workspaces.

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

### Scenario: managed administrator commands remain atomic and reversible

Given an administrator or delegated platform team member submits an Operations command\
When the service-role-only managed command function receives the verified actor identifier, record type, record identifier, and bounded command\
Then PostgreSQL independently verifies the actor's current Customer, Operations, or Billing permission\
And account, Driver permission, truck, Capacity, regular-service, or plan changes complete atomically with their audit record\
And an unsupported command, missing record, self-suspension attempt, or insufficient permission changes nothing\
And suspending a Support team member safely returns their open conversations to the waiting queue.

### Scenario: administrator manages support agents

Given an authenticated administrator opens Support Team\
When the administrator creates or updates a support agent\
Then the agent receives only the SUPPORT role\
And the administrator supplies a name and email but never creates or sees a password\
And the managed Auth identity signs in through the same email-code or Google choices as other active accounts\
And availability, active state, maximum open conversations, and Customer, Operations, Trust, Billing, and Support permissions are validated and audited\
And disabling an agent or removing Support permission returns their open conversations to the waiting queue for safe reassignment.

### Scenario: platform team permissions are least privilege

Given an administrator configures a platform team member\
When one or more management responsibilities are enabled\
Then navigation shows only the matching management areas\
And every page, query, mutation, file read, and review command independently enforces the same permission server side\
And Customer permission governs accounts and client profiles, Operations governs trucks, Drivers, regular service, Tracking, and capacity, Trust governs documents and ratings, Billing governs plans and payment state, and Support governs customer conversations\
And only an administrator can create team members, change their permissions, or grant administrator authority\
And permission changes take effect on the next authorized request and are audited.

## Contract ownership

- Pages: `/admin/operations` and `/admin/featured`
- Application services: `src/lib/platform-admin.js` with the Supabase adapter in `src/lib/platform-admin/supabase.js`
- Inbound adapter: `/api/admin/records/[type]/[id]`
- Persistence: service-role-only managed admin projection and command functions with actor permission checks and atomic audit writes
- Tests: managed admin contract tests, local Supabase verifier, `tests/repository.test.mjs`, and `tests/e2e/smoke.spec.ts`
