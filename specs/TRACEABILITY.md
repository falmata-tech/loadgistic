# Feature and verification index

Use this index to find a contract, then read only its relevant implementation and
tests. [PROGRESS](../docs/PROGRESS.md) owns the active checklist and current release
state; the [product brief](../docs/PRODUCT_MASTER_PROMPT.md) owns product narrative.
The [preserved detailed record](../docs/TRACEABILITY_HISTORY_20261020.md) retains all
previous evidence, dates and limitations. Its older “pending” or “passed” statements
are historical, not the status of today's source or hosted release.

## Current audit evidence

- October20 delivery-tooling changes (BASE-DEP-001):
  [`check-workflow.mjs`](../scripts/check-workflow.mjs) and
  [`workflow-quality.test.mjs`](../tests/workflow-quality.test.mjs) add a pinned,
  parse-only early gate. 40 focused tooling/runner cases pass; lint with ShellCheck
  and104 script parses takes7.317s locally. Four repo skills validate and are
  independently discovered; selection/token savings are not proven.
- Exact Tracking fixture cleanup:
  [`tracking-proof-cleanup.mjs`](../tests/e2e/tracking-proof-cleanup.mjs) and
  [negative tests](../tests/tracking-proof-cleanup.test.mjs) pass five cases.
  Six desktop/phone Tracking browser cases pass real progress, completion and
  authorized proof-byte workflows with exact cleanup. Two workspace captures
  separately pass after destination-completion waits, with unchanged case budgets.
- FEAT-UIX-001 Featured shell sizing: original desktop/phone overflow assertions
  exposed a real height bug. The narrow existing-flex-shell fix passes both
  captures in21.623s; the owner explicitly approved the corrected fit. The changed
  stylesheet requires a matching web package; it is not a test-only change.
- Semantic source review is complete for114 E2E,93 mobile-group,172 root-unit
  and97 SQL files. Consolidated focused verification passes: seven local SQL
  checks (including30 older cleanup jobs) preserve checked public/Auth table rows;
  sequences are not fingerprinted. Existing managed-fixture preconditions remain.
  The repaired unit batch passes106 cases. The locationSource return-bookmark
  regression is red before the one-key allowlist fix and12 navigation cases
  pass after it, retaining credential/unknown-key denial. Actual desktop/phone
  Chrome round trips also pass2/2 in35.6s. Historical migration
  tests label their limits; upload fixtures assert canonical vehicle RPC fields. Per-file receipts
  and bounded reports: `.local/test-audit-20261020/`. These local results do not
  certify CI, native capability or hosted publication. Complete local quality
  now passes1028 tests (zero failure/skip), source/spec/workflow checks and types.

- GitHub workflow review (BASE-DEP-001):
  [current conventions and catch-up plan](../docs/operations/GITHUB_WORKFLOW.md)
  distinguish the observed unprotected main branch and101-commit mobile branch
  from proposed provider controls. The fourth repo skill is independently
  discovered. No merge, provider-settings write, third-party skill installation
  or new hosted deployment is claimed.

## Contracts and test ownership

The links below are representative actual files named by each spec, not a claim
of exhaustive runtime coverage. Each spec owns its complete acceptance scenarios,
permissions and named test matrix. Retired-feature specs/tests deliberately prove
absence, denial or retained history; they do not advertise an active service.
Use the historical record only for a dated result or decision provenance.

| Contract | Area | Implementation / representative tests |
| --- | --- | --- |
| [FEAT-ADM-001](features/FEAT-ADM-001.md) | Focused platform operations and review center | [src/lib/platform-admin.js](../src/lib/platform-admin.js); [tests/e2e/operations-connected-actions.spec.ts](../tests/e2e/operations-connected-actions.spec.ts); [tests/e2e/staff-admin-account.spec.ts](../tests/e2e/staff-admin-account.spec.ts) |
| [FEAT-APP-001](features/FEAT-APP-001.md) | Immediate transport-provider signup | [tests/business-workspace-ui.test.mjs](../tests/business-workspace-ui.test.mjs) |
| [FEAT-BIL-001](features/FEAT-BIL-001.md) | Provider access without plans or platform payments | [tests/provider-access-without-plans.test.mjs](../tests/provider-access-without-plans.test.mjs); [tests/sql/provider-billing-retired.sql](../tests/sql/provider-billing-retired.sql) |
| [FEAT-CAL-001](features/FEAT-CAL-001.md) | Week-first date selection | [tests/date-calendar.test.mjs](../tests/date-calendar.test.mjs) |
| [FEAT-CAP-001](features/FEAT-CAP-001.md) | Public truck-capacity signals and provider publication | [tests/e2e/public-map-shell-layout.spec.ts](../tests/e2e/public-map-shell-layout.spec.ts); [tests/capacity-filter-http.test.mjs](../tests/capacity-filter-http.test.mjs) |
| [FEAT-DAT-001](features/FEAT-DAT-001.md) | Supply-first local development dataset | [src/lib/capacity-market.js](../src/lib/capacity-market.js); [tests/capacity-market.test.mjs](../tests/capacity-market.test.mjs); [tests/supabase-fixtures.test.mjs](../tests/supabase-fixtures.test.mjs) |
| [FEAT-ENT-001](features/FEAT-ENT-001.md) | Business workspaces for shared capacity and shipment coordination | [tests/business-directory.test.mjs](../tests/business-directory.test.mjs); [tests/sql/business-directory-verification.sql](../tests/sql/business-directory-verification.sql) |
| [FEAT-FLT-001](features/FEAT-FLT-001.md) | Fleet driver access and owner controls | [tests/sql/personal-fleet-capacity-sharing.sql](../tests/sql/personal-fleet-capacity-sharing.sql); [tests/sql/provider-authority-rollback-denial.sql](../tests/sql/provider-authority-rollback-denial.sql) |
| [FEAT-FTR-001](features/FEAT-FTR-001.md) | Daily Featured Trucks programme | [tests/featured-candidate-reads.test.mjs](../tests/featured-candidate-reads.test.mjs); [tests/sql/featured-random-rounds.sql](../tests/sql/featured-random-rounds.sql) |
| [FEAT-GEO-001](features/FEAT-GEO-001.md) | Privacy-aware public capacity geography | See named ownership in the spec. |
| [FEAT-GPS-001](features/FEAT-GPS-001.md) | Provider fleet devices and attributed truck locations | [tests/sql/telematics.sql](../tests/sql/telematics.sql); [tests/sql/telematics-account-privacy.sql](../tests/sql/telematics-account-privacy.sql) |
| [FEAT-GST-001](features/FEAT-GST-001.md) | Retained guest support history | [tests/platform-brokerage-retirement.test.mjs](../tests/platform-brokerage-retirement.test.mjs); [tests/sql/platform-brokerage-retirement.sql](../tests/sql/platform-brokerage-retirement.sql) |
| [FEAT-IAM-001](features/FEAT-IAM-001.md) | Identity, sessions, and role access | [src/app/login/page.tsx](../src/app/login/page.tsx); [tests/provider-public-account-identity.test.mjs](../tests/provider-public-account-identity.test.mjs); [tests/sql/provider-public-account-identity.sql](../tests/sql/provider-public-account-identity.sql) |
| [FEAT-LNG-001](features/FEAT-LNG-001.md) | Plain-language interface localization | [tests/localization.test.mjs](../tests/localization.test.mjs); [tests/e2e/localization.spec.ts](../tests/e2e/localization.spec.ts) |
| [FEAT-LST-001](features/FEAT-LST-001.md) | Bounded map loading and operational list navigation | [tests/sql/support-history.sql](../tests/sql/support-history.sql); [tests/support-history.test.mjs](../tests/support-history.test.mjs) |
| [FEAT-LUX-001](features/FEAT-LUX-001.md) | Clear launch journeys and contextual language | [tests/browser-request.test.mjs](../tests/browser-request.test.mjs); [tests/provider-shipment-response.test.mjs](../tests/provider-shipment-response.test.mjs) |
| [FEAT-MAT-001](features/FEAT-MAT-001.md) | Coordinate-authoritative marketplace matching | [tests/audit-geographic-matching.test.mjs](../tests/audit-geographic-matching.test.mjs); [tests/capacity-filter-places.test.mjs](../tests/capacity-filter-places.test.mjs) |
| [FEAT-MKT-001](features/FEAT-MKT-001.md) | Frictionless public capacity marketplace | [tests/transporter-search.test.mjs](../tests/transporter-search.test.mjs); [tests/transporter-search-web.test.mjs](../tests/transporter-search-web.test.mjs) |
| [FEAT-MOB-001](features/FEAT-MOB-001.md) | Native transporter and visitor application | [tests/e2e/mobile-review-navigation.spec.ts](../tests/e2e/mobile-review-navigation.spec.ts); [apps/mobile/tests/account-session.test.mjs](../apps/mobile/tests/account-session.test.mjs) |
| [FEAT-NET-001](features/FEAT-NET-001.md) | Retired demand-side member network | See named ownership in the spec. |
| [FEAT-NOT-001](features/FEAT-NOT-001.md) | Chat and driver handover alerts with visible-message read receipts | [tests/sql/business-native-push.sql](../tests/sql/business-native-push.sql); [tests/chat-read-alerts.test.mjs](../tests/chat-read-alerts.test.mjs) |
| [FEAT-PLC-001](features/FEAT-PLC-001.md) | Local Ethiopia place catalog | [src/lib/place-search.js](../src/lib/place-search.js); [tests/supabase-repository.test.mjs](../tests/supabase-repository.test.mjs); [tests/e2e/smoke.spec.ts](../tests/e2e/smoke.spec.ts) |
| [FEAT-PLY-001](features/FEAT-PLY-001.md) | Play policy workflows and review readiness | [apps/mobile/scripts/verify-android-permissions.mjs](../apps/mobile/scripts/verify-android-permissions.mjs); [tests/sql/provider-fleet-erasure.sql](../tests/sql/provider-fleet-erasure.sql); [tests/sql/provider-authority-erasure.sql](../tests/sql/provider-authority-erasure.sql) |
| [FEAT-PRV-001](features/FEAT-PRV-001.md) | Truck-linked public transporter microsites | [tests/public-provider-paging.test.mjs](../tests/public-provider-paging.test.mjs); [tests/sql/public-provider-paging.sql](../tests/sql/public-provider-paging.sql) |
| [FEAT-PST-001](features/FEAT-PST-001.md) | Retired shared-demand discovery | See named ownership in the spec. |
| [FEAT-REV-001](features/FEAT-REV-001.md) | Verified guest reviews for transport providers | [tests/sql/review-moderation-restrictions.sql](../tests/sql/review-moderation-restrictions.sql); [tests/e2e/tracking-completion-review.spec.ts](../tests/e2e/tracking-completion-review.spec.ts) |
| [FEAT-SEC-001](features/FEAT-SEC-001.md) | Production security checks and limited agent authority | [tests/security-operations.test.mjs](../tests/security-operations.test.mjs); [tests/sql/security-boundaries.sql](../tests/sql/security-boundaries.sql) |
| [FEAT-SEO-001](features/FEAT-SEO-001.md) | Public search discovery without private workspace indexing | [tests/public-seo.test.mjs](../tests/public-seo.test.mjs); [tests/workspace-area-navigation.test.mjs](../tests/workspace-area-navigation.test.mjs) |
| [FEAT-SHP-001](features/FEAT-SHP-001.md) | Provider-created Tracking sessions | See named ownership in the spec. |
| [FEAT-SHR-001](features/FEAT-SHR-001.md) | Truck-scoped private capacity sharing | [src/lib/private-capacity.js](../src/lib/private-capacity.js); [tests/platform-brokerage-retirement.test.mjs](../tests/platform-brokerage-retirement.test.mjs); [tests/sql/platform-brokerage-retirement.sql](../tests/sql/platform-brokerage-retirement.sql) |
| [FEAT-SIM-001](features/FEAT-SIM-001.md) | Isolated demo movement with real-device takeover | [tests/sql/demo-location-arbitration.sql](../tests/sql/demo-location-arbitration.sql); [tests/sql/phone-location-installations.sql](../tests/sql/phone-location-installations.sql) |
| [FEAT-SPN-001](features/FEAT-SPN-001.md) | Administrator-managed sponsors | See named ownership in the spec. |
| [FEAT-SUP-001](features/FEAT-SUP-001.md) | Transport-provider support inbox | [tests/support-history.test.mjs](../tests/support-history.test.mjs); [tests/sql/support-history.sql](../tests/sql/support-history.sql) |
| [FEAT-TRK-001](features/FEAT-TRK-001.md) | Authorized-party tracking, email verification and retention | [tests/tracking-progress.test.mjs](../tests/tracking-progress.test.mjs); [tests/e2e/tracking-progress.spec.ts](../tests/e2e/tracking-progress.spec.ts) |
| [FEAT-TRQ-001](features/FEAT-TRQ-001.md) | Retired platform transport-arrangement conversations | [tests/platform-brokerage-retirement.test.mjs](../tests/platform-brokerage-retirement.test.mjs); [tests/sql/platform-brokerage-retirement.sql](../tests/sql/platform-brokerage-retirement.sql) |
| [FEAT-UIX-001](features/FEAT-UIX-001.md) | Low-friction public discovery and provider operations | [tests/e2e/public-app-shell-review.spec.ts](../tests/e2e/public-app-shell-review.spec.ts); [tests/e2e/public-map-shell-layout.spec.ts](../tests/e2e/public-map-shell-layout.spec.ts) |
| [FEAT-VER-001](features/FEAT-VER-001.md) | Entity and truck verification | [tests/sql/provider-authority-command-denials.sql](../tests/sql/provider-authority-command-denials.sql); [tests/provider-authority-recovery.test.mjs](../tests/provider-authority-recovery.test.mjs) |

## Maintaining this index

Update the relevant row when ownership changes. Keep detailed behavior in its
spec; record the latest verification outcome and unresolved work in PROGRESS.
Add dated evidence to a clearly historical record, with source/run IDs and limits,
rather than prepending another competing current summary here. Do not convert
local checks or visual approval into a claim that an application was deployed.

Cross-cutting requirements: [frontend](base/BASE-FE-001.md),
[backend](base/BASE-BE-001.md), [delivery](base/BASE-DEP-001.md).
Security and rollout authority remain in [AGENTS](../AGENTS.md) and
[PRODUCTION_AUTHORITY](../docs/PRODUCTION_AUTHORITY.md).
