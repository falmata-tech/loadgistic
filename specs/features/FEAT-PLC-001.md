---
id: FEAT-PLC-001
title: Local Ethiopia place catalog
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-GEO-001]
problem: A small hard-coded city list excludes Ethiopian towns and cannot support distance-aware route discovery.
behavior: An offline import builds a local searchable settlement catalog from an OpenStreetMap Ethiopia settlement extract or Geofabrik PBF while operational place inputs use bounded server-side search, preserve parent-locality metadata, display and store country-qualified labels, and retain a small built-in fallback.
contracts: [PlaceCatalogImport, PlaceSearch, PlaceRecord, PlaceHierarchy, CountryQualifiedPlaceLabel, PlaceCoordinateLookup, AsyncPlaceCombobox]
observability: [place_import_count, place_import_timestamp, place_search_latency, place_search_result_count]
rollout: The importer is repeatable and additive; local startup idempotently qualifies legacy Ethiopian place fields, the built-in fallback remains available when an extract or Osmium is unavailable, and the large source PBF is never committed.
---

# Ethiopia place catalog

### Scenario: import Ethiopian settlements

Given an Ethiopia OpenStreetMap Overpass settlement extract or a Geofabrik PBF with the Osmium command-line tool\
When the place import command runs\
Then city, town, village, and hamlet nodes with names and coordinates are upserted locally\
And reviewed suburb, neighbourhood, and quarter records may be imported with a parent city for local-area search\
And country name and code are stored with useful metadata such as place type, alternate name, population, Wikidata ID, and OSM ID\
And the source PBF remains an ignored local build input.

### Scenario: search a large place catalog

Given the local catalog contains many settlements\
When a signed-in user enters at least two characters in a route or general-area input\
Then the server returns a bounded relevance-ordered result set\
And the page does not render the entire catalog in HTML\
And no third-party request or API key is required.

### Scenario: local search preserves locality hierarchy

Given a reviewed Addis Ababa sub-city, district, or neighbourhood exists in the catalog\
When it appears in a Local load, capacity, or service-area search\
Then its display label includes its parent city and country\
And filtering stores the catalog identity rather than relying on ambiguous spelling\
And no unbounded list of Ethiopian places is sent to the browser.

### Scenario: catalog is not installed

Given the local imported catalog is empty\
When a user searches a place\
Then matching reviewed built-in Ethiopian cities are still suggested\
And free text remains accepted so operations are not blocked.

### Scenario: places include country context

Given a city, town, village, hamlet, or region is entered or displayed\
When it is selected from the Ethiopian catalog or an older unqualified Ethiopian record is loaded\
Then its label includes `, Ethiopia`\
And `Adaba` remains route-compatible with `Adaba, Ethiopia` for legacy records\
And `Adaba, Kenya` remains a distinct place identity.

### Scenario: resolve route coordinates

Given a country-qualified stored origin or destination matches a catalog name or alternate name\
When distance-aware discovery needs its coordinates\
Then the local catalog supplies latitude and longitude\
And no exact member or truck position is inferred from a settlement coordinate.

## Contract ownership

- Import adapter: `scripts/import-ethiopia-places.mjs`
- Search adapter: `/api/places`
- Application services: place search and coordinate lookup in `src/lib/repository.js`
- Frontend: `src/components/ethiopia-place-input.tsx`
- Tests: `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
