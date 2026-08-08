---
id: FEAT-MAT-001
title: Coordinate-authoritative marketplace matching
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-PLC-001, FEAT-GEO-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-LST-001]
problem: Public capacity discovery needs useful proximity and route matching without treating labels as coordinates or exposing exact visitor or Driver positions.
behavior: Public filters use selected catalog coordinates, adjustable radii, explicit route direction, and explainable distance evidence. A visitor's exact browser location remains client-only while a separately displaced search point reaches the server.
contracts: [StructuredRouteEndpoint, GeographicRouteQuery, EndpointRadiusMatch, DirectionMode, CurrentAreaFit, VisitorSearchArea, GeographicMatchExplanation]
observability: [geographic_filter_radius, geographic_direction_mode, geographic_candidate_count, geographic_match_count, best_route_source, unresolved_legacy_endpoint_count]
rollout: Additive endpoint columns are backfilled from the local place catalog when unambiguous; unresolved legacy labels remain displayable but cannot produce geographic matches; SQLite uses a deterministic distance function and the Supabase target uses indexed PostGIS geography.
---

# Coordinate-authoritative marketplace matching

### Scenario: route endpoints retain catalog identity

Given a provider records a current capacity route, next trip, or recurring route\
When an origin and destination are required\
Then both endpoints must be selected from the bounded place search\
And each endpoint stores its catalog reference, country-qualified label, latitude, and longitude\
And a typed label without a selected catalog identity is not accepted as geographic authority.

Given a provider records a recurring working area\
When its center and radius are saved\
Then the center keeps one catalog identity and coordinate pair\
And the radius is stored in kilometres from 5 through 500.

### Scenario: visitor filters by two endpoint circles

Given a visitor opens the public Capacity Board\
When the visitor selects City A with Radius A and City B with Radius B\
Then a direct candidate matches only when its origin is inside Radius A and its destination is inside Radius B\
And an Either direction query may also match the reversed endpoint assignment\
And adjustable radii are evaluated in kilometers from coordinates rather than spelling.

### Scenario: one truck contributes current and future signals

Given one truck has a fresh current route and one eligible next trip\
When either signal is compared with a manual public Board query\
Then both signals are evaluated independently and labeled by source\
And no next trip is presented as current availability\
And the strongest eligible signal supplies the distance explanation and direction.

### Scenario: endpoint ranking remains explainable

Given more than one candidate satisfies both endpoint radii\
When results are ranked\
Then the candidate with the lowest normalized worst-endpoint distance ranks first\
And ties use total endpoint distance and freshness\
And each result reports origin and destination distances rounded for marketplace display\
And the score does not claim dispatch suitability, road distance, or guaranteed service.

### Scenario: current truck area is uncertainty aware

Given a Board query includes the visitor's separately displaced search center and a bounded search radius\
When a truck has a fresh Driver-obscured current radius\
Then Prefer mode raises overlapping trucks without excluding other route matches\
And Require mode keeps only trucks whose uncertainty circle overlaps the requested area\
And the result says Current area overlaps rather than exposing or implying an exact truck position\
And stale or missing current-area coordinates cannot satisfy Require mode.

### Scenario: radius matching stays area based

Given a visitor search area and current capacity radius are compared\
When their displaced centers and declared radii exist\
Then point-in-radius or circle-overlap rules are used\
And the two-endpoint intercity matcher is not applied.

### Scenario: geographic filtering precedes pagination

Given public Capacity Board data exceeds one cursor page\
When a coordinate filter or route match is applied\
Then authorization and indexed non-geographic predicates run first\
And geographic predicates reduce candidates before the requested page is returned\
And a recent-record candidate limit cannot hide an otherwise valid geographic match.

### Scenario: legacy endpoints are migrated honestly

Given an older record contains only a country-qualified location label\
When the additive migration finds one unambiguous catalog place\
Then the structured reference and coordinates are backfilled\
And the original display label remains stable.

Given the label cannot be resolved unambiguously\
When geographic matching runs\
Then the record is labeled Location needs confirmation\
And no coordinate or match is invented from text similarity.

## Contract ownership

- Domain: coordinate distance, endpoint-radius matching, direction, uncertainty overlap, and ranking
- Persistence: structured base locations and route endpoints in SQLite and Supabase migrations
- Application services: public Capacity Board and provider-profile projections
- Frontend: browser-only visitor location, structured route controls, adjustable radii, direction, and match explanations
- Tests: domain, capacity-market, E2E, and UI audit
