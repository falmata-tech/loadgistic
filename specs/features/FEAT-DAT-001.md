---
id: FEAT-DAT-001
title: Supply-first local development dataset
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-VER-001, FEAT-BIL-001, FEAT-ADM-001, FEAT-REV-001]
problem: Public capacity discovery needs enough realistic provider and truck variation to test cursor loading, clustering, provider pages, and responsive layouts without retaining obsolete demand fixtures.
behavior: Every explicitly reset non-Production Supabase project receives a deterministic supply-only market centered on city and town freight: courier motorcycles, courier cars, cargo vans, conventional pickups, stake-body pickups, and all mini-truck configurations form about 70 percent of active capacity, light-duty trucks are the next-largest group, and only occasional medium or heavy trucks carry longer road routes. The 70-percent local-delivery cohort stays within 30 kilometres of its base through road-connected town routes or compact multi-place operating polygons. Each provider retains one regular Service area or Capacity route; the managed fixture contains no legacy demand, future-trip, Business-account, or relationship records and is imported without SQLite.
contracts: [DevelopmentDatabaseSeed, PublicCapacityCohort, LegacyDemandPurge, RetiredDemandBoundary]
observability: [database_reset_summary, public_capacity_cursor_count, seed_integrity_failure, retired_demand_request]
rollout: The dataset is deterministic and local-only; production execution of reset or fixture commands remains denied. Rollback restores a pre-migration database backup, not retired demand fixtures.
---

# Supply-first local development dataset

### Scenario: normal reset creates a busy capacity market

Given the process targets the isolated local Supabase project and is not running in Production\
When its managed fixture is reset\
Then it contains 30 published provider pages across nine fleet companies and 21 self-managed provider profiles\
And it contains 143 active current-capacity signals with Empty, Partial, Service-area, and Capacity-route variation\
And 100 of those 143 trucks are courier motorcycles, courier cars, cargo vans, conventional pickups, stake-body pickups, or mini trucks, with every local-delivery configuration represented\
And the remaining cohort contains 28 light-duty trucks, 13 medium trucks, and two heavy trucks\
And medium and heavy trucks remain occasional rather than visually dominating the Market\
And independent Owner-operator and Self-managed driver provider records outnumber fleet-transporter provider records\
And every current truck resolves to one visible Company driver, Owner-operator, or Self-managed driver identity with deterministic public callback and document-category status\
And each provider has one regular-service signal while no provider has more than one\
And regular Service areas and regular Capacity routes are both represented\
And each regular signal is related to the provider's approximate current truck location\
And every seeded regional base has at least nine current trucks, including multiple local-delivery vehicles and both Empty and Partial capacity\
And Empty includes both Service-area and Capacity-route examples while Partial appears only on a Capacity route\
And every current Capacity route has ordered labels and coordinate pairs\
And the reset summary contains counts but no credentials, access codes, private messages, or file contents.

### Scenario: local-delivery vehicles stay within 30 kilometres

Given the deterministic capacity cohort contains a courier motorcycle, courier car, cargo van, pickup, or mini truck\
When its current or regular capacity geography is generated\
Then a Service area is centered on the truck's city or town and uses no more than a 30 kilometre working range\
And every named boundary city, town, village, or urban edge remains within 30 kilometres of that center, allowing only a small coordinate tolerance\
And a Capacity route begins in, ends in, or passes immediately beside that truck's approximate current city\
And the route uses a concise sequence of road-connected nearby cities or towns rather than crossing unrelated regions\
And the total straight-line distance across its ordered legs does not exceed 30 kilometres.

### Scenario: light-duty trucks serve the wider local network

Given the deterministic capacity cohort contains a light-duty truck\
When its current or regular capacity geography is generated\
Then a Service area may use a 20, 50, 70, or 100 kilometre working range\
And a Capacity route remains a concise road-connected local sequence whose ordered legs total no more than 100 kilometres and contain no leg longer than 80 kilometres.

### Scenario: occasional larger trucks demonstrate regional corridors

Given the deterministic cohort contains a medium or heavy truck\
When route-based capacity is generated\
Then the route may use a longer multi-city Ethiopian freight corridor\
And every city follows a plausible road sequence that begins in, ends in, or passes immediately beside the truck's approximate current city\
And intermediate cities clarify the road path without manufacturing unnecessary stops.

### Scenario: public cursors reach every signal once

Given the deterministic capacity cohort\
When anonymous discovery follows cursor pages to the end\
Then all 143 latest Empty or Partial capacity signals are returned exactly once\
And fleet and owner-operator profiles, current Service areas, current Capacity routes, and both regular-service geometries are represented\
And older fixture signals retain explicit age metadata while Off Duty and unpublished signals remain excluded.

### Scenario: demand fixtures are removed

Given the managed fixture source is prepared for local development or browser tests\
When the importer reads its deterministic records\
Then it contains no shipment-demand rows, Business organizations or users, network relationships, favorites, or Business reviews\
And it creates provider organizations, provider profiles, fleet records, verification evidence, and the supply-only public market directly in Supabase\
And neither the importer nor its source opens, creates, transforms, or references a SQLite database.

### Scenario: the current Daily Featured programme is generated at import time

Given a managed fixture reset on any Ethiopia calendar date\
When the importer builds Daily Featured Transporters and Sponsors\
Then it derives the current regional group from that date\
And it selects the eligible fixture providers based in that group in stable display-name order\
And it creates one published day, ordered featured slots, transporter Sponsor records, one outside advertiser, and current-date placements\
And no previously captured calendar date is required in the fixture source.

### Scenario: retired demand routes never reach persistence

Given a browser or old client requests a retired Shipment Board, pooled-load, along-route, Business shipment, proof, interest, assignment, or demand-tracking address\
When the request reaches the current application\
Then a page address redirects to the public Truck Market or provider-owned Tracking workspace as appropriate\
And a retired mutation or file API returns HTTP 410 with a bounded response\
And the request does not authenticate, open SQLite, query Supabase, read a private object, or mutate any record.

### Scenario: public projection remains safe

Given the busy seed contains provider contacts and obscured truck locations\
When an anonymous visitor browses capacity or opens a provider page\
Then only provider-selected contact channels are returned\
And party email, access-code digest, password, proof file, and exact visitor location data are absent\
And provider location points remain the provider-selected privacy representation.

### Scenario: production reset is rejected

Given `NODE_ENV` is Production\
When a reset or local fixture command is requested\
Then it fails before deleting or writing data.

## Contract ownership

- Schema: ordered SQL migrations under `supabase/migrations/`
- Credential-free deterministic seed input: `resources/fixtures/managed-market.json`
- Reset/import adapter: `scripts/import-supabase-fixtures.mjs`
- Public cursor: the Supabase-only capacity port in `src/lib/capacity-market.js`
- Retired demand boundary: `src/lib/retired-demand.ts`, retired page and route modules, and `src/middleware.ts`
- Tests: `tests/supabase-fixtures.test.mjs`, the guarded live fixture verifier, and `tests/e2e/smoke.spec.ts`
