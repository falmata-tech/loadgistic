# Security failures we must not repeat

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
