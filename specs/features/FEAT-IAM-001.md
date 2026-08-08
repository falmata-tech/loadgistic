---
id: FEAT-IAM-001
title: Local identity, sessions, and role access
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-APP-001]
problem: Transport providers need secure workspace access while capacity seekers must be able to browse intentionally public supply without accounts or exposure to provider-private operations.
behavior: Valid active provider users receive a signed HTTP-only session and role-scoped workspace access. Anonymous visitors may read only explicit public capacity, provider microsite, and guest-code tracking projections. Support staff use a support-only role that grants no provider-workspace or administration authority.
contracts: [IdentityLookupPort, PasswordVerifier, SessionToken, CurrentUser, RolePolicy, SupportRolePolicy, CredentialFixtureBoundary, PrivateAccountContact]
observability: [login_outcome, rate_limit_outcome, audit_log]
rollout: Keep local auth demo-only; migrate to managed identity before public production launch.
---

# Identity and access

### Scenario: active demo user logs in

Given an active seeded user and the correct password\
When the user submits the login form\
Then a signed HTTP-only SameSite session cookie is set\
And the response redirects relatively to `/app/home` on the current origin.

### Scenario: invalid or inactive account

Given an unknown email, wrong password, or suspended account\
When login is attempted\
Then no session is created\
And a generic credential error is returned without revealing account state.

### Scenario: role access is denied

Given an authenticated user without an allowed role\
When a protected page or command is requested\
Then access is denied or safely redirected\
And the mutation does not occur.

### Scenario: support staff remain isolated

Given an active user has the SUPPORT role\
When the user logs in\
Then the user is routed to the support inbox\
And workspace subscription enforcement does not apply\
And marketplace, tracking, fleet, verification, billing-review, and administration pages remain denied.

### Scenario: trusted development proxy preserves same-origin login

Given a browser submits login from the same public origin through a proxy that rewrites the internal host\
When the browser supplies its protected same-origin fetch metadata\
Then the mutation origin guard accepts the request\
And an explicitly cross-site request remains denied.

### Scenario: authenticated public navigation preserves session context

Given an active user has an authenticated workspace session\
When they open a public provider page or revisit the login route\
Then the public navigation offers a return to their workspace\
And the login route redirects them to `/app/home` without requesting credentials again.

### Scenario: anonymous access is projection-bound

Given no valid session exists\
When a visitor requests the public Capacity Board, provider Directory, published microsite, or code-entry Track page\
Then the explicit public projection is returned without login\
And private workspace rows, hidden contacts, exact coordinates, party emails, assignments, code digests, and proof files are absent\
And requesting any provider operating page still redirects safely to login.

### Scenario: local fixture credentials are not publicly presented

Given the local database contains deterministic accounts for development and automated tests\
When an anonymous visitor opens the login page\
Then credential fields are empty\
And seeded emails and passwords are not rendered in the public response.

### Scenario: account contacts remain private

Given an account stores an email and optional phone for login or account administration\
When any profile or directory view is rendered\
Then those values are never used as public contact fallbacks\
And public contact fields are maintained separately with explicit profile intent.

### Scenario: authenticated workspace is installable

Given a supported mobile browser opens Loadgistic over a secure origin\
When the browser evaluates the web app manifest and service worker\
Then the workspace can be installed in standalone display mode\
And its manifest, browser favicon, Apple touch icon, and installable icons use the current Loadgistic brand mark\
And authenticated application pages remain network-first rather than being persisted in a shared offline page cache\
And first installation does not reload a login or application form while the user is entering data\
And the service worker does not cache Next.js executable chunks, preventing a framework upgrade from combining stale and current runtime modules.

## Contract ownership

- Inbound adapters: `src/app/login/page.tsx`, public capacity/provider/track pages, workspace pages, `src/app/api/auth/*`
- Application boundary: `src/lib/auth.ts`, repository user lookups
- Outbound adapter: signed cookie and SQLite user store
- Tests: `tests/e2e/smoke.spec.ts`, `tests/repository.test.mjs`
