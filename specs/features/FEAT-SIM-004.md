---
id: FEAT-SIM-004
title: Exact synthetic vehicle duty cycle
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-SIM-001, FEAT-CAP-001, FEAT-FTR-001, FEAT-GEO-001, FEAT-TRK-001, FEAT-SEC-001]
problem: The marketplace demo needs to show a provider taking a vehicle off duty and returning it to work without inventing a location, disturbing a saved Featured day, or hiding the last useful vehicle in a filter.
behavior: A disabled-by-default, exact-fixture scenario briefly takes one synthetic vehicle Off Duty and restores its prior Empty route through the normal provider Capacity command. Each phase has a durable lease and immutable receipt. Any actor, vehicle, assignment, source, sharing, Featured, Tracking, or baseline-coverage drift refuses the transition.
contracts: [DemoDutyTarget, DemoDutyJob, DemoDutyReceipt, ProviderCapacityCommand]
observability: [demo_duty_step_applied, demo_duty_step_replayed, demo_duty_step_denied, demo_duty_pending_count]
rollout: Install the inert schema only after a disposable fixture-clone rehearsal and rollback-only regressions. Bind/enable only after a separate exact local review; no hosted activation, customer mutation, or external notification is authorized. Disable the duty control to stop new claims; retain immutable receipts and reconcile a vehicle left Off Duty through the ordinary provider command before any future enablement.
---

# Provider duty example

Status: source, disposable-clone regression, local installation and one bounded
catch-up Off Duty/Restore demonstration verified. Both local controls are off
again. Natural scheduled dispatch and hosted installation remain pending.
This is one narrow lifecycle scenario under FEAT-SIM-001, not a complete
marketplace simulator. It uses the checked-in synthetic fleet-01 vehicle 5,
`LG-TRK-F0105`, owned by fixture `user-public-fleet-01` and assigned to fixture
`user-public-fleet-driver-005`. A read-only local audit on October 22 found it
Live, Empty, public-only and unshared, with no saved future Featured slot, active
shipment, GPS or phone binding, demo-motion target, or existing Capacity cycle.
Nine other public Empty Cargo vans provide baseline filter coverage. Its former
mobile source had no saved location; an October 22 protected local-only
preparation selected a manual point at its existing route start and republished
the Empty route through normal commands. A second run replayed without another
save. No GPS or phone motion is fabricated. The duty control remains off;
the preparation is not permission to activate the scenario, and
the worker repeats the guards at every transition. An earlier Partial candidate
was rejected because it was the broker's sole private result for one filter.

## Acceptance

Given the exact synthetic owner, driver, vehicle and currently selected manual
source match the manifest, the signal is a Public Empty route with no private
grant, and at least two other eligible public Empty vehicles of the same configuration remain\
When the due OFF_DUTY phase executes under an enabled local control\
Then it calls the ordinary provider Capacity command, saves an Off Duty signal,
and public discovery omits only this vehicle\
And the assignment, source selection, sharing rule, absence of private grants,
route history and other vehicles remain unchanged.

Given that phase's immutable receipt and its Off Duty signal are still current\
When the due RESTORE phase executes\
Then it republishes the same Empty route and Public audience through the
ordinary provider command using the selected manual source\
And the readback records the actual saved Capacity ID and Demo actor, without
presenting a stale phone or GPS point as fresh movement.

Given an unmarked or foreign actor, changed driver/vehicle, real-device or
demo-motion binding, changed source or sharing, new private grant, active shipment, saved current
or future Featured slot, another Capacity scenario target, or loss of public
filter alternatives\
When either phase is considered\
Then the phase refuses before a committed Capacity, receipt or notification
write. The restore phase also refuses if another actor changed the Off Duty
signal after this scenario's own OFF_DUTY receipt.

Given a disabled control, stale/wrong lease, overlapping worker, missed earlier
phase, or a replayed completed phase\
When the worker claims or executes a job\
Then it makes no duplicate publication; committed work and its receipt are
atomic, and a later phase cannot pass an unfinished earlier phase. The worker
does not accept a caller-selected actor, vehicle, command, contact or date.

No email, SMS, push, tracker command, document review, or simulated approval
is produced by this scenario. The present synthetic baseline stays available
through the other eligible vehicles; the intended Off Duty window is short and
must not be enabled until the actual local broker/public filter checks pass.

Given F0105's exact original Empty/Public route, current synthetic owner and
driver, no saved source, grant, active shipment or future Featured slot, and
other mappable Empty Cargo vans still available\
When a separately reviewed local-only preparation selects Manual location at
the first existing route place and republishes the Empty route\
Then the normal source and Capacity commands save one current Manual signal,
with no changed assignment, route, sharing, Featured slot or other vehicle\
And an exact receipt makes a retry a read-only replay. An unexpected command
failure rolls the source, Capacity and receipt back together. The duty control
remains off until its own separate activation review.

## Ordered implementation checklist

- [x] Inspect the existing durable worker, normal provider command, exact
  fixture and local eligibility without changing preview data.
- [x] Add an inert exact-target database lane with lease, order, receipt,
  permission, and current-state guards; call only the normal Capacity command.
- [x] Add a bounded worker adapter and focused negative/result-shape tests.
- [x] Run a rollback-only SQL regression on a disposable fixture clone: Off Duty,
  restore, replay, wrong actor, binding/Featured/Tracking/filter denial, and
  unchanged state after a forced failure.
- [x] Rehearse the finite F0105 Manual/Empty preparation and idempotent replay
  with matched normal-command definitions on the disposable clone.
- [x] Capture a fresh protected local preview backup and apply/read back only
  the exact synthetic preparation during a coordinated write window.
- [x] Compare migration 198 dependencies and prepared F0105 state with a
  disposable clone; rehearse exact198 rollback-only, then install/read back
  default-off objects on the local preview after a fresh protected backup.
- [x] Demonstrate one guarded local catch-up Off Duty/Restore cycle after a
  protected backup and rollback-only rehearsal. Confirm real public Capacity
  changes, unchanged Featured count, restored map/detail in desktop and phone
  Chrome, unchanged source/route/assignment/grants, two receipts and controls
  OFF. The catch-up uses yesterday's due phases and is not proof of future
  wall-clock dispatch.
- [ ] Observe a natural 10:30/10:50 UTC dispatch and a signed-in private
  broker browser isolation check before treating the recurring local duty lane
  as fully qualified. Hosted activation remains separately gated.

Tests: `tests/sql/demo-world-duty-cycle.sql` (disposable
`loadgistic_demo_duty_198_ci`, `BEGIN`/`ROLLBACK`),
`tests/demo-world-duty-advance.test.mjs`,
`tests/demo-world-advance.test.mjs`, and `tests/demo-world-worker.test.mjs`.
A full quality and release gate is outside this local scenario proof. The
protected local backup, public API, Chrome and database readback are in
`.local/demo-duty-198/`; the
backup archive passed TOC validation, but an ordinary-role full restore failed
on unrelated Auth ownership and Realtime configuration and remains unverified
under the documented owner path. No broad restore was attempted on preview.
