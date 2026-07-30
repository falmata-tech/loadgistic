# Native customer support operations

Status: first implementation. Controlling specification: `FEAT-SUP-001`.

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

Excluded:

- anonymous chat
- attachments, document sharing, voice, video, presence, and typing indicators
- AI replies
- Telegram or WhatsApp message mirroring
- support-agent access to applications, verification, payments, Operations,
  shipment tracking, exact location, or private files

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

Support reads return safe participant identity only: name, role label, workspace
name, conversation category, assignment, status, and messages. Account phone,
password hash, tracking codes, exact location, payment data, and private files
are excluded.

## Performance and failure behavior

- Queue and history use indexed server-side pagination.
- Conversation reads return at most 50 recent messages in chronological order.
- The browser pauses refresh while hidden and never keeps a server process open.
- Message commands are rate limited and reject empty, oversized, unrelated, or
  closed-conversation writes.
- A refresh failure leaves the currently rendered conversation usable and tries
  again at the next interval.
- Realtime is an optional later delivery adapter, not persistence authority.

## Future channels

Telegram may later receive assignment notifications containing only a secure
deep link. WhatsApp may remain a manual emergency contact. Neither channel may
receive private Loadgistic records without a new reviewed specification.
