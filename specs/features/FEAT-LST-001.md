---
id: FEAT-LST-001
title: Bounded server list navigation
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-NET-001, FEAT-FLT-001, FEAT-VER-001, FEAT-REV-001, FEAT-ADM-001, FEAT-BIL-001, FEAT-GEO-001, FEAT-MAT-001]
problem: Marketplace, workspace, fleet, and administration lists become slow and difficult to scan when every matching record is rendered at once.
behavior: Discovery pages show a useful first server-owned page without requiring a search, filters narrow results on the server and reset paging, and every growing operational list exposes bounded next and previous navigation that preserves its active view and filters.
contracts: [ServerListQuery, BoundedResultPage, PageSizePolicy, FilterPersistence, EmptyResultState]
observability: [list_query_result_count, requested_page, bounded_page_size, dense_ui_render_time]
rollout: Keep deterministic ordering and existing authorization; page sizes may be tuned from audit evidence without changing record visibility.
---

# Bounded lists

### Scenario: discovery pages open with useful results

Given an authenticated member opens the Directory, Load Board, or Capacity Board\
When no search or filter has been entered\
Then the server returns the first bounded page in deterministic useful order\
And discovery does not require an artificial search before showing records\
And the browser does not receive every matching record.

### Scenario: filters and paging remain server owned

Given a growing list has search, view, or filter inputs\
When the user applies those inputs or changes page\
Then matching and paging are evaluated in the server application boundary\
And ordinary text, state, scope, locality, date, and visibility filters are applied by the database before `LIMIT` and `OFFSET`\
And coordinate predicates narrow authorized candidates before ranking and pagination\
And submitting a new filter starts at page one\
And Previous or Next preserves the active filters and view.

### Scenario: operational lists remain bounded

Given My Loads, Tracking, Network, Fleet, verification or payment history, Rating Reviews, or an Operations record group contains more than its page size\
When the page is rendered\
Then only one bounded result page is rendered for that list\
And the total and current page are visible\
And every matching record remains reachable.

### Scenario: selection controls wait for intent

Given a form must select one Business from a potentially large directory\
When no meaningful search term has been entered\
Then the control does not preload a large option list\
And bounded server matches appear after user input\
And favorites may rank ahead of other matches.

### Scenario: directory uses scan-friendly cards

Given a member browses the Directory\
When a bounded page is rendered\
Then desktop presents a restrained multi-column card grid in left-to-right, top-to-bottom reading order\
And mobile presents one card per row\
And filtering is optional rather than required.

### Scenario: database access supports growing Boards

Given marketplace loads or truck capacity grows beyond the development fixture\
When a normal unranked Board page is requested\
Then the application does not materialize every authorized record before slicing one page\
And indexed status, expiry, movement-scope, locality, ownership, and relationship predicates reduce the query\
And the result includes an accurate bounded total for navigation.

### Scenario: detail projections avoid marketplace-wide scans

Given one profile, load, truck, or capacity detail is requested\
When related records are assembled\
Then queries are scoped by the requested owner or record before loading rows\
And repeated per-row verification or evidence lookups are replaced with bounded aggregate projections where practical\
And private columns are selected only for an authorized detail workflow.

## Contract ownership

- Pages: member Boards, Directory, My Loads/Tracking, Network, Fleet, account history, verification, and admin queues/inventory
- Application services: bounded result helpers and list projections in `src/lib/repository.js`
- Tests: repository, stress-data, E2E, and dense UI audit
