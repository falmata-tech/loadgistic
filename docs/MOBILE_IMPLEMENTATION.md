## October 9 Play policy release — web and Android testing ready (FEAT-PLY-001)

Owner requested all missing Play requirements be implemented in the app. Work
only in Loadgistic; preserve existing runtime, accounts, keys and production data.
New Console entry is owner-reported: developer 5256539403314542898 / app
4974969611761012361 under marketvision.tech@gmail.com. Read-only EAS metadata at
15:19 UTC confirms Submit binding absent, FCM intact; no upload or mutation.

1. [x] Read controlling security/mobile specs, inspect existing policy gaps and
   record FEAT-PLY-001 AC1–5 before implementation.
2. [x] Implement account/device disclosure consent before OS permission/task.
   Eight focused consent cases pass; Android OS/video acceptance is separate.
3. [x] Local verified-email deletion request, persisted receipt and administrator
   erasure pass with actual SMTP, Storage and Auth cleanup. Retry/shared-history/
   frozen ownership checks pass. This has not erased a production account.
4. [x] Local public report/block/unblock and audited moderation pass. Web/native
   terms are bound to the authenticated account; guest reviews require acceptance.
   Hidden/demo workspaces are excluded from actual public map/search, Featured
   eligibility and portrait reads, including after republishing.
5. [x] Implement the approved synthetic reviewer strategy through normal Auth.
   Populated local private-capacity/Tracking access and revocation pass. Ordinary
   passwords/staff cannot use this path. Three approved hosted identities and
   two private workspaces are provisioned and pass normal-auth scope checks.
6. [x] Privacy/contact and translations are implemented, tested and deployed.
   Owner approved marketvision.tech@gmail.com. All 496 explicit native messages
   and shared policy/conditional controls have four translations. Declaration
   inventory is a draft, not a completed Console attestation or Android video.
7. [x] Owner approved the actual terms/location/deletion/report screens on October
   9 and explicitly requested continuation of release checks.
   Local focused workflows and current phone/desktop captures exist. Servers stay
   at http://127.0.0.1:3100 and http://localhost:8084. Approval recorded; no hosted rollout approval is inferred from it.
8. [x] Local quality 488/488 + native 127/127, types/lint, Doctor 21/21,
   496/496 translations, actual web/Android builds and 52 SQL suites pass.
   Seventeen affected phone workflows pass across corrected focused runs,
   including normal OTP onboarding and one-truck/worldwide-location persistence.
   The unchanged 5,000-truck gate passes (search 4.75 s, route 2.74 s).
   Fresh hosted backup restores without networking; exact SQL 131–136 and
   catalog/guard/spatial checks pass. Version 1.0.3/code-4 APK/AAB inspection and exact owner rollout review are
   complete. Corrected local document/Tracking tests pass all four desktop/phone
   workflows using actual SMTP and Storage. They isolate client rate buckets,
   await real OTP responses and select the known prior-consented transporter.
   Exact-source CI 38012117505 at 068ac35 passes all eight latest jobs. Its
   controlled shard-4 retry resolves a registry-rate/port startup failure.
   Runtime/native/SQL and inspected binaries are unchanged.
9. [x] Publish approved web/backend and verify actual provider results. Ledger
   136 and deploy 6ac99d110f1f577818c9f7c9 pass 80 live checks and final security.
   Company-driver transporter-profile management is correctly denied (403).
   Initial review-account human consent stays false; test sessions were closed.
   Signed
   APK 9169da7e-dd2f-40b1-87b0-53fee20e3b56 and AAB
   edd8cf91-446d-477e-8bb4-e00946fa7a57 (1.0.3/code 4) are built and inspected.
   The owned emulator displays installed Privacy and live public Capacity after
   one fresh-hierarchy System UI recovery. Two actual 1080 × 2160 captures exist;
   the display override is restored. Full native and physical-device acceptance
   remain pending.
10. [ ] Verify owner Console/signing/app-scoped Submit connection. October 10:
   the supplied dedicated key is assigned to exact Loadgistic EAS Submit, with
   FCM/signing unchanged. Google authentication and API enablement are verified.
   The owner explicitly delegates Chrome setup; one invitation results in Active
   app-only Admin, with only Loadgistic and zero account-wide grants. Version 4
   lookup returns 404; signing/initialization remain pending. Internal draft
   upload and tester rollout
   remain distinct from public launch and policy approval.

Current Android test download:
https://expo.dev/accounts/falmatad/projects/loadgistic/builds/9169da7e-dd2f-40b1-87b0-53fee20e3b56
Version 1.0.3/code 4 preserves the existing signer and uses the verified live
backend. Private reusable reviewer credentials remain in protected
`.local/play-policy-reviewer-credentials.json`, never source, builds or logs.

## October 9 Google Play preparation — active

Owner has a ready developer account and requested help getting the app into Play
Console. Existing release and its remaining read-only postchecks stay in scope.
No console upload, public publication, signing change or policy waiver is claimed.

1. [x] Inspect current Expo/package/profiles, exact APK and official requirements.
   Existing signed APK is 1.0.2/code 3, API 36, com.loadgistic.app. Account type and
   existing Console app/version-code state are requested from the owner.
2. [x] Add a minimal store AAB profile preserving both APK profiles and API/key.
   Resolved EAS configuration confirms store/app-bundle, production API and
   remote existing credentials. Native types/lint and root quality473/473 pass.
3. [x] Signed AAB/native-library inspection passes. EAS build
   b111a2a2-a3b5-4cea-92a2-735d8962d944 finished from source ae8baba, existing
   frozen signing, 1.0.2/code 3. Package/API 36/min 24/signature/release flags,
   PAGE_ALIGNMENT_16K, all 25 ARM64 LOAD/RELRO cases and Hermes/prod-origin/no-secret
   payload pass. All actual native inputs match published d443093. The file is
   `.local/loadgistic-1.0.2-play-internal.aab`; hash/evidence in GOOGLE_PLAY_SETUP.md.
   Physical 16 KB-device acceptance remains separate.
4. [x] Prepare actual AAB, approved icon/screenshots, store-copy/declaration drafts
   and clear one-time owner Console/Expo steps. SDK validates internal/draft with
   changesNotSentForReview true; no local private-key path or auto-submit.
   Metadata confirms publishing binding absent and FCM intact. No Console upload.
5. [ ] Owner completes Console app/signing and connects dedicated app-scoped
   Play submission key in Expo; verify them, then remotely upload the exact
   reviewed bundle as an internal draft. The owner requested this remote route.
6. [ ] Complete actual device/video, Console declarations, owner review of store assets
   and any account-specific closed-test requirement. Deletion, location disclosure,
   moderation and reviewer workflows are now implemented and deployed above.
   Preserve existing data/authority; no Play test clock has begun.

## Android 1.0.2 internal test release — available October 9

Install the new standalone build on Android:
https://expo.dev/accounts/falmatad/projects/loadgistic/builds/d1f893c2-556f-4f8f-9920-800f674d2f7c

Open that link on the phone, download the APK and allow installation from that
browser if Android asks. Version is **1.0.2 / code 3**, package
`com.loadgistic.app`; install it over the existing Loadgistic app. The signing key
matches. Do not uninstall or clear data to bypass an installation error. Expo Go,
Metro and a computer are not required. Share this same link for internal testing;
Google Play submission remains separate.

The APK's recorded EAS Git ref is `36be7e6`; all 353 uploaded native input files
are byte-identical to final tested web/backend candidate `d443093`. Later fixes
were web/spec/browser-only. Do not reinterpret the EAS ref as a stale native build.
The compiled artifact is downloaded and its manifest/signature/hash verified.
It is installed on the owned Loadgistic emulator with data preserved; actual COLD
launch, production map and Truck filters dialog pass without a development launcher
or native fatal error. One Android System UI freeze cleared through its Wait action;
no system services or unrelated app were terminated.

Matching web deploy `6ac876e7cffbaa5a92772381` is published at loadgistic.com with
Supabase ledger 130 and production-only native push flag enabled. Exact CI
`37883805604` passes all eight jobs; root 473/473, native 118/118, actual Android
export/dependency boundary and 457/457 translation coverage pass. Backups and
approved migration/rehearsal digests are protected locally.

Final private live browser/advisor refresh now passes: 32 boundary/browser
checks, zero advisor errors and fresh ledger/RLS/ACL/guard/PostGIS checks. Public
web/mobile and compiled workflows also pass; the synthetic pilot session is closed. Physical phone background alerts, notification
tap, denied permission, logout/expiry and moving GPS remain unproven. Browser
Notifications do not provide closed-browser Web Push. Current Featured is empty because today's theme has exhausted its turns while
21 other pairs remain; the AUTO worker is healthy (WEB-MOB-013). The cold-start capture also shows adjacent Empty
and Partial clusters overlapping at one position; reproduce and resolve that
presentation case in a follow-up, without changing counts or search completeness.
This is an internal testing release, not Play publication or broad-launch acceptance.

Protected evidence: `.local/release-20261008-tester-apk-evidence.json`,
`.local/release-20261009-android-startup-evidence.json`,
`.local/release-20261009-native-filters-evidence.json` and final Android captures.
No customer records were created or changed by release verification.

The dated work below records preparation before this published artifact.

## October 8 release preparation checklist — historical

Latest owner instruction: “ok finish then,” following the confirmed FCM upload
and disclosure of remaining backend rollout/new APK/phone testing. Scope is
Loadgistic only: Netlify/loadgistic.com, Supabase tpwyyzoqijjmbvsmmvcm and
@falmatad/loadgistic/com.loadgistic.app. Preserve all unrelated existing edits;
Google Play, other projects, Auth/SMTP and unrelated credentials stay outside this
release. Prior consumed release authority is not reused.

1. [x] Read current authority/checklist, record dirty inventory and verify previews.
2. [x] Prepare exact candidate inventory, ordered migrations 115–128, Android
   version 1.0.1/code 2, current target/security read and rollback compatibility.
3. [x] Build a focused development preview with the native notifications module;
   exercise current Updates/permission/registration and capture web/Android states.
   This prepares review and does not constitute a signed/public release gate.
   Current correction: isolate dependency-free notification destinations from the
   server registration schema, prove strict malformed-payload denial and rerun
   the actual Android bundle/startup. The web shim did not exercise that import.
4. [x] Obtain current visual acceptance under AGENTS.md before extensive release
   gates. Preserve prior approvals without attributing them to new screens.
   Owner replied “continue” after the current review question, preview URLs,
   actual Android screenshot and scoped rollout plan. Treat that reply as approval
   to proceed with the presented UI and release checks; no security/CI/backup or
   immutable-artifact prerequisite is waived. Physical-phone acceptance remains
   distinct from the authorized emulator/internal-testing release.
5. [ ] Exact-source quality, Android export/audit, required CI/container/browser
   gates, protected fresh backup/isolated restore and migration rehearsal.
6. [ ] Review exact hosted SQL/flag/artifact plan; guarded matched rollout, signed
   internal EAS APK and monitored live checks. No broad settings sync or reset.
7. [ ] Verify actual push/tap/unread/logout/expiry and committed handover on Android;
   retain APK/invite link and separate physical-phone acceptance from emulator proof.

Preparation evidence: `.local/release-20261008-source-plan.json` declares 377
changed source paths and excludes owner `.claude` settings and generated upload
audit output. Firebase private-key headers and sensitive upload paths are absent;
the EAS archive contains 350 allowed files and one validated public Firebase config.
Fresh exact-project read verifies ledger 114, no critical advisors/unprotected
public tables and no ambiguous independent multi-truck records. Netlify site and
existing deployment `6ac64a35243e4f0c807487b0` are independently verified. The only
proposed environment field is absent → true `LOADGISTIC_NATIVE_PUSH_ENABLED` in
production/functions. No hosted field or schema has changed.

The fresh encrypted backup is 2,391,016 bytes with authenticated decryption and
SHA-256 `198ba9aeb96bea235e99681c7898e32e6c5d659345be2ab44fd33bd8b667d598`.
An isolated full restore (network none, no host volumes, cron execution disabled)
and exact-hash migrations 115–128 pass to ledger 128 with catalog, guard and
PostGIS service checks. The temporary container is removed. Review/receipts are
protected in `.local/release-20261008-{review-plan,backup,restore-evidence}.json`.
Reverting to pre-change application code is not presumed compatible with schema
128; check compatibility or use a forward fix, retaining schema and history.
Android rollback must preserve data using the existing signing key and a higher
version code; do not uninstall to bypass a signature or downgrade error.

Local CNG/498-task x86_64 development compilation succeeds (new module included).
Android correctly rejects installing the locally debug-signed APK over the signed
test app. No app data or signing material is deleted/replaced. The focused EAS
development build `e643b05d-c39d-47ec-9aba-22116909659d` uses the verified existing
Build Credentials 9sdLGJ6-UH to permit native review while preserving app data.
It is version 1.0.1/code 2, based on current dirty sources/3d80934; it is **not**
the final immutable standalone production APK. Actual native review, full gates,
CI/source commit and publication remain pending. The owner-review question links
the current web/Expo previews and concrete rollout plan. New launch SQL regressions
are explicitly added to CI; no checks are weakened or skipped.

The earlier EAS status check was not executed because automatic approval review
exhausted its usage limit. On the owner's continuation, normal approval review
became available and the exact build was verified FINISHED. The downloaded APK
has SHA-256 `0654a5e9e241afd128ec233022868e07384fa6d5b63633e72dea1c2b575cc663`
and the same existing signing certificate as the code-1 test APK. Installation
with `-r` succeeds on the verified Loadgistic_Pixel_API_35/emulator-5580; app data
is preserved. No alternate review path, signing replacement or uninstall was
used. The initial artifact request returned HTTP 403; a bounded retry using the
same artifact and a normal browser header downloaded it successfully. Protected
receipt: `.local/release-20261008-native-artifact.json`. This remains a development
client, not the final standalone release. Both previews respond HTTP 200 after
the web preview's first cold compilation. Native workflow proof, owner visual
acceptance, full release gates and publication remain pending.

Focused startup identified two distinct issues. Metro's IPv6-only localhost
binding could not serve the emulator's IPv4 address; the project-local preview
command now sets IPv4-first DNS ordering only for its own process. Both 127.0.0.1
and localhost previews respond. The actual Android graph then exposed a Zod
import through server registration policy that the web shim skipped. Phone
destination validation is now dependency-free with strict payload/event checks;
two phone contract tests, five retained native-link cases, ten server push cases,
root/mobile typechecks and focused native lint pass. The real Android development
bundle returns 200 (12,300,619 bytes), and the installed client reaches Expo's
first-launch Continue control. Dismiss that onboarding before claiming app UI or
device-delivery proof. NR-08/19; no dependency, server authority or destination
allowlist was broadened.

Release-check evidence now passes: root quality on Node 24 and production-matching
Node 22 (472/472), mobile types/lint (rerun after the process interruption), native
tests (118/118), strict fixed-copy audit (455/455), and actual production Android
Hermes export. Dependency disposition retains all 27 raw tooling findings and
proves the reviewed affected packages are absent from the compiled Android graph;
no advisory or test deadline is suppressed. Broader/store release is not claimed.

The first full quality attempt found an obsolete billing-upload source assertion.
FEAT-BIL-001 already retires those writes before file access. The assertion now
checks active Verification cleanup and protected historical Billing reads; the
existing runtime denial-before-file-access tests remain and pass. A later parser
deadline failure occurred while multiple CPU-heavy gates ran together. Its unchanged
five-second security regression passes alone and in the repeated complete quality
gate; no timeout was lengthened.

Actual signed Android intake, permission prompt and guest registration pass through
native controls and the local backend. Two real Expo/FCM tickets and provider
receipts succeed, while no Android OS banner/list is observed. Always-silent
presentation was corrected to allow OS alerts for background/inactive app states;
four focused destination/presentation cases pass. A bounded real-provider retry
is saved separately. System UI on the owned emulator repeatedly becomes unresponsive
(Android's own dialog), so OS presentation/tap and physical-phone delivery remain
unverified. Provider acceptance is not that proof. No hosted sender flag is enabled.

An interruption ended the existing preview/emulator/credential processes. Only the
verified Loadgistic previews (3100/8084) and named emulator (5580) were restarted,
preserving the signed app/data and leaving other projects alone. Native automation
refuses stale dumps; the test helper now moves Expo's debug-only overlay off the
menu and does not send Back when a hardware-keyboard emulator has no visible IME.
No abandoned intake was submitted. The one actual synthetic request is tracked
in a protected one-time fixture receipt for exact cleanup before shared-queue gates.
The restarted production credential read timed out at Keychain; current security
refresh remains pending the owner's already-presented Allow prompt request. No
credential fallback, hosted write or publication occurred.

## Active extension: Android Expo/FCM push — October 8

Owner supplied Firebase project `loadgistic-f082a`, number `59430603227`, name
Loadgistic. The public Android configuration is validated and the owner-delegated
FCM V1 upload is complete in EAS for package `com.loadgistic.app`. Prior FCM
association was empty; signing/Play/legacy credentials were unchanged. Private
key bytes remain outside the repository/app/logs. Protected upload receipt:
`.local/native-push-fcm-upload-review.md`.
Scope remains this repository and falmatad/loadgistic only. FEAT-NOT-001 / ADR-078.

1. [x] Inspect existing member/guest capabilities, receipts, handovers and Expo57
   APIs; retain staff web-only and the browser-notification worker.
2. [x] Specify private installations/bindings, committed event outbox, rechecked
   authority, leases, bounded retry/receipts, cancellation and no history replay.
3. [x] Implement additive local schema and focused actor/guest/logout/read/lease
   denial tests. Rehearse and back up before local apply; hosted is untouched.
4. [x] Connect SDK-compatible Android opt-in and safe cold-start routing to the
   existing Updates control. Keep web preview and older native builds working.
5. [x] Exercise the real local registration/outbox/backend with an explicitly
   fake Expo transport for ticket/receipt/failure checks; do not claim phone delivery.
6. [x] Verify public Android config and exact owner/account/project/package before
   the explicitly delegated FCM-only upload. Validate the supplied file in memory;
   never copy its private bytes to repository/app/logs or alter another credential.
7. [ ] Focused local UI review before full release gates; exact matched hosted
   rollout/new APK and real closed-phone/tap/permission acceptance remain pending.

Migration 128 is additive, backed up in mode-600 `.local/native-push-before-128.dump`,
rehearsed transactionally and applied only to Loadgistic local services. Full dump
restore is not claimed. Push tables use RLS and service-only commands. Source saves
and event enqueue are atomic; claim/recheck/finish use bounded leases and retries.
The scheduled Netlify dispatcher defaults off. Provider tickets/receipts neither
mark chat Seen nor prove an OS banner. No hosted SQL/flag or native artifact changed.

Focused unit/readiness cases and push SQL pass, including actual proof-backed
handover enqueue/ack suppression, retry exhaustion, stale leases, token rotation,
guest expiry and logout. `expo-notifications ~57.0.22` is SDK-compatible; public
Expo config resolves only the intended Loadgistic Android/Firebase/EAS target.
Private-key exclusions are explicit in `.easignore` because it replaces nested
Git ignore rules. A gitignore-semantics fixture verifies private Firebase JSON is
excluded and `google-services.json` remains included. Four catalogs cover all
fixed phone controls/events and optional push privacy copy; native audit has
455/455 explicit boundaries, while dynamic/raw copy and linguistic review remain
outside that count. New opt-in UI still needs compiled Android review/device tests.

`scripts/verify-native-push-local.mjs` passes actual Auth-session/guest registration,
staff/forged body/wrong-secret denial, dual scopes and member-only removal, real
web Support/Brokerage Claim/Send, durable enqueue and actual fixed-provider HTTP
adapter ticket/receipt parsing with **only Expo transport simulated**. It proves
no registration history replay, provider/fetch neutrality for Seen, already-read
and expired cancellation, truthful disabled-sender response and complete opt-out.
All exact synthetic records/sessions/installations are cleaned. Evidence:
`.local/native-push-roundtrip.log`. No Expo/FCM request or phone delivery occurred.

The first pass exposed a fixture cleanup FK ordering error: request child rows
must be deleted before their parent. Exact abandoned synthetic rows were verified
and cleaned, then the runner corrected. A retry overlapped source/translation HMR
and a separate global-backlog SQL fixture: hot reload interrupted a saved Support
reply and the backlog correctly included the extra waiting fixture. These were
test scheduling/fixture errors, not new source behavior. The final round trip ran
without source edits or another queue-mutating fixture and passes; no product
timeout, permission or count assertion was weakened. Run shared-queue tests
sequentially. The preview helper also corrected its selector to the existing
native Send code button; no login copy or email action was changed.

Focused receipts: `native-push-{policy,sql,handover-sql,chat-sql,web-types,
mobile-types,mobile-lint,translations,expo-check,source,specs}.log` in `.local`.
Actual public Privacy screenshots `native-push-privacy-{phone,desktop}.png` were
reviewed locally; the Expo-web account renders without runtime errors in
`native-push-expo-web.png` / `native-push-expo-web-check.log`. They do not show or
approve compiled Android push controls. Existing previews stay at 3100/8084;
new native review, full release gates, exact hosted rollout and a new APK remain.

## Active extension: map labels, named sharing contacts and Android push — October 8

Owner requests, Loadgistic only: remove load-preference text beneath map markers
while preserving truck-detail facts, filters and Empty/Partial colors; require a
private person/company label for sharing emails; investigate driver-map raster
cancellation; add closed-app Android delivery using Expo/FCM.

1. [x] Inspect actual marker, grant, Exclusive publication and shared map adapters.
2. [x] Update FEAT-SHR-001 / FEAT-CAP-001 / FEAT-NOT-001 before behavior changes.
3. [x] Implement additive contact labels, current-client validation and web/native
   named save/readback/editing. Preserve existing grants and visitor privacy.
4. [x] Rehearse local migration 127, focused SQL denial/legacy/projection tests
   and actual web/mobile contact and Exclusive saves.
5. [x] Verify the driver Home with stepped zoom, pan and workspace switching;
   distinguish expected cancellation from HTTP/decode failures.
6. [x] Prepare project-scoped Android push setup; owner supplies Firebase public
   config and uploads FCM key directly to falmatad/loadgistic EAS credentials.
   Never store the service-account private key in the app/repository/chat.
   Setup instructions are recorded below. Firebase files/credentials, delivery
   implementation, native dependency/build and phone tests are still pending;
   this checked preparation step does not claim functioning closed-app push.
7. [ ] Focused screenshots/local review before extensive release gates. New APK,
   closed-phone delivery and matched hosted rollout remain unverified until
   configuration, exact artifact approval and device evidence exist.

Local evidence: protected mode-600 `.local/contact-names-before-127.dump`;
transaction-only migration rehearsal and applied local ledger 127. No full dump
restore or hosted apply is claimed. `tests/sql/private-capacity-contact-names.sql`
passes creation/idempotency, same-ID name edit/history, owner oversight,
foreign/inactive/revoked denial, invalid names, legacy-name preservation,
Exclusive publication atomicity, management readback, visitor privacy and ACL/RLS.
Existing sharing modes and worldwide accepted-load matching SQL also pass.
Six contact/readiness unit cases, web/native types, mobile lint, source/spec and
whitespace checks pass. CI includes the new rollback SQL; no remote CI was run.

`scripts/verify-capacity-contact-names-local.mjs` proves actual web and Expo-web
add/name-edit/readback, an Amharic user-entered label, native Exclusive save and
web Exclusive edit with stable grant identity and bounded phone/desktop layouts.
All synthetic records/sessions are cleaned. Names remain private organizer notes;
email verification/current authority is unchanged. All four non-English catalogs
include the new fixed labels. Screens: `contact-names-{web-phone,web-desktop,mobile,
mobile-exclusive,web-exclusive}.png` in `.local`.

The first UI fixture omitted the profile page real onboarding creates, producing
503 on native Network; its cleanup also needed the private sharing FK removed
before deleting the synthetic truck. These were test-fixture defects. A mistaken
Save changes selector was corrected to the real Save control, with joined click/
response promises so a timeout cannot escape cleanup. Product timeouts/guards
were not weakened. The final actual add/edit/Exclusive run passes.

Driver-map check: `verify-browser-raster-local.mjs` passes on fresh Chrome/Expo
driver Home with 38 actual body cancellations, stepped HiDPI zoom, pan and area
return. It reproduces the abortTile symptom from an intentionally broken recorder
side-promise and confirms the existing XHR adapter isolates that observer; genuine
HTTP and PNG decode failures remain visible. No new blanket error suppression was
added. This proves the current driver-map path, not the identity of any extension
in the owner's Chrome. Owner reload/zoom confirmation remains useful. The runner's
local environment guard was made boolean-only so a wrong target cannot print env.
Evidence: `driver-map-raster-oct8.log`, `map-recorder-repaired.png`.

## Active extension: driver approval and browser alerts — October 8

### Owner setup for the selected Android push extension

1. Create a Firebase project for Loadgistic and add an Android app with package
   `com.loadgistic.app`. Firebase Auth/Firestore are not needed for this task.
2. Download the Android public configuration to
   `apps/mobile/google-services.json`. Share the Firebase project ID and this
   file's path, not a private service-account key.
3. Follow https://docs.expo.dev/push-notifications/fcm-credentials/ to generate an
   FCM service-account key and upload it directly in the Expo dashboard, account
   `falmatad`, project `loadgistic`, Android credentials for `com.loadgistic.app`,
   FCM V1. This credential is distinct from Google Play submission credentials.
   Keep the private key outside the repository and do not paste it in chat.
4. Agent verifies package/project identifiers, implements private installation
   registration and committed-event delivery/receipt retries with current access
   checks, then configures SDK-compatible expo-notifications. No app-poll-only
   solution is accepted as closed-app delivery. See FEAT-NOT-001 scenarios.
5. After focused checks/owner review and exact release gates, build a new APK,
   install it, opt in and test incoming Support/transport replies and real
   unloading approval with the app normally closed. Confirm tapping restores the
   correct authorized destination and leaves receipts truthful. Native modules,
   Firebase credentials, sender/backend delivery and this phone acceptance are
   presently pending; the existing APK has foreground alerts only.

Official references reviewed October 8:
https://docs.expo.dev/push-notifications/push-notifications-setup/ and
https://docs.expo.dev/push-notifications/sending-notifications/.

Feature/workflow change, FEAT-NOT-001 / FEAT-TRK-001 / ADR-077 / NR-19.
Scope is Loadgistic only. The October 7 foundation and owner review are preserved.

1. [x] Inspect actual completion: approval completes Tracking and releases location
   reporting; notify the saved result without another driver completion step.
2. [x] Extend the spec with scoped approval updates, exact alert acknowledgement,
   opt-in browser delivery, denied-permission and privacy cases.
3. [x] Rehearse migration 126 and scoped SQL denials before local apply. Protected
   `.local/driver-alert-before-126.dump` is mode 600. Local ledger is 126; no hosted
   write. Full dump restore is not claimed.
4. [x] Connect the existing web/mobile bell to driver updates and correct Tracking
   detail links. Browser permission is deliberate; denied/unsupported delivery
   preserves in-app alerts. Background phone push remains a separate setup.
5. [x] Verify actual owner email-code approval → driver web/system and Expo-web
   updates → successful plain-body acknowledgement → saved unread count zero.
   Support two-way/file/history and Brokerage assignment/reply/end/callback/Resolved
   flows pass; actual worker notification records and background-read neutrality
   pass. Browser visibility is explicitly injected for that boundary check;
   notification permission is automation-granted, not an owner-observed OS banner.
6. [ ] Owner visual approval before full release/CI/container/native-device gates,
   exact backed-up hosted rollout and new APK/AAB. Previews stay running on 3100
   and 8084. Closed-phone Expo/FCM is now selected; configuration remains pending.

Evidence: `.local/driver-approval-roundtrip.log`,
`staff-browser-alert-roundtrip.log`, `driver-browser-support-roundtrip.log`,
`driver-browser-brokerage-roundtrip.log`, `driver-alert-sql-regressions.log`,
`driver-browser-alert-policy.log` and focused type/lint/layout/spec/source logs.
Review: `driver-approval-{native-toast,native-updates,web-phone,web-desktop}.png`.
Local server session 14477 now uses `.local/next-notification-preview` on
http://127.0.0.1:3100; Expo web session 35572 stays at http://localhost:8084.

The first notification worker reused root scope and competed with the existing
`/sw.js` PWA worker. `register-sw.js` reloads an already controlled page on a
controller change, which interrupted ordinary POST navigation. The alert worker
now has its own unused `/_loadgistic-alerts/` scope and never replaces the PWA
worker or controls app pages; the existing PWA still controls pages and caches
only public static assets. Actual Claim/redirect passes, including a deliberate
seven-second send delay. The speculative queue-refresh change was removed; it
was not this failure's cause.

Background polling also needed a wakeup after restoring opt-in: an initially
hidden page could skip the first poll before permission preference loading
finished. Restoring opt-in and visibility changes now wake bounded delivery
polling. Chat receipts still require visible/focused content. The native alert
acknowledgement initially wrapped an already plain-body request port and failed
400; the real screen test caught it. It now posts exactly `id` and `approvedAt`,
receives 200 and clears only the saved alert. Record these boundaries in NR-19.

Test setup initially looked for New chat despite an existing active chat and for
an obsolete Tracking email subject. The corrected setup waits for actual Support
and alert data, uses the real Tracking creation API and current local email
subject, and keeps application timeouts unchanged. Current Chromium headless
mode supports real service-worker notification records; the default headless
shell does not. No fake successful backend response is used. Failure/delay/
visibility injection is identified, and exact fixture identities, sessions,
private proof objects and records are cleaned. No production settings changed.

## Active extension: chat alerts and honest read receipts — October 7

Owner asks for provider/customer and team alerts around existing Support and
transport chats: new unassigned work, assignment, actual agent join and unread
replies, plus important ended/resolved changes. Existing single-truck/chat visual
review remains pending (“I’ll check”), not approved. Scope is Loadgistic only.
Direct customer-to-transporter messaging and background phone push scope are
pending owner clarification; build the existing-chat foundation independently.

1. [x] Inspect Support/Brokerage web/mobile read, assignment, polling and history
   contracts. Support marks legacy timestamps while fetching; Brokerage has no
   receipt. Neither has a global alert workflow. Preserve current teams/access.
2. [x] Specify explicit visible-message acknowledgement, unread/assignment/join
   state, privacy, deduplication and delivery/permission boundaries (FEAT-NOT-001).
3. [x] Implement additive local schema and service-only receipts/alert projections;
   test forged/foreign/future/stale/read-race and unchanged history/file authority.
4. [x] Connect web/native visible chat reads, Seen labels, contextual unread alerts
   and opt-in delivery. No new top-level navigation or fake online status.
5. [x] Exercise actual local two-way Support/Brokerage, inactive/hidden/history,
   unread vs awaiting-reply, assignment/join and notification retry/dedupe flows.
6. [ ] Provide concrete local screens for explicit visual approval before full
   release gates. Background/closed-app delivery needs its own selected transport,
   exact project/credentials/build/device evidence; no foreground-poll push claim.

Local verification: schema 122–125 is applied; earlier applied files remain
immutable. Protected pre-122 and pre-125 dumps exist with mode 600. Each additive
command was rehearsed rollback-only; a complete dump restore is not claimed.
Schema 124 fails the new 45-waiting-chat regression; 125 fixes both unread and
own-assignment priority, full totals and actual message event timestamps. Resulting
RLS/browser ACL/definer catalog checks pass. Health requires the four chat markers
as well as the existing provider/single-truck contracts. No hosted write occurred;
last verified hosted ledger is 114 and published web/APK versions below are unchanged.

Eighteen focused policy/projection/health/overlay/language tests pass, plus the
existing eight native language cases. Web/native typechecks and focused native lint
pass. Signed-in web providers also receive Support alerts on public Marketplace/
About pages via the same validated snapshot; that alert displays no message body.
Opening its authorized link saves Seen. Simulated browser pagehide/pageshow events
prove actual reloading reauthorizes a revoked staff profile before showing cached
chat. The public-header account/access selection itself remains unchanged. Seven relevant rollback SQL suites pass: chat receipts, Support history,
polling/files, Brokerage assignment/conversation and ended-request follow-up.
Two independent service clients prove concurrent opposite-side/reordered read
commands retain maximum cursors and exact messages, with cascade cleanup.

Actual local web-staff/Expo-web recipient workflows pass: separate Support and
Brokerage permissions; intake/claim; assignment versus real join; messages both
ways; draft/reload; private file upload/preview/download; denied old-assignee access;
ended/callback/Resolved queues and retained history. Direct Support handoff in the
older regression uses an exact fixture operation, not an admin UI; WEB-MOB-014
remains open. The new receipt flow proves alerts away from chat, real Sent→Seen,
menu-covered denial and resumption on close, below-fold/history download neutrality,
scroll-to-read, forged/stale reads and staff mobile denial. Deliberate 503 receipt
transport injection leaves Sent; after removing the fault, the real command saves
Seen. That fault is test injection, not a mocked successful backend integration.
Five-language 320px web/native controls/dialogs fit, have reachable close controls,
and pass actual web audio user-gesture opt-in. Native OS sound/push was not tested.

The menu-close check caught a real stalled poller: pausing behind an overlay could
leave no next poll. Unblocking now refreshes receipt metadata before acknowledgement;
web focus restoration handles covered-dialog reads. Private receipt surfaces also
hide on pagehide and reload persisted page restores before exposing cached chat. Earlier browser failures came
from unfinished-save/global-sequence assumptions, catalog override labels and a
Hot Refresh during a menu check; corrected final receipts pass. Tests retain only
safe stage/status/count output and track exact start IDs before an ambiguous save.
No raw environment assertion, OTP, Cookie/Authorization or message body is logged.

Receipts: `.local/chat-read-final-unit.log`, `chat-alert-native-contracts.log`,
`chat-read-sql-regressions.log`, `chat-read-catalog.log`, `chat-read-concurrency.log`,
`chat-read-{support,brokerage,visible,public}-roundtrip.log`, `chat-alert-layouts.log` and
`chat-alert-{mobile-types,mobile-lint,web-types,specs,source,whitespace}.log`.
Review screens: `chat-roundtrip-native-{unread-alert,chat-updates}.png`,
`chat-roundtrip-web-chat-updates-{phone,desktop}.png`,
`chat-roundtrip-web-marketplace-member-alert.png`, and
`chat-alert-{native,web}-{en,am,om,so,ti}-320.png` in `.local`.
Web http://127.0.0.1:3100 (session 74456) and Expo web http://localhost:8084
(session 35572) remain running. Owner visual approval, full release gates, matched
hosted migration/artifacts, new APK/AAB and deployment remain pending. Direct
provider inquiries and closed-app delivery scope are WEB-MOB-016, not implemented
features. See FEAT-NOT-001 / ADR-077 / NR-19.

## Google Play readiness — owner update, October 7

Owner reports the Google Play Console developer account is now ready. Store setup
is no longer deferred for lack of registration. Verify the intended developer
account and `com.loadgistic.app`, then prepare an internal testing release after
the current web/native workflow and visual-review gates. Account readiness is
not evidence of a Play app, signing-key linkage, uploaded AAB, testers, Data Safety
answers, native permission verification or publication. Expo internal APK testing
remains available separately. Do not change another app or developer account.

## Active correction: one independent driver, one current truck — October 7

Owner unifies Owner-operator and Self-managed driver into one Independent driver
account. It operates one truck at a time, cannot add/manage drivers or a fleet,
and has no truck selector. Ownership/permission belongs on its truck.
Contracts: FEAT-APP-001, FEAT-FLT-001, FEAT-IAM-001, FEAT-VER-001 and FEAT-MOB-001.

1. [x] Inspect signup, roles, registration/lifecycle, projections, driver gates and
   document subjects. Local aggregate inventory: 86 independent providers, none
   with multiple active trucks or fleet links. No hosted writes/data printed.
2. [x] Specify canonical independent identity, legacy compatibility, truck use
   basis and atomic replacement/history/unfinished-Tracking behavior.
3. [x] Enforce one active truck with a unique index and serialized commands locally;
   deny stale/cross-owner additions, restorations and driver-management requests.
4. [x] Implement web/mobile signup and labels; use singular My truck, preserve map Home,
   add ownership/permission and Change truck without a fleet/driver selector.
   Focused browser verification and owner review remain separate below.
5. [x] Focused unit/SQL/concurrency/browser checks for fresh/legacy identities,
   replacement/rollback/history/Tracking, privacy and unchanged fleet functions.
6. [ ] Owner visual review before full release gates. Exact backed-up hosted
   migration and compatible web/APK rollout remain separate from local work.

Local evidence for this correction: 19 final focused unit cases and 14 native
language/navigation cases pass. Web/native typechecks, mobile lint, source/spec
checks and whitespace checks pass. The rollback-only independent-truck SQL proves
legacy identity/history, declarations and edits, direct uniqueness, replacement
rollback, unfinished Tracking, stale/foreign/admin/driver denials and private
subject retention. Real two-session additions and replacements pass. Existing
fleet lifecycle, truck-document alternatives and resulting RLS/ACL/definer catalog
checks pass. Lifecycle's two-truck fixture now uses a real fleet with assigned
drivers; it retains all old history/scope checks and explicitly rejects provider
cancellation of location Tracking before the audited staff release.

Actual local email-code signup through web and Expo, first OWNED truck, confirmed
PERMISSION replacement, read-only previous truck and My truck/Home navigation pass.
No subscriptions are created. Direct mobile extra-truck, driver creation and
old-truck restoration reject. The fresh replacement's visible location control
saves an obscured US GPS fix with a 20-km radius; it does not publish capacity.
This is browser sensor simulation, not native OS or physical-device acceptance.
The final exact disposable-fixture count is zero. Two existing web navigation
cases also pass for legacy independent, fleet owner and restricted company driver.

Receipts: `.local/single-truck-unit-final.log`, `single-truck-language-navigation.log`,
`single-truck-sql.log`, `single-truck-concurrency.log`,
`single-truck-lifecycle-sql.log`, `single-truck-documents-sql.log`,
`single-truck-catalog-security.log`, `single-truck-signup-backend.log`,
`single-truck-{web,mobile}-browser.log`, `single-truck-fleet-links-web.log`
and `single-truck-*-final.log`. Only terminal successful runs count. Earlier runs
caught an empty-string React Native child, stale configuration/trailer form values,
a five-second assertion during a streamed redirect, and local compiler timeouts.
Those are corrected/rechecked; do not describe the early runs as passing. One early
fixture cleanup failed on an exact test capacity reference; cleanup now deletes
only the disposable account's own rows in dependency order. That one verified
leftover was removed and final cleanup passes. No existing account was deleted.

The local compiler later spent 181 seconds compiling a health route. Only verified
Loadgistic PID 4933/port 3100 was restarted; no other app/tool/server was changed.
Backend is now session 74456 (`mobile-backend-webpack-recovered.log`), Expo remains
session 35572 at 8084. At that checkpoint local ledger was 121; hosted ledger was last verified at 114. The protected pre-121
local dump and rollback rehearsal exist; full restore of that exact dump and
production aggregate preflight are not claimed. Old app/new schema compatibility
and matched no-plan/single-truck rollback remain release requirements.
Driver-map basemap recovery is recorded as WEB-MOB-015; geometry/GPS success does
not certify tile delivery. Owner review of the current layouts is requested;
no full gates, commit, CI, hosted write, new APK/AAB or deployment occurred.

Owner addition during verification: the transport-chat launcher uses “Need help
with transport?” as the main text and “Let us handle it · Live chat” smaller below.
Apply the same hierarchy on web/native, retain the real Brokerage intake and
chat destination, use natural local-language service wording in both launcher and chat, and capture desktop/phone
states. FEAT-TRQ-001 / FEAT-LUX-001 govern this copy-only presentation change.

The chat uses the same question/subline and one explanation about the load, route
and arranging a truck. Waiting states say transport team rather than internal
Brokerage terminology. English/Amharic/Afaan Oromo/Somali/Tigrinya use shared
catalogs, including assigned-name interpolation; route/message/profile content is
unchanged. No translation provider, fake presence or response-time promise added.
Three web narrow-phone cases and two actual public submission/recovery cases pass.
The actual Expo launcher/navigation/intake, four fields, reachable Start chat,
no horizontal overflow and language selection semantics pass in all five languages
at 320px; desktop and stable translated screenshots are captured. The native
language menu's missing web ARIA checked state was reproduced and repaired without
changing its native selection/storage behavior. A wrong initial link/button test
selector and premature modal-transition screenshots were corrected before final
verification. These are UI/wording tests, not native device certification or
independent native-speaker proofreading. Receipts: `transport-copy-web.log`,
`transport-copy-request-flow.log`, `transport-copy-native.log`, and
`transport-copy-{native-entry,native-chat}-<locale>.png` / desktop captures.

Keep Auth IDs, provider/workspace links and historical signup, shipment, document
and capacity records. A migration must stop on existing multi-active-truck data
for an exact reviewed correction; never choose or delete a customer's truck.
No other Expo project, SDK defaults or shared OS tooling belongs to this task.

## Active correction: no plans, subscriptions or platform payments — October 7

Owner confirms the only current revenue service is arranging transport. This
supersedes trial/payment activation in FEAT-BIL-001 on both web and mobile. Keep
identity, workspace ownership, driver permissions and staff isolation; retain
historical billing/file/audit records without using them to charge or unlock access.

1. [x] Inventory billing navigation, account cards, expiry gates, admin controls,
   signup trial provisioning, payment APIs and SQL authorization helpers.
2. [x] Update FEAT-BIL-001 and linked acceptance contracts for provider access
   without a subscription, retired charge writes and protected retained history.
3. [x] Remove plan/payment UI from provider, mobile and admin surfaces; redirect
   old billing destinations and reject old-client charge/activation commands.
4. [x] Implement additive database retirement locally: no new trials/subscriptions,
   no paid-mode activation or proof/review writes; preserve all historical rows.
5. [x] Prove active providers without plans can use authorized operations, while
   inactive/cross-workspace/staff/mobile denials still hold. Check new signup and
   existing empty/expired-plan accounts; capture desktop/phone Account and Home.
6. [ ] Owner visual review of the corrected previews before release gates. No
   hosted migration, deployment or APK build is implied by local implementation.

Local evidence: 32 focused access/auth/signup/retirement/health tests and six
native navigation tests pass; web/native types, mobile lint and source/spec checks
pass. Migration 120 rehearsal/rollback and two rollback SQL suites pass, as does
the resulting RLS/ACL/definer catalog gate. Actual local email-code signup and
rejection/duplicate cases pass with no trial row. Three fresh provider models
complete actual mobile onboarding without subscriptions, read their permitted
operating APIs, and render fully loaded web/Expo Home and Account. Stale payment
uploads return 410 before parsing. Admin overview, client list/detail, Reviews
and legacy menu contain no plan status or payment controls; stale paid-activation
and subscription commands return 410. Existing setup verifiers now reject billing
writes and retain their historical private-read/permission checks rather than
enabling paid mode during setup. The CI SQL list includes the new retirement check;
no remote workflow run is claimed.

Receipts: `.local/no-plans-focused-final.log`, `no-plans-navigation-tests.log`,
`no-plans-signup-live.log`, `no-plans-browser-final.log` (all three provider models
and admin checks pass in one combined current-source run),
`no-plans-admin-browser-final.log`, `no-plans-sql-*.log`,
`no-plans-catalog-security.log` and `no-plans-*-verifier.log`. An earlier combined
browser run hit a cold admin-request timeout after provider cases; the separate
admin rerun and final combined run pass. A simultaneous future-roster verifier changed the old global retry
snapshot in the platform SQL test; its assertion now checks the generator's exact
week, and a sequential rerun passes without changing the generator. Do not describe
either failed run as a passing aggregate gate.

The protected pre-120 local dump exists, but full restore of that exact dump is
not claimed. Local ledger is 120; hosted ledger remains 114. New health checks fail
closed without the 120 compatibility marker. Before a hosted rollout, rehearse
the exact reviewed migration against a restored backup and retain a compatible
no-plan application rollback. An old plan-gated app would deny newly created
accounts without subscriptions. Never repair that mismatch by inventing trial
rows or reactivating paid mode. Native OS/background checks and the other launch
dependencies below remain separate and incomplete.

The chat/staff checks below remain active and must not be silently discarded.

## Active verification: Support and Brokerage round trips — October 7

Owner requests live workflow tests for both web and mobile. Staff work remains
on web. Controlling contracts: FEAT-SUP-001, FEAT-TRQ-001, FEAT-ADM-001 and
FEAT-MOB-001. Use isolated local Auth/PostgreSQL/Storage and disposable identities;
do not send external mail, change hosted settings or alter existing staff grants.

1. [x] Read current intake, assignment, authorization, attachment and history contracts.
2. [x] Run focused permission/state/history regressions and current two-party web
   browser tests at desktop and phone widths.
3. [x] Exercise Expo mobile customer screens against distinct Support-only and
   Brokerage-only staff browser sessions: intake, claim/assignment, replies both
   ways without manual refresh, reload/reconnect, attachments where supported.
4. [x] Verify ending, follow-up, resolution, retained history and a separate new
   chat; deny unrelated members/staff and stale assignees after handoff/revocation.
5. [x] Record actual evidence and any failures; fix reproduced defects with focused
   regression checks. Preserve unresolved device and production verification limits.

This is a focused running-app audit, not a release gate or a production test.
Both local previews remain available; owner map verification is still pending.

Owner addition: make `falmata.dawano@gmail.com` the main web administrator and
verify that this account can create staff with independent Support-agent and
Transport-agent (Brokerage) responsibilities. Preserve the existing transporter
account. Local setup/testing is authorized; whether this also targets production
is also authorized. Read-only inspection found the live account already confirmed,
active and ADMIN, with no provider/fleet/staff association to delete. No hosted
identity mutation was needed. Any future hosted identity change retains exact-target,
verified-email, backup/recovery and least-privilege checks before application.

Evidence: 29 focused chat tests, eight mobile identity/security tests, seven
rollback SQL checks, 16 initial passing web workflows plus four repaired
attachment/polling cases (20 total desktop/phone), and actual Expo customer/web
staff round trips for both queues. Receipts: `.local/chat-workflows-unit.log`,
`chat-staff-mobile-denials-unit.log`, `chat-sql-*.log`, `chat-web-corrections.log`,
`chat-roundtrips-mobile-{support,brokerage}.log`. Disposable identities, chats,
private objects and sessions were cleaned; the requested local administrator remains.
One owner-admin browser scenario verifies real email-code login, two staff creation
flows with only the selected responsibility, all three mobile OTP/refresh/read
denials, and desktop/phone admin controls (`chat-staff-admin-browser.log`).
An additional actual Brokerage admin-assignment workflow passes, including stale
version denial, reassignment, grant/revoke and requeue (`chat-brokerage-admin-assignment.log`).

Admin OTP unnecessarily sent administrators through provider Home; the shared
destination now sends ADMIN directly to `/admin`. Focused auth tests and the actual
owner login pass locally. This source correction is not deployed. Test failures
also caught old fake-email/password fixtures, a concurrent automatic-assignment
race, retained hidden Expo screens and incorrect ended-chat labels in the new
harness. Corrected fixtures/assertions preserve real byte/state/authorization checks.

Support handoff permission checks use an exact disposable fixture reassignment;
there is no current admin UI for direct handoff of an active member Support chat.
Record that product gap separately; do not describe it as UI-tested reassignment.
Expo browser checks prove the shared screens and real local Auth/DB/Storage/API,
not Android background delivery, native file-picker permissions or production chats.

## Active defect: browser map abort overlay and stopped previews — October 7

Verified browser transport repair: the failing owner's localhost tab has an
injected fetch wrapper; native Chrome fetch does not reproduce the exception.
A controlled recorder side-promise reproduces the same uncaught abortTile stack
despite the first raster catch patch. Browser raster now uses a typed scoped
MapLibre addProtocol/XHR port for canonical public OSM tiles. Abort settles once,
listeners detach, browser caching/expiry remain and HTTP/network/decode/timeout
failures remain real errors. Read only CORS-exposed headers; requesting a hidden
ETag with getResponseHeader itself emitted console errors and was corrected.

1. [x] Reproduce the side-promise failure before the transport change.
2. [x] Implement the fixed-host, bounded raster request port without global fetch,
   promise, console or browser-setting changes. Remove every temporary probe.
3. [x] Verify desktop HiDPI driver Home paused-click zoom and area return: 63 real
   body cancellations, zero tile fetch-observer calls and zero errors/overlay.
   Genuine HTTP and invalid PNG failures retain visible driver-map feedback.
4. [x] Final focused types/lint/spec checks and keep both previews running.

Evidence: `verify-browser-raster-local.mjs`,
`.local/browser-raster-recorder-check.log`, `.local/map-recorder-{before,repaired}.png`.
Older verification script names delegate to this transport-aware check; do not run
the superseded fetch-only fixture against XHR. Raster port and installed-loader
unit tests verify URL denials, pre/mid-body abort, expiry, failures and drift bounds:
11 pass. Native typecheck/lint and 34-spec link checks pass. Actual existing owner
and driver Home checks on web and native browser also pass with real OSM tiles
and console-error collection (`.local/workspace-homes-raster-port.log`, four cases).
The native AppleScript reload refused unrelated active tabs and found no remaining
exact localhost8084/account tab; no other tab was changed. Reopen that local URL
to test the final code. No new APK, production changes or visual design change.

The original wrapper's provider is not established: a Loom console-recording
script is present, but its public source did not match the fetch wrapper. Do not
claim Loom caused the problem. All probes were temporary and have been removed.
The initial stale-tab hypothesis was insufficient, as the screenshot proved.

Screenshot follow-up: owner still sees 1/172 errors on Chrome /account after the
reload attempt. Do not call this a stale-tab fix. Test driver Home itself, desktop
window and HiDPI raster concurrency, not only the phone marketplace fixture.
Capture real unhandled events even if the overlay blocks the next test click.
Demonstrate the remaining failure before another code change.

Recurrence follow-up: owner supplied the same abortTile/cleanup stack after the
first repair. Current log confirms errors from the patched bundle (+43 offset),
so do not assume stale cache. Earlier loader tests passed but did not prove the
complete real fetch/body/queue cancellation path.

1. [x] Confirm current server ownership, installed patch and recurring stack.
2. [x] Exercise actual native-browser fetch/response-body cancellation and record
   unhandled rejection plus console events; distinguish synthetic thrown errors
   from tile-controller aborts. Require counters for the intended cancellation.
3. [ ] Confirm the owner's Chrome result after the full preview reload. Fresh
   Chrome does not reproduce the reported exception; no further speculative
   library patch was applied. A retained pre-update map is a hypothesis, not a
   proven cause. Only the verified Loadgistic8084 client was sent a full reload.
4. [x] Verify the requested paused double-click sequence and preserved error
   feedback; correct the earlier completion claim and retain bounded evidence.

Recurrence evidence: owner's browser is Chrome and the interaction is a couple
of zoom clicks, pause, then more clicks. Native unmodified fetch against actual
OSM tiles under a brief slow connection produced 49 cancelled requests and no
console/page/unhandled events (`.local/map-abort-real-click-trace.log`). The new
permanent `verify-mobile-map-stream-local.mjs` serves a loopback-only incomplete
PNG body, uses native browser Request/Response and requires new controller/body
cancellations from the intended paused double-click sequence: 31 body-stream
cancellations, no errors or overlay, driver/marketplace return passes. The fixture
is explicitly synthetic transport, not an availability check for OSM. Its log is
`.local/mobile-map-stream-check.log`; capture `.local/mobile-map-stream-repaired.png`.
The earlier synthetic test counted all cancellations, so a preceding cancellation
could satisfy its wait before the intended injected one. It now requires a new
forced-cancellation count and separately collects unhandled rejection; all three
feedback scenarios still pass (`.local/mobile-map-abort-strengthened.log`). Existing
types/lint evidence remains applicable: this continuation changes tests/docs only.
WebKit's already-installed runner stalled; no WebKit verification is claimed and
no shared browser/tool installation or cache was changed. Owner confirmation is
pending; do not repeat the initial blanket claim that the reported case is resolved.

Owner reports “signal is aborted without reason” on localhost:8084, plus an svg
stack label. Both previous Loadgistic servers were no longer listening; restarted
only Loadgistic Next3100 and Expo8084, with actual HTTP200 checks. Current sessions
44055 (backend) and 35572 (Expo, replaced 81383 to load the repaired dependency).
Do not infer the reason the previous processes stopped.

1. [x] Inspect installed MapLibre6.13.0 raster/tile lifecycle and existing logs.
   Recorded zoom/cleanup stack points to raster cancellation. Raster's catch
   tests only tile.aborted, unlike vector/GeoJSON AbortError handling; cancellation
   with that flag false is independently reproduced. The exact original request
   interleaving was not instrumented before the previous server stopped.
   This is distinct from API timeout/revocation or an SVG asset defect.
2. [x] Reproduce the actual raster-source cancellation with tile.aborted=false,
   plus real failures and successful raster decoding; reproduce browser console
   and visible preview behavior during delayed tiles/zoom/switch/return.
3. [x] Apply the smallest guarded version/hash-bound browser dependency repair;
   scope it to @loadgistic/mobile, fail on source drift, preserve real errors and
   reinstallation repeatability. No global console suppression, dependency downgrade,
   permission/settings change, tile proxy/prefetch or unrelated Expo repair.
4. [x] Verify targeted types/lint/tests and real localhost map; keep previews up.
   Record session ownership and truthful tests. Existing launch work below remains
   in progress; this defect does not renew production authority or visual approval.

First-repair evidence (the recurrence above remains open): the installed-source
regression failed with AbortError before repair;
the controlled real-browser raster cancellation showed the map failure banner.
After repair, six loader/install-isolation tests pass, including fresh-install,
idempotency, version/hash/symlink denials and preserved HTTP/network/decode errors.
`verify-mobile-map-abort-local.mjs` passes three browser checks: cancellation plus
zoom/resize/area return without console errors or overlay; HTTP failure feedback;
invalid-image feedback. Raster transport is synthetic (valid PNGs decoded by the
real browser), not a claim about community tile availability. Logs:
`.local/mobile-map-abort-{before,after}.log`; capture:
`.local/mobile-map-abort-repaired.png`. Native types/lint pass. Real-account Home
checks now also inspect console errors; previously checking only pageerror missed
the Expo console overlay. No global error filtering or map UI redesign.
Actual existing local owner and driver Home checks also pass on native browser
and web, with real map transport and console-error collection. No email/business
writes. `.local/workspace-homes-map-repaired.log` records four passes; the driver
Home canvas remains the same after Marketplace/workspace return.

## Active change: capacity clusters and load preferences — October 7

Owner reported mixed Empty/Partial mobile clusters and confusing physical space
versus accepted-load choices; the load-preference correction explicitly covers
both web and native, including persistence and matching authority (FEAT-CAP-001,
FEAT-MOB-001). Existing `74df968` APK is the released baseline, not this new change.

1. [x] Inspect native clustering, web/native editors, public/private projections,
   shared save command and full/shared search rules. Native drops accepted-load
   flags; native clustering uses one mixed source. Empty preference is hidden in
   the Home advanced section. Physical Empty/Partial and accepted FTL/PTL/BOTH
   are separate domain facts; no new percentages or demand/booking feature.
2. [ ] Specify and implement shared honest preference labels/projection, explicit
   Empty choice in both main capacity editors and clear customer filter wording.
3. [ ] Partition native cluster sources by status, use green/yellow plus text,
   preserve source-specific expansion, individually reachable markers and focus.
   Owner also requests unrestricted geographic map exploration on web/native;
   remove regional pan limits while preserving filters, fit/return and safe zoom.
4. [ ] Test persisted FTL/PTL/BOTH matrix, Partial full-load exclusion, private
   scope/owner denial, filter results and actual desktop/phone/native-preview UI.
   Subsequent owner request includes worldwide driver GPS (CEO tests from U.S.).
   Prepare migration 115 for geographic bounds and truthful nearest-place fallback;
   test local save/readback, assignment denials, privacy offsets and zero/dateline
   values across capture, capacity, duty and shipment Tracking. No hosted apply.
   Latest owner request adds four actual sharing modes on web/native: Public,
   Private network, Public + private network, Exclusive to one email. Both must
   appear in invited contacts' private feed; Exclusive denies public/additional
   recipients. Prepare a separate additive migration 116 and update publish,
   contact management and all projections atomically. Viewers see the mode, not
   recipient identities. Related contract FEAT-SHR-001; existing grants/history
   and old-client access must remain compatible until explicit mode changes.
5. [ ] Keep local web/Expo previews running; provide captures for owner visual
   approval before extensive release gates or a new APK/web rollout.

Additional owner requirements, still part of this task (do not replace earlier work):

6. [ ] Replace web/native date pickers with a shared date-only contract: Monday-
   Sunday week view by default, next/previous week, optional month view, localized
   weekday/date labels and accurate secondary Ethiopian day where supported.
   Research ICU/Intl or a maintained open-source conversion; verify known New Year,
   leap-day and timezone boundaries. Keep stored Gregorian ISO dates unchanged.
7. [ ] Add shipment handover approval: Loading and Unloading photo proof required;
   Driver cannot self-complete; verified main recipient (Shipment owner) approves
   unloading in their existing email session, without another code. Tracking guest
   session absolute maximum becomes five minutes; private capacity stays thirty.
8. [ ] Freeze agreed location Tracking mode, limit new Tracking fixes to <=20 km,
   implement automatic native background reporting with permission/device lifecycle
   controls and honest web foreground-only behavior. Do not claim OS force-stop,
   revoked permission or unavailable GPS can be overridden. Preserve exact-location
   privacy, assignment/revocation and locked-device credential safety.
9. [ ] Implement an authenticated Driver appeal and audited staff investigation/
   release in existing web management, with retained proof/history. Overdue threshold
   proposed by owner is ETA +2 days. A clarification is pending on driver-only versus
   provider-wide new-work restriction versus staff review first. Existing tracking
   and appeals must remain usable; do not invent a full-login suspension policy.
10. [ ] Test calendar, approval/roles/proofs/replay/expiry, background location,
    appeal and overdue boundaries with actual adapters and local database. Review
    all web/native changes together; only then full release gates and scoped rollout.

11. [ ] Owner's launch matching audit: test public/private search and every combined
    filter against current routes, all regular-service segments, complete service
    areas, load preference, document evidence, location uncertainty, profile facts,
    freshness and configuration. Test direction, crossing/revisited route sections,
    malformed/degenerate geometry, same-route endpoint pairing and map/profile
    consistency. Reuse existing open-source PostGIS and pg_trgm; do not add managed
    AI/search providers or silently relax hard filters to improve result counts.

12. [ ] Owner's marketplace/workspace navigation correction (October 7): research
    primary mobile navigation; make both areas visible and switchable in one tap
    on native and web. Keep native nested-stack state; retain safe web return URLs
    and public map camera without storing feed payloads or private recipient data.
    Remove repeated primary links and inline language lists from the native menu.
    Keep fleet/driver documents with the entity, public profile/company documents
    under Account, usual routes with capacity/fleet, and staff controls web-only.
    Later owner clarification: driver Home is the working map; fleet-owner Home
    is the list of managed trucks and drivers. Account is settings, not Home.
    The named local account falmatad97@gmail.com is TRANSPORTER with an approved
    TRANSPORT_COMPANY application; verify the environment before claiming a live
    identity issue. Do not change its role or grant self-driver GPS authority.
    Reuse the existing fleet workspace on owner Home, remove its redundant primary
    destination while preserving /fleet deep links and existing authorization.
    Test guest/provider/company-driver/limited roles, deep links, switch-return,
    narrow headers and open/collapsed drafts. Owner reviews actual previews before
    extensive gates; new navigation has no production approval yet.

These additions need FEAT-TRK-001 / FEAT-SHR-001 / FEAT-MOB-001 updates and bounded
additive migrations after 116. New ETA requirements must not fabricate dates or
retroactively punish legacy shipments with no ETA. Native location can use scoped
device authority for locked-phone reporting; do not loosen all account credentials
or grant a background worker fleet/account permissions to make it run.

Owner review clarification resolved by actual local identities: the owner was
viewing localhost:8084 as falmatad97@gmail.com, an active TRANSPORTER with approved
TRANSPORT_COMPANY application and workspace access. It correctly does not receive
driver Home. Existing falmatad97+lg-driver@gmail.com is an active DRIVER, projected
as OWNER_OPERATOR, with one owned truck and workspace access. Actual local web and
native-browser sessions now verify owner Home's managed list and driver Home's map,
ready signal controls and preserved map canvas across area switching. No account
role, grant or hosted setting was changed; no sign-in email was sent by that check.
The owner was given the driver alias and local Mailpit inbox for hands-on review.
New role labels in the native header make the distinction visible.

Current focused evidence (October 7, local implementation only):

- Navigation: 16 focused navigation/document/language tests, 15 focused web fleet/runtime
  tests and 3 safe-return/camera tests pass.
  Root/native types and native lint pass. Four desktop/phone Account E2Es pass,
  including actual same-page saves, company-driver document scope and draft
  retention. `scripts/verify-mobile-navigation-local.mjs` passes real local-session
  switch/return, native drafts, personal document reachability, compact menu,
  language panel, web URL/camera retention, Clear all and 320px/desktop captures.
  Owner requested adjustment, then clarified that driver workspace Home must be
  map-based. Account screenshots were settings, not Home. Actual owner and driver
  Home checks pass separately; hands-on review remains open, with no new explicit
  visual approval, commit or deployment yet.
- Native Home rerun with the final privacy helper passes actual capacity/sharing/
  status saves, obscured movement readback, connected usual-route editor and
  bounded phone/landscape layout. The earlier cold Auth timeout and fixture URL
  interception problem are resolved, without increasing application timeouts.
  Synthetic coincident Empty/Partial cluster display checks also pass.
- Account security: phone email-change/deactivation/history-retention E2E passes.
  The security accordion is opened explicitly and final navigation awaited; cold
  development route timing is not permission to change application timeouts.
- Shared calendar: four date-only/ICU tests pass, including leap/New Year,
  timezone and pre-100-year arithmetic. Native week/month/landscape selection
  passes; actual web week/month selection, ISO value and focus-return checks pass. Six worldwide
  viewport tests pass, including zero coordinates and dateline/world copies.
- Local migrations 115–119 are applied to `supabase_db_loadgistic-local` only.
  Backup before 119 is readable and owner-only (0600). Six rollback-only actual
  database regressions pass with proposed 119, including 292 combined map/profile/
  public/private/document/expiry checks and prior search, world location, sharing,
  owner handover and device authority denials. Hosted ledger remains 114.
- 426/426 explicit fixed native messages have all four translations. Dynamic
  server/errors/history text and fluency still need manual review; this is not
  native-speaker certification. Whole-cell privacy distance/stability tests pass.

Owner review, wider workflow checks, full gates, new native binary/OS permission
and locked-device testing, overdue restriction scope and scoped hosted rollout
remain incomplete. The existing APK does not contain any October 7 launch changes.

## Current released baseline: standalone Android internal testing — October 7

The web and mobile internal release is verified. This section supersedes the dated
"not deployed", "Metro required" and build-pending notes below; historical device
checklists are evidence limits, not claims that every physical workflow passed.
Admin, staff and brokerage management remain web-only.

- [x] Owner accepted the simplified driver Home and requested web/Expo publication.
- [x] Mobile 92 tests, lint/typecheck, Doctor 21/21 and Android export pass.
- [x] Final web commit `415cb7d`, CI `37626365763`, protected backup/isolated restore,
  security, immutable build and live desktop/phone/private-file checks pass.
- [x] Exact Expo account/project, upload exclusions and signed standalone APK verified.
- [x] Signed APK installed and cold-started on Loadgistic_Pixel_API_35; native map and
  public signals rendered without a Metro URL. Production mobile API checks pass.
- [ ] Physical-phone GPS/movement, OS interruption/battery and full device workflow
  acceptance. Emulator simulation is not physical travel or background tracking.
- [ ] Verify the owner-reported ready Google Play account; configure the correct
      Loadgistic app/internal testing track, then complete store review separately.

### Install and invite Android testers

Share this [Expo installation page](https://expo.dev/accounts/falmatad/projects/loadgistic/builds/544cc916-c058-4bca-85a0-72a4d4b4e981)
or the [direct signed APK](https://expo.dev/artifacts/eas/lp_Znck4miw4QQecunzfdQibDC6zOk7dsYTTEBC2cZs.apk).
Open the link on Android, download the APK, and allow installation from the browser
when Android asks. Open Loadgistic and use the normal email-code login. Expo Go and
a local development server are unnecessary. Turn the browser's installation
permission off afterward. This build uses real https://loadgistic.com data:
use owner-designated demo accounts and synthetic requests, not customer credentials
or documents. Staff tools remain at the web dashboard.

Test public map/search/filter/select/close, Marketplace/My workspace switching,
email login, assigned-truck space/routes/location, fleet permissions, Tracking
recipient access/status/private photo, private capacity and chat history/end.
Report screen, action, expected/actual result and phone/Android version; omit OTPs,
credentials and private files. Invite by sharing the link; no unsolicited invitations
were sent. Google Play distribution is a later, separately authorized task.

Local installer: `.local/loadgistic-1.0.0-preview.apk` (152,343,233 bytes).
SHA-256: `03b7206eccec3696e4fbd8814bbcb1c1a5ecccee585fa1ae8444e761cdabefbd`.
EAS build `544cc916-c058-4bca-85a0-72a4d4b4e981`, preview/INTERNAL,
@falmatad/loadgistic, project `a2d7e0a9-2fe4-4188-804e-40d8c3486ac7`, package
`com.loadgistic.app`, version 1.0.0/code 1. EAS records source `74df968`; all 290
upload files are byte-identical to final deployed web commit `415cb7d`.
Evidence: `.local/release-mobile-eas-final-upload-evidence.json`,
`.local/release-mobile-apk-evidence.json`, `.local/mobile-standalone-cold-start.png`.
The saved EAS artifact expiry is October 21; retain the protected local APK and
refresh the distribution link before a later test cohort.

Native local GPS/save/readback and actual Android DocumentPicker → Tracking proof
upload → private proof reopen passed, with `.local/mobile-native-proof-evidence.json`
and the inspected `.local/mobile-native-proof-opened.png`. Final live API checks
verify twelve authenticated read endpoints, public content and guest denials; they
do not prove every production mutation from a physical phone. The test session
was closed. Today Featured is unpublished/empty (WEB-MOB-013), not populated proof.

After publication, one controlled restart of this same preserved AVD booted and
opened the installed app, but UIAutomator timed out and subsequent foreground
validation failed. No stale tap or screenshot was accepted. This repeats the
recorded emulator infrastructure instability; retain the earlier signed cold-start
evidence and leave the full final native interaction matrix unverified.

Capacity location refresh is foreground-only, at ten-minute intervals on Home or
Capacity; edit/blur/lock/Off Duty/revocation stop it. No background location service
is claimed. The APK excludes background-location/microphone/media-library access;
Expo dependencies add CAMERA/SYSTEM_ALERT_WINDOW and legacy storage permissions
(storage max SDK 32). Review unused permissions before Play publication. Mobile's
27 reviewed build-tool advisories remain recorded; the runtime assessment passes.
Web audit has zero findings. Upload scanning, SMTP delivery and community tiles
retain their existing pilot limits. Do not label this unrestricted launch readiness.

## Previous step: map-dominant driver Home — October 6

Implemented the owner's map-first Home with a compact assigned-truck/status row.
Three small controls float vertically on the right: **Available space** manages
current space, route/area and visibility; **Usual routes** manages provider regular
service; **Truck location** manages approximate position/radius. A separate GPS
refresh stays at the upper right. Load/pickup/drop-off preferences are optional
within the capacity editor. Redundant editor headings/map previews were removed
instead of copying the web's six configuration categories as six navigation tasks.
First setup and restricted company-driver location/duty paths remain intact.

Native testing caught a concrete capture defect: manual requests repeated the
foreground permission/precision prompt despite an existing grant. Android's
background/active transition invalidated the capture and incorrectly reported
"Location sharing paused". Reuse an existing grant; first consent is completed
before starting the fresh GPS cancellation window, and leaving/locking during
capture still discards the result. A separate SDK-57 web adapter default cached
positions indefinitely; browser capture now explicitly requests maximumAge=0.
Both repairs have focused regression/visible save evidence; diagnostic logs were
removed from production source.

Completed focused checks: real local session restore, phone/landscape map geometry,
right-side rail placement, modal controls, unchanged map-instance preservation,
capacity/sharing/load status save/readback, manual offset-only movement, and regular
service save/readback. This UI check uses a selected synthetic local fixture and
revokes its session afterward; it does not claim another email-delivery test or
bypass application throttles. An earlier repeated OTP check hit the existing
10-request/10-minute limit;
limits remain unchanged. After that window elapsed, the actual local OTP workflow
also passed: onboarding, first location/capacity, automatic movement/Off Duty,
company-owner grants/revocation, tracking status/photo proof and consented portrait
upload/readback (`.local/mobile-driver-map-email-final.log`).

Native emulator captures verify the right-side layout and focused Sharing/Location
modals. Accessibility/adb intermittently times out; no stale bounds are used.
Native manual GPS now succeeds after the permission repair, persists the selected
20 km radius, excludes the injected exact fix, and moves into the new synthetic
area on local database readback. Native fixes are not bit-identical to browser
fixtures; the exact reason for that difference was not established. Verification
confirms persisted movement, the selected radius and exclusion of the injected
exact position; it does not claim literal coordinate equality or physical travel.
Native photo-picker completion and final standalone APK remain separate checks.
The current installed builds require Metro.

Focused evidence: `.local/mobile-driver-map-simple-final.log` passes phone/landscape
layout, all three groups, optional load controls, capacity/status/sharing saves,
offset-only manual movement, regular-service save/readback, zero browser exceptions
and zero native-text warnings; the test session is revoked. Thirteen focused
permission/privacy/location/coverage tests pass (`mobile-driver-map-policy.log`). Native
right-rail and Sharing/Location screenshots are retained in `.local`. Lint and
typecheck pass; 399/399 explicitly marked messages cover all four non-English
languages, and the new task labels have their own language rows. Source checks
pass for 458 files. These are focused checks, not refreshed release evidence. Owner
rejected the six-button layout as unclear. The subsequent explicit web/Expo
production instruction accepts the simplified three-task layout and authorizes
release gates and scoped publication; see PRODUCTION_AUTHORITY.md. Keep backend
3100, browser preview 8084 and native Metro 8083 running. No production changes.

## Emulator verification resumed — October 6 owner direction

After physical USB disconnection, the owner explicitly requested emulator testing.
Only Loadgistic_Pixel_API_35 is restarted, preserving its data, port/serial 5580,
with command-scoped SwiftShader, two cores and 3 GB RAM. Shared SDK/adb settings
and other AVDs are unchanged. The current native x86_64 development build compiled and installed successfully;
the Pixel ARM64 build is separately preserved in .local. Native Marketplace,
workspace navigation and driver map/control appearance have been exercised.

Verify AVD identity before all native actions and require fresh valid UI hierarchy
before target selection. Testing now targets local driver GPS/movement, capacity,
tracking and actual Android file-picker uploads. Do not turn simulated location
into a claim of physical-phone or background-tracking verification.

## Driver Home, movement and photo verification — October 6

The owner asked whether the driver workflow was fully connected. Inspection found
that the native dashboard linked to a manual editor rather than putting assigned
capacity on Home, and did not refresh capacity location automatically. These gaps
are repaired locally: driver Home embeds the existing capacity controls, saved
approximate map and route/area. Owner/operator fleet controls remain available;
company drivers retain assignment-based editing restrictions. No hosted schema,
permission or configuration change is part of this repair.

Automatic capacity refresh reads current assignment/duty authority, uses an already
granted foreground permission, applies the shared web offset on-device, and saves
at a ten-minute cadence while Home or Truck capacity is open. Editors, blur,
background/lock, Off Duty and revoked assignment stop/discard pending fixes.
Manual Share can request permission and bootstrap before a first signal. Server
readback refreshes the approximate area and timestamp without changing capacity,
route, accepted loads or sharing. Location labels/options are localized; catalog
city names remain unchanged. Automatic shipment location still runs only in the
open travel screen, not as a background service.

Focused evidence: seven location/privacy/copy tests, four mobile capacity contract
cases, mobile lint/typecheck, 394/394 marked translations, and
`scripts/verify-mobile-driver-home-local.mjs`. The browser checks actual OTP,
new self-managed driver Home, assignment, first approximate fix, catalog route,
private save, simulated movement and offset-only server readback, unchanged signal,
Off Duty pause, tracking Loading/photo upload/readback/reopening, and public driver
portrait selection/consent/save. Company-driver login, restricted first-location
bootstrap, owner grant, Partial save, permission revocation and Off Duty also
passed. The final rerun, including server-side session cleanup, passes in
`.local/mobile-driver-home-browser-final.log`. The first cleanup invocation used
the wrong logout body; this harness was corrected to the existing token contract.

The portrait first-use check also found an empty-string conditional rendered into
View. It now uses a boolean condition; the browser check rejects that console
warning as well as exceptions. This is a native-only defect, not a web finding.

Owner visual review of the changed Home is pending. The owner offered their Pixel
8a (Android API 36, ARM64) for real testing and authorized USB debugging. Its serial
was independently verified; no other device or application is in scope. The
existing emulator APK contains x86_64 libraries. The scoped ARM64 development
build succeeded in 10m31s, installed on the verified Pixel and loaded the native
Marketplace map plus actual email-code login and driver Home. This remains a
Metro-dependent development client, not the standalone production APK. USB later
disconnected; the owner reconnected the cable, but ADB still reports no device.
Location permission, OS suspension, physical movement, native file-picker upload
and return behavior remain unverified. Captures: `.local/mobile-pixel8a-marketplace.png`
and `.local/mobile-pixel8a-driver-home.png`. APK/receipt: `.local/loadgistic-pixel-development.apk`
and `.local/mobile-pixel-development-receipt.json`.

Steps remaining: restore USB for the already-installed phone build, reconnect
only task-owned ports 8083/3100, require fresh foreground/hierarchy
checks before native interactions, complete device/owner visual review, then
refresh exact-candidate release evidence and build/distribute the standalone APK.

# Mobile implementation — FEAT-MOB-001


## Local Expo browser preview — October 6

Owner requested localhost browser testing after Android system/launcher ANRs.
The Expo app now runs at `http://localhost:8084` with `npm run preview:web`
in `apps/mobile`; keep the Loadgistic backend on port 3100 running too.
This renders the actual React Native screens through React Native Web. The map
uses MapLibre GL JS in the browser and MapLibre Native on Android; both receive
actual local capacity data. Authentication uses the same mobile API, with
local-only tab session storage and a fixed, allowlisted localhost API proxy.
There are no hosted CORS, account or authentication-setting changes.

- [x] Browser map loads real local truck/cluster data and OpenStreetMap tiles.
- [x] Select truck, open centered details, close details, return to previous map,
      and open navigation at phone width. No browser errors in this check.
- [x] Mobile typecheck/lint and 84 tests pass, including preview scope/storage checks.
- [x] Visible local email-code sign-in, onboarding destination, refresh restoration
      and sign-out. Cold backend compilation caused the first request timeout;
      one warmed retry passed. Codes/tokens were not logged.
- [ ] Complete the remaining provider/visitor workflow matrix.
- [ ] Complete standalone APK/device verification; browser preview is not evidence
      for Android permissions, Back, native file sharing, deep links or installation.

The expanded signed-in browser test caught collapsed flex sizing in the area
switcher and zero-width logo space. The shared shell now uses explicit grow,
shrink and basis values. The expanded real-browser workflow passes local OTP,
provider onboarding, refresh restoration, switching both ways, map detail/exit
and sign-out including successful server revocation (`.local/mobile-web-workflows.log`).

Review captures: `.local/mobile-web-preview-phone.png`,
`.local/mobile-web-preview-truck-modal.png`, `.local/mobile-web-preview-menu.png`.
The browser preview is local development only, not a second public website or an
Android production release. The exact @falmatad/loadgistic project was later linked and verified; remote
signing/builds and distribution remain unperformed.

## Scope and release status

Android first, Expo owner `falmatad`. All visitor pages and transporter roles are
in scope, including private capacity, customer Tracking, brokerage conversations,
onboarding, fleet, account, documents, network, billing and member help. Staff,
admin and support-management screens remain web-only. Google Play is deferred.

**In progress; not ready for external testers.** An x86_64 development client is
installed on the Loadgistic emulator. It requires Metro; it is not a standalone
ARM phone APK. Native API changes run locally only and are not deployed to
loadgistic.com. The exact @falmatad/loadgistic project has now been created and verified;
remote signing and distribution are still incomplete.
No production account, database, mail or configuration was changed in this work.

## Web gaps discovered during implementation

Maintain [WEB_GAPS_FOUND_DURING_MOBILE.md](WEB_GAPS_FOUND_DURING_MOBILE.md) while
connecting each native workflow. Record source evidence, impact, confidence and
closure tests; defer unrelated web repairs. Shared data-integrity/security risks
still need a release assessment. This register does not replace the mobile checklist.

## October 6 release continuation

The owner approved the reviewed truck modal ("ok looks good"), requested the same
composition on mobile, and explicitly authorized publishing the current web and
mobile work. This clears the visual gate for this composition; it does not turn
the outstanding native device checks into passing evidence. Scope remains only
Loadgistic, Expo owner `falmatad`, Android package `com.loadgistic.app`, the existing
Loadgistic Netlify site and Supabase project `tpwyyzoqijjmbvsmmvcm`. Google Play
account setup remains deferred. No unrelated hosted settings changes are included.

Ordered release steps:
- [x] Record the owner approval and inspect the existing release/device checklist.
- [x] Web quality: 414 tests, source/spec validation and typecheck pass.
- [x] Changed browser workflows: 43 initial passes, 10 focused retry passes, four resumed passes and one final owner-operator navigation pass cover all 58 cases. Fixtures now resolve migrated login aliases and unique tracking recipients; navigation assertions reflect grouped Account/My trucks controls. Evidence: `.local/release-oct06-browser-{final,retry,resumed}.log` and `.local/release-oct06-driver-nav-final.log`.
- [x] Complete current local API/permission walkthrough and bounded dependency assessment for an internal test build.
- [ ] Finish platform/device verification before broader distribution.
- [x] Review a local EAS upload copy using the installed EAS ignore implementation: 281 files, 2,283,132 bytes; environment files, editor settings, generated native projects, signing material and symlinks excluded. Evidence: `.local/release-oct06-mobile-upload-review.json`. No upload performed.
- [ ] Bind Expo account/project before linking or signing (account checked as falmatad; app is not linked to an EAS project).
- [ ] Run immutable-candidate CI, security/backup/release checks and deploy web.
- [ ] Build and verify standalone Android APK against the deployed API; record
      installation/distribution separately from store publication.

## Truck modal layout correction — October 6

- [x] Replace undifferentiated vertical stack with illustrated identity, related
      people/actions, grouped updates and compact web document summaries.
- [x] Check desktop/phone layout, long records, document expansion and retained
      profile/contact targets; run native typecheck/lint without claiming device evidence.
- [x] Capture local desktop/phone review states, including Amharic and expanded documents.
- [x] Obtain owner visual approval; native device verification remains open.

Evidence: `.local/truck-profile-verified.log` passes all six desktop/phone cases
covering composition, natural no-scroll sizing for the ordinary fixture, expanded
evidence, translations, narrow screens, long records, correctly assigned fallback
phone links and existing map return behavior. Web/native typecheck, native lint
and spec validation pass. Review captures are `.local/truck-profile-desktop.png`
and `.local/truck-profile-mobile.png`. No new backend fields/permissions or native
contact/document controls were fabricated; native uses its existing projection.
The emulator remains stopped after its recorded instability; no native device
pass or release is claimed.

## Current map follow-up — October 6

- [x] Attach selection-exit X to truck; restore previous camera and retain filters (web browser evidence below; native device check remains open).
- [x] Center shared information modal with light backdrop and bounded scrolling.
- [x] Verify focus, dismissal, camera restoration and screenshots on desktop/phone web; native typecheck/lint and three focused projection/focus tests pass.
- [ ] Verify native attached exit, modal position, Android Back, TalkBack and interrupted zoom on a responsive Loadgistic device. Previous emulator ANRs remain unresolved.
- [x] Owner reviews changed modal/X before release gates; dev server stays running.

Evidence for this follow-up: `.local/map-modal-exit-final.log` passes 2/2
browser cases for centered/non-scrolling ordinary route content, backdrop/Escape,
focus loop/return, attached X and repeated panned/zoomed filtered-camera restoration
(including a zoom click still queued for the next frame). `.local/map-modal-regression.log`
passes 6/6 route, closed-area and loading/retry cases. `.local/map-modal-scroll.log`
passes 2/2 scroll isolation and map zoom after dismissal cases; the initial cold
hydration timeout was corrected to the other map tests’ 30-second startup allowance.
Web typecheck and spec links
pass. Captures: `.local/map-modal-{desktop,mobile}.png`,
`.local/map-truck-exit-{desktop,mobile}.png` and `.local/map-regular-modal-{desktop,mobile}.png`.
Owner review has been requested for this actual layout; no release gates/deployment.

## Ordered completion checklist

Current owner correction (October 6): implement web phone navigation parity before
continuing the remaining device matrix. Reuse public/mobile navigation and AppShell
roles, Lucide icons and existing visual language; no unrelated redesign.
- [x] Inspect web public header, public bottom tabs and role-aware AppShell.
- [x] Add mobile-scoped SDK-compatible icons, shared navigation/menu and familiar dashboard controls.
- [ ] Verify role visibility, touch targets, keyboard/modal behavior and native navigation; capture phone evidence.
- [ ] Obtain owner visual review before release gates for this changed shell.

Owner approved the initial icon/navigation direction, then requested grouping
instead of copying web's overloaded More menu. Current follow-up:
- [x] Replace More with Account; group settings there and fleet controls together.
- [x] Keep workspace Support directly accessible and role/plan restrictions intact.
- [x] Owner clarification: consolidate actual forms within Account/Fleet, not only
      their links. Lazy-expand related controls, retain drafts on collapse, scope
      documents to their entity, and retain old deep links for compatibility.
- [ ] Verify grouped destinations, Android navigation and keyboard behavior;
      provide updated screenshots before release gates. Preserve original approval
      as approval of the initial direction, not the later regrouped screens.

- [x] Inspect backend/auth boundaries and Mac tooling.
- [x] Create and boot Loadgistic_Pixel_API_35; install and run the native client.
- [x] Isolate mobile dependencies and Expo Router from the deployed web graph.
- [ ] Complete public discovery parity: profile results, filters, geometry,
  overlap selection, truck images, cluster counts, reset and accessibility.
- [ ] Complete provider identity: OTP/onboarding/account edits work; secure-store
  failure/refresh races, all role/device states and legacy invitations need tests.
- [ ] Complete fleet controls: add truck/driver, assignment and permission commands
  work; vehicle editing/lifecycle, interchangeable trailers, driver contact/removal
  are now connected and pass local permission/lifecycle integration. Their new UI
  still needs Android review and the complete role matrix.
- [ ] Complete capacity: current route/area, load acceptance, sharing, approximate
  location, duty and regular-service commands are implemented. Catalog-coordinate
  map previews now render; saved route verified on Android. Closed-area device
  evidence and the complete role/device matrix remain.
- [ ] Complete provider Tracking: list/create/status, recipients and owner recovery
  adapters/screens are implemented, including private proof upload/view and automatic
  foreground travel updates. New file/map/device checks and the full matrix remain.
- [ ] Complete email-authorized visitor Tracking/private capacity sessions: scoped
  adapters, secure storage, renewal, screens and local integration pass; Android
  email-session checks and the complete extended local integration passed.
  New native proof controls and the Tracking map still need device verification.
- [ ] Implement verification uploads, public profile editing, account security,
  closure, network, billing and transporter member support.
- [ ] Implement Featured, public profiles, brokerage conversation, About/legal.
- [ ] Complete phone navigation, five-language copy and offline/error recovery.
- [ ] Resolve dependency advisory disposition and build upload exclusions.
- [ ] Owner reviews working native screens before extensive release gates.
- [ ] Complete workflow/permission/device matrix and review the native API release.
- [ ] Build signed ARM APK, install on owner's Android phone, verify cold start,
  configure scoped Expo internal distribution and supply testing instructions.
- [ ] Play internal testing/store setup after owner completes their account.

Current work: finish native discovery/device checks and expand five-language copy
after the verified brokerage walkthrough. About is now native; legal links use the
published website and WEB-MOB-006 remains open. Continue the remaining role/device matrix. Provider account-security/photo, fleet/capacity, private files/PDFs,
billing, and populated Featured still need their listed device evidence. An API
test is not proof that every role’s native interface works. Keep implemented,
tested, owner-approved and deployed distinct. A link is not native completion.

## Architecture and isolation

Expo 57.0.26, React Native 0.86.3, MapLibre 11.5.0, Expo Router 57.0.24.
Next.js stays at the repository root with its own React/dependency graph;
apps/mobile has its own lockfile. Shared-domain extraction remains incremental.
Native location imports the existing pure src/lib/location-privacy.js function.
Metro watches that Loadgistic source directory only in addition to the mobile
project; no parent workspace or other project is watched. A normal workspace
migration later can replace this temporary shared-source configuration.

Native JSON routes verify bearer identity with Supabase Auth and reload the
current managed actor. Existing application services and PostgreSQL commands
still authorize mutations. Browser cookies do not authenticate native routes;
browser CSRF checks and database grants are unchanged. Refresh credentials use
SecureStore; access tokens stay in memory. Staff/admin identities are denied.

Follow apps/mobile/AGENTS.md: explicit Loadgistic working directory, package-local
repairs, exact process/device targeting, no other Expo project cleanup, and no
global package, SDK, shell-profile, adb-server or account changes. A stop request
requires stopping verified task-owned work; ending a turn does not stop a build.

## Mac and running preview

Intel macOS 14.8.7, Java 17, Android Studio, Android SDK platform/build tools 36.
Loadgistic_Pixel_API_35 uses 2 GB RAM/two cores, serial emulator-5580. Verify its
identity before any adb action. The other project's emulator remains untouched.
Full Xcode is absent; Android is the current target.

- Backend: http://127.0.0.1:3100, task session 33319, build directory
  .local/next-mobile-webpack (ignored), log .local/mobile-backend-webpack.log.
  Standard Next.js dev compiler replaces the local Turbopack preview after repeated
  empty-200 middleware responses; no production runtime/config change.
- Metro: localhost:8083, task session 66381, log .local/mobile-metro-capacity.log;
  watches changes. Device port forwarding applies only to emulator-5580.
- Emulator: Loadgistic_Pixel_API_35 is stopped after the recorded app/System UI ANR recovery attempt. Its data and com.loadgistic.app install are preserved; other emulators are untouched.
- Local Supabase: 127.0.0.1:55321; local Mailpit: 127.0.0.1:55324.
- Latest native binary: Expo Crypto/FileSystem/Sharing-enabled x86_64 debug build,
  477 tasks, successful in 8m49s (.local/mobile-chat-android-build.log). Installed
  on emulator-5580; Metro-dependent. No ARM distribution build is implied.
- Restore emulator reverses for both backend 3100 and Metro 8083 after an emulator
  restart; verify its exact AVD name first. Do not restart global adb.


Native review: open Loadgistic in the dedicated emulator, choose Transporter login,
use an isolated local test account and read its code in local Mailpit. Web port
3100 serves the backend/web app, not a claim of Expo web-preview parity. A synthetic local provider session is currently restored for device testing. All preview processes remain
running; verify actual PID ownership before restarting anything.

## Web phone navigation correction — October 6

The earlier native screen links connected workflows but did not reproduce the web
phone navigation. The owner explicitly corrected that gap: reuse the established
mobile web structure and improve actual usability defects, rather than inventing a
separate native interface. FEAT-MOB-001 now makes that acceptance criterion explicit.

Implemented: shared safe-area header, public Capacity / Track / Featured / About
tabs, web-role workspace tabs, scrollable menu, direct login/dashboard entry,
language selection and Lucide icons. Dashboard actions use the web icon/card/chevron
structure. Remove duplicate top-of-map navigation; keep the brokerage launcher
above the bottom bar. Navigation occupies layout space and hides for the keyboard;
map buttons measure their height so results do not overlap wrapped controls.

Native identity parsing now retains the existing server-projected operating model
for company-driver menu distinctions. This adds no server authority. API permissions
remain authoritative, staff/admin stay excluded, and billing-limited menus retain
account/billing/help without operating shortcuts. New navigation copy exists in
Amharic, Afaan Oromo, Somali and Tigrinya; user names remain unchanged.

Focused checks: 16 navigation/language/session/deep-link tests; 13 overlapping
navigation/language/session/native-text checks; mobile typecheck/lint and spec
references pass. SVG-enabled x86_64 debug build passed in 2m27s (497 tasks) and was
installed only on emulator-5580. Public screen visibly renders icons, tabs and
104 profile results. `.local/mobile-navigation-public.png` is current evidence;
menu/Back/keyboard and owner review continue. Development startup again showed a
temporary blank screen before rendering, so standalone cold-start readiness is
still unverified. No EAS upload, standalone ARM build or production change.

## Capacity preview evidence — October 6

City selection and authorized saved route/area responses now include only validated
catalog coordinates beside their existing reference/label. Writes still submit
place references. The preview rejects missing/invalid intermediate cities rather
than drawing a shortcut; polygons close only complete nondegenerate choices.
Fresh driver location can display the already-coarsened privacy circle.

Three geometry/projection tests, five current/regular-capacity API tests, mobile
and backend typechecks pass. Extended local account integration passed again,
including owner/driver role denial, saved/new catalog-coordinate roundtrips,
private sharing/revocation, documents, Tracking and fleet lifecycle. Evidence:
`.local/mobile-capacity-preview-integration.log`. Android route preview is visible
in `.local/mobile-capacity-route-preview.png`. A transient emulator tile DNS error
was observed; basemap and route subsequently rendered. Closed-area visual evidence
is not yet claimed; navigation correction interrupted that editor walkthrough.

## Verified evidence — October 5

On the actual emulator, using only synthetic local records:

- Requested email code, received it in local Mailpit and entered it through the
  visible form; reached onboarding, created owner-operator and opened dashboard.
- Added a truck using its configuration image picker; the saved card showed its
  owner-driver assignment.
- Requested foreground location, handled Android's permission/location-service
  prompts and recovered from the initial location timeout. The form survived;
  an approximate 20 km location then saved. No background tracking was enabled.
- Selected real catalog cities for a route and saved the first private capacity
  signal. Reopened the screen and observed the persisted status/update time.
- Returned to dashboard and observed On-duty Trucks change from zero to one.
  Fixed stale navigation data by reloading focused screens; stale requests and
  previous-account query data cannot replace a newer response.
- Edited the account name and observed the saved confirmation and updated driver
  label. Restart restored the session; the visible Sign out control returned to
  the email form.

Screenshots (local evidence, not owner approval):
.local/mobile-native-onboarded.png, .local/mobile-truck-added.png,
.local/mobile-dashboard-updated.png, .local/mobile-account-edit-saved.png,
.local/mobile-capacity-persisted.png. The older mobile-capacity-first-save.png
was captured before reload completed; it is not persisted-state evidence.

scripts/verify-mobile-account-local.mjs passed against the isolated local services:
anonymous/forged denial, inactive-workspace denial, owner-operator/company signup,
account edit, truck persistence, assignment before driver email verification,
driver OTP login, restricted-driver location bootstrap, owner device-location
denial, real cross-provider denial, owner publication, permission grant/revocation
on an existing driver session, Off Duty and removed-assignment denial. Private
sharing defaults, invalid-city rejection and logout refresh revocation also pass.
The script creates disposable local accounts/trucks and logs out its sessions;
it never prints OTPs/tokens or uses hosted services.

Earlier focused checks: 14 native tests, 7 native API/policy tests, 28 existing domain
regressions; native lint and typecheck; backend typecheck; spec references (33
specs); Expo Doctor 21/21. No full release gates or production build were run for
this slice. Native session race/failure injection and every remaining matrix row
are still required before release.

Earlier public-map device evidence showed OSM tiles, real local truck selection
and empty-search handling. Clear-search completion/performance and full map parity
remain unverified. No complete-discovery claim follows from that proof.

## Open findings and next actions

1. Dependency audit: 30 propagated findings, 20 high/10 moderate, zero critical.
   Four advisory roots: braces 3.0.3 (Metro file matching), node-forge 1.4.0 (Expo
   development/signing tooling), uuid 7.0.3 (xcode/config plugins), and
   decode-uri-component 0.2.2 through query-string 7.1.3/Expo Router. The decoder
   can affect runtime link parsing; do not classify all findings as build-only.
   Registry offers decoder 0.5.0, but a compatible Router/query-string fix and
   malformed-link regression have not been established. Do not force an Expo
   downgrade or mix SDK 58 Router into SDK 57 merely to clear the audit.
   Distribution remains blocked on assessment/remediation. Owner: mobile author.
2. Catalog suggestions can display the same city label for different place refs.
   Review nearby duplicate sources versus distinct places before deduplicating;
   don't silently change selected geometry. Owner: location/search author.
3. Full localization, vehicle lifecycle, documents, tracking and visitor workflows
   remain required, not optional polish. Native API release and APK readiness
   depend on their connected workflow evidence and owner visual review.

Sources: Expo SDK 57 Location documentation, Expo Router navigation documentation,
Expo monorepo guide; existing Loadgistic capacity/identity contracts remain the
business authority. See FEAT-MOB-001 and ADR-074.

## Tracking implementation check — 2026-10-05

Native shipment list/create/detail and recipient controls reuse provider Tracking
commands. Shared journey choices and progress labels drive both web and native
presentation; the database remains the state-transition authority. Selecting a
step requires Save. Only the assigned driver sends obscured device location;
leaving/locking the screen invalidates a pending GPS fix. Current native location
is manual/on travel-step save; automatic foreground travel updates are not complete.

Owner recovery uses existing revision checks and required reasons for corrections,
reassignment and explicitly confirmed cancellation. Company-driver Tracking
permission does not confer owner recovery access. Responses project fields
explicitly, omitting access codes, credential digests, private proof paths and email
failure details. There are no schema or production configuration changes.

Evidence: tests/mobile-tracking.test.mjs (4 cases); shared progress/location
regressions (12 cases); scripts/verify-mobile-account-local.mjs against isolated
local Supabase and Mailpit. The integrated test verifies actual cross-provider
denial, permission grant/revocation on an existing driver session, driver-only
travel fixes, invalid/terminal transitions, recipient persistence and owner
protection, local customer email delivery, owner-only recovery, stale revision
rejection, correction, eligible replacement truck/driver and confirmed cancellation
with retained history. Backend/native typechecks and native lint pass; 33 spec
references resolve. These are focused checks, not release gates or owner approval.

A local Next.js preview fault returned empty HTTP 200 responses. Verified the
Loadgistic process/cwd on port 3100, restarted only that task-owned process, then
confirmed proper JSON/401 and reran the connected workflow tests successfully.
An Expo Tools overlay also intercepted a Dashboard tap; this is development-client
UI, not shipment state. Android visual evidence must be captured after dismissing
that overlay; failed navigation attempts are not passing evidence.

## Visitor access, sharing and profile publication — 2026-10-05

Native guests can request and verify an existing Tracking/private-capacity email
code. Separate mobile-only signed scopes preserve existing web/native rate budgets,
live recipient authorization, thirty-minute idle expiry and Tracking's eight-hour
absolute limit. Credentials use separate SecureStore keys; logout, background,
expiry and stale responses cannot restore private content. Storage-removal errors
remain visible with a retry action. No OTP or reusable shipment code is returned.

Private truck sharing now has a native owner/authorized-driver screen. Existing
permission commands add/revoke individual emails and explicitly opt in/out of
Loadgistic brokerage access. A new provider's unpublished profile correctly hides
signals even after a grant. Added the existing profile editor/publish command and
setup notices on dashboard, capacity and sharing; no database visibility rule was
relaxed. Profile publishing requires catalog locality/region. Public business
contacts stay independently opt-in; company drivers cannot edit the owner profile.
Profile image upload remains pending.

The complete local integration script passed after exercising real native profile
publication: draft remains hidden, publish makes the granted assigned truck visible,
invalid city/actor spoof/company-driver writes fail, private contacts remain hidden,
duplicate grant is idempotent, inbox OTP/replay/scope checks pass, renewable access
works and revocation hides the truck from an already verified visitor. Tracking
visitor tests also pass shared-only reads, provider/browser/native scope separation,
recipient revocation, customer-owner-only single review and non-enumerating requests.
Provider Tracking, fleet and account regression scenarios remain passing in that run.
All records/mail were synthetic local fixtures; no hosted mutation occurred.

Native Tracking device evidence additionally confirms saved Loading/next On the way,
recipient addition and owner cargo correction on the retained synthetic shipment.
.local/mobile-tracking-persisted.png is inspected evidence; owner visual approval is
still required. New visitor/profile/sharing screens still need device review. The
emulator UI inspection intermittently exited 137; do not count those failed attempts
as product passes or use API results as a substitute for native interaction evidence.

Latest focused checks: 21 native tests pass, including malformed session metadata
and secure-storage removal failure/retry; native typecheck/lint and server typecheck
pass; all 33 spec references resolve. Android recovery showed a guest startup screen
and repeated System UI-not-responding prompts. These are test-device failures, not
passing evidence for new native screens. Other projects/devices remain untouched.

Device recovery: original emulator session 17535 was shut down with `adb -s
emulator-5580 emu kill` only after verifying AVD name. Restart session 65671 uses
the same Loadgistic_Pixel_API_35, port 5580, 2 GB/two cores and no snapshot; no
wipe/global adb restart occurred. Local backend 3100 and Metro 8083 remain running.
Expo web preview is not yet ready: the native MapLibre component still needs its
web adapter. Do not present port 3100 as an Expo web preview or a debug client as
an independently installable tester APK.

Cold-start outcome: Android reported boot complete after about 109 seconds but
System UI again displayed its nonresponsive dialog. The controlled retry did not
resolve native test infrastructure. Next step is to diagnose that dedicated AVD
before claiming visitor/profile/sharing device verification; do not reset another
project, wipe data or infer device success from the passing local integration.
Backend/native typechecks, native lint, 21 native tests and 33-spec link validation
are complete for the present edits. Nothing has been staged, committed, published
or uploaded; owner visual review and the remaining full mobile checklist still apply.

## Retry and native visitor verification — 2026-10-05

The retained Loadgistic AVD became responsive on retry; the current device blocker
is cleared. No second reset, wipe or unrelated-device operation was performed.
Backend 3100 and existing Metro localhost:8083 remain running (Metro binds IPv6
localhost, so an IPv4-only probe is not evidence that it stopped).

Android checks completed through visible controls with synthetic local records:
- Provider email login, profile setup prompt, catalog region/city selection and
  successful publication. Public-contact switches remain off. The setup prompt
  clears on dashboard reload; the sharing page reads persisted grants.
- Added a private recipient email, verified its local inbox code on the guest map,
  selected the granted truck and observed its provider/driver and update-age labels.
  Closing private access clears both the marker data and selected truck card.
- Tracking email verification opens the authorized shipment list. Detail shows the
  persisted Loading status, corrected cargo and event history. A cold app restart
  restores the still-valid Tracking session without another code; renewal returns
  200 and the list reloads. These checks do not cover proof uploads or location maps.

Device testing found a real clock-skew defect: a phone a few seconds behind the
API rejected the valid credential's startedAt timestamp. The API now includes its
issue time. The native controller anchors remaining server lifetime to local
request start, conservatively subtracting transit time; saved clock offset supports
restore. Server token expiry, current grants and Tracking's eight-hour cap are
unchanged. Tests cover clocks ahead/behind, response delay, restore, renewal identity
and excessive lifetimes. State-retaining Fast Refresh was insufficient for the
controller change, so final verification used a cold app restart.

Latest focused evidence: 23 native tests, native typecheck/lint, server typecheck.
Screenshots inspected: .local/mobile-profile-publication-review.png,
.local/mobile-private-capacity-review.png, .local/mobile-visitor-tracking-review.png.
Additional selection evidence: .local/mobile-private-truck-selected.png. UI test
output now redacts code fields and screenshot capture refuses entered codes; the
failed pre-fix screenshot was removed. Screenshots are evidence, not owner approval.

Remaining full scope, dependency disposition, public-map parity, native proofs,
localization and other unchecked rows above still block a complete-app or standalone
APK claim. No source commit, remote deployment or hosted configuration change.

## Native files, fleet completion and billing — implementation in progress

Fleet editing/lifecycle, trailer switching, contact editing and driver removal passed
local integration, including active-shipment locks, explicit confirmation, history
retention, cross-owner/driver denial and removal invalidating an existing session.
Native controls are connected; this does not substitute for their device review.

Native multipart uploads authenticate first, cap streaming input at 4 MiB plus
bounded command overhead, reject duplicate/unknown form fields, and reuse existing
private storage inspection/quarantine. Verification subjects preserve company,
provider, driver and truck boundaries and ownership/permission alternatives.
Provider and email-authorized Tracking proof reads recheck current access and return
only file content/type, never storage references or public proof links. Native image
viewers clear on blur/background; PDFs use explicit sharing and temporary cache.
Profile images support private owner preview before publication. Billing includes
limited-account plan access, paginated history and optional receipt submission.
Paid-plan device/integration cases remain unverified; local default is free access.

Focused results: 9 server file/billing/Tracking contract tests, 2 regular-service
contract tests, all 25 native tests, native lint and both typechecks passed. The
complete extended local integration passed after a controlled backend restart;
evidence is .local/mobile-files-integration-final.log. It covers actual verification
upload/readback, invalid-content/actor/duplicate rejection, cross-owner file denial,
Tracking photo readback and recipient revocation, profile images, regular service,
and fleet history preservation. Paid-plan success and failure-injection coverage
remain pending, as do new native device flows. Earlier local timeouts are superseded
by this complete run, not evidence of a resolved production defect.

Expo-compatible expo-file-system 57.0.7 and expo-sharing 57.0.22 were installed only
in apps/mobile (matching SDK 57). CNG prebuild and x86_64 assembleDebug succeeded:
13m48s, 477 tasks; .local/mobile-files-android-build.log. The updated development
client is installed on the dedicated emulator and requires Metro. Android document
picker invocation passed; submission/readback and remaining device checks are pending.
Nothing was signed for distribution, uploaded to EAS or deployed to production.
FileSystem API checked against installed SDK declarations after its versioned docs
endpoint failed; DocumentPicker/Sharing and MapLibre official docs were consulted.


## Member support and native upload verification — 2026-10-05

Native Support now connects member intake, active/closed history, bounded foreground
updates, replies, explicit closure and private attachments to the same services used
by web staff. `scripts/verify-mobile-support-local.mjs` passed actual member/staff
roundtrip, attachment bytes/read denial, cross-member read/send/end denial, strict
inputs, one-open-chat rule, 59-message cursor history, retained closed attachments
and starting a new chat. This uses synthetic local records; no hosted messages.
Two support contract tests and both typechecks/native lint passed. Android review
is in progress; staff browser UI and every role/device state are not inferred.

Android testing caught an upload defect missed by Node HTTP tests: Expo 57 installs
expo/fetch globally and rejects React Native URI multipart descriptors. The shared
upload builder now uses Expo File/Blob objects with size/type validation; two new
transport regressions pass. Android DocumentPicker → submit → Awaiting review →
private image reopen passed; .local/mobile-native-document-view.png was inspected.
This synthetic logo is not a real identity document. All upload consumers use the
corrected builder, but each remaining photo/PDF/device workflow still needs review.

Reference: Expo 57 API docs describe global fetch replacement; installed Expo
convertFormData explicitly rejects URI parts and supports File bytes. This was a
native implementation defect, not a new web-gap entry. Do not claim native upload
completion from a Node upload test. No standalone APK, owner approval or deployment.

## Account security and public content — October 5 continuation

The complete local account-security integration now passes: fresh current-email
OTP, actor/target binding, replay rejection, both inbox confirmations, persisted
email synchronization, active-support closure block, retained profile/chat history
and stale access/refresh denial (`.local/mobile-account-security-final.log`).
Local Auth had auto-confirm enabled; its first confirmation consumed both links.
Local config now explicitly enables confirmations and double-confirm changes,
with a first-link-still-pending assertion. No hosted Auth setting was touched.

Provider credentials now have a tested controller: seven race/storage/denial tests
cover single-flight refresh, late sign-in/read rejection, cleanup tombstone and
explicit sign-out retry. The native logout API no longer treats provider/network
failure as successful revocation. Native device account-security review remains.

Featured and public profiles have explicit native public projections and connected
screens. Six focused server contract checks, both typechecks and anonymous local
integration pass: five public profiles, multiple fleet pages, images, malformed
and missing profile denial, no private fields. Today's fixture has no published
Featured pairs; this verifies the empty state, not a populated current programme.
Thirty-six native tests passed. A newly introduced navigation-effect lint error was
identified and replaced with keyed screen initialization; native lint rerun passed.

The former generic partner-network POST intentionally returns 410 and the web
Network now only manages truck-specific access. Do not recreate a retired contact
feature or count it as an unfinished mobile screen. Driver portrait management is now connected and locally tested. Terms/service narrative issue recorded as WEB-MOB-006 for review.

Local stack restart initially exceeded health-check deadlines under memory
pressure; the controlled retry excluding unused logflare/vector/edge-runtime passed,
retaining data. Only Loadgistic's unresponsive emulator was stopped and restarted
(session 13109, same AVD/serial). Other projects and devices were untouched.

## Driver portraits and guest brokerage — continued

Driver photo consent, role/actor/content denial, normalization, public readback and
removal passed the local integration (.local/mobile-portrait-integration.log).
Native image selection, consent and removal controls are implemented; device review
remains pending. No owner can upload on a driver’s behalf.

Guest brokerage now has native capability-isolated intake/chat/history/end flows,
SecureStore-backed idempotent drafts and replies, and foreground refresh. The local
roundtrip passed staff assignment/reply, duplicate commands, forged/other-request
denial, 57-message pagination, end/read/send denial and retained staff follow-up
(.local/mobile-brokerage-integration.log). Six native session tests and three server
contract tests passed; native typecheck/lint passed. Expo Crypto ~57.0.3 is installed
only in this app. CNG prebuild passed; x86_64 development rebuild is in progress
(.local/mobile-chat-android-build.log, session 81783). No distributable APK yet.

Current step: native discovery profile results, detailed filters and map geometry/
selection parity. Reuse existing search services and offset geometry; no new search
provider or changed public/private matching rules. Keep a working native preview
for owner review before full release gates. The exact Loadgistic emulator was
stopped after repeated adb UI timeouts, freeing memory for this development build;
its app data is retained and other projects/devices remain untouched.

## Native discovery parity — local verification

Public/verified-email profile results now use the existing PostgreSQL search service.
Native private search cannot select a staff audience/digest. Configuration images,
space, availability, city/radius, route, stops, freshness and entity-document filters
are connected to both results and automatically paged map data. Display geometry
reuses web’s offset algorithm, including reversed partial legs and closed areas.
Cluster counts and configuration images replace placeholder-only markers.

Seventeen focused discovery/capacity checks and both typechecks passed. Local API
integration passed name/handle/configuration matching, corresponding map trucks,
invalid-filter denial, scope/forgery/no-grant isolation and populated private search
(.local/mobile-discovery-integration.log); no database writes. All 49 native tests
passed before the subsequent chat edge-case and native-text checks, which also pass.
Native lint passed again on October 6 after the later native changes.

Android: visible cluster counts/images, filter modal, image-selected Mini Open Body
Truck, matching profile results (104 → 20), and Clear all (20 → 104, filter count
removed, map reset) exercised. Device testing found a raw-space text child between
buttons that typecheck did not flag; fixed and a native-container regression test
passes across the native source. Post-fix screenshot review, cluster taps/overlaps,
slide interaction and complete private discovery device coverage remain.

Brokerage retry tests now restore a pending message into a new controller, and
definitive expired/unavailable requests can start anew without discarding an uncertain
draft. Seven controller tests pass. Native conversation walkthrough is in progress.


## Android continuation — 2026-10-06

- Brokerage: the actual Android intake restored after restart; a native guest message
  persisted, assigned staff replied through the existing local service, and the reply
  appeared without pressing Refresh. End chat retained both messages; a cold app
  restart followed by reopening the chat restored ended history. Start a new request
  opened an empty intake. Exact synthetic database read confirms status NEW, ended
  access and two retained messages. No real request/customer record was used.
  Captures: `.local/mobile-chat-staff-reply.png`, `.local/mobile-chat-ended.png`.
- Found/fixed a native refresh race: a poll begun before send/end could replace the
  confirmed state. Reads now pause during writes and pre-write responses are ignored.
  Eight controller tests pass, including the reproduced race.
- External links: bounded pre-Router validation rejects malformed encoding and
  unexpected credentials/parameters. Four parser tests pass, including the installed
  query-string decoder. Android warm valid links reach chat/About and malformed
  UTF-8 reaches the recovery screen. Cold Metro launcher opens correctly. A direct
  cold custom link enters Expo's development launcher, so standalone cold custom-link
  handling remains a release-build check, not a claimed pass. See NR-16 and
  [MOBILE_DEPENDENCY_REVIEW.md](MOBILE_DEPENDENCY_REVIEW.md).
- Native About uses existing product copy with real navigation and browser legal
  links. Language choice is stored separately from sessions; explicit translation
  boundaries preserve user content. Shared catalogs plus native header/navigation
  copy support en/am/om/so/ti. Android caught a failed web-style dynamic catalog load;
  direct bundled imports fixed switching to Amharic. English and Amharic About
  captures are in `.local/mobile-about-*.png`. Remaining forms, dashboard copy,
  error labels, filters/results and full language/device coverage are not complete.
- Latest native focused suite: 59 tests pass. Native typecheck passes after the
  bundled-catalog change; lint recheck recorded in `.local/mobile-oct6-lint.log`.
  Spec validation passes (33 specs/30 features). These are focused checks, not full
  quality/release gates or owner approval. No signed ARM APK or remote changes.


Native follow-up evidence on October 6:

- Cluster tap expanded automatically. Android MarkerView rendered an offscreen
  cluster over the header; clipping the native map container fixed the reproduced
  overlap. Before/after captures: `.local/mobile-cluster-expanded.png` and
  `.local/mobile-cluster-clipped.png`. Results drawer opens and swipes closed;
  `.local/mobile-results-drawer.png` has the raw-text warning removed.
- Invalid middle coordinates previously created a shortcut after being dropped.
  Native path parsing now rejects the whole malformed path; route/area regression
  and all 16 discovery/capacity tests pass. No stored geometry or matching changed.
- Shared UI exposes explicit fixed-copy `message` props; 334 static boundaries and
  27 static navigation labels are marked. Dynamic user-record children/labels are
  preserved, with an AST regression protecting those translation boundaries.
  `npm --prefix apps/mobile run audit:translations` currently reports 119/334
  explicit messages covered in all four non-English languages, 215 still missing.
  `--json` reports locations; `--strict` fails for missing marked messages. Dynamic
  labels/raw Text/server errors and fluency still require manual review.
- Latest native suite: 61 tests pass; typecheck and lint pass. Owner visual approval,
  full role/device matrix, complete localization, dependency disposition and the
  standalone ARM APK remain outstanding. Current checks are not release gates.

Native fleet editor device check: synthetic NATIVE-001 changed from GIGA to GIGA Test
through Save truck details; the native reload displayed the persisted value and
local API logs confirm POST plus GET succeeded. The first attempt was interrupted
by test-harness Back/keyboard navigation before a write; the controlled retry avoids
Back and passed. Restoration to GIGA passed through the same native form and its refreshed
fleet card confirms the original value. This is one owner-operated truck case, not the full fleet matrix.

### October 6 — native member Support and localization follow-up

- Synthetic owner-operated truck edit/readback passed and its original GIGA model
  was restored through the native form (no direct data repair).
- Android Support: existing staff reply remained readable, member message persisted,
  confirmed ending moved the thread into Past chats, and the history reopened.
  A new intake and a complete reply then persisted in a second local conversation;
  the Somali End/Confirm controls closed it while preserving both messages.
  `.local/mobile-support-device-check.mjs --ended` verifies only that exact local
  synthetic conversation. `.local/mobile-support-history.png` and
  `.local/mobile-support-somali.png` were visually inspected.
- An automated long input was truncated; a short exact draft survived a foreground
  refresh. The UIAutomator helper could reuse an old XML file after a dump failure,
  causing an apparent Send tap with no POST. It now removes its previous dump and
  requires fresh-dump success. Do not infer a product success or defect from stale
  coordinates, and verify persisted state after a mutation. No production chat was used.
- Support topics, statuses, history/actions, retry guidance and shared attachment
  controls have native Amharic, Afaan Oromo, Somali and Tigrinya copy. Agent names,
  filenames and messages stay unchanged; dates use the selected locale. Tests cover
  all Support keys and interpolation fields. English/Somali device states verified;
  other-language visual review and fluency remain separate checks.
- Explicit translation audit now covers 163/358 messages in all four languages;
  195 remain, plus unmarked/dynamic/error copy requiring manual review. This count
  is not a whole-app localization claim. New catalogs require a fresh development
  load when the controller retains the previous catalog through Fast Refresh.
- 62 native tests, mobile typecheck/lint, spec validation and whitespace checks pass.
  New language evidence: `.local/mobile-support-language-tests.log`,
  `.local/mobile-support-typecheck.log`, `.local/mobile-support-lint.log`.
- Restarting the development client temporarily showed a blank initial screen while
  requests completed. About, Support and home recovered without source/layout changes.
  A controlled force-stop/Metro launch, with no second intent during startup, reached
  the visible home map and 104 profile results on the fourth bounded check; fresh
  hierarchy inspection was unavailable twice during startup. Screenshot
  `.local/mobile-home-cold-verified.png` was inspected. This proves that development
  launch eventually works, not acceptable standalone startup speed or a release-build
  cold-link pass. No dependency upgrade, EAS signing/upload, production write or
  external distribution occurred.

## Web consolidation extension — owner request October 6

The owner explicitly extended common-page consolidation to Loadgistic web.
Ordered work: reuse the provider editor inside Account, embed authorized document
controls with business/truck/driver entities, retain safe form return context, remove
duplicate provider More navigation, test web phone/desktop and native equivalents,
then obtain visual review. Related specs: FEAT-IAM-001/FLT-001/VER-001/MOB-001.
No Suqpage files, admin/staff interfaces, hosted configuration or production data
are included. Existing standalone links remain compatible.

### Common-page evidence — October 6

- Web desktop and phone Account saves persist the synthetic personal name and
  business headline, retain drafts across collapse/reopen and stay on Account.
  Company-driver cases pass on both sizes without owner editors. Phone truck
  documents upload/review returns to the same truck. Exact bounded return-target
  tests reject foreign/arbitrary URLs. Spec validation passes (33 specs/30 features).
- Native focused navigation/document-scope/localization/deep-link/text suite:
  17 tests pass; mobile typecheck/lint and root typecheck pass. Android Account
  collapse/reopen retained a typed draft, then saving the restored synthetic name
  showed the real success response. No customer account was modified.
- Android Fleet shows capacity and documents inside the same truck card. The
  document section showed only Isuzu GIGA's truck subject and its Submit a document
  control; no document was uploaded during this layout check. Actual file-upload
  evidence belongs to the earlier file tests, not this read-only walkthrough.
- A development LogBox warning during that walkthrough reported failure to resolve
  tile.openstreetmap.org. It is recorded, not suppressed or counted as map success;
  standalone network recovery and full map/device testing remain open.
- Captures: `.local/mobile-account-common-page.png`,
  `.local/mobile-truck-common-page.png`, and the focused Account desktop/phone
  artifacts in `.local/playwright-account-desktop/` and
  `.local/playwright-account-phone/`. Initial navigation approval does not approve
  this later consolidation. Keep local server 3100 and Metro 8083 available for review.
- No full release suite, signing, Expo remote build, deployment or external APK.

Phone header regression: Support uses a named icon at narrow widths; language,
Support and Exit dashboard fit within the header with separate 44px-high targets
at 320px and the normal phone width. The focused phone save test passes after the
correction. Embedded business settings retain Open public page for previewing.

Final common Account desktop/phone run: 2 passed (46.3s), including retained public
profile preview and narrow-header bounds. Evidence: `.local/web-account-final.log`
and `.local/playwright-account-final/`. Root typecheck and final whitespace check
pass. Scope-specific role and truck-document results above remain unchanged.

## October 6 — map focus and refresh correction (active)

Owner approved the common-page consolidation and resumed mobile work. New defect
scope: native selecting one truck must hide other trucks/clusters as web already
does; web viewport pagination must not repeatedly remove/re-add existing markers.
1. [x] Inspect both render/data pipelines; native lacked focused marker filtering,
   web replaced the displayed snapshot after every partial viewport page.
2. [x] Add native focus policy and preserve loaded web records until refresh ends;
   keep cancellation, final pruning, query/privacy isolation and automatic loading.
3. [x] Focused native/unit + desktop/phone browser regressions; Android select/close.
4. [ ] Record screenshots and limitations; owner review before changed-map release.
No new map modes, manual loading steps, provider changes or other-project work.

Map correction evidence: 23 focused tests in `.local/map-focused-tests.log`; both
typechecks and mobile lint passed. `.local/map-final.log` records 4/4 repeated
phone/desktop refresh cases. Existing cluster automatic-pagination/error-retry
cases passed both sizes; desktop cold compilation exceeded the original five-second
first-response wait, and its controlled retry passed in `.local/map-cluster-retry.log`.
The new regression initially raced the initial 350ms viewport request; waiting for
its final real response before intercepting the next refresh removed that harness
race. It continues to assert exact request count, marker retention and camera/map
identity; no failing assertion was relaxed.

Android selected/close/fresh-reselect passed; captures are
`.local/mobile-map-focused-truck.png` and `.local/mobile-map-overview-restored.png`.
OSM DNS LogBox warnings remain an environment/recovery limitation recorded above.
Common-page consolidation is now owner-approved. Map defect fixes are available
in the running emulator and http://127.0.0.1:3100; no full release or remote writes.

## October 6 — marketplace/workspace navigation and web detail placement (active)

Owner requests research into native public/provider coexistence and explicitly moves
web truck details into the results panel, restoring results/filters with X.
1. [x] Research primary mobile navigation guidance and dual-role app patterns.
2. [x] Web: reuse the drawer for truck details, preserve mounted result/draft state,
   keep map controls clear, test desktop/phone and capture review evidence.
3. [x] Owner selected Marketplace/My workspace with a clear switch. Implement
   separate nested navigation histories, stable header switch, existing role-aware
   tabs and unchanged deep-link URLs; isolate workspace state by account ID.
4. [ ] Focused native/device verification, translations and visual review.

Research: Android's layout/navigation guidance recommends 3–5 peer destinations
(https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns).
Apple's tab-bar guidance emphasizes predictable availability
(https://developer.apple.com/design/human-interface-guidelines/tab-bars).
Airbnb documents explicit hosting/travelling switching
(https://www.airbnb.com/help/article/3546). Recommendation is a clear two-area switch
with stable navigation within each, rather than silently swapping bars or combining
all public/provider destinations in one long menu. This is a product inference, not
an assertion that those sources prescribe Loadgistic's exact design.

Verification finding: Android reported a real input-dispatch ANR during automated
repeated Delete key events on the marketplace draft. Saved only scoped Loadgistic
last-ANR diagnostics in `.local/mobile-area-anr.txt`; no credential/customer data
was queried. Do not label this a passed device check or infer a proven single cause.
The capacity screen unnecessarily rendered its native map on each draft keystroke;
map props/callbacks are now stable and its component memoized without changing
coverage or UI. Cold-start and ordinary-input area switching must pass; retain
rapid-input/native stability as a release check. Only com.loadgistic.app on
Loadgistic_Pixel_API_35 was restarted, preserving its saved local session.

Web preview evidence: `.local/drawer-reselect.log` has 4/4 desktop/phone passes
for repeated selection, results/search/scroll restoration and Clear all. Loading,
location denial and failed-refresh retry passed both sizes in
`.local/drawer-regressions.log`; overlap clicks/taps and keyboard activation passed
both sizes after the hover correction in `.local/drawer-hover-fix.log`. The map-key,
location and gesture tests passed both sizes in `.local/drawer-final.log`; that
mixed run also caught the selected marker's missing re-open handler, fixed and
rechecked in `drawer-reselect.log`. A desktop Clear all timeout under concurrent
local load passed its controlled isolated retry without weakening assertions.
Review images: `.local/web-truck-details-desktop.png` and
`.local/web-truck-details-mobile.png`. Web server remains on port 3100.

17 focused native tests pass (navigation roles, deep links, route grouping,
translations, native text safety); native/root typechecks and native lint passed.
Android ordinary-input/draft and Back verification remains incomplete after ANR
and UIAutomator timeouts; the isolated AVD is being rebooted. Do not mark the mobile
slice released, owner-approved, or installable independently of Metro. Visual
review was requested for the concrete area switch and web drawer; no remote work.

Device recovery follow-up: the rebooted Loadgistic_Pixel_API_35 had Wi-Fi enabled
but disconnected, no IP route, and reported Network is unreachable for the local
API host. Reconnected its built-in AndroidWifi using the verified emulator serial;
status confirms connection/IP. Android System UI also presented an ANR dialog.
After dismissing Wait and reopening Loadgistic, a fresh UIAutomator dump still
failed, so no coordinates from an old dump were reused and the ordinary-input
area/draft/Back test remains unverified. This is not proof of a navigation-code
failure or proof that networking caused the ANR. Continue from device stability,
not another broad code rewrite. No global SDK/network settings were changed.
Spec validation passes (33 specs/30 features), and git diff --check passes.

## October 6 — on-demand map information (active owner revision)

The owner rejected the automatically opened truck detail area because it hides
signal geometry, and requested one shared compact popup for truck and signal info
on all screen sizes. This supersedes the unapproved drawer presentation above.
1. [x] Record revised FEAT-CAP-001/FEAT-MOB-001 acceptance before implementation.
2. [x] Web: selected geometry first, side info controls, single colored compact popup,
   preserve results, profile/contact/documents and map gestures.
3. [x] Native implementation: same interaction, no permanent truck sheet, privacy-safe info reset; typecheck/lint pass, device verification remains open.
4. [ ] Focused logic/interaction checks and desktop/phone/native captures.
5. [ ] Owner visual review; extensive gates/deployment are subsequent steps.

Side-control refinement: owner said speech balloons look conversational and asked
for research/side placement. The current comparison uses labeled white side
controls (Truck, Location, Capacity, Regular service), color accents and ellipses,
without tails. ArcGIS documents mobile edge-docking; see docs/DECISIONS.md for
sources and our design inference. Selection itself opens no card. One shared card
changes content/color, preserves map camera, and closes independently of selection.
Native hardware Back is scoped to the focused map screen and closes that card.

Web side-control/shared-leg checks pass 4/4 (.local/map-side-final.log); native
checks pass (types/lint and 11 focused tests). Screen captures are
.local/map-side-controls-{mobile,desktop}.png and .local/map-side-info-{mobile,desktop}.png.
The older bubble test failures included cold hydration and stale layout assertions;
the shared-leg test additionally measured during map inertia. Those corrections
retain stroke-separation and real hit-testing assertions. Final feedback/area checks
are tracked in .local/map-side-feedback.log. No full release gate has run.

Native device limit persists after one isolated emulator cold restart with automatic
GPU selection: repeat app ANR, OSM DNS errors and external-storage transport errors.
Kept fresh hierarchy validation and used /data/local/tmp for the test-owned dump;
subsequent dumps still timed out. Stopped only Loadgistic_Pixel_API_35, preserving
its data, with Next 3100 and Metro 8083 left running. Native visual approval/device
verification and the full application/APK remain incomplete. Do not claim this
screen device-tested on the basis of typechecking or the web captures.

Final focused verification: .local/map-side-feedback.log passes 4/4 desktop/phone
feedback/retry and coincident closed-area/route cases. Combined with the 4/4
side-control/shared-leg cases, all eight focused final browser cases pass. Root
and native typechecks, native lint, 11 native tests, spec validation and whitespace
checks pass. Owner review of the side placement and native device verification
remain open; no deployment or full release gate.


## Final local API, copy and bundle checks — October 6

The extended API walkthrough passes against disposable local accounts:
private photo proof upload/readback and cross-owner/revocation denial; owner-only
correction/reassignment/cancellation; visitor OTP/replay/scope/renewal; customer
review; driver permissions, approximate travel location, onboarding, assignments,
Off Duty, fleet lifecycle and logout revocation. Evidence: `.local/mobile-api-final.log`.

Filled 192 missing fixed workflow messages and additional dynamic login, tracking
and document labels in Amharic, Afaan Oromo, Somali and Tigrinya. The explicit
catalogue audit passes 382/382; record names, descriptions, notes and contacts
remain data. Four-language browser sign-in actions pass without overflow or
exceptions (`.local/mobile-languages-browser-final.log`); captures are
`.local/mobile-language-{am,om,so,ti}.png`. Placeholder/date/confirmation literals
are regression-tested. This is copy and layout evidence, not a native-speaker review.

The final Android JS/Hermes bundle exports successfully and includes the patched
URI decoder consumer and current copy. It is not a signed APK or device test.
Remaining build-tool findings have a bounded internal-build disposition and
fail-closed gate; see MOBILE_DEPENDENCY_REVIEW.md. EAS project binding, final archive
review, signing, deployed API checks and owner phone installation remain open.


## Expo binding and final SDK candidate — October 6

Created only `@falmatad/loadgistic`; independently verified ID
`a2d7e0a9-2fe4-4188-804e-40d8c3486ac7` and Android package `com.loadgistic.app`.
No other Expo project was linked or changed. EAS initialization added the project
binding and empty Router metadata; duplicate normalized permission entries were
removed after proving the requested permission set was unchanged. Receipts:
`.local/mobile-expo-{init-result,project-verified}.json`.

Applied only Doctor's four SDK patch updates; compatibility now passes 21/21,
mobile lint/typecheck and 84 tests pass. The final Android runtime exports with
current copy and patched decoder. Raw audit and bounded tooling review remain
visible. Added a CI job for native types/lint/tests, language coverage, actual
Android bundle exposure and unknown-advisory rejection. No signing/build upload,
APK installation or store publication has occurred yet.

### Physical-only layout defects found — October 6

Android collapsed the logo's flex shorthand despite the browser-tested override,
so the workspace name overlapped it. The header now uses explicit grow/shrink/basis
and a bounded 36px member-logo slot. Native search omitted ink/hint colors and was
invisible under the phone's theme; explicit approved colors restore the intended
placeholder. These source fixes need fresh native bounds/screenshot verification
once USB returns; do not count earlier browser evidence as native verification.

Use `exp+loadgistic://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083`
for this dev client. `loadgistic://expo-development-client/...` is not the allowed
bootstrap scheme and was correctly rejected by the native link guard. Do not
weaken that guard to accept an incorrect launcher URI. Wait for an actual initial
UI before a second launcher intent. Native Metro uses command-scoped IPv4 DNS
selection on 8083; the separate web preview on localhost:8084 stays running.
