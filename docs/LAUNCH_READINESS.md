# Launch Readiness

## Current verdict

The repository is ready for local development, browser testing, a controlled
single-machine demonstration, and continued product validation. It is not yet
approved for high-traffic public production. `npm run launch:check` enforces
that distinction and must remain red until the blockers below are implemented.

## Working now

- Production compilation, TypeScript, specifications, repository tests, and
  desktop/mobile Playwright workflows.
- Private JPEG, PNG, WebP, and PDF validation with opaque file references.
- Local private storage and a Supabase private-storage backend.
- Secret-code tracking, five-minute idle lock, approximate location privacy,
  status actions, and optional shipment-action proof.
- Bundled searchable Ethiopia place data and bounded server/client queries.
- Server pagination on the main marketplace, Directory, My Shipments, billing,
  verification, support, fleet, network, and administration surfaces.
- Installable PWA shell and deterministic launch/test fixtures.
- Driver-authoritative truck location with retry controls, owner timestamp
  preservation, and Local Partial route support.
- Reproducible Node 22 standalone Docker image, non-root runtime, persistent
  local-data volume, and liveness health check.
- Credential-free Vercel and Supabase setup checklist in
  `docs/CLOUD_HANDOFF.md`.

## Public-production blockers

1. Implement the Supabase/PostgreSQL repository and parity tests for every
   domain command currently backed by synchronous SQLite.
2. Replace local account authentication with Supabase Auth or another managed
   identity adapter, preserving role and workspace authorization.
3. Move rate limits from process memory to a shared store so multiple server
   instances enforce one policy.
4. Add malware scanning and quarantine before uploaded documents become
   downloadable, including private Supabase objects.
5. Configure a unique 32-character-or-longer `SESSION_SECRET`, private buckets,
   backups, monitoring, retention, and restore/rollback drills.

The service-role key is server-only. No browser bundle or `NEXT_PUBLIC_*`
variable may contain it.

`/api/health` returning HTTP 200 proves only that the process and configured
database are reachable. Its `readyForPublicProduction` field remains false
while the blockers above exist; `npm run launch:check` is the release gate.

## Deployment gates

```bash
npm ci
npm run check
npm test
npm run typecheck
npm run build
npm run test:e2e
npm audit --audit-level=high
npm run launch:check
```

The final command must pass in the selected production environment. A passing
build by itself is not evidence that the persistence and security architecture
can handle public traffic.

## Product simplification guidance

- Keep Status timeline as the default. Offer approximate location only after
  agreement, when the Business and provider know who must operate it.
- Keep exact local pickup/drop-off pins optional and private; city, town, and
  locally recognized area text should remain enough to post.
- Keep route comparison under Public Profiles and Network. It is useful during
  partner selection but too advanced for Driver Home.
- Keep temporary shipment-size proof contextual to an interested provider.
  Avoid a permanent documents workspace for routine shipment negotiation.
- Keep ratings after completed shipments and verification badges visible on
  Boards. Early users are more likely to understand trust evidence than a
  separate reputation-management workflow.
- Keep native text Support. Avoid attachments, typing indicators, and complex
  omnichannel routing until actual support volume proves they are needed.
