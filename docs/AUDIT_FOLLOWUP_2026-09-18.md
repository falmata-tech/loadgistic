# Follow-up observations — 2026-09-18

September 20 follow-up: see [AUDIT_READINESS_2026-09-20.md](AUDIT_READINESS_2026-09-20.md).
CI-OBS-002 has a reproduced hydration defect, fix and 14 passing no-retry local
browser cases. CI-OBS-001 now has bounded sanitized diagnostics before import;
the original HTTP 500 cause remains unconfirmed. Remote evidence is separate.

These observations remain open for investigation. They are not confirmed
customer-facing defects and must not be described as fixed merely because CI
passed on another attempt. Current security recurrence rules live in
[SECURITY_REGRESSION_REGISTER.md](SECURITY_REGRESSION_REGISTER.md).

## CI-OBS-001 — Initial local schema API request can fail during CI setup

- Evidence: run `35379271678`, e2e fixture setup received HTTP 500 from its first
  service-role OpenAPI GET before browser tests began. Validation/container had
  passed. The same local GET and both setup paths in subsequent run `35380281319`
  passed without changing runtime code.
- Classification: intermittent test-environment observation; cause unconfirmed.
- Owner: CI maintainer.
- Next action: capture only a bounded sanitized provider error code on recurrence,
  check schema/configuration readiness, and evaluate a bounded idempotent read
  probe. Do not blindly retry the destructive fixture import or hide persistent
  authorization/schema failures behind retries.
- Closure evidence: a reproduced cause, focused regression and fresh CI setup
  without relying on a whole-job rerun.

## CI-OBS-002 — Chat and Support browser cases require retries

Exact commit `4c1c8a6`, successful CI run `35380281319`: 148 cases passed on the
first attempt, ten passed on retry, eight opt-in cases skipped; browser suite
33.0 minutes. The same five cases retried in both desktop and mobile projects:

| Test file | Case |
|---|---|
| `tests/e2e/assisted-chat-audit.spec.ts:3` | Chat start, attachment reply, end and restart |
| `tests/e2e/assisted-chat-audit.spec.ts:65` | Saved-message refresh failure versus submission failure |
| `tests/e2e/private-capacity-network.spec.ts:39` | Assisted matching as an immediate private chat |
| `tests/e2e/support-history.spec.ts:37` | Failed history navigation preserves messages and draft |
| `tests/e2e/support-history.spec.ts:89` | Guest launcher/full threads, drafts, history and old attachments |

Observed failure categories include aborted requests, locator-fill timeouts,
visibility assertions and missing elements. Root cause and customer impact are
unconfirmed. The guard's SQL/REST/GraphQL checks and managed fixture verifiers
passed independently; do not infer that the guard caused these retries or that
passing retries establish a flawless UI.

- Owner: Support/guest-workflow maintainer with CI maintainer.
- Next action: reproduce these five cases with trace/network timing; distinguish
  cold compilation, fixture/session ordering and UI races. Fix the identified
  cause and add focused failure-path evidence. Do not simply increase retries,
  weaken assertions or silence request errors.
- Closure evidence: the affected desktop/mobile cases pass without retries in a
  clean run after a demonstrated fix. Keep this item open until then.

Protected raw evidence: `.local/security-recurrence-ci-complete.log` and
`.local/data-api-guard-ci-failure.log`. Do not publish raw request bodies, OTPs,
credentials or customer data when adding diagnostics.
