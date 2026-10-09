-- FEAT-NOT-001: waiting work cannot crowd out the assignee's live replies.
-- Keep 122–124 immutable and retain exact authority/projection/ACL contracts.
do $patch$
declare definition text;anchor text:=' ), counted as ('||E'\n  select c.*,';
 old_order text:='queued desc,(unread_count>0) desc,updated_at desc,id';
 new_order text:='(status<>''CLOSED'' and unread_count>0) desc,coalesce(status<>''CLOSED'' and side=''TEAM'' and assigned_agent_user_id=actor_user_id,false) desc,queued desc,alert_time desc,id';
begin
 definition:=pg_get_functiondef('public.chat_alert_snapshot(uuid,uuid,text)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 or
  (length(definition)-length(replace(definition,old_order,'')))/length(old_order)<>2 or
  strpos(definition,'''updatedAt'',updated_at')=0 then raise exception 'CHAT_ALERT_PRIORITY_DRIFT';end if;
 definition:=replace(definition,anchor,' ), counted as ('||E'\n  select c.*,greatest(c.updated_at,coalesce(case when c.kind=''SUPPORT'' then
   (select m.created_at from public.support_messages m where m.conversation_id=c.id order by m.sequence desc limit 1)
  else (select m.created_at from public.transport_chat_messages m where m.request_id=c.id order by m.sequence desc limit 1)
  end,c.updated_at)) as alert_time,');
 definition:=replace(definition,old_order,new_order);
 definition:=replace(definition,'''updatedAt'',updated_at','''updatedAt'',alert_time');
 execute definition;
end $patch$;
alter table public.platform_controls add column chat_alert_priority boolean not null default true check(chat_alert_priority);
notify pgrst,'reload schema';
