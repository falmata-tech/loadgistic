# Current work and release status

Updated 2026-11-21. Start with the [product brief](PRODUCT_MASTER_PROMPT.md),
[feature/test index](../specs/TRACEABILITY.md) and [local setup](LOCAL_SETUP.md).
The [preserved November 11 checklist](PROGRESS_HISTORY_20261112.md) retains the
original source-bound results, failures, artifact hashes and private receipt
references byte for byte. Its local-only and pending statements are historical;
the source, hosted schema, web publication and installed Android are separate.

## November 21 production recheck

Netlify confirms deployment `6afbc2ee6c2aa088ac972def` is Published at
`906a51f1`. The live Track form still asks for email. A direct request to
`/install` returns page HTML without the install guide, and the new Tracking
sessions API is absent. Live health returns 200 and reports warning codes for
upload scanning, email delivery semantics and the community tile service.

The retained Netlify logs from the November 17 daily window show both schedulers
invoked. Motion recorded `DISPATCH_FAILED` repeatedly, with no corresponding
motion background logs in the queried range. Capacity recorded
`ADVANCE_FAILED`. The published handlers log only those general errors, so they
do not identify the failing phase. The release candidate already contains
scheduled-entry handling that selects the verified configured origin instead
of the provider's synthetic Request URL, plus bounded phase and HTTP status
diagnostics. Local tests pass for both fixed dispatchers and the existing
site, method, signature, and schedule denials. See
[FEAT-SIM-001](../specs/features/FEAT-SIM-001.md). A natural hosted pass still
requires successful dispatch, accepted saved Capacity and GPS/Phone updates,
and inactivity outside the agreed window.

Draft [PR 42](https://github.com/falmata-tech/loadgistic/pull/42) opened
against the current main and production source. Initial CI passed validation,
the Android internal build and the standalone container. Independent operations
proof passed. The initial browser gate exposed a Chromium interaction between
test request interception and the service worker. The redirected GET's 200
appeared as the original POST's response in Playwright. In a disposable browser
without the interception the worker preserved the real 303. Normal browser
tests now retain transport status checks with the worker disabled, and the
install and offline suite opts in to real worker execution.

The local Featured Prepare request also hit the database statement deadline.
Migration 240 scopes each final eligibility recheck to the selected vehicle
while retaining its lock, current driver, publication and account checks.
A rollback benchmark prepared the same seven missing days on 145 local
vehicles in 5.3 seconds, down from 10.6 seconds. Saved roster history remains
under the existing checks. Driver portrait and owner-qualification tests use
the real profile map and its vehicle drawer.

The revised source passed database and simulator validation, the optimized
web build, the Android internal-build check, the standalone container, the
independent browser proof and all three Featured checks. The broader matrix
identified remaining assertions for the retired provider review list, direct
driver call and old Capacity colors. The browser tests now open the provider
About panel or vehicle drawer where appropriate and verify the current
map key. Local Support review passed signed-in customer and staff exchanges,
FIFO claim and revocation on both widths, and the admin Team layouts. The
local delivery check passed provider progress, registered owner approval,
completion email, and the one-review limit.

The sponsor save returns to its own management page. The browser test verifies
the saved sponsor there and follows the Featured link back to the programme.
Final rehearsal also exposed a separate Featured overview database timeout
after successful programme writes. Migration 241 reuses one eligible-account
query across the seven-day response. On the same local data, the RPC took
3.1 seconds, down from 14.6 seconds, and both versions returned identical JSON.
The overview still enforces Featured permission and reports saved rounds,
roster counts and eligibility changes. The same migration scopes the save's
vehicle rechecks and avoids duplicate driver lookup in the shared eligibility
query. A rollback-only save retained eight slots and ran in 6.3 seconds, down
from 15.6 seconds. The later driver-query change reduced one comparable read
from 5.7 to 2.4 seconds with the same 145 vehicle and driver pairs.
The shared query now checks publication once per account in the same statement.
The final service-role reads returned 145 vehicle and driver pairs in 3.4 seconds
and 32 eligible accounts in 2.3 seconds. Both requests had previously reached
the eight-second database deadline.

A Chrome installation launched the app in standalone mode and opened Track
and About at 390 CSS pixels. Android Chrome at 412 CSS pixels had an active
worker and no installability errors and accepted the app's install action.
Its separate launcher launch could not be reproduced on the loopback emulator.
The latest hosted audit passed the Data API guard and reported zero errors and
one signed-in security-definer warning. Release review and all current
same-source verification still apply.

## November 21 installable web app and broker pilot

Install app is near the bottom of the desktop navigation rail and in More on
signed-in phones. Signed-out phones can find it on About. Supported browsers
offer their install prompt. The install page gives browser-menu and Safari
instructions. The service worker uses a generic offline retry page and allows
updates after open tabs close.

Reviewed the local web app at [About](http://127.0.0.1:3101/about) and
[Install Loadgistic](http://127.0.0.1:3101/install). Chrome reported no
installability errors in a disposable desktop profile. Desktop and phone
Chromium exercised the install entry, prompt handoff, offline cache isolation
and recovery to sign-in. The 390-pixel install guide was reviewed with an
iPhone user agent, in English, Amharic and Afaan Oromo. Screenshots and test
logs are in `.local/pwa-tracking-pilot/`.
Browser alerts still use updates while the app is open. Installation on a
physical phone was outside this review.

Migration 239 enables two-city broker shipments and an optional stop. Broker
job references are searchable inside the authorized workspace. Guests and
providers see the Loadgistic reference. Providers can decline and brokers can
withdraw a pending request. Both decisions clear the old target and reject its
stale revision. The local rollback SQL suite passed including expiry, direct
provider readback, unrelated actor denials and guest proof/reference privacy.
The local catalog privilege checks passed. In phone Chromium, a broker signed
in, created a direct shipment and found it by job reference. The guest opened
the link with its code. The provider declined, the broker reissued and withdrew
a request, and the provider accepted the next request. A saved Going to pickup
update appeared to the broker and guest. At the [Expo preview](http://localhost:8084/business-tracking),
the broker signed in through the local inbox, searched the same shipment
reference, opened it and saw the saved Going to pickup status. The synthetic
records were removed after the browser run.

The Market keeps the map and filters in place with a retry if its first read
fails. A local fixture run returned valid responses for four serial requests
(median 764 ms, max 1,122 ms) and 12 requests in waves of four (median
2,801 ms, max 3,144 ms). Production concurrency still needs measurement.

The web quality gate passed 1,685 tests. Expo passed 460 tests, TypeScript
and lint. The optimized local web build completed.

The published Tracking flow still needs the exact reviewed web and database
release. The production checklist retains external inbox, installed Android,
closed-app notification and scanned private proof checks. The owner deferred
physical tracker and map tile work.

## November 21 pilot review

[Production workflow review](PRODUCTION_WORKFLOW_REVIEW.md#november-21-broker-to-transporter-pilot-review)
records the direct-shipment rule, request and reference gaps, published Tracking
differences, and location, delivery and map verification needed for a pilot.
The shorter homepage paragraph adds where transporters plan to go. Chrome
confirmed the exact paragraph in all three supported languages at 1280px and
390px. Screenshots are in `.local/sponsor-review/planned-journeys-copy`.

## November 20 public launch copy

The homepage leads with the owner's wording, “Work better with transporters to
serve your customers.” Transporters manage their vehicles and drivers. Brokers
and shipping teams use the capacity and planned journeys transporters share to
plan shipments. About, signup, transporter setup, search metadata, and draft Play and
social copy carry the same message. Private Network and Open Market describe
the existing permissioned and public views. Tracking follows agreed work.

Chrome verified the shared headline and supporting line at desktop and 390px
phone widths in English, Amharic and Afaan Oromo. The local Open Market served
the new copy. The signed-out Private Network, all three About roles and both
signup choices were exercised without sending email. The Expo web preview
verified the homepage and business signup at 320px. Screenshots are in
`.local/sponsor-review/owner-narrative`.

Courier car is the only supported courier configuration. Migration 238 removes
motorcycle from server validation and new Featured selection. The local review
database converted six exact synthetic vehicles to Courier cars and verified
their assignments, location and capacity data stayed intact. Local discovery
returned eight public Courier cars and rejected the retired filter with HTTP
400. The rollback-only SQL check covered owner Add/Edit, retired-type denial,
existing permission boundaries and saved Featured rosters.

The preceding homepage copy and About introduction passed desktop and 390px phone
Chrome at `http://127.0.0.1:3101/?view=private` and `/about` in all three languages.
The Expo web preview at `http://localhost:8084/` showed the final English
headline at 320px. Screenshots are under `.local/sponsor-review/network-copy-final`.
The wider browser run hit a local Capacity query timeout under load and had no
Featured account scheduled for the date it ran. The final standalone Open
Market and Courier car HTTP rechecks returned 200. The phone browser applied
the Courier car filter, confirmed the returned type, and reached the sign-in
screen. The web and Expo type checks, focused catalogue and copy checks, and
isolated loopback unit rechecks passed.

The earlier copy review covered Market, About, public provider profiles, Featured,
account entry, provider signup, Track, Support, and policy pages. The draft Play
listing now describes business sharing and per-load tracking links. English,
Amharic, and Afaan Oromo use the shared web and Expo catalogs for the new copy.
Desktop and phone browsers exercised the Market views and all three About
audiences in those languages. Expo web also passed at 320px. Narrow About
choices stack to fit longer labels, and the phone language menu shows the
full Afaan Oromo name. Screenshots are under `.local/sponsor-review/launch-copy-final-layout`.
Phone web checked signup, Track, public provider, Help, Featured, and policy
pages. The Expo preview also checked signup and Track. The focused web and
mobile checks and both type checks passed.

## November 19 local provider map recheck

### Market palette and demo coverage

Web and Expo use the same round vehicle marker with cobalt for Empty and
navy for Partial. On selection, a solid cobalt line identifies a planned route
or area for either status. Preferred coverage uses a dotted slate line.
Approximate location uses a thin blue circle with a light fill. The circle
disappears below an 18px diameter and the location action still opens the
published radius. Only the visible outline accepts map clicks. Vehicle and
driver and Approximate location use distinct truck and locator icons.
Chrome desktop and phone checked the live radius near the vehicle and its
removal at wider zoom, then opened the same published location details from
the side action. The Expo preview checked Vehicle and driver on a real local
profile at 390px and 320px. Focused map, contrast, layout and type checks passed.
Current screenshots begin with `location-radius-`.

The running local Market exposes 88 signals across all 17 vehicle
configurations, with 37 routes whose endpoints are at least 100 km apart,
31 shorter routes, 13 broader service areas and seven local areas. Both
availability statuses have all four coverage types. Eight live API searches
combined vehicle, status, load and coverage and returned the expected trucks.
Desktop and phone also passed the filter Apply, Clear and union/intersection
browser tests, and opened vehicle details from a live courier route and a
live broad service area. Eight recent synthetic listings cover both statuses and all
four coverage types. Four Partial examples report 35%, 55%, 80% and 85%
against their actual fixture assignments. Recency follows the normal 12-hour
window. Narrow searches can have legitimate empty results. The local dataset
does not have public matches for the permission-to-use and vehicle operating
licence filters.

The local database applied 108 planning changes, 22 preferred-plan changes,
five profile descriptions and eight recent synthetic listings. Their saved
observations, location privacy and sharing choices were preserved.
The exact simulator corridors and all 20 authored phases still match.
Screenshots begin with `capacity-brand-` under `.local/sponsor-review`.
The web suite passed 1,682 tests and the mobile suite passed 458.
Both type checks and the changed Expo map's lint check passed. The full Expo
lint still flags the Featured sponsor rotation effect and an unused import in
the coverage preview.

### Provider map follow-up

Chrome at 1440px and 390px opened and closed vehicle details from the live
local provider map. The Expo browser test exercised the same scoped map at
390px and 320px. The local profile API returned two vehicles in both counts,
with zero detail rows in map mode and two in the default response. Controlled
signals verified marker, legend and selection colors separately from the live
data. The full web gate passed 1,681 tests with local loopback sockets available.
All 458 mobile tests and both type checks passed. Mobile test fixtures use the
shared palette and exercise the profile map, public contacts, documents, cover
and reviews. The profile map is the entry point to vehicle and driver details.
The Expo profile sends the expanded state of its documents and About buttons
to assistive technology. The Market browser check verified that an incompatible
vehicle filter clears the previously selected vehicle details.
The Featured card also opened the live profile and its map at 390px and 320px.
The test supplied a browser-only programme because the local day had no
published provider slots. Screenshots are in `artifacts/provider-profile-v4`
and `.local/sponsor-review/double-check-featured-accessibility`.

## November 18 local Featured and provider profiles

Featured has two industrial demo sponsors with original workshop artwork,
public contact actions and eight-second rotation. Admins and staff with the
Featured grant can manage placements. Database permission and rollback checks
passed locally for migration 236. Desktop, phone web and Expo web were exercised
with active placements on an empty programme day.

The public provider profile now opens directly on its scoped fleet map. Public
document summaries, notes and reviews remain available. Visitors open vehicle
and driver details from the map. Fleet and independent demo owners each saved a cover, and a
transactional check verified removal, invalid-input rollback and staff denial.
The sample is [Ethiopian talented sinotruck driver pt 2, by Yodi Yodi](https://www.youtube.com/watch?v=WZMVTHGhlbg).
The image above Play is the video's original YouTube thumbnail. Chrome playback
advanced in the embedded player on the independent driver's page. A fleet owner
saved a share URL through Edit profile and reopened it. Public desktop (1440px),
phone web (390px), and Expo phone preview checks exercised the map and details.
The Admin sponsor edit/cancel/save/reload and the granted staff schedule/disable
and revoked staff denial passed locally. Sponsor saves return the committed ID
and redirect to the lightweight sponsor catalogue. Migration 237
and demo data have only been applied in the local review environment.

## November 18 map-only profiles and Capacity colors

Web and Expo profiles now open vehicle and driver detail from the map. The
account can still be contacted about vehicles with no published marker. The
web profile and mobile map view skip the retired roster's detail reads. Default
fleet API pagination stays available for existing clients.

Empty uses green and a round marker. Partial uses amber and a rounded square.
Slate marks approximate location with a dashed circle. Cyan marks preferred
coverage with a dotted line. Planned coverage uses the availability color.
Selection adds a blue outline and preserves availability. GPS and phone retain
distinct icons and labels on neutral badges. Tracking uses the same slate
location treatment.

Chrome desktop (1440px), phone web (390px) and Expo web (390px) exercised
marker selection, the map key and vehicle and driver details using scoped
synthetic Capacity responses. Location, planned route and preferred coverage
strokes were checked in the selected web map. Live browser runs hit local
Capacity timeouts. After a preview restart, the real profile API returned the
same fleet count in both modes, with detail rows only in the default mode.
Screenshots and logs are under
`.local/sponsor-review/capacity-colors-*` in the review worktree.

## November 18 security corrections

Migration 235 preserves the signed-in account RPC used by the web and Android apps.
The local review database passed the application catalog, Data API guard,
active/inactive/anonymous account, provider display-name and driver verification
checks. The November 18 hosted monitor reported both the exposed definer and
disabled leaked-password protection before these corrections. Hosted verification
and publication are pending.

## Active owner checklist — November17

See the [production workflow review](PRODUCTION_WORKFLOW_REVIEW.md) for all 78 web page entries, 36 Expo screens, role boundaries and outstanding launch checks. Migration 230 implements one registered partner,
chosen at provider start or added later. Its rollback-only SQL check and local
installation passed. Both initiation orders passed phone-web workflows, including
late attachment through completion/review and the broker-first provider's normal
operational controls. The connected provider saved Going to pickup and both broker and guest timelines reflected it. Customer followers use the expiring link and separate code.
The driver-to-guest phone-web check also passed for two saved privacy radii, cooldown and retry. Web quality passed all 1,681 tests and mobile passed all 462 tests. Migration 231 adds broker search and a targeted provider inbox. Local SQL verified driver permission defaults, manager revocation and reassignment. Phone web verified selection through the saved provider update and broker and guest readback.

Migration 232 adds personal registered customer Support, fixes replies for business members and retires anonymous recovery of historical chats. Local workload, waiting, reassignment, role and attachment SQL tests passed. Migration 233 removes the open-chat ceiling. In the local six-chat test two agents shared five requests by workload. The sixth waited while both agents were paused, then assigned when one returned. One returning agent also took all 101 waiting chats in a rollback-only test. Team shows actual open chats and availability. The queued tracking and account-closure race verifier passed all six checks with a registered shipment owner.

The browser run at `9579d676` found a Tracking entry page whose map no longer filled the space above the footer, old tests expecting immediate Private map sign-in or guest email access, and a guest link that survived the issuing owner's loss of access. The local correction restores the locked map layout and returns HTTP 404 for retired Support conversation links. Migration 234 passed the local Tracking SQL regression, including denied access after owner revocation. Desktop and phone browser verification, installed Android testing and production publication remain open.

A desktop Tracking screenshot confirmed the map and footer geometry at 1440px but showed blocked community tiles behind the form. The tracking page’s referrer policy prevented the browser from identifying the app to the tile service. The local tile layer now sends only the origin. The page continues suppressing the private tracking URL. The focused desktop browser test intercepted the tile requests for a synthetic private link, verified the site origin as their only referrer, and confirmed the page retained no-referrer metadata. The six tile configuration tests passed. Separate Chrome views at 1280×800 and 390×844 returned HTTP 200 tile images and displayed the geographic basemap, entry form and footer.

The rerun at `aa6121c` passed validation, Mobile internal-build boundaries, Operations proof, the container build, the three Featured checks and four browser groups. The other four browser groups reported two distinct failures. The Play reviewer case needed to open shipment progress to see its cargo. The Tracking submit button extended outside its card at 320×568 and 844×390. After the responsive fix, measurements at both sizes put the full action inside the card, the map above the footer and the attribution inside the map.

The internal standalone Android 1.2.0/code 10 APK now includes ARM64 and x86_64. Both native libraries, signature, alignment and permissions passed. The 95,295,409-byte artifact has SHA256 `0e0fa204c5b2446f997f3c7063802f1902543fbccb9f69c9980fe101be8fdd5f`. The build used the disposable internal key. Installed journeys and Play signing have their own checks.

Worktree: `.local/gps-phone-courier`, branch `feat/gps-phone-courier`, from the
independently checked current remote main `906a51f1`. Preserve the existing dirty
checkouts and completed simulator hosting setup. Runtime acceptance remains
failed and visible below. This checklist includes the
owner's location, vehicle, loading, complete-feature, mobile-parity and Play
readiness requests. Check an item only after its relevant evidence passes.

1. [x] Establish current source, installed contracts and existing assets.
   Migration221 already refuses new Manual writes. Courier car is already a
   supported shared web/native/filter configuration; its real image exists.
   The bounded hosted demo audit found12 correctly configured Live cars and an
   actual Courier car public query returned200 with a matching result. Avoid a
   fictitious restoration or gratuitous data rewrite.
2. [ ] Finish GPS/Phone-only product behavior across web, Expo, API, filters and
   current database projections. Suppress retired Manual current points, retain
   historical rows/revisions, and preserve existing driver-choice permissions.
3. [ ] Verify Courier car selection/image/discovery on both clients and type
   coverage in actual demo results. All17 types exist in fresh local fixtures;
   a separately bounded hosted subset lacks motorcycle. Prepare only any
   justified exact synthetic-data change; preserve simulator bindings/plans.
4. [ ] Audit and repair loading states across web and mobile. Keep the map/page
   footprint and footer position stable, with accessible placeholders and real
   loading, empty, failure/retry and permission-denied states. Preserve the
   existing automatic loading and complete discovery behavior.
5. [ ] Replace email-based guest Tracking with per-shipment/session expiring
   unique URLs and generated tracking codes. Account shippers retain their
   authorized shipment list; brokers share links manually. Retire anonymous
   email lookup rather than leaving it as an alternate access path. Link/code
   access requires BOTH link and code (owner confirmed). Brokers may create
   Pending provider sessions or share existing authorized shipments. Migration229
   and web/native paths are implemented and in local workflow qualification. Preserve provider/source
   consent, current role scope, grant expiry/revocation and proof-file privacy.
6. [ ] Build and execute the feature/role and web-to-mobile parity checklist:
   Owner addition: a signed-out visitor choosing the private map stays on that
   selected tab with a centered Sign in/Sign up invitation in the map area;
   authentication opens only after an explicit button click. Keep private data
   unfetched. The web entry passed maintained desktop/phone browser checks and
   agent-led desktop/phone review at3101: the invitation stays centered over a
   record-free map, the footer stays below it, and only the selected account
   button opens authentication. Actual desktop Sign up and phone Sign in
   destinations were verified. Expo390x844 actual review found plain links;
   these were corrected to50px primary/secondary actions, rebuilt and reviewed.
   Actual Sign up and Sign in destinations pass there too. Native OS/device
   qualification remains separate from the Expo browser preview.
   The maintained Expo390/320 case passes in13.9s, including the unchanged map
   height, selected tab, empty marker set, zero private-data requests,44px minimum
   actions and browser-history return. This private-entry task is complete locally.
   public discovery/profiles/Featured; identity/account security; provider/driver
   Fleet, GPS/Phone, Capacity, routes/areas, sharing and network; customer
   business access; Tracking/recipients/events/private proof; documents,
   notifications and Support. Admin/platform staff management remains web-only.
   Fix demonstrated failures together, rather than asserting that rendering or
   a unit-test total proves all workflows.
7. [ ] Complete focused permission/state/SQL tests, actual desktop/phone/Expo
   task reviews, full root quality and maintained E2E gates, and mobile types,
   lint, tests, strict translations and Android export. Verify the simulator's
   first natural06–08UTC run and subsequent idle/stop behavior from actual
   hosted records; the first window has now elapsed and actual aggregates show ZERO accepted GPS/Phone/Capacity activity despite enabled controls. This runtime failure is being diagnosed from provider scheduling/logs, not treated as success. Do not replay its completed
   migrations/setup/settings/controllers or manufacture clock/ingestion proof.
8. [ ] Prepare the exact Android/Play release candidate and readiness evidence:
   current source/version/package/signing provenance, native permissions and
   device workflows, store declarations/assets and release requirements.
   Record actual device/external-provider checks separately from Expo web.
   Publishing, hosted writes and signing retain their exact owner authority.

Current evidence:228+229 initially passed29 SQL files and are installed locally;
the connected Tracking response then exposed a missing saved `updated_at` field.
The exact projection correction passed an observed RED→GREEN wire check, session
core, source privacy and proof-access checks, with unchanged permissions, other
functions, retained rows and migration ledger. The repaired broker-to-provider
desktop browser journey passed in26.9s: pending creation, separate link/code,
provider consent/assignment, guest refresh/reload, no guest proof/owner actions,
and exact owned-fixture cleanup. Original failed logs remain visible. A separate
slow preview returned200 in9.187s; its test now awaits the exact response before
checking the saved screen, rather than racing a5s visibility assertion.
Current root access/port checks pass19 cases; actual label repair passes6 cases.
The preceding full local quality passed1,656 tests with zero failures/skips (tests87.956s),
TypeScript,45 specifications,798 source files and the pinned workflow check.
ShellCheck is still absent locally; no new local shell-analysis claim is made.
Log SHA256 `fc310ab69cc40b7a31c9543afc70b88df905620338a01180d9c1878272dd6870`.
The original1,655-test run's21 obsolete fixture/assertion failures remain retained
at log SHA256 `33f0d2e4dbb8229af00b7752f102df3c6e4e570fff4dc27139c5fe244aeeb5a0`;
all were diagnosed and passed focused repairs before this replay. Browser skip
counts/conditions remain unchanged; only four reviewed titles were updated.
The broker-to-provider phone workflow also passes32.0s with persisted state and
exact cleanup. Native OS behavior, complete feature-matrix tasks and release
qualification remain open; these local checks do not imply publication.
The subsequent boundary review found two retained ownership gaps. Migration229
now uses the captured account ID for business owner elevation and historical
session binding. Only valid historical controls with an actual captured owner ID
can enter the account list; unknown history remains unbound. Actual RED→GREEN
SQL, seven focused route/source checks and independent review pass. Shared local
overlays admitted zero historical rows and preserved all permissions and the
ledger. The initial migration lock now has a measured5.006s lock timeout.
Completion now directs registered owners through the fixed Tracking account
entry and schedules the existing bounded delivery after committed approval.
Its53 focused checks pass. Desktop completion/proof-backed approval/inbox/review,
route/terminal privacy, link revocation and proof-modal revocation pass; the
latest phone/Expo cases and updated full quality/build are being completed.
The original revocation assertion failed because a bare status text shared its
element with a recovery button; both were present. Its corrected semantic status
and reachable recovery checks pass. A later connection reset coincided with the
local Next process being replaced; no product or resource cause is inferred.
Proof loading returned200 in5.297s and now awaits the exact response before its
image assertion. All original failed logs remain retained.

Android production JavaScript export passed in97.993s with stable inputs:
Hermes98,31 assets and source maps. This is not an APK/AAB or native-device proof.
The fresh dependency qualification remains FAILED:39 audit findings, including
one new high-severity `picomatch` advisory, GHSA-fc5q-39xc-vjpf. No patched version
is published; no package, lockfile, policy or exception was changed. Zero modules
from that tooling package appear in the actual Android map. That is a scoped
observation, not a waiver or Play/release approval. Private export evidence:
`.local/android-export-20261117-4d26dddf/qualification.private.json`.

The shared local catalog security check passes. One isolated dump clone lost
extension-member RLS/ACL; its separate failure and documented owner-bootstrap
repair are retained. No hosted mutation is implied.228 originally passed7 suites with
history/ACL/owner preservation;160 focused source/UI checks passed. Loading8
desktop/phone E2E passed in2.2minutes (delay/503/retry/empty/recovery, map identity
and footer geometry retained). Actual agent-led browser/Expo task review remains
separate. The superseded3100 process is stopped; candidate review runs at
http://127.0.0.1:3101 against local55321 with a1536MB Node heap. Step5 follows
ADR-089. The feature/mobile matrix is in MOBILE_IMPLEMENTATION.md.
Heavy tests and browser work stay serial
on this Mac. The existing pinned workflow tool and same-lockfile APFS dependency
clone are reused. No production mutation or new publication is part of these
local edits. New source-specific release evidence must qualify the result.

## Historical hosting request — November15–16 (CST)

Current next step: qualify the known-error regression correction in
[PR40](https://github.com/falmata-tech/loadgistic/pull/40), then resume the
remaining rollout. CI43949429970 on67e8 isolated the desktop failure to the test's
aggregate visible-text snapshot at VIEWPORT_TICK: alert true, loading false,
Review visible, zero invalid requests, both action labels present and textEqual
false. Artifact14269237267 SHA256
`4a9456c8d9b010de522cce3f9e4423297b0503408fba64787d07301934240913`
retains typed observations only. The actual text difference was not retained;
layout whitespace is an inference, not an established cause. The regression now
requires the known visible error message and error class, with separately
visible/enabled Review filters. Zero-invalid-request, explicit correction,
automatic refresh and repeated-key HTTP400 checks remain unchanged. Both
desktop and phone corrected cases passed locally in20.0s without retries.
The six parser/privacy tests passed in257ms, including the new boolean-only
error-presence observation. Full local quality on this correction passed1,598
tests, zero failures/skips, plus TypeScript/spec/source/workflow checks in89.129s
overall (74.479s tests). Log SHA256
`b5b8d68b8a8949054abd76bef94f80d8d1232746a096f16be7a81fa4edf68ae0`.
Production component bytes are unchanged.

That run's attempt1 stopped at the public PGDG signing-key curl with TLS EOF,
exit55; a diagnosed failed-jobs-only retry cleared validation. Attempt2's shard4
then stopped before tests on local DATABASE55322 port conflict; its process
owner is unconfirmed and no recovery/fix is inferred. The failed runs are
retained. Earlier2eb CI43931141327 attempts1–2 failed grouped mobile assertions
without individual diagnostics; their retry is consumed and no waiver applied.

CI uses the maintained development Turbopack server, not a production build.
The local Webpack fallback differed because its dependency symlink pointed
outside the worktree. An APFS copy-on-write clone of the same locked installed
dependencies took6.107s, with zero downloads or version changes. The maintained
Turbopack runner on loopback3101/local55321 then passed the exact mobile case in
15.2s, with alert true, no loading, unchanged normalized text, recovery visible
and zero invalid requests. This does not establish the remote failure's cause.
The related file then passed all six desktop/phone cases on the same Turbopack
runner in1.2 minutes, one worker and no retries. The six focused parser/privacy
tests passed in280ms. The verified owned temporary3101 runner was stopped;
the reviewed3100 development server remains available. No database reset,
broad fixture rewrite or production mutation was needed for this diagnosis.
The owned3100 process now uses the standard Turbopack command against local55321:
Ready3.7s, health200/ok and invalid-filter error/Review rendered. Six local
containers used786.37MiB with sampled CPU0.29%, within4096MiB combined caps;
process RSS/CPU were sandbox-blocked and are not inferred. Resource receipt
SHA256 `f370fa5480fda38c9d69d3b88c7cacc901311d99208079136029b33937fe192a`.
The diagnostic source's full local quality subsequently passed:1,598 tests,
zero failures/skips, TypeScript/spec/source/workflow checks,100.700s overall
(84.098s tests). The first sandboxed run's11 EPERM socket failures and one
socket skip are retained; all13 affected file/loopback cases passed focused
execution, followed by this complete passing run with required loopback enabled.
Log SHA256 `13913e44a845c0f647c50e73e4c37273684d3a863e1b6b854e33a74f498254b5`.
Local ShellCheck remains unavailable; required CI still covers shell analysis.
The owner's requested VS Code integrated browser replaced shared Chrome for
actual desktop and iPhone12Pro390×844 review: invalid reapply, phone Cancel,
explicit Mini Box Truck correction, matching map results and reload all passed.
Native screenshots are retained in the conversation; private review receipt
SHA256 `1872c95aa55d21ea18189be88fb2a050a51f5b96f6642c8081f25e29708802df`
records observed steps and the physical-phone/unchanged-Expo limits. Full local
quality passed: 1,594 tests, zero failures/skips, 192.368 seconds, plus TypeScript,
specification, source and workflow checks on Node22 with two test workers.
Local ShellCheck was not installed; shell analysis is not newly claimed locally
and remains part of the required fresh CI.
Local request-effect tests pass 30/30. Related browser coverage is
qualified by the four original passes, the diagnosed two-case desktop replay
(2/2 in 18.0 seconds), and the final phone regression (1/1 in 10.1 seconds);
the earlier failures remain recorded below. Earlier Chrome focus contention
and VS Code control timeouts remain recorded; neither was treated as a passing
review. Production remains old520
held/published, schema220, all simulator controls off, with139 planning fixes
saved and18 disabled configuration fields installed. No new candidate is
merged or deployed yet. PR40 remains draft; its new web source is distinct from
the completed c3-bound staging operations.

Current November 16 CST checkpoint: the owner-authorized exact synthetic readiness
repair is applied on project `tpwyyzoqijjmbvsmmvcm` using reviewed forward-v2 SQL
SHA256 `d2544e5e425c93c4b56ac78e0a145a5378c1ce0ce58a173a88b4de65ac061681`.
Normal commands added three current-policy acceptances, two verification
requests, two explicitly fictional demo ownership facts and nine audit rows.
Existing protected rows, Auth/profiles, roles and normal permission checks remain
unchanged. Actual repair receipt SHA256:
`b645480e7c87dc4d211fe5fe8bfb848fe24288548f95c67d7fb70ed6da5a9957`.

Root's actual Chrome upload/download verified both private 944-byte fictional
PDFs against their manifest digests; unauthenticated public reads were denied,
with no overwrite, bucket/permission change or credential-value logging. Storage
proof SHA256 `f2c8bfca437512bb308d8961adb868bb01e6f0bed459499ec2c283359326d75d`.
The independent database-clock readback at `2026-11-16 11:33:33.995828 UTC`
confirms three policy actors ready, two current exact facts, both fleets able
to publish, ledger220, stopped Capacity/motion controls and zero running targets.
Readback-v2 SHA256:
`29d4f902d72244c1767f6b920e88643ff7b5d523c2e93b7284f84b0f35633723`.
Evidence is under `.local/release-c3f900c-demo-readiness/`; the readback does not
refresh the backup timestamp.

The fresh native restore and complete V15 local repair → 139 planning → 221–227
→ B rehearsal passed; receipt SHA256
`e4e13881aad70c67e1542a5d480d6de2aa96e360ebeeaea6302632e7c14420cf`.
Original source admission preceded repair; repaired-state qualification uses its
own explicit baseline. Unchanged c3 CI and V11 A+C qualification are reused,
and the earlier unprepared-source failures remain retained. Hosted139 planning
now completed COMMIT using the frozen forward SQL; independent readback is
`ALL_PROPOSED_CONFIRM_RECEIPT`: 0 baseline / 139 proposed / 0 drift, with the
143 vehicle-context, 31 protected-row, 84 canonical-place and 2 consumer guards
unchanged. Qualified receipt SHA256:
`667288754ceebab23aa40a5a8e58611e41573773f6d161f72bd0b6943b844077`;
confirmed target fingerprint:
`a21f26aa1c467bce1cefa8cb694c5c4e5bbb570840deba6a7ccb43c690a0ba91`.
Do not replay the forward on the proposed state. Migrations221–227, main
CI, candidate qualification/publication, activation and natural-cron/runtime
verification remain pending. The owner then
explicitly replied “Allow these two warnings for this release only”: intentional
caller-own-account `current_user_projection` SECURITY DEFINER access and disabled
leaked-password protection. Keep both visible and the strict advisor check
failed; no additional/different WARN, ERROR or other failed gate is allowed.
This scoped disposition does not change any threshold or waive backup, security,
catalogue, runtime or CI requirements. All 16 same-source c3 CI jobs are freshly
confirmed passing; unchanged qualification is reused.
The advisor observation at `2026-11-16T14:25:49.859Z` confirms zero ERROR,
exactly the allowed two WARN findings (one each) and 110 service-only INFO
findings. Current disposition receipt SHA256:
`b17e1d4e17980b49a9f3ebdfe9d6978c78c7c17339cc73c02695273854f74851`.
Owner reply time is unknown and was not invented from receipt recording time;
backup and operation freshness are not extended.

Automatic approval review rejected the attempted 18-field Netlify configuration
installation before process launch because exact production configuration and
current owner-admin execution authority was not explicit enough under the
repository rule. Zero configuration fields changed; no merge, deployment or
activation occurred. The owner subsequently replied “Authorize this exact
one-time staged release” to review packet SHA256
`7caecb6b6cf20b7d6ac87c76ecd66249342ede703d19d8560d9977faa9793b9e`
under `.local/release-c3f900c-demo-readiness/`; actual reply reference:
`request_user_input_async/call_e787ba7570924cba9ee5b02e3bd902b9/0`.
Actual reply time is unknown. This authorizes only that exact staged scope and
preserves every current-state, artifact, security, CI, runtime and rollback gate;
it does not establish execution or deployment. The two existing warnings remain
allowed for this release; that disposition is not being requested again.

The subsequent authorized install succeeded: 18/18 exact disabled
Production/Functions fields, 92 provider requests, 17,239 ms. Receipt SHA256
`17bc4626388b24afd2940f6b6a10f707979b4b9b83a8c8126c1089b8e505529f`
records staged configuration only, no deployment or database change. PR39 is
merged as `6ee0109cab52ff852a41b043d95bbfb4b3720099`; its tree is exactly the
reviewed c3 tree `994a573167bd9d6e137a0265255d0325abe15b91`. Main
CI43892022196 attempt1 failed: 13 jobs passed, one independent browser case
failed, and the dependent `e2e`/`release-ready` gates failed. Production-source
workflow43896533348 was skipped; no automatic promotion occurred.
The actual Chrome publication hold remains on old deployment
`6af6ac945eb1cff1d55e577c` / source `520328bd61c70a7d278fd183c6a25ffde248ab7a`.
Production schema cutover waits for the immutable Production candidate's
source, final ZIP, scanner and runtime qualification. No publication or
simulator activation is claimed.

The independent failure is desktop `capacity-multiple-options.spec.ts:81`:
after reapplying an invalid filter, `capacity-feed-state` must retain
`role="alert"`. All seven other browser shards passed. The exact local case
reproduced the failure: 14 polls over the five-second assertion found the
loading overlay with no role. Actual Chrome then showed the invalid-query
alert returning after reapply but disappearing again on automatic refresh
(15 seconds). This is observed product behavior, not a timeout-only CI flake;
its exact cause and repair qualification are still pending. The typed CI
artifact retained no actual role, DOM or case duration; the local evidence
supplies those separate observations. See NR-37.

A bounded fix is prepared from the merge commit in a separate worktree: keep
the initial invalid-query denial through viewport loads and automatic refresh,
then resume normal fetching only after valid correction. The existing negative
workflow now checks those boundaries and successful correction/refresh.
The existing 30 focused request-effect tests passed in 4.048 seconds on pinned
Node22.16.0 with zero skips. The strengthened desktop negative then passed in
29.6 seconds without retries after its new text assertion was corrected to use
`useInnerText: true`; no product behavior was changed for that assertion.
The related six-case file completed with four passes and two failures. An unchanged
valid desktop case missed its five-second URL assertion while the local server
completed the matching request in 5,517 ms: observed cold development SSR delay,
not evidence of a changed valid-query path. The new desktop polling assertion
also timed out after a successful 1,462 ms correction; its waiter could miss an
in-flight initial request. The file reported 1.4 hours across an observed
15:43→17:15 UTC wall-clock gap; the gap's cause is unconfirmed. The test now
settles the initial corrected response before requiring a distinct periodic
response, and cleanup preserves the original failure. A two-case-only desktop
replay passed in18.0 seconds; the final phone regression passed in10.1 seconds.
No assertion, denial or timeout was weakened; there was no full-file replay.
The verified local server is `http://127.0.0.1:3100` against local55321 services,
on Node22 with supported Webpack development mode after Turbopack rejected the
dependency symlink; no 1.5 GB dependency copy or extra product/platform change.
The owner made Chrome available, but competing automation switched focus again
during a click. Root stopped; a CargoChatter draft checkbox may have changed and
no request was submitted. Exclusive Chrome access was requested again. Actual
desktop/phone review, full gates and deployment remain unproved.

The exact c3 approval and its completed operations remain recorded; they do not
by themselves qualify different repair
source. Bind the repaired immutable source to applicable authority and required
local/visual/CI/package/runtime gates before resuming rollout. Latest confirmed
production state remains: saved139 planning, the 18 disabled configuration
fields, old520 held/published, schema220, and simulator controls OFF. The two
release-only WARN allowances stay visible; they do not waive this failed gate.

### Earlier checkpoints retained (historical)

Earlier November 15 CST checkpoint (historical): c3f900c PR CI43766471670 passes all
16 jobs, including 538 browser passes and 70 reviewed skips. Reuse this unchanged
source evidence. The preserved encrypted capture and native
isolated restore pass. V11 A+C planning/schema rehearsal passed in 138,609 ms;
GPS B startup failed with 472 stderr bytes and an unknown SQLSTATE. That is not
a completed GPS journey or an established product defect. The V12 diagnostic
is review-only and unexecuted. Production remains unchanged; release gates and
owner-only production authority remain in force.

Next action recorded then: diagnose the fixed B startup operation before another long replay. Reuse
an available identity-verified isolated database and unchanged passing receipts;
otherwise prepare a small reproducible fixture. Prove one GPS report through
saved database state, the actual map and stop, then Phone privacy and Capacity,
before the cohort. See [the delivery loop](AGENT_LESSONS.md#practical-delivery-loop-for-this-project)
and existing NR-61/76; this is working guidance, not new automated enforcement.

November 16 CST: LOCAL combined B v2 passed in 93,748 ms with a real 90,680 ms
Capacity wait: seven normal source choices and seven reports, six GPS positions,
obscured Phone, three Capacity first phases and replay/foreign/wrong-transport/
Tracking/stop denials; protected consent/notification hashes match. Generic GPS
(18.285 s) and Phone (7.218 s) passed. Protected receipt SHA256:
`aecc78582a0775969be37f158221f0f6d5f54bfd4b18cd0b6b7522d25a7327be`.
LOCAL baseline: 225 history entries/head 226, with a hash-verified transactional 227
function overlay and no ledger writes; PostGIS public differs from archive extensions.
V11 A+C/native restore and c3 CI are reused; archive B and hosted activation remain unproved.
V12 native restore and positive C passed. Source B passed seven reports, six GPS
positions, Phone privacy and 12 denials, then Capacity failed `POLICY_REQUIRED`.
A three-second focused repeat on the same initialized container matched the
stderr hash and identified normal `require_content_policy` → publish → Capacity
executor calls. No PostGIS cause is established. The original source-B FAIL is
retained; local fixtures already had consent. Synthetic readiness is under audit,
with no hosted consent backfill, guard bypass, later B success or hosted write.
Local modeled policy preparation then reached `PROVIDER_VERIFICATION_REQUIRED`.
Read-only readiness: one independent target has 1 Live/`allowsDiscovery=true`;
two fleets have 9 and 8 Live/`allowsDiscovery=false`, with no qualifying current
ownership or financed licence facts. All three lack policy acceptance; no fake reviews/backfill.
Before/after catalog and table hashes match, excluding only sequence `lastValue`/
`isCalled`; sequence definitions, owners and ACLs remained compared. B FAIL stands.
The exact ID/nonce-owned diagnostic container was removed and absence verified
before expiry; six normal Loadgistic services remain. Production is unchanged.

Earlier November 15 checkpoint (historical): local3100 and the six capped essential services remain
available; the last container snapshot is736MiB combined. Mixed planning,
matching/privacy and actual desktop/phone/Expo reviews pass. Complete local
`npm run quality` at e169fef exits0:1,594 tests pass, zero failures/skips,
63.714s unit duration, followed by TypeScript. The focused PG15/Supabase run
[43765684621](https://github.com/falmata-tech/loadgistic/actions/runs/43765684621)
at that exact source passes security, all Capacity/Manual suites, pilot bindings,
four races/four blocker waits and baseline restoration. Clone removal and
Supabase cleanup pass. Primary verification is explicitly not performed.
The final PR source still needs its full browser/build/release matrix; PR39
remains draft and production remains unchanged. The follow-ups and this
evidence checkpoint are being prepared for its next source push.

The owner approved the limited hosted planning audit. Its private review packet
proposes120 Capacity/19 assigned Preferred plans, preserving seven newer
publications, seven prior rows, ten unassigned plans,13 reserved vehicles and11
catalog evidence rows. Fourteen hosted canonical-coordinate differences are
resolved; two invalid Area proposals are excluded. Two signature/MD5-only reads
match the locally installed consumers exactly and qualify latest selection
without returning hosted function bodies. The broader body read remains rejected.
No hosted data/configuration write occurred. Private review-only forward,
inverse and read-only verification SQL are being prepared offline; they are
unexecuted and unrehearsed. The84-reference canonical guard uses the documented
1e-6-degree tolerance, not exact-byte coordinate capture. Operation-specific
backup, isolated restore, rehearsal and owner execution remain separate gates.
Netlify previewf67 builds/archives pass; its runtime remains unqualified because
the scoped preview handler reports SUPABASE_NOT_CONFIGURED.

### Qualification history and retained failures

Pushed draftPR39 candidatef67db02. Exact CI43754634231 passes the combined
pilot rollback-only SQL (step41) but its new owner-race runner fails in about
0.2s before any race, acceptance, denial or blocker wait. The console receipt
does not retain the private failure stage/code, so no PG15 SQL/restore cause
is established. Clone removal and Supabase stop both pass. Mobile boundaries
and Operations proof43754634230 pass; downstream browser/container/Featured
qualification is skipped/blocked, not green. Diagnose the preflight and retain
typed failure evidence before another complete CI.
The diagnostic-only repair now emits strictly allowlisted stage/code/category
for each preflight boundary, with no raw message, path, account ID or SQL.
Fake-Docker CLI checks prove failure precedes backup/setup/drop. All27 focused
checks pass in11.616s; specs/source/workflow pass (124 scripts,13.454s). Guards,
restore sequencing and time limits are unchanged. Its focused disposable CI
lane is next; this is diagnostic preparation, not a repair of an established
PG15 cause or a green replacement for the failed run.
Diagnostic commit120cb7d was pushed only to the focused simulator branch.
Operations43755913195 stops earlier in `demo-world-atomic-handover`: the held
Manual-lane assertion gets DEMO_HANDOVER_CAPACITY_REFUSED because cap-public-103
now legitimately imports as PARTIAL/Route after removal of size-based forced
Empty status. Migration187's retained Empty baseline guard runs before223's
hold. Pilot steps27/28 are skipped; the original preflight cause is still
unknown. Both cleanup steps pass. Repair the rollback-only fixture's explicit
Empty baseline for the hold test, preserving separate Partial refusal and
unchanged-state evidence; do not restore a category rule or weaken validators.
The repair is confined to the two rollback-only handover suites and their
fixture contract tests. It proves the actual Partial refusal first, then stages
only two exact historical Empty/100% rows for the separate held-lane/replay
checks. Audit and Featured-day facts join the denial snapshot. All26 focused
checks pass in884.8ms and source/diff checks pass. Read-only inspection of the
owned PG17 clone confirms installed guard order and ACLs, controls off and no
handover jobs/receipts, but its retained historical B record is still Empty.
No clone is created or altered and no SQL replay is claimed against that stale
fixture; the next fresh focused CI must exercise the actual repaired SQL.
Fresh d9b1db2 Operations43757362926 passes the repaired Manual suite21 and
pilot rollback-only SQL27. Owner-race28 now identifies the actual pre-race
failure: PREFLIGHT_RESTORE_ROLE / PILOT_RACE_PROCESS_FAILED /
authentication-failed. The strict client/server major check already passes;
no transport/version repair is indicated. The in-container supabase_admin
process lacks its local password. Both cleanup steps pass. Prepare the same
checked local credential for every admin query/dump/restore without exposing it
or changing roles; preserve all target, version, backup and timeout guards.
The same-role repair now wraps every connected admin query/dump/restore in
one validated in-container command. Its existing POSTGRES_PASSWORD becomes
PGPASSWORD only there; no password reaches host memory, argv or logs. Missing
credentials refuse before a client starts. All31 focused checks pass in6.209s,
including real-shell fake-client quoting/negative checks; independent review and
spec/source/workflow checks pass (124 scripts,11.906s). One authorized read-only
PG17 query confirms exact clone/current role through the actual wrapper, with
no data write. It does not prove the pending PG15 authentication/race/restore.
The old unmeasured primaryUnchanged claim is replaced with an explicit
primaryVerification:not-performed; exact clone arguments remain tested.
Focused ea43c73 run43758528135 passes Manual/pilot SQL and admin authentication,
then refuses BACKUP_ARCHIVE_VALIDATE / PILOT_RACE_GRAPHQL_ACL_REQUIRED before
fixture writes or races. The exact-match ACL entry count is not1; that diagnostic
alone does not establish zero versus unknown/duplicate shape. Both cleanup
steps pass. An independent empty PG15.8 probe using a cached official image,
network disabled, capped resources and fresh temporary data completes in8.847s
and is removed. It confirms extension enrollment records current initial ACLs
and a second dump can omit an unchanged ACL. It also proves a counterexample:
matching current/initial ACLs alone does not ensure fresh CREATE permissions.
The pending narrow repair must pin owner/current/initial metadata, refuse any
unknown/duplicate shape, prove same-role/schema recreation on the disposable
clone before fixture commits, and verify ACL/owner before enrollment plus final
body/ACL/membership equality. Keep primary capture read-only. The generic
plpgsql dummy probe is not full Supabase restoration qualification.
The completed helper keeps primary capture read-only, requires exact owner and
initial-ACL facts for the zero-entry shape, and runs a harmless same-schema/role
creation proof only on the verified disposable clone before fixture commits.
It checks recreated owner/body/zero-mode ACL before enrollment and full equality
afterward. All41 focused checks pass; an actual cached PG15.8/pg_graphql probe
passes one-entry restore, zero-entry redump/proof/restore, default-drift and
wrong-database refusals with zero leftover probe functions/fixture commits.
Receipt `pg15-helper-integration-20261115-a/receipt.private.json` SHA256
2f3c84dff7e9d9f4d07f6537f00d79c17c097f23474663240526d43d11885d00 binds
helper SHAe1a7ac31730010a18928983f3654513d99c0d3214ef25f0f9629d29fb9011827.
The owned container/fresh data are removed. Proof-attempt status distinguishes
an attempted refusal from a probe never run. Fresh focused e169fef run43765684621
then passes the actual Supabase scenario: step21 Capacity/catalog/Manual/owner
suites, step27 rollback-only pilot bindings and step28 four races/four actual
waits, one accepted provision/report each and two denied provision/report each.
The zero-entry archive creation proof matches and baselineRestored is true;
primaryVerification remains not-performed. Both cleanup steps pass. This clears
the focused PG15 blocker; the full final PR matrix remains a separate gate.

Netlify builds the exactf67 preview6afa0cf4576519d1f022ab30 successfully in99s.
Its installed postBuild guard checks all11 final function ZIPs: root layout and
nodeBundlerNone true, privateEntries0; one edge function is also deployed.
Actual Chrome public entry shows server exception digest2221522590. The scoped
preview Next handler log identifies SUPABASE_NOT_CONFIGURED. Packaging passes;
preview runtime is unqualified. Production-only credentials were not copied or
configuration changed. The deploy list still shows production520328b at
6af6ac945eb1cff1d55e577c. No production publication or simulator activation.
Three completed task-created review tabs were then closed, including the two
local pages Chrome labelled1.8GB/2.8GB; unrelated tabs/apps remain open. The
kept local3100 server returns200/ok with the expected local Supabase adapters
in836ms after cleanup. This is observed cleanup/health, not an OS-memory delta
or a resolved explanation for earlier latency.

Local gate components now pass:45 specs/42 features,774 source files,124
workflow scripts, all1,572 unit/contract cases (zero skips,303.865s), TypeScript,
nine focused keyboard cases and two desktop/phone keyboard E2E cases without
retries (97.567s). The complete quality attempt passed its checks/tests but
exited2 on two new component typing errors; the correction follows existing
React-shim conventions. A saved transpiled-runtime AST comparison is identical
before/after, TypeScript then exits0 and the nine keyboard cases pass in4.704s.
Reuse unchanged runtime/E2E evidence; exact-source CI must still run its complete
quality command, PG15 database scenario, build and browser matrix before this
candidate is release-qualified. No hosted write or activation is included.

The first full local gate found17 failures (1,550/1,567 tests passed, zero skips,
335.802s; specs/source/workflow passed with124 scripts). Do not treat the earlier
focused pass count as full qualification. Failures group into obsolete small/
observed-location proximity assertions, real Area centers used as boundary
vertices, six rewritten Capacity rows serving as exact simulator catalog
evidence, and stale public fleet route copy. Source repair preserves all11
catalog evidence rows/20 phases, uses actual enclosing settlement rings with
honest radius and Route fallback, retains canonical observed locations, and
derives seven public fleet descriptions from their saved Preferred plan while
preserving the exact profile scenario page/Preferred baseline. All33 focused
repair cases pass in8.245s, including Area, market/fixture/copy and complete
catalog/planner checks. A fresh LOCAL-only correction then rehearsed24 Capacity,
five Preferred and seven page updates with four actual denials and exact clone
rollback. The namespace guard was corrected to the shared trusted pilot marker
before application; the clone test temporarily counted one actual marker,
denied it and restored zero. SQL7c0392963d39b2df7326448788ca37aa6f16a85fa880b22943c494207dfd3a72
was applied once with a durable intent. Independent readback confirms all36
rows, unchanged availability/unrelated facts and untouched other rows, catalog11,
current drivers,85 positions, one receipt and both controls off. Receipt
`planning-repair-apply-v3-1794769211428-receipt.private.json` remains private;
the exact inverse is prepared, not applied. The actual browser/Expo review is
complete; final matching and local gate components pass, with CI pending. During the
review, Gateway401 returned31.5ms and the database had no observed lock wait.
Those facts did not identify the intermittent local API delay's cause.
One controlled owned Next restart then preserved cache/env/data, stopped the
optional Expo preview and recovered the expected local adapter. Startup took
10.5s; API compilation15.6s and root26.5s. The one correct-capacity API check
returns200/one exact record in2.840s. This is unconfirmed dev-request/HMR-state
recovery, not a proven SQL/cancellation repair. Actual Pixel9 review now shows
the corrected Adama Area's Wenji/Welenchiti/Mojo boundary and preserved age.
A native Profile click opened the external call-app prompt; it was cancelled
before FaceTime opened. Actual keyboard focus/activation then opened Profile.
Desktop and Pixel9 Chrome review at3100 verified the selected HyundaiH-1's
saved Area, enclosing polygon, all three boundary labels, age and Vehicle
details, followed the actual Profile link, checked its corrected headline and
About text at both widths, and returned to the saved map selection. Earlier
unchanged long-van, keyboard/canonical-filter and anonymous private-data checks
remain separately recorded; these observations do not claim native-device QA.
The single-worker Expo web preview at8084 verified the same saved Area and
Vehicle details on Pixel9, the corrected Profile description, reload and return
to the selected map record. Its first profile request took15.158s during an
11.2s endpoint compile and showed the visible timeout. An AX click did not send
a request; focusing Try again with Tab and pressing Return did, recovering in
8.086s. Reload then completed in16.197s without another retry. Existing four
development warnings remain. The owned Expo listener was verified and stopped
after review; Next3100 remains running. The subsequent bounded API replay passed
three cases before a15s request timeout. A bounded capture observed one active
PostgREST query, no blockers or lock waits; it did not establish the cause.
With Expo stopped and the database idle, one controlled complete replay passes
all20 cases in57.754s: five real saved-plan matches and15 reverse/conflicting
AND/status/private/anonymous denials. Receipt
`planning-api-final-v3-1794771186245-receipt.private.json` binds the final saved
snapshot and applied repair. The partial failure receipt remains separate;
neither timeout nor assertion was relaxed, and no SQL repair is claimed.
Final saved-snapshot counts for configurations named Mini, van, Pickup or Light
are112 vehicles:87 Routes/25 Areas,30 routes under40km and27 over100km. Preferred
plans are21 Routes/nine Areas. These exact installed-snapshot counts supersede
the earlier source-derived113/88/31 counts below; distances are point-path sums,
not measured road mileage. All saved statuses remain unchanged by the final
planning/copy-only correction.
No hosted correction is applied. Automatic approval review rejected per-record
hosted planning/mapping access and a manifest-joined aggregate; the separate
hosted audit is restricted to cohort-level aggregate queries without that
manifest. Exact hosted correction preparation is blocked by that access scope.

The follow-up to28acf38 contains the independently reviewed ownership, planning
and keyboard repairs below. At this recorded pre-push checkpoint, bbcc3dd is the
remote draftPR39 head. Its CI43730171962
finished with failures in browser shards2/4 (`fleet-onboarding.spec.ts`, desktop
line523/declaration422, and `tracking-route-map.spec.ts`); the other shards and
validation/mobile/container/Featured checks passed. Operations proof43730171992
passed. Preserve these failures and diagnose the exact cases before another CI.

Local follow-up preparation adds atomic migration227 for the existing
production-pilot namespace, a pure binding plan and a bounded server-selected
movement target list. It excludes fleet-03/06/08, which currently belong to
independent providers rather than their originally authored fleet scopes;
eligibility does not restore old owners. Actual rollback-only SQL now passes on
the owned `loadgistic_pilot_ci` clone: unchanged public/auth/source/consent facts,
ten function metadata checks, seven exact virtual devices and reports,
three excluded targets, owner/driver/co-owner/body-drift refusals, replay denial,
source-choice preservation and unchanged engine authority. Controls stop and
history is retained before rollback. The combined rehearsal also applies three
actual Capacity phases. It discovered the global activation guard's old local
Tracking prerequisite; read-only hosted inspection confirms that example absent
and both reservations disarmed. The exact pilot-only activation mode preserves
all other Tracking functions and existing outbox checks, denies arming/forbidden
notifications and leaves every notification queue unchanged. Both CI workflows register this bounded
isolated test. No hosted migration, setting, source or control was changed.

The owner's additional request is realistic planning diversity independent of
the simulator: all smaller vehicles are ordinary transport vehicles and need a
mix of local and longer routes/areas and actual Empty/Partial signals. Audit
confirms every mini/van/pickup/light-truck route in the credential-free fixture
is under40km, with no route over100km. The old geographic generator selected a
`DELIVERY` catalog by size and the importer forced larger vehicles to Empty/100%.
Local source now removes those category rules. An explicit143-record discovery
manifest preserves existing sharing and location privacy independently of size;
saved availability/load facts are retained. Geographic helper choices now mix
city/local/regional plans for every configuration. Exact authored simulator and
handover/private fixtures are reserved inputs, not size restrictions. Their GPS
courses remain separate from the commercial plan.

The source-fixture refresh command is preview-only unless `--write` is passed.
Its first preview refused unresolved Chamuk before writing; selection now uses
the existing verified settlement catalog without inventing substitute points.
The refreshed source is idempotent. A protected snapshot and exact157-row patch
were rehearsed with rollback on the clone, then applied only to local marked
synthetic records:130 capacity plans,27 Preferred plans and16 Partial signals
previously overwritten by the larger-vehicle rule. Scope/current-row drift is a
hard refusal. All other fields,13 reserved plans, privacy, location capture
times and simulator history are preserved (85 positions and one Capacity
receipt remain; both lanes disabled). The exact157-row restore is also rehearsed
in the isolated clone and verifies full original-row equality before rollback.

Saved local smaller-vehicle distribution:113 vehicles,88 Routes/25 Areas;
31 routes under40km and27 over100km, compared with104 under40km and none over100km
before. These are point-path sums, not road-mileage claims. Twenty actual local
API requests pass five route/area matches and15 reverse-direction, conflicting
AND/status, private-data and anonymous account denials. All103 required canonical
planning references exist in the running local place catalog. Forty-four focused
fixture/matching/adapter/binding/diagnostic tests pass; spec/source/workflow checks
pass with122 operational scripts, actionlint1.7.12 and ShellCheck0.11.0. The
original fixture bytes and exact before/after receipts remain private.

Independent review then found two new PILOT qualification blockers (NR-86):
an inherited fleet-provision OR alternative bypassed the new co-owner helper,
and motion's old KEY SHARE/count proof did not serialize a concurrent co-owner.
The corrected227 keeps old alternatives restricted to LOCAL provenance, takes
strong exact-org/member locks before profile/device/vehicle locks at each first
callable boundary, and permits new pilot synthetic devices only on the reviewed
direct transport/profile/protocol identity. Ordinary real enrollment is unchanged.
Final combined SQL and six focused binding tests pass, including direct public
co-owner/wrong/missing-protocol refusals with unchanged device/audit facts.
Four real races/observed blocker waits pass: one provision and one report accept
before the waiting co-owner; owner-first and subsequent operations deny twice
per lane without changing saved state. The owned clone baseline is restored and
verified. Both CI paths register the guarded race runner and cancellation cleanup;
workflow validation passes123 scripts. These ownership proofs apply to PILOT,
not the unchanged LOCAL branch. No hosted operation occurred.

Final runner review found and fixed two additional qualification gaps before a
push: CI uses PostgreSQL15 rather than the Mac's17, and `DOCKER_CONTEXT` overrides
`DOCKER_HOST`. The runner now pins the effective Unix endpoint and immutable
container ID, supports matching15/17 clients and shares the existing exact PG15
GraphQL wrapper/deferred-ACL restore path. Twenty-two guard/restore-order tests
and workflow validation for124 scripts pass. The single actual PG17 rerun
records all four races/four waits and expected accepted/denied counts, but its
baseline restore status is false (`.local/pilot-owner-races-MZNVQg`). Diagnosis
finds the generic30s subprocess limit was incorrectly used for a full catalog
restore; no SQL error/fingerprint mismatch is established. The correction reuses
the existing clone helper's120s catalog-restore limit for that operation only;
security/lease bounds and the three-minute CI wrapper remain. The owned clone's
targeted saved fingerprint check now passes with no changed fields and no active
restore session (`.local/pilot-restore-check-Fr0OS6/receipt.json`). The primary
remains untouched. Retain the failed four-race receipt and separate targeted
restore proof; integrated PostgreSQL15 runtime qualification remains for CI.

The three cases named by CI's failed shards pass unchanged against the local
services in2.5minutes, including both driving-provider signup/publish/cleanup
paths and authorized/revoked Tracking proof. The CI-only causes remain unproven;
new allowlisted stage/code/status diagnostics retain the next failure without
customer data, relaxed timeouts or dropped assertions. Their focused replay
passes all three in1.8minutes; the pre-keyboard TypeScript check also passes.
The first actual Chrome attempt was blocked by `cgWindowNotFound`; the owner's
subsequent go-ahead allowed review to resume. Actual desktop and Pixel9
412×924 views show the van's five-stop Addis Ababa→Assosa plan, separate honest
location/capacity ages, the Area example's five real boundary settlements,
vehicle details, reload retention and the anonymous private-view sign-in boundary.
Screenshots and interactions are captured in the native-CUA conversation; no
call, account, source or location update was submitted.

Review also reproduced a real keyboard bug: Arrow Down/Enter submitted the
surrounding form before selecting a suggestion. The shared place input now has
active-option/ARIA state, keyboard selection, Escape recovery and stale-result
clearing, preserving pointer selection and layout. Nine focused component
tests and both desktop/phone E2E pass (42.5s), using the actual first catalog
identity rather than assuming a built-in ID. Actual desktop Chrome selection,
Escape/reopen and explicit apply pass with persisted canonical query values.
The actual Pixel9 keyboard journey also passes: both canonical places remain
selected in the open form, Escape/reopen works, and explicit Show vehicles saves
the query and shows the matching van. One earlier unfiltered map request returned
503; the subsequent filtered request and saved result recovered. A clean
incognito comparison did not reproduce the normal-profile AbortError messages;
catches and a detached-observer counterfactual do not justify an application
suppression/fix, and no particular observer is attributed. The503 cause is
unconfirmed: the route collapses multiple backend failures to this status.
Actual Expo web on8084/Pixel9 passes long-route and Area selection, all five
route stops/boundary settlements, vehicle details, truthful source/age/privacy,
close/return paths and Area selection after reload. Its existing four development
warnings remain visible; this is not native background/device qualification.
The initial unbounded-worker
process was blank at87.2% CPU/8.9% memory; the verified owned process was stopped
and restarted using the documented single-worker command, without cache/reset
or dependency changes. The initial single-worker bundle took121.2s during high
system load; a later warm bundle took0.867s. Once settled, the owned process
measured496468KiB RSS/0.4% CPU. It was then stopped and8084 confirmed closed.
The local web server stays on3100. Final actual Chrome review also focuses the
empty Area combobox and verifies that one Escape closes the filter dialog and
returns focus to Filter. That full quality attempt's failures and follow-up are
recorded above; current full replay/release gates remain pending.
The web/API is healthy and the six capped Docker containers measure764MiB in
this warm sample. No new push/CI or release is claimed before the actual review. Hosted demo
data and production remain unchanged.

Read-only Netlify review now confirms the existing credit-based Pro plan and
disabled auto-recharge; exact balance/usage stays in private local receipts.
The owner requested only a few demo hours daily with very limited credit use.
The candidate now bounds both native schedulers to09:00–11:00 Addis Ababa
(06:00–08:00 UTC), rechecks hours in dispatch/background/application code and
ends motion's next due report at the closing boundary. Saved records, privacy,
age labels and current controller history remain intact. Thirty-four focused
schedule/adapter/controller and relay checks pass without skips. The full replay
passes all1,539 tests without failures/skips in170.063s, plus spec/source/workflow
checks and TypeScript. Its first run retained one unchanged relay subprocess
timeout at the existing one-second bound; the focused replay passes unchanged.
An intervening restricted-shell run denied local sockets and is infrastructure
evidence, not an application regression. Exact-source CI is next; no deployment.
The final workflow supplement also passes with pinned ShellCheck0.11.0 present
(117 operational scripts, actionlint1.7.12); the first full replay's PATH lacked
that optional shell analyzer. No gate or timeout was weakened.

Before this hours revision, exact36ba420 passed all16 required PR jobs in
CI43698414595 and separate Operations proof43698414651. Actual Netlify preview
6af97855d4747cfd94e846bf at that head deployed11 functions, verified all11 final
ZIPs with zero private entries and passed scanning2,314files. It is preview
packaging evidence, not a production runtime or the revised schedule artifact.
The source-unchanged combined local run accepted one Capacity phase alongside
18 motion updates. An open actual Chrome map then received three fresh source
observations through normal polling with selection, panel and camera preserved.
These later receipts and exact hashes are linked in draftPR39 and private local
checkpoints without invalidating the qualified source through a status-only push.

Current hosted read-only inspection: Loadgistic is ACTIVE_HEALTHY, Supabase Pro,
ledger220, no registered gateway/device/position or motion target, no Capacity
steps; both controls are disabled and never activated. Logical database size is
43,183,251bytes, not a disk-volume/WAL quota measurement. Existing two security
WARN categories remain visible; no advisor/configuration repair is claimed.
Production still publishes520328b. The owner-requested Docker Desktop restart
completed successfully. All six essential local containers resumed; Storage
became healthy after startup without a reset or another restart. Existing caps
persisted: database1.5CPU/1.5GiB, other services0.5CPU/512MiB each. One settled
sample totals about565MiB container memory. Local3100 health returns ok against
the retained Supabase records. Local external-auth/email/scanner production
readiness blockers remain expected; this is development readiness only.

Read-only hosted cohort preflight finds zero matches for the candidate's ten
local fixture vehicle IDs and zero identities marked with its `loadgistic`
fixture source. This is not hidden by RLS: the inspected role bypasses RLS and
sees146 vehicles. The separately approved production-pilot namespace contains
152 marked identities; all ten deterministically mapped pilot vehicles exist,
but fleet-03/06/08 fail the candidate's exact active-owner provenance predicate.
All ten have no explicit source selection. Pilot fleet-02/06 remain PUBLIC,
where the authored Capacity targets require BOTH; the current statuses also
need exact scenario bootstrap review. The installed five Capacity target IDs
match no hosted vehicle. No names/emails were used to grant authority, and no
hosted identity, target, assignment, sharing or source was changed. Deployment
and activation require a tested exact pilot binding/eligibility plan in addition
to the existing backup, security, CI and owner operation review.

Native Chrome hands-on review now reaches the local app after Docker recovery:
at `http://127.0.0.1:3100/`, open Search, find BlueLine, choose Show vehicles on
map, select its GPS Demo marker, read Vehicle and Approximate location, close
the dialogs, switch to Pixel9 emulation412×924, open location, reload and reopen
the same saved GPS Demo attribution. Desktop and phone screenshots are retained
in the computer-use conversation; controls and dialog content fit, and normal
desktop view is restored with the server running. No call, consent, source or
record mutation was made. Earlier automated private/permission/native receipts
remain separate; this hands-on session does not cover signed-in Phone or Expo.
One initial navigation/HMR session exposed an unhandled AbortError pointing to
the feed's request-abort cleanup. The existing loader catches cancellation;
after reload, console has zero messages and the saved map task succeeds, but the
original cause is not established. Keep this finding open for a bounded actual
navigation reproduction; do not claim a repair or suppress ordinary errors.
All30 existing feed refresh/cancellation/denial/recovery hook tests pass unchanged;
they do not substitute for reproducing this actual Chrome observation.

The owner selected the Netlify-only demo simulator. Capacity and fictional
GPS/Phone movement are one experience with separate guarded commands and controls.
The new minute scheduler dispatches one bounded background window; the existing
Supabase database owns the window, due times, leases and accepted history.
No VM or running Traccar service is required for this selected demo. Real tracker
reception and GT06 decoder qualification remain separate. Direct events carry
private `NETLIFY_DEMO` provenance and the existing public Demo label.

Migration226 and the signed adapter are implemented locally, default-off.
Two actual local handler/database rehearsals each saved18 updates (16 GPS and
two Phone), with zero failures; the one course lacking qualified geometry refused.
The final window took32.622seconds with Traccar stopped. Other Capacity records
were unchanged and cleanup restored disabled controls, stopped leases and an
empty active window. These receipts exercise real SQL and handlers with injected
local configuration, not the Netlify provider runtime or production API adapter.
Rollback-only provisioning and window/permission/replay/stop SQL suites pass;
fresh setup preserves every existing source choice, including Manual, and creates
no consent. Twenty focused adapter/auth/workflow checks pass without skips.
Actual Chrome automation passes four desktop/phone checks: saved GPS reaches the
public map with Demo source attribution and survives reload; the private Phone
target stays absent publicly, rejects anonymous account access and remains
visible with its saved Phone source to its authorized driver. No source or
capture timestamp changes during these reads. Initial cold compilation exhausted
the test budget and one original test incorrectly expected this private target
publicly; both failures are preserved. A local unfiltered RPC diagnostic then
returns15 rows in722ms without an SQL error; the earlier server error's cause
remains unconfirmed. Chrome computer controls separately time out twice, so
hands-on review was not claimed from those automation/images. The later native
Chrome Netlify plan and preview readback is recorded above.
Two additional desktop/phone checks wait for the private map's actual Leaflet
geometry and loaded tiles before capturing it; both pass. The strict native
translation audit passes796/796 fixed messages and the actual one-worker Android
Hermes/source-map export completes. Existing unchanged mobile426-test/type/lint
receipts at e21853c remain applicable; no signing, install or Play release occurred.
Migration226's four final local function bodies match source, its local ledger
is reconciled and the unchanged installed-database security gate passes.
Real two-session window/stop testing passes three races with three actual
PostgreSQL blocker waits. Rollback SQL also checks direct-only retention scope.

The initial full quality run passes1,535/1,536 with zero skips; the unchanged
mail-parser five-second process guard times out at5.047s. Its one isolated replay
passes in1.750s without increasing the budget. Preserve the failed full receipt;
it is not a green full gate. The controlled full replay then passes all1,536
tests with zero failures/skips in188.403s, including the parser in1.620s, plus
spec/source/workflow checks and TypeScript. Heavy Android/browser work had
finished; CPU contention is a hypothesis for the earlier timeout, not a proven
cause. Exact-source GitHub CI, hands-on review, account-plan readback and the
reviewed production SQL/configuration/backup/restore remain pending. See the updated
[hosting plan](operations/DEMO-GPS-HOSTING.md). No hosted write or purchase occurred.

The following protocol-stack rehearsal is an alternative transport's historical
evidence, not proof that direct Netlify events passed a decoder:

At e21853c, all three existing bridge/movement/Capacity container images build
on this ARM64 Mac; disconnected worker-image preflights remain disabled.
The46 hosting/topology/protocol/credential checks pass with zero skips.
A credential-free47-entry source archive and immutable local build receipts
are in `.local/simulator-host-20261115/`; x86 artifacts and hosted runtime are
unqualified. The separate local project `loadgistic-telematics-review-20261115`
preserves the old gateway volumes. Its actual fictional GT06 round trip passes
decoding, a synthetic Locate acknowledgement and durable outbox checks. Existing
guarded provisioning registers only ten fixed fictional devices. An explicit
synthetic personal-driver command selects Phone; other exact targets select GPS.

A two-target120-second local run saved fresh GPS through the bridge/application
database and public Capacity API with Demo provenance intact. It paused after
one tick per target with `DEMO_MOTION_REPORT_DENIED`; HTTP409 requests took
8–9seconds against the unchanged5-second capture guard. That timing is consistent
with queuing but actual capture age was not logged, so the cause is not conclusively
established. A warm controlled replay completes four GPS and four Phone ticks,
stops normally, and readback confirms both leases OFF. This is a bounded local
receipt, not sustained hosted timing, all ten targets or hands-on map acceptance.
The first premature bootstrap and protocol invocation are retained; zero gateway
users were confirmed before the readiness retry. The local guide now waits for
health before bootstrap. No production SQL/settings/merge/deployment, host
resource or payment was made. Existing full release and owner authority gates
remain required.

## Active Mac continuation — November14 (CST)

The owner resumed local development and asked to reduce local resource use,
then continue unfinished work. Candidate checkout `.local/scenario-dev` uses
`feat/scenario-local-review` from remote handoff0df8590. The original checkout,
its generated metadata/user settings and old local database history are preserved.
The old local stack had completed simulator history and enabled controls, so it
was stopped without deletion. Fresh local project `loadgistic-review-20261114`
owns the normal5532x ports and has the exact migrations through225, security
gate and verified synthetic fixtures. Its controls remain disabled/unarmed.
No paid development branch, hosted mutation, merge, deployment or activation occurred.

Only six essential local containers run, with per-service CPU/memory limits;
web3100 uses Node22.16.0 and its own Turbopack root. Expo8084 uses Node24.18.1
and one Metro worker, stopped after review. Old inactive Next caches freed
about2.8GB; the original11GB mobile install remains preserved and the candidate
installed its exact lock in about634MB. See [LOCAL_SETUP](LOCAL_SETUP.md) and
the candidate's ignored `.local/README.md` for restart and return instructions.

Actual Chrome/database review found the selected publication stayed at80%
after a real60% save. The link kept the old Capacity ID and map detail/camera
state used that changing ID. The local repair resolves the current same-vehicle
publication before the unchanged authorized projection and preserves the open
panel/camera using vehicle identity. Exact lookup still checks supplied vehicle
identity, all filters and current permissions. No schema or grant change.

Focused helper/feed checks pass34/34. Chrome phone and later diagnostic desktop
pass real80→60, original-link reload and private removal; Expo390×844 passes the
same flow. The public Demo label was inspected in actual Chrome using the saved
Sheger fixture. The strict browser fixture preflight passes one/zero-skips.
Screenshots and sanitized evidence are under the candidate's ignored
`.local/review-evidence/`. Initial desktop waits, a private-removal timeout,
Storage startup failure and the failed first quality gate are preserved.
These isolated passes do not diagnose those earlier runtime failures or qualify
repeated reliability or installed Android.

The first quality run found the macOS native-runner expectation and temporary
path fixture issues, two missing renderer-helper bindings, and sandbox-blocked
loopback relay/GT06 tests. Fixture repairs retain native target refusal and all
security assertions;25 targeted checks pass. The full `npm run quality` now passes
with Node22, Python3.14 and authorized loopback access:1,525 tests, zero failures
or skips, plus spec/source/workflow and root TypeScript. Unit runtime364.764s.
Mobile Node24 types/lint and426 tests pass with zero failures/skips. The final
web replay passes both desktop and phone with zero retries (33.5s/32.1s).
A separate390×844 broker-owner/staff journey passes current private publication,
old-link API readback, exact grant revocation and clearing both open selections;
anonymous account reads return401 and public discovery stays empty. Its first
workflow assertions passed but provider teardown failed on an audit-log foreign
key. Exact remnants were removed after scope checks; corrected teardown and the
complete replay pass47.6s. Readback restores154 users/143 vehicles/9 organizations
and zero task-owned provider remnants; world/motion/Tracking remain off/unarmed.
Receipts and the guarded local harness are in `.local/review-evidence/` and
`.local/private-refresh.spec.ts`; the maintained public regression is
`tests/e2e/capacity-live-refresh.spec.ts`. Metro remains stopped, web3100 running.

The next local source-control checks exposed two different issues. The web
fixture stored a legacy Manual choice without a historical report; its map
correctly says Not set while the editor retains that choice. Its assertion now
checks exact saved source/revision after Cancel and reload. Expo's installed web
renderer omitted checked state for the source and accuracy radios; explicit
ARIA checked/disabled state now supplements native state without changing
appearance, consent, API or saved-source rules (NR-21/37).

Maintained actual Chrome tests pass the web Manual→Phone journey48.2s,
Expo390×844 journey31.7s and desktop first private phone fix23.6s, zero retries
or skips. Both source-switch tests deny browser location first, prove zero
source/report writes and unchanged database facts, then grant the synthetic
browser fix and complete the real save/reload. Provider override and unassigned
vehicle denials remain covered. Expo also checks accuracy-only edit/Close,
mutually exclusive accessible state and restored saved Phone source. Web's six
and mobile's11 focused tests pass; full mobile426/426 passes19.654s, with types
and lint. Root spec/source/workflow and TypeScript pass. The earlier1,525-test
root quality receipt covers the preceding checkpoint; it is not a new exact-source
full gate for this small mobile accessibility repair.

Sanitized logs and failed first runs are retained in `.local/location-review/`.
The source/denial/saved phone screenshots were inspected. Native Chrome control
opened the local Expo sign-in page but selected the existing user process instead
of the separate headed test browser; the browser access host was unavailable.
The diagnostic headed journey passed automatically after its review pauses were
released with explicit **not reviewed** receipts. That is not completed hands-on
desktop/phone editor review. Actual Android permissions/background movement,
configured GPS ingest and private Expo permission transitions remain unqualified.
Scoped cleanup restores154 users/143 vehicles/9 organizations; world/motion and
Tracking controls remain off/unarmed. Metro8084 is stopped; web3100 is running.

Next: finish hands-on source editor review when the correct browser process is
available, configured GPS/native-only journeys, private Expo permission
transitions and the full exact-source candidate CI.
Hosted/device/activation gates remain separate and unfinished. No production
build, package, merge or publication is claimed by this local checkpoint.

## Preserved owner handoff instruction — November14

The owner has stopped environment setup and requested that all existing changes
and continuation details be committed/pushed for another agent. Start with the
current [CLOUD_HANDOFF](CLOUD_HANDOFF.md); the old handoff is archived separately.
No resource/cost prompt, environment recovery, merge, deployment or activation
is part of this handoff. Current executable checkpoint is28afe43f; subsequent
commits through this handoff only reconcile documentation. All implementation
changes are already on `feat/scenario-driven-demo-signals` on GitHub.

## Verified implementation checkpoint — isolated fixtures and native concurrency

The owner approved continuing with Netlify Capacity scheduling and an isolated
managed development backend, subject to safety. New source adds a bounded
development fixture preparer and real two-session Capacity/profile qualification.
The complete local quality gate passes1518/1518 tests with zero failures/skips,
plus spec/source/workflow/type checks. Exact-source native
[run43614507599](https://github.com/falmata-tech/loadgistic/actions/runs/43614507599)
passed on attempt1 at28afe43f. Its real database receipt confirms10 races,
12 observed waits,10 exact denials,2 accepted commits and2 disabled read-only
replays. Clone recreation, subsequent normal-signup isolation, final cleanup and
Supabase shutdown all passed. This qualifies the selected NR-83/84 Capacity/
profile races and competing ordinary-profile save. Full PR/main CI, actual app
review and hosted installation remain separate; immutable history was not edited.

The fixture preparer checks exact branch metadata/keys, Auth and named core-table
emptiness, seven expected private Storage buckets/empty roots and readable
catalog status. Explicit apply needs the exact development ref and a new private
receipt, creates only three marked demo actors/two trucks plus one normal signup/
truck, and uses current lifecycle commands. It resets/deletes nothing and
activates no worker. Owner-only independent controls remain a separate read-only
provider inspection before apply; the service key's ACLs are preserved. Focused
Node22 tests and independent review pass. No hosted fixture setup occurred.

The latest native branch-cost confirmation expired. Supabase's exact organization
quote is $0.01344/hour before other usage charges; no development branch was
created and no cost was approved. Do not repeatedly renew the confirmation or
incur cost for an interactive review before a usable preview route is established.

Connected user Chrome is available. A ready task-owned localhost probe was
unreachable from that browser, a separate executor command and the Cloud desktop
browser. Both probe servers were stopped. The approval policy rejected a
host-level socket-capability check because sandbox escalation is disabled. No
preview/port-forward/request-changes tool is currently exposed. A shared localhost
or supported preview connection is required for agent-led web/Expo review; do
not bypass the restriction through another UI shell or arbitrary tunnel.
Existing Expo session restoration can support downstream synthetic workflow review
without mail, but is not OTP delivery or native-device acceptance. Paid branch
provisioning alone does not resolve preview connectivity. Production/main remain
520328b and all new simulator work remains unmerged/unactivated. Fresh read-only
production inspection found219 migration entries through220, none of221–225,
all eight simulator controls off/unarmed (motion kill on), and zero registered
gateways/devices/positions. Security advisors remain0ERROR,2 knownWARN and1INFO
category covering110 private tables; no finding or gate was suppressed.

## Preserved development checkpoint — Netlify and native database diagnostics

The earlier pre-concurrency feature checkpoint is saved on
[`feat/scenario-driven-demo-signals`](https://github.com/falmata-tech/loadgistic/tree/feat/scenario-driven-demo-signals)
at implementation checkpoint `2b5751133d2060702558d569b4413ef86d87664f`, including
the Netlify/development adapters and duty-authorization repair described here.
That checkpoint was superseded by implementation28afe43f and its1518-test/native
concurrency qualification above; do not treat later implementation changes as
documentation-only. The original three local commits remain on
`checkpoint/scenario-local-e226`. No feature PR, full CI run, merge, deployment
or simulator activation has occurred. The verified published baseline remains
520328b below.

The preferred fast Capacity scheduler is now a default-off Netlify minute
function, with a bounded two-due-actor request through the existing guarded
controller. Per-actor phases remain at least120seconds after actual completion;
healthy spacing is expected120–180seconds, and foreground UI reads every15seconds.
The one-actor/30-second dedicated container remains an alternative, never a second
active scheduler. Synthetic GPS/phone movement stays a separate service. Source
and focused tests do not establish hosted timing or successful database writes.

Normal Next.js/Expo development can use an isolated managed Supabase branch,
without Docker here. The bootstrap validates exact branch metadata and development
keys, makes two read-only API checks, and exclusively creates a private environment;
it does not seed fixtures, configure email or qualify migrations/browser flows.
Only production projects were found. The native development-branch cost confirmation
expired; no branch/resource was created and no cost was accepted. The latest
continuation above records the renewed confirmation and connectivity checks.
Do not use production service credentials or weaken the local-only fixture guards.

The explicit `simulator-db` operations diagnostic runs the disposable Supabase
stack on a native GitHub runner via `diagnose/simulator-db/**`. It applies fresh
migrations221–225, checks inert controls and security, runs the strict browser
fixture preflight and targeted rollback SQL/isolated GPS clone regressions. Its
exact-source [run43560119545](https://github.com/falmata-tech/loadgistic/actions/runs/43560119545)
passed native startup, all five migrations, security/inert controls, synthetic
fixtures, Data API denial and strict browser fixture preflight (one pass, zero
skips). The first SQL suite then found a real source-dependent cross-account duty
denial mismatch; NR-85 records the repair: migration221 now checks active assigned-vehicle
scope before source-dependent work at all three duty entries, retaining the
expected denial and existing lock order. Its SQL matrix expands to36 negative
cases with installation/demo snapshots. Clone cleanup had also assumed creation
started and failed its client-version guard; both workflows now check whether
creation was attempted, retaining partial-create cleanup. Supabase shutdown
passed. Later SQL suites did not run in that first diagnostic. Corrected-source
[run43561193938](https://github.com/falmata-tech/loadgistic/actions/runs/43561193938)
completed successfully on attempt1 at2b575113 in about five minutes. All six
Phone/GPS SQL suites, eleven durable/catalog/paused/profile/Tracking suites,
isolated GPS fixtures and the normal-signup isolation suite passed, together
with startup, migrations/security, strict browser fixture preflight and both
clone and Supabase cleanup. These diagnostics do not replace full PR/main CI,
other unqualified concurrency boundaries or agent-led actual app review. The
selected Capacity/profile two-session checks passed later in43614507599, as
recorded above. See ADR-085 and local setup.

The local container stack remains unavailable in this Cloud workspace. The
checkout-local Docker29.9.3 client is installed; a fresh direct check still
returns permission denied at the standard Docker API socket, and Unix-socket
creation returns `EPERM`. Installing the client does not provide an accessible
daemon. The stopped QEMU workaround proved Engine/hello-world and a separate empty
Docker/containerd store, but never a ready application stack. Its offline import
ended with `unexpected EOF` after three image references loaded; the VM/controller
subsequently stopped holding the disk and the queued diagnostic never ran. The
termination cause is unconfirmed. All fourteen exported Storage layer sizes/digests
match their pinned source, and original/partial stores are preserved. Do not resume
this workaround or treat it as a prerequisite for the app/Netlify work above.

Focused source checks currently pass for the new Netlify adapter, managed branch
bootstrap and diagnostic workflow. The first full unit gate found eleven
failures: an outdated feed mock, a retired Manual-copy assertion and audit/test
catalogs that omitted translations already loaded at runtime. Focused repairs
preserve semantic and localization assertions. The complete `npm run quality`
rerun passes1498/1498 tests, zero failures/skips, specs/source/workflow analysis
and type checks. Independent source review found no material issue in the duty
repair. The selected native SQL regression and the later Capacity/profile
two-session matrix now pass as recorded above. Other required concurrency,
agent-led desktop/phone/Expo review, infrastructure operation,
exact production rollout and installed-device acceptance remain separate and
unqualified. Candidate migrations221–225 have not been applied
to production. Production settings and the SMTP verification pause remain intact.

## Active priority — GPS gateway and signal simulators

The owner's next priority is the GPS gateway and separate dedicated capacity and
location signal simulator services, with periodic phone/GPS verification across
the backend, database, Realtime and UI, followed by a tested production rollout.
This work is in progress. Source now removes new Manual location controls on web
and native while retaining honest, dated legacy reads. Backend retirement,
trusted Demo account projection, normal-signup isolation and explicit holds for
Manual-dependent simulator lanes are being qualified together. Real and synthetic
GPS projects have separate deployment manifests and private readiness checks;
the bounded hosted enrollment connection is implemented but not runtime-qualified. These source
changes are unmerged and not deployed. The verified PR37 baseline below does not
qualify this feature or its service runtime.

The local candidate is on `feat/scenario-driven-demo-signals`, based on the
unchanged published520328b. Its131 focused simulator/provenance/auth/worker tests
pass with zero skips; source/spec/whitespace checks pass. Pending migrations221–225
retire new Manual writes, project trusted Demo account provenance, hold historical
Manual-dependent lanes, install the fast catalog and close demo organization
ownership gaps. Ordinary co-owners, human edits and REAL source takeover refuse
further simulation. Fast/profile control locks preserve in-flight save ordering;
these source checks do not prove actual concurrent database behavior. No new SQL,
service, secret or activation has been applied to production. The selected native
SQL/normal-signup cases and the selected ten native Capacity/profile races now
pass. Actual changed images/UI, other lanes' concurrency where required and
infrastructure/device operation remain to be qualified.

The dedicated movement worker and workflow simulator are currently disabled in
production; read-only inspection found no registered gateways, devices or saved
GPS positions. Existing historical phone/manual reports do not prove a running
GPS service or recurring simulator. Public Capacity currently uses 60-second
visible-page polling, not push Realtime. Hosted operation and physical tracker
acceptance remain separate, outstanding evidence.

The owner's subsequent instruction makes visible early-user activity the
priority: the candidate targets 30-second synthetic source reports, authored
Capacity phases about every two to three minutes per demo vehicle with staggered actors,
and 15-second foreground feed reads. Actual phone capture/background intervals
are unchanged. A separate Capacity-only Netlify function replaces dependence on the
15-minute dispatcher for this fast lane. Its minute schedule advances at most two
due actors. The optional30-second container advances only one and must be stopped
before Netlify is enabled. Neither path catches up missed phases or saves all five
actors together after an outage. Slow profile/team/sharing lanes keep their separate cadence
and activation prerequisites. Jobs must resume one valid next step after interruption,
without bursts, skipped prerequisites or backdated observation times.

The [scenario design contract](operations/SCENARIO_SIMULATOR_DESIGN.md) and ADR-084
define versioned approved routes/states, rather than arbitrary city combinations
or random field values. Offline source verification produced seven local mapped
road courses, two explicit stationary Radius cases and one unavailable course
which stays blocked. These are synthetic protocol courses, not full regional
market journeys. [Road catalog provenance](../resources/fixtures/demo-road-catalog.README.md)
records the source hashes, geometry and privacy limits. Runtime/SQL/UI and hosted
acceptance remain pending; these data checks do not establish active movement.

## Native Android testing — APK complete, device session pending

The owner requested an agent-controlled Android VM/managed device for actual
mobile workflow and parity review. The [Android device runbook](operations/ANDROID_DEVICE_TESTING.md)
prepares one Genymotion Android15 ARM64 device in connected Chrome, with a
60-minute provider stop limit. Current advertised usage is $0.06/device-minute
($3.60 before tax for 60 minutes); the proposed $5 usage ceiling/account setup
has not been approved or purchased. No cloud device, API credential or
managed-device upload was created. The completed test APK has been saved for
handoff; it has not been installed or launched on a device.

Offline CNG and a fresh Android Hermes export passed for `com.loadgistic.app`
1.2.0/code10. The final native input freeze includes the 15-second feed lifecycle
and stable-vehicle selection changes. Current mobile gates pass 426 tests with
zero failures/skips, clean types/lint, 796 translations and the 3,751-module export.
The isolated full JDK 21/SDK 36/NDK/CMake/Gradle 9.3.1 toolchain is installed and
verified. The bounded, single-worker ARM64 standalone build used a
new disposable local test signer; no existing owner key was used. The completed
non-debuggable release-variant APK is 59,110,117 bytes, SHA256
`a7f4e3609e3be8ea9eaa1f4ff0aed8581aea99ecd3d7c2a734279600a1c7b441`.
Packaged-bundle/source-map and native config/asset/lock checks establish executable
input equivalence with `4b7af44b772d92b7c56024613fba7b1a766340aa`; its creation
base 520328b/dirty-input freeze remains a separate receipt. Static qualification
verifies the signature, ARM64-only ABI, minSDK 24/targetSDK 36, all 8 required/zero
forbidden permission checks and 16KB ELF/ZIP alignment. This test signer does not
make the APK Play-ready. MapLibre Native 11.5.0 and attributed OpenStreetMap tiles
are configured; rendered maps and GMS/FCM operation still need device evidence.

The first build failed after 654 seconds while resolving AndroidX AAR dependencies:
official Google Maven HEAD requests returned403, before an application compilation failure was
established. Fresh same-URL HEAD/GET and Java TLS/proxy diagnostics returned200.
A second attempt exposed a task-local Ninja wrapper defect, corrected and tested
against actual ARM64 CMake/restat commands. The third attempt compiled native
libraries, app Java/Kotlin, Hermes, resources and dex, then reached its1200-second
limit during required release lint analysis. Its cache and distinct failure
receipts are retained; the original403 origin remains unconfirmed. The approved
600-second incremental continuation completed in 238.851 seconds with all required
release lint, signing, packaging and assembly checks retained. Build-process
shutdown and cache-lock receipts released the native resource window; current
database runtime status belongs to its ignored resume/active receipts. Native
startup, permission/background-location and notification acceptance remain outstanding.

Current phone Capacity checks each60seconds but captures only when Home is
focused/foreground and 10 minutes are due. Agreed Tracking has a separate native
background service requesting 10-minute fixes. Native tests must verify those
actual boundaries, database observation/receipt times, privacy and web/native
updates rather than claiming continuous reporting from the interval constant.

Connected Chrome inspected the existing published PR37 provider market at
390×844: mobile navigation, the filter sheet, applying Empty vehicle and clearing
it worked; viewport override was reset afterward. This was a read-only inspection
in the owner's existing account, with no account/location/capacity mutation. It
qualifies that older phone-web surface only, not the changed local UI or native
Android. Current local visual/workflow review still depends on the new stack.

## Verified delivery baseline — PR37 published

[PR37's final qualification and production receipts](https://github.com/falmata-tech/loadgistic/pull/37)
supersede the preparation checkpoints below. PR37 merged as
`520328bd61c70a7d278fd183c6a25ffde248ab7a`; its PR CI43358107986 and separate
[main CI43374713806](https://github.com/falmata-tech/loadgistic/actions/runs/43374713806)
each passed all 16 required jobs. [Source workflow43378172030](https://github.com/falmata-tech/loadgistic/actions/runs/43378172030)
advanced production and confirmed the ref at that exact SHA. The automatic
[Production deployment6af6ac945eb1cff1d55e577c](https://app.netlify.com/projects/loadgistic-473/deploys/6af6ac945eb1cff1d55e577c)
is Published: source verification, mailbox_fields=2, all 8 final function ZIPs and
secret scanning passed. Canonical/immutable health, images and public Chrome
tasks passed; `6af4f16a16aab2cef815c573` remains the rollback target.

PR37 also records later unchanged-source local quality: 1,377 root and 424 mobile
tests passed, alongside types, lint, translations and the web production build.
Those results do not relabel older timings or establish fresh authenticated,
private-file or physical-phone acceptance.

Local Docker has since progressed beyond the rootless-host limitation:
task-owned QEMU 10.0.13 / Alpine 3.24.4 runs Engine 29.9.3 through mTLS; a no-certificate
request is denied and the official hello-world container exits 0. Full local
Supabase/Auth/Storage/mail, fixtures and browser qualification remain pending.
Current process status is recorded in the ignored runtime resume/active receipts,
not in a permanent session number. Captured container events correct the earlier
startup inference: Realtime's schema/seed/health job exited0; the next
Storage1.67.20 setup container exited255. PostgreSQL's137 came from subsequent
CLI cleanup, with no observed OOM event. A network-disabled, built-in-only Node
probe in the cached Storage image also exits255 with
`exec /usr/local/bin/node: input/output error`, before application/database code.
All 14 raw image layers pass compressed SHA/CRC and uncompressed DiffID checks.
Their resolved musl loader is 666,216 bytes, while the original and never-started
container materializations contain a regular zero-byte loader. This establishes
a local image/cache materialization discrepancy; physical I/O damage and an
application defect are not established. Supported public-image export and an
isolated fresh Docker/dedicated-containerd recovery are being prepared; recovery
has not completed. Migrations 221–225, local SQL/UI acceptance and production
activation remain pending. No candidate migrations or fixtures have run. Fresh
read-only hosted
inspection confirms ledger219/max220 and all eight installed-function pins used
by the candidate. The existing advisor categories remain unchanged.
Use the [restricted local Docker setup](operations/RESTRICTED_LOCAL_DOCKER.md)
for that separate dependency; container startup is not full application readiness.

The owner paused Google verification for the proposed
`loadgistic.support@gmail.com` sender migration. Existing production SMTP/Auth
settings, credentials and mailbox scan policy remain unchanged. The separate
strict advisor monitor still lacks its scoped credential; its two known WARNs
remain visible. Google-key hardening and native/device acceptance remain separate
open work. Reuse the completed source-bound receipts above when resuming.

## Historical mailbox checkpoint — before PR37 qualification

[PR36](https://github.com/falmata-tech/loadgistic/pull/36) merged normally as
ab899497befdcf5e699cb436de41c4bdb449fb63/tree5f86efd9a3a6104d73956def8ab03f33ef41668c.
[PR CI43348321656](https://github.com/falmata-tech/loadgistic/actions/runs/43348321656)
and separate [main CI43352081887](https://github.com/falmata-tech/loadgistic/actions/runs/43352081887)
each passed all16 exact required jobs on attempt1. Main's12 isolated Supabase
starts passed with the reservation guard. The independent Operations proof and
earlier admin focus each passed three desktop/three phone repetitions, no retries
or skips. PR36 preview6af66dd67c93c0214a4ce0fa verified all8 final function ZIPs
on adapter5.16.6, zero private entries, and passed scanning2257 files.

[Source workflow43355866914](https://github.com/falmata-tech/loadgistic/actions/runs/43355866914)
created/read back production atab899497 using its short-lived Actions token.
The actual Git webhook triggered production6af67d14b459c7cc43f7212c. It failed
before application build with NETLIFY_MAILBOX_REVIEW_REQUIRED; no new production
publication occurred. Old6af4f16a16aab2cef815c573 remains live/rollback, with fresh
health200/ready and no blockers. Automatic transport is observed; successful
automatic publication/runtime is not yet established.

NR-80 identifies the source bug: the SMTP-user digest included Markdown's opening
backtick, and its test repeated that parser/digest selection. Removing that one
formatting byte yields the already-reviewed bare Reply-To digest. The repair
binds both named fields to that exact bare identity, uses independent Markdown
and JavaScript literals/real CLI tests, and requires both fields in production.
Configured formatting/whitespace/case changes still fail; values are not trimmed
or normalized. Focused local tests pass15/15. Pinned Node22.16.0 full quality
passes1,377 tests, zero failures/skips, types/spec/source and actionlint/ShellCheck
for113 scripts; unit38.46s. An isolated actual-CLI comparison proves ab899497's
guard rejects the same bare inputs that the repair accepts with mailbox_fields=2,
without printing either value. Exact PR/main/provider qualification remains next;
final provider/runtime receipts belong in the repair PR.

Provider secret values are not readable in the UI/API/CLI. The inspected edit
forms were cancelled without saving. No diagnostic branch, publishing pause,
mailbox/SMTP value/scope change or scanner waiver was applied. Netlify remains
production branch production, main alone tracked for previews, auto-publish ON,
untrusted previews require approval, private production scopes retained. The
seven-day/project-only/two-read-capability advisor proposal is prepared in tab29,
with the empty named GitHub secret form in tab30; no token was created/stored.
Fresh hosted readback02:52UTC remains ACTIVE_HEALTHY,0 ERROR/2 WARN/1 INFO.
The strict monitor is unchanged. Local Docker is still unavailable; application,
native, schema and runtime source are unchanged. Earlier browser/private-byte
receipt limits below remain explicit.

## Historical port-reservation checkpoint — before PR36 qualification

[PR35](https://github.com/falmata-tech/loadgistic/pull/35) merged normally as
63cbb868b6521e2c02a94e893013eaaa847ef3b5 after all16 exact-head jobs in
[CI43340452362](https://github.com/falmata-tech/loadgistic/actions/runs/43340452362)
passed. Its actual Netlify preview6af65f2dee0414fbc504e277/adapter5.16.6 verified
all8 final function ZIPs before deployment. Main/tree readback matches the
qualified tree683324acaf01b19864794b3f47e002f69ddb3ae5.

Netlify production branch is now production, saved and independently read back;
main alone is additionally tracked for non-production branch builds and PR
previews. Without that tracked base, Netlify stopped creating previews for PRs
targeting main. This narrow correction is saved/read back; untrusted-preview
approval, private production environment scopes and automatic publishing remain.
Arming before first ref creation lets the real qualified push
exercise the Git webhook. Every source/CI gate remains enforced. Old published
6af4f16a16aab2cef815c573 remains live and rollback; no new publication occurred.
Main CI43344733398 then failed Featured team setup/job131624126011 before any
migration. Retained diagnostics show a normal exit1,76.176s,19,128 stderr bytes,
containerStart/portConflict true, and no migration/process/capture error. The
exact port and binding owner remain unisolated; no flaky claim or blind retry.

NR-79 adds early fixed-port reservation only on disposable GitHub-hosted Linux
runners, preserving all previous reservations and verifying the exact union.
It excludes55320–55329 from automatic allocation before dependency/container
network setup. Unknown listeners are never killed and retry rules stay unchanged.
Safe startup diagnosis names only reviewed local service enums. The ephemeral-
allocation actor is a prevention target, not an established historical cause.
Local pinned Node22.16.0 quality passes1,374 tests, zero failures/skips, types/
spec/source checks and actionlint/ShellCheck for113 scripts (unit36.49s). The
fake-kernel entry integration changed only a disposable test file, not this host.
Actual hosted [focused run43346969178](https://github.com/falmata-tech/loadgistic/actions/runs/43346969178)
on4b17173f passed reservation/readback, startup, catalog/API checks and all three
independent desktop/phone repetitions, zero skips/retries. The following doc-only
reconciliation changes no tested executable input. Exact-source PR/main and real
production handoff/runtime qualification remain pending; their final receipts
belong in the PR release record rather than another status-only CI commit.

Supabase dashboard sign-in succeeded through the owner's secure GitHub choice.
The project-only seven-day token with Project Settings Read + Advisors Read is
at final provider review; it is not created/stored and still requires action-time
confirmation. The strict monitor stays unchanged; fresh metadata gives zero
ERROR/two WARN/one INFO. Public Data API denial passed all3 probes. Production
health after branch arming remains ready/no blockers with the existing warnings.

Application/public/function source, root dependency/lock, Next/Node and build
inputs match886691b across891 Git entries. Prior November11 authenticated/private-
byte and desktop/phone review is retained in the history, not relabeled as a fresh
login. Current cloud Chrome exercised old-live public filters/details/Featured/
private sign-in denial; images384/640 and guest private photo/proxy denials pass.
The qualified preview still has a server exception/health503 with private
production-only configuration absent; packaging success is not runtime readiness.
No private credentials were copied into previews. Docker remains unavailable here.
The existing high-zoom/short-height map issue and lack of fresh portrait/native
review remain recorded in PR35. No product/schema/native/Google/Auth change.

## Historical gate preparation — before provider activation

PR32 is merged as `c957a60e6fe491c52a34f99c92037e7f06df3347`.
Its [PR CI43292221647](https://github.com/falmata-tech/loadgistic/actions/runs/43292221647)
and [main CI43298031258](https://github.com/falmata-tech/loadgistic/actions/runs/43298031258)
each passed all16 jobs. The separate
[focused proof run43292221500](https://github.com/falmata-tech/loadgistic/actions/runs/43292221500)
passed three desktop and three phone tasks with zero skips/retries. The original
failure did not recur; its cause remains unisolated. The diagnostic gap is repaired
and qualified, without weakening image-byte/privacy assertions or classifying
the historical failure as flaky.

Current Netlify production remains the manual scheduler deployment below.
Automatic [main build6af61dc3ec2aa1b4a433776c](https://app.netlify.com/projects/loadgistic-473/deploys/6af61dc3ec2aa1b4a433776c)
for c957a60 failed scanning. Its current log names `LOADGISTIC_SMTP_USER` in
recorded mailbox identities and the Android client file; earlier attempts also
named `LOADGISTIC_EMAIL_REPLY_TO`. Values are omitted.

Later signed-in Chrome inspection matched the Android key to source by SHA-256.
It has a25-API allowlist, including Firebase-related APIs, and **no application
restriction**. No Generative Language API is selected. The app-restriction gap
and unused APIs need their own certificate/compatibility review; no key setting
was changed. Firebase plugin installation remains declined.

The merged PR33 source adds byte/value-locked scan exceptions and a
delivery workflow that advances `production` only from a complete successful
current main run. Netlify independently checks that same source through public
read-only GitHub metadata before a production build. Missing metadata, wrong
branch/source, failed CI, changed client bytes or mailbox values fail closed.
The read-only dry run verified actual c957a60/all16 jobs and reported that it
would create production; **no reference was written by that dry run**.

Activation and exact provider fields are in the
[release runbook](operations/NETLIFY_RELEASE_VERIFICATION.md#reviewed-delivery-correction-and-activation).
Source preparation, PR/main CI, provider activation and real publication remain
separate evidence. The scoped Supabase token is prepared at its final review:
project tpwyyzoqijjmbvsmmvcm only, Project Settings Read + Advisors Read, seven-day
expiry. It has not been created or stored. Creating a credential requires the
owner's action-time confirmation. The strict monitor's existing WARN findings
are not waived by provisioning access. Docker remains unavailable here.

## Completed Operations proof diagnostic follow-up

Housekeeping PR31 merged as `c33221845fa68ada66927b4409ecc24464bc5478`
after all16 PR checks passed. Obsolete release-record PR27 is closed as
superseded, with its original history preserved. The merged Git tree is the same
reviewed tree; no application artifact was republished.

Post-merge [main CI43275978371](https://github.com/falmata-tech/loadgistic/actions/runs/43275978371)
failed one desktop Operations single-proof case in shard4 (76 passes,27 reviewed
skips,1 failure). The other13 substantive jobs passed; E2E/release-ready correctly
failed. The runner kept only the wrapping helper at line100 and discarded the
original source/checkpoint evidence. No diagnostic artifact was uploaded. The
underlying cause is unisolated; no flaky classification or blind retry is claimed.

PR32 retains only validated typed proof checkpoints and the
original failure site, with negative tests against private/malformed output. A
separate focused CI workflow runs the same synthetic proof task three independent
times on desktop and phone with zero retries, local-only Supabase and ordinary
catalog/API checks. It cannot substitute for the unchanged full release matrix.
No application, authorization, image-content assertion or timeout is relaxed.
Local browser replay remains blocked by unavailable Docker; the successful
focused and full runs above supply isolated runtime evidence. The original
cause remains open if it recurs. BASE-DEP-001 / NR-76 own this boundary.

The merged Netlify automatic build
[6af5ff9d5f8c5d65281778b4](https://app.netlify.com/projects/loadgistic-473/deploys/6af5ff9d5f8c5d65281778b4)
failed the same reply-to and Firebase client-configuration scan; Deploying was
skipped. Manual6af4f16a16aab2cef815c573 remains published. Post-merge live health
and public Capacity return200; private workspace/photo endpoints return401.
At that checkpoint Firebase installation was declined; the later Chrome review
above supplies its restriction readback. No hosted key setting was changed.
Scoped advisor credentials and
a Docker-capable development environment remain open prerequisites.

## Completed documentation housekeeping

The owner requested local setup, actual browser use, pipeline inspection and
reconciliation of recorded versus implemented/released work. Merged PR31 changed
documentation only. It changed no application behavior, dependency lock, migration,
production setting, secret, signing key or published application artifact.

### Verified source and checks

- Repository `falmata-tech/loadgistic`, default branch `main`, baseline
  `c9260926cbd5ccb3f69b27ab2aac057f2a877b94`. Housekeeping uses a short task branch.
- Baseline GitHub [CI43119585046](https://github.com/falmata-tech/loadgistic/actions/runs/43119585046)
  succeeds on all 16 jobs: validation, mobile boundaries, container, all eight
  ordinary browser shards, three isolated Featured jobs, E2E and release-ready.
- Fresh local `npm run quality` on pinned Node 22.16.0 passes 1,334 tests,
  zero failures/skips, specs 45/features 42, source 766 and TypeScript. The unit
  portion took 43.778s. The separately installed, checksum-verified actionlint 1.7.12
  and ShellCheck 0.11.0 pass workflow analysis of 108 operational scripts.
- Fresh mobile Node 24 gates pass typecheck, lint, 424 tests with zero failures/skips,
  and strict translations 802/802. These are source gates, not installed-phone proof.
- The optimized web build passes (164 static pages). Existing CSS alignment
  warnings remain; compilation does not qualify an authenticated workflow.
- `886691b..c926092` changes only two documentation files and
  `tests/e2e/unified-capacity.spec.ts`; application/native/runtime inputs are
  unchanged. This Git comparison does not independently compare hosted ZIP bytes.

### Production and deployment pipeline — independently inspected November 12

| Boundary | Actual state | Limit / next action |
| --- | --- | --- |
| Supabase | `tpwyyzoqijjmbvsmmvcm`, `loadgistic`, ACTIVE_HEALTHY, eu-west-1; 219 migration entries through 220 | Do not replay 209–220 because an older checklist says 208. Ledger presence is not every function's execution proof. |
| Database catalog | Zero public tables missing RLS; zero browser-accessible application relations; zero unexpected browser-callable definers; zero first-party functions missing search_path | Metadata-only read in a read-only transaction; live role/write regression was not rerun. Caller-bound `current_user_projection()` remains the explicit authenticated exception. |
| PostGIS |3.3.7 in `extensions`; no `public.spatial_ref_sys` | Earlier provider-repair proposals are history, not unfinished current repair. |
| Security advisors | November 12 read: 0 ERROR, 2 WARN; informational service-only RLS/no-policy notices remain | Identity-function execution and leaked-password warnings require explicit disposition; no blanket security clearance. |
| Health/performance advisors | Health has no notices. Performance reports 58 Auth/RLS init-plan and 48 multiple-policy warnings, plus informational indexes/connections | A warning inventory is not a demonstrated app slowdown; inspect the applicable query before proposing a change. |
| Daily security monitor | [Run43155032336](https://github.com/falmata-tech/loadgistic/actions/runs/43155032336) advisor job fails before reading findings: scoped token missing; independent Data API guard succeeds | Owner provisions only the approved project-scoped Settings Read + Advisors Read credential. ChatGPT's Supabase connection does not populate a GitHub secret. |
| Protected main | Browser readback: PR required; strict `release-ready`; conversation resolution; administrator bypass forbidden; force-push/delete disabled; approving review requirement off | No independent second-human approval is claimed. No protection was changed. |
| Netlify continuous deployment | Repository reference present, build Active, production branch main, only production-branch deploys; **automatic publishing is ON** | Recent Git-triggered production and preview builds are blocked by secret scanning. A repository label saying manual does not describe the entire pipeline. |
| Latest automatic main attempt | [Deploy6af4f92d516c70141eddfe3a](https://app.netlify.com/projects/loadgistic-473/deploys/6af4f92d516c70141eddfe3a), source c926092, fails secret scanning | See NR-75 below and the [deployment runbook](operations/NETLIFY_RELEASE_VERIFICATION.md). A green GitHub check does not make this Netlify build pass. |
| Published web | [Deploy6af4f16a16aab2cef815c573](https://app.netlify.com/projects/loadgistic-473/deploys/6af4f16a16aab2cef815c573) independently shows Published / Production, titled scheduler consolidation 886691b | Automatic main failure did not replace it. The title identifies the recorded source; this inspection does not compare the hosted ZIP bytes. |

Netlify's current developer settings show `npm run build`, base `/`, publish `.next`,
functions `netlify/functions`, public build logs, all deployment methods allowed,
and untrusted fork previews requiring approval. UI dependency selection shows
Node 24.x while checked-in `.nvmrc`, package engines and `netlify.toml` select 22.
The failed automatic build's initialization log resolves Node 22.16.0 / npm 10.9.2,
so that UI selection is not evidence of build-version drift. The published
artifact's runtime remains a separate release check. No setting was changed.

The source CI has no Netlify promotion job, and Netlify auto publishing has no
observed wait for main's same-commit `release-ready`. PR protection and production
promotion are distinct. Before repairing automatic publication, review both its
scan findings and the owner/exact-source release boundary; do not silently change
production authority or turn scanning off. See NR-75.

### Secret-scan blocker — diagnosis, not a waiver

The failed build reports `LOADGISTIC_EMAIL_REPLY_TO` matches in three dated
operational documents and the telematics manifest/tests. A second likely-secret
finding points to `apps/mobile/google-services.json:18`. Source inspection confirms
that JSON is the intended Android Firebase client configuration for
`loadgistic-f082a` / `com.loadgistic.app`, with one client API key and no service
account/private-key fields. Values are not copied into evidence or this document.

The email is a mail-header configuration value, and a Firebase client API key is
not a private FCM credential. These classifications alone do not prove correct
Google API/application restrictions. Review the exact client key restrictions
before authorizing a narrow exception. Do not alter synthetic identity allowlists,
remove security assertions or omit entire docs/scripts/build trees to pass a scan.
No exception, credential rotation or production environment edit was applied.

### Local environment and actual browser review

- Installed locked root/mobile dependencies, checksum-verified Node 22.16.0,
  Supabase CLI 2.111.0, actionlint 1.7.12 and ShellCheck 0.11.0 in this checkout's
  ignored cache. The mobile runtime is the provided Node 24.22.1. No global tool,
  owner setting or other project was modified.
- Node 22's initial workflow-tool download did not use this workspace's proxy.
  A command-scoped Node 24 proxy-aware bootstrap installed the exact pinned archive;
  the normal Node 22 workflow check then passes. No TLS/checksum check was disabled.
- **Full local backend is blocked:** this execution environment has no Docker or
  Podman executable/daemon. The pinned CLI reports
  `LegacyDockerLifecycleInspectError` / `docker: command not found`.
  Rootless prerequisites `newuidmap`/`newgidmap` are absent too. No hosted key was
  copied locally and no alternate/mock database was substituted.
- Therefore local fixture import, authenticated web/Expo saves, SQL, scale and
  browser E2E are not qualified here. Bring up the documented isolated Docker
  stack before calling the local development environment ready for product work.
- The Next development server starts on 3100, but a same-process HTTP probe
  returns 500 / `SUPABASE_PUBLIC_CONFIG_MISSING` in session middleware because the
  blocked local configurator has not generated its public settings. This is not
  a ready API or authenticated application. No placeholder key was invented.
- The cloud browser's loopback is separate from this execution workspace and
  returns connection refused for that URL; no local Chrome acceptance is claimed.
  Expo's first startup hit unavailable network-interface enumeration. A
  command-scoped `EXPO_UNSTABLE_BONJOUR=0` permits startup and HTTP 200 HTML by
  disabling only local discovery advertising. This is not actual bundle/screen or
  saved-task acceptance. It changes no app permission or production setting.
  The bounded startup probes stop their own processes afterward.
- Actual Chrome on the live public site passes Capacity load, Empty filter apply,
  selected-vehicle focus, Vehicle details open/close, Back to map, and the private
  Capacity redirect to account sign-in. No account, OTP or business write was used.
- Featured renders eight provider accounts with 10:30PM–11:59PM EAT timing and a
  schedule control. English, Oromo and Amharic headings render. The Scheduled badge
  remains English in the two translated views; this is a bounded copy follow-up,
  not proof of complete localization or fluent-speaker review.
- These are desktop public tasks. No phone viewport, authenticated role journey,
  native camera/background/notification, Play track or real tracker was exercised.

## Released work versus remaining qualification

The October 27 release record is in
[historical PR27](https://github.com/falmata-tech/loadgistic/pull/27), closed as superseded by housekeeping PR31. Its ledger 220 statement is independently confirmed above.
It records the approved 209–220 rollout and web deploy 6ae129c4d2c21b0956250e05,
now the November 11 release's documented rollback target. Its private restore,
permission-parity and synthetic photo receipts are not in this fresh clone and
were not recreated. The preserved historical checklist keeps the earlier failures.

| Area | Current conclusion |
| --- | --- |
| Account Network/private Capacity | Account-bound sharing is current source/schema. Email-only Capacity OTP is retired. Public-link Tracking keeps separate email authorization. |
| Provider discovery and offer matching |209–217 are recorded on the hosted ledger; the historical local-only rollout labels are obsolete. New private-workflow and full filter-matrix acceptance still need their own runtime evidence. |
| Featured | Account rotation and 210 evening window are installed. Today's live public page independently displays eight accounts and the evening timetable. A scheduled programme is not a confirmed running TikTok broadcast. |
| Reported free space / cargo photos |218–220 installed. PR27 records a synthetic hosted API upload/read/remove test. Physical Android camera, current role journeys and scheduled physical-object cleanup are separate. |
| Busy native buttons | Current Button retains its action label and busy/disabled state. All three locale regressions pass in the 424-test run. WEB-MOB-047's deferred-source status was stale; physical assistive-technology acceptance is not claimed. |
| Android | Source corrections and current gates are real. 1.2.0/code 10 artifacts, prior emulator/phone receipts and store builds are different candidates. Requalify exact installed owner/admin/staff, invitation, Back, camera, permissions and recovery before signing/testing-track delivery. |
| GPS/demo workers | Source/schema are present; registration, controls, hosting, observed movement and hardware qualification are separate. No always-on hosted simulation or engine capability follows from migration presence. |
| Commercial plans/payments | Planned; no enforced subscription/payment workflow. Do not restore retired billing gates. |

## Next ordered work

1. Diagnose and qualify the Operations proof boundary using safe evidence and
   isolated CI. Housekeeping PR31 is merged; publication and remaining provider
   changes retain their own exact-source/security prerequisites.
2. Review exact Netlify scan findings, Google client-key restrictions and the
   same-source promotion gate; prepare a narrow owner-reviewed correction and
   qualified preview before any production publication. Keep scanners enabled.
3. Restore unattended advisor monitoring with the approved scoped credential,
   then record its actual run and current warning disposition.
4. Provide a Docker-capable local environment, start the isolated stack and
   complete normal synthetic-account browser/Expo transactions and SQL/scale gates.
5. Resume exact installed Android qualification and remaining broker filter
   combinations, then separately review Play delivery and hosted GPS/demo rollout.

Eight open dependency PRs need compatible, individually verified review; none
was merged or upgraded by housekeeping. The seven-day post-November 11 Netlify
usage comparison is not due yet; invocation estimates are not paid savings.

Owner-only production authority and exact artifact/backup/rollback controls in
[AGENTS](../AGENTS.md) and [PRODUCTION_AUTHORITY](PRODUCTION_AUTHORITY.md) remain.
The current Netlify automatic path is an installed-state discrepancy to resolve,
not permission for the agent to promote an unreviewed change.
