---
id: FEAT-CAP-001
title: Provider capacity publication
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001]
problem: Business shippers need simple, current truck availability without fabricated capacity analytics.
behavior: Authorized transporters publish Empty, Partial, or Full status with freshness and expiry; expired capacity is never public.
contracts: [CapacityUpdate, CapacityStatus, CapacityPercentage, CapacityVisibilityPolicy, Expiry]
observability: [capacity_audit, update_actor, updated_at, expires_at]
rollout: Preserve minimal capacity semantics and validate public expiry filtering before release.
---

# Capacity publication

### Scenario: partial capacity is published

Given an authorized transporter, driver, or administrator owns the vehicle\
When Partial capacity with an integer from 1 through 99 and an expiry is submitted\
Then the update records actor and time\
And the fresh public record displays the declared percentage.

### Scenario: fixed capacity percentages

Given a capacity update is Empty or Full\
When it is validated\
Then Empty maps to 100 percent and Full maps to zero percent.

### Scenario: expired capacity is hidden

Given a capacity record is past its expiry\
When public capacity is queried\
Then that record is absent.

## Contract ownership

- Domain rules: `validateCapacity`, `capacityFreshness`
- Application services: `publishCapacity`, `listPublicCapacity`
- Tests: `tests/domain.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
