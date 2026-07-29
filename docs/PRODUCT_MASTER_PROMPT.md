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
- The **Pooled shared truckload** tab is a read-only projection of compatible Posted PTL loads whose origin and destination areas fall within configured radii. It never combines agreements, assignments, prices, or source records.
- The **Capacity Board** contains fresh Empty or Partial capacity.
- Every Capacity Board card represents one real truck, not a transporter-level aggregate.
- Other transporters and drivers may browse capacity read-only to understand supply.
- Off Duty trucks never appear on the Capacity Board.
- The Load Board supports descriptive text, Local or Between cities geography, selected endpoint circles with adjustable radii and direction, FTL/PTL, cargo configuration, visibility, price type/range, deadline, and posted-recency filters.
- The Capacity Board supports descriptive text, Local or Between cities geography, selected endpoint circles with adjustable radii and direction, an optional privacy-aware current-area preference, cargo space, FTL/PTL acceptance, cargo configuration, minimum space, route date, visibility, freshness, stop flexibility, contract-route, and proof filters.
- Secondary Board controls remain collapsed under More filters until used.
- A provider may rank permitted loads against one of its own recorded truck routes.
- A Business may rank permitted trucks against one of its own open load routes.
- Intercity matching compares both endpoint coordinates against independently adjustable radii. Direction may be direct or either way; every eligible current and planned route belonging to a truck is checked and the strongest match reports rounded endpoint distances. It is not dispatch, assignment, road-distance calculation, or a guarantee.

## Fleet Truth

Fleet size is derived from active vehicle rows. Every active truck has a permanent Loadgistic platform number, make, model, private operational plate, and one standardized visual cargo configuration. A fleet claiming ten trucks must have ten active truck records. Public Profile and Fleet views show every truck as Empty, Partial, Off Duty, or Not updated; member-facing discovery uses the platform number instead of the plate.

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

Home for a self-managed driver is the rich capacity control panel. A Fleet Transporter's Home is a company management dashboard with demand, assigned work, fleet-capacity summaries, recent Tracking, and network route coverage. Fleet Transporters update individual truck capacity inside My Fleet.

The rich truck capacity control panel controls:

- On Duty or Off Duty
- Empty or Partial cargo space
- available percentage for Partial capacity
- accepted load policy: FTL, PTL, or Both
- stop policy: Direct is always accepted, with independent Multi Pick and Multi Drop choices
- current general area and freshness
- optional privacy-obscured device location
- a dated current partial-capacity route when Partial
- a separate future planned travel route with date and Full or Partial planned cargo space
- Direct acceptance plus independent Multi Pick and Multi Drop choices
- contract-route interest
- Local, Between cities, or Both operating scope, with a reviewed locality and 5–100 km radius for Local service
- Public or Partners visibility
- optional timestamped cargo-space proof

Local-only capacity is always published as Empty with 100 percent of the truck available. Partial capacity requires Between cities or Both scope plus a dated current route, because remaining space can be matched only when the truck's movement is known.

The browser may briefly access an exact device coordinate, but it obscures that point before submission. Capacity and PTL tracking use a 40 km privacy area; FTL tracking uses a 20 km privacy area. Only the obscured point, permitted radius, source, and human general-area label reach the server.

## Loads And Relationships

Businesses post FTL or PTL freight with fixed price, target price, or quote requested. Demand visibility is Open, Partners, or Direct to one transporter.

My Network separates a private Favorite from a mutual operating relationship. Either market side may Favorite the other or request a cross-market connection. Businesses may also Favorite other Businesses so frequent shipment parties rank first in selection; this same-side Favorite never creates a transport partnership.

The posting Business declares whether it is shipper or receiver while remaining the load owner and provider-facing decision maker. The opposite party may be another account Business or an external party. After agreement and before assignment, receiver first name and phone are required.

The Load Board is provider discovery. Businesses receive one My Loads navigation entry: its page contains the Post load action, an All my loads view of owned demand, and an Active Tracking view. Transport providers retain a Tracking navigation entry because they do not own Business demand. Tracking contains only Agreed, Assigned, In Transit, On Hold, Issue, Delivered, and Completed records involving the viewer. Posted, Sent, Contacted, saved, and merely interested records never mix into Tracking.

Load dates are shown as Pick up before and Drop off before. Road freight is the only service and is not repeated as a selectable service label.

After a completed load, the shipper and receiver Businesses may rate each other once for that load. Four- and five-star ratings publish immediately. One- through three-star ratings require an explanatory note and remain private to the submitting Business and administrators until an administrator records an investigation note and either Publishes or Dismisses the rating. Pending and Dismissed ratings never affect the public count or average. These are shipment-domain roles; both accounts remain the same Business account type. The Business that created the load remains its owner and provider-facing decision maker.

## Tracking

Every load has one tracking obligation:

- **Status timeline** requires real timestamped status or note updates.
- **Approximate location + status** requires a general area on each assigned-provider operational update. Device areas use 20 km privacy for FTL and 40 km for PTL.

The assigned provider cannot reduce the tracking requirement. Only the shipper Business, receiver Business, or administrator may change Approximate location + status to Status timeline. The change is recorded as a tracking event.

Assigned providers may record in-between tracking updates without inventing a status transition. Customer tracking requires the secret code supplied by the load owner. Account and non-account shipper or receiver parties may use it; the browser grant expires after five idle minutes. Signed-in assigned transport providers use their internal timeline instead.

Operational proof and temporary load-size proof are separate from tracking mode.

## Directory, Profiles, And Contact

Businesses, Fleet Transporters, and Self-managed Drivers have authenticated Public Profiles in one directory. Descriptive text search, account-type filtering, and a separate selected-place proximity filter return bounded pages so a large member catalog is not rendered into one response. City, route, and region labels are never folded into ordinary text search. Each profile stores one general catalog-selected regional base for proximity discovery. Business profiles help members confirm a selected shipper or receiver and show member-declared operating regions or cities. Businesses call their declared route pairs Freight Routes. Fleet Transporters and Self-managed Drivers call theirs Preferred Routes. Every profile may also declare repeatable Local Service Areas as a reviewed city or town plus a 5–100 km radius. Transporter profiles additionally show the fleet roster, Preferred Routes, fresh expiring truck geography, service regions, service summary, and current Public capacity.

Route, load, capacity, profile-base, proximity-filter, and general-area inputs query a bounded local catalog of Ethiopian OpenStreetMap cities, towns, villages, and hamlets, plus Addis Ababa suburbs, neighbourhoods, and quarters, after two typed characters. Geographic authority requires the selected catalog identity and stored coordinates. Free text remains available only for non-geographic landmark or operational notes. The catalog stores coordinates, parent locality, and available place metadata. No full catalog is rendered into a page or sent to a third party during normal use.

Fleet Transporter Home compares Preferred Routes, fresh truck geography, and Local Service Areas with coverage declared by Businesses in that transporter's Connected network. The coverage view uses approximate city route lines, translucent service-area circles, and text evidence. It uses no exact facility pins, inferred facility locations, or live Business locations, and it never claims that an unmatched Business cannot be served.

Coverage comparisons group routes and service areas by ownership rather than source. Every viewed-profile line or circle is solid blue Profile coverage. Every equivalent line or circle belonging to the viewer is grouped as Your coverage and drawn with a warm-brown dashed treatment above the blue geometry so overlap remains visible. Current-partial and planned source details remain available outside the map but do not create additional legend colors. Map geometry and matches use stored coordinates, endpoint circles, point-in-radius, or circle overlap only; labels are display text and unresolved legacy labels cannot produce match evidence.

A Local load requires one reviewed locality. The owner may optionally record safe landmark labels and map-selected pickup or drop-off points for execution. Exact points never appear on Boards, pooled-load views, Directory, Public Profiles, or administrative summaries. The owner can review what it entered; another authorized shipper, receiver, or assigned provider receives exact points only after agreement.

Deep workspace detail routes provide a Back control. A direct deep link has a safe parent-board fallback, while in-workspace navigation returns to the recorded previous workspace page.

A Business may explicitly opt to display its separate public phone beside loads visible to transporters. The receiver first name and phone recorded after agreement remain private load-party data.

The account email and account phone used for access or account administration are private fields. Public Profile email and phone are separate, explicitly maintained fields. A profile must never fall back to account contacts.

## Verification

Verification is evidence-based and separate from workspace approval. Every supported entity displays gray Not verified or blue Verified badges derived from administrator-reviewed requests. Administrators also receive a separate Rating Reviews queue for private low-rating investigation; publishing or dismissing a rating does not automatically suspend an account, and account or truck enforcement remains an explicit audited Operations action.

- Businesses: Identity and Business license
- Fleet transporters: Identity and Business license
- Self-managed drivers: Identity and Driver identity
- Company drivers: Driver identity, with transporter affiliation shown separately
- Trucks: Vehicle ownership or Owner authorization

Transporters are responsible for documenting vehicle ownership or owner authorization and the identity of their drivers. Verification documents remain private to their submitting owner and administrators. The exact country- and actor-specific document catalog will expand without changing this subject-level model.

## PWA

Loadgistic is installable in standalone mode. Driver workflows are mobile-first with safe-area navigation and touch-sized controls. Authenticated pages remain network-first and are not stored as shared offline HTML. First service-worker installation takes control without reloading an in-progress login or application form. The service worker caches stable visual assets only; Next.js executable chunks are delivered through normal version-aware HTTP caching so upgrades cannot mix stale and current runtimes.

## Growing lists

Directory and marketplace discovery show a useful first page without requiring a
search. Boards, My Loads, Tracking, Network, Fleet, histories, and
administrative record groups use bounded server-owned pages with deterministic
ordering. Search and filters reset to page one, and page navigation preserves
the active view and filters. Participant-selection controls remain different:
they wait for meaningful input and return only bounded matches.

## Plans

- Business Capacity
- Fleet Transporter Demand
- Self-managed Driver Demand

Manual ETB payment-proof review remains a local MVP workflow. No bank password, PIN, or OTP is collected.

Every newly approved workspace receives seven days of trial access. Company
Drivers share the Fleet Transporter's subscription. An administrator may grant
continuing sponsored access only while approving a qualifying starting
Business. Standard prices are not displayed yet. Approving a payment proof
opens a 30-day access period. After trial or paid access expires, or while a
late payment remains under review, members may still sign in, see a
billing-focused Home, open Account and billing, submit proof, and log out; all
operating screens and commands remain unavailable until access is restored.

Administrators also have a searchable Operations inventory for bounded safe views of users, workspaces, trucks, loads, and latest capacity. Its initial overview is compact and searches return larger bounded results. Application, verification, and billing queues provide server-bounded search, status filters, and pagination. Administrators may reversibly suspend users or deactivate trucks; those commands are audited, and administrators cannot suspend themselves.

## Source Of Truth

Accepted feature specs in `specs/features/` define observable behavior and authorization. `specs/TRACEABILITY.md` records verified evidence. This document describes current product reality and must change with any implemented behavior change.
