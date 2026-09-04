# Security model

## Implemented locally

- Explicitly non-Production fixture-password login authenticates isolated
  Supabase Auth fixture identities; there is no application-owned password,
  signed-cookie identity, SQLite, or filesystem fallback.
- Supabase SSR PKCE sessions for managed Google and numeric email-code login
  and signup, with a signed 15-minute signup handoff and inactive Auth bootstrap,
  fixed deployment-owned callbacks, minimum Google identity scopes, generic
  denial for missing role projections, and a Production-disabled fixture-password boundary.
- Live local login/signup requests return generic non-cacheable responses and
  deliver numeric account codes only to Mailpit. Local Google PKCE uses the
  configured Web client and preserves the browser's supported local origin
  through the fixed application callback.
- Standard local configuration also routes application-owned Shared capacity,
  Tracking, and Assisted matching email through Mailpit's loopback HTTP API.
  The adapter accepts no remote host or credentials, uses bounded requests, and
  is ignored in Production, where a managed provider remains mandatory.
- Server-side provider, fleet, Driver-assignment, record-owner, platform-permission, and state-transition checks.
- Public capacity/provider projections that exclude password/code digests, party emails, private proof paths, hidden contacts, exact visitor location, and private plates.
- Provider-selected obscured truck coordinates; exact visitor location remains browser-only.
- One stable 80-bit customer-owner code stored only as a keyed digest and never placed in URLs.
- A separate 80-bit completion-email review code; shared Tracking access alone cannot publish a review.
- Tracking code derivation and digests use a dedicated Production secret rather
  than the login-session secret, so session-secret rotation cannot change a
  holder's code or its stored digest. Existing browser grants may expire during
  session rotation and can be reopened with the unchanged code. Rotating the
  Tracking secret itself requires an explicit compatibility or code-reissue
  operation.
- Short-lived guest sessions, 30-day post-completion expiry, customer-email scrubbing, and durable provider history.
- Proof accepted only for Loading, Unloading, and Issue; file size/MIME checks and private authorized reads.
- Idempotent customer-owner access and completion email records with bounded retry state and no false success when the adapter is unconfigured.
- Truck-scoped private-capacity grants, keyed email digests, six-digit ten-minute single-use
  OTPs stored only as keyed digests, five-attempt lockout, shared origin/email
  verification limits, expiry-aware delivery leases, bounded credential cleanup, signed restricted
  Shared capacity sessions with a 30-minute deliberate-activity idle limit and
  explicit logout, and immediate per-truck revocation.
- Account-free Assisted matching sessions, assigned-team authorization, required
  private callback contacts, bounded messages, guest/team closure, private
  attachment reads that reauthorize every request, and idempotent recovery-email records.
- A 15-minute scheduled dispatcher signs a timestamp-bounded HMAC-SHA256 request
  with `SESSION_SECRET`; the background worker requires `POST`, rejects unsigned
  or stale requests with timing-safe comparison, and exposes no private operation
  result. `TRACKING_CODE_SECRET` is separate and is never reused for worker or
  login-session signing.
- Evidence-specific reviewed badges with private documents and a persistent due-diligence warning.
- CSP, no-sniff, frame denial, strict referrer policy, and self-only geolocation permission. The exact resolved HTTPS tile origin is allowlisted without wildcard hosts.
- Audited sensitive mutations and default denial for retired demand/network endpoints.

## Required before public production

- The locally verified `001`–`069` chain is applied to the linked hosted
  database. Repeat RLS/RPC, role, atomic provider-onboarding, and concurrent
  limiter proof against Preview before broad public access.
  Hosted Production already has the exact Site URL/callback, Google provider,
  numeric login/signup templates, Gmail SMTP, and one verified real account OTP;
  Preview needs independent configuration, and both Google and complete signup
  require post-deploy end-to-end verification.
- Add reviewed bot protection for public queries, login, code unlock, review submission, and provider signup; the code unlock and review routes already use the shared PostgreSQL limiter.
- Configure the managed scanner key and prove clean, malicious, unavailable, quota, cleanup, and browser-denial behavior against Staging. The isolated local stack already proves quarantine-before-release, EICAR rejection, cleanup, and private-object denial, but its local scanner is test-only.
- Production application-SMTP variables are configured and an
  authentication-only handshake passes. Deploy and prove that separate remote
  application-email provider for Shared capacity, Tracking, and Assisted
  matching; monitor the signed
  scheduled/background worker, retry and retention operations, authorized
  Supabase Realtime with polling fallback, and cleanup scheduling. Verified
  Supabase Auth OTP mail does not satisfy this application-email gate.
- Monitor the attributed direct community-tile fallback during the bounded beta and move to a reviewed provider before sustained traffic; never proxy or bulk-copy community tiles.
- HTTPS, managed secrets, key rotation, central logging/alerts, backups, restore drills, and a reviewed destructive-demand-purge procedure.
