# Loadgistic mobile and monorepo readiness

Prepared 2026-09-27; implementation status updated 2026-10-06. The native Expo
application now exists under `apps/mobile`, with a Metro-dependent Android
development build and local API adapters. See [MOBILE_IMPLEMENTATION.md](MOBILE_IMPLEMENTATION.md)
for the current evidence and unfinished work. It is not yet a complete, distributed
phone APK. This document retains the planned full monorepo migration; the web
application remains at its current root with an independent dependency graph.

## Recommendation

Use Expo with React Native and development builds. Expo is tooling around React
Native, not a competing UI framework. It supports native packages, config plugins,
custom Swift/Kotlin modules and npm workspaces. Keep Next.js for the public web,
SEO, staff dashboards and existing server APIs. Retain npm initially; adding a
second package manager or task orchestrator is not required for two apps.
Pin an Expo SDK and its supported React/React Native versions together when the
native proof of concept starts. Do not copy the web app's React 19.0.0 into mobile
without checking compatibility; workspace resolution must not create duplicate
React/native module installations.

Proposed target, within the Loadgistic repository only:

```
apps/web/             Next.js UI, API adapters and server-only modules
apps/mobile/          Expo Router, native screens and device adapters
packages/domain/     pure validations, state transitions and geometry rules
packages/contracts/  versioned request/response types and runtime validation
packages/i18n/       dictionaries and pure lookup/interpolation
packages/design/     colors, spacing and icon/asset conventions
supabase/            one backend schema and migration history
scripts/             shared operations/release tooling
```

Share domain rules and data contracts first. Keep native and DOM components
separate where their behavior differs; reuse does not mean a WebView wrapper.
Do not put `server-only`, service keys, signed-cookie secrets, private storage
readers or database drivers in packages imported by mobile.

## Repository inventory and native boundaries

| Area | Current implementation | Native work / acceptance |
|---|---|---|
| Business rules | `src/lib/domain.js`, `tracking-progress.js`, `vehicle-configurations.ts` | Extract pure rules incrementally, preserving existing unit tests. |
| Localization | `src/lib/i18n/core.js`, JSON catalogs; React DOM translation wrapper | Share catalogs/lookup; native Text wrapper and persistence. Check Ethiopic fonts, long labels and user-generated text preservation. |
| Map | Leaflet/react-leaflet, DOM markers, CSS, `map-signal-offset.js`, `capacity-map-clustering.js` | Native map proof of concept must demonstrate circles, polygons, offset overlapping paths, tappable clusters, filters and correct truck selection. A package existing is not proof of feature parity. |
| Identity | `src/lib/auth.ts`, Supabase SSR cookies, Next middleware | Design bearer/mobile session adapter that verifies current actor through existing identity authority. Signed visitor web cookies do not automatically authenticate a native client. Test revocation and role/tenant boundaries. |
| API | Next route handlers backed by service-only PostgreSQL commands | Retain one backend, publish typed contracts. Native clients use authorized APIs, never service credentials or direct business-table grants. Keep browser CSRF protections while designing a bounded native auth path. |
| Brokerage | Durable messages and scoped web capability | Reuse DTOs and server commands; add native identity/push adapter later. Foreground live delivery is distinct from background notifications. |
| Location | Browser geolocation and server tracking permissions | Expo Location for foreground first. Background tracking requires explicit user permission, development builds, battery testing, OS suspension/termination behavior and store review. Never promise continuous tracking merely because the SDK supports it. |
| Documents/photos | Browser file inputs and authorized private upload/download | Camera/image picker/document picker adapters; validate size/content and authorization on the server; prove preview and retrieval on devices. |
| Notifications | No native push registration currently | Expo Notifications with per-device tokens and server-side user/request scope. Push messages contain no phone, proof or private chat body; opening reauthorizes and fetches. Define retries, opt-out and invalid-token removal. |
| Persistence | HttpOnly browser cookies and transient client state | SecureStore for native credentials; bounded non-sensitive cache. Explicit offline states and idempotent retries; do not queue an unreviewed shipment transition automatically. |
| UI/navigation | Next links, forms, dialogs, CSS, lucide-react | Expo Router/native components; device keyboard, back gesture, accessible touch targets, safe areas and deep links need device tests. |

## Ordered migration with evidence

- [x] Inventory the actual web/native boundaries and record the recommended stack.
- [ ] Stabilize and visually review the current web change set. Preserve all pre-existing work; no broad move while it is still being edited.
- [ ] In an isolated Loadgistic worktree, add npm workspaces and extract one pure package with tests while leaving web behavior unchanged.
- [ ] Move the web app to `apps/web` as one reviewed mechanical change. Update all cwd-relative paths and prove a clean install, web checks, production build and cold start.
- [ ] Add `apps/mobile` with the selected compatible Expo SDK and a development build on Android and iOS. Start with transporter login, capacity/map and tracking status as vertical slices; scope other roles deliberately.
- [ ] Prove native maps/geometry parity, authenticated API access, localization and document upload/download before committing to the full screen migration.
- [ ] Add notifications, foreground/background location and offline recovery only with explicit behavior and permission contracts.
- [ ] Add independent web/mobile CI gates, app identifiers, signing ownership, privacy disclosures and store release workflows. No signing/provider changes are authorized by this preparation plan.

Every step keeps web deployability and security boundaries testable. Roll back a
packaging change by reverting code layout; retain database/history. Never mix a
monorepo move with a production schema migration or new native tracking policy.

## Release paths that need adjustment when web moves

Current `Dockerfile` copies root package manifests, `public`, `.next/standalone`
and `.next/static`; its runner assumes `server.js` at the working root.
`next.config.mjs` imports `./src/lib/security-headers.js` and uses standalone output.
`netlify.toml` runs root `npm run build`; Netlify functions live in `netlify/functions`.
CI, Playwright, `scripts/run-next-build.mjs`, fixture/SQL scripts, resource imports,
TypeScript aliases, source/spec checks and environment loaders assume the current
root. Review standalone tracing roots and packaged workspace files explicitly.
NR-11 already records a production failure caused by workspace/bundle assumptions;
a passing source build alone must not certify the moved deploy artifact.

## Official references checked for this plan

- [Expo monorepos](https://docs.expo.dev/guides/monorepos/): workspace/Metro setup and duplicate dependency considerations.
- [Custom native code](https://docs.expo.dev/workflow/customizing/): development builds and config plugins.
- [React Native maps](https://docs.expo.dev/versions/latest/sdk/map-view/): initial native map candidate, subject to the geometry proof above.
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/): background limitations and permissions.
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/): device/build requirements.
- [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): platform storage behavior; recovery must not assume credentials survive every uninstall/restore.

No dependencies installed, files relocated, mobile build claimed or hosted settings changed by this readiness document.
