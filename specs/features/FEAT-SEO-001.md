---
id: FEAT-SEO-001
title: Public search discovery without private workspace indexing
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-IAM-001, FEAT-MKT-001, FEAT-PRV-001, FEAT-FTR-001, FEAT-TRK-001, FEAT-LNG-001, FEAT-ENT-001]
problem: Visitors need useful public pages in search results without exposing email feeds, shipment records, account screens or endless filter combinations to indexing.
behavior: Intentionally public pages retain concise server-rendered content and ordinary crawlable links. Production canonical metadata and a small static public-page sitemap describe actual public destinations. Private, account, API, authentication and filtered views are not indexed. The same compact Marketplace and My workspace switch preserves the current real provider or driver workflow without pretending unfinished enterprise authority exists.
contracts: [PublicSearchMetadata, PublicCanonicalUrl, PublicSitemap, SearchRobotsPolicy, WorkspaceAreaNavigation]
observability: [public_metadata_status, sitemap_route_count, private_noindex_header, navigation_return_result]
rollout: Implement and test locally; review actual desktop and phone Chrome navigation and response metadata before full release gates. Deploy configuration and application together only through the existing approved release process. Roll back presentation and search metadata independently of authentication; never weaken record authorization to make crawling work.
---

# Public search presentation — October18

Status: local implementation, focused checks and actual integrated Google Chrome
desktop/phone navigation and metadata checks pass. Owner visual review of the
connected screens and full release gates remain pending. No production indexing
or ranking result is promised.

## Public pages and useful content

Given a visitor or crawler opens the public Capacity, About or Featured page\
When the initial document is returned\
Then its real page heading and concise explanation are present in server-rendered HTML\
And navigation uses accessible anchors with real href destinations\
And the map remains the primary Capacity surface without hidden keyword text,
fabricated structured data, doorway pages, counters or testimonial claims.

Given the configured origin is the official Production site\
When a public page returns metadata\
Then its canonical URL uses the exact HTTPS Loadgistic origin and excludes query
values, fragments, session credentials and private identifiers\
And provider canonicals contain only the public handle without another profile
lookup or private name/contact fields\
And cookie-selected language does not manufacture separate locale URLs or hreflang
alternates that the application does not serve.

## Crawling and private access

Given a search engine reads sitemap.xml\
When it receives the sitemap\
Then only the small explicit public page allowlist is returned in Production\
And no database enumeration, provider demo fixtures, personal emails, shipment
IDs, private feeds, search results, filters, staff or application URLs are included\
And local/preview environments publish no indexable sitemap entries.

Given a route is authenticated, email-private, Tracking, API or account access\
When the application serves it\
Then a noindex response policy applies, including private query variants\
And authorization still controls every private read, because robots directives
are search preferences and never an access-control boundary.

Given filters or search parameters change the public Capacity results\
When metadata is rendered\
Then that combination is noindex with the unfiltered public canonical\
And parameter values never become titles, descriptions or canonical URLs\
And no new crawlable pages or automatic filter-combination links are generated.

Given an unknown or non-Production application origin\
When robots, sitemap or default metadata is rendered\
Then search indexing is discouraged by default rather than treating an arbitrary
Host header, test process or preview deployment as Production.

## Common navigation

Given a visitor opens Marketplace or a current provider/driver opens My workspace\
When the approved compact two-area switch is used\
Then an anonymous workspace entry leads to actual sign-in\
And an authenticated provider/driver returns to its allowed prior page and map
state without a new login\
And driver Home stays map based while non-driving owner Home stays Fleet\
And platform staff and business permissions are never fabricated by presentation
controls or remembered browser state; current selected membership is checked by
the server.

## Evidence and source decisions

The installed Next15.5.25 package has no node_modules/next/dist/docs directory.
Implementation uses its installed Metadata/MetadataRoute declarations and existing
App Router patterns; no package upgrade or framework convention change is needed.

Official Google sources reviewed October18:

- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): retain server-rendered content and one canonical.
- [Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable): use ordinary anchors and useful labels.
- [Noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing): robots.txt disallow alone cannot prevent indexing; keep authorization separate.
- [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): list the public canonical destinations actually intended for search.
- [Faceted navigation](https://developers.google.com/crawling/docs/faceted-navigation): avoid generating an unlimited filter URL space. Existing submitted filters remain usable; this slice adds no indexable filtered landing pages.

Tests: `tests/public-seo.test.mjs`, `tests/workspace-area-navigation.test.mjs`,
`tests/web-area-switch.test.mjs`, `tests/web-workspace-navigation.test.mjs`, `tests/e2e/public-seo-navigation.spec.ts`; actual Chrome desktop/phone navigation and
public/private response-header checks after integration. Actual receipts:
`.local/seo-20261018/chrome-public-review.json` and
`.local/seo-20261018/chrome-map-seo-review.json` (1440px desktop/390px phone,
real loaded map, ordinary navigation, no overflow/page errors, private/filtered
noindex and preview sitemap exclusions). Full quality, build,
release and remote checks remain outside this focused implementation pass.
