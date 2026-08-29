---
id: FEAT-LST-001
title: Bounded map loading and operational list navigation
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-NET-001, FEAT-FLT-001, FEAT-VER-001, FEAT-REV-001, FEAT-ADM-001, FEAT-BIL-001, FEAT-GEO-001, FEAT-MAT-001]
problem: Public map discovery must not send every capacity record to a low-end browser at once, while provider and administration lists must remain predictably bounded.
behavior: The public Truck Market has no ranked List mode. Its Map starts with a deterministic bounded cursor page, appends another page only after an explicit visitor action, deduplicates records, and uses bounded linear-time clustering. Filters reset the cursor chain. Production scale requires viewport-scoped PostGIS queries so a low-end browser never accumulates the national fleet. Provider and administrative lists retain bounded server navigation.
contracts: [ServerListQuery, CursorResultPage, CursorPageSizePolicy, MapAppendState, BoundedMapCluster, BoundedResultPage, FilterPersistence, EmptyResultState]
observability: [list_query_result_count, requested_page, bounded_page_size, dense_ui_render_time]
rollout: Keep deterministic ordering and existing authorization; page sizes may be tuned from audit evidence without changing record visibility.
---

# Bounded lists

### Scenario: public discovery opens with useful results

Given any visitor opens the homepage Truck Market\
When no search or filter has been entered\
Then the server returns the first bounded cursor page in deterministic useful order\
And discovery does not require an artificial search before showing records\
And the browser does not receive every matching record.

### Scenario: the Map progressively loads bounded results

Given the visitor is using the Map and more public capacity exists after the current cursor\
When the visitor activates the next result batch\
Then one bounded cursor page is appended without duplicating a capacity identity\
And only one request is active for that cursor\
And map rendering, intersection observation, background refresh, and ordinary panning do not drain the remaining cursor chain\
And loading, retry, end-of-results, and no-results states remain visible\
And no ranked or paginated public truck list is rendered.

### Scenario: map clustering stays bounded

Given loaded public capacity contains many trucks across cities, towns, and regions\
When the Map renders or changes zoom\
Then Empty and Partial markers are grouped separately in fixed screen cells\
And one cluster contains no more than eight trucks\
And distant cells cannot merge through a chain of intermediate markers\
And cluster calculation examines each loaded marker a bounded number of times\
And zooming in progressively separates city, town, and neighborhood activity.

### Scenario: filters and cursors remain server owned

Given a growing list has search, view, or filter inputs\
When the user applies those inputs or changes page\
Then matching and cursor selection are evaluated in the server application boundary\
And ordinary text, state, geometry, locality, date, and publication filters are applied by the database before the result limit\
And coordinate predicates narrow authorized candidates before cursor pagination\
And submitting a new filter starts a new cursor chain\
And returning from a capacity or provider detail restores loaded Map items, filters, selected truck, and map position when browser history permits.

### Scenario: operational lists remain bounded

Given provider Shipments, Fleet, verification or payment history, review disputes, email deliveries, or an Operations record group contains more than its page size\
When the page is rendered\
Then only one bounded result page is rendered for that list\
And the total and current page are visible\
And every matching record remains reachable.

### Scenario: database access supports growing public capacity

Given public truck capacity grows beyond the development fixture\
When a normal public cursor page is requested\
Then the application does not materialize every authorized record before slicing one page\
And indexed latest-state, geometry, locality, ownership, and publication predicates reduce the query\
And the opaque cursor cannot be edited to reveal hidden or prior-filter records.

### Scenario: production map remains bounded at national scale

Given the public market contains thousands of current trucks\
When a visitor opens or pans the Map on a low-end phone\
Then the production data adapter queries only a bounded geographic viewport plus a small buffer\
And PostGIS indexes or precomputed map geometry narrow the candidate set before projection\
And server-side or tile-based clusters summarize dense areas without transferring every truck\
And selecting one truck loads its detailed capacity signals separately\
And a disposable supply-only scale audit records API latency, response bytes, browser nodes, heap, and long tasks without writing fixture users into production.

### Scenario: detail projections avoid marketplace-wide scans

Given one provider, truck, shipment, or capacity detail is requested\
When related records are assembled\
Then queries are scoped by the requested owner or record before loading rows\
And repeated per-row verification or evidence lookups are replaced with bounded aggregate projections where practical\
And private columns are selected only for an authorized detail workflow.

## Contract ownership

- Pages: public Truck Map; provider Shipments, Fleet, account history, verification, and admin queues/inventory
- Application services: managed capacity, Tracking, workspace, and platform-administration ports under `src/lib/`
- Tests: managed capacity/Tracking contract tests, guarded live PostgreSQL verifiers, E2E, and UI audit
