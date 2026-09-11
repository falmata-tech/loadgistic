# Loadgistic

Loadgistic is a mobile-first Ethiopian freight-capacity market. Transporters,
Owner-operators, and Self-managed drivers publish Empty or Partial truck
capacity publicly or share more sensitive signals with trusted email contacts.
Capacity seekers can search the public map without an account, contact a
transporter directly, open a transporter microsite, track an agreed shipment,
or ask the Loadgistic team for assisted matching.

Loadgistic publishes supply, not shipment demand. It does not rank trucks,
handle freight payments, or replace direct document, cargo-fit, and commercial
term checks between the parties.

## Current architecture

- Next.js App Router on Node.js 22
- Supabase PostgreSQL with PostGIS, RLS, and server-only transactional RPCs
- Supabase Auth for Google, numeric email-code, and local fixture-password login
- Supabase private Storage with quarantine-before-release scanning
- Netlify-compatible Next.js output and scheduled managed-operations worker
- Leaflet with bounded cursor loading and configurable attributed map tiles
- Playwright desktop/mobile workflows plus managed PostgreSQL verification

SQLite, local private-file storage, process-local request limits, and alternate
data backends are not part of the application runtime.

## Working product surfaces

- Account-free, map-only Truck Market with provider, vehicle, status, route,
  Service-area, proximity, and freshness filters
- Public transporter microsites with fleet, Driver, evidence-category, review,
  contact, and truck-capacity details
- Daily Featured Transporters with regional rotation, Sponsor placements, and
  an administrator-managed broadcast schedule
- Email-OTP Shared capacity map for trusted contacts
- Transporter Capacity management, fleet assignment, and Driver permissions
- Provider-owned Tracking sessions with status or consented approximate location
- Customer review and transporter dispute workflow
- Account-free Assisted matching and authenticated member Support
- Verification, private proof, subscription, Operations, team, Featured, and
  Sponsor administration
- Installable responsive PWA shell

## Requirements

- Node.js 22.x (`.nvmrc` pins the supported line)
- npm 10 or newer
- Docker Desktop or another Docker Engine compatible with the Supabase CLI
- Supabase CLI 2.111.0 for the reproducible local/CI workflow

## Run locally

```bash
nvm use
cp .env.example .env.local
npm install
supabase start
npm run supabase:local:configure
npm run dev
```

Open `http://127.0.0.1:3100`.

The isolated Loadgistic Supabase project uses ports `55320`–`55324`, so it can
run beside other local projects. The configurator writes ignored local values
without printing them, resets only this loopback project, imports the
credential-free supply fixture, creates Supabase Auth fixture identities,
uploads one private verification fixture, and runs every managed verifier.

Local email codes arrive in Mailpit at `http://127.0.0.1:55324`; local
development does not send them to Gmail. Fixture-password login is enabled only
by the ignored local environment and is rejected in Production.

`npm run db:reset` is an alias for the same guarded local Supabase configure
workflow. It does not create a second database engine.

## Managed fixture and scale evidence

`resources/fixtures/managed-market.json` contains no passwords, access-code
digests, demand records, or machine-local paths. A normal reset creates 30
published transporters, 143 current truck signals, 122 assigned Drivers, 335
verification records, and the bundled Ethiopia place catalog. Daily Featured
and Sponsor dates are generated for the current Ethiopia calendar day.

Run the PostgreSQL-only scale audit after local Supabase is configured:

```bash
npm run test:scale
```

The audit inserts at least 5,000 synthetic trucks in one local PostgreSQL
transaction, records bounded search and route-filter measurements, and rolls
the transaction back. It refuses any project other than `loadgistic-local` and
asserts that zero scale trucks remain.

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
empty Production project before traffic is enabled.

Netlify and Supabase configuration, callbacks, environment names, backup,
rollback, and smoke steps are documented in `docs/CLOUD_HANDOFF.md` and
`docs/SUPABASE_MIGRATION.md`. Secrets belong in the provider dashboards or
ignored local environment only; never commit or paste them into documentation.

The standalone Docker image packages only the Next.js application. PostgreSQL,
Auth, Storage, email, and scanning remain external managed services:

```bash
docker compose up --build
```
