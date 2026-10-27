# Local demo-world supervisor

This is a finite operator tool for the exact synthetic Capacity, driver
handover, broker sharing, profile, team and duty scenarios in FEAT-SIM-001
and FEAT-SIM-002. It is not the hosted
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

## Restart after a long pause

Inspect the current worker, controls, installed claim functions and pending jobs
before enabling a stopped run. Pin each table's actual owner and the existing
operator's SELECT/UPDATE privileges; data updates do not require changing table
ownership. Keep the existing isolation trigger and cohort/schedule checks active.

The claim functions stop after a dispatcher gap exceeding two days. A new
activation must not silently skip unfinished work. After a protected backup,
review every affected job lane and preserve its completed history. Only when
there is no pending or leased work may an exact, separately reviewed local
operation clear the **previous activation's** `last_dispatch_at` checkpoint to
NULL, keeping the new activation, schedule and all jobs/receipts intact. Rehearse
that operation in ROLLBACK and verify full rows/history before applying it.
Do not backdate the clock, forge a successful dispatch, delete jobs or clear a
guard merely to make a worker start. A later normal claim records the real
successful dispatch time. Retain the original pause and actual database error;
a generic storage error alone does not establish the cause.

October26 local evidence is protected under
`.local/demo-world-startup-20261026/`: both five-control activation and the
reviewed checkpoint passed rehearsal/application readback, with the22 jobs in the five reviewed queues
DONE and unchanged. The normal supervisor then reached RUNNING with three ticks
and no failure. No Capacity or sharing step was due during that sample; the next
natural Capacity slot was October27 08:00UTC. This finite one-hour run cannot
prove that later execution. Hosted recurring dispatch remains a separate rollout.

The separate ten-target GPS/phone runner reports every60 seconds on one-hour
leases, without automatic renewal. Its local app endpoint deliberately requires
the development runtime. This machine's scoped motion key is kept in the
protected `.local/telematics/application-demo-motion.key`, loaded only into the
normal local helper and CLI environment; it is not in `.env.local` or the mobile
build. Do not substitute an application/database credential. Current local
launch/status receipts are under `.local/provider-home-entry-20261026/`.

Focused check:

```bash
node --test tests/demo-world-local-supervisor.test.mjs
```
