# Interface language: launch review

FEAT-LNG-001 / FEAT-LUX-001, 2026-09-24.

Write for the action on screen, not for the English sentence structure. This
pass curates the 146 message groups in `launch-message-keys.json` in Amharic,
Afaan Oromo, Somali and Tigrinya. The Featured/readability pass adds 42 checked groups (including the official broadcast-window controls) in
`featured-review-message-keys.json`, covering real run status, waiting turns,
manual days and plain interface wording. These are editorial drafts; automated checks
prove rendering and placeholder safety, not native-speaker fluency or complete
translation of the app.

## Meaning to preserve

- Capacity means a truck's available cargo space or readiness for transport,
  never a person's ability. Empty/Partial describe usable truck space.
- Open is truck discovery; Private means trucks shared with this recipient.
  Short navigation wording can differ from the full page heading.
- Ask for help covers general questions, problems and disputes. Keep that purpose
  in chat, recovery and staff labels; do not promise a resolution or response time.
- Request transport asks for help finding a provider by phone. Loadgistic does
  not promise that it carries the cargo, has booked a truck or guarantees a match.
- Tracking is following a shipment's progress. The transporter supplies the
  shipment access code; email supplies a separate six-digit verification code.
- A fleet owner adds the driver using email and can assign a truck immediately.
  The driver's own email-code login verifies access. Never imply that the owner
  can verify the driver's inbox for them.
- Reviewed documents means Loadgistic reviewed those particular documents. It
  is not a guarantee of safety, current availability or provider performance.
- Featured is a rotating showcase. Its schedule is not availability or ranking.
- Error messages explain the next action. An uncertain shipment save directs
  the user to existing Tracking before another attempt; it must not say it failed.

Keep Loadgistic, email, shipment codes and other necessary familiar technical
terms recognizable. Use natural whole sentences rather than concatenated
translated fragments. Preserve named placeholders exactly. Never translate user
names, business descriptions, cargo, places, contacts, notes or machine enums.

## Phone review

Review the actual controls, not only a spreadsheet. Confirm clear verbs, natural
local terms, unclipped text, recognizable code labels and an understandable next
step after an error. Have a fluent speaker of each language review priority
journeys before advertising full language support. Record proposed wording with
its screen/context and the whole-message key; do not replace a shared word
without checking all its uses.

Broader dynamic-message gaps from the existing localization inventory remain
separate work. This pass does not claim that every administration, legal or
server-generated message has been localized.


Managed transport wording (owner-approved, 2026-09-24) adds seven contextual
messages for Arrange transport, the request title/service, document-and-tracking
explanation, fee agreement, callback action and receipt. The launch key inventory
checks presence across Amharic, Afaan Oromo, Somali and Tigrinya. These are UI
translations, not native-speaker sign-off; user routes, names and messages remain
untouched. Brokerage staff confirm scope/fee; submission itself performs no checks,
charges or tracking invitations.
