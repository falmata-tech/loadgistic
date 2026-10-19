---
id: FEAT-ENT-001
title: Business workspaces for shared capacity and shipment coordination
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-APP-001, FEAT-FLT-001, FEAT-CAP-001, FEAT-SHR-001, FEAT-TRK-001, FEAT-GPS-001, FEAT-SUP-001, FEAT-TRQ-001, FEAT-BIL-001, FEAT-ADM-001, FEAT-MOB-001, FEAT-UIX-001, FEAT-PLY-001, FEAT-VER-001]
problem: Brokers and cargo-owning businesses need a team workspace over explicitly shared capacity and Tracking, while individuals must retain free email access and Loadgistic software operations must be separate from its brokerage business.
behavior: The backed-up October18 local preview retains Marketplace and My workspace, adds workspace-scoped business teams, retires platform transport-arrangement chat and special Loadgistic access, and separates shipment route/status access from explicitly granted truck-location access. Commercial entitlements remain planned and disabled; hosted rollout is not claimed.
contracts: [SelectedWorkspaceContext, BusinessMembership, BusinessInvitation, BusinessCapacityGrant, ShipmentViewerInvitation, ShipmentLocationGrant, ShipmentLocationProjection, WorkspaceEntitlement, BrokerageRetirement]
observability: [workspace_membership_audit, private_share_audit, tracking_viewer_audit, tracking_location_grant_audit, denied_workspace_access, retired_brokerage_denial, commercial_entitlement_outcome]
rollout: Confirm the interface and open commercial decisions, implement additive scoped contracts and compatible retirement, rehearse against a protected local restore and test web/Expo workflows; obtain visual approval before full release gates and exact backup/migration approval before hosted rollout. No payment, migration, account conversion or data sharing is authorized by this draft alone.
---

# October18 business workspace plan

Status: **design approved October18; connected local implementation under review**.
The October18 user direction supersedes the earlier brokerage-revenue-only
direction. Web/Expo connected flows and additive SQL are installed and tested
locally; the hosted application retains its previous behavior until a separately
reviewed release. Pricing, payment and commercial restrictions remain unimplemented.
ADR-081 records the proposed architecture. Earlier pending dashboard/GPS work
is preserved; it is not restarted, discarded or claimed deployed.

## October18 customer company identity and provider-only directory — local plan

Broker/shipper/receiver workspaces choose their company name and unique account
handle. The account manager is the current business owner's explicitly configured
first name only; private Last/father name and login email are never search fields.
The handle namespace is shared with provider profiles, but customer directory
records never become public `/@` transporter pages. Existing collisions stop
reviewed migration preparation rather than silently renaming accounts.

Only a currently authorized Transport Provider owner or employed driver with
provider workspace access can browse/search the business directory. Business
membership, a generic SHIPPER role, or platform staff status alone is not that
permission. The directory lives in Network → Find businesses on web and Expo;
no extra main navigation item is needed. Existing capacity-sharing business
selection remains separate and repeats its own truck/edit permission checks.

Directory cards expose company name, handle, first-name-only manager, business
kind, voluntarily supplied general office city and safe reviewed-document badges.
They expose no login email, phone inferred from a login, staff directory, raw
coordinates, document IDs, Storage paths, private filenames, review notes or
reviewer identity. Exact published proof files remain unavailable to directory
viewers. Search ranks company name, handle and manager's first name; pagination,
current provider authority and active-business checks are server-side.

Business owners may optionally submit Business licence, Manager National ID and
Business address documents through Account → Documents. The same private media,
normal Pending/More info/Rejected/Approved workflow and existing administrator/
assigned Trust review queue apply. No document is required for business account
access and no truck-ownership, licence-holder or vehicle permission control is
presented. An ordinary business teammate sees only the safe current summary;
only the current owner manages files/submissions, and Trust access is rechecked.

Changed company identity/address or manager ownership/name makes the applicable
review stale without rewriting its terminal history. A new owner cannot read a
previous manager's National ID. Expired, stale, suspended, archived or erased
subjects contribute no reviewed badge. Rejected/More info/stale/expired evidence
can be replaced by a new normal Pending submission; simultaneous duplicates
serialize. Account erasure retains only required history and scrubs private file
references through the existing verified cleanup workflow.

Acceptance: anonymous, pure customer, suspended provider and foreign workspace
reads deny; normal provider sees only safe names/badges; owner submits a private
file; wrong owner/member denies; Trust requests More info then replacement and
approval; existing provider verification stays intact; identity change removes
badge; documents remain optional; no business verification can qualify a fleet.
Tests: planned `tests/business-directory.test.mjs`,
`tests/sql/business-directory-verification.sql` and actual provider/owner/Trust
Chrome workflows after backed-up local rehearsal. No hosted change is authorized.

## Confirmed owner decisions

- Remove transport-arrangement intake/chat everywhere: public, providers, Expo,
  platform staff and administrators. Loadgistic software staff provide software
  support/management only. Remove the special Share with Loadgistic audience.
- Loadgistic's brokerage uses an ordinary business customer workspace, without
  special private-capacity or shipment privileges. Leads are collected elsewhere.
- Transport Provider and broker/shipper/receiver workspaces will be paid.
  Public discovery and simple email-based private Capacity/Tracking remain free.
- Business customers have their own administrators and staff. Those employees
  are customer users, never platform Support staff.
- Capacity sharing explicitly targets either a named email address, for that
  person only, or an existing business found through business-account search.
  Selecting that business authorizes its permitted team members; no extra
  recipient acceptance or repeated per-employee consent is needed for this grant.
- Provider shipment creation asks for exactly one shipment-owner email.
  That verified recipient may invite other status/route viewers.
- Live truck position is available to the shipment owner and **explicitly
  authorized staff**. Merely joining the business or becoming its admin does not
  grant live position. Ordinary invited viewers never receive it.
- Truck location must work from the selected GPS, phone or manual source.
  A manual report is a dated reported point, not simulated live movement.
- Make location circles smaller, without excessive precision, on both Capacity
  and Tracking. See the exact radius proposal below.

## Interface: two areas, one sign-in

The persistent area switch remains **Marketplace | My workspace**, in the same
place on desktop, phone web and Expo. Selecting an area restores its last useful
page/map state. It does not log the person out or blend the two data scopes.

The public account entry becomes **Sign in**, because provider owners, drivers
and business customers all use it. Unknown verified identities deliberately choose
Create a Transport Provider workspace or Create a business workspace. Staff join
by invitation, rather than choosing a privileged staff role at signup. Free
recipient access continues to have its own clear email entry and never forces
account provisioning, a subscription or a provider signup.

One verified person can belong to multiple customer/provider workspaces. A
workspace-name selector appears when useful, showing the current business and
the person's role. Switching requires current server-verified membership and
separate saved state. Existing global platform admin/Support accounts remain
web-only and separate; no silent mobile-access or privilege conversion.

| Context | First screen | Desktop navigation | Phone web / Expo primary navigation |
| --- | --- | --- | --- |
| Marketplace | Open capacity map | Capacity, Tracking, Featured, About; Sign in/My workspace | Capacity, Tracking, Featured, About |
| Free private Capacity | Same simple email-verified private map | Shared records only | Same map; no enterprise Team/Billing |
| Free Tracking | Email-verified shipment/route | Only shipments authorized for that verified email; no team inheritance | Map, compact progress panel, owner sharing if authorized |
| Provider owner who does not drive | Fleet | Home/Fleet, Tracking, Network, Account | Home, Tracking, Network, Account |
| Driver / driving provider owner | Assigned truck map | Home, permitted truck/Fleet, Tracking, Network, Account | Existing map Home and permitted work; no extra generic dashboard |
| Business owner/admin/staff | Private Capacity map | Capacity, Tracking, Account | **Capacity, Tracking, Account** |
| Platform admin/software staff | Existing software operations/support | Assigned Accounts, Support, Reviews, Featured and operational tools | Responsive web only; no Brokerage |

Team, business details, subscription and software Support are grouped inside
Account. Only authorized users see Team/commercial controls. Team members get a
saved list with role/access badges; Add/Edit/Remove are deliberate tasks. Do not
turn every permission/resource into a new top-level page or expose raw roles.

### Capacity is the business Home

The business opens directly on a large map. Reuse the current map, truck filters
and independent Transporter search panel. Companies appear in profile search;
only their permitted truck/driver combinations appear on the map. Selecting a
profile filters its trucks only after the explicit existing action.

The page has no email challenge for every visit: membership provides the signed-in
business context. It shows only authorized shares, not all publicly available
trucks disguised as a private network. A visible business name makes the scope
clear. Marketplace remains one tap away.

Personal email grants remain personal, even for a workspace owner. They may be
shown to that same verified person within the workspace for convenience, labelled
Private to you in details; they are never inherited by other staff. Business/team
grants are shown to permitted members of the exact recipient workspace.

### Tracking is the second daily task

Tracking starts with a compact shipment list, including assigned/relevant work,
in progress and completed states. Opening a shipment gives the existing large
route map and readable status progression, not a stack of management forms.
Owner-only completion/proof controls remain explicit tasks. Providers remain
responsible for reporting their shipment's operational events; buying a customer
workspace does not permit rewriting provider events or changing assigned trucks.

Owner and authorized staff see the latest permitted truck point, its radius,
source and actual update time. Other viewers see **Shipment route** and status
only. Do not show a truck marker, a location-loading message or a hidden location
payload for a status-only viewer.

## Sharing: person versus business

The provider or authorized driver chooses **Email address** or **Business
account** when sharing capacity. Email takes a contact name and email and grants
only that verified person access. Business account searches registered recipient
businesses and lets the publisher select the exact business by its public name,
handle and appropriate disambiguating public information. Do not require an
email first or guess a business from an address, company-looking name or domain.

Business selection makes the audience clear: **Their permitted team members can
view these signals.** Saving that selection grants the business access directly;
there is no additional recipient-acceptance gate or per-employee approval by the
provider. Current business membership and Capacity-view permission control which
employees can use the grant. Later permitted employees of that same business
inherit it; removed or suspended employees lose it. Search returns only the
minimal public business identity, never private staff emails or customer data.
The saved sharing list distinguishes the person from the business and its team.
Business search belongs to authenticated sharing, not a new public broker/demand
catalogue. Only active recipient businesses are selectable; final authorization
uses the exact saved business identity, not display text or the search result
snapshot.

An existing personal grant stays personal. Upgrading it to a team grant requires
the publisher's deliberate approval. Exclusive-to-one-email grants keep that
meaning; they cannot become team access unless the provider changes the sharing
choice. Removing a team member removes access, without removing the provider's
grant for the rest of that business. Revoking the provider grant removes it for
everyone. There is no automatic conversion of LOADGISTIC grants to the separate
Loadgistic brokerage business.

## Tracking access model

The four authorities below are independent. Do not infer one from another.

| Action/data | Primary shipment owner | Explicitly authorized business staff | Ordinary invited viewer |
| --- | --- | --- | --- |
| Route and status | Yes | Only this workspace/assigned shipment's grant | Only the invited shipment |
| Current approximate truck location | Yes | Only an explicit current grant from the owner for this shipment | No |
| Invite/remove status viewers | Yes | No | No |
| Loading/unloading proofs and arrival approval | Existing owner rights | No automatic proof/approval authority | No |
| Change provider-reported events | No | No | No |

The provider enters one **Shipment owner email**, not a list of parties. After
verification that owner can use **Share tracking**, add a name/email and send a
status-only invitation. Recipients verify their own email; forwarding a URL does
not transfer another person's authority. Invitees cannot re-share or upgrade
themselves. The owner can revoke access and see who was invited.

An owner who belongs to a business may explicitly add the shipment to that
workspace and choose its staff access. This is per shipment, not a way to copy
the owner's whole private inbox. Within Share tracking, an owner can grant
selected current staff **Allow truck location**; it is off by default and cannot
be self-enabled by another business administrator. Viewer management and arrival
approval remain with the primary owner; neither delegation is included in this
change. Other business coordination uses the staff's granted route/status access.

The free owner retains sharing, proofs, arrival approval and the existing
five-minute verification session. A paid business membership may use normal
member authentication for its authorized workspace. Unloading approval remains
bound to the primary owner's existing five-minute fresh-verification protection
regardless of subscription; normal workspace login does not bypass it. Commercial
status is not a substitute for shipment permission or fresh owner verification.

New email-only invitation audit must represent the verified recipient actor.
Existing created_by/revoked_by references require a member profile and cannot
be reused by inventing an account or impersonating the transporter.

Status-only projections must omit current coordinates, uncertainty radius,
location area/time/source, telemetry and historical fixes before SQL/API/HTML,
notifications or Expo state receive them. Proof URLs/downloads stay owner-only
by default, as the requested limited view is route/status. Public capacity
signals remain governed separately by the provider's chosen public/private
audience; restricted Tracking does not silently privatize public trucks.

## Local truck source and radius contract

The local preview now resolves shipment location independently from Capacity,
using the selected GPS, phone or dated manual source. Migration158 and the
source/assignment/privacy regression suite establish that local behavior; hosted
Tracking retains its previous code until the exact migration/application release.

The resolver binds the current shipment, truck, driver/device assignment and
source revision. Selected GPS reports must belong to that exact active device
assignment. Phone reports must come from the current assigned driver's authorized
session. Manual reports retain their actual saved point/time and Manual label.
Switching source waits for a valid new-source report; old-source data cannot be
relabelled or silently used as a fallback. Stale reports say last updated rather
than pretending to move. Terminal shipments stop location updates. Tracking
location duty, unfinished-shipment restrictions, both mandatory photo proofs,
owner unloading approval and staff appeal rules remain intact.

New local choices after the owner approved the interface/radius direction:

| Surface | Historical maximum preserved on old fixes | New maximum | New choices | Default for new setup |
| --- | --- | --- | --- | --- |
| Capacity, all sources | 40 km | **20 km** | 1, 3, 5, 10, 20 km | **10 km** |
| Tracking, all sources | 20 km | **10 km** | 1, 3, 5, 10 km | **10 km** |

No sub-kilometre option is added. Existing reports retain their honest radius
until a fresh valid fix or deliberate manual re-save. Never relabel a 40-km
obscured point as 20 km or re-obscure an already obscured point and imply greater
accuracy. Apply changed privacy with clear provider controls and fresh source
data; do not mass-publish more precise historical locations.

## Planned paid workspace and free access

Commercial rules below remain planned. No checkout, charge, paid restriction or
subscription-management screen is enabled by this local implementation.

The subscription belongs to the provider/business workspace, not every invited
employee or every free recipient email. Separate memberships do not copy payment
or data privileges between businesses. Account exposes subscription management
only to the workspace owner/appropriate commercial administrator.

Public browsing, individual private Capacity, individual Tracking and its safety/
completion actions remain free. A payment lapse must not delete records, revoke
an individual's separate free grants or prevent safe completion/approval of
ongoing shipments. Recommended commercial rollout preserves existing work with
an explicit grace/read-only policy before restricting new paid coordination.

Prices, included staff, billing interval, payment method, launch grace and exact
lapse rules are still commercial decisions. Do not invent them or activate old
trial/payment-proof paths. Google Play software-subscription purchase rules
need their own reviewed mobile checkout design before selling inside Android.
No prices, charges, checkout dependencies or payment credentials are introduced
by this planning task.

## Retire platform brokerage completely

Retirement includes public/native widgets and routes, staff/admin queues and
Team responsibilities, HTTP and service-role RPCs, saved visitor sessions,
deep links, read receipts, alert production and queued guest push. Deny old
clients too; do not merely hide the buttons. Retire only Brokerage delivery;
software Support and handover notifications keep working.

Remove LOADGISTIC audience creation and all corresponding private/ranked read
paths, not just the Network button. Preserve ordinary EMAIL/team and Public
sharing. Platform brokerage-only staff receive no automatic Support or customer
membership; an administrator must assign legitimate software responsibilities.
Use a compatible migration before removing historically referenced columns.
Preserve private history/audit by default; deletion is not required or bundled.

Given a visitor reads Platform Terms in any supported interface language,
when they reach Direct agreements, then the page describes agreement between
the customer and transporter without promising retired Loadgistic brokerage
service or fees. On phone layouts, each paragraph keeps a readable text width.

## Architecture and lifecycle requirements

- One verified identity plus explicit selected workspace, active membership,
  per-workspace role/permissions and independent resource grant on every read/
  command. A client-selected ID, company name, old global enum or stale JWT claim
  cannot establish workspace authority.
- Workspace invitations are distinct from platform Team creation. Verify the
  invited email, exact business, inviter authority, expiry and one-time acceptance.
  Protect last-owner handover/removal and owner account deletion. Revoke access
  immediately on staff removal/suspension; preserve attributable history.
- Scope caches, drafts, location state, pending requests, notifications, push
  installation subscriptions and return navigation by actor **and workspace**.
  Membership/location revocation clears stale private maps, including late
  responses. No cross-workspace stream or browser state reuse.
- Extend existing software Support eligibility to business customers without
  reopening anonymous general help or conflating enterprise employees with
  global Support agents. Preserve platform staff's existing web-only boundary.
- Keep existing transport/provider identity anchors and history. Do not revive
  dormant demand/loadboard/bidding code or change shipment ownership from a
  legacy SHIPPER/RECEIVER enum. No new database reset is part of this plan.

## Ordered implementation and review gates

### Backend foundation contract (migration160)

The additive customer-business identity is `business_workspaces`, separate from
provider `organizations`, so its memberships cannot change the existing
OWNER-first provider projection or grant fleet authority. `business_workspace_members`
binds a verified person to an exact business with OWNER/ADMIN/STAFF and explicit
Capacity/Tracking permissions. The returned application role is CUSTOMER; a
pristine Auth placeholder may use legacy SHIPPER storage only during explicit
verified creation/acceptance. This enum never establishes authority. Existing
provider/driver anchors and platform staff are not converted.

Every application operation receives a server-verified actor and an explicit
workspace ID. A saved current-workspace choice is presentation state, revalidated
on reads, never membership authority. RPCs and tables deny browser access;
service adapters and SQL repeat current verified-identity/membership checks.
Workspace/member revisions bind writes and give clients a cache invalidation
key. Revoked, suspended and foreign memberships cannot use saved selections.

Owners/admins deliberately invite ADMIN/STAFF with explicit permissions. Only
owners manage administrators; admins manage ordinary staff. Invitations expire
after seven days and are accepted once by their exact currently verified email;
knowledge of an invitation ID alone grants nothing. Expired/revoked invitations
do not activate identities. Pending invitations are durable; the existing managed
email adapter sends after persistence with a bounded delivery lease and deliberate
resend. Failed delivery leaves the invitation available and is reported honestly;
it never rolls back or invents acceptance. SMTP inbox and eventual signup/interface
integration require their separate connected checks. No Auth user is created by
inviting an email. Current eligible business members can use software Support;
legacy SHIPPER/RECEIVER storage roles alone cannot grant Support access.
The existing software Support alert snapshot applies the same current business
membership rule. It exposes only the requesting person's own conversation
summaries, never a colleague's chats or platform work queues. Revocation,
archival, suspension and Auth deletion remove this authority immediately;
retired Brokerage and anonymous arrangement-chat access stay closed.

Only an owner transfers ownership to an active, verified existing member. The
old owner becomes an administrator; transfer is atomic. Last-owner removal,
leaving and physical account deletion are denied while a business is active.
Archiving is an explicit owner-only terminal access revocation; it preserves
membership/history and permits later normal account offboarding. Global account
suspension still revokes all access immediately and is not bypassed by business
membership. No billing, entitlement or new location grant is introduced here.

The real retained-stub account-erasure adapter also checks business ownership
before any erasure begins. It records an actionable handover/archive hold for the
last owner, preserves existing provider/fleet/Tracking/GPS privacy holds, revokes
customer memberships, selections and invitations when erasure begins, and scrubs
the erased person's invitation email when the existing verified cleanup completes.
Software-account deactivation has the same ownership guard and immediate access
revocation. An archived workspace retains pseudonymous business history.
Migration164 keeps erased former team members as pseudonymous directory entries
without Auth contact information. A null/erased Auth email cannot invalidate the
whole Team directory. Erased entries cannot be edited or reactivated through UI;
SQL still denies every deleted identity. Existing active memberships and grants
are preserved. `tests/sql/business-directory-retention.sql` covers the projection
for managers and ordinary staff after Auth deletion.

A current verified business member using neutral SHIPPER storage may explicitly
create a provider workspace through the existing consent/onboarding workflow,
only if no provider, company, driver, application or platform-staff anchor exists.
Provisioning preserves business memberships and does not convert a platform or
suspended account. Existing provider/driver identities never become eligible for
duplicate provisioning. Completing onboarding may then deliberately select the
provider context; clearing a selected business never creates provider authority.

Given two businesses and one verified person\
When a request names the other business or uses a removed membership\
Then the SQL permission check denies that exact context, including saved selections.

Given a pending invitation for a verified email\
When another email, an expired/revoked invite or an already accepted invite is used\
Then no membership, profile activation or selection is created.

Given the only owner of an active business\
When they leave, are removed, or their account is physically deleted\
Then ownership handover or explicit business archival is required first.

Foundation verification: `tests/business-workspaces.test.mjs`,
`tests/business-workspace-api.test.mjs`,
`tests/business-workspace-sql-contract.test.mjs` and
`tests/sql/customer-business-workspaces.sql`. Isolated SQL restore/runtime and
actual local SMTP/web create/invite/accept/permission-revoke flows pass; see
`specs/TRACEABILITY.md`. Actual Expo and hosted installation evidence are tracked
separately; browser preview does not prove physical-device behavior.

1. **Approved October18:** the owner approved the desktop/phone UI concept and
   seamless area switch100%. Preserve the already-confirmed email versus
   selected-business sharing decision. Actual changed workflows still need their
   focused connected checks and visual review before full release gates.
2. Add workspace membership/context, invitations and lifecycle contracts with
   negative permission tests; preserve existing provider/driver behavior.
3. Add separate email/team capacity grants, single-owner Tracking, owner-issued
   viewer/location grants and privacy-safe projections. Rehearse additive SQL.
4. Connect all-source shipment location and the fresh-fix radius policy; verify
   source changes, stale/foreign reports and assigned-truck changes.
5. Retire platform Brokerage/LOADGISTIC server capability and old client access,
   then remove every web/Expo/admin/staff entry and associated copy.
6. Build role-appropriate web/phone/Expo navigation and enterprise maps/Tracking/
   Team, retaining the existing fleet and map components wherever sound.
7. Add commercial entitlement adapters only after pricing/payment/store choices;
   no accidental charges or old plan resurrection. Update copy in all languages.
8. Exercise actual provider → business owner → authorized staff → restricted
   viewer workflows; verify API/database outcomes, email, revocation, independent
   workspaces, support, deletion, expired plans/sessions and older clients.
9. Obtain visual approval, then full gates and a separately reviewed exact hosted
   rollout/backup/rollback. Publishing a new Android build is a later verified
   operation, not a consequence of approving a sketch.

## Acceptance scenarios

Given a visitor opens Marketplace without an account\
When they browse or verify an existing individual share\
Then public browse and email-specific Capacity/Tracking remain free\
And no team membership, plan or provider signup is inferred.

Given an active business member opens My workspace\
When their current business is selected\
Then Capacity opens the scoped private map and Tracking is one primary tab away\
And other memberships, another person's email grants and revoked grants are absent.

Given a provider deliberately shares with one named business team\
When an authorized member opens that workspace\
Then only that exact business grant and the member's current permissions permit access\
And an email-only or exclusive-to-email grant never becomes a team grant implicitly.

Given a provider or authorized driver selects Business account while sharing\
When they search for and save an existing business\
Then the selected business's permitted staff can access the signals directly\
And the interface clearly states team access before saving\
And no email-domain inference, recipient acceptance or repeated staff approval is required\
And business search exposes no private membership or employee contact details.

Given a provider creates Tracking\
When they submit more than one primary-owner email or any additional-recipient fields\
Then the backend rejects that creation contract without partial publication\
And exactly one owner may invite status-only viewers after verification.

Given an owner authorizes selected staff to see a shipment's truck location\
When owner, authorized staff and ordinary viewers open the same shipment\
Then only owner/currently authorized staff receive the obscured selected-source position\
And ordinary viewers receive route/status only with no location/proof fields\
And only the verified primary owner retains arrival approval.

Given source, assignment, membership or location permission changes\
When an old request/report/stream or cached view attempts to return\
Then current authority, source revision and assignment are rechecked\
And revoked/foreign/old-source location cannot become the displayed current point.

Given platform transport-arrangement service is retired\
When an old web/Expo token, RPC, link, queue or LOADGISTIC audience is used\
Then it cannot create/read/manage the retired service or privileged capacity view\
And software Support, ordinary customer brokers and handover alerts still work.

Given a workspace payment lapses\
When a person opens their independently granted free shipment access\
Then its safety, proof and approval workflow is not held for payment\
And historical records are preserved while paid coordination follows its reviewed policy.

Tests: implementation test ownership belongs to workspace identity/invitation/
revocation, capacity team-grant, Tracking-view/location-source, retirement and
entitlement domain/SQL/API regressions plus actual Chrome desktop/phone and Expo
workflow acceptance. Those tests are **not implemented or passed by this draft**.

Design sources: [Android navigation](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns),
[named workspace switching](https://help.shopify.com/en/manual/your-account/logging-in/store-switcher),
[Google Play software payments](https://support.google.com/googleplay/android-developer/answer/10281818).
