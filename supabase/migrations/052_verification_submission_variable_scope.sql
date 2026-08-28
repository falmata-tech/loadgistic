-- FEAT-VER-001
-- Migration 051 exposed an ambiguous PL/pgSQL variable/column name on first
-- execution. Recompile only that function with an explicit variable conflict
-- rule; qualified table columns remain authoritative everywhere else.

do $migration$
declare
  definition text;
  corrected text;
begin
  select pg_get_functiondef(procedure.oid) into definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid=procedure.pronamespace
  where namespace.nspname='public'
    and procedure.proname='submit_managed_verification'
    and pg_get_function_identity_arguments(procedure.oid)='actor_user_id uuid, command jsonb';
  if definition is null then raise exception 'MANAGED_VERIFICATION_FUNCTION_MISSING'; end if;
  corrected:=replace(definition,E'AS $function$\n',E'AS $function$\n#variable_conflict use_variable\n');
  if corrected=definition then raise exception 'MANAGED_VERIFICATION_FUNCTION_SCOPE_NOT_PATCHED'; end if;
  execute corrected;
end;
$migration$;
