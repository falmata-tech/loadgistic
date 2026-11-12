# Local development and test setup

Current workflow, reconciled 2026-11-12. Use the checked-in package scripts and
[active status](PROGRESS.md); dated restore/build receipts are history, not a
reason to reset an existing workspace. Work only in Loadgistic.

## Prerequisites

| Component | Required version / scope |
| --- | --- |
| Web Node |22.x; `.nvmrc` pins 22.16.0. Root package engines declare 22.x. |
| Mobile Node |24.x, matching the mobile CI job; separate `apps/mobile` lockfile. |
| npm |10 or newer; use `npm ci` against each existing lock. |
| Docker |A running Docker Engine with the CLI available to this process. A Supabase account connection does not provide local containers. |
| Supabase CLI |2.111.0, matching all three CI setup steps. `SUPABASE_CLI_PATH` may select a project-local binary. |
| Workflow analysis |Project-cached, checksum-pinned actionlint 1.7.12; ShellCheck 0.11.0 provides the additional shell analysis when installed. |

Verify the actual runtime, CLI version and Docker daemon before preparing fixtures.
Do not install globally, change shared SDKs, stop another app's services or copy
production administrator/service credentials into the local checkout.
A restricted shell's missing PATH is not proof that a separately installed
runtime is absent: inspect the exact selected binary/socket first.

## Fresh, disposable Loadgistic stack only

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

Start its existing Docker/Supabase services and `npm run dev`. Verify the app,
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

Keep the actual web API running on 3100 against local services. In another
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

Do not point mutation tests or the fixture importer at Production. Installed
Android camera, OS permissions, background location, cold restart and closed-app
push require an exact installed build and separate device evidence. Ask before
an owner-phone session. Browser/emulator/source tests do not establish those facts.

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

| Symptom | Safe next step |
| --- | --- |
| CLI reports Docker/Podman missing | Provide the supported local container runtime. Do not replace PostgreSQL/Auth/Storage with a mock or borrow hosted credentials. |
| Workflow-tool download fails | Check the selected process's network/proxy support; preserve the pinned checksum. Never disable TLS/hash verification. The November 12 environment-specific recovery is in PROGRESS. |
| Blank/stale preview | Verify exact PID/cwd, API health, actual app bundle, schema and synthetic actor. Stop the dependent test at its first unavailable prerequisite; do not reset data or lengthen login waits. |
| Local email absent | Check Mailpit and the exact current request/recipient, then Auth versus application-email configuration. Do not report provider acceptance as inbox receipt. |
| Successful save, failed refresh | Preserve the known-saved checkpoint and retry GET only; do not replay the mutation. Recheck authoritative state. |
| Retention/cleanup or simulator appears stopped | Inspect its actual control, lease and saved ticks. A registration/start acknowledgement is not liveness; do not silently enable hosted controls. |

The map tile URL/attribution pair accepts a single attributed HTTPS template or
uses the direct community fallback. Do not proxy, prefetch or bulk-copy tiles.
The development environment is ready only after its database/Auth/Storage/mail,
fixture and actual task checks succeed; dependency installation alone is partial.
