---
id: FEAT-CAP-001
title: Public truck-capacity signals and provider publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-FLT-001, FEAT-GEO-001, FEAT-MAT-001, FEAT-MKT-001, FEAT-PRV-001]
problem: Capacity seekers need immediate, public, location-relevant truck discovery while transport providers need a small set of honest availability signals they can keep current.
behavior: Authorized providers publish one current Empty or Partial signal as either a radius or an undated corridor, plus no more than two provider-level undated regular corridors. Anyone may browse bounded public projections without an account; exact truck and visitor coordinates remain private.
contracts: [CurrentCapacitySignal, CapacityStatus, AvailabilityGeometry, RegularCorridor, CapacityFreshness, PublicCapacityProjection, CapacityCursorPage, VisitorLocationQuery, CapacityMapProjection, CapacityProof, DutyCommand]
observability: [capacity_audit, corridor_audit, public_capacity_query, cursor_outcome, location_query_outcome, freshness]
rollout: Remove future-trip and regular-area records, retain compatible current radius/corridor signals, deterministically limit regular corridors to two per provider, and monitor public-projection fields and query volume.
---

# Public truck-capacity signals

### Scenario: current availability uses radius or corridor

Given an authorized fleet owner or Driver publishes current capacity for one truck\
When the current signal is saved\
Then Empty or Partial requires exactly one availability geometry: radius or corridor\
And radius uses the Driver's browser-obscured current point plus a selected work radius\
And route uses structured origin and destination points\
And neither current geometry asks for or stores a travel date\
And Empty records 100 percent while Partial records an integer from 1 through 99.

### Scenario: current signals use distinct map treatments

Given a public current-capacity projection is selected on the map\
When its Driver location is available\
Then a labeled violet privacy circle is always shown at the Driver-selected accuracy\
And when its geometry is radius a separate labeled green work circle is shown around the obscured center\
And when its geometry is route a labeled yellow line and endpoints are shown\
And color is reinforced by text and shape rather than being the only meaning\
And the violet privacy circle remains distinct from every capacity, trip, and recurring signal.

### Scenario: regular service is limited to two undated corridors

Given a provider regularly serves one or more corridors\
When its owner maintains regular service\
Then each signal is a structured two-way corridor between two selected places\
And the provider may retain no more than two regular corridors\
And a third addition is rejected without changing either saved corridor\
And no regular corridor asks for a date or claims that a truck is currently available\
And public List cards expose both saved corridors immediately without a disclosure control\
And every public surface presents each pair as Place A ↔ Place B and states Confirm availability\
And the shared map uses the user-facing label Regular corridor for a blue dashed line.

### Scenario: Off Duty removes current availability

Given a truck has current capacity\
When an authorized actor selects Off Duty\
Then its current signal is absent from public discovery\
And its provider regular corridors remain separate records governed by their own state\
And Busy is rejected.

### Scenario: public Board is cursor bounded

Given public capacity contains more results than one response\
When any visitor opens or scrolls the Board\
Then the server returns a stable cursor page of 12 through 16 independently actionable cards\
And the List uses two scan-friendly cards per row on wider screens and one card per row on narrow screens\
And approaching the end fetches the next page\
And a Load more capacity fallback remains keyboard accessible\
And filters, loaded cursor state, and scroll position survive a profile/detail round trip\
And the end of results is stated plainly.

### Scenario: public projection is deliberately safe

Given a visitor has no Loadgistic account\
When current capacity or a regular corridor is returned\
Then the projection may include provider public identity, public handle, provider-controlled contact availability, verification summaries, truck presentation, obscured area or structured route, capacity facts, and freshness\
And it excludes plate, private account contacts, raw exact coordinates, proof paths, tracking secrets, and administrative data\
And the card links to a public signal detail and the provider microsite.

### Scenario: visitor location is requested without blocking discovery

Given a visitor opens the public Capacity Board\
When the client becomes interactive\
Then it immediately asks the browser for location permission\
And when the browser grants geolocation\
Then the exact point remains in browser memory\
And only a displaced query point and bounded radius reach the server\
And the primary map centers on a useful surrounding area rather than fitting the whole country\
And list results show a possible distance range rather than an exact truck distance\
And denial leaves the full public Board usable with a manual Retry location permission action and site-setting guidance.

### Scenario: one shared map is the primary capacity view

Given a visitor opens the Capacity Board\
When no view choice has been made\
Then one shared interactive map is the default primary view and List is the secondary choice\
And the map starts at a useful Ethiopia-level zoom, constrains panning to Ethiopia, and never falls back to a world or Africa-wide view\
And cards appear only after choosing List rather than creating one live map per card\
And before selection the map clusters crowded signals that separate as the visitor zooms\
And the complete map key remains visible without another action and uses pointed pins for capacity status, circles for areas, and solid, dashed, or dotted lines for route types rather than repeating same-shaped color bars\
And each unclustered truck marker is a pointed map-pin shape using the existing cargo-configuration image so visitors can distinguish vehicle body types without opening a card\
And the truck artwork is centered and legible inside a proportionate circular head, while the extra-long rigid-truck-with-trailer artwork is excluded from map pins and falls back to the corresponding heavy-rigid truck image\
And the marker frame and short text tag use green for Empty and bright yellow for Partial, including the available percentage for Partial\
And a circular meter around the marker image is fully green at 100 percent availability, shortens as available space decreases, and shifts through yellow and orange to red at low availability\
And status is never communicated by color alone, while route lines, radius circles, and their legend remain geometrically distinct from marker status\
And all user-facing labels call the violet circle the Approximate current location or Approximate location radius while location privacy remains an internal data-policy term\
And a truck or visitor-location summary appears only on hover or keyboard focus, sits above its marker, and retains a pointer to that marker rather than permanently covering the map\
And selecting one truck enters an explicit focus state that removes every other truck marker and cluster\
And the selected truck keeps one visually distinct marker outside the clustering algorithm while its adjacent information card provides the identity and capacity details without a second permanent map label\
And automatic bounds prioritize that truck's approximate location area and current radius or corridor rather than its regular provider corridors\
And the selected information card fits within the desktop or mobile map without an internal scrollbar or full-screen takeover\
And an explicit close icon dismisses the selected card and restores the full clustered map\
And the map shows the visitor's browser-only You marker when permitted\
And list and map selection remain synchronized.

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
And that one summary includes current capacity, current geometry, up to two provider-level regular corridors, and approximate current location\
And its map uses a high-contrast labeled marker for the approximate truck area above the distinct current radius or corridor layer\
And current capacity, current geometry, and regular service facts each open only their relevant editor\
And no separate future-or-recurring planning section appears below the capacity console\
And Edit current capacity opens the complete current-capacity workflow while regular corridors retain their own explicit saves\
And focused saves preserve unopened values\
And the Driver changes the Approximate location radius and refreshes the truck location directly beneath the summary map without entering an editing workflow\
And either direct location action persists visibly and returns to the same summary.

## Contract ownership

- Public pages: `/capacity`, `/capacity/[id]`
- Provider editors: Driver Home and truck-specific Fleet page
- Application services: current-capacity, regular-corridor, public projection, cursor and proximity functions
- Tests: domain, repository, authorization, E2E, visual audit
