---
id: FEAT-LUX-001
title: Clear launch journeys and contextual language
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-LNG-001, FEAT-LST-001, FEAT-IAM-001, FEAT-TRK-001, FEAT-TRQ-001, FEAT-SUP-001]
problem: First-time visitors and operators cannot reliably identify the next action, distinguish access codes or recover from a stalled request.
behavior: Public discovery exposes finding and requesting transport and sharing availability. Location is requested only by an explicit action. Fleet and access guidance reflects current permissions; administrators see outstanding callback work. Priority interface language is written for its task in each locale.
contracts: [LaunchEntryActions, ExplicitVisitorLocation, BoundedAccessRequest, UncertainTrackingCreation, CallbackQueueSummary, ContextualInterfaceCopy]
observability: [request_timeout, callback_new_count, localized_journey_checks]
rollout: Local implementation and focused desktop/phone review first; owner visual approval and existing release gates before production. Retain requests and shipment history. Revert presentation to roll back without changing permissions or data.
---

# Accepted launch improvements — 2026-09-24

Owner requests the important changes in docs/LAUNCH_UX_REVIEW_2026-09-24.md and
natural, task-specific Amharic, Afaan Oromo, Somali and Tigrinya wording.

Given a new visitor has not requested location access
When they open the map
Then the guest sign-in entry says Transporter login and still opens /login
And one floating Arrange transport button opens the existing four-field request
And no extra action strip appears above the capacity map
And the form has one title and a Send request action, with no live chat controls
And closing and reopening it preserves the request draft
And stale guest chat state cannot restore chat or start background polling
And the launcher remains visible and touchable without covering map or drawer controls
And transport providers retain live Support inside their dashboard
And the map's markers, automatic loading, filters and touch gestures remain intact
And a transient signal preview clears when pointer/focus leaves the map; pinned details stay open
And geolocation is not requested until an explicit location action, including reloads.

Given a fleet has no trucks
When its owner opens Home
Then adding a truck is the primary setup action
And driver guidance permits assignment before the driver's first email-code login
And company-driver login is explained without offering unauthorized independent access.

Given private-capacity or shipment email access is requested
When its network request stalls
Then pending network calls end after a bounded wait and preserve entered details
And duplicate submission is blocked and localized recovery allows another attempt
And shipment access code and emailed six-digit code remain distinctly labeled.

Given a provider submits a new Tracking session
When creation returns an ambiguous network or server result
Then the form preserves its draft, stops waiting and directs the provider to check
existing Tracking before another creation, rather than automatically repeating a write
And a post-save email-delivery failure is not reported as a failed shipment creation.

Given an active administrator has access to the callback queue
When they open Overview or Support
Then New callback count and oldest waiting time come from the private queue
And no callback contact or permission is exposed to guests or staff by this summary.

Given one of the supported languages is selected
When the visitor moves between priority journeys
Then priority public, signup, driver, Tracking and callback controls use contextual
phrases in that language, with whole-message placeholders and translated feedback
And user names, cargo, notes, email, place names and machine values remain unchanged
And natural-language review is documented separately from automated coverage.

Do not invent staffed response hours, make unsupported price/free-access promises,
delete demo inventory or change hosted settings. Those launch decisions remain
explicitly outstanding until confirmed. Featured describes showcase timing, not
truck availability or provider quality rankings. NR-08/10/13 apply.

Tests: `tests/browser-request.test.mjs`, `tests/provider-shipment-response.test.mjs`,
`tests/localization.test.mjs`, `tests/e2e/launch-clarity.spec.ts`,
`tests/e2e/launch-recovery.spec.ts`, `tests/e2e/public-assistance-dock.spec.ts`, `tests/e2e/transport-requests.spec.ts`,
`tests/e2e/fleet-onboarding.spec.ts`,
`tests/e2e/map-feedback.spec.ts`, `tests/e2e/map-clarity.spec.ts`, and the
explicit GPS / provider-start scenarios in `tests/e2e/smoke.spec.ts`. Existing role and authorization suites remain
required release checks; focused local evidence is recorded in PROGRESS.


### Scenario: interface copy helps the current task

Given a visitor or member uses the map, profile, dashboard or help workspace
When app-owned labels render
Then decorative map captions and repeated section labels do not cover the work
And internal terms such as public projection or saved snapshot are replaced by plain language
And freshness, location approximation, access scope, sponsorship and document-review limits remain clear
And provider content, identifiers and stored records remain unchanged.

Given a Featured slot is current according to its schedule
When the public page labels it
Then it says Featured now rather than claiming a live video broadcast
And an optional TikTok link is labeled as a destination, not verified live status.

## Platform introduction above the map — 2026-09-25

Given a visitor opens Open capacity
When the page renders
Then a visible single H1 and short introduction explain truck capacity discovery, network/open-market sharing and private shipment tracking
And the heading and description exist as real elements in the server HTML before JavaScript runs
And the description appears above the map, not over its controls
And the previous public header slogan is removed
And all five supported languages have contextual interface copy
And the page title and description accurately describe the platform without unsupported claims
And no new action buttons or promotional counters are added.

Given a short or narrow viewport or longer translated copy
When the introduction and map cannot both fit
Then the content area can scroll, preserving a usable map height and access to the filter footer
And the introduction remains fully readable without truncation
And map filtering, panning, zooming and navigation retain their existing behavior.

SEO basis: Google Search Central's SEO Starter Guide (descriptive title/headings,
helpful visible content and concise meta description); this change does not promise rankings.
Local screenshots and owner visual approval precede release gates.

## Combined capacity entry — 2026-09-26

Given the visitor opens Capacity
When Open to the public or Privately shared with you is chosen above the map
Then one shared introduction describes capacity, routes and availability sharing
And both views render a map; the locked private map contains no signals
And the email form and map controls remain usable at desktop and phone sizes
And translations cover the changed introduction, view choice and single Capacity menu entry.

Security and recipient-session acceptance is owned by FEAT-SHR-001.
