# Connect loadgistic.com

Domain connected and HTTPS verified, 2026-09-23. The owner updated GoDaddy DNS and explicitly
authorized publishing on loadgistic.com. Netlify now has the apex as its primary
domain and www as an alias. Production APP_URL and the two exact Auth callbacks
are configured. HTTPS, canonical redirects and desktop/phone public checks pass.
The domain currently serves deployment `6ab3aaa9668f9644dcba97d8`; the new
Tracking application release still awaits its remaining release gates.
The owner permits replacing Webflow and says domain email will not be used. Existing
Google mail records can stay; deleting them is unnecessary for the website switch.

## Current public DNS

- DNS provider: GoDaddy (`ns49.domaincontrol.com`, `ns50.domaincontrol.com`).
- Apex A: `75.2.60.5`; `www` CNAME: `loadgistic-473.netlify.app`.
- MX: Google's `aspmx.l.google.com` and four alternate hosts.

The website switch replaces the existing Webflow destination. Preserve the
current zone export for recovery. Retain MX, SPF, DKIM, DMARC and unrelated
verification records; changing the website does not require an email migration.

## Owner steps and application checks

1. In Netlify, open **loadgistic-473 → Domain management → Add a domain**.
   Add `loadgistic.com` and `www.loadgistic.com`. The intended primary domain
   is `loadgistic.com`, with `www` redirecting to it. Keep external GoDaddy DNS.
2. In **GoDaddy → Domain Portfolio → loadgistic.com → DNS**, edit the existing
   website records (do not create duplicate conflicting records):

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 75.2.60.5 |
   | CNAME | www | loadgistic-473.netlify.app |

   Use the default TTL and retain all email records. Confirm Netlify's exact
   DNS instructions for this site before saving. Check for conflicting apex
   AAAA records and domain forwarding; do not delete unrelated records.
3. In Netlify, verify DNS and issue the HTTPS certificate covering both names.
   Confirm certificate and redirect behavior before declaring the domain ready.
4. After recording exact current/proposed fields and recovery values, change
   the production app's `APP_URL` to `https://loadgistic.com` and rebuild the
   reviewed artifact. The application uses it for customer email links, fleet
   invitations and the `/api/auth/callback` URL.
5. Through the Supabase dashboard's narrow **Authentication → URL Configuration**
   controls, set Site URL to `https://loadgistic.com` and add the exact redirect
   URLs `https://loadgistic.com/api/auth/callback` and
   `https://loadgistic.com/api/account/security/callback`. Preserve currently required
   existing URLs during cutover. No broad configuration push, SMTP/provider
   enablement change, API-domain change or credential replacement is required.
6. Verify apex and www HTTPS, canonical redirects, public capacity, normal
   email-code login/signup, authenticated cookies/logout, customer Tracking and
   generated email links. Confirm a real-recipient production login with an
   approved demo alias; request acceptance alone is insufficient.

Do not call the cutover complete while DNS/certificate/auth/link verification
is pending. Application release remains subject to the separate Tracking visual
approval and release checks. Restoring website DNS or app URL is a separate
reviewed recovery action, not permission to restore the entire DNS/Auth setup.

Sources checked: [Netlify external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/),
[GoDaddy A records](https://www.godaddy.com/help/add-or-edit-an-a-record-42546),
[GoDaddy CNAME](https://www.godaddy.com/en-in/help/add-a-cname-record-19236),
[Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## September 23 cutover evidence

Exact target: Netlify `dbb0fcec-9ec9-4511-9737-db0e32849af5`, account
`5d8a1491d8dc83018e9f4814`, Supabase `tpwyyzoqijjmbvsmmvcm`. The protected
plan and old values are in `.local/domain-20260923/plan.json`; digest
`20de92facfc03ac9abf4fab278167042360d7f7b1eeb4b52ecec106d107f6b3e`.
Domain and URL receipts confirm only the planned fields changed. An equality
check of all remaining Auth fields passed. Old Netlify callbacks remain allowed
during cutover. No DNS, email records, SMTP, provider, key or database changes
were made by this domain operation.

Netlify accepted the initial managed certificate request with an asynchronous
empty result. The local receipt formatter then failed; no second request was
sent. Read-only certificate and HTTPS checks determine completion. Do not repeat
the request or mark HTTPS ready based solely on its acceptance.

Verification at 13:03–13:06 UTC: certificate issued for both names; apex HTTPS
returns 200; www HTTPS redirects 301 to the apex; HTTP redirects to HTTPS; health
returns 200 and ready with no blockers. Desktop and phone browsers pass map
loading, filtering, Clear all and email-only login rendering without page errors.
An initial browser probe raced hydration after navigation; the corrected wait
passed. Evidence and screenshots: `.local/domain-20260923/`.

This verifies the public domain, not a completed production email-code login.
The owner's earlier Gmail confirmation belongs to the local-app/real-SMTP
Tracking test. New canonical email links take effect when the reviewed application
is rebuilt and promoted with the changed production APP_URL.
