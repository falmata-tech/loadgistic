---
id: FEAT-PRV-001
title: Authenticated transporter directory and Public Profiles
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001]
problem: Businesses need verified fleet-transporter and self-managed-driver discovery based on maintained truck records, without exposing marketplace data to anonymous visitors.
behavior: Authenticated Public Profiles expose permitted transporter identity, services, corridors, contact information, authoritative active-truck roster, and current truck capacity while owners maintain their own records; Business Profiles remain basic private workspace records and are not listed in the provider directory.
contracts: [AuthenticatedCompanyView, CompanyPageCommand, DesignatedLoadPhoneVisibility, FleetRoster, MarketplaceVisibilityPolicy, RelationshipVisibilityPolicy]
observability: [company_update_audit, route_update_audit, request_outcome]
rollout: Review every newly public field for authorization, accuracy, and privacy before release.
---

# Transporter discovery

### Scenario: authenticated transporter discovery

Given a transporter has authenticated marketplace visibility\
When a logged-in user browses transporters or opens its company page\
Then only allowed company and verified operational facts are returned.

### Scenario: anonymous directory access is denied

Given no valid session exists\
When the provider directory or company page is requested\
Then the request redirects to login\
And no provider, branch, route, or capacity information is rendered.

### Scenario: owner updates company page

Given an authenticated fleet transporter or self-managed driver\
When they update their company page\
Then only their own profile changes and an audit record is created.

### Scenario: business profile is not a marketplace page

Given an authenticated Business account has a basic company profile\
When another user browses the transporter directory or opens company pages\
Then the Business profile is not listed as a public marketplace company page.

### Scenario: Business controls load-phone visibility

Given a Business maintains its private Business Profile\
When it saves a designated load phone without enabling marketplace visibility\
Then the phone remains private to the Business workspace\
And enabling visibility exposes that phone only with permitted loads to authenticated transporters.

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

## Contract ownership

- Pages: `/companies`, `/companies/[handle]`, `/app/providers`
- Application services: provider, company, vehicle, and capacity functions in `src/lib/repository.js`
- Tests: `tests/repository.test.mjs`
