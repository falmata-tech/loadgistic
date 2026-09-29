---
id: FEAT-SUP-001
title: Transport-provider support inbox
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-ADM-001, FEAT-GST-001, BASE-DEP-001]
problem: Members need simple in-app help while platform owners need bounded assignment, scoped support-agent access, and accountable resolution without per-agent fees or a second operational platform.
behavior: Loadgistic presents signed-in Support as a simple New chat, Continue chat, and Past chats workflow; stores authoritative conversations, messages and private optional reply attachments; lets either participant end an owned chat; routes one open conversation to the least-loaded available support agent within an explicit limit; and keeps support authority separate from platform administration. New member conversations and replies require TRANSPORTER or DRIVER, including company and self-managed drivers. FEAT-GST-001 retains historical guest conversations for authorized read-only guest access and staff closure; no new public chat is accepted.
contracts: [SupportConversation, SupportMessage, SupportCategory, SupportAgentState, SupportQueueAssignment, SupportAccessPolicy, SupportAudit]
observability: [support_conversation_created, support_message_sent, support_conversation_assigned, support_conversation_claimed, support_conversation_closed, support_agent_availability_changed, support_assignment_capacity_reached, denied_support_access]
rollout: Use actor-scoped Supabase PostgreSQL commands in local development, Preview, and Production with visibility-aware bounded refreshes and message/query windows; durable database records remain authoritative so authorized Realtime notifications can be enabled without changing ownership, and managed failure never falls back to SQLite.
---

# Customer support inbox

### Scenario: every retained message remains reachable

Given an authorized member or staff actor opens a conversation with more than 50 messages\
When Older messages is selected\
Then a bounded preceding window is shown in chronological order with a Latest messages action\
And a conversation-scoped message cursor orders equal timestamps by message ID\
And new replies do not shift or duplicate the historical window\
And historical reads do not mark unseen current messages as read or refresh back to the latest window\
And missing, malformed, or cross-conversation cursors fail without disclosing another conversation\
And every request repeats current authorization, including closed conversations.

Implementation: additive service-only history RPCs, a 50-message window, shared
history navigation on member/staff pages, and bounded public-chat history state.
Verify with `tests/support-history.test.mjs`, rollback SQL
`tests/sql/support-history.sql` and `tests/e2e/support-history.spec.ts`.
This history checkpoint adds no push transport or retention-policy change.
Member reply attachments are specified separately below.

### Scenario: authenticated member requests help

Given an active signed-in Fleet Transporter, owner-operator, self-managed Driver or company Driver has no open support conversation\
When the member selects a short help category and starts a conversation\
Then one open conversation owned by that user is created\
And the first message is stored with a bounded body\
And the conversation is assigned to the least-loaded available agent when capacity exists\
And the redirect immediately renders that stored message inside the member's active chat\
And no shipment, tracking, verification, location, or payment record is copied into chat automatically.

### Scenario: support agents receive bounded work

Given multiple available customer-service agents and queued conversations\
When automatic assignment runs\
Then an agent at the configured open-conversation limit receives no additional conversation\
And closing a conversation frees one assignment slot\
And an availability change passes only the bounded remaining integer capacity into automatic assignment\
And equal-load agents are selected by the oldest assignment time\
And assignment, claim, availability, and closure remain visible in the support audit trail.

### Scenario: customer and agent reads are scoped

Given a support conversation exists\
When its customer, assigned support agent, or administrator opens it\
Then only the latest bounded message window and safe participant identity are returned\
And an unrelated customer or unassigned support agent receives no conversation\
And no account phone, password, tracking code, exact location, or private document is projected.

### Scenario: member conversations remain easy to find

Given a member has an active conversation and any number of closed conversations\
When the member opens Support or pages through conversation history\
Then the active conversation is fetched independently of the bounded history page\
And it cannot be hidden by a newer closed conversation or pagination\
And Support first shows one clear Continue chat action plus a separate bounded Past chats list\
And an owner may end the active chat so New chat becomes available immediately\
And when no active chat exists, New chat remains visible even when closed history exists\
And each history row shows status, update time, message count, and a short latest-message preview\
And selecting an owned closed conversation opens its read-only message history\
And another member's conversation remains inaccessible.

### Scenario: support authority is not administration

Given a staff user has only the Support responsibility\
When they request billing, Operations, customer account administration or Brokerage\
Then access is denied unless an administrator separately enabled that responsibility\
And adding Featured does not revoke any independently assigned permission.

### Scenario: message and lifecycle mutations remain strict

Given an open support conversation\
When the owning customer or assigned agent sends a non-empty message\
Then the body is length bounded, rate limited, stored once, and updates unread state\
And the owning member, assigned agent, or administrator may close it\
And closed conversations reject new messages\
And denied mutations write no success audit.

### Scenario: administrator triages support work

Given support conversations exist in Waiting, Open, and Closed states\
When an administrator opens Customer Support\
Then status tabs filter a bounded server page of safe conversation summaries\
And each row shows the customer workspace, topic, latest message preview, update time, assigned agent, and state\
And agent capacity and permissions remain managed separately from the conversation queue.

### Scenario: waiting work can be claimed

Given no available agent had capacity when a member opened a conversation\
When an available support agent below their limit claims the oldest waiting conversation\
Then assignment is atomic\
And another agent cannot claim the same conversation\
And the member sees the assigned agent name after refresh.

Given a waiting conversation cannot yet be opened by the current staff actor\
When its queue row is rendered\
Then the conversation identity is plain content rather than a link to `#` or another dead destination\
And only an authorized Claim action is presented\
And an Open action appears only when the actor can actually open the conversation detail.

### Scenario: compact refresh preserves performance

Given a customer or agent keeps one conversation open\
When the page is visible\
Then it refreshes at a bounded interval\
And pauses refresh while hidden\
And each response contains at most 50 recent messages\
And queue and history lists use server pagination and supporting indexes.

### Scenario: managed Support is actor scoped and durable

Given local development, Preview, or Production uses the managed runtime\
When a member, assigned Support actor, or administrator reads or changes Support state\
Then the active application route uses the dedicated Support port and Supabase PostgreSQL\
And PostgreSQL repeats active-role, ownership, assignment, Support-permission, capacity, open-state, message-limit, and terminal-state checks\
And member history, staff queues, conversations, messages, and team lists are bounded independently\
And assignment or requeue decisions are atomic across member and Assisted matching conversations\
And browser roles cannot execute the service-only actor commands directly\
And managed failure never falls back to SQLite.

## Contract ownership

### Scenario: team creation authorizes before external identity creation

Given a caller requests creation of a Support team member\
When the caller is missing, inactive, not an administrator, or cannot be verified against current persisted authority\
Then no Supabase Auth identity is created or deleted\
And authorization failure is returned before any external mutation\
And the database command independently repeats the administrator check on successful requests.

- Pages: `/app/support`, `/support`, `/support/[id]`, `/admin/support`
- Application services: dedicated managed Support application port
- Inbound adapters: `/api/support/*` and `/api/admin/support-agents`
- Persistence adapter: actor-scoped Supabase PostgreSQL commands extending migration `008`
- Tests: managed Support contract and live Supabase verifier, domain authorization/routing, E2E customer/agent flow, and desktop/mobile UI audit

Team-creation repair evidence: `tests/team-authorization.test.mjs` verifies
persisted active administrator authority and its position before external Auth
creation. Existing SQL denial remains mandatory; no new schema or provider is
introduced. Do not roll back to late authorization while team creation is enabled.

## Private member reply attachments (verified locally)

Given an active member owns an open Support conversation, or current assigned
Support staff with Support permission or an administrator can reply\
When they send a required non-empty message with one optional JPEG, PNG, WebP
or PDF of at most the configured four-MiB ceiling\
Then the server checks current conversation permission before any Storage write\
And the file passes existing private quarantine/inspection checks\
And the message and its attachment become visible atomically after upload\
And permission, assignment, open-state and rate limits are rechecked at commit.

Given an attached message exists in recent or older history, including a closed chat\
When a current permitted participant follows its download link\
Then the server reauthorizes the conversation and exact attachment on every read\
And serves the file as a no-store, nosniff download\
And another member, unassigned/reassigned/inactive staff or anonymous visitor
cannot read the bytes or private Storage path\
And message projections contain only the attachment ID and safe display metadata.

Given Storage, inspection or message attachment fails or a response is ambiguous\
When cleanup runs\
Then an already attached file is never deleted speculatively\
And reserved unfinished uploads remain registered until failed/stale cleanup\
And unacknowledged Storage writes retain a one-hour grace period before cleanup\
And cleanup claims at most 20 unattached objects with retryable deletion state\
And metadata is removed only after object deletion succeeds\
And closed chat history retains attached files; no retention policy is changed.

Contracts: additive migration 089, service-only reservation/commit/read/cleanup
RPCs and private `support-attachment/member-support/` objects. Browser table/RPC
access remains denied. Message audits contain no file path/name/body. Rollout
requires 089 before UI/worker publication; UI rollback retains metadata and
cleanup. Future conversation/account deletion must explicitly drain files first.
No new vendor, bucket or push transport. Tests: `tests/support-attachments.test.mjs`,
`tests/sql/support-attachments.sql`, `tests/e2e/support-attachments.spec.ts`.

Local evidence: five input/cleanup tests, rollback SQL authorization/lifecycle
checks, and desktop/phone browser uploads and byte-verified downloads passed.
Invalid signatures create no message and retain retryable grace-period metadata
until cleanup succeeds; assigned staff,
reassignment denial, cross-conversation/member/anonymous denial and closed older
history were exercised against local Auth/PostgreSQL/Storage. Six screenshots
are retained under `artifacts/support-attachments-2026-09-14/`; owner visual
approval and hosted rollout are not claimed. Final gates: BUILD_VERIFICATION.

## Incremental polling (verified locally; hosted rollout separate)

Given a visible current conversation or staff queue is polling\
When its authorized state has not changed\
Then a lightweight revision request returns HTTP 304 without transcript or page refresh\
And current membership, assignment, permission or guest digest is checked before the revision comparison\
And a changed message, assignment, closure or queue state triggers a bounded fresh projection\
And read receipts alone do not cause repeated full transcript refreshes\
And requests do not overlap, hidden tabs and older history pause, and failures back off\
And a failed or denied request never reports a successful unchanged state or clears a draft.

The selected F05 transport is incremental polling, as permitted by the audit;
no Realtime channel or new provider is required. Migration 094 introduces a
service-only conversation revision port. Rollout requires it before clients;
rollback restores polling without changing messages or attachments. SQL denial,
conditional HTTP, visibility/backoff and browser draft tests remain required.

## Private transport request inbox

FEAT-TRQ-001 adds an ADMIN-only Transport requests list linked from Customer
Support. It retains phone follow-up and referral notes separately from member
and guest conversations, assignment limits and email delivery.

Brokerage permissions and transport request ownership are independent of Support;
see FEAT-TRQ-001. Staff shells must receive their persisted permissions, and a
brokerage-only login opens Brokerage rather than an unauthorized Support page.

### Scenario: staff setup remains usable on phones

Given an administrator opens Add member on a phone\
When they select Support or Brokerage and scroll the form\
Then Create member stays above fixed navigation and is reachable with a normal tap.

Featured is a separate default-off team responsibility (FEAT-FTR-001, migration
106). Admin creation/edit forms persist it and log the grant/revocation. A
Featured-only member signs in to Featured, with no Support/Brokerage or other
administrative access. Negative SQL and real browser grant/revoke checks are in
`tests/sql/featured-team-permission.sql` and
`tests/e2e/featured-team-permission.spec.ts`.


### Provider-only live support — owner policy, 2026-09-24 (supersedes public chat)

Given a public visitor (including a returning browser with an old chat session)
When they browse or request assistance
Then only Arrange transport → Send request is offered as an asynchronous Brokerage
request, with no Help launcher, chat polling, presence, composer or internal switch.
Public chat creation and guest replies are denied before uploads/email, including
stale clients and direct API/database commands. Existing private transcripts and
attachments remain accessible with their original authorization; no history is deleted.
Staff may finish/close existing records without accepting new guest messages.

Given an active transport company user, company driver or self-managed owner-driver
When they open dashboard Support
Then existing live conversations, attachments, staff assignment and history work.
New member conversations/replies require TRANSPORTER or DRIVER; staff retain their
existing scoped permissions. SHIPPER/RECEIVER and anonymous users cannot bypass
this through member endpoints. Database commands enforce the same actor scope.

Migration 108 changes commands only, preserving tables, records, assignments and
ACLs. Apply locally first; retain protected function definitions for reviewed rollback.
Full gates and hosted changes follow owner visual approval and release authorization.


### Scenario: providers can find support with limited plan access

Given an active transport provider has no current plan or limited billing access
When they open their dashboard on a phone or desktop
Then Support remains available in navigation and the More menu
And they can start or continue the same authorized support conversation
And this does not unlock paid capacity, fleet or shipment actions.
Tests: `tests/e2e/provider-support.spec.ts` enters Support from limited dashboard navigation.
