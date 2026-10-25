-- FEAT-CON-001. Account discovery and requests are separate from vehicle grants.
begin;
select pg_advisory_xact_lock(8030200);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.account_connections (
 id uuid primary key default gen_random_uuid(),
 requester_kind text not null check(requester_kind in('ORGANIZATION','PROVIDER_PROFILE','BUSINESS','DRIVER')),
 requester_id uuid not null,
 recipient_kind text not null check(recipient_kind in('ORGANIZATION','PROVIDER_PROFILE','BUSINESS','DRIVER')),
 recipient_id uuid not null,
 pair_key text not null,
 status text not null check(status in('PENDING','ACCEPTED','DECLINED','CANCELLED','REVOKED')),
 requested_by uuid not null references public.profiles(id),
 decided_by uuid references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(requester_kind<>recipient_kind or requester_id<>recipient_id)
);
create unique index account_connections_active_pair on public.account_connections(pair_key)
 where status in('PENDING','ACCEPTED');
create index account_connections_requester on public.account_connections(requester_kind,requester_id,created_at desc);
create index account_connections_recipient on public.account_connections(recipient_kind,recipient_id,created_at desc);
alter table public.account_connections enable row level security;
revoke all on public.account_connections from public,anon,authenticated;
grant select,insert,update on public.account_connections to service_role;

-- A provider owner acts for the provider account; an employed driver acts for
-- their own driver account. A business member reads its selected workspace,
-- while only its owner/admin may make relationship decisions.
create function public.directory_actor_account(actor_user_id uuid)
returns table(subject_kind text,subject_id uuid,can_manage boolean)
language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
#variable_conflict use_variable
declare actor_role text;scope record;selected uuid;
begin
 select p.role::text into actor_role from profiles p join auth.users u on u.id=p.id
 where p.id=actor_user_id and p.active and p.role::text not in('ADMIN','SUPPORT')
 and u.email_confirmed_at is not null and u.deleted_at is null
 and(u.banned_until is null or u.banned_until<=now());
 if actor_role is null then return;end if;
 if actor_role in('SHIPPER','RECEIVER') then
  select s.workspace_id into selected from business_workspace_selections s
  where s.actor_user_id=actor_user_id and public.business_workspace_permission(actor_user_id,s.workspace_id,'ACCESS');
  if selected is null then
   select m.workspace_id into selected from business_workspace_members m
   where m.user_id=actor_user_id and public.business_workspace_permission(actor_user_id,m.workspace_id,'ACCESS')
   order by case m.role when 'OWNER' then 0 when 'ADMIN' then 1 else 2 end,m.joined_at,m.workspace_id limit 1;
  end if;
  if selected is not null then
   return query select 'BUSINESS'::text,selected,public.business_workspace_permission(actor_user_id,selected,'TEAM');
  end if;
  return;
 end if;
 if actor_role not in('TRANSPORTER','DRIVER') then return;end if;
 select * into scope from public.provider_capacity_actor_scope(actor_user_id);
 if not found or not scope.workspace_access then return;end if;
 if scope.provider_profile_id is not null then
  return query select 'PROVIDER_PROFILE'::text,scope.provider_profile_id,true;
 elsif scope.organization_id is not null and exists(select 1 from organization_members m
  where m.user_id=actor_user_id and m.organization_id=scope.organization_id and m.membership_role='OWNER') then
  return query select 'ORGANIZATION'::text,scope.organization_id,true;
 elsif actor_role='DRIVER' and exists(select 1 from drivers d join driver_vehicle_assignments a
  on a.driver_user_id=d.user_id and a.active join vehicles v on v.id=a.vehicle_id and v.active
  where d.user_id=actor_user_id and d.active and coalesce((select can_manage_capacity from driver_permissions
   where user_id=actor_user_id),true)) then
  return query select 'DRIVER'::text,actor_user_id,true;
 end if;
end $$;

create function public.directory_account_visible(target_kind text,target_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
begin
 case target_kind
 when 'ORGANIZATION' then return exists(select 1 from organizations o join company_pages c on c.organization_id=o.id and c.published
  join organization_members m on m.organization_id=o.id and m.membership_role='OWNER'
  join profiles p on p.id=m.user_id and p.active join auth.users u on u.id=p.id and u.email_confirmed_at is not null
  where o.id=target_id and o.type='TRANSPORT_COMPANY' and o.public_visibility='PUBLIC'
  and not coalesce(o.content_hidden,false) and not coalesce(o.review_workspace,false));
 when 'PROVIDER_PROFILE' then return exists(select 1 from provider_profiles x join company_pages c on c.provider_profile_id=x.id and c.published
  join profiles p on p.id=x.user_id and p.active join auth.users u on u.id=p.id and u.email_confirmed_at is not null
  where x.id=target_id and x.public_visibility='PUBLIC' and not coalesce(x.content_hidden,false)
  and not coalesce(x.review_workspace,false));
 when 'BUSINESS' then return exists(select 1 from business_workspaces w
  where w.id=target_id and w.active and not coalesce(w.review_workspace,false)
  and public.business_directory_manager(w.id) is not null);
 when 'DRIVER' then return exists(select 1 from profiles p join auth.users u on u.id=p.id and u.email_confirmed_at is not null
  join drivers d on d.user_id=p.id and d.active join driver_vehicle_assignments a on a.driver_user_id=p.id and a.active
  join vehicles v on v.id=a.vehicle_id and v.active
  where p.id=target_id and p.active and p.role='DRIVER' and nullif(trim(p.first_name),'') is not null
  and coalesce((select can_manage_capacity from driver_permissions where user_id=p.id),true));
 else return false;
 end case;
end $$;

create function public.directory_account_summary(target_kind text,target_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.directory_account_visible(target_kind,target_id) then return null;end if;
 case target_kind
 when 'ORGANIZATION' then select jsonb_build_object('kind',target_kind,'id',o.id,'name',coalesce(nullif(c.account_name,''),o.name),
  'handle',o.handle,'managerName',public.provider_public_account_identity(o.id,null)->>'manager_name','city',o.city)
  into result from organizations o join company_pages c on c.organization_id=o.id where o.id=target_id;
 when 'PROVIDER_PROFILE' then select jsonb_build_object('kind',target_kind,'id',x.id,
  'name',coalesce(nullif(c.account_name,''),public.public_person_first_name(x.user_id),x.business_name),
  'handle',x.handle,'managerName',public.public_person_first_name(x.user_id),'city',x.city)
  into result from provider_profiles x join company_pages c on c.provider_profile_id=x.id where x.id=target_id;
 when 'BUSINESS' then select jsonb_build_object('kind',target_kind,'id',w.id,'name',w.name,'handle',w.handle,
  'managerName',(select public.public_person_first_name(public.business_directory_manager(w.id))),'city',w.city)
  into result from business_workspaces w where w.id=target_id;
 when 'DRIVER' then select jsonb_build_object('kind',target_kind,'id',p.id,'name',trim(p.first_name),
  'handle',null,'managerName',null,'city',null)
  into result from profiles p where p.id=target_id;
 end case;
 return result;
end $$;

create function public.account_directory_page(actor_user_id uuid,search_text text default '',requested_offset integer default 0,requested_limit integer default 12)
returns table(payload jsonb,total_count bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare actor record;query text:=lower(trim(coalesce(search_text,'')));
begin
 select * into actor from public.directory_actor_account(actor_user_id);
 if not found then raise exception 'DIRECTORY_FORBIDDEN';end if;
 if char_length(query)>120 or requested_offset not between 0 and 100000 or requested_limit not between 1 and 30
  then raise exception 'DIRECTORY_INVALID_INPUT';end if;
 return query with candidates as(
  select 'ORGANIZATION'::text kind,id,handle from organizations where type='TRANSPORT_COMPANY'
  union all select 'PROVIDER_PROFILE',id,handle from provider_profiles
  union all select 'BUSINESS',id,handle from business_workspaces
  union all select 'DRIVER',p.id,null::text from profiles p where p.role='DRIVER'
 ),visible as(
  select c.kind,c.id,s.summary,c.handle from candidates c
  cross join lateral(select public.directory_account_summary(c.kind,c.id) summary)s
  where s.summary is not null and(c.kind<>actor.subject_kind or c.id<>actor.subject_id)
 ),matched as(
  select v.*,count(*) over() row_total,
   case when lower(coalesce(v.handle,''))=ltrim(query,'@') then 0
    when lower(v.summary->>'name')=query then 1
    when starts_with(lower(coalesce(v.handle,'')),ltrim(query,'@')) then 2 else 3 end rank
  from visible v where query='' or not exists(select 1 from regexp_split_to_table(query,'[[:space:]]+') token
   where strpos(lower(concat_ws(' ',v.summary->>'name',v.handle,v.summary->>'managerName')),token)=0)
 )
 select m.summary||jsonb_build_object('connectionStatus',relation.status,
  'connectionDirection',case when relation.id is null then null
   when relation.requester_kind=actor.subject_kind and relation.requester_id=actor.subject_id then 'OUTGOING' else 'INCOMING' end),m.row_total
 from matched m left join lateral(select c.id,c.status,c.requester_kind,c.requester_id
  from account_connections c where c.pair_key=least(actor.subject_kind||':'||actor.subject_id,m.kind||':'||m.id)||'|'||
   greatest(actor.subject_kind||':'||actor.subject_id,m.kind||':'||m.id)
  and c.status in('PENDING','ACCEPTED') limit 1) relation on true
 order by m.rank,lower(m.summary->>'name'),m.id
 offset requested_offset limit requested_limit;
end $$;

create function public.request_account_connection(actor_user_id uuid,target_kind text,target_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor record;pair text;saved account_connections%rowtype;
begin
 select * into actor from public.directory_actor_account(actor_user_id);
 if not found or not actor.can_manage then raise exception 'DIRECTORY_FORBIDDEN';end if;
 if not public.directory_account_visible(target_kind,target_id) or
  (actor.subject_kind=target_kind and actor.subject_id=target_id) then raise exception 'DIRECTORY_INVALID_TARGET';end if;
 pair:=least(actor.subject_kind||':'||actor.subject_id,target_kind||':'||target_id)||'|'||
       greatest(actor.subject_kind||':'||actor.subject_id,target_kind||':'||target_id);
 perform pg_advisory_xact_lock(hashtextextended('account-connection:'||pair,0));
 select * into saved from account_connections c where c.pair_key=pair and c.status in('PENDING','ACCEPTED') for update;
 if found then return jsonb_build_object('id',saved.id,'status',saved.status,'created',false);end if;
 insert into account_connections(requester_kind,requester_id,recipient_kind,recipient_id,pair_key,status,requested_by)
 values(actor.subject_kind,actor.subject_id,target_kind,target_id,pair,'PENDING',actor_user_id) returning * into saved;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_CONNECTION_REQUESTED','account_connection',saved.id,
  jsonb_build_object('requesterKind',saved.requester_kind,'requesterId',saved.requester_id,'recipientKind',saved.recipient_kind,'recipientId',saved.recipient_id));
 return jsonb_build_object('id',saved.id,'status',saved.status,'created',true);
end $$;

create function public.decide_account_connection(actor_user_id uuid,target_connection_id uuid,decision text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor record;saved account_connections%rowtype;next_status text;
begin
 select * into actor from public.directory_actor_account(actor_user_id);
 if not found or not actor.can_manage then raise exception 'DIRECTORY_FORBIDDEN';end if;
 select * into saved from account_connections where id=target_connection_id for update;
 if not found then raise exception 'DIRECTORY_NOT_FOUND';end if;
 if decision='ACCEPT' and saved.status='PENDING' and actor.subject_kind=saved.recipient_kind and actor.subject_id=saved.recipient_id
  and public.directory_account_visible(saved.requester_kind,saved.requester_id) then next_status:='ACCEPTED';
 elsif decision='DECLINE' and saved.status='PENDING' and actor.subject_kind=saved.recipient_kind and actor.subject_id=saved.recipient_id then next_status:='DECLINED';
 elsif decision='CANCEL' and saved.status='PENDING' and actor.subject_kind=saved.requester_kind and actor.subject_id=saved.requester_id then next_status:='CANCELLED';
 else raise exception 'DIRECTORY_FORBIDDEN';end if;
 update account_connections set status=next_status,decided_by=actor_user_id,updated_at=clock_timestamp()
 where id=saved.id returning * into saved;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_CONNECTION_'||next_status,'account_connection',saved.id,jsonb_build_object('status',next_status));
 -- Acceptance records a relationship, never a Capacity grant.
 return jsonb_build_object('id',saved.id,'status',saved.status);
end $$;

create function public.account_connection_list(actor_user_id uuid)
returns table(payload jsonb) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare actor record;
begin
 select * into actor from public.directory_actor_account(actor_user_id);
 if not found then raise exception 'DIRECTORY_FORBIDDEN';end if;
 return query select jsonb_build_object('id',c.id,'status',c.status,'direction',
  case when c.requester_kind=actor.subject_kind and c.requester_id=actor.subject_id then 'OUTGOING' else 'INCOMING' end,
  'canManage',actor.can_manage,'account',coalesce(public.directory_account_summary(
   case when c.requester_kind=actor.subject_kind and c.requester_id=actor.subject_id then c.recipient_kind else c.requester_kind end,
   case when c.requester_kind=actor.subject_kind and c.requester_id=actor.subject_id then c.recipient_id else c.requester_id end),
   jsonb_build_object('kind','UNAVAILABLE','id',null,'name','Unavailable account','handle',null,'managerName',null,'city',null)),
  'createdAt',c.created_at,'updatedAt',c.updated_at)
 from account_connections c where(c.requester_kind=actor.subject_kind and c.requester_id=actor.subject_id)
 or(c.recipient_kind=actor.subject_kind and c.recipient_id=actor.subject_id)
 order by c.created_at desc,c.id desc limit 100;
end $$;

revoke all on function public.directory_actor_account(uuid),public.directory_account_visible(text,uuid),
 public.directory_account_summary(text,uuid),public.account_directory_page(uuid,text,integer,integer),
 public.request_account_connection(uuid,text,uuid),public.decide_account_connection(uuid,uuid,text),
 public.account_connection_list(uuid) from public,anon,authenticated;
grant execute on function public.account_directory_page(uuid,text,integer,integer),
 public.request_account_connection(uuid,text,uuid),public.decide_account_connection(uuid,uuid,text),
 public.account_connection_list(uuid) to service_role;
commit;
