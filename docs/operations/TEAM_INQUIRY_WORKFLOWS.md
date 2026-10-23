# Support and Brokerage teams

## September 27 update — live Brokerage (local preview)

This section supersedes the callback-only description below for **new** Arrange
transport submissions. The form still asks only for route, name and phone, then
opens a persistent conversation. Existing callback records remain phone follow-ups.
Provider dashboard Support and its permissions are unchanged.

1. Give Brokerage staff the Brokerage permission. They sign in normally and open
   Brokerage → Unassigned → Active chats. The route is visible before claiming;
   claiming reveals the customer name, phone and history. Keep the queue staffed
   during advertised hours; the app does not claim someone is online.
2. Claim the request, then open Mine → Open conversation. Read the summary and ask
   for any further details in chat. Awaiting reply means the latest message is from
   the customer, not a read receipt. Replies appear automatically.
3. Visitors can choose End chat and confirm that staff may still call. This stops
   messages for both sides; it does not resolve the request or delete anything.
   It moves to Follow-up, alongside expired chats and older phone-only requests.
   If the visitor left before assignment, claim it from Unassigned → Follow-up.
4. Open View chat history to read the messages and use the phone link. Record the
   call outcome under Request follow-up. Set Contacted if more work remains, or
   Resolved when finished or the customer is no longer interested. Resolved has
   its own view. Notes stay private and are not sent as messages.
5. Admin may reassign; the previous worker loses access. Resolving stops messages
   even if the chat was active. Admin can reopen request follow-up, but an ended
   visitor conversation stays ended; arrange any further contact by phone.
6. The × only hides the window. An ended chat can still be read in the same browser
   during its seven-day access window, and Start a new chat creates a separate
   request. The old request/history remain with staff. Browser-data deletion or
   expiry prevents visitor recovery; neither deletes staff history.

Updates currently use three-second foreground polling, with reconnect backoff.
Closed panels and background tabs pause updates. There are no push/SMS/email
notifications or online/typing indicators in this release. Assign real coverage;
check Unassigned and Awaiting reply regularly. Treat the connection-error notice
as a delivery problem; never assume a timed-out send failed to persist. Retrying
the retained draft uses its existing message ID and does not duplicate it.

Local schema/implementation only until owner visual review and production gates.

Local implementation, 2026-09-24. FEAT-SUP-001 / FEAT-GST-001 / FEAT-TRQ-001.
Production still needs the reviewed migration and application release. No real
staff accounts or invitations were created by this implementation.

## Set up people

As an admin, open Support → Platform team → Add member. Enter the person's
name and sign-in email. Choose responsibilities independently:

- Support: transport-provider questions, issues and disputes from the dashboard.
- Brokerage: transport requests and offline calls/referrals.
- Enable both only if that person actually covers both jobs.

They use the ordinary email-code login. Brokerage-only staff land in Brokerage.
Support staff use Support; people with both permissions can switch from navigation.
Chat availability and maximum open chats apply to Support, not Brokerage.
New and existing staff do not receive Brokerage permission automatically.

## Earlier callback workflow — superseded by the September 27 section

The public Arrange transport form asks only for origin, destination, name and
phone. It creates a private request, without email or a support chat.

In Brokerage, choose Unassigned, claim a request, then open Mine. Claiming reveals
its contact details and private call notes. Call the requester, coordinate with
transporters offline, record a follow-up note and use New, Contacted or Closed.
Closing means your follow-up is finished; it does not create or complete a shipment.
Use the status tabs to find previously contacted or closed work.

Admins can view all requests, assign/reassign to active Brokerage staff, release
to Unassigned, and reopen closed work. Removing a staff member's Brokerage access
or suspending them returns open requests to Unassigned. Closed history is retained;
reopening after the former owner's access was removed returns the work to Unassigned.

Two simultaneous claims cannot both win. A stale save asks staff to reload and
review the latest record. Drafts are not silently upgraded by background refresh.
After a timeout, inspect the record before trying again; writes are not auto-retried.
Recent activity shows the latest ten changes. Earlier private history is retained.

## General support

All transport-provider users—company drivers, self-managed drivers, owner-operators
and transport-company owners—use Support inside their dashboard, including when
plan access is limited. Support stays reachable in navigation and the More menu. New chat, replies,
attachments, assigned staff and past conversations keep the existing workflow.
Public visitors see only Arrange transport → Send request. It is a request form,
not live chat. Shipper/receiver accounts cannot open a member support chat.

Existing guest conversations remain under Support → Guest support. Staff may
finish and close them under the existing assignment and oldest-first queue rules.
Guests can recover their read-only history at /help using the original email/code.
The migration does not bulk-close old work; review remaining assigned/waiting
records and close them when finished. Their retained files keep normal permissions.
Brokerage permission alone grants no support conversation access.

Admins can open a guest conversation and reassign it to an active, available
Support member with spare chat capacity, or return it to Waiting. The transcript
and assignment history remain intact. Closed conversations must not be reassigned.

## Verification and rollout limits

Local browser tests cover real public submissions, staff creation, email-code
login through Mailpit, claim, follow-up, admin handoff, provider dashboard replies and read-only guest history, closure and cross-team denial. SQL tests cover stale/unauthorized
writes, redaction, revocation, suspension, private history and support chat limits.
No production inbox, SMTP configuration or hosted permission was changed.

The assignment selectors currently show up to 100 Brokerage staff and the first
50 managed staff for guest Support assignment. Before growing beyond those team
sizes, add searchable paginated assignment; do not assume every staff member is listed.
Keep the local preview running for owner review before extensive release gates.

Transport requests are asynchronous callbacks. The visitor submits route, name
and phone, sees Request received, then leaves; there is no transport chat room,
typing/presence indicator or online-agent promise. Brokerage claims/receives the
request, calls offline and records Contacted/Closed plus a private follow-up note.
Live support appears only in transport-provider dashboards. Public requests and
Support keep separate assignments and permissions.

Staff responsibilities are additive. The new Featured permission can be combined
with Support, Brokerage, customer access or Billing when the admin assigns them;
it grants none of those automatically and removing it does not revoke the others.


## Managed transport callback — public wording

Visitors choose **Arrange transport → Send request**. The same private
Brokerage request contains route, name and phone. The team calls to agree the
service and fee before proceeding, reviews the relevant truck/transporter documents,
coordinates transport and sets up sender/receiver tracking through the existing
shipment workflow. Record agreed scope and the offline follow-up in the request.
The request form itself does not charge, verify documents, create a shipment or
grant tracking access. Use specific document-review findings, not a blanket safety
or service guarantee. Provider dashboard Support remains separate.
