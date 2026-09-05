---
id: FEAT-CAP-001
title: Public truck-capacity signals and provider publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-FLT-001, FEAT-GEO-001, FEAT-MAT-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-SHR-001]
problem: Capacity seekers need immediate, public, location-relevant truck discovery while transport providers need a small set of honest availability signals they can keep current.
behavior: Authorized providers publish one latest signal: Empty may use either a multi-city Service area or an undated two-to-five-city Capacity route, while Partial always uses an undated Capacity route. Empty and Partial remain discoverable until the provider explicitly selects Off Duty, but their capacity update and approximate-location update ages are displayed separately so an older signal is never presented as confirmed current availability. Current geometry and approximate location may be Public Market or Private network; authorized email guests receive explicitly granted details through FEAT-SHR-001. Providers may also publish no more than one provider-level undated regular-service signal using either geometry; it accompanies an otherwise eligible Public Market truck but never makes a Private-network truck anonymously discoverable. Exact truck and visitor coordinates remain private.
contracts: [CurrentCapacitySignal, CapacityStatus, AvailabilityGeometry, CapacityPlaceSequence, CapacityAreaBoundary, RegularCapacitySignal, CapacityFreshnessStage, CapacityFreshnessPresentation, PublicCapacityProjection, PublicMicrositeTruckProjection, CapacityCursorPage, VisitorLocationQuery, CapacityMapProjection, CapacityProof, DutyCommand]
observability: [capacity_audit, capacity_route_audit, public_capacity_query, cursor_outcome, location_query_outcome, freshness]
rollout: Replace all pre-customer demo radius and endpoint-only route fixtures with multi-city Service areas and Capacity routes, keep no compatibility projection for the retired demo geometry, and move provider publication through additive server-only Supabase RPCs before enabling managed traffic. Roll back by disabling capacity mutations while preserving the append-only capacity and audit history; never fall back to SQLite while the managed backend is selected.
---

# Public truck-capacity signals

### Scenario: current availability uses a Service area or Capacity route

Given an authorized fleet owner or Driver publishes current capacity for one truck\
When the current signal is saved\
Then Empty requires exactly one availability geometry: Service area or Capacity route\
And Partial requires one Capacity route and cannot publish a Service area\
And a Service area uses one selected center city plus three through five distinct surrounding cities\
And the surrounding cities form one ordered polygon boundary while the center city remains the searchable area anchor\
And a Capacity route uses two through five distinct ordered cities joined in sequence\
And neither current geometry asks for or stores a travel date\
And Empty and Partial are categorical market signals rather than remaining-space estimates\
And the Driver is not asked for a capacity percentage and no percentage is displayed, filtered, or published to visitors.

### Scenario: current signals use distinct map treatments

Given a public current-capacity projection is selected on the map\
When its Driver location is available\
Then a labeled violet privacy circle is always shown at the Driver-selected accuracy\
And when Empty uses a Service area a separate labeled green hollow polygon joins the selected surrounding cities and identifies the center city\
And when its geometry is Capacity route a labeled green Empty or yellow Partial polyline joins every selected city in order\
And color is reinforced by text and shape rather than being the only meaning\
And the violet privacy circle remains distinct from every capacity, trip, and recurring signal.

### Scenario: regular service is one undated Service area or Capacity route

Given a provider regularly serves an area or route\
When its owner maintains regular service\
Then the provider may retain exactly zero or one regular-service signal\
And that signal is either a structured Service area with one center plus three through five surrounding cities or a structured two-way Capacity route with two through five ordered cities\
And another addition is rejected without changing the saved signal\
And regular service asks for no date and never claims that a truck is currently available\
And the selected-truck map card exposes the complete saved signal immediately without a disclosure control or line clamping\
And a regular Capacity route joins its cities with ↔ while a regular Service area names its center and boundary cities\
And both state Confirm availability\
And the shared map uses a blue dashed polyline for Regular capacity route or a blue outlined polygon for Regular service area.

### Scenario: Off Duty removes current availability

Given a truck has current capacity\
When an authorized actor selects Off Duty\
Then its current signal is absent from public discovery\
And its provider regular-service signal remains a separate record governed by its own state\
And Busy is rejected.

### Scenario: older signals remain visible with honest age

Given a truck's latest saved status is Empty or Partial\
When its capacity confirmation deadline passes without a new update\
Then the latest signal remains discoverable instead of disappearing solely because of age\
And its capacity update is assigned exactly one stage: Today, Past few days, Past week, Past month, or Older\
And its approximate-location update is assigned its own stage using the same boundaries\
And Today means less than 24 hours old, Past few days means 24 hours through less than four days, Past week means four through less than eight days, Past month means eight through less than 31 days, and Older means at least 31 days\
And each stage has a short plain-language label derived from its actual timestamp\
And missing or invalid location time is stated as Location update unavailable\
And a Past week, Past month, or Older capacity signal says Confirm availability directly\
And an older approximate location is described as the last reported approximate area rather than the truck's current position\
And selecting Off Duty still removes the truck from public and authorized Shared capacity discovery.

### Scenario: public Board is cursor bounded

Given public capacity contains more results than one response\
When any visitor opens the Map or requests another result batch\
Then the server returns a stable cursor page of 12 through 16 independently actionable cards\
And the Market does not duplicate those signals in a ranked truck-list mode\
And the map automatically requests the next bounded batch without a manual Load more control\
And loading, end-of-results, and retry states remain keyboard-readable without becoming a ranked list\
And filters, loaded cursor state, and scroll position survive a profile/detail round trip\
And the end of results is stated plainly.

### Scenario: public projection is deliberately safe

Given a visitor has no Loadgistic account\
When current capacity or regular service is returned\
Then the projection may include provider public identity, public handle, provider-controlled contact availability, the assigned Driver's first name and operating-model label, the Driver's public callback phone, separate Driver and truck verification summaries, truck presentation, obscured Service area or structured Capacity route place sequence, capacity facts, and freshness\
And a Company driver names the fleet transporter while an Owner-operator or Self-managed driver remains clearly independent\
And missing, pending, rejected, or expired Driver and truck evidence is shown as not verified rather than hiding the truck\
And it excludes the Driver's surname, plate, private account contacts, raw exact coordinates, proof paths, tracking secrets, and administrative data\
And the card links to a public signal detail and the provider microsite.

### Scenario: private current capacity is absent from public discovery

Given an active Empty or Partial truck publishes its current geometry and approximate location to Private network\
When an anonymous visitor opens or filters the Truck Market\
Then the truck is absent even when its transporter has one regular Capacity route or Service area\
And no status, truck identity, provider identity, contact, regular-service geometry, private current geometry, approximate coordinate, precision radius, suggestion, or current-geometry label is returned for that truck\
And search, route, area, freshness, configuration, or proximity filters cannot infer its presence\
And the same truck appears publicly only after its authorized publisher selects Public Market.

### Scenario: visitor location is requested without blocking discovery

Given a visitor opens the public Capacity Board\
When the client becomes interactive\
Then it immediately asks the browser for location permission\
And when the browser grants geolocation\
Then the exact point remains in browser memory\
And the primary map centers on a useful surrounding area rather than fitting the whole country\
And granting or refreshing permission does not filter, rank, remove, or refetch the current truck results\
And no visitor coordinate reaches the server until the visitor explicitly enables the nearby-truck filter\
And an explicitly enabled nearby-truck filter sends only a displaced query point and bounded radius to the server and may show a possible distance range rather than an exact truck distance\
And denial leaves the full public Board usable with a manual Retry location permission action and site-setting guidance.

### Scenario: demo capacity geography follows plausible Ethiopian roads

Given the public Capacity Board is populated with pre-customer demonstration trucks\
When demonstration capacity geometry is rebuilt\
Then every current Capacity route contains two through five distinct cities in a plausible road-travel sequence\
And the route passes through or immediately beside the truck's approximate current city rather than jumping to an unrelated part of Ethiopia\
And every Service area uses a center near the truck's approximate current city and a boundary that contains that center\
And cargo vans, pickups, mini trucks, and most courier cars expose current capacity geography within 30 kilometres of their base city or town\
And a bounded minority of courier cars demonstrate small-shipment service on plausible intercity or regional road corridors\
And every provider regular-service signal contains or closely approaches the approximate current location of every one of that provider's demonstration trucks\
And every regular Capacity route follows a plausible named road sequence while every regular Service area uses a nearby center and enclosing boundary\
And intermediate cities are included only when they clarify the road path rather than filling every route with unnecessary stops.

Given a truck's latest current capacity visibility is Private network\
When an anonymous visitor opens or filters the public Capacity Board\
Then that truck contributes no marker, status, identity, regular-service fallback, suggestion, or filter result\
And only an active Public Market signal may appear on the public map.

### Scenario: one shared map is the primary capacity view

Given a visitor opens the Capacity Board\
When the result surface renders\
Then one shared interactive map is the only public result view\
And search, filters, and the location action remain available in their established command area above the map\
And the map starts at a useful Ethiopia-level zoom, permits bounded panning across a practical East Africa envelope, and never falls back to a world or Africa-wide view\
And no ranked or paginated truck-list surface is offered\
And before selection the map clusters crowded signals that separate as the visitor zooms\
And each cluster contains only Empty trucks or only Partial trucks, names that status, and is visibly offset from an opposite-status cluster occupying the same map cell\
And clustering uses a screen cell at least as wide as the corresponding unselected marker so neighboring full-size pins are not rendered on top of one another\
And a cluster that remains crowded at maximum zoom stays a single bounded cluster and opens an accessible truck chooser instead of exploding its members into an overlapping ring\
And the complete map key remains visible without another action and uses pointed pins for capacity status, a polygon for Service area, and solid or dashed polylines for Capacity routes rather than repeating same-shaped color bars\
And each unclustered truck marker is a sufficiently large pointed map-pin shape using the existing cargo-configuration image so visitors can distinguish vehicle body types before selecting it\
And the vehicle artwork fills the true circular head without becoming egg-shaped or competing with an in-marker status word, while every rigid or tractor trailer configuration keeps its cab and enough of the attached trailer visible to distinguish it\
And a tractor marker and detail use only its currently attached trailer configuration rather than combining every compatible trailer into one public signal\
And the marker uses a complete green ring and tail for Empty or a complete bright-yellow ring and tail for Partial, with no Empty or Partial text placed over the vehicle artwork\
And no percentage or percentage-progress ring appears in a public truck marker\
And status remains available in the marker's accessible name, hover or keyboard-focus summary, selected-truck details, and map key rather than being communicated by color alone, while route lines, the Service area polygon, and their legend remain geometrically distinct from marker status\
And all user-facing labels call the violet circle the Approximate current location or Approximate location radius while location privacy remains an internal data-policy term\
And a truck or visitor-location summary appears only on hover or keyboard focus, sits above its marker, and retains a pointer to that marker rather than permanently covering the map\
And selecting one truck enters an explicit focus state that removes every other truck marker and cluster\
And every selected-truck approximate-location circle, Service area outline, current Capacity route, and regular Capacity route has a wide pointer target with one concise styled hover or keyboard-focus summary\
And that summary names the signal, its distance or endpoints, its capacity meaning, and whether availability must be confirmed without requiring a click or opening a second information card\
And each summary uses a readable light surface, restrained neutral border, and distinct signal-color accent rather than a thick dark frame or color-on-color text\
And clicking one signal pins only that signal's summary while selecting another signal replaces it\
And overlapping current and regular Capacity routes are drawn with small opposite screen-space offsets that preserve their stored cities and make each line independently selectable\
And Service-area and approximate-location interiors do not intercept route interaction, while their thick outlines remain selectable\
And the selected truck keeps one visually distinct marker outside the clustering algorithm while its compact adjacent identity dock provides essential actions without a second permanent map label or blocking the signal workspace\
And automatic bounds prioritize that truck's approximate location area and current Service area or Capacity route rather than its regular provider routes\
And on wider screens the selected truck information card occupies a dedicated right-hand rail outside the map canvas while the map narrows to remain fully usable\
And dismissing the selected truck expands the map back to the full available width and the map recalculates its rendered size after either layout change\
And on narrow screens the selected truck information card follows directly below the full-width map rather than covering it or reducing it to an unusable column\
And the selected information card has no internal scrollbar or full-screen takeover\
And an explicit close icon dismisses the selected card and restores the full clustered map\
And the map shows the visitor's browser-only You marker when permitted\
And no hidden list-view state is required to select or revisit a truck.

### Scenario: selected-truck map language is reused safely on provider microsites

Given a provider microsite lists an active truck\
When that truck has a current public Empty or Partial projection\
Then its lazily opened microsite map uses the same safe projection and approximate-location, Service area, Capacity route, regular-route, visitor-marker, and map-key semantics as Capacity Market selection\
And it keeps an Ethiopia-focused initial view while permitting the same bounded East Africa panning as the public Market\
And a truck without a current public signal has no microsite location map\
And neither surface exposes plate, assigned Driver, private contact, exact truck coordinate, or proof files.

### Scenario: a manual Driver refresh is persisted

Given an authorized Driver has an active current-capacity signal\
When the Driver presses the explicit Refresh truck location command and grants browser location\
Then the exact coordinate is obscured in the browser\
And the obscured coordinate, chosen approximate-location radius, safe area, and refresh timestamp are persisted without changing the capacity facts\
And the interface confirms that the location was saved rather than merely captured\
And permission denial, insecure browser context, timeout, and device failure produce distinct retry guidance\
And a fleet owner cannot substitute the owner's device location for an assigned Driver.

### Scenario: active Driver capacity refreshes while the dashboard is open

Given an authorized Driver has an active Empty or Partial capacity signal\
When the Driver opens the capacity dashboard and grants browser location\
Then one obscured location refresh is saved automatically\
And another refresh is attempted no more often than every 10 minutes while the dashboard tab remains visible\
And automatic refresh pauses while the tab is hidden or the truck is Off Duty\
And the manual Refresh truck location action remains available for permission retry or an immediate correction.

### Scenario: provider editor collapses to the published summary

Given a truck has saved capacity facts\
When its authorized provider opens the editor\
Then a map-centered summary appears before the full editor\
And one compact selected-truck control occupies the map's reserved top-left zone without repeating a Capacity title\
And focused current-capacity, current-coverage, regular-service, and Edit all actions remain in one aligned top-right rail\
And the complete map key remains visible in the reserved bottom-left zone while one combined approximate-location, accuracy-radius, and refresh dock occupies the bottom-right zone\
And the Driver map uses the same Empty green, Partial yellow, Approximate location violet, and Regular service blue signal language and readable hover summaries as the public Market\
And the four zones do not overlap one another, required map attribution, or essential capacity geometry at supported desktop and phone widths\
And the approximate truck marker and Truck area label remain high contrast above overlapping area polygons and routes\
And current capacity, current geometry, and regular service facts each open only their relevant editor\
And no separate future-or-recurring planning section appears below the capacity console\
And Edit current capacity opens the complete current-capacity workflow while regular service retains its own explicit save\
And focused saves preserve unopened values\
And approximate-location accuracy and Refresh truck location remain directly operable from the combined location dock without entering the capacity editor\
And automatic refresh succeeds silently while manual success or failure is announced transiently beside that dock\
And either direct location control persists without replacing or extending the map summary.

### Scenario: Driver capacity is map first on phones

Given an authorized Driver opens Capacity management on a supported phone\
When published capacity exists\
Then the map occupies the primary remaining workspace beneath the compact application bars\
And the current truck selector remains compact in the reserved top-left map zone instead of becoming a page-sized card\
And a compact top-right rail preserves current capacity, current geometry, regular service, and Edit all actions with recognizable icons and accessible names\
And the complete map key remains visible at bottom-left while Approximate location radius and Refresh truck location share one bottom-right dock\
And every floating zone stays aligned, distinct, and clear of the other zones, required attribution, and essential map interaction\
And a focused edit or Edit all opens an accessible modal over the map rather than extending the page\
And Save or Cancel closes the editing workspace and returns the Driver to the updated map summary\
And the editor uses one header containing the truck identity and one Back to summary action\
And the page does not repeat a visible Capacity title, detached Updating card, separate location summary card, or automatic-refresh notice.

### Scenario: Driver Home keeps operations in one clear order

Given a Driver opens its authenticated Home on a narrow or wide screen\
When active Tracking and truck capacity are both available\
Then urgent Tracking updates appear in a compact section before the truck-capacity workspace\
And the existing capacity summary retains its map, current availability, approximate location, regular service, focused Edit actions, and direct location controls\
And Tracking does not duplicate, replace, cover, or move the capacity map into another workflow\
And completing or collapsing a Tracking update returns the Driver to the same Home hierarchy.

### Scenario: managed provider capacity is authorized and persisted atomically

Given the Supabase data backend is selected and an authenticated provider opens or changes Capacity management\
When Loadgistic reads assigned trucks and latest signals, publishes Empty, Partial, or Off Duty, refreshes approximate location, changes restricted Driver duty, or changes regular service\
Then the inbound page or route uses the provider-capacity application port and a server-only Supabase RPC rather than importing the SQLite repository\
And the RPC repeats active-account, subscription, provider ownership, Driver assignment, and capacity-permission checks before reading or writing\
And route and Service-area place references are resolved to canonical stored coordinates inside PostgreSQL\
And each accepted mutation and its audit record commit atomically with the authenticated actor and owning provider scope\
And a denied or invalid command creates neither a capacity, regular-service, nor success-audit record\
And anonymous and authenticated browser clients cannot execute the service-role RPCs directly\
And selecting the managed backend never falls back to SQLite after a Supabase error.

## Contract ownership

- Public pages: `/capacity`, `/capacity/[id]`
- Provider editors: Driver Home and truck-specific Fleet page
- Application services: provider-capacity workspace and commands, current-capacity, regular-capacity-route, public projection, cursor and proximity functions
- Persistence adapters: server-only Supabase provider-capacity RPCs in migration `043_provider_capacity_runtime.sql`; the legacy SQLite adapter remains isolated from managed execution during cutover
- Tests: domain, provider-capacity Supabase authorization, repository, authorization, E2E, visual audit
