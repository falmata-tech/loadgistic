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

## Contract ownership

- Compatibility adapters and authorization tests
- Tests: capacity-market and E2E redirects
