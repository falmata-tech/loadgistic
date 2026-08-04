---
id: FEAT-PST-001
title: Shared shipment discovery
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-SHP-001, FEAT-PLC-001]
problem: Individually small PTL shipments and sequential corridor opportunities are difficult for providers to discover as viable truck movements.
behavior: The Shipment Board presents one Shared Shipments workspace with Pool together and Along the route projections without modifying, assigning, pricing, or hiding any source shipment.
contracts: [PooledSharedShipment, PstlCompatibility, AlongRouteCompatibility, SharedShipmentProjection, SharedShipmentDetail, SharedShipmentAuthorization]
observability: [shared_candidate_count, shared_member_count, shared_strategy, shared_search_filters]
rollout: Keep both projections read-only, bounded, and deterministic; disabling them leaves every original shipment unchanged and discoverable.
---

# Shared shipment discovery

### Scenario: compatible PTL shipments form a virtual pool

Given at least two discoverable Posted PTL shipments have pairwise-compatible origins, destinations, and deadlines\
When an authorized provider opens Shared Shipments and selects Pool together\
Then one deterministic candidate card summarizes their shared areas and member count\
And each original shipment remains independently visible and unchanged on the Shipments tab\
And the card identifies the endpoint spread and advises separate confirmation.

### Scenario: pooled detail preserves member boundaries

Given an authorized provider opens a pooled-shipment detail\
When the group is recalculated\
Then every still-permitted member shipment is displayed with its own owner, deadlines, pricing, and interest action\
And every member reuses the standard Shipment Board card with the same route or Local facts, cargo description, vehicle requirement, posted time, owner verification, reputation, Business and phone actions, and current provider action state\
And the provider negotiates with each owner independently\
And the projection cannot be accepted or assigned as one canonical shipment.

### Scenario: along-route shipments form an ordered candidate

Given discoverable Posted Between-cities shipments connect through nearby drop-off and pickup areas\
When an authorized provider selects Along the route\
Then forward, deadline-compatible legs are displayed in travel order\
And connector distance, FTL/PTL type, deadlines, and independent prices remain visible\
And each ordered leg reuses the standard Shipment Board card with the same facts, trust signals, and available actions as its source shipment\
And the provider must negotiate each shipment independently.

### Scenario: incompatible or hidden shipments do not pool

Given an FTL shipment for pooling, a non-Posted shipment, an unauthorized Partners or Direct shipment, or a PTL shipment outside either radius\
When PSTL groups are calculated\
Then that shipment is not included in the group\
And no otherwise-hidden shipment identity or metadata is disclosed.

## Contract ownership

- Domain policy: `src/lib/pstl.js`
- Application projection: `listPooledLoads`, `getPooledLoad`, `listAlongRouteLoads`, and `getAlongRouteLoad` in `src/lib/repository.js`
- Frontend: Shipment Board Shared Shipments modes and detail routes
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
