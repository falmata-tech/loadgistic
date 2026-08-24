---
id: FEAT-MAT-001
title: Coordinate-authoritative marketplace matching
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-PLC-001, FEAT-GEO-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-LST-001]
problem: Public capacity discovery needs useful proximity and route matching without treating labels as coordinates or exposing exact visitor or Driver positions.
behavior: Public filters use only the criteria a visitor actually supplies: either shipment-route endpoint or both, Service-area proximity, truck facts, and opt-in visitor proximity may operate independently or combine conjunctively. Shipment origin and destination remain first-class visible controls rather than being hidden behind a signal-type choice. Selected catalog coordinates, adjustable tolerances, explicit route direction when both endpoints exist, every-segment multi-city Capacity-route evidence, and complete Service-area polygon proximity remain authoritative. A visitor's exact browser location remains client-only while a separately displaced search point reaches the server. The Market filters rather than ranks results.
contracts: [CapacityPlaceSequence, CapacityAreaBoundary, GeographicRouteQuery, RouteSegmentAlignmentMatch, ServiceAreaPolygonMatch, DirectionMode, CurrentAreaFit, VisitorSearchArea, GeographicMatchExplanation]
observability: [geographic_filter_radius, geographic_direction_mode, geographic_candidate_count, geographic_match_count, best_route_source, unresolved_legacy_endpoint_count]
rollout: Replace all pre-customer demo endpoint-pair and circle fixtures with valid multi-city geometry; local and managed Supabase store indexed JSONB place collections and use the same PostGIS matching contract.
---

# Coordinate-authoritative marketplace matching

### Scenario: every Capacity-route city retains catalog identity

Given a provider records a current or regular Capacity route\
When two through five ordered cities are required\
Then every city must be selected from the bounded place search\
And each city stores its catalog reference, country-qualified label, latitude, and longitude\
And a typed label without a selected catalog identity is not accepted as geographic authority.

### Scenario: visitor filters by a freight path

Given a visitor opens the public Capacity Board\
When the visitor selects City A with Radius A and City B with Radius B\
Then a direct candidate matches only when the freight origin and destination are within their selected tolerances of the ordered route\
And the freight points may align with any segments of its two-to-five-city path\
And an Either direction query may also match the reversed path order\
And adjustable radii are evaluated in kilometers from coordinates rather than spelling.

### Scenario: a shipment route also evaluates Service areas

Given a visitor supplies both shipment origin and destination\
When an Empty truck has a current Service area or its transporter has a regular Service area\
Then that area may match only when both shipment endpoints are inside or within their independently selected tolerances of the complete polygon\
And the result identifies the current or regular Service area as the evidence\
And a Partial truck never matches through a current Service area because Partial current availability is route-only\
And an area match does not claim that price, cargo fit, road conditions, timing, or final service is guaranteed.

### Scenario: one route endpoint is still a useful filter

Given a visitor selects only a freight origin or only a freight destination\
When the filter is applied\
Then current and regular Capacity routes and eligible Empty Service areas are matched against that supplied point and its selected tolerance\
And every segment in each two-to-five-city route is considered\
And the omitted endpoint is not treated as a validation failure or an invisible required field\
And direction is applied only when both endpoints were supplied.

### Scenario: supplied filters combine without hidden requirements

Given a visitor supplies any supported subset of availability, geometry, truck facts, Service area, Capacity-route endpoint, freshness, or nearby-location criteria\
When the filter is applied\
Then every supplied criterion constrains the result and every omitted criterion remains neutral\
And applying one field produces matching results without requiring unrelated fields\
And the result remains an unranked geographic set of current trucks.

### Scenario: current and regular Capacity routes remain distinct

Given one truck has a latest Empty or Partial Capacity route or Service area and its provider has a regular Capacity route\
When either signal is compared with a manual public Board query\
Then both signals are evaluated independently and labeled by source\
And a regular Capacity route is eligible in either direction while the current Capacity route retains its published direction\
And no regular Capacity route is presented as current availability\
And a truck currently publishing a Service area may still match through a separate regular Capacity route\
And the strongest eligible signal supplies the distance explanation and direction.

### Scenario: freight endpoints may fall along a multi-city truck route

Given a visitor selects a freight origin and destination from the place catalog\
And a truck's current Capacity route or provider regular Capacity route extends beyond one or both freight endpoints\
When both freight endpoints fall within the selected tolerance of any ordered route segments\
Then the truck may match even when its first and last route cities are farther away\
And a directional current Capacity route requires the freight origin to occur no later than its destination along the complete path\
And an Either direction query or a two-way regular Capacity route may match the reverse orientation\
And the interface calls this Capacity route alignment rather than claiming a road-route, dispatch, price, or cargo-fit guarantee\
And the comparison uses the stored structured coordinates without inventing a road path from place names.

### Scenario: endpoint match evidence remains explainable

Given one candidate satisfies one or both supplied endpoint tolerances\
When its map result is selected\
Then its match evidence identifies the matching current or regular Capacity route\
And each supplied endpoint distance is rounded for marketplace display\
And the evidence does not claim rank, dispatch suitability, road distance, or guaranteed service.

### Scenario: current truck area is uncertainty aware

Given a Board query includes the visitor's separately displaced search center and a bounded search radius\
When a truck has a Driver-obscured latest reported radius\
Then Prefer mode raises overlapping trucks without excluding other route matches\
And Require mode keeps only trucks whose uncertainty circle overlaps the requested area\
And the result says Current area overlaps rather than exposing or implying an exact truck position\
And missing current-area coordinates cannot satisfy Require mode\
And an older coordinate that satisfies Require mode is labeled with its actual update age and never described as a live position.

### Scenario: Service-area matching stays polygon based

Given a visitor-selected place and current Service area are compared\
When the complete three-to-five-city boundary and requested tolerance exist\
Then point-in-polygon or nearest-boundary proximity rules are used\
And the two-endpoint intercity matcher is not applied.

### Scenario: the public filter covers every usable truck fact

Given a visitor opens the Truck Market filter\
When the filter is expanded\
Then the visitor may combine transporter or truck search, Empty or Partial, current Service area or Capacity route, cargo configuration, Full or Partial load acceptance, multi-pick or multi-drop capability, update freshness, and geographic matching\
And no remaining-space percentage is accepted as a filter because Empty and Partial are categorical market signals\
And independently optional structured shipment origin and destination inputs are visible without first choosing a signal type\
And each shipment endpoint has an adjustable tolerance while direction applies only when both exist\
And the separate signal-type filter may still constrain results to Service area or Capacity route evidence\
And Service area search also provides one optional structured place plus an adjustable search distance\
And text search covers every current or regular Capacity-route and Service-area city label\
And visitor-location proximity is disabled until the visitor explicitly enables it, after which it uses the privacy-safe search point plus a chosen distance against each truck's approximate-location uncertainty\
And browser permission or a manual location refresh alone never applies a proximity predicate\
And unsupported private facts, exact coordinates, plates, and proof files never become filter inputs or projection fields.

### Scenario: geographic filtering precedes pagination

Given public Capacity Board data exceeds one cursor page\
When a coordinate filter or route match is applied\
Then authorization and indexed non-geographic predicates run first\
And geographic predicates reduce candidates before the requested page is returned\
And a recent-record candidate limit cannot hide an otherwise valid geographic match.

### Scenario: pre-customer demo geometry is replaced

Given all stored capacity belongs to fake demo users\
When the geometry migration runs\
Then every current or regular Capacity route receives a new deterministic two-to-five-city place sequence\
And each sequence follows a plausible Ethiopian road corridor relevant to the truck's approximate current city without unnecessary filler stops\
And every current or regular Service area receives a new nearby center and three-to-five-city polygon boundary that contains that center\
And the application does not reconstruct missing new geometry from the retired endpoint or circle fields.

## Contract ownership

- Domain: coordinate distance, every-segment route matching, polygon proximity, direction, uncertainty overlap, and explainable evidence selection without transporter ranking
- Persistence: structured place collections and area boundaries in local and managed Supabase PostgreSQL migrations
- Application services: public Capacity Board and provider-profile projections
- Frontend: browser-only visitor location, structured route controls, adjustable radii, direction, and match explanations
- Tests: domain, capacity-market, E2E, and UI audit
