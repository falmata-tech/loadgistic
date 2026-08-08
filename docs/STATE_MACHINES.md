# State machines

## Provider shipment

```text
CREATED → LOADING → IN_TRANSIT → UNLOADING → COMPLETED
   └──────────────→ ISSUE ←───────────────┘
                         → IN_TRANSIT or UNLOADING
```

Allowed edges are enforced server-side. Loading, Unloading, and Issue may carry optional proof; In Transit and Completed do not. Completed is terminal and queues separate idempotent shipper/receiver emails without rolling back completion on delivery failure.

## Guest access

```text
ISSUED → UNLOCKED SESSION → EXPIRES 30 DAYS AFTER COMPLETION → SCRUBBED
```

Shipper and receiver grants are independent. Expiry removes grants/delivery rows and customer emails while retaining provider-owned operational history.

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

An Empty active signal chooses `RADIUS` or `ROUTE`; a Partial active signal requires `ROUTE`. Immediate signals have no date. One separate next trip may have an optional date; recurring routes and permanent working areas are undated.

## Provider subscription

```text
TRIAL (7 days) → PAYMENT REQUIRED / UNDER REVIEW → ACTIVE (30 days) → PAYMENT REQUIRED
```

Explicit sponsored access may bypass payment expiry. Company Drivers inherit the fleet workspace state.
