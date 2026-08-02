---
id: FEAT-UIX-001
title: Icon-first low-language member experience
related_ids: [BASE-FE-001, FEAT-APP-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-FLT-001, FEAT-NET-001, FEAT-PRV-001, FEAT-TRK-001, FEAT-VER-001, FEAT-BIL-001]
problem: Members with limited English or limited experience using business software must be able to recognize the next action without reading long instructions or hunting through inconsistent layouts.
behavior: Every workflow uses a consistent icon-first visual language, short action labels, task-shaped grouping, visible ordered steps where decisions are sequential, touch-sized controls, visible state, and reversible navigation while retaining essential safety, privacy, and freight terminology.
contracts: [IconAction, TaskHeader, OrderedTaskStep, VisualChoice, TouchTarget, FactBlock, ReversibleDetail, EssentialHelpText]
observability: [ui_audit_unlabeled_control_count, ui_audit_overflow_count, browser_flow_error_count]
rollout: Apply shared primitives before page-specific simplification; retain required privacy and business-rule explanations; validate all member personas at desktop and mobile sizes and roll back presentation without changing domain state.
---

# Icon-first low-language member experience

### Scenario: actions are recognizable before their words are read

Given a member opens any non-admin workspace page\
When a navigation item, primary command, secondary command, or state-changing control renders\
Then it uses a familiar Lucide icon with a short visible label\
And destructive or unfamiliar icon-only controls retain an accessible name and hover title\
And the same command uses the same icon and label across pages.

### Scenario: each page exposes one obvious task hierarchy

Given a member opens a Board, list, editor, composer, or detail\
When the page renders\
Then the title is paired with a task icon\
And the primary action is visually strongest\
And related choices are grouped in the order the member needs them\
And supporting prose is omitted unless it explains a material rule, privacy boundary, or consequence.

### Scenario: operational editors ask only current decisions first

Given a member opens a frequently used operational editor\
When its first screen renders\
Then identity and current state are summarized compactly\
And required decisions appear in the order the member naturally makes them\
And uncommon policy, evidence, and future-planning controls share one clearly labeled optional area\
And a second summary card does not repeat values already visible beside the controls.

### Scenario: numbered steps represent a real sequence

Given a member, fleet owner, administrator, or support team member performs a multi-decision task\
When the editor, filter sheet, assignment control, or review action renders\
Then numbered headings follow the order in which the decisions must be made\
And required or commonly changed choices are never hidden inside Additional options\
And optional evidence may remain compact only after the operational decisions it supports\
And independent lists, tabs, and status summaries are not numbered as if they were a sequence.

### Scenario: primary navigation contains daily work

Given a Business, fleet transporter, or driver opens the workspace\
When primary navigation renders\
Then it prioritizes daily freight, fleet, Directory, and network destinations\
And occasional profile, verification, plan, and account controls are grouped under More\
And the same destination is not repeated in both the primary navigation and the More page.

### Scenario: discovery controls do not crowd the results

Given a member opens the Shipment Board, Truck Board, or Directory\
When discovery controls render\
Then the result list remains the dominant page content\
And advanced search and matching choices open in one consistent dismissible filter sheet\
And the sheet groups geography or matching first, operational requirements second, and refinements last\
And applying choices closes the sheet and shows a compact summary of active values\
And the member can reopen, change, or clear those choices without losing the current Board context.

### Scenario: forms favor visual choices

Given a member chooses an account type, load type, movement scope, visibility, duty state, or truck configuration\
When the available choices render\
Then each choice is shown as a stable visual option with an icon or representative image\
And the selected state is visible without relying on English text alone\
And long option lists remain searchable rather than fully rendered.

### Scenario: mobile controls remain easy to touch

Given a member uses a supported narrow viewport\
When navigation, choices, fields, and commands render\
Then primary interactive targets are at least 44 CSS pixels in both dimensions\
And fixed navigation does not cover form actions\
And labels wrap without overlapping icons, values, or adjacent controls\
And no horizontal page scrolling is required.

### Scenario: drill-down navigation is reversible

Given a member opens a profile, load, truck, capacity, pooled load, tracking detail, or creation composer\
When the page renders\
Then a visually consistent Back control appears near the task title\
And it returns to the recorded previous workspace page when safe\
And returning pops the existing history entry instead of adding a second entry that loops between the two pages\
And a direct deep link falls back to the correct parent list or Board.

### Scenario: essential text remains available

Given a workflow involves location privacy, visibility, payment limitation, verification evidence, tracking obligations, or agreement consequences\
When the relevant choice renders\
Then one short explanation remains adjacent to that choice\
And decorative, repetitive, or feature-marketing prose is removed from the operating workspace\
And freight abbreviations retain a compact first-use explanation where misunderstanding could change the load.

## Contract ownership

- Shared UI: `PageHeader`, `AppShell`, common action and choice styles
- Member pages: `/app/**` excluding `/admin/**`
- Public entry: `/login`, `/apply`, and secret-code tracking
- Tests: `tests/e2e/smoke.spec.ts` and `scripts/ui-audit.mjs`
