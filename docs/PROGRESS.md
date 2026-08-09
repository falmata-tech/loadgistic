# Progress

## Current verified product

- Canonical homepage Capacity Board with bounded cursor loading, an Ethiopia-bounded primary Map and secondary List, a compact over-map search and modal filters, an always-visible compact map key, hover/focus-only pointed summaries above markers, an immediate privacy-preserving visitor-location request with manual retry, regional visitor-centered bounds, pre-selection clustering, realistic cargo-configuration images inside pointed map pins, green Empty and bright-yellow Partial labels, a green-to-red circular available-space meter visible before selection, isolated selected-truck focus without a redundant permanent label, a responsive non-scrolling information card with an explicit × close control, a separate Driver-accuracy approximate-location circle, and selected-only current radius/corridor plus regular-corridor overlays. The secondary List uses two balanced cards per row on desktop and one on mobile, with both two-way regular corridors always visible as `Place A ↔ Place B`. `/capacity` is compatibility-only.
- Busy deterministic supply market: 30 published providers, comprising nine fleet companies and 21 self-managed provider profiles, with 47 active trucks and exactly two regular corridors per provider.
- Provider Directory plus Loadgistic-presented `/@handle` microsites with platform-controlled colors/media, provider-managed business facts and independently visible contacts, fleet/capacity, colorful verification badges, and provider reviews.
- Fleet-owner and self-managed provider workspaces for trucks, current radius/corridor capacity, up to two regular corridors, profile editing, verification, billing, and support. Driver navigation includes the same Map-first public Capacity market inside the dashboard and a direct Exit dashboard action back to the public market.
- Unified capacity console with Empty or Partial radius/corridor choice, Off Duty, a collapsed map-centered summary for current capacity, regular corridors, and approximate current location; a high-contrast labeled truck-area marker; focused editors for each stored item; an immediate and then visibility-gated 10-minute automatic Driver location refresh plus direct approximate-radius and refresh controls; and no future-trip, regular-area, detached planning, Busy, contract, partner, or dated immediate-signal state.
- Provider-owned Tracking created after offline agreement by an owner, self-managed Driver, or assigned company Driver, with one customer-owner email/code/link, one ordered status action panel, optional images only at Loading/Unloading/Issue, 30-day guest access after completion, provider history retention, and idempotent access/completion email delivery.
- All-score provider reviews from the emailed customer owner; one- to three-star provider disputes remain visible and counted pending review.
- Evidence-specific National ID, Business License, Business Address, Driver License, and pairing-specific expiring truck-authorization review with vivid category colors and persistent due-diligence warnings.
- Provider-only signup and authenticated roles. Capacity-seeker signup, public Business profiles, Shipment Board, demand posting, interests, Direct requests, pooled/along-route demand, and member network are retired and blocked or redirected.
- Local deterministic migration purges fake legacy demand records, Business workspaces, relationships, favorites, and Business reviews while retaining provider supply and provider-owned operational history.
- Supporting homepage and About story centered on manufacturers, workshops, growers, producers, owner-operators, self-managed Drivers, and small fleets without displacing the complete Capacity Board.

## Verification evidence — August 2026

- `npm run check`: specification and source validation passed.
- `npm run quality`: specification/source checks, 39 automated tests, and TypeScript passed.
- `npm run build`: optimized Next.js production build passed.
- `npm run test:e2e`: 22 desktop/mobile workflows passed, including Map-first entry, automatic visitor location with regional centering and denial/retry, reliable close-zoom separation of overlapping trucks, a responsive non-scrolling selected card, responsive List columns with always-visible two-way regular corridors, stable owner Tracking access, the restored ordered status panel, the unified capacity summary with a focused maximum-two regular-corridor editor, direct Driver location controls, and platform-managed microsite presentation.
- `npm run test:ui-audit`: 82 current desktop/mobile screens passed with zero automated layout/accessibility flags and zero browser-flow errors across public, fleet-owner, self-managed Driver, company Driver, administrator, and support-agent views.
- Automated browser verification and visual capture covered the map key, vehicle-image markers, selected approximate-location/current/two-way-regular-corridor layers, overlapping-truck separation, responsive detail and List cards, cluster restoration, the capacity summary, Tracking, and provider presentation.
- Production and development dependency audit previously reported zero vulnerabilities; dependency state was not changed by this feature.

## Production work still required

- The running application still uses the Node SQLite repository. `DATA_BACKEND=supabase` is not implemented; production launch remains blocked until a managed PostgreSQL/Supabase repository and managed identity adapter pass parity tests.
- Apply and validate the cloud migrations only after a backup and explicit rollout approval. The legacy-demand purge is destructive by design.
- Configure `LOADGISTIC_EMAIL_WEBHOOK_URL` and optional webhook token, then verify retry, failure, and idempotency behavior against the selected managed email provider.
- Select a production map-tile provider with an appropriate usage policy/SLA; the local/current implementation uses public OpenStreetMap tiles with attribution.
- Add shared rate limiting, uploaded-file malware scanning/quarantine, backup/restore evidence, monitoring, and a tested rollback.
- Enable protected remote checks and deployment approvals. No production rollout or remote push is part of this commit.
