---
id: FEAT-SIM-003
title: Honest fresh heavy-vehicle demo signal
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-SIM-001, FEAT-CAP-001, FEAT-FTR-001, FEAT-GEO-001, FEAT-SEC-001]
problem: The existing exact synthetic heavy/trailer examples were honestly old and all Empty, so a first-time broker could not see a current Partial heavy/trailer choice.
behavior: Finite, local-only operations let two exact fixture-marked driving owners choose manual Capacity points and republish their existing Open routes: O10 remains Empty and O09 becomes Partial. The normal commands produce real timestamps. No Auth identity, vehicle, assignment, Featured selection, private grant, Tracking or GPS record is created or changed.
contracts: [FreshHeavyRefreshTarget, DriverManualLocationSelection, ProviderCapacitySignal, FreshHeavyRefreshReceipt]
observability: [fresh_heavy_refresh_preflight, fresh_heavy_manual_saved, fresh_heavy_capacity_saved, fresh_heavy_refresh_verified]
rollout: Rehearse exact commands on an isolated restored local clone; back up the shared preview, recheck the current synthetic actor and all no-change guards, then apply once during a coordinated local-only window. Hosted rollout requires a separate exact review. This spec grants no hosted or customer mutation.
---

# One current heavy/trailer example

Status: both O10 Empty and O09 Partial were locally exercised on 2026-10-22;
hosted data was not changed. This is
a finite demo-data correction, not an active simulator tick or a claim that
the vehicle moved in real life.

Given `user-public-owner-10` and `veh-public-owner-10` are the exact active
synthetic driving owner and Live Heavy Rigid Stake Body Truck + Trailer,
its latest signal is Empty, accepts both full and partial loads, is Open,
and has the saved Wolkite → Butajira → Addis Ababa route, with no live device,
active Tracking or private grant\
When the operator runs the guarded local refresh\
Then the assigned driver chooses a manual point near Addis Ababa through the
ordinary driver source command\
And the same owner saves Empty, both load types, Open and the same route
through the ordinary Capacity command\
And the public result shows its actual save and location times and manual
source, with no fabricated GPS/phone movement or verification badge.

Given an unmarked or reassigned actor, changed vehicle, non-Empty signal,
changed route/load/audience, selected GPS/phone device, active Tracking,
private grant, or stale expected revision\
When preflight or either command runs\
Then the operation stops without claiming another account or changing those
unrelated records. A partial first step stays visible in a protected receipt;
replay reads back the exact manual point before continuing and never silently
chooses a new one.

Given the signal is saved\
When a broker filters public Capacity for Empty heavy/trailer vehicles on
desktop web, phone web and Expo\
Then the refreshed example appears on the first relevant page and map viewport,
opens its details, and shows honest recency and source\
And the existing vehicle type, assignment, saved Featured slots, private grants,
Tracking, existing other heavy signals and timestamps are unchanged.

Evidence: the exact SQL transaction committed on a disposable restored local
clone; replay returned `HEAVY_REFRESH_ALREADY_APPLIED` without a second save.
A fresh protected preview backup preceded one local apply. The public API's
Heavy Rigid Stake Body Truck + Trailer + Empty + Manual + Addis viewport filter
returned only the target signal, first in its page. Chrome desktop and 390px
phone web opened that signal's details and showed today's honest save time and
the manual-source marker icon. Expo Web at 390px applied those same filters,
returned that one signal, painted its manual-source map marker and opened its
vehicle details. Screenshots and the protected
backup live under ignored `.local/fresh-heavy-20261022/`; they are not a
hosted or installed-Android test. This finite operation has not been added to
CI as a recurring fixture test. Recovery is exact-target only: restore the prior manual selection
and Capacity state through normal commands if those transitions are still
allowed; a protected database backup is retained for review, not an automatic
whole-preview restore over unrelated work.

Tests: the ignored one-time transaction at
`.local/fresh-heavy-20261022/guarded-refresh.sql` owns the clone commit/replay
and exact no-drift assertions. The ignored local Chrome browser check owns
desktop, phone-web and Expo-Web filter/open readbacks. This machine-bound
operation is retained as local evidence, not a reusable public script or CI test.

## One honest Partial heavy/trailer choice

Given `user-public-owner-09` is the exact active synthetic owner and assigned
driver of Live `veh-public-owner-09`, its latest signal is Empty/Both/Open/Route
on Hawassa → Shashamane → Batu → Adama, and it has no active GPS, Tracking or
private grant\
When that driver selects one clearly synthetic manual point near Hawassa and
publishes Partial on the same Open route through the ordinary actor commands\
Then the new signal is Partial and accepts shared loads, with a manual-source
icon, actual save timestamps, and no claim of GPS or real-world movement\
And O10 stays Empty; the other three heavy/trailer signals retain their states
and timestamps; saved Featured slots, assignments, vehicle type, documents,
grants and Tracking do not change.

Given O09 actor, driver assignment, prior Capacity ID, route, audience, source
selection, Featured slots, or no-active-relationship checks drift\
When the finite local operation is attempted or replayed\
Then it refuses before changing another account, or returns its exact receipt
without making a second save. The two commands and receipt commit atomically.

Given the reviewed O09 Partial signal is saved\
When a broker filters public Capacity for Heavy Rigid Stake Body Truck +
Trailer and Partial on desktop web, phone web and Expo Web\
Then O09 is in the first result page and map viewport, its marker opens its
details, and the public Heavy/Empty result count becomes four while
Heavy/Partial becomes one.

Tests: an owner-faithful disposable clone with the exact current O09 target
state and identical normal command definitions must pass guarded first-run, replay and
no-change readbacks before local preview apply; local public API and actual
desktop/390px phone web/Expo Web must prove the two filtered counts and O09
marker/detail task. Hosted and installed Android remain separate release gates.

O09 evidence: an existing owner-faithful disposable clone with identical O09
actor/vehicle/prior Capacity state and matching command-owner/definition hashes
passed the exact guarded transaction and no-op replay. That clone predates
O10's fresh save, so the immediate preview preflight separately proved O10's
new Empty/manual signal and the exact five-vehicle mix. A fresh protected
preview backup preceded the atomic O09 apply. Independent local DB readback
showed O09 Partial/Open/Route/manual 5 km, shared loads only, two unchanged
Featured slots, one unchanged driver assignment, zero active GPS/Tracking or
business grants and one receipt; O10 and the other three remained Empty. The
public API returned Partial one (O09 first) and Empty four. Actual Chrome
desktop, 390px phone web and Expo Web applied/opened the O09 result and showed
today's save plus the manual-source marker. Evidence is in ignored
`.local/partial-heavy-20261022/`, not a hosted or installed-Android proof.
The one-time local SQL is not a recurring worker or CI fixture test.
