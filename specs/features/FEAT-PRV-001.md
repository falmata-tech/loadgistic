---
id: FEAT-PRV-001
title: Truck-linked public transporter microsites
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-CAP-001, FEAT-MKT-001, FEAT-VER-001, FEAT-REV-001]
problem: Transport providers need to be represented as credible businesses, while visitors need rich public context before making contact.
behavior: Fleet transporters and self-managed providers with current public trucks receive canonical `/@handle` microsites reached from truck details rather than a Provider Market, provider map, Area Market, or provider list. Providers manage accurate public contacts, business content, one general base region or federal city, and one validated profile image. Every microsite uses one Loadgistic-controlled white-space template and presents each active truck through a detailed safe card with a lazily opened relative map when that truck has current public capacity.
contracts: [ProviderMicrosite, MicrositeTruckCard, MicrositeTruckMap, PublicProviderHandle, ProviderBaseRegion, ProviderOperatingModel, ProviderProfileImage, SeededTransporterPortrait, SharedProviderTemplate, PublicContactPolicy, YouTubeVideoReference, ProviderPageCommand, PublicFleetProjection]
observability: [provider_page_view, provider_profile_update, public_contact_click, video_open, handle_resolution]
rollout: Add profile presentation fields and actor-scoped managed profile commands additively, reserve and validate handles, keep legacy provider URLs as redirects, and exclude all capacity-seeking Business profiles from public projections.
---

# Transporter public presence

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
And the Daily Featured Transporters programme and transporter microsite may display that general base\
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

Given a provider appears in Daily Featured Transporters or its microsite\
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
Then it may show logo or hero media, headline, about text, services, verification badges, verified-shipment review summary, active fleet presentation, the latest published capacity with its age, one regular Service area or Capacity route, and provider-selected public contacts\
And each claim is based on owner input or current records rather than invented metrics\
And a low rating that is awaiting review remains visible and included in the public count and average\
And the page remains usable on mobile and without playing media.

### Scenario: the profile hierarchy puts usable fleet information first

Given a visitor opens a transporter microsite on a wide or narrow screen\
When the profile renders\
Then a compact identity header presents the operating model, public base, fleet count, review summary, and provider-controlled contact actions without a marketing-sized hero\
And the active fleet and current-capacity section follows that identity header before longer company, credential, media, regular-service, and review content\
And each later section has one descriptive heading and a visually distinct purpose rather than repeating the provider name or page title\
And desktop uses the available width without compressing truck details into small tiles\
And phone layouts use one readable column with no horizontal overflow, clipped action, or hidden truck detail.

### Scenario: every active truck receives a detailed public card

Given a published provider owns one or more active trucks\
When a visitor opens the provider microsite\
Then every active truck receives its own detailed card with platform truck number, make, model, cargo configuration, latest Empty or Partial state when published, reported Service area or Capacity route, provider regular service, separate capacity and approximate-location age, assigned Driver first name, Driver operating model, public callback phone, and separate Driver and truck verification status from authoritative records\
And a Company driver names the employing fleet transporter while an Owner-operator or Self-managed driver remains clearly independent\
And plate, Driver surname, private account details, exact coordinates, proof files, and inactive trucks remain absent\
And trucks with no published Empty or Partial signal remain visible as part of the provider's fleet but show Ask about this truck instead of an old location or availability claim.

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
And white and off-white surfaces, the shared Loadgistic palette, spacing, type, cards, map treatments, header, safety notice, and footer remain consistent with the rest of the public site\
And an allowlisted video reference comes only from Loadgistic-controlled provider configuration\
And arbitrary CSS, scripts, HTML, external styles, or layout replacement are rejected\
And the Loadgistic safety notice, attribution, navigation, and contact semantics cannot be hidden.

### Scenario: provider controls one public profile image

Given a provider owner edits its public information\
When it uploads or replaces a profile image\
Then only a content-validated JPG, PNG, or WebP within the configured size limit is accepted\
And the image is stored behind an owner-scoped command and served only for a currently published provider page\
And raw storage references remain absent from public projections\
And Featured Provider cards and the provider microsite use that image as provider identity rather than using one of the provider's trucks\
And a Loadgistic-supplied default transporter portrait appears when no image has been supplied\
And replacing an image removes the superseded object after the new record is committed\
And a rejected metadata command removes the newly quarantined-and-scanned object rather than leaving it orphaned\
And browser roles cannot call the image metadata command or receive either the current or superseded storage reference.

### Scenario: every seeded transporter has a distinct portrait

Given Loadgistic loads the pre-launch public transporter fixtures\
When a featured portrait card or transporter microsite renders a fixture without an owner-uploaded image\
Then that fixture uses its own generated portrait showing one adult Ethiopian man with a truck appropriate to that fixture's operating model and truck configuration\
And clothing, setting, truck color, truck type, camera angle, and composition vary across the fixture set so different transporters are visually distinguishable\
And the portrait contains no company name, logo, plate, watermark, document, or verification claim\
And an owner-uploaded image always overrides the generated fixture portrait\
And a non-fixture transporter without an uploaded image continues to receive the neutral Loadgistic default transporter portrait.

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
