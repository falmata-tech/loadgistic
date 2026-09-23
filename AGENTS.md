# AGENTS.md — Loadgistic

## Product invariant

Loadgistic helps fleets, owner-operators and self-managed Drivers share capacity signals with known brokers and enterprises (shippers and receivers), or with the open market. Transporters provide private shipment tracking to brokers, their customers or enterprises directly after agreeing the work. Optional document review helps people seeking transport assess providers; it is not a service guarantee. Keep this positioning concise in product copy. Public discovery remains account-free; Loadgistic does not publish demand or handle transactions.

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

1. Read `docs/GUARDRAILS.md`, `docs/SECURITY_REGRESSION_REGISTER.md`, and the related files under `specs/`.
2. Add or update a feature spec with linked base IDs and Given/When/Then scenarios.
3. Name changed contracts, observability, rollout, and rollback behavior.
4. Add permission, workflow, or state-transition tests before calling the spec complete.
5. Run `npm run quality`; run E2E for changed user workflows.
6. Map relevant do-not-repeat lesson IDs to their negative checks. Record new
   security failures in `docs/SECURITY_REGRESSION_REGISTER.md` with evidence, an
   owner and a next action; do not equate a documented control with installed
   provider enforcement or claim completion by suppressing a finding.

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


## Local visual review before UI deployment

- Owner-required order (2026-09-21): keep the dev server running and provide the
  URL for owner visual testing; obtain explicit visual approval; run extensive
  tests/release gates; deploy only when the owner explicitly asks. Visual approval
  alone is not deployment permission. Limited checks needed to make the preview
  usable may run first; do not put the full suite ahead of owner review.

- Performance-only requests authorize optimization of the existing experience,
  not a redesign or additional user work. Establish the existing appearance,
  click sequence, automatic behavior and result completeness before editing.
- Keep batching, caching, aggregation and loading modes internal. Do not add
  user-facing mode switches, confirmation clicks, manual loading requirements or
  reduced discovery coverage to meet a performance target without explicit owner
  agreement to that specific tradeoff before implementation. If an optimization
  cannot preserve the experience, defer it and explain the measured limitation.
- Write regression acceptance from the original workflow and the owner's request,
  not from the proposed implementation. A self-authored spec or passing test
  cannot grant permission for a product change. Review before/after interaction
  and completeness alongside actual performance evidence. See NR-13.

- For every visible UI or map change, start and keep a Loadgistic local server
  running against local services. Give the owner the working URL and the exact
  interaction to review, with focused desktop and phone screenshots.
- Run focused interaction tests first, then wait for the owner's explicit
  visual approval before full release gates or deployment of those changes.
  Automated screenshots, passing CI, and an earlier deployment authorization
  do not constitute visual approval of a changed interface.
- Record what was reviewed and approved. Material visual or interaction changes
  after approval require another local review. Never silently redesign markers
  or add interaction steps while fixing loading or clustering.

## External support communication

- Keep support emails short, courteous and limited to what the recipient needs
  to perform the specific requested job: the affected project, a clear request,
  any prerequisite they asked us to confirm, and essential compatibility limits.
- Keep our backups, internal audit evidence, release gates and follow-up checks
  on our side. Do not send hashes, test inventories, implementation instructions
  or extra reporting requests unless support needs them to resolve the case.
- Respect the provider's proposed supported procedure. Ask them to do only work
  that requires their access; do our own application and security verification.
- Brevity must preserve material safety constraints and accurate claims. Editing
  a draft does not authorize sending it or expanding a production change's scope.

## Production authority — FEAT-SEC-001

- Owner decision, 2026-09-17: production changes are owner-only for now. The
  agent prepares and tests changes but must not apply hosted database writes,
  credentials/configuration changes, repository/environment protections, merges
  or production deployments using the current administrator identity. No separate
  automation account is selected. The approved read-only backup and isolated
  restore remain authorized. Future automation requires a new owner decision.

- One-time 2026-09-17 exception: the owner subsequently authorized agent help
  executing this reviewed Loadgistic repair/release only, preserving every backup,
  target/digest, security and CI gate. See the scoped exception in
  docs/PRODUCTION_AUTHORITY.md. It does not permit ownership/privilege bypass,
  broad settings replacement or unrelated changes. Owner-only remains the
  default outside that task and after it ends.

- Routine agent work uses local services and project-scoped read-only production
  inspection. Keep production administrator/PAT/database-owner/service credentials
  outside the routine agent environment. Repository rules are not a sandbox.
- Never run hosted `supabase config push`, broad Auth replacement, arbitrary
  production SQL, role/ownership escalation, or catalog edits. Never use a more
  powerful credential to bypass an ownership denial.
- Production writes require the owner's review of the exact project, immutable
  artifact/digest, SQL or fields, current/proposed state, protected backup,
  restore evidence and rollback. A prior deployment approval does not authorize
  unrelated provider, SMTP, secret, signing-key, network, billing or deletion work.
- After ambiguous remote results, stop writes and inspect; do not automatically
  repeat or restore broad settings. Retain history and security containment.
- Normally no release while critical advisors, catalog checks or required CI fail.
  The owner's September 20 one-release exception in docs/PRODUCTION_AUTHORITY.md
  permits this reviewed release before the known PostGIS provider repair only
  after its other prerequisites pass. Keep the finding and failed check visible;
  do not disable checks or apply this exception to any other failure or release.
  New public tables require RLS before exposure, including extension-created tables.
- Follow docs/PRODUCTION_AUTHORITY.md. The 2026-09-16 approved database/private-file
  backup is a limited exception for that exact export and isolated restore; it
  does not authorize general configuration writes or new administrator access.
