# Local setup

## Requirements and start

```bash
nvm use
cp .env.example .env.local
npm install
npx supabase start
npm run supabase:local:configure
npm run dev
```

Open `http://127.0.0.1:3100`. Development uses `.next-dev`; production builds use `.next`. Loadgistic reserves port `3100` so it does not collide with the separate MirtPage workspace on port `3000`. The configurator selects the isolated local Supabase PostgreSQL/Auth/Storage stack and writes ignored local credentials without printing them.

Local email codes are delivered to the isolated Mailpit inbox at `http://127.0.0.1:55324`; they are not sent to Gmail. Fixture-password login remains available only when the explicit non-Production fixture flag is enabled. Preview and Production expose only Google and numeric email-code authentication.

All maps use the shared tile configuration. Leaving
`NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` blank uses the
direct attributed OpenStreetMap community endpoint. A custom source must be a
single HTTPS template containing `{z}`, `{x}`, and `{y}` (not `{s}`) plus
linked provider attribution. Invalid pairs fail back to the direct community
endpoint. Tiles are requested by the browser; the application never proxies,
prefetches, or copies them.

`npm run db:reset` is a compatibility-only SQLite reset and is not the normal application setup. `npm run supabase:local:configure` refuses remote hosts, imports the bundled Ethiopia place catalog, purges obsolete fake demand fixtures, and creates a supply-first local Supabase market with:

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

The isolated Supabase CLI stack uses ports `55320`–`55324`. After a local `supabase db reset`, run `npm run supabase:local:configure`; it refreshes the current Ethiopia Featured fixture, imports the market, and verifies identity, public projections, Shared capacity, provider Capacity, provider-owned Tracking, customer-safe completion email data, and managed signup with SQLite disabled. Lower-level verification scripts remain available for CI. Every configurator and importer refuses remote Supabase hosts. Do not paste keys into tracked files or shell history. See `docs/SUPABASE_MIGRATION.md` for the exact guarded workflow and remaining cutover boundary.

## Useful checks

```bash
npm run quality
npm run build
npm run test:e2e
```

Run `npm run test:ui-audit` only after explicit approval and while the development server is running.

## Troubleshooting

- Missing `node:sqlite`: use the Node version in `.nvmrc`.
- Session failures: set a long random `SESSION_SECRET` in `.env.local`.
- Empty/stale local market: reset the isolated local Supabase database and rerun `npm run supabase:local:configure`; `npm run db:reset` is only the retired SQLite compatibility fixture.
- Map remains blank: confirm the response CSP names the exact configured tile origin, verify the URL/linked-attribution pair, and inspect browser tile errors.
- Completion email remains queued: configure `RESEND_API_KEY` and `LOADGISTIC_EMAIL_FROM`, or the optional HTTPS webhook adapter; an unconfigured adapter does not pretend delivery succeeded.
- Shared capacity access in local development shows an eligible recipient a clearly labeled local test code when no managed email provider is configured. Production never returns OTP plaintext to the browser. The email must first have an active truck share in the provider Network.
