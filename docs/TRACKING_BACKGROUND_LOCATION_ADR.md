# Decision: shipment-scoped device authority for background location

Status: implementation in progress; native OS acceptance and release review outstanding.
Contracts: FEAT-TRK-001, FEAT-MOB-001, BASE-BE-001.

An agreed LOCATION_AND_STATUS shipment reports approximate location until owner
handover approval or audited staff release. OS permission remains mandatory.
Web pages can report only while open. Expo uses a top-level TaskManager location
task, an Android visible foreground service and iOS background-location permission.
No claim of reporting through force-stop, denied permission, unavailable GPS or network.

Keep normal account refresh tokens WHEN_UNLOCKED_THIS_DEVICE_ONLY. A separate
random 256-bit device capability, stored AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
authorizes only approximate-location writes for one assigned shipment and its own
revocation. It cannot read shipment/customer/proof data, alter status, approve,
manage fleet, publish capacity or change any setting. Only the digest is persisted.

Issue/renew from an authenticated assigned driver while foregrounded. One active
lease per shipment/device; rotation invalidates the prior token. Each report checks
current assignment, active account, tracking permission, immutable mode and active
shipment state. A report renews a 24-hour idle lease within a fixed 30-day absolute
window. After that window, foreground authentication must issue a fresh lease.
Reassignment, completion, release and explicit logout revoke leases; missing or
expired authority stops reporting and never falls back to a saved account token.

Raw GPS is offset on the device before any request; payload contains only world-
valid approximate coordinates and one of 1/3/5/10/20 km. Ignore stale GPS callbacks,
apply the existing ten-minute server cadence, preserve uncertainty after timeout,
and never log token/location payloads. Show last received update to all authorized
viewers so gaps are apparent. Native permission/service failures are visible.

Rollout: local capability isolation/revocation/proof tests, browser regression,
then explicit visual approval, new signed native binary and native OS checks.
Do not ship just the JavaScript to an old binary lacking TaskManager/background
permissions. Apply hosted migrations only with reviewed exact target, backup,
rollback and owner authority. Rollback disables new issuance without deleting
shipment, proof or appeal history; revoke capabilities before removing the worker.

References: [Expo SDK 57 location](https://docs.expo.dev/versions/v57.0.0/sdk/location/),
[TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/).
