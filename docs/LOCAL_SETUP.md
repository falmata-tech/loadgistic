# Local Setup

## Requirements

- Node.js 22.5+
- npm 10+

## Steps

```bash
cp .env.example .env.local
npm install
npm run db:reset
npm run dev
```

Open `http://127.0.0.1:3000`.

The app creates `data/loadgistic.db` and local upload files under `data/uploads/`.

## Reset

```bash
npm run db:reset
```

## Troubleshooting

- `node:sqlite` missing: update Node.js to 22.5 or newer.
- Session errors: set a long random `SESSION_SECRET` in `.env.local`.
- No company data: run `npm run db:reset`.
- Browserbase missing: leave `BROWSERBASE_ENABLED=false` for normal local development.
