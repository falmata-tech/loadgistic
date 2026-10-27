---
id: FEAT-PRV-001
title: Truck-linked public transporter microsites
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-CAP-001, FEAT-MKT-001, FEAT-VER-001, FEAT-REV-001, FEAT-LST-001, FEAT-FLT-001]
problem: Transport providers need to be represented as credible businesses, while visitors need rich public context before making contact.
behavior: Fleet transporters and self-managed providers with current public trucks receive canonical `/@handle` microsites reached from truck details rather than a Provider Market, provider map, Area Market, or provider list. Providers manage accurate public contacts, business content, one general base region or federal city, and one validated profile image. Every microsite uses one Loadgistic-controlled white-space template and presents each active truck through a detailed safe card with a lazily opened relative map when that truck has current public capacity.
contracts: [ProviderMicrosite, MicrositeTruckCard, MicrositeTruckMap, PublicProviderHandle, ProviderBaseRegion, ProviderOperatingModel, ProviderProfileImage, SeededTransporterPortrait, SharedProviderTemplate, PublicContactPolicy, YouTubeVideoReference, ProviderPageCommand, PublicFleetProjection]
observability: [provider_page_view, provider_profile_update, public_contact_click, video_open, handle_resolution]
rollout: Add profile presentation fields and actor-scoped managed profile commands additively, reserve and validate handles, keep legacy provider URLs as redirects, and exclude all capacity-seeking Business profiles from public projections.
---

# Transporter public presence

## October18 chosen account identity — planned local implementation

All provider owners use the public label Transport Provider. A chosen Account
name is their main public identity, whether it is a person's name or a name for
their transport work. Their unique `@handle` identifies the same account. This
does not create a company category, change the provider's legal identity, or
establish ownership/permission over any truck. Existing legal first and Last /
father name fields remain distinct; the public Account manager is currently
derived only from the approved first-name projection, as explicitly confirmed by
the owner. No full legal name is inferred or published, and no separate public
manager-name editor is introduced.

### Scenario: one provider signup with a chosen public identity

Given a verified eligible person sets up a provider workspace on web or Expo\
When they choose an Account name and unique handle, enter their private manager
details and optional driving preference, and submit\
Then the existing provider signup command saves the public identity independently
of legal/business fields and roles\
And no company-versus-individual account selection appears\
And an invalid or already-used handle leaves the entered draft available for correction.

### Scenario: saved profile identity changes deliberately

Given a provider opens their saved profile\
Then Account name, `@handle` and the approved public Account manager appear in a
compact hierarchy before any form\
When they choose Edit profile, change Account name or handle, and save\
Then both clients display the server's saved identity and canonical profile link\
And Cancel restores the saved identity without a mutation\
And unavailable/foreign provider authority cannot edit another profile.

### Scenario: transporter search keeps public identity clear

Given a visitor searches a provider's Account name, public manager first name or
handle\
Then matching public provider cards lead with Account name and `@handle`, with
the manager first name as secondary public information when supplied\
And every provider card uses the common Transport Provider label, without old
company/independent labels or styling that implies stronger review\
And private legal last names, login contacts and hidden profile fields are absent\
And truck filters remain independent until Show trucks on map is selected.

Existing personal About/contact restrictions, public image safety, reviewed
truck authority and publication rules remain intact. Focused UI submission,
saved/cancel, privacy and localization tests precede actual desktop/phone web
and Expo Chrome workflows. No new hosted rollout is claimed here.

## October 14 Transport Provider profile — implemented locally

Use Transport Provider as the common owner label, with truthful reviewed-truck
summary and counts defined by FEAT-VER-001. Retain company business information
and first-name-only personal identity. No new employee public profile is created.
Only Live public-disclosable trucks count or appear; hidden/private Draft metadata
must not leak through full-fleet totals, search or pagination. Truck routes stay on
the actual truck/driver pair. Ownership evidence is not a quality guarantee or
an inferred legal category. Current search remains independent of truck filters;
explicit View trucks is its only map association.
Focused safe-projection and authoritative full-fleet count checks pass with the
reviewed source installed locally. Owner visual approval and hosted release
remain separate gates in `specs/TRACEABILITY.md`.

## October 13 personal public details and separate portraits — planned

FEAT-IAM-001 governs structured personal first name, private Last / father name,
safe historical fallback and explicit public callback editing. The owner's
clarification retains company business names, About and reviewed documents.
Independent personal profiles omit extra personal email/website/WhatsApp/About,
headline, registration location and introduction-video fields from public
rendering and search indexing; their truck/document facts retain their existing
subject-specific rules. Private registration location remains editable without
being a public office-city search field. Company office-city search stays intact.
No employee public handle/page is invented.

### Scenario: separate identity images with honest blank states

Given a transporter and its employed driver manage their public images\
When either uploads, replaces or removes an image\
Then the existing authorized transporter-image or own-driver-portrait command
changes only that subject\
And public truck/driver details use the driver's authorized portrait while the
transporter profile uses its separate transporter image\
And a blank company image uses a company icon and a blank personal image uses
a person icon, without a stock person's photograph\
And raw Storage references, hidden/moderated portraits and private account data
never reach public clients.

### Scenario: an owner previews an unpublished uploaded image privately

Given an owner uploads a validated transporter profile image before publication\
When their existing editor reloads its custom image\
Then the existing own-image reader serves only that actor's image through an
authenticated no-store response\
And anonymous and employed-driver requests are denied\
And a different owner cannot select or receive this owner's image; their own
reader remains scoped to their own subject\
And the public image endpoint continues to deny unpublished or moderated content\
And neither reader returns Storage paths to the client.

### Scenario: pre-launch demo identities are visually distinct

Given credential-free demo image presets are assigned\
When provider and driver identities appear together\
Then their allocated picture pools are disjoint and individual pictured identities
have distinct presets\
And some transporter and driver identities intentionally remain blank\
And no user-uploaded photo or customer record is overwritten by a fixture update.

Reuse existing validated upload/storage/scan/ownership policies; no new image
provider, storage bucket or relaxed access is justified. Fixture changes are
bounded local preparation; a hosted correction needs exact target/record review.
Tests must cover separate replacement/removal, actual upload controls, empty
icons, first-name-only serialization and company information preservation.

## October 13 owner correction: provider identity and truck facts

This supersedes the provider-level Services and Regular service presentation
below. About remains the provider's descriptive text. Routes belong to the
specific truck and its current driver under FEAT-CAP-001, not to the account.

### Scenario: a concise transporter profile keeps useful detail

Given a visitor opens a transporter profile on web or mobile\
When its owner details render\
Then About, public contacts, reviewed documents, introduction media and shipment
reviews remain available\
And neither Transport services nor account-wide Regular service is displayed\
And the bottom Confirm service details before booking block and generic View
available trucks link are absent\
And one See trucks on the map action above the truck list opens capacity scoped
to this transporter without promising that private or unavailable trucks appear\
And the existing single-truck display, fleet disclosure and pagination remain.

### Scenario: retiring a descriptive field does not erase its stored text

Given an existing profile has legacy Services text\
When its owner edits About or contacts with a current or older client\
Then the legacy Services value is retained without publishing or indexing it\
And no Services editor or hidden resubmission changes it\
And About remains public, editable and searchable under FEAT-MKT-001.

Local implementation and focused verification are planned. No new hosted SQL,
publication or visual approval is claimed by this correction.

### Scenario: a missing optional truck number does not break its public profile

Given an otherwise valid visible transporter has an active truck whose optional
platform number is null\
When its bounded public fleet page is opened on web or mobile\
Then the profile and truck render without an invented platform number\
And distinct truck rows retain independent closed/open map state and usable actions\
And UUIDs, contacts and document access keep their existing projection rules\
And malformed identities, missing required fields and oversized pages still fail closed.

October13 reproduced local failure: the database permits a null platform number,
but the fleet adapter required a string in both the item and its summary evidence,
making a Featured-linked profile return503. The local correction aligns just that
optional field, with tests for null, malformed fields and distinct map-row keys.
No schema, record repair, identifier minting or hosted write is part of this fix.
Focused profile browser checks and owner visual review remain required.

October 9 local implementation: FEAT-PLY-001 governs report/block/unblock,
content-policy acceptance, staff moderation and hidden/demo exclusions across
profiles, map/search rows, Featured and public portraits. Profile visibility and
truck signal sharing remain separate; moderation must close both public read
paths before pagination. Production rollout/owner visual review remain pending.

### Scenario: only truck-linked providers receive public microsites

Given public and legacy profile records coexist\
When an anonymous visitor inspects a public truck and selects Transporter details\
Then only a published fleet transporter or self-managed provider resolves to a canonical microsite\
And no Provider Market mode, provider map marker, Area Market building, or provider list is rendered\
And capacity-seeking Businesses never receive a public provider microsite\
And account email, account phone, private plate, exact coordinates, and private evidence remain excluded.

### Scenario: providers publish a general regional base

Given a provider owner edits public business information\
When the base location is saved\
Then one current regional state or Addis Ababa or Dire Dawa city administration is required together with the structured city or town\
And the Daily Featured Trucks programme and transporter microsite may display that general base\
And an exact office, yard, home, or device coordinate is never requested or inferred from that profile field.

### Scenario: managed profile editing repeats provider ownership

Given a signed-in fleet owner or independent provider opens or changes its transporter information\
When the managed application reads or writes the profile\
Then one service-role-only PostgreSQL contract resolves the active actor to exactly one owned organization or provider profile\
And it repeats current workspace-access, provider-owner, structured-place, regional-code, bounded-content, HTTPS-website, and public-contact rules inside the transaction\
And a Company driver, unrelated provider, inactive actor, expired workspace, anonymous browser, or ordinary authenticated browser cannot read the owner editor projection or mutate the page\
And a successful update records an audit event without storing private contact values in audit details\
And a failed update changes neither the public page nor its owner base.

### Scenario: public provider labels describe the operating model

Given a provider appears in Daily Featured Trucks or its microsite\
When Loadgistic presents the provider type\
Then a transport-company organization is called a Fleet transporter\
And an independent provider with approved truck ownership is called an Owner-operator\
And an independent provider operating an active truck through approved authorization is called a Self-managed driver\
And Transporter is the public umbrella term for all three operating models\
And truck ownership or authorization is displayed as a separate reviewed, unreviewed, or expired document status rather than being implied by the operating-model label\
And vehicle count remains a separate fact rather than changing the provider type label.

### Scenario: canonical provider handle is public

Given a published provider owns a unique validated handle\
When `/@handle` is requested\
Then the request resolves to that provider's public microsite\
And featured and sponsored transporter cards expose that canonical profile action separately from their transporter-filtered Truck Market action\
And old provider profile URLs redirect to the canonical handle\
And unknown, reserved, malformed, or unpublished handles reveal no profile.

### Scenario: microsite represents the provider fully

Given a provider maintains its page\
When a visitor opens the microsite\
Then it may show logo or hero media, headline, about text, verification badges, verified-shipment review summary, active fleet presentation, each truck's latest published capacity with its age, and provider-selected public contacts\
And each claim is based on owner input or current records rather than invented metrics\
And a low rating that is awaiting review remains visible and included in the public count and average\
And the page remains usable on mobile and without playing media.

### Scenario: account identity leads into vehicles and assigned drivers

Given a visitor opens a transporter microsite on a wide or narrow screen\
When the profile renders\
Then a compact identity header presents the operating model, public base, fleet count, review summary, and provider-controlled contact actions without a marketing-sized hero\
And reviewed account documents appear next, followed by vehicles and their assigned drivers\
And shipment reviews and About/introduction media remain reachable after the fleet rather than separating account identity from its vehicles\
And provider details stay the same when the truck page changes\
And each later section has one descriptive heading and a visually distinct purpose rather than repeating the provider name or page title\
And desktop uses the available width without compressing truck details into small tiles\
And phone layouts use one readable column with no horizontal overflow, clipped action, or hidden truck detail.

### Scenario: every active truck receives a detailed public card

Given a published provider owns one or more active trucks\
When a visitor views the truck list\
Then every active truck can be reached through the existing bounded pagination and receives its own detailed card with platform truck number, make, model, cargo configuration, latest Empty or Partial state when published, reported Service area or Capacity route, pair-scoped regular service, separate capacity and approximate-location age, assigned Driver first name, Driver operating model, public callback phone, and separate Driver and truck verification status from authoritative records\
And a Fleet driver names the employing Transport Provider while an Owner-operator or Self-managed driver remains clearly independent\
And plate, Driver surname, private account details, exact coordinates, proof files, and inactive trucks remain absent\
And trucks with no published Empty or Partial signal remain visible as part of the provider's fleet but show Ask about this truck instead of an old location or availability claim.

### Scenario: vehicles are initially visible with bounded fleet pagination

Given a published transporter profile has one active truck\
When the visitor opens its profile\
Then that vehicle and its assigned driver appear after account documents without an expand button or a one-result pagination footer.

Given a published transporter profile has more than one active truck\
When the visitor opens the profile without a truck-page request\
Then the fleet section is initially open after account documents\
And its keyboard-accessible summary may close or reopen the section\
And the existing cards show at most twelve active vehicles and their driver details\
And the visitor can collapse the list again\
And page links, reloads and bookmarked truck pages keep the list expanded and preserve the provider scope\
And page links move to the list, without requiring another click or scrolling past owner details\
And the decision uses the provider's total active truck count, not the number on the current page\
And a final page containing one truck still belongs to the expandable fleet\
And a profile with no eligible truck never displays an empty fleet button.

### Scenario: a truck map compares public capacity with the visitor

Given one microsite truck has current public Empty or Partial capacity\
When the visitor opens that truck's map\
Then the map is created lazily for that selected truck rather than creating every map during initial page load\
And only one truck map is mounted at a time\
And the selected truck remains clearly identified while its map opens as a full-width workspace directly below that truck's specifications and current-capacity summary\
And it uses the same approximate current-location circle, current Service area or Capacity route, regular-service geometry, marker treatment, and safety labels as the selected truck in the Capacity Market\
And browser location may add a clearly labelled visitor marker and fit both the visitor and the truck's public geometry\
And the visitor's exact coordinate remains only in browser memory and is not persisted by the microsite\
And denial leaves every truck card and map usable with a manual location retry\
And map open, location refresh, and map close controls remain keyboard reachable and clearly labelled on desktop and phone\
And closing the map returns to the same truck card.

### Scenario: every provider uses the shared Loadgistic template

Given a provider edits its public business information\
When the editor renders\
Then color and page-hero controls are absent\
And stored legacy provider colors are not rendered publicly\
And white and off-white surfaces, the shared Loadgistic palette, spacing, type, cards, map treatments, header, contextual document-review labels, and footer remain consistent with the rest of the public site\
And an allowlisted video reference comes only from Loadgistic-controlled provider configuration\
And arbitrary CSS, scripts, HTML, external styles, or layout replacement are rejected\
And required map attribution, document-review scope, navigation, and contact semantics cannot be hidden.

### Scenario: provider controls one public profile image

Given a provider owner edits its public information\
When it uploads or replaces a profile image\
Then only a content-validated JPG, PNG, or WebP within the configured size limit is accepted\
And the image is stored behind an owner-scoped command and served only for a currently published provider page\
And raw storage references remain absent from public projections\
And Featured Provider cards and the provider microsite use that image as provider identity rather than using one of the provider's trucks\
And a role-appropriate company or person placeholder icon appears when no image has been supplied\
And replacing an image removes the superseded object after the new record is committed\
And a rejected metadata command removes the newly quarantined-and-scanned object rather than leaving it orphaned\
And browser roles cannot call the image metadata command or receive either the current or superseded storage reference.

### Scenario: pictured seeded identities have distinct portraits

Given Loadgistic loads the pre-launch public transporter fixtures\
When a featured portrait card or transporter microsite renders a fixture without an owner-uploaded image\
Then a pictured fixture uses its own portrait from a pool disjoint from Driver portraits\
And clothing, setting, truck color, truck type, camera angle, and composition vary across the fixture set so different transporters are visually distinguishable\
And the portrait contains no company name, logo, plate, watermark, document, or verification claim\
And an owner-uploaded image always overrides the generated fixture portrait\
And intentionally blank fixtures and non-fixture identities without an uploaded image receive the role-appropriate placeholder icon.

### Scenario: public contacts are independently controlled

Given a provider has public phone, WhatsApp, email, and website values\
When the owner changes visibility\
Then each method is independently public or hidden\
And hidden values are absent from HTML and public API projections\
And the public contact phone is stored separately from the required private account phone\
And private account contacts are never used as fallbacks\
And a visible Call action displays the public phone number while retaining its `tel:` destination.

### Scenario: YouTube introduction loads after intent

Given Loadgistic staff has saved one valid allowlisted YouTube video identifier for a provider\
When the microsite first renders\
Then a lightweight thumbnail and Play action appear without loading the player iframe\
And pressing Play loads the privacy-aware embed\
And arbitrary embed HTML or non-allowlisted hosts are rejected.

## Contract ownership

- Pages: truck-detail Transporter details actions, canonical `/@handle`, and transporter public-information settings; `/providers` redirects to the Truck Market
- Compatibility: legacy profile URLs redirect to canonical provider handles
- Application services: safe public provider/fleet projection, provider operating model, and owner-scoped page update
- Tests: repository, authorization, truck-linked microsite and truck-map E2E, focused visual review, and release visual audit

## Complete bounded public fleet (verified locally; rollout pending)

Given a published transporter owns more than 96 active trucks\
When a visitor opens its canonical microsite and follows fleet page navigation\
Then each response renders at most 12 trucks ordered by platform number and ID\
And every active owned truck remains reachable through numbered pages\
And the header reports the whole active-fleet count while capacity counts describe
only the displayed page\
And page-specific capacity reads select those vehicle IDs before latest-state
selection, retaining existing Open/Empty/Partial/active-Driver privacy rules\
And a truck beyond the previous 96-capacity boundary still shows its current
public capacity and can open its map\
And private, Full, Off Duty and unassigned capacity never becomes a public signal.

Given a visitor changes fleet page or requests an invalid or now-empty page\
When the server resolves the public provider\
Then invalid page syntax starts at page one and an out-of-range positive page
clamps to the last available page\
And provider type, aggregate truck evidence, business details and review totals
remain independent of the selected fleet page\
And aggregate truck evidence uses each truck's latest approval, including expiry,
before selecting the fleet summary\
And page navigation uses /@handle with browser Back support\
And unpublished/unknown providers remain unavailable and no private plate, account
contact, proof path or exact location is added to the public projection.

Contracts: service-only `public_provider_fleet_page` returns a 12-row owner-scoped
page, exact count and bounded aggregate evidence; `public_capacity_page` accepts
an optional server-owned vehicle ID restriction before its latest-state query.
No public API exposes that internal filter. Apply additive migration 088 before
app rollout. The migration is read-only apart from function/index definitions;
rollback hides pagination while retaining schema. No remote apply is authorized.
Tests: `tests/public-provider-paging.test.mjs`, `tests/sql/public-provider-paging.sql`,
`tests/e2e/public-provider-paging.spec.ts`; SQL, browser, quality and build gates
passed locally. Final counts, screenshots and limits are in
`docs/BUILD_VERIFICATION.md`.

### Scenario: public rendering receives no hidden intermediate data (F19)

Given a published provider hides a contact and a Driver has a private surname\
When its public profile is rendered, including development RSC serialization\
Then PostgreSQL projects hidden contacts as null before the application receives them\
And public Driver-name reads contain only the first name\
And image presence is a boolean, never a private Storage object path.

Contracts: migration 095 adds service-only bounded public metadata/name queries.
Publication and exactly-one-owner scope are checked before metadata projection.
Observability remains generic read failures without private values. Apply 095
before the public-page adapter; rollback removes the adapter exposure while
retaining additive RPCs. Regression evidence: rollback SQL
`tests/sql/public-provider-privacy.sql` and desktop/phone full-paging HTML privacy
assertions in `tests/e2e/public-provider-paging.spec.ts`.


## Profile cleanup verification — October 13, local only

### Scenario: a saved portrait and failed refresh are reported truthfully

Given the authorized Driver portrait command confirms an upload or removal\
When the subsequent metadata read fails\
Then the screen distinguishes the saved change from the unavailable current
preview\
And the existing Refresh photo action retries only the authorized read\
And an obsolete image is not presented as the saved current portrait\
And the read failure does not cause a duplicate upload/removal, destructive
rollback, hidden error or a claim that an unconfirmed write succeeded.

The existing bounded fleet disclosure, page navigation and single-truck behavior
remain controlled by tests/public-provider-paging.test.mjs and the actual
public-provider-paging browser workflow. The newly changed profile has no
provider Services/Regular or bottom booking checklist. Its map action above the
fleet preserves the selected transporter. Focused web desktop/phone and Expo
390/320 profile checks pass before the new route migration; that preliminary
result does not prove the SQL ownership correction. Final scoped-route and
unchanged paging evidence must be recorded separately before release.

Migration140 is additive, preserves old route rows and Services text, and requires
compatible regular commands. Restore of old provider-wide joins is unsafe once
new bound route data changes: rollback must fail closed then, leaving records
and route isolation intact for a reviewed forward repair. Owner visual review,
full gates and exact hosted rollout approval remain outstanding.

## October15 driving-owner photo and explicit editing — local repair

Given an active provider owner drives a truck\
When Account offers their separate driver photo on web or mobile\
Then the existing upload/remove route accepts that driving owner as well as an
employed/personal Driver, subject to persisted driver eligibility and consent\
And a non-driving provider, staff or foreign actor receives no photo-management
authority\
And company/provider image and personal driver portrait remain distinct.

Given a saved account/profile is viewed\
Then editors open only through an intentional task action and Cancel preserves
saved values. Tests: focused role/route denial and upload contract tests, and the
actual local read/edit/cancel checks in FEAT-UIX-001. Hosted behavior is unchanged.
