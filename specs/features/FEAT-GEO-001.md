---
id: FEAT-GEO-001
title: Privacy-aware public capacity geography
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-PLC-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-LST-001, FEAT-MAT-001]
problem: Capacity seekers need to understand nearby and route-based truck availability without exposing an exact Driver or visitor position.
behavior: Empty capacity uses either a Service area or Capacity route, while Partial capacity uses a Capacity route only. Drivers obscure device location before publication, the selected signal always shows a separate approximate-location circle sized by the Driver's accuracy, and each provider may publish one regular Service area or Capacity route.
contracts: [AvailabilityGeometry, CurrentRadiusArea, CurrentCorridor, RegularCapacitySignal, VisitorSearchArea, TruckPrivacyCircle, PublicCapacityGeography, GeographicMatch]
observability: [geographic_match_kind, visitor_location_consent_outcome, bounded_geography_query, public_map_open]
rollout: Reuse structured place references, prune pre-customer regular records deterministically to one per provider, add regular geometry fields, rebuild demo signals near reported truck locations, and keep visitor proximity an explicit filter rather than a ranking input.
---

# Public capacity geography

### Scenario: current availability chooses one geography

Given an authorized Driver publishes current capacity\
When availability geography is selected\
Then Empty chooses Available in a Service area or Available on a Capacity route\
And Partial chooses Available on a Capacity route only\
And the choice is independent from the approximate current-location controls\
And immediate Service-area and Capacity-route signals do not require a date\
And an Empty current Service area or Capacity route is green while a Partial current Capacity route is yellow\
And geometry shape, status text, and the map key communicate the same state without relying on color alone.

### Scenario: current radius uses a Driver-obscured position

Given the assigned Driver chooses a supported privacy radius and grants browser location\
When current radius availability is refreshed\
Then the exact device coordinate is displaced in the browser before submission\
And only the displaced center, chosen privacy radius, safe general-area label, and timestamp are stored\
And the public map always shows a violet privacy circle sized by that chosen accuracy\
And all user-facing copy names that circle the Approximate current location or Approximate location radius rather than exposing the internal privacy-control term\
And Empty Service-area availability adds a separate green hollow working polygon whose interior does not block route interaction\
And Fleet owners may preserve but cannot replace that Driver location with their own device position.

### Scenario: current Capacity route uses structured points

Given the Driver selects Capacity-route availability\
When two to five ordered route points are saved\
Then every point is selected from the reviewed place catalog\
And the public map shows a green Empty or yellow Partial route relationship with direction\
And no travel date is requested or inferred.

### Scenario: regular service is clearly labeled and limited

Given a provider records regular service\
When they are published on the Capacity Board or microsite\
Then no more than one undated regular Service area or structured two-way Capacity route appears\
And a route is presented as its complete ordered Place A ↔ Place B sequence while an area names its center and surrounding cities\
And the user-facing label states Regular service area or Regular capacity route plus Confirm availability\
And it is not represented as a currently located truck.

### Scenario: visitor location is optional and client-private

Given a visitor opens public capacity discovery\
When the visitor grants location permission\
Then the exact coordinate stays in browser memory\
And a separately displaced search point and bounded search radius are sent only after the visitor enables the proximity filter\
And the interface confirms that a new device reading was received\
And the shared map shows a browser-rendered You marker relative to public uncertainty areas\
And public cards explain the resulting possible distance range when one is available.

Given the visitor denies or dismisses permission\
When the Board continues\
Then all public capacity remains browsable\
And manual place and route filters remain available\
And no repeated permission prompt blocks the page.

### Scenario: public map does not multiply map clients

Given a bounded cursor page contains many capacity signals\
When the Market renders\
Then one shared map is loaded and synchronized with the current filtered feed\
And no per-truck tile map or ranked List view is instantiated\
And its initial framing remains focused on Ethiopia while public and provider views may be panned only within a practical East Africa envelope\
And violet approximate location, status-colored current Service area or Capacity route, and blue regular service use shape, line style, icon, and text in addition to color\
And selecting a truck removes other truck markers and clusters until the selected card is closed\
And the selected marker remains visually distinct and above its signal layers at every fitted zoom while a compact in-map information window carries its essential truck actions\
And hovering or focusing one signal shows a temporary readable light-surface explanation with a restrained neutral border and signal-matched accent\
And clicking or pressing a signal pins the explanation until it is dismissed or another map target is chosen\
And clicking or pressing one signal pins only that signal's compact explanation until it is dismissed or another signal is chosen\
And overlapping current and regular Capacity routes use small opposite visual offsets without changing their stored cities so each remains independently selectable\
And Service-area and approximate-location interiors remain non-interactive while their wide outlines remain available to pointer and keyboard users.

### Scenario: legacy geography is migrated honestly

Given older capacity has Local, Long-distance, Both, dated Empty route, or preferred-route fields\
When compatibility projection runs\
Then resolvable active data maps to the closest current Service area, current Capacity route, or regular-service concept\
And obsolete Board fields are hidden\
And unresolved data stays preserved for rollback without inventing coordinates or publication.

## Contract ownership

- Domain: radius, route, direction, displacement, overlap, and update-age rules
- Persistence: current capacity, one regular Service area or Capacity route, and structured location fields
- Frontend: provider editor, public Capacity Board filters, cards, and one shared map
- Tests: domain, repository, authorization, E2E, and visual audit
