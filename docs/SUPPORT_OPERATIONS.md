# Customer support operations

Status: planned and disabled. Controlling specification: `FEAT-SUP-001`.

## Decision

Use Chatwoot behind a narrow `SupportProvider` adapter instead of implementing
message delivery, presence, attachments, assignment, and real-time updates in
the Loadgistic Next.js and SQLite application.

Chatwoot provides the required live-chat inbox, assignment, closure, teams,
availability, API, authenticated widget identity, and signed webhooks. Per-agent
open-conversation capacity is a paid feature:

- Chatwoot Cloud Enterprise includes Agent Capacity and custom roles.
- Self-hosted Premium Support includes Agent Capacity and roles at a lower
  per-agent price, but Loadgistic must operate PostgreSQL, Redis, Rails web
  processes, background workers, SMTP, object storage, backups, monitoring, and
  upgrades.
- Free and lower cloud tiers can validate the conversation workflow but do not
  satisfy the required hard queue limit.

Official references:

- <https://www.chatwoot.com/pricing>
- <https://www.chatwoot.com/pricing/self-hosted-plans>
- <https://developers.chatwoot.com/self-hosted/deployment/requirements>
- <https://developers.chatwoot.com/self-hosted/deployment/architecture>
- <https://www.chatwoot.com/hc/user-guide/articles/1741998212-agent-capacity>
- <https://www.chatwoot.com/hc/user-guide/articles/1677587479-how-to-enable-identity-validation-in-chatwoot>
- <https://www.chatwoot.com/hc/user-guide/articles/1677693021-how-to-use-webhooks>

## Recommended deployment

Start with a separately hosted Chatwoot staging environment. Self-hosted Premium
is the leading option when operating ownership and backups are available;
Chatwoot Cloud is the faster option when United States data hosting is accepted.
Do not select a provider based only on the widget demo.

Before enabling the feature:

1. Approve deployment ownership, data residency, retention, deletion, and
   backup policy.
2. Configure inbox, team, agent availability, and per-agent capacity.
3. Store website token, API token, HMAC secret, and webhook secret only in
   server-side secret management.
4. Implement a disabled-by-default adapter and server-generated identity hash.
5. Verify webhook signatures and idempotency.
6. Run staged assignment, closure, reconnect, attachment, and outage tests.
7. Add monitoring for unassigned age, first response, resolution time, reopen
   rate, queue depth, and conversations rejected at capacity.

## Staff permissions

Chat assignment is not platform administration. Loadgistic needs a separate
staff capability record controlled by a full platform administrator:

| Capability | Customer service default |
| --- | --- |
| Open assigned support conversations | Yes |
| View client operations summary | Optional |
| Review applications | Optional |
| Review verification documents | Optional |
| Review payment status | Optional |
| Edit client identity fields | Off |
| Suspend a client | Off |
| Manage staff permissions | Never |
| View credentials, tracking codes, exact location, or private files outside an assigned review | Never |

Every platform capability must be enforced in repository services and audited.
Do not model a support agent as an unrestricted `ADMIN`. Client creation and
identity edits require a separate specification because they affect tenant
ownership and authentication.

## Failure behavior

When provider configuration is absent or unhealthy, Loadgistic renders no chat
launcher and sends no member data externally. Existing application navigation
and support contact alternatives remain usable. Provider webhooks do not become
authority for subscription, verification, account, load, or tracking state.
