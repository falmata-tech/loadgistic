# Testing

## Pure domain and repository tests

```bash
npm test
```

These tests use Node's test runner and an isolated SQLite file.

`tests/authorization.test.mjs` is the negative contract suite for role, tenant, record-party, Connected-partner, tracking-code, proof-file, terminal-review, and expired-subscription boundaries. Add denial coverage there whenever a protected service changes.

## Type and source checks

```bash
npm run check:specs
npm run check:source
npm run typecheck
```

Run the standard local gate with:

```bash
npm run quality
```

The specification check validates required front matter, stable unique IDs, linked related IDs, base linkage, contracts, observability, and Given/When/Then coverage.

`tsconfig.offline.json` is used only in the artifact build environment where npm dependencies are unavailable. Normal development uses `tsconfig.json` and installed framework types.

## Browser tests

```bash
npm run test:e2e
```

Playwright resets `data/test-e2e.db`, writes generated Next.js artifacts to `.next-e2e`, and starts a dedicated application server on port `3100`. Normal development and production builds retain the standard `.next` path, and the parent E2E runner restores Next's generated TypeScript metadata after Playwright exits. Browser scenarios therefore cannot mutate developer business records or remove generated files from the live application. Fixture credentials stay in the test source and local setup documentation; they are not rendered by the public login page.

Covered workflows:

- Public homepage identifies Ethiopian producer audiences and preserves separate Business, Fleet Transporter, and Self-managed Driver application paths
- Business opens the rich Post Load workflow
- Fleet Transporter lands on a management dashboard and updates an individual truck inside My Fleet
- Self-managed Driver retains the rich capacity control panel as Home
- Provider searches marketplace demand by truck route but sees only involved loads in Tracking
- Business ranks Capacity Board trucks against an owned open load
- Signed-in members browse Business and transporter profiles with declared regions but without private account contacts
- Members and administrators open their role-specific verification workflows
- Assigned-provider tracking enforces the load's selected mode
- Transporter opens loads and capacity
- Authenticated public-company navigation retains its session and preselects the requested provider
- Expired workspaces retain Home and Plan & billing while operating navigation and deep links are denied
- Application approval creates a seven-day trial or Business-only sponsorship, and payment approval creates a 30-day period
- Public login does not expose local fixture credentials
- A member starts one private support conversation, the assigned SUPPORT agent
  replies and closes it, and an Administrator supervises the team

Add tests for every permission or state-transition change.

## Comprehensive data and dense UI audit

```bash
npm run db:stress
npm run dev
npm run test:ui-stress
```

The stress generator validates all 34 application tables, foreign keys, entity
ownership, fleet assignments, rating eligibility, Local/Between cities/Both
movement coverage, support queues, and material workflow-state coverage.
`tests/stress-data.test.mjs` runs the same generator against an isolated
database and proves that Production execution is rejected before any database
change.

The dense UI audit signs in as Business, Fleet Transporter, generated fleet
owner, generated Self-managed Driver, expired Business, and Administrator
personas. It captures 74 desktop/mobile screens, including Connected, Requests,
Favorites, Partners and Direct visibility, second-page Board, Directory, and
Operations results, route comparison, and the limited billing experience. It
checks expected cohort content, response
status, browser errors, horizontal overflow, render time, DOM size, and card
density. Local evidence is written to the ignored `artifacts/stress-ui/`
directory.
