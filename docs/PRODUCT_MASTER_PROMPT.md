# Loadgistic — Canonical Master Product & Build Prompt
## B2B Logistics Connection Platform — Local-First MVP

You are the lead product architect, UX designer, security engineer, and senior full-stack engineer responsible for building **Loadgistic**.

Build a real, working, local-first MVP—not a static prototype and not a collection of disconnected mock screens. The application must run locally with seeded data, working authentication, database persistence, role-based permissions, routing, forms, status transitions, company pages, provider discovery, load discovery, capacity visibility, and an administrator workspace.

The product must be technically prepared for Supabase Cloud, Browserbase-assisted browser automation, and other AI-agent-friendly production tooling, even if the first delivery is not deployed publicly.

---

# 1. Canonical Product Positioning

Use this positioning consistently:

> **Loadgistic connects enterprise shippers and receivers with parcel delivery companies, freight transporters, and independent truckers or owner-operators for B2B shipping.**

Loadgistic is a two-sided B2B logistics platform.

## Demand side

- Enterprise Shippers
- Enterprise Receivers

They create shipment demand, discover logistics providers, contact providers, agree commercially, and follow shipment progress.

## Supply side

- Parcel Delivery Companies
- Transport Companies
- Independent Truckers
- Independent Drivers and Owner-Operators

They make their services, routes, centers, corridors, vehicles, and current capacity visible; receive direct requests; discover posted loads; and operate agreed shipments.

The platform supports many forms of domestic B2B logistics without forcing every provider into one operational workflow.

```text
Enterprise Shippers and Receivers
                ↕
            Loadgistic
                ↕
Parcel Companies · Transporters · Independent Providers
```

---

# 2. Product Principles

## 2.1 Keep it simple

This product is designed for the Ethiopian market and must not resemble a dense transport ERP.

Use:

- large touch targets;
- clear language;
- short forms;
- few primary navigation items;
- progressive disclosure;
- strong mobile responsiveness;
- simple status labels;
- minimal charts;
- helpful empty states;
- visible next actions.

Avoid:

- large collections of KPI cubes;
- invented analytics;
- advanced fleet optimization;
- accounting-style complexity;
- hidden workflows;
- excessive logistics jargon;
- forced scanning;
- forced tracking;
- forced in-app quotations;
- forced advanced route configuration.

## 2.2 Mobile-first web application

The application must:

- work as a responsive web application;
- feel like a mobile app in phone browsers;
- be installable as a PWA;
- work well on desktop;
- preserve drafts where practical;
- clearly show loading, offline, stale, error, and success states;
- use bottom navigation on mobile;
- use a simple sidebar or top navigation on desktop.

## 2.3 Only show data Loadgistic can honestly collect

Do not display:

- fictional success rates;
- made-up total deliveries;
- fake customer satisfaction;
- unverified on-time percentages;
- invented fleet sizes;
- invented service coverage;
- unsupported “real-time” claims.

A metric may be shown only when it is derived from actual application records or verified company data.

## 2.4 Progressive operations

Providers may use only the capabilities they need.

Examples:

- a parcel company may only receive requests and contact the requester;
- a parcel company may optionally update simple statuses;
- a transporter may only publish capacity and respond to loads;
- tracking and proof may be enabled per shipment;
- scanning is optional;
- shipment codes can always be entered manually.

---

# 3. MVP Scope

The MVP must include:

1. Direct user authentication
2. Business applications and verification
3. Organizations and memberships
4. Role-aware workspaces
5. Universal company pages
6. Company directory and provider discovery
7. Enterprise shipper and receiver profiles
8. Parcel delivery company profiles
9. Transport company profiles
10. Independent provider profiles
11. B2B shipment creation
12. Directed requests
13. Open and network-visible loads
14. Simple parcel workflows
15. Simple freight workflows
16. Parcel routes and centers
17. Freight capacity visibility
18. Manual shipment-code lookup
19. Optional tracking
20. Loading or delivery proof
21. Notifications
22. Saved partners
23. Configurable subscription entitlements
24. Manual subscription activation and payment proof
25. Platform administration
26. Seed data and demo accounts
27. Automated testing
28. Local development documentation

---

# 4. Launch Exclusions

Do not include in the first MVP:

- SuqPage or MirtPage integration;
- third-party ERP integrations;
- public logistics APIs;
- external webhooks;
- delegated sessions;
- online freight auctions;
- automated bidding;
- automated carrier awards;
- escrow;
- provider settlement;
- route optimization;
- warehouse-management features;
- accounting or payroll;
- native mobile applications;
- physical GPS device integration;
- browser tracking promises after a browser is closed;
- public exact driver location;
- complex multi-company route graphs;
- mandatory QR scanning;
- mandatory public tracking;
- advanced AI dispatching.

Prepare clean extension points for future work, but do not build these features now.

---

# 5. Account and Organization Model

## 5.1 Organization capabilities

An organization may have one or more capabilities:

```text
ENTERPRISE_SHIPPER
ENTERPRISE_RECEIVER
PARCEL_OPERATOR
TRANSPORT_COMPANY
```

An independent provider uses an individual provider profile rather than a multi-user company account.

A company can be both a shipper and receiver.

A multi-service logistics company may eventually have multiple capabilities, but the MVP interface must show one active workspace at a time.

## 5.2 User types

- Platform Administrator
- Verification Staff
- Billing Staff
- Support Staff
- Organization Owner
- Organization Team Member
- Independent Provider / Owner-Operator
- Transport Company Driver
- Read-Only Viewer

Parcel company workers remain Team Members. Do not require a special Driver role for parcel operations.

## 5.3 Signup rules

### Self-service account creation

Allow:

- organization applicant;
- independent driver or owner-operator.

### Business activation

Enterprise Shippers, Enterprise Receivers, Parcel Delivery Companies, and Transport Companies submit a business application.

The application does not instantly grant a fully active workspace.

Flow:

```text
Create account
→ Submit business application
→ Staff review
→ Approve or request more information
→ Activate workspace
→ Owner completes setup
```

### Independent provider activation

Independent providers may create an account, but public discovery, capacity publishing, and load access require:

- identity verification;
- commercial driving-license verification;
- vehicle-document review.

---

# 6. Workspace Navigation

Put billing, support, language, verification, and settings under **More** on mobile.

## 6.1 Enterprise Shipper or Receiver

Desktop:

```text
Home
New Shipment
Shipments
Find Providers
Capacity
Tracking
Company Page
Messages
More
```

Mobile:

```text
Home
Shipments
New
Providers
More
```

## 6.2 Parcel Delivery Company

Desktop:

```text
Home
Requests
Shipments
Routes & Centers
Business Customers
Company Page
Messages
More
```

Mobile:

```text
Home
Requests
Shipments
Centers
More
```

## 6.3 Transport Company

Desktop:

```text
Home
Loads
Capacity
Shipments
Vehicles
Drivers
Company Page
Messages
More
```

Mobile:

```text
Home
Loads
Capacity
Shipments
More
```

## 6.4 Independent Provider

Desktop:

```text
Home
Loads
Capacity
Shipments
Company Page
Messages
More
```

Mobile:

```text
Home
Loads
Capacity
Shipments
More
```

---

# 7. Core Shared Pages

## 7.1 Home

The Home page answers:

- What requires attention?
- What can I do now?
- What is moving?
- What is the next action?

Do not turn Home into an analytics dashboard.

### Enterprise Shipper or Receiver

Show:

- Create Shipment
- Find Providers
- Active Shipments
- Requests awaiting provider response
- Recent updates
- Saved partners

### Parcel Delivery Company

Show:

- New Requests
- Enter Shipment Code
- Collected
- In Route
- Ready for Pickup
- Out for Delivery
- Recent business customers

### Transporter or Independent Provider

Show:

- Available Loads
- Current Capacity
- Active Shipments
- Proof requiring upload
- Capacity freshness reminder

## 7.2 Shipments

Use one canonical `shipment` record from request through completion.

The UI may call it Request, Load, or Shipment depending on the stage, but the database record remains the same.

Shared Shipment page:

- shipment number;
- demand organization;
- receiver;
- responsible provider;
- origin;
- destination;
- cargo or package summary;
- price mode;
- agreed price when recorded;
- current commercial status;
- current operational status;
- timeline;
- contact actions;
- tracking when enabled;
- proof when required;
- audit-safe status history.

## 7.3 Messages

The MVP does not need a complex real-time chat system.

Provide:

- contact notes;
- message thread tied to a shipment or relationship;
- unread indicator;
- email notification fallback;
- clear links to call, email, or WhatsApp when entered by the company.

Never expose private personal contact information publicly.

## 7.4 Company Page

Every organization and independent provider receives a company page.

The page is public for supply-side providers and may be restricted to authenticated verified partners for demand-side businesses.

Shared sections:

```text
Overview
Services
Routes or Corridors
Availability
Contact
Company Details
```

Only show applicable sections.

---

# 8. Enterprise Shipper and Receiver Experience

## 8.1 New Shipment

Ask the user to choose:

```text
Parcel Delivery
Road Freight
```

Remove Internal Fleet from the MVP.

Required shared fields:

- shipment title;
- sender company;
- receiver company;
- sender contact;
- receiver contact;
- origin;
- destination;
- preferred pickup date;
- desired delivery date, optional;
- cargo or package description;
- package count;
- estimated weight, optional;
- photograph, optional;
- special instructions;
- service mode;
- provider-selection method;
- pricing mode.

Provider-selection methods:

```text
DIRECT_TO_PROVIDER
SAVED_PARTNERS
OPEN_MARKET
```

Pricing modes:

```text
FIXED_PRICE
QUOTE_REQUESTED
TARGET_PRICE
```

Currency is Ethiopian birr only.

Examples:

```text
ETB 35,000
Quote Requested
Target: ETB 35,000
```

Do not use USD in the core Ethiopian marketplace.

## 8.2 Find Providers

Tabs:

```text
Parcel Delivery
Transport Companies
Independent Providers
```

### Parcel company result

Show only:

- company name;
- verification;
- operating areas;
- pickup and drop-off centers;
- served routes;
- branch drop-off availability;
- receiver pickup availability;
- direct delivery availability;
- View Company;
- Send Request.

### Transport company result

Show only:

- company name;
- verification;
- main corridors;
- vehicle categories;
- current capacity summary;
- capacity freshness;
- View Company;
- Contact;
- Send Freight Request.

### Independent provider result

Show only:

- provider or business name;
- verification;
- vehicle type;
- corridors;
- current capacity;
- capacity freshness;
- View Page;
- Contact;
- Send Freight Request.

## 8.3 Demand-side company page

Show:

- company name;
- verified business status;
- industry;
- main locations;
- short company description;
- typical logistics needs, optional;
- public loads, only when opted in;
- contact action.

Do not publicly expose shipment history, sensitive volume, private contacts, or internal operational information.

---

# 9. Parcel Delivery Company Experience

## 9.1 Requests

A Parcel Delivery Company receives B2B shipment requests directed to it.

The page must support:

- search;
- filters;
- request list;
- request details;
- assignment to a Team Member;
- internal notes;
- requester contact;
- manual code lookup;
- converting or progressing the request;
- simple status updates.

Prominent lookup:

```text
Enter shipment code
No scanning required
[ code input ] [ Look Up ]
```

Scanning may be added later as an optional action.

## 9.2 Parcel workflow

Canonical flow:

```text
NEW
→ CONTACTED
→ COLLECTED
→ IN_ROUTE
→ READY_FOR_PICKUP
or
→ OUT_FOR_DELIVERY
→ COMPLETED
```

Exception states:

```text
ON_HOLD
ISSUE
CANCELLED
RETURNING
RETURNED
```

`COLLECTED` means:

- commercial terms were agreed;
- the package physically entered the provider’s custody.

Only show the next valid actions prominently.

## 9.3 Routes & Centers

This is the simple network-visibility page for parcel companies.

### Center fields

- center name;
- city or area;
- landmark or description;
- business phone;
- accepts drop-off;
- allows receiver pickup;
- supports transfer;
- offers direct delivery;
- business hours;
- active or inactive.

A center may support multiple functions.

### Route fields

- origin center;
- destination center;
- active status;
- service days, optional;
- estimated movement time, optional;
- branch drop-off available;
- receiver pickup available;
- direct delivery available;
- public visibility.

Example:

```text
Addis Ababa Center
→ Hawassa Center

Branch drop-off available
Receiver pickup available
Direct delivery optional
```

Do not expose internal batch or sorting complexity on the public page.

## 9.4 Parcel company page

Show:

- company name;
- verification;
- about;
- service areas;
- pickup and drop-off centers;
- served routes;
- branch drop-off;
- receiver pickup;
- direct delivery;
- contact;
- Send Business Shipment.

No invented service metrics.

---

# 10. Freight Provider Experience

## 10.1 Loads

Freight providers discover demand through:

```text
Direct
My Partners
Open Loads
```

Load card fields:

- enterprise shipper or receiver;
- origin;
- destination;
- pickup date;
- cargo description;
- estimated weight or size, if known;
- required vehicle category;
- Full Load or Shared Capacity;
- fixed price, target price, or Quote Requested;
- posted time;
- View Details.

Actions:

- Contact Business
- Express Interest
- Accept Direct Request, only when directed to that provider

Do not build auction bidding.

## 10.2 Capacity

Capacity applies to freight vehicles only.

Statuses:

```text
EMPTY
PARTIAL
FULL
```

Presentation:

```text
Empty
100% available
```

```text
Partial
40% available
```

```text
Full
Not currently available
```

Capacity record:

- provider;
- vehicle;
- vehicle category;
- capacity status;
- available percentage when Partial;
- current or planned origin;
- destination or corridor;
- expected travel date;
- next available time, optional;
- visibility;
- updated time;
- updated by;
- optional capacity photograph;
- expiry time.

Visibility options:

```text
PRIVATE
SAVED_PARTNERS
DIRECT_TO_SELECTED_BUSINESS
OPEN
```

Freshness:

- Fresh
- Update Needed
- Expired

Default public expiry: 24 hours or trip start, whichever comes first.

A fresh update proves only that the verified provider updated the record in Loadgistic at that time.

Use wording such as:

```text
Updated in Loadgistic by Abebe
Today at 9:40 AM
```

When a photograph exists:

```text
Capacity photo attached
```

Do not claim the app physically verified empty space unless a future verification process supports that claim.

## 10.3 Transport company page

Show:

- company name;
- verification;
- about;
- vehicle categories;
- corridors;
- current capacity;
- capacity freshness;
- contact;
- Send Freight Request.

## 10.4 Independent provider page

Show:

- provider or business name;
- verified identity;
- verified license;
- vehicle-document status;
- active vehicle;
- vehicle category;
- main corridors;
- current capacity;
- capacity freshness;
- contact;
- Send Freight Request.

## 10.5 Vehicles and Drivers

Transport Companies may maintain simple records for:

- vehicles;
- vehicle documents;
- drivers;
- driver license status;
- current vehicle assignment.

Do not build fleet optimization or payroll.

An Independent Provider has one active operating vehicle in the MVP.

---

# 11. Freight Workflow

Canonical freight flow:

```text
POSTED_OR_SENT
→ CONTACTED
→ AGREED
→ ASSIGNED
→ IN_TRANSIT
→ DELIVERED
→ COMPLETED
```

Exception states:

```text
DECLINED
WITHDRAWN
CANCELLED
ISSUE
ON_HOLD
```

Commercial discussion may happen outside Loadgistic.

Record only:

- agreed provider;
- optional agreed ETB amount;
- agreement note;
- assignment;
- movement status;
- proof;
- completion.

Do not require an in-app quotation workflow.

---

# 12. Tracking and Proof

Tracking is optional per shipment.

Tracking modes:

```text
NONE
STATUS_ONLY
LOCATION_AND_PROOF
```

## Status-only

Show customer-safe timeline events.

## Location and proof

Allow:

- manual location update;
- browser location update while the page is active;
- location freshness;
- loading proof;
- delivery proof;
- issue photograph.

Never promise dependable tracking after the browser closes.

Never show stale location as live.

Proof files:

- private by default;
- linked to one shipment;
- time-stamped;
- uploaded by a known account;
- shared only with authorized shipment parties and staff.

---

# 13. Discovery in Both Directions

## Demand discovers supply

Through:

- Find Providers
- Company Directory
- Company Pages
- Capacity Search

## Supply discovers demand

Through:

- Loads
- Direct Requests
- Saved Business Relationships
- Demand-side Company Pages

Saved relationships use simple names:

- Saved Providers
- Saved Businesses
- My Partners

Do not create a complicated Network product area for the MVP.

---

# 14. Plans and Billing

Plan catalog must be configurable.

Do not hard-code public prices.

Suggested plan families:

## Enterprise Shipper or Receiver

- Business Basic
- Business Pro

## Parcel Delivery Company

- Parcel Connect
- Parcel Flow

## Transport Company

- Transport Standard
- Transport Pro

## Independent Provider

- Solo Provider

Supported billing models:

```text
FLAT_MONTHLY
FLAT_ANNUAL
PER_TRANSACTION
CUSTOM_CONTRACT
```

Manual billing MVP:

1. account selects or is assigned a plan;
2. platform displays payment instructions;
3. user uploads payment proof;
4. Billing Staff review;
5. approval activates or extends the subscription;
6. all decisions are audited.

No online payment integration is required.

Plan entitlements and limits must be enforced server-side.

---

# 15. Public Marketing Site

Required pages:

- Home
- For Enterprise Shippers & Receivers
- For Parcel Delivery Companies
- For Transporters
- Company Directory
- Plans
- How It Works
- Apply
- Login
- Privacy
- Terms

Canonical homepage message:

> **B2B logistics that connects enterprise shippers and receivers with parcel delivery companies, freight transporters, and independent truckers.**

Do not use consumer-delivery framing.

---

# 16. Platform Administration

Platform Administrator must be able to:

- review business applications;
- review independent-provider verification;
- activate or suspend organizations;
- manage plans and entitlements;
- review payment proof;
- manage public company-page visibility;
- inspect audit logs;
- assist support cases;
- manage reference data;
- view system-health summaries.

Reference data includes:

- Ethiopian cities and areas;
- vehicle categories;
- cargo categories;
- service options;
- languages;
- capacity-expiry rules.

Every staff action must be audited.

---

# 17. Technology Architecture

Use a production-oriented TypeScript monorepo.

Recommended stack:

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- a small accessible component library
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- PostgreSQL Row-Level Security
- Zod
- React Hook Form
- Playwright
- Vitest
- pnpm
- ESLint
- Prettier
- structured logging
- PWA support

## 17.1 Local-first Supabase

Use Supabase local development through the Supabase CLI and Docker.

The local application must run against the same PostgreSQL schema, RLS policies, Auth model, and Storage conventions expected in Supabase Cloud.

Do not build a separate fake local data layer.

## 17.2 Browserbase readiness

Browserbase is not required for normal runtime.

Prepare an adapter for:

- hosted Playwright smoke tests;
- AI-agent browser testing;
- scheduled workflow checks;
- screenshot capture;
- authenticated test sessions.

Local Playwright remains the primary E2E runner.

Use stable `data-testid` attributes on important workflows.

## 17.3 AI-agent-friendly engineering

Create:

```text
/AGENTS.md
/docs/ARCHITECTURE.md
/docs/DOMAIN_MODEL.md
/docs/STATE_MACHINES.md
/docs/SECURITY.md
/docs/LOCAL_SETUP.md
/docs/TESTING.md
/docs/DECISIONS.md
/docs/PROGRESS.md
```

Engineering rules:

- domain logic lives in services, not React components;
- commands use Zod schemas;
- server actions and route handlers call domain services;
- database access is centralized;
- no hidden side effects;
- every state transition is explicit;
- seed data is deterministic;
- fixtures are reusable;
- logs are structured;
- errors have stable codes;
- important workflows have E2E tests;
- feature flags are documented;
- no dead navigation;
- no fake buttons;
- no hardcoded dashboards.

---

# 18. Suggested Repository Structure

```text
/apps
  /web

/packages
  /ui
  /domain
  /database
  /auth
  /permissions
  /organizations
  /company-pages
  /shipments
  /parcel
  /freight
  /capacity
  /tracking
  /proof
  /billing
  /notifications
  /validation
  /config
  /test-fixtures

/supabase
  /migrations
  /seed.sql
  /functions

/tests
  /e2e
  /integration
  /rls
  /fixtures

/docs
```

A single Next.js app is acceptable for the MVP, but domain modules must remain clearly separated.

---

# 19. Canonical Data Model

Create normalized tables for at least:

```text
profiles
organizations
organization_capabilities
organization_members
business_applications
independent_provider_profiles

company_pages
company_page_sections
company_locations
parcel_routes
service_areas
partner_relationships

vehicles
vehicle_documents
drivers
driver_documents
driver_vehicle_assignments

shipments
shipment_parties
shipment_assignments
shipment_status_events
shipment_notes
shipment_files
shipment_interests
shipment_contacts

capacity_updates
capacity_photos

tracking_tokens
location_events
proof_files

plans
plan_features
plan_prices
subscriptions
subscription_entitlement_snapshots
payment_proofs
manual_payments

notifications
notification_attempts
support_cases
audit_logs
staff_access_sessions
```

Every organization-owned record contains `organization_id`.

Use tenant-safe composite constraints.

Use partial unique indexes where appropriate.

Use immutable event records for shipment statuses, billing decisions, and verification decisions.

---

# 20. Security Requirements

## 20.1 Tenant isolation

- PostgreSQL RLS is mandatory.
- Organization A cannot read or mutate Organization B private data.
- Public company-page queries return only approved public fields.
- Independent providers may access only their own private records.
- Staff access is permission-controlled and audited.

## 20.2 Authentication and authorization

Every protected command verifies:

1. authenticated user;
2. active account;
3. organization membership when applicable;
4. capability;
5. role or permission;
6. plan entitlement;
7. record scope;
8. valid state transition;
9. idempotency when required.

## 20.3 File security

- private Supabase Storage buckets for verification, proof, and shipment files;
- signed URLs;
- file type and size validation;
- malware-scanning extension point;
- no service-role key in browser code;
- no permanent public URLs for sensitive files.

## 20.4 Public endpoints

- rate limiting;
- bot protection;
- validation;
- no internal IDs in public URLs;
- opaque tracking tokens;
- safe error responses;
- audit trails for sensitive actions.

## 20.5 General standards

- secure cookies;
- CSRF-safe mutations;
- Content Security Policy;
- no secrets committed;
- environment validation;
- SQL migrations in source control;
- dependency review;
- structured error handling;
- accessible forms.

---

# 21. Required Application Routes

Suggested route structure:

```text
/
 /for-shippers
 /for-parcel-companies
 /for-transporters
 /companies
 /companies/[handle]
 /plans
 /apply
 /login

/app
 /app/home
 /app/shipments
 /app/shipments/new
 /app/shipments/[shipmentId]
 /app/providers
 /app/capacity
 /app/loads
 /app/routes-centers
 /app/vehicles
 /app/drivers
 /app/company-page
 /app/messages
 /app/more

/admin
 /admin/applications
 /admin/verification
 /admin/organizations
 /admin/plans
 /admin/billing
 /admin/support
 /admin/audit
```

The UI must hide routes that are not relevant to the active workspace, but server authorization remains mandatory.

---

# 22. Required Seed Data

Provide deterministic seed data for:

- Platform Administrator
- Enterprise Shipper
- Enterprise Receiver
- Parcel Delivery Company
- Transport Company
- Independent Provider
- Team Members
- sample centers
- sample parcel routes
- sample vehicles
- Empty, Partial, and Full capacity
- fixed-price ETB load
- target-price ETB load
- Quote Requested load
- directed parcel request
- active parcel shipment
- active freight shipment
- completed shipment with proof
- pending business application
- pending payment proof

Include demo login credentials in local documentation only.

---

# 23. Required Automated Tests

## Authentication

- signup works;
- business application creates pending account;
- independent provider remains restricted until verification;
- suspended users are blocked;
- logout clears private state.

## RLS and permissions

- tenant isolation;
- public company-page fields only;
- staff permissions;
- plan entitlement enforcement;
- independent provider ownership enforcement.

## Company pages

- provider page renders approved data;
- private fields remain hidden;
- shipper page visibility rules work;
- routes and centers appear correctly;
- capacity freshness appears correctly.

## Shipments

- canonical shipment remains one record;
- direct request works;
- saved-partner visibility works;
- open load visibility works;
- ETB fixed price works;
- Quote Requested works;
- target price works;
- duplicate submission is idempotent.

## Parcel

- code lookup works;
- scanning is not required;
- valid status progression;
- invalid status jump is rejected;
- Collected records custody;
- Ready for Pickup and Out for Delivery remain distinct.

## Freight

- provider can express interest;
- directed provider can accept;
- one responsible provider;
- capacity status validation;
- Partial requires percentage;
- Empty equals 100 percent;
- Full equals zero;
- expired capacity disappears from public discovery;
- capacity photo is optional.

## Tracking and proof

- tracking-disabled shipment has no public tracking;
- opaque token works;
- stale location is labeled stale;
- proof permissions work;
- repeated completion is idempotent.

## Billing

- payment-proof review;
- subscription activation;
- historical entitlement snapshot preserved;
- plan limits enforced.

## Browser workflows

Use Playwright locally and make the same scenarios runnable through Browserbase:

- shipper creates load;
- transporter finds load and expresses interest;
- parcel company looks up shipment code and updates status;
- provider updates capacity;
- business views provider company page;
- admin approves business application.

---

# 24. Local Run Requirements

A fresh developer must be able to run:

```bash
pnpm install
supabase start
pnpm db:reset
pnpm dev
```

Expected result:

- local Supabase is running;
- migrations and seed data are applied;
- the web app opens;
- demo users can log in;
- core workflows work without cloud services.

Provide:

```text
.env.example
README.md
AGENTS.md
docker prerequisites
Supabase CLI instructions
demo credentials
test commands
troubleshooting
```

Do not require Browserbase credentials for local development.

---

# 25. Definition of Done

The MVP is done only when:

- the product name is Loadgistic everywhere;
- the homepage uses the canonical B2B positioning;
- all users log in directly;
- enterprise shippers and receivers can create shipments;
- provider discovery works;
- every business or independent provider has a company page;
- parcel companies can manage requests with manual code lookup;
- parcel routes and centers are visible;
- transporters and independent providers can discover loads;
- load prices use ETB or Quote Requested;
- freight capacity uses Empty, Partial, or Full;
- Partial uses an available percentage;
- freshness and optional photo support are visible;
- stale capacity expires;
- no fake metrics appear;
- no Internal Fleet module appears;
- simple parcel and freight workflows work;
- optional tracking and proof work;
- subscriptions and manual payment proof work;
- admin workflows work;
- RLS and authorization tests pass;
- local setup works from a clean clone;
- Browserbase-ready E2E configuration exists;
- documentation is complete;
- no dead routes or fake controls remain.

---

# 26. Final Engineering Instruction

The central product idea is simple:

> **Demand comes from enterprise shippers and receivers. Supply comes from parcel delivery companies, transport companies, and independent providers. Loadgistic helps both sides discover, contact, agree, move, and complete B2B shipments.**

Protect that simplicity.

Do not add unnecessary data merely because a dashboard has empty space.

Do not turn capacity into a complex analytics system.

Do not turn loads into an auction.

Do not turn parcel operations into mandatory scanning.

Do not invent trust metrics.

Build the smallest coherent application that performs the full B2B workflow correctly, securely, and clearly.
