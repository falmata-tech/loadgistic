# Fleet, onboarding and location workflow audit

Scope: Loadgistic only. Existing capabilities; no fleet-product expansion.
Controlling specs: FEAT-FLT-001, FEAT-CAP-001, FEAT-IAM-001, FEAT-GEO-001,
FEAT-TRK-001 and FEAT-SHR-001; ADR-072. Preserve unrelated accumulated work.

- [x] Inspect owner/company-driver/independent-driver authority and controls.
- [x] Finish real local desktop/phone onboarding, assignment and capacity flows.
- [x] Resolve first-location, assignment-context and recovery defects.
- [x] Exercise database permission denial, location privacy and history retention.
- [x] Review final desktop/phone captures and record browser evidence.
- [x] Add changed guidance/errors to all four translated dictionaries and key checks.
- [ ] Owner visual approval before full release/deployment.

## Confirmed defects and corrections

1. **First-location dead end.** A driver without capacity-edit permission could
   not save location before publication; the owner needed that location to publish.
   Migration 113 permits an explicitly requested approximate fix by the current
   active assigned driver, separately from capacity. It creates no capacity row.
   The owner can use that fix; their own device location remains denied.
2. **Off Duty recovery.** Latest Off Duty capacity has no geometry, so checking
   only that row hid the existing owner setup. The workspace now reports whether
   an owner-authored setup exists. The driver refreshes location before resuming it.
3. **Lost assignment context.** Capacity Assign driver links now identify the
   current truck. The existing owner editor preselects it and returns to that truck.
4. **Unbounded waiting.** Capacity/location saves have a 15-second request/body
   deadline; foreground Tracking acquisition/save has a 45-second total deadline.
   Ambiguous writes are not retried automatically. Late results cannot report success.
5. **Missing GPS fields.** SQL NULL comparisons did not explicitly reject omitted
   coordinates/source/radius. Publication and duty commands now reject them directly.
6. **Unexpected GPS request.** Restricted-driver Home no longer starts watching
   position automatically. An unassigned driver gets assignment guidance; an assigned
   driver chooses Share/Refresh truck location. Approximate coordinates leave the
   browser; owners cannot substitute their device position.
7. **Inconsistent location feedback.** Fleet location and its timestamp now come
   from the same newest fix. Saving a restricted-driver fix refreshes the summary.

8. **Map movement during layout resize.** Keep Leaflet's geographic center when
   the owner map container changes size. First publication, narrow/wide layouts,
   layout-only resizing and opening/cancelling the editor retain a visible marker.
9. **Successful Tracking save aborted during cleanup.** The foreground runner
   now aborts failed/cancelled operations only, preserving successful response
   completion. Regression tests cover stalled reads/saves and late results.

## Focused verification — completed locally, 2026-09-28

- Rollback-only SQL passes: new driver-location bootstrap plus existing immediate
  assignment/preverification, driver eligibility, invitations/conflicts, lifecycle,
  browser boundaries and security boundaries. Catalog RLS/privilege checks pass.
- Existing local demo identities use Gmail aliases. Local-only SQL copies resolved
  exact fixture identities without changing accounts. Fresh CI keeps its fixture
  addresses. Browser setup uses verified local Supabase sessions; fresh onboarding
  still exercises the visible email-code flow and local Mailpit delivery.
- Thirty-five focused unit tests pass: browser requests, fleet onboarding and
  registration, provider capacity, foreground Tracking, workspace fleet and
  localization. TypeScript, source/spec validation and whitespace checks pass.
  Logs: `.local/fleet-workflow-audit/{unit-final,typecheck-final,source-spec}.log`.
- Twenty-six distinct desktop/phone cases passed across focused runs, not one
  uninterrupted green suite. Coverage includes email-code signup for fleet owners,
  owner-operators and self-managed drivers; assignment before email verification;
  current-session permission changes; denied GPS and draft recovery; first driver
  location followed by owner publication; Off Duty/resume; retirement and access
  revocation; capacity dialogs and foreground-only Tracking.

| Evidence directory under `artifacts/` | Passing evidence and limitations |
| --- | --- |
| `fleet-workflow-audit-final-20260927/` | 20 passes: capacity dialogs (10), vehicle registration (4), onboarding (5), desktop lifecycle (1). Two failures, one interruption and one not run retained; resolved cases listed below. |
| `fleet-location-map-tracking-20260927/` | Phone Tracking and earlier desktop/phone map-resize checks pass; desktop Tracking response timing corrected in next run. |
| `fleet-tracking-desktop-final-20260927/` | Desktop Tracking passes with real response synchronization. |
| `fleet-phone-review-final-20260927/` | Self-managed onboarding and lifecycle phone checks pass. Extra company-onboarding repeat failed at external map-tile loading; assertion retained. |
| `fleet-first-map-review-20260928/` | Final first-location → first-publication map checks pass on desktop/phone, including container resize and modal cancellation; captures reviewed. |

- Early failures included retired fixture-login selectors and waits shorter than
  dev-server rendering. Helpers now use verified local sessions; workflow tests
  wait for actual responses/rendered states without dropping assertions. An old
  development process was restarted. A later company-onboarding repeat spanned
  4.3 hours during a host/session pause; it is incomplete infrastructure evidence,
  not a product pass. Its log and artifacts remain available.
- One browser repeat failed waiting for external OpenStreetMap tiles; later map
  captures show loaded tiles. A generic command-line request also received an
  access-denied tile, but that client is disallowed by the provider policy and
  does not establish a browser or production outage. Community tiles have no
  availability guarantee; retain the existing production-provider follow-up.
  No provider/configuration change or tile-assertion suppression was made.
  Policy: https://operations.osmfoundation.org/policies/tiles/.
- GPS inputs are simulated. These tests do not prove real-phone GPS accuracy,
  phone-lock behavior or native background tracking. Browser Tracking remains
  foreground-only. Native-speaker review of localized phrasing remains separate.

## Release

No production writes, deployment or Git publication in this audit. Keep
http://127.0.0.1:3100 available for owner review. Migration 113 is local only;
rehearse all pending migrations 102–113 and run exact-candidate release gates
only after visual acceptance. See `PRODUCTION_AUTHORITY.md`.

## Owner review

Preview: http://127.0.0.1:3100. Review the assigned driver's **Share truck location**
control, the owner's capacity editor after that fix, and Off Duty → refresh →
Available. Latest map captures are under `fleet-first-map-review-20260928/`;
first-location and duty controls are under `fleet-workflow-audit-final-20260927/`.
Owner visual approval remains pending. The server was restarted during the Tracking follow-up; its current log is
`.local/tracking-email-session/dev-server.log`. Keep port 3100 running for review.
