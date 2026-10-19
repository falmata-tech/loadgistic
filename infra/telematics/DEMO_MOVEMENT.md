# Controlled local demo movement

FEAT-SIM-001 extends the existing Traccar/GT06 bridge. Migration156 creates no
target or running simulation. The retired `motion-demo-local.mjs` is inert because
it changed source/radius and moved manual locations. Do not use it as a fallback.

Only the exact company Truck1 and personal fixture truck may be configured. Their
current Auth fixture metadata, owner, driver assignment, synthetic001/002 device,
device assignment and saved source/radius are checked on every tick. Erased003
and all user-created accounts are excluded. Manual is static and cannot run.

## Operator setup

First rehearse156 and157 against an isolated restored database. The root operator
then loads a new protected64hex `LOADGISTIC_DEMO_MOTION_SECRET` into the local
application and this operator tool, with `LOADGISTIC_DEMO_MOTION_ENABLED=true`
only in the application. It must differ from gateway/privacy credentials. Restart
only the exact Loadgistic local application. The adapter refuses production,
remote databases and every database port except local55321.

The runner receives only the dedicated HMAC capability, never application,
Supabase, gateway or database credentials. It has no customer-write endpoint.
No credential belongs in command arguments, output, Git or this document.

```sh
node scripts/telematics/demo-motion-local.mjs start 180
node scripts/telematics/demo-motion-local.mjs status
node scripts/telematics/demo-motion-local.mjs stop
```

Start launches one detached bounded local runner. Duration is10–3600seconds. A
protected lock prevents duplicates; status shows counters, not coordinates/keys.
Stop closes timers/sockets and revokes only its own generation. It does not reset
records or change sources. Inspect a stale lock after an OS crash; the tool refuses
to steal it or kill an unrelated process.

## Real-device priority

Authenticated native enrollment pauses its exact demo truck before capture,
including emulators. A real phone report independently pauses it. Source and
assignment changes invalidate its generation. Silence, denied location, network
failure and application restart do not resume synthetic movement.

After real reporting authority has been explicitly released or expired, an
operator may deliberately run:

```sh
node scripts/telematics/demo-motion-local.mjs resume 180
```

Resume checks157's authoritative installation-use helper under the same truck
lock. It fails closed for a REAL takeover if that dependency is absent. It never
sets a source or radius. If Manual is selected, it remains static.

GPS reserves a sample before emitting its actual GT06 packet. The application
matches decoded capture time and quantized point to the current lease/epoch.
Packets queued before takeover or emitted by a superseded runner cannot overwrite
the real fix. Phone simulation uses the same obscured projection, current driver/
publication checks and saved radius through a narrow server-only command.
Private per-fix demo epochs may become a public boolean only; they are not IDs
or control modes in map payloads.

## Verification and rollback

`tests/demo-motion.test.mjs` covers local/HMAC/target scope, bounded movement and
runner cleanup. `tests/sql/demo-location-arbitration.sql` covers exact fixture
scope, takeover, stale epochs, queued GPS, source changes and RPC ACLs in a
rolled-back transaction. Root owns isolated SQL rehearsal/installation and actual
Chrome/Expo movement plus real-installation takeover evidence.

Rollback starts by stopping the demo runner and retaining disabled arbitration.
Do not automatically restore pre-arbitration RPCs or resume movement. Owner-only
pre-demo copies retain source fingerprints for separately reviewed recovery.
Production and physical hardware are outside this local setup.
