# Verify the deployed Netlify artifact

BASE-DEP-001 / FEAT-SEC-001 / NR-08 / NR-10 / NR-11.
Scope: Loadgistic only. This runbook grants no production authority; follow
[PRODUCTION_AUTHORITY.md](../PRODUCTION_AUTHORITY.md).

## Required release checks

Prerequisite for visible changes (NR-13): provide a running local Loadgistic URL
with local services, focused desktop/phone evidence and an interaction checklist.
Wait for explicit owner visual approval of that version before full release
gates or deployment. Earlier deployment permission and passing automation do not
replace this approval. Keep the local preview available during review.
The sequence is local owner visual testing, explicit visual approval, extensive
tests, then deployment only when explicitly requested. Visual approval by itself
does not authorize publication.

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
4. Inspect the final function ZIP, not just the intermediate build directory.
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
   discovery, filters and chat; verify an
   existing synthetic pilot's authenticated workspace and account security.
   Click the private-document control, compare returned bytes to the expected
   synthetic document and confirm an unauthenticated request is denied. Keep
   credentials, session cookies and document content out of evidence logs.
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
