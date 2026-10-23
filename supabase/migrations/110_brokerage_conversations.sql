-- FEAT-TRQ-001: private, durable Brokerage conversations. No Realtime publication.
create table public.transport_chat_access (
 request_id uuid primary key references public.transport_service_requests(id),
 credential_digest text not null check(credential_digest ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null default (now()+interval '7 days')
);
create table public.transport_chat_messages (
 id uuid primary key,
 request_id uuid not null references public.transport_service_requests(id),
 sequence bigint generated always as identity unique,
 actor_user_id uuid references public.profiles(id),
 sender_kind text not null check(sender_kind in ('VISITOR','BROKER')),
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp(),
 check((sender_kind='VISITOR' and actor_user_id is null) or (sender_kind='BROKER' and actor_user_id is not null))
);
create index transport_chat_history on public.transport_chat_messages(request_id,sequence);
alter table public.transport_chat_access enable row level security;
alter table public.transport_chat_messages enable row level security;
revoke all on public.transport_chat_access,public.transport_chat_messages from public,anon,authenticated;
revoke all on sequence public.transport_chat_messages_sequence_seq from public,anon,authenticated;
grant all on public.transport_chat_access,public.transport_chat_messages to service_role;
grant usage,select on sequence public.transport_chat_messages_sequence_seq to service_role;

create function public.create_transport_chat_request(request_id uuid,command jsonb,access_digest text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if request_id is null or access_digest is null or access_digest !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_TRANSPORT_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 if exists(select 1 from public.transport_service_requests r where r.id=request_id) and not exists(
  select 1 from public.transport_chat_access a where a.request_id=create_transport_chat_request.request_id
  and a.credential_digest=access_digest and a.expires_at>now()
 ) then raise exception 'FORBIDDEN';end if;
 perform public.create_transport_service_request(request_id,command);
 insert into public.transport_chat_access(request_id,credential_digest) values(request_id,access_digest) on conflict do nothing;
end $$;

create function public.can_access_transport_chat(request_id uuid,access_digest text,actor_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.transport_service_requests r join public.transport_chat_access a on a.request_id=r.id
 where r.id=can_access_transport_chat.request_id and (
  (actor_user_id is null and a.credential_digest=access_digest and a.expires_at>now()) or
  (actor_user_id is not null and public.can_manage_brokerage(actor_user_id) and
   (exists(select 1 from public.profiles p where p.id=actor_user_id and p.role='ADMIN') or r.assigned_agent_user_id=actor_user_id))
 ));
$$;

create function public.transport_chat_snapshot(request_id uuid,access_digest text,actor_user_id uuid,after_sequence bigint default 0,before_sequence bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;messages jsonb;last_sequence bigint;has_more boolean;oldest bigint;
begin
 if not public.can_access_transport_chat(request_id,access_digest,actor_user_id) then raise exception 'FORBIDDEN';end if;
 if after_sequence is null or after_sequence<0 or before_sequence is not null and before_sequence<1 then raise exception 'INVALID_TRANSPORT_MESSAGE';end if;
 select jsonb_build_object('id',r.id,'origin',r.origin,'destination',r.destination,'status',r.status,
  'assignedName',p.full_name,'updatedAt',r.updated_at)
 into result from public.transport_service_requests r left join public.profiles p on p.id=r.assigned_agent_user_id where r.id=request_id;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.sequence),'[]'::jsonb),min(m.sequence),max(m.sequence) into messages,oldest,last_sequence from (
  select m.id,m.sequence,m.sender_kind,m.body,m.created_at,p.full_name as sender_name
  from public.transport_chat_messages m left join public.profiles p on p.id=m.actor_user_id
  where m.request_id=transport_chat_snapshot.request_id and m.sequence>after_sequence and (before_sequence is null or m.sequence<before_sequence)
  order by case when after_sequence>0 then m.sequence end asc, m.sequence desc limit 50
 ) m;
 select exists(select 1 from public.transport_chat_messages m where m.request_id=transport_chat_snapshot.request_id
  and case when after_sequence>0 then m.sequence>coalesce(last_sequence,after_sequence) else m.sequence<oldest end) into has_more;
 return jsonb_build_object('request',result,'messages',messages,'hasMore',has_more);
end $$;

create function public.send_transport_chat_message(request_id uuid,access_digest text,actor_user_id uuid,message_id uuid,message_body text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.transport_service_requests%rowtype;existing public.transport_chat_messages%rowtype;
begin
 if actor_user_id is not null then perform public.lock_brokerage_actor(actor_user_id);end if;
 select * into saved from public.transport_service_requests where id=request_id for update;
 if not found or not public.can_access_transport_chat(request_id,access_digest,actor_user_id) then raise exception 'FORBIDDEN';end if;
 if message_id is null or message_body is null or length(btrim(message_body)) not between 1 and 2000 then raise exception 'INVALID_TRANSPORT_MESSAGE';end if;
 select * into existing from public.transport_chat_messages where id=message_id;
 if found then
  if (existing.request_id,existing.actor_user_id,existing.body) is distinct from (request_id,actor_user_id,btrim(message_body)) then raise exception 'INVALID_TRANSPORT_MESSAGE';end if;
  return;
 end if;
 if saved.status='CLOSED' then raise exception 'TRANSPORT_CHAT_CLOSED';end if;
 insert into public.transport_chat_messages(id,request_id,actor_user_id,sender_kind,body)
 values(message_id,request_id,actor_user_id,case when actor_user_id is null then 'VISITOR' else 'BROKER' end,btrim(message_body));
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id)
 values(actor_user_id,'transport_message_sent','transport_service_request',request_id);
end $$;

-- Expose only message metadata in the queue, never visitor credentials or body text.
do $patch$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.brokerage_request_inbox(uuid,text,text,integer)'::regprocedure);
 needle:='p.full_name as assigned_agent_name,';
 if strpos(definition,needle)=0 then raise exception 'BROKERAGE_CHAT_PATCH_PRECONDITION';end if;
 definition:=replace(definition,needle,needle||'
     exists(select 1 from public.transport_chat_access a where a.request_id=t.id) as chat_enabled,
     coalesce((select max(m.sequence) from public.transport_chat_messages m where m.request_id=t.id),0) as last_message_sequence,
     coalesce((select max(m.sequence) from public.transport_chat_messages m where m.request_id=t.id and m.sender_kind=''VISITOR''),0)>
       coalesce((select max(m.sequence) from public.transport_chat_messages m where m.request_id=t.id and m.sender_kind=''BROKER''),0) as awaiting_reply,
     greatest(t.created_at,coalesce((select max(m.created_at) from public.transport_chat_messages m where m.request_id=t.id),t.created_at)) as last_chat_activity,');
 definition:=replace(definition,'order by r.created_at desc,r.id desc','order by r.awaiting_reply desc,r.last_chat_activity desc,r.id desc');
 definition:=replace(definition,'order by t.created_at desc,t.id desc offset','order by awaiting_reply desc,last_chat_activity desc,t.id desc offset');
 execute definition;
end $patch$;

revoke all on function public.create_transport_chat_request(uuid,jsonb,text),public.can_access_transport_chat(uuid,text,uuid),public.transport_chat_snapshot(uuid,text,uuid,bigint,bigint),public.send_transport_chat_message(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_transport_chat_request(uuid,jsonb,text),public.can_access_transport_chat(uuid,text,uuid),public.transport_chat_snapshot(uuid,text,uuid,bigint,bigint),public.send_transport_chat_message(uuid,text,uuid,uuid,text) to service_role;
