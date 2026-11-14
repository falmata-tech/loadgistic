# Local development and test setup

Current workflow, reconciled 2026-11-14. Use the checked-in package scripts and
[active status](PROGRESS.md); dated restore/build receipts are history, not a
reason to reset an existing workspace. Work only in Loadgistic.

Next.js runs directly on Node22; Expo uses Node24. The application can use an
isolated managed Supabase development branch without local Docker. Docker is
needed for the repository's full local Supabase/fixture harness and its native
GitHub runner suites. It is not a prerequisite for normal application source,
unit/type checks, compilation or a Netlify scheduled function. See
[ADR-085](DECISIONS.md) for the development and simulator hosting boundaries.

## Prerequisites

| Component | Required version / scope |
| --- | --- |
| Web Node |22.x; `.nvmrc` pins 22.16.0. Root package engines declare 22.x. |
| Mobile Node |24.x, matching the mobile CI job; separate `apps/mobile` lockfile. |
| npm |10 or newer; use `npm ci` against each existing lock. |
| Python |3.11+ for deploy-ready ZIP inspection and its root contract tests; standard library only, no runtime/application dependency. |
| Docker |Required for the full local Supabase stack and container checks. The managed development branch path below does not use it. |
| Supabase CLI |2.111.0 for local setup and CI; `SUPABASE_CLI_PATH` may select a project-local binary. The managed bootstrap uses Node directly. |
| Workflow analysis |Project-cached, checksum-pinned actionlint 1.7.12; ShellCheck 0.11.0 provides the additional shell analysis when installed. |

Verify the actual runtime and selected backend before starting the app. Verify
the CLI version and Docker daemon before preparing local fixtures.
Do not install globally, change shared SDKs, stop another app's services or copy
production administrator/service credentials into the local checkout.
A restricted shell's missing PATH is not proof that a separately installed
runtime is absent: inspect the exact selected binary/socket first.

CI-only port handling: the early ci-reserve-local-ports command is restricted
to disposable GitHub-hosted Linux runners. It preserves/read-checks kernel
reservations and excludes55320–55329 from automatic allocation before service
setup. Do not run it as local setup, change this machine's kernel settings or
kill an unknown listener; verify process/port ownership normally below.

## Managed development branch without Docker

Use an isolated branch with its own Supabase API/Auth/Storage/Realtime and
credentials. Do not reuse Production, another product's project or a schema
inside the production database. A Supabase account connection supplies access to
the provider; it does not create a development branch or install local services.

The November14 read-only inventory found no Loadgistic development branch. The
branch cost confirmation expired and no managed resource was created. The
bootstrap below is implemented and tested with synthetic transport; no hosted
bootstrap, candidate migration, fixture import or browser task is credited by it.
Provisioning and any paid resource remain a separate provider operation.

Record the exact branch metadata returned by a provider read in an ignored
operator manifest, for example `.local/managed-dev/manifest.json`:

```json
{
  "version": 1,
  "scope": "loadgistic-managed-development",
  "production_project_ref": "tpwyyzoqijjmbvsmmvcm",
  "development_project_ref": "abcdefghijklmnopqrst",
  "branch_id": "11111111-1111-4111-8111-111111111111",
  "branch_name": "loadgistic-development",
  "verified_branch": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "loadgistic-development",
    "project_ref": "abcdefghijklmnopqrst",
    "parent_project_ref": "tpwyyzoqijjmbvsmmvcm",
    "is_default": false,
    "with_data": false
  }
}
```

The development ref/UUID above are examples, not an existing resource. Replace
them and the branch name with the exact independently read provider values;
the branch must be nondefault, data-less on creation and under the named
Loadgistic parent. The manifest selects a target; it is not a provider-enforced
permission or proof that its database is still empty.

Prepare a separate ignored `.local/managed-dev/credentials.json` containing only:

```json
{
  "development_project_ref": "abcdefghijklmnopqrst",
  "publishable_key": "REPLACE_WITH_DEVELOPMENT_PUBLISHABLE_KEY",
  "service_role_key": "REPLACE_WITH_DEVELOPMENT_SERVER_KEY"
}
```

Use branch-specific values from the provider. Never copy a production service
key, management token or database password into this file. Keep both input files
owned by this process, regular, non-symlinked, with mode0600; keep their directory
private. Do not print keys or commit the files. Google login remains disabled;
no Google development credential is required.

With Node22 selected, preflight first, then create the environment explicitly:

```bash
node scripts/configure-managed-dev-supabase.mjs --manifest .local/managed-dev/manifest.json --credentials .local/managed-dev/credentials.json
node scripts/configure-managed-dev-supabase.mjs --manifest .local/managed-dev/manifest.json --credentials .local/managed-dev/credentials.json --write-env
npm run dev
```

The bootstrap checks exact parent/ref/name/UUID/default/data-copy metadata,
refuses known production projects and mismatched legacy key claims, and verifies
both keys through two bounded GETs to the exact development Auth and Data API.
It creates `.env.local` exclusively with mode0600, fresh distinct session/code
secrets, `APP_URL=http://127.0.0.1:3100`, disabled workers/push and empty application
mail adapters. Existing environments and symlinks are refused. Its report omits
keys and records that fixtures, data freshness, migrations, email and browser
workflows are unverified. Mode0600 is not a boundary against another process
running as the same OS user.

This is **unseeded bootstrap only**. `--seed` refuses before reading credentials
or making a request. It does not call an importer, create identities, mark demo
accounts, accept policies, apply SQL, configure hosted Auth/SMTP, enable workers
or send mail. Hosted Auth's email configuration is not inspected. Do not run
the local fixture configurator/importer or loopback-only audit helpers against
this branch; their target guards remain unchanged. Role workflows need separate
reviewed synthetic setup. Mailpit/email/signup suites remain on the full isolated
local stack or native GitHub runners.

### Separate review fixtures after operator inspection

Bootstrap remains unseeded. A separate preparer is available for only three exact
demo actors/two trucks plus one ordinary signup/truck. Before using it, inspect
the exact development branch's installed migrations and all independent controls
through the approved read-only provider connection: global world/profile/business/
team/duty off, hosted motion off with kill on, both reserved Tracking controls
unarmed, and no previous jobs/receipts. These control tables intentionally deny
the application service key; do not grant it access or claim that one global
status proves every control off.

```bash
node scripts/prepare-managed-dev-review-fixtures.mjs --manifest .local/managed-dev/manifest.json --credentials .local/managed-dev/credentials.json
node scripts/prepare-managed-dev-review-fixtures.mjs --manifest .local/managed-dev/manifest.json --credentials .local/managed-dev/credentials.json --apply-to-project EXACT_DEVELOPMENT_REF --receipt .local/managed-dev/review-fixtures.json
```

Default mode performs read-only checks. Apply requires the exact branch ref and
a new private receipt; it refuses existing Auth/core business records and any
Storage file/prefix or unexpected bucket definition. It preserves matching
migration-created places/buckets and never resets/deletes or calls the local
importer. Synthetic passwords and recovery details stay in the mode0600 receipt.
Lifecycle RPCs establish assignment, policy and Live publication without invented
verification; locations remain dated and percentage-report provenance remains
NULL. Setup activates no worker. Its report explicitly leaves owner-only
independent-control inspection to the operator. A partial failure stops with
STOPPED_REVIEW_REQUIRED; inspect that receipt before any further action.

For visible web review, explicitly enable the existing fixture password form
only in the private development environment. Expo can restore a real synthetic
Supabase refresh session through its existing controller for downstream review;
this is not evidence of email/OTP delivery. Do not weaken local-only scripts or
production login guards to initialize that session on a managed backend.

### Reachability is a separate prerequisite

November14 checks found connected user Chrome, but a task-owned localhost probe
was unreachable from it and from the Cloud desktop browser. A separate executor
command also could not reach the listening process. The environment's approval
policy rejected a host-level capability check because escalated commands are
disabled. Both probes were stopped. No supported preview/port-forward tool is
currently exposed. Resolve shared localhost or approved preview forwarding before
provisioning a charged branch solely for interactive review; do not bypass the
restriction with a shell launched through another UI or an unapproved tunnel.

The web URL is `http://127.0.0.1:3100`. Use the same running API for the Expo
preview on8084 below. Select the actual backend and source version in review
evidence; a successful bootstrap does not establish completed application tasks.

## Full fresh, disposable local Supabase stack

These commands create/reset synthetic data. Use them only when this checkout's
`loadgistic-local` database is new/disposable and the ports are owned by this task.

```bash
nvm use
npm ci
npm run tools:workflow:setup
supabase --version
docker info --format '{{.ServerVersion}}'
npm run supabase:start
node scripts/prepare-local-security.mjs
npm run supabase:local:configure
npm run dev
```

Open `http://127.0.0.1:3100`. The standard configurator creates ignored
`.env.local` values, including a random session secret when missing; no manual
copy of production values is required. It refuses remote API/mail hosts,
imports credential-free synthetic supply, creates local Auth fixture identities,
uploads the private fixture and runs the managed verifiers.
Never print its key values, fixture passwords or email codes.

The explicit PostGIS owner-security step matches clean CI and is fixed to
`supabase_db_loadgistic-local`; it does not connect to a hosted project. Keep the
catalog/role guard independent of the PostgREST request guard.

| Local service | Address / identity |
| --- | --- |
| Web |`http://127.0.0.1:3100` |
| Supabase API |`http://127.0.0.1:55321` |
| PostgreSQL |55322; project `loadgistic-local` |
| Shadow database |55320 |
| Studio |55323 |
| Local Mailpit |`http://127.0.0.1:55324` |
| Expo browser preview |`http://localhost:8084` |

Normal local sign-in uses real numeric email codes delivered to Mailpit, never
Gmail. Read only the exact synthetic recipient/request needed for a test, and
keep codes/mail contents out of reports. Optional fixture-password sign-in needs
its explicit local flag and is rejected in Production. Google account entry is
currently disabled by owner decision; retained Google adapter/configuration code
does not make it an available customer login option.

## Resume an existing preview without losing its history

For a local stack, start its existing Docker/Supabase services and `npm run dev`.
For a managed branch, retain its existing branch and private environment; start
the Node app without Docker. Verify the app,
process ownership, database project and current installed schema before testing.
Do not repeat `supabase:local:configure`, `db:reset`, fixture import or database
reset merely because a browser is empty or a process stopped.

An older local database can have a ledger ending 129 while later SQL was applied
separately. Inspect the installed definitions and exact source before proposing a
migration. Never replay 130 onward or rewrite the ledger based on that number.
Existing-data changes need the protected backup/restore/rehearsal procedure;
hosted changes retain separate exact owner authority.

Development uses `.next-dev`; production builds use `.next`; browser tests use
`.next-e2e`. Preserve the user's generated Next metadata and settings. Keep build
and browser wrappers sequential because both manage temporary type references.

## Expo browser preview

Keep the actual web API running on3100 against the selected isolated Supabase
backend. In another
terminal, select Node 24, then:

```bash
cd apps/mobile
npm ci
npm run preview:web
```

Open `http://localhost:8084`. The allowlisted preview proxy forwards only the
existing app routes to 3100. Verify the actual Metro JavaScript bundle and visible
screen after starting/restarting; listening ports and HTTP 200 HTML are not enough.
This preview exercises the Expo interface, not the Next.js phone layout.
Local browser sessions are tab-scoped and clear on sign-out/closing the tab.

On a headless host that fails `uv_interface_addresses` during discovery advertising,
use command-scoped `EXPO_UNSTABLE_BONJOUR=0 npm run preview:web`. This disables only
Expo's local Bonjour announcement; it does not repair a missing API/database or
qualify a rendered screen. A remote cloud browser may have a different loopback
network from the shell; use a supported browser in the development environment
rather than treating a connection refusal as an application regression.

Do not point mutation tests or the fixture importer at Production. Native
Android checks require an exact installed build and separate device evidence.
A task-owned virtual Android device can exercise OS permission screens,
app/service lifecycles, synthetic location and compatible notification delivery;
browser previews and source/export tests cannot establish those outcomes.
Moving physical GPS, camera output, OEM battery/background policy and tracker
hardware remain separate physical-device checks. Ask before an owner-phone
session. See the [bounded native testing runbook](operations/ANDROID_DEVICE_TESTING.md)
for managed-device account/APK/budget prerequisites and stopping controls.

## Current product boundaries in fixtures and tests

- Public Capacity is account-free. Private Capacity is a registered account/team,
  vehicle-specific grant; old Capacity email OTP and Exclusive sharing are retired.
- Account login email and public-link Tracking email are separate flows.
  Tracking uses its authorized recipient/owner projection and five-minute session;
  a background refresh does not extend that deadline.
- Platform transport-arrangement chat, guest intake, special Loadgistic Capacity
  access, subscriptions and payment mutation are retired. Authenticated software
  Support remains. Do not revive an old workflow to make an old test pass.
- Use disposable synthetic owners, drivers and business members. Registration
  creates Draft vehicles; explicitly assign and publish through normal commands.
  Do not treat contact fields or a selected signup category as a grant.

## Verification and troubleshooting

```bash
npm run check:workflow
npm run quality
npm run build
npm run test:scale
npm run test:e2e
npm run test:a11y
```

Root quality does not include the separate mobile gates. From `apps/mobile`, run
`typecheck`, `lint`, `test`, `audit:translations` and the CI Android export when
native inputs change. Start with focused workflows, then the complete required
matrix. Reuse unchanged source-bound evidence; do not suppress skips/failures.
Agent-led actual Chrome desktop/phone and affected Expo review precedes full UI
release gates. The owner is needed only for unresolved product decisions/access
and separately authorized production/device operations.

The `Operations proof boundary` workflow's `simulator-db` choice, or a push to
`diagnose/simulator-db/**`, qualifies the candidate database boundary on a native
GitHub Linux runner. It uses the full local stack, inert controls, security/API
denial, strict fixture preflight and the selected Phone/GPS and demo-isolation
SQL suites. It has no hosted credentials and performs no production deployment.
Its result does not replace the full same-commit CI matrix, application browser
review, native-device evidence or production rollout gates. A configured workflow
alone is not a passing run.

| Symptom | Safe next step |
| --- | --- |
| Local Supabase CLI reports Docker/Podman missing | Run the full local suite in a supported native Docker environment or GitHub runner. Continue normal app work through a separately provisioned isolated managed branch; never borrow production credentials. Do not resume the stopped nested VM workaround. |
| Workflow-tool download fails | Check the selected process's network/proxy support; preserve the pinned checksum. Never disable TLS/hash verification. The November 12 environment-specific recovery is in PROGRESS. |
| Blank/stale preview | Verify exact PID/cwd, API health, actual app bundle, schema and synthetic actor. Stop the dependent test at its first unavailable prerequisite; do not reset data or lengthen login waits. |
| Local email absent | Check Mailpit and the exact current request/recipient, then Auth versus application-email configuration. Do not report provider acceptance as inbox receipt. |
| Successful save, failed refresh | Preserve the known-saved checkpoint and retry GET only; do not replay the mutation. Recheck authoritative state. |
| Retention/cleanup or simulator appears stopped | Inspect its actual control, lease and saved ticks. A registration/start acknowledgement is not liveness; do not silently enable hosted controls. |

The map tile URL/attribution pair accepts a single attributed HTTPS template or
uses the direct community fallback. Do not proxy, prefetch or bulk-copy tiles.
Record readiness by capability: dependencies or a managed bootstrap do not prove
fixtures, mail, SQL migrations, actual saved tasks or device behavior. Complete
each affected boundary before claiming its verification or a releasable app.
