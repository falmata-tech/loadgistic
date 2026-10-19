-- Restores the exact prior function without rewriting permissions or history.
-- An old activation command can revoke grants; disable that control when using
-- this rollback, or retain the corrected function and repair forward.
begin;
select pg_advisory_xact_lock(8030142);
do $rollback$
declare signature text:='public.managed_admin_record_command(uuid,text,uuid,jsonb)';
 backup_signature text:='public.managed_admin_record_command_pre_staff142(uuid,text,uuid,jsonb)';receipt jsonb;original text;
begin
 if to_regprocedure(backup_signature) is null then raise exception 'STAFF_ACTIVE_BACKUP_MISSING';end if;
 receipt:=obj_description(backup_signature::regprocedure,'pg_proc')::jsonb;
 original:=replace(pg_get_functiondef(backup_signature::regprocedure),
  'CREATE OR REPLACE FUNCTION public.managed_admin_record_command_pre_staff142(',
  'CREATE OR REPLACE FUNCTION public.managed_admin_record_command(');
 if receipt->>'migration' is distinct from '142' or receipt->>'original_signature' is distinct from signature
  or md5(original) is distinct from receipt->>'before_md5'
  or md5(pg_get_functiondef(signature::regprocedure)) is distinct from receipt->>'after_md5'
  or (select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'owner'
  or (select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'acl'
  or (select to_jsonb(proconfig) from pg_proc where oid=signature::regprocedure) is distinct from receipt->'config'
  or has_function_privilege('anon',backup_signature,'EXECUTE') or has_function_privilege('authenticated',backup_signature,'EXECUTE')
  or has_function_privilege('service_role',backup_signature,'EXECUTE') then raise exception 'STAFF_ACTIVE_ROLLBACK_DRIFT';end if;
 execute original;
end $rollback$;
notify pgrst,'reload schema';
commit;
