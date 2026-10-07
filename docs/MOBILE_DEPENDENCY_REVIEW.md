# Mobile dependency review — 2026-10-06

Scope: `apps/mobile` only. Initial review used Expo 57.0.26 / Router 57.0.24;
current candidate uses SDK-matched Expo 57.0.27 / Router 57.0.25 and React Native 0.86.3.
Local `npm audit --json` reports 31 affected package entries: 20 high, 11 moderate,
zero critical. Those include inherited dependency chains, not 31 distinct advisories.
Raw local evidence: `.local/mobile-audit-current.json` and
`.local/mobile-advisory-paths.txt`. No forced upgrades, audit exclusions or global
package changes have been made. Doctor success does not clear these findings.

| Advisory | Installed path and assessment | Outstanding action |
| --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces@3.0.3`, Expo CLI → Metro file map → micromatch. Pattern-processing denial of service in development/build tooling. No patched version listed at review. | Review compatible upstream remediation before release; avoid untrusted build patterns. Tooling scope is not a declaration that the package is safe. |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `node-forge@1.4.0`, Expo CLI/code-signing certificates. Signature-validation issue in tooling; no patched version listed at review. | Evaluate the actual signing/verification path before EAS distribution. No automatic acceptance based on runtime exclusion. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | `uuid@7.0.3`, sharing → config plugins → xcode. Installed xcode calls `uuid.v4()`; advisory concerns v3/v5/v6 buffer handling. That is source-based reachability evidence, not removal of the finding. | Use a tested compatible upstream tooling update. Do not force a major override into xcode. |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | Router → `query-string@7.1.3` → `decode-uri-component@0.2.2` is a runtime path. Malformed percent encoding can cause excessive decoder recursion/work. Patched 0.5.0 is ESM; a blind override is incompatible with this CommonJS consumer. | The new native-intent boundary validates bounded external URLs before Router, returns canonical relative paths, and rejects malformed input. Focused tests pass against the installed parser. Cold/warm Android verification remains required. This initial assessment is superseded by the tested 0.5.0 adapter and current bundle evidence below. |

Expo's [native-intent hook](https://docs.expo.dev/router/advanced/native-intent/)
is an early native link-normalization boundary, not an authorization mechanism or
a web hook. Existing provider/visitor authorization remains in place. Incoming
links are never logged and cannot supply session credentials.

Release owner/implementer: reassess these exact paths, retain the audit result and
record accepted residual risks or verified fixes before signing/distribution.
This review does not authorize publishing with unresolved findings.

## Web icon parity addition

Owner-requested phone UI parity adds `lucide-react-native@1.52.0` and
`react-native-svg@15.15.4` only to `apps/mobile`, using Expo's SDK-compatible
installer and exact versions. SVG matches Expo SDK 57's documented version;
Lucide's installed peer range includes React 19 and SVG 15. Root web dependencies
and other Expo projects are unchanged. The install reports the same 31 affected
dependency entries (20 high, 11 moderate); it does not clear the findings above.

The scoped x86_64 debug rebuild passed (497 tasks, 2m27s), and installation on
Loadgistic_Pixel_API_35 succeeded. This is development-preview evidence, not an ARM
release or an EAS upload. Sources: [Expo SVG](https://docs.expo.dev/versions/v57.0.0/sdk/svg/)
and [Lucide React Native](https://lucide.dev/guide/react-native).


Browser-preview follow-up (October 6): added SDK-resolved React DOM types and
`maplibre-gl@6.13.0` to the mobile package only. The new audit in
`.local/mobile-audit-web-preview.json` still reports 20 high and 11 moderate
entries, with no MapLibre GL entry. This does not resolve the existing findings
or authorize distribution. The browser preview binds localhost and uses local
sessions/API data; it is not a hosted web release.


## Current bounded disposition — October 6

The runtime decoder is now pinned to 0.5.0 under query-string 7.1.3. A temporary
postinstall adapter selects its ESM default export; it checks the original
consumer source hash and version and fails on drift. Normal Unicode/array query
semantics and bounded malformed input pass against the installed parser. The
actual browser preview works, and the compiled Android source map contains the
patched consumer and final native copy. Native-intent validation remains active.
This closes the decoder dependency finding; it does not claim a device deep-link pass.

Raw audit now reports **28 affected package entries: 20 high, 8 moderate, zero
critical**, representing three remaining advisories. They remain recorded rather
than hidden: braces 3.0.3 and node-forge 1.4.0 have no published patched version;
the xcode path uses uuid 7.0.3's v4 function rather than affected v3/v5/v6 APIs.
The actual Android bundle has no npm braces, node-forge or uuid module. Expo's
own UUID helpers are a different implementation. Evidence:
`.local/mobile-audit-patched.json`, `.local/mobile-decoder-after.log`,
`.local/mobile-runtime-dependency-review.json` and
`.local/mobile-final-android-export-current/`.

This review allows an **internal test build only** from the locked, reviewed
source: development binds localhost; EAS receives the reviewed source archive;
customer data, local certificates and keys are excluded; Android signing uses
EAS/Gradle, not node-forge. Build glob patterns and certificate inputs are
controlled developer inputs, not customer descriptions or request data. This is
an implementer assessment of these specific paths, not removal of the underlying
vulnerabilities or permission for broader publication. Upstream updates remain
tracked. Owner: Loadgistic mobile implementer; recheck before every distribution.

`review-runtime-dependencies.mjs` rejects unknown/critical findings, version
drift, affected npm packages in the actual Android runtime, and a missing patched
decoder/consumer. Its negative tests pass. It reports raw counts and limits the
result to internal builds. Native permission, file, Back, cold-start and owner
phone verification still precede broader distribution/store publication.


SDK patch follow-up: Expo Doctor identified four compatible patch updates. Only
Expo, constants, linking and Router were updated in the mobile lockfile; Doctor
now passes 21/21 and mobile lint/types plus 84 tests pass. The final raw audit has
27 affected entries (19 high, 8 moderate, zero critical), still the same three
reviewed tooling advisories. Final evidence: `.local/mobile-audit-sdk-final.json`,
`.local/mobile-runtime-dependency-review-final.json`, `.local/mobile-sdk-final-android-export/`.
The CI mobile job retains the raw audit exit/status and report, exports the real
Android runtime, and applies the same gate before declaring internal-build eligibility.
