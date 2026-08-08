# Testing

## Standard gate

```bash
npm run quality
npm run build
npm run test:e2e
```

`npm run quality` validates linked specifications and source constraints, runs the Node test suite against isolated SQLite databases, and typechecks the application. The production build uses an isolated Next.js output directory.

Focused Node coverage includes:

- explicit provider-shipment transitions and proof restrictions;
- provider ownership and assigned-Driver scope;
- separate shipper/receiver code digests and guest grants;
- completion email idempotency and 30-day cleanup;
- all-score review publication and low-rating disputes;
- supply-only deterministic reset, full 47-signal cursor traversal, route/radius integrity, public contact controls, and optional proximity privacy;
- remaining pure domain rules used by the active provider workflows.

## Browser workflows

```bash
npm run test:e2e
```

Playwright resets `data/test-e2e.db`, uses `.next-e2e`, and runs a dedicated server on port `3100`, so it does not mutate the developer database or live development build. Current workflows cover:

- public capacity list, filters, cursor loading, map clusters, selected card, and provider details;
- provider Directory and canonical `/@handle` microsites;
- provider-only signup and retired demand-route redirects;
- fleet and self-managed capacity editing, manual location refresh/privacy, collapsed map summary, focused edits, next trip, and recurring routes/working areas;
- provider shipment creation, one-time party codes, guest unlock, timeline transitions, completion, and review behavior;
- verification warnings/badges, Support, administration, and desktop/mobile navigation.

## Visual audit

With the development server running:

```bash
npm run test:ui-audit
```

The audit captures current logged-out, fleet-provider, self-managed Driver, company Driver, Support, and administrator screens at desktop and mobile sizes. It waits for real Leaflet containers and truck/cluster markers before map capture, then checks response status, browser errors, horizontal overflow, touch targets, unlabeled fields, empty actions, and icon coverage. Evidence is written to ignored `artifacts/ui-audit/` files.

Run visual inspection only when the user has approved it. Inspect at least the public homepage, public capacity list/map, a provider microsite, the collapsed provider capacity summary, and provider shipment creation.

## Production boundary

Tests use local SQLite and local fixtures. They do not establish Supabase adapter parity, managed email delivery, malware scanning, production tile capacity, backup/restore, or a production rollout. Those remain launch gates in `docs/PROGRESS.md` and `docs/SUPABASE_MIGRATION.md`.
