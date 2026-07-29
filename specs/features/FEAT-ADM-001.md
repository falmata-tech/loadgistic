---
id: FEAT-ADM-001
title: Platform operations inventory and controls
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-PRV-001]
problem: Platform administrators can review three queues but cannot inspect the connected operational records or safely suspend an account or truck from one Loadgistic workspace.
behavior: Administrators receive a bounded, searchable Operations view of users, workspaces, trucks, loads, and latest truck capacity, with audited activation controls for users and trucks.
contracts: [AdminOperationsProjection, AdminRecordSearch, UserActivationCommand, VehicleActivationCommand, AdminAudit]
observability: [admin_operations_read, admin_record_status_audit, denied_admin_command]
rollout: Add the inventory without changing tenant-facing visibility; status commands are reversible, audited, and deny non-admin callers.
---

# Platform operations

### Scenario: administrator inspects connected platform data

Given an authenticated platform administrator\
When Operations is opened or searched\
Then bounded result sets show users, workspaces, trucks, loads, and latest capacity from authoritative records\
And relationships are identified with workspace, provider, truck platform number, shipment code, and current status\
And private proof paths, passwords, session values, tracking secrets, and exact coordinates are absent.

### Scenario: administrator suspends or restores an account

Given an authenticated administrator selects an account other than their own\
When they suspend or restore access\
Then the user's active state changes\
And the actor, target, resulting state, and time are audited\
And a non-administrator or self-suspension attempt changes nothing.

### Scenario: administrator suspends or restores a truck

Given an authenticated administrator selects a truck\
When they deactivate or reactivate it\
Then the truck remains recorded with its permanent platform number\
And inactive trucks disappear from Fleet and marketplace discovery\
And the actor, target, resulting state, and time are audited.

## Contract ownership

- Page: `/admin/operations`
- Application services: admin inventory and activation functions in `src/lib/repository.js`
- Inbound adapter: `/api/admin/records/[type]/[id]`
- Tests: `tests/authorization.test.mjs`, `tests/repository.test.mjs`, `tests/e2e/smoke.spec.ts`
