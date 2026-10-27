---
id: FEAT-CSP-001
title: Private cargo-space photos and fresh-photo requests
related_ids: [BASE-FE-001, BASE-BE-001, BASE-DEP-001, FEAT-CAP-001, FEAT-SHR-001, FEAT-CON-001, FEAT-ENT-001, FEAT-FLT-001]
problem: A shipper or broker assessing a partly loaded vehicle may need a recent view of its remaining cargo space, but a photo cannot replace the provider's reported capacity or become public evidence.
behavior: The currently assigned driver may add a camera or gallery cargo-space photo for their vehicle. A provider owner may view and remove it. Only a shipper/broker workspace with a current vehicle-specific Capacity grant and a currently permitted Capacity member may view the image, request a fresher one, or filter its private map by photo presence and server receipt age. No image or photo-presence signal appears in public discovery.
contracts: [CargoSpacePhoto, CargoSpacePhotoRequest, CurrentVehicleGrant, PrivatePhotoRead, PrivatePhotoFreshness]
observability: [cargo_photo_uploaded, cargo_photo_removed, cargo_photo_request_created]
rollout: Install a separate service-only table and private-file API after migration 218 is qualified; wire the private Capacity filter only after its current query contract is verified. Back up metadata and objects before a hosted migration. Enable the scheduled cleanup worker only after its exact production site, separate secret and retention behavior are reviewed. Rollback disables routes, filters and worker before the table is removed; uploaded private objects require a separate audited cleanup. No public map or historical proof access changes.
---

## Scope and authority

Given a currently assigned, active driver opens their vehicle's Capacity tools
When they capture a photo in the app or choose one from the gallery
Then an image is accepted only for that current vehicle assignment, decoded and re-encoded to JPEG without EXIF or other source metadata, and stored in a private bucket
And the server records its own `receivedAt` time; optional `cameraCapturedAt` is explicitly unverified device information
And source `CAMERA` is used only for in-app capture, while gallery upload is `UPLOAD`.

Given a driver loses their assignment while an upload is in progress
When the upload attempts to activate
Then it fails closed; no new photo becomes visible to a recipient or the public.

Given an assignment is moved, disabled, deleted, or assigned to a different driver
When the change completes, even if the same row is later moved back
Then its pending or active cargo-space photo is permanently retired and cannot reappear.

Given a provider owner opens their vehicle
Then they can inspect its current photo and remove it; the assigned driver may inspect, add, or replace a photo but cannot remove the provider's retained record.

Given a business owner or staff member has current `CAPACITY` permission in an active shipper/broker workspace and that workspace has a current explicit grant for the exact vehicle
When they open its photo metadata or image
Then the server checks the actor, workspace, vehicle, grant, sharing mode, account review scope, and current driver assignment again on that request
And returns no signed Storage URL or cacheable image response.

Given a grant or connection is revoked, Capacity permission is removed, the vehicle is reassigned, the driver is disabled, or the account review scope no longer matches
When an earlier viewer retries a saved image URL or mobile file request
Then the new request is denied and no old photo bytes or metadata are returned.

Given an unauthenticated visitor or a provider without this vehicle opens public Capacity, a public profile, a cluster, or an API
Then no cargo-space photo, storage path, presence flag, receipt time, or request identity is disclosed.

## Requests, freshness, and matching

Given a business Capacity member can currently see a shared vehicle
When they request a new cargo-space photo with an idempotency key
Then one pending request for that workspace and vehicle is recorded and shown to the current driver/provider owner
And retries with the same key return the same request, while repeated fresh requests are limited per workspace and vehicle.

Given the current driver adds a photo after a pending request
Then the request is marked fulfilled and its new photo may be opened only while the recipient's live grant remains valid.

Given the business workspace selects the optional private-map photo filter
Then `photoPresent` matches only a currently visible photo, and `photoMaxAgeHours` compares server `receivedAt` with the server clock
And the filter composes with the existing vehicle and route matching before pagination; device camera time never qualifies freshness.
The private Capacity query accepts `photoPresent=true` and the optional server-age choices `12`, `24`, `72`, or `168` hours. An age choice implies photo presence. These fields never enter public Capacity queries or payloads.

Given a photo cannot be decoded, exceeds the size/pixel limit, has unsupported image content, or its object write fails
Then no active photo changes, no request is falsely fulfilled, and temporary objects are eligible for bounded cleanup.

Given a photo is replaced, removed, or abandoned after reservation
When the bounded private cleanup worker runs
Then private object bytes are removed and the photo becomes an inaccessible terminal tombstone, preserving any fulfilled request reference
And a temporary Storage or metadata failure can be retried without showing the old photo or delaying a successful upload.

The scheduled worker remains off by default. Hosted operation requires the
reviewed production `SITE_ID`/`URL`, matching `LOADGISTIC_CARGO_PHOTO_SITE_ID`/
`LOADGISTIC_CARGO_PHOTO_SITE_ORIGIN`, `LOADGISTIC_CARGO_PHOTO_CLEANUP_ENABLED=true`,
and a separate `LOADGISTIC_CARGO_PHOTO_WORKER_SECRET` of at least 32 characters.
Its signed background request cleans at most five due photos every 15 minutes;
monitor due-row age before increasing that batch or scheduling frequency.

## Transport and verification

Web image reads use a private, no-store API response; native reads use the same live authorization with a bounded base64 response under Bearer authentication. Neither exposes a Storage reference or signed URL to the client. Upload and request commands accept both current web session and native Bearer identity through the established server authentication path. Upload uses bounded multipart `command` JSON (`vehicleId`, `source`, optional `cameraCapturedAt`) and `file` fields. Photo metadata gives a same-origin `contentPath`; the native client must fetch that path with its Bearer token and `format=base64`, not load it as a cookie-only image URL.

Tests must cover assignment and owner authority, current and revoked grants, business team permission, review isolation, public/anonymous denial, request idempotency/rate limits, upload sanitization, stale assignment between reservation and activation, no-store reads, and private-only photo filtering. Do not call a photo verified cargo-space proof or infer fit from it.

Tests: `tests/cargo-space-photo.test.mjs`, `tests/cargo-space-photo-routes.test.mjs`, `tests/cargo-photo-worker.test.mjs`, `tests/private-cargo-photo-filter.test.mjs`, `tests/sql/cargo-space-photos.sql`, `tests/sql/cargo-space-photo-filter.sql`, `tests/e2e/cargo-photo-business-reads.spec.ts`, `apps/mobile/tests/cargo-space-photo-camera.test.mjs`, focused web/Expo photo and private-map filter workflows after the UI integration. Native camera capture and upload still require an installed-device test before claiming that capability verified.
