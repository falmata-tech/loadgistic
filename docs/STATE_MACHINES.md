# State Machines

## Road Freight

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

Tracking events may be added between state transitions. They do not mutate the operational state.
