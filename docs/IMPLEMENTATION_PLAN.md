# Loadgistic Implementation Plan

The current implementation is a local Next.js and SQLite MVP. Accepted behavior is controlled by `specs/features/` and summarized in `docs/PRODUCT_MASTER_PROMPT.md`.

## Current Workspaces

- Business
- Fleet Transporter
- Self-managed Driver / Owner-Operator
- Administrator

## Implemented Product Areas

1. Reviewed applications and signed local sessions.
2. Authenticated Load Board and truck-first Capacity Board.
3. FTL/PTL freight creation, interest, direct requests, agreement, assignment, and execution.
4. Receiver-contact privacy after agreement.
5. Fleet roster with real vehicle make, model, plate, and cargo configuration.
6. Self-managed Driver capacity Home with duty, space, load, stop, corridor, visibility, location, and proof controls; Fleet Transporter controls remain in My Fleet.
7. Public and saved-partner relationships.
8. Enforceable Status timeline or Approximate location + status tracking.
9. Private operational proof and temporary per-interest load-size proof.
10. Workspace-specific plans and manual ETB payment review.
11. Installable PWA shell with network-first authenticated pages.

## Location Boundary

Exact browser geolocation is never sent to the server. The browser snaps it to a half-degree grid and submits only the obscured coordinate, 40 km privacy radius, source, and human general-area label. Board and tracking views never render coordinates or exact map pins.

## Delivery Gates

1. Update controlling specs and master prompt.
2. Run `npm run check`.
3. Run focused Node tests and authorization regressions.
4. Run `npm run typecheck`.
5. Reset the disposable local database with `npm run db:reset`.
6. Run `npm run build`.
7. Run Playwright workflows.
8. Run the desktop/mobile UI screenshot audit and inspect flagged screens.

## Production Gaps

- Replace demo local authentication with managed identity.
- Replace local files with private object storage and malware scanning.
- Add production telemetry and alerting.
- Define live map/provider infrastructure if a finer location product is approved.
- Add backup, migration, rollback, and deployment runbooks before production rollout.
