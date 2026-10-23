# Tracking access simplification

Scope: Loadgistic only; FEAT-TRK-001 / FEAT-REV-001, ADR-073. Local implementation.
No hosted database/configuration writes, production email or deployment.

## Visitor workflow

1. Enter the email the transporter added.
2. Enter one six-digit email code. A single shared shipment opens directly;
   multiple shipments appear in a paginated private list.
3. Refresh or open another currently shared shipment without another code while
   the session is active. Log out explicitly when finished.
4. The verified customer owner may review a completed shipment directly. Other
   recipients cannot review it. No separate shipment or review code is required.

Provider creation and detail screens share the Track link; invitation and completion
emails explain the same flow. New UI/recovery/privacy guidance has Amharic, Afaan
Oromo, Somali and Tigrinya entries. User-authored content is unchanged.

## Security boundaries

- Migration 114 adds service-only helpers; existing RLS-protected OTP/outbox
  tables, ten-minute single-use codes, five-attempt limit and cleanup remain.
- Resending supersedes outstanding email challenges. Ineligible emails receive
  no delivery and the same outward response. Rate limits now bind to the email,
  rather than separate email-plus-shipment-code combinations.
- The signed HttpOnly, SameSite cookie uses a distinct email-session subject and
  Secure in production. Thirty minutes of inactivity ends it; deliberate visible
  interaction renews it at bounded frequency, up to eight hours after verification.
  Server checks enforce both limits; reads and polling do not renew the cookie.
- Legacy shipment cookies cannot renew into broader email access. Every detail,
  private proof and review rechecks current recipient access. Owner-only reviews
  lock/recheck the recipient before the existing completion/uniqueness command.
- Logout/expiry removes private UI and clears the cookie. History snapshots hide
  private content and persisted restores reload. Session controls wait for their
  handlers before becoming interactive.
- No SMTP/Auth/provider configuration changes, dependencies or new accounts.

Design reference: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
The extra old codes arrived through the same email channel; removing their manual
entry does not replace email verification or current recipient authorization.

## Evidence

- `tests/sql/tracking-email-session.sql`: rollback-only SQL passes for eligibility,
  email matching, safe list/pagination, wrong OTP/email, single-use, resend,
  five-attempt lockout, expiry/revocation, owner-only completed reviews and browser
  RPC denial. Local database catalog security passes after migration 114.
- 47 focused unit checks pass across session limits, recipient access, email
  rendering/delivery, localization, proof authorization, rate limits and creation
  response handling. Source/spec validation passes.
- Initial browser run: completion/email/review desktop and phone plus phone
  recipient-add/revocation pass. Two desktop assertions hit five-second navigation
  limits; waits now cover actual navigation completion. The phone renewal probe
  exposed activity before hydration; controls now wait for handlers, and the test
  waits for that ready state before deliberate activity. Failures remain in
  `.local/tracking-email-session/browser.log` and
  `artifacts/tracking-email-session-20260928/`.
- TypeScript passes after using the existing browser-harness types required by
  the repository’s offline shim. Eight distinct desktop/phone cases now pass
  across the recorded runs below, not one uninterrupted green run.
  A second run hit the correctly enforced request timeout on the slow local dev
  server; it was stopped and only Loadgistic’s dev process restarted. Preserve
  that failure/interruption in `browser-final.log`; do not count it as a pass.

| Browser evidence under `artifacts/` | Final passing coverage |
| --- | --- |
| `tracking-email-session-20260928/` | Completion email and owner review: desktop + phone. |
| `tracking-email-session-restarted-20260928/` | Adding recipients, actual invitation/OTP delivery, revoked access; actual proof upload/read, anonymous/unrelated/revoked denial and authorized staff read: desktop + phone. |
| `tracking-session-expiry-20260928/` | Email-only verification, wrong/replayed OTP, multi-shipment list, direct single result, refresh, scoped detail, cross-origin denial, renewal, logout, legacy/absolute expiry rejection and simulated 31-minute inactivity: desktop + phone. |

The final expiry test installs its clock before application timers, following
[Playwright’s clock contract](https://playwright.dev/docs/clock). Installing it
late left existing timers uncontrolled in an earlier failed test. Navigation
assertions use a consistent bounded 15-second budget for local route compilation.
No production timeout, permission assertion or OTP safeguard was weakened.
Latest desktop/phone list and entry captures were inspected. Server log:
`.local/tracking-email-session/dev-server.log`; preview remains on port 3100.

## Review and rollout

Preview: http://127.0.0.1:3100/track. Keep local services running for owner review.
Explicit visual acceptance remains pending under AGENTS.md / NR-13. Then run
full release gates and rehearse pending migrations 102–114 from a fresh protected
backup before any approved hosted rollout. Migration first, app second; rollback
app first, retain all shipment/recipient/history data and compatibility helpers.
An app rollback restores the old code-based UI; providers retain the existing
code for handoff if customers have received the newer code-free invitation.
Local Mailpit proves the visible email workflow here, not fresh hosted SMTP delivery.
