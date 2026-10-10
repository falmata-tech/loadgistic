# Loadgistic Google Play setup

Updated October 10, 2026. Verified owner marketvision.tech@gmail.com, developer
`5256539403314542898`, app `4974969611761012361`, package `com.loadgistic.app`.
[Console dashboard](https://play.google.com/console/u/2/developers/5256539403314542898/app/4974969611761012361/app-dashboard).

## Test install available now

On your Android phone:

1. Open https://play.google.com/apps/internaltest/4700942405023499701.
2. Choose **falmatad97@gmail.com** or **marketvision.tech@gmail.com** as the Google
   account. Those are the only two accounts currently on the owner tester list.
3. Join the test and follow **Download it on Google Play** to install.
4. Google may show **com.loadgistic.app (unreviewed)** until listing/setup/review
   finish. Verify **1.0.3 / version code 4**; the app uses https://loadgistic.com.

Google uses a different app-signing certificate from the Expo sideload APK. Use a
phone without the sideload version for this Play install. Do not force an update
by uninstalling or clearing existing data; decide any installation switch separately.
The [Expo APK](https://expo.dev/accounts/falmatad/projects/loadgistic/builds/9169da7e-dd2f-40b1-87b0-53fee20e3b56)
remains a separate signed test download. If your phone already has the earlier
Expo APK, this new code-4 APK retains its signer and can be used for a normal
in-place test update. That direct APK test does not count as Play closed enrollment.

## What is actually completed

| Item | Verified state |
| --- | --- |
| Web/backend | Runtime 9feab2d, Netlify 6ac99d110f1f577818c9f7c9, ledger 136, 80 live checks; CI 38012117505 at 068ac35 passes all eight jobs |
| Android artifacts | APK 9169da7e-dd2f-40b1-87b0-53fee20e3b56; AAB edd8cf91-446d-477e-8bb4-e00946fa7a57; 1.0.3/code 4, existing native source 986d07d |
| Expo/Google access | Dedicated publisher Active, Admin on Loadgistic only, zero account-wide grants; exact EAS Submit key connected; FCM/signing unchanged |
| Internal release | Submission 066f028f-0cb0-4286-9830-40815264e11e FINISHED; track 4700942405023499701/release 1 Active, available to internal testers, Not reviewed |
| Signing | Existing Google-managed signer In use; uploaded certificate matches the EAS signer; no signing change/private export |
| Private reviewer access | Three normal-auth synthetic entries saved only in Google's App access form; no staff powers/customer data or public credentials |
| Policy metadata | Privacy, ads/ad-ID, government, financial, health, adult audience, IARC and Data safety saved, not submitted for Google review |
| Rating | Everyone / PEGI 3; Users Interact and Shares Location; professional target audience stays 18+ |
| Data safety | 16 inspected types, HTTPS and live deletion link; optional guest/manual data; service-provider/user-directed transfers use documented Google exceptions |
| Listing | English copy, existing icon/feature graphic and two unmodified code-4 native screenshots saved as Draft; AI-label decision pending |
| Category/contact | App / Business saved; approved marketvision.tech@gmail.com and https://loadgistic.com contact metadata published; phone blank |
| Closed Alpha | 4699446366767369053/release 1, 1.0.3 (4) — closed test, Draft; existing bundle reused, separate 10-address Loadgistic closed testers list and Ethiopia/US eligibility saved |

Exact AAB: `.local/loadgistic-1.0.3-play-internal.aab`, 92,044,826 bytes,
SHA-256 `c63607fbef7bc7aa08ce9eaca3d80c89b7eb51ce002ac9d1f2378729e4a1a6ef`.
APK: `.local/loadgistic-1.0.3-android.apk`, 153,576,371 bytes,
SHA-256 `2a6d6c9354ed0ccd7ce4e29a43bc4d7ae65fed37917f4cfd0aa0ea9fbbb60b73`.
Manifest/signature/secret/production-origin and 16 KB structural checks pass;
physical 16 KB, closed-phone alerts and moving/background GPS acceptance remain
separate. Do not submit historical code 3 or reupload code 4.

## Remaining closed-test prerequisites

The owner delegates completion independently while busy. Keep the prepared Alpha
release as Draft until the following evidence exists; public-production Play
publication and customer erasure are outside this delegation.

1. **Artwork decision:** the exact question about labeling the prepared feature
   graphic as AI-assisted is pending. Automatic approval review rejected that
   declaration because recorded provenance did not explicitly establish AI
   involvement. The two real screenshots are unmodified. Do not select another
   label merely to bypass the rejection. See the actual asset draft/owner question.
2. **Android permission video:** Google requires a real walkthrough for background
   location and the location foreground service. The exact 293-character purpose
   and 471-character shipment feature are prepared in protected
   `.local/play-20261010-location-permission-plan.json`. The selected service case
   is user-initiated location sharing. No invented/public placeholder video URL is
   entered. Neither form is claimed complete.
3. **Real testers:** the owner's ten unique Google-account addresses are saved in
   **Loadgistic closed testers**, selected only for Alpha. A reload confirms the
   exact count and selection; the separate two-account internal owner list remains
   unchanged. Two more actual testers are needed. This app's Dashboard requires
   at least 12 testers continuously opted in for 14 days; currently 0 are opted in.
   Eligibility is not enrollment. No invitation email was sent; contact details
   stay in protected ignored files, not Git. Gmail aliases do not establish
   distinct participants.
4. **Google review and enrollment:** complete the missing declarations/listing,
   preview the prepared Alpha release and send the exact test release for Google
   review. After approval/availability, share its actual opt-in link with the
   selected testers and verify continuous enrollment. No closed-test clock has
   started. Internal testing does not count toward that requirement.

[Closed-testing requirement](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en),
[background-location declaration](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en),
[foreground-service declaration](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en),
[AI asset guidance](https://support.google.com/googleplay/android-developer/answer/17262077?hl=en).

For the video, sign into the synthetic **Assigned company driver demo** through
**Menu → About → Review access** first; private credentials stay in
`.local/play-policy-reviewer-credentials.json`, not this file, screenshots or
release notes. Use only its existing synthetic agreed shipment. Start the screen
recording before the shipment-location disclosure, show **Agree and continue**,
the actual Android permission flow, active Tracking/foreground notification and
an obscured location update. Do not record passwords/codes/customer records.
Google recommends a short video around 30 seconds; host it on an accessible
public/unlisted YouTube URL only after checking the actual footage. If no agreed
shipment is available, stop and inspect the demo scope rather than create a real
shipment, bypass permissions or fake a screenshot.

The owned Loadgistic_Pixel_API_35/emulator-5580 runs code 4/public Capacity, but
October 10 screenshot evidence confirms **System UI isn't responding**. One
bounded recovery failed; only that emulator was stopped with app/data preserved.
No actual disclosure/permission/active-Tracking video was obtained. A phone test
through Play needs no USB debugging; USB is optional for agent-assisted capture.
Local previews remain http://127.0.0.1:3100 and http://localhost:8084.

Sanitized protected receipts: `.local/play-20261010-submit-receipt.json`,
`internal-rollout-receipt.json`, `alpha-setup-receipt.json`, `content-rating-receipt.json`,
`data-safety-plan.json`, `store-listing-receipt.json`, `store-settings-receipt.json`,
`signing-state.json` and `android-policy-attempt.json` (all use the same
`.local/play-20261010-` prefix). Never put private key/password/OTP bytes in source,
builds or logs. The publisher key remains `.local/google-play-publisher.json`;
Firebase's notification key is a separate unchanged credential.

The following reference/build sections preserve earlier preparation. Their
unverified checkpoint statements are historical; this current table controls.

## Build target and signing decision

| Field | Reviewed value |
| --- | --- |
| Application | Loadgistic / `@loadgistic/mobile` |
| EAS target | `falmatad/loadgistic` |
| EAS project ID | `a2d7e0a9-2fe4-4188-804e-40d8c3486ac7` |
| Android package | `com.loadgistic.app` |
| Version / Android version code | `1.0.3` / `4` |
| Build profile | `play-internal` |
| Profile resolution | Extends `preview`; overrides distribution to `store` and Android build type to `app-bundle`; inherits `EXPO_PUBLIC_API_URL=https://loadgistic.com` |
| Existing signed APK SDK | Target 36; minimum 24 |

The profile is in [eas.json](../../apps/mobile/eas.json); identifiers and local
versioning are in [app.json](../../apps/mobile/app.json). `store` selects an AAB
build format and does not publish to a Play track. Verify the active Expo account,
project ID and reviewed upload exclusions before the authorized build:

```sh
cd /Users/falmata/Desktop/Dev/loadgistic/apps/mobile
npx eas-cli@24.10.0 build --platform android --profile play-internal
```

Do not add `--auto-submit`. After completion, verify the immutable build/source,
package, version, code, public certificate and artifact hash before upload. Code 4
is already uploaded. Reuse it only from the existing library; a new upload needs
a new version code and new exact-artifact verification.
[Expo build configuration](https://docs.expo.dev/eas/json/),
[Android submission](https://docs.expo.dev/submit/android/).

Existing EAS APK signing-certificate SHA-256:

```text
26b7c6afc5afe0cd1a721e4e2914e1ffbb57c41ffe2ac1328d1ee125c965c5fd
```

Google's existing managed app signer is verified after the code-4 upload:

```text
01ea001212e81c126fa41acd864eabdf0a35663a65fc0b6f41ac7a2e47570124
```

The retained EAS/upload signer above matches Google's uploaded certificate.
The different Play app signer does not preserve in-place updates over the current
sideload APK. No key/import/export/reset occurred. Do not uninstall or clear app
data to force an update. Existing sideload testers need a separately chosen
installation switch or another device; private signing material stays untouched.
[Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en).

## Owner-requested remote submission through Expo

The owner subsequently requested agent-operated remote submission through Expo.
`submit.play-internal` is constrained to Android's internal track and draft
release status, with changesNotSentForReview true; it contains no key bytes/path
and does not roll out a public app.
After the exact AAB and owner Console app/signing are verified, submission selects
its **specific build ID**, never `--latest` or an automatic submission on every
build/push. Check the actual provider result before retrying an ambiguous request.

EAS metadata confirms the dedicated Play submission binding is assigned while
FCM remains assigned to its original Firebase credential. The current specific bundle
build is edd8cf91-446d-477e-8bb4-e00946fa7a57 (runtime source 986d07d); its final
artifact inspection passes; the exact file/hash is recorded above. The owner uses
the existing **loadgistic-f082a** Cloud project with a separate
`loadgistic-play-publisher` service account. No Cloud IAM role was required or
changed by the agent. Google Play Android Developer API is enabled.
The owner explicitly selected temporary
**app-level Admin for Loadgistic only**, connecting the key to Expo's Submit field
for com.loadgistic.app. Firebase FCM remains a separate unchanged credential.

The owner has created the Console entry and supplied the dedicated publishing
key, which is now assigned in EAS's Android `com.loadgistic.app` **Google service
account key for EAS Submit** setting. Android Developer API enablement and
app-only access are complete. Remaining: enroll/verify its signing path before
actual submission.
The existing Firebase FCM binding is unchanged.
The protected key remains outside source, app environments, build uploads and logs.

The existing Expo login can operate this app with the publishing credential
connected. Play Console app-only permission is verified through the owner's
explicitly delegated Chrome session; no new connector was required.
For the new policy release, select only immutable build
`edd8cf91-446d-477e-8bb4-e00946fa7a57` after the matching rollout gates pass.
Never submit the historical code-3 ID as this release or select `--latest`.

The initial limited-publisher proposal has been superseded by the owner's
October 9 app-level Admin decision. Select **App permissions → Loadgistic → Admin
(all permissions)**, leaving Account permissions empty. This credential can
perform production actions technically; the current authorized workflow is test
launch/setup, not public publication. After setup, reduce it to the actual
release/testing, tester-list, store-presence and policy permissions needed.
[Google permission definitions](https://support.google.com/googleplay/android-developer/answer/9844686?hl=en).

There is an initial-upload documentation conflict: Google's Edits guide still
requires a first Console artifact; current Expo documentation supports automated
first internal release after the app exists. A package-not-found/uninitialized-app
response requires owner Console initialization with the prepared bundle, not
broader permissions. Do not promise zero initial manual upload or upload the
same already-consumed version again.
[Google Edits limitation](https://developers.google.com/android-publisher/edits),
[Expo first submission](https://docs.expo.dev/submit/android/#first-time-submission).

Account-wide Admin and unrelated apps remain outside scope. Initial app-level
Admin is owner-authorized; inspect exact API errors without broadening account
access or changing signing/keys as a retry. Signing enrollment and actual update
compatibility still require verification. Tester enrollment and test-track
rollout are separate from draft submission; upload alone is not availability.
[Expo prerequisites/submission](https://docs.expo.dev/submit/android/),
[Service-account setup](https://github.com/expo/fyi/blob/main/creating-google-service-account.md).

## Owner console steps for the first internal test

1. Sign in as **marketvision.tech@gmail.com** and open the already-created
   **Loadgistic** entry (developer 5256539403314542898 / app 4974969611761012361).
   Keep **App / Free / English (United States)**. Do not create another app.
   Package identity must match the reviewed `com.loadgistic.app` bundle.
2. Review **Play App Signing / App integrity** and make the signing decision
   above before releasing. Console labels may vary. Retain the selected public
   signing and upload certificates; keep private material in the owner-controlled
   credential workflow.
3. Open **Testing → Internal testing → Create release**. Upload only the final
   verified new `.aab`, confirm `com.loadgistic.app`, `1.0.3`, code `4`, and inspect
   every console error or required declaration. Save a draft with the release
   notes below. An APK download from Expo is not this AAB.
4. In **Testers**, create an owner-controlled list of up to **100 Google-account
   or Google Workspace testers**, select that list and save it. After reviewing
   and approving the internal release, roll it out to that track and copy its
   opt-in link. Testers must join with an allowed account. The first test link can
   take several hours to become available; it is not a public searchable launch.
   For the owner's 14-day goal, then open **Testing → Closed testing**, verify
   the actual track name, and promote/reuse this same uploaded version there.
   Do not upload code 4 twice. Enroll at least 12 distinct Google-account testers,
   roll out the closed release after its required declarations/review, and share
   that track's opt-in link. The clock starts with actual continuous closed-test
   enrollment, not the Expo APK, an internal draft or key setup.
5. Verify an actual Play installation and the selected signing/update path,
   account-free capacity, authenticated workspaces, denied permissions, Tracking
   and optional alerts. Record the release/build ID and actual phone results;
   preserve pending physical-phone acceptance instead of treating provider
   delivery receipts or emulator startup as proof of every workflow.

Manual console upload avoids introducing a Play submission service-account key.
Expo also supports automated first submission; manual first upload is optional.
[Expo manual upload](https://docs.expo.dev/submit/android-manual/),
[Google testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

For a **personal developer account created after November 13, 2023**, production
access requires a closed test with at least **12 testers continuously opted in
for 14 days**, followed by an application for production access. Internal testing
does not satisfy that requirement. Confirm the owner's account type and creation
date. A tester moving from internal to closed testing must first opt out of the
internal test, then join the closed test.
[Personal-account requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en),
[Track enrollment](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

## Draft English listing and release notes

Copy is prepared for owner review, not submitted. Current release behavior and
evidence are recorded in [FEAT-PLY-001](../../specs/features/FEAT-PLY-001.md) and
[MOBILE_IMPLEMENTATION.md](../MOBILE_IMPLEMENTATION.md). Older master-prompt
claims need reconciliation; see WEB-MOB-018.

**Name — 10 / 30 characters**

```text
Loadgistic
```

**Short description — 59 / 80 characters**

```text
Discover truck capacity and share private shipment updates.
```

**Full description — 1088 / 4,000 characters**

```text
Loadgistic helps fleets and independent drivers share available truck capacity with known brokers, shippers and receivers or the open market.

Browse public transport capacity without an account. Filter by truck and available space, view approximate service areas, and contact transporters directly. Availability and location can change; confirm details with the transporter.

Transporters can manage their trucks, share capacity privately with named contacts, and keep agreed customers informed through private shipment Tracking. Fleets manage their trucks and drivers; independent drivers work with one current truck.

Need transport? Chat with Loadgistic's transport team to discuss your route and get help arranging the shipment.

For agreed shipments, drivers can share an approximate location with permission, including background updates until unloading is approved. Optional Android alerts support chat and Tracking updates.

Optional document review helps people assess providers and is not a service guarantee. Loadgistic does not publish shipment demand or handle transactions.
```

**Release name:** `1.0.3 (4) — test release`

**English release notes**

```text
Internal testing build for Loadgistic.
Explore truck capacity maps and filters.
Share capacity privately with named contacts.
Follow shared shipments after email verification.
Use fleet or independent-driver workspaces.
Try optional Android alerts for chat and Tracking updates.
```

Before publishing a full listing, prepare a **512 × 512 PNG icon**, a
**1024 × 500 JPEG or opaque PNG feature graphic**, and at least **two actual-app
screenshots** meeting Google's size/format requirements. Screenshots must depict
the current app and approved content. The owner must supply/confirm the support
email, developer contact, category, target audience, countries, pricing, content
rating and advertising answers; no values are presumed here.
[Listing fields](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en),
[Asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).

## Historical code-3 Data Safety inventory — superseded policy gaps

The following records the pre-policy code-3 inspection. Its deletion, disclosure,
reviewer and CAMERA gaps are superseded by the code-4 implementation below; do
not copy those obsolete claims into Console. The current declaration draft is
`.local/play-policy-data-safety-review.json` and still needs owner attestation.
Apps
exclusively on the internal track are exempt from the Data Safety form. Closed,
open and production tracks require it. Collection includes SDK transmission off
the device; ephemeral processing still belongs in form responses. Service-provider
and user-directed sharing exceptions need verified facts, not assumptions.
[Google Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

| Candidate declaration | Evidence in current source | Owner review still required |
| --- | --- | --- |
| Personal info: name, email, phone, user IDs | Login/onboarding and account editing in `apps/mobile/src/screens/account.tsx` and `account-details.tsx`; private sharing/Tracking uses recipient emails. | Confirm required versus optional collection across roles and purposes; distinguish private contacts from deliberately published business contacts. |
| Approximate location | `src/location/privacy.ts`, `capture.ts` and `background-task.native.ts` obscure coordinates before API transmission; nearby search uses an obscured point. | Confirm SDK/provider collection, background use, retention and authorized recipient sharing. Nearby requests are not presumed ephemeral in provider logs. |
| Precise device location | Expo Location obtains a precise fix on-device; the reviewed application sends obscured coordinates. | Verify every SDK/provider path before declaring precise location uncollected. A permission alone is not proof of off-device collection. |
| Photos; files/documents | `src/components/private-file.tsx` uses the system picker and upload API for images/PDFs; driver/profile uploads are present. | Inventory optional proof/identity documents and any other personal info intentionally collected in them; state access, retention and deletion accurately. |
| Other in-app messages | Support and assisted-transport chat send and retain messages through the mobile APIs. | Confirm purposes, retention, provider processing and any recipient-sharing classification. |
| App activity / other user-generated content | Shipment statuses, reviews, capacity changes and explicit Seen acknowledgments are persisted. | Map exact fields and purposes; do not claim a separate analytics product from this evidence. |
| Device or other IDs | `src/session/native-push.ts` creates an installation ID, obtains an Expo token and registers it with the backend; background Tracking uses a device identifier. | Confirm optionality, linked identity, Expo/FCM handling, revocation and retention. |
| Security practices | `src/api/http.ts` requires HTTPS for installed releases; account sessions/device secrets use SecureStore. | Validate complete provider/SDK transport practices. HTTPS is not a claim of end-to-end encryption. |
| Advertising | `src/screens/featured.tsx` renders Sponsored cards; no advertising-ID/analytics SDK was identified in the reviewed dependency list. | Owner must classify the actual sponsorship arrangement and answer the ads declaration. Absence of an ad SDK does not establish “no ads.” |
| Account/data deletion | `src/screens/account-security.tsx` offers verified deactivation and explicitly retains history. | A deletion request/fulfillment path and justified retention policy are missing; do not declare deactivation to be deletion. |

Paths abbreviated as `src/...` in this table are under `apps/mobile/`.
The reviewed APK contains background/coarse/fine location, location foreground
service, camera and notification permissions. Modern broad photo/video access
and microphone recording are blocked. No active camera API call was identified;
CAMERA is nevertheless in the signed manifest. Reinspect the final AAB's merged
manifest and its SDK data flows before answering declarations.

## Historical code-3 gaps before broader review

- **Deletion and retention:** the app creates accounts but only supports
  retained-history deactivation. Google requires a discoverable in-app and web
  account/data deletion request path. Any legitimate retention needs an explicit
  scope and disclosure. This is a separate spec/owner decision, not authority to
  erase shipment history or change production Auth.
  [Deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en),
  [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- **Privacy and background location:** `https://loadgistic.com/privacy` exists
  and is linked from native About, but needs native background collection,
  retention/deletion and responsible contact coverage. `BackgroundTracking`
  currently requests permissions after a brief banner; no prominent pre-permission
  disclosure dialog explaining collection while closed was found. Background
  location and the location foreground service need accurate declarations and an
  actual Android demonstration video. Preserve the agreed Tracking behavior while
  resolving this review gap.
  [Background-location requirements](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en),
  [Foreground-service declarations](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en).
- **Reviewer access:** current production login uses expiring email codes;
  Google requires continuously accessible, reusable review credentials. The owner
  must select a reviewed access solution. This preparation does not authorize
  removing production OTP checks or exposing fixture login.
  [Review access requirements](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en).
- **16 KB runtime compatibility:** the existing signed code-3 APK has 25 ARM64
  shared libraries. All 76 ELF LOAD segments pass 16 KB alignment, all 25
  uncompressed library ZIP payloads are 16 KB aligned, and SDK Build-Tools 36
  `zipalign -c -P 16 -v 4` passes. However, **23/25 libraries fail Google's current
  GNU_RELRO end-alignment formula**; installed `llvm-readelf` independently
  confirms the headers. A second review of Android's actual linker found all
  25 libraries use its safe whole-LOAD RELRO case: same start address and LOAD
  memory size no greater than RELRO's; the following mutable LOAD also begins
  outside the rounded RELRO page. The endpoint-only formula is therefore not
  evidence of a compatibility defect in this artifact. Do not remove RELRO or
  upgrade dependencies to repair that false positive. Structural success does
  **not** replace actual 16 KB runtime testing.
  Verify the final AAB requests `PAGE_ALIGNMENT_16K`, inspect its generated APKs
  for ELF/RELRO/ZIP alignment, and test the actual runtime on a 16 KB device.
  Google's current guidance requires support for 64-bit apps targeting API 35+
  and lists February 1, 2027 as update enforcement. The final AAB now independently passes its 25 ARM64 structural checks,
  signature, manifest and PAGE_ALIGNMENT_16K; actual 16 KB runtime remains pending.
  [16 KB requirements and checks](https://developer.android.com/guide/practices/page-sizes),
  [Read-only ZIP check](https://developer.android.com/tools/zipalign),
  [AOSP RELRO handling](https://android.googlesource.com/platform/bionic/+/android16-qpr2-release/linker/linker_phdr_16kib_compat.cpp).

The existing APK targets API 36, satisfying the current new-app target SDK
minimum. That single gate does not establish Play acceptance.
[Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).


## Current policy implementation — deployed and verified

FEAT-PLY-001 adds explicit location disclosure consent, real verified-email
account/data deletion, reporting/blocking and persisted moderation, account-bound
content-policy acceptance and registered synthetic reviewer access. The owner
approved the demo-only strategy and marketvision.tech@gmail.com contact. Six
policy SQL suites, four focused phone workflows and 24 new focused tests pass;
all 496 explicit native messages and shared policy controls have translations.
Migration 136 additionally protects the separate public truck map/search reads;
a profile-only hide does not close those signal projections.

The mobile reviewer test uses a real synthetic shipment and private capacity,
normal authentication and live revocation checks. The three approved private
hosted reviewers pass normal login and scope verification; their reusable
credentials remain only in the protected local credentials file. The browser
location view is informational; it is not evidence
of Android's pre-permission dialog, closed-phone tracking or the required video.

The owner approved these screens on October 9. Full local quality 488/488,
native 127/127, Doctor 21/21, all 52 SQL suites, affected phone workflows, actual
web/Android builds and the 5,000-truck gate pass. Protected fresh backup restores
without networking; exact SQL 131–136 and security/spatial checks rehearse.
All eight exact-source CI jobs pass at 068ac35. Approved SQL 131–136 and the
matching web release are deployed, and all 80 live checks pass. Signed
1.0.3/code-4 APK/AAB are verified. The installed native Privacy and public Capacity
screens render against the live backend, with actual 1080 × 2160 captures.
Physical-device acceptance and Console setup remain pending. Prior signing/upload
exclusions remain; the historical code-3 APK/AAB is unchanged.

Data Safety inventory is `.local/play-policy-data-safety-review.json`, a draft
requiring Console attestation. Declare inspected data, not only permission names:
smaller obscured grid cells can still meet Google's precise-location definition.
There is no analytics/advertising SDK or digital subscription purchase flow.
Assess any displayed sponsorship content for the Contains ads declaration.

Remaining manual Console work:
1. Open this document's owner-reported app dashboard. Do not create another app
   or change package com.loadgistic.app. Keep App / Free / English (United States).
2. Complete the deliberate signing choice above. Use the new verified AAB for
   any required first Console initialization, not the old policy-incomplete file.
3. Completed October 10: the separate app-scoped EAS Submit service account is
   connected for internal/draft uploads. Firebase notification credentials stay
   unchanged. The approved temporary Loadgistic app-only Admin role is verified;
   account-wide access and public production rollout remain outside scope.
4. In App content, enter the published privacy and deletion URLs, the supplied
   reusable demo review credentials, inspected Data Safety/content-rating answers
   and the actual Android background-location/foreground-service video.
5. Finish the store listing with approved assets and exact-release screenshots.
   Configure internal testers and explicitly roll out that test release; a draft
   upload alone is not downloadable from Play.
6. Confirm account type. New personal accounts may require the separate 12-tester,
   14-day closed test before production access; internal testing does not replace
   it. No public rollout is implied by any of these steps.

Primary references: [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en),
[background location](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en),
[reviewer access](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en),
[user-generated content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en),
[Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en),
[closed testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en),
[Firebase opt-in](https://firebase.google.com/docs/cloud-messaging/android/get-started).
