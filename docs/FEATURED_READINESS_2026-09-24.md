# UI copy and Featured readiness

Scope: Loadgistic only. Local implementation and focused verification; not deployed.
Contracts: FEAT-LUX-001, FEAT-FTR-001, FEAT-LNG-001.

## Corrected

- Removed the static “Ethiopia capacity · East Africa view” map caption. It had no
  control or coverage meaning. Map filters, gestures and real freshness labels remain.
- Removed repeated admin/profile headings, static operating advice and internal
  projection/credential wording. Transport requests are distinct from general help.
- Corrected obsolete purple-location guidance to blue, and kept the approximation
  and direct-confirmation caveats.
- Removed redundant Featured card labels. A scheduled current slot now says
  Featured now; a TikTok destination no longer claims a verified live broadcast.
- Moved longer public Featured guidance into a disclosure. Browser testing caught
  mobile CSS hiding the paragraph after expansion; corrected and reran it.
- Added real private run status, seven-day readiness, remaining pair counts and
  reasons for missing days. Manual settings, day editing and sponsors are distinct.
- Verified real local Prepare, draft, publish and public projection. The automatic
  algorithm and persistent no-repeat history are preserved.

## Limits staff should know

1. Featured now has its own default-off staff permission, approved by the owner.
   Admin must explicitly grant it; Support and Brokerage staff do not inherit access.
2. A weekday type can have an empty programme after it finishes its round while
   other types still have unseen pairs. This is existing fairness policy, not a
   failed job. The UI now explains it; do not change it silently to fill every day.
3. Saved manual drafts block automatic preparation for that date until staff
   publish/edit them. There is no return-to-automatic button for a saved day.
4. Eligibility changes can leave saved selections needing replacement. The UI
   flags them; the worker deliberately preserves saved days.
5. The candidate picker returns eligible choices, not a complete diagnostic list
   of every excluded truck. Check the underlying truck/driver for missing choices.
6. The hosted 15-minute job is configured in source, but its current production
   execution has not been verified in this local pass. Observe an unprompted
   timestamp advance after migration/app rollout before claiming automatic readiness.
7. New wording has entries in all four non-English catalogs. Native-language
   fluency and complete app-wide translation are not established by these checks.

Staff instructions: [Running Featured](operations/FEATURED_PROGRAMME.md).

## Evidence

- Migrations 105–106, their negative SQL tests and catalog security were checked
  in rollback rehearsals, then applied locally only. Independent permissions,
  revocation, combined grants, changed truck type and narrow settings have database
  checks. The real desktop/phone grant/edit/revoke workflow also passes.
- `tests/sql/featured-random-rounds.sql` passes through the wrapper: no early
  repeats, retries, saved manual days, eligibility changes and permission denial.
- Thirty-three focused unit tests pass: status, truck themes/UI, worker and localization.
- Six desktop/phone browser cases pass in `featured-operations-review.spec.ts`:
  real manual draft/publish, automatic Prepare, public map/Featured, admin/member
  dashboards and transporter profile controls. Synthetic future days are cleaned;
  existing days and accounts are retained.
- Source/spec checks and TypeScript pass. Full release gates await owner review.
- Screenshots: `artifacts/featured-readiness-final-20260924/` and
  `artifacts/ui-copy-polish-20260924/`. Local logs: `.local/featured-review/`.

Review at http://127.0.0.1:3100 and http://127.0.0.1:3100/admin/featured.
No production writes, hosted settings changes, external email or deployment in this pass.

Latest owner clarifications: staff responsibilities combine; Featured never
removes separately assigned Support, Brokerage, Billing or customer access.
Transport requests use a callback form/receipt and Brokerage follow-up, not chat.
The shared public panel incorrectly reused live-help availability wording for
requests; that header and its chat-specific close label are now separated.


Callback clarification evidence: the real public-submit-to-private-follow-up and
recovery cases pass on desktop and phone (`transport-requests.spec.ts`), including
no help-conversation POST, no email, duplicate safety, offline notes and stale-write
recovery. Request opening alongside an existing support conversation also passes
on both sizes without marking help messages read. Final callback screenshots are
in `artifacts/featured-callback-final-20260924/`.


Final staff evidence: both cases in `featured-team-permission.spec.ts` pass, with
email-code login through local Mailpit, separate and combined responsibilities,
settings/Prepare, draft/publish, sponsor save/disable and revocation. Captures:
`artifacts/featured-permissions-verified-20260924/`. Final public-panel cases pass
across phone and desktop (desktop rerun: `artifacts/callback-dock-verified-20260924/`).
Open/Private drawer cases pass; the initial mobile city-search stall passes an
unchanged controlled recheck (`artifacts/map-drawer-verified-20260924/`).
Earlier dev-readiness/cleanup failures remain in the local logs; they are not
counted as passes. Full quality/build/CI and production checks remain unrun.


## Official hours and manual editing — subsequent owner change

Owner confirmed 08:30–12:00 EAT, at most eight showcases and four two-minute
mentions. See the timetable and staff procedure in `operations/FEATURED_PROGRAMME.md`.
Migration 107 is applied only locally. The new window is enforced in domain and
SQL, with historical read compatibility, protected manual days and no pair redraw.

Evidence: 18 focused unit tests; `featured-broadcast-window.sql`, existing
`featured-random-rounds.sql` and `featured-team-permission.sql`; final catalog check.
Four browser cases pass desktop/phone actual draft/publish, native JSONB manual
reload and resave, reorder-with-fixed-times, sponsor naming and public saved hours.
The pre-existing manual reload bug is repaired, not deferred. Earlier failures
remain in local logs: stale dev compilation, the discovered reload bug, and test
fixtures/assertions corrected before the final pass. No failing run counts as
completion evidence.

Final screenshots: `artifacts/featured-broadcast-complete-20260924/` (editor) and
`artifacts/featured-broadcast-public-20260924/` (public). Protected rehearsal/logs:
`.local/featured-broadcast/`. Cleanup leaves zero synthetic days/sponsors; baseline
17 days, 106 slots and 100 rotation-history rows remain. Dev preview stays on port 3100.
Owner visual approval, complete release gates, migration review and deployment are
still open; no production scheduling or TikTok execution is claimed.


## Sparse category day — owner question, September 24 (Chicago)

Read-only local inspection after midnight September 25 in Ethiopia found one
Friday medium-duty pair, versus seven Thursday light-duty pairs. Friday has nine
currently eligible distinct driver/truck pairs: eight have rotation-round-1
selections dated September 18, and the ninth is saved for September 25. This is
consistent with category days plus exact-pair no-repeat rounds, not a missing card.
The public live page inspected at that time still showed eight and 07:30–09:00 EAT;
it has not received the current local broadcast changes.

Open programme decision: a one-pair day is too sparse for 08:30–12:00. Do not repeat
already selected pairs or silently mix categories to fill eight slots. The owner
must choose any category/pacing change; preserve the approved no-repeat rule.
Also distinguish a saved selection from confirmed on-air appearance—the current
rotation history records scheduling, not proof that TikTok actually featured it.
No roster, schedule or selection history was changed during this investigation.


Follow-up after owner specified Thursday/local: the actual public projection for
September 24 returns seven eligible cards, with none of its seven slots filtered
out. A fresh Chicago-time browser renders Friday September 25, Medium-duty, one
card, and highlights Friday in Week. The Week row is a category calendar, not date
navigation. Could not reproduce a Thursday heading with one card; do not claim the
owner's exact earlier screen is explained conclusively without that state.
Capture: `artifacts/provider-support-20260924/featured-count-review.png`.


## Owner-requested local demo additions — September 24

Added 14 new, distinct company-driver/truck pairs under the eight verified local
demo fleets: vans 1, pickups 1, light 1, medium 7, courier 4. New emails use the
owner-approved Gmail plus-alias pattern; exact mappings are protected in
`.local/featured-demo-inventory/receipt.json`. No default CI seed includes the real
inbox. No production identities, fabricated document reviews or capacity signals
were created. Auth IDs, deterministic truck IDs and local-only target are recorded.

Current category pools: mini 61; all six other categories 16. The original global
round is unchanged while an explicit independent-category-round decision is pending.
A rollback rehearsal then filled only saved local automatic Friday (+7) and Sunday
(+4) with these newly eligible, unselected pairs. Existing slot/history rows and
all past/manual days were compared and preserved. Friday–Monday now have eight
saved pairs each. The one-time operation is not a new automatic top-up policy.

This inventory meets a minimum of two eight-pair subsets per category, but the
current global round still prevents repeat-filled future weeks while minis remain
unselected. Do not claim the two-week ongoing schedule is solved until the owner
chooses independent category rounds or balanced global inventory and the resulting
rotation is tested. Existing manual/historical days must remain untouched.
