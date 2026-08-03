# Implementation Audit

## Real and wired

- Next.js App Router UI, route handlers, role-aware navigation, and PWA shell.
- Local SQLite repository with tenant/party authorization, state transitions,
  pagination, deterministic reset, high-volume stress data, and additive
  tracking scenarios.
- Shipment Board, Truck Board, Shared Shipments, Directory, Network, Fleet,
  My Shipments, secret-code customer tracking, billing review, verification,
  rating moderation, administration, and native Support.
- Driver-only obscured device location for truck capacity and automatic
  shipment tracking. Fleet-owner capacity edits preserve the Driver location
  timestamp; no current-location text fallback is rendered.
- Private local or Supabase Storage adapter with server-authorized reads and
  file signature/type/size validation.
- Production build, desktop/mobile Playwright workflows, UI audit, source/spec
  checks, GitHub CI, and a non-root standalone Docker definition.

## Intentional fixture data

Records created by `npm run db:reset`, `npm run db:stress`, and
`npm run db:fixtures:tracking` are deterministic development fixtures, not
customer claims. The public homepage uses a strict anonymous projection over
the current database and withholds identity, contact, exact coordinates,
files, raw IDs, and free text.

## Partially wired adapters

- Supabase Storage is implemented for private files when configured.
- PostgreSQL schema, RLS, indexes, PostGIS matching, support, billing, and
  capacity constraints are modeled in migrations `001`–`010`.
- `DATA_BACKEND=supabase` is deliberately rejected as a production claim: the
  repository and managed identity adapters do not exist yet.
- Rate limits are process-local. They are correct for one process but not a
  horizontally scaled deployment.
- Browser geolocation is device-reported and privacy-obscured, not
  hardware-attested. A modified client can falsify its own coordinates, so
  freshness, verification, route evidence, and proof remain distinct signals.

## Backend-only and compatibility surfaces

- User-facing forms and commands have route handlers; the source scan found no
  `href="#"`, placeholder form actions, empty click handlers, TODO command
  stubs, or UI-only fake success paths. The desktop/mobile browser audit found
  no console or page errors.
- `listLoads` and `listCapacity` are unpaginated compatibility/test helpers.
  Production Board pages use their bounded server-paginated counterparts.
- `listProviders`, `listOrganizationsByType`, `getApplicationStatus`, and the
  older `setReceiverContact` command remain fixture/test or compatibility
  helpers. Current UI uses searchable Directory projections, immediate signup,
  and the full shipment-party command.
- `listAudit` is an administrator-authorized backend diagnostic with no product
  UI. Do not expose raw audit details without a bounded, redacted admin spec;
  entity management already exposes task-specific audited commands.

## Hard-coded by design

- Roles, workflow states, error codes, supported cargo configurations, privacy
  radii, plan durations, and fixture IDs are product/domain constants.
- Built-in major Ethiopian cities are an offline fallback. Normal place search
  uses the imported, bounded OpenStreetMap-derived catalog and stored
  coordinates.
- Demo credentials exist only in local setup documentation and automated test
  fixtures. Public login fields remain empty.

## Public-production blockers

- Supabase/PostgreSQL repository parity and Supabase Auth.
- Shared rate limiting, malware scanning/quarantine, monitoring, backups, and a
  completed restore drill.
- Production secrets, private buckets, callback URLs, and final security smoke
  tests in `docs/CLOUD_HANDOFF.md`.
- Complete Amharic and Afaan Oromo product translation.

`npm run launch:check` remains red in Production until the technical blockers
are real. A passing build, Docker health check, or configured service-role key
must not be presented as public-production readiness.
