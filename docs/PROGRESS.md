# Current work and release status

Updated October22. Work only in Loadgistic, even when the IDE displays Suqpage.
Start here, then read the applicable spec via [traceability](../specs/TRACEABILITY.md).
The [product brief](PRODUCT_MASTER_PROMPT.md) explains current source behavior.
The [preserved history](PROGRESS_HISTORY_20261020.md) contains earlier checkpoints;
do not read it as current instructions or restart work from its old pending items.

## Objective and boundaries

Current dependency: finish the coordinated demo-world simulator locally, then
freeze one web/mobile source for GitHub, CI and release. The already published
web and signed Android code9 are older source; do not describe the current
working tree as deployed or Play-ready.
The October 22 local source passes `npm run quality` (1,168 tests, zero failures,
typecheck) and `npm run build` (156 static pages; CSS warnings remain). A
critical desktop/phone Chrome run first exposed stale test labels and palette
values; the previously failing cases passed after focused assertion repairs.
The later accessibility audit caught white text on a pale provider action;
the button now uses the approved blue. Provider Home, driver Home and provider
Verification pass isolated desktop Chrome checks, and provider Home passes phone
Chrome. The formerly combined fourteen-route check is split into named routes
so CI can identify and rerun a failure without replaying every page. The final
local quality suite still passes after these changes.
The full same-source browser suite, CI, installed Android, later migrations,
hosted simulator and coordinated release are still pending. The sandboxed
Playwright launch failure was infrastructure, not a product test result.
The local 5,000-vehicle scale audit is **not green**: its legacy overview
query took 5.428s, then 5.119s on a controlled retry against a 5s limit.
This service-only path also missed a local timing gate on the older, CI-green
source; preserve the unchanged limit and use exact-source Linux CI to decide
release fitness before changing the database function.
Candidate commit `190d9d4` was pushed to `feat/mobile-app`. Its first same-source
CI run, `39893225119`, failed before browser shards: Expo lint/tests and the
disposable demo sharing fixture. No deployment followed. The local follow-up
repairs remove the React render violation, fix the Featured empty-string case,
refresh the affected native test harnesses, and give CI only a synthetic
private-capacity recipient. The complete native command passes 328/328 tests
with clean lint/typecheck; strict translations and Android export pass. The
focused CI-fixture checks pass. These repairs still need their own commit and
same-source CI before any release claim.
CI39528806968 passes all16 required jobs oncad46f1. Repair181 is applied and
independently verified on Loadgistic: the new search-path warning is gone;
current catalog/Data API checks pass, with only the two previously approved
warnings still visible. The web is live at https://loadgistic.com,
deploy6ad86887a637e6b8a2e70b44. The earlier same-runtime publication passed
100 normal-session API checks; the current image-routing publication additionally
passes16 HTTP checks and actual desktop/phone Chrome image checks.

The approved Featured demo repair is now committed and independently verified
at2026-10-21T05:53:23.374Z. All seven saved days (October21–27) have eight eligible
vehicles of their own scheduled category. Exact44 controlled synthetic driver/
vehicle pairs now belong to individual one-vehicle provider accounts; saved
pairs/order, rotation history,28 public/16 private signals and97 document rows
remain unchanged. No ownership verification, consent or customer record was
created. The original approval remains immutable; a genuinely fresh backup,
full restore and30.321s rollback rehearsal qualified the same approved data.
Protected evidence: `.local/featured44-renewal1/`, applied receipt2dcfa4ebb9ca...
and independent readbackcaa4fe9d32bb.... Installed Chrome on desktop and phone
confirms eight Featured cards without loading skeletons, vehicle dialog/profile/
back and public/private filtering. Optional documents already work (080,
confirmed on181); no182 is needed.

The additional nine-demo mix is also live and independently verified at
2026-10-21T06:51:51.051Z: nine Manual locations, seven additional Partial
publications and two courier configurations, through normal managed commands.
Only controlled synthetic fixtures were changed, including the separately
approved synthetic policy setup and unverified Permission declarations. The
fresh full restore and5.715s rollback trial pass; exact readback995f40473a63...
also proves all seven Featured days still have eight eligible vehicles. Live
Chrome checks pass on desktop and phone:48 public vehicles over four pages,
18 Partial/30 Empty, nine Manual examples, one courier car and one motorcycle;
all16 private fixtures remain excluded. Courier marker images and Manual icons
load. See `.local/demo9-renewal1/` and
`.local/browser-workflow-20261021/demo9-post-apply/`.

The signed1.1.1/code9 phone acceptance is complete for normal driver sign-in,
foreground updates, real background Tracking, cold restart and normal sign-out.
The real10km background projection and shipment event were observed after Home;
server sign-out revoked sessions/bindings and a signed-out restart stayed signed
out. Protected composite: `.local/authority-search-path181/phone-code9-authorized-resume/phone-completion.json`,
SHA256 f0edac752a820289f8d957736136e450f888667929fddd116fbc160e87c05003.
This genuinely checked the earlier web deploy6ad830; do not relabel that receipt.
The current web correction changes image redirects only, with the same frozen
runtime and source/CI qualification.

The owner separately approved a fresh Play phone recording session, including
replacing the test APK and briefly resetting its permission. The exact signed APK
was reinstalled; no new build, key or server-account reset. Fresh install showed
a stale Home permission message despite Android foreground/background grants and
an initial20-second Tracking timeout. A normal visible Refresh succeeded; live
phone reports and the10km projection were confirmed. Recording draft
`.local/authority-search-path181/phone-code9-google-demo/location-permission-review-code9-submit.mp4`
shows the real disclosure, Android prompts, settings and recovered map, but it
does not show “Allow all the time” selected and repeats the prompt. It is not
ready for Play submission. Its sanitized readiness receipt and media hash are
`.local/authority-search-path181/phone-code9-google-demo/play-recording-readiness.json`.
UI sign-out was verified by reopening to Sign in;
the separate read-only backend revocation check for this recording session
failed, so the earlier native-core session receipt must not be reused as proof
for this session. A full-screen call screen appeared during a later attempt; phone
interaction stopped there, and the unrelated screenshot was deleted. No runtime
repair or new build is claimed.

Image routing is fixed on the live site. The no-build Netlify publication had
omitted the adapter's three generated image redirects; the same immutable
artifact was published with only those routes restored. Source, runtime files,
private-file protections and secrets are unchanged. The current production
receipt is `.local/image-routing-20261021/production-receipt.json`, SHA256
ff847649169404f6fcd2ddb453af45fc1d2f4182948109e2a563e85da56f5ea0.
All16 HTTP checks pass: six decoded image variants, private-proxy denials,
health ready,48 public vehicles and eight Featured vehicles. Desktop and phone
Chrome show eight cards with decoded images and zero image400 errors.
The draft's missing production environment was retained as failed readiness;
it was not used to claim full draft qualification or broaden secret scopes.

Play remains a separate unfinished delivery. Code9 is not uploaded; latest
committed testing version is code7. The Console's reviewer instructions now
contain exactly the three current synthetic accounts, independently reloaded
and compared to the protected descriptor. No account/password was changed.
The old permission video is inadequate for the new10km flow; the fresh recording
and current declaration still gate delivery. Tester eligibility is not opt-in,
and no14-day completion or Google review completion is claimed.

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
- [x] Complete final source/spec/quality checks and exact-source CI: cad46f1,
  CI39528806968, all16 required jobs pass after one failed-jobs-only retry.
  The5000-vehicle run passes all results/counts/payload/cursor assertions, profile
  search4.707s and overview4.907s, but provider-map5.623s and route-map7.986s exceed
  the unchanged5s gate locally. This is not a passing scale qualification. CI's
  existing same-source timing gate remains required; no threshold is increased.
- [x] Obtain owner review of the exact additional SQL, backup, rehearsal and
  recovery plan. The owner approved only the tested181 security repair.
  Repair181 passed the isolated production180 restore and all nine focused SQL
  suites. Exact review: `.local/authority-search-path181/production181-owner-review.md`.
  Original evidence and approval remain immutable; expired prerequisites must
  be refreshed for the same source/SQL/target before any write. Execution and
  publication evidence is recorded in the completed steps below.
- [x] Refresh prerequisites, apply only181 and independently verify it removes
  this warning. Fresh restore/rehearsal and all nine SQL suites pass; original
  approval preserved with a same-scope evidence-renewal chain. Application
  at03:17:15Z, independent readback and post-security receipts under
  `.local/authority-search-path181/`; hosted ledger181, strict advisor still
  reports only the two previously approved warnings.
- [x] Publish the unchanged web artifact and run100 normal-session API checks.
  Real Chrome evidence: `.local/browser-workflow-20261021/published-smoke/`.
- [x] Apply and independently verify the owner-approved44-demo Featured repair.
  All seven saved days have eight eligible same-category vehicles; private signals
  and documents remain unchanged. Desktop/phone Chrome confirms Featured,
  dialog/profile/back,11 Partial/37 Empty vehicles and private16 exclusion.
- [x] Apply the separately approved nine-demo mix after fresh restore/rehearsal;
  independent readback also confirms seven eight-vehicle Featured days.
- [x] Finish native core acceptance, courier/source filter Chrome checks and
  the minimal image-routing publication with independent production checks.
- [ ] Current: record an accurate background-location video after the phone is
  safely available; update and independently inspect the exact Play declaration;
  then deliver the existing code9 bundle to Internal and verify the Play-installed
  copy before considering Alpha. Do not share the code7 link as if it contained
  code9 or claim tester opt-in/review completion.

Finish the approved web/database release and Android Play test build after the
security repair. The whole-test audit and original133bd08 CI are complete; their
verified evidence is retained below. The subsequent six-line private-Capacity
test maintenance is committed as48464e1, with exact desktop/phone Chrome evidence
and unchanged privacy assertions. Broader engineering housekeeping must not
restart completed audits or hide the remaining delivery/security gates.

Owner instruction October20: use agents for hands-on Chrome journeys, including
login, saved business actions, navigation and layout, under the existing
environment/production boundaries. Ask before each real-phone session. This is
recorded in AGENTS.md and the engineering skill; it does not restart completed
CI or authorize live account mutations. The initial old-live smoke findings are preserved in
`.local/browser-workflow-20261021/public-smoke/assessment.json` as historical
observations. They are superseded by the matching-release API, Featured/filter
and image checks above; do not restart their old diagnosis or call them current
live failures.
- Audit baseline: `8df190de2ad83f5c473bf09b9b360410b3896ec2`,
  branch `feat/mobile-app`; CI39497266765 was cancelled for this audit.
  Audit/housekeeping implementation is committed as `0479833`; use Git for the
  current head and protected receipts for subsequent exact-source CI status.
- Preserve unrelated
  `next-env.d.ts` and `apps/mobile/.claude/` changes. Do not rewrite Git history.
- Database updates through181, web publication and signing/install are completed;
  native core acceptance is complete; the fresh permission video and Play delivery
  remain incomplete.
- Loadgistic web3100 and Expo8084 previews were stopped under owner authority to
  free local test resources. Other-app processes are untouched. Verify project
  identity before restarting. Local Supabase remains55321/55322.

## October21 demo coverage — latest owner request

- [x] Audit actual canonical public eligibility rather than count stored signals.
  The143 controlled pilot vehicles contain87 Partial/56 Empty, but only20 are
  currently public and all20 are Empty. The tested44-account correction raises
  that pilot public projection to48, including11 Partial/37 Empty. The approved
  correction is applied live and independently verified under
  `.local/featured44-renewal1/`.
- [x] Check current fresh-backup registry scope separately from old clone data.
  Across146 vehicles there are no registered telematics devices/demo-motion
  targets yet; one real phone binding belongs to the private review workspace.
  Do not infer that no phone reporting exists or manufacture GPS source facts.
- [x] Rehearse the narrow demo diversity scenario locally through normal commands:
  nine genuine Manual entries, seven Partial publishes, two quiet vans changed
  to courier car/motorcycle, nine synthetic policy fixture acceptances and two
  unverified permission declarations. All24 place identities/order remain, with
  six explicit canonical coordinate corrections. Positive/negative filters and
  exact whole-data rollback pass; no real phone readings were restamped. The
  separately approved scenario is applied live and independently verified under
  `.local/demo9-renewal1/`; do not replay its one-use scope.
- [x] Apply only the approved synthetic demo changes; real accounts, private
  signals and document state remain outside that scope.
- [x] Verify public filters and Featured cards in desktop/phone Chrome after
  application; evidence is under `.local/browser-workflow-20261021/`.

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
- [x] Verify the previously built code9 APK/AAB and install/byte-verify its
  signed APK. The fresh same-artifact phone session exposed UX issues; this does
  not make the app-code or Play policy gates pass.
- [x] Complete fresh V11 backup/restore,37+5 SQL rehearsals and approved42SQL
  execution through180. Preserve original receipts and their actual clocks.
- [x] Apply the separately approved181 repair after current-source CI, fresh
  restore/rehearsal and security checks; independently verify it.
- [x] Publish and independently verify the matching web runtime and image routes.
- [ ] Complete current Play policy/video evidence, upload the existing code9
  bundle to Internal, verify the Play-installed build, then report the actual
  tester URL and status. The existing code7 releases are not code9.

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

## Owner-led first-customer product audit — October 21

The owner has moved the active focus ahead of further Play screenshots or
publication: judge Loadgistic as a product that must earn trust in a crowded
transport market. Work locally in web and Expo first. The public story, blue-led
identity, map, real feature flows, and representative provider/business examples
must work together. Do not use customer/tester records as marketing examples,
publish claims that current software does not support, or modify Production.

- [x] Record baseline desktop/phone web and settled Expo public pages, map,
  transporter search, Featured, About and private/Tracking entry. The screenshots
  are in `.local/product-audit-20261021/`; `/capacity` is a compatibility route,
  so `/` is the canonical market.
- [ ] Reframe the message around the actual daily jobs: providers choose how to
  share available vehicle space and routes; cargo teams see their regular
  transporters together, then search public supply when needed; agreed shipments
  can use private progress updates. Keep contact/confirmation responsibility
  truthful and avoid bidding, booking, payment, guaranteed capacity or universal
  live-GPS claims.
- [ ] Align the web and Expo brand and screen weight. Ordered work: (1) set a
  restrained high-contrast navy/cobalt palette with neutral surfaces, using
  cobalt/amber for Empty/Partial and preserving GPS/phone/manual source identity; (2) use one clear
  Loadgistic mark/wordmark treatment across web and mobile; (3) strengthen the
  same header, icon-led navigation, concise map actions and card hierarchy on
  both surfaces; make filter close/back, clear and results actions predictable
  without reducing map space or adding controls; (4) click through public home, Capacity,
  Featured, About and sign-in entry at desktop/phone web and Expo, check contrast,
  layout and actions, then get owner visual approval before full gates. Keep all
  locales natural and complete.
- [x] Implement the owner's approved Loadgistic mark with its original shape and
  wordmark font, recolored to navy, white and cobalt. The lockup is shared by
  web and signed-out Expo; signed-in compact headers use the same icon. Generated
  primary and dark-background lockups, web/app icons, Android adaptive foreground
  and monochrome mark. The Workspace selector remains the primary cobalt
  control; Capacity's Open/Shared selector is neutral, smaller and 40px tall.
  About/Fleet/Tracking and page headings use the same blue-led sans styling.
  Driver Home keeps task names but has larger icon-led actions. Root/mobile
  typechecks and source checks pass; Chrome desktop, phone web and Expo previews
  open public pages and filters without horizontal overflow. The settled web
  Featured roster contains seven vehicles. See `.local/product-audit-20261021/`.
  Owner approval of the finished screens and complete gates remain pending.
- [x] Align Capacity filters across web and Expo using one shared source of
  choices, distances and copy. City distance is 50 km by default, approximate
  area is 20 km, and route endpoint tolerance is 50 km; both clients now send
  matching values and share stop, freshness, location-source and document
  labels. Actual Chrome workflows pass for web and Expo, including desktop and
  phone web, both route radii, nearby radius, multi-option apply/reset and
  independent transporter search. Focused backend filter tests pass. During the
  first browser run, the refactor exposed a web-only document-filter initializer
  bug (`Object.keys` was used on the new shared array); it crashed Capacity and
  was fixed before approval. A second stale test selector then waited two
  minutes for the old Search label; it now uses the current button and textbox
  roles. Current captures are under
  `.local/product-audit-20261021/filter-parity-review/`. Owner visual approval
  remains pending; full gates and deployment have not run.
- [x] Address the first audit findings: Admin record sections remain reachable
  as a three-column grid on phones, duplicate workspace switching was removed
  from the mobile menu, blue selected surfaces and sans headings are consistent.
  The focused Admin phone E2E passes. The current driver-home quick-action test
  still needs one precise follow-up; its last run recorded one capacity action,
  one location action, a 589px map, successful OTP and no writes, but did not
  complete its modal interaction. Follow-up: the complete Expo Home modal E2E
  now passes with its one header Close control, 589px map, no writes and clean
  sign-out; see `tests/e2e/mobile-workspace-structure.spec.ts`.
- [x] Implement the shared dense-cluster starting camera without filtering
  signals or restricting pan/zoom. Unit tests cover distant outliers, a single
  U.S. signal, zero/invalid points, antimeridian neighbors, fallback and
  deterministic ties. Desktop and phone Chrome map checks pass; settled
  screenshots are in `.local/product-audit-20261021/map-camera-review/`.
  Expo settled with 14 rendered markers, successful capacity responses and no
  browser errors. Web and Expo use the same selected cluster, with a one-level
  zoom adjustment for MapLibre's tile scale. The change is local and still
  awaits owner visual approval; no full release gate or deployment has run.
- [ ] The focused installed-Chrome manual-location E2E passed against a
  disposable local provider/driver: it saved and read back a U.S. manual point,
  checked the selected actor and 5 km accuracy, verified the public map's
  obscured location/source projection and owner permission denial, confirmed
  the driver could switch back to phone, then cleaned up its records. This did
  not change the owner's vehicle or Production. Changing that exact vehicle and
  verifying its readback remains pending an owner session in the local preview.
  Keep Production untouched.
- [ ] Audit/curate the local examples as a believable mix of individual
  providers, small fleets and cargo teams, with visible, varied vehicle/load/
  route/location-source signals. Do not invent completed verifications, physical
  tracker certification, commercial scale or customer outcomes. The tested
  fixture import produces 143 vehicles, including six courier cars, six
  motorcycles and six tractor/trailer configurations; 53 Empty and 90 Partial
  signals; 88 public and 55 private signals; 143 routes; and varied full/shared
  acceptance. Those counts describe the imported fixture at audit time, not
  the current local preview. The later exact demo operations below added nine
  public GPS projections and lasting Manual examples, including the O10 Empty
  and O09 Partial heavy vehicles. Keep fixture, local preview and hosted data
  distinct when reviewing source icons and demo claims.
- [ ] Re-exercise useful visitor/provider/cargo-team flows on actual Chrome at
  desktop and phone widths, compare settled Expo web, and verify local API outcomes.
  Native background/location claims remain unverified unless the owner approves
  a fresh phone session.
- [ ] Make only focused local changes, run focused checks, then present actual
  before/after screenshots and URLs for owner review. Wait for visual approval
  before full quality/release gates. No Play build, social publication or hosted
  deployment is authorized by this audit.

Current evidence is exploratory, not a release claim. The local DB is healthy and
the web/Expo previews are running on ports 3100/8084. The settled baseline showed
a cross-surface camera mismatch: desktop could fit all loaded locations, so the
owner's U.S. test signal could pull the view out to a world scale; phone and Expo
started around Ethiopia. The shared initial-camera fix is now implemented and
focused-tested locally: all three surfaces use the same densest signal cluster
for the default view when no restored viewport or explicit visitor/vehicle
centering applies, without changing which signals are available; global pan/zoom
remain enabled. The owner's U.S. marker is real test activity, not demo inventory.
Focused actual-Chrome screenshots are ready for owner review; broad UI review,
full quality/release gates and deployment remain pending. Some baseline captures
show an initial loading frame while separate settled captures show the rendered
map; verify the actual reload transition before calling that a flicker defect.
About and the landing introduction remain generic. The product palette is now
blue-led; the focused color audit below checks remaining old CSS, loading,
map, icon, email and marketing-art treatments before broader review.

## Whole-platform workflow clarity review — October 21

Owner expanded this review to **every role and surface**, including platform
admins, staff and Support. Prioritize easy completion of real work over reducing
implementation effort. Governing contracts include FEAT-CAP-001, FEAT-FLT-001,
FEAT-PRV-001, FEAT-SHR-001, FEAT-ENT-001, FEAT-IAM-001, FEAT-SUP-001,
FEAT-ADM-001 and FEAT-MOB-001. This is a local product-quality task; it does not
authorize hosted data changes, a release or deployment.

Owner clarified October21: mobile deserves the stricter experience review because
its small viewport, touch and navigation constraints make unclear hierarchy more
costly. Start shared workflows on phone/Expo, then adapt the same task structure
to web. Clarity should come from layout, grouping, action order and focused
disclosure, not explanatory paragraphs. Keep microcopy concise where a decision
or consequence truly needs explanation.

Owner launch instruction October21: qualify web and mobile as one product. Every
promised workflow must have a coherent entry, completion, error/recovery path,
correct server-backed result and equivalent supported-language meaning on both
clients. Mobile may reshape controls for touch, space and native capabilities;
it must not silently omit the work. Compare behavior to FEAT-MOB-001 and the
controlling feature specs, not just to matching screenshots. Native-only claims
remain distinct from Expo-browser evidence. Local previews and synthetic data
only; this audit does not authorize a hosted mutation or release.

Owner clarification October21: the Featured header must explicitly identify a
**TikTok LIVE broadcast**, so users do not confuse the social broadcast with the
vehicle showcase timetable. It shows the planned start when scheduled and says
it is on now only after an authorized staff status update; a vehicle slot alone
never implies TikTok is live. FEAT-FTR-001 records this public/admin contract.
Migration182 adds scheduled/live/ended state, recorded start time, an authorized
status command, audit event and safe public projection. Web and Expo use the same
explicit copy; English, Amharic and Afaan Oromo entries are present. The focused
12-test presentation/mobile set, root and mobile typechecks, spec/source checks,
and the mobile translation audit pass. On October22, the exact SQL was installed
only on the backed-up local preview as its existing `postgres` table owner after
an atomic rollback-only rehearsal. The SQL state/permission regression passes
both before and after installation; 41 Featured days remain, with no false Live
state and browser roles denied the staff command. Both current Featured preview
URLs return HTTP200. The first bounded Chrome navigation timed out; a later
read-only Chrome check confirmed the honest no-broadcast header on both web and
Expo Web. A separate Expo first read timed out while the local public API took
15–18 seconds; a warm read took 3.6 seconds and rendered the full cards. Treat
this as an unresolved preview reliability finding until a source-matched
production-build check, not as a successful cold-start test. A phone-web
capture exposed a clipped TikTok message; the command row now wraps it beneath
the icon controls. Chrome at 320px and 390px verifies the whole label and zero
horizontal overflow, with a mapped E2E regression assertion. The owner approved
the corrected 320px/390px web and Expo phone Featured presentation on October
22. Staff scheduling/live transitions and a production-build cold-start remain
unverified.
Protected evidence is in `.local/featured182-preview-20261022/`. No hosted
migration or release is authorized by this local proof.

Brand follow-up from the owner: remove green from the brand palette and UI status
accents across web, Expo, maps, email and promotional graphics. Empty is cobalt,
Partial is amber, GPS is purple, phone is cobalt, manual is amber, and failure is
red; labels and icons retain each meaning. Natural map and landscape colors stay
natural. Verify both clients and supported languages together; visual approval
remains pending.

### Legacy palette and loading-state audit — October 21

- [x] Inventory green/teal/mint styling in 22 web and Expo stylesheets, native
  screen/component colors and SVG brand assets. Separate capacity, success,
  verification, availability and location-source colors from decoration.
- [x] Replace old green/teal brand hues with cobalt, amber, purple and neutral
  colors. Loading bars, map skeletons, Empty map signals, cards, selected controls,
  email templates and promo wordmarks now use the current palette. Native screens
  share a cobalt-default spinner; verified and successful states use cobalt and
  failures remain red.
- [x] Recolor the portrait, wide and Play-art variants while preserving the
  East African yard, people, trucks, natural vegetation and gold road lighting.
  The new files are versioned; the old generation records remain as provenance.
- [x] Run a second low-saturation color sweep. It caught faint green casts in
  success/verified states, captured-location panels, the sticky vehicle editor,
  the Featured surface, OTP emails and the old PWA screenshots. Those now use
  cobalt or cool neutral. The signup trust panel uses the navy/cobalt yard image;
  natural vegetation and road-map colors stay natural. Superseded PWA screenshots
  and freight photos are archived outside the served `public` directory; current
  marketplace captures replace the screenshots in the install metadata. A final
  asset pass also replaced the teal source wordmark used by the icon generator and
  archived the unused teal Featured billboard outside `public`.
- [x] Run both web and mobile typechecks, parse all 22 CSS files and pass 50
  focused mobile UI tests. During that run, update two stale capacity-search
  assertions to match the current short visible labels and their full accessible
  names.
- [x] Add a palette regression test so green/teal literals in UI CSS, SVG,
  mobile styles, email templates and visible mark/icon PNG pixels fail the
  standard test command. Focused run: 2 tests pass; all 22 CSS files parse; PWA
  screenshots resolve with matching dimensions; specs pass (40 specs, 37
  features); scoped whitespace check passes.
- [ ] Owner review of the Chrome captures and recolored promotional images is
  pending before broader check/release
  gates: `.local/legacy-palette-audit-20261021/final/web-phone-home-after.png`,
  `web-desktop-home-after.png`, `web-desktop-login.png`,
  `expo-phone-loading-after.png` (cobalt progress line),
  `resources/marketing/prelaunch/east-africa-yard-wide-cobalt.png`,
  `resources/marketing/prelaunch/east-africa-yard-portrait-cobalt.png`, and
  `public/marketing/loadgistic-home-hero-cobalt.png`. No full/release gate or
  deployment has run.

- [ ] Restore and verify the existing local Supabase/web/Expo environment without
  resetting local data; record which previews and APIs are actually reachable.
- [ ] Build a feature/role/surface matrix from accepted specs: web routes, Expo
  screens, API/RPC or command authority, focused tests, and English/Amharic/
  Afaan Oromo message coverage. Mark intentional native-only behavior and true
  web/mobile gaps instead of assuming parity from similar labels.
- [ ] Exercise the highest-value joined workflows by role on phone-first Expo
  and responsive web, then desktop: public discovery and filters; provider and
  driver first Capacity publication/update; provider fleet/driver management;
  business owner/staff Capacity and Tracking; private sharing/revocation;
  shipment creation, proof/status and tracking permissions; support; staff/admin
  record review. Include loading, empty, saved, failed/retry, denied and return
  paths, and verify authoritative local API/database state.
- [ ] Audit translated message coverage and rendered text fit for each exercised
  workflow in English, Amharic and Afaan Oromo. Record any translation whose
  natural phrasing needs a fluent reviewer; never infer fluency from key parity.
- [ ] Fix each verified gap with its existing spec and a focused regression test;
  preserve existing permissions, records and native-only boundaries.
- [ ] Summarize tested versus untested features, remaining launch blockers,
  actual desktop/phone/Expo screenshots and local URLs; obtain visual review
  before full quality/release gates. No deployment is authorized here.

- [ ] Inventory page families by role and task, including first use, saved,
  empty, loading, failure/retry and denied states. Identify where the interface
  exposes data-model structure, ambiguous actions, duplicate actions or weak
  return paths.
- [ ] Start with actual Chrome phone workflows and the Expo preview for public
  visitors, Transport Provider owners, drivers, business owners/staff, platform
  Support, delegated staff and admins; then compare web desktop for task parity
  and useful wide-screen context. Include create/update/revoke flows for Capacity,
  profiles, private connections and fleet operations, plus relevant
  customer-team and Support work. Verify saved local API/database outcomes.
- [ ] Check matching Expo screens for provider, driver and business tasks; record
  native-only limits separately from what the web preview can prove.
- [ ] Fix the highest-friction task flows without removing capabilities or
  silently changing authorization. Update the existing governing specs and
  focused tests before each behavior change.
- [x] Fleet manager Capacity responsive web slice: replace the crowded control
  cluster with a compact vehicle header, map-led Capacity task and four grouped
  actions; keep driver assignment and publication management with Vehicle
  details. Focused save/cancel/failure checks cover the map and location dock;
  the synthetic Fleet walkthrough confirms read paths and permission-aware
  actions. Evidence: `.local/dashboard-task-fleet-20261021/manager-capacity/`
  (phone, narrow-phone and desktop captures; `evidence.json`). Focused Chrome
  desktop workflow passed. The saved 320px follow-up capture then exposed a
  rail/location-dock collision that the previous assertion missed because it
  checked only vertical clearance at 390px. The 320px rail now reflows to two
  labeled rows with unchanged touch targets, and the regression test checks
  actual rectangle intersection at both 390px and 320px. The test has not yet
  rerun: Chrome aborts at launch on this Mac (SIGABRT), and bundled Chromium
  traps before opening the page (SIGTRAP). These are browser-runtime failures,
  not passing UI evidence. Source check, spec-link check, TypeScript and
  Playwright test discovery pass. The Expo fleet-owner comparison and owner
  visual review also remain open.
- [x] Expo business Account hierarchy: the former flat action list is grouped
  into Business workspace and Your account, matching the web account model while
  keeping focused task screens and owner/team permissions intact. The pure role
  matrix passes seven business-workspace contract tests, TypeScript and spec-link
  checks pass, and the synthetic Expo owner/staff browser workflow now asserts
  the visible group contents. Actual screenshots/workflow have not rerun because
  Chrome and bundled Chromium fail before opening a page in this environment;
  visual approval is pending.
- [x] Admin Account overview code audit: person, business, fleet, Tracking,
  documents and assigned Support are already grouped within the selected account,
  with separate linked vehicle records and current permission gates. GPS devices
  were the outlier: they appeared as a separate card at the page bottom and
  vanished when none existed. They now sit inside Fleet with an explicit empty
  state, stay read-only, and expose no IMEI/raw location. Added Amharic and Oromo
  wording and owner/employee desktop-phone assertions. Admin-account authorization
  tests (16), Admin presentation tests (21), localization tests (7), typecheck,
  spec links and Playwright discovery pass. Chrome workflow and visual approval
  remain pending; this is not a full Admin experience or release sign-off.
- [x] Expo owner Fleet Capacity task: the selected vehicle now keeps an
  interactive map in first use, shows saved coverage/routes without inventing a
  location fix, and presents separate Capacity, Sharing, Usual routes and
  Location actions. Each opens a focused safe-area editor over the still-mounted
  map; the repeated route editor below the map was removed, leaving one clear
  entry point. Sharing is unavailable until a capacity signal exists, and profile setup
  stays at account level. The selected-vehicle view shows a concise empty-map
  prompt instead of a blank Ethiopia map. Focused renderer tests exercise the
  empty state, saved route geometry, task labels, editor open/close, and sharing
  scope. `apps/mobile/tests/truck-regular-editors.test.mjs` passes 10/10;
  mobile language tests pass 16/16. TypeScript, source check, spec-link check,
  whitespace validation and Playwright discovery pass; discovery sees the two
  desktop/phone Fleet workflows, but they were not executed. I verified both
  stale listeners belonged to Loadgistic and restarted them: Next reports ready
  and binds 3100, but requests from this agent session are still refused; Expo
  prints its offline version-check warning and never binds 8084 after one
  controlled retry. The stalled Expo attempt was stopped. Actual Expo/Chrome
  screenshots and owner visual review remain pending because this Mac's Chrome
  aborts at launch and bundled Chromium traps before opening a page; no browser
  workflow or visual approval is claimed. Do not treat either preview URL as
  verified until it returns HTTP 200 from a browser session.
- [ ] Continue auditing role workflows after Fleet: Transport Provider owner,
  driver, business owner/staff, Support staff and platform admin, on Expo and
  responsive web. The broader role/task inventory and its create/update/revoke,
  empty/loading/error/denied and return-path checks remain active; this first
  Fleet slice does not represent an all-app completion.
- [ ] Review Amharic and Afaan Oromo for meaning, simplicity and fit in each
  changed flow, then present actual desktop/phone states and concise review
  steps to the owner. Full gates remain after visual approval.

The design principle now lives in `AGENTS.md`, `docs/PRODUCT_MASTER_PROMPT.md`
and `.agents/skills/loadgistic-ui-ux/SKILL.md`: clarity applies to all roles,
including internal teams; phone use is the stricter shared-workflow case; layout
and hierarchy should explain the UI before helper text; empty states must orient
people and give a next step; saved records come before deliberate edits; every
state and translation must support task completion.
This is one additional local Expo owner workflow slice, not completion of the
whole-platform review or release qualification.

## Capacity filter and posting clarity — October 21

Owner request: the map filters and capacity-posting flow feel confusing. This
slice groups the existing map filters into Vehicle, Location, Route, and More;
uses consistent icons and short section labels on web and Expo; and gives the
capacity editor a clear order for availability, load preference, coverage, and
sharing. Keep every existing filter value, multi-select rule, default, API
parameter, publication rule, permission, and save/cancel outcome unchanged.
The governing contract is FEAT-CAP-001. No database or hosted change is in scope.

Follow-up owner request: remove customer-facing payment feature language, put
Vehicle type before Load status, and place accepted-load preference beside the
current capacity status. Keep transport pricing/business records and legacy
server contracts unchanged; this is a presentation cleanup. Make the same
priority order understandable in the map filters and posting/editor surfaces.

- [x] Add the presentation acceptance criteria to FEAT-CAP-001 before changing
  UI code; inspect the existing wording/localization rules and keep the accepted
  filter semantics unchanged.
- [x] Build consistent icon-led filter groups and concise headings in web and
  Expo; organize the capacity editor into the same task order without hiding
  essential first-use decisions or changing save behavior.
- [x] Put Vehicle type first, then Load status; order Location as city/distance,
  nearby area, then source; order Route as origin/destination, ranges,
  direction, then stops; order More as freshness, then reviewed documents. The
  shared presentation contract drives both clients and the focused browser and
  native tests verify the same ordering.
- [x] Present current capacity and accepted-load preference together in web and
  Expo editors, and beside status in the truck/driver summaries. The editor
  places load preference immediately beside the status on desktop and directly
  below it on phone.
- [x] Remove payment feature copy from current member/support/terms surfaces and
  display any retired support category neutrally without rewriting stored chats.
  The localized web and mobile catalogs contain no billing/payment-plan copy;
  retired APIs and compatibility paths remain internal and non-promotional.
- [x] Add focused web and Expo regression checks for group order, labels, icon
  accessibility, collapsed/expanded controls, filter query parity, and editor
  save/cancel behavior; update Amharic and Afaan Oromo wording where needed.
- [x] Run focused tests, localization/source/spec checks, and typechecks.
  The filter workflow passes in desktop and phone browser projects; it exercises
  multi-filter selection, route/location grouping, panel return, and the local
  map request. Capacity dialog save/cancel and persisted-state workflows pass in
  both projects. Native component tests preserve the filter draft until Apply,
  while the Expo phone screen was opened in Chrome with no JavaScript errors.
  Source/spec checks, translation audit, and both client typechecks passed. The
  Expo preview could not fetch map data because its 8084 UI server has no local
  API routes; its visual evidence is saved under
  `.local/capacity-filter-review-20261021/`. The phone editor review also
  confirms the repeated “choose where” helper was removed; the route-required
  guidance for Partial capacity remains.
- [x] Verify the follow-up ordering/copy in focused browser/component checks and
  inspect the affected desktop/phone screens. The targeted drawer workflow passes
  in desktop and phone Chrome (2/2); capacity editor save/cancel and persistence
  passes in both projects (2/2); 15 focused native tests pass. `typecheck`,
  `check:source`, `check:specs`, and the four plan-retirement tests pass.
- [ ] Present the concrete local screens for owner review. Full/release gates
  remain pending explicit visual approval; no deployment is authorized by this
  slice. Review evidence is under `.local/capacity-flow-review-20261021/final/`:
  `web-filter-desktop.png`, `web-filter-phone.png`,
  `web-filter-route-more.png`, `expo-filter-phone.png`,
  `capacity-editor-desktop.png`, and `capacity-editor-phone.png`. Previews are
  `http://127.0.0.1:3110` and `http://localhost:8085`.

## Optional shipper/broker document review — October 21

Owner correction: document verification is optional. Shippers and brokers remain
discoverable and can receive explicitly shared Capacity without submitting
documents. The existing private submission and Trust review process stays
available; approved current documents add trust badges only. Review fees remain
offline. Use “Shippers & brokers” as the shared UI label; “Cargo owner” is too
narrow for brokers. Contracts: FEAT-ENT-001 and FEAT-VER-001.

- [x] Remove the unapproved required-vetting rule from the proposed migration;
  no SQL or hosted change was applied.
- [x] Update the governing specs and product guardrails to make review optional
  without weakening private-file, Trust-review or identity checks.
- [x] Add local SQL regression assertions proving an unreviewed workspace stays
  searchable and can be added; prove current approved documents add badges.
- [x] Clarify the optional Documents task in web and Expo and add Amharic and
  Afaan Oromo strings.
- [x] Use “Shippers & brokers” for the demand-side directory, “Shipper / broker
  workspace” for the account area, “Workspace admin” for its local admin role,
  and neutral “Contact name” for private email shares. Update the FEAT-ENT-001
  UI contract, product prompt, agent contract and traceability links. Workspace
  and admin records use “Workspaces”; Shipper/broker and Receiver account types
  stay distinct. Internal API/database names remain unchanged. Focused checks
  passed: 31 web/shared tests, 11 Expo workspace/sharing tests, and the native
  translation audit (733/733 fixed messages in Amharic and Afaan Oromo).
- [ ] Verify changed screens and the owner/provider/Trust review flow in local
  browser previews, including desktop and phone; request visual approval before
  broad quality/release gates. Requests to localhost:3100 and localhost:8084
  failed from the current shell even though listener entries appeared, so this
  remains unverified. No hosted change or deployment is authorized.

## Active implementation — coordinated demo-world simulator (October 21)

Owner confirmed that demo simulation should represent real product changes,
including driver/vehicle reassignment. Governing contract: planned expansion in
[FEAT-SIM-001](../specs/features/FEAT-SIM-001.md). This starts local/spec work
first. Production scheduling, live data changes, outbound communication and
public GPS ingress still need their exact host, account scope and recovery plan
reviewed before activation.

- [x] Taskforce audit GPS gateway, existing local simulator, demo isolation,
  Featured/search effects and Tracking visibility. The current movement runner
  supports only two exact synthetic vehicles and a maximum one-hour local run;
  no coordinated workflow scheduler or production simulator is installed. The
  isolated Traccar 6.16 stack and restricted bridge were started for local tests
  on October21; their API and GT06 listener are loopback-only. An initial
  restricted-shell port/Docker check incorrectly reported the stack stopped.
  The later explicit local check on October22 confirmed the web and Expo
  previews, Supabase, Traccar, database and bridge are running. No paid resource
  or hosted service was created.
- [x] Record the owner-approved expanded scenario contract and safety cases in
  FEAT-SIM-001 before implementation.
- [x] Inventory existing server commands and invariants. Assignment/lifecycle
  commands live in migrations 090/145; Capacity publication/source in 151/163/172;
  business membership/sharing in160/161; shipment status and proof in044/117;
  Tracking delegation/location in158/162/172; Featured pair history in137.
  These paths carry permission, audit, projection and notification effects that
  the simulator must preserve or isolate explicitly.
- [ ] Build a fixed, versioned synthetic manifest and deterministic scenario
  transitions that reuse validated commands. Preserve stable search/filter
  examples while safely exercising handovers and shipment progress.
  - [x] First slice: define an exact fixture-key manifest for a small curated
    local demo world; no account discovery, contacts, secrets or live writes.
  - [x] Add a pure deterministic planner for the first capacity-status scenario.
    It proposes only an allowlisted transition with its expected prior state
    and stable idempotency key; it does not execute or persist the change.
  - [x] Test exact fixture ownership/linkage, bad-manifest rejection,
    deterministic replay and preservation of stable market examples. The
    focused planner, motion and telematics suites pass 29/29.
  - [x] Add a separate transactional Capacity adapter in migration 185. It calls
    the validated publication command, writes an immutable receipt in the same
    transaction, and passed a clean isolated install plus rollback-only 14-step
    rehearsal and 2/2 manifest/schema parity checks. It was later installed on
    the backed-up local preview after an isolated restore rehearsal, but not on
    Production; local ledger drift remains unresolved. The
    separate Netlify dispatcher/background worker and signed internal route
    pass focused tests but remain disabled.
  - [x] Add isolated Tracking notification handling (186) and one atomic,
    every-14-day synthetic driver handover (187–188). Clean disposable installs,
    rollback-only SQL tests, and the signed worker's exact lease tests pass.
    CI now installs 185–188 only in its disposable clone when all are absent,
    rejects partial state, and runs all four SQL regressions. The four exact
    files were also installed on the backed-up local preview after an isolated
    restore rehearsal; its control remains disabled, with zero queued jobs or
    durable receipts. A single local worker step passed inside a rolled-back
    transaction, so no Capacity record was left changed by that test. The
    preview ledger remains at 129 and was not rewritten. Production has no
    185–188 install or active schedule.
  - [x] Add the default-off hosted GPS control (189) and exact synthetic broker
    private-Capacity sharing scenario (190). The
    signed demo-world worker now invokes the broker grant/revoke claim after
    Capacity and handover; focused worker tests pass. Both SQL regressions pass
    separately, and CI is configured to install 189–190 after 185–188 on its
    disposable database. A combined 189–190 disposable-clone rehearsal passes;
    both are installed on the local preview with controls off. The exact
    synthetic broker was bound and its 0 → 1 → 0 private-feed scenario passed.
    Neither scenario is active in Production.
- [x] Finish the local administrator GPS intake for one explicitly synthetic
  tracker. Admin registered the exact Demo spare under BlueLine; the provider
  saw it in web and Expo Web, assigned it to Truck02 and saved GPS as the source.
  One GT06 report appeared on the private map with Demo provenance and no IMEI;
  cross-provider assignment was denied. Focused tests, isolated SQL checks,
  typecheck and desktop/phone browser checks pass. The owner approved the final
  layout. This qualifies the local synthetic flow only: installed Android,
  hosted ingress and the physical tracker remain unverified.
- [x] Check managed hosting fit for the next step. Netlify background functions
  run at most 15 minutes and are request-invoked; upgrading Netlify does not
  provide the always-listening raw TCP socket GT06 needs. Supabase Cron and
  Edge Functions can schedule bounded work but cannot host GT06 ingress. New
  owner-reviewed research in
  [DEMO-GPS-HOSTING.md](operations/DEMO-GPS-HOSTING.md) supersedes the earlier
  Supabase-Cron-first preference: reuse the existing Netlify signed
  scheduled/background pattern for the workflow simulator, and use one separate
  TCP-capable Linux host for the Traccar gateway. Only GPS devices and the
  isolated GT06 packet test use TCP; the comprehensive workflow simulator does
  not. Fly supports raw TCP but requires provider-specific deployment/storage
  work; the existing Compose template more directly fits a conventional VM.
  Provider selection and deployment remain pending; no paid service was created.
- [x] Prepare the provider-neutral deployment comparison, separate service
  boundary, host sizing floor, network exposure and pre-deployment acceptance
  checklist in `docs/operations/DEMO-GPS-HOSTING.md`. This prepares the next
  owner choice; the separate workflow worker is now implemented and installed
  disabled on local preview, but this does not authorize a hosted mutation.
  The hosted Compose template validates with inert placeholder
  values and `git diff --check` passes. Node22/npm were present under NVM but
  omitted from the default login-shell PATH; the explicit-path spec check now
  passes. No paid resource or hosted listener was created.
- [x] Separate real and synthetic hosted GPS gateways in the Compose template.
  The synthetic GT06 listener/database/admin API are unexposed; only the real
  GT06 port can be public. Both hosted bridges disable device commands, while
  local command tests retain an explicit local-only opt-in. Offline config,
  focused topology checks, Compose rendering and spec checks pass. The separate
  hosted movement worker, application HMAC path and transactional kill switch
  now exist as default-off source with local tests. Migration 189 was rehearsed
  in a disposable clone and installed on local preview with its control off;
  no host or production setting was created.
- [ ] Qualify the two deployment artifacts on a staging host: the Traccar/
  private-DB/restricted-bridge stack with its opt-in movement worker, and the
  separately scheduled/background demo scenario worker. The source artifacts
  are prepared; health/lag metrics, secret injection, firewall/port rules,
  backup/restore, readback and rollback still need an end-to-end rehearsal.
  Do not deploy or expose ports without the host and exact owner review.
- [ ] Add negative and replay/concurrency tests proving real records, saved
  Featured days, in-progress shipment authority and status-only recipient privacy
  remain unchanged.
- [ ] Verify persistence and role workflows against the isolated local database;
  the full role/scenario matrix is still pending. On October21, a bounded local
  run delivered GT06 login and three fixes to Traccar, then passed through the
  signed bridge into the synthetic company vehicle's Capacity source with demo
  provenance. The synthetic phone vehicle also updated through the mobile source
  and retained demo provenance. The first run exposed missing local gateway
  environment (401); the protected local runtime config was corrected, and the
  second run passed. A later one-hour runner process was absent on October22,
  but its two backend leases still had about 647 seconds remaining. A subsequent
  60-second start acknowledgement did not prove a new process was running; the
  state file had been replaced before the backend-active check. Both exact demo
  leases were stopped through the signed local API and now report OFF. This does
  not certify the physical tracker. A WhatsGPS
  device using GT06 needs an isolated reachable staging address; the current
  listener is loopback-only.
- [x] Repair the recurring local GPS delivery failure at its source. A plain
  web restart omitted the protected gateway binding, so Traccar decoded 34+ demo
  positions while its bridge queued them and the app replied 401. The guarded
  local web launcher now reads only the protected loopback gateway configuration.
  A fresh 90-second fictional run passed 2 decoded → 2 delivered → 2 app fixes;
  the paginated public Capacity API showed TELEMATICS/Demo at 78 seconds old.
  Phone-sized Chrome selected the GPS badge and loaded nine map tiles with zero
  tile failures. The read-only verifier and focused launcher tests pass. The
  runner stopped cleanly; this is not evidence of recurring hosted motion.
- [x] Run a bounded actual-Google-Chrome smoke check across desktop web, phone
  web and Expo phone previews: all pages returned HTTP 200, public Capacity
  requests returned HTTP 200 (5 desktop, 5 phone web, 3 Expo), and there were no
  browser page errors. Web maps rendered 21 truck/cluster markers; Expo rendered
  its map surface but its MapLibre markers are canvas-drawn, not DOM-countable.
  The paginated public feed contained 101 signals (62 Empty, 39 Partial),
  including one public demo GPS signal. The active demo phone target is MOBILE
  but is not in the public feed. Only one public GPS demo is therefore proven
  visible; private Capacity and Tracking badge workflows remain unverified.
  The public point stayed in the same privacy-grid cell during a 20-second
  sample. This smoke test does not prove visible movement or a stale raw fix.
  Evidence: `.local/telematics/local-sim-smoke-20261021.json`.
- [x] Fix runner status under restricted process permissions: `EPERM` from a
  process-existence probe now means “alive”; `ESRCH` remains “stopped”. The new
  regression test passes, and the unprivileged status command reports both
  bounded targets as running. Focused telematics/demo tests pass 22/22;
  `npm run check:workflow` parses all 104 operational scripts and validates the
  pinned workflow linter. ShellCheck is not installed.
- [ ] Complete actual Chrome role workflow checks for private Capacity and
  Tracking source markers, plus an Android-installed session when the owner
  connects the phone. Public phone-web GPS badge and fresh data are now proven;
  the Expo web preview does not prove native location permissions or background
  reporting.
- [x] Read the authoritative local simulation state before testing. Both exact
  targets had sticky REAL stops (`SOURCE_CHANGED` and `REAL_INSTALLATION`). The
  owner then explicitly requested local simulation. Readback confirmed both
  exact synthetic devices, unchanged GPS/MOBILE source choices and no active real
  phone installation; an explicit bounded resume passed. The runner pauses again
  on a real installation or source/assignment change and auto-stops at its bound.
- [ ] Reconcile the local database migration-ledger drift before any broad
  migration replay or release qualification: `supabase_db_loadgistic-local`
  reports latest tracked migration 129, while later simulator objects exist.
  Exact migrations 183–188 were separately backed up, rehearsed on an isolated
  restore, and installed locally without changing the historical ledger. The
  repository CLI is not installed at `node_modules/.bin/supabase`; no attempt
  was made to repair the ledger.
- [ ] Confirm the exact WhatsGPS hardware model and its model-specific server
  configuration command before any physical-device test. “4G” is the cellular
  network class, not a second tracker protocol. Do not expose IMEI or device
  credentials; do not point the device at production for this test.
- [x] Model GT06 as the first physical protocol integration: Traccar owns the
  binary TCP decoder, and the existing signed bridge receives normalized
  position events. The contract, privacy rules and physical qualification order
  are in `infra/telematics/GT06_API_MODEL.md`; this is not hardware certification
  or a deployed staging service.
- [ ] Review actual web/phone/Expo results and save isolated local evidence.
  Production rollout requires a separate owner-reviewed infrastructure and data
  plan; do not loosen the current production guard.

### Local testability and simulator design — October22

The system is designed so web and mobile can use the same local API and
Supabase data. Web uses `127.0.0.1:3100`; Expo Web uses its development origin
on `localhost:8084` and a bounded proxy to that same web API. Android emulator
development points at `10.0.2.2:3100`; a physical phone needs a reachable Mac LAN
address. These are separate clients, not separate demo databases. The app must
show the same saved actor and Capacity state on both before a scenario is called
verified. On October22, web3100 and Expo Web8084 both returned HTTP200, and both
returned the same first Capacity API page: 14 vehicles, 9 Empty and 5 Partial.
The actual local Supabase, Traccar, telematics database and restricted bridge
containers are healthy/up. Node22.16/npm are installed at
`/Users/falmata/.nvm/versions/node/v22.16.0/bin`; the default shell PATH omits
that directory. `npm run check:specs` passes with the explicit PATH.

Before this expansion, the local database had 252 vehicles, 475 Capacity rows, two exact demo-motion
targets and both `shipments` and `provider_shipments` tables. The former has no
rows; the latter has 84 records, of which 47 were created by fixture-marked
synthetic users, with 89 associated events. Three business workspaces and 11
fixture-created Capacity grants also exist. Its migration ledger says129 while
later demo objects already exist; `tracking_sessions` is absent. This is
unresolved schema drift. No reset or migration replay was made. Guarded migrations
183–184 were backed up, rehearsed on a disposable restore, and applied once to
the local preview; the historical ledger remains unresolved. An earlier bounded
movement run wrote fixes only for the two original synthetic targets, including a refreshed Phone-source
Capacity location. It did not change their selected sources, radii, assignments
or Capacity status, and did not change shipment or other non-demo data. Reconcile
the local catalog/ledger before any simulator schema changes; do not destroy this
database to make the ledger look current.

The checked-in market fixture contains 154 users (1 platform admin, 1 Support,
9 Transport Providers, 143 drivers), 9 organizations, 30 company pages, 143
vehicles and 143 Capacity rows (36 Empty, 107 Partial). Those checked-in fixture
Capacity rows all use one `location_source`; one row is `SAVED_PARTNERS`, and the
checked-in fixture itself has no shipment or event rows. The existing local
database has additional synthetic tracking and cargo-team records as counted
above; fixture-file absence does not mean database absence. The demo-world
manifest now contains seven exact fixture targets and five mutable targets; its
bounded local executor saves through the normal Capacity command. The live local API has a different market
projection (101 public rows in the October21 paginated audit), so fixture counts
must not be presented as live preview counts.

A read-only local cohort check found a substantial synthetic marketplace roster:
163 active vehicles owned by fixture-marked demo accounts, each with an active
fixture-marked driver assignment, and 310 Capacity rows. The checked-in
`managed-market.json` fixture does not fully describe this current local dataset;
one of its target baselines is already stale, so static fixture validation alone
does not authorize runtime writes. The checked-in fixture has no shipment/event
rows, while the local database has the separate synthetic records counted above.
Before migration183, the two rows in `demo_motion_targets` authorized one GPS
and one phone vehicle. Migration183 adds an eight-vehicle exact fleet allowlist;
184 extends only fictional-device provisioning for those owners. These GPS
bindings do not grant marketplace-edit authority. Ten fictional devices are now
attached, with nine GPS and one phone source. The owner confirms the current
vehicles are demo data and authorizes local demo use; still bind every simulator
write to a checked exact roster and the normal validated app command. Do not run
the fixture importer here: its reset deletes all fixture-tagged accounts and
managed rows. The local migration ledger remains at129 despite later simulator
objects. Guarded local-only 183–184 were applied after a protected backup and
isolated restore rehearsal; no reset, bulk migration replay, customer account
change or broad source reassignment was made.

The October22 runner recovery check exposed a state-clobbering bug: it returned a
start acknowledgement while an older backend lease was still active, then exited
without recording targets. The exact leases were stopped and verified OFF. The
runner now checks backend leases before replacing recovery state, distinguishes
process-probe `EPERM` from an absent process, and reports stable sanitized error
codes, including failures returned by a paused target. Focused regression tests
pass. The 5-second run cadence caused the web and status HTTP requests to time
out intermittently while movement was active; the leases stopped and both
previews recovered. The earlier two-target runner used a 30-second cadence. Its 60-second
verification run sent two GPS and two phone reports, completed with both leases
OFF, and left sources, radius, assignments, Capacity status, shipments and
non-demo records unchanged. Two checks during that slower run returned HTTP200
from both web and Expo: web in 2.32s and 1.06s, Expo in 0.17s and 0.01s. Earlier
October21 ingestion evidence remains separate evidence for that earlier run.

The earlier single GPS target appeared in desktop/phone web and Expo Web.
After the guarded expansion, a 90-second local run accepted three ticks from
each of ten exact targets and stopped all leases cleanly. The paginated public
Capacity API found nine located demo GPS vehicles with TELEMATICS source and
`location_is_demo=true`; the phone target remains private. Desktop and phone
Chrome screenshots under `.local/demo-world/` show the expanded map without a
loading error. This verifies the local web/Expo Web data path, not a native
Android build, physical tracker, or background-device behavior.

The first longer ten-target run exposed local overload: each target's first
fix saved, but simultaneous later requests timed out, and one backend lease
needed explicit cleanup. All ten leases were then verified OFF. The runner now
staggers a larger cohort by six seconds and reports each target at most once
per minute; transport failures have a stable sanitized status, and a GPS
reservation denial stays visible after its socket closes. Both Capacity map
front ends now refresh saved results every minute while visible/foreground;
the selected Expo vehicle resolves from the latest fetched record. The Expo
preview was restarted with its intended local proxy after an incorrectly
started process served HTML for the API and map worker. A focused desktop
Chrome polling test and the repaired Expo phone view pass. The first three-minute
ten-target attempt did not meet its gate; a later read-only diagnosis found the
app/API unavailable, which also prevented cleanup confirmation. The exact cause
of that earlier app shutdown is unknown. After restarting the intended local web
server, a fresh bounded three-minute run completed normally: all ten targets
saved two or three fixes, both GPS and phone sources were represented, and the
Capacity API returned HTTP200 in five of five samples during the run (0.7–5.3
seconds; later warm samples were under two seconds). An authenticated read-only
status check confirmed all ten leases OFF. This verifies the local ten-target
movement path for a three-minute run; it does not verify an all-day schedule,
native Android background behavior, physical tracker hardware or hosted
deployment. A paginated public API read after the run found 101 rows across
eight pages, including all nine intended public demo GPS vehicles with
`TELEMATICS` source; the private phone-source example remains private. The Expo
Web preview was restarted and returned HTTP200 on `/`. Actual Chrome opened the
desktop public Capacity map and the 390px Expo Web map; both fetched Capacity
pages without JavaScript errors. The Expo map rendered 16 markers after its
initial page load. Screenshots: `.local/demo-world/current-desktop-chrome.png`
and `.local/demo-world/current-phone-after30s.png`.

The intended local simulator has three layers: (1) stable, curated baseline
records that guarantee useful results across vehicle/status/route/source/
visibility/region filters; (2) a deterministic event timeline with virtual-time
advance, pause and replay for a small exact demo subset; and (3) the existing
GPS packet and phone-report movement pipelines. The stable baseline and both
movement pipelines are present locally. Five exact Capacity targets now
execute status, load-preference and route changes through the ordinary
`publish_provider_capacity` command. Durable database receipts prevent a
second execution of a completed step; the finite local supervisor calls the
worker on a timer. Manual location remains static. Hosted activation and broad
shipment and provider-lifecycle scenarios remain pending. One exact driver
handover and one broker staff-permission cycle have local proofs below; those
do not yet make a complete recurring marketplace simulator.

Implementation sequence and gates:

- [x] Confirm the supported local topology and current service state: web3100,
  Expo8084, local Supabase55321, GT06 TCP15023 and Traccar API18082. Web and
  Expo Web can share the local API; native uses the same API through an emulator
  or LAN-reachable address. October22 explicit checks confirm the web and Expo
  previews plus local containers are up.
- [x] Audit existing baseline and event coverage. The checked-in fixture has
  no shipment/event rows, but the live local database has the synthetic
  Tracking and cargo-team records counted above. FEAT-SIM-001 distinguishes
  those two sources instead of treating fixture absence as database absence.
- [x] Restore a usable local command path and inspect the actual local runtime.
  Node22/npm are available through NVM, and Docker plus the local database are
  reachable with the approved local environment. No reset was used.
- [ ] Reconcile the confirmed local migration-ledger/schema drift before normal
  migration replay or durable worker schema. The ledger ends at129 while later
  objects are installed. Narrow 183–184 were guarded against the installed
  catalog, backed up and rehearsed on a disposable restore; they did not repair
  the old ledger. Do not infer that other files after129 are safe to replay.
- [ ] Define a stable fixture coverage gate, reuse the existing synthetic
  cargo-team, grants and Tracking records, and add only missing source-type or
  workflow examples. Keep customer-like notification delivery disabled and all
  synthetic-only badges honest.
- [x] Expand the local movement allowlist from two fixed vehicles to a curated,
  manifest-bound set of several publicly visible demo vehicles across provider
  accounts, with unique synthetic GT06 identifiers. Preserve phone and manual
  examples. Verify ownership, driver assignment, Capacity visibility/status,
  device source and existing telematics identity before changing any local row.
  The owner has authorized using current demo vehicles; this does not authorize
  production records or pointing physical hardware at the simulator. Migrations
  183–184, SQL denial tests, ten provisioned devices, three accepted ticks each,
  nine public GPS projections and one private phone projection are verified.
- [ ] Expand the exact manifest into versioned, ordered scenarios for public
  discovery; provider and driver capacity edits; phone/GPS location; manual
  static location; private sharing; shipper/broker staff permissions; and a
  shipment's status/proof flow. Reuse established API/domain commands and record
  exact actor/permission for each transition.
- [x] Add a bounded local `advance-through` runner with injected UTC cutoff,
  stable idempotency key, expected-state check, one process lock and protected
  per-step receipts. Five exact Capacity cycles saved, replayed read-only and
  returned to their baseline statuses. Area-only Empty anchors stay stable.
- [x] Add atomic database event receipts and a finite, opt-in local recurring
  supervisor with a process lock, status/stop controls and failure tests. The
  local proof saved all 14 due steps over four ticks and manually stopped a
  subsequent run. Hosted scheduling and recovery observation remain pending.
- [ ] Verify persistent marketplace workflow results on desktop web, phone web
  and Expo with the same local backend. Check saved API/database state, role
  denials, failure/restart/replay and unchanged real records. Static Manual stays
  separate from movement; native Android permission/background evidence is a
  device-only check.
- [x] Repair the October22 movement-runner state bug, add regression coverage,
  and run the exact GPS and phone targets for 60 seconds. The 30-second cadence
  produced two GPS and two phone updates, stopped both leases, persisted the
  phone location through its existing endpoint and kept both preview servers
  responsive during the run.
- [x] Verify local preview parity for the saved demo locations. Web and phone
  web show the GPS source badge under the GPS filter; Expo Web reads the same
  result from the shared local API. A signed-in synthetic driver workspace shows
  the Phone source. No native Android or background permission claim is made.
- [x] Verify a sustained local ten-target run and cleanup. After restarting the
  intended local web server, the bounded three-minute run saved two or three
  fixes for each of ten exact targets, completed with no runner failure, kept
  the public Capacity API at HTTP200 for five samples, and ended with all ten
  backend leases confirmed OFF. The earlier failed attempt's precise shutdown
  cause is still unknown; it remains a recovery case for future server
  monitoring and restart tests.
- [x] Implement and test the first local Capacity workflow adapter. It binds
  the checked-in target to the actual fixture-marked Auth user, current owner,
  active driver, LIVE vehicle and expected Capacity status before calling the
  normal `publish_provider_capacity` RPC. October22 local advance saved
  PARTIAL→EMPTY→PARTIAL without changing private visibility or Phone source.
  Replaying the first slot after the second is read-only through its protected
  receipt. The focused planner/executor suite has ten passing tests.
- [ ] Expand the persistent, deterministic worker beyond the existing Capacity,
  one driver handover and one broker grant/revoke scenario. Broad provider,
  workspace, shipment, proof and notification lifecycles remain unimplemented.
  The local schema ledger mismatch still needs a separate catalog-equivalence
  repair before any normal migration replay.
- [ ] Only after all local checks pass, prepare a separately reviewed hosted
  schedule/worker plan and GPS-host plan. One TCP host is for Traccar ingress;
  the workflow simulator needs HTTPS and does not need a TCP host. Neither
  hosted worker nor public GPS ingress is authorized by this local test request.

### Coordinated demo-world coverage — October 22 local proof

| Scenario | Current evidence | Remaining limit |
| --- | --- | --- |
| Capacity and routes | Five exact synthetic vehicles, 14 ordered daily status/load-preference/route changes, durable database leases and receipts. A finite local supervisor saved all 14 over four timed ticks and returned statuses to baseline. | Hosted activation and longer-running observation remain pending. |
| Provider–broker private sharing | One exact broker workspace saw its private feed change 0 → 1 → 0 through signed-in web API after normal grant/revoke commands; anonymous public search stayed at zero. Six fixture-marked PRIVATE vehicles plus two EMPTY vehicles are standing shares through normal provider commands. A protected backup and rollback rehearsal preceded the last two; broker API returns eight. Desktop/390px Chrome both find the intended PARTIAL Pickup and EMPTY Medium Box with no page errors or overflow. Public EMPTY Medium Box remains visible; public desktop/phone filters find five EMPTY rigid trucks with trailers and open a vehicle detail. A mobile sign-in defect was repaired: code entry now requires explicit Auth acceptance. A fresh local code reached Mailpit, and Expo Web Chrome signed in, selected the broker workspace and returned exactly one PARTIAL Pickup and one EMPTY Medium Box; both vehicle markers rendered after the map settled, with no page errors or overflow. | The rotating control is off. Installed Android broker parity remains unverified. The private set has no large/heavy vehicle. Existing heavy/trailer public rows were last updated August 28–29; all 136 LIVE fixture-marked driver/vehicle pairs occur in saved Featured slots, and no spare fixture driver exists. Do not refresh timestamps or convert a Featured vehicle directly. See [fresh heavy plan](operations/DEMO-HEAVY-EXAMPLE-PLAN.md). |
| Driver handover | One exact synthetic handover has rollback-only SQL and worker tests, disabled by default. | No recurring local handover was activated in this proof. |
| Provider profile | An exact fleet-provider headline/About cycle passed a restored-clone rehearsal and two local-preview phases through the normal command. Chrome showed original → alternate → restored public text; two receipts are complete and no email or push was added. Eight fixture-marked demo pages now have distinct new copy saved through their normal edit command; phone and desktop Chrome plus the public API show Sheger’s updated text. Migration 197 is installed on the local preview after an ownership-faithful rehearsal and separate local approval; historical receipts remain intact. | The local global/profile controls remain off. A recurring profile cycle and hosted migration, schedule and deployment remain separate. |
| GPS/phone motion | A bounded local run saved fresh locations for all ten exact demo targets (nine GPS, one Phone); all leases ended OFF, and the public GPS filter returned all nine fresh fictional GPS vehicles. | This is finite local movement, not a running hosted simulator or physical-device ingress. |
| Tracking, team and account activity | A new synthetic shipment completed Loading and Unloading with private proof and normal owner approval. A separate active synthetic GPS shipment has owner-only location and status-only viewer access; notifications are intercepted locally. One exact synthetic broker staff member signed in through Expo Web and the local team lane turned their Capacity access OFF then ON with Tracking and owner access intact; both controls are off again. | No recurring automated shipment lifecycle, hosted staff cycle, document reviews, support conversations, or broad provider lifecycle scenario is implemented. Two saved GT06 fixes crossed a 10 km privacy-cell boundary: the owner’s approximate map marker changed center while the status-only viewer still had no truck point. Web and Expo Web readback passed. Web's new session-bound Refresh passed owner/viewer Chrome checks; Expo's updated Refresh interaction remains unverified in the browser, and concurrent-viewer load is unmeasured. |

The separate exact synthetic Tracking shipment `LGX-2CB3ECBD` exists only
in the local preview and is **completed**. Its fixed synthetic Driver saved
pickup, Loading with a private watermarked image, travel and Unloading with
a distinct private watermarked image through normal web endpoints. After the
tested exact incomplete-only migration 193 was installed locally, the
synthetic owner consumed a fresh one-time code, opened both private proofs
and approved unloading through the normal endpoint. Both lifecycle controls
are off; target external mail and push queues are empty. The imported
`LGX-DEMO-0001` is unchanged.

A second exact local Demo shipment, `LGX-AB8E45BE`, remains active on Truck 02
and its selected synthetic GPS. Migration 194 was backup/rehearsal tested and
installed locally only. Six post-creation GT06 fixes reached its captured
assignment and raw coordinates moved. The normal owner and shared viewer
verified separate email-code sessions: only the owner receives an approximate
GPS point; the viewer receives route/status with no point. A later pair of
GT06 fixes crossed the 10 km privacy-cell boundary: the owner's approximate
marker visibly moved, while the shared viewer still saw only route/status.
Chrome phone web and Expo Web rendered that privacy split. The new web Tracking
control checks for saved changes each minute while a verified session is open
and visible; owner and status-only viewer Chrome Refresh requests passed. Expo
has a corresponding focused-screen reload in source with focused tests, but its
post-change Refresh interaction remains unproved in a real browser after a
test-harness panel-navigation error and synthetic OTP rate limit. Continuous
animation and concurrent-viewer load are not claimed. Global simulation is off; the exact local
notification sink stays armed to intercept future demo access codes.
No external mail or push was queued. Hosted rollout is still pending.
The owner approved the Demo Tracking route, steps, proof buttons and Demo labels
in the October 22 web/mobile preview. Agent-led phone Chrome verified the
separately added Refresh on the web for owner and status-only viewer: the owner
kept one approximate marker, the viewer none, and both received HTTP 200 with
no outbound notification change. Expo Refresh remains unverified because its
single synthetic owner sign-in attempt timed out before consuming the code;
there was no retry or customer contact. The protected local receipt records that
limit. The October 22 owner instruction permits agent-led visual review without
another owner screenshot approval; it does not waive release or hosted-write
gates.

The exact provider profile cycle also has a fresh post-GPS protected backup and disposable-clone rehearsal. Its local public page changed and returned to baseline through two normal-command profile RPCs, with Chrome readback at each stage; only `updated_at` changed, and no notification was added. The global/profile controls are off. Local evidence is retained in `.local/demo-profile-195/local-proof/review.md`.

An October 22 copy update saved eight exact synthetic provider pages through their normal edit command after a fresh protected backup. The first versioned simulator migration 197 attempt was rejected because the local preview's original table owner differs from the ordinary `postgres` session; that transaction rolled back. An ownership-faithful disposable clone then passed the exact migration and historical-receipt denial checks. The owner separately approved the exact local-only owner-role operation; migration 197 is now installed in the local preview with manifest version 2, two intact version-1 receipts, zero pending work and global/profile controls OFF. Sheger’s saved text appears in the public API and actual 390px/1440px Chrome screens. No hosted write occurred. Protected evidence is in `.local/demo-profile-197/local-owner-review.md`; profile-cycle activation remains a separate step.

The local broker staff cycle has a protected backup and disposable-clone rehearsal. Migration 196 is installed and bound in the local preview only. Two signed team-lane RPCs completed OFF then ON, leaving two receipts, no pending jobs, staff Capacity and Tracking restored, and no new email, push or private shares. The global and team controls are off; the exact Tracking notification interceptor remains armed. Local evidence is retained in `.local/demo-broker-staff-196/local-cycle/review.md`. Installed Android, browser readback during the permission change and hosted scheduling remain unverified.

The local supervisor has `start/status/stop`, a fixed local API target,
manifest checks, a finite deadline and an exclusive process lock. A manual
Stop halted a second run. Both database controls are off again; the five
targets have baseline statuses, all 14 jobs and receipts are complete, and
the broker scenario has no active rotating grant. The eight standing private
shares are independent of that scenario. See
[the local supervisor operation](operations/DEMO-WORLD-LOCAL-SUPERVISOR.md).
This is a tested slice of the simulator, not completion of FEAT-SIM-001.

Two existing synthetic heavy/trailer vehicles were refreshed locally through
normal manual-location and Capacity commands under FEAT-SIM-003: O10 is Empty,
open to full or shared loads; O09 is Partial, open to shared loads. Both retain
their Open routes and appear under their respective public filters. The O09
guarded clone replay, protected preview backup and database/API readback pass:
Heavy/Partial returns O09 alone and Heavy/Empty returns four. Desktop Chrome,
phone Chrome and Expo Web opened each relevant filtered marker and its details.
Saved Featured slots, assignments, grants, Tracking and the other heavy
signals stayed unchanged. These are dated manual demo saves, not continuous
movement or hosted updates. The owner approved the O10 Empty-heavy and O09
Partial-heavy Capacity presentations on October 22. Evidence and rollback limits are in
`docs/operations/DEMO-HEAVY-EXAMPLE-PLAN.md`.

An October 22 public vehicle-detail parity audit found that Expo omitted the
web's public Driver callback and Owner/Driver/Vehicle document summaries. The
scoped native projection/detail repair passes 23 focused tests and mobile
typecheck. Actual Chrome opened the same O09 vehicle on 390px and 320px Expo
Web, verified contact and all three review groups in English, Amharic and Afaan
Oromo, reachable Call/Close controls and private-access denial. The owner
approved this vehicle-detail presentation on October 22. Installed Android
dialer handoff remains unverified; the repair is not deployed. Protected evidence is under
`.local/launch-ux-readonly-20261022/`. A follow-up agent-led review found the
three document groups unreadably narrow in the web phone card. They now stack
as compact rows on web and Expo phones. Actual Chrome at 320/390px opened and
closed all three groups with no horizontal overflow; Expo Web did the same in
English, Amharic and Afaan Oromo. Both web Chrome regression cases, the five
focused mobile details tests and web/mobile typechecks pass. The web preview is
still local, and installed Android remains unverified for this layout.

FEAT-SIM-004 adds an exact-fixture Cargo van Off Duty/Restore scenario. Its
normal-command Manual-location/Empty-route preparation for F0105 is saved in
the local preview after a protected backup; a replay made no second save. The
public Cargo van + Empty + Manual API filter returns F0105, and nine other
unexpired mappable Empty Cargo vans remain. On a disposable clone, Off Duty,
Restore, replay, lease, wrong-actor and drift denials, last-filter protection
and failed-save rollback pass; 18 focused worker tests and spec validation pass.
After a fresh post-197 protected backup, exact migration 198 passed a
rollback-only clone rehearsal and was installed on the **local preview only**.
The new schema/function signatures match the clone. A separately guarded,
bounded local catch-up cycle then took F0105 Off Duty and restored its Empty
Manual/Public route through the normal provider command. The public filter
returned F0105 before, omitted it while Off Duty and returned it after
restoration; Featured returned eight published vehicles at each readback.
Desktop and 390px Chrome opened the restored vehicle detail and nonempty
Featured page. Two jobs and immutable receipts are DONE, with no pending work;
the duty and global controls are OFF. The route, source revision, assignment,
private-grant counts and saved Featured slot count match baseline. A natural
10:30/10:50 UTC dispatch and signed-in private broker isolation remain
unverified. The protected backup TOC passes, but ordinary-role full restore
remains unverified because unrelated Auth and
Realtime objects require other owner privileges. No hosted installation or
hosted duty cycle is claimed. CI installs/tests 198 on a disposable
database before the matching worker. Protected evidence is in
`.local/demo-duty-198/`. This is one narrow simulator scenario, not completion
of the marketplace simulator.
