-- FEAT-SUP-001 / FEAT-GST-001: authenticate before computing a small revision.
create function public.support_conversation_revision(actor_user_id uuid,target_id uuid,guest boolean,requested_digest text default null,mark_read boolean default false)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare item record; latest_message uuid; latest_event uuid; actor_role text; agent_name text;
begin
 if guest then
  select * into item from guest_support_conversations where id=target_id;
  if not found then raise exception 'NOT_FOUND';end if;
  if nullif(trim(requested_digest),'') is not null then
   if item.email_digest is distinct from trim(requested_digest) then raise exception 'NOT_FOUND';end if;
   if mark_read and (item.guest_last_read_at is null or item.guest_last_read_at<item.last_message_at) then
    update guest_support_conversations set guest_last_read_at=now() where id=target_id;
   end if;
  else
   select role::text into actor_role from profiles where id=actor_user_id and active;
   if actor_role is null or not public.managed_actor_has_permission(actor_user_id,'SUPPORT')
    or (actor_role='SUPPORT' and item.assigned_agent_user_id is distinct from actor_user_id) then raise exception 'NOT_FOUND';end if;
  end if;
  select id into latest_message from guest_support_messages where conversation_id=target_id order by created_at desc,id desc limit 1;
  select id into latest_event from guest_support_events where conversation_id=target_id order by created_at desc,id desc limit 1;
 else
  if not public.support_actor_can_read(actor_user_id,target_id) then raise exception 'NOT_FOUND';end if;
  select * into item from support_conversations where id=target_id;
  select id into latest_message from support_messages where conversation_id=target_id order by created_at desc,id desc limit 1;
  select id into latest_event from support_events where conversation_id=target_id order by created_at desc,id desc limit 1;
 end if;
 select full_name into agent_name from profiles where id=item.assigned_agent_user_id;
 -- No message text, address, attachment reference or read timestamp in revision input.
 return md5(jsonb_build_array(target_id,item.status,item.assigned_agent_user_id,agent_name,latest_message,latest_event)::text);
end $$;
revoke all on function public.support_conversation_revision(uuid,uuid,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.support_conversation_revision(uuid,uuid,boolean,text,boolean) to service_role;
