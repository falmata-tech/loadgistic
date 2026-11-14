# Restricted local Docker checkpoint — stopped

## Current local-stack limitation

The current managed workspace has no normal Docker client or standard managed
socket, and creating a Unix socket returns `EPERM`. This limits the full local
Supabase stack and its fixture/SQL harness. Next.js and Expo can run directly on
Node against an isolated managed Supabase development branch; Netlify functions
also do not require this VM. Use [local setup](../LOCAL_SETUP.md) and
[ADR-085](../DECISIONS.md) for that path. No managed development resource was
created: its cost confirmation expired, and bootstrap remains unseeded source.
Full local suites can use a normal Docker environment or native GitHub runners.

The nested QEMU workaround became a development bottleneck. A separate store
was eventually verified empty and responsive after correcting an argv assumption,
two legitimately read-only audit modes, and the plural
`containerd-plugins-namespace` configuration key. The earlier startup-monitor
timeout remains a failed receipt; subsequent owned-process/configuration and API
checks qualified the already-running daemons without restarting them.

The subsequent offline image import ended with `unexpected EOF` after loading
Postgres, GoTrue and PostgREST references. The VM/controller stopped before its
queued kernel/daemon diagnostic ran; its disk lock is now available. No exit
cause or host OOM is established. All fourteen Storage layer payload sizes and
digests in the export independently match the pinned source. The original store,
failed setup metadata and partial replacement store remain intact. No application
database, candidate migration or fixture import completed.

Stop this workaround here; do not resume the manager or start another VM.
When the full local suite is needed, verify a normal managed Docker client,
socket and IPC capability, then use the existing setup, migrations and fixture
preflight. Daily app development need not wait for that local stack.
Successful daemon startup or matching image bytes do not qualify the app. Keep
the preserved receipts below separate from database, browser and service-runtime
acceptance. Current source and remaining work are in [PROGRESS](../PROGRESS.md).

Updated November 14, 2026. This records the task-owned runtime prepared on
November 13. It is an environment-specific development checkpoint, not a hosted
service or a general replacement for [normal local setup](../LOCAL_SETUP.md). Production credentials
are not required and must not be copied into it.

## Historical tool checks

Docker Engine 29.9.3 ran in a task-owned Alpine 3.24.4 virtual machine under
QEMU 10.0.13 software emulation. The retained guest was configured with four
virtual CPUs, 2 GB RAM and a protected 32 GiB task disk. Docker's official
hello-world container executed successfully. The loopback Docker endpoint required mutual TLS;
a client without a certificate was rejected. Compose 5.7.1 has been checked
against its upstream checksum and executed on the host and guest.

The VM avoided host-daemon installation and host privilege changes. This host
does not provide hardware virtualization or usable host Unix sockets. Attempts
with larger guests were interrupted by SIGKILL; the captured evidence does not
establish a guest out-of-memory event or an application/CI defect. The
2 GB guest used serialized image pulls to reduce memory pressure.

The selected command-line tools are project-local: Node 22.16.0, Supabase CLI
2.111.0, Docker CLI 29.9.3 and ShellCheck 0.11.0. Expo has its separate Node 24
runtime. Keep SDK and default shell settings for other projects unchanged.

## Historical manager receipts — do not resume

The stopped execution owned its PID and network namespace. Other commands could
see the files but not that execution's loopback services. Earlier task-tool
sessions31501/95684/95469, session50113/run `run-root-20261114T000151` and
session33989 are historical receipts, not current addresses or liveness claims.
Session33989 shut down after a monitor bug: a completion marker shared a line
with the terminal prompt. The corrected marker started its own line and later
readiness checks inspected the already-running daemons without restarting them.

The ignored `.local/vm/resume.json`, `.local/vm/active-root-runtime.json`,
`.local/vm/runtime-manager.py`, corresponding job/exit records and
`.local/vm/restricted-local-docker-handoff.md` preserve the attempted execution
and startup/job digests. Their old launch instructions are superseded by the
stop decision above. The cached disk and partial stores remain retained; do not
format, clean or restart them to make an application test pass.

The historical manager used loopback55276 with mutual TLS and task-lifetime
certificates. It set `SUPABASE_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1` before
the pinned CLI/helper. Official controls and versioned source were inspected
after a startup inspection was rejected over an unverified PostHog connection.
The no-op/send guards do not explain the unrelated startup failure. The
endpoint is no longer a service; never publish it or print certificates,
status JSON, local keys, passwords or email codes.

A replacement execution's proxy/certificate context differed from the original,
which explained registry TLS failures when stale configuration was reused.
Normal TLS and checksum checks were preserved. These are tooling lessons, not
instructions to prepare another replacement VM.

## Application readiness is a separate checkpoint

All eight pinned core Supabase images are cached. The retained container-event
replay corrects the earlier first-job inference: Realtime's schema/seed/health
container exited0, then Storage API1.67.20 exited255. PostgreSQL was killed by
CLI cleanup afterward; its137 is not an observed OOM. Realtime's private log and
generated environment were captured, but the old filter omitted Storage.
Before/after guest memory and event evidence are retained, with no observed OOM.
These facts do not establish a healthy core.
A network-disabled, built-in-only Node probe in the same cached Storage image
also exits255: `exec /usr/local/bin/node: input/output error`. This happens before
app imports or database access.

The subsequent read-only cache audit validates all 14 raw Storage image layers:
compressed SHA256 and gzip CRC checks and uncompressed DiffIDs all match. The
resolved public `lib/ld-musl-x86_64.so.1` entry is a regular 666,216-byte ELF file,
SHA256 `99eab0629ed5e6bc258bea735a128d1de30c5a8b52f39eed4919452d03c6c4ee`.
The original container and a separate never-started container instead materialize
that loader as a regular zero-byte file. The ignored audit receipt is
`.local/vm/run-root-20261114T004158/job-006-storage-cached-loader-layer-audit/summary.json`.
This is a measured local image/cache materialization discrepancy. It does not
establish damaged public layers, physical I/O damage or an application defect.
The audit changed no unpacked snapshot and performed no repair.

The supported public-image export completed. A separate empty Docker store with
dedicated containerd was qualified, but its offline import ended with
`unexpected EOF` after584.272seconds and only three image references loaded.
The VM/controller then stopped; the queued failure diagnostic never ran.
Recovery did not complete and is no longer an active work plan. Preserve the
original/partial stores and receipts. No application database, candidate
migration or fixture import completed through this workaround; current
verification/publication status belongs in [PROGRESS](../PROGRESS.md).
Neither successful Docker startup nor a pulled image establishes a working app.

The reduced local stack excludes Studio, analytics, Vector and Edge runtime
using the CLI's supported exclusions; it retains health checks. Follow the
fixed local PostGIS containment and independent catalog/security checks in
[local setup](../LOCAL_SETUP.md) before importing fresh disposable fixtures.
Coordinate the candidate source and migration order first. Never rewrite a
ledger or replay an existing fixture import merely to match a checklist.

Local Chrome on the user's computer has a different loopback network from this
execution. A working VM-local URL does not establish that Chrome can reach it.
Qualify a supported development connection before claiming browser acceptance.
Keep signed-in production accounts out of mutation tests.

Native Android compilation/emulation and Traccar stacks competed with this
software-emulated database for memory and CPU. Serialize heavy work; prefer a
qualified hosted Android device for native runtime review. Native permissions,
background updates, physical GPS hardware, hosted gateway operation and
production simulator liveness require their own evidence.

The separate standalone ARM64 Android 1.2.0/code 10 test APK is now built and
statically qualified, SHA256
`a7f4e3609e3be8ea9eaa1f4ff0aed8581aea99ecd3d7c2a734279600a1c7b441`.
Its executable inputs match source checkpoint
`4b7af44b772d92b7c56024613fba7b1a766340aa`; the creation-base/dirty-freeze receipt
is retained separately. Required release lint/sign/package checks completed,
the exact APK was saved for handoff, and the native resource window was released
after task-owned process shutdown/cache-lock checks. No device installation or
native runtime acceptance occurred. See the [Android device runbook](ANDROID_DEVICE_TESTING.md)
for its static checks, prior build receipts and remaining device test boundaries.

Local default Playwright Chromium was prepared with
`.local/chromium-20261114/activate.sh` in the root-owned job environment.
Its pinned Chrome Headless Shell151.0.7922.34 passed actual synthetic-page
interaction at1280×800 and390×844. This is tool readiness, not Loadgistic review.
The complete Chrome binary's first launch hit the host's AF_UNIX denial; no
socket workaround or test weakening was applied. Explicit branded/headed cases
still need a permitted environment.
