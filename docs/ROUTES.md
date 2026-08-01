# Application Routes

## Public

- `/` — producer- and transporter-focused Ethiopia B2B road-freight homepage
- `/apply` — business/provider application
- `/login` — direct login
- `/companies` — authenticated compatibility redirect to the workspace Directory
- `/companies/[handle]` — authenticated compatibility redirect to the workspace Public Profile
- `/track` — Business-party secret tracking-code unlock
- `/track/[id]` — user/load-bound customer tracking after unlock

## Workspace

- `/app/home`
- `/app/shipments` — party-only Tracking
- `/app/shipments/new` — rich Post Shipment workflow
- `/app/shipments/[id]`
- `/app/providers` — Business and Transporter Directory
- `/app/providers/[handle]` — Business or Transporter Public Profile inside the workspace shell
- `/app/network` — Connected relationships, requests, and private Favorites
- `/app/loads` — searchable Shipment Board with optional owned-truck route ranking
- `/app/capacity` — searchable Truck Board with optional owned-shipment route ranking
- `/app/fleet` — fleet roster for Fleet Transporters
- `/app/fleet/[id]` — one truck's detail and capacity controls
- `/app/company-page` — Public Profile editor
- `/app/verification` — owned entity and truck verification
- `/app/support` — the signed-in member's support conversation and history
- `/app/more`

Growing collections use server-owned query parameters. A single-list route uses
`page`; routes with independent lists use descriptive keys such as
`truckPage`, `driverPage`, `eventPage`, or `paymentPage`. Search and filter
submissions omit the page key and therefore restart at page one. Pagination
links retain the active view and filters.

An expired, unpaid, or lapsed payment-under-review workspace can open only
`/app/home` and `/app/more`. Other workspace pages redirect to the
billing-focused Home; their repository commands independently reject access.
Administrators and sponsored workspaces are not time limited.

## Administration

- `/admin/operations`
- `/admin/reviews`
- `/admin/support` — support queue supervision and support-agent management

Administrative queues use `page`. `/admin/operations` uses one selected `view`
for Clients, Users, Trucks, Loads, or Capacity. `/admin/reviews` uses one
selected `tab` for Applications, Documents, Ratings, or Payments. Legacy queue
URLs redirect to the matching Review Center tab.

## Support Team

- `/support` — assigned and waiting conversation queue
- `/support/[id]` — one assigned support conversation

SUPPORT users are not workspace members or administrators. They are routed to
`/support` after login and cannot open marketplace, Tracking, billing, review,
verification, Operations, or client-mutation routes.

## System

- `/api/health`
