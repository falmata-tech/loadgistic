# Owner-controlled demo email accounts

FEAT-IAM-001 / NR-06, NR-09, NR-10, NR-14. Completed email correction on
September 23, 2026; external inbox receipt remains awaiting owner confirmation.

The owner requested distinct Gmail plus-addresses for demo identities so normal
email-code login can be used locally and live. The protected roster is
`.local/demo-email-20260923/DEMO_ACCOUNTS.md`, with a CSV alongside it. Keep the
owner inbox, full mappings, Auth snapshots, SMTP credentials and mail database
backups out of Git and deployment artifacts.

## Applied scope and evidence

- Live project `tpwyyzoqijjmbvsmmvcm`: 152 identities tagged
  `loadgistic-production-pilot-v1`, with exact immutable fixture keys (9
  transporters and 143 Drivers). Two untagged live identities were excluded.
- Local project `loadgistic-local`: 154 identities tagged `loadgistic`, including
  the two additional local ADMIN/SUPPORT fixtures. Local privileged aliases are
  not live accounts and must not be used to infer or provision live staff roles.
- Only Auth email was submitted to the supported admin API. Auth manages its
  email identity; the existing confirmed-email trigger synchronizes profiles
  and writes the account email audit event. Every ID, role, active/confirmation
  state and resulting profile email was checked. No account recreation,
  password reset, role change or hosted provider setting was performed.
- Exact old/new email plans are protected at `local-plan.json` / `live-plan.json`
  in the private task folder. Drift, collision and untagged-account checks run
  before writing. A local forward change and rollback passed before live use.
  Both receipt files report every planned identity verified. The live plan
  digest is `55ea2de6c4b835bbe722f1cb8e9b8eb418071e57bce015cb43cf6279e0de84b6`.
- Local Mailpit forwards only the owner's anchored demo-alias pattern, with
  relay-all disabled, a matching manual-release allowlist, certificate checking
  and the existing protected SMTP source. The previous local container and a
  consistent DB/WAL snapshot were retained; the inbox message count matched
  after replacement. It listens only on loopback. See `mail/receipt.json`.
  No mail was forwarded retroactively; unrelated automated recipients stay local.
- Normal development defaults `ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN=false`;
  the explicitly isolated E2E runner retains its opt-in. The owner preview is
  `http://127.0.0.1:3100/login` using normal development, not the E2E wrapper.

## Verification and limits

Desktop transporter and phone company-Driver logins completed through the real
local email request, captured code, verification and workspace UI. The manual
password shortcut was absent. Live normal email request reached the code-entry
screen. No OTP, email body or session was printed or retained in screenshots.
Actual Gmail arrival needs owner confirmation; request success is not inbox proof.
Protected evidence: `browser-evidence.json` and `screenshots/` in the task folder.

All 332 unit tests, source/spec checks and TypeScript pass. Policy tests preserve
an existing tagged identity's current email on subsequent additive pilot import,
and reject mismatched fixture key/source/role or malformed email. New unconfigured
seed identities remain non-deliverable; do not introduce the owner's real inbox
into default CI fixtures. Plus tags remain distinct application identities.

## Recovery and future resets

Do not rerun bulk seed/import to change demo email addresses. It touches much
more data. Restore an address only for its backed-up Auth ID after checking its
current alias, and verify the synchronized profile. On an ambiguous API result,
stop and inspect the receipt's attempted ID; never blindly replay the batch.

A deliberate destructive local fixture reset recreates test identities and
therefore invalidates the current ID-bound email plan. Inventory the newly tagged
identities and prepare/rehearse a new bounded mapping before applying aliases.
Do not weaken the existing drift guard or reuse old IDs. A Supabase CLI local
stack recreation can also replace the custom Mailpit launch; inspect active
relay settings before claiming external local delivery. Mail backups and the
original container are retained in the private task folder/Loadgistic Docker
namespace. Do not enable relay-all or restore unrelated hosted configuration.

Source: Supabase's supported admin email update API:
https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
Recipient-restricted local relay:
https://mailpit.axllent.org/docs/configuration/smtp-relay/
