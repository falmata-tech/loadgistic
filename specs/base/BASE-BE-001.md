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
Supabase PostgreSQL, Auth, and private Storage adapters
```

The current functional modules are valid implementations. SOLID means responsibilities and dependencies remain separable; it does not require classes where functions provide clearer contracts.

## DDD boundaries

- Aggregates: Provider Shipment, Current Capacity, Regular Corridor, Provider Microsite, Subscription Payment Proof.
- Entities: User, Provider Organization, Provider Profile, Vehicle, Driver, Party Tracking Grant, Provider Review, Email Delivery.
- Value objects: ETB Amount, Public Provider Handle, Capacity Percentage, Tracking Code Digest, Review Authorization, Visibility Policy, Expiry.
- Domain services: transition validation, public-projection policy, geographic matching, capacity freshness, guest retention, review eligibility, and idempotent email-delivery policy.

## Base scenarios

### Scenario: unauthorized command

Given a caller lacks the required role or record relationship\
When an inbound adapter submits a command\
Then the application service rejects it before persistence\
And no protected record or file is disclosed.

### Scenario: one production-shaped persistence contract

Given Loadgistic runs locally, in browser tests, in Preview, or in Production\
When an application command or projection uses durable data\
Then it uses the Supabase PostgreSQL repository contract rather than a SQLite runtime fallback\
And Supabase Auth supplies the verified identity projection\
And Supabase RLS independently enforces tenant scope\
And tests use an isolated local Supabase project rather than a different persistence engine.

## Contract details

`CommandHandler` accepts authenticated actor plus validated input. `AuthorizationPolicy` denies by default. `DomainRule` is deterministic and side-effect free. `RepositoryPort` persists aggregate changes atomically. `AuditPort` records sensitive outcomes without secrets. `FilePort` stores private proof objects and resolves them only after shipment authorization.

The normative actor, tenant, record, and denial contracts are listed in `docs/AUTHORIZATION_MATRIX.md`. Public browse permission never grants mutation or private-file permission.

## Required verification

- `tests/domain.test.mjs`
- `tests/repository.test.mjs`
- Permission and invalid-transition tests for every changed command
