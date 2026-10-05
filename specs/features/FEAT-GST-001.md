---
id: FEAT-GST-001
title: Retained guest support history
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SUP-001, FEAT-ADM-001, FEAT-IAM-001]
problem: Public live support is retired; previous participants still need secure access to retained transcripts and attachments.
behavior: Public assistance is the asynchronous transport request in FEAT-TRQ-001. No new guest conversations or guest replies/uploads are accepted. Previous guests may recover read-only transcripts using their original email and recovery code. Staff with existing authorization may finish and close retained records; assignment, private history and attachment authorization remain intact. Dashboard live support for transport providers is governed by FEAT-SUP-001.
contracts: [GuestSupportIdentity, GuestConversationAccess, AssistedMatchingConversation, GuestSupportMessage, GuestSupportAttachment, GuestSupportProjection]
observability: [guest_conversation_access_denied, guest_conversation_closed]
rollout: Apply migration 108 after local rehearsal; verify HTTP and database denial, preservation of historical records and authorized downloads. Keep database policy during app rollback so old public clients still fail closed. Restoring public live support requires a new owner decision and reviewed function rollback. No history deletion or mass closure is authorized.
---

# Retained guest support

Owner policy, 2026-09-24: all transport-provider users retain live support in their
dashboards. Public visitors receive only the asynchronous transport request.
This supersedes the former public chat; earlier contracts remain in Git history.

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
