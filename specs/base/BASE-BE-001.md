---
id: BASE-BE-001
title: Backend domain and application base
related_ids: [BASE-FE-001, BASE-DEP-001]
problem: Business invariants and tenant authorization must remain independent from transport and persistence details.
behavior: Route adapters authenticate input, application services authorize commands, domain functions enforce state, and repository adapters persist atomically.
contracts: [CommandHandler, AuthorizationPolicy, DomainRule, RepositoryPort, AuditPort, FilePort]
observability: [audit_log, command_outcome, structured_error, health_status]
rollout: Add contract and permission tests before migrating adapters or enabling new commands.
---

# Backend base specification

## Hexagonal boundary

```text
HTTP route / server page (inbound adapter)
             ↓
Application service + authorization
             ↓
Pure domain rule / entity invariant
             ↓
Repository, file, identity, audit ports
             ↓
SQLite today; Supabase/Auth/Storage target adapters
```

The current functional modules are valid implementations. SOLID means responsibilities and dependencies remain separable; it does not require classes where functions provide clearer contracts.

## DDD boundaries

- Aggregates: Shipment, Capacity Update, Business Application, Subscription Payment Proof.
- Entities: User, Organization, Provider Profile, Vehicle, Location, Route.
- Value objects: ETB Amount, Shipment Code, Capacity Percentage, Tracking Token, Expiry.
- Domain services: transition validation, visibility policy, pricing validation, capacity freshness.

## Base scenarios

### Scenario: unauthorized command

Given a caller lacks the required role or record relationship\
When an inbound adapter submits a command\
Then the application service rejects it before persistence\
And no protected record or file is disclosed.

### Scenario: adapter replacement

Given a repository port has a tested behavioral contract\
When SQLite is replaced by a Supabase adapter\
Then domain and application behavior remains unchanged\
And Supabase RLS independently enforces tenant scope.

## Contract details

`CommandHandler` accepts authenticated actor plus validated input. `AuthorizationPolicy` denies by default. `DomainRule` is deterministic and side-effect free. `RepositoryPort` persists aggregate changes atomically. `AuditPort` records sensitive outcomes without secrets. `FilePort` stores private proof objects and resolves them only after shipment authorization.

The normative actor, tenant, record, and denial contracts are listed in `docs/AUTHORIZATION_MATRIX.md`. Public browse permission never grants mutation or private-file permission.

## Required verification

- `tests/domain.test.mjs`
- `tests/repository.test.mjs`
- Permission and invalid-transition tests for every changed command
