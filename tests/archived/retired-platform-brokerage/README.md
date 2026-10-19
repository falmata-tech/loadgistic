# Superseded platform Brokerage browser scenarios

These six source snapshots were moved out of `tests/e2e` after the owner's
FEAT-ENT-001 / FEAT-TRQ-001 decision retired Loadgistic's platform transport
arrangement service. They are retained only to explain the former workflow;
they are not runnable acceptance tests for the current product. Do not restore
their old positive expectations to CI.

| Historical suite | Current executable evidence |
| --- | --- |
| `transport-requests`, `transport-request-api` | `tests/e2e/platform-brokerage-retirement.spec.ts` checks no public launcher, all retired intake endpoints deny without writes, and old routes return 404; `tests/sql/platform-brokerage-retirement.sql` checks database denial/history preservation. |
| `brokerage-conversations`, `transport-chat-follow-up` | `tests/e2e/platform-brokerage-retirement.spec.ts` checks conversation/read endpoints return 410; `tests/platform-brokerage-retirement.test.mjs` covers all retired methods, stale links/notifications and Support alert preservation. |
| `brokerage-workflows`, `owner-brokerage-demo` | `tests/e2e/platform-brokerage-retirement.spec.ts` checks the Team form lacks Brokerage permission and Provider Support remains accessible; `tests/sql/platform-brokerage-retirement.sql` checks privileges and preserved history. Active software Support workflows remain in their own `tests/e2e/support-*.spec.ts` suites. |

The snapshots use `.txt` extensions so TypeScript and Playwright do not import
retired API calls. FEAT-ENT-001 also describes the active customer business
workspace that replaces any special platform brokerage privileges.
