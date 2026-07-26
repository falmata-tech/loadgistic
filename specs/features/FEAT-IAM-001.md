---
id: FEAT-IAM-001
title: Local identity, sessions, and role access
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-APP-001]
problem: Approved businesses and transporters need secure workspace access while inactive, anonymous, or unauthorized accounts remain blocked from marketplace information.
behavior: Valid active users receive a signed HTTP-only session, are routed to role-scoped pages on the current browser origin, and must be authenticated before reading company, provider, capacity, or shipment-marketplace information.
contracts: [IdentityLookupPort, PasswordVerifier, SessionToken, CurrentUser, RolePolicy, CredentialFixtureBoundary]
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

Given an unknown email, wrong password, or inactive applicant\
When login is attempted\
Then no session is created\
And a generic credential error is returned without revealing account state.

### Scenario: role access is denied

Given an authenticated user without an allowed role\
When a protected page or command is requested\
Then access is denied or safely redirected\
And the mutation does not occur.

### Scenario: trusted development proxy preserves same-origin login

Given a browser submits login from the same public origin through a proxy that rewrites the internal host\
When the browser supplies its protected same-origin fetch metadata\
Then the mutation origin guard accepts the request\
And an explicitly cross-site request remains denied.

### Scenario: authenticated public navigation preserves session context

Given an active user has an authenticated workspace session\
When they open an authenticated company page or revisit the login route\
Then the public navigation offers a return to their workspace\
And the login route redirects them to `/app/home` without requesting credentials again.

### Scenario: anonymous marketplace information is denied

Given no valid session exists\
When a visitor requests provider directory, company page, capacity marketplace, or load information\
Then the visitor is redirected to login\
And no company, route, capacity, or marketplace record is rendered.

### Scenario: local fixture credentials are not publicly presented

Given the local database contains deterministic accounts for development and automated tests\
When an anonymous visitor opens the login page\
Then credential fields are empty\
And seeded emails and passwords are not rendered in the public response.

### Scenario: authenticated workspace is installable

Given a supported mobile browser opens Loadgistic over a secure origin\
When the browser evaluates the web app manifest and service worker\
Then the workspace can be installed in standalone display mode\
And authenticated application pages remain network-first rather than being persisted in a shared offline page cache.

## Contract ownership

- Inbound adapters: `src/app/login/page.tsx`, `src/app/companies/*`, workspace pages, `src/app/api/auth/*`
- Application boundary: `src/lib/auth.ts`, repository user lookups
- Outbound adapter: signed cookie and SQLite user store
- Tests: `tests/e2e/smoke.spec.ts`, `tests/repository.test.mjs`
