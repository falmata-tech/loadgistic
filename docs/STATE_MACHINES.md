# State machines

## Provider shipment

```text
CREATED → LOADING → IN_TRANSIT → UNLOADING → COMPLETED
   └──────────────→ ISSUE ←───────────────┘
                         → IN_TRANSIT or UNLOADING
```

Allowed edges are enforced server-side. Loading, Unloading, and Issue may carry one optional image; In Transit and Completed do not. Completed is terminal and queues one idempotent customer-owner completion email without rolling back completion on delivery failure.

## Guest access

```text
ISSUED → UNLOCKED SESSION → EXPIRES 30 DAYS AFTER COMPLETION → SCRUBBED
```

One customer-owner grant may be shared with trusted followers. Expiry removes the grant, delivery rows, and customer email while retaining provider-owned operational history.

## Provider review

```text
PUBLISHED
  └─ rating 1–3 → DISPUTE PENDING → UPHELD or REMOVED
```

The original rating remains public and counted while pending.

## Capacity

```text
OFF_DUTY ↔ EMPTY or PARTIAL
```

An Empty or Partial active signal chooses `RADIUS` or `ROUTE` (shown to users as Corridor). Current signals have no date. A provider may publish at most two separate undated regular corridors.

## Provider subscription

```text
TRIAL (7 days) → PAYMENT REQUIRED / UNDER REVIEW → ACTIVE (30 days) → PAYMENT REQUIRED
```

Explicit sponsored access may bypass payment expiry. Company Drivers inherit the fleet workspace state.
