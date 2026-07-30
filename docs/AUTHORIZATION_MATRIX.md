# Authorization contract matrix

This matrix defines the application-service boundary. Route handlers authenticate callers, but repository services remain authoritative for every mutation and protected read.

| Capability | Allowed actor and scope | Denial behavior |
|---|---|---|
| Post load | Active Shipper or Receiver with its organization | `FORBIDDEN`; no load or event |
| Read Tracking workspace | Shipper, receiver, directly addressed or assigned provider; Admin oversight | Discoverable unrelated Load Board records are excluded |
| View shipment party data | Admin or shipment shipper, receiver, assigned provider organization, or assigned provider profile | Return no record |
| Set receiver contact | Business that owns an Agreed shipment, or Admin; first name and phone are required | `NOT_FOUND`, `RECEIVER_CONTACT_NOT_READY`, or `RECEIVER_CONTACT_REQUIRED`; no contact update |
| Browse open freight | Authenticated Transporter or self-managed Driver; company Driver only with Load Board permission; Freight, Posted, Open Market only | Return no record |
| Browse Partners freight | Transporter or self-managed Driver with a mutual Connected relationship; company Driver additionally requires Load Board permission for that transporter organization | Return no record |
| View designated load phone | Transporter or self-managed Driver allowed to view the load; company Driver additionally requires Business contact permission; owning Business must opt in | Return a null phone |
| Express load interest or request load proof | Transporter or self-managed Driver allowed to browse; company Driver additionally requires negotiation and Business contact permission | `NOT_FOUND` or `FORBIDDEN`; no interest, request, notification, or audit |
| Accept direct freight | The specifically addressed Transporter or self-managed Driver while the request is `SENT`; company Driver additionally requires negotiation and Business contact permission for the addressed organization | `FORBIDDEN`, `NOT_FOUND`, or `DIRECT_REQUEST_NOT_PENDING`; no state change |
| Transition shipment | Admin or the assigned Transporter/Driver; Approximate location + status requires a general area | `FORBIDDEN`, `NOT_FOUND`, or `TRACKING_LOCATION_REQUIRED`; no status event |
| Add tracking update | Admin or assigned Transporter/Driver after assignment; note required for Status timeline, area required for Approximate location + status; only a Driver may use device-assisted location | `FORBIDDEN`, `TRACKING_NOTE_REQUIRED`, `TRACKING_LOCATION_REQUIRED`, or `DEVICE_LOCATION_DRIVER_ONLY`; no event |
| Reduce tracking mode | Shipper Business, receiver Business, or Admin; only Approximate location + status to Status timeline | `NOT_FOUND` or invalid mode; no mode change |
| Unlock customer tracking | Authenticated shipper or receiver Business on that load, using its secret code; grant is user/load bound and expires after five idle minutes | `TRACKING_ACCESS_DENIED`; no summary, party, or event disclosure |
| Add shipment note | Admin or an actual shipment party | `NOT_FOUND`; no note |
| Upload/download proof | Admin or an actual shipment party; file read reauthorizes each request | Upload throws `NOT_FOUND`; download returns no record or bytes |
| Request load-size proof | Transporter or Driver with its own recorded interest in that visible Freight load | `NOT_FOUND`; no request or notification |
| Share temporary load-size proof | Business that owns the load, to one selected recorded interest | `NOT_FOUND` or `INVALID_INTEREST`; no file grant |
| Download temporary load-size proof | Owning Business, Admin, or the exact selected interested provider while the grant is active and compatible with assignment | Return no record or bytes |
| View marketplace capacity | Authenticated Business, Transporter, Driver, or Admin; Open Empty/Partial capacity, plus Partners capacity for a Connected Business-provider pair | Return no record |
| Publish capacity | Transporter for its organization vehicle; self-managed Driver for its provider-profile vehicle; company Driver with rich capacity permission for an assigned organization vehicle; only Drivers may submit device-assisted location; current and planned routes require non-past dates, and planned routes require Full or Partial cargo-space intent; Empty/Partial may be visible, Off Duty is hidden | `FORBIDDEN`, `INVALID_VEHICLE`, `INVALID_ROUTE_DATE`, or `DEVICE_LOCATION_DRIVER_ONLY`; no visible capacity |
| Change company-truck duty | Transporter owner or assigned company Driver; On Duty restores the last owner-configured active signal and Off Duty hides the truck | `FORBIDDEN`, `INVALID_VEHICLE`, or `CAPACITY_CONFIGURATION_REQUIRED`; no capacity record |
| Manage fleet-driver permissions | Transporter owner for an active Driver in its own organization | `FORBIDDEN` or `NOT_FOUND`; no permission change |
| Browse member directory/profile | Any authenticated user; profile must be published | Redirect to login or return no record |
| Favorite or request network connection | Business owner targeting a transport provider, or Fleet Transporter/Self-managed Driver targeting a Business | `FORBIDDEN` or `INVALID_NETWORK_TARGET`; no relationship or notification |
| Accept or decline network request | Recipient owner for the exact Pending cross-market relationship | `NETWORK_REQUEST_NOT_ACTIONABLE`; no relationship change |
| Update profile | User with its own organization or provider profile; public contacts remain separate from account contacts | `FORBIDDEN`; no cross-tenant update |
| Submit Business participant review | Shipper or receiver organization after Completed; one per direction and load; 4–5 stars publish immediately, while 1–3 require a note and remain private Pending | `REVIEW_NOT_ALLOWED`, `LOW_RATING_NOTE_REQUIRED`, or `REVIEW_ALREADY_SUBMITTED`; no review |
| Read or decide low-rating moderation | Admin reads safe Pending/Published/Dismissed projections; only a Pending rating may receive one Publish or Dismiss decision with a required investigation note | `FORBIDDEN`, `RATING_REVIEW_NOTE_REQUIRED`, or `RATING_ALREADY_REVIEWED`; no rating change |
| Submit verification | Authenticated owner of the organization, provider profile, driver, or truck; type must apply | `FORBIDDEN` or `INVALID_VERIFICATION_TYPE`; no request |
| Read verification document | Submitting user or Admin | Return no record or bytes |
| Review verification | Admin only; terminal decisions are immutable | `FORBIDDEN` or `VERIFICATION_ALREADY_REVIEWED`; no badge change |
| Review application | Admin; only non-terminal Pending/More Info application | `FORBIDDEN` or `APPLICATION_ALREADY_REVIEWED`; no provisioning |
| Submit payment proof | User with a subscription belonging to its organization or provider profile | `SUBSCRIPTION_NOT_FOUND`; no proof |
| Review payment proof | Admin; only non-terminal Pending/More Info proof; approval opens 30 days from review | `FORBIDDEN` or `PAYMENT_PROOF_ALREADY_REVIEWED`; no subscription change |
| Use operating workspace | Admin, sponsored Business, or member of a workspace with an unexpired seven-day trial or 30-day paid period; company Drivers inherit fleet access | `SUBSCRIPTION_ACCESS_REQUIRED`; Home, Account, billing submission, and logout remain available |
| Grant sponsored free access during application review | Admin approving a Business application only | `SPONSORED_ACCESS_BUSINESS_ONLY`; no workspace or subscription |
| Read platform Operations | Admin only; bounded user, workspace, truck, load, and latest-capacity projections exclude credentials, sessions, tracking secrets, exact coordinates, and proof paths | `FORBIDDEN`; no records or read audit |
| Start support conversation | Active Shipper, Receiver, Transporter, or Driver for their own user account; one open conversation maximum | `FORBIDDEN` or `SUPPORT_CONVERSATION_ALREADY_OPEN`; no conversation or assignment |
| Read/send support conversation | Owning member, assigned SUPPORT agent, or Admin; messages only while open and at most 50 returned per read | `NOT_FOUND`, `SUPPORT_CONVERSATION_CLOSED`, or rate/validation denial; no message |
| Claim waiting support conversation | Available active SUPPORT agent below configured open limit; oldest waiting record only | `FORBIDDEN`, `SUPPORT_AGENT_UNAVAILABLE`, `SUPPORT_AGENT_AT_CAPACITY`, or `SUPPORT_CONVERSATION_NOT_WAITING`; no assignment |
| Close support conversation | Assigned SUPPORT agent or Admin | `NOT_FOUND` or `SUPPORT_CONVERSATION_CLOSED`; no lifecycle change |
| Manage support agents | Admin only; SUPPORT role, availability, capacity, and active state; disabling safely requeues assigned work | `FORBIDDEN` or validation denial; no account, profile, or queue change |
| Suspend/restore user | Admin only; reversible; administrator cannot suspend their own account | `FORBIDDEN`, `NOT_FOUND`, or `ADMIN_SELF_SUSPENSION`; no status change |
| Deactivate/reactivate truck | Admin only; reversible; inactive trucks are excluded from marketplace capacity and active fleet counts | `FORBIDDEN` or `NOT_FOUND`; no status change |

## Default-deny rules

- Public or browse visibility never implies mutation or protected-file access.
- Anonymous visitors cannot read Public Profiles, the member directory, capacity, loads, or marketplace information.
- Interest in a shipment does not make the provider an execution party.
- Receiver first name and phone are never returned to marketplace-only viewers and are required before a Freight shipment moves from Agreed to Assigned.
- A provider becomes an execution party only when its organization/profile is assigned on the shipment.
- Providers cannot reduce a load's tracking obligation. Device coordinates are obscured in the browser and never written to audits.
- Public and member-facing truck views use the permanent Loadgistic platform number. License plates remain limited to owning fleet/self-managed workspaces and administrators.
- Transport providers cannot unlock the customer tracking view; their involved loads and real events remain in the internal Tracking workspace.
- Favorites and Pending or declined network requests never authorize Partners-only marketplace records.
- Terminal approval/rejection is immutable in this MVP.
- Expired, unpaid, or payment-under-review workspaces cannot bypass subscription limits through direct route or command calls.
- Pending low ratings are visible only to their submitting Business and administrators; the reviewed Business and public summary receive no pending or dismissed rating data.
- Denied operations do not write success audits. HTTP adapters return generic safe messages and do not expose protected record details.
- SUPPORT authority never implies marketplace, shipment, tracking, verification,
  billing-review, Operations, user-edit, or private-file access.
