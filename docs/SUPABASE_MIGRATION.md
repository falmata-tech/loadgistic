# Supabase Migration

The local Next.js MVP uses `src/lib/repository.js` and Node SQLite. The Supabase target is modeled in migrations `001` through `005`: base schema, fleet-driver routes, network/tracking/truck detail, private low-rating moderation, and time-bounded subscription access.

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
- `submitBusinessReview`
- `listRatingModerationQueue`
- `reviewBusinessRating`

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

Migration `005` models the seven-day trial, 30-day manually approved period,
Business-only sponsorship, private payment proof, and restrictive operating-data
policy. Billing and account records remain readable after expiry; operating
tables require `has_workspace_access()`.
