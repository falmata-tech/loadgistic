---
id: FEAT-SHR-001
title: Truck-scoped private capacity sharing
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-FLT-001, FEAT-IAM-001, FEAT-MKT-001, FEAT-ADM-001]
problem: Drivers need to share sensitive current geometry and approximate location with selected business contacts without forcing those contacts to create accounts or implicitly advertising a private truck in the public Market.
behavior: Each truck has a Private capacity network. An authorized Driver may grant an email access to that truck's current capacity geometry and Driver-selected approximate location; the fleet owner can inspect and revoke every grant. One short-lived six-digit email OTP opens a restricted visitor session that shows every active truck grant for the verified email in one Shared capacity map without creating a Loadgistic member account, profile, password, or dashboard. An email with no active truck grant receives no OTP challenge or email delivery, remains on the email step, and receives a clear no-share result that identifies no transporter, truck, or prior grant. The session ends after 30 minutes without deliberate visitor activity and may be ended immediately with Log out. A Private network signal is completely absent from anonymous discovery. A Driver who wants both surfaces chooses Public Market and may additionally grant selected recipients access to that same truck. A distinct Share with Loadgistic control gives the assisted-matching team the same private projection without using a pretend email identity.
contracts: [PrivateCapacityGrant, PrivateCapacityAudience, SharedCapacityEmailOtp, SharedCapacityVisitorSession, PrivateCapacityProjection, LoadgisticCapacityAudience]
observability: [private_capacity_granted, private_capacity_revoked, shared_capacity_otp_requested, shared_capacity_otp_verified, private_capacity_access_denied, loadgistic_capacity_shared]
rollout: Additive Supabase PostgreSQL migration 042 supplies server-only grant, OTP, delivery-queue, and private-map application ports; additive migration 058 serializes recipient-scoped OTP issuance; additive migration 059 adds lease-owned targeted delivery, challenge-aware retries, and bounded terminal guest-access retention. Existing current capacity remains public until its authorized publisher explicitly selects Private network. Roll back by hiding private-sharing routes and rejecting new grants while retaining audited grant history; never fall back to SQLite when the managed runtime is selected.
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

### Scenario: the Shared capacity workspace preserves the map

Given a visitor opens Shared capacity before or after email verification on a supported desktop, phone, or 320-pixel reflow viewport\
When the entry panel or authorized map workspace renders\
Then the selected Private capacity navigation identifies the workspace without a duplicate visible page header\
And an accessible Private Transport Capacity page name remains available to assistive technology\
And the verified map fills the viewport remaining beneath the application bars and stable session row\
And loading, empty, error, pagination, or location feedback is positioned within the map workspace without creating another layout row or reducing the map to an unusable height\
And the map remains at least 300 CSS pixels high at a 320-by-640 viewport\
And the entry form, local-development inbox link, persistent chat launcher, and bottom navigation never cover one another or force horizontal document scrolling.

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
And the visible session controls occupy a stable region outside the interactive map so map layers cannot cover or intercept them\
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
And a Private network truck is absent from the anonymous projection even when its provider has a public regular-service signal\
And its status, identity, current route, current Service area, approximate location, and related filter matches are not inferred through that regular service\
And Shared capacity returns an authorized email's latest public and private Empty or Partial geometry and approximate location without duplicates\
And a Public Market truck may also appear in Shared capacity when an explicit active grant targets that recipient\
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
And an email without an active grant creates no OTP row, queues no email-delivery row, and causes no provider submission or retry work\
And the request response is generic whether or not the email currently has a share\
And the identical guidance explains that codes are sent only for active shares and directs a visitor who receives none to ask the transporter to add that exact email in Network before retrying\
And an issued OTP is six numeric digits, expires after ten minutes, is single-use, allows no more than five failed attempts, and is invalidated when a newer OTP is issued\
And concurrent requests for the same normalized email are serialized so exactly one newest challenge remains current and deliverable\
And request and verification attempts are throttled by email and network origin\
And OTP values are generated cryptographically, never stored or logged in plaintext, and denial is observable without recording the submitted value.

### Scenario: isolated local email is delivered without pretending Production delivery

Given the standard isolated local Supabase environment is configured\
When an email with at least one active truck share requests a Shared capacity code\
Then the configurator-provided loopback Mailpit adapter sends the application-email template to the local inbox after the generic response\
And the visitor can open that local inbox from the verification screen without the response revealing whether a share exists\
And neither the response nor the UI displays the issued code as long as that local adapter is configured\
And an otherwise unconfigured non-Production environment may still present an eligible recipient with a clearly labelled local test code rather than pretending delivery succeeded\
And Production ignores every local Mailpit setting, never returns an OTP value in an HTTP response, UI projection, log, or audit event, and requires a managed application-email provider\
And the Shared capacity template and challenge remain separate from Supabase Auth email and never create an Auth identity.

### Scenario: Shared capacity requests advance only when a share exists

Given any visitor submits a syntactically valid email to the Shared capacity OTP endpoint\
When the request is accepted\
Then the HTTP response is completed without waiting for SMTP or draining the global access-email queue\
And an eligible challenge and its delivery row are committed atomically before the response directs the visitor to the code step\
And the post-response delivery attempt may claim only the newly issued challenge target\
And an ineligible request creates no challenge or delivery row and returns a bounded no-share result\
And the visitor remains on the email step with “No transporter has shared capacity with this email yet” rather than seeing a code field\
And that result identifies no transporter, truck, grant history, or private capacity detail\
And five scoped requests per ten-minute window permit ordinary correction and resend attempts while the separate origin limit remains bounded\
And an exhausted limit reports the approximate remaining wait rather than an indefinite “few minutes” message\
And a failed targeted attempt remains in the global queue for a bounded retry while the same challenge is still valid\
And Shared capacity delivery leases and backoff remain shorter than the challenge's ten-minute validity window\
And the final lease fence requires enough challenge validity to submit a still-usable code rather than sending at the expiry boundary.

### Scenario: queued guest-access records have bounded retention

Given an eligible Shared capacity code is queued but immediate delivery does not complete\
When the scheduled managed-operations worker leases it later\
Then the same short-lived challenge is sent using a stable idempotency key if it remains deliverable\
And serial recovery claims one row immediately before each provider attempt rather than aging multiple leases while earlier rows send\
And both Shared capacity and Assisted matching rows must still own a live lease immediately before provider submission\
And an expired, near-expiry, used, superseded, or attempt-locked challenge is not leased and deliverability is rechecked immediately before provider submission\
And a challenge superseded while an external send is already in flight cannot unlock Shared capacity\
And concurrent workers cannot send separate copies from the same queue row\
And a provider-accepted email whose success acknowledgement fails is not falsely recorded as a provider failure\
And a pending-queue partial index supports only due queued or failed work beneath the attempt limit\
And bounded cleanup removes expired Shared capacity challenges, their terminal delivery rows, and terminal Assisted matching support-email rows after their reviewed retention windows without deleting active support conversations or logging recipient emails or codes.

### Scenario: one verified email aggregates multiple trucks

Given different Drivers or fleet owners granted the same normalized email access to multiple trucks\
When that email completes one valid OTP challenge\
Then the same Shared capacity map includes every currently active authorized truck without another code per Driver or truck\
And each truck retains its own provider, Driver-selected approximation, visibility, expiry, and revocation boundary\
And adding or revoking one share is reflected on the next map read without changing unrelated shares.

### Scenario: managed Shared capacity never falls back to SQLite

Given Loadgistic is running in local development, Preview, or Production\
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
- Application service boundary: the Supabase-only private-capacity port under `src/lib/private-capacity.js`
- Supabase PostgreSQL adapter and server-only ports: `src/lib/repository/supabase.js` and `supabase/migrations/042_shared_capacity_runtime.sql`
- Tests: domain/repository authorization, capacity-market projection, desktop/mobile E2E
