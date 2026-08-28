-- FEAT-VER-001
-- Apply the same explicit PL/pgSQL variable scope to the review note input.

do $migration$
declare
  definition text;
  corrected text;
begin
  select pg_get_functiondef(procedure.oid) into definition
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid=procedure.pronamespace
  where namespace.nspname='public'
    and procedure.proname='review_managed_verification'
    and pg_get_function_identity_arguments(procedure.oid)='actor_user_id uuid, request_id uuid, review_status text, review_note text';
  if definition is null then raise exception 'MANAGED_VERIFICATION_REVIEW_FUNCTION_MISSING'; end if;
  corrected:=replace(definition,E'AS $function$\n',E'AS $function$\n#variable_conflict use_variable\n');
  if corrected=definition then raise exception 'MANAGED_VERIFICATION_REVIEW_SCOPE_NOT_PATCHED'; end if;
  execute corrected;
end;
$migration$;
