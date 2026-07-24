# Architecture Decisions

## ADR-001 — Next.js on Node.js

The application uses Next.js App Router on Node.js. This corrects the prior bare-Node implementation and provides server rendering, structured routing, route handlers, PWA compatibility, and production deployment paths.

## ADR-002 — Local SQLite adapter

Use Node's built-in SQLite for deterministic offline persistence. Keep all persistence behind repository functions and include a Supabase PostgreSQL/RLS target.

## ADR-003 — One canonical shipment

A request, load, and operating shipment use one record. UI terminology changes by workflow stage, but data is not copied into a second entity.

## ADR-004 — Minimal capacity

Capacity is Empty, Partial, or Full. Partial requires one available percentage. Freshness is based on account update time and expiry; optional photos support the claim without pretending physical verification.

## ADR-005 — Server-rendered forms

Use normal HTML forms and Route Handlers for most actions. This is resilient on weaker devices and connections and reduces unnecessary client-side state.

## ADR-006 — Linked executable specifications

Use Markdown specifications with validated YAML front matter. Base specs define frontend, backend, and deployment constraints; vertical feature specs link to them and express material behavior with Given/When/Then scenarios. Completion requires tests and rollout evidence, not documentation alone.

## ADR-007 — Pragmatic hexagonal and DDD boundaries

Adopt ports/adapters, SOLID dependency direction, and DDD vocabulary without mandating class-based implementation. Pure domain functions remain preferred for deterministic rules. Extract explicit outbound ports as adapters multiply; do not perform a speculative rewrite of the working SQLite MVP.

## ADR-008 — CI as a release guardrail

GitHub Actions performs locked dependency installation, specification and source validation, tests, TypeScript checking, a production build, and desktop/mobile Chromium workflows with read-only repository permissions. Dependabot maintains npm and workflow dependencies. Branch protection should require the `validate` and `e2e` jobs before merge.

## ADR-009 — Browse permission is not shipment-party permission

Treat public/open and saved-partner load visibility as read-only discovery. Internal notes, proof files, and execution transitions require an actual shipment party: shipper, receiver, assigned provider organization/profile, or administrator. Saved-partner visibility requires an explicit active relationship to the shipment owner. Application and payment-proof approvals/rejections are terminal in the MVP.
