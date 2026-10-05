-- FEAT-SUP-001 / FEAT-GST-001: stable, bounded history; authorization stays in current read contracts.

create function public.managed_support_history(actor_user_id uuid, conversation_id uuid, requested_before uuid default null, requested_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare summary jsonb; messages jsonb; cursor_time timestamptz;
  bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,50))); has_older boolean;
begin
  -- Authorize before checking the cursor, and never mark current replies read.
  summary:=public.managed_support_conversation(actor_user_id,conversation_id,1,false);
  if requested_before is not null then
    select message.created_at into cursor_time from public.support_messages message
      where message.id=requested_before and message.conversation_id=managed_support_history.conversation_id;
    if not found then raise exception 'INVALID_SUPPORT_CURSOR'; end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at,row.id),'[]'::jsonb) into messages from (
    select message.id,message.conversation_id,message.sender_user_id,message.body,message.created_at,sender.full_name as sender_name,sender.role::text as sender_role
    from public.support_messages message join public.profiles sender on sender.id=message.sender_user_id
    where message.conversation_id=managed_support_history.conversation_id
      and (requested_before is null or (message.created_at,message.id)<(cursor_time,requested_before))
    order by message.created_at desc,message.id desc limit bounded_limit+1
  ) row;
  has_older:=jsonb_array_length(messages)>bounded_limit;
  if has_older then messages:=messages-0; end if;
  return summary||jsonb_build_object('messages',messages,'history_before',requested_before,
    'has_older',has_older,'next_before',case when has_older then messages->0->>'id' else null end);
end;
$$;

revoke all on function public.managed_support_history(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.managed_support_history(uuid,uuid,uuid,integer) to service_role;

create index if not exists support_message_cursor_idx on public.support_messages(conversation_id,created_at desc,id desc);

create function public.managed_guest_support_history(actor_user_id uuid, conversation_id uuid, requested_before uuid default null, requested_limit integer default 50, requested_email_digest text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare summary jsonb; messages jsonb; cursor_time timestamptz;
  bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,50))); has_older boolean;
begin
  -- Authorize before checking the cursor, and never mark current replies read.
  summary:=public.managed_guest_support_conversation(actor_user_id,conversation_id,requested_email_digest,1,false);
  if requested_before is not null then
    select message.created_at into cursor_time from public.guest_support_messages message
      where message.id=requested_before and message.conversation_id=managed_guest_support_history.conversation_id;
    if not found then raise exception 'INVALID_SUPPORT_CURSOR'; end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at,row.id),'[]'::jsonb) into messages from (
    select message.id,message.conversation_id,message.sender_kind,message.sender_user_id,message.body,message.created_at, attachment.id as attachment_id,attachment.original_name as attachment_name,attachment.mime_type as attachment_mime_type
    from public.guest_support_messages message left join public.guest_support_attachments attachment on attachment.message_id=message.id
    where message.conversation_id=managed_guest_support_history.conversation_id
      and (requested_before is null or (message.created_at,message.id)<(cursor_time,requested_before))
    order by message.created_at desc,message.id desc limit bounded_limit+1
  ) row;
  has_older:=jsonb_array_length(messages)>bounded_limit;
  if has_older then messages:=messages-0; end if;
  return summary||jsonb_build_object('messages',messages,'history_before',requested_before,
    'has_older',has_older,'next_before',case when has_older then messages->0->>'id' else null end);
end;
$$;

revoke all on function public.managed_guest_support_history(uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.managed_guest_support_history(uuid,uuid,uuid,integer,text) to service_role;

-- guest_support_messages_idx already covers this exact cursor ordering.
