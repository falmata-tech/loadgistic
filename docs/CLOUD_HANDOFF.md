# Vercel and Supabase handoff

This is a credential-free owner handoff. Never put real secrets, customer data, tracking codes, or private files in this document, commits, screenshots, or chat logs.

## Release boundary

The standalone application is suitable for local validation and a controlled single-machine demonstration. Public production remains blocked until the managed identity/repository, email, rate-limit, upload-scanning, tile-service, backup, and monitoring gates in `docs/LAUNCH_READINESS.md` pass. `DATA_BACKEND=supabase` is not implemented.

## Supabase staging

1. Create a project in the intended region and verify backup/restore first.
2. Apply `supabase/migrations/001_loadgistic_schema.sql` through `013_public_capacity_provider_execution.sql` in numeric order.
3. Run SQL lint and review every RLS policy/default-deny private table.
4. Import the reviewed place catalog with `npm run places:import:supabase` from a trusted operator machine.
5. Confirm private proof, verification, capacity, and payment buckets; add malware scanning/quarantine before serving uploads.
6. Implement and parity-test the Supabase repository/managed Auth adapters.
7. Inventory any old cloud demand data. Purge only after explicit approval and a verified backup; record exact before/after counts privately.

The service-role key is server-only and never uses a `NEXT_PUBLIC_` name. Browser code receives only explicit safe projections or authorized short-lived file access.

## Hosting configuration

Use Node 22.x and configure Preview/Production independently:

```text
APP_URL
SESSION_SECRET
DATA_BACKEND
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PRIVATE_STORAGE_BACKEND
SUPABASE_PROOF_BUCKET
SUPABASE_CAPACITY_BUCKET
SUPABASE_VERIFICATION_BUCKET
SUPABASE_PAYMENT_BUCKET
LOADGISTIC_EMAIL_WEBHOOK_URL
LOADGISTIC_EMAIL_WEBHOOK_TOKEN
```

`DATABASE_PATH` and `PRIVATE_UPLOAD_DIR` are local/Docker-only. Do not use a serverless filesystem for durable data. Configure a production map tile URL/provider in the deployment adapter before public traffic; community OSM tiles are not an SLA.

## Release verification

```bash
npm ci
npm run quality
npm run build
npm run test:e2e
npm audit --audit-level=high
NODE_ENV=production npm run launch:check
```

Then verify health, provider signup/login, capacity radius/route publication, public list/map and proximity, platform-managed microsite presentation and provider contacts, Tracking creation, the stable owner code/link, every valid transition, access/completion emails and retries, expiry cleanup, review/dispute, private image authorization, and denied cross-provider access.

## Repository and rollback controls

Protect `main`, require review, prevent force pushes, and require validate/E2E/container checks. Promote immutable commits/images. Roll back the application artifact first. Any data rollback or legacy-demand purge requires the verified backup and explicit approval; never delete new provider shipment, party grant, email, review, or audit history merely to restore an old UI.
