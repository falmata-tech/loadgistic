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
  creating a provider account. Simple private Capacity and Tracking access uses
  email verification, without creating a team workspace.
- Transport Provider owners manage their vehicles, drivers, capacity, sharing,
  devices and Tracking. A driving owner or employee opens a map-based Home with
  immediate permitted work controls. A non-driving owner opens Fleet.
- Broker/shipper/receiver businesses use private Capacity and Tracking with their
  explicitly authorized team. A personal email grant stays personal; selecting
  a business explicitly shares with its permitted team.
- Platform administrators and assigned software staff manage customer accounts,
  software Support, document review and operational tools on the web. These are
  not customer-team roles and do not gain blanket private-location access.

Marketplace and My workspace are two areas of one application, with a persistent
switch and current workspace context. Group related management within the relevant
record or Account; avoid turning every database resource into another menu item.
Web desktop, phone web and Expo follow the same task structure where appropriate.
Admin and platform-staff management remain web-only.

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

Public and private projections disclose only authorized information. Individual
manager/driver identity uses first name only; private last/father name, login
email, device identifiers, raw location and private proof files remain private.
Companies retain their chosen account identity and safe reviewed-document facts.

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

Featured automatically prepares up to eight eligible vehicle/driver showcases
per scheduled day, prioritizes those waiting, and repeats eligible participants
when necessary. Manual days remain protected. The Ethiopia-time broadcast window
is 08:30–12:00 with four two-minute sponsor mentions. Rotation correctness must
cover later dates and exhausted rounds, not only today's populated demo.

## Product boundaries and presentation

Platform transport-arrangement chat, Brokerage permissions, guest-support intake
and the special Share with Loadgistic audience are retired. Software Support
remains for authenticated customer/provider workspaces. Loadgistic's separate
brokerage operation uses an ordinary customer business account and normal grants.
Retained history/compatibility code does not make a retired service active.

There is currently no enforced subscription, trial or platform payment workflow.
Paid provider/business workspaces are a future commercial direction; pricing,
payment and store-policy choices are not implemented and must not be advertised
as available. Keep the existing no-plan access and retired-payment denial rules.

English, Afaan Oromo and Amharic are the supported UI languages. Write natural
local phrasing around the task and audience, not literal translations or internal
implementation notes. Keep screens compact, saved records readable, edits
intentional and maps large. User-generated content, privacy/deletion, reporting,
review access, consent and notifications retain their existing policy contracts.
SEO applies to public discovery and profiles; private workspaces and verified
recipient data must not become crawlable.

## Evidence and changes

The [feature index](../specs/TRACEABILITY.md) owns navigation to detailed contracts.
AGENTS and [production authority](PRODUCTION_AUTHORITY.md) govern engineering and
rollout. A local implementation, visual approval, passing focused test, CI pass,
installed-device check and hosted deployment are separate facts. Keep dated
receipts out of this brief; update its behavior only when accepted contracts
change. No hosted deployment is claimed by this documentation consolidation.
