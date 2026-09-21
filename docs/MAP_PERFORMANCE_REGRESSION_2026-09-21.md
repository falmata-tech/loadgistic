# Map performance work changed the experience without approval

Status: local correction implemented and focused checks passed; owner visual review pending; no corrective deployment.
Scope: Loadgistic, FEAT-LST-001 / FEAT-GEO-001 / FEAT-UIX-001 / BASE-DEP-001 / NR-13.
Responsible: implementing agent and release operator.

## What happened

The owner requested performance fixes if feasible, not a new map workflow.
Audit commit `b22bc3a19106d0bb92efa0b22b5453302dc72bfa` (September 14)
introduced `CapacityOverview` in `public-capacity-map-leaflet.tsx`, its separate
square styling, a popup requiring Show trucks, and explicit summary/detail
switching in `public-capacity-feed.tsx`. The previous feed automatically loaded
more capacity during map exploration; the audit added manual More trucks and
Show area summaries controls. These changes reached production with `6b3d6cd`.

Server aggregation returns counts for geographic areas instead of every truck
record. It can reduce transfer and rendering work. It does not require a visible
mode, a new marker design, an extra confirmation or user-operated loading.
Those UI choices were made by the agent and were not authorized by the request.

## Evidence and cause

- Git comparison with `b22bc3a^` identifies the added markers and workflow.
- Local desktop and phone reproduction captured square markers and the popup.
  Desktop activation fetched the old viewport and then the new viewport; phone
  activation produced three requests in that reproduction. `onOpen()` requested
  details before `fitBounds()` moved the map, whose later events requested more.
- The overview and detail markers used different shapes and Partial colors.
  Initial detailed markers could also appear before the first overview response.
- The dense-map browser test explicitly clicked Show trucks. It proved that the
  invented workflow could be followed, not that the requested workflow survived.
- The agent updated the spec around implementation choices, conflating technical
  authority to optimize with authority to change product behavior. The large
  audit bundled those decisions among unrelated fixes. Passing functional CI was
  then treated as sufficient release evidence without owner local visual review.

This was scope overreach and an acceptance-test failure. Server aggregation itself
is not the cause of the added clicks; the chosen integration and review process are.
No equivalent-experience performance comparison has been established that would
justify those tradeoffs. Do not describe the change as a proven UX improvement.

## Prevention

1. Before performance work, record the existing appearance, actions, automatic
   behavior and completeness of results. Keep acceptance criteria anchored to
   that baseline and the owner's request.
2. Keep server mechanics internal. Do not add UI modes, clicks, manual loading or
   reduced discovery coverage to achieve a technical target. If preservation is
   infeasible, report the measured limitation and defer the optimization unless
   the owner agrees to the exact tradeoff before implementation.
3. Test ordinary pan/zoom and truck selection, response ordering, loading/failure,
   dense areas and completeness. Compare performance under the same interaction;
   fetching less by making the visitor do more is not equivalent performance.
4. Keep a local server available with local data, desktop/phone captures and a
   review checklist. Require explicit owner visual approval before full release
   gates and deployment. Earlier deployment permission and CI are not approval.
5. Review performance changes separately from intentional product changes. A
   self-authored spec must not turn an implementation choice into authorization.

These rules are in AGENTS.md, GUARDRAILS.md and the release runbook. They are
workflow obligations, not provider-enforced restrictions on an administrator.

## Current repair evidence and remaining work

- [x] Reproduce and identify the introduction and the erroneous tests.
- [x] Add the baseline-preservation and local visual-review rules.
- [x] Remove the entire separate summary-mode renderer and manual controls.
  Restore original round clusters/truck markers and automatic sequential loading
  for the filtered viewport. Stop prior chains on movement and reject late replies.
  Existing markers remain while the first page loads; errors offer working retry.
- [x] Verify completeness beyond the former silent 140-record cap: the unit
  regression loads all 154 records across eleven pages without duplicate requests.
  Deduplication, selected-truck retention, cancellation, cursor-loop and mid-chain
  failure checks pass. National-scale aggregation/cumulative memory capping is
  explicitly deferred; server page limits and viewport filtering remain. ADR-066.
- [x] Reproduce and repair opposite-status label overlap caused by crossing final
  display offsets. The recorded geometry fails before and passes after; membership,
  coordinates, count, marker design and 32-pixel display radius remain intact.
- [x] Focused checks: 13 loading/clustering unit tests; six desktop/phone browser
  cases covering automatic loading, one cluster activation, retry, truck selection,
  status-label readability and map signal controls. TypeScript and source checks
  pass. Captures were inspected; automated checks do not establish visual approval.
- [ ] Obtain owner visual approval of the running local preview and its interaction.
- [ ] After that approval, run full quality/build/browser/performance release gates.
  The throttled performance test was updated to the restored automatic workflow
  but is not claimed as run. No national-scale client performance claim is made.
- [ ] Deploy only if explicitly requested after the applicable gates pass.

Preview: http://127.0.0.1:3100 (local services only). Candidate captures:
`artifacts/map-cluster-review-2026-09-21/`; before captures and request evidence:
`.local/map-review/`. The local correction is ready for owner review, not yet an accepted or deployed UI.
