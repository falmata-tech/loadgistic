# AGENTS.md — Loadgistic

## Product invariant

Loadgistic connects enterprise shippers and receivers with parcel delivery companies, freight transporters, and independent providers for B2B shipping.

Do not add consumer-delivery framing, Internal Fleet, auctions, forced scanning, fake metrics, or complex capacity analytics.

## Commands

```bash
npm run db:reset
npm run dev
npm test
npm run check:source
npm run typecheck
npm run build
npm run test:e2e
```

## Spec-driven change gate

Before major authentication, authorization, workflow, public-data, file, schema, dependency, or deployment changes:

1. Read `docs/GUARDRAILS.md` and the related files under `specs/`.
2. Add or update a feature spec with linked base IDs and Given/When/Then scenarios.
3. Name changed contracts, observability, rollout, and rollback behavior.
4. Add permission, workflow, or state-transition tests before calling the spec complete.
5. Run `npm run quality`; run E2E for changed user workflows.

## Architecture

- `src/app`: Next.js App Router pages and route handlers
- `src/lib/domain.js`: pure domain rules
- `src/lib/repository.js`: local persistence adapter and domain services
- `src/lib/db.js`: Node SQLite schema and deterministic seed
- `src/lib/auth.ts`: signed session cookie boundary
- `supabase/`: cloud PostgreSQL/RLS target
- `tests/`: domain, repository, and browser workflows

## Rules

1. Keep state transitions explicit in `domain.js`.
2. Authorize every mutation in server-side repository services.
3. Do not expose proof files without shipment authorization.
4. Do not show expired capacity publicly.
5. Use ETB or Quote Requested; do not introduce USD marketplace prices.
6. Show only data derived from actual records or verified inputs.
7. Preserve mobile-first simplicity.
8. Add tests for every permission or workflow change.
9. Update `docs/DECISIONS.md` and `docs/PROGRESS.md` when architecture changes.
