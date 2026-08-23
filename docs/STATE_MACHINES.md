# State machines

## Provider shipment

```text
CREATED → TO_PICKUP → LOADING → IN_TRANSIT → UNLOADING → COMPLETED
   └───────────────→ LOADING
   └────────────────────────→ ISSUE
ISSUE → TO_PICKUP, LOADING, IN_TRANSIT, or UNLOADING
```

Allowed edges are enforced server-side. Loading, Unloading, and Issue may carry one optional image; Going to pickup, In Transit, and Completed do not. Completed is terminal and queues one idempotent customer-owner completion email without rolling back completion on delivery failure. A `LOCATION_AND_STATUS` session accepts an assigned Driver's browser-obscured point only during Going to pickup or In Transit and removes it from the customer projection in every other state.

## Guest access

```text
ISSUED → UNLOCKED SESSION → EXPIRES 30 DAYS AFTER COMPLETION → SCRUBBED
```

One customer-owner grant may be shared with trusted followers. Expiry removes the grant, delivery rows, and customer email while retaining provider-owned operational history.

## Shared capacity visitor access

```text
EMAIL OTP VERIFIED → ACTIVE RESTRICTED SESSION
ACTIVE ─ deliberate activity before 30 minutes → ACTIVE (rolling renewal)
ACTIVE ─ 30 minutes idle or Log out → EMAIL VERIFICATION REQUIRED
```

Background map reads, polling, rendering, and network requests are not activity.
An expired token cannot be renewed and no member account is created.

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

An Empty or Partial active signal chooses `RADIUS` or `ROUTE` (shown to users as Service area or Capacity route). Current signals have no date. A provider may publish at most one separate undated regular-service signal using either geometry.

## Provider subscription

```text
TRIAL (7 days) → PAYMENT REQUIRED / UNDER REVIEW → ACTIVE (30 days) → PAYMENT REQUIRED
```

Explicit sponsored access may bypass payment expiry. Company Drivers inherit the fleet workspace state.
