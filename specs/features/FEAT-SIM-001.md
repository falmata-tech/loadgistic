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
