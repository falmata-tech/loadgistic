# Progress

## Complete

- Next.js App Router source structure
- Local persistent database and deterministic seed
- Signed local authentication
- Role-aware navigation and workspaces
- Applications and admin approval
- Authenticated Business and Transporter Directory with Public Profiles
- Workspace-contained Directory and Public Profile navigation with authenticated legacy redirects
- My Network with private Favorites, directional requests, mutual Connected relationships, and profile/directory actions
- B2B shipment creation with independent load owner and shipper/receiver roles
- Account or external shipment counterpart
- My Loads separated from execution-only Tracking
- One Business My Loads navigation destination containing Post load, All my loads, and Active Tracking
- Virtual PSTL discovery over compatible Posted PTL demand
- Road-freight workflows
- Load discovery and provider interest
- Self-managed Driver capacity Home with duty state, Empty/Partial/Busy availability, FTL/PTL/Both, Direct/Multi Pick/Multi Drop, general-area freshness, dated current partial route, dated Full/Partial future travel, contract routes, Public/Partners visibility, and timestamped photo support
- Persistent stale Empty/Partial Capacity Board signals with explicit relative-age warnings, plus Busy available-again signals that leave discovery after their ready date until refreshed
- Single-city Local and Both capacity input, where the local city is also the truck's current general area
- Fleet Transporter management Home with company summaries, recent Tracking, and network route coverage
- My Fleet roster with truck-specific detail/capacity pages and read-only provider Capacity Board
- Permanent Loadgistic truck numbers used in member discovery, with private operational plates retained for owners and administrators
- Owner-controlled company Driver permissions for Load Board browsing, Business contact, load agreements, and rich assigned-truck capacity
- Restricted company Driver duty-only Home with assigned-truck On Duty and Off Duty control
- One authoritative paired profile-route model, labeled Freight Routes for Businesses and Preferred Routes for transport providers
- Approximate OpenStreetMap route lines, record-derived evidence counts, fresh all-truck route projections, and member-to-member comparison
- Ownership-only route maps that consolidate all viewer Preferred/Freight, current-partial, and planned routes into one high-contrast warm-brown dashed layer above solid blue viewed-profile routes
- Real truck identity fields: make, model, cargo configuration, and plate; generic tonnage labels removed
- Ten-image standardized cargo-configuration catalog used by freight creation, driver Home, Fleet, and Capacity
- Freight FTL/PTL requirement and recipient-specific temporary load-size proof sharing
- Business-designated load-phone opt in and party-only receiver contact required before Freight assignment
- Separate city-pair route controls across freight and capacity forms
- Coordinate-authoritative Load and Capacity Boards with adjustable endpoint radii, direct/either direction, all-truck-route ranking, and rounded distance evidence
- Privacy-aware Capacity Board current-area Prefer/Require filtering without coordinate disclosure
- Collapsible Board filters for price/deadline/recency and capacity space/date/visibility/freshness/flexibility/proof
- Structured profile base locations, proximity-ranked Directory filtering, and Business operating regions on authenticated Public Profiles and directory cards
- Connected-network route coverage using structured intercity routes and local service-area circles without exposing exact load pins
- Ethiopian producer- and transporter-focused public homepage with reviewed generated hero imagery
- Public member-marketplace examples that reveal no live marketplace records
- Enforceable Status timeline or Approximate location + status tracking, with real in-between events
- Secret-code customer tracking for account or non-account shipper/receiver parties with a five-minute idle lock
- Party-only Tracking separated from Load Board discovery
- Rich icon-led Post Load composer with operational deadline labels
- Completed-load shipper/receiver Business reviews with immediate four- and five-star publication, private low-rating moderation, and published-only profile summaries
- Entity and truck verification submissions, private documents, admin review, and evidence-derived badges
- Separate private account and explicit Public Profile phone/email fields
- Browser-obscured device areas with 40 km capacity/PTL and 20 km FTL privacy zones
- Driver-only device location with fleet-owner manual-area enforcement
- Local OpenStreetMap Ethiopia settlement catalog with 3,575 imported records, including Addis Ababa sub-city localities
- Country-qualified settlement, region, route, and general-area labels with legacy Ethiopian record normalization
- Bounded async place and member search without large HTML option lists
- Local, Between cities, and Both movement scopes across load posting, capacity publishing, Boards, profiles, and route comparison
- Local-only truck availability constrained to Empty/100 percent, with Partial reserved for dated Between cities or Both routes
- Repeatable profile service areas with 5–100 km coverage radii and mixed circle/route comparison evidence
- Optional local pickup/drop-off map points excluded from discovery and administrative projections and disclosed to non-owner shipment parties only after agreement
- Tracking and proof kept as separate contracts
- Seven-day workspace trials, Business-only sponsored access, manually approved 30-day access, and billing-only expired-account mode without public plan prices
- PWA and responsive UI
- Versioned PWA visual-asset cache with automatic worker handoff and stale Next.js executable-chunk prevention
- Supabase migrations `001` through `007`, including PostGIS geography/GiST matching, and RLS target
- Unit and repository tests
- Playwright workflow definitions
- Browserbase configuration boundary
- Linked frontend, backend, and deployment base specifications
- End-to-end feature specifications for all implemented capability areas
- Executable specification integrity and traceability checks
- Major-action engineering guardrails and pull-request evidence template
- GitHub Actions CI and Dependabot configuration
- Explicit actor/tenant/record authorization matrix
- Default-deny shipment-party policy shared by status, note, and proof services
- Connected-relationship filtering for Partners freight and capacity discovery
- Immutable terminal application and payment-proof reviews
- Negative authorization contract suite and browse-only E2E coverage
- Session-aware public navigation and authenticated provider-request continuity
- Public login credential-fixture removal and pending-applicant seed correction
- Separate `.next-dev`, `.next`, and `.next-e2e` artifacts for the live dev server, production build, and isolated Playwright runtime
- Freight-only shipment creation with FTL/PTL requirements
- Complete mobile workspace menu and role-friendly Business/transporter labels
- Reversible deep-detail Back controls with safe direct-link fallbacks
- Searchable, tabbed admin Operations inventory with one bounded safe projection at a time and audited account/truck controls
- Unified admin Review Center for applications, documents, low ratings, and payments, with server-side queue filtering and pagination
- Server-owned pagination for Boards, Directory, My Loads/Tracking, Network, Fleet, profile and shipment histories, administration, verification, and billing views
- Opt-in comprehensive local dataset covering all 30 application tables, all user types, fleets, local/intercity movement scopes, subscription and workflow states, integrity checks, and a named cross-market network cohort
- Reusable all-role visual audit with 186 desktop/mobile screenshots and zero layout, accessibility-label, or browser-flow errors
- Local Node evidence: 76 tests passed, including Busy/stale capacity behavior, coordinate/radius matching, geography privacy, named network visibility, bounded-list behavior, subscription access, comprehensive-data integrity, and Production-denial coverage
- Local Playwright E2E evidence: 38 passed and four expected viewport skips
- Dense-data visual evidence: 74 desktop/mobile screens passed with zero failures across network relationship views, Partners and Direct visibility, first and second result pages, ownership-only route comparison, and expired billing mode
- Optimized Next.js production build passed
- Stress-dataset warm-query evidence: Directory 5.19 ms median, Load Board 1.33 ms, Capacity Board 1.42 ms, direct capacity detail 0.63 ms, and PSTL grouping 3.58 ms
- Production and development npm dependency audit: zero vulnerabilities

## Requires an internet-enabled environment

- Apply Supabase migrations `001` through `007` through Supabase CLI

## Planned external integration

- Implement the disabled `FEAT-SUP-001` support adapter after choosing and provisioning Chatwoot Cloud or self-hosted Premium, defining retention and residency, and supplying signed identity-validation and webhook credentials.

## Repository administration still required

- Enable branch protection for `main` and require the GitHub Actions `validate` and `e2e` jobs.
- Configure production environment secrets and deployment approval rules in the selected hosting platform.
