# Application routes

## Public

- `/` — canonical account-free Truck Market workspace with compact welcome, Map-first/List discovery, and advanced truck and geographic filters.
- `/featured` — independently loaded Daily Featured Transporters workspace with the regional programme, live schedule, featured billboard, and transporter/outside-advertiser Sponsors panel.
- `/capacity` — compatibility redirect to `/` that preserves query parameters.
- `/providers` — compatibility redirect to the Truck Market; a provider-name query is preserved and filters to that provider's current trucks.
- `/@handle` — canonical provider microsite using the shared Loadgistic template and detailed active-truck cards.
- `/providers/[handle]` — compatibility route to the canonical handle.
- `/track` — customer-owner code unlock for anyone the owner trusts.
- `/track/[id]` — customer-safe guest Tracking after owner-code unlock.
- `/shared-capacity` — one email-OTP entry to the map of every truck that
  explicitly shared current capacity with that verified address; access ends
  after 30 minutes without deliberate activity and includes a visible logout.
- `/api/shared-capacity/session` — renews a still-valid restricted session after
  bounded visitor interaction or clears it on logout; background map reads do
  not call this adapter.
- Persistent `Ask Loadgistic` launcher — starts, restores, attaches files to,
  minimizes, ends, and restarts an account-free Assisted matching chat across
  supported public routes.
- `/help` — recovery-code fallback for a chat opened on another browser.
- `/help/[id]` — signed guest Assisted matching conversation.
- `/about` — product purpose and safety model.
- `/privacy` — concise public privacy and data-use summary.
- `/terms` — concise public platform terms.
- `/apply` — fleet or self-managed provider signup.
- `/login` — provider/platform-team login.

## Provider workspace

- `/app/home` — role-appropriate provider or Driver summary.
- `/app/fleet` and `/app/fleet/[id]` — fleet roster, truck detail, and capacity planning.
- `/app/provider-shipments` — bounded provider-owned Tracking history.
- `/app/provider-shipments/new` — start Tracking after offline agreement.
- `/app/provider-shipments/[id]` — customer access, timeline, and one governed action panel.
- `/app/company-page` — provider microsite editor.
- `/app/verification` — owned evidence requests.
- `/app/support` — member Support.
- `/app/network` — truck-scoped Private capacity network, email grants, and
  explicit Share with Loadgistic controls.
- `/app/more` — private account, plan, and payment information.
- `/app/menu` — role-authorized profile, verification, Support, public Market/Featured shortcuts, and logout.

Retired `/app/capacity` and `/app/capacity/[id]` addresses redirect to the canonical public Truck Market. A truck-specific internal link uses `/?truck=[capacity-id]` so the public map opens with that current truck selected.

Provider location mutation:

- `POST /api/capacity/location` — assigned/self-managed Driver-only refresh of the current signal's browser-obscured location and timestamp.
- `POST /api/provider-shipments/[id]/location` — assigned-Driver-only, throttled approximate Tracking-location refresh during Going to pickup or En route when the session explicitly permits location.

Former `/app/loads`, `/app/shipments`, `/app/providers`, and `/companies`
surfaces redirect to a current safe destination. The retired demand-network
endpoint `/api/network` returns `410 Gone`; `/app/network` now belongs only to
truck-scoped Private capacity access.

## Platform team

- `/admin/operations` — bounded provider, truck, capacity, shipment, delivery, and cleanup oversight.
- `/admin/reviews` — documents, provider-rating disputes, and payments.
- `/admin/support` — Support supervision.
- `/admin/capacity-network` — Operations-authorized private map of trucks whose
  Drivers selected Share with Loadgistic.
- `/admin/featured` — administrator roster, live schedule, sponsor catalogue,
  regional placements, and Sponsor-break preview.
- `/support` and `/support/[id]` — assigned Support-agent queue and conversation.
- `/support/assisted` and `/support/assisted/[id]` — account-free Assisted
  matching queue and assigned conversation.

## System

- `/api/health` — process/database health only; it does not assert public-production readiness.
