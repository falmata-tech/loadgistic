---
id: FEAT-MKT-001
title: Frictionless public capacity marketplace
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-TRK-001, FEAT-VER-001]
problem: Manufacturers, workshops, growers, producers, and other capacity seekers need to discover legitimate road-freight options immediately without creating an account or posting demand.
behavior: The public homepage leads directly into a complete Capacity Board, nearby discovery, transport-provider Directory and microsites, and code-based Tracking. Shipment-demand posting, a public Shipment Board, and capacity-seeker signup are absent.
contracts: [PublicMarketplaceView, PublicCapacityProjection, PublicProviderProjection, PublicTrackingEntry, LocationConsentPrompt, InfiniteCapacityFeed]
observability: [public_capacity_query, public_provider_view, public_tracking_entry, location_consent_outcome, anonymous_projection_review]
rollout: Release the public capacity surface with retired-route redirects, purge fake local demand records, and require a backup plus operator approval before any destructive cloud purge.
---

# Public marketplace

### Scenario: capacity is useful before login

Given a visitor opens Loadgistic\
When the homepage renders\
Then current capacity begins within the first public journey\
And browsing cards, filters, map view, capacity details, provider Directory, provider microsites, and tracking-code entry require no account\
And the page does not ask the visitor to post demand or sign up as a Business.

### Scenario: visitor can ask for nearby results

Given the public Board is usable without location\
When the visitor selects Show capacity near me\
Then Loadgistic explains the benefit before requesting browser permission\
And permission success ranks relevant capacity using the privacy boundary in FEAT-CAP-001\
And permission denial or device failure does not block manual route and area filters.

### Scenario: infinite discovery remains controlled

Given more public signals match the active filters\
When the visitor approaches the end of the loaded cards\
Then the next cursor page loads with visible skeleton feedback\
And duplicate cards are not appended\
And a keyboard-operable fallback and final end message remain available\
And the footer remains reachable after the feed ends.

### Scenario: public navigation reflects the one-sided marketplace

Given any public page is rendered\
When navigation and calls to action appear\
Then Capacity, Transport Providers, Track, About, and Provider login or signup are available\
And Shipment Board, Post shipment, Business signup, and Business Directory actions are absent.

### Scenario: claims remain evidence safe

Given the homepage explains Loadgistic's purpose\
When it describes makers and transport providers\
Then it presents capacity reuse, partial space, future trips, recurring routes, and permanent working areas as options rather than guaranteed savings, service, income, or outcomes\
And every discovery surface reminds visitors to confirm availability, identity, authority, documents, cargo fit, price, and terms directly.

## Contract ownership

- Pages: `/`, `/capacity`, `/providers`, `/track`, `/about`
- Projection boundary: explicit public whitelists only
- Tests: repository, E2E, visual audit
