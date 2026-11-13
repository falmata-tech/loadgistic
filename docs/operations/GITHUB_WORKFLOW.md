# GitHub, agents and delivery

This is Loadgistic's working convention. AGENTS and production authority control
permissions; these instructions do not install GitHub protections or authorize
a merge. Start with current [PROGRESS](../PROGRESS.md), not historical PR results.

## Current delivery checkpoint, November 13 UTC

PR33 installed the versioned scan-exception guard and a separate workflow that
advances production only after all16 jobs on successful current main. PR35
merged as63cbb868 after all16 exact-head jobs passed. Its Netlify preview verified
all8 final function ZIPs. Separate main CI43344733398 failed Featured team setup
before migrations with a retained port-binding conflict; the exact port/owner
remain unknown. The production source remains withheld; no blind retry is claimed.
Netlify's production branch is now production, saved and independently read back,
with production-only branch builds, untrusted-preview approval and automatic
publishing ON retained. Arming before the first qualified ref creation lets that
push exercise the Git webhook without bypassing any source/CI check. Previous
manual6af4f16a16aab2cef815c573 remains live and rollback. Installed settings do not
prove a successful automatic deployment. See current PROGRESS/runbook.

NR-79 reserves55320–55329 from automatic allocation early on disposable hosted
Linux runners only, preserving existing reservations and verifying the exact
union. It does not kill listeners, change production or widen startup retries.
Focused run43346969178/4b17173f passed actual reservation/startup/security and three
desktop plus three phone tasks with zero skips/retries. Subsequent documentation
reconciliation leaves these executable inputs unchanged. The exact PR/main and
production publication remain independent prerequisites; final release receipts
are recorded in the PR after those actions, not inferred from this focused run.

For fixed admin-queue diagnosis before opening a PR, diagnose/admin-queues/**
pushes run only the existing isolated focused workflow. It uses read-only
contents permission, no hosted credentials, three independent desktop/phone
passes, zero skips/retries, and stops at first failure. PRs still run the full
required matrix; this lane cannot authorize a release or replace main CI.

The daily security-advisor workflow still lacks its scoped credential. Direct
project inspection finds zero ERROR/two WARN/one INFO; provisioning access does
not waive its strict WARN threshold. The independent public Data API guard
passed all three read-only probes in this session. No hosted SQL/Auth/key change.

## Historical verified pipeline, November 12

Main c926092 has a successful16-job [CI run43119585046](https://github.com/falmata-tech/loadgistic/actions/runs/43119585046).
The actual branch-rule browser readback requires a PR, strict/up-to-date
`release-ready`, conversation resolution and administrator coverage. Force push
and deletion are disabled. Required approving reviews remain off; no independent
second-human approval is claimed. No rule was changed by housekeeping.

Netlify's linked repository and Active build settings coexist with **automatic
publishing ON** for main. Recent production and PR-preview Git builds fail secret
scanning; the manual scheduler deploy remains published. Initialization resolves
the pinned Node 22.16.0 despite a Node 24 dashboard selection. The older provider
label `manual` is insufficient to infer that a merge cannot publish.

GitHub source CI contains no Netlify promotion job. No Netlify wait for the
same-main-commit release-ready result was observed. PR protection, main CI and
production promotion are separate boundaries. Reconcile the automatic path with
the owner's exact-source release authority before repairing its scan blocker;
do not disable scanning or alter publishing settings as routine branch cleanup.
See [NR-75](../SECURITY_REGRESSION_REGISTER.md#nr-75--green-github-checks-conceal-a-blocked-automatic-publication-path)
and [the release runbook](NETLIFY_RELEASE_VERIFICATION.md).

The daily advisor monitor independently fails before obtaining findings because
its approved scoped credential is absent; the Data API guard passes. An attached
ChatGPT Supabase account does not supply GitHub Actions secrets. These provider
readbacks and local tool/bootstrap limitations are in [PROGRESS](../PROGRESS.md).

## Historical setup, October 23

The public repository is `falmata-tech/loadgistic`; its default branch is `main`,
not `master`. The long `feat/mobile-app` branch was integrated through PR16 with
a merge commit, `6b74ec8f63d4436e70a75954006e983ac6dddd59`, preserving its 126
existing commits. The exact-head PR run `40028282878` passed all 16 jobs. The
separate main-push run `40032518930` passed all 16 jobs on attempt 2, including
`release-ready`. Attempt 1 failed two browser cases; only failed jobs were
rerun, and the intermittent timing issue remains recorded in current progress.
PR15 is older, unrelated work and its checks certify neither
PR16 nor main. The original October 20 inventory is retained at
`.local/test-audit-20261020/github-workflow-inventory.json`.

The October 20 CI ran on all PRs and pushes to main, the temporary mobile branch
and release branches, with per-ref cancellation. That temporary branch trigger
could run the same full matrix twice after a PR was opened. Current CI runs on
all PRs and pushes to main and release branches; the feature branch uses its PR
run. `release-ready` aggregates validation, browser/Featured, mobile and container
outcomes; it fails when a required dependency does not succeed. Keep those gates.

`netlify.toml` sets the build and Node version. A separate read-only Netlify site
check confirms production branch `main`, allowed branches `[main]`, build command
`npm run build` and provider reported as `manual`, with a GitHub repository path.
The current published deployment is ready on branch `main`. These fields do not
prove an active Git webhook, automatic publication or preview credential scope;
those remain unverified. No configuration was changed. Protected receipt:
`.local/test-audit-20261020/netlify-branch-readonly.json`.
A local Git branch or successful PR does not identify the live Netlify artifact.

## Normal work from integrated main

Use a lightweight GitHub flow: one integrated `main`, short-lived branches and
one focused PR per coherent change. Do not introduce a permanent develop/staging
branch unless a concrete release need appears.

| Purpose | Branch example | Commit/PR title example |
| --- | --- | --- |
| Feature | `feat/provider-device-history` | `feat(fleet): show device history` |
| Defect | `fix/tracking-viewer-scope` | `fix(tracking): preserve viewer privacy` |
| Maintenance | `chore/workflow-lint` | `chore(ci): validate delivery scripts early` |
| Documentation | `docs/local-setup` | `docs: clarify local setup` |
| Refactor or tests | `refactor/capacity-projection`, `test/private-sharing` | `refactor(capacity): isolate projection` |

These names communicate intent; they are local conventions, not a new blocking
regex gate. Existing branches/commits are not renamed retroactively. Commit a
complete change with its tests and controlling spec IDs; do not separate a fix
from the test required to establish its behavior or squash unrelated work together.

Before starting, inspect status and compare current remote references. Start new
independent work from the current integrated baseline. Preserve the dirty checkout;
use a separate worktree for a genuinely separate concurrent task. Give each agent
explicit ownership. Separate worktrees do not isolate Docker databases, ports or
credentials: those still need the existing project/target checks. Avoid copying
private configuration or starting duplicate services merely to create a worktree.

Prepare the PR against the actual default branch. Use the repository template,
explain the full resulting behavior and include meaningful verification and
limits. Stage explicit owned paths only. Push/open a PR within the authorized task;
reviews or a generic “continue” do not grant unrelated merge/production powers.
Address review findings in new commits rather than rewriting published history.

For a small future PR representing one logical change, prefer squash merging,
then start the next task from updated main. For an already-reviewed integration
with meaningful release commits, prefer a merge commit preserving provenance.
Never use administrator bypass, `--admin`, force push or a stale green SHA to merge.
Verify current head, base, reviews and every required check immediately before an
authorized merge; read back the merged commit and remote branch afterward. Keep
an unchanged short-lived branch only until its merge/result has been verified.

## Historical long-branch integration result

PR16 integrated the long branch on October 23 after exact-head CI passed. The
merge commit and remote main were read back independently. Netlify reported
`manual` publishing, production branch `main`, allowed branches `[main]`, and
the same published deploy ID before and after the merge. Thus the source merge
did not itself publish a different live web artifact. Main-push CI and main
protection have their own readbacks in [current progress](../PROGRESS.md); do
not reuse PR CI as proof of either. The earlier database/signing approvals stay
bound to their exact files and conditions; Google Play is paused by the owner.

## Enforcement and CI cost

After PR16 merged, `main` protection was installed and independently read back:
pull requests are required, `release-ready` is a strict required check, blocking
review threads must be resolved, administrators are covered, and force push and
deletion are disabled. Required approving reviews are set to zero because the
solo owner cannot supply an independent second human review. Do not mistake an
agent's own review or this branch rule for independent approval. If a real
reviewer joins, update the count in a separate reviewed provider change.

After the catch-up PR is selected, use PR checks for short task branches and
main-push checks for the integrated result. A temporary release candidate without
a PR can use one explicitly selected release branch run/manual dispatch. The
temporary `feat/mobile-app` push trigger was removed after PR16 opened, so one
push produces one PR matrix; required jobs and thresholds are unchanged.

## Skills, VS Code and open-source adoption

`$loadgistic-github` handles branch/PR selection, review preparation, safe GitHub
inspection and an authorized merge. The existing test-repair skill handles failed
checks; the release skill handles approved Netlify/database/Android publication.
Use `gh` or the existing connector as appropriate; a skill supplies procedure, not
credentials. VS Code Source Control and GitHub PR tooling can operate the same Git
branches/PRs. Codex also supports GitHub review when connected/configured; use one
requested review where useful rather than automatically spending model budget on
every intermediate push. No Copilot subscription or additional paid agent is needed
for the local procedure written here.

A skill is normally a versioned folder containing SKILL.md, optionally scripts
and references. It is not an npm runtime dependency. Codex's skill installer can
fetch curated or repository skills; community `npx skills` is another installer,
not a requirement. Our repo-scoped `.agents/skills` is discoverable by Codex and
supported by VS Code's documented skill system; actual activation depends on the
running client and selected workspace. Plugins package skills/connectors for
reuse, while GitHub/Netlify permissions still govern what tools may do.

The public curated catalog was checked. `gh-address-comments` and `gh-fix-ci`
are useful general references, but our existing procedures already handle bounded
review/CI evidence. The inspected generic CI skill reads whole logs, the generic
`yeet` workflow stages all files, and generic Netlify setup may create/link a new
site or run an unpinned install. Those defaults are a poor fit for this dirty
checkout and exact-artifact release. They were not installed or executed. Use the
small project-specific procedure instead of accumulating overlapping auto-triggers.

For any future external skill, inspect its exact source/ref, licence, SKILL.md,
scripts, downloads, hooks and requested access; pin/review the selected version,
keep it project-scoped, and test a representative safe task before trusting it.
Record provenance when adopting third-party files. Do not run a marketplace's
installer merely because its title sounds relevant or grant it broad service keys.

## Primary references

- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Merge strategies](https://docs.github.com/en/pull-requests/reference/pull-request-merges)
- [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [Codex GitHub review](https://learn.chatgpt.com/docs/third-party/github)
- [Codex skills and installation](https://learn.chatgpt.com/docs/build-skills)
- [VS Code skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)
- [Netlify branch/deploy contexts](https://docs.netlify.com/deploy/deploy-overview/)
- [Community skills installer](https://github.com/vercel-labs/skills)
