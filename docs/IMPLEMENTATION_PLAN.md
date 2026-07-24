# Loadgistic — MVP Implementation Plan
## Local-First, Supabase-Ready, Browserbase-Ready

This plan translates the canonical Loadgistic product specification into an executable engineering program.

The target is a real local application that can later move to Supabase Cloud and production infrastructure without a rewrite.

---

# 1. Delivery Strategy

Use vertical slices rather than building every database table first and every screen later.

Each slice must include:

- schema and migration;
- Row-Level Security;
- domain service;
- server route or action;
- UI;
- validation;
- audit event;
- automated test;
- documentation update.

Order work so the application remains runnable after every phase.

---

# 2. Architecture Decisions

## 2.1 Monorepo

Use `pnpm` workspaces.

```text
loadgistic/
├── apps/
│   └── web/
├── packages/
│   ├── auth/
│   ├── billing/
│   ├── capacity/
│   ├── company-pages/
│   ├── config/
│   ├── database/
│   ├── domain/
│   ├── freight/
│   ├── notifications/
│   ├── organizations/
│   ├── parcel/
│   ├── permissions/
│   ├── proof/
│   ├── shipments/
│   ├── test-fixtures/
│   ├── tracking/
│   ├── ui/
│   └── validation/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── functions/
├── tests/
│   ├── e2e/
│   ├── integration/
│   ├── rls/
│   └── fixtures/
├── docs/
├── AGENTS.md
├── README.md
├── pnpm-workspace.yaml
└── turbo.json
```

A simpler single-app repository is acceptable only if domain modules remain separated and the path structure preserves migration to packages.

## 2.2 Web application

Use:

- Next.js App Router;
- React Server Components where useful;
- server actions for simple authenticated mutations;
- route handlers for integrations, downloads, and public token flows;
- Tailwind CSS;
- accessible headless components;
- React Hook Form;
- Zod;
- strict TypeScript.

## 2.3 Supabase

Use Supabase locally from the beginning:

- Auth;
- PostgreSQL;
- Storage;
- RLS;
- Realtime only where it adds real value.

Do not create a second SQLite schema.

## 2.4 Browser automation

Use Playwright locally.

Create a Browserbase adapter with environment-driven configuration:

```text
BROWSERBASE_API_KEY
BROWSERBASE_PROJECT_ID
BROWSERBASE_REGION
```

The application must not require these values to run.

## 2.5 Logging and observability

Create a logger interface with:

- local pretty logging;
- JSON production mode;
- request ID;
- user ID when safe;
- organization ID when safe;
- action name;
- error code;
- duration.

Prepare adapters for future Sentry or OpenTelemetry.

---

# 3. Environment Variables

Create a validated environment module.

Minimum `.env.example`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DATABASE_URL=
DIRECT_URL=

EMAIL_PROVIDER=console
EMAIL_FROM=no-reply@loadgistic.local

BROWSERBASE_ENABLED=false
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
BROWSERBASE_REGION=us-west-2

CAPACITY_FRESH_HOURS=12
CAPACITY_EXPIRES_HOURS=24

FILE_MAX_MB=10
LOG_LEVEL=debug
```

Fail fast when required variables are missing.

Never expose service-role credentials to the browser.

---

# 4. Initial Domain Boundaries

## Identity

- profile;
- session;
- user preferences;
- locale.

## Organization

- organization;
- capability;
- membership;
- role;
- business application;
- verification.

## Company Page

- public profile;
- visibility;
- services;
- locations;
- routes;
- corridors;
- public contact data.

## Shipment

- canonical shipment;
- parties;
- commercial state;
- operational state;
- distribution;
- price mode;
- timeline.

## Parcel

- request inbox;
- code lookup;
- routes and centers;
- parcel status rules.

## Freight

- loads;
- provider interest;
- provider acceptance;
- vehicles;
- drivers.

## Capacity

- Empty, Partial, Full;
- percentage;
- route or corridor;
- freshness;
- visibility;
- photo.

## Tracking and Proof

- token;
- status timeline;
- location;
- proof file.

## Billing

- plans;
- entitlements;
- subscription;
- payment proof.

## Platform Operations

- staff;
- support;
- audit;
- reference data.

---

# 5. Database Implementation Order

## Migration 001 — Identity and organizations

Create:

- `profiles`
- `organizations`
- `organization_capabilities`
- `organization_members`
- `business_applications`
- `audit_logs`

Add:

- timestamps;
- soft-suspension fields;
- tenant-safe indexes;
- membership uniqueness;
- initial RLS.

## Migration 002 — Independent providers and verification

Create:

- `independent_provider_profiles`
- `verification_cases`
- `verification_documents`
- `verification_events`

## Migration 003 — Company pages and discovery

Create:

- `company_pages`
- `company_page_sections`
- `company_locations`
- `parcel_routes`
- `service_areas`
- `partner_relationships`

## Migration 004 — Vehicles and drivers

Create:

- `vehicles`
- `vehicle_documents`
- `drivers`
- `driver_documents`
- `driver_vehicle_assignments`

Enforce one active vehicle for an independent provider.

## Migration 005 — Canonical shipments

Create:

- `shipments`
- `shipment_parties`
- `shipment_assignments`
- `shipment_status_events`
- `shipment_notes`
- `shipment_files`
- `shipment_contacts`
- `shipment_interests`

Use enums or check constraints for:

```text
service_mode
distribution_mode
price_mode
commercial_status
operational_status
tracking_mode
```

Store price in minor ETB units.

## Migration 006 — Capacity

Create:

- `capacity_updates`
- `capacity_photos`

Constraints:

- Empty => 100;
- Partial => 1–99;
- Full => 0;
- one current non-expired capacity record per vehicle;
- expiry after configurable duration.

## Migration 007 — Tracking and proof

Create:

- `tracking_tokens`
- `location_events`
- `proof_files`

## Migration 008 — Plans and billing

Create:

- `plans`
- `plan_features`
- `plan_prices`
- `subscriptions`
- `subscription_entitlement_snapshots`
- `payment_proofs`
- `manual_payments`

## Migration 009 — Notifications and support

Create:

- `notifications`
- `notification_attempts`
- `support_cases`
- `staff_access_sessions`

---

# 6. Row-Level Security Plan

Write SQL tests for every policy.

## Profiles

Users read and update their own profile.

Staff access requires explicit staff permission.

## Organizations

Members read organizations they belong to.

Public queries use a safe database view or RPC containing approved public fields only.

## Shipments

A shipment is readable by:

- creating demand organization;
- receiver organization when linked;
- responsible provider;
- explicitly invited party;
- authorized staff.

A shipment is mutable only according to role and state.

## Capacity

Public discovery reads:

- active;
- non-expired;
- visibility-permitted;
- verified provider records.

Private capacity is visible only to the provider.

## Company pages

Public pages expose only approved sections.

Private contacts, documents, and internal notes are never selected by public queries.

## Files

Storage policies scope files by organization, shipment, verification case, and actor permission.

---

# 7. Application Route Plan

## Public

```text
/
 /for-shippers
 /for-parcel-companies
 /for-transporters
 /companies
 /companies/[handle]
 /plans
 /how-it-works
 /apply
 /login
 /privacy
 /terms
```

## Authenticated application

```text
/app/home
/app/shipments
/app/shipments/new
/app/shipments/[shipmentId]
/app/providers
/app/providers/[handle]
/app/loads
/app/capacity
/app/routes-centers
/app/vehicles
/app/drivers
/app/company-page
/app/messages
/app/more
```

## Administration

```text
/admin
/admin/applications
/admin/verification
/admin/organizations
/admin/plans
/admin/billing
/admin/support
/admin/audit
/admin/reference-data
```

Create middleware for authentication only.

Do not rely on middleware for full authorization; authorize inside server services.

---

# 8. UI System

## 8.1 Design tokens

Create tokens for:

- Loadgistic blue;
- neutral surfaces;
- success green;
- parcel purple;
- warning orange;
- destructive red;
- typography;
- spacing;
- border radius;
- focus rings;
- shadows.

## 8.2 Core components

Build:

- AppShell
- DesktopSidebar
- MobileBottomNav
- PageHeader
- EmptyState
- StatusChip
- CompanyCard
- ProviderCard
- LoadCard
- CapacityCard
- ShipmentTimeline
- NextActionPanel
- CodeLookup
- FileUpload
- ConfirmationDialog
- PermissionDenied
- StaleDataNotice
- OfflineNotice
- ErrorBoundary
- Skeleton states

## 8.3 Simplicity rules

- maximum four summary items on Home;
- no chart unless it answers a real operational question;
- one primary CTA per section;
- mobile actions remain reachable with one hand;
- only the next valid workflow action is emphasized;
- secondary settings go under More;
- tables become cards on mobile.

## 8.4 Accessibility

- keyboard navigation;
- visible focus;
- semantic headings;
- labels for every field;
- minimum contrast;
- error summaries;
- touch targets at least 44px;
- reduced-motion support.

---

# 9. Phase-by-Phase Build Plan

# Phase 0 — Repository and quality foundation

## Deliverables

- pnpm workspace;
- Next.js app;
- strict TypeScript;
- Tailwind;
- linting;
- formatting;
- Vitest;
- Playwright;
- Supabase local configuration;
- environment validation;
- base UI tokens;
- CI workflow;
- README;
- AGENTS.md;
- docs skeleton.

## Acceptance

```bash
pnpm install
supabase start
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
```

all work from a clean clone.

---

# Phase 1 — Authentication, applications, and workspaces

## Deliverables

- signup;
- login;
- logout;
- password reset;
- profile;
- business application;
- independent provider application;
- organization activation;
- membership;
- workspace switcher;
- role-aware navigation;
- suspension handling;
- admin application review.

## Key UI

- Apply page
- Login page
- Pending review page
- More / Account
- Admin Applications

## Tests

- applicant cannot access active workspace;
- approved owner can access;
- independent provider remains restricted until verified;
- suspended account is blocked;
- memberships are tenant-isolated.

---

# Phase 2 — Company pages and provider discovery

## Deliverables

- company-page editor;
- public company-page renderer;
- company handle;
- verified badge;
- public/private field control;
- provider directory;
- filters by provider type;
- saved providers;
- parcel center visibility;
- freight corridor visibility;
- capacity summary placeholder wired to real capacity records.

## Company page variants

### Demand business

- company name;
- industry;
- main locations;
- about;
- public loads when enabled.

### Parcel company

- service areas;
- centers;
- routes;
- pickup and delivery options.

### Transport company

- vehicle categories;
- corridors;
- current capacity.

### Independent provider

- verified identity and license;
- active vehicle;
- corridors;
- current capacity.

## Tests

- private fields are never public;
- provider filters work;
- public handle is unique;
- unapproved page is hidden;
- shipper page visibility is restricted correctly.

---

# Phase 3 — Canonical shipment and demand workflow

## Deliverables

- New Shipment wizard;
- Parcel or Road Freight selection;
- sender and receiver;
- origin and destination;
- cargo/package details;
- direct, saved-partner, or open visibility;
- fixed ETB, target ETB, or Quote Requested;
- shipment detail page;
- commercial timeline;
- saved draft;
- idempotent submission;
- notification to directed provider.

## New Shipment steps

1. Service
2. Parties
3. Route
4. Cargo
5. Provider visibility
6. Pricing
7. Review and submit

Keep each step short.

## Tests

- ETB stored correctly;
- quote request contains no amount;
- target price works;
- direct provider sees request;
- open load appears only to eligible providers;
- duplicate submit does not duplicate shipment.

---

# Phase 4 — Parcel delivery workflow

## Deliverables

- Parcel Requests page;
- manual shipment-code lookup;
- request details;
- contact action;
- internal note;
- assignment;
- valid status transitions;
- Routes & Centers editor;
- parcel company public route display;
- status notifications;
- optional status-only tracking.

## Status service

Centralize allowed transitions.

Example:

```text
NEW -> CONTACTED
CONTACTED -> COLLECTED
COLLECTED -> IN_ROUTE
IN_ROUTE -> READY_FOR_PICKUP
IN_ROUTE -> OUT_FOR_DELIVERY
READY_FOR_PICKUP -> COMPLETED
OUT_FOR_DELIVERY -> COMPLETED
```

Exception transitions require reason.

## Tests

- manual code lookup works;
- invalid code is safe;
- scanning is not required;
- Collected records actor and timestamp;
- Ready for Pickup differs from Out for Delivery;
- only valid actions show.

---

# Phase 5 — Freight loads and provider interest

## Deliverables

- Find Loads page;
- Direct, My Partners, Open Loads;
- filters;
- LoadCard;
- Express Interest;
- Contact Business;
- direct acceptance;
- responsible-provider assignment;
- freight shipment status flow;
- provider notifications.

## Load card

Show only:

- business;
- route;
- pickup date;
- cargo;
- weight when known;
- vehicle;
- Full Load or Shared Capacity;
- price or Quote Requested;
- posted freshness.

## Tests

- visibility rules;
- provider eligibility;
- one responsible provider;
- direct acceptance idempotency;
- open load cannot expose private business data;
- no auction behavior.

---

# Phase 6 — Capacity

## Deliverables

- provider Capacity page;
- Empty, Partial, Full;
- percentage for Partial;
- vehicle and route;
- visibility;
- optional photo;
- freshness;
- expiry job;
- Capacity Search for demand users;
- company-page capacity summary.

## User flow

1. Select vehicle.
2. Choose Empty, Partial, or Full.
3. Enter percentage only for Partial.
4. Add current or planned route.
5. Choose visibility.
6. Optionally add photo.
7. Publish.

## Validation

```text
EMPTY => 100
PARTIAL => 1..99
FULL => 0
```

## Background work

Create an hourly job abstraction to expire stale records.

Locally, provide a CLI command and test helper.

## Tests

- validation;
- expiry;
- freshness label;
- public visibility;
- photo permissions;
- no fake “verified capacity” claim.

---

# Phase 7 — Tracking and proof

## Deliverables

- tracking mode selector;
- status-only public tracking;
- location-and-proof mode;
- opaque token;
- manual location update;
- active-browser geolocation;
- freshness;
- loading proof;
- delivery proof;
- issue proof;
- signed file access;
- shipment completion.

## Tests

- no tracking page when disabled;
- token cannot enumerate other shipments;
- stale location label;
- proof access;
- completion idempotency;
- file validation.

---

# Phase 8 — Plans, billing, and administration

## Deliverables

- plan catalog;
- feature entitlements;
- per-plan limits;
- subscription assignment;
- manual payment proof;
- billing review;
- activation and extension;
- plan comparison pages;
- admin organizations;
- support cases;
- audit viewer;
- reference data.

## Tests

- server-side entitlement checks;
- suspended subscription behavior;
- payment approval audit;
- historical snapshot preserved;
- public pricing comes from plan data.

---

# Phase 9 — PWA, weak connectivity, and release hardening

## Deliverables

- PWA manifest;
- icons;
- install prompt;
- offline shell;
- draft preservation;
- retry-safe file uploads;
- responsive review;
- accessibility review;
- security headers;
- rate limits;
- structured logs;
- error monitoring adapter;
- backup documentation;
- deployment guide;
- final seed;
- demo script.

## Browserbase

Add:

```bash
pnpm test:e2e
pnpm test:e2e:browserbase
```

The second command skips with a clear message when credentials are absent.

---

# 10. Domain Services

Create explicit services such as:

```text
createBusinessApplication
approveBusinessApplication
updateCompanyPage
publishCompanyPage
createShipment
submitShipment
expressShipmentInterest
acceptDirectedShipment
transitionParcelShipment
transitionFreightShipment
publishCapacity
expireCapacity
createTrackingToken
recordLocationEvent
uploadShipmentProof
completeShipment
reviewPaymentProof
```

Each service:

- accepts a typed command;
- validates with Zod;
- authorizes;
- opens a transaction when required;
- writes domain data;
- writes an audit event;
- returns a stable result;
- maps internal errors to stable error codes.

---

# 11. API and Server Action Conventions

Use server actions for authenticated form mutations when appropriate.

Use route handlers for:

- public tracking token;
- file download;
- Browserbase test hooks in test environments;
- health checks;
- future webhooks.

Response envelope:

```json
{
  "ok": true,
  "data": {},
  "requestId": "..."
}
```

Error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "CAPACITY_PERCENT_REQUIRED",
    "message": "Enter the available percentage for partial capacity."
  },
  "requestId": "..."
}
```

Do not expose stack traces to users.

---

# 12. Seed and Demo Plan

Create demo users:

```text
admin@loadgistic.local
shipper@loadgistic.local
receiver@loadgistic.local
parcel@loadgistic.local
transporter@loadgistic.local
driver@loadgistic.local
```

Use one documented local-only password.

Seed examples:

- Blue Nile Trading PLC
- Fresh Foods Distribution PLC
- Addis Parcel Services
- BlueLine Transport PLC
- Abebe Owner-Operator

Seed:

- Addis Ababa and Hawassa parcel centers;
- Addis → Hawassa parcel route;
- Empty capacity;
- Partial 40 percent capacity;
- Full capacity;
- fixed-price ETB load;
- target-price ETB load;
- Quote Requested load;
- parcel request;
- active parcel shipment;
- completed freight shipment;
- proof images using safe local fixture files.

---

# 13. Test Matrix

## Unit

- validation;
- state transition maps;
- price formatting;
- capacity calculation;
- freshness;
- permission predicates.

## Integration

- service + database transaction;
- audit logging;
- notification creation;
- file metadata;
- subscription entitlement.

## RLS

- all tenant boundaries;
- public views;
- staff access;
- tracking token access;
- storage access.

## E2E

### Demand workflow

1. Login as shipper.
2. Create Quote Requested freight load.
3. Confirm it appears in Open Loads.

### Freight provider workflow

1. Login as transporter.
2. Find the load.
3. Express interest.
4. Update Partial capacity to 40 percent.

### Parcel workflow

1. Login as parcel company.
2. Look up shipment code.
3. Mark Contacted.
4. Mark Collected.
5. Mark In Route.
6. Mark Ready for Pickup.
7. Complete.

### Company page workflow

1. Edit provider page.
2. Publish.
3. View as external user.
4. Confirm private data is absent.

### Admin workflow

1. Approve business application.
2. Approve payment proof.
3. Verify audit events.

---

# 14. Security Review Checklist

Before release:

- [ ] RLS enabled on every tenant table
- [ ] no service-role key in client bundle
- [ ] public views reviewed
- [ ] signed file URLs
- [ ] upload validation
- [ ] server-side entitlements
- [ ] rate limits
- [ ] idempotency
- [ ] safe redirect validation
- [ ] CSP
- [ ] secure cookies
- [ ] no sensitive data in logs
- [ ] audit coverage
- [ ] dependency audit
- [ ] broken-access-control E2E tests
- [ ] tracking-token entropy review
- [ ] capacity-expiry job tested

---

# 15. Performance Targets

For seeded local data:

- Home interactive in under 2 seconds on a normal development machine after warm start.
- Main list queries return in under 300 ms locally.
- Public company page uses server rendering and cached public data.
- Pagination for all lists.
- No initial load of all tenant data.
- Images use responsive sizing.
- Avoid unnecessary Realtime subscriptions.
- Mobile Lighthouse accessibility target at least 90 where practical.

---

# 16. Documentation Deliverables

Maintain:

```text
README.md
AGENTS.md
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/DOMAIN_MODEL.md
docs/DATA_MODEL.md
docs/STATE_MACHINES.md
docs/PERMISSIONS.md
docs/SECURITY.md
docs/LOCAL_SETUP.md
docs/TESTING.md
docs/BROWSERBASE.md
docs/DEPLOYMENT.md
docs/DECISIONS.md
docs/PROGRESS.md
```

Every completed phase updates `PROGRESS.md`.

Every architectural change updates `DECISIONS.md`.

---

# 17. Local Acceptance Procedure

A reviewer must be able to:

```bash
git clone <repo>
cd loadgistic
pnpm install
supabase start
pnpm db:reset
pnpm dev
```

Then:

1. open the app;
2. log in with every demo role;
3. view role-specific navigation;
4. create a shipment;
5. view providers;
6. update a parcel status using shipment code;
7. find a freight load;
8. publish capacity;
9. view a company page;
10. approve an application in Admin;
11. run tests.

Commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:rls
pnpm test:e2e
pnpm build
```

All must pass before final handoff.

---

# 18. Production Readiness Without Premature Complexity

The MVP is not required to be fully production-deployed, but it must be structurally ready.

Required readiness:

- cloud-compatible Supabase schema;
- environment separation;
- migrations;
- no hardcoded secrets;
- audited admin actions;
- RLS;
- plan entitlements;
- structured logs;
- test coverage;
- health endpoint;
- deployment documentation;
- Browserbase-ready smoke tests;
- agent-readable documentation;
- deterministic seed data.

Do not add infrastructure that does not support the core workflow.

---

# 19. Final Handoff Package

The implementation handoff must contain:

- complete source code;
- database migrations;
- seed data;
- `.env.example`;
- working local setup;
- demo accounts;
- test suite;
- documentation;
- known limitations;
- launch checklist;
- screenshots;
- optional zip archive.

No unfinished page may pretend to work.

Use disabled controls with an honest label only when an explicitly documented later feature is visible.

---

# 20. MVP Success Standard

The MVP succeeds when a real user can complete this loop:

```text
Enterprise business creates B2B shipment demand
→ provider discovers or receives it
→ both sides contact and agree
→ provider accepts responsibility
→ shipment moves through a simple workflow
→ tracking or proof is recorded when enabled
→ shipment is completed
```

It must also complete the supply-visibility loop:

```text
Provider creates a company page
→ publishes routes, centers, corridors, or capacity
→ enterprise business discovers the provider
→ business sends a request
```

That is the product. Everything else is secondary.
