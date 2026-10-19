-- FEAT-ENT-001 / ADR-081. Additive customer tenancy; no provider/global-role shortcut.
begin;
select pg_advisory_xact_lock(8030160);

create table public.business_workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 100),
 handle text not null unique check(handle ~ '^[a-z0-9][a-z0-9_-]{2,59}$'),
 kind text not null check(kind in('BROKER','SHIPPER','RECEIVER')),
 city text check(city is null or length(city)<=100),
 active boolean not null default true,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_workspace_members (
 workspace_id uuid not null references public.business_workspaces(id),
 user_id uuid not null references public.profiles(id),
 role text not null check(role in('OWNER','ADMIN','STAFF')),
 can_view_capacity boolean not null default false,
 can_view_tracking boolean not null default false,
 active boolean not null default true,
 revision bigint not null default 1 check(revision>0),
 joined_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create index business_members_actor_idx on public.business_workspace_members(user_id,workspace_id) where active;
create table public.business_workspace_invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.business_workspaces(id),
 email text not null check(email=lower(trim(email)) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 role text not null check(role in('ADMIN','STAFF')),
 can_view_capacity boolean not null default false, can_view_tracking boolean not null default false,
 status text not null default 'PENDING' check(status in('PENDING','ACCEPTED','REVOKED','EXPIRED')),
 created_by uuid references public.profiles(id) on delete set null,
 accepted_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '7 days'),
 accepted_at timestamptz, revoked_at timestamptz,
 email_lease uuid, email_lease_actor uuid references public.profiles(id) on delete set null,
 email_lease_until timestamptz, email_sent_at timestamptz, email_attempts integer not null default 0,
 check(expires_at>created_at)
);
create unique index business_invitation_pending_idx on public.business_workspace_invitations(workspace_id,email) where status='PENDING';
create index business_invitation_email_idx on public.business_workspace_invitations(email,expires_at) where status='PENDING';
create table public.business_workspace_selections (
 actor_user_id uuid primary key references public.profiles(id) on delete cascade,
 workspace_id uuid not null,
 updated_at timestamptz not null default now(),
 foreign key(workspace_id,actor_user_id) references public.business_workspace_members(workspace_id,user_id) on delete cascade
);
create table public.business_workspace_audit (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.business_workspaces(id),
 actor_user_id uuid references public.profiles(id) on delete set null,
 action text not null,
 subject_id uuid,
 created_at timestamptz not null default now()
);
create index business_audit_workspace_idx on public.business_workspace_audit(workspace_id,created_at desc);
alter table public.business_workspaces enable row level security;
alter table public.business_workspace_members enable row level security;
alter table public.business_workspace_invitations enable row level security;
alter table public.business_workspace_selections enable row level security;
alter table public.business_workspace_audit enable row level security;
revoke all on public.business_workspaces,public.business_workspace_members,public.business_workspace_invitations,
 public.business_workspace_selections,public.business_workspace_audit from public,anon,authenticated,service_role;

-- Private predicate: global roles, stale JWT metadata and selected IDs grant nothing.
create function public.business_customer_identity(actor_user_id uuid, allow_pristine boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=actor_user_id and p.role::text not in('ADMIN','SUPPORT')
   and u.email_confirmed_at is not null and u.deleted_at is null and nullif(trim(u.email),'') is not null
   and (u.banned_until is null or u.banned_until<=now())
   and (p.active or (allow_pristine and public.managed_provider_signup_eligible(actor_user_id))))
$$;

create function public.business_workspace_permission(actor_user_id uuid,target_workspace_id uuid,required_permission text default 'ACCESS')
returns boolean language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select public.business_customer_identity(actor_user_id,false) and exists(
  select 1 from public.business_workspace_members m join public.business_workspaces w on w.id=m.workspace_id
  where m.user_id=actor_user_id and m.workspace_id=target_workspace_id and m.active and w.active
   and case required_permission when 'ACCESS' then true
    when 'CAPACITY' then m.can_view_capacity when 'TRACKING' then m.can_view_tracking
    when 'TEAM' then m.role in('OWNER','ADMIN') when 'OWNER' then m.role='OWNER' else false end)
$$;

-- Only an explicit verified customer operation may claim a pristine placeholder.
-- SHIPPER is storage compatibility, not an authority or provider conversion.
create function public.business_prepare_identity(actor_user_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 perform 1 from public.profiles where id=actor_user_id for update;
 perform 1 from auth.users where id=actor_user_id for update;
 if not public.business_customer_identity(actor_user_id,true) then raise exception 'BUSINESS_IDENTITY_REQUIRED'; end if;
 if exists(select 1 from public.profiles where id=actor_user_id and not active) then
  -- Eligibility was checked while both identity rows were locked.
  update public.profiles set role='SHIPPER',active=true where id=actor_user_id;
 end if;
end $$;

create function public.business_workspace_summary(actor_user_id uuid,target_workspace_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select jsonb_build_object('id',w.id,'name',w.name,'handle',w.handle,'kind',w.kind,'city',w.city,
  'version',w.version,'actorId',actor_user_id,'actorRole','CUSTOMER','membershipRole',m.role,
  'membershipRevision',m.revision,'permissions',jsonb_build_object('capacity',m.can_view_capacity,
  'tracking',m.can_view_tracking,'team',m.role in('OWNER','ADMIN'),'owner',m.role='OWNER'))
 from public.business_workspaces w join public.business_workspace_members m on m.workspace_id=w.id
 where w.id=target_workspace_id and m.user_id=actor_user_id
  and public.business_workspace_permission(actor_user_id,target_workspace_id,'ACCESS')
$$;

create function public.business_workspace_context(actor_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare chosen uuid; verified_email text; contexts jsonb; invitations jsonb;
begin
 if not public.business_customer_identity(actor_user_id,true) then raise exception 'BUSINESS_IDENTITY_REQUIRED'; end if;
 select lower(trim(email)) into verified_email from auth.users where id=actor_user_id;
 select coalesce(jsonb_agg(public.business_workspace_summary(actor_user_id,w.id) order by w.name,w.id),'[]') into contexts
 from public.business_workspaces w where public.business_workspace_permission(actor_user_id,w.id,'ACCESS');
 select s.workspace_id into chosen from public.business_workspace_selections s where s.actor_user_id=actor_user_id
  and public.business_workspace_permission(actor_user_id,s.workspace_id,'ACCESS');
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'workspaceId',w.id,'businessName',w.name,'handle',w.handle,
  'role',i.role,'capacity',i.can_view_capacity,'tracking',i.can_view_tracking,'expiresAt',i.expires_at) order by i.created_at),'[]')
 into invitations from public.business_workspace_invitations i join public.business_workspaces w on w.id=i.workspace_id
 where w.active and i.email=verified_email and i.status='PENDING' and i.expires_at>now();
 return jsonb_build_object('actorId',actor_user_id,'selectedWorkspaceId',chosen,'workspaces',contexts,'invitations',invitations);
end $$;

create function public.business_workspace_create(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare workspace uuid; label text:=trim(command->>'name'); slug text:=lower(trim(command->>'handle'));
 kind_value text:=command->>'kind'; city_value text:=nullif(trim(command->>'city'),'');
begin
 if command is null or jsonb_typeof(command)<>'object' or exists(select 1 from jsonb_object_keys(command) k where k not in('name','handle','kind','city'))
  or label is null or length(label) not between 2 and 100 or slug is null or slug !~ '^[a-z0-9][a-z0-9_-]{2,59}$'
  or kind_value is null or kind_value not in('BROKER','SHIPPER','RECEIVER') or length(city_value)>100 then raise exception 'INVALID_BUSINESS_INPUT'; end if;
 perform public.business_prepare_identity(actor_user_id);
 if (select count(*) from public.business_workspace_members where user_id=actor_user_id and active and role='OWNER')>=20 then raise exception 'BUSINESS_LIMIT_REACHED'; end if;
 insert into public.business_workspaces(name,handle,kind,city) values(label,slug,kind_value,city_value) returning id into workspace;
 insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity,can_view_tracking) values(workspace,actor_user_id,'OWNER',true,true);
 insert into public.business_workspace_selections(actor_user_id,workspace_id) values(actor_user_id,workspace)
  on conflict on constraint business_workspace_selections_pkey do update set workspace_id=excluded.workspace_id,updated_at=now();
 insert into public.business_workspace_audit(workspace_id,actor_user_id,action) values(workspace,actor_user_id,'CREATED');
 return public.business_workspace_summary(actor_user_id,workspace);
exception when unique_violation then raise exception 'BUSINESS_HANDLE_UNAVAILABLE';
end $$;

create function public.business_workspace_select(actor_user_id uuid,target_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 if target_workspace_id is null then
  if not public.business_customer_identity(actor_user_id,true) then raise exception 'BUSINESS_IDENTITY_REQUIRED'; end if;
  delete from public.business_workspace_selections selection where selection.actor_user_id=business_workspace_select.actor_user_id;
  return null;
 end if;
 perform 1 from public.business_workspaces where id=target_workspace_id for update;
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'ACCESS') then raise exception 'BUSINESS_FORBIDDEN'; end if;
 insert into public.business_workspace_selections(actor_user_id,workspace_id) values(actor_user_id,target_workspace_id)
  on conflict on constraint business_workspace_selections_pkey do update set workspace_id=excluded.workspace_id,updated_at=now();
 return public.business_workspace_summary(actor_user_id,target_workspace_id);
end $$;

create function public.business_workspace_directory(actor_user_id uuid,target_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare manager boolean; members jsonb; invitations jsonb;
begin
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'ACCESS') then raise exception 'BUSINESS_FORBIDDEN'; end if;
 manager:=public.business_workspace_permission(actor_user_id,target_workspace_id,'TEAM');
 select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'firstName',coalesce(nullif(p.first_name,''),split_part(p.full_name,' ',1)),
  'role',m.role,'active',m.active and public.business_customer_identity(m.user_id,false),'revision',m.revision,'capacity',m.can_view_capacity,'tracking',m.can_view_tracking)
   ||case when manager then jsonb_build_object('email',u.email) else '{}'::jsonb end order by m.joined_at,m.user_id),'[]')
 into members from public.business_workspace_members m join public.profiles p on p.id=m.user_id
 join auth.users u on u.id=m.user_id where m.workspace_id=target_workspace_id and (m.active or manager);
 if manager then
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'capacity',i.can_view_capacity,'tracking',i.can_view_tracking,
   'status',case when i.expires_at<=now() then 'EXPIRED' else i.status end,'expiresAt',i.expires_at,'emailSentAt',i.email_sent_at) order by i.created_at desc),'[]')
  into invitations from public.business_workspace_invitations i where i.workspace_id=target_workspace_id and i.status='PENDING';
 else invitations:='[]'; end if;
 return jsonb_build_object('workspace',public.business_workspace_summary(actor_user_id,target_workspace_id),'members',members,'invitations',invitations);
end $$;

create function public.business_workspace_search(actor_user_id uuid,search_text text,requested_limit integer default 10) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare needle text:=lower(trim(search_text)); result jsonb;
begin
 if not public.business_customer_identity(actor_user_id,false) then raise exception 'BUSINESS_IDENTITY_REQUIRED'; end if;
 if needle is null or length(needle)<2 or length(needle)>80 then return '[]'; end if;
 -- Literal substring matching: '%'/'_' never become unbounded wildcard input.
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'handle',r.handle,'kind',r.kind,'city',r.city) order by r.rank,r.name,r.id),'[]') into result
 from(select w.*,case when lower(w.handle)=needle then 0 when starts_with(lower(w.name),needle) then 1 else 2 end rank
  from public.business_workspaces w where w.active and (strpos(lower(w.name),needle)>0 or strpos(w.handle,needle)>0)
  order by rank,w.name,w.id limit greatest(1,least(coalesce(requested_limit,10),20))) r;
 return result;
end $$;

create function public.business_workspace_command(actor_user_id uuid,target_workspace_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare business public.business_workspaces; actor public.business_workspace_members; target public.business_workspace_members;
 invitation public.business_workspace_invitations; action_value text:=command->>'action'; subject uuid; email_value text;
 role_value text; capacity_value boolean; tracking_value boolean; result jsonb; key_value text; allowed_keys text[];
begin
 select * into business from public.business_workspaces where id=target_workspace_id for update;
 if not found or not public.business_workspace_permission(actor_user_id,target_workspace_id,'ACCESS') then raise exception 'BUSINESS_FORBIDDEN'; end if;
 select * into actor from public.business_workspace_members where workspace_id=target_workspace_id and user_id=actor_user_id;
 if command is null or jsonb_typeof(command)<>'object' or action_value is null then raise exception 'INVALID_BUSINESS_INPUT'; end if;
 if command->>'expectedVersion' is null or command->>'expectedVersion' !~ '^[1-9][0-9]{0,14}$' then raise exception 'INVALID_BUSINESS_INPUT'; end if;
 if (command->>'expectedVersion')::bigint<>business.version then raise exception 'BUSINESS_REVISION_CONFLICT'; end if;
 allowed_keys:=case action_value
  when 'UPDATE_DETAILS' then array['action','expectedVersion','name','city']
  when 'INVITE' then array['action','expectedVersion','email','role','capacity','tracking']
  when 'UPDATE_MEMBER' then array['action','expectedVersion','userId','role','capacity','tracking','active']
  when 'REMOVE_MEMBER' then array['action','expectedVersion','userId']
  when 'REVOKE_INVITATION' then array['action','expectedVersion','invitationId']
  when 'TRANSFER_OWNERSHIP' then array['action','expectedVersion','userId']
  when 'LEAVE' then array['action','expectedVersion']
  when 'ARCHIVE' then array['action','expectedVersion'] else null end;
 if allowed_keys is null or exists(select 1 from jsonb_object_keys(command) k where not(k=any(allowed_keys))) then raise exception 'INVALID_BUSINESS_INPUT'; end if;
 if action_value not in('LEAVE') and not public.business_workspace_permission(actor_user_id,target_workspace_id,'TEAM') then raise exception 'BUSINESS_FORBIDDEN'; end if;

 if action_value='UPDATE_DETAILS' then
  if command->>'name' is null or length(trim(command->>'name')) not between 2 and 100 or length(command->>'city')>100 then raise exception 'INVALID_BUSINESS_INPUT'; end if;
  update public.business_workspaces set name=trim(command->>'name'),city=nullif(trim(command->>'city'),'') where id=target_workspace_id;
 elsif action_value='INVITE' then
  email_value:=lower(trim(command->>'email')); role_value:=command->>'role';
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or role_value is null or role_value not in('ADMIN','STAFF') or (role_value='ADMIN' and actor.role<>'OWNER')
   or jsonb_typeof(command->'capacity') is distinct from 'boolean' or jsonb_typeof(command->'tracking') is distinct from 'boolean' then raise exception 'INVALID_BUSINESS_INPUT'; end if;
  if exists(select 1 from public.business_workspace_members m join auth.users u on u.id=m.user_id
   where m.workspace_id=target_workspace_id and m.active and lower(trim(u.email))=email_value) then raise exception 'BUSINESS_ALREADY_MEMBER'; end if;
  if (select count(*) from public.business_workspace_invitations where workspace_id=target_workspace_id and status='PENDING' and expires_at>now())>=100 then raise exception 'BUSINESS_LIMIT_REACHED'; end if;
  update public.business_workspace_invitations set status='EXPIRED' where workspace_id=target_workspace_id and email=email_value and status='PENDING' and expires_at<=now();
  if exists(select 1 from public.business_workspace_invitations where workspace_id=target_workspace_id and email=email_value and status='PENDING') then raise exception 'BUSINESS_INVITATION_EXISTS'; end if;
  insert into public.business_workspace_invitations(workspace_id,email,role,can_view_capacity,can_view_tracking,created_by)
   values(target_workspace_id,email_value,role_value,(command->>'capacity')::boolean,(command->>'tracking')::boolean,actor_user_id) returning id into subject;
  result:=jsonb_build_object('invitationId',subject);
 elsif action_value='REVOKE_INVITATION' then
  if command->>'invitationId' is null or command->>'invitationId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_BUSINESS_INPUT'; end if;
  subject:=(command->>'invitationId')::uuid;
  select * into invitation from public.business_workspace_invitations where id=subject and workspace_id=target_workspace_id for update;
  if not found or invitation.status<>'PENDING' then raise exception 'BUSINESS_INVITATION_UNAVAILABLE'; end if;
  if invitation.role='ADMIN' and actor.role<>'OWNER' then raise exception 'BUSINESS_FORBIDDEN'; end if;
  update public.business_workspace_invitations set status='REVOKED',revoked_at=now() where id=subject;
 elsif action_value in('UPDATE_MEMBER','REMOVE_MEMBER','TRANSFER_OWNERSHIP','LEAVE') then
  if action_value='LEAVE' then subject:=actor_user_id;
  else
   if command->>'userId' is null or command->>'userId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_BUSINESS_INPUT'; end if;
   subject:=(command->>'userId')::uuid;
  end if;
  select * into target from public.business_workspace_members where workspace_id=target_workspace_id and user_id=subject for update;
  if not found then raise exception 'BUSINESS_MEMBER_NOT_FOUND'; end if;
  if action_value='TRANSFER_OWNERSHIP' then
   if actor.role<>'OWNER' or subject=actor_user_id or not target.active or not public.business_customer_identity(subject,false) then raise exception 'BUSINESS_FORBIDDEN'; end if;
   update public.business_workspace_members set role='OWNER',can_view_capacity=true,can_view_tracking=true,revision=revision+1,updated_at=now() where workspace_id=target_workspace_id and user_id=subject;
   update public.business_workspace_members set role='ADMIN',revision=revision+1,updated_at=now() where workspace_id=target_workspace_id and user_id=actor_user_id;
  else
   if action_value<>'LEAVE' and (subject=actor_user_id or target.role='OWNER' or (actor.role<>'OWNER' and target.role<>'STAFF')) then raise exception 'BUSINESS_FORBIDDEN'; end if;
   if target.role='OWNER' and target.active and not exists(select 1 from public.business_workspace_members m where m.workspace_id=target_workspace_id and m.role='OWNER' and m.active and m.user_id<>subject and public.business_customer_identity(m.user_id,false)) then raise exception 'BUSINESS_OWNER_HANDOVER_REQUIRED'; end if;
   if action_value='UPDATE_MEMBER' then
    role_value:=command->>'role';
    if role_value is null or role_value not in('ADMIN','STAFF') or (role_value='ADMIN' and actor.role<>'OWNER')
     or jsonb_typeof(command->'capacity') is distinct from 'boolean' or jsonb_typeof(command->'tracking') is distinct from 'boolean'
     or jsonb_typeof(command->'active') is distinct from 'boolean' then raise exception 'INVALID_BUSINESS_INPUT'; end if;
    if (command->>'active')::boolean and not public.business_customer_identity(subject,false) then raise exception 'BUSINESS_IDENTITY_REQUIRED'; end if;
    update public.business_workspace_members set role=role_value,can_view_capacity=(command->>'capacity')::boolean,
     can_view_tracking=(command->>'tracking')::boolean,active=(command->>'active')::boolean,revision=revision+1,updated_at=now()
     where workspace_id=target_workspace_id and user_id=subject;
   else
    if not target.active then raise exception 'BUSINESS_MEMBER_NOT_FOUND'; end if;
    update public.business_workspace_members set active=false,revision=revision+1,updated_at=now() where workspace_id=target_workspace_id and user_id=subject;
   end if;
   -- Revocation invalidates saved contexts immediately; no email/team inference.
   delete from public.business_workspace_selections selection where selection.actor_user_id=subject and selection.workspace_id=target_workspace_id
    and not public.business_workspace_permission(subject,target_workspace_id,'ACCESS');
   update public.business_workspace_invitations i set status='REVOKED',revoked_at=now()
    where i.workspace_id=target_workspace_id and i.created_by=subject and i.status='PENDING'
    and not public.business_workspace_permission(subject,target_workspace_id,case when i.role='ADMIN' then 'OWNER' else 'TEAM' end);
  end if;
 elsif action_value='ARCHIVE' then
  if actor.role<>'OWNER' then raise exception 'BUSINESS_FORBIDDEN'; end if;
  update public.business_workspaces set active=false where id=target_workspace_id;
  update public.business_workspace_invitations set status='REVOKED',revoked_at=now() where workspace_id=target_workspace_id and status='PENDING';
  delete from public.business_workspace_selections where workspace_id=target_workspace_id;
 end if;
 update public.business_workspaces set version=version+1,updated_at=now() where id=target_workspace_id;
 insert into public.business_workspace_audit(workspace_id,actor_user_id,action,subject_id) values(target_workspace_id,actor_user_id,action_value,subject);
 return coalesce(result,'{}')||jsonb_build_object('workspaceId',target_workspace_id,'version',business.version+1,'action',action_value);
end $$;

create function public.business_workspace_accept_invitation(actor_user_id uuid,invitation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare invitation public.business_workspace_invitations; business public.business_workspaces; verified_email text;
begin
 -- Lock the shared workspace boundary first, as in every membership command.
 select w.* into business from public.business_workspaces w join public.business_workspace_invitations i on i.workspace_id=w.id where i.id=invitation_id for update of w;
 select * into invitation from public.business_workspace_invitations where id=invitation_id for update;
 if not found or not business.active or invitation.status<>'PENDING' or invitation.expires_at<=now() then raise exception 'BUSINESS_INVITATION_UNAVAILABLE'; end if;
 if not public.business_customer_identity(actor_user_id,true) then raise exception 'BUSINESS_IDENTITY_REQUIRED'; end if;
 select lower(trim(email)) into verified_email from auth.users where id=actor_user_id;
 if verified_email is distinct from invitation.email then raise exception 'BUSINESS_INVITATION_UNAVAILABLE'; end if;
 -- Inviter must still have current authority for the invited role at acceptance.
 if not public.business_workspace_permission(invitation.created_by,invitation.workspace_id,case when invitation.role='ADMIN' then 'OWNER' else 'TEAM' end) then raise exception 'BUSINESS_INVITATION_UNAVAILABLE'; end if;
 if exists(select 1 from public.business_workspace_members where workspace_id=business.id and user_id=actor_user_id and active) then raise exception 'BUSINESS_ALREADY_MEMBER'; end if;
 perform public.business_prepare_identity(actor_user_id);
 -- Recheck the exact verified email after acquiring its row lock; an email
 -- change between the initial lookup and preparation cannot claim this invite.
 select lower(trim(email)) into verified_email from auth.users where id=actor_user_id;
 if verified_email is distinct from invitation.email then raise exception 'BUSINESS_INVITATION_UNAVAILABLE'; end if;
 insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity,can_view_tracking)
 values(business.id,actor_user_id,invitation.role,invitation.can_view_capacity,invitation.can_view_tracking)
 on conflict(workspace_id,user_id) do update set role=excluded.role,can_view_capacity=excluded.can_view_capacity,
  can_view_tracking=excluded.can_view_tracking,active=true,revision=business_workspace_members.revision+1,updated_at=now();
 update public.business_workspace_invitations set status='ACCEPTED',accepted_by=actor_user_id,accepted_at=now() where id=invitation.id;
 update public.business_workspaces set version=version+1,updated_at=now() where id=business.id;
 insert into public.business_workspace_selections(actor_user_id,workspace_id) values(actor_user_id,business.id)
  on conflict on constraint business_workspace_selections_pkey do update set workspace_id=excluded.workspace_id,updated_at=now();
 insert into public.business_workspace_audit(workspace_id,actor_user_id,action,subject_id) values(business.id,actor_user_id,'INVITATION_ACCEPTED',invitation.id);
 return public.business_workspace_summary(actor_user_id,business.id);
end $$;

-- Delivery is a durable lease after invitation persistence. A failed external
-- provider never rolls back/replaces membership authority or creates Auth users.
create function public.business_workspace_claim_invitation_email(actor_user_id uuid,target_workspace_id uuid,invitation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare invitation public.business_workspace_invitations; business public.business_workspaces; lease_id uuid:=gen_random_uuid();
begin
 select * into business from public.business_workspaces where id=target_workspace_id for update;
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'TEAM') then raise exception 'BUSINESS_FORBIDDEN'; end if;
 select * into invitation from public.business_workspace_invitations where id=invitation_id and workspace_id=target_workspace_id for update;
 if not found or invitation.status<>'PENDING' or invitation.expires_at<=now() then raise exception 'BUSINESS_INVITATION_UNAVAILABLE'; end if;
 if invitation.role='ADMIN' and not public.business_workspace_permission(actor_user_id,target_workspace_id,'OWNER') then raise exception 'BUSINESS_FORBIDDEN'; end if;
 if invitation.email_lease_until>now() or invitation.email_sent_at>now()-interval '1 minute' then return null; end if;
 update public.business_workspace_invitations set email_lease=lease_id,email_lease_actor=actor_user_id,email_lease_until=now()+interval '2 minutes',email_attempts=email_attempts+1 where id=invitation.id;
 return jsonb_build_object('id',invitation.id,'workspaceId',target_workspace_id,'email',invitation.email,'businessName',business.name,'expiresAt',invitation.expires_at,'lease',lease_id);
end $$;
create function public.business_workspace_record_invitation_email(actor_user_id uuid,target_workspace_id uuid,invitation_id uuid,lease_id uuid,sent boolean) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 update public.business_workspace_invitations i set email_sent_at=case when sent then now() else i.email_sent_at end,email_lease=null,email_lease_actor=null,email_lease_until=null
 where i.id=invitation_id and i.workspace_id=target_workspace_id and i.email_lease=lease_id and i.email_lease_actor=actor_user_id;
 if not found then return false; end if;
 insert into public.business_workspace_audit(workspace_id,actor_user_id,action,subject_id) values(target_workspace_id,actor_user_id,case when sent then 'INVITATION_EMAIL_SENT' else 'INVITATION_EMAIL_FAILED' end,invitation_id);
 return true;
end $$;

-- Preserve provider software Support. Legacy SHIPPER/RECEIVER by themselves do
-- not establish customer membership or reopen public/arrangement support.
create or replace function public.support_member_actor(actor_user_id uuid) returns public.profiles
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare actor public.profiles;
begin
 select * into actor from public.profiles p where p.id=actor_user_id and p.active and
  (p.role::text in('TRANSPORTER','DRIVER') or exists(select 1 from public.business_workspace_members m
   where m.user_id=p.id and public.business_workspace_permission(p.id,m.workspace_id,'ACCESS')));
 if not found then raise exception 'FORBIDDEN'; end if;
 return actor;
end $$;
create or replace function public.support_actor_can_read(actor_user_id uuid,conversation_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select exists(select 1 from public.support_conversations c join public.profiles actor on actor.id=actor_user_id and actor.active
 where c.id=conversation_id and (
  (c.customer_user_id=actor.id and (actor.role::text in('TRANSPORTER','DRIVER') or exists(
   select 1 from public.business_workspace_members m where m.user_id=actor.id and public.business_workspace_permission(actor.id,m.workspace_id,'ACCESS'))))
  or (actor.role::text='SUPPORT' and c.assigned_agent_user_id=actor.id and public.managed_actor_has_permission(actor.id,'SUPPORT'))
  or actor.role::text='ADMIN'))
$$;
create or replace function public.accept_content_policy(actor_user_id uuid,policy_version text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 if policy_version is distinct from '2026-10-09' then raise exception 'POLICY_VERSION_CHANGED'; end if;
 if not public.business_customer_identity(actor_user_id,true) then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.user_policy_acceptances a where a.user_id=actor_user_id and a.version=policy_version) then return true; end if;
 insert into public.user_policy_acceptances(user_id,version) values(actor_user_id,policy_version)
 on conflict(user_id) do update set version=excluded.version,accepted_at=clock_timestamp();
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details) values(actor_user_id,'CONTENT_POLICY_ACCEPTED','profile',actor_user_id,jsonb_build_object('version',policy_version));
 return true;
end $$;
create or replace function public.require_content_policy(actor_user_id uuid) returns void
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 if not exists(select 1 from public.profiles p where p.id=actor_user_id and p.active and p.role::text in('ADMIN','SUPPORT'))
  and not public.business_customer_identity(actor_user_id,false) then raise exception 'FORBIDDEN'; end if;
 if not public.content_policy_accepted(actor_user_id) then raise exception 'POLICY_REQUIRED'; end if;
end $$;

create function public.business_account_delete_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 if exists(select 1 from public.business_workspace_members m join public.business_workspaces w on w.id=m.workspace_id
  where m.user_id=old.id and m.role='OWNER' and m.active and w.active and not exists(
   select 1 from public.business_workspace_members other where other.workspace_id=w.id and other.user_id<>old.id and other.role='OWNER' and other.active and public.business_customer_identity(other.user_id,false)))
 then raise exception 'BUSINESS_OWNER_HANDOVER_REQUIRED'; end if;
 update public.business_workspace_invitations set email='deleted-'||id::text||'@removed.invalid',status=case when status='PENDING' then 'REVOKED' else status end
  where accepted_by=old.id or lower(trim(email))=lower(trim(old.email)) or lower(trim(email))=(select lower(trim(email)) from auth.users where id=old.id);
 -- History is pseudonymized by existing FK actions; non-owner membership removed
 -- only as part of the actual account deletion, never as a permission shortcut.
 delete from public.business_workspace_members where user_id=old.id;
 return old;
end $$;
create trigger business_account_delete_guard before delete on public.profiles for each row execute function public.business_account_delete_guard();

-- A person may deliberately add a provider workspace after becoming a customer.
-- No global SHIPPER role or stale membership grants provisioning eligibility.
create function public.business_provider_signup_eligible(actor_user_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
 where p.id=actor_user_id and p.active and p.role::text='SHIPPER' and u.email_confirmed_at is not null and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<=now()) and nullif(trim(u.email),'') is not null
  and nullif(trim(coalesce(u.raw_app_meta_data->>'role','')),'') is null
  and nullif(trim(coalesce(u.raw_app_meta_data->>'provisioned_by','')),'') is null
  and exists(select 1 from public.business_workspace_members m join public.business_workspaces w on w.id=m.workspace_id where m.user_id=p.id and m.active and w.active)
  and not exists(select 1 from public.applications x where x.user_id=p.id)
  and not exists(select 1 from public.provider_profiles x where x.user_id=p.id)
  and not exists(select 1 from public.organization_members x where x.user_id=p.id)
  and not exists(select 1 from public.drivers x where x.user_id=p.id)
  and not exists(select 1 from public.driver_permissions x where x.user_id=p.id)
  and not exists(select 1 from public.driver_vehicle_assignments x where x.driver_user_id=p.id)
  and not exists(select 1 from public.support_agent_profiles x where x.user_id=p.id))
$$;
create or replace function public.managed_provider_signup_eligible(actor_user_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select public.business_provider_signup_eligible(actor_user_id) or exists(
 select 1 from public.profiles profile join auth.users identity on identity.id=profile.id
 where profile.id=actor_user_id and profile.active=false and profile.role::text='DRIVER'
  and identity.email_confirmed_at is not null and identity.deleted_at is null
  and (identity.banned_until is null or identity.banned_until<=now())
  and nullif(trim(coalesce(identity.email,'')),'') is not null
  and nullif(trim(coalesce(identity.raw_app_meta_data->>'role','')),'') is null
  and nullif(trim(coalesce(identity.raw_app_meta_data->>'provisioned_by','')),'') is null
  and not exists(select 1 from public.applications record where record.user_id=profile.id)
  and not exists(select 1 from public.provider_profiles record where record.user_id=profile.id)
  and not exists(select 1 from public.organization_members record where record.user_id=profile.id)
  and not exists(select 1 from public.drivers record where record.user_id=profile.id)
  and not exists(select 1 from public.driver_permissions record where record.user_id=profile.id)
  and not exists(select 1 from public.driver_vehicle_assignments record where record.driver_user_id=profile.id)
  and not exists(select 1 from public.support_agent_profiles record where record.user_id=profile.id))
$$;
do $provisioning$
declare definition text;anchor text:='if not found or actor.active';backup_name text:='public.complete_provider_signup_pre_business160';
begin
 definition:=pg_get_functiondef('public.complete_provider_signup(uuid,text)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'BUSINESS_PROVIDER_PROVISIONING_DRIFT'; end if;
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.complete_provider_signup(', 'CREATE OR REPLACE FUNCTION '||backup_name||'(');
 execute 'revoke all on function '||backup_name||'(uuid,text) from public,anon,authenticated,service_role';
 execute replace(definition,anchor,'if not found or (actor.active and not public.business_provider_signup_eligible(actor_user_id))');
end $provisioning$;
do $private_account_details$
declare definition text;anchor text:=$old$if not found or not actor.active or actor.role not in ('TRANSPORTER','DRIVER','ADMIN') then$old$;
begin
 definition:=pg_get_functiondef('public.update_own_account_details(uuid,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'BUSINESS_ACCOUNT_DETAILS_DRIFT'; end if;
 execute replace(definition,'CREATE OR REPLACE FUNCTION public.update_own_account_details(','CREATE OR REPLACE FUNCTION public.update_own_account_details_pre_business160(');
 execute 'revoke all on function public.update_own_account_details_pre_business160(uuid,jsonb) from public,anon,authenticated,service_role';
 execute replace(definition,anchor,$new$if not found or not actor.active or (actor.role not in ('TRANSPORTER','DRIVER','ADMIN') and not exists(
 select 1 from public.business_workspace_members m where m.user_id=actor.id and public.business_workspace_permission(actor.id,m.workspace_id,'ACCESS'))) then$new$);
end $private_account_details$;
create or replace function public.complete_eligible_provider_signup(actor_user_id uuid,requested_token_digest text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 perform 1 from public.profiles p where p.id=actor_user_id for update;
 perform 1 from auth.users u where u.id=actor_user_id for update;
 if not public.managed_provider_signup_eligible(actor_user_id) then raise exception 'SIGNUP_NOT_AVAILABLE'; end if;
 if public.business_provider_signup_eligible(actor_user_id) then perform public.require_content_policy(actor_user_id); end if;
 return public.complete_provider_signup(actor_user_id,requested_token_digest);
end $$;

-- The existing erasure flow retains a profile stub rather than deleting it.
-- Preserve all fleet/GPS/unfinished-Tracking holds and add customer offboarding
-- before claiming erasure is complete. Historical membership permits deleting
-- one's own inactive customer account; it never grants data/workspace access.
create function public.business_account_subject(subject_user_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select exists(select 1 from public.profiles p where p.id=subject_user_id and p.role::text='SHIPPER'
  and exists(select 1 from public.business_workspace_members m where m.user_id=p.id))
$$;
create function public.business_account_owner_hold(subject_user_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select exists(select 1 from public.business_workspace_members m join public.business_workspaces w on w.id=m.workspace_id
  where m.user_id=subject_user_id and m.active and m.role='OWNER' and w.active
   and not exists(select 1 from public.business_workspace_members other
    where other.workspace_id=m.workspace_id and other.user_id<>subject_user_id and other.active and other.role='OWNER' and public.business_customer_identity(other.user_id,false)))
$$;
create function public.business_account_lock(subject_user_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
begin
 perform 1 from public.business_workspaces w where exists(select 1 from public.business_workspace_members m where m.workspace_id=w.id and m.user_id=subject_user_id)
  order by w.id for update;
end $$;
create function public.business_account_offboard(subject_user_id uuid,erase_contact boolean default false) returns void
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare subject_email text;
begin
 perform public.business_account_lock(subject_user_id);
 if public.business_account_owner_hold(subject_user_id) then raise exception 'BUSINESS_OWNER_HANDOVER_REQUIRED'; end if;
 select lower(trim(p.email)) into subject_email from public.profiles p where p.id=subject_user_id;
 update public.business_workspaces w set version=version+1,updated_at=now() where exists(
  select 1 from public.business_workspace_members m where m.workspace_id=w.id and m.user_id=subject_user_id and m.active);
 update public.business_workspace_members set active=false,revision=revision+1,updated_at=now() where user_id=subject_user_id and active;
 delete from public.business_workspace_selections s where s.actor_user_id=subject_user_id;
 update public.business_workspace_invitations i set status=case when i.status='PENDING' then 'REVOKED' else i.status end,
  revoked_at=case when i.status='PENDING' then now() else i.revoked_at end,email_lease=null,email_lease_actor=null,email_lease_until=null
  where i.created_by=subject_user_id or i.accepted_by=subject_user_id or i.email=subject_email;
 if erase_contact then
  update public.business_workspace_invitations i set email='deleted-'||i.id::text||'@removed.invalid'
   where i.accepted_by=subject_user_id or i.email=subject_email;
 end if;
end $$;
do $erasure_adapters$
declare signature text;name text;definition text;anchor text;
begin
 foreach signature in array array['public.prepare_account_erasure(uuid,uuid)','public.finish_account_erasure(uuid,uuid)',
  'public.account_deactivation_blockers(uuid)','public.deactivate_own_account(uuid,text)'] loop
  name:=split_part(split_part(signature,'(',1),'.',2);definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||name||'_pre_business160(');
  definition:=replace(definition,name||'.',name||'_pre_business160.');
  execute definition;
  execute format('revoke all on function public.%s_pre_business160%s from public,anon,authenticated,service_role',name,substring(signature from position('(' in signature)));
 end loop;
 -- The existing GPS wrapper calls this fleet-safe base implementation. Clone it
 -- for customer subjects; retain every shipment/fleet/file/privacy invariant.
 definition:=pg_get_functiondef('public.prepare_account_erasure_pre_privacy154(uuid,uuid)'::regprocedure);
 anchor:=$old$if subject.role not in ('TRANSPORTER','DRIVER') then$old$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'BUSINESS_ERASURE_SUBJECT_DRIFT'; end if;
 definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.prepare_account_erasure_pre_privacy154(','CREATE OR REPLACE FUNCTION public.prepare_account_erasure_customer160(');
 definition:=replace(definition,'prepare_account_erasure_pre_privacy154.','prepare_account_erasure_customer160.');
 execute replace(definition,anchor,$new$if subject.role not in ('TRANSPORTER','DRIVER') and not public.business_account_subject(subject.id) then$new$);
 execute 'revoke all on function public.prepare_account_erasure_customer160(uuid,uuid) from public,anon,authenticated,service_role';
 -- Deactivation also retains the current provider blockers and confirmation.
 foreach name in array array['account_deactivation_blockers','deactivate_own_account'] loop
  signature:=case when name='account_deactivation_blockers' then 'public.account_deactivation_blockers_pre_business160(uuid)' else 'public.deactivate_own_account_pre_privacy154(uuid,text)' end;
  definition:=pg_get_functiondef(signature::regprocedure);
  anchor:=$old$role in ('TRANSPORTER','DRIVER')$old$;
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'BUSINESS_DEACTIVATION_SUBJECT_DRIFT'; end if;
  definition:=replace(definition,'CREATE OR REPLACE FUNCTION '||split_part(signature,'(',1)||'(','CREATE OR REPLACE FUNCTION public.'||name||'_customer160(');
  definition:=replace(definition,split_part(split_part(signature,'(',1),'.',2)||'.',name||'_customer160.');
  execute replace(definition,anchor,$new$(role in ('TRANSPORTER','DRIVER') or public.business_account_subject(actor_user_id))$new$);
  execute format('revoke all on function public.%s_customer160%s from public,anon,authenticated,service_role',name,substring(signature from position('(' in signature)));
 end loop;
 signature:='public.request_account_deletion(uuid)';definition:=pg_get_functiondef(signature::regprocedure);
 anchor:=$old$role in ('TRANSPORTER','DRIVER')$old$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'BUSINESS_DELETION_REQUEST_DRIFT'; end if;
 execute replace(definition,anchor,$new$(role in ('TRANSPORTER','DRIVER') or public.business_account_subject(actor_user_id))$new$);
end $erasure_adapters$;

create or replace function public.prepare_account_erasure(actor_user_id uuid,target_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare request public.account_deletion_requests;result jsonb;
begin
 if not exists(select 1 from public.profiles p where p.id=actor_user_id and p.active and p.role::text='ADMIN') then raise exception 'FORBIDDEN'; end if;
 select * into request from public.account_deletion_requests where id=target_request_id;
 if not found then raise exception 'NOT_FOUND'; end if;
 if request.status='COMPLETED' then return public.account_deletion_status(request.subject_user_id); end if;
 perform public.business_account_lock(request.subject_user_id);
 if public.business_account_owner_hold(request.subject_user_id) then
  update public.account_deletion_requests set status='HELD',retention_reason='Transfer ownership of your business or archive it before deleting your account.',
   review_after=clock_timestamp()+interval '7 days',reviewed_by=actor_user_id where id=request.id;
  return jsonb_build_object('status','HELD');
 end if;
 if public.business_account_subject(request.subject_user_id) then
  result:=public.prepare_account_erasure_customer160(actor_user_id,target_request_id);
  if result->>'status'='ERASING' then perform public.queue_telematics_account_privacy(request.subject_user_id,target_request_id,'ERASE'); end if;
 else result:=public.prepare_account_erasure_pre_business160(actor_user_id,target_request_id); end if;
 if result->>'status'='ERASING' then perform public.business_account_offboard(request.subject_user_id,false); end if;
 return result;
end $$;
create or replace function public.finish_account_erasure(actor_user_id uuid,target_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare subject_id uuid;subject_email text;result jsonb;
begin
 select r.subject_user_id,p.email into subject_id,subject_email from public.account_deletion_requests r join public.profiles p on p.id=r.subject_user_id where r.id=target_request_id;
 if subject_id is null then raise exception 'NOT_FOUND'; end if;
 perform public.business_account_lock(subject_id);
 -- Delegate before cleanup: no business privacy claim bypasses GPS verification.
 result:=public.finish_account_erasure_pre_business160(actor_user_id,target_request_id);
 if result->>'status'='COMPLETED' then
  perform public.business_account_offboard(subject_id,true);
  update public.business_workspace_invitations i set email='deleted-'||i.id::text||'@removed.invalid' where i.email=lower(trim(subject_email));
 end if;
 return result;
end $$;
create or replace function public.account_deactivation_blockers(actor_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare result jsonb;
begin
 if public.business_account_subject(actor_user_id) then result:=public.account_deactivation_blockers_customer160(actor_user_id);
 else result:=public.account_deactivation_blockers_pre_business160(actor_user_id); end if;
 if public.business_account_owner_hold(actor_user_id) then result:=result||'"BUSINESS_OWNER_HANDOVER_REQUIRED"'::jsonb; end if;
 return result;
end $$;
create or replace function public.deactivate_own_account(actor_user_id uuid,confirmation text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare result jsonb;
begin
 perform public.business_account_lock(actor_user_id);
 if public.business_account_owner_hold(actor_user_id) then raise exception 'BUSINESS_OWNER_HANDOVER_REQUIRED'; end if;
 if public.business_account_subject(actor_user_id) then
  result:=public.deactivate_own_account_customer160(actor_user_id,confirmation);
  perform public.queue_telematics_account_privacy(actor_user_id,null,'DISABLE');
 else result:=public.deactivate_own_account_pre_business160(actor_user_id,confirmation); end if;
 perform public.business_account_offboard(actor_user_id,false);
 return result;
end $$;

revoke all on function public.business_customer_identity(uuid,boolean),public.business_workspace_permission(uuid,uuid,text),
 public.business_prepare_identity(uuid),public.business_workspace_summary(uuid,uuid),public.business_workspace_context(uuid),
 public.business_workspace_create(uuid,jsonb),public.business_workspace_select(uuid,uuid),public.business_workspace_directory(uuid,uuid),
 public.business_workspace_search(uuid,text,integer),public.business_workspace_command(uuid,uuid,jsonb),
 public.business_workspace_accept_invitation(uuid,uuid),public.business_workspace_claim_invitation_email(uuid,uuid,uuid),
 public.business_workspace_record_invitation_email(uuid,uuid,uuid,uuid,boolean),public.business_account_delete_guard(),
 public.business_provider_signup_eligible(uuid),public.business_account_subject(uuid),public.business_account_owner_hold(uuid),
 public.business_account_lock(uuid),public.business_account_offboard(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.business_workspace_permission(uuid,uuid,text),public.business_workspace_context(uuid),
 public.business_workspace_create(uuid,jsonb),public.business_workspace_select(uuid,uuid),public.business_workspace_directory(uuid,uuid),
 public.business_workspace_search(uuid,text,integer),public.business_workspace_command(uuid,uuid,jsonb),
 public.business_workspace_accept_invitation(uuid,uuid),public.business_workspace_claim_invitation_email(uuid,uuid,uuid),
 public.business_workspace_record_invitation_email(uuid,uuid,uuid,uuid,boolean) to service_role;
revoke all on function public.support_member_actor(uuid),public.support_actor_can_read(uuid,uuid),public.accept_content_policy(uuid,text),public.require_content_policy(uuid) from public,anon,authenticated;
grant execute on function public.accept_content_policy(uuid,text),public.require_content_policy(uuid) to service_role;
revoke all on function public.managed_provider_signup_eligible(uuid),public.complete_eligible_provider_signup(uuid,text) from public,anon,authenticated;
grant execute on function public.business_provider_signup_eligible(uuid),public.managed_provider_signup_eligible(uuid),public.complete_eligible_provider_signup(uuid,text) to service_role;
comment on table public.business_workspaces is 'Customer business identity only; no provider/fleet/global platform authority or billing entitlement.';
comment on function public.business_workspace_permission(uuid,uuid,text) is 'Current verified actor + exact active workspace/member; independent resource/location grants remain required.';
commit;
