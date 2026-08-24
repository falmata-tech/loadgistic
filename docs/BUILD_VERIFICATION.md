# Build Verification

Verified locally on 2026-08-11 with Node.js v22.16.0.

## Release evidence

- Supabase cutover checkpoint (2026-08-24): a clean isolated local reset replayed migrations `001`–`036`; the guarded local fixture import created 154 Auth users, 143 trucks/Capacity signals, 335 verification records, and 3,703 place rows; `npm run db:supabase:verify` proved password login, private Storage, expected counts, and anonymous-write denial; and `tests/supabase-fixtures.test.mjs` proved remote-import refusal, explicit reset confirmation, area-route integrity, and least-privilege migration text. Supabase SQL lint completed; its reported findings are extension-owned PostGIS diagnostics rather than Loadgistic application functions. The application runtime cutover is still pending.
- Managed identity checkpoint (2026-08-24): migration `037` applied locally; fixture verification proved the `auth.uid()`-bound company-Driver role/subscription projection; TypeScript passed; and a real Next.js request check proved `303` login, an HTTP-only Supabase session cookie, authenticated `/login` redirection, and `303` logout. Normal application traffic remains on the cutover adapter until PostgreSQL repository parity passes.

- `npm run quality`: passed. Specification validation found 26 specs and 23 features with all links resolved; source validation found 180 files and every required route; all 69 Node tests passed; TypeScript completed with no errors.
- `npm run build`: passed. Next.js 15.5.22 produced the optimized application, including all public capacity, provider, tracking, and authenticated provider routes.
- `npm run test:e2e`: 50 workflows passed and two explicitly opt-in screenshot captures were skipped across desktop Chromium and mobile Chromium. Coverage includes Map-first public discovery, automatic visitor location, regional centering, denial/retry behavior, live accessible suggestions, route and Service-area matching, stable close-zoom cluster separation, responsive non-scrolling selected cards, bounded List pages, provider pages, dynamic featured schedules, current Driver permissions, provider-owned Tracking, the unified capacity summary, retired demand routes, and credential-safe login.
- `npm run test:a11y`: 12 desktop/mobile accessibility workflows passed. Serious and critical WCAG 2 A/AA, 2.1 AA, and 2.2 AA findings are scanned across public, transporter, Driver, administrator, and support routes; keyboard dialog operation, Escape dismissal, opener-focus restoration, and 320-pixel reflow are asserted. Leaflet's spatial marker pane is excluded only from the target-size rule because markers are already large, can straddle the active viewport, and have an equivalent Truck List; every other rule continues to inspect the map.
- `npm run test:ui-stress`: 84 dense-data desktop/mobile screens passed with zero failures, including bounded Truck List pagination and current Admin Tracking inventory.
- `npm run test:ui-audit`: 86 desktop/mobile screens were captured across logged-out, fleet-owner, self-managed Driver, company Driver, administrator, and support-agent views with zero automated layout/accessibility flags and zero browser-flow errors. Every visible Leaflet map rendered real tiles before capture.
- `npm audit --json`: zero known vulnerabilities across 80 total production, development, optional, and peer dependencies.
- Automated map workflows and visual capture verified the visible map key, vehicle-image markers, close-zoom separation of overlapping trucks, selected-only approximate-location/current/two-way-regular-corridor layers, responsive detail card, responsive List cards, and restoration of the clustered market after close.

## Focused Market evidence — 2026-08-15

- `npm run check:specs`: passed with 26 specifications and 23 features.
- `npm run typecheck`: passed.
- `node --test tests/capacity-market.test.mjs`: 21 tests passed.
- Focused Playwright Market workflows: six desktop/mobile checks passed for independent route endpoints, map-only bounded loading, status-specific clustering, bounded cluster membership, and non-overlapping status labels.
- Focused desktop and phone captures are under `artifacts/focused-2026-08-15-market-final/`. The full release, accessibility, stress, and visual-audit gates have not been rerun for this uncommitted batch.

## Scale and launch follow-up — 2026-08-15

- The disposable supply-only scale harness generated 5,000 additional current
  trucks across 500 synthetic transporters without creating demand records.
- The bounded local SQLite adapter returned the first 14-truck page in 22.05 ms
  after warm-up, a filtered page in 32.94 ms, and a 51,621-byte first payload;
  ten cursor pages transferred 505,340 bytes. These measurements validate the
  local adapter and API boundary only, not concurrent serverless capacity.
- GitHub validation now regenerates this disposable fixture and runs
  `npm run test:scale`. The desktop/mobile browser suite includes a six-times
  CPU-throttled phone check that forbids background cursor draining and bounds
  rendered marker/cluster count and JavaScript heap.
- Public-production scale remains blocked until viewport-scoped PostGIS
  discovery, server-side or tile-based clustering, the managed repository and
  identity adapters, shared rate limiting, and staging concurrency tests pass.

## Private capacity and Assisted matching evidence — 2026-08-15

- `npm run check:specs`: passed with 28 specifications and 25 features.
- `npm run check:source` and `npm run typecheck`: passed.
- `node --test tests/capacity-market.test.mjs tests/private-capacity-network.test.mjs`: 25 tests passed.
- `npm run build`: optimized production build passed with the Shared capacity,
  Network, private Operations map, guest Help/chat, team Assisted matching, and
  attachment routes.
- Four focused desktop/mobile browser workflows passed. They exercise a guest
  creating a conversation, immediate assignment to the bounded Support team,
  a team reply appearing in the guest thread through the two-second refresh,
  the account-free Shared capacity gate, and the provider Network page.
- Two capture workflows passed on desktop and mobile. Screenshots of Assisted
  matching entry, the compact live thread, and Network are under
  `artifacts/private-capacity-assisted-chat-v1/`. The expensive full-site audit
  remains approval-gated.

## Deterministic local market

- 30 published transport providers: nine fleets and 21 self-managed providers.
- 143 active current-capacity signals, with at least nine in every seeded regional market and a 70-percent local-delivery vehicle cohort using road-connected routes or compact Service areas within 30 kilometres.
- 30 regular-service signals: exactly one Service area or Capacity route for each published provider, with application and database rejection of a second.
- Future-trip and regular-area persistence tables: absent after migration.
- Distinct Driver-selected approximate-location radius levels represented: five.
- Legacy demand shipments remaining after the local migration: zero.

## Release boundary

This evidence verifies the local SQLite implementation. Production remains blocked on the managed PostgreSQL/Supabase repository and identity adapters, managed email delivery, shared rate limiting, upload scanning/quarantine, backup/restore evidence, monitoring, and an approved migration rollout. See `docs/LAUNCH_READINESS.md` and `docs/SUPABASE_MIGRATION.md`.
