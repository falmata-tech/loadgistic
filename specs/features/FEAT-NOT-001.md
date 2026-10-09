---
id: FEAT-NOT-001
title: Chat and driver handover alerts with visible-message read receipts
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-SUP-001, FEAT-TRQ-001, FEAT-TRK-001, FEAT-MOB-001, FEAT-IAM-001, FEAT-LNG-001, FEAT-SEC-001]
problem: Customers and staff miss incoming chats, assignments and replies, while fetching a transcript is not evidence that someone viewed it.
behavior: Existing provider Support and visitor transport conversations expose authorized unread counts and explicit Seen receipts. Contextual alerts distinguish assignment, actual assigned-agent opening, new waiting work, new unread messages and ended/resolved state. Sound and system delivery are opt-in; unavailable notification delivery never breaks chat or fabricates Seen/online state.
contracts: [ChatReadAcknowledgement, ChatReadState, ChatAlertSnapshot, ChatAlertDelivery, DriverHandoverAlert, BrowserAlertDelivery, NativePushInstallation, NativePushBinding, NativePushOutbox]
observability: [authorized_acknowledgement, unread_count, denied_chat_read, alert_delivery_failure]
rollout: Implement and verify locally with RLS/private service-only commands and preserved history. Obtain actual web/native visual review before full release gates. Require exact reviewed hosted migration and matched clients. Background phone/browser push is separately selected and configured; foreground polling is never claimed to deliver to closed apps.
---

# Chat alerts and read receipts

## Scope and delivery decision

The initial foundation covers existing provider-to-Support and visitor-to-Brokerage
chats; staff management remains web-only. No direct customer-to-transporter inquiry,
public Help restoration, message email, new main navigation or Realtime publication
is introduced. The owner selected closed-app Android notifications on October 8
using Expo Push Service and Firebase Cloud Messaging. Firebase public config and
the explicitly delegated FCM V1 upload to falmatad/loadgistic are verified.
Private outbox/registration/dispatch and native opt-in are implemented locally;
hosted rollout, a matched native build and physical closed-phone tests remain
pending. Foreground/browser alerts remain.
The October 8 extension includes browser Notifications while the site is running
and saved driver handover updates; neither is a closed-phone push claim.

### Selected extension: closed-app Android push (local, not distributed)

Given a customer opts in on a compiled Loadgistic Android app
When an authorized incoming chat reply, assignment/join or driver handover is
committed while that app is backgrounded or normally closed
Then a server delivery path must send a generic notification through Expo/FCM
without requiring a running app poll. Do not expose message bodies, names,
email/phone, route or proof data on the lock screen. Tapping opens the existing
authorized conversation/Tracking destination after current access checks;
it does not create Seen, acknowledgement, join or completed status itself.

Installation tokens must be private, bound to the authenticated member or exact
unexpired guest conversation capability, reauthorized before send and removable
on logout/permission withdrawal. Staff/admin stay web-only. Deduplicate committed
events; use a durable bounded outbox, retry/backoff, Expo ticket/receipt checks and
DeviceNotRegistered cleanup. Permission refusal or provider failure preserves
chat and in-app updates. Never send old history merely because a device registers.
Define expiry, reassignment/revocation and worker concurrency tests before code.

SDK-compatible expo-notifications and an Android channel are needed in a new
native build. The existing APK cannot gain a native dependency by refreshing
Metro. The Firebase Android package must be com.loadgistic.app; the EAS target is
falmatad/loadgistic, project a2d7e0a9-2fe4-4188-804e-40d8c3486ac7. Private FCM
service-account credentials go directly into EAS, never the repository/app/logs.
The owner may delegate the upload of an exact local file to this exact FCM target;
validate in memory and inspect the existing association before any replacement.
Public google-services.json must match the package/project before native config.
Do not enable Firebase Auth/Firestore or alter another app to obtain push.
Normal closed-app delivery, denied permission, logout/revocation, notification tap
and real saved unread state require physical-device evidence; mocked transport,
Expo acceptance tickets and browser preview do not prove phone delivery. Android
force-stop/system restrictions are not a supported delivery guarantee.

Given the installed Android client starts or receives a notification tap
Then its destination validation must be dependency-free shared domain code,
without importing the server's registration schema or server-only packages.
Reject extra fields, invalid identifiers, unknown events and incompatible
event/destination combinations before checking current access. A successful
web preview (which substitutes the browser adapter) is not native bundle proof.
Verify the real Android bundle and installed startup before UI acceptance.

Given a generic notification arrives as the app leaves the foreground
When Android's lifecycle callbacks and the JavaScript app state settle at
different times
Then the handler must allow system presentation while backgrounded/inactive
and use the existing in-app feed while active. Never unconditionally discard
running-app notifications, invent a badge count, or mark a message Seen.

### Native registration, logout and delivery contracts

Given an active provider or exact unexpired transport-chat guest opts in
Then bind a private installation ID and high-entropy installation secret to its
Expo token and current authority. Member bindings require the verified Auth
session; guest bindings require the saved request digest and server expiry.
Never trust a body actor/request/digest/session/expiry. Browser DB roles and
staff/admin mobile identities cannot create/read/send/revoke these private rows.
An existing installation cannot be changed with a different secret. Re-registering
the same authority preserves its start time; scope/session changes cancel old
outbox work and start a new baseline. One device token belongs to one installation;
token possession can replace an obsolete installation, cancelling former scope.
No token/secret/digest is returned by an API or included in logs/system data.

Given permission is withdrawn, a member logs out, a guest starts a new request,
an actor is disabled, a session/capability expires, or a driver loses shipment access
Then cancel unsent delivery for that authority. Registration cannot grant chat,
shipment, exact location or proof access. A notification tap validates its known
screen/IDs and restored current authority; it cannot navigate to arbitrary URLs.
Offline revocation cannot contact the server immediately: retained generic system
alerts convey no private details, and destination authorization remains mandatory.
Keep opt-out available during sender/network unavailability. Retry a tap's temporary
connection failure without claiming lost access; recheck the current identity after
its request finishes. Never open a previously authorized destination after logout.

Given a committed incoming reply, assignment, real join, end/resolution or handover
When existing registered recipient bindings match that event
Then atomically enqueue a deduplicated event containing only kind/ID/version/sequence
And never enqueue for a sender's own message, staff-only note or old pre-registration
history. Queue failure rolls back the source command rather than reporting a false
successful save; sender/provider transport is outside the user command transaction.

Given a delivery worker claims due work
Then claim at most 40 rows with SKIP LOCKED and a unique two-minute lease; recheck
current recipient authority, sequence/approval and assignment before send.
Suppress already Seen/acknowledged events, stale assignments and revoked scope.
The production-only Netlify schedule runs once per minute with the dispatcher
disabled until its explicit rollout flag is enabled. A closed app never polls.
Bound provider connections/timeouts, five send attempts with exponential retry,
one-day event retention and receipt checks from fifteen minutes after submission.
Stop tokens reported DeviceNotRegistered, preserve unread source records and
record only bounded outcome codes/counts. Expired/stale leases cannot finish work.
At-least-once network delivery may retry an ambiguously accepted send; stable
Android tags/collapse IDs replace duplicate event banners. Provider acceptance
and receipt success do not themselves prove user-observed notification delivery.

### Scenario: Seen means displayed, not merely fetched

Given a currently authorized participant opens a current chat
When incoming messages are actually visible while the chat and app/tab are focused
Then the client acknowledges through the highest visible message's bounded sequence
And the database validates that sequence belongs to this exact conversation
And its monotonic receipt advances only after an authorized successful command
And the other participant sees Seen only from that saved cursor
And requests, prefetch, queues, hidden/closed chats, background apps and merely
downloaded older history do not create a receipt or an agent-joined claim.

Legacy Support read timestamps are retained but do not prove the new receipt.
Preserve message IDs, bodies, sender identity, files and the existing historical
order. New messages use serialized conversation order so equal timestamps or
concurrent request start times cannot reorder the read cursor. UUID history links
remain valid and resolve to the same retained message.
Empty chats can record a real opening without acknowledging an invented message.

### Scenario: explicit read is bounded and secure

Given a forged actor, expired guest capability, inactive member, wrong team,
unrelated conversation, foreign/nonexistent sequence or stale assignment
When they request receipts, alerts or an acknowledgement
Then current persisted authority rejects the request without message/contact data
And acknowledgement cannot jump past the current transcript or move backwards
And duplicate/reordered acknowledgements are idempotent
And assignment/read/message races preserve truthful cursors and existing history.

Browser roles receive no direct table, trigger or definer-command access. Guest
authority remains the existing exact signed conversation capability; staff authority
comes from verified current identity and independent Support/Brokerage permissions.

### Scenario: assignment and actual joining are distinct

Given a request is assigned to an active team member
When the customer receives the authorized assignment state
Then it can alert them that a team member is assigned
And a separate joined state is recorded only when that assigned staff member opens
the current chat visibly
And reassignment revokes the old agent and requires the new agent to join
And joined/Seen does not promise the staff member remains online or will reply soon.

### Scenario: unread messages are separate from unanswered work

Given a new incoming message is saved
When its authorized recipient has not acknowledged seeing it
Then the chat and contextual alert control show an unread count
And an outgoing reply does not automatically acknowledge hidden incoming messages
And reading without replying clears unread while awaiting-reply work can remain
And a new assignee has their own unread position for this assignment
And the previous team receipt remains truthful for the customer without clearing
the new worker’s unread count or joined state
And browser/mobile read state agrees after refresh and history navigation.

### Scenario: team and customer alerts stay relevant

Given the participant is using the app/site, including a signed-in provider
browsing the public Marketplace
When new waiting work, an assignment, a new unread reply, a real join or a relevant
chat-ended/resolved change arrives
Then a contextual alert opens the authorized chat or its own team's waiting queue
And initial login/reload does not ring repeatedly for old work
And duplicate polling, retries and receipt changes do not create duplicate sounds
And inactive/stale/cross-team recipients receive no private notification details
And a large waiting backlog cannot crowd the current worker’s unread/assigned
work out of the bounded feed; totals still cover the whole authorized scope
And message event time reflects actual messages, not only assignment/status dates
And lock-screen/system copy contains no message, phone, email or route by default.

### Scenario: notification permission or transport fails

Given sound/system delivery is disabled, denied, unsupported or temporarily failing
When a chat event arrives
Then unread state and in-app alerts still work
And permission is requested only through a deliberate user control
And messages, drafts, assignment, ending and read acknowledgement keep working
And no background/closed-app guarantee is claimed without installed/tested push.

## Verification and operations

## October 8 extension: saved handover and browser delivery

Given unloading has proof and the verified shipment owner approves it
When the existing guarded command commits completion
Then the currently authorized assigned driver receives a retained update on web
and mobile that unloading was approved and Tracking is completed
And there is no invented second completion action or false approval for a staff
release/cancellation
And a staff-approved handover is explicitly attributed to team review
And notification failure cannot roll back completion or resume location tracking.

Given an active driver requests their updates
When the feed is fetched or a notification is dismissed
Then only their currently authorized assigned shipments are projected, without
owner email, route, proof or location
And fetching does not mark an update seen
And opening its alert explicitly acknowledges that exact saved approval
And duplicate acknowledgements are idempotent; foreign/unapproved/stale targets,
inactive drivers and staff/mobile accounts are denied by current server authority.

Given a staff member, provider or guest deliberately enables browser alerts
When Notifications permission is granted and the site remains running
Then relevant new chat and handover changes can use system notifications even
while another tab has focus, with generic private copy and safe authorized links
And duplicate delivery across tabs is suppressed when the browser supports locks
And denied permission or service-worker/audio failure leaves in-app updates usable
And alert dismissal/click never acknowledges chat messages or fabricates Seen
And permission changes and sign-out stop delivery and clear that identity's alerts.

This is browser Notifications delivery from an open site, not Web Push to a closed
browser. Native foreground updates are included; closed-phone delivery, FCM/APNs
credentials and physical-device evidence remain a separately configured rollout.
No service-worker fetch handler, offline cache, Realtime publication or admin mobile
screen is introduced. Migration 126 adds only private driver approval acknowledgements
and bounded service commands; 117's approval command/history remain immutable.

Plan: focused SQL authorization/cursor/race regressions; shared alert/read-policy
tests; actual local two-browser and Expo/web customer/staff workflows; unread
receipt, hidden/background/history, dedupe/retry and file/history preservation.
NR-01/02/03/08/09/10/13 apply. Record evidence in TRACEABILITY and
MOBILE_IMPLEMENTATION; exact provider/device delivery and publication remain pending.
The existing-chat foundation is implemented and focused-tested locally.

Tests: chat/workflow author owns `tests/chat-read-alerts.test.mjs`,
`tests/mobile-support.test.mjs`, `tests/provider-access-health.test.mjs`,
`tests/sql/chat-read-receipts.sql` and the actual local Support/Brokerage browser
round trip in `scripts/verify-chat-roundtrips-local.mjs` (`--support-only`,
`--brokerage-only`, `--receipts-only`, `--public-receipts-only`), concurrent command checks in
`scripts/verify-chat-read-concurrency-local.mjs`, and the five-language narrow
preview/audio check `scripts/verify-chat-alert-layouts-local.mjs`. These require real local commands and
saved-state inspection; transport-failure injection must be identified separately.

Primary platform guidance: [browser notification permission and mobile service-worker
delivery](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API),
[audio user-gesture restrictions](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay),
[Expo SDK 57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
These boundaries guide delivery; they do not establish completed push setup.

October 8 acceptance is owned by `tests/handover-browser-alerts.test.mjs`,
`tests/sql/driver-handover-alerts.sql` and
`scripts/verify-driver-browser-alerts-local.mjs`. The browser delivery check uses
an isolated current Chromium headless context with automation-granted permission, actual
service-worker notification records and exact disposable local fixtures. It is
not evidence of a physical phone notification or an OS banner seen by the owner.
