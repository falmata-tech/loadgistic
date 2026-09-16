# Build Verification

## SQL fixture compatibility — 2026-09-17

Clean CI now passes the isolated owner setup, catalog gate and all managed
workflow verifiers. It exposed an older spatial fixture assumption: no Empty
capacity necessarily remains after those verifiers. A rollback-only reproduction
with exclusively Partial source rows fails before the fix and passes afterward;
the test now explicitly creates Empty/radius copies and keeps every paging,
spatial-filter, aggregate and audience-denial assertion.

The full local SQL pass also identified three stale setup/assertion assumptions.
Fleet onboarding now proves the accepted private-account phone separation from
migration 086; company paging creates the active owner required by migration 092;
and Featured target counts apply to the requested week, not unrelated history.
All 15 SQL suites have passing evidence across the initial and focused corrected
runs. SQL failures are now grouped by suite in CI. No production contract or
authorization check was relaxed; the accepted FEAT-IAM-001/FEAT-FLT-001 contracts
control the corrected assertions. Clean CI is still required.

## Clean-CI local owner authentication — 2026-09-17

The fresh PostgreSQL 15 CI image requires password authentication for its local
owner role; the long-lived PostgreSQL 17 stack did not reproduce the missing
password failure. The fixed helper reads the CLI-provisioned password only
inside the named local Docker container and connects to explicit loopback/5432.
It does not load hosted credentials. The owner setup, public-table catalog gate,
real browser-role CRUD denial and service spatial transformation passed locally.
Clean CI remains required; local success does not substitute for that result.

## Production authority and PostGIS containment — 2026-09-16/17

FEAT-SEC-001 / ADR-063. Quality passed 297 tests, TypeScript, 29 specs and 349
source checks. Seven new monitor regressions prove scoped-format credential
rejection, exact GET destinations, redirect refusal, target validation, unavailable
or malformed advisor failure, metadata-only output and WARN/ERROR blocking.
No write endpoint or arbitrary-query option exists in the monitor.

The real local catalog gate failed on public.spatial_ref_sys before repair.
Normal postgres could not alter the provider-owned table. The exact owner SQL
then enabled RLS and removed browser grants on local services only. Both browser
roles' CRUD operations were denied, while service reference reads and PostGIS
coordinate transformation passed. A newly created unprotected public table made
the same gate fail and disappeared on rollback. Two legacy local bulk writers
were disabled and tested to fail before loading credentials or spawning tools.

The corrected signup fixture uses retained inactive associations, consistent with
migration 092's active-owner/participant constraints. The complete local signup
verifier passed. The broader local verifier failed on 144 active vehicles against
its exact 143 clean-fixture requirement; no data reset or relaxed assertion was
used. Required clean CI has not passed for these changes.

The hosted critical RLS finding remains OPEN: only the provider owner can apply
the prepared SQL. Project-scoped monitoring credentials, independent coding/
approval identities, branch/environment enforcement and active daily monitoring
are pending owner configuration. Repository rules alone do not restrict an admin
credential. Encrypted database and private Storage exports passed authenticated recovery.
The full custom database archive restored in a network-disabled disposable local
container: 2,268 archive entries, 52 public tables and migration ledger 076.
Scheduled jobs were disabled and the container was removed. The one private
Storage object passed local upload/download byte/hash comparison and verified
cleanup. Logs and recovery keys remain ignored; separate owner key custody is
still an operational requirement. The owner selected owner-only production
changes on 2026-09-17; no automation identity or technical approval boundary
has been installed.
No production setting/database changes occurred. Application UI source is unchanged;
the preceding production-build/browser evidence is not a hosted security proof.

## Deployment preflight and F25–F29 — 2026-09-14

- Full diagnostic browser run: 139 passed, 19 failed, eight opt-in visual captures
  skipped (52.8 minutes). Fresh-server retry: 14 passed, five failed (8.9 minutes).
  After the final handle/rewrite and Tracking-navigation test corrections, all six
  desktop/phone cases passed (3.4 minutes). Every enabled case (158) has passing
  evidence across runs; this does not claim a single clean full-suite run.
- Test repairs retain permission, accessibility, content and reflow assertions.
  Exact traces and failure classification are summarized in AUDIT_COMPLETION.
  Local sponsor fixtures were refreshed by exact ID; hosted placements and
  production expiry behavior were unchanged.
- Quality: 290 tests, TypeScript, 28 specs and 349 source checks. Fresh dependency
  audit: zero advisories. The earlier 86-page production build covers unchanged
  application source; this preflight changes tests, packaging, CI and docs.
- F26 scratch Docker context proof: application present among 877 entries;
  credential/backup/deployment/generated state absent. Normal container build
  failed twice on Docker Hub DNS before building; required container CI remains.
- CI now runs all 14 rollback SQL audit suites and six concurrency cases against
  clean migrations, and adds container canaries. All 19 release migration hashes
  match the manifest. Hosted ledger remains 076 and Netlify remains `451edd1f`.
- No hosted mutation/export/deployment. Backup and isolated-restore approval,
  required remote CI, migrations/configuration and hosted browser verification
  remain deployment gates. See AUDIT_RELEASE_CANDIDATE_2026-09-14.md.

Logs are ignored local evidence: `.local/deploy-browser-suite.log`,
`.local/deploy-focused-retry.log`, `.local/deploy-final-browser.log`,
`.local/deploy-quality-final.log`, `.local/deploy-context-evidence.json`.

## Map feedback and narrow zoom continuation — 2026-09-14

F22 feedback now occupies a normal grid row in the selected truck summary;
location, loading and failure messages no longer cover identity or contact/close
actions. Retry remains readable and at least 44px. F24 reserves the left zoom
column when sizing phone summaries. No API, database or authorization change.

- The new feedback regression failed before the fix on actual identity overlap.
  A subsequent 320px refresh test exposed a zoom click intercepted by the summary.
  Both were fixed without forced clicks or weakening geometry assertions.
- All 10 related desktop/phone cases passed across focused runs: feedback/retry,
  dense-map selection, denied-location retry, public shell breakpoints and real
  email-unlocked private shell breakpoints. Final focused run passed all four
  feedback/dense-map cases in 47.9s (`.local/audit-f22-f24-final.log`). The other
  six passes are in `.local/audit-f22-regressions.log`; that earlier run also
  records the pre-F24 failure and one tile-readiness timeout. The unchanged tile
  assertion passed on its controlled retry.
- New feedback tests cover widths 320, 390, 760, 761, 1024 and 1280; they prove one
  live region, no feedback/identity intersection, map containment, no document
  overflow, reachable zoom targets, real failed-refresh recovery and summary
  closure. Device denial and the 503 response are simulated; capacity comes from
  the real local adapter. Private shell tests use local Auth/Mailpit and revoke
  their exact synthetic grant in cleanup.
- Corrected desktop and 320px phone screenshots were inspected, including the
  visible failed-refresh retry: `artifacts/map-feedback-2026-09-14/`.
  Automated/agent review does not imply owner visual approval.
- Quality passed 290 tests, TypeScript, 28 specs/25 features and 349 source checks
  (`.local/audit-f22-quality.log`). Final production build passed with 86 pages
  (`.local/audit-f22-build.log`); generated Next metadata was restored.
- F23 reconciles three stale pending-runtime spec headings with existing evidence.
  Hosted rollout, Auth two-link enforcement and background GPS limits remain.
  No commit, push, schema/configuration change or deployment.

## Recorded-audit runtime verification — 2026-09-14

The usage-limit interruption is resolved. Migrations 090–095 are applied only to
`supabase_db_loadgistic-local`; 092–094 were applied together after a protected
backup, and 095 after its own backup. Ledger entries match their reviewed source.

- Seven rollback SQL suites passed: account security, capacity viewport, Support
  polling, lifecycle recovery, Support history, Support attachments and public
  provider metadata privacy.
- Six concurrency cases passed with observed lock waits: former-Driver status
  and location writes, and closure versus new truck, Support, assignment and
  invitation writes. Temporary fixtures were cleaned.
- The rollback-only 5,000-truck scale audit passed: overview 1 cell / 137 bytes /
  4,636.881 ms; public cursor 15 rows / 49,230 bytes / 1,243.724 ms; route query
  2,277.494 ms. Dense envelope EXPLAIN chose a sequential scan, execution 4.989 ms.
  This does not certify selective-index use, national scale or concurrent users.
- All 34 affected browser cases passed across focused desktop/phone runs, rather
  than one combined invocation. They cover account security, lifecycle recovery,
  map performance, Support polling/history/files, public fleet paging/privacy,
  geographic filter validation, five market/Tracking smoke workflows and
  foreground Tracking controls. The map checks use six-times CPU throttling,
  bounded cells, viewport replacement, no cursor draining and heap below 96 MiB.
- F18 terminal Tracking copy/layout, F19 raw public metadata privacy, F20 phone
  map row sizing and F21 opposite-status label collisions have passing browser
  regressions. F21 also has a unit reproduction that failed before the fix.
- Final quality passed: 290 tests, TypeScript, 28 specs/25 features and 349 source
  checks (`.local/audit-runtime-quality-final.log`). Final production build passed
  with 86 pages (`.local/audit-runtime-build-final.log`); generated Next metadata
  was restored and matches the pre-task state.

Passing browser evidence is retained in `.local/audit-runtime-browser-final.log`,
`audit-runtime-regressions.log`, `audit-runtime-final-retry.log`,
`audit-runtime-map-privacy-final.log`, `audit-runtime-cluster-final.log` and
`audit-runtime-cluster-desktop.log`. Some earlier invocations contain failures
subsequently fixed and retested; the final desktop dense-map case passed in 53.4s.
SQL/concurrency/scale logs are ignored under `.local/`. Cleanup confirms zero
synthetic audit identities and zero scale trucks. Screenshots are ignored under
`artifacts/account-security-2026-09-14/`, `lifecycle-recovery-2026-09-14/` and
`capacity-viewport-2026-09-14/` (plus the existing Support evidence directories).
Desktop/phone selected-map screenshots were inspected; owner visual approval is
not claimed. Their location-notice/heading overlap (F22) was subsequently fixed
and explicitly tested as described in the continuation below.

Auth retains local auto-confirm: tests verify the fresh current-email OTP,
delivery to both exact synthetic inboxes and new-inbox confirmation, following
the current-inbox link if Auth still requires it. Hosted two-link enforcement
remains a rollout check. Tracking sensor/visibility events are simulated; local
SQL persistence and Mailpit access are real. Browser GPS remains foreground-only.
No hosted configuration, commit, push or deployment was performed.

Evidence uses Node.js v22.16.0. Earlier dated sections describe their own verified
code/environment checkpoints.

## Member Support attachments — 2026-09-14 (local)

- F05 attachment parity: signed-in members, assigned Support staff and admins
  can send required text with one private JPG/PNG/WebP/PDF reply attachment.
  Current permission is checked before Storage and again at atomic message
  attachment. Every recent/older/closed-history download repeats current scope,
  returns a download disposition and disables caching/content sniffing.
- Migration 089 registers an object reference before upload, caps pending work
  per actor, and retains retryable cleanup state. Unacknowledged Storage writes
  wait one hour for late arrival; acknowledged uploads whose commit failed may
  clean immediately. Cleanup claims at most 20 and removes metadata only after
  bytes. An ATTACHED record survives a lost commit response; the UI asks the
  user to check the conversation before retrying an unconfirmed attachment.
- Five input/cleanup tests and the extended managed-worker test passed. Rollback
  SQL proves ownership, assignment, Support permission/activation, anonymous and
  cross-conversation denial, atomic sends, idempotent retry, safe history
  projections, closed downloads, pending limits, cleanup grace/retry and
  browser-role table/RPC denial.
- Final attachment browser run: 2/2 desktop/phone cases passed against real local
  Auth, PostgreSQL and private Storage. Visible member PNG and staff PDF uploads
  led to byte-identical browser downloads. Invalid-content failure retained
  safe grace metadata and cleanup removed it; reassigned staff, other members,
  anonymous and wrong-conversation reads were denied. Both files remained
  downloadable in older closed history. Existing Support history regression:
  6/6 cases passed, including guest file reads and launcher draft preservation.
- Final gates: 277 tests; TypeScript; 28 specs/334 source files; production build
  generated 85 pages. Six final screenshots are in
  `artifacts/support-attachments-2026-09-14/`; desktop/phone review found and fixed
  a cramped file-picker row. Owner visual approval is not claimed.
- Cleanup verification: zero attachment rows, synthetic attachment profiles and
  `member-support/` objects remained. The local two-function definition backup
  is ignored under `.local/`; migration 089 and its local ledger include the
  timeout cleanup refinement. No hosted mutation, commit, push or deployment.
  Apply 089 before publishing UI/worker. Retain attachment metadata/cleanup on
  UI rollback; future conversation/account deletion must drain private files.
  Existing upload inspection policy and polling remain unchanged; push delivery
  and the remaining audit work are not marked complete.

## Tracking location controls — 2026-09-14 (local)

- F11 controls: the assigned Driver can choose the existing 1, 3, 5, 10, 20 or
  40 km privacy radius for the next saved travel location. The selection and last
  confirmed radius are distinct. The browser obscures coordinates before POST;
  previous location events are unchanged by radius selection. Initial browser
  setup cannot reset an early choice: the selector waits for its handlers, and
  each Tracking identity owns its initial control state. Travel submission
  snapshots the selected action before GPS and disables status/radius edits
  while that request is in progress.
- The browser handles `recorded:false / THROTTLED` as waiting and records a local
  cooldown only after an acknowledged save. Error, acquisition, saving, paused
  and waiting states no longer all appear as finding/shared location. The Driver
  can retry permission or save failures; server cooldown still applies.
- A single-flight runner invalidates late sensor callbacks and aborts fetches
  on hide/unmount. It cannot undo a request already received by the server.
  Driver and recipient guidance explicitly describes the open/visible-screen
  requirement and pauses on phone lock or screen closure. Background GPS remains
  unsupported; no schema, authorization, provider or frequency rule changed.
- Seven focused runner/result tests passed: allowed radii, result validation,
  hidden-callback denial, visibility recheck, overlapping requests, stale
  completion ownership, fetch abort, acquisition/save failure and retry. Browser tests use simulated
  coordinates and visibility events with real local Auth, Tracking SQL and
  Mailpit. This proves browser lifecycle handling, not physical phone-lock or
  background-device operation.
- The combined location/proof run passed all four desktop/phone cases. The
  final delayed-GPS location run passed both cases after preventing the initial
  radius-selection timing race. It proved 40 km travel persistence, later 5 km
  refresh, honest server/client cooldown, pending status/radius lock, visibility
  cancellation, permission-denied retry, recipient OTP guidance and status-only
  control omission. Four screenshots are retained in
  `artifacts/tracking-location-controls-2026-09-14/`; owner visual approval is
  not claimed. Synthetic Tracking/proof records and both test email outboxes
  were independently confirmed empty after teardown.
- `npm run quality` passed: 272 tests, TypeScript, 28 specs and 332 source
  files. `npm run build` passed with 85 generated pages. Browser/build wrappers
  restored Next's generated type references, and whitespace checks passed.
- No commit, deployment, hosted configuration or other-project change occurred.
  UI rollback retains all historical Tracking events. Remaining F04/F05/F06/F09/
  F10 work stays listed in the current audit.

## Public provider fleet paging — 2026-09-14 (local)

- F06 profile-fleet portion: canonical transporter pages now render at most 12
  active owned trucks, with deterministic truck-number/ID order, exact total and
  explicit page counts. Native Previous/Next links preserve browser history.
  Invalid page syntax starts at one; out-of-range pages clamp to the last page.
- Capacity reads select the displayed vehicle IDs before latest-state selection,
  removing the six-batch/96-signal ceiling. Existing public visibility, active
  Driver and publication checks are retained. Related vehicle/Driver evidence
  reads use the same page IDs; provider operating-model and aggregate evidence
  are independent of page position. Latest approvals take precedence over older
  documents, including a newer expired approval.
- Migration 088 is applied and recorded only in `supabase_db_loadgistic-local`
  (API 55321). It adds an owner-scoped service-only read function, active-fleet
  page indexes and a guarded single-fragment capacity-query change. No business
  rows or browser grants are changed. The final migration and SQL assertions
  replayed from the saved prior function inside a rolled-back transaction.
- `tests/sql/public-provider-paging.sql` passed with all fixture writes rolled
  back: 105 active trucks across nine pages, no duplicate/missing truck, capacity
  beyond truck 96, private/partner/Off Duty/inactive/unpublished denial, empty and
  Company fleet pages, owner-scope validation, page clamping, stable ownership
  and authorization evidence, latest-expired precedence and browser RPC denial.
  Five ordinary capacity queries matched the saved pre-088 function exactly.
- All four final independent/Company fleet browser cases passed on desktop/phone
  (1.7 minutes), using real local Auth/SQL and public pages. They traversed 105-
  and 13-truck fleets, opened truck 101's capacity map, checked private fields,
  invalid/duplicate/out-of-range page input, browser Back and unpublishing.
  Unpublished profiles render the existing 404 view with no fleet data; the
  streamed layout can send HTTP 200 before that denial, so a strict HTTP 404
  response is not claimed. The initial test's status-only assertion was corrected
  after confirming the rendered denial, rather than changing product access.
- Six focused screenshots are retained in
  `artifacts/public-fleet-paging-2026-09-14/`. Desktop map and phone pagination
  were reviewed; owner visual approval and hosted map-tile delivery are not
  claimed. All synthetic test profiles, provider organizations/profiles and
  trucks were removed; independent count checks returned zero.
- `npm run quality` passed: 265 tests, 28 specs, 331 source files and
  TypeScript. `npm run build` passed with 85 generated pages. Browser/build
  wrappers restored Next's generated type-reference files; whitespace checks
  passed. Prior uncommitted work remains preserved.
- Rollout requires 088 before application publication; application rollback can
  retain the additive read function/indexes. National viewport/cluster discovery
  and private spatial scaling remain open F06 work. No commit, hosted apply,
  deployment, dependency or other-project change occurred.

## Driver portraits — 2026-09-14 (local)

- F08: active Drivers, including Company drivers and limited-plan accounts, can
  upload, replace and remove their own explicitly public photo from Account &
  plan. Fleet owners/admins have no portrait editor for another person. Featured
  uses the current uploaded image; removal clears demo artwork and restores the
  neutral icon. Public photo IDs are distinct from private account identity.
- Inputs accept still JPEG/PNG/WebP up to the configured four-MiB ceiling, with
  a 25-million-pixel decode limit and five-second processing limit. Sharp applies
  orientation and crops a 512-square JPEG while stripping embedded metadata.
  Normalized bytes pass the current quarantine/inspection policy. Original file
  names and camera metadata never become public image metadata.
- Migration 087 is applied and recorded only in `supabase_db_loadgistic-local`
  (API 55321). References are reserved before Storage writes; activation and
  removal serialize per Driver. Removal cancels pending activation, but cleanup
  waits for an in-flight write to settle or age out. The final DELETING state
  prevents revival; failed deletion retries through the existing signed worker.
  Portrait Storage requests have a 30-second timeout. Active photos survive an
  ambiguous activation response, and removed/replaced/inactive URLs return 404
  with no-store and nosniff. Previously downloaded copies cannot be recalled.
- `tests/sql/driver-portraits.sql` passed with all writes rolled back: actor and
  consent denial, unchanged account fields, preset clearing, active-only reads,
  idempotent activation, replacement/removal, inactive identity, ambiguous-result
  preservation, stale-upload/cleanup limits, in-flight cancellation, retry timing,
  no reactivation after claim, and browser table/RPC denial.
- Six focused image/cleanup tests and existing private-Storage tests passed.
  The real default-upload verifier passed quarantine, clean release, dirty-file
  rejection, byte retrieval, cleanup and browser denial. Its local scanner mode
  was confined to that test process and did not change runtime configuration.
- Six desktop/phone account/portrait cases passed using real local Auth, Storage
  and Featured routes. Test photos are synthetic solid-colour images, not real
  people. Exact synthetic provider/truck/evidence rows and one temporary test
  slot are added for each Featured check; existing day/slot rows are preserved.
  The final bounded-request portrait rerun passed all four independent/Company
  Driver desktop/phone cases. Eight Account/Featured screenshots are retained in
  `artifacts/driver-portraits-2026-09-14/`; visual approval is not claimed.
- `npm run quality` passed: all 262 tests, 28 specs, 330 source files and
  TypeScript. `npm run build` passed with 85 generated pages. Next's generated
  type-reference files were restored after the browser and build wrappers.
  Independent cleanup counts found zero synthetic portrait-test profiles,
  portrait metadata rows and objects under the private driver-portrait prefix.
- Sharp 0.35.4 was already installed through Next and is now explicitly pinned.
  The lock retains all original platform/libc metadata; no package versions were
  upgraded and no bucket or vendor was added. Hosted/Linux artifact and worker
  rollout remain separate checks; no remote migration, commit or deploy occurred.
- Rollout requires 087 before UI/worker publication. UI rollback retains upload
  metadata and cleanup; any future account deletion must drain portraits first.

## Account details and fleet phone isolation — 2026-09-14 (local)

- F09 name and private-phone editing is implemented through the current Account
  & plan page for active providers, Company drivers and administrators. The name
  remains a shared display identity; the UI explains this. Blank phone clears
  the private value. Public callback fields and login email remain separate.
- Migration 086 applied transactionally, with its ledger entry, only to
  `supabase_db_loadgistic-local` (API port 55321). It adds one strict self-only
  command and changes exactly the private-phone assignment in the existing
  fleet-contact command. No table/data migration or Auth configuration change.
- `tests/sql/account-details.sql` passed with all writes rolled back: own save
  and clear; shared fleet-name consistency; both directions of phone isolation;
  unchanged other account, Auth identity, memberships, permissions and business
  contact snapshots; malformed/extra fields, missing/inactive/Support actor
  denial; permitted owner/admin edits; audit privacy; browser table/RPC denial.
- `npm run quality` passed: 28 specs, 325 source files, all 256 tests and
  TypeScript. `npm run build` passed with 84 generated pages. The final browser
  runs passed two desktop/phone account cases and two fleet onboarding/contact
  cases. Account tests exercise all three provider identities with real local
  persistence, plus clear/reload, invalid-draft retention, forged actor/role,
  inactive and anonymous denial, cross-origin denial and native POST/303.
- All synthetic account users and organizations were removed; independent
  count checks returned zero for both. The timed-out JavaScript-disabled probe
  required completing teardown of two exact synthetic groups. No demo account
  data was changed by browser tests. SQL fixture edits rolled back in full.
  Next's generated type-reference files were restored after both wrappers.
- Focused screenshots under `artifacts/account-details-2026-09-14/` cover
  Company-driver and independent-provider Account on desktop/phone. Synthetic
  identities have no subscription, proving account maintenance during limited
  access. Screenshot review is not owner visual approval.
- Native POST fallback is scoped to the rendered Account form. A separate
  all-JavaScript-disabled navigation attempt stayed on the existing streamed
  loading shell; this change does not claim whole-app no-JavaScript navigation.
- Rollout: apply 086 before app publication. Application rollback may hide the
  editor without discarding names or private phones; retain the fleet privacy
  fix. Email-change/closure, Driver portraits, spatial map scaling and lifecycle
  recovery remain separate audit items. No commit, remote apply or deploy.

## Retained chat history and unassigned-agent denial — 2026-09-14 (local)

- Audit F05: member Support, assigned staff, guest recovery, and the public
  launcher now offer Older messages / Latest messages with at most 50 messages
  per response/window. Same-timestamp ordering is deterministic; new replies
  do not shift historical windows. History pauses refresh and leaves new
  replies unread; the launcher retains its draft and file selection.
- Audit F15: four guest Support commands now use NULL-safe assignment denial.
  An unassigned Support actor cannot read, reply, close, or open attachments
  before claim. Current guest/admin and assigned-agent authority is preserved.
- Migrations 084–085 applied in one transaction and recorded only in
  `supabase_db_loadgistic-local` (local API port 55321). Migration 085 reuses
  the existing guest index and adds a matching member-message cursor index.
  No customer data migration or external provider change is needed. Deploy
  the database changes before the application; retain 084 on UI rollback.
- `tests/sql/support-history.sql` passed with every change rolled back:
  full 121-message traversal, 50-row cap, timestamp ties, stable arrival,
  terminal pages, wrong/missing/cross-conversation cursors, closed history,
  unread preservation, inactive/unrelated/permission-denied actors, unassigned
  guest read/reply/close/file denial without side effects, permitted assigned
  reply/close, and direct anon/authenticated RPC denial.
- Focused Playwright: **12/12 desktop/phone cases passed** across
  `support-history.spec.ts` and `assisted-chat-audit.spec.ts`. Four new cases
  use real local Auth sessions, database history, private Storage bytes and
  download routes. Two new history-failure cases and six existing chat tests
  mock transport to exercise retry/draft and submission-failure behavior.
  The attachment is a synthetic fixture stored through the upload adapter;
  these tests do not claim a new browser upload-form verification.
- Eight screenshots reviewed under `artifacts/support-history-2026-09-14/`
  cover member, staff, guest launcher and recovery histories on desktop/phone.
  The focused review caught a grid row pushing the composer outside the chat;
  corrected before the passing rerun. Streamed Next.js pages can send HTTP
  200 before `notFound()` renders, so page denials assert the visible 404 and
  absence of messages; file/API denials assert their HTTP responses too.
  Capture readiness now requires the visible thread and Latest messages control,
  preventing hidden streamed content from passing as a rendered history screen.
  All six history cases passed again with those stronger capture assertions.
- `npm run quality`: **252 tests**, 28-spec validation, source check and
  TypeScript passed. `npm run build` passed with **83 generated pages**.
- Cleanup verified zero synthetic guest chats and zero synthetic member
  messages; synthetic attachment objects and email-delivery rows were removed.
  No commit, push, remote migration or deployment. Earlier worktree changes
  remain preserved. User visual approval and a full-site visual/release audit
  are not claimed. F05 member attachments and push transport remain open.

## Map/navigation overlap repair — 2026-09-14 (local)

- Resumed the interrupted `FEAT-UIX-001` layout correction already present in
  the dirty Loadgistic tree. The desktop rail inset/width/gap are shared with
  content spacing; map workspaces consume actual remaining flex height below
  header/tablet navigation. Earlier audit/loading/fleet changes are preserved.
- `npm run test:e2e -- tests/e2e/public-map-shell-layout.spec.ts`: **4/4 passed**.
  Open and email-unlocked Private capacity each cover 320, 390, 760, 761,
  1024, 1180, 1181, 1440, 1920 and 2560 CSS-pixel widths. Short-screen cases
  include 320 by 640 and 1024 by 768. Assertions cover rail/header/phone-nav
  separation, the private session bar, minimum map size, document overflow,
  bounded Filters, Close filters, About navigation, and private logout.
- Private access uses the real local Supabase application/email path and
  Mailpit numeric code, with a unique synthetic recipient per case. Each
  created grant is revoked in `finally`; existing grants are untouched.
  No application APIs or auth boundaries are mocked in these cases.
- `npm run quality`: **248/248 tests**, 28-spec validation, 319-file source
  check and TypeScript passed. `npm run build` passed with **83 generated
  pages**. The build/browser wrappers left `next-env.d.ts` and `tsconfig.json`
  unchanged.
- Sixteen ignored map/Filters screenshots at 320, 390, 1024 and 1920 pixels:
  `artifacts/map-shell-2026-09-14/`. Reviewed desktop, tablet and short-phone
  geometry. External map tiles can still be loading in captures; this is
  layout evidence, not tile-provider reliability or map-scale certification.
- Scope: local layout/spec/evidence only. No hosted writes, migration, push or
  deployment. User visual approval and the expensive full-site visual audit
  remain separate gates. The earlier audit's account, lifecycle, portrait,
  admin-action and scaling gaps remain open.

## Current-feature audit and optional antivirus — 2026-09-13 (local)

### Follow-up audit repairs

- F01/F07: pure eligibility checks complete endpoint pairs and every additional
  area criterion. Unknown supplied places produce an empty result with a
  correction action. Five new domain/catalog tests plus desktop/phone browser
  validation cover the repaired behavior.
- F03/F05: six desktop/phone chat cases exercise success, attachment UI, closure,
  restart, failed drafts, duplicate attempts and saved-message/refresh-failure
  separation. Chat responses are mocked; this is not hosted transport evidence.
  Polling policy and route error handling have two additional tests.
- F12: persisted active administrator check precedes external Auth creation;
  two denial/authority tests and retained PostgreSQL checks cover this ordering.
  No unauthorized Auth identity was created for testing.
- F02: migration `083_tracking_proof_access.sql` applied locally. Rollback SQL
  tests passed provider/admin/recipient access, missing/wrong event, cross-
  shipment/provider, revoked recipient, expired guest, suspended provider and
  direct-browser RPC denials. Projections contain no private Storage path.
- Real local browser proof workflow passed on desktop and phone: create a
  synthetic Tracking record, upload through the status form, retrieve identical
  Storage bytes, deny anonymous access, receive a local Mailpit OTP, open the
  guest proof, revoke that recipient, deny the same URL, deny an unrelated
  provider, and open it from admin detail. Test-created records/files are
  removed. Captures: `test-results/tracking-proof-audit-*/provider-proof.png`
  and `guest-proof.png` (ignored, synthetic data only).
- Final focused batch: **10/10 Playwright cases passed**. `npm run quality`:
  **248 tests**, 28 specs, 319 source files and TypeScript passed. Optimized
  `npm run build` passed with 83 generated pages and the new proof route.
- Harness corrections: explicit guest grant in rollback fixtures, rendered-page
  wait after cold compilation, fresh test session between roles, and final
  admin landing wait before navigating.
- No commit, push, remote migration, hosted configuration change or deployment.
  Existing dirty-tree changes remain intact. F04/F06/F08–F11 and remaining F05
  history/attachment work stay open in the audit.

### Original upload-policy checkpoint

- Read-only inventory: `CURRENT_FEATURE_AUDIT_2026-09-13.md` records current UI,
  adapters, gaps and limits. Eight existing admin record types opened on both
  desktop and phone. Seven public entry pages passed basic 390px width checks.
- The audit reproduced private-route false matches with synthetic pure inputs
  and the chat's post-success reset error with mocked browser responses. These
  remain documented defects, not fixed as part of the upload change.
- BASE-DEP-001 / ADR-052 implements the owner's explicit optional-antivirus
  policy. `npm run quality` passed 28 specs, 313 source files, 237 tests and
  TypeScript. Focused scanner/storage/readiness tests: 16 passed.
- A separate local app at port 3113 loaded `validation-only`. A real browser
  submitted a synthetic verification document to isolated Supabase Storage,
  showed submission success, retrieved matching bytes as the owner, and received
  401 anonymously. One temporary vehicle, one document, its object and scoped
  synthetic audit records were removed. No production data changed.
- Test-harness corrections: a fully verified fixture has no upload form; a
  self-managed Driver submits Driver authorization for a related truck, not an
  owner-operator's vehicle-ownership subject. No production behavior was changed
  to make those assumptions pass. The temporary server was stopped and its
  generated TypeScript config changes restored.
- Remote health observed before rollout: database and private Storage connected,
  upload scanner blocker present. No remote deployment, credentials change or
  new antivirus vendor was performed. Hosted upload proof is still required.
- The optimized production build subsequently passed and generated 83 pages.

## Empty-fleet onboarding and lifecycle — 2026-09-13 (local)

- Migrations `081` and `082` applied and recorded in isolated Loadgistic local
  Supabase. Invitation records/functions are service-only; direct browser
  Driver/member/assignment writes cannot bypass the managed workflow. No remote
  migrations or deployment were performed.
- `npm run quality`: specification/source checks, all **233** Node tests and
  TypeScript passed. `npm run build`: optimized build passed, generating **83**
  pages. `git diff --check` passed. Existing unrelated work remains uncommitted
  and preserved; no broad staging, reset, or other-project change was made.
- Rollback-only `tests/sql/fleet-driver-onboarding.sql` passed invite de-duplication,
  verified-email scope, wrong/unverified email denial, expiry, cancellation,
  suspended-inviter denial, atomic membership, conservative permissions,
  assignment, stale-membership denial, contact edits, immutable truck identity,
  Company-driver/unrelated-owner denial, removal, retained history, same-fleet
  rejoin, independent-provider conflict, replay denial and browser privilege checks.
- The existing Supabase workspace/Fleet verifier passed dashboard, bounded driver
  projection, fixed and interchangeable-trailer registration, attached-trailer
  changes, atomic owner updates, audit privacy and browser denial. It restored its
  local fixture state; no remote target was used.
- **Eight focused browser checks passed:** desktop and phone complete empty-fleet
  onboarding; mobile registration/owner-vs-Company-driver access and driver/truck
  document regressions; final desktop/phone Fleet control layout. New owners and
  drivers used real local Auth email OTP, not a manually inserted Driver. Mailpit
  received invitation notifications. The visible workflow accepted the invite,
  assigned the chosen truck, saved corrected truck details, published its first
  capacity signal with device geolocation, reached Tracking and Network, edited
  contact data, removed the driver, and verified loss of workspace access.
- Test-created identities/trucks/invitations/capacity were removed by exact local
  IDs. Production and real customer records were untouched. Screenshots stay in
  ignored `test-results/`; final Fleet layouts have no horizontal page overflow,
  and permissions use compact checkboxes with full-sized touch labels.
- A test initially expected only the signup email subject; the running local
  Auth sent the valid sign-in template. The helper now accepts those two explicit
  templates while still matching the exact synthetic recipient and request time.
  No OTPs or unrelated mailbox contents were logged. A migration extraction was
  narrowed to its two Fleet functions and the unrelated local dashboard function
  restored before verification; a regression test asserts that function inventory.
- Hosted rollout remains pending: apply the reviewed `077`–`082` chain before
  the application, verify real invitation email and OTP/Google recipient acceptance,
  and test owner assignment and revocation after publication. The Google callback
  shares the verified-identity decision, but this checkpoint does not claim a new
  real Google consent run. No new mail vendor or paid service is required.

## Free access, automatic Featured, and shared loading — 2026-09-13

- `FEAT-BIL-001`, `FEAT-FTR-001`, and `FEAT-UIX-001`: migrations `079` and
  `080` applied successfully and are recorded on isolated local Supabase only.
  Admin Settings defaults to Free; the Featured policy defaults to Auto with
  eight Drivers. No production access mode, database, or hosting changed.
- Rollback-only `tests/sql/platform-controls.sql` passed active-owner/company-
  Driver free access, new-payment denial, administrator-only policy writes,
  activation confirmation, seven-day expiry, unchanged-mode idempotence, retained
  payment periods, bounded automatic selection, distinct current Drivers, manual
  draft protection, repeated-job invariance, and denied browser RPC access.
  The existing local verification/billing verifier also passed: Free rejects a
  payment, then a temporary paid-mode run proves the positive private-proof and
  review workflow, and cleanup restores Free. No actual payment is made.
- `npm run quality` passed specification/source checks, all 228 Node tests, and
  TypeScript. The optimized production build passed and generated 79 pages.
- The eight focused desktop/phone platform-control checks passed: confirmation
  UI, native POST payload/pending feedback, Auto/Manual selection changes,
  immediate preparation, provider free access, negative settings permissions,
  bounded lazy-map skeleton, reduced motion, and no horizontal page overflow.
  The existing manual-roster workflow separately passed on desktop and phone
  with three exact Drivers, an interlude, and successful publication.
  A further desktop/phone check followed automatic preparation onto the public
  Featured board, verified real Driver/truck cards, and opened working details
  with the transporter-profile action.
  Screenshots in ignored `test-results/platform-controls-*` were inspected at
  desktop and phone sizes. The activation screenshot shows an **unsaved** paid
  choice so the confirmation is visible; the saved local setting remains Free.
- Before hosted rollout, apply pending `077`, `078`, `079`, then `080`; publish
  the reviewed client and existing signed 15-minute managed-operations worker
  through GitHub/Netlify. Confirm its `featured-rosters` counts and the public
  programme remotely. No added service or paid scheduler is required. Existing
  managed-scanner, email-delivery, restore, and monitoring rollout requirements
  remain separate; this checkpoint does not claim those are complete.

Regression lessons: wait for hydrated content after streamed authentication/date
navigation, not just the URL. Use explicit labels for select controls. Capture
native-submit feedback before navigation replaces the document; holding a mobile
navigation while inspecting its old JavaScript context can deadlock the test.
Preserve submitter names/values, and never weaken count/publication assertions to
make a flaky test pass. Prepare a known test roster rather than appending forever.
The repository's React type shim needs explicit callback types and namespace
hooks; check this convention before implementing shared controls.

## Driver linkage without mandatory documents — 2026-09-13

- `FEAT-FLT-001`, `FEAT-CAP-001`, and `FEAT-VER-001`: migration `078` is
  applied and recorded only on isolated local Supabase. Publication and Open/
  Private reads require the current active Driver; no upload or approval becomes
  an access gate. Fleet rows, owned truck details, and the selected truck identify
  the Driver. Separate expandable Driver/truck document groups retain private-file
  protections and distinguish current approval from missing or expired evidence.
- Rollback-only PostgreSQL regression passed document-free publication, inactive
  identity, removed membership, inactive fleet Driver, unassignment, independent
  identity, and denied browser lookup. No document file or retained fixture was
  deleted. CI now exercises this regression after managed fixture setup.
- `npm run quality` passed all 223 Node tests, specification/source validation,
  and TypeScript. The optimized production build generated all 77 pages.
  The focused desktop/phone browser batch passed truck-to-Driver navigation,
  optional Verification access, expanded category counts without file links,
  no horizontal overflow, capacity-summary layout, and first publication.
  Screenshots are under ignored `test-results/driver-document-clarity-*`.
  These captures verify controls and content, not external map-tile availability;
  the local browser captures had unloaded third-party tile backgrounds.
- The existing 5,000-truck PostgreSQL scale check now creates 5,000 unique active
  assigned synthetic Drivers inside the same rollback. Both bounded-page checks
  passed: 15 rows, 49,260 payload bytes, 1,107.522 ms text query and 2,249.037 ms
  route query on this local machine. No synthetic truck or Auth identity remained.
  These timings are local regression evidence, not production throughput claims.
- Rollout remains pending. Apply `077`, then `078`, before deploying the client
  through the reviewed GitHub/Netlify workflow. No remote schema or hosting change
  was made. Restore previous function definitions and client for rollback; retain
  all assignments, capacity history, and review records.

Regression lessons: an assignment row is insufficient if the Driver is inactive
or no longer belongs to the fleet. Recheck eligibility on reads as well as writes.
Keep scale fixtures valid under new eligibility rules instead of weakening their
result-count assertions. Never use an empty array's `every()` result as evidence
that all documents were reviewed.

## Separate capacity actions and save recovery — 2026-09-13

- Status, coverage, sharing, load preferences, regular service, and location
  have separate labelled buttons and focused dialogs. Quick refresh remains
  independent. First publication defaults to Private; existing visibility is
  preserved. Map fitting reserves space for the rail on desktop and phone.
- A real browser test reproduced stale values when opening another dialog
  before `router.refresh()` completed. The next editor now waits for refreshed
  server facts. Consecutive status, sharing, coverage, and preference saves
  preserve each other's values. Known database validation codes now have specific
  customer messages; unexpected diagnostics contain only operation/error codes.
- `npm run quality` passed all 221 Node tests and TypeScript. The optimized
  build passed. Twelve distinct focused desktop/phone scenarios passed across
  the main run and the four-case layout rerun. The latter corrected and retested
  a phone header/rail overlap without weakening the no-overlap assertions.
- Real local writes cover Empty/Partial/Off Duty, first publication, regular
  service, location, visibility, and pickup/drop-off settings; unknown-error
  redaction uses a mocked database response, and browser retry uses one mocked
  failure. A real authenticated invalid Partial-area request returns an actionable
  route message. Anonymous mutation and owner-location restrictions remain tested.
  The narrow 320×640 map and dialog screenshots were visually inspected.
- The user's exact generic save failure did not reproduce on the local fixture;
  its local-versus-hosted origin remains unconfirmed. Do not claim that changing
  error copy proves the reported backend failure is fixed. No hosted schema,
  Netlify deployment, or new migration was changed in this follow-up.

Regression lessons: test actual status changes, not just a visibility toggle in
the status dialog. A successful HTTP mutation is not completion of the subsequent
server-state refresh. Separating Sharing from first publication must not silently
make the first signal public. Expanding a floating rail requires matching header
and map-padding changes, with geometric no-overlap checks on phones.

## Focused capacity dialogs — 2026-09-13

- `FEAT-CAP-001` / `FEAT-UIX-001`: Driver Home and Fleet truck details keep
  their map mounted behind native Current capacity, Current coverage, Regular
  service, and Approximate location dialogs. Edit all is removed; the dock's
  radius shortcut opens the Location dialog and quick refresh stays on the map.
- `npm run quality`: 28 specs, 25 features, 284 source files, 219 Node tests,
  and TypeScript passed. The optimized build generated all 77 pages.
- Focused desktop/phone browser scenarios passed for modal semantics, retained
  map nodes, discarded drafts, focus restoration, JSON saves, retry after a
  simulated failed response, unchanged pickup/drop-off preferences, saved regular
  service inputs, real location updates, first publication, Empty-area-to-Partial
  conversion, owner-only capacity editing, and anonymous mutation denial. The
  existing capacity-summary regression passed on desktop and phone. The narrow
  regular-service dialog was additionally checked at 320×640 with visible footer
  controls and no horizontal document overflow. Screenshots are produced by
  `tests/e2e/capacity-signal-dialogs.spec.ts` under ignored `test-results/`.
- Local migration `077` is applied and recorded. The real, local-only provider
  capacity verifier passed timestamp/coordinate preservation, owner isolation,
  anonymous RPC denial, successful regular-service replacement, rollback on
  invalid replacement, and fixture restoration. Only the error-retry browser
  case uses an injected response; successful saves use actual local Supabase.
- Rollout remains pending: no Production schema or Netlify deployment was changed
  for this task. Apply `077` before publishing the client through the reviewed
  GitHub promotion pipeline. Existing native POST redirects remain compatible.

Regression lessons: `role="dialog"` on a replacement page is not a modal; keep
the map in one stable render tree and use the native top layer. Read a form's
action with `getAttribute('action')` because a named action input shadows the DOM
property. Never treat a whole-record save as a focused edit without preserving
unopened flags and the actual Driver-location timestamp. Validate real browser
saves, not just button appearance or compilation.

## GitHub Production promotion and infrastructure hardening — 2026-09-11/12

- Release commit `b3a17c2` upgraded Next.js to `15.5.25`, Nodemailer to `9.1.1`,
  and Sharp to `0.35.4`; `npm audit --audit-level=high` reported zero known
  vulnerabilities. `npm run quality` passed 28 specifications, 25 feature
  records, 281 source checks, 218 Node tests, and TypeScript. The optimized
  77-page build and focused desktop/mobile Tracking-navigation regression also
  passed locally.
- GitHub PR `#11` passed CI run `34643293438` for the exact release commit:
  clean Supabase replay and managed verification, the rolled-back 5,000-truck
  PostgreSQL fixture, optimized build, full desktop/mobile Playwright suite, and
  standalone container build. It merged to `main` as `787b5526`; post-merge CI
  run `34647400977` passed the same validation, browser, and container jobs.
- The existing Netlify site now uses GitHub continuous deployment through a
  read-only deploy key and push/PR webhook. `main` is the Production branch.
  Production deploy `6aa46d24c2d4c6876a354c13` published merge commit
  `787b5526` at `https://loadgistic-473.netlify.app`. Live health returned `200`
  on `supabase-postgres`; Open capacity returned data; Featured returned `200`;
  and independent Adama/Hawassa place searches returned the requested city
  first.
- A fresh encrypted logical backup and independent encrypted Storage-object
  export preceded the hosted changes. The Storage export restored into the
  isolated stack and matched its source object checksum. The database backup
  authenticated successfully but an actual isolated database restore remains a
  release gate.
- Hosted migrations `074`–`076` applied cleanly and local/remote histories match
  through `076`. All seven buckets remain private and enforce 4 MiB. Database
  SSL enforcement is enabled. Nineteen hot-path indexes reduced observed
  unindexed foreign keys from 93 to 74. Remote error-level SQL lint reports zero
  Loadgistic application-function findings; six remaining diagnostics are from
  installed PostGIS extension functions.
- Production health truthfully retains `upload-malware-scanner` as its only
  readiness blocker and keeps bounded-pilot warnings for SMTP delivery and the
  community OpenStreetMap tile service. Application uploads remain fail-closed
  until a hosted scanner is configured and proved.

## Production cache, roster, and infrastructure audit — 2026-09-08/09

- Commit `e880764` passed 215 Node tests, specification/source validation,
  TypeScript, the optimized 77-route build, and a zero-high-vulnerability npm
  audit. Netlify Production deploy `6aa06084e223ccf14c9bb72a` published that
  exact commit at `https://loadgistic-473.netlify.app`.
- Live place searches for Addis Ababa, Adama, Hawassa, Mekelle, and Bahir Dar
  returned independent matching suggestions. Open-capacity base and selected
  filter queries returned independent bounded results; query-sensitive place
  and capacity responses were private and non-storable rather than shared CDN
  hits. Anonymous admin/member access redirected to Login, private-file probes
  returned `404`, retired Directory search returned `410`, and the public
  response included CSP, HSTS, clickjacking, MIME, referrer, and permissions
  headers.
- A fresh AES-256-GCM logical backup was authenticated before the current-day
  Featured repair. Its encrypted artifact is 1,252,753 bytes with SHA-256
  `be2772cbc7ab0e43723d8a7b87716d1daf8d513e3daaf1dcbc620e85d7e290b8`;
  neither artifact nor key is tracked. The exact-project-guarded transaction
  published eight eligible truck/Driver slots for the current Ethiopia day.
  Live desktop and phone Chromium then rendered all eight cards, portrait
  slots, and public map signals without broken images, browser errors, or
  horizontal overflow.
- The linked Supabase project matches the isolated stack through migration
  `073`. A read-only Production audit confirmed PostgreSQL 17, seven private
  Storage buckets, custom Auth SMTP, six-digit ten-minute OTPs, refresh-token
  rotation, Google enabled, and no anonymous Auth. It also found SSL enforcement
  disabled, direct-database allow-all IPv4/IPv6 network ranges, CAPTCHA disabled,
  one Security Advisor error plus warnings, and 252 Performance Advisor items
  dominated by unindexed foreign keys and RLS-policy planning/duplication.
- Both Netlify scheduled dispatchers and both background workers are deployed
  and invoked. A real pending application-email delivery is still unproved.
  The Netlify site remains manually deployed rather than Git-linked. Production
  health truthfully stays `readyForPublicProduction:false` because no managed
  malware scanner is configured; every upload fails closed. The application's
  10 MB file promise also exceeds Netlify's effective buffered binary request
  limit and must be lowered or redesigned before uploads are enabled.
- The database backup protects PostgreSQL/Auth/Storage metadata but not Storage
  object bytes. A separate encrypted object export and an isolated restore
  rehearsal remain required. Daily Featured also needs a deliberate next-day
  publishing operation; Production does not silently substitute an automatic
  roster. Assisted matching currently reports zero available team members.

## Production pilot import — 2026-09-05

- The operator explicitly approved an additive hosted import of 152 synthetic
  Transporter/Driver identities, 143 trucks with current Capacity signals, and
  eight current Daily Featured slots. The importer initially failed closed
  because Production had no active administrator. After separate operator
  confirmation, one existing confirmed, association-free operator identity was
  promoted to the sole active administrator; no synthetic administrator or
  Support identity was created.
- The exact-project-confirmed importer wrote 3,691 places, 152 profiles, nine
  fleet organizations, 21 independent provider profiles, 30 public provider
  pages, 143 trucks, 143 active Driver assignments and current Capacity
  records, 335 verification records, one published Featured day with eight
  truck/Driver slots, and four current Sponsor placements. Pilot identities use
  the deterministic `loadgistic-production-pilot-v1` namespace, reserved
  non-deliverable addresses, and random unrecoverable credentials.
- An independent service-role verifier found exactly 152 namespaced Auth
  identities: nine Transporters and 143 Drivers, with zero pilot Admin, Support,
  or unknown roles. It also confirmed 152 active pilot profiles, 143 trucks, 143
  Capacity records, one published Featured day, eight slots, and the private
  pilot Storage object. The live bounded Capacity endpoint returned 14 items and
  `/featured` rendered all eight cards, both with HTTP `200`.
- Headless Chromium verified the live Netlify desktop and 390-by-844 phone
  states. Both rendered map signals and all eight Featured cards with zero
  broken truck, marker, or portrait images. The pre-change encrypted backup and
  deterministic exact rollback remain available. Production health still
  truthfully reports the managed upload-malware-scanner as the remaining launch
  blocker.

## Hosted signup plan-catalogue correction — 2026-09-05

- A real hosted signup reached verified provider details but the atomic
  provisioning command rejected it. A sanitized read-only diagnostic proved the
  confirmed identity remained inactive, association-free, and retry-eligible;
  it also found zero active Business, Transporter, or Driver plans. No partial
  workspace, application, or provider profile was created.
- `072_required_plan_catalog.sql` installs the three minimum plans independently
  of optional demo fixtures and uses `ON CONFLICT DO NOTHING`, so replay neither
  duplicates a plan nor reactivates one deliberately disabled by an operator.
- Five focused signup contracts and TypeScript passed. A clean isolated local
  reset replayed migrations through `072`, rebuilt 154 profiles and 143 trucks,
  and passed every managed Auth/signup, capacity, Tracking, Storage,
  Verification/Billing, Support, Fleet, and administrator verifier. The complete
  spec/source, unit, TypeScript, and optimized 77-route build gate also passed.
- Before the hosted change, an encrypted AES-256-GCM logical backup of the
  linked public/Auth/Storage data was created, decrypted in memory for integrity,
  and checksummed without printing its contents or key. Hosted migrations
  `070`–`072` then applied in order. A second sanitized diagnostic found exactly
  one active Business, Transporter, and Driver plan and confirmed the failed
  identity is still clean and eligible to retry.
- Commits `28d51a3` and `d2f185c` were pushed to the production-readiness
  branch. Netlify manual Production deploy `6a9c4531a3128740b2261c13` completed
  with the maintained Next.js runtime. Live requests returned `200` for health,
  Login, and the new tractor asset; an unauthenticated `/apply` correctly
  returned `307` to Login. Health confirms Supabase PostgreSQL and Storage but
  still reports the managed Production upload-malware-scanner as a launch
  blocker. The separately guarded synthetic Production-pilot import remained
  gated at this checkpoint and was completed in the rollout recorded above.

### Deployment lesson

- A production schema can be structurally complete while a required domain
  catalogue is empty. Provider signup and release smoke checks must verify the
  active Transporter and Driver plan preconditions independently of demo-market
  import; optional fixture data must never be the only source of an operational
  signup dependency.

## Demo market geography correction — 2026-09-04

- The credential-free 143-truck fixture now distributes approximate locations
  through weighted Ethiopian freight markets and 64 real named cities, towns,
  or localities. No exact locality contains more than five source trucks, each
  large demo fleet spans at least ten operating locations, and the former
  repeated latitude-plus/longitude-minus diagonal offset is absent.
- After the managed visibility policy, 33 trucks are Public Market supply
  across 24 exact named locations with no more than three public trucks at one
  locality; the remaining 110 exercise Private capacity. Current routes and
  Service areas remain close to the declared approximate truck location.
- Twenty-seven clustering, capacity-market, and fixture tests passed together.
  Specification validation and TypeScript passed, and the focused map workflow
  passed in desktop and mobile Chromium. A follow-up city-level correction made
  clustering cells at least as wide as full markers, replaced the maximum-zoom
  overlapping marker ring with a bounded truck chooser, and distributed private
  fallback markers along their public regular-service geometry. A port-3001
  phone probe reached an individual truck with zero remaining marker overlaps.
- The isolated local Supabase fixture was rebuilt with 3,692 place rows and the
  expected 143 Capacity signals. Fixture, Shared capacity, provider Capacity,
  provider Tracking, and provider-signup live verifiers passed; the aggregate
  verifier later stopped on pre-existing rate-limit cleanup residue unrelated
  to fixture geography.
- Focused screenshots are under `artifacts/demo-geography-v1/`. Expensive
  full-suite, build, release, and remote gates remain pending visual approval.

## Administration and truck-registration checkpoint — 2026-09-03

- Additive local migrations `066_provider_vehicle_registration_and_admin_details.sql`
  and `067_admin_overview_counts.sql` applied to the isolated Supabase stack.
- The Fleet verifier created one fleet-owned and one independent-provider truck,
  proved immutable owner scope and no inferred Capacity/location/assignment
  state, denied a Company driver and anonymous browser roles, and removed its
  test records. The platform verifier opened all eight bounded record-detail
  projections, including a Tracking event timeline, and denied anonymous access.
- Eighteen focused contract tests, TypeScript, specification validation, and
  source validation passed. Desktop and phone browser workflows passed for
  provider-owner truck registration, the compact Administration Overview, and
  every Users/clients/trucks/Drivers/Tracking/Capacity/routes/plans detail route.
- Focused screenshots are under `artifacts/admin-management-v1/`. Expensive
  full-suite, optimized build, release, and remote migration gates remain
  pending explicit visual approval.

## Private capacity eligibility correction — 2026-09-03

- `node --test tests/private-capacity-network.test.mjs`: five tests passed,
  including the response contract that advances to code verification only for
  a queued eligible challenge.
- `npm run typecheck` and `npm run check:specs`: passed.
- The focused Private capacity workflow passed on desktop Chromium and mobile
  Chromium. An unshared email remained on the email step, showed the bounded
  no-share result, rendered no one-time-code field, and then an actively shared
  email completed the Mailpit OTP flow and opened the private map.
- Focused no-share and active-session screenshots are under
  `artifacts/private-capacity-assisted-chat-v1/`. Full release gates remain
  visual-approval gated.

## Account-access reconciliation — 2026-09-03

- Recent local Supabase Auth evidence showed that Google PKCE and email OTP
  succeeded upstream while exactly two confirmed pre-trigger test identities
  were rejected by Loadgistic because they lacked a profile projection.
- Guarded migration `065_reconcile_prebootstrap_auth_profiles.sql` applied to
  isolated local Supabase and repaired exactly those two role-free,
  association-free identities as inactive DRIVER bootstraps. Both now pass the
  provider-signup eligibility boundary.
- A sanitized browser probe completed the email-code flow for one repaired
  account through local Mailpit and reached `/apply?step=details`; neither the
  address nor code was printed.
- Google initiation reached Google's standard identifier page, and the recent
  provider log showed successful Google authorization and PKCE exchange. A
  human account-selection pass remains required to prove the repaired browser
  callback end to end.
- The focused 23-test identity, signup, rate-limit, and Private capacity set,
  TypeScript, and specification validation passed. Automated browser requests
  now use a distinct local client bucket so test runs do not exhaust a
  developer's manual OTP allowance.

## Verification lessons that must not regress

- A successful server-side OAuth redirect chain does not prove the browser
  button works. The visible control must be clicked in a real browser because
  CSP, cookie, navigation, and popup policies are browser-enforced.
- Supabase Auth email and application-owned Shared-capacity/Tracking email are
  separate delivery paths. Each path must prove delivery at its intended inbox;
  configuration or SMTP authentication alone is not delivery evidence.
- Shared-capacity OTP verification requires an active provider grant for the
  tested email. Browser evidence must create or identify that precondition and
  verify the code, not merely assert that the request endpoint responded.
- Mailbox APIs contain contact data and live access codes. Diagnostics may emit
  only sanitized counts, status, and pass/fail results—never raw messages,
  recipients, links, codes, cookies, or provider credentials.

## Release evidence

- Supabase cutover checkpoint (2026-08-24): a clean isolated local reset replayed migrations `001`–`036`; the guarded local fixture import created 154 Auth users, 143 trucks/Capacity signals, 335 verification records, and 3,703 place rows; `npm run db:supabase:verify` proved password login, private Storage, expected counts, and anonymous-write denial; and `tests/supabase-fixtures.test.mjs` proved remote-import refusal, explicit reset confirmation, area-route integrity, and least-privilege migration text. Supabase SQL lint completed; its reported findings are extension-owned PostGIS diagnostics rather than Loadgistic application functions. The application runtime cutover is still pending.
- Managed identity checkpoint (2026-08-24): migration `037` applied locally; fixture verification proved the `auth.uid()`-bound company-Driver role/subscription projection; TypeScript passed; and a real Next.js request check proved `303` login, an HTTP-only Supabase session cookie, authenticated `/login` redirection, and `303` logout. Normal application traffic remains on the cutover adapter until PostgreSQL repository parity passes.
- Managed read/readiness checkpoint (2026-08-24): managed login and role-access evaluation no longer load the SQLite repository; `/api/health` returned `200` with `supabase-postgres` and 154 profiles; `/api/places?q=Addis%20Ababa` returned the bounded public place projection; and the deterministic fixture verifier exercised the same Supabase place adapter. Focused tests prove production service-role configuration is fail-closed and exact place matches cannot be displaced by population. Truck Market and mutation parity remain pending.
- Managed Truck Market checkpoint (2026-08-24): a clean local reset replayed migrations `001`–`038`, the deterministic fixture importer rebuilt all Auth/PostgreSQL/Storage records, and the live verifier passed bounded cursor, duplicate prevention, status/route matching, safe Driver/truck badge shape, private-current geometry removal, and anonymous RPC denial. A real Next.js Supabase runtime returned `200` for `/`, returned two distinct 14-row Partial pages, and emitted no SQLite runtime warning. A rolled-back 5,000-truck PostgreSQL transaction returned a 15-row look-ahead page in 375.574 ms and a Service-area-filtered page in 653.943 ms; all synthetic scale rows were absent after rollback. These are local single-query measurements, not Preview concurrency evidence.
- Managed transporter-microsite checkpoint (2026-08-24): migration `039` applied locally; the fixture verifier passed fleet and independent-provider public projections, current Driver/document completeness, unknown-handle denial, and anonymous review-aggregate RPC denial. A real managed Next.js runtime returned `200` for `/providers/blueline-transport` and `/providers/abebe-owner-operator`, `404` for an unknown handle, and the expected optional-image `404` for a fixture using its public preset portrait. The rendered pages contained current fleet, Driver kind, Driver/truck document, and capacity-map controls without a SQLite runtime warning. TypeScript passed.
- Managed Daily Featured checkpoint (2026-08-24): a clean local reset replayed migrations `001`–`040`; fixture verification proved a published regional roster, one walkthrough per projected provider, safe public keys, and anonymous candidate-RPC denial. The managed adapter returned the three-provider Addis Ababa roster, four ordered Sponsors including one outside advertiser, and five schedule entries. A real Next.js runtime returned `200` for `/featured` and rendered the roster, Sponsors label, Sponsored disclosure, and advertiser without a SQLite runtime warning.
- Managed provider-runtime checkpoint (2026-08-24): a fresh local database replayed migrations `001`–`044`; the guarded configurator rebuilt 154 Auth identities, 143 trucks/Capacity signals, 335 verification records, and 3,703 places. With SQLite disabled, dedicated verifiers passed Shared-capacity grant/OTP/leased-delivery/private-map/Operations/revocation, provider Capacity workspace/publication/location/duty/regular-service authorization, and provider Tracking create/cross-provider denial/location/review/leased-email/30-day cleanup. The clean run exposed and fixed a generated-column fixture-restore error and an ambiguous cleanup identifier before remote migration.
- Managed provider-signup checkpoint (2026-08-24): a second clean database replayed migrations `001`–`045`; the complete local configurator rebuilt the same fixture and passed all prior verifiers plus inactive Auth-profile bootstrap, 15-minute server-only intent, atomic Owner-operator workspace/draft-page/approved-application/seven-day-trial creation, duplicate denial, and anonymous RPC denial. The public route collects no password and hands only an opaque HttpOnly token to the fixed Google callback. Four focused desktop/mobile browser checks passed for the signed-out signup handoff and signed-in provider navigation.
- Managed email/operations checkpoint (2026-08-26): a clean isolated database replayed migrations `001`–`046`; the date-safe importer rebuilt 154 Auth identities, 143 current truck signals, 335 verification records, and 3,703 places; all five managed verifiers passed. Migration `046` leased only customer-safe completion timeline fields. Focused tests passed direct Resend and HTTPS-webhook adapters, stable idempotency, escaped templates, secret exclusion, bounded scheduled counts, safe error redaction, service-role-only queue access, and the 15-minute UTC schedule. No remote sender or live delivery is claimed.
- Managed signup identity checkpoint (2026-08-27): transporter signup now uses the same Google or six-digit email-code choices as managed login, but proves identity before collecting provider details and binds an email handoff to the same authenticated email. A new Supabase identity remains inactive until atomic provider provisioning succeeds. TypeScript, specification validation, the focused auth/signup/fixture tests, the optimized build, and the focused desktop/mobile signup browser workflow passed. The isolated local Supabase runtime delivered a numeric signup message to its local-only Mailpit sink and passed OTP verification, inactive bootstrap, atomic workspace/draft-page/approved-application/seven-day-trial creation, duplicate denial, and browser-role RPC denial. No hosted or Gmail delivery is claimed. Production password login remains disabled; fixture passwords require an explicit non-Production flag.
- Local workspace isolation checkpoint (2026-08-27): Loadgistic now reserves `http://127.0.0.1:3100` across its development command, ignored environment configurator, local Supabase Auth allowlist, Playwright, UI audit, stress audit, and capture defaults, while leaving the separate MirtPage service on port `3000` untouched. The local Supabase stack restarted with the corrected configuration, the deterministic fixture refreshed today’s six-provider Tigray/Afar roster, the Featured page returned six portrait tiles with no empty placeholder, desktop/mobile focused captures passed, and the local numeric signup verifier passed again after restart.
- Shared rate-limit checkpoint (2026-08-27): additive migration `047` applied to the isolated Loadgistic stack. Twelve concurrent adapter calls against one three-request window allowed exactly three, returned bounded retry times for the remainder, stored only one HMAC digest, denied anonymous table/RPC access, and removed the expired row through bounded scheduled cleanup. Focused Node tests and TypeScript passed. Preview concurrency and public-discovery/review coverage remain rollout work.
- Private-upload security checkpoint (2026-08-27): additive migration `048` applied to the isolated Loadgistic stack and created a server-only private quarantine bucket. The live verifier released a signature-valid clean PNG to its purpose bucket, read it through the storage adapter, rejected an EICAR-marked PDF before release, emptied quarantine after both paths, and proved anonymous list/download denial with a service-role sentinel. Focused tests prove neutral upstream filenames, strict Cloudmersive advanced-scan flags, explicit-clean-only acceptance, fail-closed timeout/quota/malformed responses, local-test/Production separation, and secret exclusion. No hosted scanner call or remote upload is claimed.
- Managed transporter-profile checkpoint (2026-08-27): additive migration `049` applied to the isolated Loadgistic stack. The live verifier read an owner-scoped editor projection, saved the existing structured base and public-contact choices transactionally, uploaded a quarantined/scanned profile image, projected only its application URL, removed the image and released object, denied a Company driver, denied the anonymous RPC, and confirmed audit details contained no contact values. Focused tests prove the active routes import the managed application port rather than SQLite and the functions are bounded, audited, and service-role-only.
- Managed workspace/Fleet checkpoint (2026-08-27): additive migration `050` applied to the isolated Loadgistic stack. The live verifier read bounded owner-scoped Driver/assignment/permission summaries, atomically reapplied a Driver's current truck assignment and Capacity/Tracking permissions, read the bounded workspace dashboard, denied a Company driver and the anonymous role, and confirmed the audit event contained no Driver contact. Focused tests and TypeScript passed with SQLite disabled. Hosted migration and concurrency evidence are not yet claimed.
- Managed Verification/Billing checkpoint (2026-08-28): additive migrations `051`–`053` applied to the isolated Loadgistic stack. The live verifier submitted and reviewed actor-scoped Verification and payment-proof records, authorized private files only through server-side commands, hid Storage paths from review projections, enforced terminal audited decisions, denied anonymous RPC access, and confirmed a successful payment renews the provider for 30 days. Focused regression tests, the complete quality gate, and the optimized 74-route build passed. Hosted migration and remote private-Storage evidence are not yet claimed.
- Managed Support/Assisted-matching checkpoint (2026-08-28): additive migrations `054`–`056` applied to the isolated Loadgistic stack. The live verifier proved member and account-free conversation creation, atomic least-loaded assignment across both queues, assigned-agent and administrator scope, bounded history/inbox projections, private attachment reauthorization, terminal closure, passwordless Support-agent provisioning, complete platform-team permission scope, and anonymous RPC denial. Five focused runtime tests and the desktop/mobile Assisted-matching browser workflow passed. The complete quality gate and optimized 74-route build also passed; hosted Realtime and remote private-Storage evidence are not yet claimed.
- Managed-only identity and retired-Directory checkpoint (2026-08-29): Supabase Auth is now the sole identity runtime for local development, browser tests, Preview, and Production. The explicitly local fixture-password form authenticated an isolated Supabase Auth Driver in a focused browser workflow; no signed-cookie or SQLite identity fallback remains. Live local requests proved `/app/providers` and `/companies` collection links preserve name searches into the Truck Market, their detail links preserve the exact public microsite handle, and the retired member-directory search API returns `410 Gone`. Three focused boundary tests, the complete quality gate, and the optimized 74-route build passed.
- Managed platform-administration checkpoint (2026-08-29): additive migration `057` applied to the isolated Loadgistic stack. The live verifier exercised bounded counts and paginated projections across all eight Operations inventories, denied an ordinary member and the anonymous browser role, proved delegated Customer-only scope, and reversibly exercised account/truck activation, Driver permissions, route removal, subscription paid/expiry/sponsorship, Featured roster publication, Sponsor overlap denial, and Sponsor disable. Every command committed its audit atomically, and active Operations/Featured/Sponsor routes no longer import the SQLite repository.
- Unconditional managed-runtime checkpoint (2026-08-29): active application facades, health, request limiting, private uploads, the scheduled worker, the browser-test server, and the standalone container now use Supabase without data or Storage backend selectors. Missing PostgreSQL, private Storage, or shared-counter configuration fails closed; local files, process-local counters, and SQLite health fallback cannot be selected. A clean guarded fixture refresh rebuilt 154 Auth identities, 143 current truck signals, 335 verification records, and 3,703 places, then every managed verifier passed. The complete quality gate passed 164 Node tests, the optimized 74-route build completed without a SQLite runtime warning, and 16 critical desktop/mobile browser checks passed across the public Market, location, provider profile, Tracking, and Driver Capacity workflows. The dormant monolithic repository/database and SQLite-derived fixture transformation remain the next isolated removal.
- PostgreSQL-only development checkpoint (2026-08-29): the retired local database/repository, transformation, reset, place-import, stress, Tracking-fixture, and duplicate integration-test paths were removed. `resources/fixtures/managed-market.json` now supplies credential-free, demand-free, machine-path-free records directly to isolated Supabase Auth/PostgreSQL/Storage. A newly empty local Docker volume replayed migrations `001`–`057`; the guarded importer rebuilt 154 Auth identities, 143 current truck signals, 122 Drivers/assignments, 335 verification records, 3,703 places, and the current Ethiopia Featured/Sponsor programme. Every managed live verifier passed. The current quality gate passed 126 focused domain/managed-contract tests, the optimized standalone build passed, and all 16 critical desktop/mobile browser workflows passed on isolated port `3110` while the developer server remained untouched.
- Guest-access and Tracking-security checkpoint (2026-09-01): a newly empty
  isolated Supabase database replayed migrations `001`–`058` in order, rebuilt
  the managed fixture, and passed every guarded live verifier. Migration `058`
  excluded expired, used, superseded, and attempt-locked Shared capacity
  challenges from delivery, rechecked them immediately before submission,
  removed terminal challenge/delivery rows after the bounded retention window,
  preserved Assisted matching recovery mail, and denied browser roles. Focused
  checks also proved the six-digit, ten-minute, single-use Shared capacity
  application OTP and the stable 80-bit Tracking owner/review codes derived from
  a distinct `TRACKING_CODE_SECRET`; changing `SESSION_SECRET` does not change
  those Tracking codes.
- Application-email and managed-worker checkpoint (2026-09-01): tests proved
  escaped Shared capacity and Tracking templates, preferred Resend delivery,
  bounded authenticated SMTP with stable non-secret Message-IDs, the optional
  HTTPS webhook, and fail-closed incomplete configuration. The 15-minute
  Netlify dispatcher signs a timestamp-bounded HMAC request to a background
  worker; unsigned and stale calls are rejected with a timing-safe comparison,
  authorized work returns no private result body, and the worker runs the
  bounded email and retention operations once. This is local source/test
  evidence, not a deployed-worker or remote application-email claim.
- Hosted-auth control-plane checkpoint (2026-09-01): the hosted Supabase Auth
  Site URL/callback, separate Google client, numeric login/signup templates, and
  Gmail SMTP are configured, and one real account Auth OTP was received and
  verified. The Netlify application still returns `404`, the hosted application
  database remains empty, and Netlify has no configured application-email SMTP;
  therefore no deployed application, Google/signup workflow, Shared capacity
  OTP, Tracking email, or Assisted matching email is claimed.
- Targeted access-email hardening checkpoint (2026-09-01): additive migration
  `059` was applied to the isolated local stack and the Shared capacity live
  verifier passed. Focused tests prove one-row just-in-time claims, Shared-first
  priority, live-lease fencing for Shared capacity and Assisted matching, a
  30-second final OTP validity margin, truthful handling when provider success
  cannot be acknowledged, and authenticated background dispatch for the
  two-minute retry. A subsequent newly empty local reset replayed migrations
  `001`–`059` in order, rebuilt the managed fixture, and passed every guarded
  live verifier. This is not a remote application-email delivery claim.
- Local Auth runtime checkpoint (2026-09-02): a live application on port `3001`
  returned `200` for health, login, and signup entry points. One existing-login
  and one temporary-signup numeric-code request each returned a generic `303`,
  `Cache-Control: no-store`, and increased the isolated Mailpit count by exactly
  one without reading or exposing a recipient, message, or code. The temporary
  Auth identity was deleted. Login and signup Google routes used PKCE, loaded
  the configured local Web client, requested only `openid email profile`, and
  generated the expected local Supabase and same-origin application callbacks
  after the host-preservation correction. A focused follow-up bound Login or
  Signup to a signed, HTTP-only PKCE-flow intent, removed the flow selector from
  the callback URL so the exact hosted allowlist remains valid, proved stale
  Signup state is cleared when Login starts, and rejected a mismatched callback
  with generic output while clearing both handoffs. The sanitized authorization
  chain reached Google with no redirect, client, access-block, or deleted-client
  error signal; completing consent with a real account remains a manual check.
- Netlify configuration checkpoint (2026-09-02): the reviewed application,
  Supabase, session/Tracking, fixture-disable, and application-SMTP variables
  are present in the Production context. Sensitive values are marked secret;
  the Netlify Free scope boundary necessarily includes Builds, Functions, and
  Runtime for those secrets, while harmless values use all scopes. A bounded
  authenticated-SMTP handshake passed without sending a message. The site still
  returns `404`, the hosted database remains empty, and neither application
  execution nor remote application-email delivery is claimed.
- Visible external-flow correction (2026-09-02): clicking Continue with Google
  in Chromium exposed a CSP failure that a server-only redirect check had
  missed. The corrected policy permits only the validated Supabase origin and
  fixed Google account origin, fails closed for insecure configuration, and a
  fresh visible click reached Google's account screen with no failed browser
  navigation. The standard local configurator now supplies a development-only
  loopback Mailpit adapter for application-owned email. A real Shared-capacity
  UI request created no Auth account, arrived in Mailpit, and its six-digit code
  opened the private map. A separate account-code UI request also arrived in
  Mailpit. The focused 38-test auth/header/email/private-capacity set,
  TypeScript, specification validation, and diff checks passed. Selecting a
  personal Google account and completing consent remains an owner interaction.

- The consolidated post-configuration specification/source, unit, type, and
  production-build gates are being rerun. Their new aggregate counts belong in
  this record only after that run completes; dated evidence above remains
  historical evidence rather than a current-count claim.
- `docker build --tag loadgistic:local-supabase-only .`: passed. The pinned
  Node 22.16.0 multi-stage image rebuilt all 74 routes and copied only the
  standalone runtime, public assets, and static chunks into the non-root runner.
- `npm run test:e2e`: 50 workflows passed and two explicitly opt-in screenshot captures were skipped across desktop Chromium and mobile Chromium. Coverage includes Map-first public discovery, automatic visitor location, regional centering, denial/retry behavior, live accessible suggestions, route and Service-area matching, stable close-zoom cluster separation, responsive non-scrolling selected cards, bounded List pages, provider pages, dynamic featured schedules, current Driver permissions, provider-owned Tracking, the unified capacity summary, retired demand routes, and credential-safe login.
- `npm run test:a11y`: 12 desktop/mobile accessibility workflows passed. Serious and critical WCAG 2 A/AA, 2.1 AA, and 2.2 AA findings are scanned across public, transporter, Driver, administrator, and support routes; keyboard dialog operation, Escape dismissal, opener-focus restoration, and 320-pixel reflow are asserted. Leaflet's spatial marker pane is excluded only from the target-size rule because markers are already large, can straddle the active viewport, and have an equivalent Truck List; every other rule continues to inspect the map.
- `npm run test:ui-stress`: 84 dense-data desktop/mobile screens passed with zero failures, including bounded Truck List pagination and current Admin Tracking inventory.
- `npm run test:ui-audit`: 86 desktop/mobile screens were captured across logged-out, fleet-owner, self-managed Driver, company Driver, administrator, and support-agent views with zero automated layout/accessibility flags and zero browser-flow errors. Every visible Leaflet map rendered real tiles before capture.
- `npm audit --audit-level=high`: zero known vulnerabilities.
- Automated map workflows and visual capture verified the visible map key, vehicle-image markers, close-zoom separation of overlapping trucks, selected-only approximate-location/current/two-way-regular-corridor layers, responsive detail card, responsive List cards, and restoration of the clustered market after close.

## Focused Market evidence — 2026-08-15

- `npm run check:specs`: passed with 26 specifications and 23 features.
- `npm run typecheck`: passed.
- `node --test tests/capacity-market.test.mjs`: 21 tests passed.
- Focused Playwright Market workflows: six desktop/mobile checks passed for independent route endpoints, map-only bounded loading, status-specific clustering, bounded cluster membership, and non-overlapping status labels.
- Focused desktop and phone captures are under `artifacts/focused-2026-08-15-market-final/`. The full release, accessibility, stress, and visual-audit gates have not been rerun for this uncommitted batch.

## PostgreSQL scale evidence — 2026-08-29

- `npm run test:scale` inserted 5,000 additional supply-only vehicles and
  current signals inside one isolated PostgreSQL transaction.
- The server-only public projection returned its bounded 15-row look-ahead page
  in 320.124 ms with a 41,295-byte payload. The PostGIS origin/destination route
  filter returned 15 rows in 590.971 ms.
- The transaction rolled back and the harness proved zero `LG-SCALE-*` vehicles
  remained. It refuses any local project ID except `loadgistic-local` and any
  scale below 5,000 or above 10,000.
- These are local single-transaction measurements, not Preview concurrency or
  sustained hosted-load evidence. The existing CPU-throttled mobile workflow
  continues to bound background cursor loading and rendered map records.

## Private capacity and Assisted matching evidence — 2026-08-15

- `npm run check:specs`: passed with 28 specifications and 25 features.
- `npm run check:source` and `npm run typecheck`: passed.
- `node --test tests/capacity-market.test.mjs tests/private-capacity-network.test.mjs`: 25 tests passed.
- `npm run build`: optimized production build passed with the Shared capacity,
  Network, private Operations map, guest Help/chat, team Assisted matching, and
  attachment routes.
- Four focused desktop/mobile browser workflows passed. They exercise a guest
  creating a conversation, immediate assignment to the bounded Support team,
  a team reply appearing in the guest thread through the two-second refresh,
  the account-free Shared capacity gate, and the provider Network page.
- Two capture workflows passed on desktop and mobile. Screenshots of Assisted
  matching entry, the compact live thread, and Network are under
  `artifacts/private-capacity-assisted-chat-v1/`. The expensive full-site audit
  remains approval-gated.

## Deterministic local market

- 30 published transport providers: nine fleets and 21 self-managed providers.
- 143 active current-capacity signals, with at least nine in every seeded regional market and a 70-percent local-delivery vehicle cohort using road-connected routes or compact Service areas within 30 kilometres.
- 30 regular-service signals: exactly one Service area or Capacity route for each published provider, with application and database rejection of a second.
- Future-trip and regular-area persistence tables: absent after migration.
- Distinct Driver-selected approximate-location radius levels represented: five.
- Legacy demand shipments remaining after the local migration: zero.

## Release boundary

The historical evidence above is retained for chronology; the current
application, local development, CI, fixtures, browser workflows, and scale gate
all use Supabase/PostgreSQL. The linked hosted project has the reviewed
`001`–`076` migration chain, seven private 4 MiB Storage buckets, and the explicitly
approved synthetic Production pilot. The encrypted Storage export passed an
isolated restore; an actual database restore remains outstanding. Unrestricted
Production remains blocked on a remotely proven managed upload scanner, live application-email delivery,
remaining public-discovery abuse coverage, monitoring, Preview
smoke/concurrency evidence, and database-restore evidence. The reviewed
GitHub-to-Netlify Production promotion is complete. Supabase Auth
OTP delivery is verified, but it does not satisfy the separate application-email
gate. See `docs/LAUNCH_READINESS.md` and `docs/SUPABASE_MIGRATION.md`.

## Release-candidate checkpoint — 2026-09-07

- `npm run quality` passed 28 specifications, 25 feature records, 280 checked
  source files, 213 Node tests, and TypeScript.
- `npm run build` completed the optimized 77-page Next.js production build;
  `npm audit --audit-level=high` remained at zero known vulnerabilities.
- The complete desktop/phone Playwright run executed 86 workflows successfully
  and skipped eight opt-in capture workflows. It exposed two deterministic
  contract drifts in both viewports: the truck-registration assertion retained
  the superseded Cargo configuration label, and single-truck Driver Home hid
  the required selected-truck identity zone. The product defect and stale
  assertion were corrected; the four focused desktop/phone workflows then
  passed. No failing application workflow remains from that run.
- `npm run test:ui-stress` captured 82 dense desktop/phone screens with zero
  failures. `npm run test:ui-audit` captured 88 screens with zero automated
  layout/accessibility flags and zero browser-flow errors.
- `npm run test:scale` inserted 5,000 extra trucks and current signals inside
  one isolated PostgreSQL transaction. The general and multi-point route
  projections returned bounded 15-row pages in 394.764 ms and 872.611 ms,
  then the transaction rolled back with zero scale rows left.
- A fresh Production logical backup was encrypted with an independent key and
  verified by authenticated decryption before promotion. The encrypted artifact
  is 1,251,625 bytes with SHA-256
  `7322e32f60ac15420c94f7114dc7b11078e16b59d088170ee3b4685dfcd27084`;
  neither the artifact nor its key is tracked.
- The exact Netlify site `loadgistic-473` and all required Production runtime
  variable names/scopes were rechecked without printing values. Migration `073`
  and the application artifact are approved for the existing controlled pilot;
  the managed scanner, application-email delivery, monitoring, and Preview
  concurrency limits documented in `docs/LAUNCH_READINESS.md` still prevent an
  unrestricted-production claim.

## Release-candidate checkpoint — 2026-09-04

- A newly empty local Supabase stack replayed migrations `001`–`069`, rebuilt
  the managed fixture, and passed every guarded live verifier with SQLite absent.
- `npm run quality` passed 28 specifications, 25 features, 277 checked source
  files, 199 Node tests, and TypeScript.
- `npm run build` completed the optimized 77-page production build.
- `npm audit --audit-level=high` reported zero known vulnerabilities.
- The full Playwright run passed 86 workflows with eight intentional capture
  skips. Four initial navigation timeouts were isolated; the corrected
  DOM-content readiness assertion and the three unaffected workflows all passed
  on controlled rerun, while the equivalent phone workflows had already passed.
- `npm run test:ui-stress` checked 82 dense desktop/phone screens with zero
  failures. `npm run test:ui-audit` checked 88 screens with zero layout,
  accessibility, or browser-flow flags.
- A credential-free logical snapshot confirmed the linked hosted Loadgistic
  database had no application tables before migration. Migrations `001`–`069`
  were applied in order and the local/remote histories match. All seven expected
  Storage buckets are private and anonymous bucket discovery returned no rows.
  Production demo fixtures were deliberately not imported.
- No managed malware-scanner credential is configured. Production upload paths
  therefore remain fail-closed; local EICAR-aware evidence is not represented as
  hosted malware-scanning proof.
- Production deploy `6a9b4353c786527571b25051` published application commit
  `935772c` to `https://loadgistic-473.netlify.app`. Open capacity, Daily
  Featured, Login, Private capacity, Tracking, and `/api/health` returned `200`.
  The health response identified `supabase-postgres` and `supabase`, with the
  managed scanner as its only blocker. Both Google controls reached the intended
  hosted Supabase authorize endpoint and then Google Accounts without consent.
  One account-code request returned the generic six-digit-code state; receipt was
  not asserted. A Private-capacity request with no eligible grant returned
  `verificationRequired:false`, proving it did not create an unnecessary OTP.
- Desktop and phone Chromium checks found no page errors or horizontal overflow.
  The initially collapsed no-roster Featured layout was corrected in `935772c`,
  then measured at 915 px of copy width on desktop and 322 px on phone. Netlify's
  Free-plan badge was disabled at project scope after it visibly overlapped the
  phone navigation; a fresh browser context confirmed the frame was absent.
- Follow-up `174380e` made the local fixture's Owner-operator and Self-managed
  driver assignments date-independent. The exact CI reset command imported 143
  active truck assignments and generated seven heavy-rigid Featured slots on
  2026-09-05; every managed live verifier, 201 Node tests, TypeScript, and the
  77-route optimized build passed locally. GitHub CI run `33926528912` then
  passed its validation, 5,000-truck rollback scale check, full desktop/mobile
  browser workflow, and standalone container jobs. This correction changes only
  non-Production fixtures and documentation; no demo identity or vehicle was
  added to the hosted database.
