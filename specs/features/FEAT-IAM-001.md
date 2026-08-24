---
id: FEAT-IAM-001
title: Identity, sessions, and role access
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-APP-001]
problem: Transport providers need secure workspace access while capacity seekers must be able to browse intentionally public supply without accounts or exposure to provider-private operations.
behavior: Valid active provider users sign in through Supabase Google OAuth or a numeric email one-time code and receive an SSR-compatible HTTP-only session with role-scoped workspace access. Password login exists only behind an explicit non-Production fixture boundary. Anonymous visitors may read only explicit public capacity, provider microsite, and guest-code tracking projections. Support staff use a support-only role that grants no provider-workspace or administration authority.
contracts: [IdentityLookupPort, ManagedOAuthFlow, ManagedEmailOtpFlow, AuthCallbackPolicy, SessionToken, CurrentUser, RolePolicy, SupportRolePolicy, CredentialFixtureBoundary, PrivateAccountContact]
observability: [login_outcome, rate_limit_outcome, audit_log]
rollout: Replace local signed-cookie identity with Supabase Auth in local development, browser tests, Preview, and Production; enable remote traffic only after role projection, negative authorization tests, callback URLs, and rollback evidence pass.
---

# Identity and access

### Scenario: active provider logs in with Google

Given an active managed Supabase user has a Loadgistic role projection and a linked Google identity\
When the user chooses Continue with Google\
Then Loadgistic requests only OpenID, email, and profile identity scopes\
And Supabase Auth completes authorization-code PKCE through Loadgistic's fixed callback route\
And the callback accepts no visitor-controlled destination\
And Supabase Auth establishes an SSR-compatible HTTP-only session\
And the response redirects relatively to `/app/home` on the current origin.

### Scenario: active provider logs in with an email code

Given an active managed Supabase user has a Loadgistic role projection\
When the user requests a sign-in code for their email\
Then Supabase Auth is asked to send a six-digit, ten-minute one-time code without creating an unknown user\
And the interface returns the same bounded response whether or not the address is eligible\
And a valid numeric code establishes the same SSR-compatible HTTP-only session and role-scoped destination.

### Scenario: callback and one-time-code failure stays generic

Given an OAuth callback is denied, expired, malformed, replayed, or belongs to an identity without an active Loadgistic role projection\
Or an email code is invalid, expired, malformed, or rate limited\
When authentication completes or verification is attempted\
Then no workspace session remains\
And the visitor receives a generic retry message that does not disclose account existence, suspension, provider configuration, token details, or upstream error text.

### Scenario: callback origins are deployment-owned

Given managed authentication is enabled\
When Loadgistic starts Google OAuth or an email-code flow\
Then its callback is derived from the deployment-owned `APP_URL` and the fixed `/api/auth/callback` path in Production\
And Production rejects a missing, invalid, or non-HTTPS callback origin\
And Supabase's Site URL and Redirect URL allowlist must contain the exact Preview or Production callback before traffic is enabled.

### Scenario: local fixture password login is isolated

Given deterministic fixture credentials are needed for local development or automated browser tests\
When the non-Production runtime explicitly enables fixture password login\
Then the local login form and password route may authenticate those fixtures\
And managed Preview and Production never render or accept password login.

Given an unknown email, wrong password, or suspended local fixture account\
When local password login is attempted\
Then no session is created\
And a generic credential error is returned without revealing account state.

### Scenario: managed browser sessions use the SSR boundary

Given any Loadgistic browser runtime\
When a browser creates, refreshes, or clears an identity session\
Then the browser and server use the publishable Supabase key through the SSR cookie adapter\
And request middleware refreshes expiring session cookies without exposing the service-role key\
And authorization trusts a server-validated `auth.getUser()` result mapped to an active Loadgistic role projection rather than unverified browser metadata\
And missing configuration or a missing role projection denies workspace access instead of falling back to local authentication\
And provider access tokens from Google are never persisted by Loadgistic or exposed to application UI.

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

### Scenario: public account navigation follows session state

Given the shared public navigation is rendered\
When no valid session exists\
Then it shows Transporter login and does not show Dashboard or a separate signup destination\
And the login page offers the transporter-account signup action.

Given the shared public navigation is rendered\
When a valid provider session exists\
Then Dashboard replaces Transporter login\
And neither login nor signup is shown as another public-navigation destination.

### Scenario: anonymous access is projection-bound

Given no valid session exists\
When a visitor requests the public Truck Market, published provider microsite, or code-entry Track page\
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

### Scenario: public and authenticated surfaces are installable

Given a supported mobile browser opens public or authenticated Loadgistic over a secure origin\
When the browser evaluates the web app manifest and service worker\
Then Loadgistic can be installed in standalone display mode and launches at the public Truck Market workspace\
And its manifest, browser favicon, Apple touch icon, and installable icons use the current Loadgistic brand mark\
And manifest shortcuts expose `/`, `/featured`, `/track`, and the transporter workspace as distinct application destinations\
And authenticated application pages remain network-first rather than being persisted in a shared offline page cache\
And first installation does not reload a login or application form while the user is entering data\
And the service-worker script is served with no-store update headers and a self-only script policy\
And the service worker does not cache Next.js executable chunks, preventing a framework upgrade from combining stale and current runtime modules.

## Contract ownership

- Inbound adapters: `src/app/login/page.tsx`, public capacity/provider/track pages, workspace pages, `src/app/api/auth/*`
- Application boundary: `src/lib/auth.ts`, repository user lookups, managed-identity projection
- Outbound adapters: Supabase SSR browser/server clients and Auth in local development, tests, Preview, and Production
- External configuration: Supabase Google provider, exact Site URL/Redirect URL allowlists, numeric `{{ .Token }}` email template, and verified custom SMTP
- Tests: `tests/auth-flow.test.mjs`, `tests/e2e/auth-role-language.spec.ts`, `tests/e2e/smoke.spec.ts`, `tests/repository.test.mjs`
