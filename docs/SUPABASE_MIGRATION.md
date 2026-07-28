# Supabase Migration

The local Next.js MVP uses `src/lib/repository.js` and Node SQLite. The Supabase target is modeled in `supabase/migrations/001_loadgistic_schema.sql` and the additive fleet-driver and profile-route migration in `supabase/migrations/002_fleet_driver_routes.sql`.

## Replacement boundary

Keep UI and domain commands stable:

- `createShipment`
- `transitionShipment`
- `expressInterest`
- `publishCapacity`
- `updateCompanyPage`
- `addProof`
- `reviewApplication`
- `reviewPaymentProof`

Replace their data operations with Supabase RPCs or RLS-protected queries.

## Recommended sequence

1. Apply PostgreSQL types, tables, constraints, indexes, and RLS.
2. Create Auth trigger to populate `profiles`.
3. Create private buckets for proof, capacity photos, and verification.
4. Migrate seed reference data.
5. Implement a Supabase repository with the same return shapes.
6. Feature-flag `DATA_BACKEND=sqlite|supabase` during migration.
7. Run parity tests against both adapters.
8. Disable the local adapter in production.

Never use the service-role key in browser code.
