---
id: BASE-FE-001
title: Frontend interaction and presentation base
related_ids: [BASE-BE-001, BASE-DEP-001]
problem: Users need a consistent, accessible, mobile-first interface over authorized server behavior.
behavior: Server-rendered pages and progressively enhanced forms expose only actions available to the current role and record scope.
contracts: [PageViewModel, MutationForm, FlashResult, AuthenticatedNavigation]
observability: [route_status, mutation_result, server_error_log]
rollout: Validate responsive and role-based E2E paths before releasing changed screens.
---

# Frontend base specification

## Principles

- Use Next.js App Router server components by default.
- Keep mobile-first flows short and preserve usable HTML without client-side state.
- Render actual record data or verified inputs; never invent metrics.
- Use ETB or Quote Requested and never add USD marketplace framing.
- Hide actions the user cannot perform, while retaining server-side authorization as the authority.

## Base scenarios

### Scenario: authorized form mutation

Given an authenticated user can perform a documented command\
When the user submits the matching form\
Then the route handler invokes the application service\
And the user sees a success or safe domain error message.

### Scenario: narrow viewport

Given a supported page is viewed at a mobile viewport\
When navigation and primary actions render\
Then the primary workflow remains visible and operable without horizontal scrolling.

## Contract details

`PageViewModel` contains only authorized, display-safe fields. `MutationForm` maps one user intent to one server command. `FlashResult` exposes a non-sensitive success or error message. `AuthenticatedNavigation` derives links from the current role.

## Required verification

- `tests/e2e/smoke.spec.ts`
- Feature-specific browser scenarios for changed workflows
- `npm run typecheck`
- `npm run build`
