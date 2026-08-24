---
id: FEAT-SHR-001
title: Truck-scoped private capacity sharing
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-FLT-001, FEAT-IAM-001, FEAT-MKT-001, FEAT-ADM-001]
problem: Drivers need to share sensitive current geometry and approximate location with selected business contacts without forcing those contacts to create accounts, while still advertising their public regular service and a callable truck in the Market.
behavior: Each truck has a Private capacity network. An authorized Driver may grant an email access to that truck's current capacity geometry and Driver-selected approximate location; the fleet owner can inspect and revoke every grant. One short-lived email OTP opens a restricted visitor session that shows every active truck grant for the verified email in one Shared capacity map without creating a Loadgistic member account, profile, password, or dashboard. The session ends after 30 minutes without deliberate visitor activity and may be ended immediately with Log out. Regular service and the categorical Empty or Partial status remain publicly discoverable, but a private current route, Service area, and approximate location do not. A distinct Share with Loadgistic control gives the assisted-matching team the same private projection without using a pretend email identity.
contracts: [PrivateCapacityGrant, PrivateCapacityAudience, SharedCapacityEmailOtp, SharedCapacityVisitorSession, PrivateCapacityProjection, LoadgisticCapacityAudience]
observability: [private_capacity_granted, private_capacity_revoked, shared_capacity_otp_requested, shared_capacity_otp_verified, private_capacity_access_denied, loadgistic_capacity_shared]
rollout: Additive Supabase PostgreSQL migration 042 supplies server-only grant, OTP, delivery-queue, and private-map application ports. Existing current capacity remains public until its authorized publisher explicitly selects Private network. Roll back by hiding private-sharing routes and rejecting new grants while retaining audited grant history; never fall back to SQLite when the managed runtime is selected.
---

# Private capacity network

### Scenario: Driver shares one assigned truck

Given a Driver is actively assigned to a truck or independently controls that truck\
When the Driver adds a normalized email to the truck's Private capacity network\
Then one active truck-and-email grant is stored without duplicating an existing active grant\
And no reusable pairing code is created or displayed\
And the approved recipient can later request a short-lived email OTP without the Driver managing access secrets\
And the fleet owner can inspect the recipient email, grant state, creator, and dates.

### Scenario: owner oversight does not replace Driver location

Given a company Driver created one or more grants for an assigned truck\
When the fleet owner opens Network\
Then the owner can view and revoke every grant for an owned truck\
And the owner cannot publish the owner's device location as the Driver's location\
And an unrelated Driver, fleet, support agent, or provider cannot read or mutate the grant.

### Scenario: verified guest receives all shares for one email

Given one or more active truck grants target the same normalized email\
When an account-free visitor requests and submits the valid email OTP\
Then a restricted browser session opens Shared capacity for every active grant targeting that email\
And no member account, profile, password, transporter workspace, or visitor dashboard is created\
And the map uses the same interaction, status, geometry, clustering, and legend language as the public Truck Market\
And each truck uses exactly the Driver-selected approximate-location radius, including 1, 5, 20, or another supported value\
And no exact coordinate, surname, plate, private account contact, proof file, code digest, or unrelated truck is returned.

### Scenario: Shared capacity session ends when unattended

Given an email-verified visitor has an active Shared capacity session\
When 30 minutes pass without a deliberate pointer, keyboard, touch, scroll, or map interaction\
Then the restricted session expires and the next page or data request returns to email verification\
And background map loading, polling, rendering, or network requests do not extend access\
And the visitor sees a concise session-expired message without any private truck data.

### Scenario: visitor can end Shared capacity access

Given an email-verified visitor is viewing the Shared capacity map\
When the visitor selects Log out\
Then the restricted session cookie is cleared immediately\
And the map is replaced by the email-verification entry screen\
And the visitor must complete a new email OTP challenge to regain access.

### Scenario: deliberate activity renews an active session

Given an email-verified visitor remains active on the Shared capacity map\
When the visitor deliberately interacts before the 30-minute idle limit\
Then a bounded rolling renewal may extend the restricted session for another 30 minutes\
And a renewal never changes grants, creates an account, or reveals another email's trucks\
And an already expired or invalid session cannot be renewed.

### Scenario: public and private current capacity remain distinct

Given a Driver has selected Public Market or Private network for current capacity\
When public and shared-capacity projections are queried\
Then Public Market returns complete current geometry only for active Public Market signals\
And a Private network truck with public regular service remains callable on the Public Market using only its categorical Empty or Partial status and regular-service geometry\
And its public truck marker is placed on that regular route or area as a service marker explicitly described as not the truck's current location\
And its private current route, current Service area, approximate location, and related location filters remain absent from the anonymous projection\
And Shared capacity returns an authorized email's latest public and private Empty or Partial geometry and approximate location without duplicates\
And the provider's one regular-service signal remains public in either mode\
And older capacity remains visible with separate capacity and location age labels while Off Duty disappears from both surfaces without deleting the network grant.

### Scenario: revocation is immediate

Given an email or Loadgistic has access to one truck\
When an authorized Driver revokes their own grant or the fleet owner revokes any owned-truck grant\
Then that truck disappears on the next authorized Shared capacity or admin-map read\
And other grants for the same email remain available\
And the mutation is attributed and audited.

### Scenario: Loadgistic is an explicit platform audience

Given a Driver wants assisted matching for one truck\
When Share with Loadgistic is enabled\
Then one revocable platform-audience grant is stored for that truck without inventing an email address\
And authorized administrators with Operations permission can inspect that truck on the private assisted-matching map\
And ordinary support agents, public visitors, and other providers cannot access the projection\
And disabling the control removes the truck from that admin map on its next read.

### Scenario: OTP and visitor sessions fail closed

Given an email has no active shares or its OTP is invalid, expired, already used, superseded, or repeatedly guessed\
When an OTP is requested or Shared capacity access is attempted\
Then no grant existence, provider identity, or truck data is disclosed\
And the request response is generic whether or not the email currently has a share\
And an issued OTP expires after ten minutes, is single-use, allows no more than five failed attempts, and is invalidated when a newer OTP is issued\
And request and verification attempts are throttled by email and network origin\
And OTP values are generated cryptographically, never stored or logged in plaintext, and denial is observable without recording the submitted value.

### Scenario: local testing does not pretend email delivery succeeded

Given the application is running outside production without a configured email-delivery webhook\
When an email with at least one active truck share requests a Shared capacity code\
Then the response states that email delivery is not configured and presents the issued code as a local test code\
And an email without an active share still receives the generic non-disclosing response and no local code\
And production never returns an OTP value in an HTTP response, UI projection, log, or audit event\
And configuring the email adapter removes the local-code presentation and sends through the managed delivery adapter.

### Scenario: one verified email aggregates multiple trucks

Given different Drivers or fleet owners granted the same normalized email access to multiple trucks\
When that email completes one valid OTP challenge\
Then the same Shared capacity map includes every currently active authorized truck without another code per Driver or truck\
And each truck retains its own provider, Driver-selected approximation, visibility, expiry, and revocation boundary\
And adding or revoking one share is reflected on the next map read without changing unrelated shares.

### Scenario: managed Shared capacity never falls back to SQLite

Given `DATA_BACKEND=supabase` in local development, Preview, or Production\
When a provider lists or changes a truck grant, a visitor requests or verifies an OTP, email delivery is claimed or recorded, or a Shared capacity map is read\
Then the application uses the server-only Supabase PostgreSQL port and its audited functions\
And PostgreSQL rechecks the actor-to-truck or Operations permission before every protected provider or administrator operation\
And anonymous and ordinary authenticated Supabase browser roles cannot execute those functions or read the underlying grant, OTP, delivery, or private projection tables\
And an unavailable or rejected Supabase request fails closed instead of importing or querying SQLite.

## Contract ownership

- Public pages: `/shared-capacity`
- Provider page: `/app/network`
- Administrator page: `/admin/capacity-network`
- Inbound adapters: `/api/capacity-network/*` and `/api/shared-capacity/*`, including rolling renewal and logout at `/api/shared-capacity/session`
- Application service boundary: `src/lib/repository.js`
- Supabase PostgreSQL adapter and server-only ports: `src/lib/repository/supabase.js` and `supabase/migrations/042_shared_capacity_runtime.sql`
- Tests: domain/repository authorization, capacity-market projection, desktop/mobile E2E
