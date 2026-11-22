begin;
alter table public.company_pages add column cover_video_id text
  check (cover_video_id ~ '^[A-Za-z0-9_-]{11}$');
update public.company_pages set cover_video_id=youtube_video_id
  where organization_id is not null and youtube_video_id ~ '^[A-Za-z0-9_-]{11}$';

create or replace function public.provider_profile_workspace(actor_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; identity jsonb; cover text;
begin
  result:=public.provider_profile_workspace_pre_social167(actor_user_id);
  select public.provider_public_account_identity(c.organization_id,c.provider_profile_id), c.cover_video_id
    into identity,cover from public.company_pages c where c.id=(result->>'id')::uuid;
  return result||identity||jsonb_build_object('name',identity->>'account_name','cover_video_id',cover);
end $$;

create or replace function public.public_provider_page_details(requested_organization_id uuid default null,requested_provider_profile_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; identity jsonb; cover text;
begin
  result:=public.public_provider_page_details_pre_social167(requested_organization_id,requested_provider_profile_id);
  if result is null then return null; end if;
  identity:=public.provider_public_account_identity(requested_organization_id,requested_provider_profile_id);
  select c.cover_video_id into cover from public.company_pages c where c.published and
    ((c.organization_id=requested_organization_id and requested_provider_profile_id is null)
      or (c.provider_profile_id=requested_provider_profile_id and requested_organization_id is null));
  return result||identity||jsonb_build_object('public_name',identity->>'account_name','cover_video_id',cover);
end $$;

create or replace function public.update_provider_profile_page(actor_user_id uuid, command jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; rest jsonb:=command-array['account_name','handle','cover_video_id']; cover text;
begin
  if command is null or jsonb_typeof(command)<>'object' or command ? 'manager_name' then raise exception 'INVALID_PROVIDER_PROFILE_INPUT'; end if;
  if command ? 'account_name' or command ? 'handle' then result:=public.set_provider_public_identity(actor_user_id,command); end if;
  if rest<>'{}'::jsonb or (result is null and not (command ? 'cover_video_id')) then
    result:=public.update_provider_profile_page_pre_social167(actor_user_id,rest);
  end if;
  if command ? 'cover_video_id' then
    cover:=nullif(command->>'cover_video_id','');
    if cover is not null and cover !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'INVALID_COVER_VIDEO'; end if;
    if result is null then result:=(public.provider_profile_workspace(actor_user_id)->>'id')::uuid; end if;
    if result is null then raise exception 'NOT_FOUND'; end if;
    update public.company_pages set cover_video_id=cover where id=result and cover_video_id is distinct from cover;
    if found then
      insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,details)
        values(actor_user_id,'COMPANY_PAGE_UPDATED','company_page',result,jsonb_build_object('cover_video',cover is not null));
    end if;
  end if;
  return result;
end $$;
commit;
