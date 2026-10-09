---
id: FEAT-APP-001
title: Immediate transport-provider signup
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001]
problem: Transport providers need low-friction operating accounts while capacity seekers should browse and track without being forced to register.
behavior: A public user first proves a numeric email-code identity. An active identity enters its authorized workspace; an eligible new identity chooses Fleet transporter or Independent driver. Independent driver unifies Owner-operator and Self-managed driver with one current truck; ownership or permission is recorded on that truck, never inferred from signup. The active provider workspace, draft public page and approved signup record are provisioned atomically without a plan or subscription. Capacity-seeker, password and company-Driver signup are absent.
contracts: [SignupIdentityHandoff, SignupIntent, SignupOperatingModel, ManagedIdentityProof, SignupRecord, WorkspaceProvisioner]
observability: [signup_audit, workspace_provisioned, rate_limit_outcome]
rollout: Add the managed signup-intent table, inactive Auth-profile bootstrap, transactional provisioning command additively. Keep signup disabled if email verification, callback or database is unavailable. Roll back by disabling new signup initiation and allowing already provisioned accounts to keep signing in; never reactivate Production passwords or delete completed signup records.
---

# Account signup

### Scenario: signup submitted

Given a Google or email-code identity was proved and has a valid short-lived signup handoff\
When the visitor submits a supported account type, provider name, and private callback phone\
Then an active user, the correct provider workspace and a draft provider microsite record are created atomically without billing records\
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
Then Fleet transporter and Independent driver are the two account choices\
And Fleet transporter describes a transport company or fleet\
And Independent driver describes a person driving one truck they own, rent or use with permission\
And ownership/permission is chosen on truck registration, not as a separate account type\
And each choice remains fully readable, selectable, and visibly focused with a keyboard at supported phone, desktop, and reflow widths\
And Company driver is not a public signup choice because the employing fleet creates and identifies that account\
And a capacity seeker is directed to browse capacity or track a shipment without an account\
And no Business or additional provider category is available.

### Scenario: signup provisions the right workspace

Given a supported provider account type\
When signup succeeds\
Then a Fleet Transporter receives a transporter organization workspace\
And an Independent driver receives the canonical SELF_MANAGED_DRIVER model and independent provider profile\
And legacy OWNER_OPERATOR signup inputs are compatible aliases without different capabilities\
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
And abandoning or failing signup leaves no active workspace, membership, public page, application approval or operating authority.

### Scenario: signup is atomic

Given any user, workspace, profile, membership, company-page, or signup-record write fails\
When signup is attempted\
Then the transaction is rolled back\
And the Loadgistic profile remains inactive\
And no partially usable workspace or orphan approved signup record remains\
And retrying cannot create a second workspace for the same authenticated identity.

### Scenario: signup has no plan catalogue dependency

Given a fresh migrated database with no active plan catalogue
When an eligible provider completes verified email signup
Then its active provider workspace and unpublished page are created atomically
And no trial or subscription record is inserted, as specified in FEAT-BIL-001
And a disabled historical plan cannot block signup.

## Contract ownership

Existing independent accounts retain Auth IDs, provider links, handles and historical
signup/document/shipment/capacity records. Both display Independent driver. No
company-driver, fleet or staff identity is converted. FEAT-FLT-001 defines authority.

- Inbound adapter: `/apply`, `/api/applications`, `/api/applications/google`, `/api/applications/email-otp/*`, and the fixed managed-auth callback
- Application service: provider signup-intent and completion commands
- Persistence: `045_managed_provider_signup.sql`, `060_provider_signup_eligibility.sql`, `061_lock_profile_authority.sql`, and `072_required_plan_catalog.sql` behind the service-role-only Supabase adapter
- Tests: managed signup contract, local Supabase eligibility and role-escalation verification, and browser handoff coverage
