# Architecture

Loadgistic is a Next.js App Router application on the Node runtime. Server-rendered pages and Route Handlers adapt HTTP to explicit repository/domain commands.

## Layers

1. UI/routing — `src/app`, `src/components`.
2. Authentication and guest-grant boundary — `src/lib/auth.ts`, managed PKCE/email-code adapters under `src/app/api/auth`, and fixed callback policy in `src/lib/auth-flow.js`.
3. Pure state/validation rules — `src/lib/domain.js`, `src/lib/security.js`.
4. Application services, authorization, and projections — `src/lib/repository.js`.
5. Persistence — Supabase PostgreSQL behind explicit repository ports; local work uses the isolated Supabase CLI stack.
6. Identity and files — Supabase Auth SSR sessions and private Supabase Storage buckets.
7. External adapters — managed email delivery, malware scanning, and bounded operational jobs.

Dependency direction is HTTP/UI → application authorization/services → domain rules → outbound adapters. UI code never queries Supabase directly; repository, identity, and storage ports keep tenant authorization testable while local, Preview, and Production use the same managed-service contracts.

## Active entities and invariants

- Provider organization or self-managed provider profile.
- Vehicle and exclusive active Driver assignment.
- Latest current Service-area or two-to-five-city Capacity-route signal and no more than one provider-level regular Service area or Capacity route.
- Anonymous Truck Market query with full-polygon Service-area proximity, every-segment multi-city route alignment, route/area label search, safe truck-fact predicates, browser-only map centering, and explicitly enabled browser-displaced visitor proximity.
- Published provider microsite with a shared presentation template, safe contact projection, and nested active-truck/current-capacity projection.
- Administrator-published Daily Featured Transporters day, ordered variable slots, deterministic automatic or validated manual two-session timeline, unified transporter/outside-advertiser sponsor catalogue, and separately disclosed sponsorship placements.
- Provider-owned Tracking and immutable execution events behind the service-role-only managed Tracking repository; PostgreSQL independently rechecks workspace ownership, Driver permission, assignment, transition, and location consent.
- One active customer-owner code digest, a separate review-code digest, customer-safe guest projection, and private idempotent access/completion delivery attempts.
- Provider review and low-rating dispute, with completion/expiry/uniqueness and owning-provider checks repeated inside managed commands.
- Verification request, subscription/payment proof, Support conversation, notification, and audit log.
- Truck-scoped Capacity access grant, short-lived Shared capacity email OTP,
  30-minute rolling-idle restricted visitor session with explicit logout, and account-free Assisted matching conversation
  with private attachments and explicit guest/team closure.

Identity-bearing records enforce one provider owner scope. Current routes and transitions are explicit. Public projections are separate from private email- and platform-audience capacity projections. No active domain aggregate represents public shipment demand, interests, Business profiles, or demand-side member networks. The provider Network is truck-scoped access control, not a demand relationship graph.

Managed provider identity uses Supabase Auth with SSR cookies. Google login asks
only for OpenID, email, and profile identity, while login email OTP requests set
`shouldCreateUser:false`; neither login flow grants application authority until the
authenticated subject resolves through `current_user_projection()`. OAuth
returns only through the deployment-owned `/api/auth/callback` URL and never
accepts a dynamic post-login destination. Password authentication is an
explicit non-Production fixture tool, not a managed customer login method.
Public signup proves Google or numeric email-code identity through a signed
15-minute HTTP-only handoff before asking for provider facts. The signup-only
email request may create one Auth subject, but the database trigger keeps it
inactive. A service-role-only provisioning intent then creates the selected
provider workspace, draft page, signup record, and trial in one PostgreSQL
transaction before the profile becomes active.

The installable shell is public-first: `/` is the manifest identity and Truck Market launch URL, while `/featured`, `/shared-capacity`, `/track`, `/about`, and `/apply` are distinct public route workspaces. The shared public header and route-aware navigation persist visually across client-side `Link` transitions, and its persistent chat launcher restores one authorized guest conversation across public route changes. `/help` remains a recovery fallback rather than a primary navigation destination. Market and Featured remain separate Server Component trees so each route loads only its own projection and client modules. Desktop uses a floating public workspace rail; public and authenticated phone layouts provide their own role-appropriate fixed navigation. The service worker ignores navigation requests, private workspace pages, and framework chunks; only stable brand and vehicle artwork may use cache-first delivery.

Public current-capacity projection is privacy aware: a Private network signal exposes no current geometry or approximate location. If its provider has a public regular Service area or Capacity route, the Market can retain a categorical truck marker on that regular-service geometry and labels it as service information rather than current location.

## Deployment path

Replay `supabase/migrations/001` through `053` from an empty local stack and the linked Preview project, complete the remaining PostgreSQL repository ports, run repository/RLS/identity tests, configure and prove the managed upload scanner and verified email sender, configure Supabase Realtime and shared-limit monitoring, rehearse backup and rollback, then deploy the Next.js application through Netlify's maintained OpenNext adapter. Managed Auth/signup, health, place search, public discovery, Shared capacity, provider Capacity, provider-owned Tracking, transporter-profile editing, authenticated workspace/Fleet management, Verification/Billing, shared request limits, server-only upload quarantine, and the bounded scheduled email/retention/limit-cleanup worker already use isolated adapter ports; remaining repository paths stay production-blocked until parity. CI also builds the standalone Docker artifact from the same commit for reproducibility and host portability. No application runtime falls back to SQLite or local serverless files.
