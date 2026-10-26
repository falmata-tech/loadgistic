# Loadgistic product brief

This is the current source-product overview, not a deployment certificate.
[PROGRESS](PROGRESS.md) records the active task and release state;
[traceability](../specs/TRACEABILITY.md) routes each capability to its controlling
spec, implementation and tests. Read only the relevant contracts. Earlier product
notes are preserved in the [historical snapshot](PRODUCT_MASTER_HISTORY_20261020.md);
they do not override the current specs or latest owner decisions.

## Purpose and people

Loadgistic helps transport providers share vehicle capacity, routes and
availability with brokers, shippers and receivers they work with, or with the
open market. Recipients can keep a useful view of their transport network,
contact providers and coordinate agreed shipments. Loadgistic does not own this
fleet, publish customer demand or guarantee availability or service.

- Visitors use public Capacity, Transporter search, Featured and About without
  an account. Privately shared with you invites them to sign in or create a
  shipper/broker account; public-link Tracking retains its email access.
- Transport Provider owners manage their vehicles, drivers, capacity, sharing,
  devices and Tracking. Locally qualified work-first Home (FEAT-UIX/MOB-001)
  opens My capacity when driving, otherwise Manage vehicles when authorized.
  Analyze the Market follows those work tabs and
  highlights only their matching public vehicles. Explicit market search and
  provider/vehicle links retain Market intent. Pressing Home within any current
  Home tab preserves it. Phone controls evenly fill their row and wrap labels;
  desktop tabs align with the page content.
- Shippers and brokers use private Capacity through vehicle grants to their
  registered account and its explicitly authorized team. An email address alone
  cannot receive private Capacity access. Tracking has separate permissions.
- Platform administrators and assigned software staff manage customer accounts,
  software Support, document review and operational tools on the web. These are
  not customer-team roles and do not gain blanket private-location access.

One application shell keeps public navigation available and adds role-appropriate
menus after sign-in. Providers use Home tabs for their driving controls, managed
vehicles and public market; shippers/brokers use Capacity with Openly shared and
Privately shared with you views. Group related management within the relevant record or Account;
avoid turning every database resource into another menu item. Web desktop, phone
web and Android preserve the same task structure, essential labels, icon meanings
and feature outcomes in layouts suited to each device. Admin and platform-staff
management remain web-only. Privacy stays inside the native app; external Terms
opens the published legal page. FEAT-MOB-001 controls installed parity qualification.

The web shell's compact company footer identifies MarketVision Technology and
the Jigjiga, Somali Region, Ethiopia office. It reserves normal-flow layout space
above phone navigation rather than covering map controls or attribution. Native
company details remain in About. FEAT-UIX-001 controls the current local candidate;
the release checkpoint records publication separately.

Capacity opens with “The visibility you need to serve your customers reliably”
and its public/private choice. Roomier web views add “Build trusted partnerships
and coordinate your transport network together.” Short phone web and native keep
the heading alone. The map takes the remaining phone space without shrinking search,
filters or navigation to fit. Fuller benefits belong in About and signup.

Team invitations use the ordinary signed-in workspace permissions. The pending
Android invitation-entry repair in FEAT-MOB-001 preserves the invitation
destination through sign-in and Join; it grants no authority from a link and
does not restore a separate workspace navigation switch. Installed owner/admin/
staff qualification remains required before the replacement Play candidate.

The pending October25 provider-profile change keeps provider accounts, including
self-managed drivers, as searchable identities; employed fleet drivers sit within
their provider's vehicle/profile view while eligible vehicles remain on Capacity.
FEAT-MKT-001 controls that change. FEAT-VER-001 now specifies flat blue/neutral
verification states and one current-authority basis for vehicle badges and
document filters. Stronger shared native card/section boundaries are pending
under FEAT-MOB-001; none of these notes certifies deployment.

## Discovery and identity

Vehicle filters narrow the map. Independent Transporter search finds public
account names, unique handles and the account manager's first name; private
identity is not searchable. Selecting a result can deliberately show that
provider's vehicles. Changing vehicle filters does not silently narrow profile
search. Companies appear as profiles, never company map markers.

Map signals represent eligible current vehicle/driver combinations. Full and
Off Duty signals are excluded from discovery. Older Empty/Partial signals require
truthful capacity/location age labels. Accepted-load preference remains a vehicle
detail; the separate Space needed filter is removed. Courier cars and motorcycles
are supported alongside vans, pickups and heavier vehicles. Use “vehicle” for
shared UI wording rather than implying every configuration is a truck.

The locally reviewed Capacity presentation names the vehicle's current/next-work
Empty/Partial offer Planned capacity, with Planned area or Planned route where
geometry matters. Preferred corridor/area is its separate regular coverage.
Map and private Capacity return a vehicle matching any complete offer once,
while its other selected vehicle, status, permission and document filters still
apply. Hosted rollout remains pending. Both Empty and Partial may use Area or
Route. A route is ordered travel; an area is service coverage, and
the reported GPS/phone/manual position remains independent. There is no separate
search mode that excludes Preferred availability by default. FEAT-CAP/GEO-001
own the acceptance and public/private consistency checks. An Area search compares
both advertised route points and area coverage within the chosen distance;
it does not exclude a vehicle merely because its offer uses a Route. Saved
coverage can render without a reported location; it never invents a vehicle
position, source or uncertainty circle at a coverage city. Current local source
and Chrome/Expo qualification, physical-device limits and remaining rollout
steps are recorded in PROGRESS and traceability.

The local public provider-profile producer now applies the accepted Planned/
Preferred geography and Empty/Partial eligibility rules through migration217.
Its focused dispatcher/profile regressions, exact recovery, local postchecks and
canonical scale gate pass; hosted installation remains pending. The bounded
compiled-preview broker walkthrough also confirms a matching public account for
Partial Area search, plus representative private searches and permission denial.
It does not qualify the complete filter cross-product or independent Preferred-
only matching where Planned coverage overlaps. Public profile result counts are
accounts; matching vehicle counts remain separate. Private business profile
search intentionally remains text/page discovery, independent of map filters.

Public capacity and reported-location ages use the existing bounded localization
helper. Final web am/om320/390 freshness checks pass; Expo Map/Location/Vehicle
passes those sizes/locales, while direct Expo profile proof is limited to Oromo320
against its own DTO. A hidden Preferred Area caption has renderer-only evidence.
Current local source gates, JavaScript export and compiled web build pass;
PROGRESS and traceability retain exact evidence, earlier withdrawn captures,
artifact/physical limits and remaining rollout work.

In the default market view, when no restored viewport or explicit visitor/vehicle
centering applies, public and authorized Capacity maps start at the densest group
of available approximate vehicle locations. One distant signal therefore does
not shrink the active market to a world view. This camera choice never filters
signals. Visitors may pan and zoom globally; there is no Ethiopia or regional
camera clamp. Web desktop, phone web and Expo use the same cluster-selection rule,
with the map-engine zoom scale adjusted so the same area occupies a similar share
of the screen.

Public and private projections disclose only authorized information. Individual
manager/driver identity uses first name only; private last/father name, login
email, device identifiers, raw location and private proof files remain private.
Shippers and brokers retain their chosen account identity and safe reviewed-document
facts. They use the shared “Shippers & brokers” workspace label. Their document
review is optional: active accounts remain searchable and shareable without it;
current approvals add only the matching trust badges through the existing private
Trust review process. Any review fee is handled offline.

## Fleet, documents and location

Owners may add multiple Draft vehicles. One vehicle may go Live without document
approval. More than one Live vehicle requires current exact-provider ownership
or the applicable operating licence verified in their name for an owned/financed
vehicle. Renting or permission to drive/manage does not qualify. Assignment,
publication, declared relationship and reviewed authority are distinct. Employees
control only their assigned vehicle with current permissions. Retirement,
reassignment, restoration and erasure preserve protected history and ongoing work.

Documents are optional evidence, not a service guarantee. Submission, Pending,
More info/Rejected, replacement, review and expiry/revocation have real private
file and authorization workflows. Business verification concerns the business,
manager and address; it cannot establish vehicle ownership.

Capacity location may come from the selected GPS device, phone installation or
manual report. Markers show the actual saved source; a dated manual point is not
live device movement. Public/shared locations use the configured privacy area.
Source changes must not relabel old reports. Phone installation IDs and tracker
identifiers are private. Demo movement is confined to registered synthetic
accounts, with real-device takeover; it must not alter customer records.

The separate Traccar gateway/bridge and device controls require their own
operational evidence. Local simulation is not a deployed GPS server or physical
device certification. Real engine control remains disabled without the specified
hardware safeguards and separately authorized commissioning.

## Tracking and Featured

Provider-created Tracking names one shipment-owner email and an origin,
intermediate city and destination. The authorized owner and explicitly permitted
staff can view the selected location source on the map, with its actual privacy
radius and age. Invited route/status viewers cannot receive the moving vehicle's
location. Membership alone does not authorize it. Loading/unloading proof,
ordered events, owner unloading approval, short verified-email sessions and
appeal/retention rules remain controlled by FEAT-TRK/SHP/ENT-001.
On an open active Tracking view, web and mobile check for saved updates every
60 seconds while foregrounded. A manual refresh remains available. These
checks use the viewer's existing private projection and never extend the
five-minute verified-email deadline; hidden, completed and denied views stop.

Pending October26 provider-detail presentation keeps a single current-status
summary, the route map, focused update controls, shipment facts and dated history
in distinct sections on web and Android. Location data and map camera behavior
remain unchanged; the owner's US phone location is intentional. Recovery controls must match the server's
editable fields and actual eligible replacement vehicles. FEAT-TRK/MOB-001 owns
qualification; the public guest Track layout is unchanged by this work.

Featured automatically prepares up to eight eligible Transport Provider account
showcases per scheduled day, rotates accounts through complete rounds, and keeps
their eligible vehicles and assigned drivers within each account's presentation.
Manual days remain protected. The currently deployed morning window is
08:30–12:00 with four two-minute sponsor mentions. Rotation correctness must
cover later dates and exhausted rounds, not only today's populated demo.
The Featured header names the TikTok LIVE broadcast separately from the vehicle
timetable. It says when the broadcast is planned and says “TikTok LIVE broadcast
is on now” only after a permitted staff member confirms the stream has started.

Pending October26 Featured presentation shows AM/PM with EAT beside displayed
times, leaving canonical 24-hour schedule storage and calculations unchanged.
It omits the How Featured works disclosure and does not show a negative TikTok
strip when there is no scheduled/Live broadcast. The daily lineup remains
available independently of TikTok. FEAT-FTR-001 owns the display contract.

The latest accepted programme rule, pending implementation/rollout, replaces
that morning window with22:30–23:59 Africa/Addis_Ababa on the feature date.
At most eight accounts receive at least ten minutes each; all sponsor mentions
fit inside that same89-minute window. The heading is Daily Featured on TikTok
LIVE on web and Android. This identifies the programme; only a confirmed actual
broadcast is called on now. Past snapshots remain history, and incompatible
future manual schedules require exact review rather than silent rewriting.

## Product boundaries and presentation

Platform transport-arrangement chat, Brokerage permissions, guest-support intake
and the special Share with Loadgistic audience are retired. Software Support
remains for authenticated customer/provider workspaces. Loadgistic's separate
brokerage operation uses an ordinary Shipper / broker workspace and normal grants.
Retained history/compatibility code does not make a retired service active.

There is currently no enforced subscription, trial or platform payment workflow.
Paid Transport Provider and Shipper / broker workspaces are a future commercial direction; pricing,
payment and store-policy choices are not implemented and must not be advertised
as available. Keep the existing no-plan access and retired-payment denial rules.

English, Afaan Oromo and Amharic are the supported UI languages. Write natural
local phrasing around the task and audience, not literal translations or internal
implementation notes. Keep screens compact, saved records readable, edits
intentional and maps large. User-generated content, privacy/deletion, reporting,
review access, consent and notifications retain their existing policy contracts.
SEO applies to public discovery and profiles; private workspaces and verified
recipient data must not become crawlable.

Every screen should make the person's current task understandable and easy to
finish, including first-time users and internal teams. Organize around the work
and its related records, not the database schema. Empty states explain what the
person is seeing and give a useful next step; a new provider's empty Capacity map
must guide them to create and publish a first signal. Saved information is
readable before deliberate, focused editing. Actions have clear names and return
paths; loading, errors, retry and saved outcomes are part of the experience.
Icons support recognition but do not replace labels when the action would be
ambiguous. Apply the same care to public, provider, driver, business-team,
Support, staff and administrator workflows on web and Expo. Validate translated
intent, fit and task completion in English, Amharic and Afaan Oromo.

For shared workflows, phone use is the stricter design case: deliberately place
the primary task, touch targets, navigation, map overlays and return paths for a
small screen and one-hand reach before adapting that task structure to wider
screens. Clarity should come mainly from hierarchy, grouping, sequence and
focused disclosure. Keep explanatory copy brief and reserve it for a real choice,
consequence or unfamiliar action; do not make users read paragraphs to understand
the layout.

## Evidence and changes

The [feature index](../specs/TRACEABILITY.md) owns navigation to detailed contracts.
AGENTS and [production authority](PRODUCTION_AUTHORITY.md) govern engineering and
rollout. A local implementation, visual approval, passing focused test, CI pass,
installed-device check and hosted deployment are separate facts. Keep dated
receipts out of this brief; update its behavior only when accepted contracts
change. No hosted deployment is claimed by this documentation consolidation.
