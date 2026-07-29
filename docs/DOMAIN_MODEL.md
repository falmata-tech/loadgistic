# Domain Model

## Demand

- Business looking for capacity
- Business acting as a shipper or receiver for a specific load
- Shipment demand
- Direct request, Connected Partners, or open market

## Supply

- Fleet Transporter
- Self-managed Driver / Owner-Operator
- Preferred Routes and dated truck capacity routes
- Explainable load-to-truck route match

## Shared execution

- Canonical Shipment
- Shipment Parties
- Provider Interest
- Status Events
- Secret Tracking Access Code stored as a keyed digest
- Five-minute browser/load-bound customer Tracking Grant
- Tracking obligation: Status timeline or Approximate location + status
- Customer-safe tracking event with optional privacy-obscured general area
- Proof Files
- Temporary Load Proof Request and recipient grant
- Party-only receiver first name and phone, recorded after agreement and before assignment
- Business Review tied to one Completed load, one reviewing Business, and the other Business participant
- Business Review publication state: Pending, Published, or Dismissed
- Terminal Rating Moderation Decision with administrator, investigation note, and review time
- Tracking workspace projection that contains only records involving the signed-in workspace

## Capacity

- Vehicle with permanent Loadgistic platform number, make, model, private plate, and standardized visual cargo configuration
- Status: Empty, Partial, Off Duty
- Available percentage
- Accepted load policy: FTL, PTL, or Both
- Stop policy: Direct is always accepted, with independent Multi Pick and Multi Drop choices
- General current area and location update time
- Optional half-degree device area with a 40 km privacy radius
- Current partial-capacity route with separate city endpoints and date
- Planned route with separate city endpoints, date, and Full or Partial cargo-space intent
- Visibility: Public or Partners
- Contract-route interest
- Update actor and time
- Optional timestamped capacity photo
- Expiry

## Member network

- Business operating regions or cities declared on its authenticated Public Profile
- Business Freight Routes and provider Preferred Routes declared as endpoint names
- Private Favorite, directional Pending request, and mutual Connected Business-provider relationship
- Fleet network coverage projection: matching declared Business places against Preferred Routes and fresh truck-route endpoints
- No inferred facility coordinate, live Business location, distance, or service guarantee

## Trust

- Business Application
- Verification Request for an owned organization, provider profile, driver, or vehicle
- Evidence-derived gray or blue verification badge
- Authenticated Business and Transporter Public Profile
- Separate private account and explicit public contact fields
- Business-designated load phone with explicit marketplace opt in
- Audit Log
- Private administrator Rating Reviews queue with published-only reputation projection
- Subscription and Payment Proof

## Subscription access

- Workspace-owned subscription: Business and Fleet Transporter subscriptions belong to an organization; a Self-managed Driver subscription belongs to its provider profile
- Company Drivers inherit their Fleet Transporter's subscription
- Seven-day Trial created on application approval
- Business-only Sponsored access selected by an administrator during application review
- Positive amount actually paid and optional private Payment Proof
- Thirty-day Active period created when an administrator marks payment paid
- Expired or under-review operating restriction with retained Home, account, billing, and logout access
- No public standard plan price

## Bounded result pages

- Server-owned filters and deterministic ordering
- Result envelope: items, total, current page, page size, and page count
- Useful first page for marketplace discovery without mandatory search
- Search-before-results for potentially large entity selection controls
- Independent page keys for screens containing more than one growing list
- SQLite MVP may assemble authorized projections before slicing; the production database adapter must apply equivalent filtering and `LIMIT`/cursor bounds in the database
