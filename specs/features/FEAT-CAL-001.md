---
id: FEAT-CAL-001
title: Week-first date selection
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-MOB-001, FEAT-TRK-001]
problem: Date entry should make weekdays and dates clear without typing or switching calendars.
behavior: All web and native date selection starts with a Monday-to-Sunday week, allows previous and next periods, and offers a month view. Gregorian dates remain the storage authority; Ethiopian dates are secondary labels only when the runtime supports an accurate Ethiopic calendar.
contracts: [DateOnlySelection, DateCalendarPresentation]
observability: [calendar_runtime_capability]
rollout: Local visual review and focused boundary tests before release. No persistence migration; revert controls without rewriting dates.
---

# Date selection

Given a user opens any date picker on web or native
When no date has been selected
Then the current local week is shown Monday to Sunday with weekday names and Gregorian day numbers
And selecting a day submits its unchanged Gregorian YYYY-MM-DD value
And changing week or month never silently chooses a date.

Given a selected date, minimum date or maximum date
When the user navigates between week and month views
Then selection is retained and disallowed dates cannot be submitted
And empty optional dates can be cleared while required controls retain form validation
And native Back and web Escape close the picker without changing the saved selection.

Given a runtime with ICU Ethiopic-calendar support
When a Gregorian date is displayed
Then its Ethiopian day appears under the Gregorian day and is explicitly identified as Ethiopian
And date-only conversion uses UTC so device timezone and daylight-saving changes do not move the chosen date
And Ethiopian New Year, Pagumen's fifth/sixth day, Gregorian leap day and year boundaries are verified.

Given unsupported or incorrect Ethiopic formatting
When dates are displayed
Then the primary Gregorian calendar still works and no fabricated Ethiopian label is displayed.

Tests: `tests/date-calendar.test.mjs`, focused web/native picker interaction checks.
Reference: [ICU calendar services](https://unicode-org.github.io/icu/userguide/datetime/calendar/).
