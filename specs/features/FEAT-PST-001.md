---
id: FEAT-PST-001
title: Pooled shared truckload discovery
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-SHP-001, FEAT-PLC-001]
problem: Individually small PTL loads on one corridor are difficult for providers to discover as a viable combined movement.
behavior: The Load Board presents a virtual pooled shared truckload projection for compatible posted PTL loads without modifying, assigning, pricing, or hiding any source load.
contracts: [PooledSharedTruckload, PstlCompatibility, PstlProjection, PstlDetail, PstlAuthorization]
observability: [pstl_group_count, pstl_member_count, pstl_search_filters]
rollout: Keep pooling read-only and deterministic; disabling the projection leaves every original load unchanged and discoverable.
---

# Pooled shared truckload discovery

### Scenario: compatible PTL loads form a virtual pool

Given at least two discoverable Posted PTL loads have origins within the configured origin radius and destinations within the configured destination radius\
When an authorized provider opens the Pooled loads tab\
Then one deterministic PSTL card summarizes their shared corridor and combined member count\
And each original load remains independently visible and unchanged on the Loads tab\
And the card advises that Multi Pick and Multi Drop may be required.

### Scenario: pooled detail preserves member boundaries

Given an authorized provider opens a PSTL detail\
When the group is recalculated\
Then every still-permitted member load is displayed with its own owner, deadlines, pricing, and interest action\
And the provider negotiates with each owner independently\
And the projection cannot be accepted or assigned as one canonical load.

### Scenario: incompatible or hidden loads do not pool

Given an FTL load, a non-Posted load, an unauthorized Partners or Direct load, or a PTL load outside either radius\
When PSTL groups are calculated\
Then that load is not included in the group\
And no otherwise-hidden load identity or metadata is disclosed.

## Contract ownership

- Domain policy: `src/lib/pstl.js`
- Application projection: `listPooledLoads` and `getPooledLoad` in `src/lib/repository.js`
- Frontend: Load Board pooled tab and PSTL detail route
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
