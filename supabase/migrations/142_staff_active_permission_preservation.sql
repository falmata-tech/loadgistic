-- FEAT-ADM-001: an activation command preserves the current staff permissions.
begin;
select pg_advisory_xact_lock(8030142);
do $migration$
declare signature text:='public.managed_admin_record_command(uuid,text,uuid,jsonb)';
 backup_signature text:='public.managed_admin_record_command_pre_staff142(uuid,text,uuid,jsonb)';
 original text;patched text;old_text text;new_text text;receipt jsonb;
begin
 if to_regprocedure(backup_signature) is not null then raise exception 'STAFF_ACTIVE_BACKUP_EXISTS';end if;
 original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 -- Preserve the later lifecycle delegation and retired-billing guard.
 if strpos(original,'return public.set_vehicle_lifecycle(')=0 or strpos(original,'BILLING_RETIRED')=0
  then raise exception 'STAFF_ACTIVE_INSTALLED_CONTRACT_DRIFT';end if;
 for old_text,new_text in values
  ($old$select * into support_record from public.support_agent_profiles profile where profile.user_id=record_id;$old$,
   $new$select * into support_record from public.support_agent_profiles profile where profile.user_id=record_id for update;$new$),
  ($old$'can_manage_support',support_record.can_manage_support));$old$,
   $new$'can_manage_support',support_record.can_manage_support,
        'can_manage_brokerage',support_record.can_manage_brokerage,
        'can_manage_featured',support_record.can_manage_featured));$new$)
 loop
  if(length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'STAFF_ACTIVE_PATCH_ANCHOR_DRIFT';end if;
  patched:=replace(patched,old_text,new_text);
 end loop;
 execute replace(original,'CREATE OR REPLACE FUNCTION public.managed_admin_record_command(',
  'CREATE OR REPLACE FUNCTION public.managed_admin_record_command_pre_staff142(');
 execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_signature);
 receipt:=jsonb_build_object('migration',142,'original_signature',signature,'before_md5',md5(original),
  'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),
  'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure),
  'config',(select proconfig from pg_proc where oid=signature::regprocedure));
 execute patched;
 receipt:=receipt||jsonb_build_object('after_md5',md5(pg_get_functiondef(signature::regprocedure)));
 execute format('comment on function %s is %L',backup_signature,receipt::text);
end $migration$;
notify pgrst,'reload schema';
commit;
