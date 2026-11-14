# Native Android testing

Updated November 14, 2026. The local standalone test APK is built and statically
qualified below; no managed-device test, upload or purchase is recorded.
Follow [mobile instructions](../../apps/mobile/AGENTS.md),
[mobile acceptance history](../MOBILE_IMPLEMENTATION.md),
[current work](../PROGRESS.md) and the separate
[release authority](../PRODUCTION_AUTHORITY.md). An Expo browser preview or
Android JavaScript export does not establish native startup, permissions,
background reporting, camera or notification delivery.

## Selected route and bounded first session

Use **one Genymotion SaaS Android 15 ARM64 virtual phone**, displayed in the
owner's connected Chrome. Use its normal dashboard rather than exposing a token
in a generated display URL. The cloud device avoids competing with the current
local QEMU/Supabase VM. This Linux environment has no `/dev/kvm`; Google's current
[emulator reference](https://developer.android.com/studio/run/emulator-commandline)
describes software-only emulation as unsupported and very slow. Do not start
another Android emulator while the local database VM is being qualified.

The proposed first session is **one device, at most 60 online minutes**. Current
[PAYG pricing](https://docs.genymotion.com/usage/saas/pricing/) is $0.06 per active
device-minute, so 60 minutes is an estimated **$3.60 usage before tax**. Request a
**$5 usage ceiling before tax**, allowing a small billing/rounding margin; do not
start another instance or extend/restart the trial beyond the agreed budget.
This is a proposal, not an existing subscription or spending authorization.
A [free 60-minute trial](https://docs.genymotion.com/quickstart/saas_quickstart/)
is available on request; it has not been requested here.

The owner needs a Genymotion account, accepted service terms and an available
trial or selected PAYG plan. Billing setup needs a manager and supported payment
method. Owner sign-in/account verification remains with the owner when required.
Do not create a paid account, accept new terms, upload a private APK or generate
an API token before the specific account, APK and bounded session are agreed.
Prefer a dedicated test identity over signing a personal Google account into the
virtual phone. Actual streaming, connected-Chrome interaction and API/ADB network
access from this workspace remain to be tested.

## Freeze and build before starting billing

Current source configuration is `com.loadgistic.app`, version **1.2.0/code 10**,
Expo **57**, React Native **0.86.3**. Historical signed 1.1.1/code9 and the different
debug code10 APKs in earlier receipts are separate binaries. The November14
local test APK below is current for its verified executable inputs; no new AAB
or store artifact was created. Alpine package files under `.local/vm` are not
Android artifacts.

1. Finish the relevant native/shared-contract changes, run the required focused
   checks and freeze the exact source into an ignored, task-owned copy. Preserve
   the root layout because mobile imports shared modules from `src/`. Record
   Git SHA, dirty-file content hashes, lockfiles, public app config, native plugins
   and selected API origin. Exclude runtime credentials, private files, owner
   keystores and unrelated data. A changed shared contract invalidates an older
   snapshot even when `apps/mobile` itself did not change.
2. Keep Node24, JDK, Android SDK and Gradle caches scoped to this task; do not
   change global SDK defaults or shell profiles. Node24/mobile npm dependencies
   and the scoped toolchain below are available. The host Java21 includes
   `jdk.compiler` (its module-based `javac` check passes) but lacks the usual
   compiler launcher/headers; use the full scoped vendor JDK. Ordinary local
   SDK installation/licence acceptance is covered by the development-tools
   request and is complete for the selected packages. This does not authorize
   a cloud account, APK upload or purchase. The local test compilation below
   is complete; installation/runtime acceptance remains separate.
3. The inspected installed SDK57 template uses Gradle **9.3.1**. Its RN version
   catalog requests `platforms;android-36`, `build-tools;36.0.0` and
   `ndk;27.1.12297006` (min SDK24, target36). Include `platform-tools` and the CMake
   version actually required by the generated native dependencies; do not guess
   or upgrade versions to repair a download failure. These selected packages
   and CMake3.30.5 are installed. Verify official download integrity and inspect
   generated settings before compilation. Plan several GB
   of build memory and approximately 5–10GB of tools/cache as estimates, then
   measure actual use. Coordinate with the Docker task before heavy downloads or
   compilation; serialize them on this restricted host.
4. Generate native output using CNG in the disposable copy, never by creating or
   editing a tracked Android project. The following prebuild command was tested
   successfully; it preserves existing dependency versions and performs no npm
   installation or remote account operation:

   ```bash
   # Working directory: the frozen copy's apps/mobile
   CI=1 EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 EXPO_NO_GIT_STATUS=1 \
     EXPO_PUBLIC_API_URL=https://loadgistic.com \
     ./node_modules/.bin/expo prebuild --platform android --no-install \
       --skip-dependency-update react,react-native
   ```

   Production API targeting must be deliberate and tests must use only the exact
   approved synthetic accounts/vehicles. A cloud Android phone cannot reach this
   workspace's `127.0.0.1`. Do not expose a local database or add a public tunnel
   merely to make that URL reachable. Use a separately reviewed reachable test
   backend, or the approved production test boundary after matching backend
   deployment. Never bundle service-role, owner-session or SMTP credentials.
5. Inspect generated `android/app/build.gradle`: require the expected package,
   version and `release` using `signingConfigs.debug`. In that disposable output
   only, move aside the template `debug.keystore`, then generate a **new
   disposable local debug key** at the same path. Do not retrieve or reuse the
   owner's existing upload/Play/EAS key. The generated key has no store identity
   and must not update an existing signed installation or become a release key.
6. Build an ARM64-only standalone release variant with that debug certificate.
   Example after the scoped JDK/SDK are installed and their paths verified:

   ```bash
   # Working directory: the frozen copy's apps/mobile/android
   # Use the checksum-verified Gradle9.3.1 binary from the task toolchain.
   "$LOADGISTIC_TOOLCHAIN/gradle-9.3.1/bin/gradle" :app:assembleRelease \
     -PreactNativeArchitectures=arm64-v8a \
     -Dorg.gradle.parallel=false \
     -Dorg.gradle.jvmargs="-Xmx2048m -XX:MaxMetaspaceSize=512m" \
     -Pkotlin.compiler.execution.strategy=in-process \
     --max-workers=1 --no-daemon --no-watch-fs
   ```

   `LOADGISTIC_TOOLCHAIN` must name this checkout's verified task-owned toolchain
   root; set command-scoped JDK/SDK/cache paths from its receipts. Include
   `CMAKE_BUILD_PARALLEL_LEVEL=1` and a1536MB Node heap limit. This command is a
   build recipe; the successful actual invocation/receipts are recorded below.
   `assembleDebug`/the development client requires Metro and does not establish
   standalone behavior. The repo's `build:android:test` invokes remote EAS; do
   not use it for this local preparation. Follow the exact SDK57 documentation
   and inspect local CLI help before changing the build procedure.
7. Pin APK SHA256 and certificate fingerprint, record actual ABI libraries,
   package/version, selected API origin and bundled-JS/source equivalence. Run
   `apps/mobile/scripts/verify-android-permissions.mjs` against the actual APK
   with an explicit SDK `aapt2` path. Require a non-debuggable standalone
   manifest, the existing required permissions and no forbidden permissions.
   Inspect archive contents for secrets/private files. Source XML's
   `tools:node="remove"` entries are merge instructions, not evidence of installed
   permissions. Manifest merging and final APK checks remain mandatory.
   Record Google Maps key metadata presence as a boolean/digest only, alongside
   the renderer/provider selected by the Android dependency graph. A missing
   Google Maps key is not evidence of failure for a different configured renderer.
   Keep local Firebase configuration/resource readiness separate from compatible
   device services, key-restriction enforcement and delivered FCM notifications.
   Do not retrieve/change Google keys or provider restrictions for this check.
8. Recheck frozen executable inputs after building. Archive the receipt and
   exact APK immutably before starting a paid device. Record compiled,
   installed, workflow-tested, owner-approved and distributed separately.

### November 13 preflight evidence

The ignored `.local/native-device-20261113/source` snapshot contains 2,265 files
(81,715,737 bytes), based on Git `520328bd61c70a7d278fd183c6a25ffde248ab7a` plus
the then-current dirty source. Its source-manifest SHA256 is
`22f6c50ab03978e8580a0c8d668358a830005fee56cfaec9f9dd1805a040e7cd`.
Offline CNG prebuild passed, left frozen inputs unchanged and generated only
the ignored Android project. It confirms package/version and debug signing for
the release variant; it does not establish compiled permissions or an APK.
Backend and a shared mobile capacity contract changed during this preflight,
so refresh the freeze after implementation settles. The local
`cng-preflight.json` records the drift. No owner-key retrieval, disposable-key
generation, compiled build, managed device, upload, account change or spending
was performed. The harmless prebuild advisory about
`expo-system-ui` was retained; no dependency was added to silence it.

A refreshed ignored source snapshot (2,270 files) then passed Android Hermes
export: 3,751 modules in 62.781s with one worker and a 1536MB Node heap limit;
maximum single-child RSS was 893,400KB. Its manifest SHA256 is
`2ce5be6cedb147fb176d2e15b56a3692e6bd73e6fdbda2c27ae7101f80c39d3d`;
frozen inputs and live mobile/shared inputs remained unchanged during the run.
The local `android-export-result.json` pins the bundle and source-map hashes.
This confirms the native JavaScript import graph/export, not a compiled Android
APK, installed startup or a final release gate. The first wrapper invocation
found `/usr/bin/time` absent before Expo ran; its failure was retained and the
successful invocation used Python resource timing.

### Scoped toolchain installed — November 13

`.local/native-tools/android-toolchain-20261113` contains full Microsoft
OpenJDK21.0.13.0.2, Gradle9.3.1, command-line tools22.0, platform-tools37.0.1,
SDK36 revision2, build-tools36.0.0, NDK27.1.12297006 and CMake3.30.5/Ninja1.10.2.
JDK, command-line tools and Gradle archives match official published SHA256;
selected SDK packages were installed through Google's SDK manager and their
installed revisions/source-property hashes are recorded. Tool version checks
pass in `toolchain-preflight.json`; no project compilation or ADB server/device
was started. JDK archive SHA256 is
`5bf17d27de3fe9d102981236cdea68482e3b5ef68a44ad21c6439b45d7d34da2`;
Gradle archive SHA256 is
`b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06`.
The SDK catalog's first direct Java attempt returned zero without packages;
explicit execution-proxy settings and a task-local truststore containing the
execution CA fixed it. TLS and package integrity remain enabled; global Java,
SDK and account settings were untouched. The execution proxy/CA may change
between tool sessions, so refresh only that task-scoped configuration per run.
SDK manager22's deprecation notice points to the new Android CLI; its tested
selected-package installation remains recorded rather than silently upgraded.

### Qualified local native test APK — November 14

The later frozen candidate is
`.local/native-device-20261113/final-candidate/source`, with private copies of
both dependency directories so native/codegen outputs cannot modify the live
checkout's installed dependencies. Its source manifest SHA256 is
`1896956c78fa1c16312b34986670613e737858fcf32cfddd723aa2468802c314`.
Fresh Node24 gates pass:426/426 mobile tests, no failures/skips, clean types/lint,
796/796 translations and a3,751-module Android export in59.646s. Offline CNG
passes; a new disposable local debug key was generated only in its ignored
Android output. No owner key or hosted signing account was used.

Creation uses520328b plus frozen dirty inputs. Actual packaged-Hermes/source-map
dependencies and native config/plugins/assets/locks establish executable-input
equivalence with `4b7af44b772d92b7c56024613fba7b1a766340aa`:3,735 source-map
entries resolve without unknowns;287 repository inputs,3,591 installed dependency
sources and40 generated-route inputs match commit/live state. All six newly
edited server-auth modules are absent. This is stronger than frozen-folder
stability; it does not relabel creation source or prove the deployed backend.

| Item | Qualified value |
| --- | --- |
| Local artifact | `.local/native-device-20261113/final-candidate/artifacts/loadgistic-1.2.0-code10-arm64-native-test-a7f4e3609e3b.apk` |
| APK SHA256 / bytes | `a7f4e3609e3be8ea9eaa1f4ff0aed8581aea99ecd3d7c2a734279600a1c7b441` /59,110,117 |
| Package / version / SDK | `com.loadgistic.app`;1.2.0/code10; ARM64 only; min24/target36 |
| Signing | Verified v2 signature; new disposable local debug certificate; non-debuggable release variant with standalone Hermes. No owner upload key/Play identity used. |
| Certificate SHA256 | `e9f5af21171a2b91541267962061ccf484932b922b49736f85213e08c4bd5545` |
| Permissions | All8 required,0 forbidden;34 total merged declarations. Extra declarations include notification launcher badges, messaging/network/boot and SecureStore biometric support. Full inventory is retained. |
| Native structure |25 ELF64/AArch64 libraries, each with load alignment at least16KB; ZIP native16KB alignment passes. Physical16KB-device behavior remains untested. |
| API / packaged code | Explicit `https://loadgistic.com`;6,158,512byte Hermes asset exactly matches generated release bundle. Private-file and known-secret-marker checks clear. |
| Evidence | `qualification/artifact-readiness.json`, `apk-static-qualification.json`, `native-source-equivalence.json`, `native-source-graph-files.json` and `merged-permission-inventory.json` under the candidate directory. |

| Attempt | Observed result |
| --- | --- |
|1 | Exit1 after654.075s: official Google Maven HEAD requests for26 AndroidX AARs returned403. Fresh-context Python HEAD/GET and standard Java HEAD returned200 for the exact resource. Cause of the original403 remains unconfirmed; no mirror/TLS bypass was used. |
|2 | Exit1 after58.583s: dependency retrieval advanced, then the task-local Ninja job wrapper incorrectly appended `-j1` after `-t restat`. This was task tooling, not app source. The wrapper was corrected to keep global job options before tool arguments; actual ARM64 CMake compiler detection, normal build and restat probes pass with the original verified Ninja binary. |
|3 | The1200s budget was enforced; exit143 after1201.897s. Native libraries, app Java/Kotlin, Hermes, resources and merged dex outputs exist. Release lint analysis was still running; signing/package/assemble had not been reached. No APK exists yet. Peak process-tree RSS was5,445,664,768bytes; frozen inputs stayed unchanged. |
|4 | Success in238.851s within the approved600s continuation:835 actionable tasks (72 executed/763 cached), including app release lint analyze/report/check, signing validation, package and assemble. Peak tree RSS2,840,248,320bytes. Frozen inputs stayed unchanged; no check was disabled. |

The earlier partial compilation receipts did not establish an APK; attempt4
completed all remaining release checks. Do not skip lint or relabel a timeout
as a source failure. The preserved pre-continuation inventory had947 observed
task events/12 module lint-metadata tasks; an execution-start log did not establish
the exact unfinished count. No unchanged source gates were repeated. Each build
recaptured its execution proxy/CA and retained verified TLS. Static metadata
inspection also corrected the aapt2 field name from legacy `sdkVersion` to
`minSdkVersion`; that parser error did not change APK bytes.

After the successful build, the scoped daemon lifecycle records normal shutdown
and exclusive task cache journal/file-hash locks are available. The inspection
namespace shows no matching task process, but may differ from the build's
namespace, so process listing alone is insufficient. Preserve
`post-build-attempt4-quiescence.json` (alongside earlier cancellation evidence),
stop only verified task-owned work and never use a broad kill. The VM window has
been released. The APK remains a local test artifact, not an installed/approved
phone build or an upload-key-signed/store release.

The actual Android graph selects **MapLibre Native11.5.0** and packages its native
renderer. Its style uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with OSM
attribution and an application User-Agent. The Google Maps API-key metadata
entries are both absent; this renderer does not require that key. Android
rendering/network/tile behavior still requires installed review. Firebase API/
app/sender/project resource symbols and a native messaging service are present;
Firebase messaging auto-init and analytics auto-collection are disabled in the
manifest; native registration must use the intended notification-consent flow.
Device Google services, notification consent, current key restrictions, backend
sender operation and real delivery were not verified by compilation. No Google
keys/restrictions were retrieved from or changed in a provider console, and no
key values are printed in the receipts.

## Device start, inspection and stopping

[SaaS images are ARM64](https://docs.genymotion.com/usage/saas/deploy_apps/).
Select the exact Android15 ARM64 recipe and confirm its OS/ABI before installing
the hash-pinned APK. Installing through the browser widget is supported. For
CLI/ADB operation, use task-scoped Python3.10+, `gmsaas` and SDK `platform-tools`,
then a newly agreed token stored without printing it in logs. Follow
[Connect to ADB](https://docs.genymotion.com/usage/saas/connect_adb/).
Use the exact returned ADB serial on every device command; never select an
implicit device or kill the shared ADB server.

The pinned **gmsaas 1.16.1** CLI is installed at
`.local/native-tools/gmsaas-1.16.1/venv/bin/gmsaas`. All 20 downloaded binary
wheels were checked against their official PyPI version metadata before an
offline `--require-hashes` installation. The Linux gmsaas wheel SHA256 is
`414583ae4981314bb46a84185b54863ed776c15ef7729e8ed6057d94c310327d`.
Credential-free `--version`, `instances start --help` and `instances stop --help`
all passed. Actual start help confirms automatic stop regardless of activity,
with the countdown starting when booted; **0 means no timeout**. It marks
`--stop-when-inactive` deprecated in favour of `--max-run-duration`. No login,
token, instance or billing operation was used for this qualification. The local
`wheel-integrity.json` and `cli-help-qualification.json` preserve the evidence.

After account/budget/APK approval, the reviewed start procedure is:

```bash
gmsaas instances start <verified-arm64-recipe-uuid> loadgistic-native-review \
  --max-run-duration 60
gmsaas --format json instances get <returned-instance-uuid>
```

Require readback `max_run_duration=60`, the intended recipe and the exact device
UUID. The [CLI reference](https://docs.genymotion.com/tools/saas/gmsaas/gmsaas_commands/)
documents automatic instance stop after this many minutes. The
[administration reference](https://docs.genymotion.com/usage/saas/admin_interface/)
says the countdown starts when the device goes online and shuts it down even
while active. This is a provider runtime cap, **not a documented currency cap**.
Track total running time and usage, including setup/reboots; do not assume reboot
or reconnection grants another approved session.

Prepare everything before starting the device, stop early on a blocked APK,
unusable streaming/ADB or unexpected account/cost state, and stop explicitly
before the limit:

```bash
gmsaas instances stop <this-task-instance-uuid>
gmsaas --format json instances get <this-task-instance-uuid>
gmsaas --format json instances list
```

Wait for the stop command to complete. Confirm this device is stopped/deleted
or absent from the running list, then read back account usage. Do not stop other
devices. A missing individual record alone is not sufficient without the running
list/usage check. Closing the browser or logging out **does not stop billing**;
frontend inactivity does not protect CLI-started instances. Preserve stop
evidence if the test fails or the session ends unexpectedly.

## Native acceptance and honest boundaries

Only exact operator-marked/approved synthetic demo accounts and vehicles may be
used for simulated marketplace reporting. Ordinary signup, editable metadata or
similar names do not qualify. The emulator is a test phone; its injected Android
GPS points must be labelled synthetic in evidence and must never target a real
user. Leave the dedicated marketplace workers and the real GPS ingress service
independent of this device session.

| Check | Required observation |
| --- | --- |
| Cold start and parity | Launch exact installed APK without Metro; review public Capacity, filters, map/details/Back, Featured, sign-in, role navigation, invitation/deep-link recovery, keyboard/safe areas and all three locales. Use fresh UI hierarchy/screenshots before native coordinate actions. |
| Location consent | Explicit Phone/GPS choice; foreground deny/approximate/precise grants, background disclosure/settings return and permission revocation. No manual-location editor/submission; preserve dated legacy history truthfully. Notification refusal must not silently select a location source. |
| Phone Capacity | The observation hook checks every60s but captures when **Home is focused and foreground, and10min is due**. The separate Capacity feed-read refresh is15s. Observe due reports without changing the interval for the test; leave Home/background and verify the current pause behavior. Do not describe Capacity as background-continuous. |
| Agreed Tracking | Separate native foreground service requests background fixes at a **10min** interval. With a valid synthetic shipment/consent/lease, observe two background intervals, service notification, accepted DB records and return/cold-start behavior. Home key, lock, OS process termination and force-stop are different cases. |
| End-to-end signals | Record synthetic OS point, observation/receipt times, accepted source/provenance and privacy radius; compare DB outcome with web/native rendering. Current source refreshes visible Capacity feeds on15s polling with no overlapping full-page read; do not call that push Realtime. Check stale/duplicate/out-of-order rejection and network recovery separately. |
| Demo isolation/takeover | Trusted Demo labels, exact-target simulator pause on real phone enrollment, no normal-account enrollment, no unapproved source switch and no affected real-user records. |
| Revocation | Sign-out, revoked assignment/consent, lease expiry and approved unloading stop the applicable reporting and revoke the intended session/lease. Check authoritative state after the UI result. |
| Notifications | Native consent, registration and actual foreground/background/closed-app delivery, with the intended destination. Keep force-stop behavior distinct and preserve recipient scope. |
| Camera/files | Native permission and picker/capture/upload/Cancel, authorized readback and denial after revocation. Synthetic media cannot prove physical camera output. |

The [browser GPS widget](https://docs.genymotion.com/features/gps/) supports
synthetic coordinates, accuracy, speed and bearing. Use several bounded points
to exercise Android capture and persistence; do not use the browser's “my
position” shortcut or imply the owner's physical movement. GPX/KML route replay
for SaaS is documented through **Genymotion Desktop's Cloud dashboard**, not a
guaranteed browser-only feature. The optional
[Genymotion Shell](https://docs.genymotion.com/tools/desktop/genyshell/) can script
cloud sensor changes over an explicitly scoped ADB forward; its tool setup is a
separate pending integration, not a claimed working simulator.

[Google Play Services are not preinstalled](https://docs.genymotion.com/features/opengapps/).
Built-in GApps installation needs its separate disclaimer/setup and reboot;
do not assume an arbitrary downloaded package works. Android
[FCM requires compatible Google services](https://firebase.google.com/docs/cloud-messaging/android/get-started).
Verify actual services, consent, native registration and delivery before marking
push accepted. A missing GMS dependency is a device limitation to record, not
proof of an application notification defect. Do not change existing Firebase,
Google or Expo project configuration to make this trial pass.

A 60-minute first session is a bounded native smoke/location pass; record any
uncompleted parity rows for a separately agreed follow-up. Virtual native tests
can exercise Android permission screens, app/service lifecycles and synthetic
location. They do not prove moving physical GPS accuracy, OEM battery policy,
real tracker hardware/protocol/commands, physical camera quality, Play-installed
signatures/integrity, 16KB hardware behavior or iOS. Ask before a new owner-phone
session and verify the exact device/build. Keep emulator, physical-device,
source/export, compiled artifact and published-store evidence separate.
Configured reporting intervals are requests to the OS: measure actual receipt
times in each app/permission state without accelerating intervals or changing
the clock to make the trial pass.
