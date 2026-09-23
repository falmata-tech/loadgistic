---
id: FEAT-FTR-001
title: Daily Featured Trucks programme
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-ADM-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-SPN-001, FEAT-UIX-001, FEAT-VER-001, FEAT-IAM-001]
problem: Capacity seekers need a concise daily introduction to useful truck types and the Drivers operating them, while Loadgistic needs a manageable live programme that does not consume the entire day or turn provider eligibility into an endorsement.
behavior: Each Ethiopia calendar day has one truck-type theme and an ordered roster of exact active trucks with distinct assigned Drivers. Automatic selection prepares weekly subsets across the next seven days using a persisted random no-repeat round of exact eligible truck-and-Driver pairs. The saved daily count is a ceiling (default eight, one through twelve), and the actual eligible selected count determines slots and airtime. Manual-only mode and individual curated days remain available; automation never changes a saved day. The deterministic 07:30–09:00 Ethiopia-time schedule divides airtime equally between selected trucks with no more than four interludes of at most two minutes, naming an active sponsor when available. Public cards lead with the Driver's name, role, and portrait while retaining the exact truck and provider. Sponsors stay separate.
contracts: [FeaturedTruckTypeRotation, FeaturedTruckCandidate, FeaturedTruckDay, FeaturedTruckSlot, FeaturedTruckAdminCommand, PublicFeaturedTruckProjection, FeaturedTruckBoardLayout, FeaturedDaySchedule, FeaturedScheduleEntry, FeaturedScheduleConfig, DailyTikTokBroadcast]
observability: [FEATURED_DAY_SAVED audit, FEATURED_DAY_PUBLISHED audit, FEATURED_DAY_AUTO_PUBLISHED audit, PLATFORM_CONTROLS_UPDATED audit, bounded worker counts, administrator roster-gap state]
rollout: Add exact truck-and-Driver slot references additively, migrate the disposable demonstration roster to current truck candidates, retain historical provider-slot identifiers only for rollback integrity, and publish the new projection only after local Supabase, authorization, schedule, and responsive board checks pass.
---

# Daily Featured Trucks programme

### Scenario: automatic daily selection with a manual day override

Given automatic Featured selection is enabled with a target from one to twelve\
When the scheduled managed-operations worker prepares the next seven Ethiopia dates\
Then it persists one ordered daily roster from active eligible trucks and Drivers
matching each day's existing truck-type theme\
And random selection draws from exact truck-and-Driver pairs not yet selected in the current round\
And no automatic pair repeats until every currently eligible pair has been selected in that round\
And a new round starts only after the global eligible pool is exhausted\
And each daily roster still avoids duplicate Drivers\
And fewer eligible candidates produces a smaller honest roster, never invented entries\
And retries do not change a saved roster, target, or its audit history\
And a manually saved draft or published day is never overwritten by automation\
And public reads do not create or overwrite a roster.

Given an administrator opens Featured\
When they choose Automatic selection or Manual only and set the daily count\
Then the policy is saved with an audit and applies to unprepared dates\
And Prepare upcoming days runs the same bounded generator immediately\
And existing manual selection and publishing remain available for individual days\
And automatic selection is distinct from automatic allocation of presentation time\
And unauthorized callers cannot change policy or generate rosters.

### Scenario: random weekly subsets retain round history

Given some eligible truck-and-Driver pairs have already been chosen\
When automation prepares an unsaved date\
Then only remaining pairs in the current round may be chosen, using a random draw without a learned score\
And a day with no remaining pairs in its theme stays unscheduled instead of repeating before other themes finish\
And the same truck with a newly assigned Driver is a different eligible pair\
And newly eligible pairs may join the current round while inactive/unassigned pairs do not block its completion\
And saved rosters and their random order remain unchanged on retries\
And selection history survives a later manual roster edit or deletion\
And public/authenticated browser roles cannot read or write the history or invoke generation.

Given the current eligible pool has all been selected\
When automation needs the next unsaved roster\
Then it begins a new round and pairs become eligible for a fresh random draw\
And the ledger records the round, pair and selection date atomically with its day\
And the existing generation lock and unique round/pair key prevent concurrent duplicates.

The user chose weekly subsets on September 21. Preserve daily themes and the
07:30–09:00 window. A smaller eligible subset produces fewer, longer intervals;
no made-up entries fill a daily target. Historical published pairs bootstrap the
first round, and manual overrides remain independently available. The no-repeat
policy governs automatic selection; manual curation may deliberately override it.

Implemented locally: migration 098 adds a private, RLS-protected selection ledger and replaces
only the generator's selection policy. Keep existing roster snapshots and public
projections unchanged. Verify local round exhaustion, changed eligibility,
concurrency/idempotence, manual-history retention and negative permissions;
reuse count-dependent schedule tests. No hosted migration without a reviewed
release. Rollback restores the prior generator while retaining the ledger.

### Scenario: each day has one understandable truck-type theme

Given Loadgistic presents a seven-day featured programme\
When the current Ethiopia date is resolved\
Then Monday features mini trucks\
And Tuesday features cargo vans\
And Wednesday features pickups, including open and stake configurations\
And Thursday features light-duty trucks\
And Friday features medium-duty trucks\
And Saturday features all heavy configurations: rigid trucks, fixed-trailer rigid trucks, and tractors with Container, Dry van, or Heavy equipment trailers\
And Sunday features courier cars for small-shipment capacity\
And the rotation describes the vehicle configuration being discussed rather than ranking regions, transporters, or Drivers.

### Scenario: an administrator selects exact truck-and-Driver entries

Given an administrator prepares a featured day\
When candidates are listed\
Then each candidate is an active truck matching that day's theme with one active assigned Driver\
And each candidate includes the truck configuration and image, Driver first name and role label, general operating place, and owning transporter when one exists\
And each candidate includes the Driver-selected public portrait, or an allowlisted demo preset when present\
And a Driver without a portrait uses a clear person silhouette with a three-spoke steering wheel in front rather than a generic disc\
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
And the page states concisely that no trucks are scheduled today\
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

### Scenario: the Driver leads every public card without losing the truck

Given a published roster has eligible slots\
When the dedicated Featured workspace renders\
Then it names the daily truck-type theme once in a compact programme command\
And each numbered card leads with the assigned Driver portrait and first name rather than a transporter portrait or generic truck catalogue image\
And each card shows the Driver role, exact truck configuration, truck identity, general operating place, owning transporter, and scheduled interval before selection\
And a fleet-owned truck also shows its owning transporter while an Owner-operator or Self-managed Driver keeps the corresponding role label\
And selecting a card opens a Driver-led summary with concise truck, document-review, ownership, service, and schedule details\
And a missing or invalid portrait preset falls back to a neutral person-and-steering-wheel profile icon without exposing a private upload path\
And a separate action opens the owning transporter profile when one exists\
And the exact truck receives a Locate in Open capacity action only while its latest signal is publicly visible Empty or Partial capacity, so a private or Off Duty truck never leads to an empty public search\
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

- Public page: dedicated Featured route, daily theme, compact schedule, Driver-led selected-truck detail, and separate Sponsors panel
- Administrator: day-derived truck theme, bounded target count, ordered exact truck-and-Driver roster, public message, TikTok reference, automatic/manual schedule, and interlude settings
- Application services: candidate eligibility, Driver assignment and safe portrait resolution, Ethiopia-day activation, deterministic 07:30–09:00 schedule, sponsor interlude assignment, and public safe projection
- Persistence: additive day configuration and ordered slot references to exact vehicle and Driver identities, with service-role-only commands and audit
- Tests: schedule boundaries and equality, candidate ownership/assignment, authorization, projection privacy, responsive board/loading geometry, and focused desktop/mobile visual review

## Self-managed public Driver portraits (verified locally; rollout pending)

### Scenario: a Driver chooses a public portrait

Given an active DRIVER identity, including a Company driver or a limited-plan account\
When they upload a JPG, PNG or WebP of at most four MiB through Account & plan
and explicitly confirm that the photo may be public\
Then persisted authority is checked before Storage writes and again at activation\
And the server decodes a single-frame raster within 25 million pixels, applies
orientation, crops to a 512-pixel square and re-encodes JPEG without EXIF/GPS metadata\
And the normalized image passes the existing quarantine/inspection policy\
And one active portrait replaces the Driver's previous photo and demo preset\
And the account preview and eligible Featured cards display the chosen image\
And no vehicle assignment, verification, fleet permission or public phone changes.

### Scenario: portrait permission and validation fail safely

Given a signed-out, inactive, non-Driver or different account actor, missing public
consent, oversized/invalid/mismatched/animated input or failed Storage inspection\
When a portrait mutation is attempted\
Then no other Driver's portrait can be changed and the current portrait remains\
And a safe error explains the failed action without exposing paths or decoder errors\
And browser roles cannot read portrait metadata, execute commands or access bucket objects.

### Scenario: replacement and removal revoke future image reads

Given a Driver has a public portrait or a demo preset\
When they replace or remove it from Account & plan\
Then only a newly generated opaque portrait ID may resolve to the current photo\
And old IDs return 404 and removal clears the demo preset to a neutral icon\
And every public image read checks current portrait state and active DRIVER identity\
And responses use no-store and nosniff, with no account IDs or storage paths\
And already downloaded copies cannot be recalled.

### Scenario: interrupted uploads and deletion retries preserve the current image

Given a registered portrait upload or a replaced/removed portrait\
When activation fails, its response is ambiguous, or object deletion fails\
Then an active image is never deleted as speculative failure cleanup\
And registered pending uploads older than one hour and finished retired images are claimed
in bounded cleanup batches, with retry after five minutes for failed deletion\
And removing a still-writing upload prevents activation but defers deletion until
that attempt settles or the one-hour stale boundary passes\
And a claimed image cannot later become active\
And the signed existing operations worker retries deletion with count-only results.

Contracts: `DriverPortraitWorkspace`, `DriverPortraitUpload`, `PublicDriverPortrait`.
Migration 087 uses service-only upload states PENDING → ACTIVE → RETIRED → DELETING
(or PENDING → RETIRED/DELETING), profile-row locks and one active image per Driver.
Portrait Storage requests have a 30-second per-request timeout.
Storage references are reserved before object writes in the existing private
provider-profile bucket under a distinct driver-portrait prefix. Public consent
covers access to the photo's opaque URL even when the Driver is not on today's
roster; roster eligibility remains unchanged. Owners/admins cannot edit another
Driver's portrait. Portrait upload/remove audits record no contacts or file paths.
Sharp 0.35.4, already installed through Next, becomes an explicit pinned dependency
for server normalization (ADR-054). Apply 087 before app/worker rollout; UI rollback
retains metadata and cleanup. Retire portraits before future account deletion.
No hosted rollout is authorized. Verification: `tests/driver-portrait-upload.test.mjs`,
`tests/sql/driver-portraits.sql`, `tests/e2e/driver-portraits.spec.ts` and existing
managed-operations/Storage tests. Real local browser upload/download and the
quality/build gates passed; evidence is in `docs/BUILD_VERIFICATION.md`.
