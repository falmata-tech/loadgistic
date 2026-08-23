# Domain model

## Provider

A provider is a Fleet transporter, Owner-operator, or Self-managed driver. It owns or is authorized to operate trucks and owns its capacity signals, public microsite, shipment execution records, reviews, verification evidence, support, and billing state.

Company drivers belong to one named fleet, may be assigned to trucks, and act only through owner-granted capacity or tracking permissions. An Owner-operator manages a truck they own; a Self-managed driver manages another owner's truck through truck-specific authorization. The signup operating model guides private workspace language and verification requirements but never marks a document verified.

## Public capacity signal

Each truck has one latest current state:

- `EMPTY`, `PARTIAL`, or `OFF_DUTY`.
- Empty accepts Full, Partial, or both; Partial accepts Partial only. Either status may publish a Service area or Capacity route.
- `RADIUS` is the internal value for a Service area built from one searchable center city and three through five surrounding boundary cities. The map renders the boundary as a polygon.
- `ROUTE` is the internal value for an immediate one-direction Capacity route containing two through five ordered structured places and no date.
- Location privacy accuracy is independent of Service area geometry and may be changed whenever the authorized Driver refreshes location.
- Off Duty, expired, unpublished, and superseded signals are excluded from public discovery.

A provider may publish one undated regular-service signal. It is either a Service area with one center and three through five surrounding catalog places or a two-way Capacity route with two through five ordered places. It is a market signal rather than current truck availability and requires direct confirmation.

Anonymous discovery combines only public truck facts. Service-area queries compare a structured requested place and distance with the complete truck polygon. Capacity-route queries compare structured freight endpoints with every ordered segment of current or regular routes, including a freight segment that lies within a longer route, while respecting direction. Plain-text search covers public truck and transporter facts plus every stored route and Service-area city label. Browser permission only centers the map; visitor proximity remains off until the visitor explicitly enables it, at which point the server receives a separately displaced location. Results explain the geographic evidence without claiming dispatch suitability, price, or cargo fit.

## Private capacity network

Current capacity may target either the public Market or a Private capacity
network. Private current geometry and approximate location do not enter the
anonymous projection; categorical Empty/Partial state may remain discoverable
through the provider's separate public regular-service geometry, whose marker
is explicitly not presented as current location. A truck-and-email Capacity access grant lets a verified account-free
visitor see that truck in Shared capacity with the exact approximate-location
radius selected by its Driver. One verified email sees every active grant for
that email after one ten-minute, single-use email OTP; the signed restricted
visitor session creates no member profile, password, workspace, or dashboard.
It expires after 30 minutes without deliberate visitor activity, renews only
from bounded explicit interaction, and can be ended immediately with Log out.
Revocation removes only the affected truck immediately. A separate
platform audience represents `Share with Loadgistic` without inventing an email
identity and is readable only by Operations-authorized administrators. The one
regular Service area or Capacity route remains public.

## Sponsor

A Sponsor is either a linked Loadgistic transporter or an outside advertiser
with bounded public name, description, and HTTPS website and/or public phone.
An administrator places a Sponsor in one dated regional programme position.
Placements do not change Market ranking or the featured-transporter roster;
they supply the disclosed Sponsors panel and deterministic names for Sponsor
breaks.

## Assisted matching conversation

An account-free visitor may open one private Assisted matching conversation
using an email, required callback phone, and short message from the persistent
public launcher. It participates in
the bounded Support assignment workflow and may contain specifically requested
private image or PDF attachments. It is not a Load, public shipment request,
demand signal, ranking input, transaction, or visitor account. Guest access is
held by a signed browser session and deterministic recovery code whose plaintext
is neither stored nor logged. Minimizing or changing public routes preserves the
active session. Guest or team closure retains a read-only transcript and permits
a separate new conversation.

Demonstration geography is location-keyed rather than randomly combined: a current or regular Capacity route passes through or approaches a truck's approximate city, while a current or regular Service-area polygon uses a nearby center and boundary. These examples support discovery and are not live navigation instructions.

## Provider microsite

Every published provider owns a unique handle and may configure accurate headline, description, services, one profile identity image, and independent visibility for phone, WhatsApp, email, and website. Loadgistic controls one shared white-space theme, hero treatment, safety language, and optional introductory video. Public pages project every active truck through a safe detailed card; only a current Empty or Partial signal supplies a lazily opened map, while a truck without current public capacity exposes no stale location. Public pages also show the provider's one regular-service signal, reviewed evidence badges, and verified-shipment reviews.

## Provider Tracking session

A Tracking session is an execution record created only after provider and customer agree offline. It contains one assigned truck/Driver, structured origin and destination, bounded cargo summary, optional expected dates, the Status timeline, one private customer-owner email, and an explicit Status-only or Status-and-approximate-location choice. It never becomes public demand.

The lifecycle is explicit: `CREATED → TO_PICKUP → LOADING → IN_TRANSIT → UNLOADING → COMPLETED`, with a direct Created-to-Loading edge and governed `ISSUE` transitions. Proof is accepted only for Loading, Unloading, and Issue events. A location-enabled session accepts a browser-obscured coordinate only from its assigned Driver during To Pickup or In Transit, throttles background refreshes to ten minutes, and projects that approximate point to a guest only while the session remains in one of those travel states.

## Guest tracking grant

Creation issues one stable customer-owner code and Track link. Only the keyed code digest is stored; the owning provider can derive and display the same active code again. A successful unlock creates a short-lived browser session. One idempotent access email and one completion email are addressed to the customer owner. The completion email carries a separate review code because shared Tracking access does not authorize review. Guest access and the customer email are removed 30 days after completion, while provider history remains.

## Provider review

The emailed customer owner may submit one rating after completion. Every score publishes and counts. The provider may dispute a one-, two-, or three-star rating; a pending dispute remains visible and counted until a platform reviewer decides it.

## Retired demand model

Shipment-demand posts, interests, Direct requests, pooled/along-route groups,
Business accounts/profiles, and demand-side member relationships are not part
of the active model. Local development migrations delete their fake fixtures;
current routes block or redirect their former surfaces. Truck-scoped Private
capacity network grants are a separate access-control model, not a restored
demand relationship graph.
