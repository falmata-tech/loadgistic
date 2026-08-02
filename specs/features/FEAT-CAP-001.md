---
id: FEAT-CAP-001
title: Truck-first Truck Board and publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-FLT-001, FEAT-NET-001, FEAT-GEO-001, FEAT-MAT-001]
problem: Business shippers need simple, current truck availability while drivers need a fast operational home for keeping that signal trustworthy.
behavior: Self-managed drivers use a truck-level Home control panel while fleet transporters manage truck capacity inside Fleet; selecting Empty, Partial, or Busy places a truck On Duty while Off Duty is the only separate unavailable state. Each update records general current area, accepted work, live Partial movement, dated planned movement, Preferred Routes, visibility, and optional timestamped proof. Businesses receive independently actionable truck cards while drivers and transporters receive one anonymized, read-only card per visible truck. Freshness is explicit rather than silently removing stale Empty or Partial signals.
contracts: [CapacityUpdate, CapacityStatus, DutyState, CapacityPercentage, BusyAvailability, AcceptedLoadPolicy, StopPolicy, CurrentPartialRoute, PlannedTravelRoute, PreferredRoute, TruckPlatformNumber, GeneralAreaFreshness, ObscuredDeviceArea, CapacityVisibilityPolicy, RelationshipVisibilityPolicy, CapacityProof, CapacityDetail, FleetRoster, CapacityRouteMatch, DriverCapacityPermission, DutyCommand]
observability: [capacity_audit, update_actor, updated_at, location_updated_at, proof_recorded_at, available_again_date, freshness]
rollout: Add Busy additively, backfill existing status into the new availability projection, retain stale Empty and Partial signals, and preserve Off Duty privacy.
---

# Capacity publication

### Scenario: Truck Board remains bounded

Given more visible trucks match than one Truck Board page\
When a member opens, filters, route-ranks, or changes page\
Then the server renders one bounded page containing one card per visible truck\
And Business cards are actionable while provider cards are anonymized and read only\
And page navigation preserves every active capacity filter\
And no search is required to see the first page\
And fresh signals rank ahead of stale signals when all stronger filters and route scores are equal.

### Scenario: partial capacity is published for one truck

Given an authorized transporter, driver, or administrator owns the vehicle\
When Partial capacity with an integer from 1 through 99 is submitted\
Then the update records actor and time\
And the public record displays the declared percentage.

### Scenario: stale cargo-space capacity remains explicit

Given a truck has an Empty or Partial capacity signal and remains On Duty\
When its capacity or location update becomes old\
Then it remains on the Truck Board during the early-market rollout\
And its card shows the relative last capacity and location update times\
And a strong stale warning tells the viewer to confirm availability\
And stale signals rank below equivalent fresh signals\
And a current Partial route stops matching when its capacity signal is stale\
And planned routes still stop matching after their own route dates.

### Scenario: Busy advertises future availability

Given an authorized driver or fleet owner is carrying work but remains open to calls\
When Busy is selected\
Then the truck remains On Duty\
And an available-again date and one structured current or expected city are required\
And the Truck Board labels the truck Busy and open to contact\
And it displays Preferred Routes but no current cargo-space percentage or current partial-capacity route\
And Empty or Partial load-size and stop preferences are not represented as currently available capacity.

### Scenario: unrefreshed Busy leaves discovery after its ready date

Given a truck publishes Busy with an available-again date\
When that local calendar date passes without a newer Empty, Partial, or Busy update\
Then the truck is absent from the Truck Board and route matching\
And its latest owner and driver control indicates that a fresh availability decision is required\
And the persisted historical update remains available to its owner and administrators.

### Scenario: availability selection controls duty

Given a truck has a latest availability state\
When Empty, Partial, or Busy is selected\
Then the truck is On Duty\
And when Off Duty is selected it is hidden from Truck Board discovery\
And the editor presents Empty, Partial, Busy, and Off Duty together without a separate On Duty control\
And freshness never changes the persisted duty choice by itself\
And an expired Busy signal is treated as undiscoverable until refreshed rather than silently rewritten as a user-authored Off Duty command.

### Scenario: capacity belongs to an identifiable real truck

Given a fleet or self-managed driver selects a truck\
When capacity or fleet information is displayed\
Then the truck is identified by make, model, cargo configuration, and plate\
And Loadgistic assigns one permanent unique platform number when the truck is first created\
And member-facing Capacity and Public Profile views use the platform number instead of exposing the plate\
And the cargo configuration uses the standardized visual truck catalog\
And generic tonnage labels are not used as the truck identity.

### Scenario: every visible truck stands alone for a Business

Given a fleet transporter has multiple discoverable Empty, Partial, or Busy trucks\
When an authenticated Business opens the Truck Board\
Then each truck is a separate capacity contributor and card\
And no provider-level summary collapses those trucks into one signal.

### Scenario: providers see anonymized trucks standing alone

Given a driver or fleet transporter opens the Truck Board to gauge competing supply\
When Public truck capacity is rendered\
Then each visible truck remains one separate card rather than becoming an aggregate count\
And the card shows its standardized cargo-configuration image and name, availability, approximate area, active route or service area, accepted work, timing, and freshness\
And it does not expose the company, owner, driver, make, model, platform number, plate, contact, verification subjects, raw capacity identifier, proof file, profile link, or interaction action\
And provider Board search and filtering use only displayed operational capacity fields so hidden identity cannot be inferred through a query oracle\
And the provider's own trucks remain excluded from this market-discovery view.

### Scenario: Truck Board card is complete for discovery

Given a Business may view a truck's Public or Partners capacity\
When its Truck Board card is rendered\
Then the card shows the truck, cargo configuration, availability, area, active routes, accepted load policy, freshness, and trust signals\
And no truck-detail step is required before the user can call or open the owning fleet or owner-operator Public Profile\
And all Board and profile reads reapply the same visibility authorization.

### Scenario: fleet roster count is authoritative

Given a fleet transporter owns active truck records\
When its Public Profile or Fleet page is displayed\
Then its truck count equals the active vehicle rows\
And every active truck appears in the roster as Empty, Partial, Busy, Off Duty, or Not updated\
And Off Duty trucks remain absent from the Truck Board.

### Scenario: fleet capacity requires a current driver

Given an active fleet truck has no current company Driver assignment\
When a fleet owner attempts to publish Empty, Partial, or Busy capacity\
Then the command is rejected before a capacity record is created\
And any legacy on-duty signal for an unassigned fleet truck is excluded from Truck Board discovery\
And the truck remains active and visible in My Fleet so an owner can assign a Driver or set it Off Duty.

### Scenario: empty capacity is published

Given an authorized transporter, driver, or administrator owns the vehicle\
When Empty capacity is submitted\
Then the update records its planned route when supplied, actor, time, and 100 percent availability.

### Scenario: Local-only capacity is fully available

Given an authorized driver or fleet owner chooses Local-only work for one truck\
When capacity is published\
Then the cargo-space state must be Empty with 100 percent available\
And Partial is rejected because it has no current intercity route on which to locate the remaining space\
And Both may still use Partial when its required live current intercity route is recorded.

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
Then it must declare the exact live current travel route on which that partial space exists\
And that route describes the truck's current direction rather than requiring the final destination of cargo already aboard\
And the driver is not asked for a date because the capacity update time is the route's clock\
And any on-duty truck may separately declare one future planned travel route, date, and Full or Partial planned cargo-space label\
And regular Preferred Routes remain a multiple-value Public Profile setting controlled by the fleet company admin or self-managed owner\
And stale current Partial capacity and past planned-route dates are excluded from live matching.

### Scenario: self-managed driver Home prioritizes live capacity controls

Given a self-managed driver signs in or opens Home\
When the workspace loads\
Then their truck capacity control panel is the first operational view\
And they do not have to open a general dashboard before updating their truck.

### Scenario: capacity publication follows visible ordered decisions

Given a driver or fleet owner updates a truck\
When the capacity editor opens\
Then the primary flow visibly numbers truck status, work area, status-specific details, accepted shipment size, route flexibility, future-work preferences, and visibility in that logical order\
And Empty, Partial, Busy, and Off Duty are the first availability choice\
And the selected truck is a compact identity header rather than a separate form section\
And current available space and the current partial-capacity route remain visibly connected\
And the current route is required only for Partial intercity or Both work\
And Local-only work keeps Partial unavailable\
And Busy replaces cargo-space controls with available-again date and city controls\
And FTL, PTL, Both, Direct, Multi Pick, Multi Drop, contract-route interest, and visibility are not hidden inside an additional-options disclosure\
And only optional evidence and an unused future trip may use compact secondary presentation\
And publication uses one persistent primary action without a duplicate review panel.

### Scenario: irrelevant capacity steps disappear without obscuring the task

Given a driver chooses Busy or Off Duty\
When the remaining capacity controls render\
Then Off Duty ends the workflow after the status choice and publishes a hidden state\
And Busy asks for ready date, expected area, future-work preference, and visibility without asking for current FTL, PTL, Multi Pick, or Multi Drop availability\
And every visible step keeps a stable increasing number so the next required action is unambiguous.

### Scenario: Both reuses the Local city as current area

Given a truck is available for both Local and Long-distance route work\
When its driver selects the structured Local city or town\
Then that place is also the truck's declared current general area\
And the driver is not asked for a second current-area city\
And device-assisted location may update that same structured place and obscured area\
And Local radius and intercity route controls remain independently available.

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
And assigned-truck availability or Off Duty remains available when rich controls are disabled without exposing route, visibility, or shipment-preference controls.

### Scenario: Truck Board supports route-aware discovery

Given an authenticated member opens the Truck Board\
When they filter by text, route cities, cargo configuration, capacity status, accepted load type, minimum available space, route date, visibility, freshness, stop flexibility, contract-route openness, or proof availability\
Then only trucks satisfying every supplied filter are displayed\
And clearing the filters restores all capacity permitted by visibility policy.

Given Local, Long-distance route, and Both truck signals coexist\
When a member filters movement scope or Local locality\
Then each truck remains one independently authorized result\
And Local matching uses its structured locality and radius\
And route fields remain optional for Local-only capacity.

Given a Business chooses one of its own open load routes\
When Truck Board results are displayed\
Then every eligible live current Partial route and dated planned route is compared by endpoint distance\
And trucks satisfying both adjustable endpoint radii rank by their strongest route\
And each result explains endpoint distances, direction, and route source without claiming dispatch suitability or availability beyond the recorded capacity.

Given a provider compares routes or ranks the Shipment Board\
When eligible truck route records exist\
Then every owned truck contributes its current unexpired partial route and eligible planned route independently\
And the best match across selected or all active truck routes is used\
And each option identifies the truck platform number, route source, signal freshness or planned date, and planned Full or Partial cargo-space label.

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

### Scenario: driver location acquisition starts automatically

Given an assigned or self-managed driver opens capacity controls on a geolocation-capable device\
When the controls hydrate\
Then the browser requests device location without requiring a separate location button\
And while the screen remains open it may refresh the device reading within a bounded interval\
And only the obscured coordinate is retained for submission\
And the interface communicates locating, ready, denied, or unavailable state without blocking the capacity choices.

### Scenario: device location failure keeps a manual fallback

Given a driver declines location permission or the device cannot determine a position\
When automatic acquisition fails\
Then the general-area field remains available\
And the capacity update can be published without a coordinate\
And no repeated permission prompt is triggered during the same mounted editor.

### Scenario: only the assigned driver may use device location

Given a fleet owner edits capacity for one company truck\
When the owner opens the truck-specific capacity page or submits a device-assisted coordinate\
Then the interface offers only a manually declared general area\
And the service rejects device-assisted location because the owner's device does not establish the truck's location\
And an authorized assigned company driver may still use its own device location for that truck.

### Scenario: marketplace location remains intentionally approximate

Given capacity includes an obscured device area\
When an authorized user views its Truck Board card or detail\
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
Then the Truck Board displays that signal without changing Empty, Partial, or Off Duty status.

### Scenario: off-duty capacity is private

Given a truck is unavailable and does not want calls\
When the owner marks it Off Duty or stops publishing capacity\
Then that truck is absent from public and relationship-scoped capacity discovery.

### Scenario: relationship capacity is scoped

Given a transporter publishes capacity to Connected business relationships\
When businesses browse capacity\
Then only businesses with a mutual Connected relationship to that transporter can see it.

### Scenario: provider cards cannot disclose hidden identity

Given a transporter or driver views capacity belonging to other providers\
When the Truck Board loads\
Then visible current signals remain separate anonymized cards\
And no raw capacity or vehicle identifier, platform number, make, model, owner, company, driver, contact, badge, proof file, or profile link is returned or rendered\
And no contact or interest action is available\
And filtering uses only visible operational fields without disclosing hidden identity.

## Contract ownership

- Domain rules: `validateCapacity`, `capacityFreshness`
- Application services: `publishCapacity`, `listPublicCapacity`
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
