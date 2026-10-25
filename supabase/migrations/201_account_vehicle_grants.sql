-- FEAT-CON-001. An accepted connection is a relationship, not a vehicle grant.
-- Every account grant is checked against its current connection, vehicle owner,
-- driver assignment, sharing mode and review-account boundary on every read.
begin;
select pg_advisory_xact_lock(8030201);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.account_capacity_grants (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null references public.account_connections(id),
 vehicle_id uuid not null references public.vehicles(id),
 recipient_kind text not null check(recipient_kind in('ORGANIZATION','PROVIDER_PROFILE','BUSINESS','DRIVER')),
 recipient_id uuid not null,
 granted_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 revoked_by uuid references public.profiles(id),
 revision integer not null default 1 check(revision>0)
);
create unique index account_capacity_grants_current on public.account_capacity_grants(connection_id,vehicle_id)
 where revoked_at is null;
create index account_capacity_grants_recipient on public.account_capacity_grants(recipient_kind,recipient_id,vehicle_id)
 where revoked_at is null;
alter table public.account_capacity_grants enable row level security;
revoke all on public.account_capacity_grants from public,anon,authenticated;
grant select,insert,update on public.account_capacity_grants to service_role;

create function public.directory_account_review_scope(target_kind text,target_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select case target_kind
  when 'ORGANIZATION' then (select review_workspace from organizations where id=target_id)
  when 'PROVIDER_PROFILE' then (select review_workspace from provider_profiles where id=target_id)
  when 'BUSINESS' then (select review_workspace from business_workspaces where id=target_id)
  when 'DRIVER' then (select public.business_vehicle_review_scope(a.vehicle_id)
   from driver_vehicle_assignments a where a.driver_user_id=target_id and a.active limit 1)
 end
$$;

create function public.directory_source_controls_vehicle(source_kind text,source_id uuid,target_vehicle_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from vehicles v where v.id=target_vehicle_id and v.active and
  (source_kind='ORGANIZATION' and v.organization_id=source_id and exists(
    select 1 from organization_members m join profiles p on p.id=m.user_id and p.active
    where m.organization_id=source_id and m.membership_role='OWNER')
   or source_kind='PROVIDER_PROFILE' and v.provider_profile_id=source_id and exists(
    select 1 from provider_profiles x join profiles p on p.id=x.user_id and p.active where x.id=source_id)
   or source_kind='DRIVER' and exists(
    select 1 from profiles p join drivers d on d.user_id=p.id and d.active
    join driver_vehicle_assignments a on a.driver_user_id=p.id and a.active and a.vehicle_id=v.id
    where p.id=source_id and p.active and p.role='DRIVER'
     and coalesce((select permission.can_manage_capacity from driver_permissions permission where permission.user_id=p.id),false))));
$$;

create function public.account_capacity_grant_valid(target_grant_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from account_capacity_grants g join account_connections c on c.id=g.connection_id
  where g.id=target_grant_id and g.revoked_at is null and c.status='ACCEPTED'
   and ((c.requester_kind=g.recipient_kind and c.requester_id=g.recipient_id
      and public.directory_source_controls_vehicle(c.recipient_kind,c.recipient_id,g.vehicle_id))
    or (c.recipient_kind=g.recipient_kind and c.recipient_id=g.recipient_id
      and public.directory_source_controls_vehicle(c.requester_kind,c.requester_id,g.vehicle_id)))
   and public.capacity_sharing_mode(g.vehicle_id) in('PRIVATE','BOTH')
   and public.directory_account_review_scope(g.recipient_kind,g.recipient_id)
       =public.business_vehicle_review_scope(g.vehicle_id))
$$;

create function public.grant_account_capacity_access(actor_user_id uuid,target_connection_id uuid,target_vehicle_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor record;relation account_connections%rowtype;recipient_kind text;recipient_id uuid;
 saved account_capacity_grants%rowtype;mode text;
begin
 select * into actor from public.directory_actor_account(actor_user_id);
 if not found or not actor.can_manage then raise exception 'DIRECTORY_FORBIDDEN';end if;
 select * into relation from account_connections where id=target_connection_id for share;
 if not found or relation.status<>'ACCEPTED' then raise exception 'DIRECTORY_FORBIDDEN';end if;
 if actor.subject_kind=relation.requester_kind and actor.subject_id=relation.requester_id then
  recipient_kind:=relation.recipient_kind;recipient_id:=relation.recipient_id;
 elsif actor.subject_kind=relation.recipient_kind and actor.subject_id=relation.recipient_id then
  recipient_kind:=relation.requester_kind;recipient_id:=relation.requester_id;
 else raise exception 'DIRECTORY_FORBIDDEN';end if;
 perform 1 from vehicles where id=target_vehicle_id and active for update;
 if not found or not public.private_capacity_actor_controls_vehicle(actor_user_id,target_vehicle_id)
  or not public.directory_source_controls_vehicle(actor.subject_kind,actor.subject_id,target_vehicle_id)
  or public.directory_account_review_scope(recipient_kind,recipient_id)
       is distinct from public.business_vehicle_review_scope(target_vehicle_id)
  then raise exception 'DIRECTORY_FORBIDDEN';end if;
 mode:=public.capacity_sharing_mode(target_vehicle_id);
 if mode='EXCLUSIVE' then raise exception 'EXCLUSIVE_RECIPIENT_ONLY';end if;
 if mode='PUBLIC' then perform public.set_provider_capacity_sharing(actor_user_id,target_vehicle_id,'BOTH');end if;
 select * into saved from account_capacity_grants
  where connection_id=target_connection_id and vehicle_id=target_vehicle_id and revoked_at is null;
 if found then return jsonb_build_object('id',saved.id,'vehicleId',saved.vehicle_id,
  'connectionId',saved.connection_id,'revision',saved.revision,'created',false);end if;
 insert into account_capacity_grants(connection_id,vehicle_id,recipient_kind,recipient_id,granted_by)
 values(target_connection_id,target_vehicle_id,recipient_kind,recipient_id,actor_user_id) returning * into saved;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_CAPACITY_GRANTED','account_capacity_grant',saved.id,
  jsonb_build_object('vehicleId',saved.vehicle_id,'connectionId',saved.connection_id));
 return jsonb_build_object('id',saved.id,'vehicleId',saved.vehicle_id,
  'connectionId',saved.connection_id,'revision',saved.revision,'created',true);
end $$;

create function public.revoke_account_capacity_access(actor_user_id uuid,target_grant_id uuid,expected_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved account_capacity_grants%rowtype;
begin
 select * into saved from account_capacity_grants where id=target_grant_id;
 if not found or not public.private_capacity_actor_controls_vehicle(actor_user_id,saved.vehicle_id)
  then raise exception 'DIRECTORY_FORBIDDEN';end if;
 perform 1 from vehicles where id=saved.vehicle_id for update;
 select * into saved from account_capacity_grants where id=target_grant_id for update;
 if not public.private_capacity_actor_controls_vehicle(actor_user_id,saved.vehicle_id)
  then raise exception 'DIRECTORY_FORBIDDEN';end if;
 if saved.revision is distinct from expected_revision then raise exception 'DIRECTORY_REVISION_CONFLICT';end if;
 if saved.revoked_at is null then
  update account_capacity_grants set revoked_at=clock_timestamp(),revoked_by=actor_user_id,
   revision=revision+1 where id=saved.id returning * into saved;
  insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
   values(actor_user_id,'ACCOUNT_CAPACITY_REVOKED','account_capacity_grant',saved.id,
    jsonb_build_object('vehicleId',saved.vehicle_id,'connectionId',saved.connection_id));
 end if;
 return jsonb_build_object('id',saved.id,'revision',saved.revision,'revoked',true);
end $$;

-- Disconnection invalidates account grants on the next read without deleting
-- history. The recipient can also leave an accepted relationship.
create or replace function public.decide_account_connection(actor_user_id uuid,target_connection_id uuid,decision text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor record;saved account_connections%rowtype;next_status text;
begin
 select * into actor from public.directory_actor_account(actor_user_id);
 if not found or not actor.can_manage then raise exception 'DIRECTORY_FORBIDDEN';end if;
 select * into saved from account_connections where id=target_connection_id for update;
 if not found then raise exception 'DIRECTORY_NOT_FOUND';end if;
 if decision='ACCEPT' and saved.status='PENDING' and actor.subject_kind=saved.recipient_kind
  and actor.subject_id=saved.recipient_id
  and public.directory_account_visible(saved.requester_kind,saved.requester_id) then next_status:='ACCEPTED';
 elsif decision='DECLINE' and saved.status='PENDING' and actor.subject_kind=saved.recipient_kind
  and actor.subject_id=saved.recipient_id then next_status:='DECLINED';
 elsif decision='CANCEL' and saved.status='PENDING' and actor.subject_kind=saved.requester_kind
  and actor.subject_id=saved.requester_id then next_status:='CANCELLED';
 elsif decision='REVOKE' and saved.status='ACCEPTED' and
  ((actor.subject_kind=saved.requester_kind and actor.subject_id=saved.requester_id)
   or (actor.subject_kind=saved.recipient_kind and actor.subject_id=saved.recipient_id)) then next_status:='REVOKED';
 else raise exception 'DIRECTORY_FORBIDDEN';end if;
 update account_connections set status=next_status,decided_by=actor_user_id,updated_at=clock_timestamp()
 where id=saved.id returning * into saved;
 insert into audit_logs(actor_user_id,action,entity_type,entity_id,details)
 values(actor_user_id,'ACCOUNT_CONNECTION_'||next_status,'account_connection',saved.id,
  jsonb_build_object('status',next_status));
 return jsonb_build_object('id',saved.id,'status',saved.status);
end $$;

-- The account list may contain review-only synthetic accounts. Keep them out
-- of real-user discovery, including guessed-ID requests.
do $directory_scope$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('public.account_directory_page(uuid,text,integer,integer)'::regprocedure);
 anchor:='where s.summary is not null and(c.kind<>actor.subject_kind or c.id<>actor.subject_id)';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'DIRECTORY_SCOPE_DRIFT';end if;
 execute replace(definition,anchor,anchor||E'\n   and public.directory_account_review_scope(c.kind,c.id)=public.directory_account_review_scope(actor.subject_kind,actor.subject_id)');
 definition:=pg_get_functiondef('public.request_account_connection(uuid,text,uuid)'::regprocedure);
 anchor:='if not public.directory_account_visible(target_kind,target_id) or';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'DIRECTORY_REQUEST_SCOPE_DRIFT';end if;
 execute replace(definition,anchor,
  'if public.directory_account_review_scope(actor.subject_kind,actor.subject_id) is distinct from public.directory_account_review_scope(target_kind,target_id) or not public.directory_account_visible(target_kind,target_id) or');
end $directory_scope$;

-- Preserve the installed Capacity projection and its match/filter logic.
-- Replace only its authorization CTE with registered account grants plus the
-- verified email grants that existing users already possess.
do $account_projection$
declare definition text;before_text text;after_text text;header text;
begin
 definition:=pg_get_functiondef('public.capacity_search_private_rows_pre_retirement159(text,text,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 before_text:=$before$with authorized as (
    select distinct grant_record.vehicle_id
    from public.capacity_access_grants grant_record
    where public.capacity_sharing_allows(grant_record.vehicle_id,upper(requested_audience),requested_digest) and grant_record.audience_type=upper(requested_audience)
      and grant_record.recipient_email_digest=requested_digest
      and grant_record.revoked_at is null
      and (grant_record.expires_at is null or grant_record.expires_at>now())
      and (
        upper(requested_audience)='EMAIL' and actor_user_id is null
        or upper(requested_audience)='LOADGISTIC' and public.private_capacity_operations_actor(actor_user_id)
      )
  ), latest as ($before$;
 after_text:=$after$with authorized as (
    select grant_record.vehicle_id from public.account_capacity_grants grant_record
    join public.directory_actor_account(actor_user_id) actor
      on actor.subject_kind=grant_record.recipient_kind and actor.subject_id=grant_record.recipient_id
    where public.account_capacity_grant_valid(grant_record.id)
    union
    select grant_record.vehicle_id from public.capacity_access_grants grant_record
    join auth.users recipient on recipient.id=actor_user_id and recipient.email_confirmed_at is not null
      and lower(trim(recipient.email))=grant_record.recipient_email
    where grant_record.audience_type='EMAIL' and grant_record.recipient_email_digest=requested_digest
      and grant_record.revoked_at is null and(grant_record.expires_at is null or grant_record.expires_at>now())
      and public.capacity_sharing_allows(grant_record.vehicle_id,'EMAIL',requested_digest)
      and public.business_vehicle_review_scope(grant_record.vehicle_id)=public.business_review_identity(actor_user_id)
  ), latest as ($after$;
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1
  then raise exception 'ACCOUNT_CAPACITY_PROJECTION_DRIFT';end if;
 definition:=replace(definition,before_text,after_text);
 header:='public.capacity_search_private_rows_pre_retirement159(requested_audience text, requested_digest text, actor_user_id uuid,';
 if strpos(definition,header)=0 then raise exception 'ACCOUNT_CAPACITY_SIGNATURE_DRIFT';end if;
 execute replace(definition,header,'public.account_capacity_rows(actor_user_id uuid, requested_digest text,');
end $account_projection$;

create or replace function public.account_capacity_filtered_page(
 actor_user_id uuid,recipient_digest text,cursor_updated_at timestamptz default null,
 cursor_id uuid default null,requested_page_size integer default 100,query jsonb default '{}'::jsonb
) returns table(payload jsonb) language plpgsql stable security definer
set search_path=public,extensions,pg_temp as $$
declare verified_email text;
begin
 select lower(trim(u.email)) into verified_email from auth.users u
 join profiles p on p.id=u.id and p.active and p.role in('TRANSPORTER','DRIVER','SHIPPER','RECEIVER')
 where u.id=actor_user_id and u.email_confirmed_at is not null and u.deleted_at is null
  and(u.banned_until is null or u.banned_until<=now());
 if verified_email is null or recipient_digest is null or recipient_digest !~ '^[0-9a-f]{64}$'
  or jsonb_typeof(query)<>'object' then raise exception 'ACCOUNT_CAPACITY_FORBIDDEN';end if;
 return query select row.payload from public.account_capacity_rows(actor_user_id,recipient_digest,
  cursor_updated_at,cursor_id,least(100,greatest(12,requested_page_size)),query) row;
end $$;

-- Extend the business feed with team grants made through the signed-in
-- Directory. Preserve its existing review isolation, email grants and filters.
do $business_projection$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 anchor:='    ) shares group by vehicle_id';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'BUSINESS_ACCOUNT_PROJECTION_DRIFT';end if;
 execute replace(definition,anchor,E'      union all\n'
  ||'      select g.vehicle_id,true as team_share from public.account_capacity_grants g'
  ||E'\n      where g.recipient_kind=''BUSINESS'' and g.recipient_id=target_workspace_id'
  ||E'\n       and public.business_workspace_permission(actor_user_id,target_workspace_id,''CAPACITY'')'
  ||E'\n       and public.account_capacity_grant_valid(g.id)'
  ||E'\n       and public.business_vehicle_review_scope(g.vehicle_id)=public.business_review_identity(actor_user_id)'
  ||E'\n'||anchor);
end $business_projection$;

alter function public.private_capacity_network(uuid) rename to private_capacity_network_pre_account201;
create function public.private_capacity_network(actor_user_id uuid) returns table(payload jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
 select row.payload||jsonb_build_object('account_grants',coalesce((
  select jsonb_agg(jsonb_build_object('id',g.id,'vehicle_id',g.vehicle_id,
   'connection_id',g.connection_id,'recipient_kind',g.recipient_kind,
   'recipient_id',g.recipient_id,'recipient_name',coalesce(
    public.directory_account_summary(g.recipient_kind,g.recipient_id)->>'name','Unavailable account'),
   'revision',g.revision,'created_at',g.created_at,'revoked_at',g.revoked_at,
   'effective',public.account_capacity_grant_valid(g.id))
   order by g.created_at desc)
  from account_capacity_grants g where g.vehicle_id=(row.payload->>'id')::uuid),'[]'::jsonb))
 from public.private_capacity_network_pre_account201(actor_user_id) row
$$;

revoke all on function public.directory_account_review_scope(text,uuid),
 public.directory_source_controls_vehicle(text,uuid,uuid),public.account_capacity_grant_valid(uuid),
 public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb),
 public.private_capacity_network_pre_account201(uuid) from public,anon,authenticated,service_role;
revoke all on function public.grant_account_capacity_access(uuid,uuid,uuid),
 public.revoke_account_capacity_access(uuid,uuid,integer),public.private_capacity_network(uuid)
 from public,anon,authenticated;
grant execute on function public.grant_account_capacity_access(uuid,uuid,uuid),
 public.revoke_account_capacity_access(uuid,uuid,integer),public.private_capacity_network(uuid)
 to service_role;
notify pgrst,'reload schema';
commit;
