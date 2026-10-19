October19 focused release correction — FEAT-IAM/FLT-001 / NR-40:
`175_fleet_contact_preserve_personal_identity.sql` preserves structured first/last
names during authorized legacy fleet contact edits. Before-fix rollback-only
`tests/sql/personal-public-identity.sql` reproduced the overwrite; after-fix test
passes. Fresh local backup, isolated restore/rehearsal and unchanged function ACL
are recorded under `.local/release-20261019/`. No hosted repair or final release
pass is claimed. Current Tracking map SQL also passes using a registered phone
installation and the current10 km maximum fixture.

# Specification traceability

## October19 provider-scoped map page cost — isolated candidate

FEAT-MKT-001 / FEAT-LST-001 / NR-13: CI run39341423939 passed the actual
profile-search timing but the selected-provider vehicle map took7.18 seconds
and its route-filtered page7.67 seconds against the unchanged five-second
limit. Local query-only function counters found the public account-name and
publication helpers repeated for each of5,000 vehicles under one provider.
Migration178 caches those checks by their exact provider pairs; the installed
latest-signal, Driver, sharing, moderation, filter, cursor and card projection
stay in the public map RPC. The original definition is retained as a
service-inaccessible rollback copy. On the isolated local schema177 clone,
`tests/sql/public-provider-map-page-cost.sql` passes exact JSON parity across
two new synthetic providers, combined filters, route, viewport, cursor and
service-only ACL. The test accounts and records roll back. A separate
rollback-only5,000-vehicle probe returned15 correct map/route rows in10.04/
10.78 seconds on contended Docker Desktop; the old saved map query exceeded
30 seconds in that environment. These local timings are **not** a passing
five-second gate. The clean CI scale run and any hosted migration review remain
pending.

## October19 Transporter search page cost — isolated candidate

FEAT-MKT-001 / FEAT-LST-001: proposed migration177 keeps the ordinary public
vehicle map producer unchanged. Its private profile producer retains the same
authorization and filter CTEs, caches the active Driver for each latest vehicle
and the public account name for each provider,
and defers displayed document badges until the selected profile page. The
public profile result still groups and ranks every matching vehicle; private
EMAIL and business results continue through the previous implementation.

Migration177 applied to a disposable restored schema175 clone. The
rollback-only `tests/sql/profile-search-page-cost.sql` passes exact result JSON,
page-two and internal-matcher parity; it compares public/private-producer ID
sets for text, blocked handles, status, vehicle category, location source,
route and reviewed-document filters. Its synthetic reviewed owner, Driver and
vehicle authority documents are created inside the transaction and rolled
back. The ordinary map projection is identical to the saved definition.
At 5,000 synthetic Drivers, the actual `capacity_search_results` call returned
5,001 profiles,15 page items and7,195 bytes in11.699 seconds on local Docker,
versus119.57 seconds before the candidate. A prior EXPLAIN showed the uncached
private producer consumed44.56 seconds and1.32 million shared-buffer hits.
The strict5-second CI gate and
hosted migration review remain pending; this is **not release evidence**.

## October19 synthetic Play business isolation — isolated local rehearsal

FEAT-PLY-001 AC4 / FEAT-ENT-001: migration176 makes business membership,
invitations, directory/search, Capacity and Tracking honor a durable synthetic
reviewer boundary. Both business-feed grant branches are scoped, so a personal
email share cannot enter a reviewer team feed from a real provider. A real
provider cannot create a new private Capacity or Tracking recipient addressed
to a registered reviewer; review providers can address new shares only to
registered synthetic reviewers. Tracking business attachment and every business
read recheck the shipment source, including a preexisting/misaddressed owner.

The migration installed on a disposable clone of the schema175 rehearsal;
`tests/sql/play-review-business-isolation.sql` passed with a rolled-back
synthetic owner/staff and real provider/recipient fixture. Negative cases cover
guessed IDs, mismatched/legacy email grants, outbound review email, late review
registration, Tracking attachment/direct-detail/list and mixed shipment
ownership. The six adjacent SQL suites and mobile typecheck passed locally.
`tests/e2e/play-review-business.spec.ts` passed against an isolated Supabase
stack and Expo browser preview: actual owner/staff login, business creation,
invitation and acceptance, Capacity and Tracking responses, staff Team denial,
database membership readback and synthetic record cleanup. Root source/spec,
unit and build gates and mobile typecheck/lint/unit/Android export passed.
This is **local evidence only**: no shared preview, hosted database, reviewer
fixture, web release, Android binary or Play entry was changed by migration176.
Exact owner SQL review, installed Android verification and release gates remain
separate requirements before publication.

## October18 vehicle and location-source filter — local review

FEAT-CAP/MKT-001: generic vehicle labels include courier cars and motorcycles;
the separate Space needed control is removed from web/Expo maps while saved
accepted-load preferences remain. Migration171 filters only the published
location source on public, verified-email private and business Capacity maps.
GPS, phone and manual choices are canonical alternatives within one group and
combine with current load and other filters. Direct old web links do not retain
an invisible load-size filter. Private device identifiers stay out of results.

| Contract | Verified local evidence |
| --- | --- |
| SQL source predicate, privacy and permissions | Fresh protected preview backup and isolated rehearsal; `tests/sql/capacity-published-location-source-filter.sql` passes in clone and active local preview. Live local public API returned TELEMATICS only for GPS, DEVICE_OBSCURED only for phone, MANUAL_ADMIN only for manual; GPS+phone returned only those two. |
| Shared query and removed visible control | `tests/location-source.test.mjs`, `tests/capacity-filter-{values,http,ssr}.test.mjs`, `tests/business-capacity.test.mjs`, `apps/mobile/tests/{discovery,public-capacity}.test.mjs`; focused selections all pass. Web/Expo typechecks pass and native translation audit covers680/680 explicit messages. |
| Actual interaction and appearance | `tests/e2e/capacity-location-source.spec.ts` passes desktop and phone selection, apply, Clear and old-link behavior. Expo Chrome phone draft/multi-select/clear/cancel receipt: `.local/courier-20261018/source-filter-ui-evidence.json`. Stable review captures: `.local/capacity-source-171-20261018/{web-desktop-filters,web-phone-filters,expo-phone-filters}.png`. Owner visual approval is pending. |
| Retired brokerage wording and Terms layout | `tests/platform-brokerage-retirement.test.mjs` passes16/16 including all four Terms translations. Actual local Chrome at1440/390px shows no retired arrangement promise and phone paragraphs296px wide; Amharic, Afaan Oromo, Somali and Tigrinya render with no phone overflow: `.local/capacity-source-171-20261018/terms-{desktop,phone,am-phone,om-phone,so-phone,ti-phone}.png`. |

These checks establish only the Loadgistic local preview. Full release gates,
hosted migration and Play distribution remain separate and pending.

## October18 connected business workspaces, source privacy and SEO — local review

FEAT-ENT/SIM/SEO-001 with FEAT-IAM/APP/CAP/SHR/TRK/GPS/MOB/SUP-001.
Owner approved the concept and authorized actual browser interaction. Connected
screens remain candidates for owner visual review; no production deployment,
commercial restrictions, billing, new binaries or hosted SQL are claimed.

| Contract | Verified local evidence |
| --- | --- |
| Exact synthetic scope, expiry, sticky takeover, private phone installation/session authority | SQL156/157, `tests/sql/demo-location-arbitration.sql`, `tests/sql/phone-location-installations.sql`, `tests/demo-motion.test.mjs`, `tests/phone-location-contract.test.mjs`; isolated rehearsals and protected active-local install receipts under `.local/demo-devices-20261018/` |
| Actual movement, source and private provenance | `movement-persistence-evidence.json`:3 distinct saved GT06 positions through real Traccar/outbox/HTTP; dated PHONE Capacity update; actual-source/demo fields, both targets stopped; first cold expired packets denied without bypass |
| Selected GPS/phone/manual Tracking and smaller new circles | SQL158/163, `tests/sql/tracking-selected-sources.sql`, `tests/sql/location-radius-choices.sql`; old40km Capacity/20km Tracking retained honestly; `finish-clone-rehearsal.json` six focused suites pass |
| Compatible Brokerage/LOADGISTIC retirement | SQL159 and `tests/sql/platform-brokerage-retirement.sql`, `tests/platform-brokerage-retirement.test.mjs`; old endpoints/tokens/alerts denied, software Support preserved |
| Separate business membership, exact-email invitations, current team permissions, erased-member safety | SQL160/164, `tests/sql/customer-business-workspaces.sql`, `tests/sql/business-directory-retention.sql`; actual web create→edit/cancel→invite→inbox→staff join→permission remove/redirect→restore; `.local/business-workspace-20261018/workflow-evidence.json` and `permission-diagnostic.json` |
| Provider shares a real truck with searched business; profile search independent of truck filters | SQL161, `tests/sql/business-capacity-sharing.sql`, `tests/business-capacity.test.mjs`; actual Chrome UI saved provider grant, exact authorized business feed truck, visible Transporter search under conflicting map filter parameters; `.local/business-capacity-20261018/evidence.json` |
| Single Tracking owner, actual invitation email, route/status-only viewer, immediate revoke | SQL162, `tests/sql/tracking-owner-delegation.sql`, `tests/tracking-sharing.test.mjs`, `tests/tracking-sharing-email.test.mjs`; actual web and Expo owner/viewer flows in `.local/tracking-sharing-20261018/web-evidence.json` and `expo-evidence.json`; Expo verifies≤5min and actual saved MOBILE1km demo point, no viewer point/proof/owner action |
| Customer software Support alerts | SQL165 exact source rechecked after isolated positive/negative suite; `tests/sql/business-support-alerts.sql`; `.local/business-workspace-20261018/alerts-evidence.json` proves normal staff HTTP200, actual Updates dialog, zero final page/console errors |
| Public SSR discoverability without private indexing | `tests/public-seo.test.mjs`, workspace-navigation checks and `tests/e2e/public-seo-navigation.spec.ts`; `.local/seo-20261018/chrome-public-review.json`, `chrome-map-seo-review.json`: real1440/390px loaded map, source icons, ordinary links/switch, actual canonical/HTML, private/filtered noindex, preview exclusions |

Fresh local installation receipts preserve immutable SQL hashes and backups:
`active-preview-156-162.json`, `active-preview-163-164.json`,
`active-preview-165.json`, `active-preview-166.json`. Legacy CLI ledger is not
rewritten. Actual browser results below are recorded separately from typed
compilation. A separate opt-in one-hour local review runner is enabled;
`review-runner-state.json` records actual lane states/counts without credentials.

Actual Expo business Tracking additionally proves normal owner business creation,
exact-email staff join, owner attachment, initial route-only staff access,
explicit per-staff position grant, and position-only revocation while route/status
remain. Authoritative projection is checked at each stage; proofs/approval/reshare
stay denied. `.local/tracking-sharing-20261018/expo-business-evidence.json` and
`expo-business-staff-{route-only,position-authorized,position-revoked}-phone.png`.
Fresh untouched business-map Chrome capture also confirms its shared truck marker
is inside the map/phone viewport, six loaded tiles and no browser/console errors:
`.local/business-workspace-20261018/business-camera-evidence.json`. Earlier
marker-free screenshot was taken after deliberate zoom, not an initial-fit defect.
Public Chrome confirms actual GPS demo source/icon/detail on desktop and phone
with24 loaded tiles and zero pageErrors. The phone fixture is intentionally not
public and its visibility was preserved; its source is verified on permitted
Tracking. `.local/demo-devices-20261018/public-motion-chrome-evidence.json`.

Actual Expo business Team11 checks/11screenshots pass through normal owner
OTP/terms/create/select, multi-filter dialog, received-Tracking list, persisted
invitation + delivered SMTP resend, independent staff OTP/Join, restricted Team,
owner versioned permission save and staff refresh removing Capacity.320/1440px
have no overflow; zero pageErrors/native text warnings and all software Support
alert reads200. `.local/enterprise-plan-20261018/mobile-evidence/receipt.json`.
The native render guard now uses booleans rather than empty-string View children;
its original LogBox and asynchronous harness failures remain retained. Customer
native push compatibility166 now passes isolated SQL acceptance and backed-up
active local installation (`166-rehearsal.json`, `active-preview-166.json`).
`tests/sql/business-native-push.sql` covers genuine member/provider registration,
own software-chat-only payload, no read-receipt mutation, retired guest/platform/
unverified/foreign-session/secret rejection, membership/archive/suspension/
deleted identity/session expiry and RPC ACLs. Physical push remains unverified.

The final root focused selection passes30 tests covering source/projection,
independent search, demo runtime/expiry, SEO and revoked invitation delivery.
Agent-focused tests/types pass; these are not the deferred full quality/build/
release/CI gates. Actual Expo JS bundleHTTP200 follows a project-scoped pinned
zod dependency/resolver correction; typecheck alone did not establish that.
One earlier generic web Error remains retained, unreproduced in two subsequent
Chrome runs including exact permission revoke/redirect/restore. Native background
capture, physical Android takeover, real GPS/engine qualification, production
Search Console/indexing and commercial rollout remain separate evidence.

## October18 earlier business workspace design record

FEAT-ENT-001 / proposed ADR-081 records the owner-requested UI/access plan before
application edits. It retains free Marketplace and verified-email access, proposes
paid provider/business workspaces, separates customer teams from platform staff,
and plans compatible retirement of platform Brokerage and special LOADGISTIC
capacity access. Provider sharing chooses a personal email or a searched/selected
registered business whose permitted team receives the grant directly. Tracking
has one primary owner, restricted viewers and explicitly authorized location staff;
current GPS/phone/manual integration is an identified implementation dependency.

Draft validation passes38 specs/35 features with resolved links. This is not
evidence of implemented permissions, connected enterprise accounts, subscription
checkout, all-source shipment Tracking, retired endpoints or deployed changes.
The then-isolated concept at `http://127.0.0.1:3138/` passes45 focused Google Chrome
checks over six scenes at1440/390/320, with28 captures, no horizontal overflow,
zero page errors and no non-concept requests. Receipt:
`.local/enterprise-plan-20261018/preview/evidence/receipt.json`. Owner concept review was subsequently approved100%; connected screens require
their own review. Concept staff/location toggles illustrate intended behavior;
they are not security or connected application acceptance.
The ordered checklist is at the top of `docs/PROGRESS.md`. Existing October15
local implementation/evidence remains preserved below and distinct from this plan.

## October 15 account-first dashboard correction — local review candidate

FEAT-UIX/ADM/APP/FLT/MOB/PRV/SUP/TRQ/TRK/GPS-001 / BASE-FE-001 / NR-55:

- The owner's rejected disclosure-only layout is superseded by named Fleet task
  views, saved records and deliberate Edit/Save/Cancel tasks. Account groups
  private details, public profile, entity documents and security. Duplicate
  actions/headings and empty retired inventories are removed. Driver Home stays
  map-first; no business feature or staff responsibility is removed.
- Administration starts with Accounts. Its typed bounded composite connects exact
  organization/personal-provider ownership and employed-driver relationships.
  Customers, Operations, Trust and Support are persisted independent checks;
  admin-only GPS scope repeats current role. Mid-read role, membership, active
  assignment and permission changes discard buffered private views. Related
  truck/provider evidence repeats exact entity/Trust checks. Child truck,
  Tracking and Support return links retain only an allowlisted account context.
  `tests/admin-account-overview.test.mjs` and actual desktop/390px owner/employee,
  Customers-only and Support-only acceptance pass. No SQL migration is added.
- Exact off-page driver detail passes a real13-driver fleet with10 directory rows,
  Edit/Cancel, foreign-driver denial and exact fixture cleanup. Receipt:
  `.local/fleet-driver-detail-20261015/evidence.json`.
- The final focused selection passes124 tests across account scope, dashboard
  presentation, Fleet/device refresh, portrait route admission, sharing, security,
  loading and navigation. This count is one unique batch, not the sum of earlier
  overlapping agent runs. Root/mobile types, source624 and spec37 checks pass.
- Actual Expo owner and employee walkthroughs complete through logout with zero
  product writes/page errors: nine provider screens, saved Account/Edit/Cancel,
  Fleet tasks, assigned-truck-only employee Home and589px phone map. Evidence:
  `.local/dashboard-restructure-20261015/mobile-browser/`.
- Actual web provider Fleet/GPS read/edit/cancel captures pass. The corrected
  image-readiness capture proves both real optimized thumbnails200/decoded,
  avoiding the earlier premature screenshot. `.local/dashboard-task-fleet-20261015/`.
- Actual owner and company-provider Tracking correction saves persist; forged
  cancellation denies, Operations controls remain, synthetic cleanup passes.
  Successful evidence is under `recovery-final/`, not the earlier failed
  hydration attempt retained under `account-final/`.
- Account/Profile/security desktop/phone read/Edit/Cancel pass independently of
  the original failed cold-navigation shell assertion. Instrumented warm
  Account→Network returns RSC200 and preserves the exact document/shell; Network
  Add/Cancel restores both fields and makes no writes. A direct warmed Network
  load has zero hydration warnings. Earlier generic hydration/cold dev timeouts
  remain unconfirmed and preserved; cold compiled-app console/navigation belongs
  in release acceptance. Receipts: `.local/account-navigation-diagnostic-20261015/`.
- Four additional current-role action regressions pass. Customers-only staff
  receive read-only activation for protected ADMIN/SUPPORT targets; actual admins
  retain the existing staff management link. SQL permissions are unchanged.
- Four-language fixed-message coverage passes618/618. New account-specific copy
  and dynamic recovery/error messages are mapped explicitly. Coverage is not a
  native-speaker fluency claim. The owner-only local guide lists verified Gmail
  aliases/relationships; it truthfully marks legacy Tracking without active
  recipient grants as inspection-only (WEB-MOB-046).

Evidence root: `.local/dashboard-restructure-20261015/`. Owner review page:
`http://127.0.0.1:3137/`; web `http://127.0.0.1:3100`, Expo browser
`http://localhost:8084`. Explicit owner visual approval, full release gates,
updated native onboarding/assignment mutation acceptance, installed Android,
physical GPS/engine qualification and separately reviewed hosted rollout remain
pending. Earlier failed compiler/harness/hydration attempts remain distinct.
No production, Google Play, signing, commit or push is claimed.

## October 15 dashboard cleanup and fleet GPS — local candidate

FEAT-GPS/UIX/SUP/GST/IAM/ADM/FLT/CAP/GEO/SHR/MOB-001 / ADR-080 / NR-50–54:

- Admin chats/Team separation, stable Team drafts, compact Brokerage controls and
  phone navigation pass focused54 dashboard/Auth regressions. Actual admin
  desktop/390/320 and staff phone logout pass, including one native POST,303,
  same-origin login and no API fallback. Evidence:
  `.local/dashboard-cleanup-20261015/` and
  `.local/dashboard-cleanup-staff-origin-fixed-20261015/`.
- Exact migration152 retires only old Guest Open/Waiting workload. Its composed
  double-apply rollback assertions preserve Provider/Brokerage snapshots and prove
  ordinary Provider claim afterward. Five guarded-runner tests pass; the actual
  local rollback runner and local strict catalog pass. Future fixture imports
  exclude retired Guest tables without changing current-service fixture data.
- 151/152 pass a protected fresh v3 restore, negative GPS/source/command tests and
  strict catalog;153 passes a separate rehearsal with approved demo-email alias
  metadata guards. Exact local install receipts are
  `.local/telematics/local-install-receipt.json` and `local-install-153-receipt.json`.
  No hosted schema is changed.
- Actual synthetic GT06 packets pass pinned Traccar, transactional outbox, signed
  HTTP and app persistence. The clean `bridge-verification-evidence.json` proves
  two fixes, three correlated acknowledgements (Locate/cut/restore), actual GPS
  publication and duplicate/replay/tamper checks. `restart-verification-evidence.json`
  proves two fixes queued while bridge stopped reach the app after restart. Earlier
  failed receipts remain separate; command replies cannot refresh location and
  telemetry cannot starve the independent short-lived command lane.
- Actual web source save/readback, negative US point/camera, Cancel, employee API
  denials and Expo email-code Fleet/Home presentation pass. Dirty/hidden sections
  issue no polling request over31 seconds. Final Expo receipt:
  `.local/telematics/browser/native-complete-diagnostic-runner.json`; phone layouts
  fit390px without page/abort errors. Actual public source-marker capture passes;
  no existing authorized private demo grant qualified, so recipient browser proof
  remains unverified. No arbitrary new grant was created to fill that gap.
-154/155 pass a fresh protected app clone and local install, GPS/manual and two
  existing erasure suites, strict catalog and six actual closure/credential races.
  The saved Manual editor passes actual web/Expo reopening, accuracy-only saves,
  full reload and Cancel without mutation; exact GPS20 restoration passes. Receipt:
  `.local/telematics/browser/saved-manual-locator-fixed-runner.json`.
- The visible Fleet Locate command sends one POST200, reaches the same command's
  actual correlated acknowledgement and displays Device confirmed, preserving
  source/assignment. Receipt: `browser/visible-request-location-runner.json`.
  The independent180-second movement demo completes37 GPS/36 phone/manual reports.
- Actual privacy receipt `privacy-verification-evidence.json` passes all13 flags,
  including retained DISABLE history, held ERASE before proof, strict app/upstream
  absence, cached position/event denial, idempotency and primary trackers unchanged.
  Pinned Traccar6.3 removes history FKs, so a separately restricted exact-device
  purge is required; the earlier failed204/cascade receipt remains preserved.
  `gateway-privacy-forward-rehearsal.json` proves a501-row bound, actual lock wait
  without deadlock, late insert denial and unchanged other-device/raw snapshots.
- Root/mobile types, fixed585-message/four-language audit and focused client/source
  checks pass. Owner visual review, full gates, hosted rollout, retention/backup
  expiry/quotas, physical trackers/engine interlock and a new Android release remain
  pending. This section records local evidence, not production readiness.

## October 15 current-assignment and confirmation follow-up — local

FEAT-FLT/MOB/VER-001 / WEB-MOB-042–043:

- Four actual DriverHome/persisted-editor regressions pass with thirteen existing
  provider-owner presentation checks. The new test renders owner and employee
  stale-ID cases, and denies foreign/ambiguous current pairs:
  `tests/mobile-current-driving-pair.test.mjs`.
- Actual Expo A-to-B assignment retains B during a deliberately held read,
  persists its sole current pair and displays map Home for B without refreshing
  authentication. Actual five-action confirmations persist saves while explicit
  Cancel preserves unchanged records. Both exact cleanups pass with no page
  errors in
  `.local/internal-workflows-20261014/provider-mobile-deep-actions-phone-corrected-runner.json`.
  Escape/backdrop and painted-overlay checks additionally pass in
  `.local/internal-workflows-20261014/provider-native-confirmation-painted-phone-runner.json`.
- The new authority-command SQL suite passes21 exact denials and valid controls,
  preserving source/fact/audit state. Current Trust permission, active account and
  active staff are checked for context/confirm/revoke; nonapproved sources,
  swapped contexts and invalid expiry remain denied. It rolls back on the isolated
  v3 clone and is in CI's SQL list. All23 compatibility receipts match current
  source hashes in
  `.local/provider-fleets-20261014/fixture-compatibility-summary-23.json`.
- Root/mobile types and the explicit native-copy audit pass. Its555 fixed-message
  boundaries include confirmation title/detail/decisions and all four translations;
  this is not a fluency or dynamic-copy claim. Existing browser/source failures
  remain recorded, including the wrong-preview-route fixture and exact subsequent
  cleanup. Remaining affected legacy browser cases now pass (two registration,
  five document/profile, five native identity/photo and three onboarding cases).
  The registration results are the two successful cases before a later paging
  failure in `provider-document-profile-desktop-scoped-runner.json`; the complete
  five-case document/profile run is `provider-document-profile-all-card-scope-runner.json`.
  Native identity is `provider-native-personal-current-phone-runner.json`; all
  onboarding is `provider-fleet-onboarding-explicit-empty-desktop-runner.json`.
  All receipts are under `.local/internal-workflows-20261014/`. Bounded exact
  cleanup passes, preserving the earlier wrong-route, stale-selector/reset and
  paging-cleanup failures separately. No permission check was weakened. Visual review,
  full release gates, installed-device acceptance and hosted rollout remain pending.
  Final explicit browser-fixture type annotations pass root typecheck with
  unchanged emitted JavaScript syntax trees. New/previous source hashes and
  runtime parity are bound in
  `.local/provider-fleets-20261014/final-test-type-annotation-parity.json`.

## October 14 Transport Provider fleets and reviewed truck authority — local

FEAT-FLT/IAM/APP/VER/CAP/PRV/PLY-001 / ADR-079 / NR-46–49:

- Provider owners share the Transport Provider public name and may manage
  multiple trucks and employed drivers, retaining their existing organization
  or personal-profile identities. Employees remain assigned-truck-only. New and
  restored trucks are Draft; one active unreviewed truck may go Live. Additional
  Live trucks require current exact-provider ownership or an operating licence
  reviewed in their name for an owned/financed truck. Permission to drive/manage
  remains a distinct fact and cannot unlock a fleet. Revocation/expiry withholds
  an unqualified multi-Live fleet without deleting its choices, history or proofs;
  withdrawing to one restores the single-truck allowance. Active-owner checks
  also deny inactive, Auth-deleted, unknown and invalid scopes.
- Final145/146/148/149/150 passes a fresh backed-up v3 restore and ten rollback-only
  SQL suites: `provider-owner-fleets`, `provider-vehicle-authority`,
  `provider-authority-erasure`, `provider-driving-intent`, `provider-fleet-erasure`,
  `provider-authority-recovery`, `independent-single-truck`,
  `worldwide-capacity-loads`, `provider-live-publication-limit` and
  `provider-publication-owner-scope`. These cover actual scoped commands,
  explicit assignments/current reports, truthful full-fleet authority counts,
  private/public discovery, signup/driving intent, retained Tracking/proofs,
  erasure, replacement evidence and the single-Live/qualified-fleet rules.
  The historical `independent-single-truck` filename does not retain the
  superseded one-active-truck restriction for provider owners.
- Strict catalog checks pass before/after the focused regressions. The exact
  rollback146 artifact rejects with `PROVIDER_AUTHORITY_FORWARD_REPAIR_REQUIRED`;
  `provider-authority-rollback-denial.sql` proves function definitions, owners,
  ACLs, settings, comments, publication trigger and runtime marker unchanged.
  The failed earlier v2 erasure rehearsal remains a failure, followed by the
  active-owner repair and passing fresh v3 evidence. Receipt:
  `.local/provider-fleets-20261014/final-v3-rehearsal.json` binds all five
  migration hashes and the ten SQL test hashes to that exact candidate.
- Actual two-session v3 verification proves that two waiting additions both
  create Draft trucks, two first-Live requests yield one success and one current
  verification denial, and concurrent driver/truck changes retain one current
  assignment in each direction. Exact synthetic identity, truck, assignment,
  verification-reference and audit cleanup passes. Evidence:
  `scripts/verify-independent-truck-concurrency-local.mjs` and
  `.local/provider-fleets-20261014/concurrency-v3-receipt.json`.
  The separate six-case chronology/current-pair concurrency proof remains under
  `.local/provider-fleet-145/`; its145 source hash matches the v3 rehearsal.
- The latest focused root batch passes33 publication-API, authority/recovery,
  web/native presentation and safe-projector checks. This overlaps the earlier
  focused authority/document batches; counts are not additive. These component
  and boundary checks do not complete the real onboarding/upload/review flow.
- The first main-local installation attempt stopped before writing because the
  restored baseline omitted64 existing grants on the two PostGIS metadata views.
  Read-only reconciliation verifies every other original raw catalog field and
  substitutes only those two proven source ACL arrays in memory; it changes no
  grants. Bound policy-AST evidence separately proves the restore's redundant
  grouping and unused appended alias columns preserve the original bindings.
  The reconciled baseline matches main, and v3 matches its recorded candidate.
  Evidence: `.local/provider-fleets-20261014/restored-v3-catalog-reconciliation.json`.
- The exact five migrations are now installed only in the freshly backed-up
  Loadgistic local preview. Source hashes match the passed v3 rehearsal; installed
  catalog fingerprint `1d911e741b172829d59d0b0bc43d1cb0` and strict security checks
  pass, preserving the original extension-view permissions. Receipt:
  `.local/provider-fleets-20261014/local-install-v3-receipt.json`.

Actual desktop browser acceptance passes owner signup/consent, two Draft trucks,
unverified employee assignment followed by real email-code login, one free Live
truck and an additional-truck denial. It then passes private upload/Pending,
rejection with note, corrected upload, generic approval without relationship
authority, unauthorized review/file denials, exact Trust confirmation, additional
Go Live, revocation and replacement evidence with original source/history intact.
The independent licence case passes actual expiry calendars, private-file bytes,
Trust confirmation and a financed-licence badge without an ownership claim.
Both complete exact synthetic cleanup. Receipts:
`.local/internal-workflows-20261014/provider-owner-fleet-desktop-diagnosed-runner.json`
and `provider-authority-expiry-desktop-fixed-runner.json`.

Earlier failed attempts remain failures: the hidden-switch interaction, employee
fixture consent before email verification, misplaced staff permission fields and
synthetic cleanup ordering were test-harness defects. Separate bounded receipts
prove their exact leftover cleanup, including
`.local/provider-fleets-20261014/stalled-signup-cleanup.json` and
`.local/provider-fleet-145/{provider-owned-fixture-cleanup,expiry-owned-cleanup}.json`.
The first combined phone attempt passes its web steps but stops at Expo login
because Metro returns500 for an existing newly added component. Only the verified
Loadgistic8084 server is restarted; an anonymous browser then proves bundle200,
visible/enabled login controls and no browser errors.

The final phone licence/Expo document case passes normal OTP, an actual week
calendar selection, multipart permission upload/Pending, authorized image-byte
hash/decoding, Close and cookie-only mobile-file denial. The fresh compact-review
case also proves an18px checkbox,44px clickable label, actual label click/checked
state and the saved exact financed-licence review. Receipt:
`.local/internal-workflows-20261014/provider-compact-review-phone-runner.json`.
The final phone owner case passes the complete web workflow plus Expo owner OTP,
map Home, two-Live fleet and a third permission-basis Draft without assignment.
Home/Marketplace/workspace navigation preserves the same sole owner assignment
and visible390×589 map. Telemetry proves two retained map nodes after navigation,
exactly one visible; the earlier all-DOM locator was a harness failure. Zero page
errors, unhandled rejections, raster aborts or fatal overlays occur. Both final
phone cases clean their exact synthetic records/files. Owner receipt:
`.local/internal-workflows-20261014/provider-owner-phone-navigation-runner.json`.
Owner visual approval, full quality/build/CI/release gates and hosted rollout
remain pending. No installed Android, physical GPS or new production release is
inferred from these local checks.

The additional new Expo-only account case passes real email-code verification,
Terms for its verified inactive identity, first/last-father details with optional
business name left blank, driving intent, account creation, empty map Home,
OWNED Draft creation without assignment, first Go Live without documents,
explicit self-assignment and the same truck on map Home. Exact synthetic cleanup
passes. Receipt:
`.local/internal-workflows-20261014/provider-native-new-account-phone-runner.json`.
The authority SQL fixture is now independent of the reviewed seed manifest and
passes its full original assertions on the isolated v3 clone, then rolls back.
Exact updated test SHA256:
`0948a0ca4fe45af3675d5902f4d8888714bd725d77c3d687e55c5e77d8d17d4d`.
Receipt: `.local/provider-fleets-20261014/provider-vehicle-authority-compatibility-receipt.json`.
This separate receipt does not rewrite the earlier v3 suite's source evidence.
The final new-account capture run also passes and cleans up:
`.local/internal-workflows-20261014/provider-native-signup-review-phone-runner.json`.
Its actual signup and assigned-map captures are bound to
`.local/provider-fleets-20261014/native-signup-review-captures.json`.

Fifteen exact rollback-only compatibility cases pass on the isolated v3 clone:
authority, document-free eligibility, sharing, named contacts, GPS bootstrap,
driver preverification, truck document alternatives, handover alerts, fleet
invitations/onboarding, lifecycle recovery, freight configurations, Tracking
owner handover/retention, device location and three-city route maps. The final
receipt verifies each current source hash and rollback:
`.local/provider-fleets-20261014/fixture-compatibility-summary.json`.
Earlier fixture failures remain recorded: obsolete aliases, missing consent,
borrowed employees with ongoing Tracking, and a legacy exact error expectation
after the new active-owner lock. The suspended-owner case preserves rejection
and adds durable unaccepted-invitation/inactive-recipient assertions. No seeded
shipment/history is cleared or fictional review added to force a pass.

WEB-MOB-041 / FEAT-FLT-001 / FEAT-FTR-001: neutral Driver labels and safe current-
assignment document presentation pass actual adapter regression. Featured accepts
eligible organization owners without an employee-directory row while denying
missing links/identities, ineligible providers and foreign provider scope. The
root final42-case targeted batch, root/native types and36spec/582source checks
pass; hashes are in `.local/provider-fleets-20261014/final-focused-source-checks.json`.
These counts overlap prior evidence. Public/scale/rotation legacy-fixture review,
owner visual approval and all full release/hosted gates remain separate.

The added real-backend Featured owner case also passes. One newly created
organization owner explicitly drives one unreviewed Live truck, with no employee
directory record. Actual eligible-link/provider RPCs and the Featured adapter
return the exact pair; the anonymous native public profile shows first name,
Driver and unreviewed facts without the private name/phone. Exact synthetic
cleanup passes; existing demo fleets and saved Featured days are untouched.
Receipt: `.local/internal-workflows-20261014/provider-featured-owner-current-server-phone-runner.json`.
Earlier attempts remain failed: the anonymous old-demo case has eight saved
slots but zero eligible providers/theme links under the new qualification gate,
and the synthetic case exposes the old driver label from a stale running Next
module. A PID/port/cwd-verified restart of Loadgistic3100 alone resolves that
stale module; the successful API/render case proves the actual current source.
This does not imply legacy multi-truck fleets have qualification or authorize
an ownership backfill. Actual public capture:
`.local/provider-fleets-20261014/public-owner-driver-review-capture.json`.

The resumed compatibility checkpoint now passes all22 exact isolated rollback
cases. Seven additional cases cover the complete matching/filter matrix, public
fleet pagination/authority, multiple options, the1,002-provider viewport, content
policy scope and both continuous/random Featured rotation suites. Their original
denial, fairness, privacy and history assertions remain; old category/evidence
expectations become exact per-truck authority and full-fleet summary checks with
equivalent expiry/revocation negatives. The formerly invalid Pickup Truck value
remains rejected on four entry points with durable no-mutation checks, while the
valid different-category no-match matrix uses Pickup truck. All current hashes
and rollback outcomes: `.local/provider-fleets-20261014/fixture-compatibility-summary-22.json`.
The nine guarded authority-fixture unit checks also pass; counts overlap earlier
fixture evidence and are not additive unique-test totals.

The local copied demo then receives a separately scoped additive correction:
nine exact fixture organization owners/trucks, bound by metadata and physical
identity, get new explicitly fictional private PDFs and normal new submission,
approval and authority-review records. A fresh0600 local backup and exact isolated
rehearsal pass first. All file bytes are downloaded/verified and existing source,
vehicle, assignment, profile, saved-roster and Tracking hashes remain unchanged.
No legacy generic approval is upgraded, terminal source repointed, declaration
changed or customer account touched. This is local fixture evidence, never
production ownership evidence. Plan/rehearsal/backup/apply receipts:
`.local/provider-fleets-20261014/local-demo-correction-*.json`.
The first rehearsal rejects the unsupported storage prefix; its failure remains
recorded and normal validation is preserved in the corrected plan.

Actual web/Expo phone Featured/profile/card and desktop web card/detail flows
pass afterward. The public native API returns eight trucks and Driver labels;
the normal local automatic worker fills exactly two missing dates, preserving
all existing saved days/slots. Seven upcoming days have eight eligible pairs.
Receipts: `.local/internal-workflows-20261014/provider-repaired-demo-cards-{phone,desktop}-runner.json`
and `.local/provider-fleets-20261014/local-demo-week-receipt.json`.
The earlier copied-demo empty-roster failure is retained. Owner visual approval,
full release/CI, installed-device checks and all hosted operations remain pending.

October14 deeper internal-team audit — FEAT-ADM-001 / FEAT-SUP-001 /
FEAT-GST-001 / FEAT-TRK-001 / FEAT-PLY-001:

- Web Tracking recovery honors each authoritative allowed action. Four of five
new actual-component checks fail before the repair; all five pass afterward,
with the four unchanged lifecycle validation checks. Two actual desktop/phone
cases pass Independent/fleet/Operations controls, saved corrections and forged
cancellation denial with unchanged status and exact cleanup. Initial prefilled
textarea label matching was a harness failure before any POST; the existing
accessible textbox selector resolves it. Receipt:
`.local/internal-workflows-20261014/tracking-permissions-final-runner.json`.
- Retained-guest assignment disables its selection until handlers attach.
Two actual-component checks and two real desktop/phone browser cases pass the
first choice, existing API200, saved assignee/status and one assignment event.
Receipt: `.local/internal-chat-audit-20261014/readiness/sanitized-receipt.json`.
- Driver-owner navigation and out-of-range Content/Privacy queues are repaired
using existing projection facts and `readWindowedPage`;16 component checks and
four genuine desktop/phone cases pass, including actual HTTP416 deep-page recovery
and delegated denials. FIFO Claim and conflicting rating/content moderation143/144
pass isolated regressions/rollback and a fresh combined restore/catalog gate.
Both are installed locally: all1,088 candidate function metadata records match,
78 business tables are unchanged, and one preview rate-limit counter's classified
runtime drift remains recorded. Matching Claim UI passes four component cases;
actual conflicting-moderation controls are mapped below, with no hosted apply.
- Installed144 now passes both actual desktop/phone FIFO workflows and four
component checks, including tied ordering, later pages, paused/full agents,
forged claims, exact saved assignment/event/audit and revoked authority. Basic
rating decisions pass two actual desktop/phone cases with owner email approval,
saved Uphold/Remove notes/context and terminal/unauthorized denial. Receipts:
`.local/internal-workflows-20261014/support-fifo-actual-runner.json` and
`.local/internal-workflows-20261014/rating-decisions-actual-runner.json`.
- Existing internal port/permission/lifecycle/erasure checks pass29 tests;
Support/Brokerage/readiness contract checks pass34 tests. New full roundtrips are
running serially with exact synthetic fixtures, not claimed complete yet.
- Two actual document-review cases pass uploads, per-truck pending exclusion,
private bytes/guest denial, searched deep-page recovery, More info/Approve saved
notes/context and terminal replay denial. A stale nested-summary selector was
corrected in the harness only; no product change. Receipt:
`.local/internal-workflows-20261014/document-review-disclosure-fix-actual-runner.json`.
- Overlapping review restrictions pass both actual desktop/phone cases: Trust
Hide/Restore, rating Uphold/Remove, canonical public HTML/API text/count/average,
revoked-Trust stale-form denial and retained terminal removal. Exact cleanup passes.
Deletion also passes both actual desktop/phone visitor and admin workflows:
local inbox verification, persisted receipt, Process deletion, Auth anonymization,
private image erasure, other-account isolation and exact file/DB/Auth residual
cleanup. Receipts: `.local/internal-workflows-20261014/moderation-conflict-actual-runner.json`
and `.local/internal-workflows-20261014/play-deletion-actual-runner.json`.
- Featured staff manual/sponsor controls pass desktop/phone using one disposable
future programme: draft versus publication, exact manual times, sponsor save/
disable, revoked-role denial, unchanged automatic controls and exact cleanup.
Receipt: `.local/internal-workflows-20261014/featured-connected-final-runner.json`.
Waiting identity alignment is restored by two scoped CSS selectors; the phone
FIFO workflow/capture passes again after that change:
`.local/internal-workflows-20261014/support-fifo-alignment-phone-runner.json`.
- Admin Private capacity initial URL validation now agrees with its API and
map-window query. Three actual-page SSR regressions fail before the repair;
all14 SSR/HTTP/value checks pass after it. Two actual desktop/phone staff cases
pass reload denial, API400, explicit modal correction, retained drawer text and
canonical API200. No layout or authority change. Receipt:
`.local/internal-workflows-20261014/admin-capacity-ssr-actual-runner.json`.
- The fresh basic-rating desktop rerun passes actual decisions and the newly
tracked acknowledged proof-object cleanup:
`.local/internal-workflows-20261014/rating-proof-cleanup-final-runner.json`.
- Chat visibility repair (NR-19) passes four actual-component cases, nine policy
checks and the real public Marketplace→Updates→own web conversation case.
Authorized metadata polls now wake the existing guarded reporter after a consent
dialog closes; hidden/covered/unfocused/403 cases stay unread. Assignment/receipt
negatives, scoped Support history and independent Brokerage history pass.
Support staff Close saves CLOSED and Expo retains read-only history after reload;
native Brokerage End retains callback contact/history, staff actually resolves
the request, private notes remain excluded, and Start-new gets a distinct ID.
Exact cleanup passes. Evidence under `.local/internal-chat-audit-20261014/`:
`public-receipts-only`, `receipt-negatives-only`, `support-history-only`,
`brokerage-history-only`, `support-staff-close-only` and `brokerage-closure-only`
each retain a `sanitized-receipt.json`. Earlier combined failures remain partial;
these scoped passes do not claim physical notifications or a full-chain rerun.
- Operations Tracking's shared-map caller is connected through the actual typed
projection (WEB-MOB-039 / NR-45). Six regressions fail before; all seven adapter/
page checks pass after the repair. Current Operations authority gates the exact
saved-route read and is rechecked for returned state/location; no fabricated
truck/contact projection or new SQL. Two actual desktop/phone lifecycle cases
pass route/circle, reassignment/reset, corrections, retire/restore, denied provider
cancellation, investigated staff cancellation, retained history and guest
revocation. Receipt:
`.local/internal-workflows-20261014/lifecycle-internal-repaired-runner.json`.
- Existing Operations Records and unloading-appeal forms now each pass desktop/
phone acceptance. Records saves Driver permissions off/on, takes exact capacity
Off Duty and removes the exact truck route; provider/stale revoked forms fail
without changing unrelated rows or audits. Appeals exercises actual Driver intake,
all three staff decisions, authorization/replay denials, exact approval versus
release effects, retained proof/history and unrelated-shipment isolation. Exact
served and painted proof bytes pass; the first aborted development response was
a harness observation error, not file corruption. Every final and diagnostic
fixture has verified exact cleanup. Receipts:
`.local/operations-connected-actions-20261014/records-controls-desktop-phone-runner.json`,
`.local/operations-connected-actions-20261014/tracking-appeals-final-desktop-phone-runner.json`
and `.local/operations-connected-actions-20261014/proof-boundary-observed-desktop-runner.json`.

WEB-MOB-031 through039 distinguish repaired source, actual runtime evidence,
unresolved authority and rollout. No full gates, production changes or owner
visual approval are inferred from this audit.

October13 account-maintenance verification — FEAT-APP-001 / FEAT-IAM-001 /
FEAT-FLT-001 / FEAT-ADM-001 / FEAT-PRV-001, NR-40 through NR-42:

- 14 genuine desktop/phone identity, photo, grouped-workspace and normal-signup
cases pass; six additional email-change/closure/fleet-access cases pass. Normal
Company and OWNED-Independent signup creates no subscription. All application,
Auth, upload and persistence commands are real; only the existing Company Driver
context substitutes external OSM tiles. Navigation to Change truck is not an
actual replacement write. Receipts:
`.local/personal-identities-web-141-20261013/web-evidence.json` and
`.local/account-maintenance-web-20261013/evidence.json`.

- Eight distinct Expo cases pass across `native-final`(2),
`native-remaining-final`(1) and `native-five`(5): unknown-email signup, initial
Account-read Retry, saved signup/Join read-only recovery, saved-photo preview
recovery, personal/contact/separate-photo maintenance, retained-session recovery
and two actual public-card/map cases at 390/320. Faults substitute only read or
refresh failures, with no mocked writes. Exact fixture cleanup completes.
Receipt: `.local/personal-identity-20261013/native-acceptance-receipt.json`.

- NR-42 reproduces verification200/ONBOARDING and policy 200, then chat/handover
403/ACCOUNT_UNAVAILABLE and a cleared client session. Three client guard lines
limit member activity to server-confirmed ACTIVE while preserving guest activity
and every backend/controller denial. Six actual-provider cases fail before/pass
after; 26 focused activity/controller/chat/background checks, mobile types and
scoped lint pass. Receipt:
`.local/workspace-activity-scope-20261013/evidence.json`.

- Owner-approved local142 is installed once after fresh post141 backup and exact
function-only recovery review. Main metadata preserves all 1,084 prior records
except the exact target, adds one owner-only backup, and changes no rows/ledger.
Rollback-only staff/141 integration preserves all 1,085 installed records. The
isolated clone proves old-failing/new-passing permissions, two-session locking,
drift refusal and exact rollback, plus unchanged no-plan SQL. Receipts:
`.local/staff-active-permission-142-retry-20261013/evidence.json` and
`.local/staff-active-permission-142-20261013/main-install-receipt.json`.

- The expanded staff run supplies actual create/edit/suspend/restore/revoke and
normal OTP web-only evidence, with all 14 queue/Featured statuses matching. Its
extra bearer fixture returned401 and was not accepted as authenticated403. One
subsequent API-only case proves positive Auth and global-header projection for
existing local ADMIN/SUPPORT, then 12 direct/wrapped/refresh403/WEB_ONLY negatives;
issued sessions close. The401 did not reproduce, no product guard changes, and
independent Brokerage and Owner UI cases now pass. Support's split case remains
unclassified after its granular retry; exact latest fixtures are absent. No
weaker denial is accepted. Receipts:
`.local/account-maintenance-staff-bearer-20261013/` and
`.local/account-maintenance-staff-split-final-20261014/evidence.json`.

Source validation: 37 native identity/editor components, 29 account/admin/fleet/
deletion/team checks, 23 targeted localization/API/image/editor checks, root/mobile
types, scoped lint, 36-spec validation and whitespace pass. Corrected harness
consent names/steps, image-node topology, scoped navigation readiness and cleanup
FK ordering preserve the original permission, consent, image-painting and saved
state assertions. A development frame.join failure did not reproduce once; it
is not a claimed framework fix. Physical Android/dialer/GPS/push, actual native
truck replacement, scale gates, owner visual review, full gates and hosted
rollout remain separate. Current review captures live under
`.local/account-review-20261013/`; no approval or deployment is inferred.

October13 personal identity/photo separation — FEAT-IAM-001 / FEAT-PRV-001 /
NR-40:33 backend,16 web editor/presentation and30 native identity/card checks pass;
root/native types, scoped native lint,36-spec/568-source and five localization
checks pass. Final141 is rehearsed in an isolated restored clone with actual
identity, account-deletion, synthetic public-privacy and unchanged140 SQL tests.
All21 changed original function owners/ACLs/settings and historical rows are
preserved, with six service-only helpers and owner-only backup functions. Actual
post-use rollback refuses before restoring; pre-use rollback restores exact
original definitions and removes only the new helpers/columns. Draft syntax and
identifier-bound errors rolled back atomically and were corrected in source;
restore ownership limitations were diagnosed without a main-role fallback.

The exact bounded local preset operation passes rehearsal and before/after
fingerprints:45 Driver and five provider preset cells change; a user-uploaded
provider image and every other field remain untouched. Driver/provider preset
pools are disjoint and include honest blanks. This is not a hosted fixture update.
Measured small-fixture search medians add roughly120–160ms; existing document
cost guards remain, and the later scale gate is outstanding. Genuine browser
workflow/capture evidence, owner visual approval, full gates and hosted141 are
not inferred from source or clone checks. Explicit owner approval now covers only
the exact local141 preview installation after an automatic-review rejection
before execution. Receipts:
`.local/personal-public-identity-141-20261013/evidence.json`,
`.local/personal-identities-141-20261013/preset-operation-receipt.json`.

October13 truck-specific regular routes/profile cleanup — FEAT-CAP-001 /
FEAT-PRV-001 / FEAT-FLT-001 / NR-39:48 backend/API/projection tests,11 editor
component tests and4 native profile-card checks pass. Frozen140 passes real
public/private/search/cluster/Featured and permission/stale-assignment SQL in a
fresh isolated clone and rollback-only on the shared local preview. Real post-use
rollback refuses without changing saved rows/functions/index; pre-use rollback
restores17 exact original functions/ACLs/owners. Main local install uses existing
postgres authority, preserves ledger gap and route/Services fingerprints; no
hosted apply, owner change, role fallback or data binding is performed.

Seven actual editor/map browser cases pass: web desktop/phone and Expo390
save/update/confirm/remove with cross-pair/history/current-capacity preservation,
regular/location map continuity and original regional shared-leg tap/camera/
separation assertions. Eight additional actual cases pass after140: single-truck
public profiles, five-language headings, Expo390/320 profile/map-link and driver
summary/location persistence. No assertion weakening or timeout expansion; test
scope/geometry and sandbox launch corrections are explicitly classified.
Evidence: `.local/truck-regular-service-140-preview-20261013/evidence.json`,
`.local/truck-regular-service-140-fresh-20261013/evidence.json`,
`.local/truck-regular-140-20261013/application-evidence.json`,
`.local/truck-regular-editors-20261013/final-workflows/`,
`.local/truck-regular-140-profile-final-20261013/`.
Current personal-name/avatar work will require fresh captures. Owner visual
approval, full/remote gates, hosted140 and matching installed Android remain pending.

Latest October13 transporter/map independence — FEAT-MKT-001 / FEAT-UIX-001:
11 web controller/worker and11 native search checks pass after the newest owner
clarification; public/private requests omit truck filters and retain existing
blocked exclusions. One genuine320px web case and390px Expo case prove unchanged
profile results/count/page and no restart through actual map-filter apply, followed
by explicit Show trucks preserving current map filters and adding identity.
Web retains its map reset key but hoists search above it and uses installed Next
Form navigation with unchanged GET action/fields/fallback. The earlier six browser
cases below predate this final boundary. Updated empty guidance is translated;
no API, SQL, authorization or dependency changes. Owner visual approval, full
gates and publication remain pending. Evidence:
`.local/transporter-search-web-20261013-independence/evidence.json`,
`.local/transporter-search-20261013/independence-review-artifacts.json`.

October13 Transporter search refinement — FEAT-MKT-001 / FEAT-UIX-001:
3 shared query/translation,8 actual-TSX web-worker,9 native-search and5 retained
native map/layout/access regressions pass. Actual local browser evidence:4 web
desktop/phone cases and2 Expo preview cases cover clear, paced automatic search,
one active request/latest query, composition, pagination, late-response denial,
map continuity,44px targets and English/Amharic320 rendering. Four SELECT-only
local timings and eight bounded endpoint checks cover server cost/page size and
unverified-private denial. Sources are locally verified; owner visual approval,
full/remote gates, installed Android and publication remain pending. Evidence:
`.local/transporter-search-20261013/`,
`.local/transporter-search-web-20261013-final/evidence.json`. No API, SQL, auth,
driver-profile policy, hosted setting or dependency changed.

October13 local interface cleanup — FEAT-UIX-001 / FEAT-PRV-001 / NR-38:
`platform-narrative.spec.ts` passes6 browser cases for web/native audience choices,
five-language rendering, keyboard navigation and preserved reviewer entry.
`admin-presentation.test.mjs` passes9 command/permission/form regressions;
`admin-presentation.spec.ts` passes3 actual workflows at1440/390/320, plus translated
phone actions and a final Overview recapture. No business form was submitted.
`public-card-presentation.test.mjs` and `selected-truck-exit.test.mjs` pass9 native
card/identity/camera/touch cases. Public card browser/recovery/language checks pass
9 distinct cases across targeted runs. Two malformed harness assumptions and
one pending-refresh wait were corrected without altering product behavior.

The genuine Featured-linked profile503 was traced to a valid null platform number
being rejected by `public-provider-paging.js`. Its exact nullable-field correction
keeps required UUID/fields and12-row limits. `public-provider-paging.test.mjs`
(6cases) and `provider-fleet-showcase.test.mjs` (2cases, red before fix) pass;
`public-fleet-null-number.spec.ts` passes against existing public records at1280/390.
`public-fleet-row.js` supplies private render keys; no fake displayed number,
extra public identifier, schema/data/authorization write or record substitution.

Root/native types, focused native lint,36-spec/561-source checks,17 staff/shared
copy/localization tests and511 explicit native message boundaries pass. Actual
review images are under `.local/interface-cleanup-20261013/` with unchanged image
hashes. These are browser review captures, not final standalone Play exports.
Owner visual approval, full release gates and publication remain pending;
distributed1.0.6 and the website are unchanged by this cleanup. Featured137 remains
independently live; its warning exception is consumed.

October 12 final verification — FEAT-MOB-001 / FEAT-PLY-001 / NR-31/32/33:
exact source 04e27fe passes CI 38297279274 (all eight jobs), 165 mobile tests,
native types/lint and source/spec checks. The matching installed standalone APK
verifies ordinary restricted login, actual consent/Android grants, both area
switches, map Home, real service restoration after cold launch and normal
sign-out/service stop. Both extra native sessions close. Prior unchanged
22-minute continuous background-update evidence remains valid. Signed APK/AAB
application entries match tested bytes; seven required/zero forbidden permissions
and 50-library structural 16KB alignment pass. One final explicitly approved
existing-key use is consumed; private files removed, remote associations unchanged.
Internal code 7 is independently verified available. Console confirms the exact
Alpha code-7 release and Changes in review, after the supported first-release
workflow. Both location declarations are saved/reloaded with anonymous real video;
approved icon/graphic/four genuine native screenshots and 12 selected testers
are saved. Google quick checks completed; approval, opt-ins/14-day eligibility, physical
GPS/push/16KB-device and iOS remain separate. Production is empty. Receipts:
.local/mobile-completion-20261012-service-native-runtime.json,
-service-ci.json, -service-signing-receipt.json, -service-play-final.json,
-service-review-submission.json and -policy-declarations.json.

October 12 tracking-restoration follow-up — FEAT-MOB-001 / NR-33 / MOB-QA-003:
the corrected navigation source `b211582` passes all eight CI jobs in
`38285221552` and actual Android route unwinding plus both area switches.
Its data-preserving update exposes missing foreground-service restoration,
despite retained grants, eligible tracking and saved foreground callbacks.
The real old native startup adapter fails the new cold-task regression (0 vs 1
native starts); the repaired service-port lifecycle passes eight startup,
failure, batching and stop-race cases. Native types/lint, source/spec and all 165
mobile tests pass; existing timing assertions stay unchanged in the serial
rerun after stopping only the overloaded task-owned emulator. The new native
update/closure, exact-source CI and signing/policy evidence remain separate.

October 12 native reviewer follow-up — FEAT-MOB-001 / NR-32 / MOB-QA-002:
two fresh standalone taps reproduce the retained-review-route loop. The real
isolated `mobile-review-navigation.spec.ts` fails on the former redirect with
Capacity hidden after authentication. Focused in-tab `dismissTo('/')` passes
normal password login, both area switches, a remembered About destination and
normal sign-out (14.6 seconds). The existing Play reviewer consent, scoped
private access, revocation and ordinary-account denial workflow also passes
(37.3 seconds). No authentication or permission contract, visible layout,
hosted configuration or database schema changes. Matching rebuilt/native/remote
release evidence remains pending; older code-7 captures/build and signing review
are not silently rebound to the changed source. The confirmed 12-person tester
list is saved and independently reloaded, without claiming enrollment or review.

October 11 native completion follow-up — FEAT-MOB-001 / NR-31 / MOB-QA-001:
candidate 1.0.6/code 7 keeps a current actor on permission return without needless
rotation and retains only that same unexpired actor after a transient refresh.
`apps/mobile/tests/account-session.test.mjs` passes 15 cases; the former controller
fails five of the new cases. Eight consent cases also pass. Mobile quality passes
157, native types/lint and strict translations 491/491 pass; root quality passes
496 and source/spec checks pass. `mobile-session-recovery.spec.ts` exercises actual
local email verification, visible workspace persistence on permission return,
real profile persistence plus deliberate refresh-503 injection, recovery and
normal sign-out (one phone browser, 27 seconds). Traces and automatic screenshots
are disabled for the code flow; output is sanitized. These are local gates,
not completed standalone, signing, remote CI or Google closed-test evidence.
No web/API/schema/hosted-settings or visible layout change is part of this fix.
WEB-MOB-022 separately records upstream Auth failure classification for later
backend work; it is not claimed repaired by the native lifecycle correction.

October 11 verified release follow-up, FEAT-FTR-001 / FEAT-MOB-001 / FEAT-MKT-001:
owner approved the actual 3100/8084/3135 previews. Runtime `3c13f4b` passes
CI `38180627163` (all eight jobs), root 496/mobile 149, build/types/lint and
strict fixed-copy translations. The failed predecessor is not promoted. Actual
shared-leg tests preserve independent taps, street-scale separation and normal
map gestures on desktop/phone; pure checks bound actual vertices at world zoom.
Netlify `6acc19b721f9d03af4a8246c` uses the verified same prebuilt files and passes
compiled/live public workflows, Featured schedule/eight cards/details and 75
normal-auth synthetic role/private-boundary checks. Extra API sessions are closed;
existing policy consent is not overwritten. Ledger 136 and final catalog/guard/
PostGIS/advisors pass with zero critical findings; no schema/settings mutation.
Local standalone 1.0.5/code 6 passes compiled permissions, structural 16KB checks,
installation/COLD launch, public navigation, normal synthetic driver map Home
and actual shipment detail/status controls after actual OS location denial.
Protected APK/capture/native-log-indicator receipts are separate from physical
GPS/push, real 16KB-device and policy-video acceptance. Subsequent owner-approved
bounded signing preserves all non-signature APK/AAB entries and the existing
Expo certificate; temporary private files are removed, remote associations
unchanged. Signed APK/AAB checks pass. Exact one-time AAB upload's timeout is
resolved by code-6 hash readback, not a duplicate upload. Google independently
confirms Internal 4700942405023499701/release 2 is available as 1.0.5/code 6,
Not reviewed. Alpha stays inactive Draft at code 6; public Production stays empty.
Existing tester/country settings are unchanged. Approved listing copy/graphic are
saved; Publishing overview confirms unsubmitted review and two missing location
declarations. ERROR_IF_IN_REVIEW prevented cancelling an existing Google review.
No new Expo cloud build exists; Internal/local testing is not closed enrollment.

Additional actual synthetic Android permission capture reaches disclosure and
OS grants but a transient refresh timeout returns to sign-in. One app-only cold
restart does not prove the background service. Host normal auth/refresh/logout
pass; an in-memory diagnostic confirms session clearing on transient refresh
even before expiry. MOB-QA-001 records the mobile finding and remaining negative
acceptance. Protected footage is incomplete_do_not_submit; no qualifying URL or
full native/Play-complete status is inferred. Final standalone store captures,
physical acceptance and actual closed enrollment remain separate.
Source/artifact/operation receipts: `.local/runtime-release-20261011b-*`.

Earlier local preparation below is historical at its recorded checkpoint.

October 11 local launch repairs, FEAT-FTR-001 / FEAT-MOB-001 / FEAT-MKT-001:
`featured-candidate-reads.test.mjs` verifies 1,105 exact candidates, capped UUID
requests, history pagination, newest private-capacity precedence, provider RPC
paging and fail-closed batch errors. The existing Featured random-round and
operation-status SQL suites pass with rollback, including complete-pool restart,
manual preservation and denial. No selection-policy migration was introduced.
`map-signal-offset.test.mjs` and native discovery tests bound both adapters' lane
joins at world zoom; `visible-query.test.mjs` proves stale-camera/data/unmount
denial and settled retry. The native typed text scan catches raw string/zero
conditions; runtime-content validation rejects malformed Featured/Tracking
structures before rendering. Twenty-seven native and seventeen focused root
regressions pass, with root/native typechecks, native lint and source/spec checks.

`tracking-email-session.spec.ts` passes a real local OTP, authorized detail,
reload, revocation and expiry on the phone viewport. Two
`mobile-runtime-recovery.spec.ts` cases pass actual Expo-web navigation, local
OTP, restored session/detail, malformed data recovery and closure. A controlled
web service outage preserves public navigation and refreshes to the real roster.
The live local map probe performs 24 wheel operations per adapter, selected-truck
exit and world captures without runtime errors. Seven focused SQL suites pass
using disposable aliases within rollback-only transactions. The initial missing
fixture, invalid-native-text overlay, and overly broad dev-alert assertion remain
documented as failures and corrected diagnoses, not successful checks.

The October 10 narrative has nine focused copy/locale tests and eight web
rendering cases passing; source, artwork provenance and local review remain
separate from deployment. New visual approval, exact full gates/CI, replacement
Android artifact/install, Play qualifying video and physical acceptance are
pending. Existing code-5 artifacts do not contain these new local repairs/copy.

October 9 Google Play preparation, FEAT-MOB-001 / BASE-DEP-001:
`play-internal` resolves to store/app-bundle, existing remote credentials,
com.loadgistic.app, version 1.0.2/code 3 and https://loadgistic.com. Preview/development
profiles remain unchanged. Native types/lint and root quality 473/473 pass. The
353-file inspected upload contains no private paths/keys; its only native input
change from the published runtime is eas.json. Console verification remains
pending. Signed store build b111a2a2-a3b5-4cea-92a2-735d8962d944
(source ae8baba) now verifies package/version/signature/API 36/min 24, bundletool,
PAGE_ALIGNMENT_16K, 25 ARM64 LOAD/RELRO cases, Hermes/prod-origin and no secret/dev
payload. Actual 16 KB runtime is distinct. Submission SDK validates internal/draft,
changesNotSentForReview true and no local key path; app's Play key binding is absent
while FCM remains intact. Operational steps, source-backed privacy/review findings
and owner decisions are in GOOGLE_PLAY_SETUP.md. The
simple RELRO-end formula's 23 failures are safe whole-LOAD cases according to
AOSP; no dependency change is justified, and actual 16 KB device evidence remains
separate from structural checks.

October 9 published release, BASE-DEP-001 / FEAT-SEC-001 / FEAT-MOB-001:
exact application `d443093` passes CI `37883805604` (all eight jobs/four browser
shards); root 473/473, native 118/118, 457/457 translations and actual Android
runtime/container boundaries pass. Approved 115–130 migration bytes restore and
rehearse against the fresh protected backup and commit atomically in production.
Postpublication catalog/RLS/ACL/API-guard/PostGIS checks pass at ledger 130 with
zero unprotected public tables. Prepublication and fresh
post-release advisors have zero errors; the two existing warnings remain visible.

Netlify deploy `6ac876e7cffbaa5a92772381` serves loadgistic.com. Live desktop/phone
public map/filter/reset/private/Tracking/login/Brokerage entry controls and mobile
public reads/unauthorized denial pass. Compiled private provider/Tracking/file
checks pass with production configuration. Full live private browser completion
now passes all 32 checks, including actual protected bytes and anonymous denial;
the bounded pilot session is closed. The invalid supplemental GET on the POST-only
push registration endpoint is retained separately as a corrected harness failure.
No endpoint or acceptance assertion was weakened to mask an application failure.

Expo standalone build `d1f893c2-556f-4f8f-9920-800f674d2f7c` is signed 1.0.2/code 3,
com.loadgistic.app; all 353 native inputs match final candidate despite EAS's
recorded `36be7e6` ref. Installation preserves data. Actual COLD startup, production
map and Truck filters dialog pass on the owned emulator without Metro or native
fatal error. Physical delivery/tap/moving GPS, closed-browser Web Push and the
existing empty Featured programme are not accepted by these results. Protected
release receipts and exact remaining steps are in MOBILE_IMPLEMENTATION.md.

Earlier dated entries below retain the preparation evidence at that time.

October 8 search and scale follow-up, FEAT-MKT-001 / BASE-DEP-001 / NR-08/13:
`public-capacity-contract.spec.ts` passes on desktop/phone for profile filtering
with the retired overview parameter, identical IDs/cursors and no legacy cells.
Migration 130's rollback-only metadata test proves unchanged public facts,
complete default documents and enforcement even when a caller supplies a false
internal hint with a requested document filter. The existing 5,000-truck scale
gate passes at 4.8 seconds for text search, 3.1 for routes and 3.1 for the raw
internal aggregate, with unchanged count/size/time bounds and complete rollback.
The queued-authority and account-closure race check passes. This is local evidence;
exact CI, migration rehearsal and owner review of 130 remain required.

October 8 full SQL regression follow-up, FEAT-DAT-001 / FEAT-FLT-001 / NR-08/18:
43 CI SQL suites pass in the disposable Loadgistic stack. Viewport stress still
proves matching after 1,000 newer candidates, now with separate single-truck
providers and explicit sharing. Public paging still proves all 105 fleet trucks
once, last-page capacity completeness and private-field denial, now on a company
fleet with distinct assigned drivers. Ownership/use-permission precedence is
tested separately on a valid independent truck. No index, privacy or assertion
was removed to permit an impossible multi-truck independent fixture.

October 8 release follow-up, FEAT-TRK-001 / FEAT-FLT-001 / NR-08/10: the fresh
Tracking verifier now supplies a delivery date, uploads and reads real private
proof bytes, rejects driver completion/expired owner approval and completes via
the verified shipment owner. This revealed the temporary-recipient FK blocking
retention cleanup. Migration 129 preserves a constrained private approval marker
and clears the recipient reference on deletion. The rollback-only
`tracking-owner-retention.sql` proves contact deletion, closed guest access and
retained approval/timeline/proofs. Fleet verification now denies a second
independent truck instead of expecting the retired fleet capability. These fixes
are local; refreshed exact CI/rehearsal/owner rollout review remain required.

October 8 release follow-up, FEAT-DAT-001 / NR-08: fresh CI correctly rejected
empty public cursors after migrations preceded fixture import. Migration 116's
existing-row backfill cannot initialize later-created fixture trucks. The local
importer now writes explicit PUBLIC/BOTH/PRIVATE policies after demo grants, while
the application still treats an absent policy as PRIVATE. Focused fixture policy
tests pass; fresh isolated CI verification remains required before publication.

## Android push — local evidence and scoped FCM setup, October 8

Native preview exposed a Zod/server-schema import in the phone routing graph.
The destination port is now dependency-free and strict. Two phone contract tests
(all event/screen combinations plus malformed/injected payload denial) and ten
retained server push tests pass. Actual Android bundle/startup is being repeated;
web-shim success is not counted as that proof. NR-08/19. The focused signed
development APK is compiled and installed with preserved data and the existing
signer; it remains Metro-dependent, not a standalone release or phone-delivery proof.

FEAT-NOT/MOB/IAM/SUP/TRQ/TRK/SEC/LNG; ADR-078; NR-01/02/03/09/19.
Local migration 128: backed up/rehearsed/applied, private RLS/service-only commands,
verified Auth session or exact guest capability, atomic committed-event outbox,
lease/recheck/finish and bounded retry/receipts. `native-push-outbox.sql` verifies
scope/secret/session/staff denial, no replay/own-message push, no fabricated Seen,
real join dedup, stale/crashed leases, retry exhaustion, guest expiry, logout,
rotated-token receipt safety and browser ACL/RLS. `driver-handover-alerts.sql`
now also verifies actual proof-backed approval enqueue and ack suppression.
Fourteen focused push/readiness cases pass; root/native types, mobile lint,
SDK compatibility, resolved public config, source/spec validation and fixed-copy
audit pass (455/455 explicit boundaries; no fluency/dynamic-copy claim).

Owner-delegated EAS FCM V1 upload is verified on @falmatad/loadgistic, package
com.loadgistic.app, Firebase loadgistic-f082a; no prior FCM association or other
credential change. Private bytes remain outside repository/app/logs. Exact local
round-trip evidence, screenshots, native/device limits and protected upload receipt
are recorded in MOBILE_IMPLEMENTATION. No hosted SQL/flag or new native artifact
was published. Native visual review, matched rollout and physical closed-phone
delivery/tap/permission evidence remain pending; this spec is not marked done.

## Named private contacts and map overview — local evidence, October 8

FEAT-SHR/CAP/MOB/LNG, NR-02/03/09/13: migration 127 adds private nullable contact
labels, service-only same-ID rename/named-grant ports and atomic Exclusive labels.
No new visitor data/identity authority. Rollback-only contact SQL covers foreign,
inactive, revoked, malformed, duplicate and legacy cases, history and projection
privacy; sharing-policy and worldwide-capacity-loads regressions remain passing.
`verify-capacity-contact-names-local.mjs` passes real web/native add/edit/Exclusive
save/readback with cleaned fixtures, zero browser exceptions and no overflow.
Six unit/readiness cases, root/native types, lint and source/spec checks pass.
Marker overview load tags are removed while selected-details/filter logic stays.
Driver-Home raster/browser checks pass actual cancellations and genuine HTTP/decode
failure feedback. Local screenshots/evidence are in MOBILE_IMPLEMENTATION.
Local ledger 127 only, no hosted writes. Owner UI review/full release gates/new
APK remain pending. Expo/FCM local code and scoped FCM setup are now recorded
above; matched rollout and physical-device acceptance remain pending.

## Independent-driver account and transport-chat wording — local evidence, 2026-10-07

FEAT-APP/FLT/IAM/VER/MOB, ADR-076, NR-01/02/03/08/09/10/18: migration 121
canonicalizes new/current independent identity while retaining historical records,
requires explicit truck OWNED/PERMISSION declaration, serializes creation/change
and enforces one active truck. Confirmed replacement preserves old entity/file
subjects and blocks unfinished Tracking; no fleet/driver selector/control remains.

19 final focused unit cases, 14 native language/navigation cases, root/native
types, mobile lint and source/spec checks pass. New independent-truck rollback SQL
and real concurrent additions/replacements pass, as do retained fleet lifecycle,
truck-document alternatives and the resulting catalog gate. The actual local
signup eligibility/rejection verifier passes. Real email-code web/Expo signup,
first registration, replacement, previous history, Home and direct-command denials
pass. Replacement GPS saves an obscured 20-km US fix through the actual browser
control; no capacity is auto-published and exact disposable fixtures are cleaned.
Two existing fleet/independent/company-driver web navigation cases pass.

FEAT-TRQ/LNG/LUX: the requested primary question with smaller service/live-chat
line appears in the launcher and chat, with plain route/load explanation and
transport-team waiting copy. Three web narrow-phone cases, two real submission/
recovery cases and all five Expo locales' launcher/intake/action-fit checks pass.
Native web language radios now announce actual checked state. User text, private
queue/intake/assignment and authorization remain unchanged.

Receipts, failed early runs, preview processes and limits: MOBILE_IMPLEMENTATION.
Local ledger 121 only; hosted remains 114. Owner visual approval, full exact-release
checks, restored protected backup rehearsal, production preflight and compatible
web/Android rollback/rollout remain pending. No new distribution/deployment claimed.
Browser GPS/geometry does not prove native OS behavior or basemap recovery;
WEB-MOB-015 records the observed tile-warning follow-up. Owner reports Google Play
Console registration ready; intended account/app/internal-track setup is unverified.

## Plan-free provider access — local evidence, 2026-10-07

FEAT-BIL-001 / FEAT-APP-001 / FEAT-IAM-001 / FEAT-FLT-001 / FEAT-ADM-001 /
FEAT-MOB-001, ADR-075, NR-01/02/03/08/09/10/17: migration 120 removes plan-dependent
operating scopes and trial provisioning without deleting historical data. Retired
HTTP/service/SQL charge and activation writes reject before uploads or mutation.
Account/Home/menu/client/review UI removes plan/payment controls. Old billing
destinations redirect; inactive/unlinked/cross-workspace and staff-mobile denials
remain. New health compatibility check rejects absent/malformed retirement markers.

`tests/provider-access-without-plans.test.mjs`, `tests/provider-access-health.test.mjs`,
managed-identity/mobile-billing/auth/signup/private-upload/team tests: 32 focused
cases pass. Six native navigation tests, root/native types, mobile lint and
source/spec checks pass. `tests/sql/provider-billing-retired.sql`, revised
`tests/sql/platform-controls.sql` and the resulting catalog-security check pass.
Exact unpublished migration rehearsal/rollback passed; the subsequently added
health marker is verified in the final local schema and retired-access regression.
Actual local OTP signup and rejection/duplicate verifier passes without subscriptions.
`verify-no-plans-local.mjs` proves three fresh provider models through actual
onboarding/APIs/web/Expo Home/Account, desktop/phone captures and stale-write denial.
Admin list/detail/overview/Reviews/legacy-menu and activation retirement pass
both separately and in the final combined run. Existing verification-history and platform-admin setup verifiers pass
with retired mutations and unchanged historical records; CI adds the SQL check.

Receipts, non-passing early runs and limits are in MOBILE_IMPLEMENTATION.md.
Local ledger 120 only; hosted remains 114. Owner visual approval, full exact-candidate
gates, protected restored-backup rehearsal, compatible rollback and rollout are
pending. No new APK/remote CI/deployment is implied by local success.

## Support and transport-team chat round trips — local evidence, 2026-10-07

FEAT-SUP-001 / FEAT-TRQ-001 / FEAT-ADM-001 / FEAT-MOB-001, NR-02/03/09/10:
29 focused chat tests, eight identity/security tests and seven rollback SQL suites
pass. Twenty desktop/phone web workflows pass across initial and corrected runs.
`scripts/verify-chat-roundtrips-local.mjs` proves actual Expo customer and separate
web staff intakes, claim, automatic replies, drafts, files where supported, history,
end/continue, new conversation, callback/follow-up/resolution and stale/cross-team
denials. `tests/e2e/staff-admin-account.spec.ts` proves owner email OTP, independently
scoped staff creation, correct queues, mobile OTP/refresh/read denials and preserved
web admin session. Brokerage admin-assignment E2E proves versioned handoff/requeue.

Active-member Support handoff uses a disposable fixture; its absent admin control
is recorded as WEB-MOB-014. Production owner identity inspection was read-only and
found no conflicting association, requiring no live account deletion/change.
Shared Expo browser screens are tested; native OS permissions/background delivery
and production conversations are not certified. Exact receipts and cleanup are
recorded in MOBILE_IMPLEMENTATION.md.

## Simplified Tracking email sessions — local evidence, 2026-09-28

This section records the September28 historical 30-minute design. The current
FEAT-TRK-001 and FEAT-ENT-001 contract uses a five-minute email session,
one provider-selected shipment-owner email, and owner-managed status-only
viewer invitations. The owner and explicitly authorized business staff may
see current vehicle location; ordinary viewers may not. Current browser
coverage is `tests/e2e/tracking-parties.spec.ts`; the October19 desktop/phone
local owner-sharing run passed, while the complete release gate remains open.

FEAT-TRK-001 / FEAT-REV-001, ADR-073, NR-01/02/03/08/10/13: migration 114
adds email-only OTP, paginated current-recipient shipment listing and owner-scoped
review submission. Signed sessions enforce thirty idle minutes and eight hours
absolute; deliberate foreground activity renews them, reads/polling do not.
Current recipient grants still gate detail/proof/review reads and writes.
Legacy shipment cookies cannot acquire email-wide access.

`tests/sql/tracking-email-session.sql` and catalog security pass. Forty-seven
focused unit tests cover session bounds, recipients, emails, localization, proof,
rate limits and creation responses; TypeScript/source/spec checks pass. Eight
distinct desktop/phone cases pass across tracking-email-session, tracking-parties,
tracking-completion-review and tracking-proof-audit. Actual local email delivery,
file bytes and persisted reviews are verified; private roles/revocation, replay,
logout and expiry are denied as specified. Exact runs, early failures, corrections
and limits: [Tracking review](../docs/TRACKING_ACCESS_REVIEW_2026-09-28.md).
Owner visual approval and exact-release migration/build/CI gates remain pending;
no hosted rollout or new production SMTP verification is claimed.


## Fleet location bootstrap and recovery — local evidence, 2026-09-28

FEAT-FLT-001 / FEAT-CAP-001 / FEAT-TRK-001, ADR-072 and
NR-01/02/03/08/10/13: migration 113 separates the assigned driver's approximate
location from capacity-edit authority; preserves owner-authored duty recovery;
rejects omitted GPS; and keeps location/history private. Regression SQL:
`tests/sql/driver-location-bootstrap.sql`, plus six existing assignment,
eligibility, invitation, lifecycle and security/boundary suites. Catalog checks
pass. Thirty-five focused unit tests, TypeScript and source/spec checks pass.

Twenty-six distinct desktop/phone cases pass across fleet-onboarding,
fleet-vehicle-registration, lifecycle-recovery, capacity-signal-dialogs,
tracking-location-controls and fleet-location-map-resize. These include real local
email-code signup and backend persistence, permission revocation, first-location
owner publication, Off Duty recovery, map layout resizing and bounded foreground
Tracking. Exact run evidence, interrupted runs and external tile limits:
[the fleet audit](../docs/FLEET_WORKFLOW_AUDIT_2026-09-27.md).
Local implementation only; owner visual approval, complete release gates and
hosted migration 113 remain pending. No assertion of real-device GPS testing.


## Provider-only live support — local policy, 2026-09-24

FEAT-SUP-001 / FEAT-GST-001 / FEAT-TRQ-001 / FEAT-LUX-001 supersede the public
Help launcher and guest-write behavior in older evidence below. One Arrange
transport → Send request form feeds Brokerage. Provider dashboard support remains;
limited-plan providers retain its desktop/phone navigation and More-menu entry.
Migration 108 retires public writes at SQL and application boundaries while keeping
private history, files and staff assignment/closure. Protected local function
backup plus rollback rehearsal confirmed all six support tables unchanged.

Focused evidence: 18 unit/catalog checks; provider-only-support, support-history,
support-attachments and support-polling SQL; database catalog security; managed
support verifier. Browser tests cover hydration, retired API denial, one launcher,
stale session state, request/admin follow-up, archive recovery/history/files,
separate Brokerage/team permissions and all provider identity types. Evidence and
passing navigation checks are recorded in PROGRESS. No hosted changes.


## Separate inquiry teams — local review ready, 2026-09-24

FEAT-TRQ-001 / FEAT-GST-001 / FEAT-SUP-001 / NR-01/02/03/08/10/13:
migration 104 adds default-off Brokerage, scoped claims, admin handoff, private
history, access-loss requeue and admin guest-Support assignment. It supersedes
the admin-only transport inbox authorization below while preserving its route.
`tests/sql/brokerage-assignment.sql` and `transport-requests.sql` pass with the
catalog security check. `tests/e2e/brokerage-workflows.spec.ts` has six passing
phone/desktop cases: real public submission → correct team → email-code login →
claim/reply → admin handoff → closure, cross-team denial, concurrent claims,
revocation, conditional polling, stale draft rejection, mobile navigation and
FIFO guest-chat claim eligibility/persistence.
`public-assistance-dock.spec.ts` adds four passing cases for outside selection,
draft retention and restored mode. Thirty transport/localization/email unit tests
pass. Final visual captures and remaining review/release gates are in PROGRESS.
No production migration, real staff provisioning, SMTP change or deployment.


## Launch clarity and language — local implementation, 2026-09-24

FEAT-LUX-001 / FEAT-LNG-001 / NR-08/13 → guest Share your trucks entry and joined
floating Ask for help / Request transport actions (no added map-top strip),
explicit visitor GPS, accurate driver/setup guidance, separate shipment/email
code labels, private callback summary and bounded access/creation recovery.
Owner placement revision: 14 focused desktop/phone cases pass, including
`public-assistance-dock.spec.ts` direct panels/drafts/existing conversation,
320/390/760px language layout, hydration and selected-map controls. The subsequent
owner correction removes internal task tabs: eight focused desktop/phone cases
pass for one-task panels, preserved drafts/restored mode, chat lifecycle and
unread-message isolation. Captures: `artifacts/single-assistance-panel-20260924/`. Preview
captures and pending owner approval are recorded in PROGRESS.
Nine focused unit checks pass across browser requests, route success/outbox
separation and language catalogs. `resources/i18n/launch-message-keys.json`
covers 119 curated message groups; user values and placeholders are preserved.
Twenty-four focused desktop/phone cases pass across runs, including real local
email-code Tracking and fresh fleet/driver onboarding. Capture paths, development
harness corrections and owner review state are recorded in PROGRESS. Local preview only;
no assertion of full-language coverage, native fluency or deployment.


## Private transport requests — local review ready, 2026-09-23

FEAT-TRQ-001 / NR-01–04/08/10/13 → four-field public form and bounded POST,
service-only migration 103, active-ADMIN Support inbox, paginated status filters,
call link and version-checked offline follow-up. `tests/transport-requests.test.mjs`
passes (2); `tests/sql/transport-requests.sql` proves role/ACL/RLS denial, retries,
retention, stale writes, pagination and contact-free audit. Resulting catalog
security check passes. `tests/e2e/transport-requests.spec.ts` and
`transport-request-api.spec.ts` pass on desktop/phone (6), including actual local
submission-to-admin persistence and no email delivery. Existing chat history
recovery (2) and assisted chat (8) pass. Four catalog tests, typecheck, source/spec
checks pass. Captures: `artifacts/transport-requests-final-20260923/`.
Applied locally only; owner visual review, complete release gates, protected
rehearsal of migrations 102/103 and production rollout remain outstanding.


## Language coverage follow-up — 2026-09-23

FEAT-LNG-001 → whole-message profile counts/service copy, distance filters,
pagination, tracking status/save/feedback and translated workspace/provider roles.
`tests/localization.test.mjs` covers every tracking progression label in all four
catalogs; four localization tests plus three progression tests pass.
`tests/e2e/localization.spec.ts` covers preserved form/provider content and filter
values; `tests/e2e/tracking-progress.spec.ts` covers translated actions, unchanged
notes and persisted machine statuses. Results and capture paths are in PROGRESS.
Coverage remains incomplete: 439 missing fixed messages and 126 dynamic boundaries
requiring review. Strict audit intentionally exits nonzero. See
[the remaining review inventory](../docs/LOCALIZATION_REVIEW.md). No deployment.

## Owner-first transporter profile — local review, 2026-09-23

FEAT-PRV-001 / NR-13 → provider page, native fleet disclosure, anchored Pagination,
continuous truck ordinals and bounded provider regular-service labels. Four
paging/metadata unit tests and six desktop/phone browser cases pass; one truck
renders directly, multiple trucks expand on request and every paged truck stays
reachable. Independent/company scopes, unpublished denial and private-field
exclusion remain covered. Actual Rift Valley captures and bookmarked reload
checks: `artifacts/provider-layout-owner-20260923/`. Owner review and extensive
release gates remain pending; no production change.

## Local entity documents and language foundation — 2026-09-23

FEAT-VER-001 → migration 102, verification-summary, public/private repository
projections, company editor, truck detail and submission form. Focused SQL
authorization/expiry/reassignment/private-file checks and four desktop/phone
document browser cases pass. Production remains at schema 101 for this task;
new document behavior is local only. Owner review and full gates remain pending.

FEAT-LNG-001 → explicit Text/Localized boundaries, first-party language cookie,
lazy catalogs and shared public/dashboard picker. Three catalog/core tests,
desktop/phone login/About persistence, unchanged user text/machine values in the
document workflow, and 320/390/760px map-header separation pass. Translation
coverage and natural-language review are incomplete; run
`node scripts/audit-localization.mjs --strict` for the current static gaps.
Metadata, emails and dynamic strings are separately outstanding.

## Owner demo aliases — 2026-09-23

FEAT-IAM-001 / NR-14: 154 local and 152 live tagged identities now use the
owner's distinct plus aliases. Protected exact-plan receipts verify Auth/profile
email, immutable IDs, roles and confirmation/active state; local forward and
rollback rehearsal passes. Desktop/phone normal local OTP login and absence of
manual password shortcut pass; live code request passes. Owner confirmed Gmail receipt on 2026-09-23. `tests/production-pilot-policy.test.mjs` covers existing
address preservation and foreign-identity rejection; `tests/auth-flow.test.mjs`
keeps plus tags distinct and fixture credentials non-production. Quality passes
332 tests. See `docs/operations/DEMO_ACCOUNT_EMAILS.md` for private evidence and
reset/relay limits. No new application release was needed for these account edits.

## Verified deployment — 2026-09-23

Commit 200c783 / Netlify 6ab3aaa9668f9644dcba97d8 / CI 35843724742:
all required jobs pass, with the single browser retry explicitly retained.
FEAT-SEC-001: restored backup, rehearsed/applied migrations 098–101, catalog,
Data API and spatial checks pass. FEAT-IAM/LST/SHR/VER: published desktop/phone
login presentation, map filters/reset, account access and exact authorized file
bytes with guest denial pass. Shared-leg native taps and minimum clearance pass
at two zoom levels on both viewports using accessible SVG labels. UIA-23 remains
open for constructor-time classes/custom hover-focus styling; the development
CSS-selector probes do not pass against the production SVG. See PROGRESS and
DEMO_READINESS_2026-09-23 for evidence paths and Safari/GPS/inbox limits.

## UIA-22 release correction — 2026-09-23

FEAT-LST-001: full retry-target/header separation, native retry/chat/close clicks,
zoom access and viewport containment pass on desktop and 320/390/760px phones.
The support launcher has a reserved compact phone-header position. Ten focused
map/reset/admin cases pass in `artifacts/ci-map-final-20260923/`; both final
FEAT-SHR-001 private-map/gesture/OTP/logout cases pass separately in
`artifacts/ci-private-verified-20260923/` with scoped records and post-logout 401.
The earlier CI failure and test synchronization corrections are retained in
PROGRESS and the UI audit. No forced interactions, permission changes, real
customer writes or hosted publication are part of this local verification.


## Authorized demo corrections — 2026-09-23

FEAT-BIL-001 / FEAT-VER-001: all six desktop/phone Review Center cases pass
with exact fractional ETB, excluded pending pairings, preserved approvals and
server-persisted decisions (`artifacts/demo-fixes-20260923/`). FEAT-CAP-001:
the unchanged fleet onboarding test passes both viewports sequentially, including
restricted, tracking-only, capacity-only and full permissions, first publication,
320px touch action and removal denial (`artifacts/demo-serial-20260923/`).
FEAT-LST-001 / FEAT-SHR-001: map label separation passes on both maps; the
private drawer and Clear all pass on both viewports in the same serialized run.
`npm run quality` passes 331 tests, source/spec validation and TypeScript.
FEAT-REV-001: both completion-email → fresh customer OTP → published review
cases pass in `artifacts/demo-completion-final-20260923/` (1.4 minutes), using
only codes from the received completion email. The test waits for each specific
streamed destination response before asserting its flash and stored status.
Initial concurrent dev-server timeouts are retained in demo-readiness evidence.
The owner accepted the earlier preview and authorized the corrections/release;
normal CI, backup/restore, immutable artifact and production checks remain required.


## Demo workflow assessment — 2026-09-23

FEAT-SHP-001 / FEAT-TRK-001 / FEAT-SHR-001 / FEAT-SUP-001: eight fresh
desktop/phone cases pass for Tracking creation, two recipient OTP logins,
uploaded proof bytes and denial, private capacity sharing and live chat.
FEAT-REV-001: two new browser cases pass for all five completion status actions,
actual local completion email, guest OTP/review code, visible review publication,
one persisted Published row and reload. TypeScript passes. Evidence and limits:
[demo readiness assessment](../docs/DEMO_READINESS_2026-09-23.md). No new product
behavior, real email, hosted changes or deployment; previous visual approval
requests remain pending. Actual-inbox, Safari/device and delegated-permission
combination coverage is not implied by these ten local Chromium cases.

## New Driver first capacity — 2026-09-23 (local owner review pending)

FEAT-CAP-001 / UIA-21: an actual new fleet, emailed-but-unverified Driver,
assignment and inbox-code login reproduce the original truck-header obstruction
in `artifacts/new-driver-before-20260923/`. The corrected no-map layout separates
identity and setup, adds Set capacity, and keeps controls disabled until client
handlers attach. Both desktop/phone `fleet-onboarding.spec.ts` scenarios pass
with the held-script first-click test and stored truck/actor/Private visibility
assertions, followed by removed-Driver access denial. Evidence:
`artifacts/new-driver-review-20260923/`.

All ten existing `capacity-signal-dialogs.spec.ts` desktop/phone cases also pass:
actual saves, preserved map identity, cancellation/error recovery, fleet-owner
location restrictions, anonymous denial and first-publication/status changes.
Evidence: `artifacts/new-driver-dialog-regression-20260923/`. Six capacity adapter
checks, typecheck and source/spec validation pass. No permission/schema change
or hosted write; fresh owner visual review precedes full release gates.

Final `fleet-onboarding.spec.ts` run also passes both projects after adding a
320×640 phone action/hit-target check, Cancel-with-zero-records assertion and
real loaded-tile verification after Save. Desktop/phone setup and saved-map
captures were inspected: `artifacts/new-driver-final-20260923/` (two passes,
2.9 minutes). These strengthen the same two scenarios, not additional distinct
cases. Twelve distinct focused browser cases pass for this capacity correction.

## Email-only login and Clear all — 2026-09-23 (local owner review pending)

FEAT-IAM-001 / FEAT-UIX-001: a compact email-only card replaces the login's dual
panel/Google choice. Google start routes and callback reject even an existing
signed handoff before OAuth/session exchange. `email-only-login.spec.ts` passes
on desktop/phone with real local inbox delivery, wrong-code rejection and valid
email-code login; captures include request, code and invalid-code states. Ten
`auth-flow.test.mjs` checks, typecheck and source/spec checks pass. Responsive
320/640/1440px checks pass on phone; the first desktop run timed out navigating
`/apply`, and one unchanged controlled retry passed. No hosted provider settings
or credentials were changed, existing sessions remain, and real Google consent
or production email delivery is not claimed.

FEAT-LST-001 / FEAT-SHR-001 / UIA-20: two reproductions failed before the shared
query-state reset (Private applied filters, Open same-URL drafts). Focused
Open/Private desktop/phone checks now pass, including query/default inputs,
unchanged drawer behavior, restored unfiltered viewport, real private-email
OTP, scoped results and logout denial. Evidence:
`artifacts/login-clear-review-20260923/` and
`artifacts/login-reflow-retry-20260923/`. Full release checks await the owner’s
review of the new login. Earlier release candidate 14aeb7b and its CI were
superseded before any production migration/publication.

Final four desktop/phone checks pass in `artifacts/login-clear-final-20260923/`:
account navigation/session state, applied-filter and selected-truck Clear all,
and clearing modal edits on an already-unfiltered URL. Fourteen distinct focused
browser scenarios now pass across the recorded runs, with the one controlled
responsive retry disclosed above. Owner visual review remains pending.


## Corrected candidate release approval — 2026-09-23

Following the corrected local preview and review request, the owner directed
“ok now lets deploy our changes.” The partial shared-leg and closed-outline
corrections below are accepted for this release. Local quality passes 329 tests,
source/spec checks and TypeScript; the six focused desktop/phone cases remain
the current interaction evidence. Exact-commit CI and hosted rollout are pending.

## Partial shared-leg correction — 2026-09-22 (local review pending)

Final combined focused run: six desktop/phone cases pass in
`artifacts/map-overlap-final-retry-20260922/`, including native shared-leg
selection, coincident closed outlines and detail-card gestures. Typecheck,
source/spec validation and all ten geometry cases pass. A prior run could not
connect to the stopped dev server; after restarting it and confirming HTTP 200,
the controlled retry passed. Owner visual approval remains pending.

FEAT-GEO-001: `tests/map-signal-offset.test.mjs` has ten passing cases, including
96 orientation/reversal combinations. The screenshot regression failed before
segment-aware avoidance and passes after it. Cases also cover partial collinear
segments, inserted vertices, near-parallel strokes, route/polygon edges, winding,
closed joins, bounded sharp turns and tiny areas. `map-shared-segment.spec.ts`
passes actual local JAC X200 shared-leg click/touch checks at two zoom levels,
with no API geometry mocks. Clearances are measured along the shared leg and
native taps use exposed integer-pixel dash centers. Phone checks pan normally
below the existing truck card. Captures:
`artifacts/shared-segment-pixel-20260922/desktop-shared-route.png` and
`artifacts/shared-segment-pixel-20260922/mobile-shared-route.png`.
The synthetic closed-outline checks also pass on the segment-aware renderer.
Earlier preview approval request is superseded; this visible correction is not
approved, committed, or deployed yet. The release objective remains active.

## Closed map outlines — 2026-09-22 (local review pending)

FEAT-GEO-001: four pure regressions in `tests/map-signal-offset.test.mjs` pass.
`tests/e2e/map-signal-overlap.spec.ts` passes desktop and phone native click/touch,
keyboard and zoom checks for coincident areas and reversed closed routes, plus
the unchanged blue location circle. Tests sample stable, exposed strokes and use
normal actionability checks; no forced clicks. Synthetic viewport geometry is
explicitly limited to renderer stress coverage; actual basemap tiles remain.
Screenshots: `artifacts/signal-overlap-fitted-20260922/`. Initial failing checks
and their timing/first-fit corrections remain in protected local logs. Typecheck
and source/spec checks pass. Four additional desktop/phone cases confirm the overlap fix and retained
wheel/drag/touch behavior in `artifacts/signal-overlap-confirmed-20260922/`.
Full CI and deployment remain after owner review.

FEAT-LST-001 / FEAT-SHR-001 release corrections separately cover drawer state,
feedback location, debounced viewport startup, selected card/zoom/Filters access
and the narrow-phone card collision. Eight focused Open/Private/feedback cases
passed, followed by desktop and phone final card checks (phone passed one
controlled retry after a request remained loading). CI run 35609759724 remains
failed; no successful replacement CI or new production deployment is claimed.

## Platform positioning — 2026-09-21 (local owner review pending)

FEAT-MKT-001 editorial clarification: About, public metadata, sign-in/setup,
Private capacity entry, Network, Tracking and Verification now describe capacity
sharing and shipment collaboration led by transporters, with optional document
review supporting customer assessment. Typecheck and source/spec checks pass.
Eighteen desktop/phone route captures report HTTP 200, no horizontal overflow and
no page errors in `artifacts/narrative-review-2026-09-21/`. About CTA destinations
and signup entry redirect remain correct. Authenticated initial setup copy was
source-reviewed only. A separate phone action hit-test found the UIA-16 overlay
obstruction; no claim of full usability or release completion. No hosted changes.

## Capacity drawer — 2026-09-21 (local visual review pending)

FEAT-LST-001 / FEAT-SHR-001: shared Open/Private drawer and More filters modal,
one draft form, unchanged scoped endpoints and no map remount. Fourteen distinct
focused desktop/phone cases pass: `capacity-filter-drawer.spec.ts` (six), focused
accessibility (two), map-clarity city filtering (two), loading-feedback lookup
(two), and smoke route endpoints (two). Real Mailpit OTP and an isolated published
provider/truck/grant prove Private filtering and logout. Actual phone touch and
mouse drag, inert/focus behavior, reduced motion and CTA hit testing are included.
Typecheck and source/spec checks pass. Captures: `artifacts/capacity-drawer-final-2026-09-21/`;
search/lookup evidence: `artifacts/capacity-drawer-search-2026-09-21/`.
Two broader public-entry cases still fail after their map steps because the local
Featured projection has zero sponsors while the test assumes a sponsor rail;
see QA-01 in the UI audit. No full-suite/release pass is claimed. Owner visual
review remains required before extensive gates and separately authorized rollout.

## Review workflow continuation — 2026-09-21 (local visual review pending)

FEAT-ADM-001 / FEAT-VER-001 / FEAT-BIL-001 / FEAT-REV-001 → UIA-09–12 and
UIA-15 in `docs/UI_BACKEND_AUDIT_2026-09-21.md`. Five new pure regressions plus
three Verification/Billing runtime checks pass. `tests/e2e/review-workflows.spec.ts`
passes all six desktop/phone cases: actual document uploads/private downloads,
review notes and status, paid-plan transition, uphold/remove publication rules,
provider denial, terminal replay denial, filtered return context, stale/fractional
pages, and approved-truck exclusion. Delayed-script checks verify dependent
selectors wait for readiness. Two focused Fleet Add-driver clarity cases also
pass. Typecheck and source/spec checks pass; screenshots inspected in
`artifacts/review-workflow-audit-2026-09-21/`,
`artifacts/review-workflow-readiness-2026-09-21/`, and
`artifacts/review-workflow-corrected-2026-09-21/`.
All records/files were synthetic and local; no remote payment or customer email
delivery was performed. NR-10 private-file denial and NR-13 local owner review
remain enforced. Full release gates await owner visual review; no hosted release.
UIA-13/14 remain recorded follow-ups, not completed work.

## UI/backend contract audit — 2026-09-21 (local visual review pending)

FEAT-ADM-001 / FEAT-UIX-001 / FEAT-BIL-001 → UIA-01–08 in `docs/UI_BACKEND_AUDIT_2026-09-21.md`. Migrations 100/101 and `tests/sql/dashboard-activity.sql` / `tests/sql/admin-service-geometry.sql` pass rollback regressions and catalog checks. The migrations are applied only locally. `tests/e2e/ui-contract-audit.spec.ts` covers eight distinct desktop/phone cases: actual admin-save persistence/context and missing-record denial, truthful capacity/admin-plan presentation, authoritative Home projection, stale/invalid pagination and area/list-detail agreement. All pass, along with typecheck and source/spec checks. The read-only audit covered 44 page/role visits and traced 151 distinct POST targets; this is not exhaustive action coverage. Screenshots are in `artifacts/ui-contract-review-2026-09-21/` and `artifacts/ui-contract-additional-review-2026-09-21/`. Owner visual approval precedes full release gates; no hosted release.

## Driver assignment before email verification — 2026-09-21 (local review pending)

FEAT-FLT-001 / FEAT-IAM-001 / ADR-068 / NR-02/03/09 → migration `099_driver_assignment_before_email_verification.sql`, `addFleetDriver`, `/api/fleet/drivers`, and Add driver UI. `tests/sql/driver-preverification.sql` proves unconfirmed assignment, denied unverified projection, same identity after confirmation, private-phone preservation, conservative permissions, safe duplicate addition, mismatched identity/other-fleet/provider/reserved/suspended account denial, revocation/history and browser privilege denial. Legacy invitation SQL and catalog security checks pass. `tests/e2e/fleet-onboarding.spec.ts` passes on desktop and phone with real local Mailpit OTP: assign while unconfirmed, reject a wrong code, verify login without Join fleet, publish, access Tracking, edit contact and revoke. Five focused unit tests, typecheck and source/spec checks pass. Migration applied only locally; no hosted rollout. Captures: `artifacts/driver-preverification-review-2026-09-21/`. Owner visual approval precedes full gates.

## City proximity and map clarity — 2026-09-21 (local review pending)

FEAT-LST-001 / FEAT-GEO-001 / NR-13 → `capacity-filter-places.js` resolves the independent city criterion, `capacity-viewport.js` maps it to the existing uncertainty-aware reported-location query, and public/shared/admin pages and APIs preserve it through pagination. `capacity-filter-places.test.mjs` and `capacity-viewport.test.mjs` cover invalid-city denial, independent geography and city precedence over device coordinates. `tests/e2e/map-clarity.spec.ts` covers real catalog selection, matching returned coordinates across pages, guest denial of the shared API, blue location/orange regular service, compact key bounds and wheel/drag/touch behavior with detail cards. Seven unit checks, ten focused desktop/phone browser cases, TypeScript and source/spec validation pass. Captures: `artifacts/map-clarity-review-2026-09-21/`. Owner visual approval and full gates remain pending. No database migration or remote changes.

## Loading feedback and random Featured rounds — 2026-09-21

FEAT-UIX-001 / FEAT-LST-001 → shared `LoadingIndicator`, map `SurfaceSkeleton`, route fallback and search/place/member consumers. `tests/e2e/loading-feedback.spec.ts` checks actual deferred scripts/network responses, desktop/phone geometry, unobstructed controls, accessible status, editable inputs and reduced motion. Captures are in `artifacts/loading-review-2026-09-21/`. Existing records/forms/chat/Featured skeletons remain content-shaped. Owner review and full release gates are separate.

FEAT-FTR-001 / ADR-067 / NR-01/03 → migration `098_featured_random_rounds.sql` and `tests/sql/featured-random-rounds.sql` (random draws, global exhaustion, exact-pair changes, inactive eligibility, retry, retained history and browser denial). Rehearsal and resulting catalog checks passed; applied only locally without changing saved rosters. Existing `tests/sql/platform-controls.sql` passes. `tests/featured-providers.test.mjs` checks 1–12 actual roster sizes, equal minute allocation and time boundaries; UI/type tests preserve themes/projection. Fourteen focused unit tests and the desktop/phone Featured administration workflow pass. A separate two-session local check confirmed lock contention returns without generation. CI includes the new SQL regression but has not run remotely for this change.

## Restore map interaction — 2026-09-21 (owner visually approved)

FEAT-LST-001 / FEAT-GEO-001 / BASE-DEP-001 / ADR-066 / NR-13 → automatic
viewport loading in `capacity-map-loading.js`, the shared feed and Leaflet map.
The separate summary renderer, extra confirmation and manual loading controls are
removed. `tests/capacity-map-loading.test.mjs` proves all 154 records remain across
11 automatic pages, deduplication, selected retention, abort/stale denial and
cursor/failure stopping. Nine clustering unit tests include the crossing-offset
label regression that fails before the correction. Six focused desktop/phone
browser cases pass in `map-cluster-transition.spec.ts` and the dense-map smoke
case; TypeScript/source pass. Owner approved the restored map with “its good”.
Full gates and rollout remain pending, and the new loading changes need a separate review. Earlier aggregate/140-retention claims below are historical for the old
client; that integration is withdrawn, and national-scale client optimization is
deferred rather than imposing extra user interaction. See the map incident record.

## Chat initialization and fixture diagnostics — 2026-09-20

FEAT-GST-001 → disabled-until-hydrated public launcher and the delayed-script
regression in `tests/e2e/assisted-chat-audit.spec.ts`. It failed before the fix;
14 focused desktop/phone cases then passed with zero retries, including all five
previously retrying chat/history cases per viewport. BASE-DEP-001 → local-only,
bounded pre-import schema read and four diagnostic/redaction tests in
`tests/fixture-schema.test.mjs`. See `docs/AUDIT_READINESS_2026-09-20.md` for the
still-unconfirmed historical HTTP 500 cause and remaining release evidence.

## Security recurrence prevention — FEAT-SEC-001 / ADR-065

Extension relocation compatibility: the anonymous monitor uses existing
application relations and keeps exact guard-denial assertions; a missing public
extension route is no longer a dependency. Its regression failed before the
change. All 305 unit tests, specs/source and types passed, along with real local
SQL/REST/GraphQL/fixture-Auth checks and three live anonymous probes. The local
verifier exercises service reference access through SQL and a geographic
application RPC instead of requiring the extension table in the REST schema.
Provider execution and independent hosted catalog/advisor checks remain separate.

`docs/SECURITY_REGRESSION_REGISTER.md` maps NR-01–NR-10 to prevention, negative
checks, operational responsibility and enforcement limits. AGENTS, guardrails and
the PR template require the relevant lessons before sensitive changes. The
catalog verifier now rejects eleven deliberately unsafe states, including future
table/sequence defaults and a newly default-executable definer function. Its
fixtures roll back and preserve normal service access. Request-boundary evidence
covers SQL roles, real local REST/GraphQL, 300 unit tests and eight desktop/mobile
account/fleet cases. Hosted verification and active scheduled/provider controls
require separate operational evidence; they are not inferred from this matrix.


FEAT-SEC-001 / FEAT-IAM-001 / BASE-BE-001 / ADR-064 → migration 096,
application ACL/definer catalog gate, tests/sql/browser-boundaries.sql and
scripts/verify-database-security-gate.mjs. Actual active-session access failed
before repair and was denied afterward; inactive-session CRUD, own identity,
service/history, future grants and eight injected gate failures passed locally.
All 16 SQL suites, 297 unit tests, spec/source, TypeScript and build passed.
Focused desktop/mobile and clean-CI evidence are recorded in BUILD_VERIFICATION;
hosted rollout is separate.

FEAT-SEC-001 / ADR-063 → exact owner PostGIS containment, public-table catalog gate,
role denial SQL and scoped read-only advisor monitor. Local regression evidence
and pending provider-side enforcement are recorded in PRODUCTION_AUTHORITY.md;
no hosted resolution is implied.

## Release packaging and browser readiness — 2026-09-14

BASE-DEP-001 F26 → `.dockerignore`, Dockerfile builder guard and CI non-secret
canaries. A scratch context build proved application presence and private-state
exclusion; the normal container gate remains pending after Docker Hub DNS failure.
F25/F27 browser/fixture corrections → 158 enabled cases have passing evidence
across the full diagnostic run and focused retries; eight opt-in captures skipped.
CI includes all 14 rollback SQL suites and six concurrent authorization cases.
See BUILD_VERIFICATION and AUDIT_RELEASE_CANDIDATE for exact results and gates;
these do not imply a clean full-suite run or hosted rollout.

## Recorded-audit contracts — verified locally

| Contract | Implementation | Evidence and remaining gate |
|---|---|---|
| FEAT-FLT-001 / FEAT-TRK-001 / FEAT-ADM-001, ADR-058 | lifecycle port/controls/routes; migrations 090–091 | Four lifecycle unit tests, rollback SQL and two queued former-Driver cases passed; desktop/phone lifecycle browser passed |
| FEAT-IAM-001, ADR-059 | account-security handoff, own-session Auth routes/controls; migration 092 | Four validation/handoff tests, `tests/sql/account-security.sql` and four concurrent closure cases passed; desktop/phone inbox/browser passed under local Auth settings |
| FEAT-LST-001 / FEAT-MAT-001, ADR-060 | bounded map windows, public aggregate cells, private SQL filtering; migration 093 | Unit tests, viewport SQL, 5,000-truck scale/EXPLAIN and throttled desktop/phone browser passed; dense-map regressions passed on both viewports; eight clustering tests include the F21 failing-before-fix reproduction |
| FEAT-PRV-001, ADR-062 | Public metadata/name SQL projections; migration 095 | Hidden-contact/path/surname SQL assertions and independent/company desktop/phone HTML privacy checks passed |
| FEAT-SUP-001 / FEAT-GST-001, ADR-061 | authorized revisions, conditional HTTP, no-overlap/backoff polling; migration 094 | Conditional tag test, `tests/sql/support-polling.sql` and desktop/phone `tests/e2e/support-polling.spec.ts` passed |

Final quality: 290 tests, TypeScript, 28 specs and 349 source checks. All 34
affected browser cases passed across focused runs; BUILD_VERIFICATION records
final build evidence and exact scope. These entries do not imply hosted rollout
or visual approval.

FEAT-LST-001 F22/F24 → PublicCapacityFeed feedback in the selected summary and
phone summary width reserves zoom controls. `tests/e2e/map-feedback.spec.ts`
proved the old overlap/intercepted click, then passed desktop/phone at six widths
including 320px with loading, failed refresh, real retry and closing. Shared
public/private shell and dense-map regressions passed; screenshots were inspected.
F23 corrects stale spatial/polling headings to match previously passing evidence.

## 2026-09-14 member Support attachments (local)

FEAT-SUP-001 / BASE-BE-001 / BASE-DEP-001, ADR-057 → migration 089,
`support-attachments.js`, SupportThread multipart replies, private attachment
route, and managed cleanup worker. Five tests cover input bounds, safe names,
delete ordering and retryable failures; the worker test verifies bounded safe
counts. `tests/sql/support-attachments.sql` proves atomic attachment, idempotent
retry, current ownership/assignment/permission/activation, closed-history reads,
stale/failed cleanup and service-only permissions.
`tests/e2e/support-attachments.spec.ts` proves real member PNG/staff PDF browser
uploads/downloads, invalid-content cleanup, retained older/closed history and
cross-conversation/member/anonymous/reassigned-staff denials on desktop/phone.
Final gate evidence and rollout limits are in BUILD_VERIFICATION.

## 2026-09-14 Tracking foreground location controls (local)

FEAT-TRK-001 / BASE-FE-001 / BASE-BE-001, ADR-056 →
`tracking-location-controls.js`, ProviderTrackingControls and the recipient
Tracking guidance. Seven pure tests cover radius/result validation, hidden
callbacks, cancellation, fetch abortion, single-flight ownership and retry.
`tests/e2e/tracking-location-controls.spec.ts` exercises real local travel and
location persistence, privacy radii, server/client cooldown, delayed-GPS selection retention, hidden callbacks,
permission retry and local Mailpit recipient access on desktop/phone. Sensor
coordinates and visibility transitions are simulated; server persistence is
real. Final evidence and limits are in BUILD_VERIFICATION.


## 2026-09-14 public provider fleet paging (local)

FEAT-PRV-001 / FEAT-LST-001 / BASE-BE-001, ADR-055 → migration 088,
`public-provider-paging.js`, public provider repository projection, canonical
provider page and ProviderFleetShowcase count labels. Input/adapter tests are in
`tests/public-provider-paging.test.mjs`; rollback SQL proves complete fleets over
96 signals, owner scope, page limits, stable evidence and public visibility.
`tests/e2e/public-provider-paging.spec.ts` traverses independent and Company fleets
on desktop/phone, opens a late truck map, checks hidden fields, browser Back and
invalid/out-of-range pages. Final evidence is in BUILD_VERIFICATION.


## 2026-09-14 Driver portraits (local)

FEAT-FTR-001 / FEAT-IAM-001 / BASE-DEP-001, ADR-054 → migration 087,
`driver-portrait-image.js`, `driver-portrait-storage.js`, Account photo editor,
`/api/account/portrait`, `/api/public/driver-portraits/[id]`, Featured candidates
and signed managed cleanup. Pure image/Storage tests cover metadata removal,
format/animation/size denial, reserved references and failed-deletion retention.
`tests/sql/driver-portraits.sql` rolls back ownership, consent, replacement,
revocation, activation/cancellation/cleanup ordering, stale/retry boundaries and
browser-grant checks. `tests/e2e/driver-portraits.spec.ts` uses real local Storage
and exact synthetic Driver/provider/truck/Featured rows on desktop and phone.
It covers consent, rendered uploads, private bucket denial, Featured images,
replacement, malformed input, invalid actor, deactivation and removal fallback.
Final counts, screenshots and limitations are in BUILD_VERIFICATION.

## 2026-09-14 account maintenance and callback isolation (local)

`FEAT-IAM-001` / `FEAT-FLT-001` → `src/lib/account-details.js`,
`src/lib/identity/account-details.ts`, `/api/account/details`,
`src/components/account-details-form.tsx` and Account & plan. Migration 086
repeats active session-actor authorization and validation and preserves private
phone ownership during fleet edits. Shared names retain their current display
semantics; there is no general user-edit or Auth email-change command.

Evidence maps to `tests/account-details.test.mjs` (input and role policy plus
exact function replacement), `tests/sql/account-details.sql` (rollback-only
actor/input/grant denial, audit privacy, field isolation and state persistence),
and `tests/e2e/account-details.spec.ts` (real local visible saves, reloads,
clearing, invalid-input retention, authority/origin/inactive denial and public
callback snapshots plus native POST). Both account browser cases and both
existing fleet onboarding/contact cases pass on desktop/phone. Quality (256
tests, 28 specs, source checks and TypeScript) and the 84-page build pass.
Migration 086 is local only; final scope and limits are in BUILD_VERIFICATION.

## 2026-09-14 retained chat history and assignment denial (local)

- `FEAT-SUP-001`, `FEAT-GST-001`, `FEAT-LST-001`: migration 085 and
  `src/lib/support-history.js` / Support adapter provide bounded, stable,
  conversation-scoped message windows. Member, team, recovery and launcher
  history controls keep earlier messages reachable without unbounded DOM or
  response growth. History does not mark current replies read.
- Migration 084 replaces exactly four guest assignment predicates with
  NULL-safe denial. Existing service-role-only grants and file authorization
  remain; retain this repair if rolling back the history UI.
- `tests/support-history.test.mjs` checks cursor validation, window metadata,
  links and migration function inventory. `tests/sql/support-history.sql`
  checks 121-message traversal, tied timestamps, arrival stability, unread
  preservation, terminal pages, wrong cursors, inactive/unrelated actors,
  removed permissions, unassigned read/reply/closure/attachment denial,
  no denied side effects and browser-role RPC denial. All SQL changes roll back.
- `tests/e2e/support-history.spec.ts` passes on desktop/phone: four real local
  cases cover member/team and guest launcher/recovery/team paths and private
  Storage reads; two mocked-failure cases cover retry/draft retention. Six
  existing assisted-chat cases also pass. Eight focused screenshots are under
  `artifacts/support-history-2026-09-14/`. Complete gate status is recorded in
  `docs/BUILD_VERIFICATION.md`; no hosted rollout is implied.

## 2026-09-14 map/navigation overlap repair (local)

`FEAT-UIX-001` / `BASE-FE-001`: the shared desktop rail variables and bounded
public-market flex layout in `src/app/globals.css` are verified by
`tests/e2e/public-map-shell-layout.spec.ts`. Four desktop/phone cases exercise
Open and real email-unlocked Private capacity at ten widths (320–2560), short
phone reflow, header/navigation/session separation, viewport bounds, usable
map size, Filters dismissal and navigation away. Synthetic private grants are
revoked in cleanup. Sixteen screenshots: `artifacts/map-shell-2026-09-14/`.
Quality passes with 248 tests and TypeScript; complete gate status is recorded
in `docs/BUILD_VERIFICATION.md`. No database, authorization or hosted change.

## 2026-09-13 current-audit repairs (local)

- `FEAT-MAT-001`: `capacity-geographic-match.js` and
  `capacity-filter-places.js`, used by public/private/team projections;
  `tests/audit-geographic-matching.test.mjs`, `capacity-filter-places.test.mjs`,
  and desktop/phone `capacity-filter-validation.spec.ts` prove complete criteria
  and actionable invalid-place handling.
- `FEAT-GST-001`: `public-assisted-chat.tsx`, `guest-chat-refresh.js`, and current
  conversation API; `guest-chat-refresh.test.mjs` plus six desktop/phone
  `assisted-chat-audit.spec.ts` cases prove submission and bounded polling
  behavior. Chat transport is mocked only in these browser tests.
- `FEAT-SUP-001`: `support/team-authorization.js` and the team-creation adapter
  and route deny before external Auth writes. `team-authorization.test.mjs`
  covers role/persisted-active checks and command ordering.
- `FEAT-TRK-001`: migration `083`, `readProviderTrackingProof`, the event-specific
  proof GET endpoint and `TrackingProofLink` on three detail surfaces;
  `tracking-proof-access.test.mjs`, rollback SQL
  `tests/sql/tracking-proof-access.sql`, and real desktop/phone
  `tracking-proof-audit.spec.ts` cover Storage bytes, email OTP, revoked and
  unrelated access, and admin/provider/guest links.
- Gates: 248 tests, TypeScript, 28 specs, 319 source files, optimized build and
  10 focused desktop/phone E2E cases passed. No remote rollout or commit.
  See `docs/BUILD_VERIFICATION.md` and current audit for remaining gaps.

## 2026-09-13 empty-fleet lifecycle

`FEAT-FLT-001` / `FEAT-IAM-001`: migrations `081`–`082`,
`fleet-driver-management.ts`, the verified OTP/OAuth completion branches,
`/join-fleet`, `/app/fleet/drivers/new`, invitation/contact/vehicle-detail APIs,
Fleet controls and role-specific empty states implement invitation → verified
acceptance → assignment → publication → revocation. The shared membership check
matches migration `078` discovery eligibility. Contact changes and truck details
preserve identity and history.

Mapped evidence: `tests/fleet-onboarding.test.mjs`, rollback-only
`tests/sql/fleet-driver-onboarding.sql`, `tests/e2e/fleet-onboarding.spec.ts`,
`tests/e2e/driver-document-clarity.spec.ts`, existing truck-registration browser
checks, and `scripts/verify-supabase-workspace-fleet.mjs`. Both new-fleet browser
runs use real local Auth OTP and Mailpit invitation notification, never a seeded
Driver shortcut. Production rollout and real hosted Google acceptance remain
separate from this local checkpoint; see `docs/BUILD_VERIFICATION.md`.

## 2026-09-13 launch controls, automatic selection, and loading

`FEAT-BIL-001`: migration `079`, `platform-controls.js`, the `/admin/settings`
page/command, `subscription-access.js`, and the managed identity projection keep
Free / Trial-then-payment behavior consistent across UI and PostgreSQL. Mapped
tests: `tests/platform-controls.test.mjs`, rollback-only
`tests/sql/platform-controls.sql`, and `tests/e2e/platform-controls.spec.ts`.
The local verification/billing verifier checks Free-mode denial, then temporarily
enables paid mode for the existing positive payment-review assertions and restores
Free in cleanup; it still refuses remote targets.

`FEAT-FTR-001`: migration `080`, `featured-automation.js`, managed operations,
shared eligibility lookup, and Featured settings implement persistent automatic
selection and preserved manual days. The same SQL test checks current Drivers,
count, no duplicates, manual mode/drafts, retry invariance, and browser denial.
The unit contract checks all seven themes and rotation safeguards; worker tests
retain only sanitized counts. Focused browser tests exercise mode changes,
immediate preparation, and manual publication on desktop and phone.

`FEAT-UIX-001`: shared `SurfaceSkeleton`, route loading boundaries, component
fallbacks, and `NativeFormFeedback` map to unit accessibility/motion/submitter
contracts and the same browser suite's throttled map-module and native-save
checks. Evidence and production limitations are in `docs/BUILD_VERIFICATION.md`.

## 2026-09-13 Driver linkage and optional evidence

`FEAT-FLT-001` / `FEAT-CAP-001` / `FEAT-VER-001`: migration `078` resolves
the active independent or same-company assigned Driver, guards publication,
location/duty updates, and both capacity projections, and supplies the named
Driver to the authorized workspace. Fleet rows, truck details, and the map's
selected truck expose the relationship; separate expandable Driver/truck
document summaries never infer approval from an empty array.

Evidence: `tests/sql/capacity-driver-eligibility.sql` tests no-document
publication, inactive/unassigned/nonmember exclusion, independent identity,
and browser denial inside a rolled-back local transaction. CI runs this check.
`tests/driver-document-eligibility.test.mjs` tests missing/expired/wrong-truck
approvals. `tests/e2e/driver-document-clarity.spec.ts` covers desktop and phone
Driver navigation and safe expandable evidence. The 5,000-truck scale fixture
now supplies unique active assigned Drivers, retains its original bounded-page
and time assertions, and confirms rollback of both trucks and Auth identities.
Local gates and pending deployment are recorded in `docs/BUILD_VERIFICATION.md`.

## 2026-09-13 focused capacity editing evidence

`FEAT-CAP-001` / `FEAT-UIX-001`: `capacity-form.tsx` keeps the map mounted;
`capacity-edit-dialog.tsx` supplies the native modal/focus boundary;
`capacity-signal-editor.tsx` and `capacity-market-planning.tsx` isolate drafts.
The existing authenticated capacity routes negotiate JSON or native redirects.
Migration `077` preserves confirmed Driver fixes and atomically replaces regular
service. Mapped verification: `tests/e2e/capacity-signal-dialogs.spec.ts`, the
capacity-summary scenario in `tests/e2e/smoke.spec.ts`,
`tests/provider-capacity-supabase.test.mjs`, and
`scripts/verify-supabase-provider-capacity.mjs`. Responsive screenshots, quality,
build results, and the pending Production rollout are recorded in
`docs/BUILD_VERIFICATION.md`.

The follow-up split into Capacity, Coverage, Sharing, Loads, Regular, and Location
is covered by the same desktop/phone suite with real consecutive status/sharing/
preference saves, first-publication Private visibility, and Off Duty persistence.
The suite exposed a stale-snapshot race and a phone header/rail overlap before
their corrections. `tests/provider-capacity-supabase.test.mjs` additionally maps
known validation messages and redacted unexpected-database diagnostics.

| Feature | Frontend | Backend/domain | Deployment concern | Primary tests |
|---|---|---|---|---|
| `FEAT-IAM-001` | Google and numeric email-code transporter login and signup, safe reconciliation of confirmed pre-bootstrap identities, private account contacts, and public-first installable PWA shell with distinct Open capacity, Private capacity, Track, Featured, and workspace shortcuts | Supabase-only SSR PKCE session, fixed callback, signed flow-bound OAuth intent, signed 15-minute signup handoff, guarded inactive DRIVER bootstrap, active provider-role projection, Production-disabled Supabase-fixture password boundary, no signed-cookie/SQLite identity fallback, and explicit anonymous projection boundaries | `065_reconcile_prebootstrap_auth_profiles.sql`, exact Site URL/Redirect URL allowlists, browser-enforced CSP OAuth destinations, Google identity scopes, numeric email template, verified SMTP, session secret, proxy-safe redirects, service-worker cache boundary | `tests/auth-flow.test.mjs`, `tests/provider-signup-supabase.test.mjs`, `tests/security-headers.test.mjs`, visible-browser OAuth check, managed runtime boundary, managed identity, launch readiness, authorization, PWA manifest test, E2E |
| `FEAT-APP-001` | Immediate Fleet transporter, Owner-operator, or Self-managed driver signup after Google or email-code identity proof; seeker guidance to public browse | Signed 15-minute identity handoff, server-only provisioning intent, inactive Auth bootstrap, migration-installed minimum plan catalogue, and atomic operating-model/workspace/microsite/application/seven-day-trial provisioning with authority activated last | `045_managed_provider_signup.sql`, `072_required_plan_catalog.sql`, RLS/browser denial, rate limiting, audit, transactional rollback | managed signup contract, clean local Supabase signup verifier, hosted plan/eligibility diagnostic, E2E handoff |
| `FEAT-SHP-001` | Provider-created Tracking session and durable provider history; no demand posting or Shipment Board | Service-role-only managed Tracking commands, provider ownership, assigned truck/Driver scope, one customer-owner email, atomic grants/delivery/events, and governed transitions | `044_provider_tracking_runtime.sql`, private customer data, default-deny RLS, audit | domain, provider-tracking, managed Tracking authorization, E2E |
| `FEAT-CAP-001` | East-Africa-pannable map-only Truck Market with a stable command area, status-specific bounded clusters, maximum-zoom truck chooser, pointed truck pins, road-coherent multi-city current Capacity routes, nearby polygon Service areas, one provider-level regular Service area or Capacity route, independent capacity/location age labels, and unified provider summary/focused editors | Empty/Partial Service-area-or-route choice, old-signal visibility until Off Duty, five non-overlapping age stages, unmixed maximum-eight screen cells at least as wide as markers, complete Private-network truck exclusion from anonymous projections, 2–5 ordered road-sequenced route cities, location-aligned center plus 3–5 boundary cities, maximum-one regular signal, Driver-only obscured location mutation, explicit public projection | Browser geolocation privacy, shared-map provider, location-keyed fixture-replacement migration, `041_capacity_signal_age_visibility.sql`, anonymous-projection review | domain, clustering contract, capacity-market, focused E2E, typecheck, source check |
| `FEAT-PRV-001` | Uniform Loadgistic `/@handle` microsites reached from truck details, with detailed active-truck cards, lazy relative maps, evidence-based Fleet transporter, Owner-operator, and Self-managed driver labels, reviews, media, and independently visible contacts | Handle ownership, safe nested truck/capacity projection, provider operating-model derivation, actor-scoped managed business/contact/image commands, shared presentation, service-role-only published-review summary, hidden-contact exclusion | `049_managed_provider_profile.sql`, quarantine/scanner/private media, browser-only visitor location, map/video provider terms, legacy redirects | provider-profile runtime and live Supabase verifier, capacity-market, featured-provider-venue, featured-providers, provider-tracking, focused desktop/mobile E2E and visual review |
| `FEAT-FTR-001` | Dedicated `/featured` Daily Featured Trucks workspace, full remaining-viewport billboard, Driver-portrait-led exact truck cards, separate Sponsors panel, automatic/manual 07:30–09:00 schedule, live truck or programme-interlude state, compact phone controls, component-shaped loading, and a non-dead exact-truck Market action only when that truck currently has Open capacity | One truck-type theme per weekday, exact active truck and current Driver selection, latest-capacity recheck, allowlisted public portrait projection with neutral icon fallback, target of 1–12, service-role-only candidate projection, up to four interludes of at most two minutes, equal whole-minute truck allocation, validated manual intervals, safe public projection, and atomic administrator roster recheck/save | `069_daily_featured_trucks.sql`, additive Driver portrait preset migration, exact day/vehicle uniqueness, active assignment and public-contact checks, service-role-only command, schedule/audit rollback | Supabase fixture verification, managed platform-admin contract, driver-portrait-policy, featured-truck-types, featured-truck-ui, featured-providers, expo-venue, route-separation E2E, keyboard dialog checks, focused desktop/mobile visual review |
| `FEAT-SPN-001` | Clearly labeled Sponsors panel beside the daily billboard on wide screens; on phones it shows two automatically rotating transporter or outside-advertiser cards | Unified sponsor catalogue, validated external contacts, bounded regional/date placement, transporter eligibility recheck, deterministic Sponsor-break attribution, and atomic administrator save/disable commands | `057_managed_platform_admin.sql`, advertising disclosure, service-role-only command, overlap denial, reduced-motion/focus-safe rotation | managed platform-admin contract and live verifier, featured-providers, two-card phone projection, focused desktop/mobile E2E and visual review |
| `FEAT-NET-001` | No current network, Favorites, requests, or Partners discovery surface | Relationship reads/mutations retired; fake local relationship rows purged | Retired-route monitoring; restore only from an approved backup | source checks, E2E redirects |
| `FEAT-FLT-001` | Ordered Driver identity, exclusive truck assignment, owner-scoped Add truck flow, capacity/tracking permissions, and restricted/full Driver Home states | Service-role-only bounded Fleet projection plus atomic truck registration and Driver assignment/Capacity/Tracking permission commands under repeated owner, subscription, organization, Driver, and truck checks | `050_managed_workspace_fleet.sql`, `066_provider_vehicle_registration_and_admin_details.sql`, contact-safe audit, browser RPC denial, no inferred Capacity/location/assignment/verification state, no runtime SQLite fallback | workspace/Fleet runtime contract, live local Supabase Fleet verifier, truck-registration contract, authorization, desktop/mobile E2E |
| `FEAT-MKT-001` | Route-level public app shell centered on capacity sharing and shipment tracking, canonical map-only `/` Truck Market, Open capacity → Private capacity → Track → Featured navigation, live Transporter/Truck suggestions, visually scannable illustrated filters, automatic map centering with manual retry, independently optional criteria, compact fixed in-map truck/signal details, responsive navigation, and safe retired-route redirects | Explicit anonymous capacity projection, exact handle/truck selection, conjunctive unranked privacy-safe filtering in which every supplied criterion matters and omissions stay neutral, query-isolated non-shared filter responses, browser-only visitor exact location, separate Market/Featured projections, and a `410 Gone` member-directory API boundary | Route-split bundle/projection review; bounded marker loading and clustering; safe-area review; no private IDs, exact positions, hidden contacts, party data, files, compatibility-repository reads, or invented claims | capacity-market, query-cache-isolation, domain, managed runtime boundary, featured-provider-venue, PWA manifest, route/filter E2E, filter accessibility and viewport fit, focused desktop/mobile visual review, full E2E, UI audit |
| `FEAT-VER-001` | Vivid category-colored expandable evidence badges, persistent due-diligence warning, verification center, admin review queue, profile badges, and Shipment/Truck Board trust strips | Actor-scoped managed center/submission/file/review commands with subject ownership, type policy, pairing expiry, duplicate and terminal-review checks | `051_managed_verification_billing.sql` plus `052`–`053` variable-scope corrections, private quarantine/release, browser denial, audit | Verification/Billing runtime contract, live local Supabase verifier, authorization, E2E |
| `FEAT-TRK-001` | One 80-bit customer-owner code/link, separate 80-bit review code, complete entry-format guidance, observable public code submission and denial, temporary guest Tracking, ordered provider/Driver action panel, optional customer-safe approximate travel map, owner emails, and 30-day guest expiry | Dedicated Tracking-secret code derivation and digest independent of session rotation, assigned-Driver scope, explicit location consent, browser-obscured travel-only location, ten-minute refresh limit, valid transitions, image-proof authorization, shared unlock/review limits, idempotent managed delivery queue, safe guest projection, retention redaction | `TRACKING_CODE_SECRET`, `044_provider_tracking_runtime.sql`, `046_managed_email_operations.sql`, preferred Resend/bounded SMTP/optional webhook port, private storage, scanning, retries, cleanup monitoring | `tests/tracking-code-security.test.mjs`, provider-tracking, managed Tracking negative authorization, `tests/email-delivery.test.mjs`, `tests/rate-limit.test.mjs`, valid/invalid Tracking E2E, focused location projection E2E, UI audit |
| `FEAT-PLC-001` | Async Ethiopia-first place comboboxes with country-qualified labels and a bounded client cache | Bundled 3,575-place OSM-derived catalog, repeatable import, country metadata, legacy-label normalization, query-isolated non-shared server responses, bounded client-local search cache, coordinates, and built-in fallback | OSM attribution, optional PBF input, Supabase batch import, and import metrics | domain, repository, query-cache-isolation, E2E |
| `FEAT-GEO-001` | Green Empty and yellow Partial Service-area-or-Capacity-route availability, isolated selected-truck map, persistent multi-signal inspector, persisted Driver refresh, visible browser-only visitor point/ranges, and one muted-orange regular Service area or Capacity route | Driver/browser displacement, Driver-only refresh authorization, separate approximate-location circle, current/regular geometry invariants, polygon and route matching | Central HTTPS tile configuration, visible linked attribution, exact-origin CSP, non-blocking community fallback warning, responsive resize reliability, indexed place catalog, exact-location exclusion | map-tile config/readiness/CSP, domain, capacity-market, critical E2E, full E2E, UI audit |
| `FEAT-MAT-001` | Public structured route, status, signal-geometry, illustrated truck-configuration, load-type, stop-pattern, freshness, Service-area, Capacity-route, and visitor-proximity filters with explainable evidence | Deterministic AND eligibility across every supplied criterion; complete-polygon proximity; one- or two-endpoint matching across every segment of a multi-city route; direction; visitor/truck uncertainty overlap; and geometry-consistent evidence | Pure deterministic domain functions plus indexed Supabase JSONB place collections and server-only PostGIS RPC filtering; `073_public_capacity_filter_alignment.sql` | domain, capacity-market, Supabase-fixture filter-alignment regression, focused desktop/mobile route/filter E2E, accessibility, UI audit |
| `FEAT-PST-001` | No current pooled or along-route demand surface | Shared-demand projections retired and fake local source rows purged | Retired-route monitoring; restore only from an approved backup | source checks, E2E redirects |
| `FEAT-BIL-001` | Provider signup trial, billing-focused limited Home, Account/private payment proof, paid status, and admin review | Actor-scoped managed summary/submission/file/review commands, workspace ownership, seven-day trial, terminal review, and 30-day paid period | `051_managed_verification_billing.sql`, private quarantine/release, browser denial, audit | Verification/Billing runtime contract, live local Supabase verifier, domain, authorization, E2E |
| `FEAT-ADM-001` | Compact Administration Overview, direct Records inventories, bounded per-record detail routes, Tracking timeline, connected Review/Capacity/Featured/Support work queues, permissioned platform-team management, and explicit record actions | Supabase-only bounded inventory/count/detail projections, least-privilege responsibility checks, support routing oversight, reversible status commands, atomic featured roster/Sponsor commands, application-free signup, review terminality, and admin audit | `057_managed_platform_admin.sql`, `066_provider_vehicle_registration_and_admin_details.sql`, `067_admin_overview_counts.sql`, secret/location/proof exclusion, service-role-only RPCs, server-side permission enforcement, requeue safety, and mutation audit | managed platform-admin contract and live verifier, all-eight-record desktop/mobile E2E, authorization, featured-providers, focused visual review |
| `FEAT-SUP-001` | Native member Support with persistent New chat, Continue chat, and Past chats states; member End chat; bounded agent inbox; conversation detail; filtered admin triage; and passwordless admin Support Team | Actor-scoped managed conversation/message commands, owner/assigned-agent/admin closure, support-only role, atomic cross-queue capacity-aware assignment, pagination-independent active lookup, and audit | `054_managed_support_runtime.sql` plus `055`–`056` identity/permission corrections, browser RPC denial, bounded polling with later authorized Realtime | Support runtime contract, live local Supabase verifier, authorization, focused desktop/mobile E2E, UI audit |
| `FEAT-SHR-001` | Provider Network controls, eligibility-aware six-digit Private capacity email-OTP entry, a clear no-share result that remains on the email step, one multi-truck authorized capacity map, non-overlapping visible logout, 30-minute deliberate-activity idle timeout, and Loadgistic assisted-matching opt-in | Truck-scoped email/platform grants, Driver create/revoke, owner oversight, no challenge or delivery for an unshared email, single-use OTP/session digests, origin/email verification limits, just-in-time both-kind lease fencing, truthful provider-success acknowledgement, bounded credential cleanup, bounded rolling renewal, complete anonymous exclusion of Private-network trucks, exact-coordinate exclusion, immediate revocation, and no Auth account/runtime fallback | `058_guest_access_retention.sql`, `059_targeted_access_email_delivery.sql`, authenticated two-minute Netlify background recovery, managed PostgreSQL plus loopback-only local Mailpit and preferred Production Resend/bounded SMTP/optional webhook email, private Storage, shared rate limit, privacy monitoring | managed runtime boundary, private-capacity runtime and live verifier, `tests/email-delivery.test.mjs`, `tests/private-capacity-runtime.test.mjs`, rate-limit tests, focused desktop/mobile E2E and no-share/active-session captures |
| `FEAT-GST-001` | Account-free Assisted matching conversation, persistent public launcher, and recovery flow integrated with the support inbox | Server-held guest digest, immediate atomic queue assignment, two-second visible polling, route-persistent authorized conversation, strict conversation/file reads, and no demand entity | `054_managed_support_runtime.sql`, quarantined/scanned private support bucket, managed email, browser RPC denial, authorized Realtime rollout, shared rate limit | Support runtime contract, live local Supabase verifier, `tests/private-capacity-network.test.mjs`, focused desktop/mobile E2E and captures |
| `FEAT-REV-001` | Verified customer-owner review form, public provider reputation, and provider low-rating dispute status | Shipment-bound review grant, one review per completed Tracking session, all-score publication, service-role-only provider dispute command, audited terminal decision | `044_provider_tracking_runtime.sql`, email authorization, expiry, moderation audit | repository, managed Tracking authorization, E2E |
| `FEAT-DAT-001` | Busy city-and-town public capacity/map/microsite fixtures across fleets and owner-operators, with an explicitly authorized additive hosted-pilot path | Credential-free PostgreSQL-native 30-provider/143-truck supply fixture across weighted Ethiopian markets and at least 60 real named localities, with no dominant locality, repeated diagonal offset, or identical fleet pattern; 100 cargo vans, pickups, or mini trucks, no courier cars or motorcycles, and smaller light/medium/rigid-heavy/interchangeable-tractor cohorts; active owning-Driver assignment and an exact 21 existing/24 generated/98 icon portrait mix; current attached trailer as the public configuration; seven-day Featured eligibility; 30 km compact freight geography; wider light-truck geography; occasional logical regional routes; current-date Featured/Sponsor generation; full cursor traversal; no demand records | Destructive reset remains local-only; hosted pilot requires exact project confirmation, collision preflight, random unrecoverable Auth credentials, backup checksum, deterministic row namespace, exact rollback, and no synthetic privileged identity | managed fixture contract and live verifier, production-pilot policy/import dry-run and approved hosted execution, independent hosted database/API/browser verification, driver-portrait-policy, vehicle-catalog policy, clustering contract, focused desktop/mobile E2E, UI audit |
| `FEAT-LST-001` | Progressive bounded Truck Map loading, maximum-eight linear-time screen-cell clusters, and bounded provider/admin histories | Opaque cursor contract, deterministic ordering, deduplication, filter and map-state restoration, bounded operational pages | Query latency and dense-render monitoring | repository, E2E, focused desktop/mobile review |
| `FEAT-UIX-001` | Professional capacity-sharing and shipment-tracking copy, shared route-aware desktop/mobile public app shell, bounded icon-led capacity filter with image-based truck selection, provider mobile app shell, compact Administration hierarchy, Map-first discovery, keyboard-operable controls, non-overlapping responsive overlays, short actions, touch targets, reversible details, and a current-product release audit | Existing authorization plus explicit provider, fleet, guest, review, and administrator commands remain server enforced | Multi-role route, interaction, visual, copy, fixture, safe-area, current-page accessible-name, contrast, target-size, viewport-fit, and overflow evidence that excludes retired product paths | focused route/filter and administration E2E, filter accessibility, E2E, UI audit, stress audit, `docs/APP_AUDIT_2026-08-11.md` including the 2026-08-13 responsive-shell follow-up |

All features depend on `BASE-BE-001`; user-facing features depend on `BASE-FE-001`; runtime and release constraints derive from `BASE-DEP-001`.

Cross-feature authorization contracts are mapped in `docs/AUTHORIZATION_MATRIX.md` and verified by the focused capacity-market, provider-tracking, domain, and E2E suites.

Production deployment readiness is mapped in `docs/LAUNCH_READINESS.md` and checked by `npm run launch:check`. `BASE-DEP-001` maps shared abuse control to migration `047_shared_rate_limits.sql`, `src/lib/rate-limit.js`, the managed operations worker, and the local concurrency/privacy/RLS verifier. It maps private-upload protection to migrations `048_private_upload_quarantine.sql` and `074_netlify_safe_upload_limit.sql`, `src/lib/private-storage.js`, `src/lib/upload-scanner.js`, and the local size/signature/clean/dirty/cleanup/browser-denial verifiers. The additive `075_hot_path_foreign_key_indexes.sql` migration and its source contract test map observed common relational lookups without dropping low-traffic indexes. The command remains intentionally red until the remaining hosted scanner/email/deployment evidence is complete.

Playwright runs through `scripts/run-e2e.mjs` and `scripts/e2e-server.mjs` on isolated port `3100` by default, with `PLAYWRIGHT_PORT`/`PLAYWRIGHT_BASE_URL` available for a clean alternate port. It uses the configured local Supabase services and synthetic managed fixtures; it does not use a SQLite test database. Audit helpers reject hosted targets, and CI starts and imports an isolated local Supabase instance.

The local visual audit (`npm run test:ui-audit`) covers logged-out and role-scoped current-product screens at desktop and mobile sizes: homepage, About, Capacity list/map, provider microsites, Track, provider dashboards, Fleet/capacity controls, provider shipments, profile editing, verification, Support, and bounded administration. It checks response status, horizontal overflow, touch targets, unlabeled controls, icon coverage, empty commands, map rendering, and browser errors. Screenshots and `report.json` are written to the ignored `artifacts/ui-audit/` directory. Focused visual approval is required before running this expensive full audit.

`tests/capacity-market.test.mjs` verifies the deterministic supply-only reset, zero legacy demand rows, 30 published provider pages, nine fleet companies, 21 independent profiles, 143 current signals, at least 60 real named operating localities, bounded locality concentration, non-diagonal offsets, distinct large-fleet branch patterns, a 100-truck local-delivery cohort, complete cursor traversal without duplicates, public Driver first name/callback/operating-model/document-category projection, location-aligned and road-coherent Empty/Partial multi-city Service-area and Capacity-route geometry, the primary Driver demo's compact same-market location/current/regular geometry, provider/truck/geometry text search, full-polygon current and regular Service-area proximity, every-segment freight alignment with current or regular Capacity routes, exactly one regular Service area or Capacity route per provider, application/database rejection of a second signal, public contact controls, safe projection, and optional anonymous proximity. Clustering tests and focused desktop/mobile E2E verify stable geographic anchoring, bounded same-status groups, unlike-status label separation, map-only geolocation centering, and explicit proximity filtering.

`tests/featured-truck-types.test.mjs`, `tests/featured-truck-ui.test.mjs`, `tests/expo-venue.test.mjs`, `tests/featured-providers.test.mjs`, and `tests/e2e/smoke.spec.ts` verify the seven-day truck-type rotation, exact active truck and assigned Driver selection, deterministic equal whole-minute automatic scheduling inside 07:30–09:00 EAT, no more than four two-minute programme interludes, break-safe live state, validated and safely projected manual intervals, administrator publication, current-day fixture repair without administrator overwrite, responsive remaining-viewport layout, separate Sponsors treatment, keyboard-accessible exact-truck details, and featured/sponsored profile and exact-truck map actions. Focused schedule review captures are written to `artifacts/featured-schedule-v1/`; the expensive full-site visual audit remains approval-gated.

Final UIA-08 screenshot review also caught the detail badge exposing the internal
Profile Route kind for an area. List/detail badges now say Service Area; the
focused browser checks assert this alongside the area description. Final area
captures: `artifacts/ui-contract-area-final-review-2026-09-21/`.

## Tracking progression preview — 2026-09-23

FEAT-TRK-001: `tracking-progress.js` and provider controls distinguish actual
saved history/current/next/remaining states, initial shortcut and Problem recovery.
Three unit tests, focused desktop/phone persisted browser workflows, source/spec
checks and TypeScript pass. Phone focus probe was corrected to wait for hydration.
Captures under `artifacts/tracking-progress-20260923/` and
`artifacts/tracking-progress-phone-20260923/`. Owner approved the layout on September 23; full release
gates remain pending; no new deployment or lifecycle/permission change.

FEAT-TRK-001 recipient-save follow-up: native/JSON route preserves server authorization,
commits before scheduling mail with Next after(), and the form reports inline
success/error without waiting on navigation or mail. Desktop/phone tests prove
actual local invitation delivery, OTP delivery/unlock, no account creation,
duplicate recovery, unrelated-email non-delivery and revocation. Initial new-form
URL property collision fixed and desktop rerun passes. All 335 unit tests,
TypeScript and source/spec gates pass. Exact-candidate CI `35860658374` for
`727c48e` passes validate, container and desktop/phone E2E. Production-runtime
verification and promotion remain pending; the public domain is already live.

## Custom domain verification — 2026-09-23

BASE-DEP-001 / FEAT-IAM-001: owner-approved external GoDaddy DNS and narrow
Netlify/APP_URL/Auth callback cutover connects https://loadgistic.com. Managed
certificate covers apex/www; HTTP and www redirects pass, health is ready, and
desktop/phone browser checks pass public map filtering/Clear all and email-only
login rendering. Exact old/new fields, unchanged Auth-field verification and
protected evidence paths are in `docs/operations/LOADGISTIC_DOMAIN_SETUP.md`.
The new Tracking release and production OTP login are not claimed by this public
verification. Existing production deployment remains `6ab3aaa9668f9644dcba97d8`.

## UI wording and Featured readiness — 2026-09-24, local

FEAT-LUX-001 / FEAT-LNG-001 / FEAT-FTR-001 / FEAT-SUP-001: remove decorative map
caption and repeated/internal labels, preserve meaningful limits, distinguish
scheduled Featured from live video, expose real run/round/day status and manual
controls. Owner-approved independent Featured responsibility is default-off,
with narrow settings, admin grant/revoke and current database authority.

Migrations 105–106 rehearsed with negative SQL/catalog checks and applied only
locally. `featured-operation-status.sql`, `featured-team-permission.sql`,
`featured-random-rounds.sql` and separate `brokerage-assignment.sql` verify the
changed contracts. Thirty-three focused unit tests pass; source/spec/TypeScript pass.
Browser evidence and remaining rollout limits are recorded in
`docs/FEATURED_READINESS_2026-09-24.md` and `docs/PROGRESS.md`.
Full gates, owner visual approval and hosted migration/worker verification remain
open; these records do not mark the release complete.


## Official Featured broadcast window — 2026-09-24, local

FEAT-FTR-001 / FEAT-LNG-001: eight-showcase maximum, 08:30–12:00 EAT, four
two-minute mentions including the close, manual gap validation and preserved
legacy read/manual data. `tests/featured-providers.test.mjs`, `tests/expo-venue.test.mjs`,
`tests/sql/featured-broadcast-window.sql` and `tests/e2e/featured-broadcast-window.spec.ts`
map these contracts. Existing random-round/permission SQL suites pass. Migration 107
preservation rehearsal, final catalog checks and synthetic cleanup are recorded in
`docs/FEATURED_READINESS_2026-09-24.md`; four browser cases pass on desktop/phone.
Native JSONB manual intervals now reopen/resave correctly; reordered trucks retain
slot times. Owner UI approval and hosted rollout remain pending.


## Managed transport request wording — 2026-09-24, local

FEAT-TRQ-001 / FEAT-LNG-001: approved launcher, service description, fee confirmation,
callback action and transport-team receipt. No backend/schema contract changes.
Existing `transport-requests.spec.ts` and `public-assistance-dock.spec.ts`: eight
passing desktop/phone cases retain actual private follow-up, no email, separate
Help, drafts and recoverable submission. Seven domain/localization tests pass;
all four language phone previews fit. Evidence and rollout status: `docs/PROGRESS.md`.
Owner visual review and deployment are still separate pending steps.

### Freight catalogue review — 2026-09-25

FEAT-FLT-001 / FEAT-FTR-001 / FEAT-DAT-001 / FEAT-LUX-001: courier retirement,
mixed Sunday preview, driver-preserving local demo conversion, container flatbed
illustration and Transporter login label. Focused evidence: `tests/fleet-vehicle-registration.test.mjs`,
`tests/featured-truck-types.test.mjs`, `tests/supabase-fixtures.test.mjs`,
`tests/capacity-market.test.mjs`, `tests/localization.test.mjs` (41 passes),
`tests/sql/freight-vehicle-catalogue.sql`, `tests/sql/featured-random-rounds.sql`,
catalog security (NR-01/02/03), source/spec checks, TypeScript,
and `tests/e2e/freight-catalogue.spec.ts` (six desktop/phone cases).
Preservation checks and local projection report are protected in `.local/freight-catalogue/`;
visual artifacts in `artifacts/freight-catalogue-20260925/` and
`artifacts/freight-catalogue-featured-20260925/`. NR-13 owner visual approval
and full release gates remain pending; migration 109 applied locally only.

### Map introduction — 2026-09-25

FEAT-LUX-001 / FEAT-LNG-001: visible introduction above Open capacity, retired
header slogan, contextual translations and descriptive page title/description.
`tests/e2e/map-introduction.spec.ts` passes four desktop/phone cases covering
seven viewport sizes, all five languages, real server HTML content and metadata.
Open-map cases in `tests/e2e/public-map-shell-layout.spec.ts` also pass at all
existing breakpoints. Localization, source/spec and TypeScript checks pass.
Screenshots: `artifacts/map-introduction-final-20260925/`.
NR-13: local preview remains live; owner visual approval and release gates pending.
Pre-existing streamed route visibility with JavaScript disabled is recorded in
PROGRESS; it is not claimed fixed. No hosted changes.

SEO basis: [Google Search Central](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

### Unified capacity map — 2026-09-27

FEAT-MKT-001 / FEAT-SHR-001 / FEAT-LUX-001 / FEAT-LNG-001; ADR-069:
`tests/e2e/unified-capacity.spec.ts` covers default public scope, a locked real map
without feed requests, no-share email, wrong/correct real local OTP, isolation from
another recipient, private Clear all, public switching, logout/history, legacy links,
all translated choices/access/About text and 320px clickability. Six desktop/phone
cases pass, with final copy/layout evidence in `artifacts/unified-capacity-copy-20260927/`
and private workflow evidence in `artifacts/unified-capacity-final-20260927/`.
`map-introduction.spec.ts` adds four passing responsive/HTML cases.
Ten localization/private-access unit checks, source/spec checks and TypeScript pass.
NR-13: preview remains live at port 3100; owner visual approval precedes full release
gates. Local implementation only; no deployment or hosted database/configuration change.

### Live Brokerage and mobile readiness — 2026-09-27

FEAT-TRQ-001 / FEAT-SUP-001 / FEAT-LNG-001 / FEAT-SEC-001; ADR-070:
`tests/transport-chat.test.mjs`, existing transport/localization/provider-support
unit suites (ten passing cases), `tests/sql/brokerage-conversations.sql`, existing
Brokerage assignment regression and database catalog gate. Eight desktop/phone
cases across `brokerage-conversations.spec.ts` and `transport-requests.spec.ts`
cover actual two-party reply delivery, duplicate prevention after lost acknowledgement,
recovery, handoff, closure, reconnect, translated controls, retained request drafts
and existing admin follow-up. Final evidence split between
`artifacts/brokerage-live-reviewed-20260927/` and `artifacts/brokerage-followup-20260927/`.
Source/spec and TypeScript checks pass. Migration 110 applied locally only;
NR-01–05/08–10/13 remain rollout gates. Owner visual approval and full release
checks pending. `docs/MOBILE_MONOREPO_READINESS.md` records preparation only;
no workspace move, Expo dependency installation or native build is claimed.


### Live-chat presentation — 2026-09-27

FEAT-TRQ-001 / FEAT-LNG-001 / NR-13: visible Live chat entry, Start chat action,
one panel title and contextual empty-conversation prompt. Desktop/phone replies,
recovery, real queue follow-up, map-control separation and five-language 320px
entry checks pass: `brokerage-chat-entry-20260927` and
`brokerage-chat-entry-final-20260927` under artifacts (14 distinct browser cases).
Owner approved the preview and resumed release. A later request to add visitor
closure is a new pending acceptance criterion; this evidence does not cover it.


### Visitor-ended chats and retained follow-up — 2026-09-27

FEAT-TRQ-001 / FEAT-LNG-001 / NR-01/02/03/08/10/13:
`tests/sql/transport-chat-follow-up.sql` verifies retained request state, versioned
staff edits, capability denial, idempotency, message closure, callback queues,
private-note/contact redaction and persistent ending after admin reopening.
Existing Brokerage assignment/conversation SQL and database catalog checks pass.
`tests/e2e/transport-chat-follow-up.spec.ts` passes all four waiting/assigned cases
on desktop/phone, including canceled confirmation, failure/retry, new chat while
old follow-up remains open, retained history, staff calls and resolution. Locale
confirmation captures and phone controls are in
`artifacts/chat-follow-up-final-20260927/`. Eight focused unit/localization cases,
source/spec and TypeScript pass. Logs: `.local/chat-follow-up/`.
Migration 111 is local only; owner visual review, refreshed release rehearsal,
exact-candidate CI and hosted rollout are still required.

Focused chat regression completion (2026-09-27): all 12 distinct desktop/phone
cases pass across `artifacts/chat-follow-up-final-20260927/` (11 passed) and
`artifacts/chat-follow-up-claim-20260927/` (remaining desktop conversation passed).
The first run's claim/navigation test raced the save; it now waits for the successful
claim response and refreshed queue before choosing Mine. No permission or product
assertion was weakened. Logs: `.local/chat-follow-up/browser-{final,claim}.log`.


### Profile search and matching truck map — local evidence, 2026-09-27

FEAT-MKT-001 / FEAT-LST-001 / FEAT-LNG-001 / ADR-071 / NR-01/02/03/08/10/13:
`tests/sql/capacity-ranked-search.sql` passes rollback-only relevance, all-word/
typo/Ethiopic matching, profile-only output, retired type neutrality, truck-only
fact exclusion, published-prose scope, hidden-contact denial, inactive-driver
exclusion, full company-pair inclusion, driver-specific map scoping, current
subject-scoped document filters, stable pagination and browser-RPC denial.
`tests/e2e/capacity-ranked-search.spec.ts` passes six desktop/phone cases across
`artifacts/capacity-profile-search-20260927/` (five) and
`artifacts/capacity-profile-search-final-20260927/` (one), including verified-email
private grants/revocation and all four translated filter layouts. The first desktop
attempt hit the bounded UI timeout during local compilation; its unchanged test
passed on one controlled retry. Nine localization/filter unit checks and
TypeScript/source/spec checks pass. Earlier eight drawer/reset cases passed in
`artifacts/capacity-search-map-final-20260927/`. Logs: `.local/discovery-search/`.
These are local focused checks, not full release/production-scale evidence.
Owner visual review, exact-candidate gates and migration 112 rollout remain pending.


Office-city control simplification: four desktop/phone cases pass in
`artifacts/capacity-city-search-20260927/`, including main-box city search, matching
company trucks and absent Office city controls in all UI languages. The local
rollback SQL suite adds published office-city text/profile/map assertions.
TypeScript and source/spec checks pass. No production changes.


Illustrated configuration picker (FEAT-LST-001):
`tests/e2e/capacity-configuration-picker.spec.ts` passes desktop and phone checks
for all 15 real catalogue images, full-width layout, selected preview, keyboard
arrow navigation, single-valued application, matching map responses and reset.
Evidence: `artifacts/capacity-configuration-pictures-review-20260927/` (2 passed).
TypeScript and source/spec checks pass. Existing public/private workflow tests
now use the picture picker rather than the retired native select; their full
release run remains pending owner visual approval. No production changes.


Shipment-focused filters (FEAT-LST-001 / FEAT-MKT-001):
`tests/e2e/capacity-load-needs.spec.ts` passes desktop/phone space selection,
conflicting availability prevention, actual full/shared map/profile queries,
Clear reset and all four translated controls. Evidence:
`artifacts/capacity-load-needs-final-20260927/` (2 passed). An initial test reopened
the old dialog before Clear navigation completed; synchronizing the URL corrected
the test without altering its reset assertion. `tests/sql/capacity-ranked-search.sql`
adds rollback assertions for automatic route/area inclusion in public/private
matching functions and accepted full/shared-load requirements. TypeScript and
source/spec checks pass. No database migration or production change in this step.


October 7 launch continuation — FEAT-MOB-001 / FEAT-MKT-001 / FEAT-CAL-001:
local only. Direct area controls in navigation-shell/workspace-area-switch;
account-settings/more contain contextual controls and authorized evidence.
`navigation.test.mjs` + `document-scope.test.mjs`: 8 focused tests;
`workspace-area-navigation.test.mjs`: 3 URL/camera-denial checks;
`workspace-consolidation.spec.ts`: 4 actual desktop/phone save/draft/role passes;
`verify-mobile-navigation-local.mjs`: native/web switch-return, native personal
subject reachability, public camera/query restoration and Clear all pass.
Types/lint and explicit native translations (426/426) pass. Calendar pure tests
4 pass; native week/month/landscape and web ISO-selection/focus-return interactions pass.
Local migrations 115–119, protected backup and six rollback-only DB regressions
pass; launch matrix includes 292 combined/document expiry checks. Owner visual
review, full gates, native background testing and hosted rollout remain pending.
Do not treat the prior production evidence as evidence for these new contracts.

October 7 Home clarification — FEAT-FLT-001 / FEAT-MOB-001: Home reuses the
existing fleet workspace for transport-company owners; drivers retain their map.
Native role labels and a four-destination owner primary bar clarify the distinction;
legacy fleet routes remain valid. `verify-workspace-homes-local.mjs` passes on the
owner's named local account and its existing driver alias, on native browser and
web, without business writes/email. Driver map canvas survives area switching.
16 focused native and 15 focused web fleet/runtime tests pass; phone Account
security E2E confirms email change, deactivation and retained history. Owner
hands-on review remains open; no new explicit visual approval or release gates.

October 7 browser raster cancellation — FEAT-MOB-001: installed loader regression
and actual browser failure reproduced before the fix. Six
`apps/mobile/tests/maplibre-raster-abort.test.mjs` cases pass for cancel/success,
HTTP/network/decode failure, fresh install/idempotency and project/version/hash
denials. `verify-mobile-map-abort-local.mjs` passes cancellation+zoom+resize+area
return and two genuine failure feedback scenarios using explicit raster fixtures.
Browser console errors and pageerror are both checked. Native typecheck/lint pass.
Local previews restarted; no production, APK or native background verification.

Raster recurrence follow-up: `verify-mobile-map-stream-local.mjs` passes paused
Chrome double-click zoom with 31 actual after-header body cancellations and zero
console/page/unhandled events, plus area return. The prior synthetic regression
now requires a new intended forced cancellation; all three feedback scenarios
pass. A one-time unmodified real-fetch diagnostic observed 49 OSM cancellations
without events. Full reload sent to the verified Loadgistic8084 client only.
The originally reported runtime remains open until owner Chrome confirmation;
fresh-context tests do not establish the cause of that existing-tab exception.

Browser raster transport — FEAT-MOB-001: `verify-browser-raster-local.mjs` reproduces
the uncaught abortTile exception with a broken recorder side-promise and then
passes the scoped XHR port on desktop HiDPI driver Home: 63 body cancellations,
zero tile fetch-observer calls, no global errors/overlay and preserved area return.
Two further cases prove genuine HTTP and invalid PNG feedback. Evidence:
`.local/browser-raster-recorder-check.log`, `.local/map-recorder-{before,repaired}.png`.
Old browser verification names delegate to this actual-transport check. Dedicated
raster-port tests cover canonical host/coordinate denial, cancellation/cleanup,
expiry, empty responses and genuine failure, alongside installed-loader/drift tests.
No native binary, production changes or browser extension/settings mutation.
Final evidence: 11 focused unit tests, mobile typecheck/lint and spec links pass;
`verify-workspace-homes-local.mjs` also passes four actual owner/driver Home checks
on web/native browser with real OSM tiles and console-error collection. Before
the controlled recorder baseline, delay headers to preserve the native abortTile
creation stack; a cloned-body abort may instead have a stackless DOMException.
The repaired case independently requires new after-header body cancellations.


### FEAT-NOT-001 — Existing-chat alerts and Seen (October 7, local evidence)

- Implemented: immutable local migrations 122–125, private RLS cursor storage,
  authorized service/HTTP projections and explicit acknowledgements, assignment
  epochs and independent assignee unread; web/native viewport/focus/overlay reads;
  contextual unread/queue/assignment/join/end/resolve alerts and opt-in web audio.
- Verified: `tests/chat-read-alerts.test.mjs`, `tests/mobile-support.test.mjs`,
  `tests/provider-access-health.test.mjs`, native `chat-alerts.test.mjs` (18 cases);
  `tests/sql/chat-read-receipts.sql` plus six existing Support/Brokerage suites;
  catalog gate and real concurrent service commands. Schema 124 fails the 45-chat
  backlog case; 125 passes without truncated totals or a permission expansion.
- Actual local workflows: `verify-chat-roundtrips-local.mjs --support-only`,
  `--brokerage-only`, `--receipts-only` pass using disposable identities, real
  commands and exact cleanup. Receipts include actual join vs assignment,
  unread away from chat, menu close recovery, below-fold/history neutrality,
  scroll-to-See, forged/stale frame denial and staff mobile denial. Injected 503
  delivery failure preserves Sent; restored real delivery saves Seen. Legacy
  Support handoff is a fixture operation; missing admin control stays WEB-MOB-014.
- Presentation: `verify-chat-alert-layouts-local.mjs` passes all five languages at
  320px, usable actual intake, dialog close/overflow and real web audio opt-in.
  Final web/native types, focused native lint and spec/source/whitespace checks pass.
- Evidence: `.local/chat-read-*.log`, `.local/chat-alert-*.log` and focused screenshots
  listed in MOBILE_IMPLEMENTATION. These ignored logs are local, not public data.
- Pending: owner visual approval, full quality/release/native-device gates,
  restored exact-backup rehearsal and matched hosted/web/APK/AAB rollout. No
  production mutation/publication. Background push and direct provider inquiry
  scope are undecided (WEB-MOB-016); in-app polling is not closed-app delivery.


FEAT-NOT-001 final public-page/cache check: `--public-receipts-only` passes for a
signed provider browsing About/Marketplace, scoped unread/bell without bodies,
320px fit, actual private opening/Seen, and lifecycle-event-injected page hiding
with a real revoked-permission reload. The existing public account/access filter
is preserved. Evidence: `.local/chat-read-public-roundtrip.log` and
`.local/chat-roundtrip-web-marketplace-member-alert.png`. Browser lifecycle events
are simulated explicitly; the reload and backend authorization are real.

### FEAT-NOT-001 / FEAT-TRK-001 — October 8 local extension

- Migration 126 private approval reads/commands and readiness marker: rollback
  rehearsal then backed-up local apply. Current catalog and scoped negative cases
  pass in `tests/sql/driver-handover-alerts.sql`; owner-handover and device-location
  rollback regressions also pass. Hosted ledger is not changed.
- `tests/handover-browser-alerts.test.mjs`, chat policies and health contracts:
  18 focused cases pass, including generic projection, stale/forged input,
  silent baseline/replay, browser denial/failure and cross-adapter deduplication.
- `verify-driver-browser-alerts-local.mjs --handover-only`: real API creation,
  stored proof objects, actual local code email/verification and owner approval,
  native/web/system updates, exact successful command and saved unread zero.
- `--staff-only --slow-claim`: actual waiting/assignment/join/unread worker records,
  real Claim delayed seven seconds, hidden-tab delivery without Seen and dedupe.
  Visibility is test-injected; permission is automation-granted. System records
  are real; an OS banner or physical-phone delivery is not claimed.
- Existing Support/Brokerage local round trips pass for both web staff and Expo
  customers: replies, drafts, files/history, handoff, end/callback/Resolved.
- Final evidence and screenshots: MOBILE_IMPLEMENTATION. Owner visual review,
  full release gates, hosted rollout/new native artifacts and configured
  closed-phone push remain pending. No successful mocked backend response.


October 8 browser-gate follow-up (FEAT-FLT/TRK/MOB/DAT/SUP/MKT): local
`account-security`, `tracking-completion-review`, `tracking-location-controls`,
`tracking-progress` and `truck-profile-layout` pass (six desktop cases), with
real local SMTP, mandatory photo uploads, fresh owner approval, private history
and account closure. Both independent ownership/permission signup cases pass;
all three provider-fleet paging cases and staff administrator/two-role mobile
sign-in denials pass. Root 473 tests, mobile 118 tests, types/lint and the actual
Expo current-truck retirement save pass. Owner explicitly approved the repaired
web/native control and compact details. Complete exact-source CI, hosted rollout
and installed-phone evidence remain separate and outstanding.

The remaining 18 desktop workflows now pass across their corrected focused
runs: all current admin destinations/record details, capacity dialogs and real
saves, Featured manual draft/publication and combined/revoked staff permissions,
interrupted-save recovery, company/single-truck Support, and fleet lifecycle
recovery. Tracking cancellation is denied to the provider and then succeeds
through Operations; guest access ends and history remains. Root quality and
the final 118-test native types/lint/translation/export/runtime audit pass.
Full exact-source desktop/phone CI and hosted/installed-artifact postchecks
remain required; these local results do not claim a production rollout.

October 9 follow-up: corrected desktop/phone navigation, private named sharing,
assigned-truck Tracking, and truck-document calendar workflows pass. Normal and
long phone truck modals pass the unchanged bounds/touch assertions. The full phone
fleet workflow proves duty-button navigation clearance and saves/reassignment/
revocation (FEAT-CAP-001, NR-22). All transporter/driver workspace serious-accessibility
checks pass with a real managed session and completed Account redirects. Final
candidate CI and hosted/installed postchecks remain pending.


October 9 Play policy implementation (FEAT-PLY-001), web/Android tester rollout:
- AC1: eight native background-consent tests pass, including already granted
  OS permission, decline, stale account and revoked permission. The generated
  Android manifest disables FCM auto-init/analytics and blocks unused media,
  camera and microphone permissions. Actual Android disclosure/OS/video and
  closed-phone acceptance still require actual device evidence; the inspected
  1.0.3/code-4 binary is installed and available.
- AC2: `account-erasure.test.mjs` (seven) and rollback-only deletion/scope SQL
  pass. The phone browser deletion workflow verifies real local SMTP, persists
  a receipt across reload, removes a real Storage object, deidentifies Auth,
  preserves an unrelated account and denies non-administrator erasure.
- AC3: public report/moderate/hide/restore/block/unblock browser workflow and
  content-policy SQL pass. `public-capacity-policy-scope.sql` proves actual map
  and search rows exclude hidden/demo providers and preserve restored ordinary
  supply; Featured eligibility and portrait reads have matching exclusions.
- AC4: normal reviewer password login, explicit saved terms, populated synthetic
  Tracking/private-capacity access, session/guest revocation and ordinary-account
  denial pass in the native browser preview. SQL also denies foreign workspace
  grants, unregistered members and staff elevation. Three approved hosted review
  identities now pass normal Auth and own private-scope reads with foreign-scope
  denial. Company drivers are denied transporter-profile management (403) while
  personal Account remains available. Initial terms acceptance remains false;
  credentials stay in a protected local file, outside source/builds.
- AC5: all 496 explicit native messages have four translations; shared privacy
  and conditional-control parity passes. Current phone/desktop captures exist.
  The owner explicitly approved these screens on October 9. Policy declaration
  inventory remains a draft. Hosted rollout and signed binary inspection pass;
  actual Android permission/video and Console review remain pending.

Evidence: `tests/e2e/play-policy-workflows.spec.ts` (four focused phone workflows,
including real SMTP OTP onboarding, explicit actor-bound consent, one-truck
limits and Chicago location/capacity persistence), all 52 SQL suites and 24 new
domain/native cases. Root quality 488/488, native 127/127, types/lint, Doctor
21/21, Android export/runtime audit and web build pass. Seventeen changed or
affected phone workflows pass across corrected runs. The unchanged 5,000-truck
gate passes: 15 rows, 30,855 bytes, search 4.75 s, route 2.74 s, zero fixtures
retained. Fresh production backup restores without networking; migrations
131–136 and full catalog/guard/spatial rehearsal pass. Exact-source CI 38012117505
passes all eight latest jobs at 068ac35, including the controlled retry of an
isolated startup failure. Approved hosted ledger is 136; runtime 9feab2d deploy
6ac99d110f1f577818c9f7c9 is verified with 80 live checks and clean final security.
APK 9169da7e-dd2f-40b1-87b0-53fee20e3b56 and AAB
edd8cf91-446d-477e-8bb4-e00946fa7a57 preserve the exact native inputs/signing.
Protected publication, database, reviewer and live-evidence receipts under
`.local/play-policy-*` distinguish hosted results from local tests. Play upload,
tester enrollment and physical-device acceptance are not claimed.
Installed code-4 Privacy and live public Capacity render in the owned emulator
after one fresh-hierarchy System UI recovery. Actual 1080 × 2160 opaque captures
and sanitized evidence are in `.local/play-policy-native-current-evidence.json`
and `.local/play-policy-store-asset-plan.json`; the temporary display size was
restored. Store asset review and full native workflow acceptance remain separate.

October 10 operational follow-up: owner-supplied dedicated publisher key validates
for loadgistic-f082a and authenticates (200). Exact Loadgistic Expo Submit
assignment passes postchecks with original FCM/signing references unchanged.
The read-only com.loadgistic.app check returns 403 / SERVICE_DISABLED; API
enablement, actual Play app permission/signing and upload/rollout remain pending.
Protected plan/receipt and sanitized preflight evidence are under
`.local/play-20261010-*`; key bytes remain out of source/builds/logs.
Subsequent owner-delegated Chrome setup verifies API enablement and sends one
exact app-only publisher invitation. Saved publisher status is Active, with one
Loadgistic app grant and zero account-wide permissions; Save changes is disabled.
The API lookup returns 404 for the requested version, without permission denial.
Protected invitation review/receipt records these results. No Play upload,
signing enrollment, store acceptance or tester clock is inferred.


October 10 FEAT-PLY-001 AC1 / NR-26 native follow-up: the private synthetic
company-driver signs in normally and accepts the actual Terms checkbox. Code-4
banner bounds y=21–116 fall wholly inside Android's status-bar inset of 136;
center/lower-edge taps do not reach disclosure. The local SafeAreaView repair is
covered by `apps/mobile/tests/background-notice-layout.test.mjs`, which fails on
the prior source, then passes alongside consent/scope/native-text tests (13/13),
mobile typecheck and lint. `background-notice-scope.test.mjs` additionally excludes
the actual stale notice observed after native sign-out and prevents it crossing
to another actor. It retains one controller and existing consent/permission
logic. Repaired installed-device bounds/prompt, owner visual review and replacement
artifact acceptance remain pending; no permission grant/video is inferred. Exact
private test screenshots stay under ignored .local. No customer record or human
consent backfill, provider setting, signing or hosted schema changed.

Subsequent October 10 installed development-preview verification:
73df3680-6ac5-4e66-ab42-caa6f66c0508 is finished, signature/package checked and
installed in place only on the owned emulator, preserving data and the existing
signer. Native archive e57050e and current local Metro JS are distinguished from
the standalone code-4 release. Real normal review login reaches driver Home;
the notice action y=157–252 is below the reported 136-pixel status inset, opens
the real native disclosure and declines to a usable workspace without an OS
prompt visible. Normal Sign out returns to guest login with the old notice absent.
The actual preview exposed duplicate header padding; the in-flow header consumes
the top inset only when the notice has not already consumed it, with modal safe
areas unchanged. Header actions move up 136 pixels. Actual captures:
.local/play-native-notice-driver-final.png,
.local/play-native-notice-disclosure-final.png,
.local/play-native-notice-guest-final.png. A second normal synthetic sign-in
accepts disclosure before Android's actual foreground prompt and Allow all the
time settings. The actual location service remains foreground-active after
normal Android Home. Shipment UI reads back a current-day location timestamp;
background origin is not inferred. Normal Sign out returns to guest login with
no prior banner or active foreground/start-requested location service. Expo's
inactive bound-service record is distinguished from active collection after a
controlled harness diagnostic against its unregister implementation.
No adb permission grant, human consent backfill or other app interaction occurs.
Owner review, qualifying video, physical GPS and replacement standalone
verification remain pending.

FEAT-PLY-001 AC5 / NR-25: `android-release-permissions.test.mjs` adds five passing
checks for required shipment/alert preservation, inherited unused grants, debug/
foreign artifacts, both compiled manifest formats and malformed input.
`verify-android-permissions.mjs` inspects an exact APK through aapt2 or exact AAB
through bundletool, binding a passing receipt to its artifact SHA-256. Both prior
code-4 artifacts fail UNUSED_RELEASE_PERMISSIONS as expected; next-build config
blocks the overlay permission. Twenty combined focused tests, mobile typecheck/
lint and spec/source checks pass. No rebuilt standalone pass or remote release
gate is inferred, and the existing web/backend/Play release remain unchanged.

FEAT-PLY-001 AC1 / FEAT-MOB-001 / NR-27: the native shipment screen's obsolete
leave/lock-pause promise is replaced by the existing five-language explanation.
`tracking-location-copy.test.mjs` detects the original contradiction and requires
the translated replacement. Actual native capture
.local/play-native-notice-tracking-explanation.png excludes recipient addresses;
.local/play-native-notice-guest-after-service.png records normal cleanup.
Owner review and a standalone replacement remain pending.

FEAT-PLY-001 AC5, October 10 owner-requested store presentation: source artwork,
brand-overlay SVG, listing-en-US.json and the bounded export script are under
resources/marketing/google-play/. The latest owner direction replaces the
text-heavy draft with striking freight artwork and only the brand name. Built-in
imagegen creation and its exact prompt retain explicit AI-assisted provenance and
a proposed AI label in artwork-provenance.json. Local
exports pass exact 512 × 512 RGBA icon/1024 × 500 RGB feature-graphic checks;
name/short/full lengths 10/76/1640 and image descriptions ≤140 pass. The local
3135 review page passes desktop/phone no-overflow checks. Actual 1080 × 1920
development-preview Capacity, selected-signal and private-entry drafts retain
native/export hashes and exact RGB equality during opaque PNG conversion.
Final standalone screenshots, owner approval and Console replacement remain
pending; the existing saved listing is unchanged.

October 10 subsequent FEAT-PLY-001 operational evidence supersedes the connection
checkpoint: exact EAS 066f028f-0cb0-4286-9830-40815264e11e FINISHED for code 4;
internal 4700942405023499701/release 1 is Active/available/Not reviewed. Existing
Google signing/upload certificate are verified without changing keys. Alpha
4699446366767369053/release 1 is a saved Draft with code 4, the separate ten-address
Loadgistic closed testers list and Ethiopia/US eligibility. The owner-supplied set
matches Google's parsed list exactly; independent reload confirms ten and Alpha-only
selection. Internal owner list/association are unchanged. Two more real testers
remain necessary; no invitation email, enrollment or clock is inferred. Protected
receipt: .local/play-20261010-closed-roster-receipt.json; raw addresses stay out of Git.
The actual internal opt-in URL is verified, not guessed.
AC3 supplementary actual Expo-web block/reload/unblock and report form pass;
content-blocks unit tests pass 2/2. No hosted report/customer mutation is submitted.
AC4 three normal-auth entries are saved only in Google's private reviewer form.
AC5 privacy/ads/ad-ID/government/financial/health/adult audience/IARC and 16-type
Data safety are saved; Business/contact metadata is verified. Existing copy/brand/
two unmodified native captures are a listing Draft. Everyone/PEGI 3 includes Users
Interact/Shares Location. The proposed AI label was rejected for incomplete recorded
provenance; the exact owner question remains pending, with no alternate bypass.
Native AC1/AC5 remain incomplete: code 4/public Capacity render, but screenshot-
confirmed System UI ANR and one bounded recovery failure prevent a demonstrated
Android permission/active-Tracking video. Only the owned emulator is stopped,
data preserved. No closed-test clock, Google review, public launch, physical GPS/
closed-phone or 16 KB-device acceptance is claimed. Protected sanitized receipts
are .local/play-20261010-*; runtime/native/SQL stay unchanged since CI 38012117505.

October 11 owner visual approval: revised Featured/Tracking/map previews on
8084/3100 and regional promo review on 3135 accepted explicitly. Full local
quality passes 495 root and 149 mobile tests, root typecheck/source/spec checks
and mobile lint. Replacement source is version 1.0.5/code 6; exact CI, compiled
artifact, installed native and hosted publication evidence remain pending.

October 11 NR-30 / FEAT-MOB-001 follow-up: CI 38168316955 fails the prior
shared-leg spacing gate, so candidate 25e9ca3 is held. Actual-vertex displacement
bounds replace the global worst-case join floor. Root lane/world tests and native
discovery tests pass; real shared-leg desktop/phone taps pass at measured street
scale with all separation, camera and background gestures retained. Full quality
passes 496 root and 149 native tests. Matching CI/native/web publication remains
required. Protected evidence: .local/runtime-release-20261011-*-followup* and
shared-lane-street-scale/; no hosted schema or settings changes.
