# Demo local-road catalog provenance

`demo-road-catalog.json` contains reviewed, fixed geometry for synthetic GPS/phone
protocol tests. It has seven mapped local-road legs, two explicitly stationary
Radius scenarios, and one unavailable course. These local courses do not claim
to trace the intercity corridors advertised by Capacity records. In particular,
the personal phone course near Addis is not its Sebeta–Alem Gena market journey.
Runtime must preserve the `PROTOCOL_LOCAL` purpose and fail closed for an
unavailable or incompatible course; no rectangle, random point or implicit
stationary fallback is permitted.

## Source and data licence

The OSM-derived data is available under the
[Open Data Commons Open Database Licence 1.0](https://opendatacommons.org/licenses/odbl/1-0/),
with attribution **© OpenStreetMap contributors**. Retain that attribution and
licence notice when distributing the data. See
[OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright).

The public, metadata-stripped
[Geofabrik Ethiopia extract](https://download.geofabrik.de/africa/ethiopia.html)
was downloaded once for offline authoring:

| Receipt | Value |
| --- | --- |
| Exact extract | `https://download.geofabrik.de/africa/ethiopia-261112.osm.pbf` |
| OSM data timestamp | `2026-11-12T21:23:05Z` |
| Extract bytes | 140,417,001 |
| Published MD5 sidecar | `612ba60fd2cfcba55286c1131472162d` |
| Calculated SHA256 | `11f6475a36bae9c28d7eb8e5528086a4f287f600054abeb79b897941a5980a61` |
| Catalog version | `2026-11-12.1` |
| Coordinates | GeoJSON order: longitude, latitude |
| Geometry digest | SHA256 of UTF-8 `JSON.stringify(coordinates)` |

The raw country extract and authoring tools remain in the ignored task directory;
the runtime needs only the small checked-in catalog. It must not download a map,
call a public routing service or select new roads during a simulation tick.

## Qualification and limits

Each road is an ordered, consecutive node sequence from one actual OSM way.
The catalog retains its way ID/version, node IDs, exact coordinates, tags and
geometry digest. No road sections were joined and no new geometry vertices were
invented. All selected points lie within ±0.035 degrees of the existing exact
fictional target anchor, inside the older ingestion bounds.

The authoring filter permits primary, secondary, tertiary, unclassified and
residential roads. It excludes motorway/trunk/link defaults, roundabouts/circular
junctions, affirmative/reverse/conditional one-way restrictions, construction,
restricted/private/destination/conditional motor access and mapped vehicle size
or weight restrictions. Candidate source nodes were checked separately for
barriers, fords and access/conditional/size restrictions. Explicit unpaved
surfaces were rejected; missing surface tags remain `UNKNOWN` rather than being
called paved. Empty one-way tags follow the normal bidirectional model for the
retained road classes; they do not establish present-day road conditions.

`MAPPED_OSM_SOURCE_VERIFIED` means the geometry and retained tags match this
extract. It is not heavy-truck routing certification, road-condition verification,
turnaround permission or a physical tracker test. The fixed out-and-back playback
and endpoint dwell are synthetic protocol scenarios. Normal account protections,
source consent, privacy and actual runtime tests remain separate requirements.

## Selected courses and privacy observations

Road playback uses a predefined 20 km/h travel speed, a 60-second endpoint dwell
and reversal along the same mapped nodes. Stationary courses use zero speed.
The runtime must report the actual playback phase/speed; it must not report
travel speed while dwelling.

The sampled cell counts below use the application's existing `obscureCoordinate`
at original vertices and intervals no greater than ten metres along source
segments. They are observed lower bounds, not a promise that every tick moves a
marker. Privacy radius remains unchanged; a new source timestamp can be correct
while a public marker stays in the same area cell.

| Target | Mode / OSM way | Leg metres | Surface | Sampled cells at 1 / 3 / 5 / 10 / 20 km |
| --- | --- | ---: | --- | --- |
| company-truck | Stationary Radius | 0 | Not applicable | 1 / 1 / 1 / 1 / 1 |
| personal-truck | Road 24891246 | 645.290 | Asphalt | 3 / 1 / 1 / 1 / 1 |
| fleet-01 | Road 156003740 | 871.474 | Unknown | 3 / 1 / 1 / 1 / 1 |
| fleet-02 | Road 557521428 | 1,301.364 | Unknown | 4 / 2 / 2 / 1 / 2 |
| fleet-03 | Stationary Radius | 0 | Not applicable | 1 / 1 / 1 / 1 / 1 |
| fleet-04 | Road 564500306 | 955.714 | Unknown | 4 / 2 / 2 / 2 / 1 |
| fleet-05 | Road 60542344 | 1,053.153 | Unknown | 4 / 2 / 1 / 1 / 1 |
| fleet-06 | Road 239286659 | 1,290.618 | Asphalt | 3 / 2 / 2 / 1 / 1 |
| fleet-07 | Road 219956051 | 7,254.278 | Unknown | 19 / 8 / 5 / 4 / 2 |
| fleet-08 | Unavailable; no qualified course | — | Unknown | Not applicable |

## Authoring evidence

Task-local pyosmium 4.3.2 and all five dependencies were installed only after
their six downloaded wheel hashes matched official PyPI release metadata. A
one-thread, low-priority, three-minute-bounded two-pass extraction scanned
27,819,964 country nodes and 3,215,236 ways, retaining only 515,359 local nodes.
It completed in 87.552 seconds with maximum RSS 197,320 KiB.

An independent ID-filtered PBF reparse verified 36 source ways and 1,032 nodes
for all 40 retained authoring candidates: exact node order, coordinates, way
version and source-node restriction checks passed. That reparse completed in
4.925 seconds with maximum RSS 262,232 KiB. Selection then retained the seven
runtime roads above; the two Radius scenarios remain stationary by policy and
the unsupported fleet-08 route remains unavailable. No criteria were loosened
to fill a missing target.

The shared `validateDemoMotionCatalog` runtime accepted the exact catalog and
rejected 16 separately copied mutations: source/geometry/way/node changes,
recomputed geometry digests, false paving, target/source substitution, moved
stationary anchors, unavailable-to-stationary fallback, one-way metadata,
coordinate-axis reversal, unreviewed versions/targets/speed and false market
journey purpose. All 17 assertions passed. The canonical JSON digest is
`6b64282a8fd1dc465c10eb7c548477d9a56c7ed878965ac53bc1ea453b197159`;
the formatted file-byte digest is
`859fd0264c21586675e983b884717dc8e4900f150ba7ec7cac06b7a82cc32158`.

Source/catalog verification is preparation evidence. Actual motion playback,
ingestion, database, web/native display and hosted-service acceptance must be
recorded separately.
