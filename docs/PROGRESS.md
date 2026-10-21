# Current work and release status

Updated October20. Work only in Loadgistic, even when the IDE displays Suqpage.
Start here, then read the applicable spec via [traceability](../specs/TRACEABILITY.md).
The [product brief](PRODUCT_MASTER_PROMPT.md) explains current source behavior.
The [preserved history](PROGRESS_HISTORY_20261020.md) contains earlier checkpoints;
do not read it as current instructions or restart work from its old pending items.

## Objective and boundaries

Current dependency: repair the newly observed mutable-search-path warning for
`current_provider_vehicle_authority()` before web publication (FEAT-SEC-001,
NR-66). CI39516069847 passed all16 required jobs on133bd08. The42 approved SQL
updates are applied through180; the exact signed1.1.1/code9 build is installed
on the approved phone. Web promotion, final native acceptance and Play upload
are not complete. The owner questioned accepting the warning; no exception was
approved. Production remains unchanged while the repair is prepared locally.

Ordered security-repair steps:

- [x] Verify the exact live warning and function authority read-only: SQL/STABLE,
  invoker, postgres owner, no public/anon/authenticated/service EXECUTE, unchanged
  body and no PUBLIC CREATE on its schema. Protected release receipts retain
  both the failed strict scan and completed42SQL operation.
- [x] Qualify the correctness and permissions of the search-path repair on the disposable
  V11 restore, preserving authority, private results and5000-vehicle/map/search
  gates. The first scale probe stopped for missing synthetic reviewed-owner
  prerequisites; it is not performance evidence. Add that rollback-only fixture.
  SET-only correctness checks pass, but its5000-vehicle profile search took
  12.265s against the unchanged5s limit. Do not deploy it. The revised private
  security-invoker view, three exact discovery substitutions and reused query
  caches pass nine focused SQL suites,14 negative security fixtures and their
  positive controls; all fixtures and schema changes roll back.
- [x] Add a pre-release local function-search-path check and negative fixtures.
- [ ] Current: complete final source/spec/quality checks and exact-source CI.
  The5000-vehicle run passes all results/counts/payload/cursor assertions, profile
  search4.707s and overview4.907s, but provider-map5.623s and route-map7.986s exceed
  the unchanged5s gate locally. This is not a passing scale qualification. CI's
  existing same-source timing gate remains required; no threshold is increased.
- [ ] Obtain owner review of the exact additional SQL, fresh recoverable backup,
  rehearsal and rollback before any hosted repair. Earlier SQL approval ends180.
- [ ] Independently verify the hosted repair removes this warning, then resume
  unchanged web-artifact publication, native acceptance and Play testing.

Finish the approved web/database release and Android Play test build after the
security repair. The whole-test audit and original133bd08 CI are complete; their
verified evidence is retained below. The subsequent six-line private-Capacity
test maintenance is committed as48464e1, with exact desktop/phone Chrome evidence
and unchanged privacy assertions. Broader engineering housekeeping must not
restart completed audits or hide the remaining delivery/security gates.

- Audit baseline: `8df190de2ad83f5c473bf09b9b360410b3896ec2`,
  branch `feat/mobile-app`; CI39497266765 was cancelled for this audit.
  Audit/housekeeping implementation is committed as `0479833`; use Git for the
  current head and protected receipts for subsequent exact-source CI status.
- Preserve unrelated
  `next-env.d.ts` and `apps/mobile/.claude/` changes. Do not rewrite Git history.
- Database updates through180 and signing/install are completed; web publication
  and Play upload remain incomplete. No181 hosted write has occurred.
- Loadgistic web3100 and Expo8084 previews were stopped under owner authority to
  free local test resources. Other-app processes are untouched. Verify project
  identity before restarting. Local Supabase remains55321/55322.

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
- [x] Review and commit only owned audit/housekeeping paths (`0479833`).
- [x] Push the reviewed task source (`2015d53`) and run CI39508786726 to terminal.
  Mobile boundaries passed; validation failed at `PRIVATE_ALARM_MISSING`.
  Browser jobs did not run. The strengthened assertion exposed a test selecting
  the first of two randomly ordered GPS devices, not a proven product failure.
  Historical positive Brokerage SQL is archived unchanged; valid retirement/
  denial and retained-history tests remain executable.
- [x] Repair the actual Featured page-height bug without changing its contents.
  Both original desktop/phone captures pass; owner explicitly approved the fix.
- [x] Run affected focused tests, including actual desktop/phone Chrome return
  navigation:2/2 pass in35.6s. Keep security, denial, persistence and recovery.
- [x] Complete local quality; preserve the existing scale/CI gates as subsequent
  independent requirements.
- [x] Finish the exact local CI SQL group after the deterministic
  exact-device repair. Original assertion fails in8.500s; corrected test passes
  in10.816s with the competing device deliberately first (NR-64). All 84 suites
  pass in354.323s; public/Auth row fingerprints match after rollback. Source
  hashes match. Sequences were not fingerprinted.
- [x] Commit the deterministic GPS repair as `f1f0a11`, push and run
  CI39511514293 to terminal:13 successes, one browser failure, two dependent
  summary failures. All other seven browser groups passed.
- [x] Diagnose the remaining Go-live test in actual Chrome. Ordinary publication
  works and saves LIVE; wait for the target before the original wheel scroll,
  retain the clearance assertion as a numeric gap, and await redirect completion.
  Full driver Expo/web/manual/phone/publication/public-map case passes in44.4s;
  no timeout increase or UI change. See NR-65.
- [x] Commit the Go-live repair as133bd08 and finish CI39516069847: all16 required
  jobs pass after one failed-jobs-only rerun. The observed hydration-before-logout
  test problem is separately repaired in48464e1; exact Chrome cases pass2/2.
- [x] Build and inspect the matching 2015 web package: 1989 source files and six
  function ZIPs verified; no hosted writes. A failed CI makes it unpromotable.
- [x] Run its actual compiled runtime against local schema180: health, public
  capacity, synthetic provider sign-in/workspace and private document access/
  anonymous denial all pass. This is local runtime evidence, not production
  readiness or hosted publication.
- [x] Prove packaged web/Android equality to tested133bd08; publish a verified
  Netlify draft without switching live, sign approved code9 once and install/
  byte-verify it. The final repair still needs current-source qualification.
- [x] Complete fresh V11 backup/restore,37+5 SQL rehearsals and approved42SQL
  execution through180. Preserve original receipts and their actual clocks.
- [ ] Refresh181-specific backup/restore/security evidence after stable gates;
  obtain exact additional SQL authority rather than reusing the through180 scope.
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
| Complete local quality |1028 tests pass in50.381s, zero failures/skips; source/spec/workflow checks and typecheck pass. This did not execute the full SQL matrix; the later CI failure and repair remain separate. |
| Exact local CI SQL group |84 suites pass, zero failure/skip, in354.323s after the deterministic GPS test repair. Every source/workflow hash matches; public/Auth table rows are preserved after rollback. No hosted writes. |

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
- [x] Read Netlify's exact site build metadata: production/allowed branch is main;
  provider reports manual. No settings or environment values changed/retained.
  Automatic publication and preview credential scope remain unverified.
- [ ] Hosted follow-up: review exact protections and remaining publication/preview
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
