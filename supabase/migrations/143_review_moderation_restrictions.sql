-- FEAT-REV-001 / FEAT-PLY-001 / NR-43: independent restrictions remain effective.
-- Changes only the two existing service-only decision bodies; no data rewrite.
begin;
select pg_advisory_xact_lock(8030143);
do $migration$
declare signature text;backup_name text;backup_signature text;original text;patched text;old_text text;new_text text;receipt jsonb;
begin
 for signature,backup_name in values
  ('public.moderate_content_report(uuid,uuid,text,text)','moderate_content_report_pre_moderation143'),
  ('public.resolve_provider_review_dispute(uuid,uuid,text,text)','resolve_provider_review_dispute_pre_moderation143')
 loop
  backup_signature:='public.'||backup_name||'(uuid,uuid,text,text)';
  if to_regprocedure(signature) is null then raise exception 'REVIEW_MODERATION_FUNCTION_MISSING';end if;
  if to_regprocedure(backup_signature) is not null then raise exception 'REVIEW_MODERATION_BACKUP_EXISTS';end if;
  original:=pg_get_functiondef(signature::regprocedure);patched:=original;
  if not(select prosecdef from pg_proc where oid=signature::regprocedure)
   or has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
   or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'REVIEW_MODERATION_PERMISSION_DRIFT';end if;
  if signature='public.moderate_content_report(uuid,uuid,text,text)' then
   for old_text,new_text in values
    ($old$declare r content_reports%rowtype;visibility text;published boolean;$old$,
     $new$declare r content_reports%rowtype;visibility text;published boolean;review_record public.provider_reviews%rowtype;$new$),
    ($old$ if decision='HIDE' and r.review_id is not null then$old$,
     $new$ -- Serialize both decision workflows on the exact review before reading
 -- restrictions; each content report retains its own state and audit history.
 if r.review_id is not null then
  select * into review_record from public.provider_reviews where id=r.review_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
 end if;
 if decision='HIDE' and r.review_id is not null then$new$),
    ($old$  update provider_reviews set status='PUBLISHED' where id=r.review_id;$old$,
     $new$  update provider_reviews set status=case when review_record.dispute_status='REMOVED'
   or exists(select 1 from public.content_reports restriction where restriction.review_id=r.review_id
    and restriction.status='HIDDEN' and restriction.id<>r.id)
   then 'REMOVED' else 'PUBLISHED' end where id=r.review_id;$new$)
   loop
    if(length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'REVIEW_MODERATION_PATCH_ANCHOR_DRIFT';end if;
    patched:=replace(patched,old_text,new_text);
   end loop;
   if strpos(original,'managed_actor_has_permission(actor_user_id,''TRUST'')')=0
    or strpos(original,'REPORT_ALREADY_REVIEWED')=0 or strpos(original,'CONTENT_REPORT_')=0
    then raise exception 'REVIEW_MODERATION_CONTENT_CONTRACT_DRIFT';end if;
  else
   old_text:=$old$    status=case when resolution='REMOVED' then 'REMOVED' else 'PUBLISHED' end,$old$;
   new_text:=$new$    status=case when resolution='REMOVED'
      or exists(select 1 from public.content_reports restriction where restriction.review_id=review.id and restriction.status='HIDDEN')
      then 'REMOVED' else 'PUBLISHED' end,$new$;
   if(length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'REVIEW_MODERATION_PATCH_ANCHOR_DRIFT';end if;
   patched:=replace(patched,old_text,new_text);
   if strpos(original,'provider_tracking_trust_actor(actor_user_id)')=0
    or strpos(original,'where id=target_review_id for update')=0
    or strpos(original,'RATING_ALREADY_REVIEWED')=0 or strpos(original,'PROVIDER_REVIEW_DISPUTE_RESOLVED')=0
    then raise exception 'REVIEW_MODERATION_RATING_CONTRACT_DRIFT';end if;
  end if;
  receipt:=jsonb_build_object('migration',143,'original_signature',signature,'before_md5',md5(original),
   'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),
   'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure),
   'config',(select proconfig from pg_proc where oid=signature::regprocedure),
   'comment',obj_description(signature::regprocedure,'pg_proc'));
  execute replace(original,'CREATE OR REPLACE FUNCTION public.'||split_part(split_part(signature,'.',2),'(',1)||'(',
   'CREATE OR REPLACE FUNCTION public.'||backup_name||'(');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_signature);
  execute patched;
  receipt:=receipt||jsonb_build_object('after_md5',md5(pg_get_functiondef(signature::regprocedure)));
  execute format('comment on function %s is %L',backup_signature,receipt::text);
 end loop;
end $migration$;
notify pgrst,'reload schema';
commit;
