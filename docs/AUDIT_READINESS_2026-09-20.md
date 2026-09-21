# Chat and fixture readiness follow-up

Scope: FEAT-GST-001 and BASE-DEP-001; CI-OBS-001/002 from the recorded audit.
No database migration or message-authorization change is introduced.

## Plan and evidence

- [x] Reproduce the chat initialization defect with client scripts withheld.
  The server-rendered button was enabled before its click handler existed;
  the new regression failed at the disabled-state assertion before the fix.
- [x] Keep the launcher disabled until hydration, then verify its first click.
  Fourteen focused desktop/phone cases passed with retries disabled, including
  all five previously retrying chat/history cases on each viewport. Tests include
  real local guest/staff conversations and attachment/history access; the focused
  submission-failure and delayed-read tests intentionally mock their HTTP boundary.
- [x] Add bounded local schema-read diagnostics before fixture reset/import.
  Four unit tests cover safe error-code reporting, remote-target refusal, malformed
  schemas and transport failures. No raw messages, credentials or retries are used.
- [x] Complete quality (304 unit tests, specs/source and TypeScript) and production
  build. The actual local schema read returned 59 definitions without an import.
- [x] Complete exact-commit remote CI: e52a2a3 / 35519622994 and monitoring
  follow-up 6b3d6cd / 35526988445 passed validate, container and E2E; each full
  browser suite passed 160 cases without retries, with eight opt-in skips.
- [ ] Promote only after the independent production security and release gates pass.

CI-OBS-002 is closed by the reproduced defect, regression, local no-retry evidence
and two successful complete remote suites without retries. Earlier retry results
remain historical evidence. The first enabled click now works with a deliberately
delayed conversation response. Playwright's [hydration guidance](https://playwright.dev/docs/navigations#hydration)
describes this failure mode and the readiness control.

CI-OBS-001 remains open as to the cause of the historical HTTP 500: its response
code was not captured. The new diagnostics preserve HTTP status and an allowlisted
code shape only. A persistent authorization, schema or startup failure still stops
setup; importing fixtures is never replayed automatically. The next recurrence
must be diagnosed from that code before adding retries. Owner: CI maintainer.

Rollback is an application/test-tooling rollback with no stored-data changes.
The required release/security gates and existing production containment remain
independent; these results alone do not establish a production deployment.
