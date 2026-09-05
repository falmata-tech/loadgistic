---
id: FEAT-APP-001
title: Immediate transport-provider signup
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001]
problem: Transport providers need low-friction operating accounts while capacity seekers should browse and track without being forced to register.
behavior: A public user first proves a Google or numeric email-code identity through the shared account-access surface. An active identity enters its authorized workspace, while a new or signup-eligible inactive provider identity continues to one concise provider-setup step and chooses Fleet transporter, Owner-operator, or Self-managed driver; only then are the selected operating model, active provider workspace, draft public page, approved signup record, and seven-day trial provisioned atomically. Capacity-seeker, password, and company-Driver signup are absent, and signup never implies document verification.
contracts: [SignupIdentityHandoff, SignupIntent, SignupOperatingModel, ManagedIdentityProof, SignupRecord, WorkspaceProvisioner, TrialProvisioner]
observability: [signup_audit, workspace_provisioned, trial_provisioned, rate_limit_outcome]
rollout: Add the managed signup-intent table, inactive Auth-profile bootstrap, transactional provisioning command, and minimum trial-plan catalogue additively. Keep signup disabled if Google, callback, database, or an operator-disabled trial plan is unavailable. Roll back by disabling new signup initiation and allowing already provisioned accounts to keep signing in; never reactivate Production passwords or delete completed signup records.
---

# Account signup

### Scenario: signup submitted

Given a Google or email-code identity was proved and has a valid short-lived signup handoff\
When the visitor submits a supported account type, provider name, and private callback phone\
Then an active user, the correct provider workspace, a draft provider microsite record, and seven-day trial are created atomically\
And an approved signup record is retained for audit history\
And the authenticated user enters that workspace immediately\
And no password is collected or stored by Loadgistic.

### Scenario: one account-access entry precedes provider details

Given a visitor has not yet proved a managed identity\
When they open account access or directly request the provider-setup route\
Then one shared account-access surface offers Google and email-code proof before asking for operating or business details\
And the provider-setup route does not render a second Google or email-code choice\
And a direct provider-setup request without a valid signup handoff returns to the shared account-access surface without disclosing account existence.

Given a visitor successfully proves a managed identity\
When the server resolves its Loadgistic role projection\
Then an active identity enters its server-authorized role workspace without seeing provider setup\
And a new or signup-eligible inactive provider identity sees one concise provider-details step in the same account-access shell\
And that step retains a direct way back to the Truck Market.

### Scenario: signup offers only provider accounts

Given an applicant opens the application form\
When they choose an account type\
Then Fleet transporter, Owner-operator, and Self-managed driver are three separate account choices\
And Fleet transporter describes a transport company or fleet\
And Owner-operator describes an independent Driver using a truck they own\
And Self-managed driver describes an independent Driver using another owner's truck with authorization\
And each choice remains fully readable, selectable, and visibly focused with a keyboard at supported phone, desktop, and reflow widths\
And Company driver is not a public signup choice because the employing fleet creates and identifies that account\
And a capacity seeker is directed to browse capacity or track a shipment without an account\
And no Business or additional provider category is available.

### Scenario: signup provisions the right workspace

Given a supported provider account type\
When signup succeeds\
Then a Fleet Transporter receives a transporter organization workspace\
And an Owner-operator or Self-managed driver receives an independent provider profile with the selected operating model retained on the signup record\
And no identity, license, driver, or truck verification is inferred from signup.

### Scenario: signup intent is short-lived and private

Given a visitor completes identity proof and submits valid provider facts\
When Loadgistic prepares atomic provisioning\
Then the server stores a 15-minute intent behind RLS with only a digest of a random provisioning token\
And the earlier browser handoff remains signed, Secure in Production, HttpOnly, SameSite, and short lived\
And anonymous or authenticated browser clients cannot read, write, or execute the intent or provisioning tables and commands directly\
And an expired, consumed, missing, or altered intent cannot provision a workspace.

### Scenario: an unprovisioned managed identity has no authority

Given Google or email-code account access creates an Auth identity before workspace provisioning completes\
When the Auth-user bootstrap runs\
Then it creates at most one inactive minimal Loadgistic profile\
And provider setup accepts only a confirmed inactive DRIVER bootstrap with no prior application, provider, fleet, permission, assignment, support, platform-role, or organization association\
And protected workspace access rejects that inactive projection while a matching valid signup handoff may continue only to provider setup\
And suspended or previously associated identities cannot be reclassified or reactivated through signup\
And browser sessions cannot directly change profile role or activation\
And abandoning or failing signup leaves no active workspace, membership, public page, application approval, trial, or operating authority.

### Scenario: signup is atomic

Given any user, workspace, profile, membership, company-page, signup-record, or trial write fails\
When signup is attempted\
Then the transaction is rolled back\
And the Loadgistic profile remains inactive\
And no partially usable workspace or orphan approved signup record remains\
And retrying cannot create a second workspace for the same authenticated identity.

### Scenario: a fresh managed deployment can provision a trial

Given the ordered database migrations are applied to an empty hosted project\
When an eligible fleet transporter, Owner-operator, or Self-managed driver completes signup\
Then the minimum Business, Fleet transporter, and Independent Driver plan catalogue already exists without depending on demo fixtures\
And Fleet transporter signup selects the active Transporter plan\
And Owner-operator or Self-managed driver signup selects the active Driver plan\
And replaying the catalogue migration does not duplicate plans or reactivate a plan an operator deliberately disabled.

## Contract ownership

- Inbound adapter: `/apply`, `/api/applications`, `/api/applications/google`, `/api/applications/email-otp/*`, and the fixed managed-auth callback
- Application service: provider signup-intent and completion commands
- Persistence: `045_managed_provider_signup.sql`, `060_provider_signup_eligibility.sql`, `061_lock_profile_authority.sql`, and `072_required_plan_catalog.sql` behind the service-role-only Supabase adapter
- Tests: managed signup contract, local Supabase eligibility and role-escalation verification, and browser handoff coverage
