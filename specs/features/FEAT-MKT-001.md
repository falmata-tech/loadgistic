---
id: FEAT-MKT-001
title: Frictionless public capacity marketplace
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-TRK-001, FEAT-VER-001]
problem: Manufacturers, workshops, growers, producers, and other capacity seekers need to discover legitimate road-freight options immediately without creating an account or posting demand.
behavior: The public homepage is the one canonical complete Capacity Board with nearby discovery, transport-provider Directory and microsites, and code-based Tracking. Shipment-demand posting, a separate Capacity page, a public Shipment Board, and capacity-seeker signup are absent.
contracts: [PublicMarketplaceView, PublicCapacityProjection, PublicProviderProjection, PublicTrackingEntry, LocationConsentPrompt, InfiniteCapacityFeed]
observability: [public_capacity_query, public_provider_view, public_tracking_entry, location_consent_outcome, anonymous_projection_review]
rollout: Release the public capacity surface with retired-route redirects, purge fake local demand records, and require a backup plus operator approval before any destructive cloud purge.
---

# Public marketplace

### Scenario: capacity is useful before login

Given a visitor opens Loadgistic\
When the homepage renders\
Then the complete Capacity Board hero, filters, Map/List controls, and shared capacity map are the primary page content\
And List cards are an explicit secondary view\
And the primary map is bounded and initially zoomed for the current Ethiopia market rather than showing Africa or the world\
And browsing cards, filters, map view, capacity details, provider Directory, provider microsites, and tracking-code entry require no account\
And the page does not ask the visitor to post demand or sign up as a Business\
And the legacy `/capacity` URL preserves its query string while redirecting to `/` rather than rendering a duplicate market page.

### Scenario: visitor receives an immediate nearby-location request

Given the public Board is usable without location\
When the client becomes interactive\
Then Loadgistic immediately requests browser location permission\
And permission success ranks relevant capacity using the privacy boundary in FEAT-CAP-001 and centers the map around the visitor's surrounding area\
And permission denial or device failure does not block the map, List, or manual filters\
And the visitor may manually retry after enabling browser site permission.

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
Then it presents capacity reuse, partial space, current radius or corridor coverage, and regular corridors as options rather than guaranteed savings, service, income, or outcomes\
And every discovery surface reminds visitors to confirm availability, identity, authority, documents, cargo fit, price, and terms directly.

## Contract ownership

- Pages: `/` as the canonical Capacity Board; `/capacity` as a compatibility redirect; `/providers`, `/track`, `/about`
- Projection boundary: explicit public whitelists only
- Tests: repository, E2E, visual audit
