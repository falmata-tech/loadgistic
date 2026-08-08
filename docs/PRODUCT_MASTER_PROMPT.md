# Loadgistic Product Master Prompt

Loadgistic is a public road-freight capacity marketplace for Ethiopia. Capacity seekers browse without accounts. Fleet transporters and self-managed owner-operators sign in to publish capacity, present their businesses, and manage provider-owned shipment tracking.

## Audience and promise

The capacity-seeking audience includes workshops, growers, farmers, processors, producers, artisans, distributors, and small manufacturers moving local, regional, and cross-regional freight. The provider audience includes owner-operators, authorized self-managed Drivers, and small fleets. Loadgistic makes existing capacity and credible provider businesses easier to discover; it never guarantees price, availability, earnings, cargo fit, performance, documents, or outcomes.

## Public discovery

The homepage leads directly to the full public Capacity Board. No login is required for Board cards, filters, shared Map view, capacity details, the provider Directory, provider microsites, or tracking-code entry. Public navigation contains Capacity, Transport Providers, Track, About, and provider login or signup. Shipment Board, Post shipment, Business signup, capacity-seeker accounts, and Business public profiles are absent.

The Capacity Board uses cursor-based infinite scrolling in bounded 12–16-card batches, visible loading skeletons, a keyboard-operable Load more fallback, duplicate prevention, restored scroll state, and a clear end message. The list is the fast default. Cards use a lightweight map-like View on map action; they do not each create a live map. One shared map loads on demand, synchronizes with the cards, and clusters crowded signals.

A visitor may choose Show capacity near me. Loadgistic explains the benefit before requesting browser geolocation. The exact visitor point remains in browser memory; only a displaced point and bounded radius reach the server. A browser-only You marker may appear on the shared map. Denial leaves route and area filtering fully usable.

## Capacity signals

Every public signal has one explicit meaning:

- **Available nearby**: one Empty truck is available within a green work radius centered on its already obscured Driver location. No travel date is attached.
- **Available on route**: one Empty or Partial truck is available now on a yellow structured route. Partial capacity is always route-based. No travel date is attached.
- **Next planned trip**: one truck's single future route, shown in orange with an optional weekday/date. When a date is supplied, the weekday and date appear together and the trip expires after that date.
- **Recurring route or working area**: one provider-level blue dashed structured route or cyan dotted permanent working radius with no date. A provider may maintain multiple signals. Each always says Confirm availability; it is not proof that a truck is available now.

Empty means 100 percent capacity. Partial requires an integer from 1 through 99 and implies Partial Truckload. Empty separately declares FTL, PTL, or Both. Multi Pick and Multi Drop are optional. Direct service is implicit. Off Duty hides only the truck's current signal; Busy does not exist.

Current radius and route freshness comes from the latest capacity update rather than a date. Old signals remain explicit during early-market rollout, rank lower, and tell visitors to confirm availability. Fleet capacity requires a current assigned Driver location; fleet owners may preserve but never replace the assigned Driver's obscured point.

The capacity editor keeps status and geometry simple, places location privacy and manual Request or Refresh together around a quiet map, and collapses after saving into the same map-centered published summary. Focused edits open only their relevant section and preserve unopened values.

## Location privacy and maps

The assigned Driver chooses a permitted location privacy radius. The browser displaces the exact coordinate before application state or submission. Only the displaced center, privacy radius, source, timestamp, and general-area label reach the server. No public surface receives a private plate, exact truck coordinate, raw proof path, tracking secret, or account contact.

Map meaning never relies on color alone. A selected signal always shows a violet dashed privacy circle sized by the Driver's chosen location accuracy. Green current work radius, yellow current route, orange next trip, blue dashed recurring route, and cyan dotted recurring working area each have distinct labels and shapes. OpenStreetMap attribution remains visible. Production tile delivery must use a configured provider or self-hosted source with bounded failure behavior rather than relying on community infrastructure as an SLA.

## Transport-provider Directory and microsites

Only fleet transporters and self-managed providers appear in the public Directory. Each published provider has a unique canonical handle such as `/@abebetransport1`. Compatibility provider URLs redirect to that handle. Capacity-seeking Businesses never receive public Directory entries or profiles.

A provider microsite may show its logo or hero, headline, about text, services, verification badges, active fleet presentation, current capacity, next trips, recurring routes or permanent working areas, and provider-controlled public contacts. Phone, WhatsApp, email, and website visibility are independent; hidden values are absent from public HTML and projections. Account contacts never become public fallbacks.

The emailed shipper for a completed provider-owned shipment may submit one verified review of the transport provider without creating an account. Providers never rate guest shippers or receivers. Every valid one- through five-star rating publishes immediately and contributes to the provider's public count and average. A provider may dispute a one-, two-, or three-star rating, but the rating stays public and counted while that dispute is pending; only an audited terminal removal excludes it.

Providers choose validated primary and accent colors with enforced contrast. They cannot inject CSS, HTML, JavaScript, external styles, or hide Loadgistic safety and attribution elements. One optional allowlisted YouTube introduction uses a thumbnail-first, click-to-load privacy-aware embed.

## Verification and safety

Bright category-specific badges make reviewed evidence inviting to inspect while retaining explicit meaning. National ID, Business License, Business Address, Driver License, and pairing-specific expiring Truck Authorization remain private-document categories. Public badges expose only safe review metadata, never files.

Capacity cards, provider microsites, contact moments, and tracking setup warn people to confirm current identity, documents, authority, truck, Driver, cargo fit, price, insurance, and terms directly. A Loadgistic badge is not a guarantee of identity, payment, legality, performance, or cargo safety.

## Provider-owned shipments and tracking

Loadgistic does not accept shipment-demand posts. After agreeing outside the platform, an authenticated provider creates one operational shipment using its own truck and Driver. The provider records a bounded cargo summary, structured route, expected dates, shipper email, receiver email, and tracking mode. The record never enters a Shipment Board or interest workflow.

The provider retains its authenticated shipment history. Capacity seekers do not create accounts or profiles. Each shipment creates a separate high-entropy shipper code and receiver code; only digests are stored. A party enters its code on the public Track page and receives a short-lived browser grant for customer-safe summary and timeline data. Invalid or expired codes reveal no shipment. Codes never appear in URLs, logs, analytics, or clear-text persistence.

The provider or assigned Driver uses one ordered action panel: Loading, En route, Unloading, Complete, and Problem. Only valid next transitions are enabled. Loading, Unloading, and Problem may include optional private proof; En route and Complete do not request proof. Automatic Driver location, when configured, remains obscured before submission.

Completion atomically queues one idempotent email for the shipper and one for the receiver. Email failure does not undo completion. Delivery state supports bounded retries without duplicate successful messages. Party codes and guest-facing access expire 30 days after completion; the provider-owned history remains. Cleanup records safe counts and identifiers without party emails or codes.

## Fleet truth and provider accounts

Fleet size comes from active vehicle rows. Every truck has an immutable Loadgistic platform number, make, model, standardized cargo configuration, and private plate. A company Driver and truck each have at most one active assignment. Self-managed providers own and operate their own truck without a separate company assignment.

Only provider and platform-team accounts are part of the active product. Fleet owners manage trucks, Drivers, capacity, public page settings, shipments, verification, support, and billing. Company Drivers receive owner-controlled duty, capacity, assignment, and tracking permissions. Obsolete Shipment Board, Business-contact, and demand-negotiation permissions are not shown or honored by current routes.

## Plans, support, PWA and administration

Fleet transporter and self-managed provider plans use trial, paid, sponsored where explicitly authorized, or expired access periods. Company Drivers inherit their fleet plan. Manual ETB payment proof remains private and never asks for bank passwords, PINs, or OTPs.

Signed-in providers retain bounded native text support. The PWA remains installable, mobile-first, network-first for authenticated pages, and caches only stable visual assets. Administrators retain audited, bounded Operations, verification, billing, support, capacity, provider, truck, Driver, shipment, email-delivery, and retention-cleanup views without credentials, code digests, exact coordinates, private files, or hidden contacts.

## Interaction and source of truth

Public discovery is visual, immediate, mobile-first, and low-friction. Touch targets remain at least 44 CSS pixels. Important actions pair familiar icons with short labels. Server pages provide useful HTML; client enhancements preserve accessible fallbacks, filters, Back behavior, and scroll restoration.

Accepted feature specs in `specs/features/` define observable behavior and authorization. `specs/TRACEABILITY.md` records verified evidence. This document states current verified product behavior; planned behavior remains linked to draft specs until implementation evidence passes.
