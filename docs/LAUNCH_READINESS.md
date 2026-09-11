# Launch readiness

## Current verdict

The repository, linked hosted database, and Netlify application support a
controlled production pilot. The clean local `001`–`076` replay and guarded
verifiers pass; the hosted project matches through `076`, retains seven private
Storage buckets each enforcing the 4 MiB object boundary, and contains the explicitly
approved synthetic pilot. Local login/signup OTP and Google routing are
verified, and hosted Supabase Auth OTP delivery is verified. GitHub `main` is
the Production source: merge commit `787b5526` passed CI run `34647400977`, and
Netlify deploy `6aa46d24c2d4c6876a354c13` published that exact commit. Live
smoke passed Supabase-backed health, Open capacity, Daily Featured, and
query-isolated Adama and Hawassa search. The release gate passed 218 Node tests,
TypeScript, the optimized 77-page build, the rolled-back 5,000-truck scale
fixture, full desktop/mobile browser workflows, the standalone container, and
a zero-high-vulnerability dependency audit. Production application-SMTP
credentials authenticate and both scheduled/background worker pairs are
invoked, but a real queued application email has not been proved end to end.
The runtime truthfully reports the managed upload scanner as its only readiness
blocker. Database restore, application-email, monitoring, bot protection, and
Preview evidence remain operational gates before unrestricted public launch.
`npm run launch:check` must remain red for real blockers rather than being
weakened for deployment.

## Verified locally

- Public account-free map with real tile rendering, clustering, provider details, and safe proximity behavior.
- Busy supply-only fixture across fleet companies and self-managed owner-operators, with no local demand data.
- Provider capacity/profile/fleet workflows and provider-owned shipment tracking.
- One stable 80-bit customer-owner code/link, separately derived 80-bit review code, dedicated Tracking-code secret boundary, governed transitions, 30-day guest expiry, access/completion email retry records, and provider reviews/disputes.
- Truck-scoped private-capacity grants, email/code Shared capacity access, Operations-only Loadgistic sharing, and account-free Assisted matching with bounded local live-refresh behavior.
- Specification/source checks, Node tests, TypeScript, production build, desktop/mobile E2E, and approved visual audit evidence as recorded in `docs/PROGRESS.md`.
- Standalone Node build, private Supabase Storage adapter, PWA shell, and health endpoint.
- Atomic Supabase request limits for login, signup, Shared capacity, Tracking and
  review unlock, review submission, Assisted matching, and member Support,
  including digest-only keys, browser-role denial, fail-closed behavior, and
  bounded cleanup.
- Server-only private-upload quarantine, signature checking, explicit clean release, EICAR rejection, cleanup, and anonymous list/download denial against the isolated local Supabase stack.
- Local port-`3001` member login and signup issue generic numeric-code responses
  through Mailpit without exposing codes, and local Google PKCE preserves the
  browser origin through the application callback.

## Public-production blockers

1. The clean isolated replay, hosted migrations `001`–`076`, approved pilot
   import, and fresh encrypted logical backup are complete. The separate
   encrypted Storage-object export was restored into the isolated stack and its
   object checksum verified. Rehearse an actual isolated database restore; the
   logical backup has been authenticated but not restored.
2. Inventory and purge any hosted legacy demand data only after a verified backup and explicit approval. A new empty project requires no purge.
3. Configure a server-only managed scanner, complete the privacy/vendor review,
   and repeat clean, malicious, unavailable, quota, cleanup, and browser-denial
   upload proofs against Supabase Preview. Production currently fails every
   upload closed. The application, Storage buckets, and user-facing contract now
   share a 4 MiB limit below Netlify's buffered-request boundary. The local test
   scanner does not satisfy the hosted-scanner gate.
4. Production application-SMTP credentials are configured separately from the
   already verified Supabase Auth SMTP, and an authentication-only handshake
   passes. The 15-minute managed scheduler and two-minute access-email recovery
   scheduler with their HMAC-authenticated background workers are deployed and
   observed invoking. Test a real queued Shared capacity, Tracking, and Assisted
   matching delivery, expiry-aware retry/cleanup, and unsigned/stale-request rejection.
   The personal-Gmail SMTP option is a bounded pilot warning, not the durable
   sending-domain gate.
5. Database SSL enforcement is enabled. Migration `075` added 19 observed
   hot-path foreign-key indexes, reducing the current unindexed-FK advisor count
   from 93 to 74. Migration `076` removed both Loadgistic application-function
   SQL-lint errors; six remaining error-level diagnostics belong to installed
   PostGIS extension functions. Continue the SECURITY DEFINER/RLS-policy review,
   narrow the effective allow-all direct database IPv4/IPv6 ranges, and enable
   reviewed CAPTCHA/bot protection for anonymous and Auth entry points. Do not
   drop currently unused indexes solely from low-pilot traffic evidence.
6. Strong distinct `SESSION_SECRET` and `TRACKING_CODE_SECRET` values are
   configured. Complete central logging/alerts, account MFA, credential-rotation
   rehearsal, and rollback monitoring. After real Tracking records exist,
   rotate the Tracking secret only with an explicit compatibility or code-reissue plan.
7. Keep the low-traffic pilot's explicit bounded cursor loading and CPU-throttled phone limits under observation. Before the market approaches thousands of simultaneously discoverable trucks, replace national cursor accumulation with viewport-scoped PostGIS queries and server-side or tile-based clustering.
8. Hosted Production Supabase Auth now has the exact Site URL and
   `/api/auth/callback`, Google identity credentials, numeric login/signup
   templates, Gmail SMTP, and one successfully verified real account OTP.
   Production route smoke reaches the intended Supabase project and Google
   account endpoint, and one deployed email-code request returned the generic
   code-sent state. Configure Preview independently; complete Google consent and
   OTP login/signup end to end against the active-role and
   atomic provider-provisioning boundaries before enabling them publicly.
9. Publish or schedule each next Ethiopia-day Featured roster deliberately;
    Production correctly shows no automatic replacement when a day is missing.
    Configure real Support availability before presenting Assisted matching as
    immediate help; the live presence projection currently reports zero
    available team members.

## Bounded beta map warning

Every Leaflet surface resolves one exact HTTPS tile origin through
`NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`, with linked
attribution and matching Content Security Policy. If both values are absent or
invalid, the beta uses the direct OpenStreetMap community endpoint and
`launch:check` reports `community-osm-tile-service` as a warning, not a blocker.
This is acceptable only for the low-traffic pilot: monitor use, retain visible
attribution, and switch to a reviewed provider before sustained traffic.
Loadgistic does not proxy, prefetch, bulk-copy, or self-host map tiles on
Netlify.

## Approved pilot topology

- GitHub is the source of truth and required-check boundary.
- GitHub CI runs quality, build, browser workflows, and the non-root Docker
  build from the same lockfile and commit.
- The existing Netlify site uses its read-only GitHub deploy key and push/PR
  webhook. Only `main` is the Production branch; deployed commits retain their
  Git SHA and Preview changes remain reviewable before merge.
- Netlify Free runs the Next.js application through its maintained OpenNext
  adapter. It does not run the Docker image or persist local files.
- Supabase Free provides the managed Postgres, Auth, private Storage, and
  bounded Realtime services.
- Browsers request configured map tiles directly; Netlify does not relay or
  store them.
- Authenticated Gmail SMTP may provide the controlled pilot's low-volume Auth
  and application mail through separate configurations. The application warns
  that raw SMTP retry is at least once. Move to an owned-domain transactional
  provider before higher-volume use.
- Cloudflare Turnstile may protect anonymous and authentication entry points;
  transactional Supabase counters remain authoritative for shared rate limits.

This is a deliberately bounded commercial pilot. Netlify's 300 monthly credits
and Supabase's Free quotas are hard availability boundaries. The release must
fail closed when managed services are unavailable; it must never fall back to
SQLite or a serverless filesystem. Upgrade hosting or database capacity before
traffic approaches those limits.

## Deployment gates

```bash
npm ci
npm run quality
npm run build
npm run test:e2e
npm audit --audit-level=high
npm run launch:check
```

Run the approved visual audit for a release candidate after the same immutable artifact and backing services are configured. `/api/health` returning HTTP 200 proves process/database reachability only; it does not assert public-production readiness.
