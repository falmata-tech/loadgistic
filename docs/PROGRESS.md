# Current work and release status

Updated 2026-10-25. Read the controlling [traceability map](../specs/TRACEABILITY.md)
and [product brief](PRODUCT_MASTER_PROMPT.md) for product contracts. Earlier
checkpoints remain in Git and the [October 23](PROGRESS_HISTORY_20261023.md)
and [October 20](PROGRESS_HISTORY_20261020.md) histories; this page records the
current delivery state.

## Live delivery

- The web app is live at https://loadgistic.com on Netlify production deploy
  `6addfeebd797c1ac88d89123`. It uses the immutable web build from `a692892`
  whose executable inputs were proved equivalent to source `ae03d98`; PR22
  merged that source to `main` as `5c973c5`. Main CI run `40190784277`, attempt
  2, passed all 16 required jobs, including `release-ready`. Attempt 1 had one
  Featured Play-policy browser failure; its exact redirect cause was not
  diagnosed, and the targeted retry passed. The failed attempt remains evidence.
- Supabase project `tpwyyzoqijjmbvsmmvcm` is at migration ledger 208. The
  owner-approved 199–208 apply completed once and the linked ledger was verified.
  Migration 207 removed five legacy email-only private Capacity grants; it did
  not remove email-based Tracking. Hosted security advisors report zero errors
  and the same two separately accepted warnings. The SQL hashes, protected
  backup/rehearsal and apply readback are in `.local/release-20261025-ae03/`.
- Android 1.2.0/code 10 is a **local, debug-signed test APK** at
  `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`, SHA-256
  `1195fbbc9d72c300d5b7df522ede9664d5ee9dbbcfc1d82dadde5c19d1cdde66`.
  It is not a Play upload artifact. Google Play signing, upload and publication
  remain paused by the owner.

## Production verification and limits

- The production deploy ID and `production` context were independently read
  back. Health, public Capacity and Featured APIs returned 200; public Capacity
  returned 48 eligible vehicles and Featured returned eight providers. Real
  Google Chrome at desktop and phone widths rendered Capacity and Featured
  without horizontal overflow. A later settled desktop map showed 24 map tiles
  and 20 visible markers. The initial desktop capture still showed its loading
  skeleton after two seconds, so immediate map paint is not claimed.
- Two optimized vehicle-image widths decoded, while anonymous access to a
  private synthetic document and its image proxy was denied. Three dedicated
  synthetic review accounts passed 43 signed-in API checks across sessions,
  account/workspace, Capacity, Network, Support, authorized private-document
  access and sign-out. These sampled production checks do not prove every
  nested role workflow or a fresh installed Android acceptance.
- The unpublished Netlify draft `6addf1480d5c1915b0ae86ab` used
  `deploy-preview` context and lacked production-only runtime configuration;
  it was **not** promoted. The same verified build was uploaded once using
  production context and then verified. Do not broaden preview secrets merely
  to make a draft health check pass.
- The recovery package is a fresh hosted data-only archive plus a reconstructed
  ledger-198 schema snapshot. A disposable restore and exact 199–208 rehearsal
  passed, including public owner/grant parity. It is not a byte-for-byte current
  hosted schema backup: managed Auth/Storage differences remain, the provider
  reports no backups or PITR, and post-snapshot writes cannot be restored by it.
  Never apply that composite archive over a live project automatically; an
  incident needs a scoped, separately reviewed recovery plan.
- Local demo-world simulator slices have passed GPS intake, Capacity, Tracking,
  provider-profile and broker-staff checks, but controls are off. Do not claim
  always-on hosted simulation or real-device GT06 ingress. See the
  [local supervisor](operations/DEMO-WORLD-LOCAL-SUPERVISOR.md).

## Next authorized work

1. Keep the current web/SQL release monitored; investigate any concrete live
   failure before another write. Protected receipts and screenshots are under
   `.local/release-20261025-ae03/`.
2. Treat hosted simulator activation and GPS ingress as separate reviewed
   infrastructure work.
3. Await the owner's explicit go-ahead for Play work. The local APK may be used
   for local testing, but no signing or Play submission follows from this web
   release.
