# UI and backend contract audit — 2026-09-21

Scope: Loadgistic only. Local inspection and corrections; no production writes,
push or deployment. Preserve the pending map/loading/Featured/driver work already
in this worktree. Related contracts: FEAT-ADM-001, FEAT-UIX-001, FEAT-BIL-001.

## Coverage and limits

- 44 page/role visits: seven public destinations, 17 administrator destinations,
  ten fleet-owner destinations, five self-managed Driver destinations, four
  Company-driver destinations and the Support inbox.
- Traced 151 distinct rendered POST form targets (including individual record
  IDs) to matching route handlers. This proves routing, not every mutation's
  success. Inspected the main home/Records/Account projections and their SQL.
- Successful visits had no uncaught browser errors or horizontal overflow at the
  audited desktop size. Fleet and two Network visits failed the first crawl;
  one controlled retry loaded all three successfully in roughly 2.5 seconds.
  No cause or product fix is claimed for those transient navigation failures.
- Focused phone/desktop checks cover the changed presentation and a real admin
  save with persisted state, plus the server's missing-record denial. Only an
  exact disposable test truck is created and cleaned. Existing records used by
  database regressions are changed only inside rolled-back transactions.
- This is not exhaustive proof of every permission combination, empty state,
  production email/OAuth/payment boundary, or external outage behavior. Full
  release gates remain after owner visual review. Existing Supabase/PostGIS
  operations follow-up is separate and is not closed by this audit.

## Findings and corrections

| ID | Observed mismatch | Correction and evidence |
|---|---|---|
| UIA-01 | Provider Home counted cancelled Tracking as active because the query excluded only COMPLETED. | Migration 100 excludes both terminal states. SQL regression failed before the change and passes after it; cancellation never increments completed counts. |
| UIA-02 | Recent Tracking promised latest activity but sorted shipment creation time. | Migration 100 orders the six scoped rows by updated_at. Regression brings an old shipment with a new update to the top without cross-workspace rows. |
| UIA-03 | On-duty Trucks could count a historical signal on an inactive vehicle. | Migration 100 requires an active vehicle. Rollback regression proves the count falls when the vehicle becomes inactive. |
| UIA-04 | Admin Capacity described every non-Partial row, including Off Duty, as Empty truck. | Description now uses actual status. Browser regression deactivates its synthetic truck and verifies its Off Duty row is never described as Empty. |
| UIA-05 | User/truck status forms omitted returnTo; other list actions omitted page. Saving could jump to Clients or the first page. | Every list action preserves view/search/page. Browser proves successful truck state persistence with retained search and denied missing-user mutation with retained page two. |
| UIA-06 | Administrator Account said No plan assigned / Contact support despite role-granted access. | It now states Platform access and explains that no customer plan/payment is required. Provider billing is unchanged; browser checks payment form absence. |
| UIA-07 | A stale/out-of-range Records offset returned zero rows and lost its window total, falsely claiming no matches; fractional page values could reach an integer RPC argument. | Validate page inputs and recover one bounded first page of the same search when an offset is empty. Never fetch an unbounded inventory. |
| UIA-08 | Current regular-service areas are stored as PROFILE_ROUTE with RADIUS geometry, but admin rendering inferred geometry only from the older SERVICE_AREA record kind. An area appeared as a route from its city to itself. | Migration 101 adds the existing geometry discriminator to the bounded list. List/detail show Service area / Area around the center; actual routes retain endpoints. SQL proves area/route discrimination, detail agreement and provider/browser denial without projecting coordinates. |

## Verification and rollout

- Migration 100 and 101 each had a protected prior-function backup, rollback-only
  rehearsal and successful catalog-security check before local application.
- `tests/sql/dashboard-activity.sql` and `tests/sql/admin-service-geometry.sql`
  cover changed query semantics and denial boundaries. Both are added to CI;
  no remote CI execution is claimed.
- `tests/e2e/ui-contract-audit.spec.ts` covers the corrected controls and facts.
  All eight distinct desktop/phone cases pass. The admin-save pair was also
  repeated successfully after the pagination adapter changed.
- TypeScript and source/spec validation pass. Initial test failures were an
  incorrect test-only alert selector and transient local browser navigation;
  the controlled corrected run passed without weakening product assertions.
- Captures: `artifacts/ui-contract-review-2026-09-21/` and
  `artifacts/ui-contract-additional-review-2026-09-21/`. Protected local scan
  evidence and function backups: `.local/ui-contract-audit/`.
- Review at http://127.0.0.1:3100/admin, `/admin/operations`, `/app/home`, and
  `/app/more` with the corresponding local role. Keep the server running.
- Owner visual approval precedes extensive quality/build/release gates. Neither
  browser evidence nor this audit authorizes deployment. Rollback can restore
  the saved functions and prior presentation without deleting operational history.

## Prevention

When a lifecycle gains a state, review dashboard totals, recent activity,
status descriptions and list/detail agreement alongside mutation authority.
A successful page load and a matching POST route do not prove meaningful UI:
assert what is persisted, the visible result, failure behavior and navigation
context. Capture the original workflow and avoid redesigning it during an audit.

Final UIA-08 screenshot review also caught the detail badge exposing the internal
Profile Route kind for an area. List/detail badges now say Service Area; the
focused browser checks assert this alongside the area description. Final area
captures: `artifacts/ui-contract-area-final-review-2026-09-21/`.

## Review workflow continuation

Related contracts: FEAT-ADM-001, FEAT-VER-001, FEAT-BIL-001 and FEAT-REV-001.
These changes are local; they require no new migration or privilege change.

| ID | Observed mismatch | Correction |
|---|---|---|
| UIA-09 | Document, payment and rating decisions redirected to their default tab, discarding search/status/page. | Forms carry canonical queue context; success and denial retain it. Only the matching local Review Center tab is an accepted return destination; injected flash messages and external destinations are discarded. |
| UIA-10 | All three review queues lost their window total at a stale offset; fractional page inputs could reach integer RPC arguments. | Shared page validation and at most one bounded first-page recovery preserve the same actor/filter. Query failures remain errors. |
| UIA-11 | With mixed truck approvals, the authorization selector still offered already-approved pairings that the submission command rejected. | Only currently unapproved/expired pairings remain eligible; all pairing badges and history stay visible. Backend assignment/expiry/duplicate checks remain authoritative. |
| UIA-12 | The empty verification form called documents required and implied verification was complete even when no subjects were eligible. | The message explains whether available categories have approval or there are no eligible subjects, retaining the optional-document contract. |
| UIA-15 | A category selection made before client readiness was reset to National ID, leaving authorization fields absent. | Dependent subject/category selectors wait for readiness. A deliberately delayed-script browser check proves they cannot accept a lost early selection; normal selection then reveals the truck and expiry fields. |

Focused evidence: `tests/review-workflows.test.mjs` checks bounded recovery,
malformed inputs, propagated failures, redirect confinement and mixed truck
approval/expiry. `tests/e2e/review-workflows.spec.ts` exercises actual visible
decisions and persisted state using isolated synthetic local records. The older
Fleet clarity test's obsolete Invite driver expectation now matches Add driver.
All six desktop/phone review cases and two Fleet clarity cases pass. The final
document/readiness captures are in `artifacts/review-workflow-readiness-2026-09-21/`;
payment/rating captures remain in `artifacts/review-workflow-audit-2026-09-21/`.
Eight focused pure/runtime tests, typecheck and source/spec checks also pass.
Progress records the initial incorrect HTTP assertion, reproduced early-selection
failure and corrected delayed-script harness. None of these results substitutes
for owner visual approval or extensive release gates.

### Recorded follow-ups, not claimed fixed

- **UIA-13 — payment display precision:** a stored proof amount of 125050 minor
  units displays as ETB 1,251 in Review Center. `formatEtb` in `src/lib/domain.js`
  explicitly rounds to zero fractional digits. Preserve exact minor-unit value
  in billing/review presentation and inspect other monetary callers before
  changing shared formatting. Evidence: the synthetic payment desktop/phone
  captures in `artifacts/review-workflow-audit-2026-09-21/`. Storage is unchanged.
- **UIA-14 — pending document choices:** subject choices project approvals,
  so a category/pairing with a pending request can still be selected. The server
  correctly rejects a duplicate PENDING request. A follow-up should project
  actor-scoped pending state and offer truthful in-review guidance; do not
  represent pending evidence as approved or weaken duplicate protection.

Remaining exploration includes Support decisions and delegated permission
combinations. Queue correctness here is not exhaustive application completion.


### QA-01 — Featured sponsor fixture assumption (drawer regression follow-up)

The focused public-entry smoke on desktop and phone passes its revised capacity
controls, then expects a Featured sponsor rail that is absent. Read-only local
`getDailyFeaturedProviders()` returns zero sponsored providers; `SponsoredProviders`
intentionally returns no rail for zero records. This is test-fixture/setup evidence,
not proof of a disconnected sponsor feature. Before a full release gate, provide
an isolated eligible sponsor fixture for the positive case and an explicit
zero-sponsor case. Do not fabricate visible sponsors, weaken the assertion, or
mutate real sponsor placements to pass an unrelated drawer check. Evidence:
`artifacts/capacity-drawer-final-2026-09-21/`. No production failure is claimed.


### UIA-16 — About phone action obstruction (recorded, not fixed)

At Pixel 7 size, About's bottom actions sit beneath the fixed navigation/chat
controls. After `Join as a transporter` is scrolled into view, its center does not
receive pointer hits. The primary capacity button is also partly covered by the
chat launcher in the capture. Evidence: `artifacts/narrative-review-2026-09-21/phone-about-actions.png`.
Follow up on the public information-page scroll container and bottom safe space;
verify both CTA centers and edges are reachable on short and tall phones without
hiding chat access. Do not treat a no-horizontal-overflow check as proof that
fixed overlays leave actions usable. Origin relative to earlier releases has
not been established. This finding blocks a clean About usability claim.


UIA-16 follow-up during the approved release: scrolling About to the actual end
on Pixel 7 makes both action centers reachable (Find capacity and Join as a
transporter). Earlier `scrollIntoViewIfNeeded` considered the button inside the
viewport despite a fixed overlay and did not scroll. The failure is therefore
not evidence that the actions cannot be reached. No layout redesign is included;
retain the intermediate overlay observation for broader short-phone review.
Capture: `artifacts/narrative-review-2026-09-21/phone-about-scroll-end.png`.


QA-01 release correction: public-entry smoke now creates and removes its own
local advertiser placement, so sponsor rendering no longer depends on stale
date-bound fixtures. A separate no-sponsor browser case temporarily hides and
restores only local placement state and verifies the board remains usable.
Both cases pass at desktop and phone sizes. Legacy capacity redirect/search is
an independent case and opens the phone drawer before inspecting its retained
query; both viewport cases pass. Captures/results:
`artifacts/release-preflight-browser-corrected-2026-09-21/` and
`artifacts/release-redirect-2026-09-21/`. No production sponsorship changes.
