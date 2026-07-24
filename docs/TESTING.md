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

Covered workflows:

- Shipper opens new shipment workflow
- Parcel company uses manual code lookup
- Transporter opens loads and capacity

Add tests for every permission or state-transition change.
