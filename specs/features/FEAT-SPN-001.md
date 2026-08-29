---
id: FEAT-SPN-001
title: Administrator-managed sponsors
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-ADM-001, FEAT-FTR-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-VER-001]
problem: Transporters and relevant outside advertisers need a transparent sponsorship opportunity beside Daily Featured Transporters without allowing sponsorship to imply endorsement, verification, or preferred marketplace ranking.
behavior: Administrators create and manage one sponsor catalogue containing either a linked Loadgistic transporter or a bounded external advertisement, then schedule active Sponsored placements for a date range and regional featured-provider group. The same active sponsors appear in the public sponsor panel and are assigned in order to Sponsor breaks in the administrator schedule. Sponsorship is independent of the ordinary Market, featured roster, verification state, and provider eligibility.
contracts: [SponsorRecord, SponsorKind, ProviderSponsorReference, ExternalSponsorAdvertisement, SponsoredPlacement, SponsoredProviderEligibility, SponsorAdminCommand, PublicSponsorProjection, FeaturedSponsorBreakAssignment]
observability: [SPONSORSHIP_SAVED audit, SPONSORSHIP_DISABLED audit, administrator sponsorship-gap state]
rollout: Add sponsorship storage and admin commands additively. Rollback disables public sponsorship reads and writes while retaining schedules and audit history.
---

# Sponsored transporters

### Scenario: sponsorship is clearly identified

Given a visitor opens today's Daily Featured Transporters section\
When sponsors are projected\
Then the section is labeled Sponsors and each placement is labeled Sponsored\
And it appears in a compact command-style panel to the right of the featured-provider board rather than sharing the billboard surface or changing ordinary Market order\
And on narrow screens that panel moves above the featured board and shows the current deterministic pair without a manual carousel\
And its mobile heading, cards, and responsibility reminder remain compact enough that the panel does not become a second full-height content section before the featured board\
And every sponsored transporter card presents separate View profile and View trucks on map actions\
And the profile action opens the canonical microsite while the map action filters the Truck Market to that transporter\
And every outside advertiser card shows its administrator-supplied business name and concise description plus only its validated HTTPS website and public phone actions\
And sponsorship does not mean Loadgistic recommends, certifies, guarantees, or ranks the provider\
And the due-diligence reminder remains visible.

### Scenario: administrators manage one sponsor catalogue

Given an administrator wants to add a sponsor\
When they select an eligible Loadgistic transporter or choose Outside advertiser\
Then a transporter sponsor stores only the linked provider identity\
And an outside advertiser requires a business name, a bounded description, and at least one validated HTTPS website or public phone number\
And exactly one sponsor kind is stored\
And non-administrators are denied without creating or changing a sponsor\
And create, update, disable, and validation outcomes are audited\
And each save or disable runs atomically through a service-role-only Supabase command that rechecks administrator authority, date overlap, position, sponsor kind, and current transporter eligibility.

### Scenario: administrators control placement and timing

Given an administrator prepares a sponsorship\
When the sponsor, regional featured group, start date, end date, position, and active state are saved\
Then the date range is inclusive and interpreted in `Africa/Addis_Ababa`\
And no more than five active placements occupy one regional group and date\
And sponsor and position are unique within an overlapping group and date range\
And non-administrators are denied without changing a placement\
And save, reorder, disable, and expiry outcomes are audited.

### Scenario: sponsorship cannot buy around trust rules

Given a sponsored Loadgistic transporter is scheduled\
When public eligibility is evaluated\
Then the provider must retain the same published profile, base-region, public-contact, active-truck, and reviewed-document requirements as a featured provider\
And the provider must belong to today's regional featured group\
And payment state never substitutes for missing eligibility\
And a provider omitted for ineligibility is not silently replaced\
And an outside advertiser is not presented as a verified transporter and receives no transporter badge, truck count, review, or Market action.

### Scenario: public sponsorship projection is bounded and safe

Given eligible active sponsorships overlap today\
When an anonymous visitor reads Daily Featured Transporters\
Then at most five placements are returned in deterministic administrator order\
And a transporter placement contains only provider identity, public profile image, general city and region, provider type, public review summary, active-truck count, available-now count, and microsite handle\
And an outside-advertiser placement contains only the saved public business name, description, HTTPS website, and public phone\
And exact coordinates, account data, evidence files, administrative notes, payment records, and private contacts are absent.

### Scenario: phone presentation rotates two sponsors without manual carousel controls

Given more than two active sponsors are projected on a supported phone\
When the Sponsors panel is visible\
Then exactly two sponsor cards are visible at one time and the next deterministic pair replaces them automatically\
And no visitor order, next, previous, drag, or pause controls are rendered\
And rotation stops while keyboard focus is inside a sponsor card and respects reduced-motion preferences so essential actions remain operable\
And desktop retains the complete bounded sponsor collection.

### Scenario: Sponsor breaks name managed sponsors

Given the featured schedule contains one or more Sponsor breaks and active sponsors exist for that day\
When the administrator opens the generated schedule\
Then each Sponsor break names one active sponsor in deterministic rotation\
And the public schedule may use the same safe sponsor name without exposing admin or contact-only fields\
And no sponsor assignment changes provider presentation duration or order\
And a day without active sponsors retains a generic Sponsor break.

## Contract ownership

- Public page: Sponsors panel beside the Daily Featured Transporters board on wide screens and above it on narrow screens
- Administrator: sponsor catalogue plus bounded schedule, regional group, position, and active state
- Application services: sponsor-kind validation, overlapping-date validation, provider eligibility, safe projection, schedule attribution, and audited managed commands in the platform admin port
- Persistence: additive sponsor catalogue and sponsor-placement schedule tables
- Tests: repository authorization/eligibility, safe projection, and focused desktop/mobile E2E
