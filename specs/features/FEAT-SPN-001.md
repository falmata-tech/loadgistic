---
id: FEAT-SPN-001
title: Managed Featured sponsors
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-ADM-001, FEAT-FTR-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-VER-001]
problem: Transporters and relevant outside advertisers need a transparent sponsorship opportunity beside Daily Featured Trucks without allowing sponsorship to imply endorsement, verification, or preferred marketplace ranking.
behavior: Administrators and authorized Featured staff create and manage one sponsor catalogue containing either a linked Loadgistic transporter or a bounded external advertisement, then schedule active Sponsored placements for a date range. The same active sponsors appear in the public sponsor panel and are assigned in order to programme interludes. Sponsorship is independent of the ordinary Market, featured roster, verification state, and provider eligibility.
contracts: [SponsorRecord, SponsorKind, ProviderSponsorReference, ExternalSponsorAdvertisement, SponsoredPlacement, SponsoredProviderEligibility, SponsorAdminCommand, PublicSponsorProjection, FeaturedSponsorBreakAssignment]
observability: [SPONSORSHIP_SAVED audit, SPONSORSHIP_DISABLED audit, administrator sponsorship-gap state]
rollout: Add sponsorship storage and admin commands additively. Rollback disables public sponsorship reads and writes while retaining schedules and audit history.
---

# Sponsored transporters

### Scenario: sponsorship is clearly identified

Given a visitor opens today's Daily Featured Trucks section\
When sponsors are projected\
Then the section is labeled Sponsors\
And it appears in a compact command-style panel to the right of the featured-provider board rather than sharing the billboard surface or changing ordinary Market order\
And on narrow screens that panel moves above the featured board and shows one sponsor at a time\
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
And staff without the Featured grant and other unauthorized accounts are denied without creating or changing a sponsor\
And create, update, disable, and validation outcomes are audited\
And each save or disable runs atomically through a service-role-only Supabase command that rechecks current Featured authority, date overlap, position, sponsor kind, and current transporter eligibility.

### Scenario: administrators control placement and timing

Given an administrator prepares a sponsorship\
When the sponsor, start date, end date, position, and active state are saved\
Then the date range is inclusive and interpreted in `Africa/Addis_Ababa`\
And no more than five active placements occupy one programme date\
And sponsor and position are unique within an overlapping date range\
And staff without the Featured grant and other unauthorized accounts are denied without changing a placement\
And save, reorder, disable, and expiry outcomes are audited.

### Scenario: sponsorship cannot buy around trust rules

Given a sponsored Loadgistic transporter is scheduled\
When public eligibility is evaluated\
Then the provider must retain the same published profile, base-region, public-contact, active-truck, and reviewed-document requirements as a featured provider\
And the provider is evaluated independently from the daily truck-type roster\
And payment state never substitutes for missing eligibility\
And a provider omitted for ineligibility is not silently replaced\
And an outside advertiser is not presented as a verified transporter and receives no transporter badge, truck count, review, or Market action.

### Scenario: public sponsorship projection is bounded and safe

Given eligible active sponsorships overlap today\
When an anonymous visitor reads Daily Featured Trucks\
Then at most five placements are returned in deterministic administrator order\
And a transporter placement contains only provider identity, public profile image, general city and region, provider type, public review summary, active-truck count, available-now count, and microsite handle\
And an outside-advertiser placement contains only the saved public business name, description, HTTPS website or social page, public phone, and optional approved artwork\
And exact coordinates, account data, evidence files, administrative notes, payment records, and private contacts are absent.

### Scenario: programme interludes name managed sponsors

Given the featured schedule contains one or more programme interludes and active sponsors exist for that day\
When the administrator opens the generated schedule\
Then each programme interlude names one active sponsor in deterministic rotation\
And the public schedule may use the same safe sponsor name without exposing admin or contact-only fields\
And no sponsor assignment changes provider presentation duration or order\
And a day without active sponsors retains a generic Programme pause.

October26 timing follow-up: sponsor mentions share FEAT-FTR-001's accepted
evening programme window and budget. They never extend the programme or reduce
a chosen provider below its minimum airtime. Sponsor identity/eligibility and
safe projection remain unchanged; timing qualification belongs to FEAT-FTR-001.

## Contract ownership

- Public page: Sponsors panel beside the Daily Featured Trucks board on wide screens and above it on narrow screens
- Administrator: sponsor catalogue plus bounded schedule, position, and active state
- Application services: sponsor-kind validation, overlapping-date validation, provider eligibility, safe projection, schedule attribution, and audited managed commands in the platform admin port
- Persistence: additive sponsor catalogue and sponsor-placement schedule tables
- Tests: repository authorization/eligibility, safe projection, and focused desktop/mobile E2E

## November 18 · Featured sponsor cards

BASE-IAM-001 / FEAT-FTR-001. Admins and staff with the existing Featured grant
manage placements from Featured settings. Given a saved placement, opening Edit
recalls its details, date range, position and artwork. Saving updates that
placement and writes the existing audit event. Cancel preserves saved details.
Revoked staff and other roles cannot save or disable placements.

Given active, eligible placements for today's region and date, Featured displays
one sponsor at a time on desktop, phone web and Expo, including an unpublished
or empty provider day. Every eight seconds the next placement appears in order.
Manual navigation remains available when paused or reduced motion is enabled.
Advertisers can supply their public phone and an HTTPS website or social page.
Allowlisted workshop artwork is optional. The card does not affect provider order.

Roll out the nullable artwork column and revised save command before the app.
Older placements and clients remain valid. Reverting the app leaves the column
in place and retains placements, audit history and existing permissions.
Synthetic examples are installed only in the local demo.
