---
id: FEAT-IAM-001
title: Identity, sessions, and role access
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-APP-001]
problem: Transport providers need secure workspace access while capacity seekers must be able to browse intentionally public supply without accounts or exposure to provider-private operations.
behavior: Provider and platform-team identities begin at one account-access surface and prove identity through Supabase Google OAuth or a numeric email one-time code. A valid active identity receives an SSR-compatible HTTP-only session and its role-scoped workspace, while a new or signup-eligible inactive provider identity may continue only through a short-lived signup handoff before supplying provider facts. A confirmed provider-access identity that predates the profile-bootstrap trigger is repaired only when it has no role reservation or workspace association. Password login exists only behind an explicit non-Production fixture boundary. Anonymous visitors may read only explicit public capacity, provider microsite, and guest-code tracking projections. Support staff use a support-only role that grants no provider-workspace or administration authority.
contracts: [IdentityLookupPort, ManagedOAuthFlow, ManagedEmailOtpFlow, ManagedSignupIdentityHandoff, AuthCallbackPolicy, SessionToken, CurrentUser, RolePolicy, SupportRolePolicy, CredentialFixtureBoundary, PrivateAccountContact]
observability: [login_outcome, rate_limit_outcome, audit_log]
rollout: Replace local signed-cookie identity with Supabase Auth in local development, browser tests, Preview, and Production; enable remote traffic only after role projection, negative authorization tests, callback URLs, and rollback evidence pass.
---

# Identity and access

### Scenario: Google account access is bound to one flow

Given an active managed Supabase user has a Loadgistic role projection and a linked Google identity\
When the user chooses Continue with Google\
Then Loadgistic requests only OpenID, email, and profile identity scopes\
And Supabase Auth completes authorization-code PKCE through Loadgistic's fixed callback route\
And Loadgistic stores a signed, HTTP-only, short-lived account-access intent bound to the exact Supabase PKCE flow identifier\
And the callback exchanges a code only with the verifier selected by that one-time signed intent\
And the callback accepts no visitor-controlled destination\
And the browser security policy allows that top-level form redirect only through Loadgistic, the exact validated Supabase Auth origin, and the fixed Google Accounts origin, so the visible action reaches Google without weakening other form destinations\
And Supabase Auth establishes an SSR-compatible HTTP-only session\
And the response redirects relatively to the user's server-authorized role workspace on the current origin.

### Scenario: active provider logs in with an email code

Given an active managed Supabase user has a Loadgistic role projection\
When the user proves that identity with a valid six-digit email code from the shared account-access surface\
Then Supabase Auth establishes an SSR-compatible HTTP-only session\
And the server-validated role projection selects the user's role-scoped destination.

### Scenario: one neutral login surface serves existing and new identities

Given a signed-out visitor opens account access on desktop or mobile\
When the public header, navigation, and account-access screen render\
Then the customer-facing action and page name are simply Log in rather than Transporter login\
And the Log in action remains in the public header at both widths while Dashboard replaces it after authentication\
And one concise surface offers email-code and Google proof without asking the visitor to choose login versus signup first\
And an existing active identity continues to its authorized workspace while an eligible new identity continues to the short provider-setup workflow\
And operational explanations, implementation notes, environment details, and repeated marketing copy do not compete with the identity controls.

### Scenario: email account access does not disclose account existence

Given a visitor supplies any syntactically valid email at the shared account-access surface\
When the visitor requests a six-digit, ten-minute one-time code\
Then the interface returns the same bounded response and code-entry state whether the identity is active, inactive, new, suspended, or otherwise ineligible\
And Supabase Auth may create at most one inactive identity with no Loadgistic workspace authority for a new address\
And response copy, status, and the pre-verification interface do not disclose whether an account existed\
And five email-scoped requests per ten-minute window permit ordinary correction and resend attempts before an exact approximate retry delay is shown.

### Scenario: a new provider proves identity without a password

Given a visitor proves a Google or email-code identity through the shared account-access surface\
And that identity has no active Loadgistic role projection and is eligible for provider setup\
When the server resolves the verified identity\
Then Loadgistic creates only a signed, HTTP-only, 15-minute signup handoff\
And Supabase Auth retains at most one inactive identity that has no Loadgistic workspace authority\
And the verified identity continues to the provider-details step without another Google or email-code choice\
And the login email is not published or reused as a public contact\
And no password is requested, stored, or accepted.

### Scenario: a confirmed pre-bootstrap identity is safely reconciled

Given a confirmed Supabase Auth identity predates the Loadgistic profile-bootstrap trigger\
And it has an email but no profile, application, provider profile, organization membership, Driver record, Driver permission, truck assignment, Support profile, platform role metadata, or provisioning metadata\
When the guarded identity-reconciliation migration runs\
Then exactly one inactive DRIVER bootstrap profile is created from that same Auth identity\
And the user may complete the same Google or email-code provider setup flow as a newly verified identity\
And an identity with a role reservation, provisioning metadata, or any existing workspace association is not changed.

### Scenario: provider setup accepts only a pristine bootstrap identity

Given a managed identity has completed Google or email-code proof\
When Loadgistic evaluates eligibility for first-time provider setup\
Then the identity must have a confirmed email and exactly one inactive DRIVER bootstrap profile\
And it must have no application, provider profile, organization membership, fleet-Driver record, Driver permission, vehicle assignment, support profile, or platform-role reservation metadata\
And an inactive ADMIN, SUPPORT user, suspended provider, company Driver, previously provisioned independent Driver, or platform-reserved identity is denied without changing its role, activation, associations, or signup intent\
And the eligibility check and completion run through one service-role-only database boundary while the identity and profile are locked.

Given a signup handoff is missing, expired, altered, or does not match the email-code flow\
When provider details or a signup code is submitted\
Then no provider workspace is created\
And the response gives a generic restart message without exposing identity or upstream provider state.

### Scenario: callback and one-time-code failure stays generic

Given an OAuth callback is denied, expired, malformed, replayed, missing its signed flow intent, conflicts with a returned PKCE flow identifier, or resolves to an identity eligible for neither a role workspace nor provider setup\
Or an email code is invalid, expired, malformed, or rate limited\
When authentication completes or verification is attempted\
Then no workspace session remains\
And the OAuth flow intent and any stale signup handoff are cleared\
And the visitor receives a generic retry message that does not disclose account existence, suspension, provider configuration, token details, or upstream error text.

### Scenario: callback origins are deployment-owned

Given managed authentication is enabled\
When Loadgistic starts Google OAuth or an email-code flow\
Then its callback is derived from the deployment-owned `APP_URL` and the fixed `/api/auth/callback` path in Production\
And Production rejects a missing, invalid, or non-HTTPS callback origin\
And local development uses the validated public browser origin, including its exact loopback host and port, so the PKCE verifier cookie and callback remain same-origin\
And the form-action policy accepts HTTPS Supabase origins in Production, permits HTTP only for loopback Supabase during non-Production development, rejects embedded credentials or unsupported protocols, and otherwise remains self-only\
And Supabase's Site URL and Redirect URL allowlist must contain the exact callback before traffic is enabled because the flow selector remains in the signed HTTP-only handoff rather than the redirect URL.

### Scenario: Google clients are isolated by environment

Given Google identity is enabled for local development and hosted Production\
When Supabase starts either Auth environment\
Then local development uses a dedicated Google Web client whose approved application origins include the supported `127.0.0.1` and `localhost` origins on the default `3100` and alternate `3001` ports, and whose single Supabase callback is `http://127.0.0.1:55321/auth/v1/callback`\
And Production uses a separate Google Web client whose application origin is the canonical HTTPS Loadgistic origin and whose Supabase callback belongs to the exact hosted project\
And each client requests only OpenID, email, and profile scopes\
And local credentials come from an ignored mode-`0600` file while hosted credentials remain in Supabase Auth configuration\
And no Google client secret is committed, printed, placed in Netlify browser variables, or copied between environments.

### Scenario: local account email is testable without pretending Gmail delivery

Given the isolated local Supabase stack captures Auth email in its local inbox\
When a developer requests an account-access email code\
Then the code is delivered only to the local Auth inbox rather than an external mailbox\
And the local account-access request and code steps link to that inbox before a developer expects external delivery\
And Preview and Production never render the local-inbox link.

### Scenario: local fixture password login is isolated

Given deterministic fixture credentials are needed for local development or automated browser tests\
When the non-Production runtime explicitly enables fixture password login\
Then the local account-access disclosure and password route authenticate those fixtures only through the isolated local Supabase Auth project\
And no signed-cookie or SQLite identity fallback exists\
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

### Scenario: browser sessions cannot mutate identity authority

Given any anonymous or authenticated browser session, including a newly created inactive identity\
When it attempts to insert, update, delete, activate, or change the role of a Loadgistic profile directly\
Then Postgres denies the mutation or affects zero rows\
And only an authorized managed server command may change profile role or activation.

### Scenario: support staff remain isolated

Given an active user has the SUPPORT role\
When the user logs in\
Then the identity was provisioned by an administrator and uses managed Google or email-code sign-in without a Loadgistic password\
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
And the account-access route redirects them to their server-authorized role workspace without requesting credentials again.

### Scenario: public account navigation follows session state

Given the shared public navigation is rendered\
When no valid session exists\
Then it shows one transporter account-access destination and does not ask the visitor to choose Login or Join\
And the account-access surface keeps Google and email-code identity proof directly reachable without presenting a Production password choice\
And no separate public signup destination or pre-verification account-type choice is shown.

Given the shared public navigation is rendered\
When a valid provider session exists\
Then Dashboard replaces the transporter account-access destination\
And neither account access nor signup is shown as another public-navigation destination.

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
And manifest shortcuts expose `/`, `/shared-capacity`, `/track`, `/featured`, and the transporter workspace as distinct application destinations\
And authenticated application pages remain network-first rather than being persisted in a shared offline page cache\
And first installation does not reload a login or application form while the user is entering data\
And the service-worker script is served with no-store update headers and a self-only script policy\
And the service worker does not cache Next.js executable chunks, preventing a framework upgrade from combining stale and current runtime modules.

## Contract ownership

- Inbound adapters: `src/app/login/page.tsx`, public capacity/provider/track pages, workspace pages, `src/app/api/auth/*`
- Application boundary: `src/lib/auth.ts`, repository user lookups, managed-identity projection
- Outbound adapters: Supabase SSR browser/server clients and Auth in local development, tests, Preview, and Production
- External configuration: Supabase Google provider, exact Site URL/Redirect URL allowlists, numeric `{{ .Token }}` email template, and verified custom SMTP
- Tests: `tests/auth-flow.test.mjs`, `tests/security-headers.test.mjs`, `tests/provider-signup-supabase.test.mjs`, `scripts/verify-supabase-provider-signup.mjs`, `tests/e2e/auth-role-language.spec.ts`, `tests/e2e/smoke.spec.ts`, `tests/repository.test.mjs`
