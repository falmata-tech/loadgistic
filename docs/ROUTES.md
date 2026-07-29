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
- `/app/shipments/new` — rich Post Load workflow
- `/app/shipments/[id]`
- `/app/providers` — Business and Transporter Directory
- `/app/providers/[handle]` — Business or Transporter Public Profile inside the workspace shell
- `/app/network` — Connected relationships, requests, and private Favorites
- `/app/loads` — searchable Load Board with optional owned-truck route ranking
- `/app/capacity` — searchable Capacity Board with optional owned-load route ranking
- `/app/fleet` — fleet roster for Fleet Transporters
- `/app/fleet/[id]` — one truck's detail and capacity controls
- `/app/company-page` — Public Profile editor
- `/app/verification` — owned entity and truck verification
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

- `/admin/applications`
- `/admin/operations`
- `/admin/verifications`
- `/admin/ratings`
- `/admin/billing`

Administrative queues use `page`. `/admin/operations` uses independent
`userPage`, `workspacePage`, `truckPage`, `loadPage`, and `capacityPage` keys so
one record group can move without changing the others.

## System

- `/api/health`
