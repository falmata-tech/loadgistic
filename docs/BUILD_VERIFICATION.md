# Build Verification

Verified locally on 2026-08-08 with Node.js v22.16.0.

## Release evidence

- `npm run quality`: passed. Specification validation found 24 specs and 21 features with all links resolved; source validation found 167 files and every required route; 37 automated tests passed; TypeScript completed with no errors.
- `npm run build`: passed. Next.js 15.5.22 produced the optimized application, including all public capacity, provider, tracking, and authenticated provider routes.
- `npm run test:e2e`: 18 workflows passed across desktop Chromium and mobile Chromium. Coverage includes public capacity discovery, cursor continuation, provider pages, map clustering and selected-signal overlays, manual visitor location refresh, provider shipment codes, collapsed capacity editing, retired demand routes, and credential-safe login.
- `npm run test:ui-audit`: captured 82 desktop/mobile screens with zero automated layout/accessibility flags and zero browser-flow errors.
- Focused map inspection: rendered 18 real OpenStreetMap tiles with no browser console/page errors; the selected truck rendered its full capacity panel, Driver-controlled violet privacy circle, current signal, next trip, recurring routes, and cyan recurring working area.

## Deterministic local market

- 30 published transport providers: nine fleets and 21 self-managed providers.
- 47 active current-capacity signals, 44 next trips, 61 recurring routes, and 30 permanent recurring working areas.
- Partial current-capacity signals with non-route geometry: zero.
- Distinct Driver-selected location-privacy levels represented: five.
- Legacy demand shipments remaining after the local migration: zero.

## Release boundary

This evidence verifies the local SQLite implementation. Production remains blocked on the managed PostgreSQL/Supabase repository and identity adapters, managed email delivery, shared rate limiting, upload scanning/quarantine, backup/restore evidence, monitoring, and an approved migration rollout. See `docs/LAUNCH_READINESS.md` and `docs/SUPABASE_MIGRATION.md`.
