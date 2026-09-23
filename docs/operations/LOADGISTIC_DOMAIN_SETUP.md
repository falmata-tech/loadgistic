# Connect loadgistic.com

Prepared 2026-09-23 at the owner's request. No DNS, Netlify domain, Auth or
application setting has been changed by this task. The owner explicitly permits
replacing the Webflow records and says domain email will not be used. Existing
Google mail records can stay; deleting them is unnecessary for the website switch.

## Current public DNS

- DNS provider: GoDaddy (`ns49.domaincontrol.com`, `ns50.domaincontrol.com`).
- Apex A: `198.202.211.1`; `www` CNAME: `cdn.webflow.com`.
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
   URL `https://loadgistic.com/api/auth/callback`. Preserve currently required
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
