---
id: FEAT-LNG-001
title: Plain-language interface localization
related_ids: [BASE-FE-001, BASE-DEP-001, FEAT-UIX-001, FEAT-IAM-001]
problem: People need to use public capacity and role workspaces in familiar languages without changing the content others published.
behavior: Visitors and signed-in users choose English, Amharic, Afaan Oromo, Somali or Tigrinya for application-owned interface text while user-generated content remains unchanged.
contracts: [InterfaceLocale, MessageCatalog, LanguagePreference, OwnedInterfaceText]
observability: [catalog_coverage, untranslated_interface_inventory, localized_browser_checks]
rollout: Implement locally, verify all five languages and unchanged user content on desktop and phone, obtain owner visual and language review, then run full release gates before separately authorized publication.
---

# Interface localization

### Scenario: choosing and retaining a language

Given a visitor or signed-in user opens any public or dashboard page\
When they choose English, አማርኛ, Afaan Oromo, Soomaali or ትግርኛ\
Then application-owned navigation, controls, guidance and status copy use that language\
And the choice persists in a first-party preference cookie across navigation and reloads\
And the document language matches the selected supported locale\
And the current route, filters and form data are preserved\
And missing or invalid preferences select English without redirecting the visitor.

### Scenario: user content and machine values are preserved

Given names, company descriptions, shipment notes, messages, addresses or other user content happen to match an English interface label\
When the interface language changes\
Then those values remain byte-for-byte unchanged\
And form names, option values, URLs, identifiers, stored statuses and authorization are unchanged\
And translation applies only at explicitly marked application-owned presentation boundaries\
And no text is sent to an external translation service.

### Scenario: plain and complete messages

Given an application-owned message appears on public, Featured, About, help, account, provider, Driver, support or administrator screens\
When it is localized\
Then its meaning and action remain equivalent in short, direct wording\
And whole messages use named interpolation rather than joining translated words around user data\
And familiar technical or product names may remain in English when that is clearer\
And uncertain or missing translations fall back to the original English rather than invented wording or blank controls\
And missing translations remain recorded as incomplete coverage, not counted as translated.

### Scenario: accessible and responsive presentation

Given any of the five languages is active\
When the interface renders on desktop or phone\
Then labels, hints, empty states and accessible names agree\
And Ethiopic text renders with a readable system font fallback\
And controls can wrap without covering map actions or leaving the viewport\
And server output and the first client render agree without DOM text replacement.

## Verification and review

Focused tests must cover locale allowlisting, English fallback, interpolation,
markup escaping, catalog parity, persistent switching, unchanged user data and
submitted machine values. Desktop/phone samples must include public capacity,
Featured, About, login and authenticated role workspaces. Catalogs are drafts
until reviewed for natural wording; automated coverage is not native-language
review. Metadata and outbound emails must be explicitly inventoried; no claim
of complete localization while an application-owned surface is outstanding.

No schema, account, provider or production configuration change is needed.
Rollback restores English presentation while preserving all records and locale
preferences. NR-13 governs visual review and release ordering.

Tests: `tests/localization.test.mjs`, `tests/e2e/localization.spec.ts`, and
`tests/e2e/truck-documents.spec.ts` (user content and machine values). Static
coverage: `node scripts/audit-localization.mjs --strict`; it must continue to
fail while translations are incomplete. Do not disable that failure or count
English fallback as a reviewed translation.

### Scenario: dynamic interface copy is included in the audit

Given statuses, counts, labels or feedback are assembled from application-owned data\
When language coverage is checked\
Then static messages and unresolved dynamic presentation boundaries are reported separately\
And status labels are translated before insertion into whole named messages\
And user names, descriptions, notes and persisted enum values remain unchanged\
And an unresolved dynamic boundary cannot be counted as complete localization.
