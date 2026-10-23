-- FEAT-GST/SUP/ADM/UIX-001, October 15 owner retirement decision.
-- One-time closure only: preserve private records/files and every member or
-- Brokerage conversation. No new RPC, privilege, assignment or client access.
begin;
select pg_advisory_xact_lock(8030152);
lock table public.guest_support_conversations in share row exclusive mode;
do $precondition$
begin
 if strpos(pg_get_functiondef('public.create_managed_guest_support(jsonb)'::regprocedure),'PUBLIC_SUPPORT_CLOSED')=0
  or strpos(pg_get_functiondef('public.send_managed_guest_support_message(uuid,uuid,text,text,jsonb)'::regprocedure),'PUBLIC_SUPPORT_CLOSED')=0
 then raise exception 'GUEST_SUPPORT_RETIREMENT_PRECONDITION';end if;
end $precondition$;

with stamp as materialized(select clock_timestamp() as value),
targets as materialized(
 select id,status as previous_status,assigned_agent_user_id
 from public.guest_support_conversations where status in('WAITING','OPEN') for update
),retired as(
 update public.guest_support_conversations conversation
 set status='CLOSED',closed_at=stamp.value,closed_by_user_id=null,updated_at=stamp.value
 from targets,stamp where conversation.id=targets.id
 returning conversation.id,conversation.updated_at,targets.previous_status,targets.assigned_agent_user_id
),events as(
 insert into public.guest_support_events(conversation_id,actor_user_id,event_type,details,created_at)
 select id,null,'RETIRED',jsonb_build_object('migration',152,'reason','SERVICE_RETIRED','previousStatus',previous_status),updated_at
 from retired returning id
)
insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details,created_at)
select null,'GUEST_SUPPORT_RETIRED','guest_support_conversation',id,
 jsonb_build_object('migration',152,'reason','SERVICE_RETIRED','previousStatus',previous_status,'assignedAgentUserId',assigned_agent_user_id),updated_at
from retired;
-- Workload ports already count OPEN rows. Closing old Guest rows frees their
-- real capacity without dispatching or rewriting any provider's existing work.
commit;
