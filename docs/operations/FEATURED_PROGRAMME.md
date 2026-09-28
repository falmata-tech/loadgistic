# Running Featured

FEAT-FTR-001 · local review version, 2026-09-24. Production rollout is pending.

Open **Admin → Featured** (`/admin/featured`). Admins can use it, and can grant a separate **Featured** responsibility at
**Admin → Support → Platform team** when adding or editing a member. It is off by
default. For Featured-only staff, clear the other responsibilities, including
Support. The member signs in with their email code and lands in Featured. They
can manage selection settings, days and sponsors without accounts, billing,
Support or Brokerage access. Revoking Featured or suspending the account blocks
further Featured changes. Permissions combine: enable Support, Brokerage, Billing
or other responsibilities for the same person when they also need that work.
Removing Featured does not remove their other grants. Do not give someone broad administrator access for this task.

## Normal operation

Leave **Selection settings → Automatic** selected. The scheduled worker checks
every 15 minutes and prepares missing days for today and the next six Ethiopia
dates. No visitor needs to trigger it and staff do not need to press Prepare daily.

Monday through Saturday each have a truck type; Sunday is Mixed trucks in the
September 25 preview, replacing courier cars. Eligible truck-and-driver pairs are drawn randomly,
with no automatic repeat until all currently eligible pairs have had a turn.
The daily target is an upper limit of eight (default eight); fewer eligible selections receive longer slots
within **08:30–12:00 EAT**. This is a rolling week of subsets, not every truck each
week. Sponsorship does not buy a place in the truck draw.

With eight showcases, four two-minute mentions leave 202 minutes for trucks:

| Time (EAT) | Programme |
| --- | --- |
| 08:30–09:22 | Two showcases, 26 minutes each |
| 09:22–09:24 | Sponsor mention |
| 09:24–10:14 | Two showcases, 25 minutes each |
| 10:14–10:16 | Sponsor mention |
| 10:16–11:06 | Two showcases, 25 minutes each |
| 11:06–11:08 | Sponsor mention |
| 11:08–11:58 | Two showcases, 25 minutes each |
| 11:58–12:00 | Closing sponsor mention |

Fewer than four showcases reserve one mention per showcase. A day with no eligible
pairs has no made-up programme. Mentions use active sponsors for that date in saved
position order; when fewer sponsors exist, their names cycle through the mentions.
With no sponsor, the interval is a programme pause. Sponsor cards can show up to
five sponsors, but four mentions do not promise spoken airtime to all five; staff
must choose the order/agreements accordingly. Scheduling never starts TikTok or
confirms that a spoken mention actually happened.

The overview shows the last check, seven upcoming days, eligible pairs and those
still waiting. **Latest selection check succeeded** describes that check, whether
scheduled or manually requested. It does not prove the scheduler will run again.
After rollout, verify the timestamp advances without pressing Prepare. A check
older than 45 minutes is marked as needing attention.

## When a day needs attention

| Status | Meaning and action |
| --- | --- |
| Published | A saved public day has valid selections. No daily action needed. |
| Draft — not public | Someone saved a manual draft. Open the day, finish it and publish. Automation will not overwrite it. |
| No eligible trucks for this type | Check truck assignment, active driver/provider and public eligibility. Adding a private or unavailable candidate manually does not bypass eligibility. |
| Waiting for other trucks to have their turn | This type has finished its current round. Other types still have unseen pairs. Leave it waiting to preserve no-repeat fairness, or make an intentional manual selection. |
| Selected truck or driver needs attention | An existing selection is no longer eligible. Open the day, replace it and publish again. Saved days are not silently redrawn. |
| Not prepared yet | In Automatic mode, use Prepare upcoming days once. If it remains missing, inspect the scheduled worker and eligibility. |

An empty day can be legitimate under the current global no-repeat rule. In the
local review, five of seven days were ready; two types were waiting. These are
local fixture results, not production counts. Sunday now draws from all supported freight types. Allowing early repeats or
changing the other weekday themes still needs a separate decision.

## Make a manual change

1. Select a day in the overview, or open **Review or edit a day**, choose its date
   and press **Load day**.
2. Add eligible trucks and drivers; remove or reorder selections as needed.
3. Leave slot timing on Automatic unless specific start/end times are needed.
   The timing switch is separate from automatic truck selection. **Manual** starts
   with those generated slots; edit start/end times and inspect the timeline. Gaps
   before, between and after trucks become mentions, at most four and two minutes
   each. Keep the full 08:30–12:00 window covered. Schedule sponsors under
   **Manage sponsors**; truck selection does not create sponsorship agreements.
4. Save draft to keep the day private; **Publish this day** makes it public.
5. Open the public programme to confirm the published presentation.

Saving a day makes it a protected manual day, even if slot timing is Automatic.
Switching platform selection back to Automatic does not replace existing drafts
or published days. There is currently no self-service “return this saved day to
automatic selection” action. Edit/publish the day rather than deleting records.

Sponsors and optional video links are separate. A current showcase slot does not
mean a video broadcast is live, or that a truck is currently available. Staff
still arrange any actual broadcast outside Loadgistic.

## Release and recovery

Migrations 105 and 106 provide the prerequisite status and permission commands. Migration 107 adds the new window and ceiling. They add private run status, a bounded overview and the default-off team
permission around the existing selection algorithm; no roster reset.
Before hosted application, follow the normal target, backup, restore and reviewed
artifact gates. After rollout, observe a scheduled status update and check the
public programme plus one bounded manual draft/publish workflow.

Migration 107 retimes only future AUTO-selected/AUTO-timed days (strictly after
Ethiopia's current date), preserving pairs and history. Today, historical days and
manual days keep their saved hours. The editor explains how to reset a legacy
manual timetable explicitly. Oversized future automatic rosters stop migration
for review, rather than being silently truncated.

Coordinate migration 107 with the compatible app: the older app accepts only the
old hours and cannot be used unchanged after rollout. Retain protected pre-change
records/function definitions and use a reviewed rollback artifact that accepts both
windows; do not restore data over newer staff edits. No hosted rollout occurred
in this local review.

For an application rollback, keep migrations 105–106 and the roster/history intact;
the existing generator command remains compatible. Do not delete selection
history, disable RLS or overwrite days to make the status look healthy. Investigate
failed/stale jobs with sanitized operational logs. A failed generation rolls back
its partial roster writes and records only a safe failure status.

### Vehicle catalogue rollout (migration 109)

Courier cars/motorcycles cannot be registered or selected. The database rejects
new retired configurations while preserving historical rows. Sunday uses the
mixed-truck theme; Mon–Sat and the global no-repeat rule are unchanged.
Before a hosted release, inspect upcoming saved courier days and demo inventory,
prepare their exact reviewed conversion and backup, then coordinate app/migration
publication. A saved courier day will not match the new Sunday theme. Migration
109 deliberately does not rewrite real vehicles or staff-managed rosters.

Only local demos were converted on September 25: 16 vehicle IDs retained, all
assignments/selection history preserved, 12 existing capacity signals unchanged,
four new demo signals added. Upcoming automatic Sunday retained its eight pairs.
Rollback must use the protected local before-snapshot and exact changed fields;
never restore whole tables over later edits. No hosted conversion or release.
