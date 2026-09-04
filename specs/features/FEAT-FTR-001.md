---
id: FEAT-FTR-001
title: Daily Featured Trucks programme
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-ADM-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-SPN-001, FEAT-UIX-001, FEAT-VER-001]
problem: Capacity seekers need a concise daily introduction to useful truck types and the Drivers operating them, while Loadgistic needs a manageable live programme that does not consume the entire day or turn provider eligibility into an endorsement.
behavior: Each Ethiopia calendar day has one truck-type theme and one administrator-curated ordered roster of exact active trucks with assigned Drivers. The default target is eight entries and may be changed by an administrator before publication. The deterministic 07:30–09:00 Ethiopia-time schedule divides the remaining airtime equally between selected trucks and inserts no more than four interludes of at most two minutes, naming an active sponsor when available. Public cards lead with the selected truck and Driver; the owning transporter is shown when applicable. Sponsors remain a separately managed presentation surface.
contracts: [FeaturedTruckTypeRotation, FeaturedTruckCandidate, FeaturedTruckDay, FeaturedTruckSlot, FeaturedTruckAdminCommand, PublicFeaturedTruckProjection, FeaturedTruckBoardLayout, FeaturedDaySchedule, FeaturedScheduleEntry, FeaturedScheduleConfig, DailyTikTokBroadcast]
observability: [FEATURED_DAY_SAVED audit, FEATURED_DAY_PUBLISHED audit, administrator roster-gap state]
rollout: Add exact truck-and-Driver slot references additively, migrate the disposable demonstration roster to current truck candidates, retain historical provider-slot identifiers only for rollback integrity, and publish the new projection only after local Supabase, authorization, schedule, and responsive board checks pass.
---

# Daily Featured Trucks programme

### Scenario: each day has one understandable truck-type theme

Given Loadgistic presents a seven-day featured programme\
When the current Ethiopia date is resolved\
Then Monday features mini trucks\
And Tuesday features cargo vans\
And Wednesday features pickups, including open and stake configurations\
And Thursday features light-duty trucks\
And Friday features medium-duty trucks\
And Saturday features heavy rigid trucks\
And Sunday features heavy rigid trucks with trailers\
And the rotation describes the vehicle configuration being discussed rather than ranking regions, transporters, or Drivers.

### Scenario: an administrator selects exact truck-and-Driver entries

Given an administrator prepares a featured day\
When candidates are listed\
Then each candidate is an active truck matching that day's theme with one active assigned Driver\
And each candidate includes the truck configuration and image, Driver first name and role label, general operating place, and owning transporter when one exists\
And the administrator chooses an ordered set of exact candidates rather than selecting a transporter and allowing the public projection to guess a truck\
And the default publication target is eight entries while an administrator may set a bounded target from one through twelve\
And publication requires the selected count to equal the saved target\
And each truck and each slot position appears at most once\
And no candidate is silently substituted after selection.

### Scenario: eligibility remains truthful and safe

Given a truck and Driver are considered for the programme\
When eligibility is evaluated\
Then the truck is active and owned by the candidate provider\
And the Driver is active and currently assigned to that truck\
And the owning provider has a published public profile with at least one public contact method\
And available Driver and truck document-review states are shown as reviewed, pending, missing, rejected, or expired rather than turning placement into a guarantee\
And private contacts, plates, evidence files, exact coordinates, account data, and administrative notes remain absent.

### Scenario: the public programme never silently disappears

Given the current day has no published roster or a selected truck or Driver is no longer eligible\
When the Featured route renders\
Then the daily truck-type theme and programme window remain visible\
And the page states concisely that the roster is being prepared\
And the empty-state message uses the available board width on desktop and phone without collapsed text columns\
And one clear action returns the visitor to Open capacity\
And no truck, Driver, or transporter is invented or substituted\
And an administrator draft is never published or overwritten by a public read.

### Scenario: the default schedule is one focused morning programme

Given a published ordered roster contains the saved target number of eligible trucks\
When Loadgistic generates the automatic schedule\
Then the programme starts at 07:30 and ends at 09:00 in `Africa/Addis_Ababa`\
And every selected truck receives exactly one contiguous presentation interval in roster order\
And presentation time is divided as evenly as whole minutes permit\
And short programme interludes are inserted between configured groups of presentations\
And no more than four interludes are created\
And each interlude lasts no more than two minutes\
And an interlude names the next active managed sponsor when available and otherwise uses the neutral label Programme pause\
And no lunch, afternoon session, evening session, four-hour intermission, or all-day operating window appears\
And the same date, roster, target, and interlude configuration always produce the same schedule.

### Scenario: administrators may adjust the concise programme

Given an administrator is preparing a featured day\
When programme controls are used\
Then the administrator may change the target entry count, interlude frequency, and one- or two-minute interlude duration within bounded values\
And Auto schedule recalculates equal presentation intervals from the ordered roster\
And Manual schedule may adjust each truck interval only inside 07:30–09:00 without overlap or reordering\
And a manual gap is presented as a programme interlude rather than unexplained dead time\
And saving or publishing persists the target, selected truck IDs, resolved Driver IDs, schedule mode, configuration, intervals, and audit record atomically\
And non-administrators are denied without changing the roster or schedule.

### Scenario: the truck being discussed live is unmistakable

Given the current Ethiopia time falls within one truck presentation\
When the Featured board is open\
Then that truck alone is marked Live now with a high-contrast treatment\
And the compact programme summary names the truck configuration, Driver first name, and interval\
And every other card retains its own interval\
And during an interlude no truck or Driver is falsely marked live\
And the state advances without a page refresh\
And before or after the programme the board shows Scheduled or Ended without claiming a live event.

### Scenario: the truck and Driver lead every public card

Given a published roster has eligible slots\
When the dedicated Featured workspace renders\
Then it names the daily truck-type theme once in a compact programme command\
And each numbered card leads with the exact cargo-configuration image rather than a transporter portrait\
And each card shows the truck configuration, Driver first name, Driver role, general operating place, and scheduled interval before selection\
And a fleet-owned truck also shows its owning transporter while an Owner-operator or Self-managed Driver keeps the corresponding role label\
And selecting a card opens concise truck, Driver, document-review, ownership, service, and schedule details\
And separate actions open the owning transporter profile when one exists or locate the exact truck in Open capacity\
And the board uses one clean warm-white display surface without a second page title, nested frame, booth, hall, pinboard, or baked roster data\
And responsive rows preserve readable vehicle artwork and text without horizontal page scrolling.

### Scenario: sponsors stay separate and useful

Given active sponsors exist for the featured date\
When the Featured workspace renders\
Then Sponsors occupy their own clearly labelled panel rather than becoming featured truck cards\
And transporter sponsors link to their profile or trucks while outside advertisers expose only their saved website or phone action\
And phone layouts show two sponsor cards at a time and rotate deterministic pairs automatically\
And sponsor names may appear in programme interludes without changing truck order or presentation duration\
And sponsored placement is not described as reviewed, ranked, or guaranteed service.

### Scenario: loading preserves the real workspace structure

Given Featured data or its client presentation code is still loading\
When a visitor navigates to the route\
Then the persistent public app bars remain in place\
And the compact programme command, sponsor panel, and featured card grid show calm geometry-matched skeletons in their final locations\
And the interface does not replace the workspace with a large loading headline or internal implementation explanation\
And each independently loaded map, schedule, card collection, or dialog owns its bounded loading feedback without blocking unrelated controls.

## Contract ownership

- Public page: dedicated Featured route, daily theme, compact schedule, selected truck detail, and separate Sponsors panel
- Administrator: day-derived truck theme, bounded target count, ordered exact truck-and-Driver roster, public message, TikTok reference, automatic/manual schedule, and interlude settings
- Application services: candidate eligibility, Driver assignment resolution, Ethiopia-day activation, deterministic 07:30–09:00 schedule, sponsor interlude assignment, and public safe projection
- Persistence: additive day configuration and ordered slot references to exact vehicle and Driver identities, with service-role-only commands and audit
- Tests: schedule boundaries and equality, candidate ownership/assignment, authorization, projection privacy, responsive board/loading geometry, and focused desktop/mobile visual review
