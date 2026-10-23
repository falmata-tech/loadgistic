-- Restore only the exact retained inbox definition; no row/permission changes.
-- The matching UI fails closed (no Claim) when an older inbox lacks can_claim.
begin;
select pg_advisory_xact_lock(8030144);
do $rollback$
declare signature text:='public.managed_support_inbox(uuid,text,integer,integer)';
 backup_signature text:='public.managed_support_inbox_pre_claim144(uuid,text,integer,integer)';
 receipt jsonb;original text;
begin
 if to_regprocedure(backup_signature) is null then raise exception 'SUPPORT_CLAIM_BACKUP_MISSING';end if;
 receipt:=obj_description(backup_signature::regprocedure,'pg_proc')::jsonb;
 original:=replace(pg_get_functiondef(backup_signature::regprocedure),
  'CREATE OR REPLACE FUNCTION public.managed_support_inbox_pre_claim144(',
  'CREATE OR REPLACE FUNCTION public.managed_support_inbox(');
 if receipt->>'migration' is distinct from '144' or receipt->>'original_signature' is distinct from signature
  or md5(original) is distinct from receipt->>'before_md5'
  or md5(pg_get_functiondef(signature::regprocedure)) is distinct from receipt->>'after_md5'
  or md5(pg_get_functiondef('public.claim_managed_support_conversation(uuid,uuid)'::regprocedure)) is distinct from receipt->>'claim_md5'
  or (select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'owner'
  or (select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'acl'
  or (select to_jsonb(proconfig) from pg_proc where oid=signature::regprocedure) is distinct from receipt->'config'
  or (select proowner::regrole::text from pg_proc where oid=backup_signature::regprocedure) is distinct from receipt->>'owner'
  or (select to_jsonb(proconfig) from pg_proc where oid=backup_signature::regprocedure) is distinct from receipt->'config'
  or has_function_privilege('anon',backup_signature,'EXECUTE') or has_function_privilege('authenticated',backup_signature,'EXECUTE')
  or has_function_privilege('service_role',backup_signature,'EXECUTE') then raise exception 'SUPPORT_CLAIM_ROLLBACK_DRIFT';end if;
 execute original;
end $rollback$;
notify pgrst,'reload schema';
commit;
