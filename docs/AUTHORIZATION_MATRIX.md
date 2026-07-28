# Authorization contract matrix

This matrix defines the application-service boundary. Route handlers authenticate callers, but repository services remain authoritative for every mutation and protected read.

| Capability | Allowed actor and scope | Denial behavior |
|---|---|---|
| Post load | Active Shipper or Receiver with its organization | `FORBIDDEN`; no load or event |
| Read Tracking workspace | Shipper, receiver, directly addressed or assigned provider; Admin oversight | Discoverable unrelated Load Board records are excluded |
| View shipment party data | Admin or shipment shipper, receiver, assigned provider organization, or assigned provider profile | Return no record |
| Set receiver contact | Business that owns an Agreed shipment, or Admin; first name and phone are required | `NOT_FOUND`, `RECEIVER_CONTACT_NOT_READY`, or `RECEIVER_CONTACT_REQUIRED`; no contact update |
| Browse open freight | Authenticated Transporter or self-managed Driver; company Driver only with Load Board permission; Freight, Posted, Open Market only | Return no record |
| Browse saved-partner freight | Transporter or self-managed Driver with an active saved relationship; company Driver additionally requires Load Board permission for that transporter organization | Return no record |
| View designated load phone | Transporter or self-managed Driver allowed to view the load; company Driver additionally requires Business contact permission; owning Business must opt in | Return a null phone |
| Express load interest or request load proof | Transporter or self-managed Driver allowed to browse; company Driver additionally requires negotiation and Business contact permission | `NOT_FOUND` or `FORBIDDEN`; no interest, request, notification, or audit |
| Accept direct freight | The specifically addressed Transporter or self-managed Driver while the request is `SENT`; company Driver additionally requires negotiation and Business contact permission for the addressed organization | `FORBIDDEN`, `NOT_FOUND`, or `DIRECT_REQUEST_NOT_PENDING`; no state change |
| Transition shipment | Admin or the assigned Transporter/Driver; Approximate location + status requires a general area | `FORBIDDEN`, `NOT_FOUND`, or `TRACKING_LOCATION_REQUIRED`; no status event |
| Add tracking update | Admin or assigned Transporter/Driver after assignment; note required for Status timeline, area required for Approximate location + status | `FORBIDDEN`, `TRACKING_NOTE_REQUIRED`, or `TRACKING_LOCATION_REQUIRED`; no event |
| Reduce tracking mode | Shipper Business, receiver Business, or Admin; only Approximate location + status to Status timeline | `NOT_FOUND` or invalid mode; no mode change |
| Add shipment note | Admin or an actual shipment party | `NOT_FOUND`; no note |
| Upload/download proof | Admin or an actual shipment party; file read reauthorizes each request | Upload throws `NOT_FOUND`; download returns no record or bytes |
| Request load-size proof | Transporter or Driver with its own recorded interest in that visible Freight load | `NOT_FOUND`; no request or notification |
| Share temporary load-size proof | Business that owns the load, to one selected recorded interest | `NOT_FOUND` or `INVALID_INTEREST`; no file grant |
| Download temporary load-size proof | Owning Business, Admin, or the exact selected interested provider while the grant is active and compatible with assignment | Return no record or bytes |
| View marketplace capacity | Authenticated Business, Transporter, Driver, or Admin; Open Empty/Partial capacity, plus saved-relationship Empty/Partial capacity for the related Business | Return no record |
| Publish capacity | Transporter for its organization vehicle; self-managed Driver for its provider-profile vehicle; company Driver with rich capacity permission for an assigned organization vehicle; Empty/Partial may be visible, Off Duty is hidden | `FORBIDDEN` or `INVALID_VEHICLE`; no visible capacity |
| Change company-truck duty | Transporter owner or assigned company Driver; On Duty restores the last owner-configured active signal and Off Duty hides the truck | `FORBIDDEN`, `INVALID_VEHICLE`, or `CAPACITY_CONFIGURATION_REQUIRED`; no capacity record |
| Manage fleet-driver permissions | Transporter owner for an active Driver in its own organization | `FORBIDDEN` or `NOT_FOUND`; no permission change |
| Browse member directory/profile | Any authenticated user; profile must be published | Redirect to login or return no record |
| Update profile | User with its own organization or provider profile; public contacts remain separate from account contacts | `FORBIDDEN`; no cross-tenant update |
| Submit Business participant review | Shipper or receiver organization after Completed; one per direction and load | `REVIEW_NOT_ALLOWED` or `REVIEW_ALREADY_SUBMITTED`; no review |
| Submit verification | Authenticated owner of the organization, provider profile, driver, or truck; type must apply | `FORBIDDEN` or `INVALID_VERIFICATION_TYPE`; no request |
| Read verification document | Submitting user or Admin | Return no record or bytes |
| Review verification | Admin only; terminal decisions are immutable | `FORBIDDEN` or `VERIFICATION_ALREADY_REVIEWED`; no badge change |
| Review application | Admin; only non-terminal Pending/More Info application | `FORBIDDEN` or `APPLICATION_ALREADY_REVIEWED`; no provisioning |
| Submit payment proof | User with a subscription belonging to its organization or provider profile | `SUBSCRIPTION_NOT_FOUND`; no proof |
| Review payment proof | Admin; only non-terminal Pending/More Info proof | `FORBIDDEN` or `PAYMENT_PROOF_ALREADY_REVIEWED`; no subscription change |

## Default-deny rules

- Public or browse visibility never implies mutation or protected-file access.
- Anonymous visitors cannot read Public Profiles, the member directory, capacity, loads, or marketplace information.
- Interest in a shipment does not make the provider an execution party.
- Receiver first name and phone are never returned to marketplace-only viewers and are required before a Freight shipment moves from Agreed to Assigned.
- A provider becomes an execution party only when its organization/profile is assigned on the shipment.
- Providers cannot reduce a load's tracking obligation. Device coordinates are obscured in the browser and never written to audits.
- Terminal approval/rejection is immutable in this MVP.
- Denied operations do not write success audits. HTTP adapters return generic safe messages and do not expose protected record details.
