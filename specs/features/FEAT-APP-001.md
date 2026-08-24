---
id: FEAT-APP-001
title: Immediate transport-provider signup
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001]
problem: Transport providers need low-friction operating accounts while capacity seekers should browse and track without being forced to register.
behavior: A public user supplies the minimum provider facts, chooses Fleet transporter, Owner-operator, or Self-managed driver, and proves a Google identity through Supabase Auth; the selected operating model, active provider workspace, draft public page, approved signup record, and seven-day trial are then provisioned atomically. Capacity-seeker, password, and company-Driver signup are absent, and signup never implies document verification.
contracts: [SignupIntent, SignupOperatingModel, ManagedIdentityProof, SignupRecord, WorkspaceProvisioner, TrialProvisioner]
observability: [signup_audit, workspace_provisioned, trial_provisioned, rate_limit_outcome]
rollout: Add the managed signup-intent table, inactive Auth-profile bootstrap, and transactional provisioning command additively. Keep signup disabled if Google, callback, database, or trial-plan configuration is unavailable. Roll back by disabling new signup initiation and allowing already provisioned accounts to keep signing in; never reactivate Production passwords or delete completed signup records.
---

# Account signup

### Scenario: signup submitted

Given a supported account type, provider name, private callback phone, and Google identity\
When the public signup form is submitted and Google returns through the fixed Loadgistic callback\
Then an active user, the correct provider workspace, a draft provider microsite record, and seven-day trial are created atomically\
And an approved signup record is retained for audit history\
And the authenticated user enters that workspace immediately\
And no password is collected or stored by Loadgistic.

### Scenario: signup offers only provider accounts

Given an applicant opens the application form\
When they choose an account type\
Then Fleet transporter, Owner-operator, and Self-managed driver are three separate account choices\
And Fleet transporter describes a transport company or fleet\
And Owner-operator describes an independent Driver using a truck they own\
And Self-managed driver describes an independent Driver using another owner's truck with authorization\
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

Given a visitor submits valid provider facts before Google authentication\
When Loadgistic prepares the identity handoff\
Then the server stores a 15-minute intent behind RLS with only a digest of a random browser token\
And the browser receives only that random token in a Secure, HttpOnly, SameSite cookie\
And anonymous or authenticated browser clients cannot read, write, or execute the intent or provisioning tables and commands directly\
And an expired, consumed, missing, or altered intent cannot provision a workspace.

### Scenario: an unprovisioned managed identity has no authority

Given Google creates an Auth identity before workspace provisioning completes\
When the Auth-user bootstrap runs\
Then it creates at most one inactive minimal Loadgistic profile\
And normal login rejects that inactive projection\
And abandoning or failing signup leaves no active workspace, membership, public page, application approval, trial, or operating authority.

### Scenario: signup is atomic

Given any user, workspace, profile, membership, company-page, signup-record, or trial write fails\
When signup is attempted\
Then the transaction is rolled back\
And the Loadgistic profile remains inactive\
And no partially usable workspace or orphan approved signup record remains\
And retrying cannot create a second workspace for the same authenticated identity.

## Contract ownership

- Inbound adapter: `/apply`, `/api/applications`, and the fixed managed-auth callback
- Application service: provider signup-intent and completion commands
- Persistence: `045_managed_provider_signup.sql` behind the service-role-only Supabase adapter
- Tests: managed signup contract, local Supabase workflow verification, and browser handoff coverage
