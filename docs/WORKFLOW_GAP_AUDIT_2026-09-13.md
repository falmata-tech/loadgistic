# Fleet setup and related workflow gaps — 2026-09-13

Scope: read-only source review and 18 local page/detail checks using existing
fleet-owner, independent-provider, and administrator fixtures. No business
records, permissions, assignments, production services, or application code were
changed. Test authentication sessions were used only to inspect authorized pages.
This is a focused workflow audit, not a whole-application or Production sign-off.

## Confirmed findings

Remediation checkpoint: all six findings below are corrected locally by
FEAT-FLT-001 / FEAT-IAM-001 and migrations 081–082. The original findings are
retained as the audit baseline, not a description of the repaired local UI.

- My Fleet offers Invite driver at the top and within Driver access; invitation
  email, OTP acceptance, explicit membership and assignment work from zero data.
- Contact edits and confirmed removal are owner-scoped and preserve history.
- Listing and assignment now require matching active company membership.
- Truck selection and bounded list context survive assignment/permission saves.
- Owned truck details can be corrected without changing identity or history.
- Empty Tracking/Network screens provide role-appropriate setup actions.

The desktop and phone workflow creates both identities through real local Auth
OTP (no seeded driver shortcut), delivers the invitation through local Mailpit,
assigns a registered truck, publishes its first capacity, edits details, and
confirms revocation. SQL rollback tests and existing Fleet/trailer regressions
passed. Final gates and remote limitations are in `docs/BUILD_VERIFICATION.md`.
No production deployment is implied by this remediation checkpoint.

### 1. New fleets cannot add their first Company driver — release blocker

My Fleet offers Add truck and a Driver access list, but no Add driver, invitation,
or acceptance action. The Fleet application port only lists existing Drivers and
updates their assignment/permissions; there is no production Driver-creation
route. Public provider signup is not a Company-driver join flow.

Evidence: `src/app/app/fleet/page.tsx:26`, `src/lib/fleet.js:8`,
`src/lib/fleet/supabase.js:40`, and the route inventory under `src/app/api/fleet/`.
The browser found zero Add/Invite driver controls in My Fleet or More.

Impact: an owner may register a truck but cannot supply the active Driver now
required for publication. Seeded company Drivers conceal this missing first step.

### 2. Owner-facing Driver management stops at assignment and permissions

Save driver sends only Driver ID, truck ID, Capacity updates, and Tracking
updates. The identity/contact section is display-only. There is no owner action
to correct Company-driver contact details, end fleet membership, or restore an
inactive Driver. Unassigning a truck is available but is not removal from the
fleet or revocation of the account's company association.

Evidence: `src/lib/fleet/supabase.js:40` and
`src/app/app/fleet/page.tsx:26`. Administrator account suspension is separate
and does not supply a fleet-owner offboarding workflow.

### 3. Assignment and publication disagree about membership eligibility

The Driver list and assignment command check active Driver/profile records and
matching organization IDs, but do not require the current organization-membership
row. Publication's shared active-Driver resolver does require that row.

Evidence: `supabase/migrations/050_managed_workspace_fleet.sql:76` and `:127`,
compared with `supabase/migrations/078_capacity_driver_eligibility.sql:18`.
No later migration replaces the Fleet assignment check.

Impact: a stale Driver record whose membership was removed can remain selectable
and be saved as an assignment, yet capacity publication rejects it. This is a
confirmed contract mismatch in source, not a claim that the local fixtures
currently contain such a stale Driver or that public capacity bypasses the guard.

### 4. Assign driver loses the selected truck and list position

The truck detail's Assign driver link opens `/app/fleet#driver-access` without
carrying the selected truck. Saving a Driver always returns to `/app/fleet`,
dropping Driver pagination and the expanded Driver. This makes a real saved
change difficult to follow in a larger fleet.

Evidence: `src/app/app/fleet/[id]/page.tsx:24` and
`src/app/api/fleet/drivers/[id]/permissions/route.ts:20`.

### 5. Registered truck details cannot be corrected by the owner

Truck registration captures make, model, fixed configuration, and plate. Owned
detail provides capacity editing and, for tractors, attached-trailer selection,
but no correction form for those registration details. Add truck is not an
acceptable substitute because it creates a different truck identity/history.

Evidence: `src/app/app/fleet/new/page.tsx`,
`src/app/app/fleet/[id]/page.tsx:23`, `src/lib/fleet.js:16`, and
`src/lib/fleet/vehicles-supabase.js`.

### 6. Empty setup states do not lead to the missing prerequisite

Start Tracking renders a required empty truck selector and disabled submit when
there are no trucks, without an Add truck action or a Company-driver instruction.
Network says to add or assign a truck but does not link to the appropriate task.

Evidence: `src/components/provider-shipment-form.tsx:61` and
`src/app/app/network/page.tsx:21`. The inspected rendered forms also have no
direct truck-setup links. These branches were reviewed in source; no fresh
production account was created to trigger them.

## What the inspection did verify

- Fleet and independent-provider Fleet, Start Tracking, Network, Verification,
  and More pages loaded locally.
- Sample administrator Users, Drivers, Trucks, and Tracking inventory/detail
  pages returned HTTP 200 and rendered record pages, rather than the generic
  application error. This does not prove every record mutation works.
- Existing Driver assignment/permission controls and Add truck routes exist.
  This audit did not submit mutations or repeat delivery/Google/Storage tests.

## Why earlier gates missed the first-driver gap

The Fleet browser test starts by expanding the first seeded Driver
(`tests/e2e/smoke.spec.ts:656`). The managed Fleet verifier also assumes an
existing owner/Driver pair. `FEAT-FLT-001` describes verification after an owner
adds a Driver but does not define the missing creation/acceptance transition.
Successful downstream assignment tests are not evidence of complete onboarding.

## Recommended repair and acceptance gate

Implement a complete My Fleet journey, not an isolated new button:

1. Add/invite Driver, with clear identity/contact fields and pending/accepted
   states. Reuse verified email/Google identity; never silently move an existing
   independent provider or another fleet's Driver into this fleet.
2. Assign the intended truck in context using the same membership eligibility
   rule as publication. Documents stay optional and visibly separate.
3. Support contact correction, unassignment, and owner-controlled offboarding
   without deleting shipment, assignment, or document history.
4. Provide truck-detail correction and actionable zero-truck/zero-Driver states.
5. Prove the journey from a fresh, empty fleet through Driver acceptance, truck
   assignment, publication, private sharing, and permitted Tracking on desktop
   and phone. Include duplicate invitation, expired invitation, non-owner,
   cross-fleet, removed membership, and revoked access cases.

Do not describe fleet onboarding as complete until that first-time journey is
tested without pre-seeding the Driver or manually inserting membership records.
