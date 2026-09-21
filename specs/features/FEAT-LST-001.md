---
id: FEAT-LST-001
title: Bounded map loading and operational list navigation
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001, FEAT-NET-001, FEAT-FLT-001, FEAT-VER-001, FEAT-REV-001, FEAT-ADM-001, FEAT-BIL-001, FEAT-GEO-001, FEAT-MAT-001, FEAT-SUP-001, FEAT-GST-001]
problem: Public map discovery must not send every capacity record to a low-end browser at once, while provider and administration lists must remain predictably bounded.
behavior: The public Truck Market preserves its existing round clusters and truck markers. Moving the map automatically loads sequential cursor pages for the filtered viewport, deduplicates records, replaces the previous window and preserves a selected truck. No summary mode, confirmation or manual load control is exposed. API responses remain bounded, but cumulative viewport detail has no silent truncation; national-scale aggregation and a total client-memory cap are deferred until they can preserve the experience. Operational lists retain bounded navigation.
contracts: [ServerListQuery, CursorResultPage, CursorPageSizePolicy, MapAppendState, BoundedMapCluster, BoundedResultPage, FilterPersistence, EmptyResultState]
observability: [list_query_result_count, requested_page, bounded_page_size, dense_ui_render_time]
rollout: Keep deterministic ordering and existing authorization; page sizes may be tuned from audit evidence without changing record visibility.
---

# Bounded lists

## Owner correction — 2026-09-21 (local repair; visual review required)

The audit introduced unapproved square markers, an intermediate Show trucks
popup and manual loading/mode switches. Those contracts are withdrawn. The repair
restores the original round clusters and automatic loading. The viewport, filters,
sequential page requests, stale-response cancellation and selected-truck retention
remain. Results are not silently truncated at 140; large-scale aggregation and
cumulative memory optimization are deferred, not claimed solved. No schema or
permission changes are required. The unused aggregate API remains compatible.

See NR-13 and `docs/MAP_PERFORMANCE_REGRESSION_2026-09-21.md`. Run focused checks,
keep the local preview open for owner review, then run full release gates only
after visual approval; deployment still requires an explicit request.

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

### Scenario: the Map automatically loads the visible area

Given a visitor opens, pans or zooms the map\
When the viewport settles\
Then the browser loads that filtered viewport in sequential bounded cursor pages automatically\
And every matching page remains reachable without a load button or summary/detail mode\
And repeated records are deduplicated without silently dropping trucks beyond 140\
And a new viewport cancels the prior chain and stale responses cannot overwrite current results\
And one selected truck survives replacement of the surrounding window\
And previous markers remain while the first page loads, with visible loading and retry on failure\
And a repeated or missing continuation cursor stops with an error instead of an endless loop.

### Scenario: the existing map interaction is preserved

Given trucks appear on desktop or phone\
When a visitor explores with normal map controls or selects a round cluster\
Then clusters retain green Empty and yellow Partial styling\
And one activation zooms inward with no confirmation popup\
And detailed truck markers appear through automatic loading\
And at maximum zoom co-located trucks remain individually selectable\
And no summary mode or manual loading control is shown.

Cluster computation uses fixed screen cells with no chain-merging of distant
trucks. Existing detail grouping and geographic anchors remain; repair overlapping
labels without changing record eligibility. Evidence: focused map browser and
`tests/capacity-map-clustering.test.mjs`, `tests/capacity-map-loading.test.mjs`.

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

### Scenario: production map remains bounded at national scale (deferred optimization)

This is a future scale target, not a claim about the local UX restoration.
It must preserve the interaction above and cannot reintroduce manual loading.

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
And automatic continuation requests stay in that same viewport without truncating matching trucks\
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

Server aggregates remain available as an internal API capability, but the map no
longer exposes them as a separate workflow. Do not re-enable that integration
until equivalent UX, completeness and scale behavior have been demonstrated and
any proposed visual change has received owner approval.

### Scenario: viewport loading preserves the map workspace (F20)

Given viewport pages load automatically\
When a visitor opens or closes a truck summary on desktop or phone\
Then loading feedback remains contained and the canvas retains its workspace height\
And there is no extra row of loading or summary-mode controls.

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


## City location and map clarity — requested 2026-09-21

Given a seeker opens Filters without device-location permission
When they choose a catalog city/town and distance under Truck location
Then results match the truck's last reported approximate location within that distance, allowing for its published uncertainty
And this criterion is independent of shipment endpoints, service areas and regular routes
And public, shared and administrator map feeds retain the same filtering contract and their existing authorization
And invalid city references return an actionable filter error rather than broadening results
And a selected city takes precedence over device proximity; exact visitor GPS remains local
And automatic device centering does not override an explicitly selected city.

Given the public or shared capacity map is open on desktop or phone
Then location markers and approximate-location boundaries are blue, regular service is muted orange, and capacity remains green/yellow
And the compact map key starts collapsed and opens within the viewport
And location success/error feedback sits beside the location controls rather than across the map
And signal-detail overlays do not capture map drag, touch or wheel gestures except their explicit close control
And map zoom/pan remains usable while details are visible; opening details does not itself move the map.

Plan: extend the existing catalog resolver and uncertainty-aware proximity query, without a schema change. Add focused filter and desktop/phone interaction regressions; retain the running local preview for owner visual review before full gates. Rollback restores the prior UI/query adapter; no stored records change.

### Owner-requested capacity filter drawer — 2026-09-21

Given Open capacity or an authorized Private capacity map
When a visitor opens Filters
Then a left sliding drawer contains search, truck location, route endpoints,
availability and truck configuration, with one More filters button for detailed
range/direction, signal geometry, load, stops and freshness options in a modal.
And both surfaces use the same filter contract and their existing scoped endpoint.

Given the drawer is open or closed
When it is closed/reopened, swiped from its handle, or dismissed with Escape
Then draft filter values remain intact, hidden controls cannot receive focus,
and exposed map space remains pannable/zoomable without a blocking backdrop.
Desktop starts with the drawer open; phone starts collapsed with a visible Filters
handle. Closing restores focus to that handle. Reduced motion suppresses sliding.
The detailed dialog traps focus natively and returns to its initiating button.

Given the visitor applies either the main or detailed filters
Then all draft criteria submit together exactly once, with structured place IDs
and the existing privacy-safe location behavior; Clear resets the whole filter.
Closing the drawer never reloads/remounts the map or requests manual data loading.
Private session verification, logout and permission boundaries remain unchanged.

Plan: rearrange the shared feed's existing controls under one form, implement a
non-modal drawer and the existing native detailed dialog, then verify focused
phone/desktop interactions and real private-session access. Keep the local server
running for owner visual approval before extensive release gates. No migration;
rollback restores the preceding presentation without altering data or privileges.
