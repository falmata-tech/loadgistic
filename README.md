# Loadgistic

Start with the [current product brief](docs/PRODUCT_MASTER_PROMPT.md),
[active work/release checklist](docs/PROGRESS.md), and
[feature/test index](specs/TRACEABILITY.md). Dated evidence stays in their linked
historical records; it is not another set of current instructions.

Loadgistic helps Transport Providers share vehicle capacity, routes and
availability with brokers, shippers and receivers. Visitors can explore public
Capacity without an account. Providers can share privately with an email address
or a selected business workspace, whose authorized staff coordinate Capacity and
Tracking. Provider fleets support GPS, phone and manually reported locations.

Transport agreements are made directly between the parties. Optional document
review and agreed-shipment Tracking have separate permissions and privacy rules.
Implemented source capabilities and release evidence are recorded separately in
`docs/PROGRESS.md`; this overview does not certify the current hosted release.

## Current architecture

- Next.js App Router on Node.js 22
- Supabase PostgreSQL with PostGIS, RLS, and server-only transactional RPCs
- Supabase Auth for Google, numeric email-code, and local fixture-password login
- Supabase private Storage with quarantine-before-release scanning
- Netlify-compatible Next.js output and scheduled managed-operations worker
- Leaflet with bounded cursor loading and configurable attributed map tiles
- Playwright desktop/mobile workflows plus managed PostgreSQL verification
- Expo/React Native mobile app with MapLibre and separate mobile dependencies

SQLite, local private-file storage, process-local request limits, and alternate
data backends are not part of the application runtime.

## Product areas

- Account-free Capacity map with vehicle, status, route, location-source,
  service-area, proximity and freshness filters; separate Transporter search
- Public transporter microsites with fleet, Driver, evidence-category, review,
  contact, and vehicle-capacity details
- Daily Featured Vehicles with automatic rotation, Sponsor placements, and
  an administrator-managed broadcast schedule
- Email-OTP Shared capacity map for trusted contacts
- Customer business workspaces with explicitly permitted staff access
- Transporter Capacity management, fleet assignment, and Driver permissions
- Provider-owned Tracking sessions with status or consented approximate location
- Customer review and transporter dispute workflow
- Authenticated software Support; platform transport-arrangement chat is retired
- Verification, private proof, Operations, team, Featured, and
  Sponsor administration
- Installable responsive PWA shell

## Requirements

- Node.js 22.x (`.nvmrc` pins the supported line)
- npm 10 or newer
- Docker Desktop or another Docker Engine compatible with the Supabase CLI
- Supabase CLI 2.111.0 for the reproducible local/CI workflow

## Run locally

For a fresh disposable development setup:

```bash
nvm use
cp -n .env.example .env.local
npm ci
npm run tools:workflow:setup
npm run supabase:start
npm run supabase:local:configure
npm run dev
```

Open `http://127.0.0.1:3100`.

For an already configured workspace, start its existing services and run
`npm run dev`; do not repeat fixture resets or overwrite `.env.local` just to
resume work. The setup command downloads a checksum-pinned free workflow linter
into ignored `.local/tools`, without installing global packages. Routine checks
do not download software.

For the Expo browser preview, keep the web API running on3100. In a separate
terminal, use Node24 (the mobile CI runtime), then:

```bash
cd apps/mobile
npm ci
npm run preview:web
```

Open `http://localhost:8084`. This exercises mobile screens against the local
API; installed Android location, notification and permission checks require a
device/build. See `docs/MOBILE_IMPLEMENTATION.md` and the active
`docs/PROGRESS.md` checkpoint for verified build/device evidence.

The isolated Loadgistic Supabase project uses ports `55320`–`55324`, so it can
run beside other local projects. The configurator writes ignored local values
without printing them, resets only this loopback project, imports the
credential-free supply fixture, creates Supabase Auth fixture identities,
uploads one private verification fixture, and runs every managed verifier.

Local email codes arrive in Mailpit at `http://127.0.0.1:55324`; local
development does not send them to Gmail. Fixture-password login is optional,
requires its explicit local flag, and is rejected in Production.

`npm run db:reset` is an alias for the same guarded local Supabase configure
workflow. It does not create a second database engine.

## Managed fixture and scale evidence

`resources/fixtures/managed-market.json` contains no passwords, access-code
digests, demand records, or machine-local paths. A normal reset creates the
bundled synthetic providers, fleets, assigned vehicles, verification records and
place catalog. Exact counts are verified by the fixture importer rather than
this overview. Daily Featured and Sponsor dates use the Ethiopia calendar day.

Run the PostgreSQL-only scale audit after local Supabase is configured:

```bash
npm run test:scale
```

The audit inserts at least 5,000 synthetic vehicles in one local PostgreSQL
transaction, records bounded search and route-filter measurements, and rolls
the transaction back. It refuses any project other than `loadgistic-local` and
asserts that zero scale vehicles remain.

## Verification

```bash
npm run quality
npm run build
npm run test:scale
npm run test:e2e
npm run test:a11y
```

Visual-audit and stress-capture suites are intentionally separate because they
are expensive:

```bash
npm run test:ui-audit
npm run test:ui-stress
```

See `specs/README.md` for the specification workflow,
`docs/BUILD_VERIFICATION.md` for recorded evidence, and
`docs/GUARDRAILS.md` for security and release gates.

## Production handoff

Ordered migrations are under `supabase/migrations/`; application runtime and
CI use the same PostgreSQL/Auth/Storage architecture. Never run the local
fixture importer against a hosted project. Hosted rollout applies migrations,
configures private buckets/Auth/email/scanning separately, and verifies the
exact target and matching application before traffic is enabled.

Netlify and Supabase configuration, callbacks, environment names, backup,
rollback, and smoke steps are documented in `docs/CLOUD_HANDOFF.md` and
`docs/SUPABASE_MIGRATION.md`. Secrets belong in the provider dashboards or
ignored local environment only; never commit or paste them into documentation.

The standalone Docker image packages only the Next.js application. PostgreSQL,
Auth, Storage, email, and scanning remain external managed services:

```bash
docker compose up --build
```
