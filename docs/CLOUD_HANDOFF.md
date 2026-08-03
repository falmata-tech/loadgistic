# Vercel And Supabase Handoff

This is the credential-free handoff for the owner. Do not place real values in
this file, commits, issue comments, screenshots, or chat logs.

## Current release boundary

The standalone Docker image is suitable for local validation and a controlled
single-machine demonstration. Vercel public production remains blocked until
the Supabase repository, Supabase Auth, shared rate-limit adapter, and upload
malware scanning pass the parity and security tests named in
`docs/LAUNCH_READINESS.md`. Setting `DATA_BACKEND=supabase` does not implement
those adapters.

## Supabase project

1. Create one Supabase project in the intended region.
2. Apply `supabase/migrations/001_loadgistic_schema.sql` through
   `010_driver_capacity_authority.sql` in numeric order.
3. Import the reviewed Ethiopia place catalog with
   `npm run places:import:supabase` only from a trusted operator machine.
4. Confirm private buckets named `proof`, `capacity`, `verification`, and
   `payment-proof`. Keep Public bucket access disabled.
5. Configure allowed Auth site and redirect URLs for Preview and Production.
6. Record backup retention, perform one restore drill, and keep its date and
   result in the private operations log.

The service-role key is server-only. It must never use a `NEXT_PUBLIC_` name or
appear in a browser bundle. Private file reads must use an authorized server
download or short-lived signed URL; the browser never receives a service-role
credential.

## Vercel project

Import the GitHub repository as a Next.js project and keep Node.js on the 22.x
line. Configure these separately for Preview and Production:

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
```

`DATABASE_PATH` and `PRIVATE_UPLOAD_DIR` belong only to the local/Docker SQLite
adapter. Do not treat Vercel's filesystem as durable storage.

## GitHub controls

Protect `main`, require pull requests, prevent force pushes, and require the
`validate`, `e2e`, and `container` CI jobs. Keep workflow permissions read-only
unless a narrowly scoped deployment job is added later. Dependabot remains
limited to npm and GitHub Actions updates.

## Release verification

Before traffic is enabled:

```bash
npm ci
npm run quality
npm run build
npm run test:e2e
npm audit --audit-level=high
NODE_ENV=production npm run launch:check
```

Then verify `/api/health`, signup, login/logout, one shipment post, one Driver
capacity update with browser location, one agreement/assignment, one tracking
transition, one private-file read, and one denied cross-tenant read. The health
response reports liveness separately from `readyForPublicProduction`.

## Rollback

Promote immutable commits/images. Roll back the application artifact first.
Do not reverse a data migration until its backup and tested down-migration or
forward repair are approved. Suspend private-file downloads immediately if an
authorization or storage-policy regression is detected.
