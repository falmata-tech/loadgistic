---
id: FEAT-TRQ-001
title: Private transport requests and brokerage conversations
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SUP-001, FEAT-GST-001, FEAT-SEC-001, FEAT-LNG-001]
problem: Visitors need to reach real brokerage staff and return to their conversation; staff need a private assigned queue with replies and offline follow-up.
behavior: Arrange transport collects route, name and phone then opens a durable private conversation, restored in the originating browser for seven days. Admin and explicitly authorized assigned Brokerage staff reply through their own queue, while call notes stay private. Active conversations update automatically through authorized APIs. Visitors may end messaging while retaining an open phone follow-up; staff distinguish active chats, follow-up and resolved requests. Older callback records remain phone follow-ups. General public Help remains retired and transport-provider dashboard Support is separate. No public demand, email, member account, automatic document approval, fee or shipment is created.
contracts: [TransportRequestInput, PrivateTransportRequestQueue, TransportRequestFollowUp, TransportChatAuthority, TransportChatSnapshot]
observability: [transport_request_created, transport_request_updated, transport_request_denied, transport_message_sent]
rollout: Apply additive migrations 103, 104, 110 and 111 with RLS and service-only RPCs before application release. Verify isolated SQL denial and desktop/phone submission-to-admin workflows, obtain visual review, then use normal release gates. Roll back the app while retaining private requests and history.
---

# Transport callback requests

### Scenario: a visitor requests transport

Given a visitor selects the floating Arrange transport button\
When they provide From, To, Name and a valid callback phone\
Then one private request is saved and an inline receipt confirms the team will follow up by phone\
And email, login, cargo details and provider selection are not required\
And no email, member, shipment, public market signal or provider message is created.

### Scenario: submission is bounded and recoverable

Given a blank, invalid, excessive, cross-origin or rate-limited submission\
When the API receives it\
Then it does not create a request and returns a safe error\
And the form retains its values, prevents concurrent submits and exits its busy state after a bounded timeout\
And retrying an identical request ID creates no duplicate\
And an ID reused with different data is rejected without disclosing the existing data.

### Scenario: an administrator follows up offline

Given an active administrator opens Support → Transport requests\
When they filter New, Contacted, Closed or All and navigate pages\
Then only a bounded page of private requests appears, newest first with stable ordering\
And each record shows its route, name, phone, time and current follow-up status\
And a phone link enables a call while a bounded internal note records an offline referral\
And Save persists the status and note, with concurrent edits rejected rather than overwritten\
And changing a status or reopening a request retains the original submission and audit history.

### Scenario: requests stay private

Given an anonymous visitor, transporter, staff without Brokerage permission or inactive administrator\
When they try to list or change requests through the application or database\
Then access is denied without exposing contacts\
And browser roles cannot read/write the table or execute its RPCs\
And server commands recheck current active staff capability and request assignment in PostgreSQL\
And audit events contain IDs/status only, not contact information or follow-up notes.

Tests: `tests/transport-requests.test.mjs`, `tests/sql/transport-requests.sql`,
`tests/e2e/transport-requests.spec.ts`, `tests/e2e/transport-request-api.spec.ts`, provider support and retained-history regressions.
NR-01–04/08/10/13 apply. Local implementation and focused verification precede
owner visual review; no production rollout is claimed by this spec.


### Separate teams and assignment — owner extension, 2026-09-24

Brokerage and Support are independent capabilities on existing staff accounts;
no brokerage permission is granted to existing staff automatically. An admin may
explicitly enable either or both. Existing SUPPORT is an internal staff identity,
not permission to enter either queue. Keep existing route aliases compatible.

Given an active brokerage staff member opens Brokerage
When they choose Unassigned or Mine and a status filter
Then only unassigned route summaries or their own full requests are returned
And another worker's assigned contacts, notes and history are not exposed
And unassigned contact information remains hidden until the worker claims it.

Given two workers claim the same unassigned request
When the commands compete
Then exactly one becomes its owner and the other receives a stale-change error
And closed requests cannot be claimed by staff.

Given an admin assigns, reassigns or releases a request
When the target is an active staff account with Brokerage permission
Then assignment is saved atomically with a version increment and private history
And inactive, non-brokerage or nonexistent targets are rejected
And staff cannot assign to others or take another worker's request.

Given a worker saves a call note or New/Contacted/Closed status
When they still own the request and retain Brokerage permission
Then the change is saved with actor/time in private append-only activity
And stale edits fail without overwriting work; no automatic mutation retries occur
And admin can reopen a closed request or release it for a new claim.

Given a staff account is suspended or loses Brokerage permission
When the change commits
Then its open transport requests return to Unassigned, retaining notes and activity
And previous ownership no longer permits reads or writes.

Given a provider submits dashboard Support or a visitor selects Arrange transport
When the request reaches the backend
Then provider questions, issues and disputes enter existing support assignment
And route/name/phone enquiries enter Brokerage without creating a support chat
And only explicitly enabled staff can access each queue; admin oversees both.

Migration 104 is additive: capability defaults false, assignment defaults null,
and private events retain current notes. Existing requests remain available to
admin. Local application targets only supabase_db_loadgistic-local. Application
rollback retains permissions, assignments and history; production migration needs
its separate backup/restore and release review. NR-01/02/03/08/10/13 apply.


Local verification (2026-09-24): `tests/sql/brokerage-assignment.sql` covers team
scope, redaction, ownership, stale updates, revocation/reopen, Support workload
and ACL denial. `tests/e2e/brokerage-workflows.spec.ts` covers real public-to-team
flows, staff login, handoff, closure, racing claims, conditional polling and dirty
assignment preservation on both viewport projects. Screenshots and pending owner
review are recorded in PROGRESS; production remains unchanged.

### Request transport is asynchronous, not a help chat — owner clarification

Given a visitor opens Arrange transport, including in a browser with an obsolete guest chat session
When the form or saved receipt is visible
Then no team-presence, waiting-agent, typing, reply-composer or chat-ending control
is shown for the transport request
And the close control says Close rather than Minimize chat
And the saved receipt says the team will call to discuss transport options
And submission creates only a Brokerage request, never a live-help conversation
And Brokerage follows New → Contacted → Closed with assignment and offline notes;
it does not send chat replies to the visitor.


### Managed transport wording — owner approved, 2026-09-24

Given a visitor chooses Arrange transport
When the request window opens
Then its title is “Let us arrange your transport” with no repeated service heading
And the description explains document review, shipment coordination and shared
progress for sender and receiver, without guarantees or blanket verification
And the service and fee will be confirmed before proceeding
And the four existing fields submit through “Send request”
And the receipt says the transport team will call to discuss the details.

This is the existing private Brokerage callback workflow. Submission itself does
not review documents, assign a truck, charge a fee, create a shipment, grant tracking
access or start live chat. Brokerage staff coordinate those next steps with the
customer; public wording must not imply they already happened. Dashboard Support stays separate.
No schema, permissions, fee collection or provider configuration changes.

Owner refinement (2026-09-24): use one title, “Let us arrange your transport”,
and the action “Send request”. Remove the duplicated Managed transport heading.


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


## Live brokerage conversation — owner decision, 2026-09-27

This supersedes the callback-only/no-composer constraints above for Arrange transport.
General public Help remains retired. Provider Support keeps its independent workflow.

1. Given the existing four-field form, when a visitor sends a request, then it is
   saved once and opens a persistent two-way brokerage conversation. No email,
   account, fee, shipment or automatic document approval is created.
2. Given the originating browser returns within seven days, when it opens Arrange
   transport, then a signed HttpOnly capability restores its conversation. A UUID,
   phone number or matching request fields alone cannot read or adopt a request.
   Legacy callback records cannot acquire a visitor capability. Expiry/clearing
   browser data ends this self-service access; the team retains the phone follow-up.
3. Given an active conversation, when either party sends text, then it is persisted
   before acknowledgement and appears automatically on the other side. Retry uses
   the same message ID and cannot duplicate or replace a message. Failed sends keep
   the draft. Bounded reads have older-history access and incremental catch-up.
4. Given a disconnected, background or closed panel, then updates pause/back off
   and resume with durable catch-up. Connection failures are visible; there are no
   fabricated online, typing, read, wait-time or attendance claims. Assignment is
   described as assignment, not proof of an online agent.
5. Given Brokerage staff, when they claim/open/reply, then existing independent
   permission and request ownership apply. Support-only staff and a different
   assignee cannot read or reply. Admin may oversee and reassign. Closure disables
   both composers; admin reopening restores replies. Internal notes, staff IDs and
   phone/name fields never appear in visitor message responses.
6. Given queues, then new visitor messages display Awaiting reply and bring the
   request forward. Staff can distinguish legacy phone requests from conversations.
   Conversation delivery does not silently rewrite call notes or status/version.
7. Given browser/database clients, then new tables/sequences/functions deny direct
   access, use RLS and service-only commands. Every API read/write reauthorizes.
   Cross-origin, excessive, stale-capability, wrong-record and revoked staff actions
   are denied. Audit records contain identifiers only, never message/contact text.

Transport: bounded 3-second foreground API polling initially, with conditional
responses and retries for reads only. This preserves the existing server-only data
boundary. Supabase Realtime is an optional future delivery adapter, requiring its
own private-channel identity/revocation tests; it is not enabled by this change.
Mobile clients will use the same application contracts after native auth is designed.
Migration 110 is additive and local-only until reviewed release. Existing callback
creation remains compatible. App rollback retains conversation history; no table drop.
Acceptance evidence: focused domain, SQL authorization/idempotency and two-browser
visitor/staff desktop/phone workflow tests before owner preview review.


Local evidence (2026-09-27): `tests/transport-chat.test.mjs`,
`tests/sql/brokerage-conversations.sql`, retained `brokerage-assignment.sql`,
`tests/e2e/brokerage-conversations.spec.ts` and updated `transport-requests.spec.ts`.
Conversation/browser recovery, wrong-record/role/reassigned/expired denial,
idempotent lost-acknowledgement retry, pagination, closure, reconnect/draft retention,
four non-English layouts and retained admin call-note workflow pass locally.
Catalog security denies direct browser relations, sequences and RPCs; new tables
are not in replication publications. Migration 110 is applied to the local database
only. Visual approval, full release gates and any production rollout remain pending.


### Live conversation entry — owner revision, 2026-09-27

Given a visitor sees Arrange transport, then its visible Live chat label and
conversation icon explain the interaction before opening. The panel has one title
and identifies the transport team; it never invents online presence or response times.
Given a new visitor, when they enter the existing four details and select Start chat,
then the existing protected request opens the conversation. No extra required field,
account, email, automatic message or new backend contract is introduced.
Given an empty open conversation, then a concise prompt asks about goods and pickup
time; replies appear automatically and the actual waiting/assignment state remains
visible. Closed conversations must not invite new messages.
Given desktop, phone or any supported locale, then Close, Start chat and the composer
remain reachable, text fits, and unsent details survive closing/reopening the panel.
Evidence: focused public-assistance-dock, transport-requests and
brokerage-conversations browser checks, plus localization and TypeScript checks.
Owner preview approval of this revision precedes resumed release gates.


### Visitor-ended chat and staff follow-up — approved intent, 2026-09-27

Ending messaging is separate from resolving the transport request. The owner
explicitly wants staff to retain contact details/history and call after a visitor
ends the chat. Keep the four-field intake and existing assignment permissions.

1. Given a waiting or assigned chat, when the visitor confirms End chat, then
   messaging stops for both parties, history remains, and the request stays open
   for a callback. Closing the window alone still only minimizes the conversation.
2. Given an ended chat, then the visitor can read its history and Start a new chat.
   Creating a new request does not delete, resolve or reassign the previous one.
3. Given an end command with wrong/missing/expired access, then deny it. Same-scope
   retries are idempotent; a lost acknowledgement must not falsely claim failure
   or duplicate history. End and send operations serialize on the request lock.
4. Given staff queues, then Active chats contains open, unexpired messaging;
   Follow-up contains ended/expired chats and legacy phone requests that are not
   resolved; Resolved contains closed requests. Ownership filters and pagination
   apply to each view, and ended chats never show Awaiting reply.
5. Given assigned Brokerage staff or an administrator, then the route summary,
   customer contact and retained chat history are available for a callback. Staff
   can record notes and set Resolved even if the visitor left before assignment.
   Other staff and visitors cannot read private contact/notes through chat APIs.
6. Given a resolved request, then both message composers are unavailable. Existing
   admin-only reopening of request follow-up remains; it does not reopen an ended
   visitor chat. Every transition retains history and identifiers-only audit.
7. Given phone/desktop and any supported language, then End chat confirmation,
   Keep chatting, Start a new chat, history and staff controls remain reachable.

Rollout: additive migration 111 after 110. RLS, browser-role denial and service-only
RPC remain mandatory. Rollback keeps new fields/history; do not drop stored chats.
Evidence required: rollback SQL for state/permissions/retries/queues, real two-party
browser flows for ending while waiting/assigned and staff callback/resolution,
translated narrow-phone checks, then owner local preview review before release.
