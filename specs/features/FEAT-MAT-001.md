---
id: FEAT-MAT-001
title: Coordinate-authoritative marketplace matching
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-PLC-001, FEAT-GEO-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-LST-001]
problem: Location text and exact city-name equality produce false negatives, ambiguous matches, and filters that cannot distinguish nearby settlements from unrelated names.
behavior: Every location filter and comparison uses selected catalog coordinates, adjustable radii, explicit direction, and explainable distance evidence while ordinary text search remains limited to identity and descriptive content.
contracts: [StructuredRouteEndpoint, GeographicRouteQuery, EndpointRadiusMatch, DirectionMode, MultiRouteBestMatch, CurrentAreaFit, DirectoryProximityFilter, GeographicMatchExplanation]
observability: [geographic_filter_radius, geographic_direction_mode, geographic_candidate_count, geographic_match_count, best_route_source, unresolved_legacy_endpoint_count]
rollout: Additive endpoint columns are backfilled from the local place catalog when unambiguous; unresolved legacy labels remain displayable but cannot produce geographic matches; SQLite uses a deterministic distance function and the Supabase target uses indexed PostGIS geography.
---

# Coordinate-authoritative marketplace matching

### Scenario: route endpoints retain catalog identity

Given a member records a load, current truck route, planned truck route, Freight Route, or Preferred Route\
When an origin and destination are required\
Then both endpoints must be selected from the bounded place search\
And each endpoint stores its catalog reference, country-qualified label, latitude, and longitude\
And a typed label without a selected catalog identity is not accepted as geographic authority.

### Scenario: member filters by two endpoint circles

Given an authenticated member opens the Shipment Board or Truck Board\
When the member selects City A with Radius A and City B with Radius B\
Then a direct candidate matches only when its origin is inside Radius A and its destination is inside Radius B\
And an Either direction query may also match the reversed endpoint assignment\
And adjustable radii are evaluated in kilometers from coordinates rather than spelling.

### Scenario: one truck contributes multiple routes

Given one truck has a fresh current partial-capacity route and an eligible planned route\
When either route is compared with a load or manual Board query\
Then both routes are evaluated independently\
And the truck remains one Board result\
And the strongest eligible route supplies the score, distance explanation, route source, and direction.

### Scenario: endpoint ranking remains explainable

Given more than one candidate satisfies both endpoint radii\
When results are ranked\
Then the candidate with the lowest normalized worst-endpoint distance ranks first\
And ties use total endpoint distance and freshness\
And each result reports origin and destination distances rounded for marketplace display\
And the score does not claim dispatch suitability, road distance, or guaranteed service.

### Scenario: current truck area is uncertainty aware

Given a Board query optionally includes a current-area center and radius\
When a truck has a fresh obscured device area or structured manual area\
Then Prefer mode raises overlapping trucks without excluding other route matches\
And Require mode keeps only trucks whose uncertainty circle overlaps the requested area\
And the result says Current area overlaps rather than exposing or implying an exact truck position\
And stale or missing current-area coordinates cannot satisfy Require mode.

### Scenario: Directory separates text from location

Given an authenticated member searches the Directory\
When text is entered\
Then only member names and descriptive business or service content are searched\
And city, route, region, and location labels are not treated as text matches.

Given the member selects a Near city and radius\
When Directory results are returned\
Then member base coordinates are compared with the selected center\
And matching members are ranked by geographic distance\
And the selected catalog identity, radius, type filter, and page survive navigation.

### Scenario: Local matching stays area based

Given Local loads, Local capacity, or Local Service Areas are compared\
When structured centers and radii exist\
Then point-in-radius or circle-overlap rules are used\
And the two-endpoint intercity matcher is not applied.

### Scenario: geographic filtering precedes pagination

Given authorized Board or Directory data exceeds one page\
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
- Application services: Board, Directory, profile, network coverage, and pooling projections
- Frontend: structured location controls, adjustable radii, direction, current-area preference, and match explanations
- Tests: domain, repository, authorization, stress-data, E2E, and UI audit
