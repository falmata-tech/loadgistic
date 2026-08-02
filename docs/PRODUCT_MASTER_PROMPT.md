# Loadgistic Product Master Prompt

Loadgistic is an authenticated B2B road-freight network for Ethiopia.

## Product Sides

- **Businesses** are shippers and receivers. The same workspace may send or receive freight.
- **Fleet Transporters** manage multiple real trucks and the people operating them.
- **Self-managed Drivers / Owner-Operators** manage their own truck and capacity.
- **Administrators** review billing evidence, document verification, ratings, and platform activity.

Businesses currently join free to find capacity, publish freight shipments, request quotes, and maintain private transporter relationships. Transporters pay for access to reviewed Business demand and the organized workflow.

Live shipments, Truck Board data, Public Profiles, and interactions require authentication. Every signed-in account may browse the Business and Transporter Directory.

## Current Audience

The initial Business audience is artisans, growers, farmers, processors, producers, distributors, and small manufacturers that move cartons, pallets, sacks, crates, quarter-truck, half-truck, or full-truck freight without maintaining a large private fleet. The public homepage states the road-freight purpose briefly, then shows live Shipment Board and Truck Board previews. A dedicated anonymous server projection exposes structured marketplace facts such as routes, general areas, deadlines, price mode, truck configuration, capacity status, flexibility, proof signal, and freshness, while withholding identities, contacts, handles, record IDs, exact coordinates, files, and free text. Sign-in unlocks details and contact. Authenticated product language remains neutral enough for larger enterprises.

This positioning is informed by Ethiopia's manufacturing policy and enterprise-development priorities, which identify manufacturing SMEs, domestic production linkages, and fair, sector-aligned transport and logistics as development needs. Loadgistic may describe that alignment but must never imply government sponsorship or endorsement. Research and source links are recorded in `docs/ETHIOPIA_MARKET_CONTEXT.md`.

## Boards

- The **Shipment Board** contains Full Truckload (FTL) and Partial Truckload (PTL) Business demand.
- **Shared Shipments** is one Shipment Board workspace with two distinct read-only modes. **Pool together** suggests pairwise-compatible Posted PTL shipments with nearby origins, nearby destinations, and compatible deadline windows. **Along the route** suggests an ordered sequence of Posted Long-distance route shipments where each next pickup is near the previous drop-off, travel continues broadly forward, and recorded deadlines appear compatible. Both are negotiation aids only: they never combine ownership, agreements, assignments, prices, tracking, or source records, and they never claim that physical cargo fit or timing is confirmed.
- The **Truck Board** contains fresh Empty or Partial capacity.
- Every Truck Board card represents one real truck, not a transporter-level aggregate.
- Other transporters and drivers may browse capacity read-only to understand supply.
- Off Duty trucks never appear on the Truck Board.
- Empty and Partial capacity remain on the Truck Board when their updates become old, with relative update times, a prominent confirmation warning, and lower freshness rank. Busy means the truck is On Duty but occupied and open to future calls; it requires an available-again date and expected city, shows Preferred Routes instead of current capacity movement, and leaves discovery after that date until refreshed. Off Duty is the explicit hidden state.
- Posted demand remains discoverable for two full days after its Drop off before date. Its owner is warned as soon as the date passes; on the third day it leaves the Shipment Board and pooled projections but remains in My Shipments.
- The Shipment Board supports descriptive text, Local or Long-distance route geography, selected endpoint circles with adjustable radii and direction, shipment size, cargo configuration, visibility, deadline, recency, and price filters, grouped in that operational order.
- The Truck Board supports descriptive text, Local or Long-distance route geography, selected endpoint circles with adjustable radii and direction, privacy-aware current-area matching, availability, shipment-size acceptance, cargo configuration, space, route date, visibility, freshness, stop flexibility, contract-route, and proof filters, grouped in that operational order.
- Secondary Board controls remain collapsed under More filters until used.
- A provider may rank permitted shipments against one of its own recorded truck routes.
- A Business may rank permitted trucks against one of its own open shipment routes.
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

- Empty, Partial, Busy, or Off Duty status; the first three imply On Duty
- available percentage for Partial capacity
- accepted shipment policy: FTL, PTL, or Both
- stop policy: Direct is always accepted, with independent Multi Pick and Multi Drop choices
- current general area and freshness
- optional privacy-obscured device location
- a live, undated current partial-capacity route when Partial
- a separate future planned travel route with date and Full or Partial planned cargo space
- contract-route interest
- Local, Long-distance routes, or Both operating scope, with a reviewed locality and 5–100 km radius for Local service
- Public or Partners visibility
- optional timestamped cargo-space proof

Local-only capacity is always published as Empty with 100 percent of the truck available. Partial capacity requires Long-distance routes or Both scope plus a live current route, because remaining space can be matched only when the truck's movement is known. Its freshness comes from the capacity update timestamp rather than a separately entered route date.

The capacity editor uses visible numbered decisions in operational order: truck status, work area, status-specific details, accepted shipment size, stop flexibility, future work, then visibility and publish. Truck identity is compact. Partial space and its current route remain linked. FTL/PTL, Multi Pick/Multi Drop, recurring-work interest, and visibility are never hidden under Additional options. Busy skips current shipment-size and stop choices; Off Duty ends after the status choice. One final publish row replaces a duplicate review card.

Fleet owners manage each company Driver in one ordered control: confirm the Driver, assign one current active company truck or leave the Driver unassigned, choose allowed work, then save. A Driver and truck can each have only one active assignment; reassignment ends conflicting active assignments while retaining assignment history and audit evidence.

An active fleet truck without a current Driver stays in My Fleet but cannot publish Empty, Partial, or Busy capacity and never appears on the Truck Board. Off Duty remains available so the owner can explicitly hide its old signal. Self-managed trucks are driven by their owner-operator and do not require a separate company-Driver assignment.

When an assigned or self-managed Driver opens capacity or location-required Tracking controls, the browser requests and refreshes device location automatically while that screen remains mounted. A denial or unavailable device leaves structured manual area entry available and does not repeatedly prompt in the same screen lifecycle. The browser may briefly access an exact device coordinate, but it obscures that point before application state or submission. Capacity and PTL tracking use a 40 km privacy area; FTL tracking uses a 20 km privacy area. Only the obscured point, permitted radius, source, and human general-area label reach the server.

## Shipments And Relationships

Businesses post FTL or PTL freight with fixed price, target price, or quote requested. Demand visibility is Open, Partners, or Direct to one transporter.

My Network separates a private Favorite from a mutual operating relationship. Either market side may Favorite the other or request a cross-market connection. Businesses may also Favorite other Businesses so frequent shipment parties rank first in selection; this same-side Favorite never creates a transport partnership.

The posting Business declares whether it is shipper or receiver while remaining the shipment owner and provider-facing decision maker. The opposite party may be another account Business or an external party. After agreement and before assignment, receiver first name and phone are required. The provider must then bind one active in-scope truck and its current Driver to the Shipment; a fleet truck without an active Driver cannot be assigned, and the Shipment cannot move to Assigned without that pair.

The Shipment Board is provider discovery. Every member role receives one My Shipments navigation entry and Tracking is a category inside it. Businesses see Posted, Tracking, and History plus the Post shipment action. Transport providers see Interested, Direct requests, Tracking, and History. Tracking contains only Agreed through Delivered execution records involving the viewer, while Completed and Cancelled records move to History. A recorded interest remains visible to its provider without becoming an agreement or appearing in the Business owner's execution stages.

Shipment dates are shown as Pick up before and Drop off before. Road freight is the only service and is not repeated as a selectable service label.

After a completed shipment, the shipper and receiver Businesses may rate each other once for that shipment. Four- and five-star ratings publish immediately. One- through three-star ratings require an explanatory note and remain private to the submitting Business and administrators until an administrator records an investigation note and either Publishes or Dismisses the rating. Pending and Dismissed ratings never affect the public count or average. These are shipment-domain roles; both accounts remain the same Business account type. The Business that created the shipment remains its owner and provider-facing decision maker.

## Tracking

Every shipment has one tracking obligation:

- **Status timeline** requires real timestamped status or note updates.
- **Approximate location + status** requires a general area on each assigned-provider operational update. Device areas use 20 km privacy for FTL and 40 km for PTL.

The assigned provider cannot reduce the tracking requirement. Only the shipper Business, receiver Business, or administrator may change Approximate location + status to Status timeline. The change is recorded as a tracking event.

Assigned providers may record in-between tracking updates without inventing a status transition. Customer tracking requires the secret code supplied by the shipment owner. Account and non-account shipper or receiver parties may use it; the browser grant expires after five idle minutes. Signed-in assigned transport providers use their internal timeline instead.

Operational proof and temporary shipment-size proof are separate from tracking mode.

## Directory, Profiles, And Contact

Businesses, Fleet Transporters, and Self-managed Drivers have authenticated Public Profiles in one directory. Descriptive text search, account-type filtering, and a separate selected-place proximity filter return bounded pages so a large member catalog is not rendered into one response. City, route, and region labels are never folded into ordinary text search. Each profile stores one general catalog-selected regional base for proximity discovery. Business profiles help members confirm a selected shipper or receiver and show member-declared operating regions or cities. Businesses call their declared route pairs Freight Routes. Fleet Transporters and Self-managed Drivers call theirs Preferred Routes. Every profile may also declare repeatable Local Service Areas as a reviewed city or town plus a 5–100 km radius. Transporter profiles additionally show the fleet roster, Preferred Routes, fresh expiring truck geography, service regions, service summary, and current Public capacity.

Route, load, capacity, profile-base, proximity-filter, and general-area inputs query a bounded local catalog of Ethiopian OpenStreetMap cities, towns, villages, and hamlets, plus Addis Ababa suburbs, neighbourhoods, and quarters, after two typed characters. Geographic authority requires the selected catalog identity and stored coordinates. Free text remains available only for non-geographic landmark or operational notes. The catalog stores coordinates, parent locality, and available place metadata. No full catalog is rendered into a page or sent to a third party during normal use.

Fleet Transporter Home compares Preferred Routes, fresh truck geography, and Local Service Areas with coverage declared by Businesses in that transporter's Connected network. The coverage view uses approximate city route lines, translucent service-area circles, and text evidence. It uses no exact facility pins, inferred facility locations, or live Business locations, and it never claims that an unmatched Business cannot be served.

Coverage comparisons group routes and service areas by ownership rather than source. Every viewed-profile line or circle is solid blue Profile coverage. Every equivalent line or circle belonging to the viewer is grouped as Your coverage and drawn with a warm-brown dashed treatment above the blue geometry so overlap remains visible. Current-partial and planned source details remain available outside the map but do not create additional legend colors. Map geometry and matches use stored coordinates, endpoint circles, point-in-radius, or circle overlap only; labels are display text and unresolved legacy labels cannot produce match evidence.

A Local shipment requires one reviewed locality. The owner may optionally record safe landmark labels and map-selected pickup or drop-off points for execution. Exact points never appear on Boards, pooled-shipment views, Directory, Public Profiles, or administrative summaries. The owner can review what it entered; another authorized shipper, receiver, or assigned provider receives exact points only after agreement.

Deep workspace detail routes provide a Back control. A direct deep link has a safe parent-board fallback, while in-workspace navigation returns to the recorded previous workspace page.

A Business may explicitly opt to display its separate public phone beside shipments visible to transporters. The receiver first name and phone recorded after agreement remain private shipment-party data.

The account email and account phone used for access or account administration are private fields. Public Profile email and phone are separate, explicitly maintained fields. A profile must never fall back to account contacts.

## Verification

Signup immediately creates an active workspace and verification remains a separate evidence-based trust layer. Every supported entity displays gray Not verified or blue Verified badges derived from administrator-reviewed requests. Shipment Board cards show shipment-owner evidence and published Business reviews. Truck Board cards separately show company or owner-operator, truck authority, and assigned-driver evidence. Administrators also receive a separate Rating Reviews queue for private low-rating investigation; publishing or dismissing a rating does not automatically suspend an account, and account or truck enforcement remains an explicit audited Operations action.

- Businesses: Identity and Business license
- Fleet transporters: Identity and Business license
- Self-managed drivers: Identity and Driver identity
- Company drivers: Driver identity, with transporter affiliation shown separately
- Trucks: Vehicle ownership or Owner authorization

Transporters are responsible for documenting vehicle ownership or owner authorization and the identity of their drivers. Verification documents remain private to their submitting owner and administrators. The exact country- and actor-specific document catalog will expand without changing this subject-level model.

## PWA

Loadgistic is installable in standalone mode. Driver workflows are mobile-first with safe-area navigation and touch-sized controls. Authenticated pages remain network-first and are not stored as shared offline HTML. First service-worker installation takes control without reloading an in-progress login or application form. The service worker caches stable visual assets only; Next.js executable chunks are delivered through normal version-aware HTTP caching so upgrades cannot mix stale and current runtimes.

## Customer Support

Every active signed-in member can open one text-only support conversation from
the workspace. Loadgistic stores the conversation and its messages, immediately
renders a sent message in the active chat, assigns work to the least-loaded
available support agent below a configured limit, and keeps waiting work in a
visible queue. The active chat is resolved independently from paginated history;
customers see only their own bounded conversation list, latest-message previews,
and selectable read-only closed threads.
Support-authorized platform team members see only assigned conversations.
Administrators assign Customer, Operations, Trust, Billing, and Support
responsibilities independently; hidden navigation is backed by the same
server-side permission checks. Team members never receive marketplace,
tracking, administrator, or team-management authority. Administrators manage
the platform team and supervise the queue.

Conversation pages use bounded five-second refreshes while visible. Message
history is capped per response and queue/history collections are paginated.
Attachments, voice, presence, typing indicators, external channel mirroring,
and AI replies are outside the initial product.

## Interaction Language

Non-admin workflows are icon-first and low-language. Navigation, task titles,
commands, and consequential choices pair a familiar icon with a short label.
Primary mobile targets are at least 44 CSS pixels. Forms use stable visual
choices for account type, movement, load size, visibility, and truck
configuration. Operating pages avoid explanatory paragraphs except where
privacy, payment, verification, tracking, visibility, or freight terminology
would otherwise be misunderstood. Detail and creation workflows provide a
consistent Back control with a safe parent fallback.

## Growing lists

Directory and marketplace discovery show a useful first page without requiring a
search. Boards, My Shipments, Tracking, Network, Fleet, histories, and
administrative record groups use bounded server-owned pages with deterministic
ordering. Search and filters reset to page one, and page navigation preserves
the active view and filters. Participant-selection controls remain different:
they wait for meaningful input and return only bounded matches.

## Plans

- Business Capacity
- Fleet Transporter Demand
- Self-managed Driver Demand

Manual ETB payment-proof review remains a local MVP workflow. No bank password, PIN, or OTP is collected.

Every newly signed-up workspace receives seven days of trial access. Company
Drivers share the Fleet Transporter's subscription. An administrator may grant
continuing sponsored access to a qualifying starting Business from Operations.
Standard prices are not displayed yet. Approving a payment proof
opens a 30-day access period. After trial or paid access expires, or while a
late payment remains under review, members may still sign in, see a
billing-focused Home, open Account and billing, submit proof, and log out; all
operating screens and commands remain unavailable until access is restored.

Administrators also have a searchable Operations inventory for bounded safe views of users, workspaces, trucks, company-driver authority, loads, latest capacity, network relationships, Business favorites, Preferred Routes, local service areas, and every subscription. Verification, rating, billing, and support queues remain bounded and searchable. Admin commands cover account and truck activation, driver authority, capacity removal, relationship disconnection, route/service-area moderation, and Paid, Expired, or eligible Sponsored plan state. All mutations are audited; credentials, tracking secrets, exact coordinates, and private file paths stay excluded, and immutable evidence or history is not silently rewritten.

## Source Of Truth

Accepted feature specs in `specs/features/` define observable behavior and authorization. `specs/TRACEABILITY.md` records verified evidence. This document describes current product reality and must change with any implemented behavior change.
