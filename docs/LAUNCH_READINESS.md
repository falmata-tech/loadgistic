# Launch readiness

## Current verdict

The repository, linked hosted database, and Netlify application support a controlled production pilot. The clean local `001`–`069` replay and guarded live verifiers pass, the hosted project has the matching migration chain and seven private Storage buckets, local login/signup OTP and Google routing are verified, and hosted Supabase Auth OTP delivery is verified. Production deploy `6a9b4353c786527571b25051` serves application commit `935772c`; live desktop and phone checks passed the public routes and Supabase-backed health. Release follow-up `174380e` passed GitHub CI run `33926528912`, including managed-fixture verification, the 5,000-truck rollback scale check, desktop/mobile browser workflows, and the standalone container build. Production application-SMTP variables are configured in Netlify and their authentication handshake passes, but this is not remote delivery evidence. The application is not approved for unrestricted public production until the managed scanner, remote application-email, Preview concurrency, monitoring, and backup/restore gates below are resolved. `npm run launch:check` must remain red for real blockers rather than being weakened for deployment.

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

1. The clean isolated local replay and linked hosted application of migrations
   `001`–`069` are complete. Verify hosted RLS/RPC behavior including concurrent request limits,
   expiry-aware Shared capacity delivery/cleanup, private-quarantine isolation,
   provider-profile/Fleet ownership, Verification/Billing and
   Assisted-matching private-file scope, Support assignment/requeue, bounded
   Operations, atomic Featured/Sponsor administration, and terminal reviews;
   import only approved Production place data; and rehearse encrypted logical
   backup/restore. No local fixture identities or market rows were imported.
2. Inventory and purge any hosted legacy demand data only after a verified backup and explicit approval. A new empty project requires no purge.
3. Configure a server-only managed scanner, complete the privacy/vendor review, and repeat clean, malicious, unavailable, quota, cleanup, and browser-denial upload proofs against Supabase Preview. The local test scanner does not satisfy this gate.
4. Production application-SMTP credentials are configured separately from the
   already verified Supabase Auth SMTP, and an authentication-only handshake
   passes. The 15-minute managed scheduler and two-minute access-email recovery
   scheduler with their HMAC-authenticated background workers are deployed;
   monitor their runs, then test real Shared capacity, Tracking, and Assisted matching
   delivery, expiry-aware retry/cleanup, and unsigned/stale-request rejection.
   The personal-Gmail SMTP option is a bounded pilot warning, not the durable
   sending-domain gate.
5. Verify the implemented shared PostgreSQL request limiter under Preview
   concurrency, add reviewed bot protection for high-risk anonymous entry
   points, and configure authorized Supabase Realtime subscriptions with polling
   fallback for active guest conversations. Tracking review submission is now
   covered; public discovery still needs explicit shared-limit coverage before
   launch.
6. Strong distinct `SESSION_SECRET` and `TRACKING_CODE_SECRET` values are
   configured. Complete HTTPS smoke, rotation, central logging/alerts, deployment
   approval, and rollback monitoring. Production has no Tracking records from a
   local fixture; after real Tracking records exist, rotate that
   secret only with an explicit compatibility or code-reissue plan.
7. Keep the low-traffic pilot's explicit bounded cursor loading and CPU-throttled phone limits under observation. Before the market approaches thousands of simultaneously discoverable trucks, replace national cursor accumulation with viewport-scoped PostGIS queries and server-side or tile-based clustering.
8. Hosted Production Supabase Auth now has the exact Site URL and
   `/api/auth/callback`, Google identity credentials, numeric login/signup
   templates, Gmail SMTP, and one successfully verified real account OTP.
   Production route smoke reaches the intended Supabase project and Google
   account endpoint, and one deployed email-code request returned the generic
   code-sent state. Configure Preview independently; complete Google consent and
   OTP login/signup end to end against the active-role and
   atomic provider-provisioning boundaries before enabling them publicly.

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
