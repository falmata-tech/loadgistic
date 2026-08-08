# Application routes

## Public

- `/` — supply-led homepage with live capacity preview.
- `/capacity` — account-free Capacity Board, filters, cursor feed, and shared map.
- `/providers` — published transport-provider Directory.
- `/@handle` — canonical branded provider microsite.
- `/providers/[handle]` — compatibility route to the canonical handle.
- `/track` — shipper or receiver code unlock.
- `/track/[id]` — party-scoped guest tracking after unlock.
- `/about` — product purpose and safety model.
- `/apply` — fleet or self-managed provider signup.
- `/login` — provider/platform-team login.

## Provider workspace

- `/app/home` — role-appropriate provider or Driver summary.
- `/app/fleet` and `/app/fleet/[id]` — fleet roster, truck detail, and capacity planning.
- `/app/provider-shipments` — bounded provider-owned shipment history.
- `/app/provider-shipments/new` — create tracking after offline agreement.
- `/app/provider-shipments/[id]` — provider timeline and governed actions.
- `/app/company-page` — provider microsite editor.
- `/app/verification` — owned evidence requests.
- `/app/support` — member Support.
- `/app/more` — account, billing, and secondary navigation.

Former `/app/loads`, `/app/shipments`, `/app/network`, `/app/providers`, `/app/capacity`, and `/companies` surfaces redirect to a current safe destination. Mutating legacy shipment/network endpoints return `410 Gone`.

## Platform team

- `/admin/operations` — bounded provider, truck, capacity, shipment, delivery, and cleanup oversight.
- `/admin/reviews` — documents, provider-rating disputes, and payments.
- `/admin/support` — Support supervision.
- `/support` and `/support/[id]` — assigned Support-agent queue and conversation.

## System

- `/api/health` — process/database health only; it does not assert public-production readiness.
