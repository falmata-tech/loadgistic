# Launch readiness

## Current verdict

The repository supports local development, browser testing, controlled demonstrations, and continued product validation. It is not approved for public production. `npm run launch:check` must remain red until the managed-runtime blockers below are resolved.

## Verified locally

- Public account-free capacity list/map with real tile rendering, clustering, provider details, and safe proximity behavior.
- Busy supply-only fixture across fleet companies and self-managed owner-operators, with no local demand data.
- Provider capacity/profile/fleet workflows and provider-owned shipment tracking.
- One stable customer-owner code/link, governed transitions, 30-day guest expiry, access/completion email retry records, and provider reviews/disputes.
- Truck-scoped private-capacity grants, email/code Shared capacity access, Operations-only Loadgistic sharing, and account-free Assisted matching with bounded local live-refresh behavior.
- Specification/source checks, Node tests, TypeScript, production build, desktop/mobile E2E, and approved visual audit evidence as recorded in `docs/PROGRESS.md`.
- Standalone Node build, private local storage adapter, PWA shell, and health endpoint.

## Public-production blockers

1. Implement and parity-test the Supabase/PostgreSQL repository and managed identity adapter. SQLite is not the public-production datastore.
2. Apply/lint migrations `001`–`032` in staging, verify RLS/RPC behavior, import place data, and rehearse encrypted logical backup/restore.
3. Inventory and purge any cloud legacy demand data only after a verified backup and explicit approval.
4. Configure managed private storage plus malware scanning/quarantine for verification, Tracking, and Assisted matching attachments.
5. Configure `LOADGISTIC_EMAIL_WEBHOOK_URL`, webhook authentication, delivery/retry monitoring, and scheduled guest-retention cleanup.
6. Add shared rate limiting and bot protection for public discovery, login, tracking unlock, Shared capacity recovery, Assisted matching, reviews, and signup; configure authorized Supabase Realtime subscriptions with polling fallback for active guest conversations.
7. Choose a production tile service/self-hosted source with reviewed attribution, privacy, capacity, caching, failure, and monitoring terms.
8. Configure strong production secrets, HTTPS, rotation, central logging/alerts, deployment approval, and rollback monitoring.
9. Replace national cursor accumulation with viewport-scoped PostGIS queries and server-side or tile-based clustering; pass the disposable 5,000-truck API and CPU-throttled phone audit before public traffic.

## Approved pilot topology

- GitHub is the source of truth and required-check boundary.
- GitHub CI runs quality, build, browser workflows, and the non-root Docker
  build from the same lockfile and commit.
- Netlify Free runs the Next.js application through its maintained OpenNext
  adapter. It does not run the Docker image or persist local files.
- Supabase Free provides the managed Postgres, Auth, private Storage, and
  bounded Realtime services.
- Resend Free provides verified-domain transactional SMTP/email within its
  3,000-message monthly and 100-message daily limits.
- Cloudflare Turnstile may protect anonymous and authentication entry points;
  transactional Supabase counters remain authoritative for shared rate limits.

This is a deliberately bounded commercial pilot. Netlify's 300 monthly credits
and Supabase's Free quotas are hard availability boundaries. The release must
fail closed when managed services are unavailable; it must never fall back to
SQLite or a serverless filesystem. Upgrade hosting or database capacity before
traffic approaches those limits.

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
