# Loadgistic Product Master Prompt

Loadgistic is an authenticated B2B road-freight network for Ethiopia.

## Product Sides

- **Businesses** are shippers and receivers. The same workspace may send or receive freight.
- **Fleet Transporters** manage multiple real trucks and the people operating them.
- **Self-managed Drivers / Owner-Operators** manage their own truck and capacity.
- **Administrators** review applications, billing evidence, document verification, and platform activity.

Businesses currently join free to find capacity, publish freight loads, request quotes, and maintain private transporter relationships. Transporters pay for access to reviewed Business demand and the organized workflow.

Live loads, Capacity Board data, Public Profiles, and interactions require authentication. Every signed-in account may browse the Business and Transporter Directory.

## Current Audience

The initial Business audience is artisans, growers, farmers, processors, producers, distributors, and small manufacturers that move cartons, pallets, sacks, crates, quarter-truck, half-truck, or full-truck freight without maintaining a large private fleet. The public story centers production-to-market movement and the practical ability to access existing road capacity. Authenticated product language remains neutral enough for larger enterprises.

This positioning is informed by Ethiopia's manufacturing policy and enterprise-development priorities, which identify manufacturing SMEs, domestic production linkages, and fair, sector-aligned transport and logistics as development needs. Loadgistic may describe that alignment but must never imply government sponsorship or endorsement. Research and source links are recorded in `docs/ETHIOPIA_MARKET_CONTEXT.md`.

## Boards

- The **Load Board** contains FTL and PTL Business demand.
- The **Capacity Board** contains fresh Empty or Partial capacity.
- Every Capacity Board card represents one real truck, not a transporter-level aggregate.
- Other transporters and drivers may browse capacity read-only to understand supply.
- Off Duty trucks never appear on the Capacity Board.
- Both boards support plain search and filters for route cities, FTL/PTL, and cargo configuration.
- A provider may rank permitted loads against one of its own recorded truck routes.
- A Business may rank permitted trucks against one of its own open load routes.
- Matching is deliberately simple: both cities align, one city aligns, or no recorded match. It is not dispatch, assignment, distance calculation, or a guarantee.

## Fleet Truth

Fleet size is derived from active vehicle rows. Every active truck has make, model, plate, and one standardized visual cargo configuration. A fleet claiming ten trucks must have ten active truck records. Public Profile and Fleet views show every truck as Empty, Partial, Off Duty, or Not updated.

Supported cargo configurations:

1. Cargo van
2. Mini Open Body Truck
3. Mini Stake Body Truck
4. Mini Box Truck
5. Light Stake Body Truck
6. Light Box Truck
7. Medium Stake Body Truck
8. Medium Box Truck
9. Heavy Rigid Stake Body Truck
10. Heavy Rigid Stake Body Truck + Trailer

Generic tonnage labels are not truck identities.

## Role Homes

Home for a self-managed driver is the rich capacity control panel. A Fleet Transporter's Home is a company management dashboard with demand, assigned work, fleet-capacity summaries, recent Tracking, and network corridor coverage. Fleet Transporters update individual truck capacity inside My Fleet.

The rich truck capacity control panel controls:

- On Duty or Off Duty
- Empty or Partial cargo space
- available percentage for Partial capacity
- accepted load policy: FTL, PTL, or Both
- stop policy: Direct only or Open to multi-stop
- current general area and freshness
- optional privacy-obscured device location
- separate corridor city inputs and planned travel date
- contract-lane interest
- Public or Partners visibility
- optional timestamped cargo-space proof

The browser may briefly access an exact device coordinate, but it snaps that point to a half-degree grid before submission. Only the obscured point, a 40 km privacy radius, source, and human general-area label reach the server. Exact coordinates must never be submitted, stored, logged, or displayed.

## Loads And Relationships

Businesses post FTL or PTL freight with fixed price, target price, or quote requested. Demand visibility is Open, Partners, or Direct to one transporter.

Saved relationships allow a Business and transporter to exchange private demand or capacity. Provider browse visibility alone never grants contact, mutation, receiver-contact, note, or proof permissions.

After agreement and before assignment, receiver first name and phone are required. Those fields are visible only to shipment parties.

The Load Board is provider discovery. Tracking is the post or direct-request workspace and lists only loads where the signed-in Business, transporter organization, self-managed driver, or administrator is a party. Browse permission never adds a load to Tracking.

Load dates are shown as Pick up before and Drop off before. Road freight is the only service and is not repeated as a selectable service label.

After a completed load, the shipper and receiver Businesses may rate each other once for that load. These are shipment-domain roles; both accounts remain the same Business account type. The Business that created the load remains its owner and provider-facing decision maker.

## Tracking

Every load has one tracking obligation:

- **Status timeline** requires real timestamped status or note updates.
- **Approximate location + status** requires a general area on each assigned-provider operational update. Device areas use the same 40 km privacy protection as capacity.

The assigned provider cannot reduce the tracking requirement. Only the shipper Business, receiver Business, or administrator may change Approximate location + status to Status timeline. The change is recorded as a tracking event.

Assigned providers may record in-between tracking updates without inventing a status transition. Tracking links use opaque tokens, require login, and expose only customer-safe events. Location events display only the human area and privacy radius, never coordinates.

Operational proof and temporary load-size proof are separate from tracking mode.

## Directory, Profiles, And Contact

Businesses, Fleet Transporters, and Self-managed Drivers have authenticated Public Profiles in one directory. Business profiles help members confirm a selected shipper or receiver and show member-declared operating regions or cities. Transporter profiles additionally show fleet roster, corridors, service regions, service summary, and current public capacity.

Fleet Transporter Home compares preferred-corridor place names with operating regions declared by Businesses in that transporter's saved network. The coverage view is schematic and text-based. It uses no exact map pins, inferred facility locations, or live Business locations, and it never claims that an unmatched Business cannot be served.

A Business may explicitly opt to display its separate public phone beside loads visible to transporters. The receiver first name and phone recorded after agreement remain private load-party data.

The account email and account phone used for access or account administration are private fields. Public Profile email and phone are separate, explicitly maintained fields. A profile must never fall back to account contacts.

## Verification

Verification is evidence-based and separate from workspace approval. Every supported entity displays gray Not verified or blue Verified badges derived from administrator-reviewed requests.

- Businesses: Identity and Business license
- Fleet transporters: Identity and Business license
- Self-managed drivers: Identity and Driver identity
- Company drivers: Driver identity, with transporter affiliation shown separately
- Trucks: Vehicle ownership or Owner authorization

Transporters are responsible for documenting vehicle ownership or owner authorization and the identity of their drivers. Verification documents remain private to their submitting owner and administrators. The exact country- and actor-specific document catalog will expand without changing this subject-level model.

## PWA

Loadgistic is installable in standalone mode. Driver workflows are mobile-first with safe-area navigation and touch-sized controls. Authenticated pages remain network-first and are not stored as shared offline HTML. The service worker caches stable visual assets only; Next.js executable chunks are delivered through normal version-aware HTTP caching so upgrades cannot mix stale and current runtimes.

## Plans

- Business Capacity
- Fleet Transporter Demand
- Self-managed Driver Demand

Manual ETB payment-proof review remains a local MVP workflow. No bank password, PIN, or OTP is collected.

## Source Of Truth

Accepted feature specs in `specs/features/` define observable behavior and authorization. `specs/TRACEABILITY.md` records verified evidence. This document describes current product reality and must change with any implemented behavior change.
