-- FEAT-SUP-001. Preserve historical settings, event history and existing ACLs.
-- Rank available staff by open chats. The old configuration is no longer read
-- for assignment or saved by Team. Availability drains FIFO in batches of 100.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $workload$
declare item record; signature text; definition text;
begin
 for item in select * from(values
  (1,'claim_managed_support_conversation(uuid,uuid)','117607ee60e393981d9b95ec493c8429',$old$;open_count bigint;$old$,$new$;$new$),
  (2,'claim_managed_support_conversation(uuid,uuid)','117607ee60e393981d9b95ec493c8429',$old$  select (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')+
    (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN') into open_count;
  if open_count>=agent.max_open_conversations then raise exception 'SUPPORT_AGENT_AT_CAPACITY'; end if;
$old$,$new$$new$),
  (3,'claim_managed_guest_support(uuid,uuid)','5b836c09953ad1753b424c4d0071dda1',$old$;open_count bigint;$old$,$new$;$new$),
  (4,'claim_managed_guest_support(uuid,uuid)','5b836c09953ad1753b424c4d0071dda1',$old$  select (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')+
    (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN') into open_count;
  if open_count>=agent.max_open_conversations then raise exception 'SUPPORT_AGENT_AT_CAPACITY'; end if;
$old$,$new$$new$),
  (5,'support_assign_one(uuid,boolean)','064c38e69e84203efc7a25b897a2fc09',$old$begin
  select agent.user_id$old$,$new$begin
  -- Select from a fresh workload snapshot after concurrent arrivals commit.
  perform pg_advisory_xact_lock(hashtextextended('loadgistic.support.assignment',0));
  select agent.user_id$new$),
  (6,'support_assign_one(uuid,boolean)','064c38e69e84203efc7a25b897a2fc09',$old$    and (
      (select count(*) from public.support_conversations member_chat
        where member_chat.assigned_agent_user_id=agent.user_id and member_chat.status='OPEN')+
      (select count(*) from public.guest_support_conversations guest_chat
        where guest_chat.assigned_agent_user_id=agent.user_id and guest_chat.status='OPEN')
    )<agent.max_open_conversations
$old$,$new$$new$),
  (7,'support_assign_one(uuid,boolean)','064c38e69e84203efc7a25b897a2fc09',$old$last_assigned_at=now()$old$,$new$last_assigned_at=clock_timestamp()$new$),
  (8,'managed_support_inbox(uuid,text,integer,integer)','cdd73430536e5841f3c0c94116f552a2',$old$
      and (select count(*) from public.support_conversations c where c.assigned_agent_user_id=actor.id and c.status='OPEN')+
        (select count(*) from public.guest_support_conversations c where c.assigned_agent_user_id=actor.id and c.status='OPEN')<staff.max_open_conversations$old$,$new$$new$),
  (9,'managed_guest_support_inbox(uuid,text,integer,integer)','ed4d52ece2e011c714d7981a928dea71',$old$
        and (select count(*) from public.support_conversations c where c.assigned_agent_user_id=actor.id and c.status='OPEN')+
          (select count(*) from public.guest_support_conversations c where c.assigned_agent_user_id=actor.id and c.status='OPEN')<staff.max_open_conversations$old$,$new$$new$),
  (10,'assign_guest_support_agent(uuid,uuid,uuid,uuid)','543780376e1f18ffcc9eca618d3713eb',$old$ if target_user_id is not null then
   select (select count(*) from public.support_conversations where assigned_agent_user_id=target_user_id and status='OPEN')+
     (select count(*) from public.guest_support_conversations where assigned_agent_user_id=target_user_id and status='OPEN') into open_count;
   if open_count>=agent.max_open_conversations then raise exception 'SUPPORT_AGENT_AT_CAPACITY';end if;
 end if;
$old$,$new$$new$),
  (11,'managed_assisted_matching_availability()','4ea771ef5a81ee2148c2391b8a9a6956',$old$
      and (
        (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='OPEN')+
        (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='OPEN')
      )<agent.max_open_conversations$old$,$new$$new$),
  (12,'update_managed_support_availability(uuid,boolean)','47d5e49b0699b0cd33a80a43af5bc33a',$old$;open_count bigint;$old$,$new$;$new$),
  (13,'update_managed_support_availability(uuid,boolean)','47d5e49b0699b0cd33a80a43af5bc33a',$old$    select (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')+
      (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN') into open_count;
    perform public.support_assign_waiting(greatest(1::bigint,agent.max_open_conversations-open_count)::integer);$old$,$new$    while public.support_assign_waiting(100)=100 loop null; end loop;$new$),
  (14,'create_managed_support_agent(uuid,uuid,jsonb)','c09f9fc0e715fb3ea1ff3a39d8736b81',$old$max_open integer:=coalesce(nullif(command->>'max_open_conversations','')::integer,3);$old$,$new$$new$),
  (15,'create_managed_support_agent(uuid,uuid,jsonb)','c09f9fc0e715fb3ea1ff3a39d8736b81',$old$  if max_open not between 1 and 20 then raise exception 'INVALID_SUPPORT_AGENT_LIMIT'; end if;
$old$,$new$$new$),
  (16,'create_managed_support_agent(uuid,uuid,jsonb)','c09f9fc0e715fb3ea1ff3a39d8736b81',$old$active,available,max_open_conversations,$old$,$new$active,available,$new$),
  (17,'create_managed_support_agent(uuid,uuid,jsonb)','c09f9fc0e715fb3ea1ff3a39d8736b81',$old$'maxOpenConversations',max_open,$old$,$new$$new$),
  (18,'create_managed_support_agent(uuid,uuid,jsonb)','c09f9fc0e715fb3ea1ff3a39d8736b81',$old$,max_open,$old$,$new$,$new$),
  (19,'create_managed_support_agent(uuid,uuid,jsonb)','c09f9fc0e715fb3ea1ff3a39d8736b81',$old$perform public.support_assign_waiting(max_open);$old$,$new$while public.support_assign_waiting(100)=100 loop null; end loop;$new$),
  (20,'update_managed_support_agent(uuid,uuid,jsonb)','ef6bd41b6caf2ea761b5bc06d87f35df',$old$max_open integer:=coalesce(nullif(command->>'max_open_conversations','')::integer,3);$old$,$new$$new$),
  (21,'update_managed_support_agent(uuid,uuid,jsonb)','ef6bd41b6caf2ea761b5bc06d87f35df',$old$  if max_open not between 1 and 20 then raise exception 'INVALID_SUPPORT_AGENT_LIMIT'; end if;
$old$,$new$$new$),
  (22,'update_managed_support_agent(uuid,uuid,jsonb)','ef6bd41b6caf2ea761b5bc06d87f35df',$old$,max_open_conversations=max_open$old$,$new$$new$),
  (23,'update_managed_support_agent(uuid,uuid,jsonb)','ef6bd41b6caf2ea761b5bc06d87f35df',$old$'maxOpenConversations',max_open,$old$,$new$$new$),
  (24,'update_managed_support_agent(uuid,uuid,jsonb)','ef6bd41b6caf2ea761b5bc06d87f35df',$old$perform public.support_assign_waiting(100);$old$,$new$while public.support_assign_waiting(100)=100 loop null; end loop;$new$)
 ) as edits(step,signature,expected_md5,before_text,after_text) order by step
 loop
  if signature is distinct from item.signature then
   if signature is not null then execute definition;end if;
   signature:=item.signature;
   select pg_get_functiondef(oid) into strict definition from pg_proc
    where oid=('public.'||signature)::regprocedure and md5(prosrc)=item.expected_md5;
  end if;
  if array_length(string_to_array(definition,item.before_text),1)<>2 then
   raise exception 'SUPPORT_WORKLOAD_SOURCE_CHANGED %',item.signature;
  end if;
  definition:=replace(definition,item.before_text,item.after_text);
 end loop;
 execute definition;
end $workload$;
-- Member requests previously held by a ceiling can be assigned immediately.
-- Only an actually available Support agent can change a waiting row.
do $resume_waiting$
declare waiting_id uuid;
begin
 for waiting_id in
  select id from public.support_conversations
  where status='WAITING' and assigned_agent_user_id is null
  order by created_at,id
 loop
  exit when public.support_assign_one(waiting_id,false) is null;
 end loop;
end $resume_waiting$;
commit;
