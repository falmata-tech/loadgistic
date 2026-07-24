---
id: FEAT-XXX-001
title: Replace with a stable feature title
related_ids: [BASE-FE-001, BASE-BE-001]
problem: State the user or operational problem.
behavior: State the externally observable behavior.
contracts: [NamedInputPort, NamedDomainContract, NamedOutputPort]
observability: [named_outcome, named_audit_event]
rollout: State release gate, migration, monitoring, and rollback expectations.
---

# Feature title

### Scenario: primary behavior

Given a concrete precondition\
When one actor performs one action\
Then one observable result occurs.

### Scenario: material denial or failure

Given a concrete invalid or unauthorized precondition\
When the action is attempted\
Then no forbidden state change occurs.

## Contract ownership

- Inbound adapter:
- Application service:
- Domain rule:
- Outbound adapter:
- Tests:
