# Architecture Decisions

## ADR-001 — Next.js on Node.js

The application uses Next.js App Router on Node.js. This corrects the prior bare-Node implementation and provides server rendering, structured routing, route handlers, PWA compatibility, and production deployment paths.

## ADR-002 — Local SQLite adapter

Use Node's built-in SQLite for deterministic offline persistence. Keep all persistence behind repository functions and include a Supabase PostgreSQL/RLS target. SQLite remains a local and test adapter; public production remains blocked until repository and identity parity are proven against Supabase.

Superseded by ADR-041. The historical adapter remains only long enough to support the reviewed migration; it is not an accepted application runtime after PostgreSQL cutover.

## ADR-003 — One canonical shipment

A request, load, and operating shipment use one record. UI terminology changes by workflow stage, but data is not copied into a second entity.

## ADR-004 — Minimal capacity

Capacity is truck-level and intentionally direct: Empty, Partial, or Off Duty; Empty-only FTL/PTL/Both acceptance; optional Multi Pick and Multi Drop; assigned-Driver approximate area; an undated Empty Service area or Empty/Partial Capacity route; Public Market or Private network visibility; and separate capacity/location freshness. Direct service is implicit. Partial implies PTL and requires a Capacity route. Empty and Partial remain discoverable with explicit age labels until the provider selects Off Duty; a full or unavailable truck is Off Duty and is not shown in discovery.

## ADR-005 — Server-rendered forms

Use normal HTML forms and Route Handlers for most actions. This is resilient on weaker devices and connections and reduces unnecessary client-side state.

## ADR-006 — Linked executable specifications

Use Markdown specifications with validated YAML front matter. Base specs define frontend, backend, and deployment constraints; vertical feature specs link to them and express material behavior with Given/When/Then scenarios. Completion requires tests and rollout evidence, not documentation alone.

## ADR-007 — Pragmatic hexagonal and DDD boundaries

Adopt ports/adapters, SOLID dependency direction, and DDD vocabulary without mandating class-based implementation. Pure domain functions remain preferred for deterministic rules. Extract explicit outbound ports as adapters multiply; do not perform a speculative rewrite of the working SQLite MVP.

## ADR-008 — CI as a release guardrail

GitHub Actions performs locked dependency installation, specification and source validation, tests, TypeScript checking, a production build, and desktop/mobile Chromium workflows with read-only repository permissions. Dependabot maintains npm and workflow dependencies. Branch protection should require the `validate` and `e2e` jobs before merge.

## ADR-009 — Browse permission is not shipment-party permission

Treat Open and Partners load visibility as authenticated read-only discovery. Participant shipment activity, proof files, and execution transitions require an actual shipment party: Business owner, assigned provider organization/profile, or administrator. Partners visibility requires a mutual Connected relationship to the shipment owner. Application and payment-proof approvals/rejections are terminal in the MVP. A separate internal-notes channel is intentionally retired; operational notes belong to governed timeline updates.

## ADR-010 — Browser fixtures are isolated from development data

Run Playwright against a reset, dedicated SQLite database, port, and `.next-e2e` artifact directory rather than reusing the local development server's standard `.next` output. The parent E2E runner restores Next's generated TypeScript metadata after Playwright exits. Local fixture credentials remain in setup documentation and test code, while public authentication pages render empty credential fields. This keeps test convenience from changing public UI, developer business records, tracked type metadata, or live generated modules.

The browser suite uses one worker because both viewport projects intentionally exercise one deterministic SQLite fixture and several owner-authorized workflows mutate shared state. Serial execution keeps role transitions and authorization assertions ordered and prevents concurrent Next development compilation from aborting navigation.

## ADR-011 — Driver home and temporary load proof

Self-managed Drivers land on their truck capacity control panel. Fleet transporters land on a company management dashboard and update truck capacity inside My Fleet, where every update remains attached to one real vehicle. Authenticated workspaces do not render a duplicate Capacity Market: Truck Market and Daily Featured Transporters use their canonical public routes while the active session is preserved. Retired `/app/capacity` addresses redirect to `/`. Driver Home remains the provider's map-centered capacity-management workspace.

Tracking is chosen when the provider creates a session: Status only or Status and approximate location. One ordered action panel shows Going to pickup, Loading, En route, Unloading, Complete, and Problem, disabling invalid actions. Loading, Unloading, and Problem accept one optional image; the travel and completion actions do not. For a location-enabled session, only the assigned Driver may submit a browser-obscured point, only during Going to pickup or En route, and at most once every ten minutes except an explicit retry. The customer map exposes the chosen uncertainty radius and never the exact device coordinate; leaving a travel state immediately removes location from the guest projection.

## ADR-012 — Visual trucks and staged contact disclosure

Use one image-backed cargo-configuration catalog across freight creation, driver Home, Fleet, and Capacity instead of tonnage labels. A Business may expose one designated load phone to authenticated transporters only through an explicit opt in. Receiver first name and phone are shipment-party data entered after commercial agreement; Freight assignment is blocked until both are present.

## ADR-013 — Discovery, Tracking, and authenticated directory

Keep one canonical shipment record while separating its UI by permission and stage. The Shipment Board is provider discovery plus interest. Every member role uses one My Shipments destination; Businesses receive Posted, Tracking, and History, while providers receive Interested, Direct requests, Tracking, and History. Tracking is an execution category rather than a separate destination. Recorded provider interests remain in that provider's workspace without becoming a Business-visible agreement stage.

An Agreed Shipment must bind one active provider-owned truck and its current Driver before it moves to Assigned. Fleet owners may choose any driver-backed truck in their fleet, company Drivers may choose only their own current truck, and owner-operators are paired with their own active truck. Shipment parties see the permanent platform number, make, model, cargo configuration, and Driver; plates remain operationally private.

Use one authenticated directory for Businesses, fleet transporters, and self-managed drivers. Business profiles support participant confirmation and completed-load reputation. Private account email and phone are never public-profile fallbacks; only explicitly maintained profile contacts are displayed.

## ADR-014 — Evidence-derived entity verification

Store verification as immutable-subject requests reviewed by administrators rather than mutable decorative booleans. A request identifies its subject type and ID, verification category, private file, submitter, state, reviewer, notes, and timestamps. Public badges are projections of approved requests. The initial categories cover identity, Business license, driver identity, vehicle ownership, and owner authorization; later document-name detail extends the catalog without changing historical records.

## ADR-015 — Declared-region coverage and explainable route matching

Store Business operating regions as member-entered city or regional names and store Public Profile coverage as explicit origin/destination route pairs. Render approximate routes only when both places exist in the reviewed Ethiopia place reference catalog; retain unknown member-entered places in lists and comparisons without inventing coordinates. Map lines and city markers indicate regional route relationships, not exact facilities, drive paths, live movement, distance, or serviceability.

For Businesses, route evidence counts canonical loads posted on a matching endpoint pair and the subset that reached tracked execution. For fleet transporters and self-managed drivers, it counts matching capacity reports and the subset of assigned shipments that reached tracked execution. Evidence is labeled Tracked activity, Reported activity, or Declared only; it is not a trust score or guarantee.

Shipment Board and Truck Board matching uses normalized recorded endpoint names. Results receive only three explainable strengths: both route cities align, one city aligns, or no recorded match. Matching affects filtering and order but never visibility, assignment, pricing, or authorization.

The public homepage centers Ethiopian makers, growers, processors, producers, and the small transport providers that connect them to markets. This reflects documented manufacturing and logistics priorities without claiming public-sector sponsorship.

## ADR-016 — Fleet-driver capability policy

A `DRIVER` may be either self-managed through a provider profile or employed through one transporter organization. Self-managed drivers retain full provider authority. Company drivers receive owner-controlled Shipment Board, Business contact, negotiation, and rich capacity permissions, with every command enforced in repository services and attributed to the acting driver.

Company drivers operate only assigned organization vehicles. Duty On and Off is a narrow command that remains available even when rich capacity control is disabled: Off Duty hides the truck, while On Duty restores the most recent owner-configured Empty or Partial facts only after the assigned Driver supplies a fresh obscured device location. If no prior active configuration exists, an owner must configure the truck first. The duty command never stamps old coordinates as newly refreshed. Fleet owners retain organization-wide visibility and non-location authority.

## ADR-017 — Mutual network and code-gated customer tracking

Model Business-provider relationships as three distinct meanings: a private Favorite owned by either side, a directional Pending request, and a mutual Connected relationship. Only Connected relationships authorize Partners-only loads and capacity. Existing saved relationships migrate compatibly to Connected. Company drivers do not mutate the company network.

Customer tracking is an additional customer-safe view, not a bearer link. Its human-entered code is derived with the server secret, stored only as a keyed digest, and omitted from URLs. An account or non-account shipper or receiver who receives the code from the load owner may unlock a five-minute HTTP-only grant bound to the browser and load. Browser activity may refresh the grant; five minutes without activity clears it. Assigned providers continue to see the same real tracking events in their internal Tracking workspace and cannot unlock the customer view.

Fleet owners edit capacity on one truck-specific Fleet page. They cannot declare or refresh the truck's current area, because the owner's phone or typed city does not establish the truck's position. An owner save preserves the latest assigned-Driver obscured area and its timestamp; no active signal may publish before that Driver has recorded one. Only an authorized assigned company Driver or self-managed Driver may submit an already obscured device area. Ethiopian nearest-city labels use the reviewed local place catalog, keeping exact coordinates and third-party API keys out of the request path.

## ADR-018 — Authenticated profiles stay inside the workspace shell

`/app/providers` and `/app/providers/[handle]` are the canonical authenticated Directory routes. Legacy `/companies` URLs authenticate and redirect into those routes.

Public Profiles are member-only operational screens. Keeping them under the role-aware app shell preserves the user's sidebar or mobile navigation when moving between Directory, Network, Capacity, Tracking, and a profile. The compatibility routes preserve old bookmarks without maintaining a second profile UI.

## ADR-019 — Local settlement catalog, load ownership, and virtual pooling

Store a repeatably imported Ethiopia settlement catalog in the local SQLite adapter. The preferred lightweight setup downloads `place=city|town|village|hamlet` objects nationally and `suburb|neighbourhood|quarter` objects in Addis Ababa through Overpass; an ignored Geofabrik PBF plus Osmium is an alternate input. Normal application search is local, starts after two characters, uses an indexed prefix query before a bounded contains fallback, and retains a built-in fallback. This avoids operating Nominatim or sending normal route searches to a third party.

Separate `load_owner_organization_id` and `load_owner_party_role` from shipper and receiver roles. The posting Business remains owner regardless of whether it ships or receives. External shipper or receiver identity is load-scoped and receives no account authorization; possession of the owner-distributed secret code grants only the customer-safe tracking view.

PSTL is a deterministic, read-only projection over viewer-authorized Posted PTL loads. Compatible origin and destination settlement coordinates create a virtual group. A group has no status, price, assignment, acceptance, or mutation API, and disabling it leaves every source load unchanged.

Shared-load discovery presents two modes in one workspace because both help a provider use one truck across multiple independently negotiated loads, while preserving their operational difference. Pool together uses complete-link endpoint and deadline compatibility so every member is compatible with every other member rather than being admitted through a transitive neighbor. Along the route builds bounded forward sequences where one load's drop-off is near the next load's pickup and the recorded deadline order remains feasible. Both projections are deterministic, re-authorized on read, and explicitly advisory because Loadgistic does not yet record enough cargo dimensions or scheduled appointment times to prove fit.

## ADR-020 — Authoritative routes, truck identity, and platform operations

Use `profile_routes` as the single durable source for member-declared route pairs. Business-facing UI calls these Freight Routes; fleet transporters and self-managed drivers see Preferred Routes. The legacy company-page corridor field is retained only for additive database compatibility and is not written or rendered as a second route model.

Current partial-capacity routes are undated published signals whose age follows the capacity update; planned truck routes remain dated capacity facts rather than profile declarations. Matching and maps combine the latest active route for the viewer's eligible trucks with stable profile routes, preserve each source label in operational data, and label an older latest route rather than silently dropping it. Past dated routes remain excluded. Comparison-map styling represents ownership rather than route source: all viewed-profile routes are solid blue and all viewer-owned routes are consolidated under one warm-brown dashed Your routes layer drawn above them. Current-partial and planned routes do not create separate comparison legend colors. Public truck capacity may show the owner's Preferred Routes for context without implying that every preferred route is the current truck movement.

Every truck receives one unique, immutable `LG-TRK-*` platform number. Member discovery and Public Profiles use that number; license plates remain private operational data for the truck owner and administrators.

Deep workspace detail routes expose a Back link with a route-specific fallback that works before client hydration. A safe prior workspace page is reached by popping browser history so the control cannot create a two-page navigation loop.

Administrators receive bounded, searchable Operations projections across users, workspaces, trucks, company-driver authority, loads, latest capacity, network relationships, Business favorites, Preferred Routes, local service areas, and subscriptions. It excludes credentials, sessions, tracking secrets, exact coordinates, and proof paths. Account/truck controls, capacity removal, network/route moderation, driver permissions, and monthly or sponsored plan state are explicit audited commands. Immutable events, messages, reviews, evidence, and audit records remain history rather than generic editable rows.

## ADR-021 — Private low-rating moderation

Treat a completed-load Business rating as either public reputation or a private investigation report. Four- and five-star ratings publish immediately. One- through three-star ratings require a note, enter Pending, remain readable only by the submitting Business and administrators, and do not affect the subject's public count or average.

An administrator reviews safe load and participant context, records a required investigation note, and makes one terminal Publish or Dismiss decision. The original rating and note remain preserved for accountability. Moderation notifies the submitter and writes an audit record, but it does not automatically suspend an account or truck; those remain separate reversible Operations commands so a reputation decision cannot silently become platform enforcement.

## ADR-022 — Separate minimal and comprehensive development fixtures

Keep the default database reset and isolated automated-browser fixture small and
deterministic. Provide a separate explicit development-only stress command that
resets the configured SQLite database and creates deterministic records across
every application table and material workflow state. Refuse that command before
database access in Production, bound its scale, print only non-sensitive counts,
and validate foreign keys and domain ownership after generation.

Dense discovery and operational screens must request bounded result pages.
Directory, application, verification, and billing views use server-side search,
status filters where applicable, and pagination. The Operations landing view
uses compact per-section limits while an explicit search may return a larger
bounded set. This keeps the ordinary fixture fast while making realistic UI
density and relational integrity repeatable.

The standard stress profile includes a named cross-market cohort with unique
relationship pairs. Its documented accounts cover Connected, Pending,
Favorite-only, and Declined relationships plus Public, Partners, Direct, and
hidden marketplace records. Dense browser checks assert the expected named
counterpart or record on each relevant screen so fixture volume cannot mask a
relationship-authorization regression.

## ADR-023 — Workspace subscription access periods

Authorize paid platform access at the workspace boundary rather than per user.
Business owners and members share one Business subscription; fleet owners and
company Drivers share one Fleet Transporter subscription; a self-managed Driver
uses the subscription attached to its provider profile. Administrators remain
outside subscription enforcement.

Successful self-service signup atomically creates an active workspace and starts
a seven-day trial. Signup separately records Fleet transporter, Owner-operator,
or Self-managed driver so the workspace can request Truck ownership or Truck
authorization correctly. Company drivers are created by their named fleet and
are not a public signup type. Verification is not an activation gate. An administrator may
separately grant continuing sponsored access to a qualifying starting Business
from Operations; transporter categories cannot receive that decision. Standard
plan prices remain undisclosed until the commercial schedule is accepted. A
submitted proof records the amount actually paid, and administrator approval
opens a new 30-day period from review.

Expired, unpaid, and late-payment-review states preserve authentication, a
billing-focused Home, Account and payment submission, and logout. Server page
authorization and application-service commands both deny operating access, so
removing links is never the enforcement boundary.

## ADR-024 — Mixed local geography and bounded discovery queries

Model freight movement as Local, Long-distance routes, or Both where the actor
contract permits it. Local coverage is one reviewed place plus a 5–100 km
service radius and renders as a translucent circle; intercity coverage remains
an origin/destination pair and renders as a line. Comparison uses point-in-area,
area-overlap, or endpoint alignment only when structured coordinates exist.
Free-text landmarks remain useful operational labels but never become verified
geographic evidence.

Load pickup and drop-off points are execution data. The local SQLite adapter
keeps them on the shipment record but removes them from every Board, pooling,
directory, profile, and administrative projection. The load owner can review
points it entered; another shipment party receives them only after agreement.
The Supabase target stores those coordinates in a separate RLS-protected table
because row-level security cannot hide selected columns safely.

Discovery and operations screens own pagination at the query boundary. Queries
use deterministic ordering, explicit result limits, supporting indexes, and
batched verification summaries. Manual geographic filters execute before
pagination. Virtual PSTL grouping uses a bounded candidate window; owned-route
ranking evaluates the full authorized local result set so recency cannot hide a
valid match. Direct capacity detail uses an authorized identifier lookup rather
than scanning a Board projection. Repeatable data normalization is recorded in
schema metadata and does not run on every process startup.

## ADR-025 — Coordinate-authoritative route and proximity matching

Treat a catalog place reference and its persisted latitude/longitude as the
authority for every geographic filter, route comparison, map line, and profile
base. Country-qualified names remain presentation data. Ordinary text search
may inspect identity and descriptive content, but never city, route, region, or
current-area labels. A typed location without a selected catalog identity
cannot create or update geographic authority.

An intercity query is two independently adjustable endpoint circles. Direct
mode preserves origin and destination; Either mode also evaluates the reversed
orientation. Every fresh current-partial and eligible planned route belonging
to a truck is evaluated, then the lowest normalized worst-endpoint distance,
total endpoint distance, and freshness determine the explainable result.
Current truck location is an uncertainty circle: Prefer mode orders overlapping
areas first, Require mode excludes non-overlap, and neither mode exposes stored
coordinates.

SQLite registers one deterministic great-circle distance function and stores
additive references and coordinate columns for the local adapter. Legacy labels
are backfilled only when the place catalog or built-in Ethiopia fixture resolves
them unambiguously; unresolved records remain visible but cannot match. The
Supabase target uses PostGIS geography points, GiST indexes, and `ST_DWithin`.
This preserves one domain contract while allowing the production adapter to
execute indexed geographic predicates before pagination.

## ADR-026 — Availability freshness and native customer support

Model truck duty, cargo-space availability, and signal freshness independently.
Empty and Partial are On Duty; Off Duty is the explicit hidden state.
Empty and Partial remain visible during the early-market rollout when their
updates become old. Capacity age and approximate-location age are presented
separately and older records carry clear confirmation guidance. The public map
is geographic and unranked, so freshness never creates a provider ranking.
Only explicit Off Duty, deactivation, or unpublishing removes a truck from
discovery.
Partial live routes are undated signals whose freshness follows the capacity
update. Empty Specific routes may carry an optional upcoming travel date; dated
routes stop matching after that day, while undated routes follow signal freshness.
For Local or Both movement, the assigned
Driver's device-derived place is the service-area center; the Driver chooses only
a bounded 10–50 km radius. Pre-deployment Busy fixtures are converted to Off
Duty rather than inferred into a new capacity state.

Implement a deliberately bounded native support inbox instead of buying a
per-agent service or operating a second chat platform. Durable conversations,
text messages, assignments, agent state, and lifecycle events live in the same
authoritative persistence boundary as Loadgistic identities. The first release
does not include attachments, typing indicators, presence, voice, bots, or
external-channel message mirroring.

Use ordinary authenticated HTTP commands and refresh a visible conversation
every five seconds. Pause refresh when the page is hidden, return only the 50
latest messages, paginate queue/history lists, and index assignment and recency
columns. This is intentionally compatible with serverless Next.js because no
process-local connection is authoritative. Supabase Realtime may later notify
clients about committed rows, but PostgreSQL remains the source of truth.

One member may have one open conversation. Creation atomically assigns it to
the least-loaded available SUPPORT user below their configured open-conversation
limit, with deterministic oldest-assignment tie breaking. Otherwise it waits.
An eligible agent may atomically claim the oldest waiting conversation.
The member Support home always presents one primary lifecycle action: New chat
when none is open or Continue chat when one is active, with closed transcripts
kept under Past chats. The owning member, assigned agent, or an administrator
may close a conversation. Closing immediately frees capacity and restores New
chat for the member. Disabling an agent returns open work to the queue before
reassignment. Administrators triage the bounded queue through explicit Waiting,
Open, Closed, and All views while team management remains a separate section.

SUPPORT is a dedicated platform-team role excluded from workspace subscriptions,
marketplace, and tracking. New members receive Support responsibility only by
default. An administrator may independently grant Customer, Operations, Trust,
Billing, and Support responsibilities; navigation and every server query,
mutation, review, and private-file read enforce the same permission. Team
management and administrator authority are never delegated through these flags.
A customer reads only their own conversation; a Support-authorized team member
reads only assigned work; an administrator may supervise all.
Bodies are required, length bounded, rate limited, and unavailable after close.
Every assignment, availability change, staff change, claim, and closure is
audited without copying message text into audit records.

## ADR-027 — Identity-safe public Boards and decision-first capacity controls

Make the two-sided marketplace, rather than a long feature story, the public
homepage's primary product demonstration. The public Shipment Board and Truck
Board tabs use a dedicated anonymous server projection over current Public
records. The projection explicitly whitelists structured route, general-area,
deadline, price-mode, truck, capacity, flexibility, proof-signal, and freshness
facts. It excludes identities, contacts, handles, raw IDs, exact coordinates,
files, and free text so a member cannot smuggle personal data into the public
view. Every record action goes to sign in; Login also offers Sign up. This
demonstrates a changing real marketplace without exposing the authenticated
detail or contact surface.

Capacity publication follows the order in which a Driver works: Status & work
area, Visibility, Location & privacy, Route & loads, then Publish. Empty,
Partial, and Off Duty sit with Local, Long-distance, or Both in the first step;
Local or Both keeps its Local work-radius selector there. The location step
controls only current-location privacy accuracy and Request or Refresh. Keep a live route
attached to Partial space and imply PTL acceptance without a redundant selector.
Empty alone chooses FTL, PTL, or Both and Anywhere or a Specific route with an optional travel weekday/date.
Multi Pick and Multi Drop are optional; Direct and recurring-contract controls
are absent. The location map remains visible in the collapsed post-save summary
beside all saved capacity facts. Fleet owners use the same editor on a truck-
specific page but preserve the assigned Driver location and timestamp rather
than claiming their office device or a manual place as the truck location.

Fleet driver management follows identity, current truck, then allowed work.
Each company driver and each truck has at most one active assignment. A
reassignment ends both conflicting active assignments transactionally, retains
their history, and records the owner who performed it. An unassigned fleet
truck remains an active fleet asset but cannot publish on-duty capacity; legacy
unassigned signals are suppressed from discovery. Owner-operator trucks satisfy
the driver requirement through their owning Driver profile.

An eligible Driver screen starts a throttled browser geolocation watcher when
capacity or location-required Tracking mounts and clears it on unmount. Exact
coordinates are obscured before application state. Neither capacity nor Tracking
has a manual current-location fallback: only the assigned Driver's obscured device
position may update the truck or create automatic tracking events. Denial or
device failure is shown plainly with Retry location and browser-permission guidance.

Run local development explicitly with Next 15's stable Turbopack bundler.
Measure route compilation separately from repository latency and production
response time: first development visits compile on demand, while warm Board
queries remain bounded SQLite work.

## ADR-028 — Launch artifact and cloud boundary

Keep Node 22 and the security-patched Next.js 15 Maintenance LTS line during
launch stabilization. Defer Next.js 16, React, TypeScript, Zod, and Lucide major
upgrades to explicit migration work with their own UI and compatibility
evidence. Pin launch dependencies in the lockfile and reject high-severity npm
advisories.

Build a multi-stage Next.js standalone container as a reproducible local/demo
artifact. Run it as a non-root user, mount SQLite and uploads outside the image,
and treat `/api/health` HTTP 200 as liveness only. GitHub validates the same
container definition in a read-only `container` job in addition to quality,
build, and Playwright checks.

Do not claim that Netlify environment values or Supabase migrations implement a
cloud data adapter. Netlify Free is the bounded commercial-pilot runtime;
GitHub CI still produces the standalone Docker image as a reproducibility and
host-portability artifact. Public production remains blocked until the PostgreSQL
repository, managed identity, shared rate limiting, malware scanning, backup,
restore, and monitoring contracts pass. The credential-free handoff names the
required variables and operator steps without storing their values.

## ADR-029 — User-controlled capacity privacy and scoped trust evidence

Keep exact Driver coordinates out of application state, requests, storage, logs,
and marketplace projections. The Driver chooses a bounded privacy radius before
the browser displaces the device coordinate. Local, Long-distance, and Both
capacity may use 1, 3, 5, 10, 20, or 40 km. A long-distance Partial signal below
20 km carries a stronger safety warning without overriding the Driver. Only the
latest authorized capacity projection is discoverable. A Business Near me query
keeps its exact coordinate in browser memory, sends a separately displaced
one-kilometer search point, and compares that search area with truck uncertainty
circles. Results state possible-distance ranges and maps render circles rather
than truck pins. Optional exact Local shipment pins remain a different,
party-authorized execution record visible to the owner and, after agreement, the
assigned parties.

Verification badges describe narrow evidence rather than general trust.
Organizations require National ID, Business license, and Business address;
independent and company Drivers require National ID and Driver license. An
Owner-operator submits Truck ownership for each owned truck. A Self-managed or
Company driver's Truck authorization attaches to one Driver-truck pairing and
requires an expiry. An expired approval is not a current Verified badge. Category color makes the evidence inviting to inspect,
but every badge retains text, icon, scope, status, review date, and expiry.
Private documents remain owner/admin-only, and marketplace notices require
members to perform their own current checks before an agreement.

## ADR-030 — Public capacity marketplace and provider-owned guest execution

Replace the authenticated two-sided demand marketplace with a public supply
marketplace. Capacity seekers do not create accounts or post shipment demand.
They browse an explicit public Capacity Board projection, optionally compare it
with a browser-held location, inspect published provider microsites, and contact
providers using only the contact methods each provider has made public. Fake
Business accounts, demand records, interests, network relationships, and shared-
load projections are purged from the local product dataset; no current
navigation, public projection, or mutation depends on them. This supersedes the
demand-side and Partners/public portions of ADR-003, ADR-004, ADR-011, ADR-012,
ADR-013, ADR-015, ADR-017, ADR-018, ADR-019, ADR-020, ADR-021, ADR-024,
ADR-025, ADR-027, and ADR-029 where they conflict; their historical records and
unrelated privacy, audit, fleet, and bounded-query decisions remain valid.

Represent supply with four deliberately distinct signals. Each truck has at
most one current Empty or Partial record and chooses exactly one undated
geometry: Empty may use a green Driver-obscured current radius or a yellow
structured current route, while Partial is route-only. A separate violet circle
always shows the Driver-selected location privacy accuracy. Each truck may also
have one orange next trip with an optional future date. Each provider may
publish multiple undated blue dashed recurring routes and cyan dotted permanent
working-radius areas, explicitly labeled as market signals requiring confirmation. Off
Duty hides only the current signal. Compatibility logic maps resolvable legacy
fields to the closest current provider-capacity concept without inventing
coordinates. Unresolvable route geometry becomes radius availability.

Public discovery uses deterministic opaque cursor pages of 12 through 16 items.
The secondary List presents one explicit page at a time with accessible Previous
and Next controls, while the primary Map may progressively append bounded pages.
Cards stay lightweight. Only one shared map client and tile layer load on demand;
a card action selects that record on the shared map. Exact visitor
coordinates remain in browser memory and the server receives only a separately
displaced search point. Exact Driver coordinates are displaced in the browser
before submission. Public projections expose uncertainty circles and structured
route evidence, not truck pins. All Leaflet surfaces use one central build-time
HTTPS tile configuration and visible linked attribution. The bounded beta may
use the exact direct OpenStreetMap community endpoint with a launch warning
while traffic is low; it is not an SLA. Content Security Policy permits only
the resolved tile origin. Loadgistic does not proxy, prefetch, scrape,
bulk-copy, or self-host community tiles on Netlify. A reviewed provider can
replace the URL and linked attribution without changing map components.

Only transport providers receive public profiles. A validated unique `/@handle`
resolves to a published microsite with bounded theme colors, public fleet and
capacity projections, provider-controlled phone, WhatsApp, email, and website,
and an optional allowlisted YouTube identifier that loads a player only after
visitor intent. Hidden contacts are absent from HTML and public APIs. Arbitrary
CSS, HTML, scripts, and external embeds are never accepted.

After an agreement made outside Loadgistic, the owning provider creates the
shipment execution record using its own truck and Driver. Separate high-entropy
shipper and receiver codes are stored only as digests and unlock short-lived,
party-scoped guest tracking. Completion atomically queues one idempotent email
per party; delivery failure never rolls back completion. Guest codes and access
expire 30 days after completion while provider history remains. Production
guest tracking stays disabled until managed email, private storage, scanning,
rate limiting, cleanup, and monitoring adapters pass their release gates.

The emailed shipper may submit one completed-shipment review of the provider;
the provider never rates either guest. Every one- through five-star review
publishes and counts immediately. A provider may dispute only a one-, two-, or
three-star review. The disputed review remains public and counted during review;
only an audited administrator Remove decision excludes it. This supersedes the
private-low-rating publication rule in ADR-021 while preserving its audit and
separation-from-account-enforcement principles.

Rollout adds the provider-capacity and provider-execution schema first, proves
public projections, then switches navigation and writes. The local fake-demand
purge is intentionally destructive because none of those rows are customer
data. Any equivalent cloud purge requires a verified backup and explicit
operator approval. Rollback restores that backup and the previous application;
it must not discard new provider shipment, grant, email, or review history.

## ADR-031 — Canonical market home and state-proving browser verification

Make `/` the complete public Capacity Board and retain `/capacity` only as a
query-preserving compatibility redirect. This removes competing public market
pages while preserving existing links. The shared Map is the default view and
List is secondary. On hydration the Board requests browser location; success
centers a regional view around the visitor while denial preserves the whole
market and exposes a retry action. The map keeps an Ethiopia-focused initial
view while bounded panning allows practical East Africa context without opening
Africa or the world. Unclustered markers use pointed location-pin shapes, reuse
the existing cargo-configuration artwork, and show a complete green Empty ring
or complete bright-yellow Partial ring plus text. Public markers and filters do
not display or evaluate remaining-space percentages; route and area meaning
remains in geometrically distinct overlays and the legend.
A selected map signal is a temporary
focus mode: all unrelated truck markers and clusters are removed, one visually
distinct selected marker stays above its layers without a redundant permanent
text label, the adjacent card carries its identity and details, and automatic bounds include only the
current privacy area plus current radius or route. On wide screens that card uses
a dedicated right rail and the Leaflet canvas narrows and recalculates its size;
on narrow screens it follows below the full-width map. The selected-card × control
closes focus, expands the map, and restores the full clustered market. The selected
information card uses a compact responsive grid without an internal scroll region.
Within focus mode, the approximate-location circle, current Service area or Capacity route,
and the provider's one regular-service signal are interactive map facts. Their visible strokes are
wide enough to target, their branded summaries open on pointer hover or keyboard
focus, and each readable light-surface summary uses a restrained neutral border,
signal-color accent, and complete concise explanation without a thick dark frame.
Pointer selection does not open a second map card.

The always-available Market search offers current Transporter and Truck
suggestions after meaningful input. Transporter selection uses the canonical
handle so similarly named providers cannot mix; truck selection uses the public
capacity identifier and reopens that exact truck in map focus. Public header
navigation links directly to Daily Featured Transporters without adding a
separate provider directory.

Treat location refresh as a state-changing workflow. Visitor success must show
the browser-only point and nearby evidence. Driver success must persist the
obscured point and timestamp through a Driver-authorized command without
changing capacity facts; a fleet owner cannot substitute an office device.
Browser tests must assert these resulting states. Use a fast critical-flow suite
while iterating, the full E2E suite for release workflow regression, and the
multi-role screenshot audit for broad layout regression rather than as evidence
of persistence or interaction correctness.

## ADR-032 — One customer-owner Tracking handoff and platform-managed microsite presentation

Supersede ADR-030's dual shipper/receiver guest handoff with one customer-owner
Tracking code and the public Track link. The provider records one owner email;
that owner may be the shipper or receiver and may share access with anyone it
trusts. The code is deterministically derived from the Tracking-session ID and
the server secret, so the owning provider can display the same active code
again while persistence stores only its keyed digest. Creation queues one
idempotent access email; completion queues one idempotent owner record and a
separate review code. The shareable Tracking code cannot authorize review. The
existing 30-day post-completion guest expiry and durable
provider history remain.

Use the compact ordered Tracking action panel: Going to pickup, Loading, En
route, Unloading, Complete, and Problem remain visible together and invalid
actions are disabled. Only Loading, Unloading, and Problem show one optional
image field. Provider workspace navigation calls this capability Tracking.

Keep one saved-capacity console as the Driver's primary view. The map keeps four
reserved control zones: selected truck at top left, capacity-edit rail at top
right, the visible map key at bottom left, and approximate-location accuracy
plus refresh at bottom right. Current capacity, geography, and regular service
open their own focused editors; there is no detached future-planning section. A
high-contrast marker and short Truck area label keep the privacy-obscured truck
area visible above overlapping circles and routes. The map key remains visible,
while automatic refresh adds no notice. The direct location dock changes the
radius or manually refreshes without entering the capacity editor, and manual
feedback clears after a short interval. Provider microsite colors,
hero treatment, and optional video are Loadgistic-controlled presentation;
providers edit business facts, publication, and independently visible contact
methods without receiving design controls. A provider-owned, validated profile
image is the narrow exception: it represents the provider wherever a compact
identity image is needed, while Loadgistic still controls page theme, hero
treatment, and introduction video.

## ADR-033 — Current Service area/Capacity route plus one regular-service signal

Supersede the future-trip and recurring-working-area portions of ADR-030 and
ADR-032. Empty and Partial are capacity statuses independent from geography;
either may publish one current structured Service area or Capacity route, and
neither carries a date. Each provider may separately publish no more than one
undated regular-service signal. That signal is either a Service area with a
center and three through five surrounding cities or a two-way Capacity route
with two through five ordered cities. It is a market signal and must say that
current availability needs confirmation.

Remove the next-trip and regular-working-area endpoints, projections, controls,
seed records, and persistence tables. Existing local and cloud data is pruned
destructively because it is fixture/pre-launch data: future-trip and regular-area
rows are deleted, while regular-service records are retained newest-first up to
one per provider and rebuilt from demo geography near a current truck.
Application commands and database triggers both reject a second signal. The
public Board, Driver workspace, map key, selected map layers, list cards, and
provider microsites all use the same model. List cards expose the complete
regular signal without a disclosure control and use a two-card desktop grid
that collapses to one card per row on narrow screens.

## ADR-034 — Seven-day Daily Featured Transporters and one public Truck Market

Represent Daily Featured Transporters as an administrator-curated schedule, not a
ranking or automatic endorsement algorithm. Ethiopia's current 12 regional
states and two city administrations fit a stable seven-day programme: Monday
Addis Ababa; Tuesday Oromia; Wednesday Amhara; Thursday Tigray and Afar; Friday
Somali, Harari, and Dire Dawa; Saturday Sidama, Central Ethiopia, and South
Ethiopia; Sunday Benishangul-Gumuz, Gambella, and South West Ethiopia. One
schedule owns one `Africa/Addis_Ababa` calendar date, its fixed weekday group,
an optional allowlisted TikTok event URL, a variable-length ordered provider
roster, and one bounded automatic or manual Ethiopia-time day schedule.
The rotation is a discovery programme, not a political or service ranking.

Eligibility is recalculated at publication and anonymous read time. A fleet
provider needs its three current organization evidence categories; a
self-managed provider needs National ID, Driver License, and either approved
ownership or an unexpired authorization for at least one active truck. Every
provider also needs a published microsite, one public contact method, one
structured base place, and a selected base region in the day's group. Vehicle mix and current capacity may enrich a card
but do not determine membership. An ineligible slot fails closed without
substituting another provider or place, leaving a visible administrative gap.

The homepage presents the current schedule below one Truck Market. The Market
has Map/List views of current trucks only; there is no Provider Market,
provider map, provider list, or Area Market. `/providers` redirects to the same
Truck Market, and provider-name search returns only that provider's current
trucks. Daily Featured Transporters uses an always-visible seven-day
programme and a large responsive provider board whose spacing and hierarchy
match the Market. The section-level TikTok action opens the daily event; each
provider portrait leads with the transporter-owned profile image or the Loadgistic default transporter portrait,
shows only provider-level summary facts, and links to filtered current trucks
when available. Provider microsites remain reachable from truck details. Add
schedule storage and authorization additively. Rollback disables the public
projection and admin writes while retaining schedules and audit history.

## ADR-035 — Composed public marketplace, featured-transporter board, and sponsorship

Replace the detached regional-provider carousel with one attached Daily Featured Transporters
workspace: fixed weekly programme and public event context above a realistic
public-feature billboard, with administrator-ordered provider portraits and a compact
Sponsors panel beside the billboard. A sponsor is either an eligible Loadgistic
transporter or a bounded outside advertisement with a public name, description,
and validated HTTPS website and/or phone. Sponsorship is explicitly labeled Sponsored,
is limited to five active placements for the selected regional group and date,
and never changes ordinary Market order, featured-slot order, trust eligibility, or
public review state. Sponsorship payment and settlement remain offline.

Administrators control the featured-provider headline, short introduction, TikTok link,
automatic/manual two-session schedule, ordinary variable-length roster/order, sponsor
catalogue/placement order, inclusive schedule, and active state. Providers receive no
self-service placement or page-design controls. The billboard is algorithmically
generated rather than a fixed fifteen-card illustration: its responsive grid adds
rows and height from the roster while filling the featured workspace width. One
empty photorealistic display surface with a single restrained perimeter establishes
the physical billboard treatment while every provider, action, schedule, live
state, and dimension remains generated from records and semantic HTML. The
rendered surface contains no baked roster data, logo, card, number, or schedule.
It has even light without nested frames, decorative borders, directional sunlight,
or cast-shadow treatment, preserving clear portrait text at every size. Portraits
remain readable without pan, zoom, fit, or drag controls. On wide screens sponsorship
uses a bounded solid command-style panel to the right of, and visually separate from,
the rendered billboard; on narrow screens that panel moves above the roster and exposes
exactly two deterministic cards at a time. Pairs advance automatically without manual
carousel controls, hold while keyboard focus is inside, and do not animate for reduced-motion users.
The automatic schedule works inside an 08:00–22:00 Ethiopia-time envelope. It
splits the ordered roster between morning and evening sessions, preserves a
four-hour midday intermission, gives every provider equal presentation time,
and budgets changeovers and Sponsor breaks separately. Each Sponsor break names
the next active managed sponsor without changing presentation duration or order. Lower participation
shortens the active sessions toward late morning and late evening instead of
padding the day. Administrators may adjust bounded break settings or replace
the generated suggestion with validated non-overlapping provider intervals.
The public timeline highlights a provider only during that provider's interval
and identifies changeovers, Sponsor breaks, and the intermission without a false
live-provider state. Providers are labeled Fleet transporter, Owner-operator, or
Self-managed driver from current organization and truck evidence. Loadgistic
retains control of board geometry, responsive behavior, safety copy, and visual
tokens so admin content cannot break public usability. Public reads
re-evaluate eligibility and fail closed without substitution while excluding
exact coordinates, files, account data, private contacts, payment data, and admin
notes. Additive persistence and audited commands permit public/admin rollback
without deleting schedule history.

## ADR-036 — Shared provider template and relative truck maps

Provider microsites remain provider-specific in facts, images, contacts, fleet,
capacity, evidence badges, video, and reviews, but no longer render stored custom
colors. Every provider uses the same Loadgistic white-space template and approved
brand assets. Each active truck receives a safe detailed card. A truck map is
created only after visitor intent and only for a current public Empty or Partial
signal; Off Duty trucks never expose an old location. Visitor location remains
browser-only and reuses the selected Capacity Market map semantics.

Provider-led discovery is intentionally absent. The public Market clusters and
selects current trucks only; provider-name search narrows those truck results.
Provider microsites remain canonical but are reached through Provider details
on a truck card or selected-truck panel. The homepage hero and featured-provider
introduction remain compact so the Market and featured board are reached quickly. The
hero image uses subject-aware responsive cropping and white edge fades on phone
and desktop, while its eyebrow remains plain text without a filled pill.
Rollback removes microsite truck-map controls while retaining the public truck
capacity projection.

## ADR-037 — Multi-city capacity geometry replaces demo circles and endpoint pairs

Current Capacity routes and regular Capacity routes store two through five
ordered catalog places. Service areas store one searchable center and three
through five surrounding catalog places; the boundary is rendered as a polygon,
while search evaluates the selected place against the complete polygon boundary
and its requested proximity tolerance. Capacity-route search evaluates both
freight endpoints against every ordered route segment and respects direction;
it does not reduce a multi-city path to its first and last cities. Plain-text
search also covers every stored current-route, regular-route, and Service-area
place label. Approximate truck location remains a separate Driver-controlled
privacy circle.

The product has no customer capacity records, so the local and cloud migrations
replace every fake endpoint-only route and circular work-area fixture. The
replacement is keyed to the truck's approximate city or the transporter's base:
current routes use concise city sequences along plausible Ethiopian road
corridors and include the truck's area, while each Service-area boundary contains
its nearby center. Intermediate cities clarify the route and are not filler.
Public and
provider projections do not reconstruct retired geometry when the new place
collections are absent. Rollback restores the preceding application and resets
the deterministic demo database; it does not require preservation of old fake
geometry.

Browser geolocation permission has a separate presentation purpose. Success
adds the visitor marker and recenters the map without refetching, ranking, or
filtering trucks. Only the explicit nearby-truck filter displaces a browser-held
point and sends that bounded query to the server.

The Daily Featured Transporters board uses a neutral warm-stone rendered surface
with one navy perimeter. Its HTML roster remains dynamic and the separate
Sponsored panel retains its solid teal advertising treatment.

## ADR-038 — Public-first PWA and role-specific mobile application shells

Use one installable Loadgistic application rather than separate visitor and
provider PWAs. The manifest identity and start URL are `/`, so a first-time
installer always reaches the account-free Truck Market instead of being sent to
a protected workspace. Manifest shortcuts expose Truck Market, Daily Featured
Transporters, guest Track, and the transporter workspace. The service worker
continues to ignore navigation responses, authenticated routes, and Next.js
runtime chunks; only stable brand and vehicle artwork is cached.

On narrow public screens, replace the desktop header and footer with a compact
brand/session app bar and five direct bottom destinations: Market, Featured,
Track, the session action, and About. The session action is Log in while signed
out and Dashboard while signed in. Signup remains on the Transporter login page
rather than taking another Market navigation position.
Provider workspaces retain their role-specific five direct destinations and a
branded top bar; no provider or public phone surface depends on a hamburger
menu. Both shells reserve iOS/standalone safe-area space, keep 44-pixel targets,
and preserve every existing route and authorization boundary. Desktop keeps the
full website header/footer or workspace sidebar because those layouts use the
available space more effectively. Rollback restores responsive headers without
changing sessions, routes, public projections, or persisted data.

## ADR-039 — Route-level public application workspaces

Retain `/` as the canonical account-free Truck Market, move Daily Featured
Transporters to `/featured`, and present all public tasks through one persistent
application shell. Desktop uses a compact floating workspace rail and supported
phones retain the five-destination bottom navigation. The current route is
identified visually and with `aria-current="page"`; login changes to Dashboard
for an authenticated provider without replacing the public destinations.
The wide-screen rail groups Market, Featured, and Track as primary workspaces;
the one session action under Account; and About, Privacy, and Terms under
Loadgistic. Phones retain only the five direct task destinations, with Privacy
and Terms available through the About family rather than expanding the fixed bar.

The Market and Featured programme remain separate Server Component route trees.
The Market route does not query or render the featured roster, and the Featured
route does not query or render public truck capacity. Next.js route splitting,
prefetched `Link` navigation, and route loading states provide app-like
transitions without turning Loadgistic into a client-only SPA or hiding state in
unshareable tabs. `/capacity` and `/providers` remain query-preserving Market
compatibility redirects. Current internal links move from homepage fragments to
real routes; a legacy `#featured-providers` visit is forwarded client-side to
`/featured` during the compatibility window.

Rollback restores the combined homepage rendering and fragment navigation while
leaving all public projections and stored records unchanged. This decision adds
no public data, account capability, or mutation.

## ADR-040 — Truck-scoped Private capacity network and Assisted matching chat

Private current capacity is access-controlled per truck rather than modeled as
a restored demand-side member network. An assigned Driver may grant an email
access to an assigned truck; the owning provider can inspect and revoke all
owned-truck grants. One ten-minute single-use email OTP opens a restricted
rolling visitor session containing every active share for that normalized email
and receives exactly the Driver-selected approximate
location radius. A distinct Loadgistic platform audience supports assisted
matching without inventing an email identity. Regular service remains public.
Public Market projections exclude Private current geometry and approximate
location, but may retain the truck's categorical Empty/Partial marker at the
midpoint of its public regular Capacity route or the center of its public
regular Service area. That fallback is labeled as regular service—not current
location—and anonymous search cannot infer the hidden current geometry.

Shared capacity access ends after 30 minutes without deliberate visitor
interaction. Bounded renewal is initiated only by pointer, keyboard, touch,
scroll, or map interaction; map reads, polling, rendering, and other background
network activity do not renew access. A visible Log out command clears the
restricted cookie immediately. Expiry or logout returns to email verification
without creating a member account or retaining private truck data in the page.

Account-free visitors may ask Loadgistic for Assisted matching through the
persistent public-shell chat launcher instead of creating a shipment request or
account. Required email and callback phone permit private follow-up after a
disconnect. Conversations
join the bounded Support assignment pool, choose the least-loaded available
agent immediately, expose truthful team availability, and refresh the visible
local thread every two seconds. Requested JPG, PNG, WebP, or PDF files remain
private and every read reauthorizes the conversation. Minimizing or navigating
keeps the signed browser session, while guest or team End chat makes the retained
transcript read-only and permits a distinct new session. Recovery codes are
deterministic, not stored or logged in plaintext, and use the idempotent managed
email adapter.

The local Supabase stack and managed deployment use authorized Realtime
notifications for committed PostgreSQL rows and fall back to bounded polling on
disconnect; PostgreSQL remains authoritative. Public production stays blocked
until managed repository and identity parity, shared rate limiting, durable
scanned private storage, email delivery, and retention operations pass readiness
gates. Rollback disables new grants and guest conversations while retaining
audited private records for their approved retention period.

## ADR-041 — One Supabase runtime from development through Production

Supersede the local SQLite and signed-cookie runtime adapters. Loadgistic uses
Supabase PostgreSQL, Auth, and private Storage in local development, browser
tests, Preview, and Production. Local work runs an isolated Supabase CLI project
on Loadgistic-specific ports so it can coexist with other repositories without
sharing records or credentials. Browser tests reset a distinct local Supabase
project rather than exercising a second database engine.

Repository, identity, and storage remain explicit server-side ports; this is not
permission for UI components to query private tables directly or for a service
role key to enter browser code. Public projections use narrowly granted RLS or
server-authorized RPC/query adapters, protected commands verify the Supabase Auth
user and active Loadgistic role projection, and private files are read only after
record-level authorization. If Supabase is unavailable, health and readiness
fail closed instead of falling back to SQLite or Netlify's ephemeral filesystem.

The ordered migrations must replay from an empty PostgreSQL database and pass
RLS/authorization tests before they are pushed remotely. The pre-customer SQLite
fixture contains no customer data and is replaced by deterministic Supabase seed
data; it is not dual-written or kept as an operational cache. Rollback restores
the prior application artifact against the same PostgreSQL schema and reviewed
backup, not the retired SQLite runtime.

## ADR-042 — Managed transporter sign-in is Google or email code

Use Supabase Auth's SSR-compatible authorization-code PKCE flow for Google and
numeric email one-time codes for the managed transporter login. Google requests
only OpenID, email, and profile scopes. Email-code requests never create an
unknown Auth identity. Both flows receive application authority only after the
authenticated subject resolves to an active Loadgistic role projection.

OAuth returns through the fixed `/api/auth/callback` path on the deployment-owned
`APP_URL`; the callback accepts no arbitrary post-login destination. Preview and
Production maintain exact Supabase Site URL and Redirect URL entries. Provider
tokens and upstream error details are not persisted or shown. Password login is
retained only behind an explicit non-Production fixture flag so deterministic
local and browser tests remain available without creating a second Production
credential system.

Rollback may temporarily disable Google or email-code buttons independently at
the Supabase provider boundary, but must not re-enable passwords in Production.
Public launch still requires verified custom SMTP, the numeric-token email
template, and Google console configuration. Managed onboarding uses a
15-minute server-only intent and one transactional provisioning command that
keeps a new Auth profile inactive until its provider workspace, draft page,
approved signup record, seven-day trial, and audit record exist.

## ADR-043 — Durable email uses one managed port and a bounded scheduled worker

Application email is produced from escaped, customer-safe templates and sent
through a server-only provider port. The initial managed adapter calls Resend's
HTTPS API directly with a verified sender and one stable SHA-256 idempotency key
derived from the durable queue row. An HTTPS webhook remains an optional private
integration adapter; neither adapter may expose credentials, recipient data,
access codes, bodies, or provider responses in logs.

Immediate request handling may attempt delivery, while a Netlify scheduled
function runs every 15 minutes in UTC to process bounded Tracking and access
email leases plus bounded 30-day guest cleanup. PostgreSQL `SKIP LOCKED` leases
prevent concurrent claims, successful delivery is terminal, and worker output
contains only provider names, safe status codes, and counts. Failure never
rolls back the domain transaction that queued the message.

Supabase Auth SMTP and application delivery use the same verified domain but
remain separate adapters. Rollback disables the schedule or restores the prior
application artifact without deleting queue, shipment, grant, review, or audit
history. Production remains blocked until the sender, delivery, retry, cleanup,
quota monitoring, and alert behavior are verified remotely.
