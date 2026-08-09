# Application routes

## Public

- `/` — canonical account-free Capacity Board with hero, filters, cursor feed, shared map, and supporting product story.
- `/capacity` — compatibility redirect to `/` that preserves query parameters.
- `/providers` — published transport-provider Directory.
- `/@handle` — canonical branded provider microsite.
- `/providers/[handle]` — compatibility route to the canonical handle.
- `/track` — customer-owner code unlock for anyone the owner trusts.
- `/track/[id]` — customer-safe guest Tracking after owner-code unlock.
- `/about` — product purpose and safety model.
- `/apply` — fleet or self-managed provider signup.
- `/login` — provider/platform-team login.

## Provider workspace

- `/app/capacity` — the same Map-first provider-controlled public capacity projection inside Driver dashboard navigation.

- `/app/home` — role-appropriate provider or Driver summary.
- `/app/fleet` and `/app/fleet/[id]` — fleet roster, truck detail, and capacity planning.
- `/app/provider-shipments` — bounded provider-owned Tracking history.
- `/app/provider-shipments/new` — start Tracking after offline agreement.
- `/app/provider-shipments/[id]` — customer access, timeline, and one governed action panel.
- `/app/company-page` — provider microsite editor.
- `/app/verification` — owned evidence requests.
- `/app/support` — member Support.
- `/app/more` — account, billing, and secondary navigation.

Provider location mutation:

- `POST /api/capacity/location` — assigned/self-managed Driver-only refresh of the current signal's browser-obscured location and timestamp.

Former `/app/loads`, `/app/shipments`, `/app/network`, `/app/providers`, and `/companies` surfaces redirect to a current safe destination. Mutating legacy shipment/network endpoints return `410 Gone`.

## Platform team

- `/admin/operations` — bounded provider, truck, capacity, shipment, delivery, and cleanup oversight.
- `/admin/reviews` — documents, provider-rating disputes, and payments.
- `/admin/support` — Support supervision.
- `/support` and `/support/[id]` — assigned Support-agent queue and conversation.

## System

- `/api/health` — process/database health only; it does not assert public-production readiness.
