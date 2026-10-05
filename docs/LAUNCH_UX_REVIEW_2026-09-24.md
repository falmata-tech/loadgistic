# Social launch: role and value-proposition review

Review date: 2026-09-24. Advisory review; no application behavior changed.

## Evidence and limits

Opened the production homepage (HTTP 200) and local homepage, About, login,
private-capacity access, Tracking access and Featured in Chromium. Captured
loaded desktop and phone states in `artifacts/launch-review-20260924/`.
The first phone capture was a loading state; use `local-home-phone-ready.png`
for the rendered map. Read the current signup, fleet, driver, provider Tracking,
network, admin overview and Support implementations. Reused the documented
September 23 local callback workflow evidence; did not claim a fresh end-to-end
audit of all authenticated roles or send email, create accounts, or mutate production.

The pending application, document migration 102 and callback migration 103 are
not deployed according to the latest release record. The previous candidate
failed CI. Public-page HTTP 200 is not release approval or complete workflow proof.

## Recommended positioning

Primary: “Find trucks. Share your availability. Keep customers updated.”

Supporting sentence: “Transporters share available trucks with their own business
contacts or the open market, then provide private shipment updates after agreeing
the work.”

Explain responsibilities in context: visitors contact transporters directly;
Loadgistic can follow up on a callback request; booking, prices and payment are
agreed offline. Document review applies to specific documents, not blanket
endorsement of a provider. Tracking is status updates and optional approximate
location, not a promise of continuous precise GPS.

These are proposed copy/interaction changes for owner review, not authorization
to redesign the map or alter account permissions.

## Findings and proposed acceptance

| ID | Priority / evidence | Issue and affected user | Small proposed improvement / acceptance |
|---|---|---|---|
| UX-01 | Before promotion; browser + source | First-time guests land in a map/filter interface. Phone navigation says Open/Private and provider signup is presented as Log in. The clearer explanation and Join as a transporter action are on About. | Owner placement correction: retain the map with no added top action strip; label guest login Share your trucks and use a single floating Arrange transport button; live Support remains in transport-provider dashboards. Explain Private as trucks shared with your email. A first-time visitor can identify their path without reading About. |
| UX-02 | Before promoting callbacks; browser + source | The new four-field request sits behind Ask Loadgistic, reduced to a headset on phones. It resembles technical support rather than help finding a transporter. | Provide a clearly labeled Request transport entry that opens the existing form. Keep four fields and the private queue. Do not add another booking workflow. |
| UX-03 | Before promotion; browser + source | The market automatically requests device location on mount unless a city is already supplied. The clean browser received a location-denied notice before choosing a location feature. | Request location only after the visitor chooses the nearby action; city and route search remain usable without permission. Recheck against the original location feature contract before implementation. |
| UX-04 | Correct before fleet onboarding; confirmed contradiction | `fleet-setup-empty.tsx` says assign after invitation acceptance. `app/fleet/drivers/new/page.tsx` correctly says assignment is possible before email verification. | Use one sequence everywhere: add truck, add driver by email, assign truck and permissions; driver's first email-code login proves their email. Test assignment and both driver permission states. |
| UX-05 | Before a fleet social campaign; source review | Generic login/signup does not prominently distinguish an independent operator from a company driver already added by an employer. Fleet owners see Start Tracking first even when their first useful task is adding a truck. | Give company drivers an existing-company sign-in hint. For an empty fleet, make the next required setup step prominent; show publication/audience confirmation after first capacity save. Reuse existing screens. |
| UX-06 | Before tracking promotion; source + public browser | Account login, private-capacity email verification and shipment access are distinct. Tracking uses a shipment code plus a second emailed code; the wording makes these easy to confuse. Copy also says Customer owner email / Tracking parties. | Use “Shipment access code”, “6-digit email code”, “Main customer contact” and “People who can track this shipment”, with a short explanation of who supplies access. Preserve separate authorization boundaries. |
| UX-07 | Before public launch; confirmed recovery gap in source, no production hang reproduced | Tracking unlock, private-capacity access and Tracking creation fetches have no application-level timeout. Pending network requests can leave a busy action with no clear recovery. | Bound waiting, retain input and provide retry/change-details actions. Creation must reconcile uncertain success or use idempotency before retry. Fault-test delayed/dropped responses, not only successful email delivery. |
| UX-08 | Before promoting callbacks; source + previous local workflow evidence | Admin has separate conversations, Assisted matching and Transport requests. Overview/Support counts are chat counts; a callback can be missed. The receipt promises a call without a stated service window. | Keep the dedicated admin-only list; show its New count and oldest waiting age on Support/overview. Establish a person and realistic follow-up window operationally. Do not invent automatic matching or silently grant staff access. |
| UX-09 | Before advertising all languages; documented inventory + source | Localized public pages coexist with English signup role choices, dynamic dashboard labels and server errors. Existing inventory records 439 missing fixed messages and 126 dynamic boundaries before this callback addition; not re-counted here. | Prioritize visitor discovery, callback, signup, driver update and shipment access. Have fluent speakers review each launch language on actual phones. Do not describe five-language coverage as complete. |
| UX-10 | Before broad acquisition; browser + source interpretation | Featured uses numbered timed slots and “Ended”; this can look like a ranking, availability window or closed service. Existing disclaimer covers document/price checks, not selection meaning. | Briefly label it a rotating showcase; distinguish spotlight schedule from truck availability and timezone. Keep profiles discoverable after the spotlight ends. |
| UX-11 | Before social claims; existing feature/data history, verification still needed | The project has demo accounts and inventory. This review did not establish which currently public listings are real, approved launch supply. FREE and TRIAL_PAYMENT are both supported policies. | Verify a launch inventory of reachable participating providers and exclude or clearly label test listings through a reviewed operation. Confirm active pricing policy and explain it before signup; do not infer production pricing from seed trials. |
| UX-12 | Small copy correction; confirmed source | Admin team creation still promises Google sign-in although the current login UI is email-only. | Remove the unsupported provider promise, including translations; keep actual sign-in behavior unchanged. |

## Role-specific benefit to communicate

- Guest / shipper / receiver: find suitable trucks and contact the transporter;
  request a phone follow-up when help is needed.
- Broker / enterprise contact: see availability shared by known transporters,
  and follow their agreed shipments using approved email access; no provider
  workspace is needed merely to view these services.
- Fleet owner: publish truck availability, choose audiences, assign drivers and
  share progress with customers.
- Owner-operator / independent driver: update their truck, present their transport
  business and keep customers informed with less coordination effort.
- Company driver: update the assigned truck or shipment within permissions;
  the employer manages the fleet and enables access.
- Administrator: see outstanding requests/reviews and the next operational action;
  record management remains available but is secondary to unhandled work.

## Launch order

1. Owner reviews the already pending visual changes and the proposed launch fixes.
2. Fix contradictory copy, entry actions, permission prompting, code-flow guidance
   and bounded failure recovery; focused desktop/phone verification first.
3. Validate actual launch inventory, callback coverage, language claims and pricing.
4. Complete exact-candidate release gates and reviewed migration rollout; smoke-test
   the released customer journeys on loadgistic.com.
5. Small pilot: ask new guests to find/contact/request transport, new providers to
   publish their first truck, company drivers to update assigned work, recipients
   to open tracking, and an admin to find/follow up a callback without coaching.
   Record completion, confusion, failure and delayed responses rather than
   declaring usability from automated test success.
6. Promote one journey per social post, with a matching destination. Expand after
   observing the pilot. Do not add more fields or a broad dashboard redesign first.

General review basis: Nielsen Norman Group's usability heuristics (familiar
language, visible system status, recovery and recognition over recall):
https://www.nngroup.com/articles/ten-usability-heuristics/
