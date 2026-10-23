# Supabase security options — researched 2026-09-17

Scope: Loadgistic only. The research below was completed on 2026-09-17 without
hosted changes. On 2026-09-18 the owner selected the pre-request guard; migration
097 was implemented, tested and applied as production API containment. Live
REST/GraphQL denial, service access and public site health passed. See
DATA_API_GUARD.md and ../PROGRESS.md. The underlying RLS/ACL warning remains;
these historical research notes do not claim that the owner-side repair occurred.

## Finding

The smallest tested containment does not need extension ownership or deletion:
use Supabase's documented PostgREST pre-request hook to admit the service role
and authenticated callers' existing own-identity lookup, rejecting all other
browser-role Data API requests. Loadgistic already authorizes business data on
the server, making this fit its current architecture. Do not confuse containing
API exposure with enabling RLS or repairing the underlying table ACLs.

## Compared options

| Option | Effect and project fit | Evidence / limits |
|---|---|---|
| Data API pre-request guard | Blocks anonymous/authenticated direct REST and GraphQL access; retains server operations and own-identity lookup. No data movement, extension changes or application rewrite. Recommended smallest containment. | Local actual HTTP tests passed, including warmed requests, spoofed headers, unchanged synthetic rows, service writes, identity and real Auth/signup. Browser workflow verification recorded below. It is an additional API control, not a replacement for database privileges/RLS. |
| Revoke browser USAGE on public schema | A database-level boundary we have authority to manage, despite lacking ownership of spatial_ref_sys. | Hosted metadata confirms schema grant authority. Local rollback tests denied fresh and prepared queries and preserved service access, but broke the current identity RPC. Requires an identity-adapter change and connection/cache review. PostgreSQL documents cached-lookup limitations; not a one-command drop-in fix. |
| Dedicated exposed API schema, hide public | Keeps PostGIS and data in place; exposes only intentionally designed API views/functions. A strong longer-term boundary. | Supabase documents this design. The server also uses public-schema tables/RPCs through PostgREST, so simply removing public from exposed schemas breaks the app. Needs service views/wrappers, adapter configuration, grants and full tests. |
| Disable Data API | Stops the automatic REST endpoints. | Also disables Loadgistic's current Supabase server repository. Requires switching database adapters; not an immediate compatible fix. |
| Owner-side RLS/ACL repair | Smallest permanent correction to this existing table; tested SQL and support request already prepared/sent. | Current postgres connection lacks table-owner authority and grant option. Still awaiting provider execution. |
| Reinstall PostGIS in a separate schema | Documented rebuild/restore route; can preserve data with a tested restore plan. | Eleven current generated geographic columns plus functions/indexes depend on it. A complete dependency restore is needed; copying one table is insufficient. More work and risk than containment. |
| Hide/ignore the warning alone | Changes reporting, not access. | Rejected: actual anonymous write grants were independently verified. No warning suppression or name-only exemption was added. |

## Hosted read-only findings

- Project identity: loadgistic / tpwyyzoqijjmbvsmmvcm, checked independently.
- Public schema belongs to pg_database_owner; current postgres has owner authority
  and USAGE grant option. The earlier inference that table ownership prevented
  every possible security control was too broad.
- Current Data API schemas: public,graphql_public; extra search path public,extensions.
- No pgrst.db_pre_request setting was found for authenticator in catalog role
  settings. The management API response does not expose that setting, so its
  omission is not evidence about every provider-side setting. Verify effective
  configuration and preserve any discovered existing hook before applying.
- Current postgres has CREATEROLE and authenticator membership. Supabase explicitly
  documents configuring authenticator's pre-request setting; this is not granting
  the agent a provider-internal role.
- spatial_ref_sys is in no replication publication. anon/authenticated cannot log
  in directly. These are observed facts, not permission to ignore future surfaces.

## Local proof and cleanup

The experiment used an intentionally exposed synthetic table, not production data.
It first demonstrated browser reads and no-op writes, then configured the guard
and verified denial. Local GraphQL was initially disabled; the experiment enabled
it temporarily, tested actual GraphQL requests and restored its initial disabled
state. Original application tables and PostGIS permissions were not weakened.

Initial complete run: 41 passing assertions, including baseline/cleanup checks.
The guard blocked GET/POST/PATCH/DELETE for anon/authenticated, GraphQL requests
for both roles, spoofed server headers and anonymous identity lookup. Authenticated
own-identity, service application reads/writes, PostGIS reference access and actual
managed Auth/signup remained functional. Blocked writes left the synthetic row
unchanged. Requests were warmed before the hook change. The guard became active
through documented configuration reload without a server restart.

The extended run passed all eight desktop/mobile account and fleet scenarios
with the guard enabled (2.9 minutes): login, role projection, actual email-change
and deactivation, invitation, assignment, publication and access revocation.

Its initial ten-second cleanup reload check expired. Independent follow-up
confirmed the hook setting was absent and original anonymous HTTP behavior had
returned, then removed only the experiment's function/schema/table and temporary
GraphQL extension. The unchanged database security gate passed afterward. This
makes observable HTTP postconditions essential; a fixed delay alone is insufficient.

Private evidence: .local/security-options-http-evidence.json,
.local/security-options-schema.log, .local/api-guard-hosted-assessment.json,
.local/public-schema-authority.json and .local/postgrest-config-assessment.json.
All scratch objects, the experimental hook setting and temporary GraphQL extension
are removed at cleanup; the existing database security gate is then rerun.

## Limits and a production proposal

A pre-request hook covers PostgREST. Local tests confirm this installation's
GraphQL endpoint passes through it too. It does not protect arbitrary direct SQL,
Realtime or Storage operations. Those paths keep their own controls; confirm
hosted routing, publication state and negative tests before claiming containment.

The current Supabase linter checks RLS, table SELECT grants and exposed schemas;
it does not inspect our hook logic. Therefore this option is expected to leave
rls_disabled_in_public visible while blocking its Data API access path. Existing
catalog/advisor release gates are unchanged and must not be marked passing from
this experiment. A temporary containment acceptance, if desired, requires an
explicitly reviewed security decision with scoped evidence and monitoring; it
must not silently turn into a permanent ignored alert.

Before a hosted change: define the accepted threat boundary in FEAT-SEC-001,
prepare the exact hook SQL and digest, verify target/effective existing hook and
protected backup, preserve deployment compatibility, run regression gates, and
verify anonymous/authenticated denial plus service and identity success in the
hosted runtime. Stop if activation is ambiguous. Recovery must preserve
containment; removing the guard while original grants remain would reopen exposure.
No hosted command was run as part of this research.

## Primary sources

- Supabase security controls and pre-request procedure:
  https://supabase.com/docs/guides/api/securing-your-api
- PostgreSQL schema privileges and cached-lookup caveat:
  https://www.postgresql.org/docs/16/ddl-priv.html
- PostgREST schema access requires USAGE:
  https://postgrest.org/en/stable/references/api/schemas.html
- Supabase custom API schemas:
  https://supabase.com/docs/guides/api/using-custom-schemas
- Supabase's delegated extension management (ownership metadata does not imply
  all extension operations are unavailable; not a reason to skip dependency review):
  https://github.com/supabase/supautils/blob/master/test/sql/privileged_extensions.sql
- Supabase PostGIS rebuild/restore and provider-assisted relocation:
  https://supabase.com/docs/guides/database/extensions/postgis#troubleshooting
- Actual advisor condition (checked 2026-09-17; upstream can change):
  https://github.com/supabase/splinter/blob/main/lints/0013_rls_disabled_in_public.sql
