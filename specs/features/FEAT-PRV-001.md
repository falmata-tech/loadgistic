---
id: FEAT-PRV-001
title: Public transport-provider Directory and branded microsites
related_ids: [BASE-FE-001, BASE-BE-001, FEAT-IAM-001, FEAT-CAP-001, FEAT-MKT-001, FEAT-VER-001, FEAT-REV-001]
problem: Transport providers need to be represented as credible businesses, while visitors need rich public context before making contact.
behavior: Only fleet transporters and self-managed providers receive public Directory entries and canonical `/@handle` microsites. Providers manage accurate public contacts and business content; Loadgistic staff controls the bounded page colors, hero media and optional click-to-load YouTube introduction so providers do not have to design the page.
contracts: [PublicProviderDirectory, ProviderMicrosite, PublicProviderHandle, StaffManagedProviderPresentation, PublicContactPolicy, YouTubeVideoReference, ProviderPageCommand, PublicFleetProjection]
observability: [provider_page_view, provider_profile_update, public_contact_click, video_open, handle_resolution]
rollout: Add profile presentation fields additively, reserve and validate handles, keep legacy provider URLs as redirects, and exclude all capacity-seeking Business profiles from public projections.
---

# Transport-provider public presence

### Scenario: only providers enter the public Directory

Given public and legacy profile records coexist\
When anyone browses `/providers`\
Then only published fleet transporter and self-managed provider profiles appear\
And capacity-seeking Businesses never receive a public Directory card or microsite\
And account email, account phone, private plate, exact coordinates, and private evidence remain excluded.

### Scenario: canonical provider handle is public

Given a published provider owns a unique validated handle\
When `/@handle` is requested\
Then the request resolves to that provider's public microsite\
And old provider profile URLs redirect to the canonical handle\
And unknown, reserved, malformed, or unpublished handles reveal no profile.

### Scenario: microsite represents the provider fully

Given a provider maintains its page\
When a visitor opens the microsite\
Then it may show logo or hero media, headline, about text, services, verification badges, verified-shipment review summary, active fleet presentation, current capacity, up to two regular corridors, and provider-selected public contacts\
And each claim is based on owner input or current records rather than invented metrics\
And a low rating that is awaiting review remains visible and included in the public count and average\
And the page remains usable on mobile and without playing media.

### Scenario: Loadgistic controls bounded presentation

Given a provider edits its public business information\
When the editor renders\
Then color, hero image, and introduction-video controls are absent\
And existing presentation values remain unchanged by provider submissions\
And validated primary and accent colors, approved hero media, and an allowlisted video reference come only from Loadgistic-controlled provider configuration\
And arbitrary CSS, scripts, HTML, external styles, or layout replacement are rejected\
And the Loadgistic safety notice, attribution, navigation, and contact semantics cannot be hidden.

### Scenario: public contacts are independently controlled

Given a provider has public phone, WhatsApp, email, and website values\
When the owner changes visibility\
Then each method is independently public or hidden\
And hidden values are absent from HTML and public API projections\
And the public contact phone is stored separately from the required private account phone\
And private account contacts are never used as fallbacks\
And a visible Call action displays the public phone number while retaining its `tel:` destination.

### Scenario: YouTube introduction loads after intent

Given Loadgistic staff has saved one valid allowlisted YouTube video identifier for a provider\
When the microsite first renders\
Then a lightweight thumbnail and Play action appear without loading the player iframe\
And pressing Play loads the privacy-aware embed\
And arbitrary embed HTML or non-allowlisted hosts are rejected.

## Contract ownership

- Pages: `/providers`, canonical `/@handle`, and provider public-information settings
- Compatibility: legacy profile URLs redirect to canonical provider handles
- Application services: public provider projection and owner-scoped page update
- Tests: repository, authorization, E2E, visual audit
