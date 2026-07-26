# Architecture Decisions

## ADR-001 — Next.js on Node.js

The application uses Next.js App Router on Node.js. This corrects the prior bare-Node implementation and provides server rendering, structured routing, route handlers, PWA compatibility, and production deployment paths.

## ADR-002 — Local SQLite adapter

Use Node's built-in SQLite for deterministic offline persistence. Keep all persistence behind repository functions and include a Supabase PostgreSQL/RLS target.

## ADR-003 — One canonical shipment

A request, load, and operating shipment use one record. UI terminology changes by workflow stage, but data is not copied into a second entity.

## ADR-004 — Minimal capacity

Capacity is truck-level and intentionally direct: duty state, Empty or Partial cargo space, FTL/PTL/Both acceptance, direct or multi-stop acceptance, general current area and its freshness, preferred movement, contract-lane interest, Public/Partners visibility, and expiry. A full or unavailable truck is treated as Off Duty and is not shown in discovery. Optional timestamped photos support the signal without claiming physical verification. The marketplace never requires or exposes a precise live coordinate.

## ADR-005 — Server-rendered forms

Use normal HTML forms and Route Handlers for most actions. This is resilient on weaker devices and connections and reduces unnecessary client-side state.

## ADR-006 — Linked executable specifications

Use Markdown specifications with validated YAML front matter. Base specs define frontend, backend, and deployment constraints; vertical feature specs link to them and express material behavior with Given/When/Then scenarios. Completion requires tests and rollout evidence, not documentation alone.

## ADR-007 — Pragmatic hexagonal and DDD boundaries

Adopt ports/adapters, SOLID dependency direction, and DDD vocabulary without mandating class-based implementation. Pure domain functions remain preferred for deterministic rules. Extract explicit outbound ports as adapters multiply; do not perform a speculative rewrite of the working SQLite MVP.

## ADR-008 — CI as a release guardrail

GitHub Actions performs locked dependency installation, specification and source validation, tests, TypeScript checking, a production build, and desktop/mobile Chromium workflows with read-only repository permissions. Dependabot maintains npm and workflow dependencies. Branch protection should require the `validate` and `e2e` jobs before merge.

## ADR-009 — Browse permission is not shipment-party permission

Treat open and saved-partner load visibility as authenticated read-only discovery. Internal notes, proof files, and execution transitions require an actual shipment party: Business owner, assigned provider organization/profile, or administrator. Saved-partner visibility requires an explicit active relationship to the shipment owner. Application and payment-proof approvals/rejections are terminal in the MVP.

## ADR-010 — Browser fixtures are isolated from development data

Run Playwright against a reset, dedicated SQLite database and port rather than reusing the local development server. Local fixture credentials remain in setup documentation and test code, while public authentication pages render empty credential fields. This keeps test convenience from changing public UI or developer business records.

## ADR-011 — Driver home and temporary load proof

Company and self-managed drivers land on their truck capacity control panel; fleet-wide reporting is a separate dispatcher view. The Capacity Board is read only for providers. Freight loads use the same FTL/PTL language as capacity. Load-size proof is separate from operational shipment proof and is granted to one recorded interest at a time, reauthorized on every read, and expires after a configured temporary window (48 hours by default).

Tracking is a load-level Business choice: Status timeline or Approximate location + status. Once assigned, providers must satisfy that choice on updates and cannot reduce it. Shipper or receiver Businesses may reduce it to Status timeline. Exact browser geolocation is snapped to a half-degree grid before submission and only a 40 km privacy area is retained.

## ADR-012 — Visual trucks and staged contact disclosure

Use one image-backed cargo-configuration catalog across freight creation, driver Home, Fleet, and Capacity instead of tonnage labels. A Business may expose one designated load phone to authenticated transporters only through an explicit opt in. Receiver first name and phone are shipment-party data entered after commercial agreement; Freight assignment is blocked until both are present.
