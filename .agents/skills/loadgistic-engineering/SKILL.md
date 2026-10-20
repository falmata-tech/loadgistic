---
name: loadgistic-engineering
description: Implement or refactor Loadgistic web, Expo, API or database behavior, and improve its development tools or engineering workflow. Use for everyday code changes and general setup housekeeping. Excludes explanations without changes, other apps and release execution.
---

# Loadgistic engineering

Resolve the repository from this skill's location. The IDE can show Suqpage files
while the task is Loadgistic; do not infer the target from an open tab. Read the
active task in `docs/PROGRESS.md`, applicable AGENTS instructions and Git status.
Load only relevant specs and source, keeping current product decisions separate
from historical code and planned capabilities.

Before changing behavior, identify affected inputs, permissions, persistence,
public/private projections and user-visible outcomes. Keep tests and fixture
creators in the same change. A new vehicle is Draft and unassigned until explicit
commands succeed; do not infer current rules from older test names. Reuse current
application ports, guarded SQL and synthetic fixture factories instead of making
UI-only shells or a second persistence model.

Choose evidence by the changed boundary:

- Pure logic: focused input/output and negative cases.
- API/database/privacy: authoritative saved outcomes, role/tenant denial,
  unchanged state after rejection, and current local Supabase target.
- UI: actual Chrome desktop/phone tasks and the affected Expo surface; preserve
  navigation, loading/error recovery and saved state. Follow existing visual
  review requirements without inventing additional approvals.
- Native capabilities: installed-app/device evidence when needed; web preview
  alone cannot prove phone location, notifications or permissions.
- Scripts/CI: `npm run check:workflow`, bounded failure tests and elapsed time.
  Never import an operational script merely to discover what it does.

Inspect package/config files before selecting commands. Root and Expo tooling
have distinct runtime requirements; keep their ports, caches and processes
separate from other projects. Avoid concurrent heavy gates on the Mac. Use focused
checks during iteration and the complete existing gate when due, preserving its
security, scale and failure checks.

For housekeeping, consult the setup assessment in `docs/AGENT_LESSONS.md`.
Measure recurring friction, improve the smallest useful cause, and record actual
results and limits. Prefer existing free tooling and clear contracts over broad
rewrites, paid services, duplicated scripts or more universal rules. Keep larger
unverified improvements separate from the current release. After interruption,
resume completed evidence rather than reconstructing the task from chat.
