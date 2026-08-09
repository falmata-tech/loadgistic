# Testing

## Standard gate

```bash
npm run quality
npm run build
npm run test:e2e
```

`npm run quality` validates linked specifications and source constraints, runs the Node test suite against isolated SQLite databases, and typechecks the application. The production build uses an isolated Next.js output directory.

Focused Node coverage includes:

- explicit provider-Tracking transitions and image restrictions;
- provider ownership and assigned-Driver scope;
- one stable customer-owner code digest and guest grant;
- access/completion email idempotency and 30-day cleanup;
- provider business-information updates that preserve platform-managed microsite presentation;
- all-score review publication and low-rating disputes;
- supply-only deterministic reset, full 47-signal cursor traversal, route/radius integrity, maximum-two regular corridors, reversed two-way-corridor duplicate rejection, public contact controls, and optional proximity privacy;
- remaining pure domain rules used by the active provider workflows.

## Browser workflows

```bash
npm run test:e2e:critical
npm run test:e2e
```

`test:e2e:critical` is the fast changed-behavior layer for the canonical public market, selected-truck focus, automatic visitor location and retry, persisted Driver location, stable owner Tracking handoff/action state, and the provider presentation boundary. It asserts default view state, regional centering, resulting markers, compact-card dimensions, cluster removal/restoration, location API responses, distance evidence, persisted summary state, status-action availability, and absent provider design controls rather than accepting visible controls as proof. `test:e2e` remains the release-wide workflow suite.

Playwright resets `data/test-e2e.db`, uses `.next-e2e`, and runs a dedicated server on port `3100`, so it does not mutate the developer database or live development build. Current workflows cover:

- public capacity Map-first entry, Ethiopia bounds, over-map search, modal filters, always-visible map key, hover/focus-only marker summaries, automatic/retry visitor location, regional visitor centering, pointed cargo-configuration pins, circular availability meters, labeled Empty/Partial states, secondary List with two cards per desktop row and one per mobile row, both two-way corridor pairs exposed without disclosure, cursor loading, map clusters, responsive non-scrolling selected card without a redundant permanent marker label, and provider details;
- Driver dashboard Capacity market parity, dashboard-preserving search/filter actions, explicit Exit dashboard navigation, and immediate persisted automatic location refresh with manual retry retained;
- provider Directory and canonical `/@handle` microsites;
- provider-only signup and retired demand-route redirects;
- fleet and self-managed capacity editing, manual approximate-location refresh, the unified collapsed summary, focused current/regular-corridor editors, maximum-two enforcement, and absence of future-trip or standalone planning controls;
- provider Tracking creation, stable owner code/link, ordered action panel, guest unlock, timeline transitions, completion, and review behavior;
- verification warnings/badges, Support, administration, and desktop/mobile navigation.

## Visual audit

With the development server running:

```bash
npm run test:ui-audit
```

The audit captures current logged-out, fleet-provider, self-managed Driver, company Driver, Support, and administrator screens at desktop and mobile sizes. It waits for real Leaflet containers and truck/cluster markers before map capture, then checks response status, browser errors, horizontal overflow, touch targets, unlabeled fields, empty actions, and icon coverage. It is a release-wide layout regression sweep, not proof that an interaction persisted or changed state. Evidence is written to ignored `artifacts/ui-audit/` files.

Run visual inspection only when the user has approved it. During iteration inspect the changed states first; reserve the full multi-role sweep for a release boundary. Inspect at least the public homepage, public capacity list/map, a provider microsite, the collapsed provider capacity summary, and provider shipment creation when those surfaces changed.

## Production boundary

Tests use local SQLite and local fixtures. They do not establish Supabase adapter parity, managed email delivery, malware scanning, production tile capacity, backup/restore, or a production rollout. Those remain launch gates in `docs/PROGRESS.md` and `docs/SUPABASE_MIGRATION.md`.
