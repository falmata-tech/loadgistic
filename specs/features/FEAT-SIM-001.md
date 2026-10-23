---
id: FEAT-SIM-001
title: Isolated demo movement with real-device takeover
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-GPS-001, FEAT-GEO-001, FEAT-CAP-001, FEAT-TRK-001, FEAT-MOB-001, FEAT-IAM-001, FEAT-SEC-001, FEAT-ENT-001]
problem: Demo trucks need believable GPS and phone movement without overwriting real devices, changing customer data or implying unsupported phone telemetry.
behavior: Explicit synthetic account/truck/device bindings may produce bounded demo movement through the normal location pipeline. Server-side arbitration pauses simulation when an authenticated real installation takes over, rejects stale queued synthetic reports, and never simulates customer accounts. Private registered phone-installation identities attribute real reports without exposing hardware identifiers. Public/private Capacity and permitted Tracking markers show the actual published source.
contracts: [DemoLocationBinding, DemoMotionLease, RealLocationInstallation, DeviceTakeover, DemoReportArbitration, PublishedLocationSource, PhoneCapabilityProjection, DemoMotionSupervisor]
observability: [demo_tick_accepted, demo_tick_paused, demo_target_denied, real_device_takeover, stale_source_report_denied, demo_runner_state, location_installation_revoked]
rollout: Implement and negatively test local contracts and exact synthetic targets, rehearse additive SQL on an isolated backed-up restore, then demonstrate public/private/Tracking and phone takeover locally. Owner visual review and exact separately approved infrastructure/hosted rollout remain required. No production simulator, credentials, customer write or billing change is authorized by local implementation.
---

# Demo movement and device attribution

Status: implemented in the backed-up local preview, October18; focused SQL,
runner and source-projection checks pass. Actual GPS protocol ingestion saved
three distinct moving fixes, and phone movement saved through the same dated
Capacity source pipeline. Connected Expo review and physical Android/location
lifecycle verification remain separate; no production simulator is enabled.

## Confirmed behavior

- Only explicitly marked, allowlisted synthetic accounts/trucks/devices may move
  automatically. Never discover targets by account inactivity, email pattern,
  missing coordinates or absence of users. Real accounts never get a fallback.
- An authenticated native installation using a demo driver/provider pauses that
  truck's simulated movement before real capture. An emulator is treated the same
  way; do not guess whether hardware is physical. An unavailable/denied real fix
  stays unavailable instead of silently returning to synthetic movement.
- Real selected GPS assignments and real phone reports have precedence. Source
  selection remains deliberate: phone enrollment cannot change selected GPS or
  manual into phone, and the runner cannot change a source, radius, assignment,
  capacity state, visibility, sharing audience or recipient.
- Real-use takeover is sticky until explicit safe operator resume after the real
  binding/session is released or expired. A temporarily silent phone, background
  OS suspension or transient network failure is not evidence of logout.
- Store a private app-installation UUID with authenticated installation binding,
  never phone IMEI, advertising ID, phone number or push token. Reuse the existing
  location installation identity where possible, independently of push consent.
  Logout/account change revokes reporting authority; UUID alone is not authority.
- GPS capability information is model/profile-specific. Phone may supply only
  validated observed location/time/accuracy and genuinely available OS fields.
  No phone ignition, fuel, vibration alarm, relay or engine commands. Missing
  fields remain unknown/unsupported; never invent them to fill a dashboard.
- GPS/phone movement follows a bounded plausible fixture route and interval.
  Both simulated GPS packets and phone reports are sent no more frequently than
  once every 30 seconds, so demo movement does not flood the app or database.
  Manual remains a dated static point, not a continuously moving fake phone.
- Published source badge is small/top-left on the truck circle on public/private
  Capacity and Tracking, web/phone/Expo. It derives from the saved fix, not a
  requested source awaiting its first report. Identifiers/telemetry remain private.
- Synthetic records are identifiable as demo in relevant details. Simulation
  cannot certify a physical tracker or unlock a real engine-control capability.

## Server and infrastructure boundary

Retain pinned Traccar, restricted durable bridge and current fictional001/002
devices. Never recreate erased003. The local runner remains a separate opt-in
process, with start/status/stop, bounded lifetime and one runner per target set.
Its target manifest contains exact identity, ownership, current assignment,
synthetic device and source bindings. Each write repeats current database checks.

Takeover, source changes and synthetic reports serialize against the same truck/
source authority. Persist a generation and capture boundary: old queued ticks,
expired leases or an earlier runner cannot write after takeover/resume or a new
assignment. Application/bridge ingestion must enforce this too; a script-side
preflight alone is insufficient. Stop closes sockets/timers and does not reset
data. Restart cannot erase a real-device takeover.

The runtime simulator receives no general customer-write API. Production needs
a separately reviewed dedicated deployment and exact seeded synthetic manifest;
local acceptance must not remove loopback/production guards. Demo and production
data paths are never selected from an untrusted URL or client flag.

## Tracking dependency

Local shipment location now uses the assignment/source-bound GPS, phone or
manual resolver and restricted recipient projection in FEAT-ENT. Hosted release
still requires the separately reviewed migration set.
Do not relabel a phone event GPS or expose new GPS coordinates to old secondary
recipients. Status-only viewers receive no location, source, timestamp, private
device ID or telemetry. Primary owners and explicitly authorized current staff
may receive only the existing obscured point/radius and honest source/update time.

## Acceptance

Given a real customer, altered demo owner, reassigned truck or foreign device\
When the runner attempts a report\
Then it is denied without changing any customer, source, assignment or location.

Given a valid synthetic truck is moving\
When a real installation takes over or a real selected device is assigned\
Then simulation pauses under the same server-side authority lock\
And queued/in-flight old-generation ticks cannot overwrite the real fix\
And a delayed heartbeat or server restart cannot resume it automatically.

Given the real installation stops providing fixes temporarily\
When the latest fix ages or permission is denied\
Then its actual age/unavailable state is shown, with no fabricated new movement.

Given two phones, foreground/background captures or an account switch\
When a report arrives from superseded or revoked device authority\
Then it is rejected and cannot overwrite the currently selected installation\
And out-of-order observed times cannot appear as fresh server-time positions.

Given a truck's published GPS, phone or manual fix\
When public/private/authorized Tracking maps render\
Then the circle shows the matching source badge and accessible source description\
And unknown history stays unknown and no private installation/IMEI is projected.

Given an authorized Tracking point overlaps a saved city stop on Expo\
When the map renders both markers\
Then the vehicle marker and its tap target appear above the city marker;
status-only viewers still receive neither vehicle marker nor point.

Given an authorized public or private Capacity response includes per-fix
`location_is_demo` provenance\
When the native Capacity parser receives a visible valid location\
Then only an exact true boolean marks that saved fix as Demo location in its
accessible marker and location details\
And missing, invalid, hidden or non-boolean provenance is not inferred from the
account, source selection or simulation control state\
And private epochs, installation identifiers and extra response fields are not
retained by the native projection.

Given a phone source is selected\
When fleet details and controls render\
Then only observed supported phone fields appear\
And no GPS hardware alarm, ignition/fuel or engine-control capability is implied.

Tests: `tests/sql/demo-location-arbitration.sql`, `tests/sql/phone-location-installations.sql`,
`tests/sql/tracking-selected-sources.sql`, `tests/demo-motion.test.mjs`,
`tests/phone-location-contract.test.mjs`, `tests/tracking-map.test.mjs`, and
`tests/web-tracking-source-marker.test.mjs`. Rehearsal/install receipts and saved
movement evidence: `.local/demo-devices-20261018/`, including
`movement-persistence-evidence.json`. The first cold run correctly denied five
reports delivered after its lease expired; the subsequent warm run persisted
three distinct GPS fixes. No rejection was suppressed or gate weakened. Actual
Chrome source badges and business feed checks are recorded in
`.local/seo-20261018/chrome-map-seo-review.json` and
`.local/business-capacity-20261018/evidence.json`. Installed Android real-device
takeover/background behavior and physical GPS hardware remain separate evidence
from browser/protocol simulation.

## Planned expansion — coordinated demo-world workflows (October 21)

Status: the exact local demo manifest, Capacity status planner and bounded local
command adapter are implemented. Five manifest-listed synthetic vehicles can
advance through morning and afternoon status changes with the ordinary provider
command, protected local replay receipts and saved readback. Four of those
vehicles use the separately allowlisted fictional GPS cohort; the fifth is a
private driver example. Empty area-only vehicles remain stable because a Partial
signal requires a route. Later local slices added leased worker commands and
durable receipts for Capacity, handover and broker sharing; their controls are
off. The complete scenario and production simulator remain unqualified.
Local October22 evidence: a protected full backup was restored to the disposable
GPS test database; migrations 183–184 and the cohort/provision SQL regressions
passed there before local preview installation. Ten fictional devices were
provisioned; a 90-second run accepted three fixes per target and stopped cleanly.
Nine exact GPS vehicles appeared with located Demo/Telematics projections in
the paginated public Capacity API; the phone example remains private. The five
Capacity cycles saved through `publish_provider_capacity`, then replayed without
another write. This verifies local web/Expo Web data, not an installed Android
app, physical tracker, recurring schedule, or hosted deployment.
The owner expects it to
exercise the same kinds of changes people can make in the product, including
driver/vehicle reassignment, but only as coherent, server-validated demo
workflows.

### Planned behavior

- A server-managed scenario scheduler advances a fixed, versioned manifest of
  explicitly synthetic providers, businesses, drivers, vehicles, device bindings
  and shipments. It never discovers demo targets by email, inactivity, profile
  shape or user-controlled flags.
- Scenarios may exercise supported user-visible transitions: provider profile
  edits; vehicle Draft/Live/Off Duty/retirement; driver assignment and
  reassignment; capacity status, load preference, routes, visibility and
  location-source changes; business connections, staff permissions and Capacity
  sharing; optional document submission/review; and shipment creation, loading,
  travel, arrival, proof and owner approval. Every transition goes through the
  existing validated domain/application command and records a simulator actor
  plus immutable event history. Each scenario identifies which exact actor is
  acting and which existing permission permits that action.
- Driver/vehicle assignments may change when the scenario reaches a safe
  handover. The scheduler does not replace a driver/device during an active
  shipment or reuse one driver's private manual point for another. A handover
  atomically closes the old assignment epoch, preserves history, assigns only an
  eligible demo driver/vehicle pair, updates device/source authority, and
  re-evaluates only future unsaved Featured days. Saved Featured schedules and
  in-progress tracking agreements retain their existing rules.
- Each day retains a deliberately stable baseline across important vehicle,
  capacity, route, sharing and location-source filters while a smaller rotating
  set demonstrates changes. The scheduler must not produce an empty map or
  Featured day solely because a scenario is between transitions.
- Shipment/document/support simulation uses exact synthetic records and
  recipients. Synthetic document review may exercise Submitted, Needs changes,
  Approved or Expired states only with prominent Demo provenance; it cannot
  create a trust claim about a real provider. Proof fixtures are marked as
  demonstrations. A dedicated notification sink records what would have been
  sent inside the synthetic workspace, but sends no real email, SMS, push,
  external support message, tracker command or other third-party action. Only the
  tracking owner and explicitly authorized synthetic staff receive a moving
  location; status-only recipients receive route/status only.
- Production simulation, if separately approved, uses its own scheduled
  dispatcher and background worker, separate from both the regular managed
  operations worker and GPS bridge. The short schedule only dispatches; a
  bounded background worker claims a small durable batch using idempotent leases,
  a separate HMAC, server-side demo manifest, kill switch, safe retries and
  sanitized metrics. It has no unauthenticated or caller-selected command,
  GPS gateway credential or device-control capability. The existing local-only
  GPS runner remains local-only; production is never enabled by weakening its
  environment guard.

### Provider-profile scenario — local cycle verified

An exact fixture-marked fleet provider may alternate only its public headline
and About text through the normal `update_provider_profile_page` command at
09:00 UTC, then restore the recorded baseline at 15:00 UTC. The scenario has
its own default-off control as well as the global kill switch. It does not edit
contacts, handles, vehicles, Capacity, documents or notifications.

Given the exact synthetic owner, page, current baseline and enabled controls\
When a due SHOW_DEMO or RESTORE phase is claimed\
Then the normal profile command saves only that phase's headline and About text\
And the saved page remains publicly readable with the same owner and identity\
And an immutable receipt prevents a retry from making a second edit.

Given a wrong actor, changed page text or identity, stale lease, missed phase,
or either control switched off\
When a worker tries to advance the profile\
Then it makes no profile, contact, Capacity or notification change.

Migration 195, `tests/sql/demo-world-provider-profile.sql`, and the focused
profile, worker and advance tests passed on a disposable restored-preview
database. The test clone was removed. In the local preview, the exact marked
Sheger provider page was bound and two profile-lane RPC phases showed then
restored its headline and About through the normal command. Google Chrome
read the public page at baseline, alternate and restored states. Two immutable
receipts exist, no jobs are due, notifications were unchanged, and the global
and profile controls are off again. Only `updated_at` differs from the page's
original row. Migration 195 is not installed on the hosted database; a
recurring hosted schedule and deployment remain unverified. The restored About
still contains older “truck capacity” copy; copy polish is separate from this
cycle proof.

### Broker staff permission scenario — local cycle verified

The exact synthetic broker owner has invited one fixture-marked staff account
through the normal workspace flow in the local preview. A separate, default-off
lane may turn only that staff member's Capacity permission off at 10:00 UTC and
back on at 14:00 UTC. Tracking and owner permissions remain on. The lane uses
the normal revision-checked `UPDATE_MEMBER` command and immutable receipts;
it never sends an invitation, email, push or private Capacity grant. It must
refuse an unmarked account, extra member, changed workspace/permission revision,
missing prior phase, stale lease or either disabled control.

Given the exact synthetic owner and accepted staff invitation with both
permissions initially enabled\
When a due Capacity-off or Capacity-on phase is claimed and executed\
Then only the staff Capacity permission changes through `UPDATE_MEMBER`\
And owner and staff Tracking access stays enabled\
And replay does not make another edit or notification.

Migration 196, the exact fixture and focused SQL/JS tests passed on a fresh
isolated Auth/database restore. Migrations 195 and 196 were then installed in
the local preview with controls off and bound only to the exact marked broker
owner and accepted staff. Two team-lane RPC calls completed Capacity OFF then
ON: workspace version 3→5, staff revision 1→3, two immutable receipts, and
zero pending jobs. Owner and staff Tracking access stayed on, staff Capacity
was restored, private grants were unchanged, and no email or push was added.
The global and team controls are off again; the separate exact Tracking
notification interceptor remains armed. Production was untouched. The
synthetic staff also accepted the normal first-use policy in local Expo Web,
selected the broker workspace, filtered to one PARTIAL Pickup, and saw its
marker without page errors. A browser readback during the permission change,
installed Android and hosted scheduler operation remain unverified.

### Hosted recurring GPS and phone movement (planned)

The marketplace scenario worker does not generate location fixes. A separately
deployed movement worker is required before hosted demo vehicles can be described
as moving. The present motion HTTP adapter, GT06 simulator and process supervisor
reject production or non-loopback targets, and the one-hour lease expires; the
hosted gateway Compose template has two isolated gateway stacks. A separate
default-off hosted application HMAC route and migration 189 database kill
control have passed isolated local tests. An opt-in privately networked worker
is implemented and passes mocked behavior tests. Migration 189 was rehearsed
and installed on the local preview with its control off; it is absent from
production. No hosted worker is deployed, and no
hosted settings are enabled. These are intentional gates, not evidence of a
working hosted movement service.

A hosted worker must use the same exact ten target names, vehicle UUIDs and
fictional IMEIs as the server command allowlist and database binding checks.
Every selected hosted record must be independently proven to have its expected
fixture owner, current driver, synthetic device, assigned truck, selected source
and publication state before activation. Missing or changed records fail closed;
the worker must not discover replacements, enroll customer devices, change a
source/radius, or issue any tracker command. The one phone target reports through
the existing narrow phone RPC. The nine GPS targets send reserved GT06 fixes to
an internal-only synthetic Traccar instance and signed bridge registered as a
synthetic-only gateway. Real test trackers use a separate non-synthetic gateway
identity and public ingress. Neither the synthetic listener nor its database or
admin API is published; sharing a public GT06 listener with fictional IMEIs is
not an acceptable synthetic-origin boundary. Hosted movement must not dispatch
device commands; both hosted bridges explicitly disable the command lane and
receive no Traccar API token. The public real-device gateway has no simulator
command path. This is template/configuration behavior, not deployed evidence.

Given the hosted gateway template is rendered for an approved bind address\
When its services, ports, networks and credentials are inspected\
Then only the real GT06 port and loopback-only real admin API have host bindings\
And the fictional gateway, admin API and database have no host binding or shared backend network\
And both bridge command lanes are disabled without Traccar API credentials.

Given a duplicate real/demo gateway identity or credential, malformed database
password, non-HTTPS app endpoint or catch-all ingress address\
When the offline hosted configuration preflight runs\
Then it rejects the template before any container starts or provider is changed.

Focused evidence: `tests/telematics-hosted-config.test.mjs`,
`tests/telematics-hosted-topology.test.mjs`,
`tests/telematics-worker.test.mjs`, and rendered `docker compose config`.
These prove configuration isolation only. The application HMAC route,
transactional database kill control and opt-in worker have separate focused
tests below; an end-to-end hosted movement rehearsal remains required before
this acceptance path can be called deployed.

The hosted application route uses a distinct protected movement HMAC and
nonce replay check, an explicit default-off enable control and kill switch, and
an independently checked exact deployed site ID, HTTPS origin and Supabase
project reference. The worker pins that same HTTPS origin and uses no app,
Supabase, gateway, Traccar API or database credential. Enabling the marketplace
scenario worker must never enable movement. The existing local-only path and its
loopback/project refusal remain intact; hosted mode needs a separate reviewed
authorization path and negative tests, not a relaxed local guard.

Given hosted movement flags are absent, a different site/project is selected,
the kill flag is on, or the signature/target is invalid\
When an internal hosted movement request reaches the app\
Then it returns a bounded denial without opening a database client or exposing
credentials, identifiers or request contents.

Given a signed command for one exact synthetic target\
When the application forwards it to migration 189\
Then nonce replay, target identity, default-off control and the command are
validated in one database transaction\
And no `RESUME`, arbitrary device, customer target or direct table write is
available to the worker.

Given a hosted lease holds the database control lock during a GPS or phone tick\
When an operator enables the database kill switch\
Then the kill waits for that in-flight transaction, revokes hosted running
leases with a new epoch and clears their lease IDs before it commits\
And a later reservation or report cannot change the saved real or historical
location.

Focused evidence: `tests/demo-motion-hosted.test.mjs` and
`tests/sql/hosted-demo-motion-control.sql` pass. Migration 189 installed and
its rollback rehearsed only on the disposable restored-preview clone
`loadgistic_hosted_motion_189_ci`; rollback restored the prior lease function
exactly. A measured concurrent lease/kill check waited about 8.2 seconds,
then returned target OFF, no lease and epoch incremented. This is local
rehearsal evidence, not a hosted activation or production write.

Each target needs its own bounded lease and generation. A single target's real
installation/device takeover, failed binding or stale source pauses only that
target; other exact demo targets may continue. Automatic recurrence may restart
an expired ordinary lease only after checking authoritative status and binding.
It must never send `RESUME` for a REAL state: an operator first verifies the real
installation or device has been deliberately released, then explicitly resumes
that exact target. Queued packets and old generations cannot replace a real fix.
At most one worker owns a target at a time across restarts; crashes wait out or
reconcile its existing lease instead of stealing it. GPS and phone cadence remains
at least 30 seconds, with bounded concurrency and retry/backoff.

The kill switch must block new leases and every GPS reservation/phone report at
the application boundary immediately, even if a worker remains alive. A stop
drains sockets and releases only matching generations; if cleanup fails, the
backend lease expires without deleting saved GPS history or altering sources.
Read-only health reports only enable/kill state, target counts by OFF/RUNNING/
REAL/EXPIRED, age of last accepted GPS and phone fix, lease/worker age, gateway
queue lag and bounded error codes. Logs, metrics and health never include IMEIs,
coordinates, contact data, lease IDs, HMACs or raw request bodies. Stale movement
must be shown as stale, not filled with synthetic fallback.

Given an exact hosted synthetic cohort and separately enabled movement control
When the worker starts or renews a GPS or phone target
Then the app, database and gateway verify the same exact target and deployment
And a saved fix reaches only its selected source with demo provenance
And the worker has no command, customer-record or notification capability.

Given a real installation reports, a physical device takes over, or a target's
owner, driver, assignment, source or device binding changes
When an old-generation report arrives or the worker next schedules that target
Then it is denied without changing the real or other tenant's location
And only that target remains paused until exact operator-reviewed resume.

Given the worker crashes, overlaps another instance, loses the app or gateway,
or sees a malformed status
When it recovers
Then it cannot steal an active lease or emit an unreserved packet
And retries are bounded and observable without disclosing identifiers or secrets.

Given the hosted kill switch is enabled during a run
When another reservation or phone report arrives
Then the application denies the write immediately
And stopping the worker retains historical fixes, sources and real-device state.

Worker deployment, staging host, activation and end-to-end saved readback
remain pending. The local route and database tests above do not replace
negative customer/takeover, worker overlap/crash/restart, bridge isolation,
private-network and saved GPS/phone readback tests on an isolated staging host
before any hosted activation.

### Hosted movement worker acceptance

Given the dedicated worker profile is absent or its separate enable flag is
false or kill flag is true\
When the hosted Compose stack starts or the worker preflight runs\
Then no demo request or GT06 packet is sent and the process remains inert.

Given the exact ten synthetic targets and an approved hosted configuration\
When a target reports OFF or an expired ordinary lease\
Then the worker starts only that exact target, checks the returned source and
generation, and reports at most once per 60 seconds\
And a GPS target connects only to the private synthetic GT06 service after
the app reserves that fix, while the phone target reports through the signed
application command.

Given a target reports REAL, a live lease owned by another worker, changed
source/binding, app kill denial, or a failed GPS login\
When the worker reaches that target\
Then it does not send a location packet, does not call RESUME or issue a device
command, and records only a bounded failure code\
And the other exact targets continue independently.

Given a worker stop, timeout or crash\
When its current generation is released or expires\
Then later packets and stale generations cannot publish a fix, and a restarted
worker does not steal a still-live lease.

Focused implementation evidence: `tests/telematics-hosted-motion-worker.test.mjs`
proves default-off offline preflight, exact signed requests, bounded network
failure, private GT06/command rejection, reserve-before-packet, REAL and
other-worker lease skip, target isolation, kill-aborted cohort and route
continuity. `tests/telematics-hosted-topology.test.mjs` proves the worker is
absent from default Compose and has no public port, real-gateway network or
privileged credential when its profile is selected. These use mocked app
responses and a fake socket. The focused worker test also ran an offline
ephemeral 127.0.0.1 GT06 login/ACK/position roundtrip, confirming that its
reserved fix reaches a TCP peer before STOP. CI sets
`REQUIRE_GT06_LOOPBACK=true` so this test cannot silently skip on its Linux
runner. Real Traccar/bridge/app persistence and restart evidence on an isolated
staging host remains required.
CI also builds the opt-in worker image and runs its disabled preflight with
Docker networking removed, catching missing packaged imports without sending
a hosted request.

### First local implementation slice — deterministic capacity planning

This slice is local and side-effect free. It is a foundation for the broader
scenario worker, not a claim that the comprehensive simulator is complete.
The manifest may reference only exact synthetic fixture keys and their
fixture-defined ownership links. It contains no email, phone, secret or
user-discoverable target. The planner proposes only `capacity.set_status` for
the explicit `EMPTY`/`PARTIAL` cycle; it does not execute a database write,
change production data, or send a notification.

Given the manifest matches the current synthetic fixture source and schema
When the planner validates its actor, vehicle, capacity and ownership links
Then it accepts only exact fixture IDs with matching roles and relationships
And it rejects unknown, duplicated, mismatched or real-looking targets.

Given a supported UTC schedule slot and the same manifest version
When the planner is called repeatedly for that slot
Then it returns the same transition, expected prior state and idempotency key
And the transition key is unique across scenario, target and date/slot.

Given a different or unsupported transition command, status, slot or manifest
When the planner is called
Then it rejects the plan before producing any action.

The broader scenario worker, shipment workflow, sharing, document/support
events, general notification isolation and hosted deployment remain
unimplemented until their separate acceptance and database-recovery evidence
exists. Later local slices now provide a validated Capacity command adapter,
an inert durable Capacity worker, one exact Tracking notification sink and an
inert atomic driver handover; none implies that the full simulator is enabled.

### Next local slice — genuine Capacity edits on an exact demo pair

The virtual timeline may change an explicitly listed demo vehicle's accepted
load preference while it is Empty, and may change another listed vehicle's
route between two fixture-backed sets of places. Both return to their baseline
before the next status cycle. These are ordinary Capacity saves by the
fixture-authorized provider; they do not change sharing, source selection,
driver assignment, documents, Tracking or notification state. The mutable
subset remains small enough to leave stable Empty and Partial results visible.

Given an exact fixture-authorized actor, Live vehicle, assigned demo driver and
expected current Capacity state
When a due load-preference or route step is advanced locally
Then the ordinary `publish_provider_capacity` command saves the change and
readback proves the intended status, preference or ordered place references
And the previous sharing mode, public/private visibility, location source and
the other Capacity fields remain unchanged.

Given a stale status, changed route/preference, real or unlisted actor/driver,
different sharing policy, or a route reference absent from the checked fixture
When the same step is considered
Then it is refused before any Capacity save, and no notification is dispatched.

Given the same manifest and UTC day are advanced again
When an earlier successful step has a matching receipt
Then replay is read-only and checks its saved record; a receipt with a different
actor, vehicle, or result is rejected. Local receipts are not the durable
cross-host guarantee required for a hosted worker.

Local preview evidence, October22: all 14 exact steps saved through the ordinary
Capacity command on five synthetic vehicles and returned to their starting
status, load preference and route. Repeating the same virtual day replayed all
14 receipts without another save. The five vehicles retained their previously
saved PRIVATE/PUBLIC/BOTH/PUBLIC/BOTH sharing modes, location sources and active
driver assignments. The present local Capacity records have multi-pick and
multi-drop values of false for these five targets even where the checked-in
market fixture lists true. This is observed fixture-versus-preview drift, not a
reason to change those saved values silently or to claim the stable demo
coverage gate is complete. A fresh fixture import may have different sharing
modes; a hosted worker must check its exact selected-environment modes before
enabling any scenario.

### Local demo world and web/mobile parity

Local testing uses one isolated Supabase database and one local application API
for web and mobile. Desktop web runs at `127.0.0.1:3100`; the Expo web preview
proxies its allowed API and public-asset requests to that same local app. Native
Expo development builds must point to the same app API using an address
reachable from the emulator or phone. A preview must fail closed if its resolved
API is production while a simulator is enabled.

The local world has three separate layers:

1. A deterministic, richly varied baseline fixture provides stable discovery
   results for each important vehicle, capacity, route, location-source,
   visibility, and region filter. Those anchor examples remain available while
   scenarios run. Resetting the fixture is an explicit local operation, not a
   simulator side effect.
2. A versioned scenario manifest chooses a small exact subset of synthetic
   records and describes realistic, ordered user actions. A virtual clock lets
   QA advance a day or week in minutes, pause, replay, and inspect the next
   action without random production-like churn. All effects go through the same
   validated application commands as a user action; no direct table mutation.
3. A movement layer exercises GPS protocol ingestion and phone-location reporting
   through their existing local pipelines. Manual locations stay static. GPS,
   phone, and manual source examples remain distinct in saved state and in both
   web/mobile map projections.

Current local coverage audit (October22): the database contains 252 vehicles;
163 are linked to accounts with the protected `fixture_source=loadgistic` marker
and have an active fixture-marked driver assignment. There are 310 Capacity rows.
The local database also has 47 fixture-created provider Tracking records with
89 associated events, three cargo-team workspaces and 11 fixture-created
private Capacity grants; the separate legacy `shipments` table is empty. Only
two vehicles are currently movement-authorized:
one GPS and one phone; the GPS target is public and the phone target is private.
The motion RPC, HTTP command schema, runner and synthetic-device provisioner each
hard-code those two targets. This is why the GPS filter shows one moving vehicle;
the simulator does not discover every demo vehicle. The owner confirms current
vehicle data are demo data and authorizes local use, but automated writes still
must use an exact protected manifest, never a broad query or a source-only flip.
The fixture reset importer is prohibited for this existing database because it
deletes all fixture-tagged rows. Migration-ledger drift (recorded in
`docs/PROGRESS.md`) also blocks applying new simulator schema here until it is
reconciled safely.

The next movement slice will bind eight publicly visible fixture-owned vehicles
from separate demo providers to eight distinct synthetic GT06 identifiers, while
retaining the existing private Phone target and adding no claim that a physical
device exists. This target set exists only for local simulation, leaves all other
vehicles and their sources unchanged, and must pass owner/driver/device binding
checks on every tick. It is a separate need from the broader marketplace-event
simulator.

Given the same local fixture revision and database snapshot are used by web and
Expo
When a seeded visitor, provider, driver, shipper/broker owner or authorized staff
member views or changes a scenario
Then both clients read the same local application API and authoritative saved
state
And a user-visible marketplace change is checked in discovery and map/filter
results on both clients
And no preview silently falls back to live production data.

Given the baseline and scenario manifests are seeded repeatedly
When the same manifest version and virtual-clock instant are applied
Then the same stable discovery anchors and scheduled transitions result
And all target links, role permissions, vehicle categories, Empty/Partial states,
routes, source types and public/private boundaries satisfy the fixture coverage
gate before the app is presented as a complete demo.

Given an exact synthetic GPS or phone target receives a simulated fix
When the normal local ingestion pipeline accepts it
Then the resulting location and source badge update in web and Expo from saved
state
And manual targets, real installations, non-manifest rows and hosted projects
remain unchanged.

Given the local movement manifest contains eight unique synthetic GPS device and
vehicle bindings across eight demo providers
When the bounded GT06 simulation runs and stops
Then each authorized public GPS marker receives fresh saved location data visible
through the same local API on web and Expo
And no physical IMEI, existing real tracker, phone target, manual source, or
non-manifest vehicle is reassigned or written.

Given the local movement process is absent but an exact target still has an
unexpired backend motion lease
When an operator starts or resumes the simulator
Then the command refuses before overwriting the saved runner state or spawning
another process
And it reports a sanitized active-lease reason without exposing lease secrets
And status distinguishes the local process from backend target state.

Given a target starts but a later target or movement step fails
When the bounded runner exits
Then every lease acquired by that run is stopped with its exact lease and epoch
And the terminal local state records a sanitized failure code and target result.

Given local GPS and phone demo movement is running
When either target emits another simulated fix
Then each target emits no more frequently than once every 60 seconds and a
larger demo cohort starts its targets at separate intervals rather than a burst
And the web and Expo previews remain available while movement is active.

Given a visitor leaves the Capacity map open while a saved signal changes
When the map is visible and the app is in the foreground
Then web and Expo refresh the saved map results within 60 seconds without
resetting the selected vehicle, and its displayed location time reflects the
new saved fix. Hidden or background maps do not poll.

Given a QA actor advances a workflow scenario or retries the same step
When a permission, state precondition, lease, or idempotency check fails
Then the step is denied or safely replayed with a clear local result
And real records, external recipients, physical tracker controls, and live
notifications remain untouched.

The checked-in `managed-market.json` is an existing large discovery fixture, not
yet a complete demo world: it has 143 vehicles and 143 capacity rows (36 Empty,
107 Partial), nine organizations and 30 company pages, but no shipment or
shipment-event rows in that file. The local database already contains separate
synthetic Tracking and cargo-team examples; validate and reuse them before adding
more. The current demo-world manifest covers seven exact targets and five mutable
Capacity targets. Its local command adapter runs their five status cycles.
The separate signed worker now invokes one exact, durable 14-day driver-handover
lane after Capacity steps; that lane and the imported shipment's bounded
notification sink are installed on the local preview but disabled. Automatic
shipment transitions, a general notification sink and additional role actors
remain unimplemented. Preserve the existing fixture
as stable baseline data and keep its reset separate from event playback.

### Exact synthetic Tracking notification isolation

The imported `LGX-DEMO-0001` Tracking example is a fixed synthetic shipment.
Installing its isolation is inert while `demo_world_control` is disabled:
existing email and push delivery behavior remains unchanged. Once the separately
reviewed control is enabled, its email, owner sign-in code and driver handover
push intents must be recorded in a private, recipient-free demo sink inside
the same database transaction as the normal Tracking command. While enabled,
they must never enter the external delivery queues.
The guard binds the exact shipment, vehicle, provider/driver fixture identities
and synthetic `.test` recipients; changing any of these denies the attempted
delivery. Existing dispatchable rows block installation and are checked again
transactionally when the control is enabled, including rows queued since
installation. Ordinary shipments retain their existing delivery path. This
slice does not authorize creating new simulated shipments, sending real codes,
uploading or approving proof, or running the Tracking lifecycle automatically.
The imported shipment remains `IN_TRANSIT`: it lacks required loading proof,
so no automated unloading or completion is truthful. Its selected GPS source
can move the owner's Tracking map through the existing demo GPS path, while
a shared viewer receives route and status without the moving location. Since
the synthetic owner's email code is sinked, this slice verifies the authorized
database projection only; an interactive owner demo requires a separate,
reviewed access path that neither exposes the code nor bypasses normal access.

Given the demo-world control is disabled or an exact-fixture delivery is
already dispatchable when enablement is attempted\
When the migration or activation guard handles the event\
Then disabled delivery retains its ordinary queue behavior\
And enablement refuses any existing dispatchable exact-fixture email, sign-in
code or handover push; a failed migration leaves no partially installed sink.

Given the exact imported synthetic shipment produces a Tracking email, sign-in
code or handover push intent while the demo-world control is enabled\
When its normal database command inserts the delivery intent\
Then a single recipient-free demo receipt is stored transactionally\
And the external email, access-email or push outbox contains no new row.

Given the fixture identity, shipment recipient or notification recipient drifts\
When the same intent is attempted\
Then the command fails before an external queue row or demo receipt is saved.

Given another shipment uses those same ordinary commands and delivery queues\
When email, sign-in code or push intents are inserted\
Then the pre-existing external delivery behavior is unchanged. The isolated
rollback-only SQL check is `tests/sql/demo-world-tracking-notification-sink.sql`.

Given a synthetic GPS fix is selected for `LGX-DEMO-0001` while it remains
`IN_TRANSIT`\
When the normal owner and shared-viewer database projections are requested with
their respective authorized identities in an isolated test\
Then the owner sees the selected approximate position and source\
And the viewer sees route and status without that moving position. No
simulated proof, owner approval or delivery-completion event is created.

A separate **new** synthetic shipment may demonstrate the full lifecycle only
when four contracts are verified together: (1) a fixed fixture-marked
provider, driver and owner identity, with the owner acting through the normal
five-minute verified session; (2) real private image objects visibly
watermarked “DEMO — no real cargo,” retrievable through the normal proof route;
(3) exact notification interception covering that shipment's creation,
recipient sign-in and completion before the first command; and (4) a persistent
demo marker displayed on the shipment, event timeline, proof viewer and owner
approval in both web and Expo. The fixed new local shipment has passed creation,
status updates and two private proof uploads; owner approval and visual
cross-platform review remain incomplete. A SQL-only scripted approval would
still be misleading.

### Separate synthetic shipment lifecycle — readiness contract

The imported `LGX-DEMO-0001` is a stable, incomplete Tracking example. It must
not be retroactively given a loading proof, moved to Unloading, or approved by
the simulator. A full lifecycle uses a **new**, fixed scenario identity and a
different eligible synthetic vehicle/driver pair. It is a local-only,
incomplete scenario, with no recurring lifecycle worker or hosted deployment.
Migration 191 must never be used to make the imported example appear complete.

Before **persistently creating** that new shipment in a preview or hosted
environment, an isolated rehearsal must prove all of the following together.
A rollback-only disposable-clone creation may exercise one prerequisite at a
time, but it is not a visible or approved lifecycle demonstration:

1. A versioned manifest names one exact fixture-marked provider, assigned
   Driver, vehicle, shipment ID and synthetic shipment-owner address. The pair
   has no active Tracking agreement or handover conflict. The server rechecks
   those identities and the current assignment inside every claim and command;
   a caller cannot choose or substitute a target.
2. Creation uses `create_provider_tracking_with_recipients` with the existing
   route, permission and idempotency rules. An exact-target notification sink
   is installed **before** creation and atomically intercepts its access email,
   owner OTP and completion/push intents. Activation refuses pre-existing
   dispatchable rows. The sink contains no recipient address, OTP or bearer
   token, and unrelated shipments retain their normal delivery path.
3. Loading and Unloading each use a distinct real image object in private
   `shipment-proof` storage, clearly watermarked `DEMO — no real cargo`. The
   ordinary upload/scanning and authorized proof-read paths must retrieve the
   object in web and Expo. A plausible-looking database path alone is not a
   proof. Failed upload or inaccessible proof leaves the phase unchanged.
4. The synthetic owner requests and consumes a normal email OTP, then approves
   through the same five-minute session-bound application boundary as a real
   owner. The simulator may act only as this explicitly marked synthetic owner;
   it cannot pass an invented `verified_at` or recipient digest straight to
   `approve_provider_handover`, use platform-staff approval, or skip either
   proof. OTP and session material remain ephemeral and never appear in a
   client projection, receipt, log or repository fixture.
5. Provider, Driver, owner, secondary-viewer and staff views in web and Expo
   identify the shipment, each event, both proofs and owner approval as a
   demonstration. The owner and explicitly authorized current staff alone may
   see the selected approximate moving position; the viewer receives route and
   status without location/source/time. A demo completion never becomes
   evidence of a real delivery, verified identity or reviewed document.

The scenario is a finite, ordered sequence: create; load with proof; travel;
arrive and unload with proof; verified owner approval. Durable per-phase
receipts/leases make retries idempotent and prevent out-of-order execution. A
failed, denied or stale phase does not advance the phase pointer, reassign the
vehicle or change the existing imported shipment. One completed exact shipment
stays Completed; repetition requires a separately reviewed new identity rather
than resetting or rewriting its history.

Given only the current imported fixture and migration 186 exist\
When a lifecycle worker checks readiness\
Then it refuses to start; `LGX-DEMO-0001` remains `IN_TRANSIT` without a
  loading proof or approval, and no new notification leaves the demo sink.

Given the new manifest, private proof objects, exact notification interception,
verified-owner session path and visible Demo provenance are independently
rehearsed on a disposable restore\
When a phase is executed through its normal command\
Then the saved event/proof and authorized web/Expo projections match that phase\
And a retry, foreign actor, changed assignment, stale proof, expired owner
  session or unrelated shipment cannot advance it or send a notification.

The first focused negative check is
`tests/sql/demo-world-tracking-lifecycle-readiness.sql`. It protects the
existing imported example only; it does not qualify a future lifecycle,
private storage, owner session or migration 191. Those require separate
end-to-end evidence and exact production review before activation.

Migration 191 reserves new synthetic ID
`2cb3ecbd-e627-485d-99cc-7c9ae5d641bc` for the original fictional fleet's
Truck 02 and its assigned Driver 02, with one `.test` owner address. It installs
**disarmed**: service-role/application code cannot arm it, and guessed use of
that ID is rejected before a shipment row can commit. Once separately armed,
the normal provider creation command may use the preallocated ID. Exact-target
access email, owner OTP and Handover push intents are intercepted before their
dispatcher queues; altered actor, assignment or recipient identity fails
closed. The existing `LGX-DEMO-0001` sink and ordinary shipments retain their
own behavior. Migration 191 reserves and tests notification safety; the
separate local application rehearsal below exercised later status and proof
steps.

The separate `demoTrackingProofFile` fixture prepares two distinct PNGs for
that reserved ID using the exact phase and timestamp, each visibly marked
“DEMO — NO REAL CARGO” and “Not evidence of transport or delivery.” Its focused
test verifies PNG decoding, dimensions, phase distinction and rejection of
the imported shipment or an arbitrary target. Preparing these bytes performs
no storage or shipment write. The local rehearsal used the ordinary web
quarantine/scanner/private-storage path for both phases and read them as the
assigned Driver. The later guarded continuation opened both proofs in the synthetic owner's
normal short-lived email-code session and approved Unloading through the
ordinary web endpoint.

The migration and `tests/sql/demo-world-tracking-lifecycle-reservation.sql`
passed on the disposable, fixture-loaded
`loadgistic_demo_lifecycle_191_ci` clone. The test creates the new shipment
through `create_provider_tracking_with_recipients` **inside a rolled-back
transaction**, proving disarmed creation denial, exact access/OTP/driver-push
interception, foreign-recipient denial and no external queue rows. After a
fresh protected local preview backup and clean disposable restore, 191 was
installed **disarmed** on local preview. A bounded local rehearsal briefly
armed it and used the validated creation command for that one exact new ID,
then the ordinary Driver web endpoint to record `TO_PICKUP`, `LOADING` with
private watermarked proof, `IN_TRANSIT`, and `UNLOADING` with a distinct private
watermarked proof. Both proofs were read through the authorized private route.
The first synthetic-owner run consumed its normal OTP, then stopped before
approval because the harness expected four timeline events instead of five
(including `CREATED`). No product OTP failure was established. The exact
shipment remained `UNLOADING` until the separately guarded continuation.

Migration 193 is an additive, exact-target resume guard: it permits arming
only this same incomplete synthetic shipment when its actor, assignment,
recipient, single access receipt and empty external queues still match, while
denying completed or forged state. A filtered disposable restore excluded only
provider-owned `realtime.list_changes`, `spatial_ref_sys` table data and vault
secrets; the app/auth fixture restore then exited cleanly. On that clone, 191,
193, `tests/sql/demo-world-tracking-lifecycle-reservation.sql`, and the
rollback-only `tests/sql/demo-tracking-exact-incomplete-resume.sql` pass.
That regression also denies a different shipment ID, changed actor, duplicate
access receipt, completed shipment and disabled global control. A fresh
protected local preview backup restored cleanly into a second disposable
clone with the already-incomplete shipment; rollback-only re-arming passed.
Migration 193 was then installed on **local preview only**. A bounded
continuation requested a fresh normal OTP, verified its five-minute HttpOnly
session, opened both private proofs as the owner, and approved Unloading
through `/api/tracking/{id}/approve`. Local readback shows `COMPLETED`, six
events, two private proofs, four recipient-free notification sink receipts,
and zero target external email or push queue rows. Both global and exact
lifecycle controls were disarmed in `finally`. The imported `LGX-DEMO-0001`
remains unchanged. Web phone screenshots before and after approval are in
`.local/demo-tracking-lifecycle-191/`. Expo preview subsequently showed the
Driver's exact-ID Demo shipment, events and proof labels; the owner approved
the changed Tracking layout. This proves one manual local synthetic lifecycle,
**not** a recurring
automated simulator or hosted deployment. Hosted activation requires its own
exact review and release gates.

### Separate active GPS Tracking demonstration

The completed shipment intentionally stops publishing its current location.
The distinct fixed synthetic shipment `ab8e45be-d878-4aad-a9d9-32e0e64c991a`
(`LGX-AB8E45BE`) uses the same fixture-marked Truck 02 and Driver 02 only
after the prior shipment is complete. It stays active to demonstrate a
post-creation GPS signal. Migration 194 installs a **disarmed** exact-ID
reservation and pre-dispatch interception for its synthetic owner and one
synthetic status-only viewer. It leaves the completed shipment and imported
`LGX-DEMO-0001` untouched. A generic customer shipment, guessed ID, changed
actor/vehicle, arbitrary recipient, external queue, or unreviewed third viewer
must fail closed. The location signal may only come from the captured GPS
assignment and a valid post-creation GT06 fix; historical Capacity points or
Driver status text are not relabelled as live GPS. The exact ID receives a
visible Demo label on web and Expo.

Given the exact active shipment is created through the normal validated
provider command and its GPS assignment matches Truck 02\
When two post-creation fixes arrive through the local GT06 gateway\
Then the primary owner sees the updated approximate truck circle and source,
while the owner-shared secondary viewer sees only the saved route and status.

Migration 194 and rollback-only
`tests/sql/demo-world-tracking-live-reservation.sql` pass on disposable
fixture-loaded clones. The regression covers disarmed creation, exact normal
creation, owner and viewer access/OTP interception, foreign recipient and
push denial, and the secondary viewer's `can_view_location=false` projection.
After a fresh protected backup and clean disposable restore, migration 194
was installed on the **local preview only**, initially disarmed. The exact
second shipment was then created through the validated provider RPC with the
captured synthetic GPS assignment; global simulation was turned off again.
Six initial valid post-creation GT06 fixes reached that assignment and changed
its raw coordinates without crossing the selected 10 km privacy cell. Two
later route-aligned GT06 fixes crossed its cell boundary; the saved approximate
center moved from `[9.03305,38.81522]` to `[9.03305,38.85983]` while the
10 km radius remained unchanged. The normal owner OTP/session and sharing endpoints
accepted the synthetic owner and one viewer; both could open their web
Tracking page. The owner projection returned the approximate GPS source and
updated timestamp; the viewer projection returned `can_view_location=false`
and no point. Access and OTP intents entered only the recipient-free local
sink; target outbound email and push queues stayed empty. Chrome phone web
showed the owner's truck marker before and after the cell crossing; the
status-only viewer saw the route and status without its marker or approximate
point. Expo preview repeated the owner/viewer distinction. Where the truck
overlaps the pickup city stop, Expo now renders the truck above that stop;
`apps/mobile/tests/tracking-camera.test.mjs` checks the paint order. These
pages currently require a refresh or reopening to show a later saved fix;
continuous on-screen movement has not been implemented or claimed. The
exact local sink remains armed so later demo OTP requests cannot become
outbound messages; the global scheduler is off. Migration 194 and this
shipment have **not** been deployed to hosted Loadgistic.

### Inert atomic driver handover slice

The exact synthetic fleet-01 vehicles 1 and 4 may exchange their assigned
drivers only through a separate service-role worker claim and execution. The
database selects the two fixture-marked drivers and owner itself; a caller
cannot provide a target or date. The handover lane proposes one job starting
October 26 and every 14 UTC days thereafter at 11:00 UTC, then leases and
receipts it independently of the five daily Capacity targets. The scheduler
does not invoke it until the same worker is explicitly wired and the control
is enabled after separate review. Direct execution of the atomic handover has
no API grant. Hosted deployment remains absent.

Both vehicles currently have published Empty signals. The command saves their
signal shape, takes both Off Duty, uses the existing validated driver-access
command twice, selects fresh manual points from their public area/route places,
and republishes both signals with their original audience and load preference.
All commands and an immutable receipt run in one PostgreSQL transaction. A
failure at any step rolls back the entire change, so there is no committed
partly swapped fleet or extended visible Off Duty gap. It never copies an old
driver's private point to the new pair. Historical Capacity rows and saved
Featured days remain unchanged; future saved Featured selections referencing
either pair block the handover. This slice does not simulate a real phone/GPS
device or start a Tracking agreement.

Given either account loses its exact synthetic fixture identity, either driver
or vehicle changes fleet, an active shipment exists, a future Featured slot is
saved, a GPS/phone/demo-motion binding exists, or sharing/source state drifts\
When the handover command is considered\
Then it refuses before a committed assignment, Capacity or location change.

Given the two exact fixture pairs pass all guards and the feature is enabled\
When the handover command completes\
Then both current assignments are swapped, each new pair has a fresh manual
source and its vehicle's prior Empty signal shape, and a one-day immutable
receipt is saved\
And replay that day performs no additional write.

The managed demo import keeps both handover vehicles public-only and chooses
replacement vehicles for the private-sharing cohort. A fresh import must not
make a scheduled handover fail its audience guard or shrink that cohort.
Any local shared-capacity verification that grants temporary access to a demo
vehicle restores its original audience before later simulator checks run.

Given the handover control is disabled, the current time is outside the fixed
fortnightly slot, or a lease is stale or held by another worker\
When the background worker requests or executes a handover job\
Then no new pairing is saved, and daily Capacity jobs remain independent.

Given the final republish fails after the earlier steps ran\
When the database transaction aborts\
Then both original assignments, signals, source selections and receipt count
remain unchanged. The rollback-only isolated regressions are
`tests/sql/demo-world-atomic-handover.sql` and
`tests/sql/demo-world-handover-worker.sql` after migrations 187–188. No local
preview or production account was reassigned during this rehearsal.

### Full simulator acceptance

Given an explicitly allowlisted demo scenario changes a driver/vehicle pairing\
When its transition is due and neither the old nor new pair has an incompatible
active shipment or real-device takeover\
Then the normal assignment command validates both demo identities and eligibility\
And the old assignment epoch is closed and historical capacity/location remains
  attributed only to its original pair\
And the new pair receives no inherited manual point or stale device fix\
And eligible future Featured candidates update without rewriting saved days\
And public/private search, filters and both map projections read the same current
  pair and source.

Given a real provider, driver, business, vehicle or shipment exists beside demo
records\
When any scheduled or retried demo operation is forged, duplicated, stale,
  partially failed or aimed at that real record\
Then authorization rejects it transactionally and the real record remains
  unchanged\
And the scheduler records a bounded sanitized denial without retrying outside
  the exact demo manifest.

Given a synthetic shipment advances through its lifecycle\
When proof, status, route or moving-location projections are requested\
Then each viewer receives only the same projection their real role permits\
And synthetic proofs and any simulated review state remain explicitly marked
  demo and cannot create trust claims about a real provider\
And notifications go only to the isolated demo sink and no outbound
  communication reaches a real destination.

Given a scenario worker retries after a crash or runs concurrently with another
worker\
When it claims the same due transition\
Then a bounded lease and stable idempotency key apply that transition at most
once, with no skipped lower-order event, duplicate approval or stale movement.

### Ordered implementation and evidence

1. Inventory every user-editable state transition and its existing command,
   permission, event, projection and rollback contract. Exclude unsupported or
   high-stakes actions (real document verification, engine control, billing and
   external communication) from simulated side effects.
2. Define the versioned demo manifest and transition catalog; add pure scenario
   tests and negative exact-target tests before persistence changes.
3. Rehearse additive scheduler/manifest persistence and transaction/lease tests
   on an isolated local restore. Prove real-record before/after equality,
   assignment handover, Featured saved-day integrity, filter coverage and
   Tracking audience projection.
4. Run existing local simulation and actual web/Expo workflows against local
   synthetic actors, including failure, restart, retry, pause and takeover.
   Verify desktop Chrome, phone web and Expo use the same local source revision,
   API origin and database; separately validate the native app's reachable API
   address when using a device or emulator.
5. Keep production deployment, production data changes, outbound notifications,
   and live hardware operations outside this specification's authorization;
   prepare their exact separate review only after local evidence passes. The
   scheduled dispatcher/background worker must support protected secret
   injection, health/lag metrics, idempotent retry, kill/stop, bounded batches
   and documented rollback without deleting persistent GPS history.
