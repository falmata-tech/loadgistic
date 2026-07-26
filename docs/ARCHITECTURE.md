# Architecture

## Runtime

Loadgistic is a Next.js App Router application running on the Node.js runtime. Pages are server-rendered by default. Mutations use Route Handlers and HTML forms, keeping client JavaScript small.

## Layers

1. **UI and routing** — `src/app` and `src/components`
2. **Authentication boundary** — `src/lib/auth.ts` and signed HTTP-only cookies
3. **Domain rules** — `src/lib/domain.js`
4. **Application services and authorization** — `src/lib/repository.js`
5. **Local data adapter** — `src/lib/db.js` using Node SQLite
6. **Cloud target** — Supabase PostgreSQL, Auth, Storage, and RLS

## Hexagonal interpretation

The dependency direction is UI/HTTP adapters → application services and authorization → pure domain rules → outbound ports and adapters. The current `repository.js` combines application services with the local repository facade; it is an intentional MVP seam, not a target for further coupling. Extract a port when a second adapter is introduced or a contract needs isolated testing.

DDD vocabulary is used where it clarifies invariants: Shipment, Capacity Update, Business Application, and Payment Proof are aggregates; ETB Amount, Capacity Percentage, Shipment Code, Tracking Token, and Expiry are value objects. Implementations may remain pure functions and modules. Classes are not an architectural requirement.

Behavioral and adapter contracts are governed by the linked specifications under `specs/`. See `docs/SPEC_DRIVEN_DEVELOPMENT.md`.

## Why local SQLite exists

The environment used to build this artifact cannot reach npm or cloud registries and does not provide Supabase CLI/Docker. Node's built-in SQLite allows the Next.js source to include a deterministic, persistent local adapter without adding a native database dependency.

This is an adapter choice, not a second product model. The Supabase migration mirrors the core entities and constraints.

## Core entities

- User
- Organization or independent provider profile
- Company Page
- Privacy-obscured capacity and shipment-tracking location
- Vehicle and driver
- Shipment and immutable events
- Provider interest
- Capacity update
- Tracking token and proof
- Application
- Plan, subscription, and payment proof
- Notification and audit log

## Deployment path

1. Create a Supabase project.
2. Apply `supabase/migrations/001_loadgistic_schema.sql`.
3. Configure Supabase Auth and private buckets.
4. Replace the local repository adapter with Supabase queries/RPCs.
5. Move local files to private Storage paths.
6. Run authorization and RLS tests.
7. Deploy the Next.js standalone output to a Node-compatible host.
