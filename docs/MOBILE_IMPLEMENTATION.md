## Current release: standalone Android internal testing — October 7

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
- [ ] Google Play account/testing track/store review, explicitly deferred by owner.

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
