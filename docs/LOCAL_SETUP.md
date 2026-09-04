# Local setup

## Requirements and start

```bash
nvm use
cp .env.example .env.local
npm install
npm run supabase:start
npm run supabase:local:configure
npm run dev
```

Open `http://127.0.0.1:3100`. Development uses `.next-dev`; production builds use `.next`. Loadgistic reserves port `3100` so it does not collide with the separate MirtPage workspace on port `3000`. The configurator selects the isolated local Supabase PostgreSQL/Auth/Storage stack and writes ignored local credentials without printing them.

Local Supabase Auth login and signup codes are delivered to the isolated Mailpit
inbox at `http://127.0.0.1:55324`; they are not sent to Gmail. That account OTP
does not authorize guest product features. Shared capacity uses a separate
six-digit, ten-minute, single-use application OTP and creates no Auth account.
The local configurator connects that application-email port to the same
loopback-only Mailpit inbox, so Shared capacity and Tracking messages are
actually captured there without contacting a real recipient. Tracking is
deliberately not an OTP-request flow: a provider creates one stable 80-bit
customer-owner code and a separate review code, delivered through
Tracking-specific templates. Shared capacity and Tracking both use the
application-email adapter rather than Supabase Auth SMTP.
Fixture-password login remains available only when the explicit non-Production
fixture flag is enabled. Preview and Production expose only Google and numeric
email-code authentication for member accounts.

Local Google login uses a separate Google **Web application** client. Copy
`supabase/google-oauth.env.example` to the ignored
`.local/google-oauth.env`, make the copy readable only by the current user, and
enter the Local Development client ID and secret there. The local Google client
uses `http://127.0.0.1:3100` as its default authorized JavaScript origin. Add
both `http://127.0.0.1:3001` and `http://localhost:3001` to the same local client
when intentionally running the app on port `3001`; the browser callback preserves
the exact host used to open the app, while both origins return through
`http://127.0.0.1:55321/auth/v1/callback` as its authorized redirect URI.
Restart with `supabase stop` followed by `npm run supabase:start`. The starter
never prints either value. When the ignored file is absent, Supabase still
starts for deterministic email-code and fixture testing, but Google login is
truthfully unavailable.

A 2026-09-02 diagnostic run on port `3001` verified both member-login and
provider-signup numeric-code requests against Mailpit without reading or
printing message content or codes. It also verified that local Google login and
signup load the configured client, use PKCE and minimum identity scopes, and
preserve either supported browser host through `/api/auth/callback`.

All maps use the shared tile configuration. Leaving
`NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` blank uses the
direct attributed OpenStreetMap community endpoint. A custom source must be a
single HTTPS template containing `{z}`, `{x}`, and `{y}` (not `{s}`) plus
linked provider attribution. Invalid pairs fail back to the direct community
endpoint. Tiles are requested by the browser; the application never proxies,
prefetches, or copies them.

`npm run db:reset` aliases the same guarded Supabase configuration workflow. `npm run supabase:local:configure` refuses remote hosts and Production, imports the bundled Ethiopia place catalog, clears the isolated local project, and creates a supply-first market with:

- 30 published provider pages;
- nine fleet companies and 21 self-managed provider profiles;
- 143 active current-capacity signals;
- exactly one regular Service area or Capacity route for each of the 30 published providers in the standard fixture;
- no Business/capacity-seeker accounts, shipment-demand rows, network relationships, or Business reviews.

## Base provider fixtures

Credentials are local-only and never rendered in the public application.

| Workspace | Email |
|---|---|
| Fleet owner | `transporter@loadgistic.local` |
| Fleet company Driver | `company-driver@loadgistic.local` |
| Self-managed Driver / owner-operator | `driver@loadgistic.local` |
| Support agent | `support@loadgistic.local` |
| Platform administrator | `admin@loadgistic.local` |

Use the development password stored in the local seed-credentials file. Generated public-market provider accounts use deterministic `@providers.loadgistic.test` addresses and are fixtures, not customer data.

## Supabase cutover stack

The isolated Supabase CLI stack uses ports `55320`–`55324`. After a local `supabase db reset`, run `npm run supabase:local:configure`; it replays the complete `001`–`069` chain, refreshes the current Ethiopia Featured fixture, imports the market, and verifies identity, public projections, Shared capacity targeted/recovery delivery and retention, provider Capacity, provider-owned Tracking, customer-safe completion email data, signup, Storage, request limits, Fleet, Verification/Billing, Support, and platform administration. Lower-level verification scripts remain available for CI. Every configurator and importer refuses remote Supabase hosts and fixture reset is rejected in Production. Do not paste keys into tracked files or shell history. See `docs/SUPABASE_MIGRATION.md` for the guarded workflow and hosted rollout boundary.

## Useful checks

```bash
npm run quality
npm run build
npm run test:e2e
```

Run `npm run test:ui-audit` only after explicit approval and while the development server is running.

## Troubleshooting

- Supabase CLI cannot start: confirm Docker is running. The verified clean replay
  used the official `2.116.0` CLI; if a global launcher is missing its companion
  binary, reinstall it or invoke that pinned CLI through `npm exec`.
- Session failures: set a long random `SESSION_SECRET` in `.env.local`. The same
  secret authenticates local Netlify scheduled-to-background worker calls; it
  must never equal `TRACKING_CODE_SECRET`.
- Production-style Tracking code checks: set a separate long random
  `TRACKING_CODE_SECRET`. Local development alone has a deterministic fallback;
  changing `SESSION_SECRET` must not change an existing Tracking owner or review
  code. After changing from the former session-derived local codes, run
  `npm run db:reset` to rebuild disposable Tracking fixtures with the new digest.
- Empty/stale local market: run `npm run db:reset`; it refreshes only the isolated loopback Supabase project.
- Map remains blank: confirm the response CSP names the exact configured tile origin, verify the URL/linked-attribution pair, and inspect browser tile errors.
- Tracking or Shared capacity email remains queued locally: rerun
  `npm run supabase:local:configure` and restart the development server. The
  configurator writes the ignored loopback Mailpit URL; it does not reuse or
  expose Supabase Auth SMTP credentials. A manually unconfigured development
  environment may still show an eligible recipient a labelled local test code,
  but the standard isolated setup sends the message to Mailpit. The email must
  first have an active truck share in the provider Network.
- Production email remains queued: configure the preferred `RESEND_API_KEY` and
  `LOADGISTIC_EMAIL_FROM`, all four `LOADGISTIC_SMTP_*` pilot values plus the
  From address, or the optional HTTPS webhook adapter. Production ignores the
  local Mailpit variable, never returns OTP plaintext to the browser, and fails
  closed when its managed adapter is absent or incomplete.
