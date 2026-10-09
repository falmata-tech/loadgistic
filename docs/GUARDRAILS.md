# Engineering guardrails

These controls apply to every major action: authentication or authorization changes, state-machine changes, public data exposure, file access, schema changes, dependency changes, deployment changes, and destructive maintenance.

## Known failures we must not repeat

Read [SECURITY_REGRESSION_REGISTER.md](SECURITY_REGRESSION_REGISTER.md) before
schema, extension, authentication, public-data, file or remote-setting changes.
Reference applicable lesson IDs in the PR and run their negative checks. When a
new failure is discovered, add its cause, prevention, evidence, owner and next
action before closing or deferring it. A table provided by an extension is still
part of the exposed database surface; an API guard does not replace RLS/ACLs.

For every new or changed migration/extension, verify the resulting catalog on a
clean database, including inherited/default and column grants, views, sequences
and SECURITY DEFINER functions. Exercise browser-role denial and preserved service
behavior. Never assume an extension installer or a successful schema migration
chose secure defaults. Adding an exposed schema or a Realtime publication requires
its own access-path review; PostgREST-only evidence does not cover either.

## Before the change

- Independent drivers (including legacy owner-operators) have one current truck,
  no driver/fleet management and no truck selector. Ownership/permission belongs
  on that truck, never an inferred account role or approval badge. Enforce the
  limit in PostgreSQL and service/API commands, including concurrent additions,
  stale replacement, restoration and admin recovery. An explicit Change truck
  archives/creates atomically, blocks unfinished Tracking and preserves all old
  record/file subjects. Do not copy approvals, private recipients, locations or
  signals to the replacement. Existing ambiguous multi-truck data must stop the
  migration for an exact reviewed correction. FEAT-FLT-001 / ADR-076 / NR-18.

- Owner's October 7 commercial rule: provider accounts have no plans,
  subscriptions, trials or platform-payment requirement. Revenue is transport
  arrangement. Do not restore paid-mode controls, automatic trial rows or
  subscription-based access as an implementation shortcut. FEAT-BIL-001 requires
  active identity, tenant links and driver permissions without a plan, and
  protection/retention of historical billing data.

- Identify the governing feature and base spec IDs.
- Confirm the product remains B2B and does not introduce Internal Fleet, auctions, forced scanning, fabricated metrics, or complex capacity analytics.
- Write the actor, tenant/record scope, preconditions, resulting state, denial behavior, and audit outcome.
- For destructive or schema actions, name the exact target, backup, compatibility window, and rollback path.
- For dependencies or workflows, pin versions and grant minimum permissions.

## Chat visibility and delivery (NR-19)

Fetching, sending or assigning is not Seen/joined. Use explicit focused-visible
acknowledgements with exact current authority, monotonic cursors and a checked
assignment epoch; retain a separate unread position for each assignment. Blocking
menus/documents must pause reads, and closing them must refresh and resume. Test
below-fold/history download and receipt transport failure against saved state.
Unassigned backlog must not hide the current worker’s unread/assigned alerts from
a bounded feed; totals remain full-scope. Initial/replayed old work must not ring.
Notification transport failure cannot block chat or create optimistic Seen.
Foreground polling is not phone push; background delivery requires its own
recipient/device, permission, privacy, credential and physical-device evidence.

Browser Notifications from a running site are distinct from Web Push. Request
permission by a deliberate click, register only a notification worker under its
unused `/_loadgistic-alerts/` scope (never root/app navigation), preserve
the denied/unsupported fallback and validate click destinations at both ends.
Never add a private offline cache while enabling alerts. Bind opt-in and delivery
deduplication to identity, clear revoked scope, and never acknowledge chat from a
system click. A driver approval alert must derive from a committed handover and
say Tracking is completed; a release/cancellation is not owner approval. Opening
that update acknowledges only the exact saved alert, with current driver authority.

## During the change

- Keep transitions in `src/lib/domain.js` and mutation authorization in server application services.
- Deny access by default and reauthorize private proof files on every read.
- Keep secrets, session tokens, credentials, proof files, and local databases out of commits and logs.
- Browser/API test failures can include Cookie and Authorization headers in their
  exception call logs. Catch them at the runner boundary and record only a safe
  stage/error name, status and counts; do not print raw Playwright request errors
  or causes. Close disposable sessions and clean exact fixtures even on failure.
- Use ETB or Quote Requested only. Display data derived from records or verified inputs.
- Prefer additive migrations and reversible feature exposure.
- Add tests with each permission, workflow, contract, or state change.

## Required gates

### Owner visual review (NR-13)

Required sequence: running dev server and owner visual testing → explicit visual
approval → extensive tests and release gates → deployment only on the owner's
explicit request. Keep the preview running during review. Visual approval is not
deployment authorization; never infer either from passing automated checks.

Performance work must preserve the existing appearance, action count, automatic
loading and discoverability. Capture that baseline before implementation and
test it independently of the optimized code. Internal aggregation or batching
does not justify exposing modes, adding clicks, hiding results or making visitors
load data manually. A specific user-experience tradeoff needs explicit owner
agreement before implementation; otherwise defer the optimization. Changing a
spec and a test to match the new design is not approval. Compare measured speed,
requests and payloads together with interaction and result completeness.

Before deploying any visible UI/map change, keep a local Loadgistic server
running against local services and provide its working URL, affected interaction
and desktop/phone captures. Run focused interaction checks, then obtain explicit
owner visual approval before expensive full release gates or publication.
CI and automated screenshots prove checks, not acceptance of a design. An earlier
release approval does not approve a later visual change. Record the reviewed
version and re-review material changes. Performance fixes must preserve the
accepted interaction unless a change is explicitly reviewed.

### Workflow regression lessons

- Check floating global controls against the full bounds of recovery, close and
  submit actions at narrow widths. A visible or large-enough button, or a clear
  center point, does not prove its whole touch target is unobstructed. Include
  support launchers and fixed navigation, not only the component under test.

- When lifecycle states or stored geometry evolve, check dashboard totals, recent
  activity ordering and list/detail wording against the current backend contract.
  A matching route or successful page load is not proof of a working control:
  verify persisted state, visible success/denial and preserved list context.

- Server-rendered controls must not accept clicks before their client handlers
  attach. For initialization races, hold client scripts in a browser regression,
  verify the disabled state, release scripts, then test the first enabled click.
  Do not hide a lost click with arbitrary waits or whole-test retries.

- When enhancing native forms with fetch, named inputs such as `action` or
  `submit` can shadow HTMLFormElement properties. Use an explicit endpoint or
  `getAttribute` and test the actual POST destination and inline success/denial.
- Before upload-browser tests, inspect the subject model and document eligibility.
  A fully verified fixture intentionally has no submission form. Truck evidence offers ownership or permission under the selected truck.
  Historical Driver permissions and new company-Driver permissions retain
  their specific Driver/truck pairing; reassignment must not transfer approval. Create and clean only
  an exact synthetic unverified subject instead of changing fixture approvals.
- Never report UI submission as successful merely because the API succeeded:
  verify the visible post-submit state too. React event `currentTarget` must
  be captured before awaiting asynchronous form work.

- Start at an empty workspace when adding onboarding or assignment flows.
  Pre-seeded drivers can prove assignment but cannot prove that a new owner can
  add a driver. Verify required email, immediate assignment while still unverified,
  denied unverified workspace access, actual inbox-code login, preserved assignment,
  first publication and revocation through their real boundaries. Retain verified
  invitation acceptance tests for legacy invitations. Adding a driver must never
  auto-confirm email, create an owner-accessible session or adopt another account.
- After a browser dependency/postinstall repair, a restarted Metro server and
  fresh automated context do not prove an existing owner tab uses the new map
  instance. Verify the Loadgistic server/port, restart that server when necessary
  and fully reload its connected preview clients before owner confirmation. Never
  clear shared caches, reset another app or suppress the overlay to simulate a fix.
  Cancellation regressions must collect console errors and unhandled rejections,
  require new counts from the intended interaction, and exercise native fetch
  response-body cancellation; pre-existing totals or an in-memory Response are
  insufficient for that contract. Preserve genuine HTTP/decode error feedback.
- Check first-use layouts before a map or record exists. Floating saved-map
  headers must not cover empty-state instructions or actions. Assert visible
  geometry and a normal first click/tap, then verify the stored first record;
  opening a dialog on an already-populated fixture is insufficient (UIA-21).
- When copying an existing SQL function into an additive migration, extract only
  the intended function and assert its function inventory. Inspect later
  migrations that patched it and preserve those fixes (including 052’s explicit
  verification variable scope); exercise the replacement command in PostgreSQL. A broad replacement
  can accidentally change an unrelated dashboard's role checks.
- Treat local Auth confirmation and sign-in email templates as distinct valid
  paths. Match a test's exact synthetic recipient and request time; inspect only
  its subject before diagnosing delivery. Never print OTPs or unrelated mail.
- Use the repository's existing type shims and wait for rendered auth targets,
  not just a changed URL, before navigating. Preserve submitter values in native
  forms and test narrow touch layouts as well as desktop.

`npm run quality` enforces specification links, required source, domain/repository tests, and TypeScript checks. GitHub CI additionally performs a clean install, production build, standalone Docker build, and desktop/mobile Playwright suite. Changed user workflows require Playwright coverage; sensitive authorization changes require negative repository tests.

No contributor may bypass a failing required check by weakening the check, deleting the scenario, or broadening permissions without a linked spec and architecture decision.

## Release and incident controls

- Separate query eligibility from its explanation. Test combined geographic
  inputs, omitted values, unknown places, and one versus two endpoints;
  `Number('')` is zero, not proof that a coordinate was supplied.
- Capture a form element before awaiting network work. Test a successful POST
  followed by a failed refresh, and guard repeated clicks immediately. Database
  read failures must not masquerade as a missing conversation.
- Check persisted active authority before creating an external Auth identity,
  not only in the database command after that side effect.
- A proof upload is incomplete until the UI offers authorized retrieval. Test
  stored bytes, guest OTP, revocation, and cross-shipment denial.
- When a browser test changes roles, clear only its own context and wait for the
  final role-specific destination and rendered content. Login redirects an
  already signed-in user; an intermediate shell is not a completed redirect.
- Run build and browser wrappers sequentially when both temporarily manage
  Next's generated type references. Parallel wrappers can restore each other's
  temporary configuration; compare those files with the pre-task snapshot.

- Deploy immutable artifacts built from `package-lock.json`.
- Store production secrets in the deployment platform, never repository variables or files.
- Verify `/api/health` after rollout and monitor server errors, authorization denials, and audit outcomes.
- Roll back the application first when safe. Data rollback requires an explicit reviewed procedure.
- Treat accidental proof exposure, cross-tenant access, credential leakage, and unauthorized mutation as security incidents; stop exposure, preserve audit evidence, rotate affected secrets, and notify the owner.

## Pull-request evidence

Every pull request must state related spec IDs, contract changes, tests run, observability impact, rollout/rollback, and whether data or security scope changed. The repository pull-request template captures this evidence.


## Production credential and schema boundary (FEAT-SEC-001)

Follow [PRODUCTION_AUTHORITY.md](PRODUCTION_AUTHORITY.md). Routine inspection has
only exact-project read scopes. Under the 2026-09-17 owner decision, only the
owner executes production changes; protected automation is a future proposal. Do not treat token format, a plan digest, AGENTS.md,
ignored files or file mode 0600 as a boundary against the same OS user. Never
bypass provider ownership with role changes, extension catalog changes or a more
privileged fallback. CI checks RLS after local schema setup, including provider-
owned extension remediation, and tests real anonymous/authenticated denial.
Current rollout still requires Supabase's owner-side repair and provider-enforced
credential/protection changes. A scheduled workflow file without its scoped token
and main-branch installation is not active monitoring.


- UIA-23: verify map layer classes and hover/keyboard focus against a compiled
  production build. React development remounts can hide constructor-only Leaflet
  option mistakes. Use accessible controls for interaction assertions and retain
  separate checks for required styling hooks; do not treat a missing test selector
  as proof that visible geometry is missing.
