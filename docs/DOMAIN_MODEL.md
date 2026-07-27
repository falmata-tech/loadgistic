# Domain Model

## Demand

- Business looking for capacity
- Business receiving shipments
- Shipment demand
- Direct request, saved partners, or open market

## Supply

- Fleet Transporter
- Self-managed Driver / Owner-Operator
- Freight corridors and truck capacity
- Explainable load-to-truck route match

## Shared execution

- Canonical Shipment
- Shipment Parties
- Provider Interest
- Status Events
- Tracking Token
- Tracking obligation: Status timeline or Approximate location + status
- Customer-safe tracking event with optional privacy-obscured general area
- Proof Files
- Temporary Load Proof Request and recipient grant
- Party-only receiver first name and phone, recorded after agreement and before assignment
- Business Review tied to one Completed load, one reviewing Business, and the other Business participant
- Tracking workspace projection that contains only records involving the signed-in workspace

## Capacity

- Vehicle with make, model, plate, and standardized visual cargo configuration
- Status: Empty, Partial, Off Duty
- Available percentage
- Accepted load policy: FTL, PTL, or Both
- Stop policy: Direct only or Open to multi-stop
- General current area and location update time
- Optional half-degree device area with a 40 km privacy radius
- Corridor entered as two separate cities
- Visibility: Public or Partners
- Contract-lane interest
- Update actor and time
- Optional timestamped capacity photo
- Expiry

## Member network

- Business operating regions or cities declared on its authenticated Public Profile
- Transporter preferred corridors declared as endpoint names
- Saved Business-to-provider relationship
- Fleet network coverage projection: matching declared Business places against recorded corridor endpoints
- No inferred facility coordinate, live Business location, distance, or service guarantee

## Trust

- Business Application
- Verification Request for an owned organization, provider profile, driver, or vehicle
- Evidence-derived gray or blue verification badge
- Authenticated Business and Transporter Public Profile
- Separate private account and explicit public contact fields
- Business-designated load phone with explicit marketplace opt in
- Audit Log
- Subscription and Payment Proof
