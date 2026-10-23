-- FEAT-NOT/SUP/TRQ: explicit visible-message receipts; fetches remain read-only.
-- Preserve IDs, text, timestamps, files and existing private authority.
alter table public.support_conversations add column last_message_sequence bigint not null default 0;
alter table public.support_conversations add column chat_assignment_version bigint not null default 0;
alter table public.transport_service_requests add column chat_assignment_version bigint not null default 0;
alter table public.support_messages add column sequence bigint;
with ordered as (
 select id,row_number()over(partition by conversation_id order by created_at,id) as sequence
 from public.support_messages
) update public.support_messages m set sequence=o.sequence from ordered o where o.id=m.id;
update public.support_conversations c set last_message_sequence=
 coalesce((select max(m.sequence) from public.support_messages m where m.conversation_id=c.id),0);
alter table public.support_messages alter column sequence set not null;
alter table public.support_messages add constraint support_message_positive_sequence check(sequence>0);
create unique index support_message_order on public.support_messages(conversation_id,sequence);

create function public.sequence_support_message() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 update public.support_conversations set last_message_sequence=last_message_sequence+1
 where id=new.conversation_id returning last_message_sequence into new.sequence;
 if not found then raise exception 'NOT_FOUND';end if;
 return new;
end $$;
create trigger sequence_support_message before insert on public.support_messages
 for each row execute function public.sequence_support_message();

create function public.advance_chat_assignment() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.chat_assignment_version:=old.chat_assignment_version+
  case when new.assigned_agent_user_id is distinct from old.assigned_agent_user_id then 1 else 0 end;
 return new;
end $$;
create trigger support_chat_assignment_version before update on public.support_conversations
 for each row execute function public.advance_chat_assignment();
create trigger brokerage_chat_assignment_version before update on public.transport_service_requests
 for each row execute function public.advance_chat_assignment();
revoke all on function public.sequence_support_message(),public.advance_chat_assignment() from public,anon,authenticated,service_role;

create table public.support_chat_read_cursors (
 conversation_id uuid not null references public.support_conversations(id) on delete cascade,
 participant text not null check(participant in ('CUSTOMER','TEAM')),
 through_sequence bigint not null default 0 check(through_sequence>=0),
 seen_at timestamptz not null default clock_timestamp(),
 reader_user_id uuid references public.profiles(id) on delete set null,
 joined_by_user_id uuid references public.profiles(id) on delete set null,
 joined_assignment_version bigint,
 joined_at timestamptz,
 primary key(conversation_id,participant)
);
create table public.transport_chat_read_cursors (
 request_id uuid not null references public.transport_service_requests(id) on delete cascade,
 participant text not null check(participant in ('CUSTOMER','TEAM')),
 through_sequence bigint not null default 0 check(through_sequence>=0),
 seen_at timestamptz not null default clock_timestamp(),
 reader_user_id uuid references public.profiles(id) on delete set null,
 joined_by_user_id uuid references public.profiles(id) on delete set null,
 joined_assignment_version bigint,
 joined_at timestamptz,
 primary key(request_id,participant)
);
alter table public.support_chat_read_cursors enable row level security;
alter table public.transport_chat_read_cursors enable row level security;
revoke all on public.support_chat_read_cursors,public.transport_chat_read_cursors from public,anon,authenticated;
grant all on public.support_chat_read_cursors,public.transport_chat_read_cursors to service_role;

create function public.chat_read_state(chat_kind text,target_id uuid,actor_user_id uuid,access_digest text default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare customer_sequence bigint:=0;team_sequence bigint:=0;incoming bigint:=0;latest_sequence bigint:=0;
 assigned_id uuid;assignment_version bigint;customer_id uuid;own_side text;joined boolean:=false;joined_time timestamptz;
begin
 if target_id is null or chat_kind is null or chat_kind not in ('SUPPORT','BROKERAGE') then raise exception 'FORBIDDEN';end if;
 if chat_kind='SUPPORT' then
  if actor_user_id is null or not public.support_actor_can_read(actor_user_id,target_id) then raise exception 'FORBIDDEN';end if;
  select c.customer_user_id,c.assigned_agent_user_id,c.chat_assignment_version,c.last_message_sequence
  into customer_id,assigned_id,assignment_version,latest_sequence from public.support_conversations c where c.id=target_id;
  own_side:=case when actor_user_id=customer_id then 'CUSTOMER' else 'TEAM' end;
  select coalesce(max(through_sequence)filter(where participant='CUSTOMER'),0),coalesce(max(through_sequence)filter(where participant='TEAM'),0)
  into customer_sequence,team_sequence from public.support_chat_read_cursors where conversation_id=target_id;
  select true,joined_at into joined,joined_time from public.support_chat_read_cursors
  where conversation_id=target_id and participant='TEAM' and joined_by_user_id=assigned_id and joined_assignment_version=assignment_version;
  select count(*) into incoming from public.support_messages m where m.conversation_id=target_id
  and (case when own_side='CUSTOMER' then m.sender_user_id<>customer_id else m.sender_user_id=customer_id end)
  and m.sequence>case when own_side='CUSTOMER' then customer_sequence else team_sequence end;
 else
  if not public.can_access_transport_chat(target_id,access_digest,actor_user_id) then raise exception 'FORBIDDEN';end if;
  own_side:=case when actor_user_id is null then 'CUSTOMER' else 'TEAM' end;
  select r.assigned_agent_user_id,r.chat_assignment_version into assigned_id,assignment_version
  from public.transport_service_requests r where r.id=target_id;
  select coalesce(max(sequence),0) into latest_sequence from public.transport_chat_messages where request_id=target_id;
  select coalesce(max(through_sequence)filter(where participant='CUSTOMER'),0),coalesce(max(through_sequence)filter(where participant='TEAM'),0)
  into customer_sequence,team_sequence from public.transport_chat_read_cursors where request_id=target_id;
  select true,joined_at into joined,joined_time from public.transport_chat_read_cursors
  where request_id=target_id and participant='TEAM' and joined_by_user_id=assigned_id and joined_assignment_version=assignment_version;
  select count(*) into incoming from public.transport_chat_messages m where m.request_id=target_id
  and m.sender_kind=case when own_side='CUSTOMER' then 'BROKER' else 'VISITOR' end
  and m.sequence>case when own_side='CUSTOMER' then customer_sequence else team_sequence end;
 end if;
 return jsonb_build_object('customerSeen',customer_sequence,'teamSeen',team_sequence,'latestSequence',latest_sequence,
  'ownSide',own_side,'unreadCount',incoming,'teamJoined',coalesce(joined,false),'joinedAt',joined_time,'assignmentVersion',assignment_version);
end $$;

create function public.acknowledge_chat_read(chat_kind text,target_id uuid,actor_user_id uuid,access_digest text,through_sequence bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare customer_id uuid;assigned_id uuid;assignment_version bigint;own_side text;joining boolean;state jsonb;
begin
 if through_sequence is null or through_sequence<0 or through_sequence>9007199254740991 then raise exception 'INVALID_CHAT_READ';end if;
 -- Lock current actor/capability before the conversation, matching existing commands.
 if actor_user_id is not null then
  perform 1 from public.profiles where id=actor_user_id and active for share;
  if not found then raise exception 'FORBIDDEN';end if;
  if exists(select 1 from public.profiles where id=actor_user_id and role='SUPPORT') then
   perform 1 from public.support_agent_profiles where user_id=actor_user_id for share;
  end if;
 end if;
 if chat_kind='SUPPORT' then
  select c.customer_user_id,c.assigned_agent_user_id,c.chat_assignment_version into customer_id,assigned_id,assignment_version
  from public.support_conversations c where c.id=target_id for update;
  if not found then raise exception 'FORBIDDEN';end if;
 elsif chat_kind='BROKERAGE' then
  select r.assigned_agent_user_id,r.chat_assignment_version into assigned_id,assignment_version
  from public.transport_service_requests r where r.id=target_id for update;
  if not found then raise exception 'FORBIDDEN';end if;
 else raise exception 'FORBIDDEN';end if;
 state:=public.chat_read_state(chat_kind,target_id,actor_user_id,access_digest);
 own_side:=state->>'ownSide';joining:=own_side='TEAM' and actor_user_id=assigned_id;
 if through_sequence>0 and not (
  case when chat_kind='SUPPORT' then exists(select 1 from public.support_messages where conversation_id=target_id and sequence=through_sequence)
  else exists(select 1 from public.transport_chat_messages where request_id=target_id and sequence=through_sequence) end
 ) then raise exception 'INVALID_CHAT_READ';end if;
 if chat_kind='SUPPORT' then
  insert into public.support_chat_read_cursors(conversation_id,participant,through_sequence,reader_user_id,joined_by_user_id,joined_assignment_version,joined_at)
  values(target_id,own_side,through_sequence,actor_user_id,case when joining then actor_user_id end,case when joining then assignment_version end,case when joining then clock_timestamp() end)
  on conflict(conversation_id,participant) do update set
   through_sequence=greatest(support_chat_read_cursors.through_sequence,excluded.through_sequence),seen_at=clock_timestamp(),reader_user_id=excluded.reader_user_id,
   joined_by_user_id=case when joining then excluded.joined_by_user_id else support_chat_read_cursors.joined_by_user_id end,
   joined_assignment_version=case when joining then excluded.joined_assignment_version else support_chat_read_cursors.joined_assignment_version end,
   joined_at=case when joining and support_chat_read_cursors.joined_assignment_version is distinct from assignment_version then excluded.joined_at else support_chat_read_cursors.joined_at end
  where excluded.through_sequence>support_chat_read_cursors.through_sequence or joining and support_chat_read_cursors.joined_assignment_version is distinct from assignment_version;
 else
  insert into public.transport_chat_read_cursors(request_id,participant,through_sequence,reader_user_id,joined_by_user_id,joined_assignment_version,joined_at)
  values(target_id,own_side,through_sequence,actor_user_id,case when joining then actor_user_id end,case when joining then assignment_version end,case when joining then clock_timestamp() end)
  on conflict(request_id,participant) do update set
   through_sequence=greatest(transport_chat_read_cursors.through_sequence,excluded.through_sequence),seen_at=clock_timestamp(),reader_user_id=excluded.reader_user_id,
   joined_by_user_id=case when joining then excluded.joined_by_user_id else transport_chat_read_cursors.joined_by_user_id end,
   joined_assignment_version=case when joining then excluded.joined_assignment_version else transport_chat_read_cursors.joined_assignment_version end,
   joined_at=case when joining and transport_chat_read_cursors.joined_assignment_version is distinct from assignment_version then excluded.joined_at else transport_chat_read_cursors.joined_at end
  where excluded.through_sequence>transport_chat_read_cursors.through_sequence or joining and transport_chat_read_cursors.joined_assignment_version is distinct from assignment_version;
 end if;
 return public.chat_read_state(chat_kind,target_id,actor_user_id,access_digest);
end $$;
revoke all on function public.chat_read_state(text,uuid,uuid,text),public.acknowledge_chat_read(text,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.chat_read_state(text,uuid,uuid,text),public.acknowledge_chat_read(text,uuid,uuid,text,bigint) to service_role;

create index transport_chat_incoming on public.transport_chat_messages(request_id,sender_kind,sequence);
create function public.chat_alert_snapshot(actor_user_id uuid,visitor_request_id uuid default null,access_digest text default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor public.profiles%rowtype;support_allowed boolean:=false;brokerage_allowed boolean:=false;member_actor boolean:=false;result jsonb;
begin
 if visitor_request_id is not null then
  if actor_user_id is not null or not public.can_access_transport_chat(visitor_request_id,access_digest,null) then raise exception 'FORBIDDEN';end if;
 else
  select * into actor from public.profiles where id=actor_user_id and active;
  if not found then raise exception 'FORBIDDEN';end if;
  support_allowed:=public.managed_actor_has_permission(actor_user_id,'SUPPORT');
  brokerage_allowed:=public.can_manage_brokerage(actor_user_id);
  member_actor:=actor.role in ('DRIVER','TRANSPORTER');
  if not member_actor and not support_allowed and not brokerage_allowed then raise exception 'FORBIDDEN';end if;
 end if;
 with candidates as (
  select 'SUPPORT'::text as kind,c.id,c.status,c.assigned_agent_user_id,c.chat_assignment_version,c.created_at,c.updated_at,
   null::timestamptz as ended_at,c.customer_user_id,
   case when member_actor then 'CUSTOMER' else 'TEAM' end as side,
   not member_actor and c.assigned_agent_user_id is null as queued,
   true as chat_enabled
  from public.support_conversations c
  where visitor_request_id is null and
   (member_actor and c.customer_user_id=actor_user_id or support_allowed and (c.assigned_agent_user_id=actor_user_id or c.status='WAITING' and c.assigned_agent_user_id is null))
   and (c.status<>'CLOSED' or c.updated_at>now()-interval '7 days')
  union all
  select 'BROKERAGE',r.id,r.status,r.assigned_agent_user_id,r.chat_assignment_version,r.created_at,r.updated_at,a.ended_at,null::uuid,
   case when visitor_request_id is not null then 'CUSTOMER' else 'TEAM' end,
   visitor_request_id is null and r.assigned_agent_user_id is null,a.request_id is not null
  from public.transport_service_requests r left join public.transport_chat_access a on a.request_id=r.id
  where (visitor_request_id is not null and r.id=visitor_request_id or visitor_request_id is null and brokerage_allowed
    and (r.assigned_agent_user_id=actor_user_id or r.assigned_agent_user_id is null and r.status<>'CLOSED'))
   and (r.status<>'CLOSED' or r.updated_at>now()-interval '7 days')
 ), cursors as (
  select c.*,p.full_name as assigned_name,
   coalesce(case when kind='SUPPORT' then sr.through_sequence else tr.through_sequence end,0) as seen_sequence,
   case when kind='SUPPORT' then sj.joined_assignment_version=c.chat_assignment_version and sj.joined_by_user_id=c.assigned_agent_user_id
   else tj.joined_assignment_version=c.chat_assignment_version and tj.joined_by_user_id=c.assigned_agent_user_id end as team_joined
  from candidates c left join public.profiles p on p.id=c.assigned_agent_user_id
  left join public.support_chat_read_cursors sr on c.kind='SUPPORT' and sr.conversation_id=c.id and sr.participant=c.side
  left join public.support_chat_read_cursors sj on c.kind='SUPPORT' and sj.conversation_id=c.id and sj.participant='TEAM'
  left join public.transport_chat_read_cursors tr on c.kind='BROKERAGE' and tr.request_id=c.id and tr.participant=c.side
  left join public.transport_chat_read_cursors tj on c.kind='BROKERAGE' and tj.request_id=c.id and tj.participant='TEAM'
 ), counted as (
  select c.*,
   case when c.queued then 0 when c.kind='SUPPORT' then
    (select count(*) from public.support_messages m where m.conversation_id=c.id and m.sequence>c.seen_sequence
      and (case when c.side='CUSTOMER' then m.sender_user_id<>c.customer_user_id else m.sender_user_id=c.customer_user_id end))
   else (select count(*) from public.transport_chat_messages m where m.request_id=c.id and m.sequence>c.seen_sequence
     and m.sender_kind=case when c.side='CUSTOMER' then 'BROKER' else 'VISITOR' end) end as unread_count,
   case when c.queued then 0 when c.kind='SUPPORT' then
    (select coalesce(max(m.sequence),0) from public.support_messages m where m.conversation_id=c.id
      and (case when c.side='CUSTOMER' then m.sender_user_id<>c.customer_user_id else m.sender_user_id=c.customer_user_id end))
   else (select coalesce(max(m.sequence),0) from public.transport_chat_messages m where m.request_id=c.id
     and m.sender_kind=case when c.side='CUSTOMER' then 'BROKER' else 'VISITOR' end) end as incoming_sequence
  from cursors c
 ), page as (
  select * from counted order by queued desc,(unread_count>0) desc,updated_at desc,id limit 40
 ) select jsonb_build_object(
  'unreadCount',(select coalesce(sum(unread_count),0) from counted where status<>'CLOSED'),
  'waitingCount',(select count(*) from counted where queued and status<>'CLOSED'),
  'items',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'status',status,'side',side,'queued',queued,
    'assigned',assigned_agent_user_id is not null,'assignedName',assigned_name,'assignmentVersion',chat_assignment_version,
    'teamJoined',coalesce(team_joined,false),'unreadCount',unread_count,'incomingSequence',incoming_sequence,
    'endedAt',ended_at,'chatEnabled',chat_enabled,'updatedAt',updated_at) order by queued desc,(unread_count>0) desc,updated_at desc,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.chat_alert_snapshot(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.chat_alert_snapshot(uuid,uuid,text) to service_role;

-- Keep existing chronological history, IDs, attachment joins and permissions.
do $patch$
declare signature text;definition text;anchor text:='select message.id,message.conversation_id,';
begin
 foreach signature in array array['public.managed_support_conversation(uuid,uuid,integer,boolean)','public.managed_support_history(uuid,uuid,uuid,integer)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'CHAT_MESSAGE_PROJECTION_DRIFT';end if;
  definition:=replace(definition,anchor,'select message.id,message.sequence,message.conversation_id,');
  definition:=replace(definition,'order by row.created_at,row.id','order by row.sequence');
  definition:=replace(definition,'order by message.created_at desc,message.id desc','order by message.sequence desc');
  if signature like '%managed_support_history%' then
   if strpos(definition,'(message.created_at,message.id)<(cursor_time,requested_before)')=0 then raise exception 'CHAT_HISTORY_CURSOR_DRIFT';end if;
   definition:=replace(definition,'cursor_time timestamptz','cursor_sequence bigint');
   definition:=replace(definition,'select message.created_at into cursor_time','select message.sequence into cursor_sequence');
   definition:=replace(definition,'(message.created_at,message.id)<(cursor_time,requested_before)','message.sequence<cursor_sequence');
  end if;
  execute definition;
 end loop;
 definition:=pg_get_functiondef('public.support_conversation_summary(uuid)'::regprocedure);
 anchor:='order by message.created_at desc,message.id desc';
 if strpos(definition,anchor)=0 then raise exception 'CHAT_SUPPORT_SUMMARY_DRIFT';end if;
 execute replace(definition,anchor,'order by message.sequence desc');
 definition:=pg_get_functiondef('public.support_conversation_revision(uuid,uuid,boolean,text,boolean)'::regprocedure);
 anchor:='from support_messages where conversation_id=target_id order by created_at desc,id desc';
 if strpos(definition,anchor)=0 then raise exception 'CHAT_SUPPORT_REVISION_DRIFT';end if;
 execute replace(definition,anchor,'from support_messages where conversation_id=target_id order by sequence desc');
end $patch$;
alter table public.platform_controls add column chat_visible_read_receipts boolean not null default true check(chat_visible_read_receipts);
notify pgrst,'reload schema';
