---
id: FEAT-MOB-001
title: Native transporter and visitor application
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-FLT-001, FEAT-CAP-001, FEAT-MKT-001, FEAT-SHR-001, FEAT-TRK-001, FEAT-FTR-001, FEAT-SEC-001, FEAT-SUP-001, FEAT-TRQ-001]
problem: Transport providers and visitors need the existing verified web workflows on Android without exposing staff administration or privileged database access.
behavior: Native screens follow the reviewed phone web structure with Capacity, Featured, Tracking and transporter workspace entry; provider and verified-email visitor sessions retain the existing authorization and expiry rules.
contracts: [MobileApiV1, NativeIdentity, NativeVisitorGrant, NativeMap, MobileReleaseEvidence]
observability: [mobile_request_failed, mobile_session_expired, mobile_build_verified]
rollout: Android development preview first; owner visual review before extensive release checks; signed test APK only after required workflows pass. Play publishing is deferred by owner. Keep production deployment unchanged; the owner separately authorized web workspace consolidation on October 6.
---

# Native application — implementation in progress

October 7 account correction: signup offers Fleet transporter and Independent
driver only. Former owner-operator/self-managed identities normalize to the same
independent model without losing IDs/history. Independent My truck manages one
active truck; Home retains its dominant map and floating signal controls without
a truck selector. Ownership/permission is declared on registration. Change truck
requires explicit confirmation and preserves historical records; unfinished
Tracking blocks it. No independent add-driver/fleet/restoration control. See
FEAT-FLT-001, including server/SQL authority and old-client/race denials.

## Capacity status and accepted loads — October 7 owner correction

The owner's later correction also requires explicit Public / Private network /
Public + private network / Exclusive to one email sharing choices on web/native.
Use the shared FEAT-SHR-001 server contract, keep recipients' identities private
in visitor projections and preserve named contacts' private-feed inclusion in
Both. Exclusive changes are atomic and enforce one email plus no public exposure;
additional grant commands cannot bypass it. A mode badge describes actual saved
authority, never a client draft or a claim that transport has been booked.

Given available Empty and Partial trucks overlap on the public or authorized
private map
Then every native cluster contains exactly one status, names Empty or Partial,
and uses the same green or yellow as that capacity signal. Opposite-status
clusters and nearby truck markers remain separately touchable. Source-local
cluster IDs cannot collide; expansion uses the source that produced that cluster.
Selection still removes all other trucks/clusters and closing restores the map.

Given an Empty truck accepts full-truck loads only, shared loads only, or either
Then its unselected marker and on-demand details expose that saved preference;
unknown flags never default to a full-load claim. Native public/private parsing
retains only the authorized accepted-load flags, not private contacts.

Given an authorized provider sets Empty capacity on Home or fleet capacity
Then the three accepted-load choices are visible beside current space, not
hidden among optional stop preferences. Partial exposes remaining shared space
without a full-load option. Saving uses the same command and permissions as web.

Given a visitor uses Space needed and Truck's current load
Then full truck matches only Empty records accepting full loads; shared space
matches Empty shared-only/either and Partial shared records. Physical occupancy
is labeled separately, never presented as the driver's accepted-load preference.
The existing contradictory-filter repair and scoped public/private search remain.
All fixed labels are translated in the five supported languages; user data is not.

Focused evidence must cover mixed/coincident cluster counts and expansion, saved
preferences across both clients, partial exclusion, private/actor denials and map
touchability. Owner visual review precedes full release gates/publication.

Given the assigned driver tests from the U.S. or another valid worldwide position
Then native capture, first location, projection/map and existing Tracking location
commands accept the obscured fix using the shared world bounds. Zero coordinates
are preserved; dateline longitude wraps safely. No nearby catalog town produces
a neutral approximate-area label instead of a misleading Ethiopia label. Invalid,
missing or non-finite values, invalid radii, revoked assignment and unauthorized
owner device location remain denied. Physical travel/background claims remain out
of scope; use controlled local GPS plus actual save/readback evidence.

## Local browser preview — owner request, October 6

October 8 map/sharing correction: native overview markers omit accepted-load
text; selected truck details and shipment-space matching retain it. Network asks
for a private person/company label when adding an email and provides inline name
editing for existing grants. Exclusive capacity requires the label in the same
atomic save. Names are never visitor search/filter inputs or identity proof.
Controlling scenarios and evidence: FEAT-CAP-001 / FEAT-SHR-001.

Given the owner opens the dedicated localhost Expo preview
Then render the same React Native screens, navigation, forms and detail modal;
use MapLibre GL JS for real browser map geometry/selection and MapLibre Native on
Android. A browser pass is not Android permission, signing or installation evidence.
Native credentials remain in SecureStore. The local browser preview uses only
tab-scoped session storage, refuses hosted preview session persistence and proxies
its allowlisted API/assets to the existing local Loadgistic backend. Do not add
hosted CORS permissions or forward requests to production for this preview.
Check public map selection/modal/return, navigation and actual local OTP login,
including refresh/sign-out and retained server authorization. Keep preview running.

## Runtime decoder compatibility and language completion

Given the pinned Expo Router dependency calls the older CommonJS query-string parser
Then use the patched 0.5.0 URI decoder through a tested default-export adapter.
Installation must fail on an unrecognized consumer source/version instead of
silently patching a new version. Preserve normal query arrays, Unicode, sorting
and native routing while malformed percent-encoding completes in bounded time.
Retain the native link validator as defense in depth. The runtime decoder finding
can close only after installed-parser tests and native/browser bundling pass;
build-tool advisories remain independently visible and assessed.

Given a transporter or visitor selects a supported language
Then fixed native workflow labels/help use the chosen language, including account,
fleet, tracking, private sharing and document review. Never translate record names,
user descriptions or contact details. Require catalogue coverage and placeholder
parity, plus a phone-size visual check; coverage alone is not a fluency guarantee.

## Release prerequisite: ambiguous upload saves (NR-15 / WEB-MOB-001)

Given a private file has been stored and a command may have committed its reference
When the save response is lost or subsequent notification/cache work fails
Then retain the object, report the failure and never automatically retry the write.
Only an explicit PostgreSQL transaction rejection permits immediate cleanup of the
new object. Existing committed references must remain readable. Unknown outcomes
may retain private orphan objects; reference-aware reconciliation is separate work,
and no age-only deletion or public access is introduced. Apply this contract to
shared verification/payment/profile-image and native/web Tracking proof saves.
Verification: injected commit/response-loss and explicit-rejection tests, plus
adapter wiring and existing successful upload/access checks. No schema change.

## Web phone navigation parity — owner correction, October 6

Use `PublicMobileNav`, `PublicHeader` and `AppShell` as the design baseline:
public Capacity / Track / Featured / About bottom navigation; the web's role-aware
Home / Fleet or assigned truck / Tracking / Network / Account workspace destinations.
Reuse Lucide line icons, teal active states, white surfaces, border colors and
existing labels. Account embeds personal, business, document and plan controls; the compact
global menu exposes supplementary actions and a separate language panel. Do not design a separate mobile product or duplicate top-of-map
navigation links. Native safe areas, keyboard avoidance and touch targets adapt
the established web design. Customer content remains untranslated.

Given a guest, signed-in provider, company driver or access-limited member
When they navigate through the app or open its menu
Then primary destinations stay visible, the active section is identified, and
workspace choices reflect the current verified session. Public browsing and email
visitor Tracking remain separate from provider Tracking. Admin/staff management
never appears. Menu visibility is not an authorization boundary; APIs still check.

Owner approved the icon/navigation direction on October 6, with a correction:
do not reproduce the web's overloaded More menu. Account groups personal details,
security, public business profile, and documents. Fleet groups
trucks/drivers with capacity and regular service; company drivers enter their
assigned truck instead. Support remains one tap away in the workspace header.
Both areas are directly selectable above the page; the global menu contains
supplementary actions rather than repeating navigation or every settings page. Existing routes and server permissions remain intact. Dashboard work actions
precede secondary statistics. The owner also authorized the analogous web correction (FEAT-IAM-001/FLT-001/VER-001).

Given each provider role opens the new Account or Fleet section
Then existing permitted controls remain reachable in their related section,
company drivers do not gain fleet-owner controls, and restricted accounts retain
account/security and Support without operating links.

Owner clarification: grouping links alone is insufficient. Account must contain
the actual personal, photo/security, business-profile, regular-service, document
in expandable sections. Fleet truck/driver entries contain their
own relevant capacity and document controls. Mount a section when first requested,
then preserve its unsaved draft when collapsed; never cancel an in-flight save by
unmounting it. Avoid nested page scroll containers. Existing standalone routes remain
valid for compatibility, but the ordinary workflow does not require visiting each.
Only subjects returned by existing authorized APIs can appear; contextual document
views narrow by both kind and ID, never grant access. No API/schema change.

Verification: role/limited-access section policy; document kind-and-ID matching;
Android expand/edit/collapse/reopen draft preservation and same-page save/readback;
existing file/operation authorization tests. Do not count merely visible sections
as working controls. Owner reviews the consolidated screens before release gates.

Given a keyboard or modal opens
Then navigation cannot cover its fields/actions; closing the menu, Android Back,
and returning to Capacity remain usable. Selecting a tab does not sign out or
clear private grants. Existing deep-link URLs remain valid.

Implement in order: (1) record web parity and role contracts, (2) add SDK-compatible
Lucide/SVG icons scoped to the mobile package, (3) shared shell/menu and dashboard
links, (4) focused role/navigation checks plus Android screenshots and interaction,
(5) owner visual review before full release gates. Native rollback restores the prior shell and compatible standalone screens. The
owner-added web consolidation is separately covered by FEAT-IAM-001/FLT-001/VER-001;
its UI and guarded form-return changes can be reverted independently. No hosted
configuration or database schema change is part of this slice.

## Capacity editor map completion

Given an authorized provider edits current capacity or regular service
When catalog cities are selected or a saved signal is loaded
Then a read-only MapLibre preview shows the complete route or closed service area.
City coordinates come from the catalog; commands still submit only place references.
The preview never turns an invalid or missing intermediate point into a shortcut,
and it does not imply road navigation. Incomplete choices retain their form values.

Given the assigned driver shares a fresh approximate location
Then the editor can show its privacy circle without a precise-position marker.
The preview does not grant owners permission to publish another driver's device
location. No schema or public driver-location projection is changed by this step.

Verification: pure route/area geometry, strict native command/projection tests,
local saved/new place roundtrip, and Android visible route/area preview. Preview
failure leaves editing and server validation usable. Rollback removes only preview
rendering and its optional catalog coordinates, preserving existing stored signals.

Given a guest opens the application
When Capacity or Featured is selected
Then actual server-authorized public data is displayed without account creation
And only matching available truck-and-driver signals appear on the map
And public results never contain private contacts, identifiers or files.

Given a visitor verifies an email for Tracking or privately shared capacity
When the application accesses or changes its session
Then the server enforces the existing scope, revocation and 30-minute idle rules
And private data is removed on logout or expiry, including return from background
And a web cookie is never treated as a native bearer token without an explicit verified adapter.

Given a transporter, company Driver, owner-operator or self-managed Driver signs in
When workspace data or actions are requested
Then current actor, organization and assignment authorization is enforced on the server
And no admin, support-staff or brokerage-staff management screen is included
And native credentials are stored using platform secure storage, never shipped service keys.

Given the mobile map renders
When signals overlap, filters change or the user pans and zooms
Then the existing automatic discovery, geometry, selection and reset behaviour is preserved
And MapLibre renders OSM tiles with attribution and compliant caching, without offline tile downloads
And foreground location is requested only for a user action; background tracking is not introduced implicitly.

Given a test APK is offered
When its release checklist is evaluated
Then each required screen and action has connected API, permission and device evidence
And incomplete workflows block a feature-complete claim and release to external testers
And signing material, local configuration and production credentials are excluded from the source bundle.

Tests: focused mobile domain/API/device tests will be added with each vertical slice. This spec is not complete until the workflow matrix in docs/MOBILE_IMPLEMENTATION.md has evidence for every required row.


## Native account session contract (implementation slice)

Given a transporter requests an email code from mobile
When the request is handled
Then the existing durable account/IP rate limits apply, account existence is not
revealed, and a signed mobile-only email handoff expires after 15 minutes.

Given a mobile client submits an email code and handoff
When verification succeeds
Then the authenticated email must match the signed handoff and the caller-bound
identity projection must match the verified Supabase user. Active TRANSPORTER
and DRIVER accounts may enter the app; staff/admin roles are denied. Inactive
accounts receive only a verified onboarding/invitation state when the existing
services establish eligibility, never an operating workspace.

Given an authenticated mobile API request
When a dashboard or account projection is requested
Then the bearer token is verified with Supabase Auth, current identity and access
are reloaded, and caller-supplied actor/organization identifiers are ignored.
Cookies alone cannot authenticate mobile routes. Subscription restrictions remain.

Given the app restarts, refreshes, signs out or loses account access
When session state changes
Then only the refresh credential is held in platform secure storage, access tokens
stay in memory, refresh rotation is saved, and logout removes private UI/session
state. Failed or revoked credentials cannot leave an old dashboard usable.

No hosted Auth configuration, schema grant or browser mutation guard changes
are part of this adapter. Tests must cover forged/missing bearer, staff/inactive
identities, mismatched projections, expiration and failed refresh/logout.


Implemented slice tests: tests/mobile-identity.test.mjs and
scripts/verify-mobile-account-local.mjs. Native secure-storage lifecycle, fleet
invitation device acceptance and full feature matrix remain pending.


## Capacity management adapter (current implementation slice)

Given a signed-in provider opens Capacity
When their trucks and saved signals load
Then only the caller-authorized workspace is projected, without private file paths.
Owners may edit their fleet signals but cannot submit their own device as a driver's
location. An assigned driver may bootstrap an approximate location before the
owner publishes a first signal, including when capacity editing is restricted.

Given a provider saves availability, coverage, accepted loads or sharing
When the mobile command is validated
Then the same existing PostgreSQL commands enforce assignment, workspace access,
route/area requirements, private-by-default sharing and supported location radii.
Unknown actor fields, invalid coordinates and invalid place references fail closed.
A failed save preserves the draft and a successful save reloads persisted state.

Given a driver chooses to update truck location
When foreground location permission succeeds
Then exact device coordinates are obscured on the phone before transmission, using
the same pure privacy function as the web app. Denial, an unsupported location or a
20-second timeout leaves the previous location unchanged. No background task starts.

Negative evidence maps to NR-02/03 (existing command authorization), NR-09 (current
actor/assignment), NR-10 (no exact device fixes/private paths in responses or logs),
and NR-13 (owner device review before a release). No database or hosted config change.

### Driver Home and foreground capacity movement — October 6 completion

GIVEN a driver has operating access, WHEN Home opens, THEN show their assigned
truck's capacity and location controls directly, including first-use location and
capacity setup. Company drivers retain the owner's existing editing permissions;
an unassigned driver sees assignment guidance rather than an unavailable action.

GIVEN an assigned driver is on duty and has already granted foreground location
permission, WHEN Home or Truck capacity remains open and a location update is due,
THEN re-read assignment/duty authority and save only the obscured device fix,
at most once per ten-minute cadence. Preserve capacity status, coverage and sharing.
Update the visible approximate area and saved time from server readback. The
authorized workspace projects only saved approximate coordinates for a Home map
showing the privacy circle and current route/area; absent or invalid coordinates
do not create a pin. No precise device coordinate is added to this response.
Automatic refresh never prompts repeatedly for permission. Manual Share/Refresh
can request permission and bootstrap location before the first capacity signal.

GIVEN Android already grants foreground location (including approximate access),
WHEN the driver manually refreshes, THEN reuse that grant without another precision
upgrade prompt. GIVEN a first permission request is needed, WHEN its system dialog
returns to the still-focused active screen, THEN start the GPS cancellation window
after consent. Leaving/locking during the subsequent GPS capture still discards
the result. Permission denial never captures or submits a location. Keep the
chosen privacy radius and reject fixes too inaccurate for it.

WHEN the screen blurs, the app backgrounds/locks, an editor opens, assignment is
removed, duty is off or permission is denied, THEN stop automatic submission and
discard a late captured fix. Failed capture/save preserves the previous location
and offers manual retry. No background location service or new permission is added.

Verification: native foreground-capacity policy/pipeline tests, existing mobile
capacity authorization tests and local driver Home browser workflow with simulated
movement, offset-coordinate readback and paused/Off Duty denial. Owner visual
review and physical Android movement/permission verification are separate gates.

Physical Android review also requires non-overlapping logo/workspace-switch bounds
and readable search text/hints regardless of the phone's system color theme. Match
the accepted web layout using explicit sizing/colors rather than relying on browser
flex shorthand or Android's default input colors. Verify actual native bounds and
focused phone/browser appearance; compilation alone is insufficient.

### Map-dominant driver Home — October 6 owner correction

GIVEN a driver with operating access opens Home, THEN the map fills the available
workspace beneath a compact assigned-truck/status row. Do not place profile setup,
recent shipment lists or a scrolling stack of dashboard cards before the map.
Show only saved approximate location and current capacity coverage; before first
location, render an unmarked map with clear setup guidance rather than inventing a
truck position. Existing Tracking, Fleet, Network and Account navigation remains.

WHEN the driver wants to change a signal at any time, THEN a floating Update
capacity action remains visible over the map without scrolling or opening a menu.
A separate floating Share truck location action captures and saves an obscured fix.
Owner clarity correction: use three understandable tasks, not six configuration
categories. Capacity sets available space now, the route/area for that space,
and who can see it. Load preferences and pickup/drop-off options live inside
Capacity under an optional disclosure. Regular service describes routes/areas the
provider usually serves and stays distinct from current truck availability.
Location controls the assigned driver's approximate position and privacy radius.
Visible labels are Available space, Usual routes and Truck location. Each opens its own focused editor. First Capacity setup includes any required
location/coverage fields; never pretend an incomplete signal can publish. Hide
controls the driver cannot manage; restricted company drivers retain Location
and duty controls. Keep the separate one-tap location refresh. Stack these three
floating tasks vertically at the map's right edge. Use clear icons and short
explanations inside each editor. On short/landscape screens the compact rail can
scroll vertically; the map itself does not scroll away.
An editor opens above the retained map with the existing route/area, load, privacy
and duty controls, respecting fleet-owner permissions. It can scroll for longer
forms; close/back cannot dismiss an in-flight save. Successful saves and manual
location changes refresh persisted state. Opening/closing without changes preserves
map camera position. Unassigned drivers receive assignment/setup guidance.

Verification: focused browser phone/landscape geometry, editor save/readback,
manual first location and retry, denied permission, restricted driver permissions,
and native emulator appearance/actions. Owner visual approval remains required
before full release gates. Simulated emulator fixes are not physical movement.


Capacity slice evidence: tests/mobile-capacity.test.mjs,
apps/mobile/tests/location-privacy.test.mjs and
scripts/verify-mobile-account-local.mjs. Native first-use owner-operator workflow
and persisted capacity/account screenshots are recorded in MOBILE_IMPLEMENTATION.
Full native role/device matrix, owner visual approval and release remain open.


## Native provider Tracking slice

Given a permitted transporter opens native Tracking
When they create a shipment with an assigned truck, catalog route, cargo and
customer email
Then the existing create command stores the shipment and recipient outbox together.
The native response contains only its durable id/code, never reusable access codes.
An ambiguous network failure directs the user to their list before trying again.

Given an authorized provider opens a shipment
When they select a permitted journey step
Then no change occurs until Save; recorded/current/next/remaining states reuse the
web presentation contract. The database still enforces transitions, current fleet
permission and assignment. Problems require a note; terminal records cannot change.
Only the assigned driver supplies obscured foreground location for travel updates.

Given the provider manages recipient emails
When adding or revoking access
Then current shipment authority is rechecked, the owner cannot be revoked, the
outbox retains failed deliveries, and the UI reloads persisted recipient state.
No recipient credential, proof storage path, digest or email failure detail enters
native JSON. Private proof upload/view and complete recovery device coverage remain separate pending rows
until implemented and tested; their absence prevents a complete Tracking claim.

Tests must cover actual cross-provider denial, permission revocation, invalid and
terminal transitions, owner travel-location denial, recipient owner protection,
email delivery to local Mailpit, and persisted native progression. NR-03/09/10/13
apply. No schema or hosted settings change; native rollout remains separate.

Given an owner corrects, reassigns or cancels a native shipment
When the command is submitted with the displayed revision and a reason
Then the existing lifecycle command rechecks ownership and current revision;
loading locks the route, cancellation requires explicit confirmation and ends
guest access while retaining history. Company drivers cannot inherit owner-only
recovery powers from Tracking permission. Stale drafts must be reloaded, not retried
automatically. Native recovery remains unverified until local command/device checks.

## Native verified-email visitor adapter

Given a guest verifies their email for Tracking or private capacity
When native access is issued
Then the existing one-time-code services and shared web/native rate-limit budgets
apply. Mobile-only signed subjects separate provider, browser, Tracking and capacity
sessions. Email scope comes from a signed handoff, never a supplied digest. No OTP
or reusable legacy shipment access code is returned, even in development.

Given a visitor returns from background or opens a private screen
When the thirty-minute idle deadline has passed or a grant was revoked
Then private data clears and the server rejects access. Renewal follows user
activity, not background polling. Tracking retains the existing eight-hour absolute
limit; capacity retains its existing thirty-minute renewable session semantics.
The visitor credential is held separately from provider login in secure storage;
logout clears that scope only. All data queries recheck live recipient grants.

Given a verified visitor requests shipment details or writes a review
When the server checks the current grant
Then only shared shipments are visible and only the customer owner may publish
a single eligible review. Browser cookies and other native scopes cannot authorize
these endpoints. Private capacity uses the existing scoped catalog projection.
Tests include expired/malformed/cross-scope tokens, replayed OTPs, live recipient
revocation, unknown-email responses and idle/background clearing. No migration or
production configuration change. Local adapter/controller/integration tests pass; complete native device evidence remains pending.

Given a provider opens native network sharing
When adding/removing an email or changing Loadgistic access for a truck
Then the existing truck-specific permission command applies; a restricted company
driver and another owner cannot manage that truck. Changes reload persisted grants.
Recipients see only currently available assigned trucks, and removing access takes
effect for an already verified native visitor. No email-verification requirement
is imposed on the provider adding an address.

Given a new provider has an unpublished transporter profile
When they configure native truck capacity or sharing
Then the app explains that publication is required for discovery and links the
owner to the existing profile editor. Publishing requires a catalog base city and
region. Public contact visibility remains explicit and login contacts stay private.
Company drivers cannot edit the owner profile. Native profile image uploads remain
pending until the private-file boundary is implemented; no placeholder upload action.

Given a phone clock differs from the API clock
When a valid native visitor session is verified, renewed or restored
Then server issue/expiry timestamps define its remaining lifetime, anchored to the
local request-start time conservatively so network delay cannot extend access.
Client clock skew must not reject a valid code. The server still enforces expiry,
live grants and the Tracking absolute limit; no token-validation leeway is added.

## Native fleet completion

Given an owner manages a truck or company driver on mobile
When editing truck details, selecting a supported attached trailer, retiring or
restoring a truck, updating contact details or removing fleet access
Then strict actor-bound commands reuse existing services; company drivers and
unrelated providers cannot acquire owner authority. Retiring/restoring requires a
reason and explicit confirmation, retains history and respects active Tracking
locks. Removing a driver requires confirmation and terminates assignments/access.
Owner screens reload persisted data, expose paginated retired trucks and existing
legacy invitations, and keep submitted email separate from editable driver contacts.

## Native private documents and shipment proofs

Given a provider submits a document or a shipment proof from mobile
When the server receives multipart data
Then the actor is authenticated before reading a bounded body, only one file and
one strict JSON command are accepted, and existing file-size, content inspection,
quarantine, subject/assignment and workflow permissions apply. Document review is
attached to its actual company, driver or truck; ownership and permission-to-use
remain distinct options. Permission-to-use requires the relevant truck and expiry.
A rejected update cleans up its uncommitted private upload.

Given a provider or verified Tracking recipient opens a private file
When current subject/shipment access is checked
Then only that authorized file is returned with no storage path or public URL.
Cross-owner, cross-shipment, revoked and cross-session access must fail. Native
images close when the screen loses focus or the app backgrounds; exported PDFs
use an explicit device share action and temporary app cache files are removed.
Document selections are cleared after success and never treated as submitted until
readback confirms the record. Failed/ambiguous submissions direct users to refresh
before retrying. No schema, bucket or hosted settings changes are needed.

Given an assigned driver keeps a native location-and-status shipment open
When its status is Going to pickup or On the way
Then approximate location refreshes at the existing ten-minute cadence while the
screen is foregrounded. Blur/background invalidates late GPS results, requests do
not overlap, and terminal/reassigned/revoked shipments cannot continue publishing.
The screen states this behavior; no background service or precise location is sent.
Guests see the reported uncertainty area and its age, never an exact truck pin.

Given an owner chooses or removes their native transporter portrait
When saving through the profile image action
Then the existing reviewed image storage command applies; company drivers and
unrelated users cannot update it. The mobile response exposes the same published
image URL as the public profile, never a private storage reference.

Given a provider opens Account or an old billing deep link
When the current app renders
Then no plan, trial, subscription or payment form is shown
And the old link returns to Account; stale billing writes are rejected before upload
And workspace access depends on current identity/ownership/driver permissions,
not billing status (FEAT-BIL-001). Historical records remain protected and retained.

Given a transporter owner manages their regular service on mobile
When adding, replacing or removing its route or service area
Then the existing single-service limit and atomic replacement apply; real catalog
cities are required and company drivers cannot change the owner's service even
with truck capacity permission. Another owner cannot target that service. The app
reloads saved data and asks before removal. Current truck availability stays separate.


## Native transporter member support

Given an active transporter or driver, regardless of historical billing state
When they open Support from their account
Then their current chat and paginated closed history come from the existing member
support service; no staff inbox or another member's conversation is exposed.

Given a member starts a chat or sends a message
When a strict native command is received
Then server identity, supported topic, bounded text, rate limits and current
conversation ownership/status are checked by the adapter and existing database
commands. One active chat remains the rule; intake and replies reach web staff.
Optional reply attachments use the existing reservation-based attachment service
and each private read rechecks actor/conversation access. No public file URL is returned.

Given the member views an active chat
When a staff reply or assignment changes
Then foreground polling refreshes the conversation without erasing the draft.
Polling stops while backgrounded, blurred, closed or reading older messages.
Failures show a retry state rather than implying an agent is online. Older messages
are cursor-paginated; returning to latest resumes updates. No push delivery is claimed.

Given a member ends the chat with confirmation
When closure succeeds
Then the transcript remains in history, further replies are rejected and the
member can start a new chat. Unknown fields, forged identity, cross-member reads,
attachment reads and mutations must fail; logout cannot leave private chat visible.

Given a member selects a supported language
When they open Support, choose a topic, read history or end a conversation
Then app-owned topics, status, pagination and action labels use that language.
Agent names and message text remain unchanged; dates use the chosen locale.
Unknown server errors retain their original explanation with a translated retry
instruction. This does not assert that every other mobile workflow is localized.

Implementation order: strict projections/commands and bearer routes; connected
member list/thread/attachments; local permission and staff-roundtrip integration;
Android visible-control review. Full release/owner review gates remain outstanding.
No schema, staff-management UI or hosted configuration change is required.


Native upload regression: SDK 57 installs expo/fetch globally. Native multipart
parts must be actual Expo File/Blob values, not legacy React Native URI descriptors.
Verify selected bytes reach the server and read back on Android for the shared
upload control; an HTTP integration test from Node is not native transport evidence.


## Native account security

Given an active provider, regardless of historical billing state
When they request an email change or history-preserving account closure
Then a short-lived native-only handoff binds the actor, action and target; a fresh
code goes only to the current verified login email. Request/confirmation rates are
bounded. Browser cookies and login handoffs cannot authorize this operation.

Given a current-email code is verified for that exact handoff
When changing login email
Then the existing Supabase secure email-change confirmation is requested without
altering hosted settings; the existing mobile session remains in place and the temporary reauthentication
session is closed; the app explains the inbox confirmation links and checks authoritative completion when the
user returns. An unconfirmed request must not be described as a completed change.

Given closure is requested
When active-work blockers exist or change before confirmation
Then the current blocker list is shown and the database refuses deactivation.
Otherwise a fresh verified code and explicit DEACTIVATE confirmation deactivate
access while preserving shipment, audit and file history; stale sessions cannot
resume work and the app clears its sign-in. Staff accounts remain web-only.

Tests must cover cross-actor/action/target/expired handoffs, replayed codes, invalid
inputs, blockers, email confirmation roundtrip and post-closure access denial with
isolated local accounts. Native UI review and shared session storage failure/race
checks remain required before release. No account deletion or provider settings
change is part of this flow.

Local verification must explicitly enable email confirmations and double-confirm
email changes. The first inbox link leaves EMAIL_PENDING; only the second completes
the change. This affects the isolated development stack only, never hosted Auth.

## Native provider credential lifecycle

Given refresh or login is in flight when the member signs out
When a response arrives later
Then it cannot restore private UI or saved access; any newly issued discarded
session is revoked. Concurrent refreshes share one request; an earlier request
cannot override a later account.

Given secure-storage removal fails during sign-out
When the app clears access
Then it tries a non-credential tombstone, blocks automatic restore in that process,
and offers an explicit retry if neither local removal nor server revocation was
confirmed. A storage failure must never be presented as confirmed device cleanup.
Given storage fails while saving a new session
Then that session is not exposed to screens and its server credential is revoked.

## Native public profiles and Featured

Given a guest opens Featured
When the existing published programme loads
Then native cards show the real truck/driver pairs, their public portraits, truck
configuration illustrations, sponsor disclosure and Ethiopia-time intervals.
Weekly themes, empty days and manual schedules preserve FEAT-FTR-001. Reading
the page never generates or publishes a roster. A refresh failure is visible.

Given a guest opens a published transporter profile
Then about, services, published contacts, reviewed-document details, regular service
and shipment reviews appear before its fleet. One truck is immediately visible;
larger fleets expand explicitly and retain the backend's twelve-item pagination.
Only public projections are accepted: no private record IDs, source document paths,
internal notes or unpublished contacts are added. Badges describe specific review
status, never a blanket guarantee. Invalid/unpublished handles return not found.

Given user-entered contacts or URLs are displayed
When opened from native UI
Then only validated http(s), phone, email or explicit public asset paths are used;
arbitrary app intents, embedded credentials and private storage paths are rejected.

Focused evidence required: hostile extra-field projection tests, unpublished/invalid
handle denial, bounded paging, real local public reads and Android navigation,
expand/paging, empty/error and external-action checks. NR-10 and NR-13 apply.

Native logout must not return success when establishing the session failed because
of transport/provider unavailability. Only an explicitly invalid/already-revoked
credential is idempotent success; other errors keep the native retry visible.

## Native driver portrait

Given a signed-in Driver (company, owner-operator or self-managed) opens their photo
When they upload an image with explicit public-display consent
Then only their own Driver portrait changes through the existing reservation,
normalization and activation services; owner accounts cannot upload for a driver.
Missing consent, PDFs, oversized/invalid images and extra actor fields are rejected.
A confirmed removal withdraws public access while preserving unrelated evidence.
The native preview reads only the existing public portrait URL, never storage paths.

## Native Arrange transport conversation

Given a guest supplies route, name and phone
When they start Arrange transport
Then a private live brokerage conversation uses the existing seven-day request
authority, assignment, messaging and follow-up services. No provider login or email
is required and no staff management UI is added. A native signed capability has a
distinct purpose from browser cookies, provider login and other visitor grants.

Given submission/reply times out after a possible commit
When the visitor retries the same operation
Then the persisted request/message key deduplicates it; the draft remains on failure.
Cryptographic randomness uses SDK-compatible Expo Crypto, never Math.random.
The capability and pending intake are saved in SecureStore before the first write.

Given the visitor ends messaging
Then messages remain readable until the existing expiry and staff retain the request
for telephone follow-up. Only staff resolve it. Starting again is an explicit new
request, not a silent retry or deletion of history. Assigned staff replies update
while the screen is focused; there is no false online/push-notification claim.

Tests cover capability forgery/purpose/expiry, other-request access, duplicate
request/message retries, private staff-field exclusion, end/read/send denial,
SecureStore failure, late responses and foreground-only refresh. Browser CSRF,
DB permissions and hosted Realtime publications remain unchanged.

Given a conversation refresh started before a send/end action
When its stale response arrives after that action
Then it cannot remove the confirmed message or reopen an ended conversation.
Refreshes do not compete with an in-flight write; the next focused poll can resume
after the write completes.

## Native discovery parity

Given public or verified-email discovery is selected
When a visitor searches names, handles, public descriptions or office cities
Then profile cards and map trucks use the same existing search/filter authority;
companies are cards only and only available assigned driver/truck pairs are markers.
Native private search binds the verified capacity grant, never a caller-supplied
digest or staff audience. No private session or private results persist in public
search state. No managed search service or new database matching logic is added.

Given truck filters are opened
Then configuration images, space needed, availability, truck city/distance, shipment
route, stops, freshness and entity-specific reviewed documents use existing filters.
Filters live in a lightly shaded modal, profile results in a collapsible panel.
Cancel preserves applied values; Clear all resets search, filters, selection and map.
Full-truck space cannot silently combine with a partial-only availability selection.
Invalid filters produce a visible error, never silently broader results.

Given a truck is selected
Then reported location is blue, current capacity geometry uses its status colour
and regular service is brown with its separate meaning. Existing display-only
parallel-path separation also handles partially shared legs and closed boundaries;
it cannot change coordinates sent to matching or persistence. Cluster counts and
truck configuration images replace placeholder-only markers. Cluster taps zoom
automatically; coincident trucks remain individually selectable at maximum zoom.
All scoped cursor pages load automatically without an arbitrary discovery cap.
Native marker views must stay clipped to the map while panning/zooming; an offscreen
cluster cannot paint over the search input, sharing tabs or navigation.
An invalid point invalidates its display path; dropping it must not create a new
straight route or closed boundary between the remaining points.

Evidence: filter/search permission tests, malformed projection/coordinate tests,
reset and cancellation races, partial/reversed/closed geometry separation and
focused real local search reads; Android pan/zoom, cluster/overlap, filters, results,
private access expiration and Clear all walkthrough before visual approval.

## External native links

Given an external link opens the installed application, either cold or warm
When the native intent boundary processes it
Then only bounded, well-formed Loadgistic routes and their declared public identifiers
reach Router; malformed encoding, foreign origins, credentials, duplicate parameters
and unexpected parameters go to a recoverable link-unavailable screen.
No incoming link supplies an access token or bypasses existing account/visitor checks.
Canonical relative paths prevent a second decoding pass before Router's query parser.
Development-client launch URLs are recognized only in development, for loopback
Metro ports; they open home and cannot inject routes or credentials.

This contains one native entry path affected by GHSA-vcc3-ghjq-m6fr; it does not
remove the vulnerable transitive dependency or establish safety for Expo web.
Keep dependency findings visible until compatible upstream remediation is verified.
Evidence must include parser tests using installed query-string, cold/warm Android
links, malformed input recovery and preserved authorized navigation. Rollback must
retain an equivalent validation boundary while the affected decoder remains installed.

## Native information and language preference

Given a visitor opens About
Then native content explains public/private capacity, direct transporter contact,
shipment collaboration and the limits of document review using the existing product
copy. Capacity and transporter entry remain accessible without creating an account.
Privacy and terms open the published website in the phone browser; mobile must not
silently rewrite unresolved legal wording (WEB-MOB-006).

Given English, Amharic, Afaan Oromo, Somali or Tigrinya is selected
Then app-owned messages use the shared catalogs and a device-local saved preference.
Names, handles, routes, descriptions, messages and other user content are never
passed through translation by generic text components. Missing app-owned translations
fall back to English without breaking the screen. Storage/catalog errors preserve
the last usable language and expose retry; a late initial read cannot override a
newer choice. Coverage is recorded separately: a selector alone is not full localization.

## Focused truck map — October 6 defect correction

Given a public or authorized private capacity map with multiple trucks
When the visitor selects one truck
Then only that truck marker and its permitted signal geometry remain visible;
background clusters and truck touch targets disappear immediately, including while
an earlier native rendered-feature query is pending. Selecting does not remount the
map or request the discovery feed again. Completing an in-flight initial load must
not fit the camera back to all trucks. Closing selection restores the loaded marker set.
Verify pure focus policy plus Android selection/close with a populated local feed.

## Explicit public/work area switching — approved October 6

Owner chose two areas: Marketplace and My workspace. Signed-in transport providers
see the current area in a consistent header switch, with both choices clearly
named. Each area keeps its short existing bottom navigation and separate navigation
history. Switching areas preserves the current child screen and unsaved in-memory
state; it is not logout, back-to-home or a session refresh. Returning to the market
preserves search/filter/selection state. Guests retain public browsing plus login;
admin/staff never receive a native operating workspace. Account identity changes
reset private workspace navigation/drafts. Existing external URLs remain valid.

Implementation uses the installed Expo Router JavaScript Tabs with two nested
Stack route groups; the area switch selects the parent group without selecting a
new child route. No new dependency or experimental headless navigation API.
Verify route classification, legacy links, four-language switch labels, Android
switch/return draft retention and Back; review new shell before release gates.

Refocus regression: GIVEN an edited Account details form, WHEN the provider visits
Marketplace and returns, THEN a fresh account response must not overwrite unsaved
name/phone values. An unchanged form can refresh; successful save clears its dirty
state. Different account identity remounts the workspace so drafts cannot cross
accounts. Validate actual device field values before and after the area switch.

Native map rendering must depend on signal data, selection, loading and camera
state, not on each unsubmitted search keystroke. Memoize the map with stable parent
inputs; private-access and query changes must still reset its data boundary.

## On-demand map inspection — October 6 owner revision

Follow FEAT-CAP-001's on-demand inspection contract on native as well: selection
shows permitted geometry and small information buttons, not a permanent truck
sheet. Truck/location/capacity/regular-service information share one compact
scroll-bounded map-edge card with the matching outline color and semantic title.
Closing that card keeps selection; a separate back control restores all trucks.
No hover panel, map remount, camera refit or discovery fetch when inspecting.
Selection/query/private-access changes clear stale information. Signal buttons use
actual rendered offset paths and avoid the selected truck and one another.

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
information, and compact entity-specific document summaries on web. Use available
native projection fields only; do not invent contact/review data or widen APIs.
Keep all existing profile/call/document actions and hidden-location safeguards.
Ordinary collapsed content should use horizontal space before requiring scrolling;
long names, translations and expanded evidence must wrap/scroll without clipping.
Preserve the centered modal, dismiss/return behavior and unchanged map camera.
Focused desktop/phone review plus native static checks precede owner visual review.

## Navigation simplification — October 7, implementation in progress

Given an active transporter or driver browses Marketplace or My workspace
Then both area names remain visible as directly selectable header controls.
Selecting the other area takes one tap without a choice modal, keeps each native
stack's position and drafts, and does not sign out or change authorization.

Given the mobile menu is opened
Then it contains supplementary actions only: Arrange transport, Language and
legal links (plus account setup when needed). Primary destinations are not
repeated. Language opens its existing separate selection panel. Support remains
reachable in the provider workspace header; guests receive no staff/workspace
controls. Each area retains at most five labeled primary destinations.

Given the web provider returns between Marketplace and My workspace
Then safe tab-local return URLs preserve the last eligible destination and applied
query in each area. Only an allowlisted local route can become a return target;
recipient codes, credentials and private data cannot be stored. Public camera
position is restored on return; private feed results are always authorized afresh.
Native unsaved forms remain mounted; web switching is page navigation and does
not imply arbitrary web forms remain mounted. Deep links and staff menus stay
compatible. No new dependency or backend permission change.

Research: [Android layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns?hl=en)
recommends three to five peer primary destinations and contextual secondary
controls; [Expo navigation](https://docs.expo.dev/router/basics/navigation/)
distinguishes navigating an existing stack from replacing it. The installed
SDK57 reference was checked; preserve the existing two-group Router design.

Evidence required: focused role tests, web URL safety/camera restoration and
actual desktop/phone/Expo preview switch-return. Owner visual review, full gates
and rollout are separate pending states.

Account grouping refinement: personal details contain the driver's photo and own
documents; transporter profile contains usual service and company documents.
Self-managed/owner-operator identity and driver license remain on their existing
authorized PROVIDER_PROFILE subject and appear in the personal document section;
company-driver evidence remains DRIVER. Grouping never migrates or duplicates it.
Security remains a separate expandable section. Company drivers
receive no business profile controls. Truck evidence stays on the truck; filtering
a document section must match authorized subject kinds, never reassign evidence.
Lazy sections remain mounted once opened so nested drafts survive collapse/switch.

October 7 owner review clarification: the driver's Home in My workspace is the
map, not Account settings. Self-managed drivers, owner-operators and company
drivers retain map-dominant Home with ready signal controls. Account remains its
own primary destination for personal/business settings. Verify actual Home and
area-switch return, rather than presenting Account screenshots as Home evidence.


## Browser raster cancellation defect — October 7

Given the browser map no longer needs an in-flight raster image during zoom,
resize, switching areas or teardown
When the corresponding request is aborted, even if the retained tile's aborted
flag is false
Then cancellation is handled as an unloaded tile, not a failed image or uncaught
console error/Expo overlay. Current needed tiles and map interactions continue.

Given a genuine tile/network/decode failure without cancellation
Then it remains a failure and existing map error feedback is retained. Do not
suppress console/global errors or disable tile cancellation as a workaround.

Any temporary browser dependency adapter must validate the exact installed
package/version/source hash and target only Loadgistic's mobile folder. It is
idempotent on reinstall, rejects unexpected code drift and is removed after an
upstream-compatible fix is reviewed. It does not affect MapLibre Native, Auth,
private data, settings or another Expo project. Prove negative/error behavior and
actual browser console/zoom/return, not just absence of pageerror events.

Recurrence acceptance: test real fetch response-body cancellation after headers
as well as a loader rejection. A synthetic fetch returning an in-memory Response
does not establish the browser body-stream cancellation contract. Require actual
new cancellation counts after the intended interaction, and collect unhandled
rejection plus console events without preventing or filtering them. Cached tiles
or earlier cancellations must not accidentally satisfy the reproducer.

During this unresolved local defect, a temporary localhost8084 development probe
may report only map-code and browser-function booleans, viewport size, error class
and event type. It must observe without preventing/suppressing exceptions, omit
coordinates, identities, tokens, request URLs and error bodies, and remove its
listeners on teardown. Remove the probe after the specific failure is verified.
If needed to identify the injected fetch observer, the probe may temporarily add
a read-through URL getter to public OSM tile Requests only. Return the original
URL and exact fetch promise; inspect only script caller filenames/extension IDs,
never request/response content. Restore the original fetch on the last teardown.
For this investigation only, a bounded read-through getter may observe access to
the native Promise.then method and report public caller script frames. Return
the exact original method, attach no promise handlers and restore its descriptor
on teardown; preserve any subsequently installed method instead of overwriting it.

Browser raster transport: given a browser has a fetch observer that creates an
unhandled side-promise for cancelled requests, map tiles may use MapLibre's scoped
custom-protocol port and XMLHttpRequest. Only public OSM tile URLs are allowed;
no proxy, new service, global fetch replacement, credential or native-map change.
Cancellation settles once as AbortError, including pre-send and mid-body abort;
listeners detach on completion. HTTP, network, timeout and decode errors retain
normal map feedback. Keep browser caching and return expiry headers, attribution,
map style and interaction. Test an intentionally broken recorder before/after,
desktop HiDPI driver Home and marketplace, and real success/failure feedback.
Rollback restores the original HTTPS raster style and removes only this port.


## Chat alert/read-receipt extension — October 7 (planned locally)

FEAT-NOT-001 controls existing-chat unread alerts, explicit visible-message Seen
cursors and actual assigned-agent joining. Fetching, prefetch/history or a hidden
screen is not a new read receipt; old Support timestamps remain historical only.
Keep Support/Brokerage scopes, guest capabilities, private files and staff-web-only
access unchanged. Sound/system delivery is opt-in; closed-app push is not implied
by polling. Local implementation/permission/device evidence and owner visual
approval are required before publication.
