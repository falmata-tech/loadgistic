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
active marketplace lane. The preferred Capacity runtime is now the independent
Netlify `demo-capacity` scheduled function: one native minute tick requests at
most two oldest due actors through the existing signed Capacity-only endpoint.
Each actor advances only one valid next phase, and its following phase becomes
due at least 120 seconds after actual completion. With five healthy eligible
actors, expected per-actor spacing is about 120–180 seconds; provider scheduling,
execution time, pauses and failures can make it longer. This is a throughput
expectation, not observed production timing or a thirty-second cron claim.

The fixed Capacity cycle is Partial 80% → Partial 60% → Partial 30% → Empty 100%.
Route variants change only in the eligible Empty phase on the authored cycles;
the nominal lower bound between such changes is sixteen minutes, with actual
timing following completed phases. Independent synthetic location reports still
target 30 seconds through their separately hosted source worker. Foreground
web/native feed reads target 15 seconds, pause when hidden/backgrounded and avoid
overlapping incomplete loads. These contracts do not change real-phone capture
intervals. A Capacity save never manufactures a fresh GPS or phone observation.

The existing standalone Capacity container remains an optional alternative:
one due actor per 30-second tick, normally about 120–150 seconds per actor.
Run exactly one Capacity scheduler. Before enabling the Netlify function, stop
any external container and verify it stopped; the Netlify environment check
cannot discover or stop an independently configured host process. Neither
Capacity option requires the Traccar/GPS stack or local Docker. The app can use
managed Supabase while GPS-host qualification proceeds separately.

The Netlify function reads `DEMO_CAPACITY_WORKER_SECRET`, signs only
`/api/internal/demo-world/capacity/advance`, and neither selects targets nor
opens the database itself. Its same-site runtime environment is not physical
secret isolation. The optional container is separately configured with only its
narrow key and site/origin, without application, database or gateway credentials.
Both retain the database's demo ownership, takeover, due-time, lease and receipt
guards. The separate 15-minute world dispatcher never executes fast Capacity;
its slower profile/team/sharing controls remain off for initial activation.

After an outage, each invocation keeps its ordinary budget and requests only
the next prerequisite-satisfied phase for each claimed actor, with actual save
and completion time. Then wait the full per-actor interval; preserve nominal
timing for audit. There is no extra catch-up loop, skipped phase, backdated
freshness or recovery burst. Human changes pause only their target. Keep the
longer outage/backlog review boundary rather than compressing missed work.

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
