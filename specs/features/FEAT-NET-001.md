---
id: FEAT-NET-001
title: Cross-market member network
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-SHP-001, FEAT-CAP-001]
problem: Businesses and transport providers need a private relationship workspace without confusing a personal favorite with a mutually accepted operating connection.
behavior: Members may privately favorite eligible collaborators, Businesses may favorite other Businesses for party selection, and cross-market members may request or decide a connection; only a mutual Connected Business-provider relationship unlocks Partners-only loads and capacity.
contracts: [NetworkRelationship, NetworkFavorite, BusinessFavorite, ConnectionRequest, ConnectionDecision, PartnerVisibilityPolicy, NetworkDirectoryAction]
observability: [network_favorite_audit, connection_request_audit, connection_decision_audit, partner_visibility_denial]
rollout: Add relationship states compatibly, treat existing saved relationships as Connected, and retain a rollback path that reads Connected rows as the previous saved relationship.
---

# Member network

### Scenario: network views remain bounded

Given Connected, Requests, or Favorites contains more than one page\
When the owner changes the selected page\
Then only one bounded page of that view is rendered\
And the full per-view counts remain visible\
And relationship actions return to the current view and page.

### Scenario: member keeps a private favorite

Given a Business or authorized transport provider opens an eligible authenticated Public Profile\
When it adds that member as a Favorite\
Then the Favorite appears only in the acting workspace's My Network page\
And the other member receives no connection access or Partners-only visibility.

### Scenario: Businesses may favorite Businesses

Given a signed-in Business views another Business profile\
When it adds that Business as a favorite\
Then the favorite is private to the acting Business\
And the favorited Business ranks before other matches in shipper or receiver selection\
And the favorite does not create a transporter partnership or unlock marketplace data.

### Scenario: either market side requests a connection

Given a Business views a Fleet Transporter or Self-managed Driver, or an authorized transport provider views a Business\
When the actor requests a network connection\
Then one Pending relationship is created for that Business-provider pair\
And the requester retains the member as a Favorite while the recipient sees an incoming request.

### Scenario: mutual connection unlocks partner visibility

Given an eligible recipient has a Pending network request\
When the recipient accepts it\
Then the relationship becomes Connected for both members\
And Partners-only loads from that Business and Partners-only capacity from that provider become visible to the connected counterparty.

### Scenario: unanswered or declined request does not erase requester favorite

Given a member has requested a connection\
When the recipient does not respond or declines the request\
Then the requester may continue to see the member in Favorites\
And neither side receives Connected access or Partners-only marketplace records.

### Scenario: provider same-side and company-driver mutations are denied

Given a provider targets another provider or a company driver attempts to change the fleet network\
When a network mutation is submitted\
Then the service rejects it without changing a relationship, notification, or success audit.

### Scenario: My Network separates relationship meaning

Given an eligible member opens My Network\
When relationship records are displayed\
Then Connected, Requests, and Favorites are separate views\
And each row links to the member's authenticated Public Profile.

## Contract ownership

- Pages: `/app/network`, authenticated directory cards, and `/app/providers/[handle]`
- Inbound adapter: `/api/network`
- Application services: `listNetwork`, `getNetworkState`, `changeNetworkRelationship`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
