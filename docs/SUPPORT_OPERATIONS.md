# Native customer support operations

Status: local implementation. Controlling specifications: `FEAT-SUP-001` and
`FEAT-GST-001`.

## First-release boundary

Loadgistic owns the customer-support inbox. It uses the existing authenticated
application, repository authorization, audit log, notifications, SQLite local
adapter, and Supabase PostgreSQL target. There is no per-agent license and no
second support deployment.

Included:

- signed-in member support entry point
- short category choices and one open conversation per member
- text messages up to 2,000 characters
- five-second refresh only while a conversation page is visible
- least-loaded automatic assignment and oldest-waiting manual claim
- configurable open-conversation limit per agent
- available/unavailable agent state
- close lifecycle, unread counts, queue/history pagination, and audit events
- support-only team accounts managed by a platform administrator
- account-free floating Assisted matching chat with required email and callback
  phone, email recovery, and route-persistent browser session
- immediate least-loaded assignment, team availability, and two-second active
  guest-thread refresh
- optional private image or PDF attachments requested by the team
- guest or team End chat plus a distinct Start a new chat lifecycle
- delivery-adapter queue for guest recovery codes

Excluded:

- voice, video, typing indicators, read receipts, bots, and external-channel
  message mirroring
- AI replies
- Telegram or WhatsApp message mirroring
- support-agent access to verification, payments, Operations,
  shipment tracking, exact location, or files outside an assigned conversation

Assisted matching is private help, not a public shipment request. It creates no
Load, demand post, ranking record, transaction, or visitor account. The guest
may continue to browse, call, and negotiate with transporters directly.

## Queue policy

An open conversation is `WAITING` when no eligible agent has capacity and
`OPEN` after assignment. Eligible agents are active SUPPORT users whose support
profile is active and available and whose assigned `OPEN` count is below
`max_open_conversations`.

Automatic assignment chooses:

1. lowest open-conversation count
2. oldest `last_assigned_at`, with never-assigned agents first
3. stable user identifier

Creation and claim execute in a database transaction. Closing records actor and
time, then makes one slot available. Disabling a support agent first returns
their open conversations to `WAITING`, then attempts reassignment.

## Access policy

| Action | Member | Assigned SUPPORT | ADMIN |
| --- | --- | --- | --- |
| Start conversation | Own account | No | No |
| Read conversation | Own conversation | Assigned conversation | Any |
| Send message | Own open conversation | Assigned open conversation | Any open conversation |
| Claim waiting work | No | Available and below limit | No |
| Close conversation | No | Assigned conversation | Any |
| Change own availability | No | Own support profile | No |
| Manage agents | No | No | Yes |

An account-free guest may start one open Assisted matching conversation per
normalized email, read and reply only through its signed browser session or
matching email/recovery-code pair, and read only attachments in that
conversation. The guest may end that conversation; either party's closure makes
the transcript read-only, after which the guest may start a separate session.
The assigned Support actor or an administrator with Support
permission may read and reply. Other providers, staff, and Support actors fail
closed.

Member Support reads return safe participant identity only: name, role label,
workspace name, conversation category, assignment, status, and messages.
Assisted matching additionally exposes the guest's submitted email and required
callback phone only to the assigned team member or authorized administrator.
Password hashes, access-code digests, tracking codes, exact location, payment
data, and unrelated private files are excluded.

## Performance and failure behavior

- Queue and history use indexed server-side pagination.
- Conversation reads return at most 50 recent messages in chronological order.
- The browser pauses refresh while hidden and never keeps a server process open.
- An open guest conversation refreshes every two seconds while visible; normal
  member Support retains the five-second interval.
- Message commands are rate limited and reject empty, oversized, unrelated, or
  closed-conversation writes.
- A refresh failure leaves the currently rendered conversation usable and tries
  again at the next interval.
- Local SQLite uses bounded polling and does not claim push transport. Managed
  deployment replaces guest polling with Supabase Realtime subscriptions to
  committed, authorized rows and falls back to bounded polling on disconnect;
  PostgreSQL remains persistence authority.
- Recovery email delivery uses the idempotent managed-email port: direct Resend
  is the Production adapter and an HTTPS webhook is an optional private
  fallback. Without either adapter, the row remains queued and the current
  signed browser session remains usable.
- Production attachment acceptance remains blocked until durable private
  storage and malware scanning are configured. Every download reauthorizes the
  conversation relationship.

## Future channels

Telegram may later receive assignment notifications containing only a secure
deep link. WhatsApp may remain a manual emergency contact. Neither channel may
receive private Loadgistic records without a new reviewed specification.
