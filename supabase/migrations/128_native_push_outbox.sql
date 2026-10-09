-- FEAT-NOT-001 / ADR-078: service-only notification intent, not chat authority.
create table public.native_push_installations (
 id uuid primary key,
 secret_digest text not null check(secret_digest ~ '^[a-f0-9]{64}$'),
 expo_token text not null unique check(expo_token ~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,160}\]$'),
 locale text not null check(locale in ('en','am','om','so','ti')),
 enabled boolean not null default true,
 updated_at timestamptz not null default clock_timestamp()
);
create table public.native_push_bindings (
 id uuid primary key default gen_random_uuid(),
 installation_id uuid not null references public.native_push_installations(id) on delete cascade,
 audience text not null check(audience in ('MEMBER','GUEST')),
 actor_user_id uuid references public.profiles(id) on delete cascade,
 auth_session_id uuid,
 request_id uuid references public.transport_service_requests(id) on delete cascade,
 access_digest text,
 expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(installation_id,audience),
 check((audience='MEMBER' and actor_user_id is not null and auth_session_id is not null and request_id is null and access_digest is null)
 or (audience='GUEST' and actor_user_id is null and auth_session_id is null and request_id is not null and access_digest ~ '^[a-f0-9]{64}$'))
);
create index native_push_member_scope on public.native_push_bindings(actor_user_id) where audience='MEMBER';
create index native_push_guest_scope on public.native_push_bindings(request_id) where audience='GUEST';
create table public.native_push_outbox (
 id uuid primary key default gen_random_uuid(),
 binding_id uuid not null references public.native_push_bindings(id) on delete cascade,
 kind text not null check(kind in ('SUPPORT','BROKERAGE','HANDOVER')),
 source_id uuid not null,
 event text not null check(event in ('MESSAGE','ASSIGNED','JOINED','ENDED','RESOLVED','APPROVED')),
 sequence bigint not null default 0 check(sequence>=0),
 assignment_version bigint not null default 0 check(assignment_version>=0),
 approved_at timestamptz,
 event_key text not null,
 state text not null default 'PENDING' check(state in ('PENDING','SENDING','SUBMITTED','CHECKING','DELIVERED','CANCELLED','FAILED')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 receipt_attempts integer not null default 0 check(receipt_attempts between 0 and 8),
 next_attempt_at timestamptz not null default clock_timestamp(),
 lease_id uuid,
 leased_until timestamptz,
 ticket_id text,
 token_digest text,
 outcome_code text,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '1 day'),
 unique(binding_id,event_key)
);
create index native_push_due on public.native_push_outbox(next_attempt_at) where state in ('PENDING','SENDING','SUBMITTED','CHECKING');
alter table public.native_push_installations enable row level security;
alter table public.native_push_bindings enable row level security;
alter table public.native_push_outbox enable row level security;
revoke all on public.native_push_installations,public.native_push_bindings,public.native_push_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.native_push_installations,public.native_push_bindings,public.native_push_outbox to service_role;

create function public.native_push_binding_active(binding uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.native_push_bindings b join public.native_push_installations i on i.id=b.installation_id
 where b.id=binding and i.enabled and b.expires_at>now() and
 ((b.audience='MEMBER' and exists(select 1 from public.profiles p join auth.sessions s on s.user_id=p.id
   where p.id=b.actor_user_id and p.active and p.role in ('DRIVER','TRANSPORTER') and s.id=b.auth_session_id and (s.not_after is null or s.not_after>now())))
 or (b.audience='GUEST' and public.can_access_transport_chat(b.request_id,b.access_digest,null))))
$$;

create function public.register_native_push_binding(installation_id uuid,installation_digest text,push_token text,preferred_locale text,
 actor_user_id uuid,session_id uuid,visitor_request_id uuid,visitor_digest text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.native_push_installations%rowtype; previous public.native_push_bindings%rowtype;
 audience_value text; expiry timestamptz;
begin
 if installation_id is null or installation_digest is null or installation_digest !~ '^[a-f0-9]{64}$'
 or push_token is null or push_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,160}\]$'
 or preferred_locale is null or preferred_locale not in ('en','am','om','so','ti') then raise exception 'INVALID_PUSH_INPUT';end if;
 if actor_user_id is not null then
  if visitor_request_id is not null or visitor_digest is not null or session_id is null or not exists(
   select 1 from public.profiles p join auth.sessions s on s.user_id=p.id where p.id=actor_user_id and p.active
   and p.role in ('DRIVER','TRANSPORTER') and s.id=session_id and (s.not_after is null or s.not_after>now())) then raise exception 'FORBIDDEN';end if;
  audience_value:='MEMBER';expiry:=now()+interval '30 days';
 else
  if session_id is not null or visitor_request_id is null or not public.can_access_transport_chat(visitor_request_id,visitor_digest,null) then raise exception 'FORBIDDEN';end if;
  audience_value:='GUEST';select expires_at into expiry from public.transport_chat_access where request_id=visitor_request_id;
 end if;
 -- Serialize installation/token moves. Token possession is private device authority;
 -- an obsolete installation loses all bindings and outbox records atomically.
 perform pg_advisory_xact_lock(hashtextextended('native-push-registration',0));
 select * into existing from public.native_push_installations where id=installation_id for update;
 if found and existing.secret_digest is distinct from installation_digest then raise exception 'FORBIDDEN';end if;
 if (select count(*) from public.native_push_bindings b where b.expires_at>now() and b.installation_id<>register_native_push_binding.installation_id
 and ((audience_value='MEMBER' and b.actor_user_id=register_native_push_binding.actor_user_id)
 or (audience_value='GUEST' and b.request_id=visitor_request_id)))>=10 then raise exception 'PUSH_DEVICE_LIMIT';end if;
 delete from public.native_push_installations i where i.expo_token=push_token and i.id<>installation_id;
 insert into public.native_push_installations(id,secret_digest,expo_token,locale) values(installation_id,installation_digest,push_token,preferred_locale)
 on conflict(id) do update set expo_token=excluded.expo_token,locale=excluded.locale,enabled=true,updated_at=clock_timestamp();
 select * into previous from public.native_push_bindings b where b.installation_id=register_native_push_binding.installation_id and b.audience=audience_value;
 if found and (previous.actor_user_id is distinct from actor_user_id or previous.auth_session_id is distinct from session_id
 or previous.request_id is distinct from visitor_request_id or previous.access_digest is distinct from visitor_digest) then
  delete from public.native_push_bindings where id=previous.id;
 end if;
 insert into public.native_push_bindings(installation_id,audience,actor_user_id,auth_session_id,request_id,access_digest,expires_at)
 values(installation_id,audience_value,actor_user_id,session_id,visitor_request_id,visitor_digest,expiry)
 on conflict on constraint native_push_bindings_installation_id_audience_key do update set expires_at=excluded.expires_at;
 return true;
end $$;

create function public.remove_native_push_binding(installation_id uuid,installation_digest text,remove_scope text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare saved_digest text;
begin
 if remove_scope is null or remove_scope not in ('MEMBER','GUEST','ALL') then raise exception 'INVALID_PUSH_INPUT';end if;
 select i.secret_digest into saved_digest from public.native_push_installations i where i.id=installation_id for update;
 if not found then return true;end if;
 if saved_digest is distinct from installation_digest then raise exception 'FORBIDDEN';end if;
 delete from public.native_push_bindings b where b.installation_id=remove_native_push_binding.installation_id and (remove_scope='ALL' or b.audience=remove_scope);
 if remove_scope='ALL' then update public.native_push_installations set enabled=false where id=installation_id;end if;
 return true;
end $$;

create function public.enqueue_native_push(kind_value text,target_id uuid,event_value text,sequence_value bigint default 0,
 assignment_value bigint default 0,approval_stamp timestamptz default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.native_push_outbox(binding_id,kind,source_id,event,sequence,assignment_version,approved_at,event_key)
 select b.id,kind_value,target_id,event_value,sequence_value,assignment_value,approval_stamp,
 concat_ws(':',kind_value,target_id,event_value,sequence_value,assignment_value,approval_stamp)
 from public.native_push_bindings b where public.native_push_binding_active(b.id) and
 ((kind_value='SUPPORT' and b.audience='MEMBER' and exists(select 1 from public.support_conversations c where c.id=target_id and c.customer_user_id=b.actor_user_id))
 or (kind_value='BROKERAGE' and b.audience='GUEST' and b.request_id=target_id)
 or (kind_value='HANDOVER' and b.audience='MEMBER' and exists(select 1 from public.provider_shipments s where s.id=target_id and s.assigned_driver_user_id=b.actor_user_id
 and s.operational_status='COMPLETED' and s.handover_approval_kind in ('OWNER','STAFF') and s.handover_approved_at=approval_stamp
 and public.provider_tracking_actor_owns_shipment(b.actor_user_id,s.id))))
 on conflict(binding_id,event_key) do nothing;
end $$;

create function public.capture_native_push_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare customer uuid;version bigint;assigned uuid;
begin
 if tg_table_name='support_messages' then
  select customer_user_id,chat_assignment_version into customer,version from public.support_conversations where id=new.conversation_id;
  if new.sender_user_id is not null and new.sender_user_id is distinct from customer then perform public.enqueue_native_push('SUPPORT',new.conversation_id,'MESSAGE',new.sequence,version);end if;
 elsif tg_table_name='transport_chat_messages' then
  if new.sender_kind='BROKER' then
   select chat_assignment_version into version from public.transport_service_requests where id=new.request_id;
   perform public.enqueue_native_push('BROKERAGE',new.request_id,'MESSAGE',new.sequence,version);
  end if;
 elsif tg_table_name='support_conversations' then
  if new.assigned_agent_user_id is not null and new.chat_assignment_version is distinct from old.chat_assignment_version then
   perform public.enqueue_native_push('SUPPORT',new.id,'ASSIGNED',0,new.chat_assignment_version);
  end if;
  if new.status='CLOSED' and old.status is distinct from new.status then perform public.enqueue_native_push('SUPPORT',new.id,'RESOLVED',0,new.chat_assignment_version);end if;
 elsif tg_table_name='transport_service_requests' then
  if new.assigned_agent_user_id is not null and new.chat_assignment_version is distinct from old.chat_assignment_version then
   perform public.enqueue_native_push('BROKERAGE',new.id,'ASSIGNED',0,new.chat_assignment_version);
  end if;
  if new.status='CLOSED' and old.status is distinct from new.status then perform public.enqueue_native_push('BROKERAGE',new.id,'RESOLVED',0,new.chat_assignment_version);end if;
 elsif tg_table_name in ('support_chat_read_cursors','transport_chat_read_cursors') then
  if new.participant='TEAM' and new.joined_at is not null and
   (tg_op='INSERT' or new.joined_assignment_version is distinct from old.joined_assignment_version or old.joined_at is null) then
   if tg_table_name='support_chat_read_cursors' then
    select assigned_agent_user_id,chat_assignment_version into assigned,version from public.support_conversations where id=new.conversation_id;
    if assigned=new.joined_by_user_id and version=new.joined_assignment_version then perform public.enqueue_native_push('SUPPORT',new.conversation_id,'JOINED',0,version);end if;
   else
    select assigned_agent_user_id,chat_assignment_version into assigned,version from public.transport_service_requests where id=new.request_id;
    if assigned=new.joined_by_user_id and version=new.joined_assignment_version then perform public.enqueue_native_push('BROKERAGE',new.request_id,'JOINED',0,version);end if;
   end if;
  end if;
 elsif tg_table_name='transport_chat_access' then
  if new.ended_at is not null and old.ended_at is distinct from new.ended_at then
   select chat_assignment_version into version from public.transport_service_requests where id=new.request_id;
   perform public.enqueue_native_push('BROKERAGE',new.request_id,'ENDED',0,version);
  end if;
 elsif tg_table_name='provider_shipments' then
  if new.operational_status='COMPLETED' and new.handover_approved_at is not null and new.handover_approved_at is distinct from old.handover_approved_at
  and new.handover_approval_kind in ('OWNER','STAFF') then perform public.enqueue_native_push('HANDOVER',new.id,'APPROVED',0,0,new.handover_approved_at);end if;
 end if;
 return new;
end $$;
create trigger native_push_support_message after insert on public.support_messages for each row execute function public.capture_native_push_event();
create trigger native_push_brokerage_message after insert on public.transport_chat_messages for each row execute function public.capture_native_push_event();
create trigger native_push_support_state after update on public.support_conversations for each row execute function public.capture_native_push_event();
create trigger native_push_brokerage_state after update on public.transport_service_requests for each row execute function public.capture_native_push_event();
create trigger native_push_support_join after insert or update on public.support_chat_read_cursors for each row execute function public.capture_native_push_event();
create trigger native_push_brokerage_join after insert or update on public.transport_chat_read_cursors for each row execute function public.capture_native_push_event();
create trigger native_push_brokerage_end after update on public.transport_chat_access for each row execute function public.capture_native_push_event();
create trigger native_push_handover after update on public.provider_shipments for each row execute function public.capture_native_push_event();

create function public.claim_native_push_batch(worker_id uuid,batch_size integer default 40) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if worker_id is null or batch_size is null or batch_size not between 1 and 40 then raise exception 'INVALID_PUSH_INPUT';end if;
 delete from public.native_push_outbox where id in(select id from public.native_push_outbox where expires_at<=now() order by expires_at limit 200);
 delete from public.native_push_installations where id in(select id from public.native_push_installations where updated_at<now()-interval '31 days' order by updated_at limit 50);
 update public.native_push_outbox set state='FAILED',lease_id=null,leased_until=null,outcome_code='LEASE_EXHAUSTED'
 where leased_until<now() and (state='SENDING' and attempts>=5 or state='CHECKING' and receipt_attempts>=8);
 with due as(select id from public.native_push_outbox where
  ((state='PENDING' and attempts<5) or state='SENDING' and leased_until<now() and attempts<5 or
   state='SUBMITTED' and receipt_attempts<8 or state='CHECKING' and leased_until<now() and receipt_attempts<8)
  and next_attempt_at<=now() order by next_attempt_at,created_at,id for update skip locked limit batch_size),
 claimed as(update public.native_push_outbox q set lease_id=worker_id,leased_until=now()+interval '2 minutes',
  state=case when q.state in ('SUBMITTED','CHECKING') then 'CHECKING' else 'SENDING' end,
  attempts=q.attempts+case when q.state in ('SUBMITTED','CHECKING') then 0 else 1 end,
  receipt_attempts=q.receipt_attempts+case when q.state in ('SUBMITTED','CHECKING') then 1 else 0 end
  from due where q.id=due.id returning q.id,q.state,q.ticket_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'state',state,'ticketId',ticket_id)),'[]'::jsonb) into result from claimed;
 return result;
end $$;

create function public.native_push_delivery_context(delivery_id uuid,worker_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.native_push_outbox%rowtype;b public.native_push_bindings%rowtype;i public.native_push_installations%rowtype;
 read_state jsonb;current_version bigint;current_status text;ended timestamptz;valid boolean:=true;
begin
 select * into q from public.native_push_outbox where id=delivery_id and lease_id=worker_id and leased_until>now() and state in ('SENDING','CHECKING') for update;
 if not found then return null;end if;
 select * into b from public.native_push_bindings where id=q.binding_id;
 valid:=found and public.native_push_binding_active(b.id);
 if valid and q.kind='HANDOVER' then
  valid:=exists(select 1 from public.provider_shipments s where s.id=q.source_id and s.assigned_driver_user_id=b.actor_user_id and s.operational_status='COMPLETED'
   and s.handover_approval_kind in ('OWNER','STAFF') and s.handover_approved_at=q.approved_at and public.provider_tracking_actor_owns_shipment(b.actor_user_id,s.id)
   and not exists(select 1 from public.driver_handover_alert_reads r where r.shipment_id=s.id and r.driver_user_id=b.actor_user_id and r.approved_at=s.handover_approved_at));
 elsif valid then
  begin read_state:=public.chat_read_state(q.kind,q.source_id,b.actor_user_id,b.access_digest);exception when raise_exception then valid:=false;end;
  if valid then
   current_version:=(read_state->>'assignmentVersion')::bigint;
   if q.kind='SUPPORT' then select status into current_status from public.support_conversations where id=q.source_id;
   else select r.status,a.ended_at into current_status,ended from public.transport_service_requests r join public.transport_chat_access a on a.request_id=r.id where r.id=q.source_id;end if;
   valid:=read_state->>'ownSide'='CUSTOMER' and current_version=q.assignment_version;
   if q.event='MESSAGE' then valid:=valid and q.sequence>(read_state->>'ownSeen')::bigint;
   elsif q.event='JOINED' then valid:=valid and (read_state->>'teamJoined')::boolean;
   elsif q.event='RESOLVED' then valid:=valid and current_status='CLOSED';
   elsif q.event='ENDED' then valid:=valid and ended is not null;
   else valid:=valid and current_status<>'CLOSED';end if;
  end if;
 end if;
 if not coalesce(valid,false) then update public.native_push_outbox set state='CANCELLED',lease_id=null,leased_until=null,outcome_code='SCOPE_CHANGED' where id=q.id;return null;end if;
 select * into i from public.native_push_installations where id=b.installation_id;
 if q.state='SENDING' then
  update public.native_push_outbox set token_digest=encode(extensions.digest(i.expo_token,'sha256'),'hex') where id=q.id;
 end if;
 return jsonb_build_object('id',q.id,'state',q.state,'token',i.expo_token,'locale',i.locale,'kind',q.kind,'sourceId',q.source_id,
 'event',q.event,'sequence',q.sequence,'assignmentVersion',q.assignment_version,'approvedAt',q.approved_at,'ticketId',q.ticket_id);
end $$;

create function public.finish_native_push_delivery(delivery_id uuid,worker_id uuid,result jsonb) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.native_push_outbox%rowtype;code text:=result->>'code';next_state text;ticket text:=result->>'ticketId';
begin
 select * into q from public.native_push_outbox where id=delivery_id and lease_id=worker_id and leased_until>now() and state in ('SENDING','CHECKING') for update;
 if not found then return false;end if;
 if code is null or code not in ('ACCEPTED','DELIVERED','RETRY','NO_RECEIPT','DeviceNotRegistered','InvalidCredentials','MessageTooBig','MessageRateExceeded','PROVIDER_REJECTED') then raise exception 'INVALID_PUSH_INPUT';end if;
 if code='ACCEPTED' then
  if q.state<>'SENDING' or ticket is null or length(ticket) not between 1 and 200 or ticket !~ '^[A-Za-z0-9_-]+$' then raise exception 'INVALID_PUSH_INPUT';end if;
  next_state:='SUBMITTED';
 elsif code='DELIVERED' then
  if q.state<>'CHECKING' then raise exception 'INVALID_PUSH_INPUT';end if;next_state:='DELIVERED';
 elsif code='DeviceNotRegistered' then
  update public.native_push_installations set enabled=false where id=(select installation_id from public.native_push_bindings where id=q.binding_id)
   and encode(extensions.digest(expo_token,'sha256'),'hex')=q.token_digest;
  -- A receipt for an older FCM token cannot disable a newly registered token.
  update public.native_push_outbox set state='CANCELLED',lease_id=null,leased_until=null,outcome_code=code where id=q.id or binding_id in
   (select b.id from public.native_push_bindings b join public.native_push_installations i on i.id=b.installation_id where not i.enabled
    and i.id=(select installation_id from public.native_push_bindings where id=q.binding_id));
  return true;
 elsif code in ('RETRY','NO_RECEIPT','MessageRateExceeded') then
  next_state:=case when q.state='CHECKING' then case when q.receipt_attempts>=8 then 'FAILED' else 'SUBMITTED' end
   else case when q.attempts>=5 then 'FAILED' else 'PENDING' end end;
 else next_state:='FAILED';end if;
 update public.native_push_outbox set state=next_state,ticket_id=case when code='ACCEPTED' then ticket else ticket_id end,outcome_code=code,
  lease_id=null,leased_until=null,next_attempt_at=now()+case when code='ACCEPTED' then interval '15 minutes'
   when q.state='CHECKING' then interval '15 minutes' else interval '1 minute'*least(60,power(2,greatest(0,q.attempts-1))) end where id=q.id;
 return true;
end $$;

revoke all on function public.native_push_binding_active(uuid),public.register_native_push_binding(uuid,text,text,text,uuid,uuid,uuid,text),
 public.remove_native_push_binding(uuid,text,text),public.enqueue_native_push(text,uuid,text,bigint,bigint,timestamptz),public.capture_native_push_event(),
 public.claim_native_push_batch(uuid,integer),public.native_push_delivery_context(uuid,uuid),public.finish_native_push_delivery(uuid,uuid,jsonb)
 from public,anon,authenticated;
grant execute on function public.register_native_push_binding(uuid,text,text,text,uuid,uuid,uuid,text),public.remove_native_push_binding(uuid,text,text),
 public.claim_native_push_batch(uuid,integer),public.native_push_delivery_context(uuid,uuid),public.finish_native_push_delivery(uuid,uuid,jsonb) to service_role;
alter table public.platform_controls add column native_push_outbox boolean not null default true check(native_push_outbox);
notify pgrst,'reload schema';
