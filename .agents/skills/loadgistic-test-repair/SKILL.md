---
name: loadgistic-test-repair
description: Diagnose or repair Loadgistic stale tests, fixtures, failed CI, or slow verification. Use for failed-gate diagnosis and explicit stale-test or fixture audits. Excludes unrelated apps and release execution.
---

# Loadgistic test repair

Work from this skill's repository root, not the IDE's other open project. Start
with the active section of `docs/PROGRESS.md` and `git status --short`; preserve
pre-existing edits. AGENTS.md and the latest user decision control this procedure.

Find the changed contract in `specs/` and the actual call path. Classify the
failure as product, obsolete assertion/fixture, infrastructure or tool access.
Compare inputs and saved outcomes, not just test titles or passing compilation.
Retired-feature absence/denial tests remain useful; retained historical helpers
do not establish an active feature. A test-list command does not exercise setup.

Search affected tests and their shared fixture creators together, including
gated captures, web/phone, Expo and SQL. Repair the smallest complete set before
another long gate. Preserve denial, private-data, persistence, recovery, scale,
viewport and touch-target assertions. Own synthetic fixtures and clean exact
records/uploads in finally; never borrow mutable customer records or sweep data.

Run focused cases with their actual preconditions and bounded reports. Use
`npm run check:workflow` for delivery scripts/CI and existing `npm run quality`
for the complete local gate when due. Read `docs/AGENT_LESSONS.md` only for the
relevant failure category; search the detailed regression register by its ID.
Use the browser project/config and local ports in the current checked-in setup;
verify the responding app and database target before testing. Run heavy browser
and unit gates sequentially on the Mac. After one controlled retry, diagnose.

Record reviewed, changed, tested and still-unverified files separately. Reuse
completed unchanged receipts after interruptions. Coordinate shared-file edits
with the main agent; parallel source review does not justify concurrent mutation
of shared fixtures. Start one exact-source CI only after known findings and
focused failures are resolved. Do not deploy, read secrets or broaden log access
because a test needs diagnosis. Report owner-facing results in simple language.
