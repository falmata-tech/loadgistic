# AGENTS.md — Loadgistic

## Product invariant

Loadgistic helps fleets and independent drivers share capacity signals with Shippers and brokers, or with the open market. Transport Providers provide private shipment tracking to Shippers, brokers, receivers or their customers after agreeing the work. Optional document review helps people seeking transport assess providers; it is not a service guarantee. Keep this positioning concise in product copy. Public discovery remains account-free; Loadgistic does not publish demand or handle transactions.

Do not add consumer-delivery framing, package-delivery roles, Internal Fleet, auctions, forced scanning, fake metrics, or complex capacity analytics.

## Product experience standard

Clarity is part of the product, not a finish pass or a cost-saving tradeoff.
Apply this to every surface and role: public visitors, Transport Providers,
drivers, business owners and staff, platform Support, platform staff and admins.

- Start with the person's task and current record, not the database table or an
  inventory of available features. Group related facts and actions in the place
  people use them; keep separate pages only when they support a distinct task.
- Treat phone use as the stricter design case for shared workflows: design its
  hierarchy, touch targets, one-hand reach, safe areas, map overlays and return
  paths deliberately before adapting the same task structure to wider screens.
- Make layout and interaction hierarchy carry the explanation. Keep helper text
  short and use it for decisions, consequences and genuinely unfamiliar actions;
  do not cover weak structure with paragraphs that narrate the screen.
- A first-use or empty state must say what is missing, why it matters and the
  next useful action. An empty Capacity map must still orient a new provider or
  driver and lead them into publishing their first signal; never leave them to
  infer what an empty map means. Apply the same rule to lists, queues and
  dashboards.
- Show saved facts before editing. Open a focused edit only when requested, keep
  its scope clear, and make Save, Cancel, progress, errors and the result easy to
  understand. Avoid duplicate actions, repeated headings, unexplained controls,
  dead ends and busy screens that force people to learn the data model.
- Prefer one obvious next action, familiar icons paired with short contextual
  labels, and clear return paths. Do not replace useful words with ambiguous
  icons or add decorative controls that do not help complete a task.
- Write English, Amharic and Afaan Oromo for the user's intent and audience,
  using simple natural phrasing rather than literal translation or internal
  terminology. Check that labels fit and retain their meaning at phone widths.
- Review real empty, loading, success, failure/retry, saved and permission-denied
  states at relevant desktop and phone sizes. A page rendering or a passing
  component test is not evidence that a person can complete the promised task.

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

## Test maintenance and efficient daily work

- Repo-scoped skills in `.agents/skills` keep detailed procedures task-specific:
  `loadgistic-engineering` for everyday changes/setup housekeeping,
  `loadgistic-ui-ux` for task-centered UI, navigation and localization work,
  `loadgistic-test-repair` for failed gates or stale-fixture audits, and
  `loadgistic-release` for preparing/resuming an authorized rollout.
  `loadgistic-github` handles branch/PR/review and authorized merge work, following
  `docs/operations/GITHUB_WORKFLOW.md`. Use the
  applicable skill; do not load every skill by default. They supplement these
  instructions and never grant additional permissions.
- Use `docs/AGENT_LESSONS.md` for the applicable failure category and practical
  stack-specific loop. Update affected tests/fixtures with behavior changes,
  including gated cases; resolve known findings together before another full CI.
  Preserve real denial, persistence and recovery checks.
- For migration-based database diagnosis, inspect the selected database catalog
  and final installed function definition first. An older CREATE statement is
  historical evidence: check subsequent replacements/drops before reporting a
  current requirement, missing feature or repair prerequisite. Label unconfirmed
  source inferences explicitly; do not build a fix for an already-removed rule.
- When delegating follow-up work, use `followup_task` for an idle/completed
  agent. `send_message` informs a running agent but does not start an idle one.
  Check task state before waiting on a dependency; do not wait on an unstarted
  task. Keep file ownership and the next executable step explicit (NR-68).
- Bound generated-file searches by line length as well as line count; `head`
  does not prevent one embedded JSON line from consuming the working context.
- After one controlled retry, diagnose the observed cause before repeating slow
  or failed work. Improve recurring friction proactively and record its measured
  result, evidence and remaining action in the existing register/checklist.
  Separate hypotheses, manual rules and installed automated enforcement.
- Treat scripts/CI as maintained code: bounded failure, negative tests, safe
  diagnosis and useful timings. Run `npm run check:workflow` before expensive
  setup; install its pinned linter once with `npm run tools:workflow:setup`.
- Keep detailed release reuse/freshness procedures in the release skill and
  working lessons. Existing production/visual authority below remains mandatory;
  skills do not authorize additional work or replace its evidence.

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
7. Preserve mobile-first simplicity. Owner decision October14 supersedes the
   one-truck provider-owner limit: all Transport Provider owners may add multiple
   Draft trucks; employed drivers retain one assigned truck only. Driving owners
   keep map Home. One active truck may go Live unreviewed; more than one requires
   exact qualifying ownership/financed-licence review. Retired trucks restore to
   Draft before explicit Go Live. Publication, exact reviewed ownership/financed licence and
   drive/manage permission are distinct. Follow FEAT-FLT/VER/IAM-001 / ADR-079 /
   NR-18 for authenticated owner scope, atomic assignments/lifecycle, preserved
   history and unfinished-Tracking denial. Do not equate declaration or generic
   document approval with provider ownership, financing or licence holder.
8. Add tests for every permission or workflow change.
9. Update `docs/DECISIONS.md` and `docs/PROGRESS.md` when architecture changes.
10. For OAuth, email, Storage, payments, or another external boundary, a unit
    test or `curl` redirect is not completion evidence. Exercise the visible
    browser control end to end, verify the intended user-visible destination
    or inbox, and confirm the running process loaded the expected adapter. Log
    only sanitized status/count evidence; never print mailbox bodies, OTPs,
    callback secrets, tokens, or customer contact data.


## Local visual review before UI deployment

- Owner instruction (2026-10-22) supersedes the earlier owner-visual-approval
  gate: the agent performs and records the visual review. Keep the dev server
  running, inspect the actual changed screen in Chrome on desktop and phone,
  complete the affected task, and check saved results and permission boundaries.
  Check the affected Expo view too; use an authorized phone session for native-only
  behavior. Record URLs, screenshots, interactions, failures and remaining limits.
  Do not claim a screen reviewed from screenshots or tests alone. Ask the owner
  only when a product decision or access needed for the review is unresolved.
  After the agent's review passes, run the required full tests/release gates.
  Deployment still requires the owner's explicit request and all production gates.

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
  running against local services. Record the working URL, exact interaction and
  focused desktop and phone screenshots; share them with the owner when useful.
- Run focused interaction tests first, then complete the agent-led browser and
  affected Expo review before full release gates. Automated screenshots and
  passing CI alone do not establish visual or workflow quality.
- Record what was actually reviewed and its outcome. Material visual or
  interaction changes after review require another local review. Never silently
  redesign markers or add interaction steps while fixing loading or clustering.

## Hands-on workflow verification

- Owner instruction, October20: agents may use actual Google Chrome to exercise
  Loadgistic web workflows without asking for browser permission each time.
  Verify the app, origin and environment first; use separate browser contexts
  and assigned synthetic accounts so agents cannot overwrite each other's work.
- Test tasks, not just page loads: sign in, navigate, type, save/cancel, reload,
  recover from errors and sign out. Verify saved API/database state and relevant
  role/privacy denials. Inspect layout, labels, loading and reachable controls on
  desktop and phone web. Screenshots alone do not prove a working transaction.
- Cover the affected provider, driver, shipper/broker and team roles; admin and
  platform staff remain web-only. Delegate independent journeys when requested,
  with one owner for shared fixtures and serialized heavy browser work on this Mac.
- Prefer local services and disposable owned fixtures. Production inspection
  must identify the deployed version; testing an older live version does not
  qualify the candidate. Browser permission does not expand production write,
  account, communication or release authority.
- Ask before each session using the owner's Android phone, including a dev
  build. Native permission, background location and closed-app notifications
  need actual device checks; Expo web is not a substitute. Touch only Loadgistic.
- Record observed steps, role/environment, actual outcomes and untested limits;
  report what was verified instead of claiming that clicking every page proves
  the entire platform. Reuse unchanged passing evidence to avoid repeated suites.

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
