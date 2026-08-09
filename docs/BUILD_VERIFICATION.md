# Build Verification

Verified locally on 2026-08-09 with Node.js v22.16.0.

## Release evidence

- `npm run quality`: passed. Specification validation found 24 specs and 21 features with all links resolved; source validation found 169 files and every required route; 39 automated tests passed; TypeScript completed with no errors.
- `npm run build`: passed. Next.js 15.5.22 produced the optimized application, including all public capacity, provider, tracking, and authenticated provider routes.
- `npm run test:e2e`: 22 workflows passed across desktop Chromium and mobile Chromium. Coverage includes Map-first public discovery, automatic visitor location, regional centering, denial/retry behavior, stable close-zoom cluster separation, responsive non-scrolling selected cards, continued loading, the two-card desktop/one-card mobile List, always-visible two-way regular-corridor pairs, provider pages, the unified capacity summary and focused regular-corridor editor, absence of future-trip controls, one stable customer-owner Tracking code, the ordered status panel, Loadgistic-designed provider pages, retired demand routes, and credential-safe login.
- `npm run test:ui-audit`: 82 desktop/mobile screens captured across logged-out, fleet-owner, self-managed Driver, company Driver, administrator, and support-agent views with zero automated layout/accessibility flags and zero browser-flow errors. The final pass ran against an isolated, stable development server after the audit identified and verified fixes for one undersized search action and one provider CTA without an icon.
- Automated map workflows and visual capture verified the visible map key, vehicle-image markers, close-zoom separation of overlapping trucks, selected-only approximate-location/current/two-way-regular-corridor layers, responsive detail card, responsive List cards, and restoration of the clustered market after close.

## Deterministic local market

- 30 published transport providers: nine fleets and 21 self-managed providers.
- 47 active current-capacity signals with Empty and Partial examples in both radius and corridor geography.
- 60 two-way regular corridors: exactly two for each published provider, with application and database rejection of a third and application rejection of a reversed duplicate.
- Future-trip and regular-area persistence tables: absent after migration.
- Distinct Driver-selected approximate-location radius levels represented: five.
- Legacy demand shipments remaining after the local migration: zero.

## Release boundary

This evidence verifies the local SQLite implementation. Production remains blocked on the managed PostgreSQL/Supabase repository and identity adapters, managed email delivery, shared rate limiting, upload scanning/quarantine, backup/restore evidence, monitoring, and an approved migration rollout. See `docs/LAUNCH_READINESS.md` and `docs/SUPABASE_MIGRATION.md`.
