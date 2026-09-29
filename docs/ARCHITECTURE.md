# Architecture

## Locally verified audit architecture

ADRs 058–062 extend the existing ports without a new service: lifecycle.js owns
bounded recovery inputs and PostgreSQL commands; identity/account-security.ts
and signed operation handoffs adapt the actor's own Supabase Auth session;
capacity-viewport.js owns viewport/retention/query validation, with SQL filtering,
precomputed envelopes and public aggregate cells in 093; Support revision reads
in 094 precede conditional HTTP responses. Private grants and current authority
are rechecked before paging or returning an unchanged response. Web GPS remains
foreground-only. Migrations 090–095, SQL, concurrency and scale checks passed
locally, together with 34 affected desktop/phone cases across focused runs.
BUILD_VERIFICATION records final gates and the F22/F24 feedback/zoom repairs. This section
describes the local candidate, not deployed behavior.

Public metadata and Driver first-name RPCs in 095 filter hidden contacts and
private image paths before returning data to rendering code. Final JavaScript
filtering alone is insufficient when development tooling serializes intermediate
promises. Viewport commands live in the command panel so they do not divide the
map canvas into implicit grid rows.

Loadgistic is a Next.js App Router application on the Node runtime. Server-rendered pages and Route Handlers adapt HTTP to explicit repository/domain commands.

## Layers

1. UI/routing — `src/app`, `src/components`.
2. Authentication and guest-grant boundary — `src/lib/auth.ts`, managed PKCE/email-code adapters under `src/app/api/auth`, and fixed callback policy in `src/lib/auth-flow.js`.
3. Pure state/validation rules — `src/lib/domain.js`, `src/lib/security.js`.
4. Application services, authorization, and projections — explicit managed ports under `src/lib`, including `platform-admin.js`.
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
- Daily Featured Trucks with assigned Drivers, weekday truck themes, automatic or manually controlled rosters, one 07:30–09:00 EAT programme, up to four short interludes, and a transporter/outside-advertiser sponsor catalogue.
- Provider-owned Tracking and immutable execution events behind the service-role-only managed Tracking repository; PostgreSQL independently rechecks workspace ownership, Driver permission, assignment, transition, and location consent.
- One active customer-owner code digest, a separate review-code digest, customer-safe guest projection, and private idempotent access/completion delivery attempts.
- Provider review and low-rating dispute, with completion/expiry/uniqueness and owning-provider checks repeated inside managed commands.
- Verification request, subscription/payment proof, Support conversation, notification, and audit log.
- Truck-scoped Capacity access grant, short-lived Shared capacity email OTP,
  30-minute rolling-idle restricted visitor session with explicit logout, and account-free Assisted matching conversation
  with private attachments and explicit guest/team closure.

Identity-bearing records enforce one provider owner scope. Current routes and transitions are explicit. Public projections are separate from private email- and platform-audience capacity projections. No active domain aggregate represents public shipment demand, interests, Business profiles, or demand-side member networks. The provider Network is truck-scoped access control, not a demand relationship graph.

Managed provider identity uses Supabase Auth with SSR cookies. Google login asks
only for OpenID, email, and profile identity. Unified email OTP may create an
inactive, role-free Auth bootstrap for a new address; neither flow grants application authority until the
authenticated subject resolves through `current_user_projection()`. OAuth
returns only through the deployment-owned `/api/auth/callback` URL and never
accepts a dynamic post-login destination. A signed, HTTP-only intent binds Login
or Signup to the exact PKCE verifier slot without placing the flow selector in
the callback URL; the callback clears that intent after one terminal attempt.
Password authentication is an
explicit non-Production fixture tool, not a managed customer login method.
Public signup proves Google or numeric email-code identity through a signed
15-minute HTTP-only handoff before asking for provider facts. The unified
email request may create one Auth subject, but the database trigger keeps it
inactive. A service-role-only provisioning intent then creates the selected
provider workspace, draft page, signup record, and trial in one PostgreSQL
transaction before the profile becomes active.

The installable shell is public-first: `/` is the manifest identity and Open capacity launch URL, while `/shared-capacity`, `/track`, `/featured`, `/about`, and `/apply` are distinct public route workspaces. The shared public header and route-aware navigation persist visually across client-side `Link` transitions in the order Open capacity, Private capacity, Track, Featured, and About, and its persistent chat launcher restores one authorized guest conversation across public route changes. `/help` remains a recovery fallback rather than a primary navigation destination. Market and Featured remain separate Server Component trees so each route loads only its own projection and client modules. Desktop uses a floating public workspace rail; public and authenticated phone layouts provide their own role-appropriate fixed navigation. The service worker ignores navigation requests, private workspace pages, and framework chunks; only stable brand and vehicle artwork may use cache-first delivery.

Public current-capacity projection is privacy aware: a Private network signal, truck identity, current geometry, approximate location, and regular-service geometry are absent from anonymous discovery. A provider must publish the truck to Open capacity for that truck to appear publicly; an explicit grant may additionally expose the same Open or Private signal to an authorized email recipient.

## Deployment path

Query-sensitive public capacity and place-search JSON stays outside shared CDN caches unless the cache key varies on every accepted query parameter. The current Netlify adapter sends both responses as private and non-storable.

Replay the reviewed migration chain from an empty isolated stack and
the linked Preview project, run repository/RLS/identity tests, configure and
prove the configured upload inspection policy and verified email sender, review the live
Supabase Security and Performance Advisor findings, configure monitoring,
rehearse database and Storage-object restore, and then deploy the Next.js
application through Netlify's maintained OpenNext adapter. Managed Auth/signup,
health, place search, public discovery, Shared capacity, provider Capacity,
provider-owned Tracking, transporter-profile editing, authenticated
workspace/Fleet management, Verification/Billing, member Support, Assisted
matching, platform-team management, Operations, Daily Featured/Sponsor
administration, shared request limits, server-only upload quarantine, and the
bounded scheduled email/retention/limit-cleanup worker use isolated adapter
ports. The SQLite runtime and compatibility modules have been removed. CI also
builds the standalone Docker artifact from the same commit for reproducibility
and host portability. No application runtime falls back to SQLite or local
serverless files.

Current chat delivery uses visibility-aware bounded polling, not a deployed
Supabase Realtime subscription. Closed chats and minimized launchers without a
conversation stop recurring reads; failures back off. Message history uses
service-only `managed_support_history` and `managed_guest_support_history` RPCs
with conversation-scoped `(created_at,id)` cursors and a 50-message window.
Historical reads reuse current authorization without marking new replies read;
the UI pauses polling until Latest messages is selected. Realtime remains future
work rather than a capability implied by managed hosting.

Migration `084` makes guest Support assignment checks NULL-safe for transcript,
message, closure and attachment commands: unassigned Support actors must claim
before accessing a conversation. Migration `085` adds history reads and the
member-message cursor index, reusing the existing guest-message index. Keep the
authorization repair if rolling back the history UI.

Migration `083` adds authorized Tracking-proof reads. Its file reference remains
server-only; each read checks provider/Driver ownership, Operations permission,
or the recipient-bound guest grant before reading private Storage. Local migration
application is not evidence of remote rollout; use BUILD_VERIFICATION for that.

Account maintenance uses the existing identity boundary:
`/api/account/details` → `identity/account-details.ts` → service-only
`update_own_account_details`. Both enhanced JSON and native POST share strict
input and verified session scope. Migration 086 repeats active-role checks,
locks Driver then profile rows consistently with fleet contact edits, changes
only shared names/private account phones, and records an audit without contact
values. Its scoped fleet-command replacement preserves private phone ownership.
Email change/closure and public-contact editing retain separate contracts.

Driver portraits add a narrow media port (`driver-portrait-storage.js`) and bounded
Sharp normalization (`driver-portrait-image.js`). Migration 087 reserves a private
Storage reference in PENDING metadata before upload, activates with public consent
under profile/upload locks, and retires the previous image atomically. Removal
also cancels in-flight reservations; cleanup waits for those writes to settle or
age out. The terminal DELETING state prevents reactivation while the existing
signed worker retries failed deletion. Active images survive ambiguous activation
responses. Portrait Storage operations use 30-second request timeouts.

The opaque public image ID is separate from account identity and private file
paths. Public reads repeat current-state/active-Driver checks and use no-store;
Featured eligibility remains owned by its existing projection. Sharp 0.35.4 was
already installed through Next and is now pinned directly; no new bucket/vendor
or browser database grant is introduced. Apply 087 before UI/worker rollout.

Public microsite fleets use service-only `public_provider_fleet_page` (088),
with a 12-truck page, exact owner-scoped total and stable aggregate vehicle
evidence. Related Driver/vehicle reads use the page IDs, and the existing public
capacity query narrows to those IDs before selecting latest states. The optional
ID filter is internal to the server adapter; public query parameters do not expose
it. Native canonical-handle pagination replaces the 96-signal scan ceiling.
The public national-map viewport query remains separate work (FEAT-LST-001).

Tracking location acquisition uses a single-flight foreground browser runner.
It invalidates late GPS callbacks and aborts fetches on hide/unmount, while the
existing PostgreSQL actor/travel-state/radius checks and ten-minute cooldown
remain unchanged. Browser feedback distinguishes selected privacy radius, saved
location and throttled waiting. Driver and recipient screens describe the
foreground limitation explicitly (FEAT-TRK-001, ADR-056).

## Private member Support files (migration 089)

`support-attachments.js` reserves an authorized private reference before upload
and attaches it to an audited message through one atomic PostgreSQL command.
The member/staff composer posts multipart data; recent/history messages link to a
server download that rechecks current conversation scope. Closed histories retain
files. The managed operations worker claims at most 20 failed/stale unattached
objects and acknowledges metadata deletion only after Storage deletion. Attached
rows cannot be retired by ambiguous-response cleanup. ADR-057 records lifecycle,
rollout and future account/conversation deletion requirements.
