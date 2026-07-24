# Loadgistic Next.js MVP

Loadgistic is a B2B logistics platform connecting enterprise shippers and receivers with parcel delivery companies, freight transporters, and independent truckers or owner-operators.

This rebuild uses **Next.js App Router on the Node.js runtime**. Next.js is a Node.js web framework; this codebase is not the previous bare Node.js static application.

## Included working workflows

- Signed HTTP-only local sessions and seeded role accounts
- Enterprise shipper and receiver workspaces
- Parcel delivery company workspace
- Transport company workspace
- Independent owner-operator workspace
- Platform administrator workspace
- Business application and approval workflow
- Role-aware desktop and mobile navigation
- Public provider directory and universal company pages
- Parcel delivery centers and public routes
- B2B parcel and freight shipment creation
- Direct, saved-partner, and open freight visibility
- Fixed ETB, target ETB, and Quote Requested pricing
- Manual parcel shipment-code lookup; scanning is not required
- Simple parcel status workflow
- Simple freight status workflow
- Empty, Partial, and Full truck capacity
- Partial capacity percentage, update attribution, freshness, expiry, and optional photo
- Provider interest and direct-request acceptance
- Optional tracking pages
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

## Demo accounts

All seeded users use:

```text
Loadgistic123!
```

| Workspace | Email |
|---|---|
| Enterprise Shipper | `shipper@loadgistic.local` |
| Enterprise Receiver | `receiver@loadgistic.local` |
| Parcel Delivery Company | `parcel@loadgistic.local` |
| Transport Company | `transporter@loadgistic.local` |
| Independent Owner-Operator | `driver@loadgistic.local` |
| Platform Administrator | `admin@loadgistic.local` |

## Quality commands

```bash
npm run check:specs
npm run check:source
npm test
npm run typecheck
npm run build
npm run test:e2e
```

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
