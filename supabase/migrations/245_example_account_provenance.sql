-- FEAT-SIM-001 / NR-83. Include the imported synthetic pilot in the read-only
-- account label. The existing all-current-owners requirement still applies.
begin;
select pg_advisory_xact_lock(8030245);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $migration$
declare
 definition text:=pg_get_functiondef('public.capacity_owner_documents(uuid[],uuid[])'::regprocedure);
 anchor constant text:=$old$identity.raw_app_meta_data->>'fixture_source'='loadgistic'$old$;
 replacement constant text:=$new$identity.raw_app_meta_data->>'fixture_source' in ('loadgistic','loadgistic-production-pilot-v1')$new$;
begin
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>2 then
  raise exception 'EXAMPLE_ACCOUNT_PROVENANCE_DRIFT';
 end if;
 execute replace(definition,anchor,replacement);
end $migration$;
commit;
