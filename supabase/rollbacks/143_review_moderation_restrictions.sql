-- Exact prior definitions only. Disable conflicting moderation controls before
-- restoring the known old publication behavior; persisted decisions stay intact.
begin;
select pg_advisory_xact_lock(8030143);
do $rollback$
declare signature text;backup_name text;backup_signature text;receipt jsonb;original text;originals text[]:='{}';
begin
 -- Validate both functions before restoring either; any drift aborts all work.
 for signature,backup_name in values
  ('public.moderate_content_report(uuid,uuid,text,text)','moderate_content_report_pre_moderation143'),
  ('public.resolve_provider_review_dispute(uuid,uuid,text,text)','resolve_provider_review_dispute_pre_moderation143')
 loop
  backup_signature:='public.'||backup_name||'(uuid,uuid,text,text)';
  if to_regprocedure(signature) is null or to_regprocedure(backup_signature) is null then raise exception 'REVIEW_MODERATION_BACKUP_MISSING';end if;
  receipt:=obj_description(backup_signature::regprocedure,'pg_proc')::jsonb;
  original:=replace(pg_get_functiondef(backup_signature::regprocedure),
   'CREATE OR REPLACE FUNCTION public.'||backup_name||'(',
   'CREATE OR REPLACE FUNCTION public.'||split_part(split_part(signature,'.',2),'(',1)||'(');
  if receipt->>'migration' is distinct from '143' or receipt->>'original_signature' is distinct from signature
   or md5(original) is distinct from receipt->>'before_md5'
   or md5(pg_get_functiondef(signature::regprocedure)) is distinct from receipt->>'after_md5'
   or (select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'owner'
   or (select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'acl'
   or (select to_jsonb(proconfig) from pg_proc where oid=signature::regprocedure) is distinct from receipt->'config'
   or obj_description(signature::regprocedure,'pg_proc') is distinct from receipt->>'comment'
   or has_function_privilege('anon',backup_signature,'EXECUTE') or has_function_privilege('authenticated',backup_signature,'EXECUTE')
   or has_function_privilege('service_role',backup_signature,'EXECUTE') then raise exception 'REVIEW_MODERATION_ROLLBACK_DRIFT';end if;
  originals:=array_append(originals,original);
 end loop;
 foreach original in array originals loop execute original;end loop;
end $rollback$;
notify pgrst,'reload schema';
commit;
