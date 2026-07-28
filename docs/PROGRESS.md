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
- B2B shipment creation
- Road-freight workflows
- Load discovery and provider interest
- Self-managed Driver capacity Home with duty state, Empty/Partial slider, FTL/PTL/Both, direct/multi-stop, general-area freshness, route intent, contract lanes, Public/Partners visibility, expiry, and timestamped photo support
- Fleet Transporter management Home with company summaries, recent Tracking, and network corridor coverage
- My Fleet roster with truck-specific detail/capacity pages and read-only provider Capacity Board
- Owner-controlled company Driver permissions for Load Board browsing, Business contact, load agreements, and rich assigned-truck capacity
- Restricted company Driver duty-only Home with assigned-truck On Duty and Off Duty control
- Paired profile coverage routes with approximate OpenStreetMap lines, record-derived evidence counts, and member-to-member route comparison
- Real truck identity fields: make, model, cargo configuration, and plate; generic tonnage labels removed
- Ten-image standardized cargo-configuration catalog used by freight creation, driver Home, Fleet, and Capacity
- Freight FTL/PTL requirement and recipient-specific temporary load-size proof sharing
- Business-designated load-phone opt in and party-only receiver contact required before Freight assignment
- Separate city-pair route controls across freight and capacity forms
- Searchable Load and Capacity Boards with transparent both-city, one-city, or no-match route ranking
- Business operating regions on authenticated Public Profiles and directory cards
- Connected-network corridor coverage using declared regional names without exact map pins
- Ethiopian producer- and transporter-focused public homepage with reviewed generated hero imagery
- Public member-marketplace examples that reveal no live marketplace records
- Enforceable Status timeline or Approximate location + status tracking, with real in-between events
- Secret-code customer tracking restricted to involved Businesses with a five-minute idle lock
- Party-only Tracking separated from Load Board discovery
- Rich icon-led Post Load composer with operational deadline labels
- Completed-load shipper/receiver Business reviews and profile rating summaries
- Entity and truck verification submissions, private documents, admin review, and evidence-derived badges
- Separate private account and explicit Public Profile phone/email fields
- Browser-obscured device areas with a 40 km privacy zone for capacity and assigned-load tracking
- Driver-only device location with fleet-owner manual-area enforcement
- Ethiopia-first local city suggestions and nearest-city device labels without an external API key
- Tracking and proof kept as separate contracts
- Manual billing proof and review
- PWA and responsive UI
- Versioned PWA visual-asset cache with automatic worker handoff and stale Next.js executable-chunk prevention
- Supabase migration and RLS target
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
- Dedicated Playwright database, server, and `.next-e2e` artifact isolation from the live `.next` application
- Freight-only shipment creation with FTL/PTL requirements
- Complete mobile workspace menu and role-friendly Business/transporter labels
- Reusable all-role visual audit with 164 desktop/mobile screenshots, zero automated UI flags, and zero browser-flow errors
- Local Node evidence: 46 tests passed
- Local Playwright E2E evidence: 32 passed and four expected viewport skips
- Optimized Next.js production build passed
- Production and development npm dependency audit: zero vulnerabilities

## Requires an internet-enabled environment

- Apply Supabase migrations `001`, `002`, and `003` through Supabase CLI

## Repository administration still required

- Enable branch protection for `main` and require the GitHub Actions `validate` and `e2e` jobs.
- Configure production environment secrets and deployment approval rules in the selected hosting platform.
