-- FEAT-TRQ-001: callback requests stay private, independent of chat/email.
create table public.transport_service_requests (
  id uuid primary key,
  requester_name text not null check (length(btrim(requester_name)) between 1 and 100),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  origin text not null check (length(btrim(origin)) between 1 and 160),
  destination text not null check (length(btrim(destination)) between 1 and 160),
  status text not null default 'NEW' check (status in ('NEW','CONTACTED','CLOSED')),
  follow_up_note text not null default '' check (length(follow_up_note)<=1000),
  version integer not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.transport_service_requests enable row level security;
revoke all on public.transport_service_requests from public,anon,authenticated;
grant all on public.transport_service_requests to service_role;
create index transport_requests_queue on public.transport_service_requests(status,created_at desc,id desc);
create index transport_requests_recent on public.transport_service_requests(created_at desc,id desc);

create function public.create_transport_service_request(request_id uuid,command jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.transport_service_requests%rowtype;
  name_value text:=btrim(command->>'name');phone_value text:=command->>'phone';
  origin_value text:=btrim(command->>'origin');destination_value text:=btrim(command->>'destination');
begin
  if request_id is null or name_value is null or length(name_value) not between 1 and 100
    or origin_value is null or length(origin_value) not between 1 and 160
    or destination_value is null or length(destination_value) not between 1 and 160
    or phone_value is null or phone_value !~ '^\+?[0-9]{7,15}$'
    or (name_value||origin_value||destination_value) ~ '[[:cntrl:]]'
  then raise exception 'INVALID_TRANSPORT_REQUEST';end if;
  insert into public.transport_service_requests(id,requester_name,phone,origin,destination)
    values(request_id,name_value,phone_value,origin_value,destination_value) on conflict(id) do nothing;
  if found then
    insert into public.audit_logs(action,entity_type,entity_id) values('transport_request_created','transport_service_request',request_id);
  else
    select * into strict saved from public.transport_service_requests where id=request_id;
    if (saved.requester_name,saved.phone,saved.origin,saved.destination) is distinct from (name_value,phone_value,origin_value,destination_value)
      then raise exception 'INVALID_TRANSPORT_REQUEST';end if;
  end if;
end $$;

create function public.transport_service_request_inbox(actor_user_id uuid,requested_view text default 'NEW',requested_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare items jsonb;total bigint;counts jsonb;page_value integer;
begin
  if not exists(select 1 from public.profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
  if requested_view is null or requested_view not in ('NEW','CONTACTED','CLOSED','ALL') then raise exception 'INVALID_TRANSPORT_VIEW';end if;
  select jsonb_build_object('NEW',count(*) filter(where status='NEW'),'CONTACTED',count(*) filter(where status='CONTACTED'),'CLOSED',count(*) filter(where status='CLOSED'),'ALL',count(*)) into counts from public.transport_service_requests;
  total:=(counts->>requested_view)::bigint;
  page_value:=greatest(1,least(coalesce(requested_page,1),greatest(1,ceil(total/15.0)::integer)));
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) into items from (
    select id,requester_name,phone,origin,destination,status,follow_up_note,version,created_at,updated_at
    from public.transport_service_requests where requested_view='ALL' or status=requested_view
    order by created_at desc,id desc offset (page_value-1)*15 limit 15
  ) r;
  return jsonb_build_object('items',items,'total',total,'counts',counts,'page',page_value,'pageCount',greatest(1,ceil(total/15.0)::integer));
end $$;

create function public.update_transport_service_request(actor_user_id uuid,request_id uuid,expected_version integer,next_status text,note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.transport_service_requests%rowtype;
begin
  if not exists(select 1 from public.profiles where id=actor_user_id and active and role='ADMIN') then raise exception 'FORBIDDEN';end if;
  if next_status is null or next_status not in ('NEW','CONTACTED','CLOSED') or note is null or length(note)>1000 or expected_version is null or expected_version<1 then raise exception 'INVALID_TRANSPORT_FOLLOW_UP';end if;
  select * into saved from public.transport_service_requests where id=request_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if saved.version<>expected_version then raise exception 'TRANSPORT_REQUEST_CHANGED';end if;
  if saved.status=next_status and saved.follow_up_note=btrim(note) then return;end if;
  update public.transport_service_requests set status=next_status,follow_up_note=btrim(note),version=version+1,updated_at=clock_timestamp() where id=request_id;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
    values(actor_user_id,'transport_request_updated','transport_service_request',request_id,jsonb_build_object('from',saved.status,'to',next_status));
end $$;
revoke all on function public.create_transport_service_request(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.transport_service_request_inbox(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.update_transport_service_request(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_transport_service_request(uuid,jsonb) to service_role;
grant execute on function public.transport_service_request_inbox(uuid,text,integer) to service_role;
grant execute on function public.update_transport_service_request(uuid,uuid,integer,text,text) to service_role;
