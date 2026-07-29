---
id: FEAT-SHP-001
title: B2B shipment creation and execution
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-TRK-001, FEAT-VER-001, FEAT-FLT-001, FEAT-NET-001, FEAT-GEO-001]
problem: Businesses and authorized transporters need one canonical freight record from load request through completion.
behavior: Authorized Business actors create road-freight loads as either shipper or receiver owners, manage posting and execution from one My Loads workspace, transporters discover or accept permitted work through the Load Board, only execution-stage party records appear in Tracking, and explicit domain transitions govern execution.
contracts: [ShipmentAggregate, LoadOwner, ShipmentParty, ExternalShipmentParty, ShipmentCommand, ShipmentVisibilityPolicy, BusinessLoadWorkspace, TrackingWorkspacePolicy, FreightLoadPolicy, FleetDriverLoadPermission, LoadRouteMatch, EtbAmount, StatusTransition, BusinessParticipantReview]
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
And no redundant service selector or service label is displayed\
And the selected pricing mode shows only its applicable ETB amount field.

### Scenario: freight deadlines use operational language

Given a Business creates or reviews a load\
When pickup and delivery deadlines are displayed\
Then they are labeled Pick up before and Drop off before\
And the saved values remain the canonical pickup and delivery deadlines.

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

### Scenario: posting Business declares its shipment role

Given an authenticated Business starts a load\
When it declares itself to be the shipper or receiver\
Then that Business remains the load owner and provider-facing decision maker\
And the selected or external counterpart is assigned the opposite shipment role\
And authorization uses the load owner independently from the shipper role.

### Scenario: shipment counterpart may be outside Loadgistic

Given a Business posts a load for a shipper or receiver without an account\
When it records the external party name and optional contact detail\
Then the load is created without an organization record for that party\
And the external party receives no directory, marketplace, or internal shipment access\
And it may open the customer-safe tracking view only by entering the secret load code.

### Scenario: counterpart search remains bounded

Given the Business directory may contain many records\
When a load owner searches for a shipper or receiver\
Then no unbounded directory list is embedded in the page\
And server-side results begin only after a meaningful search term\
And favorited Businesses rank before other matching Businesses.

### Scenario: load detail avoids unverifiable weight

Given a Business creates or reviews a freight load\
When cargo details are displayed\
Then the descriptive field is labeled Load detail\
And the workflow does not request or display estimated kilograms.

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

### Scenario: Business load work has one navigation entry

Given an authenticated Business uses the workspace navigation\
When load work is displayed\
Then one My Loads navigation entry replaces separate Post Load and Tracking entries\
And the My Loads page provides an All my loads view, an Active Tracking view, and a Post load action\
And Posted, negotiating, execution, and completed records remain projections of one canonical load\
And transport providers retain their own Tracking navigation because they do not own Business demand.

### Scenario: load work and marketplace demand remain bounded

Given My Loads, Tracking, or the Load Board contains more records than one page\
When the user opens, searches, filters, or pages the list\
Then the server renders one bounded page\
And the active view and filters remain in page navigation\
And a new search or filter submission starts from page one.

### Scenario: provider discovers permitted freight

Given a fleet transporter or self-managed driver\
When they browse the Load Board\
Then only Open, Direct, or Partners records permitted by visibility policy appear\
And internal notes and competing interest remain hidden.

### Scenario: provider can return to its expressed interests

Given an authorized provider expressed interest in one or more visible loads\
When it selects My interests on the Load Board\
Then only currently discoverable loads with that provider's recorded interest are shown\
And every matching card is labeled Interest sent\
And the loads do not enter Tracking until the provider becomes a shipment party.

### Scenario: authorized fleet driver represents its company

Given a company driver has Load Board, contact, and negotiation permission\
When the driver browses a permitted load or starts a provider action\
Then the load is read and the action is owned by the driver's transporter organization\
And the driver remains the recorded actor\
And the fleet owner can review the complete company process.

### Scenario: restricted fleet driver cannot negotiate

Given a company driver may browse loads but the owner disabled Business contact or negotiation\
When the driver views a load or submits an interest, proof request, or direct acceptance\
Then the designated Business phone and contact controls are hidden when contact is disabled\
And denied commands create no commercial record, notification, event, or success audit.

### Scenario: Load Board supports truck-aware discovery

Given a fleet transporter or self-managed driver opens the Load Board\
When they filter by text, route cities, cargo configuration, load type, visibility mode, price mode or range, pickup or drop-off deadline, or posted recency\
Then only loads satisfying every supplied filter are displayed\
And a price range excludes Quote Requested loads because they have no comparable saved amount\
And clearing the filters restores all loads permitted by visibility policy.

Given Local and Between cities loads coexist\
When the provider filters movement scope or Local locality\
Then structured movement and place identities are used\
And origin and destination route filters apply only to Between cities records\
And exact Local pickup or drop-off coordinates are not returned to the Board.

Given a provider chooses one of its own trucks with a current planned route\
When Load Board results are displayed\
Then loads with both route endpoints aligned are ranked before one-endpoint and unmatched loads\
And each result explains its route-match strength without claiming that the truck is assigned.

### Scenario: Tracking contains only execution-stage involved loads

Given a fleet transporter or self-managed driver can discover an unassigned posted load\
When they open Tracking\
Then that unrelated posted load is absent\
And it remains available on the Load Board according to discovery visibility.

Given the transporter organization, self-managed driver, shipper Business, or receiver Business is a party to a load\
When that actor opens Tracking\
Then only Agreed, Assigned, In Transit, On Hold, Issue, Delivered, or Completed loads are listed\
And Posted, Sent, Contacted, and merely saved or interested loads remain in their Load Board or negotiation context.

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

### Scenario: Partners visibility is relationship-scoped

Given a freight load is visible to Partners\
When transporters browse available loads\
Then only transporters with a mutual Connected relationship to the Business owner can see it.

### Scenario: direct acceptance is single-use

Given the addressed provider has a direct request in Sent state\
When it accepts the request once\
Then the request becomes Agreed\
And any later acceptance attempt is rejected without changing state.

### Scenario: shipper and receiver review each other

Given a completed load has distinct shipper and receiver Business organizations\
When an authenticated member of either Business submits one rating from one to five with an optional note\
Then the review is attached to the completed load and the other Business\
And it contributes to the reviewed Business profile rating.

Given a user is not a shipper or receiver party, the load is not completed, or the same Business already reviewed the same counterparty for that load\
When a review is submitted\
Then it is rejected without creating or replacing a review.

## Contract ownership

- Aggregate rules: `src/lib/domain.js`
- Application services: shipment, load, interest, and acceptance functions in `src/lib/repository.js`
- Inbound adapters: shipment and load pages plus `/api/shipments/*`
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
