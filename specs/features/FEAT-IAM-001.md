---

id: FEAT-IAM-001
title: Identity, sessions, and role access
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-APP-001, FEAT-FLT-001, FEAT-PLY-001, FEAT-PRV-001, FEAT-MKT-001, FEAT-FTR-001, FEAT-TRK-001]
problem: Transport providers need secure workspace access while capacity seekers must be able to browse intentionally public supply without accounts or exposure to provider-private operations.
behavior: Provider and platform-team identities begin at one account-access surface and prove identity through a numeric Supabase email one-time code; Google account entry is temporarily disabled by owner decision. A valid active identity receives an SSR-compatible HTTP-only session and its role-scoped workspace, while a new or signup-eligible inactive provider identity may continue only through a short-lived signup handoff before supplying provider facts. A confirmed provider-access identity that predates the profile-bootstrap trigger is repaired only when it has no role reservation or workspace association. Ordinary identities have no password entry; fixture login remains behind an explicit non-Production boundary. FEAT-PLY-001 separately defines registered synthetic reviewer login through normal authentication, without granting ordinary passwords or staff access. Anonymous visitors may read only explicit public capacity, provider microsite, and guest-code tracking projections. Support staff use a support-only role that grants no provider-workspace or administration authority.
contracts: [IdentityLookupPort, ManagedOAuthFlow, ManagedEmailOtpFlow, ManagedSignupIdentityHandoff, AuthCallbackPolicy, SessionToken, CurrentUser, RolePolicy, SupportRolePolicy, CredentialFixtureBoundary, PrivateAccountContact, AccountDetailsInput]
observability: [login_outcome, rate_limit_outcome, audit_log]
rollout: Replace local signed-cookie identity with Supabase Auth in local development, browser tests, Preview, and Production; enable remote traffic only after role projection, negative authorization tests, callback URLs, and rollback evidence pass.
---

# Identity and access

## October 18 public account identity — approved local implementation plan

Transport Provider owners choose a public Account name and unique handle,
separately from private personal registration names and legacy organization/
provider persistence anchors. Account manager is the current owner's first name
only; no public manager editor or legal/father-name inference is authorized.

Given a provider signs up or edits their public identity\
When they save a chosen Account name and valid available handle\
Then these presentation fields do not select or change account role, ownership,
driving status, fleet qualification, customer business membership or permissions\
And private first/Last or father names retain the existing authorized edit rules\
And the manager value is derived from the current owner first name only.

Given another provider or customer business claims the same handle concurrently\
Then at most one succeeds and no partial profile/signup is committed\
And an old public handle remains reserved to its original provider and resolves
to the same current public profile, subject to existing publication/moderation.
Business reservations never resolve to a public provider page. Different owned
workspaces require distinct handles. Existing cross-type conflicts stop rollout
without automatic renaming. Completed account erasure clears the chosen Account
name together with existing personal content; private handle tombstones prevent
impersonation and cannot resolve an unpublished or deleted provider.

Legacy clients may omit the new fields without erasing them. Personal fallback
uses only the existing public first name, never a stored business_name containing
an old legal name. Existing deliberately public company names remain a compatible
fallback. Additive167 and focused authorization/privacy/concurrency tests must
pass before local installation; owner visual approval and hosted rollout remain
separate gates. No billing or business-Team changes are part of this correction.

The initial local rehearsal stopped at the global-collision gate. Read-only
checks identified one October7 `provider-support.spec.ts` synthetic role-switch
fixture that had created an organization and provider with the same generated
handle. The old fixture had no page, truck or organization membership. The local
repair is separately bounded to that exact positively identified synthetic
organization;167 does not rename existing accounts or bypass conflict checks.
The E2E fixture now uses distinct `support-org-` and `support-driver-` handles.
Focused coverage: `tests/provider-public-account-identity.test.mjs` and
`tests/sql/provider-public-account-identity.sql`; the latter exercises actual
signup, own profile edits, global namespace conflicts/rollback, safe aliases,
manager-only first names, search and completed erasure.

## October 18 customer context — planned local implementation

FEAT-ENT-001 adds a CUSTOMER workspace context after verified email identity and
current business membership. Stored legacy SHIPPER roles grant no workspace
permission. The authenticated projection retains its provider anchors and base
platform role; selecting an exact authorized business changes only the effective
workspace context. ADMIN and SUPPORT remain web-only and cannot create/join a
customer business. Removed membership, inactive identity and stale selections
lose access on the next authoritative request. Browser and Expo contracts carry
only current membership summaries, never a client assertion of authority.

Focused mapping: `tests/business-context-identity.test.mjs`,
`tests/business-workspace-ui.test.mjs`, `tests/provider-support-policy.test.mjs`,
`tests/managed-identity.test.mjs` and the existing native session/Auth/account
checks cover context revocation, platform denial, saved-record-first editing,
role-limited Team controls and preserved provider access. The local Chrome
owner/staff workflow has exercised creation, delivered invitation, acceptance,
save/cancel, permission revocation and restoration through the actual controls.
The exact findings and screenshots are retained in the ignored local review
folder; a separate follow-up is resolving customer Support alerts. Owner visual
approval, the remaining workflow checks and deployment remain separate gates
tracked under FEAT-ENT-001. `tests/web-workspace-navigation.test.mjs` also checks
that customer Support remains visible while driver unloading alerts follow the
verified base provider/driver identity, including after a business switch.

Given a verified provider also belongs to a customer business\
When they deliberately choose a workspace\
Then provider and customer tasks use separate current server-verified contexts\
And switching never converts their provider identity or exposes another business.

Given a new eligible identity verifies their email\
Then they choose provider setup or a business workspace\
And joining a business requires its matching current invitation\
And a platform account cannot gain customer/mobile access by selecting a business.

## October 15 bounded web sign-out — verified locally

Dashboard testing exposed an unbounded Auth request before logout and in logout.
The exact POST logout route retains origin checks but skips redundant session
refresh. A bounded provider sign-out attempt is followed by expiring only this
project's configured Auth cookies. Normal form navigation applies the response;
no client finally block reports success after a failed request.

### Scenario: logout remains usable when the Auth service stalls

Given a signed-in provider or staff member chooses Log out\
When the remote revocation attempt exceeds its short deadline\
Then the browser's local project session is cleared with a bounded response\
And the page explains that signing out other devices was not confirmed\
And other projects' cookies are unchanged\
And cross-origin mutations remain denied\
And ordinary authorized requests still refresh/verify their sessions.

Support polling pauses before same-window form navigation/pageleave and starts
from the exact server-rendered revision. Logout uses a fixed relative login
redirect, preserving CSP under local/reverse proxies. Focused Auth/dashboard
regressions pass; actual staff phone logout submits once, receives303 and lands
on same-origin login without browser errors. See NR-52 and local evidence in
`specs/TRACEABILITY.md`. Hosted deployment and owner visual approval are pending.

## October 14 Transport Provider capabilities — implemented locally

FEAT-FLT-001 / ADR-079 supersede owner account-category limits. The public name
is Transport Provider for all provider owners. Preserve legacy role/Auth/provider
IDs as internal compatibility, but derive owner capabilities from authenticated
ownership and current assignments, not the marketing name or a client flag.
An employer's personal-provider anchor is distinct from an employee's own owner
anchor. Support/Brokerage/Admin stay web-only with unchanged staff permissions.
The backed-up local installation and focused permission/SQL checks pass; actual
browser, owner visual and hosted-release status is recorded in `specs/TRACEABILITY.md`.

### Scenario: capabilities preserve the correct Home

Given an authorized provider owner personally drives an assigned truck\
When they open My workspace on web or Expo\
Then Home remains the map with immediate capacity/location/Tracking controls\
And fleet controls are additionally available in their existing truck/account area.

Given a provider owner does not drive a current truck\
Then Home shows their managed trucks/drivers rather than another driver's map.

Given an employed driver belongs to either owner-anchor type\
Then only their exact current assigned truck and saved owner-controlled permissions
are available, never fleet/driver administration or public owner identity.

### Scenario: compatibility does not escalate authority

Given legacy sessions or direct commands carry old provider operating-model names\
When current identity is resolved\
Then persisted owner relationships decide fleet access\
And inactive/cross-owner/staff identities cannot obtain provider authority\
And personal first-name/public-contact privacy and private last/father names remain
as defined in the October13 contract below.

## October 13 personal identity correction — planned, local implementation

Owner clarification: limit personal public details while retaining company
business information. Personal public identity is the first name, an existing
public handle, explicitly published contact number and optional portrait. Do not
invent a handle or public page for an employed driver. Company names, About and
reviewed company documents retain their existing publication rules.

### Scenario: first name and private Last / father name

Given a new provider or an existing eligible account edits personal identity\
When it saves First name and Last / father name on web or mobile\
Then the structured first name is the personal public display name\
And the last/father name and retained full name remain private account data\
And existing historical full names are retained without guessing a last-name split\
And legacy personal names use a whitespace-normalized first-token fallback until
the person saves structured details\
And company business identity and existing handles do not change.

### Scenario: fleet contact edits preserve structured personal identity

Given an employed driver has chosen a compound public first name and a private
Last / father name\
When an authorized fleet owner corrects the legacy driver contact name or phone\
Then the private fleet name and authorized callback are updated and audited\
And the driver’s structured first and last names are preserved; a single legacy
name field cannot infer or replace them\
And foreign, inactive and self-targeted fleet mutations remain denied.

Release correction 175 preserves the existing owner lock, driver scope, callback
sync and audit. It changes no existing account records during migration. The
rollback-only `tests/sql/personal-public-identity.sql` covers the structured-name
preservation and public projection. Keep this privacy correction during any app
rollback; the previous function is not a safe name-preserving fallback.

### Scenario: one safe public identity at every read boundary

Given personal names include spaces, tabs, newlines or Unicode whitespace\
When public/private-email guest capacity, transporter search, Featured, public
profiles or guest Tracking project personal identity\
Then only the safe first name and allowed public contact/photo fields are returned\
And neither a private surname nor a personal legacy business-name copy reaches
HTML, serialized page data, API responses or the search index\
And private account email/phone and portrait object references are absent\
And company identity, visibility, truck eligibility and document access remain unchanged.

Private account and authorized fleet/shipment management remain private workflows;
their existing actor/record authority may receive necessary full names. This
correction does not remove owner management authority or expose it to email-only
guests. Account roles, authentication, memberships and handles are not changed.

### Scenario: a driver manages their public callback independently

Given an active driver edits their own personal public details\
When they save an explicitly entered public contact number or clear it\
Then only their current authorized public callback changes\
And private account phone remains separate with no fallback\
And another driver's contact, fleet permissions and assignment cannot change\
And inactive, foreign, stale and browser-database mutations fail closed.

Account/public phone validation accepts the same common spaces, parentheses,
hyphens and periods as signup while requiring at least seven actual digits and
bounded length. An untouched valid signup number must not prevent a later name
edit; punctuation alone and extra authority fields remain invalid. Formatting
does not cause an automatic private-to-public copy.

### Scenario: account deletion includes new personal fields

Given an eligible account has saved structured first/last names and a configured
public contact number\
When its existing authorized account-erasure workflow removes personal details\
Then first_name, last_name and public_callback_phone are cleared with the older
name/contact fields and the callback configuration is reset\
And its signup intents are removed under the existing erasure scope\
And unrelated accounts, shared-file safeguards, required holds and shipment
history keep their current protection\
And adding new identity columns cannot leave names or contacts behind after a
successful deletion outcome.

Contracts: structured firstName and lastName map to nullable first_name and
last_name. The existing phone remains private. Optional publicCallbackPhone is
an explicit public change; omission preserves the prior choice and an empty
value hides it. A configured flag prevents clearing a callback from resurrecting
an older public value. Before explicit configuration only an already intentional
public callback may be retained; account phone/email never supply a fallback.
Explicit compound first names are allowed; historical fallback normalizes
Unicode whitespace before taking one token. Last names are not inferred.

Compatibility: additive schema/commands precede matching clients. Retain old
names, contacts, portraits and history; obsolete clients must never erase new
structured fields by omission. Exact SQL, protected backup, rehearsal and rollback
require separate hosted approval. Reverting to old public projections can
reintroduce surname disclosure; retain the new projection for an application
fallback, or block personal public serving during bounded database recovery.
No hosted identity change is authorized here.
Focused permission/serialization/normalization and real edit/reload/upload browser
tests are required before visual review and later full release gates.

### Scenario: an account editor fails closed until private details load

Given a signed-in user opens their account editor without a successful current
account-details response\
When that initial read fails or is still pending\
Then the editor offers clear recovery and cannot submit blank fallback fields
as authoritative replacements\
And retrying loads the same authorized account's saved details before enabling
Save\
And a failed read cannot erase an existing private last/father name or contact\
And a previously loaded user's drafts cannot transfer to a different identity.

October13 mobile maintenance audit found the initial-error path rendering blank
fields with enabled Save. The scoped readiness/retry correction passes component
regressions for initial failure, restored private fields, retained drafts and
identity changes. Actual failed-read/retry/persistence browser verification is
separate; no new account capability or hosted change is part of this correction.

October 9 local implementation: FEAT-PLY-001 adds a separately registered,
private synthetic review identity using normal password authentication. This is
not fixture login or an alternate password path for ordinary accounts. Trusted
Auth metadata, current registry/role/workspace scope and revocation are checked
on every use. Its demo-only guest grants use unrelated random digests and deny
foreign workspaces. No production reviewer has been provisioned yet; ordinary
production accounts still use email codes. The reviewed rollout remains pending.

October 7 current model: Owner-operator and Self-managed driver accounts display
Independent driver and retain DRIVER role/provider identity. Historical signup
records remain unchanged. Current projection and compatible legacy inputs
normalize to SELF_MANAGED_DRIVER; ownership is a truck attribute. No merging or
recreation of Auth users/fleet/staff associations. FEAT-APP-001 / FEAT-FLT-001 govern.

## Company-driver invitation acceptance (verified locally; remote rollout pending)

FEAT-FLT-001 defines the invitation lifecycle. Existing email OTP and Google
verification remain the only identity proof. A pending fleet invitation for the
verified email takes a pristine identity to a focused Join fleet confirmation
before independent-provider setup. The recipient explicitly accepts; knowing an
invitation ID or submitting an email never grants membership. Acceptance repeats
confirmed-email, expiry, cancellation, account eligibility, and fleet checks in
one locked database command. Existing independent providers or other fleet/staff
identities cannot be repurposed. Offboarding revokes driver workspace authority
without deleting authentication, shipment, document, or assignment history.

Evidence: fleet onboarding unit/security tests and the desktop/phone new-fleet
browser flow, including local Auth OTP email and invitation notification delivery.
The Google callback uses the same verified-ID invitation decision; new real
Google consent and hosted delivery remain separate rollout checks.

### Current rollout: email-only access — owner request, 2026-09-23

Given the owner has paused Google account access
When someone opens login or begins account setup
Then the only public account-entry action requests a six-digit email code
And the compact login surface retains clear error, code-entry and different-email states
And stale/direct Google start URLs and OAuth callbacks return to email login
without starting OAuth, exchanging a code or granting a new app session
And email OTP, signup handoff, existing accounts/sessions and local-only fixture
access preserve their current authorization rules.

Enforce this in application routes as well as the visible page. Keep the retained
Google flow behind a single disabled policy constant for a future reviewed
reenablement; do not change hosted provider credentials/configuration or revoke
sessions. The Google scenarios below describe retained disabled capability.
Focused proof: actual local inbox-code sign-in, direct endpoint/callback denial,
responsive/a11y login states. Rollback is a reviewed application revision.

### Owner demo inbox aliases — 2026-09-23

Given an account is positively identified by the existing local/production demo
fixture marker and immutable fixture key
When the owner requests distinct plus-addresses at their own inbox
Then a reviewed, backed-up email-only correction preserves the Auth user ID,
application role, assignments, records and profile synchronization
And collisions, untagged identities, wrong projects and unexpected current
addresses stop the correction before unrelated accounts are changed
And demo users sign in through the normal email-code form, without public demo
credentials or a shortcut that bypasses email proof.

Normal local development defaults the fixture password form off. The isolated
E2E runner may explicitly enable its existing local-only credential boundary;
automated ephemeral test recipients remain isolated from real inbox delivery.
The owner inbox and full alias roster stay in protected local operational files.
Delivery to an external inbox is a separate check from changing an account email.
No hosted SMTP/provider setting is changed by an identity email correction.
A later additive pilot import must retain an existing tagged Auth identity's
current email in its profile projection, rather than resetting it to a fake address.

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

## Account details maintenance (verified locally; remote rollout pending)

The existing Account surface allows active providers (including Company
drivers) and administrators to edit their own name and optional account phone,
regardless of historical billing state. The October13 personal-identity correction
above supersedes the shared-public-full-name interpretation: personal public
reads use only the safe first name; full names remain in authorized private
workflows. Company-driver private name copies stay consistent. Public
callback phones and business contacts remain separate. Email proof/change,
account closure (specified separately below), role changes and administrator editing of other users are outside
this command.

### Scenario: save account details without changing public contacts

Given an active eligible account opens Account, regardless of historical billing state\
When it saves a trimmed name of 2–100 characters and an optional phone of 7–32
characters containing at least seven digits and only phone punctuation\
Then only that authenticated actor's display name and private phone change\
And a Company driver's active fleet name copy follows the name change\
And blank phone removes the private account phone\
And email, Auth identity, role, activity, memberships, permissions, business
contacts and fleet callback phones are unchanged\
And the visible form confirms persistence and survives reload\
And the native POST fallback saves without putting contacts in the URL.

### Scenario: account mutation fails safely

Given a signed-out, inactive or unsupported-role actor, malformed input, extra
authority fields, or a cross-origin request\
When account details are submitted\
Then no account or public contact changes\
And the response is generic and contains no upstream database errors\
And the enhanced form keeps rejected input available for correction\
And browser roles cannot execute the managed command or mutate profiles directly.

### Scenario: fleet contact editing preserves account phone ownership

Given a Company driver has a private account phone\
When the fleet owner corrects the fleet Driver name and callback phone\
Then the callback and shared display name change\
And the private account phone is retained.

Contract: `updateOwnAccountDetails` accepts the verified session actor and strict
`{name,phone}` input; service-only `update_own_account_details` repeats active
role and input checks under row locks and records `ACCOUNT_DETAILS_UPDATED`
without names or contacts in audit details. Migration 086 is additive for account
editing and narrowly replaces the fleet contact command. Deploy schema before
UI; application rollback hides editing while retaining saved values and the
phone-isolation fix. No remote apply is authorized. Tests:
`tests/account-details.test.mjs`, `tests/sql/account-details.sql`,
`tests/e2e/account-details.spec.ts`.

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

## Public portrait control (FEAT-FTR-001; verified locally, rollout pending)

Given an active Driver opens Account, regardless of historical billing state\
When they manage their own portrait\
Then the distinct Public Driver photo card explains publication, requires consent
for each upload and offers removal. Company drivers control their own photo;
account phone and fleet callback editing remain separate. FEAT-FTR-001 owns
image normalization, storage, public reads and cleanup contracts.

## Verified email change and account deactivation (F09, implementation)

Owner decision, 2026-09-14: deactivate access and retain history; block closure
until active work is resolved. This is not a deletion or erasure workflow.

Given an active provider requests an email change or deactivation from Account\
When the server validates the action and rate limits\
Then a fresh numeric Supabase Auth code is sent to the current login email with
account creation disabled\
And a short-lived signed HttpOnly handoff binds the actor, operation and target\
And an expired, mismatched or invalid proof performs no account mutation.

Given the current email code was verified for the same actor\
When an email change is requested\
Then the actor's own Supabase Auth session requests the new email and the user
follows the provider's confirmation links\
And existing secure-email-change settings remain unchanged\
And only a confirmed Auth email update synchronizes the private profile email\
And roles, memberships, public contacts and historical actor IDs remain unchanged\
And neither an admin email-replacement shortcut nor a new Auth identity is used.

Given the owner has explicitly confirmed deactivation and verified their current email\
When the locked deactivation command runs\
Then active Tracking, active owned trucks, current Driver assignments, active
fleet colleagues, pending fleet invitations and open member Support block closure
with concrete next steps\
And otherwise the profile becomes inactive, public business visibility is removed,
current sessions lose workspace authority and the browser is signed out\
And shipment/audit/message/file/assignment history remains retained\
And inactive owners cannot activate or create trucks through a concurrent request\
And platform-team accounts and other users cannot be closed through this command.

October14 provider-fleet compatibility (FEAT-FLT/PLY-001 / ADR-079): the same
closure blockers cover active employees and pending invitations under either
an organization or a personal-provider employer. The personal-provider anchor
is locked before the closing profile, matching fleet commands, and authority is
rechecked after waiting. Resolving those memberships/invitations allows the
existing recently email-verified deactivation without deleting fleet history.
Focused rollback acceptance: `tests/sql/provider-fleet-erasure.sql`.

Contracts: migration 092, confirmed Auth email synchronization, service-only
closure blockers/deactivation, private signed operation handoff, own-session
Supabase Auth update and global logout. Closure requires recent Auth proof and
explicit confirmation; SQL repeats active role and blockers. A blocked closure
keeps the account active. Reopening is an authorized Support/admin operation,
not a public signup shortcut. No data deletion, ownership transfer or hosted Auth
configuration change. Apply SQL before clients; rollback hides controls while
retaining deactivation and history. Require unit, SQL and real local inbox/browser
evidence before completion. Supabase own-session email update/confirmation:
https://supabase.com/docs/reference/javascript/auth-updateuser
and https://supabase.com/docs/guides/auth/auth-email-templates .

## Direct database session boundary (FEAT-SEC-001)

Given an active or deactivated identity still holds a valid Supabase session
When it calls application tables directly
Then browser-role privileges deny reads and writes, independently of retained
organization membership and older row policies
And authenticated current_user_projection still returns only auth.uid() with its
actual active state; anonymous callers cannot execute it
And server authorization continues to reject inactive workspace access.

Migration 096 and tests/sql/browser-boundaries.sql implement this boundary without
deleting account or shipment history or changing hosted Auth configuration.


## Owner-added company Driver — 2026-09-21

FEAT-FLT-001 allows the owner to register the driver's actual email and assign a
truck before email verification. The Auth identity is unconfirmed, has no supplied
password and confers no session. Current-user projection denies unconfirmed email
identities, including a forged/unconfirmed JWT subject used in the SQL regression.
The normal email-code flow supplies confirmation and the existing Driver workspace;
there is no extra Join fleet acceptance for newly owner-added Drivers. Existing
pending invitations preserve their verified acceptance flow. Owner account creation
cannot repurpose provider/staff/other-fleet or suspended identities. ADR-068.

Local evidence for the owner-added Driver contract: migration 099,
`tests/sql/driver-preverification.sql` and both desktop/phone real-Mailpit
`tests/e2e/fleet-onboarding.spec.ts` pass. See `specs/TRACEABILITY.md`; owner
visual review, full release gates and production rollout remain pending.

## Consolidated provider Account — October 6 owner request (in progress)

Given a provider opens Account on web or native
When they edit personal details, security, photo or business information
Then related controls operate within that common workspace, with expandable long
sections and role/ownership restrictions preserved. Company drivers do not receive the
owner business editor. More is not a duplicate catalog of provider settings.
Existing standalone URLs remain compatible. Server-side authorization is unchanged.
Verification: local phone/desktop same-page saves and navigation, role and limited
access tests, then owner review before release gates. Not deployed.

Phone acceptance: Support, language and Exit dashboard remain inside the header,
with distinct touch targets and no overlap at 320px or the standard phone width.
Support may use its familiar icon with an accessible name on narrow screens.

### October 7 synthetic signup parity

Browser audit providers include the unpublished company page created by the real
managed signup command (migration 045), alongside identity and provider workspace.
Opening Account must exercise its embedded profile and security controls rather
than fail because an artificial fixture skipped a required signup record.
`tests/e2e/account-security.spec.ts` still verifies both-inbox confirmation,
active-work blockers, forged-target denial and retained-history deactivation.
