# Isolated GPS gateway (FEAT-GPS-001, ADR-080)

This deployment uses official Traccar 6.16.0 decoders. It is separate from the
application database and never receives the application's Supabase service key.
The bridge has its own restricted PostgreSQL role and scoped HMAC credential.
Only new fictional, allowlisted devices are used in local simulation.

## Local rehearsal

Run from the Loadgistic root. Generated credentials remain in ignored
`.local/telematics/` files with mode 0600. Never print or commit those files.
The first command refuses to overwrite an existing setup.

```sh
node scripts/telematics/prepare-local.mjs
docker compose --env-file .local/telematics/compose.env -f infra/telematics/compose.yml up -d database traccar
node scripts/telematics/bootstrap-gateway.mjs
node scripts/telematics/protocol-roundtrip.mjs
```

Bootstrap creates and reads back exact device IDs through the documented Traccar
API. The local administrator's API credential stays server-side; it is unrelated
to application identities. The initial two device IMEIs are fictional
990000000000001 and 990000000000002. The simulator refuses all other IDs and
non-loopback hosts. It sends actual GT06 packets with CRC16/X25; Traccar performs
the decoding. The synthetic command payload starts with`LOADGISTIC:` and has no
physical relay, restart or firmware configuration instruction. Its ACK contains
the exact command UUID. The rehearsal verifies a decoded fix, actual TCP command
delivery, correlated result and transactional outbox row. It does not certify a
physical tracker, firmware, installation or engine safety interlock.

After owner-controlled application migration rehearsal and local installation,
provide the protected application-env.json array as the server-only
`TELEMATICS_GATEWAYS_JSON` environment value and restart the application. Register
the gateway token's SHA256 digest with register_telematics_gateway as an active
administrator. The separate local provisioning script performs that registration
and verifies named managed fictional owners; normal HTTP provisioning refuses
synthetic profiles. Both source and exact fixture key plus an owner-approved email
must match. Migration153 preserves those checks for the owner's approved demo
email aliases without rewriting151. Start the
bridge only after those exact bindings exist:

```sh
docker compose --env-file .local/telematics/compose.env -f infra/telematics/compose.yml --profile bridge up -d --build bridge
```

The root/operator supplies the existing approved loopback application environment
to these commands; the scripts never discover application credentials from files:

```sh
node scripts/telematics/provision-local.mjs
node scripts/telematics/verify-bridge-local.mjs
node scripts/telematics/verify-restart-local.mjs
node scripts/telematics/motion-demo-local.mjs 60
```

Run provisioning before starting the bridge. The integrated verification proves
signed ingestion, actual published GPS, locate and both fictional relay actions,
event idempotency, nonce replay and tamper rejection. For engine evidence it uses
the allowlisted local fixture's normal Auth OTP verification and signs out only
that temporary session; it never resets or stores a password. The restart check
briefly stops only the isolated bridge, queues actual protocol updates, restarts
it and checks those exact upstream events reached the app. The motion demo then
leaves three explicit sources visible: company truck GPS, personal truck phone,
and second company truck owner-entered location. GPS motion reports nonzero speed
and ignition on, so engine interlocks must reject engine commands during motion.
Verification scripts retain sanitized source-hash receipts in ignored .local/telematics.

The default application ingest target is the host's loopback app on 3100 through
Docker's host.docker.internal gateway. A hosted deployment must use HTTPS,
explicit secret rotation, resource/storage quotas, monitored retention and an
owner-approved network/backup/rollback plan before exposing listeners.

## Isolation, ingestion and storage

All published ports bind 127.0.0.1: API 18082, GT06 15023, Teltonika 15027, H02 15013,
JT808 15015. The dedicated database has no host port. Unknown device registration,
raw packet storage, geocoding and coordinate-bearing gateway logging are disabled.
Only enabled protocol listeners start. Do not publish the admin API or database
alongside tracker TCP. Production device traffic needs an independently reviewed
private APN/VPN or equivalent ingress allowlist: an IMEI identifies a tracker but
does not cryptographically authenticate it.

The bridge API identity is a separate non-administrator with no user-management
or device-registration privilege, read-only device configuration, and permission
only for the two linked fictional devices. Its token is separate from the
server-side administrator token used for exact provisioning readback.

The dedicated gateway database uses a small AFTER INSERT trigger to append a
normalized outbox entry atomically with each Traccar position, including decoded
command-result positions. This is an explicitly accepted adapter: it adds only
the isolated loadgistic_bridge schema and trigger. Device provisioning and
dispatch use documented REST APIs. The separate privacy adapter has the narrow
raw-history erasure exception described below; ordinary ingestion cannot use it.
The worker role can read/update/delete its outbox and maintain its own dispatch
receipts. It cannot read or mutate Traccar tables. Treat Traccar upgrades as schema
changes: rehearse trigger column compatibility before changing the pinned image.

Leased rows use SKIP LOCKED, bounded batches and exponential retries. There is no
global max-ID cursor, so concurrent commits cannot skip a lower ID. The worker
uses separate result leases and an independent command/ACK loop; a slow telemetry
request cannot consume a safety command's lifetime. Up to 20 valid position rows
share one signed HTTP batch, with permanent denials and transient retries settled
per event. Malformed events cannot poison another device's batch. The worker
reuses immutable upstream keys; the application rejects a changed payload under
the same key. Unknown/inactive/cross-owner bindings never create app devices.
Out-of-order and pre-assignment fixes remain private history. Only a valid latest
fix after selection, device assignment and driver assignment epochs may update a
capacity, using the existing many-to-one privacy projection. No source can change
capacity status, availability geometry, sharing or driver identity. Phone history
remains available, but unselected phone positions cannot overwrite GPS/manual.
Selecting GPS with no subsequent fix leaves the actual published source unchanged.

The application deletes private raw positions older than 30 days and request
nonces/step-ups older than 1 day in bounded gateway-scoped batches. Delivered bridge
rows expire after 7 days; permanent denials are retained there for inspection without
printing payloads. Command/audit and ownership history remain private. Provision
explicit storage quotas and alerts for pending count/oldest lag; stop listener
ingress before disk exhaustion. Do not claim unbounded outage recovery. Dedicated
Traccar raw history also requires an owner-approved per-device API retention job
before production. No production retention installation is claimed here.

Only sanitized counts and ingest lag are logged. Inspect secrets/raw coordinates
through authorized private tools only; never paste gateway/database logs into
shared reports. Back up the isolated volume and protected configuration before
an upgrade. Roll back consumers first, retain application ownership/telemetry
history, and remove the bridge trigger only after stopping ingest. Never remove
the persistent volume as an application rollback step.

## Account closure and erasure

Migration154 queues a separate private job for each exact owned device. Normal
account closure requests DISABLE: the tracker is disabled and history retained.
Reopening an account never re-enables it automatically. Actual erasure requests
ERASE, and cannot finish until the upstream job has a verified receipt. Neither
operation sends an engine command.

The one-job janitor has a separate HMAC secret, API token and PostgreSQL role.
The ingest secret cannot claim or acknowledge privacy jobs. An administrator must
register the privacy secret's SHA256 digest using
register_telematics_privacy_agent after reviewing the exact gateway. The app's
server-only TELEMATICS_PRIVACY_GATEWAYS_JSON contains only its ID and privacy
secret. It is distinct from TELEMATICS_GATEWAYS_JSON.

The janitor API user is not an administrator, has no device-registration or
user-management privilege, and has limitCommands=true with no saved command
permissions. It can edit/delete only directly linked devices. Its database role
can execute only two scope-checking functions, not directly read or mutate raw
tables. An administrator separately installs exact hardware hashes in
privacy_scope after API readback; a claimed app job cannot add its own scope.
Before activating any production tracker, the operator must register its
separate privacy HMAC authority, provision the restricted privacy API identity,
and install that device's independently verified exact database scope. Exercise
the complete disable/erasure path on a disposable binding in the same deployment
first. Normal ingest credentials, application provisioning and an API DELETE204
do not establish privacy cleanup readiness. No automatic bulk allowlist or
production customer backfill is provided by the local bootstrap.
Traccar's users collection lists managed users, so the janitor expects an empty
collection and separately reads users/<configured numeric ID> to check its exact
identity flags. Both checks are required: an administrator token can read that
same user but has a nonempty collection. Bootstrap records this exact numeric ID
as TRACCAR_PRIVACY_USER_ID. For an existing setup, --identity-only updates only
that protected local configuration after read-only identity verification; it
cannot create an API user, change device scope or rotate a token.

For the local rehearsal only, the following bootstrap creates one disposable
fictional GT06 device990000000000003 and links only that device. It never changes
the two primary demo trackers or application/Auth data. Its protected manifest
refuses to recreate a device after successful erasure, and never re-enables one.

```sh
node scripts/telematics/bootstrap-privacy-local.mjs
docker compose --env-file .local/telematics/compose.env -f infra/telematics/compose.yml --profile privacy build janitor
docker compose --env-file .local/telematics/compose.env -f infra/telematics/compose.yml --profile privacy run --rm --no-deps janitor
```

Before running the janitor, the root/operator loads the protected
application-privacy-env.json into the app server and registers the digest, then
creates the explicitly owned synthetic app device and privacy request using the
approved local application adapter. The janitor processes one leased job and
exits. Schedule bounded repeated runs only after reviewing a hosted deployment.

The root-run integrated verifier owns that local application setup and drives
both privacy jobs serially. Supply only the already approved loopback
SUPABASE_SEED_URL/SERVICE_ROLE_KEY/ANON_KEY environment; it never discovers app
credentials from files. It creates a new explicitly marked synthetic owner and
company, not an existing demo account. Run after migrations154/155 rehearsal,
installation, app privacy configuration and janitor image build:

```sh
node scripts/telematics/verify-privacy-local.mjs
```

It sends an actual003-only GT06 fix, retains app/upstream/manual history through
closure, verifies that erasure remains pending before upstream attestation,
exercises binding/ingest-key/replay denials, and checks exact upstream and app
absence after erasure. The two primary device bindings/lifecycle snapshots must
remain unchanged. Protected fixture IDs are journaled for diagnosis; after an
interrupted run, --resume accepts only that same exact owned fixture. Failures do
not bypass cleanup or erase unrelated data. Sanitized evidence/source hashes are
written to .local/telematics/privacy-verification-evidence.json.

Each job verifies gateway ID, numeric device ID, unique ID, IMEI and protocol
against both upstream API data and the independent administrator-owned database
scope. It persists a hash-only pre-delete receipt before changing the device.
DISABLE reads back disabled=true. ERASE disables and reads back the exact binding,
then deletes through the pinned API. Traccar's6.3 schema migration removes the
position/event foreign keys, and device DELETE retains raw history. The approved
privacy-only exception therefore permits the verifier to delete at most500 raw
position/event rows total per call, only after its independent exact scope and
durable pre-delete receipt match and both device ID and unique ID are absent.
A SHARE lock on the device table protects that absence check against ID reuse.
All remaining raw rows keep the job pending; absence is never inferred from204.
The verifier also removes bounded batches of only that device's bridge
outbox/dispatch payloads and clears hardware linkage
from local adapter receipts/scope. Only then does it acknowledge the exact app
job/lease/binding digest. A missing API device or HTTP204 alone is insufficient.
An ambiguous delete can retry from its durable exact receipt; scope drift,
timeouts, residual rows or expired leases leave cleanup pending.
Verified receipts retain only UUIDs/digests and completion timestamps for audit.

Preparing a valid privacy job also stops further collection. Private tombstones
contain only the retired numeric gateway device ID, without an IMEI, unique ID,
owner, job or receipt link. BEFORE INSERT guards on both Traccar history tables
use the same per-device transaction lock as retirement, preventing cached TCP
sessions or late event handlers from recreating raw rows. The bridge and janitor
have no direct write access to tombstones. Closure retains existing history;
erasure removes it in bounded batches. Explicit administrator re-enablement
requires a separately reviewed future procedure; reopening an app account cannot
silently resume collection. The root-run verifier attempts real rejected inserts
for both tables after erasure and rechecks absence and the two primary trackers.

Routine Traccar raw-history retention remains a separate production gate even
when account erasure works: review, install and monitor the per-device retention
operation, storage quotas and backup expiry before production activation. The
privacy job is tied to a closure/deletion request and is not a general retention
scheduler. Hosted privacy network/identity configuration, backup retention and
physical hardware certification are separate evidence. Never claim they passed
from pure tests, clone rehearsal or local protocol simulation alone.

## Commands and model caveats

No real model/firmware/hardware profile has been tested or certified. Real devices
are provisioned as UNVERIFIED and advertise zero command capabilities. GT06 clone
names do not establish support for WHERE#, RESET#, relay polarity or wiring.
H02, Teltonika and JT808 protocol support likewise does not certify commands.
GT06E WHERE#/RESET# variants need an exact manufacturer model/firmware document,
bench evidence and reviewed fixed templates before a new profile may be enabled.
Do not enable arbitrary custom command input or infer a capability from family.

Synthetic demo profiles alone expose LOCATE, REBOOT, REPORT_INTERVAL (30–3600s),
ENGINE_CUT and ENGINE_RESTORE; these change only the simulator's fictional state.
Real engine control is fail closed. It requires an independently vetted exact
model, firmware and wiring with a device-side stationary interlock before any
future implementation. Both demo engine actions require recent Auth sign-in,
exact owner/truck/device/assignment/command step-up, single-use 30s proof,
15s command TTL, valid fix with zero speed, ignition off and a fresh connection.
The helper is internal and has no public HTTP route. Dispatch rechecks authority,
epoch, TTL and interlock, and sets noQueue=true. A server HTTP200 means DISPATCHED;
HTTP202, ambiguous network failures, expired leases and uncorrelated responses
remain UNKNOWN. ACKNOWLEDGED requires an actual correlated synthetic result.
There is no blind command retry after an ambiguous dispatch or offline engine queue. Command-result positions are never ingested as fresh telemetry; Traccar may attach a saved location to an ACK, which does not establish a new fix.

## Primary sources

- [Official Docker deployment](https://www.traccar.org/docker/)
- [Configuration keys](https://www.traccar.org/configuration-file/)
- [Traccar 6.16.0 REST contract](https://www.traccar.org/api-reference/openapi.yaml)
- [Protocol documentation](https://www.traccar.org/protocols/)
- [GT06 encoder6.16.0](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/protocol/Gt06ProtocolEncoder.java)
- [GT06 decoder6.16.0](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/protocol/Gt06ProtocolDecoder.java)
- [JT808 protocol6.16.0](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/protocol/Jt808Protocol.java)
- [No-queue handling6.16.0](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/database/CommandsManager.java)
- [Device API deletion6.16.0](https://github.com/traccar/traccar/blob/v6.16.0/src/main/java/org/traccar/api/BaseObjectResource.java)
- [History foreign-key removal6.3, shipped in6.16.0](https://github.com/traccar/traccar/blob/v6.16.0/schema/changelog-6.3.xml)

Image/digest vulnerability review, physical hardware certification, production
backup/restore and hosted rollout remain separate release evidence. Local passing
simulation must never be described as those checks.
