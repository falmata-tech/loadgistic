# PostGIS rebuild alternative — assessment only

The owner asked whether recreating the insecure setup can retain data. No live
rebuild, deletion, extension relocation or privilege change has been performed.

Supabase documents backup, extension/dependency removal, reinstalling into a
different schema, and restoring dropped dependencies/data as an alternative to
provider-assisted relocation:
https://supabase.com/docs/guides/database/extensions/postgis#troubleshooting

This establishes a supported migration strategy, not proof that our current
connection can perform every step or that an ordinary full restore will preserve
the new schema placement. The extension and spatial_ref_sys are both owned by
supabase_admin; the connected postgres role has no owner membership. PostGIS
3.3.7 is non-relocatable. Never edit extension catalogs or grant an internal role
as a workaround. Do not drop the table independently of the extension.

Live catalog inventory found 11 generated geography columns across shipments,
profile_routes, capacities, organizations and provider_profiles. Their numeric
source coordinates must be preserved. Indexes, functions, generated expressions,
search paths, casts and operators also need a complete dependency review; these
11 columns are not a complete inventory. Pending migration 093 adds further
geometry dependencies. Copying only spatial_ref_sys would not restore them.

## Proposed isolated rehearsal, before any live action

1. Verify the protected backup and restore into a disposable isolated database;
   retain the existing production system unchanged.
2. Inventory extension and application dependencies and verify ordinary-role
   extension-management permissions in that isolated environment. Stop at an
   ownership denial; no higher-role fallback.
3. Design PostGIS installation in a dedicated schema absent from the Data API's
   exposed schemas, with explicit service access and denied browser privileges.
   Reinstallation may still retain provider ownership, which is acceptable.
4. Prepare an explicit restore/rebuild map for application columns, data, custom
   spatial reference entries, functions, indexes and search paths. Do not replay
   old extension-install statements into public or recreate old broad grants.
5. Prove matching record counts/content, Auth/Storage consistency, spatial query
   correctness/performance, browser denials, all migrations and full application
   tests on the isolated copy. Verify advisor/catalog behavior for the new layout;
   any changed security gate needs a separately reviewed contract and regression.
6. Only then prepare an exact production plan, verified fresh backup, bounded
   maintenance window, hashes, rollback and owner review. No destructive hosted
   action is authorized by this feasibility question.

The prepared owner-side RLS/ACL repair remains the smallest existing solution.
A successful rebuild could provide another route; it has not yet been rehearsed
or approved for production. Do not interpret the general documentation as proof
that deletion is safe or automatically permitted on this specific project.
