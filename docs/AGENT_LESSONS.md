# Working lessons

This is the short entry point to the project's confirmed mistakes and their
prevention. The [regression register](SECURITY_REGRESSION_REGISTER.md) retains
the detailed records, tests and open risks. A risk entry is not evidence that
an incident occurred. New product decisions can supersede old rules; always
read the current accepted spec before applying a lesson.

## Mistakes to check before repeating work

| What went wrong | Required prevention | Detailed record |
| --- | --- | --- |
| Old fixtures and assertions survived changed workflows; CI exposed them one at a time. | Audit all affected test inputs, setup, selectors and expected outcomes before the full run. Include gated tests and adjacent shared-component workflows. Fix every known issue together. | NR-21; current complete test audit in [PROGRESS](PROGRESS.md). |
| A stronger missing-value check exposed a fixture selecting the wrong randomly ordered device. | Select the exact created record by identity; deliberately sort a competing record first and prove the original check fails. Source review and one random passing run do not establish determinism. | NR-64. |
| A browser test scrolled during screen loading and asserted a redirected page before its response completed. | Wait for the actual target, preserve normal scrolling and viewport bounds, and await exact navigation completion. Diagnose client log-output refusals instead of blindly retrying downloads. | NR-65. |
| Passing compilation, small fixtures or structural checks were treated as enough evidence of a working flow. | Exercise the actual actor, save, authoritative state, denial, recovery and realistic scale. Label static, browser, native and hosted evidence separately. | NR-08, NR-29, NR-33, NR-56. |
| UI performance work changed the experience; internal notes and generic cards reached customer presentation. | Preserve the agreed task and visual hierarchy. Review actual desktop/phone states; keep implementation notes out of product copy and promotion. | NR-13, NR-28, NR-38. |
| Featured rotation was not checked across later dates and repeated rounds. | Advance the clock, exhaust a round, start another, and preserve manual days/history. Test isolated persistent writes. | NR-21, NR-34; FEAT-FTR-001. |
| Map geometry, overlapping controls and refresh behavior were checked on only one surface. | Verify public/private and selected states at phone/desktop sizes, real geographic bounds, reachable close/retry controls and preserved camera/selection. | NR-30, NR-35, NR-36. |
| Native refresh and area changes lost the current workspace or authenticated state. | Exercise transient failure, recovery, sign-out and Marketplace/workspace switching without silently resetting the user. | NR-31, NR-32, NR-42, NR-52, NR-55. |
| Public identity, private files, reviewed authority or erasure were inferred from incomplete projections. | Keep private/public fields distinct; verify exact subject, file authorization, expiry/revocation, and all retained/new stores. | NR-10, NR-12, NR-23–27, NR-40, NR-48–49, NR-54, NR-58–60. |
| Ownership, assignments, permissions and old paid access were conflated. | Test current owner/employee boundaries and every relevant state transition, including suspension/restoration and no-plan access. Preserve historical records. | NR-09, NR-17–20, NR-39, NR-41, NR-46–47, NR-57. |
| Database containment or a successful migration was mistaken for full security. | Keep RLS, ACL, request guard, private-file, extension and advisor checks independent. Never bypass ownership or restore broad settings after ambiguity. | NR-01–07, NR-43–45. |
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
| Agent context | Four repo-scoped skills are valid and independently discovered as enabled by local Codex, using zero model turns for discovery. | Use the relevant skill, keep bodies short and references conditional, and measure actual savings on future work. Other apps/global agent configuration remain unchanged. |
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
