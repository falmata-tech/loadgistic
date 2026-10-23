# Local demo-world supervisor

This is a finite operator tool for the exact synthetic Capacity and broker
sharing scenarios in FEAT-SIM-001 and FEAT-SIM-002. It is not the hosted
simulator. It accepts only the fixed local Supabase API at
`http://127.0.0.1:55321`, validates the checked-in synthetic manifest, and
calls the existing durable database worker. Database leases, receipts and
target checks remain authoritative; the process never accepts an actor,
vehicle, recipient or customer selector.

After separately reviewing and enabling an exact local control, run:

```bash
node --env-file=.env.local scripts/demo-world-local-supervisor.mjs start 120 30
node scripts/demo-world-local-supervisor.mjs status
node scripts/demo-world-local-supervisor.mjs stop
node scripts/demo-world-local-supervisor.mjs status
```

The first number is duration in seconds (5–3600), the second is the interval
between ticks (2–300). The run is limited to 120 ticks and stops at its
deadline. `start` refuses if no scenario is enabled, the broker target is
unbound, the manifest is invalid, the URL is not the local port, or a run lock
already exists. `status` reports aggregate counts and a failure code, never
contacts or credentials. `stop` requests a safe halt after any in-flight
database step; inspect `status` until it reads `STOPPED`. A failed step pauses
the process. A stale lock fails closed and needs an operator to inspect the
saved state and database receipts before clearing it.

**Stopping the process does not disable database controls.** After the final
receipt/readback check, disable each control through its separately reviewed,
local-only SQL operation. Leaving a control enabled allows a future authorized
worker to claim its due jobs. The local proof on October 22 used a protected
backup, exact five-target and 14-slot preflight, then four timed ticks. All 14
jobs and receipts completed, the five latest statuses returned to their
baselines, and the manual Stop path halted a later read-only run. Both local
controls were then disabled. The rotating broker grant remained revoked. Six
separate, fixture-marked private vehicles and two EMPTY vehicles were later
shared with the synthetic broker through normal provider commands; they are
standing demo connections, not an active simulator grant. The private feed has
eight examples: PARTIAL pickup/van choices and EMPTY van/box choices, while the
EMPTY box remains visible in the public map. This proof does not establish a
hosted schedule, a complete marketplace simulator, or native phone parity.

Focused check:

```bash
node --test tests/demo-world-local-supervisor.test.mjs
```
