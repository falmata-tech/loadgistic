# Current-feature audit — 2026-09-13

Scope: Loadgistic's current product, not AfricMade or retired demand functionality. Inventory derived from current pages, components, application adapters, SQL contracts, tests and read-only runtime checks. No production business data was changed. A subsequent owner instruction authorized the separate antivirus-optional upload change described in `UPLOAD_POLICY_2026-09-13.md`.

## 2026-09-14 continuation — recorded repairs verified locally

F04/F10 recovery/admin controls, F09 confirmed-email and retained deactivation,
F06 bounded public/private spatial discovery, and F05 incremental polling have
local workflow evidence. Migrations 090–095 are applied locally. Seven rollback
SQL suites, six concurrency cases, the 5,000-truck scale audit and all 34 affected
desktop/phone cases passed across focused runs. Final quality passed 290 tests,
TypeScript, 28 specs and 349 source checks; BUILD_VERIFICATION records the build.
The resolved usage issue no longer blocks browser verification.

F16–F21 discovered during implementation/verification are repaired and tested.
F22 selected feedback overlap and F24 narrow-screen zoom obstruction are now
fixed with passing desktop/phone regressions. F23 reconciles stale spec headings.
F11 retains the foreground-only platform
limit. F13 hosted rollout/upload verification and hosted Auth two-link enforcement
remain separate. No commit, push or deployment was performed. See
AUDIT_COMPLETION_2026-09-14.md and AUDIT_RELEASE_CANDIDATE_2026-09-14.md.

## Earlier repair checkpoints (historical; superseded above)

The following bullets preserve earlier repair checkpoints. Their then-open
items are superseded by the verified continuation above:

- F01: fixed private geographic eligibility, independent of explanation text.
  Both endpoints must fit one eligible signal; an additional area filter must
  also fit. Empty proximity fields cannot rescue a failed match.
- F03: fixed post-submit form reset, guarded concurrent submissions, retained
  failed drafts, and distinguished successful saves from refresh failures.
- F07: unresolved supplied locations return no results plus a Review filters
  correction action instead of silently discarding the location constraint.
- F12: active persisted administrator authority is checked before Supabase Auth
  team creation; HTTP and PostgreSQL checks remain in place.
- F02: added migration `083`, a shipment/event-scoped private proof endpoint,
  and Open proof links on provider, guest, and admin Tracking timelines.
- F05: polling overhead reduced: hidden/unsupported routes pause, closed chats
  stop, minimized launchers without a conversation stop, failures back off,
  and requests do not overlap. Older-message navigation is now implemented for
  member, assigned staff, guest recovery and launcher views using bounded
  conversation-scoped cursors. History pauses refresh, preserves launcher
  drafts and does not acknowledge newer replies. Member/staff reply attachments
  now use private Storage, current conversation authorization and durable failed
  upload cleanup (migration 089, local only). A push-delivery transport remains open.
- F06 (partial): public profiles now page the complete active fleet in 12-truck
  windows with accurate total/page counts and current capacity scoped to each
  page. Stable provider evidence is independent of page position. Migration 088
  is local only; national viewport loading and private spatial scaling remain
  open. Final gate evidence is recorded in BUILD_VERIFICATION.
- F08: Driver-controlled upload, replacement and removal now use explicit public
  consent, metadata-free normalized images, private Storage and revocable public
  image IDs. Company drivers manage their own photos. Featured uses the current
  image and removal returns to the neutral icon; failed deletion has durable
  bounded retries. Migration 087 is local only. Final gate evidence is recorded
  in BUILD_VERIFICATION.
- F09 (partial): Account & plan now edits the signed-in actor's shared display
  name and optional private phone, including limited plan access. Public callback
  numbers remain separate, and owner fleet-contact edits preserve private phone.
  Migration 086 is local only. Email change and closure remain open; F06 spatial
  scaling and F10 lifecycle recovery remain separate work.
- F11 (controls fixed; operational limit remains): Drivers can select the
  allowed privacy radius for their next Tracking location. Saved, throttled,
  paused and failed states are distinct; hiding/leaving the screen invalidates
  pending GPS callbacks and aborts requests where possible. Both Driver and
  recipient screens explain that phone lock/screen closure pauses updates.
  Background GPS remains unsupported. See BUILD_VERIFICATION for final evidence.
- F15 (found during F05 implementation): NULL-safe guest assignment checks now
  deny an unassigned Support actor before transcript/attachment read, reply or
  closure. Migration 084 is local only; migration 085 adds history reads.
  Rollback SQL and real desktop/phone denial checks passed. No hosted
  exploitation or production rollout was tested or claimed.
- F14: corrected known architecture/authorization drift around unified OTP,
  morning Featured, private-truck exclusion, callback phone requirements, and
  polling versus Realtime. Remaining gaps are not relabeled as implemented.

Current evidence and limits are in `BUILD_VERIFICATION.md` and the continuation
above; the following inventory and findings preserve the original audit.

### Original status vocabulary

- **Wired**: a current UI, handler/application port and persistence/authorization path exist. This is not a blanket end-to-end or Production pass.
- **Partial**: a concrete missing action, incomplete workflow or incorrect behavior was found.
- **Local addition**: current workspace changes have local evidence but have not been deployed by this audit.
- **Operational limit**: implementation exists, but a service, policy, capacity limit or runtime verification remains relevant.

Many regression tests inspect source contracts or pure functions. Passing them does not establish that every browser action, email, uploaded file or remote callback works.

## Original feature inventory (2026-09-13)

| Current capability | UI → application/database path | Assessment |
|---|---|---|
| Unified login and signup | `/login`, `/apply` → applications email-OTP/Google routes → `identity/supabase.ts`, provider-signup RPCs | **Wired.** Email and Google share identity-first onboarding; existing accounts enter their authorized workspace. Real remote Google consent and email receipt were not repeated in this audit. |
| Fleet / owner-operator / self-managed setup | `/apply` → `/api/applications` → `provider-signup/supabase.js` | **Wired.** Operating model is distinct from verification; paperwork is not required at signup. |
| Local test login | Fixture section in `/login` → `/api/auth/login` | **Verified locally** for the admin navigation audit. Deliberately unavailable in Production; not a customer password-login feature. |
| Sessions and role navigation | Public header, `app-shell.tsx`, More menu → `auth.ts`, workspace-access policy | **Wired.** Public browsing, provider workspaces, staff areas and logout exist. Private account maintenance is incomplete; see F09. |
| Open capacity map | `/` → `PublicCapacityFeed` → `/api/public/capacity` → `public_capacity_page` | **Wired, with limits.** Empty/Partial, vehicle image pins, approximate location, age labels, routes, areas and selected-truck details exist. Progressive loading is not viewport-based; F06. |
| Map clustering and signal interaction | `public-capacity-map-leaflet.tsx`, `capacity-map-clustering.js` | **Wired.** Capacity types remain distinct and screen/geometry behavior has regression coverage. Not proof of smooth operation with every real-world density or low-end device. |
| Public route and attribute filters | Filter dialog, vehicle image chooser, origin/destination/area → public-capacity RPC | **Wired.** Vehicle configuration, status, geometry, load/stop preferences, age, endpoints, radii and proximity are carried into the query. Unresolved place inputs can lose geographic constraints; F07. Not a road-routing/ETA engine. |
| Place autocomplete | `EthiopiaPlaceInput` → `/api/places` → managed `place_catalog` | **Wired.** Debounce, cancellation and bounded cache exist; local catalog is used rather than a public OSM geocoding request per keystroke. Current production search accuracy not replayed for every town. |
| Public transporter profile | `/@handle` → `getSupabasePublicProvider` | **Wired.** Business details, optional contacts, public trucks, reviews and documents summary. Fleet projection has a fixed 96-capacity cap with no equivalent full-fleet paging here; F06. |
| Individual truck map/contact | `provider-fleet-showcase.tsx`, selected map sheet | **Wired.** Opens truck signal context, Driver identity/document status and call/profile links. No consumer load-order form is intended. |
| Public profile editor | `/app/company-page` → company-page/image routes → provider-profile RPCs/Storage | **Wired; upload service affected.** Public contacts are distinct from private login contacts. Company drivers do not own a business profile. |
| Add trucks | `/app/fleet/new` → `/api/fleet/vehicles` → `create_provider_vehicle` | **Wired.** Fleet owners and independent providers can add; Company drivers cannot register someone else's fleet. |
| Fixed trucks and interchangeable trailers | Truck registration/detail → details/trailer APIs → vehicle RPCs | **Wired; detail editing is a local addition.** Attached trailer determines the public configuration. Provider-side retirement/deactivation is absent; F10. |
| Add Company drivers | Fleet Driver section and invitation page → invitations APIs → migration 081 | **Local addition.** Invite, resend, cancel, verified acceptance, contact edits and offboarding exist. Previous local fresh-workspace evidence is recorded in BUILD_VERIFICATION; not deployed by this audit. |
| Truck/Driver assignment and permissions | Fleet driver controls → permissions API → `update_fleet_driver_access`, migration 082 | **Local addition/hardened.** Owner and active membership checks; Capacity/Tracking grants; assignment links. Latest membership protection requires rollout. |
| Driver duty and current capacity | Driver Home/map dialogs → capacity/duty/location routes → provider-capacity RPCs | **Wired; focused dialogs are local changes.** Distinct current capacity, visibility, preferences, location and regular-service actions; no Edit All. |
| Publication eligibility | UI missing-driver states → database eligibility functions, migration 078 | **Local addition.** Active assigned Driver is required; optional missing documents must not prohibit publication. |
| Truck Network management | `/app/network` → `/api/capacity-network` → grant/revoke RPCs | **Wired.** Multiple approved emails per truck, Loadgistic audience, owner visibility/control and authorized Driver sharing. |
| Private map email access | `/shared-capacity` → OTP/access/session APIs → recipient digest/grants | **Wired.** All trucks shared with one verified email, 30-minute inactivity exit, manual logout. No eligible share keeps the user at the email stage instead of requesting a code. Remote OTP receipt not repeated here. |
| Private map filtering | Same map/filter UI → `listSupabasePrivateCapacityCursor`, `geographicMatchLabel` | **Partial/incorrect.** Both-endpoint and combined geographic constraints are not reliably enforced; F01. This affects the admin shared map too. |
| Loadgistic private capacity | `/admin/capacity-network` → staff-authorized private projection | **Wired.** Only explicitly shared trucks, not all private trucks. Broker work remains manual; there is no structured chat-to-dispatch handoff. |
| Create shipment Tracking | `/app/provider-shipments/new` → provider-shipments API → provider-tracking RPCs | **Wired.** Truck/Driver, cargo, route, expected dates, agreed tracking mode and approved recipients. Not a public shipment-order form. |
| Tracking detail/status lifecycle | Provider detail and Driver controls → status/location APIs → transaction/state rules | **Wired.** Pickup, loading, en route, unloading, completed, issue; correct actors are checked. No general edit/cancel/reassign recovery workflow found after creation; F10. |
| Authorized-party Tracking | `/track`, `/track/[id]` → email+tracking-code OTP, recipient grant, session | **Wired.** Multiple recipients, per-email verification, add/revoke, idle/logout and expiry. Public code alone is not authorization. |
| Approximate Tracking location | Driver travel controls → obscured location API → guest map | **Wired with operational limit.** Updates in pickup/en-route phases while the relevant browser screen is active. Not background GPS after phone lock/app closure; F11. |
| Tracking proof photos | Status form → scanned/validated Storage upload → event proof metadata | **Partial.** Upload exists; authorized retrieval/viewer is missing from the current Tracking UI and API, F02. |
| Completed-shipment reviews | Guest owner review form → review-unlock/review APIs → provider reviews | **Wired.** Separate owner review authorization, one review, visible ratings, provider low-rating dispute and admin resolution. No new lifecycle mutation test this audit. |
| Optional Driver/truck/company documents | `/app/verification` → verification/file APIs → review RPCs and private Storage | **Wired; upload service affected.** Subject-specific categories, expiry, approval and missing-document badges. Company-driver authorization differs from truck ownership. |
| Billing and payment review | Account payment form → billing API → proof/review/subscription RPCs | **Wired, manual.** Payment evidence and admin approval, not a card/payment-gateway integration. |
| Free access / trial / activation toggle | `/admin/settings` → settings API → migration 079 | **Local addition.** Free launch mode and explicit trial/payment activation. Do not assume deployed policy matches local code. |
| Daily Featured programme | `/featured` → featured candidates/day projection | **Wired.** Truck-type day, linked Driver/truck/provider, portraits/fallback, morning slots and interludes. Real Driver portrait maintenance is incomplete; F08. |
| Automatic/manual Featured selection | Admin Featured → featured API and scheduled worker → migration 080 | **Local addition.** Target count, theme eligibility, distinct Drivers, persisted days and manual-day preservation. Worker deployment/execution not proven here. |
| Sponsors/advertisers | Admin Featured sponsor form → admin featured commands → sponsors/placements | **Wired.** Existing providers or external advertiser information, contact/link, schedule interludes and mobile rotation. Not an ad-payment system. |
| Anonymous team chat | Floating widget/help recovery → guest-support APIs → support RPCs/Storage | **Partial.** Persistent sessions, callbacks, attachments, team reply and end/new exist, but successful submit can raise a false UI error, F03. Uses polling, not Realtime push, F05. |
| Signed-in support | `/app/support`, staff inbox/detail → support APIs/RPCs | **Wired with limits.** Claim/close, availability, workload, text replies and conversation lists. No member-chat attachments or older-message navigation, F05. |
| Admin record inventory/details | Overview/Records → eight detail types → platform-admin RPCs | **Read navigation verified desktop and phone.** Users, workspaces, trucks, Drivers, Tracking, capacity, routes, plans each opened an existing detail record. Management actions are intentionally narrower than a complete editable admin, F04. |
| Admin reviews | Review Center → verification, rating and payment commands | **Wired.** Queues, review actions and private document access. Upload service and proof-viewer limitations remain distinct. |
| Platform team and delegated permissions | `/admin/support` → support-agents API → Auth administration then RPC | **Partial security boundary.** Admin authorization occurs after creating the Auth identity, F12. No unauthorized request was exercised. |
| Responsive shell and loading | Public/app shells, route/component skeletons, pending form controls | **Implemented, not universally verified.** Seven public phone entry pages returned 200 without horizontal document overflow. Authenticated maps, modal keyboard behavior and every dense state were not all visually re-approved. |
| PWA/install | Manifest/service worker/brand assets and PWA regression tests | **Implemented shell.** Not offline access to private business data, offline tracking or guaranteed background location. |
| Supabase Auth/Postgres/Storage | Managed adapters, RLS, service-only RPCs and private buckets | **Real infrastructure.** No active SQLite backend. Remote health connected to Postgres/Storage; it does not prove every upload, callback, permission or schema migration. |
| Email/outbox/scheduled operations | Email providers, queue claims, signed scheduled/background workers | **Wired.** SMTP/managed delivery and local Mailpit, bounded retries and cleanup. Real inbox delivery and current remote schedule execution were not replayed; fleet invitations use explicit resend rather than this background retry queue. |
| Deployment/security/performance | GitHub CI, Netlify config/functions, Docker artifact, health, rate limits, origin checks | **Implemented with readiness gaps.** Tests/build/CI configuration exist; this audit is not a deploy or full scalability certification. See F06/F13. |
| Demo data and vehicle artwork | Managed fixture/import policy, vehicle configurations, portraits | **Present.** Existing seed is a demo, not verified real supply. No reseeding or production identity import was performed here. |

## Original findings and repair priorities (2026-09-13)

### F01 — High: private geographic filters can return false matches

`src/lib/repository/supabase.js:136` (`geographicMatchLabel`) first checks both endpoints, then falls through to a one-endpoint match if the pair fails. Its last condition also treats empty latitude/longitude strings as finite numbers (`Number('') === 0`) and returns a proximity label. `listSupabasePrivateCapacityCursor` uses any returned label to accept a geographic match. It also does not independently require the area condition when another signal has already returned a label.

Executed the current pure helper with synthetic coordinates, without database writes:

- Near origin + distant destination returned “Current capacity route passes within 0 km of Fixture origin.”
- Both endpoints distant + empty proximity inputs returned “Approximate truck location is within your selected proximity.”

Repair: separate boolean eligibility from display labels; require every selected criterion, use one-endpoint behavior only when only one endpoint is supplied, validate actual proximity inputs, and test the public/private contract against the same cases. This is not evidence that the public SQL query has the same defect.

### F02 — High: Tracking photo upload has no usable retrieval workflow

`src/app/api/provider-shipments/[id]/status/route.ts` stores the photo and passes private metadata into the status RPC. Provider/admin timelines show only `has_proof`; the public guest timeline offers no proof link. The old `/api/files/proof/[id]` is a deliberately retired demand handler, not a current Tracking download handler. No current authorized provider-Tracking proof read port/route was found.

Repair: a current shipment-authorized proof-read contract and viewer/download for explicitly permitted parties. Do not revive the retired demand endpoint or expose storage references.

### F03 — High: chat reports an error after successful submission

`src/components/public-assisted-chat.tsx:44` uses `event.currentTarget.reset()` after awaiting the request. React no longer supplies that current target then. Browser reproduction intercepted the network, returned a successful start, displayed the new conversation, and also displayed `Cannot read properties of null (reading 'reset')`. No real message was sent. Reply uses the same pattern. Pending submits are not disabled in this widget.

Repair: capture the form before awaiting, preserve the successful result, clear the composer safely, and prevent duplicate submissions. Test start, reply, attachment, failure and retry through the visible widget.

### F04 — Medium: admin details are real, but management is limited

`src/app/admin/operations/[view]/[id]/page.tsx` supports suspend/restore users and Drivers, Driver permission flags, truck activation, capacity Off Duty, regular-service removal and plan actions. Workspace and Tracking detail pages explicitly render a read-only message. There is no general edit, Tracking recovery, authenticated Tracking map or proof viewer there. Do not describe this as “all data is manageable.” Not every admin should be allowed arbitrary edits; the missing recovery actions need explicit role/audit rules.

### F05 — Medium: chat is polling, with incomplete history/attachment parity

No current `channel(...)`/`postgres_changes` subscription was found in application source. The anonymous widget polls every two seconds open / ten seconds minimized, including hidden tabs. Member/staff support refreshes the route every five seconds while visible. The member thread shows the latest 50 messages with a notice, but no older-message control; guest projection is bounded too. Member support is text-only even though anonymous support supports files.

“Live” currently means frequently polled, not Supabase Realtime. At 1,000 minimized open tabs, the widget alone nominally produces about 100 requests/second before user actions. This is request arithmetic, not a measured load benchmark. Repair visibility/backoff/no-session polling first, then choose push or efficient incremental polling and paged history deliberately.

### F06 — Medium: bounded queries are not yet viewport-scaled discovery

`ProgressiveCapacityLoader` fetches another cursor page on initial mount and debounced map movement. Public batches contain about 14 records ordered by the query cursor, not the viewed map bounds. The client accumulates fetched records for that page lifetime. This avoids a manual Load More button, but does not guarantee that moving to a particular town fetches that town's trucks first. Private filters scan up to 1,000 candidates/request in application code; provider profile retrieval stops at 96 capacities.

Repair: spatial viewport queries/cluster summaries with stable identities, bounded client retention and explicit complete fleet paging. Prior 5,000-row query timings in BUILD_VERIFICATION are useful historical evidence, not a current concurrent-user or low-end-device certification.

### F07 — Medium: unresolved location text can silently remove a filter

`resolveSupabasePlace` returns null when neither a reference nor exact normalized place name resolves. Public/private query builders then treat it as no coordinate filter. Autocomplete accepts editable text. A typo or stale selection should produce an actionable validation state rather than silently broadening geographic results.

### F08 — Medium: real Driver portraits have no management workflow

`featured-truck-candidates.js` reads `profiles.driver_portrait_preset`; Driver photo choices are seeded artwork or fallback icons. The current fleet Driver editor changes contact/access, not portrait. Business profile image upload does not provide a Company-driver portrait editor. Demo Featured portraits are implemented; self-service real Driver portraits are not.

### F09 — Medium: Account is primarily a display, not account maintenance

`src/app/app/more/page.tsx` shows private name/email/phone and plan/payment history. No current private-account edit/email-change/closure UI was found. Public profile contact editing is a different feature. Owner edits of Company-driver contact data do not fill this independent-provider account gap.

### F10 — Medium: lifecycle recovery gaps

Providers can add/edit a truck and set capacity Off Duty, but cannot retire/deactivate their own truck through a current provider action; the admin can deactivate it. Tracking creation has no general correction/cancellation/reassignment action. These are absent lifecycle capabilities, not broken existing buttons. Define how completed records, assignment history, recipients and guest grants behave before adding them.

### F11 — Product/operations limit: location is foreground browser tracking

`provider-tracking-controls.tsx` refreshes about every ten minutes only while its component is mounted, the document is visible, the assigned Driver is eligible, and the shipment is in a travel phase. No phone-background tracking exists. Tracking mode's privacy radius defaults from the latest shipment location or 20 km; this component has no radius chooser. Do not promise live location when a Driver locks the phone or leaves the applicable screen.

### F12 — High: team creation authorizes too late

`/api/admin/support-agents` checks for a signed-in user, then `createSupportAgent` calls service-role `auth.admin.createUser` before the PostgreSQL command checks the actor is an administrator. The later denial attempts deletion, but external identity creation has already happened and cleanup errors are ignored. The intended admin check should happen before that external write, with the database check retained. This was identified statically; no unauthorized identity was created to demonstrate it.

### F13 — Operational: Production uploads were blocked at audit time

The deployed `/api/health` returned `ok: true`, Supabase Postgres/Storage and `readyForPublicProduction: false`, with `upload-malware-scanner` as its blocker. SMTP at-least-once delivery and community OSM tiles were warnings. Health configuration checks are not a successful browser upload or real-email test.

The owner subsequently authorized antivirus-optional uploads. The explicit `validation-only` implementation is a separate change; it retains private access and file validation and reports that uploads are not virus-scanned. Do not call the remote blocker fixed until the artifact/configuration is deployed and browser upload/retrieval is verified.

### F14 — Documentation and evidence drift

Older Architecture/authorization text retains superseded two-session Featured, login `shouldCreateUser:false`, public regular routes for private trucks, and optional guest callback phone wording. Some pagination prose says manual load-more. Current source differs. “Done” in a spec or old build checkpoint is not sufficient proof for this changed application.

### F15 — High: NULL assignment did not deny guest Support commands

Found on 2026-09-14 while implementing F05. Four managed guest commands used
`assigned_agent_user_id <> actor.id` inside a denial condition. With an
unassigned conversation, SQL NULL did not evaluate to true, allowing a
Support actor with Support permission past that condition. Migration 084 uses
`IS DISTINCT FROM` for read, reply, closure and attachment commands, preserving
guest/admin authority and denying an agent before claim. Rollback tests cover
every command and no denied side effects; browser tests prove removal of an
assignment blocks the transcript and an existing private attachment URL.
This repair is verified locally and requires separate production rollout.

## Verification completed during this audit

- `npm run quality`: 28 specs, 313 source files, **233 tests passed**, TypeScript passed. Mostly contract/pure tests, not every live mutation.
- Actual admin navigation: opened an existing record in **all eight inventories on desktop and phone**; both focused browser workflows passed (16 detail visits).
- Mobile 390px: About, Privacy, Terms, private-capacity entry, Tracking entry, Login and Featured returned 200, no detected document-width overflow or generic error page. This does not certify all contained maps/modals.
- Chat issue reproduced through a browser with mocked success responses; no real chat, email or upload was created.
- Private-filter issue reproduced using the current helper with synthetic inputs; no data mutation.
- Read-only local and deployed health inspected. Local warnings about test secrets/local fixture login are intentional local configuration, not proof of production misconfiguration.
- First Chromium attempt was sandbox-blocked. The permitted browser attempt then timed out while a development page was still rendering its loading state; focused record checks with compilation time allowance passed. The initial More-menu check was not itself re-certified.
- No full production build, deploy, full role mutation suite, Google consent, real inbox receipt, remote file upload, current migration inventory, real-device CPU test or concurrent-user load test was performed as part of the read-only audit.

## Not current features

Do not count retired public load posting, auctions, bidding, demand boards, old shipper/receiver workspaces, pooled shipments, the old demand-side Network, manual market list view, capacity percentages or old regional/two-session Featured as unfinished current features. Compatibility redirects and intentionally retired API responses are not automatically dead links. Current truck Network and provider-owned Tracking are separate active features.

## Original recommended repair order

1. Finish the explicitly approved upload-policy rollout and verify a real protected upload/download.
2. Fix private-filter false positives, chat success/reset behavior and pre-authorization of team identity creation.
3. Complete the authorized Tracking-proof viewer.
4. Add deliberately scoped lifecycle/account/portrait actions rather than claiming general admin CRUD.
5. Reduce chat polling, introduce viewport-aware supply loading and complete message/fleet paging.
6. Reconcile current specs/docs, then run the affected full workflows and release gates before the next production claim.
