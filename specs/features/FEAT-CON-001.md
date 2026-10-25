---
id: FEAT-CON-001
title: Account directory, connections and shared capacity
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-ENT-001, FEAT-SHR-001, FEAT-FLT-001, FEAT-VER-001, FEAT-FTR-001, FEAT-UIX-001, FEAT-TRK-001]
problem: People need one clear place to find transport accounts and manage connections, plus a Capacity map that can show only the vehicles shared with them. Email-only private Capacity makes the boundary and team experience unclear.
behavior: Directory requires an active signed-in account and holds discovery, requests and connection management. Capacity remains one destination with a map switch between public signals and current vehicle grants to the signed-in account or workspace. The shared view requires sign-in. Public Capacity and authorized public-link Tracking remain available without an account. Account and driver labels derive from current relationships and reviewed evidence, never a selected signup category. Featured rotates eligible provider accounts rather than vehicle-type days.
contracts: [AccountDirectory, ConnectionRequest, ConnectionDecision, AccountCapacityGrant, DriverVehicleShare, SharedCapacityProjection, AccountStatusBadge, ProviderFeaturedRound]
observability: [connection_requested, connection_approved, connection_declined, connection_revoked, account_capacity_denied, directory_count_visibility_changed, provider_featured_selected]
rollout: Introduce account-bound grants and requests. Remove obsolete demo email Capacity grants, challenges and their delivery jobs; constrain those legacy tables against new email access and exclude that path from private Capacity reads. Keep the visitor's Shared with you entry as a sign-in invitation; it never opens private rows anonymously. Keep public Tracking untouched. Convert Featured selection only after account eligibility, history and saved/manual-day rehearsals pass. Back up and rehearse the demo-data removal before any hosted rollout; roll back UI and new commands without deleting account request, grant or roster history. Never expose private rows through public discovery.
---

# October 24 account network change — approved for local build

The owner approved agent-led local visual review. This spec does not authorize a
hosted database write or a release. Implementation and test evidence belong in
`specs/TRACEABILITY.md` when they exist.

## The two daily destinations

Given a signed-out visitor opens public Capacity or a public provider profile
Then public discovery remains usable, while Network and Shared with you expose
no account list, request button or private vehicle data
And the Shared with you switch stays visible as a reason to join
And opening it leads to sign-in or account creation, not an email-only access form
And existing authorized public-link Tracking remains usable without an account.

Given an active provider, driver or shipper/broker account opens its workspace
Then Directory is a signed-in navigation destination with Find and Connections
And Connections contains pending, approved and revoked relationship tasks
And selecting Shared capacity inside the Capacity map shows only currently authorized vehicle signals without opening a separate navigation destination
And searching transporters within Shared capacity sees the same authorized
vehicles as its map, including only grants to the signed-in shipper/broker account
And the map empty state offers one route back to Find
And a connection can open its vehicles on the map, while a vehicle can open its
connection details without duplicating management controls on the map.

Given a provider shares a vehicle privately from web or Expo
Then they choose a registered shipper/broker account, directly or through an
accepted Network connection, without entering an email address
And that account's permitted Capacity team sees the vehicle after the share
And obsolete demo email Capacity grants, access challenges and delivery jobs are removed
And retired email-grant API and database mutation paths reject new grants.

## Connection authority

Given a signed-in account selects another eligible account in Directory
When it requests a connection
Then the recipient receives one pending request, not capacity access
And duplicate requests do not create duplicate grants or repeated alerts
And the requester's account identity, never a caller-supplied role or email,
determines the authority and destination.

Given a provider owner approves a request for its fleet
Then only the exact selected recipient account/workspace receives the explicitly
selected vehicles under each vehicle's current sharing mode
And business/team access is only for authorized members of that exact workspace
And a personal grant never silently becomes a business-wide grant.

Given an active driver has a current assigned vehicle and capacity-sharing
permission under its provider
When that driver approves a vehicle-specific request
Then only that current vehicle is shared
And reassignment, permission loss, inactive status or vehicle retirement
immediately removes the driver's grant authority
And the provider owner can inspect and revoke that vehicle grant at any time.

Given a grant is revoked, its recipient loses the corresponding private rows on
the next request; other grants, Tracking and audit history remain intact.

## Account identity and trust

Given a new person chooses Transport Provider or Shipper / broker before email
verification
Then the choice explains the intended workspace and survives the sign-in handoff
And each choice briefly previews its actual Capacity, Network and Tracking work
And the Transport Provider choice makes clear that one self-managed vehicle is
welcome, fleet management is available, and compatible GPS setup needs help
And the fuller About story remains readable on a narrow phone and in all three
supported languages without crowding the email/code form
But verified server-side membership and ownership, not that choice, authorize
workspace access; invited staff use their invitation rather than self-selecting
staff powers.

Given an existing person opens Sign in
Then it asks only for email and a verification code, with a clear Sign up link
And Sign up is a separate entry that explains and selects Transport Provider or
Shipper / broker before email verification
And an email new to Loadgistic reaches the account-type choice after its code
has been verified, without disclosing account existence before verification
And an active signed-in account returns to public Capacity unless it was opening
an intentional protected destination.

Given an account is displayed in Directory, Featured or a public profile
Then its primary status comes from its current provider ownership/financing,
active vehicle count and current driver relationship, or from its current fleet
employment/assignment for a driver account
And reviewed ownership, operating licence and permission are distinct evidence
badges; missing or expired review never becomes a verified claim.

For a signed-in Directory result, the status uses only currently published,
publicly visible vehicles. An employed assigned driver is a Fleet driver. A
provider with at least two such vehicles is a Fleet provider. A one-vehicle
provider personally driving that vehicle is Owner-operated only when ownership
is currently reviewed, or Licensed operator when their financed operating
licence is reviewed; otherwise it is Self-managed. A provider without a current
self-driving assignment is Account-managed. These are account operating styles,
not document-review badges or a grant of authority. An empty public fleet has
the generic Transport Provider label. Never reveal draft vehicle counts.

Given a shipper/broker owner chooses to show network size
Then signed-in accounts may see only a count of distinct currently connected
vehicles, not private vehicle identities or connection names
And the default is hidden, with immediate revocation when switched off.

## Featured and identity

Given automatic Featured prepares an unsaved Ethiopia-calendar day
Then it chooses distinct eligible Transport Provider accounts, independent of
vehicle type, from those not yet shown in the current cycle
And it starts a newly shuffled cycle only after all currently eligible accounts
have had a turn, avoiding duplicate accounts within one day
And a manually saved day remains unchanged and may deliberately repeat an
account; its selection is recorded so automatic scheduling does not immediately
repeat it by accident
And TikTok LIVE status continues to describe only an actual/scheduled broadcast.

Given the public or signed-in shell is rendered on web or Expo
Then it carries one Loadgistic header and navigation model: signed-out visitors
keep Capacity, Track, Featured and About in their existing order; their
Shared with you discovery/sign-in path also stays unchanged
And a signed-out person sees Sign in at the top right, while a signed-in person
sees their account control and only authorized destinations
And a Transport Provider's primary destination is Home, with My capacity for
an assigned driver, Manage vehicles for an authorized vehicle manager, and
Public capacity for viewing the open marketplace; each tab is present only
when its capability applies, except Public capacity which is always present
And a provider who drives and manages vehicles may switch among all three Home
tabs without losing access to either job, while a fleet driver sees no vehicle
management tab and a non-driving manager sees no personal capacity editor
And provider navigation has no separate Capacity or My Fleet destination;
Network, Tracking, Featured, Support, Account and About remain destinations
And a signed-in shipper/broker keeps Capacity as a navigation destination; its
map switch selects public or Shared with you without a second navigation item
And Capacity appears before Network on desktop and phone, with Featured as its
own marketplace destination
And the signed-in shipper/broker's Tracking destination opens the list of
shipments that workspace members may access, with role-authorized details and
actions after selecting a shipment; it does not ask for an email to find them
And provider Home's Public capacity tab never shows Shared with you or private
data; the signed-out visitor's existing switch and sign-in path remain unchanged
And each of the provider's own currently published public vehicles has a
distinct, labeled marker, including when nearby vehicles are clustered; its
Empty or Partial status color and location-source badge remain accurate
And this comparison cue comes only from the signed-in provider's authorized
vehicle workspace, never from a caller-supplied handle or a public claim
And public Track remains a visible navigation item for signed-out visitors;
it is not a signed-in workspace destination, although authorized public links
continue to work
And the signed-in directory destination is labeled Network
And signing in lands a provider on Home and a shipper/broker on Capacity unless
an intentional protected destination sent the person to sign-in; signing out
returns to public Capacity without a shell switch
And no Marketplace/My workspace switch is presented on web or Expo
And compact phone navigation places provider Home first, with Network and
Tracking directly reachable and the remaining destinations in More; About is
last, while visitor navigation remains unchanged
And the About footer on web and Expo says Jigjiga, Somali Region, Ethiopia
and identifies MarketVision Technology as the platform owner, with the company
name linked to https://marketvisiontech.com/.

## Build order and evidence

1. Inventory and test existing personal/team grants, visitor OTP and Tracking
   separation. Add account-bound projection and negative authorization tests.
2. Add requests/decisions, owner oversight, driver-assignment invalidation and
   account-scoped Directory with server-side concurrency/idempotence tests.
3. Align signup, shell, Directory/Connections and Shared capacity on desktop web,
   phone web and Expo. Verify English, Amharic and Afaan Oromo task wording.
4. Add derived account badges and the optional directory count with privacy tests.
5. Rework Featured provider rotation and admin manual controls with fairness,
   preserved-day, scarcity and four-week advancing-calendar tests.
6. Exercise the full visitor, driver, provider owner, business owner/staff and
   admin journeys in actual Chrome/Expo against local authoritative state; run
   source/type/build/quality gates once inputs are frozen. Release separately.

Tests: `tests/account-shared-capacity.test.mjs`,
`tests/sql/account-shared-capacity.sql`, `tests/account-directory.test.mjs`,
`tests/sql/account-connections.sql`, `tests/sql/account-directory-status.sql`,
`tests/account-directory.test.mjs`,
`tests/sql/featured-provider-rounds.sql` and affected web/Expo E2E journeys.
These are required evidence targets, not a claim that they already exist.
