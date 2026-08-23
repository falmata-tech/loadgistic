# Architecture

Loadgistic is a Next.js App Router application on the Node runtime. Server-rendered pages and Route Handlers adapt HTTP to explicit repository/domain commands.

## Layers

1. UI/routing — `src/app`, `src/components`.
2. Authentication and guest-grant boundary — `src/lib/auth.ts`.
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
- Provider shipment and immutable execution events.
- One active customer-owner code grant and private access/completion email-delivery attempts.
- Provider review and low-rating dispute.
- Verification request, subscription/payment proof, Support conversation, notification, and audit log.
- Truck-scoped Capacity access grant, short-lived Shared capacity email OTP,
  30-minute rolling-idle restricted visitor session with explicit logout, and account-free Assisted matching conversation
  with private attachments and explicit guest/team closure.

Identity-bearing records enforce one provider owner scope. Current routes and transitions are explicit. Public projections are separate from private email- and platform-audience capacity projections. No active domain aggregate represents public shipment demand, interests, Business profiles, or demand-side member networks. The provider Network is truck-scoped access control, not a demand relationship graph.

The installable shell is public-first: `/` is the manifest identity and Truck Market launch URL, while `/featured`, `/shared-capacity`, `/track`, `/about`, and `/apply` are distinct public route workspaces. The shared public header and route-aware navigation persist visually across client-side `Link` transitions, and its persistent chat launcher restores one authorized guest conversation across public route changes. `/help` remains a recovery fallback rather than a primary navigation destination. Market and Featured remain separate Server Component trees so each route loads only its own projection and client modules. Desktop uses a floating public workspace rail; public and authenticated phone layouts provide their own role-appropriate fixed navigation. The service worker ignores navigation requests, private workspace pages, and framework chunks; only stable brand and vehicle artwork may use cache-first delivery.

Public current-capacity projection is privacy aware: a Private network signal exposes no current geometry or approximate location. If its provider has a public regular Service area or Capacity route, the Market can retain a categorical truck marker on that regular-service geometry and labels it as service information rather than current location.

## Deployment path

Replay `supabase/migrations/001` through `032` from an empty local stack and the linked Preview project, implement the PostgreSQL repository plus Supabase Auth/Storage adapters, run repository/RLS/identity tests, configure managed email, malware scanning, Supabase Realtime, cleanup, shared rate limiting, and monitoring, rehearse backup and rollback, then deploy the Next.js application through Netlify's maintained OpenNext adapter. CI also builds the standalone Docker artifact from the same commit for reproducibility and host portability. No application runtime falls back to SQLite or local serverless files.
