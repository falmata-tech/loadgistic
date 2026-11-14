# Scenario-driven demo simulation

Owner direction, November 13, 2026. This is the design contract for Loadgistic's
demo simulator and a platform-independent brief for other products. Current
implementation and actual test/deployment evidence remain in
[PROGRESS](../PROGRESS.md); this document does not establish a running service.

## Platform-independent contract

Build a **scenario-driven synthetic activity simulator**, using a versioned
catalog and a state machine. The catalog describes believable actors, starting
states, related records and ordered events. The scheduler advances eligible
events; it does not invent business data on each timer tick.

Each scenario needs:

- A stable ID/version, intended actor/entity types and exact enrollment rules.
- A valid starting state, required relationships and allowed field values.
- Ordered steps with timing/dwell ranges, explicit prerequisites and the
  application command that performs each change.
- Expected saved state and visible outcomes, including when an entity should
  appear, change or disappear from a feed.
- Pause, expiry, human takeover, failure/retry and reset/end behavior.
- Recorded scenario choice, seed when selection varies, step/idempotency key,
  revision, scheduled time, execution time and resulting record references.

Random selection can choose among compatible, predefined scenarios or start
offsets. It must not manufacture a new payload by combining independently
random fields. Security nonces and identifiers remain cryptographically random;
that is separate from the scenario's business values. Record enough information
to replay the same business sequence after restart or during a regression test.

## Scheduling and coherent updates

Do not rewrite every field of every demo account on each tick. Use separate
schedules for independent behavior and one ordered sequence per affected entity.
Related changes belong in a single logical event and should use an existing
atomic application command where that contract already exists.

| Data | Change trigger | Coherence requirement |
| --- | --- | --- |
| Location | Periodic source report while a movement/stationary step is active | Approved source, route progress or explicit stationary point, plausible timing, preserved privacy and source provenance |
| Capacity | A predefined pickup, delivery or availability event | Status, available percentage, load preference and observation time agree |
| Route/corridor | A supported plan change at an eligible scenario boundary | Approved ordered stops, direction and location eligibility; no arbitrary city combinations |
| Profile presentation | A separate, infrequent approved profile scenario | Only safe allowlisted fields; no silent identity, ownership, verification, consent or permission changes |

Several demo actors may advance concurrently, including multiple vehicles owned
by one demo business. Keep per-vehicle ordering and shared-account conflicts
explicit. Bound each batch, recheck current revisions and resume saved work after
failure. Do not create one global transaction that makes an unrelated actor's
failure block the whole marketplace. A successful retry must not duplicate an
already committed event or refresh an old report's timestamp falsely.

For example, a catalog can define one vehicle's available capacity as
Empty 100% → Partly loaded60% → Partly loaded30% → Empty 100%, with loading and
unloading events at approved stops. Those are illustrative authored states,
not permission to infer measurements or a claim that this exact sequence is
installed. Full 0% and Off duty need their own existing domain semantics; they
must not appear as available marketplace supply. Unknown estimates stay unknown
instead of being invented to complete a card.

## Geography requires two kinds of evidence

A corridor catalog contains reviewed **ordered place identifiers**, direction,
allowed variants and compatible vehicles/actors. Validate the entire sequence
against that catalog. Checking that each city exists cannot establish that the
combination is a sensible corridor.

Moving GPS/phone simulation additionally requires an approved road polyline,
source/license, data timestamp, geometry hash and qualified endpoints. Follow
that geometry deterministically with bounded speed, stop dwell and a continuous
return/reversal policy. Do not jump between cities, interpolate across unrelated
road segments or use a small geometric rectangle as a purported road route.
City-center lines used to express a planned corridor are not driving directions.

An explicitly stationary scenario can emit periodic reports at its predefined
point and test freshness/persistence. It must not silently replace a requested
movement scenario or be called road-following acceptance. Missing, inconsistent
or unqualified geometry stops that movement scenario. Keep local urban protocol
tests distinct from a verified journey along an entire regional corridor.

Prepare and review geographic data offline. The running simulator should use
its stored catalog, rather than depend on a public geocoder/router for every
tick. Honor the source's license and service use policy; public availability
does not establish permission for commercial batch extraction.

## Safe integration and verification

Execute normal domain/application commands under narrow simulator authority,
so the real backend, authorization, database and feed are exercised. Do not
simulate success by changing front-end state or writing around business rules.
Keep any source-specific protocol gateway separate from the scenario scheduler.

Enrollment is operator-controlled and checked again at the write boundary.
Every target and related participant must belong to the exact approved demo
cohort. A display name, email pattern or editable profile flag never enrolls an
ordinary signup. Show trusted demo provenance. Prevent real communications,
physical commands and other external effects outside the approved test boundary.

For each run verify the complete chain:

1. Chosen scenario/version/step and its prerequisites.
2. Accepted application command and authoritative saved values/timestamps.
3. Authorized public/private feed projection, including any polling delay.
4. Actual web and native rendering, saved state and recovery behavior.
5. Unchanged normal accounts and rejection of forged enrollment or stale work.

Include restart/idempotency, expired leases, duplicate/out-of-order reports,
invalid transitions, inconsistent field combinations, unavailable dependencies,
revoked access, human takeover and emergency stopping. Log sanitized operation
IDs, statuses and timings; keep credentials, precise customer locations and
private contacts out of reports. Installed source, passing tests, a deployed
service and sustained observed operation are separate checkpoints.

## Loadgistic mapping

Before this change, the workflow fixture defined five mutable exact targets and
seven deterministic scenarios with fourteen daily transitions. The movement
worker and workflow executor had independent credentials/leases. That baseline
did not satisfy the new geography contract by itself: the earlier movement
used coordinate-offset rectangles, and the planner accepted individually known
cities without validating a whole approved sequence.

The owner's later frequency requirement supersedes that daily cadence for the
active marketplace lane. Target synthetic location reports every 30 seconds and
Capacity phases at least120seconds apart per eligible demo vehicle. The dedicated
30-second worker advances at most one due vehicle per tick, preserving visible
staggering even after delayed activation or an outage. With five eligible actors,
normal phase spacing is about120–150seconds per vehicle. The fixed Capacity cycle is
Partial 80% → Partial 60% → Partial 30% → Empty 100%. Route variants change only in
their eligible Empty phase, approximately every16–20minutes. Foreground web/native
feed reads target 15 seconds, pausing when hidden/backgrounded and avoiding
overlapping incomplete loads. These are candidate contracts, not production
operation evidence, and they do not change real-phone capture intervals.

Use a dedicated fast capacity worker. The existing 15-minute workflow dispatcher
can retain its slow lanes; repeatedly querying profile/team/sharing work every
30seconds is unnecessary. First activation should begin a valid initial phase
promptly. After a short outage, apply only the next prerequisite-satisfied step
with its actual completion time, then wait the full interval before another;
preserve original nominal timing for audit. Human changes pause that target.
Keep the longer outage/backlog review boundary and do not compress missed work
into a burst to make the market appear busy.

The reconciliation must preserve trusted account provenance and the new
Phone/GPS-only policy. Historical Manual-dependent duty/handover lanes remain
explicitly held until their supported source redesign is qualified. Do not
activate them to make a scenario appear more comprehensive. Location reporting,
capacity publication and agreed private Tracking retain their distinct consent,
ownership and disclosure rules.

Relevant contracts: [FEAT-SIM-001](../../specs/features/FEAT-SIM-001.md),
[FEAT-SIM-004](../../specs/features/FEAT-SIM-004.md),
[FEAT-GPS-001](../../specs/features/FEAT-GPS-001.md),
[hosting](DEMO-GPS-HOSTING.md) and
[Android device testing](ANDROID_DEVICE_TESTING.md).
