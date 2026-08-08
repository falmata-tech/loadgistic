---
id: FEAT-PST-001
title: Retired shared-demand discovery
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-SHP-001, FEAT-MKT-001]
problem: The earlier demand-posting marketplace included pooled and along-route shipment suggestions that conflict with the public capacity-only product.
behavior: Pool together, Along the route, pooled-load details, and shared-demand projections are absent from current public and provider workflows. Fake local demand rows are purged.
contracts: [RetiredDemandProjection]
observability: [retired_route_request]
rollout: Remove navigation and reads, purge fake local demand rows, and restore only from an operator-approved backup if rollback is required.
---

# Retired shared-demand discovery

### Scenario: shared demand is unavailable

Given a public visitor, provider, Driver, or legacy Business account uses the current product\
When it opens navigation, public discovery, or a former shared-demand URL\
Then Pool together and Along the route are absent\
And former routes return a safe Capacity Board redirect or not-found response\
And no legacy shipment is exposed.

## Contract ownership

- Compatibility routes only
- Tests: capacity-market and E2E redirects
