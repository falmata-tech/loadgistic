---
id: FEAT-GEO-001
title: Privacy-aware public capacity geography
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-PLC-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-LST-001, FEAT-MAT-001]
problem: Capacity seekers need to understand nearby and route-based truck availability without exposing an exact Driver or visitor position.
behavior: Empty or Partial capacity uses either a radius or corridor. Drivers obscure device location before publication, the selected signal always shows a separate approximate-location circle sized by the Driver's accuracy, and each provider may publish up to two regular corridors.
contracts: [AvailabilityGeometry, CurrentRadiusArea, CurrentCorridor, RegularCorridor, VisitorSearchArea, TruckPrivacyCircle, PublicCapacityGeography, GeographicMatch]
observability: [geographic_match_kind, visitor_location_consent_outcome, bounded_geography_query, public_map_open]
rollout: Reuse structured place references and current radius/corridor fields, remove future-trip and regular-area storage, prune regular corridors deterministically to two per provider, and keep location-based ranking disabled until projection and privacy tests pass.
---

# Public capacity geography

### Scenario: current availability chooses one geography

Given an authorized Driver publishes current capacity\
When availability geography is selected\
Then Empty or Partial chooses Available in a radius or Available on a corridor\
And the choice is independent from the approximate current-location controls\
And immediate radius and route signals do not require a date.

### Scenario: current radius uses a Driver-obscured position

Given the assigned Driver chooses a supported privacy radius and grants browser location\
When current radius availability is refreshed\
Then the exact device coordinate is displaced in the browser before submission\
And only the displaced center, chosen privacy radius, safe general-area label, and timestamp are stored\
And the public map always shows a violet privacy circle sized by that chosen accuracy\
And all user-facing copy names that circle the Approximate current location or Approximate location radius rather than exposing the internal privacy-control term\
And radius availability adds a separate green working circle\
And Fleet owners may preserve but cannot replace that Driver location with their own device position.

### Scenario: current corridor uses structured endpoints

Given the Driver selects corridor availability\
When origin and destination are saved\
Then both are selected from the reviewed place catalog\
And the public map shows a yellow route relationship with direction\
And no travel date is requested or inferred.

### Scenario: regular corridors are clearly labeled and limited

Given a provider records regular service corridors\
When they are published on the Capacity Board or microsite\
Then up to two structured two-way corridors appear as undated blue dashed relationships\
And each relationship is presented as Place A ↔ Place B on cards, summaries, and provider pages\
And the user-facing label states Regular corridor plus Confirm availability\
And it is not represented as a currently located truck.

### Scenario: visitor location is optional and client-private

Given a visitor opens public capacity discovery\
When the visitor grants location permission\
Then the exact coordinate stays in browser memory\
And a separately displaced search point and bounded search radius are sent for ranking\
And the interface confirms that a new device reading was received\
And the shared map shows a browser-rendered You marker relative to public uncertainty areas\
And public cards explain the resulting possible distance range when one is available.

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
And violet approximate location, green current radius, yellow current corridor, and blue dashed regular corridor use shape, line style, icon, and text in addition to color\
And selecting a truck removes other truck markers and clusters until the selected card is closed\
And the selected marker remains visually distinct and above its signal layers at every fitted zoom while the adjacent information card carries its label and details.

### Scenario: legacy geography is migrated honestly

Given older capacity has Local, Long-distance, Both, dated Empty route, or preferred-route fields\
When compatibility projection runs\
Then resolvable active data maps to the closest current radius, current corridor, or regular-corridor concept\
And obsolete Board fields are hidden\
And unresolved data stays preserved for rollback without inventing coordinates or publication.

## Contract ownership

- Domain: radius, route, direction, displacement, overlap, and expiry rules
- Persistence: current capacity, up to two regular corridors, and structured location fields
- Frontend: provider editor, public Capacity Board filters, cards, and one shared map
- Tests: domain, repository, authorization, E2E, and visual audit
