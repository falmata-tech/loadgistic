# Specification traceability

| Feature | Frontend | Backend/domain | Deployment concern | Primary tests |
|---|---|---|---|---|
| `FEAT-IAM-001` | Login, protected navigation, and installable PWA shell | Auth, session, role policy, network-first authenticated pages | Session secret, proxy-safe redirects, service-worker cache boundary | repository, E2E |
| `FEAT-APP-001` | Apply and admin review | Application provisioning | Rate limiting, audit | repository |
| `FEAT-SHP-001` | Shipments, loads, visual truck choice, designated phone, and receiver contact | Shipment aggregate, staged contact disclosure, and transitions | Durable DB, audit | domain, repository, authorization, E2E |
| `FEAT-CAP-001` | Driver capacity home, truck detail, fleet roster, paired corridor cities, and Capacity Board | Duty state, authoritative vehicle rows, Empty/Partial percentage, accepted loads, obscured device area, freshness, contract lanes, proof context, relationship scope | Expiry clock, geolocation permission, private upload storage | domain, repository, authorization, E2E |
| `FEAT-PRV-001` | Authenticated transporter directory, Public Profiles, fleet roster, and phone opt in | Visibility, ownership, and vehicle-derived fleet counts | Authenticated-field review | repository, authorization, E2E |
| `FEAT-TRK-001` | Enforced tracking controls, authenticated tracking view, operational proof, and temporary load-proof sharing UI | Business-selected mode, assigned-provider obligation, obscured location events, token, file authorization, and temporary grants | Private storage, location privacy, expiry, and scanning | repository, authorization, E2E |
| `FEAT-BIL-001` | Workspace/admin billing | Proof review and tenant scope | Private storage and audit | repository |

All features depend on `BASE-BE-001`; user-facing features depend on `BASE-FE-001`; runtime and release constraints derive from `BASE-DEP-001`.

Cross-feature authorization contracts are mapped in `docs/AUTHORIZATION_MATRIX.md` and verified by `tests/authorization.test.mjs`.

Playwright runs through `BrowserTestRuntime` on port `3100` with `data/test-e2e.db`; it never reuses the development server or `data/loadgistic.db`.

The local visual audit (`npm run test:ui-audit`) covers 110 logged-out and role-scoped screens at desktop and mobile sizes, including assigned-load controls and authenticated tracking views. Its report checks response status, horizontal overflow, unlabeled controls, empty commands, and browser errors; screenshots and `report.json` are written to the ignored `artifacts/ui-audit/` directory.
