---
id: FEAT-SHP-001
title: B2B shipment creation and execution
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-TRK-001]
problem: Businesses and authorized transporters need one canonical freight record from load request through completion.
behavior: Authorized Business actors create Road Freight loads, transporters discover or accept permitted work through the Load Board, and explicit domain transitions govern execution; unsupported service modes are rejected.
contracts: [ShipmentAggregate, ShipmentCommand, ShipmentVisibilityPolicy, FreightLoadPolicy, EtbAmount, StatusTransition]
observability: [shipment_audit, status_event, command_outcome]
rollout: Require tests for every new role, visibility mode, price mode, or state edge.
---

# Shipment lifecycle

### Scenario: business creates a shipment

Given an authenticated Business user provides valid shipment facts\
When shipment creation is submitted\
Then one canonical shipment is created with its initial status\
And pricing is Fixed ETB, Target ETB, or Quote Requested.

### Scenario: shipment form is freight only

Given an authenticated Business user opens shipment creation\
When the form is displayed\
Then Road Freight is the only service mode\
And non-freight provider selection is absent\
And the selected pricing mode shows only its applicable ETB amount field.

### Scenario: unsupported service creation is rejected at the service boundary

Given an authenticated Business submits an unsupported service mode directly\
When shipment creation is validated\
Then the command is rejected\
And no shipment or event is created.

### Scenario: freight demand declares its load policy

Given an authenticated Business creates a Road Freight load\
When the load is submitted\
Then the Business must choose FTL or PTL\
And the Business may choose a standardized cargo configuration without guessing a tonnage label\
And marketplace cards and shipment details use the same FTL and PTL labels as capacity.

### Scenario: freight cargo configuration is chosen visually

Given an authenticated Business creates a Road Freight load\
When they choose an optional cargo configuration\
Then the form shows the standardized truck image and name together\
And the saved load uses that same name in marketplace and shipment views.

### Scenario: Business may expose a designated load phone

Given a Business has explicitly enabled its designated load contact phone\
When an authenticated transporter views that Business's permitted freight load\
Then the designated phone is shown beside the interest action\
And a Business that has not opted in exposes no phone on the load.

### Scenario: receiver contact is required before assignment

Given a shipment has reached Agreed status\
When the Business records the receiver's first name and phone\
Then only authorized shipment parties may read those fields\
And a provider cannot move the shipment to Assigned until both fields exist.

### Scenario: administrator cannot originate business demand

Given an authenticated platform administrator without a Business workspace\
When they request shipment creation\
Then access is denied and no shipment can be created.

### Scenario: provider discovers permitted freight

Given a fleet transporter or self-managed driver\
When they browse the Load Board\
Then only open, directed, or saved-partner records permitted by visibility policy appear\
And internal notes and competing interest remain hidden.

### Scenario: invalid transition

Given a shipment in a known state\
When an actor requests a transition absent from the freight transition map\
Then the domain rejects the command\
And no status event is persisted.

### Scenario: browsing provider cannot operate an unassigned load

Given a provider can browse an open freight load but is not assigned to it\
When the provider attempts to change status or add an internal note\
Then the command is denied as not found or forbidden\
And no shipment, note, event, or success audit changes.

### Scenario: saved-partner visibility is relationship-scoped

Given a freight load is visible to Saved Partners\
When transporters browse available loads\
Then only transporters with an active saved relationship to the Business owner can see it.

### Scenario: direct acceptance is single-use

Given the addressed provider has a direct request in Sent state\
When it accepts the request once\
Then the request becomes Agreed\
And any later acceptance attempt is rejected without changing state.

## Contract ownership

- Aggregate rules: `src/lib/domain.js`
- Application services: shipment, load, interest, and acceptance functions in `src/lib/repository.js`
- Inbound adapters: shipment and load pages plus `/api/shipments/*`
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
