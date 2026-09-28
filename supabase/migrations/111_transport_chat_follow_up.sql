-- FEAT-TRQ-001: ending messaging preserves the request for telephone follow-up.
alter table public.transport_chat_access add column ended_at timestamptz;

create function public.end_transport_chat(request_id uuid,access_digest text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.transport_service_requests%rowtype;
begin
 select * into saved from public.transport_service_requests where id=request_id for update;
 if not found or not public.can_access_transport_chat(request_id,access_digest,null) then raise exception 'FORBIDDEN';end if;
 if saved.status='CLOSED' or exists(select 1 from public.transport_chat_access a where a.request_id=end_transport_chat.request_id and a.ended_at is not null) then return;end if;
 update public.transport_chat_access set ended_at=clock_timestamp() where transport_chat_access.request_id=end_transport_chat.request_id;
 -- Invalidate stale staff drafts without resolving the request or changing its owner/notes.
 update public.transport_service_requests set version=version+1,updated_at=clock_timestamp(),last_changed_by=null where id=request_id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id)
 values(null,'transport_chat_ended','transport_service_request',request_id);
end $$;
revoke all on function public.end_transport_chat(uuid,text) from public,anon,authenticated;
grant execute on function public.end_transport_chat(uuid,text) to service_role;

create or replace function public.transport_chat_snapshot(request_id uuid,access_digest text,actor_user_id uuid,after_sequence bigint default 0,before_sequence bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;messages jsonb;last_sequence bigint;has_more boolean;oldest bigint;
begin
 if not public.can_access_transport_chat(request_id,access_digest,actor_user_id) then raise exception 'FORBIDDEN';end if;
 if after_sequence is null or after_sequence<0 or before_sequence is not null and before_sequence<1 then raise exception 'INVALID_TRANSPORT_MESSAGE';end if;
 select jsonb_build_object('id',r.id,'origin',r.origin,'destination',r.destination,'status',r.status,
  'assignedName',p.full_name,'updatedAt',r.updated_at,
  'endedAt',a.ended_at,'expiresAt',a.expires_at)
 into result from public.transport_service_requests r join public.transport_chat_access a on a.request_id=r.id left join public.profiles p on p.id=r.assigned_agent_user_id where r.id=transport_chat_snapshot.request_id;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.sequence),'[]'::jsonb),min(m.sequence),max(m.sequence) into messages,oldest,last_sequence from (
  select m.id,m.sequence,m.sender_kind,m.body,m.created_at,p.full_name as sender_name
  from public.transport_chat_messages m left join public.profiles p on p.id=m.actor_user_id
  where m.request_id=transport_chat_snapshot.request_id and m.sequence>after_sequence and (before_sequence is null or m.sequence<before_sequence)
  order by case when after_sequence>0 then m.sequence end asc, m.sequence desc limit 50
 ) m;
 select exists(select 1 from public.transport_chat_messages m where m.request_id=transport_chat_snapshot.request_id
  and case when after_sequence>0 then m.sequence>coalesce(last_sequence,after_sequence) else m.sequence<oldest end) into has_more;
 return jsonb_build_object('request',result,'messages',messages,'hasMore',has_more)||
  case when actor_user_id is not null then jsonb_build_object('staffDetails',(select jsonb_build_object('name',r.requester_name,'phone',r.phone,'version',r.version,'followUpNote',r.follow_up_note) from public.transport_service_requests r where r.id=request_id)) else '{}'::jsonb end;
end $$;

create or replace function public.send_transport_chat_message(request_id uuid,access_digest text,actor_user_id uuid,message_id uuid,message_body text)
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
 if exists(select 1 from public.transport_chat_access a where a.request_id=send_transport_chat_message.request_id and (a.ended_at is not null or a.expires_at<=now())) then raise exception 'TRANSPORT_CHAT_ENDED';end if;
 insert into public.transport_chat_messages(id,request_id,actor_user_id,sender_kind,body)
 values(message_id,request_id,actor_user_id,case when actor_user_id is null then 'VISITOR' else 'BROKER' end,btrim(message_body));
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id)
 values(actor_user_id,'transport_message_sent','transport_service_request',request_id);
end $$;

create or replace function public.brokerage_request_inbox(actor_user_id uuid,requested_queue text default 'MINE',requested_view text default 'ALL',requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare admin_actor boolean;items jsonb;counts jsonb;queues jsonb;total bigint;page_value integer;agents jsonb;
begin
 if not public.can_manage_brokerage(actor_user_id) then raise exception 'FORBIDDEN';end if;
 select role='ADMIN' into admin_actor from public.profiles where id=actor_user_id;
 if requested_queue is null or requested_queue not in ('MINE','UNASSIGNED','ALL') or (requested_queue='ALL' and not admin_actor)
   or requested_view is null or requested_view not in ('NEW','CONTACTED','CLOSED','ALL','ACTIVE','FOLLOW_UP') then raise exception 'INVALID_TRANSPORT_VIEW';end if;
 select jsonb_build_object('MINE',count(*) filter(where assigned_agent_user_id=actor_user_id),
   'UNASSIGNED',count(*) filter(where assigned_agent_user_id is null and status<>'CLOSED'),
   'ALL',case when admin_actor then count(*) else 0 end) into queues
 from public.transport_service_requests where admin_actor or assigned_agent_user_id=actor_user_id or assigned_agent_user_id is null;
 select jsonb_build_object('NEW',count(*) filter(where status='NEW'),'CONTACTED',count(*) filter(where status='CONTACTED'),
   'CLOSED',count(*) filter(where status='CLOSED'),'ALL',count(*),
   'ACTIVE',count(*) filter(where status<>'CLOSED' and exists(select 1 from public.transport_chat_access a where a.request_id=transport_service_requests.id and a.ended_at is null and a.expires_at>now())),
   'FOLLOW_UP',count(*) filter(where status<>'CLOSED' and not exists(select 1 from public.transport_chat_access a where a.request_id=transport_service_requests.id and a.ended_at is null and a.expires_at>now()))) into counts from public.transport_service_requests
 where requested_queue='ALL' or (requested_queue='MINE' and assigned_agent_user_id=actor_user_id)
   or (requested_queue='UNASSIGNED' and assigned_agent_user_id is null and status<>'CLOSED');
 total:=(counts->>requested_view)::bigint;
 page_value:=greatest(1,least(coalesce(requested_page,1),greatest(1,ceil(total/15.0)::integer)));
 select coalesce(jsonb_agg(to_jsonb(r) order by r.awaiting_reply desc,r.last_chat_activity desc,r.id desc),'[]'::jsonb) into items from (
   select t.id,t.origin,t.destination,t.status,t.version,t.created_at,t.updated_at,t.assigned_agent_user_id,
     p.full_name as assigned_agent_name,
     ca.request_id is not null as chat_enabled,ca.ended_at as chat_ended_at,ca.expires_at as chat_expires_at,
     coalesce((select max(m.sequence) from public.transport_chat_messages m where m.request_id=t.id),0) as last_message_sequence,
     (t.status<>'CLOSED' and ca.request_id is not null and ca.ended_at is null and ca.expires_at>now() and
       coalesce((select max(m.sequence) from public.transport_chat_messages m where m.request_id=t.id and m.sender_kind='VISITOR'),0)>
       coalesce((select max(m.sequence) from public.transport_chat_messages m where m.request_id=t.id and m.sender_kind='BROKER'),0)) as awaiting_reply,
     greatest(t.updated_at,coalesce((select max(m.created_at) from public.transport_chat_messages m where m.request_id=t.id),t.created_at)) as last_chat_activity,
     case when admin_actor or t.assigned_agent_user_id=actor_user_id then t.requester_name else null end as requester_name,
     case when admin_actor or t.assigned_agent_user_id=actor_user_id then t.phone else null end as phone,
     case when admin_actor or t.assigned_agent_user_id=actor_user_id then t.follow_up_note else null end as follow_up_note,
     case when admin_actor or t.assigned_agent_user_id=actor_user_id then (
       select coalesce(jsonb_agg(to_jsonb(e) order by e.version desc),'[]'::jsonb) from (
         select ev.id,ev.status,ev.note,ev.version,ev.created_at,ap.full_name as actor_name,bp.full_name as assigned_agent_name
         from public.transport_request_events ev left join public.profiles ap on ap.id=ev.actor_user_id
           left join public.profiles bp on bp.id=ev.assigned_agent_user_id
         where ev.request_id=t.id order by ev.version desc limit 10
       ) e
     ) else '[]'::jsonb end as activity
   from public.transport_service_requests t left join public.transport_chat_access ca on ca.request_id=t.id left join public.profiles p on p.id=t.assigned_agent_user_id
   where (requested_queue='ALL' or (requested_queue='MINE' and t.assigned_agent_user_id=actor_user_id)
     or (requested_queue='UNASSIGNED' and t.assigned_agent_user_id is null and t.status<>'CLOSED'))
     and (requested_view='ALL' or t.status=requested_view
       or (requested_view='ACTIVE' and t.status<>'CLOSED' and ca.request_id is not null and ca.ended_at is null and ca.expires_at>now())
       or (requested_view='FOLLOW_UP' and t.status<>'CLOSED' and (ca.request_id is null or ca.ended_at is not null or ca.expires_at<=now())))
   order by awaiting_reply desc,last_chat_activity desc,t.id desc offset (page_value-1)*15 limit 15
 ) r;
 if admin_actor then
   select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into agents from (
     select p.id,p.full_name as name from public.profiles p join public.support_agent_profiles s on s.user_id=p.id
     where p.active and p.role='SUPPORT' and s.active and s.can_manage_brokerage order by p.full_name,p.id limit 100
   ) a;
 end if;
 return jsonb_build_object('items',items,'total',total,'counts',counts,'queues',queues,'agents',coalesce(agents,'[]'::jsonb),
   'page',page_value,'pageCount',greatest(1,ceil(total/15.0)::integer));
end $$;
