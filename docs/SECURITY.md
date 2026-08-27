# Security model

## Implemented locally

- HTTP-only SameSite signed provider sessions and scrypt password hashes for local fixtures.
- Supabase SSR PKCE sessions for managed Google and numeric email-code login
  and signup, with a signed 15-minute signup handoff and inactive Auth bootstrap,
  fixed deployment-owned callbacks, minimum Google identity scopes, generic
  denial for missing role projections, and a Production-disabled fixture-password boundary.
- Server-side provider, fleet, Driver-assignment, record-owner, platform-permission, and state-transition checks.
- Public capacity/provider projections that exclude password/code digests, party emails, private proof paths, hidden contacts, exact visitor location, and private plates.
- Provider-selected obscured truck coordinates; exact visitor location remains browser-only.
- One stable high-entropy customer-owner code stored only as a keyed digest and never placed in URLs.
- A separate completion-email review code; shared Tracking access alone cannot publish a review.
- Short-lived guest sessions, 30-day post-completion expiry, customer-email scrubbing, and durable provider history.
- Proof accepted only for Loading, Unloading, and Issue; file size/MIME checks and private authorized reads.
- Idempotent customer-owner access and completion email records with bounded retry state and no false success when the adapter is unconfigured.
- Truck-scoped private-capacity grants, keyed email digests, ten-minute single-use
  OTPs stored only as keyed digests, five-attempt lockout, signed restricted
  Shared capacity sessions with a 30-minute deliberate-activity idle limit and
  explicit logout, and immediate per-truck revocation.
- Account-free Assisted matching sessions, assigned-team authorization, required
  private callback contacts, bounded messages, guest/team closure, private
  attachment reads that reauthorize every request, and idempotent recovery-email records.
- Evidence-specific reviewed badges with private documents and a persistent due-diligence warning.
- CSP, no-sniff, frame denial, strict referrer policy, and self-only geolocation permission. The exact resolved HTTPS tile origin is allowlisted without wildcard hosts.
- Audited sensitive mutations and default denial for retired demand/network endpoints.

## Required before public production

- Complete PostgreSQL/Supabase repository parity and managed provider onboarding
  with reviewed RLS/RPC authorization. Before traffic, configure the Google
  provider, exact Site URL/Redirect URL allowlists, numeric login and signup email templates, and verified SMTP.
- Shared rate limiting and bot protection for public queries, login, code unlock, review submission, and provider signup.
- Configure the managed scanner key and prove clean, malicious, unavailable, quota, cleanup, and browser-denial behavior against Staging. The isolated local stack already proves quarantine-before-release, EICAR rejection, cleanup, and private-object denial, but its local scanner is test-only.
- Managed email delivery, webhook authentication, retry monitoring, guest support retention, authorized Supabase Realtime with polling fallback, and cleanup scheduling.
- Monitor the attributed direct community-tile fallback during the bounded beta and move to a reviewed provider before sustained traffic; never proxy or bulk-copy community tiles.
- HTTPS, managed secrets, key rotation, central logging/alerts, backups, restore drills, and a reviewed destructive-demand-purge procedure.
