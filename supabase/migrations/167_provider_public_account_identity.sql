-- FEAT-IAM/PRV/MKT-001. Presentation identity only; no role/authority conversion.
begin;
create table public.provider_identity_function_backups(signature text primary key,definition text not null);
alter table public.provider_identity_function_backups enable row level security;
revoke all on public.provider_identity_function_backups from public,anon,authenticated;
alter table public.company_pages add column account_name text check(account_name is null or char_length(account_name) between 1 and 140);
alter table public.provider_signup_intents add column public_account_name text,add column requested_public_handle text;
create table public.account_public_handles(handle text primary key,subject_kind text not null check(subject_kind in('ORGANIZATION','PROVIDER_PROFILE','BUSINESS')),subject_id uuid not null,created_at timestamptz not null default clock_timestamp());
alter table public.account_public_handles enable row level security;
revoke all on public.account_public_handles from public,anon,authenticated;
comment on table public.account_public_handles is 'Private global public-handle reservations. Old handles remain bound to their original subject to prevent impersonation; no legal names, emails or access rights.';
do $$begin
 if exists(select 1 from(select lower(trim(handle)) handle from public.organizations union all select lower(trim(handle)) from public.provider_profiles union all select lower(trim(handle)) from public.business_workspaces) h group by handle having count(*)>1)
 then raise exception 'GLOBAL_HANDLE_COLLISION';end if;
end$$;
insert into public.account_public_handles(handle,subject_kind,subject_id)
 select lower(trim(handle)),'ORGANIZATION',id from public.organizations union all
 select lower(trim(handle)),'PROVIDER_PROFILE',id from public.provider_profiles union all
 select lower(trim(handle)),'BUSINESS',id from public.business_workspaces;
create function public.account_claim_public_handle(kind text,subject uuid,value text) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare clean text:=lower(trim(coalesce(value,'')));accepted integer;
begin
 if kind not in('ORGANIZATION','PROVIDER_PROFILE','BUSINESS') or subject is null or clean!~'^[a-z0-9][a-z0-9_-]{1,63}$'
  or clean in('admin','api','app','login','logout','support','track','tracking','featured','privacy','terms','loadgistic') then raise exception 'INVALID_ACCOUNT_HANDLE';end if;
 perform pg_advisory_xact_lock(hashtextextended('loadgistic-public-handle:'||clean,0));
 insert into account_public_handles(handle,subject_kind,subject_id) values(clean,kind,subject)
 on conflict(handle) do update set subject_id=excluded.subject_id where account_public_handles.subject_kind=excluded.subject_kind and account_public_handles.subject_id=excluded.subject_id;
 get diagnostics accepted=row_count;if accepted<>1 then raise exception 'ACCOUNT_HANDLE_UNAVAILABLE';end if;
 return clean;
end$$;
create function public.account_handle_claim_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='UPDATE' and new.handle is not distinct from old.handle then return new;end if;
 new.handle:=public.account_claim_public_handle(case TG_TABLE_NAME when 'organizations' then 'ORGANIZATION' when 'provider_profiles' then 'PROVIDER_PROFILE' else 'BUSINESS' end,new.id,new.handle);
 return new;
end$$;
create trigger organization_global_handle before insert or update of handle on public.organizations for each row execute function public.account_handle_claim_trigger();
create trigger provider_global_handle before insert or update of handle on public.provider_profiles for each row execute function public.account_handle_claim_trigger();
create trigger business_global_handle before insert or update of handle on public.business_workspaces for each row execute function public.account_handle_claim_trigger();
create function public.provider_public_account_identity(org uuid,provider uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('account_name',coalesce(nullif(c.account_name,''),case when c.organization_id is not null then o.name else public.public_person_first_name(p.user_id) end,coalesce(o.handle,p.handle)),
 'manager_name',public.public_person_first_name(coalesce(p.user_id,(select m.user_id from organization_members m join profiles owner on owner.id=m.user_id and owner.active where m.organization_id=o.id and m.membership_role='OWNER' order by m.id limit 1))),
 'handle',coalesce(o.handle,p.handle))
 from company_pages c left join organizations o on o.id=c.organization_id left join provider_profiles p on p.id=c.provider_profile_id
 where (org is null)<>(provider is null) and(c.organization_id=org or c.provider_profile_id=provider)
$$;
create function public.provider_public_account_name(org uuid,provider uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$select public.provider_public_account_identity(org,provider)->>'account_name'$$;
create function public.resolve_public_provider_handle(requested_handle text) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('kind',r.subject_kind,'id',r.subject_id,'handle',coalesce(o.handle,p.handle))
 from account_public_handles r left join organizations o on r.subject_kind='ORGANIZATION' and o.id=r.subject_id
 left join provider_profiles p on r.subject_kind='PROVIDER_PROFILE' and p.id=r.subject_id
 join company_pages c on(c.organization_id=o.id or c.provider_profile_id=p.id) and c.published
 where r.handle=lower(trim(requested_handle)) and r.subject_kind<>'BUSINESS'
 and coalesce(o.public_visibility,p.public_visibility)='PUBLIC' and not coalesce(o.content_hidden,p.content_hidden,true)
 and not coalesce(o.review_workspace,p.review_workspace,true) and(o.id is null or o.type='TRANSPORT_COMPANY')
$$;
-- Preserve every current authorized command/projection before adding fields.
do $backups$
declare name text;args text;definition text;new_name text;
begin
 for name,args in values('provider_profile_workspace','uuid'),('update_provider_profile_page','uuid,jsonb'),('prepare_provider_signup_identity','text,jsonb,timestamp with time zone'),('complete_provider_signup','uuid,text'),('public_provider_page_details','uuid,uuid'),('capacity_search_metadata','jsonb'),('current_user_projection',''),('finish_account_erasure','uuid,uuid') loop
  new_name:=name||'_pre_social167';definition:=pg_get_functiondef(('public.'||name||'('||args||')')::regprocedure);
  insert into provider_identity_function_backups values('public.'||name||'('||args||')',definition);
  definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||name||'(','CREATE OR REPLACE FUNCTION public.'||new_name||'(');
  definition:=replace(definition,name||'.',new_name||'.');execute definition;
  execute 'revoke all on function public.'||new_name||'('||args||') from public,anon,authenticated,service_role';
 end loop;
end $backups$;
create or replace function public.provider_profile_workspace(actor_user_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;identity jsonb;
begin result:=public.provider_profile_workspace_pre_social167(actor_user_id);
 select public.provider_public_account_identity(c.organization_id,c.provider_profile_id) into identity from company_pages c where c.id=(result->>'id')::uuid;
 return result||identity||jsonb_build_object('name',identity->>'account_name');end$$;
create function public.set_provider_public_identity(actor_user_id uuid,command jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor record;page company_pages%rowtype;clean text;
begin
 perform public.require_content_policy(actor_user_id);
 select * into actor from provider_profile_actor_scope(actor_user_id);
 if not found or not actor.workspace_access or actor.is_company_driver or actor.actor_role not in('TRANSPORTER','DRIVER') then raise exception 'FORBIDDEN';end if;
 select * into page from company_pages c where c.organization_id=actor.organization_id or c.provider_profile_id=actor.provider_profile_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if command ? 'account_name' then
  clean:=public.normalize_personal_name(command->>'account_name');
  if jsonb_typeof(command->'account_name')<>'string' or char_length(clean) not between 1 and 140 or clean~'[[:cntrl:]]' then raise exception 'INVALID_PUBLIC_ACCOUNT_NAME';end if;
  update company_pages set account_name=clean,updated_at=clock_timestamp() where id=page.id;
 end if;
 if command ? 'handle' then
  if jsonb_typeof(command->'handle')<>'string' then raise exception 'INVALID_ACCOUNT_HANDLE';end if;
  clean:=public.account_claim_public_handle(case when page.organization_id is not null then 'ORGANIZATION' else 'PROVIDER_PROFILE' end,coalesce(page.organization_id,page.provider_profile_id),command->>'handle');
  if page.organization_id is not null then update organizations set handle=clean where id=page.organization_id;else update provider_profiles set handle=clean where id=page.provider_profile_id;end if;
 end if;
 insert into audit_logs(id,actor_user_id,organization_id,action,entity_type,entity_id,details,created_at) values(gen_random_uuid(),actor_user_id,actor.organization_id,'PUBLIC_ACCOUNT_IDENTITY_UPDATED','company_page',page.id,jsonb_build_object('accountNameChanged',command?'account_name','handleChanged',command?'handle'),clock_timestamp());
 return page.id;
end$$;
create or replace function public.update_provider_profile_page(actor_user_id uuid,command jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;rest jsonb:=command-array['account_name','handle'];
begin
 if command is null or jsonb_typeof(command)<>'object' or command ? 'manager_name' then raise exception 'INVALID_PROVIDER_PROFILE_INPUT';end if;
 if command ? 'account_name' or command ? 'handle' then result:=public.set_provider_public_identity(actor_user_id,command);end if;
 if rest<>'{}'::jsonb or result is null then result:=public.update_provider_profile_page_pre_social167(actor_user_id,rest);end if;
 return result;
end$$;
create or replace function public.prepare_provider_signup_identity(requested_token_digest text,command jsonb,requested_expires_at timestamptz) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare intent_id uuid;name text;clean_handle text;
begin
 if command ? 'accountName' or command ? 'handle' then
  name:=public.normalize_personal_name(command->>'accountName');clean_handle:=lower(trim(command->>'handle'));
  if jsonb_typeof(command->'accountName') is distinct from 'string' or char_length(name) not between 1 and 140 or name~'[[:cntrl:]]' then raise exception 'INVALID_PUBLIC_ACCOUNT_NAME';end if;
  if jsonb_typeof(command->'handle') is distinct from 'string' or clean_handle!~'^[a-z0-9][a-z0-9_-]{1,63}$' or clean_handle in('admin','api','app','login','logout','support','track','tracking','featured','privacy','terms','loadgistic') then raise exception 'INVALID_ACCOUNT_HANDLE';end if;
  if exists(select 1 from account_public_handles r where r.handle=clean_handle) then raise exception 'ACCOUNT_HANDLE_UNAVAILABLE';end if;
 end if;
 intent_id:=public.prepare_provider_signup_identity_pre_social167(requested_token_digest,command-array['accountName','handle'],requested_expires_at);
 update provider_signup_intents set public_account_name=name,requested_public_handle=clean_handle where provider_signup_intents.id=intent_id;return intent_id;
end$$;
create or replace function public.complete_provider_signup(actor_user_id uuid,requested_token_digest text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;intent provider_signup_intents%rowtype;
begin
 select * into intent from provider_signup_intents where token_digest=requested_token_digest;
 result:=public.complete_provider_signup_pre_social167(actor_user_id,requested_token_digest);
 if intent.public_account_name is not null then perform public.set_provider_public_identity(actor_user_id,jsonb_build_object('account_name',intent.public_account_name,'handle',intent.requested_public_handle));end if;
 return result;
end$$;
create or replace function public.public_provider_page_details(requested_organization_id uuid default null,requested_provider_profile_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;identity jsonb;
begin result:=public.public_provider_page_details_pre_social167(requested_organization_id,requested_provider_profile_id);if result is null then return null;end if;
 identity:=public.provider_public_account_identity(requested_organization_id,requested_provider_profile_id);
 return result||identity||jsonb_build_object('public_name',identity->>'account_name');end$$;
create or replace function public.current_user_projection() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;begin result:=public.current_user_projection_pre_social167();if result is null then return null;end if;
 return result||jsonb_build_object('provider_account_name',public.provider_public_account_name(nullif(result->>'organization_id','')::uuid,coalesce(nullif(result->>'provider_profile_id','')::uuid,nullif(result->>'employer_provider_profile_id','')::uuid)));end$$;
create or replace function public.capacity_search_metadata(item jsonb) returns jsonb language plpgsql stable security definer set search_path=public,extensions,pg_temp as $$
declare identity jsonb;begin identity:=public.provider_public_account_identity(nullif(item->>'provider_organization_id','')::uuid,nullif(item->>'provider_profile_id','')::uuid);
 return public.capacity_search_metadata_pre_social167(item)||jsonb_build_object('account_name',identity->>'account_name','manager_name',identity->>'manager_name');end$$;
-- Extend the existing completed-erasure cleanup, preserving its file-removal,
-- legal holds, owner scope and Auth-erasure checks. Handle tombstones remain
-- private identity-free reservations and never resolve a deleted public page.
create or replace function public.finish_account_erasure(actor_user_id uuid,target_request_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;subject_uuid uuid;
begin
 select r.subject_user_id into subject_uuid from account_deletion_requests r where r.id=target_request_id;
 result:=public.finish_account_erasure_pre_social167(actor_user_id,target_request_id);
 if result->>'status'='COMPLETED' then
  update company_pages c set account_name=null where exists(select 1 from provider_profiles p where p.id=c.provider_profile_id and p.user_id=subject_uuid)
   or exists(select 1 from organization_members m where m.organization_id=c.organization_id and m.user_id=subject_uuid and m.membership_role='OWNER');
 end if;
 return result;
end$$;
-- Replace display labels only in the existing safe producer family. All access,
-- bounds, source privacy, moderation and document guards remain unchanged.
do $labels$
declare row record;definition text;old_text text;new_text text;hits integer:=0;
begin
 for row in with recursive family as materialized(
  select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname~'^(public_capacity_page|capacity_search_public_rows|private_capacity_projection|private_capacity_filtered_page|capacity_search_private_rows|public_featured_provider_candidates|tracking_public_truck_summary|provider_guest_tracking|pending_provider_tracking_email_deliveries)($|_pre_)'
 ),reachable(oid) as(
  select oid from family where proname in('public_capacity_page','capacity_search_public_rows','private_capacity_projection','private_capacity_filtered_page','capacity_search_private_rows','public_featured_provider_candidates','tracking_public_truck_summary','provider_guest_tracking','pending_provider_tracking_email_deliveries')
  union select f.oid from family f join reachable r on strpos(pg_get_functiondef(r.oid),'public.'||f.proname||'(')>0
 )select oid from reachable loop
  definition:=pg_get_functiondef(row.oid);
  for old_text,new_text in values
   ('coalesce(organization.name,public.public_person_first_name(provider.user_id))','public.provider_public_account_name(organization.id,provider.id)'),
   ('coalesce(organization.name,public.public_person_first_name(profile.user_id))','public.provider_public_account_name(organization.id,profile.id)'),
   ('coalesce(o.name,public.public_person_first_name(p.user_id))','public.provider_public_account_name(o.id,p.id)'),
   ('coalesce(o.name,p.business_name)','public.provider_public_account_name(o.id,p.id)') loop
   if strpos(definition,old_text)>0 then definition:=replace(definition,old_text,new_text);hits:=hits+1;end if;
  end loop;
  if definition<>pg_get_functiondef(row.oid) then insert into provider_identity_function_backups values(row.oid::regprocedure::text,pg_get_functiondef(row.oid)) on conflict do nothing;execute definition;end if;
 end loop;
 if hits<6 then raise exception 'PUBLIC_ACCOUNT_LABEL_DRIFT';end if;
 -- Keep nonidentity matching facts and current employed-driver compatibility.
 select pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure) into definition;
 insert into provider_identity_function_backups values('public.capacity_search_matches(jsonb,jsonb)',definition);
 old_text:=$a$concat_ws(' ',item->>'provider_name',item->>'provider_handle',meta->>'driver_name')$a$;
 if strpos(definition,old_text)=0 then raise exception 'ACCOUNT_SEARCH_MATCH_DRIFT';end if;
 execute replace(definition,old_text,$a$concat_ws(' ',meta->>'account_name',item->>'provider_handle',meta->>'manager_name',meta->>'driver_name')$a$);
 select pg_get_functiondef('public.capacity_search_results_pre_retirement159(jsonb,text,text,uuid,integer)'::regprocedure) into definition;
 insert into provider_identity_function_backups values('public.capacity_search_results_pre_retirement159(jsonb,text,text,uuid,integer)',definition);
 for old_text,new_text in values
  ('null::text as driver,meta->''owner_documents'' as documents from facts','null::text as driver,meta->''owner_documents'' as documents,meta->>''account_name'' as account_name,meta->>''manager_name'' as manager_name from facts'),
  ('meta->>''driver_name'',meta->''driver_documents'' from facts','meta->>''driver_name'',meta->''driver_documents'',meta->>''account_name'',meta->>''manager_name'' from facts'),
  ('city,status,owner,driver,documents,count(*)','city,status,owner,driver,documents,account_name,manager_name,count(*)'),
  ('concat_ws('' '',title,identifier)','concat_ws('' '',title,identifier,account_name,manager_name)'),
  ('group by key,kind,title,subtitle,description,identifier,handle,city,status,owner,driver,documents','group by key,kind,title,subtitle,description,identifier,handle,city,status,owner,driver,documents,account_name,manager_name') loop
  if strpos(definition,old_text)=0 then raise exception 'ACCOUNT_SEARCH_RESULT_DRIFT:%',old_text;end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $labels$;
revoke all on function public.account_claim_public_handle(text,uuid,text),public.account_handle_claim_trigger(),public.provider_public_account_identity(uuid,uuid),public.provider_public_account_name(uuid,uuid),public.set_provider_public_identity(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.resolve_public_provider_handle(text) from public,anon,authenticated;
grant execute on function public.resolve_public_provider_handle(text) to service_role;
commit;
