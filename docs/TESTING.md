# Testing

## Pure domain and repository tests

```bash
npm test
```

These tests use Node's test runner and an isolated SQLite file.

`tests/authorization.test.mjs` is the negative contract suite for role, tenant, record-party, saved-partner, proof-file, and terminal-review boundaries. Add denial coverage there whenever a protected service changes.

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

Playwright resets `data/test-e2e.db` and starts a dedicated application server on port `3100`. It never reuses the development server on port `3000`, so browser scenarios cannot mutate or depend on a developer's local business records. Fixture credentials stay in the test source and local setup documentation; they are not rendered by the public login page.

Covered workflows:

- Business opens the rich Post Load workflow
- Provider sees marketplace demand on the Load Board but only involved loads in Tracking
- Signed-in members browse Business and transporter profiles without private account contacts
- Members and administrators open their role-specific verification workflows
- Assigned-provider tracking enforces the load's selected mode
- Transporter opens loads and capacity
- Authenticated public-company navigation retains its session and preselects the requested provider
- Public login does not expose local fixture credentials

Add tests for every permission or state-transition change.
