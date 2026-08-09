---
id: FEAT-DAT-001
title: Supply-first local development dataset
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-VER-001, FEAT-BIL-001, FEAT-ADM-001, FEAT-REV-001]
problem: Public capacity discovery needs enough realistic provider and truck variation to test cursor loading, clustering, provider pages, and responsive layouts without retaining obsolete demand fixtures.
behavior: Every non-Production local database receives a deterministic supply-only market with fleet providers, self-managed owner-operators, varied current radius/corridor capacity, and up to two regular corridors per provider; legacy demand, future-trip, regular-area, Business-account, and relationship fixtures are purged.
contracts: [DevelopmentDatabaseSeed, PublicCapacityCohort, LegacyDemandPurge]
observability: [database_reset_summary, public_capacity_cursor_count, seed_integrity_failure]
rollout: The dataset is deterministic and local-only; production execution of reset or fixture commands remains denied. Rollback restores a pre-migration database backup, not retired demand fixtures.
---

# Supply-first local development dataset

### Scenario: normal reset creates a busy capacity market

Given the process is not running in Production\
When a fresh local database is initialized or reset\
Then it contains 30 published provider pages across nine fleet companies and 21 self-managed provider profiles\
And it contains 47 active current-capacity signals with Empty, Partial, radius, and corridor variation\
And each provider has two regular corridors while no provider has more than two\
And Empty and Partial both include radius and corridor examples\
And every current corridor has both labels and coordinate pairs\
And the reset summary contains counts but no credentials, access codes, private messages, or file contents.

### Scenario: public cursors reach every signal once

Given the deterministic capacity cohort\
When anonymous discovery follows cursor pages to the end\
Then all 47 eligible capacity signals are returned exactly once\
And fleet and owner-operator profiles, current radius, current corridor, and regular-corridor signals are represented\
And expired, Off Duty, and unpublished signals remain excluded.

### Scenario: demand fixtures are removed

Given a local database created by an older Loadgistic version\
When the supply-first data migration runs\
Then legacy shipment-demand rows, Business organizations and users, network relationships, favorites, and Business reviews are deleted\
And provider organizations, provider profiles, fleet records, verification evidence, and provider-owned shipment records remain\
And the migration is idempotent.

### Scenario: public projection remains safe

Given the busy seed contains provider contacts and obscured truck locations\
When an anonymous visitor browses capacity or opens a provider page\
Then only provider-selected contact channels are returned\
And party email, access-code digest, password, proof file, and exact visitor location data are absent\
And provider location points remain the provider-selected privacy representation.

### Scenario: production reset is rejected

Given `NODE_ENV` is Production\
When a reset or local fixture command is requested\
Then it fails before deleting or writing data.

## Contract ownership

- Schema, purge, and deterministic seed: `src/lib/db.js`
- Reset adapter: `scripts/reset-db.mjs`
- Public cursor: `listPublicCapacityCursor` in `src/lib/repository.js`
- Tests: `tests/capacity-market.test.mjs`, `tests/e2e/smoke.spec.ts`
