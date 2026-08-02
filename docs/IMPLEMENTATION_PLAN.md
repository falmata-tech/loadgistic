# Loadgistic Implementation Plan

The current implementation is a local Next.js and SQLite MVP. Accepted behavior is controlled by `specs/features/` and summarized in `docs/PRODUCT_MASTER_PROMPT.md`.

## Current Workspaces

- Business
- Fleet Transporter
- Self-managed Driver / Owner-Operator
- Administrator

## Implemented Product Areas

1. Immediate self-service signup and signed local sessions.
2. Authenticated Shipment Board and truck-first Truck Board.
3. FTL/PTL freight creation, interest, direct requests, agreement, assignment, and execution.
4. Receiver-contact privacy after agreement.
5. Fleet roster with permanent platform number, make, model, private plate, and cargo configuration.
6. Self-managed Driver capacity Home with duty, space, load, stop, dated route, visibility, location, and proof controls; Fleet Transporter controls remain in My Fleet.
7. Public, Partners, and mutual Connected relationships.
8. Enforceable Status only or Automatic location + status tracking.
9. Private operational proof and temporary per-interest load-size proof.
10. Workspace-specific plans and manual ETB payment review.
11. Installable PWA shell with network-first authenticated pages.
12. Published-only Business reputation with private, terminal administrator moderation for one- through three-star ratings.

## Location Boundary

Exact browser geolocation is never sent to the server. Capacity and PTL tracking use an approximately half-degree, 40 km privacy area; FTL tracking uses a finer 20 km privacy area. Only the obscured coordinate, permitted radius, source, and human general-area label are submitted. Board and tracking views never render exact coordinates or exact map pins.

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
