# Security model

## Implemented locally

- HTTP-only SameSite signed provider sessions and scrypt password hashes for local fixtures.
- Server-side provider, fleet, Driver-assignment, record-owner, platform-permission, and state-transition checks.
- Public capacity/provider projections that exclude password/code digests, party emails, private proof paths, hidden contacts, exact visitor location, and private plates.
- Provider-selected obscured truck coordinates; exact visitor location remains browser-only.
- Separate high-entropy shipper and receiver codes stored only as keyed digests and never placed in URLs.
- Party-scoped guest sessions, 30-day post-completion expiry, email scrubbing, and durable provider history.
- Proof accepted only for Loading, Unloading, and Issue; file size/MIME checks and private authorized reads.
- Idempotent completion-email records with bounded retry state and no false success when the adapter is unconfigured.
- Evidence-specific reviewed badges with private documents and a persistent due-diligence warning.
- CSP, no-sniff, frame denial, strict referrer policy, and self-only geolocation permission. OSM tile hosts are explicitly allowlisted.
- Audited sensitive mutations and default denial for retired demand/network endpoints.

## Required before public production

- Managed identity and PostgreSQL/Supabase repository parity with reviewed RLS/RPC authorization.
- Shared rate limiting and bot protection for public queries, login, code unlock, review submission, and provider signup.
- Malware scanning/quarantine and production private-object authorization.
- Managed email delivery, webhook authentication, retry monitoring, and retention cleanup scheduling.
- Production tile service terms/capacity/privacy review.
- HTTPS, managed secrets, key rotation, central logging/alerts, backups, restore drills, and a reviewed destructive-demand-purge procedure.
