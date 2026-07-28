# Architecture Decisions

## ADR-001 — Next.js on Node.js

The application uses Next.js App Router on Node.js. This corrects the prior bare-Node implementation and provides server rendering, structured routing, route handlers, PWA compatibility, and production deployment paths.

## ADR-002 — Local SQLite adapter

Use Node's built-in SQLite for deterministic offline persistence. Keep all persistence behind repository functions and include a Supabase PostgreSQL/RLS target.

## ADR-003 — One canonical shipment

A request, load, and operating shipment use one record. UI terminology changes by workflow stage, but data is not copied into a second entity.

## ADR-004 — Minimal capacity

Capacity is truck-level and intentionally direct: duty state, Empty or Partial cargo space, FTL/PTL/Both acceptance, direct or multi-stop acceptance, general current area and its freshness, preferred movement, contract-lane interest, Public/Partners visibility, and expiry. A full or unavailable truck is treated as Off Duty and is not shown in discovery. Optional timestamped photos support the signal without claiming physical verification. The marketplace never requires or exposes a precise live coordinate.

## ADR-005 — Server-rendered forms

Use normal HTML forms and Route Handlers for most actions. This is resilient on weaker devices and connections and reduces unnecessary client-side state.

## ADR-006 — Linked executable specifications

Use Markdown specifications with validated YAML front matter. Base specs define frontend, backend, and deployment constraints; vertical feature specs link to them and express material behavior with Given/When/Then scenarios. Completion requires tests and rollout evidence, not documentation alone.

## ADR-007 — Pragmatic hexagonal and DDD boundaries

Adopt ports/adapters, SOLID dependency direction, and DDD vocabulary without mandating class-based implementation. Pure domain functions remain preferred for deterministic rules. Extract explicit outbound ports as adapters multiply; do not perform a speculative rewrite of the working SQLite MVP.

## ADR-008 — CI as a release guardrail

GitHub Actions performs locked dependency installation, specification and source validation, tests, TypeScript checking, a production build, and desktop/mobile Chromium workflows with read-only repository permissions. Dependabot maintains npm and workflow dependencies. Branch protection should require the `validate` and `e2e` jobs before merge.

## ADR-009 — Browse permission is not shipment-party permission

Treat open and saved-partner load visibility as authenticated read-only discovery. Internal notes, proof files, and execution transitions require an actual shipment party: Business owner, assigned provider organization/profile, or administrator. Saved-partner visibility requires an explicit active relationship to the shipment owner. Application and payment-proof approvals/rejections are terminal in the MVP.

## ADR-010 — Browser fixtures are isolated from development data

Run Playwright against a reset, dedicated SQLite database, port, and `.next-e2e` artifact directory rather than reusing the local development server's standard `.next` output. The parent E2E runner restores Next's generated TypeScript metadata after Playwright exits. Local fixture credentials remain in setup documentation and test code, while public authentication pages render empty credential fields. This keeps test convenience from changing public UI, developer business records, tracked type metadata, or live generated modules.

## ADR-011 — Driver home and temporary load proof

Self-managed drivers land on their truck capacity control panel. Fleet Transporters land on a company management dashboard and update truck capacity inside My Fleet, where every update remains attached to one real vehicle. The Capacity Board is read only for providers. Freight loads use the same FTL/PTL language as capacity. Load-size proof is separate from operational shipment proof and is granted to one recorded interest at a time, reauthorized on every read, and expires after a configured temporary window (48 hours by default).

Tracking is a load-level Business choice: Status timeline or Approximate location + status. Once assigned, providers must satisfy that choice on updates and cannot reduce it. Shipper or receiver Businesses may reduce it to Status timeline. Exact browser geolocation is snapped to a half-degree grid before submission and only a 40 km privacy area is retained.

## ADR-012 — Visual trucks and staged contact disclosure

Use one image-backed cargo-configuration catalog across freight creation, driver Home, Fleet, and Capacity instead of tonnage labels. A Business may expose one designated load phone to authenticated transporters only through an explicit opt in. Receiver first name and phone are shipment-party data entered after commercial agreement; Freight assignment is blocked until both are present.

## ADR-013 — Discovery, Tracking, and authenticated directory

Keep one canonical load record while separating its UI by permission and stage. The Load Board is read-only discovery plus interest; Tracking lists only shipper, receiver, assigned or directly addressed provider parties, with administrators retaining operational oversight. A discoverable posted load never appears in an unrelated provider's Tracking workspace.

Use one authenticated directory for Businesses, fleet transporters, and self-managed drivers. Business profiles support participant confirmation and completed-load reputation. Private account email and phone are never public-profile fallbacks; only explicitly maintained profile contacts are displayed.

## ADR-014 — Evidence-derived entity verification

Store verification as immutable-subject requests reviewed by administrators rather than mutable decorative booleans. A request identifies its subject type and ID, verification category, private file, submitter, state, reviewer, notes, and timestamps. Public badges are projections of approved requests. The initial categories cover identity, Business license, driver identity, vehicle ownership, and owner authorization; later document-name detail extends the catalog without changing historical records.

## ADR-015 — Declared-region coverage and explainable route matching

Store Business operating regions as member-entered city or regional names and store Public Profile coverage as explicit origin/destination route pairs. Render approximate routes only when both places exist in the reviewed Ethiopia place reference catalog; retain unknown member-entered places in lists and comparisons without inventing coordinates. Map lines and city markers indicate regional route relationships, not exact facilities, drive paths, live movement, distance, or serviceability.

For Businesses, route evidence counts canonical loads posted on a matching endpoint pair and the subset that reached tracked execution. For fleet transporters and self-managed drivers, it counts matching capacity reports and the subset of assigned shipments that reached tracked execution. Evidence is labeled Tracked activity, Reported activity, or Declared only; it is not a trust score or guarantee.

Load Board and Capacity Board matching uses normalized recorded endpoint names. Results receive only three explainable strengths: both route cities align, one city aligns, or no recorded match. Matching affects filtering and order but never visibility, assignment, pricing, or authorization.

The public homepage centers Ethiopian makers, growers, processors, producers, and the small transport providers that connect them to markets. This reflects documented manufacturing and logistics priorities without claiming public-sector sponsorship.

## ADR-016 — Fleet-driver capability policy

A `DRIVER` may be either self-managed through a provider profile or employed through one transporter organization. Self-managed drivers retain full provider authority. Company drivers receive owner-controlled Load Board, Business contact, negotiation, and rich capacity permissions, with every command enforced in repository services and attributed to the acting driver.

Company drivers operate only assigned organization vehicles. Duty On and Off is a narrow command that remains available even when rich capacity control is disabled: Off Duty hides the truck, while On Duty restores the most recent owner-configured Empty or Partial signal. If no prior active configuration exists, an owner must configure the truck first. Fleet owners retain organization-wide visibility and authority.
