---
id: FEAT-FTR-001
title: Daily Featured Transport Provider programme
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-ADM-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-SPN-001, FEAT-UIX-001, FEAT-VER-001, FEAT-IAM-001, FEAT-SUP-001]
problem: Capacity seekers need a concise daily introduction to useful truck types and the Drivers operating them, while Loadgistic needs a manageable live programme that does not consume the entire day or turn provider eligibility into an endorsement.
behavior: Hosted account rotation introduces up to eight eligible Transport Provider accounts per scheduled day under FEAT-CON-001, preserving saved/manual selections and completed-round fairness. The accepted October26 follow-up confines every provider and sponsor interval to22:30–23:59 Africa/Addis_Ababa, with at least ten minutes per provider, and names the public programme Daily Featured on TikTok LIVE. This new timing/header is pending implementation and rollout; historical contracts below do not override the current acceptance.
contracts: [FeaturedTruckTypeRotation, FeaturedTruckCandidate, FeaturedTruckDay, FeaturedTruckSlot, FeaturedTruckAdminCommand, PublicFeaturedTruckProjection, FeaturedTruckBoardLayout, FeaturedDaySchedule, FeaturedScheduleEntry, FeaturedScheduleConfig, DailyTikTokBroadcast]
observability: [FEATURED_DAY_SAVED audit, FEATURED_DAY_PUBLISHED audit, FEATURED_DAY_AUTO_PUBLISHED audit, PLATFORM_CONTROLS_UPDATED audit, bounded worker counts, administrator roster-gap state]
rollout: Add exact truck-and-Driver slot references additively, migrate the disposable demonstration roster to current truck candidates, retain historical provider-slot identifiers only for rollback integrity, and publish the new projection only after local Supabase, authorization, schedule, and responsive board checks pass.
---

# Daily Featured Trucks programme

Hosted ledger208 implements [FEAT-CON-001](FEAT-CON-001.md)'s distinct Transport
Provider account rounds. Earlier truck-theme and morning-window sections below
are historical where they conflict with that account contract or the October26
acceptance. The new evening window and programme heading remain pending a
source-matched local qualification and reviewed rollout.

## October26 accepted programme window and identity — implementation pending

Given a current Featured programme is prepared for an Ethiopia calendar date\
When automatic or manual timing is saved or published\
Then every provider spotlight and sponsor mention is inside22:30–23:59 in
Africa/Addis_Ababa (10:30PM–11:59PM EAT) on that same date\
And the programme never reaches midnight or borrows time from the next day\
And automatic intervals are contiguous, ordered and end at23:59\
And the configured daily provider target is at most eight, default eight\
And every chosen provider receives at least ten whole minutes excluding sponsors\
And at most four sponsor mentions of at most two minutes each fit inside the
same window; they cannot extend it or reduce a provider below ten minutes\
And eight providers with four two-minute mentions share81 provider minutes,
with one eleven-minute turn and seven ten-minute turns\
And a larger candidate pool does not increase the daily cap or bypass the
existing account round/eligibility/selection rules.

Given an authorized manager adjusts the programme\
When manual timings, provider count, sponsor durations or order are submitted\
Then overlaps, intervals outside22:30–23:59, a turn shorter than ten minutes,
an oversized roster or total duration beyond the window are rejected before save\
And UI previews, direct application/API writes and PostgreSQL enforce the same
rule; HTML time controls retain ordinary same-day24-hour canonical values\
And timezone/device settings cannot move the programme to another feature date.

Given web or Android opens Featured, including its loading/error states\
Then the page heading identifies Daily Featured on TikTok LIVE in the selected
language and the programme time appears beside its date\
And saved day headlines never replace that primary programme identity\
And any distinct curated day headline is retained as secondary programme content,
without repeating a generic heading or adding explanatory paragraphs\
And actual on-now/Watch live language still requires a confirmed Live broadcast;
merely showing the evening programme never claims an active stream\
And no Morning programme label or obsolete morning-window help appears for a
new evening schedule.

Given pre-change saved days exist\
When the timing update is rehearsed or rolled out\
Then past schedules, their selected accounts, sponsor records and fairness history
remain unchanged and readable with their genuine recorded times\
And current/future automatic timing may be rebuilt inside the evening window
without changing selected accounts/order, sponsor identities or rotation history\
And incompatible current/future manual timing stops rollout for exact review,
rather than silently replacing curated durations or leaving an invalid programme\
And no hosted write occurs before the exact SQL, affected counts, backup and
rollback evidence are reviewed under the existing release contract.

Qualification: deterministic automatic/manual schedule and midnight/date-boundary
regressions, direct API/SQL authority/limit tests, saved-history/rotation parity,
actual desktop/phone Chrome and Expo evening schedules in en/am/om, followed by
normal full gates. This does not create or start a TikTok stream.

### Bounded administrator-save diagnostics — local repair pending

Given an authorized Featured save fails in its database command or subsequent
administrator readback\
When the server handles the failure\
Then internal diagnostics distinguish the fixed SAVE_RPC and READBACK stages
with only an allowlisted business enum or bounded database error category\
And diagnostics never include raw exception messages/stacks, record identifiers,
selected providers, form values, contact details, tokens or credentials\
And the public response remains a bounded friendly error with the existing
permission, validation, audit and save boundaries unchanged\
And focused tests prove both stage attribution and exclusion of sensitive values
before a single controlled local replay; unresolved causes remain unqualified.

The controlled local replay confirmed SAVE_RPC / SQLSTATE57014 under the
existing REST8-second statement limit. A direct eight-account draft took about
seven seconds; the installed writer repeatedly evaluates the complete eligible
account set inside its selected-vehicle loop. This is a confirmed performance
repair, not permission to raise the timeout or skip eligibility checks.

Given an authorized eight-provider draft or publish command\
When eligibility is evaluated during the save\
Then the authoritative eligible-account set may be reused within that command\
And every selected vehicle retains its existing policy, active assignment,
account ownership and eligibility rechecks\
And invalid or revoked selections still reject atomically without partial days,
slots, rotation turns or audit success\
And timing, account order, sponsor records and permissions remain unchanged\
And the actual REST save and administrator readback complete within the existing
timeout with measured margin on the qualified fixture; no timeout is widened.

## October18 courier configurations — planned local restoration

Restore `Courier car` and `Courier motorcycle` to the supported vehicle catalogue
and Featured eligibility. Keep the seven existing theme keys, dates and weekly
order: Tuesday's `cargo-vans` theme becomes Vans and couriers and includes all
three configurations; Sunday's mixed theme includes all seventeen supported
configurations. Other weekdays retain their exact type sets. This does not reset
fairness rounds or rewrite a saved/manual roster or schedule.

Given an otherwise eligible courier truck-and-driver pair is waiting\
When Automatic Featured prepares an unsaved Tuesday or mixed Sunday\
Then it may select that exact pair under the existing per-theme fairness rules\
And inactive, unassigned, private, Draft or otherwise unqualified pairs remain out\
And the configured eight-showcase limit and protected saved days remain unchanged.

Web/native cards and filters reuse the existing car/motorcycle artwork. Verification
maps shared catalogue/theme selection, SQL exact-pair eligibility and preserved
manual/saved days; migration168 and demo rebalancing have separate local reviews.

### October 14 provider-owner compatibility — local work

Given the authoritative eligible-link command accepts a provider owner driving
their organization's truck or an employee under a personal provider\
When the application builds Featured candidates\
Then it preserves that eligible pair without requiring an additional employee
record for the driving owner\
And rejected/inactive/unassigned pairs remain excluded by the authoritative link
and public-provider eligibility checks\
And public driver copy says Driver without inferring employment or ownership.
This is part of the locally implemented FEAT-FLT-001 change, not a claim that
the production Featured137 deployment already includes the new owner model.

Local compatibility evidence now includes both advancing-calendar and random-
round SQL suites with owned synthetic qualification. Their original fairness,
saved/manual-day, privacy and failure-rollback assertions pass. The separately
backed-up additive local demo correction restores eight visible trucks without
overwriting existing saved days; the ordinary worker adds only two missing days,
leaving all seven upcoming dates with eight eligible pairs. Actual web/Expo phone
and desktop web cards/actions pass. See the October14 receipts in
`specs/TRACEABILITY.md`; full release and hosted gates remain separate.

Migration137 is applied and verified October13: exact1a158f8 / CI38454443547
passes all8jobs; five missing days prepared, two saved days preserved. Live
aggregate readback confirms seven published dates with eight distinct eligible
Drivers each and no invalid pair. Live web desktop/phone hydration/details and
native public API pass. The two known WARN findings remain visible under the
owner's consumed Featured-only exception; no138/139/new-interface publication
is inferred. Preserve exact bootstrap and advancing-week regression evidence.

### October 13 recurring empty-programme diagnosis

Read-only live evidence confirms AUTO mode, target eight and a successful scheduled
check at 15:00 UTC. The current global round has 131 eligible pairs and five
remaining mini-truck pairs. Fifteen eligible vans have already had their turn;
Tuesday and four following truck-type days consequently have no saved roster.
The HTTP 200 empty response occurs on both public web and native API. This is
the global no-repeat policy, not another candidate-read failure or stopped worker.
The owner subsequently instructed the agent to choose the best rule that keeps
each day's matching trucks visible and selects those still waiting in later weeks.
Independent theme rounds below implement that decision. Preserve the global
legacy ledger and protected saved days; do not reset or erase them.
Regression must exercise an advancing calendar with unequal theme counts and
mixed Sunday selection, rather than repeatedly regenerating the same seven dates.

Given Featured receives an unsuccessful API response with an empty or whitespace
error message\
When the mobile visitor opens the programme or refreshes an existing programme\
Then show a meaningful recoverable error and the existing retry control\
And retain any last successfully loaded programme without presenting it as fresh\
And normal navigation and later successful retry continue working.

### Scenario: truck-type days keep filling as the calendar advances

Given Automatic mode and an unsaved day with matching public-eligible truck/Driver pairs\
When the worker prepares that day and the following six Ethiopia dates\
Then fill the configured daily count when enough distinct eligible Drivers exist\
And take pairs still waiting in that theme's current round before any repeat\
And start that theme's next random round after all its currently eligible pairs have had their turn, even within the same daily roster\
And never choose the same truck/pair or Driver twice in a day\
And exhaustion in a different theme cannot leave this day unscheduled\
And a smaller genuine pool shows all possible distinct Drivers instead of invented entries\
And no eligible pairs produces an honest empty day.

Given fifteen eligible vans, a daily target of eight and no saved next Tuesday\
When two successive Tuesdays are prepared\
Then the first uses eight pairs and the next uses the remaining seven before selecting one pair from the new round\
And each day's order is persisted, retryable without reshuffling and within the existing airtime window.

Given Sunday draws mixed trucks from the same truck-type rounds and a pair is already scheduled within six days\
When another unseen pair has no nearby scheduled appearance\
Then prefer that other pair before the nearby repeat\
And if nearby appearances are unavoidable, keep filling Sunday's roster without repeating a Driver within that day\
And a Sunday selection counts as that pair's turn in its actual truck-type round\
And nearby-appearance preference must not prevent eligible days from being filled.

Given historical global selection history, a saved future day or manual draft\
When this policy is introduced or retried\
Then retain the old history and seed the independent rounds from known selections\
And retain exact saved dates, pairs, order, timing and manual source\
And inactive, hidden, restricted-review or unassigned pairs cannot consume new public turns\
And new/changed eligible pairs join the matching theme fairly\
And the existing generation lock, failure rollback, audit and browser denial remain enforced\
And staff remaining counts describe the theme rounds without double-counting mixed Sunday's overlapping pool.

### Scenario: candidate reads remain complete as the fleet grows

Given a themed day has hundreds or thousands of eligible trucks and capacity history\
When the web or mobile Featured projection reads its saved roster\
Then database requests use bounded identifier batches and paginated reads\
And every eligible candidate remains available without exceeding gateway URL or row limits\
And the latest capacity is chosen by update time and identifier, never an older public record\
And a failed batch reports a recoverable failure rather than publishing a partial or invented roster\
And the saved day, round history, manual selections and order do not change.

Given the Featured data service is unavailable\
When the visitor opens Featured\
Then normal public navigation remains usable with a concise retry action\
And the failure is distinct from an honestly empty programme\
And diagnostics remain server-side without exposing identifiers or raw database errors.

October 11 diagnosis: the local Sunday candidate lookup failed with HTTP 414
because its capacity query included 236 vehicle identifiers in one URL. This is
a read-path defect, independently of round exhaustion. Regression:
`tests/featured-candidate-reads.test.mjs`. The pre-205 truck-theme rollback suite
established the historical guarantees. The local account-rotation successor in
`tests/sql/featured-provider-rounds.sql` checks full rounds, random order,
retained history, retry stability, manual precedence, failure rollback and
unauthorized denial against the new policy.

### Scenario: automatic daily selection with a manual day override

Given a staff member has the Featured responsibility and opens an unsaved day\
When they add eligible truck-and-driver pairs, save a draft, set manual times,
publish the day, schedule an outside sponsor and disable that placement\
Then every visible action persists the corresponding roster, schedule or sponsor
state and audit attribution\
And the draft stays unpublished until Publish succeeds\
And the resulting programme reads the saved pair order and times\
And revoking Featured denies a stale write without changing the saved day\
And editing this day does not change automatic policy or unrelated days.

Focused local evidence: `tests/e2e/featured-connected-controls.spec.ts` passes both
desktop/phone cases using one disposable future date and exact synthetic staff/
sponsor cleanup. Saved draft/publication, manual times, sponsor save/disable,
revoked authority and unchanged platform controls are verified. An initial
unbounded exact-label selector was corrected to the existing accessible combobox;
no app behavior changed for that harness mismatch. Receipt:
`.local/internal-workflows-20261014/featured-connected-final-runner.json`.
The case does not run the global Prepare upcoming days action; this evidence is
separate from137's automatic-rotation regression and hosted verification above.

Given automatic Featured selection is enabled with a target from one to eight\
When the scheduled managed-operations worker prepares the next seven Ethiopia dates\
Then it persists one ordered daily roster from active eligible trucks and Drivers
matching each day's existing truck-type theme\
And random selection draws from exact truck-and-Driver pairs not yet selected in the current round\
And no automatic pair repeats within a theme until every currently eligible pair in that theme has been selected in that round\
And a new theme round starts after that theme's eligible pool is exhausted\
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
And a theme with all its pairs selected starts its next round instead of waiting for other themes\
And the same truck with a newly assigned Driver is a different eligible pair\
And newly eligible pairs may join the current round while inactive/unassigned pairs do not block its completion\
And saved rosters and their random order remain unchanged on retries\
And selection history survives a later manual roster edit or deletion\
And public/authenticated browser roles cannot read or write the history or invoke generation.

Given the current theme's eligible pool has all been selected\
When automation needs the next unsaved roster\
Then it begins a new round and pairs become eligible for a fresh random draw\
And the ledger records the round, pair and selection date atomically with its day\
And the existing generation lock and unique round/pair key prevent concurrent duplicates.

The user chose weekly subsets on September 21 and corrected empty-day behavior
on October 13. Preserve daily themes and the
08:30–12:00 window. A smaller eligible subset produces fewer, longer intervals;
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
And Sunday features mixed freight trucks from the remaining eligible pairs\
And the rotation describes the vehicle configuration being discussed rather than ranking regions, transporters, or Drivers.

### Scenario: an administrator selects exact truck-and-Driver entries

Given an administrator prepares a featured day\
When candidates are listed\
Then each candidate is an active truck matching that day's theme with one active assigned Driver\
And each candidate includes the truck configuration and image, Driver first name and role label, general operating place, and owning transporter when one exists\
And each candidate includes the Driver-selected public portrait, or an allowlisted demo preset when present\
And a Driver without a portrait uses a clear person silhouette with a three-spoke steering wheel in front rather than a generic disc\
And the administrator chooses an ordered set of exact candidates rather than selecting a transporter and allowing the public projection to guess a truck\
And the default publication target is eight entries while an administrator may set a bounded target from one through eight\
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

### Scenario: optional documents do not exclude a one-vehicle provider

Given an active personal Transport Provider has one Live vehicle, a current
assigned Driver and a published profile with a public contact and base place\
And the provider has no approved identity, permission or ownership documents\
When Featured evaluates that exact vehicle and Driver\
Then the pair is eligible without creating or approving a document\
And missing ownership, permission and operating-licence facts remain unverified\
And an additional unqualified Live vehicle excludes the provider's fleet until
the normal qualifying-authority rule is satisfied or only one vehicle is Live\
And revoking or expiring authority never leaves a verified badge behind.

Given an AUTO day already contains the exact vehicle and Driver\
When the owning provider loses and then legitimately regains publication eligibility\
Then the public projection excludes and then restores that saved pair\
And its day, slot order, vehicle/Driver identities and round history are unchanged\
And a MANUAL day is never regenerated as a recovery shortcut.

Regression: `tests/sql/featured-optional-documents.sql` owns rollback-only personal
and fleet fixtures. The pre-205 truck-theme tests covered seven-day themes and
pair rounds. The account-based successor uses `tests/sql/featured-provider-rounds.sql`
for complete provider rounds, saved/manual-day protection, privacy denials and
atomic generation; `tests/sql/featured-team-permission.sql` covers loss and
recovery of provider eligibility without changing a saved day.
Migration080 already removed the historical extra Featured document gate; this
scenario does not introduce a new publication exception or require a new migration.

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
Then the programme starts at 08:30 and ends at 12:00 in `Africa/Addis_Ababa`\
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
Then the administrator may change the target entry count, sponsor mention count (zero to four), and one- or two-minute interlude duration within bounded values\
And Auto schedule recalculates equal presentation intervals from the ordered roster\
And Manual schedule may adjust each truck interval only inside 08:30–12:00 without overlap; reordered trucks use chronological intervals\
And a manual gap is presented as a programme interlude rather than unexplained dead time\
And saving or publishing persists the target, selected truck IDs, resolved Driver IDs, schedule mode, configuration, intervals, and audit record atomically\
And members without administrator or explicitly granted Featured authority are
denied without changing the roster or schedule.

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
- Application services: candidate eligibility, Driver assignment and safe portrait resolution, Ethiopia-day activation, deterministic 08:30–12:00 schedule, sponsor interlude assignment, and public safe projection
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


### September 24: automatic operation and launch readiness

Given staff open Featured in automatic mode
When they inspect the overview
Then it shows upcoming saved days, drafts protected from automation, missing days,
current eligible/remaining pair counts, and the latest recorded automatic run
And a stale, failed, paused or never-recorded run is distinguished from healthy operation
And the no-repeat policy explains theme exhaustion without silently repeating pairs
And manual day editing stays available through one clear disclosure.

Given a worker prepares Featured
When generation completes, fails, is paused or another run holds the lock
Then a private bounded status record captures actual completion/counters or safe failure
And failures do not publish a partial roster or expose database error details
And existing random-round, concurrency and retry invariants remain unchanged
And public reads do not generate days or expose worker status.

Given an admin edits an automatic day
When they save or publish it
Then it becomes a protected manual day and the overview makes that clear
And the staff guide explains how automatic selection, airtime and optional video differ.

Changes remain local until owner visual review and normal migration/release gates.

### September 24 owner addition: separate Featured responsibility

Given an active team member has only the Featured permission
When they sign in and manage the programme
Then Featured is their available workspace, with overview, automatic preparation,
selection settings, manual draft/publish and sponsor controls
And they cannot access account administration, billing/access mode, Support or Brokerage
And separately granted Support, Brokerage, Billing or account responsibilities
remain available to the same member; revoking Featured does not revoke them
And only an administrator can grant/revoke this default-off permission
And current database authority is checked and locked before every Featured mutation
And revocation or suspension denies subsequent requests, even with an existing session.

Migration 106 adds the narrow capability without backfilling existing staff access.
Identity and team projections expose it, with permission-change audit evidence.
No public/browser SQL grants are broadened. App rollback retains the default-off
column and guarded commands; never promote staff to ADMIN as a workaround.

### Historical morning broadcast hours — superseded October26

The official programme is 08:30–12:00 Africa/Addis_Ababa (EAT). Use a maximum
of eight showcases by default, with four two-minute sponsor mentions. This is
schedule preparation only; staff conduct the actual TikTok broadcast.

Given automatic timing has eight selected truck/driver pairs
When the programme is built
Then four two-minute mentions are reserved, including the closing mention
And the remaining 202 minutes are divided fairly between the eight showcases
And entries are contiguous, ordered, and end at noon without exceeding the window
And smaller rosters use their actual size, with at most one mention per showcase
And no phantom truck or early repeat is added to fill a sparse day.

Given an authorized member edits a day
When they use Automatic timing or switch to Manual
Then the preview shows the exact truck and sponsor intervals in Ethiopia time
And manual mode starts from the current automatic timetable, allows reordered
showcases and explicit times, and rejects overlaps/out-of-window intervals
And opening, between-showcase and closing gaps count toward at most four mentions,
each no longer than two minutes; saved drafts stay private until publication.

Historical saved programmes retain their recorded hours and timing. Future saved
AUTO-selected/AUTO-timed days are retimed without changing pairs, selection history,
headlines, sponsors or publication status. Manually curated/timed days are preserved;
legacy hours require an explicit timing reset/review before saving under the new rule.
No migration truncates an existing roster. An oversized future automatic day stops
migration for review rather than silently dropping pairs. Migrations and UI stay
local until visual approval and the normal reviewed release workflow.

Given a manual day has been saved or published
When staff reopen it
Then native database JSON arrays populate every saved start/end input
And moving a truck changes order while preserving chronological slot times
And saving again retains those times and the closing mention.

## Historical courier retirement: mixed Sunday preview — superseded October18

Given the retired Courier car catalogue option
When a Sunday roster is prepared
Then its theme is Mixed trucks and accepts the supported freight configurations
And Monday through Saturday retain their existing themes
And known past selections remain preserved, distinct-driver limits and the eight-showcase ceiling still apply; the current primary truck-type rounds are defined in the October 13 acceptance above.

The bounded local demo conversion relabels upcoming automatic courier days as mixed
without replacing their exact vehicle/driver pairs. Past and manual days remain historical.
A hosted rollout must separately review any existing upcoming courier roster and actual
vehicle records; this migration does not reclassify real vehicles or rewrite saved days.

### Featured map handoff regression
Given a featured truck has a public available signal\
When a visitor chooses Find this truck\
Then the map searches its transporter handle and selects the matching capacity ID, without searching a truck number through profile-only text search.

Given the phone programme includes its schedule and a sponsor\
When the board renders\
Then compact heading spacing keeps the first truck row within the existing 281px board-offset budget, retaining readable text and 44px controls.

The public Featured projection exposes a bounded relative map link only for an
Open Empty/Partial signal. It strips the internal capacity field with the other
internal identifiers; private/unavailable signals never produce a map link.

### Release regression fixture — October 7

The changed-truck-type SQL regression must choose a replacement configuration
that is outside the saved day's actual theme. Sunday intentionally mixes weekday
configurations; moving to the next weekday's first type does not necessarily
invalidate Sunday. Preserve the invalid-roster assertion and staff permission
checks; no production schedule or vehicle change is part of this test correction.
Evidence: tests/sql/featured-team-permission.sql and the isolated production-backup
restore/rehearsal.

October13 regression lesson: NR-34 in `docs/SECURITY_REGRESSION_REGISTER.md`; local evidence and hosted/visual gates are tracked separately in `docs/PROGRESS.md`.

October21 operational evidence: the owner-approved44-pair synthetic demo scope
correction is committed and independently verified on the live181 database.
All seven saved days retain eight eligible same-category vehicles; pair/order,
rotation history,28 public/16 private capacity signals and97 document records
remain unchanged. No reviewed ownership or new document approval was invented.
Protected applied/readback receipts and fresh restore/rollback evidence live in
`.local/featured44-renewal1/`; current browser and delivery status is in
`docs/PROGRESS.md`. This is a fixture correction, not an eligibility relaxation.

### Scenario: distinguish an actual TikTok Live broadcast from the featured timetable

Given Featured displays a card time, programme range, scheduled TikTok start or
read-only administrator schedule\
When the saved East Africa Time values are presented\
Then each displayed time identifies AM or PM and places EAT beside the time or
range, for example “10:30PM–11:59PM EAT”\
And canonical ISO values, 24-hour editing/storage, sorting, dates and programme
phase calculations remain unchanged\
And midnight, noon and range endpoints are unambiguous without duplicate EAT
suffixes, including when the device is in another timezone\
And public web and Android omit the How Featured works control and its
explanatory paragraph; the lineup and its short factual labels carry the view.

Given a published Featured day has a validated TikTok link and scheduled start
time in East Africa Time\
When an authorized manager has scheduled it but has not confirmed it Live\
Then the public header explicitly says “TikTok LIVE broadcast planned” and shows
its start time\

Given a published Featured day has no TikTok link or its broadcast is not scheduled or has ended\
When a visitor opens Featured\
Then the daily Featured lineup remains visible without a negative or empty TikTok status strip\
And a featured vehicle slot being in progress never implies a TikTok broadcast.

Given an authorized Featured manager opens a published day with a TikTok link\
When they mark the broadcast Live or Ended\
Then only the bounded public status and safe schedule time are exposed\
And the status action is denied to members without the Featured permission,
unauthenticated visitors, unpublished days, or days without a TikTok link\
And marking Live records the server time; marking Ended stops the Live label.

Given a day has a validated TikTok link and an explicitly Live or scheduled broadcast\
When a visitor opens Featured in web or mobile\
Then both clients explicitly identify the broadcast as TikTok LIVE and keep it
separate from the vehicle timetable\
And only the confirmed Live state says the TikTok LIVE broadcast is on now and
offers the “Watch live on TikTok” action\
And the full broadcast message stays visible without horizontal overflow on a
narrow phone, alongside reachable weekly and schedule controls.

Given an administrator inspects an unscheduled or ended broadcast\
When the manager opens that day's controls\
Then the actual short administrative state remains visible\
And NOT_SCHEDULED with a saved link is never mislabeled Ended\
And a timed account spotlight is called Featured now rather than an unqualified Live stream.
