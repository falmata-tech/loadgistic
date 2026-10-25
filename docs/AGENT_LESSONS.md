# Working lessons

This is the short entry point to the project's confirmed mistakes and their
prevention. The [regression register](SECURITY_REGRESSION_REGISTER.md) retains
the detailed records, tests and open risks. A risk entry is not evidence that
an incident occurred. New product decisions can supersede old rules; always
read the current accepted spec before applying a lesson.

## Mistakes to check before repeating work

| What went wrong | Required prevention | Detailed record |
| --- | --- | --- |
| The Featured-team permission SQL test selected a saved tractor and changed only its cargo configuration to the next weekday's courier type. The database correctly rejected that impossible tractor/trailer combination, stopping a documentation PR before browser CI. | For a test of Featured invalidation, choose a saved non-trailer vehicle, change its category and cargo configuration together to a valid type outside the saved day's theme, assert that such a fixture exists, and roll back both fields. Keep the vehicle constraint and the Featured invalidation assertion intact. | FEAT-FTR-001; `tests/sql/featured-team-permission.sql`; PR21 CI 40038949581 attempt 1. |
| Main CI on the same PR-green source intermittently failed the provider-onboarding cleanup and timed out a guest-history browser case. A local replay also hit a shared preview port before its process owner was checked; the port belonged to another project. | Verify a test port's process owner and backend target before browser use. Run one failed-job-only CI retry, retain the original failure, and classify slow navigation separately from product behavior. Before the next product release, make cleanup preserve the first test error and give these long synthetic workflows useful stage diagnostics; do not silently raise timeouts or remove privacy assertions. | PR16 main CI 40032518930 attempts 1–2; FEAT-FLT-001 and FEAT-GST-001; current progress. |
| A handover SQL test borrowed today's rotating Featured slot for its future-day denial. On a day with another vehicle category, neither handover vehicle had a slot and the test failed before exercising the intended guard. | Create the exact Featured conflict inside the test's rollback transaction; prove the test also passes after removing all pre-existing slots for its vehicles. Do not make a durable safety test depend on today's demo roster. | FEAT-SIM-001; `tests/sql/demo-world-atomic-handover.sql`; PR16 CI 40025173293. |
| A new GPS browser spec added intentional demo-only skips without updating the reviewed skip inventory, so two otherwise passing CI shards failed. A vehicle-card test also required no scrolling for a changing demo record even though long cards are designed to scroll inside the dialog. | Keep the skip inventory matched to every `test.skip` declaration with the fast local gate; review new browser specs before a full CI run. Test that a long card stays within the viewport and its last action remains reachable, while still rejecting horizontal overflow. | CI 39971409111; `tests/ci-browser-gate.test.mjs`; `tests/e2e/truck-profile-layout.spec.ts`. |
| A local shared-capacity verifier granted temporary access to a public demo vehicle, changing its audience to Both. Its cleanup removed the grant but left the audience changed. A long-lived clone had public-only state and hid this fresh-CI mismatch. | Snapshot the exact fixture policy before the verifier, run both scenarios inside one `try/finally`, restore changed policy through the normal owner command, and compare downstream state. Reserve the handover pair from imported private sharing, but never weaken the handover audience guard. | FEAT-SIM-001; `scripts/verify-supabase-shared-capacity.mjs`; `tests/sql/demo-world-atomic-handover.sql`; CI 39931165048. |
| The Expo Tracking browser harness waited for Refresh while shipment progress was collapsed; its response waiter timed out and made a hidden control look like a slow API. Repeated synthetic sign-ins then met the normal OTP rate limit. | Follow the visible user path: open shipment progress, wait for Refresh to become visible, then pair the click with its response waiter. Stop after a bounded failed attempt and classify navigation, API, and test-data limits separately. | FEAT-TRK-001; protected `.local/demo-tracking-lifecycle-191/auto-refresh-expo-local.mjs`. |
| Mobile sign-in showed the code-entry screen even when Supabase rejected the email request; a browser test then waited for a code that was never sent. | Check the returned provider result as well as thrown errors before reporting success. Test acceptance, returned denial, rate limiting and thrown failure; verify an actual inbox code separately from a UI handoff. | NR-72; FEAT-IAM-001; `tests/mobile-otp-delivery.test.mjs`. |
| A search of a protected local runtime file printed its demo signing secret into a private tool trace. | Never search or print protected environment values to learn their names. Read only an explicit allowlist of key names, and rotate a local secret promptly if its value reaches tool output. Keep the replacement out of commands and logs. | NR-71; FEAT-SIM-001. |
| A shared filter refactor changed document groups from a keyed object to an array, but one web state initializer still derived keys with `Object.keys`. The typecheck passed; the first browser flow crashed the Capacity page. The next browser retry also exposed a stale test selector that waited for an obsolete button label. | When changing a shared value's shape, search every consumer and state initializer; add a real-rendered web and Expo workflow assertion for all groups before a wider gate. Update affected E2E selectors in the same change and use role-specific locators when an action and its field share an accessible label. | NR-70; FEAT-CAP-001; `.local/product-audit-20261021/filter-parity-review/`. |
| A responsive map test checked only vertical clearance at 390px; its later 320px capture showed the action rail overlapping the location dock. | At every supported width, test actual two-dimensional overlap after each viewport resize. Keep touch targets intact and reflow controls when the smaller viewport cannot fit them. | FEAT-CAP-001; `.local/dashboard-task-fleet-20261021/manager-capacity/`. |
| A no-build deployment omitted adapter-generated image routes; healthy APIs and valid source images hid broken optimized images. | Inspect the installed CLI's resolved configuration, preserve the exact build's required adapter routes, and test real optimized images at two widths plus private-file proxy denial after publication. Keep preview environment limits explicit. | NR-69. |
| New instructions were sent to a completed agent with a message that did not start its next turn. | Start idle-agent work with `followup_task`; use messages for active work. Confirm the task is running before waiting for its result. | NR-68. |
| Old fixtures, button labels and palette assertions survived changed workflows; CI exposed them one at a time. A sandboxed browser launch failure initially obscured the real test results. | Before the long browser run, search affected E2E files for retired labels, layout bounds and colors; compare each assertion with the actual reviewed screen. Launch one bounded Chrome test first and classify a launch failure as infrastructure, then run the complete focused set. Fix all known stale assertions together without weakening behavior, privacy or save checks. | NR-21; current focused audit in [PROGRESS](PROGRESS.md). |
| The account-network candidate reached full CI with stale browser routes, post-verification signup choices and a reused inactive demo alias; all eight shards failed. Local repair then found selected Expo controls missing web ARIA state, a saved signup leaving recovery after a transient refresh, and a native component test harness that lacked newly used React hooks. | Before the first full CI push after navigation or onboarding work, inventory affected E2E files and fixture identities, run changed tasks locally on desktop web, phone web and Expo, and require native lint/typecheck/tests/export separately. Update component harnesses when hooks change and assert the resulting behavior. Use canonical destinations, actual accessible state and scoped synthetic actors; navigate to a workspace only after the refreshed session is `ACTIVE`. Preserve the first failed CI run and rerun the complete gate only after focused failures are resolved. | PR22 CI 40173149817; FEAT-IAM-001, FEAT-CAP-001; focused evidence in [PROGRESS](PROGRESS.md). |
| One accessibility test audited fourteen signed-in pages in a single two-minute case. It timed out before naming the slow page, while a light success button hid white-on-light text. | Keep contrast checks on real pages and make each audited role/route independently selectable. On a timeout, isolate a page and verify the product issue instead of repeatedly raising the entire test's limit. | October 22 Chrome Home, Verification and phone Home checks in [PROGRESS](PROGRESS.md). |
| Root quality passed while the separate Expo job still had a React render violation and stale native test harnesses. A local `.env` supplied private-demo recipients that fresh CI did not; its old GPS assignment, positions and private grants hid Tracking/Admin setup gaps. Today's Featured slot reached the handover guard first, and the schedule could feature a driver on another vehicle. | Before pushing a web/mobile candidate, run the mobile CI command (`typecheck`, `lint`, tests), strict translation audit and Android export locally. Make disposable CI fixture inputs explicit. GPS/privacy tests must create their own assignment, fix and viewer grant within rollback transactions. Rehearse handover tests with today's Featured slot and a driver-only slot; preserve the actual guard order and test each denial separately. Never infer fresh CI state from a long-lived local clone. | CI 39893225119, 39918207704, 39919541489, 39921189444, 39922838582 and 39924302264; focused repair and 328/328 native tests in [PROGRESS](PROGRESS.md). |
| A permission-limited `kill(pid, 0)` probe returned `EPERM`, and the local demo runner incorrectly reported its live process as stopped. | Distinguish `EPERM` (process exists but cannot be signaled) from `ESRCH` (process is absent); test both outcomes and invalid PIDs, and verify local runner state before attempting a restart. | FEAT-SIM-001; `tests/demo-motion.test.mjs`; current evidence in [PROGRESS](PROGRESS.md). |
| A read-only simulator audit joined each target to its full Capacity history and overstated the number of motion targets. | Count exact primary target IDs before one-to-many joins, or reduce child history to the current row before counting; verify the final installed binding instead of inferring scope from a join result. | FEAT-SIM-001; local schema evidence in [PROGRESS](PROGRESS.md). |
| Five-second GPS/phone demo writes caused the local web and status checks to time out during an active run. | Model a realistic 30-second reporting cadence, probe the app while movement is active, and verify both leases are off after the bounded run. Do not test only the final database state. | FEAT-SIM-001; `tests/demo-motion.test.mjs`; local evidence in [PROGRESS](PROGRESS.md). |
| A restricted-shell check was mistaken for missing Node/Docker/local services, and a detached simulator's start acknowledgement was mistaken for a running process. Its status file was overwritten while an older backend lease remained active. | Use the installed NVM Node path explicitly and make one authorized read-only check of local Docker/loopback before declaring services unavailable. For detached motion, check backend leases as well as the PID before replacing state; record sanitized failures and verify saved ticks before claiming motion. | FEAT-SIM-001; October22 recovery and verification in [PROGRESS](PROGRESS.md). |
| A stronger missing-value check exposed a fixture selecting the wrong randomly ordered device. | Select the exact created record by identity; deliberately sort a competing record first and prove the original check fails. Source review and one random passing run do not establish determinism. | NR-64. |
| A browser test scrolled during screen loading and asserted a redirected page before its response completed. | Wait for the actual target, preserve normal scrolling and viewport bounds, and await exact navigation completion. Diagnose client log-output refusals instead of blindly retrying downloads. | NR-65. |
| Passing compilation, small fixtures or structural checks were treated as enough evidence of a working flow. | Exercise the actual actor, save, authoritative state, denial, recovery and realistic scale. Label static, browser, native and hosted evidence separately. | NR-08, NR-29, NR-33, NR-56. |
| UI performance work changed the experience; internal notes and generic cards reached customer presentation. | Preserve the agreed task and visual hierarchy. Review actual desktop/phone states; keep implementation notes out of product copy and promotion. | NR-13, NR-28, NR-38. |
| Existing Featured demo fleets became ineligible under new fleet-publication rules, while isolated rotation fixtures still passed. | Rehearse the update against existing saved rosters and account states. Before publication, compare stored slots with the actual public projection and diagnose an unexpectedly empty scheduled day. Do not invent verification or weaken eligibility to fill it. | NR-67; FEAT-FTR-001. |
| Featured rotation was not checked across later dates and repeated rounds. | Advance the clock, exhaust a round, start another, and preserve manual days/history. Test isolated persistent writes. | NR-21, NR-34; FEAT-FTR-001. |
| Map geometry, overlapping controls and refresh behavior were checked on only one surface. | Verify public/private and selected states at phone/desktop sizes, real geographic bounds, reachable close/retry controls and preserved camera/selection. | NR-30, NR-35, NR-36. |
| Native refresh and area changes lost the current workspace or authenticated state. | Exercise transient failure, recovery, sign-out and Marketplace/workspace switching without silently resetting the user. | NR-31, NR-32, NR-42, NR-52, NR-55. |
| Public identity, private files, reviewed authority or erasure were inferred from incomplete projections. | Keep private/public fields distinct; verify exact subject, file authorization, expiry/revocation, and all retained/new stores. | NR-10, NR-12, NR-23–27, NR-40, NR-48–49, NR-54, NR-58–60. |
| Ownership, assignments, permissions and old paid access were conflated. | Test current owner/employee boundaries and every relevant state transition, including suspension/restoration and no-plan access. Preserve historical records. | NR-09, NR-17–20, NR-39, NR-41, NR-46–47, NR-57. |
| Database containment or a successful migration was mistaken for full security. | Keep RLS, ACL, request guard, private-file, extension and advisor checks independent. Never bypass ownership or restore broad settings after ambiguity. | NR-01–07, NR-43–45. |
| A function-security warning appeared only after hosted migration. | Mirror first-party search-path checks in the local catalog gate. Preserve function authority and test search/map performance before applying SET; private visibility does not waive hardening. | NR-66. |
| Release work renewed backups too early or restarted packaging for unchanged artifacts. | Finish stable gates first; preserve immutable packages and prove executable equality. Refresh short-lived prerequisites only when ready to use them. | NR-08, NR-61. |
| A source-code suspicion was briefly treated as a confirmed privacy/control failure. | Compare the literal product promise, accepted contract and actual code path; distinguish source inference from observed traffic before blocking release or changing declarations. | NR-27, NR-62. |
| Browser controls attached to another Chrome instance, causing repeated requests to the owner. | Verify the controlled process and exact app/tab before inferring missing login or state. Respect unavailable controls without reading profiles or secrets. | NR-63. |

## Routine while working

1. Read the short current checklist and relevant contract; record the change's
   test impact. The product brief, PROGRESS and traceability index have distinct
   purposes; their linked histories are evidence on demand, not routine context.
2. During investigation, collect useful bounded timings and failure categories.
   Stop blind retries after one controlled attempt.
3. Consolidate findings, then run one focused verification set. A green result
   does not prove an assertion is testing the intended behavior.
4. Before the long gate, check that no known stale fixture or unresolved finding
   remains. Run one complete gate on the exact reviewed source.
5. Reuse evidence that is still valid. Refresh expired prerequisites without
   changing their original timestamps, approval history or artifact provenance.
6. Before finishing a substantial task, record any new recurring waste and its
   verified improvement. Do this proactively; the owner should not have to
   discover the same inefficiency or ask for the lesson to be written down.

These are agent instructions and review obligations. Existing CI tests enforce
their specific technical contracts; this document does not itself enforce
semantic review, provider permissions or an independent approval boundary.

## Practical delivery loop for this project

The working setup is VS Code, Node22/Next15, separate Expo/RN mobile tooling,
GitHub Actions, local Supabase/Docker and immutable web/Android artifacts. Keep
using those tools; optimize the slow step before introducing another service.

| Area | Working rule | Verification and cost |
| --- | --- | --- |
| Product and code | Identify the changed observable contract, then update its fixtures and tests with the implementation. Check adjacent surfaces using the same component or API. | Focused tests and real saved outcomes; no whole-repository audit for every small change. |
| Agent work | Keep the active task and decisions in existing documents; give agents disjoint files and one owner for shared helpers. Resume from completed receipts. | Compare source hashes and actual results; do not restart completed work after compaction or agent failure. |
| VS Code/browser | Debug one named test with Playwright's inspector or existing Chrome harness. Prefer role/label locators and waiting assertions over DOM-shape assumptions or sleeps. | Preserve actual desktop/phone tasks, persistence and denial checks. Browser traces may contain secrets: local protected capture only, no automatic public upload. |
| Scripts and CI | `npm run tools:workflow:setup` explicitly installs checksum-pinned actionlint in ignored `.local/tools`; `npm run check:workflow` parses operational JS and checks workflow syntax/expressions without executing scripts. | Runs in local quality and early CI validation. Behavioral runner tests still prove retry, skip, failure and diagnostic contracts; static checks cannot establish those. |
| Local resources | Run browser and root unit gates sequentially; keep the two-worker unit cap. Keep separate app ports, databases and process ownership. | Existing full quality passed in46.27s at the earlier checkpoint; compare future measured runs rather than promising an unmeasured speedup. |
| Database rehearsal | For DDL against an existing preview or hosted schema, preserve object owners and grants in the disposable restore and execute the rehearsal as the intended migration role. A `--no-owner` restore proves behavior but cannot prove that role may alter the original objects. Stop on an ownership denial; do not switch to a stronger role without the exact reviewed scope. | The October22 profile-copy rehearsal with `--no-owner` passed, but preview migration197 failed on `supabase_admin`-owned objects. An ownership-faithful clone then reproduced the intended role and passed while preview controls stayed off. |
| Shipping | Keep existing same-branch CI cancellation and npm caches. Reuse immutable packages only after source/byte equivalence and current required checks. Refresh short-lived backups last. | Do not add duplicate jobs, hide failures, change freshness windows, re-sign changed files under old approval or rebuild solely because a test/document changed. |
| Cost | Keep PostgreSQL/local Supabase tests and the authorized local Android build fallback. Use real-phone testing for native capabilities when available. | No new managed service. Expo web preview does not prove native permission, location, notifications or installed-app behavior. |

Workflow quality includes time, repeated attempts and useful failure evidence,
alongside correctness, security and maintainability. When a step wastes time,
record its observed cause and the smallest verified improvement in the existing
register/checklist. Do not create a daily transcript, a new framework, redundant
rules or blanket approval gates. A recurring script should have explicit inputs,
target checks, bounded failure and meaningful negative tests; a disposable
one-time operation does not automatically need a permanent utility.

The first measured static run parsed104 scripts and linted the workflows in
7.917s. A second run with project-local ShellCheck0.11.0 passed shell analysis
and the same104 script checks in7.317s. All40 focused tooling/runner checks pass,
including malformed workflow/script rejection and parse-without-execution.
These are local results. The complete source audit and1028-test local quality
gate now pass; exact-source CI and release remain unfinished.

## Overall setup assessment

This is ongoing engineering housekeeping, not only a response to the October20
incident. Review the relevant area when work exposes friction; do not rerun a
whole-platform audit for each small change. The assessment below concerns the
actual checked-in setup, not a certification of every feature or hosted setting.

| Area | Existing setup / verified improvement | Next useful work, when relevant |
| --- | --- | --- |
| Architecture and product | Existing domain/application/adapters, specs and traceability own observable behavior. | Strengthen a changed boundary rather than rewriting modules wholesale. Retire obsolete positive examples explicitly while preserving history and denial checks. |
| Code quality | Root and mobile TypeScript use strict mode; mobile also has lint. Root allows JavaScript with checkJs disabled. | Gradually type changed JavaScript ports; assess lint against concrete defects before adding a new blanket gate or mass-formatting. Strict TS alone does not type-check all existing JS. |
| Developer setup | Separate root/mobile locks and runtime versions, dedicated local ports, Supabase configuration and documented build profiles exist. | Keep onboarding commands reproducible; validate actual process/schema after interruption. Never assume another project's emulator, server or credentials belong here. |
| Tests | Unit, SQL, permissions, scale, browser and native boundaries exist. The current complete source audit is recorded separately from test execution. | Update test impact with each behavior change, use disposable fixtures, and separate deterministic units from external/device acceptance. |
| Scripts/DevOps | The new workflow static check runs before expensive CI setup; existing runner negative tests remain required. | Add behavior/failure coverage when an operational command changes. Parse success is not execution success. |
| Dependencies | The existing weekly Dependabot configuration covered root npm and Actions. Mobile npm was missing and is now included, with bounded PR volume. | It takes effect from the repository's default branch, subject to GitHub enablement. Review Expo/RN compatibility before accepting updates; no automatic major upgrade or merge. CI already audits root dependencies and reviews mobile runtime findings. |
| Agent context | Repo-scoped skills under `.agents/skills` are selected by task and do not alter other apps or global agent configuration. The Loadgistic UI/localization skill was added October21. | Use the UI skill only for visible experience work, keep bodies short and references conditional, and confirm the active client discovers the new skill before claiming its automatic selection. No token-cost reduction is measured. |
| Shipping | Required same-source release jobs, immutable packages, Android profiles and approval records exist. | Prove reuse rather than rebuilding unchanged payloads; refresh short-lived prerequisites last. Current release remains unpromoted. |
| Security/recovery | Local database/ACL/RLS, target checks, protected backups and rehearsal procedures exist. | Verify actual production controls and recovery evidence for the selected operation; a document or local check does not install provider enforcement. |
| Operations | Health checks and launch/operations documentation exist. | Confirm alert ownership, escalation and hosted monitoring evidence separately; this housekeeping did not install or certify monitoring. Prefer existing provider/free capabilities before another paid service. |

## Skills and activation

Agent skills are reusable task instructions with optional resources. Their small
name/description is available for selection; the body is read when relevant,
and references only when needed. This is distinct from always-loaded AGENTS
rules and from tools that grant an integration capability.
[Official skill documentation](https://learn.chatgpt.com/docs/build-skills)
describes this staged loading and repository discovery.

Loadgistic has instruction-only skills under `.agents/skills`:

- `$loadgistic-engineering`: everyday web/mobile/API/database changes and general
  setup or tooling improvement.
- `$loadgistic-ui-ux`: task-centered experience, role workflows, screen and
  navigation design, empty states and English/Amharic/Afaan Oromo fit.
- `$loadgistic-test-repair`: failed CI, stale expectations and explicit fixture
  audits; it is not required for every ordinary code change.
- `$loadgistic-github`: branch/PR selection, review preparation and authorized
  merges, following [GitHub workflow](operations/GITHUB_WORKFLOW.md).
- `$loadgistic-release`: prepare/resume an authorized web or Android release;
  it does not grant permission to publish or use credentials.

All permit implicit invocation and can also be named explicitly. Local Codex's
`skills/list` reports all three as enabled with repo scope; the protected receipt
is `.local/test-audit-20261020/skill-discovery.json`. No model task, global skill
installation, other app edit or credential operation was needed for that check.
The current client can still select a skill incorrectly: discovery and format
validation do not prove every future automatic choice. No token-cost reduction
has been measured yet.

Discovery is tied to the project directory. Start Codex/VS Code work in the
Loadgistic folder for its skill catalog; another app's folder should not acquire
these procedures globally. AGENTS links the same skills for an agent already
working on Loadgistic from a multi-root IDE. If a client does not refresh the
catalog, restart that client rather than installing duplicates globally.

Reviewed guidance, October20:

- [OpenAI's workflow iteration guidance](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) supports durable repository context and evidence-backed improvements. Here, existing AGENTS, PROGRESS and regression records own that work; additional planning files are unnecessary.
- [Playwright best practices](https://playwright.dev/docs/best-practices) support isolated fixtures, user-facing locators, waiting assertions and focused VS Code debugging. Separate intentional external-integration acceptance from deterministic tests of our own logic; mocked success never proves delivery.
- [GitHub workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) supports cancelling superseded runs. This repository already does so; no new concurrency framework is needed.
- [actionlint usage](https://github.com/rhysd/actionlint/blob/main/docs/usage.md) supplies workflow static checking. Version1.7.12 and platform archive digests are pinned; ordinary checks never download software.
- [Supabase testing guidance](https://supabase.com/docs/guides/local-development/testing/overview) supports database/RLS tests. Retain our transaction-based SQL and isolated local targets rather than adding a second persistence engine or rewriting working tests just to use another harness.
- [Expo local builds](https://docs.expo.dev/build-reference/local-builds/) support a local alternative to hosted builds. Preserve our approved signing and exact-artifact checks; local build capability is not permission to export a key or claim a device test passed.
