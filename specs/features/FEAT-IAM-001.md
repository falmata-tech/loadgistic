---
id: FEAT-IAM-001
title: Local identity, sessions, and role access
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-APP-001]
problem: Approved business users need secure workspace access while inactive or unauthorized accounts remain blocked.
behavior: Valid active users receive a signed HTTP-only session and are routed to role-scoped pages on the current browser origin.
contracts: [IdentityLookupPort, PasswordVerifier, SessionToken, CurrentUser, RolePolicy]
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

## Contract ownership

- Inbound adapters: `src/app/login/page.tsx`, `src/app/api/auth/*`
- Application boundary: `src/lib/auth.ts`, repository user lookups
- Outbound adapter: signed cookie and SQLite user store
- Tests: `tests/e2e/smoke.spec.ts`, `tests/repository.test.mjs`
