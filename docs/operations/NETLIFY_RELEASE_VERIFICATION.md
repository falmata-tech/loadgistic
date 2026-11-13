# Verify the deployed Netlify artifact

BASE-DEP-001 / FEAT-SEC-001 / NR-08 / NR-10 / NR-11 / NR-69.
Scope: Loadgistic only. This runbook grants no production authority; follow
[PRODUCTION_AUTHORITY.md](../PRODUCTION_AUTHORITY.md).

## Current checkpoint — November 13 UTC

PR33's exact scan-exception/source guard and PR35's final bundle verification
are merged. PR35 merged as63cbb868 after all16 exact-head PR jobs passed. Separate
main CI43344733398 failed isolated Featured team startup before migrations; safe
diagnostics identify a port-binding conflict, with exact port/owner unknown.
Delivery correctly withholds production. NR-79's early disposable-runner port
reservation passed actual focused run43346969178, including startup/security and
three desktop plus three phone tasks without skips/retries. Exact PR/main and
automatic publication still require their own terminal evidence.

Netlify's production branch is now production, saved and independently read back;
production-only branch builds, untrusted-preview approval and automatic publishing
ON were retained. Arming before first qualified ref creation allows the Git
webhook to be exercised by that push. It changes no source/CI gate. Published
6af4f16a16aab2cef815c573 remains live and the rollback target. No new production
publication has occurred at this checkpoint; record final run/deploy receipts in
the release PR rather than a further status-only CI commit.

Cloud Chrome reviewed the older public app's filters, selection/details/back,
guest private-Capacity denial and Featured/provider profile. This does not
qualify a new candidate. PR35 preview6af65f2dee0414fbc504e277/head227297c completed
all provider stages with adapter5.16.6. Its actual onPostBuild callback verified
all8 final function ZIPs against FUNCTIONS_DIST after bundling and before
deployment: root layout and nodeBundler none pass, zero private entries; the
Next ZIP SHA256 is55f1cea41d86cd689e43b8a50d1fe33f99894146323da2e992262da76e45f396.
The earlier downloaded public/edge archive contains no Node ZIPs and is not that
proof. The preview still renders a server exception; health503 identifies absent
production-only configuration. Packaging success is not runtime readiness.
Do not copy production-only secrets into previews or infer app success from200.

Provider branch activation is installed; actual production handoff/publication
and new scoped credential creation remain pending. Preserve all runtime gates.

## Historical installed pipeline readback — November 12

Site `loadgistic-473` / `dbb0fcec-9ec9-4511-9737-db0e32849af5` is linked to
`falmata-tech/loadgistic`. Builds are Active; main is the production branch and
**automatic publishing is ON**. The build command is `npm run build`, publish
`.next`, functions `netlify/functions`. The latest automatic main attempt,
[6af61dc3ec2aa1b4a433776c](https://app.netlify.com/projects/loadgistic-473/deploys/6af61dc3ec2aa1b4a433776c),
compiles with Node 22.16.0 / npm 10.9.2 but fails secret scanning. Successful manual
deploy6af4f16a16aab2cef815c573 remains Published / Production. Neither a repository
provider label `manual` nor green GitHub checks establishes automatic deployment
success. These are provider UI readbacks, not an independent ZIP-byte comparison.

The scanner names `LOADGISTIC_SMTP_USER` and earlier builds name
`LOADGISTIC_EMAIL_REPLY_TO` in dated operational documents and telematics
manifest/tests, plus `apps/mobile/google-services.json:18`. The latter is Android
Firebase client configuration, with no private-key/service-account fields. Later
Chrome review verified the exact key, its25-API allowlist and absent application
restriction. The separate hardening gap remains visible below. Do not print values.

Before changing the installed pipeline, prepare a reviewable correction:

1. Verify each finding's purpose, distribution and restrictions. Keep actual
   private credentials out of source and build output; follow the incident
   procedure if that inspection establishes exposure.
2. For a confirmed public setting/client configuration, document the narrowest
   exact exception supported by Netlify, with its reason and verification.
   Never disable the scanner or omit whole docs/scripts/output directories.
3. Specify how an exact successful main CI/artifact is promoted under the owner's
   production authority. At that initial readback no promotion
   job or same-commit wait was observed; PR33 subsequently installed the source
   gate described below, while provider activation remains pending.
   Preserve PR-preview credential isolation and rollback controls.
4. Review that concrete configuration before applying hosted settings, then
   qualify the resulting preview, scan and promotion with the checks below.

At that initial inspection no exception, secret, environment scope or publishing
setting was changed. Later source/preview changes are recorded above and below. [NR-75](../SECURITY_REGRESSION_REGISTER.md#nr-75--green-github-checks-conceal-a-blocked-automatic-publication-path)
owns this discrepancy. Netlify's [secrets controller reference](https://docs.netlify.com/build/environment-variables/secrets-controller/)
documents narrow exclusions; its existence does not approve one for this app.

## Reviewed delivery correction and activation

Current source preparation addresses NR-75 without changing application inputs.
The actual c957a60 main run passed all16 jobs, while its automatic Netlify build
6af61dc3ec2aa1b4a433776c failed scanning. Published deployment
6af4f16a16aab2cef815c573 remains the rollback target. Provider branch activation
has now been applied; actual post-activation publication is not yet established.

| Boundary | Exact change / retained control |
| --- | --- |
| Netlify production branch | Applied/read back: `main` → `production`; repository remains falmata-tech/loadgistic; production-branch-only builds and existing Deploy Preview approval/secret isolation retained. |
| Automatic publishing | Remains ON. The new source prebuild rejects production from main and independently requires a complete successful current-main CI run and matching production ref. |
| Delivery ref | After successful main push CI, the workflow creates or fast-forwards only refs/heads/production to that exact SHA. All16 jobs, latest attempt, same repository/workflow and current main are rechecked. No forced history or broad credential is used. |
| Build command | Versioned command runs check-netlify-scan-exceptions.mjs before npm run build. Provider build/runtime settings otherwise stay unchanged. |
| Normal scan omission | Only LOADGISTIC_SMTP_USER and LOADGISTIC_EMAIL_REPLY_TO; a changed actual value fails the prebuild digest check. Passwords, API/runtime secrets and other keys remain scanned. |
| File scan omission | Only apps/mobile/google-services.json; its exact reviewed bytes must match the policy digest. Any edit, including a new private field, stops the build until separately reviewed. No directory is omitted. |
| Supabase monitor | New seven-day token for tpwyyzoqijjmbvsmmvcm only, Project Settings Read + Advisors Read. Store only as LOADGISTIC_ADVISOR_READ_TOKEN in this repository's Actions secrets; no classic/admin token or local credential file. Creation requires action-time owner confirmation. |

The Chrome key review matched the actual Android key to the source and found25
allowed APIs, with no Android-app restriction. The selected list excludes
Generative Language API. Application restriction and unused-API hardening still
need certificate/SDK compatibility evidence; this correction changes no Google
key, service account, native signing or Firebase rule. A client-configuration
exception is not blanket security clearance.

Activation order (steps1–2 and provider branch arming completed for PR35):

1. Qualify the exact PR, including the Netlify Deploy Preview and all required CI.
2. Review the exact provider field above and the candidate. Keep scanner and
   source guards enabled. A premature merge remains fail-closed on main.
3. Arm production as Netlify's production branch before the first qualified ref
   creation, preserving preview/secret scopes. This ordering lets the first push
   test the webhook; it grants no permission to publish failed or unqualified CI.
4. Merge the qualified source under the owner's authorization. Verify main CI
   and the delivery workflow's actual destination/readback. Do not label a
   prepared workflow or dry run as an installed/working promotion.
5. Verify the resulting automatic exact-source build and all runtime checks below;
   source qualification alone does not certify the generated adapter package.
6. If deployment/runtime checks fail, retain the failure and restore the existing
   verified application through the reviewed rollback control. Do not force the
   production Git ref backward, replay schema or alter broad environment settings.
7. After separately confirmed token creation/storage, run the existing strict
   advisor workflow. Missing-token failure must become actual metadata readback;
   the known WARN findings remain visible and the threshold stays unchanged.

Read-only dry run: the new policy inspected actual main c957a60 and run43298031258
with all16 jobs and reported DRY_RUN_CREATED. It made no reference write. Negative
tests cover wrong/foreign/PR sources, missing/duplicate/skipped/failed jobs,
moved main, non-fast-forward history, API denial/unavailability, modified public
configuration and ambiguous write/readback failures. Raw values are never logged.

Primary references: [Firebase API keys](https://firebase.google.com/docs/projects/api-keys),
[Netlify scan controls](https://docs.netlify.com/build/environment-variables/secrets-controller/),
[GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
and [scoped Supabase tokens](https://supabase.com/docs/guides/platform/personal-access-tokens).

## Runtime release checks

Prerequisite for visible changes (NR-13; owner update October 22): keep a running
local Loadgistic URL with local services, focused desktop/phone/Expo evidence and
an interaction checklist. The agent must complete and record actual browser
tasks and saved-result checks before full release gates. Ask the owner only when
a product decision or access is unresolved. Keep the local preview available.
The sequence is focused tests, agent-led visual/workflow review, extensive
tests, then deployment only under the owner's explicit request and the separate
production authorization gates. Self-review does not authorize publication.

1. Bind the release to an immutable Git commit with successful required CI.
   Export only that commit into a fresh directory; compare every source blob
   against Git. Do not build from a dirty working tree containing credentials,
   backups or unrelated local files.
2. For an export nested under a working repository, mount only the export into
   an isolated build container at `/app`. Do not mount the parent workspace.
   Record the image digest, Node version, CLI version and resulting adapter
   version. Use the locked application dependencies.
3. Run the maintained Netlify build/deploy lifecycle against the exact site,
   initially creating an unpublished draft. Do not upload the full restored
   `.next` directory as static content or alter generated adapter code manually.
   For a prebuilt/no-build upload, prove which configuration the installed CLI
   actually consumes. Its root configuration may omit adapter-generated image
   routes. Preserve the exact build's required routing explicitly and compare
   the semantic delta; do not substitute all generated settings or assume an
   unsupported CLI flag works. Keep the frozen payload unchanged.
4. Inspect the final function ZIP, not just the intermediate build directory.
   Managed Git builds now run the local verify-function-bundles plugin at
   onPostBuild, after function bundling and before deployment. It reads actual
   ZIPs without extraction/execution; checks bounded integrity, safe/private
   paths, root run-config/BUILD_ID, included relative handler imports, matching
   root tracing/app layout and the adapter's nodeBundler none manifest; then
   logs only ZIP digests, sizes/counts and fixed booleans. Any missing verifier,
   package or failed check stops deployment. Observe its actual provider marker
   NETLIFY_FUNCTION_BUNDLES_VERIFIED; unit tests alone do not qualify a build.
   See the [Netlify lifecycle](https://docs.netlify.com/extend/develop-and-share/develop-build-plugins/).
   Confirm the adapter's `nodeBundler: none` manifest is respected, its module
   paths resolve to included files, and `run-config.json` is in the expected
   runtime location. Reject private files. Record the ZIP hashes and verify
   Next's tracing root and relative application directory match the isolated
   build. A compilation success alone does not satisfy this check.
5. Independently read the draft's site ID, state and deployment context. Exercise
   its actual cold start and health endpoint. A draft lacking its required
   runtime configuration is not proof of a working production release; do not
   broaden environment scopes to make a preview pass without owner authority.
   When credentials are intentionally production-only, record the draft as a
   packaging/cold-start check, validate the compiled server locally with protected
   configuration sources, and reserve full readiness and browser acceptance for
   the monitored production rollout. Netlify masks secret reads: a masked value
   is neither a working credential nor a recoverable backup. Record any local
   credential-source substitution explicitly; only the production check proves
   the values actually loaded by the provider.
6. Before declaring the release successful, verify desktop and phone public
   discovery, filters and any affected software-support flow; verify an
   existing synthetic pilot's authenticated workspace and account security.
   Click the private-document control, compare returned bytes to the expected
   synthetic document and confirm an unauthenticated request is denied. Keep
   credentials, session cookies and document content out of evidence logs.
   Exercise actual optimized vehicle images at two supported widths; direct
   source-image200 is insufficient. Confirm invalid/nonimage requests are denied
   and private-file URLs cannot be laundered through the image proxy or cache.
   Inspect fully decoded images and image request errors in desktop/phone Chrome.
7. Recheck database/application security, the API guard and required service
   access. Any narrowly approved exception must remain separately visible;
   do not mark an unchanged failing security gate as passing.
8. Promote only the verified artifact under the existing approval. Independently
   confirm the published deployment ID, then repeat production health and
   browser checks. Record runtime warnings and any untested external flow.
9. If runtime verification fails, stop publication work and inspect. Restore
   the previous known working application under the reviewed rollback plan;
   retain database containment and do not replay completed migrations or broad
   configuration changes. Retain both the failure and rollback receipts.

## September 20 incident

The first manual publication of commit `6b3d6cd` failed with HTTP 502 because the
server tried to read `/run-config.json`. Its source export was nested under the
working repository, and Next inferred the parent workspace. Local intermediate
packaging and the published runtime did not agree. Deployment
`6ab03906b83e9eec579c7bc0` was rolled back to `6aa4758a983dd22ae01fe98c`;
health returned HTTP 200. Migrations through 097 and the API guard were retained.

The corrective release uses a code-only Linux export with `/app` as its verified
tracing root and an empty relative application directory. Draft/runtime and
production evidence must be recorded in [PROGRESS.md](../PROGRESS.md) before
this corrective release is called complete. These operational checks are not
claimed to be an independently enforced provider permission boundary.
