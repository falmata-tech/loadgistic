# Loadgistic Next.js MVP

Loadgistic is a B2B road-freight platform connecting businesses looking for truck capacity with fleet transporters and self-managed drivers looking for reviewed demand.

This rebuild uses **Next.js App Router on the Node.js runtime**. Next.js is a Node.js web framework; this codebase is not the previous bare Node.js static application.

## Included working workflows

- Signed HTTP-only local sessions and seeded role accounts
- Business workspaces for shipment demand
- Transport company workspace
- Independent owner-operator workspace
- Platform administrator workspace
- Immediate Business and transporter signup with a seven-day trial
- Role-aware desktop and mobile navigation
- Authenticated transporter directory and company pages
- Lightweight B2B road-freight shipment creation, with tracking configured after agreement
- Shipper- or receiver-owned shipments with account or external shipment parties
- Separate My Shipments, Shipment Board, and execution-only Tracking workspaces
- Virtual pooled shared truckload (PSTL) discovery for compatible PTL demand
- Direct, Connected-Partners, and open freight visibility
- My Network with private Favorites, connection requests, and mutual Connected relationships
- Fixed ETB, target ETB, and Quote Requested pricing
- Simple freight status workflow
- Empty, Partial, Busy, and Off Duty truck signals, with no public Full status
- Partial capacity percentage and live route tied directly to truck status, plus update attribution, freshness, expiry, and optional photo
- Provider interest and direct-request acceptance
- Enforced Status timeline or Approximate location + status tracking
- Account or external-party secret-code tracking with a five-minute idle lock
- Privacy-obscured device location: 40 km capacity/PTL and 20 km FTL tracking
- Searchable local OpenStreetMap catalog of Ethiopian settlements
- Local service-area circles, intercity route lines, and mixed geography matching
- Private local-shipment map points disclosed to non-owner parties only after agreement
- Loading, delivery, and issue proof uploads
- Manual subscription payment-proof submission and admin review
- Native member support with bounded agent queues and admin supervision
- Audit records and deterministic demo data
- Installable PWA with responsive, app-like mobile layout and PNG install icons
- Supabase PostgreSQL/RLS migration target
- Playwright and Browserbase-ready smoke-test structure

## Requirements

- Node.js **22.x**. The local data adapter uses Node's built-in `node:sqlite` module.
- npm 10 or newer

## Run locally

```bash
nvm use
cp .env.example .env.local
npm install
npm run db:reset
npm run dev
```

Open `http://127.0.0.1:3000`.

The database is created at `data/loadgistic.db` and seeded automatically. Reset imports the bundled OpenStreetMap-derived catalog of 3,575 Ethiopian cities, towns, villages, hamlets, suburbs, and neighbourhoods. `npm run places:setup` is optional and refreshes that catalog from Overpass when the service is available. Osmium can alternatively import a local Geofabrik Ethiopia PBF.
After the first setup, the only command needed to start the app is `npm run dev`.
This command explicitly uses Turbopack. In development, the first visit to a route compiles that route and is expected to be slower; repeat visits should be fast. Use `npm run build && npm start` when measuring production behavior.

To add five Assigned-through-Completed tracking scenarios without resetting any
current local data:

```bash
npm run db:fixtures:tracking
```

To validate the standalone image locally, keep a strong local `SESSION_SECRET`
in `.env.local` and run:

```bash
docker compose up --build
```

The container is a reproducible local/demo artifact. It does not remove the
public-production blockers in `docs/LAUNCH_READINESS.md`.

## Comprehensive local data

To replace the local development database with a deterministic, high-volume
dataset for UI and workflow testing:

```bash
npm run db:stress
```

The standard profile creates more than 8,000 related records across every
application table while preserving the documented demo accounts. It includes
Businesses, fleet transporters, company Drivers, self-managed Drivers, trucks,
shipments, capacity, tracking, network, billing, verification, moderation, and
administrative states. This command resets the configured local database and is
refused when `NODE_ENV=production`.

Use `STRESS_SCALE=2 npm run db:stress` for a larger profile. Supported scales are
1 through 5. Return to the small fixture with `npm run db:reset`.

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
npm run test:ui-stress
```

`npm run test:ui-audit` audits logged-out, Business, Fleet Transporter, Self-managed Driver, and Administrator screens at desktop and mobile sizes. Screenshots and a machine-readable report are written to `artifacts/ui-audit/`.

After `npm run db:stress`, `npm run test:ui-stress` audits dense all-role boards,
fleet screens, Directory results, and administrator queues against the running
app. Its screenshots and report are written to `artifacts/stress-ui/`.

The linked specification system lives in `specs/`. Start with `specs/README.md`, use `specs/templates/feature-spec.md` for new behavior, and follow the major-action controls in `docs/GUARDRAILS.md`. Pull requests run the same checks and a production build through GitHub Actions.

`npm run test:e2e:browserbase` remains optional and skips when Browserbase is disabled.

## Supabase migration

The runnable local adapter uses built-in SQLite so the project can operate without Docker or cloud credentials. The target Supabase schema and RLS policies are in:

```text
supabase/migrations/001_loadgistic_schema.sql
supabase/migrations/002_fleet_driver_routes.sql
supabase/migrations/003_network_tracking_truck_details.sql
supabase/migrations/004_rating_moderation.sql
supabase/migrations/005_subscription_access.sql
supabase/migrations/006_local_geography_and_board_indexes.sql
supabase/migrations/007_coordinate_route_matching.sql
supabase/migrations/008_native_support.sql
supabase/migrations/009_launch_storage_places_and_capacity.sql
supabase/migrations/010_driver_capacity_authority.sql
```

The adapter boundary is documented in `docs/SUPABASE_MIGRATION.md`, and the
credential-free Vercel/Supabase setup sequence is in `docs/CLOUD_HANDOFF.md`.
Private files can already use Supabase Storage, but the business repository and
identity adapters are not yet Supabase-backed. `npm run launch:check` therefore
refuses to approve the current runtime for public production traffic. See
`docs/LAUNCH_READINESS.md`.

## Important security note

The local authentication and SQLite adapters are suitable for development, an offline pilot, and a controlled single-machine demo. They are not approved for a high-traffic public launch. Before public deployment, use Supabase Auth or another managed identity provider, finish the Supabase repository adapter, configure a strong `SESSION_SECRET`, add shared rate limiting and malware scanning, and complete the deployment checklist in `docs/LAUNCH_READINESS.md`.
