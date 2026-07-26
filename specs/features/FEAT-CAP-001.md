---
id: FEAT-CAP-001
title: Truck-first Capacity Board and publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001]
problem: Business shippers need simple, current truck availability while drivers need a fast operational home for keeping that signal trustworthy.
behavior: Company and self-managed drivers use a truck-level control panel to publish duty state, Empty or Partial cargo space, accepted load sizes, general current area, planned movement, contract-lane openness, visibility, and optional timestamped proof; each visible truck stands alone on the Capacity Board, while all active fleet trucks remain in the owner's roster even when Off Duty.
contracts: [CapacityUpdate, CapacityStatus, CapacityPercentage, AcceptedLoadPolicy, StopPolicy, GeneralAreaFreshness, ObscuredDeviceArea, CapacityVisibilityPolicy, RelationshipVisibilityPolicy, CapacityProof, CapacityDetail, FleetRoster, Expiry]
observability: [capacity_audit, update_actor, updated_at, location_updated_at, proof_recorded_at, expires_at]
rollout: Preserve minimal capacity semantics and validate public expiry filtering before release.
---

# Capacity publication

### Scenario: partial capacity is published for one truck

Given an authorized transporter, driver, or administrator owns the vehicle\
When Partial capacity with an integer from 1 through 99 and an expiry is submitted\
Then the update records actor and time\
And the fresh public record displays the declared percentage.

### Scenario: capacity belongs to an identifiable real truck

Given a fleet or self-managed driver selects a truck\
When capacity or fleet information is displayed\
Then the truck is identified by make, model, cargo configuration, and plate\
And the cargo configuration uses the standardized visual truck catalog\
And generic tonnage labels are not used as the truck identity.

### Scenario: every visible truck stands alone on the Capacity Board

Given a fleet transporter has multiple fresh Empty or Partial trucks\
When an authenticated user opens the Capacity Board\
Then each truck is a separate capacity contributor and card\
And no provider-level summary collapses those trucks into one signal.

### Scenario: capacity card opens truck detail

Given a user may view a truck's Public or Partners capacity\
When they open its capacity detail\
Then the detail shows the truck, cargo configuration, availability, area, corridor, accepted load policy, freshness, and owning transporter or self-managed driver\
And the same visibility authorization is reapplied to the detail read.

### Scenario: fleet roster count is authoritative

Given a fleet transporter owns active truck records\
When its Public Profile or Fleet page is displayed\
Then its truck count equals the active vehicle rows\
And every active truck appears in the roster as Empty, Partial, Off Duty, or Not updated\
And Off Duty trucks remain absent from the Capacity Board.

### Scenario: empty capacity is published

Given an authorized transporter, driver, or administrator owns the vehicle\
When Empty capacity is submitted\
Then the update records the preferred corridor, planned route, actor, time, and 100 percent availability.

### Scenario: corridor cities are entered separately

Given a driver updates planned movement\
When they enter the route\
Then the origin and destination are separate city inputs joined by a clear route cue\
And the driver is not asked to repeat both cities inside a free-text corridor field.

### Scenario: an empty driver declares accepted load sizes

Given a company or self-managed driver marks a truck Empty\
When the driver publishes the update\
Then the driver explicitly chooses FTL, PTL, or Both\
And the driver chooses Direct only or Open to multi-stop\
And both acceptance policies are displayed independently from cargo-space status.

### Scenario: the driver home prioritizes live capacity controls

Given a company or self-managed driver signs in or opens Home\
When the workspace loads\
Then their truck capacity control panel is the first operational view\
And fleet-wide reporting remains a separate destination for fleet staff.

### Scenario: a general location update protects precise movement

Given a driver updates the truck location\
When the capacity signal is published\
Then a driver-declared general area such as "Around Addis Ababa" is stored for marketplace display\
And the location update time is displayed separately from capacity expiry\
And no precise coordinate is required or exposed.

### Scenario: device location is obscured before submission

Given a driver chooses to use the phone or device location\
When the browser grants location permission\
Then the precise coordinate is snapped in the browser to a half-degree grid before submission\
And only the obscured point, a 40 km privacy radius, and the declared general-area label reach the server\
And the precise coordinate is not submitted, stored, logged, or displayed.

### Scenario: device location permission remains optional

Given a driver declines location permission or the device cannot determine a position\
When the driver continues the update\
Then the general-area field remains available\
And the capacity update can be published without a coordinate.

### Scenario: marketplace location remains intentionally approximate

Given capacity includes an obscured device area\
When an authorized user views its Capacity Board card or detail\
Then the interface identifies it as an approximate device-assisted area with a 40 km privacy zone\
And neither the obscured coordinate nor an exact map pin is displayed.

### Scenario: capacity proof carries context

Given a driver optionally attaches a current cargo-space photo\
When the capacity signal is published\
Then the private upload record is associated with the declared general area and update timestamp\
And marketplace users see that proof was recently recorded without receiving a direct file path.

### Scenario: contract-lane interest is independent of capacity

Given a driver is open to recurring work on preferred corridors\
When the driver enables contract-lane interest\
Then the Capacity Board displays that signal without changing Empty, Partial, or Off Duty status.

### Scenario: off-duty capacity is private

Given a truck is full or unavailable\
When the owner marks it Off Duty or stops publishing capacity\
Then that truck is absent from public and relationship-scoped capacity discovery.

### Scenario: relationship capacity is scoped

Given a transporter publishes capacity to saved business relationships\
When businesses browse capacity\
Then only businesses with an active saved relationship to that transporter can see it.

### Scenario: providers browse the Capacity Board read only

Given a transporter or driver views capacity belonging to other providers\
When the Capacity Board loads\
Then the records are read only\
And no contact or interest action is available.

### Scenario: expired capacity is hidden

Given a capacity record is past its expiry\
When public capacity is queried\
Then that record is absent.

## Contract ownership

- Domain rules: `validateCapacity`, `capacityFreshness`
- Application services: `publishCapacity`, `listPublicCapacity`
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
