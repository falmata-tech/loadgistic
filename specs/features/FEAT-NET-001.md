---
id: FEAT-NET-001
title: Retired demand-side member network
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-MKT-001, FEAT-SHP-001]
problem: Favorites, partner visibility, and cross-market requests belonged to the former authenticated demand marketplace.
behavior: Current public capacity discovery does not require or expose member-network relationships. Fake local relationship rows are purged and no current navigation, filter, profile, or mutation depends on them.
contracts: [RetiredNetworkRelationship]
observability: [retired_network_route_request]
rollout: Hide current surfaces, deny mutations, purge fake local rows, and restore only from an operator-approved backup if rollback is required.
---

# Retired network

### Scenario: public discovery ignores legacy relationships

Given an older local fixture contains Favorite, Pending, or Connected rows\
When a visitor browses public capacity\
Then visibility and ranking do not depend on those rows\
And no relationship identity is exposed.

### Scenario: current network mutation is denied

Given any current actor requests a legacy network mutation\
When the service evaluates it\
Then no relationship changes\
And the response directs discovery to public capacity where appropriate.

### Scenario: provider Network remains a separate access-control feature

Given an authorized provider opens `/app/network`\
When the current page is resolved\
Then it manages only truck-scoped Private capacity access under `FEAT-SHR-001`\
And it does not read, restore, or mutate a Favorite, partner relationship,
request, or demand-side member network.

## Contract ownership

- Compatibility adapters and authorization tests
- Retired compatibility endpoint: `/api/network`
- Current truck-scoped provider page: `/app/network` under `FEAT-SHR-001`
- Tests: capacity-market, authorization, and E2E
