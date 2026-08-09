# Authorization matrix

The active product is supply-first. Capacity seekers are anonymous visitors; only transport providers and platform-team users authenticate.

| Action | Allowed actor and scope | Denial behavior |
|---|---|---|
| Browse public capacity | Anyone; only latest published, unexpired Empty or Partial provider signals | Hidden records are omitted |
| Use visitor proximity | Anyone who grants browser geolocation; exact visitor point stays in browser and only a bounded query point is sent | No prompt loop; normal Board remains usable |
| View provider microsite | Anyone; published provider-selected fields and contact channels only | `NOT_FOUND` for unpublished/unknown handle |
| Publish or edit current capacity | Fleet owner for owned truck; assigned company Driver with capacity permission; self-managed Driver for owned truck | `FORBIDDEN`, `INVALID_VEHICLE`, or validation error; no mutation |
| Refresh truck location | Assigned company Driver or self-managed Driver from its current device | `DEVICE_LOCATION_DRIVER_ONLY`; fleet owner cannot replace the Driver point |
| Manage regular corridors | Provider owner only; up to two per provider | `FORBIDDEN` or `REGULAR_CORRIDOR_LIMIT`; no mutation |
| Manage provider business information | Provider owner for its organization/profile; theme, hero, and video fields are outside this command | `FORBIDDEN`; no mutation, hidden-contact disclosure, or presentation overwrite |
| Start Tracking | Provider owner, self-managed Driver, or company Driver assigned to the selected truck | `FORBIDDEN` or `INVALID_VEHICLE`; no session, grant, email, or success audit created |
| Read provider Tracking | Owning provider and authorized assigned Driver | `NOT_FOUND` for unrelated actors |
| Add tracking event | Owning provider/authorized Driver; explicit state transition only | `INVALID_TRANSITION` or `FORBIDDEN`; no event |
| Upload status proof | Same provider scope, and only Loading, Unloading, or Issue events | `PROOF_NOT_ALLOWED`; no file record |
| Unlock guest Tracking | Anonymous holder of the matching customer-owner code before expiry | Generic invalid-code response; no customer detail leak |
| Read guest Tracking | Browser session holding the active Tracking grant | `TRACKING_LOCKED` or expired response |
| Submit provider review | Emailed customer owner for completed Tracking, once | `FORBIDDEN` or `REVIEW_ALREADY_SUBMITTED` |
| Dispute review | Rated provider, only for one- to three-star review | `REVIEW_NOT_DISPUTABLE`; rating stays visible/counted |
| Review evidence, ratings, billing, support | Platform role with the corresponding server-side permission | `FORBIDDEN`; action audited when allowed |

## Privacy invariants

- Public capacity returns the provider-selected obscured truck point, not an exact visitor point or private shipment location.
- Contact phone, WhatsApp, email, and website are independently opt-in.
- The single customer-owner Tracking code is stable and retrievable by the owning provider, but persistence stores only its keyed digest.
- The owner grant expires 30 days after completion.
- The customer-owner email is private and is scrubbed with expired guest access; the provider retains the operational record.
- Verification files and tracking proof paths are never included in public projections.
- Retired demand, network, and Business-profile routes do not authorize reads or writes.
