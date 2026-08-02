---
id: FEAT-SHP-001
title: B2B shipment creation and execution
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-PRV-001, FEAT-TRK-001, FEAT-VER-001, FEAT-FLT-001, FEAT-NET-001, FEAT-GEO-001, FEAT-MAT-001]
problem: Businesses and authorized transporters need one canonical freight record from load request through completion.
behavior: Authorized Business actors create road-freight shipments as either shipper or receiver owners, every member role manages its shipment interactions from one My Shipments workspace, transporters discover permitted work through the Shipment Board, Tracking is an execution stage inside My Shipments, and explicit domain transitions govern execution.
contracts: [ShipmentAggregate, LoadOwner, ShipmentParty, ExternalShipmentParty, ShipmentCommand, ShipmentVisibilityPolicy, BusinessLoadWorkspace, ProviderShipmentWorkspace, TrackingWorkspacePolicy, FreightLoadPolicy, ShipmentVehicleAssignment, FleetDriverLoadPermission, LoadRouteMatch, SharedLoadProjection, PooledLoadCandidate, AlongRouteCandidate, EtbAmount, StatusTransition, BusinessParticipantReview]
observability: [shipment_audit, status_event, command_outcome]
rollout: Require tests for every new role, visibility mode, price mode, or state edge.
---

# Shipment lifecycle

### Scenario: user-facing demand language is Shipment

Given any user-facing workflow refers to a freight demand record or its marketplace\
When navigation, headings, forms, filters, buttons, notices, or tracking prompts are rendered\
Then the record is called a Shipment and the marketplace is called the Shipment Board\
And FTL is introduced as Full Truckload and PTL as Partial Truckload before compact cards or controls reuse the abbreviations\
And internal compatibility identifiers are not exposed as product terminology.

### Scenario: business creates a shipment

Given an authenticated Business user provides valid shipment facts\
When shipment creation is submitted\
Then one canonical shipment is created with its initial status\
And pricing is Fixed ETB, Target ETB, or Quote Requested.

### Scenario: initial shipment posting asks only for marketplace facts

Given an authenticated Business opens shipment creation\
When it posts demand to a provider or the Shipment Board\
Then the primary form asks for shipment identity, movement, route, deadlines, cargo size and detail, visibility, price, and tracking policy in operational order\
And those decisions are presented as visible numbered sections for shipment facts, route and deadlines, truck need, audience, and commercial and tracking choices\
And selecting the shipper, receiver, and private receiver contact is deferred until provider agreement and assignment preparation\
And the posting Business remains the load owner throughout that later execution setup.

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

### Scenario: stale demand leaves the Shipment Board

Given a Posted, Sent, or Contacted load has a Drop off before date\
When that deadline passes\
Then its Business owner immediately sees that the request is past due\
And the permitted Shipment Board retains it for a two-day grace window\
And after those two full days the shipment is absent from Shipment Board results, route matching, and pooled-shipment projections\
And the canonical shipment remains in My Shipments so its owner does not lose the record.

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
Then the descriptive field is labeled Shipment detail\
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

### Scenario: assignment binds a driver-backed truck

Given a provider has accepted a Shipment and it has reached Agreed status\
When an authorized transporter or Driver prepares it for execution\
Then the provider chooses one active truck from its own provider scope\
And a fleet truck is selectable only when it has one active assigned Driver\
And a company Driver may choose only that Driver's currently assigned truck\
And an owner-operator's own active truck is paired with that owner-operator\
And the Shipment records the selected truck and Driver before it may move to Assigned\
And shipment parties see the truck's permanent Loadgistic platform number, make, model, cargo configuration, and assigned Driver\
And private plate and exact public identity rules remain unchanged.

### Scenario: administrator cannot originate business demand

Given an authenticated platform administrator without a Business workspace\
When they request shipment creation\
Then access is denied and no shipment can be created.

### Scenario: every member has one My Shipments navigation entry

Given an authenticated Business, fleet transporter, company Driver, or owner-operator uses the workspace navigation\
When shipment work is displayed\
Then one My Shipments navigation entry replaces direct Tracking navigation\
And Businesses receive Posted, Tracking, and History categories plus a Post shipment action\
And transport providers receive Interested, Direct requests, Tracking, and History categories\
And All combines only that workspace's owned or recorded interactions\
And an interest does not become visible to the Business owner as an agreement stage or enter Tracking\
And Posted, interested, direct, execution, and completed views remain projections of one canonical Shipment.

### Scenario: provider My Shipments retains recorded interactions

Given a provider has expressed interest, received a direct request, or become assigned to a Shipment\
When it opens My Shipments\
Then its recorded interest remains in Interested even if the Shipment later leaves public Board discovery\
And an addressed pre-agreement Shipment appears in Direct requests\
And Agreed through Delivered records appear in Tracking\
And Completed or Cancelled records appear in History\
And a pre-execution detail labels its events Shipment activity and does not present a Tracking summary or Tracking controls\
And each row opens only when existing shipment authorization permits it.

### Scenario: load work and marketplace demand remain bounded

Given My Shipments, Tracking, or the Shipment Board contains more records than one page\
When the user opens, searches, filters, or pages the list\
Then the server renders one bounded page\
And the active view and filters remain in page navigation\
And a new search or filter submission starts from page one.

### Scenario: provider discovers permitted freight

Given a fleet transporter or self-managed driver\
When they browse the Shipment Board\
Then only Open, Direct, or Partners records permitted by visibility policy appear\
And participant-only activity and competing interest remain hidden.

### Scenario: Shipment Board card completes marketplace discovery

Given a provider may view a permitted Shipment Board record\
When its card is rendered\
Then route, deadline, cargo, load type, price, visibility, trust, contact, and provider action are available on the card\
And no shipment-detail step is required to express interest or accept a direct request\
And the owner Public Profile is the only discovery drill-down from the card\
And participant-only negotiation, assignment, and tracking details remain inside My Shipments or Tracking.

### Scenario: provider can return to its expressed interests

Given an authorized provider expressed interest in one or more visible loads\
When it selects My interests on the Shipment Board\
Then only currently discoverable loads with that provider's recorded interest are shown\
And every matching card is labeled Interest sent\
And the loads do not enter Tracking until the provider becomes a shipment party.

### Scenario: Shared Shipments keeps two compatible strategies clear

Given an authorized provider can browse two or more Posted Long-distance route loads\
When the provider opens Shared Shipments\
Then one workspace offers Pool together and Along the route modes\
And each mode explains its operational pattern without mixing both patterns in one result list\
And both modes use only shipments already permitted by the Shipment Board visibility policy\
And every source load remains independently owned, priced, negotiated, assigned, tracked, and updated.

### Scenario: pooled candidates are pairwise compatible

Given permitted Posted PTL loads have reviewed endpoint coordinates and operating deadlines\
When Pool together candidates are calculated\
Then every pair in a candidate falls within the configured origin and destination radii\
And their pickup and drop-off deadline windows are close enough to be discussed as one movement\
And a load that is close only through a third transitive load is not silently added\
And the result is labeled as a candidate because recorded data does not prove physical cargo fit.

### Scenario: along-route candidates form a forward sequence

Given permitted Posted Between-cities loads have reviewed endpoint coordinates and operating deadlines\
When Along the route candidates are calculated\
Then each next pickup is within the configured handoff radius of the previous drop-off\
And each leg continues in a broadly consistent forward direction\
And recorded deadlines allow the previous leg to be dropped before the next pickup deadline\
And the sequence contains at least two independently negotiable loads\
And the interface shows ordered pickup and drop-off stops, connector distance, load type, and deadline context\
And the result warns the provider to confirm timing, cargo fit, and every agreement.

### Scenario: shared-load projections remain bounded and stable

Given the permitted Shipment Board contains many candidate records\
When either Shared Shipments mode is opened or paged\
Then candidate input and sequence length are bounded\
And result identifiers and ordering are deterministic for the same eligible records and configuration\
And detail lookup re-applies current authorization and eligibility rather than persisting a combined load.

### Scenario: authorized fleet driver represents its company

Given a company driver has Shipment Board, contact, and negotiation permission\
When the driver browses a permitted load or starts a provider action\
Then the load is read and the action is owned by the driver's transporter organization\
And the driver remains the recorded actor\
And the fleet owner can review the complete company process.

### Scenario: restricted fleet driver cannot negotiate

Given a company driver may browse loads but the owner disabled Business contact or negotiation\
When the driver views a load or submits an interest, proof request, or direct acceptance\
Then the designated Business phone and contact controls are hidden when contact is disabled\
And denied commands create no commercial record, notification, event, or success audit.

### Scenario: Shipment Board supports truck-aware discovery

Given a fleet transporter or self-managed driver opens the Shipment Board\
When they filter by text, route cities, cargo configuration, load type, visibility mode, price mode or range, pickup or drop-off deadline, or posted recency\
Then only loads satisfying every supplied filter are displayed\
And a price range excludes Quote Requested loads because they have no comparable saved amount\
And clearing the filters restores all loads permitted by visibility policy.

Given Local and Long-distance route loads coexist\
When the provider filters movement scope or Local locality\
Then structured movement and place identities are used\
And origin and destination route filters apply only to Long-distance route records\
And exact Local pickup or drop-off coordinates are not returned to the Board.

Given a provider chooses one of its own trucks with a current planned route\
When Shipment Board results are displayed\
Then loads with both route endpoints aligned are ranked before one-endpoint and unmatched loads\
And each result explains its route-match strength without claiming that the truck is assigned.

### Scenario: Tracking contains only execution-stage involved loads

Given a fleet transporter or self-managed driver can discover an unassigned posted load\
When they open Tracking\
Then that unrelated posted load is absent\
And it remains available on the Shipment Board according to discovery visibility.

Given the transporter organization, self-managed driver, shipper Business, or receiver Business is a party to a load\
When that actor opens Tracking\
Then only Agreed, Assigned, In Transit, On Hold, Issue, Delivered, or Completed loads are listed\
And Posted, Sent, Contacted, and merely saved or interested shipments remain in their Shipment Board or negotiation context.

### Scenario: invalid transition

Given a shipment in a known state\
When an actor requests a transition absent from the freight transition map\
Then the domain rejects the command\
And no status event is persisted.

### Scenario: browsing provider cannot operate an unassigned load

Given a provider can browse an open freight load but is not assigned to it\
When the provider attempts to change its status or add participant-only activity\
Then the command is denied as not found or forbidden\
And no shipment, event, or success audit changes.

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
