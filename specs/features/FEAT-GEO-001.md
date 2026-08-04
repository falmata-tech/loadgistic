---
id: FEAT-GEO-001
title: Local service areas and mixed freight geography
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-PLC-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-LST-001, FEAT-MAT-001]
problem: City-radius freight is forced into intercity route fields even when a Business or truck serves only one locality, producing misleading map lines and weak discovery.
behavior: Loads, truck capacity, and authenticated profiles distinguish Local service areas from Long-distance routes; Local truck discovery may compare a Business's browser-only position with Driver-chosen privacy circles, while exact optional load pins remain private to authorized shipment parties.
contracts: [MovementScope, ServiceArea, LocalLoadLocation, LocalCapacityArea, LocalNearMeSearch, TruckPrivacyCircle, CoverageProjection, CoverageComparison, GeographicMatch, PrivateLoadPoint]
observability: [service_area_update_audit, movement_scope_filter, geographic_match_kind, bounded_geography_query]
rollout: Additive columns default existing records to the internal intercity scope, existing profile routes remain authoritative, member-entered operating-region text is not silently converted, and local controls can be hidden without deleting stored geography.
---

# Local and intercity freight geography

### Scenario: member declares a local service area

Given a Business, fleet transporter, or self-managed driver edits its Public Profile\
When it selects a reviewed Ethiopian city or town and a radius from 5 through 100 kilometers\
Then a structured Local Service Area is stored for that profile\
And its center is a catalog settlement coordinate rather than a facility or live-device location\
And multiple cities are represented as separate service areas rather than one invented corridor.

### Scenario: local profile coverage uses circles

Given an authenticated member opens a profile with Local Service Areas\
When the Coverage map renders\
Then each area is shown as a translucent city-centered radius circle\
And the city or town label remains visible\
And no route line, facility pin, or current vehicle position is invented.

### Scenario: mixed profile coverage comparison remains explainable

Given a member compares its coverage with another profile\
When either side has Local Service Areas, declared routes, or fresh truck geography\
Then viewed-profile coverage uses the existing solid blue ownership treatment\
And viewer-owned coverage uses the existing high-contrast warm-brown dashed ownership treatment above it\
And local-to-local overlap, route-to-route endpoint alignment, and route-to-local endpoint alignment are labeled separately\
And no overlap percentage, service guarantee, or trust score is produced.

### Scenario: Business posts a local load

Given an authenticated Business creates a freight load\
When it chooses Local movement\
Then one reviewed city or town is required\
And pickup and drop-off labels are optional before agreement\
And optional map points may be recorded for later execution\
And origin and destination route cities are not required.

### Scenario: local load points remain private

Given a Local load includes pickup or drop-off coordinates\
When a marketplace, pooled-load, directory, profile, or administrative summary projection is returned\
Then exact coordinates are absent\
And only the locality and member-entered safe area labels may be displayed\
And the load owner may review the exact points it entered\
And other authorized shipment parties may read the exact points only after agreement.

### Scenario: local load pin may use the owner's current position

Given a Business is creating a Local load and has selected Pickup or Drop-off\
When it grants browser location and chooses Use my location\
Then the current coordinate is placed into that optional private shipment point\
And the Business may move or clear the pin before submission\
And no exact load point appears in Board discovery or becomes transporter-visible before agreement.

### Scenario: Near me compares uncertainty areas rather than exact trucks

Given a Business has requested Local truck results relative to its device\
When a truck has a Driver-published displaced point and privacy radius\
Then filtering tests whether the search area and truck privacy area overlap\
And ordering and cards use a bounded possible-distance range\
And the map renders the Business's browser-held position separately from the truck's privacy circle\
And no exact truck coordinate is inferred or claimed.

### Scenario: local truck publishes simple availability

Given an authorized driver or fleet owner publishes capacity for one truck\
When Local or Both service scope is chosen\
Then a reviewed current city or town and a radius from 5 through 100 kilometers are required\
And the fresh capacity may be published without current or planned intercity routes\
And Local-only capacity must be Empty with 100 percent available\
And Both may use Partial only with the required live current intercity route\
And normal duty, accepted-load, stop, visibility, proof, and expiry rules still apply.

### Scenario: local capacity does not claim device location

Given a driver publishes Local capacity from a selected locality\
When no device location is submitted\
Then the settlement center and service radius describe declared operating coverage\
And they are not labeled as a current GPS position\
And location freshness refers to the capacity declaration time.

### Scenario: Local and Long-distance route Board filters

Given an authenticated member opens the Shipment Board or Truck Board\
When it selects All, Local, or Long-distance routes\
Then only authorized records in that movement scope are considered\
And Local results may be narrowed by a bounded searchable locality\
And Long-distance route results retain separate origin and destination filters\
And all other compatible Board filters remain available.

### Scenario: geographic matches state their evidence

Given a Local load or capacity is compared with recorded coverage\
When structured coordinates are available\
Then point-in-radius or circle-overlap rules may produce an exact geographic alignment label\
And a locality-only record may produce only a locality alignment label\
And free-text landmarks never become verified geographic matches.

### Scenario: legacy records remain intercity

Given a load or capacity existed before mixed freight geography\
When the additive migration runs\
Then its movement scope becomes Long-distance routes\
And its existing route endpoints and matching behavior remain unchanged\
And no operating-region text is assigned an arbitrary radius.

## Contract ownership

- Domain rules: movement scope, radius validation, distance, overlap, and geographic match helpers in `src/lib/domain.js`
- Persistence: service-area and additive load/capacity geography in `src/lib/db.js` and the cloud migration
- Application services: profile, load, capacity, and comparison projections in `src/lib/repository.js`
- Frontend: load and capacity composers, Boards, and Coverage map
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
