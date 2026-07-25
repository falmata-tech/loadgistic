# State Machines

## Parcel

```text
NEW
→ CONTACTED
→ COLLECTED
→ IN_ROUTE
→ READY_FOR_PICKUP → COMPLETED
or
→ OUT_FOR_DELIVERY → COMPLETED
```

Exceptions: ON_HOLD, ISSUE, CANCELLED, RETURNING, RETURNED.

`COLLECTED` means commercial agreement plus physical custody.

## Freight

```text
POSTED or SENT
→ CONTACTED
→ AGREED
→ ASSIGNED
→ IN_TRANSIT
→ DELIVERED
→ COMPLETED
```

Exceptions: DECLINED, WITHDRAWN, CANCELLED, ISSUE, ON_HOLD.

All transitions are enforced in `src/lib/domain.js` and called server-side.
