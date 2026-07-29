---
id: FEAT-DAT-001
title: Comprehensive local development dataset
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-NET-001, FEAT-VER-001, FEAT-BIL-001, FEAT-ADM-001, FEAT-REV-001]
problem: The minimal deterministic fixture keeps automated tests fast but does not provide enough related records to evaluate dense boards, long fleets, administrative queues, filtering, or responsive layouts.
behavior: An explicit development-only command resets the configured local SQLite database and adds deterministic, relationally valid records across every table and material workflow state while preserving the documented demo logins.
contracts: [StressDatasetProfile, StressDatasetGenerator, StressDatasetIntegrityReport, DevelopmentDatabaseReset]
observability: [stress_seed_summary, stress_seed_integrity_failure]
rollout: The comprehensive dataset is opt-in and local-only; normal reset and test fixtures remain small, and rollback is another normal database reset.
---

# Comprehensive local development dataset

### Scenario: developer creates the standard dataset

Given the process is not running in Production\
When the developer runs the comprehensive database command\
Then only the configured local SQLite database is reset\
And the documented demo accounts retain their existing credentials\
And deterministic users, workspaces, trucks, capacity, loads, events, interests, relationships, reviews, verification, billing, notifications, and audit records are created\
And every application table contains representative data\
And a per-table count and integrity summary is printed without credentials, tracking codes, private phone numbers, or file contents.

### Scenario: generated records preserve domain relationships

Given comprehensive data has been generated\
When integrity checks run\
Then foreign-key validation returns no violations\
And every generated organization or provider has an eligible owner\
And every truck belongs to exactly one provider scope\
And every company driver belongs to and is assigned within its fleet\
And every capacity row belongs to its truck owner\
And every rated load is Completed with two distinct Business parties\
And Pending or Dismissed low ratings do not contribute to published reputation.

### Scenario: workflow and queue states are represented

Given the standard dataset\
When its state coverage is inspected\
Then all freight transition terminal and active states are represented\
And all price, distribution, load, capacity, network, verification, application, payment, and rating-moderation states are represented\
And fresh, stale, expired, Public, Partners, private, Empty, Partial, and Off Duty capacity records exist\
And provider-owned and Business-owned screens each have enough authorized records for search and layout testing.

### Scenario: normal automated fixtures stay fast

Given comprehensive seeding is opt-in\
When normal `db:reset`, unit tests, or isolated Playwright setup runs\
Then only the existing minimal fixture is created\
And comprehensive data does not alter normal test ordering or runtime.

### Scenario: production execution is rejected

Given `NODE_ENV` is Production\
When comprehensive seeding is requested\
Then the command fails before deleting or writing a database\
And no database record changes.

## Contract ownership

- Generator: `scripts/lib/stress-data.mjs`
- Command adapter: `scripts/seed-stress-db.mjs`
- Commands: `npm run db:stress`, optional `STRESS_SCALE=1..5`
- Tests: `tests/stress-data.test.mjs`
