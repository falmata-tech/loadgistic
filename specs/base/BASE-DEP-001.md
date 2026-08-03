---
id: BASE-DEP-001
title: Deployment, delivery, and operations base
related_ids: [BASE-FE-001, BASE-BE-001]
problem: Changes need reproducible validation, controlled secrets, observable health, and a reversible release path.
behavior: CI validates specs, source, tests, types, and production build before deployment artifacts are accepted.
contracts: [BuildArtifact, ContainerArtifact, RuntimeConfig, HealthEndpoint, MigrationUnit, ReleaseGate, BrowserTestRuntime, PrivateStoragePort, LaunchReadiness, CloudHandoff]
observability: [ci_status, health_endpoint, deployment_log, migration_log, storage_backend, readiness_blocker]
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

### Scenario: private uploads use a durable adapter in production

Given an authorized route accepts proof, verification, payment, or capacity media\
When it validates and stores the upload\
Then the file's actual signature agrees with its permitted MIME type\
And the database stores an opaque private-storage reference rather than a public URL\
And every download rechecks domain authorization before reading that reference\
And production requires a private Supabase Storage backend while local development may use an isolated filesystem directory.

### Scenario: production readiness reports blockers truthfully

Given health traffic reaches a production runtime\
When durable database, private storage, session secret, or upload-scanning configuration is incomplete\
Then readiness returns an unhealthy response with non-secret blocker names\
And it never labels the local SQLite adapter as a scalable Supabase deployment.

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

### Scenario: local development uses incremental compilation

Given a developer starts Loadgistic with the documented development command\
When application routes are opened and edited\
Then Next.js uses its stable Turbopack development bundler explicitly\
And development compilation time is distinguished from repository query time\
And production performance claims are verified against a production build rather than inferred from first-visit development compilation.

### Scenario: standalone container is reproducible

Given the lockfile and supported Node runtime\
When the production Docker image is built\
Then a multi-stage build produces the Next.js standalone artifact\
And the runtime image runs as a non-root user with only required production files\
And `/api/health` is the container health check\
And local persistent data or upload directories are mounted explicitly rather than baked into the image.

### Scenario: cloud handoff is explicit

Given the owner is preparing Vercel and Supabase\
When project credentials become available\
Then documentation names every required non-secret variable, migration command, private bucket, callback URL, CI check, backup, and smoke test\
And secret values are entered in the deployment platforms rather than committed\
And Vercel or Docker deployment remains blocked from public production until the Supabase repository, managed identity, shared rate limit, and upload scanning contracts pass.

### Scenario: dependency posture is current and deliberate

Given a supported framework line receives security updates\
When launch dependencies are reviewed\
Then the lockfile has no high-severity advisories\
And Next.js runs on an Active or Maintenance LTS line\
And major framework upgrades are not mixed into launch stabilization without their own migration evidence.

## Contract details

`BuildArtifact` and `ContainerArtifact` are produced from the lockfile with Node 22. `RuntimeConfig` supplies secrets outside source control. `HealthEndpoint` reports service readiness without private data. `MigrationUnit` is ordered and reviewable. `ReleaseGate` is the GitHub required-check set described in `docs/GUARDRAILS.md`. `BrowserTestRuntime` owns a disposable SQLite fixture and a non-development port. `PrivateStoragePort` stores, reads, and removes opaque private references. `LaunchReadiness` distinguishes a locally runnable build from a publicly deployable production stack. `CloudHandoff` lists configuration keys and owner actions without containing their values.

## Required verification

- `.github/workflows/ci.yml`
- `src/app/api/health/route.ts`
- `npm run quality`
- `npm run build`
