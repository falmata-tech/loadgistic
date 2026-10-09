# Web gaps found during mobile implementation

Created 2026-10-05. Related work: [FEAT-MOB-001](../specs/features/FEAT-MOB-001.md)
and [mobile completion checklist](MOBILE_IMPLEMENTATION.md).

This is the owner's deferred web-work register. Findings come from inspecting the
existing web UI, application services and database commands while connecting the
native app. No production incident, exploit or customer impact is inferred from
source inspection. No web repair or production change is authorized by this list.
Priorities below are proposed triage order, not measured incident severity.

## Recording and closure rules

- Append stable WEB-MOB IDs as discoveries occur; retain closed entries and link
  their fix/spec/test evidence. Check existing audits before creating duplicates.
- Record the actor, action, UI/API/service/database path, actual missing behavior,
  impact, evidence strength, mobile exposure, responsible role and next test.
- Separate reproduced defects, source-confirmed gaps and hypotheses. A missing
  mobile screen is mobile work, not evidence of a broken web feature.
- Keep backend-only or retired behavior distinct from an active UI promise. Do not
  recreate an obsolete feature just because its endpoint still exists.
- Deferred does not mean accepted for release: assess shared security/data-integrity
  risks before publishing affected mobile workflows. Record any release decision.
- Close only after the original failure and denial/retry cases pass, persisted state
  and visible results agree, and applicable owner review/release gates are met.
- Do not store customer records, tokens, document content or mailbox bodies here.

## WEB-MOB-015 — Driver-map basemap failure needs browser/device recovery evidence

**Status:** Observed in the October 7 local Expo browser capture after a synthetic
US GPS save; cause unconfirmed. **Owner:** Mobile map maintainer. **Priority:**
Verify before broadly distributing the updated app.

The actual GPS command saves an obscured 20-km position on the replacement truck,
and its blue area renders. The capture shows an empty basemap with the honest
“Map tiles could not load” warning. One standalone public OSM tile request returns
200; that does not prove the browser's tiles loaded. Do not present geometry/GPS
success as basemap completion or assume this is a provider-wide outage.

Source: `apps/mobile/src/components/tracking-map.tsx` sets this warning after a
map error and has no explicit success/recovery clear callback. It remains unclear
whether the observed failure is network delivery, a cancelled old tile during
camera change, or another map event. No missing backend is inferred.
Evidence: `.local/single-truck-mobile-driver-home.png`, successful local GPS
readback in `verify-independent-truck-ui-local.mjs`. Next: inspect actual browser
tile statuses and map error types with sanitized metadata, verify valid cancellation
handling, transient failure/recovery and phone behavior. Retain attribution,
privacy, real-failure warnings and the existing selected-truck interaction.

## WEB-MOB-014 — Active member Support has no direct admin handoff control

**Status:** Source-confirmed missing management control, not a failed existing
button. **Owner:** Support workflow maintainer. **Priority:** Before staffing shifts.

Provider Support assigns automatically by available capacity and lets staff claim
waiting work. `/admin/support` and `/support/[id]` expose transcripts/closure but
no assignment control for an already active member chat. Disabling an agent requeues
their open work. Guest-history and Brokerage assignment controls are separate.

October 7 live local audit verifies replies, attachments, history, claim and closure.
An exact synthetic reassignment proves immediate previous-agent read/write/file
denial and continued new-agent access; it does not prove an admin handoff UI.
Evidence: `src/app/admin/support/page.tsx`, `src/app/support/[id]/page.tsx`,
`src/components/support-thread.tsx`, `scripts/verify-chat-roundtrips-local.mjs`.

Next: specify an admin-only, version-bound member assignment command and a small
contextual control. Preserve current capacity/role checks, audit, history and stale
agent revocation. This audit does not authorize a new production assignment feature.

## WEB-MOB-001 — File cleanup does not distinguish an uncertain commit

**Status:** Immediate deletion risk repaired and deployed October 7 in `415cb7d`
(Netlify `6ac64a35243e4f0c807487b0`); reference-aware orphan reconciliation remains open.
**Priority:** Investigate first. **Owner:** Storage/application maintainer.

After storing a private attachment, verification, payment and profile-image adapters
remove the new object when the subsequent RPC returns an error. They do not first
establish whether the database committed a reference. Tracking's web status route
also catches errors from work after the status command and removes the proof.
A lost response after commit, or a later failure, could therefore leave retained
history pointing to a deleted file. This is a risk, not an observed data-loss claim.

Evidence: [verification adapter](../src/lib/verification/supabase.js),
[billing adapter](../src/lib/billing/supabase.js),
[profile adapter](../src/lib/provider-profile/supabase.js), and
[web Tracking status route](../src/app/api/provider-shipments/[id]/status/route.ts).
**Mobile also inherits this risk:** shared adapters and the native shipment command
use similar cleanup. Passing normal upload/access tests does not resolve it.

The existing member-support attachment service (`src/lib/support-attachments.js`)
already reserves uploads and preserves ATTACHED rows after a lost commit response;
use it as a concrete reference when designing the repair.

October 6 release repair: `commitPrivateUpload` retains objects after uncertain
outcomes and cleans only explicit PostgreSQL transaction rejections. Shared
verification, payment and profile-image adapters use it; both Tracking paths scope
cleanup to the status command, excluding notification/cache failures afterward.
Five tests inject lost commit responses through the actual shared adapters' HTTP
boundary, verify retained bytes, definite rejection cleanup, cleanup failure,
successful commits and no automatic mutation retry. Evidence:
`.local/release-oct06-upload-tests.log` and `tests/private-upload-commit.test.mjs`.
Retained private orphans need reference-aware reconciliation; do not delete solely
by age. Full API/rollout checks and reconciliation remain separate from these
focused tests. See NR-15 in the [security regression register](SECURITY_REGRESSION_REGISTER.md).

Release evidence: exact-candidate CI `37626365763`, fresh protected backup/restore,
live private-file byte/guest-denial checks and compiled/deployed mobile API checks
pass. This closes the immediate deletion repair, not the reconciliation follow-up.

## WEB-MOB-002 — Web upload size enforcement happens after multipart parsing

**Status:** Open; source-confirmed boundary difference; hosted impact unverified.
**Priority:** Investigate first. **Owner:** API/storage maintainer.

Authenticated web verification, payment, capacity and Tracking status handlers call
`request.formData()` before the private-storage file-size check. The application
therefore parses the multipart body before enforcing its 4 MiB per-file policy.
Malformed multipart parsing also sits outside these routes' normal error handling.
Upstream hosting limits may bound exposure; this is not a claim that production
accepts arbitrarily large uploads or that file-storage limits are missing.

Evidence: [verification route](../src/app/api/verifications/route.ts),
[payment route](../src/app/api/billing/payment-proof/route.ts),
[capacity route](../src/app/api/capacity/route.ts),
[Tracking status route](../src/app/api/provider-shipments/[id]/status/route.ts),
[upload policy](../src/lib/upload-policy.js).
The [native multipart boundary](../src/lib/mobile/file-contract.js) already limits
streamed bytes before parsing; that does not retrofit the web routes.

Next session: verify the deployed adapter/proxy body limits; test oversized chunked
bodies, absent/false Content-Length, malformed boundaries and duplicate fields.
Apply a bounded parser while preserving legitimate web fields, authentication,
CSRF and understandable form errors. Confirm no object is stored on rejection.

## WEB-MOB-003 — Payment-proof retries lack operation-level deduplication

**Status:** Open; source-confirmed missing idempotency contract; retry failure not
reproduced. **Priority:** Before enabling paid-plan rollout. **Owner:** Billing maintainer.

Each successful `submit_managed_payment_proof` call generates a fresh ID and inserts
a pending proof. The adapter sends no operation key, and the current migration
chain adds a free-access guard but no retry deduplication. A retry after a lost
success response can create multiple review entries for one intended submission.
This does not establish duplicate charging or duplicate approval effects.

Evidence: [billing adapter](../src/lib/billing/supabase.js),
[migration 051](../supabase/migrations/051_managed_verification_billing.sql) and
[migration 079](../supabase/migrations/079_platform_access_controls.sql).
**Mobile exposure:** optional receipt submission uses the same service. The current
local free-access denial test does not exercise a successful paid-plan submission.

Next session: use an isolated paid-plan fixture and simulate retry after committed
response loss. Define a caller-scoped operation key with payload consistency;
prove one intended submission yields one proof/audit outcome, while genuinely new
payments remain possible. Do not deduplicate solely on an optional bank reference.
Review approval behavior separately before making claims about paid access impact.

## WEB-MOB-004 — Capacity-photo storage has no identified current user flow

**Status:** Open for product/legacy triage; source-confirmed disconnected capability,
not a reproduced broken active control. **Priority:** Normal. **Owner:** Capacity maintainer.

The capacity POST still accepts `photo`, stores it privately and saves its reference.
The projection exposes `proof_available`; preview/gauge components contain “Photo
recorded” labels. Current capacity-form inspection found no photo input or viewing
control, and repository search found no capacity-photo reader. The old generic
proof route returns the retired-demand response; it must not be assumed to be a
valid replacement or evidence that a former capacity reader was removed.

Evidence: [capacity route](../src/app/api/capacity/route.ts),
[capacity adapter](../src/lib/provider-capacity/supabase.js),
[current form](../src/components/capacity-form.tsx),
[gauge](../src/components/provider-truck-market-gauge.tsx),
[preview](../src/components/public-board-preview.tsx),
[retired proof route](../src/app/api/files/proof/[id]/route.ts).
Which preview/gauge paths are reachable today still needs browser confirmation.
**Mobile:** do not add a photo-upload promise based only on this legacy endpoint.

Next session: confirm whether capacity photos are an intended current feature and
trace reachable pages with a synthetic photo-bearing signal. Either retire the
unused intake/claims with compatibility and retention review, or specify and test
an authorized upload/read lifecycle. Never make the private bucket public to fill
this gap; preserve unrelated Tracking proofs and verification documents.

## WEB-MOB-005 — Web payment amount rules differ from native validation

**Status:** Open; source-confirmed UI/service inconsistency, browser reproduction
pending. **Priority:** Before paid-plan rollout. **Owner:** Billing/UI maintainer.

The web amount input uses `type="number" min="1"` without `step`, leaving the
browser's default whole-number step. The shared adapter accepts any finite positive
number and rounds `amount * 100`. Thus normal browser entry and direct submission
do not enforce the same currency precision; the native contract rejects amounts
with more than two decimal places. For example, a submitted 1.234 ETB becomes 123
minor units in the adapter rather than being rejected for excessive precision.

Evidence: [web payment form](../src/app/app/more/page.tsx),
[billing adapter](../src/lib/billing/supabase.js), and
[native contract](../src/lib/mobile/billing-contract.ts).
No production payment was submitted to establish this finding.

Next session: establish one shared ETB/minimum/maximum contract; test 1.50, 1.234,
zero, sub-minimum, non-finite and oversized amounts through both UI and API. Confirm
what the user entered agrees with the stored amount and staff review display.

## Evidence limits and next-session order

Investigate WEB-MOB-001/002 first, then paid-plan WEB-MOB-003/005, then capacity-photo
triage WEB-MOB-004. These are five findings from the flows inspected so far, not a
whole-web audit or proof that all other workflows are complete. Additional discoveries
must be recorded as mobile work reaches accounts, support, brokerage and discovery.

The local native integration passed normal identity/fleet/capacity/Tracking,
verification upload/read/access denial, profile image and regular-service checks.
Those results do not cover the failure scenarios above. Local emulator slowness
and the restarted development server are test-infrastructure observations, not
confirmed web product defects. Intentionally retired public general-help routes
are also not missing features: member support and brokerage have separate scope.

## WEB-MOB-006 — Terms and managed-transport service need a consistent description

**Status:** Open; source-confirmed narrative conflict, no legal conclusion.
**Priority:** Before wider launch. **Owner:** Product owner with appropriate legal review.

The Terms page says the platform is not a broker, while the live Arrange transport
service routes visitors to a dedicated Brokerage team which helps arrange transport.
The guest UI and staff inbox implement that brokerage workflow; it is not a shell.
The boundary between the software platform and the team's separately agreed
assistance service is not explained by that blanket statement.

Evidence: `src/app/terms/page.tsx`, `src/lib/transport-chat.ts`,
`src/lib/transport-requests.ts` and FEAT-SUP-001. Mobile must not invent a different
commercial/legal promise to paper over this gap. Next: confirm who contracts and
charges for the assistance, then align the canonical Terms and guest service copy
with the actual operating model. No legal text was changed in this mobile pass.

## WEB-MOB-007 — Dashboard More menu exposes too many unrelated destinations

**Status:** Deployed October 7 in `415cb7d` after owner visual approval and CI
`37626365763`. **Priority:** Before broad provider onboarding. **Owner:** Product/UI maintainer.

The previous web phone More menu mixed personal settings, operating tools and
business resources. The owner explicitly extended the native correction to web,
and clarified that regrouping links alone was insufficient.

Account now embeds permitted personal/security/photo, business and document forms;
Fleet places truck and driver documents with each entity, and native truck capacity
opens in place. Provider More is replaced by Account; legacy routes remain valid.
Support is directly accessible. Existing server authorization is unchanged.

Evidence: `tests/e2e/workspace-consolidation.spec.ts` verifies local desktop/phone
same-page Account saves, draft retention, company-driver visibility and legacy menu
redirect; `tests/e2e/truck-documents.spec.ts` verifies contextual upload/review on
phone. `tests/workspace-form-navigation.test.mjs` rejects unsafe return targets;
native navigation/document-scope tests verify role policy and kind-plus-ID scoping.
Android Account draft retention/save and inline truck-document controls were checked.

Release evidence: CI and live desktop/phone workspace checks pass; the signed
native internal APK is distributed. This does not close the other six gaps or
substitute for the remaining physical-device matrix.

October 7 follow-up (local, new review pending): two explicit one-tap area controls
replace the choice sheet/native duplicated sitemap and web “Exit dashboard.”
Personal/company settings are further nested in their respective Account groups.
Safe web URL/camera bookmarks preserve applied public filters; native nested
stacks preserve unsaved drafts. Four Account E2Es and actual local-session return
checks pass. These refinements are absent from the released APK/web baseline.

## WEB-MOB-008 — Partial viewport refresh removes loaded map trucks

**Status:** Deployed October 7 in `415cb7d`; focused regressions and final CI pass.
**Owner:** Map/UI maintainer. **Priority:** Before the next map release.

`PublicCapacityFeed` replaced the whole displayed window on every paginated
response. Trucks absent from the first replacement page disappeared, then returned
on later pages, repeatedly changing cluster composition. The shared loader now
identifies the final page; intermediate pages merge with displayed records, and
only successful completion prunes the old window. Changed filter/private access
contexts still reset; selected-truck preservation and stale-request guards remain.

Evidence: `tests/capacity-map-loading.test.mjs` (partial preservation/final pruning,
cancellation, invalid cursors) and `tests/e2e/map-refresh-stability.spec.ts` (slow
refresh, stable marker count/camera/map instance, final empty result, no idle loop).
Existing `map-cluster-transition.spec.ts` verifies automatic pagination/retry.
No server batching modes, manual loading controls or permissions changed (NR-13).
The initial extra-request test result was a harness race with the initial request;
it is not evidence of an additional product loop. Wider map/network performance
still requires normal device/release verification.

## WEB-MOB-009 — Hover signal preview can steal the confirming tap

**Status:** Deployed October 7 in `415cb7d`; desktop/phone interaction regressions
and final CI pass. Final UI uses explicit info controls instead of hover previews.
**Owner:** Map/UI maintainer. **Priority:** Before the next map release.

The unpinned hover preview accepted pointer input. At an overlapping stroke point,
its appearance could retarget the confirming click away from the SVG path; the
pinned details then never opened. Actual pointer-down/up targeted the same SVG
node, but the subsequent click targeted the map container. This occurred in the
closed-route/area regression after collapsing the new details drawer, on desktop
and phone. Unpinned previews now ignore pointer input; explicit pinned controls
remain usable. `map-signal-overlap.spec.ts` tests touch, mouse and keyboard at two
zoom levels. No geometry, server matching or capacity visibility rules changed.

## WEB-MOB-010 — Selected map bounds omit regular service

**Status:** Deployed October 7 in `415cb7d`; focused regression and final CI pass.
**Owner:** Map/UI maintainer. **Priority:** Before the next map release.

Web selection fitted only the reported location and current capacity route/area.
A longer permitted regular-service route could remain off-screen. Selection now
fits all displayed geometry once, reserving room for the side information controls.
Hidden current geometry cannot influence that fit. Native bounds already included
regular service; its marker/ring helpers now also enforce currentVisible directly,
so an inconsistent future payload cannot display a hidden location. Local regression:
apps/mobile/tests/map-info.test.mjs. No new fields or access permissions are granted.

WEB-MOB-009 follow-up: the owner later replaced hover previews and automatic truck
sheets with explicit on-demand details. Hover no longer opens any panel. Mouse,
touch and keyboard signal selection remain regression requirements.

## WEB-MOB-011 — Exiting truck selection loses the previous camera

**Status:** Deployed October 7 in `415cb7d`; desktop/phone browser evidence and
final CI pass. Physical native camera acceptance remains a separate check.
**Owner:** Map/UI maintainer. **Priority:** Before the next map release.

Selection fitted truck geometry without recording the prior discovery camera.
The owner requested an attached exit that restores the previous zoom/pan and
retains filters/search drafts. A saved camera now lasts through selection and is
discarded with the query/private identity scope. The new regression caught a
second timing edge during implementation: Leaflet stop() does not cancel an
already animating CSS zoom or a zoom queued for the next frame. Restoration now
waits for that zoom to complete, preventing its late destination from replacing
the restored view. A new selection cancels deferred restoration; unmount cancels
the pending frame. The native equivalent is implemented but device verification
is still open. Evidence: `tests/e2e/truck-details-drawer.spec.ts` and
`.local/map-modal-exit-final.log` (2/2 desktop/phone), with two return cycles,
filtered query and unsubmitted draft preserved. No filter/API contract changed.

## WEB-MOB-012 — Restricted company-driver Home has only manual capacity location

**Status:** Open; source-confirmed parity gap, not a claimed production incident.
**Owner:** Capacity/location maintainer. **Priority:** Before promising automatic
capacity location for every driver role.

Web's unrestricted CapacityForm refreshes on-duty location every ten minutes
while visible. RestrictedAvailability in driver-capacity-home.tsx provides manual
Share/Refresh only. A company driver without capacity-edit permission can bootstrap
location but does not receive that same foreground automatic capacity refresh.
Shipment travel-screen automatic location is a separate workflow. Neither web
path promises updates after screen closure or phone lock.

The native completion now reuses the same obscuring function and server authority
for foreground refresh across assigned driver roles, independent of edit permission.
Do not mark the web parity gap closed based on native tests. A later web repair
should preserve first-location setup, current assignment/duty checks, offsets,
manual recovery and unchanged capacity/sharing. Test permission denial, late GPS,
revocation, Off Duty and visible/hidden transitions before owner visual review.

## WEB-MOB-013 — Current Featured programme is unpublished

**Status:** Open; reproduced public production state, cause not established.
**Owner:** Featured/operations maintainer. **Priority:** Before a populated Featured demo.

On October 7 at 13:45 UTC, `/api/mobile/public/featured` returns 200 for that
Ethiopia date and Pickup trucks theme, but `published: false`, with zero trucks,
sponsors and programme entries. Both web and mobile use the same Featured port.
The native UI correctly offers Find capacity; HTTP success does not demonstrate
a populated programme or functioning automatic generation.

Source `getSupabaseDailyFeaturedTrucks` returns this unpublished shape when no
published day exists or its theme does not match the current programme. The
15-minute managed dispatcher includes `prepareAutomaticFeaturedDays`; source
presence is not evidence it ran successfully on the host. Do not infer whether
the mode, eligibility, theme, credits or dispatcher caused this state from the
public response. Evidence: `.local/release-mobile-featured-current-evidence.json`.

Next: project-scoped read-only review of the Featured overview, current day/theme,
eligible assigned pairs and recent worker outcomes. If a setting/data correction
is needed, prepare its exact plan and get new owner authority; the October 7
release grants no unrelated configuration mutation. Verify an actual populated
web/native programme plus exclusion and non-repeat behavior before closure.


October 7 inspection follow-up to WEB-MOB-012: web restricted company-driver Home
still renders the duty/location panel rather than the map used by full-access web
drivers and native Home. This is a verified existing presentation difference in
`driver-capacity-home.tsx`, not the named owner's role-routing issue. Keep it on the
web parity backlog; any map conversion must preserve capacity permission denial
and assigned-driver-only location authority. No broader permission was granted.


## WEB-MOB-016 — Direct provider inquiries and closed-app chat alerts have no delivery path

October 7: current customer conversations reach Loadgistic Brokerage; providers
contact platform Support. No inspected direct visitor-to-transporter inquiry
workflow exists, and foreground polling does not notify a closed/background phone.
The owner’s adapted notification request may include those capabilities; exact
scope clarification remains pending. Existing-chat read/alert foundation is local
FEAT-NOT-001 / ADR-077. Do not invent an inquiry inbox, claim phone push from a bell,
or configure another Expo project/FCM account as an implementation shortcut.

Next: confirm whether direct inquiries are wanted and select background delivery.
For phone push, design exact recipient/device binding, permission, token cleanup,
revocation, durable delivery/deduplication, private lock-screen copy and tap
reauthorization before credentials/build/testing. Google Play registration alone
is not push setup, store signing or device delivery evidence. Keep this separate
from Support/Brokerage chat authorization and staff’s web-only restriction.

October 9 follow-up: the requested existing Support/Brokerage and shipment-owner
handover push paths are now implemented locally (FEAT-NOT-001), with installation/
recipient binding, opt-in, durable outbox, Expo ticket/receipt handling, dedupe,
generic notification copy and tap reauthorization. The exact supplied FCM V1 key
is associated only with Loadgistic. Android 1.0.2/code 3 is built and signed;
matched hosted rollout and physical closed-phone acceptance remain pending.
Direct visitor-to-transporter inquiries are still absent and were not invented.
The restricted web driver's duty-action obstruction is fixed under NR-22; the
separate map-presentation parity item above remains on its documented backlog.
