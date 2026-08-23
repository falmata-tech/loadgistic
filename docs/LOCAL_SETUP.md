# Local setup

## Requirements and start

```bash
nvm use
cp .env.example .env.local
npm install
npm run db:reset
npm run dev
```

Open `http://127.0.0.1:3000`. Development uses `.next-dev`; production builds use `.next`. SQLite and private uploads live under ignored `data/` paths.

`npm run db:reset` is destructive only to the configured local SQLite database and is denied in Production. It imports the bundled Ethiopia place catalog, purges obsolete fake demand fixtures, and creates a supply-first market with:

- 30 published provider pages;
- nine fleet companies and 21 self-managed provider profiles;
- 47 active current-capacity signals;
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
- Empty/stale local market: run `npm run db:reset` only if replacing the local database is intended.
- Map remains blank: confirm the response CSP allows both `tile.openstreetmap.org` and its subdomains, and inspect browser console tile errors.
- Completion email remains queued: configure `LOADGISTIC_EMAIL_WEBHOOK_URL`; an unconfigured adapter does not pretend delivery succeeded.
- Shared capacity access in local development shows an eligible recipient a clearly labeled local test code when `LOADGISTIC_EMAIL_WEBHOOK_URL` is absent. Production never returns OTP plaintext to the browser. The email must first have an active truck share in the provider Network.
