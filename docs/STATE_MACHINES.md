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

## Workspace subscription access

```text
APPLICATION APPROVED
→ TRIAL (7 days)
→ PAYMENT REQUIRED
→ PAYMENT UNDER REVIEW
→ ACTIVE (30 days from administrator approval)
→ PAYMENT REQUIRED
```

A qualifying Business may instead enter `SPONSORED`, which has no payment
deadline. Pending payment does not extend access: an unexpired Trial or Active
period remains available until its existing end, while a lapsed workspace stays
limited until an administrator marks payment paid. Company Drivers inherit the
Fleet Transporter workspace state.
