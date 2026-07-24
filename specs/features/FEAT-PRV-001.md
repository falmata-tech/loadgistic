---
id: FEAT-PRV-001
title: Provider directory, company pages, routes, and centers
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001]
problem: Enterprises need verified provider discovery and operational route information based on maintained records.
behavior: Public pages expose permitted company, center, route, corridor, and current-capacity facts while owners maintain their own records.
contracts: [PublicCompanyView, CompanyPageCommand, Location, ParcelRoute, PublicVisibilityPolicy]
observability: [company_update_audit, route_update_audit, request_outcome]
rollout: Review every newly public field for authorization, accuracy, and privacy before release.
---

# Provider discovery

### Scenario: public provider discovery

Given a provider has public visibility\
When a visitor browses providers or opens its company page\
Then only allowed company and verified operational facts are returned.

### Scenario: owner updates company page

Given an authenticated organization owner or independent provider\
When they update their company page\
Then only their own profile changes and an audit record is created.

### Scenario: parcel operator maintains network

Given an authorized parcel operator\
When they add a center or route with valid locations\
Then the record belongs to that operator and public visibility follows the explicit setting.

## Contract ownership

- Pages: `/companies`, `/companies/[handle]`, `/app/providers`, `/app/routes-centers`
- Application services: provider, company, location, and route functions in `src/lib/repository.js`
- Tests: `tests/repository.test.mjs`
