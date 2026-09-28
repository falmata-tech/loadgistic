---
id: FEAT-MKT-001
title: Frictionless public capacity marketplace
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-FTR-001, FEAT-PRV-001, FEAT-SPN-001, FEAT-TRK-001, FEAT-VER-001]
problem: Manufacturers, workshops, growers, producers, and other capacity seekers need to discover legitimate road-freight options immediately without creating an account or posting demand.
behavior: A persistent public application shell gives each primary visitor task its own route-level workspace. `/` is the canonical capacity map with Open to the public selected by default; `/?view=private` uses the same page with an empty map until email verification; `/shared-capacity` redirects to that private view, `/track` is private shipment Tracking after a direct agreement, `/featured` is the seven-day Daily Featured Trucks programme, and About retains its own route. Together they present Loadgistic as a transport-capacity sharing and shipment-tracking platform without exposing internal product terminology in interface copy. Public navigation uses Capacity, Track, Featured, then About. One introduction and an Open to the public / Privately shared with you selector sit above the map. Transporter signup remains directly available from Login without consuming a primary navigation destination. The Market and Featured data trees are not rendered together. Transporter-name search filters the public map to that transporter's current trucks; a ranked profile search drawer identifies transport companies, owner-operators, self-managed drivers and company drivers, all backed by matching available trucks. There is no separate Provider Market or provider map. Detailed product education lives on About. Shipment-demand posting, a public Shipment Board, and capacity-seeker signup are absent.
contracts: [PublicAppShell, PublicWorkspaceNavigation, PublicMarketplaceView, PublicCapacityProjection, PublicTrackingEntry, LocationConsentPrompt, ProgressiveCapacityMap]
observability: [public_workspace_navigation, public_capacity_query, public_tracking_entry, location_consent_outcome, anonymous_projection_review]
rollout: Release the public capacity surface with retired-route redirects, purge fake local demand records, and require a backup plus operator approval before any destructive cloud purge.
---

# Public marketplace

### Scenario: capacity is useful before login

Given a visitor opens Loadgistic\
When the public application shell and default Market workspace render\
Then the selected Capacity navigation identifies the workspace and a shared introduction explains the platform\
And one visible Find truck capacity in Ethiopia heading names the page\
And on a supported desktop or phone viewport the primary Market begins inside the initial workspace view without a website-scale hero delaying it\
And the Market uses the viewport remaining between its application bars, with compact search, filter, view, and location controls over the Map instead of extending the page vertically\
And the complete Market offers one Truck Map without a Map/List or Trucks/Providers mode choice\
And the Map offers public-profile search and truck/Service-area/Capacity-route filters, selectable truck markers, compact truck details, and a Transporter details action\
And selecting a truck opens a compact dismissible information window inside the fixed map canvas without adding document height or narrowing the map\
And that window keeps only the truck identity, availability, transporter, contact, and profile actions needed before inspecting its map signals\
And the persistent public navigation links directly to the separate Daily Featured Trucks workspace as well as the Truck Market\
And `/featured` renders the current programme, featured board, and clearly labeled separate Sponsored transporters panel without rendering the Truck Market\
And `/` does not server-render or hydrate the featured programme while `/featured` does not server-render or hydrate the Truck Market\
And repeated educational or promotional sections do not interrupt either workspace\
And detailed market purpose, operating model, and safety education remain available on About\
And About explains that transporters control whether current capacity is public or shared only with trusted email contacts and that confirmed work can use private Tracking\
And a paginated mixed result drawer accompanies the map\
And the primary map initially centers and zooms for the current Ethiopia market while allowing bounded exploration across East Africa rather than exposing Africa or the world\
And browsing cards, filters, the truck map, capacity details, provider microsites, and tracking-code entry require no account\
And the page does not ask the visitor to post demand or sign up as a Business\
And the legacy `/capacity` URL preserves its query string while redirecting to `/` rather than rendering a duplicate market page\
And `/providers` redirects to the Truck Market without rendering a provider list or selecting a provider mode.

### Scenario: map status does not steal map space

Given Open or Private Transport Capacity renders with loading, no results, a recoverable error, or more cursor results\
When that state changes\
Then its message or action occupies a compact positioned region inside the bounded map canvas\
And it never creates an implicit grid row, increases document height, or reduces the phone map below 300 CSS pixels\
And map search, filters, location, legend, selected-truck details, attribution, chat, and application navigation retain non-overlapping operable regions at desktop, 390-pixel, and 320-pixel widths.

### Scenario: authenticated discovery does not fork the public market

Given a Driver, fleet transporter, or administrator wants to inspect public capacity or featured transporters\
When the actor uses workspace navigation or an older authenticated Capacity market URL\
Then Truck Market opens `/` and Daily Featured Trucks opens `/featured` in the public application shell while the signed-in session remains active\
And `/app/capacity` and its former detail routes do not render another Market, provider directory, or administrator-only copy\
And Driver Home remains the private Capacity management workspace for publishing that Driver's own truck signal.

### Scenario: provider-name search returns that provider's trucks

Given a visitor searches the Truck Market using a provider name\
When the public capacity query is applied\
Then only discoverable Empty or Partial trucks belonging to matching providers appear on the Map\
And featured or sponsored View trucks on map actions apply the transporter’s exact public handle as well as its readable name\
And automatic visitor-location refresh keeps all trucks from that explicitly selected transporter visible while adding the visitor marker for relative map context\
And distinct provider and driver result cards accompany matching trucks without adding provider markers\
And each returned truck's details retain a Transporter details action to its canonical `/@handle` microsite\
And free-text search uses published profile details; truck configuration and current/regular geography use the truck filter dialog.

### Scenario: public search lists matching profiles

Given a visitor submits a profile name, public handle, published office city or service description\
When eligible available trucks belong to the matching provider or are driven by the matching driver\
Then the drawer shows distinct paginated profile cards and the map shows only those matching truck/driver pairs\
And provider cards select the exact provider handle without adding company map markers\
And driver cards identify the public first name and provider, and locate the assigned truck\
And truck-only facts, private plate, login/contact data and inactive assignments do not match profile search.

### Scenario: shipment needs determine matching trucks

Given a visitor chooses full-truck or shared space and supplies optional pickup/delivery locations\
When filtering public or authorized private capacity\
Then the system checks accepted load types and both current and regular routes/service areas without asking the visitor to choose a signal geometry\
And route matching evaluates every ordered segment and the selected direction/tolerances\
And service-area matching evaluates the complete polygon for eligible Empty trucks\
And one supplied endpoint may match independently, while two endpoints must both fit the same eligible route or area\
And truck configuration, stops, document requirements, freshness and reported-location proximity may further narrow the same eligible pairs\
And each map item remains one latest available truck/driver signal while the drawer lists connected profiles.

### Scenario: every supplied filter contributes to truck eligibility

Given a visitor supplies any combination of free text, exact transporter, Empty or Partial status, signal geometry, truck configuration, load type, stop option, signal age, shipment endpoint, Service-area place, or explicit nearby radius\
When the public capacity query is evaluated\
Then each supplied criterion must match and each omitted criterion remains neutral\
And Partial prevents Service area because Partial capacity is route-only\
And one shipment endpoint matches its selected tolerance against every segment of each eligible current or regular Capacity route or against an eligible complete Empty Service-area polygon\
And two shipment endpoints must both match the same eligible route or Service area\
And a directional Capacity-route match compares the projected position of both endpoints along the complete ordered polyline, including routes with intermediate points\
And Either direction permits the reverse projected order without changing the stored route\
And search geometry, truck facts, freshness, and explicit nearby location are combined as eligibility checks rather than converted into a provider rank\
And map items retain stable cursor order, while profile cards use text relevance without claiming a transport suitability score.

### Scenario: one visitor's filter response cannot replace another

Given the public capacity endpoint accepts query-sensitive filters or cursors\
When Netlify or another shared delivery layer handles two different query strings\
Then each response is evaluated from its own complete query\
And the response is not stored in a shared cache unless that cache key includes every accepted filter and cursor parameter\
And Empty, Partial, geometry, route, place, truck, freshness, provider, search, and cursor queries cannot reuse an unfiltered or differently filtered response body.

### Scenario: the Market distinguishes signal age from availability status

Given an Empty or Partial truck was not updated recently\
When its marker, selected summary, or capacity geometry is shown\
Then Empty or Partial still describes the provider's last published capacity state\
And a separate plain-language capacity-update label states Today, Past few days, Past week, Past month, or Older\
And a separate approximate-location label states when that location was last updated\
And the selected summary does not call an older location current or imply the truck remains available\
And visitors are prompted to call and confirm older signals directly\
And the Market remains unranked\
And update time is used only as a deterministic bounded-cursor retrieval key, without a provider score or ordered visitor list.

### Scenario: search and view controls remain consistent

Given a visitor uses the Truck Map on a desktop or phone\
When search, filters, view choice, or current-location controls render\
Then the same compact command surface remains visible without hiding beneath the workspace heading\
And clearing search removes free text plus an exact transporter or truck selection while preserving unrelated explicit filters\
And Clear filters removes all filter values and closes the dialog\
And applying filters closes the dialog before navigation\
And selecting Partial availability prevents a Service-area geometry choice because Partial capacity is route-only.

### Scenario: filters close when results are applied

Given a visitor has opened the Truck Market filter dialog\
When Apply filters or Clear filters is activated\
Then the dialog closes before navigation begins\
And keyboard focus is not left inside the closing dialog\
And the resulting URL and Market state reflect the submitted or cleared filters.

### Scenario: visitor receives an immediate nearby-location request

Given the public Board is usable without location\
When the client becomes interactive\
Then Loadgistic immediately requests browser location permission\
And permission success centers and zooms the map around the visitor's surrounding area without changing, ranking, or refetching the current results\
And nearby-truck filtering remains a separate explicit choice in the Market filter\
And permission denial or device failure does not block the map or manual filters\
And the visitor may manually retry after enabling browser site permission.

### Scenario: Map loading remains bounded and geographic

Given more public signals match the active filters\
When the visitor explores the Truck Map\
Then the browser receives bounded result batches without duplicate capacity identities\
And additional batches append automatically without a manual Load more trucks control\
And a phone without visitor location opens at a useful Ethiopia-level camera rather than fitting a distant East Africa overview\
And status-specific map clusters preserve distinct regional and city markets instead of joining distant markets through transitive neighbors\
And bounded screen-space placement keeps nearby Empty and Partial groups individually readable instead of drawing their labels on top of one another\
And every marker or cluster remains anchored to the geographic center of its members rather than being displaced into another town, oscillating between arbitrary screen cells, or changing position when the same zoom state is revisited\
And clustering work grows approximately linearly with loaded markers rather than comparing every marker with every other marker\
And each cluster has a bounded membership so zooming out does not collapse a whole region into one misleading bubble\
And visible shipment origin and destination controls evaluate eligible current and regular Capacity routes and Empty Service areas without ranking transporters\
And filters constrain the map without creating a ranked result list.

### Scenario: public navigation reflects the one-sided marketplace

Given any public page is rendered\
When the shared public application navigation and calls to action appear\
Then Capacity, Track, Featured, About, and the session-appropriate Transporter login or Dashboard action are available as route links
And the map provides the Open to the public / Privately shared with you choice under FEAT-SHR-001\
And Track appears immediately before Featured in both desktop and phone public navigation\
And one current destination is communicated visually and with `aria-current="page"`\
And desktop uses a compact floating workspace rail while phones use the persistent bottom navigation\
And an anonymous visitor reaches transporter setup through the unified Log in flow rather than a separate Market navigation item\
And the authenticated Dashboard action replaces login without leaving a signup item behind\
And Provider Market, provider directory, and Area Market actions are absent\
And Shipment Board, Post shipment, Business signup, and Business Directory actions are absent.

### Scenario: retired authenticated Directory cannot reach legacy data

Given a visitor or provider follows an old authenticated Directory or company-profile link\
When `/app/providers`, `/app/providers/[handle]`, or `/companies` is opened\
Then the request redirects to the public Truck Market or canonical public transporter microsite\
And useful provider-name search input is preserved where available\
And the retired member-directory search endpoint returns `410 Gone` without querying a compatibility repository.

### Scenario: claims remain evidence safe

Given the homepage explains Loadgistic's purpose\
When it describes makers and transport providers\
Then it presents capacity reuse, partial space, current Service area or Capacity route coverage, and regular Capacity routes as options rather than guaranteed savings, service, income, or outcomes\
And every discovery surface reminds visitors to confirm availability, identity, authority, documents, cargo fit, price, and terms directly.

### Scenario: public workspaces are visually light and purposeful

Given a visitor opens the Market or Daily Featured Trucks workspace\
When the route renders at desktop or mobile width\
Then warm white and off-white surfaces provide useful spacing around the primary tool\
And Loadgistic blue and orange appear in bounded navigation, actions, status, and trust accents rather than saturating whole sections\
And the hero visual shows young Ethiopian men at a metal door-and-window workshop handling incoming metal inputs and finished goods with local road freight, without presenting one truck as the product\
And its bright negative space blends into the white-first layout while navy, teal, aqua, and a restrained amber accent follow the approved Loadgistic palette\
And at mobile widths the full visual scales and crops to the available hero width, preserves its important workshop subjects, and uses soft white edge fades rather than exposing a rectangular image boundary\
And concise route actions lead directly to the Market, Daily Featured Trucks, Track, About, or transporter signup\
And the shell, selected navigation, and active tool read as one composed public application rather than stacked website sections\
And the Market uses a compact command panel beside the Map on desktop and progressive controls above the Map on mobile\
And explanatory copy stays subordinate to the two working marketplace tools.

### Scenario: mobile public workspaces open directly on their task

Given a visitor opens the Market or Featured route on a supported phone\
When the compact public app shell and selected navigation render\
Then the Market does not place a welcome or promotional header between the application bars and the map\
And the active Market or Featured experience begins in the first viewport\
And the page itself remains fixed while Map and board canvases fill their bounded workspace and List or disclosure overflow stays inside that workspace\
And map search, filters, location retry, legend, selected-truck details, and bounded loading remain operable above the fixed app navigation\
And Daily Featured Trucks opens as its own full-width app workspace rather than following the Market in the same document\
And the desktop footer is not duplicated beneath the mobile bottom navigation.

### Scenario: visitors reach the featured-truck board quickly

Given the current Daily Featured Trucks programme is published\
When its dedicated `/featured` workspace renders\
Then the date, daily truck type, 07:30–09:00 EAT window, and truck count are immediately understandable\
And the heading and introduction stay compact enough that the weekly programme and board remain close to the section entry\
And repeated explanation moves into provider detail, provider profiles, or About\
And the generated board blends into the public white-space system while retaining a realistic evenly lit surface, numbered truck images, Driver and provider identity, readable scheduled intervals, and current-live emphasis\
And no fixed illustration determines participant count, row count, or board dimensions.

## Contract ownership

- Pages: `/` as the canonical Truck Market; `/featured` as Daily Featured Trucks; `/capacity` and `/providers` as compatibility redirects to the Market; `/track`, `/about`, and `/@handle`
- Projection boundary: explicit public whitelists only
- Tests: repository, E2E, visual audit

### Editorial direction — owner clarification, 2026-09-21

Loadgistic helps transporters share capacity signals with known brokers and
enterprises shipping or receiving goods, or with the open market. Transporters
then provide professional private shipment tracking to brokers, their customers,
or enterprise contacts directly. Optional reviewed documents help people seeking
transport assess the provider, Driver and truck.

Apply this positioning concisely to About, public metadata, onboarding, Network,
Tracking and verification introductions. About carries the fuller story; working
screens explain the immediate task without repeating the platform pitch. Keep
real permission, privacy and badge limitations where relevant. Do not claim
screening guarantees, automatic/live tracking, bookings, payments, broker accounts
or enterprise dashboards that are not implemented. These are audience descriptions,
not new authorization roles. This is an editorial correction, not a workflow change.

Review: inspect desktop/phone About and entry pages plus local provider Network,
Tracking and Verification; preserve navigation/form actions and record captures.


Local editorial evidence: typecheck and source/spec checks passed; desktop/phone
captures of nine entry/workspace routes are retained in
`artifacts/narrative-review-2026-09-21/`. Setup after identity confirmation was
source-reviewed only. About's phone action obstruction is recorded as UIA-16;
owner visual approval and deployment remain pending.


## Ranked capacity discovery — owner request, 2026-09-27

Supersedes the earlier no-list/two-type suggestion presentation. Only entities
with a matching discoverable Empty/Partial truck are eligible (owner confirmed).

- Given open capacity, when searching profile names, public handles, published
  office city, headline, description or services, then rank exact names/identifiers
  ahead of prefixes, all-word text matches and conservative typo matches. Use
  PostgreSQL simple text parsing and pg_trgm, with no hosted search dependency.
- Given private capacity, then search uses only the verified email projection;
  no unauthenticated private search, hidden profile prose, private plate, login
  email, unpublished contact, inactive assignment or hidden signal is searchable.
- Given results, then distinguish Transport company, Owner-operator,
  Self-managed driver and Company driver using labels, icons and card structure.
  Company-driver results show only the already-published first name and provider.
  A provider/driver appears once per identity, with the count of matching trucks.
- Given any combined filter, then all criteria match the same eligible truck.
  Filters include existing capacity/geography/freshness/configuration criteria,
  current approved document type scoped to owner,
  driver or truck. Pending/rejected/expired documents never satisfy reviewed filters.
- Given the map workspace, then the sliding left drawer contains search and ranked
  results. All detailed filter inputs move into one Filters dialog with a light
  tinted backdrop, accessible focus/close/apply and scrollable phone layout.
- Given search changes, then stale responses are discarded, errors offer retry,
  results are paginated server-side with stable ranking ties, and applied criteria
  remain shared with map loading. Clear all resets results, map and filter draft.
- Given all five UI languages, then new controls and type labels are localized;
  provider-authored text is shown verbatim and never machine-translated.

Plan: inspect existing safe projections → implement additive migration 112 and
ranked typed endpoint → reuse shared map filters, replace suggestion dropdown with
results drawer → focused SQL, relevance, privacy, desktop/phone tests → owner
visual review before full gates. NR-01/02/03/08/10/13 apply. No production writes.
Rollback reverts search UI/API and preserves existing capacity/profile data; the
new read-only functions can remain until a separately reviewed removal.


Owner clarification: companies never become map markers. Company cards select
that provider and show all matching available truck/driver pairs; explicit search
loads complete matching cursor pages independent of the initial viewport, then
fits their truck geometry. Other applied filters remain in force. Empty search
continues the established viewport-driven map loading.


Owner's final search clarification: the drawer contains profiles only. Remove the
result-type/Show selector entirely. Truck facts, identifiers, routes and capacity
are filtered through truck filters and displayed on the map, not searched as
profile text or rendered as separate truck result cards. Search matches public
profile names, handles, office cities and published descriptions/services, plus
already-public driver names. It never indexes private account details. Legacy
resultKind parameters have no effect. Companies still remain off the map; only
matching available truck/driver pairs render there. Public and private eligibility
retain the active-driver requirement.

Acceptance additions: GIVEN a truck identifier or make exists only on a truck,
WHEN entered into profile search, THEN it cannot match that truck's profile by
that fact alone. GIVEN search or truck filters are applied, THEN result pages
contain profiles only and every profile has at least one eligible matching pair.
GIVEN the filter modal, THEN no result-type selector is offered in any language.


Owner simplification: office city is searched using the main public-profile search
box. The filter dialog has no Office city field or empty Search filters group.
Published office-city matches still constrain both profiles and their associated
available trucks. Truck-location geography remains an independent truck filter.
