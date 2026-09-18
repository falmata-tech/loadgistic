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

## How to use and maintain this register

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
