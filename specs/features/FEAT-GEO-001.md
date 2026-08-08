---
id: FEAT-GEO-001
title: Privacy-aware public capacity geography
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-PLC-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-LST-001, FEAT-MAT-001]
problem: Capacity seekers need to understand nearby and route-based truck availability without exposing an exact Driver or visitor position.
behavior: Empty truck capacity uses radius or route while Partial is route-only. Drivers obscure device location before publication, the selected signal always shows a separate privacy circle sized by the Driver's accuracy, and recurring provider service may be a route or permanent working radius.
contracts: [AvailabilityGeometry, CurrentRadiusArea, CurrentRoute, RecurringRoute, RecurringWorkingArea, VisitorSearchArea, TruckPrivacyCircle, PublicCapacityGeography, GeographicMatch]
observability: [geographic_match_kind, visitor_location_consent_outcome, bounded_geography_query, public_map_open]
rollout: Reuse structured place references and additive capacity fields, preserve legacy route and local-area data for rollback, and keep location-based ranking disabled until projection and privacy tests pass.
---

# Public capacity geography

### Scenario: current availability chooses one geography

Given an authorized Driver publishes current capacity\
When availability geography is selected\
Then Empty chooses Available in a radius or Available on a specific route\
And Partial is always Available on a specific route\
And the choice is independent from current-location privacy controls\
And immediate radius and route signals do not require a date.

### Scenario: current radius uses a Driver-obscured position

Given the assigned Driver chooses a supported privacy radius and grants browser location\
When current radius availability is refreshed\
Then the exact device coordinate is displaced in the browser before submission\
And only the displaced center, chosen privacy radius, safe general-area label, and timestamp are stored\
And the public map always shows a violet privacy circle sized by that chosen accuracy\
And radius availability adds a separate green working circle\
And Fleet owners may preserve but cannot replace that Driver location with their own device position.

### Scenario: current route uses structured endpoints

Given the Driver selects specific-route availability\
When origin and destination are saved\
Then both are selected from the reviewed place catalog\
And the public map shows a yellow route relationship with direction\
And no travel date is requested or inferred.

### Scenario: next trip remains distinct

Given a provider records the one next trip for a truck\
When the trip is published\
Then it has structured origin, destination, and an optional future travel date\
And the weekday and calendar date are displayed together when a date exists\
And it appears in orange and is labeled Next trip rather than current capacity\
And an undated next trip never claims a specific departure day.

### Scenario: recurring routes and working areas are market signals

Given a provider records one or more recurring service signals\
When they are published on the Capacity Board or microsite\
Then a structured directional route appears as an undated blue dashed relationship\
And a permanent working radius appears as a cyan dotted/fill circle centered on a structured place\
And the label states Recurring route or Recurring working area plus Confirm availability\
And it is not represented as a currently located truck.

### Scenario: visitor location is optional and client-private

Given a visitor opens public capacity discovery\
When the visitor grants location permission\
Then the exact coordinate stays in browser memory\
And a separately displaced search point and bounded search radius are sent for ranking\
And the shared map may show a browser-rendered You marker relative to public uncertainty areas.

Given the visitor denies or dismisses permission\
When the Board continues\
Then all public capacity remains browsable\
And manual place and route filters remain available\
And no repeated permission prompt blocks the page.

### Scenario: public map does not multiply map clients

Given a cursor page contains many capacity cards\
When the list view renders\
Then cards use lightweight geographic summaries and a prominent View on map action\
And no live tile map is instantiated inside each card.

When the visitor opens Map view or a card map action\
Then one shared map is loaded on demand and synchronized with the current filtered feed\
And violet privacy, green current radius, yellow current route, orange next trip, blue dashed recurring route, and cyan recurring working area use shape, line style, icon, and text in addition to color.

### Scenario: legacy geography is migrated honestly

Given older capacity has Local, Long-distance, Both, dated Empty route, or preferred-route fields\
When compatibility projection runs\
Then resolvable active data maps to the closest current radius, current route, next-trip, or recurring-corridor concept\
And obsolete Board fields are hidden\
And unresolved data stays preserved for rollback without inventing coordinates or publication.

## Contract ownership

- Domain: radius, route, direction, displacement, overlap, and expiry rules
- Persistence: current capacity, next-trip, recurring-route, recurring-working-area, and structured location fields
- Frontend: provider editor, public Capacity Board filters, cards, and one shared map
- Tests: domain, repository, authorization, E2E, and visual audit
