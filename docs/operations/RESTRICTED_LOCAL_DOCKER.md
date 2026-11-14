# Restricted local Docker checkpoint

## Current limitation and resumption

The current managed workspace has no normal Docker client or standard managed
socket, and creating a Unix socket returns `EPERM`. Restore a Docker-enabled
environment before resuming the [normal local setup](../LOCAL_SETUP.md).

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

Stop this workaround here. First verify the managed Docker client, socket and
IPC capability; then use the existing setup, migrations and fixture preflight.
Successful daemon startup or matching image bytes do not qualify the app. Keep
the preserved receipts below separate from database, browser and service-runtime
acceptance. Current source and remaining work are in [PROGRESS](../PROGRESS.md).

Updated November 14, 2026. This records the task-owned runtime prepared on
November 13. It is an environment-specific development checkpoint, not a hosted
service or a general replacement for [normal local setup](../LOCAL_SETUP.md). Production credentials
are not required and must not be copied into it.

## Verified runtime

Docker Engine 29.9.3 has run in a task-owned Alpine 3.24.4 virtual machine under
QEMU 10.0.13 software emulation. The retained guest has four virtual CPUs, 2 GB
RAM and a protected 32 GiB task disk. Docker's official hello-world container
has executed successfully. The loopback Docker endpoint requires mutual TLS;
a client without a certificate was rejected. Compose 5.7.1 has been checked
against its upstream checksum and executed on the host and guest.

The VM avoids host-daemon installation and host privilege changes. This host
does not provide hardware virtualization or usable host Unix sockets. Attempts
with larger guests were interrupted by SIGKILL; the captured evidence does not
establish a guest out-of-memory event or an application/CI defect. The current
2 GB guest uses serialized image pulls to reduce memory pressure.

The selected command-line tools are project-local: Node 22.16.0, Supabase CLI
2.111.0, Docker CLI 29.9.3 and ShellCheck 0.11.0. Expo has its separate Node 24
runtime. Keep SDK and default shell settings for other projects unchanged.

## Resume the current runtime checkpoint

The retained execution owns its PID and network namespace. A new command can
see the same files but cannot reach that execution's loopback ports. Therefore
Docker, Supabase clients, the web server and loopback tests must run through the
owning retained shell. Earlier task-tool sessions31501/95684/95469 are historical
and must not be retried. Root-owned session 50113/run `run-root-20261114T000151`
is a historical corrected-manager receipt, not a current liveness claim. Read
the ignored `.local/vm/resume.json` and `.local/vm/active-root-runtime.json`, then
the corresponding job/exit receipts, for the current owning execution and state.
Session numbers are receipts, not permanent addresses. The cached disk is
retained. Session33989
shut down cleanly after a monitor bug: a background completion marker shared a
line with the terminal prompt. The corrected marker starts its own line and
the manager awaits actual Docker API readiness without restarting the daemon.

Reuse the active manager first. For a replacement only after verified task
shutdown, review the ignored
`.local/vm/runtime-manager.py`, its approved startup/job digests and
`.local/vm/resume.json`. Launch that manager once through a root-owned retained
PTY. It starts Docker only, verifies the disk lock and exposes protected request
and result directories in `.local/vm/active-root-runtime.json`. Use its serialized
allowlisted jobs; do not run dependent clients through a different execution.
The first jobs are Docker state inspection and one instrumented core startup.
Timeouts pause further work until root inspection; stopping the runtime uses a
graceful shutdown of its exact task-owned guest.

The manager supplies the equivalent of this environment to its serialized jobs.
Do not type shell commands into the running Python manager or run a new
execution against its inaccessible loopback endpoint:

```bash
source .local/activate-tools.sh
export SUPABASE_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1
export DOCKER_HOST=tcp://127.0.0.1:55276
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH="$PWD/.local/vm/client-tls"
export NO_PROXY=127.0.0.1,localhost,::1
export no_proxy=127.0.0.1,localhost,::1
docker info --format '{{.ServerVersion}}'
```

The two telemetry controls are set before launching the pinned Supabase CLI or
its helper. Official controls and versioned source were checked after automatic
review rejected a startup inspection over an unverified PostHog connection.
Do not retry the rejected execution or add `--create-ticket`/`--debug` to startup.
The main CLI uses no-op analytics with these controls; the inspected helper's
send guard suppresses queued analytics. A new, telemetry-disabled execution must
be qualified separately; these controls do not explain the earlier startup error.

The certificates have a short task lifetime; do not treat the endpoint as a
permanent service or publish it. Never print client keys, startup/status JSON,
local service keys, passwords or email codes. Do not interrupt the parent shell
to stop a child job: that can terminate the entire execution namespace. Use
bounded child processes and their individual status/exit receipts instead.

The ignored `.local/vm/restricted-local-docker-handoff.md` contains the precise
current process handoff. The monitored launcher and its separate exit files
distinguish a terminated VM from an unavailable application. Cached images and
the existing task disk should survive a process restart. Inspect their state;
do not format the disk or reset/import fixtures just because a listener stopped.

A replacement execution has a different temporary network proxy and public
certificate authority. Its guest must receive that execution's own configuration
through the monitored launcher. Reusing an old execution's proxy or certificate
bundle causes registry TLS failures. Preserve normal TLS and checksum checks;
do not solve this by disabling verification.

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

A supported public-image export and recovery using a fresh isolated Docker
instance with dedicated containerd are being prepared. Recovery has not
completed; preserve the original disk/cache and diagnose the bounded recovery
result before another whole-stack retry. Full PostgreSQL, Auth, REST, Storage,
Realtime and Mailpit readiness, migrations 221–225, fixture import, managed SQL/UI
verification and production activation remain pending. Neither successful Docker
startup nor a pulled image establishes a working application.

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

Native Android compilation/emulation and Traccar stacks compete with this
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

Local default Playwright Chromium is available by sourcing
`.local/chromium-20261114/activate.sh` inside the root-owned job environment.
Its pinned Chrome Headless Shell151.0.7922.34 passed actual synthetic-page
interaction at1280×800 and390×844. This is tool readiness, not Loadgistic review.
The complete Chrome binary's first launch hit the host's AF_UNIX denial; no
socket workaround or test weakening was applied. Explicit branded/headed cases
still need a permitted environment.
