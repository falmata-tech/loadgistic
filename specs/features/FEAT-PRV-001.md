---
id: FEAT-PRV-001
title: Authenticated Business and Transporter Directory
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-VER-001]
problem: Signed-in members need one trustworthy directory for confirming Businesses, fleet transporters, and self-managed drivers without exposing account credentials or marketplace data anonymously.
behavior: Authenticated Public Profiles expose permitted organization identity, explicit public contact information, declared operating regions, verification state, and participant ratings; transporter profiles additionally expose services, corridors, authoritative active-truck roster, truck verification, and current capacity. Fleet dashboards compare saved Business regions with declared provider corridors using a non-geographic coverage view.
contracts: [AuthenticatedCompanyView, CompanyPageCommand, PublicContactBoundary, OperatingRegion, DesignatedLoadPhoneVisibility, FleetRoster, MarketplaceVisibilityPolicy, RelationshipVisibilityPolicy, NetworkCoverageProjection, ProfileRatingSummary]
observability: [company_update_audit, route_update_audit, request_outcome]
rollout: Review every newly public field for authorization, accuracy, and privacy before release.
---

# Business and transporter discovery

### Scenario: authenticated directory discovery

Given a Business, fleet transporter, or self-managed driver has a published profile\
When any logged-in user browses the directory or opens its profile\
Then the account can be found by its correct account-type filter\
And only allowed profile and verified operational facts are returned.

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
And its declared city and operating regions are shown to help transporters assess corridor relevance\
And transporter-only fleet and capacity sections are absent.

### Scenario: Business maintains declared operating regions

Given an authenticated Business edits its Public Profile\
When it saves one or more operating regions or cities\
Then those member-entered locations are shown on its authenticated profile and directory card\
And no exact facility coordinate or inferred live location is created.

### Scenario: fleet dashboard compares network coverage

Given a fleet transporter has saved Business relationships and declared preferred corridors\
When the transporter opens Home\
Then a visual coverage panel lists the related Businesses and their declared operating regions\
And it identifies exact endpoint, corridor-area, or no recorded match from normalized member-entered place names\
And it does not render an exact map pin or imply that an unmatched Business cannot be served.

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
Then every active truck is listed once with make, model, cargo configuration, plate, and latest duty state\
And the displayed fleet count is derived from those records.

### Scenario: authenticated directory request keeps workspace context

Given an authenticated Business user browses the transporter directory\
When they open an authenticated company page and choose to send a business request\
Then their session remains active\
And the new-shipment form opens with that provider selected.

### Scenario: Business profile shows participant reputation

Given a Business has reviews from completed loads\
When a logged-in user opens its Public Profile\
Then the profile shows its average rating and review count\
And no private receiver contact from any load is exposed.

## Contract ownership

- Pages: `/companies`, `/companies/[handle]`, `/app/providers`
- Application services: provider, company, vehicle, and capacity functions in `src/lib/repository.js`
- Tests: `tests/repository.test.mjs`
