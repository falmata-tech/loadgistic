-- Run after the exact migration body TWICE, in the same isolated rollback.
do $assert$
declare fixture jsonb;baseline record;before_guest jsonb;after_guest jsonb;target_count integer;state jsonb;agent uuid;provider_waiting uuid;
 event_count bigint;audit_count bigint;
begin
 select ids into strict fixture from retirement_fixture;agent:=(fixture->>'agent')::uuid;provider_waiting:=(fixture->>'providerWaiting')::uuid;
 for baseline in select * from retirement_snapshots where name not in('guest_before','guest_events_before','audit_before') loop
  if pg_temp.retirement_rows(baseline.name) is distinct from baseline.records then raise exception 'RETIREMENT_CHANGED_NON_GUEST_STATE: %',baseline.name;end if;
 end loop;
 select count(*) into target_count from retirement_snapshots s,jsonb_array_elements(s.records) r where s.name='guest_before' and r->>'status' in('WAITING','OPEN');
 if target_count<2 or exists(select 1 from public.guest_support_conversations where status in('WAITING','OPEN')) then raise exception 'RETIREMENT_LEFT_GUEST_WORK';end if;
 for before_guest in select r from retirement_snapshots s,jsonb_array_elements(s.records) r where s.name='guest_before' loop
  select to_jsonb(c) into strict after_guest from public.guest_support_conversations c where c.id=(before_guest->>'id')::uuid;
  if before_guest->>'status'='CLOSED' then
   if after_guest is distinct from before_guest then raise exception 'RETIREMENT_CHANGED_ALREADY_CLOSED_GUEST';end if;
  elsif after_guest->>'status'<>'CLOSED' or after_guest->>'closed_at' is null or after_guest->>'closed_by_user_id' is not null
   or (after_guest-'status'-'closed_at'-'closed_by_user_id'-'updated_at') is distinct from (before_guest-'status'-'closed_at'-'closed_by_user_id'-'updated_at')
   then raise exception 'RETIREMENT_CHANGED_CONTACT_TRANSCRIPT_OR_ASSIGNMENT';
  end if;
 end loop;
 select count(*) into event_count from public.guest_support_events e where not exists(select 1 from retirement_snapshots s,jsonb_array_elements(s.records) r where s.name='guest_events_before' and r->>'id'=e.id::text);
 select count(*) into audit_count from public.audit_logs a where not exists(select 1 from retirement_snapshots s,jsonb_array_elements(s.records) r where s.name='audit_before' and r->>'id'=a.id::text);
 if event_count<>target_count or audit_count<>target_count then raise exception 'RETIREMENT_DUPLICATED_OR_OMITTED_AUDIT';end if;
 for before_guest in select r from retirement_snapshots s,jsonb_array_elements(s.records) r where s.name='guest_before' and r->>'status' in('WAITING','OPEN') loop
  if (select count(*) from public.guest_support_events e where e.conversation_id=(before_guest->>'id')::uuid and e.event_type='RETIRED' and e.actor_user_id is null and e.details=jsonb_build_object('migration',152,'reason','SERVICE_RETIRED','previousStatus',before_guest->>'status'))<>1
   or (select count(*) from public.audit_logs a where a.entity_id=(before_guest->>'id')::uuid and a.action='GUEST_SUPPORT_RETIRED' and a.actor_user_id is null and a.details=jsonb_build_object('migration',152,'reason','SERVICE_RETIRED','previousStatus',before_guest->>'status','assignedAgentUserId',before_guest->'assigned_agent_user_id'))<>1
  then raise exception 'RETIREMENT_AUDIT_SCOPE_OR_PRIVATE_METADATA';end if;
 end loop;
 state:=public.managed_support_inbox(agent,'WAITING',0,50);
 if (state->'agent'->>'open_count')::integer<>0 or not exists(select 1 from jsonb_array_elements(state->'items') item where item->>'id'=provider_waiting::text and item->>'can_claim'='true')
 then raise exception 'RETIREMENT_DID_NOT_FREE_REAL_CLAIM_CAPACITY';end if;
 -- This is a normal authoritative provider Claim, not a claim of automatic
 -- dispatch or a rewrite of any other worker's waiting/assigned conversations.
 perform public.claim_managed_support_conversation(agent,provider_waiting);
 if not exists(select 1 from public.support_conversations where id=provider_waiting and status='OPEN' and assigned_agent_user_id=agent)
  or (select count(*) from public.support_events where conversation_id=provider_waiting and event_type='CLAIMED')<>1
  or (select count(*) from public.audit_logs where entity_id=provider_waiting and action='SUPPORT_CONVERSATION_CLAIMED')<>1
 then raise exception 'FREED_CAPACITY_NORMAL_PROVIDER_ASSIGNMENT_FAILED';end if;
 if (public.managed_support_inbox(agent,'ASSIGNED',0,50)->'agent'->>'open_count')::integer<>1 then raise exception 'PROVIDER_WORKLOAD_NOT_AUTHORITATIVE';end if;
 if pg_temp.retirement_rows('transport_service_requests') is distinct from (select records from retirement_snapshots where name='transport_service_requests')
  or pg_temp.retirement_rows('transport_chat_messages') is distinct from (select records from retirement_snapshots where name='transport_chat_messages')
 then raise exception 'PROVIDER_CLAIM_CHANGED_BROKERAGE';end if;
end $assert$;
