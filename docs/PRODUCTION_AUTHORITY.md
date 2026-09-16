# Production authority and security operations

FEAT-SEC-001 / BASE-DEP-001 / ADR-063. Scope: Loadgistic only.

## Current finding and limits

Live checks on 2026-09-16 identified one ERROR: RLS disabled on
`public.spatial_ref_sys`. Catalogs confirmed anonymous SELECT/INSERT/UPDATE/DELETE
privileges, PUBLIC SELECT, and table ownership by `supabase_admin`. The connected
`postgres` role is not a member of the owner role and has no SELECT grant option.
The ordinary-role repair failed on local services with the same ownership.
No customer-row read or exploit write was used to establish exposure. This is a
PostGIS coordinate-reference table; these findings do not establish customer-data
compromise or prove that other policies have no defects.

The 15 warnings cover PostGIS in public, publicly executable SECURITY DEFINER
helpers/extension functions and leaked-password protection. Eighteen informational
findings concern RLS enabled without policies; for server-only tables that is an
intentional deny-by-default state, not a reason to add permissive policies.
Warnings still need individually documented review. Do not suppress them wholesale.

No hosted repair or provider permission change has been made. The owner approved
one encrypted database/private-file backup and isolated restore. Both exports
passed authenticated recovery; the full database restored in a network-disabled
disposable container and the private object passed local Storage restore/hash
comparison. Both rehearsals cleaned up their restored data. Recovery keys are
protected local files; separate owner custody remains to be established.

The two ignored legacy bulk writers (Netlify environment replacement and linked
database push) now stop immediately before loading credentials or invoking tools.
Their old code is retained for review; this prevents accidental execution, not
a same-user bypass. Routine use of
broad credentials must end after recovery access and limited replacements are
verified; no current credential has been revoked or deleted.

## Current operating mode — owner-only production changes

On 2026-09-17 the owner selected **owner-only production changes for now**. No
automation username is selected or required to continue local preparation. The
agent may prepare, test and review changes and perform authorized read-only
inspection/backup. The owner executes hosted database, credential, configuration,
repository/environment protection, merge and deployment changes. Do not use the
current administrator session to automate those actions. The identity/protection
proposal below is future setup, not permission to install it now.

This is the current operating rule; technical credential separation is still
pending. An independent automated approval boundary is not claimed.


## One-time assisted release exception — 2026-09-17

The owner subsequently asked the agent to perform the reviewed repair/release
work "just for now" while preserving the safe workflow. This is a task-limited
exception, not permanent administrator authority. It permits publishing the
prepared changes to draft PR #15, running and fixing required CI, and carrying
out the reviewed Loadgistic repair/release steps only when their prerequisite
evidence passes. Preserve exact target/digest checks, tested backup/restore,
independent postchecks and the stop-on-ambiguity rule. Do not bypass Supabase
ownership, broaden privileges, replace settings in bulk, or deploy past a failed
security/release gate. No unrelated credential/provider changes are authorized.
Owner-only execution remains the default after this task or if a prerequisite
requires provider intervention. Separate coding identity remains unselected.

## Authority boundaries

| Actor | Allowed authority | Excluded authority |
|---|---|---|
| Routine coding agent | Local fixtures and tests; repository branch/PR; exact-project security metadata | Hosted SQL writes, production administration, secrets/configuration changes, merge/protection bypass |
| Advisor monitor | Scoped PAT: only Project Settings Read and Advisors Read for `tpwyyzoqijjmbvsmmvcm` | Database/query, Auth, API-key secrets, signing keys, backups, billing and all writes |
| Application runtime | Existing application service key only inside its production runtime | Management PAT, database-owner password, GitHub/Netlify administrator credentials |
| Owner release operator | Exact reviewed change in an isolated, protected execution environment | Unreviewed changes, broad configuration replacement, unrelated projects |
| Supabase table owner/support | Exact PostGIS RLS/ACL repair in the attached SQL | Ownership transfer, role expansion, extension recreation, application-data changes |

Supabase recommends scoped PATs for agents. Scoped tokens are in gradual public
alpha rollout; if unavailable, do not substitute a classic PAT for the monitor.
The dashboard Read-Only role is plan-limited and can still expose secrets; it is
not equivalent to the two metadata-only scopes above. Use owner-run checks until
suitable scopes exist. Token format checking is not a permissions attestation.

A shell running as the owner can read that owner's files and invoke their saved
administrator sessions. `.local`, `.gitignore`, file mode 0600, command wrappers
and these rules do not prevent that. Run the agent as a separate OS/container
identity with no mounts of production credentials, backup keys, owner CLI sessions
or Docker socket belonging to the owner's environment. Local fixture Docker access
belongs in its separate development environment. Remove broad credentials from
that environment only after the owner verifies recoverable administrative access.
Do not rotate application runtime keys blindly or change global credentials here.

## Owner setup checklist — not installed yet

1. Create a project-only PAT with the two read scopes, short expiry and a rotation
   owner. Verify the selected project/scopes in Supabase; do not paste it in chat.
   Store it as GitHub secret `LOADGISTIC_ADVISOR_READ_TOKEN` and in the separate
   monitor environment. The monitor never reads `.local/supabase-access-token`.
2. If the owner later enables automation, give it a separate repository identity/token with only necessary
   branch/PR permissions, no repository administration and no production secrets.
   Keep workflow changes owner-reviewed. Do not share the owner's `gh` session.
3. Protect `main`: require `validate`, `e2e`, `container`, an up-to-date branch,
   conversation resolution and independent review; dismiss stale reviews, require
   approval after the last push, enforce administrators, disallow force-push/delete.
   Protect security scripts, workflows, migrations and this contract with owner
   review. The exact proposal is `operations/repository-protection-plan.json`.
   An agent and human using the same GitHub account cannot provide independent
   review; establish the separate identity before enforcing a gate that locks out
   the sole owner. CODEOWNERS text without required code-owner review is insufficient.
4. Configure a production environment with owner reviewers, no self-review, no
   admin bypass and protected-main-only deployment. Put write credentials there,
   never in ordinary PR jobs. Require review of the immutable artifact and prevent
   the coding identity from changing environment/ruleset settings. Keep Netlify
   production promotion owner-controlled until this boundary is installed.
5. Verify intended denials with harmless metadata/permission checks, not destructive
   probe writes. Revoke the superseded classic PAT/agent admin access only after
   verifying the replacements and owner recovery. Retain a dated access inventory.

The repository is public, so GitHub environment reviewers are supported by the
currently documented plan rules. Actual protection configuration and an independent
reviewer remain pending. No guessed user or bot was granted permissions.

## Exact PostGIS containment

Send the prepared `operations/SUPABASE_SECURITY_REPAIR_REQUEST.md` to Supabase
support using the owner's account. The agent has not sent it. The attachment is
`operations/spatial-reference-owner-repair.sql`. It enables RLS and revokes direct
PUBLIC/anon/authenticated table grants in one transaction, with 5-second lock and
20-second statement limits, exact extension membership checks and postconditions.
It preserves service access and all rows; it does not change ownership or relocate
PostGIS. The normal postgres credential cannot apply it on this project.

The same SQL was tested as the actual owner on isolated local services. Before
repair, the catalog check failed. After repair, it passed; actual anon and
authenticated SELECT/INSERT/UPDATE/DELETE attempts were denied, and service-role
reference lookup and coordinate transformation succeeded. All test writes roll back.
Supabase must verify the target before owner-side execution. Afterward, independently
rerun the hosted advisor and catalog check and verify public capacity plus approved
private workflows. Keep this issue open until those hosted checks pass.

No rollback may re-open browser write access to the reference table. If compatibility
fails, stop promotion and investigate service grants/functions; do not disable RLS,
drop/recreate the extension or restore broad database/configuration state.

## Repeatable release workflow

1. Inspect: exact project/account, current commit/ledger, live advisors and catalog
   metadata. Never assume the email's snapshot is the current state.
2. Prepare: reviewed specs, exact SQL/configuration fields, immutable SHA-256
   manifest, expected old/new values, lock/time limits, dependencies and rollback.
3. Verify locally: clean migrations, provider-owned setup, catalog gate, role denial,
   affected workflow tests and required CI. An extension-owned object is not exempt.
4. Back up: approved encrypted database/private files and authenticated recovery;
   rehearse an isolated restore. Store recovery keys under separate owner control
   for ongoing operations. A failed dump or decryption check is not a backup.
5. Owner approves the concrete plan. Neither a digest nor an earlier broad deployment
   request grants authority for unrelated changes. Secrets/providers/SMTP/signing
   keys/network/deletion/billing each require explicit approval and recoverable state.
6. The owner applies only the reviewed change in the current owner-only mode. Reject mismatched
   target/state/hash; stop after a timeout or ambiguous response and inspect before
   another write. Never `supabase config push` or broad Auth REST replacement.
7. Recheck hosted schema/advisors, permissions, health and real application workflows.
   Promote only after gates pass; retain sanitized evidence and limited rollback.

CI runs the public-table gate after the explicit local owner step. A daily workflow
runs the read-only advisor monitor and fails on any WARN/ERROR or unavailable data.
It is not active until merged to main and provisioned with the scoped token; the
owner must enable/check failed-workflow notifications and respond to findings.
Rerun catalog/advisor checks after every migration and extension update. These
controls reduce recurrence and detect drift; they cannot guarantee zero future bugs.

## Sources checked 2026-09-16

- [Supabase scoped personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens)
- [Supabase access control and plan limits](https://supabase.com/docs/guides/platform/access-control)
- [Supabase database advisors](https://supabase.com/docs/guides/observability/advisors)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase PostGIS setup](https://supabase.com/docs/guides/database/extensions/postgis)
- [GitHub environment protections](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
