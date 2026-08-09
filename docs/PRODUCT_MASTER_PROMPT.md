# Loadgistic Product Master Prompt

Loadgistic is a public road-freight capacity marketplace for Ethiopia. Capacity seekers browse without accounts. Fleet transporters and self-managed owner-operators sign in to publish capacity, present their businesses, and manage provider-owned shipment tracking.

## Audience and promise

The capacity-seeking audience includes workshops, growers, farmers, processors, producers, artisans, distributors, and small manufacturers moving local, regional, and cross-regional freight. The provider audience includes owner-operators, authorized self-managed Drivers, and small fleets. Loadgistic makes existing capacity and credible provider businesses easier to discover; it never guarantees price, availability, earnings, cargo fit, performance, documents, or outcomes.

## Public discovery

The homepage is the full public Capacity Board rather than a preview that leads to a second market page. Its hero, filters, List/Map controls, current cards, and cursor feed form one canonical public discovery surface. The legacy `/capacity` address redirects to `/` and preserves supported filters. No login is required for Board cards, filters, shared Map view, capacity details, the provider Directory, provider microsites, or tracking-code entry. Public navigation contains Capacity, Transport Providers, Track, About, and provider login or signup. Shipment Board, Post shipment, Business signup, capacity-seeker accounts, and Business public profiles are absent.

The Capacity Board uses cursor-based loading in bounded 12–16-result batches, visible loading feedback, a keyboard-operable Load more fallback, duplicate prevention, restored view state, and a clear end message. One shared interactive map is the primary default; List cards are the secondary view and never create one map per card. The List uses two balanced cards per row on wider screens and one per row on narrow screens. Every card exposes up to two regular two-way corridors as `Place A ↔ Place B` without hiding them behind a disclosure. A compact search bar stays directly accessible over the map, detailed availability and geometry filters open in a dismissible modal, and the complete map key remains visible. Its symbols match the map: pointed pins represent Empty or Partial, circles represent approximate location and current radius, a solid line represents the directional current corridor, and dashed lines represent up to two regular two-way corridors. The map starts at a detailed Ethiopia view and constrains panning to the current Ethiopia market rather than exposing a world or Africa-wide fallback. It synchronizes with the list and clusters crowded signals before selection. Every unclustered signal is a rounded, pointed map pin using Loadgistic's existing cargo-configuration image, a green Empty tag or bright-yellow Partial tag, and visible status text so visitors can scan vehicle type and current space without opening a card. Artwork is centered and enlarged within a proportionate pin head; the unusually long rigid-truck-with-trailer artwork uses the corresponding heavy-rigid truck image on the map so the truck remains legible. A circular availability meter surrounds the image: 100% is a complete green ring, while lower availability shortens the ring and progresses through yellow and orange to red. Marker status remains distinct by image, shape, and text from corridor lines and radius circles. Truck and visitor-location summaries appear only on hover or keyboard focus, are offset above the related marker, and retain the tooltip pointer. Selecting one truck enters a focus state: every other truck marker and cluster disappears, the selected truck receives a high-contrast marker without a redundant permanent text label, and initial bounds prioritize its approximate location plus current radius or corridor rather than its regular corridors. Its adjacent responsive information card supplies the identity and capacity details without an internal scrollbar, and a clear × control closes the card, exits focus, and restores clustering.

When the Board becomes interactive it immediately requests browser geolocation so the primary map can open around the visitor's surrounding area. The exact visitor point remains in browser memory; only a displaced point and bounded radius reach the server. Success visibly confirms a fresh reading, shows a browser-only You marker, and exposes possible-distance ranges in List view. Denial, timeout, unavailable device service, unsupported browser, insecure context, and an outside-market reading receive distinct guidance without blocking the full Board. A visible retry action attempts location again after the visitor enables site permission.

## Capacity signals

Every public signal has one explicit meaning:

- **Available by radius**: one Empty or Partial truck is available now within a green work radius centered on its already obscured Driver location. No travel date is attached.
- **Available by corridor**: one Empty or Partial truck is available now on a yellow structured corridor. No travel date is attached.
- **Regular corridor**: one provider-level blue dashed structured corridor with no date. A provider may maintain no more than two. Each always says Confirm availability; it is not proof that a truck is available now.

Empty means 100 percent capacity. Partial requires an integer from 1 through 99 and implies Partial Truckload. Empty separately declares FTL, PTL, or Both. Multiple pickups and Multiple drop-offs are optional. Direct service is implicit. Off Duty hides only the truck's current availability; Busy does not exist.

Current radius and corridor freshness comes from the latest capacity update rather than a date. Old signals remain explicit during early-market rollout, rank lower, and tell visitors to confirm availability. Fleet capacity requires a current assigned Driver location; fleet owners may preserve but never replace the assigned Driver's obscured point.

The capacity editor keeps status and geography simple and collapses after saving into one map-centered published summary. That same summary includes current Empty or Partial capacity, its radius or corridor, up to two provider-level regular corridors, and approximate current location. A high-contrast labeled marker keeps the approximate truck area visible above its overlapping current geography. Each editable fact opens only its focused editor; Edit current capacity opens the ordered current-capacity workflow. Regular-corridor controls remain inside this capacity console and never appear as a detached planning section. Approximate location radius and Refresh truck location remain direct controls beneath the summary map; neither sends the Driver into an editing workstation. A direct location action persists the browser-obscured point, chosen radius, and timestamp without changing capacity facts, then confirms that it was saved.

## Location privacy and maps

The assigned Driver chooses a permitted location privacy radius. The browser displaces the exact coordinate before application state or submission. Only the displaced center, privacy radius, source, timestamp, and general-area label reach the server. No public surface receives a private plate, exact truck coordinate, raw proof path, tracking secret, or account contact.

Map meaning never relies on color alone. A selected signal always shows a violet dashed circle sized by the Driver's chosen location accuracy. All user-facing copy calls it Approximate current location or Approximate location radius; location privacy remains an internal data-policy term. Green current radius, yellow current corridor, and blue dashed regular corridors each have distinct labels and shapes. OpenStreetMap attribution remains visible. Production tile delivery must use a configured provider or self-hosted source with bounded failure behavior rather than relying on community infrastructure as an SLA.

## Transport-provider Directory and microsites

Only fleet transporters and self-managed providers appear in the public Directory. Each published provider has a unique canonical handle such as `/@abebetransport1`. Compatibility provider URLs redirect to that handle. Capacity-seeking Businesses never receive public Directory entries or profiles.

A provider microsite may show its logo or hero, headline, about text, services, verification badges, active fleet presentation, current radius/corridor capacity, up to two regular corridors, and provider-controlled public contacts. Phone, WhatsApp, email, and website visibility are independent; hidden values are absent from public HTML and projections. Account contacts never become public fallbacks. Loadgistic sets the page colors, hero presentation, and optional introduction video; providers edit their facts and contacts without having to design the microsite.

The emailed customer owner for completed provider-owned Tracking may submit one verified review of the transport provider without creating an account. Providers never rate the guest customer or people with whom the owner shared access. Every valid one- through five-star rating publishes immediately and contributes to the provider's public count and average. A provider may dispute a one-, two-, or three-star rating, but the rating stays public and counted while that dispute is pending; only an audited terminal removal excludes it.

Loadgistic-controlled provider configuration supplies validated primary and accent colors, approved hero treatment, and any optional allowlisted YouTube introduction. Provider update commands cannot change those fields, inject CSS, HTML, JavaScript, external styles, or hide Loadgistic safety and attribution elements. A configured introduction uses a thumbnail-first, click-to-load privacy-aware embed.

## Verification and safety

Bright category-specific badges make reviewed evidence inviting to inspect while retaining explicit meaning. National ID, Business License, Business Address, Driver License, and pairing-specific expiring Truck Authorization remain private-document categories. Public badges expose only safe review metadata, never files.

Capacity cards, provider microsites, contact moments, and tracking setup warn people to confirm current identity, documents, authority, truck, Driver, cargo fit, price, insurance, and terms directly. A Loadgistic badge is not a guarantee of identity, payment, legality, performance, or cargo safety.

## Provider-owned Tracking

Loadgistic does not accept shipment-demand posts. After agreeing outside the platform, a provider owner, self-managed Driver, or company Driver assigned to the chosen truck starts one operational Tracking session. The provider records a bounded cargo summary, structured route, optional expected dates, one customer-owner email, and the simple Status timeline. The record never enters a Shipment Board or interest workflow.

The provider retains its authenticated Tracking history. Capacity seekers do not create accounts or profiles. Each Tracking session creates one stable high-entropy customer-owner code and one public Track link. The code is emailed to the owner, may be shared with anyone the owner trusts, and remains retrievable by the owning provider while active; persistence stores only its keyed digest. A holder enters the code on the Track page and receives a short-lived browser grant for customer-safe summary and timeline data. Invalid or expired codes reveal no session. Codes never appear in URLs, logs, analytics, or clear-text persistence.

The provider or assigned Driver uses one compact ordered action panel: Loading, En route, Unloading, Complete, and Problem remain visible together while only valid next transitions are enabled. Loading, Unloading, and Problem may include one optional private photo; En route and Complete do not show an upload. Automatic Driver location, when configured, remains obscured before submission.

Creation queues one idempotent access email with the Track link and code. Completion atomically queues one idempotent owner email with the final record and a separate review code; the shareable Tracking code alone cannot publish a review. Email failure does not undo creation or completion. Delivery state supports bounded retries without duplicate successful messages. Owner-code access expires 30 days after completion; the provider-owned history remains. Cleanup records safe counts and identifiers without customer emails or codes.

## Fleet truth and provider accounts

Fleet size comes from active vehicle rows. Every truck has an immutable Loadgistic platform number, make, model, standardized cargo configuration, and private plate. A company Driver and truck each have at most one active assignment. Self-managed providers own and operate their own truck without a separate company assignment.

Only provider and platform-team accounts are part of the active product. Fleet owners manage trucks, Drivers, capacity, public business information, Tracking, verification, support, and billing. Loadgistic controls microsite presentation. Company Drivers receive owner-controlled duty, capacity, assignment, and Tracking permissions. Obsolete Shipment Board, Business-contact, and demand-negotiation permissions are not shown or honored by current routes.

## Plans, support, PWA and administration

Fleet transporter and self-managed provider plans use trial, paid, sponsored where explicitly authorized, or expired access periods. Company Drivers inherit their fleet plan. Manual ETB payment proof remains private and never asks for bank passwords, PINs, or OTPs.

Signed-in providers retain bounded native text support. The PWA remains installable, mobile-first, network-first for authenticated pages, and caches only stable visual assets. Administrators retain audited, bounded Operations, verification, billing, support, capacity, provider, truck, Driver, shipment, email-delivery, and retention-cleanup views without credentials, code digests, exact coordinates, private files, or hidden contacts.

## Interaction and source of truth

Public discovery is visual, immediate, mobile-first, and low-friction. Touch targets remain at least 44 CSS pixels. Important actions pair familiar icons with short labels. Server pages provide useful HTML; client enhancements preserve accessible fallbacks, filters, Back behavior, and scroll restoration.

Accepted feature specs in `specs/features/` define observable behavior and authorization. `specs/TRACEABILITY.md` records verified evidence. This document states current verified product behavior; planned behavior remains linked to draft specs until implementation evidence passes.
