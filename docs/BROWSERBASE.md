# Browserbase and Playwright

Local E2E tests use Playwright and `playwright.config.ts`.

Browserbase is optional and must not block local development.

Environment variables:

```bash
BROWSERBASE_ENABLED=true
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
BROWSERBASE_REGION=us-west-2
```

Run:

```bash
npm run test:e2e
npm run test:e2e:browserbase
```

The project uses stable labels and route names so an AI agent can log in, create a shipment, find a load, publish capacity, update a parcel status, and review an application.
