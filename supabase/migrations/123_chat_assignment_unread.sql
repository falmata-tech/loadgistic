-- FEAT-NOT-001: a handoff retains team Seen history while the new agent reads anew.
-- 122 remains immutable; extend its cursor/alert functions without changing authority.
-- An older shared team receipt cannot prove what the current assignee saw; start their new counter at zero.
alter table public.support_chat_read_cursors add column agent_read_sequence bigint not null default 0 check(agent_read_sequence>=0);
alter table public.transport_chat_read_cursors add column agent_read_sequence bigint not null default 0 check(agent_read_sequence>=0);
create or replace function public.chat_read_state(chat_kind text,target_id uuid,actor_user_id uuid,access_digest text default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare customer_sequence bigint:=0;team_sequence bigint:=0;incoming bigint:=0;latest_sequence bigint:=0;
 assigned_id uuid;assignment_version bigint;customer_id uuid;own_side text;own_seen bigint:=0;joined boolean:=false;joined_time timestamptz;
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
  select case when own_side='CUSTOMER' then customer_sequence when actor_user_id=assigned_id then coalesce((select c.agent_read_sequence from public.support_chat_read_cursors c where c.conversation_id=target_id and c.participant='TEAM' and c.joined_by_user_id=assigned_id and c.joined_assignment_version=assignment_version),0) else team_sequence end into own_seen;
  select count(*) into incoming from public.support_messages m where m.conversation_id=target_id
  and (case when own_side='CUSTOMER' then m.sender_user_id<>customer_id else m.sender_user_id=customer_id end)
  and m.sequence>own_seen;
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
  select case when own_side='CUSTOMER' then customer_sequence when actor_user_id=assigned_id then coalesce((select c.agent_read_sequence from public.transport_chat_read_cursors c where c.request_id=target_id and c.participant='TEAM' and c.joined_by_user_id=assigned_id and c.joined_assignment_version=assignment_version),0) else team_sequence end into own_seen;
  select count(*) into incoming from public.transport_chat_messages m where m.request_id=target_id
  and m.sender_kind=case when own_side='CUSTOMER' then 'BROKER' else 'VISITOR' end
  and m.sequence>own_seen;
 end if;
 return jsonb_build_object('customerSeen',customer_sequence,'teamSeen',team_sequence,'ownSeen',own_seen,'latestSequence',latest_sequence,
  'ownSide',own_side,'unreadCount',incoming,'teamJoined',coalesce(joined,false),'joinedAt',joined_time,'assignmentVersion',assignment_version);
end $$;

create or replace function public.acknowledge_chat_read(chat_kind text,target_id uuid,actor_user_id uuid,access_digest text,through_sequence bigint)
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
  insert into public.support_chat_read_cursors(conversation_id,participant,through_sequence,reader_user_id,joined_by_user_id,joined_assignment_version,joined_at,agent_read_sequence)
  values(target_id,own_side,through_sequence,actor_user_id,case when joining then actor_user_id end,case when joining then assignment_version end,case when joining then clock_timestamp() end,case when joining then through_sequence else 0 end)
  on conflict(conversation_id,participant) do update set
   through_sequence=greatest(support_chat_read_cursors.through_sequence,excluded.through_sequence),seen_at=clock_timestamp(),reader_user_id=excluded.reader_user_id,
   agent_read_sequence=case when joining then case when support_chat_read_cursors.joined_assignment_version is distinct from assignment_version then excluded.through_sequence else greatest(support_chat_read_cursors.agent_read_sequence,excluded.through_sequence) end else support_chat_read_cursors.agent_read_sequence end,
   joined_by_user_id=case when joining then excluded.joined_by_user_id else support_chat_read_cursors.joined_by_user_id end,
   joined_assignment_version=case when joining then excluded.joined_assignment_version else support_chat_read_cursors.joined_assignment_version end,
   joined_at=case when joining and support_chat_read_cursors.joined_assignment_version is distinct from assignment_version then excluded.joined_at else support_chat_read_cursors.joined_at end
  where excluded.through_sequence>support_chat_read_cursors.through_sequence or joining and (support_chat_read_cursors.joined_assignment_version is distinct from assignment_version or excluded.through_sequence>support_chat_read_cursors.agent_read_sequence);
 else
  insert into public.transport_chat_read_cursors(request_id,participant,through_sequence,reader_user_id,joined_by_user_id,joined_assignment_version,joined_at,agent_read_sequence)
  values(target_id,own_side,through_sequence,actor_user_id,case when joining then actor_user_id end,case when joining then assignment_version end,case when joining then clock_timestamp() end,case when joining then through_sequence else 0 end)
  on conflict(request_id,participant) do update set
   through_sequence=greatest(transport_chat_read_cursors.through_sequence,excluded.through_sequence),seen_at=clock_timestamp(),reader_user_id=excluded.reader_user_id,
   agent_read_sequence=case when joining then case when transport_chat_read_cursors.joined_assignment_version is distinct from assignment_version then excluded.through_sequence else greatest(transport_chat_read_cursors.agent_read_sequence,excluded.through_sequence) end else transport_chat_read_cursors.agent_read_sequence end,
   joined_by_user_id=case when joining then excluded.joined_by_user_id else transport_chat_read_cursors.joined_by_user_id end,
   joined_assignment_version=case when joining then excluded.joined_assignment_version else transport_chat_read_cursors.joined_assignment_version end,
   joined_at=case when joining and transport_chat_read_cursors.joined_assignment_version is distinct from assignment_version then excluded.joined_at else transport_chat_read_cursors.joined_at end
  where excluded.through_sequence>transport_chat_read_cursors.through_sequence or joining and (transport_chat_read_cursors.joined_assignment_version is distinct from assignment_version or excluded.through_sequence>transport_chat_read_cursors.agent_read_sequence);
 end if;
 return public.chat_read_state(chat_kind,target_id,actor_user_id,access_digest);
end $$;
create or replace function public.chat_alert_snapshot(actor_user_id uuid,visitor_request_id uuid default null,access_digest text default null)
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
   coalesce(case when c.side='CUSTOMER' then case when c.kind='SUPPORT' then sr.through_sequence else tr.through_sequence end
    when c.kind='SUPPORT' and sj.joined_by_user_id=c.assigned_agent_user_id and sj.joined_assignment_version=c.chat_assignment_version then sj.agent_read_sequence
    when c.kind='BROKERAGE' and tj.joined_by_user_id=c.assigned_agent_user_id and tj.joined_assignment_version=c.chat_assignment_version then tj.agent_read_sequence
    else 0 end,0) as seen_sequence,
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

alter table public.platform_controls add column chat_assignment_unread boolean not null default true check(chat_assignment_unread);
notify pgrst,'reload schema';
