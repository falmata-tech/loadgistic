---
id: FEAT-SEC-001
title: Production security checks and limited agent authority
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-IAM-001]
problem: Extension tables can inherit public grants without RLS, and administrator credentials let an agent bypass repository rules.
behavior: Production inspection uses project-scoped read-only credentials; migrations and configuration changes currently require owner execution; automated production changes are disabled. Catalog and advisor checks block unsafe releases.
contracts: [SecurityAdvisorReadPort, PublicRlsGate, OwnerRepairPlan, ProductionAuthorityBoundary]
observability: [security_finding_counts, unsafe_relation_names, approval_evidence, production_change_digest]
rollout: Verify exact targets and approved encrypted backups; repair the provider-owned table through its owner, verify browser-role denial and service geography, then run release gates. Never broaden credentials or undo a security fix as rollback.
---

# Security operations

## Scenario: public tables cannot silently omit RLS

Given a migrated database contains public application or extension tables
When the catalog gate runs
Then every public ordinary or partitioned table must have RLS enabled
And the extension-owned spatial_ref_sys table must deny PUBLIC, anon and authenticated direct privileges
And adding an unprotected table fails the gate, including on a clean CI database.

## Scenario: extension ownership is a real boundary

Given spatial_ref_sys belongs to supabase_admin and postgres has no owner membership or grant option
When ordinary migration access cannot enable RLS
Then stop that operation and prepare the exact owner-executed repair
And do not change ownership, role memberships, system catalogs or extension relocation flags to bypass it
And test the owner repair only on isolated local services before requesting the provider-side execution.

## Scenario: the routine agent cannot administer production

Given a routine advisor token is configured
When the monitoring command runs
Then it accepts only the scoped-token format, requests only the exact Loadgistic project and security-advisor GET endpoints, rejects redirects and wrong projects, and prints only finding metadata
And missing credentials, malformed responses or critical findings fail the command
And its code contains no write endpoint, arbitrary SQL or classic-token fallback.

A token prefix is input validation, not proof of its permissions. The owner must
verify the actual project and read-only scopes in Supabase. Classic management
tokens, database-owner passwords and production service keys must be unavailable
to routine agent processes. Keep production runtime keys at the runtime; emergency
backup credentials are exceptional, time-bounded and owner-controlled. An agent
using the owner's GitHub identity cannot provide independent approval.

## Scenario: owner-only production changes

Given the owner selected owner-only production changes on 2026-09-17
When no separate automation identity has been selected
Then the agent prepares and tests changes without applying hosted writes,
credential/configuration changes, protection settings, merges or deployments
And only the owner executes production changes
And the already approved read-only backups and isolated restore remain authorized
And future automated production execution requires a new owner decision.

## Scenario: one-time owner-authorized assistance

Given the owner explicitly authorizes assisted execution of the current reviewed
Loadgistic repair/release while retaining the safe workflow
When the agent performs that task
Then every target, digest, backup/restore, security and CI gate still applies
And no ownership or privilege bypass, broad settings replacement or unrelated
credential/provider change is permitted
And owner-only execution remains the standing default outside this task
And any provider ownership or failed release gate stops the dependent action.

## Scenario: reviewed production change

Given a production database or configuration change is proposed
When the owner reviews it
Then show exact account/project, immutable commit and file hashes, fields or SQL,
expected old/new state, backup/restore evidence, lock/time limits and rollback
And refuse unexpected target/state/digest or a broader replacement operation
And secret/provider, password, signing-key, billing, deletion or network changes
require their own explicit owner authorization
And broad configuration sync is prohibited, including recovery attempts.

## Scenario: monitoring and deployment controls

Given CI or a scheduled security check reports a failure
When a release is considered
Then promotion remains blocked; do not skip, mute, baseline away or weaken the check
And protect production secrets outside ordinary PR jobs; use a separate human
reviewer and a project-limited automation identity
And record which provider-side controls are actually installed versus pending.

Tests: tests/security-operations.test.mjs, tests/sql/security-boundaries.sql,
scripts/check-database-security.sql, scripts/check-production-security.mjs,
CI catalog gate and daily security-advisor workflow. Hosted ownership repair,
provider permissions and verified denial remain explicit rollout evidence.

## Scenario: browser sessions cannot bypass application commands

Given an anonymous visitor or an active or inactive authenticated identity
When it attempts direct access to a non-extension public application relation
Then table, view, sequence and column privileges deny access before legacy RLS policies
And browser sessions cannot execute the legacy organization/workspace policy helpers
And only the caller-bound current_user_projection security-definer function remains
executable by authenticated sessions among application security-definer functions
And authorized service adapters retain their existing privileges and history.

Given a later migration grants browser relation or column access, or exposes an
application security-definer function beyond the own-identity contract
When the catalog gate runs
Then the release fails even if RLS is enabled on that relation.

Migration 096 changes only application ACLs and postgres defaults for future public
tables/sequences; extension objects and provider-owned defaults are untouched.
Apply before promotion, with the reviewed backup and bounded transaction. On
compatibility failure stop promotion and fix the authorized adapter; do not restore
broad browser grants. Local rollback tests: tests/sql/browser-boundaries.sql and
scripts/verify-database-security-gate.mjs (eight unsafe catalog fixtures plus
explicit column-grant repair and repeatability).
Hosted execution and full release verification remain pending.

## Scenario: Data API requests require an approved database role and operation

Given the service uses server-authorized business adapters and a caller-bound
current_user_projection RPC for session identity
When PostgREST accepts a request
Then a SECURITY INVOKER pre-request function permits service_role requests
And authenticated requests permit only GET, HEAD or POST of the public
current_user_projection RPC, including inactive identities for access revocation
And anonymous requests, other RPCs, direct relations, GraphQL and spoofed server
headers are rejected before business SQL executes
And an unrecognized role, method, path or identity schema fails closed.

Given an existing authenticator pre-request hook or database-specific override
When migration 097 is applied
Then an unrelated hook is preserved and the transaction fails
And the approved hook can be reapplied without adding browser data privileges
And application code, geography data, extension ownership and Auth remain intact.

Given this request guard is enabled as incident containment
When operational verification runs
Then actual HTTP denial and preserved service and own-identity access are verified
And a notification or SQL commit alone is not accepted as activation evidence
And underlying RLS/ACL and advisor gates remain mandatory for application promotion
And no protection of direct SQL, Storage or Realtime is inferred from this hook.

Tests: tests/sql/data-api-guard.sql, scripts/verify-data-api-guard.mjs,
scripts/check-data-api-guard.sql, and account/fleet browser workflows with the
hook active. CI must exercise the HTTP boundary and reject hook configuration
or function-security drift. Rollout: bounded migration 097; reviewed incident
bootstrap may apply this same artifact before the ordinary migration ledger
catches up. Replay is safe. Unexpected existing hooks stop the change. On failure,
stop promotion and inspect; repair forward or use an independently reviewed safe
containment before disabling the hook. Never automatically restore open access.

Given the scheduled HTTP monitor has only the public anonymous API key
When the guard is removed, replaced, unavailable or produces an unrelated denial
Then the monitor fails without reading customer rows or using administrator access
And it checks the fixed project independently of the advisor job
And a missing key fails visibly; the schedule is not claimed installed until its
workflow is on main and its public-key variable is provisioned.

Tests: tests/data-api-monitor.test.mjs; scripts/check-production-api-guard.mjs.
