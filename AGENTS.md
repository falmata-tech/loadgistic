# AGENTS.md — Loadgistic

## Product invariant

Loadgistic gives account-free capacity seekers a public view of road-freight supply from fleets, owner-operators, and self-managed Drivers. Providers publish current capacity and own shipment tracking after the parties agree offline; Loadgistic does not publish demand or handle transactions.

Do not add consumer-delivery framing, package-delivery roles, Internal Fleet, auctions, forced scanning, fake metrics, or complex capacity analytics.

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
- `src/lib/repository/supabase.js`: server-only Supabase/PostgreSQL adapter
- `src/lib/*/supabase.js`: bounded application ports for managed workflows
- `src/lib/auth.ts`: signed session cookie boundary
- `supabase/`: PostgreSQL schema, RLS, RPCs, Auth, and Storage configuration
- `resources/fixtures/managed-market.json`: credential-free local managed fixture
- `tests/`: domain, managed-contract, and browser workflows

## Rules

1. Keep state transitions explicit in `domain.js`.
2. Authorize every mutation in server-side application services and PostgreSQL commands.
3. Do not expose proof files without shipment authorization.
4. Do not show full or Off Duty capacity in marketplace discovery. An older
   Empty or Partial signal may remain visible only with explicit capacity and
   location age labels that tell visitors to confirm availability directly.
5. Use ETB or Quote Requested; do not introduce USD marketplace prices.
6. Show only data derived from actual records or verified inputs.
7. Preserve mobile-first simplicity.
8. Add tests for every permission or workflow change.
9. Update `docs/DECISIONS.md` and `docs/PROGRESS.md` when architecture changes.
10. For OAuth, email, Storage, payments, or another external boundary, a unit
    test or `curl` redirect is not completion evidence. Exercise the visible
    browser control end to end, verify the intended user-visible destination
    or inbox, and confirm the running process loaded the expected adapter. Log
    only sanitized status/count evidence; never print mailbox bodies, OTPs,
    callback secrets, tokens, or customer contact data.
