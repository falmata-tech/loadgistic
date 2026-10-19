-- FEAT-PLY-001 / FEAT-ENT-001: normal business flows for synthetic Play
-- reviewers, with a durable boundary from real business accounts and shares.
begin;
select pg_advisory_xact_lock(8030176);
set local lock_timeout='5s';
set local statement_timeout='30s';

alter table public.business_workspaces add column review_workspace boolean not null default false;

create function public.business_review_identity(actor_user_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select exists(select 1 from public.app_review_accounts r where r.user_id=actor_user_id)
$$;
revoke all on function public.business_review_identity(uuid) from public,anon,authenticated,service_role;

create function public.business_review_email(target_email text) returns boolean
language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select exists(select 1 from auth.users u join public.app_review_accounts r on r.user_id=u.id
  where lower(trim(u.email))=lower(trim(target_email)))
$$;
create function public.business_vehicle_review_scope(target_vehicle_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(o.review_workspace,p.review_workspace) from public.vehicles v
 left join public.organizations o on o.id=v.organization_id
 left join public.provider_profiles p on p.id=v.provider_profile_id where v.id=target_vehicle_id
$$;
create function public.business_shipment_review_scope(target_shipment_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select case when coalesce(o.review_workspace,p.review_workspace)
   =public.business_vehicle_review_scope(s.assigned_vehicle_id)
  then coalesce(o.review_workspace,p.review_workspace) else null end
 from public.provider_shipments s
 left join public.organizations o on o.id=s.provider_organization_id
 left join public.provider_profiles p on p.id=s.provider_profile_id where s.id=target_shipment_id
$$;
revoke all on function public.business_review_email(text),public.business_vehicle_review_scope(uuid),
 public.business_shipment_review_scope(uuid) from public,anon,authenticated,service_role;

-- A disabled/deleted review login cannot become a real customer's member merely
-- because the current sign-in is unavailable. The durable registration decides.
do $preflight$
begin
 if exists(select 1 from public.business_workspace_members m join public.app_review_accounts r on r.user_id=m.user_id)
 or exists(select 1 from public.business_workspace_invitations i join auth.users u on lower(trim(u.email))=i.email
  join public.app_review_accounts r on r.user_id=u.id)
 or exists(select 1 from public.business_capacity_grants g join public.app_review_accounts r on r.user_id=g.created_by)
 or exists(select 1 from public.business_capacity_grants g
  where public.business_vehicle_review_scope(g.vehicle_id) is distinct from false)
 or exists(select 1 from public.capacity_access_grants g where g.audience_type='EMAIL'
  and (public.business_review_email(g.recipient_email)
   or exists(select 1 from public.app_review_accounts r where r.capacity_digest=g.recipient_email_digest))
  and public.business_vehicle_review_scope(g.vehicle_id) is distinct from true)
 or exists(select 1 from public.provider_tracking_recipients r
  where (public.business_review_email(r.recipient_email)
   or exists(select 1 from public.app_review_accounts a where a.tracking_digest=r.recipient_email_digest))
  and public.business_shipment_review_scope(r.shipment_id) is distinct from true)
 or exists(select 1 from public.tracking_sharing_controls c where c.business_workspace_id is not null
  and public.business_shipment_review_scope(c.shipment_id) is distinct from
   (select w.review_workspace from public.business_workspaces w where w.id=c.business_workspace_id))
 then raise exception 'REVIEW_BUSINESS_PREFLIGHT_REQUIRED';end if;
end $preflight$;

create or replace function public.business_workspace_permission(actor_user_id uuid,target_workspace_id uuid,required_permission text default 'ACCESS')
returns boolean language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select public.business_customer_identity(actor_user_id,false) and exists(
  select 1 from public.business_workspace_members m join public.business_workspaces w on w.id=m.workspace_id
  where m.user_id=actor_user_id and m.workspace_id=target_workspace_id and m.active and w.active
   and w.review_workspace=public.business_review_identity(actor_user_id)
   and case required_permission when 'ACCESS' then true
    when 'CAPACITY' then m.can_view_capacity when 'TRACKING' then m.can_view_tracking
    when 'TEAM' then m.role in('OWNER','ADMIN') when 'OWNER' then m.role='OWNER' else false end)
$$;

create function public.guard_business_review_membership() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare review_business boolean;
begin
 select w.review_workspace into review_business from public.business_workspaces w where w.id=new.workspace_id;
 if review_business is distinct from public.business_review_identity(new.user_id) then
  raise exception 'REVIEW_WORKSPACE_ONLY';
 end if;
 return new;
end $$;
create trigger guard_business_review_membership before insert or update on public.business_workspace_members
 for each row execute function public.guard_business_review_membership();

create function public.guard_business_review_invitation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare review_business boolean;review_invitee boolean;
begin
 select w.review_workspace into review_business from public.business_workspaces w where w.id=new.workspace_id;
 select exists(select 1 from auth.users u join public.app_review_accounts r on r.user_id=u.id
  where lower(trim(u.email))=new.email) into review_invitee;
 if review_business is distinct from review_invitee then raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 return new;
end $$;
create trigger guard_business_review_invitation before insert or update of workspace_id,email on public.business_workspace_invitations
 for each row execute function public.guard_business_review_invitation();

create function public.keep_business_review_scope() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.review_workspace is distinct from old.review_workspace then raise exception 'REVIEW_SCOPE_IMMUTABLE';end if;
 return new;
end $$;
create trigger keep_business_review_scope before update of review_workspace on public.business_workspaces
 for each row execute function public.keep_business_review_scope();

create or replace function public.business_workspace_context(actor_user_id uuid) returns jsonb
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
 where w.active and w.review_workspace=public.business_review_identity(actor_user_id)
  and i.email=verified_email and i.status='PENDING' and i.expires_at>now();
 return jsonb_build_object('actorId',actor_user_id,'selectedWorkspaceId',chosen,'workspaces',contexts,'invitations',invitations);
end $$;

create or replace function public.business_workspace_create(actor_user_id uuid,command jsonb) returns jsonb
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
 insert into public.business_workspaces(name,handle,kind,city,review_workspace)
 values(label,slug,kind_value,city_value,public.business_review_identity(actor_user_id)) returning id into workspace;
 insert into public.business_workspace_members(workspace_id,user_id,role,can_view_capacity,can_view_tracking) values(workspace,actor_user_id,'OWNER',true,true);
 insert into public.business_workspace_selections(actor_user_id,workspace_id) values(actor_user_id,workspace)
  on conflict on constraint business_workspace_selections_pkey do update set workspace_id=excluded.workspace_id,updated_at=now();
 insert into public.business_workspace_audit(workspace_id,actor_user_id,action) values(workspace,actor_user_id,'CREATED');
 return public.business_workspace_summary(actor_user_id,workspace);
exception when unique_violation then raise exception 'BUSINESS_HANDLE_UNAVAILABLE';
end $$;

create or replace function public.business_workspace_search(actor_user_id uuid,search_text text,requested_limit integer default 10) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
#variable_conflict use_variable
declare needle text:=lower(trim(search_text)); result jsonb;
begin
 if not public.business_customer_identity(actor_user_id,false) then raise exception 'BUSINESS_IDENTITY_REQUIRED'; end if;
 if needle is null or length(needle)<2 or length(needle)>80 then return '[]'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'handle',r.handle,'kind',r.kind,'city',r.city) order by r.rank,r.name,r.id),'[]') into result
 from(select w.*,case when lower(w.handle)=needle then 0 when starts_with(lower(w.name),needle) then 1 else 2 end rank
  from public.business_workspaces w where w.active and w.review_workspace=public.business_review_identity(actor_user_id)
   and (strpos(lower(w.name),needle)>0 or strpos(w.handle,needle)>0)
  order by rank,w.name,w.id limit greatest(1,least(coalesce(requested_limit,10),20))) r;
 return result;
end $$;

create or replace function public.provider_business_directory(actor_user_id uuid,search_text text default '',requested_offset integer default 0,requested_limit integer default 12)
returns table(payload jsonb,total_count bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare query text:=lower(trim(coalesce(search_text,'')));
begin
 if not public.business_directory_provider(actor_user_id) then raise exception 'FORBIDDEN';end if;
 if char_length(query)>120 or requested_offset not between 0 and 100000 or requested_limit not between 1 and 30 then raise exception 'INVALID_BUSINESS_INPUT';end if;
 return query with visible as(
  select w.id,w.name,w.handle,w.kind,w.city,nullif(trim(p.first_name),'') as manager_name
  from business_workspaces w join profiles p on p.id=public.business_directory_manager(w.id)
  where w.active and w.review_workspace=public.business_review_identity(actor_user_id)
 ), matched as(
  select v.*,count(*) over() as row_total,
   case when lower(v.handle)=ltrim(query,'@') then 0 when lower(v.name)=query then 1
    when starts_with(lower(v.handle),ltrim(query,'@')) then 2 else 3 end as rank
  from visible v where query='' or not exists(
   select 1 from regexp_split_to_table(query,'[[:space:]]+') token
   where strpos(lower(concat_ws(' ',v.name,'@'||v.handle,v.manager_name)),token)=0)
 ) select jsonb_build_object('id',m.id,'name',m.name,'handle',m.handle,'kind',m.kind,
  'city',m.city,'managerName',m.manager_name,'documents',public.business_document_badges(m.id)),m.row_total
 from matched m order by m.rank,lower(m.name),m.id offset requested_offset limit requested_limit;
end $$;

-- The recipient chooser is not the final authority; a guessed business UUID
-- must not cross the sample/real boundary when a vehicle grant is saved.
create function public.guard_business_review_capacity_grant() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare review_business boolean;review_vehicle boolean;
begin
 select w.review_workspace into review_business from public.business_workspaces w where w.id=new.workspace_id;
 review_vehicle:=public.business_vehicle_review_scope(new.vehicle_id);
 if review_business is distinct from public.business_review_identity(new.created_by)
  or review_business is distinct from review_vehicle then raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 return new;
end $$;
create trigger guard_business_review_capacity_grant before insert or update on public.business_capacity_grants
 for each row execute function public.guard_business_review_capacity_grant();

-- A synthetic login is not a valid audience for a real provider's email
-- grant, and a review provider may send new sample shares only to another
-- registered synthetic reviewer. Existing demo aliases are left unchanged.
create function public.guard_review_email_share() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare source_review boolean;email_review boolean;digest_review boolean;
begin
 if tg_table_name='capacity_access_grants' then
  if new.audience_type<>'EMAIL' then return new;end if;
  source_review:=public.business_vehicle_review_scope(new.vehicle_id);
  digest_review:=exists(select 1 from public.app_review_accounts a where a.capacity_digest=new.recipient_email_digest);
 else
  source_review:=public.business_shipment_review_scope(new.shipment_id);
  digest_review:=exists(select 1 from public.app_review_accounts a where a.tracking_digest=new.recipient_email_digest);
 end if;
 email_review:=public.business_review_email(new.recipient_email);
 if source_review is null or (source_review and not email_review)
  or (not source_review and (email_review or digest_review)) then raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 return new;
end $$;
create trigger guard_review_capacity_email before insert or update of vehicle_id,audience_type,recipient_email,recipient_email_digest
 on public.capacity_access_grants for each row execute function public.guard_review_email_share();
create trigger guard_review_tracking_recipient before insert or update of shipment_id,recipient_email,recipient_email_digest
 on public.provider_tracking_recipients for each row execute function public.guard_review_email_share();

-- The same boundary must hold if a login is registered for Play review after
-- ordinary private shares were created. Do not silently reclassify its inbox.
create function public.guard_review_account_registration() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare review_email text;new_registration boolean;
begin
 select lower(trim(u.email)) into review_email from auth.users u where u.id=new.user_id;
 if tg_op='INSERT' then new_registration:=true;
 else new_registration:=new.user_id is distinct from old.user_id;end if;
 if (new_registration and (exists(select 1 from public.business_workspace_members m where m.user_id=new.user_id)
    or exists(select 1 from public.business_workspace_invitations i where i.email=review_email)))
  or exists(select 1 from public.capacity_access_grants g where g.audience_type='EMAIL'
   and (g.recipient_email=review_email or g.recipient_email_digest=new.capacity_digest)
   and public.business_vehicle_review_scope(g.vehicle_id) is distinct from true)
  or exists(select 1 from public.provider_tracking_recipients r
   where (r.recipient_email=review_email or r.recipient_email_digest=new.tracking_digest)
    and public.business_shipment_review_scope(r.shipment_id) is distinct from true) then
  raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 return new;
end $$;
create trigger guard_review_account_registration before insert or update of user_id,capacity_digest,tracking_digest
 on public.app_review_accounts for each row execute function public.guard_review_account_registration();

-- A synthetic business cannot attach a real agreement even if its registered
-- email was selected as the agreement owner before this release. Every read
-- repeats the same check, including the staff-list and direct-detail paths.
create function public.guard_review_tracking_business() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare target_review boolean;
begin
 if new.business_workspace_id is null then return new;end if;
 select w.review_workspace into target_review from public.business_workspaces w where w.id=new.business_workspace_id;
 if target_review is distinct from public.business_shipment_review_scope(new.shipment_id)
  or target_review is distinct from public.business_review_identity(new.owner_actor_id) then
  raise exception 'REVIEW_WORKSPACE_ONLY';end if;
 return new;
end $$;
create trigger guard_review_tracking_business before insert or update of shipment_id,business_workspace_id,owner_actor_id
 on public.tracking_sharing_controls for each row execute function public.guard_review_tracking_business();
create or replace function public.tracking_business_share_active(target_shipment_id uuid,target_workspace_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from tracking_sharing_controls c join provider_tracking_recipients r on r.id=c.owner_recipient_id
  join provider_shipments s on s.id=c.shipment_id join shipment_party_grants g on g.shipment_id=s.id and g.party_role='SHIPPER'
  join business_workspaces w on w.id=c.business_workspace_id
  where c.shipment_id=target_shipment_id and c.business_workspace_id=target_workspace_id and r.shipment_id=s.id and r.recipient_role='OWNER'
   and w.review_workspace=public.business_shipment_review_scope(s.id)
   and r.revoked_at is null and g.revoked_at is null and(g.expires_at is null or g.expires_at>clock_timestamp())
   and(s.guest_expires_at is null or s.guest_expires_at>clock_timestamp())
   and public.tracking_owner_is_member_identity(c.owner_actor_id,r.id)
   and public.business_workspace_permission(c.owner_actor_id,target_workspace_id,'TRACKING'))
$$;

-- The business feed combines team grants and grants addressed to the signed-in
-- member's email. Scope both branches so the latter cannot bypass isolation.
do $capacity_projection$
declare definition text;team_anchor text;email_anchor text;
begin
 definition:=pg_get_functiondef('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure);
 team_anchor:='and public.capacity_sharing_mode(g.vehicle_id) in (''PRIVATE'',''BOTH'')';
 email_anchor:='and public.capacity_sharing_allows(g.vehicle_id,''EMAIL'',g.recipient_email_digest)';
 if (length(definition)-length(replace(definition,team_anchor,'')))/length(team_anchor)<>1
  or (length(definition)-length(replace(definition,email_anchor,'')))/length(email_anchor)<>1 then
  raise exception 'BUSINESS_CAPACITY_REVIEW_PROJECTION_DRIFT';end if;
 definition:=replace(definition,team_anchor,team_anchor||E'\n       and public.business_vehicle_review_scope(g.vehicle_id)=public.business_review_identity(actor_user_id)');
 definition:=replace(definition,email_anchor,email_anchor||E'\n       and public.business_vehicle_review_scope(g.vehicle_id)=public.business_review_identity(actor_user_id)');
 execute definition;
end $capacity_projection$;

revoke all on function public.guard_business_review_membership(),public.guard_business_review_invitation(),
 public.keep_business_review_scope(),public.guard_business_review_capacity_grant(),public.guard_review_email_share(),
 public.guard_review_tracking_business(),public.guard_review_account_registration() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
