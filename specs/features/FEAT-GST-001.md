---
id: FEAT-GST-001
title: Anonymous assisted-matching conversations
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SUP-001, FEAT-ADM-001, FEAT-IAM-001]
problem: Account-free visitors may want Loadgistic to help identify suitable transporters without completing a shipment form or publishing demand.
behavior: A visitor starts a private Assisted matching conversation with a required email, required callback phone, and bounded message. The persistent public-shell launcher is the primary chat surface; it opens a compact desktop dialog or mobile sheet and restores the active session across public route changes and browser refreshes. It enters the existing support assignment workflow without creating a user account or public demand record. Available agents are assigned immediately, active conversations refresh automatically at a fast bounded interval, and the guest may attach specifically requested private images or PDFs. The guest or team may end the chat; its retained transcript becomes read-only and the guest may start a distinct new session. Supabase Realtime replaces polling during managed deployment; the local adapter must not claim push delivery. Loadgistic presents this as assisted matching, not a service guarantee or transaction handler.
contracts: [GuestSupportIdentity, GuestConversationAccess, AssistedMatchingConversation, GuestSupportMessage, GuestSupportAttachment, GuestSupportProjection, PersistentPublicChatLauncher]
observability: [guest_conversation_created, guest_message_sent, guest_attachment_uploaded, guest_conversation_access_denied, guest_conversation_closed]
rollout: Additive Supabase PostgreSQL schema plus a private support-attachment bucket in the isolated local and managed stacks. Production exposure remains blocked until malware scanning, managed email, and shared rate limiting pass readiness checks. Roll back by disabling guest creation while retaining private records for the retention window.
---

# Anonymous assisted matching

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
And only that guest session, the assigned Support actor, or an administrator with Support permission can download it\
And every download reauthorizes the conversation relationship\
And filenames are sanitized while passwords, PINs, and one-time codes are explicitly discouraged\
And production upload acceptance remains blocked without configured malware scanning and durable private storage.

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

## Contract ownership

- Public surface: persistent public-shell launcher; `/help` and `/help/[id]` remain recovery and shareable fallbacks rather than primary navigation destinations
- Support/admin inboxes: existing `/support` and `/admin/support`
- Inbound adapters: `/api/guest-support/*` and authorized private-file reads
- Application service and persistence adapter: `src/lib/repository.js`
- Private storage adapter: `src/lib/private-storage.js`
- Tests: domain, repository authorization/rate-limit, file authorization, desktop/mobile E2E
