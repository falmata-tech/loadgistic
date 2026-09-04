# Authorization matrix

The active product is supply-first. Capacity seekers are anonymous visitors; only transport providers and platform-team users authenticate.

| Action | Allowed actor and scope | Denial behavior |
|---|---|---|
| Browse public capacity | Anyone; only the latest published Empty or Partial provider signal, with separate capacity and approximate-location age labels | Off Duty, inactive, unpublished, and unauthorized private records are omitted; older active signals stay visible with confirmation guidance |
| Use visitor proximity | Anyone who grants browser geolocation; exact visitor point stays in browser and only a bounded query point is sent | No prompt loop; normal Board remains usable |
| View provider microsite | Anyone; published provider-selected fields and contact channels only | `NOT_FOUND` for unpublished/unknown handle |
| Read Shared capacity | Anonymous browser with a valid email-OTP session that has not been idle for 30 minutes; only trucks actively shared with that normalized email | Generic invalid-code or expired-session response; no grant or truck existence leak |
| Manage truck Capacity access | Assigned Driver for that truck or owning fleet/provider; owner may view/revoke all owned-truck grants | `FORBIDDEN` or `NOT_FOUND`; no grant mutation |
| Read Loadgistic private capacity map | Platform administrator with Operations permission; only trucks explicitly shared with Loadgistic | `FORBIDDEN`; no private-capacity projection |
| Publish or edit current capacity | Fleet owner for owned truck; assigned company Driver with capacity permission; self-managed Driver for owned truck | `FORBIDDEN`, `INVALID_VEHICLE`, or validation error; no mutation |
| Refresh truck location | Assigned company Driver or self-managed Driver from its current device | `DEVICE_LOCATION_DRIVER_ONLY`; fleet owner cannot replace the Driver point |
| Manage regular service | Provider owner only; one Service area or Capacity route per provider | `FORBIDDEN` or `REGULAR_CAPACITY_LIMIT`; no mutation |
| Read or change Fleet Driver access | Active fleet owner for Drivers and trucks in the same owned organization; assignment and Capacity/Tracking permissions change in one transaction | `FORBIDDEN`, `NOT_FOUND`, or `SUBSCRIPTION_ACCESS_REQUIRED`; no partial assignment/permission change and no browser RPC access |
| Register a truck | Active Fleet transporter owner for its organization; active Owner-operator or Self-managed Driver for its own provider profile | `FORBIDDEN`, `SUBSCRIPTION_ACCESS_REQUIRED`, or bounded validation error; Company drivers, unrelated providers, anonymous callers, and browser RPC clients create no truck or successful audit |
| Manage sponsors and placements | Platform administrator only; transporter sponsors recheck feature eligibility and outside advertisers require bounded public copy plus HTTPS website and/or public phone | `FORBIDDEN` or validation error; no sponsor or placement mutation |
| Manage provider business information | Active provider owner for its organization/profile with current workspace access; theme, hero, and video fields are outside this command | `FORBIDDEN` or `SUBSCRIPTION_ACCESS_REQUIRED`; Company drivers and browser RPC callers receive no owner editor, mutation, hidden-contact disclosure, storage reference, or presentation overwrite |
| Start Tracking | Provider owner, self-managed Driver, or company Driver assigned to the selected truck with Tracking updates enabled | `FORBIDDEN` or `INVALID_VEHICLE`; no session, grant, email, or success audit created |
| Read provider Tracking | Owning provider and assigned company Driver with Tracking updates enabled | No provider history is returned to an unrelated or restricted actor |
| Manage Tracking parties | Owning provider or assigned Driver with Tracking permission for one active shipment | An unrelated actor cannot list, add, or revoke recipients; the customer owner cannot be removed; revocation supersedes outstanding OTPs |
| Add tracking event | Owning provider/authorized Driver; explicit state transition only | `INVALID_TRANSITION` or `FORBIDDEN`; no event |
| Share Tracking location | Assigned Driver for a location-enabled session, only during Going to pickup or En route | `ASSIGNED_DRIVER_LOCATION_REQUIRED`, `TRACKING_LOCATION_NOT_ENABLED`, or a throttled no-op; no unauthorized location event |
| Upload status proof | Same provider scope, and only Loading, Unloading, or Issue events | `PROOF_NOT_ALLOWED`; no file record |
| Request guest Tracking OTP | Anonymous visitor supplies one exact active recipient email and the matching shipment Tracking code | Generic outward response; an unknown or revoked email or wrong code creates no challenge or email delivery |
| Unlock guest Tracking | Anonymous visitor supplies the same approved email and Tracking code plus its unexpired single-use OTP | Generic denial; no customer detail leak or Auth account creation |
| Read guest Tracking | Browser session holding the short recipient-bound Tracking grant | Revoked/expired recipient or mismatched shipment returns no projection and the visitor must verify again |
| Submit provider review | Emailed customer owner for completed Tracking, once | `FORBIDDEN` or `REVIEW_ALREADY_SUBMITTED` |
| Dispute review | Rated provider, only for one- to three-star review | `REVIEW_NOT_DISPUTABLE`; rating stays visible/counted |
| Review evidence, ratings, billing, support | Platform role with the corresponding server-side permission | `FORBIDDEN`; action audited when allowed |
| Start Assisted matching | Account-free visitor with valid email, optional phone, and bounded message | Rate-limited generic validation response; no public demand or account |
| Read or reply to Assisted matching | Signed guest session or matching email/recovery code; assigned Support actor; administrator with Support permission | `NOT_FOUND` or generic access denial; no contact, message, assignment, or file leak |
| Read Assisted matching attachment | Same guest-conversation session, assigned Support actor, or Support-authorized administrator | `NOT_FOUND`; every read reauthorizes the conversation |

## Privacy invariants

- Public capacity returns the provider-selected obscured truck point, not an exact visitor point or private shipment location.
- Contact phone, WhatsApp, email, and website are independently opt-in.
- The shipment Tracking code is stable and retrievable by the owning provider, but persistence stores only its keyed digest; the code never grants access without an active shipment recipient and email OTP.
- The owner grant expires 30 days after completion.
- The customer-owner email is private and is scrubbed with expired guest access; the provider retains the operational record.
- Verification files and tracking proof paths are never included in public projections.
- Private current-capacity grants are truck-scoped and revocable. Current
  geometry and approximate location are excluded from the public Market; only
  categorical status and the provider's separate public regular Service area
  or Capacity route may retain a clearly labeled non-location marker. A Shared capacity guest receives the Driver-selected
  approximate radius, never an exact device point or another email's grants.
  Background map traffic cannot renew the 30-minute idle boundary, and logout
  clears the restricted cookie immediately.
- Guest Assisted matching is private support. It creates no Load, demand post,
  ranking record, transaction, or account, and access codes are never stored or
  logged in plaintext.
- Guest Tracking projects only the Driver's already-obscured point and selected uncertainty radius, and only during Going to pickup or En route; no exact device coordinate is stored.
- Retired demand-side member-network and Business-profile routes do not
  authorize reads or writes. The current provider `Network` is a distinct,
  truck-scoped private-capacity access feature.
