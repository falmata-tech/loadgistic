# Current work and release status

Updated 2026-10-26. Read the [product brief](PRODUCT_MASTER_PROMPT.md) and
[traceability](../specs/TRACEABILITY.md) for contracts. Git and the October20/23
history files preserve previous checkpoints; this page records current work.

## Current task — cross-platform launch experience before Play

Owner order: qualify broker/shipper owner, workspace-admin and staff in installed
Android, clean provider account/profile/document discovery, strengthen native
section boundaries, remove explanatory UI prose and stabilize map updates before
the Closed Alpha upload. Audit demo-filter coverage, then complete hosted GPS
and simulator rollout. No public Play launch.
Use only Loadgistic and preserve the user's `next-env.d.ts` and mobile `.claude`.
The agent performs actual Chrome/Expo visual review without routine owner approval.

Ordered, checkable steps (FEAT-MOB/ENT/IAM/PLY/CAP/GPS-001, BASE-DEP-001):

0. Current priority: October26 Capacity meaning/input/filter/map alignment.
   Owner confirmed that current and Preferred routes/areas are all availability:
   a complete match to any one returns the vehicle once; no separate
   current-versus-Preferred search mode. Empty and Partial may both use Area or
   Route. Read-only web/native and installed-function audits are complete.
   Capacity211 is now implemented, rehearsed and applied only locally after a
   verified backup: ten rollback SQL suites, new publication/OR/private-age
   regressions, current-area API/SSR serialization26/26 and types pass. Existing
   531 Capacity and35 Preferred rows have unchanged byte hashes. Provider/map
   source78/78 and new filter source57/57 pass with web/native types and complete
   explicit localization. Actual provider Chrome save/reopen and broker installed
   search results follow; final release-APK qualification remains pending.
   Preserve the existing
   OR geography, AND other filters and whole-signal pickup/delivery matching.
   Ordered implementation plan (FEAT-CAP/GEO/MKT/MOB-001): acceptance/negative
   examples → allow Partial areas through publication and matching → align
   public/private older-signal visibility → consistent Area/Route inputs and
   availability filters → shaded areas/directed routes/dashed Preferred layers,
   keeping reported GPS/phone/manual position independent → actual provider and
   broker Chrome/Expo/installed tasks → one source-frozen full gate/release.
   Proposed filter layout must stay concise; existing authoritative geography
   helpers already support route/area matching and need no new GIS dependency.
   Audit: `.local/play-code10-upload-20261025/capacity-experience-review/`.
   Additional owner UI requests: small overlapping vehicle groups must fan out
   into selectable markers instead of the narrow selection popup; preserve real
   coordinates and privacy, with large groups bounded. Assess/add compact web
   shell copyright for MarketVision Technology with reserved layout space above
   phone navigation and no map/attribution overlap. FEAT-UIX-001 owns both.
   Small-group display-only marker fan-out now passes focused desktop/phone
   Chrome and Expo checks; large groups retain a bounded responsive list.
   The existing zoom-transition test uses distinct nearby positions so it still
   exercises zoom, while exact overlaps have their own fan-out regression.
   The compact web footer is implemented with normal-flow space reserved for
   maps and fixed phone navigation. Public Capacity, Featured, Track, About and
   signed-in provider Chrome checks pass, including en/am/om and map attribution.
   The normal Track form and Capacity also pass320×568/844×390 short-screen
   checks. A scoped short-landscape form layout keeps its action and privacy
   text visible. The combined footer Chrome case passes on the final welcome
   source. Admin read-only Featured also retains the normal-flow footer without
   horizontal overflow; short-landscape Tracking error states remain outside
   this focused qualification.
   Evidence: `.local/capacity-fan/` and
   `.local/play-code10-upload-20261025/footer-review/`.
   Finish the new Capacity input/filter tasks before the expensive final gate;
   none of this candidate is published yet.
   The latest owner request is implemented locally: the welcome paragraph is
   removed from web/native, keeping one shared heading and the public/private
   choice. Native tabs remain44px. Agent-led actual Chrome review passes phone
   web and Expo in en/am/om at320×568 and390×844, plus a desktop spot check,
   including search/filter open-close and the private sign-in explanation.
   Settled Expo readback shows16 markers from eight successful public API
   responses; initial loading screenshots are not the settled-state evidence.
   Before/after native component checks failed on the old paragraph and now
   pass; the consolidated focused batch passes31 tests with root/native types
   and753 source checks. Matching source/screenshot hashes and limitations:
   `.local/play-code10-upload-20261025/welcome-map-review/final-review.json`.
   No Play Store listing change is part of this UI work; current APK status is
   recorded in step8.
   Provider current-offer Chrome saves/reopens now pass all four Empty/Partial
   ×Area/Route combinations and Cancel, with GPS point/source/time unchanged.
   Original business fields were restored through the ordinary API; only town
   labels canonicalized while place identities/coordinates/order stayed equal.
   Preserve the strict-label comparison failure and two restore history entries.
   Broker sign-in/private API readback passes (eight existing vehicles), but
   city selection stopped before Apply when a suggestion was clipped inside
   the current filter dialog. DOM geometry confirmed the defect; scoped
   in-flow suggestions now pass anonymous phone city selection→Apply→public
   API200/three matches→reopen at390/320. The full broker filter matrix is not
   yet qualified. Both browser sessions logged out safely.
   Three missing dynamic load-preference translations were fixed with a real
   rendered-editor regression (22/22); authenticated post-fix language captures
   remain a production-preview follow-up. Frozen31-path handoff:
   `.local/play-code10-upload-20261025/capacity-experience-review/final-ui-handoff.md`.
   First combined local Node22 quality finished in63.3s:1242 pass, five failures,
   one existing skip. The failures were old paragraph/account-driver expectations
   and the reviewed skip inventory, caught and repaired locally before any CI
   push. Final root quality now passes1247/1248 with that one reviewed skip,
   source/spec/workflow checks and typecheck in81.8s. Root uses
   Node22; the separate native full gate must match CI's Node24 runtime.
   Native first full gate: types and783/783 fixed-copy translations pass;
   lint found an effect-time fan reset and tests found invalid JSX whitespace,
   two string-valued Featured conditions and an outdated map harness (368/375).
   Those are repaired with native text/filter24/24, Featured13/13 and map20/20
   focused checks. Fan reset retains clear-on-data/selection/back behavior and
   adds a no-resurrection regression. Final native Node24 typecheck/lint,
   376/376 tests,783/783 fixed-message translations and actual Android export
   pass; export took64.7s. Current Expo fan/select/details/Back also passes320/390.
   Preserve the initial failure logs under
   `.local/launch-experience-20261026/gates/`.
   Settled final web captures show loaded tiles on390/1280, one footer, no
   welcome paragraph or horizontal overflow, and attribution above the footer.
   `.local/launch-experience-20261026/web-settled-review/review.json` records
   geometry; this SSR review observed no separate public API request.
   The source-matched local production-mode web build passes in99.1s and restores
   user-owned generated metadata. It is explicitly a local-only artifact, not
   the hosted deployment package. Production preview uses3100 and localAPI55321
   with HTTP200 home/health. Its initial normal browser sign-in was blocked by
   the local HTTP callback configuration, so a temporary loopback TLS proxy at
   https://localhost:3443 now supplies the runtime's matching HTTPS APP_URL.
   No app guard, hosted setting, upload key or OS trust store was changed.
   Current Admin/broker HTTPS and installed development-client results follow;
   the replacement APK/AAB is recorded in step8.
   HTTPS Admin normal sign-in/read-only Featured overview now passes without an
   SSR error; it does not replay the earlier Sponsor Save. The HTTPS broker
   walk-through found a confirmed matching-contract defect: its visible Empty
   Route matches a single-origin50km query, but Area50km at the same exact catalog
   endpoint returned no match. The pure and installed predicates excluded Route
   offers from Area queries. Migration213 now repairs that defect only locally,
   after a fresh backup, exact function/ACL audit, isolated rehearsal and rollback
   check. Public page/search/clusters and private-account/business SQL regressions
   preserve hidden geometry, explicit constraints, whole-offer matching and grant
   revocation. Installed Android Staff now finds the route vehicle through the
   exact offered city's Area50km search, opens it and retains the filter on reopen.
   No location, grant, vehicle data or hosted change was made.
   Final Node22 quality passes1274 tests with one reviewed skip in69.5s;
   the matching local web build passes in109.3s. Native source-map input comparison
   confirms the backend-only213 change does not alter the234 application/shared
   files in the already passing Android export. This is export-input evidence,
   not complete APK provenance or hosted qualification.
   Receipts: `.local/capacity-area-213/` and
   `.local/launch-experience-20261026/gates/`.

1. Verified: existing web release and native source/input receipts below. Reuse
   source-matched passing gates; do not restart the completed web release.
2. Verified fixture setup: one isolated review Broker workspace through actual
   Chrome, one existing restricted reviewer owner, one pending STAFF invitation
   to another existing reviewer. No new identities, customer data or SQL writes.
   One synthetic invitation delivery was accepted by the email provider; inbox
   receipt is unverified. The teammate has not joined. Evidence:
   `.local/play-code10-upload-20261025/broker-fixture/setup-receipt.json`.
3. Current defect: installed code10 rejects `loadgistic://workspaces` and the
   canonical HTTPS invitation destination. The real app shows “This link cannot
   be opened”; the pending invitation remains for an installed Join test. Repair
   the strict destination allowlist and retain invitation context through normal
   and review sign-in without accepting role/identity/credentials from links.
   Source fix and62 focused tests/types/translations pass. Actual Expo en/am/om
   invitation entry, signup context and visible pending Join pass; Join remains
   unconsumed for installed testing. Earlier preview harness blocked refresh;
   exact reviewer2 global logout/readback subsequently confirmed sessions1→0.
   Spec: FEAT-MOB-001 business invitation entry. Branch:
   `fix/launch-experience`. Regression tests precede production edits.
4. In progress: migration209 locally rehearsed account-only search across public,
   private account, business and Network Find. Existing connection records and
   driver per-vehicle sharing remain. Focused permission/result tests pass;
   Correct account-based scale results pass (one provider/5010 vehicles), but
   local timing remains above the unchanged5s gate (~5.65–9.05s after a19.44s
   baseline); unchanged overview timing is also above5s. Optimization is frozen,
   failed receipts preserved, and no scale pass or hardware cause is claimed.
   No hosted209 apply or CI is claimed. Provider-account search (self-managed searchable; fleet drivers
   within provider only), account→vehicles→assigned-driver profile hierarchy and
   flat readable verified/neutral badges. Vehicle badges must use the same
   current authority facts as document filters; old generic approvals are not
   current ownership. FEAT-MKT/VER-001.
5. Source implemented/review in progress: provider profile hierarchy, flat
   document rows, stronger native cards/sections and concise Network/team UI.
   Provider Chrome/Expo en/am/om tasks and focused tests pass; installed parity
   remains pending. Featured removes the How Featured works disclosure and
   negative unscheduled TikTok strip, adds AM/PM+EAT display times, and preserves
   canonical scheduling. Agent Chrome/Expo review and final focused checks are
   in progress. FEAT-UIX/MOB/PRV/VER/FTR-001.
   The Vehicle type picker now consistently says All vehicle types, one type
   name or a short multiple-type count on web/Android; canonical filter values
   are unchanged. Existing5 native picker/draft/reset checks pass; focused actual
   Chrome/Expo review and changed E2E selectors are included before release.
   Latest owner rule: Featured becomes22:30–23:59 EAT on its feature date,
   max8 providers with minimum10 minutes each and all sponsor mentions inside
   that window. Header: Daily Featured on TikTok LIVE. FEAT-FTR-001 now records
   the rule and history/manual-timing safeguards. Canonical scheduler/SQL,
   admin UI, web/native rendering, focused boundary tests and revised evening
   captures must pass before building; earlier morning screenshots are not
   final qualification of this new rule. No hosted schedule has been changed.
   Local210 is now installed after backup/rehearsal: pinned Node22 core30/30,
   nine SQL suites, slot/sponsor/history parity and real API readback pass.
   Public evening Chrome passes1280/390/320 and Expo en/am/om390/320; focused
   frontend Node22 tests31/31 pass. Initial failed browser draft receipts and
   exact fixture cleanup are retained. Safe diagnostics proved
   SAVE_RPC / SQLSTATE57014 at the existing
   REST8-second limit. Performance-only212 reuses the authoritative eligible
   account set while keeping per-vehicle rechecks; isolated rehearsal, guarded
   local backup/apply and three SQL suites pass without data/grant changes.
   Actual browser draft and two manual publications then succeeded with
   authoritative readback. Sponsor Save returned303 but its redirected admin
   page failed in `getFeaturedOverview` / `managed_featured_overview`; streamed
   HTTP200 did not mean the page worked. The underlying SQLSTATE was absent
   from the captured error, so a read-only production-preview replay must
   classify it without repeating the Save. This is not a whole-workflow pass.
   The limit was not raised. Evidence:
   `.local/play-code10-upload-20261025/featured-profile-review/evening-final-review.md`
   and `.local/play-code10-upload-20261025/featured-night-window/handoff.md`.
6. Source implemented: native progressive-refresh and stale cluster-camera
   callback guards pass30 focused tests/types; old timeout/denial callbacks are
   scope-bound. Real web1280/390 zoom/selection/60s refresh baseline stayed
   stable; no unsupported web jitter claim. Updated Expo/installed-native
   gesture/snapshot/stress qualification remains pending. FEAT-CAP/GEO/MOB-001.
7. Installed development-client review: Staff normal sign-in, populated private
   Capacity, Area filter/detail/reopen/Clear, Network, Account/Team denial,
   app-restart session restoration and UI sign-out pass. Owner normal sign-in,
   Team controls and unsaved permission-edit Cancel pass with authoritative
   unchanged role/permissions. Normal visitor Tracking OTP opens the sole new
   delivered Demo, Status-only shipment and its route/status without live location.
   Populated business Tracking, distinct Admin and saved permission changes remain
   unqualified. Automatic approval review rejected the exact Add-to-workspace
   mutation, so it was not retried indirectly. Read-only inventory found no
   proven synthetic already-attached team fixture; an unproven team was not used.
   No membership or attachment was changed. Owner UI sign-out is confirmed and
   only the owned emulator was stopped. A single narrow local-test/cleanup
   permission question is pending; provider cancellation is held while the
   existing fixture is preserved. Evidence:
   `.local/launch-experience-20261026/native-installed-review/`.
   One private supplier grant is saved and Chrome/API verified. Existing
   review-owner alias differs from login email, preventing ordinary team
   Tracking attachment by source contract; no new Tracking/email/identity or
   unreviewed fixture correction was performed. Resolve safely before claiming
   populated owner/staff Tracking passed.
   Reuse the existing isolated local Broker `scenario-broker-190` for populated
   installed journeys through the ordinary local API and a development build.
   Keep release HTTPS enforcement and review-account isolation unchanged; do not
   rewrite reviewer identities or read production Tracking secrets to prepare a
   test. The final production-targeted APK still needs its separate installed
   checks; local fixture success is not hosted/reviewer-data success.
   Exact production provider shipment review found repeated status,
   no alternative in Change vehicle, and a web date
   field inconsistent with the server lock. FEAT-TRK-001 records the pending
   provider-only web/native presentation repair. The owner confirmed the US
   phone location is intentional; location data and map-camera behavior are
   explicitly outside this UI repair. No production edits were made.
8. Local replacement APK/AAB built successfully in521.6s offline from565 frozen
   inputs; no input changed during build. Version1.2.0/code10 targets production
   HTTPS and arm64/x86_64, using only the existing debug certificate. Both archives
   pass actual manifests/permission/signature/16KB/Hermes checks. APK SHA256
   `28edf23217360f51cc40c64398c2de2addffda738b1a5672155dc8bb0c077dfc`;
   AAB `cf63bff93251d40bb544a149a6208db240594e7d8edc2af923c1fa6fe8d4e532`.
   Receipts and artifacts: `.local/launch-experience-20261026/android-candidate/`.
   Root/native source gates and Android export pass as recorded above;
   actual standalone retest and exact-source CI remain pending. Preserve
   old bytes and source labels. Expo Free Android quota is15/15; local signing
   needs a new exact-artifact one-use approval after final inputs are qualified.
   The existing code10 signing question/review covers only its pinned old bytes.
9. Pending: accurate current Play policy/reviewer/background-location evidence,
   one Closed Alpha upload and independent bundle/track/review readback. Preserve
   Internal, tester lists, country eligibility and empty public Production.
10. In progress, read-only: enumerate each real public/private filter option and
   its matching demo count on web/native. Fill approved demo-only gaps in vehicle
   type, capacity/load, routes, Preferred corridor, location/source and reviewed
   document states; do not fabricate verification or promise every combination.
   The existing hosted mainc262 public audit completed64 cases over48 vehicles;
   eight visible options returned zero, including GPS and Fresh. Preferred routes
   exist20 times but no Preferred area was returned. This is a live baseline,
   not a candidate pass; exact option/count evidence is retained in
   `.local/play-code10-upload-20261025/demo-filter-audit/coverage-matrix.json`.
11. Pending after Play/demo qualification: hosted GPS ingress and demo simulator
   deployment with provider selection, safe demo allowlists, real-device takeover,
   recovery and monitored rollout. Do not claim an always-on service before it runs.
   GPS private UI wiring now covers Heading, observed/received times, alarm age,
   truthful report freshness and Sending/Sent command states;48 focused checks
   and types pass, actual Chrome/Expo review is in progress. Physical commands
   remain receive-only until exact model/bench qualification. Hosted templates
   still need a secure Netlify-to-Traccar provisioning control path.

## Verified live web and original Android candidate

- Web https://loadgistic.com: production deploy `6ade9c1e03bf260ac498d5f9`.
  Integrated main `c262da6e74620d978870212193bc3b42db7dc0fe`; PR25 candidate
  `63705dd`; immutable web built `52477bb`. Executable equivalence is recorded.
- PR25 CI40241567374 passed16/16 on attempt1. Main CI40244099050 passed16/16 on
  attempt2. Main attempt1 had two requests fail before status assertions; one
  failed-only retry passed. Their causes remain unconfirmed and failed receipts
  remain preserved. No test was weakened or failed attempt relabeled.
- Live checks:17 public checks,48 eligible vehicles,8 Featured accounts, ready
  health, private anonymous denial and actual desktop/phone Chrome;43 synthetic
  API checks and6 actual Chrome account/private-PDF/logout tasks. Fresh database
  readback after UI logout confirmed zero test sessions.
- Original Android1.2.0/code10 ARM64/x86-64 debug candidate, not32-bit ARM:
  `.local/play-code10-20261025/final-parity/`. APK SHA256
  `f7fcd195b0883951f3d96aa24c91e15eb4522ed5edce4e067ce57f8bb3243689`, AAB SHA256
  `84beff0ca9ae47a6f9e185655adb07379dc9177e91d7b6353504be6f329fa823`, built from
  `ebc6df9` with runtime equivalence through mainc262. Guest/profile/selected-map/
  details/Back smoke passed12 checks. Existing driver Capacity save, Manual
  Cancel, private-signup explanation, Featured and logout checks passed separately.
  The newly reproduced invitation defect prevents calling all role tasks passed.
- Root quality1199 pass/one existing intentional skip, source/spec/workflow/types,
  unchanged native342 tests, types/lint/791-message translations/Android export
  passed on their recorded inputs. New runtime edits require new relevant gates.
- Release/readback, failures, artifact equivalence and screenshots:
  `.local/release-20261025-settled/`. Earlier immutable build/failed-run evidence
  stays in `.local/release-20261025-focus/` and prior release directories. PR24/25
  bodies were independently read back; only their two merged task branches were
  deleted. No history rewrite or user-edit staging occurred.

## Hosted state and remaining limits

Supabase `tpwyyzoqijjmbvsmmvcm` remains ledger208 after the approved199–208 apply.
It removed five legacy email-only Capacity grants, not email-based Tracking.
The actual web release used fresh advisor checks:0ERROR/the same2 acceptedWARN;
that receipt is historical evidence, not a permanently fresh security clearance.
No new SQL or hosted configuration change is part of the invitation fix.

The recovery archive is hosted data plus a reconstructed ledger198 schema;
restore/exact199–208 rehearsal passed. It is not a byte-for-byte current hosted
schema backup, managed backups/PITR were unavailable, and later writes are not
recoverable from it. Never automatically restore it over a live project.

Play inspection at2026-10-26T01:59UTC found code7 on Internal/Alpha, code10 unused,
Production empty; only a temporary inspection edit was created/deleted. Tester
eligibility does not prove opt-in or the continuous14-day clock. Play declaration,
physical background/location/notification and fluent-speaker qualification remain
separate. Ask before a new session on the owner's physical phone; owned emulator
review needs no phone session.

Local demo-world slices previously passed intake/Capacity/Tracking/profile/team
checks but controls were off. No always-on hosted simulation or real GT06 device
intake is claimed. See [the local supervisor](operations/DEMO-WORLD-LOCAL-SUPERVISOR.md).
