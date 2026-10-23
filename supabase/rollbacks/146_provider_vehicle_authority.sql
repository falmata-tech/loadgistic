-- ADR-079 / FEAT-FLT/VER-001 / NR-47.
-- There is deliberately no executable restore, DROP, REVOKE or transaction here.
-- Earlier discovery definitions do not understand newer Draft trucks or retained
-- Live signals whose provider has lost qualification. Restoring them can disclose
-- those records. Migration150's compatibility marker would also remain true.
--
-- Keep the current publication/discovery gates and erasure protections in place.
-- A compatible application rollback or separately owner-reviewed forward repair
-- must name its exact target, affected reads/writes, backup and rollback evidence,
-- while preserving ongoing authorized Tracking. Do not assume an older single-
-- truck application is compatible with the new fleet schema.
--
-- provider_authority_function_backups retains original/candidate fingerprints,
-- ownership, ACLs, settings and comments for diagnosis and an exact recovery plan.
-- provider_vehicle_authority_reviews and original verification requests retain
-- their history under the existing authorized retention/erasure workflow.
do $deny_unsafe_rollback$
begin
 raise exception using errcode='55000',message='PROVIDER_AUTHORITY_FORWARD_REPAIR_REQUIRED',
  detail='Earlier discovery rules can expose Draft or unqualified trucks and invalidate the provider-fleet runtime contract. Keep current gates and use a separately reviewed compatible recovery plan.';
end $deny_unsafe_rollback$;
