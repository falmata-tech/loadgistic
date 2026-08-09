# Domain model

## Provider

A provider is either a transport company/fleet or a self-managed Driver/owner-operator. It owns trucks, capacity signals, a public microsite, shipment execution records, reviews, verification evidence, support, and billing state.

Company Drivers belong to one fleet, may be assigned to trucks, and act only through owner-granted capacity or tracking permissions. A self-managed Driver is treated as the provider owner for its own truck.

## Public capacity signal

Each truck has one latest current state:

- `EMPTY`, `PARTIAL`, or `OFF_DUTY`.
- Empty accepts Full, Partial, or both; Partial accepts Partial only. Either status may publish radius or corridor geography.
- `RADIUS` means availability within a provider-selected working radius around an obscured current point.
- `ROUTE` is the internal value for an immediate one-direction corridor between two structured places and has no date.
- Location privacy accuracy is independent of working radius and may be changed whenever the authorized Driver refreshes location.
- Off Duty, expired, unpublished, and superseded signals are excluded from public discovery.

A provider may publish up to two undated regular two-way corridors. Each connects two catalog places in both directions, is a market signal rather than current truck availability, and requires direct confirmation.

## Provider microsite

Every published provider owns a unique handle and may configure accurate headline, description, services, and independent visibility for phone, WhatsApp, email, and website. Loadgistic controls the bounded theme, hero media, and optional introductory video. Public pages show fleet, current capacity, up to two regular corridors, reviewed evidence badges, and verified-shipment reviews through a safe projection.

## Provider Tracking session

A Tracking session is an execution record created only after provider and customer agree offline. It contains one assigned truck/Driver, structured origin and destination, bounded cargo summary, optional expected dates, the Status timeline, and one private customer-owner email. It never becomes public demand.

The lifecycle is explicit: `CREATED → LOADING → IN_TRANSIT → UNLOADING → COMPLETED`, with governed `ISSUE` transitions. Proof is accepted only for Loading, Unloading, and Issue events.

## Guest tracking grant

Creation issues one stable customer-owner code and Track link. Only the keyed code digest is stored; the owning provider can derive and display the same active code again. A successful unlock creates a short-lived browser session. One idempotent access email and one completion email are addressed to the customer owner. The completion email carries a separate review code because shared Tracking access does not authorize review. Guest access and the customer email are removed 30 days after completion, while provider history remains.

## Provider review

The emailed customer owner may submit one rating after completion. Every score publishes and counts. The provider may dispute a one-, two-, or three-star rating; a pending dispute remains visible and counted until a platform reviewer decides it.

## Retired demand model

Shipment-demand posts, interests, Direct requests, pooled/along-route groups, Business accounts/profiles, and member-network relationships are not part of the active model. Local development migrations delete their fake fixtures; current routes block or redirect their former surfaces.
