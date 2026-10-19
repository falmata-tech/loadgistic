---
id: FEAT-ADM-001
title: Focused platform operations and review center
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-FTR-001, FEAT-SPN-001, FEAT-VER-001, FEAT-BIL-001, FEAT-REV-001, FEAT-SUP-001, FEAT-SHR-001, FEAT-GST-001]
problem: Platform administrators need to manage connected client records and several evidence queues without loading or navigating multiple unrelated inventories at once.
behavior: Administrators start with a bounded searchable Accounts directory and one account overview grouping its exact related business, fleet, documents and work according to independent current permissions. Purposeful operational inventories remain available, alongside one Review Center that links document and rating queues through consistent tabs and compact review rows; signup needs no application decision. Every user-authored operational entity is visible through a connected admin inventory and exposes the bounded correction, moderation, status, or ownership command appropriate to that entity. Administrators may delegate Customer, Operations, Trust and Support responsibilities independently to platform team members without granting team-management or unrestricted administrator authority.
contracts: [AdminOperationsProjection, AdminOperationsView, AdminRecordSearch, ManagedPlatformAdminPort, AdminReviewQueue, PlatformTeamPermissionPolicy, SupportAgentManagement, UserActivationCommand, VehicleActivationCommand, SponsoredAccessCommand, AdminAudit]
observability: [admin_operations_read, admin_record_status_audit, denied_admin_command]
rollout: Add the inventory without changing tenant-facing visibility; status commands are reversible, audited, and deny non-admin callers.
---

# Platform operations

### Scenario: administrator enters one clear management workspace

Given an authenticated platform administrator enters Loadgistic administration\
When the administrator opens the workspace home or selects Overview\
Then `/admin` presents a compact platform overview rather than a generic client dashboard\
And Accounts is the primary directory for people and their related business/work\
And separate truck, Driver, Tracking, Capacity and route inventories serve operational tasks\
And Featured and sponsors, private Capacity shared with Loadgistic, Review Center, customer Support, and platform-team management are directly reachable as named work areas\
And account management is labelled Accounts rather than database-shaped Users and Clients directories\
And the selected destination remains understandable on desktop and phone.

### Scenario: administrator inspects connected platform data

Given an authenticated platform administrator\
When Accounts is opened or searched\
Then the default bounded directory shows people with their provider context\
And selecting a person opens its organized account overview\
And explicitly selected operational views retain authorized truck, Driver, Tracking, route or capacity inventories\
And records are identified with transporter, truck platform number, Tracking code, and current status\
And private proof paths, passwords, session values, tracking secrets, and exact coordinates are absent.

### Scenario: admin inventory stays connected to user-side entities

Given users can create or change accounts, workspaces, Public Profiles, trucks, Drivers, regular service routes or areas, provider-owned Tracking, capacity, verification requests, reviews or support conversations\
When an administrator opens the relevant management area\
Then every current entity can be found from a bounded authoritative list and traced to its owning user or workspace\
And the administrator receives an appropriate inspect, correct, moderate, activate, suspend, expire, disconnect, or review command\
And immutable shipment events, audit records, message history, and accepted evidence are preserved as history rather than silently rewritten\
And every mutation is validated, attributed, timestamped, and audited.

### Scenario: operation rows open bounded record details

Given an administrator or delegated platform team member can open one Records inventory\
When they select a user, workspace, truck, Driver, Tracking session, Capacity signal, or regular-service record\
Then a real record-detail route opens inside the administrator shell\
And it identifies the selected record, its owning workspace or provider, current state, and only the related operational facts needed to investigate it\
And Tracking detail includes its bounded status-event timeline\
And the detail offers a clear return to the same inventory type without relying on a fake link or browser-only state\
And mutations remain separate explicit controls rather than making the whole row destructive.

Given an administrator opens a company Driver record\
When they select Open owner\
Then the link names that Driver's exact organization and its ORGANIZATION record kind\
And the destination repeats Customers permission and exact record-kind checks\
And an Operations-only actor receives no unauthorized workspace detail.

Given the actor lacks the permission for that record type, the record does not exist, or its type and identifier do not match\
When the detail is requested directly\
Then the server returns no record detail\
And no credentials, OTPs, tracking or review secrets, recipient emails, proof references, exact coordinates, or unrelated tenant data are disclosed.

### Scenario: dense administrative queues remain operable

Given verification requests or rating reports contain many records\
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

Given an administrator needs to review trust documents or rating evidence\
When Review Center is opened\
Then Documents and Ratings are reachable as consistent tabs\
And retired Payments are not an active review queue, as required by FEAT-BIL-001\
And one selected queue is rendered at a time\
And the legacy application URL redirects to Records because signup no longer needs approval\
And the browser Back action and tab links preserve understandable navigation.

### Scenario: administrator manages Daily Featured Trucks and sponsorship

Given an administrator opens Daily Featured Trucks management\
When a date is selected\
Then its fixed truck-type theme, public presentation fields, exact ordered truck-and-Driver roster, automatic or manual 08:30–12:00 EAT schedule, and eligible sponsored roster are managed together under FEAT-FTR-001\
And ordinary featured positions and sponsored positions remain distinct\
And the administrator can add, remove, and reorder exact truck-and-Driver pairs without managing a fixed grid of empty positions\
And the administrator sees the complete Ethiopia-time timeline, including every featured-truck interval and up to four programme interludes of no more than two minutes, before publishing\
And the automatic schedule shares the remaining presentation time equally inside the official daily window, using up to eight showcases and four two-minute sponsor mentions by default\
And a smaller eligible roster receives fewer, longer showcase intervals rather than a second evening session\
And the administrator may switch to a validated manual schedule without changing featured-roster order\
And every published field and placement is bounded, validated, and audited\
And transporters cannot manage Daily Featured Trucks or sponsorship placement from their workspaces.

### Scenario: administrator suspends or restores an account

Given an authenticated administrator or delegated Customers member selects a
provider account other than their own\
When they suspend or restore access\
Then the user's active state changes\
And the actor, target, resulting state, and time are audited\
And a caller without the required responsibility or a self-suspension attempt
changes nothing\
And only an administrator may change access for administrator or staff accounts.

Given a delegated Customers member inspects another administrator or staff account\
When the account's saved details are rendered\
Then its activation is read-only and no suspend/restore task or command form is mounted\
And this follows the actor's persisted current authority rather than a cached role\
And provider/customer activation and disabled self-account controls remain unchanged.

Given an administrator inspects a staff account\
Then the existing Platform team management area is reachable from that account.

### Scenario: suspending and restoring staff preserves assigned responsibilities

Given a staff member has explicit Support, Brokerage, Featured or other delegated
management responsibilities\
When an authorized administrator changes only that account's active state from
Records and later restores it\
Then every responsibility flag retains its previous value\
And restoration does not silently remove Brokerage or Featured access\
And suspension retains the current safe return of open chats to their waiting
queues, with audit attribution and no message-history deletion\
And only the explicit team-permission editor changes assigned responsibilities\
And an activation change serializes with an overlapping explicit permission save,
so it reads the current flags instead of overwriting them with a stale snapshot\
And unauthorized, self-suspension, stale-authority or unsupported commands retain the
existing denial behavior and change no unrelated account.

October13 audit: the generic User activation command forwards an older five-flag
staff snapshot and the later updater defaults the two missing responsibilities
to false. Its initial staff snapshot is also unlocked before the updater locks
the row. Additive142 passes old-failing/new-passing isolated SQL and a real
two-session serialization test. The exact owner-approved repair is installed on
the local preview with preserved function permissions, rows and ledger; staff
and141 identity integration checks pass in rollback-only transactions. Actual
staff browser maintenance and hosted rollout remain separate evidence.

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
And account, Driver permission, truck, Capacity, or regular-service changes complete atomically with their audit record\
And an unsupported command, missing record, self-suspension attempt, or insufficient permission changes nothing\
And a retired record command is rejected without referencing or recreating retired storage\
And suspending a Support team member safely returns their open conversations to the waiting queue.

### Scenario: Operations controls persist the exact selected resource

Given an active Operations-only team member opens a disposable Driver, Capacity,
or truck-bound regular-service record on desktop or phone\
When they save Driver permissions, set the selected Capacity Off Duty, or remove
that truck-and-Driver pair's regular service through the existing form\
Then the saved detail or destination reports the command result\
And only the selected permissions, Capacity, or regular-service record changes\
And current Driver assignment, other trucks' signals and routes, and unrelated
account permissions remain unchanged\
And each accepted command has the existing actor-attributed audit entry.

Given one of those forms was opened while Operations permission was granted\
When that permission is revoked before submission\
Then its actual stale submission is denied without saving the command or its
success audit\
And the same commands from an unrelated provider remain denied.

Focused acceptance: `tests/e2e/operations-connected-actions.spec.ts`. These tests
exercise existing controls; preparation or source inspection alone is not actual
browser evidence. No new management capability or hosted operation is included.

October14 actual local evidence: both desktop/phone Records cases pass permission
saves, Off Duty, selected truck-route removal, current Operations authority,
provider denial, all three revoked stale forms, actor-attributed audits and
unrelated-row preservation. Exact synthetic Auth/database/file cleanup is verified.
Receipt: `.local/operations-connected-actions-20261014/records-controls-desktop-phone-runner.json`.
The initial zero-fixture failure was a test worker with unset `NODE_ENV`, not an
application email fault; the preflight now evaluates the explicit local test
environment without changing global or server configuration. Full release gates,
owner review of the wider UI changes and hosted rollout remain separate.

### Scenario: administrator manages support agents

Given an authenticated administrator opens Support Team\
When the administrator creates or updates a support agent\
Then the agent receives only the SUPPORT role\
And the administrator supplies a name and email but never creates or sees a password\
And the managed Auth identity signs in through the same email-code flow as other active accounts\
And availability, active state, maximum open conversations, and Customer, Operations, Trust, Billing, and Support permissions are validated and audited\
And disabling an agent or removing Support permission returns their open conversations to the waiting queue for safe reassignment.

### Scenario: platform team permissions are least privilege

Given an administrator configures a platform team member\
When one or more management responsibilities are enabled\
Then navigation shows only the matching management areas\
And every page, query, mutation, file read, and review command independently enforces the same permission server side\
And Customer permission governs accounts and client profiles, Operations governs trucks, Drivers, regular service, Tracking, and capacity, Trust governs documents and ratings, historical Billing grants govern protected archived proof reads only (FEAT-BIL-001), and Support governs customer conversations\
And only an administrator can create team members, change their permissions, or grant administrator authority\
And permission changes take effect on the next authorized request and are audited.

### Scenario: owner administrator creates web-only chat staff

Given the configured owner administrator signs in with a verified email code\
When they create a Support agent or Transport agent\
Then the account receives the existing SUPPORT staff identity with only the
selected Support and/or Brokerage responsibility\
And it receives no administrator, billing, customer, operations, trust or Featured
authority from that selection\
And each staff member signs in to their authorized web queue using an email code\
And verified administrator login goes directly to Administration rather than
passing through a provider Home\
And staff cannot create other staff or grant themselves permissions\
And the owner administrator, Support agent and Transport agent cannot obtain a
mobile account session through either email-code verification or refresh\
And a web bearer session cannot read mobile workspace endpoints\
And rejection closes only the attempted session, preserving an existing web login.

Evidence: `tests/e2e/staff-admin-account.spec.ts`,
`tests/mobile-identity.test.mjs` and `tests/team-authorization.test.mjs`.
Production identity inventory and local provisioning are operational evidence;
they do not authorize deleting an unrelated identity or its retained history.

## October15 account-first administration — corrective work in progress

The owner rejected database-shaped navigation. Administration starts with people
and provider accounts; one account overview groups its actual related records
and permitted commands. Separate Trucks, Drivers and GPS inventories serve
cross-account operational tasks, not a requirement to reconstruct an account.
FEAT-UIX-001 defines the presentation acceptance. Existing independent Customers,
Operations, Trust, Support, Brokerage and Featured permissions remain unchanged.
The composite read port must authorize each section independently, bound related
lists and exclude raw location, credentials, unrelated chats and private files.
No database identity/ownership merge or hosted SQL is authorized by this cleanup.

Tests: focused composite adapter scope/denial/empty/limit checks and actual admin
account navigation/read/edit/cancel on desktop and phone; implementation and owner
visual review are pending. Existing completed evidence does not cover this view.

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

Given Operations detail needs the shared Tracking map's route contract\
When its map adapter runs\
Then the existing `admin_tracking_location` command first authorizes the actual
actor and exact shipment, and a denied or absent result performs no additional read\
And only an authorized result permits an explicit read of the saved pickup,
passing and delivery city references, labels, coordinates and tracking mode\
And the same command rechecks current Operations authority, shipment state and
assignment reset after that read, supplying the final status and obscured location\
And a revoked or absent final result renders no map\
And the page converts the bounded result through `trackingMapData`, preserving
the genuine saved passing city and authorized radius\
And it reads no recipients, proof paths, private contacts or raw device location,
uses no `select *`, impersonation or revoked projection helper, and invents no
public truck summary or new permission.

Focused adapter evidence: `tests/admin-tracking-map-contract.test.mjs`; actual
desktop/phone map evidence: `tests/e2e/lifecycle-recovery.spec.ts`. These must
establish the narrow conversion separately. This repair introduces no schema,
layout or feature change; malformed saved routes retain the existing safe
projection behavior.

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

Given a reviewer opens a searched, status-filtered, paginated document/rating queue
When a decision succeeds or the backend denies it
Then the response retains that queue, search, status and page context
And caller-provided return paths cannot redirect outside the matching Review Center tab.
And review notes and status persist through the existing authorized command; terminal
replays and callers without the required permission remain denied.

Given a stale or invalid page number is requested in any Review Center queue
When a bounded offset read returns no rows
Then an out-of-range page recovers to the first bounded page of the same filter
And genuinely empty queues remain empty; query failures are never disguised as empty data.

Given permitted staff open the Content reports queue with an invalid or out-of-range page\
When its bounded authoritative read completes\
Then invalid pages use page one and an empty later page recovers at most once to page one\
And existing reports, their current moderation controls, and usable pagination remain visible\
And a genuinely empty queue remains empty while either read failure is reported as unavailable\
And the existing Trust permission and moderation commands remain unchanged.

Given the content queue's requested later range is beyond the available records\
When the authoritative API returns its specific out-of-range response rather than an empty array\
Then that response permits the same single bounded first-page recovery\
And first-page range errors, authorization failures and other unavailable responses remain failures without retrying them as empty data.

October14 bounded repair (WEB-MOB-033/034): actual page-component regressions
prove the Driver owner destination and content/deletion queue failures, including
PostgREST416 and unavailable/authorization negatives;16 focused checks pass with
the existing windowed-page reader. Four real desktop/phone cases in
`tests/e2e/admin-connected-queues.spec.ts` verify exact owner subject, overflow and
fractional queues, preserved controls and permission denials. Sanitized receipt:
`.local/internal-workflows-20261014/admin-connected-complete-runner.json`. Owner
visual approval remains pending; no SQL, API authority, remote deployment or
data-mutation expansion is included. Root records final evidence in TRACEABILITY.
The independent review-publication conflict
WEB-MOB-035 has an isolated-tested migration143 artifact and remains pending
separately reviewed local installation and actual moderation-form verification.

Plan: reuse bounded page normalization/recovery for the three existing queue
adapters, canonicalize Review Center return context, and pass it from each form.
No database privilege/state-machine changes. Verify pure URL/paging negatives and
actual desktop/phone review commands with disposable local records. Rollback
restores adapters/presentation while preserving review decisions and audit history.
