---
id: FEAT-SHP-001
title: Provider-created Tracking sessions
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-FLT-001, FEAT-TRK-001]
problem: After an off-platform agreement, a transport provider needs one operational Tracking session that the customer owner can share without requiring anyone to create an account.
behavior: An authenticated provider owner, self-managed Driver, or company Driver assigned to the selected truck starts a Tracking session, records one customer-owner email, and retains the durable provider-side history. No demand post, Shipment Board, provider interest, public price, or capacity-seeker account is created.
contracts: [ProviderTrackingCommand, ProviderTrackingHistory, CustomerOwnerEmail, ProviderVehicleAssignment, ShipmentExecutionState, GuestAccessExpiry, ProviderTrackingRepository]
observability: [provider_shipment_created, assignment_audit, state_transition, guest_expiry, provider_history_read]
rollout: Hide and block demand creation and Shipment Board routes, purge fake local demand rows, preserve provider-owned execution history, and require a backup plus operator approval for any destructive cloud purge.
---

# Provider-created execution

### Scenario: provider creates tracking after agreement

Given a signed-in fleet transporter, self-managed Driver, or assigned company Driver has agreed terms outside Loadgistic\
When the authorized actor starts Tracking\
Then the provider is the owning workspace\
And structured origin, destination, cargo summary, one customer-owner email, optional expected dates, the Status timeline, and the assigned truck and Driver are recorded\
And one stable customer-owner access code and Track link are issued through FEAT-TRK-001\
And no public demand listing or provider-interest record is created.

### Scenario: provider ownership is enforced

Given a shipment belongs to one provider\
When another provider attempts to read, update, assign, prove, complete, or export it\
Then the request returns no protected record\
And no state, code, email, or file changes.

### Scenario: managed persistence commits one authorized Tracking aggregate

Given local, Preview, and Production run against the same managed PostgreSQL contracts\
When an authorized provider or assigned Driver starts or updates Tracking\
Then a server-only Tracking repository invokes a service-role-only PostgreSQL command\
And PostgreSQL independently verifies the active actor, provider ownership, Driver permission, and current truck assignment\
And the shipment, initial or transition event, customer grant, delivery queue row, and audit record commit atomically\
And a denied or failed command leaves no partial Tracking, grant, delivery, proof reference, or success audit row\
And browser clients cannot read or mutate the underlying private tables directly.

### Scenario: provider history remains durable

Given a provider-owned shipment completes\
When temporary guest access later expires\
Then the owning provider retains its authenticated shipment record, timeline, assignment, and delivery summary\
And no capacity seeker account or public profile is created from either external email.

### Scenario: demand marketplace is absent

Given any public visitor or legacy Business account opens current navigation\
When shipment discovery actions are evaluated\
Then Post shipment, Shipment Board, pooled loads, along-route demand groups, interests, Direct requests, and Business public profiles are absent\
And no legacy demand data remains in the normal local dataset.

## Contract ownership

- Provider pages: Tracking, Start Tracking, and Tracking detail
- Application services: provider-owned create, assign, transition and history functions
- Persistence: `044_provider_tracking_runtime.sql` and the server-only provider Tracking adapter
- Tests: domain, repository, managed Tracking authorization, E2E
