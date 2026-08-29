# Testing

## Standard gate

```bash
npm run quality
npm run build
npm run test:e2e
npm run test:a11y
```

`npm run quality` validates linked specifications and source constraints, runs the Node test suite against isolated SQLite databases, and typechecks the application. The production build uses an isolated Next.js output directory.

Focused Node coverage includes:

- explicit provider-Tracking transitions and image restrictions;
- provider ownership and assigned-Driver scope;
- one stable customer-owner code digest and guest grant;
- access/completion email idempotency and 30-day cleanup;
- provider business-information updates that preserve platform-managed microsite presentation;
- all-score review publication and low-rating disputes;
- supply-only deterministic reset, full 47-signal cursor traversal, current and regular Service-area/Capacity-route integrity, maximum-one regular service, public contact controls, and optional proximity privacy;
- remaining pure domain rules used by the active provider workflows.

## Browser workflows

```bash
npm run test:e2e:critical
npm run test:e2e
```

`test:e2e:critical` is the fast changed-behavior layer for the canonical public market, selected-truck focus, automatic visitor location and retry, persisted Driver location, stable owner Tracking handoff/action state, and the provider presentation boundary. It asserts default view state, regional centering, resulting markers, compact-card dimensions, cluster removal/restoration, location API responses, distance evidence, persisted summary state, status-action availability, and absent provider design controls rather than accepting visible controls as proof. `test:e2e` remains the release-wide workflow suite.

Playwright resets `data/test-e2e.db`, uses `.next-e2e`, and runs a dedicated server on port `3100`, so it does not mutate the developer database or live development build. Current workflows cover:

- public capacity Map-first entry, Ethiopia bounds, over-map search, modal filters, always-visible map key, hover/focus-only marker summaries, automatic/retry visitor location, regional visitor centering, pointed cargo-configuration pins, circular availability meters, labeled Empty/Partial states, secondary List with two cards per desktop row and one per mobile row, both two-way corridor pairs exposed without disclosure, cursor loading, map clusters, responsive non-scrolling selected card without a redundant permanent marker label, and provider details;
- canonical public Market access from authenticated workspaces, safe redirects from retired dashboard-market routes, explicit Exit/Dashboard navigation, and persisted Driver capacity-location refresh with manual retry;
- provider Directory and canonical `/@handle` microsites;
- provider-only signup and retired demand-route redirects;
- fleet and self-managed capacity editing, manual approximate-location refresh, the unified collapsed summary, focused current/regular-service editors, maximum-one enforcement, and absence of future-trip or standalone planning controls;
- provider Tracking creation, stable owner code/link, ordered action panel including Going to pickup, assigned-Driver-only approximate travel location, customer location-map projection, guest unlock, timeline transitions, completion, and review behavior;
- verification warnings/badges, Support, administration, and desktop/mobile navigation.
- anonymous mobile app navigation across Market, Featured, Track, Join, and About, plus role-specific provider navigation and a public-first standalone manifest whose cache boundary excludes private navigation and framework chunks.

## Visual audit

With the development server running:

```bash
npm run test:ui-audit
npm run test:ui-stress
```

The standard audit captures current logged-out, fleet-provider, self-managed Driver, company Driver, Support, and administrator screens at desktop and mobile sizes. It waits for real Leaflet containers, rendered tiles, and truck/cluster markers before map capture, then checks response status, browser errors, horizontal overflow, touch targets, unlabeled fields, empty actions, and icon coverage. The stress audit repeats current-product routes with dense deterministic data and proves bounded Truck List pagination advances. These are release-wide layout regression sweeps, not substitutes for workflow assertions. Evidence is written to ignored `artifacts/ui-audit/` and `artifacts/stress-ui/` files.

`npm run test:a11y` is the standards-based accessibility gate. It scans serious and critical WCAG violations across public and authenticated roles, tests keyboard operation and focus restoration for dialogs, and checks narrow 320-pixel reflow. Leaflet marker positions are spatial and can overlap or cross the active viewport even though each marker is 82×96 pixels; the marker pane is therefore excluded only from the automated target-size rule, with the equivalent keyboard-operable Truck List retained. All other accessibility rules still inspect the map.

Run visual inspection only when the user has approved it. During iteration inspect the changed states first; reserve the full multi-role sweep for a release boundary. Inspect at least the public homepage, public capacity list/map, a provider microsite, the collapsed provider capacity summary, and provider shipment creation when those surfaces changed.

## Production boundary

Tests use the isolated local Supabase PostgreSQL/Auth/Storage stack and the credential-free managed fixture. Guarded live verifiers establish local adapter, authorization, RLS/RPC, Storage, Auth, and queue parity, but they do not establish hosted email delivery, hosted malware scanning, sustained third-party tile capacity, backup/restore, Preview concurrency, or a Production rollout. The community-tile fallback is a monitored bounded-beta warning; the remaining concerns stay launch gates in `docs/PROGRESS.md` and `docs/SUPABASE_MIGRATION.md`.
