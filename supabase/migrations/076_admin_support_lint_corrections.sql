-- FEAT-ADM-001 / FEAT-SUP-001
-- Remove one retired admin branch whose table no longer exists and make the
-- Support assignment capacity type agree with its bounded integer contract.

do $migration$
declare
  definition text;
  patched text;
  retired_branch text:=$fragment$
  elsif selected_type='BUSINESS_FAVORITE' and action_name='REMOVE' then
    if not public.managed_actor_has_permission(actor_user_id,'OPERATIONS') then raise exception 'FORBIDDEN'; end if;
    delete from public.member_favorites where id=record_id;get diagnostics affected=row_count;
    if affected=0 then raise exception 'NOT_FOUND'; end if;$fragment$;
begin
  definition:=pg_get_functiondef(
    'public.managed_admin_record_command(uuid,text,uuid,jsonb)'::regprocedure
  );
  if position(retired_branch in definition)=0 then
    raise exception 'RETIRED_ADMIN_BRANCH_NOT_FOUND';
  end if;
  patched:=replace(definition,retired_branch,'');
  if position('member_favorites' in patched)>0 then
    raise exception 'RETIRED_ADMIN_BRANCH_NOT_REMOVED';
  end if;
  execute patched;
end;
$migration$;

do $migration$
declare
  definition text;
  patched text;
  prior_call text:='public.support_assign_waiting(greatest(1,agent.max_open_conversations-open_count))';
  bounded_call text:='public.support_assign_waiting(greatest(1::bigint,agent.max_open_conversations-open_count)::integer)';
begin
  definition:=pg_get_functiondef(
    'public.update_managed_support_availability(uuid,boolean)'::regprocedure
  );
  if position(prior_call in definition)=0 then
    raise exception 'SUPPORT_ASSIGNMENT_CALL_NOT_FOUND';
  end if;
  patched:=replace(definition,prior_call,bounded_call);
  if position(prior_call in patched)>0 or position(bounded_call in patched)=0 then
    raise exception 'SUPPORT_ASSIGNMENT_CALL_NOT_REPLACED';
  end if;
  execute patched;
end;
$migration$;
