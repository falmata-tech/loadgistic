# Domain model

## Provider

A provider is either a transport company/fleet or a self-managed Driver/owner-operator. It owns trucks, capacity signals, a public microsite, shipment execution records, reviews, verification evidence, support, and billing state.

Company Drivers belong to one fleet, may be assigned to trucks, and act only through owner-granted capacity or tracking permissions. A self-managed Driver is treated as the provider owner for its own truck.

## Public capacity signal

Each truck has one latest current state:

- `EMPTY`, `PARTIAL`, or `OFF_DUTY`.
- Empty accepts Full, Partial, or both and may publish radius or route geography; Partial accepts Partial only and is always route-based.
- `RADIUS` means availability within a provider-selected working radius around an obscured current point.
- `ROUTE` means immediate one-direction capacity between two structured places and has no date.
- Location privacy accuracy is independent of working radius and may be changed whenever the authorized Driver refreshes location.
- Off Duty, expired, unpublished, and superseded signals are excluded from public discovery.

A truck may also have one optional next trip, with an optional weekday/date. Its provider may publish multiple undated recurring directional routes and permanent 5–500 km working-radius areas. These are market signals and require direct confirmation.

## Provider microsite

Every published provider owns a unique handle and may configure headline, description, services, theme colors, introductory YouTube video, and independent visibility for phone, WhatsApp, email, and website. Public pages show fleet, capacity, recurring routes or permanent working areas, reviewed evidence badges, and verified-shipment reviews through a safe projection.

## Provider shipment

A provider shipment is an execution record created only after provider and customer agree offline. It contains one owned truck/Driver, structured origin and destination, bounded cargo summary, optional expected dates, tracking mode, shipper email, and receiver email. It never becomes public demand.

The lifecycle is explicit: `CREATED → LOADING → IN_TRANSIT → UNLOADING → COMPLETED`, with governed `ISSUE` transitions. Proof is accepted only for Loading, Unloading, and Issue events.

## Guest tracking grant

Creation issues separate high-entropy shipper and receiver codes. Only digests are stored. A successful unlock creates a party-scoped browser session; neither party receives the other party's secret. Completion queues an idempotent email record for each party. Guest access and customer emails are removed 30 days after completion, while provider history remains.

## Provider review

The emailed shipper party may submit one rating after completion. Every score publishes and counts. The provider may dispute a one-, two-, or three-star rating; a pending dispute remains visible and counted until a platform reviewer decides it.

## Retired demand model

Shipment-demand posts, interests, Direct requests, pooled/along-route groups, Business accounts/profiles, and member-network relationships are not part of the active model. Local development migrations delete their fake fixtures; current routes block or redirect their former surfaces.
