---
id: FEAT-MKT-001
title: Frictionless public capacity marketplace
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-FTR-001, FEAT-PRV-001, FEAT-SPN-001, FEAT-TRK-001, FEAT-VER-001]
problem: Manufacturers, workshops, growers, producers, and other capacity seekers need to discover legitimate road-freight options immediately without creating an account or posting demand.
behavior: A persistent public application shell gives each primary visitor task its own route-level workspace. `/` is the canonical map-only Truck Market, `/shared-capacity` is the email-verified private map, `/featured` is the complete seven-day Daily Featured Transporters programme, and Track and About retain their own routes. Transporter signup remains directly available from Login without consuming a primary navigation destination. The Market and Featured data trees are not rendered together. Transporter-name search filters the Truck Market to that transporter's current trucks; there is no ranked Truck List, Provider Market, provider map, Area Market, or provider list. Detailed product education lives on About. Shipment-demand posting, a public Shipment Board, and capacity-seeker signup are absent.
contracts: [PublicAppShell, PublicWorkspaceNavigation, PublicMarketplaceView, PublicCapacityProjection, PublicTrackingEntry, LocationConsentPrompt, ProgressiveCapacityMap]
observability: [public_workspace_navigation, public_capacity_query, public_tracking_entry, location_consent_outcome, anonymous_projection_review]
rollout: Release the public capacity surface with retired-route redirects, purge fake local demand records, and require a backup plus operator approval before any destructive cloud purge.
---

# Public marketplace

### Scenario: capacity is useful before login

Given a visitor opens Loadgistic\
When the public application shell and default Market workspace render\
Then one compact welcome header explains that visitors can find public truck capacity for local, regional, long-distance, full-truck, or smaller Partial-load work without an account\
And on a supported desktop or phone viewport the primary Market begins inside the initial workspace view without a website-scale hero delaying it\
And the Market uses the viewport remaining between its application bars, with compact search, filter, view, and location controls over the Map instead of extending the page vertically\
And the complete Market offers one Truck Map without a Map/List or Trucks/Providers mode choice\
And the Map offers search across truck, transporter, Service area, and Capacity route facts, selectable truck markers, compact truck details, and a Transporter details action\
And selecting a truck opens a compact dismissible information window inside the fixed map canvas without adding document height or narrowing the map\
And that window keeps only the truck identity, availability, transporter, contact, and profile actions needed before inspecting its map signals\
And the persistent public navigation links directly to the separate Daily Featured Transporters workspace as well as the Truck Market\
And `/featured` renders the current programme, featured board, and clearly labeled separate Sponsored transporters panel without rendering the Truck Market\
And `/` does not server-render or hydrate the featured programme while `/featured` does not server-render or hydrate the Truck Market\
And repeated educational or promotional sections do not interrupt either workspace\
And detailed market purpose, operating model, and safety education remain available on About\
And About explains that transporters control whether current capacity is public or shared only with trusted email contacts and that confirmed work can use private Tracking\
And a ranked or paginated public truck list is absent\
And the primary map initially centers and zooms for the current Ethiopia market while allowing bounded exploration across East Africa rather than exposing Africa or the world\
And browsing cards, filters, the truck map, capacity details, provider microsites, and tracking-code entry require no account\
And the page does not ask the visitor to post demand or sign up as a Business\
And the legacy `/capacity` URL preserves its query string while redirecting to `/` rather than rendering a duplicate market page\
And `/providers` redirects to the Truck Market without rendering a provider list or selecting a provider mode.

### Scenario: authenticated discovery does not fork the public market

Given a Driver, fleet transporter, or administrator wants to inspect public capacity or featured transporters\
When the actor uses workspace navigation or an older authenticated Capacity market URL\
Then Truck Market opens `/` and Daily Featured Transporters opens `/featured` in the public application shell while the signed-in session remains active\
And `/app/capacity` and its former detail routes do not render another Market, provider directory, or administrator-only copy\
And Driver Home remains the private Capacity management workspace for publishing that Driver's own truck signal.

### Scenario: provider-name search returns that provider's trucks

Given a visitor searches the Truck Market using a provider name\
When the public capacity query is applied\
Then only discoverable Empty or Partial trucks belonging to matching providers appear on the Map\
And featured or sponsored View trucks on map actions apply the transporter’s exact public handle as well as its readable name\
And automatic visitor-location refresh keeps all trucks from that explicitly selected transporter visible while adding the visitor marker for relative map context\
And provider cards, provider markers, Area Market buildings, and provider-led result lists do not appear\
And each returned truck's details retain a Transporter details action to its canonical `/@handle` microsite\
And searching by vehicle, cargo configuration, provider name, approximate current area, any current or regular Capacity-route city, or any current or regular Service-area city uses the same single search control.

### Scenario: public search suggests current transporters and trucks

Given a visitor enters at least two characters in the Truck Market search\
When current public capacity matches a transporter, self-managed driver business, truck platform number, make, model, or cargo configuration\
Then one keyboard-accessible suggestion panel groups safe Transporter and Truck results beneath the search field\
And each suggestion names its result type and enough current public context to distinguish it\
And choosing a transporter applies that transporter’s exact public handle and shows only its current trucks\
And choosing a truck opens the Market with that truck selected on the map\
And the suggestion response exposes no assigned company Driver, private plate, private contact, exact coordinate, or inactive truck.

### Scenario: advanced filtering follows the chosen truck geometry

Given a visitor opens the Truck Market filter\
When Service area is selected\
Then the filter identifies Empty trucks whose current Service area or provider regular Service area overlaps the selected catalog-backed center and distance\
And matching tests the selected place against the complete stored polygon boundary rather than projecting the retired center-and-radius fixture\
When Capacity route is selected\
Then the filter reveals catalog-backed freight origin and destination, tolerance, and direction controls that match current or regular Capacity route alignment\
And both freight endpoints are evaluated against every ordered segment in each two-to-five-city route rather than only its first and last cities\
And a truck whose current signal is a Service area may still match when its provider's regular Capacity route aligns\
And a Service-area search may match either the truck's current Service area or its provider's regular Service area\
And truck facts and browser-location proximity may be combined with either geography\
And public availability filtering remains categorical as Empty or Partial, with no remaining-space percentage or minimum-space filter\
And every result remains one truck's latest Empty or Partial signal rather than a provider card or demand post.

### Scenario: the Market distinguishes signal age from availability status

Given an Empty or Partial truck was not updated recently\
When its marker, selected summary, or capacity geometry is shown\
Then Empty or Partial still describes the provider's last published capacity state\
And a separate plain-language capacity-update label states Today, Past few days, Past week, Past month, or Older\
And a separate approximate-location label states when that location was last updated\
And the selected summary does not call an older location current or imply the truck remains available\
And visitors are prompted to call and confirm older signals directly\
And the Market remains unranked\
And update time is used only as a deterministic bounded-cursor retrieval key, without a provider score or ordered visitor list.

### Scenario: search and view controls remain consistent

Given a visitor uses the Truck Map on a desktop or phone\
When search, filters, view choice, or current-location controls render\
Then the same compact command surface remains visible without hiding beneath the workspace heading\
And clearing search removes free text plus an exact transporter or truck selection while preserving unrelated explicit filters\
And Clear filters removes all filter values and closes the dialog\
And applying filters closes the dialog before navigation\
And selecting Partial availability prevents a Service-area geometry choice because Partial capacity is route-only.

### Scenario: filters close when results are applied

Given a visitor has opened the Truck Market filter dialog\
When Apply filters or Clear filters is activated\
Then the dialog closes before navigation begins\
And keyboard focus is not left inside the closing dialog\
And the resulting URL and Market state reflect the submitted or cleared filters.

### Scenario: visitor receives an immediate nearby-location request

Given the public Board is usable without location\
When the client becomes interactive\
Then Loadgistic immediately requests browser location permission\
And permission success centers and zooms the map around the visitor's surrounding area without changing, ranking, or refetching the current results\
And nearby-truck filtering remains a separate explicit choice in the Market filter\
And permission denial or device failure does not block the map or manual filters\
And the visitor may manually retry after enabling browser site permission.

### Scenario: Map loading remains bounded and geographic

Given more public signals match the active filters\
When the visitor explores the Truck Map\
Then the browser receives bounded result batches without duplicate capacity identities\
And a phone without visitor location opens at a useful Ethiopia-level camera rather than fitting a distant East Africa overview\
And status-specific map clusters preserve distinct regional and city markets instead of joining distant markets through transitive neighbors\
And bounded screen-space placement keeps nearby Empty and Partial groups individually readable instead of drawing their labels on top of one another\
And clustering work grows approximately linearly with loaded markers rather than comparing every marker with every other marker\
And each cluster has a bounded membership so zooming out does not collapse a whole region into one misleading bubble\
And visible shipment origin and destination controls evaluate eligible current and regular Capacity routes and Empty Service areas without ranking transporters\
And filters constrain the map without creating a ranked result list.

### Scenario: public navigation reflects the one-sided marketplace

Given any public page is rendered\
When the shared public application navigation and calls to action appear\
Then Truck Market, Daily Featured Transporters, Track, About, and the session-appropriate Transporter login or Dashboard action are available as route links\
And one current destination is communicated visually and with `aria-current="page"`\
And desktop uses a compact floating workspace rail while phones use the persistent bottom navigation\
And an anonymous visitor reaches transporter signup from the Transporter login page rather than a separate Market navigation item\
And the authenticated Dashboard action replaces login without leaving a signup item behind\
And Provider Market, provider directory, and Area Market actions are absent\
And Shipment Board, Post shipment, Business signup, and Business Directory actions are absent.

### Scenario: claims remain evidence safe

Given the homepage explains Loadgistic's purpose\
When it describes makers and transport providers\
Then it presents capacity reuse, partial space, current Service area or Capacity route coverage, and regular Capacity routes as options rather than guaranteed savings, service, income, or outcomes\
And every discovery surface reminds visitors to confirm availability, identity, authority, documents, cargo fit, price, and terms directly.

### Scenario: public workspaces are visually light and purposeful

Given a visitor opens the Market or Daily Featured Transporters workspace\
When the route renders at desktop or mobile width\
Then warm white and off-white surfaces provide useful spacing around a compact workspace heading and its primary tool\
And Loadgistic blue and orange appear in bounded navigation, actions, status, and trust accents rather than saturating whole sections\
And the hero visual shows young Ethiopian men at a metal door-and-window workshop handling incoming metal inputs and finished goods with local road freight, without presenting one truck as the product\
And its bright negative space blends into the white-first layout while navy, teal, aqua, and a restrained amber accent follow the approved Loadgistic palette\
And at mobile widths the full visual scales and crops to the available hero width, preserves its important workshop subjects, and uses soft white edge fades rather than exposing a rectangular image boundary\
And concise route actions lead directly to the Market, Daily Featured Transporters, Track, About, or transporter signup\
And the shell, workspace heading, and active tool read as one composed public application rather than stacked website sections\
And the Market uses a compact command panel beside the Map on desktop and progressive controls above the Map on mobile\
And explanatory copy stays subordinate to the two working marketplace tools.

### Scenario: mobile public workspaces open directly on their task

Given a visitor opens the Market or Featured route on a supported phone\
When the compact public app shell and workspace heading render\
Then the Market keeps one short welcome message without a website-scale hero or promotional artwork delaying the map\
And the active Market or Featured experience begins in the first viewport\
And the page itself remains fixed while Map and board canvases fill their bounded workspace and List or disclosure overflow stays inside that workspace\
And map search, filters, location retry, legend, selected-truck details, and bounded loading remain operable above the fixed app navigation\
And Daily Featured Transporters opens as its own full-width app workspace rather than following the Market in the same document\
And the desktop footer is not duplicated beneath the mobile bottom navigation.

### Scenario: featured transport providers reach their board quickly

Given the current Daily Featured Transporters programme is published\
When its dedicated `/featured` workspace renders\
Then the current region or grouped regions, date, livestream window, and provider count are immediately understandable\
And the heading and introduction stay compact enough that the weekly programme and board remain close to the section entry\
And repeated explanation moves into provider detail, provider profiles, or About\
And the generated board blends into the public white-space system while retaining a realistic evenly lit framed surface, numbered pinned provider portraits, readable scheduled intervals, and current-live emphasis\
And no fixed illustration determines participant count, row count, or board dimensions.

## Contract ownership

- Pages: `/` as the canonical Truck Market; `/featured` as Daily Featured Transporters; `/capacity` and `/providers` as compatibility redirects to the Market; `/track`, `/about`, and `/@handle`
- Projection boundary: explicit public whitelists only
- Tests: repository, E2E, visual audit
