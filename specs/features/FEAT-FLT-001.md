---
id: FEAT-FLT-001
title: Fleet driver access and owner controls
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-TRK-001]
problem: Fleet owners need Drivers to publish assigned-truck capacity and operate assigned shipments without surrendering company ownership or unrestricted commercial authority.
behavior: A fleet Driver works inside one provider organization, has at most one current truck assignment, and may manage assigned-truck capacity or tracking only when the fleet owner permits each capability. Fleet owners create shipment records and retain full history; self-managed Drivers retain full provider authority.
contracts: [FleetDriverMembership, DriverPermissionPolicy, DriverVehicleAssignment, DutyCommand, OwnerOversightProjection]
observability: [driver_permission_audit, driver_duty_audit, denied_driver_command, update_actor]
rollout: Add service-role-only PostgreSQL workspace and atomic Driver-access commands with conservative defaults, retain transporter-owner access, and roll back by hiding owner controls while preserving stored settings; local development, Preview, and Production never fall back to SQLite.
---

# Fleet driver access

### Scenario: large fleet management remains bounded

Given a Fleet Transporter has many trucks or company Drivers\
When My Fleet is opened or either list changes page\
Then Trucks and Driver access use independent bounded pages\
And changing one page preserves the position of the other list\
And every active truck and Driver remains reachable.

### Scenario: fleet owner controls Driver authority

Given an authenticated fleet owner and an active driver in the same transporter organization\
When the owner changes that Driver's capacity-control or shipment-tracking permission\
Then the setting is saved only for that driver\
And the change is audited with actor, driver, permission, and resulting value.

### Scenario: managed Fleet has one production-shaped persistence path

Given local development, Preview, or Production uses the managed runtime\
When a Fleet owner opens bounded truck or Driver access data or saves assignment and permission changes\
Then the active application route uses the dedicated Fleet application port and Supabase PostgreSQL\
And one transactional command repeats active actor, workspace subscription, ownership, Driver, and truck checks before ending or creating assignments and updating permissions\
And PostgreSQL preserves displaced assignment history and writes one contact-safe audit outcome\
And unavailable or rejected managed persistence fails closed without importing or querying SQLite\
And anonymous and ordinary browser roles cannot execute the server-only Fleet functions.

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
And Allowed work contains only Capacity updates and Tracking updates\
And retired Shipment Board, Business-contact, and demand-negotiation permissions are neither shown nor accepted as active authority\
And ownership and active-state checks are repeated at the service boundary.

### Scenario: permitted company Driver operates assigned work

Given a fleet Driver is assigned to the shipment's assigned truck and may operate tracking\
When the Driver opens the assignment or records the next permitted tracking event\
Then only the customer-safe shipment facts required for operation are returned\
And the action is recorded for the provider organization with the Driver as actor\
And the fleet owner can see the assignment and tracking history.

### Scenario: company Driver identity retains its employer

Given an authenticated Driver belongs to a fleet transporter\
When workspace navigation, Account, or Verification presents that identity\
Then the role is labelled Company driver rather than Self-managed driver\
And the employing fleet transporter name is displayed with the workspace identity.

### Scenario: every fleet Driver owns a verification step

Given a fleet owner adds an active Company driver and assigns one truck\
When either the owner or that Driver opens Verification\
Then that Driver has a distinct Driver subject for National ID and Driver license\
And Truck authorization is submitted for that exact Driver and assigned-truck pairing with an expiry date\
And the fleet owner can see the Driver's category-level verification status without receiving a public proof-file URL\
And the Driver may submit their own evidence from their workspace\
And missing evidence does not hide the assigned truck or prevent the Driver from appearing publicly.

### Scenario: company driver restrictions are enforced at the service boundary

Given a fleet owner has disabled a Driver's capacity-control or shipment-tracking permission\
When that Driver attempts the denied read or command through a page or direct request\
Then no other shipment party email, private proof, or provider-wide history is returned\
And no capacity update, tracking event, file, email delivery, or success audit is created.

### Scenario: restricted driver keeps duty control

Given a fleet driver is assigned to a company truck and rich capacity control is disabled\
When the driver opens Home\
Then only assigned-truck duty controls are shown\
And the driver may set the truck Off Duty or restore its most recent owner-configured Empty or Partial capacity signal\
And corridor, percentage, public visibility, regular-corridor, proof, and location controls remain unavailable.

### Scenario: permitted driver manages assigned-truck capacity

Given a fleet driver is assigned to a company truck and rich capacity control is enabled\
When the driver publishes capacity\
Then the same truck-level validation and visibility rules as fleet-owner capacity apply\
And the update records the driver as actor\
And the driver cannot update an unassigned or differently owned truck.

### Scenario: self-managed driver is not subordinate to fleet permissions

Given a Driver account owns its provider profile and truck\
When it uses capacity, duty, provider shipment, assignment, or tracking workflows\
Then it has the full provider authority defined by the related feature specs\
And no fleet-owner permission record can reduce that authority.

### Scenario: Driver can reach the canonical public Truck Market

Given an authenticated company or self-managed Driver is inside the workspace\
When the Driver chooses Truck Market or follows a retired authenticated Capacity-market address\
Then the canonical public Truck Map workspace opens at `/` without exposing any field hidden from the public projection\
And the retired `/app/capacity` routes redirect instead of rendering a duplicate market\
And Dashboard returns to the authenticated workspace without requiring a new login.

## Contract ownership

- Application policy and services: dedicated managed Fleet, Tracking, and Capacity application ports
- Inbound adapters: Driver Home, assignment detail, Fleet team controls, and related route handlers
- Persistence adapter: Supabase PostgreSQL fleet-driver, permission, assignment, verification-summary, and audit functions; SQLite remains test-fixture history only during removal
- Tests: managed Fleet contract and live Supabase verifier, `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
