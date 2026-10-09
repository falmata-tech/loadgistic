This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md


## Loadgistic project isolation (owner requirement, 2026-10-05)

- Scope is /Users/falmata/Desktop/Dev/loadgistic only. Follow the root AGENTS.md
  and docs/MOBILE_IMPLEMENTATION.md. Other Expo projects are outside this task.
- Use an explicit Loadgistic working directory for every command. Before changing
  dependencies, verify apps/mobile/package.json names @loadgistic/mobile. Keep
  its lockfile separate; never repair another app or a parent workspace.
- Project-local Doctor findings authorize project-local investigation, not global
  uninstalls or cleanup. Name the affected folder in progress messages.
- Preserve owner/other-agent edits, including .claude and .codex settings. Do not
  change those settings as part of app development.
- Android SDK, Java, adb, Gradle caches and Expo login are shared resources.
  Prefer command-scoped environment variables. Do not change global package
  versions, SDK defaults, shell profiles or saved accounts without explicit scope.
- Use Loadgistic_Pixel_API_35 only, and specify its verified serial on every adb
  device command. Never choose an implicit first device or another app's emulator.
- Verify port ownership before starting Metro. Do not stop another app's process,
  emulator, adb server or Gradle daemon. No killall, broad pkill, adb kill-server,
  global cache deletion or indiscriminate port cleanup.
- Record task-owned sessions/ports. When asked to stop, cancel only verified
  task-owned active work and check its state. Ending a turn does not stop a build.
- Expo owner is falmatad. Verify account AND project ID before remote linking,
  builds, updates, signing or distribution. Other projects in that account remain
  outside scope. Doctor/account checks do not create remote-project authority.
- Supabase scope is Loadgistic tpwyyzoqijjmbvsmmvcm only. Native development does
  not renew consumed production deployment/configuration authority.
- Never bundle credentials or signing material. EXPO_PUBLIC values are public.
  Review build upload exclusions before sending an archive to EAS.
- Review advisories individually; never apply forced incompatible audit upgrades.
  Doctor success is not a security audit or proof of working user workflows.
- Distinguish a Metro-dependent development client from a standalone phone APK.
  Record compiled, installed, device-tested, owner-approved and distributed
  separately. Preserve owner visual review before extensive release gates.
- A browser adapter may omit a native import graph. Typecheck and Expo-web success
  do not prove Android startup. Shared native contracts must be dependency-free;
  keep server registration/validation adapters out of phone routing imports.
  Verify the actual Android bundle and installed startup before native UI review.
- Native UI automation must require a fresh successful hierarchy dump before
  choosing tap coordinates. Delete the previous test-owned dump first; an adb
  zero exit code alone does not prove UIAutomator produced a new file. Verify
  synthetic text before submission and persisted state afterward. Wait for a
  visible initial screen before sending a second development-client navigation
  intent; do not count a bundler response as a successful cold start.
  Keep device actions sequential through tool-session completion; a returned
  running session is not a finished action. Use distinct test-owned dump paths
  and stop a dependent sequence on its first failure. Never tap from a stale dump.

## Web phone UI reuse and navigation organization (owner correction, October 6)

- Start from the existing web phone view: reuse labels, icons, colors and working
  task flows. Reuse is not permission to copy observed UI defects. Record those
  defects in docs/WEB_GAPS_FOUND_DURING_MOBILE.md and improve the native flow.
- Do not turn every route into a menu item. Group related controls under the
  resource or task they manage: fleet/capacity, Tracking, private network, Account.
  Keep a short primary navigation and contextual settings within those sections.
- Adding a backend capability does not require another top-level destination.
  Verify discoverability, role visibility, return navigation, keyboard clearance
  and all existing controls after regrouping. Preserve deep links and server checks.
- Driver Home is map-dominant. Keep three distinct signal tasks floating vertically
  on the right: Available space (current capacity/coverage/sharing), Usual routes
  (provider regular service), Truck location (approximate position/privacy radius).
  Load preferences belong inside capacity; do not turn every configurable field
  into another map button. Reusing web controls does not justify repeating its
  confusing categorization. Explain tasks in plain language and review the actual
  phone layout with the owner before release gates.
