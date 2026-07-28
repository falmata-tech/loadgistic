---
id: FEAT-PLC-001
title: Local Ethiopia place catalog
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001]
problem: A small hard-coded city list excludes Ethiopian towns and cannot support distance-aware route discovery.
behavior: An offline import builds a local searchable settlement catalog from an OpenStreetMap Ethiopia settlement extract or Geofabrik PBF while operational place inputs use bounded server-side search and retain a small built-in fallback.
contracts: [PlaceCatalogImport, PlaceSearch, PlaceRecord, PlaceCoordinateLookup, AsyncPlaceCombobox]
observability: [place_import_count, place_import_timestamp, place_search_latency, place_search_result_count]
rollout: The importer is repeatable and additive; keep the built-in fallback when an extract or Osmium is unavailable and never commit the large source PBF.
---

# Ethiopia place catalog

### Scenario: import Ethiopian settlements

Given an Ethiopia OpenStreetMap Overpass settlement extract or a Geofabrik PBF with the Osmium command-line tool\
When the place import command runs\
Then city, town, village, and hamlet nodes with names and coordinates are upserted locally\
And useful metadata such as place type, alternate name, population, Wikidata ID, and OSM ID is retained when available\
And the source PBF remains an ignored local build input.

### Scenario: search a large place catalog

Given the local catalog contains many settlements\
When a signed-in user enters at least two characters in a route or general-area input\
Then the server returns a bounded relevance-ordered result set\
And the page does not render the entire catalog in HTML\
And no third-party request or API key is required.

### Scenario: catalog is not installed

Given the local imported catalog is empty\
When a user searches a place\
Then matching reviewed built-in Ethiopian cities are still suggested\
And free text remains accepted so operations are not blocked.

### Scenario: resolve route coordinates

Given a stored origin or destination matches a catalog name or alternate name\
When distance-aware discovery needs its coordinates\
Then the local catalog supplies latitude and longitude\
And no exact member or truck position is inferred from a settlement coordinate.

## Contract ownership

- Import adapter: `scripts/import-ethiopia-places.mjs`
- Search adapter: `/api/places`
- Application services: place search and coordinate lookup in `src/lib/repository.js`
- Frontend: `src/components/ethiopia-place-input.tsx`
- Tests: `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
