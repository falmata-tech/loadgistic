---
id: FEAT-SHR-001
title: Vehicle-scoped private Capacity sharing
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-FLT-001, FEAT-IAM-001, FEAT-MKT-001, FEAT-ADM-001, FEAT-CON-001]
problem: Providers need to share selected vehicle signals with shippers and brokers without exposing private Capacity in the public market.
behavior: A signed-in provider or assigned driver shares a selected vehicle with a registered shipper/broker account through Network. A shipper/broker opens only the vehicles currently shared with its authorized account or team through the Capacity map's Shared with you view. Providers see and may revoke their vehicle shares. Visitors see the Shared with you invitation but must sign in; email-only Capacity access, its OTP challenges, delivery jobs, and Exclusive email sharing are retired. Public-link Tracking and account sign-in email remain separate.
contracts: [AccountConnection, AccountCapacityGrant, DriverVehicleShare, SharedCapacityProjection, RetiredEmailCapacity]
observability: [account_capacity_granted, account_capacity_revoked, account_capacity_denied]
rollout: Account sharing and recipient projections are defined in FEAT-CON-001. Migration 207 removes disposable email Capacity grants, OTPs and queued Capacity emails, blocks new email grants and Exclusive policy, and removes the email branch from account/team projections. Apply only after backup and rollback rehearsal. Tracking email delivery and account authentication are unaffected.
---

## Active private-sharing contract

Given a provider owner or an assigned driver has current authority over a vehicle
When they share its current Capacity with an accepted registered shipper/broker account
Then the grant is scoped to that vehicle and exact recipient account
And the account's authorized Capacity team sees only currently valid grants
And no email address alone becomes a Capacity identity or access credential.

Given a driver loses the assignment, capacity permission, active membership, or vehicle authority
When the recipient next reads Shared with you
Then that driver's grant no longer authorizes the vehicle.

Given a provider owner opens Network
When they inspect or revoke a vehicle grant
Then they can see the recipient account and revoke the grant immediately
And other accounts' grants, public Capacity, Tracking and audit history remain intact.

Given a signed-out visitor selects Shared with you
Then the app leads to account sign-in or creation without requesting a Capacity email code
And the private map and its API return no vehicle data until account authorization succeeds.

Given an old client or direct service request attempts to create an email Capacity grant,
request or consume a Capacity OTP, or select Exclusive email sharing
Then the application and database fail closed; no new private recipient is created.

Given a Capacity signal is Private or Public plus private
Then public search, map clusters, provider summaries and cached pages never reveal its
private geometry unless the signal is also explicitly public; private account views
still apply current status, location freshness, reviewed-document and filter rules.

Account directory, connection lifecycle, team permissions and Featured account
rotation are specified in [FEAT-CON-001](FEAT-CON-001.md). The retired email
implementation remains in Git history; it is not current product guidance.

Tests: `tests/sql/account-only-private-capacity.sql`,
`tests/sql/account-connections.sql`, `tests/sql/account-shared-capacity.sql`,
`tests/e2e/private-capacity-network.spec.ts` and account-based Capacity map tests.
