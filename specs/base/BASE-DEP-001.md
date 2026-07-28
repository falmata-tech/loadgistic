---
id: BASE-DEP-001
title: Deployment, delivery, and operations base
related_ids: [BASE-FE-001, BASE-BE-001]
problem: Changes need reproducible validation, controlled secrets, observable health, and a reversible release path.
behavior: CI validates specs, source, tests, types, and production build before deployment artifacts are accepted.
contracts: [BuildArtifact, RuntimeConfig, HealthEndpoint, MigrationUnit, ReleaseGate, BrowserTestRuntime]
observability: [ci_status, health_endpoint, deployment_log, migration_log]
rollout: Promote immutable artifacts only after required checks; roll back application before destructive data changes.
---

# Deployment base specification

## Base scenarios

### Scenario: pull request validation

Given a pull request changes application, infrastructure, tests, or specifications\
When GitHub Actions runs\
Then specification integrity, source checks, tests, types, and production build must pass.

### Scenario: unsafe configuration

Given a production runtime lacks a session secret or durable production services\
When the application starts or receives health traffic\
Then deployment is rejected or reported unhealthy without exposing secret values.

### Scenario: schema rollout

Given a database migration is required\
When it is prepared for release\
Then it is additive or has an explicit backup and rollback procedure\
And application compatibility across the rollout window is documented.

### Scenario: browser tests are isolated from developer data

Given Playwright starts the application for a browser suite\
When the suite initializes its runtime\
Then it resets and uses a dedicated test database on a dedicated port\
And it does not reuse a running development server or its business records\
And its generated Next.js artifacts are isolated from both the live development server and production build output.

## Contract details

`BuildArtifact` is produced from the lockfile with Node 22. `RuntimeConfig` supplies secrets outside source control. `HealthEndpoint` reports service readiness without private data. `MigrationUnit` is ordered and reviewable. `ReleaseGate` is the GitHub required-check set described in `docs/GUARDRAILS.md`. `BrowserTestRuntime` owns a disposable SQLite fixture and a non-development port.

## Required verification

- `.github/workflows/ci.yml`
- `src/app/api/health/route.ts`
- `npm run quality`
- `npm run build`
