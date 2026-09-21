# Provider-assisted PostGIS relocation readiness

Scope: Loadgistic only; FEAT-SEC-001, BASE-DEP-001, NR-01/04/05/06/08.
The owner supplied Supabase Support's reply from Paul Ibeabuchi on September 20.
Support offers to relocate PostGIS from public to extensions after backup
confirmation. This differs from the original RLS/ACL-only repair request.

## Ordered readiness plan

1. Confirm current exact project and existing deployment; retain the API guard.
2. Take a fresh encrypted database backup and prove full isolated recovery.
3. On an isolated copy, verify application data, geography and pending migrations
   with PostGIS in extensions. Do not edit provider catalogs or escalate roles.
4. Keep the API monitor independent of an extension table's public REST route:
   after relocation that route should be absent. Preserve exact guard-denial
   assertions on existing application relations and own-identity RPC.
5. Send the owner-approved concise confirmation: exact project, restored backup,
   requested move and version compatibility limit. Keep internal hashes, test
   inventories and our follow-up checks on our side.
6. After provider confirmation, independently verify extension placement, absence
   from exposed schemas, spatial queries, guard denials and catalog/advisor gates.
   Then complete the ordered schema/configuration/application release.

The target-layout experiment restores a second logical copy with the extension
installed in its intended schema. It can prove application compatibility and
data preservation for that copy; it does not reproduce Supabase's privileged
in-place relocation or attest to their execution. Only Supabase performs that
provider-side procedure. Do not describe backup creation as a completed repair.

## Verified preparation — September 20

Fresh archive: `.local/backups/security-2026-09-20T17-31-02.590Z.dump.aes256gcm`.
Plain archive SHA-256:
`c456f4a43be6db3d4de2ae76e60cc9ec2c00c77660744a9976ec844214a7e50d`.
Authenticated decryption and full isolated restore passed (1,860,696 bytes,
2,272 archive entries). The target-layout copy preserved row counts and content
digests across 87 public/Auth/Storage/reference tables. Service spatial predicates
and the actual geographic capacity query matched. All 21 pending migrations
077–097 applied on the copy; indexes remained valid and the unchanged catalog
security gate passed. The container had no network, host mounts or enabled cron
jobs and was removed. This was a logical-copy compatibility check, not execution
of Supabase's privileged relocation. PostGIS remained version 3.3.7.

Private evidence: `.local/postgis-source-restore-evidence.json` and
`.local/postgis-target-layout-evidence.json`. The copy harness initially missed
quoted extension-function identifiers; after correcting that demonstrated harness
bug, the complete comparison and migration checks passed. Original data was
never rewritten, and provider catalogs were never edited.

The monitor regression failed before the adjustment and passed afterward;
305 unit tests, specs/source/types, the real local SQL/REST/GraphQL/fixture-Auth
verifier and three live anonymous probes passed. No denial assertion was weakened.

The owner approved the shortened confirmation. SMTP accepted it for
support@supabase.com at 2026-09-20T18:25:28.436Z with zero rejected recipients.
Private receipt: `.local/postgis-relocation-confirmation-submission.json`.
The provider's in-place relocation is now the requested repair; the earlier
RLS-only attachment remains historical and was not resent. Provider completion
still requires independent verification. No agent-hosted database/configuration
write is part of this preparation.

Current application fix: e52a2a3 passed CI 35519622994, including 160 browser
passes without retries and eight opt-in skips. Monitoring follow-up 6b3d6cd
also passed every job in CI 35526988445: 160 browser passes without retries,
eight opt-in skips. The read-only catalog inspection now locates spatial_ref_sys
through actual PostGIS extension membership, so moving it out of public does
not break the inspection. Security and full application promotion remain separate.


## Independent completion check — 2026-09-21

Live read-only catalogs confirm PostGIS 3.3.7 in `extensions` and no public table
without RLS. The unchanged full database security gate, Data API guard catalog
checks and service-role spatial query checks pass. Security advisors contain
no ERROR; remaining warnings identify own-identity projection and leaked-password
protection, separately reviewed under the normal release policy. Evidence:
`.local/release-20260921-preflight.json`. Provider email acknowledgement is not
needed to establish the observed schema state. The app release is separate.
