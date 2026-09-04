---
id: FEAT-DAT-001
title: Supply-first local development dataset
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-VER-001, FEAT-BIL-001, FEAT-ADM-001, FEAT-REV-001]
problem: Public capacity discovery needs enough realistic provider and truck variation to test cursor loading, clustering, provider pages, and responsive layouts without retaining obsolete demand fixtures.
behavior: Every explicitly reset non-Production Supabase project receives a deterministic supply-only market centered on city and town freight: cargo vans, conventional pickups, stake-body pickups, and especially the three mini-truck configurations form 100 of 143 active fleet-capacity records. Courier cars and motorcycles are not transport-capacity configurations. Light, medium, heavy rigid, and heavy rigid-with-trailer trucks form smaller but useful comparison cohorts, with both heavy variants represented. The 100-truck local-delivery cohort stays within 30 kilometres of its base through road-connected town routes or compact multi-place operating polygons. Each truck's approximate location and current capacity geometry remain close to the same provider regular-service geometry so one selected-truck map tells a geographically coherent story. Truck placement follows weighted Ethiopian market areas and real nearby localities rather than equal regional quotas, identical fleet patterns, repeated center coordinates, or diagonal coordinate offsets. Open capacity is larger than either configured recipient's or Loadgistic's explicitly shared demo set; a Private signal contributes nothing to anonymous discovery, while an Open signal may also have a private-network grant. Credential-free fixtures never contain personal tester emails; an explicit local-only configurator grants a bounded smaller set to operator-provided test emails and the first-class Loadgistic audience after import. Each provider retains one regular Service area or Capacity route; the managed fixture contains no legacy demand, future-trip, Business-account, or relationship records and is imported without SQLite.
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
And 100 of those 143 trucks are cargo vans, conventional pickups, stake-body pickups, or mini trucks, with the three mini-truck configurations forming the largest share\
And neither courier cars nor motorcycles appear in the vehicle catalogue or managed fixture\
And the remaining cohort contains 18 light-duty trucks, 11 medium trucks, seven heavy rigid trucks, and seven heavy rigid trucks with trailers\
And light, medium, and both heavy variants provide useful examples without visually dominating the Market\
And independent Owner-operator and Self-managed driver provider records outnumber fleet-transporter provider records\
And every current truck resolves to one visible Company driver, Owner-operator, or Self-managed driver identity with deterministic public callback and document-category status\
And each provider has one regular-service signal while no provider has more than one\
And regular Service areas and regular Capacity routes are both represented\
And every truck's approximate location lies on or close to its provider's regular-service geometry\
And every current Capacity route or Service area lies in the same operating market as that regular-service geometry\
And the primary single-truck Driver demo keeps its approximate point, current Capacity route, and regular Service area inside one compact local market\
And larger freight markets contain more activity than smaller local markets without leaving the represented regional markets empty\
And trucks within one market are distributed among real nearby cities, towns, and localities rather than sharing one synthetic center\
And each multi-truck fleet uses believable nearby operating points along one shared regional or local service pattern instead of scattering one fleet across unrelated regions\
And Empty includes both Service-area and Capacity-route examples while Partial appears only on a Capacity route\
And every current Capacity route has ordered labels and coordinate pairs\
And the reset summary contains counts but no credentials, access codes, private messages, or file contents.

### Scenario: approximate demo locations form believable market activity

Given multiple demo trucks operate from the same named city, town, or locality\
When their approximate locations are projected on the map\
Then each point remains within its declared privacy radius of that named place\
And deterministic offsets vary in distance and direction rather than forming a repeated diagonal line\
And no locality receives an implausibly dominant share merely because records were generated in sequence\
And the deliberately public subset remains spread across at least twenty distinct Ethiopian locations\
And zooming into a market reveals separate nearby activity instead of one national template copied to every fleet.

### Scenario: local-delivery vehicles stay within 30 kilometres

Given the deterministic capacity cohort contains a cargo van, pickup, or mini truck\
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

### Scenario: every truck tells one coherent geographic story

Given a demonstration truck has an approximate location, one current signal, and one provider regular-service signal\
When those geometries are compared\
Then the approximate location lies on or close to the regular Capacity route or inside or close to the regular Service area\
And the current Capacity route begins on, ends on, or closely follows that same regular service\
And a current Service area overlaps or sits immediately beside the regular service\
And the truck is never positioned in a distant market unrelated to either signal.

### Scenario: public cursors reach every signal once

Given the deterministic capacity cohort\
When anonymous discovery follows cursor pages to the end\
Then every signal deliberately marked Public Market is returned exactly once while every Private-network truck is absent\
And the public subset is weighted toward Empty medium and heavy trucks on plausible over-road Capacity routes\
And enough fleet and independent profiles, current Service areas, current Capacity routes, and both regular-service geometries remain represented to exercise public discovery\
And older fixture signals retain explicit age metadata while Off Duty and unpublished signals remain excluded.

### Scenario: local private-share setup contains no tracked personal identity

Given a developer explicitly supplies one or more normalized test emails to the local fixture configurator\
When private networks are prepared after the credential-free managed fixture import\
Then a bounded subset smaller than the Open-capacity cohort receives idempotent email-audience grants for each supplied address plus a first-class Loadgistic audience grant\
And the same authorized email's Private Transport Capacity map includes all public and private current signals shared with it without duplicates\
And no personal email, OTP, access code, or reversible credential is written into the tracked fixture or command output\
And Production rejects this local test-grant operation before reading or mutating data.

### Scenario: demand fixtures are removed

Given the managed fixture source is prepared for local development or browser tests\
When the importer reads its deterministic records\
Then it contains no shipment-demand rows, Business organizations or users, network relationships, favorites, or Business reviews\
And it creates provider organizations, provider profiles, fleet records, verification evidence, and the supply-only public market directly in Supabase\
And neither the importer nor its source opens, creates, transforms, or references a SQLite database.

### Scenario: the current Daily Featured programme is generated at import time

Given a managed fixture reset on any Ethiopia calendar date\
When the importer builds Daily Featured Trucks and Sponsors\
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
