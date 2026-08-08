---
id: FEAT-CAP-001
title: Public truck-capacity signals and provider publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-FLT-001, FEAT-GEO-001, FEAT-MAT-001, FEAT-MKT-001, FEAT-PRV-001]
problem: Capacity seekers need immediate, public, location-relevant truck discovery while transport providers need simple and honest ways to publish current, future, and recurring availability.
behavior: Authorized providers publish one current Empty signal as radius or route, or one Partial signal as an undated route; at most one next trip per truck; and multiple provider-level undated recurring routes or permanent working-radius areas. Anyone may browse bounded public projections without an account; exact truck and visitor coordinates remain private.
contracts: [CurrentCapacitySignal, CapacityStatus, AvailabilityGeometry, NextTrip, RecurringServiceSignal, CapacityFreshness, PublicCapacityProjection, CapacityCursorPage, VisitorLocationQuery, CapacityMapProjection, CapacityProof, DutyCommand]
observability: [capacity_audit, next_trip_audit, corridor_audit, public_capacity_query, cursor_outcome, location_query_outcome, freshness]
rollout: Add signal fields and next-trip storage additively, translate compatible provider capacity rows, retire demand and relationship filters, and monitor public-projection fields and query volume.
---

# Public truck-capacity signals

### Scenario: current availability uses radius or route

Given an authorized fleet owner or Driver publishes current capacity for one truck\
When the current signal is saved\
Then Empty requires exactly one availability geometry: radius or specific route\
And Partial requires a specific route and cannot publish a current radius\
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

### Scenario: next trip is separate and optionally dated

Given a truck may have a future journey\
When its provider publishes the next trip\
Then the record requires one structured route and may include one future calendar date\
And it records Empty or Partial capacity independently from the current signal\
And each truck has at most one active next trip\
And replacing it is audited\
And the public card and map show weekday plus date when supplied\
And a dated trip stops appearing after its travel date.

### Scenario: recurring service signals are multiple and undated

Given a provider regularly serves one or more routes or areas\
When its owner maintains recurring service signals\
Then each signal independently chooses a structured directional route or a permanent working radius around one structured place\
And a working radius accepts 5 through 500 kilometres\
And no recurring signal asks for a date or claims that a truck is currently available\
And public cards state Confirm availability\
And the shared map uses a labeled blue dashed line for a recurring route and a labeled cyan dotted/fill circle for a recurring working area.

### Scenario: Off Duty removes current availability

Given a truck has current capacity\
When an authorized actor selects Off Duty\
Then its current signal is absent from public discovery\
And its next trip and provider recurring signals remain separate records governed by their own state\
And Busy is rejected.

### Scenario: public Board is cursor bounded

Given public capacity contains more results than one response\
When any visitor opens or scrolls the Board\
Then the server returns a stable cursor page of 12 through 16 independently actionable cards\
And approaching the end fetches the next page\
And a Load more capacity fallback remains keyboard accessible\
And filters, loaded cursor state, and scroll position survive a profile/detail round trip\
And the end of results is stated plainly.

### Scenario: public projection is deliberately safe

Given a visitor has no Loadgistic account\
When current capacity, a next trip, or a corridor is returned\
Then the projection may include provider public identity, public handle, provider-controlled contact availability, verification summaries, truck presentation, obscured area or structured route, capacity facts, and freshness\
And it excludes plate, private account contacts, raw exact coordinates, proof paths, tracking secrets, and administrative data\
And the card links to a public signal detail and the provider microsite.

### Scenario: visitor location remains private

Given a visitor chooses Show capacity near me\
When the browser grants geolocation\
Then the exact point remains in browser memory\
And only a displaced query point and bounded radius reach the server\
And results show a possible distance range rather than an exact truck distance\
And denial leaves the full public Board usable.

### Scenario: one shared map is loaded on demand

Given a visitor is browsing capacity cards\
When no map action has been selected\
Then cards use a lightweight map-like action rather than one live tile map per card\
And choosing Map view or View on map loads one shared interactive map\
And the map focuses the selected signal, shows the visitor's browser-only You marker when permitted, and clusters crowded signals that separate as the visitor zooms\
And list and map selection remain synchronized.

### Scenario: provider editor collapses to the published summary

Given a truck has saved capacity facts\
When its authorized provider opens the editor\
Then a map-centered summary appears before the full editor\
And Status, availability geometry, location privacy, next trip, and accepted-work facts each open only their relevant editor\
And Edit all opens the complete workflow\
And focused saves preserve unopened values.

## Contract ownership

- Public pages: `/capacity`, `/capacity/[id]`
- Provider editors: Driver Home and truck-specific Fleet page
- Application services: current-capacity, next-trip, corridor, public projection, cursor and proximity functions
- Tests: domain, repository, authorization, E2E, visual audit
