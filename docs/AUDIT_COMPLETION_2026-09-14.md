# Recorded audit completion — 2026-09-14

Authorization: the owner asked to fix all recorded Loadgistic audit items in one
continuous effort, recording newly discovered issues and fixing those that fit.
Work is confined to Loadgistic. Preserve the existing uncommitted changes.

## Ordered work and evidence

- [x] Reconcile CURRENT_FEATURE_AUDIT and WORKFLOW_GAP_AUDIT against verified
  repair checkpoints. F01/F02/F03/F07/F08/F12/F14/F15 and the six fleet workflow
  findings have local evidence; prior implementation is not restarted.
- [x] F10, FEAT-FLT-001 / FEAT-TRK-001: define and implement owner-scoped truck
  retirement/restoration and Tracking correction, reassignment and cancellation.
  Preserve history; terminal records cannot be rewritten; revoke cancelled guest
  access; clear stale assignment location. Prove cross-owner/Driver denials and
  transitions in SQL and desktop/phone workflows. SQL, both browser viewports
  and queued former-Driver status/location regressions passed.
- [x] F04, platform administration specs: reuse the governed recovery contracts
  with explicit Operations authority and audit reasons; add bounded workspace
  correction and an authenticated approximate Tracking map. No arbitrary data
  editor, actor impersonation or private-coordinate expansion.
- [x] F09, FEAT-IAM-001: add verified self-service email change and the selected
  account-closure flow. Never replace an Auth email through an admin shortcut.
  Resolve active work/ownership and retained private-file behavior before closure.
  Owner approved deactivation with retained history on 2026-09-14; active work
  must be resolved first. Desktop/phone inbox and closure checks passed under
  the actual local Auth settings described below.
- [x] F06, FEAT-LST-001 / FEAT-CAP-001: implement spatial viewport discovery,
  bounded client retention and database-side private geographic eligibility.
  Existing complete public-fleet paging remains verified. Exercise distant map
  movement, dense results, privacy and query bounds rather than claim scale from
  a small fixture alone. SQL, 5,000-truck scale and both browser viewports passed.
- [x] F05, FEAT-SUP-001 / FEAT-GST-001: finish efficient incremental polling with
  lightweight change checks and unchanged-response handling, as allowed by the
  audit's push-or-incremental choice. Keep current authority checks, history,
  attachment access, hidden-tab pauses, backoff and draft preservation. Polling,
  history and private attachment workflows passed on desktop and phone.
- [x] F11: verify and document the supported foreground-browser contract and
  platform limit. Reliable phone-background GPS needs a separately scoped native
  capability; do not fabricate support or disguise it as a repaired web bug.
  The foreground controls passed again on desktop/phone after the recovery
  changes; sensor coordinates and visibility events are simulated in this test.
  The platform limit stays explicit.
- [x] F13 / BASE-DEP-001: prepare the concrete release/migration/configuration
  checklist and verify all locally possible upload gates. Hosted rollout and
  protected browser upload verification remain distinct from local completion;
  obtain any required deployment authorization only after the candidate is ready.
  Local private Support file uploads/downloads and denials passed on both viewports.
- [x] Focused SQL/browser workflows, final quality and the 86-page production
  build passed. Product master, specs, traceability, authorization, architecture
  and audit status reconciled with evidence. Browser passes span focused runs.

## Newly discovered issues

F16 — Tracking writes authorized before waiting for the shipment lock. A queued
status write could retain old assignment authority after recovery. Migration 090
rechecks authority after the lock for status/location writes; the two queued
writer regressions passed. New retirement also serializes
with Tracking creation/capacity writes to avoid publishing against a retired truck.

## Completion boundary

Local implementation, automated verification, owner visual approval and hosted
rollout are separate claims. Keep unresolved decisions and platform/remote limits
visible. No commit, push or deployment is implied by a local passing gate.

## Runtime verification resumed

The owner resolved the usage issue and authorized continuing browser verification.
Local Docker and Playwright execution resumed successfully on 2026-09-14. The
previous usage-limit interruption is resolved; it is not an outstanding blocker.

## Latest checkpoint

Implementation and local verification are complete for the selected
F04/F05/F06/F09/F10 contracts and additional F16–F24 repairs. The F22–F24
continuation below records subsequent verification. Do not restart verified repairs.

- [x] Add recovery/admin/account/spatial/incremental-polling specs and ADRs 058–062.
- [x] Implement F10 and F04; apply 090–091 locally and run rollback SQL assertions.
- [x] Implement F09 fresh-code/confirmed-email and retained deactivation (092).
- [x] Implement F06 viewport replacement, 140-truck retention, database-side
  private filtering, precomputed envelopes/GiST indexes and at-most-200-cell
  public overviews without per-truck payloads (093).
- [x] Implement F05 authorized conditional polling (094); preserve historical
  windows, attachment access and drafts.
- [x] Final quality: 290 tests, TypeScript, 28 specs/25 features, 349 source checks.
- [x] Final optimized build: 86 pages; generated Next metadata restored.
- [x] Prepare AUDIT_RELEASE_CANDIDATE_2026-09-14.md, including migration digests,
  callback/configuration requirements, hosted checks and safe rollback boundaries.
- [x] Applied 092–094 in one guarded transaction to `loadgistic-local`, after a
  protected local PostgreSQL backup. Matching source was recorded in the ledger.
  Hosted rewrite/lock review for 093 remains a rollout requirement.
- [x] Passed `tests/sql/account-security.sql`, `capacity-viewport.sql`,
  `support-polling.sql`, and lifecycle/history/attachment authorization
  suites after the new triggers. The 1,002-truck SQL fixture excludes generated
  columns when cloning and rolls back all state.
- [x] `scripts/verify-audit-concurrency.mjs`: all six cases passed. A database
  observer confirmed actual lock waits before releasing each competing transaction.
  Former-Driver status/location and concurrent closure versus invitation,
  assignment, truck and Support creation were denied; synthetic rows were cleaned.
- [x] Real desktop/phone lifecycle, account-security, Support-polling and map
  smoke/performance workflows passed; both email-change inboxes and signed-state
  denial verified. Only sanitized status/screenshots retained; exact fixtures cleaned.
- [x] Apply 095 after a protected backup; public metadata privacy rollback SQL
  passed, as did independent/company desktop/phone HTML privacy assertions.
- [x] Desktop/phone map performance passed with six-times CPU throttling,
  bounded cells, viewport replacement, no cursor draining and heap below 96 MiB.
  The rollback-only 5,000-truck scale audit
  passed: overview 1 cell / 137 bytes / 4,636.881 ms; public cursor 15 rows /
  49,230 bytes / 1,243.724 ms; route query 2,277.494 ms. The dense broad-window
  envelope EXPLAIN selected a sequential scan (4.989 ms); this is not evidence
  that the planner chooses GiST for selective windows or a national load test.
- [x] Reconcile completion status after those checks. F13 hosted rollout remains
  a separate owner-authorized action; no commit, push or deployment was performed.

F17 — Account closure could race newly authorized work after checking blockers.
Migration 092 shares the Fleet organization lock, rechecks invitation authority
after it and serializes active truck/assignment/Support insertion against the
closing profile. These guards are implemented and all four concurrent closure regressions passed.

F18 — Browser verification exposed terminal Tracking copy and layout defects.
Cancelled records displayed “Tracking complete” and location inputs; long recipient
emails expanded the fixed-width sidebar. Terminal controls now show the actual
state, and participant rows wrap within a single content column. Desktop/phone
regressions passed for cancelled copy, absent location input and no document overflow.

Local Auth limitation — `GOTRUE_MAILER_AUTOCONFIRM=true` bypasses the two-link
requirement even while secure email change is enabled. No Auth setting was changed.
The browser test verifies current-email OTP, delivery to both synthetic inboxes,
then opens the new-inbox link first and the old-inbox link only if Auth still
requires confirmation. Hosted two-link enforcement must be tested against its
actual settings during an authorized rollout.

Core browser evidence: `.local/audit-runtime-browser-final.log`, **8 passed**
(5.0 minutes), covering account security, lifecycle recovery, map performance and
Support polling on desktop and phone. Additional focused runs provide passing
evidence for all 34 affected desktop/phone cases. BUILD_VERIFICATION lists the
logs and scope; this is not a claim that one combined invocation passed 34 tests.

F19 — A hidden synthetic business email appeared in Next development RSC debug
serialization of an intermediate database response, despite final UI filtering.
Migration 095 moves public metadata/contact masking and Driver first-name
projection into SQL and returns image presence instead of its private path.
Production exposure was not observed or claimed. Raw RPC privacy assertions and
independent/company desktop/phone serialized HTML checks passed; F19 is closed locally.

F20 — Viewport paging/overview buttons were direct children of the map grid.
They consumed map rows on phone, shrinking the canvas and letting the selected
truck summary extend beyond it. Actions now live in the command panel and hide
while a truck is focused; phone feedback sits below those commands. Dense-map
desktop/phone geometry assertions passed; F20 is closed locally.

Runtime cleanup: the first timed-out lifecycle runs left two exact synthetic
identities, four trucks and two Tracking records. Their IDs, creation times and
original cargo markers were checked before scoped transactional cleanup. No
non-test records were removed. The 5,000-truck fixture rolled back completely.

F21 — A real desktop Empty/Partial label collision remained after map settling.
A closer same-status neighbor could push a group directly into the opposite
status in an adjacent cell. A three-group unit reproduction failed before the
fix; nearby opposite-status collisions now take priority. Global cells, actual
geographic anchors, eight-truck groups and 32-pixel displacement bounds remain.
All eight cluster tests and dense-map workflows on both browser viewports passed;
F21 is closed locally. Final desktop evidence: `.local/audit-runtime-cluster-desktop.log`.


## Follow-up findings (resolved locally)

- [x] F22 — The visitor location-permission notice overlapped the selected truck
  heading. Feedback now participates in summary layout, including loading/error
  states. The new geometry regression failed before the fix and passes on desktop
  and phone. Corrected screenshots: `artifacts/map-feedback-2026-09-14/`.
  F24 below also resolves zoom obstruction exposed by stricter 320px checks.
  No owner visual approval claimed.

Final quality: **290 tests**, TypeScript, 28 specs/25 features and 349 source
checks passed (`.local/audit-runtime-quality-final.log`). Cleanup confirms zero
synthetic audit identities and zero scale trucks; local ledger includes 090–095.
Hosted rollout, hosted Auth two-link enforcement and reliable phone-background
GPS remain separate from completed local browser verification.


## F22–F24 continuation — final verification

- [x] Inspect selected-map layout and specify feedback/identity/retry separation
  in FEAT-LST-001; preserve previous uncommitted work.
- [x] Reproduce overlap in the desktop browser: identity/action intersection
  failed before the fix (`.local/audit-f22-before.log`).
- [x] Place selected feedback in a normal summary row, including loading and
  failed refresh; preserve one live region and full-size retry text/target.
- [x] Verify narrow reflow, retry/close behavior and shared public/private shell;
  inspect corrected desktop/phone screenshots. All 10 related browser cases have
  passing focused evidence, including 320px zoom hit targets and refresh recovery.
- [x] Quality: 290 tests, TypeScript, 28 specs/25 features and 349 source checks.
- [x] Final production build passed with 86 pages; generated Next metadata
  restored. Product/spec/audit evidence reconciled; no commit or deployment.


F23 — Three controlling specs still labeled the already verified viewport and
incremental-polling repairs as awaiting runtime evidence. Their headings now
match the passing local evidence; hosted rollout and national concurrent-user
scale remain separate claims. Specification validation passed in the quality gate.


F24 — At 320 pixels the selected truck summary covered the Leaflet zoom buttons.
The stricter phone failed-refresh test exposed a real intercepted zoom click.
Narrow summaries now reserve the existing left control column; control hit
targets, actual zoom clicks and summary containment passed on desktop/phone.
The first broader run passed eight cases; desktop tile readiness timed out
separately and passed one controlled retry without changing its assertion.
Final focused run: four feedback/dense-map cases passed in 47.9s. Logs:
`.local/audit-f22-before.log`, `.local/audit-f22-regressions.log` and
`.local/audit-f22-f24-final.log`.


## Release verification continuation — 2026-09-14

The owner authorized deployment. The full 166-case diagnostic browser run finished
with 139 passes, 19 failures and eight opt-in visual skips in 52.8 minutes.
A fresh-server retry passed 14 of those failures in 8.9 minutes. The remaining
five results were four executions of an incorrect new public-handle assertion
and one Tracking navigation-readiness failure. After corrections, all six final
desktop/phone cases passed in 3.4 minutes. All 158 enabled cases therefore have
passing evidence across runs; eight opt-in visual captures were skipped. This
is not a single clean full-suite or production pass. Logs: `.local/deploy-browser-suite.log`,
`.local/deploy-focused-retry.log`, `.local/deploy-final-browser.log`.

- **F25 — browser readiness and selector drift.** Accessibility/reflow checks now
  wait for the streamed `/apply` → Login redirect before evaluating the DOM.
  Handle URLs are internal rewrites, so tests require the preserved `/@handle`
  URL and visible provider identity. Featured focus waits for the rendered page;
  Fleet owner location denial selects View truck explicitly; the free-access
  helper waits for the actual capacity summary instead of duplicate streamed
  wrappers; mobile navigation waits for the current Featured link state.
  Multi-party Tracking now awaits the real guest destination for each recipient
  before asserting the private view. The repeated failure trace showed successful
  unlock and page responses taking about 1.1 + 4.9 seconds, beyond the prematurely
  started five-second content assertion. Permission/content assertions and overall
  workflow budgets remain unchanged. The other late phone navigation, Driver,
  private-file and history failures passed on the controlled fresh-server retry;
  the evidence does not establish a production defect or a broader performance SLA.
- **F26 — private Docker build context.** `.dockerignore` now excludes `.local`,
  `.netlify`, all `.next*`, agent state and linked Supabase state. A builder guard
  rejects private deployment state before compilation; CI creates non-secret
  canaries to exercise it. A scratch build/export proved application source was
  present among 877 entries and private/generated files were absent. The normal
  standalone build failed twice during Docker Hub DNS/token lookup, before the
  build, and remains an external gate. No global Docker/network settings changed.
- **F27 — expired local sponsor fixtures.** Five deterministic importer placements
  were still dated 2026-09-09. Their exact local IDs, fixture administrator, old
  dates and group were checked before one current-day update on loopback 55321.
  Old values are protected in `.local/deploy-sponsor-fixture-before.json`.
  Sponsor and public-entry cases passed on both viewports across these runs.
  Clean CI import already creates current-day fixtures; production expiry and
  hosted placements were unchanged.
- **F28 — CI budget and audit coverage.** CI now runs all 14 rollback SQL suites,
  six observed-lock concurrency cases and the container canary check. Its serial
  E2E job budget is 60 minutes rather than 30; the full local run took 52.8 minutes.
  Individual assertion and workflow budgets are unchanged.
- **F29 — retired runtime documentation.** TRACEABILITY now describes the actual
  Playwright wrapper, isolated server and guarded local Supabase fixtures instead
  of the retired SQLite runtime. No runtime behavior changed.

Final quality passed 290 tests, TypeScript, 28 specs and 349 source checks. The
fresh dependency audit found zero advisories; all 19 migration hashes still match
the release manifest. The earlier 86-page production build covers the unchanged
application source; release-preparation edits affect tests, CI, packaging and docs.

Hosted project/site and GitHub baseline were independently verified: migration
ledger 076, Netlify commit `451edd1f`. Migrations 077–095 and the exact account-
security callback remain unapplied. The local 083 discrepancy is a missing ledger
row, not a proven source mismatch; it was inspected read-only and left unchanged.
Clean migration replay remains required. Automatic approval review rejected the
hosted database export because the data/destination need explicit permission.
Encrypted database/private-file backup and isolated-restore approval is pending.
No production mutation, data export or production deployment occurred. The
verified audit candidate is committed as `b22bc3a` and pushed in draft
[PR #15](https://github.com/falmata-tech/loadgistic/pull/15). Required remote CI
is running; promotion remains blocked by the listed release gates. The preserved
`.next-upload-audit/` is the only untracked item and was excluded from the commit.
