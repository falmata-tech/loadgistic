# Progress

## Assisted repair/release — 2026-09-17

The owner authorized a one-time assisted execution of the reviewed Loadgistic
repair/release, preserving the safe workflow. Owner-only remains the standing
default. See PRODUCTION_AUTHORITY for the exact scope and stopping conditions.

- [ ] Recheck exact hosted project/advisors and provider ownership.
- [ ] Publish the tested security changes to draft PR #15 and obtain clean CI.
- [ ] Resolve the critical hosted finding through its actual owner; no bypass.
- [ ] Apply only reviewed release changes after every prerequisite passes.
- [ ] Record hosted evidence or the precise provider/access blocker.

## Security alert and agent authority — active, 2026-09-16

Scope: FEAT-SEC-001 / BASE-DEP-001 / FEAT-IAM-001; security and operations.
The owner approved encrypted hosted database/private-file backup and isolated
restore. Previous backup approval is resolved; deployment authorization is now
superseded by the 2026-09-17 selection of **owner-only production changes for now**.
No automation account is selected. The agent prepares/tests; the owner applies
hosted writes, credentials/configuration, protections, merges and deployment.

- [x] Independently verify Loadgistic project and live advisory/catalog metadata.
- [x] Identify critical table: public.spatial_ref_sys, owned by supabase_admin;
  anonymous CRUD grants exist. Other public tables have RLS enabled.
- [x] Verify ordinary postgres cannot alter that table; do not bypass ownership.
- [x] Complete approved encrypted backup and isolated restore verification.
- [x] Specify and locally test exact owner repair, role denial and catalog recurrence gate.
- [ ] Have Supabase execute the hosted owner repair and verify the live finding clears.
- [x] Implement scoped read-only advisor monitoring and owner change-review rules.
- [ ] Provision the scoped monitor token and install provider-side restrictions.
- [x] Prepare provider-side least-privilege/protected-release settings; distinguish
  actual enforcement from repository rules and pending owner work.
- [x] Fix and verify stale signup verifier setup found by clean CI.
- [x] Record tested evidence, hosted repair status and remaining deployment gates.

Read-only findings: Supabase credential is classic-or-unknown, GitHub credential
has repository admin permission, and main has no branch protection. These are
not yet limited by provider enforcement. Prior CI run 34861635105 failed during
signup fixture verification; subsequent SQL/container/E2E jobs did not run.
Production still has migration 076; draft PR #15 is not deployable yet.

Local evidence: quality passed 297 tests, TypeScript, 29 specs/26 features and
349 source checks. The real catalog gate failed before owner repair and passed
after; anon/authenticated CRUD denial and service PostGIS transformation passed.
A new unprotected-table canary was rejected and fully rolled back. The corrected
signup verifier passed. The broader local fixture verifier stopped at 144 active
vehicles versus its clean-fixture contract of 143; existing local data was preserved,
and clean remote CI remains required. Both ignored legacy bulk production-write
helpers now fail before loading credentials or running tools.

The private Storage archive contains seven bucket definitions and one object;
authenticated decryption and byte/hash recovery passed. The ordinary full database
dump timed out twice; the bounded streaming export then succeeded (1,858,785
archive bytes), with authenticated decryption and SHA-256 recovery verified.
The full database restored successfully (2,268 archive entries, 52 public tables,
ledger 076) in a disposable container with network disabled, no host mounts and
scheduled jobs disabled; the container was removed. The private object was restored
to a unique local Storage path, downloaded and hash-verified, then removed with
cleanup verified. Recovery keys still require separate owner custody before
routine agent credentials are isolated.
No plaintext archive, hosted repair, credentials/protection change or deployment
is claimed. Read [PRODUCTION_AUTHORITY.md](PRODUCTION_AUTHORITY.md) for the concrete
owner action list and prepared Supabase repair request.

## Deployment preparation — active, 2026-09-14

The owner authorized deployment. Audit candidate `b22bc3a` is committed and pushed
in draft [PR #15](https://github.com/falmata-tech/loadgistic/pull/15); required CI
failed on the stale signup fixture described above; no production promotion
has occurred. The preserved untracked
`.next-upload-audit/` directory is outside this release.

Hosted Loadgistic is verified at migration 076
and Netlify commit `451edd1f`; migrations 077–095 and the new account-security
callback still need rollout. The dependency audit is clean. The full 166-case
browser release suite finished with 139 passes, 19 failures and eight opt-in
visual skips (52.8 minutes). It exposed test-readiness/selector drift (F25),
expired local sponsor placements (F27), and late phone navigation/timeouts.
The fresh-server retry passed 14 cases; all six final desktop/phone checks
passed after correcting handle and Tracking navigation readiness. All 158 enabled
cases now have passing evidence across runs; this is not one clean full-suite run. Release review also found and fixed
missing Docker context exclusions for local credentials and deployment state
(F26). A scratch build proved context exclusion; the normal production container
build hit Docker Hub DNS timeouts on both attempts. CI now includes the audit SQL,
concurrency and context-canary gates.

The initial backup approval block was resolved by the owner; encrypted database
and private-file exports now have verified decryption and isolated restore
evidence. No production mutation or deployment has occurred. The candidate is in draft review
for required CI; do not promote it while the release gates remain unresolved.

## Recorded audit — verified locally, 2026-09-14

The recorded F04/F05/F06/F09/F10 work and additional F16–F21 repairs have local
verification. Migrations 090–095 implement recovery, bounded admin correction,
confirmed-email/retained account deactivation, spatial capacity windows,
incremental Support polling and public metadata privacy. Closure resolves active
work, deactivates access and retains shipment, audit and file history.

All 34 affected desktop/phone browser cases passed across focused runs, including
real local Auth/Mailpit and private Storage workflows. Seven rollback SQL suites,
six observed-lock concurrency cases, the 5,000-truck scale audit, 290 tests,
TypeScript, 28 specs, 349 source checks and the final 86-page production build
passed. BUILD_VERIFICATION records the evidence. Temporary audit identities and
scale trucks were cleaned.

[AUDIT_COMPLETION_2026-09-14.md](AUDIT_COMPLETION_2026-09-14.md) records the exact
checks and remaining limits. F22/F24 are now repaired: selected truck feedback
occupies its own summary row, and narrow summaries leave zoom controls clear.
All 10 related desktop/phone cases passed across focused runs, including 320px
refresh failure/retry; corrected screenshots were inspected. F23 removes stale
runtime-pending headings from the already verified spatial/polling specs.
Owner visual approval is not claimed. Local Auth auto-confirm does not prove hosted
two-link enforcement; phone-background GPS remains unsupported. Hosted rollout
and its upload verification remain separate. No commit, push or deployment.

Earlier sections below are dated checkpoints; they do not override this status.

## Member Support attachments — 2026-09-14 (verified locally)

Scope: F05 attachment parity, FEAT-SUP-001 / BASE-BE-001 / BASE-DEP-001.

- [x] Specify actor scope, private-file lifecycle and retained history.
- [x] Add reservation/attachment/read/cleanup contracts and Storage adapter.
- [x] Wire member/staff reply upload and authorized download links.
- [x] Verify SQL denial, real Storage, historical files and failed uploads.
- [x] Run quality/build and record local evidence and rollout limits.

Evidence: 277 tests, TypeScript, 28 specs/334 source files and the 85-page build.
Final desktop/phone attachment workflows passed both cases; all six existing
Support history cases passed. Rollback SQL covers authority, atomic messages,
history, lost responses and grace-period cleanup. Six final screenshots are in
`artifacts/support-attachments-2026-09-14/`; visual approval is not claimed.
Synthetic attachment rows, test profiles and member-support Storage objects are
all zero after cleanup. Migration 089 is applied locally only; it must precede
UI/worker rollout. No commit, push or deployment. F05 push delivery and the
remaining F04/F06/F09/F10 audit work stay open.


## Tracking location controls — 2026-09-14 (verified locally)

Scope: F11 Driver radius selection and honest foreground-location status,
FEAT-TRK-001 / BASE-FE-001 / BASE-BE-001. Background GPS remains unsupported.

- [x] Specify radius, cooldown feedback and cancellation boundaries.
- [x] Add Driver radius controls, accurate state feedback and single-flight updates.
- [x] Prove hidden/unmounted callback cancellation and real location persistence.
- [x] Run desktop/phone workflows, quality/build and update evidence.

Evidence: 272 tests, TypeScript, 28 specs/332 source files and the 85-page build.
The combined location/proof browser run passed four cases; both final delayed-
GPS radius cases passed after the initial-selection timing fix. Four screenshots
are in `artifacts/tracking-location-controls-2026-09-14/`; visual approval is
not claimed. Synthetic Tracking and outbox cleanup counts are zero. No schema,
commit, hosted change or deployment. F04/F05/F06/F09/F10 remain separate audit
work; F11 background GPS remains an explicit operational limit.


## Public fleet paging — 2026-09-14 (verified locally)

Scope: the public-profile fleet portion of F06, FEAT-PRV-001 / FEAT-LST-001,
BASE-BE-001. Spatial map loading remains separate.

- [x] Specify bounded fleet pages, complete capacity lookup and stable summaries.
- [x] Add owner-scoped fleet paging and narrow capacity before latest-state selection.
- [x] Wire canonical public page navigation and accurate count labels.
- [x] Verify fleets beyond 96 trucks, privacy/visibility and desktop/phone navigation.
- [x] Run quality/build and record local evidence and rollout limits.

Evidence: 265 tests, TypeScript, 28 specs/331 source files, 85-page build,
rollback SQL including final migration replay, unchanged ordinary-query results
and four desktop/phone browser cases. Six screenshots are retained in
`artifacts/public-fleet-paging-2026-09-14/`; visual approval is not claimed.
Synthetic fixture cleanup returned zero remaining records. Migration 088 is
local only; no commit, hosted apply or deployment occurred. National viewport
queries and private spatial scaling remain the next separate F06 work. Other
open audit items are retained in CURRENT_FEATURE_AUDIT_2026-09-13.


## Driver portrait audit repair — 2026-09-14 (verified locally)

Scope: F08, FEAT-FTR-001 / FEAT-IAM-001 / BASE-DEP-001, ADR-054.

- [x] Specify Driver ownership, public consent, normalization and cleanup states.
- [x] Add portrait schema, reserved private uploads and bounded deletion retries.
- [x] Add Account controls and Featured image projection with revocable reads.
- [x] Verify permission/cleanup SQL and real desktop/phone Storage workflows.
- [x] Run quality/build and update audit, traceability and evidence.

Evidence: 262 tests, TypeScript, 28-spec/330-source checks, 85-page build,
rollback SQL and four final portrait desktop/phone workflows passed. The combined
account/portrait run also passed all six cases. Eight screenshots are in
`artifacts/driver-portraits-2026-09-14/`; visual approval is not claimed.
Migration 087 is recorded locally only. No remote deployment or commit occurred.
F04 recovery administration, F06 spatial scaling, F09 email-change/closure,
F10 lifecycle actions, F05 member attachments/push and F11 foreground GPS limits
remain separate audit work. Hosted migration/native-artifact/worker validation
remains required before portrait rollout; see BUILD_VERIFICATION.

## Remaining account audit repair — 2026-09-14 (verified locally)

Scope: F09 name/account-phone editing and fleet phone isolation (FEAT-IAM-001,
FEAT-FLT-001). Name remains a shared display identity. Email change and closure
remain deferred; F08 portraits remain a separate subsequent item.

- [x] Inspect actor/data boundaries and specify privacy, denial and rollback.
- [x] Implement strict self-edit command and account form; isolate fleet callbacks.
- [x] Verify SQL permissions and real desktop/phone save, clear and denial flows.
- [x] Run quality/build and record evidence, scope and outstanding work.

No commit, remote publication or deployment is authorized by this checklist.
Evidence: 256 tests, TypeScript, 28-spec/source checks, 84-page build, rollback
SQL and four passing account/fleet desktop/phone workflow cases. Migration 086
is recorded locally only. Four screenshots are in
`artifacts/account-details-2026-09-14/`; visual approval is not claimed.
F08 real Driver portraits are now verified in the checkpoint above. F09 email-change and
closure, F04 recovery administration, F06 spatial scaling, F10 lifecycle actions,
and F05 member attachments/push remain open. See BUILD_VERIFICATION for the
native-form test scope and existing JavaScript-disabled shell limitation.

## Chat-history audit repair — 2026-09-14 (local)

Scope: F05 retained-message access and its discovered unassigned-agent denial
edge case (`FEAT-SUP-001`, `FEAT-GST-001`). Loadgistic only.

- [x] Inspect existing contracts and record the bounded-window design in specs.
- [x] Add NULL-safe guest assignment checks and rollback-only denial tests.
- [x] Add service-only, conversation-scoped history cursors and ordering tests.
- [x] Wire member, staff, recovery and launcher history navigation; preserve drafts.
- [x] Run real local database/browser workflows and capture desktop/phone states.
- [x] Run quality/build and update master prompt, audit and traceability evidence.

No remote publication is authorized by this checklist. The remaining F04/F06/
F08/F09/F10 capabilities and F05 member attachments/push transport remain open.
Evidence: `BUILD_VERIFICATION.md`, `tests/sql/support-history.sql` (rollback),
252 quality tests and 12 focused desktop/phone chat cases. Migrations 084–085
are local only. The focused screenshot pass is not user visual approval.

## 2026-09-14 — resumed map/navigation overlap fix (local)

The interrupted `FEAT-UIX-001` fix now has focused evidence: shared desktop
rail measurements keep the map/search panel beside navigation, and remaining
flex height accounts for the header and tablet navigation. Four Open/Private
desktop/phone browser cases pass at ten widths from 320 through 2560, including
320-by-640 reflow, Filters open/close, About navigation, real local private email
OTP entry, and logout. Synthetic grants are revoked after each private case.
All 248 tests, 28-spec validation, source checks, TypeScript and the production
build (83 generated pages) pass.
Sixteen map/filter captures are in `artifacts/map-shell-2026-09-14/`.
User visual approval and deployment are not claimed. Earlier audit gaps and
the existing uncommitted audit work remain; see `BUILD_VERIFICATION.md` for the
exact gate status and scope.

## 2026-09-13 — first audit repair batch

Fixed F01 private geographic eligibility, F03 chat success/reset errors, F07
unknown-location broadening, F12 pre-Auth team authorization, and F02 Tracking
proof retrieval on provider/guest/admin timelines. Reduced F05 polling overhead
and corrected known documentation drift. Migration 083 is local only.
Evidence: 248 tests, TypeScript/build, rollback SQL authorization and 10 focused
desktop/phone browser cases. Proof tests used real local Storage and Mailpit;
chat tests mocked transport. Remaining admin/account/lifecycle/portrait and
large-map/history work remains explicitly open in the current audit. No deploy.

## 2026-09-13 — current-feature audit and explicit upload policy

The current feature inventory and concrete gaps are recorded in
`CURRENT_FEATURE_AUDIT_2026-09-13.md`. The read-only audit verified eight admin
record types on desktop/phone, seven public phone entry pages, and reproduced
private-filter false positives and the anonymous chat post-success reset error.
Those functional defects are documented, not silently claimed fixed.

The owner's subsequent instruction approved antivirus-optional uploads. The
explicit validation-only mode retains private storage/file checks and reports
that files are not virus-scanned; see ADR-052 and BASE-DEP-001. No production
configuration or deployment has been changed in this task.

## 2026-09-13 — fleet onboarding gaps repaired (local)

- My Fleet now exposes Invite driver beside Add truck. Owners can send/retry or
  cancel an email invitation; a recipient verifies email using normal account
  access, explicitly accepts, then appears in Driver access for assignment.
- Assignment retains the selected truck and permission saves retain list
  context. Driver name/phone editing and confirmed removal are separate actions.
  Removal immediately ends operating access and assignments without deleting
  shipment/document history. Truck details can be corrected independently.
- Tracking and Network empty states now lead owners to Add truck/Manage drivers;
  Company drivers receive employer-assignment guidance instead of owner links.
- Local migrations 081–082 enforce email proof, membership, expiry, cancellation,
  conservative permissions, same-fleet rejoin, contact-safe audit, and no silent
  account transfers. Both migrations are applied and recorded locally only.
- New-fleet desktop and phone tests created owner and driver through real local
  Auth OTP, verified invitation delivery in Mailpit, assigned and published a
  truck, edited details and revoked access. SQL and existing Fleet/trailer checks
  passed. Final gate details are recorded in BUILD_VERIFICATION.md.
- No Production database, deployment, external email recipient, or other project
  was changed. Hosted release must apply pending migrations 077–082 first and
  verify actual hosted invitation email, OTP/Google acceptance and revocation.

## 2026-09-13 — launch controls and automatic Featured (local)

- Platform Settings now offers Free access (default) or confirmed Trial, then
  payment. Free hides expiry/payment prompts and rejects new payment proofs;
  activation gives unpaid existing providers seven days without changing paid
  history. Company Drivers inherit the same fleet policy.
- Featured supports Automatic selection (default eight, adjustable one through
  twelve) and Manual only. The existing scheduled worker prepares missing dates
  for the next seven days using distinct eligible Drivers and the daily truck
  theme. Manual days and already published days are preserved. Admin can prepare
  immediately or continue selecting/publishing a specific day.
- Shared neutral skeletons cover route transitions, records, forms, map modules,
  and initial chat; Featured retains a board-shaped neutral placeholder. Native
  POST actions show pending feedback without losing submitted button commands.
- Local Supabase has `079` and `080` applied and recorded. SQL regressions and
  verification/billing checks passed; Free and Auto remain selected locally.
  No remote migration, deployment, payment activation, or other-project change
  occurred. Deployment must include pending `077`–`080` before client/worker
  publication. See the dated build-verification checkpoint for final gates.

## Current verified product

- Local 2026-09-13 Driver linkage is explicit in Fleet rows, owned truck details,
  and the selected-truck map header. Migration `078` requires a current active
  independent Driver or same-company assignment for publication and both capacity
  maps; missing documents are not a gate. Review summaries distinguish Driver
  and truck evidence, with neutral missing/expired categories and emphasized
  current approvals. Local rollback SQL, desktop/phone workflows, 223 Node tests,
  TypeScript, optimized build, and a 5,000-truck/Driver scale transaction passed.
  No production deployment or remote migration was performed for this change.

- Local 2026-09-13 capacity editing uses focused native dialogs over the retained
  map, with no Edit all. Capacity, Coverage, Sharing, Loads, Regular service, and Location save
  through authorized Supabase commands without document navigation. Migration
  `077` preserves the last actual Driver fix on non-location edits and makes
  regular-service replacement atomic. Desktop/phone workflows, the local managed
  verifier, quality gate, and optimized build are recorded in
  `docs/BUILD_VERIFICATION.md`. This change is not yet deployed to Production.

- Follow-up capacity-action verification separates status from visibility and
  load preferences, adds readable phone action labels, and reserves map/header
  space for the six-button rail. A reproduced rapid-edit race is fixed by waiting
  for refreshed server facts before opening another editor. Known validation
  errors now explain the correction; unknown database failures retain safe codes
  only. First publication defaults to Private until Sharing is explicitly opened.
  The user's exact generic save failure has not reproduced on the verified local
  fixture; confirming local versus hosted origin remains necessary before
  attributing it to a specific backend failure.

- Loadgistic presents Capacity Sharing and Shipment Tracking as its two primary jobs. The canonical Open capacity workspace at `/` uses bounded cursor loading, one unranked Map result surface, live Transporter/Truck suggestions, and conjunctive advanced filters. The public navigation order is Open capacity, Private capacity, Track, Featured, and About. Desktop uses a floating workspace rail and phones use the fixed five-destination public navigation. The Map progressively appends bounded batches; there is no public List view, manual Load more action, or ranking surface. Browser geolocation centers the Map without mutating results; proximity is a separate opt-in filter. Current and regular Capacity routes contain two through five ordered cities, while current and regular Service areas use a center plus three through five boundary cities rendered as polygons. Each transporter has at most one regular-service signal. Search covers every stored route and area city. Visible shipment origin and destination inputs can be applied independently or together: Capacity routes evaluate every ordered segment and eligible Empty Service areas evaluate their complete polygons. Approximate truck location remains an independent violet circle. Panning is bounded to practical East Africa context while phones without location start at a useful Ethiopia camera. Status-specific bounded clusters use linear screen buckets at least as wide as their markers, never combine Empty with Partial, never exceed eight trucks, and separate nearby labels in screen space. A crowded maximum-zoom cluster opens a bounded truck chooser rather than an overlapping marker ring. Private-network trucks are absent from anonymous markers, search, filters, and regular-service projection. `/capacity` is compatibility-only.
- Busy deterministic supply market: 30 published providers, comprising nine fleet companies and 21 independent provider profiles, with 143 active trucks distributed through weighted Ethiopian freight markets and 64 real named cities, towns, or localities rather than equal regional quotas, repeated centers, identical fleet patterns, or diagonal offsets. No exact locality holds more than five source trucks; the 33-truck public subset spans 24 exact named locations with at most three at one locality. One hundred local-delivery motorcycles, cars, vans, pickups, and mini trucks use routes or Service areas within 30 kilometres; light trucks cover wider local networks and only occasional medium/heavy trucks use regional corridors. Every public truck projects one Driver first name, callback phone, operating model, and separate Driver/truck document-category status without exposing proof files or private account data.
- Uniform white-space Loadgistic `/@handle` microsites are reached only from Truck Market details. They show provider identity and facts, independently visible contacts, colorful verification badges, verified reviews, and one detailed card for every active truck. A truck's latest published Empty/Partial signal lazily opens a selected-truck map that compares its reported public geometry with a browser-only visitor point and labels capacity age separately from approximate-location age; Off Duty trucks expose no old map location. There is no Provider Market, provider list/map, or Area Market; provider-name search returns only that provider's published trucks.
- Fleet-owner and self-managed provider workspaces for trucks, current Service-area/Capacity-route publication, one regular Service area or Capacity route, profile editing, verification, billing, and support. Authenticated workspaces do not duplicate the public Market or Featured workspaces; role-aware More navigation links to their canonical public routes while retaining a direct Exit dashboard action.
- Truck-scoped Private capacity networks let an assigned Driver share the Driver-selected approximate location and current Empty/Partial signal with approved emails; the fleet owner can inspect and revoke all owned-truck grants. One ten-minute single-use email OTP opens a restricted browser session and one Shared capacity map containing every active truck shared with that address, without a member profile or dashboard. The session ends after 30 minutes without deliberate visitor activity, background map traffic does not renew it, and a visible Log out clears access immediately. A distinct Share with Loadgistic audience supplies the Operations-authorized private matching map without a pretend platform email.
- Account-free Assisted matching starts from a persistent floating launcher with required email, required callback phone, and a short message instead of a shipment form. Available team members are assigned immediately, availability is visible, and active guest threads refresh every two seconds while visible. The chat survives public-route changes, exposes a clear attachment control, and gives guest and team explicit End chat; a closed transcript is retained and the guest can start a distinct new session. `/help` is recovery-only rather than public navigation. The workflow creates no demand, ranking, transaction, or account and makes no service guarantee.
- Unified capacity console with Empty or Partial status, Service area or Capacity route, Off Duty, a collapsed map-centered summary, focused editors for stored facts, an automatic and manual Driver location refresh, and direct approximate-location controls. Service areas and all routes use the same ordered place geometry as the public Market.
- Provider-owned Tracking created after offline agreement by an owner, self-managed Driver, or assigned company Driver, with one customer-owner email/code/link, one ordered status action panel from Going to pickup through completion, optional images only at Loading/Unloading/Issue, optional assigned-Driver approximate location projected only during travel, 30-day guest access after completion, provider history retention, and idempotent access/completion email delivery.
- All-score provider reviews from the emailed customer owner; one- to three-star provider disputes remain visible and counted pending review.
- Evidence-specific National ID, Business License, Business Address, Driver License, and pairing-specific expiring truck-authorization review with vivid category colors. Due-diligence warnings remain attached to public truck and transporter review surfaces rather than authenticated workspace pages.
- Provider-only signup separately offers Fleet transporter, Owner-operator, and Self-managed driver accounts; Company drivers remain attached to their named fleet. Capacity-seeker signup, public Business profiles, Shipment Board, demand posting, interests, Direct requests, pooled/along-route demand, and demand-side member networks are retired and blocked or redirected. The current provider Network is only truck-scoped private-capacity access.
- Local deterministic migration purges fake legacy demand records, Business workspaces, relationships, favorites, and Business reviews while retaining provider supply and provider-owned operational history.
- The About workspace carries the detailed story centered on manufacturers, workshops, growers, producers, owner-operators, self-managed Drivers, and small fleets without delaying the Truck Market.
- Dedicated `/featured` Daily Featured Transporters workspace with one fixed seven-day Ethiopia programme, a compact region/date introduction, variable administrator-ordered transporter roster, a dynamically growing public-feature billboard with numbered provider portraits, evidence-based Fleet transporter/Owner-operator/Self-managed driver labels, and an automatic/manual two-session Ethiopia-time timeline. Automatic mode shares provider time equally, keeps a four-hour midday intermission, inserts separate changeovers and Sponsor breaks, and shortens low-participation days toward late morning and late evening. Admin can configure bounded defaults, regenerate the schedule, or edit validated provider intervals; the public live state distinguishes providers from every break. The compact transporter detail and separately disclosed Sponsored transporters panel remain independent. Its single-perimeter photorealistic display asset supplies physical realism only to the featured board while provider cards, numbers, schedule, live state, and interactions remain dynamic HTML. The responsive grid adds real rows and section height without a fixed stage, nested frame, pan, or zoom. The Sponsored panel is a solid right rail on wide screens and a compact above-board horizontal collection on narrow screens. Featured and sponsored transporter actions open the provider microsite or filter the Truck Market to current trucks.
- One public-first installable PWA launches into account-free Open capacity and provides Open capacity, Private capacity, Track, Featured, and workspace shortcuts without caching navigation responses or framework chunks. Public navigation shows Log in while signed out and Dashboard while signed in; transporter signup is reached from the login page. Drivers and fleet transporters retain their role-specific five-destination bars and branded workspace top bars.
- Managed transporter login presents Google OAuth and a six-digit email code through Supabase SSR PKCE. The fixed deployment callback rechecks the active Loadgistic role projection, never accepts a dynamic destination, and keeps all upstream failures generic. Password login is available only when an explicit non-Production fixture flag is enabled. Public signup offers the same Google or six-digit email-code choices through a signed 15-minute handoff, asks for provider facts only after identity proof, and atomically creates the selected provider workspace, draft public page, approved signup record, and seven-day trial without treating signup as verification.

## Verification evidence — August 2026

- The managed sign-in slice passes specification/source validation, seven
  focused auth/readiness tests, TypeScript, and four desktop/mobile local-fixture
  browser workflows. Tests prove the fixed HTTPS Production callback, minimum
  Google identity scopes, non-creating email OTP request, numeric-code bounds,
  role destinations, and Production denial of the fixture-password flag. Google
  console, exact hosted Redirect URLs, verified SMTP, and hosted numeric email
  template configuration remain owner actions before remote login testing.

- Private capacity and Assisted matching currently pass 28-spec validation, TypeScript, the optimized production build, and focused repository/domain tests. Focused desktop/mobile Shared capacity coverage proves the email gate, 30-minute cookie boundary, non-renewing map reads, visible logout, cookie clearing, and required re-verification. Tests also prove public/private projection separation, Driver/owner grant authority, immediate revocation, Operations-only Loadgistic sharing, guest/team chat isolation, absence of demand records, and managed recovery-email templates. Focused screenshots are under `artifacts/private-capacity-assisted-chat-v1/`; visual approval remains pending.

- The current map-only Market, route/area filtering, East Africa panning, status-specific clustering, and phone-camera correction pass specification validation, TypeScript, all 21 capacity-market tests, and six focused desktop/mobile browser workflows. Origin and destination work alone or together, Empty Service areas participate without ranking, loaded results remain bounded, clusters contain only Empty or only Partial trucks with no more than eight members, and visible status labels do not overlap. Focused screenshots are under `artifacts/focused-2026-08-15-market-final/`; the expensive full-site visual audit remains approval-gated.
- The unified mobile application shell passed its public desktop/mobile workflow test, PWA manifest/cache-boundary test, TypeScript, and two complete 82-screen desktop/mobile multi-role visual sweeps. The correction sweep finished with zero layout/accessibility flags, zero horizontal overflow, and zero browser-flow errors across logged-out, fleet transporter, self-managed Driver, company Driver, administrator, and support views. Evidence is under `artifacts/ui-audit/`.
- The final release-wide Playwright regression passed 34 desktop/mobile workflows with two opt-in capture-only scenarios skipped. It covers public Market entry and mobile app navigation, search/filter/multi-city matching, map clusters and contained hover summaries, visitor location, transporter microsites, featured scheduling, provider profile editing, provider-owned Tracking, Driver Home, capacity editing, retired-route redirects, and credential-safe login.
- The maximum-one regular-service change passes specification/source checks, 66 automated tests, TypeScript, the optimized production build, and the affected public List and Driver summary/editor browser workflows on desktop and mobile. Tests prove both regular Service-area and Capacity-route persistence/projection, second-signal rejection in application and database layers, current-location-related demo geometry, and route/area search matching. Focused screenshots are under `artifacts/regular-service-v1/`; the expensive full-site visual audit remains unrun.
- `npm run check`: specification and source validation passed.
- `npm run quality`: specification/source checks, 39 automated tests, and TypeScript passed.
- `npm run build`: optimized Next.js production build passed.
- A prior `npm run test:e2e` release gate passed 22 desktop/mobile workflows covering Map-first entry, visitor location, selected-truck focus, responsive List cards, stable owner Tracking access, capacity editing, and platform-managed microsite presentation. Later simplification replaced its maximum-two regular-corridor behavior with one regular Service area or Capacity route and moved Market access to the canonical public route; the current batch requires fresh focused browser evidence before release-wide claims are updated.
- `npm run test:ui-audit`: 82 current desktop/mobile screens passed with zero automated layout/accessibility flags and zero browser-flow errors across public, fleet-owner, self-managed Driver, company Driver, administrator, and support-agent views.
- Automated browser verification and visual capture covered the map key, vehicle-image markers, selected approximate-location/current/two-way-regular-corridor layers, overlapping-truck separation, responsive detail and List cards, cluster restoration, the capacity summary, Tracking, and provider presentation.
- Production and development dependency audit previously reported zero vulnerabilities; dependency state was not changed by this feature.
- Current focused verification passed specification/source checks, TypeScript, 67 domain/repository/layout tests, explicit Truck List pagination, and the capacity-only Driver Home on desktop and mobile. List pages retain 14 bounded records without horizontal overflow; Driver Home exposes one Capacity management page title, no embedded Tracking section, and direct Tracking navigation.
- The latest focused verification passed TypeScript, specification/source checks, the optimized production build, 16 capacity/featured-board tests, and four desktop/mobile browser checks covering current Transporter/Truck suggestions, exact truck selection, selected-signal focus summaries, and preservation of the selected truck card. The preceding focused public-entry check also passed on both layouts. A full visual audit has not been run.
- The corrected billboard review passed seven featured schedule/repository tests and the focused public-entry browser workflow on desktop and mobile. That browser check temporarily expands the real responsive grid to eleven portrait tiles, proves full available width, multiple natural rows, no overlaps, no fixed-stage scrolling, and complete billboard containment, then removes the test-only clones. Focused screenshots are under `artifacts/featured-billboard-v2/`; the full visual audit remains unrun.
- The two-session featured schedule review passes specification/source checks, 65 domain and repository tests, TypeScript, the optimized production build, and four focused public/admin browser workflows across desktop and mobile. Two focused capture workflows record the public timeline and administrator scheduler under `artifacts/featured-schedule-v1/`. The expensive full-site visual audit remains unrun.
- The selected-truck layout and sponsorship correction passed TypeScript, specification/source checks, and focused desktop/mobile browser workflows. The checks prove the desktop detail rail does not overlap the resized Leaflet canvas, the mobile card follows below a full-width map, close restores the original map width, capacity signals use one contained high-contrast hover/focus summary without a second click card, and Sponsored transporters remain a separate right panel or compact above-board mobile collection. Focused screenshots are under `artifacts/selected-truck-rail-v1/`; the full visual audit remains unrun.
- The location-aligned demonstration geography and map-centering correction passed the complete 60-test quality gate plus six focused desktop/mobile browser workflows. Automated checks prove current routes touch each truck's approximate city, Service-area polygons contain their nearby center and truck point, regular routes remain relevant to the provider base, permission refresh does not apply proximity, and the nearby-truck filter remains explicit. Focused inspection confirmed a representative Addis Ababa–Bishoftu–Mojo–Adama signal and the compact unchecked proximity control; the expensive full visual audit remains unrun.
- Focused review captures under `artifacts/focused-list-driver-review/` cover Truck List pages 1 and 2 plus the one-title, capacity-only Driver Home at desktop and phone sizes. They report no horizontal overflow and await visual approval before the current batch is committed.

## Verification evidence — September 2026

- A newly empty isolated Loadgistic Supabase stack replayed migrations `001`
  through `059` in order, rebuilt the managed fixture, and passed every guarded
  live verifier. Migration `058` hardens expiry and retention for Shared
  capacity credentials; migration `059` adds exact-target claims, lease fencing,
  challenge-aware retry timing, Shared-first recovery, and bounded terminal
  Assisted matching email-metadata cleanup. The current consolidated release
  gate is being rerun, so no replacement aggregate test count is recorded here.
- A live local application check on port `3001` returned healthy
  Supabase/PostgreSQL status. Existing-account login and temporary-account
  signup each returned the same bounded, non-cacheable code-sent response and
  created exactly one message in the isolated Mailpit sink; no message body or
  code was read, and the temporary Auth identity was removed. Google login and
  signup both traversed the local Supabase PKCE route with the configured Web
  client, minimum identity scopes, the local Supabase callback, and the
  corrected same-origin application callback for either supported local host.
- Hosted Supabase Auth has the exact Production callback, Google provider,
  numeric login/signup templates, and Gmail SMTP configured; one real hosted
  Auth OTP was received and verified. This proves account authentication mail
  only. The separate application-email credentials for Shared capacity,
  Tracking, and Assisted matching are configured in Netlify, but their deployed
  delivery path has not been exercised with a real pending message. The hosted
  Loadgistic database now has migrations `001`–`076`, seven private 4 MiB
  Storage buckets, and the explicitly approved synthetic Production pilot.
  GitHub `main` merge `787b5526` passed CI run `34647400977`; Netlify Production
  deploy `6aa46d24c2d4c6876a354c13` serves that exact commit. Post-deploy health,
  Open capacity, Featured, Adama search, and Hawassa search smoke passed.
- The complete reviewed Production variable set is now present in Netlify's
  Production context. Session, Tracking, service-role, and SMTP credentials are
  marked secret; Netlify Free necessarily exposes those secret variables to the
  Builds, Functions, and Runtime scopes, while non-sensitive deployment values
  use all available scopes. An authenticated application-SMTP handshake passed
  without sending a message. This proves credential acceptance only, not a
  deployed worker or remote application-email delivery.

## Production work still required

- The Netlify Free site `loadgistic-473`
  (`dbb0fcec-9ec9-4511-9737-db0e32849af5`) is provisioned under the
  `Falmata Dawano` team (`falmatad97`) and linked locally at
  `https://loadgistic-473.netlify.app`. The site is connected to
  `falmata-tech/loadgistic` through a read-only deploy key and GitHub webhook;
  `main` is the sole Production branch. The reviewed Production application,
  Supabase, session/Tracking, fixture-disable, and application-SMTP variables
  are configured without recording their values in source. Production deploy
  `6aa46d24c2d4c6876a354c13` is live. The Supabase-backed health endpoint returns
  `200`; its truthful readiness projection remains blocked only by the missing
  managed malware scanner and retains pilot warnings for SMTP and community OSM.

- Active application routes use Supabase-only managed ports and fail closed after a managed error. Operations and Daily Featured/Sponsor administration join public discovery, Shared capacity, provider Capacity, provider-owned Tracking, transporter-profile editing, managed provider signup, the authenticated workspace shell, Fleet management, Verification, Billing, member Support, Assisted matching, and platform-team management on that boundary. The retired local database modules and their duplicate tests/scripts have been removed; the managed JSON fixture now imports directly into isolated Supabase.
- Provider owners now register trucks from My Fleet/My trucks through one owner-scoped PostgreSQL command. Fleet transporters, Owner-operators, and Self-managed Drivers receive the action; Company drivers do not. Registration creates only the immutable Loadgistic truck number and supplied truck facts, leaving Capacity, location, assignment, and verification unset until their deliberate workflows.
- Administration now opens on a compact Overview rather than the client Home. Users, clients, trucks, Drivers, Tracking, Capacity, routes, and plans link into bounded Records inventories; every row opens a real server-rendered record page, Tracking exposes its bounded status timeline, and related owner/truck/public-profile links keep investigations connected. Review Center, private Capacity, Featured/Sponsors, and Support/team remain distinct named work queues. User-facing navigation no longer presents competing Home and Operations labels.
- The Supabase identity slice now has a parameter-free `auth.uid()` role projection plus SSR Google PKCE, numeric email-code verification, refresh, current-user, logout, and managed signup adapters. Managed completion and workspace-access evaluation no longer import the SQLite repository; both sign-in methods deny a missing or inactive Loadgistic role projection. Google Login and Signup now carry separate signed, HTTP-only flow intents that select the exact PKCE verifier slot, clear after callback, and prevent an abandoned Signup handoff from misclassifying a later Login. Signup uses a signed handoff, separate numeric confirmation template, and the same inactive bootstrap before atomic Owner-operator or fleet workspace/page/application/trial provisioning. Hosted Production Google credentials, exact callback allowlists, numeric login/signup templates, and Gmail SMTP are configured, and one real account OTP was verified. Migration `072` now installs the minimum signup plan catalogue independently of demo data; it repaired the hosted zero-plan provisioning failure without activating or associating the failed identity, which remains eligible to retry. Google login and the complete hosted provider-signup workflow still require human end-to-end confirmation; Preview requires its own exact Auth configuration.
- Managed health and place search now use bounded server-only Supabase projections. A live local check returned `200`, `supabase-postgres`, 154 profiles, and Addis Ababa suggestions without loading SQLite. Database failure returns `503` with non-secret blocker names.
- Active application facades, health, request limiting, private uploads, the scheduled worker, browser-server setup, and the standalone container use Supabase unconditionally. Backend selectors, local private-file storage, process-local abuse counters, and local-database fallback are removed; missing managed services fail closed. Local development, CI, fixtures, browser workflows, and the rolled-back 5,000-truck scale audit use isolated Supabase PostgreSQL.
- The canonical public Truck Market now has its own Supabase application port and server-only PostgreSQL RPC. It retains 12–16-row stable cursors, literal truck/transporter/location search, exact provider and status filters, every-segment Capacity-route matching, complete Service-area matching, opt-in proximity, safe contacts, and Driver/truck badges while excluding an entire Private-network truck from anonymous discovery. Anonymous/authenticated browser roles cannot execute the RPC. A managed Next.js smoke returned the homepage and two duplicate-free Partial cursor pages without loading SQLite.
- Published transporter microsites now use the Supabase application port without importing SQLite. The projection preserves active trucks with and without current capacity, provider-selected public contacts, fixture or protected profile images, operating-model labels, assigned Driver first name/callback, separate Driver/truck document badges, current safe geometry, regular service, the latest 20 review notes, and an all-review count/average computed by a service-role-only PostgreSQL aggregate. Managed Next.js checks returned fleet and Owner-operator pages, kept unknown handles at `404`, and rendered no private proof path or hidden account contact.
- Daily Featured Transporters and Sponsors now use a Supabase application port without importing SQLite. The service-only regional candidate projection rechecks published profile, structured base, public contact, active fleet, current evidence, operating model, review summary, and available-now count. The application preserves administrator order, deterministic automatic/manual schedules, Sponsor-break attribution, eligible transporter Sponsors, and bounded outside ads while removing owner IDs and eligibility internals. The live Production `/featured` request now renders the explicitly approved eight-truck current-day programme and its current Sponsor placements.
- The isolated Loadgistic Supabase CLI stack uses ports `55320`–`55324` so it can coexist with other projects. A newly empty local database replayed the complete migration chain, rebuilt the managed fixture, and passed the live identity, Storage, public-projection, signup, Shared capacity, provider Capacity, provider Tracking, transporter-profile, workspace/Fleet, Verification/Billing, Support/Assisted-matching, platform-administration, shared-limit, private-upload, and browser-denial verifiers with SQLite unavailable. The linked hosted Loadgistic project matches through migration `076` and retains seven private buckets with one 4 MiB limit.
- Local fixture follow-up `174380e` assigns each independent truck to its owning
  Driver identity at import time without changing an existing fleet assignment.
  The 2026-09-05 reset imported 143 assignments and generated seven current
  heavy-rigid Featured slots. GitHub CI run `33926528912` passed validation,
  dependency audit, managed verifiers, 201 contract tests, the 5,000-truck
  rollback scale check, TypeScript, the optimized build, all desktop/mobile
  browser workflows, and the standalone container build.
- The explicitly approved Production pilot import is live under the isolated
  `loadgistic-production-pilot-v1` namespace: 152 non-privileged synthetic
  Transporter/Driver identities, 143 trucks and Capacity signals, 30 public
  provider pages, and eight current Daily Featured truck/Driver slots. An
  independent database/API check/browser verifier confirmed exact counts, zero
  synthetic Admin or Support roles, working private Storage, visible public map
  signals, all eight Featured cards, and zero broken pilot images on desktop and
  phone. The pre-import encrypted backup and deterministic rollback are retained.
- Apply and validate the cloud migrations only after a backup and explicit rollout approval. The legacy-demand purge is destructive by design.
- The managed application-email port sends escaped plain-text/HTML templates through preferred Resend delivery, a bounded authenticated-SMTP pilot, or the optional HTTPS webhook adapter. Supabase Auth email is a separate service and template set. The deployed Netlify runtime includes a 15-minute managed dispatcher plus a two-minute access-email recovery dispatcher, each invoking bounded HMAC-authenticated background work without returning private operation data. Production SMTP variables are configured and their authentication handshake passed. Netlify logs confirm both schedules and background workers are invoked; a real pending Shared capacity, Tracking, or Assisted matching delivery has not yet been monitored end to end.
- Every Leaflet surface now uses one centralized HTTPS tile configuration with visible linked attribution and an exact-origin CSP. The bounded beta falls back to the direct OpenStreetMap community endpoint with a non-blocking launch warning; no proxy, prefetch, bulk copy, or Netlify-hosted tile set is used. Monitor traffic and select a reviewed provider before sustained use.
- Tracking unlock, review unlock, and review submission now use the shared PostgreSQL limiter. Add the remaining public-discovery coverage and reviewed bot protection; configure and remotely prove the managed upload scanner; then complete the actual database-restore rehearsal, monitoring, and a tested rollback. The encrypted Storage-object export has already passed an isolated restore and checksum proof; the local EICAR-aware scanner is test-only.
- The reviewed GitHub-to-Netlify Production promotion and live route smoke are complete. Hosted schema publication through `076`, database SSL enforcement, and the Storage restore rehearsal are complete; managed upload scanning, remote application-email delivery, the actual database restore, Preview concurrency, and production monitoring remain rollout gates.
