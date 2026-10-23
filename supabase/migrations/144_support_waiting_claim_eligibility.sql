-- FEAT-SUP-001 / WEB-MOB-032: authoritative, snapshot-only member Claim eligibility.
-- The existing claim command still locks and repeats current authority/capacity.
begin;
select pg_advisory_xact_lock(8030144);
do $migration$
declare signature text:='public.managed_support_inbox(uuid,text,integer,integer)';
 backup_signature text:='public.managed_support_inbox_pre_claim144(uuid,text,integer,integer)';
 original text;patched text;claim_definition text;old_text text;new_text text;receipt jsonb;
begin
 if to_regprocedure(backup_signature) is not null then raise exception 'SUPPORT_CLAIM_BACKUP_EXISTS';end if;
 original:=pg_get_functiondef(signature::regprocedure);patched:=original;
 claim_definition:=pg_get_functiondef('public.claim_managed_support_conversation(uuid,uuid)'::regprocedure);
 if (select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from current_user
  or has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
  or not has_function_privilege('service_role',signature,'EXECUTE')
  or not (select prosecdef from pg_proc where oid=signature::regprocedure)
  or (select provolatile from pg_proc where oid=signature::regprocedure)<>'s'
  or strpos(original,'public.managed_actor_has_permission(actor.id,''SUPPORT'')')=0
  or strpos(claim_definition,'order by conversation.created_at,conversation.id for update skip locked limit 1;')=0
  or strpos(claim_definition,'not agent.active or not agent.available')=0
  or strpos(claim_definition,'open_count>=agent.max_open_conversations')=0
  or strpos(claim_definition,'public.guest_support_conversations')=0
  or strpos(claim_definition,'public.managed_actor_has_permission(actor.id,''SUPPORT'')')=0
  then raise exception 'SUPPORT_CLAIM_INSTALLED_CONTRACT_DRIFT';end if;
 for old_text,new_text in values
  ($old$items jsonb;total bigint;assigned_count bigint;waiting_count bigint;closed_count bigint;agent jsonb:=null;$old$,
   $new$items jsonb;total bigint;assigned_count bigint;waiting_count bigint;closed_count bigint;agent jsonb:=null;
  oldest_waiting uuid;claim_allowed boolean:=false;$new$),
  ($old$if view_value not in ('ASSIGNED','WAITING','CLOSED','ALL') then raise exception 'INVALID_SUPPORT_VIEW'; end if;$old$,
   $new$if view_value not in ('ASSIGNED','WAITING','CLOSED','ALL') then raise exception 'INVALID_SUPPORT_VIEW'; end if;

  if actor.role::text='SUPPORT' then
    select coalesce(staff.active and staff.available and staff.can_manage_support
      and (select count(*) from public.support_conversations c where c.assigned_agent_user_id=actor.id and c.status='OPEN')+
        (select count(*) from public.guest_support_conversations c where c.assigned_agent_user_id=actor.id and c.status='OPEN')<staff.max_open_conversations,false)
    into claim_allowed from public.support_agent_profiles staff where staff.user_id=actor.id;
    claim_allowed:=coalesce(claim_allowed,false);
    select conversation.id into oldest_waiting from public.support_conversations conversation
    where conversation.status='WAITING' and conversation.assigned_agent_user_id is null
    order by conversation.created_at,conversation.id limit 1;
  end if;$new$),
  ($old$order by case when view_value='WAITING' then scoped.created_at end asc,
      case scoped.status$old$,
   $new$order by case when view_value='WAITING' then scoped.created_at end asc,
      case when view_value='WAITING' then scoped.id end asc,
      case scoped.status$new$),
  ($old$jsonb_agg(public.support_conversation_summary(row.id))$old$,
   $new$jsonb_agg(public.support_conversation_summary(row.id)||jsonb_build_object('can_claim',
    coalesce(claim_allowed and row.status='WAITING' and row.id=oldest_waiting,false)))$new$)
 loop
  if (length(patched)-length(replace(patched,old_text,'')))/length(old_text)<>1 then raise exception 'SUPPORT_CLAIM_PATCH_ANCHOR_DRIFT';end if;
  patched:=replace(patched,old_text,new_text);
 end loop;
 execute replace(original,'CREATE OR REPLACE FUNCTION public.managed_support_inbox(',
  'CREATE OR REPLACE FUNCTION public.managed_support_inbox_pre_claim144(');
 execute format('revoke all on function %s from public,anon,authenticated,service_role',backup_signature);
 receipt:=jsonb_build_object('migration',144,'original_signature',signature,'before_md5',md5(original),
  'claim_md5',md5(claim_definition),'owner',(select proowner::regrole::text from pg_proc where oid=signature::regprocedure),
  'acl',(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure),
  'config',(select proconfig from pg_proc where oid=signature::regprocedure));
 execute patched;
 receipt:=receipt||jsonb_build_object('after_md5',md5(pg_get_functiondef(signature::regprocedure)));
 execute format('comment on function %s is %L',backup_signature,receipt::text);
end $migration$;
notify pgrst,'reload schema';
commit;
