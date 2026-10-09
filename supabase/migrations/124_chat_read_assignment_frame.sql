-- A delayed staff acknowledgement must not join a different assignment epoch,
-- including an A -> B -> A handoff. Existing service-only history stays intact.
create function public.acknowledge_visible_chat_read(chat_kind text,target_id uuid,actor_user_id uuid,access_digest text,through_sequence bigint,expected_assignment_version bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare state jsonb;
begin
 if expected_assignment_version is null or expected_assignment_version<0 or expected_assignment_version>9007199254740991 then raise exception 'INVALID_CHAT_READ';end if;
 if actor_user_id is not null then
  perform 1 from public.profiles where id=actor_user_id and active for share;
  if not found then raise exception 'FORBIDDEN';end if;
  if exists(select 1 from public.profiles where id=actor_user_id and role='SUPPORT') then
   perform 1 from public.support_agent_profiles where user_id=actor_user_id for share;
  end if;
 end if;
 if chat_kind='SUPPORT' then
  perform 1 from public.support_conversations where id=target_id for update;
 elsif chat_kind='BROKERAGE' then
  perform 1 from public.transport_service_requests where id=target_id for update;
 else raise exception 'FORBIDDEN';end if;
 if not found then raise exception 'FORBIDDEN';end if;
 state:=public.chat_read_state(chat_kind,target_id,actor_user_id,access_digest);
 if state->>'ownSide'='TEAM' and (state->>'assignmentVersion')::bigint<>expected_assignment_version then raise exception 'CHAT_ASSIGNMENT_CHANGED';end if;
 return public.acknowledge_chat_read(chat_kind,target_id,actor_user_id,access_digest,through_sequence);
end $$;
revoke all on function public.acknowledge_visible_chat_read(text,uuid,uuid,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.acknowledge_visible_chat_read(text,uuid,uuid,text,bigint,bigint) to service_role;
alter table public.platform_controls add column chat_read_assignment_frame boolean not null default true check(chat_read_assignment_frame);
notify pgrst,'reload schema';
