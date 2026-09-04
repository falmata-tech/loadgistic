# Netlify and Supabase handoff

This is a credential-free owner handoff. Never put real secrets, customer data, tracking codes, or private files in this document, commits, screenshots, or chat logs.

## Release boundary

The owner selected Netlify Free for the initial commercial pilot and Supabase
Free for managed Postgres, Auth, private Storage, and bounded Realtime. The same
commit must continue to produce the standalone Docker artifact for CI parity and
a portable fallback; Netlify runs the maintained OpenNext adapter rather than
the Docker image.

The application is approved for a controlled hosted pilot, not unrestricted
public Production. Broad launch remains blocked until remote application email,
upload-scanning, backup/restore, Preview verification, and monitoring gates in
`docs/LAUNCH_READINESS.md` pass. Public discovery, Shared capacity, provider
Capacity, provider-owned Tracking, transporter-profile editing, managed signup,
the authenticated workspace shell, Fleet management, Verification, Billing,
member Support, Assisted matching, platform-team management, Operations, and
Featured/Sponsor administration all use the unconditional managed runtime.

## Provisioned control plane — 2026-09-02

- Netlify Free team: `Falmata Dawano` (`falmatad97`)
- Netlify site: `loadgistic-473` (`dbb0fcec-9ec9-4511-9737-db0e32849af5`)
- Reserved URL: `https://loadgistic-473.netlify.app`
- Local repository link: `.netlify/state.json` (ignored by Git)
- The reviewed Production application, Supabase, session/Tracking,
  fixture-disable, and application-SMTP variables are configured in Netlify
  without placing values in source. Session, Tracking, service-role, and SMTP
  credentials are marked secret. On Netlify Free their supported secret scopes
  necessarily include Builds, Functions, and Runtime; non-sensitive deployment
  values use all available scopes.
- Hosted Supabase Auth has the exact Site URL/callback, separate Production
  Google client, six-digit templates, and Gmail SMTP configured. A real hosted
  Auth OTP request and verification completed successfully.

The Netlify site is provisioned and ready for the reviewed release artifact;
successful application deployment and live route smoke are recorded only after
the current promotion completes. Application-owned
Tracking, Shared capacity, and Assisted matching SMTP credentials are now
configured separately in Netlify, and an authentication-only handshake passed
without sending a message. A deployed provider/worker smoke test is still
required; Supabase Auth cannot expose or reuse its saved SMTP password.
Supabase is the unconditional identity, data, request-limit, and private-Storage
runtime; there are no backend selector variables to configure. The hosted
Loadgistic database has migrations `001`–`069`, and all seven application buckets
are private. It intentionally has no local fixture import. Upload-scanning and
the remaining rollout gates below remain red.

## Free-pilot operating envelope

Netlify Free has a hard 300-credit monthly ceiling. A Production deploy costs
15 credits; web bandwidth, requests, and function compute consume the remaining
credits. Use unlimited Preview deploys for review, provisionally cap Production
promotions at four per month, and check Usage before every promotion. The site
may pause when the hard limit is exhausted. Do not enable paid auto-recharge as
part of the free pilot.

Supabase Free supplies 500 MB database storage, 1 GB object storage, 5 GB
egress, 50,000 monthly active Auth users, 200 peak Realtime connections, two
million Realtime messages, and 500,000 Edge Function invocations. It may pause
after seven days of low activity, has one-day platform-log retention, and does
not provide downloadable automatic backups. Treat this as an early-access
operating envelope, not evidence for thousands of concurrent users.

Use the two free Supabase projects as Staging and Production. Maintain a daily
encrypted logical Production backup outside Supabase, verify a restore into
Staging before launch and monthly thereafter, and use a 24-hour recovery-point
objective and four-hour recovery-time objective for the free pilot. Never place
an unencrypted dump in Git, a CI log, or a public artifact.

## Supabase staging

1. Create a project in the intended region and verify backup/restore first.
2. Apply all migrations from `001_loadgistic_schema.sql` through
   `069_daily_featured_trucks.sql` in numeric order.
3. Run SQL lint and review every RLS policy/default-deny private table.
4. Import the reviewed place catalog with `npm run places:import:supabase` from a trusted operator machine.
5. Confirm every purpose bucket plus the private `private-upload-quarantine` bucket, then configure and prove the managed scanner before serving uploads.
6. Run every guarded managed verifier and the critical browser workflow against Preview without importing fake market identities into Production.
7. Inventory any old cloud demand data. Purge only after explicit approval and a verified backup; record exact before/after counts privately. A new empty project requires no purge.

The service-role key is server-only and never uses a `NEXT_PUBLIC_` name. Browser code receives only explicit safe projections or authorized short-lived file access.

## Managed service configuration

Netlify detects the Next.js App Router and provisions its maintained OpenNext
adapter. `netlify.toml` fixes Node 22 and the repository build command. Do not
pin the adapter plugin. Connect the GitHub Production branch only after its
required CI checks pass; keep automatic Production publishing disabled until
the release gate is green.

Supabase Auth owns transporter identity, Google OAuth, numeric email-code login and signup,
and browser sessions. The browser/server SSR clients, PKCE callback exchange,
request-cookie refresh boundary, active-role projection, and
Production-disabled local fixture-password boundary are the only identity
runtime. Managed provider onboarding now provisions an inactive
Auth subject, collects the short provider profile after Google or email-code
identity proof, and then provisions the matching provider workspace, draft page,
signup record, seven-day trial, and active role projection atomically.
The hosted Production Auth callback, Google provider, numeric templates, and
Gmail SMTP are configured, and one real account OTP was verified. Google login
and the complete provider-signup path still require end-to-end verification
after the application and schema are deployed; Preview requires its own exact
configuration.
The default Supabase SMTP service is demonstration-only and cannot deliver a
public launch. The controlled pilot currently uses authenticated Gmail SMTP for
Supabase Auth. Application-owned Tracking, Shared capacity, and Assisted
matching messages use a separate durable queue and Netlify email adapter. They
currently use separately configured Netlify SMTP host, port, user, app password,
From, and reply-to values. Their authentication handshake passes, but no message
or deployed-worker delivery has been proved. This temporary SMTP adapter
uses TLS and stable Message-IDs but remains at-least-once after an ambiguous
timeout, so readiness reports a warning. Replace it with an owned sending domain
and the Resend API adapter before higher-volume public use. The source-verified
Netlify design invokes the general managed dispatcher every 15 minutes and the
access-email recovery dispatcher every two minutes. Each sends a
timestamped HMAC-SHA256 signed request to bounded background work. The workers
reject unsigned or stale calls, expose no private operation result, and are not
deployed or monitored yet; after deployment, monitor the mailbox and
function-credit ceilings.
Cloudflare Turnstile may provide the no-cost bot challenge, while the
shared enforcement counters remain transactional Supabase records rather than
process-local memory.

Production has completed steps 1–4 below and basic Gmail SMTP account-OTP
delivery. Repeat them independently for Preview. Expiry, unknown-address,
rate-limit, Google login, and the full signup workflow still require hosted
application smoke tests after the schema and site deploy.

Configure Preview and Production independently:

1. Set Supabase **Site URL** to that environment's `APP_URL` origin.
2. Add the exact `<APP_URL>/api/auth/callback` to Supabase **Redirect URLs**.
   Preview and Production use separate exact entries; do not add a wildcard
   callback or a visitor-controlled `next` destination.
3. Create separate Google Web application clients for Production and local
   development. The Production client authorizes
   `https://loadgistic-473.netlify.app` and redirects only to
   `https://tpwyyzoqijjmbvsmmvcm.supabase.co/auth/v1/callback`. Enter that
   client ID and secret only in the hosted Supabase Google provider. The local
   client authorizes `http://127.0.0.1:3100` and redirects only to
   `http://127.0.0.1:55321/auth/v1/callback`; its values live only in the
   ignored `.local/google-oauth.env`. Both request only `openid email profile`.
4. Change the Supabase sign-in email template to display the numeric
   `{{ .Token }}` value rather than a magic-link-only `{{ .ConfirmationURL }}`.
   Set the code to six digits and ten minutes to match the reviewed local configuration.
5. Configure verified custom SMTP and test delivery, expiry, retry, unknown
   addresses, and rate limiting before enabling public login.
6. Keep `ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN` unset in Preview and Production.

Use Node 22.x and configure Preview/Production independently:

```text
APP_URL
SESSION_SECRET # session signing and scheduled/background HMAC boundary
TRACKING_CODE_SECRET # strong, distinct Tracking-code derivation secret
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_MAP_TILE_URL
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
SUPABASE_SERVICE_ROLE_KEY
ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN
UPLOAD_SCANNER_BACKEND
CLOUDMERSIVE_API_KEY
UPLOAD_SCANNER_TIMEOUT_MS
RESEND_API_KEY
LOADGISTIC_EMAIL_FROM
LOADGISTIC_EMAIL_REPLY_TO
# Temporary authenticated SMTP application-email pilot:
LOADGISTIC_SMTP_HOST
LOADGISTIC_SMTP_PORT
LOADGISTIC_SMTP_USER
LOADGISTIC_SMTP_PASSWORD
# Optional private fallback only:
LOADGISTIC_EMAIL_WEBHOOK_URL
LOADGISTIC_EMAIL_WEBHOOK_TOKEN
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

The current Netlify Free environment-variable model cannot narrow sensitive
Production variables below the Builds, Functions, and Runtime scopes needed by
this site. Keep them marked secret, keep Preview configuration separate, and do
not copy them into deploy logs or client-prefixed variables. Harmless public or
deployment values may retain all scopes. Reassess scope separation before
moving beyond the bounded Free-plan pilot.

Bucket identifiers are migration-owned: `shipment-proof`, `verification`,
`capacity-photo`, `payment-proof`, `provider-profile`, and
`support-attachment`. `private-upload-quarantine` is a separate server-only
staging bucket. They are private. Netlify never uses a database path or local
upload directory. Set `UPLOAD_SCANNER_BACKEND=cloudmersive`,
`CLOUDMERSIVE_API_KEY` as a server-only secret, and a bounded
`UPLOAD_SCANNER_TIMEOUT_MS` only after the privacy/vendor review. Do not set a
configuration flag that merely claims malware scans occurred; uploads stay
blocked until the scanner/quarantine adapter proves the stored object passed.
The local scanner is development/test-only. The public map values are a non-secret HTTPS tile template
and its required linked attribution. If they are absent or invalid, the bounded
beta falls back to the direct OpenStreetMap community endpoint and readiness
reports a warning. Browsers fetch tiles directly; do not add a Netlify proxy,
prefetcher, bulk copy, or self-hosted tile set. Monitor traffic and replace the
fallback with a reviewed provider before sustained use.

## Release verification

```bash
npm ci
npm run quality
npm run build
npm run test:e2e
npm audit --audit-level=high
NODE_ENV=production npm run launch:check
```

Then verify health, provider signup/login, capacity radius/route publication,
public Map and proximity, platform-managed microsite presentation and provider
contacts, Tracking creation, the stable 80-bit owner/review code formats and
session-secret-rotation independence, every valid transition, application-owned
Tracking access/completion emails and retries, the separate six-digit Shared
capacity application OTP plus expiry cleanup, review/dispute, private image
authorization, and denied cross-provider access. Supabase Auth's six-digit
account OTP is a third, independent template and delivery path.

Run the same smoke set against a Netlify Preview backed by Supabase Staging.
After approval, promote the exact commit to Production, verify the Production
URL and callback allowlists, and record the remaining Netlify/Supabase quotas.

## Repository and rollback controls

Protect `main`, require review, prevent force pushes, and require validate/E2E/container checks. Promote immutable commits/images. Roll back the application artifact first. Any data rollback or legacy-demand purge requires the verified backup and explicit approval; never delete new provider shipment, party grant, email, review, or audit history merely to restore an old UI.
