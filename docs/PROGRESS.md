# Current work and release status

Updated October20. Work only in Loadgistic, even when the IDE displays Suqpage.
Start here, then read the applicable spec via [traceability](../specs/TRACEABILITY.md).
The [product brief](PRODUCT_MASTER_PROMPT.md) explains current source behavior.
The [preserved history](PROGRESS_HISTORY_20261020.md) contains earlier checkpoints;
do not read it as current instructions or restart work from its old pending items.

## Objective and boundaries

Finish the owner-requested whole-test audit, then ship the approved web/database
release and Android Play test build. CI is paused until known findings are
resolved. Broader engineering housekeeping is ongoing: improve recurring cost
and friction across code, tests, scripts, tooling, agents and shipping, rather
than addressing today's incident alone.

- Last pushed source: `8df190de2ad83f5c473bf09b9b360410b3896ec2`,
  branch `feat/mobile-app`; CI39497266765 was cancelled for this audit.
- Local audit/tooling/docs changes are uncommitted. Preserve unrelated
  `next-env.d.ts` and `apps/mobile/.claude/` changes. Do not rewrite Git history.
- No hosted database writes, signing, web publication or Play upload occurred
  during this audit. The release is not yet complete.
- Web preview: http://127.0.0.1:3100; Expo8084 is off. Verify responding process
  and project before restarting either. Local Supabase is55321/55322.

## Ordered remaining work

- [x] Inventory and divide source review without overlapping ownership.
  Protected per-file receipts: `.local/test-audit-20261020/`.
- [x] Review114 E2E source files and93 mobile-group files; repair stale inputs,
  bounds, labels and fixture ownership without suppressing real checks.
- [x] Complete the remaining semantic source reviews:172 root-unit files and97
  SQL files now have per-file receipts, in addition to the E2E/mobile groups.
  This is source review, not a claim that every test has executed.
- [x] Finish consolidated focused repairs and seven local SQL checks, including
  30 older synthetic cleanup jobs; public/Auth row fingerprints are preserved.
- [x] Complete one full local quality gate:1028 tests pass, zero failure/skip;
  source/spec/workflow checks and typecheck pass.
- [ ] Current: review/commit the owned audit and housekeeping files for exact-source CI. Historical positive Brokerage SQL is archived unchanged;
  valid retirement/denial and retained-history tests remain executable.
- [x] Repair the actual Featured page-height bug without changing its contents.
  Both original desktop/phone captures pass; owner explicitly approved the fix.
- [x] Run affected focused tests, including actual desktop/phone Chrome return
  navigation:2/2 pass in35.6s. Keep security, denial, persistence and recovery.
- [x] Complete local quality; preserve the existing scale/CI gates as subsequent
  independent requirements.
- [ ] Review and commit only task files; push once and run one exact-source CI.
  No new CI while another known finding remains unresolved.
- [ ] Prepare one matching web package: the changed stylesheet invalidates the
  frozen web package's executable equality. Android runtime is unchanged by
  mobile test-only corrections, but reuse still needs exact equivalence evidence.
- [ ] Refresh short-lived backup/restore/security checks only after stable gates.
  Bind the approved SQL and signing artifacts to the current execution plan;
  apply the original target/digest/CI/approval rules without extending freshness.
- [ ] Complete the approved rollout, installed Android verification and Play
  testing submission; record actual hosted status and tester link. Request fresh
  phone Wi-Fi debugging only when device testing is ready.

Existing owner approvals cover the specified SQL138–175 plus176–180 and the exact
code9 signing files, conditional on their original prerequisites. See
[production authority](PRODUCTION_AUTHORITY.md) and the protected release reviews
under `.local/release-20261019/`, `.local/release-20261020/` and
`.local/release-20261020-android-code9-fresh-candidate/`. Approval is not a completed
operation. Expired backup/security receipts remain history and cannot be reused
as fresh evidence. Physical GPS capability and Google Play's tester enrollment/
14-day requirement are not established by a local browser preview.

## Verification already completed for this audit

| Scope | Result and limit |
| --- | --- |
| Tooling | 40 focused workflow/CI/startup/clone tests pass. Workflow lint with ShellCheck and104 script parses passes in7.317s. Static checks are not execution of delivery scripts. |
| Mobile test repairs | Four changed files pass21 focused cases; no mobile runtime change is inferred. |
| Exact proof cleanup | Five negative/positive unit cases pass; refuses wrong target/owner/path and shared references. |
| Public Chrome | Eight normal map/save/private-network workflows pass. Two original Featured captures then pass after the real sizing fix in21.623s. These are separate runs. |
| Tracking Chrome | Six desktop/phone progress, completion/review and proof-access cases pass with exact cleanup. |
| Workspace capture | Two desktop/phone cases pass in152.827s after exact lookup/navigation-completion waits;90-second case budget unchanged, zero skip/retry. Initial failures are retained separately. |
| Complete local quality |1028 tests pass in50.381s, zero failures/skips; current source/spec/workflow checks and typecheck pass. Remote CI remains pending. |

Protected reports are in `.local/test-audit-20261020/`; they contain the per-file
source hashes and bounded results. The Feature-height captures are under
`artifacts/public-app-shell-v3/`. Completed unchanged receipts survive agent
interruptions; never infer review or execution from a test list or AST inventory.

## Consolidated audit corrections

The focused repaired unit batch passes106 cases, zero failure/skip, in4.255s.
The upload adapter fixture now sends canonical VEHICLE/VEHICLE_OWNERSHIP UUID
fields and asserts the actual RPC body before mock acknowledgement. Historical
migration/commercial/demand/template tests explicitly label their compatibility
scope; their original denial/ACL/recovery assertions remain. Four obsolete
positive Brokerage SQL snapshots moved unchanged to the existing archive; CI
already excluded them. Native push tests now explicitly require an isolated idle
queue and advance only their own source, rather than assuming a global queue.

A real navigation omission also dropped locationSource-filtered return bookmarks.
The safe allowlist now retains that canonical presentation key. Its regression
fails before the fix and12 focused navigation cases pass after it, preserving
unknown-key, credential, external-path and oversized-input rejection. No new UI
or access permission was introduced. Seven local SQL checks pass, including missing-field assertions, native-push
and a30-older-job cleanup queue. Public/Auth row fingerprints match before/after
rollback; sequences were not fingerprinted. Existing managed-fixture preconditions
remain explicit. No production write occurs.

## GitHub and agent workflow follow-up

The owner additionally asked for overall branch/commit/PR/merge conventions,
current GitHub/default-branch drift, VS Code/Netlify integration and appropriate
open-source skill adoption. This authorizes local workflow preparation/research,
not a hosted protection/settings write or an unreviewed merge/deployment.

- [x] Inspect exact repository/default branch, existing PRs/checks and rulesets
  read-only; distinguish verified GitHub settings from unknown hosted Netlify config.
- [x] Define the lightweight branch/PR/merge convention and current101-commit
  catch-up plan in `docs/operations/GITHUB_WORKFLOW.md`; add the narrowly triggered
  GitHub skill with existing authority. No hosted protections or merges applied.
- [x] Validate all four skills and local Codex discovery: enabled repo scope,
  zero model turns/global configuration writes. Official GitHub, OpenAI, VS Code
  and Netlify sources are linked in the workflow; provider enforcement stays
  clearly separate from local instructions.
- [ ] Hosted follow-up: review exact protections and production/preview branch
  settings, then obtain required authority before applying or merging. This is
  separate from the already approved artifact/database release.

## Engineering housekeeping

- [x] Add checksum-pinned project-local actionlint and parse-only operational
  script checks, before Docker setup in CI; prove rejection and non-execution.
- [x] Include mobile npm in the existing bounded weekly Dependabot configuration.
  Hosted operation requires default-branch installation/GitHub enablement.
- [x] Add three concise repo skills: everyday engineering, test repair and release.
  All validate and are discovered enabled with repo scope by local Codex, using
  no model turn. Future automatic selection/token savings are not yet measured.
- [x] Record confirmed failures and a stack-specific improvement loop in
  [working lessons](AGENT_LESSONS.md), linked to the existing regression register.
- [x] Correct setup instructions and distinguish fresh setup from resuming local
  services. No dependency upgrade, fixture reset or other-app change was made.
- [x] Consolidate current brief/checklist/traceability with byte-preserved linked
  history. The three entry files shrink from about694 KB to about31 KB (96%).
  All37 feature contracts remain indexed; archive preservation and local link
  targets pass. No measured token savings or deployment claim follows.

Do not add paid infrastructure, broad rewrites or a new process framework merely
to finish housekeeping. Improve the observed bottleneck; record measured results
and remaining limitations in the applicable spec/checklist. Existing permissions,
visual approvals and release gates remain in force.
