# Netlify and Supabase handoff

This is a credential-free owner handoff. Never put real secrets, customer data, tracking codes, or private files in this document, commits, screenshots, or chat logs.

## Release boundary

The owner selected Netlify Free for the initial commercial pilot and Supabase
Free for managed Postgres, Auth, private Storage, and bounded Realtime. The same
commit must continue to produce the standalone Docker artifact for CI parity and
a portable fallback; Netlify runs the maintained OpenNext adapter rather than
the Docker image.

The application is still approved only for local validation and controlled
demonstration. Public production remains blocked until the managed
identity/repository, email, rate-limit, upload-scanning, backup,
and monitoring gates in `docs/LAUNCH_READINESS.md` pass.
Managed public discovery, Shared capacity, provider Capacity, provider-owned
Tracking, transporter-profile editing, and managed provider signup already run through Supabase when the
managed backends are selected; remaining fleet, verification, billing, Support, and administration
paths must complete the same cutover before the Production flag is enabled.

## Provisioned control plane — 2026-08-17

- Netlify Free team: `loadgistic` (`falmatad97`)
- Netlify site: `loadgistic` (`88fc3f4f-5bf4-479e-a4a3-08ab14a75111`)
- Reserved URL: `https://loadgistic.netlify.app`
- Local repository link: `.netlify/state.json` (ignored by Git)
- Configured non-secret Netlify values: `APP_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No deploy or Git continuous-deployment hook has been created. The service-role
key is not configured. `AUTH_BACKEND`, `DATA_BACKEND`, and
`PRIVATE_STORAGE_BACKEND` have not been switched to Supabase because the role
projection, repository parity, and upload-scanning gates below remain red.

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
   `049_managed_provider_profile.sql` in numeric order.
3. Run SQL lint and review every RLS policy/default-deny private table.
4. Import the reviewed place catalog with `npm run places:import:supabase` from a trusted operator machine.
5. Confirm every purpose bucket plus the private `private-upload-quarantine` bucket, then configure and prove the managed scanner before serving uploads.
6. Implement and parity-test the Supabase repository/managed Auth adapters.
7. Inventory any old cloud demand data. Purge only after explicit approval and a verified backup; record exact before/after counts privately.

The service-role key is server-only and never uses a `NEXT_PUBLIC_` name. Browser code receives only explicit safe projections or authorized short-lived file access.

## Managed service configuration

Netlify detects the Next.js App Router and provisions its maintained OpenNext
adapter. `netlify.toml` fixes Node 22 and the repository build command. Do not
pin the adapter plugin. Connect the GitHub Production branch only after its
required CI checks pass; keep automatic Production publishing disabled until
the release gate is green.

Supabase Auth owns transporter identity, Google OAuth, numeric email-code login and signup,
and browser sessions. The browser/server SSR clients, PKCE callback exchange,
conditional request-cookie refresh boundary, active-role projection, and
Production-disabled fixture-password boundary are present behind
`AUTH_BACKEND=supabase`. Managed provider onboarding now provisions an inactive
Auth subject, collects the short provider profile after Google or email-code
identity proof, and then provisions the matching provider workspace, draft page,
signup record, seven-day trial, and active role projection atomically. It still requires the
hosted Google, callback, and SMTP configuration below before public enablement.
The default Supabase SMTP service is demonstration-only and cannot deliver a
public launch. Configure one verified sending domain through Resend Free (3,000
messages per month and 100 per day) for Supabase Auth SMTP and the Loadgistic
direct email adapter. Netlify invokes bounded delivery retries and guest cleanup
every 15 minutes in UTC; monitor the daily email and function-credit ceilings.
Cloudflare Turnstile may provide the no-cost bot challenge, while the
shared enforcement counters remain transactional Supabase records rather than
process-local memory.

Configure Preview and Production independently:

1. Set Supabase **Site URL** to that environment's `APP_URL` origin.
2. Add the exact `<APP_URL>/api/auth/callback` to Supabase **Redirect URLs**.
   Preview and Production use separate exact entries; do not add a wildcard
   callback or a visitor-controlled `next` destination.
3. Enable Google in Supabase Auth, then configure the Google OAuth client with
   the Supabase provider callback shown by the dashboard. Loadgistic requests
   only `openid email profile`.
4. Change the Supabase sign-in email template to display the numeric
   `{{ .Token }}` value rather than a magic-link-only `{{ .ConfirmationURL }}`.
   Set the code to six digits and ten minutes to match the reviewed local configuration.
5. Configure verified custom SMTP and test delivery, expiry, retry, unknown
   addresses, and rate limiting before enabling public login.
6. Keep `ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN` unset in Preview and Production.

Use Node 22.x and configure Preview/Production independently:

```text
APP_URL
SESSION_SECRET
DATA_BACKEND
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_MAP_TILE_URL
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
SUPABASE_SERVICE_ROLE_KEY
AUTH_BACKEND
ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN
PRIVATE_STORAGE_BACKEND
UPLOAD_SCANNER_BACKEND
CLOUDMERSIVE_API_KEY
UPLOAD_SCANNER_TIMEOUT_MS
RESEND_API_KEY
LOADGISTIC_EMAIL_FROM
LOADGISTIC_EMAIL_REPLY_TO
# Optional private fallback only:
LOADGISTIC_EMAIL_WEBHOOK_URL
LOADGISTIC_EMAIL_WEBHOOK_TOKEN
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

Bucket identifiers are migration-owned: `shipment-proof`, `verification`,
`capacity-photo`, `payment-proof`, `provider-profile`, and
`support-attachment`. `private-upload-quarantine` is a separate server-only
staging bucket. They are private. `DATABASE_PATH` and
`PRIVATE_UPLOAD_DIR` are local/Docker-only and must never be used for durable
Netlify data. Set `UPLOAD_SCANNER_BACKEND=cloudmersive`,
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

Then verify health, provider signup/login, capacity radius/route publication, public list/map and proximity, platform-managed microsite presentation and provider contacts, Tracking creation, the stable owner code/link, every valid transition, access/completion emails and retries, expiry cleanup, review/dispute, private image authorization, and denied cross-provider access.

Run the same smoke set against a Netlify Preview backed by Supabase Staging.
After approval, promote the exact commit to Production, verify the Production
URL and callback allowlists, and record the remaining Netlify/Supabase quotas.

## Repository and rollback controls

Protect `main`, require review, prevent force pushes, and require validate/E2E/container checks. Promote immutable commits/images. Roll back the application artifact first. Any data rollback or legacy-demand purge requires the verified backup and explicit approval; never delete new provider shipment, party grant, email, review, or audit history merely to restore an old UI.
