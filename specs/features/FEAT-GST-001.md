---
id: FEAT-GST-001
title: Retained guest support history
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SUP-001, FEAT-ADM-001, FEAT-IAM-001]
problem: Public live support is retired; previous participants still need secure access to retained transcripts and attachments.
behavior: Platform transport-arrangement chat is retired under FEAT-ENT/TRQ-001, alongside the earlier retired general public Help. No new general guest-support conversations or guest replies/uploads are accepted. Previous guests may recover read-only transcripts using their original email and recovery code. Staff with existing authorization may finish and close retained records; assignment, private history and attachment authorization remain intact. Dashboard live support for transport providers is governed by FEAT-SUP-001.
contracts: [GuestSupportIdentity, GuestConversationAccess, AssistedMatchingConversation, GuestSupportMessage, GuestSupportAttachment, GuestSupportProjection]
observability: [guest_conversation_access_denied, guest_conversation_closed]
rollout: Apply migration 108 after local rehearsal; verify HTTP and database denial, preservation of historical records and authorized downloads. Keep database policy during app rollback so old public clients still fail closed. Restoring public live support requires a new owner decision and reviewed function rollback. No history deletion or mass closure is authorized.
---

## October18 planned supersession — retire platform Brokerage

Implementation in progress under FEAT-ENT-001. The owner removed transport-
arrangement chat from every public, web, Expo, staff and admin surface. Platform
staff retain software Support and account management only. The separate brokerage
business will use an ordinary customer workspace, without platform privileges.
The special Share with Loadgistic grant and LOADGISTIC capacity audience retire.

Given old web/native clients, cookies, bearer sessions, URLs or service calls
When they request Brokerage intake, replies, assignment, polling, receipts, push
registration or special Loadgistic capacity
Then the application returns a retired/unavailable result and database authority
also denies the operation, preserving private history and audit records.

Given a platform staff member previously had only Brokerage responsibility
When the service retires
Then no Support or customer-workspace permission is granted automatically.

Given current software Support and unloading-approval notifications
When Brokerage is retired
Then their authorized workflows, read receipts and delivery remain available.

New evidence planned: `tests/platform-brokerage-retirement.test.mjs`,
`tests/sql/platform-brokerage-retirement.sql`; local rehearsal and actual browser
checks precede any separately reviewed hosted rollout. Older scenarios below are
historical and superseded for active Brokerage/LOADGISTIC behavior, not evidence
of its continuing availability. No private history erasure is included.


# Retained guest support

## October15 owner supersession — retire the remaining staff workload

The owner authorized removing old Guest support rather than preserving its
dashboard workflows. Current implementation work removes its staff entry pages
and prominent links. Because retained open guest records also consume Support
assignment capacity, a separate additive repair closes only those retired guest
records and records an administrative retirement audit. Provider Support and
Brokerage conversations, messages, assignments and limits remain unchanged.
Do not merely hide the workload count or leave inaccessible old records consuming
slots. Private records/files need not be destructively erased to retire this work;
no old third-service UI is retained on their behalf. The previous recovery and
staff-completion scenarios below document the earlier contract, superseded for
staff UI by this owner decision.

Given old general guest-support conversations are Waiting or Open\
When the reviewed retirement migration runs\
Then only those retired conversations become Closed with retirement audit\
And their assigned workload no longer prevents new Provider support assignment\
And all Provider support/Brokerage statuses, messages and audit history remain\
And public general-help creation/replies remain410\
And applying the migration again cannot duplicate closure or audit.

Tests: planned `tests/sql/retired-guest-workload.sql`; run an isolated rollback
rehearsal before installation. Hosted application remains separately reviewed.

Current policy: transport-provider users retain live support in their dashboards
under FEAT-SUP-001. Public transport-arrangement conversations are live Brokerage
work under FEAT-TRQ-001, which supersedes the September24 asynchronous intake.
General public help remains retired. These retained transcripts are not a third
current service; staff completion and authorized guest read-only recovery remain.
Earlier contracts remain in Git history. October15 source review confirms retired
creation/current endpoints return410; this correction changes documentation only.

### Scenario: retired public chat cannot create staff work

Given a visitor or stale browser has an old guest session
When it calls guest creation, message or polling endpoints
Then the request returns 410 without creating messages, attachments or email
And the public launcher never restores chat, requests presence or polls for replies
And service-only create/reply commands also deny guest writes in PostgreSQL.

### Scenario: authorized recovery preserves history

Given an existing conversation remains within its retention period
When its guest submits the correct email and original recovery code at /help
Then the private transcript opens read-only without a reply/upload composer
And no live polling runs, even for records whose staff status is still Open
And invalid recovery, other guests and unassigned staff cannot read it
And no new recovery email or public contact record is created.

### Scenario: retained messages and files remain reachable

Given an authorized guest or assigned staff member opens a retained conversation
When they page older messages
Then bounded windows preserve chronological order and offer Latest messages
And incoming staff messages do not shift the historical window
And every attachment download checks current conversation authorization
And loss of staff assignment immediately revokes transcript and file access.

### Scenario: staff finish retained work

Given a staff member has Support permission and the required assignment
When they reply to or close an old record
Then existing message, workload and terminal-state rules apply
And an administrator retains existing assignment oversight
And no records are deleted, closed in bulk or reassigned by migration 108.

Tests: `tests/provider-support-policy.test.mjs`,
`tests/sql/provider-only-support.sql`, `tests/sql/support-history.sql`,
`tests/e2e/assisted-chat-audit.spec.ts`, `tests/e2e/public-assistance-dock.spec.ts`,
`tests/e2e/support-history.spec.ts`, `tests/e2e/brokerage-workflows.spec.ts`.
NR-03/08/13: database denial and real browser flows must pass; owner visual review
precedes full release checks. Local implementation does not claim hosted rollout.
