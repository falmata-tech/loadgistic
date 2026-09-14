---
id: FEAT-LST-001
title: Bounded map loading and operational list navigation
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-NET-001, FEAT-FLT-001, FEAT-VER-001, FEAT-REV-001, FEAT-ADM-001, FEAT-BIL-001, FEAT-GEO-001, FEAT-MAT-001, FEAT-SUP-001, FEAT-GST-001]
problem: Public map discovery must not send every capacity record to a low-end browser at once, while provider and administration lists must remain predictably bounded.
behavior: The public Truck Market has no ranked List mode. Its Map starts with a deterministic bounded cursor page, queries a new geographic window after map movement, replaces the previous window, and permits explicit bounded paging within that window. It deduplicates records and retains at most 140 detailed trucks, including a selected truck. Filters reset the cursor chain. Dense public viewports use stable server aggregate cells and fetch truck details only after selection. Indexed candidate narrowing and representative scale measurements remain a separately verified scale gate. Provider and administrative lists retain bounded server navigation.
contracts: [ServerListQuery, CursorResultPage, CursorPageSizePolicy, MapAppendState, BoundedMapCluster, BoundedResultPage, FilterPersistence, EmptyResultState]
observability: [list_query_result_count, requested_page, bounded_page_size, dense_ui_render_time]
rollout: Keep deterministic ordering and existing authorization; page sizes may be tuned from audit evidence without changing record visibility.
---

# Bounded lists

### Scenario: retained chat history remains bounded and reachable

Given a permitted member, guest, assigned Support agent or administrator opens a long chat\
When they navigate toward older messages\
Then each response and rendered window contains at most 50 messages\
And a conversation-scoped `(created_at, id)` cursor makes all retained messages reachable\
And new messages do not shift an earlier window\
And Latest messages restores current conversation updates\
And each page rechecks authority without exposing message-storage references.

Evidence is mapped by `FEAT-SUP-001` and `FEAT-GST-001` to
`tests/sql/support-history.sql`, `tests/support-history.test.mjs`, and
`tests/e2e/support-history.spec.ts`.

### Scenario: public discovery opens with useful results

Given any visitor opens the homepage Truck Market\
When no search or filter has been entered\
Then the server returns the first bounded cursor page in deterministic useful order\
And discovery does not require an artificial search before showing records\
And the browser does not receive every matching record.

### Scenario: the Map progressively loads bounded results

Given the visitor is using the Map and more public capacity exists after the current cursor\
When the visitor activates the next result batch\
Then one bounded cursor page in the current viewport is appended without duplicating a capacity identity\
And only one request is active for that cursor\
And map rendering, intersection observation and background refresh do not drain the remaining cursor chain\
And panning starts one new viewport request rather than consuming an unrelated cursor\
And retained detail is bounded to 140 trucks, preserving at most one selected truck\
And loading, retry, end-of-results, and no-results states remain visible\
And no ranked or paginated public truck list is rendered.

### Scenario: map clustering stays bounded

Given loaded public capacity contains many trucks across cities, towns, and regions\
When the Map renders or changes zoom\
Then Empty and Partial markers are grouped separately in fixed screen cells\
And each detail-mode cluster contains no more than eight loaded trucks\
And overview-mode cells summarize the complete filtered public set in at most 200 cells without transferring individual truck records\
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

### Scenario: public provider fleet pages cover the full active fleet

Given a published provider has more than one page of active trucks\
When a visitor navigates its public fleet\
Then the server returns at most 12 trucks with deterministic ordering and an exact
whole-fleet count\
And related capacity and vehicle/Driver evidence queries use only that page's IDs\
And fleet-wide operating-model evidence remains stable across pages\
And navigation reaches trucks beyond the former 96-capacity cap.

FEAT-PRV-001 owns the public projection and migration 088 contract. This fixes
profile fleet paging. Migration 093 adds the separately verified viewport and
aggregate contracts below; this does not certify national concurrent-user scale.

## Viewport and database filtering repair (verified locally; hosted rollout separate)

Given a visitor pans or zooms a public or authorized private map\
When the debounced viewport request finishes\
Then every active filter and the viewport intersect before the SQL page limit\
And a response from an earlier viewport cannot replace the current viewport\
And the client replaces the prior window, retaining at most one selected truck\
And explicit next-page requests stay in that same viewport with bounded retention\
And invalid or incomplete bounds return a filter error instead of a national search.

Given privately granted capacity contains a distant match after more than 1,000 newer records\
When a guest or Operations actor searches that area\
Then current grants and actor permissions are checked in PostgreSQL\
And all text, categorical, geographic and viewport criteria are applied before the cursor limit\
And the application requests one bounded database page without a scan ceiling.

Rollout: migration 093 precedes the viewport client. Roll back the client before
removing the new private RPC; preserve existing public-fleet paging. Scale claims
require SQL/browser and representative query-plan/heap evidence, including dense
server aggregation; bounded pages alone are not national-scale completion.

Given a dense public viewport contains more trucks than the detail limit\
When the map requests an overview\
Then PostgreSQL returns at most 200 status-separated aggregate cells and zero detailed trucks\
And power-of-two world-grid cell IDs remain stable during same-scale panning\
And each cell count includes only currently eligible public trucks matching all filters\
And each representative anchor lies on evidence that intersects the viewport\
And Show trucks opens bounded details for the area with explicit further paging\
And Show area summaries returns to the aggregate view.

The existing eight-member cap applies to detailed truck markers; an overview
count may exceed eight because it transfers no truck identities or contacts.

### Scenario: viewport actions preserve the map workspace (F20)

Given detailed viewport results have more trucks or can return to area summaries\
When the visitor opens or closes a truck summary on desktop or phone\
Then paging/overview actions occupy the map command panel rather than extra map rows\
And the map canvas retains the workspace height and contains the selected summary\
And command actions and status feedback remain independently readable.

Evidence: `tests/e2e/smoke.spec.ts` dense-map layout and interaction assertions.

### Scenario: a same-status neighbor cannot push labels into the other status (F21)

Given Empty and Partial groups occupy adjacent global cells with another nearby Empty group\
When the map separates close labels\
Then the opposite-status collision takes priority over same-status spacing\
And membership and geographic anchors remain unchanged\
And display offsets remain within 32 pixels and deterministic across input order.

Evidence: the three-group regression in `tests/capacity-map-clustering.test.mjs`
and the dense-map desktop/phone browser test.


### Scenario: selected truck feedback preserves readable identity and actions (F22)

Given a visitor has selected a public or authorized private truck\
When location permission fails, capacity refresh is pending, or a refresh fails\
Then the feedback stays readable within the summary without covering its identity,
contact actions or close button\
And failed refresh retains the selected truck and offers a visible working retry\
And closing the summary returns feedback to the map without duplicate live regions\
And desktop, phone and 320-by-640 layouts retain contained, reachable controls.

Evidence: `tests/e2e/map-feedback.spec.ts`, with simulated device denial and
network failure around real local public capacity; existing private shell tests
cover the shared renderer. No authorization, persistence or geographic contracts
change. Rollback restores the component/styles without database work.


### Scenario: narrow selected summaries preserve zoom controls (F24)

Given a selected truck is open at 320-by-640 phone reflow\
When the visitor changes map zoom with the visible zoom buttons\
Then the summary leaves the zoom control column unobstructed\
And its feedback, identity, contact and close actions remain inside the map.

Evidence: real button clicks and hit-target assertions in
`tests/e2e/map-feedback.spec.ts`; the zoom click failed before this repair.
