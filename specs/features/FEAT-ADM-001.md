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

### Scenario: administrator enters one clear management workspace

Given an authenticated platform administrator enters Loadgistic administration\
When the administrator opens the workspace home or selects Overview\
Then `/admin` presents a compact platform overview rather than a generic client dashboard\
And Users, clients, trucks, Drivers, Tracking, Capacity, routes, and plans each show a direct count and link to their filtered record inventory\
And Featured and sponsors, private Capacity shared with Loadgistic, Review Center, customer Support, and platform-team management are directly reachable as named work areas\
And Record management is labelled Records rather than competing with a second vague Home or Operations destination\
And the selected destination remains understandable on desktop and phone.

### Scenario: administrator inspects connected platform data

Given an authenticated platform administrator\
When Records is opened or searched\
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

### Scenario: operation rows open bounded record details

Given an administrator or delegated platform team member can open one Records inventory\
When they select a user, workspace, truck, Driver, Tracking session, Capacity signal, regular-service record, or subscription row\
Then a real record-detail route opens inside the administrator shell\
And it identifies the selected record, its owning workspace or provider, current state, and only the related operational facts needed to investigate it\
And Tracking detail includes its bounded status-event timeline\
And the detail offers a clear return to the same inventory type without relying on a fake link or browser-only state\
And mutations remain separate explicit controls rather than making the whole row destructive.

Given the actor lacks the permission for that record type, the record does not exist, or its type and identifier do not match\
When the detail is requested directly\
Then the server returns no record detail\
And no credentials, OTPs, tracking or review secrets, recipient emails, proof references, exact coordinates, or unrelated tenant data are disclosed.

### Scenario: dense administrative queues remain operable

Given verification requests, rating reports, or payment proofs contain many records\
When an administrator searches, filters by status, or changes result pages\
Then the server returns one bounded page of matching records\
And terminal records do not render active review commands\
And the administrator can reach every matching record without rendering the entire queue at once\
And review controls remain collapsed until the administrator opens one record.

### Scenario: Records queries only the selected record type

Given the platform contains many operational records\
When an administrator opens Records or changes its record-type tab\
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
And the legacy application URL redirects to Records because signup no longer needs approval\
And the browser Back action and tab links preserve understandable navigation.

### Scenario: administrator manages Daily Featured Trucks and sponsorship

Given an administrator opens Daily Featured Trucks management\
When a date is selected\
Then its fixed truck-type theme, public presentation fields, exact ordered truck-and-Driver roster, automatic or manual 07:30–09:00 EAT schedule, and eligible sponsored roster are managed together\
And ordinary featured positions and sponsored positions remain distinct\
And the administrator can add, remove, and reorder featured transporters without managing a fixed grid of empty positions\
And the administrator sees the complete Ethiopia-time timeline, including every featured-truck interval and up to four programme interludes of no more than two minutes, before publishing\
And the automatic schedule shares presentation time equally, shortens low-participation sessions toward late morning and late evening, and may be regenerated after roster or break-setting changes\
And the administrator may switch to a validated manual schedule without changing featured-roster order\
And every published field and placement is bounded, validated, and audited\
And transporters cannot manage Daily Featured Trucks or sponsorship placement from their workspaces.

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

Given an administrator or delegated platform team member submits a Records command\
When the service-role-only managed command function receives the verified actor identifier, record type, record identifier, and bounded command\
Then PostgreSQL independently verifies the actor's current Customer, Operations, or Billing permission\
And account, Driver permission, truck, Capacity, regular-service, or plan changes complete atomically with their audit record\
And an unsupported command, missing record, self-suspension attempt, or insufficient permission changes nothing\
And a retired record command is rejected without referencing or recreating retired storage\
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

- Pages: `/admin`, `/admin/operations`, `/admin/featured`, `/admin/capacity-network`, `/admin/reviews`, and `/admin/support`
- Application services: `src/lib/platform-admin.js` with the Supabase adapter in `src/lib/platform-admin/supabase.js`
- Inbound adapter: `/api/admin/records/[type]/[id]`
- Persistence: service-role-only managed admin projection and command functions with actor permission checks and atomic audit writes
- Tests: managed admin contract tests, local Supabase verifier, `tests/repository.test.mjs`, and `tests/e2e/smoke.spec.ts`

## Bounded record recovery (F04, implementation)

Given an active administrator or delegated Customers team member opens a client
workspace record\
When they correct its business name with a reason and the observed name\
Then the server rechecks Customers permission, exact organization/provider kind,
input bounds and concurrent-change protection\
And updates only that business name with before/after audit evidence\
And authentication, handles, contacts, ownership, membership and historical events
are not editable through this action.

Given an Operations-authorized team member opens Tracking detail\
When the record permits recovery\
Then the same governed correction/reassignment/cancellation controls and SQL
rules used by providers are available, with a required reason and revision\
And the member may inspect its current approximate travel location only when
location sharing is enabled and the shipment is in an eligible travel state\
And historical assignment locations, exact device coordinates, recipients,
codes and private Storage paths are absent from the map projection.

Migration 091 adds the Customers-scoped workspace correction and narrow
Operations map; migration 090 supplies shared recovery. Both precede UI rollout.
No new broad admin editor or external authority. Rollback hides the controls while
retaining audit/recovery state. Required evidence: delegated permission, wrong
record kind, concurrent edit, location-state privacy and real desktop/phone
admin correction/recovery/map workflows.

### UI contract corrections — 2026-09-21

Given the administrator opens the Capacity inventory
When a row is Off Duty
Then its description says Off Duty and never describes an empty truck.

Given an administrator acts on a user or truck from a searched/paginated inventory
When the server reports success or denial
Then the same record type, search and page remain selected.

Implementation: derive capacity wording from stored status and include bounded
list context in every record action. Preserve existing backend authority and
mutation contracts. Focused desktop/phone checks exercise real controls and deny
unrelated actors; no remote changes. Rollback restores presentation only.

Given a saved Records URL points beyond the last result page
When the inventory loads
Then it recovers to the first bounded page of that search instead of claiming
there are no matching records and hiding pagination. Invalid page numbers use page one.

Given a provider publishes a regular-service area using the current polygon contract
When an administrator opens Routes or its detail
Then the area is labelled Service area around its center, not a route from a city
to itself. Route geometry retains its origin/destination presentation. Migration
101 adds only the existing geometry discriminator to the bounded admin list; no
coordinates or broader privileges. Verify area/route SQL and desktop/phone rendering.

### Review queue decision context — audit continuation, 2026-09-21

Given a reviewer opens a searched, status-filtered, paginated document/payment/rating queue
When a decision succeeds or the backend denies it
Then the response retains that queue, search, status and page context
And caller-provided return paths cannot redirect outside the matching Review Center tab.
And review notes and status persist through the existing authorized command; terminal
replays and callers without the required permission remain denied.

Given a stale or invalid page number is requested in any Review Center queue
When a bounded offset read returns no rows
Then an out-of-range page recovers to the first bounded page of the same filter
And genuinely empty queues remain empty; query failures are never disguised as empty data.

Plan: reuse bounded page normalization/recovery for the three existing queue
adapters, canonicalize Review Center return context, and pass it from each form.
No database privilege/state-machine changes. Verify pure URL/paging negatives and
actual desktop/phone review commands with disposable local records. Rollback
restores adapters/presentation while preserving review decisions and audit history.
