---
id: FEAT-LST-001
title: Bounded server list navigation
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-NET-001, FEAT-FLT-001, FEAT-VER-001, FEAT-REV-001, FEAT-ADM-001, FEAT-BIL-001, FEAT-GEO-001, FEAT-MAT-001]
problem: Public discovery must feel continuous without sending every capacity record to the browser, while provider and administration lists must remain predictably bounded.
behavior: The public Capacity Board uses deterministic cursor pages appended by infinite scroll with an accessible Load more fallback. Filters reset the cursor and the browser restores feed position. Provider and administrative lists retain bounded server navigation.
contracts: [ServerListQuery, CursorResultPage, CursorPageSizePolicy, InfiniteAppendState, ScrollRestorationState, BoundedResultPage, FilterPersistence, EmptyResultState]
observability: [list_query_result_count, requested_page, bounded_page_size, dense_ui_render_time]
rollout: Keep deterministic ordering and existing authorization; page sizes may be tuned from audit evidence without changing record visibility.
---

# Bounded lists

### Scenario: public discovery opens with useful results

Given any visitor opens the Capacity Board or provider Directory\
When no search or filter has been entered\
Then the server returns the first bounded cursor page in deterministic useful order\
And discovery does not require an artificial search before showing records\
And the browser does not receive every matching record.

### Scenario: infinite capacity scrolling remains bounded

Given more public capacity exists after the current cursor\
When the visitor nears the end of the loaded feed or activates Load more\
Then one next cursor page of 12 through 16 records is requested\
And new records append without duplicating an existing capacity identity\
And only one request is active for that cursor\
And loading, retry, end-of-results, and no-results states are visible\
And keyboard and assistive-technology users can reach and activate the Load more control.

### Scenario: filters and cursors remain server owned

Given a growing list has search, view, or filter inputs\
When the user applies those inputs or changes page\
Then matching and cursor selection are evaluated in the server application boundary\
And ordinary text, state, geometry, locality, date, and publication filters are applied by the database before the result limit\
And coordinate predicates narrow authorized candidates before ranking and pagination\
And submitting a new filter starts a new cursor chain\
And returning from a capacity or provider detail restores loaded items, filters, list-or-map mode, and scroll position when browser history permits.

### Scenario: operational lists remain bounded

Given provider Shipments, Fleet, verification or payment history, review disputes, email deliveries, or an Operations record group contains more than its page size\
When the page is rendered\
Then only one bounded result page is rendered for that list\
And the total and current page are visible\
And every matching record remains reachable.

### Scenario: directory uses scan-friendly cards

Given a visitor browses the provider Directory\
When a bounded page is rendered\
Then desktop presents a restrained multi-column card grid in left-to-right, top-to-bottom reading order\
And mobile presents one card per row\
And filtering is optional rather than required.

### Scenario: database access supports growing public capacity

Given public truck capacity grows beyond the development fixture\
When a normal public cursor page is requested\
Then the application does not materialize every authorized record before slicing one page\
And indexed status, expiry, geometry, locality, ownership, and publication predicates reduce the query\
And the opaque cursor cannot be edited to reveal hidden or prior-filter records.

### Scenario: detail projections avoid marketplace-wide scans

Given one provider, truck, shipment, or capacity detail is requested\
When related records are assembled\
Then queries are scoped by the requested owner or record before loading rows\
And repeated per-row verification or evidence lookups are replaced with bounded aggregate projections where practical\
And private columns are selected only for an authorized detail workflow.

## Contract ownership

- Pages: public Capacity Board and provider Directory; provider Shipments, Fleet, account history, verification, and admin queues/inventory
- Application services: bounded result helpers and list projections in `src/lib/repository.js`
- Tests: capacity-market, provider-tracking, E2E, and UI audit
