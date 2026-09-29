# Data API request boundary

FEAT-SEC-001 / ADR-065. Migration `097_data_api_request_guard.sql` adds a
PostgREST pre-request function in `loadgistic_api_guard`, an unexposed schema.
It uses invoker rights and the actual PostgreSQL role. Server service-role
requests proceed; authenticated callers can invoke only their public
`current_user_projection` via GET, HEAD or POST. All other callers fail with
`42501 / BROWSER_DATA_API_ACCESS_DENIED` before the requested SQL executes.
The function does not accept a header claiming service authority.

## Verification

After applying migrations on isolated local services and importing fixtures:

```sh
node scripts/verify-data-api-guard.mjs
```

This checks the installed function against the migration, exercises actual SQL
roles, and injects rolled-back catalog failures. A temporary synthetic table
with deliberately permissive grants and RLS proves denial independently of
ordinary ACLs. Real REST reads/writes, a callable test RPC, GraphQL and forged
headers are denied for browser roles. Service reads/writes, geography and
own-identity access remain available. Temporary objects are removed, while the
installed guard remains active for the subsequent browser suite. The verifier
accepts only the fixed local database and a loopback API URL.

CI runs it in both validation and browser jobs. The ordinary database RLS/ACL
catalog gate remains independent and mandatory. Removing or relaxing that gate
is not an accepted way to make this guard pass.

## Hosted activation

Use the production authority procedure. Verify the exact project independently,
review the immutable SQL hash, and retain a protected configuration snapshot,
fresh encrypted database backup and matching restore evidence. Refuse an
existing unrelated pre-request hook or a database-specific override. Never use
broad configuration sync or change extension ownership.

Apply the migration within one transaction with its five-second lock limit and
30-second statement limit. A reviewed incident bootstrap can apply the exact
same artifact while the production application still uses the earlier identity
RPC; do not falsely advance the ordinary migration ledger over unapplied files.
The later ordered migration replay is supported and tested.

Observe actual HTTP denial after configuration reload, plus preserved server
access, own-identity SQL behavior and public application health. A successful
NOTIFY or SQL commit alone is insufficient. Keep attempt/evidence records; stop
writes after an ambiguous response rather than automatically retrying. Local
browser evidence does not establish a successful hosted user login.

On incompatibility, stop application promotion and repair forward. Do not disable
the hook while underlying browser grants remain open. Any alternate containment
or rollback requires an exact reviewed plan. No application records or extension
objects are deleted or rebuilt by this migration.

## Monitoring and limits

The security workflow has an independent HTTP probe using only the public
`LOADGISTIC_MONITOR_PUBLISHABLE_KEY` repository variable. It uses GET requests,
selects no table rows, rejects service credentials and requires the exact guard
denial. A gateway error, generic permission error or unavailable API fails the
check. Missing configuration also fails visibly. It becomes an active schedule
only after the workflow reaches main and the public key is provisioned.

This guard protects requests that pass through PostgREST, including the tested
GraphQL route. It does not secure direct SQL, Storage or Realtime. Verify any
additional access path separately. It does not enable table RLS, revoke existing
table grants or clear the corresponding Supabase advisor finding. The underlying
owner repair and ordinary release gates remain necessary for application
promotion. No blanket guarantee against future administrator changes is made.

Supabase documents this mechanism in
[Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
