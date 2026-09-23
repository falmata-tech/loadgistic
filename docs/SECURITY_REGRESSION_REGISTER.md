# Security failures we must not repeat

FEAT-SEC-001 / ADR-063–065. This register turns security lessons into required
review and negative tests. It includes observed failure classes and related
regression risks; it is not a claim that every listed risk caused an incident
or that any customer data was compromised. IDs are stable: append new lessons
instead of renumbering or deleting them.

## Required lesson checks

| ID | Failure or risk and cause | Prevention and evidence | Responsible role |
|---|---|---|---|
| NR-01 | A public application or extension table is reachable without RLS. Installation defaults and extension ownership were mistaken for security guarantees. | Inspect every resulting public ordinary/partitioned table. `scripts/check-database-security.sql` includes extension tables; its injected missing-RLS fixture must fail. `tests/sql/security-boundaries.sql` proves reference-table denial and preserved service geography. Owner-only extension repair is separate from API containment. | Migration author; release owner |
| NR-02 | Browser access returns through broad grants, PUBLIC inheritance, column ACLs, views, sequences or future defaults. RLS alone is treated as permission to expose a second application command path. | Migration 096 removes application grants/defaults. `tests/sql/browser-boundaries.sql` covers active/inactive sessions and future objects. `scripts/verify-database-security-gate.mjs` injects table, column, PUBLIC, view, sequence and future-default exposure and requires rejection. | Migration author; CI maintainer |
| NR-03 | A SECURITY DEFINER helper becomes a public endpoint, including through default EXECUTE grants. | Explicitly revoke browser execution except the caller-bound identity contract. The catalog gate rejects unexpected browser-callable application definer functions; the negative verifier creates a new default-executable definer to prove rejection. Never use a caller-supplied actor ID as identity. | Database/API author |
| NR-04 | A request hook is removed, replaced, runs with owner rights or trusts a forged service header. | Migration 097 uses the actual invoker role and a narrow identity path/schema/method allowlist, refuses unrelated hooks, and preserves service access. `scripts/verify-data-api-guard.mjs` exercises SQL roles, real REST/GraphQL and unsafe configuration fixtures; the anonymous HTTP monitor requires the exact denial response. | API author; operations owner |
| NR-05 | A successful hook test is misreported as full database repair, or assumed to protect another access path. | Keep RLS/ACL and advisor gates independent. Inventory exposed schemas, direct login roles and replication publications before rollout. Separately review Storage and Realtime. Record containment, permanent repair, app release and active monitoring separately. | Release owner |
| NR-06 | A broad remote configuration operation overwrites unrelated Auth/provider/SMTP settings, or a timeout causes a duplicate write or blind restore. | No hosted config push/bulk replacement. Require exact target, old/new fields, immutable digest, protected recoverable snapshot and bounded execution. On ambiguity stop writes and inspect. `docs/PRODUCTION_AUTHORITY.md` defines the owner workflow; repository text cannot constrain an unrestricted administrator shell. | Owner executing the approved operation |
| NR-07 | “AI guardrails” exist only in prose while the same identity retains administrator credentials; a monitor is granted write authority. | Separate runtime, read-only monitoring and owner deployment credentials. Advisor tests reject classic-token fallback, wrong projects, redirects and malformed findings. HTTP monitor tests reject service credentials and use row-free anonymous GETs. Provider/OS credential separation and independent approval must be installed and verified by the owner; a filename/token prefix is not proof. | Account owner |
| NR-08 | Release readiness is claimed using an old commit, a backup never restored, a scheduled file not installed, or a generic permission error masking a broken guard. | Bind checks to the exact commit and artifact hash. Restore the exact encrypted archive in isolation. Verify real API and browser behavior. Monitor tests fail on open endpoints, unrelated denials, missing configuration and unavailability. Record workflow installation and successful execution independently. | Release owner; CI maintainer |
| NR-09 | Account closure removes login UI access but stale tokens or retained membership still authorize writes; history is deleted during “cleanup.” | Recheck active actor and tenant authority at mutation boundaries; retain history and deny browser database shortcuts. Run `tests/sql/browser-boundaries.sql`, `tests/sql/account-security.sql`, `scripts/verify-audit-concurrency.mjs`, and account-security browser workflows. | Identity/domain author |
| NR-10 | Customer files, credentials or backup content leak through public storage, browser code, logs or build context. | Keep server credentials server-only, reauthorize private reads, and exclude local credentials/backups from images. Run `tests/private-storage.test.mjs`, `tests/sql/tracking-proof-access.sql`, relevant attachment tests, and the CI container-context canaries. Never log tokens, OTPs, customer rows or recovered backup contents as evidence. | Storage/runtime author; release owner |


| NR-11 | A successful build is published with a broken server bundle because a nested checkout changes workspace tracing or deployment tools repackage the adapter incorrectly. | Build an immutable code-only export with no parent workspace; verify the final uploaded function retains its adapter manifest, runtime configuration and module paths. Exercise a cold start on the provider before publication, then verify production health and desktop/phone workflows. Keep the previous working deploy available; preserve database containment during application rollback. September 20 attempt 6ab03906b83e9eec579c7bc0 failed runtime verification and was rolled back; corrected release evidence must be recorded before closure. | Release owner; CI maintainer |

| NR-12 | A pilot importer writes raw object paths that the authorized private-file reader cannot resolve. Backup restoration and row counts alone miss broken visible document controls. | Import the canonical private-storage URI, exercise the importer mapping through the private reader, and click the deployed document control with exact-byte and guest-denial checks. Repair only the reviewed fixture-tagged record set, with drift checks and recovery; never rerun the bulk seed or loosen the reader to accept arbitrary paths. PILOT-FILE-001 affected 335 synthetic records; the owner approved the bounded repair, it was applied and independently verified, and desktop/phone document bytes and guest-denial checks passed on September 21. | Fixture/import author; release owner |

| NR-13 | A performance fix changes appearance or adds user steps without approval; specs/tests are rewritten to accept it and passing CI substitutes for owner review. | Preserve the original workflow and result completeness; keep server mechanics internal. Require approval of a specific UX tradeoff before implementation, and a running local desktop/phone review before UI deployment. See [map incident and open repair checklist](MAP_PERFORMANCE_REGRESSION_2026-09-21.md). Local restoration removes the manual modes/loading controls; 13 focused unit and six desktop/phone browser cases pass. Owner visual review and extensive release gates remain pending; no corrective release. | Implementing agent; release owner |

NR-02/03/09 onboarding check (2026-09-21): assignment eligibility must not become
proof of email ownership. Migration 099 leaves Auth email unconfirmed and denies
unverified caller-bound workspace projection; owner registration cannot adopt an
existing provider, another fleet, suspended or reserved identity. Its preparation
and registration RPCs explicitly deny browser execution. The rollback-only
`tests/sql/driver-preverification.sql`, legacy invitation regression and catalog
gate pass locally; desktop/phone real-OTP workflows confirm login preserves the
prior assignment. No auto-confirmation, password creation or owner-accessible
Driver session. Owner: identity/migration author. Next: owner visual review, full
release gates and separately authorized rollout.

NR-08 backup lesson: a timed-out exporter may still return a zero process status
or leave an authenticated but incomplete encrypted archive. Treat a timeout as
failure independently of exit status; fully restore the exact archive before it
can satisfy the release gate. The September 20 truncated export was rejected by
restore, preserved as invalid, and replaced with a fully restored archive before
migration. Owner: backup/release operator.

### Featured rotation check — 2026-09-21

NR-01/03: migration 098 creates its selection ledger with RLS and explicit browser privilege revocation in the same transaction. Only the existing service-authorized generator writes history; browser execution remains denied. The rollback-only `tests/sql/featured-random-rounds.sql` and resulting catalog security check passed locally. Saved-roster fingerprints were unchanged after local application, and a separate two-session check confirmed concurrent generation returns without writing while the advisory lock is held. CI now includes the regression; hosted execution is not claimed. Owner: migration/release author. Next: owner UI review, full release gates and separately authorized rollout.

## How to use and maintain this register

NR-04/NR-05 relocation lesson: a guard monitor must probe stable application
relations rather than require an extension table to remain in an exposed schema.
The relocation regression in `tests/data-api-monitor.test.mjs` still rejects
missing application routes, unrelated denials and open endpoints. Before moving
an extension, verify its target schema, data, dependent types/functions/indexes
and application queries; retain separate evidence for a logical-copy rehearsal
and the provider's actual in-place execution. Never broaden exposed schemas to
make an obsolete monitor URL pass. Owner: release operator and CI maintainer.

1. Before a sensitive change, identify the affected IDs and linked specifications.
   Review all objects created by an extension or migration, not only named app
   tables. An ownership error stops that operation; it is not permission to
   escalate roles, edit catalogs or delete/rebuild dependencies.
2. Run the relevant negative tests and compatibility checks. CI enforces the
   catalog and request-boundary tests on a clean migrated database. Missing,
   failing or unavailable required checks cannot count as success.
3. In the PR, record exact-commit evidence and applicable IDs. For a new defect,
   append an ID with cause, preventive control, test/probe, responsible role and
   any unresolved next action. Do not put secrets, customer records or private
   support correspondence in this register.
4. Record operational state in the protected rollout evidence and project
   progress: implemented, locally verified, CI verified, hosted verified,
   scheduled monitoring active, and provider enforcement installed are different
   claims. Each requires its own evidence. Deferred setup keeps its owner and next
   action visible; a checked documentation box cannot substitute for deployment.
5. After any incident, contain access first, preserve history, inspect the full
   related access surface, add the regression, and verify recovery before release.
   Never suppress the alert or weaken the test to mark the lesson closed.

## Enforcement limits and remaining setup

Repository tests detect these classes during verification; they cannot stop an
administrator from making a direct out-of-band change. The API guard contains
one access path, not every database service. Scheduled monitoring requires its
workflow on the default branch and configured credentials; a missing token must
remain a visible failure. Independent owner approval requires a separate coding
identity and provider protections, not two actions by the same administrator.

The account owner is responsible for installing that credential/approval
separation, activating monitoring and verifying notification delivery. The release
owner records those outcomes in `docs/PROGRESS.md` and the protected operational
evidence. No assertion that these controls are installed may be inferred from
this register. No system can promise that a security issue will never recur;
the required outcome is prevention where possible, detection, bounded authority
and a tested response when a control fails.


| NR-14 | Demo email correction is undone by a later seed, affects a real identity, or forwards automated mail to real recipients. | Bind corrections to exact Auth IDs, fixture markers/keys and old/new email digests; rehearse profile synchronization/rollback and retain roles/history. Preserve authoritative existing email in additive imports (`tests/production-pilot-policy.test.mjs`), keep plus aliases distinct (`tests/auth-flow.test.mjs`), and scope local relay matching/manual release to the owner-approved recipient pattern with relay-all off. Keep inbox and external-delivery evidence distinct. See `docs/operations/DEMO_ACCOUNT_EMAILS.md`. | Fixture/identity maintainer; operations owner |
