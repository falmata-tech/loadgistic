# Security failures we must not repeat

## NR-63 — Browser control failure mistaken for the owner's missing session

**Observed:** Name-based Chrome automation inspected a different Chrome instance
from the owner's selected Loadgistic Play tab. Repeated selection/sign-in
requests did not fix that connection mismatch. A process-bound ScriptingBridge
read subsequently found the exact existing app tab; no new login was needed.
**Control:** Verify which process/window/tab the tool can actually control and
bind the exact app URL before inferring missing account state. Report a tool
limitation accurately. Never read browser profiles, passwords, debug pipes or
another application's pages as a workaround.
**Evidence:** The protected October20 Play read-only receipt records the exact
app target and visible publishing/declaration state; no Console write occurred.
**Owner:** browser operator. **Next:** retain the process/target check whenever
multiple browser instances are present. This is an operating check, not a
claim that browser permissions are automatically enforced.

## NR-62 — Source inference promoted to a confirmed failure

**Observed:** An internal audit initially proposed blocking Android signing
because Expo can refresh a token after notification delivery is turned off.
Inspection of the exact UI/disclosure showed an alerts-off promise, not a
promise that every SDK token check stops. No post-toggle traffic was observed.
The claimed contract violation and proposed declaration changes were retracted
before any code, Console, key or device change.
**Control:** Establish the literal promise, current spec, exact execution path
and observed outcome before classifying a defect or adding a release block.
Label source-only behavior and uncertain external-policy classification as
such; do not turn a hypothesis into an owner decision or production mutation.
**Evidence:** Protected `play-code9-sdk-collection-source-facts-20261020.json`;
`native-push.ts`, `chat-alert-provider.tsx` and the actual privacy copy.
**Owner:** investigating agent/reviewer. **Next:** retain the facts and limits
without claiming a runtime experiment or a policy determination.

## NR-61 — Repeated release preparation wastes unchanged evidence

**Observed:** Focused repairs missed related stale tests, so later complete CI
runs failed after packaging and fresh backup/rehearsal work had completed.
Time-limited backups then became unusable before any hosted rollout. Source
changes confined to tests/docs also caused preparation to restart despite
unchanged Android files and executable web inputs. Repeated interrupted
credential processes caused additional Keychain requests.
**Control:** Consolidate test findings before CI. Complete stable gates and
immutable packaging before final short-lived backup/security checks. Reuse
verified bytes with explicit executable-source equality and unchanged artifact
provenance; keep current CI separate. Preserve approvals instead of relabeling
old receipts or repeatedly asking for unchanged actions. Hold credentials only
in the approved bounded process and close it when finished. Never extend backup
age, waive a failed check or broaden authorization to save time.
**Evidence:** October20 e65CI39491588105, completed package/runtime and isolated
V8/V9 rehearsals; no associated hosted rollout or signing.8dfCI39497266765 was
cancelled when the owner required the full test audit.
**Owner:** release operator. **Next:** finish the full audit and exact-source CI
before the next final backup; verify artifact reuse and actual rollout outcomes.
These controls are workflow requirements, not a substitute for provider-side
enforcement or permission to reuse expired evidence.

## NR-60 — Personal-fleet employee omitted from sharing authority

The deep onboarding browser journey reached a real capacity-save denial: an
assigned employed driver of a personal Transport Provider passed fleet capacity
authorization but the older private-sharing predicate admitted employed drivers
only for organization-owned vehicles. Current clients always submit sharing mode,
so the save failed with NOT_FOUND. Earlier fleet SQL omitted that field and never
exercised the combined command.

Use the established persisted employer-scope predicate for both fleet anchors,
retaining current assignment, active actor/vehicle, capacity permission and all
owner branches. Do not infer authority from a client role or merely possessing
a vehicle ID. The new rollback-only personal-fleet sharing suite reproduces the
original denial and checks all four sharing modes, foreign-vehicle denial,
revoked capacity permission, inactive driver, ended membership/assignment, saved
state preservation and service-only execution. Run it in required CI alongside
actual browser signup/assignment/first-save/revocation flows.

Migration180 is a narrow additive function repair with private rollback copy;
no record, role or grant rewrite. The backed-up local installation by the existing
function owner passes the new regression, existing fleet/sharing suites and both
catalog/DataAPI security gates. The complete employed-driver onboarding journey
passes in desktop and phone Chrome through first capacity save and revocation.
FullCI and separately reviewed hosted rollout remain pending. Owner:
fleet/sharing maintainers.

## NR-59 — Synthetic Play workspace inherits real email shares

A registered Play reviewer can use the normal business customer flow. Before
migration176, its business would appear in ordinary provider discovery; a
business Capacity feed also included grants to the member's email, independent
of team grants. If a real provider addressed that email or a real shipment used
it as Tracking owner, a synthetic business could inherit real Capacity or attach
the shipment and expose its status and authorized location to review staff.

Keep the review marker durable when a reviewer login is disabled. Enforce
review/ordinary parity at membership, invitation, provider discovery, both
Capacity-feed grant branches, direct email-grant/Tracking-recipient creation,
Tracking business attachment and Tracking read. Preflight existing mismatches;
never silently move a real shipment or grant into a sample workspace. New
synthetic outbound email shares must target registered reviewer emails, not
arbitrary real addresses. The source owning the vehicle/agreement, not a
client label or `created_by` alone, decides its review scope.

Owner: Play/business tenancy maintainers. Migration176 and the rollback-only
`tests/sql/play-review-business-isolation.sql` pass on a disposable local clone
of schema175, with real/review email, guessed-ID, legacy grant, source mismatch,
late registration and status-only staff negatives. No hosted repair or Play
reviewer business has been provisioned by this local proof.
Email digests are HMACs derived from the normalized recipient email by the
server adapters, not caller inputs; the database does not hold their secrets.
The email/digest binding therefore remains a service-adapter trust boundary.
Browser roles cannot call the private share RPCs or write their tables. A
compromised service-role caller could forge both values and requires separate
credential containment, not an invented database copy of the HMAC secret.

## NR-58 — Revoked queued invitation still contains private shipment details

A Tracking viewer invitation could wait in the email outbox after its recipient
was revoked. The page correctly denied access, but the worker could still send
its previously queued cargo summary. Queue ownership at creation is not current
recipient authorization at delivery. Recheck the exact server-derived recipient
digest against the authorized Tracking getter immediately before sending; denied
or unavailable authorization sends no invitation. Existing completion emails keep
their distinct established behavior. Do not clear rate limits or fabricate a
recipient to make mail delivery pass.

Owner: Tracking/email maintainers. `tests/tracking-sharing-email.test.mjs` proves
revoked and failed rechecks send nothing while current invitation and completion
behavior remain valid. Combined email-focused25 tests pass locally. This bounds
the pre-send check; it does not promise recall of an email already sent or an
atomic transaction with an external SMTP server. Hosted rollout is pending.

## NR-57 — Personal driver duty change loses the provider anchor

The company-era duty INSERT retained organization_id but wrote a NULL personal
provider_profile_id. Going Off duty for an individual provider then failed the
Capacity owner constraint. Keep the actual truck's exact provider anchor through
every location/duty command; a shared interface does not imply company ownership.
The isolated selected-source Tracking test exposed this through the normal duty
command. Migration158 repairs the exact guarded INSERT. Its regression switches
the synthetic individual truck Off duty, preserves history and still resolves
Tracking from its selected GPS source without an available Capacity signal.

Owner: Fleet/location maintainers. Verified in the isolated October18 local
clone and backed-up active local preview. Hosted rollout remains separate evidence.

## NR-56 — A phone wrapper compiles but breaks ordinary status changes

The first registered-phone status wrapper omitted parentheses around a JSON
extraction before subtracting its private attribution key. PostgreSQL resolved
the wrong operator when planning the expression, including an ordinary Loading
change without a phone location. DDL success and capture-only tests missed it.
Parenthesize JSON operands and execute normal no-location, proof-required,
attributed-location and forged/stale report transitions after installing a wrapper.
Do not infer workflow completion from successful CREATE FUNCTION statements.

Owner: Tracking/mobile maintainers. The corrected157 wrapper and expanded phone
and selected-source SQL suites pass on the isolated October18 local clone.
No hosted completion is claimed.

## NR-55 — Failed quiet refresh relabels another query’s saved data

- Finding: source review found the native query error branch spread the previous
  state while replacing its identity/path key. A quiet refresh invoked after an
  actor/query change could relabel the earlier response as belonging to the new
  query when the read failed. No production exposure is claimed or observed.
- Prevention: clear data at every changed key, preserve it only for the exact
  same actor/path, and keep generation/blur checks on both success and failure.
  Authoritative401/403/404 reads clear buffered private data; temporary failures
  may retain the exact same query. Initial loading and same-query refreshing are separate presentation states;
  neither grants authority or bypasses server permission checks.
- Evidence: `apps/mobile/tests/account-query.test.mjs` executes refocus retention,
  failed cross-identity quiet refresh and superseded/blurred late responses;
  all four focused checks pass. Existing session-denial tests also pass.
- Owner: application/frontend. Status: repaired locally; release remains gated
  by owner visual review and the required promotion checks.

## NR-54 — New data store omitted from account erasure

GPS integration introduced raw telemetry, manual coordinates and device identity
in the app and a separate Traccar/outbox store. Existing erasure retains provider
and truck stubs, so foreign-key cascades never clean these new fields. Normal
closure blocks later ingestion, but an unlocked earlier owner check also permits
a concurrent post-closure insert. Do not treat inactive visibility as deletion.
Serialize the owner/device boundary, retire exact owned bindings, require verified
upstream cleanup, then erase app precise/device-identifying data. Employer devices
must survive employee-only deletion; unfinished Tracking holds remain authoritative.

Owner: GPS/privacy and account-erasure maintainers. FEAT-GPS/PLY/IAM-001 / ADR-080.
Read-only audit confirmed151/131/149 lack these paths.154 and the separate
bounded operator now pass actual local disable/erase acceptance, six app races,
and the gateway collection/retirement race. A second real defect was found during
that test: pinned Traccar6.3 removed the history foreign keys, so API DELETE204
leaves positions behind. Never infer retention cleanup from a successful delete.
ADR-080 permits an exact proof-bound500-row raw-history purge plus unlinked numeric
collection tombstones; no other device data or ordinary bridge ACL changes.

Evidence: `.local/telematics/privacy-verification-evidence.json` proves retained
closure history, held erasure before verified cleanup, actual raw/app absence,
post-erasure position/event denial and both primary trackers unchanged. The
`gateway-privacy-forward-rehearsal.json` proves a501-row history stays Pending
after the first call, completes only at zero and preserves other-device snapshots.
Earlier failed cascade, identity-list and fixture-snapshot receipts remain distinct.
Hosted installation, routine retention and real hardware remain pending.

## NR-53 — Device command reply refreshes location without a new fix

The first integrated GT06 bridge test ingested two actual simulated positions and
acknowledged Locate, then safely refused engine cut. Investigation showed a
Traccar command-result record carrying copied coordinates but no ignition was
also being ingested as a fresh position. A command acknowledgement is not a new
GPS measurement. Separate result processing from normalized telemetry; correlated
results may advance command state only. Malformed/uncorrelated replies cannot
publish location or imply completion. Preserve the engine interlock rather than
relaxing it to make the demonstration pass.

Owner: telematics bridge maintainer. FEAT-GPS-001 / ADR-080.
Evidence: `.local/telematics/bridge-verification-before-command-location-fix.json`
retains the failed integrated receipt. The corrected source passes focused worker
regressions and the actual integrated protocol run in
`.local/telematics/bridge-verification-evidence.json`: two ingested fixes, three
correlated command replies, synthetic cut/restore, and replay/tamper denial.
The independent command lane also prevents a slow telemetry batch consuming a
short engine-command lifetime; no timeout/interlock was relaxed. The restart
receipt proves two queued updates recover after bridge restart. These are local
synthetic checks, not physical hardware certification or hosted deployment.

## NR-52 — Background refresh interrupts staff logout

Actual phone testing found two interacting defects: Support polling continued
RSC refreshes during native logout, and logout built an absolute redirect from a
proxy-rewritten request origin. The browser aborted the navigation under the
existing same-origin form policy. A separately successful API request was not
accepted as UI success. Pause polling before same-window form navigation/pageleave,
seed the exact server revision, and use a fixed relative login redirect. Keep CSP,
origin checks, global revocation attempt and scoped cookie expiry intact; bound
the Auth call and distinguish unconfirmed remote revocation.

Owner: account/session and support refresh maintainers. FEAT-IAM/SUP/UIX-001.
Evidence:54 focused dashboard/Auth regressions and actual staff phone submission
pass: one POST,303,same-origin login,zero browser errors and no API fallback in
`.local/dashboard-cleanup-staff-origin-fixed-20261015/`. Earlier abort, hydration,
wrong-origin and deadline diagnosis receipts remain retained. Hosted release and
owner visual review remain pending.

## NR-51 — Retired service still consumes staff workload

Removing Guest support navigation left its Open conversations in the shared
staff workload count. A staff member could have an empty visible queue yet be
unable to claim Provider support. Retiring a service must reconcile actual
workload, not subtract a UI count. Migration152 closes only old Guest Open/Waiting
rows, records a one-time retirement event and preserves Provider/Brokerage state.
A rollback fixture proves full current-service snapshots unchanged, one-time
Guest closure and successful ordinary Provider claim afterward.

Owner: support operations maintainer. FEAT-GST/SUP/ADM/UIX-001.
Evidence: `tests/sql/retire-guest-support-workload-{setup,assert}.sql` composed
with exact152 twice passes on the fresh isolated v3 clone. Local installation and
strict catalog pass; hosted retirement remains pending.

## NR-50 — UI prefers an unselected phone source

GPS integration tests found four existing workspace consumers choosing the newest
phone location, even when the provider selected GPS or manual location. Database
source guards alone cannot make that UI honest. Consume explicit authorized source
selection, preserve actual published provenance while pending, and require a
post-selection phone report when returning to MOBILE. Never infer GPS verification
from source selection or publish private exact telemetry.

Owner: capacity/source integration maintainer. FEAT-GPS/CAP/GEO/SHR/MOB-001 / ADR-080.
Evidence: `tests/capacity-location-selection.test.mjs`,
`tests/provider-capacity-telematics.test.mjs`, `tests/location-source.test.mjs`,
and transactional `tests/sql/telematics.sql`. GPS/manual newer-phone negatives and
pending-GPS provenance assertions pass locally; browser/hardware and hosted rollout
are distinct evidence.

## NR-49 — A count exception accidentally grants authority to an invalid owner

October14's fresh v2 rehearsal correctly rejected the new one-unreviewed-truck
rule: its zero/one-Live shortcut returned true after account erasure made the
provider inactive. A dedicated rollback regression also reproduced the same
result for unknown provider/organization IDs. A publication-count exception
cannot replace the original requirement for a valid active provider owner.

Require the exact active personal-provider owner, or an active Transport Provider
organization owner, before considering either reviewed qualification or the free
slot. A soft-deleted Auth owner also fails. Private sharing remains supported;
do not confuse active ownership with public-profile visibility. Test unknown,
inactive, deleted, wrong-role, wrong-organization-type and invalid XOR scopes,
alongside the unchanged account-erasure assertion.

Owner: publication-policy author. FEAT-VER/FLT/PLY-001 / ADR-079.
Evidence: `tests/sql/provider-publication-owner-scope.sql` and unchanged
`tests/sql/provider-authority-erasure.sql` fail before and pass after the guarded
two-function delta on the isolated v2 clone. Sanitized receipts remain under
`.local/provider-fleet-145/`. The failed v2 rehearsal remains recorded. Final v3
applies145/146/148/149/150 to a fresh restored clone and passes both scope and
unchanged erasure suites, the other eight focused SQL suites and strict catalog
checks. The exact candidate is now installed in the backed-up Loadgistic local
preview, with its catalog and security checks passing. Evidence:
`.local/provider-fleets-20261014/{final-v3-rehearsal,local-install-v3-receipt}.json`.
Actual desktop/phone web and Expo onboarding, publication and review workflows
now pass with exact cleanup; see the October14 `specs/TRACEABILITY.md` receipts.
Owner visual approval, full release gates and hosted rollout remain pending.

## NR-48 — Historical approval prevents replacement after authority is lost

October14 rollback-only real-command acceptance on the isolated final clone
confirms that an ownership source remains Approved after its exact authority is
revoked, while a replacement upload fails `VERIFICATION_ALREADY_SUBMITTED`.
The verification subject projector also hides that category because it treats
generic document review as current exact authority. Together they leave the
provider unable to recover through the normal upload/review workflow.

Keep terminal document decisions, files and review history. For truck authority
categories, suppress replacements only for a current exact fact or a Pending
submission; repeat the rule in the serialized database command. A replacement
starts Pending and never certifies ownership or restores publication on upload.
Keep organization/driver categories, employed permission subjects and foreign
denials unchanged. Enrich only already-authorized truck subjects, in batches of
at most 100, and fail closed if current authority cannot be read completely.

Owner: verification backend/recovery maintainer. FEAT-VER/FLT-001 / ADR-079.
Evidence: `tests/provider-authority-recovery.test.mjs` and
`tests/sql/provider-authority-recovery.sql`; private sanitized RED receipt under
`.local/provider-fleet-145/`. The same actual rollback SQL now passes after only
the exact submission-function delta: ownership, permission and financed licence
revocation, changed truck identity, retained terminal source, Pending duplicate,
foreign/employed denial and browser boundaries. All 20 focused authority/document
unit tests pass. The existing subject advisory lock remains; a separate new
two-session upload race has not been run. The final v3 fresh-chain rehearsal now
also passes this actual recovery SQL, and the exact candidate is installed only
in the backed-up local preview. Evidence:
`.local/provider-fleets-20261014/{final-v3-rehearsal,local-install-v3-receipt}.json`.
Actual desktop/phone submission, waiting, rejection, replacement and staff review
now pass with real private uploads/file access and exact cleanup. The independent
expiry/financed-licence case also passes; see October14 `specs/TRACEABILITY.md`.
Owner visual approval, full release gates and hosted rollout remain pending.

## NR-47 — Restoring old read rules exposes records created under newer policy

October14 source review found that the proposed146 SQL rollback restored earlier
Capacity, public fleet and Featured definitions and removed the publication
trigger. Those older rules do not understand Draft trucks or qualification loss.
Once the new feature is used, retained records could become visible again even
though every restored function matches its original fingerprint. Migration150's
compatibility marker would remain true while authority commands lost their
service grants. A passing metadata-restore rehearsal is not a safe-data proof.

The rollback artifact now unconditionally rejects before mutation with
`PROVIDER_AUTHORITY_FORWARD_REPAIR_REQUIRED`. Preserve current read/write gates,
review/source history and fleet-erasure protections. Use a compatible application
rollback or a separately owner-reviewed forward containment plan with an exact
target and state-aware evidence; an older one-truck client is not assumed safe.
Existing authorized Tracking must remain usable. Do not delete newer records,
restore obsolete uniqueness or broaden hosted privileges/settings to recover.

Evidence: frozen146 discovery predicates and the withdrawn restore path; the
replacement `supabase/rollbacks/146_provider_vehicle_authority.sql` contains only
the explicit denial. `tests/sql/provider-authority-rollback-denial.sql` executes
the exact artifact inside a rollback-only regression and checks definitions,
owners, ACLs, settings, comments, the publication trigger and compatibility marker
remain unchanged. The exact-artifact denial passes in the final v3 fresh-chain
rehearsal; no unsafe restore was executed. The candidate is installed in the
backed-up local preview with catalog/security checks passing. Evidence:
`.local/provider-fleets-20261014/{final-v3-rehearsal,local-install-v3-receipt}.json`.
Visible owner/document workflows pass locally; owner visual approval remains
pending. No full release gate or hosted rollout is claimed.
Owner: migration/recovery author. FEAT-FLT/VER-001 / ADR-079.

## NR-46 — A new driver inherits stale availability or an older save wins

October14 isolated real-command acceptance reproduces assignment Off Duty followed
by a successful availability save that still appears Off Duty. The new reset uses
write-time `clock_timestamp()`, while the old publisher uses transaction-start
`now()`. A request waiting on a lock can commit with an older timestamp. Calling
this a fixture problem and rewriting test timestamps would hide the defect.

Use the current truck lock and a monotonic actual-write timestamp for current
capacity mutations. Preserve assignment time for an unchanged pair; give a new
pair a new time. Duty/location bootstrap must not revive a previous driver's
availability or phone point when drivers change or later return. Keep old
records as history, not the new driver's current report. Regressions must execute
real commands in sequence and across two waiting sessions without editing
fixture timestamps to make ordering pass. FEAT-FLT/CAP-001 / ADR-079.

Owner: fleet/capacity author. Status: corrected and installed locally. The actual
same-transaction chronology and returning-driver checks pass; six controlled
two-session cases pass, including a publisher waiting for assignment and a
publisher whose permission is revoked while waiting. Exact cleanup passes:
`.local/provider-fleet-145/{chronology-green,current-pair-green,concurrency-receipt}.json`.
Final v3 rehearses the unchanged145 source with146/148/149/150 and passes the
foundation/current-pair SQL and strict catalog checks. The exact candidate is
installed in the backed-up local preview. A separate v3 concurrency receipt also
passes two Draft additions, one unreviewed Live slot and both current-assignment
invariants, with exact synthetic cleanup:
`.local/provider-fleets-20261014/{final-v3-rehearsal,concurrency-v3-receipt,local-install-v3-receipt}.json`.
Actual desktop/phone owner/employee assignment and driving-home workflows now
pass. Cross-driver browser handover, owner visual approval and physical moving
GPS remain separate checks; local evidence does not establish hosted deployment.

## NR-45 — A shared renderer change misses an authorized internal caller

October14 local pre-release acceptance caught an Operations Tracking crash:
the shared map expects a typed route/location projection, but the admin page
still passes the legacy RPC object. Earlier component tests replace that port
with null, so compilation and presentation checks miss the populated case.

When changing a shared renderer's input, inventory every public, provider,
Driver, guest and staff caller. Exercise real nonnull adapter shapes as well as
denials; a null-only mock is not connected-workflow evidence. Normalize at the
boundary rather than casting old data to the new type. Saved place references,
coordinates, privacy radius and public-consent fields must remain factual.

The repair retains the existing database Operations gate before its exact
route-column read and rechecks authority/current obscured location afterward.
It never calls revoked internal helpers, impersonates a provider or fabricates
a public truck summary. Six current-source regressions fail before the repair;
all seven pass afterward, including denied/null zero secondary reads, final
revocation/reset, private-field exclusion and the actual page conversion.
Evidence: `tests/admin-tracking-map-contract.test.mjs`; actual desktop/phone
lifecycle verification also passes saved route/circle, reassignment/reset,
retire/restore, cancellation authority, guest revocation and retained history:
`.local/internal-workflows-20261014/lifecycle-internal-repaired-runner.json`.
Owner: workflow/release author.
Production is unchanged; no SQL or privilege change is required.

## NR-44 — A restored extension can lose its member table's RLS

Status: reproduced on an isolated local restore, not an exposure in the original
local database or live project. Owner: backup/recovery maintainer. Contracts:
FEAT-SEC-001 / BASE-DEP-001.

The October14 fresh backup has RLS on every public table. `pg_restore` recreates
PostGIS as an extension, leaving its `public.spatial_ref_sys` member with default
RLS disabled. Both command repairs143/144 are unrelated to that table. A clone's
pre/post-migration equality alone would mistake this unsafe restored baseline
for a faithful copy; successful dump/restore exit codes are insufficient.

Compare security metadata against the source snapshot and run the strict catalog
gate on every restored copy before treating recovery as verified. For this exact
local PostGIS case, restore only the exact snapshot's member-table grants and
reuse the existing owner-run containment SQL in the isolated copy, after checking
its extension membership, existing owner, source protections and unchanged
reference rows. The first containment attempt correctly refused because restored
service-role SELECT was missing; its transaction rolled back. No role membership, ownership transfer,
catalog bypass, hosted operation or disabling a check is authorized. A hosted
restore needs its own owner/provider procedure and reviewed recovery plan.

Function/aggregate metadata must also be compared semantically across databases:
21 PostGIS aggregate OIDs differ after recreation. Normalize their actual argument
and state types, transition/final functions and settings; keep exact comparison
for ordinary function definitions, owners, ACLs, configuration and comments.
Within one database, retain exact before/after fingerprints. Never ignore the
aggregate inventory or an RLS mismatch to make restore verification pass.

Evidence: `.local/internal-workflows-20261014/combined-local-review-evidence.json`
records the completed fresh restore and strict catalog pass, two candidate SQL
regressions, all1,085 original semantic function/aggregate records, preserved
permissions and no unprotected public tables. Original and live databases were
not changed by this clone-only restoration.

## NR-43 — Independent moderation decisions can republish restricted reviews

October14 source audit (WEB-MOB-035): content-report RESTORE writes PUBLISHED
without considering another HIDDEN report or terminal rating removal; rating
UPHELD similarly ignores active content holds. The canonical public profile read
and review summary select PUBLISHED only, so the conflicting persisted state can
expose the review text and count it again. No shared-preview or hosted reproduction
is claimed at discovery.

Prevention: derive the effective publication state from every independent current
restriction on the exact review. HIDDEN content reports and terminal REMOVED
rating decisions remain effective until their own permitted workflow changes
them. Serialize both queues on the same review row before checking restrictions;
never restore another queue's state or invent permission from a report ID. Preserve
terminal replay denial, current Trust authority, notes and audited attribution.

Owner: Trust/moderation backend maintainer. Exact migration143 patches pass
`tests/sql/review-moderation-restrictions.sql` on an isolated clone; the same final
regression fails on exact original functions. Multiple reports, both decision
orders, terminal rating removal, revoked Trust, unrelated reviews, direct browser
execution, public text predicate and actual count/average pass. Two real sessions
verify review-row serialization; eight rollback-drift cases, replay refusal and
exact rollback retain function metadata and row/ledger fingerprints. Protected
previous functions deny browser and service execution.

The first clone's catalog check failed PUBLIC_RLS_REQUIRED for `public.spatial_ref_sys`.
NR-44 separately proves this was a restoration omission: the original main local
table is protected. The fresh combined143/144 restore now retains its exact source
grants and RLS and passes the strict catalog gate; no check was suppressed.
Review manifest: `.local/review-moderation-143-20261014/review-manifest.json`.
Installed locally after the fresh restore; both actual desktop/phone moderation
cases now pass saved Hide/Restore/Uphold/Remove, canonical public HTML/API text/
count/average, overlapping holds and stale revoked-authority denial. Receipts:
`.local/internal-workflows-20261014/main-143-144-install-receipt.json` and
`.local/internal-workflows-20261014/moderation-conflict-actual-runner.json`.
Next: owner visual review and separate release/hosted approval. Scoped green
results are not full release or hosted readiness.

## NR-42 — Background workspace requests invalidate a pending signup

October13 real Expo signup verification returns200/ONBOARDING and the policy
read returns200, then the client loses its saved session and returns to login.
Source inspection finds global member chat/handover activity using any verified
session, including ONBOARDING and JOIN_FLEET. Those endpoints require ACTIVE;
the account controller correctly revokes a session after ACCOUNT_UNAVAILABLE.
An actual9.8-second local reproduction confirms one403/ACCOUNT_UNAVAILABLE from
each alert endpoint, followed by that same actor's cleared saved session.

Prevention: start member chat/handover, native push and background shipment
location activity only for a server-confirmed ACTIVE identity. Pending identities
may perform their existing policy/signup/join commands. Preserve server denial
and revoked-account clearing; never make protected endpoints accept an inactive
identity to conceal the client lifecycle error. Guest chat remains separately
authorized. Test real unknown-email signup and invited-driver joining with all
global providers mounted, not only seeded active accounts or isolated screens.

Owner: native session/activity maintainer. The minimum three client guard lines
pass six old-failing/new-passing actual-component cases and26 focused activity,
controller, chat and background checks, plus mobile types and scoped lint.
Next: affected actual local workflows and separate installed-device/release
evidence. No hosted change is authorized.

## NR-41 — Changing staff access silently removes their responsibilities

October13 account-maintenance audit: the generic User activation command copies
an older five-field permission snapshot into the staff updater. Brokerage and
Featured were added later, and omission becomes false. Suspension/restoration
therefore revokes those grants even though the administrator changed only active
state. Reading the snapshot before acquiring the updater's row lock also allows
an overlapping explicit permission save to be overwritten.

Prevention: FEAT-ADM-001 distinguishes activation from explicit permission edits.
Lock the current staff row before forwarding its complete permission state;
preserve all assigned responsibilities and existing chat requeue/audit behavior.
Every added permission must join both the authoritative activation contract and
an actual preservation regression, including serialization with a concurrent
explicit save. Never assume passing create/login tests prove maintenance.

Owner: account/admin backend maintainer. Actual old-failing/new-passing SQL,
two-session race, drift refusal and exact rollback pass on an isolated clone.
The owner-approved142 is installed on the local preview with preserved function
ACL/owner/settings, rows and ledger; rollback-only staff/141 integration passes.
Next: real staff edit/suspend/restore/revoke workflows, owner visual acceptance
and separately reviewed hosted rollout. Local enforcement is not hosted proof.

## NR-40 — A personal business-name copy bypasses first-name privacy

October19 regression: the multi-vehicle owner contact command introduced in145
split a legacy name field and overwrote structured first/last names saved under141.
Rollback-only personal identity acceptance reproduced the change. Migration175
removes only that implicit split, preserving the original owner scope/locks,
callback synchronization, audit and ACL. The fresh local backup, isolated restore
and updated real projection/identity test pass. Owner: identity/backend
maintainers. Next: retain the regression in CI and include175 in the exact
reviewed hosted bundle; no hosted correction is claimed yet.

October13 source audit: personal accounts retain a legacy business_name and
full_name. Several public projections publish business_name directly, while
others split only an ASCII space and can retain surname tokens after Unicode
whitespace. UI truncation cannot protect serialized responses or the search
index. Driver and transporter preset pools also reuse photographs, confusing
which identity a picture represents. Own-driver public callback editing is
absent despite a separate private account phone.

Prevention: FEAT-IAM-001 / FEAT-PRV-001 require one safe personal first-name
projection at every public and email-guest boundary, explicit structured first/
last-father editing without guessed historical splits, and independently chosen
public phone/photo fields. Company business information remains under its
existing publication rules; private owner/driver management retains current
authority. Omitted legacy fields must not erase saved public choices. Distinct
photo commands/pools and honest role icons prevent stock-person fallbacks.

Owner: identity/backend and web/native maintainers. Next: actual SQL and response
privacy negatives, cross-actor contact/image denial, edit/reload/upload/remove
browser checks and separately reviewed141 rollout. A rollback that restores old
public name projections reintroduces the disclosure; it is only a bounded
recovery artifact with personal public serving blocked, not an acceptable
public-serving application version. Retain141 privacy guards for app fallback.
New personal columns must also join the existing account-erasure scrub;131's
explicit old-column update does not automatically clear fields introduced by141.
Test actual deletion with seeded new fields and unrelated-record preservation,
retaining135/136 shared-file and retention guards. Implementation and provider
enforcement are not claimed from this audit alone.

Local rehearsal evidence now proves the new-field erasure and public/private
denials, preserved original ACLs/owners/settings, service-only helpers and safe
post-use rollback refusal. Before browser testing, apply only the exact approved
local schema; source tests cannot prove a preview still using the older database.
Keep main/clone/hosted installation and visual acceptance separately recorded.
Rehearsals also caught PostgreSQL identifier truncation in long backup names and
an invalid intermediate definition from coupled SQL text replacements: assert
every exact backup name and apply the complete valid expression atomically.

Actual web upload testing also found an own-preview adapter accepting JPEG only
while the existing validated upload/storage policy preserves JPEG, PNG and WebP.
Reuse that exact validated image allowlist and stored content type, deny other
MIME types, and prove actual painted preview bytes rather than only a successful
upload. Authorization, subject scope, Cookie variation and no-store remain
independent required assertions. Next may append its own Vary tokens; require
the exact Cookie token within the list rather than insisting it is the whole
header. Replacement/removal and all browser workflows remain separately tracked.

## NR-39 — Account-wide routes appear to belong to every truck

October13 source audit: profile_routes has truck/driver assignment columns,
but regular commands, workspace and public/private discovery joins ignore them.
One provider route therefore appears under unrelated trucks. Removing only the
profile section would leave incorrect map, search and Featured geometry.

Prevention: FEAT-CAP-001 requires the selected truck and expected current driver
on every regular command, repeated ownership/permission/assignment checks and
one route per pair. All projections use that pair, including copied cluster
and private-search functions. Retain legacy unbound records without guessing,
cloning or promoting them. Retiring Services also requires preserving its
stored text on omitted/old commands while removing public/indexed exposure.

Owner: fleet/capacity backend and web/native maintainers. Next action: scoped
SQL permission/stale-assignment and cross-truck projection regressions, actual
save/remove browser checks and separately reviewed migration140 rollout. Source
audit is not proof of installed enforcement; implementation is in progress.

The retained server-only cluster function also lacks the later PUBLIC/BOTH and
content-hidden/review-workspace guards present in detail/search projections.
Current public HTTP, page and mobile callers do not request its overview mode,
and browser database roles cannot execute it; no live public disclosure was
established. Since140 already changes that function's route join, add the same
public eligibility guards and actual private/moderated cluster negatives without
restoring an overview UI or changing the clustering algorithm.

## NR-37 — Multi-choice filters change the controls but not the authoritative match

The former parser/SQL accepted scalar options. Sending comma values from a new
control alone would produce incomplete public/private/profile results. Separate
profile-search parsing also accepted the last repeated query key, and oversized
blank values were normalized to unrestricted before the size check. Independent
review found both; negative tests fail before the repairs and pass afterward.

Use one bounded canonical value for each option group, match alternatives within
the group and combine every other group, and keep every selected document required.
Validate at HTTP/SSR and the SQL boundary, reject ambiguous repeats/unsupported/
excessive values, preserve existing scalar callers and test real public/private
rows, grants/revocation, route endpoints and cursor pages.139 updates all three
installed match functions without replacing their surrounding privacy/cost fixes.
The Expo preview additionally requires explicit aria-checked alongside native
accessibilityState; actual checkbox and decoded-image tests prove the visible
control instead of inferring it from a component-state test.

Evidence: capacity-filter values/HTTP/SSR tests, SQL capacity-multiple-options,
web/native component checks and all14 focused browser cases. Owner: capacity/API
and native UI maintainer. Local verification complete; owner visual review,
hosted139 and matching Android publication remain separate next steps.

October13 NR-08 evidence: the security-advisors workflow exists in this working
branch but GitHub's default branch cannot dispatch it (HTTP404). Its source is
not evidence of installed monitoring. The approved pinned read-only CLI check
instead reports ledger136, a passing catalogue, zero ERROR and two WARN findings;
the strict advisor gate remains failed. Both findings are the previously reviewed
caller-only current_user_projection and auth_leaked_password_protection warnings.
The owner approved the exact Featured137-only exception with those warnings
visible; any additional warning/error still blocks. No gate is weakened, hosted
settings changed or monitoring installation claimed. Next: verify the monitor's
real installation/execution separately and retain the reviewed Auth/identity
follow-ups. Owner: release/operations maintainer.

## NR-33 — Saved task registration is mistaken for a running tracking service

After a data-preserving Android APK update, the restricted synthetic driver
restored normally, Android grants and shipment eligibility remained valid, and
foreground callbacks saved updates. The location foreground service was absent,
without a UI warning. The old adapter skipped startup when Expo reported its
persisted task registered; this cannot prove its native service restarted.

Request startup once per JavaScript process even for an existing registration;
retain batching during later synchronization. Serialize starts/stops, invalidate
obsolete readiness and permit bounded retries after failure or registration loss.
The real adapter fails the cold-task counterexample before repair; all eight
`apps/mobile/tests/location-service-lifecycle.test.mjs` cases pass after repair.
Permissions, cadence, consent, device authority and approximate coordinates are
unchanged. Owner: native tracking maintainer. Verified: matching final source
04e27fe / CI 38297279274 all eight jobs and real installed cold restoration,
requested foreground service, saved approximate update and normal closure pass.
Retain these lifecycle negative checks and explicit actual-service evidence for
future native releases; task registration alone remains insufficient.

## NR-32 — A retained authentication screen traps an authenticated area switch

The review form redirected across tabs into the workspace. Its Marketplace
stack retained that form, so returning to Marketplace immediately redirected
back to the workspace. Two fresh installed-Android taps reproduced the loop;
the real local review-login regression then failed with Capacity hidden after
authentication. Normal email-code login is unaffected.

Replace the completed review form inside its own Marketplace stack with
Capacity. Preserve the two area destinations, ordinary authentication and
normal logout. `tests/e2e/mobile-review-navigation.spec.ts` uses an isolated,
restricted synthetic account, actual password authentication and real area
controls; it checks both directions, a remembered About page and sign-out.
Owner: native navigation maintainer. Verified: regression and final installed
04e27fe route unwinding, both area switches and normal closure pass. Preserve
both browser workflow and actual native acceptance on future navigation changes.

## NR-31 — Transient refresh clears the current native workspace

Returning from Android permission setup unnecessarily rotated a still-valid
session. A timeout cleared the in-memory actor and interrupted the attempted
shipment-location demo. Resume now reuses a current actor with at least one
minute remaining; explicit reload still refreshes account state. A transient
refresh failure can retain only the same unexpired actor. Requests remain
authorized by the server, and denied/expired access, invalid responses, storage
failure, sign-out and account replacement never acquire this fallback.

`apps/mobile/tests/account-session.test.mjs` verifies permission return without
rotation, concurrent near-expiry renewal, recovery, expiry during a failed
refresh, 401/403 denial, invalid responses/storage failure and late results after
logout/account replacement. This creates no private offline cache, longer token
lifetime or authentication bypass. Owner: mobile session maintainer. Verified:
final standalone permission return, actual service/update/cold restoration/stop
and exact eight-job CI pass. Keep expiry/denial/account-epoch regression checks;
physical-phone GPS/push acceptance remains separate.

## NR-28 — Product priorities leak into promotional copy

The draft used “Capacity, routes and availability first. Tracking after agreement.”
as customer copy. That restated an internal priority instead of selling a useful
outcome. The owner corrected it. Current copy leads with “The trucks you know.
The space you need.” and recognizable East African freight operations. Keep
review/checklist language in protected review materials, outside exported
customer fields. `tests/platform-narrative.test.mjs` rejects the priority phrase
and internal release/approval labels in customer copy. Actual wording and artwork
still require owner review; a negative phrase test cannot certify good marketing.
Owner: product/marketing maintainer. Next: review the local presentation before
publishing final assets, listing or app copy.

## NR-29 — Small fixtures hide failing reads and native render conditions

Featured's capacity query grows beyond the gateway URL limit as trucks increase;
the local 236-truck Sunday request failed with HTTP 414. Identifier reads now
batch and paginate, including capacity history and public provider candidates.
`featured-candidate-reads.test.mjs` verifies 1,105 candidates, latest-record
precedence and no partial result on failure. Saved rounds/order remain unchanged.
Tracking additionally rendered an empty error string directly in a native View,
producing an error overlay and blocking the bottom navigation. Safe Boolean
guards repair the same class across mobile controls. The typed JSX scan in
`native-text.test.mjs` tests and rejects empty-string/zero conditions throughout
the mobile source. Featured and visitor Tracking validate API structure before
rendering; `runtime-content.test.mjs` and real local email/browser workflows prove
visible retry, session restoration, detail access and normal closure. Do not hide
the overlay or count an HTTP 200, screenshot or typecheck as workflow acceptance.
Owner: Featured/native maintainer. Next: verify the matching installed Android
artifact and exact release gates; existing code 5 predates these changes.

October13 extension: a global Playwright `x-forwarded-for` header caused OSM
CORS preflight failures, while HTTP/profile/proof tests still passed. A clean
local-only-header comparison loaded12tiles (HTTP200), both worker bundles and
no map errors. Map acceptance must inspect a real basemap as well as geometry;
scope synthetic client-IP headers to verified local app/API origins and retain
the same IP for browser and direct API calls. Fix the harness without disabling
CORS, suppressing errors or changing the production map.

## NR-30 — Pixel offsets become false geography at distant zoom

Lane separation projected at the current world zoom moved a route over 318km
from its source in the regression. Actual generated vertices remain under 1km
from the source in both MapLibre and Leaflet projections. Real records/matching
are unchanged.

October 11 CI follow-up: a global floor based on worst-case joins compressed
ordinary shared legs at closer zooms. Bound actual generated vertices separately
and preserve feasible 12px paired-lane spacing. Keep the existing real tap-target
regression alongside world-distance checks; neither check may replace the other.
The shared-leg browser test must establish actual street scale, rather than
assuming two zoom clicks suffice on every viewport. Native
rendered reads also lacked a camera revision check, allowing delayed old results
to overwrite a new view. `visible-query.test.mjs` controls those races; geometry
tests cover world zoom, high latitudes, reversed legs and closed areas. Actual
local captures and repeated zoom/exit tests supplement the pure algorithms.
Preserve global panning, separate Empty/Partial counts and normal interactions;
do not fix performance by adding manual loading or a country lock. Owner: map
maintainer. Next: owner review and matching installed native/runtime checks.

### October 8 legacy overview/search drift — NR-08/13

An obsolete public `overview=1` parameter reached an older aggregate predicate
instead of the current profile/sharing-aware discovery path. Retire the HTTP
switch while preserving normal results; keep the service-only raw aggregate
separate from current search claims. Desktop/phone API regressions compare IDs,
cursors, provider scope and absence of legacy cells. Do not fix scale tests by
weakening profile/privacy gates or labelling old identifier matching as current
profile search. Migration 130 instead removes unnecessary document work while
preserving requested filters and default presentation. Local regression/scale
evidence is in PROGRESS. Owner: search/release maintainer. Next: complete exact
CI, scoped rehearsal/review and matched rollout.

### October 8 approval retention blocked by an ephemeral recipient FK — NR-08/10

Fresh managed workflow verification exercised proof-backed owner completion and
then retention cleanup. The completion event's FK kept the temporary recipient
row from being deleted. Migration 129 records an explicit, constrained OWNER/STAFF
approval snapshot and uses SET NULL for the temporary recipient reference; actorless
non-approval events remain forbidden. No authority, proof, session or browser grant
is widened. `tests/sql/tracking-owner-retention.sql` verifies contact/OTP cleanup,
expired guest denial and preserved timeline/proofs/completion after approval.
The local verifier also uploads and reads actual proof bytes before completion.
Owner: Tracking/release maintainer. Next: exact CI, refreshed full restore/rehearsal
and scoped owner review of this additional migration before hosted rollout.

## NR-17 — Retired commercial models must not gate user access

The October 7 audit found dormant paid-mode controls, plan/payment Account cards
and automatic trial provisioning despite the owner's transport-arrangement-only
revenue model. Free mode still required a subscription row in operating scopes.
Hiding billing links alone would leave new providers blocked or stale clients able
to revive paid access.

FEAT-BIL-001 and migration 120 retire plan-dependent access, paid activation,
trial provisioning and billing mutation commands together. Identity, tenant and
driver checks remain. Historical rows/files and browser ACLs stay protected.
Negative evidence covers no-plan signup, inactive/unlinked denial, rejection before
uploads, stale-client writes and unchanged historical record counts. Owner:
identity/billing maintainer. MOBILE_IMPLEMENTATION.md records actual evidence and
rollout state; local success is not hosted rollout.

FEAT-SEC-001 / ADR-063–065. This register turns security lessons into required
review and negative tests. It includes observed failure classes and related
regression risks; it is not a claim that every listed risk caused an incident
or that any customer data was compromised. IDs are stable: append new lessons
instead of renumbering or deleting them.

## Required lesson checks

| ID | Failure or risk and cause | Prevention and evidence | Responsible role |
|---|---|---|---|
| NR-01 | A public application or extension table is reachable without RLS. Installation defaults and extension ownership were mistaken for security guarantees. | Inspect every resulting public ordinary/partitioned table. `scripts/check-database-security.sql` includes extension tables; its injected missing-RLS fixture must fail. `tests/sql/security-boundaries.sql` proves reference-table denial and preserved service geography. Owner-only extension repair is separate from API containment. | Migration author; release owner |
| NR-02 | Browser access returns through broad grants, PUBLIC inheritance, column ACLs, views, sequences or future defaults. RLS alone is treated as permission to expose a second application command path. | Migration 096 removes application grants/defaults. `tests/sql/browser-boundaries.sql` covers active/inactive sessions and future objects. `scripts/verify-database-security-gate.mjs` injects table, column, PUBLIC, view, sequence and future-default exposure and requires rejection. | Migration author; CI maintainer |
| NR-03 | A SECURITY DEFINER helper becomes a public endpoint, including through default EXECUTE grants. | Explicitly revoke browser execution except the caller-bound identity contract. The catalog gate rejects unexpected browser-callable application definer functions; the negative verifier creates a new default-executable definer to prove rejection. Never use a caller-supplied actor ID as identity. | Database/API author |
| NR-04 | A request hook is removed, replaced, runs with owner rights or trusts a forged service header. | Migration 097 uses the actual invoker role and a narrow identity path/schema/method allowlist, refuses unrelated hooks, and preserves service access. `scripts/verify-data-api-guard.mjs` exercises SQL roles, real REST/GraphQL and unsafe configuration fixtures; the anonymous HTTP monitor requires the exact denial response. | API author; operations owner |
| NR-05 | A successful hook test is misreported as full database repair, or assumed to protect another access path. | Keep RLS/ACL and advisor gates independent. Inventory exposed schemas, direct login roles and replication publications before rollout. Separately review Storage and Realtime. Record containment, permanent repair, app release and active monitoring separately. | Release owner |
| NR-06 | A broad remote configuration operation overwrites unrelated Auth/provider/SMTP settings, or a timeout causes a duplicate write or blind restore. | No hosted config push/bulk replacement. Require exact target, old/new fields, immutable digest, protected recoverable snapshot and bounded execution. On ambiguity stop writes and inspect. `docs/PRODUCTION_AUTHORITY.md` defines the owner workflow; repository text cannot constrain an unrestricted administrator shell. | Owner executing the approved operation |
| NR-07 | “AI guardrails” exist only in prose while the same identity retains administrator credentials; a monitor is granted write authority. | Separate runtime, read-only monitoring and owner deployment credentials. Advisor tests reject classic-token fallback, wrong projects, redirects and malformed findings. HTTP monitor tests reject service credentials and use row-free anonymous GETs. Provider/OS credential separation and independent approval must be installed and verified by the owner; a filename/token prefix is not proof. | Account owner |
| NR-08 | Release readiness is claimed using an old commit, a backup never restored, a scheduled file not installed, or a generic permission error masking a broken guard. | Bind checks to the exact commit and artifact hash. Restore the exact encrypted archive in isolation. Verify real API and browser behavior. Monitor tests fail on open endpoints, unrelated denials, missing configuration and unavailability. Record workflow installation and successful execution independently. | Release owner; CI maintainer |
| NR-09 | Account closure removes login UI access but stale tokens or retained membership still authorize writes; history is deleted during “cleanup.” | Recheck active actor and tenant authority at mutation boundaries; retain history and deny browser database shortcuts. Run `tests/sql/browser-boundaries.sql`, `tests/sql/account-security.sql`, `scripts/verify-audit-concurrency.mjs`, and account-security browser workflows. | Identity/domain author |
| NR-10 | Customer files, credentials or backup content leak through public storage, browser code, logs or build context. | Keep server credentials server-only, reauthorize private reads, and exclude local credentials/backups from images. Run `tests/private-storage.test.mjs`, `tests/sql/tracking-proof-access.sql`, relevant attachment tests, and the CI container-context canaries. Never log tokens, OTPs, customer rows or recovered backup contents as evidence. | Storage/runtime author; release owner |

NR-10 local test-runner correction (October 7): a Playwright request timeout
included a temporary local test-session Cookie in its exception call log. The
disposable sessions were closed in cleanup, the ignored local log was sanitized
and protected, and the new browser verifier records only stage/error name rather
than raw request exceptions/causes. No hosted credentials or customer record were
involved. Future runners must preserve failure status without printing headers;
fixture cleanup must stay exact even after timeout. Owner: test-runner author.
This is a bounded runner correction, not a claim that all historical test tools
or provider logging are now audited.


| NR-11 | A successful build is published with a broken server bundle because a nested checkout changes workspace tracing or deployment tools repackage the adapter incorrectly. | Build an immutable code-only export with no parent workspace; verify the final uploaded function retains its adapter manifest, runtime configuration and module paths. Exercise a cold start on the provider before publication, then verify production health and desktop/phone workflows. Keep the previous working deploy available; preserve database containment during application rollback. September 20 attempt 6ab03906b83e9eec579c7bc0 failed runtime verification and was rolled back; corrected release evidence must be recorded before closure. | Release owner; CI maintainer |

| NR-12 | A pilot importer writes raw object paths that the authorized private-file reader cannot resolve. Backup restoration and row counts alone miss broken visible document controls. | Import the canonical private-storage URI, exercise the importer mapping through the private reader, and click the deployed document control with exact-byte and guest-denial checks. Repair only the reviewed fixture-tagged record set, with drift checks and recovery; never rerun the bulk seed or loosen the reader to accept arbitrary paths. PILOT-FILE-001 affected 335 synthetic records; the owner approved the bounded repair, it was applied and independently verified, and desktop/phone document bytes and guest-denial checks passed on September 21. | Fixture/import author; release owner |

| NR-13 | A performance fix changes appearance or adds user steps without approval; specs/tests are rewritten to accept it and passing CI substitutes for owner review. | Preserve the original workflow and result completeness; keep server mechanics internal. Require approval of a specific UX tradeoff before implementation, and a running local desktop/phone review before UI deployment. See [map incident and open repair checklist](MAP_PERFORMANCE_REGRESSION_2026-09-21.md). Local restoration removes the manual modes/loading controls; 13 focused unit and six desktop/phone browser cases pass. Owner visual review and extensive release gates remain pending; no corrective release. | Implementing agent; release owner |

NR-02/03/09 onboarding check (2026-09-21): assignment eligibility must not become
proof of email ownership. Migration 099 leaves Auth email unconfirmed and denies
unverified caller-bound workspace projection; owner registration cannot adopt an
existing provider, another fleet, suspended or reserved identity. Its preparation
and registration RPCs explicitly deny browser execution. The rollback-only
`tests/sql/driver-preverification.sql`, legacy invitation regression and catalog
gate pass locally; desktop/phone real-OTP workflows confirm login preserves the
prior assignment. No auto-confirmation, password creation or owner-accessible
Driver session. Owner: identity/migration author. Next: owner visual review, full
release gates and separately authorized rollout.

NR-08 backup lesson: a timed-out exporter may still return a zero process status
or leave an authenticated but incomplete encrypted archive. Treat a timeout as
failure independently of exit status; fully restore the exact archive before it
can satisfy the release gate. The September 20 truncated export was rejected by
restore, preserved as invalid, and replaced with a fully restored archive before
migration. Owner: backup/release operator.

### Featured rotation check — 2026-09-21

NR-01/03: migration 098 creates its selection ledger with RLS and explicit browser privilege revocation in the same transaction. Only the existing service-authorized generator writes history; browser execution remains denied. The rollback-only `tests/sql/featured-random-rounds.sql` and resulting catalog security check passed locally. Saved-roster fingerprints were unchanged after local application, and a separate two-session check confirmed concurrent generation returns without writing while the advisory lock is held. CI now includes the regression; hosted execution is not claimed. Owner: migration/release author. Next: owner UI review, full release gates and separately authorized rollout.

## How to use and maintain this register

NR-04/NR-05 relocation lesson: a guard monitor must probe stable application
relations rather than require an extension table to remain in an exposed schema.
The relocation regression in `tests/data-api-monitor.test.mjs` still rejects
missing application routes, unrelated denials and open endpoints. Before moving
an extension, verify its target schema, data, dependent types/functions/indexes
and application queries; retain separate evidence for a logical-copy rehearsal
and the provider's actual in-place execution. Never broaden exposed schemas to
make an obsolete monitor URL pass. Owner: release operator and CI maintainer.

1. Before a sensitive change, identify the affected IDs and linked specifications.
   Review all objects created by an extension or migration, not only named app
   tables. An ownership error stops that operation; it is not permission to
   escalate roles, edit catalogs or delete/rebuild dependencies.
2. Run the relevant negative tests and compatibility checks. CI enforces the
   catalog and request-boundary tests on a clean migrated database. Missing,
   failing or unavailable required checks cannot count as success.
3. In the PR, record exact-commit evidence and applicable IDs. For a new defect,
   append an ID with cause, preventive control, test/probe, responsible role and
   any unresolved next action. Do not put secrets, customer records or private
   support correspondence in this register.
4. Record operational state in the protected rollout evidence and project
   progress: implemented, locally verified, CI verified, hosted verified,
   scheduled monitoring active, and provider enforcement installed are different
   claims. Each requires its own evidence. Deferred setup keeps its owner and next
   action visible; a checked documentation box cannot substitute for deployment.
5. After any incident, contain access first, preserve history, inspect the full
   related access surface, add the regression, and verify recovery before release.
   Never suppress the alert or weaken the test to mark the lesson closed.

## Enforcement limits and remaining setup

Repository tests detect these classes during verification; they cannot stop an
administrator from making a direct out-of-band change. The API guard contains
one access path, not every database service. Scheduled monitoring requires its
workflow on the default branch and configured credentials; a missing token must
remain a visible failure. Independent owner approval requires a separate coding
identity and provider protections, not two actions by the same administrator.

The account owner is responsible for installing that credential/approval
separation, activating monitoring and verifying notification delivery. The release
owner records those outcomes in `docs/PROGRESS.md` and the protected operational
evidence. No assertion that these controls are installed may be inferred from
this register. No system can promise that a security issue will never recur;
the required outcome is prevention where possible, detection, bounded authority
and a tested response when a control fails.


| NR-14 | Demo email correction is undone by a later seed, affects a real identity, or forwards automated mail to real recipients. | Bind corrections to exact Auth IDs, fixture markers/keys and old/new email digests; rehearse profile synchronization/rollback and retain roles/history. Preserve authoritative existing email in additive imports (`tests/production-pilot-policy.test.mjs`), keep plus aliases distinct (`tests/auth-flow.test.mjs`), and scope local relay matching/manual release to the owner-approved recipient pattern with relay-all off. Keep inbox and external-delivery evidence distinct. See `docs/operations/DEMO_ACCOUNT_EMAILS.md`. | Fixture/identity maintainer; operations owner |


### Mobile summary growth caught before release — 2026-09-23 (NR-13)

Adding company evidence introduced a third document group into the selected truck
card. The phone layout stacked all three groups and left too little exposed map;
refresh errors could also crowd the filter handle. Full CI stopped the release:
three mobile map tests failed and reproduced locally. Do not waive exposed-stroke,
control-overlap or retry checks when adding copy, badges or document subjects.
The local correction uses two columns for the existing document controls; all three
mobile regressions pass with real taps, zoom and recovery. Desktop verification also passes; fresh owner visual review precedes another
release attempt. Production remains
unchanged. Owner: UI author/release operator; evidence is recorded in PROGRESS.md.


### Transport callback inbox — 2026-09-23

NR-01–04/08/10: migration 103 enables RLS and revokes browser table/RPC access
before exposing the new private callback queue. Only active ADMIN actors may
list/update; contacts and notes never enter audit details or public projections.
Rollback-only SQL checks prove browser/Support/transporter/inactive-admin denial,
idempotent creation, stale-edit rejection and retained history. Resulting local
catalog checks pass. Desktop/phone API tests prove cross-origin denial, bounded
input and anonymous throttling; real browser tests prove no email and persisted
follow-up. This is local evidence, not hosted enforcement or deployment evidence.
Owner: migration/release author. Next: owner visual review (NR-13), complete gates,
fresh backup/restore rehearsal of 102/103, reviewed production rollout.

### Launch recovery and phone layout — 2026-09-24 (NR-08/13)

Bounded access requests must include response-body reads and release the busy
state without discarding entered details. For Tracking creation, a lost response
can follow a committed write: retain the draft, prevent another submit and link
to the existing Tracking list. This is a browser recovery guard, not server-side
idempotency or an exactly-once guarantee. Creation and its existing email outbox
remain atomic; post-response delivery failure must not turn the saved shipment
into an apparent save failure. Route adapter doubles verify this separation;
local browser fault tests are owned by `launch-recovery.spec.ts`.

The launch entry exposed another narrow-height map collision: an oversized
summary's inherited positioning put its identity under Filters. Constrain the
summary below controls and put recovery feedback ahead of secondary details.
Retain map gesture pass-through on noninteractive copy. Existing geometry,
retry-target and gesture regressions remain mandatory; do not remove assertions
to accept the new header. Owner: implementing agent. Next: owner visual review,
then full release gates; no production settings or data changed by this work.

Follow-up evidence: pointer/focus leaving the map now clears a transient signal
preview, while pinned details remain open. Test the preview itself separately
from the truck summary so an emulated hover cannot silently replace the surface
under a layout assertion. Keep the normal wheel/drag/touch and recovery-target
assertions. Local developer previews may disable the old fixture-password panel;
exercise actual email-code login rather than re-enabling it to satisfy a test.


### Separate inquiry teams and live drafts — 2026-09-24 (NR-01/02/03/08/10/13)

Cause/risk: treating the existing internal SUPPORT identity as authorization for
all inquiry work would give Support access to Brokerage contacts, and navigation
alone would not enforce the separation. Migration 104 defaults Brokerage off,
locks current capability for mutations, scopes worker reads to owned requests,
redacts unassigned contacts, versions changes and releases open work after access
loss. Guest Support assignment checks current staff availability and workload.
Private history has RLS, revoked browser grants and service-only entry points.

A background refresh can silently replace the version associated with an unsaved
assignment or note; pin the expected state while the form is dirty and reject a
stale submit. Reuse the polling ETag contract so unchanged data returns 304.
Tests exercise a real concurrent saved update while an assignment draft is open.
The staff shell previously omitted permission fields, hiding valid navigation;
safe capability projection and actual email-code login now cover both teams.

Phone checks caught fixed navigation intercepting Create member and a long email
pushing a guest-chat status outside its header. Bound the form above navigation,
allow identity wrapping, and exercise normal taps and viewport bounds. Do not
force-click to hide an obstruction. Evidence: brokerage-assignment SQL, the
resulting catalog gate and brokerage-workflows desktop/phone cases. Owner:
implementation/release author. Next: owner visual review, complete release gates,
protected migration rehearsal and authorized rollout. Local evidence is not
provider enforcement or production deployment.


The existing guest Waiting list also exposed Claim on rows the FIFO command would
reject. Eligibility is now derived in the scoped inbox from oldest-first order,
availability and combined chat capacity. Keep the command's independent recheck;
a visible button is a current hint, not authorization. SQL verifies newer/full-
agent denial and automatic next assignment after closure; browser tests verify
only the oldest offers Claim and a normal tap persists the owner. Do not replace
this existing fair-queue rule with arbitrary selection to make the UI pass.

### Featured observability and narrow delegation — 2026-09-24 (NR-01/02/03/08/10/13)

Migrations 105–106 retain RLS and explicit browser revocations. The private status
record and bounded overview expose no contacts or raw generator errors; injected
failure rolls back partial writes. Featured authority is default-off, independent
of Support/Brokerage, and rechecked/locked in PostgreSQL before mutations. Narrow
settings commands cannot change access/payment mode, and only admin can grant
staff permissions. Revocation and suspension remain effective for existing sessions.

Negative checks: `featured-operation-status.sql`, `featured-team-permission.sql`,
`featured-random-rounds.sql`, catalog security gate and real grant/revoke browser
workflow. Source scheduler configuration is not hosted execution evidence. Verify
an unprompted production status advance after rollout. Owner: migration/release
author. Next: owner desktop/phone review, full gates and separately reviewed
rollout; neither status UI nor passing local checks authorize deployment.


### Broadcast-window compatibility — 2026-09-24 (NR-03/08/10/13)

FEAT-FTR-001 / migration 107: enforce hours, eight-truck ceiling and manual-gap
bounds at both application and SQL command boundaries. Preserve current permission
locks and deny browser execution of the new validator. The local rollback rehearsal
compared every saved day's non-timing fields, every slot and selection-history row;
manual/historical rows stayed byte-for-byte equal. Four future automatic days were
retimed locally without reselection. Oversized automatic days abort migration.
Negative SQL, existing no-repeat/permission suites and catalog checks pass locally.
Do not deploy the old window-only application after changing saved schedules; use
coordinated compatible rollout and reviewed recovery. Owner: migration/release
maintainer. Next: owner visual approval and normal complete release gates.

The focused broadcast browser check also found an existing editor-read defect:
native JSONB manual intervals were coerced to strings and then parsed, yielding
empty inputs despite correct persistence. Accept arrays before parsing legacy
text. The browser regression must publish, reopen, inspect actual inputs and
resave, not stop at a successful response or database row. Owner: Featured UI
maintainer; evidence belongs to `featured-broadcast-window.spec.ts`.


### Retire public support at every entry point — 2026-09-24 (NR-03/08/13)

FEAT-GST-001 / FEAT-SUP-001 / FEAT-TRQ-001, migration 108. Removing a launcher alone
would leave old clients able to create staff work or upload guest attachments.
Deny guest creation/replies before upload/email in HTTP/application code and in
service-only SQL commands. Reserve member writes for TRANSPORTER/DRIVER, with
current staff permissions and assignments still checked. Keep old recovery and
file access private; retirement must not delete transcripts or silently close work.

Negative evidence: public API 410 checks, application commands with poison uploads,
provider-only-support.sql, retained-history/attachment/browser-denial checks and
catalog gate. Local rehearsal compared all six support record tables before/after:
unchanged. Provider/staff and Brokerage workflows are checked in real local browsers.
All security role tests use isolated synthetic data or rollback-only transactions.
Fixture emails had changed to owner aliases, so history/attachment/polling tests now
select active roles rather than assuming retired local addresses.
Owner: Support/backend maintainer. Next: owner visual approval, full release gates,
reviewed hosted migration and compatible app release. Database retirement stays
in force during app rollback; restoring public chat requires an owner decision.


Brokerage conversation extension (2026-09-27), NR-01–05/08–10/13:
Migration 110 keeps access digests and message rows under RLS with no browser
relation/sequence/RPC grants. Request-ID knowledge and matching submitted fields
cannot adopt a conversation; legacy rows have no visitor capability. Negative
checks cover wrong recipient, expired capability, Support-only/unassigned/previous
Brokerage staff, closed writes, duplicate-ID conflicts and internal-note redaction.
No Realtime publication or hosted configuration was added. Any future private
Broadcast integration needs independent channel-join and revocation evidence;
passing current HTTP/database checks does not authorize that separate access path.


### Visitor-ended Brokerage chats — 2026-09-27 (NR-01/02/03/08/10)

Messaging termination is separate from resolving a customer's transport request.
Migration 111 serializes ending and sends on the same request lock, authenticates
the same-browser capability, makes repeats idempotent, preserves ownership/contact/
notes/messages and invalidates stale staff drafts. Ended or expired chat cannot
receive new messages, even if an administrator reopens request follow-up. Staff-only
contact/notes are omitted from visitor snapshots; the new command denies browser
roles. Rollback-only lifecycle, wrong-scope/expired denial and catalog checks pass
locally. All four waiting/assigned desktop/phone end-chat cases pass, including
cross-origin denial, outsider denial, retained history and new-chat isolation;
evidence is `artifacts/chat-follow-up-final-20260927/`. Visual approval and hosted
rollout remain pending. Owner: chat/release author; keep history when rolling the
application back.


### Profile discovery is not a wider data projection — 2026-09-27 (NR-01/02/03/08/10)

Search must start from the same authorized available truck/driver rows as the map.
Migration 112 returns profile cards only; public profile text and already-public
driver names are searchable, while hidden contacts, login identities, private
plates and truck-only facts are not. Verified-email grants and staff scope are
rechecked server-side; query parameters cannot supply a recipient digest. New
helpers remain service-only with bounded HTTP pages and no shared response cache.
The rollback SQL suite and six local desktop/phone search cases cover these
boundaries and private grant revocation. Keep search source projections aligned
with later map permission changes. Owner: discovery/release author. Next action:
owner UI review and exact-candidate release validation; no hosted changes yet.

### Driver location bootstrap and malformed GPS — 2026-09-27 (NR-01/02/03/08/10/13)

Capacity-edit permission must not block an assigned driver's first location when
the owner needs that location to publish. Location permission never grants route,
sharing or capacity-edit authority. Migration 113 stores the first approximate fix
behind RLS with no browser grants, verifies current assignment and active vehicle,
excludes a former driver's snapshot, and preserves capacity age/settings. SQL NULL
comparisons previously failed to reject missing GPS fields explicitly; publication
and duty now reject omitted coordinates, radius and source. Test the commands
directly as well as the visible form; client validation alone is insufficient.

Rollback SQL `driver-location-bootstrap.sql` and catalog security checks pass
locally; CI includes the new SQL case. Bounded capacity/Tracking requests stop
waiting, ignore late callbacks and never automatically retry ambiguous writes.
Owner: fleet/release author. Next actions: finish desktop/phone onboarding and
recovery review, obtain owner visual acceptance, then fresh release gates.


### Tracking email-session simplification — 2026-09-28 (NR-01/02/03/08/10/13)

Removing reusable customer codes must not remove recipient authorization. Migration
114 reuses bounded single-use OTP/outbox controls, scopes listing to verified email,
and locks/rechecks the customer OWNER before review submission. Every shipment and
proof read retains current grant/expiry checks. New RPCs are service-only; browser
roles cannot list recipients or submit reviews. Legacy shipment cookies never become
email-wide access. Signed sessions expire server-side after 30 idle minutes and
at eight hours absolute; background polling cannot renew them. Email/OTP/session
secrets remain absent from URLs and logs. Negative regressions:
`tests/sql/tracking-email-session.sql`, `tests/tracking-session.test.mjs`, and
`tests/e2e/tracking-email-session.spec.ts`. Owner: Tracking/release author. Next:
owner visual review and exact-candidate release rehearsal. Focused SQL/catalog,
47 units and eight desktop/phone cases pass; see
`docs/TRACKING_ACCESS_REVIEW_2026-09-28.md`.

### October 4 dependency refresh — email parsing (NR-08/10)

Fresh CI blocked Nodemailer 9.1.1 after updated advisories reported address-parser
denial-of-service and SMTP TLS-name reuse risks. A previously green audit is not
current release evidence. Upgrade only the locked email package to 10.0.14;
retain TLS validation, bounded SMTP timeouts and credential-free error output.
Primary references: [advisory](https://github.com/advisories/GHSA-v53p-9fqp-m79j)
and [release](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.14).
Owner: release maintainer. Required evidence: a fresh zero-advisory audit, bounded
parser regression, email adapter tests and local visible OTP delivery. Production
rollout remains pending; no SMTP settings or credentials are changed.

October 5 evidence: the adversarial dotted free-text input times out after five
seconds with 9.1.1, while 10.0.14 completes in under one second. All 24 focused
email tests, isolated SMTP delivery and both desktop/phone real local OTP flows
pass. Fresh audit has zero findings; quality passes 372 tests. Exact-candidate CI
and production rollout remain outstanding. No external test email was sent.

## NR-16 — Treat external native links as untrusted input

The mobile dependency review found Router's transitive malformed-URI decoder
advisory GHSA-vcc3-ghjq-m6fr. A compatibility check does not establish that runtime
links are safe, and a forced major override can break the module contract.

Validate bounded native intents before Router parses them, allow known routes and
parameters only, reject malformed encoding/credentials/foreign origins and return
canonical relative paths to avoid an extra decoding pass. This is not authorization:
every protected screen/API must still verify its current session. Never log incoming
URLs or suppress the underlying audit finding. Keep web and native exposure separate.

Evidence: `apps/mobile/tests/native-link.test.mjs` includes malformed UTF-8, nested
percent values through the installed parser, duplicate/extra parameters, foreign
hosts and development-only launcher boundaries. See
[dependency review](MOBILE_DEPENDENCY_REVIEW.md). Device tests and compatible
upstream remediation have separate status in the mobile implementation log.
Owner: mobile/release maintainer. Next: complete device checks and upstream review
before signing/distribution; preserve an equivalent guard during rollback.

## NR-15 — Preserve referenced files after uncertain save outcomes

October 6 mitigation: shared upload commit handling now cleans only explicit
PostgreSQL rejection codes and retains private objects on unknown outcomes. Web
Tracking notification/cache failures run outside that cleanup boundary. Focused
fault injection through verification/payment/profile adapters passes; no automatic
write retries occur. Reference-aware orphan reconciliation and release verification
remain outstanding. Evidence: `tests/private-upload-commit.test.mjs`.

Source review during mobile integration identified cleanup that deletes newly stored
objects on RPC errors without distinguishing definite rejection from a committed
operation whose response was lost. This is an open data-integrity risk, not a
reported production incident. Web Tracking also includes post-command work in its
cleanup catch; shared adapters expose mobile to the same class of failure.

Responsible role: storage/application maintainer. Next action and source evidence:
[WEB-MOB-001](WEB_GAPS_FOUND_DURING_MOBILE.md#web-mob-001--file-cleanup-does-not-distinguish-an-uncertain-commit).
Required negative evidence: inject commit-then-response-loss and post-commit
failure; committed records must retain readable attachments, while definite
rejections are cleaned safely. Add operation/reference reconciliation before
claiming this prevention is implemented. Normal upload success tests are insufficient.

### October 7 release dependency refresh

The unchanged high-severity audit gate caught newly published advisories
GHSA-wq5f-xc86-pv6w (sharp/librsvg) and GHSA-68fv-2mgg-jv7q (source-map-js).
Pinned sharp 0.35.5 and source-map-js 1.2.2 remove those findings; Next remains
15.5.25. Retain locked installs, a fresh audit immediately before release, and
exact-candidate CI/build/runtime checks. No forced major upgrade or audit
suppression was used. Local web audit reports zero findings; production status
must be confirmed after publication.


### Cross-view location and navigation continuation — October 7, local only

NR-02/03/08/13: fixed-distance GPS offsets permit cross-radius triangulation;
shared privacy now uses stable many-to-one cells with a displaced cell center and
verified conservative radius bounds. Distinct nearby fixes can produce the same
point; historical points remain retained. `location-area-privacy.test.mjs` proves
world bounds, repeated-cell stability and distance limits; actual local native
Home obscured movement/save/readback passes. Do not claim historical conversion
or device background travel testing. Owner: location/migration author; next: native
permission/locked-device checks, review and guarded rollout.

Return-state storage is presentation-only. `workspace-area-navigation.test.mjs`
rejects external/administrative/unknown routes, credentials and unsupported query
keys; camera values strip extra fields. Private results are always freshly
authorized, identity-keyed bookmarks never grant access, and no feed/recipient
snapshot is retained. Native document regrouping preserves authorized subject IDs,
including self-managed PROVIDER_PROFILE identity/licenses. Negative role and
kind/ID tests plus actual company-driver browser checks pass. Owner: UI author;
next: visual review and remaining release gates. No hosted setting/ACL changed.

### Browser map console regression — October 7, local only

NR-08/13: a browser check collecting pageerror alone missed raster AbortError
events reported through console.error and Expo's overlay. The MapLibre6.13.0
raster catch treated cancellation with tile.aborted=false as an image failure.
Reproduce the installed loader and visible browser failure before repairing;
inspect console errors as well as exceptions, zoom/resize and area return.
Preserve deliberate HTTP and invalid-image error feedback. Six focused tests and
three browser scenarios pass; guarded postinstall rejects version/hash/external
symlink drift and changes only Loadgistic's browser dependency. No permission,
credential, data or hosted configuration change. Owner: mobile maintainer; next:
retain this check in focused map verification and remove the adapter only after
an upstream fix is reviewed. Previous servers had stopped; cause was not captured.

Recurrence correction: the owner still saw an exception during paused Chrome
zoom clicks. Do not equate fresh-context success with repair of a running tab.
The first synthetic regression counted earlier cancellations; now require a new
forced count and assert unhandled rejection separately. A real streaming-body
fixture passes 31 new body cancellations; unmodified Chrome fetch with OSM passes
49 request cancellations. Scope the full client reload to the independently
verified Loadgistic server. Owner confirmation remains open; an old retained map
is a hypothesis. No overlay suppression or speculative library change was made.

Verified refinement: owner screenshot disproved the stale-tab completion theory.
Inspect the failing browser environment instead of broadening clean-context zoom
tests repeatedly. Its fetch is wrapped; a controlled response-observer side-promise
reproduces the same uncaught abortTile stack. The scoped browser raster/XHR port
now passes desktop HiDPI click zoom with the recorder enabled, real body aborts
and retained HTTP/decode error feedback. CORS-unsafe getResponseHeader calls also
produced console errors; read accessible headers with getAllResponseHeaders.
Temporary probes were removed and no global browser/extension setting changed.
Presence of an extension script is not attribution: Loom's console script was
present, but its code did not establish ownership of the fetch wrapper. Next:
retain the before/after regression and owner local test; publication is separate.


## NR-18 — A single-driver account quietly gains fleet capability

**October14 supersession:** the owner explicitly granted all provider **owners**
multi-truck/driver management (FEAT-FLT/VER/IAM-001 / ADR-079). Do not retain the
old owner restriction as current policy or grant fleet authority to employees.
Preserve explicit one-driver/one-truck assignments, tenant isolation, unfinished
Tracking, exact reviewed relationship, lifecycle/history and concurrency controls.
OWNED/FINANCED/PERMISSION are declarations; permission is only drive/manage.
Owned or financed licence-holder qualification requires explicit matching review,
never a generic legacy approval. New negative checks must prove second truck
addition without implicit duplicate driver, employee/cross-owner denial, Draft
exclusion and qualification expiry/revocation without loss of Tracking history.
The historical cause/evidence below remains evidence of the earlier policy only.

**Cause:** Account categories for self-managed drivers and owner-operators used
independent-provider ownership for unrestricted vehicle creation. Hiding fleet
links alone would leave API, concurrent registration and retired-truck restoration
paths capable of creating multiple active trucks. Reusing a truck row for a new
physical vehicle could attach old review/history to the wrong truck.

**Control:** FEAT-APP/FLT/IAM/VER/MOB, ADR-076: canonical independent identity with
legacy compatibility; one-active-truck partial unique index; serialized exact
provider command; expected current ID plus deliberate replacement confirmation;
atomic archive/create; unfinished-Tracking block. Preserve old entity IDs,
private file authority, shipments, signals and audits. OWNED/PERMISSION is a
self-declaration, separate from reviewed proof. Never infer legacy ownership or
rewrite Auth/application history. Company-driver and fleet scopes remain distinct.

**Negative checks:** `tests/independent-single-truck.test.mjs`,
`tests/sql/independent-single-truck.sql`, and the two-session
`verify-independent-truck-concurrency-local.mjs` prove direct/second/stale/foreign,
confirmation/invalid-replacement rollback, active Tracking, admin/owner restoration,
driver-management denial and retained subject/file history. The resulting catalog
security gate stays independent. Current local UI/rollout evidence is in
MOBILE_IMPLEMENTATION; no hosted migration or release is implied by passing local
checks. **Owner:** identity/fleet/migration author; release owner. **Next:** actual
web/native visual approval, exact production aggregate preflight, protected restored
backup rehearsal, compatible release/rollback and native phone acceptance.


## NR-19 — Fetching or assigning a chat masquerades as Seen or joined

**Failure:** legacy Support fetches update read timestamps, while merely assigned
staff are described as helping. That cannot establish displayed messages or a
joined agent. Sharing one team read counter also clears a new assignee’s unread
work, and an A→B→A handoff can accept a delayed frame from the first assignment.

**Control:** FEAT-NOT-001 / ADR-077. Saved explicit visible-message acknowledgement,
monotonic per-side cursors, independent per-assignment unread and an assignment
epoch checked under the parent lock. Fetch/send/queue/history download is not a
receipt. Covering native menus/documents and unfocused apps/tabs cannot read.
Guests use only their exact live capability; active staff need the current team
permission and assignment. New tables are RLS-protected/service-only, commands
have browser execution revoked, and matching schema markers gate app readiness.
Alerts contain no contact, route, message or staff-only note in system copy.

**Negative checks:** `tests/sql/chat-read-receipts.sql` proves foreign/future/expired/
inactive/wrong-team denial, fetch/send neutrality, replay idempotency, retained
history, agent handoff and rejected old frame. Shared policy tests cover late
responses, silent baseline and deduplication; native tests cover independent modal
blockers and translated copy. Actual local browser/Expo-web receipt, overlay/history/failure tests now pass;
physical-device/background delivery acceptance remains separate. RLS/ACL/definer catalog and existing file,
history, Support polling and Brokerage regressions pass locally.

**Owner / next action:** chat/release author. Finish focused actual receipt tests,
obtain owner visual review, then prepare exact backed-up hosted migration and
matched clients. Background notification transport/device acceptance and direct
provider inquiry scope remain unresolved. Hosted tables/settings were not changed.


NR-19 follow-up: a conditional foreground receipt poll could stop permanently
behind an overlay; removing the last overlay now wakes metadata polling. The real
menu-open/new-reply/close case proves no hidden read and subsequent recovery.
A waiting-first 40-item feed also hid assigned replies behind 45 waiting chats.
Migration 125 prioritizes active unread/current-assignee work and derives actual
message event time. Its negative case fails schema 124 and passes 125; counts still
cover every authorized row. Never remove bounds, broaden recipients or truncate
queue totals to make a notification check pass. Use boolean-only environment
guards in local runners; asserting the raw environment text can expose secrets
on a wrong-target failure. Owner: chat/release author. Production remains pending.

Private web receipt surfaces hide on pagehide and reauthorize through a reload
when the browser restores a persisted page; a cached chat is not new authority.

NR-19 October14 internal audit: a consent dialog outside the chat root can
occlude already-intersecting messages. Closing it changes neither intersection,
focus nor the chat's own DOM, so the guarded reporter could remain asleep while
authorized metadata polls continued. Successful200/304 polls now invoke that
same reporter; they do not acknowledge directly or add another polling loop.
Still-covered, hidden, unfocused and403 cases remain unread. Assignment versions,
saved acknowledgements and exact current authority remain unchanged.

The actual-component no-event dialog-close regression fails before the repair;
four visibility cases plus nine existing policy checks pass afterward. The real
Marketplace→Updates→own web chat test also passes consent dismissal, visible
Seen, unread preservation outside the chat, no private-body leak in the modal,
and revoked-authority reload after persisted pagehide. Receipt:
`.local/internal-chat-audit-20261014/public-receipts-only/sanitized-receipt.json`.
Owner: chat/release author. Full release/visual gates and production rollout are
separate; no new hosted change or closed-phone notification proof is claimed.

NR-19 October 8 extension: notify a driver only from a committed OWNER/STAFF
handover, with private current-assignment authorization and an exact versioned
alert acknowledgement. Fetch/dismiss/system clicks cannot fabricate completion
or chat Seen. Browser permission is deliberate; a notification-only worker
validates safe links and caches no API/proof responses. Open-browser polling is
not closed-phone/Web Push. Tests use actual worker records in current Chromium headless mode;
the default headless shell reports conflicting permission APIs and rejects
notification storage. Current Chromium mode is used instead; it does not prove
a physical OS banner. Physical-device banners
and push remain separate acceptance.

The initial notification worker used root scope even without a fetch handler.
This competed with `/sw.js`; its controller-change bootstrap reload interrupted
POST navigation. Ordinary Support tests passed without the conflicting worker,
while the notification-enabled browser did not reach the chat. Narrowing registration to `/_loadgistic-alerts/` keeps the notification worker from controlling app
pages or replacing `/sw.js` and the actual Claim response/redirect passes. Require this
minimal scope and test real POST navigation after enabling alerts. The speculative metadata
submit guard was removed; it was not this failure's cause. Owner:
notification/workflow author. Evidence and rollout status are in
MOBILE_IMPLEMENTATION; no hosted write or release is implied.

NR-19 delivery follow-up: waking only on visible state stopped hidden-tab alerts,
and restoring opt-in after an initially skipped poll also needs a wakeup. Do not
confuse that delivery poll with visible-only chat acknowledgement. A real native
alert-opening test rejected a wrapped payload at a plain-body request port; the
correct serialized command has only `id` and `approvedAt` and clears saved unread
state. Keep the actual browser payload/status and post-navigation database check
in the focused workflow. UI appearance or typecheck alone missed this defect.

NR-02/03/09 contact-label follow-up (October 8): labels are private organizer notes,
not recipient verification or authority. Named grant/rename commands reuse current
vehicle control with row locks; renaming never changes grant identity/email or
revives revoked access. Exclusive publication and its name commit atomically.
Legacy names are retained; public/private visitor projections never include them.
Migration 127 and rollback-only contact SQL verify these cases locally; hosted
rollout and new artifacts remain pending. Owner: sharing/workflow author.

NR-08/19 native startup follow-up (October 8): the real Android development bundle
failed because notification routing imported the server registration schema and
its Zod dependency. The Expo-web shim and TypeScript checks did not exercise that
native graph. Separate the dependency-free, strict destination contract; keep
registration validation server-side and reject extra fields/invalid event pairs.
`apps/mobile/tests/native-push-destination.test.mjs` covers valid event/screen
combinations and malformed/injected data; `tests/native-push.test.mjs` preserves
server payload/authority checks. Verify actual Android bundle and installed
startup before native review/release. Owner: mobile/release maintainer. Next:
complete that runtime proof and the closed-phone notification acceptance.

NR-19 presentation follow-up (October 8): a successful Expo ticket/receipt does
not prove an Android banner. The initial native handler unconditionally suppressed
system presentation; it now keeps foreground feed behavior while permitting
background/inactive alerts, including lifecycle-transition delivery. Two explicit
presentation tests and the real Android export pass. Actual OS/tap acceptance
remains unverified on the unstable emulator and must not be inferred from provider
success. Owner: mobile/release maintainer. Next: exact internal build and device
acceptance, retaining permission/refusal/logout and no-fabricated-Seen checks.

NR-19 Android extension: private RLS/service-only installation/session/guest
bindings and atomic outbox are implemented at local migration 128. Focused tests
deny staff/forged/foreign/expired authority, reject stale leases, bound retries,
suppress already Seen/acknowledged events and ensure an old-token receipt cannot
disable its replacement. Native opt-out survives sender/network unavailability;
tap authorization cannot grant Seen or retain old identity after logout.
The owner-delegated FCM V1 upload targets the exact Loadgistic EAS app, with no
prior association to replace. Private Firebase JSON is excluded explicitly in
`.easignore`; nested Git ignore rules alone do not protect an EAS archive.
Local registration must report the disabled sender truthfully. New APK/hosted
enablement and physical-device acceptance remain pending; simulated Expo results
and foreground/browser alerts never prove closed-phone delivery. No other app or
global Firebase/Expo account changes. Owner: notification/workflow author.


## NR-20 — A reduced menu hides the prerequisite needed to close an account

**Cause:** Single-truck UI consolidation hid fleet lifecycle controls while account
closure correctly continued to require retiring the active truck. The backend
command remained authorized, but an independent driver could not reach it.
Redirecting the fleet list to first-truck registration also dropped save feedback.
A native-only Alert callback is a no-op in the Expo web adapter, so browser
appearance would not prove that its confirmation submitted anything.

**Control:** Keep current-truck retirement on My truck in web/native, with the
existing confirmation, unfinished-Tracking denial and retained entity history.
Use an explicit in-app confirmation on both native and Expo web; do not grant an
independent driver historical restore, driver-management or extra-truck authority.
Preserve success/error feedback through role-specific redirects. Check the actual
prerequisite/action/save/return path whenever related resources are consolidated.

**Evidence:** `tests/e2e/account-security.spec.ts` proves email change, the active
truck closure blocker, visible retirement, retained history and verified closure.
The scoped local Expo check exercises the rendered control and its actual API
save. Full release, owner review and installed-phone evidence remain separate.
The owner explicitly approved the repaired controls and compact truck details.
**Owner:** identity/fleet UI maintainer; release owner. **Next:** complete exact
browser CI and the matched web/Android rollout; physical-phone acceptance stays
distinct from browser and emulator evidence.

## NR-21 — Workflow contracts change but their browser fixtures remain obsolete

**Cause:** Mandatory truck ownership, named sharing contacts, delivery dates,
photo proofs and recipient approval changed while older browser fixtures still
created incomplete records or asserted retired plan controls. An arbitrary
published local profile also selected leftover preview data instead of the seed.
The October20 release candidate repeated this failure after the provider-owner
rule changed: new vehicles now start Draft with no assigned driver, yet several
browser fixtures still expected an implicit driver or immediate Live publication.
Other cases retained a retired admin route, a fixed administrator identity, an
old Tracking radius or a one-row Capacity assumption. Unit, type, build and
5,000-vehicle scale checks passed while the first browser matrix timed out;
those checks did not establish workflow readiness.

**Control:** Update every affected fixture creator and visible workflow assertion
with its controlling contract. Provider owners may create multiple Draft vehicles;
one may go Live unreviewed, while a second Live vehicle needs exact qualifying
review. Tracking creation needs an assigned driver, but not Live publication;
public Capacity needs an eligible Live vehicle. Exercise real calendar controls,
proofs, email verification and owner approval. Pin known seeds or create scoped
fixtures; do not rely on an unordered first user or profile. Inventory affected
browser setup whenever a role or state transition changes, and run the early
synthetic fixture preflight before the long matrix. Classify timeouts from the
actual page/response before changing a bounded wait. Keep required CI failing
until every browser shard on the same source commit completes; never restore
obsolete product behavior or waive a permission check.

The next October20 run improved to seven passing browser groups but still found
three phone failures. A desktop-only focused matrix did not close phone coverage.
Record both project results for each affected case before another full run.
Search's exact499/500ms check also installed a fake clock without pausing it;
slow browser work spent the remaining millisecond and invalidated its request
count assertion. Pause the clock explicitly and retain the original counts and
cancellation checks. The corrected desktop/phone pair and four-times-slower
phone reproduction pass. Private map bounds now test parent containment directly
and pass20 viewport/surface combinations. The vehicle-modal CI discrepancy and
full release gate remain open; these focused passes do not close them.

CI39484290410 then passed seven browser groups, leaving only a19px phone-card
overflow. Polling its unchanged geometry did not fix the finite height limit.
A controlled confirmation-notice row reproduced20px overflow on the same
otherwise-fitting profile; the map-height cap left usable screen space idle.
The exact CI notice state and Linux-font cause were not established. Layout
regressions must explicitly cover optional notices and long text, rather than
relying on whichever fresh/aged fixture appears first. The viewport-bound
repair retains every field and44px target; six affected cases pass in Chromium
and six in Google Chrome. Owner review and the new full CI remain required.

CI39491588105 passed the card's own tests but failed the adjacent feedback
workflow: its old assertion still confined the dialog to the canvas. The
320×640 reproduction showed only that assertion failing; the approved dialog
remained viewport-bounded and all other feedback/reachability/page checks passed.
The author had not inventoried every test using the shared modal before the
full run. For future geometry changes, search those component references and
run feedback/recovery, modal and public/private shell cases together on desktop
and phone. Correct an obsolete boundary from the approved spec, retaining all
other assertions; never change the interface merely to satisfy the old test.

**Evidence:** The earlier browser follow-up supplies valid inputs and preserves
denial, privacy, history and completion assertions. The October20 local
`fixture-contract-preflight.spec.ts` passed with disposable data and saved-state
readback; `BASE-DEP-001` and `.github/workflows/ci.yml` now require it before
the browser matrix. The full same-commit CI has not passed, so the candidate is
not deployable. The SQL, domain, scale and native boundaries remain required
alongside full desktop/phone CI. This recurrence is a release-process failure;
it is not a newly confirmed security exposure.
**Owner:** workflow author and release owner. **Next:** finish affected focused
browser cases, obtain required visual review, and retain exact-candidate results
from all browser shards before any rollout. Update fixtures in the same change
as future contract changes.

## NR-22 — A non-map driver panel inherits a fixed map viewport

**Cause:** The fleet-managed location/duty panel used the same fixed-height,
overflow-hidden class as a map. Its final Off Duty action was covered by phone
navigation, so a valid server command was unreachable.
**Control:** Choose the container from the rendered layout. Non-map panels use
normal scrolling and reserve navigation clearance; map panels retain their map
viewport. Check the last primary action after role/permission changes, including
its actual bounds and save, not just its presence in the DOM.
**Evidence:** FEAT-CAP-001 and the complete desktop/phone fleet-onboarding workflow;
the phone regression checks clearance, 44px height, saved duty and revoked access.
**Owner:** provider workflow author. **Next:** retain complete candidate CI and
live/installed verification; keep native/web layout parity audits separate.


## NR-23 — A public profile hide leaves another public projection exposed

Cause: public truck signal sharing and public profile visibility are separate
contracts. Hiding the profile or making it private does not by itself hide a
previous signal, an eligible Featured entry or a directly addressed portrait.
Owner: Loadgistic engineering/administrator.

Control: FEAT-PLY-001 migrations 132–136 exclude moderated/demo owners from
actual public map/search before paging, Featured eligibility and public portrait
reads. Do not repurpose an ordinary profile visibility choice as signal authority.
Negative evidence: `tests/sql/public-capacity-policy-scope.sql` publishes an
actual synthetic truck, hides it, checks both read functions, then restores it.
`public-content-safety.sql` denies republishing bypass; reviewer SQL denies
foreign workspaces. The owner-approved hosted ledger 136 and 80 live checks now
verify installation. Native/physical acceptance remains separate; local tests
alone were not installation evidence.

## NR-24 — Deactivation or partial cleanup masquerades as account deletion

Cause: retaining a profile/history or deleting only its login leaves personal
files/data, while irreversible cleanup can race ownership changes or fail between
Storage, Auth and relational stages. Owner: Loadgistic engineering/administrator.

Control: a verified, scoped, durable request; explicit administrator review;
held work/shared-file checks; frozen ownership/reactivation; file-before-Auth
ordering; authoritative completion and safe retry. Retain only documented
pseudonymous history. Never use a browser-supplied subject or merely hide an
account to report deletion complete.
Negative evidence: seven erasure workflow tests, deletion/scope SQL and real local
SMTP/Storage/Auth browser flow. No production erasure is approved by this entry.


## NR-25 — Inherited unused native permissions reach a distribution artifact

Status: source/merged-manifest finding, not a reproduced exploit or suppressed
Google policy error. Owner: native build maintainer. Code-4 inspection contains
SYSTEM_ALERT_WINDOW inherited through the native project; no release feature or
permission request using overlays is identified. Location/notification permissions
have separate actual uses; they are not removed to avoid required declarations.

Control/next: before the next binary, explicitly inventory generated and merged
release permissions against implemented use, remove unused overlay permission,
and add a negative final-manifest check with the controlling mobile/Play specs.
A dependency upgrade can reintroduce permissions, so inspect the artifact rather
than trusting app.json alone. Keep permitted developer tooling separate from the
standalone release and preserve legitimate Tracking/notification functionality.
The local configuration now blocks android.permission.SYSTEM_ALERT_WINDOW.
`apps/mobile/scripts/verify-android-permissions.mjs` reads the actual compiled APK
or AAB manifest and fails for an unrelated package, a debug artifact, inherited
unused permissions or missing shipment/notification permissions. Five focused
tests cover both compiled formats, malformed input, SDK-scoped additions and
configuration preservation; the existing code-4 APK and AAB both fail this guard
as expected. No replacement standalone artifact has passed it yet. Do not rebuild
or waive a release gate merely to hide the finding; verify the next immutable
candidate normally. This local guard does not change already distributed files.

Evidence: apps/mobile/android/app/src/main/AndroidManifest.xml:12; current code-4
manifest inspection. Minification is disabled by the current Gradle defaults with
no release override, so Google's absent-deobfuscation-file warning is retained as
informational; mapping becomes necessary if R8/minification is enabled later.

## NR-26 — Global permission actions overlap Android system controls

Cause: the shipment location banner was rendered above the route navigator as a
regular View, outside the native safe-area protection used by page headers.
Browser and consent-port checks did not detect Android's status-bar hit testing.

Evidence: installed 1.0.3/code 4 on Loadgistic_Pixel_API_35/emulator-5580, private
synthetic company-driver normal sign-in and visible Terms acceptance. Fresh
hierarchies place the banner action at y=21–116; Android reports a 136-pixel
status-bar inset. Center and lower-edge taps cannot open disclosure. Protected
capture: .local/play-20261010-native-location-disclosure.png. No location consent,
OS grant, tracking lease or qualifying permission video is claimed.
Normal native sign-out additionally leaves the previous action visible to the
guest despite the account session ending. That notice must be bound to its actor;
it is not authority to collect location or issue a lease.

Prevention/next: native global permission actions require safe-area protection,
not just page-level header padding. Add a negative layout check and verify the
actual installed action's bounds against system insets, then the visible decline/
accept paths and disclosure-before-permission order. Keep one tracking controller;
never grant permissions through adb or submit a browser/mock walkthrough as an
Android permission demonstration. Owner: native/Play release maintainer. The local
SafeAreaView repair and actor-bound notice visibility pass the prior-source
negative layout check, consent/scope/manifest/native-text/privacy regressions (20/20),
typecheck and lint. The guard immediately excludes guests and a different actor,
even if old notice state or a request result survives. The installed development
preview places the action at y=157–252, below the 136-pixel status inset. Its real
disclosure opens; declining returns to usable driver Home without an OS prompt
visible. Normal native sign-out returns to guest login with the old banner absent.
Actual preview also exposed duplicate header padding: a boolean context shared
only with the in-flow navigation header removes that extra 136 pixels while modal
windows retain their original safe areas. A second normal synthetic sign-in
accepts disclosure before the actual Android foreground prompt and background
permission settings. The service is foreground-active in app and after Android
Home; normal sign-out returns to guest login with no active foreground/start-
requested location service. An inactive Expo bound-service record remains:
requiring its total absence was a harness mistake, diagnosed against the installed
unregister/stop implementation, not a reason to modify product behavior.
Focused phone screenshots are sent for owner review. Owner acceptance, qualifying
video, physical GPS and a replacement standalone artifact remain pending; the
existing code-4 test release is unchanged. No adb permission grants were used.

## NR-27 — Privacy instructions describe an obsolete collection lifecycle

Cause: the shipment screen retained an earlier foreground-only explanation after
the agreed, consented background service was introduced. It said updates pause
when leaving or locking, while the actual synthetic Android test confirms the
location foreground service continues when the app is backgrounded. The global
disclosure described that correctly; the task's own instructions contradicted it.

Control: shipment privacy copy must follow the effective collection lifecycle,
distinguishing screen refresh from independently consented background reporting.
The local screen now reuses the existing five-language explanation that approximate
sharing continues until unloading approval, with no new permission or collection
behavior. FEAT-MOB-001 clarifies the foreground/background distinction;
FEAT-PLY-001 AC1 and `tracking-location-copy.test.mjs` reject the original pause
promise and require the existing translated explanation. Twenty combined focused
tests pass. The actual corrected native screen is captured in protected
.local/play-native-notice-tracking-explanation.png without recipient addresses.
Owner: native Tracking maintainer. Owner review and replacement standalone
release evidence remain required; no Google video or
physical moving-location acceptance is inferred from a running service.

## NR-34 — A repeating showcase is tested without advancing the calendar

Observed October 13: the live worker was healthy (AUTO/READY), but five upcoming
truck-type days had no roster. The global no-repeat ledger had five mini trucks
left; other types had exhausted their turns. An older test repeatedly deleted
and regenerated the same seven dates, so it did not prove a retained multiweek
programme stays populated.

Control: FEAT-FTR-001 / migration137 separates primary truck-type turns, draws
waiting pairs first, then restarts that type to fill the daily count. Mixed Sunday
uses those same turns. Saved/manual days and the legacy ledger stay intact.
Real scarcity stays visible rather than inventing trucks.

Negative checks: `tests/sql/featured-continuous-rounds.sql` retains four weeks
and verifies15vans:8then7+1, mixed-day fairness, nearby-date preference/fallback,
manual preservation, eligibility, retry stability, service-only permissions and
real partial-write rollback. It fails before137 with
`CONTINUOUS_TODAY_NOT_FILLED`, then passes after137 in the isolated local clone.
`tests/featured-status.test.mjs` rejects the obsolete waiting-for-other-types
explanation. The separately approved hosted137 repair passed all eight CI jobs
and was applied October13; upcoming seven days each read back eight valid distinct
Drivers. Its documented security-warning exception is consumed, not reusable for
a new UI/database release. Current interface and Android changes remain local.
Owner: Featured workflow maintainers.

## NR-35 — A visible native close button overlaps another marker's tap area

Observed October13: the selected-truck marker has a96-pixel touch rectangle;
the separate44-pixel close marker at offset[37,-22] overlaps it. The native
MapLibre marker manager chooses the first matching rectangle, so tapping the
visible close icon can open truck details instead of leaving selection. DOM
propagation guards alone cannot repair that native target conflict.

Control: FEAT-MKT-001 requires disjoint complete targets and an explicit exit
that preserves the prior camera, truck filters and people-search state.
The exit is now an independent44-pixel button outside the native marker hit
registry, positioned below measured floating controls. Three actual-component
regressions fail before and pass after, including camera restoration, measured
control bounds and a truck without geometry. Desktop/phone Expo dismissal checks
pass; actual installed Android center/edge taps remain pending. Record native
evidence separately from browser preview evidence.
Owner: marketplace map maintainers.

## NR-36 — A new map layout hides failure recovery or treats camera bounds as live

Observed October13: the native Tracking Refresh action was inside a data-dependent
workspace. A malformed refresh correctly removed private data but also removed
the only retry. Separately, the map stayed mounted while updated route/location
bounds were passed only through an initial camera property, leaving the first
reported truck area outside the user's view.

Control: FEAT-TRK-001 requires a retry outside failed private data, no stale proofs
after denied/malformed responses, and deliberate fitting for corrected routes or
the first valid saved approximate area. Normal status/location refreshes retain
the user's camera; readiness must include the actual camera and rendered frame.

Negative checks: `visitor-shipment-recovery.test.mjs` fails before and passes all
three after; both actual email-access browser recovery cases pass.
`tracking-camera.test.mjs` fails before and passes nine readiness/update/failure
cases. The actual Expo first-area check fits an out-of-frame area, retains its
canvas and preserves camera on a later location refresh. Installed Android paint
acceptance remains separate. Owner: Tracking workflow maintainers. Full gates, owner review and
publication remain pending; these controls do not change distributed1.0.6.

## NR-38 — Generic mobile cards and reviewer fixtures become customer presentation

Observed October13: native Featured reused the same large heading and vertical
card for every fact, while About repeated five long panels and the global language
control. A store driver capture contained internal reviewer fixture names. Admin
row actions wrapped accidentally into an unrelated grid, and document references
appeared as primary text. Compilation and functional success did not establish
intentional presentation or a suitable store screenshot.

Control: FEAT-UIX-001 gives each screen a deliberate identity/state/facts/actions
hierarchy, compact audience-led About and role-appropriate staff labels. Existing
commands, permission boundaries, destructive confirmations and material privacy
information remain. Reviewer access moves to sign-in rather than disappearing.
Use genuine screen captures with purpose-specific synthetic records; do not hide
valid user-generated content in the app or retouch screenshots to fabricate UI.

Checks: audience keyboard/phone navigation and all five languages, connected
admin links/forms at1440/390/320, and real card/modal/close controls are reviewed
alongside focused permission/action regression tests. Test menu labels must use
the actual native language boundary, rather than assuming every native-only key
exists in the web catalog. Local cleanup and screenshots are being verified;
owner visual review, replacement standalone captures and publication remain
separate gates. Owner: interface and mobile/Play release maintainers.
