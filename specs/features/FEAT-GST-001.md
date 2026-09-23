---
id: FEAT-GST-001
title: Anonymous assisted-matching conversations
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SUP-001, FEAT-ADM-001, FEAT-IAM-001]
problem: Account-free visitors may want Loadgistic to help identify suitable transporters without completing a shipment form or publishing demand.
behavior: A visitor starts a private Assisted matching conversation with a required email, required callback phone, and bounded message. The persistent public-shell launcher is the primary chat surface; it opens a compact desktop dialog or mobile sheet and restores the active session across public route changes and browser refreshes. It enters the existing support assignment workflow without creating a user account or public demand record. Available agents are assigned immediately, active conversations refresh automatically at a fast bounded interval, and the guest may attach specifically requested private images or PDFs. The guest or team may end the chat; its retained transcript becomes read-only and the guest may start a distinct new session. Local and managed deployments use visibility-aware bounded polling with backoff; neither claims push delivery. Realtime remains a future transport choice. Loadgistic presents this as assisted matching, not a service guarantee or transaction handler.
contracts: [GuestSupportIdentity, GuestConversationAccess, AssistedMatchingConversation, GuestSupportMessage, GuestSupportAttachment, GuestSupportProjection, PersistentPublicChatLauncher]
observability: [guest_conversation_created, guest_message_sent, guest_attachment_uploaded, guest_conversation_access_denied, guest_conversation_closed]
rollout: Use service-only Supabase PostgreSQL commands plus private support-attachment and server-only quarantine buckets in the isolated local and managed stacks; managed failure never falls back to SQLite. Production exposure remains blocked until the managed scanner, email, and shared-rate-limit adapters pass remote readiness checks. Roll back by disabling guest creation while retaining private records for the retention window.
---

# Anonymous assisted matching

### Scenario: unassigned guest conversations require a claim

Given a guest conversation has no assigned agent\
When a Support actor tries to read its transcript or attachments, reply, or close it\
Then the command denies access without changing records or unread state\
And only a successful authorized claim grants that agent access\
And the verified guest and authorized administrator retain their existing scope.

### Scenario: guests and staff can read older messages

Given an authorized guest session or assigned staff actor opens a retained chat\
When Older messages is selected in the launcher or full thread\
Then at most 50 earlier messages appear in chronological order\
And Latest messages returns to current replies and resumes bounded refresh\
And the launcher keeps its unsent reply and selected attachment while paging\
And a failed history request preserves the displayed messages and offers retry\
And historical reads neither mark new replies read nor expose another guest's
messages, contacts, attachment paths, or recovery credentials\
And attachment links repeat their normal authorization when opened.

Rollout: apply migrations 084 (NULL-safe assignment checks) and 085 (message
history) before the UI. Retain 084 on rollback; the old bounded latest-message
UI remains compatible. Tests: `tests/sql/support-history.sql`,
`tests/support-history.test.mjs`, `tests/e2e/support-history.spec.ts`.

### Scenario: guest asks for help without a shipment form

Given an account-free visitor wants help finding a transporter\
When the visitor submits a valid email, valid callback phone, and one bounded written message\
Then one private Assisted matching conversation is created and assigned through the existing bounded support queue\
And the visitor receives a secure browser session plus a recovery code queued to the submitted email\
And the contact details are available only to the assigned team for reconnecting after a disruption\
And no Load, shipment request, public demand signal, ranking, transaction, or user account is created\
And the UI explains that the visitor may still browse, call, and negotiate with transporters directly.

Given the recovery message is queued but its immediate email attempt does not complete\
When the scheduled managed-operations worker leases it later\
Then the recovery email uses the same stable idempotency key and private conversation code\
And delivery failure never publishes the conversation or contact details.

### Scenario: active conversation feels live and fails safely

Given a guest has an open conversation\
When the guest or assigned team member sends a message\
Then an available agent is assigned immediately and the visible conversation refreshes at most every two seconds\
And the UI shows whether a team member is currently available without promising a response time\
And managed deployment may replace polling with Supabase Realtime while preserving the same authorization checks\
And a realtime disconnect falls back to bounded polling without losing stored messages\
And messages are length bounded, rate limited, idempotent, and rejected after closure.

### Scenario: the public chat follows the visitor

Given a guest started or recovered an open Assisted matching conversation\
When the guest closes the chat surface, navigates between supported public routes, or refreshes the browser\
Then a small persistent Ask Loadgistic launcher remains available without covering primary map or navigation controls\
And reopening it restores the same authorized conversation and stored messages without asking for the contact details again\
And desktop uses a bounded dialog while a phone uses a safe-area-aware sheet above the public navigation\
And dismissing the dialog only minimizes it while an explicit guest or team End chat action ends further replies\
And focus is trapped while open, Escape closes it, focus returns to the launcher, and new team messages are announced without stealing focus.

### Scenario: the launcher accepts clicks only when ready

Given the public page has rendered while its client JavaScript is still loading\
When a visitor reaches Ask Loadgistic\
Then the launcher remains disabled until its event handlers are attached\
And after initialization one click opens the dialog on desktop and phone\
And delayed conversation reads show the existing loading state without losing the click.

Verification: `tests/e2e/assisted-chat-audit.spec.ts` holds client scripts before
initialization, then releases them and exercises the first enabled click.
This changes client readiness only; message authorization and stored data stay
under the existing Support contracts. Rollback is an application-only change.

### Scenario: ending and restarting are explicit

Given a guest has an active Assisted matching conversation\
When the guest selects End chat and confirms the action\
Then the same retained transcript becomes read-only for both parties\
And the launcher offers Start a new chat using a new contact-and-message submission\
And starting again creates a distinct conversation rather than reopening or overwriting the ended transcript\
And ending or starting does not create a Load, demand record, member account, or public post.

### Scenario: requested files remain private

Given the team asks a guest for supporting information\
When the guest uploads a JPEG, PNG, WebP, or PDF no larger than the configured limit\
Then its signature is validated before storage under a private opaque reference\
And it is quarantined and passes the explicitly configured inspection policy before the conversation stores that reference\
And only that guest session, the assigned Support actor, or an administrator with Support permission can download it\
And every download reauthorizes the conversation relationship\
And filenames are sanitized while passwords, PINs, and one-time codes are explicitly discouraged\
And upload acceptance fails closed without configured inspection and durable private storage\
And managed antivirus requires a clean verdict while the explicitly owner-approved validation-only pilot retains signature, size, and authorization checks without claiming a virus scan (BASE-DEP-001).

### Scenario: guest access fails closed

Given a browser lacks the conversation session or submits an invalid email/code pair\
When it requests the conversation, messages, or an attachment\
Then the response discloses no conversation existence, contact, message, assignment, or file\
And repeated access or message attempts are rate limited\
And submitted secrets are absent from logs and audit details.

### Scenario: team triage remains least privilege

Given guest and member conversations share the operational inbox\
When a Support actor or administrator opens the queue\
Then each guest row is clearly labeled Assisted matching and shows only the bounded safe contact summary needed to reply\
And assignment limits, claiming, closure, pagination, unread state, and audit behavior remain consistent\
And ordinary providers and unrelated support agents cannot open the conversation or files.

### Scenario: language does not promise brokerage outcomes

Given Loadgistic helps connect a visitor with transporters\
When public or conversation UI explains that help\
Then it uses Assisted matching\
And it does not claim Loadgistic guarantees a transporter, documents, cargo fit, price, payment, delivery, or legal brokerage outcome.

### Scenario: managed guest chat is private and durable

Given local development, Preview, or Production uses the managed runtime\
When a visitor creates, restores, reads, replies to, ends, or downloads a file from Assisted matching\
Then the active application route uses the dedicated Support port, Supabase PostgreSQL, and private Supabase Storage\
And PostgreSQL repeats the server-held guest digest or assigned Support authorization on every conversation, message, lifecycle, and file command\
And a failed metadata command removes a newly released upload instead of leaving an unowned attachment object\
And Storage references, contact digests, recovery codes, and delivery internals never appear in the browser projection\
And browser roles cannot execute the service-only commands or read the private bucket directly\
And managed failure never falls back to SQLite or a serverless local file.

## Contract ownership

### Scenario: successful submission is not reported as a failure

Given a visitor starts, replies to, or ends a chat\
When the server accepts that action\
Then the client clears the submitted form without accessing a discarded event target\
And repeated clicks while the request is pending cannot submit a duplicate action\
And a failed refresh after a successful save is distinguished from a failed submission\
And failed submissions preserve the visitor's message for retry.

### Scenario: background chat work remains bounded

Given the public chat launcher is mounted\
When the document is hidden or the route does not show chat\
Then recurring conversation requests pause\
And a browser without an active chat does not repeatedly fetch conversation state while minimized\
And visible active chats refresh every two seconds when open or ten seconds when minimized without overlapping requests\
And closed transcripts stop recurring requests until the visitor opens chat again.

- Public surface: persistent public-shell launcher; `/help` and `/help/[id]` remain recovery and shareable fallbacks rather than primary navigation destinations
- Support/admin inboxes: existing `/support` and `/admin/support`
- Inbound adapters: `/api/guest-support/*` and authorized private-file reads
- Application service and persistence adapter: dedicated managed Support port and service-only Supabase PostgreSQL commands
- Private storage adapter: quarantined/scanned Supabase private Storage through `src/lib/private-storage.js`
- Tests: managed Support contract and live Supabase verifier, domain authorization/rate-limit, file authorization, desktop/mobile E2E

Audit repair evidence: `tests/guest-chat-refresh.test.mjs` and six desktop/phone
cases in `tests/e2e/assisted-chat-audit.spec.ts`. Browser transport is mocked in
that focused UI suite; hosted message delivery needs separate runtime evidence.
The application-only change preserves stored transcripts and existing sessions
and may be rolled back without rewriting Support records.

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
