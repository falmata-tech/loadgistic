# Local Setup

## Requirements

- Node.js 22.5+
- npm 10+

## Steps

```bash
nvm use
cp .env.example .env.local
npm install
npm run db:reset
npm run places:setup
npm run dev
```

Open `http://127.0.0.1:3000`.

The app creates `data/loadgistic.db` and local upload files under `data/uploads/`. `npm run places:setup` downloads and imports the local Ethiopia OpenStreetMap settlement catalog; the app retains a built-in fallback when that optional network step is unavailable.

Development writes generated Next.js files to `.next-dev`, while `npm run build` writes to `.next`. This keeps an always-on local dev server healthy while a production build runs.

## Local fixture accounts

The deterministic development and test database includes the following active accounts. These credentials are developer fixtures only and are intentionally not shown in the public application UI.

All accounts use the local password `Loadgistic123!`.

| Workspace | Email |
|---|---|
| Business looking for capacity | `shipper@loadgistic.local` |
| Business receiving shipments | `receiver@loadgistic.local` |
| Fleet Transporter | `transporter@loadgistic.local` |
| Fleet company Driver | `company-driver@loadgistic.local` |
| Self-managed Driver / Owner-Operator | `driver@loadgistic.local` |
| Platform Administrator | `admin@loadgistic.local` |

## Reset

```bash
npm run db:reset
```

## Comprehensive UI and workflow data

`npm run db:stress` replaces the configured local database with a deterministic
dataset containing more than 8,000 related rows. It covers all application
tables and material states, including 80 Businesses, 20 six-truck fleets, their
company Drivers, 40 self-managed Drivers, applicant accounts, loads, tracking
events, capacity history, relationships, verification requests, billing
evidence, ratings, notifications, and audit records.

Generated accounts use the same development-only password documented above.
Representative emails include:

| Workspace | Email |
|---|---|
| Generated Business | `business-001@stress.loadgistic.local` |
| Generated Fleet Transporter | `fleet-001@stress.loadgistic.local` |
| Generated company Driver | `fleet-001-driver-1@stress.loadgistic.local` |
| Generated Self-managed Driver | `driver-001@stress.loadgistic.local` |
| Generated Administrator | `admin-01@stress.loadgistic.local` |

The command is destructive to the configured local database and refuses to run
with `NODE_ENV=production`. Set `STRESS_SCALE` from 1 through 5 to increase the
profile, for example `STRESS_SCALE=2 npm run db:stress`. Run `npm run db:reset`
to restore the small fixture.

## Troubleshooting

- `node:sqlite` missing: update Node.js to 22.5 or newer.
- Session errors: set a long random `SESSION_SECRET` in `.env.local`.
- No company data: run `npm run db:reset`.
- Few place suggestions: run `npm run places:setup`.
- Browserbase missing: leave `BROWSERBASE_ENABLED=false` for normal local development.
