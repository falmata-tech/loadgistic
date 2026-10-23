---
name: loadgistic-release
description: Prepare or resume an authorized Loadgistic web deployment, Android build/signing or Play testing release. Use for release readiness, artifact reuse and interrupted rollout. Excludes ordinary edits, other apps and permission to publish by itself.
---

# Loadgistic release

Confirm this skill's repository root and `git status --short`. Read only the
active release checkpoint in `docs/PROGRESS.md` first, then the applicable section
of `docs/PRODUCTION_AUTHORITY.md`. Existing source, target, artifact and approval
records remain authoritative; this skill grants no additional permission.

Resume the first incomplete dependency. Distinguish local implementation, focused
tests, agent-led visual/workflow review, terminal same-source CI, signing and
actual publication. Follow the October 22 visual-review rule in `AGENTS.md`;
do not turn its self-review into permission for a hosted write or deployment.
Do not restart completed preparation or infer green status from partial jobs.
Use BASE-DEP-001 for required gates. Use the test-repair procedure only when an
actual failing/stale test requires it, not as a fresh whole-repository audit.

Keep artifact creation source and current tested source separate. Reuse exact
approved Android bytes and frozen web packages only after reviewed executable-
input equivalence and current required gates. Do not relabel receipts, rebuild
only because tests/docs changed, or export/use a signing key without its actual
scoped authorization. If build inputs changed, prove their effect before reuse.

Finish stable checks and immutable packaging before refreshing short-lived
backup/security prerequisites. Never alter freshness timestamps or suppress
findings. For database/configuration operations, read the exact approved SQL,
target, backup/restore and rollback plan; stop on drift or ambiguous writes.
Follow the existing bounded operator rather than inventing a new release script
or using a broader credential. Keep credentials and private reports protected.

Load provider detail only for the selected operation:

- Web: `docs/operations/NETLIFY_RELEASE_VERIFICATION.md` and the current immutable
  package/readiness evidence. Verify the live deployment, health and authorized
  user/private-file flows after promotion.
- Android/Play: `docs/operations/GOOGLE_PLAY_SETUP.md`, the exact candidate's
  signing review and the current required installed-device checks. Verify track,
  version, review state and tester link; tester eligibility is not enrollment.
- Repeated release waste: the matching entry in `docs/AGENT_LESSONS.md`; improve
  the measured cause without adding unrelated features or redundant approvals.

After an authorized write, verify its actual destination/readback before the
next dependent write. Preserve failure evidence and stop ambiguous retries.
Report what is live, what testers can install, and any remaining action plainly.
