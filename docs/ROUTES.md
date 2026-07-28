# Application Routes

## Public

- `/` — producer- and transporter-focused Ethiopia B2B road-freight homepage
- `/apply` — business/provider application
- `/login` — direct login
- `/companies` — authenticated Business and Transporter Directory
- `/companies/[handle]` — authenticated Business or Transporter Public Profile
- `/track` — Business-party secret tracking-code unlock
- `/track/[id]` — user/load-bound customer tracking after unlock

## Workspace

- `/app/home`
- `/app/shipments` — party-only Tracking
- `/app/shipments/new` — rich Post Load workflow
- `/app/shipments/[id]`
- `/app/providers` — Business and Transporter Directory
- `/app/network` — Connected relationships, requests, and private Favorites
- `/app/loads` — searchable Load Board with optional owned-truck route ranking
- `/app/capacity` — searchable Capacity Board with optional owned-load route ranking
- `/app/fleet` — fleet roster for Fleet Transporters
- `/app/fleet/[id]` — one truck's detail and capacity controls
- `/app/company-page` — Public Profile editor
- `/app/verification` — owned entity and truck verification
- `/app/more`

## Administration

- `/admin/applications`
- `/admin/verifications`
- `/admin/billing`

## System

- `/api/health`
