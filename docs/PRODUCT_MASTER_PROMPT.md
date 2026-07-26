# Loadgistic Product Master Prompt

Loadgistic is an authenticated B2B road-freight network for Ethiopia.

## Product Sides

- **Businesses** are shippers and receivers. The same workspace may send or receive freight.
- **Fleet Transporters** manage multiple real trucks and the people operating them.
- **Self-managed Drivers / Owner-Operators** manage their own truck and capacity.
- **Administrators** review applications, billing evidence, and platform activity.

Businesses currently join free to find capacity, publish freight loads, request quotes, and maintain private transporter relationships. Transporters pay for access to reviewed Business demand and the organized workflow.

Live loads, Capacity Board data, transporter Public Profiles, and interactions require authentication. Business Profiles are private.

## Current Audience

The initial Business audience is artisans, farmers, producers, and small manufacturers that move cartons, pallets, quarter-truck, half-truck, or full-truck freight without maintaining a large private fleet. Authenticated product language remains neutral enough for larger enterprises.

## Boards

- The **Load Board** contains FTL and PTL Business demand.
- The **Capacity Board** contains fresh Empty or Partial capacity.
- Every Capacity Board card represents one real truck, not a transporter-level aggregate.
- Other transporters and drivers may browse capacity read-only to understand supply.
- Off Duty trucks never appear on the Capacity Board.

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

## Driver Capacity Home

Home for a company driver or self-managed driver is the rich capacity control panel. It controls:

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

## Tracking

Every load has one tracking obligation:

- **Status timeline** requires real timestamped status or note updates.
- **Approximate location + status** requires a general area on each assigned-provider operational update. Device areas use the same 40 km privacy protection as capacity.

The assigned provider cannot reduce the tracking requirement. Only the shipper Business, receiver Business, or administrator may change Approximate location + status to Status timeline. The change is recorded as a tracking event.

Assigned providers may record in-between tracking updates without inventing a status transition. Tracking links use opaque tokens, require login, and expose only customer-safe events. Location events display only the human area and privacy radius, never coordinates.

Operational proof and temporary load-size proof are separate from tracking mode.

## Profiles And Contact

Fleet Transporters and Self-managed Drivers have authenticated Public Profiles. The profile shows fleet roster, corridors, service summary, and designated public contact details.

A Business may explicitly opt to display a designated phone beside loads visible to transporters. A Business Profile itself remains private.

## PWA

Loadgistic is installable in standalone mode. Driver workflows are mobile-first with safe-area navigation and touch-sized controls. Authenticated pages remain network-first and are not stored as shared offline HTML; only static application assets may be cached.

## Plans

- Business Capacity
- Fleet Transporter Demand
- Self-managed Driver Demand

Manual ETB payment-proof review remains a local MVP workflow. No bank password, PIN, or OTP is collected.

## Source Of Truth

Accepted feature specs in `specs/features/` define observable behavior and authorization. `specs/TRACEABILITY.md` records verified evidence. This document describes current product reality and must change with any implemented behavior change.
