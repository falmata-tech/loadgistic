# Authorization contract matrix

This matrix defines the application-service boundary. Route handlers authenticate callers, but repository services remain authoritative for every mutation and protected read.

| Capability | Allowed actor and scope | Denial behavior |
|---|---|---|
| Create shipment | Active Shipper, Receiver, or Admin with an organization | `FORBIDDEN`; no shipment or event |
| View shipment party data | Admin or shipment shipper, receiver, assigned provider organization, or assigned provider profile | Return no record |
| Browse open freight | Transporter or Driver; Freight, Posted, Open Market only | Return no record |
| Browse saved-partner freight | Transporter or Driver with an active saved relationship to the shipment owner | Return no record |
| Express load interest | Transporter or Driver allowed to browse an Open Market or Saved Partners freight load | `NOT_FOUND`; no interest or notification |
| Accept direct freight | The specifically addressed Transporter or Driver while the request is `SENT` | `FORBIDDEN`, `NOT_FOUND`, or `DIRECT_REQUEST_NOT_PENDING`; no state change |
| Transition shipment | Admin, or the assigned Parcel/Transporter/Driver party for its service mode | `FORBIDDEN` or `NOT_FOUND`; no status event |
| Add shipment note | Admin or an actual shipment party | `NOT_FOUND`; no note |
| Upload/download proof | Admin or an actual shipment party; file read reauthorizes each request | Upload throws `NOT_FOUND`; download returns no record or bytes |
| Publish capacity | Transporter for its organization vehicle; Driver for its provider-profile vehicle | `FORBIDDEN` or `INVALID_VEHICLE`; no capacity |
| Update company page | User with its own organization or provider profile | `FORBIDDEN`; no cross-tenant update |
| Add parcel location/route | Parcel user for its organization, or Admin for the configured demo parcel organization | `FORBIDDEN` or `INVALID_LOCATION`; no record |
| Review application | Admin; only non-terminal Pending/More Info application | `FORBIDDEN` or `APPLICATION_ALREADY_REVIEWED`; no provisioning |
| Submit payment proof | User with a subscription belonging to its organization or provider profile | `SUBSCRIPTION_NOT_FOUND`; no proof |
| Review payment proof | Admin; only non-terminal Pending/More Info proof | `FORBIDDEN` or `PAYMENT_PROOF_ALREADY_REVIEWED`; no subscription change |

## Default-deny rules

- Public or browse visibility never implies mutation or protected-file access.
- Interest in a shipment does not make the provider an execution party.
- A provider becomes an execution party only when its organization/profile is assigned on the shipment.
- Terminal approval/rejection is immutable in this MVP.
- Denied operations do not write success audits. HTTP adapters return generic safe messages and do not expose protected record details.
