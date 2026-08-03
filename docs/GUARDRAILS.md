# Engineering guardrails

These controls apply to every major action: authentication or authorization changes, state-machine changes, public data exposure, file access, schema changes, dependency changes, deployment changes, and destructive maintenance.

## Before the change

- Identify the governing feature and base spec IDs.
- Confirm the product remains B2B and does not introduce Internal Fleet, auctions, forced scanning, fabricated metrics, or complex capacity analytics.
- Write the actor, tenant/record scope, preconditions, resulting state, denial behavior, and audit outcome.
- For destructive or schema actions, name the exact target, backup, compatibility window, and rollback path.
- For dependencies or workflows, pin versions and grant minimum permissions.

## During the change

- Keep transitions in `src/lib/domain.js` and mutation authorization in server application services.
- Deny access by default and reauthorize private proof files on every read.
- Keep secrets, session tokens, credentials, proof files, and local databases out of commits and logs.
- Use ETB or Quote Requested only. Display data derived from records or verified inputs.
- Prefer additive migrations and reversible feature exposure.
- Add tests with each permission, workflow, contract, or state change.

## Required gates

`npm run quality` enforces specification links, required source, domain/repository tests, and TypeScript checks. GitHub CI additionally performs a clean install, production build, standalone Docker build, and desktop/mobile Playwright suite. Changed user workflows require Playwright coverage; sensitive authorization changes require negative repository tests.

No contributor may bypass a failing required check by weakening the check, deleting the scenario, or broadening permissions without a linked spec and architecture decision.

## Release and incident controls

- Deploy immutable artifacts built from `package-lock.json`.
- Store production secrets in the deployment platform, never repository variables or files.
- Verify `/api/health` after rollout and monitor server errors, authorization denials, and audit outcomes.
- Roll back the application first when safe. Data rollback requires an explicit reviewed procedure.
- Treat accidental proof exposure, cross-tenant access, credential leakage, and unauthorized mutation as security incidents; stop exposure, preserve audit evidence, rotate affected secrets, and notify the owner.

## Pull-request evidence

Every pull request must state related spec IDs, contract changes, tests run, observability impact, rollout/rollback, and whether data or security scope changed. The repository pull-request template captures this evidence.
