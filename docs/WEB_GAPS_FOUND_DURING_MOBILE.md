# Web gaps found during mobile implementation

## WEB-MOB-046 — Legacy shipment examples have no active customer invitation

Status: demo-coverage gap recorded; the owner test guide is corrected. No
invitation, recipient grant or shipment was silently fabricated or changed.

The saved local `LGX-DEMO-0001` has an assigned driver and shipment history, but
zero `provider_tracking_recipients` and zero `shipment_party_grants`. Its contact
fields alone do not authorize visitor access or shipment-owner approval. The
guide now identifies it as a driver-side inspection example and directs full
customer-side tests through a fresh shipment's normal invitation workflow.
Future demo maintenance should exercise that workflow rather than infer grants
from contact text. This observation is not evidence that new shipment invitations
fail, and it does not authorize changing production demo/customer records.

## WEB-MOB-045 — A successful write could be presented as a confirmed refresh

Status: repaired locally with actual hook and component regression checks.

Some native callers awaited a `reload()` that swallowed read failures, then
cleared their draft and reported the new saved view. The query now provides a
separate confirmed-read result. Network and changed Fleet editors retain a
known-saved checkpoint after a successful write and failed reread; recovery
retries only the GET, never the write. Selected Fleet views display the real read
failure. Authoritative 401/403/404 clears cached private details; transient outages
preserve the same actor/resource's content. See NR-55, FEAT-UIX/MOB/FLT-001 and
`apps/mobile/tests/account-query.test.mjs`, `network-read-first.test.mjs`,
`tests/provider-owner-presentation.test.mjs` and device-cache regressions.

## WEB-MOB-044 — A truck's driver link depended on the first directory page

Status: repaired locally; actual 13-driver browser case and foreign denial pass.

Web Fleet resolved a selected driver only from the current ten-row directory
page. A truck linked to driver 13 could therefore show no selected driver.
An exact owner-scoped reader now resolves the selected target independently of
pagination, repeats current provider/driver/assignment checks, and distinguishes
removal from a temporary load failure. It neither widens the directory page nor
searches another provider's drivers. FEAT-FLT-001; `tests/fleet-driver-detail.test.mjs`
and `tests/e2e/fleet-driver-off-page.spec.ts`. Receipt:
`.local/fleet-driver-detail-20261015/evidence.json` (complete and cleaned).

## WEB-MOB-043 — Cached assignment can hide the current truck on mobile Home

Status: repaired locally with four focused render regressions and actual Expo
owner A-to-B reassignment acceptance. No production change.

Home filtered freshly authorized capacity using the truck ID retained at sign-in.
After reassignment from A to B this could hide B. Fleet also remounted its editor
before the reload completed, restoring old selections. Home now selects the sole
current server pair for its signed-in actor; editor identity follows persisted
assignment/permission/contact fields and saves await reload. Multiple conflicting
pairs fail closed. Session expiry, employee scope and command authorization remain.
Acceptance: FEAT-FLT-001; `tests/mobile-current-driving-pair.test.mjs`
and `tests/e2e/provider-native-assignment.spec.ts`.

## WEB-MOB-042 — Phone-only alerts leave browser confirmation actions inert

Status: five controls repaired locally; actual save/cancel, browser Escape and
backdrop dismissal pass with persisted readback and exact cleanup. Installed
Android and owner visual approval remain separate.

The installed React Native Web Alert adapter implements an empty `alert()`.
Remove driver, Cancel invitation, Remove capacity access, Remove Tracking
recipient and permitted Cancel Tracking therefore displayed no confirmation and
sent no command in the Expo preview. A shared app confirmation now preserves
explicit cancel/confirm decisions on both platforms. Existing protected commands,
history retention and unfinished-Tracking restrictions remain authoritative.
Acceptance: FEAT-MOB-001; `tests/e2e/mobile-confirmation-actions.spec.ts` checks
actual persisted changes and no mutation on cancellation. Fixed confirmation
copy is translated in all four local languages and included in the copy auditor.
Receipt: `.local/internal-workflows-20261014/provider-native-confirmation-painted-phone-runner.json`.

## WEB-MOB-041 — Legacy provider categories mislabel drivers and exclude driving owners

Status: repaired locally; focused adapter/presentation checks pass. Owner visual
review, full release gates and hosted rollout remain separate.

Public/private capacity and basic profile rows inferred a person's driver label
from the provider's historical account category. With every provider able to
employ drivers, this could call an employee Independent driver or call an owner
Company driver. Featured also required an employee-directory row after the
authoritative eligibility command had accepted a driving organization owner,
which incorrectly removed that eligible owner from the candidate list.

The public label is now Driver, while the account remains Transport Provider.
Machine enums are retained for compatibility. Driver document presentation uses
the existing actual-assignment-scoped records; it does not inherit employer
identity documents. Featured trusts the current eligible-link command, safe
identity and provider-scope checks and removes the redundant employee-row read.
Missing links, safe identities, wrong provider scopes and ineligible providers
still yield no candidate. No additional query or new public field is introduced.

Acceptance: FEAT-FLT-001 and FEAT-FTR-001; focused regressions in
`tests/provider-driver-presentation.test.mjs` and
`tests/featured-candidate-reads.test.mjs`. The final root42-test batch including
these and existing publication/authority/presentation boundaries passes;
counts overlap earlier batches and must not be added together.
Actual local backend/phone acceptance also passes a fresh organization owner
driving one unreviewed Live truck without an employee row, including Featured
candidate loading, anonymous first-name-only profile and exact cleanup. Receipt:
`.local/internal-workflows-20261014/provider-featured-owner-current-server-phone-runner.json`.
Before the separate additive local fixture correction, copied multi-Live demo
fleets remained unqualified. Nine later manifest-bound fictional local reviews
restore those demo cards; no real ownership is inferred or backfilled.

## WEB-MOB-031 — Web Tracking offers recovery actions the account cannot use

Status: source repair, five component regressions and actual desktop/phone
role-specific browser cases pass locally. No production change.

Contracts: FEAT-TRK-001 / FEAT-FLT-001; existing server authorization remains
mandatory. Owner: Tracking UI maintainer.

The service removes reassignment for Independent drivers and cancellation when
agreed Tracking requires staff release. `TrackingRecoveryControls` checked only
whether any action existed, then rendered all three forms. A user could therefore
follow an apparently valid control to a predictable denial. Four of five new
component scenarios fail before the repair and all five pass afterward.

Render each form only when its action is in the authoritative context. Operations
keeps all permitted controls, required reasons/revisions and explicit cancellation
confirmation. Direct forged commands must still fail, with history and state
unchanged. Tests: `tests/tracking-recovery-controls.test.mjs`,
`tests/e2e/tracking-recovery-permissions.spec.ts`; the existing lifecycle recovery
case now checks the absent provider cancellation control and a forged-command
denial separately. Both real cases prove Independent correction-only, fleet
correction/reassignment and all three Operations forms; permitted corrections
persist and forged provider cancellation changes nothing. Exact fixtures are
cleaned. The initial new test used a prefilled textarea's wrapping-label text
instead of its accessible textbox name; no POST occurred, and no product patch
was made for that harness mismatch. Receipt:
`.local/internal-workflows-20261014/tracking-permissions-final-runner.json`.
Hosted status and full release gates remain separate.

Created 2026-10-05. Related work: [FEAT-MOB-001](../specs/features/FEAT-MOB-001.md)
and [mobile completion checklist](MOBILE_IMPLEMENTATION.md).

This is the owner's deferred web-work register. Findings come from inspecting the
existing web UI, application services and database commands while connecting the
native app. No production incident, exploit or customer impact is inferred from
source inspection. No web repair or production change is authorized by this list.
Priorities below are proposed triage order, not measured incident severity.

## WEB-MOB-026 — Staff suspension can remove assigned responsibilities

Status: repaired on the owner-approved local preview after actual isolated SQL
and two-session reproduction; browser maintenance and hosted rollout pending.
Owner: account/admin maintainer.
Contracts: FEAT-ADM-001 / NR-41.

The generic User activation command forwards the older five staff permission
fields to an updater that now also accepts Brokerage and Featured. Missing flags
become false, so suspending/restoring staff unintentionally revokes those two
responsibilities. Its snapshot is also read before acquiring the updater's lock;
a concurrent explicit permission save can be overwritten.

The real old command fails the preservation regression and a controlled
two-session race, with unchanged persistent clone state after exact fixture
cleanup.142 adds the two missing fields and locks the current staff row before
copying its flags. The explicit permission editor remains the authority for
changing responsibilities; existing chat requeue, roles, audit and denial remain.
The exact local142 installation and rollback-only staff/identity integration pass;
the receipt is `.local/staff-active-permission-142-20261013/main-install-receipt.json`.
This is not hosted proof. The added browser
case must save workload/Featured permission, suspend and restore both Support
and Transport staff, verify retained grants/current access, explicitly revoke a
responsibility and recheck web-only mobile denial.

## WEB-MOB-027 — Seeded account tests still assume a historical subscription

Status: audit coverage limitation; no current product failure established.
Owner: workflow-test maintainer. Contracts: FEAT-APP-001 / FEAT-BIL-001.

The shared auditProvider helper still selects an active historical plan and
inserts a sponsored subscription for its synthetic provider. Its seeded account
maintenance tests therefore cannot alone prove current plan-free onboarding.
Normal signup tests must verify no new subscription and actual first-truck,
location and capacity behavior. Before changing the broadly shared helper,
map its existing callers and remove only unnecessary test scaffolding with
focused evidence; never restore plans in the product to satisfy old fixtures.

## WEB-MOB-028 — A failed mobile account read exposes blank editable defaults

Status: repaired locally with focused component regressions; actual Expo Retry
workflow queued. Owner: native account maintainer. Contract: FEAT-IAM-001.

The initial Account request could fail and still reveal editable empty fields,
including a private surname and phone. Save now requires authoritative details
for the current account. Retry loads those details without writing; loaded drafts
survive a later read failure and cannot cross to another account.

## WEB-MOB-029 — A saved mobile change can look unfinished after refresh fails

Status: bounded local repairs and red-to-green component checks pass; real
save/fault/Retry workflows queued. Owner: native account maintainer.
Contracts: FEAT-APP-001 / FEAT-PRV-001.

Signup and fleet acceptance could commit successfully but leave their old forms
when session refresh failed. An account-scoped saved checkpoint now prevents a
duplicate submission and offers a read-only retry; workspace authority still
comes from the server. A saved Driver photo followed by a failed preview read
now hides the obsolete preview, acknowledges the saved change and retains the
existing Refresh photo action. No auth shortcut or upload retry is invented.

The same audit found dotted public phone numbers accepted by the existing input
contract but hidden by the public DTO or rejected by its Call action. The DTO
preserves accepted formatting; the actual action normalizes allowed punctuation
to a telephone URI and rejects controls or URL payloads. Focused DTO and handler
checks pass; actual browser persistence and visibility remain separate from an
untested physical dialer. No broader phone-input or SQL change is claimed.

## WEB-MOB-030 — Global mobile activity interrupts a new verified account

Status: repaired locally after actual verification/policy success followed by
chat-alerts/handover403/ACCOUNT_UNAVAILABLE and session reset, confirmed in9.8
seconds. Six actual-component cases fail before/pass after;26 focused checks,
mobile types and scoped lint pass. Actual Expo verification is running.
Owner: native session/activity maintainer. Contracts: FEAT-APP-001 / NR-42.

The global chat/handover provider treats every session as an active member,
including ONBOARDING and JOIN_FLEET. Its endpoints require ACTIVE and correctly
deny pending accounts; the controller clears an unavailable account. Push and
background location have the same overly broad client scope. Gate these effects
to the server-confirmed ACTIVE state, preserving policy/signup/join access,
guest chat and all backend denials. Verify fresh unknown-email signup and fleet
joining with the actual global providers mounted. Seeded active-account tests
and isolated Account components cannot establish this workflow.

## WEB-MOB-025 — Native alerts are not confirmations in the Expo web preview

**Status:** Source-confirmed preview gap; scoped Regular removal passes actual
Expo save/Keep/remove checks; own Driver and provider-photo confirmations are
being repaired and verified separately. **Owner:** Native workflow maintainer. **Priority:** Test
coverage follow-up for other confirmation-driven screens.

Installed react-native-web/dist/exports/Alert/index.js defines alert() as an
empty function. The existing Regular editor therefore offered Remove but never
ran its callback in Expo's browser preview. Android's native Alert is a different
implementation; this finding does not establish that Android removal was broken.

Use the existing inline explicit confirmation pattern in each affected editor, retaining
Keep service, confirmed Remove, actual server authority and saved state on
failure. Photo controls keep the existing separate subject/consent/scan/storage
commands rather than sharing an image state or relaxing permissions. Verify
both choices and the persisted result with a real Expo browser
case, not a test that calls a mocked Alert callback. Other Alert-dependent screens
remain unverified in the browser: audit their actual controls separately and use
installed Android evidence where appropriate. Do not add a global Alert shim or
claim Expo web replaces phone permission/location/notification verification.

## WEB-MOB-024 — A newly assigned driver can inherit old current capacity

**Status:** Reproduced and repaired in migration145, installed in the backed-up
Loadgistic local preview October14. Focused SQL and real concurrent assignment
checks pass. Browser workflow verification and owner visual/release review remain
pending. **Owner:** Fleet/capacity maintainer. **Priority:** Before release.

Final update_fleet_driver_access (082) changes active assignment rows without
resetting capacities. Latest-by-vehicle discovery (112) accepts a new eligible
driver and presents the old snapshot under that driver's identity. Unassignment
and offboarding hide it through eligibility, but a later assignment restores it.
Driver location registry113 checks driver identity for workspace/publish; that
does not validate the location embedded in the existing capacity snapshot.
Restricted on-duty043 can also restore older owner configuration by vehicle.
Permission-only saves reuse assignment rows, so assignment ID or assigned_at
alone is not a safe epoch. Capacity063 forces active signals' expiry to infinity;
expiring a row is not a valid reset.

Migration145 now serializes actual pair changes, resets current capacity to Off
Duty, requires a fresh driver location and preserves old snapshots as history.
Permission-only saves for the same pair remain idempotent. Actual write timestamps
advance under the truck lock, so a waiting older transaction cannot become the
latest snapshot after a later save. The final v3 restored database passes the
focused handover SQL and simultaneous driver/truck assignment cases, with exact
synthetic cleanup; the same reviewed source is installed locally. Evidence:
`.local/provider-fleets-20261014/final-v3-rehearsal.json` and
`.local/provider-fleets-20261014/concurrency-v3-receipt.json` (NR-46).
Regular-route migration140 is not credited with this repair. No hosted data or
settings were changed, and browser/native-device acceptance is separate.

## WEB-MOB-023 — A valid optional truck number breaks the public profile

**Status:** Reproduced and repaired locally October13; release/owner review pending.
**Owner:** Public profile/API maintainer. A Featured-linked profile returned503 on
both its real native endpoint and direct shared-adapter read. Sanitized Zod paths
identified `items.0.platform_number` and `evidence.platform_number`; schema013
allows null, while the adapter required a string. The record was not changed or
substituted. FEAT-PRV-001 now allows just that valid null, preserving UUID/required
fields and the twelve-row bound. Web/native cards use independent private render
keys and no displayed replacement number. Six adapter and two actual web-render
cases pass (the null regression failed before); an actual existing-profile
desktop/phone check passes and the original endpoint now returns200.

Next: include the focused tests in the post-visual-approval release gate and
confirm the matched hosted web/native rollout. Do not mark it deployed or repair
data merely to satisfy an invented display requirement. Public contact/document
projection and moderator/demo exclusions remain unchanged.

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

## WEB-MOB-022 — Mobile API masks upstream Auth failures as sign-in denial

**Status:** Source-confirmed classification gap; no production Auth outage was
reproduced. **Owner:** Identity/API maintainer. **Priority:** Reliability follow-up.

`src/app/api/mobile/auth/[action]/route.ts` maps any refreshSession error to 401,
and `src/lib/mobile/server.ts` does the same for getUser errors. Supabase's
retryable fetch and service/rate-limit errors therefore look like revoked access
to a client. The native MOB-QA-001 repair can retain its current unexpired actor
on an actual transient response, but must still obey an explicit 401/403 denial.
This source finding is separate from the reproduced phone-side refresh timeout.

Next: define and test upstream failure classification without granting access on
an unsuccessful verification. Include token rotation followed by profile/identity
lookup failure: do not discard a legitimate session on a temporary read failure,
or return unverified identity/token data to hide an outage. Retain revocation,
staff denial, account epochs, secure storage and bounded provider retry behavior.
Current scope changes only native lifecycle/valid-session recovery; this register
does not claim the backend classification is repaired or permit Auth settings
changes. No customer impact or live outage is inferred from source inspection.

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

**Status:** Open for empty-programme presentation and sparse-theme availability;
October 9 automation is healthy and today's absence is explained by the no-repeat rule.
**Owner:** Featured maintainer; product owner decides selection-policy changes.
**Priority:** Before a populated Featured demo.

On October 7 at 13:45 UTC, `/api/mobile/public/featured` returns 200 for that
Ethiopia date and Pickup trucks theme, but `published: false`, with zero trucks,
sponsors and programme entries. Both web and mobile use the same Featured port.
The native UI correctly offers Find capacity; HTTP success does not demonstrate
a populated programme. Original evidence:
`.local/release-mobile-featured-current-evidence.json`.

October 9 follow-up: at 12:41:54 UTC the public endpoint again returned 200,
`published: false`, and zero trucks, sponsors and programme entries, now for
Medium-duty trucks. A project-scoped read-only diagnostic at 13:02:41 UTC confirmed
Automatic selection with target eight, no saved day for October 9, and a successful
13:00:58 UTC generation check (`READY`: created 0, kept 2, empty 5). Round 1 has
131 eligible truck-and-Driver pairs, with 21 still awaiting selection globally.
All nine currently eligible medium-duty pairs have already had their turn; none
remain for today's theme. Protected count-only receipt:
`.local/featured-diagnostic-20261009.json` (zero writes).

This is the intended global-round wait in `FEAT-FTR-001` and
`supabase/migrations/098_featured_random_rounds.sql`: an exhausted theme stays
unscheduled while another theme has unseen eligible pairs. The generator prepares
and publishes missing days across the next seven Ethiopia dates; it does not wait for the
08:30–12:00 broadcast window. `src/lib/featured-status.js` classifies these counts
as `ROUND_WAIT`. The successful status is recorded by the generator wrapper in
`supabase/migrations/105_featured_operation_status.sql`, while
`getSupabaseDailyFeaturedTrucks` in
`src/lib/repository/supabase.js` returns the unpublished shape without a matching
published day. Today's evidence establishes successful automation and expected
rotation waiting, not a populated public programme. It does not retrospectively
establish the cause of the October 7 Pickup gap.

Next: the product owner should decide whether these sparse-theme empty days are
acceptable or require an explicitly reviewed selection-policy change. Keep that
product decision and web/native empty-state review separate from worker failure.
Do not reset history, force a repeat, publish a manual override or change settings
under the release approval. Preserve the negative regression in
`tests/sql/featured-random-rounds.sql`: an exhausted theme must not repeat while
another theme has unseen pairs, saved drafts/days remain untouched, and the next
round begins only after global exhaustion. Verify actual populated web/native
programme behavior when an eligible unscheduled theme has remaining pairs, plus
exclusion and non-repeat behavior, before claiming the populated demo is ready.


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

October 9 release follow-up: the matched backend and Android 1.0.3/code 4 are now
released for direct testing. Final live security and 80 release checks pass.
Physical closed-phone delivery remains unverified; direct provider inquiries
remain absent. See MOBILE_IMPLEMENTATION for current release evidence.


## WEB-MOB-017 — Public near-me filter still rejects locations outside Ethiopia

Observed October 9 during Play workflow integration, not fixed in that task.
`src/components/public-capacity-feed.tsx:154` still selects `outside` and rejects
a visitor GPS fix beyond Ethiopia, although the native/driver/backend location
contracts already accept worldwide coordinates. This conflicts with the owner's
worldwide-location requirement.

Next: remove this residual frontend restriction while preserving privacy and
valid-coordinate/radius guards. Test a US GPS fix and combined location/search/
truck filters on web phone and desktop. Review the focused map behavior before
release gates; do not copy the restriction into native or change map UI.

October13 follow-up: the public Capacity feed now accepts and tests a US location
in the current preview, but the separate profile truck-map control in
`src/components/provider-fleet-showcase.tsx` still rejects latitude outside3–15
or longitude outside32–49 and says “outside the Ethiopia map.” Source-confirmed;
that component was deliberately excluded from presentation cleanup. Keep this
entry open for its dedicated valid-worldwide-GPS/recovery regression; do not infer
all public map entry points are repaired from the homepage test.

## WEB-MOB-018 — Product master prompt contains obsolete workflow contracts

**Status:** Source-confirmed documentation drift, not a newly reproduced runtime
defect. **Owner:** Product/spec maintainer. **Priority:** Before implementing the
next related feature or using this document for store declarations.

The October 9 handoff found `docs/PRODUCT_MASTER_PROMPT.md` still describing
shipment-code-plus-OTP Tracking entry, optional loading/unloading proof, a 40 km
radius, foreground-only location, separate independent-driver signup categories,
account plans and unimplemented closure. Those claims conflict with the accepted
Tracking, single-truck, no-plan and Play-policy contracts now implemented.
The broad documentation correction was not hidden in the approved rollout.

Next: reconcile each affected paragraph against FEAT-TRK-001, FEAT-FLT-001,
FEAT-BIL-001, FEAT-MOB-001 and FEAT-PLY-001 plus their mapped tests and actual
release evidence. Preserve unresolved device acceptance and retained-history
limits. Do not restore obsolete behavior or infer customer-erasure authority
from old prose. Current release status is in PROGRESS/MOBILE_IMPLEMENTATION and
feature specs; store declarations still need owner/provider attestation.

## WEB-MOB-019 — Private-capacity entry needs a short-screen native review

October 10 store-capture observation: the actual 1080 × 1920 Android development
preview shows the bottom of the Send email code button clipped at the map edge,
above the transport-chat control. The source capture is retained privately as
.local/play-store-20261010/draft-05-private-capacity-1080x1920.png. No email was
submitted, and no authentication/backend failure is inferred from this image.
This is a native presentation observation, not a reproduced web defect.

Next: reproduce on the final standalone candidate, check scrolling and keyboard
clearance, and ensure the complete entry action remains visible and reachable on
short screens. Use actual UI and review any adjustment before release. Keep this
optional screenshot out of the final store set until that review passes; the
four core-workflow screenshots remain the required minimum for this package.

## WEB-MOB-020 — Canonical website links did not map to native destinations

**Status:** Locally repaired October 11; replacement binary and installed-link
verification pending. **Owner:** Mobile navigation maintainer.

Application emails use `/track` and `/shared-capacity`, while native routes were
`/visitor-tracking` and the map's private choice. The native allowlist rejected
those legitimate canonical paths; public `/@handle` links had the same mismatch.
The allowlist now maps those exact paths to existing destinations. Private entry
selects its email-verification view, without accepting link credentials or granting
a session. Invalid handles, extra parameters and foreign hosts remain denied.
Native link regressions and the browser private-entry workflow supplement the
normal real-email Tracking flow. Do not claim installed-link or web-to-app
acceptance merely from normalization tests or an Expo-web view.

The website's `?q=handle&truck=id` focused-map link still has no equivalent native
truck-focus parameter. Native UI instead links to the matching transporter map
search. Record that compatibility gap rather than accepting arbitrary additional
parameters or bypassing selection/privacy checks as a convenience.

## WEB-MOB-021 — Local migration history is not a trustworthy catalog snapshot

**Status:** Diagnosed, not rewritten. **Owner:** Local environment maintainer.

October 11 local CLI history ends at 129 and contains older gaps, while policy
tables and functions from later migrations already exist. The backed-up exact
130–136 transaction is refused by migration 130's drift assertion and rolls back.
No reset, broad replay, ledger repair or hosted change follows that refusal.
Seven focused policy/Featured/Tracking regression suites pass against the actual
catalog with all mutations rolled back. These results do not prove historical
migration bytes or make the ledger authoritative.

Next: compare the actual local catalog with a clean isolated replay and reconcile
history only from exact evidence. Preserve the existing manual preview records;
use the normal clean CI/rehearsal for release evidence, not a falsely repaired
local max-version value.

## WEB-MOB-032 — Support Waiting offers claims the database cannot accept

**Status:** Function-only144 and the matching Claim control are installed locally
October14 after isolated/fresh-restore rehearsal. Four component and both actual
desktop/phone staff cases pass; hosted installation remains pending.
**Owner:** Support workflow maintainer. **Priority:** Before staff use the Waiting
queue for triage.

`src/app/support/page.tsx` renders Claim for every waiting member conversation,
including later pages and unavailable/full staff. The managed command in
`supabase/migrations/054_managed_support_runtime.sql` permits only the globally
oldest waiting member conversation, requires current availability and checks the
combined member/retained-guest workload. Moreover, the inbox orders equal creation
times by latest message before ID, while the command uses ID immediately after
creation time. The first displayed row is therefore not reliable claim authority.
Selecting Claim on a row other than the command's exact oldest is rejected
rather than doing what that control promises.

Repair: add an actor-authorized exact eligibility projection to the existing inbox,
following the retained-guest `can_claim` precedent in104. Preserve the command's
FIFO/locking/capacity rules; do not guess from row index or substitute a direct
service-table read. Exact SQL regression, rollback and strict catalog checks pass;
four actual-component cases pass the matching UI. Hosted approval remains separate.
Actual passing browser regression cases include equal
timestamps, multiple pages, paused/full staff, a competing claim and revoked
permission, with current database state checked after the visible action.
Receipt: `.local/internal-workflows-20261014/support-fifo-actual-runner.json`.
Phone capture also exposed an existing CSS rule making the plain Waiting
identity wrapper and initials lose their grid alignment. Two scoped selectors
retain the same avatar/name layout as linked rows. The fresh phone FIFO workflow
and capture pass: `.local/internal-workflows-20261014/support-fifo-alignment-phone-runner.json`.

## WEB-MOB-039 — Operations Tracking passes the old map format into the new renderer

October14 actual lifecycle diagnosis reaches successful local inbox code
verification, then fails at the staff map. Source confirms that the existing
`admin_tracking_location` RPC returns an authorized legacy status/endpoint/
approximate-location object, while `TrackingLocationMap` now dereferences a
typed route array. The admin page passes the old object directly. Earlier
presentation tests return null for this port and therefore miss the crash.

The bounded local repair retains the database Operations authority gate, reads
only the exact shipment's saved route columns after a nonnull authorized result,
and rechecks the same RPC before using current status/obscured location. The page
then uses `trackingMapData` before rendering. The saved via city and privacy
radius remain factual; no coordinates, public consent or truck summary are
invented. This avoids new SQL, revoked helper access or provider impersonation.

Seven current-source contract checks now prove denied/null zero secondary reads,
exact actor/record scope, the route allowlist, final revocation/location reset
denial, private-field exclusion and the actual typed renderer connection. Six
fail before the repair and all seven pass afterward. The focused real lifecycle
case also passes desktop/phone: local inbox code, saved three-city route and 20 km
circle, reassignment clearing the former location, workspace correction, truck
retire/restore, forged provider cancellation denial, investigated cancellation,
retained history and guest revocation. Exact cleanup passes. Receipt:
`.local/internal-workflows-20261014/lifecycle-internal-repaired-runner.json`.
The original
email-code failure remains unclassified; it is not reproduced by the fresh
diagnostic and is not attributed to a product or rate-limit defect.

## WEB-MOB-038 — Admin Private capacity initial filters disagree with its API

October14 parallel source review: the admin page forwards raw repeated query
keys as arrays to `listLoadgisticSharedCapacity`, which accepts them as selection
groups. Its GET endpoint rejects those same duplicate keys. Initial profile
search text also enters truck matching, while subsequent map-window requests
remove `q`. Reloading can therefore disagree with the interactive map for the
same URL. This is a validation/consistency defect, not an established access
bypass.

Source: `src/app/admin/capacity-network/page.tsx`,
`src/app/api/admin/capacity-network/route.ts`,
`src/components/public-capacity-feed.tsx` and the established Home
`capacityFilterRecord` validation. An isolated in-memory actual-page probe
confirms the forwarded array, downstream acceptance and API rejection.

The implemented local repair reuses canonical record validation and the existing
denied initial state, skips persistence on invalid input, and retains `q` only
for the transporter drawer. Three actual-page regressions fail before the repair;
all14 focused SSR/HTTP/value checks pass afterward. Two actual desktop/phone
staff cases also pass reload denial, API400, explicit modal correction, retained
drawer text and canonical API200. Receipt:
`.local/internal-workflows-20261014/admin-capacity-ssr-actual-runner.json`.
Existing staff authority, truck-filter semantics and layout remain intact.
Full release gates and hosted rollout remain separate; production is unchanged.

## WEB-MOB-037 — Member Support has no manual staff-transfer control

**Status:** Source-confirmed October14; an operational capability gap, not a
rendered control that failed. **Owner:** Support workflow maintainer.

Member Support currently assigns automatically and offers authorized FIFO Claim,
reply and Close. `src/app/admin/support/page.tsx` opens the member thread, and
`src/components/support-thread.tsx` has no manual reassignment form or member
assignment API. The existing `guest-support-assignment.tsx` control belongs to
retained guest-assisted chats and has separate passing desktop/phone evidence.

The earlier member-handoff fixture update verifies that a former assignee loses
message/private-file access and the new assignee retains history. It does not
prove a manual transfer UI exists. Do not market or teach that nonexistent
control, or silently add a new feature during this cleanup. A later product
decision can specify a bounded audited transfer, permitted destinations and
current capacity/permission checks if the team needs manual transfers.

## WEB-MOB-036 — Administrator Support queue has no incremental refresh

**Status:** Source-confirmed October14; runtime behavior not yet reproduced.
**Owner:** Support workflow maintainer. **Priority:** Staff workflow follow-up.

`src/app/admin/support/page.tsx` renders queue counts and conversations without
the `SupportRefresh` installed by the staff Support and retained-guest queues.
Global chat alerts can announce work but do not refresh this queue. The existing
FEAT-SUP-001 visible-queue polling contract therefore lacks mapped evidence for
the administrator view; no new incoming-work test has passed for this page.

Next: verify a new synthetic conversation reaches the administrator's visible
queue automatically, while an unsaved team-permission form, queue/team page and
selected status survive. The administrator reads ten queue rows while the update
endpoint currently defaults to fifteen, so its revision scope must match the
displayed page. Do not add a naive route refresh that resets edits or falsely
claims an unchanged page. Preserve the current UI and team permissions.

## WEB-MOB-033 — A Driver record's Open owner link omits its record kind

**Status:** Repaired and verified locally October14; page-component and actual
desktop/phone workflows pass; owner visual approval pending. **Owner:** Admin Records maintainer. **Priority:** Before connected-record
investigation is treated as verified.

`src/app/admin/operations/[view]/[id]/page.tsx` built Open owner with
`record.owner_kind`, but the current Driver projection in migration066 supplies
`owner_id` from its exact organization join without `owner_kind`. The resulting
`kind=undefined` cannot match the workspace detail's required ORGANIZATION or
PROVIDER_PROFILE branch, so the intended owner detail is unavailable. This is a
source-confirmed linkage defect, not an authorization bypass.

Repair: infer ORGANIZATION only for the existing DRIVERS projection and preserve
the destination's Customers permission and exact-record checks. The actual page
href fails before the repair and passes afterward in
`tests/admin-presentation.test.mjs`. Actual local synthetic desktop/phone cases in
`tests/e2e/admin-connected-queues.spec.ts` follow the exact owner link, verify its
business heading and public handle, and deny Customers detail to Operations-only
staff. The combined run passes4/4; sanitized terminal receipt is
`.local/internal-workflows-20261014/admin-connected-complete-runner.json`, with
scoped record captures in its `admin-connected-complete/` directory. No API or SQL
authority changes; owner visual approval remains separate.

## WEB-MOB-034 — Content and deletion queues can claim false emptiness

**Status:** Repaired and verified locally October14;16 component checks and actual
desktop/phone queue workflows pass; owner visual approval pending. **Owner:** Admin review/privacy maintainer. **Priority:** Before saved
queue URLs are relied on for complete review.

`src/app/admin/reviews/content/page.tsx` and `src/app/admin/privacy/page.tsx` use a
numeric page directly for their bounded range query. They accept fractional page
values and do not recover when a later offset returns no rows, even when the exact
count proves existing records. A saved high page therefore says no reports or
requests yet and offers only a previous-page link through empty pages.

Repair: reuse `readWindowedPage` for integer normalization and at most one first-page
recovery; retain query failures, exact target links, saved states and all Trust/
administrator checks and confirmation controls. A real local PostgREST probe
confirmed that these overflow ranges return HTTP416/PGRST103 with null data and
count, so an empty-array-only test was insufficient. Both adapters recover only
that exact error on a later offset; first-page416, wrong-code416,503,401,403 and
failed fallback remain failures. New actual page-component cases fail before that
boundary fix and pass afterward. All16 focused presentation checks pass, plus
TypeScript and spec validation. Actual synthetic queue browser cases in
`tests/e2e/admin-connected-queues.spec.ts` pass overflow/fractional pages, exact
account links, unchanged moderation/deletion controls and current Trust/admin
denials on desktop and phone. Combined033/034 evidence is4/4 in
`.local/internal-workflows-20261014/admin-connected-complete-runner.json`; scoped
content/privacy screenshots are under `admin-connected-complete/`. No moderation
or erasure action is submitted by these queue checks. No mutation contract change.

## WEB-MOB-035 — Review moderation decisions overwrite another queue's hold

**Status:** Reproduced in an isolated clone and repaired in the local preview
October14; migration143 regression/security checks and both desktop/phone
conflict-form workflows pass. Hosted installation remains pending.
**Owner:** Trust/moderation maintainer. **Priority:** Before review moderation is
treated as a durable publication boundary.

Migration132's `moderate_content_report` restores a reported review by setting
`provider_reviews.status='PUBLISHED'` without checking another HIDDEN report or a
REMOVED rating-dispute decision. Conversely, migration044's
`resolve_provider_review_dispute` sets PUBLISHED for UPHELD without checking active
HIDDEN content reports. Two reports submitted while a review is published can be
hidden, then restoring either one republishes the review although the other stays
HIDDEN. An upheld pending dispute similarly republishes a content-hidden review.
The canonical profile read in `src/lib/repository/supabase.js` and public review
aggregate in migration039 check only `status='PUBLISHED'`; no later migration adds
a HIDDEN-report guard to these paths. Public text and reputation can therefore
reappear from these conflicting persisted states. The exact final regression
reproduces this on the original isolated-clone functions and passes on143;
shared-preview and hosted reproduction are not claimed.

Migration143 serializes the exact review and preserves every other HIDDEN report
and terminal REMOVED rating decision. `tests/sql/review-moderation-restrictions.sql`
passes both command orders, multiple reports, terminal replay, revoked Trust,
unrelated review, audit, public text predicate and actual public count/average.
Two actual sessions prove same-review blocking and correct final publication;
eight rollback drift cases, replay refusal and exact rollback preserve every
original function/owner/ACL/config plus rows and ledger. Protected review evidence
is `.local/review-moderation-143-20261014/review-manifest.json`.

The initial clone's catalog failure was a restore omission (NR-44), not an exposure
in the original local database. The fresh combined143/144 restore now restores
the exact snapshot's PostGIS member grants/RLS and passes strict catalog checks.
The local installation preserves78 business tables, all unrelated functions,
permissions and ledger; a changed runtime throttle counter is separately diagnosed
without hiding the initial guard stop. Actual Trust Hide/Restore and rating
Uphold/Remove forms now pass on desktop/phone; canonical public HTML/API text,
count and average agree after overlapping restrictions and revoked authority.
Exact synthetic cleanup passes. Next: owner visual and separate hosted review.
No hosted write occurred. See NR-43/44 and
`.local/internal-workflows-20261014/main-143-144-install-receipt.json`.
Browser receipt: `.local/internal-workflows-20261014/moderation-conflict-actual-runner.json`.

## WEB-MOB-040 — Public provider truck maps still rejected locations outside Ethiopia

**Status:** Source-confirmed October14; corrected and focused component-handler
regressions pass. Actual desktop/phone interaction, visual review and deployment
remain pending. The combined provider-fleet local preview update is installed;
that installation alone does not prove actual GPS/browser interaction.
**Owner:** Capacity/provider-profile maintainer. **Priority:** Before release.

`ProviderFleetShowcase.requestLocation` rejected coordinates outside latitude
3–15 and longitude32–49, although worldwide maps and location reporting are
already approved. A US viewer therefore could not compare their position with a
provider's truck. The component also left an earlier viewer marker visible if
geolocation became unavailable.

The handler now accepts only finite latitude−90…90/longitude−180…180, clears an
unavailable or denied viewer location, and retains the selected truck, map scope
and close-button focus. Invalid coordinates have a retry message instead of a
country restriction. Public fleet counts, status labels, private phone fallbacks
and map controls use the existing localization boundary; city/name values remain
record data. `tests/provider-fleet-showcase.test.mjs` covers overseas positions,
world boundaries, invalid GPS, denied/unavailable permission, retry and focus.
No database or hosted operation was performed for this correction.
