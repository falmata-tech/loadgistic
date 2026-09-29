-- FEAT-TRQ-001: independent brokerage authority, record ownership and private history.
alter table public.support_agent_profiles add column can_manage_brokerage boolean not null default false;
alter table public.transport_service_requests
  add column assigned_agent_user_id uuid references public.profiles(id),
  add column last_changed_by uuid references public.profiles(id);
create index transport_requests_assignee on public.transport_service_requests(assigned_agent_user_id,status,created_at desc,id desc);
create table public.transport_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.transport_service_requests(id),
  actor_user_id uuid references public.profiles(id),
  assigned_agent_user_id uuid references public.profiles(id),
  status text not null,
  note text not null,
  version integer not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.transport_request_events enable row level security;
revoke all on public.transport_request_events from public,anon,authenticated;
grant all on public.transport_request_events to service_role;
create index transport_request_events_history on public.transport_request_events(request_id,version desc);
insert into public.transport_request_events(request_id,status,note,version)
 select id,status,follow_up_note,version from public.transport_service_requests;

create function public.record_transport_request_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.transport_request_events(request_id,actor_user_id,assigned_agent_user_id,status,note,version)
 values(new.id,new.last_changed_by,new.assigned_agent_user_id,new.status,new.follow_up_note,new.version);
 return new;
end $$;
create trigger transport_request_event after insert or update on public.transport_service_requests
 for each row execute function public.record_transport_request_event();

create function public.release_disabled_brokerage_assignments() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_id uuid;
begin
 if tg_table_name='profiles' then
   if new.active then return new;end if;target_id:=new.id;
 else
   if new.active and new.can_manage_brokerage then return new;end if;target_id:=new.user_id;
 end if;
 update public.transport_service_requests set assigned_agent_user_id=null,last_changed_by=null,
   version=version+1,updated_at=clock_timestamp()
 where assigned_agent_user_id=target_id and status<>'CLOSED';
 return new;
end $$;
create trigger brokerage_permission_revoked after update of active,can_manage_brokerage on public.support_agent_profiles
 for each row execute function public.release_disabled_brokerage_assignments();
create trigger brokerage_account_suspended after update of active on public.profiles
 for each row execute function public.release_disabled_brokerage_assignments();

create function public.can_manage_brokerage(actor_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p left join public.support_agent_profiles a on a.user_id=p.id
 where p.id=actor_user_id and p.active and (p.role='ADMIN' or (p.role='SUPPORT' and a.active and a.can_manage_brokerage)))
$$;

-- Lock current authority before request mutation; suspension/revocation waits for it.
create function public.lock_brokerage_actor(actor_user_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.profiles%rowtype;agent public.support_agent_profiles%rowtype;
begin
 select * into actor from public.profiles where id=actor_user_id for share;
 if not found or not actor.active then raise exception 'FORBIDDEN';end if;
 if actor.role='ADMIN' then return true;end if;
 select * into agent from public.support_agent_profiles where user_id=actor_user_id for share;
 if actor.role<>'SUPPORT' or not found or not agent.active or not agent.can_manage_brokerage then raise exception 'FORBIDDEN';end if;
 return false;
end $$;

create function public.brokerage_request_inbox(actor_user_id uuid,requested_queue text default 'MINE',requested_view text default 'ALL',requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare admin_actor boolean;items jsonb;counts jsonb;queues jsonb;total bigint;page_value integer;agents jsonb;
begin
 if not public.can_manage_brokerage(actor_user_id) then raise exception 'FORBIDDEN';end if;
 select role='ADMIN' into admin_actor from public.profiles where id=actor_user_id;
 if requested_queue is null or requested_queue not in ('MINE','UNASSIGNED','ALL') or (requested_queue='ALL' and not admin_actor)
   or requested_view is null or requested_view not in ('NEW','CONTACTED','CLOSED','ALL') then raise exception 'INVALID_TRANSPORT_VIEW';end if;
 select jsonb_build_object('MINE',count(*) filter(where assigned_agent_user_id=actor_user_id),
   'UNASSIGNED',count(*) filter(where assigned_agent_user_id is null and status<>'CLOSED'),
   'ALL',case when admin_actor then count(*) else 0 end) into queues
 from public.transport_service_requests where admin_actor or assigned_agent_user_id=actor_user_id or assigned_agent_user_id is null;
 select jsonb_build_object('NEW',count(*) filter(where status='NEW'),'CONTACTED',count(*) filter(where status='CONTACTED'),
   'CLOSED',count(*) filter(where status='CLOSED'),'ALL',count(*)) into counts from public.transport_service_requests
 where requested_queue='ALL' or (requested_queue='MINE' and assigned_agent_user_id=actor_user_id)
   or (requested_queue='UNASSIGNED' and assigned_agent_user_id is null and status<>'CLOSED');
 total:=(counts->>requested_view)::bigint;
 page_value:=greatest(1,least(coalesce(requested_page,1),greatest(1,ceil(total/15.0)::integer)));
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) into items from (
   select t.id,t.origin,t.destination,t.status,t.version,t.created_at,t.updated_at,t.assigned_agent_user_id,
     p.full_name as assigned_agent_name,
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
   from public.transport_service_requests t left join public.profiles p on p.id=t.assigned_agent_user_id
   where (requested_queue='ALL' or (requested_queue='MINE' and t.assigned_agent_user_id=actor_user_id)
     or (requested_queue='UNASSIGNED' and t.assigned_agent_user_id is null and t.status<>'CLOSED'))
     and (requested_view='ALL' or t.status=requested_view)
   order by t.created_at desc,t.id desc offset (page_value-1)*15 limit 15
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

create function public.assign_transport_service_request(actor_user_id uuid,request_id uuid,expected_version integer,target_user_id uuid default null,claim boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare admin_actor boolean;target_id uuid;target_admin boolean;saved public.transport_service_requests%rowtype;
begin
 admin_actor:=public.lock_brokerage_actor(actor_user_id);
 if claim is null or (not admin_actor and (not claim or target_user_id is not null)) then raise exception 'FORBIDDEN';end if;
 target_id:=case when claim then actor_user_id else target_user_id end;
 if target_id is not null and target_id<>actor_user_id then
   target_admin:=public.lock_brokerage_actor(target_id);
   if target_admin then raise exception 'INVALID_BROKERAGE_ASSIGNEE';end if;
 end if;
 select * into saved from public.transport_service_requests where id=request_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if expected_version is null or saved.version<>expected_version then raise exception 'TRANSPORT_REQUEST_CHANGED';end if;
 if claim and (saved.assigned_agent_user_id is not null or saved.status='CLOSED') then raise exception 'TRANSPORT_REQUEST_CHANGED';end if;
 if not admin_actor and saved.assigned_agent_user_id is not null then raise exception 'FORBIDDEN';end if;
 if saved.assigned_agent_user_id is not distinct from target_id then return;end if;
 update public.transport_service_requests set assigned_agent_user_id=target_id,last_changed_by=actor_user_id,
   version=version+1,updated_at=clock_timestamp() where id=request_id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'transport_request_assigned','transport_service_request',request_id,jsonb_build_object('assignee',target_id));
end $$;

create or replace function public.update_transport_service_request(actor_user_id uuid,request_id uuid,expected_version integer,next_status text,note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare admin_actor boolean;saved public.transport_service_requests%rowtype;
begin
 admin_actor:=public.lock_brokerage_actor(actor_user_id);
 if next_status is null or next_status not in ('NEW','CONTACTED','CLOSED') or note is null or length(note)>1000 or expected_version is null or expected_version<1 then raise exception 'INVALID_TRANSPORT_FOLLOW_UP';end if;
 select * into saved from public.transport_service_requests where id=request_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not admin_actor and saved.assigned_agent_user_id is distinct from actor_user_id then raise exception 'FORBIDDEN';end if;
 if saved.version<>expected_version then raise exception 'TRANSPORT_REQUEST_CHANGED';end if;
 if not admin_actor and saved.status='CLOSED' and next_status<>'CLOSED' then raise exception 'FORBIDDEN';end if;
 if saved.status=next_status and saved.follow_up_note=btrim(note) then return;end if;
 update public.transport_service_requests set status=next_status,follow_up_note=btrim(note),last_changed_by=actor_user_id,
   assigned_agent_user_id=case when next_status<>'CLOSED' and saved.assigned_agent_user_id is not null
     and not public.can_manage_brokerage(saved.assigned_agent_user_id) then null else saved.assigned_agent_user_id end,
   version=version+1,updated_at=clock_timestamp() where id=request_id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'transport_request_updated','transport_service_request',request_id,jsonb_build_object('from',saved.status,'to',next_status));
end $$;

-- Exact, asserted edits preserve later fixes to identity/team commands and their ACLs.
do $patch$
declare definition text;before_text text;after_text text;signature text;
begin
 for signature,before_text,after_text in select * from (values
 ('public.current_user_projection()',
  '''can_manage_support'',coalesce(support_agent.can_manage_support,false),',
  '''can_manage_support'',coalesce(support_agent.can_manage_support,false),''can_manage_brokerage'',coalesce(support_agent.can_manage_brokerage,false),'),
 ('public.managed_support_agent_page(uuid,integer,integer)',
  '''can_manage_support'',row.can_manage_support,',
  '''can_manage_support'',row.can_manage_support,''can_manage_brokerage'',row.can_manage_brokerage,'),
 ('public.create_managed_support_agent(uuid,uuid,jsonb)',
  'can_manage_billing,can_manage_support,created_at,updated_at)',
  'can_manage_billing,can_manage_support,can_manage_brokerage,created_at,updated_at)'),
 ('public.create_managed_support_agent(uuid,uuid,jsonb)',
  'coalesce((command->>''can_manage_support'')::boolean,true),now(),now());',
  'coalesce((command->>''can_manage_support'')::boolean,true),coalesce((command->>''can_manage_brokerage'')::boolean,false),now(),now());'),
 ('public.update_managed_support_agent(uuid,uuid,jsonb)',
  'can_manage_support=support_value,updated_at=now()',
  'can_manage_support=support_value,can_manage_brokerage=coalesce((command->>''can_manage_brokerage'')::boolean,false),updated_at=now()'),
 ('public.create_managed_support_agent(uuid,uuid,jsonb)',
  '''support'',coalesce((command->>''can_manage_support'')::boolean,true))),now());',
  '''support'',coalesce((command->>''can_manage_support'')::boolean,true),''brokerage'',coalesce((command->>''can_manage_brokerage'')::boolean,false))),now());'),
 ('public.update_managed_support_agent(uuid,uuid,jsonb)',
  '''requeuedGuest'',requeued_guest),now());',
  '''requeuedGuest'',requeued_guest,''brokerage'',coalesce((command->>''can_manage_brokerage'')::boolean,false)),now());')
,
 ('public.managed_guest_support_inbox(uuid,text,integer,integer)',
  '''last_message_preview'',row.last_message_preview)',
  '''last_message_preview'',row.last_message_preview,''can_claim'',actor.role::text=''SUPPORT'' and row.status=''WAITING''
      and row.id=(select next.id from public.guest_support_conversations next where next.status=''WAITING'' and next.assigned_agent_user_id is null order by next.created_at,next.id limit 1)
      and exists(select 1 from public.support_agent_profiles staff where staff.user_id=actor.id and staff.active and staff.available and staff.can_manage_support
        and (select count(*) from public.support_conversations c where c.assigned_agent_user_id=actor.id and c.status=''OPEN'')+
          (select count(*) from public.guest_support_conversations c where c.assigned_agent_user_id=actor.id and c.status=''OPEN'')<staff.max_open_conversations))')
 ) patches(signature,before_text,after_text) loop
   definition:=pg_get_functiondef(signature::regprocedure);
   if strpos(definition,before_text)=0 or strpos(substr(definition,strpos(definition,before_text)+length(before_text)),before_text)>0 then
     raise exception 'BROKERAGE_PATCH_PRECONDITION: %',signature;
   end if;
   execute replace(definition,before_text,after_text);
 end loop;
end $patch$;

revoke all on function public.record_transport_request_event() from public,anon,authenticated;
revoke all on function public.release_disabled_brokerage_assignments() from public,anon,authenticated;
revoke all on function public.can_manage_brokerage(uuid) from public,anon,authenticated;
revoke all on function public.lock_brokerage_actor(uuid) from public,anon,authenticated;
revoke all on function public.brokerage_request_inbox(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.assign_transport_service_request(uuid,uuid,integer,uuid,boolean) from public,anon,authenticated;
revoke all on function public.update_transport_service_request(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.can_manage_brokerage(uuid),public.lock_brokerage_actor(uuid),public.brokerage_request_inbox(uuid,text,text,integer),public.assign_transport_service_request(uuid,uuid,integer,uuid,boolean),public.update_transport_service_request(uuid,uuid,integer,text,text) to service_role;

-- General-help admin assignment complements existing automatic assignment/claiming.
create function public.assign_guest_support_agent(actor_user_id uuid,conversation_id uuid,expected_assignee uuid,target_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.guest_support_conversations%rowtype;agent public.support_agent_profiles%rowtype;open_count bigint;
begin
 perform 1 from public.profiles where id=actor_user_id and active and role='ADMIN' for share;
 if not found then raise exception 'FORBIDDEN';end if;
 if target_user_id is not null then
   perform 1 from public.profiles where id=target_user_id and active and role='SUPPORT' for share;
   if not found then raise exception 'SUPPORT_AGENT_UNAVAILABLE';end if;
   select * into agent from public.support_agent_profiles where user_id=target_user_id for update;
   if not found or not agent.active or not agent.available or not agent.can_manage_support then raise exception 'SUPPORT_AGENT_UNAVAILABLE';end if;
 end if;
 select * into saved from public.guest_support_conversations where id=conversation_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if saved.status='CLOSED' then raise exception 'SUPPORT_CONVERSATION_CLOSED';end if;
 if saved.assigned_agent_user_id is distinct from expected_assignee then raise exception 'TRANSPORT_REQUEST_CHANGED';end if;
 if saved.assigned_agent_user_id is not distinct from target_user_id then return;end if;
 if target_user_id is not null then
   select (select count(*) from public.support_conversations where assigned_agent_user_id=target_user_id and status='OPEN')+
     (select count(*) from public.guest_support_conversations where assigned_agent_user_id=target_user_id and status='OPEN') into open_count;
   if open_count>=agent.max_open_conversations then raise exception 'SUPPORT_AGENT_AT_CAPACITY';end if;
 end if;
 update public.guest_support_conversations set assigned_agent_user_id=target_user_id,
   status=case when target_user_id is null then 'WAITING' else 'OPEN' end,
   assigned_at=case when target_user_id is null then null else clock_timestamp() end,
   agent_last_read_at=null,updated_at=clock_timestamp() where id=conversation_id;
 if target_user_id is not null then update public.support_agent_profiles set last_assigned_at=clock_timestamp() where user_id=target_user_id;end if;
 insert into public.guest_support_events(conversation_id,actor_user_id,event_type,details)
 values(conversation_id,actor_user_id,'REASSIGNED',jsonb_build_object('previousAgent',saved.assigned_agent_user_id,'assignedAgent',target_user_id));
end $$;
revoke all on function public.assign_guest_support_agent(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.assign_guest_support_agent(uuid,uuid,uuid,uuid) to service_role;
