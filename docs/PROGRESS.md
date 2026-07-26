# Progress

## Complete

- Next.js App Router source structure
- Local persistent database and deterministic seed
- Signed local authentication
- Role-aware navigation and workspaces
- Applications and admin approval
- Authenticated provider Public Profiles and transporter directory
- B2B shipment creation
- Road-freight workflows
- Load discovery and provider interest
- Driver-first capacity home with duty state, Empty/Partial slider, FTL/PTL/Both, direct/multi-stop, general-area freshness, route intent, contract lanes, Public/Partners visibility, expiry, and timestamped photo support
- Separate fleet overview and read-only provider Capacity Board
- Real truck identity fields: make, model, cargo configuration, and plate; generic tonnage labels removed
- Ten-image standardized cargo-configuration catalog used by freight creation, driver Home, Fleet, and Capacity
- Freight FTL/PTL requirement and recipient-specific temporary load-size proof sharing
- Business-designated load-phone opt in and party-only receiver contact required before Freight assignment
- Separate city-pair route controls across freight and capacity forms
- Public member-marketplace examples that reveal no live marketplace records
- Enforceable Status timeline or Approximate location + status tracking, with real in-between events
- Browser-obscured device areas with a 40 km privacy zone for capacity and assigned-load tracking
- Tracking and proof kept as separate contracts
- Manual billing proof and review
- PWA and responsive UI
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
- Saved-partner relationship filtering for freight discovery
- Immutable terminal application and payment-proof reviews
- Negative authorization contract suite and browse-only E2E coverage
- Session-aware public navigation and authenticated provider-request continuity
- Public login credential-fixture removal and pending-applicant seed correction
- Dedicated Playwright database and server isolation from local development data
- Freight-only shipment creation with FTL/PTL requirements
- Complete mobile workspace menu and role-friendly Business/transporter labels
- Reusable all-role visual audit with 110 desktop/mobile screenshots, zero automated UI flags, and zero browser-flow errors
- Local Playwright E2E evidence: 21 passed and one expected desktop skip for a mobile-only assertion

## Requires an internet-enabled environment

- Apply Supabase migration through Supabase CLI

## Repository administration still required

- Enable branch protection for `main` and require the GitHub Actions `validate` and `e2e` jobs.
- Configure production environment secrets and deployment approval rules in the selected hosting platform.
