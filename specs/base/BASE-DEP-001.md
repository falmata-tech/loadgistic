---
id: BASE-DEP-001
title: Deployment, delivery, and operations base
related_ids: [BASE-FE-001, BASE-BE-001]
problem: Changes need reproducible validation, controlled secrets, observable health, and a reversible release path.
behavior: CI validates specs, source, tests, types, and production build before deployment artifacts are accepted.
contracts: [BuildArtifact, ContainerArtifact, RuntimeConfig, HealthEndpoint, MigrationUnit, ReleaseGate, BrowserTestRuntime, PrivateStoragePort, ManagedEmailPort, SharedRateLimitPort, ScheduledOperationsWorker, LaunchReadiness, CloudHandoff]
observability: [ci_status, health_endpoint, deployment_log, migration_log, storage_backend, email_delivery_counts, retention_cleanup_count, readiness_blocker]
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
And every runtime uses a private Supabase Storage bucket, with local development using the isolated local Supabase stack.

### Scenario: production readiness reports blockers truthfully

Given health traffic reaches a production runtime\
When durable database, private storage, session secret, or upload-scanning configuration is incomplete\
Then readiness returns an unhealthy response with non-secret blocker names\
And it never falls back to SQLite or local serverless files when Supabase is unavailable.

### Scenario: schema rollout

Given a database migration is required\
When it is prepared for release\
Then it is additive or has an explicit backup and rollback procedure\
And application compatibility across the rollout window is documented.

### Scenario: managed transactional email is durable and idempotent

Given a managed Shared capacity, Assisted matching, Tracking-access, or Tracking-completion delivery is due\
When the bounded delivery worker claims queue rows\
Then each row is leased transactionally so concurrent workers do not claim it together\
And the configured server-only email provider receives a stable idempotency key, verified sender, bounded subject, plain-text body, and escaped HTML body\
And successful delivery becomes terminal while failure records only a bounded non-secret provider status and a future retry time\
And no API key, access code, customer email, or message body is written to application logs.

### Scenario: scheduled operations are bounded and observable

Given the Production application is published on Netlify\
When the managed-operations schedule runs every fifteen minutes in UTC\
Then one worker processes bounded Tracking and access-email batches and invokes bounded expired-guest cleanup\
And its result contains counts and safe status names only\
And an infrastructure failure returns a failed invocation for operator visibility without exposing private queue rows\
And Preview or local execution can invoke the same application service explicitly without maintaining an in-memory timer.

### Scenario: public abuse limits are shared and privacy preserving

Given login, signup, Shared capacity, Assisted matching, or member Support receives a rate-limited request\
When any application instance consumes that request's limit\
Then one atomic PostgreSQL counter is authoritative across all instances\
And the counter key is an HMAC digest rather than a raw email address, IP address, account identifier, access code, or message body\
And the database returns a bounded retry interval computed from the authoritative window\
And a managed-counter failure denies the request without falling back to an instance-local counter\
And scheduled operations delete expired counter rows in bounded batches without logging counter keys.

### Scenario: browser tests are isolated from developer data

Given Playwright starts the application for a browser suite\
When the suite initializes its runtime\
Then it resets and uses a dedicated local Supabase project on dedicated ports\
And it does not reuse a running development server or its business records\
And its generated Next.js artifacts are isolated from both the live development server and production build output.

### Scenario: local development uses incremental compilation

Given a developer starts Loadgistic with the documented development command\
When application routes are opened and edited\
Then Next.js uses its stable Turbopack development bundler explicitly\
And the default local origin is the Loadgistic-owned `http://127.0.0.1:3100`, separate from other workspace applications\
And development compilation time is distinguished from repository query time\
And production performance claims are verified against a production build rather than inferred from first-visit development compilation.

### Scenario: standalone container is reproducible

Given the lockfile and supported Node runtime\
When the production Docker image is built\
Then a multi-stage build produces the Next.js standalone artifact\
And the runtime image runs as a non-root user with only required production files\
And `/api/health` is the container health check\
And PostgreSQL/Auth/Storage remain external Supabase services rather than files baked into or mounted beneath the application image.

### Scenario: cloud handoff is explicit

Given the owner is preparing Netlify and Supabase\
When project credentials become available\
Then documentation names every required non-secret variable, migration command, private bucket, callback URL, CI check, backup, and smoke test\
And the public browser credential is named `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` consistently in source, examples, and Netlify\
And `APP_URL` supplies one HTTPS deployment-owned origin for fixed Supabase Auth callbacks\
And Supabase's Site URL and Redirect URL allowlists, Google provider, numeric email template, and verified SMTP are recorded as owner-managed controls\
And secret values are entered in the deployment platforms rather than committed\
And Netlify or Docker deployment remains blocked from public production until the Supabase repository, managed identity, shared rate limit, and upload scanning contracts pass.

### Scenario: zero-cost pilot has explicit capacity boundaries

Given the owner has selected the Netlify Free and Supabase Free plans for the first commercial pilot\
When the release is prepared\
Then production deploy frequency, bandwidth, web requests, function compute, database size, storage, egress, authentication, Realtime connections, and email delivery are monitored against their hard free-plan limits\
And Preview deploys carry validation traffic before a bounded Production promotion\
And the operator maintains encrypted off-platform logical database backups because the Supabase Free plan has no downloadable automatic backups\
And the application presents a truthful temporary-unavailable state if either provider pauses service rather than falling back to local serverless files or SQLite\
And the deployment contract remains portable to Vercel Pro or a container host without changing domain behavior.

### Scenario: beta tile fallback is reported without blocking the pilot

Given the production build has no reviewed third-party tile configuration\
When launch readiness is evaluated\
Then the direct OpenStreetMap community tile origin is reported as a non-secret production warning rather than a blocker\
And the configured build never broadens Content Security Policy beyond the single resolved HTTPS tile origin\
And operators monitor traffic and can switch the public tile URL and linked attribution without changing map components\
And no application path proxies, prefetches, or bulk-copies map tiles.

### Scenario: dependency posture is current and deliberate

Given a supported framework line receives security updates\
When launch dependencies are reviewed\
Then the lockfile has no high-severity advisories\
And Next.js runs on an Active or Maintenance LTS line\
And major framework upgrades are not mixed into launch stabilization without their own migration evidence.

### Scenario: growth evidence uses disposable supply-only data

Given production is expected to serve thousands of providers and trucks\
When scale readiness is evaluated\
Then a disposable non-Production database generates at least five thousand current supply records without restoring retired demand entities\
And bounded public-query latency and payload size are recorded\
And a six-times CPU-throttled phone workflow proves the Map does not drain cursor pages in the background\
And generated identities, capacity, files, and reports are never written to Production or committed as customer data.

## Contract details

`BuildArtifact` and `ContainerArtifact` are produced from the lockfile with Node 22. `RuntimeConfig` supplies secrets outside source control. `HealthEndpoint` reports service readiness without private data. `MigrationUnit` is ordered and reviewable. `ReleaseGate` is the GitHub required-check set described in `docs/GUARDRAILS.md`. `BrowserTestRuntime` owns a disposable local Supabase project and non-development ports. `PrivateStoragePort` stores, reads, and removes opaque private references. `ManagedEmailPort` converts bounded application templates to one verified provider request without exposing provider credentials. `SharedRateLimitPort` atomically consumes HMAC-digested request buckets and purges expired buckets without exposing caller identifiers. `ScheduledOperationsWorker` leases bounded durable work and emits safe counts. `LaunchReadiness` distinguishes a locally runnable Supabase stack from a publicly deployable production stack. `CloudHandoff` lists configuration keys and owner actions without containing their values.

## Required verification

- `.github/workflows/ci.yml`
- `src/app/api/health/route.ts`
- `npm run quality`
- `npm run build`
- `npm run db:stress && npm run test:scale`
