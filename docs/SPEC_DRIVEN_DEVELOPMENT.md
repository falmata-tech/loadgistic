# Spec-driven development

Loadgistic uses executable specifications to connect intent, behavior, contracts, code, tests, and release controls across frontend, backend, and deployment.

## Position on the proposed architecture

The proposal is adopted with one refinement: architecture principles are constraints, not ceremony. Given/When/Then captures externally meaningful scenarios. Hexagonal ports isolate identity, persistence, files, audit, and transport. SOLID guides responsibility and dependency direction. DDD names aggregates, entities, value objects, and invariants. None of these requires a class when a pure function or module expresses the contract more directly.

The current code uses these boundaries:

- `src/app` is the inbound HTTP and UI adapter.
- `src/lib/domain.js` contains pure domain policy.
- Focused facades under `src/lib/` expose narrow application contracts.
- `src/lib/repository/supabase.js` and focused `*/supabase.js` modules are server-only outbound adapters.
- `supabase/` owns PostgreSQL schema, PostGIS matching, RLS, transactional commands, Auth, and Storage configuration.

New work should preserve dependency direction toward domain/application contracts. Do not manufacture class-shaped architecture when a typed function or cohesive module expresses the port more directly.

## Spec hierarchy

1. Base specs define cross-cutting rules for frontend (`BASE-FE-*`), backend (`BASE-BE-*`), and deployment (`BASE-DEP-*`).
2. Feature specs (`FEAT-<AREA>-*`) define vertical behavior and link to every applicable base.
3. Architecture decisions explain durable tradeoffs; they do not replace behavioral specs.
4. Tests prove scenario and contract completion.

## Change workflow

1. Identify or create the feature spec before implementation.
2. Link affected base and feature IDs in `related_ids`.
3. Add Given/When/Then happy, denial, and material failure scenarios.
4. Name inbound ports, application commands, domain contracts, and outbound ports.
5. Write or update domain, repository/permission, and browser tests as applicable.
6. Implement through the existing boundaries.
7. Update `specs/TRACEABILITY.md` if ownership changes.
8. Run `npm run quality`, followed by E2E tests for changed user workflows.
9. Update architecture decisions and progress when boundaries or deployment change.

## Completion rule

A specification is complete only when its scenarios are implemented, its named tests exist and pass, its observability is available, and its rollout controls are satisfied. A merged Markdown file alone is not completion.
