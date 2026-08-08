# Architecture

Loadgistic is a Next.js App Router application on the Node runtime. Server-rendered pages and Route Handlers adapt HTTP to explicit repository/domain commands.

## Layers

1. UI/routing — `src/app`, `src/components`.
2. Authentication and guest-grant boundary — `src/lib/auth.ts`.
3. Pure state/validation rules — `src/lib/domain.js`, `src/lib/security.js`.
4. Application services, authorization, and projections — `src/lib/repository.js`.
5. Local persistence — `src/lib/db.js` using Node SQLite.
6. External adapters — private storage and `src/lib/email-delivery.ts`.
7. Cloud target — ordered Supabase PostgreSQL/RLS migrations; runtime adapter not yet implemented.

Dependency direction is HTTP/UI → application authorization/services → domain rules → outbound adapters. `repository.js` remains an MVP seam; introduce explicit ports while implementing the second persistence adapter rather than coupling UI to Supabase.

## Active entities and invariants

- Provider organization or self-managed provider profile.
- Vehicle and exclusive active Driver assignment.
- Latest current capacity, one next trip per truck, and repeatable provider routes or permanent working areas.
- Published provider microsite with safe theme/contact projection.
- Provider shipment and immutable execution events.
- Separate party-code grants and private email-delivery attempts.
- Provider review and low-rating dispute.
- Verification request, subscription/payment proof, Support conversation, notification, and audit log.

Identity-bearing records enforce one provider owner scope. Current routes and transitions are explicit. Public projections are separate from persistence rows. No active domain aggregate represents public shipment demand, interests, Business profiles, or member networks.

## Deployment path

Apply `supabase/migrations/001` through `013` to staging, implement managed identity/repository adapters, run parity and RLS tests, move proofs to scanned private storage, configure managed email/cleanup/rate limiting/monitoring, rehearse backup and rollback, then deploy the standalone Next.js artifact. SQLite is not a public-production datastore.
