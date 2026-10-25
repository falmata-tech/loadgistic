# Current work and release status

Updated 2026-10-25. Read the controlling [traceability map](../specs/TRACEABILITY.md)
and [product brief](PRODUCT_MASTER_PROMPT.md) for product contracts. Earlier
checkpoints remain in Git and the [October 23](PROGRESS_HISTORY_20261023.md)
and [October 20](PROGRESS_HISTORY_20261020.md) histories; this page records the
current delivery state.

## Current task — Android cross-platform qualification

The owner authorizes emulator testing and Closed Alpha upload only after the
app passes, including screen-by-screen web/native clarity, feature and translation
parity for customer roles. The latest instruction prioritizes a fixed local build
and permits unfinished Play setup to remain separate. Platform staff/Admin stay
web-only. Play submission is not complete. Ordered work:

1. Correct the packaging qualification: the original code-10 APK contained only
   ARM64 libraries and crashed on the x86-64 emulator. The earlier “universal”
   description was wrong; preserve its hash and inspect actual library members.
2. Fix the observed public-vehicle map handoff, obsolete email Capacity copy,
   internal Privacy navigation, labels/icons and accessibility translations;
   preserve permissions and verify the selected signup type.
3. Address the owner's final inspection findings: explain private-Capacity sign-in
   on mobile, preserve its signup/return context, use Preferred corridor wording,
   and verify actual demo corridor geometry on web and mobile. Deploy matching web
   changes after qualification; no further visual approval is requested.
4. Exercise installed Android visitor/provider/driver and available shipper/broker
   journeys, inspect phone layouts and compare web outcomes. Record gaps and native
   capability limits before declaring parity.
5. Run focused checks and the required source gates once for the resulting source;
   package and verify the matching APK/AAB and existing upload certificate.
6. Upload only that qualified bundle to the existing Closed Alpha track, then read
   back version, review state and tester availability. No public Play rollout.

Current findings and evidence (October25):

- Live demo inspection found 30 unassigned legacy route preferences. A restored
  hosted-data clone verified the exact 20 public-demo corridor repair and its
  rollback. The agent reviewed and applied that finite correction under the
  owner's instruction to fix demo data and self-review. Independent database and
  public API checks confirm 20 visible corridors; only vehicle/driver assignment
  columns changed, ledger208 unchanged. Protected review and receipts:
  `.local/corridor-demo-20261025/owner-review.md` and `applied-receipt.json`.
- Preferred corridor wording now distinguishes the saved preference from current
  Capacity routes; radius preferences use Preferred service area. Web/Expo phone
  route dialogs passed actual Chrome interactions and en/am/om inspection. The
  optional radius browser branch did not run; deterministic radius tests remain.
- Native Featured now follows the web's compact command strip and two-column
  provider portrait board. Chrome/Expo320px detail/close/schedule and translated
  Amharic/Oromo journeys pass. The long English profile journey hit local API
  timeout; this is not recorded as a completed native installed task.
- Private-Capacity authentication explains why sign-in is needed, retains the
  business signup selection and destination, and passes actual Chrome320/390px
  link/return checks. Shared native titles now expose heading semantics.
- Root1192-test run:1190 passed, one existing skipped, one browser-skip inventory
  failure. The reviewed inventory correction passes25 focused gate tests. Mobile
 338-test run:337 passed, one native raw-text guard caught a Featured condition;
  its boolean correction passes the7 focused guard/card cases. Do not relabel the
  initial failed runs as green; current-source CI is still required. A subsequent complete root test run passes1192
  of1193 (one existing intentional skip); final root typecheck passes after using
  the existing typed browser-test adapter. All338 mobile tests now pass.
- The dedicated x86-64 emulator launched the intermediate APK, but later Android
  system ANRs/hung QEMU and test-driver installation stalls prevented reliable
  installed role qualification. Emulator is stopped during heavy gates. These
  are infrastructure limits, not proof that final native workflows pass.
- Candidate `0d9ce6f` is on PR24. Its first CI run `40213634873` failed: stale
  Routes/preference-area labels and signup defaults, a Featured detail locator
  also matching a sponsor link, a first-page corridor-fixture assumption, and an
  opt-in browser test initializing Chrome before skipping. These assertions and
  fixture handling are repaired together. Focused actual Chrome checks pass:
  corridor1, role accessibility14, admin/area4, native signup/Featured2; the
  browser-gate inventory passes25. One CI Axe-analysis exception did not reproduce
  in those14 local role checks; its cause remains unconfirmed and checks remain.
- The final local1.2.0/code10 APK and AAB are built from `0d9ce6f`, with ARM64 and
  x86-64 runtime libraries. Archive, signature, bundle, required/forbidden
  permission and all50 native-library16KB structural checks pass. Both contain
  the same JavaScript payload. They use the debug certificate for local testing;
  installed final-artifact qualification and Play signing/upload remain pending.
  Exact files, hashes and limitations: `.local/play-code10-20261025/final/`.
- The immutable Linux web package from `0d9ce6f` passed source/function inspection
  and was uploaded as unpublished draft `6ade3c5478ea2d92b4f31c8e`. This has not
  changed production. Test/document-only corrections may reuse its frozen bytes
  only after executable-input equivalence and current terminal CI are verified.
  A fresh hosted advisor read is waiting for macOS Keychain access; older advisor
  evidence is not being relabeled as current.

The English Play listing has been saved as an unsubmitted Console draft and
reloaded successfully. Internal and Alpha still serve code7. Existing background
location and reviewer sign-in declaration changes remain unsent. Protected current
evidence is under `.local/play-code10-20261025/` and
`.local/release-20261025-ae03/play-preparation-20261025.json`.

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
- The original Android 1.2.0/code10 **ARM64-only, debug-signed test APK** is
  preserved at `.local/play-code10-20261025/loadgistic-code10-arm64-original.apk`, SHA-256
  `1195fbbc9d72c300d5b7df522ede9664d5ee9dbbcfc1d82dadde5c19d1cdde66`.
  It is not the current test build or a Play upload artifact. Use the final
  ARM64/x86-64 local test APK recorded above; installed review and source
  qualification remain required before the authorized Closed Alpha upload.

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
3. Finish candidate CI and the matching web rollout, then qualify the final
   installed Android artifact. Play testing preparation is authorized separately;
   upload remains conditional on qualification, with no public launch.
