---
id: FEAT-GPS-001
title: Provider fleet devices and attributed truck locations
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-FLT-001, FEAT-CAP-001, FEAT-GEO-001, FEAT-SHR-001, FEAT-IAM-001, FEAT-MOB-001, FEAT-ADM-001, FEAT-SEC-001]
problem: Providers need one fleet workspace for their trucks, capacity sharing and their own GPS devices, with honest location provenance and safe device control.
behavior: A self-hosted Traccar protocol gateway receives supported tracker telemetry. Loadgistic administrators provision exact device identifiers to one provider; providers assign their devices to their own trucks and explicitly choose GPS device, driver's phone or manually entered location. The current assigned driver may choose their own dated manual Capacity point or phone source without gaining device authority, while an active Tracking agreement keeps its separately agreed live source. Public/private capacity markers show a small top-left source icon without publishing device identifiers or exact coordinates. Durable ingestion, private telemetry and capability-scoped commands retain tenant isolation, stale-data honesty and existing publication, sharing and Tracking rules. Isolated synthetic simulation never writes to real accounts.
contracts: [TelematicsGatewayPort, TelematicsDevice, DeviceOwnership, DeviceTruckAssignment, TruckLocationSelection, NormalizedTelemetry, TelemetryIngestPort, DeviceCommandPort, DeviceCommandState, LocationSourceProjection, TelematicsDemoManifest]
observability: [telemetry_accepted, telemetry_duplicate, telemetry_stale, telemetry_denied, device_assignment_changed, location_source_changed, command_requested, command_dispatched, command_acknowledged, command_expired, gateway_health, ingest_lag]
rollout: Prepare additive RLS-enabled private schema and pinned isolated server artifacts; rehearse on a backed-up local clone before local installation. Require exact owner review for hosted SQL, credentials, network exposure and new infrastructure. Verify actual protocol simulator roundtrips separately from hardware certification. Roll back consumers first and retain device ownership, assignments, telemetry and command history; never fall back to another provider's data.
---

# Fleet GPS integration — accepted implementation, not deployed

Providers can ask for tracker registration from GPS devices. The Support link
preselects the GPS device setup topic without claiming their device is already
connected or creating a request before they write and send it (FEAT-SUP-001).

Owner October15: implement dashboard cleanup and GPS fleet management on web and
Expo. Providers retain capacity publication/networking and gain device management
inside Fleet. Admin/staff management stays web-only. No new billing/plans.

## Architecture and readiness

### Private Fleet telemetry presentation — October25 qualification

Given a provider opens one of their registered devices in web or Android Fleet\
When its normalized report includes speed, heading and device/received timestamps\
Then both interfaces present those supported facts with clear units and concise
labels, retaining null as unavailable rather than inventing zero or a signal\
And telemetry age/freshness is not presented as proof of an open TCP connection\
And supported vibration/alarm values remain visible in the authorized device
report, while exact coordinates/device identifiers remain private\
And command availability comes from the exact device's enabled capabilities;
a wireless receive-only unit does not display engine controls\
And queued, sent, acknowledged, failed and expired command outcomes remain
distinct; sending a command never implies the device executed it.

GPS ingestion supports provisioned real devices. The separate simulators retain
their explicit synthetic-only allowlists and real-device takeover fences; adding
a real tracker never enrolls it in simulation. The first physical GT06 bench
remains receive-only below; a generic GT06 name does not enable physical commands.

Use the official pinned Traccar6.16.0 gateway and vendor protocol decoders,
dedicated persistent PostgreSQL storage and a bounded durable bridge. Enable only
configured listeners; gateway administration/API and database stay private.
Unknown-device auto-registration is disabled. Do not share the application's
production administrator credential with the gateway or device-facing network.
Use its documented API for ordinary business operations. The verified-erasure
exception in ADR-080 permits only scoped, bounded raw-history purging after
independently proven deletion of the exact device; no ordinary direct-table writes.
The configured gateway software includes GT06, Teltonika, H02 and JT808
decoders; GT06 is the first physical protocol target. Keep exact model/protocol/
firmware caveats visible. A configured decoder is not physical-device
certification or a guarantee that every branded clone supports every command.
See ADR-080 and authoritative sources in the operations guide.

### First physical protocol and bridge API model

GT06 is the first physical protocol target because the owner's available test
tracker is reported to use it. This priority does not claim every WhatsGPS or
white-label model implements the same GT06 variant. The exact manufacturer
model and firmware remain unconfirmed. “4G” is the mobile network connection,
not a protocol. Traccar receives and decodes the device-facing GT06 TCP stream;
Loadgistic does not implement a parallel packet decoder. The local listener is
loopback-only, so physical testing requires a separately reviewed staging
address and network rule. See the [GT06 device and API model](../../infra/telematics/GT06_API_MODEL.md)
for the current HMAC bridge contract, normalized position example, and ordered
physical-device qualification.

Initial real-hardware qualification is receive-only: registered login,
heartbeat/status, location and allowlisted alarms. Exact tracker identity must
match the pre-provisioned gateway binding; an IMEI or protocol ID is not
ownership proof or authentication. Do not store raw packets or expose exact
coordinates in logs. Real-device commands remain disabled until the exact model,
firmware and command behavior have separate documentation and bench evidence.
The existing normalized bridge carries `POSITION` events with separate device
and server timestamps, stable event key, validated coordinates, normalized
speed, and only allowlisted attributes. Duplicate, stale, unselected-source and
cross-owner data continue through the existing fail-closed rules.

### Scenario: provisioned ownership is not a self-claimed IMEI

Given an active Loadgistic administrator provisions a supported device\
When its gateway binding, exact protocol identifier and IMEI are validated\
Then the device belongs to one exact organization or personal-provider owner\
And no provider can acquire another device by entering its IMEI\
And an IMEI is an identifier, not an authentication secret or ownership proof\
And unknown, duplicate, inactive and cross-owner bindings fail without a write\
And provisioning and reassignment are audited without secret values.

Given an administrator finds a Transport Provider in the GPS device workspace\
When they register a real tracker using its IMEI, exact protocol identifier,
hardware model and label\
Then the server checks that provider and its configured physical gateway before
creating or reusing an exact Traccar device binding\
And the application verifies the returned gateway number, protocol identifier,
IMEI and non-synthetic gateway attributes before saving\
And the provider's saved device list shows the new unassigned device\
And that provider owner can assign it to one of their own active vehicles on web
or Expo, while another provider and employees cannot assign it.

Given gateway creation succeeds but the application link fails or its result is
ambiguous\
Then the admin sees a pending-link result, never a false success\
And the gateway record remains in place for an exact-identity retry or manual
reconciliation; a retry must never silently adopt a changed or foreign binding.

Given an administrator opens the GPS workspace without choosing a provider\
Then the page asks for a provider-name search instead of listing every provider\
When a search selects one provider, that provider's devices and Add action appear
before a short, paginated list of matching providers\
And each readback row shows its current vehicle assignment or unassigned state
and saved last-report state without repeating its Demo name as a second label\
And a Demo tracker's display name remains stable if the provider later assigns
it to a different vehicle; the current assignment is shown separately\
And non-provider workspaces never consume a search result or page slot.

Given an administrator chooses Demo GPS for a fictional provider\
When an exact, unlinked synthetic fixture is available for that provider\
Then the server selects its configured demo gateway, creates or reuses only that
fixture's exact Traccar binding, and forces the synthetic GT06 profile\
And the existing database fixture-owner and synthetic-only gateway checks must pass\
And the admin and provider device lists label the saved device as Demo\
And when every eligible Demo fixture is already linked, Admin explains why
another cannot be added instead of presenting a usable submit path\
And assigning it does not label it as physical hardware or claim live telemetry
before a real simulator report arrives\
And an arbitrary owner, physical gateway, altered binding, or missing demo gateway
is denied without creating an application device.

The admin-selectable spare `990000000000013` belongs only to the original
fictional Transporter organization and its active Truck 02 fixture. It is
separate from the ten moving demo targets. Retry after gateway creation reuses
only an exact binding, keeps partial gateway state for reconciliation, and never
auto-deletes a device. Other demo trackers remain controlled fixture setup.
The Demo choice cannot mint arbitrary IMEIs or start a simulator, and no
application-only fake position is emitted.
When that spare sends a saved simulated fix through the GPS server, the
authorized private Capacity map projects GPS as its source and a Demo marker;
public Capacity excludes a PRIVATE signal. The projection never includes the
IMEI, gateway identity, or exact telemetry coordinates. Provenance follows the
saved fix even though this intake spare is outside recurring movement.
The Admin spare reports simulated positions only. Its Commands tab explains
that commands are unavailable, and both web and mobile command endpoints reject
requests for that exact spare before a command can be queued. A location report
does not make physical or engine commands available.

Focused admin evidence: `tests/telematics.test.mjs` covers real/demo command
normalization and exact gateway readback; `tests/telematics-admin-readback.test.mjs`
covers current admin scope, selected-provider readback, revocation and route
denial. `tests/sql/telematics.sql` passed on the dedicated disposable
`loadgistic_demo_gps_admin_ci` clone in a transaction that rolled back; it covers
admin provisioning, provider workspace visibility, own-vehicle assignment and
foreign/employee denial. Authenticated desktop/phone visual review remains open.

### Scenario: provider devices belong to their fleet

Given an active provider owner has devices and trucks\
When assigning, replacing or detaching a device\
Then both entities must belong to that current owner and be active\
And a device has at most one current truck, and a truck one selected device\
And assignment changes advance an epoch and preserve history\
And employees cannot provision, assign, transfer or command fleet devices\
And old or delayed positions cannot appear on the replacement truck or driver.

### Scenario: explicit source controls capacity location

Given a provider owner controls a truck\
When choosing GPS device, driver's phone or manual location\
Then the server persists that explicit source with current revision checks\
And a manual position is validated as a worldwide coordinate and attributed to
the owner, never labelled phone or GPS\
And phone positions retain current-driver authorization and existing privacy\
And incoming unselected sources may not replace the selected published position\
And GPS selection requires a current assigned device; stale/offline data stays
dated and cannot silently fall back to manual or another device\
And capacity routes, accepted loads, sharing audience and Draft/Live remain
independent and manageable by the authorized provider owner\
And agreed Tracking continues its existing consent/phone/reporting contract;
changing capacity source cannot disable shipment tracking or release obligations.

### Scenario: assigned driver chooses a dated manual Capacity location

Given the currently assigned, active driver has location access to one vehicle,
even when the owner has not granted broader Capacity editing\
When they choose a manual point and accuracy, or switch back to their phone\
Then the exact point is saved privately with the actor, revision and update time\
And only its obscured, dated MANUAL result is published to public/private Capacity\
And incoming phone or GPS fixes cannot overwrite that selected manual result\
And re-saving the same point deliberately updates its freshness and revision\
And a stale editor revision, former driver, inactive account, wrong
vehicle or attempted GPS selection is denied without a write.\
And an owner cannot silently override a current driver's manual choice while
that driver remains assigned; changing drivers ends that choice's protection.\
And changing drivers ends the former pair's published Capacity row; its saved
manual point is not reused for the replacement pair or shown in the new
driver's exact-point editor until that driver deliberately saves a new point.\
And the authorized driver may read only the selected source, revision, radius
and saved manual point for their assigned vehicle, never fleet device IDs or
another provider's exact point.

Given a synthetic demo target whose assigned driver sends a Capacity phone fix
while its tracker is being updated\
When the phone report and demo device operation overlap\
Then both follow owner, device, vehicle lock order without a database deadlock\
And a phone fix rejected after the driver chose MANUAL or GPS rolls back its
intermediate phone and demo-state writes, leaving the chosen Capacity source
and public point unchanged.\
This concurrency criterion is pending isolated two-session verification for
additive migration 174; it is not part of the installed local preview yet.

Given a shipment includes location updates\
When its Tracking agreement is created\
Then it fixes a separate source: the currently assigned GPS device if selected
and available, otherwise the assigned driver's phone; a manual Capacity point
is never described as a live shipment position.\
And later Capacity source changes cannot change the shipment's source or revive
an old phone/GPS fix, while phone Tracking continues under its own active lease\
And a replaced or detached GPS device does not silently switch that shipment to
another device or to manual/phone.\
And older unfinished agreements receive a safe source snapshot at rollout;
existing recipients retain their route/status authority and no new raw point is
exposed to other viewers.

Given an owner reopens an already-saved manual location\
When editing its shared accuracy or cancelling a draft\
Then the private editor restores the saved exact point and current revision\
And changing only accuracy does not require entering the location again\
And the point is returned only by the authorized fleet workspace, never public
or recipient capacity projections\
And device assignment choices remain available behind a compact chooser.

### Scenario: public provenance is honest and compact

Given a discoverable Empty/Partial truck has a saved published location\
When public or authorized private maps render on web/phone web/Expo\
Then its existing truck circle has one small top-left icon for actual published
GPS device, mobile phone or manually entered source\
And accessible text/details explain the source and last-update time\
And the icon cannot imply document verification or guaranteed accuracy\
And pending source selection cannot relabel an older source's position\
And no IMEI, gateway identifier, raw exact point, speed or alarm is public\
And clicking the icon does not select/deselect the wrong truck or break map touch.

### Scenario: ingestion is durable, bounded and tenant safe

Given a provisioned gateway receives decoded positions/events\
When the durable bridge delivers a bounded batch\
Then a scoped authenticated ingestion adapter validates gateway/device binding,
coordinates, timestamps, finite speed and an allowlisted attribute/event set\
And a unique upstream event key is idempotent across retries and worker restarts\
And older/invalid/future/replayed fixes cannot replace a newer current location\
And positions before the current assignment epoch remain historical only\
And processing never changes capacity availability, recipients or driver identity\
And provider-private projections may show speed, ignition, battery, connectivity
and reported alarms with timestamps and unsupported/unknown states\
And existing deterministic obscuring/radius rules govern public/private capacity
coordinates; raw telemetry remains private to authorized fleet owners/admins\
And backlog and storage retention are bounded, observable and recoverable without
discarding another device's updates or logging raw positions/identifiers.

### Scenario: device commands are not assumed completed

Given an authorized owner requests location, tracker restart or reporting interval\
When the device's verified protocol capability permits that command\
Then the request is rate limited, validated, idempotent and audited\
And the durable lifecycle distinguishes requested, dispatched, acknowledged,
failed, expired and unknown outcomes\
And accepted/queued network delivery is never displayed as hardware completion\
And a command reply is not a location fix and cannot refresh position, speed, ignition or location age\
And unsupported commands and arbitrary raw command strings are rejected\
And an expired command cannot be sent after the device reconnects.

### Scenario: engine control is fail closed

Owner explicitly requested engine cut/restore with safeguards defined first.
Engine control is a separate privileged capability, not an ordinary restart.

Given a real device has no independently reviewed model/firmware/hardware relay
profile proving a local stationary interlock\
When any owner or administrator requests engine cut\
Then dispatch is denied, regardless of claimed speed or a simulated demonstration.

Given a supported installation has that separately reviewed safety profile\
When its owner requests engine cut/restore\
Then require fresh owner identity verification bound to exact device, truck,
command and short expiry, an explicit confirmation and current assignment\
And cut additionally requires a fresh valid device fix, zero speed, ignition off,
an online device and the device-side stationary interlock\
And forbid delayed/offline queuing, unknown ignition, stale telemetry and replay\
And moving-vehicle, reassignment, permission-loss and timeout races fail closed\
And no simulator outcome certifies real hardware or enables a production relay.

First implementation may exercise relay control only on clearly synthetic
devices. Real engine control stays disabled until the exact safety profile and
physical-device bench/installation evidence are independently reviewed. Do not
represent this gate as a generally working live engine-control feature.

### Scenario: demo telemetry cannot reach real users

Given a separately invoked local demo manifest contains fictional devices and
explicit synthetic provider/truck identifiers\
When GPS, phone and manual simulations move or emit alarms/command responses\
Then each write repeats loopback/project and synthetic-owner/device checks\
And the simulator never discovers arbitrary accounts or starts with production\
And fixture changes require normal additive provisioning/assignment, not replaced
proofs, auth identities or historical truck data\
And real protocol gateway receipts distinguish simulator packets from physical
hardware, including acknowledgements, duplicates and out-of-order samples.

## Ordered verification

1. Pure command/source/time validation and negative authorization tests.
2. Additive SQL rehearsal: RLS/ACL, cross-owner/employee denial, assignments,
   idempotency/replay, privacy, source switching and concurrent command lifecycle.
3. Real local pinned gateway protocol packets, durable restart/retry and command
   roundtrip through the app API/database; verify visible Fleet and map attribution.
4. Desktop/phone/Expo local UI captures and explicit owner visual review.
5. Required full release/security gates and exact infrastructure/hosted approval.
6. Physical tracker and engine-relay checks remain separately recorded until real
   hardware is connected; no fabricated readiness or capacity-scale claims.

Tests: domain/client/worker/privacy/refresh regressions and actual local evidence are mapped in the October15 GPS section of
`specs/TRACEABILITY.md`: domain/client/worker/privacy/refresh regressions,
`tests/sql/telematics.sql`, `tests/sql/telematics-account-privacy.sql`, six real
concurrency races, `tests/e2e/telematics-fleet.spec.ts`, and protocol/restart
receipts. Pure tests, actual protocol traffic and physical hardware evidence
remain distinct; passing local checks do not authorize a release.
The October18 driver-manual addition maps to
`tests/sql/driver-manual-capacity-location.sql`, `tests/mobile-capacity.test.mjs`
and `scripts/verify-driver-capacity-phone-lock-order-local.mjs`. The last test
must first reproduce the old two-session deadlock on an isolated clone, then
pass after migration 174 on the same clone; it has not run yet. The clone must
be created from a protected local preview backup, with no hosted writes.

## Local verification status (October 15)

151 and152 passed a fresh isolated restore rehearsal, the transactional GPS
permission/privacy/source/command tests, Guest workload double-apply assertions,
and the strict database catalog check. Both exact artifacts are installed only
on the backed-up local preview. Hosted schema and infrastructure are unchanged.
Receipts: `.local/telematics/application-151-152-rehearsal-v3.json` and
`.local/telematics/local-install-receipt.json`. Earlier failed rehearsals remain
recorded; PL/pgSQL JSON arguments are qualified so a `command` column cannot shadow
a function argument.

Authorized workspace source enrichment uses only already-authorized vehicle IDs.
Phone capture is unavailable for selected GPS/manual capacity; those screens keep
the actual published location while awaiting a new source report. Switching back
to MOBILE permits only phone reports at or after the selection time. Existing
shipment Tracking phone behavior remains independent. Focused regressions:
`tests/capacity-location-selection.test.mjs`,
`tests/provider-capacity-telematics.test.mjs` and `tests/mobile-capacity.test.mjs`.

Local synthetic demo identities may have the owner's previously approved Gmail
aliases. Additive153 corrects151's overly narrow local-email assumption: require
exact Loadgistic fixture metadata/key plus the original fixture address or the
owner-approved alias, preserving synthetic-only gateway/device, current owner,
fresh Auth and command safety checks. It grants no real device capabilities.
Rehearsal/local installation evidence must pass before demo provisioning; no
hosted application of153 is authorized by this local correction.

Device pagination and bounded visible-screen refresh must preserve unsaved forms
and their original revision, stop when hidden/backgrounded, and avoid overlapping
requests. A refreshed server revision cannot turn an old draft into an apparently
current write. Mobile regression: `tests/mobile-fleet-device-refresh.test.mjs`.

### Scenario: account erasure includes both GPS stores

Given a verified deletion request is ready after existing Tracking/ownership holds\
When erasure prepares an owning provider account\
Then serialize its owner/device boundary against telemetry and commands\
And retire only its device bindings and pending commands\
And queue exact gateway/device/identity-bound upstream cleanup\
And an employee deletion does not retire the employer's devices\
And unfinished Tracking holds remain unchanged.

Given a scoped cleanup job reaches the correct GPS server\
When its exact device binding is independently checked before each destructive step\
Then disable/delete that device and remove its upstream location/event history\
And remove only its bridge payloads/dispatch receipts\
And verify absence before acknowledging the job\
And remove its app raw fixes/manual coordinates/device identifiers during completion\
And keep other providers, shared gateway configuration and essential pseudonymous
shipment/security history unchanged\
And retries are idempotent while ambiguous failures remain pending\
And the account cannot report Completed before all required cleanup is verified.

Given the pinned gateway does not cascade device deletion to raw history\
When the verified erasure adapter purges that history\
Then it requires independent exact scope and a durable pre-delete receipt\
And purges at most500 raw rows total/call for that numeric device only\
And any remaining rows keep the job pending without acknowledgement\
And an unlinked numeric-ID tombstone prevents cached connections inserting new
positions/events after closure or erasure\
And no IMEI, user identity, coordinates or job link is kept in that tombstone\
And the ordinary bridge cannot call the purge or alter its scope/tombstones.

Migration154 and its bounded upstream operator adapter address this new GPS data
boundary. The operator credential is separate from the ordinary bridge's
read-only-device identity. Local rehearsal uses disposable fictional bindings;
no production deletion/credential change is authorized by preparing the workflow.

Deactivation uses a separate DISABLE-only gateway job and retains history, matching
the owner's earlier closure decision. ERASE is reserved for an actual verified
deletion request. Reopening an account does not silently restart GPS collection;
reactivation of its exact hardware binding requires explicit administrator review.
No closure job issues an engine-control command.


Final local acceptance:151–155 are installed only after protected backup/restore,
exact isolated negative/catalog checks, six app closure/credential races and a
separate gateway collection/retirement race. The actual disposable003 workflow
passes DISABLE with retained history, ERASE held until exact upstream cleanup,
post-erasure position/event denial, zero app/upstream raw data and unchanged two
primary trackers. Its earlier false cascade assumption and failed receipts remain
recorded; the pinned6.3 schema removes those foreign keys. The bounded adapter
proves501 raw rows take two calls and keep Pending until zero. Evidence:
`.local/telematics/privacy-verification-evidence.json` and
`gateway-privacy-forward-rehearsal.json`. No production or hardware claim follows.

Actual saved manual point/accuracy-only/Cancel/reload checks pass on web and Expo;
one visible Request location click reaches an actual correlated device reply and
Device confirmed UI. The separate180-second three-source simulation passes with37
GPS positions/36 phone/manual updates and no customer/Tracking changes. Final
source hashes and receipts are mapped in traceability. Owner visual review still
precedes full gates; hosted retention/quotas/backup expiry and physical Android/
tracker/interlock acceptance remain release prerequisites.

## Planned production deployment package — October 21

Status: local gateway and bridge are implemented; a publicly reachable,
production GPS service is not evidenced or authorized. Prepare a portable,
separately deployable container stack for the pinned Traccar gateway, its private
persistent database and the restricted bridge. Keep the demo scenario worker in
a separate service/network identity with no tracker protocol listeners.

The production package must require explicit host, public DNS/IP, firewall and
supported-device profile before activation. Publish only the exact selected
tracker protocol TCP/UDP ports; keep Traccar administration, its database and
bridge administration private. Bridge traffic is outbound HTTPS to the exact
Loadgistic application endpoint with the current gateway HMAC; do not expose the
app's Supabase/service credential to the gateway. Require protected secret
injection, pinned images, resource limits, read-only filesystems where supported,
health/readiness checks, sanitized metrics/logging, bounded retention, tested
backup/restore, storage alerts, stop/drain and rollback that preserves retained
history. IMEI remains an identifier, never proof that an unknown sender owns a
device; actual device enrollment and protocol/firmware command capabilities must
be verified per model. Do not enable engine relay commands for physical hardware.

Acceptance before any hosted activation: deploy the exact artifact to an isolated
staging host; prove one allowlisted real test tracker and one synthetic tracker
ingest through Traccar, durable outbox, signed bridge and app readback; reject an
unknown/duplicate/cross-owner device and replay; exercise offline/restart/backlog,
retention and restore; verify no admin/database port is public; then demonstrate
the current provider's source, permission and privacy projections. Production
secrets, firewall, DNS, hosted database registration, physical devices and public
listeners require exact owner-reviewed operations and are not authorized by
writing this deployment package.
