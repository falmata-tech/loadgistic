---
id: FEAT-MKT-001
title: Ethiopia producer and transporter market positioning
related_ids: [BASE-FE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001]
problem: Small Ethiopian manufacturers, artisans, growers, processors, and transport operators need to recognize their real work and economic constraints immediately, without making the authenticated workspace feel limited to only small firms.
behavior: The public homepage presents Loadgistic as practical production-to-market logistics for Ethiopian Businesses and transport providers, shows realistic freight examples without exposing member data, and uses consistent Sign up and Log in entry actions while routing each audience to the correct reviewed-account signup path.
contracts: [PublicMarketPositioning, PublicExampleBoundary, AudienceCallToAction]
observability: [application_source]
rollout: Keep live marketplace data authenticated and review generated imagery for respectful, accurate, non-political representation before release.
---

# Public market positioning

### Scenario: local producers recognize the Business value

Given an unauthenticated visitor opens the homepage\
When the first viewport and Business value sections render\
Then artisans, growers, processors, producers, and small manufacturers are named in plain language\
And the page explains that they can reach transport capacity without owning a distribution fleet\
And product language remains credible for larger Businesses.

### Scenario: transport providers recognize utilization value

Given a fleet transporter or self-managed driver opens the homepage\
When the transporter value sections render\
Then the page explains that Loadgistic connects recorded truck capacity with reviewed Business demand\
And it distinguishes company fleet coordination from owner-operator capacity control\
And it does not promise guaranteed loads, income, or utilization.

### Scenario: public examples never expose member data

Given live boards and Public Profiles require authentication\
When the homepage demonstrates loads, corridors, producers, or trucks\
Then every example is clearly illustrative and contains no live marketplace record, private contact, exact location, or customer data.

### Scenario: calls to action preserve the two marketplace sides

Given an unauthenticated visitor wants to sign up\
When they choose a homepage call to action\
Then Businesses are routed to the application for capacity demand\
And fleet transporters and self-managed drivers are routed to their respective applications for Business demand.

### Scenario: public account entry is consistent

Given an unauthenticated visitor views public navigation\
When account entry actions render at desktop or mobile size\
Then Sign up and Log in are both visible\
And both actions receive the same primary visual importance\
And Apply and Join are not presented as separate account actions.

## Contract ownership

- Page: `/`
- Application intake: `/apply`
- Tests: `tests/e2e/smoke.spec.ts`
