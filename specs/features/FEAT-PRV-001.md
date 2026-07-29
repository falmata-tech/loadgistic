---
id: FEAT-PRV-001
title: Authenticated Business and Transporter Directory
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-VER-001, FEAT-TRK-001, FEAT-NET-001]
problem: Signed-in members need one trustworthy directory for confirming Businesses, fleet transporters, and self-managed drivers without exposing account credentials or marketplace data anonymously.
behavior: Authenticated Public Profiles expose permitted organization identity, explicit public contact information, declared operating regions and route pairs, verification state, and participant ratings; Businesses call the durable declarations Freight Routes while providers call them Preferred Routes. Provider maps and comparisons add fresh dated truck current-partial and planned routes without converting those temporary signals into permanent profile routes.
contracts: [AuthenticatedCompanyView, CompanyPageCommand, PublicContactBoundary, OperatingRegion, EthiopiaPlaceSuggestion, ProfileRoute, LiveTruckRoute, RouteEvidenceProjection, RouteMapProjection, ProfileRouteComparison, DesignatedLoadPhoneVisibility, FleetRoster, MarketplaceVisibilityPolicy, RelationshipVisibilityPolicy, NetworkCoverageProjection, ProfileRatingSummary]
observability: [company_update_audit, route_update_audit, profile_route_comparison, request_outcome]
rollout: Review every newly public field for authorization, accuracy, and privacy before release.
---

# Business and transporter discovery

### Scenario: authenticated directory discovery

Given a Business, fleet transporter, or self-managed driver has a published profile\
When any logged-in user browses the directory or opens its profile\
Then the account can be found by its correct account-type filter\
And only allowed profile and verified operational facts are returned\
And the directory and profile remain inside the role-aware workspace shell.

### Scenario: dense directory remains bounded

Given the authenticated directory contains many Business and provider profiles\
When a member searches, filters, or changes result pages\
Then the server returns one bounded page of matching profiles\
And the interface preserves the selected account type and search text\
And the member can reach every matching profile without rendering the entire directory at once.

### Scenario: directory supports cross-market network actions

Given a Business views a transport provider or an authorized transport provider views a Business\
When the authenticated directory card or Public Profile is rendered\
Then the member may Favorite or request a network connection from that context\
And the action reflects the current Favorite, Pending, or Connected state.

### Scenario: anonymous directory access is denied

Given no valid session exists\
When the provider directory or company page is requested\
Then the request redirects to login\
And no provider, branch, route, or capacity information is rendered.

### Scenario: owner updates company page

Given an authenticated fleet transporter or self-managed driver\
When they update their company page\
Then only their own profile changes and an audit record is created.

### Scenario: Business profile supports identity confirmation

Given an authenticated Business account has a basic company profile\
When another logged-in user browses the directory or selects that Business as a load participant\
Then its Public Profile can be opened to confirm the Business\
And its declared city and operating regions are shown to help transporters assess route relevance\
And transporter-only fleet and capacity sections are absent.

### Scenario: Business maintains declared operating regions

Given an authenticated Business edits its Public Profile\
When it saves one or more operating regions or cities\
Then those member-entered locations are shown on its authenticated profile and directory card\
And no exact facility coordinate or inferred live location is created.

### Scenario: member records route endpoints

Given a Business, fleet transporter, or self-managed driver edits its Public Profile\
When it saves a coverage route\
Then origin and destination are separate required city inputs\
And the route belongs only to that organization or provider profile\
And the route is labeled Freight Route for a Business and Preferred Route for a provider\
And Corridor Route is not presented as a second route concept\
And removing or replacing a declared route does not delete shipment, tracking, or capacity history.

### Scenario: Ethiopia-first place suggestions

Given a member enters a route, load endpoint, capacity route, current general area, or board filter\
When the member types a place\
Then the interface suggests reviewed Ethiopian cities first\
And free text remains possible for places outside the reviewed catalog\
And no external geocoding key is exposed to the browser.

### Scenario: Public Profile separates declaration from evidence

Given a member has one or more declared coverage routes\
When another authenticated user opens its Public Profile\
Then an approximate route map and route list show those declarations\
And each Business route shows the count of loads posted and the subset that reached tracked execution\
And each transport-provider route shows the count of capacity reports and the subset of provider shipments that reached tracked execution\
And a route with no supporting record is labeled Declared only rather than active, verified, or false.

### Scenario: route evidence is derived without exposing exact locations

Given shipment, tracking, or capacity records support a declared route\
When profile evidence is calculated\
Then endpoint matching is normalized and order independent\
And counts come only from persisted records belonging to that profile\
And exact device coordinates, receiver contacts, private files, and unrelated shipment facts are not returned.

### Scenario: members compare profile route fit

Given an authenticated member has declared routes and opens another member's Public Profile\
When the member chooses Compare routes\
Then the system compares both sets using exact two-endpoint, one-endpoint, and no-endpoint matches\
And a provider's side also includes every fresh owned-truck current-partial and eligible planned route\
And a visual analysis identifies shared endpoints and strongest matching route pairs\
And the result states whether it uses tracked evidence, reported activity only, or declarations only\
And it does not claim availability, serviceability, trustworthiness, price, or dispatch suitability.

### Scenario: comparison routes remain visually distinguishable

Given a member compares its routes with another profile\
When a viewer route overlaps a blue profile route on the map\
Then the viewer route is drawn above it with a high-contrast warm dashed line\
And the legend uses the same dashed treatment\
And the route remains distinguishable from blue profile, green current-partial, and orange planned-route lines.

### Scenario: unmapped member-entered place remains honest

Given a route contains a place outside the map reference catalog\
When the profile map renders\
Then the route remains visible in the evidence list and comparison\
And the interface states that map placement is unavailable for that member-entered place\
And no coordinate is invented.

### Scenario: fleet dashboard compares network coverage

Given a fleet transporter has Connected Business relationships and declared Preferred Routes\
When the transporter opens Home\
Then a visual coverage panel lists the related Businesses and their declared operating regions\
And it identifies exact endpoint, route-area, or no recorded match from normalized member-entered place names\
And its approximate map does not render an exact facility pin or imply that an unmatched Business cannot be served.

### Scenario: Business controls load-phone visibility

Given a Business maintains its Public Profile contact settings\
When it saves a designated load phone without enabling marketplace visibility\
Then the phone remains private to the Business workspace\
And enabling visibility exposes that phone only with permitted loads to authenticated transporters.

### Scenario: account and public contacts are separate

Given a user has a private account email or account phone\
When their Public Profile is rendered\
Then neither account contact is used as a fallback\
And only the separately entered public email and public phone may be displayed.

### Scenario: transporter profile shows its complete active fleet

Given a fleet transporter owns multiple active truck records\
When an authenticated user opens its Public Profile\
Then every active truck is listed once with make, model, cargo configuration, permanent Loadgistic platform number, and latest duty state\
And the displayed fleet count is derived from those records.

### Scenario: authenticated directory request keeps workspace context

Given an authenticated Business user browses the transporter directory\
When they open an authenticated company page and choose to send a business request\
Then their session remains active\
And the profile URL, desktop sidebar, and mobile navigation remain in the workspace\
And the new-shipment form opens with that provider selected.

### Scenario: Business profile shows participant reputation

Given a Business has reviews from completed loads\
When a logged-in user opens its Public Profile\
Then the profile shows its average rating and review count\
And no private receiver contact from any load is exposed.

## Contract ownership

- Pages: `/app/providers`, `/app/providers/[handle]`; `/companies` and `/companies/[handle]` are compatibility redirects
- Application services: provider, company, vehicle, and capacity functions in `src/lib/repository.js`
- Tests: `tests/repository.test.mjs`
