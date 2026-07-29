---
id: FEAT-CAP-001
title: Truck-first Capacity Board and publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-FLT-001, FEAT-NET-001]
problem: Business shippers need simple, current truck availability while drivers need a fast operational home for keeping that signal trustworthy.
behavior: Self-managed drivers use a truck-level Home control panel while fleet transporters manage truck capacity inside Fleet; each publishes duty state, Empty or Partial cargo space, accepted load sizes, general current area, dated current-partial movement, dated and capacity-labeled planned movement, contract-route openness, visibility, and optional timestamped proof. Each visible truck stands alone on the searchable Capacity Board, while all active fleet trucks remain in the owner's roster even when Off Duty.
contracts: [CapacityUpdate, CapacityStatus, CapacityPercentage, AcceptedLoadPolicy, StopPolicy, CurrentPartialRoute, PlannedTravelRoute, PreferredRoute, TruckPlatformNumber, GeneralAreaFreshness, ObscuredDeviceArea, CapacityVisibilityPolicy, RelationshipVisibilityPolicy, CapacityProof, CapacityDetail, FleetRoster, CapacityRouteMatch, DriverCapacityPermission, DutyCommand, Expiry]
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
And Loadgistic assigns one permanent unique platform number when the truck is first created\
And member-facing Capacity and Public Profile views use the platform number instead of exposing the plate\
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
Then the detail shows the truck, cargo configuration, availability, area, active routes, accepted load policy, freshness, and owning transporter or self-managed driver\
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
Then the update records its planned route when supplied, actor, time, and 100 percent availability.

### Scenario: route cities are entered separately

Given a driver updates planned movement\
When they enter the route\
Then the origin and destination are separate city inputs joined by a clear route cue\
And the driver is not asked to repeat both cities inside one free-text route field.

### Scenario: an empty driver declares accepted load sizes

Given a company or self-managed driver marks a truck Empty\
When the driver publishes the update\
Then the driver explicitly chooses FTL, PTL, or Both\
And Direct is always accepted\
And the driver independently chooses whether to accept Multi Pick and Multi Drop\
And both acceptance policies are displayed independently from cargo-space status.

### Scenario: capacity route meanings remain distinct

Given a truck has Partial cargo space\
When its driver publishes capacity\
Then it may declare the current route and date on which that partial space exists\
And any on-duty truck may separately declare one future planned travel route, date, and Full or Partial planned cargo-space label\
And regular Preferred Routes remain a multiple-value Public Profile setting controlled by the fleet company admin or self-managed owner\
And expired capacity, past current-route dates, and past planned-route dates are excluded from live matching.

### Scenario: self-managed driver Home prioritizes live capacity controls

Given a self-managed driver signs in or opens Home\
When the workspace loads\
Then their truck capacity control panel is the first operational view\
And they do not have to open a general dashboard before updating their truck.

### Scenario: fleet transporter Home remains a management dashboard

Given a fleet transporter manages multiple active vehicles\
When they sign in or open Home\
Then they see company-wide load, capacity, fleet, and workflow summaries\
And truck capacity controls remain inside Fleet\
And selecting a truck in Fleet opens a truck-specific detail and update page without another truck selector.

### Scenario: company driver capacity follows owner controls

Given a company driver is assigned to a fleet truck\
When the driver opens Home\
Then the truck's current duty state and latest capacity actor are visible\
And rich capacity controls appear only when the fleet owner permits capacity management\
And duty On or Off remains available when rich controls are disabled.

### Scenario: Capacity Board supports route-aware discovery

Given an authenticated member opens the Capacity Board\
When they filter by text, route cities, cargo configuration, capacity status, accepted load type, minimum available space, route date, visibility, freshness, stop flexibility, contract-route openness, or proof availability\
Then only trucks satisfying every supplied filter are displayed\
And clearing the filters restores all capacity permitted by visibility policy.

Given a Business chooses one of its own open load routes\
When Capacity Board results are displayed\
Then trucks with both route endpoints aligned are ranked before one-endpoint and unmatched trucks\
And each result explains its route-match strength without claiming dispatch suitability or availability beyond the recorded capacity.

Given a provider compares routes or ranks the Load Board\
When fresh truck route records exist\
Then every owned truck contributes its unexpired current-partial route and eligible planned route independently\
And the best match across selected or all active truck routes is used\
And each option identifies the truck platform number, route source, date, and planned Full or Partial cargo-space label.

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

### Scenario: only the assigned driver may use device location

Given a fleet owner edits capacity for one company truck\
When the owner opens the truck-specific capacity page or submits a device-assisted coordinate\
Then the interface offers only a manually declared general area\
And the service rejects device-assisted location because the owner's device does not establish the truck's location\
And an authorized assigned company driver may still use its own device location for that truck.

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

### Scenario: contract-route interest is independent of capacity

Given a driver is open to recurring work on Preferred Routes\
When the driver enables contract-route interest\
Then the Capacity Board displays that signal without changing Empty, Partial, or Off Duty status.

### Scenario: off-duty capacity is private

Given a truck is full or unavailable\
When the owner marks it Off Duty or stops publishing capacity\
Then that truck is absent from public and relationship-scoped capacity discovery.

### Scenario: relationship capacity is scoped

Given a transporter publishes capacity to Connected business relationships\
When businesses browse capacity\
Then only businesses with a mutual Connected relationship to that transporter can see it.

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
