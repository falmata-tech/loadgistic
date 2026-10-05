# Explicit antivirus-optional pilot policy

Controlling specification: BASE-DEP-001. Decision date: 2026-09-13.

The owner requested that mandatory malware scanning stop blocking uploads. This is an explicit policy change, not a scanner outage fallback. Implementation plan: add an opt-in validation-only adapter, retain storage and authorization controls, harden private document responses, and test both allowed uploads and denial paths. No additional dependency or database migration is needed.

## Modes

- `cloudmersive`: existing managed antivirus. Missing credentials, quota exhaustion, timeout, rejection, or invalid responses still deny release.
- `local`: existing EICAR-aware development fixture, prohibited as Production protection.
- `validation-only`: explicitly permits uploads without antivirus. Existing four-MiB ceiling, supported MIME/signature checks, private quarantine, opaque storage references, owner-scoped metadata commands and authorized downloads remain. The inspection result is `clean: null`, never `clean: true`. Readiness reports `uploads-not-virus-scanned`.

Signature validation is not full content validation or malware detection. A correctly labelled image or PDF can still contain harmful content. Recipients should not assume documents are safe merely because they were uploaded. PDF evidence is served as a download rather than embedded in the app; restrictive response headers and no-sniff do not protect a recipient's external PDF reader.

## Rollout and rollback

Build and verify the new artifact first. Then explicitly set `UPLOAD_SCANNER_BACKEND=validation-only` in the intended runtime and redeploy. Do not replace another project's configuration or expose secrets. A remote health check must show the warning; browser upload and authorized retrieval must succeed before claiming remote completion. This document alone is not rollout evidence.

To restore mandatory antivirus, configure `cloudmersive` with its server-only credential and redeploy. Previously uploaded unscanned objects do not retroactively become scanned. Do not change private bucket policies or grant anonymous object access.

No claim of unrestricted production readiness follows from removing this single blocker. Other audit findings, provider quotas, operational checks, and end-to-end deployment verification remain separate.

## Local verification

The isolated port-3113 process explicitly loaded `validation-only`. A real
browser uploaded a synthetic verification image, displayed the success state,
and retrieved identical bytes through the authorized document route. Anonymous
retrieval returned 401. The exact test vehicle/document/object and associated
test audit records were removed; the temporary process was stopped. The normal
development processes and Production configuration were not changed.

The focused scanner, storage, and readiness suite passed 16 tests; the complete
quality gate passed 237 tests and TypeScript. Remote upload verification remains
pending.

The optimized production build also passed (83 generated pages). This remains
local artifact evidence, not a Netlify deployment.

## Open-source scanner assessment

ClamAV is a real open-source option, but its standard signature database has a
[recommended minimum of 3 GiB RAM](https://docs.clamav.net/Introduction.html#recommended-system-requirements).
Netlify documents a [default 1 GB function allocation](https://docs.netlify.com/build/functions/usage-and-billing/).
Consequently, installing an npm wrapper is not a demonstrated zero-operations
scanner for this deployment. The explicitly requested optional-antivirus policy
avoids claiming such an integration exists. A hosted open-source scanner can be
evaluated separately if that requirement returns.
