# Launch readiness

## Current verdict

The repository supports local development, browser testing, controlled demonstrations, and continued product validation. It is not approved for public production. `npm run launch:check` must remain red until the managed-runtime blockers below are resolved.

## Verified locally

- Public account-free capacity list/map with real tile rendering, clustering, provider details, and safe proximity behavior.
- Busy supply-only fixture across fleet companies and self-managed owner-operators, with no local demand data.
- Provider capacity/profile/fleet workflows and provider-owned shipment tracking.
- Separate party codes, governed transitions, 30-day guest expiry, completion-email retry records, and provider reviews/disputes.
- Specification/source checks, Node tests, TypeScript, production build, desktop/mobile E2E, and approved visual audit evidence as recorded in `docs/PROGRESS.md`.
- Standalone Node build, private local storage adapter, PWA shell, and health endpoint.

## Public-production blockers

1. Implement and parity-test the Supabase/PostgreSQL repository and managed identity adapter. SQLite is not the public-production datastore.
2. Apply/lint migrations `001`–`013` in staging, verify RLS/RPC behavior, import place data, and rehearse backup/restore.
3. Inventory and purge any cloud legacy demand data only after a verified backup and explicit approval.
4. Configure managed private storage plus malware scanning/quarantine.
5. Configure `LOADGISTIC_EMAIL_WEBHOOK_URL`, webhook authentication, delivery/retry monitoring, and scheduled guest-retention cleanup.
6. Add shared rate limiting and bot protection for public discovery, login, tracking unlock, reviews, and signup.
7. Choose a production tile service/self-hosted source with reviewed attribution, privacy, capacity, caching, failure, and monitoring terms.
8. Configure strong production secrets, HTTPS, rotation, central logging/alerts, deployment approval, and rollback monitoring.

## Deployment gates

```bash
npm ci
npm run quality
npm run build
npm run test:e2e
npm audit --audit-level=high
npm run launch:check
```

Run the approved visual audit for a release candidate after the same immutable artifact and backing services are configured. `/api/health` returning HTTP 200 proves process/database reachability only; it does not assert public-production readiness.
