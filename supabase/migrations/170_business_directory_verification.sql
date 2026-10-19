-- FEAT-ENT/VER-001. Provider-only company discovery and optional private proofs.
begin;
select pg_advisory_xact_lock(8030170);
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.business_verification_contexts(
 request_id uuid primary key references public.verification_requests(id) on delete cascade,
 workspace_id uuid not null references public.business_workspaces(id),
 manager_user_id uuid references public.profiles(id) on delete set null,
 identity_digest text not null check(identity_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
alter table public.business_verification_contexts enable row level security;
revoke all on public.business_verification_contexts from public,anon,authenticated,service_role;
create index business_verification_workspace_idx on public.business_verification_contexts(workspace_id,request_id);

create function public.business_directory_provider(actor_user_id uuid) returns boolean
language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare scope record;
begin
 if not exists(select 1 from profiles p join auth.users u on u.id=p.id
  where p.id=actor_user_id and p.active and p.role::text in('DRIVER','TRANSPORTER')
  and u.email_confirmed_at is not null and u.deleted_at is null
  and(u.banned_until is null or u.banned_until<=now())) then return false;end if;
 select * into scope from public.provider_capacity_actor_scope(actor_user_id);
 return found and coalesce(scope.workspace_access,false);
end $$;

create function public.business_directory_manager(target_workspace_id uuid) returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
 select m.user_id from business_workspace_members m
 where m.workspace_id=target_workspace_id and m.role='OWNER' and m.active
 and public.business_workspace_permission(m.user_id,target_workspace_id,'OWNER')
 order by m.user_id limit 1
$$;
create function public.business_document_identity(target_workspace_id uuid,document_type text) returns text
language sql stable security definer set search_path=public,pg_temp as $$
 select encode(sha256(convert_to(jsonb_build_object('workspace',w.id,'type',document_type,
  'name',case when document_type<>'IDENTITY' then w.name end,
  'city',case when document_type='BUSINESS_ADDRESS' then w.city end,
  'manager',case when document_type='IDENTITY' then p.id end,
  'first',case when document_type='IDENTITY' then p.first_name end,
  'last',case when document_type='IDENTITY' then p.last_name end)::text,'UTF8')),'hex')
 from business_workspaces w join profiles p on p.id=public.business_directory_manager(w.id)
 where w.id=target_workspace_id and w.active
$$;
create function public.business_document_badges(target_workspace_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('type',kind,'verified',r.id is not null,
  'expired',false,'reviewedAt',r.reviewed_at,'expiresOn',r.expires_on) order by position),'[]'::jsonb)
 from unnest(array['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']) with ordinality types(kind,position)
 left join lateral(select v.id,v.reviewed_at,v.expires_on from verification_requests v
  join business_verification_contexts c on c.request_id=v.id
  where v.subject_type='BUSINESS_WORKSPACE' and v.subject_id=target_workspace_id
   and v.verification_type::text=types.kind and v.status='APPROVED'
   and(v.expires_on is null or v.expires_on>=current_date)
   and c.workspace_id=target_workspace_id
   and c.identity_digest=public.business_document_identity(target_workspace_id,types.kind)
  order by v.reviewed_at desc,v.id desc limit 1) r on true
$$;

create function public.provider_business_directory(actor_user_id uuid,search_text text default '',requested_offset integer default 0,requested_limit integer default 12)
returns table(payload jsonb,total_count bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare query text:=lower(trim(coalesce(search_text,'')));
begin
 if not public.business_directory_provider(actor_user_id) then raise exception 'FORBIDDEN';end if;
 if char_length(query)>120 or requested_offset not between 0 and 100000 or requested_limit not between 1 and 30 then raise exception 'INVALID_BUSINESS_INPUT';end if;
 return query with visible as(
  select w.id,w.name,w.handle,w.kind,w.city,nullif(trim(p.first_name),'') as manager_name
  from business_workspaces w join profiles p on p.id=public.business_directory_manager(w.id)
  where w.active
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

create function public.business_verification_center(actor_user_id uuid,target_workspace_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare owner_access boolean;workspace business_workspaces%rowtype;manager uuid;subjects jsonb:='[]';requests jsonb:='[]';approved jsonb;
begin
 if not public.business_workspace_permission(actor_user_id,target_workspace_id,'ACCESS') then raise exception 'FORBIDDEN';end if;
 select * into workspace from business_workspaces where id=target_workspace_id;
 manager:=public.business_directory_manager(target_workspace_id);
 owner_access:=public.business_workspace_permission(actor_user_id,target_workspace_id,'OWNER');
 if owner_access then
  select coalesce(jsonb_agg(jsonb_build_object('verification_type',r.verification_type,'reviewed_at',r.reviewed_at,'expires_on',r.expires_on,'related_vehicle_id',null)),'[]')
  into approved from verification_requests r join business_verification_contexts c on c.request_id=r.id
  where r.subject_type='BUSINESS_WORKSPACE' and r.subject_id=target_workspace_id and r.status='APPROVED'
   and(r.expires_on is null or r.expires_on>=current_date)
   and c.identity_digest=public.business_document_identity(target_workspace_id,r.verification_type::text);
  subjects:=jsonb_build_array(jsonb_build_object('subject_type','BUSINESS_WORKSPACE','subject_id',workspace.id,
   'name',workspace.name,'type','Business account','verification_types',jsonb_build_array('IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'),
   'vehicles','[]'::jsonb,'approved_documents',approved));
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'subject_type',r.subject_type,'subject_id',r.subject_id,
   'verification_type',r.verification_type,'status',r.status,'document_name',r.document_name,
   'submitted_at',r.submitted_at,'reviewed_at',r.reviewed_at,'expires_on',r.expires_on,
   'review_note',r.review_note,'has_file',r.storage_path is not null,
   'stale',c.identity_digest is distinct from public.business_document_identity(target_workspace_id,r.verification_type::text)) order by r.submitted_at desc,r.id),'[]')
  into requests from verification_requests r join business_verification_contexts c on c.request_id=r.id
  where r.subject_type='BUSINESS_WORKSPACE' and r.subject_id=target_workspace_id
   and(r.verification_type<>'IDENTITY' or c.manager_user_id=actor_user_id);
 end if;
 return jsonb_build_object('workspaceId',workspace.id,'name',workspace.name,'handle',workspace.handle,
  'managerName',(select nullif(trim(first_name),'') from profiles where id=manager),
  'canManage',owner_access,'documents',public.business_document_badges(target_workspace_id),'subjects',subjects,'requests',requests);
end $$;

-- Retain exact installed provider/file/review and erasure implementations as
-- private delegates. No old unchecked RPC becomes a second execution path.
do $copies$
declare item record;definition text;signature text;
begin
 for item in select * from(values
  ('submit_managed_verification','ver_submit_pre170','uuid,jsonb'),
  ('managed_verification_file','ver_file_pre170','uuid,uuid'),
  ('review_managed_verification','ver_review_pre170','uuid,uuid,text,text'),
  ('prepare_account_erasure','erase_prepare_pre170','uuid,uuid'),
  ('finish_account_erasure','erase_finish_pre170','uuid,uuid')) x(old_name,new_name,arguments) loop
  signature:='public.'||item.old_name||'('||item.arguments||')';
  if to_regprocedure('public.'||item.new_name||'('||item.arguments||')') is not null then raise exception 'BUSINESS_VERIFICATION_COPY_EXISTS';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||item.old_name||'(','CREATE OR REPLACE FUNCTION public.'||item.new_name||'(');
  definition:=replace(definition,item.old_name||'.',item.new_name||'.');
  execute definition;
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',item.new_name,item.arguments);
 end loop;
end $copies$;

create or replace function public.submit_managed_verification(actor_user_id uuid,command jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_business_id uuid;kind text;source_name text;path text;original text;mime text;expiry date;
 request_uuid uuid:=gen_random_uuid();identity_value text;manager uuid;
begin
 if command->>'subject_type' is distinct from 'BUSINESS_WORKSPACE' then return public.ver_submit_pre170(actor_user_id,command);end if;
 begin target_business_id:=(command->>'subject_id')::uuid;expiry:=nullif(command->>'expires_on','')::date;
 exception when others then raise exception 'INVALID_VERIFICATION_TYPE';end;
 perform 1 from business_workspaces where id=target_business_id and active for update;
 if not found or not public.business_workspace_permission(actor_user_id,target_business_id,'OWNER') then raise exception 'FORBIDDEN';end if;
 kind:=command->>'verification_type';
 if kind not in('IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS') or kind is null
  or nullif(command->>'related_vehicle_id','') is not null then raise exception 'INVALID_VERIFICATION_TYPE';end if;
 manager:=public.business_directory_manager(target_business_id);
 perform 1 from profiles where id=manager for update;
 if kind='IDENTITY' and not exists(select 1 from profiles where id=manager and nullif(trim(first_name),'') is not null) then raise exception 'BUSINESS_MANAGER_NAME_REQUIRED';end if;
 source_name:=trim(coalesce(command->>'document_name',''));path:=coalesce(command->>'storage_path','');
 original:=trim(coalesce(command->>'original_name',''));mime:=command->>'mime_type';
 if char_length(source_name) not between 1 and 160 or path!~'^supabase://verification/verification/'
  or char_length(original) not between 1 and 160 or mime not in('image/jpeg','image/png','image/webp','application/pdf')
  or mime is null or expiry<current_date then raise exception 'VERIFICATION_DOCUMENT_REQUIRED';end if;
 identity_value:=public.business_document_identity(target_business_id,kind);
 if identity_value is null then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from verification_requests r join business_verification_contexts c on c.request_id=r.id
  where r.subject_type='BUSINESS_WORKSPACE' and r.subject_id=target_business_id and r.verification_type::text=kind
   and r.status in('PENDING','APPROVED') and(r.expires_on is null or r.expires_on>=current_date)
   and c.identity_digest=identity_value) then raise exception 'VERIFICATION_ALREADY_SUBMITTED';end if;
 insert into verification_requests(id,subject_type,subject_id,verification_type,expires_on,document_name,
  storage_path,original_name,mime_type,status,submitted_by,submitted_at)
 values(request_uuid,'BUSINESS_WORKSPACE',target_business_id,kind::verification_type,expiry,source_name,path,original,mime,'PENDING',actor_user_id,clock_timestamp());
 insert into business_verification_contexts(request_id,workspace_id,manager_user_id,identity_digest)
 values(request_uuid,target_business_id,manager,identity_value);
 insert into business_workspace_audit(workspace_id,actor_user_id,action,subject_id)
 values(target_business_id,actor_user_id,'VERIFICATION_SUBMITTED',request_uuid);
 return request_uuid;
end $$;

create or replace function public.managed_verification_file(actor_user_id uuid,request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r verification_requests%rowtype;c business_verification_contexts%rowtype;
begin
 select * into r from verification_requests v where v.id=request_id;
 if not found then return null;end if;
 if r.subject_type<>'BUSINESS_WORKSPACE' then return public.ver_file_pre170(actor_user_id,request_id);end if;
 select * into c from business_verification_contexts where business_verification_contexts.request_id=r.id;
 if not found then return null;end if;
 if not public.managed_actor_has_permission(actor_user_id,'TRUST') and not(
  public.business_workspace_permission(actor_user_id,c.workspace_id,'OWNER')
  and(r.verification_type<>'IDENTITY' or c.manager_user_id=actor_user_id)) then return null;end if;
 if r.storage_path is null then return null;end if;
 return jsonb_build_object('storage_path',r.storage_path,'original_name',r.original_name,'mime_type',r.mime_type);
end $$;

create or replace function public.review_managed_verification(actor_user_id uuid,request_id uuid,review_status text,review_note text default '') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r verification_requests%rowtype;c business_verification_contexts%rowtype;
begin
 if not public.managed_actor_has_permission(actor_user_id,'TRUST') then raise exception 'FORBIDDEN';end if;
 select * into r from verification_requests v where v.id=request_id;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.subject_type='BUSINESS_WORKSPACE' then
  select * into c from business_verification_contexts v where v.request_id=r.id;
  perform 1 from business_workspaces where id=c.workspace_id and active for update;
  if not found then raise exception 'VERIFICATION_SUBJECT_CHANGED';end if;
  perform 1 from profiles where id=public.business_directory_manager(c.workspace_id) for update;
  if upper(trim(review_status))='APPROVED' and(c.identity_digest is distinct from public.business_document_identity(c.workspace_id,r.verification_type::text)
   or r.expires_on<current_date) then raise exception 'VERIFICATION_SUBJECT_CHANGED';end if;
 end if;
 perform public.ver_review_pre170(actor_user_id,request_id,review_status,review_note);
end $$;

-- Business proofs extend the existing file-before-Auth cleanup contract. Check
-- shared paths before deactivating the subject; no cross-record file is deleted.
create function public.business_erasure_documents(subject_uuid uuid) returns table(id uuid,storage_path text)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.id,r.storage_path from verification_requests r
 join business_verification_contexts c on c.request_id=r.id
 join business_workspaces w on w.id=c.workspace_id
 where (r.verification_type='IDENTITY' and c.manager_user_id=subject_uuid)
    or (not w.active and r.submitted_by=subject_uuid)
$$;
create function public.business_erasure_shared_path(subject_uuid uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.business_erasure_documents(subject_uuid) f where f.storage_path is not null and(
  exists(select 1 from verification_requests x where x.storage_path=f.storage_path
   and not exists(select 1 from public.business_erasure_documents(subject_uuid) own where own.id=x.id))
  or exists(select 1 from driver_portrait_uploads x where x.file_path=f.storage_path)
  or exists(select 1 from company_pages x where x.profile_image_path=f.storage_path)
  or exists(select 1 from capacities x where x.photo_storage_path=f.storage_path)
  or exists(select 1 from provider_shipment_events x where x.proof_storage_path=f.storage_path)
  or exists(select 1 from proof_files x where x.storage_path=f.storage_path)
  or exists(select 1 from payment_proofs x where x.file_path=f.storage_path)
  or exists(select 1 from support_attachments x where x.file_path=f.storage_path)
 ))
$$;
create or replace function public.prepare_account_erasure(actor_user_id uuid,target_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;subject_uuid uuid;current_status text;
begin
 if not exists(select 1 from profiles p where p.id=actor_user_id and p.active and p.role='ADMIN') then raise exception 'FORBIDDEN';end if;
 select subject_user_id into subject_uuid from account_deletion_requests where id=target_request_id;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.business_account_lock(subject_uuid);
 select status::text into current_status from account_deletion_requests where id=target_request_id for update;
 if current_status<>'COMPLETED' and public.business_erasure_shared_path(subject_uuid) then
  update account_deletion_requests set status='HELD',retention_reason='Some business files are used by another record. Our team must review them before deletion.',
   review_after=clock_timestamp()+interval '7 days',reviewed_by=actor_user_id where id=target_request_id;
  return jsonb_build_object('status','HELD');
 end if;
 result:=public.erase_prepare_pre170(actor_user_id,target_request_id);
 if result->>'status'='ERASING' then
  insert into account_erasure_files(request_id,storage_path)
  select target_request_id,f.storage_path from public.business_erasure_documents(subject_uuid) f
  where f.storage_path is not null on conflict do nothing;
 end if;
 return result;
end $$;
create or replace function public.finish_account_erasure(actor_user_id uuid,target_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;subject_uuid uuid;current_status text;
begin
 if not exists(select 1 from profiles p where p.id=actor_user_id and p.active and p.role='ADMIN') then raise exception 'FORBIDDEN';end if;
 select subject_user_id into subject_uuid from account_deletion_requests where id=target_request_id;
 if not found then raise exception 'NOT_FOUND';end if;
 perform public.business_account_lock(subject_uuid);
 select status::text into current_status from account_deletion_requests where id=target_request_id for update;
 if current_status<>'COMPLETED' and(public.business_erasure_shared_path(subject_uuid)
  or exists(select 1 from public.business_erasure_documents(subject_uuid) f where f.storage_path is not null
   and not exists(select 1 from account_erasure_files a where a.request_id=target_request_id and a.storage_path=f.storage_path and a.removed_at is not null)))
 then raise exception 'ERASURE_CLEANUP_INCOMPLETE';end if;
 result:=public.erase_finish_pre170(actor_user_id,target_request_id);
 if result->>'status'='COMPLETED' then
  delete from verification_requests r where r.id in(select f.id from public.business_erasure_documents(subject_uuid) f);
  -- Retained company records belong to the business after a handover. Their
  -- proof context must not retain the former manager's private account ID.
  update business_verification_contexts set manager_user_id=null where manager_user_id=subject_uuid;
 end if;
 return result;
end $$;
revoke all on function public.business_erasure_documents(uuid),public.business_erasure_shared_path(uuid)
 from public,anon,authenticated,service_role;

revoke all on function public.submit_managed_verification(uuid,jsonb),public.managed_verification_file(uuid,uuid),
 public.review_managed_verification(uuid,uuid,text,text),public.prepare_account_erasure(uuid,uuid),
 public.finish_account_erasure(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_managed_verification(uuid,jsonb),public.managed_verification_file(uuid,uuid),
 public.review_managed_verification(uuid,uuid,text,text),public.prepare_account_erasure(uuid,uuid),
 public.finish_account_erasure(uuid,uuid) to service_role;
revoke all on function public.business_directory_provider(uuid),public.business_directory_manager(uuid),
 public.business_document_identity(uuid,text),public.business_document_badges(uuid),
 public.provider_business_directory(uuid,text,integer,integer),public.business_verification_center(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.provider_business_directory(uuid,text,integer,integer),public.business_verification_center(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
