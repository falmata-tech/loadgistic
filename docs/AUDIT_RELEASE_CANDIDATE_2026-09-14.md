# Recorded-audit release candidate — 2026-09-14

The owner authorized deployment on 2026-09-14 ("should we deploy? lets go").
Release preparation is active; promotion still depends on the required gates.
The audit candidate follows baseline `a86f4f9`; earlier changes are preserved. Work is limited to Loadgistic. See AUDIT_COMPLETION_2026-09-14.md.

## Preconditions and exact targets

1. Review BUILD_VERIFICATION and the active checklist: all 34 affected browser
   cases passed across focused runs, plus seven SQL suites, six concurrency
   cases, the 5,000-truck scale audit and final quality. The build result is
   recorded there. F22/F24 feedback and narrow zoom repairs also have passing
   local browser evidence; F23 reconciles the controlling spec status.
2. Local target is `loadgistic-local`, container `supabase_db_loadgistic-local`,
   API port 55321 and database port 55322. Migrations 090–095 are applied locally.
   Read-only inspection found no local ledger row for 083; this does not prove
   a source mismatch. Preserve the ledger and require clean migration replay.
3. Hosted account/project/site and the migration ledger were independently
   verified during this release preflight: the hosted ledger ends at 076.
   Recheck immediately before applying only the exact missing manifest, in order.
4. Back up affected PostgreSQL/Auth records and private Storage with a verified
   restore path. Migrations 090–094 retain history. Migration 093 adds stored
   geometry and indexes to capacities/profile_routes: estimate rewrite duration,
   temporary disk and lock time before choosing a maintenance window.
5. Review and commit only the intended task files after required checks pass.
   Confirm the complete artifact includes earlier 077–089 prerequisites, app
   changes, worker cleanup, and tests. No broad staging in this dirty worktree.

## Application and Auth configuration

- Publish schema before application routes that require it. Missing account
  migration 092 disables account security before sending Auth mail. New spatial
  and polling contracts likewise require their migrations; do not deploy the
  application while those RPCs are missing.
- Email change needs the exact intended HTTPS origin plus
  `/api/account/security/callback` in Auth redirect allowlists. Local existing
  loopback allowlists cover this path. Review the hosted target/field and retain
  a recoverable backup before a separately authorized allowlist change. Keep
  existing Google/SMTP/client secrets, providers and secure-email-change settings.
  Local Auth has auto-confirm enabled and completes on one link despite sending
  both inbox messages; local browser evidence proves the current-email OTP and
  new-inbox confirmation, not hosted two-link enforcement. Verify the actual
  hosted confirmation settings and complete both required inbox steps at rollout.
- F13's already selected optional-antivirus policy uses
  `UPLOAD_SCANNER_BACKEND=validation-only`. Apply it only to the reviewed
  Loadgistic runtime as part of an authorized rollout. Keep private buckets,
  quarantine/signature checks and the four-MiB limit. Health must report
  `uploads-not-virus-scanned`; never report these objects as virus-scanned.
- Migration 095 must precede the public-profile adapter: it masks hidden contacts,
  returns image presence without Storage paths, and projects Driver first names
  before application rendering, including development RSC serialization.
- No new vendor, credential, public bucket or Realtime channel is needed.
  Reliable background GPS is a separate native capability, not a release toggle.

## Required publication evidence

After explicit rollout authorization: deploy the reviewed immutable artifact,
wait for required remote checks, verify health and observe authorization/error
rates. Exercise a real browser upload, successful visible save and byte-verified
authorized download in the exact deployed runtime; prove anonymous and unrelated
actor denial. Verify real queued application email delivery, the actual Auth
email-change confirmation process, revocation and account-closure denial. Clean
only exact synthetic records/objects. A green health response is insufficient.

Existing restore rehearsal, monitoring, email and tile-provider operational
limits in LAUNCH_READINESS remain; do not reset them to passed from this candidate.

## Rollback boundary

Roll back the application artifact first when safe. Keep recovery history,
account-deactivation state, file metadata and cleanup workers. Never reactivate
accounts, republish trucks, undo confirmed Auth emails, delete retained files or
restore hosted provider settings as an automatic rollback. New additive RPCs,
columns and indexes can remain while old application code is restored; removing
them requires its own dependency review. Restoring managed antivirus does not
retroactively scan files accepted under the optional-antivirus policy.

## Migration source manifest

The SHA-256 values identify the reviewed source files, not proof of application.
Refresh the manifest if any migration changes before publication.

| Migration | SHA-256 |
|---|---|
| `077_focused_capacity_editing.sql` | `b7f2047dabb8cb710969cdf95d59e7a47b5cd9211fc85cef5b4828f7778530ba` |
| `078_capacity_driver_eligibility.sql` | `a3b76b236521489d94f850c8d638ccb36ca707e6ea7699adb21616ec8d6e119d` |
| `079_platform_access_controls.sql` | `4489cbdcec4adc0d699826ba62b6e8d34633053853d9ad8131d5b4a7e5aa3887` |
| `080_automatic_featured_rosters.sql` | `a11496bef2f6fb46ce037880a5e7048530b06d281d83e2fc2e7f5d753e8fa1a6` |
| `081_fleet_driver_onboarding.sql` | `8737581fbe36f2c370f338166a258b53b91e1e1090c381b04395e19ca232b325` |
| `082_fleet_assignment_membership.sql` | `676cab4102e2189ba3b3508a763e82301fd1c08f94c588910dffbd5642293bec` |
| `083_tracking_proof_access.sql` | `853e81961820b2855a344c8fcf6030742bf9cd7fd9c32fc3a8cdb081751018a7` |
| `084_guest_support_assignment_denial.sql` | `4e24470ad20d561da9b5e6a330150d081670d13c65fe7a8aa1df97030b845034` |
| `085_support_message_history.sql` | `70fd73f8c500f2906ecb6cf375868bd257f10e892cbe9e294e313b6e1b3b5751` |
| `086_account_details.sql` | `ddc01302c64cf0dffe09730c1d99c87c5069144644f700cf77a75ce031cc85d8` |
| `087_driver_portraits.sql` | `2dd9b9e5b2fbcfd3c9d0c28a5f8be487d66517bb6a8031b9eb5256ad6f846384` |
| `088_public_provider_fleet_paging.sql` | `eacb40e501fd631044a38bf08eff19b492d14b62054cb879e9b96d3896c51b3a` |
| `089_member_support_attachments.sql` | `337b22f4322f61e8d4e51accc878a4dd9b299434500d803f4d850f54f86639f6` |
| `090_tracking_and_truck_lifecycle.sql` | `1a8b1f017cf3c22c2925408656ffe5c79e2e889ecd242c4683f0f6ba4116b792` |
| `091_admin_record_recovery.sql` | `8d0e9d78b58f4791825c088f7c2188358921be91301e7734d91714b7157f07a4` |
| `092_account_security.sql` | `7377d4597f4e5ad751ead1ab11421917ca623bdb6258c41a64645b59d05ef13b` |
| `093_capacity_viewport_queries.sql` | `207eaa42c51d0b4706107c1494a51b7f6b7d6a3c0a6fed969bcbf576139f37f7` |
| `094_support_incremental_polling.sql` | `e7a4d8dd793b372100c20d3620f9c36365a2f0c4fd5b1b8dde27a7c6b3c9a3f9` |
| `095_public_provider_safe_metadata.sql` | `0550b070c2ba12f1dd6a04346a6d6fa5781be7e4711029b1b6f753ce0b20ff24` |


## Authorized rollout checklist — active

- [x] Verify GitHub head/PR, exact Netlify site and hosted Supabase project/ledger.
- [ ] Review complete task artifact, dependency audit and full release browser gate.
- [ ] Produce protected fresh database/Storage backups and verify restoreability;
  assess migration 093 rewrite/locks against hosted sizes.
- [ ] Apply only missing reviewed migrations before dependent application code.
- [ ] Review exact hosted callback and scanner configuration; preserve credentials.
- [ ] Publish reviewed commit through required CI and production deployment.
- [ ] Verify deployed health, schema, uploads/downloads/denials and email workflows;
  retain sanitized evidence and remaining operational limits.

The currently observed Netlify deployment is `6aa4758a983dd22ae01fe98c`, commit
`451edd1faa374cbc5f15ee30cdc92962c137fbb2`, published 2026-09-11; the older
launch notes are historical. Exact site: `loadgistic-473`,
`dbb0fcec-9ec9-4511-9737-db0e32849af5`, GitHub `falmata-tech/loadgistic`, `main`.


### Preflight findings and current release gates

- Hosted project independently verified: `loadgistic`, `tpwyyzoqijjmbvsmmvcm`,
  `eu-west-1`, `ACTIVE_HEALTHY`; ledger ends at 076. Capacity/profile-route tables
  occupy 614,400 / 212,992 bytes with estimated 144 / 30 rows. These small pilot
  sizes bound expected rewrite work but do not replace lock/timeout safeguards.
- Hosted Auth currently uses the correct site origin, secure email change and
  `mailer_autoconfirm=false`; Google remains enabled. Exact allowlist currently
  contains only `https://loadgistic-473.netlify.app/api/auth/callback`. Required
  narrow addition is `https://loadgistic-473.netlify.app/api/account/security/callback`;
  retain the existing callback and every provider/SMTP/credential setting.
- Fresh `npm audit`: zero advisories at all severities.
- F26 context exclusion verified using a scratch build: application source was
  present among 877 entries; `.local` including the non-secret canary, `.netlify`,
  all `.next*`, linked Supabase state and private environment files were absent.
  The normal production container build remains blocked: Docker Hub DNS/token
  metadata lookup timed out twice. No global Docker/network configuration changed.
- CI now includes all 14 recorded rollback SQL suites, six observed-lock race
  cases, and synthetic context canaries before the guarded container build.
- Browser evidence: diagnostic 139 passed / 19 failed / eight opt-in skips;
  fresh-server retry 14 passed / five failed; final corrected desktop/phone run
  six passed. All 158 enabled cases have passing evidence across runs. Required
  remote CI must still verify the complete candidate on clean services.
- Backup export was rejected by automatic approval review. Explicit permission
  for hosted database/private files → encrypted Loadgistic `.local/backups/`
  and an isolated local restore is pending. Do not apply migrations, change
  hosted configuration or promote the application before the gate is resolved.
