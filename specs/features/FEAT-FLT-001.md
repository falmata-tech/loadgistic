---
id: FEAT-FLT-001
title: Fleet driver access and owner controls
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-TRK-001]
problem: Fleet owners need drivers to perform day-to-day load and capacity work without surrendering company oversight or granting every driver unrestricted commercial authority.
behavior: A fleet driver works inside one transporter organization, has at most one current truck assignment, and may browse loads, view Business contact details, negotiate loads, and manage assigned-truck capacity only when the fleet owner permits each capability; every fleet driver may still sign in and set an assigned truck On Duty or Off Duty, while self-managed drivers retain full provider authority.
contracts: [FleetDriverMembership, DriverPermissionPolicy, DriverVehicleAssignment, DutyCommand, OwnerOversightProjection]
observability: [driver_permission_audit, driver_duty_audit, denied_driver_command, update_actor]
rollout: Add permissions and assignments additively with conservative defaults, retain transporter-owner access, and roll back by hiding owner controls while preserving stored settings.
---

# Fleet driver access

### Scenario: large fleet management remains bounded

Given a Fleet Transporter has many trucks or company Drivers\
When My Fleet is opened or either list changes page\
Then Trucks and Driver access use independent bounded pages\
And changing one page preserves the position of the other list\
And every active truck and Driver remains reachable.

### Scenario: fleet owner controls driver authority

Given an authenticated fleet owner and an active driver in the same transporter organization\
When the owner changes that driver's Shipment Board, Business contact, shipment negotiation, or capacity-control permission\
Then the setting is saved only for that driver\
And the change is audited with actor, driver, permission, and resulting value.

### Scenario: fleet owner assigns one current driver to one current truck

Given an authenticated fleet owner manages an active company driver and active truck in the same organization\
When the owner assigns that truck to the driver\
Then the driver has that one current truck assignment\
And any prior active truck assignment for that driver is ended\
And any prior active driver assignment for that truck is ended\
And historical assignment rows are retained\
And the change is audited with actor, driver, truck, and displaced assignments.

### Scenario: fleet driver management follows one ordered task

Given a fleet owner opens Driver access\
When one driver is expanded for management\
Then the interface presents Driver identity first, current truck assignment second, allowed work third, and one save action last\
And the truck selector contains only active trucks owned by that transporter\
And an explicit unassigned choice is available\
And ownership and active-state checks are repeated at the service boundary.

### Scenario: permitted company driver handles Business demand

Given a fleet driver may browse the Shipment Board, contact Businesses, and negotiate shipments\
When the driver views a permitted load, expresses interest, requests load proof, accepts a direct request addressed to the company, or assigns the Driver's current truck after agreement\
Then the action is recorded for the transporter organization with the driver as actor\
And the fleet owner can see the resulting interest, agreement, assignment, and tracking history.

### Scenario: company driver restrictions are enforced at the service boundary

Given a fleet owner has disabled a driver's Shipment Board or negotiation permission\
When that driver attempts the denied read or command through a page or direct request\
Then no protected shipment or designated Business phone is returned when Shipment Board access is denied\
And no interest, proof request, acceptance, notification, event, or success audit is created when negotiation is denied.

### Scenario: contact permission is narrower than Shipment Board access

Given a fleet driver may browse loads but may not contact Businesses\
When the driver opens the Shipment Board or a discoverable shipment detail\
Then load facts remain visible\
And the designated Business phone and contact actions are absent\
And commands that initiate Business contact or negotiation are denied.

### Scenario: restricted driver keeps duty control

Given a fleet driver is assigned to a company truck and rich capacity control is disabled\
When the driver opens Home\
Then only assigned-truck duty controls are shown\
And the driver may set the truck Off Duty or restore its most recent owner-configured Empty or Partial capacity signal\
And route, percentage, visibility, accepted-load, multi-stop, contract-lane, proof, and location controls remain unavailable.

### Scenario: permitted driver manages assigned-truck capacity

Given a fleet driver is assigned to a company truck and rich capacity control is enabled\
When the driver publishes capacity\
Then the same truck-level validation and visibility rules as fleet-owner capacity apply\
And the update records the driver as actor\
And the driver cannot update an unassigned or differently owned truck.

### Scenario: self-managed driver is not subordinate to fleet permissions

Given a Driver account owns its provider profile and truck\
When it uses Shipment Board, Business contact, negotiation, capacity, duty, assignment, or tracking workflows\
Then it has the full provider authority defined by the related feature specs\
And no fleet-owner permission record can reduce that authority.

## Contract ownership

- Application policy and services: driver access, shipment, and capacity functions in `src/lib/repository.js`
- Inbound adapters: Driver Home, Shipment Board, shipment detail, Fleet team controls, and related route handlers
- Persistence adapter: additive fleet-driver permission and vehicle-assignment tables in `src/lib/db.js`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
