---
id: FEAT-CAP-001
title: Public truck-capacity signals and provider publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-FLT-001, FEAT-GEO-001, FEAT-MAT-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-SHR-001]
problem: Capacity seekers need immediate, public, location-relevant truck discovery while transport providers need a small set of honest availability signals they can keep current.
behavior: Providers publish one latest Empty or Partial signal with public or explicitly shared account visibility. Planned and Preferred routes/areas are OR availability offers within the same vehicle, permission and status filters; reported approximate location is separate. Both statuses support Area or Route. Area queries compare advertised routes and areas; older visible signals carry honest capacity/location ages for either audience. Migrations211/213/217 implement these corrections locally; hosted rollout is pending. No email guest Capacity or exact-coordinate disclosure is supported.
contracts: [CurrentCapacitySignal, CapacityStatus, AvailabilityGeometry, CapacityPlaceSequence, CapacityAreaBoundary, RegularCapacitySignal, CapacityFreshnessStage, CapacityFreshnessPresentation, PublicCapacityProjection, PublicMicrositeTruckProjection, CapacityCursorPage, VisitorLocationQuery, CapacityMapProjection, CapacityProof, DutyCommand]
observability: [capacity_audit, capacity_route_audit, public_capacity_query, cursor_outcome, location_query_outcome, freshness]
rollout: Replace all pre-customer demo radius and endpoint-only route fixtures with multi-city Service areas and Capacity routes, keep no compatibility projection for the retired demo geometry, and move provider publication through additive server-only Supabase RPCs before enabling managed traffic. Roll back by disabling capacity mutations while preserving the append-only capacity and audit history; never fall back to SQLite while the managed backend is selected.
---

# Public truck-capacity signals

## Map update and cluster stability — October25 repair in progress

Given an already loaded Capacity result receives progressive pages or refreshes\
When updates belong to the same still-authorized query scope\
Then intermediate pages do not temporarily remove an existing selection or
make its camera repeatedly reset\
And the completed result replaces obsolete vehicles without reducing eligible
coverage or adding a manual loading step\
And changed account, audience, permissions or filters cannot reuse another
scope's snapshot; explicit denial clears protected content.

Given a cluster expansion query, map movement or initial data load is pending\
When a newer gesture, selection, source revision or navigation supersedes it\
Then the stale callback cannot move the camera or restore an obsolete selection\
And initial centering does not override a user's later pan/zoom\
And stable vehicle identities and unchanged input yield stable clustering while
actual new locations and membership changes still reach the map.

Verify real desktop/phone web, affected Expo/native maps, selection/Back and a
larger local vehicle set. Preserve current appearance and automatic behavior;
do not solve performance by capping results, hiding supply, extra confirmations
or a new user-facing loading mode. Source races are identified; runtime and
stress qualification remain pending.

## October 21 filter and posting hierarchy — presentation-only

### October26 Planned Capacity and Preferred Corridor — presentation locally qualified

Planned Capacity is the vehicle's current/next-work offer: its Empty/Partial
status, accepted loads and one Area or ordered Route. Preferred Corridor is the
separately saved regular two-way route for the current vehicle/driver pair;
its Area variant is called Preferred area. Neither is a booking or a reported
vehicle position. This clarification adds no date scheduler or multi-plan model.

Given a provider edits or someone inspects these signals on web/native\
When their controls, saved facts, map layers or result reasons are shown\
Then the offer is named Planned capacity, with Planned area or Planned route
where geometry matters, while the regular signal is Preferred corridor/area\
And current load status and GPS/phone/manual location retain separate meanings\
And concise headings, distinct existing styles and clear actions carry the
explanation rather than adding paragraphs to dialogs.

Given a vehicle has Planned and Preferred coverage\
When Area or Route search matches either complete offer\
Then existing public/private/account/business matching returns it once\
And both endpoints must belong to one complete offer; other filters remain AND\
And there is no new Planned-only/Preferred-only source switch by default.

Given saved authorized coverage exists but no reported location is available\
When the provider opens My capacity\
Then its saved Planned/Preferred shapes are visible on a fitted map\
And no vehicle position marker, GPS/phone source or uncertainty circle is
invented at a coverage city. A genuinely empty coverage/location state retains
its existing useful setup action.

Backend compatibility: existing `capacities`, `current_*`, `availability_geometry`
and PUBLISH describe Planned Capacity; separate regular-service commands and
`profile_routes` describe Preferred coverage. Legacy `currentArea*` query fields
are search geography, not a Planned-only filter. Keep these wire/storage names,
authorization, one regular signal per current pair, source age and hidden-geometry
rules. Backend result reasons and both client presentations must use the same
new terms; return only already-authorized geometry facts.

Verification: covered renderer/editor, geographic matcher and installed SQL
offer-union/privacy regressions pass. Chrome/Expo read/open/Cancel qualifies
Planned/Preferred controls and selected-map/profile facts; en/am/om phone-fit
proof covers Home/Fleet controls. Saved capacity, location and assignment facts
were unchanged for that review. Actual selected public coverage was Planned area
plus Preferred area; visible profile Planned route/area facts were inspected.
Other geometry combinations, hidden coverage and fitting without a reported
point have source-executed regressions; actual actors had reported locations.
No save or location-removal cycle was staged for the terminology review.

Current R3 source gates, strict translations, Android JavaScript export and the
compiled web build pass for the same1,856 inputs. Public freshness is locally
qualified with the bounded helper; direct Expo profile proof is only Oromo320,
with earlier captures withdrawn and a hidden Preferred Area web caption covered
by renderer tests only. [Traceability](../TRACEABILITY.md#current-audit-evidence)
owns the exact receipts and current browser limits.

The public provider-profile parity gap is locally repaired by producer-only217.
Its [complete-offer eligibility scenario](#scenario-public-transporter-profiles-share-complete-offer-eligibility)
owns focused PUBLIC dispatcher/fast regressions, full JSON parity, local install/
postcheck, exact recovery and unchanged canonical scale evidence. The first
operator verification failure remains UNKNOWN and preserved; no reapply or
automatic recovery occurred. Hosted installation is pending.

The bounded compiled Chrome walkthrough passes Owner private Empty Area at the
original Route endpoint, private Partial Route, public Partial Area with its
matching provider account, and existing Preferred coverage; Staff repeats the
original Area case. Actual Apply/result/detail/Back/reopen/reload and normal
logout/private401 pass without business writes or membership/permission changes.
Account and vehicle counts remain distinct. The Preferred case overlaps Planned
Area and returns a Planned reason, so it does not independently prove Preferred-
only OR. The complete vehicle/load/source/document/geography matrix and current
Expo filter walkthrough remain unfinished. Earlier save/reopen receipts keep
their source scope. Synthetic positions may advance normally; this final review
does not assert a frozen location snapshot. Later physical/workspace-admin,
static/installed Android candidate qualification, final APK, CI and hosted rollout
remain separate.

### October26 accepted availability model — locally verified, hosted rollout pending

Given a vehicle advertises current and Preferred routes or areas\
When an otherwise permitted search matches any complete one of those offers\
Then the vehicle appears once whether one or several offers match\
And vehicle type, load status, source, reviewed documents and other selected
non-geographic groups still apply with their existing AND semantics\
And no new Current-versus-Preferred search switch excludes an otherwise matching
offer by default.

Given a search specifies both pickup and delivery\
When the advertised offers are compared\
Then both places must match one complete ordered route or one service area\
And a pickup from one unrelated offer and delivery from another do not create
a false route match\
And the existing directional rules and bounded distance tolerances remain
authoritative.

Given a provider publishes Empty or Partial capacity\
When they choose Area or Route\
Then either geometry is supported for either status on web, Android, API and
database publication/matching\
And the same terms, default choice and saved facts appear across clients\
And Area shows service coverage, Route shows ordered stops and direction,
Preferred coverage has a distinct dashed style, and reported vehicle location
retains its actual source and privacy boundary.

Given an older Empty/Partial signal remains On Duty and explicitly shared\
When it is read publicly or through currently authorized private Capacity\
Then both audiences use the same older-until-changed/Off Duty eligibility with
honest age labels\
And private visibility does not silently expire after24 hours while the same
public signal remains visible\
And revoked sharing, wrong actor/workspace, Full or Off Duty remain denied.

Local verification: migration211 permits Partial areas and aligns private
older-signal visibility; migration213 makes Area queries compare route points
as well as area coverage. The pure geographic regression and
`tests/sql/capacity-offer-union.sql` cover public, private-account and business
results, hidden geometry, revoked grants and whole-offer matching. Provider
Chrome saves/reopens cover Empty/Partial × Area/Route; installed Android Staff
Area search finds the existing route vehicle and retains its filter on reopen.
Hosted rollout and final release-APK qualification remain separate pending gates.

The October26 filter presentation supersedes the older four-group order below:
Vehicle first, Area or route second, Vehicle location third, then More filters.
An Area query matches a current or Preferred route passing within its chosen
radius, as well as a current or Preferred service area reaching that location.
Use the same route-point distance rule as a single Route endpoint query; the
query shape must not silently exclude the other advertised offer geometry.
Hidden current geometry remains excluded, explicit legacy geometry constraints
still apply, and vehicle/status/documents/authorization filters retain their
existing AND behavior. Public, private-account and business RPC projections must
agree; a visible route endpoint is a positive Area-query regression case.
Area or route has the same two concise icon-led choices as provider input. Area
search selects a catalog city plus distance and compares all advertised current
and Preferred areas/routes; Route search selects origin/destination plus their
existing ranges/direction and compares complete offers. This is query shape,
not a filter that excludes the other offer geometry or Preferred availability.
Inactive query-shape drafts may be revisited inside the dialog but are not sent
when Show vehicles applies the other shape. No explanatory paragraph is added.
Vehicle location explicitly retains the existing reported-point city/nearby and
GPS/phone/manual filters; it never silently substitutes for advertised coverage.
Existing physical-location links retain their original meaning. Both clients
use these same fields, defaults, active-filter counts and apply/reset outcomes.

Given a visitor opens the Capacity map filters on web or Expo\
When the filter controls are presented\
Then related choices are grouped in this order: Vehicle, Location, Route, More\
And Vehicle type appears before Load status inside Vehicle\
And Location presents a chosen city and distance, then optional device-nearby
search, and location source last\
And Route presents origin and destination before their range, direction and
stop options\
And More presents update age before reviewed-document filters\
And each group has a distinct, accessible icon and a concise localized heading\
And the most-used Vehicle and Location choices are immediately visible while
Route and More can be opened without losing the draft\
And applying or clearing still sends the same canonical values, defaults and
multi-select groups defined below; transporter search remains independent.

October26 wording consistency: the Vehicle type picker uses All vehicle types
for its unfiltered/reset choice, the actual type name for one selection, and a
short localized vehicle-types count for several. It does not mix Vehicle type
with configuration terminology. Web and Android keep existing multi-selection,
draft, reset, icons, catalogue illustrations and canonical API values; no helper
paragraph is added.

Given a provider opens the capacity editor on web or Expo\
When availability is being created or updated\
Then current availability and the accepted load type when Empty are presented
together as one decision, with the load choice immediately beside or below the
current status at every viewport size\
And public and workspace vehicle summaries show the accepted load type beside
the current capacity status when the vehicle is on duty\
And route stops follow the selected route or service area, then who can see the
signal is managed separately\
And related headings use the same concise icon-led visual language on both
clients\
And helper text does not repeat a heading when it adds no further guidance\
And the existing required fields, validation, permission checks, API payload,
save, cancel and first-publication behavior remain unchanged.

This is a presentation change only. Verification is mapped to the focused web
filter/editor and Expo filter/editor tests in `specs/TRACEABILITY.md`; it does
not change search semantics, publication authority, sharing or persistence.

Given a visitor or account member uses any public or workspace screen\
When the interface describes Loadgistic's services or asks what help is needed\
Then it does not present platform billing, payment plans or payment support as
an available product feature\
And a prior support conversation with a retired category remains readable under
a neutral support category without changing its stored history.

## October20 private map height — locally verified and owner approved

Given an email viewer has unlocked private Capacity on a short phone viewport\
When the introduction scrolls away above the map\
Then the workspace reserves the session bar's intrinsic height plus the existing
minimum map height\
And the complete map stays inside its parent and above the fixed navigation,
without clipping its bottom or hiding Log out\
And session text wrapping does not depend on a fixed English-language bar height.

Verification: `tests/e2e/public-map-shell-layout.spec.ts` covers public and
email-unlocked private bounds on desktop and phone, including 320×640 and 390×844.
All four focused Chrome cases pass across 20 viewport/surface combinations,
along with typecheck and source/spec validation. Before/after phone and desktop
captures are retained under
`.local/browser-repair-20261020/private-shell-fixed/`. The owner explicitly
approved the corrected view; the remaining release gates are required before
rollout.

## October20 public map failure boundary — implemented locally

Given valid public Capacity filters reach the repository\
When its read rejects, including a database timeout\
Then the HTTP adapter returns503 with the existing localized message
`Could not finish loading vehicles. Please try again.` and no-store browser/CDN
headers\
And it returns no successful empty result, repository message, cause, credentials
or partial vehicle data\
And malformed filters still return400 before persistence.

This is error containment, not a latency fix or permission fallback. Preserve
the selected filters, map, normal retry behavior and complete successful cursor
pagination. The actual route's `tests/capacity-filter-http.test.mjs` regression
passes5/5; existing browser refresh/retry checks remain required. The separate
179 Driver-cache repair passes local query parity, security and affected Expo
workflow checks (FEAT-MKT-001); full same-source CI/scale and rollout remain gated.

## October18 courier configurations — planned local restoration

The owner restores `Courier car` and `Courier motorcycle` alongside the existing
fifteen configurations. Public/private/business Capacity filters support either
or both using the existing OR-within/AND-across-group rules. Web and native maps,
cards and selectors reuse their existing distinct configuration artwork; an
unknown value remains invalid and never silently becomes another vehicle type.
This changes the supported catalogue, not eligibility, sharing, location source,
radius, assignment, publication or ongoing Tracking authority.

Given a current authorized truck-and-driver pair uses either courier configuration\
When an otherwise permitted viewer filters for that configuration\
Then its actual signal can match the same map rules as other vehicle types\
And selecting both types includes either, while unrelated filters still apply.

Verification: shared catalogue/filter/image and native picker tests, matched SQL
filter/registration/Featured acceptance and actual local desktop/phone review.
Migration168 is reviewed and installed separately; no fixture conversion or
hosted mutation is implied by restoring choices.

### October18 filter-source selection and illustrated choices — local implementation

Given a visitor, verified email viewer or permitted business teammate opens the
Capacity vehicle filters, when they select GPS device, Driver’s phone or Manually
entered, then `locationSource=GPS,MOBILE,MANUAL` carries one canonical
comma-separated OR group and remains ANDed with other truck criteria. Selecting
Any clears only this group. Edits stay in the draft until Show matching vehicles;
transporter profile search remains independent of the map filters.

The owner’s later clarification removes the separate Space needed control from
web and Expo vehicle filters. Opening and applying those filters, including an
older link carrying `loadType`, must not retain a hidden load-size choice. This
does not remove the driver’s accepted-load preference from saved capacity or
vehicle details; existing API callers may still use the bounded load-type query.

Given a pictured configuration picker opens inside a filter dialog, when the
visitor sees the Courier car or Courier motorcycle option, then its actual
configuration artwork loads without requiring an extra selection or scroll.
Closed pickers retain lazy loading; opening the choices may load their thumbnails
eagerly without changing submitted single/multiple selection values.

Verification: focused native draft/encoding/selection tests and actual desktop
and phone Chrome artwork/map checks; backend filtering follows FEAT-MKT-001.

### October21 web and Expo filter parity — local implementation

Given a visitor opens public or authorized Capacity filters on web or Expo
When they choose a city radius, approximate-area radius, route tolerance, stops,
freshness, location source or reviewed document
Then both clients present the same canonical choices, labels and default values
And city distance offers 5, 10, 25, 50, 100, 200 and 300 km, defaulting to 50 km
And approximate-area distance offers 5, 10, 20, 50 and 100 km, defaulting to 20 km
And route endpoint tolerance offers 10, 25, 50, 100 and 200 km, defaulting to 50 km
And the existing multi-select OR-within and AND-across-group query contract is
  unchanged.

Expo may progressively reveal a radius only after the associated location is
selected; the available choices and serialized values must still match web.
This is a presentation/default correction and does not change location privacy,
matching, account scope, map markers or server permissions.

Verification: `apps/mobile/tests/multiple-truck-filters.test.mjs` checks the
shared choices, labels, defaults and native draft contract. Actual Chrome
workflow tests cover web filter drawer behavior on desktop and phone,
transporter search isolation on desktop and phone, web nearby-location privacy,
and Expo multi-option apply/reset plus route/nearby API values. The focused
backend filter-value/SSR/place tests pass. Current desktop and phone captures
are under `.local/product-audit-20261021/filter-parity-review/`. Owner visual
approval and full release gates remain pending.

## October 14 live-truck qualification — implemented locally

FEAT-FLT-001 owns Draft/Live and provider qualification; FEAT-VER-001 owns exact
reviewed relationships. Public and authorized recipient capacity, regular routes,
search matching and Featured require a Live truck and actual current assigned
driver, in addition to existing visibility/duty/location rules. A provider with
one active Live truck needs no reviewed documents; multiple Live trucks require
the exact ownership/financed-licence qualification.
Qualification never reveals PRIVATE/EXCLUSIVE signals anonymously. Losing a
qualifier with multiple Live choices withholds capacity until the owner moves
all but one to Draft or supplies current qualification, without deleting saved
signals or stopping ongoing Tracking. Adapter/schema drift fails visibly and closed; it cannot fall back to
an older unqualified projection. Driver assignment remains concurrency-safe.
World coordinates, load preferences, provider-account search, multi-filters,
obscured locations and freshness labels retain their existing contracts.
The backed-up local installation passes the v3 SQL/strict-catalog and publication
concurrency checks recorded in `specs/TRACEABILITY.md`. Actual owner/publication
browser acceptance passes; owner visual approval, full release gates and hosted
rollout remain separate gates.

### Scenario: fleet-managed drivers can reach duty controls on a phone

Given a company driver cannot edit capacity and uses the location/duty panel
When the phone's fixed workspace navigation is visible
Then the panel scrolls normally and its final duty action remains reachable
above the navigation, with the existing permissions and location prerequisites.
Do not apply the fixed-height map container to this non-map panel.

### Scenario: map overview keeps load preferences in details

Given public or private capacity discovery renders web or mobile markers
Then do not print Full only, Shared only or Full or shared beneath truck icons
And preserve Empty/Partial status colors and separate clusters
And selecting a truck still shows its saved accepted loads in truck details
And shipment-space filters continue matching the saved preference, including
full-only, shared-only and either; this visual change does not alter matching.

### Scenario: discovery reuses computed values without changing eligible supply

Migrations214/215/216 are installed on the reviewed local preview after isolated
transactional parity/recovery and guarded backup/postchecks. The unchanged
5,000-record scale gate passed in 52.602 seconds: profile 3,491.001 ms;
initial/filtered/continuation unscoped pages
4,917.157/3,012.038/2,944.473 ms; scoped map/route
3,218.078/4,159.049 ms; overview 4,075.387 ms. Every query retained the same
5,000 ms limit, and all completeness, ordering, lookahead and payload checks
passed. Independent cleanup found zero synthetic vehicles/drivers and exact
source/authority/data fingerprints. This is one source-matched isolated local
pass; initial unscoped margin is 82.843 ms. Hosted rollout and performance remain
separate, with no hardware or repeated-run reliability claim.

Given public overview eligibility and all requested filters have selected a vehicle\
When its viewport anchor is needed for the grid key, average location and null check\
Then compute that same anchor once and reuse it\
And preserve the exact prior cell JSON, ordering, counts, viewport/privacy geometry,
current/Preferred offer matching and existing cell bound.

Given account-only Transporter search evaluates eligible vehicles\
When it resolves current assigned Drivers and groups the provider accounts\
Then retain the same assignment/publication/sharing/document authority\
And avoid a second materialized copy that only appends a constant null Driver name\
And do not construct per-vehicle Driver search metadata that account entries no
longer consume\
And return exactly the same complete profile JSON, counts, ranking, pagination,
manager identity and document metadata for every existing filter.

Given the canonical rollback fixture contains 5,000 additional eligible vehicles\
When the unchanged discovery scale gate runs on source-matched installed functions\
Then every measured search/map/overview query retains its five-second limit\
And result completeness, lookahead/continuation, payload bounds and zero remaining
synthetic vehicles/identities must pass without reducing coverage or adding UI work.

Given public truck discovery has no location-source, blocked-handle, text, city or
document filter keys\
When the existing search helper would immediately accept the candidate\
Then skip only that helper's unused candidate serialization\
And when no viewport key is present, skip only the viewport helper's unused
geometry serialization\
And retain the existing helper behavior for present keys, including null, empty,
malformed and valid values, and for a null query.

Given an initial or continuation page uses either fast path\
Then preserve complete prior payloads and strict cursor ordering\
And preserve all publication, active-driver, visibility, sharing, qualification,
filter and current/regular geometry predicates before the existing bound\
And do not move the cursor or limit past eligibility, modify helper bodies, change
function authority, cache results or relax the 5,000-record/five-second gate.

Migration215 implements those two helper no-op branches in public truck pages;
profile discovery uses the separate five-field input contract below.

Given profile discovery filters every eligible vehicle before counting accounts\
When its search helper and delegated metadata helpers consume only location
source, provider handle, provider organization/profile IDs and vehicle ID\
Then supply exactly those five fields instead of serializing the entire joined
capacity row\
And preserve every helper call, document flag, filter, complete eligible count,
account payload, ranking and page order\
And retain the full candidate fields for the separate unchanged geometry and
eligibility predicates, including private visibility and sharing rules.

Given any input-contract helper body differs from the verified dependency\
Then refuse the optimization rather than assume its field needs are unchanged\
And preserve absent/null/empty/malformed/present query behavior and exact helper
source/authority metadata.

Migration216 implements the five-field search-helper argument and the same
absent-viewport guard inside the profile producer only. Isolated correctness,
recovery, reviewed local installation and the unchanged scale gate are qualified.
Driver authority, materialization, geometry matching, account grouping and public
RPCs stay exact; hosted installation is a separate operation.

Verification: `tests/sql/capacity-discovery-reuse.sql` compares complete results with
service-inaccessible pre214 definitions and proves one anchor evaluation per
actual executor row in the single-expression materialized producer, using the
expanded installed SQL under the same owner/search path without changing helper
semantics or privileged settings; `scripts/market-scale-audit.mjs` remains the
separate performance gate owned with FEAT-MKT-001. The source-bound non-ANALYZE plans
identify repeated anchor expressions and obsolete Driver metadata/serialization
work. Only the unchanged canonical gate establishes measured qualification;
existing failed timing receipts remain valid evidence. Before local
installation, require a protected backup, ownership-faithful isolated rehearsal,
unchanged authority metadata and a drift-refusing rollback rehearsal. Hosted apply
and runtime qualification remain separate; no function grant or helper semantics
may change for this optimization.

Local evidence: the existing owned clone passed 19 matching/nonmatching filter
sets, complete overview/cursor and account-page JSON/count/document parity, all
four public anchor paths and four excluded-supply cases. Its expanded executor
plan produced one anchor expression for four eligible rows. The recovery rehearsal
and outer rollback restored exact function authority/source and data fingerprints,
independently read back with zero aliases or fixture vehicles remaining. This is
correctness evidence, not a 5,000-record performance pass; protected receipt:
`.local/capacity-overview214/clone-correctness-recovery-receipt.json`.
The failed canonical run and independently exact cleanup are retained in
`.local/capacity-overview214/scale-5000-after214-clarified-receipt.json`; its
read-only inner-plan diagnosis and candidate limits are in
`.local/capacity-overview214/continuation-readonly-diagnosis.json`.
`tests/sql/capacity-discovery-noop-guards.sql` reuses the same proven eight-row
fixture and checks 35 absent/null/empty/present/invalid-key cases, exact payload
and failure parity on initial/continuation pages, nonempty cursor results, and
existing page-size bounds. It first failed on the old page's unused helper
expressions; after215 the constant-input inner plans omit only the absent-key
calls and retain the requested search/viewport calls. Helper source and all
entry authority metadata remain unchanged. The existing214 regressions and
drift-refusing215 recovery also passed in the same normal-owner clone
transaction, followed by exact independent rollback readback. Protected receipt:
`.local/capacity-noop215/clone-correctness-recovery-receipt.json`.
Its reviewed local installation, failed canonical gate and exact independent
cleanup are retained in
`.local/capacity-noop215/scale-5000-after215-cleanup-receipt.json`.
The remaining profile producer input contract and non-ANALYZE plan evidence are
in `.local/capacity-noop215/profile-readonly-diagnosis.json`; they establish unused
serialization, not a measured improvement.
`tests/sql/capacity-discovery-input-projection.sql` reuses the byte-identical
eight-row fixture and proves 51 producer/account payload/error cases, private-only
scopes, source/document/text filters, null/empty/malformed inputs, cursor order,
account counts/documents/ranking and pagination. The old producer first failed
only the wide-input/no-op plan check after payload parity passed; the candidate
passed those cases and the unchanged214/215 regressions. All seven public
function source/authority snapshots stayed exact during tests, with only the
planned producer definition differing during installation. Drift-refusing
recovery, outer rollback and independent readback passed with zero214/215/216
references or fixture vehicles remaining. Protected evidence:
`.local/capacity-input216/clone-correctness-recovery-receipt.json`.
The separately reviewed local installation/postchecks and full canonical timing
pass are retained in
`.local/capacity-input216/local-preview-apply-receipt.json` and
`.local/capacity-input216/scale-5000-after216-cleanup-receipt.json`, with the
unchanged gate script SHA256
`5be12568bb417b471da245f0c165d80b2c15477fa025d34811f77bb8620b1964`.

### Scenario: public transporter profiles share complete-offer eligibility

Migration217 is installed on the reviewed local preview. Isolated
correctness/recovery, focused preview postchecks and the unchanged canonical
5,000-record scale gate are qualified; hosted installation remains separate.
The separate public profile producer retained pre211/213 restrictions even
though public/private truck projections already implement the accepted model.

Given a permitted vehicle has Partial Planned area or Preferred area\
When public transporter search applies matching Area or Route geography\
Then include its account and count that vehicle once, with the same whole-offer
eligibility as public/private truck discovery\
And an Area query may also match a Planned or Preferred route for either Empty
or Partial status.

Given a query supplies both endpoints or an explicit legacy geometry\
Then preserve same-offer endpoints, directional rules and that explicit geometry\
And retain all other status/load/type/source/document/blocked-account filters as
AND constraints, active-driver/publication/sharing authority and private denial\
And preserve complete account payloads, document metadata, counts, ranking,
pagination and the216 five-field helper input for all unaffected queries.

Verification must exercise both actual `capacity_search_results(...,'PUBLIC',...)`
dispatch and `capacity_search_results_public_fast`, using the unchanged published
offer-union fixture. Intended newly matching cases compare complete account JSON
against the already-eligible reference account; unchanged cases retain exact
reference JSON parity. Guard source/owner/config/ACL metadata and rehearse
drift-refusing recovery before separately reviewed local installation. Existing
1294/400 and216 scale receipts do not qualify these previously uncovered cases.

Local evidence: 22 actual PUBLIC-dispatcher/fast-RPC checks pass for newly
matching Planned/Preferred Area/Route offers, full account JSON/documents/counts,
same-offer endpoints/direction, explicit geometry and non-geographic AND filters,
private/revoked/Off Duty denial. Unaffected queries retain exact old-reference
JSON parity; the corrected four-account Area fixture equals the complete already-
eligible reference. The unchanged216/215 suites pass. Drift-refusing recovery and
independent outer-rollback readback restore source/authority/data exactly, with
zero reference/fixture leftovers. Protected receipt:
`.local/capacity-offers217/clone-correctness-recovery-receipt.json`.
The original offer-union test bytes are recovered exactly after removing only217
checks/helper/budget additions, preserving its proven fixture. The first expanded
DO exceeded its old30s aggregate correctness budget; one authorized120s retry
passed all assertions. This is a harness aggregate budget change, not a measured
query result or a relaxation of the separate canonical5s limit.

The committed217 source passed isolated preview postchecks without reapplying or
restoring a migration: offer-union 28.583s, corrected Area regression 4.721s,
with exact independent rollback and zero owned backends after each. An earlier
preview postcheck failure discarded stderr; its cause remains unknown and its
failure/state receipts are retained. The postcheck-only runner verified the
actual server session attribution and retained protected per-phase diagnostics.
Evidence: `.local/capacity-offers217/postcheck-only-run/receipt.json`.

The complete unchanged scale gate then passed in 51.498s: profile 4,024.621ms,
scoped map/route 2,791.511/3,528.440ms, overview 3,755.410ms, unscoped
initial/filtered/continuation 2,850.649/3,075.145/2,935.108ms. All seven queries
kept the5,000ms limit, with complete counts, strict ordering, filters, lookahead
and payload bounds. Independent readback found zero synthetic vehicles/drivers
and exact source/authority/data/ledger fingerprints. This is one isolated local
source-matched pass, not hosted performance or repeated-run reliability evidence.
Receipt: `.local/capacity-offers217/scale-5000-after217-cleanup-receipt.json`.

### Scenario: current space and accepted loads are different facts

Owner map-view correction, October 7: public/private discovery maps permit panning
beyond Ethiopia/East Africa, including other African regions and the Middle East.
Keep valid world coordinates and normal zoom limits; regional camera limits must
not recenter the user's exploration. This changes map navigation, not catalog or
location-command coverage. Empty viewports do not invent trucks or reset the
camera. Check desktop, phone web and Expo.

Owner location correction, October 7: authorized driver-submitted approximate
locations accept finite worldwide latitude [-90,90] and longitude [-180,180],
including zero, regardless of the user's country. First location, capacity saves,
refresh and duty updates retain assignment/owner authority and privacy radii.
Only the on-device obscured fix leaves the capture callback; dateline wrapping
must keep the same distance/radius and produce valid longitude. Unknown or
invalid coordinates remain denied. Where no catalog town is nearby, use a neutral
approximate-area label and nullable catalog reference, not a false Ethiopian town
or invented catalog ID. Route/area selection still uses actual catalog places.
The additive migration updates only named constraints/functions and preserves RLS,
ACLs, null checks, existing history, audit and lifecycle controls. Rehearse locally
and verify exact function/constraint inventory before any separately approved
hosted apply. Rollback should first roll back the application; a bounds rollback
cannot invalidate retained worldwide records and is not an automatic data deletion.

Given an authorized provider sets Empty in the main capacity editor
Then show Full loads only, Shared loads only and Full or shared as its three
accepted-load choices, with a short explanation of the selected choice.
The Loads editor uses the same values and wording. Partial means remaining
space for shared loads and cannot accept a full-truck load. Optional multiple
pickup/drop-off choices remain separate and are preserved by focused saves.

Given a visitor reads an Empty marker or truck details on web or native
Then show its actual saved load preference as well as physical capacity status;
do not infer full-load acceptance from Empty alone or missing/invalid flags.
Clusters remain status-separated and colored/text-labeled Empty or Partial.

| Saved status / accepted loads | Full-truck search | Shared-space search |
| --- | --- | --- |
| Empty / FTL | included | excluded |
| Empty / PTL | excluded | included |
| Empty / BOTH | included | included |
| Partial / PTL | excluded | included |
| Off Duty | excluded | excluded |

The visitor Truck filters show current load and the published location source,
but no separate Space needed control. Driver-selected full/shared load acceptance
remains authoritative and existing callers may still submit load-type filters.
Existing full-versus-partial contradiction handling remains explicit. The
accepted multi-selection contract (FEAT-MKT-001) permits multiple occupancy,
location-source, configuration, stop and freshness choices. Match any selected
option within each group and every supplied group against the same authorized
truck. Partial remains shared-load/route-only; a combination with another valid
alternative must not be erased by singleton-only contradiction handling. Every
selected reviewed document remains required. Canonical bounded lists preserve
existing scalar clients, pagination, privacy and independent profile search.
Public, authorized private, profile results and truck markers apply the same
saved acceptance flags. Driver/truck assignment, owner permission, approximate
location, geometry and private grants remain authoritative at the server command.
Validate this matrix through actual save/read/search and negative permissions,
not solely a UI snapshot. New schema or hosted changes require separate review.

### Scenario: staff private-capacity rendering uses the same validated filters as its API

Given an authorized administrator or Support account opens Private capacity
shared with Loadgistic\
When the page first renders from its URL\
Then the existing current-account authorization remains required before any
capacity read\
And each valid option group is canonicalized under the same bounded contract as
the map API\
And repeated URL keys, unsupported options or excessive values produce the
existing filter-review state without reading capacity\
And that denied state remains denied when the client requests map updates\
And transporter-search text is retained in the drawer but is absent from the
initial truck-matching request, just as it is absent from later map requests\
And an explicit selected transporter and every truck filter remain in scope.

Regression: `tests/capacity-filter-ssr.test.mjs` exercises the actual admin page
with its existing authorization boundary, canonical groups, denied-query zero
reads and independent search text. The focused staff browser case in
`tests/e2e/admin-connected-queues.spec.ts` checks reload denial, actual API400,
explicit filter correction, retained drawer text and successful canonical read.
This changes no layout, staff permissions,
database function or hosted setting; existing API filter validation remains.

### Scenario: current availability uses a Service area or Capacity route

Given an authorized fleet owner or Driver publishes current capacity for one truck\
When the current signal is saved\
Then Empty and Partial each require exactly one availability geometry: Service area or Capacity route\
And a Service area uses one selected center city plus three through five distinct surrounding cities\
And the surrounding cities form one ordered polygon boundary while the center city remains the searchable area anchor\
And a Capacity route uses two through five distinct ordered cities joined in sequence\
And neither current geometry asks for or stores a travel date\
And Empty and Partial are categorical market signals rather than remaining-space estimates\
And the Driver is not asked for a capacity percentage and no percentage is displayed, filtered, or published to visitors.

### Scenario: current signals use distinct map treatments

Given a public current-capacity projection is selected on the map\
When its Driver location is available\
Then a labeled violet privacy circle is always shown at the Driver-selected accuracy\
And a Service area uses a separate labeled outline joining its surrounding cities and identifies the center city\
And a Capacity route uses a labeled polyline joining every selected city in order\
And both use cobalt for Empty and neutral gray for Partial\
And color is reinforced by text and shape rather than being the only meaning\
And the violet privacy circle remains distinct from every capacity, trip, and recurring signal.

### Scenario: a preferred corridor belongs to one truck and its current driver

Given an assigned truck has a preferred service area or two-way corridor\
When an authorized fleet owner or independent driver maintains its preferred corridor\
Then the selected truck and expected current driver are required and rechecked
inside the command\
And that truck-and-driver pair may retain exactly zero or one regular-service signal\
And that signal is either a structured Service area with one center plus three through five surrounding cities or a structured two-way Capacity route with two through five ordered cities\
And another addition is rejected without changing the saved signal\
And a preferred corridor asks for no date and never claims that a truck is currently available\
And the selected-truck map card exposes the complete saved signal immediately without a disclosure control or line clamping\
And a Preferred corridor joins its cities with ↔ while a Preferred area names its center and boundary cities\
And both state Confirm availability\
And the shared map labels an orange dashed route Preferred corridor or an orange outlined area Preferred area, distinct from violet approximate location and status-colored Planned capacity.

### Scenario: regular routes cannot leak across trucks or assignments

Given a fleet has two assigned trucks with distinct usual routes\
When their workspace, public/private capacity, filtered pages, clusters, profile
truck cards, search rows or Featured candidates are projected\
Then each truck receives only its current truck-and-driver pair's regular route\
And account-level profile details never include regular route geometry\
And a stale edit naming a previous driver is denied without changing a record\
And unauthorized users and browser database roles remain denied\
And legacy unbound routes are retained but not copied, inferred or inherited by
every truck\
And replacing a truck or changing its driver never transfers a regular route
to a different pair.

Current clients must send the selected truck and expected driver to regular
commands. Old unscoped commands fail closed with update guidance. Any additive
hosted migration waits for reviewed SQL, backup/rehearsal and compatible web and
Android rollout; local implementation is not production completion.

### Scenario: Off Duty removes current availability

Given a truck has current capacity\
When an authorized actor selects Off Duty\
Then its current signal is absent from public discovery\
And its pair-scoped regular-service signal remains a separate record governed by its own state\
And Busy is rejected.

### Scenario: older signals remain visible with honest age

Given a truck's latest saved status is Empty or Partial\
When its capacity confirmation deadline passes without a new update\
Then the latest signal remains discoverable instead of disappearing solely because of age\
And its capacity update is assigned exactly one stage: Today, Past few days, Past week, Past month, or Older\
And its approximate-location update is assigned its own stage using the same boundaries\
And Today means less than 24 hours old, Past few days means 24 hours through less than four days, Past week means four through less than eight days, Past month means eight through less than 31 days, and Older means at least 31 days\
And each stage has a short plain-language label derived from its actual timestamp\
And missing or invalid location time is stated as Location update unavailable\
And a Past week, Past month, or Older capacity signal says Confirm availability directly\
And an older approximate location is described as the last reported approximate area rather than the truck's current position\
And selecting Off Duty still removes the truck from public and authorized Shared capacity discovery.

### Scenario: public Board is cursor bounded

Given public capacity contains more results than one response\
When any visitor opens the Map or requests another result batch\
Then the server returns a stable cursor page of 12 through 16 independently actionable cards\
And the Market does not duplicate those signals in a ranked truck-list mode\
And the map automatically requests the next bounded batch without a manual Load more control\
And loading, end-of-results, and retry states remain keyboard-readable without becoming a ranked list\
And filters, loaded cursor state, and scroll position survive a profile/detail round trip\
And the end of results is stated plainly.

### Scenario: matching uses every supplied capacity fact

Given an anonymous visitor supplies one or more capacity filters\
When the managed public projection evaluates eligible trucks\
Then free text, exact transporter, capacity status, geometry, configuration, load type, stop option, freshness, route or area geometry, and explicit nearby location are each enforced only when supplied\
And every supplied filter must match the same truck while omitted filters remain neutral\
And one endpoint is projected against every segment of each eligible current or regular Capacity route\
And two endpoints must fall within their independent tolerances on one route in the selected direction, based on projected progress along the complete ordered polyline\
And an Empty or Partial Service area tests one supplied endpoint or both supplied endpoints against the complete polygon and selected tolerances\
And no distance, freshness, verification, or provider fact produces a public rank or suitability score\
And the managed projection returns only stable cursor order.

### Scenario: public projection is deliberately safe

Given a visitor has no Loadgistic account\
When current capacity or regular service is returned\
Then the projection may include provider public identity, public handle, provider-controlled contact availability, the assigned Driver's first name and operating-model label, the Driver's public callback phone, separate Driver and truck verification summaries, truck presentation, obscured Service area or structured Capacity route place sequence, capacity facts, and freshness\
And the truck must resolve to a current active Driver under `FEAT-FLT-001` for publication and subsequent Open or Private discovery, independently of optional document reviews\
And a Company driver names the fleet transporter while an Owner-operator or Self-managed driver remains clearly independent\
And missing, pending, rejected, or expired Driver and truck evidence is shown as not verified rather than hiding the truck\
And it excludes the Driver's surname, plate, private account contacts, raw exact coordinates, proof paths, tracking secrets, and administrative data\
And the card links to a public signal detail and the provider microsite.

### Scenario: private current capacity is absent from public discovery

Given an active Empty or Partial truck publishes its current geometry and approximate location to Private network\
When an anonymous visitor opens or filters the Truck Market\
Then the truck is absent even when its transporter has one regular Capacity route or Service area\
And no status, truck identity, provider identity, contact, regular-service geometry, private current geometry, approximate coordinate, precision radius, suggestion, or current-geometry label is returned for that truck\
And search, route, area, freshness, configuration, or proximity filters cannot infer its presence\
And the same truck appears publicly only after its authorized publisher selects Public Market.

### Scenario: visitor location is requested without blocking discovery

Given a visitor opens the public Capacity Board\
When the client becomes interactive\
Then it immediately asks the browser for location permission\
And when the browser grants geolocation\
Then the exact point remains in browser memory\
And the primary map centers on a useful surrounding area rather than fitting the whole country\
And granting or refreshing permission does not filter, rank, remove, or refetch the current truck results\
And no visitor coordinate reaches the server until the visitor explicitly enables the nearby-truck filter\
And an explicitly enabled nearby-truck filter sends only a displaced query point and bounded radius to the server and may show a possible distance range rather than an exact truck distance\
And denial leaves the full public Board usable with a manual Retry location permission action and site-setting guidance.

### Scenario: demo capacity geography follows plausible Ethiopian roads

Given the public Capacity Board is populated with pre-customer demonstration trucks\
When demonstration capacity geometry is rebuilt\
Then every current Capacity route contains two through five distinct cities in a plausible road-travel sequence\
And the route passes through or immediately beside the truck's approximate current city rather than jumping to an unrelated part of Ethiopia\
And every Service area uses a center near the truck's approximate current city and a boundary that contains that center\
And cargo vans, pickups, and mini trucks expose current capacity geography within 30 kilometres of their base city or town\
And each explicitly truck-and-driver-bound regular signal contains or closely approaches only that pair's demonstration location\
And older unbound provider route fixtures remain retained history without a guessed truck assignment\
And every regular Capacity route follows a plausible named road sequence while every regular Service area uses a nearby center and enclosing boundary\
And intermediate cities are included only when they clarify the road path rather than filling every route with unnecessary stops.

Given a truck's latest current capacity visibility is Private network\
When an anonymous visitor opens or filters the public Capacity Board\
Then that truck contributes no marker, status, identity, regular-service fallback, suggestion, or filter result\
And only an active Public Market signal may appear on the public map.

### Scenario: one shared map is the primary capacity view

Given a visitor opens the Capacity Board\
When the result surface renders\
Then one shared interactive map is the only public result view\
And search, filters, and the location action remain available in their established command area above the map\
And when no restored viewport or explicit visitor/vehicle centering applies, its initial camera centers on the densest group of available approximate vehicle locations, so one distant outlier cannot shrink the working market to a world view\
And when no located signal is available it uses the established East Africa market camera\
And desktop web, phone web and Expo choose the same default market cluster for the same signals, with zoom adjusted for each map engine's tile scale\
And the camera choice changes no signal visibility, search result, filter result, or map query\
And visitors may pan and zoom across the world without a regional clamp, and an empty viewport never resets their camera\
And no ranked or paginated truck-list surface is offered\
And before selection the map clusters crowded signals that separate as the visitor zooms\
And each cluster contains only Empty trucks or only Partial trucks, names that status, and is visibly offset from an opposite-status cluster occupying the same map cell\
And clustering uses a screen cell at least as wide as the corresponding unselected marker so neighboring full-size pins are not rendered on top of one another\
And a cluster that remains crowded at maximum zoom stays a single bounded cluster and opens an accessible truck chooser instead of exploding its members into an overlapping ring\
And the complete map key remains visible without another action and uses pointed pins for capacity status, a polygon for Service area, and solid or dashed polylines for Capacity routes rather than repeating same-shaped color bars\
And each unclustered truck marker is a sufficiently large pointed map-pin shape using the existing cargo-configuration image so visitors can distinguish vehicle body types before selecting it\
And the vehicle artwork fills the true circular head without becoming egg-shaped or competing with an in-marker status word, while every rigid or tractor trailer configuration keeps its cab and enough of the attached trailer visible to distinguish it\
And a tractor marker and detail use only its currently attached trailer configuration rather than combining every compatible trailer into one public signal\
And the marker uses a complete cobalt ring and tail for Empty or a complete amber ring and tail for Partial, with no Empty or Partial text placed over the vehicle artwork\
And no percentage or percentage-progress ring appears in a public truck marker\
And status remains available in the marker's accessible name, hover or keyboard-focus summary, selected-truck details, and map key rather than being communicated by color alone, while route lines, the Service area polygon, and their legend remain geometrically distinct from marker status\
And all user-facing labels call the violet circle the Approximate current location or Approximate location radius while location privacy remains an internal data-policy term\
And a truck or visitor-location summary appears only on hover or keyboard focus, sits above its marker, and retains a pointer to that marker rather than permanently covering the map\
And selecting one truck enters an explicit focus state that removes every other truck marker and cluster\
And every selected-truck approximate-location circle, Service area outline, current Capacity route, and regular Capacity route has a wide pointer target with one concise styled hover or keyboard-focus summary\
And that summary names the signal, its distance or endpoints, its capacity meaning, and whether availability must be confirmed without requiring a click or opening a second information card\
And each summary uses a readable light surface, restrained neutral border, and distinct signal-color accent rather than a thick dark frame or color-on-color text\
And clicking one signal pins only that signal's summary while selecting another signal replaces it\
And overlapping current and regular Capacity routes are drawn with small opposite screen-space offsets that preserve their stored cities and make each line independently selectable\
And Service-area and approximate-location interiors do not intercept route interaction, while their thick outlines remain selectable\
And the selected truck keeps one visually distinct marker outside the clustering algorithm while its compact adjacent identity dock provides essential actions without a second permanent map label or blocking the signal workspace\
And automatic bounds prioritize that truck's approximate location area and current Service area or Capacity route rather than its regular provider routes\
And on wider screens the selected truck information card occupies a dedicated right-hand rail outside the map canvas while the map narrows to remain fully usable\
And dismissing the selected truck expands the map back to the full available width and the map recalculates its rendered size after either layout change\
And on narrow screens the selected truck information card follows directly below the full-width map rather than covering it or reducing it to an unusable column\
And the selected information card has no internal scrollbar or full-screen takeover\
And an explicit close icon dismisses the selected card and restores the full clustered map\
And the map shows the visitor's browser-only You marker when permitted\
And no hidden list-view state is required to select or revisit a truck.

### Scenario: selected-truck map language is reused safely on provider microsites

Given a provider microsite lists an active truck\
When that truck has a current public Empty or Partial projection\
Then its lazily opened microsite map uses the same safe projection and approximate-location, Service area, Capacity route, regular-route, visitor-marker, and map-key semantics as Capacity Market selection\
And it uses the same initial-camera rule as the public Market while permitting unrestricted world panning and zooming\
And a truck without a current public signal has no microsite location map\
And neither surface exposes plate, assigned Driver, private contact, exact truck coordinate, or proof files.

### Scenario: a manual Driver refresh is persisted

Given an authorized Driver has an active current-capacity signal\
When the Driver presses the explicit Refresh truck location command and grants browser location\
Then the exact coordinate is obscured in the browser\
And the obscured coordinate, chosen approximate-location radius, safe area, and refresh timestamp are persisted without changing the capacity facts\
And the interface confirms that the location was saved rather than merely captured\
And permission denial, insecure browser context, timeout, and device failure produce distinct retry guidance\
And a fleet owner cannot substitute the owner's device location for an assigned Driver.

### Scenario: active Driver capacity refreshes while the dashboard is open

Given an authorized Driver has an active Empty or Partial capacity signal\
When the Driver opens the capacity dashboard and grants browser location\
Then one obscured location refresh is saved automatically\
And another refresh is attempted no more often than every 10 minutes while the dashboard tab remains visible\
And automatic refresh pauses while the tab is hidden or the truck is Off Duty\
And the manual Refresh truck location action remains available for permission retry or an immediate correction.

### Scenario: provider editor collapses to the published summary

Given a truck has saved capacity facts\
When its authorized provider opens the editor\
Then a map-centered summary appears before the full editor\
And one compact selected-truck control occupies the map's reserved top-left zone without repeating a Capacity title\
And four focused actions remain in one aligned top-right rail: Capacity, Sharing, Preferred corridor and Location\
And Capacity groups current availability, coverage and accepted-load preferences in one focused editor, while Sharing, Preferred corridor and Location stay separate\
And the complete map key remains visible in the reserved bottom-left zone while one combined approximate-location, accuracy-radius, and refresh dock occupies the bottom-right zone\
And the Driver map uses the same Empty cobalt, Partial gray, Approximate location violet, and Preferred corridor muted-orange signal language and readable hover summaries as the public Market\
And the four zones do not overlap one another, required map attribution, or essential capacity geometry at supported desktop and phone widths\
And the approximate truck marker and Truck area label remain high contrast above overlapping area polygons and routes\
And Capacity, Sharing, Preferred corridor, and Location each open only their relevant editor\
And no separate future-or-recurring planning section appears below the capacity console\
And every edit opens a native modal over the still-mounted map with only that signal's inputs, while regular service retains its own explicit save\
And focused saves preserve unopened values\
And the radius shortcut opens the Location modal while Refresh truck location remains directly operable from the combined location dock\
And automatic refresh succeeds silently while manual success or failure is announced transiently beside that dock\
And both location controls persist without replacing or extending the map summary.

### Scenario: Driver capacity is map first on phones

Given an authorized Driver opens Capacity management on a supported phone\
When published capacity exists\
Then the map occupies the primary remaining workspace beneath the compact application bars\
And the current truck selector remains compact in the reserved top-left map zone instead of becoming a page-sized card\
And a compact top-right rail has four recognizable, accessibly named actions: Capacity, Sharing, Preferred corridor and Location\
And Capacity opens one editor for availability, coverage and accepted-load preferences; the other three actions open only sharing, regular-service and location controls\
And the complete map key remains visible at bottom-left while Approximate location radius and Refresh truck location share one bottom-right dock\
And every floating zone stays aligned, distinct, and clear of the other zones, required attribution, and essential map interaction\
And a focused edit opens an accessible modal over the map rather than replacing the map or navigating to another page\
And Save or Cancel closes the editing workspace and returns the Driver to the updated map summary\
And the editor uses one compact header containing the signal name, truck identity, and a Close action, with reachable Save and Cancel controls\
And the page does not repeat a visible Capacity title, detached Updating card, separate location summary card, or automatic-refresh notice.

### Scenario: a focused edit is isolated and reversible

Given an authorized provider is viewing a saved truck on Driver Home or its Fleet detail\
When Capacity, Sharing, Preferred corridor, or Location is selected\
Then only the selected group's inputs open in a labelled modal with trapped keyboard focus\
And Capacity contains Empty, Partial, and Off Duty choices, current route or area inputs, accepted load types, and multiple pickup/drop-off preferences\
And Sharing owns public/private visibility, Preferred corridor owns the separate undated preference, and Location owns the approximate point and privacy radius\
And each available group has its own compact, labelled floating button, with no duplicate action or Edit all control\
And a first publication defaults to Private with a concise visible notice; changing Capacity does not silently change Sharing\
And the underlying map remains mounted at its current pan and zoom\
And Cancel, Close, or Escape discards the draft and returns focus to the triggering control\
And a save prevents duplicate submissions, retains the draft on denial or network failure, and announces a safe error inside the modal\
And successful current-capacity or regular-service saves refresh server-owned map facts without document navigation\
And another editor cannot open until that refresh finishes, so a rapid second edit cannot submit the previous snapshot and overwrite the first save\
And Capacity saves the complete current availability, route/area, load preferences and stop choices from that editor\
And Capacity, Sharing, Routes and Location saves preserve values owned by the other groups, including visibility and the last confirmed Driver location and timestamp\
And a fleet owner can inspect but cannot overwrite the assigned Driver's location\
And a new on-duty signal or an Empty-area-to-Partial transition includes only the missing required coverage or Driver-location inputs in that same modal before publication\
And regular service opens with its saved inputs and can be edited atomically or explicitly removed from its own modal without exposing an Edit all workflow\
And a denied or invalid regular-service replacement leaves the original signal and audit history unchanged.

Known capacity validation failures must produce actionable, public-safe messages rather than a generic unexpected-error message. Unexpected database failures expose no database details or personal data; server diagnostics retain only the operation and safe database error code. Regression evidence must include an actual status change, not only a visibility save in the status dialog.

Verification: `tests/e2e/capacity-signal-dialogs.spec.ts`, the capacity-summary scenario in `tests/e2e/smoke.spec.ts`, `tests/provider-capacity-supabase.test.mjs`, and the local-only `scripts/verify-supabase-provider-capacity.mjs`. JSON mutation responses retain authenticated application commands and the PostgreSQL audit/authorization boundary; native POST redirects remain supported. Apply additive migration `077_focused_capacity_editing.sql` before the client. The replacement command reuses the scoped remove/add validators in one PostgreSQL transaction. Rollback restores the prior client and HTTP response negotiation without discarding capacity history; the additive RPC may remain unused.

### Scenario: Driver Home keeps operations in one clear order

Given a Driver opens its authenticated Home on a narrow or wide screen\
When active Tracking and truck capacity are both available\
Then urgent Tracking updates appear in a compact section before the truck-capacity workspace\
And the existing capacity summary retains its map, current availability, approximate location, regular service, focused Edit actions, and direct location controls\
And Tracking does not duplicate, replace, cover, or move the capacity map into another workflow\
And completing or collapsing a Tracking update returns the Driver to the same Home hierarchy.

### Scenario: managed provider capacity is authorized and persisted atomically

Given the Supabase data backend is selected and an authenticated provider opens or changes Capacity management\
When Loadgistic reads assigned trucks and latest signals, publishes Empty, Partial, or Off Duty, refreshes approximate location, changes restricted Driver duty, or changes regular service\
Then the inbound page or route uses the provider-capacity application port and a server-only Supabase RPC rather than importing the SQLite repository\
And the RPC repeats active-account, subscription, provider ownership, Driver assignment, and capacity-permission checks before reading or writing\
And route and Service-area place references are resolved to canonical stored coordinates inside PostgreSQL\
And each accepted mutation and its audit record commit atomically with the authenticated actor and owning provider scope\
And a denied or invalid command creates neither a capacity, regular-service, nor success-audit record\
And anonymous and authenticated browser clients cannot execute the service-role RPCs directly\
And selecting the managed backend never falls back to SQLite after a Supabase error.

## Contract ownership

- Public pages: `/capacity`, `/capacity/[id]`
- Provider editors: Driver Home and truck-specific Fleet page
- Application services: provider-capacity workspace and commands, current-capacity, regular-capacity-route, public projection, cursor and proximity functions
- Persistence adapters: server-only Supabase provider-capacity RPCs in migrations `043_provider_capacity_runtime.sql`, `073_public_capacity_filter_alignment.sql`, and `077_focused_capacity_editing.sql`
- Tests: domain, provider-capacity Supabase authorization, repository, authorization, E2E, visual audit

### Scenario: a newly assigned Driver can publish the first capacity signal

Given an identity-confirmed Driver is assigned a truck and allowed to manage capacity
And that truck has no published capacity or recorded location
When the Driver opens Home
Then the truck identity and setup content occupy separate visible space on desktop and phone
And a clearly labelled Set capacity action opens the existing current-capacity editor
And interactive editor controls remain disabled until their handlers are ready
And the first editor collects valid coverage and approximate location before Save
And successful Save persists the assigned truck's signal and shows the normal saved map
And the initial summary says Not published rather than claiming Open visibility
And absent assignment or restricted fleet permissions retain their existing denial behavior.

Use normal document layout for the no-map state; preserve the saved-map overlays
and existing first-publication Private default. Verify actual new-Driver inbox
login, normal click/touch, visible geometry, persisted state and cancellation.
No migration or permission change. Rollback restores the preceding presentation.

### Scenario: restricted Driver starts with an unconfigured truck

Given a Company driver cannot manage capacity and their assigned truck has no signal
When Home opens
Then it explains that the fleet owner must configure capacity first
And Available is disabled rather than offering a submission the server must reject
And changing capacity/tracking permissions takes effect on the next read or write without a new login.


## First location for owner-managed capacity — audit correction, 2026-09-27

Given an active assigned company driver whose owner manages capacity, when the
truck has never published capacity, then the driver can explicitly save their
approximate device location without acquiring capacity-edit permission. The owner
can then configure and publish the first signal using that driver-provided fix.
Saving location alone never publishes availability or changes sharing, coverage,
accepted loads, capacity age, or tracking permissions. Independent drivers can
also save their own truck location. Unassigned, removed, inactive, foreign-fleet,
retired-truck and owner-device submissions remain denied by PostgreSQL.

Keep the latest approximate fix separately from capacity publication in a
service-only RLS-protected vehicle/driver location record. Only the current active
driver's record is visible to the authorized workspace or used for publication;
reassignment cannot reuse another driver's snapshot. New fixes update location
age only. Existing capacity history remains available as a compatibility source.
No exact device coordinates or coordinates in audit logs. No automatic GPS prompt
for an unassigned or restricted driver's first visit; explicit Save/Use location
and bounded failure/retry controls explain the next setup step.

Migration 113 is additive and local first. Rollback the app before separately
reviewing removal of helpers/data; retain location/capacity/audit history. Verify
browser-role denial, tenant/assignment scope, first restricted-driver location →
owner publication, and unchanged capacity metadata/location freshness.

Location audit validation: GIVEN a direct capacity or duty request omits a GPS coordinate, radius or source, THEN reject it without publishing or resuming capacity. SQL NULL comparisons must not bypass validation. Regression: `tests/sql/driver-location-bootstrap.sql`.

Owner-map resize regression: GIVEN the saved truck-location map is visible, WHEN
its container changes width (including the first-location layout and phone/desktop
resize), THEN preserve the geographic center against the actual container size so the truck
marker remains visible. Opening/cancelling an editor without a container resize
must retain the map view. Saved coordinates and marker appearance are unchanged.
Focused regression: `tests/e2e/fleet-location-map-resize.spec.ts`.

## Stable map refresh — October 6 defect correction

Given loaded public or authorized private capacity markers
When panning or zooming automatically requests multiple viewport pages
Then previously displayed records remain while new pages accumulate, the map
instance and user's camera remain stable, and successful completion replaces the
snapshot with exactly the new window (plus an explicitly selected truck). A failed
or superseded request must not clear loaded records or overwrite newer results.
Changing filters/private identity still discards the old query's records. Preserve
automatic full pagination and error/retry behavior; no new manual loading controls.
Verify partial-page preservation, final pruning, stale-request cancellation and
real desktop/phone idle/zoom behavior. Performance improvements must preserve NR-13.

Phone refresh-error regression: GIVEN an already loaded map at a narrow phone
width, WHEN a viewport refresh fails, THEN the retained selection, Retry action
and both zoom controls remain independently reachable. Reserve the zoom-control
rail when placing the error notice; do not remove the notice or weaken retry.
Verification: `tests/e2e/map-feedback.spec.ts` at320px and the existing wider sizes.

The ordinary vehicle-details summary fits a phone with its document groups closed,
without a few clipped pixels forcing a scroll. Preserve text sizes and44px actions;
long user-entered names and expanded documents may use the existing bounded scroll.
Verification: `tests/e2e/truck-profile-layout.spec.ts`, including long content.

## On-demand selected-truck details — October 6 owner revision

Supersedes the earlier automatic truck-details drawer: it obscured selected signals.
GIVEN a public or authorized private capacity map, WHEN a truck is selected,
THEN close the results drawer and retain only the selected truck and its permitted
lines/circles/polygons, with small white information buttons outlined in each
signal's color. The truck's information button uses distinct cobalt. No details
card opens automatically, including via a truck deep link.

WHEN a truck or signal information button (or the signal itself) is activated,
THEN open exactly one compact, scroll-bounded detail card at the same map-edge
position. Its content and border change to that item; no camera movement or data
request is caused by opening, replacing or closing details. X closes only that
card and keeps the selected geometry. Hover alone must not open a panel.
A separate back-to-results action restores the mounted results, search draft,
pagination and scroll. Profile/contact/document access remains available from
truck details. Labels identify each item without requiring color perception.

Use the same interaction on desktop web, phone web and native. Preserve signal
separation, map pan/zoom, privacy boundaries and loading/error feedback. Information
buttons have accessible names and 44px touch targets; avoid coincident buttons.
Verify no automatic card, single shared position/content/color, close without
selection reset, results restoration, gestures and public/private geometry limits.
Owner visual review is required before release gates/deployment (NR-13).

Owner clarification: information targets are small white speech bubbles with a
pointer toward their object and “…” inside, indicating more detail on activation.

Owner visual correction: move information controls away from the signal strokes;
the speech tails look conversational. Current preview uses small labeled controls
at the map's side with color accents and “…”; no speech tails or leader lines.
This replaces the anchored-bubble presentation above, preserving the exact same
on-demand shared-card contract. Keep controls clear of map zoom and the card,
including small screens. Visual approval remains outstanding.

## Selection exit and centered information modal — October 6 owner follow-up

GIVEN an already panned/zoomed or filtered capacity map, WHEN a visitor selects a
truck and then activates the X attached to its circle, THEN deselect the truck and
restore the pre-selection camera without clearing search, filters or result drafts.
Changing the selected truck must not overwrite that original camera; changing the
query/private identity must not restore a camera from a previous data scope.
A direct selected-truck link has no prior camera and may return to the initial map.

WHEN any truck/signal information target is activated, THEN show one modal centered
over the map with a light backdrop, signal-colored border and scrollable details.
Background map controls cannot receive touches/keyboard input while it is open.
X, backdrop or Escape/Android Back closes only the modal and preserves selection
and camera. Web focus is contained in the modal and returns to its trigger.
The attached selection-exit X remains a separate, accessible 44px target.
This supersedes the earlier bottom-edge detail card. Verify desktop/phone web and
native separately; owner review of side controls does not approve this new modal.

Modal content follows the owner's readability correction: ordinary details fit
without scrolling; only long records scroll within the available map height.
Show ordered route places with direction connectors, distinguish regular two-way
service from a current capacity route, show area boundary places as a set rather
than an itinerary, and separate update age from route names. Keep user-provided
place/profile labels unchanged and localize application explanations.

## Truck information composition — October 6 owner correction

GIVEN the selected truck information modal, WHEN it opens, THEN use an intentional
visual hierarchy: configuration illustration beside truck identity/status, clearly
identified transporter and driver with adjacent existing actions, grouped freshness
information, and compact entity-specific document summaries on web and native.
Native uses the same already-authorized public callback phone and document-review
metadata from the existing Capacity API; it does not invent missing evidence or
widen server authorization.
Keep all existing profile/call/document actions and hidden-location safeguards.
Ordinary collapsed content should use horizontal space before requiring scrolling;
long names, translations and expanded evidence must wrap/scroll without clipping.
Preserve the centered modal, dismiss/return behavior and unchanged map camera.
Focused desktop/phone review plus native static checks precede owner visual review.

### Scenario: public vehicle details preserve contact and review tasks on native

Given the same eligible vehicle is selected on web, Expo Web or Android\
When Vehicle details opens\
Then the assigned Driver's published first name and valid public callback phone
appear with a reachable Call driver action\
And only when that phone is absent may an explicitly published provider phone
offer the existing provider Call action\
And Owner or Transport Provider, Driver and Vehicle document groups show the
same available review counts, categories, dates and expired/unreviewed states\
And each group expands inside the bounded modal without hiding its close action\
And missing contacts or reviews remain unavailable rather than invented\
And surnames, private account contacts, internal IDs, document numbers, file paths
and proof URLs never enter the mobile presentation\
And FULL, Off Duty, unassigned, revoked or unauthorized private vehicles remain
excluded by the existing API and client eligibility checks.

### Scenario: signal inspection does not become a map zoom gesture

Given a selected truck has adjacent capacity and regular-service signals.

When a phone visitor taps one signal, closes its detail modal and quickly taps another signal.

Then both details are individually readable and the map camera stays unchanged.

And a subsequent zoom-button action still increases zoom normally.

And double-tap zoom on the map background remains available.

October 7 evidence: a disposable real-fixture browser probe measured the Leaflet
camera scaling from 1024 to 2048 on the second signal tap. Stop the signal's
Leaflet event propagation (`originalEvent._stopped`), rather than only DOM
propagation, for click and dblclick. The shared-leg
regression now asserts unchanged camera state across each inspection as well as
separation and touchability at successive explicit zoom levels. No new map mode,
layout or user action is introduced.


### Scenario: demo import preserves Preferred corridor vehicle and driver scope

Given a production-pilot fixture contains truck/driver-bound route preferences\
When its importer reads the target schema before writing any pilot record\
Then it refuses a schema missing either vehicle or driver assignment column\
And it refuses preferences missing either assignment instead of silently dropping
those fields during projection\
And the preference is displayed only for its exact vehicle and current driver;
current availability remains a separate signal.

Regression: `tests/production-pilot-policy.test.mjs` and
`tests/demo-corridor-fixture.test.mjs`. The October25 finite hosted demo repair
was rehearsed with rollback and independently verified as20 public corridor
preferences; protected operation evidence is linked from current progress.
