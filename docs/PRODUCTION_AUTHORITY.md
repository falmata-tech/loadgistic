# Production authority and security operations

FEAT-SEC-001 / BASE-DEP-001 / ADR-063. Scope: Loadgistic only.

## Demo email correction — 2026-09-23

After release completion, the owner explicitly requested unique plus-addresses
at their Gmail inbox for all demo identities. This separately authorized the
bounded email-only correction of 152 fixture-tagged live accounts in
`tpwyyzoqijjmbvsmmvcm`; it did not reopen deployment or hosted settings authority.
The exact protected plan, local update/rollback rehearsal, collision/drift checks
and all-account postchecks passed. IDs, roles, confirmation state and history
were retained; two untagged live identities were excluded. Local-only Mailpit
relay is restricted to the owner demo aliases; no hosted SMTP/Auth configuration
was changed. The operation is complete and grants no ongoing write authority.
Actual Gmail delivery confirmation remains separate. See
[demo email operations](operations/DEMO_ACCOUNT_EMAILS.md).

## September 23 release completed

Commit `200c783` is independently verified live as Netlify deployment
`6ab3aaa9668f9644dcba97d8` on the existing Loadgistic site. CI `35843724742`,
backup/restore, bounded migrations 098–101, security checks, immutable packaging
and live desktop/phone/private-file checks pass. The scoped authorization below
is consumed. Owner-only remains the default for future production changes.
UIA-23 is a recorded map styling follow-up, not permission for another rollout.
No hosted Auth/provider/credential setting was changed.

## Current release authorization — 2026-09-23

Latest owner instruction: “ok go ahead and fix deploy,” following the demo risk
assessment and local review request. It accepts the presented login, Clear all
and first-Driver corrections and authorizes the identified demo corrections
(pending verification guidance, exact ETB amounts and self-contained completion
email), focused permission checks and release with every normal gate below.
It does not waive failed CI/security/backup checks or authorize hosted settings.

After receiving the corrected map preview and review request, the owner
explicitly directed “ok now lets deploy our changes.” Continue the accumulated
Loadgistic release including the reviewed map corrections, preserving exact
candidate CI, target checks, fresh backup/restore, bounded migrations 098–101,
immutable packaging, monitored promotion and application rollback. This grants
no unrelated hosted-setting or credential changes.

## Provider repair closure — 2026-09-23 (UTC)

The owner supplied Support's completion notice. Independent live read-only checks
confirm `extensions.spatial_ref_sys` is owned by `supabase_admin`, PostGIS remains
3.3.7, and `public.spatial_ref_sys` is absent. No public tables lack RLS and no
security advisors are ERROR. Full catalog, guard catalog and service-spatial
checks pass; three anonymous HTTP probes receive the expected guard denial and
production health returns 200. The provider repair is closed without an agent
remote write. Evidence: `.local/postgis-completion-20260923.json` and
`.local/postgis-completion-http-20260923.json`. The two previously reviewed
warnings remain separate. This is not an application deployment or renewed
exception; the earlier map review gate is superseded by the release instruction above.

## Application release status — 2026-09-21

Application commit 6b3d6cd is published as Netlify deployment
6ab0ac42563b51a851213fa5. Runtime readiness and strict desktop/phone functional
checks pass. The owner separately approved the exact 335-record pilot-reference
repair; it was applied and verified, including document-byte and guest-denial
checks. Do not replay completed migrations, configuration or the data repair.

The previous successful promotion consumed the previous release exception. On
September 21 the owner visually approved the accumulated local changes and
explicitly requested “deploy it all.” This authorizes preparation and execution
of that Loadgistic release, preserving exact-commit CI, target checks, backup,
migration rehearsal, immutable packaging, monitored promotion and rollback.
It does not authorize unrelated credential or hosted-setting changes.

A fresh read-only check on September 21 confirms PostGIS 3.3.7 is now in
extensions, the migration ledger is 097, no public tables lack RLS, and security
advisors contain no ERROR. Full catalog, service-spatial and API-guard postchecks
remain required before closing the provider repair. The two remaining warnings
are own-identity SECURITY DEFINER access and leaked-password protection.
Evidence: `.local/release-20260921-preflight.json`. No renewed exception is needed
or inferred; this candidate must pass normal release gates.

## Historical provider repair status — 2026-09-20

The owner explicitly approved the concise backup confirmation and Paul's proposed
in-place PostGIS relocation from public to extensions. SMTP accepted that exact
follow-up on September 20; provider completion is not yet verified. The tested
backup and target-layout evidence are in operations/POSTGIS_RELOCATION_READINESS.md.
This scoped provider procedure supersedes the original RLS-only request; only
Supabase performs it. A version upgrade requires a further compatibility decision.
The agent remains prohibited from catalog edits or ownership/privilege bypass.
All independent postchecks remain required; the subsequent one-release owner
exception below changes only the requirement to wait for this provider repair.

## One-release owner exception — September 20

The owner subsequently explicitly authorized proceeding with this reviewed
application release once the other work is complete, even if Supabase has not
replied or completed the proposed move. This supersedes the wait-for-provider
requirement for this release only. It is an owner acceptance of the existing
PostGIS reference-table risk, not a completed repair or a passing security check.

Scope: Loadgistic project tpwyyzoqijjmbvsmmvcm, Netlify site
dbb0fcec-9ec9-4511-9737-db0e32849af5, reviewed release candidate 6b3d6cd and
its hash-bound migrations 077–097. The exception covers the known
public.spatial_ref_sys RLS/direct-grant finding and its pending provider repair.
It does not waive unrelated warnings, new findings, application authorization,
required CI, backup/recovery or configuration review. Any changed release code
requires its own exact-commit verification.

Before using the exception:

1. Verify the exact target, immutable candidate, migration hashes, successful CI,
   recoverable fresh backup, bounded migration plan and application rollback.
2. Verify the reviewed release on the current public PostGIS layout as well as
   the already-rehearsed extensions layout; preserve compatibility with Paul's
   already-authorized move and stop on unexpected concurrent schema changes.
3. Recheck the guard definition/configuration and actual anonymous/authenticated
   denial, service spatial access, browser database-login authority and relevant
   Realtime publications. Do not infer Storage or direct SQL protection from the
   HTTP hook. Stop if a new access path or failing protection is found.
4. Independently check all application RLS/ACL/definer requirements; an expected
   early failure in the full catalog gate must not hide a second failure. Retain
   the unchanged full gate/advisor results as failing where applicable and record
   this exact owner exception separately. No test or monitor is disabled.
5. Complete the remaining reviewed configuration, migration, runtime and visible
   browser checks. Recheck guard/service/health behavior after promotion; stop
   further changes on unexpected results. Preserve containment during rollback.

The authorization is consumed by this single successful application promotion;
it grants no future release exception or additional provider/credential powers.
Support's repair stays open after deployment until independent postchecks pass.
The standing owner-only rule and normal release policy remain unchanged outside
this specific exception. This records authority, not evidence that the remaining
prerequisites have passed. No deployment occurred when recording this decision.

## Application release execution — September 20

The reviewed migrations 077–097 are applied and verified under the one-release
exception; the API guard and service spatial behavior passed independent checks.
The Auth callback append is applied and unrelated fields verified unchanged.
The owner subsequently approved the single non-secret production-context scanner
value across the scopes required by Netlify Free; that exact setting is applied
and independently verified with unrelated values unchanged. The first application
publication failed runtime checks and was rolled back to the previous working
application. Packaging repair and draft verification remain within this same
reviewed release; the exception is consumed only by a successful verified
promotion. Do not replay the completed migrations or configuration changes.

## Existing containment — 2026-09-18

The owner-selected Data API guard is now active and independently verified on
Loadgistic. The exact migration-097 artifact adds an invoker function and sets
only authenticator's pre-request hook; no role membership, extension ownership,
table data or provider credential was changed. Fresh encrypted backup and isolated
restore evidence passed before application. See docs/PROGRESS.md and the protected
`.local/data-api-guard-production-evidence.json` for results. Underlying table
RLS/ACL repair and advisor release gates remain open. The historical finding and
authority boundaries below still apply; this containment is not a full release.

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

No owner-side table repair or provider permission change has been made.
The separate Data API containment is recorded above. The owner approved
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
| Supabase table owner/support | Approved in-place PostGIS relocation from public to extensions, following the verified backup confirmation | Unreviewed version upgrade, ownership transfer, role expansion, extension recreation, application-data changes |

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

## Historical RLS-only repair proposal

The approved September 20 provider relocation supersedes this earlier proposal.

The owner explicitly approved sending the reviewed repair request. The agent
sent it from the verified registered-owner account to support@supabase.com; SMTP
accepted it on 2026-09-17. Provider execution remains unconfirmed. The attachment is
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

## September 23 Tracking follow-up release — authorized, not yet published

The owner requests deployment of all completed changes after readiness, approved
the new Tracking progression UI (“tracking is good”), and requested the recipient
save/OTP defect correction. Scope: this reviewed application plus the already
completed demo-email import safeguards; baseline is app `200c7833974bea2db5c28d057df636ef7baa7967`,
Netlify deploy `6ab3aaa9668f9644dcba97d8`, site
`dbb0fcec-9ec9-4511-9737-db0e32849af5`, Supabase
`tpwyyzoqijjmbvsmmvcm` at migration 101. There are no new database migrations or
hosted Auth/SMTP/secret changes. Retain exact-commit CI, immutable build/runtime
checks, refreshed encrypted backup/isolated restore, security checks and monitored
promotion. Rollback is to that existing application deployment, retaining schema
and demo-account history. The later domain authorization below separately
covers the domain/URL cutover; it does not authorize SMTP credential changes.

## September 23 custom-domain authorization

After updating GoDaddy DNS, the owner explicitly requested publishing on
`loadgistic.com`. This authorizes attaching that apex and its www alias to the
existing Loadgistic Netlify site, managed HTTPS issuance, changing only the
production APP_URL, and the Supabase Site URL plus exact sign-in and account
security callback URLs. The concrete old/new values and digest are retained in
`docs/operations/LOADGISTIC_DOMAIN_SETUP.md` and the protected local plan.
Preserve old callbacks during cutover and all unrelated configuration. This is
not authority to change SMTP, providers, credentials, DNS email records,
database permissions or other projects. Normal release checks still apply.
