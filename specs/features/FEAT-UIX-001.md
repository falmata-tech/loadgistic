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
And the homepage itself contains an always-accessible map search, dismissible detailed filters, List/Map controls, and the capacity feed rather than a preview plus a second Capacity page\
And the interactive Map is selected before the secondary List view\
And location permission is requested as soon as the Board becomes interactive so nearby supply can be shown without another setup step\
And pointed pins with visible truck artwork, Empty or Partial labels, and a circular green-to-red available-space meter let visitors scan vehicle type and current space before opening details\
And the map key stays visible while contextual map summaries appear only on hover or focus above the related marker\
And Capacity, Providers, Track, About, provider Login, and provider Sign up are easy to find\
And no account prompt blocks browsing, filtering, map view, provider details, or contact methods the provider made public.

### Scenario: actions are recognizable before their words are read

Given any supported visitor or member screen\
When navigation or a command renders\
Then it uses a familiar icon with a short visible label\
And destructive or unfamiliar icon-only controls retain an accessible name and title\
And the same command uses the same icon and label across pages.

### Scenario: public copy speaks to the market

Given a visitor opens the homepage, About, provider Directory, provider page, Track, login, or provider signup\
When headings, supporting copy, labels, and calls to action render\
Then they describe a clear customer or transport-provider benefit in professional freight language\
And they avoid implementation terms, internal data-model names, test language, or awkward negative product rules\
And required privacy, responsibility, verification, and due-diligence statements remain direct and easy to find.

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
And one summary shows how the truck appears publicly together with the same current radius or corridor map and up to two provider-level regular corridors\
And the privacy-obscured truck-area marker remains obvious above overlapping capacity circles and routes\
And each summary section has a focused Edit action that opens only that section\
And regular-corridor controls live inside that same capacity console rather than in a second planning block\
And Edit current capacity opens the full ordered current-capacity workflow\
And location refresh and privacy accuracy remain direct controls under the map rather than opening the editor.

### Scenario: Tracking uses one ordered status control

Given a provider or assigned Driver opens an active Tracking session\
When status controls render\
Then Loading, En route, Unloading, Complete, and Problem are visible together in that order\
And only currently valid actions can be selected\
And one optional photo field appears only after Loading, Unloading, or Problem is selected\
And provider navigation calls the workspace Tracking rather than Customer shipments.

### Scenario: discovery controls do not crowd results

Given a visitor opens the Capacity Board or provider Directory\
When discovery controls render\
Then the feed remains dominant\
And one compact search bar blends into the map while advanced choices open from a Filters button in one dismissible modal\
And applying a filter closes the sheet and shows compact active values\
And List and Map are prominent peer views without creating a map in every card\
And the List uses two balanced cards per row on wider screens and one per row on narrow screens\
And regular-corridor endpoints are always visible on each result card rather than hidden behind a disclosure.

### Scenario: Drivers reach supply without leaving the workspace

Given an authenticated Driver uses the dashboard\
When workspace navigation renders\
Then Capacity market opens the same Map-first public capacity experience inside the dashboard, with a two-column desktop list and one-column mobile list as the secondary view\
And a clearly labeled Exit dashboard action returns to the public Capacity Board without signing the Driver out.

### Scenario: mobile controls remain easy to touch

Given a supported narrow viewport\
When navigation, choices, fields, cards, and commands render\
Then primary interactive targets are at least 44 CSS pixels in both dimensions\
And fixed navigation does not cover actions\
And labels do not overlap icons or values\
And map detail cards remain compact, responsive, and fully visible without their own scrolling region\
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

### Scenario: verification proves changed behavior rather than control presence

Given a location, selection, filtering, or persistence interaction changes\
When browser verification runs\
Then it asserts the resulting marker, cluster, coordinate state, server-visible result, or navigation state\
And a visible button alone is not accepted as proof that the interaction works\
And changed-screen review is used during iteration while the full multi-role screenshot sweep remains a release-wide regression gate.

## Contract ownership

- Shared UI: public header, provider shell, page headers, actions, choices, cards, filters, and map state
- Public pages: homepage, Capacity, Providers, Track, About, Login, and provider Sign up
- Provider pages: `/app/**` excluding `/admin/**`
- Tests: E2E and visual audit
