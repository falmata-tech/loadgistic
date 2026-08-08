---
id: FEAT-UIX-001
title: Low-friction public discovery and provider operations
related_ids: [BASE-FE-001, FEAT-APP-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-FLT-001, FEAT-PRV-001, FEAT-TRK-001, FEAT-VER-001, FEAT-BIL-001, FEAT-LST-001]
problem: Capacity seekers need immediate, understandable discovery while transport providers need simple mobile-first controls that represent their work professionally.
behavior: Public and provider workflows use a consistent icon-first visual language, short labels, strong task hierarchy, touch-sized controls, explicit safety text, reversible navigation, and list/map continuity without requiring seeker registration.
contracts: [IconAction, TaskHeader, OrderedTaskStep, VisualChoice, TouchTarget, FactBlock, ReversibleDetail, EssentialHelpText, DiscoveryViewState]
observability: [ui_audit_unlabeled_control_count, ui_audit_overflow_count, browser_flow_error_count, public_discovery_action]
rollout: Apply shared primitives before page-specific simplification; retain privacy and verification explanations; validate public, provider, Driver, support, and admin views at desktop and mobile sizes.
---

# Low-friction interface

### Scenario: public value is usable immediately

Given a capacity seeker opens Loadgistic\
When the homepage renders\
Then real public capacity is the dominant useful content\
And Capacity, Providers, Track, About, provider Login, and provider Sign up are easy to find\
And no account prompt blocks browsing, filtering, map view, provider details, or contact methods the provider made public.

### Scenario: actions are recognizable before their words are read

Given any supported visitor or member screen\
When navigation or a command renders\
Then it uses a familiar icon with a short visible label\
And destructive or unfamiliar icon-only controls retain an accessible name and title\
And the same command uses the same icon and label across pages.

### Scenario: each page exposes one obvious task hierarchy

Given a visitor or provider opens a feed, map, editor, composer, or detail\
When the page renders\
Then the title and primary action are visually clear\
And related choices follow the order needed\
And supporting prose remains only when it explains a material rule, privacy boundary, or consequence.

### Scenario: capacity editor collapses into a useful summary

Given a provider successfully saves capacity\
When the save completes\
Then the editor collapses after a visible success message\
And one summary shows how the truck appears publicly together with the same current radius or route map\
And each summary section has a focused Edit action that opens only that section\
And Edit all opens the full ordered workflow.

### Scenario: discovery controls do not crowd results

Given a visitor opens the Capacity Board or provider Directory\
When discovery controls render\
Then the feed remains dominant\
And advanced choices open in one dismissible filter sheet\
And applying a filter closes the sheet and shows compact active values\
And List and Map are prominent peer views without creating a map in every card.

### Scenario: mobile controls remain easy to touch

Given a supported narrow viewport\
When navigation, choices, fields, cards, and commands render\
Then primary interactive targets are at least 44 CSS pixels in both dimensions\
And fixed navigation does not cover actions\
And labels do not overlap icons or values\
And no horizontal page scrolling is required.

### Scenario: detail navigation is reversible

Given a visitor or member opens a provider, capacity, truck, shipment, tracking, or creation detail\
When the page renders\
Then a consistent Back control returns to safe browser history when available\
And a direct deep link falls back to the correct parent\
And returning to public discovery restores filters, appended results, view mode, and scroll position when possible.

### Scenario: essential text remains available

Given a workflow involves location privacy, public contact visibility, verification evidence, tracking access, review disputes, or agreement consequences\
When the relevant choice renders\
Then one short explanation remains adjacent\
And decorative repetition is removed\
And public warnings tell users to check current documents and authority themselves.

## Contract ownership

- Shared UI: public header, provider shell, page headers, actions, choices, cards, filters, and map state
- Public pages: homepage, Capacity, Providers, Track, About, Login, and provider Sign up
- Provider pages: `/app/**` excluding `/admin/**`
- Tests: E2E and visual audit
