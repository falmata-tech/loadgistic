# Loadgistic Google Play setup

Prepared October 9, 2026. The owner reports the new Loadgistic Play entry under
marketvision.tech@gmail.com: developer `5256539403314542898`, app
`4974969611761012361`, [Console dashboard](https://play.google.com/console/u/2/developers/5256539403314542898/app/4974969611761012361/app-dashboard).
This is owner-reported; the authenticated dashboard is not accessible through the
read-only web tool. It does not change the application's administrator account.
This handoff prepares an internal test. The signed AAB is prepared and verified; developer-account identity,
Play signing enrollment, bundle upload, tester access and publication remain
unverified because the required publishing connection is not assigned. A fresh
15:19 UTC metadata check still finds no EAS Submit credential, with the existing
FCM binding intact. The owner has now requested implementation of remaining
policy workflows; follow FEAT-PLY-001 and MOBILE_IMPLEMENTATION's ordered checklist.
Current Android acceptance and limits are in [MOBILE_IMPLEMENTATION.md](../MOBILE_IMPLEMENTATION.md).

**Baseline artifact only:** this code-3 bundle does not contain the new Play policy
workflows. Do not use it for the requested policy release. A new exact signed
binary and matching hosted backend are required after review and gates.

Verified baseline bundle: `.local/loadgistic-1.0.2-play-internal.aab` (92,015,378 bytes).
Expo build `b111a2a2-a3b5-4cea-92a2-735d8962d944`, immutable source `ae8baba`,
version 1.0.2/code 3, com.loadgistic.app, https://loadgistic.com. SHA-256:
`21d57be058bb6f2a874df20bdfaae5b668058c4f21f47166a25a2a6d99327082`.
Signature matches the existing APK; bundletool validation/manifest, API 36/min 24,
release non-debuggable/HTTPS, PAGE_ALIGNMENT_16K, all 25 ARM64 LOAD/RELRO layouts,
Hermes/prod-origin and forbidden secret/development payload checks pass. Actual
16 KB-phone runtime acceptance remains separate. No Google Play upload occurred.
Protected final receipts: `.local/play-20261009-artifact-evidence.json` and
`.local/play-20261009-aab-verification.json`. Current owner-approved icon and
actual-app screenshots are copied under `.local/play-20261009-store-assets/`.

## Build target and signing decision

| Field | Reviewed value |
| --- | --- |
| Application | Loadgistic / `@loadgistic/mobile` |
| EAS target | `falmatad/loadgistic` |
| EAS project ID | `a2d7e0a9-2fe4-4188-804e-40d8c3486ac7` |
| Android package | `com.loadgistic.app` |
| Version / Android version code | `1.0.2` / `3` |
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
package, version, code, public certificate and artifact hash before upload. Code 3
must remain unused in Play; subsequent uploads require a new version code.
[Expo build configuration](https://docs.expo.dev/eas/json/),
[Android submission](https://docs.expo.dev/submit/android/).

Existing EAS APK signing-certificate SHA-256:

```text
26b7c6afc5afe0cd1a721e4e2914e1ffbb57c41ffe2ac1328d1ee125c965c5fd
```

The owner must deliberately choose the supported Play signing path. Importing
the existing app-signing key through Google's supported owner-controlled process
can preserve signing continuity with the current APK. A Google-generated Play
app-signing key differs from that APK's signer; it does not provide the same
in-place update path for existing sideloaded installations. The upload key and
Play app-signing key have different roles. Do not uninstall or clear app data to
force an update. The agent must not download private keys or change signing
credentials as part of this preparation. Record the chosen signer and test its
update path before distributing to current APK testers.
[Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en).

## Owner-requested remote submission through Expo

The owner subsequently requested agent-operated remote submission through Expo.
`submit.play-internal` is constrained to Android's internal track and draft
release status, with changesNotSentForReview true; it contains no key bytes/path
and does not roll out a public app.
After the exact AAB and owner Console app/signing are verified, submission selects
its **specific build ID**, never `--latest` or an automatic submission on every
build/push. Check the actual provider result before retrying an ambiguous request.

Read-only EAS metadata confirms the Play submission binding is absent while
FCM remains assigned to Firebase loadgistic-f082a. The current specific bundle
build is b111a2a2-a3b5-4cea-92a2-735d8962d944 (source ae8baba); its final artifact
inspection now passes; the exact file/hash is recorded above. Owner-facing setup uses these exact destinations:
Google Cloud project loadgistic-f082a, dedicated loadgistic-play-submit service
account without project IAM roles, Android Developer API, Play app-only draft/
testing permissions and Expo's Submit credential field for com.loadgistic.app.

The owner has created the Console entry. Remaining owner connection: enroll its signing path, create a dedicated publishing service account, enable
the Android Developer API, grant that account access only to this Play app, and
assign its key in EAS's Android `com.loadgistic.app` **Google service account key
for EAS Submit** setting. The existing Firebase FCM binding remains unchanged.
No Play publishing key is currently verified. Use the Expo dashboard to upload
private material directly; never copy it into source, app environment or chat.

The existing Expo login can operate this app once the publishing credential is
connected. There is no verified Play Console connection or CLI Google login in
this workspace, and plugin discovery found no suitable publishing connector.
For the new policy release, record its newly verified immutable build ID here
before producing the submission command. Never submit the historical code-3 ID
as if it contains the new workflows, and never select `--latest`.

For this first draft, select App permissions for Loadgistic only: View app
information (read-only), Edit and delete draft apps, Release apps to testing
tracks. Testing release covers draft uploads; tester-list management is separate.
Google publishes no per-endpoint proof that draft-edit permission is additionally
mandatory, so retain the exact permission/error evidence rather than assuming all
Expo FYI permissions are needed. A testing publisher can roll out testing tracks;
it is not provider-enforced draft-only authority. Our selected profile binds
internal/draft, and no public release permission is granted.
[Google permission definitions](https://support.google.com/googleplay/android-developer/answer/9844686?hl=en).

There is an initial-upload documentation conflict: Google's Edits guide still
requires a first Console artifact; current Expo documentation supports automated
first internal release after the app exists. A package-not-found/uninitialized-app
response requires owner Console initialization with the prepared bundle, not
broader permissions. Do not promise zero initial manual upload or upload the
same already-consumed version again.
[Google Edits limitation](https://developers.google.com/android-publisher/edits),
[Expo first submission](https://docs.expo.dev/submit/android/#first-time-submission).

Review minimum app-scoped draft/testing rights before granting them. Account-wide
Admin, financial/orders, unrelated apps and production release access are outside
this internal-upload scope. If the provider demands broader permissions, inspect
its exact error and resolve the requirement with the owner; do not broaden access
as a retry. Signing enrollment stays owner-controlled and must be completed before
a limited publisher is used. Tester enrollment and internal rollout remain
separate from draft submission; a successful upload is not user availability.
[Expo prerequisites/submission](https://docs.expo.dev/submit/android/),
[Service-account setup](https://github.com/expo/fyi/blob/main/creating-google-service-account.md).

## Owner console steps for the first internal test

1. Sign in to the intended developer account and verify its identity. Create only
   **Loadgistic**, choose **App**, and review the language, pricing and developer
   declarations. The draft copy below is English. Package identity will be bound
   by the reviewed `com.loadgistic.app` bundle; do not select another application.
2. Review **Play App Signing / App integrity** and make the signing decision
   above before releasing. Console labels may vary. Retain the selected public
   signing and upload certificates; keep private material in the owner-controlled
   credential workflow.
3. Open **Testing → Internal testing → Create release**. Upload only the final
   verified `.aab`, confirm `com.loadgistic.app`, `1.0.2`, code `3`, and inspect
   every console error or required declaration. Save a draft with the release
   notes below. An APK download from Expo is not this AAB.
4. In **Testers**, create an owner-controlled list of up to **100 Google-account
   or Google Workspace testers**, select that list and save it. After reviewing
   and approving the internal release, roll it out to that track and copy its
   opt-in link. Testers must join with an allowed account. The first test link can
   take several hours to become available; it is not a public searchable launch.
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

Copy is prepared for owner review, not submitted. Current product behavior is
controlled by [PRODUCT_MASTER_PROMPT.md](../PRODUCT_MASTER_PROMPT.md).

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

**Release name:** `1.0.2 (3) — internal test`

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

## Data Safety evidence and decisions

The following is a source-based inventory, not a submitted declaration. Apps
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

## Gaps before broader review

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


## New policy implementation — verified locally, not published

FEAT-PLY-001 adds explicit location disclosure consent, real verified-email
account/data deletion, reporting/blocking and persisted moderation, account-bound
content-policy acceptance and registered synthetic reviewer access. The owner
approved the demo-only strategy and marketvision.tech@gmail.com contact. Six
policy SQL suites, four focused phone workflows and 24 new focused tests pass;
all 496 explicit native messages and shared policy controls have translations.
Migration 136 additionally protects the separate public truck map/search reads;
a profile-only hide does not close those signal projections.

The mobile reviewer test uses a real synthetic shipment and private capacity,
normal authentication and live revocation checks. No hosted reviewer credential
is provisioned yet. The browser location view is informational; it is not evidence
of Android's pre-permission dialog, closed-phone tracking or the required video.

The owner approved these screens on October 9. Full local quality 488/488,
native 127/127, Doctor 21/21, all 52 SQL suites, affected phone workflows, actual
web/Android builds and the 5,000-truck gate pass. Protected fresh backup restores
without networking; exact SQL 131–136 and security/spatial checks rehearse.
Current: immutable-source remote CI, owner review of exact hosted rollout and
reviewer provisioning, matching web deployment and signed 1.0.3/code-4 APK/AAB.
Prior signing/upload exclusions remain. The code-3 APK/AAB is unchanged.

Data Safety inventory is `.local/play-policy-data-safety-review.json`, a draft
requiring Console attestation. Declare inspected data, not only permission names:
smaller obscured grid cells can still meet Google's precise-location definition.
There is no analytics/advertising SDK or digital subscription purchase flow.
Assess any displayed sponsorship content for the Contains ads declaration.

Remaining manual Console work, once the new artifact is ready:
1. Open this document's owner-reported app dashboard. Do not create another app
   or change package com.loadgistic.app. Keep App / Free / English (United States).
2. Complete the deliberate signing choice above. Use the new verified AAB for
   any required first Console initialization, not the old policy-incomplete file.
3. Connect a separate app-scoped EAS Submit service account for internal/draft
   uploads. Firebase notification credentials are a different purpose and stay
   unchanged. Never grant account-wide Admin or production-release permission.
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
