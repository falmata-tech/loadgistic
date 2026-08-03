---
id: FEAT-MKT-001
title: Ethiopia producer and transporter market positioning
related_ids: [BASE-FE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001]
problem: Small Ethiopian manufacturers, artisans, growers, processors, and transport operators need to recognize their real work and economic constraints immediately, without making the authenticated workspace feel limited to only small firms.
behavior: The public homepage introduces Loadgistic in one short statement and immediately shows real-time, identity-safe Shipment Board and Truck Board projections, then routes visitors through consistent sign-up and sign-in actions. A concise About page and distinctive freight-route mark explain the platform's purpose without making unverified economic claims.
contracts: [PublicMarketPositioning, PublicExampleBoundary, AnonymousBoardPreview, AnonymousSharedMatchPreview, AudienceCallToAction, PublicAboutPage, BrandMark]
observability: [application_source, anonymous_board_projection]
rollout: Monitor the anonymous projection whitelist whenever authenticated Board fields change; no raw marketplace row may cross the public boundary.
---

# Public market positioning

### Scenario: the Business side is immediately recognizable

Given an unauthenticated visitor opens the homepage\
When the first viewport and account-entry band render\
Then the road-freight marketplace statement and Shipment Board identify the demand side\
And Need a truck routes a Business to shipment and truck access\
And the concise language remains credible for a local producer or a larger enterprise.

### Scenario: the transporter side is immediately recognizable

Given a fleet transporter or self-managed driver opens the homepage\
When the first viewport and account-entry band render\
Then the Truck Board identifies the capacity side\
And Have a truck routes a transporter into the reviewed signup choices\
And the page does not promise guaranteed shipments, income, or utilization.

### Scenario: visitors see the two-sided marketplace immediately

Given an unauthenticated visitor opens the homepage\
When the first viewport renders\
Then one short purpose statement is followed by Shipment Board and Truck Board tabs\
And switching tabs shows current Public shipment and truck signals from the server\
And the Shipment Board preview includes identity-safe examples of Pool together and Along the route matches derived from currently visible structured shipments\
And the page avoids a long sequence of repeated marketing sections.

### Scenario: public Board projections never expose member data

Given full Boards and Public Profiles require authentication\
When the homepage projects current Public shipments or trucks\
Then cards may expose structured marketplace facts including routes, general areas, deadlines, price mode, truck configuration, capacity status, flexibility, proof signal, and freshness\
And cards expose no organization or person name, phone, email, handle, profile link, raw record identifier, proof file, free-text field, or exact coordinate\
And the server returns an explicit anonymous whitelist rather than a raw Board row\
And pooled or along-route previews expose only derived route, count, distance, and deadline facts without source identifiers or cargo text\
And place labels require a structured place reference and the visible page refreshes the bounded projection once per minute while active\
And all details and contact actions resolve to sign in.

### Scenario: the story has a purposeful flow

Given a Business or transporter scans the homepage\
When they move from the purpose statement through the identity-safe Boards to account entry\
Then each region has one defined task\
And repeated claims, feature inventories, and long explanatory paragraphs are absent.

### Scenario: calls to action preserve the two marketplace sides

Given an unauthenticated visitor wants to sign up\
When they choose a homepage call to action\
Then Businesses are routed to the Business signup choice for capacity demand\
And transporters enter the transporter signup choice and may choose Fleet or Self-managed Driver.

### Scenario: public account entry is consistent

Given an unauthenticated visitor views public navigation\
When account entry actions render at desktop or mobile size\
Then Sign up and Log in are both visible\
And both actions receive the same primary visual importance\
And the Login page includes a visible Sign up action\
And Apply and Join are not presented as separate account actions.

### Scenario: public purpose is professional and evidence-safe

Given a visitor opens the homepage or About page\
When Loadgistic describes its purpose\
Then it explains reducing empty and partial capacity waste, improving truck utilization, and lowering avoidable middle-mile coordination cost\
And it presents Ethiopian producers, growing Businesses, owner-operators, Drivers, and fleet transporters as professional economic participants\
And it does not publish invented savings, utilization percentages, government endorsement, or guaranteed outcomes\
And the same distinctive route-and-cargo mark appears in public navigation and installable application icons.

## Contract ownership

- Page: `/`
- Application intake: `/apply`
- Tests: `tests/e2e/smoke.spec.ts`
