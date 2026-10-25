# Current work and release status

Updated 2026-10-25. Read the controlling [traceability map](../specs/TRACEABILITY.md)
and [product brief](PRODUCT_MASTER_PROMPT.md) for product contracts. Earlier
checkpoints remain in Git and the [October 23](PROGRESS_HISTORY_20261023.md)
and [October 20](PROGRESS_HISTORY_20261020.md) histories; this page records the
current delivery state.

## Current task — Android parity and matching web release

The owner prioritizes a fixed local Android build and the matching live web
changes. Closed Alpha upload is permitted only after qualification; an unfinished
Play setup may remain separate. No public Play launch. Platform staff/Admin stay
web-only. The agent reviews changed screens without another visual-approval
question. Use only Loadgistic; preserve `next-env.d.ts` and mobile `.claude` edits.

Ordered checkpoint:

1. Implemented/tested: web-like native Featured board/detail, private-Capacity
   sign-in explanation and retained shipper/broker signup/return context,
   Preferred corridor wording, public vehicle map links, Android Back and
   translated loading/action names. Related specs: FEAT-MOB/CAP/GEO/LST/UIX-001.
2. Applied/verified: finite demo-only correction restored20 public corridor
   assignments. Only vehicle/driver assignment columns changed; ledger208 and
   all30 other columns stayed unchanged. Backup, rehearsal, rollback and exact
   DB/API readback: `.local/corridor-demo-20261025/`.
3. Built/installed/tested: Android1.2.0/code10, ARM64/x86-64 (not32-bit ARM),
   debug-signed, built fromebc6df9 and input-equivalent to1bea439. Exact files and
   source-preserving receipts: `.local/play-code10-20261025/final-parity/`.
   Native driver Capacity save matches database visibility/load/route values;
   sign-out revokes the synthetic server session1→0. Manual Location draft/
   cancel, private signup choice, Featured detail and Android Back pass. Earlier
   unchanged-screen receipts separately cover corridor/Partial, fleet GPS/Support
   and Account edit/cancel; they retain their original source and hash.
4. Implemented: the web-only keyboard-loading repair and bounded authenticated
   Axe diagnostics, then quality, exact-source web packaging and PR24 CI. Both
   map-action rails now receive visible keyboard focus even when their buttons
   are disabled. The real server-rendered regression passes desktop1280 and
   phones390/320; all14 provider role/route Chrome Axe cases pass after the fix
   in6.1m. Focus screenshots were reviewed at all three widths. The first broad
   gate on pinned Node22.16 hit15 TypeScript-loader failures before those tests
   ran (1115 pass/one skip). A10-case probe with its supported type-stripping
   flag passed; the root test command now enables that mode explicitly while
   preserving two workers and every test. The complete corrected gate passes
   1197/1198 tests (one existing intentional skip), source/spec/workflow checks
   and typecheck in213s. Exact52477bb PR CI40235307637 passed all16 jobs; PR24
   merged as5892cc7 with an identical tree. Its isolated Linux web build and eight
   function archives pass inspection. Unpublished draft6ade7acca3ae982b016fad3f
   serves matching static/image bytes; production is unchanged.
   New immutable web package: `.local/release-20261025-focus/`. Review native
   input equivalence to the resulting head before reusing the tested APK/AAB.
5. Current: repair the reproduced accessibility harness race before new CI.
   Main CI40237550136's fleet Home scan lost its execution context during the
   expected streamed `/app/home`→`/app/home/vehicles` redirect. Desktop and phone
   reproduce the failure; a diagnostic awaiting the exact final route passes
   both Axe scans. The repaired existing case passes desktop and phone, and all14
   provider route scans pass on phone. The same run also failed a desktop
   portrait replacement readback; its actual HTTP statuses were absent from
   sanitized output. Both strict404/200 requirements remain, now in a named
   readback step with fixed numeric diagnostics. Two local portrait attempts
   failed earlier during dev-page/image loading, so they do not explain the CI
   readback failure; outputs and cleanup evidence remain protected separately.
   Reporter32/32, workflow checks and the complete pinned-Node22 quality gate
   pass (1199 tests, zero failures, one existing skip;73s total). Ordered work:
   commit the coherent test-only PR and run exact-source CI;
   require its PR and merged-main gates, then refresh release prerequisites,
   publish once and verify production UI/API/private-file flows. Preserve the
   failed run. Application, native and immutable524 web inputs stay unchanged;
   prove equivalence rather than rebuild or relabel artifacts.
   Follow-up qualification is in `.local/release-20261025-settled/`; the original
   `.local/release-20261025-focus/` build, draft and failed-main receipts remain.
6. Pending/separate: installed broker/staff journeys, fleet saves and physical
   phone/background location are unqualified. Ask before a new owner-phone
   session. Play signing/upload remains unqualified; local build delivery is not
   blocked on Console work.

Verification and failure boundaries:

- Complete focus-source root gate:1197 pass/one existing intentional skip,
  source/spec/workflow and typecheck pass. All342 unchanged native tests, native types,
  lint,791-message translations and Android export pass. The native runtime,
  dependencies and assets are unchanged by the current web-only repair.
- Actual Chrome/Expo en/am/om reviews cover Featured, Preferred corridor and
  private entry/signup/return. Final Capacity/Location labels open and close at
  390/320. No fluent-speaker review or physical background test is claimed.
- CI40229087647 on1bea439 completed13 jobs successfully, with one underlying
  mobile role-route Axe analysis rejection; e2e/release-ready aggregates failed.
  CI did not expose a violation. Independent local review passed12/14, finding
  a genuine disabled-rail keyboard defect and a transient Verification RPC
  overlay before Axe. The latter RPC subsequently returned200; neither local
  observation is a proven explanation for CI's analysis rejection.
- Earlier failed runs remain evidence:40213634873 (stale labels/signup/locator/
  fixture assumptions),40217827876 (Support role expectation and unconfirmed
  API/cleanup failures),40221972550 (overstrict Featured cross-cycle assertion),
  and40224817354 (Tracking smoke timeout, local replay54s, CI cause unknown).
  Their accepted repairs preserve privacy, permissions, persistence, full-round
  rotation and original timeouts. No failed run is relabeled green.
- Native review preserved the original ARM64-only mislabel, an emulator graphics
  boot failure/System UI ANR, and bulk-typing harness failures. The current APK
  hash was verified after installation and cold-started in6015ms on owned API35
  x86-64. This does not establish real-device performance. The emulator is signed
  out and stopped; owned local Next3100 remains running for focused review.
- The20:29UTC hosted API security read succeeded after Keychain unlock: zero
  errors, exactly the same two accepted warnings, no retained credential or
  hosted write. Refresh its real freshness window when ready to publish.
- Old source0d9's unpublished draft6ade3c5478ea2d92b4f31c8e and protected
  `.local/release-20261025-parity/` receipts remain immutable historical evidence.
  The production site below is unchanged by this candidate.
- Play Internal/Alpha still serve code7. The English listing has unsubmitted draft
  changes; review declarations are not fully verified. No code10 upload. Current
  evidence and limits: `.local/play-code10-20261025/` and PR24.

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
