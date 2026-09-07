---
id: FEAT-UIX-001
title: Low-friction public discovery and provider operations
related_ids: [BASE-FE-001, FEAT-APP-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-FLT-001, FEAT-PRV-001, FEAT-TRK-001, FEAT-VER-001, FEAT-BIL-001, FEAT-LST-001, FEAT-MKT-001, FEAT-FTR-001, FEAT-SPN-001, FEAT-ADM-001, FEAT-SUP-001]
problem: Capacity seekers need immediate, understandable discovery while transporters need simple mobile-first controls that represent their work professionally.
behavior: Public, provider, support, and administration workflows use a confident professional freight voice, consistent icon-first visual language, short labels, strong task hierarchy, touch-sized controls, concise safety text, reversible navigation, and list/map continuity without requiring seeker registration.
contracts: [LoadgisticBrandAsset, ProductVoice, PublicAppShell, SharedProviderTemplate, IconAction, TaskHeader, OrderedTaskStep, VisualChoice, TouchTarget, FactBlock, ReversibleDetail, EssentialHelpText, DiscoveryViewState]
observability: [ui_audit_unlabeled_control_count, ui_audit_overflow_count, browser_flow_error_count, public_discovery_action]
rollout: Apply shared primitives before page-specific simplification; retain privacy and verification explanations; validate public, provider, Driver, support, and admin views at desktop and mobile sizes.
---

# Low-friction interface

### Scenario: public value is usable immediately

Given a capacity seeker opens Loadgistic\
When the homepage renders\
Then real public capacity is the dominant useful content on the default Market route\
And one concise workspace welcome leads directly into the Truck Market while persistent navigation opens Daily Featured Trucks on `/featured`\
And detailed explanatory storytelling is linked through About rather than repeated between homepage tools\
And the homepage itself contains an always-accessible truck search, dismissible filters, location controls, and the interactive Truck Map rather than separate listing pages\
And no ranked Truck List competes with geographic discovery\
And location permission is requested as soon as the Board becomes interactive so nearby supply can be shown without another setup step\
And pointed pins with visible truck artwork, a complete green Empty ring, or a complete yellow Partial ring let visitors scan vehicle type and status before opening details without interpreting a percentage meter\
And the map key stays visible while contextual map summaries appear only on hover or focus above the related marker\
And Open capacity, Private capacity, Track, Featured, About, and transporter account access are easy to find while a new identity continues to provider setup only after proof\
And no account prompt blocks browsing, filtering, map view, transporter details, or contact methods the transporter made public.

### Scenario: public visual system stays light

Given a visitor moves between public pages\
When layout and color are rendered\
Then the base uses warm white or off-white surfaces, generous spacing, and restrained borders\
And public workspace titles use a compact application scale that leaves the primary tool visible rather than an oversized editorial scale\
And the shared brand palette uses deep navy `#0B1D3A`, teal `#0D6B6E`, aqua `#27A5A1`, and restrained amber `#F2B01E` over white or `#F3F5F7` surfaces\
And saturated Loadgistic colors are reserved for clear actions, current state, small trust accents, and navigation focus\
And large dark or heavily colored bands do not compete with the main page task.

### Scenario: supplied Loadgistic identity is used consistently

Given the approved Loadgistic brand reference supplies the icon, wordmark, and palette\
When public navigation, provider microsites, install metadata, or compact application surfaces render\
Then the cleaned approved icon and wordmark replace improvised marks\
And icon-only contexts use the approved icon while wider navigation may use the complete wordmark\
And the desktop wordmark aligns with the public navigation rail while the phone icon aligns with the compact app-content gutter\
And favicon, app icon, and maskable variants preserve safe padding and remain legible at their intended sizes\
And generated or extracted raster assets are stored in the project with no reference-sheet background, palette labels, or watermark.

### Scenario: actions are recognizable before their words are read

Given any supported visitor or member screen\
When navigation or a command renders\
Then it uses a familiar icon with a short visible label\
And destructive or unfamiliar icon-only controls retain an accessible name and title\
And the same command uses the same icon and label across pages.

### Scenario: public copy speaks to the market

Given a visitor opens the homepage, About, provider Directory, provider page, Track, account access, or provider setup\
When headings, supporting copy, labels, and calls to action render\
Then they describe a clear customer or transport-provider benefit in professional freight language\
And Capacity Sharing and Shipment Tracking are presented as the platform's two primary jobs\
And the core narrative connects Ethiopian producers and growing businesses with usable truck capacity while presenting independent providers as credible commercial operators\
And it explains that transporters may publish capacity to the public Market or share it privately with trusted contacts\
And capacity seekers can find local, regional, or long-distance transport for full trucks or smaller Partial loads before using private Tracking after a direct agreement\
And headings are benefit-led, supporting text is concrete, and actions begin with clear verbs\
And they avoid brainstorming phrases, childish slogans, implementation terms, internal data-model names, seed or test language, and awkward negative product rules\
And public fixture profiles read as credible provider businesses rather than describing themselves as demos\
And required privacy, responsibility, verification, and due-diligence statements remain direct and easy to find.

### Scenario: operational copy respects experienced users

Given a provider, Driver, support agent, or administrator opens an authenticated workspace\
When titles, instructions, status messages, empty states, and actions render\
Then the language names the task and business consequence directly\
And it does not narrate implementation choices, repeat obvious interface behavior, or explain the product as if it were an unfinished prototype\
And specialist operational terms appear only where the role needs them\
And necessary permission, privacy, payment, verification, and irreversible-action guidance remains concise and adjacent to the relevant control.

### Scenario: each page exposes one obvious task hierarchy

Given a visitor or provider opens a feed, map, editor, composer, or detail\
When the page renders\
Then the title and primary action are visually clear\
And map-first Open and Private capacity workspaces use selected navigation and accessible page names rather than repeating visible titles above Map controls\
And one stable command area keeps search, filters, and location refresh available over the Map\
And related choices follow the order needed\
And supporting prose remains only when it explains a material rule, privacy boundary, or consequence.

### Scenario: capacity editor collapses into a useful summary

Given a provider successfully saves capacity\
When the save completes\
Then the editor collapses after a visible success message\
And one summary shows how the truck appears publicly together with the same current Empty Service area or Empty-or-Partial Capacity route map and the provider's one regular Service area or Capacity route\
And the privacy-obscured truck-area marker remains obvious above overlapping area polygons and routes\
And each summary section has a focused Edit action that opens only that section\
And regular Capacity route controls live inside that same capacity console rather than in a second planning block\
And Edit current capacity opens the full ordered current-capacity workflow\
And the selected truck, focused Edit actions, visible map key, and combined location controls occupy distinct top-left, top-right, bottom-left, and bottom-right map zones\
And location refresh and approximate-location accuracy remain directly available from that combined dock without opening the capacity editor.

### Scenario: Tracking uses one ordered status control

Given a provider or assigned Driver opens an active Tracking session\
When status controls render\
Then Going to pickup, Loading, En route, Unloading, Complete, and Problem are visible together in that order\
And only currently valid actions can be selected\
And one optional photo field appears only after Loading, Unloading, or Problem is selected\
And provider navigation calls the workspace Tracking rather than Customer shipments.

### Scenario: discovery controls do not crowd results

Given a visitor opens the homepage Truck Market\
When discovery controls render\
Then the feed remains dominant\
And one compact search bar blends into the map while advanced choices open from a Filters button in one dismissible modal\
And transporter and truck suggestions appear directly below that search after meaningful input and remain operable by keyboard or touch\
And applying a filter closes the sheet and shows compact active values\
And the single shared Map remains prominent without creating a second ranked result surface\
And every ordered city in each regular Capacity route is always visible on each result card rather than hidden behind a disclosure.

### Scenario: the capacity filter is visually scannable and bounded

Given a visitor opens Filters on a desktop or supported phone\
When route, capacity, truck, and nearby choices render\
Then each section starts with a familiar icon and a short task label\
And Empty, Partial, Service area, and Capacity route are presented as clear categorical choices rather than dense explanatory text\
And the truck-configuration control shows the selected vehicle artwork and keeps its complete illustrated option set collapsed until requested\
And opening that chooser provides keyboard-operable radio choices with each matching configuration image and name\
And selecting Partial immediately prevents Service area without requiring submission\
And the modal remains within the available viewport, keeps Apply and Clear reachable, and avoids clipped labels or horizontal document overflow at desktop, phone, and 200% reflow widths.

### Scenario: map signal explanations feel connected to their geometry

Given a visitor has selected one truck on the Capacity Map\
When an approximate-location circle, Service area polygon, current Capacity route, or regular Capacity route is hovered or focused\
Then its summary uses a compact branded treatment rather than a generic map tooltip\
And a light high-contrast surface, restrained neutral border, signal-color accent, title, primary fact, and short operational meaning remain easy to scan without a thick dark frame\
And hover or focus is temporary while click or keyboard activation pins the explanation until dismissal\
And clicking one shape pins only its own explanation while selecting another replaces it\
And overlapping routes use subtle opposite offsets and hollow area/location interiors so every outline or line remains individually reachable\
And the compact selected-truck identity dock stays inside the fixed map canvas at desktop and phone widths without creating a side rail, below-map page extension, nested scroll region, or blocked map controls.

### Scenario: primary public workspaces fill the available phone viewport

Given the Truck Market or Daily Featured Trucks route is rendered at a supported phone width\
When its application workspace appears\
Then the route uses the viewport remaining between its app bars rather than extending the page vertically\
And the Market map or featured board receives the dominant remaining height with equal left and right gutters\
And the map, programme, Sponsored panel, and featured board do not shift left, reserve unexplained right-side space, or cause horizontal page scrolling\
And Market controls float compactly over the map without requiring document scrolling\
And the seven-day programme and detailed featured schedule remain available through compact disclosures that start closed while Sponsored transporters keep a permanent compact region above the board\
And List mode, expanded disclosures, or an unusually large featured roster scroll only inside their bounded workspace rather than moving the application shell.

### Scenario: Drivers reach supply without leaving the workspace

Given an authenticated Driver uses the dashboard\
When workspace navigation renders\
Then the authenticated workspace does not render a duplicate Truck Market or Daily Featured Trucks surface\
And Truck Market and Daily Featured Trucks open their canonical public routes without signing the Driver out\
And retired authenticated capacity-market routes redirect safely to the canonical public Truck Market.

### Scenario: provider mobile navigation behaves like an application

Given an authenticated Driver or fleet transporter opens a supported narrow viewport\
When workspace navigation renders\
Then one fixed bottom bar exposes no more than five direct destinations without a hamburger menu\
And a Driver sees Home, Tracking, Support, Account, and More\
And a fleet transporter sees Home, Fleet, Tracking, Account, and More\
And the active destination is clear by label, icon, shape, and contrast rather than color alone\
And Account contains only private account and plan or payment information\
And More presents role-authorized profile, verification, support, public-market, featured-programme, and sign-out destinations without duplicating Account content\
And Exit dashboard remains directly available without signing the member out\
And page content reserves safe-area space so the bar never covers the final action.

### Scenario: public mobile navigation behaves like an application

Given an anonymous visitor opens any supported public workspace on a narrow viewport\
When the public shell renders\
Then the desktop website header and multi-column footer are replaced by a compact branded app bar and one fixed bottom navigation bar\
And the bar exposes Open capacity, Private capacity, Track, Featured, and About in that order as direct labeled destinations without a hamburger menu\
And a Log in action remains directly visible in the app bar while an authenticated member sees Dashboard in its place\
And no separate Login-versus-Join choice consumes a primary navigation destination\
And Assisted matching is opened from the persistent Ask Loadgistic launcher rather than consuming a primary navigation destination\
And the active destination is clear by icon, label, shape, and contrast rather than color alone\
And each destination opens its own route-level workspace while legacy public anchors return to their equivalent current route\
And all public content reserves top and safe-area bottom space so neither app bar covers a control, map attribution, result, or final action.

### Scenario: desktop public navigation exposes the complete public application

Given a visitor opens a public route on a supported wide viewport\
When the floating workspace rail renders\
Then Open capacity, Private capacity, Track, and Featured remain the prominent discovery destinations in that order\
And a quieter Account group exposes Log in or Dashboard according to session state\
And a quieter Loadgistic group exposes About, Privacy, and Terms\
And Assisted matching is opened from the persistent Ask Loadgistic launcher rather than the rail\
And the active route is identified with `aria-current="page"`\
And the rail remains usable within the viewport without hiding content or forcing the phone navigation to exceed five destinations.

### Scenario: mobile shells preserve role and feature boundaries

Given a visitor, Driver, company Driver, fleet transporter, administrator, or support agent uses Loadgistic on a phone\
When they move through their permitted routes\
Then each role keeps one consistent app-like top and bottom shell\
And every existing authorized workflow remains reachable without exposing a destination or action outside that role\
And switching between public discovery and a transporter workspace preserves the authenticated session\
And no mobile page introduces a second fixed footer, hamburger drawer, nested page scrollbar, or horizontally clipped primary control.

### Scenario: Driver Home is a focused capacity workspace

Given a Driver has active Tracking and a published capacity summary\
When Driver Home renders on a phone\
Then the page presents Capacity management as its only operating workspace\
And Capacity management remains the workspace's accessible name without a redundant visible page title or explanatory notice\
And the published-capacity map fills the primary remaining workspace\
And one compact selected-truck control stays at top-left while one aligned icon-and-label Edit rail stays at top-right\
And the complete map key stays visible at bottom-left while one combined approximate-location, radius, and refresh dock stays at bottom-right\
And these floating zones do not overlap one another, required attribution, or essential capacity geometry\
And automatic location refresh is silent while manual refresh feedback appears transiently beside the location dock\
And focused or complete editing opens in an accessible modal whose Save or Cancel action returns to the map summary\
And no Tracking list, Tracking action panel, or Start Tracking prompt is embedded in Home\
And the fixed Tracking navigation destination remains directly available.

### Scenario: authenticated phone pages keep their task above the fold

Given an authenticated member opens Capacity management, Account, More, Support, Fleet, or Tracking on a supported phone\
When the page renders\
Then an accessible page or workspace name identifies the destination without requiring a repeated visible heading that consumes the primary workspace\
And secondary descriptions and notices appear only when they communicate a permission, privacy, payment, verification, or irreversible consequence\
And cards, controls, and map workspaces begin within the initial viewport without unnecessary blank space or oversized title decoration.

### Scenario: administrator navigation uses a standard task hierarchy

Given an administrator enters the authenticated application on desktop or phone\
When primary navigation and the administrator overview render\
Then Overview is the single landing destination\
And Records opens searchable Users, clients, trucks, Drivers, Tracking, Capacity, routes, and plans\
And Review Center, private Capacity, Featured and sponsors, Support, and role-authorized More destinations use distinct task names\
And no generic Home and vague Operations pair compete for the same administrative purpose.

### Scenario: public supporting pages use the same application shell

Given a visitor opens About, Track, account access, provider setup, Privacy, Terms, or an unlocked Tracking view\
When the page renders at desktop, phone, narrow reflow, or browser zoom\
Then it uses the same centered white-space workspace, compact public application bars, type scale, colors, borders, and bounded content width as the primary public routes\
And headings, badges, controls, contact values, profile handles, dates, and status text wrap without truncating essential information\
And no section shifts sideways, hides behind fixed navigation, or introduces horizontal document scrolling.

### Scenario: task headings preserve the working viewport

Given a public, provider, support, or administrative task page renders on a supported desktop or phone\
When a visible page-level heading is necessary\
Then it uses the smallest established type and spacing that preserves a clear hierarchy\
And a map-first or board-first workspace uses a compact heading variant rather than a marketing-scale title\
And repeated headings, development explanations, or secondary descriptions do not displace the primary task\
And About, Privacy, and Terms may use a modest editorial scale without exceeding the shared responsive type system.

### Scenario: every visible navigation action reaches its named destination

Given a visitor, provider, Driver, support agent, or administrator uses visible navigation or preview actions\
When an action is activated\
Then it reaches the route and task named by its label without a missing page, inert control, or unrelated fallback\
And the administrator More destination opens the actual role-authorized menu on desktop and mobile\
And the Featured administration preview opens the public Featured page rather than the Truck Market\
And Account and plan remains distinctly named inside More instead of competing with a second ambiguous More destination.

### Scenario: one transporter account-access flow stays focused across devices

Given a signed-out visitor opens transporter account access or a verified new identity continues to provider setup\
When the identity request, email-code confirmation, provider-details step, or a related feedback state renders\
Then one consistent bounded account-access surface persists within the public application shell\
And a supported wide viewport places one concise freight-context panel beside one account-task panel without duplicating the page task\
And the account-task panel contains the only page-level heading, with the email-code form first and Google presented as an equally reachable alternative\
And the interface does not ask whether the visitor is logging in or creating an account before identity proof\
And provider setup replaces the identity controls after proof rather than duplicating them\
And Back to Truck Market remains in a consistent footer associated with the task panel\
And a supported narrow viewport or 200% browser zoom collapses to one form-first column without loading or displaying decorative artwork, clipping content, or placing an action behind fixed navigation\
And every field's material instruction is programmatically associated with that field\
And provider operating-model choices, recovery, local-development disclosures, and Back controls expose visible keyboard focus and touch targets of at least 44 CSS pixels\
And control boundaries and focus indicators remain distinguishable against their actual backgrounds without relying on color alone\
And any decorative freight image is absent from the accessibility tree and never carries required account guidance.

### Scenario: mobile controls remain easy to touch

Given a supported narrow viewport\
When navigation, choices, fields, cards, and commands render\
Then primary interactive targets are at least 44 CSS pixels in both dimensions\
And fixed navigation does not cover actions\
And labels do not overlap icons or values\
And map detail cards remain compact, responsive, and fully visible without their own scrolling region\
And no horizontal page scrolling is required.

### Scenario: supported workflows remain accessible and understandable

Given a visitor or member uses Loadgistic with a keyboard, touch input, browser zoom, reduced motion, or assistive technology\
When they complete a supported public or authenticated workflow\
Then pages expose a logical heading structure, named landmarks, associated field labels, and unique accessible names for actions\
And keyboard focus follows the visual task order, remains visible, reaches every action, and returns to its trigger when a dismissible dialog closes\
And dialogs identify their title, contain focus while open, close with Escape where appropriate, and do not leave hidden controls in the tab order\
And changing results, validation failures, success states, and other material updates are announced without relying on color alone\
And text, icons, controls, status colors, map summaries, and focus indicators meet readable contrast against their actual backgrounds\
And content reflows at 200% browser zoom and narrow phone widths without clipped text, two-dimensional scrolling, or fixed navigation covering the current control\
And non-text controls retain a visible purpose or accessible name, decorative media is hidden from assistive technology, meaningful images have concise alternative text, and animation respects reduced-motion preference\
And standard automated accessibility checks produce no serious or critical violations on the release routes\
And necessary task language remains plain, consistent, and free of ambiguous labels that expose multiple different destinations under the same name.

### Scenario: provider microsites remain part of Loadgistic

Given two different provider microsites contain different business facts and images\
When either page renders\
Then both use the same Loadgistic header, white-space template, palette, type scale, card system, map language, safety notice, and footer\
And no provider-specific purple strip, arbitrary color band, or custom layout competes with the provider's information\
And custom provider content changes facts rather than the site design.

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
And public truck and transporter review surfaces tell visitors to check current documents and authority themselves\
And authenticated workspaces do not carry a global marketplace due-diligence banner.

### Scenario: verification proves changed behavior rather than control presence

Given a location, selection, filtering, or persistence interaction changes\
When browser verification runs\
Then it asserts the resulting marker, cluster, coordinate state, server-visible result, or navigation state\
And a visible button alone is not accepted as proof that the interaction works\
And changed-screen review is used during iteration while the full multi-role screenshot sweep remains a release-wide regression gate.

### Scenario: release audit follows the current product rather than retired fixtures

Given the release candidate contains the account-free Truck Market and authenticated transporter operations\
When the complete desktop and phone audit runs\
Then it traverses public visitor, self-managed Driver, company Driver, fleet transporter, support, administrator, and limited-access states using current routes and realistic records\
And it exercises navigation, view changes, pagination, search, filters, maps, dialogs, forms, state changes, empty states, and reversible detail paths rather than capturing static route entry alone\
And it reports response failures, browser errors, horizontal overflow, clipped or undersized controls, keyboard or focus failures, inaccessible names or landmarks, contrast and reflow failures, unannounced changes, duplicate or ambiguous navigation labels, misplaced marketplace warnings, internal or prototype copy, inconsistent color or state meaning, and implausible public fixture data\
And retired Business, demand, Partners, Provider Market, Area Market, future-trip, Busy, and contract-work fixtures cannot make the audit appear comprehensive\
And every confirmed defect is recorded with its affected actor, viewport, route, severity, correction, and verification evidence.

## Contract ownership

- Shared UI: public header, provider shell, page headers, actions, choices, cards, filters, and map state
- Public pages: homepage, Capacity, Providers, Track, About, account access, and provider setup
- Provider pages: `/app/**` excluding `/admin/**`
- Tests: E2E and visual audit
