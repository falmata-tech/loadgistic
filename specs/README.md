# Loadgistic specification system

Specifications are the source of intent for Loadgistic changes. They describe observable behavior and stable contracts; the implementation remains free to use functions, classes, or framework primitives that preserve those contracts.

## Structure

- `base/`: cross-cutting frontend, backend, and deployment constraints.
- `features/`: end-to-end business capabilities linked to one or more bases.
- `templates/`: starting points for new specifications.
- `TRACEABILITY.md`: concise feature-to-code-and-test index; detailed dated
  evidence is linked separately as history.

Every specification is Markdown with YAML front matter containing `id`, `title`, `related_ids`, `problem`, `behavior`, `contracts`, `observability`, and `rollout`. Feature behavior uses Given/When/Then scenarios. IDs are stable and references must resolve.

## Definition of done

1. A feature spec links its applicable base specs and dependent feature specs.
2. Authorization, state transitions, inputs, outputs, and failure behavior are explicit.
3. Scenarios cover the happy path and material denial or failure paths.
4. Contracts name ports and adapters without requiring unnecessary classes.
5. Tests named in the spec exist and pass.
6. Observability and safe rollout or rollback behavior are defined.
7. `npm run check:specs` and `npm run quality` pass.

See `docs/SPEC_DRIVEN_DEVELOPMENT.md` for the workflow and `docs/GUARDRAILS.md` for mandatory change controls.

Read the active task in `docs/PROGRESS.md` and the current product overview in
`docs/PRODUCT_MASTER_PROMPT.md`; use their historical links only for a relevant
older decision or receipt. Do not load all three archives into ordinary context.
