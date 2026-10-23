---
id: FEAT-SIM-002
title: Exact synthetic Shipper / broker Capacity sharing scenario
related_ids: [BASE-BE-001, BASE-DEP-001, FEAT-SIM-001, FEAT-ENT-001, FEAT-CAP-001, FEAT-SEC-001]
problem: A demo broker needs to see a provider deliberately share and later revoke private Capacity, without giving any real account access or manufacturing business activity.
behavior: A disabled-by-default scenario may grant one exact synthetic business workspace access to one exact synthetic provider vehicle through the ordinary business Capacity command, then revoke that same grant through the ordinary revision-checked command. Both changes use durable, replay-safe receipts and preserve the vehicle's private sharing policy, Capacity state and source.
contracts: [DemoBusinessShareTarget, DemoBusinessShareSchedule, DemoBusinessShareReceipt, BusinessCapacityGrant]
observability: [demo_business_share_granted, demo_business_share_revoked, demo_business_share_replayed, demo_business_share_denied]
rollout: Verify exact fixture identities and no pre-existing grant, rehearse on a disposable local database clone, then leave the scenario disabled until separately reviewed activation. No customer account, public notification, hosted scheduling or production database change is authorized by this spec alone.
---

# A provider shares private Capacity with a demo broker

Status: implemented and exercised once on the local preview, then disabled;
hosted scheduling and activation remain pending. This is a narrow scenario
within the larger coordinated demo world. The ordinary Shipper / broker
sharing rules remain in FEAT-ENT-001.

Given the fixed provider vehicle and recipient workspace are active and owned
only by exact fixture-marked synthetic accounts, and the vehicle has a private
Capacity signal with no pre-existing grant to that workspace\
When the daily grant step is due and the simulator is enabled\
Then the scenario calls the same authorized business Capacity grant command as
the provider UI\
And the broker owner can see that vehicle in the private Capacity feed while an
unrelated workspace cannot\
And the vehicle's PRIVATE sharing mode, signal status, source, driver assignment
and public-map visibility do not change.

Given the scenario's own grant is active with its recorded revision\
When the daily revoke step is due\
Then the same authorized revision-checked revoke command removes that grant\
And the broker feed no longer includes the vehicle\
And no other personal or business grant is revoked.

Given a real or unmarked account joins the selected workspace, the provider or
vehicle is reassigned, the workspace is deactivated, or sharing becomes
exclusive/public\
When a grant is considered\
Then it is refused without changing Capacity, access, contacts or notifications.
The dedicated synthetic workspace must reject attempts to add a real account
while this scenario can grant access. Revocation of the scenario's own grant
remains possible if the workspace is later deactivated.

Given a worker retry, overlapping worker or crash\
When a committed step is retried\
Then it returns the saved result without a second grant or revocation\
And a failed command commits neither the receipt nor a partial permission
change. A later step cannot pass an unfinished earlier step for this target.

The worker accepts no actor, vehicle, workspace, recipient email or grant ID from
an HTTP caller. It does not send email, push or chat messages. The scheduled
grant is a demo example, not an invitation or an endorsement of a provider.

Tests: `tests/sql/demo-world-business-sharing.sql` and
`tests/demo-world-business-share-advance.test.mjs`. The SQL test creates its
broker workspace in a transaction and rolls back. Migrations 189 and 190
and both rollback-only regressions passed together on a disposable clone.
In the local preview, one exact synthetic broker was bound to one private
vehicle. The shared worker saved one GRANT and one REVOKE receipt; broker
private Capacity readback through the signed-in web API was 0 → 1 → 0,
while anonymous public search stayed 0. No email or access-email delivery
to the synthetic broker was queued. The local control is disabled again and
no scenario grant remains active. The protected local backup archive validates,
but full restore of provider-managed `realtime` schema is blocked by the
local database role; exact scoped recovery and this limitation are recorded
in `.local/demo-business-preview-20261022/local-preview-plan.md`.
No hosted binding, activation, customer account or production database change
has been made. Separately from the rotating scenario, six exact fixture-marked
private vehicles and two exact fixture-marked EMPTY vehicles were shared with
that synthetic broker through the ordinary provider command. One EMPTY Medium
Box Truck changed from PUBLIC to BOTH, retaining its public visibility. A
protected backup and rollback-only rehearsal preceded the two additions. Its
signed-in private API now returns all eight; the private PARTIAL Pickup and
EMPTY Medium Box filters each return their intended vehicle. The public EMPTY
Medium Box and trailer filters still return vehicles, and an anonymous caller
cannot access the broker feed. Featured slots and driver assignments retained
their exact before/after digests. The rotating scenario remains revoked and
disabled. The synthetic broker accepted the normal first-use policy and
desktop/390px Chrome both showed the private map, then found the one intended
PARTIAL Pickup and EMPTY Medium Box through the real filter controls; neither
view had page errors or horizontal overflow. An Expo Web sign-in attempt exposed
a separate mobile Auth defect: the API showed code entry after an Auth error.
FEAT-IAM-001 now requires explicit Auth acceptance and has focused tests. After
the local Auth cooldown, a new code reached Mailpit. A bounded Chrome run on
the Expo preview signed in as the synthetic broker, selected the workspace,
then found exactly one PARTIAL Pickup and one EMPTY Medium Box using the native
filter controls. A second bounded pass waited for each actual vehicle marker
before capturing the phone screenshots; both markers appeared on the map. The
first screenshots were taken too early, despite successful API responses. It
observed no page errors or horizontal overflow. Local
screenshots and the protected test script are in
`.local/demo-business-preview-20261022/`. This proves Expo Web parity for this
broker search, not an installed Android session or hosted delivery.
