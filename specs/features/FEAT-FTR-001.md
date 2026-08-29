---
id: FEAT-FTR-001
title: Seven-day Daily Featured Transporters programme
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-ADM-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-SPN-001, FEAT-UIX-001, FEAT-VER-001]
problem: Loadgistic needs a prominent Daily Featured Transporters programme that rotates attention fairly across Ethiopia's regional states and city administrations without exposing exact offices or turning reviewed evidence into a guarantee.
behavior: A fixed seven-day Ethiopia rotation assigns each calendar day one regional featured-provider group. An administrator builds a variable-length ordered roster of eligible providers whose published base region or city administration belongs to that group, controls the public event message, and uses an automatically generated or manually adjusted two-session Ethiopia-time schedule. The default schedule fits inside 08:00–22:00, preserves a four-hour midday intermission, adds transitions and sponsor breaks, shares provider time equally, and shrinks toward late morning and late evening when participation is low. Every portrait receives one presentation interval and the current portrait is highlighted only while it is being presented. The nationwide roster switches at Addis Ababa midnight, and the homepage programme remains visible with a truthful unpublished state when no eligible current roster exists.
contracts: [RegionalExpoRotation, ProviderBaseRegion, FeaturedProviderDay, FeaturedProviderSlot, FeaturedProviderEligibility, ProviderOperatingModel, FeaturedProviderAdminCommand, PublicFeaturedProviderProjection, FeaturedProviderBoardLayout, FeaturedDaySchedule, FeaturedScheduleEntry, FeaturedScheduleConfig, DailyTikTokBroadcast]
observability: [FEATURED_DAY_SAVED audit, FEATURED_DAY_PUBLISHED audit, administrator roster-gap state]
rollout: Add schedule and slot storage additively, keep the standard pre-launch fixture current across Ethiopia date rollover without overwriting an administrator-authored day, publish production rosters only through the administrator workflow, and retain a visible unpublished programme state if rollback or a scheduling gap removes the current roster.
---

# Seven-day Daily Featured Transporters

### Scenario: the national structure fits one repeatable week

Given Ethiopia currently has 12 regional states and two city administrations\
When Loadgistic assigns the seven-day featured-provider rotation\
Then Monday features Addis Ababa\
And Tuesday features Oromia\
And Wednesday features Amhara\
And Thursday features Tigray and Afar\
And Friday features Somali, Harari, and Dire Dawa\
And Saturday features Sidama, Central Ethiopia, and South Ethiopia\
And Sunday features Benishangul-Gumuz, Gambella, and South West Ethiopia\
And the three expected highest-density markets receive their own day while the other jurisdictions are grouped geographically\
And the rotation is a product discovery schedule rather than a political, population, or service-coverage ranking.

### Scenario: one regional provider group is featured per Ethiopia day

Given an administrator schedules a featured-provider day\
When the date is loaded or published\
Then the date is interpreted in `Africa/Addis_Ababa` and determines its regional provider group from the fixed weekday rotation\
And it contains a variable-length ordered roster whose current published base region belongs to that group\
And the public product does not impose or advertise a fixed participant count\
And the roster may contain any mix of Self-managed drivers, Owner-operators, and Fleet transporters\
And the same ordered roster is returned to every visitor regardless of visitor location\
And only the provider's general city or town and region are public; office coordinates are never part of the feature projection\
And the next published day becomes current at Addis Ababa midnight without rewriting the previous day.

### Scenario: administrators curate rather than silently substitute

Given an administrator is preparing a day\
When eligible providers are selected and ordered\
Then each provider appears at most once and each slot position appears at most once\
And any positive number of eligible providers may be published honestly\
And the system never fills an empty slot with a provider from another featured group or an unscheduled provider\
And non-administrators are denied without changing the schedule\
And save and publish outcomes are audited.

### Scenario: the homepage programme never silently disappears

Given the homepage reaches a date with no published Daily Featured Transporters roster or no remaining eligible slots\
When the public programme is rendered\
Then the seven-day programme and today’s regional group remain visible in their normal homepage position\
And the page states clearly that today’s roster is being prepared instead of removing the complete section\
And it does not invent participants, reuse another date’s roster, or substitute transporters from another regional group\
And an administrator draft for that date is never published or overwritten by a public read.

### Scenario: the standard pre-launch fixture follows Ethiopia date rollover

Given the deterministic fake-provider fixture is present and no administrator-authored row exists for the current Ethiopia date\
When the local homepage is opened after Addis Ababa midnight\
Then a deterministic published fixture roster is materialized from eligible fake transporters in that day’s regional group\
And reopening the page does not duplicate the roster or its slots\
And an existing draft or published row for that date is left unchanged\
And this fixture behavior does not authorize automatic production roster substitution.

### Scenario: eligibility is provider specific

Given a provider has a published general base city or town and selected region or city administration\
When eligibility is evaluated\
Then a fleet provider requires approved National ID, Business License, and Business Address evidence\
And a self-managed provider requires approved National ID and Driver License evidence\
And the self-managed provider also requires approved ownership or unexpired authorization for at least one active truck\
And every featured provider has a published microsite and at least one provider-controlled public contact method\
And current vehicles and Empty or Partial capacity may enrich a card but neither a particular truck nor current capacity is required for provider eligibility.

### Scenario: public projection fails closed without rewriting the roster

Given a published daily roster exists\
When a provider, base region, public contact, or required verification is no longer eligible\
Then that slot is omitted from the anonymous projection immediately\
And another provider is not substituted automatically\
And the administrator sees the resulting roster gap\
And private contacts, plates, evidence files, exact coordinates, account data, and administrative notes remain absent.

### Scenario: daily TikTok link remains separate from provider identity

Given the administrator supplies an optional daily TikTok URL\
When it is saved or rendered\
Then only an HTTPS URL on TikTok or an allowed TikTok subdomain is accepted\
And one clearly labeled Watch today's spotlight action opens that daily event\
And a featured portrait summary leads directly to that transporter’s canonical microsite\
And the section remains complete and usable when no TikTok URL is present.

### Scenario: the default schedule creates two practical sessions

Given an ordered roster contains eligible featured transporters\
When Loadgistic generates the default daily schedule\
Then it uses one morning session and one evening session inside the 08:00–22:00 Ethiopia-time envelope\
And the configured morning block ends no later than 13:00 while the evening block begins no earlier than 17:00\
And one named four-hour midday intermission remains between those blocks\
And a short transition follows each presentation except the final presentation in its session\
And a fixed Sponsor break follows each configured group of presentations while lunch and operational work remain inside the midday intermission\
And each Sponsor break names the next active managed sponsor when one exists, without changing provider order or duration\
And provider presentation time excludes transitions, sponsor breaks, and the midday intermission\
And remaining presentation time is divided equally across the providers assigned to each session in roster order\
And every provider receives exactly one contiguous interval\
And the schedule remains deterministic for the same date, roster, and configuration\
And the displayed time uses Ethiopia time\
And no claim is made that TikTok itself enforces or reports the schedule.

### Scenario: low participation shortens the operating day

Given the roster does not need the full morning and evening blocks\
When the automatic schedule is generated\
Then the morning session contracts toward late morning or noon\
And the evening session contracts toward the end of the day\
And neither session is padded with invented featured transporters or excessively long presentation intervals merely to fill 08:00–22:00\
And the four-hour midday intermission remains visible even when additional unscheduled time exists around the shorter sessions.

### Scenario: administrators may regenerate or adjust the schedule

Given an administrator is preparing a featured day\
When the roster changes\
Then Auto schedule produces a fresh deterministic suggestion from the current participant count and saved break configuration\
And the administrator may configure the day envelope, morning end, evening start, provider transition, sponsor-break frequency, sponsor-break duration, and target provider presentation length within bounded values\
And the administrator may switch to Manual schedule and edit the start and end of each provider presentation\
And manual intervals must preserve roster order, remain inside one session, avoid overlap, and never cross the midday intermission\
And switching back to Auto discards manual interval authority and recalculates the complete suggestion\
And saving or publishing persists the selected mode, configuration, provider intervals, and derived public break timeline.

### Scenario: the transporter being discussed live is unmistakable

Given the current Ethiopia time falls within one provider's presentation interval\
When the featured board is open\
Then that provider portrait alone is marked Live now with a high-contrast highlight\
And the event summary identifies the current provider and its interval\
And every other portrait continues to show its own scheduled interval\
And during a transition, Sponsor break, or midday intermission no provider is falsely marked Live now\
And the event summary names the current break or session state\
And the current state advances without requiring a page refresh\
And before or after the broadcast the board shows scheduled or ended wording without falsely claiming a live event.

### Scenario: provider type is evidence based

Given an eligible provider enters the featured-provider projection\
When its public operating model is labelled\
Then an organization-owned provider is labelled Fleet transporter\
And an independent provider with approved active-truck ownership is labelled Owner-operator\
And an independent provider with approved authorization but no approved ownership is labelled Self-managed driver\
And those labels describe the provider rather than the size or number of its trucks.

### Scenario: Daily Featured Transporters has equal visual importance to the Market

Given a current published roster has eligible slots\
When the dedicated Daily Featured Transporters workspace renders\
Then it presents the seven-day rotation as a compact disclosure with today identified in its summary and highlighted when expanded\
And it names today's regional group and renders every provider in the ordered roster\
And each card leads with the provider's own public profile image or the Loadgistic default transporter portrait rather than a truck image\
And each card uses current records for provider identity, general base place, verification summary, reviews, active truck count, and available-now count\
And detailed truck configurations and routes remain on the provider microsite instead of making the spotlight appear truck-based\
And the seven-day programme, event summary, featured board, and Sponsored panel form one coherent remaining-viewport workspace\
And the heading stays compact while the regional group is named once in the date line and short introduction so visitors reach the portraits quickly\
And each provider occupies one numbered portrait tile on a realistic Loadgistic public-feature billboard rather than a booth, hall, pinboard, or detached carousel card\
And the board uses one warm-white evenly lit display surface, visibly distinct from the teal Sponsored panel, with a thin neutral edge, subtle material texture, and no nested frames, heavy navy perimeter, decorative borders, directional sunlight, cast shadows, or visual clutter\
And the page heading carries the programme title once, so the board does not repeat a second Featured today heading or provider count\
And the rendered board asset contains no baked provider, card, number, schedule, logo, or roster data\
And every portrait card shows provider identity, operating model, general base, and its walkthrough time before selection\
And the billboard fills the available featured-section width instead of being scaled inside a smaller framed viewport\
And its responsive grid adds rows and overall height as the participant count grows while choosing sensible desktop, tablet, and phone columns\
And every portrait tile has a unique non-overlapping position inside one clean billboard surface at desktop and mobile sizes\
And on wide screens the Sponsored transporters collection occupies a compact right-hand command-style panel beside, but visually separate from, the billboard surface\
And the billboard image and tint stop at the featured roster while the Sponsored panel uses its own solid treatment and clear advertising label\
And on narrow screens the Sponsored panel remains a permanent compact region above the featured roster so sponsors keep their own visible placement without delaying access to the board\
And the regional introduction stays compact while the detailed daily schedule becomes a closed disclosure that retains the current broadcast state in its summary\
And at a 412 CSS-pixel phone width the featured billboard remains visible in the initial bounded workspace\
And selecting a portrait opens a compact provider summary with separate View transporter profile and View trucks on map actions\
And the profile action opens the canonical microsite while the map action returns to a Truck Market filtered to that transporter’s current trucks\
And either action closes the provider summary before same-page or cross-page navigation begins\
And the provider summary covers introduction, service, operating region or corridors, public evidence summary, and current fleet facts from authoritative records\
And the default presentation shows every portrait at a readable size without pan, zoom, reset, or drag controls\
And the section receives spacing, heading scale, controls, and visual weight comparable to the Truck Market\
And the persistent public navigation keeps the separate Truck Market one direct route transition away.

### Scenario: administrators control featured-provider presentation without becoming page designers

Given an administrator prepares a Daily Featured Transporters day\
When its roster is saved or published\
Then the administrator may set a short public headline, short introduction, optional TikTok event URL, and bounded two-session schedule configuration\
And the administrator may add, remove, and reorder any eligible provider in a variable-length roster\
And the administration view previews both sessions, every provider interval, transitions, Sponsor breaks, and the midday intermission before publication\
And the fixed regional group, provider eligibility, generated board geometry, schedule validation, safety wording, responsive layout, and Loadgistic visual system cannot be overridden\
And empty optional content falls back to truthful region-based copy\
And providers cannot pay for or edit a featured slot through their own workspace\
And the roster, presentation settings, slots, and audit record are saved atomically through a service-role-only Supabase command that rechecks administrator authority and current provider eligibility.

## Contract ownership

- Public page: homepage Daily Featured Transporters section
- Administrator: date-derived regional group, variable eligible roster and order, public headline, introduction, publication, TikTok reference, automatic/manual schedule mode, bounded break configuration, and provider interval overrides
- Application services: eligibility evaluation, provider operating-model classification, Ethiopia-day activation, two-session timeline calculation, public safe projection, and audited managed commands in the platform admin port
- Persistence: additive featured-day and ordered featured-slot tables with provider, general base place, date, positive position, schedule mode/configuration/manual intervals, and status constraints
- Tests: schedule generation, break boundaries, manual validation, real responsive billboard width, row growth and non-overlap in desktop/mobile browsers; repository authorization/eligibility; public projection; focused E2E; and visual review
