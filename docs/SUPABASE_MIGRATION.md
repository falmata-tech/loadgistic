# Supabase migration target

The runnable Loadgistic application still uses `src/lib/repository.js` with Node SQLite. Ordered SQL migrations `001` through `013` model the PostgreSQL/RLS target, but `DATA_BACKEND=supabase` is not implemented. Setting that variable does not move authentication or business data. Production readiness therefore remains blocked.

## Current migration coverage

- `001`–`005`: base identity, provider/workspace, legacy shipment, fleet, verification, billing, and initial RLS contracts.
- `006`–`008`: Ethiopia place data, structured geography, fleet routes, and native Support isolation.
- `009`–`011`: launch storage/indexes, Driver-authoritative location, privacy choices, and evidence-specific verification.
- `012`: converts Busy to Off Duty, removes dates from immediate capacity, adds radius-or-route geometry/work radius, maps compatible provider route fields, clears contract/available-again state, and narrows current market status.
- `013`: adds provider microsite controls, next trips, recurring working areas, provider-owned shipments/events, separate party-code digests, private email retry records, and provider reviews. New execution tables have RLS enabled with no browser policy; the future server adapter must authorize commands and return explicit safe projections.

The local fake-demand purge is implemented in `src/lib/db.js`. An equivalent cloud purge is intentionally not automatic: it is destructive and must be executed only after a verified backup, exact row-count review, and explicit rollout approval.

## Required adapter work

Keep these active contracts stable while replacing SQLite operations:

- Public capacity cursor/detail and public provider projections.
- Provider capacity, next-trip, recurring route/working-area, profile, fleet, and verification commands.
- Provider shipment creation, assignment, transitions, proof authorization, and bounded history.
- Shipper/receiver code verification and party-scoped guest sessions.
- Completion-email queue/retry and 30-day retention cleanup.
- Provider review submission, low-rating dispute, and audited review decision.
- Provider billing, Support, and platform Operations commands.

Use RLS-protected queries or transactional RPCs. Never place a service-role key in browser code, never return raw private-table rows to anonymous clients, and keep access-code verification on the server.

## Rollout sequence

1. Back up the target database and prove restore into an isolated environment.
2. Apply `001` through `013` to an empty/staging project and run Supabase SQL lint plus schema/RLS review.
3. Import the bundled place catalog with `npm run places:import:supabase`.
4. Implement the managed identity and repository adapters behind `DATA_BACKEND=sqlite|supabase`.
5. Run the same domain, authorization, cursor, guest-tracking, retention, and E2E suites against both adapters.
6. Configure private proof storage, malware scanning/quarantine, email delivery, rate limiting, monitoring, and cleanup jobs.
7. Inventory any legacy cloud demand rows. After explicit approval, purge only the reviewed target rows and record counts/audit evidence.
8. Deploy the managed backend to a non-production environment, run `npm run launch:check`, and rehearse application and data rollback.
9. Disable SQLite in production only after parity and operational gates pass.

## Rollback

Roll back the application artifact first. Schema/data rollback requires the reviewed backup because the approved demand purge is destructive. Never reverse the product by deleting newly created provider shipments, party grants, email attempts, reviews, or audit evidence.
