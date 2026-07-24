---
id: FEAT-SHP-001
title: B2B shipment creation and execution
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-TRK-001]
problem: Enterprises and authorized providers need one canonical record from shipment request through completion.
behavior: Authorized actors create parcel or freight shipments, providers discover or accept permitted work, and explicit domain transitions govern execution.
contracts: [ShipmentAggregate, ShipmentCommand, ShipmentVisibilityPolicy, EtbAmount, StatusTransition]
observability: [shipment_audit, status_event, command_outcome]
rollout: Require tests for every new role, visibility mode, price mode, or state edge.
---

# Shipment lifecycle

### Scenario: enterprise creates a shipment

Given an authenticated shipper, receiver, or administrator provides valid shipment facts\
When shipment creation is submitted\
Then one canonical shipment is created with its initial status\
And pricing is Fixed ETB, Target ETB, or Quote Requested.

### Scenario: provider discovers permitted freight

Given a transporter or independent provider\
When they browse loads\
Then only open, directed, or saved-partner records permitted by visibility policy appear\
And internal notes and competing interest remain hidden.

### Scenario: invalid transition

Given a shipment in a known state\
When an actor requests a transition absent from the parcel or freight transition map\
Then the domain rejects the command\
And no status event is persisted.

## Contract ownership

- Aggregate rules: `src/lib/domain.js`
- Application services: shipment, load, interest, and acceptance functions in `src/lib/repository.js`
- Inbound adapters: shipment and load pages plus `/api/shipments/*`
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
