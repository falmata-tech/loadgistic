-- FEAT-SUP-001 / FEAT-GST-001 / FEAT-ADM-001
-- Actor-scoped Support and Assisted matching runtime. All functions are
-- service-role-only; browser roles continue to have no direct guest-chat or
-- private-attachment authority.

create or replace function public.support_member_actor(actor_user_id uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;
begin
  select * into actor from public.profiles profile
  where profile.id=actor_user_id and profile.active
    and profile.role::text in ('SHIPPER','RECEIVER','TRANSPORTER','DRIVER');
  if not found then raise exception 'FORBIDDEN'; end if;
  return actor;
end;
$$;

create or replace function public.support_conversation_summary(conversation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'id',conversation.id,
    'customer_user_id',conversation.customer_user_id,
    'assigned_agent_user_id',conversation.assigned_agent_user_id,
    'category',conversation.category,
    'status',conversation.status,
    'created_at',conversation.created_at,
    'updated_at',conversation.updated_at,
    'last_message_at',conversation.last_message_at,
    'assigned_at',conversation.assigned_at,
    'closed_at',conversation.closed_at,
    'customer_name',customer.full_name,
    'customer_role',customer.role::text,
    'customer_workspace_name',coalesce(
      (select organization.name from public.organization_members membership
        join public.organizations organization on organization.id=membership.organization_id
        where membership.user_id=customer.id
        order by (membership.membership_role='OWNER') desc,membership.id limit 1),
      (select provider.business_name from public.provider_profiles provider where provider.user_id=customer.id limit 1),
      'Individual account'
    ),
    'assigned_agent_name',agent.full_name,
    'last_message_preview',(select left(message.body,120) from public.support_messages message
      where message.conversation_id=conversation.id order by message.created_at desc,message.id desc limit 1),
    'message_count',(select count(*) from public.support_messages message where message.conversation_id=conversation.id)
  )
  from public.support_conversations conversation
  join public.profiles customer on customer.id=conversation.customer_user_id
  left join public.profiles agent on agent.id=conversation.assigned_agent_user_id
  where conversation.id=conversation_id
$$;

create or replace function public.support_actor_can_read(actor_user_id uuid,conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.support_conversations conversation
    join public.profiles actor on actor.id=actor_user_id and actor.active
    where conversation.id=conversation_id and (
      conversation.customer_user_id=actor.id
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id=actor.id
        and public.managed_actor_has_permission(actor.id,'SUPPORT'))
      or actor.role::text='ADMIN'
    )
  )
$$;

create or replace function public.support_assign_one(conversation_id uuid,guest boolean default false)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare agent_id uuid;
begin
  select agent.user_id into agent_id
  from public.support_agent_profiles agent
  join public.profiles profile on profile.id=agent.user_id
  where profile.active and profile.role::text='SUPPORT'
    and agent.active and agent.available and agent.can_manage_support
    and (
      (select count(*) from public.support_conversations member_chat
        where member_chat.assigned_agent_user_id=agent.user_id and member_chat.status='OPEN')+
      (select count(*) from public.guest_support_conversations guest_chat
        where guest_chat.assigned_agent_user_id=agent.user_id and guest_chat.status='OPEN')
    )<agent.max_open_conversations
  order by (
    (select count(*) from public.support_conversations member_chat
      where member_chat.assigned_agent_user_id=agent.user_id and member_chat.status='OPEN')+
    (select count(*) from public.guest_support_conversations guest_chat
      where guest_chat.assigned_agent_user_id=agent.user_id and guest_chat.status='OPEN')
  ),agent.last_assigned_at asc nulls first,agent.user_id
  for update of agent skip locked
  limit 1;
  if agent_id is null then return null; end if;

  if guest then
    update public.guest_support_conversations conversation set
      assigned_agent_user_id=agent_id,status='OPEN',assigned_at=now(),updated_at=now()
    where conversation.id=conversation_id and conversation.status='WAITING'
      and conversation.assigned_agent_user_id is null;
    if not found then return null; end if;
    insert into public.guest_support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
    values(gen_random_uuid(),conversation_id,null,'ASSIGNED',jsonb_build_object('agentUserId',agent_id),now());
  else
    update public.support_conversations conversation set
      assigned_agent_user_id=agent_id,status='OPEN',assigned_at=now(),updated_at=now()
    where conversation.id=conversation_id and conversation.status='WAITING'
      and conversation.assigned_agent_user_id is null;
    if not found then return null; end if;
    insert into public.support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
    values(gen_random_uuid(),conversation_id,null,'ASSIGNED',jsonb_build_object('agentUserId',agent_id),now());
  end if;
  update public.support_agent_profiles set last_assigned_at=now(),updated_at=now() where user_id=agent_id;
  return agent_id;
end;
$$;

create or replace function public.support_assign_waiting(requested_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare candidate record;assigned integer:=0;bounded_limit integer:=greatest(1,least(100,coalesce(requested_limit,100)));
begin
  for candidate in
    select queued.kind,queued.id from (
      select 'MEMBER'::text as kind,conversation.id,conversation.created_at
      from public.support_conversations conversation
      where conversation.status='WAITING' and conversation.assigned_agent_user_id is null
      union all
      select 'GUEST',conversation.id,conversation.created_at
      from public.guest_support_conversations conversation
      where conversation.status='WAITING' and conversation.assigned_agent_user_id is null
    ) queued order by queued.created_at,queued.id limit bounded_limit
  loop
    exit when public.support_assign_one(candidate.id,candidate.kind='GUEST') is null;
    assigned:=assigned+1;
  end loop;
  return assigned;
end;
$$;

create or replace function public.create_managed_support_conversation(actor_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;category_value text:=upper(trim(coalesce(command->>'category','')));
  body_value text:=trim(coalesce(command->>'body',''));conversation_id uuid:=gen_random_uuid();assigned uuid;
begin
  actor:=public.support_member_actor(actor_user_id);
  if category_value not in ('ACCOUNT','PAYMENT','VERIFICATION','LOAD_TRACKING','CAPACITY','OTHER') then
    raise exception 'INVALID_SUPPORT_CATEGORY';
  end if;
  if char_length(body_value) not between 1 and 2000 then raise exception 'INVALID_SUPPORT_MESSAGE'; end if;
  if exists(select 1 from public.support_conversations conversation
    where conversation.customer_user_id=actor.id and conversation.status in ('WAITING','OPEN')) then
    raise exception 'SUPPORT_CONVERSATION_ALREADY_OPEN';
  end if;
  if (select count(*) from public.support_messages message
    where message.sender_user_id=actor.id and message.created_at>=now()-interval '1 minute')>=20 then
    raise exception 'SUPPORT_MESSAGE_RATE_LIMITED';
  end if;
  insert into public.support_conversations(id,customer_user_id,category,status,created_at,updated_at,last_message_at,customer_last_read_at)
  values(conversation_id,actor.id,category_value,'WAITING',now(),now(),now(),now());
  insert into public.support_messages(id,conversation_id,sender_user_id,body,created_at)
  values(gen_random_uuid(),conversation_id,actor.id,body_value,now());
  insert into public.support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),conversation_id,actor.id,'CREATED',jsonb_build_object('category',category_value),now());
  assigned:=public.support_assign_one(conversation_id,false);
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_CONVERSATION_CREATED','support_conversation',conversation_id,
    jsonb_build_object('category',category_value,'assigned',assigned is not null),now());
  return conversation_id;
end;
$$;

create or replace function public.managed_member_support_page(actor_user_id uuid,requested_offset integer default 0,requested_limit integer default 10)
returns table(payload jsonb,total_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;bounded_offset integer:=greatest(0,coalesce(requested_offset,0));
  bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,10)));
begin
  actor:=public.support_member_actor(actor_user_id);
  return query
  with scoped as (
    select conversation.id,conversation.updated_at from public.support_conversations conversation
    where conversation.customer_user_id=actor.id and conversation.status='CLOSED'
  ),counted as (select scoped.*,count(*) over() as row_total from scoped)
  select public.support_conversation_summary(row.id),row.row_total
  from counted row order by row.updated_at desc,row.id offset bounded_offset limit bounded_limit;
end;
$$;

create or replace function public.managed_open_member_support(actor_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;conversation_id uuid;
begin
  actor:=public.support_member_actor(actor_user_id);
  select conversation.id into conversation_id from public.support_conversations conversation
  where conversation.customer_user_id=actor.id and conversation.status in ('WAITING','OPEN')
  order by conversation.updated_at desc,conversation.id limit 1;
  return public.support_conversation_summary(conversation_id);
end;
$$;

create or replace function public.managed_support_conversation(actor_user_id uuid,conversation_id uuid,requested_limit integer default 50,mark_read boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;conversation public.support_conversations%rowtype;
  bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,50)));summary jsonb;messages jsonb;events jsonb:='[]'::jsonb;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
  if not found or not public.support_actor_can_read(actor.id,conversation_id) then raise exception 'NOT_FOUND'; end if;
  select * into conversation from public.support_conversations item where item.id=conversation_id;
  if mark_read then
    if conversation.customer_user_id=actor.id then
      update public.support_conversations set customer_last_read_at=now() where id=conversation.id;
    else update public.support_conversations set agent_last_read_at=now() where id=conversation.id;
    end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at,row.id),'[]'::jsonb) into messages from (
    select message.id,message.conversation_id,message.sender_user_id,message.body,message.created_at,
      sender.full_name as sender_name,sender.role::text as sender_role
    from public.support_messages message join public.profiles sender on sender.id=message.sender_user_id
    where message.conversation_id=conversation.id
    order by message.created_at desc,message.id desc limit bounded_limit
  ) row;
  if actor.role::text='ADMIN' then
    select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at,row.event_type),'[]'::jsonb) into events from (
      select event.event_type,event.created_at from public.support_events event
      where event.conversation_id=conversation.id order by event.created_at,event.id limit 100
    ) row;
  end if;
  summary:=public.support_conversation_summary(conversation.id);
  return summary||jsonb_build_object('messages',messages,'events',events);
end;
$$;

create or replace function public.managed_support_inbox(actor_user_id uuid,requested_view text default 'ASSIGNED',requested_offset integer default 0,requested_limit integer default 15)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;view_value text:=upper(coalesce(requested_view,'ASSIGNED'));
  bounded_offset integer:=greatest(0,coalesce(requested_offset,0));bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,15)));
  items jsonb;total bigint;assigned_count bigint;waiting_count bigint;closed_count bigint;agent jsonb:=null;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
  if not found or actor.role::text not in ('SUPPORT','ADMIN') or not public.managed_actor_has_permission(actor.id,'SUPPORT') then raise exception 'FORBIDDEN'; end if;
  if view_value not in ('ASSIGNED','WAITING','CLOSED','ALL') then raise exception 'INVALID_SUPPORT_VIEW'; end if;

  select count(*) filter(where conversation.status='OPEN'),count(*) filter(where conversation.status='WAITING'),count(*) filter(where conversation.status='CLOSED')
  into assigned_count,waiting_count,closed_count from public.support_conversations conversation
  where actor.role::text='ADMIN' or conversation.assigned_agent_user_id=actor.id or conversation.status='WAITING';

  with scoped as (
    select conversation.id,conversation.status,conversation.created_at,conversation.last_message_at
    from public.support_conversations conversation where
      case
        when actor.role::text='SUPPORT' and view_value='WAITING' then conversation.status='WAITING' and conversation.assigned_agent_user_id is null
        when actor.role::text='SUPPORT' and view_value='CLOSED' then conversation.status='CLOSED' and conversation.assigned_agent_user_id=actor.id
        when actor.role::text='SUPPORT' then conversation.status='OPEN' and conversation.assigned_agent_user_id=actor.id
        when view_value='WAITING' then conversation.status='WAITING'
        when view_value='ASSIGNED' then conversation.status='OPEN'
        when view_value='CLOSED' then conversation.status='CLOSED'
        else true end
  ),paged as (
    select scoped.* from scoped
    order by case when view_value='WAITING' then scoped.created_at end asc,
      case scoped.status when 'WAITING' then 0 when 'OPEN' then 1 else 2 end,
      scoped.last_message_at desc,scoped.id
    offset bounded_offset limit bounded_limit
  )
  select coalesce(jsonb_agg(public.support_conversation_summary(row.id)),'[]'::jsonb),(select count(*) from scoped)
  into items,total from paged row;

  if actor.role::text='SUPPORT' then
    select jsonb_build_object(
      'user_id',profile.user_id,'active',profile.active,'available',profile.available,
      'max_open_conversations',profile.max_open_conversations,
      'open_count',(
        (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')+
        (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')
      )
    ) into agent from public.support_agent_profiles profile where profile.user_id=actor.id;
  end if;
  return jsonb_build_object('items',items,'total',total,'view',view_value,'agent',agent,
    'counts',jsonb_build_object('assigned',assigned_count,'waiting',waiting_count,'closed',closed_count));
end;
$$;

create or replace function public.send_managed_support_message(actor_user_id uuid,conversation_id uuid,message_body text)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;conversation public.support_conversations%rowtype;body_value text:=trim(coalesce(message_body,''));message_id uuid:=gen_random_uuid();
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
  if not found or not public.support_actor_can_read(actor.id,conversation_id) then raise exception 'NOT_FOUND'; end if;
  if char_length(body_value) not between 1 and 2000 then raise exception 'INVALID_SUPPORT_MESSAGE'; end if;
  select * into conversation from public.support_conversations item where item.id=conversation_id for update;
  if conversation.status='CLOSED' then raise exception 'SUPPORT_CONVERSATION_CLOSED'; end if;
  if actor.role::text='SUPPORT' and (conversation.status<>'OPEN' or conversation.assigned_agent_user_id<>actor.id) then raise exception 'NOT_FOUND'; end if;
  if (select count(*) from public.support_messages message where message.sender_user_id=actor.id and message.created_at>=now()-interval '1 minute')>=20 then
    raise exception 'SUPPORT_MESSAGE_RATE_LIMITED';
  end if;
  insert into public.support_messages(id,conversation_id,sender_user_id,body,created_at)
  values(message_id,conversation.id,actor.id,body_value,now());
  update public.support_conversations set updated_at=now(),last_message_at=now(),
    customer_last_read_at=case when customer_user_id=actor.id then now() else customer_last_read_at end,
    agent_last_read_at=case when assigned_agent_user_id=actor.id then now() else agent_last_read_at end
  where id=conversation.id;
  insert into public.support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),conversation.id,actor.id,'MESSAGE_SENT',jsonb_build_object('senderRole',actor.role::text),now());
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_MESSAGE_SENT','support_conversation',conversation.id,'{}'::jsonb,now());
  return message_id;
end;
$$;

create or replace function public.claim_managed_support_conversation(actor_user_id uuid,conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;agent public.support_agent_profiles%rowtype;oldest uuid;open_count bigint;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='SUPPORT';
  if not found or not public.managed_actor_has_permission(actor.id,'SUPPORT') then raise exception 'FORBIDDEN'; end if;
  select * into agent from public.support_agent_profiles profile where profile.user_id=actor.id for update;
  if not found or not agent.active or not agent.available then raise exception 'SUPPORT_AGENT_UNAVAILABLE'; end if;
  select (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')+
    (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN') into open_count;
  if open_count>=agent.max_open_conversations then raise exception 'SUPPORT_AGENT_AT_CAPACITY'; end if;
  select conversation.id into oldest from public.support_conversations conversation
  where conversation.status='WAITING' and conversation.assigned_agent_user_id is null
  order by conversation.created_at,conversation.id for update skip locked limit 1;
  if oldest is null or oldest<>conversation_id then raise exception 'SUPPORT_CONVERSATION_NOT_WAITING'; end if;
  update public.support_conversations set status='OPEN',assigned_agent_user_id=actor.id,assigned_at=now(),updated_at=now()
  where id=oldest and status='WAITING' and assigned_agent_user_id is null;
  if not found then raise exception 'SUPPORT_CONVERSATION_NOT_WAITING'; end if;
  update public.support_agent_profiles set last_assigned_at=now(),updated_at=now() where user_id=actor.id;
  insert into public.support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),oldest,actor.id,'CLAIMED','{}'::jsonb,now());
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_CONVERSATION_CLAIMED','support_conversation',oldest,'{}'::jsonb,now());
end;
$$;

create or replace function public.close_managed_support_conversation(actor_user_id uuid,conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;conversation public.support_conversations%rowtype;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
  if not found or not public.support_actor_can_read(actor.id,conversation_id) then raise exception 'NOT_FOUND'; end if;
  select * into conversation from public.support_conversations item where item.id=conversation_id for update;
  if conversation.status='CLOSED' then raise exception 'SUPPORT_CONVERSATION_CLOSED'; end if;
  update public.support_conversations set status='CLOSED',closed_at=now(),closed_by=actor.id,updated_at=now() where id=conversation.id;
  insert into public.support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),conversation.id,actor.id,'CLOSED','{}'::jsonb,now());
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_CONVERSATION_CLOSED','support_conversation',conversation.id,'{}'::jsonb,now());
  perform public.support_assign_waiting(1);
end;
$$;

create or replace function public.update_managed_support_availability(actor_user_id uuid,requested_available boolean)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;agent public.support_agent_profiles%rowtype;open_count bigint;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='SUPPORT';
  if not found or not public.managed_actor_has_permission(actor.id,'SUPPORT') then raise exception 'FORBIDDEN'; end if;
  select * into agent from public.support_agent_profiles profile where profile.user_id=actor.id for update;
  if not found or not agent.active then raise exception 'SUPPORT_AGENT_UNAVAILABLE'; end if;
  update public.support_agent_profiles set available=coalesce(requested_available,false),updated_at=now() where user_id=actor.id;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_AGENT_AVAILABILITY_CHANGED','support_agent',actor.id,
    jsonb_build_object('available',coalesce(requested_available,false)),now());
  if coalesce(requested_available,false) then
    select (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')+
      (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN') into open_count;
    perform public.support_assign_waiting(greatest(1,agent.max_open_conversations-open_count));
  end if;
end;
$$;

create or replace function public.managed_assisted_matching_availability()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with available as (
    select agent.user_id from public.support_agent_profiles agent
    join public.profiles profile on profile.id=agent.user_id
    where profile.active and profile.role::text='SUPPORT' and agent.active and agent.available and agent.can_manage_support
      and (
        (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='OPEN')+
        (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='OPEN')
      )<agent.max_open_conversations
  )
  select jsonb_build_object('available',count(*)>0,'availableTeamMembers',count(*)) from available
$$;

create or replace function public.create_managed_guest_support(command jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare email_value text:=lower(trim(coalesce(command->>'email','')));digest_value text:=trim(coalesce(command->>'email_digest',''));
  phone_value text:=trim(coalesce(command->>'phone',''));body_value text:=trim(coalesce(command->>'body',''));
  storage_path text:=trim(coalesce(command->>'storage_path',''));original_name text:=left(trim(coalesce(command->>'original_name','')),160);
  mime_type text:=trim(coalesce(command->>'mime_type',''));size_bytes bigint:=coalesce(nullif(command->>'size_bytes','')::bigint,0);
  conversation_id uuid:=gen_random_uuid();message_id uuid:=gen_random_uuid();assigned uuid;
begin
  if char_length(email_value) not between 3 and 254 or position('@' in email_value)<2 then raise exception 'INVALID_EMAIL'; end if;
  if char_length(digest_value) not between 32 and 128 then raise exception 'GUEST_SUPPORT_ACCESS_DENIED'; end if;
  if char_length(phone_value) not between 7 and 30 then raise exception 'CALLBACK_PHONE_REQUIRED'; end if;
  if char_length(body_value) not between 1 and 2000 then raise exception 'INVALID_SUPPORT_MESSAGE'; end if;
  if exists(select 1 from public.guest_support_conversations conversation
    where conversation.email_digest=digest_value and conversation.status in ('WAITING','OPEN')) then
    raise exception 'GUEST_CONVERSATION_ALREADY_OPEN';
  end if;
  if storage_path<>'' and storage_path not like 'supabase://support-attachment/%' then raise exception 'INVALID_PRIVATE_STORAGE_REFERENCE'; end if;
  if storage_path<>'' and (original_name='' or mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') or size_bytes<=0) then
    raise exception 'INVALID_PRIVATE_STORAGE_REFERENCE';
  end if;
  insert into public.guest_support_conversations(id,email,email_digest,phone,status,created_at,updated_at,last_message_at,guest_last_read_at)
  values(conversation_id,email_value,digest_value,phone_value,'WAITING',now(),now(),now(),now());
  insert into public.guest_support_messages(id,conversation_id,sender_kind,sender_user_id,body,created_at)
  values(message_id,conversation_id,'GUEST',null,body_value,now());
  if storage_path<>'' then
    insert into public.guest_support_attachments(id,conversation_id,message_id,file_path,original_name,mime_type,size_bytes,created_at)
    values(gen_random_uuid(),conversation_id,message_id,storage_path,original_name,mime_type,size_bytes,now());
  end if;
  insert into public.guest_support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),conversation_id,null,'CREATED',jsonb_build_object('hasPhone',true,'hasAttachment',storage_path<>''),now());
  assigned:=public.support_assign_one(conversation_id,true);
  insert into public.access_email_deliveries(id,delivery_kind,entity_id,recipient_email,status,attempts,created_at,updated_at)
  values(gen_random_uuid(),'GUEST_SUPPORT',conversation_id,email_value,'QUEUED',0,now(),now());
  return jsonb_build_object('id',conversation_id,'assigned',assigned is not null);
end;
$$;

create or replace function public.managed_guest_support_access_candidates(requested_email_digest text)
returns table(conversation_id uuid)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select conversation.id from public.guest_support_conversations conversation
  where conversation.email_digest=trim(coalesce(requested_email_digest,''))
  order by conversation.created_at desc,conversation.id limit 20
$$;

create or replace function public.guest_support_projection(conversation_id uuid,include_contact boolean default false,requested_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare conversation public.guest_support_conversations%rowtype;messages jsonb;bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,50)));
begin
  select * into conversation from public.guest_support_conversations item where item.id=conversation_id;
  if not found then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at,row.id),'[]'::jsonb) into messages from (
    select message.id,message.conversation_id,message.sender_kind,message.sender_user_id,message.body,message.created_at,
      attachment.id as attachment_id,attachment.original_name as attachment_name,attachment.mime_type as attachment_mime_type
    from public.guest_support_messages message
    left join public.guest_support_attachments attachment on attachment.message_id=message.id
    where message.conversation_id=conversation.id
    order by message.created_at desc,message.id desc limit bounded_limit
  ) row;
  return jsonb_build_object(
    'id',conversation.id,'status',conversation.status,'created_at',conversation.created_at,'updated_at',conversation.updated_at,
    'last_message_at',conversation.last_message_at,'assigned_at',conversation.assigned_at,'closed_at',conversation.closed_at,
    'assigned_agent_user_id',conversation.assigned_agent_user_id,
    'assigned_agent_name',(select profile.full_name from public.profiles profile where profile.id=conversation.assigned_agent_user_id),
    'email',case when include_contact then conversation.email else null end,
    'phone',case when include_contact then conversation.phone else null end,
    'messages',messages,'message_count',(select count(*) from public.guest_support_messages message where message.conversation_id=conversation.id),
    'unread_team_count',(select count(*) from public.guest_support_messages message where message.conversation_id=conversation.id
      and message.sender_kind='TEAM' and (conversation.guest_last_read_at is null or message.created_at>conversation.guest_last_read_at))
  );
end;
$$;

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
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id<>actor.id) then raise exception 'NOT_FOUND'; end if;
    team:=true;
    if mark_read then update public.guest_support_conversations set agent_last_read_at=now() where id=conversation.id; end if;
  end if;
  return public.guest_support_projection(conversation.id,team,requested_limit);
end;
$$;

create or replace function public.managed_guest_support_inbox(actor_user_id uuid,requested_view text default 'ASSIGNED',requested_offset integer default 0,requested_limit integer default 15)
returns table(payload jsonb,total_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;view_value text:=upper(coalesce(requested_view,'ASSIGNED'));
  bounded_offset integer:=greatest(0,coalesce(requested_offset,0));bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,15)));
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active;
  if not found or actor.role::text not in ('SUPPORT','ADMIN') or not public.managed_actor_has_permission(actor.id,'SUPPORT') then raise exception 'FORBIDDEN'; end if;
  if view_value not in ('ASSIGNED','WAITING','CLOSED','ALL') then raise exception 'INVALID_SUPPORT_VIEW'; end if;
  return query with scoped as (
    select conversation.id,conversation.status,conversation.last_message_at,conversation.created_at,
      conversation.email,conversation.phone,conversation.assigned_agent_user_id,
      agent.full_name as assigned_agent_name,
      (select left(message.body,120) from public.guest_support_messages message where message.conversation_id=conversation.id
        order by message.created_at desc,message.id desc limit 1) as last_message_preview
    from public.guest_support_conversations conversation
    left join public.profiles agent on agent.id=conversation.assigned_agent_user_id
    where case
      when actor.role::text='SUPPORT' and view_value='WAITING' then conversation.status='WAITING' and conversation.assigned_agent_user_id is null
      when actor.role::text='SUPPORT' and view_value='CLOSED' then conversation.status='CLOSED' and conversation.assigned_agent_user_id=actor.id
      when actor.role::text='SUPPORT' then conversation.status='OPEN' and conversation.assigned_agent_user_id=actor.id
      when view_value='WAITING' then conversation.status='WAITING'
      when view_value='ASSIGNED' then conversation.status='OPEN'
      when view_value='CLOSED' then conversation.status='CLOSED'
      else true end
  ),counted as (select scoped.*,count(*) over() as row_total from scoped)
  select jsonb_build_object('id',row.id,'email',row.email,'phone',row.phone,'status',row.status,
    'last_message_at',row.last_message_at,'created_at',row.created_at,'assigned_agent_user_id',row.assigned_agent_user_id,
    'assigned_agent_name',row.assigned_agent_name,'last_message_preview',row.last_message_preview),row.row_total
  from counted row order by case when view_value='WAITING' then row.created_at end asc,row.last_message_at desc,row.id
  offset bounded_offset limit bounded_limit;
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
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id<>actor.id) then raise exception 'NOT_FOUND'; end if;
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

create or replace function public.claim_managed_guest_support(actor_user_id uuid,conversation_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;agent public.support_agent_profiles%rowtype;oldest uuid;open_count bigint;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='SUPPORT';
  if not found or not public.managed_actor_has_permission(actor.id,'SUPPORT') then raise exception 'FORBIDDEN'; end if;
  select * into agent from public.support_agent_profiles profile where profile.user_id=actor.id for update;
  if not found or not agent.active or not agent.available then raise exception 'SUPPORT_AGENT_UNAVAILABLE'; end if;
  select (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN')+
    (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=actor.id and conversation.status='OPEN') into open_count;
  if open_count>=agent.max_open_conversations then raise exception 'SUPPORT_AGENT_AT_CAPACITY'; end if;
  select conversation.id into oldest from public.guest_support_conversations conversation
  where conversation.status='WAITING' and conversation.assigned_agent_user_id is null
  order by conversation.created_at,conversation.id for update skip locked limit 1;
  if oldest is null or oldest<>conversation_id then raise exception 'SUPPORT_CONVERSATION_NOT_WAITING'; end if;
  update public.guest_support_conversations set status='OPEN',assigned_agent_user_id=actor.id,assigned_at=now(),updated_at=now()
  where id=oldest and status='WAITING' and assigned_agent_user_id is null;
  if not found then raise exception 'SUPPORT_CONVERSATION_NOT_WAITING'; end if;
  update public.support_agent_profiles set last_assigned_at=now(),updated_at=now() where user_id=actor.id;
  insert into public.guest_support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
  values(gen_random_uuid(),oldest,actor.id,'CLAIMED','{}'::jsonb,now());
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
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id<>actor.id) then raise exception 'NOT_FOUND'; end if;
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
      or (actor.role::text='SUPPORT' and conversation.assigned_agent_user_id<>actor.id) then raise exception 'NOT_FOUND'; end if;
  end if;
  select * into attachment from public.guest_support_attachments item
  where item.id=attachment_id and item.conversation_id=conversation.id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('storage_path',attachment.file_path,'original_name',attachment.original_name,'mime_type',attachment.mime_type);
end;
$$;

create or replace function public.managed_support_agent_page(actor_user_id uuid,requested_offset integer default 0,requested_limit integer default 10)
returns table(payload jsonb,total_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;bounded_offset integer:=greatest(0,coalesce(requested_offset,0));bounded_limit integer:=greatest(1,least(50,coalesce(requested_limit,10)));
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN';
  if not found then raise exception 'FORBIDDEN'; end if;
  return query with scoped as (
    select agent.*,profile.full_name as name,profile.email,profile.active as user_active,
      (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='OPEN')+
      (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='OPEN') as open_count,
      (select count(*) from public.support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='CLOSED')+
      (select count(*) from public.guest_support_conversations conversation where conversation.assigned_agent_user_id=agent.user_id and conversation.status='CLOSED') as closed_count
    from public.support_agent_profiles agent join public.profiles profile on profile.id=agent.user_id where profile.role::text='SUPPORT'
  ),counted as (select scoped.*,count(*) over() as row_total from scoped)
  select jsonb_build_object('user_id',row.user_id,'active',row.active,'available',row.available,
    'max_open_conversations',row.max_open_conversations,'can_manage_customers',row.can_manage_customers,
    'can_manage_operations',row.can_manage_operations,'can_manage_trust',row.can_manage_trust,
    'can_manage_billing',row.can_manage_billing,'can_manage_support',row.can_manage_support,
    'last_assigned_at',row.last_assigned_at,'created_at',row.created_at,'updated_at',row.updated_at,
    'name',row.name,'email',row.email,'user_active',row.user_active,'open_count',row.open_count,'closed_count',row.closed_count),row.row_total
  from counted row order by row.user_active desc,row.active desc,row.name,row.user_id offset bounded_offset limit bounded_limit;
end;
$$;

create or replace function public.create_managed_support_agent(actor_user_id uuid,agent_auth_user_id uuid,command jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare actor public.profiles%rowtype;auth_user auth.users%rowtype;name_value text:=trim(coalesce(command->>'name',''));
  email_value text:=lower(trim(coalesce(command->>'email','')));max_open integer:=coalesce(nullif(command->>'max_open_conversations','')::integer,3);
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN';
  if not found then raise exception 'FORBIDDEN'; end if;
  if char_length(name_value) not between 1 and 120 or char_length(email_value) not between 3 and 254 then raise exception 'MISSING_REQUIRED_FIELDS'; end if;
  if max_open not between 1 and 20 then raise exception 'INVALID_SUPPORT_AGENT_LIMIT'; end if;
  select * into auth_user from auth.users account where account.id=agent_auth_user_id and lower(account.email)=email_value;
  if not found then raise exception 'MANAGED_IDENTITY_NOT_FOUND'; end if;
  if exists(select 1 from public.profiles profile where lower(profile.email)=email_value and profile.id<>agent_auth_user_id) then
    raise exception 'EMAIL_ALREADY_EXISTS';
  end if;
  if exists(select 1 from public.profiles profile where profile.id=agent_auth_user_id and (
    profile.active or exists(select 1 from public.organization_members member where member.user_id=profile.id)
    or exists(select 1 from public.provider_profiles provider where provider.user_id=profile.id)
    or exists(select 1 from public.drivers driver where driver.user_id=profile.id)
    or exists(select 1 from public.support_agent_profiles support where support.user_id=profile.id)
  )) then raise exception 'EMAIL_ALREADY_EXISTS'; end if;
  insert into public.profiles(id,email,phone,full_name,role,active,created_at)
  values(agent_auth_user_id,email_value,null,name_value,'SUPPORT',true,now())
  on conflict(id) do update set email=excluded.email,phone=null,full_name=excluded.full_name,role='SUPPORT',active=true;
  insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,
    can_manage_customers,can_manage_operations,can_manage_trust,can_manage_billing,can_manage_support,created_at,updated_at)
  values(agent_auth_user_id,true,coalesce((command->>'can_manage_support')::boolean,true),max_open,
    coalesce((command->>'can_manage_customers')::boolean,false),coalesce((command->>'can_manage_operations')::boolean,false),
    coalesce((command->>'can_manage_trust')::boolean,false),coalesce((command->>'can_manage_billing')::boolean,false),
    coalesce((command->>'can_manage_support')::boolean,true),now(),now());
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_AGENT_CREATED','support_agent',agent_auth_user_id,
    jsonb_build_object('maxOpenConversations',max_open,'permissions',jsonb_build_object(
      'customers',coalesce((command->>'can_manage_customers')::boolean,false),
      'operations',coalesce((command->>'can_manage_operations')::boolean,false),
      'trust',coalesce((command->>'can_manage_trust')::boolean,false),
      'billing',coalesce((command->>'can_manage_billing')::boolean,false),
      'support',coalesce((command->>'can_manage_support')::boolean,true))),now());
  perform public.support_assign_waiting(max_open);
  return agent_auth_user_id;
end;
$$;

create or replace function public.update_managed_support_agent(actor_user_id uuid,agent_user_id uuid,command jsonb)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare actor public.profiles%rowtype;agent public.support_agent_profiles%rowtype;max_open integer:=coalesce(nullif(command->>'max_open_conversations','')::integer,3);
  active_value boolean:=coalesce((command->>'active')::boolean,false);support_value boolean:=coalesce((command->>'can_manage_support')::boolean,false);
  available_value boolean;requeued_member integer:=0;requeued_guest integer:=0;
begin
  select * into actor from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text='ADMIN';
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into agent from public.support_agent_profiles profile where profile.user_id=agent_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if max_open not between 1 and 20 then raise exception 'INVALID_SUPPORT_AGENT_LIMIT'; end if;
  available_value:=active_value and support_value and coalesce((command->>'available')::boolean,false);
  update public.support_agent_profiles set active=active_value,available=available_value,max_open_conversations=max_open,
    can_manage_customers=coalesce((command->>'can_manage_customers')::boolean,false),
    can_manage_operations=coalesce((command->>'can_manage_operations')::boolean,false),
    can_manage_trust=coalesce((command->>'can_manage_trust')::boolean,false),
    can_manage_billing=coalesce((command->>'can_manage_billing')::boolean,false),
    can_manage_support=support_value,updated_at=now() where user_id=agent_user_id;
  update public.profiles set active=active_value where id=agent_user_id and role::text='SUPPORT';
  if not active_value or not support_value then
    with moved as (
      update public.support_conversations set status='WAITING',assigned_agent_user_id=null,assigned_at=null,agent_last_read_at=null,updated_at=now()
      where assigned_agent_user_id=agent_user_id and status='OPEN' returning id
    ),logged as (
      insert into public.support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
      select gen_random_uuid(),moved.id,actor.id,'REQUEUED',jsonb_build_object('disabledAgentUserId',agent_user_id),now() from moved
      returning 1
    ) select count(*) into requeued_member from logged;
    with moved as (
      update public.guest_support_conversations set status='WAITING',assigned_agent_user_id=null,assigned_at=null,agent_last_read_at=null,updated_at=now()
      where assigned_agent_user_id=agent_user_id and status='OPEN' returning id
    ),logged as (
      insert into public.guest_support_events(id,conversation_id,actor_user_id,event_type,details,created_at)
      select gen_random_uuid(),moved.id,actor.id,'REQUEUED',jsonb_build_object('disabledAgentUserId',agent_user_id),now() from moved
      returning 1
    ) select count(*) into requeued_guest from logged;
  end if;
  insert into public.audit_logs(id,actor_user_id,action,entity_type,entity_id,details,created_at)
  values(gen_random_uuid(),actor.id,'SUPPORT_AGENT_UPDATED','support_agent',agent_user_id,
    jsonb_build_object('active',active_value,'available',available_value,'maxOpenConversations',max_open,
      'requeuedMember',requeued_member,'requeuedGuest',requeued_guest),now());
  perform public.support_assign_waiting(100);
end;
$$;

revoke all on function public.support_member_actor(uuid) from public,anon,authenticated;
revoke all on function public.support_conversation_summary(uuid) from public,anon,authenticated;
revoke all on function public.support_actor_can_read(uuid,uuid) from public,anon,authenticated;
revoke all on function public.support_assign_one(uuid,boolean) from public,anon,authenticated;
revoke all on function public.support_assign_waiting(integer) from public,anon,authenticated;
revoke all on function public.create_managed_support_conversation(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.managed_member_support_page(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.managed_open_member_support(uuid) from public,anon,authenticated;
revoke all on function public.managed_support_conversation(uuid,uuid,integer,boolean) from public,anon,authenticated;
revoke all on function public.managed_support_inbox(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.send_managed_support_message(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_managed_support_conversation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.close_managed_support_conversation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.update_managed_support_availability(uuid,boolean) from public,anon,authenticated;
revoke all on function public.managed_assisted_matching_availability() from public,anon,authenticated;
revoke all on function public.create_managed_guest_support(jsonb) from public,anon,authenticated;
revoke all on function public.managed_guest_support_access_candidates(text) from public,anon,authenticated;
revoke all on function public.guest_support_projection(uuid,boolean,integer) from public,anon,authenticated;
revoke all on function public.managed_guest_support_conversation(uuid,uuid,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.managed_guest_support_inbox(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.send_managed_guest_support_message(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.claim_managed_guest_support(uuid,uuid) from public,anon,authenticated;
revoke all on function public.close_managed_guest_support(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.managed_guest_support_attachment_file(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.managed_support_agent_page(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.create_managed_support_agent(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.update_managed_support_agent(uuid,uuid,jsonb) from public,anon,authenticated;

grant execute on function public.create_managed_support_conversation(uuid,jsonb) to service_role;
grant execute on function public.managed_member_support_page(uuid,integer,integer) to service_role;
grant execute on function public.managed_open_member_support(uuid) to service_role;
grant execute on function public.managed_support_conversation(uuid,uuid,integer,boolean) to service_role;
grant execute on function public.managed_support_inbox(uuid,text,integer,integer) to service_role;
grant execute on function public.send_managed_support_message(uuid,uuid,text) to service_role;
grant execute on function public.claim_managed_support_conversation(uuid,uuid) to service_role;
grant execute on function public.close_managed_support_conversation(uuid,uuid) to service_role;
grant execute on function public.update_managed_support_availability(uuid,boolean) to service_role;
grant execute on function public.managed_assisted_matching_availability() to service_role;
grant execute on function public.create_managed_guest_support(jsonb) to service_role;
grant execute on function public.managed_guest_support_access_candidates(text) to service_role;
grant execute on function public.managed_guest_support_conversation(uuid,uuid,text,integer,boolean) to service_role;
grant execute on function public.managed_guest_support_inbox(uuid,text,integer,integer) to service_role;
grant execute on function public.send_managed_guest_support_message(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.claim_managed_guest_support(uuid,uuid) to service_role;
grant execute on function public.close_managed_guest_support(uuid,uuid,text) to service_role;
grant execute on function public.managed_guest_support_attachment_file(uuid,uuid,uuid,text) to service_role;
grant execute on function public.managed_support_agent_page(uuid,integer,integer) to service_role;
grant execute on function public.create_managed_support_agent(uuid,uuid,jsonb) to service_role;
grant execute on function public.update_managed_support_agent(uuid,uuid,jsonb) to service_role;
