# Loadgistic Next.js MVP

Loadgistic is a B2B road-freight platform connecting businesses looking for truck capacity with fleet transporters and self-managed drivers looking for reviewed demand.

This rebuild uses **Next.js App Router on the Node.js runtime**. Next.js is a Node.js web framework; this codebase is not the previous bare Node.js static application.

## Included working workflows

- Signed HTTP-only local sessions and seeded role accounts
- Business workspaces for shipment demand
- Transport company workspace
- Independent owner-operator workspace
- Platform administrator workspace
- Business application and approval workflow
- Role-aware desktop and mobile navigation
- Authenticated transporter directory and company pages
- B2B road-freight load creation
- Direct, saved-partner, and open freight visibility
- Fixed ETB, target ETB, and Quote Requested pricing
- Simple freight status workflow
- Empty and Partial truck capacity, with full or unavailable trucks kept off duty
- Partial capacity percentage, update attribution, freshness, expiry, and optional photo
- Provider interest and direct-request acceptance
- Enforced Status timeline or Approximate location + status tracking
- Privacy-obscured device location for driver capacity and assigned loads
- Loading, delivery, and issue proof uploads
- Manual subscription payment-proof submission and admin review
- Audit records and deterministic demo data
- PWA manifest and responsive, app-like mobile layout
- Supabase PostgreSQL/RLS migration target
- Playwright and Browserbase-ready smoke-test structure

## Requirements

- Node.js **22.5 or newer**. The local data adapter uses Node's built-in `node:sqlite` module.
- npm 10 or newer

## Run locally

```bash
cp .env.example .env.local
npm install
npm run db:reset
npm run dev
```

Open `http://127.0.0.1:3000`.

The database is created at `data/loadgistic.db` and seeded automatically.

## Local fixture accounts

Development-only fixture credentials are documented in `docs/LOCAL_SETUP.md`. They are kept in repository-local setup and automated test code, not presented in the public login UI.

## Quality commands

```bash
npm run check:specs
npm run check:source
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:ui-audit
```

`npm run test:ui-audit` audits logged-out, Business, Fleet Transporter, Self-managed Driver, and Administrator screens at desktop and mobile sizes. Screenshots and a machine-readable report are written to `artifacts/ui-audit/`.

The linked specification system lives in `specs/`. Start with `specs/README.md`, use `specs/templates/feature-spec.md` for new behavior, and follow the major-action controls in `docs/GUARDRAILS.md`. Pull requests run the same checks and a production build through GitHub Actions.

`npm run test:e2e:browserbase` remains optional and skips when Browserbase is disabled.

## Supabase migration

The runnable local adapter uses built-in SQLite so the project can operate without Docker or cloud credentials. The target Supabase schema and RLS policies are in:

```text
supabase/migrations/001_loadgistic_schema.sql
```

The adapter boundary is documented in `docs/SUPABASE_MIGRATION.md`. Production migration replaces repository calls with RLS-protected Supabase queries or RPCs while preserving the domain commands and UI routes.

## Important security note

The local authentication adapter is suitable for an offline MVP and demo. Before public deployment, use Supabase Auth or another managed identity provider, configure a strong `SESSION_SECRET`, use managed PostgreSQL, enable storage scanning, and complete the deployment security checklist.
