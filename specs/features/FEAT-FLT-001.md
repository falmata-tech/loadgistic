---
id: FEAT-FLT-001
title: Fleet driver access and owner controls
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-SHP-001, FEAT-CAP-001, FEAT-TRK-001]
problem: Fleet owners need Drivers to publish assigned-truck capacity and operate assigned shipments without surrendering company ownership or unrestricted commercial authority.
behavior: Every Transport Provider owner may manage multiple Draft trucks and employed drivers within their exact organization or personal-provider scope. One truck may go Live without document approval; additional Live trucks require exact reviewed ownership or an operating licence in the provider's name for their owned or financed truck. Employed drivers control at most one current assigned truck with owner-granted permissions. A driving owner keeps map Home and one explicit driving assignment. Ownership, financing and drive/manage permission remain distinct, and all changes preserve history and unfinished Tracking. A rigid truck has one fixed configuration; a tractor exposes only its currently attached trailer.
contracts: [FleetDriverInvitation, FleetDriverMembership, DriverContactCommand, DriverOffboarding, DriverPermissionPolicy, DriverVehicleAssignment, ProviderVehicle, VehicleDetailsCommand, InterchangeableTrailerSet, AttachedTrailerCommand, DutyCommand, OwnerOversightProjection]
observability: [driver_permission_audit, driver_duty_audit, vehicle_configuration_audit, denied_driver_command, update_actor]
rollout: Add service-role-only PostgreSQL workspace and atomic Driver-access commands with conservative defaults, retain transporter-owner access, and roll back by hiding owner controls while preserving stored settings; local development, Preview, and Production never fall back to SQLite.
---

# Fleet driver access

October20 local correction: FEAT-SHR-001 / NR-60 requires the same employer-scope,
capacity permission and current assignment for employed drivers of both personal
providers and organizations. Migration180 repairs the older sharing predicate;
`tests/sql/personal-fleet-capacity-sharing.sql` and the real onboarding journey
cover explicit sharing-mode saves rather than only legacy capacity payloads.
No employee fleet-management or document-review permission is added.

## October18 courier configurations — planned local restoration

The latest owner request supersedes the September25 courier retirement below.
`Courier car` and `Courier motorcycle` are supported fixed configurations with
their existing distinct illustrations. Owner-scoped Add/Edit commands and both
web/native pickers accept their exact catalogue values; unknown configurations,
foreign vehicles and employed-driver fleet mutations remain denied. Neither
type can masquerade as an interchangeable tractor or acquire trailer options.
Registration still creates Draft inventory only; Live qualification, current
driver pairing, ownership/use basis and unfinished Tracking protections remain.

Given an authorized provider adds or edits either courier configuration\
Then the saved record retains that exact configuration and its matching artwork\
And no capacity, assignment, reviewed authority or publication is inferred\
And an active shipment continues to prevent identity/configuration edits.

Migration168 will narrowly restore the installed command/filter allowlists and
remove the obsolete courier-only write rejection without rewriting stored
vehicles, assignments or saved rosters. SQL and client tests precede local review;
hosted installation remains separately authorized.

## October15 exact selected-driver detail — local repair in progress

Given a provider opens the driver assigned to a selected owned truck\
When that driver is outside the first page of the Drivers list\
Then the saved driver detail resolves by exact ID through persisted owner scope\
And pagination size is not expanded and unrelated pages are not scanned\
And the existing minimized assignment/permission/document-summary shape is retained.

Given the actor's ownership, target membership, activity or assignment changes\
When the exact detail is read or returned\
Then existing persisted scope and exact assignment checks deny stale/foreign data\
And an invalid or unavailable selected driver is explicit, not a silent page-one
fallback or an editable unrelated record\
And private file paths and credentials never enter the detail projection.

Tests: focused exact-reader positive/negative/revocation/assignment cases, plus
an actual local larger-fleet off-page driver navigation and foreign-target denial.
No new database schema, target impersonation or hosted operation is required.

## October 14 unified provider-owner fleet — implemented locally

This accepted change supersedes the October7 one-current-truck limit
for provider **owners** only. Historical one-truck test evidence below describes
the earlier policy, not the new contract. The reviewed source is installed in the
backed-up local preview; focused SQL, concurrency and adapter checks pass.
Actual desktop/phone web and Expo browser acceptance now passes; owner visual
approval, full release gates and hosted rollout remain separate gates. See the
October14 evidence in `specs/TRACEABILITY.md`.
ADR-079 retains identities rather than converting personal accounts to companies.

### Scenario: public driver labels do not imply ownership or employment

Given a truck has a current eligible assigned driver, whether its provider owner
or an employee under an organization or personal-provider account\
When its public/private capacity, profile roster or Featured card is rendered\
Then the person is labelled Driver and the account remains Transport Provider\
And driver documents follow the actual assigned subject, without inferring
employment, ownership or reviewed authority from the provider's legacy category.

### Scenario: every provider owner manages a fleet

Given an active organization owner or personal provider-profile owner\
When they register trucks or manage their employed drivers\
Then both use the same owner-scoped fleet commands and may add multiple trucks\
And Auth IDs, provider IDs, historical subjects, files, shipments and sharing
relationships are preserved\
And an employee cannot obtain provider-owner capabilities through an employer link.

### Scenario: one actual driver, one current truck

Given a provider owns several trucks and may personally drive one\
When assignments change or concurrent commands assign trucks\
Then explicit current assignments enforce at most one active truck per driver
and one active driver per truck\
And adding a second personal-provider truck never implicitly assigns its owner\
And driver-specific permissions/documents do not transfer across reassignment\
And unfinished Tracking still prevents an unsafe reassignment or retirement.

### Scenario: a new driver does not inherit the previous driver's signal

Given a current truck changes its active driver assignment\
When the new pairing commits\
Then a fresh Off Duty signal prevents the old driver's capacity and obscured
phone position from appearing as the new driver's report\
And old capacity/location/route/document history remains on its original pair\
And the truck's owner-managed sharing preferences and named contacts are retained\
And the new assigned driver must publish their own current signal/location\
And an unchanged assignment is idempotent and cannot reset a current signal.
This closes the previously recorded WEB-MOB-024 data-integrity gap as part of
explicit pair authority; it does not copy old routes to the replacement driver.

### Scenario: mobile Home follows a changed assignment

Given a signed-in driving owner or employed driver was assigned truck A\
When an authorized assignment changes to truck B and the app loads current
capacity/fleet data\
Then Home displays only the server-authorized current pair for that same actor\
And an old vehicle ID cached at sign-in cannot hide truck B or keep truck A\
And the fleet assignment and permission controls reflect the saved server state\
And the app does not require sign-out or rotate credentials merely to select
the current truck; every mutation retains existing backend authorization.

Verification: a focused current-pair regression and actual Expo-browser owner
A-to-B reassignment, including retained editor state and employee scope.

### Scenario: adding is distinct from going live

Given any provider owner registers a truck\
When registration succeeds\
Then it starts Draft and is available in their private fleet controls\
And it is absent from public/recipient discovery, Featured and public profile
truck lists until explicitly taken Live\
And Live remains distinct from retirement, capacity availability and
PUBLIC/PRIVATE/BOTH/EXCLUSIVE audience selection\
And an otherwise Live private truck is never made public by publication alone.

### Scenario: one truck may go live without document review

Given an active provider owner has no other active Live truck
When they explicitly take a Draft truck Live
Then no document approval is required for that first truck
And missing exact authority is visibly Not yet verified, with concise guidance
that users must confirm the details directly
And owner, assigned-driver, duty, location, content and sharing rules still apply.

Given two commands concurrently try to take different unreviewed trucks Live
Then an owner-anchor lock permits only one and rejects the other with the
one-truck limit; it must not leave two active Live trucks.

### Scenario: a reviewed qualifying truck unlocks a fleet

Given a provider has an active truck with current unrevoked Loadgistic review
confirming their ownership, or confirming the operating licence is in their
name for a truck they own or are buying through financing\
When they take an additional truck Live\
Then the database repeats exact owner scope and qualifying-evidence checks\
And other trucks may go Live with their own unverified status shown\
And self-declared OWNED/FINANCED, rented/permission-only evidence, another
provider's document and driver-only permission cannot unlock more than one Live truck\
And the qualifying truck may itself be Draft, preventing a circular requirement.

### Scenario: loss of qualification is safe and visible

Given qualifying evidence expires/is revoked or its truck is retired\
When capacity/public fleet/Featured eligibility is evaluated\
Then a single active Live truck remains eligible without document approval
And multiple active Live choices are withheld while no current qualifier remains
until the owner moves all but one to Draft or supplies a qualifying review\
And the owner sees the reason and can review or replace the qualification\
And stored Live choices, private recipients, history and proofs are retained\
And ongoing authorized Tracking remains accessible and completable\
And restoring a retired truck returns it to Draft before explicit Go Live,
so restoration cannot bypass the one-unreviewed-Live limit
And changing a truck does not copy ownership or permission approval.

Contracts: ProviderOwnerScope, ProviderWorkspaceCapabilities,
ExplicitCurrentDriverAssignment, ProviderTruckPublicationCommand, TruckUseBasis
(OWNED/FINANCED/PERMISSION), ProviderPublicationEligibility. Tenant boundaries use
exact organization XOR personal-provider owner anchors. Local/hosted rollout must
inventory existing live signals and approvals without inventing provider ownership.
Legacy publication flags may be retained, but eligibility is not grandfathered by
an unreviewed claim. Activate only after backed-up rehearsal, impact review,
compatible adapters and owner approval. Roll back clients/commands without deleting
new fleets, documents or assignments; restoring the old one-truck unique index is
unsafe after valid multi-truck writes and requires an explicit reviewed plan.

After Draft trucks or qualification-gated signals exist, retain the publication,
qualification and discovery gates during an application rollback. Migration146's
function-restore rehearsal proves restoration of function metadata; it does not
prove that restoring the earlier discovery rules is safe for newer records. That
earlier restore approach removed those gates while leaving migration150's
compatibility marker in place. The shipped146 rollback artifact now rejects
execution before mutation with `PROVIDER_AUTHORITY_FORWARD_REPAIR_REQUIRED`.
`tests/sql/provider-authority-rollback-denial.sql` must execute that exact artifact
in isolation and prove the function metadata, publication trigger and runtime
marker are unchanged; the exact-artifact denial passes in the fresh v3 rehearsal
with unchanged catalog metadata. Prefer a
compatible application rollback or a separately reviewed forward containment
plan that preserves Draft/private boundaries, current authority reviews, fleet
erasure protections and ongoing authorized Tracking. Do not remove assignments,
delete evidence or broaden hosted permissions/settings to perform that recovery.

## October 13 regular-route ownership correction

Regular routes are maintained within the selected truck's capacity controls,
not Account settings. FEAT-CAP-001 requires the exact current truck and driver,
including atomic stale-assignment denial. Legacy unbound route records remain
history rather than being assigned by guesswork. The older statement retaining
provider usual routes after a truck replacement does not authorize their use by
the replacement truck or a different driver.

## Historical independent-driver policy — October 7, superseded October 14

This historical decision superseded independent multi-truck registration. The
October14 provider-owner contract above now supersedes this section. Company
fleets retain multi-truck/driver management. Former Owner-operator and Self-managed
driver accounts display Independent driver, retaining DRIVER role/provider identity.

### Scenario: stop using the current truck before account closure

Given an independent driver has one current truck and no unfinished Tracking
When they retire that truck from My truck on web or mobile
Then the existing authorized lifecycle command removes it from active work
And its documents, capacity and shipment history remain attached to that truck
And the account has zero current trucks, can add a first truck again, or proceed
through email-verified account deactivation
And no driver/fleet management or restore selector is granted
And unfinished Tracking still blocks retirement and account closure.

### Scenario: one truck and no fleet authority

Given an active independent provider with zero or one current truck
When they use web/mobile or an old/direct command
Then they can register their first truck and manage only that current truck
And database uniqueness and serialized commands prevent a second active truck
And no truck selector, add-driver, invitation, assignment or fleet management is offered
And driver-management commands remain denied by persisted actor permissions.

### Scenario: ownership is recorded on the truck

Given an independent provider registers a truck
When they submit its details
Then they choose I own this truck or I rent it or have the owner's permission
And the truck stores OWNED or PERMISSION as a self-declared use basis
And no document verification or legal ownership guarantee is inferred
And legacy unknown use basis is not invented from a former account type
And evidence still belongs to that exact truck under FEAT-VER-001.

### Scenario: change the current truck atomically

Given an independent provider has a current truck
When they confirm Change truck with its exact ID and valid new details/use basis
Then the database locks the provider and archives the old truck before adding one new current truck
And old capacity is Off Duty and assignments end through the existing lifecycle command
And documents, shipments, reviews and capacity history stay with the old truck
And old location, documents, capacity, private contacts and verification do not transfer
And provider-level profile/usual routes remain with the provider
And stale/cross-owner IDs, missing confirmation, invalid details or unfinished Tracking
reject the entire change without partial retirement or registration
And concurrent additions/replacements cannot create two current trucks.

### Scenario: historical trucks cannot become a selector or bypass

Given an independent provider has historical trucks
When they inspect My truck or call an old restore/edit command
Then history is read-only and is not a current-truck switch
And physical truck identity changes use Change truck rather than overwriting its identity
And independent-account restoration is denied
And admin restoration still cannot violate one active truck per provider.

Migration preflight must refuse existing multiple-active-truck data without
choosing/deleting records. Retain IDs/history and require backup/rehearsal and
compatible clients before rollout. Local success is not hosted verification.
Tests: `tests/sql/independent-single-truck.sql`, `tests/independent-single-truck.test.mjs`,
`verify-independent-truck-concurrency-local.mjs`, `verify-independent-truck-ui-local.mjs`
and `fleet-vehicle-registration.spec.ts` pass locally, with retained lifecycle and
truck-document regressions. Final receipts, early failures and boundaries are in
MOBILE_IMPLEMENTATION / TRACEABILITY (October 7). Owner visual review and backed-up
hosted/client rollout remain pending.

## Legacy invitations and shared driver lifecycle

New Add driver entry follows the clarified 2026-09-21 contract below. This
section preserves the existing invitation API and outstanding invitation flow.

Controlling identity contract: FEAT-IAM-001. A fleet invitation is not an
account, assignment, document approval, or permission to act as the recipient.

### Scenario: invite and accept with verified email

Given a fleet owner has no company drivers\
When they open My Fleet and invite a driver using name, contact phone, and email\
Then a seven-day invitation is retained for that organization and an invitation
email uses the existing managed email adapter\
And a failed email is reported honestly, with a retry action and the invitation
still accessible by signing in with the invited email\
And repeat requests reuse a pending invitation rather than creating duplicates\
And the owner may cancel pending invitations without affecting other fleets.

Given a recipient verifies the invited email through existing email OTP or Google\
When they accept a still-pending, unexpired invitation\
Then a pristine identity becomes a Company driver in exactly that fleet\
And membership, driver identity, conservative operating permissions, and the
invitation outcome are committed atomically\
And an existing provider, platform staff member, suspended identity, or another
fleet's driver is never silently transferred\
And revoked drivers may rejoin the same fleet only through a new invitation\
And no documents are required to accept, assign, publish, or use Tracking.

### Scenario: assign in context and manage driver identity

Given an owner opens Assign driver on an owned truck\
When they select an active company driver added by email or through a legacy invitation\
Then the selected truck context is retained, current permissions are preserved,
and the owner returns to that truck after saving\
And a missing organization membership is rejected by both driver listing and
assignment, even when an old driver row still names that organization.

Given a company driver belongs to the owner's fleet\
When the owner edits name/phone or confirms Remove from fleet\
Then contact changes are validated and audited without exposing contacts in logs\
And removal ends current assignments, removes membership, disables operating
permissions and driver access, and preserves shipment/document/assignment history\
And repeated removal is safe, while cross-fleet and Company driver attempts fail.

### Scenario: correct truck details and reach empty-workspace setup

Given an owner controls a registered truck\
When they correct its make, model, plate, or fixed cargo configuration\
Then the immutable truck number, ownership, driver, documents, and history remain\
And rigid/tractor conversion is not silently performed; a tractor retains its
compatible trailer set and existing attached-trailer control\
And Company drivers and unrelated owners cannot edit those details.

Given Tracking or Private network has no eligible truck\
When an owner opens that page\
Then Add truck and Manage drivers/trucks lead to the required setup rather than
an unusable form\
And a Company driver is told to ask the fleet owner, without owner-only links.

Implementation: additive migrations 081–082; owner and verified-identity
application ports; invite/accept/contact/offboard and truck-detail routes;
contextual Fleet actions and empty-state links. PostgreSQL rollback security
tests and the new-fleet browser workflow cover real local Mailpit delivery, OTP
acceptance, phone/desktop setup, publication and revocation. See the dated
`docs/BUILD_VERIFICATION.md` checkpoint for final typecheck/build evidence.
Rollback: restore prior application/functions while retaining invitation and
driver history. No remote migration or publication is included in this step.

### Scenario: publication requires a current active Driver, not documents

Given an owned truck has no active same-company Driver assignment\
When a provider tries to publish Empty or Partial capacity\
Then publication is denied with an Assign a driver action and no success audit\
And existing public and private discovery excludes that truck until an active Driver is linked\
And deactivating or unassigning the Driver immediately removes eligibility without deleting history\
And an independent Owner-operator or Self-managed Driver is explicitly shown as their truck's Driver through their active provider identity, without a redundant company assignment\
And truck rows and owned truck details show the current Driver name or No driver assigned.

Given the active Driver, truck, and provider have no uploaded or approved documents\
When signup, truck registration, permitted capacity publication, or Tracking is used\
Then missing documents do not block those workflows\
And only current document approvals receive reviewed styling; missing evidence never becomes proof that the person does not possess the document.

Contract: actor/tenant/Driver checks stay in scoped PostgreSQL publication and
read projections. Additive migration `078` rechecks active Driver identity for
Open and Private maps and publication; no document requirement is added. Apply
locally and verify denial, independent-driver eligibility, and no-document
publication before rollout. Rollback restores prior function definitions and
client without deleting assignments, documents, or capacity history.

### Scenario: provider owners register the trucks they control

Given an active Fleet transporter owner, Owner-operator, or Self-managed Driver has current workspace access\
When they add a truck from My Fleet or My trucks\
Then one active truck is created for only that organization or independent provider profile\
And make, model, standardized cargo configuration, private plate, and a server-generated immutable Loadgistic truck number are recorded\
And the standardized configuration catalogue offers courier cars, courier motorcycles, cargo vans, pickups, mini, light, medium, heavy rigid, heavy rigid-with-trailer, and tractor-with-trailer configurations\
And a rigid vehicle records exactly one fixed configuration\
And a tractor records one or more compatible trailer configurations from Container trailer, Dry van trailer, and Heavy equipment trailer\
And the tractor's currently attached trailer must be one of that same registered compatible set\
And the catalogue depicts tractors as clean unbranded Chinese/European-style cab-over vehicles rather than North American long-bonnet trucks\
And no Capacity signal, public location, Driver assignment, or document-verification outcome is inferred from registration\
And the new truck opens in its owner-scoped detail workspace so Capacity and verification can be completed deliberately\
And the command is atomic, validated, and audited with the authenticated owner as actor.

Given a Company driver, unrelated provider, anonymous browser, or browser Supabase client attempts the same command\
When the truck registration boundary rechecks authority\
Then the command is denied without creating a truck, platform number, assignment, Capacity signal, or audit success.

### Scenario: provider changes only the tractor's currently attached trailer

Given an authorized provider owns a tractor registered with more than one compatible trailer configuration\
When the provider changes the attached trailer from the owned truck detail\
Then the selected trailer must belong to that tractor's registered compatible set\
And the same vehicle identity, platform number, private plate, Driver assignment, documents, Capacity history, and approximate location are preserved\
And current public and authorized private projections show only the newly attached trailer configuration\
And the compatible set remains private provider-operating data\
And the change is atomic and audited with the authenticated provider as actor.

Given a rigid vehicle, an incompatible trailer, a Company driver, an unrelated provider, or a browser Supabase client attempts that change\
When the attached-trailer boundary rechecks vehicle type and authority\
Then the command is denied without changing the active configuration or emitting a success audit.

### Scenario: every authorized provider can reach truck management

Given a Fleet transporter or independent provider opens its workspace on desktop or phone\
When it needs to inspect or add a truck\
Then My Fleet or My trucks provides an explicit Add truck action and every listed truck opens its owned detail view\
And an independent Driver with no truck receives the same Add truck action instead of an unactionable empty Capacity screen\
And a Company driver sees only the employer-assigned truck workflow and no truck-creation affordance.

### Scenario: large fleet management remains bounded

Given a Fleet Transporter has many trucks or company Drivers\
When My Fleet is opened or either list changes page\
Then Trucks and Driver access use independent bounded pages\
And changing one page preserves the position of the other list\
And every active truck and Driver remains reachable.

### Scenario: fleet owner controls Driver authority

Given an authenticated fleet owner and an active driver in the same transporter organization\
When the owner changes that Driver's capacity-control or shipment-tracking permission\
Then the setting is saved only for that driver\
And the change is audited with actor, driver, permission, and resulting value.

### Scenario: managed Fleet has one production-shaped persistence path

Given local development, Preview, or Production uses the managed runtime\
When a Fleet owner opens bounded truck or Driver access data or saves assignment and permission changes\
Then the active application route uses the dedicated Fleet application port and Supabase PostgreSQL\
And one transactional command repeats active actor, workspace linkage, ownership, Driver, and truck checks before ending or creating assignments and updating permissions\
And PostgreSQL preserves displaced assignment history and writes one contact-safe audit outcome\
And unavailable or rejected managed persistence fails closed without importing or querying SQLite\
And anonymous and ordinary browser roles cannot execute the server-only Fleet functions.

### Scenario: fleet owner assigns one current driver to one current truck

Given an authenticated fleet owner manages an active company driver and active truck in the same organization\
When the owner assigns that truck to the driver\
Then the driver has that one current truck assignment\
And any prior active truck assignment for that driver is ended\
And any prior active driver assignment for that truck is ended\
And historical assignment rows are retained\
And the change is audited with actor, driver, truck, and displaced assignments.

### Scenario: fleet driver management follows one ordered task

Given a fleet owner opens Driver access\
When one driver is expanded for management\
Then the interface presents Driver identity first, current truck assignment second, allowed work third, and one save action last\
And the truck selector contains only active trucks owned by that transporter\
And an explicit unassigned choice is available\
And Allowed work contains only Capacity updates and Tracking updates\
And retired Shipment Board, Business-contact, and demand-negotiation permissions are neither shown nor accepted as active authority\
And ownership and active-state checks are repeated at the service boundary.

### Scenario: permitted company Driver operates assigned work

Given a fleet Driver is assigned to the shipment's assigned truck and may operate tracking\
When the Driver opens the assignment or records the next permitted tracking event\
Then only the customer-safe shipment facts required for operation are returned\
And the action is recorded for the provider organization with the Driver as actor\
And the fleet owner can see the assignment and tracking history.

### Scenario: company Driver identity retains its employer

Given an authenticated Driver belongs to a fleet transporter\
When workspace navigation, Account, or Verification presents that identity\
Then the role is labelled Company driver rather than Self-managed driver\
And the employing fleet transporter name is displayed with the workspace identity.

### Scenario: every fleet Driver owns a verification step

Given a fleet owner adds an active Company driver and assigns one truck\
When either the owner or that Driver opens Verification\
Then that Driver has a distinct Driver subject for National ID and Driver license\
And Truck authorization is submitted for that exact Driver and assigned-truck pairing with an expiry date\
And the fleet owner can see the Driver's category-level verification status without receiving a public proof-file URL\
And the Driver may submit their own evidence from their workspace\
And missing evidence does not hide the assigned truck or prevent the Driver from appearing publicly.

### Scenario: company driver restrictions are enforced at the service boundary

Given a fleet owner has disabled a Driver's capacity-control or shipment-tracking permission\
When that Driver attempts the denied read or command through a page or direct request\
Then no other shipment party email, private proof, or provider-wide history is returned\
And no capacity update, tracking event, file, email delivery, or success audit is created.

### Scenario: restricted driver keeps duty control

Given a fleet driver is assigned to a company truck and rich capacity control is disabled\
When the driver opens Home\
Then only assigned-truck duty controls are shown\
And the driver may set the truck Off Duty or restore its most recent owner-configured Empty or Partial capacity signal\
And corridor, percentage, public visibility, regular-corridor, proof, and location controls remain unavailable.

### Scenario: permitted driver manages assigned-truck capacity

Given a fleet driver is assigned to a company truck and rich capacity control is enabled\
When the driver publishes capacity\
Then the same truck-level validation and visibility rules as fleet-owner capacity apply\
And the update records the driver as actor\
And the driver cannot update an unassigned or differently owned truck.

### Scenario: self-managed driver is not subordinate to fleet permissions

Given a Driver account owns its provider profile and truck\
When it uses capacity, duty, provider shipment, assignment, or tracking workflows\
Then it has the full provider authority defined by the related feature specs\
And no fleet-owner permission record can reduce that authority.

### Scenario: Driver can reach the canonical public Truck Market

Given an authenticated company or self-managed Driver is inside the workspace\
When the Driver chooses Truck Market or follows a retired authenticated Capacity-market address\
Then the canonical public Truck Map workspace opens at `/` without exposing any field hidden from the public projection\
And the retired `/app/capacity` routes redirect instead of rendering a duplicate market\
And Dashboard returns to the authenticated workspace without requiring a new login.

## Contract ownership

- Application policy and services: dedicated managed Fleet, truck-registration, Tracking, and Capacity application ports
- Inbound adapters: Driver Home, My Fleet/My trucks, owned truck detail, assignment detail, Fleet team controls, and related route handlers
- Persistence adapter: Supabase PostgreSQL invitation, truck-registration/details, fleet-driver, permission, assignment, verification-summary, and audit functions; no SQLite runtime fallback
- Tests: `tests/fleet-onboarding.test.mjs`, rollback-only `tests/sql/fleet-driver-onboarding.sql`, `tests/e2e/fleet-onboarding.spec.ts`, `tests/e2e/driver-document-clarity.spec.ts`, managed Fleet contract and live local Supabase verifier, authorization tests and smoke workflows

## Account-phone isolation (FEAT-IAM-001, verified locally)

Given a Company driver maintains a private account phone\
When the owner edits Driver contact\
Then the fleet callback and shared display name change while the private phone
is preserved. A Driver editing their own account name updates the active fleet
name copy, never its callback. Migration 086 and account-details SQL/browser
regressions cover both directions; existing owner authorization is retained.

## Owner truck retirement and restoration (F10, implementation)

Given an active fleet owner or independent provider owns a truck\
When they confirm retirement with a bounded reason and no incomplete Tracking
session uses that truck\
Then one locked command records an Off Duty capacity snapshot, ends current
assignment links and deactivates the truck without deleting its history\
And public/private discovery and new Tracking exclude it\
And an owner can find retired trucks through a bounded list and restore one\
And restoration leaves it Off Duty and requires a fresh fleet Driver assignment\
And a Company driver, unrelated owner or inactive actor cannot perform the action.

Given Operations-authorized staff use the existing truck activation action\
When a truck has incomplete Tracking\
Then the same retirement guard applies and the staff member must resolve that
Tracking first; no direct administrative shortcut can strand an active session.

Contracts: migration 090, owner/Operations scope, active-vehicle locks shared
with Tracking creation and capacity publication, append-only capacity snapshot,
retained assignments and audit reason. No deletion or billing change. Deploy SQL
before UI. UI rollback retains inactive records and their recovery route; do not
reactivate records or republish historical capacity as a rollback operation.
Evidence required: lifecycle SQL, unit command validation, real desktop/phone
retire/restore flow and active-Tracking/other-owner/Company-driver denial.


## Add and assign before email verification — clarified 2026-09-21

Email is required when the fleet owner adds a driver. The owner clarified that
verification, not the email field itself, must cease blocking assignment.

Given an authorized fleet owner provides name, contact phone and email
When they add a driver whose identity is new or a pristine bootstrap
Then the driver is available immediately for the existing truck assignment flow
And existing owner-operated capacity and Tracking retain that same Driver identity
And adding the driver neither confirms their email nor gives the owner their session
And no invitation delivery or acceptance is required before assigning the truck
And repeated addition to the same fleet does not duplicate or alter the driver.

Given the new driver has not verified their email
When account/workspace access is requested
Then no current-user projection or application session grants workspace access
And the normal email-code login verifies the email and opens the assigned workspace
And that first login retains the same Driver, truck assignment and owner-set permissions
And wrong/expired codes cannot activate a session or change an assignment.

Given an email belongs to an existing provider, staff member, suspended account
or another fleet's driver
When a fleet owner attempts to add it
Then the operation fails without moving the identity or changing its permissions
And the existing confirmed-email invitation flow remains compatible for older invitations.

Plan: migration 099 adds scoped preparation/registration commands and a verified-email
current-user projection guard. Use the supported Auth admin create-user API with
`email_confirm:false`, no password and no session. Recheck email/identity/owner
under database locks before membership creation; retain an inactive bootstrap
if Auth succeeds but registration fails, allowing safe retry without deleting an
identity. Owner contact phone remains separate from private account contact.
No global Auth settings, auto-confirmation or arbitrary identity transfer.

Evidence: rollback-only assignment/unverified-session/cross-fleet/conflict tests;
real local Add driver → assign before verification → wrong-code rejection → inbox
OTP login → preserved assignment/permissions → offboarding on desktop and phone.
Apply schema locally before preview, then owner visual review before full gates.
Rollback restores the prior Add/Invite entry point while retaining added identities,
assignments and the verified-email login guard. No hosted rollout is included.

## Historical courier retirement — superseded by October18 restoration

Given an owner registers or changes a vehicle configuration
When they choose from the supported freight catalogue
Then Courier car and Courier motorcycle are absent from every selector
And a stale client attempting to insert or change a vehicle to either retired type is rejected by PostgreSQL
And existing historical records are retained rather than deleted or silently reclassified.

Given the disposable local demo courier inventory
When the reviewed one-time conversion runs
Then the same vehicle IDs, driver identities, assignments, capacity signals and selection history remain
And only verified demo vehicle descriptions/configurations are replaced with freight vehicles.

The container-trailer catalogue illustration depicts a flatbed with a short container
and exposed deck; this is an illustrative configuration image, not a photograph of a user's vehicle.


## First location for owner-managed capacity — audit correction, 2026-09-27

Given an active assigned company driver whose owner manages capacity, when the
truck has never published capacity, then the driver can explicitly save their
approximate device location without acquiring capacity-edit permission. The owner
can then configure and publish the first signal using that driver-provided fix.
Saving location alone never publishes availability or changes sharing, coverage,
accepted loads, capacity age, or tracking permissions. Independent drivers can
also save their own truck location. Unassigned, removed, inactive, foreign-fleet,
retired-truck and owner-device submissions remain denied by PostgreSQL.

Keep the latest approximate fix separately from capacity publication in a
service-only RLS-protected vehicle/driver location record. Only the current active
driver's record is visible to the authorized workspace or used for publication;
reassignment cannot reuse another driver's snapshot. New fixes update location
age only. Existing capacity history remains available as a compatibility source.
No exact device coordinates or coordinates in audit logs. No automatic GPS prompt
for an unassigned or restricted driver's first visit; explicit Save/Use location
and bounded failure/retry controls explain the next setup step.

Migration 113 is additive and local first. Rollback the app before separately
reviewing removal of helpers/data; retain location/capacity/audit history. Verify
browser-role denial, tenant/assignment scope, first restricted-driver location →
owner publication, and unchanged capacity metadata/location freshness.


Assignment and recovery corrections: Assign driver links in the capacity editor
retain the current truck. Location/capacity HTTP operations have bounded waiting
and report an ambiguous timeout without automatically repeating a possible write.
This audit changes no owner/driver commercial authority or shipment permissions.

## Related truck and driver controls — October 6 (in progress)

Given an owner manages a truck or driver
Then capacity and truck documents stay with the truck, and driver documents stay
with driver assignment/contact controls. Expanding native controls retains drafts
on collapse and does not cancel active saves. Web saves retain the allowed fleet
page/driver context. This regrouping adds no operating permission or hosted change.


## Owner and driver Home distinction — October 7, in progress

Given an active transport-company owner opens Home on web or native
Then the existing managed trucks/drivers workspace is the Home content, with
actual fleet records, assignment/access controls and contextual documents. No
extra page of dashboard shortcut tiles is required before reaching the fleet.
Existing Fleet URLs remain compatible and identify Home as the primary section
for company owners. Limited-account recovery remains unchanged.

Given a driver, including a self-managed driver, owner-operator who drives or
company driver, opens Home
Then retain their map and authorized signal controls; do not display the company
owner's management list or Account settings as driver Home. The account's verified
role/application decides its workspace, not the email name or a client guess.
Changing navigation must not reclassify accounts or let fleet owners publish
phone GPS as if they were the assigned driver.

Reuse existing fleet ports/authorizers rather than copying management logic.
Verify owner Home list and driver Home map using real local authenticated flows,
plus their existing role denials, then owner visual approval before release gates.
