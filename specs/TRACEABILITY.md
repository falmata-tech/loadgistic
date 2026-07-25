# Specification traceability

| Feature | Frontend | Backend/domain | Deployment concern | Primary tests |
|---|---|---|---|---|
| `FEAT-IAM-001` | Login and protected navigation | Auth, session, role policy | Session secret, proxy-safe redirects | repository, E2E |
| `FEAT-APP-001` | Apply and admin review | Application provisioning | Rate limiting, audit | repository |
| `FEAT-SHP-001` | Shipments and loads | Shipment aggregate and transitions | Durable DB, audit | domain, repository, E2E |
| `FEAT-CAP-001` | Capacity UI and public listing | Status, percentage, freshness | Expiry clock and storage | domain, repository, E2E |
| `FEAT-PRV-001` | Directory, company, routes | Visibility and ownership | Public-field review | repository, E2E |
| `FEAT-TRK-001` | Tracking and proof UI | Token and file authorization | Private storage and scanning | repository |
| `FEAT-BIL-001` | Workspace/admin billing | Proof review and tenant scope | Private storage and audit | repository |

All features depend on `BASE-BE-001`; user-facing features depend on `BASE-FE-001`; runtime and release constraints derive from `BASE-DEP-001`.

Cross-feature authorization contracts are mapped in `docs/AUTHORIZATION_MATRIX.md` and verified by `tests/authorization.test.mjs`.

Playwright runs through `BrowserTestRuntime` on port `3100` with `data/test-e2e.db`; it never reuses the development server or `data/loadgistic.db`.
