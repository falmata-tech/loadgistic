# Architecture Decisions

## ADR-001 — Next.js on Node.js

The application uses Next.js App Router on Node.js. This corrects the prior bare-Node implementation and provides server rendering, structured routing, route handlers, PWA compatibility, and production deployment paths.

## ADR-002 — Local SQLite adapter

Use Node's built-in SQLite for deterministic offline persistence. Keep all persistence behind repository functions and include a Supabase PostgreSQL/RLS target.

## ADR-003 — One canonical shipment

A request, load, and operating shipment use one record. UI terminology changes by workflow stage, but data is not copied into a second entity.

## ADR-004 — Minimal capacity

Capacity is truck-level and intentionally direct: duty state, Empty or Partial cargo space, FTL/PTL/Both acceptance, Direct plus independent Multi Pick and Multi Drop acceptance, general current area and freshness, a live undated Partial route, dated Full-or-Partial planned travel, contract-route interest, Public/Partners visibility, and expiry. The capacity update time is the current Partial route's clock. Local-only work can publish only Empty/100-percent availability because Partial requires a live intercity route; Both and Between cities retain Partial. A full or unavailable truck is treated as Off Duty and is not shown in discovery.

## ADR-005 — Server-rendered forms

Use normal HTML forms and Route Handlers for most actions. This is resilient on weaker devices and connections and reduces unnecessary client-side state.

## ADR-006 — Linked executable specifications

Use Markdown specifications with validated YAML front matter. Base specs define frontend, backend, and deployment constraints; vertical feature specs link to them and express material behavior with Given/When/Then scenarios. Completion requires tests and rollout evidence, not documentation alone.

## ADR-007 — Pragmatic hexagonal and DDD boundaries

Adopt ports/adapters, SOLID dependency direction, and DDD vocabulary without mandating class-based implementation. Pure domain functions remain preferred for deterministic rules. Extract explicit outbound ports as adapters multiply; do not perform a speculative rewrite of the working SQLite MVP.

## ADR-008 — CI as a release guardrail

GitHub Actions performs locked dependency installation, specification and source validation, tests, TypeScript checking, a production build, and desktop/mobile Chromium workflows with read-only repository permissions. Dependabot maintains npm and workflow dependencies. Branch protection should require the `validate` and `e2e` jobs before merge.

## ADR-009 — Browse permission is not shipment-party permission

Treat Open and Partners load visibility as authenticated read-only discovery. Internal notes, proof files, and execution transitions require an actual shipment party: Business owner, assigned provider organization/profile, or administrator. Partners visibility requires a mutual Connected relationship to the shipment owner. Application and payment-proof approvals/rejections are terminal in the MVP.

## ADR-010 — Browser fixtures are isolated from development data

Run Playwright against a reset, dedicated SQLite database, port, and `.next-e2e` artifact directory rather than reusing the local development server's standard `.next` output. The parent E2E runner restores Next's generated TypeScript metadata after Playwright exits. Local fixture credentials remain in setup documentation and test code, while public authentication pages render empty credential fields. This keeps test convenience from changing public UI, developer business records, tracked type metadata, or live generated modules.

The browser suite uses one worker because both viewport projects intentionally exercise one deterministic SQLite fixture and several owner-authorized workflows mutate shared state. Serial execution keeps role transitions and authorization assertions ordered and prevents concurrent Next development compilation from aborting navigation.

## ADR-011 — Driver home and temporary load proof

Self-managed drivers land on their truck capacity control panel. Fleet Transporters land on a company management dashboard and update truck capacity inside My Fleet, where every update remains attached to one real vehicle. Businesses receive actionable truck-level Truck Board records; providers receive only aggregate supply counts by approximate area and status, with no truck or owner identity projection. Freight shipments use the same FTL/PTL language as capacity. Shipment-size proof is separate from operational shipment proof and is granted to one recorded interest at a time, reauthorized on every read, and expires after a configured temporary window (48 hours by default).

Tracking is a load-level Business choice: Status timeline or Approximate location + status. Once assigned, providers must satisfy that choice on updates and cannot reduce it. The primary manual actions are Loading, En route, Unloading, and Problem, each with optional inline proof; uncommon terminal commands remain secondary. A Business party may reduce tracking to Status timeline. Exact browser geolocation is obscured before submission: 20 km for FTL and 40 km for PTL.

## ADR-012 — Visual trucks and staged contact disclosure

Use one image-backed cargo-configuration catalog across freight creation, driver Home, Fleet, and Capacity instead of tonnage labels. A Business may expose one designated load phone to authenticated transporters only through an explicit opt in. Receiver first name and phone are shipment-party data entered after commercial agreement; Freight assignment is blocked until both are present.

## ADR-013 — Discovery, Tracking, and authenticated directory

Keep one canonical shipment record while separating its UI by permission and stage. The Shipment Board is provider discovery plus interest. Businesses use one My Shipments navigation destination containing posting, all owned demand, and an Active Tracking projection. Providers retain a separate Tracking destination because they do not own Business demand. Tracking contains only execution-stage party records from Agreed onward.

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

Company drivers operate only assigned organization vehicles. Duty On and Off is a narrow command that remains available even when rich capacity control is disabled: Off Duty hides the truck, while On Duty restores the most recent owner-configured Empty or Partial signal. If no prior active configuration exists, an owner must configure the truck first. Fleet owners retain organization-wide visibility and authority.

## ADR-017 — Mutual network and code-gated customer tracking

Model Business-provider relationships as three distinct meanings: a private Favorite owned by either side, a directional Pending request, and a mutual Connected relationship. Only Connected relationships authorize Partners-only loads and capacity. Existing saved relationships migrate compatibly to Connected. Company drivers do not mutate the company network.

Customer tracking is an additional customer-safe view, not a bearer link. Its human-entered code is derived with the server secret, stored only as a keyed digest, and omitted from URLs. An account or non-account shipper or receiver who receives the code from the load owner may unlock a five-minute HTTP-only grant bound to the browser and load. Browser activity may refresh the grant; five minutes without activity clears it. Assigned providers continue to see the same real tracking events in their internal Tracking workspace and cannot unlock the customer view.

Fleet owners edit capacity on one truck-specific Fleet page. They may declare a general area but cannot submit device-assisted location, because the owner's phone does not establish the truck's position. Only an authorized assigned company driver or self-managed driver may submit an already obscured device area. Ethiopian place suggestions and nearest-city labels use the reviewed local place catalog, keeping exact coordinates and third-party API keys out of the request path.

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

Current partial-capacity and planned truck routes remain dated, expiring capacity facts rather than profile declarations. Matching and maps combine every fresh active route for the viewer's eligible trucks with the stable profile routes, preserve each source label in operational data, and exclude past or expired records. Comparison-map styling represents ownership rather than route source: all viewed-profile routes are solid blue and all viewer-owned routes are consolidated under one warm-brown dashed Your routes layer drawn above them. Current-partial and planned routes do not create separate comparison legend colors. Public truck capacity may show the owner's Preferred Routes for context without implying that every preferred route is the current truck movement.

Every truck receives one unique, immutable `LG-TRK-*` platform number. Member discovery and Public Profiles use that number; license plates remain private operational data for the truck owner and administrators.

Deep workspace detail routes expose a Back link with a route-specific fallback that works before client hydration. Administrators receive a bounded, searchable Operations projection across users, workspaces, trucks, loads, and latest capacity. It excludes credentials, sessions, tracking secrets, exact coordinates, and proof paths. User suspension and truck deactivation are reversible, admin-only, audited commands, and an administrator cannot suspend their own account.

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
a seven-day trial. Verification is not an activation gate. An administrator may
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

Model freight movement as Local, Between cities, or Both where the actor
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
Empty, Partial, and Busy are On Duty; Off Duty is the explicit hidden state.
Empty and Partial remain visible during the early-market rollout when their
updates become old, but their relative update times and stale warning are
prominent and stale records rank below otherwise equivalent fresh records.
Dated current and planned routes still expire independently. Busy means the
truck has no cargo space now but remains open to calls, requires an
available-again date and structured city, displays Preferred Routes instead of a
current capacity route, and leaves discovery after that date unless refreshed.
For Both movement, the Local place is also the current general-area place so a
driver enters the city once.

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
Closing frees capacity. Disabling an agent returns open work to the queue before
reassignment.

SUPPORT is a dedicated platform role, excluded from workspace subscriptions and
from marketplace, tracking, verification, payment review, Operations, and
client-mutation authority. A customer reads only their own conversation; a
support agent reads only assigned work; an administrator may supervise all.
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

Reduce capacity publication to the order in which a driver works: current
availability, work area, then publish. Keep a current Partial route attached to
Partial space. Put shipment policy, future travel, visibility, and cargo proof
inside one Optional details disclosure. Use one final publish row and never a
second review card. Fleet owners use the same editor on a truck-specific page
but remain unable to claim their office device as the truck location.

An eligible Driver screen starts a throttled browser geolocation watcher when
capacity or location-required Tracking mounts and clears it on unmount. Exact
coordinates are obscured before application state. Permission denial and device
failure preserve manual general-area entry and do not cause repeated prompts in
one mounted screen.

Run local development explicitly with Next 15's stable Turbopack bundler.
Measure route compilation separately from repository latency and production
response time: first development visits compile on demand, while warm Board
queries remain bounded SQLite work.
