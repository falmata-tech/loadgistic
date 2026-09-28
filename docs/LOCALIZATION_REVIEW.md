# Localization review — updated 2026-09-24

Status: local implementation and partial translation, not release-complete.
Contract: [FEAT-LNG-001](../specs/features/FEAT-LNG-001.md).

## September 27: combined capacity map

The map choices are “Open to the public” and “Privately shared with you”. All four
non-English catalogs cover these labels, the shared introduction, email-code access
instructions, screen-reader names and related About copy. Recipient-facing language
explains shared information; provider-side network management retains its own meaning.
The changed strings are included in the checked launch inventory. Desktop and 320px
phone checks verify rendered translations and form clickability; native-speaker review
is still separate from automated coverage. User-provided content remains untouched.

## September 24: contextual launch copy

Curated 146 priority message groups for discovery, callback, signup/roles,
Tracking access/recovery, document review and About. Short navigation labels may
differ from full headings. See `resources/i18n/CONTEXTUAL_COPY.md` for semantic
rules and `launch-message-keys.json` for checked coverage. Catalogs now contain
1,147 entries per language after the Featured/readability, broadcast-window and managed transport wording passes. These edits are not native-speaker approval.

Provider-only Support adds six contextual notices/recovery labels in all four
languages. Send request replaces the callback-specific action. Coverage is checked
by the launch-message inventory; no native-speaker approval is claimed.

## September 23 corrections

- Added 85 messages to each of Amharic, Afaan Oromo, Somali and Tigrinya
  (987 catalog entries per language). This count includes new whole-message
  replacements, not only previously missing keys.
- Filled prominent profile, account, support, filter and tracking copy gaps.
- Replaced assembled English/translated fragments in tracking save/current-state
  messages, distance choices, pagination, profile counts and regular-service copy.
- Translated application-owned status and role labels at the display boundary;
  retained machine statuses, form values, user names, descriptions and notes.
- Corrected the Oromo spelling of “days” and removed the unintended weekly/turn
  implication from the Amharic/Oromo Featured navigation label.
- Corrected “New to Loadgistic” from a question to the visitor into a statement
  describing the transporter, in all four translations.
- Extended the static inventory to inspect fixed object labels/hints and report
  dynamic text/accessible-attribute boundaries separately. It deliberately does
  not translate arbitrary fields merely because they contain English.

## Outstanding coverage

Run `node scripts/audit-localization.mjs --strict`. The command must keep failing
while known gaps remain. Zero raw JSX text or equal catalog keys does not establish
complete localization. The generated JSON includes exact source locations.

The current inventory reports **409 missing fixed messages** and **150 dynamic
boundaries requiring classification**, across 1,382 marked messages.
The September 24 strict audit still fails as expected; one unmarked JSX value is the intentionally unchanged time-zone abbreviation EAT;
absence of raw JSX prose would not establish complete coverage. The broader
inventory means these counts are not directly comparable to the earlier audit.

Current remaining work includes:

| Surface | Work still required |
| --- | --- |
| Public truck cards and map overlays | Capacity age labels, composed fallback descriptions, geometry labels, accessible names and truck configuration display labels. Preserve coordinates, enum values and user place names. |
| Tracking guest pages and other forms | Remaining guidance, server feedback, dynamic headings and interpolated text outside the corrected progression panel. |
| Account, signup and dashboards | Remaining onboarding, lifecycle/security guidance, admin queues, review details and dynamic action labels. |
| Help, privacy and terms | Translate remaining explanatory/legal text without changing its meaning. |
| Document badge details | Review date formatting, composed tooltip/review-count text and remaining accessible labels. |
| Metadata | `src/app/layout.tsx` still has English metadata; it is outside the JSX inventory. |
| Email | `src/lib/email-templates.js` and the email-provider boundary still use English. Recipient locale is not yet an outbound-email contract. |
| Browser-owned controls | File picker/validation wording depends on the browser; distinguish this from application copy. |

Dynamic findings need human classification: some are intentionally unchanged user
content, while others are untranslated app text. Do not automatically translate
the whole list or mark it resolved by adding English copies to all catalogs.

All four catalogs remain drafts for natural-language review. Automated checks can
verify coverage, interpolation and preserved inputs, but do not prove idiomatic
Amharic, Afaan Oromo, Somali or Tigrinya. Technical names may stay in English where
that is clearer, as the owner requested.

## Local verification

Focused catalog/progression tests and desktop/phone browser results are recorded
in [PROGRESS](PROGRESS.md). The dev server remains at http://127.0.0.1:3100.
Preview the public provider at http://127.0.0.1:3100/@rift-valley-haulage-02 and
switch languages; user-written company descriptions intentionally stay unchanged.
No hosted configuration, account, email, database or deployment was changed by
this review. Tracking browser checks use disposable local records and Mailpit.
