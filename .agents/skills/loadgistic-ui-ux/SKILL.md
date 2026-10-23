---
name: loadgistic-ui-ux
description: Design, review or improve Loadgistic user workflows, screens, navigation, product copy and Amharic/Afaan Oromo localization across web and Expo. Use for visible experience work, not backend-only changes or cosmetic tweaks with no workflow impact.
---

# Loadgistic UI and localization

Use this skill when a change affects what a visitor, provider, driver, business
team, platform staff member, Support agent or administrator sees or does.
Read `AGENTS.md`, the active objective in `docs/PROGRESS.md`, and the specs for
the actual task before proposing a screen change. The product invariant and
server authorization stay authoritative; this skill does not authorize a new
feature, data change, phone session, release or deployment.

## Design for the task

- Design for a real phone first when the task will be used on mobile: fit the
  essential job in a small viewport, respect safe areas and bottom navigation,
  support comfortable one-hand reach, and keep maps, sheets and floating actions
  from obscuring one another. Do not shrink a desktop layout and call it mobile.
  Carry the same task structure to web, using its extra space for useful context
  rather than extra controls.
- Make the layout do most of the explaining. Use hierarchy, grouping, sequence,
  familiar visual patterns and focused progressive disclosure to show what
  belongs together and what happens next. Keep helper text brief; use it only to
  clarify a choice, consequence, permission or uncommon action. Do not add
  paragraphs that describe what the interface already shows.
- Describe the person's goal and starting state before rearranging components.
  Follow the saved record through its next action and return path. Group facts
  and actions around the user's work, not tables, endpoints or staff subsystems.
- Account for first use, empty, populated, loading, saved, failure/retry and
  permission-denied states. An empty state explains what is missing, why, and
  one sensible next action. A new Capacity user should understand why their map
  has no signal and how to publish their first one; do not invent a truck
  location, live status or successful publication to fill empty space.
- Show saved information before editing. Opening a record is not consent to
  edit. Keep edits focused on one task, make Save and Cancel distinct, preserve
  drafts on recoverable failure, and show what changed after save.
- Give each screen a clear primary job and each action a predictable outcome.
  Use concise, specific action language, familiar navigation and a clear way
  back. Remove duplicate or dead controls only when the governing contract
  permits it. Use icons as quick visual recognition, with concise visible labels
  where a control's meaning is not already unmistakable in context; icon-heavy
  does not mean icon-only. Reserve longer copy for real decisions or risk, not
  to compensate for weak information architecture.
- A map or dashboard must explain itself when there is nothing to plot or
  manage. Keep map geometry, approximate-location privacy and source/status
  meanings truthful. Any unsaved route/area illustration must be clearly marked
  as a preview and must not look published.

## Design for language and place

- Write for the specific role and task, not for an assumed generic "African
  user." Language, work practices, devices and familiarity differ across
  Ethiopia, East Africa and the wider region. Use the user's operational
  reality and representative local examples without turning them into a
  stereotype.
- Translate intent, audience and consequence, not English word order, database
  names or internal product labels. Before changing a source string, establish
  who sees it, what action it controls and what happens next. Keep one complete
  idea per string; avoid sentence fragments assembled from separately
  translated pieces. Preserve variables and domain meanings.
- Let text wrap and controls grow. Check English, Afaan Oromo and Amharic at
  phone widths, including button labels, dialogs, alerts, navigation and long
  names. Do not truncate, shrink to unreadable sizes or silently replace a
  clearer local phrase just to preserve English geometry. Prefer adjusting
  layout and grouping over adding explanatory copy or compressing translated
  text. Check both Latin and Ethiopic script rendering.
- Use locale-aware dates, numbers and units where the current contract expects
  them. Do not transliterate names, invent unfamiliar abbreviations or claim a
  translation was validated by a fluent speaker when it was not.
- When wording is consequential or culturally ambiguous, provide the string's
  UI context and intended meaning to a fluent local reviewer. Use user testing
  to settle uncertainty rather than guessing from a broad regional identity.

## Verify the experience

- Inspect all affected web and Expo surfaces, then exercise real tasks in actual
  Chrome on desktop and phone: navigate, open and close, type, save/cancel,
  reload, retry failures and verify saved local API/database state. Include each
  affected role and its permission boundary. A screenshot or a mocked success is
  not workflow evidence.
- For native-only behavior, follow `AGENTS.md` and arrange the owner's Android
  phone session; Expo web cannot prove native location, notifications or OS
  permissions.
- Add or update the governing spec and focused regression tests for changed
  behavior. Run the narrowest useful checks first. For visible changes, perform
  and record the agent-led desktop/phone/Expo visual and task review required by
  `AGENTS.md` before expensive full gates. Share previews when useful; ask the
  owner only for unresolved product decisions or access. Record what was tested
  and what remains unknown.

Research behind these conventions:

- [W3C Internationalization Quick Tips](https://www.w3.org/International/quicktips/)
  recommends separating presentation from text, allowing translated text to
  expand, and checking imagery and examples with in-country users.
- [W3C guidance on translated text size](https://www.w3.org/International/articles/article-text-size/index.en)
  recommends flexible layouts that reflow rather than fixed-width, tightly
  fitted text.
- [Microsoft Research, Designing Mobile Interfaces for Novice and Low-Literacy
  Users](https://www.microsoft.com/en-us/research/publication/designing-mobile-interfaces-for-novice-and-low-literacy-users/)
  studied participants in Kenya and other countries. It compares graphical,
  text and spoken interfaces; it does not justify assuming every user needs an
  icon-only interface.
- [W3C WAI guidance on accessible names](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  calls for concise names that communicate an interactive control's purpose.
