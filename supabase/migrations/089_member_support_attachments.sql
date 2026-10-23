-- FEAT-SUP-001 / BASE-DEP-001. Private attachments retain current conversation scope.
create table public.support_attachments(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.support_conversations(id),
 uploaded_by uuid not null references public.profiles(id),
 message_id uuid unique references public.support_messages(id),
 file_path text not null unique check(file_path ~ '^supabase://support-attachment/member-support/[0-9]{4}-[0-9]{2}-[0-9]{2}/[a-f0-9-]{36}\.(jpg|png|webp|pdf)$'),
 original_name text not null check(char_length(original_name) between 1 and 160),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 size_bytes integer not null check(size_bytes between 1 and 4194304),
 state text not null default 'PENDING' check(state in ('PENDING','ATTACHED','RETIRED','DELETING')),
 upload_finished boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((state='ATTACHED')=(message_id is not null))
);
alter table public.support_attachments enable row level security;
revoke all on public.support_attachments from public,anon,authenticated;
grant all on public.support_attachments to service_role;
create index support_attachment_cleanup_idx on public.support_attachments(state,updated_at);
create index support_attachment_conversation_idx on public.support_attachments(conversation_id);

create function public.support_attachment_reply_scope(actor_user_id uuid,target_conversation_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare conversation support_conversations%rowtype;
begin
 perform 1 from profiles where id=actor_user_id and active for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into conversation from support_conversations where id=target_conversation_id for update;
 if not found or not support_actor_can_read(actor_user_id,target_conversation_id) then raise exception 'NOT_FOUND';end if;
 if conversation.status='CLOSED' then raise exception 'SUPPORT_CONVERSATION_CLOSED';end if;
 if exists(select 1 from profiles where id=actor_user_id and role='SUPPORT')
   and (conversation.status<>'OPEN' or conversation.assigned_agent_user_id is distinct from actor_user_id) then raise exception 'NOT_FOUND';end if;
end $$;

create function public.reserve_support_attachment(actor_user_id uuid,target_conversation_id uuid,command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare upload_id uuid;
begin
 perform support_attachment_reply_scope(actor_user_id,target_conversation_id);
 if (select count(*) from support_attachments where uploaded_by=actor_user_id and state='PENDING')>=5 then raise exception 'SUPPORT_UPLOAD_BUSY';end if;
 if (select count(*) from support_messages where sender_user_id=actor_user_id and created_at>=now()-interval '1 minute')>=20 then raise exception 'SUPPORT_MESSAGE_RATE_LIMITED';end if;
 insert into support_attachments(conversation_id,uploaded_by,file_path,original_name,mime_type,size_bytes)
 values(target_conversation_id,actor_user_id,command->>'file_path',command->>'original_name',command->>'mime_type',(command->>'size_bytes')::integer)
 returning id into upload_id;
 return upload_id;
end $$;

create function public.send_support_attachment_message(actor_user_id uuid,target_conversation_id uuid,upload_id uuid,message_body text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare upload support_attachments%rowtype; result uuid;
begin
 perform support_attachment_reply_scope(actor_user_id,target_conversation_id);
 select * into upload from support_attachments where id=upload_id and conversation_id=target_conversation_id and uploaded_by=actor_user_id for update;
 if not found or upload.state not in ('PENDING','ATTACHED') then raise exception 'NOT_FOUND';end if;
 if upload.state='ATTACHED' then
   if not exists(select 1 from support_messages where id=upload.message_id and body=trim(message_body)) then raise exception 'INVALID_SUPPORT_MESSAGE';end if;
   return upload.message_id;
 end if;
 result:=send_managed_support_message(actor_user_id,target_conversation_id,message_body);
 update support_attachments set state='ATTACHED',message_id=result,upload_finished=true,updated_at=now() where id=upload.id;
 return result;
end $$;

create function public.discard_support_attachment(actor_user_id uuid,upload_id uuid,upload_completed boolean default false)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update support_attachments set state='RETIRED',upload_finished=coalesce(upload_completed,false),updated_at=now()
 where id=upload_id and uploaded_by=actor_user_id and state in ('PENDING','RETIRED');
 return found;
end $$;

create function public.support_attachment_file(actor_user_id uuid,target_conversation_id uuid,attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not support_actor_can_read(actor_user_id,target_conversation_id) then return null;end if;
 return (select jsonb_build_object('file_path',a.file_path,'mime_type',a.mime_type,'original_name',a.original_name)
 from support_attachments a join support_messages m on m.id=a.message_id and m.conversation_id=a.conversation_id
 where a.id=attachment_id and a.conversation_id=target_conversation_id and a.state='ATTACHED');
end $$;

create function public.claim_support_attachment_cleanup(requested_limit integer default 20)
returns table(id uuid,file_path text) language sql security definer set search_path=public,pg_temp as $$
 with claimed as (
 select a.id from support_attachments a where
   (a.state='RETIRED' and (a.upload_finished or a.updated_at<now()-interval '1 hour'))
   or (a.state='PENDING' and a.updated_at<now()-interval '1 hour')
   or (a.state='DELETING' and a.updated_at<now()-interval '5 minutes')
 order by a.updated_at,a.id limit greatest(1,least(20,coalesce(requested_limit,20))) for update skip locked
 ) update support_attachments a set state='DELETING',updated_at=now() from claimed c where a.id=c.id returning a.id,a.file_path;
$$;

-- Extend just the two member-message projections; bounded ordering/authority stay unchanged.
do $migration$
declare signature text; definition text; fragment text:='sender.role::text as sender_role';
begin
 foreach signature in array array['public.managed_support_conversation(uuid,uuid,integer,boolean)','public.managed_support_history(uuid,uuid,uuid,integer)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if length(definition)-length(replace(definition,fragment,''))<>length(fragment) then raise exception 'SUPPORT_ATTACHMENT_PROJECTION_NOT_FOUND';end if;
  definition:=replace(definition,fragment,fragment||', attachment.id as attachment_id,attachment.original_name as attachment_name,attachment.mime_type as attachment_mime_type');
  fragment:='join public.profiles sender on sender.id=message.sender_user_id';
  if length(definition)-length(replace(definition,fragment,''))<>length(fragment) then raise exception 'SUPPORT_ATTACHMENT_JOIN_NOT_FOUND';end if;
  execute replace(definition,fragment,fragment||' left join public.support_attachments attachment on attachment.message_id=message.id and attachment.conversation_id=message.conversation_id and attachment.state=''ATTACHED''');
  fragment:='sender.role::text as sender_role';
 end loop;
 foreach signature in array array['support_attachment_reply_scope(uuid,uuid)','reserve_support_attachment(uuid,uuid,jsonb)',
  'send_support_attachment_message(uuid,uuid,uuid,text)','discard_support_attachment(uuid,uuid,boolean)',
  'support_attachment_file(uuid,uuid,uuid)','claim_support_attachment_cleanup(integer)'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',signature);
  execute format('grant execute on function public.%s to service_role',signature);
 end loop;
end $migration$;
