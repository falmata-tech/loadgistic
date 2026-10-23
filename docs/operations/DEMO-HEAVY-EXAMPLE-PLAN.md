# One honest fresh heavy Capacity example

This is the bounded local plan for [FEAT-SIM-003](../../specs/features/FEAT-SIM-003.md),
not permission to change hosted data. Before these local saves, the five
synthetic heavy/trailer vehicles were last saved August 28–29. All five are in saved Featured slots,
so changing a vehicle type would disturb that schedule. A new Auth user and
vehicle is unnecessary: an existing driving owner can save an honest current
Capacity signal using the product's own commands.

The selected fixture is `user-public-owner-10` / `veh-public-owner-10`
(`LG-TRK-O10`). Its existing Live Heavy Rigid Stake Body Truck + Trailer is
Empty, accepts full and partial loads, is Open, and has the Wolkite → Butajira
→ Addis Ababa route. The isolated-clone audit found no active shipment,
assigned GPS device or private grant. It has three saved Featured slots; those
remain untouched. The exact IDs, actor fixture markers, route, status, load
preference and audience are rechecked immediately before any local apply.

The assigned synthetic driver selects a **manual** approximate point near
Addis Ababa with a 5 km radius, then its provider owner republishes the same
Empty/Both/Open route. That is a dated manual demo entry, not a GPS fix or
claim that a truck actually moved. It should be visible in the first relevant
public heavy/trailer filter page and the Addis Ababa map viewport. Public
details must identify the demo account and manual source.

Before local apply: retain a fresh protected backup, rehearse both normal
commands on the disposable local database clone, prove exact no-change digests
for Featured/assignments/grants/Tracking and public source/readback, then
coordinate the shared-preview write window. The finite operation is guarded
against actor/vehicle/signal drift and has a protected partial-step receipt.
Do not run the destructive managed fixture importer or reset a shared preview.

A hosted version needs its own exact target, backup, owner review, timing and
verification. The local result will age naturally until a later intentional
demo save; this one-time refresh is not a live GPS simulator or an assertion
that all stale heavy examples are current.

Local outcome, 2026-10-22: the finite, machine-bound SQL retained at
`.local/fresh-heavy-20261022/guarded-refresh.sql` passed one disposable-clone commit and
an idempotent replay. A fresh protected 6.8 MB local preview backup was
verified before the exact-target transaction committed. The new Capacity
signal is `91a56965-5016-4515-b6ad-c4425e393887`; the vehicle remains
`93b53d96-d174-4a20-bd46-0056da0f8e67`. Keep these distinct: the public
map's `truck=` deep link selects the **Capacity signal ID**. The source is
`MANUAL_ADMIN` with a 5 km radius, and the saved status remains Empty, Both,
Open and Route. Three saved Featured slots, assignment, grants, Tracking and
the other heavy signals passed exact no-change readback.

The filtered local public API returned this signal first and alone. Actual
Chrome desktop and 390px phone web opened its details and showed the manual
source icon and today's Capacity save. Expo Web at 390px submitted the same
vehicle/status/source filters, received this signal, painted its manual-source
marker and opened its vehicle details. The
ignored `.local/fresh-heavy-20261022/` contains the protected backup and
focused screenshots; no credential or backup belongs in Git. Installed Android
and hosted publication remain outside this local proof.

## Verified local Partial example: O09

This second local correction is separate from the verified O10 Empty example.
`user-public-owner-09` owns and drives exact fixture-marked
`veh-public-owner-09` (`LG-TRK-O09`), Live Heavy Rigid Stake Body Truck +
Trailer. Its current signal is Empty/Both/Open/Route on Hawassa → Shashamane →
Batu → Adama. Read-only checks found two saved Featured slots and no active
GPS assignment, Tracking shipment or private grant. O09 was the only
status change: it became Partial, which accepts shared loads. O10 and
the other three heavy/trailer vehicles remain Empty.

The driver selected a synthetic manual point near Hawassa with a 5 km
radius, then published Partial on the same four-place Open route through the
normal actor commands. This is a dated demo entry, not an observed truck
movement or GPS fix. A guarded one-time transaction must recheck exact Auth
fixture identity, driver assignment, prior signal ID/revision, current source,
route, vehicle publication and absence of active GPS/Tracking/grants. It
compared saved Featured slots, assignments and other heavy signals before and
after, and returned a durable no-op receipt on replay.

Before shared-preview apply, rehearse on an owner-faithful disposable clone
with exact O09 state and matching normal-command definitions,
retain a fresh protected preview backup, and get a serialized local DB write
window. After apply, verify public Heavy/Empty count four and Heavy/Partial
count one, with O09 first on the relevant Partial page, visible on the map and
openable in desktop web, 390px phone web and Expo Web. No hosted mutation,
existing O10 change, broad fixture importer or permanent sync script is part
of this operation. The source and backup stay in ignored `.local/` evidence.

Local outcome, 2026-10-22: the exact finite transaction in ignored
`.local/partial-heavy-20261022/guarded-partial.sql` (SHA256
`58e6e1a8a9ccb96512c35ba560f0e484d52cf92aba0308bc12ba1cf040156676`)
committed on the existing owner-faithful profile-197 clone and replayed as a
no-op with one receipt. The clone's O09 actor, vehicle, prior signal, route,
Featured slots and no-active-relationship checks matched preview; four
security-definer command/actor/policy functions had identical hashes and
owners. The clone was older than O10's save, so the immediate preview preflight
also required O10's exact fresh Empty/manual signal. A new protected preview
backup (7,712,569 bytes, SHA256
`41736374c0b03da5a3ff14d6a06c0d54bf0d7880ed59d518b348a21222336515`)
preceded the O09 local-only transaction. Its new Capacity signal is
`6cf02812-1e88-454b-9ee2-64b8ddf5d31c`, Partial/Shared only/Open/Route,
with a 5 km manual point near Hawassa. Two Featured slots, its assignment,
GPS/Tracking/grants, O10 and the other three heavy signals retained their
state. Public API Heavy/Partial/Manual returned O09 alone in the Hawassa–Adama
viewport; Heavy/Empty returned four. Actual Chrome desktop and 390px phone web
selected the O09 signal, opened its details and showed its manual icon and
today's Capacity save. Expo Web at 390px applied the same filters, painted and
opened O09's marker and details. Focused screenshots are in the ignored local
folder. Installed Android and hosted data were not exercised.
