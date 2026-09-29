-- FEAT-GST-001: unassigned is not authorization; preserve existing signatures and grants.


create or replace function public.managed_guest_support_conversation(actor_user_id uuid,conversation_id uuid,requested_email_digest text default null,requested_limit integer default 50,mark_read boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare conversation public.guest_support_conversations%rowtype;actor public.profiles%rowtype;team boolean:=false;
begin
  select * into conversation from public.guest_support_conversations item where item.id=conversation_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if requested_email_digest is not null and trim(requested_email_digest)<>'' then
    if conversation.email_digest<>trim(requested_email_digest) then raise exception 'NOT_FOUND'; end if;
    if mark_read then update public.guest_support_conversations set guest_last_read_at=now() where id=conversation.id; end if;
  else
    select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
    if not found or not public.managed_actor_has_permission(actor.id,'SUPPORT')
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id is distinct from actor.id) then raise exception 'NOT_FOUND'; end if;
    team:=true;
    if mark_read then update public.guest_support_conversations set agent_last_read_at=now() where id=conversation.id; end if;
  end if;
  return public.guest_support_projection(conversation.id,team,requested_limit);
end;
$$;

create or replace function public.send_managed_guest_support_message(actor_user_id uuid,conversation_id uuid,requested_email_digest text,message_body text,command jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare conversation public.guest_support_conversations%rowtype;actor public.profiles%rowtype;body_value text:=trim(coalesce(message_body,''));
  sender_kind text;message_id uuid:=gen_random_uuid();storage_path text:=trim(coalesce(command->>'storage_path',''));
  original_name text:=left(trim(coalesce(command->>'original_name','')),160);mime_type text:=trim(coalesce(command->>'mime_type',''));
  size_bytes bigint:=coalesce(nullif(command->>'size_bytes','')::bigint,0);
begin
  if char_length(body_value) not between 1 and 2000 then raise exception 'INVALID_SUPPORT_MESSAGE'; end if;
  select * into conversation from public.guest_support_conversations item where item.id=conversation_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if conversation.status='CLOSED' then raise exception 'SUPPORT_CONVERSATION_CLOSED'; end if;
  if requested_email_digest is not null and trim(requested_email_digest)<>'' then
    if conversation.email_digest<>trim(requested_email_digest) then raise exception 'NOT_FOUND'; end if;
    sender_kind:='GUEST';
  else
    select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
    if not found or not public.managed_actor_has_permission(actor.id,'SUPPORT')
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id is distinct from actor.id) then raise exception 'NOT_FOUND'; end if;
    sender_kind:='TEAM';
  end if;
  if storage_path<>'' and storage_path not like 'supabase://support-attachment/%' then raise exception 'INVALID_PRIVATE_STORAGE_REFERENCE'; end if;
  if storage_path<>'' and (original_name='' or mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') or size_bytes<=0) then
    raise exception 'INVALID_PRIVATE_STORAGE_REFERENCE';
  end if;
  insert into public.guest_support_messages(id,conversation_id,sender_kind,sender_user_id,body,created_at)
  values(message_id,conversation.id,sender_kind,case when sender_kind='TEAM' then actor.id else null end,body_value,now());
  if storage_path<>'' then
    insert into public.guest_support_attachments(id,conversation_id,message_id,file_path,original_name,mime_type,size_bytes,created_at)
    values(gen_random_uuid(),conversation.id,message_id,storage_path,original_name,mime_type,size_bytes,now());
  end if;
  update public.guest_support_conversations set updated_at=now(),last_message_at=now() where id=conversation.id;
  insert into public.guest_support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),conversation.id,case when sender_kind='TEAM' then actor.id else null end,'MESSAGE_SENT',
    jsonb_build_object('senderKind',sender_kind,'hasAttachment',storage_path<>''),now());
  return message_id;
end;
$$;

create or replace function public.close_managed_guest_support(actor_user_id uuid,conversation_id uuid,requested_email_digest text default null)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare conversation public.guest_support_conversations%rowtype;actor public.profiles%rowtype;event_name text;
begin
  select * into conversation from public.guest_support_conversations item where item.id=conversation_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if requested_email_digest is not null and trim(requested_email_digest)<>'' then
    if conversation.email_digest<>trim(requested_email_digest) then raise exception 'NOT_FOUND'; end if;
    event_name:='GUEST_CLOSED';
  else
    select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
    if not found or not public.managed_actor_has_permission(actor.id,'SUPPORT')
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id is distinct from actor.id) then raise exception 'NOT_FOUND'; end if;
    event_name:='CLOSED';
  end if;
  if conversation.status='CLOSED' then return; end if;
  update public.guest_support_conversations set status='CLOSED',closed_at=now(),
    closed_by_user_id=case when requested_email_digest is null or trim(requested_email_digest)='' then actor.id else null end,updated_at=now()
  where id=conversation.id;
  insert into public.guest_support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),conversation.id,case when event_name='CLOSED' then actor.id else null end,event_name,'{}'::jsonb,now());
  perform public.support_assign_waiting(1);
end;
$$;

create or replace function public.managed_guest_support_attachment_file(actor_user_id uuid,conversation_id uuid,attachment_id uuid,requested_email_digest text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare conversation public.guest_support_conversations%rowtype;actor public.profiles%rowtype;attachment public.guest_support_attachments%rowtype;
begin
  select * into conversation from public.guest_support_conversations item where item.id=conversation_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if requested_email_digest is not null and trim(requested_email_digest)<>'' then
    if conversation.email_digest<>trim(requested_email_digest) then raise exception 'NOT_FOUND'; end if;
  else
    select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
    if not found or not public.managed_actor_has_permission(actor.id,'SUPPORT')
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id is distinct from actor.id) then raise exception 'NOT_FOUND'; end if;
  end if;
  select * into attachment from public.guest_support_attachments item
  where item.id=attachment_id and item.conversation_id=conversation.id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('storage_path',attachment.file_path,'original_name',attachment.original_name,'mime_type',attachment.mime_type);
end;
$$;
